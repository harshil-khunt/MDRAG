import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Upload, Button, Input, Table, Modal, Tag, Space, App } from 'antd'
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
  const { message } = App.useApp() // Use message from App context
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [urlModalVisible, setUrlModalVisible] = useState(false)
  const [crawlMode, setCrawlMode] = useState<'crawl' | 'sitemap' | 'individual'>('crawl')
  const [includePaths, setIncludePaths] = useState('')
  const [excludePaths, setExcludePaths] = useState('')
  
  // Track items being processed
  const [processingItems, setProcessingItems] = useState<Array<{
    name: string
    type: 'file' | 'url'
    timestamp: number
  }>>([])
  
  // Track which items we've already shown success messages for
  const completedItemsRef = useRef<Set<string>>(new Set())
  const messageRef = useRef(message)
  
  // Update message ref when it changes
  useEffect(() => {
    messageRef.current = message
  }, [message])
  
  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await workspaceApi.getWorkspaceDocuments(workspaceId)
      setDocuments(data.documents)
    } catch (error: any) {
      messageRef.current.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])
  
  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])
  
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
              messageRef.current.warning(`${item.name} is taking longer than expected. Please check if the worker is running.`)
              return false
            }
            return true
          })
          return stillValid
        })
      }, 3000) // Check every 3 seconds
      
      return () => clearInterval(interval)
    }
  }, [processingItems.length, loadDocuments])
  
  // Remove items from processing when they appear in documents AND have chunks
  useEffect(() => {
    if (processingItems.length > 0 && documents.length > 0) {
      setProcessingItems(prev => {
        const stillProcessing = prev.filter(item => {
          // For URLs, check if any document starts with the URL (crawled pages)
          // For files, check for exact match
          const matchingDocs = documents.filter(doc => {
            if (item.type === 'url') {
              // URL crawling creates multiple pages, check if any page from this domain exists
              return doc.source_name.startsWith(item.name) || doc.source_name === item.name
            } else {
              // File upload creates one document with exact name
              return doc.source_name === item.name
            }
          })
          
          // Consider it complete if:
          // 1. We found matching documents
          // 2. AND they have chunks (chunk_count > 0)
          // 3. AND status is 'completed' (not 'discovered' or 'processing')
          const hasChunks = matchingDocs.some(doc => {
            const status = doc.status || 'completed'
            return doc.chunk_count > 0 && status === 'completed'
          })
          const isComplete = matchingDocs.length > 0 && hasChunks
          
          if (isComplete && !completedItemsRef.current.has(item.name)) {
            // Mark as completed and show success message
            completedItemsRef.current.add(item.name)
            const totalChunks = matchingDocs.reduce((sum, doc) => sum + doc.chunk_count, 0)
            console.log(`✅ ${item.name} completed processing! (${matchingDocs.length} pages, ${totalChunks} chunks)`)
            
            // Use setTimeout to avoid calling message during render
            setTimeout(() => {
              messageRef.current.success(`${item.name} processed successfully! (${matchingDocs.length} pages, ${totalChunks} chunks)`)
            }, 0)
          }
          
          return !isComplete
        })
        return stillProcessing
      })
    }
  }, [documents, processingItems])

  const handleFileUpload = async () => {
    const timestamp = Date.now()
    console.log(`\n=== UPLOAD CLICKED (${timestamp}) ===`)
    console.log('1. Current state:')
    console.log('   - fileList:', fileList.length, 'files')
    console.log('   - uploading:', uploading)
    console.log('   - workspaceId:', workspaceId)
    
    if (fileList.length === 0) {
      console.log('❌ STOPPED: No files in list')
      message.warning('Please select files to upload')
      return
    }

    // Prevent double submission
    if (uploading) {
      console.log('❌ STOPPED: Upload already in progress (duplicate click blocked)')
      return
    }

    // Check worker status before uploading
    console.log('🔍 Checking worker status...')
    const workerStatus = await workspaceApi.checkWorkerStatus()
    if (workerStatus.status !== 'healthy') {
      message.error('Worker is not running! Please start it with: npm run worker', 10)
      console.error('❌ Worker not running:', workerStatus.message)
      return
    }
    console.log('✅ Worker is running')

    console.log('✅ PROCEEDING with upload...')
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
    const timestamp = Date.now()
    console.log(`\n=== URL UPLOAD CLICKED (${timestamp}) ===`)
    console.log('1. Current state:')
    console.log('   - urlInput:', urlInput.length, 'chars')
    console.log('   - crawlMode:', crawlMode)
    console.log('   - includePaths:', includePaths)
    console.log('   - excludePaths:', excludePaths)
    console.log('   - uploading:', uploading)
    console.log('   - workspaceId:', workspaceId)
    
    if (!urlInput.trim()) {
      console.log('❌ STOPPED: No URL entered')
      message.warning('Please enter a URL')
      return
    }

    // Prevent double submission
    if (uploading) {
      console.log('❌ STOPPED: Upload already in progress (duplicate click blocked)')
      return
    }

    // Check worker status before uploading
    console.log('🔍 Checking worker status...')
    const workerStatus = await workspaceApi.checkWorkerStatus()
    if (workerStatus.status !== 'healthy') {
      message.error('Worker is not running! Please start it with: npm run worker', 10)
      console.error('❌ Worker not running:', workerStatus.message)
      return
    }
    console.log('✅ Worker is running')

    console.log('✅ PROCEEDING with URL upload...')
    setUploading(true)
    try {
      // Parse include/exclude paths
      const includePathsArray = includePaths
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
      
      const excludePathsArray = excludePaths
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
      
      await workspaceApi.uploadUrl(workspaceId, urlInput.trim(), {
        crawlMode,
        includePaths: includePathsArray,
        excludePaths: excludePathsArray
      })
      
      message.success(`URL submitted successfully! Processing in background...`)
      message.info('Make sure your worker is running: npm run worker', 5)
      
      // Add URL to processing list
      setProcessingItems(prev => [...prev, {
        name: urlInput.trim(),
        type: 'url' as const,
        timestamp: Date.now()
      }])
      
      setUrlInput('')
      setIncludePaths('')
      setExcludePaths('')
      setUrlModalVisible(false)
    } catch (error: any) {
      message.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to upload URL')
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
      render: (text: string, record: any) => {
        const status = record.status || 'completed'
        const icon = status === 'discovered' ? (
          <ReloadOutlined className="text-blue-500" style={{ fontSize: '16px' }} />
        ) : status === 'processing' ? (
          <ReloadOutlined spin className="text-orange-500" style={{ fontSize: '16px' }} />
        ) : status === 'failed' ? (
          <FileTextOutlined className="text-red-500" style={{ fontSize: '16px' }} />
        ) : record._isProcessing ? (
          <ReloadOutlined spin className="text-orange-500" style={{ fontSize: '16px' }} />
        ) : record.source_type === 'url' ? (
          <GlobalOutlined className="text-blue-500" style={{ fontSize: '16px' }} />
        ) : (
          <FileTextOutlined className="text-green-500" style={{ fontSize: '16px' }} />
        )
        
        return (
          <Space align="center">
            {icon}
            <span className={status !== 'completed' || record._isProcessing ? 'font-medium text-orange-600' : 'font-medium'}>{text}</span>
          </Space>
        )
      },
    },
    {
      title: 'Type',
      dataIndex: 'source_type',
      key: 'source_type',
      render: (type: string, record: any) => {
        const status = record.status || 'completed'
        
        if (status === 'discovered') {
          return <Tag color="blue" icon={<ReloadOutlined />}>DISCOVERED</Tag>
        }
        if (status === 'processing') {
          return <Tag color="processing" icon={<ReloadOutlined spin />}>PROCESSING...</Tag>
        }
        if (status === 'failed') {
          return <Tag color="red">FAILED</Tag>
        }
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
        const status = record.status || 'completed'
        
        if (status === 'discovered') {
          return <Tag color="blue">Waiting...</Tag>
        }
        if (status === 'processing') {
          return <Tag color="orange">Processing...</Tag>
        }
        if (status === 'failed') {
          return <Tag color="red">Failed</Tag>
        }
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
        const status = record.status || 'completed'
        
        if (status === 'discovered' || status === 'processing' || record._isProcessing) {
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
            ...processingItems.map((item, index) => ({
              source_name: item.name,
              source_type: item.type,
              chunk_count: 0,
              status: 'processing',
              _isProcessing: true,
              _timestamp: item.timestamp,
              _processingIndex: index // Add unique index for key
            })),
            // Then show actual documents (including discovered/processing from DB)
            ...documents
          ]}
          rowKey={(record: any) => {
            if (record._isProcessing) {
              // Use timestamp + index to ensure uniqueness
              return `processing-${record._timestamp}-${record._processingIndex}`
            }
            return record.source_name
          }}
          loading={loading}
          pagination={{ pageSize: 10 }}
          rowClassName={(record: any) => {
            const status = record.status || 'completed'
            if (record._isProcessing || status === 'discovered' || status === 'processing') {
              return 'bg-yellow-50 animate-pulse'
            }
            if (status === 'failed') {
              return 'bg-red-50'
            }
            return ''
          }}
        />
      </Card>

      <Modal
        title="Add URL"
        open={urlModalVisible}
        onOk={handleUrlUpload}
        onCancel={() => {
          setUrlModalVisible(false)
          setUrlInput('')
          setIncludePaths('')
          setExcludePaths('')
          setCrawlMode('crawl')
        }}
        confirmLoading={uploading}
        okText="Fetch Links"
        okButtonProps={{ disabled: uploading || !urlInput.trim() }}
        width={700}
      >
        <div className="py-4 space-y-4">
          {/* Crawl Mode Tabs */}
          <div className="flex gap-2 border-b">
            <button
              className={`px-4 py-2 font-medium ${crawlMode === 'crawl' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              onClick={() => setCrawlMode('crawl')}
            >
              Crawl Links
            </button>
            <button
              className={`px-4 py-2 font-medium ${crawlMode === 'sitemap' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              onClick={() => setCrawlMode('sitemap')}
            >
              Sitemap
            </button>
            <button
              className={`px-4 py-2 font-medium ${crawlMode === 'individual' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              onClick={() => setCrawlMode('individual')}
            >
              Individual Link
            </button>
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium mb-2">URL*</label>
            <Input
              placeholder="https://www.example.com"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              size="large"
            />
          </div>

          {/* Include/Exclude Paths (only for crawl and sitemap modes) */}
          {(crawlMode === 'crawl' || crawlMode === 'sitemap') && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Include only paths</label>
                <Input
                  placeholder="Ex: blog/*, dev/*"
                  value={includePaths}
                  onChange={(e) => setIncludePaths(e.target.value)}
                  size="large"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated paths to include. Leave empty to include all.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Exclude paths</label>
                <Input
                  placeholder="Ex: admin/*, draft/*"
                  value={excludePaths}
                  onChange={(e) => setExcludePaths(e.target.value)}
                  size="large"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated paths to exclude. Leave empty to exclude nothing.
                </p>
              </div>
            </>
          )}

          {/* Mode Description */}
          <div className="bg-blue-50 p-3 rounded text-sm">
            {crawlMode === 'crawl' && (
              <p><strong>Crawl Links:</strong> Discovers and crawls all pages on the domain following links.</p>
            )}
            {crawlMode === 'sitemap' && (
              <p><strong>Sitemap:</strong> Only crawls pages listed in sitemap.xml (faster, more reliable).</p>
            )}
            {crawlMode === 'individual' && (
              <p><strong>Individual Link:</strong> Only crawls this specific page, no other pages.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default DocumentsTab
