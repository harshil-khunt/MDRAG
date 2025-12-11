import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';

if (!config.geminiKey) {
  console.warn('Warning: GEMINI_API_KEY not set. Embeddings and LLM calls will fail without it.');
}

const genAI = config.geminiKey ? new GoogleGenerativeAI(config.geminiKey) : null;

/**
 * Create embeddings for an array of strings using Gemini.
 * Returns array of float[] vectors in same order.
 */
export async function getEmbeddings(texts, model = undefined, retries = 3) {
  model = model || config.embeddingModel;
  if (!config.geminiKey) throw new Error('GEMINI_API_KEY not provided in env');

  const embeddingModel = genAI.getGenerativeModel({ model });
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const embeddings = [];
      
      // Process texts in batches (Gemini can handle multiple at once)
      for (const text of texts) {
        const result = await embeddingModel.embedContent(text);
        embeddings.push(result.embedding.values);
      }
      
      return embeddings;
    } catch (error) {
      if ((error.message?.includes('429') || error.message?.includes('quota')) && attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // exponential backoff: 1s, 2s, 4s
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Call Gemini for answer generation.
 * systemPrompt and userPrompt are combined for Gemini.
 */
export async function callLLM(systemPrompt, userPrompt, model = undefined, maxTokens = 1000) {
  model = model || config.llmModel;
  if (!config.geminiKey) throw new Error('GEMINI_API_KEY not provided in env');

  const generativeModel = genAI.getGenerativeModel({ 
    model,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.0
    }
  });

  // Combine system and user prompts for Gemini
  const prompt = `${systemPrompt}\n\n${userPrompt}`;
  
  const result = await generativeModel.generateContent(prompt);
  const response = result.response;
  return response.text();
}
