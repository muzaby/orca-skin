import { backendActions, useInstallerOpen } from '../features/backend'
import { chatActions, useChatSession } from '../features/chat'
import { DebugPanel } from '../features/debug'
import { SsoDebugSection } from '../features/login'
import { InstallerDialog, AuthExpiredModal } from '../features/backend'
import { SearchModal } from './SearchModal'

interface OverlayLayerProps {
  searchOpen: boolean
  onCloseSearch: () => void
}

// 셸의 z-stack 3슬롯 (overlay/modal/debug) 골격. 구 frame/ModalLayer +
// frame/DebugLayer + frame/Frame 의 OverlaySlot/ModalSlot/DebugSlot 를 통합.
// 각 슬롯의 z 부호는 modalActive 에 따라 반전.
//   - #app-frame-overlay : modal 활성 시 z=10 (backdrop), 평소 -z-10
//   - #app-frame-modal   : modal 활성 시 z=20 (focus-trap), 평소 -z-20
//   - #app-frame-debug   : 항상 z=30 (dev DebugPanel, modal 상태 무관)
export function OverlayLayer({ searchOpen, onCloseSearch }: OverlayLayerProps): React.JSX.Element {
  const installerOpen = useInstallerOpen()
  const authExpired = useChatSession((s) => s.error?.category === 'auth_error')
  const modalActive = installerOpen || authExpired || searchOpen

  return (
    <>
      <div
        id="app-frame-overlay"
        className={`bg-black/40 backdrop-blur-sm ${modalActive ? 'z-10' : '-z-10'}`}
        data-state={modalActive ? 'visible' : 'hidden'}
        data-context="overlay"
        aria-hidden
      />
      <div
        id="app-frame-modal"
        className={modalActive ? 'z-20' : '-z-20'}
        data-state={modalActive ? 'visible' : 'hidden'}
        data-behavior="focus-trap blocks-interaction"
        data-context="modal"
      >
        <InstallerDialog
          open={installerOpen}
          onClose={() => backendActions.setInstallerOpen(false)}
          onComplete={() => {
            backendActions.setInstallerOpen(false)
            void backendActions.refresh()
          }}
        />
        <AuthExpiredModal
          open={authExpired}
          onNewChat={chatActions.newChat}
          onDismiss={chatActions.clearError}
        />
        {searchOpen && <SearchModal onClose={onCloseSearch} />}
      </div>
      <div id="app-frame-debug" className="pointer-events-none z-30" data-context="debug">
        <div className="pointer-events-auto">
          {import.meta.env.DEV && <DebugPanel ssoSection={<SsoDebugSection />} />}
        </div>
      </div>
    </>
  )
}
