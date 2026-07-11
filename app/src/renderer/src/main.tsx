import './styles/app.css'
// i18next 동기 초기화(0096) — 첫 렌더 전에 카탈로그가 준비돼야 한다.
import './shared/i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
