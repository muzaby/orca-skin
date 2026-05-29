import { createContext, useContext, useState, type ReactNode } from 'react'
import { useRuntime } from '../hooks/useRuntime'

type UseRuntimeReturn = ReturnType<typeof useRuntime>

interface RuntimeContextValue extends UseRuntimeReturn {
  // 런타임 상태/설정 모달 노출 토글.
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null)

export function RuntimeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const runtime = useRuntime()
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <RuntimeContext.Provider value={{ ...runtime, modalOpen, setModalOpen }}>
      {children}
    </RuntimeContext.Provider>
  )
}

export function useRuntimeContext(): RuntimeContextValue {
  const ctx = useContext(RuntimeContext)
  if (!ctx) throw new Error('useRuntimeContext must be used within RuntimeProvider')
  return ctx
}
