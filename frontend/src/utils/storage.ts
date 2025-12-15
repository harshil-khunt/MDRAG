const STORAGE_KEY = 'ai_assistant_workspaces'

export interface StoredWorkspace {
  id: string
  name: string
  createdAt: string
}

export const storageUtils = {
  // Get all workspaces from localStorage
  getWorkspaces: (): StoredWorkspace[] => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  },

  // Add workspace to localStorage
  addWorkspace: (workspace: StoredWorkspace): void => {
    const workspaces = storageUtils.getWorkspaces()
    const exists = workspaces.find(w => w.id === workspace.id)
    if (!exists) {
      workspaces.push(workspace)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces))
    }
  },

  // Remove workspace from localStorage
  removeWorkspace: (workspaceId: string): void => {
    const workspaces = storageUtils.getWorkspaces()
    const filtered = workspaces.filter(w => w.id !== workspaceId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  },

  // Clear all workspaces
  clearWorkspaces: (): void => {
    localStorage.removeItem(STORAGE_KEY)
  },

  // Get current workspace ID
  getCurrentWorkspaceId: (): string | null => {
    return localStorage.getItem('current_workspace_id')
  },

  // Set current workspace ID
  setCurrentWorkspaceId: (workspaceId: string): void => {
    localStorage.setItem('current_workspace_id', workspaceId)
  },
}
