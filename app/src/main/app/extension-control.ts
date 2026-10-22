import type { Backend } from '../../shared/ipc'
import type { ExtensionControl } from '../adapters/common/extension-control'

/** Process-local SDK choices; native configuration remains the startup baseline. */
export interface MutableExtensionControl extends ExtensionControl {
  setGlobal(backend: Backend, key: string, enabled: boolean): void
}
export function extensionControl(): MutableExtensionControl {
  const choices = new Map<Backend, Record<string, boolean>>()
  return {
    global: (backend) => ({ ...choices.get(backend) }),
    setGlobal: (backend, key, enabled) => {
      choices.set(backend, { ...choices.get(backend), [key]: enabled })
    }
  }
}
