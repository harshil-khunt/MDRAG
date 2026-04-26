# Gemini Embedding Model Fix - April 10, 2026

## Problem
The application was failing to generate embeddings with the error:
```
models/embedding-001 is not found for API version v1
```

## Root Cause
The code was using:
1. **Wrong API endpoint**: `v1` instead of `v1beta`
2. **Wrong model name**: `embedding-001` instead of `gemini-embedding-001`
3. **Missing dimension parameter**: Not specifying `outputDimensionality: 768` to match Pinecone index

## Solution Applied

### 1. Updated `src/lib/embeddings.js`
- Changed API endpoint from `v1` to `v1beta`
- Changed model name from `embedding-001` to `gemini-embedding-001`
- Added `outputDimensionality: 768` parameter to match Pinecone index dimensions
- Added `taskType: 'RETRIEVAL_DOCUMENT'` for optimal embedding quality

### 2. Updated `.env`
```env
EMBEDDING_MODEL=gemini-embedding-001
```

### 3. Updated `src/lib/database.js`
- Changed default embedding model from `embedding-001` to `gemini-embedding-001`

### 4. Updated `fix-embedding-model.js`
- Script now updates all old model names to `gemini-embedding-001`

## How to Test

1. **Restart the worker** (if running):
   ```bash
   # Stop the current worker (Ctrl+C)
   # Start it again
   node src/worker/worker.js
   ```

2. **Upload a test document** in the frontend

3. **Check worker logs** - you should see:
   ```
   🔍 getEmbeddings called: provider=gemini, model=gemini-embedding-001, texts=X
   ✅ Inserted X chunks into MongoDB
   ✅ Inserted X vectors into Pinecone
   ```

## Technical Details

### Gemini Embedding Model Specifications
- **Model**: `gemini-embedding-001` (free tier)
- **API Version**: `v1beta` (NOT v1)
- **Default Dimensions**: 3072
- **Configurable Dimensions**: 128-3072 (recommended: 768, 1536, 3072)
- **Token Limit**: 2,048 tokens per request
- **Task Types**: RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY, SEMANTIC_SIMILARITY, etc.

### Why 768 Dimensions?
Your Pinecone index was created with 768 dimensions. The `gemini-embedding-001` model supports dimension reduction using the `outputDimensionality` parameter, allowing us to generate 768-dimensional embeddings that match your index.

### API Endpoint Format
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=YOUR_API_KEY
```

## References
- [Official Gemini Embeddings Documentation](https://ai.google.dev/gemini-api/docs/embeddings)
- Model supports Matryoshka Representation Learning (MRL) for flexible dimensions
- Free tier available through Google AI Studio API keys
