import { Worker } from 'bullmq';
import config from '../config.js';
import { processFileJob, processUrlJob, processCustomTextJob } from '../queues/job.js';

const connection = { 
  host: config.redis.host, 
  port: config.redis.port,
  password: config.redis.password
};

const fileWorker = new Worker('process-file', async job => {
  console.log(`\n🔄 Processing file job ${job.id}`);
  console.log(`   File: ${job.data.filename}`);
  console.log(`   Workspace: ${job.data.workspaceId}`);
  try {
    await processFileJob(job.data);
    console.log(`✅ File job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`❌ File job ${job.id} failed:`, error.message);
    throw error;
  }
}, { connection });

const urlWorker = new Worker('process-url', async job => {
  console.log(`\n🔄 Processing URL job ${job.id}`);
  console.log(`   URL: ${job.data.url}`);
  try {
    await processUrlJob(job.data);
    console.log(`✅ URL job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`❌ URL job ${job.id} failed:`, error.message);
    throw error;
  }
}, { connection });

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
}, { connection });

// Error handlers
fileWorker.on('completed', job => console.log(`✅ File job ${job.id} completed`));
fileWorker.on('failed', (job, err) => console.error(`❌ File job ${job?.id} failed:`, err.message));
fileWorker.on('error', err => console.error('❌ File worker error:', err));

urlWorker.on('completed', job => console.log(`✅ URL job ${job.id} completed`));
urlWorker.on('failed', (job, err) => console.error(`❌ URL job ${job?.id} failed:`, err.message));
urlWorker.on('error', err => console.error('❌ URL worker error:', err));

customTextWorker.on('completed', job => console.log(`✅ Custom text job ${job.id} completed`));
customTextWorker.on('failed', (job, err) => console.error(`❌ Custom text job ${job?.id} failed:`, err.message));
customTextWorker.on('error', err => console.error('❌ Custom text worker error:', err));

console.log('✅ Workers started successfully!');
console.log('   - File worker: listening on "process-file" queue');
console.log('   - URL worker: listening on "process-url" queue');
console.log('   - Custom text worker: listening on "process-custom-text" queue');
console.log('\n👀 Waiting for jobs...\n');