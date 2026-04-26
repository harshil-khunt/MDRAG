import { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, Tag, Collapse, Spin, Modal, App } from 'antd'
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
      <Card className="shadow-lg rounded-xl border-0" styles={{ body: { padding: 0 } }}>
        <div className="h-[650px] flex flex-col bg-gradient-to-b from-gray-50 to-white rounded-xl overflow-hidden">
          {/* Header with Clear button */}
          {chatHistory.length > 0 && (
            <div className="border-b bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <RobotOutlined className="text-white text-lg" />
                <span className="text-sm font-medium text-white">
                  {chatHistory.length} message{chatHistory.length !== 1 ? 's' : ''}
                </span>
                <Tag color="rgba(255,255,255,0.2)" className="text-xs text-white border-white/30">
                  {getRoleDisplayName(currentRole)}
                </Tag>
              </div>
              <Button
                size="small"
                type="text"
                onClick={handleClearHistory}
                className="text-white hover:bg-white/20 border-0"
              >
                Clear History
              </Button>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-white">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                    <RobotOutlined className="text-white text-4xl" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">
                    Welcome to AI Assistant
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Ask questions about your uploaded documents and URLs. I'm here to help you find answers instantly.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                    <p className="text-sm font-medium text-blue-900 mb-2">💡 Try asking:</p>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• "What are your business hours?"</li>
                      <li>• "How do I contact support?"</li>
                      <li>• "Tell me about your products"</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-4xl mx-auto">
                {chatHistory.map((chat, index) => (
                  <div key={index} className="space-y-4 animate-fadeIn">
                    {/* User Question */}
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm p-4 shadow-lg hover:shadow-xl transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="break-words leading-relaxed">{chat.question}</p>
                            <p className="text-xs text-blue-100 mt-2 opacity-75">
                              {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <UserOutlined className="text-sm" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Answer */}
                    <div className="flex justify-start">
                      <div className="max-w-[85%] bg-white rounded-2xl rounded-tl-sm p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                            <RobotOutlined className="text-white text-sm" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold mb-3 text-gray-800 flex items-center gap-2">
                              AI Assistant
                              <span className="text-xs font-normal text-gray-500">
                                {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </p>
                            {chat.answer ? (
                              <div className="prose prose-sm max-w-none text-gray-700">
                                <ReactMarkdown
                                  components={{
                                    a: ({ node, ...props }) => (
                                      <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium" />
                                    ),
                                    p: ({ node, ...props }) => (
                                      <p {...props} className="mb-3 last:mb-0 leading-relaxed" />
                                    ),
                                    ol: ({ node, ...props }) => (
                                      <ol {...props} className="list-decimal list-inside mb-3 space-y-2 pl-2" />
                                    ),
                                    ul: ({ node, ...props }) => (
                                      <ul {...props} className="list-disc list-inside mb-3 space-y-2 pl-2" />
                                    ),
                                    li: ({ node, ...props }) => (
                                      <li {...props} className="ml-2 leading-relaxed" />
                                    ),
                                    strong: ({ node, ...props }) => (
                                      <strong {...props} className="font-semibold text-gray-900" />
                                    ),
                                  }}
                                >
                                  {chat.answer}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 text-gray-500 py-2">
                                <Spin indicator={<LoadingOutlined style={{ fontSize: 18 }} spin />} />
                                <span className="text-sm">Thinking...</span>
                              </div>
                            )}
                            
                            {/* Sources */}
                            {chat.sources && chat.sources.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Sources</p>
                                <div className="flex flex-wrap gap-2">
                                  {chat.sources.map((source, idx) => (
                                    <Tag key={idx} color="blue" className="text-xs rounded-full px-3 py-1">
                                      📄 {source.length > 35 ? source.substring(0, 35) + '...' : source}
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
                                  className="bg-gray-50 border-gray-200"
                                  items={[
                                    {
                                      key: '1',
                                      label: (
                                        <span className="text-xs font-medium text-gray-600">
                                          📚 View {chat.relevant_chunks.length} relevant chunks
                                        </span>
                                      ),
                                      children: (
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                          {chat.relevant_chunks.map((chunk, idx) => (
                                            <div key={idx} className="bg-white p-3 rounded-lg text-xs border border-gray-200">
                                              <p className="text-gray-700 leading-relaxed">{chunk.text || chunk.content || JSON.stringify(chunk)}</p>
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
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                  <BulbOutlined className="text-yellow-500" /> Suggested questions
                                </p>
                                <div className="space-y-2">
                                  {chat.suggested_questions.map((sq, idx) => (
                                    <Button
                                      key={idx}
                                      size="small"
                                      type="default"
                                      onClick={() => handleSuggestedQuestion(sq)}
                                      className="w-full text-left hover:bg-blue-50 hover:border-blue-300 transition-colors rounded-lg"
                                    >
                                      <span className="text-xs text-gray-700">{sq}</span>
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
              <div className="flex justify-center items-center py-6 bg-gradient-to-b from-white to-gray-50">
                <div className="text-center">
                  <Spin 
                    indicator={<LoadingOutlined style={{ fontSize: 28, color: '#3b82f6' }} spin />}
                  />
                  <p className="text-sm text-gray-600 mt-3 font-medium">AI is processing your question...</p>
                  <p className="text-xs text-gray-500 mt-1">This may take 10-30 seconds</p>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-5 shadow-lg">
            <div className="flex gap-3 max-w-4xl mx-auto">
              <Input
                placeholder="Ask a question about your documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onPressEnter={handleSendMessage}
                size="large"
                disabled={loading}
                className="rounded-xl shadow-sm hover:shadow-md transition-shadow"
                style={{ fontSize: '15px' }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                loading={loading}
                size="large"
                disabled={loading}
                className="rounded-xl px-6 shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-blue-500 to-blue-600 border-0"
              >
                {loading ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default ChatTab
