import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tabs, Button, message } from 'antd'
import { ArrowLeftOutlined, FileTextOutlined, MessageOutlined, QuestionCircleOutlined, EditOutlined } from '@ant-design/icons'
import DocumentsTab from '../components/DocumentsTab'
import ChatTab from '../components/ChatTab'
import QnATab from '../components/QnATab'
import CustomTextTab from '../components/CustomTextTab'

const WorkspaceDetail = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('documents')

  if (!workspaceId) {
    message.error('Invalid workspace ID')
    navigate('/workspaces')
    return null
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
      children: <ChatTab workspaceId={workspaceId} />,
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
      />
    </div>
  )
}

export default WorkspaceDetail
