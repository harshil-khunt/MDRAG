import cron from 'node-cron';
import { getSourcesForRecrawl } from './lib/database.js';
import { urlQueue } from './queues/index.js';

/**
 * Scheduler for periodic re-crawling of tracked sources
 * Runs every 15 minutes and checks which sources need re-crawling
 */

console.log('🕒 Scheduler starting...');

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    console.log('🔄 Checking for sources to re-crawl...');
    
    const sources = await getSourcesForRecrawl();
    
    if (sources.length === 0) {
      console.log('✓ No sources need re-crawling at this time');
      return;
    }
    
    console.log(`📋 Found ${sources.length} source(s) to re-crawl`);
    
    for (const source of sources) {
      // Skip sources with invalid URLs
      if (!source.url || typeof source.url !== 'string' || source.url.trim() === '') {
        console.warn(`⚠️  Skipping source with invalid URL:`, source);
        continue;
      }
      
      console.log(`⚡ Enqueuing re-crawl for: ${source.url}`);
      
      await urlQueue.add('process-url', {  // Fixed: was 'process-url-job', should be 'process-url'
        url: source.url,
        workspaceId: source.workspace_id,
        crawlDomain: source.crawl_domain,
        maxPages: source.max_pages,
        maxDepth: source.max_depth,
        trackChanges: true,
        oldHash: source.last_hash,
        enableOcr: source.enable_ocr || false
      });
    }
    
    console.log(`✅ Enqueued ${sources.length} re-crawl job(s)`);
    
  } catch (error) {
    console.error('❌ Scheduler error:', error);
  }
});

console.log('✓ Scheduler active - will check for re-crawls every 15 minutes');
