import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout, App as AntApp } from 'antd'
import WorkspaceList from './pages/WorkspaceList'
import WorkspaceDetail from './pages/WorkspaceDetail'
import Header from './components/Header'

const { Content } = Layout

function App() {
  return (
    <AntApp>
      <Router>
        <Layout className="min-h-screen">
          <Header />
          <Content className="bg-gray-50">
            <Routes>
              <Route path="/" element={<Navigate to="/workspaces" replace />} />
              <Route path="/workspaces" element={<WorkspaceList />} />
              <Route path="/workspaces/:workspaceId" element={<WorkspaceDetail />} />
            </Routes>
          </Content>
        </Layout>
      </Router>
    </AntApp>
  )
}

export default App
