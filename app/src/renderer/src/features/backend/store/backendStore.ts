// Zustand backend store — 구 BackendProvider(Context)의 전환(handoff 0013, chat 0008 선례).
// 설치 상태·활성 백엔드·능력 서술자 + 인스톨러 모달 가시성. selector 구독이라 installerOpen
// 토글이 서브트리 전체를 깨우지 않는다.

import { create } from 'zustand'
import type { Backend, BackendListResult, ProviderDescriptor } from '../../../../../shared/ipc'
import { backendApi } from '../../../shared/api/ipc'

interface BackendStoreState {
  list: BackendListResult['backends']
  active: Backend | null
  loading: boolean
  installerOpen: boolean
}

export const useBackendStore = create<BackendStoreState>()(() => ({
  list: [],
  active: null,
  loading: true,
  installerOpen: false
}))

const { setState } = useBackendStore

async function refresh(): Promise<void> {
  const result = await backendApi.list()
  setState({ list: result.backends, active: result.active ?? null, loading: false })
}

export const backendActions = {
  refresh,
  setInstallerOpen: (open: boolean): void => useBackendStore.setState({ installerOpen: open })
}

// 부팅 1회: 설치 상태 조회 + 미설치 시 인스톨러 최초 1회 자동 오픈(구 BackendProvider effect).
export function bootstrapBackend(): () => void {
  let alive = true
  let autoOpened = false
  void backendApi.list().then((result) => {
    if (!alive) return
    setState({ list: result.backends, active: result.active ?? null, loading: false })
    const cc = result.backends.find((b) => b.id === 'claude-code')
    if (cc && !cc.installed && !autoOpened) {
      autoOpened = true
      queueMicrotask(() => {
        if (alive) setState({ installerOpen: true })
      })
    }
  })
  return () => {
    alive = false
  }
}

// ── selector 훅 ──────────────────────────────────────────────────────────────

export function useBackendState<T>(selector: (s: BackendStoreState) => T): T {
  return useBackendStore(selector)
}

export function useInstallerOpen(): boolean {
  return useBackendStore((s) => s.installerOpen)
}

// 활성 백엔드의 능력 서술자 (없으면 null). UI 의 사전 게이팅·지표 소비자가 읽는다(§15).
export function useBackendCapabilities(): ProviderDescriptor | null {
  return useBackendStore((s) => s.list.find((b) => b.id === s.active)?.capabilities ?? null)
}

export function useBackendLabel(): string {
  return useBackendStore((s) => {
    const cc = s.list.find((b) => b.id === 'claude-code')
    return cc?.version ? `Claude Code · ${cc.version}` : 'Claude Code'
  })
}

export function useClaudeCodeInstalled(): boolean {
  return useBackendStore((s) => s.list.find((b) => b.id === 'claude-code')?.installed === true)
}
