import { useBackendContext } from '../features/backend'
import { useChatContext } from '../features/chat'
import { useTweakContext } from '../shared/theme'
import { InstallerDialog, AuthExpiredModal } from '../features/backend'
import { RuntimeModal, useRuntimeContext } from '../features/runtime'
import { TweaksPanel, TweakSection, TweakRadio, TweakToggle } from '../shared/ui/TweaksPanel'
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
//   - #app-frame-debug   : 항상 z=30 (TweaksPanel, modal 상태 무관)
export function OverlayLayer({ searchOpen, onCloseSearch }: OverlayLayerProps): React.JSX.Element {
  const { installerOpen, setInstallerOpen, refresh } = useBackendContext()
  const { modalOpen: runtimeModalOpen } = useRuntimeContext()
  const { state, newChat, clearError } = useChatContext()
  const { t, setTweak } = useTweakContext()

  const authExpired = state.error?.code === 'auth.expired'
  const modalActive = installerOpen || authExpired || searchOpen || runtimeModalOpen

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
          onClose={() => setInstallerOpen(false)}
          onComplete={() => {
            setInstallerOpen(false)
            void refresh()
          }}
        />
        <AuthExpiredModal open={authExpired} onNewChat={newChat} onDismiss={clearError} />
        <RuntimeModal />
        {searchOpen && <SearchModal onClose={onCloseSearch} />}
      </div>
      <div id="app-frame-debug" className="pointer-events-none z-30" data-context="debug">
        <div className="pointer-events-auto">
          <TweaksPanel>
            <TweakSection label="테마" />
            <TweakRadio
              label="컬러 팔레트"
              value={t.theme}
              options={[
                { value: 'classic', label: '클래식' },
                { value: 'dark', label: '다크' },
                { value: 'cool', label: '쿨' }
              ]}
              onChange={(v) => setTweak('theme', v)}
            />
            <TweakSection label="레이아웃" />
            <TweakRadio
              label="밀도"
              value={t.density}
              options={[
                { value: 'compact', label: '조밀' },
                { value: 'normal', label: '보통' },
                { value: 'comfortable', label: '넓게' }
              ]}
              onChange={(v) => setTweak('density', v)}
            />
            <TweakToggle
              label="사이드바 접기"
              value={t.sidebarCollapsed}
              onChange={(v) => setTweak('sidebarCollapsed', v)}
            />
          </TweaksPanel>
        </div>
      </div>
    </>
  )
}
