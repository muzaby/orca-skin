import { isDeepStrictEqual } from 'node:util'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeResource } from '../../../../shared/native-resources'
import { managedChoiceKey, type ExtensionControl } from '../../common/extension-control'
import type {
  ManagedMcpBridgeLease,
  ManagedMcpIdentity,
  ManagedMcpRuntime,
  ManagedMcpSnapshot
} from '../../common/managed-mcp'
import { mapManagedMcpResources, projectManagedMcp } from './managed-mcp'
import { openCodeNativeMcp } from './native-resources'

const definitionVersion = (snapshot?: Readonly<ManagedMcpSnapshot>): number | undefined =>
  snapshot?.definitionRevision ?? snapshot?.revision

/** Each SDK directory owns the alias registrations and the bridge lease used by late additions. */
export class OpenCodeManagedConnections {
  private registeredVersion: number | undefined
  private readonly leases = new Map<string, ManagedMcpBridgeLease>()
  private readonly definitions = new Map<string, unknown>()
  private closed = false
  private readonly unavailable: Map<string, ManagedMcpIdentity>
  readonly identities: Map<string, ManagedMcpIdentity>
  readonly defaults: Record<string, boolean>
  readonly restricted: ReadonlySet<string>
  constructor(
    private readonly scope: {
      defaults: Record<string, boolean>
      restricted: Set<string>
      nativeIds: string[]
    },
    private readonly profile: Record<string, unknown>,
    private readonly runtime?: ManagedMcpRuntime,
    private readonly control?: ExtensionControl,
    snapshot?: ManagedMcpSnapshot,
    initial?: ReturnType<typeof projectManagedMcp>
  ) {
    this.defaults = scope.defaults
    this.restricted = scope.restricted
    this.identities = new Map(initial?.identities)
    this.unavailable = new Map(initial?.collisions)
    this.registeredVersion = definitionVersion(snapshot)
    for (const [alias, identity] of this.identities) {
      this.definitions.set(alias, this.definition(snapshot, identity))
    }
  }

  private definition(
    snapshot: ManagedMcpSnapshot | undefined,
    identity: ManagedMcpIdentity
  ): unknown {
    if (identity.kind === 'user')
      return (snapshot?.definitions ?? snapshot?.users)?.[identity.sourceId]
    const plugin = [...(snapshot?.plugins.values() ?? [])].find(
      (item) => item.identity.sourceId === identity.sourceId
    )
    return plugin && [plugin.server.descriptor, plugin.credentialRevision()]
  }
  dirty(): boolean {
    return !!this.runtime && this.registeredVersion !== definitionVersion(this.runtime.peek())
  }

  choices(): Record<string, boolean> {
    const current = this.runtime?.peek()
    const saved = this.control?.global('opencode') ?? {}
    return Object.fromEntries(
      [...this.identities].map(([alias, identity]) => {
        const selected = saved[managedChoiceKey(identity.kind, identity.sourceId)]
        const enabled =
          identity.kind === 'user'
            ? !!current &&
              Object.hasOwn(current.definitions ?? current.users, identity.sourceId) &&
              (selected ?? Object.hasOwn(current.users, identity.sourceId))
            : selected !== false &&
              !!current &&
              [...current.plugins.values()].some(
                (plugin) => plugin.identity.sourceId === identity.sourceId && plugin.authorized()
              )
        return [alias, enabled && !this.unavailable.has(alias)]
      })
    )
  }

  required(alias: string): boolean {
    const identity = this.identities.get(alias)
    return (
      !!identity &&
      this.control?.global('opencode')[managedChoiceKey(identity.kind, identity.sourceId)] === true
    )
  }

  async refresh(client: OpencodeClient, directory: string, signal: AbortSignal): Promise<void> {
    const current = this.runtime?.snapshot()
    if (!current || !this.runtime || !this.dirty()) return
    const bridge = await this.runtime.acquire(current)
    const candidates = new Set([...this.leases.values(), bridge])
    try {
      const observed = await openCodeNativeMcp(client, directory, signal)
      const next = projectManagedMcp(current, bridge, this.profile, this.scope.nativeIds, true)
      this.unavailable.clear()
      for (const [alias, identity] of next.collisions) this.unavailable.set(alias, identity)
      for (const alias of this.definitions.keys()) {
        if (!next.identities.has(alias)) {
          this.definitions.delete(alias)
          this.leases.delete(alias)
        }
      }
      // The SDK stores add() in the directory instance. No config file or server restart is needed.
      for (const [alias, identity] of next.identities) {
        const definition = this.definition(current, identity)
        if (
          isDeepStrictEqual(definition, this.definitions.get(alias)) &&
          observed.some((item) => item.id === alias)
        )
          continue
        const occupied = observed.some(
          (item) =>
            item.id.replace(/[^a-zA-Z0-9_-]/g, '_') === alias && !this.identities.has(item.id)
        )
        if (occupied || typeof client.mcp.add !== 'function') {
          this.unavailable.set(alias, identity)
          continue
        }
        const result = await client.mcp.add(
          {
            name: alias,
            directory,
            config: next.registrations.get(alias)!
          },
          { signal, throwOnError: false }
        )
        signal.throwIfAborted()
        if ([404, 405, 501].includes(result.response.status)) {
          this.unavailable.set(alias, identity)
          continue
        }
        if (
          !result.data ||
          !(await openCodeNativeMcp(client, directory, signal)).some((item) => item.id === alias)
        ) {
          throw new Error('추가한 MCP의 등록 상태를 확인하지 못했습니다. 다시 시도해 주세요.')
        }
        this.identities.set(alias, identity)
        this.definitions.set(alias, definition)
        if (identity.kind === 'builtin') this.leases.set(alias, bridge)
      }
      this.registeredVersion = definitionVersion(current)
    } finally {
      const retained = new Set(this.closed ? [] : this.leases.values())
      await Promise.all(
        [...candidates].filter((lease) => !retained.has(lease)).map((lease) => lease.release())
      )
    }
  }

  map(items: NativeResource[]): NativeResource[] {
    return [
      ...mapManagedMcpResources(
        items.filter((item) => !item.id.startsWith('unregistered:') || !item.managedSource),
        this.identities
      ),
      ...[...this.unavailable].map(([alias, identity]): NativeResource => ({
        id: 'unregistered:' + alias,
        name: identity.name,
        kind: 'mcp',
        status: 'disabled',
        enabled: false,
        origin: 'orcinus-orca',
        managedSource: { kind: identity.kind, sourceId: identity.sourceId },
        canToggle: false,
        controlReason: '이 세션에 등록되지 않은 MCP입니다.'
      }))
    ]
  }

  async release(): Promise<void> {
    this.closed = true
    await Promise.all([...new Set(this.leases.values())].map((lease) => lease.release()))
    this.leases.clear()
  }
}
