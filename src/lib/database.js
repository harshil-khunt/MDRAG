import { MongoClient } from 'mongodb';
import config from '../config.js';
import crypto from 'crypto';

const client = new MongoClient(config.mongoUri, {});

let db;

/**
 * Cosine similarity helper
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0.0;
  let na = 0.0;
  let nb = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    na += a * a;
    nb += b * b;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) + 1e-12;
  return dot / denom;
}

export async function connectDb() {
  if (!db) {
    await client.connect();
    db = client.db(config.dbName);
  }
  return db;
}

export async function createWorkspace(id, name, owner, llmProvider = 'gemini', userApiKey = null, role = 'customer_service', customPrompt = null) {
  const database = await connectDb();
  const col = database.collection('workspaces');
  
  // Set models based on provider
  const llmConfig = llmProvider === 'openai' 
    ? {
        llm_provider: 'openai',
        llm_model: 'gpt-4o-mini',
        embedding_model: 'text-embedding-3-small',
        user_api_key: userApiKey, // User's own key (optional)
        use_default_key: !userApiKey // Use default if no user key
      }
    : {
        llm_provider: 'gemini',
        llm_model: 'gemini-2.5-flash',
        embedding_model: 'text-embedding-004',
        user_api_key: userApiKey, // User's own key (optional)
        use_default_key: !userApiKey // Use default if no user key
      };
  
  const doc = { 
    id, 
    name, 
    owner, 
    ...llmConfig,
    chatbot_role: role, // customer_service, sales, technical_support, custom
    custom_prompt: customPrompt, // null if using default role prompt
    created_at: new Date(),
    updated_at: new Date()
  };
  
  await col.insertOne(doc);
  return doc;
}

export async function updateWorkspaceApiKey(workspaceId, apiKey) {
  const database = await connectDb();
  const col = database.collection('workspaces');
  
  const result = await col.updateOne(
    { id: workspaceId },
    { 
      $set: { 
        user_api_key: apiKey,
        use_default_key: !apiKey,
        updated_at: new Date()
      } 
    }
  );
  
  return result.modifiedCount > 0;
}

export async function listWorkspaces() {
  const database = await connectDb();
  return database.collection('workspaces').find({}).toArray();
}

export async function getWorkspace(workspaceId) {
  const database = await connectDb();
  return database.collection('workspaces').findOne({ id: workspaceId });
}

/**
 * Save chunk embeddings and metadata into collection for the workspace.
 * Each chunk inserted as a document with fields: source_name, chunk_index, text, embedding
 */
export async function insertChunks(workspaceId, sourceName, chunks, embeddings) {
  const database = await connectDb();
  const col = database.collection(`ws_${workspaceId}_chunks`);

  const bulk = embeddings.map((embedding, idx) => ({
    source_name: sourceName,
    chunk_index: idx,
    text: chunks[idx],
    embedding,
    created_at: new Date()
  }));
  if (bulk.length > 0) {
    await col.insertMany(bulk);
  }
}

/**
 * Fetch top-k similar chunks by cosine similarity (simple in-app search).
 */
