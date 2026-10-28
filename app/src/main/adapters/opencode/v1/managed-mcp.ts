import { createHash } from 'node:crypto'
import type {
  ManagedMcpBridgeLease,
  ManagedMcpIdentity,
  ManagedMcpSnapshot
} from '../../common/managed-mcp'
import type { NativeResource } from '../../../../shared/native-resources'
import { isRecord } from '../../../../shared/obj'

export function managedMcpAlias(kind: ManagedMcpIdentity['kind'], sourceId: string): string {
  return `orca_${kind === 'builtin' ? 'b' : 'u'}_${createHash('sha256').update(`${kind}:${sourceId}`).digest('hex').slice(0, 12)}`
}

export function projectManagedMcp(
  snapshot: ManagedMcpSnapshot,
  bridgeLease: ManagedMcpBridgeLease,
  config: Record<string, unknown>,
  nativeIds: readonly string[] = []
): {
  config: Record<string, unknown>
  env: Record<string, string>
  identities: ReadonlyMap<string, ManagedMcpIdentity>
  failures: { sourceId: string; reason: 'identity-collision' }[]
} {
  const mcp = { ...(isRecord(config.mcp) ? config.mcp : {}) }
  const identities = new Map<string, ManagedMcpIdentity>()
  const env: Record<string, string> = {}
  const failures: { sourceId: string; reason: 'identity-collision' }[] = []
  const normalize = (id: string): string => id.replace(/[^a-zA-Z0-9_-]/g, '_')
  const occupied = new Set([...nativeIds, ...Object.keys(mcp)].map(normalize))
  const add = (
    identity: ManagedMcpIdentity,
    entry: (value: (text: string) => string) => unknown
  ): void => {
    const alias = managedMcpAlias(identity.kind, identity.sourceId)
    if (occupied.has(normalize(alias))) {
      failures.push({ sourceId: identity.sourceId, reason: 'identity-collision' })
      return
    }
    occupied.add(normalize(alias))
    let sequence = 0
    const value = (text: string): string => {
      const key = `ORCA_MCP_${alias}_${sequence++}`
      // OpenCode substitutes into JSONC text before parsing. Preserve Windows paths,
      // quotes and newlines, and prevent values from becoming native file/env templates.
      env[key] = JSON.stringify(text)
        .slice(1, -1)
        .replaceAll('{', '\\u007b')
        .replaceAll('}', '\\u007d')
      return `{env:${key}}`
    }
    identities.set(alias, {
      ...identity,
      mentionId:
        identity.kind === 'user' ||
        nativeIds.includes(identity.mentionId) ||
        Object.hasOwn(mcp, identity.mentionId)
          ? alias
          : identity.mentionId
    })
    mcp[alias] = entry(value)
  }
  for (const [name, server] of Object.entries(snapshot.definitions ?? snapshot.users)) {
    add({ kind: 'user', sourceId: name, name, mentionId: '' }, (value) =>
      'url' in server
        ? {
            type: 'remote',
            url: value(server.url),
            headers: Object.fromEntries(
              Object.entries(server.headers ?? {}).map(([key, text]) => [key, value(text)])
            ),
            oauth: false,
            enabled: false
          }
        : {
            type: 'local',
            command: [server.command, ...(server.args ?? [])].map(value),
            environment: Object.fromEntries(
              Object.entries(server.env ?? {}).map(([key, text]) => [key, value(text)])
            ),
            enabled: false
          }
    )
  }
  for (const [id, plugin] of snapshot.plugins) {
    const endpoint = bridgeLease.endpoints.get(id)
    if (!endpoint) throw new Error('Orca MCP 연결을 준비하지 못했습니다.')
    add(plugin.identity, (value) => ({
      type: 'remote',
      url: value(endpoint.url),
      headers: { Authorization: value(`Bearer ${endpoint.token}`) },
      oauth: false,
      enabled: false
    }))
  }
  return { config: { ...config, mcp }, env, identities, failures }
}

export function mapManagedMcpResources(
  items: NativeResource[],
  identities: ReadonlyMap<string, ManagedMcpIdentity>
): NativeResource[] {
  return items.map((item) => {
    const source = item.kind === 'mcp' && identities.get(item.id)
    return source
      ? {
          ...item,
          name: source.name,
          origin: 'orca',
          managedSource: { kind: source.kind, sourceId: source.sourceId },
          mentionId: source.mentionId,
          canToggle: false,
          canOpen: false
        }
      : item
  })
}
