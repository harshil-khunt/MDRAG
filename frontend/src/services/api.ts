import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100'  // Changed default to 3100

console.log('🔗 API Base URL:', API_BASE_URL)

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface Workspace {
  id: string
  name: string
  owner: string
  llm_provider?: string
  llm_model?: string
  embedding_model?: string
  chatbot_role?: string
  custom_prompt?: string | null
  createdAt?: string
}

export interface TrackedSource {
  _id: string
  workspaceId: string
  url: string
  crawlDomain: boolean
  scheduleMinutes: number
  enableOcr: boolean
  lastCrawled?: string
  createdAt: string
}

export interface ChangeEvent {
  _id: string
  workspaceId: string
  url: string
  changeType: string
  timestamp: string
  details?: any
}

export interface QnA {
  _id: string
  workspaceId: string
  question: string
  answer: string
  embedding: number[]
  createdAt: string
  updatedAt: string
}

export interface CustomText {
  _id: string
  workspaceId: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface Document {
  source_name: string
  source_type: string
  chunk_count: number
  created_at?: string
  status?: 'discovered' | 'processing' | 'completed' | 'failed'
}

export interface ChatMessage {
  question: string
  answer?: string
  sources?: string[]
  relevant_chunks?: any[]
  suggested_questions?: string[]
}

export const workspaceApi = {
  // Check worker status
  checkWorkerStatus: async (): Promise<{ status: string; message: string }> => {
    try {
      const response = await api.get('/worker/status')
      return response.data
    } catch (error: any) {
      return {
        status: 'error',
        message: 'Worker is not running. Please start it with: npm run worker'
      }
    }
  },

  // Create workspace
  createWorkspace: async (name: string, llmProvider?: 'gemini' | 'openai', owner?: string, userApiKey?: string, role?: string, customPrompt?: string): Promise<Workspace> => {
    const response = await api.post('/workspaces', { 
      name, 
      owner: owner || 'user-1',
      llmProvider: llmProvider || 'gemini',
      userApiKey: userApiKey || undefined,
      role: role || 'customer_service',
      customPrompt: customPrompt || null
    })
    return response.data
  },

  // Update workspace API key
  updateWorkspaceApiKey: async (workspaceId: string, userApiKey: string): Promise<any> => {
    const response = await api.put(`/workspaces/${workspaceId}/api-key`, {
      userApiKey
    })
    return response.data
  },

  // Update workspace role and custom prompt
  updateWorkspaceRole: async (workspaceId: string, role: string, customPrompt?: string): Promise<any> => {
    const response = await api.put(`/workspaces/${workspaceId}/role`, {
      role,
      customPrompt: customPrompt || null
    })
    return response.data
  },

  // Get default prompt for a role
  getDefaultPrompt: async (role: string): Promise<{ prompt: string }> => {
    console.log('🔍 Fetching prompt from:', `${API_BASE_URL}/role-prompts/${role}`)
    const response = await api.get(`/role-prompts/${role}`)
    console.log('📥 Response data:', response.data)
    return response.data
  },

  // List workspaces
  listWorkspaces: async (): Promise<Workspace[]> => {
    const response = await api.get('/workspaces')
    return response.data
  },

  // Upload single file (Node.js backend accepts one file at a time)
  uploadFile: async (workspaceId: string, file: File): Promise<any> => {
    console.log(`📤 Uploading file: ${file.name} (${file.size} bytes) to workspace ${workspaceId}`)
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await api.post(
        `/workspaces/${workspaceId}/upload/file`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      console.log(`✅ Upload successful:`, response.data)
      return response.data
    } catch (error: any) {
      console.error(`❌ Upload failed for ${file.name}:`, error.response?.data || error.message)
      throw error
    }
  },

  // Upload multiple files (wrapper that calls uploadFile for each)
  uploadFiles: async (workspaceId: string, files: File[]): Promise<any> => {
    const results = []
    for (const file of files) {
      try {
        const result = await workspaceApi.uploadFile(workspaceId, file)
        results.push({ file: file.name, success: true, result })
      } catch (error) {
        results.push({ file: file.name, success: false, error })
      }
    }
    return { results, total: files.length, successful: results.filter(r => r.success).length }
  },

  // Upload URL with crawl mode and path filters
  uploadUrl: async (
    workspaceId: string, 
    url: string, 
    options?: {
      name?: string
      trackChanges?: boolean
      scheduleMinutes?: number
      enableOcr?: boolean
      crawlMode?: 'crawl' | 'sitemap' | 'individual'
      includePaths?: string[]
      excludePaths?: string[]
    }
  ): Promise<any> => {
    const response = await api.post(`/workspaces/${workspaceId}/upload/url`, {
      url,
      name: options?.name,
      trackChanges: options?.trackChanges || false,
      scheduleMinutes: options?.scheduleMinutes || 60,
      enableOcr: options?.enableOcr || false,
      crawlMode: options?.crawlMode || 'sitemap',
      includePaths: options?.includePaths || [],
      excludePaths: options?.excludePaths || [],
    })
    return response.data
  },

  // Upload multiple URLs (wrapper)
  uploadUrls: async (workspaceId: string, urls: string[]): Promise<any> => {
    const results = []
    for (const url of urls) {
      try {
        const result = await workspaceApi.uploadUrl(workspaceId, url)
        results.push({ url, success: true, result })
      } catch (error) {
        results.push({ url, success: false, error })
      }
    }
    return { results, total: urls.length, successful: results.filter(r => r.success).length }
  },

  // Get workspace documents (all files, URLs, custom texts)
  getWorkspaceDocuments: async (workspaceId: string): Promise<{ documents: Document[], total_documents: number }> => {
    const response = await api.get(`/workspaces/${workspaceId}/documents`)
    return response.data
  },

  // Delete a document (remove all its chunks)
  deleteDocument: async (workspaceId: string, sourceName: string): Promise<any> => {
    const response = await api.delete(`/workspaces/${workspaceId}/documents/${encodeURIComponent(sourceName)}`)
    return response.data
  },

  // Get tracked sources
  getTrackedSources: async (workspaceId: string): Promise<TrackedSource[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/sources`)
    return response.data
  },

  // Get change events
  getChangeEvents: async (workspaceId: string, limit?: number): Promise<ChangeEvent[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/changes`, {
      params: { limit: limit || 50 }
    })
    return response.data
  },

