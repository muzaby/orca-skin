import { useBackendContext } from '../app/providers/BackendProvider'
import { useChatContext } from '../app/providers/ChatProvider'
import { OverlaySlot, ModalSlot } from './Frame'
import { InstallerDialog } from './modal/InstallerDialog'
import { AuthExpiredModal } from './modal/AuthExpiredModal'

// OverlaySlot + ModalSlot 을 하나의 레이어로 묶는다.
// BackendContext + ChatContext 에서 직접 modal 상태를 읽어 App.tsx 에서 상태 전달 불요.
export function ModalLayer(): React.JSX.Element {
  const { installerOpen, setInstallerOpen, refresh } = useBackendContext()
  const { state, newChat, clearError } = useChatContext()
  const authExpired = state.error?.code === 'auth.expired'
  const anyModalOpen = installerOpen || authExpired

  return (
    <>
      <OverlaySlot modalActive={anyModalOpen} />
      <ModalSlot modalActive={anyModalOpen}>
        <InstallerDialog
          open={installerOpen}
          onClose={() => setInstallerOpen(false)}
          onComplete={() => {
            setInstallerOpen(false)
            void refresh()
          }}
        />
        <AuthExpiredModal
          open={authExpired}
          onNewChat={newChat}
          onDismiss={clearError}
        />
      </ModalSlot>
    </>
  )
}
