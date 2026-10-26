import '../../src/renderer/src/styles/app.css'
import { createRoot } from 'react-dom/client'
import { LandingProjectPicker } from '../../src/renderer/src/features/chat/components/LandingProjectPicker'
import {
  OpenCodeAgentControl,
  OpenCodeVariantControl
} from '../../src/renderer/src/features/chat/harnesses/opencode/composer/Controls'
import { chatActions } from '../../src/renderer/src/features/chat/store/chatStore'
window.orca = {
  settings: { set: async () => ({}) },
  files: { pickDirectory: async () => null }
} as unknown as Window['orca']
chatActions.newChat(null, 'C:/workspace/orca-skin')
const root = createRoot(document.getElementById('root')!)
const projects = {
  items: [
    { id: 'one', name: 'orca-skin', cwd: 'C:/workspace/orca-skin' },
    { id: 'two', name: '아주 긴 한국어 프로젝트 이름과 추가 설명', cwd: 'D:/projects/long' }
  ],
  loading: false
}
declare global {
  interface Window {
    renderFixture: (
      mode?: 'project' | 'agent',
      status?: 'ready' | 'loading',
      long?: boolean
    ) => void
  }
}
window.renderFixture = (mode = 'project', status = 'ready', long = false): void =>
  root.render(
    <div className="flex w-full flex-col gap-6 p-8 pt-40">
      <div className="text-ink3">
        {mode === 'project' ? '새 대화 · 프로젝트 선택' : 'OpenCode · 에이전트 선택'}
      </div>
      <div className="flex items-center gap-4">
        {mode === 'project' ? (
          <>
            <LandingProjectPicker
              cwd="C:/workspace/orca-skin"
              inflight={false}
              projects={projects}
              variant="flat"
            />
            <button id="next">다음 제어</button>
          </>
        ) : (
          <>
            <OpenCodeAgentControl
              agents={[
                {
                  name: long
                    ? '매우 긴 에이전트 이름으로 메뉴 너비 제한을 확인하는 테스트 에이전트 이름'
                    : 'z-build'
                },
                { name: 'a-review' }
              ]}
              authoritative
              status={status}
            />
            <OpenCodeVariantControl variants={['high']} authoritative status="ready" />
          </>
        )}
      </div>
    </div>
  )
window.renderFixture()
