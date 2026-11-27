import type { Backend, Settings } from '../../shared/ipc'
import type { ExtensionControl } from '../adapters/common/extension-control'

export interface MutableExtensionControl extends ExtensionControl {
  setGlobal(backend: Backend, key: string, enabled: boolean): Promise<void> | void
}
type NativeExtensionChoices = NonNullable<Settings['nativeExtensionChoices']>

export function extensionControl(store?: {
  deploymentRevision?(): number
  get(): NativeExtensionChoices | undefined
  setChoice(backend: Backend, key: string, enabled: boolean): Promise<unknown> | void
}): MutableExtensionControl {
  const memory: NativeExtensionChoices = {}
  return {
    deploymentRevision: store?.deploymentRevision,
    global: (backend) => ({ ...(store ? store.get() : memory)?.[backend] }),
    setGlobal: async (backend, key, enabled) => {
      if (store) await store.setChoice(backend, key, enabled)
      else memory[backend] = { ...memory[backend], [key]: enabled }
    }
  }
}
