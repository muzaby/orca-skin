import './styles/app.css'
// i18next 동기 초기화(0096) — 첫 렌더 전에 카탈로그가 준비돼야 한다.
import './shared/i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerGlobalErrorLogging } from './shared/logging'

// 전역 미처리 에러 → main 로그 인제스트 (0123). 첫 렌더 전에 등록해 부트 실패도 잡는다.
registerGlobalErrorLogging()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