export async function searchSimilar(workspaceId, queryEmbedding, topK = 5) {
  const database = await connectDb();
  const col = database.collection(`ws_${workspaceId}_chunks`);
  const docs = await col.find({}).toArray(); // small dataset approach
  
  console.log(`\n🔍 Searching workspace: ws_${workspaceId}_chunks`);
  console.log(`📊 Total chunks found: ${docs.length}`);
  
  // Log source breakdown
  if (docs.length > 0) {
    const sourceTypes = {};
    docs.forEach(doc => {
      const sourceName = doc.source_name || 'unknown';
      if (sourceName.startsWith('custom_text_')) {
        sourceTypes['custom_text'] = (sourceTypes['custom_text'] || 0) + 1;
      } else if (sourceName.startsWith('http')) {
        sourceTypes['url'] = (sourceTypes['url'] || 0) + 1;
      } else {
        sourceTypes['file'] = (sourceTypes['file'] || 0) + 1;
      }
    });
    console.log(`📂 Source breakdown:`, sourceTypes);
  }
  
  if (!docs || docs.length === 0) return [];
  // compute similarity
  function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
  }
  // Calculate similarity scores with priority boost
  const scored = docs.map(d => {
    const baseSimilarity = cosineSim(d.embedding, queryEmbedding);
    const sourceName = d.source_name || '';
    
    // Classify source type and apply priority boost
    let sourceType;
    let priorityBoost = 0;
    
    if (sourceName.startsWith('custom_text_')) {
      sourceType = 'custom_text';
      priorityBoost = 0.15; // +15% boost for custom texts
    } else if (sourceName.startsWith('http')) {
      sourceType = 'url';
      priorityBoost = 0; // No boost for URLs
    } else {
      sourceType = 'file';
      priorityBoost = 0.05; // +5% boost for uploaded files
    }
    
    // Boosted score = similarity + priority boost
    const boostedScore = baseSimilarity + priorityBoost;
    
    return { 
      doc: d, 
      score: boostedScore,
      originalScore: baseSimilarity,
      sourceType: sourceType 
    };
  });
  
  // Sort by boosted score (similarity + priority boost)
  // This ensures high-similarity URLs can beat low-similarity files
  scored.sort((a, b) => b.score - a.score);
  
  // Log top results with scores
  console.log(`\n🎯 Top ${Math.min(topK, scored.length)} results by relevance:`);
  scored.slice(0, topK).forEach((s, i) => {
    const sourceName = s.doc.source_name || 'unknown';
    const preview = s.doc.text.substring(0, 80).replace(/\n/g, ' ');
    const priorityIcon = s.sourceType === 'custom_text' ? '⭐' : s.sourceType === 'file' ? '📄' : '🌐';
    const boost = s.score - s.originalScore;
    const boostText = boost > 0 ? ` (+${boost.toFixed(2)} boost)` : '';
    console.log(`  ${i + 1}. ${priorityIcon} [${s.sourceType.toUpperCase()}] Score: ${s.score.toFixed(4)}${boostText} | ${sourceName}`);
    console.log(`     Preview: "${preview}..."`);
  });
  
  return scored.slice(0, topK).map(s => ({ ...s.doc, score: s.score }));
}

/* ===========================
   TRACKED SOURCES & CHANGE DETECTION
   =========================== */

/**
 * Add or update a tracked source for periodic monitoring
 */
export async function upsertTrackedSource(workspaceId, url, options = {}) {
  const database = await connectDb();
  const col = database.collection('tracked_sources');
  
  const doc = {
    workspace_id: workspaceId,
    url,
    crawl_domain: options.crawlDomain !== false, // default true
    max_pages: options.maxPages || 50,
    max_depth: options.maxDepth || 3,
    schedule_minutes: options.scheduleMinutes || 60, // re-crawl every hour by default
    enable_ocr: options.enableOcr || false, // OCR disabled by default
    last_crawled_at: null,
    last_hash: null,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date()
  };
  
  await col.updateOne(
    { workspace_id: workspaceId, url },
    { $set: doc, $setOnInsert: { created_at: new Date() } },
    { upsert: true }
  );
  
  return doc;
}

/**
 * Get all tracked sources that need re-crawling
 */
export async function getSourcesForRecrawl() {
  const database = await connectDb();
  const col = database.collection('tracked_sources');
  
  const now = new Date();
  
  // Find sources where:
  // - status is 'active'
  // - url exists and is not empty
  // - last_crawled_at is null OR (now - last_crawled_at) >= schedule_minutes
  const sources = await col.find({
    status: 'active',
    url: { $exists: true, $ne: null, $ne: '' },
    $or: [
      { last_crawled_at: null },
      {
        last_crawled_at: {
          $lte: new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago minimum
        }
      }
    ]
  }).toArray();
  
  return sources;
}

/**
 * Update last crawled time and hash for a source
 */
export async function updateSourceCrawlStatus(workspaceId, url, contentHash) {
  const database = await connectDb();
  const col = database.collection('tracked_sources');
  
  await col.updateOne(
    { workspace_id: workspaceId, url },
    {
      $set: {
        last_crawled_at: new Date(),
        last_hash: contentHash,
        updated_at: new Date()
      }
    }
  );
}

/**
 * List all tracked sources for a workspace
 */
export async function listTrackedSources(workspaceId) {
  const database = await connectDb();
  const col = database.collection('tracked_sources');
  return col.find({ workspace_id: workspaceId }).toArray();
}

/**
 * Generate content hash for change detection
 */
export function generateContentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Record a change event when content changes
 */
export async function recordChangeEvent(workspaceId, sourceName, oldHash, newHash, summary = '') {
  const database = await connectDb();
  const col = database.collection('change_events');
  
  const event = {
    workspace_id: workspaceId,
    source_name: sourceName,
    old_hash: oldHash,
    new_hash: newHash,
    summary,
    detected_at: new Date()
  };
  
  await col.insertOne(event);
  return event;
}

