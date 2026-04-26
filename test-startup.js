import config from './src/config.js';
import { MongoClient } from 'mongodb';

console.log('Testing startup components...\n');

// Test MongoDB connection
console.log('1. Testing MongoDB connection...');
const mongoClient = new MongoClient(config.mongoUri, {
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
});

try {
  await mongoClient.connect();
  console.log('✓ MongoDB connected successfully');
  await mongoClient.close();
} catch (error) {
  console.error('✗ MongoDB connection failed:', error.message);
}

// Test Redis connection
console.log('\n2. Testing Redis connection...');
try {
  const { default: Redis } = await import('ioredis');
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1
  });
  
  await redis.ping();
  console.log('✓ Redis connected successfully');
  redis.disconnect();
} catch (error) {
  console.error('✗ Redis connection failed:', error.message);
}

console.log('\nStartup test complete.');
process.exit(0);