  // Chat with workspace (using 'question' field instead of 'query')
  chat: async (workspaceId: string, question: string, conversationHistory?: Array<{role: string, content: string}>): Promise<ChatMessage> => {
    const response = await api.post(`/workspaces/${workspaceId}/chat`, { 
      question,
      conversationHistory: conversationHistory || []
    })
    return response.data
  },

  // ========== QnA APIs ==========
  
  // Create or update QnA
  createQnA: async (workspaceId: string, question: string, answer: string, id?: string): Promise<any> => {
    const response = await api.post(`/workspaces/${workspaceId}/qna`, {
      question,
      answer,
      id,
    })
    return response.data
  },

  // Get all QnAs
  getQnAs: async (workspaceId: string): Promise<QnA[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/qna`)
    return response.data
  },

  // Delete QnA
  deleteQnA: async (workspaceId: string, qnaId: string): Promise<any> => {
    const response = await api.delete(`/workspaces/${workspaceId}/qna/${qnaId}`)
    return response.data
  },

  // ========== Custom Text APIs ==========
  
  // Add custom text
  addCustomText: async (workspaceId: string, title: string, content: string): Promise<any> => {
    const response = await api.post(`/workspaces/${workspaceId}/texts`, {
      title,
      content,
    })
    return response.data
  },

  // Get all custom texts
  getCustomTexts: async (workspaceId: string): Promise<CustomText[]> => {
    const response = await api.get(`/workspaces/${workspaceId}/texts`)
    return response.data
  },

  // Update custom text
  updateCustomText: async (workspaceId: string, textId: string, title: string, content: string): Promise<any> => {
    const response = await api.put(`/workspaces/${workspaceId}/texts/${textId}`, {
      title,
      content,
    })
    return response.data
  },

  // Delete custom text
  deleteCustomText: async (workspaceId: string, textId: string): Promise<any> => {
    const response = await api.delete(`/workspaces/${workspaceId}/texts/${textId}`)
    return response.data
  },

  // ========== Usage & Analytics APIs ==========
  
  // Get usage statistics for workspace
  getUsageStats: async (workspaceId: string): Promise<any> => {
    const response = await api.get(`/workspaces/${workspaceId}/usage`)
    return response.data
  },

  // Get vector count only
  getVectorCount: async (workspaceId: string): Promise<any> => {
    const response = await api.get(`/workspaces/${workspaceId}/vectors/count`)
    return response.data
  },

  // Get all workspaces usage (admin)
  getAllUsageStats: async (): Promise<any> => {
    const response = await api.get('/admin/usage/all')
    return response.data
  },

  // Get Pinecone index stats (admin)
  getPineconeStats: async (): Promise<any> => {
    const response = await api.get('/admin/pinecone/stats')
    return response.data
  },
}

export default api
