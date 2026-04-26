import { Worker } from 'bullmq';
import config from '../config.js';
import { processFileJob, processUrlJob, processCustomTextJob } from '../queues/job.js';

// Redis connection with retry and error handling
const connection = { 
  host: config.redis.host, 
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`⚠️  Redis connection retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },
  reconnectOnError: (err) => {
    console.error('❌ Redis connection error:', err.message);
    // Reconnect on READONLY, ECONNRESET, etc.
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
    if (targetErrors.some(e => err.message.includes(e))) {
      console.log('🔄 Attempting to reconnect to Redis...');
      return true; // Reconnect
    }
    return false;
  }
};

console.log('🔌 Connecting to Redis...');
console.log('🔌 Connecting to Redis...');
console.log(`   Host: ${config.redis.host}`);
console.log(`   Port: ${config.redis.port}`);

const fileWorker = new Worker('process-file', async job => {
  console.log(`\n🔄 Processing file job ${job.id}`);
  console.log(`   File: ${job.data.filename}`);
  console.log(`   Workspace: ${job.data.workspaceId}`);
  
  // Update job status to processing
  const { updateJobProgress } = await import('../lib/database.js');
  await updateJobProgress(job.id.toString(), 
    { current: 0, total: 100, message: 'Starting file processing...' },
    'processing'
  );
  
  try {
    await processFileJob(job.data, async (progress) => {
      // Progress callback from job processor
      await updateJobProgress(job.id.toString(), progress);
    });
    
    // Mark as completed
    await updateJobProgress(job.id.toString(),
      { current: 100, total: 100, message: 'Completed successfully!' },
      'completed'
    );
    
    console.log(`✅ File job ${job.id} completed successfully`);
  } catch (error) {
    // Mark as failed
    await updateJobProgress(job.id.toString(),
      { current: 0, total: 100, message: `Failed: ${error.message}` },
      'failed'
    );
    
    console.error(`❌ File job ${job.id} failed:`, error.message);
    console.error(`❌ Full error:`, error);
    throw error;
  }
}, { 
  connection,
  autorun: true,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 100 }
});

// Add ready event to confirm worker is connected
fileWorker.on('ready', () => {
  console.log('✅ File worker is ready and connected to Redis');
});

const urlWorker = new Worker('process-url', async job => {
  console.log(`\n========================================`);
  console.log(`🔄 PROCESSING URL JOB ${job.id}`);
  console.log(`========================================`);
  console.log(`URL: ${job.data.url}`);
  console.log(`Mode: ${job.data.crawlMode || 'sitemap'}`);
  console.log(`Workspace: ${job.data.workspaceId}`);
  console.log(`========================================\n`);
  
  // Update job status to processing
  const { updateJobProgress } = await import('../lib/database.js');
  await updateJobProgress(job.id.toString(),
    { current: 0, total: 100, message: 'Starting URL crawl...' },
    'processing'
  );
  
  try {
    await processUrlJob(job.data, async (progress) => {
      // Progress callback from job processor
      await updateJobProgress(job.id.toString(), progress);
    });
    
    // Mark as completed
    await updateJobProgress(job.id.toString(),
      { current: 100, total: 100, message: 'Completed successfully!' },
      'completed'
    );
    
    console.log(`\n✅✅✅ URL JOB ${job.id} COMPLETED SUCCESSFULLY ✅✅✅\n`);
  } catch (error) {
    // Mark as failed
    await updateJobProgress(job.id.toString(),
      { current: 0, total: 100, message: `Failed: ${error.message}` },
      'failed'
    );
    
    console.error(`\n❌❌❌ URL JOB ${job.id} FAILED ❌❌❌`);
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}\n`);
    throw error;
  }
}, { 
  connection,
  autorun: true,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 100 },
  concurrency: 1
});

urlWorker.on('ready', () => {
  console.log('✅ URL worker is ready and connected to Redis');
  console.log('   Listening for jobs on queue: process-url');
});

