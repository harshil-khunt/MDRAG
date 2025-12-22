import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tabs, Button, message, Modal, Radio, Space, Card, Typography, Spin, Input } from 'antd'
import { ArrowLeftOutlined, FileTextOutlined, MessageOutlined, QuestionCircleOutlined, EditOutlined, SettingOutlined, CustomerServiceOutlined, DollarOutlined, ToolOutlined, EditOutlined as EditIcon } from '@ant-design/icons'
import DocumentsTab from '../components/DocumentsTab'
import ChatTab from '../components/ChatTab'
import QnATab from '../components/QnATab'
import CustomTextTab from '../components/CustomTextTab'
import { workspaceApi } from '../services/api'

const { Text, Paragraph } = Typography
const { TextArea } = Input

const WorkspaceDetail = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('documents')
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [chatbotRole, setChatbotRole] = useState<string>('customer_service')
  const [customPrompt, setCustomPrompt] = useState('')
  const [basePrompt, setBasePrompt] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [loadingPrompt, setLoadingPrompt] = useState(false)
  const [currentRoleTag, setCurrentRoleTag] = useState('customer_service')

  if (!workspaceId) {
    message.error('Invalid workspace ID')
    navigate('/workspaces')
    return null
  }

  // Load workspace settings when modal opens
  useEffect(() => {
    if (settingsVisible) {
      loadWorkspaceSettings()
    }
  }, [settingsVisible, workspaceId])

  const loadWorkspaceSettings = async () => {
    try {
      const workspaces = await workspaceApi.listWorkspaces()
      const workspace = workspaces.find(w => w.id === workspaceId)
      if (workspace) {
        const role = workspace.chatbot_role || 'customer_service'
        setChatbotRole(role)
        setCurrentRoleTag(role)
        setCustomPrompt(workspace.custom_prompt || '')
        
        // Always load base prompt for all roles
        await loadBasePrompt(role)
      }
    } catch (error) {
      console.error('Failed to load workspace settings:', error)
    }
  }

  const loadBasePrompt = async (role: string) => {
    setLoadingPrompt(true)
    try {
      // For custom role, load customer_service as default template
      const roleToLoad = role === 'custom' ? 'customer_service' : role
      const response = await workspaceApi.getDefaultPrompt(roleToLoad)
      setBasePrompt(response.prompt)
    } catch (error) {
      console.error('Failed to load base prompt:', error)
      message.error('Failed to load base prompt')
    } finally {
      setLoadingPrompt(false)
    }
  }

  const handleRoleChange = async (newRole: string) => {
    setChatbotRole(newRole)
    setCustomPrompt('') // Clear custom prompt when switching roles
    await loadBasePrompt(newRole)
  }

  const handleSaveSettings = async () => {
    if (chatbotRole === 'custom' && !customPrompt.trim()) {
      message.warning('Please enter a custom prompt or select a different role')
      return
    }

    setSavingSettings(true)
    try {
      // For predefined roles, save custom prompt only if user modified the base prompt
      const promptToSave = chatbotRole === 'custom' 
        ? customPrompt.trim() 
        : (customPrompt.trim() && customPrompt.trim() !== basePrompt.trim() ? customPrompt.trim() : undefined)
      
      await workspaceApi.updateWorkspaceRole(
        workspaceId!,
        chatbotRole,
        promptToSave
      )
      message.success('Chatbot role updated successfully!')
      setCurrentRoleTag(chatbotRole)
      setSettingsVisible(false)
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to update settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const getRoleDisplayName = (role: string) => {
    const names: Record<string, string> = {
      customer_service: 'Customer Service',
      sales: 'Sales Representative',
      technical_support: 'Technical Support',
      custom: 'Custom'
    }
    return names[role] || 'Customer Service'
  }

  const items = [
    {
      key: 'documents',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          Documents & URLs
        </span>
      ),
      children: <DocumentsTab workspaceId={workspaceId} />,
    },
    {
      key: 'qna',
      label: (
        <span className="flex items-center gap-2">
          <QuestionCircleOutlined />
          Q&A Pairs
        </span>
      ),
      children: <QnATab workspaceId={workspaceId} />,
    },
    {
      key: 'texts',
      label: (
        <span className="flex items-center gap-2">
          <EditOutlined />
          Custom Texts
        </span>
      ),
      children: <CustomTextTab workspaceId={workspaceId} />,
    },
    {
      key: 'chat',
      label: (
        <span className="flex items-center gap-2">
          <MessageOutlined />
          Chat Assistant
        </span>
      ),
      children: <ChatTab workspaceId={workspaceId} currentRole={currentRoleTag} />,
    },
  ]

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/workspaces')}
          className="mb-4"
        >
          Back to Workspaces
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">Workspace</h1>
        <p className="text-gray-600 mt-1">ID: {workspaceId}</p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
        size="large"
        tabBarExtraContent={
          <Button
            icon={<SettingOutlined />}
            onClick={() => setSettingsVisible(true)}
            type="default"
          >
            Chatbot Settings
          </Button>
        }
      />

      {/* Settings Modal */}
      <Modal
        title="Chatbot Settings"
        open={settingsVisible}
        onOk={handleSaveSettings}
        onCancel={() => setSettingsVisible(false)}
        confirmLoading={savingSettings}
        okText="Save"
        width={700}
      >
        <div className="py-4">
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
                        Helpful, patient, problem-solving focused
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
                        Persuasive, product-focused, conversion-oriented
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
                        Technical, detailed, troubleshooting focused
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
                    <EditIcon className="text-2xl text-orange-600 mr-3 mt-1" />
                    <div>
                      <Text strong className="text-base">Custom</Text>
                      <Paragraph className="mb-0 text-sm text-gray-600">
                        Define your own chatbot personality
                      </Paragraph>
                    </div>
                  </div>
                </Radio>
              </Card>
            </Space>
          </Radio.Group>

          {/* Base Prompt Display (for all roles) */}
          <div className="mt-4">
            <Text strong className="block mb-2">
              {chatbotRole === 'custom' ? 'Custom Base Prompt' : `Base Prompt (Default for ${getRoleDisplayName(chatbotRole)})`}
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
                  rows={8}
                  className="font-mono text-sm"
                  placeholder="Loading base prompt..."
                />
                <Text type="secondary" className="text-xs block mt-2">
                  {chatbotRole === 'custom' 
                    ? '💡 Define your chatbot\'s personality, tone, and behavior. You can use the default template above or write your own.'
                    : `💡 This is the default prompt for ${getRoleDisplayName(chatbotRole)}. You can edit it to customize the behavior, or leave it as-is to use the default.`
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

          <div className="mt-4 p-3 bg-blue-50 rounded">
            <Text type="secondary" className="text-xs">
              💡 <strong>Note:</strong> Changing the role will affect how the chatbot responds to questions. 
              The new role will apply to all future messages.
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default WorkspaceDetail
