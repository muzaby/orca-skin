import { useEffect, type ReactNode } from 'react'
import { initUpdate, subscribeUpdate } from '../store/updateStore'
export function UpdateProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => {
    const unsubscribe = subscribeUpdate()
    void initUpdate()
    return unsubscribe
  }, [])
  return <>{children}</>
}
