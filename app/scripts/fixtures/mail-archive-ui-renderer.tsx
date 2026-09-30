import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { SidebarUserButton } from '../../src/renderer/src/app/SidebarUserButton'
import { MailArchivePage } from '../../src/renderer/src/pages/MailArchivePage'
import { TweakProvider } from '../../src/renderer/src/shared/theme'
import { PluginsPage } from '../../src/renderer/src/pages/PluginsPage'
import { MailArchivePluginSlot } from '../../src/renderer/src/app/MailArchivePluginSlot'
import { MailArchiveEvidenceBridge } from '../../src/renderer/src/app/MailArchiveEvidenceBridge'
import { Markdown } from '../../src/renderer/src/shared/ui/markdown/Markdown'
import { StreamingMarkdown } from '../../src/renderer/src/features/chat/components/markdown/StreamingMarkdown'
import { useChatStore } from '../../src/renderer/src/features/chat/store/chatStore'
import './mail-archive-ui.css'

// Other session infrastructure is fixture data. Evidence resolution uses the actual active
// chat session selector, internal Markdown callback, preload and trusted production IPC.
useChatStore.setState((state) => ({
  sessions: {
    ...state.sessions,
    [state.activeKey]: {
      ...state.sessions[state.activeKey],
      session: { ...state.sessions[state.activeKey].session, sessionId: 's1' }
    }
  }
}))
export function PluginFixture(): React.JSX.Element {
  const [evidence, setEvidence] = useState('')
  // The native fixture supplies only opaque IDs returned by the actual tool.
  useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (event.data?.type === 'evidence') setEvidence(event.data.id)
      if (event.data?.type === 'session')
        useChatStore.setState((state) => ({
          sessions: {
            ...state.sessions,
            [state.activeKey]: {
              ...state.sessions[state.activeKey],
              session: { ...state.sessions[state.activeKey].session, sessionId: event.data.id }
            }
          }
        }))
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])
  return (
    <>
      <PluginsPage builtinMcp={<MailArchivePluginSlot />} />
      {evidence && (
        <div data-evidence-fixture="" className="p-4">
          <Markdown source={`[완료 근거](#mail-evidence/${evidence})`} />
          <StreamingMarkdown source={`[진행 근거](#mail-evidence/${evidence})`} />
        </div>
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <TweakProvider>
    <MemoryRouter initialEntries={['/mail-archive']}>
      <MailArchiveEvidenceBridge>
        <div className="flex h-full min-w-0 flex-1 bg-bg">
          <div className="flex w-40 shrink-0 flex-col justify-end border-r border-border p-3 max-sm:w-24">
            <SidebarUserButton />
            <Link to="/plugins">플러그인 검사</Link>
          </div>
          <div className="min-w-0 flex-1">
            <Routes>
              <Route path="/mail-archive" element={<MailArchivePage />} />
              <Route path="/plugins" element={<PluginFixture />} />
            </Routes>
          </div>
        </div>
      </MailArchiveEvidenceBridge>
    </MemoryRouter>
  </TweakProvider>
)
