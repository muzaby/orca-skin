import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SidebarUserButton } from '../../src/renderer/src/app/SidebarUserButton'
import { MailArchivePage } from '../../src/renderer/src/pages/MailArchivePage'
import { TweakProvider } from '../../src/renderer/src/shared/theme'
import './mail-archive-ui.css'

createRoot(document.getElementById('root')!).render(
  <TweakProvider>
    <MemoryRouter initialEntries={['/mail-archive']}>
      <div className="flex h-full min-w-0 flex-1 bg-bg">
        <div className="flex w-40 shrink-0 flex-col justify-end border-r border-border p-3 max-sm:w-24">
          <SidebarUserButton />
        </div>
        <div className="min-w-0 flex-1">
          <Routes>
            <Route path="/mail-archive" element={<MailArchivePage />} />
          </Routes>
        </div>
      </div>
    </MemoryRouter>
  </TweakProvider>
)
