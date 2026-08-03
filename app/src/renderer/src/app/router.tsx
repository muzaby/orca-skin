import { Navigate, Route, Routes } from 'react-router-dom'
import { ChatPage } from '../pages/ChatPage'
import { NewChatLandingPage } from '../pages/NewChatLandingPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { ProjectLandingPage } from '../pages/ProjectLandingPage'
import { AgentPage } from '../pages/AgentPage'
import { PluginsPage } from '../pages/PluginsPage'
import { CapturesPage } from '../pages/CapturesPage'
import { BootRedirector } from './BootRedirector'
import { LEGACY_ROUTE_REDIRECTS } from '../shared/navigation/routes'

// path 라우팅의 진실의 출처. 화면 ID → element 매핑.
// - `/`         : BootRedirector — lastSessionId 가 있으면 /chat/<id>, 없으면 /new 로 replace
// - `/new`      : 빈 새 대화 (ChatPage, sessionId 없음)
// - `/chat`     : /new 로 redirect (trailing slash 도 react-router 가 정규화)
// - `/chat/:sessionId` : ChatPage (useParams 로 sessionId 획득 → useChatRouteSync 가 로드)
// - `/projects` : 프로젝트 목록
// - `/projects/:projectId` : ProjectLandingPage
// - 그 외       : `/new` 로 fallback
export function AppRouter(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<BootRedirector />} />
      <Route path="/new" element={<NewChatLandingPage />} />
      <Route path="/chat" element={<Navigate to="/new" replace />} />
      <Route path="/chat/:sessionId" element={<ChatPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:projectId" element={<ProjectLandingPage />} />
      <Route path="/agent" element={<AgentPage />} />
      <Route path="/plugins" element={<PluginsPage />} />
      {Object.entries(LEGACY_ROUTE_REDIRECTS).map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
      <Route path="/captures" element={<CapturesPage />} />
      <Route path="*" element={<Navigate to="/new" replace />} />
    </Routes>
  )
}
