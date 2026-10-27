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
  resolver(): Resolver
  plugins(): readonly ManagedMcpPlugin[]
  unresolved?(name: string): void
}): ManagedMcpSource {
  let revision = 0
  let fingerprint: string | undefined
  let droppedFingerprint: string | undefined
  let current: ManagedMcpSnapshot = { revision, users: {}, plugins: new Map() }
  const listeners = new Set<(revision: number) => void>()
  const refresh = (): void => {
    const resolved = resolveMcpConfig(input.users(), input.resolver())
    const dropped = JSON.stringify(resolved.dropped.map((entry) => entry.name))
    if (dropped !== droppedFingerprint) {
      droppedFingerprint = dropped
      for (const entry of resolved.dropped) input.unresolved?.(entry.name)
    }
    const users = resolved.config
    const plugins = input
      .plugins()
      .filter(
        (entry) => entry.server.descriptor.executionScope === 'application' && entry.authorized()
      )
    const next = createHash('sha256')
      .update(
        JSON.stringify([
          users,
          plugins.map((entry) => [
            entry.identity,
            entry.server.descriptor,
            entry.credentialRevision()
          ])
        ])
      )
      .digest('hex')
    if (next === fingerprint) return
    fingerprint = next
    current = {
      revision: ++revision,
      users,
      plugins: new Map(plugins.map((entry) => [entry.server.descriptor.id, entry]))
    }
    for (const listener of listeners) listener(revision)
  }
  return {
    refresh,
    snapshot: () => ({
      ...current,
      users: structuredClone(current.users),
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
