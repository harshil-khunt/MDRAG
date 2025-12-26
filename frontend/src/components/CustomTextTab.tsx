import { useState, useEffect } from 'react'
import { Card, Button, Input, Table, Modal, Form, Space, App } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons'
import { workspaceApi, CustomText } from '../services/api'

interface CustomTextTabProps {
  workspaceId: string
}

const CustomTextTab = ({ workspaceId }: CustomTextTabProps) => {
  const { message } = App.useApp() // Use message from App context
  const [texts, setTexts] = useState<CustomText[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingText, setEditingText] = useState<CustomText | null>(null)
  const [form] = Form.useForm()
  
  const MAX_CHARACTERS = 100000 // Character limit for custom text

  useEffect(() => {
    loadTexts()
  }, [workspaceId])

  const loadTexts = async () => {
    setLoading(true)
    try {
      const data = await workspaceApi.getCustomTexts(workspaceId)
      setTexts(data)
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to load custom texts')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (text?: CustomText) => {
    if (text) {
      setEditingText(text)
      form.setFieldsValue({
        title: text.title,
        content: text.content,
      })
    } else {
      setEditingText(null)
      form.resetFields()
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      
      if (editingText) {
        await workspaceApi.updateCustomText(
          workspaceId,
          editingText._id,
          values.title,
          values.content
        )
        message.success('Custom text updated successfully')
      } else {
        await workspaceApi.addCustomText(
          workspaceId,
          values.title,
          values.content
        )
        message.success('Custom text added successfully')
      }
      
      setModalVisible(false)
      form.resetFields()
      setEditingText(null)
      loadTexts()
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation error
        return
      }
      message.error(error.response?.data?.error || 'Failed to save custom text')
    }
  }

  const handleDelete = (textId: string) => {
    Modal.confirm({
      title: 'Delete Custom Text',
      content: 'Are you sure you want to delete this custom text?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await workspaceApi.deleteCustomText(workspaceId, textId)
          message.success('Custom text deleted successfully')
          loadTexts()
        } catch (error: any) {
          message.error(error.response?.data?.error || 'Failed to delete custom text')
        }
      },
    })
  }

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: '30%',
      render: (text: string) => (
        <Space>
          <FileTextOutlined className="text-blue-500" />
          <span className="font-medium">{text}</span>
        </Space>
      ),
    },
    {
      title: 'Content Preview',
      dataIndex: 'content',
      key: 'content',
      width: '50%',
      ellipsis: true,
      render: (text: string) => (
        <span className="text-gray-600">
          {text.length > 100 ? text.substring(0, 100) + '...' : text}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '20%',
      render: (_: any, record: CustomText) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            Edit
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card
        title={`Custom Texts (${texts.length})`}
        className="shadow-md"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadTexts}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal()}
            >
              Add Text
            </Button>
          </Space>
        }
      >
        <p className="text-gray-600 mb-4">
          Add custom text content that will be processed and made searchable in your workspace.
        </p>
        <Table
          columns={columns}
          dataSource={texts}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingText ? 'Edit Custom Text' : 'Add Custom Text'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
          setEditingText(null)
        }}
        okText={editingText ? 'Update' : 'Add'}
        width={800}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input
              placeholder="Enter a descriptive title"
              autoFocus
            />
          </Form.Item>
          <Form.Item
            name="content"
            label={
              <div className="flex justify-between items-center w-full">
                <span>Content</span>
                <span className="text-xs text-gray-500 font-normal">
                  {form.getFieldValue('content')?.length || 0} / {MAX_CHARACTERS.toLocaleString()} characters
                </span>
              </div>
            }
            rules={[
              { required: true, message: 'Please enter content' },
              { 
                max: MAX_CHARACTERS, 
                message: `Content must not exceed ${MAX_CHARACTERS.toLocaleString()} characters` 
              }
            ]}
          >
            <Input.TextArea
              placeholder="Enter the text content to be indexed and made searchable"
              rows={12}
              maxLength={MAX_CHARACTERS}
              showCount
              onChange={() => form.validateFields(['content'])}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CustomTextTab
