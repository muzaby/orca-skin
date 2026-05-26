import { createContext, useContext, type ReactNode } from 'react'
import { useSessions } from '../../state/useSessions'

type UseSessionsReturn = ReturnType<typeof useSessions>

const SessionsContext = createContext<UseSessionsReturn | null>(null)

export function SessionsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const sessions = useSessions()
  return <SessionsContext.Provider value={sessions}>{children}</SessionsContext.Provider>
}

export function useSessionsContext(): UseSessionsReturn {
  const ctx = useContext(SessionsContext)
  if (!ctx) throw new Error('useSessionsContext must be used within SessionsProvider')
  return ctx
}
