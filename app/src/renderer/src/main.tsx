import './styles/app.css'
// i18next 동기 초기화(0096) — 첫 렌더 전에 카탈로그가 준비돼야 한다.
import './shared/i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerGlobalErrorHandlers, connectMainErrorReports } from './shared/errors'
import { startLongTaskReporter } from './shared/perf/longTaskReporter'

// 전역 미처리 에러 → main 로그 인제스트 (0123). 첫 렌더 전에 등록해 부트 실패도 잡는다.
registerGlobalErrorHandlers()
void connectMainErrorReports()
// 메인 스레드의 50ms 이상 작업을 `perf.stall` 로 남긴다 (0324 AC7).
startLongTaskReporter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
