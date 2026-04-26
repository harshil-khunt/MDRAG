/**
 * Pinecone Vector Database Integration
 * 
 * This module handles all vector storage and similarity search operations.
 * MongoDB stores metadata and text, Pinecone stores embeddings.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import config from '../config.js';
import { v4 as uuidv4 } from 'uuid';

let pineconeClient = null;
let pineconeIndex = null;

/**
 * Initialize Pinecone client and index
 */
export async function initPinecone() {
  if (pineconeClient && pineconeIndex) {
    return pineconeIndex;
  }

  try {
    console.log('🔌 Initializing Pinecone...');
    
    pineconeClient = new Pinecone({
      apiKey: config.pineconeApiKey,
    });

    pineconeIndex = pineconeClient.index(config.pineconeIndexName);
    
    console.log('✅ Pinecone initialized successfully');
    return pineconeIndex;
  } catch (error) {
    console.error('❌ Failed to initialize Pinecone:', error.message);
    throw new Error(`Pinecone initialization failed: ${error.message}`);
  }
}

/**
 * Pad or truncate embedding to target dimension (768) if needed
 * Gemini embeddings are 768 (native), OpenAI are 1536 (truncated to 768)
 */
function padEmbedding(embedding, targetDim = 768) {
  if (embedding.length === targetDim) {
    return embedding;
  }
  
  if (embedding.length > targetDim) {
    console.warn(`⚠️ Embedding dimension ${embedding.length} exceeds target ${targetDim}, truncating`);
    return embedding.slice(0, targetDim);
  }
  
  // Pad with zeros
  const padded = [...embedding];
  while (padded.length < targetDim) {
    padded.push(0);
  }
  
  return padded;
}

/**
 * Store embeddings in Pinecone
 * @param {Array} vectors - Array of {id, embedding, metadata}
 * @param {string} namespace - Workspace ID as namespace
 */
export async function upsertVectors(vectors, namespace) {
  try {
    const index = await initPinecone();
    
    // Format vectors for Pinecone
    const formattedVectors = vectors.map(v => ({
      id: v.id,
      values: padEmbedding(v.embedding),
      metadata: v.metadata || {}
    }));
    
    // Track write units (1 write unit per vector)
    const writeUnits = formattedVectors.length;
    
    // Upsert in batches of 100 (Pinecone limit)
    const batchSize = 100;
    for (let i = 0; i < formattedVectors.length; i += batchSize) {
      const batch = formattedVectors.slice(i, i + batchSize);
      await index.namespace(namespace).upsert(batch);
    }
    
    console.log(`✅ Upserted ${formattedVectors.length} vectors to Pinecone namespace: ${namespace}`);
    console.log(`📊 Write units used: ${writeUnits}`);
    
    // Log write units to MongoDB for tracking
    await logPineconeOperation(namespace, 'write', writeUnits);
    
    return { success: true, writeUnits };
  } catch (error) {
    console.error('❌ Failed to upsert vectors to Pinecone:', error.message);
    throw error;
  }
}

/**
 * Search for similar vectors in Pinecone
 * @param {Array} queryEmbedding - Query vector
 * @param {string} namespace - Workspace ID
 * @param {number} topK - Number of results
 * @returns {Array} - Array of {id, score, metadata}
 */
export async function searchVectors(queryEmbedding, namespace, topK = 30) {
  try {
    const index = await initPinecone();
    
    const paddedQuery = padEmbedding(queryEmbedding);
    
    const results = await index.namespace(namespace).query({
      vector: paddedQuery,
      topK: topK,
      includeMetadata: true
    });
    
    // Track read units (1 read unit per query)
    const readUnits = 1;
    
    // Format results
    const matches = results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata
    }));
    
    console.log(`🔍 Found ${matches.length} similar vectors in namespace: ${namespace}`);
    console.log(`📊 Read units used: ${readUnits}`);
    
    // Log read units to MongoDB for tracking
    await logPineconeOperation(namespace, 'read', readUnits);
    
    return matches;
  } catch (error) {
    console.error('❌ Failed to search vectors in Pinecone:', error.message);
    throw error;
  }
}

