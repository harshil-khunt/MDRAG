import { connectDb } from './src/lib/database.js';

async function fixEmbeddingModels() {
  console.log('🔧 Fixing embedding models in workspaces...');
  
  const db = await connectDb();
  const col = db.collection('workspaces');
  
  // Update any old model names to the correct one
  const result = await col.updateMany(
    { 
      embedding_model: { 
        $in: ['text-embedding-004', 'embedding-001', 'text-embedding-005'] 
      } 
    },
    { $set: { embedding_model: 'gemini-embedding-001' } }
  );
  
  console.log(`✅ Updated ${result.modifiedCount} workspaces`);
  console.log('   Changed to: gemini-embedding-001');
  
  process.exit(0);
}

fixEmbeddingModels().catch(console.error);
