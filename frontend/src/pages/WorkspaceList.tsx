import { useState, useEffect } from 'react'
import { Card, Button, Input, Modal, message, Empty, Spin } from 'antd'
import { PlusOutlined, FolderOpenOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { workspaceApi, Workspace } from '../services/api'
import { storageUtils } from '../utils/storage'

const WorkspaceList = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const loadWorkspaces = () => {
    const stored = storageUtils.getWorkspaces()
    setWorkspaces(stored.map(w => ({ ...w, owner: 'user-123' })))
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      message.warning('Please enter a workspace name')
      return
    }

    setCreating(true)
    try {
      const workspace = await workspaceApi.createWorkspace(newWorkspaceName)
      storageUtils.addWorkspace({
        id: workspace.id,
        name: workspace.name,
        createdAt: new Date().toISOString(),
      })
      message.success('Workspace created successfully!')
      setModalVisible(false)
      setNewWorkspaceName('')
      loadWorkspaces()
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to create workspace')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteWorkspace = (workspaceId: string, workspaceName: string) => {
    Modal.confirm({
      title: 'Delete Workspace',
      content: `Are you sure you want to remove "${workspaceName}" from your list?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        storageUtils.removeWorkspace(workspaceId)
        message.success('Workspace removed from list')
        loadWorkspaces()
      },
    })
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">My Workspaces</h1>
          <p className="text-gray-600 mt-1">Manage your document and URL collections</p>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
        >
          Create Workspace
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : workspaces.length === 0 ? (
        <Card className="text-center py-12">
          <Empty
            description="No workspaces yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
            >
              Create Your First Workspace
            </Button>
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((workspace) => (
            <Card
              key={workspace.id}
              hoverable
              className="shadow-md hover:shadow-xl transition-shadow"
              actions={[
                <Button
                  type="text"
                  icon={<FolderOpenOutlined />}
                  onClick={() => {
                    storageUtils.setCurrentWorkspaceId(workspace.id)
                    navigate(`/workspaces/${workspace.id}`)
                  }}
                >
                  Open
                </Button>,
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteWorkspace(workspace.id, workspace.name)}
                >
                  Remove
                </Button>,
              ]}
            >
              <div className="text-center py-4">
                <FolderOpenOutlined className="text-5xl text-blue-500 mb-3" />
                <h3 className="text-xl font-semibold text-gray-800">{workspace.name}</h3>
                <p className="text-gray-500 text-sm mt-2">
                  ID: {workspace.id.substring(0, 8)}...
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="Create New Workspace"
        open={modalVisible}
        onOk={handleCreateWorkspace}
        onCancel={() => {
          setModalVisible(false)
          setNewWorkspaceName('')
        }}
        confirmLoading={creating}
        okText="Create"
      >
        <div className="py-4">
          <Input
            placeholder="Enter workspace name"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            onPressEnter={handleCreateWorkspace}
            size="large"
          />
        </div>
      </Modal>
    </div>
  )
}

export default WorkspaceList
