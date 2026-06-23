export { ChatProvider } from './providers/ChatProvider'
export { ChatView } from './components/ChatView'
export { ChatTile } from './components/ChatTile'
export { Composer } from './components/Composer'
// Zustand chat store — 외부(app/pages)는 selector 훅 + 안정 액션 + imperative read 헬퍼로만
// 접근한다 (store 외피는 멀티세션 sessions Record — handoff 0013).
export {
  chatActions,
  getActiveChatSession,
  useChatRecentsEpoch,
  useChatSession
} from './store/chatStore'
