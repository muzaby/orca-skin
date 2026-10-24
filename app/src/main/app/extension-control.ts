import type { Backend, Settings } from '../../shared/ipc'
import type { ExtensionControl } from '../adapters/common/extension-control'

/** Explicit SDK choices; native configuration remains the baseline for unset keys. */
export interface MutableExtensionControl extends ExtensionControl {
  setGlobal(backend: Backend, key: string, enabled: boolean): void
}
type NativeExtensionChoices = NonNullable<Settings['nativeExtensionChoices']>

export function extensionControl(store?: {
  get(): NativeExtensionChoices | undefined
  set(value: NativeExtensionChoices): void
}): MutableExtensionControl {
  let choices: NativeExtensionChoices = structuredClone(store?.get() ?? {})
  return {
    global: (backend) => ({ ...choices[backend] }),
    setGlobal: (backend, key, enabled) => {
      const next = { ...choices, [backend]: { ...choices[backend], [key]: enabled } }
      store?.set(structuredClone(next))
      choices = next
    }
  }
}
