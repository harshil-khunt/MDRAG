import { Worker } from 'bullmq';
import config from '../config.js';
import { processFileJob, processUrlJob, processCustomTextJob } from '../queues/job.js';

const connection = { 
  host: config.redis.host, 
  port: config.redis.port,
  password: config.redis.password
};

const fileWorker = new Worker('process-file', async job => {
  console.log('Processing file job', job.id);
  await processFileJob(job.data);
}, { connection });

const urlWorker = new Worker('process-url', async job => {
  console.log('Processing url job', job.id);
  await processUrlJob(job.data);
}, { connection });

const customTextWorker = new Worker('process-custom-text', async job => {
  console.log('Processing custom text job', job.id);
  await processCustomTextJob(job.data);
}, { connection });

fileWorker.on('completed', job => console.log('file job completed', job.id));
fileWorker.on('failed', (job, err) => console.error('file job failed', job.id, err));

urlWorker.on('completed', job => console.log('url job completed', job.id));
urlWorker.on('failed', (job, err) => console.error('url job failed', job.id, err));

customTextWorker.on('completed', job => console.log('custom text job completed', job.id));
customTextWorker.on('failed', (job, err) => console.error('custom text job failed', job.id, err));

console.log('Workers started (file + url + custom text).');