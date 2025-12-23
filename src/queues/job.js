import { saveFileTemp } from '../lib/storage.js';
import { extractTextFromBuffer } from '../lib/scraper.js';
import { getEmbeddings } from '../lib/embeddings.js';
import { insertChunks, generateContentHash, updateSourceCrawlStatus, recordChangeEvent } from '../lib/database.js';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.js';
import mime from 'mime-types';
import { deduplicateChunks } from '../lib/crawl-optimizer.js';

/**
 * slice text into chunks with overlap
 */
export function chunkText(text, size = config.chunkSize, overlap = config.chunkOverlap) {
  const chunks = [];
  if (!text || text.length === 0) return [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    const chunk = text.slice(i, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (end === text.length) break;
    i = end - overlap;
  }
  return chunks;
}

/**
 * Process file job: move file to workspace dir, extract text, chunk, embed, store
 */
export async function processFileJob({ tempPath, filename, workspaceId }) {
  // Get workspace settings
  const { getWorkspace } = await import('../lib/database.js');
  const workspace = await getWorkspace(workspaceId);
  const llmProvider = workspace?.llm_provider || 'gemini';
  const embeddingModel = workspace?.embedding_model || config.embeddingModel;
  const userApiKey = workspace?.user_api_key || null;
  
  // move file to workspace storage
  const saved = await saveFileTemp(tempPath, workspaceId, filename);
  // read buffer
  const buffer = await fs.readFile(saved);
  const contentType = mime.lookup(saved) || '';
  const text = await extractTextFromBuffer(buffer, filename, contentType);
  if (!text || text.length < 10) {
    console.warn('No text extracted from', filename);
    return;
  }
  const chunks = chunkText(text);
  // create embeddings in batches to respect rate limits
  const batchSize = 50; // Increased to 50 for faster processing
  const embeddings = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    const slice = chunks.slice(i, i + batchSize);
    const embs = await getEmbeddings(slice, embeddingModel, llmProvider, userApiKey);
    embeddings.push(...embs);
    // Reduced delay for faster processing
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  await insertChunks(workspaceId, filename, chunks, embeddings);
}

/**
 * Process URL job: fetch URL buffer in caller (server enqueues) or we can fetch here.
 * Here we expect url, name, workspaceId, crawlDomain (optional), trackChanges (optional), enableOcr (optional)
 */
import { fetchUrlBuffer, crawlDomain } from '../lib/scraper.js';
export async function processUrlJob({ url, workspaceId, name, crawlDomain: shouldCrawl = true, maxPages = 100, maxDepth = 3, trackChanges = false, oldHash = null, enableOcr = false }) {
  // Validate URL before processing
  if (!url || typeof url !== 'string' || url.trim() === '' || url === 'undefined') {
    console.error(`❌ Invalid URL received in job: "${url}" - skipping`);
    return;
  }
  
  // Get workspace settings
  const { getWorkspace } = await import('../lib/database.js');
  const workspace = await getWorkspace(workspaceId);
  const llmProvider = workspace?.llm_provider || 'gemini';
  const embeddingModel = workspace?.embedding_model || config.embeddingModel;
  const userApiKey = workspace?.user_api_key || null;
  
  if (shouldCrawl) {
    // Crawl entire domain with optional OCR
    console.log(`Starting domain crawl for ${url}${enableOcr ? ' (OCR enabled)' : ''}`);
    
    const pages = await crawlDomain(url, maxPages, maxDepth, enableOcr);
    
    if (pages.length === 0) {
      console.warn('No pages found during crawl');
      return;
    }

    console.log(`Processing ${pages.length} pages from domain crawl`);
    
    // Combine all page texts for change detection
    const allText = pages.map(p => p.text).join('\n\n');
    const newHash = generateContentHash(allText);
    
    // Check for changes if tracking
    let hasChanges = true;
    if (trackChanges && oldHash) {
      hasChanges = newHash !== oldHash;
      if (!hasChanges) {
        console.log(`No changes detected for ${url}`);
        await updateSourceCrawlStatus(workspaceId, url, newHash);
        return; // Skip processing if no changes
      }
      console.log(`✨ Changes detected for ${url}!`);
      await recordChangeEvent(workspaceId, url, oldHash, newHash, `Domain crawled: ${pages.length} pages`);
    }
    
    // Process pages in parallel batches for much faster embedding
    let totalChunks = 0;
    const PAGE_BATCH_SIZE = 5; // Process 5 pages simultaneously
    
    console.log(`Processing ${pages.length} pages in parallel batches of ${PAGE_BATCH_SIZE}`);
    
    for (let batchStart = 0; batchStart < pages.length; batchStart += PAGE_BATCH_SIZE) {
      const pageBatch = pages.slice(batchStart, batchStart + PAGE_BATCH_SIZE);
      
      // Process all pages in this batch simultaneously
      await Promise.all(pageBatch.map(async (page, batchIndex) => {
        const pageNum = batchStart + batchIndex + 1;
        const text = page.text;
        if (!text || text.length < 10) return;
        
        let chunks = chunkText(text);
        
        // Deduplicate chunks before embedding
        const originalChunkCount = chunks.length;
        chunks = deduplicateChunks(chunks);
        const deduplicatedCount = originalChunkCount - chunks.length;
        
        if (deduplicatedCount > 0) {
          console.log(`Deduplicated ${deduplicatedCount} chunks from ${page.url}`);
        }
        
        totalChunks += chunks.length;
        const batchSize = 50; // Increased to 50 for faster processing
        const embeddings = [];
        
        for (let i = 0; i < chunks.length; i += batchSize) {
          const slice = chunks.slice(i, i + batchSize);
          const embs = await getEmbeddings(slice, embeddingModel, llmProvider, userApiKey);
          embeddings.push(...embs);
          
          // Reduced delay for faster processing
          if (i + batchSize < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        await insertChunks(workspaceId, page.url, chunks, embeddings);
        console.log(`Processed page ${pageNum}/${pages.length}: ${page.url} (${chunks.length} chunks)`);
      }));
    }
    
    // Update crawl status
    if (trackChanges) {
      await updateSourceCrawlStatus(workspaceId, url, newHash);
    }
    
    console.log(`Domain crawl complete: ${pages.length} pages processed, ${totalChunks} total chunks embedded`);
  } else {
    // Single page processing (original behavior)
    const { buffer, contentType } = await fetchUrlBuffer(url);
    const text = await extractTextFromBuffer(buffer, name || url, contentType);
    if (!text || text.length < 10) {
      return;
    }
    
    // Change detection for single page
    const newHash = generateContentHash(text);
    let hasChanges = true;
    
    if (trackChanges && oldHash) {
      hasChanges = newHash !== oldHash;
      if (!hasChanges) {
        console.log(`No changes detected for ${url}`);
        await updateSourceCrawlStatus(workspaceId, url, newHash);
        return;
      }
      console.log(`✨ Changes detected for ${url}!`);
      await recordChangeEvent(workspaceId, url, oldHash, newHash, 'Single page updated');
    }
    
    let chunks = chunkText(text);
    
    // Deduplicate chunks
    const originalChunkCount = chunks.length;
    chunks = deduplicateChunks(chunks);
    const deduplicatedCount = originalChunkCount - chunks.length;
    
    if (deduplicatedCount > 0) {
      console.log(`Deduplicated ${deduplicatedCount} chunks`);
    }
    
    const batchSize = 50; // Increased to 50 for faster processing
    const embeddings = [];
    for (let i = 0; i < chunks.length; i += batchSize) {
      const slice = chunks.slice(i, i + batchSize);
      const embs = await getEmbeddings(slice, embeddingModel, llmProvider, userApiKey);
      embeddings.push(...embs);
      
      // Reduced delay for faster processing
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    await insertChunks(workspaceId, name || url, chunks, embeddings);
    
    if (trackChanges) {
      await updateSourceCrawlStatus(workspaceId, url, newHash);
    }
  }
}

/**
 * Process custom text: chunk, embed, and store
 */
export async function processCustomTextJob({ workspaceId, textId, title, content, isUpdate = false }) {
  console.log(`\n========================================`);
  console.log(`🔧 Processing custom text "${title}"`);
  console.log(`📁 Workspace ID: ${workspaceId}`);
  console.log(`🆔 Text ID: ${textId}`);
  console.log(`📝 Content length: ${content.length} characters`);
  console.log(`========================================\n`);
  
  if (!content || content.length < 10) {
    console.warn('Custom text content too short, skipping');
    return;
  }
  
  // Get workspace settings
  const { getWorkspace } = await import('../lib/database.js');
  const workspace = await getWorkspace(workspaceId);
  const llmProvider = workspace?.llm_provider || 'gemini';
  const embeddingModel = workspace?.embedding_model || config.embeddingModel;
  const userApiKey = workspace?.user_api_key || null;
  
  // If update, delete old chunks first
  if (isUpdate) {
    const { connectDb } = await import('../lib/database.js');
    const database = await connectDb();
    const col = database.collection(`ws_${workspaceId}_chunks`);
    await col.deleteMany({ source_name: `custom_text_${textId}` });
    console.log(`Deleted old chunks for custom text ${textId}`);
  }
  
  // Chunk the text
  let chunks = chunkText(content);
  
  // Deduplicate chunks
  const originalCount = chunks.length;
  chunks = deduplicateChunks(chunks);
  
  if (originalCount !== chunks.length) {
    console.log(`Deduplicated ${originalCount - chunks.length} chunks from custom text`);
  }
  
  // Create embeddings in batches
  const batchSize = 50; // Increased to 50 for faster processing
  const embeddings = [];
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const slice = chunks.slice(i, i + batchSize);
    const embs = await getEmbeddings(slice, embeddingModel, llmProvider, userApiKey);
    embeddings.push(...embs);
    
    // Reduced delay for faster processing
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Store with special source name format
  const sourceName = `custom_text_${textId}`;
  await insertChunks(workspaceId, sourceName, chunks, embeddings);
  
  console.log(`\n✅ Custom text "${title}" processed successfully!`);
  console.log(`📦 Chunks created: ${chunks.length}`);
  console.log(`🎯 Source name: ${sourceName}`);
  console.log(`💾 Stored in collection: ws_${workspaceId}_chunks`);
  console.log(`========================================\n`);
}
