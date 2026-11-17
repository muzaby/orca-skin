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
  // 정본이 다른 곳에서 바뀌었다(설정 사본 교체·패치) — 다음 읽기에서 다시 가져온다.
  onChanged?(listener: () => void): void
}): MutableExtensionControl {
  // 처음 읽을 때 가져온다. 정본이 다른 프로세스에 있으면 만드는 시점에는 아직 없다 — 에이전트 호스트의
  // 설정 사본은 준비를 알린 뒤 피어 포트로 온다(0324 EP-17).
  let choices: NativeExtensionChoices | null = null
  const current = (): NativeExtensionChoices => (choices ??= structuredClone(store?.get() ?? {}))
  store?.onChanged?.(() => {
    choices = null
  })
  return {
    global: (backend) => ({ ...current()[backend] }),
    setGlobal: (backend, key, enabled) => {
      const base = current()
      const next = { ...base, [backend]: { ...base[backend], [key]: enabled } }
      store?.set(structuredClone(next))
      choices = next
    }
  }
}
