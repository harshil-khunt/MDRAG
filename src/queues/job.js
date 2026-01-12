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
  
  // Apply document character limit
  const maxChars = config.maxDocCharacters;
  let processedText = text;
  if (text.length > maxChars) {
    console.warn(`⚠️ Document exceeds ${maxChars} characters (${text.length}), truncating...`);
    processedText = text.substring(0, maxChars);
  }
  
  const chunks = chunkText(processedText);
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
 * Here we expect url, name, workspaceId, crawlMode, includePaths, excludePaths, trackChanges, enableOcr
 */
import { fetchUrlBuffer, crawlDomain, parseSitemap } from '../lib/scraper.js';
export async function processUrlJob({ 
  url, 
  workspaceId, 
  name, 
  crawlMode = 'sitemap', // 'crawl', 'sitemap', or 'individual'
  includePaths = [], // ['blog/*', 'dev/*']
  excludePaths = [], // ['admin/*', 'login/*']
  maxPages = 100, 
  maxDepth = 3, 
  trackChanges = false, 
  oldHash = null, 
  enableOcr = false 
}) {
  // Validate URL before processing
  if (!url || typeof url !== 'string' || url.trim() === '' || url === 'undefined') {
    console.error(`❌ Invalid URL received in job: "${url}" - skipping`);
    return;
  }
  
  // Get workspace settings
  const { getWorkspace, createDiscoveredPlaceholder, updatePlaceholderStatus, deletePlaceholder } = await import('../lib/database.js');
  const workspace = await getWorkspace(workspaceId);
  const llmProvider = workspace?.llm_provider || 'gemini';
  const embeddingModel = workspace?.embedding_model || config.embeddingModel;
  const userApiKey = workspace?.user_api_key || null;
  
  console.log(`\n🔧 Processing URL with mode: ${crawlMode}`);
  console.log(`   Include paths: ${includePaths.length > 0 ? includePaths.join(', ') : 'all'}`);
  console.log(`   Exclude paths: ${excludePaths.length > 0 ? excludePaths.join(', ') : 'none'}`);
  
  // Helper function to check if URL matches path filters
  function matchesPathFilters(pageUrl) {
    try {
      const urlObj = new URL(pageUrl);
      const pathname = urlObj.pathname;
      
      console.log(`🔍 Checking path: ${pathname}`);
      
      // If include paths specified, URL must match at least one
      if (includePaths.length > 0) {
        const matches = includePaths.some(pattern => {
          // Ensure pattern starts with / if it doesn't already
          const normalizedPattern = pattern.startsWith('/') ? pattern : '/' + pattern;
          // Convert wildcard pattern to regex
          const regexPattern = '^' + normalizedPattern.replace(/\*/g, '.*').replace(/\//g, '\\/');
          const regex = new RegExp(regexPattern);
          const isMatch = regex.test(pathname);
          console.log(`   Testing include pattern "${normalizedPattern}" -> ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
          return isMatch;
        });
        if (!matches) {
          console.log(`⏭️  Skipping ${pageUrl} - doesn't match include paths`);
          return false;
        }
      }
      
      // If exclude paths specified, URL must not match any
      if (excludePaths.length > 0) {
        const matches = excludePaths.some(pattern => {
          // Ensure pattern starts with / if it doesn't already
          const normalizedPattern = pattern.startsWith('/') ? pattern : '/' + pattern;
          // Convert wildcard pattern to regex
          const regexPattern = '^' + normalizedPattern.replace(/\*/g, '.*').replace(/\//g, '\\/');
          const regex = new RegExp(regexPattern);
          const isMatch = regex.test(pathname);
          console.log(`   Testing exclude pattern "${normalizedPattern}" -> ${isMatch ? '✅ MATCH (will exclude)' : '❌ NO MATCH'}`);
          return isMatch;
        });
        if (matches) {
          console.log(`⏭️  Skipping ${pageUrl} - matches exclude paths`);
          return false;
        }
      }
      
      console.log(`✅ Path ${pathname} passed all filters`);
      return true;
    } catch (e) {
      console.error(`❌ Error checking path filters for ${pageUrl}:`, e.message);
      return false;
    }
  }
  
  // MODE 1: INDIVIDUAL LINK - Just process this one page
  if (crawlMode === 'individual') {
    console.log(`📄 INDIVIDUAL MODE: Processing single page only`);
    console.log(`   URL: ${url}`);
    
    try {
      const { buffer, contentType } = await fetchUrlBuffer(url);
      const text = await extractTextFromBuffer(buffer, name || url, contentType);
      
      if (!text || text.length < 10) {
        const errorMsg = 'No text content found on this page. The page may be empty, require JavaScript, or be inaccessible.';
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      console.log(`✅ Extracted ${text.length} characters from page`);
      
      // Apply character limit for web pages
      let processedText = text;
      if (text.length > config.maxDocCharacters) {
        console.warn(`⚠️ Page exceeds ${config.maxDocCharacters} characters (${text.length}), truncating...`);
        processedText = text.substring(0, config.maxDocCharacters);
      }
      
      let chunks = chunkText(processedText);
      const originalCount = chunks.length;
      chunks = deduplicateChunks(chunks);
      
      if (chunks.length === 0) {
        throw new Error('No valid content chunks could be created from this page.');
      }
      
      console.log(`📦 Created ${chunks.length} chunks (${originalCount - chunks.length} duplicates removed)`);
      
      const batchSize = 50;
      const embeddings = [];
      for (let i = 0; i < chunks.length; i += batchSize) {
        const slice = chunks.slice(i, i + batchSize);
        console.log(`🔄 Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
        const embs = await getEmbeddings(slice, embeddingModel, llmProvider, userApiKey);
        embeddings.push(...embs);
        
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      await insertChunks(workspaceId, name || url, chunks, embeddings);
      console.log(`✅ Individual page processed successfully: ${chunks.length} chunks stored`);
      return;
    } catch (error) {
      console.error(`❌ Failed to process individual page:`, error.message);
      throw new Error(`Failed to process page: ${error.message}`);
    }
  }
  
  // MODE 2 & 3: SITEMAP or CRAWL - Two-phase processing
  const shouldCrawl = crawlMode === 'crawl';
  
  if (crawlMode === 'sitemap' || shouldCrawl) {
    // TWO-PHASE CRAWLING: Discovery then Processing
    console.log(`🔍 PHASE 1: Discovering URLs from ${url}`);
    console.log(`   Mode: ${crawlMode === 'sitemap' ? 'SITEMAP ONLY' : 'FULL CRAWL'}`);
    
    // Phase 1: Quick discovery (2-5 seconds)
    let discoveredUrls = [];
    
    if (crawlMode === 'sitemap') {
      // SITEMAP MODE: Only use sitemap.xml
      discoveredUrls = await parseSitemap(url);
      if (discoveredUrls.length === 0) {
        console.error('❌ No sitemap found or sitemap is empty');
        throw new Error('No sitemap.xml found for this website. Please try "Crawl Links" mode or check if the URL is correct.');
      }
    } else {
      // CRAWL MODE: Try sitemap first, fallback to crawling
      discoveredUrls = await parseSitemap(url);
      if (discoveredUrls.length === 0) {
        console.log('⚠️  No sitemap found, falling back to full crawl');
        // Will use traditional crawling below
      }
    }
    
    if (discoveredUrls.length > 0) {
      console.log(`✅ Discovered ${discoveredUrls.length} URLs`);
      
      // Apply path filters
      const filteredUrls = discoveredUrls.filter(matchesPathFilters);
      console.log(`✅ After filtering: ${filteredUrls.length} URLs (${discoveredUrls.length - filteredUrls.length} filtered out)`);
      
      if (filteredUrls.length === 0) {
        console.error('❌ No URLs match your include/exclude filters');
        throw new Error('No pages match your filters. Please adjust your include/exclude paths.');
      }
      
      // Apply web page limit from config
      const webPageLimit = Math.min(maxPages, config.maxWebPages);
      if (filteredUrls.length > webPageLimit) {
        console.warn(`⚠️ Found ${filteredUrls.length} URLs, limiting to ${webPageLimit} (MAX_WEB_PAGES limit)`);
      }
      
      // Check which URLs are already processed (skip duplicates on retry)
      const { connectDb } = await import('../lib/database.js');
      const database = await connectDb();
      const col = database.collection(`ws_${workspaceId}_chunks`);
      
      const existingUrls = await col.distinct('source_name', {
        source_name: { $in: filteredUrls },
        chunk_index: { $gte: 0 } // Only count real chunks, not placeholders
      });
      
      const newUrls = filteredUrls.filter(u => !existingUrls.includes(u));
      
      if (newUrls.length === 0) {
        console.log(`✅ All ${filteredUrls.length} URLs already processed. Nothing new to crawl.`);
        return;
      }
      
      if (existingUrls.length > 0) {
        console.log(`⏭️  Skipping ${existingUrls.length} already processed URLs`);
        console.log(`📝 Processing ${newUrls.length} new URLs`);
      }
      
      // Create placeholders immediately so user sees them (apply limit here)
      const urlsToProcess = newUrls.slice(0, webPageLimit);
      console.log(`📝 Creating ${urlsToProcess.length} placeholders...`);
      
      await Promise.all(
        urlsToProcess.map(discoveredUrl => 
          createDiscoveredPlaceholder(workspaceId, discoveredUrl)
        )
      );
      
      console.log(`✅ Placeholders created! User can now see discovered pages.`);
      console.log(`🔧 PHASE 2: Processing ${urlsToProcess.length} pages in parallel batches...`);
      
      // Phase 2: Process URLs in parallel batches for MUCH faster processing
      const PARALLEL_BATCH_SIZE = 5; // Process 5 pages simultaneously
      let completedCount = 0;
      let failedCount = 0;
      const failedUrls = [];
      
      for (let batchStart = 0; batchStart < urlsToProcess.length; batchStart += PARALLEL_BATCH_SIZE) {
        const batch = urlsToProcess.slice(batchStart, batchStart + PARALLEL_BATCH_SIZE);
        console.log(`\n📦 Processing batch ${Math.floor(batchStart / PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(urlsToProcess.length / PARALLEL_BATCH_SIZE)} (${batch.length} pages in parallel)`);
        
        // Process all pages in this batch simultaneously
        await Promise.all(batch.map(async (pageUrl, batchIndex) => {
          const pageNum = batchStart + batchIndex + 1;
          
          try {
            // Update status to processing
            await updatePlaceholderStatus(workspaceId, pageUrl, 'processing');
            
            // Fetch and extract text
            const { buffer, contentType } = await fetchUrlBuffer(pageUrl);
            const text = await extractTextFromBuffer(buffer, pageUrl, contentType);
            
            if (!text || text.length < 10) {
              console.log(`⚠️ [${pageNum}/${urlsToProcess.length}] Skipping ${pageUrl} - insufficient content`);
              await deletePlaceholder(workspaceId, pageUrl);
              failedCount++;
              failedUrls.push({ url: pageUrl, reason: 'Insufficient content' });
              return;
            }
            
            // Apply character limit for web pages
            let processedText = text;
            if (text.length > config.maxDocCharacters) {
              console.log(`⚠️ [${pageNum}/${urlsToProcess.length}] Page exceeds ${config.maxDocCharacters} characters (${text.length}), truncating...`);
              processedText = text.substring(0, config.maxDocCharacters);
            }
            
            // Chunk and embed
            let chunks = chunkText(processedText);
            chunks = deduplicateChunks(chunks);
            
            const batchSize = 50;
            const embeddings = [];
            for (let j = 0; j < chunks.length; j += batchSize) {
              const slice = chunks.slice(j, j + batchSize);
              const embs = await getEmbeddings(slice, embeddingModel, llmProvider, userApiKey);
              embeddings.push(...embs);
              
              if (j + batchSize < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
            
            // Insert chunks
            await insertChunks(workspaceId, pageUrl, chunks, embeddings);
            
            // Delete placeholder (now we have real chunks)
            await deletePlaceholder(workspaceId, pageUrl);
            
            completedCount++;
            console.log(`✅ [${pageNum}/${urlsToProcess.length}] Completed: ${pageUrl} (${chunks.length} chunks) - Total: ${completedCount}/${urlsToProcess.length}`);
            
          } catch (error) {
            console.error(`❌ [${pageNum}/${urlsToProcess.length}] Failed to process ${pageUrl}:`, error.message);
            
            // Mark as failed and delete placeholder (cleanup incomplete data)
            try {
              await deletePlaceholder(workspaceId, pageUrl);
              console.log(`🗑️  Cleaned up placeholder for failed page: ${pageUrl}`);
            } catch (cleanupError) {
              console.error(`Failed to cleanup placeholder:`, cleanupError.message);
            }
            
            failedCount++;
            failedUrls.push({ url: pageUrl, reason: error.message });
          }
        }));
        
        // Small delay between batches to avoid overwhelming the server
        if (batchStart + PARALLEL_BATCH_SIZE < urlsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Summary report
      console.log(`\n📊 CRAWL SUMMARY:`);
      console.log(`   ✅ Successful: ${completedCount}/${urlsToProcess.length}`);
      console.log(`   ❌ Failed: ${failedCount}/${urlsToProcess.length}`);
      
      if (failedUrls.length > 0) {
        console.log(`\n❌ Failed URLs:`);
        failedUrls.forEach(({ url, reason }) => {
          console.log(`   - ${url}: ${reason}`);
        });
      }
      
      if (completedCount === 0) {
        throw new Error(`Failed to crawl any pages. All ${urlsToProcess.length} pages failed. Check the logs above for details.`);
      }
      
      console.log(`\n🎉 Crawl complete! Successfully processed ${completedCount} pages.`);
      return;
    }
    
    // Fallback for CRAWL mode: No sitemap, use traditional crawling
    if (shouldCrawl) {
      console.log(`⚠️ No sitemap found, falling back to traditional crawl`);
      
      // Apply web page limit from config
      const webPageLimit = Math.min(maxPages, config.maxWebPages);
      console.log(`📊 Crawl limit: ${webPageLimit} pages (MAX_WEB_PAGES)`);
      
      const pages = await crawlDomain(url, webPageLimit, maxDepth, enableOcr);
      
      if (pages.length === 0) {
        throw new Error('No pages found during crawl. The website may be blocking crawlers or the URL is incorrect.');
      }

      console.log(`Processing ${pages.length} pages from domain crawl`);
      
      // Apply path filters to crawled pages
      const filteredPages = pages.filter(page => matchesPathFilters(page.url));
      console.log(`✅ After filtering: ${filteredPages.length} pages (${pages.length - filteredPages.length} filtered out)`);
      
      if (filteredPages.length === 0) {
        throw new Error('No pages match your filters after crawling. Please adjust your include/exclude paths.');
      }
      
      // Combine all page texts for change detection
      const allText = filteredPages.map(p => p.text).join('\n\n');
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
        await recordChangeEvent(workspaceId, url, oldHash, newHash, `Domain crawled: ${filteredPages.length} pages`);
      }
      
      // Process pages in parallel batches for much faster embedding
      let totalChunks = 0;
      const PAGE_BATCH_SIZE = 5; // Process 5 pages simultaneously
      
      console.log(`Processing ${filteredPages.length} pages in parallel batches of ${PAGE_BATCH_SIZE}`);
      
      for (let batchStart = 0; batchStart < filteredPages.length; batchStart += PAGE_BATCH_SIZE) {
        const pageBatch = filteredPages.slice(batchStart, batchStart + PAGE_BATCH_SIZE);
        
        // Process all pages in this batch simultaneously
        await Promise.all(pageBatch.map(async (page, batchIndex) => {
          const pageNum = batchStart + batchIndex + 1;
          let text = page.text;
          if (!text || text.length < 10) return;
          
          // Apply character limit for web pages
          if (text.length > config.maxDocCharacters) {
            console.log(`⚠️ Page ${pageNum} exceeds ${config.maxDocCharacters} characters (${text.length}), truncating...`);
            text = text.substring(0, config.maxDocCharacters);
          }
          
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
          console.log(`Processed page ${pageNum}/${filteredPages.length}: ${page.url} (${chunks.length} chunks)`);
        }));
      }
      
      // Update crawl status
      if (trackChanges) {
        await updateSourceCrawlStatus(workspaceId, url, newHash);
      }
      
      console.log(`Domain crawl complete: ${filteredPages.length} pages processed, ${totalChunks} total chunks embedded`);
      return;
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
  
  // Apply character limit for custom text (separate limit from documents)
  let processedContent = content;
  if (content.length > config.maxQnaCustomTextCharacters) {
    console.warn(`⚠️ Custom text exceeds ${config.maxQnaCustomTextCharacters} characters (${content.length}), truncating...`);
    processedContent = content.substring(0, config.maxQnaCustomTextCharacters);
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
    
    // Get chunk_ids before deleting
    const oldChunks = await col.find({ source_name: `custom_text_${textId}` }).toArray();
    const oldChunkIds = oldChunks.map(c => c.chunk_id).filter(Boolean);
    
    // Delete from MongoDB
    await col.deleteMany({ source_name: `custom_text_${textId}` });
    console.log(`Deleted old chunks for custom text ${textId} from MongoDB`);
    
    // Delete from Pinecone
    if (oldChunkIds.length > 0) {
      try {
        const { deleteVectors } = await import('../lib/pinecone.js');
        await deleteVectors(oldChunkIds, workspaceId);
        console.log(`Deleted ${oldChunkIds.length} old vectors from Pinecone`);
      } catch (pineconeError) {
        console.error('⚠️ Failed to delete old vectors from Pinecone:', pineconeError.message);
      }
    }
  }
  
  // Chunk the text
  let chunks = chunkText(processedContent);
  
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
