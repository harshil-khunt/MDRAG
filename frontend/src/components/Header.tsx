import { Layout, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Header: AntHeader } = Layout
const { Title } = Typography

const Header = () => {
  const navigate = useNavigate()

  return (
    <AntHeader className="bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg">
      <div className="flex items-center justify-between max-w-7xl mx-auto h-full">
        <div 
          className="flex items-center gap-3 cursor-pointer h-full"
          onClick={() => navigate('/workspaces')}
        >
          <RobotOutlined className="text-white text-3xl" />
          <Title level={3} className="!text-white !mb-0 !mt-0">
            AI Assistant
          </Title>
        </div>
        <div className="text-white text-sm">
          Intelligent Document & URL Analysis
        </div>
      </div>
    </AntHeader>
  )
}

export default Header
