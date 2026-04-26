import { Layout, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Header: AntHeader } = Layout
const { Title } = Typography

const Header = () => {
  const navigate = useNavigate()

  return (
    <AntHeader className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 shadow-xl border-b border-blue-700/20">
      <div className="flex items-center justify-between max-w-7xl mx-auto h-full">
        <div 
          className="flex items-center gap-3 cursor-pointer h-full group transition-all"
          onClick={() => navigate('/workspaces')}
        >
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-all shadow-lg">
            <RobotOutlined className="text-white text-2xl" />
          </div>
          <div>
            <Title level={3} className="!text-white !mb-0 !mt-0 group-hover:text-blue-50 transition-colors">
              AI Assistant
            </Title>
            <p className="text-blue-100 text-xs -mt-1">Powered by AI</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block text-white text-sm font-medium bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
            Intelligent Document Analysis
          </div>
        </div>
      </div>
    </AntHeader>
  )
}

export default Header
