import { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, Empty, Tag, Collapse, Spin, Modal, App } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, BulbOutlined, LoadingOutlined } from '@ant-design/icons'
import { workspaceApi } from '../services/api'
import ReactMarkdown from 'react-markdown'

interface ChatTabProps {
  workspaceId: string
  currentRole: string
}

interface ChatHistory {
  question: string
  answer: string
  sources: string[]
  relevant_chunks: any[]
  suggested_questions?: string[]
  timestamp: string
}

const ChatTab = ({ workspaceId, currentRole }: ChatTabProps) => {
  const { message } = App.useApp() // Use message from App context
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load chat history from localStorage on mount
  useEffect(() => {
    const storageKey = `chat_history_${workspaceId}`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        setChatHistory(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load chat history:', e)
      }
    }
  }, [workspaceId])

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      const storageKey = `chat_history_${workspaceId}`
      localStorage.setItem(storageKey, JSON.stringify(chatHistory))
    }
  }, [chatHistory, workspaceId])

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatHistory, loading])

  const handleSendMessage = async () => {
    if (!query.trim()) {
      message.warning('Please enter a question')
      return
    }

    const userQuestion = query
    setQuery('')
    setLoading(true)

    // Add user message immediately
    const userMessage: ChatHistory = {
      question: userQuestion,
      answer: '',
      sources: [],
      relevant_chunks: [],
      suggested_questions: [],
      timestamp: new Date().toISOString(),
    }
    setChatHistory(prev => [...prev, userMessage])

    try {
      // Build conversation history for context (last 5 messages)
      const conversationHistory = chatHistory.slice(-5).flatMap(chat => [
        { role: 'user', content: chat.question },
        { role: 'assistant', content: chat.answer }
      ]).filter(msg => msg.content); // Remove empty messages
      
      const response = await workspaceApi.chat(workspaceId, userQuestion, conversationHistory)
      
      // Update the last message with AI response
      setChatHistory(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          answer: response.answer || 'No answer received',
          sources: response.sources || [],
          relevant_chunks: response.relevant_chunks || [],
          suggested_questions: response.suggested_questions || [],
        }
        return updated
      })
    } catch (error: any) {
      message.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to get response')
      // Remove the failed message
      setChatHistory(prev => prev.slice(0, -1))
      setQuery(userQuestion)
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = () => {
    Modal.confirm({
      title: 'Clear Chat History',
      content: 'Are you sure you want to clear all chat messages?',
      okText: 'Clear',
      okType: 'danger',
      onOk: () => {
        setChatHistory([])
        const storageKey = `chat_history_${workspaceId}`
        localStorage.removeItem(storageKey)
        message.success('Chat history cleared')
      },
    })
  }

  const handleSuggestedQuestion = (question: string) => {
    setQuery(question)
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

  return (
    <div className="space-y-4">
      <Card className="shadow-md" styles={{ body: { padding: 0 } }}>
        <div className="h-[600px] flex flex-col">
          {/* Header with Clear button */}
          {chatHistory.length > 0 && (
            <div className="border-b bg-white px-4 py-2 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {chatHistory.length} message{chatHistory.length !== 1 ? 's' : ''}
                </span>
                <Tag color="blue" className="text-xs">
                  {getRoleDisplayName(currentRole)}
                </Tag>
              </div>
              <Button
                size="small"
                danger
                type="text"
                onClick={handleClearHistory}
              >
                Clear History
              </Button>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {chatHistory.length === 0 ? (
              <Empty
                description="No messages yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                className="mt-20"
              >
                <p className="text-gray-500">
                  Ask questions about your uploaded documents and URLs
                </p>
              </Empty>
            ) : (
              <div className="space-y-6">
                {chatHistory.map((chat, index) => (
                  <div key={index} className="space-y-4">
                    {/* User Question */}
                    <div className="flex justify-end">
                      <div className="max-w-[80%] bg-blue-500 text-white rounded-lg p-4 shadow">
                        <div className="flex items-start gap-3">
                          <UserOutlined className="text-lg flex-shrink-0" style={{ marginTop: '2px' }} />
                          <div className="flex-1">
                            <p className="font-medium mb-1 mt-0">You</p>
                            <p className="break-words">{chat.question}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Answer */}
                    <div className="flex justify-start">
                      <div className="max-w-[80%] bg-white rounded-lg p-4 shadow-md border">
                        <div className="flex items-start gap-3">
                          <RobotOutlined className="text-blue-500 text-lg flex-shrink-0" style={{ marginTop: '2px' }} />
                          <div className="flex-1">
                            <p className="font-medium mb-2 text-blue-600 mt-0">AI Assistant</p>
                            {chat.answer ? (
                              <div className="prose prose-sm max-w-none text-gray-800">
                                <ReactMarkdown
                                  components={{
                                    a: ({ node, ...props }) => (
                                      <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline" />
                                    ),
                                    p: ({ node, ...props }) => (
                                      <p {...props} className="mb-2 last:mb-0" />
                                    ),
                                    ol: ({ node, ...props }) => (
                                      <ol {...props} className="list-decimal list-inside mb-2 space-y-1" />
                                    ),
                                    ul: ({ node, ...props }) => (
                                      <ul {...props} className="list-disc list-inside mb-2 space-y-1" />
                                    ),
                                    li: ({ node, ...props }) => (
                                      <li {...props} className="ml-2" />
                                    ),
                                  }}
                                >
                                  {chat.answer}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-500">
                                <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                                <span>Thinking...</span>
                              </div>
                            )}
                            
                            {/* Sources */}
                            {chat.sources && chat.sources.length > 0 && (
                              <div className="mt-4">
                                <p className="text-sm font-medium text-gray-600 mb-2">Sources:</p>
                                <div className="flex flex-wrap gap-2">
                                  {chat.sources.map((source, idx) => (
                                    <Tag key={idx} color="blue" className="text-xs">
                                      {source.length > 40 ? source.substring(0, 40) + '...' : source}
                                    </Tag>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Relevant Chunks */}
                            {chat.relevant_chunks && chat.relevant_chunks.length > 0 && (
                              <div className="mt-4">
                                <Collapse
                                  size="small"
                                  items={[
                                    {
                                      key: '1',
                                      label: `View ${chat.relevant_chunks.length} relevant chunks`,
                                      children: (
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                          {chat.relevant_chunks.map((chunk, idx) => (
                                            <div key={idx} className="bg-gray-50 p-2 rounded text-xs">
                                              <p className="text-gray-700">{chunk.text || chunk.content || JSON.stringify(chunk)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      ),
                                    },
                                  ]}
                                />
                              </div>
                            )}

                            {/* Suggested Questions */}
                            {chat.suggested_questions && chat.suggested_questions.length > 0 && (
                              <div className="mt-4">
                                <p className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-1">
                                  <BulbOutlined /> Suggested questions:
                                </p>
                                <div className="space-y-2">
                                  {chat.suggested_questions.map((sq, idx) => (
                                    <Button
                                      key={idx}
                                      size="small"
                                      type="dashed"
                                      onClick={() => handleSuggestedQuestion(sq)}
                                      className="w-full text-left"
                                    >
                                      {sq}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
            
            {/* Loading indicator at bottom */}
            {loading && (
              <div className="flex justify-center items-center py-4">
                <Spin 
                  indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
                  tip="AI is processing your question..."
                />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask a question about your documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onPressEnter={handleSendMessage}
                size="large"
                disabled={loading}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                loading={loading}
                size="large"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send'}
              </Button>
            </div>
            {loading && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Processing your question... This may take 10-30 seconds
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default ChatTab
