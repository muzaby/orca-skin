import type { Backend } from '../../../shared/ipc'
import type { NativeResource } from '../../../shared/native-resources'

/** Only explicit Orca choices. Native defaults are read by each harness, never copied here. */
export interface ExtensionControl {
  global(backend: Backend): Record<string, boolean>
}

export function extensionChoiceKey(kind: NativeResource['kind'], id: string): string {
  return `${kind}:${id}`
}
