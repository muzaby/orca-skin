import { createHash } from 'node:crypto'
import type { Resolver } from '../../../../infra/vars'
import type { OrcaMcpConfig } from '../../../../adapters/common/mcp-config'
import type {
  ManagedMcpPlugin,
  ManagedMcpSnapshot,
  ManagedMcpSource
} from '../../../../adapters/common/managed-mcp'
import { resolveMcpConfig } from './resolve'

export function createManagedMcpSource(input: {
  users(): OrcaMcpConfig
  definitions?(): { definitions: OrcaMcpConfig; desired: Record<string, boolean> }
  resolver(): Resolver
  plugins(): readonly ManagedMcpPlugin[]
  unresolved?(name: string): void
}): ManagedMcpSource {
  let revision = 0
  let fingerprint: string | undefined
  let definitionFingerprint: string | undefined
  let definitionRevision = 0
  let connectionRevision = 0
  let droppedFingerprint: string | undefined
  let current: ManagedMcpSnapshot = { revision, users: {}, plugins: new Map() }
  const listeners = new Set<(revision: number, kind: 'definitions' | 'connections') => void>()
  const refresh = (): void => {
    const all = input.definitions?.()
    const resolved = resolveMcpConfig(all?.definitions ?? input.users(), input.resolver())
    const dropped = JSON.stringify(resolved.dropped.map((entry) => entry.name))
    if (dropped !== droppedFingerprint) {
      droppedFingerprint = dropped
      for (const entry of resolved.dropped) input.unresolved?.(entry.name)
    }
    const definitions = resolved.config
    const desired =
      all?.desired ?? Object.fromEntries(Object.keys(definitions).map((id) => [id, true]))
    const users = Object.fromEntries(Object.entries(definitions).filter(([id]) => desired[id]))
    const plugins = input
      .plugins()
      .filter(
        (entry) => entry.server.descriptor.executionScope === 'application' && entry.authorized()
      )
    const definition = createHash('sha256')
      .update(
        JSON.stringify([
          definitions,
          plugins.map((entry) => [
            entry.identity,
            entry.server.descriptor,
            entry.credentialRevision()
          ])
        ])
      )
      .digest('hex')
    const next = createHash('sha256')
      .update(JSON.stringify([definition, desired]))
      .digest('hex')
    if (next === fingerprint) return
    const kind = definition !== definitionFingerprint ? 'definitions' : 'connections'
    if (kind === 'definitions') definitionRevision++
    connectionRevision++
    definitionFingerprint = definition
    fingerprint = next
    current = {
      revision: ++revision,
      definitionRevision,
      connectionRevision,
      definitions,
      desired,
      users,
      plugins: new Map(plugins.map((entry) => [entry.server.descriptor.id, entry]))
    }
    for (const listener of listeners) listener(revision, kind)
  }
  return {
    refresh,
    snapshot: () => ({
      ...current,
      users: structuredClone(current.users),
      definitions: structuredClone(current.definitions),
      desired: structuredClone(current.desired),
      plugins: new Map(current.plugins)
    }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
