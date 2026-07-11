import { create } from 'zustand'
import type { UpdateProgress, UpdateState } from '../../../../../shared/ipc'
import { updateApi } from '../../../shared/api/ipc'
import type { UiMessage } from '../../../shared/i18n'

const initialState: UpdateState = {
  status: 'idle',
  currentVersion: __APP_VERSION__,
  canInstall: true
}

interface UpdateStoreState {
  state: UpdateState
  dialogOpen: boolean
  // 카탈로그 키(폴백) 또는 백엔드/예외 원문 — 렌더(UpdateDialog)에서 uiMessageText 로 해석.
  actionError: UiMessage | null
  // dev 전용 더미 업데이트 스위치. true 면 헤더 버튼/뱃지를 실제 서버 없이 재현하고
  // download/quitAndInstall 이 실 IPC 대신 mock 흐름으로 분기한다. status 파생 UI(헤더
  // 버튼·파란 뱃지)는 dummyMode 를 직접 보지 않고 state.status 만 본다(실·더미 동일).
  dummyMode: boolean
}
export const useUpdateStore = create<UpdateStoreState>()(() => ({
  state: initialState,
  dialogOpen: false,
  actionError: null,
  dummyMode: false
}))
function messageFromError(err: unknown): UiMessage {
  return { raw: err instanceof Error ? err.message : String(err) }
}

// ── dev 더미 업데이트 mock (실제 electron-updater 미개입) ──────────────────
// status `available` 을 주입해 실 릴리스 감지와 동일한 UI 를 띄운다.
const DUMMY_AVAILABLE: UpdateState = {
  status: 'available',
  currentVersion: __APP_VERSION__,
  availableVersion: '9.9.9-dummy',
  releaseNotes: '더미 업데이트(디버그) — 실제 다운로드/설치는 수행하지 않습니다.',
  canInstall: true
}
let dummyTimer: ReturnType<typeof setInterval> | null = null
let dummyTimeout: ReturnType<typeof setTimeout> | null = null
function clearDummyTimers(): void {
  if (dummyTimer) {
    clearInterval(dummyTimer)
    dummyTimer = null
  }
  if (dummyTimeout) {
    clearTimeout(dummyTimeout)
    dummyTimeout = null
  }
}
export const updateActions = {
  openDialog(): void {
    useUpdateStore.setState({ dialogOpen: true, actionError: null })
  },
  closeDialog(): void {
    const status = useUpdateStore.getState().state.status
    if (status === 'downloading' || status === 'installing') return
    useUpdateStore.setState({ dialogOpen: false, actionError: null })
  },
  // dev 더미 업데이트 토글. on → mock `available` 주입, off → 초기 상태 복원.
  setDummy(enabled: boolean): void {
    clearDummyTimers()
    if (enabled) {
      useUpdateStore.setState({ dummyMode: true, state: DUMMY_AVAILABLE, actionError: null })
    } else {
      useUpdateStore.setState({
        dummyMode: false,
        state: initialState,
        dialogOpen: false,
        actionError: null
      })
    }
  },
  async check(): Promise<void> {
    try {
      const result = await updateApi.check()
      useUpdateStore.setState({
        state: result.state,
        actionError: result.ok || !result.state.error ? null : { raw: result.state.error }
      })
    } catch (err) {
      useUpdateStore.setState({ actionError: messageFromError(err) })
    }
  },
  async download(): Promise<void> {
    // 더미 모드: 실 IPC 대신 진행바 0→100% 를 흉내내고 ready 로 전환.
    if (useUpdateStore.getState().dummyMode) {
      clearDummyTimers()
      useUpdateStore.setState((prev) => ({
        actionError: null,
        state: { ...prev.state, status: 'downloading', progress: { percent: 0 } }
      }))
      dummyTimer = setInterval(() => {
        const prev = useUpdateStore.getState().state
        const percent = Math.min(100, Math.round((prev.progress?.percent ?? 0) + 10))
        if (percent >= 100) {
          clearDummyTimers()
          useUpdateStore.setState({ state: { ...DUMMY_AVAILABLE, status: 'ready' } })
        } else {
          useUpdateStore.setState({
            state: { ...prev, status: 'downloading', progress: { percent } }
          })
        }
      }, 200)
      return
    }
    try {
      useUpdateStore.setState({ actionError: null })
      const result = await updateApi.download()
      useUpdateStore.setState({
        state: result.state,
        actionError: result.ok
          ? null
          : result.state.error
            ? { raw: result.state.error }
            : { key: 'errors.updateDownloadFailed' }
      })
    } catch (err) {
      useUpdateStore.setState({ actionError: messageFromError(err) })
    }
  },
  async quitAndInstall(): Promise<void> {
    // 더미 모드: 앱을 실제로 종료하지 않고 installing 을 잠깐 보인 뒤 리셋(설치 완료 mock).
    if (useUpdateStore.getState().dummyMode) {
      clearDummyTimers()
      useUpdateStore.setState((prev) => ({
        actionError: null,
        state: { ...prev.state, status: 'installing' }
      }))
      dummyTimeout = setTimeout(() => {
        updateActions.setDummy(false)
      }, 800)
      return
    }
    try {
      useUpdateStore.setState({ actionError: null })
      const result = await updateApi.quitAndInstall()
      if (!result.ok)
        useUpdateStore.setState({
          actionError: result.message
            ? { raw: result.message }
            : { key: 'errors.updateInstallFailed' }
        })
    } catch (err) {
      useUpdateStore.setState({ actionError: messageFromError(err) })
    }
  }
}
export async function initUpdate(): Promise<void> {
  // 더미 모드가 켜져 있으면 실 IPC 상태가 mock 을 덮어쓰지 않게 skip.
  if (useUpdateStore.getState().dummyMode) return
  try {
    const next = await updateApi.state()
    if (useUpdateStore.getState().dummyMode) return
    useUpdateStore.setState({ state: next })
  } catch (err) {
    useUpdateStore.setState({ actionError: messageFromError(err) })
  }
}
export function subscribeUpdate(): () => void {
  const offState = updateApi.onState((state) => {
    if (useUpdateStore.getState().dummyMode) return
    useUpdateStore.setState({ state })
  })
  const offProgress = updateApi.onProgress((progress: UpdateProgress) => {
    if (useUpdateStore.getState().dummyMode) return
    useUpdateStore.setState((prev) => ({
      state: { ...prev.state, status: 'downloading', progress }
    }))
  })
  return () => {
    offState()
    offProgress()
  }
}
export function useUpdateState(): UpdateState {
  return useUpdateStore((s) => s.state)
}
export function useUpdateDialogOpen(): boolean {
  return useUpdateStore((s) => s.dialogOpen)
}
export function useUpdateActionError(): UiMessage | null {
  return useUpdateStore((s) => s.actionError)
}
export function useUpdateDummy(): boolean {
  return useUpdateStore((s) => s.dummyMode)
}
