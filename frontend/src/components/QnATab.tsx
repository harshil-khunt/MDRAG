import { useState, useEffect } from 'react'
import { Card, Button, Input, Table, Modal, Form, Space, App } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { workspaceApi, QnA } from '../services/api'

interface QnATabProps {
  workspaceId: string
}

const QnATab = ({ workspaceId }: QnATabProps) => {
  const { message } = App.useApp() // Use message from App context
  const [qnas, setQnas] = useState<QnA[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingQnA, setEditingQnA] = useState<QnA | null>(null)
  const [form] = Form.useForm()
  
  const MAX_CHARACTERS = 100000 // Character limit for QnA

  useEffect(() => {
    loadQnAs()
  }, [workspaceId])

  const loadQnAs = async () => {
    setLoading(true)
    try {
      const data = await workspaceApi.getQnAs(workspaceId)
      setQnas(data)
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to load QnAs')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (qna?: QnA) => {
    if (qna) {
      setEditingQnA(qna)
      form.setFieldsValue({
        question: qna.question,
        answer: qna.answer,
      })
    } else {
      setEditingQnA(null)
      form.resetFields()
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await workspaceApi.createQnA(
        workspaceId,
        values.question,
        values.answer,
        editingQnA?._id
      )
      message.success(editingQnA ? 'QnA updated successfully' : 'QnA created successfully')
      setModalVisible(false)
      form.resetFields()
      setEditingQnA(null)
      loadQnAs()
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation error
        return
      }
      message.error(error.response?.data?.error || 'Failed to save QnA')
    }
  }

  const handleDelete = (qnaId: string) => {
    Modal.confirm({
      title: 'Delete QnA',
      content: 'Are you sure you want to delete this QnA pair?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await workspaceApi.deleteQnA(workspaceId, qnaId)
          message.success('QnA deleted successfully')
          loadQnAs()
        } catch (error: any) {
          message.error(error.response?.data?.error || 'Failed to delete QnA')
        }
      },
    })
  }

  const columns = [
    {
      title: 'Question',
      dataIndex: 'question',
      key: 'question',
      width: '40%',
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: 'Answer',
      dataIndex: 'answer',
      key: 'answer',
      width: '45%',
      ellipsis: true,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '15%',
      render: (_: any, record: QnA) => (
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
        title={`Question & Answer Pairs (${qnas.length})`}
        className="shadow-md"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadQnAs}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal()}
            >
              Add QnA
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={qnas}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingQnA ? 'Edit QnA' : 'Add QnA'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
          setEditingQnA(null)
        }}
        okText={editingQnA ? 'Update' : 'Create'}
        width={700}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="question"
            label={
              <div className="flex justify-between items-center w-full">
                <span>Question</span>
                <span className="text-xs text-gray-500 font-normal">
                  {form.getFieldValue('question')?.length || 0} / {MAX_CHARACTERS.toLocaleString()} characters
                </span>
              </div>
            }
            rules={[
              { required: true, message: 'Please enter a question' },
              { 
                max: MAX_CHARACTERS, 
                message: `Question must not exceed ${MAX_CHARACTERS.toLocaleString()} characters` 
              }
            ]}
          >
            <Input.TextArea
              placeholder="Enter the question"
              rows={3}
              autoFocus
              maxLength={MAX_CHARACTERS}
              showCount
              onChange={() => form.validateFields(['question'])}
            />
          </Form.Item>
          <Form.Item
            name="answer"
            label={
              <div className="flex justify-between items-center w-full">
                <span>Answer</span>
                <span className="text-xs text-gray-500 font-normal">
                  {form.getFieldValue('answer')?.length || 0} / {MAX_CHARACTERS.toLocaleString()} characters
                </span>
              </div>
            }
            rules={[
              { required: true, message: 'Please enter an answer' },
              { 
                max: MAX_CHARACTERS, 
                message: `Answer must not exceed ${MAX_CHARACTERS.toLocaleString()} characters` 
              }
            ]}
          >
            <Input.TextArea
              placeholder="Enter the answer"
              rows={5}
              maxLength={MAX_CHARACTERS}
              showCount
              onChange={() => form.validateFields(['answer'])}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default QnATab
