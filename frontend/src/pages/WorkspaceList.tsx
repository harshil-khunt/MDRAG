import { useState, useEffect } from 'react'
import { Card, Button, Input, Modal, Empty, Spin, Radio, Space, Typography, Tag, Checkbox, App } from 'antd'
import { PlusOutlined, FolderOpenOutlined, DeleteOutlined, RobotOutlined, ThunderboltOutlined, KeyOutlined, CustomerServiceOutlined, DollarOutlined, ToolOutlined, EditOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { workspaceApi, Workspace } from '../services/api'
import { storageUtils } from '../utils/storage'

const { Text, Paragraph } = Typography
const { TextArea } = Input

const WorkspaceList = () => {
  const { message } = App.useApp() // Use message from App context
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'openai'>('gemini')
  const [useOwnApiKey, setUseOwnApiKey] = useState(false)
  const [userApiKey, setUserApiKey] = useState('')
  const [chatbotRole, setChatbotRole] = useState<string>('customer_service')
  const [customPrompt, setCustomPrompt] = useState('')
  const [basePrompt, setBasePrompt] = useState('')
  const [loadingPrompt, setLoadingPrompt] = useState(false)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  // Load base prompt when modal opens or role changes
  useEffect(() => {
    if (modalVisible) {
      loadBasePrompt(chatbotRole)
    }
  }, [modalVisible, chatbotRole])

  const loadBasePrompt = async (role: string) => {
    setLoadingPrompt(true)
    try {
      // For custom role, load customer_service as default template
      const roleToLoad = role === 'custom' ? 'customer_service' : role
      const response = await workspaceApi.getDefaultPrompt(roleToLoad)
      setBasePrompt(response.prompt)
    } catch (error) {
      console.error('Failed to load base prompt:', error)
    } finally {
      setLoadingPrompt(false)
    }
  }

  const handleRoleChange = (newRole: string) => {
    setChatbotRole(newRole)
    setCustomPrompt('') // Clear custom prompt when switching roles
  }

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const loadWorkspaces = async () => {
    try {
      // Fetch from API to get full workspace details including LLM provider
      const apiWorkspaces = await workspaceApi.listWorkspaces()
      const stored = storageUtils.getWorkspaces()
      
      // Merge API data with local storage
      const merged = stored.map(local => {
        const apiData = apiWorkspaces.find(api => api.id === local.id)
        return {
          ...local,
          ...apiData,
          owner: apiData?.owner || 'user-123'
        }
      })
      
      setWorkspaces(merged)
    } catch (error) {
      // Fallback to local storage if API fails
      const stored = storageUtils.getWorkspaces()
      setWorkspaces(stored.map(w => ({ ...w, owner: 'user-123' })))
    }
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      message.warning('Please enter a workspace name')
      return
    }

    if (useOwnApiKey && !userApiKey.trim()) {
      message.warning('Please enter your API key or uncheck "Use my own API key"')
      return
    }

    if (chatbotRole === 'custom' && !customPrompt.trim()) {
      message.warning('Please enter a custom prompt or select a different role')
      return
    }

    setCreating(true)
    try {
      // For predefined roles, save custom prompt only if user modified the base prompt
      const promptToSave = chatbotRole === 'custom' 
        ? customPrompt.trim() 
        : (customPrompt.trim() && customPrompt.trim() !== basePrompt.trim() ? customPrompt.trim() : undefined)
      
      const workspace = await workspaceApi.createWorkspace(
        newWorkspaceName, 
        llmProvider,
        'user-1',
        useOwnApiKey ? userApiKey.trim() : undefined,
        chatbotRole,
        promptToSave
      )
      storageUtils.addWorkspace({
        id: workspace.id,
        name: workspace.name,
        createdAt: new Date().toISOString(),
      })
      message.success(`Workspace created with ${llmProvider === 'gemini' ? 'Google Gemini' : 'OpenAI'}!`)
      setModalVisible(false)
      setNewWorkspaceName('')
      setLlmProvider('gemini')
      setUseOwnApiKey(false)
      setUserApiKey('')
      setChatbotRole('customer_service')
      setCustomPrompt('')
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
                {workspace.llm_provider && (
                  <div className="mt-3">
                    <Tag 
                      icon={workspace.llm_provider === 'gemini' ? <ThunderboltOutlined /> : <RobotOutlined />}
                      color={workspace.llm_provider === 'gemini' ? 'blue' : 'green'}
                    >
                      {workspace.llm_provider === 'gemini' ? 'Google Gemini' : 'OpenAI'}
                    </Tag>
                  </div>
                )}
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
          setLlmProvider('gemini')
          setUseOwnApiKey(false)
          setUserApiKey('')
          setChatbotRole('customer_service')
          setCustomPrompt('')
        }}
        confirmLoading={creating}
        okText="Create"
        width={600}
      >
        <div className="py-4">
          <div className="mb-6">
            <Text strong className="block mb-2">Workspace Name</Text>
            <Input
              placeholder="Enter workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onPressEnter={handleCreateWorkspace}
              size="large"
            />
          </div>

          <div className="mb-4">
            <Text strong className="block mb-3">Choose AI Provider</Text>
            <Radio.Group 
              value={llmProvider} 
              onChange={(e) => setLlmProvider(e.target.value)}
              className="w-full"
            >
              <Space direction="vertical" className="w-full" size="middle">
                <Card 
                  className={`cursor-pointer transition-all ${llmProvider === 'gemini' ? 'border-blue-500 border-2 bg-blue-50' : 'hover:border-blue-300'}`}
                  onClick={() => setLlmProvider('gemini')}
                >
                  <Radio value="gemini" className="w-full">
                    <div className="flex items-start">
                      <ThunderboltOutlined className="text-2xl text-blue-600 mr-3 mt-1" />
                      <div>
                        <Text strong className="text-base">Google Gemini</Text>
                        <Paragraph className="mb-0 text-sm text-gray-600">
                          Model: gemini-2.5-flash<br />
                          Embedding: text-embedding-004<br />
                          <Text type="secondary" className="text-xs">Fast, reliable, and cost-effective</Text>
                        </Paragraph>
                      </div>
                    </div>
                  </Radio>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all ${llmProvider === 'openai' ? 'border-green-500 border-2 bg-green-50' : 'hover:border-green-300'}`}
                  onClick={() => setLlmProvider('openai')}
                >
                  <Radio value="openai" className="w-full">
                    <div className="flex items-start">
                      <RobotOutlined className="text-2xl text-green-600 mr-3 mt-1" />
                      <div>
                        <Text strong className="text-base">OpenAI</Text>
                        <Paragraph className="mb-0 text-sm text-gray-600">
                          Model: gpt-4o-mini<br />
                          Embedding: text-embedding-3-small<br />
                          <Text type="secondary" className="text-xs">Advanced reasoning and understanding</Text>
                        </Paragraph>
                      </div>
                    </div>
                  </Radio>
                </Card>
              </Space>
            </Radio.Group>
          </div>

          <div className="mb-4">
            <Text strong className="block mb-3">Chatbot Role</Text>
            <Radio.Group 
              value={chatbotRole} 
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full"
            >
              <Space direction="vertical" className="w-full" size="middle">
                <Card 
                  className={`cursor-pointer transition-all ${chatbotRole === 'customer_service' ? 'border-blue-500 border-2 bg-blue-50' : 'hover:border-blue-300'}`}
                  onClick={() => handleRoleChange('customer_service')}
                >
                  <Radio value="customer_service" className="w-full">
                    <div className="flex items-start">
                      <CustomerServiceOutlined className="text-2xl text-blue-600 mr-3 mt-1" />
                      <div>
                        <Text strong className="text-base">Customer Service</Text>
                        <Paragraph className="mb-0 text-sm text-gray-600">
                          Helpful, patient, problem-solving focused<br />
                          <Text type="secondary" className="text-xs">Best for support, troubleshooting, and customer care</Text>
                        </Paragraph>
                      </div>
                    </div>
                  </Radio>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all ${chatbotRole === 'sales' ? 'border-green-500 border-2 bg-green-50' : 'hover:border-green-300'}`}
                  onClick={() => handleRoleChange('sales')}
                >
                  <Radio value="sales" className="w-full">
                    <div className="flex items-start">
                      <DollarOutlined className="text-2xl text-green-600 mr-3 mt-1" />
                      <div>
                        <Text strong className="text-base">Sales Representative</Text>
                        <Paragraph className="mb-0 text-sm text-gray-600">
                          Persuasive, product-focused, conversion-oriented<br />
                          <Text type="secondary" className="text-xs">Best for product info, pricing, and sales guidance</Text>
                        </Paragraph>
                      </div>
                    </div>
                  </Radio>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all ${chatbotRole === 'technical_support' ? 'border-purple-500 border-2 bg-purple-50' : 'hover:border-purple-300'}`}
                  onClick={() => handleRoleChange('technical_support')}
                >
                  <Radio value="technical_support" className="w-full">
                    <div className="flex items-start">
                      <ToolOutlined className="text-2xl text-purple-600 mr-3 mt-1" />
                      <div>
                        <Text strong className="text-base">Technical Support</Text>
                        <Paragraph className="mb-0 text-sm text-gray-600">
                          Technical, detailed, troubleshooting focused<br />
                          <Text type="secondary" className="text-xs">Best for technical docs, APIs, and developer support</Text>
                        </Paragraph>
                      </div>
                    </div>
                  </Radio>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all ${chatbotRole === 'custom' ? 'border-orange-500 border-2 bg-orange-50' : 'hover:border-orange-300'}`}
                  onClick={() => handleRoleChange('custom')}
                >
                  <Radio value="custom" className="w-full">
                    <div className="flex items-start">
                      <EditOutlined className="text-2xl text-orange-600 mr-3 mt-1" />
                      <div>
                        <Text strong className="text-base">Custom</Text>
                        <Paragraph className="mb-0 text-sm text-gray-600">
                          Define your own chatbot personality and behavior<br />
                          <Text type="secondary" className="text-xs">Write a custom system prompt below</Text>
                        </Paragraph>
                      </div>
                    </div>
                  </Radio>
                </Card>
              </Space>
            {/* Base Prompt Display (for all roles) */}
            <div className="mt-4">
              <Text strong className="block mb-2">
                {chatbotRole === 'custom' ? 'Custom Base Prompt' : `Base Prompt (Default for ${chatbotRole === 'customer_service' ? 'Customer Service' : chatbotRole === 'sales' ? 'Sales Representative' : 'Technical Support'})`}
              </Text>
              {loadingPrompt ? (
                <div className="flex justify-center p-4">
                  <Spin />
                </div>
              ) : (
                <>
                  <TextArea
                    value={customPrompt || basePrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                    placeholder="Loading base prompt..."
                  />
                  <Text type="secondary" className="text-xs block mt-2">
                    {chatbotRole === 'custom' 
                      ? '💡 Define your chatbot\'s personality, tone, and behavior. You can use the default template above or write your own.'
                      : '💡 This is the default prompt. You can edit it to customize, or leave as-is to use the default.'
                    }
                  </Text>
                  {customPrompt && customPrompt !== basePrompt && (
                    <div className="mt-2">
                      <Button 
                        size="small" 
                        onClick={() => setCustomPrompt('')}
                        type="link"
                      >
                        Reset to default
                      </Button>
                    </div>
                  )}
                  {chatbotRole === 'custom' && (
                    <Text type="warning" className="text-xs block mt-2">
                      ⚠️ Custom prompts require careful design. Poor prompts may affect answer quality.
                    </Text>
                  )}
                </>
              )}
            </div>
            </Radio.Group>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
            <div className="flex items-start mb-3">
              <KeyOutlined className="text-blue-600 text-lg mr-2 mt-1" />
              <div className="flex-1">
                <Text strong className="block mb-2">API Key (Optional)</Text>
                <Checkbox 
                  checked={useOwnApiKey}
                  onChange={(e) => {
                    setUseOwnApiKey(e.target.checked)
                    if (!e.target.checked) setUserApiKey('')
                  }}
                >
                  Use my own API key
                </Checkbox>
              </div>
            </div>
            
            {useOwnApiKey && (
              <div className="mt-3">
                <Input.Password
                  placeholder={`Enter your ${llmProvider === 'gemini' ? 'Google Gemini' : 'OpenAI'} API key`}
                  value={userApiKey}
                  onChange={(e) => setUserApiKey(e.target.value)}
                  size="large"
                  prefix={<KeyOutlined />}
                />
                <Text type="secondary" className="text-xs block mt-2">
                  Your API key will be used for all operations. If it fails or runs out of quota, 
                  the system will automatically fallback to the default key.
                </Text>
              </div>
            )}
            
            {!useOwnApiKey && (
              <Text type="secondary" className="text-xs block mt-2">
                The default API key will be used. You can add your own key later in workspace settings.
              </Text>
            )}
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded">
            <Text type="secondary" className="text-xs">
              💡 <strong>Note:</strong> The AI provider cannot be changed after workspace creation. 
              All documents, embeddings, and chat will use the selected provider.
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default WorkspaceList
