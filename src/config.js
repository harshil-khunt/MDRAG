import dotenv from 'dotenv';
dotenv.config();

export default {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME || 'content_db',
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD
  },
  storagePath: process.env.LOCAL_STORAGE_PATH || './uploads',
  geminiKey: process.env.GEMINI_API_KEY,
  openaiKey: process.env.OPENAI_API_KEY,
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-004',
  llmModel: process.env.LLM_MODEL || 'gemini-2.5-flash',
  chunkSize: Number(process.env.CHUNK_SIZE || 800),
  chunkOverlap: Number(process.env.CHUNK_OVERLAP || 200),
  maxDocCharacters: Number(process.env.MAX_DOC_CHARACTERS || 500000),
  maxWebPages: Number(process.env.MAX_WEB_PAGES || 100),
  maxQnaCustomTextCharacters: Number(process.env.MAX_QNA_CUSTOM_TEXT_CHARACTERS || 100000)
};