/**
 * Delete vectors by IDs
 * @param {Array} ids - Array of vector IDs to delete
 * @param {string} namespace - Workspace ID
 */
export async function deleteVectors(ids, namespace) {
  console.log("ids");
  try {
    const index = await initPinecone();
    
    await index.namespace(namespace).deleteMany(ids);
    
    // Track write units (1 write unit per delete)
    const writeUnits = ids.length;
    
    console.log(`🗑️ Deleted ${ids.length} vectors from namespace: ${namespace}`);
    console.log(`📊 Write units used: ${writeUnits}`);
    
    // Log write units
    await logPineconeOperation(namespace, 'write', writeUnits);
    
    return { success: true, writeUnits };
  } catch (error) {
    console.error('❌ Failed to delete vectors from Pinecone:', error.message);
    throw error;
  }
}

/**
 * Delete all vectors in a namespace (workspace)
 * @param {string} namespace - Workspace ID
 */
export async function deleteNamespace(namespace) {
  try {
    const index = await initPinecone();
    
    await index.namespace(namespace).deleteAll();
    
    console.log(`🗑️ Deleted all vectors from namespace: ${namespace}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete namespace from Pinecone:', error.message);
    throw error;
  }
}

/**
 * Delete vectors by metadata filter (e.g., by source_name)
 * @param {string} namespace - Workspace ID
 * @param {Object} filter - Metadata filter
 */
export async function deleteByMetadata(namespace, filter) {
  try {
    const index = await initPinecone();
    
    // Pinecone deleteMany with filter
    await index.namespace(namespace).deleteMany(filter);
    
    console.log(`🗑️ Deleted vectors matching filter from namespace: ${namespace}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete by metadata from Pinecone:', error.message);
    throw error;
  }
}

/**
 * Generate unique chunk ID
 */
export function generateChunkId() {
  return `chunk_${uuidv4()}`;
}

/**
 * Get index stats
 */
export async function getIndexStats() {
  try {
    const index = await initPinecone();
    const stats = await index.describeIndexStats();
    return stats;
  } catch (error) {
    console.error('❌ Failed to get index stats:', error.message);
    throw error;
  }
}

/**
 * Get workspace-specific vector count (by namespace)
 * @param {string} workspaceId - Workspace ID (used as namespace)
 * @returns {Object} - {vectorCount, dimension, usage}
 */
export async function getWorkspaceVectorCount(workspaceId) {
  try {
    const index = await initPinecone();
    const stats = await index.describeIndexStats();
    
    // Get namespace stats
    const namespaceStats = stats.namespaces?.[workspaceId] || { vectorCount: 0 };
    
    return {
      workspace_id: workspaceId,
      vector_count: namespaceStats.vectorCount || 0,
      dimension: 768,
      storage_mb: ((namespaceStats.vectorCount || 0) * 768 * 4) / (1024 * 1024), // 4 bytes per float
      estimated_cost_per_month: calculatePineconeCost(namespaceStats.vectorCount || 0)
    };
  } catch (error) {
    console.error('❌ Failed to get workspace vector count:', error.message);
    return {
      workspace_id: workspaceId,
      vector_count: 0,
      dimension: 768,
      storage_mb: 0,
      estimated_cost_per_month: 0,
      error: error.message
    };
  }
}

/**
 * Get all workspaces vector counts
 * @returns {Array} - Array of workspace usage stats
 */
export async function getAllWorkspacesVectorCounts() {
  try {
    const index = await initPinecone();
    const stats = await index.describeIndexStats();
    
    const workspaceStats = [];
    
    if (stats.namespaces) {
      for (const [workspaceId, namespaceData] of Object.entries(stats.namespaces)) {
        workspaceStats.push({
          workspace_id: workspaceId,
          vector_count: namespaceData.vectorCount || 0,
          dimension: 768,
          storage_mb: ((namespaceData.vectorCount || 0) * 768 * 4) / (1024 * 1024),
          estimated_cost_per_month: calculatePineconeCost(namespaceData.vectorCount || 0)
        });
      }
    }
    
    // Calculate totals
    const totalVectors = workspaceStats.reduce((sum, ws) => sum + ws.vector_count, 0);
    const totalStorageMb = workspaceStats.reduce((sum, ws) => sum + ws.storage_mb, 0);
    
    return {
      workspaces: workspaceStats,
      total_vectors: totalVectors,
      total_storage_mb: totalStorageMb,
      total_estimated_cost: calculatePineconeCost(totalVectors),
      index_dimension: 768
    };
  } catch (error) {
    console.error('❌ Failed to get all workspaces vector counts:', error.message);
    throw error;
  }
}

/**
 * Calculate estimated Pinecone cost based on vector count
 * Pinecone Pricing (as of 2024):
 * - Free tier: 100K vectors
 * - Starter: $70/month for 5M vectors
 * - Standard: Custom pricing
 */
function calculatePineconeCost(vectorCount) {
  if (vectorCount <= 100000) {
    return 0; // Free tier
  }
  
  // Starter tier: $70 for 5M vectors = $0.000014 per vector
  const costPerVector = 70 / 5000000;
  const estimatedCost = (vectorCount - 100000) * costPerVector;
  
  return Math.max(0, estimatedCost);
}

/**
 * Get detailed usage report for a workspace
 * Combines Pinecone stats with MongoDB chunk counts
 */
export async function getWorkspaceUsageReport(workspaceId) {
  try {
    // Get Pinecone stats
    const pineconeStats = await getWorkspaceVectorCount(workspaceId);
    
    // Get MongoDB stats
    const { connectDb } = await import('./database.js');
    const database = await connectDb();
    const col = database.collection(`ws_${workspaceId}_chunks`);
    
    const mongoStats = await col.aggregate([
      {
        $group: {
          _id: '$source_name',
          chunk_count: { $sum: 1 },
          total_text_size: { $sum: { $strLenBytes: '$text' } }
        }
      }
    ]).toArray();
    
    const totalChunks = mongoStats.reduce((sum, s) => sum + s.chunk_count, 0);
    const totalTextSize = mongoStats.reduce((sum, s) => sum + s.total_text_size, 0);
    
    return {
      workspace_id: workspaceId,
      pinecone: pineconeStats,
      mongodb: {
        total_chunks: totalChunks,
        total_text_size_mb: totalTextSize / (1024 * 1024),
        sources: mongoStats.map(s => ({
          source_name: s._id,
          chunk_count: s.chunk_count,
          text_size_mb: s.total_text_size / (1024 * 1024)
        }))
      },
      summary: {
        total_vectors: pineconeStats.vector_count,
        total_chunks: totalChunks,
        storage_breakdown: {
          pinecone_vectors_mb: pineconeStats.storage_mb,
          mongodb_text_mb: totalTextSize / (1024 * 1024),
          total_mb: pineconeStats.storage_mb + (totalTextSize / (1024 * 1024))
        },
        estimated_monthly_cost: {
          pinecone: pineconeStats.estimated_cost_per_month,
          mongodb: 0, // Depends on your MongoDB plan
          total: pineconeStats.estimated_cost_per_month
        }
      }
    };
  } catch (error) {
    console.error('❌ Failed to get workspace usage report:', error.message);
    throw error;
  }
}

/**
 * Log Pinecone operations (read/write units)
 * @param {string} namespace - Workspace ID
 * @param {string} operationType - 'read' or 'write'
 * @param {number} units - Number of units used
 */
async function logPineconeOperation(namespace, operationType, units) {
  try {
    const { connectDb } = await import('./database.js');
    const database = await connectDb();
    const col = database.collection('pinecone_usage');
    
    await col.insertOne({
      workspace_id: namespace,
      operation_type: operationType, // 'read' or 'write'
      units: units,
      timestamp: new Date(),
      date: new Date().toISOString().split('T')[0] // YYYY-MM-DD for daily aggregation
    });
  } catch (error) {
    // Don't throw - logging shouldn't break the app
    console.error('⚠️ Failed to log Pinecone operation:', error.message);
  }
}

/**
 * Get Pinecone usage stats for a workspace
 * @param {string} workspaceId - Workspace ID
 * @param {number} days - Number of days to look back (default 30)
 * @returns {Object} - Usage statistics
 */
export async function getPineconeUsageStats(workspaceId, days = 30) {
  try {
    const { connectDb } = await import('./database.js');
    const database = await connectDb();
    const col = database.collection('pinecone_usage');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Aggregate usage by operation type
    const stats = await col.aggregate([
      {
        $match: {
          workspace_id: workspaceId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$operation_type',
          total_units: { $sum: '$units' },
          total_operations: { $sum: 1 }
        }
      }
    ]).toArray();
    
    // Format results
    const readStats = stats.find(s => s._id === 'read') || { total_units: 0, total_operations: 0 };
    const writeStats = stats.find(s => s._id === 'write') || { total_units: 0, total_operations: 0 };
    
    // Get daily breakdown
    const dailyStats = await col.aggregate([
      {
        $match: {
          workspace_id: workspaceId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: '$date',
            operation_type: '$operation_type'
          },
          units: { $sum: '$units' }
        }
      },
      {
        $sort: { '_id.date': -1 }
      },
      {
        $limit: 30
      }
    ]).toArray();
    
    return {
      workspace_id: workspaceId,
      period_days: days,
      read_units: {
        total: readStats.total_units,
        operations: readStats.total_operations,
        limit: 1000000, // Free tier limit
        remaining: Math.max(0, 1000000 - readStats.total_units),
        percentage: (readStats.total_units / 1000000) * 100
      },
      write_units: {
        total: writeStats.total_units,
        operations: writeStats.total_operations
      },
      daily_breakdown: dailyStats.map(d => ({
        date: d._id.date,
        operation_type: d._id.operation_type,
        units: d.units
      })),
      summary: {
        total_operations: readStats.total_operations + writeStats.total_operations,
        total_units: readStats.total_units + writeStats.total_units,
        avg_reads_per_day: Math.round(readStats.total_units / days),
        avg_writes_per_day: Math.round(writeStats.total_units / days)
      }
    };
  } catch (error) {
    console.error('❌ Failed to get Pinecone usage stats:', error.message);
    return {
      workspace_id: workspaceId,
      period_days: days,
      read_units: { total: 0, operations: 0, limit: 1000000, remaining: 1000000, percentage: 0 },
      write_units: { total: 0, operations: 0 },
      daily_breakdown: [],
      summary: { total_operations: 0, total_units: 0, avg_reads_per_day: 0, avg_writes_per_day: 0 },
      error: error.message
    };
  }
}

