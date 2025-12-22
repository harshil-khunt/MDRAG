import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { fileQueue, urlQueue, customTextQueue } from './queues/index.js';
import { createWorkspace, listWorkspaces, getWorkspace, upsertTrackedSource, listTrackedSources, getChangeEvents, upsertQnA, getQnAs, deleteQnA, addCustomText, getCustomTexts, updateCustomText, deleteCustomText, getWorkspaceDocuments, updateWorkspaceRole } from './lib/database.js';
import { fetchUrlBuffer } from './lib/scraper.js';
import { getEmbeddings } from './lib/embeddings.js';
import config from './config.js';
import './scheduler.js'; // Start the scheduler

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3100',
    'http://localhost:3000',
    'http://72.61.40.15:3100',  // Production frontend
    'http://72.61.40.15:3101',   // Production backend (for testing)
    'http://localhost:3101'   // Production backend (for testing)
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
const upload = multer({ dest: 'tmp/' });

app.get('/', (req, res) => res.json({ status: 'ok' }));

// create workspace
app.post('/workspaces', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { name, owner, llmProvider, userApiKey, role, customPrompt } = req.body;
    
    // Validate llmProvider
    const provider = llmProvider === 'openai' ? 'openai' : 'gemini';
    
    // Validate role
    const validRoles = ['customer_service', 'sales', 'technical_support', 'custom'];
    const chatbotRole = validRoles.includes(role) ? role : 'customer_service';
    
    const doc = await createWorkspace(
      id, 
      name || `ws-${id}`, 
      owner || 'owner-1', 
      provider, 
      userApiKey,
      chatbotRole,
      customPrompt
    );
    res.status(201).json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/workspaces', async (req, res) => {
  try {
    const all = await listWorkspaces();
    res.json(all);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update workspace API key
app.put('/workspaces/:id/api-key', async (req, res) => {
  try {
    const { id } = req.params;
    const { userApiKey } = req.body;
    
    const { updateWorkspaceApiKey } = await import('./lib/database.js');
    const updated = await updateWorkspaceApiKey(id, userApiKey);
    
    if (updated) {
      res.json({ success: true, message: 'API key updated successfully' });
    } else {
      res.status(404).json({ error: 'Workspace not found' });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Update workspace role and custom prompt
app.put('/workspaces/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, customPrompt } = req.body;
    
    // Validate role
    const validRoles = ['customer_service', 'sales', 'technical_support', 'custom'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const updated = await updateWorkspaceRole(id, role, customPrompt);
    
    if (updated) {
      res.json({ success: true, message: 'Chatbot role updated successfully' });
    } else {
      res.status(404).json({ error: 'Workspace not found' });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get default prompt for a role
app.get('/role-prompts/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const { getDefaultPromptForRole } = await import('./lib/rolePrompts.js');
    
    const validRoles = ['customer_service', 'sales', 'technical_support'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const prompt = getDefaultPromptForRole(role);
    res.json({ prompt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// upload file
app.post('/workspaces/:id/upload/file', upload.single('file'), async (req, res) => {
  try {
    const ws = req.params.id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    console.log(`📤 Enqueueing file: ${file.originalname} (${file.size} bytes) for workspace ${ws}`);
    console.log(`   Temp path: ${file.path}`);
    
    const job = await fileQueue.add('process-file-job', { 
      tempPath: file.path, 
      filename: file.originalname, 
      workspaceId: ws 
    });
    
    console.log(`✅ Job enqueued with ID: ${job.id}`);
    res.status(202).json({ message: `enqueued ${file.originalname}` });
  } catch (e) {
    console.error('❌ Error enqueueing file:', e);
    res.status(500).json({ error: e.message });
  }
});

// enqueue URL
app.post('/workspaces/:id/upload/url', async (req, res) => {
  try {
    const ws = req.params.id;
    const { url, name, trackChanges = false, scheduleMinutes, enableOcr = false } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    // If trackChanges is enabled, add to tracked_sources
    if (trackChanges) {
      await upsertTrackedSource(ws, url, {
        crawlDomain: true,
        scheduleMinutes: scheduleMinutes || 60,
        enableOcr
      });
    }

    // Enqueue initial crawl
    await urlQueue.add('process-url-job', { 
      url, 
      workspaceId: ws, 
      name,
      trackChanges,
      enableOcr
    });
    
    res.status(202).json({ 
      message: 'url enqueued',
      tracking: trackChanges ? 'enabled' : 'disabled',
      ocr: enableOcr ? 'enabled' : 'disabled'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get all documents for a workspace (files, URLs, custom texts)
app.get('/workspaces/:id/documents', async (req, res) => {
  try {
    const ws = req.params.id;
    const documents = await getWorkspaceDocuments(ws);
    res.json({ documents, total_documents: documents.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get tracked sources for a workspace
app.get('/workspaces/:id/sources', async (req, res) => {
  try {
    const ws = req.params.id;
    const sources = await listTrackedSources(ws);
    res.json(sources);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get change events for a workspace
app.get('/workspaces/:id/changes', async (req, res) => {
  try {
    const ws = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    const events = await getChangeEvents(ws, limit);
    res.json(events);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ========== QnA Endpoints ==========

// Create or update a QnA pair
app.post('/workspaces/:id/qna', async (req, res) => {
  try {
    const ws = req.params.id;
    const { question, answer, id } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ error: 'question and answer are required' });
    }
    
    // Get workspace settings
    const workspace = await getWorkspace(ws);
    const llmProvider = workspace?.llm_provider || 'gemini';
    const embeddingModel = workspace?.embedding_model || config.embeddingModel;
    
    // Generate embedding for the question using workspace's model
    const [embedding] = await getEmbeddings([question], embeddingModel, llmProvider);
    
    const qna = await upsertQnA(ws, question, answer, embedding, id);
    res.json({ success: true, qna });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get all QnA pairs for a workspace
app.get('/workspaces/:id/qna', async (req, res) => {
  try {
    const ws = req.params.id;
    const qnas = await getQnAs(ws);
    res.json(qnas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Delete a QnA pair
app.delete('/workspaces/:id/qna/:qnaId', async (req, res) => {
  try {
    const ws = req.params.id;
    const qnaId = new ObjectId(req.params.qnaId);
    const deleted = await deleteQnA(ws, qnaId);
    
    if (deleted) {
      res.json({ success: true, message: 'QnA deleted' });
    } else {
      res.status(404).json({ error: 'QnA not found' });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ========== CUSTOM TEXT ENDPOINTS ==========

// Add custom text
app.post('/workspaces/:id/texts', async (req, res) => {
  try {
    const ws = req.params.id;
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }
    
    console.log(`\n📝 Adding custom text to workspace ${ws}`);
    console.log(`   Title: "${title}"`);
    console.log(`   Content length: ${content.length} characters`);
    
    const textDoc = await addCustomText(ws, title, content);
    
    console.log(`✅ Custom text saved to database with ID: ${textDoc._id}`);
    
    // Process text for embeddings (chunk and embed)
    const job = await customTextQueue.add('process-custom-text', {
      workspaceId: ws,
      textId: textDoc._id.toString(),
      title,
      content
    });
    
    console.log(`⚡ Job queued for processing with ID: ${job.id}`);
    console.log(`👉 Check worker terminal for processing logs\n`);
    
    res.status(201).json({ 
      message: 'Custom text added and queued for processing',
      text: textDoc,
      jobId: job.id
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get all custom texts
app.get('/workspaces/:id/texts', async (req, res) => {
  try {
    const ws = req.params.id;
    const texts = await getCustomTexts(ws);
    res.json(texts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Update custom text
app.put('/workspaces/:id/texts/:textId', async (req, res) => {
  try {
    const ws = req.params.id;
    const textId = new ObjectId(req.params.textId);
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }
    
    const updated = await updateCustomText(ws, textId, title, content);
    
    if (updated) {
      // Re-process updated text
      await customTextQueue.add('process-custom-text', {
        workspaceId: ws,
        textId: textId.toString(),
        title,
        content,
        isUpdate: true
      });
      
      res.json({ success: true, message: 'Custom text updated and queued for re-processing' });
    } else {
      res.status(404).json({ error: 'Custom text not found' });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Delete custom text
app.delete('/workspaces/:id/texts/:textId', async (req, res) => {
  try {
    const ws = req.params.id;
    const textId = new ObjectId(req.params.textId);
    const deleted = await deleteCustomText(ws, textId);
    
    if (deleted) {
      res.json({ success: true, message: 'Custom text deleted' });
    } else {
      res.status(404).json({ error: 'Custom text not found' });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// chat (RAG)
import { answerQuery } from './lib/rag.js';
app.post('/workspaces/:id/chat', async (req, res) => {
  try {
    const ws = req.params.id;
    const { question, conversationHistory } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });
    
    // Pass conversation history for context-aware responses
    const result = await answerQuery(ws, question, { 
      topK: 30,
      conversationHistory: conversationHistory || []
    });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(config.port, () => console.log(`Server listening on ${config.port}`));
