import { Queue } from 'bullmq';
import config from '../config.js';
const connection = { 
  host: config.redis.host, 
  port: config.redis.port,
  password: config.redis.password
};
export const fileQueue = new Queue('process-file', { connection });
export const urlQueue = new Queue('process-url', { connection });
export const customTextQueue = new Queue('process-custom-text', { connection });