/**
 * Get total Pinecone usage across all workspaces
 * @param {number} days - Number of days to look back
 * @returns {Object} - Total usage statistics
 */
export async function getTotalPineconeUsage(days = 30) {
  try {
    const { connectDb } = await import('./database.js');
    const database = await connectDb();
    const col = database.collection('pinecone_usage');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Aggregate total usage
    const totalStats = await col.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$operation_type',
          total_units: { $sum: '$units' },
          total_operations: { $sum: 1 }
        }
      }
    ]).toArray();
    
    // Per-workspace breakdown
    const perWorkspace = await col.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            workspace_id: '$workspace_id',
            operation_type: '$operation_type'
          },
          units: { $sum: '$units' }
        }
      }
    ]).toArray();
    
    const readStats = totalStats.find(s => s._id === 'read') || { total_units: 0, total_operations: 0 };
    const writeStats = totalStats.find(s => s._id === 'write') || { total_units: 0, total_operations: 0 };
    
    return {
      period_days: days,
      total_read_units: readStats.total_units,
      total_write_units: writeStats.total_units,
      total_operations: readStats.total_operations + writeStats.total_operations,
      read_limit: 1000000,
      read_remaining: Math.max(0, 1000000 - readStats.total_units),
      read_percentage: (readStats.total_units / 1000000) * 100,
      per_workspace: perWorkspace,
      avg_per_day: {
        reads: Math.round(readStats.total_units / days),
        writes: Math.round(writeStats.total_units / days)
      }
    };
  } catch (error) {
    console.error('❌ Failed to get total Pinecone usage:', error.message);
    throw error;
  }
}
