import { create } from 'zustand'
import type { UpdateProgress, UpdateState } from '../../../../../shared/ipc'
import { updateApi } from '../../../shared/api/ipc'

const initialState: UpdateState = {
  status: 'idle',
  currentVersion: __APP_VERSION__,
  canInstall: true
}

interface UpdateStoreState {
  state: UpdateState
  dialogOpen: boolean
  actionError: string | null
}
export const useUpdateStore = create<UpdateStoreState>()(() => ({
  state: initialState,
  dialogOpen: false,
  actionError: null
}))
function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
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
  async check(): Promise<void> {
    try {
      const result = await updateApi.check()
      useUpdateStore.setState({
        state: result.state,
        actionError: result.ok ? null : (result.state.error ?? null)
      })
    } catch (err) {
      useUpdateStore.setState({ actionError: messageFromError(err) })
    }
  },
  async download(): Promise<void> {
    try {
      useUpdateStore.setState({ actionError: null })
      const result = await updateApi.download()
      useUpdateStore.setState({
        state: result.state,
        actionError: result.ok
          ? null
          : (result.state.error ?? '업데이트 다운로드를 시작할 수 없습니다.')
      })
    } catch (err) {
      useUpdateStore.setState({ actionError: messageFromError(err) })
    }
  },
  async quitAndInstall(): Promise<void> {
    try {
      useUpdateStore.setState({ actionError: null })
      const result = await updateApi.quitAndInstall()
      if (!result.ok)
        useUpdateStore.setState({
          actionError: result.message ?? '업데이트 설치를 시작할 수 없습니다.'
        })
    } catch (err) {
      useUpdateStore.setState({ actionError: messageFromError(err) })
    }
  }
}
export async function initUpdate(): Promise<void> {
  try {
    const next = await updateApi.state()
    useUpdateStore.setState({ state: next })
  } catch (err) {
    useUpdateStore.setState({ actionError: messageFromError(err) })
  }
}
export function subscribeUpdate(): () => void {
  const offState = updateApi.onState((state) => useUpdateStore.setState({ state }))
  const offProgress = updateApi.onProgress((progress: UpdateProgress) =>
    useUpdateStore.setState((prev) => ({
      state: { ...prev.state, status: 'downloading', progress }
    }))
  )
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
export function useUpdateActionError(): string | null {
  return useUpdateStore((s) => s.actionError)
}
