import { useState, useEffect } from 'react'
import { Card, Upload, Button, Input, Table, message, Modal, Tag, Space } from 'antd'
import {
  UploadOutlined,
  LinkOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FileTextOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { workspaceApi, Document } from '../services/api'
import type { UploadFile, RcFile } from 'antd/es/upload/interface'

interface DocumentsTabProps {
  workspaceId: string
}

const DocumentsTab = ({ workspaceId }: DocumentsTabProps) => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [urlModalVisible, setUrlModalVisible] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [workspaceId])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const data = await workspaceApi.getWorkspaceDocuments(workspaceId)
      setDocuments(data.documents)
    } catch (error: any) {
      message.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async () => {
    console.log('🔵 handleFileUpload called, fileList:', fileList)
    
    if (fileList.length === 0) {
      console.log('⚠️ No files in list')
      message.warning('Please select files to upload')
      return
    }

    setUploading(true)
    console.log('🔄 Upload started, extracting files...')
    
    try {
      // Extract actual File objects and filter out any undefined
      const files: File[] = fileList
        .map(f => f.originFileObj as RcFile)
        .filter((f): f is RcFile => f !== undefined)
      
      console.log('📦 Extracted files:', files.length, files.map(f => f.name))
      
      if (files.length === 0) {
        console.error('❌ No valid files found after extraction')
        message.error('No valid files found. Please try selecting files again.')
        setUploading(false)
        return
      }
      
      console.log(`🚀 Starting upload of ${files.length} files:`, files.map(f => f.name))
      
      const result = await workspaceApi.uploadFiles(workspaceId, files)
      
      if (result.successful === result.total) {
        message.success(`All ${result.total} files uploaded successfully! Processing in background...`)
      } else {
        message.warning(`${result.successful} of ${result.total} files uploaded successfully`)
        // Show which files failed
        const failed = result.results.filter((r: any) => !r.success)
        if (failed.length > 0) {
          console.error('Failed uploads:', failed)
        }
      }
      
      setFileList([])
      setTimeout(loadDocuments, 2000)
    } catch (error: any) {
      console.error('Upload error:', error)
      message.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const handleUrlUpload = async () => {
    const urls = urlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0)

    if (urls.length === 0) {
      message.warning('Please enter at least one URL')
      return
    }

    setUploading(true)
    try {
      const result = await workspaceApi.uploadUrls(workspaceId, urls)
      
      if (result.successful === result.total) {
        message.success(`All ${result.total} URLs submitted successfully! Processing in background...`)
      } else {
        message.warning(`${result.successful} of ${result.total} URLs submitted successfully`)
      }
      
      setUrlInput('')
      setUrlModalVisible(false)
      setTimeout(loadDocuments, 2000)
    } catch (error: any) {
      message.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to upload URLs')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = (_documentName: string) => {
    Modal.confirm({
      title: 'Delete Document',
      content: `Note: The Node.js backend doesn't have a delete document endpoint yet. This feature is not available.`,
      okText: 'OK',
      cancelButtonProps: { style: { display: 'none' } },
    })
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'source_name',
      key: 'source_name',
      render: (text: string, record: Document) => (
        <Space align="center">
          {record.source_type === 'url' ? (
            <GlobalOutlined className="text-blue-500" style={{ fontSize: '16px' }} />
          ) : (
            <FileTextOutlined className="text-green-500" style={{ fontSize: '16px' }} />
          )}
          <span className="font-medium">{text}</span>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'source_type',
      key: 'source_type',
      render: (type: string) => (
        <Tag color={type === 'url' ? 'blue' : 'green'}>
          {type ? type.toUpperCase() : 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      title: 'Chunks',
      dataIndex: 'chunk_count',
      key: 'chunk_count',
      render: (count: number) => <Tag>{count}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Document) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteDocument(record.source_name)}
        >
          Delete
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card title="Upload Documents" className="shadow-md">
        <div className="space-y-4">
          <div>
            <Upload
              fileList={fileList}
              onChange={({ fileList: newFileList }) => {
                console.log('Files selected:', newFileList.length)
                setFileList(newFileList)
              }}
              beforeUpload={(file) => {
                console.log('File added:', file.name, file.size, 'bytes')
                // Validate file size (max 50MB)
                const isLt50M = file.size / 1024 / 1024 < 50
                if (!isLt50M) {
                  message.error(`${file.name} is too large! Max size is 50MB.`)
                  return Upload.LIST_IGNORE
                }
                return false // Prevent auto upload
              }}
              multiple
              accept=".pdf,.txt,.md,.doc,.docx"
              maxCount={10}
            >
              <Button icon={<UploadOutlined />} size="large">
                Select Files
              </Button>
            </Upload>
            <p className="text-gray-500 text-sm mt-2">
              Supported formats: PDF, TXT, MD, DOC, DOCX (Max 50MB per file, 10 files at once)
            </p>
          </div>
          <Button
            type="primary"
            onClick={handleFileUpload}
            loading={uploading}
            disabled={fileList.length === 0}
            size="large"
          >
            Upload {fileList.length > 0 && `(${fileList.length} files)`}
          </Button>
        </div>
      </Card>

      <Card title="Add URLs" className="shadow-md">
        <Button
          type="primary"
          icon={<LinkOutlined />}
          onClick={() => setUrlModalVisible(true)}
          size="large"
        >
          Add URLs
        </Button>
      </Card>

      <Card
        title={`Documents (${documents.length})`}
        className="shadow-md"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadDocuments}
            loading={loading}
          >
            Refresh
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={documents}
          rowKey="source_name"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Add URLs"
        open={urlModalVisible}
        onOk={handleUrlUpload}
        onCancel={() => {
          setUrlModalVisible(false)
          setUrlInput('')
        }}
        confirmLoading={uploading}
        okText="Submit"
        width={600}
      >
        <div className="py-4">
          <Input.TextArea
            placeholder="Enter URLs (one per line)&#10;Example:&#10;https://example.com&#10;https://another-site.com"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            rows={8}
          />
        </div>
      </Modal>
    </div>
  )
}

export default DocumentsTab
