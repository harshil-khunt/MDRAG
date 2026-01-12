import { useState, useEffect } from 'react'
import { Card, Statistic, Progress, Row, Col, Spin, Alert, Tooltip } from 'antd'
import { DatabaseOutlined, CloudOutlined, DollarOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { workspaceApi } from '../services/api'

interface UsageStatsProps {
  workspaceId: string
}

interface UsageData {
  workspace_id: string
  pinecone: {
    vector_count: number
    dimension: number
    storage_mb: number
    estimated_cost_per_month: number
  }
  mongodb: {
    total_chunks: number
    total_text_size_mb: number
  }
  summary: {
    total_vectors: number
    storage_breakdown: {
      pinecone_vectors_mb: number
      mongodb_text_mb: number
      total_mb: number
    }
    estimated_monthly_cost: {
      pinecone: number
      total: number
    }
  }
}

const UsageStats = ({ workspaceId }: UsageStatsProps) => {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUsage()
  }, [workspaceId])

  const loadUsage = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await workspaceApi.getUsageStats(workspaceId)
      setUsage(data)
    } catch (err: any) {
      console.error('Failed to load usage stats:', err)
      setError(err.message || 'Failed to load usage statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="shadow-md">
        <div className="flex justify-center items-center py-8">
          <Spin size="large" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="shadow-md">
        <Alert
          message="Usage Stats Unavailable"
          description={error}
          type="warning"
          showIcon
        />
      </Card>
    )
  }

  if (!usage) return null

  const vectorCount = usage.pinecone.vector_count
  const freeLimit = 100000
  const usagePercent = (vectorCount / freeLimit) * 100
  const isNearLimit = usagePercent > 80
  const isOverLimit = vectorCount > freeLimit

  return (
    <Card 
      title={
        <div className="flex items-center gap-2">
          <DatabaseOutlined />
          <span>Usage Statistics</span>
          <Tooltip title="Track your vector storage usage. Free tier includes 100,000 vectors.">
            <InfoCircleOutlined className="text-gray-400 text-sm" />
          </Tooltip>
        </div>
      }
      className="shadow-md"
    >
      {/* Vector Usage Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Vector Storage</span>
          <span className="text-sm text-gray-600">
            {vectorCount.toLocaleString()} / {freeLimit.toLocaleString()}
          </span>
        </div>
        <Progress
          percent={Math.min(usagePercent, 100)}
          status={isOverLimit ? 'exception' : isNearLimit ? 'normal' : 'active'}
          strokeColor={isOverLimit ? '#ff4d4f' : isNearLimit ? '#faad14' : '#52c41a'}
        />
        {isOverLimit && (
          <Alert
            message="Free Tier Limit Exceeded"
            description="You've exceeded the free tier limit. Consider upgrading to continue adding documents."
            type="error"
            showIcon
            className="mt-3"
          />
        )}
        {isNearLimit && !isOverLimit && (
          <Alert
            message="Approaching Limit"
            description={`You're using ${usagePercent.toFixed(1)}% of your free tier. Consider upgrading soon.`}
            type="warning"
            showIcon
            className="mt-3"
          />
        )}
      </div>

      {/* Statistics Grid */}
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title={
              <span className="flex items-center gap-1">
                <CloudOutlined />
                Vectors
              </span>
            }
            value={vectorCount}
            suffix={`/ ${(freeLimit / 1000).toFixed(0)}K`}
            valueStyle={{ fontSize: '20px' }}
          />
          <p className="text-xs text-gray-500 mt-1">
            {usage.mongodb.total_chunks} chunks stored
          </p>
        </Col>

        <Col span={8}>
          <Statistic
            title={
              <span className="flex items-center gap-1">
                <DatabaseOutlined />
                Storage
              </span>
            }
            value={usage.summary.storage_breakdown.total_mb.toFixed(2)}
            suffix="MB"
            valueStyle={{ fontSize: '20px' }}
          />
          <p className="text-xs text-gray-500 mt-1">
            {usage.summary.storage_breakdown.pinecone_vectors_mb.toFixed(2)} MB vectors + {' '}
            {usage.summary.storage_breakdown.mongodb_text_mb.toFixed(2)} MB text
          </p>
        </Col>

        <Col span={8}>
          <Statistic
            title={
              <span className="flex items-center gap-1">
                <DollarOutlined />
                Est. Cost
              </span>
            }
            value={usage.summary.estimated_monthly_cost.total.toFixed(2)}
            prefix="$"
            suffix="/mo"
            valueStyle={{ 
              fontSize: '20px',
              color: usage.summary.estimated_monthly_cost.total === 0 ? '#52c41a' : '#1890ff'
            }}
          />
          <p className="text-xs text-gray-500 mt-1">
            {usage.summary.estimated_monthly_cost.total === 0 ? 'Free tier' : 'Starter tier'}
          </p>
        </Col>
      </Row>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-2">
          <InfoCircleOutlined className="text-blue-500 mt-1" />
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">What are vectors?</p>
            <p className="text-xs">
              Each document chunk is converted into a vector (768 numbers) for AI search. 
              More documents = more vectors. Queries are unlimited and free!
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default UsageStats
