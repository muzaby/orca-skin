import type { Backend } from '../../../shared/ipc'
import type { NativeResource } from '../../../shared/native-resources'

/** Only explicit Orcinus orca choices. Native defaults are read by each harness, never copied here. */
export interface ExtensionControl {
  deploymentRevision?(): number
  global(backend: Backend): Record<string, boolean>
}

export function extensionChoiceKey(kind: NativeResource['kind'], id: string): string {
  return `${kind}:${id}`
}

export function managedChoiceKey(kind: 'builtin' | 'user', sourceId: string): string {
  return `managed:${kind}:${sourceId}`
}

export function resourceChoiceKey(item: NativeResource): string {
  return item.managedSource
    ? managedChoiceKey(item.managedSource.kind, item.managedSource.sourceId)
    : extensionChoiceKey(item.kind, item.name)
}

export function extensionChoices(
  choices: Record<string, boolean>,
  kind: NativeResource['kind']
): Record<string, boolean> {
  const prefix = `${kind}:`
  return Object.fromEntries(
    Object.entries(choices)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value])
  )
}
