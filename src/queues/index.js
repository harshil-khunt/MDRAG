import { Queue } from 'bullmq';
import config from '../config.js';

// Redis connection with retry and error handling (same as worker)
const connection = { 
  host: config.redis.host, 
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`⚠️  Redis queue connection retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },
  reconnectOnError: (err) => {
    console.error('❌ Redis queue connection error:', err.message);
    // Reconnect on READONLY, ECONNRESET, etc.
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
    if (targetErrors.some(e => err.message.includes(e))) {
      console.log('🔄 Attempting to reconnect Redis queue...');
      return true; // Reconnect
    }
    return false;
  }
};

export const fileQueue = new Queue('process-file', { connection });
export const urlQueue = new Queue('process-url', { connection });
export const customTextQueue = new Queue('process-custom-text', { connection });