/**
 * Get recent change events for a workspace
 */
export async function getChangeEvents(workspaceId, limit = 50) {
  const database = await connectDb();
  const col = database.collection('change_events');
  return col.find({ workspace_id: workspaceId })
    .sort({ detected_at: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Add or update a QnA pair for a workspace
 */
export async function upsertQnA(workspaceId, question, answer, embedding, id = null) {
  const database = await connectDb();
  const col = database.collection('qna_pairs');
  
  const doc = {
    workspace_id: workspaceId,
    question,
    answer,
    question_embedding: embedding,
    created_at: new Date(),
    updated_at: new Date()
  };
  
  if (id) {
    // Update existing QnA
    await col.updateOne(
      { _id: id, workspace_id: workspaceId },
      { $set: { ...doc, created_at: undefined } }
    );
    return { _id: id, ...doc };
  } else {
    // Insert new QnA
    const result = await col.insertOne(doc);
    return { _id: result.insertedId, ...doc };
  }
}

/**
 * Get all QnA pairs for a workspace
 */
export async function getQnAs(workspaceId) {
  const database = await connectDb();
  const col = database.collection('qna_pairs');
  return col.find({ workspace_id: workspaceId })
    .sort({ created_at: -1 })
    .toArray();
}

/**
 * Delete a QnA pair
 */
export async function deleteQnA(workspaceId, qnaId) {
  const database = await connectDb();
  const col = database.collection('qna_pairs');
  const result = await col.deleteOne({ _id: qnaId, workspace_id: workspaceId });
  return result.deletedCount > 0;
}

/**
 * Search similar QnAs using vector similarity
 */
export async function searchSimilarQnAs(workspaceId, queryEmbedding, topK = 3) {
  const database = await connectDb();
  const col = database.collection('qna_pairs');
  
  const qnas = await col.find({ workspace_id: workspaceId }).toArray();
  
  if (qnas.length === 0) return [];
  
  // Calculate cosine similarity for each QnA
  const scored = qnas.map(qna => {
    const similarity = cosineSimilarity(queryEmbedding, qna.question_embedding);
    return { ...qna, similarity };
  });
  
  // Sort by similarity and return top K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

/* ===========================
   CUSTOM TEXT ENTRIES
   =========================== */

/**
 * Add custom text entry (business info, personal notes, FAQs, etc.)
 */
export async function addCustomText(workspaceId, title, content) {
  const database = await connectDb();
  const col = database.collection('custom_texts');
  
  const doc = {
    workspace_id: workspaceId,
    title,
    content,
    created_at: new Date(),
    updated_at: new Date()
  };
  
  const result = await col.insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

/**
 * Get all custom texts for a workspace
 */
export async function getCustomTexts(workspaceId) {
  const database = await connectDb();
  const col = database.collection('custom_texts');
  return col.find({ workspace_id: workspaceId }).toArray();
}

/**
 * Update custom text
 */
export async function updateCustomText(workspaceId, textId, title, content) {
  const database = await connectDb();
  const col = database.collection('custom_texts');
  
  const result = await col.updateOne(
    { _id: textId, workspace_id: workspaceId },
    { 
      $set: { 
        title, 
        content, 
        updated_at: new Date() 
      } 
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Delete custom text
 */
export async function deleteCustomText(workspaceId, textId) {
  const database = await connectDb();
  const col = database.collection('custom_texts');
  
  const result = await col.deleteOne({ 
    _id: textId, 
    workspace_id: workspaceId 
  });
  
  return result.deletedCount > 0;
}

/**
 * Get document summary for a workspace (list of all sources with chunk counts)
 */
export async function getWorkspaceDocuments(workspaceId) {
  const database = await connectDb();
  const col = database.collection(`ws_${workspaceId}_chunks`);
  
  // Aggregate to get unique sources and their chunk counts
  const pipeline = [
    {
      $group: {
        _id: '$source_name',
        chunk_count: { $sum: 1 },
        created_at: { $min: '$created_at' }
      }
    },
    {
      $project: {
        source_name: '$_id',
        chunk_count: 1,
        created_at: 1,
        source_type: {
          $cond: {
            if: { $regexMatch: { input: '$_id', regex: '^http' } },
            then: 'url',
            else: {
              $cond: {
                if: { $regexMatch: { input: '$_id', regex: '^custom_text_' } },
                then: 'custom_text',
                else: 'file'
              }
            }
          }
        }
      }
    },
    {
      $sort: { created_at: -1 }
    }
  ];
  
  const documents = await col.aggregate(pipeline).toArray();
  return documents;
}

/**
 * Update workspace chatbot role and custom prompt
 */
export async function updateWorkspaceRole(workspaceId, role, customPrompt = null) {
  const database = await connectDb();
  const col = database.collection('workspaces');
  
  const result = await col.updateOne(
    { id: workspaceId },
    { 
      $set: { 
        chatbot_role: role,
        custom_prompt: customPrompt,
        updated_at: new Date()
      } 
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * ========================================
 * JOB TRACKING FUNCTIONS
 * Track upload/crawl job progress in real-time
 * ========================================
 */

/**
 * Create a new job tracking entry
 * @param {string} workspaceId - Workspace ID
 * @param {string} jobId - BullMQ job ID
 * @param {string} type - 'file' | 'url' | 'custom_text'
 * @param {string} name - File name or URL
 * @param {object} metadata - Additional metadata (file size, URL count, etc.)
 */
export async function createJobTracking(workspaceId, jobId, type, name, metadata = {}) {
  const database = await connectDb();
  const col = database.collection('job_tracking');
  
  const doc = {
    workspaceId,
    jobId,
    type, // 'file', 'url', 'custom_text'
    name,
    status: 'queued', // queued, processing, completed, failed
    progress: {
      current: 0,
      total: metadata.total || 0,
      percentage: 0,
      message: 'Queued for processing...'
    },
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null
  };
  
  await col.insertOne(doc);
  return doc;
}

/**
 * Update job progress
 * @param {string} jobId - BullMQ job ID
 * @param {object} progress - Progress update { current, total, message }
 * @param {string} status - Optional status update
 */
export async function updateJobProgress(jobId, progress, status = null) {
  const database = await connectDb();
  const col = database.collection('job_tracking');
  
  const update = {
    $set: {
      updatedAt: new Date()
    }
  };
  
  if (progress) {
    const percentage = progress.total > 0 
      ? Math.round((progress.current / progress.total) * 100)
      : 0;
    
    update.$set.progress = {
      current: progress.current || 0,
      total: progress.total || 0,
      percentage,
      message: progress.message || 'Processing...'
    };
  }
  
  if (status) {
    update.$set.status = status;
    
    if (status === 'processing' && !update.$set.startedAt) {
      update.$set.startedAt = new Date();
    }
    
    if (status === 'completed' || status === 'failed') {
      update.$set.completedAt = new Date();
    }
  }
  
  await col.updateOne({ jobId }, update);
}

/**
 * Get all active jobs for a workspace
 * @param {string} workspaceId - Workspace ID
 * @returns {Array} Active jobs (queued or processing)
 */
export async function getActiveJobs(workspaceId) {
  const database = await connectDb();
  const col = database.collection('job_tracking');
  
  return col.find({
    workspaceId,
    status: { $in: ['queued', 'processing'] }
  })
  .sort({ createdAt: -1 })
  .toArray();
}

/**
 * Get recent completed jobs for a workspace
 * @param {string} workspaceId - Workspace ID
 * @param {number} limit - Number of jobs to return
 * @returns {Array} Recent completed/failed jobs
 */
export async function getRecentJobs(workspaceId, limit = 10) {
  const database = await connectDb();
  const col = database.collection('job_tracking');
  
  return col.find({
    workspaceId,
    status: { $in: ['completed', 'failed'] }
  })
  .sort({ completedAt: -1 })
  .limit(limit)
  .toArray();
}

/**
 * Get all jobs for a workspace (active + recent)
 * @param {string} workspaceId - Workspace ID
 * @returns {object} { active: [], recent: [] }
 */
export async function getAllJobs(workspaceId) {
  const [active, recent] = await Promise.all([
    getActiveJobs(workspaceId),
    getRecentJobs(workspaceId, 20)
  ]);
  
  return { active, recent };
}

/**
 * Clean up old completed jobs (older than 24 hours)
 */
export async function cleanupOldJobs() {
  const database = await connectDb();
  const col = database.collection('job_tracking');
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const result = await col.deleteMany({
    status: { $in: ['completed', 'failed'] },
    completedAt: { $lt: oneDayAgo }
  });
  
  return result.deletedCount;
}
