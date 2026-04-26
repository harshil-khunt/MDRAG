import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import config from '../config.js';

if (!config.geminiKey) {
  console.warn('Warning: GEMINI_API_KEY not set. Gemini embeddings and LLM calls will fail without it.');
}

if (!config.openaiKey) {
  console.warn('Warning: OPENAI_API_KEY not set. OpenAI embeddings and LLM calls will fail without it.');
}

const genAI = config.geminiKey ? new GoogleGenerativeAI(config.geminiKey) : null;
const openai = config.openaiKey ? new OpenAI({ apiKey: config.openaiKey }) : null;

/**
 * Create embeddings for an array of strings using Gemini or OpenAI.
 * Returns array of float[] vectors in same order.
 * Supports user API keys with automatic fallback to default keys.
 */
export async function getEmbeddings(texts, model = undefined, provider = 'gemini', userApiKey = null) {
  model = model || (provider === 'openai' ? 'text-embedding-3-small' : config.embeddingModel);
  
  console.log(`🔍 getEmbeddings called: provider=${provider}, model=${model}, texts=${texts.length}, userApiKey=${userApiKey ? 'yes' : 'no'}`);
  
  try {
    if (provider === 'openai') {
      return await getOpenAIEmbeddings(texts, model, 3, userApiKey);
    } else {
      return await getGeminiEmbeddings(texts, model, 3, userApiKey);
    }
  } catch (error) {
    console.error('❌ getEmbeddings failed:', error.message);
    throw error;
  }
}

/**
 * Gemini embeddings with user key support and fallback
 */
async function getGeminiEmbeddings(texts, model, retries = 3, userApiKey = null) {
  const apiKey = userApiKey || config.geminiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY not provided');

  // Use gemini-embedding-001 model with 768 dimensions via REST API (v1beta)
  const modelName = 'gemini-embedding-001';
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const embeddings = [];
      
      // Use v1beta API endpoint (v1 doesn't support embedding models)
      for (const text of texts) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { parts: [{ text }] },
              taskType: 'RETRIEVAL_DOCUMENT',
              outputDimensionality: 768 // Reduce from 3072 to 768 to match Pinecone index
            })
          }
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        embeddings.push(data.embedding.values);
      }
      
      return embeddings;
    } catch (error) {
      console.error(`Gemini embedding error (attempt ${attempt + 1}/${retries}):`, error.message);
      
      // If user key fails and we have a default key, try fallback
      if (userApiKey && config.geminiKey && userApiKey !== config.geminiKey) {
        console.warn('User API key failed, falling back to default key');
        return getGeminiEmbeddings(texts, model, retries, null);
      }
      
      if ((error.message?.includes('429') || error.message?.includes('quota')) && attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Gemini rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('Gemini embedding final error:', error);
        throw error;
      }
    }
  }
}

/**
 * OpenAI embeddings with user key support and fallback
 */
async function getOpenAIEmbeddings(texts, model, retries = 3, userApiKey = null) {
  const apiKey = userApiKey || config.openaiKey;
  if (!apiKey) throw new Error('OPENAI_API_KEY not provided');

  const openaiInstance = new OpenAI({ apiKey: apiKey });

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openaiInstance.embeddings.create({
        model: model,
        input: texts,
      });
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error(`OpenAI embedding error (attempt ${attempt + 1}/${retries}):`, error.message);
      
      // If user key fails and we have a default key, try fallback
      if (userApiKey && config.openaiKey && userApiKey !== config.openaiKey) {
        console.warn('User API key failed, falling back to default key');
        return getOpenAIEmbeddings(texts, model, retries, null); // Retry with default
      }
      
      if (error.status === 429 && attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`OpenAI rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('OpenAI embedding final error:', error);
        throw error;
      }
    }
  }
}

/**
 * Call LLM (Gemini or OpenAI) for answer generation.
 * Supports user API keys with automatic fallback to default keys.
 */
export async function callLLM(systemPrompt, userPrompt, model = undefined, maxTokens = 1000, provider = 'gemini', temperature = 0.0, userApiKey = null) {
  model = model || (provider === 'openai' ? 'gpt-4o-mini' : config.llmModel);
  
  if (provider === 'openai') {
    return await callOpenAILLM(systemPrompt, userPrompt, model, maxTokens, temperature, userApiKey);
  } else {
    return await callGeminiLLM(systemPrompt, userPrompt, model, maxTokens, temperature, userApiKey);
  }
}

/**
 * Gemini LLM with user key support and fallback
 */
async function callGeminiLLM(systemPrompt, userPrompt, model, maxTokens, temperature = 0.0, userApiKey = null) {
  const apiKey = userApiKey || config.geminiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY not provided');

  try {
    const genAIInstance = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAIInstance.getGenerativeModel({ 
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature
      }
    });

    const prompt = `${systemPrompt}\n\n${userPrompt}`;
    
    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    // If user key fails and we have a default key, try fallback
    if (userApiKey && config.geminiKey && userApiKey !== config.geminiKey) {
      console.warn('User API key failed, falling back to default key');
      return callGeminiLLM(systemPrompt, userPrompt, model, maxTokens, temperature, null);
    }
    throw error;
  }
}

/**
 * OpenAI LLM with user key support and fallback
 */
async function callOpenAILLM(systemPrompt, userPrompt, model, maxTokens, temperature = 0.0, userApiKey = null) {
  const apiKey = userApiKey || config.openaiKey;
  if (!apiKey) throw new Error('OPENAI_API_KEY not provided');

  try {
    const openaiInstance = new OpenAI({ apiKey: apiKey });

    // Build request params based on model type
    const requestParams = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };

    // Handle different model requirements
    if (model.includes('o1')) {
      // o1 models: no temperature support, use max_completion_tokens
      requestParams.max_completion_tokens = maxTokens;
    } else if (model.includes('gpt-4o-mini') || model.includes('gpt-4o')) {
      // gpt-4o models: standard parameters
      requestParams.max_tokens = maxTokens;
      requestParams.temperature = temperature;
    } else {
      // All other models (gpt-3.5, gpt-4, etc.)
      requestParams.max_tokens = maxTokens;
      requestParams.temperature = temperature;
    }

    const response = await openaiInstance.chat.completions.create(requestParams);

    return response.choices[0].message.content;
  } catch (error) {
    // If user key fails and we have a default key, try fallback
    if (userApiKey && config.openaiKey && userApiKey !== config.openaiKey) {
      console.warn('User API key failed, falling back to default key');
      return callOpenAILLM(systemPrompt, userPrompt, model, maxTokens, temperature, null);
    }
    throw error;
  }
}
