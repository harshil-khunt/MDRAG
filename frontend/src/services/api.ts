import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3101'

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
}

export interface ChatMessage {
  question: string
  answer?: string
  sources?: string[]
  relevant_chunks?: any[]
  suggested_questions?: string[]
}

export const workspaceApi = {
  // Create workspace
  createWorkspace: async (name: string, owner?: string): Promise<Workspace> => {
    const response = await api.post('/workspaces', { name, owner })
    return response.data
  },

  // List workspaces
  listWorkspaces: async (): Promise<Workspace[]> => {
    const response = await api.get('/workspaces')
    return response.data
  },

  // Upload single file (Node.js backend accepts one file at a time)
  uploadFile: async (workspaceId: string, file: File): Promise<any> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post(
      `/workspaces/${workspaceId}/upload/file`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
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

  // Upload URL with tracking options
  uploadUrl: async (
    workspaceId: string, 
    url: string, 
    options?: {
      name?: string
      trackChanges?: boolean
      scheduleMinutes?: number
      enableOcr?: boolean
    }
  ): Promise<any> => {
    const response = await api.post(`/workspaces/${workspaceId}/upload/url`, {
      url,
      name: options?.name,
      trackChanges: options?.trackChanges || false,
      scheduleMinutes: options?.scheduleMinutes || 60,
      enableOcr: options?.enableOcr || false,
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
  chat: async (workspaceId: string, question: string): Promise<ChatMessage> => {
    const response = await api.post(`/workspaces/${workspaceId}/chat`, { question })
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
}

export default api
