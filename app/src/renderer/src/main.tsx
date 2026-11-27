import './styles/app.css'
// i18next 동기 초기화(0096) — 첫 렌더 전에 카탈로그가 준비돼야 한다.
import './shared/i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { rootElement } from './app/rootElement'
import { installOo } from './shared/api/transport/install'
import { registerGlobalErrorHandlers, connectMainErrorReports } from './shared/errors'
import { startLongTaskReporter } from './shared/perf/longTaskReporter'

// preload 다리 위에 `window.oo` 를 만든다 (0324 D-058). 다리가 없으면 실패 화면을 그린다(D-059).
// 첫 실행 문이다 — 아래 렌더 전 단계와 첫 렌더는 모두 `window.oo` 뒤에 돈다(0324 EP-30).
const install = installOo()

// 전역 미처리 에러 → main 로그 인제스트 (0123). 첫 렌더 전에 등록해 부트 실패도 잡는다.
registerGlobalErrorHandlers()
void connectMainErrorReports()
// 메인 스레드의 50ms 이상 작업을 `perf.stall` 로 남긴다 (0324 AC7).
startLongTaskReporter()

if (import.meta.env.VITE_OO_DIAGNOSTIC === '1') {
  void import('./features/chat/dev/transcriptFixtures').then(({ installTranscriptDevTools }) =>
    installTranscriptDevTools()
  )
}

createRoot(document.getElementById('root')!).render(
  rootElement(
    install,
    <StrictMode>
      <App />
    </StrictMode>
  )
)
