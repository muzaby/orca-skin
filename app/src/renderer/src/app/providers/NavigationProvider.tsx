import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { SCREENS, type ScreenInfo } from '../screens'
import type { ScreenId } from '../../shared/types/screen'

interface NavParams {
  projectId?: string
}

interface NavigationContextValue {
  current: ScreenId
  info: ScreenInfo
  params: NavParams
  navigate: (screen: ScreenId, params?: NavParams) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [current, setCurrent] = useState<ScreenId>('chat')
  const [params, setParams] = useState<NavParams>({})

  const navigate = useCallback((screen: ScreenId, nextParams: NavParams = {}): void => {
    setCurrent(screen)
    setParams(nextParams)
  }, [])

  const info = SCREENS.find((s) => s.id === current)!

  return (
    <NavigationContext.Provider value={{ current, info, params, navigate }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider')
  return ctx
}
