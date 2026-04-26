import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';

dotenv.config();

console.log('\n🔍 Testing AI Assistant Configuration...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('  PORT:', process.env.PORT || '❌ Not set (will use 3000)');
console.log('  MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
console.log('  REDIS_HOST:', process.env.REDIS_HOST || '❌ Not set');
console.log('  REDIS_PORT:', process.env.REDIS_PORT || '❌ Not set');
console.log('  REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? '✅ Set' : '⚠️  Not set');
console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '⚠️  Not set (optional)');
console.log('  PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Missing');
console.log('  PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME || '❌ Not set');

// Test MongoDB connection
async function testMongoDB() {
  console.log('\n🔌 Testing MongoDB connection...');
  if (!process.env.MONGODB_URI) {
    console.log('  ❌ MONGODB_URI not set in .env');
    return false;
  }
  
  try {
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    await client.connect();
    console.log('  ✅ MongoDB connected successfully');
    await client.close();
    return true;
  } catch (error) {
    console.log('  ❌ MongoDB connection failed:', error.message);
    return false;
  }
}

// Test Redis connection
async function testRedis() {
  console.log('\n🔌 Testing Redis connection...');
  if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
    console.log('  ❌ REDIS_HOST or REDIS_PORT not set in .env');
    return false;
  }
  
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1
    });
    
    await redis.ping();
    console.log('  ✅ Redis connected successfully');
    redis.disconnect();
    return true;
  } catch (error) {
    console.log('  ❌ Redis connection failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  const mongoOk = await testMongoDB();
  const redisOk = await testRedis();
  
  console.log('\n📊 Summary:');
  console.log('  MongoDB:', mongoOk ? '✅ Ready' : '❌ Not ready');
  console.log('  Redis:', redisOk ? '✅ Ready' : '❌ Not ready');
  
  if (mongoOk && redisOk) {
    console.log('\n✅ All systems ready! You can start the application:');
    console.log('   Terminal 1: npm run dev');
    console.log('   Terminal 2: npm run worker');
    console.log('   Terminal 3: cd frontend && npm run dev\n');
  } else {
    console.log('\n❌ Some services are not ready. Please check your .env configuration.\n');
    process.exit(1);
  }
}

runTests().catch(console.error);
