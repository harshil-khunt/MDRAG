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
  
  // Track items being processed
  const [processingItems, setProcessingItems] = useState<Array<{
    name: string
    type: 'file' | 'url'
    timestamp: number
  }>>([])

  useEffect(() => {
    loadDocuments()
  }, [workspaceId])
  
  // Auto-refresh when items are processing
  useEffect(() => {
    if (processingItems.length > 0) {
      const interval = setInterval(() => {
        console.log(`🔄 Auto-refreshing to check ${processingItems.length} processing items...`)
        loadDocuments()
        
        // Remove items that have been processing for more than 5 minutes (timeout)
        const now = Date.now()
        const TIMEOUT = 5 * 60 * 1000 // 5 minutes
        
        setProcessingItems(prev => {
          const stillValid = prev.filter(item => {
            const age = now - item.timestamp
            if (age > TIMEOUT) {
              console.warn(`⏱️ ${item.name} timed out after ${Math.round(age / 1000)}s`)
              message.warning(`${item.name} is taking longer than expected. Please check if the worker is running.`)
              return false
            }
            return true
          })
          return stillValid
        })
      }, 3000) // Check every 3 seconds
      
      return () => clearInterval(interval)
    }
  }, [processingItems.length])
  
  // Remove items from processing when they appear in documents
  useEffect(() => {
    if (processingItems.length > 0 && documents.length > 0) {
      setProcessingItems(prev => {
        const stillProcessing = prev.filter(item => {
          const found = documents.some(doc => doc.source_name === item.name)
          if (found) {
            console.log(`✅ ${item.name} completed processing!`)
            message.success(`${item.name} processed successfully!`)
          }
          return !found
        })
        return stillProcessing
      })
    }
  }, [documents])

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
    console.log('🔵 handleFileUpload called')
    console.log('   fileList:', fileList)
    console.log('   uploading state:', uploading)
    
    if (fileList.length === 0) {
      console.log('⚠️ No files in list')
      message.warning('Please select files to upload')
      return
    }

    // Prevent double submission
    if (uploading) {
      console.log('⚠️ Upload already in progress, ignoring duplicate call')
      return
    }

    console.log('✅ Starting upload process...')
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
        
        // Check if worker might not be running
        message.info('Make sure your worker is running: npm run worker', 5)
        
        // Add files to processing list
        const newProcessingItems = files.map(f => ({
          name: f.name,
          type: 'file' as const,
          timestamp: Date.now()
        }))
        setProcessingItems(prev => [...prev, ...newProcessingItems])
        
      } else {
        message.warning(`${result.successful} of ${result.total} files uploaded successfully`)
        // Show which files failed
        const failed = result.results.filter((r: any) => !r.success)
        if (failed.length > 0) {
          console.error('Failed uploads:', failed)
        }
        
        // Only add successful files to processing
        const successful = result.results.filter((r: any) => r.success)
        const newProcessingItems = successful.map((r: any) => ({
          name: r.file,
          type: 'file' as const,
          timestamp: Date.now()
        }))
        setProcessingItems(prev => [...prev, ...newProcessingItems])
      }
      
      setFileList([])
      // Don't wait - let auto-refresh handle it
      // setTimeout(loadDocuments, 2000)
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

    // Prevent double submission
    if (uploading) {
      console.log('⚠️ Upload already in progress, ignoring duplicate call')
      return
    }

    setUploading(true)
    try {
      const result = await workspaceApi.uploadUrls(workspaceId, urls)
      
      if (result.successful === result.total) {
        message.success(`All ${result.total} URLs submitted successfully! Processing in background...`)
        
        // Check if worker might not be running
        message.info('Make sure your worker is running: npm run worker', 5)
        
        // Add URLs to processing list
        const newProcessingItems = urls.map(url => ({
          name: url,
          type: 'url' as const,
          timestamp: Date.now()
        }))
        setProcessingItems(prev => [...prev, ...newProcessingItems])
        
      } else {
        message.warning(`${result.successful} of ${result.total} URLs submitted successfully`)
        
        // Only add successful URLs to processing
        const successful = result.results.filter((r: any) => r.success)
        const newProcessingItems = successful.map((r: any) => ({
          name: r.url,
          type: 'url' as const,
          timestamp: Date.now()
        }))
        setProcessingItems(prev => [...prev, ...newProcessingItems])
      }
      
      setUrlInput('')
      setUrlModalVisible(false)
      // Don't wait - let auto-refresh handle it
      // setTimeout(loadDocuments, 2000)
    } catch (error: any) {
      message.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to upload URLs')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = (documentName: string) => {
    Modal.confirm({
      title: 'Delete Document',
      content: `Are you sure you want to delete "${documentName}"? This will remove all ${documentName.includes('http') ? 'crawled pages' : 'chunks'} from this document.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await workspaceApi.deleteDocument(workspaceId, documentName)
          message.success(`Deleted ${documentName}`)
          loadDocuments()
        } catch (error: any) {
          message.error(error.response?.data?.error || 'Failed to delete document')
        }
      }
    })
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'source_name',
      key: 'source_name',
      render: (text: string, record: any) => (
        <Space align="center">
          {record._isProcessing ? (
            <ReloadOutlined spin className="text-orange-500" style={{ fontSize: '16px' }} />
          ) : record.source_type === 'url' ? (
            <GlobalOutlined className="text-blue-500" style={{ fontSize: '16px' }} />
          ) : (
            <FileTextOutlined className="text-green-500" style={{ fontSize: '16px' }} />
          )}
          <span className={record._isProcessing ? 'font-medium text-orange-600' : 'font-medium'}>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'source_type',
      key: 'source_type',
      render: (type: string, record: any) => {
        if (record._isProcessing) {
          return <Tag color="processing" icon={<ReloadOutlined spin />}>PROCESSING...</Tag>
        }
        return (
          <Tag color={type === 'url' ? 'blue' : 'green'}>
            {type ? type.toUpperCase() : 'UNKNOWN'}
          </Tag>
        )
      },
    },
    {
      title: 'Chunks',
      dataIndex: 'chunk_count',
      key: 'chunk_count',
      render: (count: number, record: any) => {
        if (record._isProcessing) {
          return <Tag color="orange">Pending...</Tag>
        }
        return <Tag>{count}</Tag>
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        if (record._isProcessing) {
          return <span className="text-gray-400 text-sm">Processing...</span>
        }
        return (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteDocument(record.source_name)}
          >
            Delete
          </Button>
        )
      },
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
        title={`Documents (${documents.length}${processingItems.length > 0 ? ` + ${processingItems.length} processing` : ''})`}
        className="shadow-md"
        extra={
          <Space>
            {processingItems.length > 0 && (
              <Button
                danger
                size="small"
                onClick={() => {
                  setProcessingItems([])
                  message.info('Cleared processing items. Make sure your worker is running!')
                }}
              >
                Clear Processing
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={loadDocuments}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={[
            // Show processing items first with special styling
            ...processingItems.map(item => ({
              source_name: item.name,
              source_type: item.type,
              chunk_count: 0,
              _isProcessing: true,
              _timestamp: item.timestamp
            })),
            // Then show actual documents
            ...documents
          ]}
          rowKey={(record: any) => record._isProcessing ? `processing-${record.source_name}` : record.source_name}
          loading={loading}
          pagination={{ pageSize: 10 }}
          rowClassName={(record: any) => record._isProcessing ? 'bg-yellow-50 animate-pulse' : ''}
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
        okButtonProps={{ disabled: uploading || !urlInput.trim() }}
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