const customTextWorker = new Worker('process-custom-text', async job => {
  console.log(`\n🔄 Processing custom text job ${job.id}`);
  console.log(`   Title: ${job.data.title}`);
  try {
    await processCustomTextJob(job.data);
    console.log(`✅ Custom text job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`❌ Custom text job ${job.id} failed:`, error.message);
    throw error;
  }
}, { 
  connection,
  autorun: true,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 100 }
});

// Enhanced error handlers with reconnection logic
fileWorker.on('completed', job => console.log(`✅ File job ${job.id} completed`));
fileWorker.on('failed', (job, err) => {
  console.error(`❌ File job ${job?.id} failed:`, err.message);
  if (err.message.includes('ECONNRESET')) {
    console.log('⚠️  Connection reset detected. Worker will retry automatically.');
  }
});
fileWorker.on('error', err => {
  console.error('❌ File worker error:', err.message);
  if (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT')) {
    console.log('🔄 Redis connection issue detected. Reconnecting...');
  }
});

urlWorker.on('completed', job => {
  console.log(`\n🎉🎉🎉 URL JOB ${job.id} COMPLETED 🎉🎉🎉\n`);
});
urlWorker.on('failed', (job, err) => {
  console.error(`\n💥💥💥 URL JOB ${job?.id} FAILED 💥💥💥`);
  console.error(`Error: ${err.message}\n`);
});
urlWorker.on('error', err => {
  console.error('❌ URL worker error:', err.message);
  if (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT')) {
    console.log('🔄 Redis connection issue detected. Reconnecting...');
  }
});

customTextWorker.on('completed', job => console.log(`✅ Custom text job ${job.id} completed`));
customTextWorker.on('failed', (job, err) => {
  console.error(`❌ Custom text job ${job?.id} failed:`, err.message);
  if (err.message.includes('ECONNRESET')) {
    console.log('⚠️  Connection reset detected. Worker will retry automatically.');
  }
});
customTextWorker.on('error', err => {
  console.error('❌ Custom text worker error:', err.message);
  if (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT')) {
    console.log('🔄 Redis connection issue detected. Reconnecting...');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM received, closing workers gracefully...');
  await Promise.all([
    fileWorker.close(),
    urlWorker.close(),
    customTextWorker.close()
  ]);
  console.log('✅ Workers  successfully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, closing workers gracefully...');
  await Promise.all([
    fileWorker.close(),
    urlWorker.close(),
    customTextWorker.close()
  ]);
  process.exit(0);
});

console.log('✅ Workers started successfully!');
console.log('   - File worker: listening on "process-file" queue');
console.log('   - URL worker: listening on "process-url" queue');
console.log('   - Custom text worker: listening on "process-custom-text" queue');
console.log('\n👀 Waiting for jobs...\n');

// Check queue status immediately (don't wait for ready event)
setTimeout(async () => {
  try {
    console.log('🔍 Checking queue status...');
    const { Queue } = await import('bullmq');
    const config = (await import('../config.js')).default;
    
    const connection = { 
      host: config.redis.host, 
      port: config.redis.port,
      password: config.redis.password
    };
    
    const urlQueueCheck = new Queue('process-url', { connection });
    const urlCounts = await urlQueueCheck.getJobCounts();
    
    console.log('\n📊 URL Queue Status:');
    console.log(`   Waiting: ${urlCounts.waiting}`);
    console.log(`   Active: ${urlCounts.active}`);
    console.log(`   Completed: ${urlCounts.completed}`);
    console.log(`   Failed: ${urlCounts.failed}\n`);
    
    if (urlCounts.waiting > 0) {
      console.log(`⚠️  WARNING: ${urlCounts.waiting} URL jobs are waiting but not being processed!`);
      console.log(`   Checking worker connection...`);
      
      // Try to manually trigger job processing
      console.log(`   Worker should pick up jobs automatically...`);
    }
    
    await urlQueueCheck.close();
  } catch (error) {
    console.error('❌ Failed to check queue status:', error.message);
  }
}, 2000); // Check after 2 seconds