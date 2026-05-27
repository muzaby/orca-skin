import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useBackend } from '../hooks/useBackend'

type UseBackendReturn = ReturnType<typeof useBackend>

interface BackendContextValue extends UseBackendReturn {
  installerOpen: boolean
  setInstallerOpen: (open: boolean) => void
  backendLabel: string
  claudeCodeInstalled: boolean
}

const BackendContext = createContext<BackendContextValue | null>(null)

export function BackendProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const backend = useBackend()
  const [installerOpen, setInstallerOpen] = useState(false)
  const autoOpenedRef = useRef(false)

  // 백엔드 탐지 후 미설치 시 인스톨러 노출 — 최초 1회만 자동 오픈.
  useEffect(() => {
    if (backend.loading || autoOpenedRef.current) return
    const cc = backend.list.find((b) => b.id === 'claude-code')
    if (cc && !cc.installed) {
      autoOpenedRef.current = true
      queueMicrotask(() => setInstallerOpen(true))
    }
  }, [backend.loading, backend.list])

  const claudeCode = backend.list.find((b) => b.id === 'claude-code')
  const backendLabel = claudeCode?.version ? `Claude Code · ${claudeCode.version}` : 'Claude Code'
  const claudeCodeInstalled = claudeCode?.installed === true

  return (
    <BackendContext.Provider
      value={{ ...backend, installerOpen, setInstallerOpen, backendLabel, claudeCodeInstalled }}
    >
      {children}
    </BackendContext.Provider>
  )
}

export function useBackendContext(): BackendContextValue {
  const ctx = useContext(BackendContext)
  if (!ctx) throw new Error('useBackendContext must be used within BackendProvider')
  return ctx
}
