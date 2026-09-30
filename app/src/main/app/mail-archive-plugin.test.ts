import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { warmFileSqlite } from '../infra/db/warm-file-sqlite'
import { RuntimeToolRegistry } from '../features/extensions/runtime-tool-registry'
import { adaptRuntimeTools } from '../adapters/claude-runtime-tools'
import type {
  RuntimeToolContext,
  RuntimeToolResult,
  RuntimeToolImplementation
} from '../adapters/runtime-tools'
import {
  createMailArchiveStore,
  type MailArchiveStore
} from '../features/plugins/mail-archive/store'
import {
  createMailArchiveToolServer,
  initializeMailArchivePlugin,
  type MailArchivePlugin
} from '../features/plugins/mail-archive/plugin'
import { createArchiveToolServer, archivePluginRpc } from '../features/plugins/mail-archive/tools'
import {
  archiveBodySpan,
  archiveRelevantSpan
} from '../features/plugins/mail-archive/context-packing'
import { archiveMailIdentityKey, archiveSourceId } from '../features/plugins/mail-archive/identity'
import type { NormalizedArchiveMail } from '../features/plugins/mail-archive/types'
import type { MailArchiveService } from '../features/plugins/mail-archive/service'
import type { ArchiveEvidence } from '../../shared/mail-archive-plugin'
import {
  ARCHIVE_MCP_SERVER_ID,
  ARCHIVE_MCP_TOOLS,
  ARCHIVE_MCP_MAX_BYTES
} from '../../shared/mail-archive-plugin'

const cleanup: (() => Promise<void>)[] = []
beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn()
})
function mail(
  path: string,
  key: string,
  overrides: Partial<Omit<NormalizedArchiveMail, 'identityKey'>> = {}
): NormalizedArchiveMail {
  const value: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceId: archiveSourceId('pst', path),
    sourceKind: 'pst',
    sourcePath: path,
    sourceFingerprint: 'one',
    itemKey: key,
    folderPath: 'Inbox',
    sentAt: 1700000000000,
    from: 'sender@test',
    to: 'reader@test',
    cc: '',
    subject: `question ${key}`,
    bodyText: `Question approved ${key}.\nA precise paragraph 📮.`,
    bodyKind: 'plain',
    bodyAlternateText: null,
    bodyAlternateKind: null,
    bodyAlternateOmitted: false,
    bodyQualityFlags: [],
    bodySelectionReason: 'plain_preferred',
    messageId: `<${key}@test>`,
    inReplyTo: null,
    references: null,
    threadKey: `<${key}@test>`,
    sizeBytes: 100,
    attachments: [
      { name: 'ATTACHMENT-SENTINEL.bin', mimeType: 'application/octet-stream', sizeBytes: 12 }
    ],
    ...overrides
  }
  return { ...value, identityKey: archiveMailIdentityKey(value) }
}
function add(
  store: MailArchiveStore,
  path: string,
  mails: NormalizedArchiveMail[],
  fingerprint = 'one'
): void {
  const sourceId = archiveSourceId('pst', path)
  const revision = store.beginRevision({
    sourceId,
    sourcePath: path,
    sourceKind: 'pst',
    fingerprint
  })
  store.upsertBatch({ sourceId, revision: revision.revision, mails })
  store.verifyRevision(sourceId, revision.revision, fingerprint)
}
async function fixture(): Promise<{
  store: MailArchiveStore
  root: string
  service: MailArchiveService
  plugin: MailArchivePlugin
  registry: RuntimeToolRegistry
  sessions: Set<string>
}> {
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-plugin-'))
  const store = createMailArchiveStore(root)
  cleanup.push(async () => {
    store.close()
    await rm(root, { recursive: true, force: true })
  })
  const sessions = new Set(['s1', 's2'])
  const registry = new RuntimeToolRegistry()
  const service = {
    pluginRequest: async (input) => store.pluginRequest(input),
    stats: async () => store.stats()
  } as MailArchiveService
  const plugin = initializeMailArchivePlugin(
    service,
    (id) => sessions.has(id),
    () => [...sessions],
    () => registry.snapshot().servers.has(ARCHIVE_MCP_SERVER_ID)
  )
  cleanup.push(async () => plugin.close())
  await plugin.ready()
  return { store, root, service, plugin, registry, sessions }
}
function context(sessionId = 's1', signal = new AbortController().signal): RuntimeToolContext {
  return {
    cwd: 'C:/work',
    extraDirs: [],
    getSignal: () => signal,
    waitForSession: async () => sessionId
  }
}
function tool(name: (typeof ARCHIVE_MCP_TOOLS)[number]): RuntimeToolImplementation {
  return createMailArchiveToolServer().implementations.find((item) => item.name === name)!
}
function data(result: RuntimeToolResult): Record<string, unknown> {
  expect(result.content[0].text).toBe(JSON.stringify(result.structuredContent))
  return result.structuredContent!
}
async function connect(registry: RuntimeToolRegistry, ctx: RuntimeToolContext): Promise<Client> {
  const adapted = adaptRuntimeTools(registry.snapshot(), ctx) as {
    mcpServers: Record<string, { instance: { connect(transport: unknown): Promise<void> } }>
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await adapted.mcpServers[ARCHIVE_MCP_SERVER_ID].instance.connect(serverTransport)
  const client = new Client({ name: 'archive-test', version: '1' })
  await client.connect(clientTransport)
  cleanup.push(() => client.close())
  return client
}

describe('standard archive Plugin factory and real MCP adapter', () => {
  it('stays unregistered until its deployment caller adds the cached server; SDK lists and invokes all four tools', async () => {
    const f = await fixture()
    const original = mail('C:/allowed.pst', 'one')
    add(f.store, original.sourcePath, [original])
    expect((await f.plugin.state('s1')).registered).toBe(false)
    expect(f.registry.snapshot().servers.size).toBe(0)
    const server = createMailArchiveToolServer()
    expect(createMailArchiveToolServer()).toBe(server)
    f.registry.add(server)
    const revision = f.registry.snapshot().revision
    f.registry.add(createMailArchiveToolServer())
    expect(f.registry.snapshot().revision).toBe(revision)
    expect((await f.plugin.state('s1')).registered).toBe(true)
    await f.plugin.setScope({ sessionId: 's1', sourceIds: [original.sourceId] })
    const client = await connect(f.registry, context())
    expect((await client.listTools()).tools.map((item) => item.name)).toEqual([
      ...ARCHIVE_MCP_TOOLS
    ])
    const found = await client.callTool({
      name: 'archive_search',
      arguments: { query: 'approved' }
    })
    const id = ((found.structuredContent as Record<string, unknown>).mails as { id: string }[])[0]
      .id
    expect(found.isError).toBeFalsy()
    const spoof = await client.callTool({
      name: 'archive_search',
      arguments: { query: 'approved', sessionId: 's2' }
    })
    expect(spoof.isError).toBe(true)
    expect(found.content).toEqual([{ type: 'text', text: JSON.stringify(found.structuredContent) }])
    for (const name of ['archive_get', 'archive_thread', 'archive_context'] as const) {
      const response = await client.callTool({
        name,
        arguments: name === 'archive_context' ? { question: 'precise', seedIds: [id] } : { id }
      })
      expect(response.isError).toBeFalsy()
      if (name !== 'archive_thread') {
        const evidence = (
          (response.structuredContent as Record<string, unknown>).evidence as ArchiveEvidence[]
        )[0]
        expect(evidence.text).toBe(f.store.get(id)!.bodyText.slice(evidence.start, evidence.end))
        expect((await f.plugin.resolve('s1', evidence.id)).state).toBe('available')
      }
    }
    expect(
      (await client.callTool({ name: 'archive_get', arguments: { id, offset: -1 } })).isError
    ).toBe(true)
    f.plugin.close()
    expect((await tool('archive_search').handler({ query: 'approved' }, context())).isError).toBe(
      true
    )
    // Closing/removing sources is a backend operation; the caller still owns registry removal.
    expect(f.registry.snapshot().servers.has(ARCHIVE_MCP_SERVER_ID)).toBe(true)
  })

  it('rejects unknown args and scope spoofing; no-scope and different-session calls return isError', async () => {
    const f = await fixture()
    const original = mail('C:/allowed.pst', 'one')
    add(f.store, original.sourcePath, [original])
    const id = f.store.search({ query: 'approved' })[0].id
    expect((await tool('archive_search').handler({ query: 'approved' }, context())).isError).toBe(
      true
    )
    await f.plugin.setScope({ sessionId: 's1', sourceIds: [original.sourceId] })
    for (const [name, input] of [
      ['archive_search', { query: 'approved', sessionId: 's2' }],
      ['archive_get', { id, scope: { sourceIds: ['all'] } }],
      ['archive_thread', { id, limit: 21 }],
      ['archive_context', { question: 'approved', seedIds: Array(7).fill(id) }]
    ] as const)
      expect((await tool(name).handler(input, context())).isError).toBe(true)
    expect((await tool('archive_get').handler({ id }, context('s2'))).isError).toBe(true)
    f.sessions.delete('s1')
    expect((await tool('archive_get').handler({ id }, context())).isError).toBe(true)
    await expect(
      f.plugin.setScope({ sessionId: 's1', sourceIds: [original.sourceId] })
    ).rejects.toThrow('session_removed')
  })
})

describe('scope is applied in SQL before candidates and limits', () => {
  it('intersects source/date/folder on the same occurrence before FTS and LIKE limits; get/thread exclude hidden edges', async () => {
    const f = await fixture()
    const a = 'C:/allowed.pst',
      b = 'C:/hidden.pst'
    const root = mail(a, 'root'),
      reply = mail(a, 'reply', { inReplyTo: root.messageId, threadKey: root.messageId! })
    const hidden = mail(b, 'hidden', {
      inReplyTo: root.messageId,
      threadKey: root.messageId!,
      sentAt: 1800000000000
    })
    const behind = mail(a, 'behind', { inReplyTo: hidden.messageId, threadKey: root.messageId! })
    add(f.store, a, [root, reply, behind, mail(a, 'unknown', { sentAt: null })])
    add(f.store, b, [
      hidden,
      ...Array.from({ length: 40 }, (_, i) => mail(b, `noise${i}`, { sentAt: 1800000000000 }))
    ])
    await f.plugin.setScope({
      sessionId: 's1',
      sourceIds: [root.sourceId],
      sentAfter: 1699999999999,
      sentBefore: 1700000000001
    })
    const lease = (await archivePluginRpc(f.service, { operation: 'scope', sessionId: 's1' }))!
    for (const query of ['approved', 'ap']) {
      const found = await archivePluginRpc(f.service, {
        operation: 'search',
        lease,
        query: { query, limit: 3 }
      })
      expect(found).toHaveLength(3)
      expect(found.every((item) => item.sourceName === 'allowed.pst')).toBe(true)
    }
    expect(
      await archivePluginRpc(f.service, {
        operation: 'search',
        lease,
        query: { query: '', sourceId: hidden.sourceId }
      })
    ).toEqual([])
    const all = f.store.search({ query: '', limit: 100 })
    const rootId = all.find((item) => item.subject === root.subject)!.id
    const hiddenId = all.find((item) => item.subject === hidden.subject)!.id
    expect(await archivePluginRpc(f.service, { operation: 'get', lease, id: hiddenId })).toBeNull()
    const thread = await archivePluginRpc(f.service, {
      operation: 'thread',
      lease,
      id: rootId,
      limit: 2
    })
    expect(thread.mails.map((item) => item.subject).sort()).toEqual(
      [root.subject, reply.subject].sort()
    )
    expect(thread.truncated).toBe(false)
    const fabricated = { ...lease, sourceIds: [hidden.sourceId] }
    await expect(
      archivePluginRpc(f.service, { operation: 'get', lease: fabricated, id: hiddenId })
    ).rejects.toThrow('out_of_scope')
    const reordered = {
      token: lease.token,
      corpusRevision: lease.corpusRevision,
      sourceIds: lease.sourceIds,
      sessionId: lease.sessionId,
      sentBefore: lease.sentBefore,
      sentAfter: lease.sentAfter
    }
    expect(
      await archivePluginRpc(f.service, { operation: 'get', lease: reordered, id: rootId })
    ).not.toBeNull()
  })

  it('returns shared-mail location from the allowed occurrence, denies revoked scope, and tombstones the last removal', async () => {
    const f = await fixture()
    const a = mail('C:/private.pst', 'shared'),
      b = mail('C:/public.pst', 'shared', { folderPath: null })
    add(f.store, a.sourcePath, [a])
    add(f.store, b.sourcePath, [b])
    expect(f.store.stats().totalMessages).toBe(1)
    const id = f.store.search({ query: '' })[0].id
    await f.plugin.setScope({ sessionId: 's1', sourceIds: [b.sourceId] })
    const result = data(await tool('archive_get').handler({ id }, context()))
    expect((result.mail as { sourceName: string; folderPath: string }).sourceName).toBe(
      'public.pst'
    )
    expect((result.mail as { folderPath: string | null }).folderPath).toBeNull()
    const lease = (await archivePluginRpc(f.service, { operation: 'scope', sessionId: 's1' }))!
    expect(
      await archivePluginRpc(f.service, {
        operation: 'search',
        lease,
        query: { query: '', folderPath: 'Inbox' }
      })
    ).toEqual([])
    const ref = (result.evidence as ArchiveEvidence[])[0]
    expect((await f.plugin.resolve('s2', ref.id)).state).toBe('forbidden')
    await f.plugin.setScope({ sessionId: 's1', sourceIds: [] })
    expect((await f.plugin.resolve('s1', ref.id)).state).toBe('forbidden')
    await f.plugin.setScope({ sessionId: 's1', sourceIds: [b.sourceId] })
    f.store.removeSource(a.sourceId)
    expect((await f.plugin.resolve('s1', ref.id)).state).toBe('available')
    f.store.removeSource(b.sourceId)
    expect(await f.plugin.resolve('s1', ref.id)).toEqual({ state: 'removed' })
  })
})

describe('evidence and lifecycle', () => {
  it('packs exact original Unicode spans within 64 KiB, emits no attachment body, and persists every returned reference', async () => {
    const f = await fixture()
    const path = 'C:/large.pst'
    const mails = Array.from({ length: 6 }, (_, i) =>
      mail(path, `large${i}`, {
        bodyText: 'İ\n' + '📮"\\'.repeat(800) + '\nprecise original paragraph.',
        subject: '📮'.repeat(10000),
        from: 'from'.repeat(10000)
      })
    )
    add(f.store, path, mails)
    await f.plugin.setScope({ sessionId: 's1', sourceIds: [mails[0].sourceId] })
    const ids = f.store.search({ query: '' }).map((item) => item.id)
    const result = await tool('archive_context').handler(
      { question: 'precise', seedIds: ids },
      context()
    )
    expect(result.isError).toBeFalsy()
    expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThanOrEqual(
      ARCHIVE_MCP_MAX_BYTES
    )
    const refs = data(result).evidence as ArchiveEvidence[]
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) {
      expect(ref.text).toBe(f.store.get(ref.mailId)!.bodyText.slice(ref.start, ref.end))
      expect(ref.text).toContain('precise original')
      expect(ref.text).not.toContain('ATTACHMENT-SENTINEL')
      expect((await f.plugin.resolve('s1', ref.id)).state).toBe('available')
    }
    const body = 'İ\nxxx target 📮'
    const span = archiveRelevantSpan(body, 'TARGET')
    expect(body.slice(span.start, span.end)).toBe('xxx target 📮')
    expect(archiveBodySpan('a📮b', 2, 2)).toEqual({ start: 1, end: 3 })
  })

  it.each(['revoke', 'source', 'session', 'cancel'] as const)(
    'rejects a late result after %s',
    async (action) => {
      const f = await fixture()
      const original = mail('C:/late.pst', 'one')
      add(f.store, original.sourcePath, [original])
      await f.plugin.setScope({ sessionId: 's1', sourceIds: [original.sourceId] })
      let release!: () => void, entered!: () => void
      const gate = new Promise<void>((resolve) => {
          release = resolve
        }),
        ready = new Promise<void>((resolve) => {
          entered = resolve
        })
      const held = {
        pluginRequest: async (input: Parameters<MailArchiveService['pluginRequest']>[0]) => {
          const result = await f.service.pluginRequest(input)
          if (input.operation === 'search') {
            entered()
            await gate
          }
          return result
        }
      }
      const signal = new AbortController()
      const server = createArchiveToolServer(held, (id) => f.sessions.has(id))
      const pending = server.implementations[0].handler(
        { query: 'approved' },
        context('s1', signal.signal)
      )
      await ready
      if (action === 'revoke') await f.plugin.setScope({ sessionId: 's1', sourceIds: [] })
      if (action === 'source') f.store.removeSource(original.sourceId)
      if (action === 'session') f.sessions.delete('s1')
      if (action === 'cancel') signal.abort()
      release()
      const result = await pending
      expect(result.isError).toBe(true)
      expect(JSON.stringify(result)).not.toContain('Question approved')
      expect(JSON.stringify(result)).not.toContain(original.sourcePath)
    }
  )

  it('keeps saved scope and evidence on reopen; removes disposed/orphan sessions and invalidates stale leases', async () => {
    const f = await fixture()
    const original = mail('C:/saved.pst', 'one')
    add(f.store, original.sourcePath, [original])
    await f.plugin.setScope({ sessionId: 's1', sourceIds: [original.sourceId] })
    await f.plugin.setScope({ sessionId: 's2', sourceIds: [original.sourceId] })
    const lease = (await archivePluginRpc(f.service, { operation: 'scope', sessionId: 's1' }))!
    const id = f.store.search({ query: '' })[0].id
    const ref = (
      data(await tool('archive_get').handler({ id }, context())).evidence as ArchiveEvidence[]
    )[0]
    const ref2 = (
      data(await tool('archive_get').handler({ id }, context('s2'))).evidence as ArchiveEvidence[]
    )[0]
    await f.plugin.disposeSession('s2')
    expect(await archivePluginRpc(f.service, { operation: 'scope', sessionId: 's2' })).toBeNull()
    expect((await f.plugin.resolve('s2', ref2.id)).state).toBe('forbidden')
    f.plugin.close()
    f.store.close()
    const reopened = createMailArchiveStore(f.root)
    cleanup.push(async () => reopened.close())
    expect(reopened.pluginRequest({ operation: 'scope', sessionId: 's1' })).toEqual(lease)
    expect(
      reopened.pluginRequest({ operation: 'resolve', sessionId: 's1', id: ref.id })
    ).toMatchObject({ state: 'available' })
    reopened.pluginRequest({
      operation: 'setScope',
      input: { sessionId: 's1', sourceIds: [original.sourceId] }
    })
    expect(() => reopened.pluginRequest({ operation: 'assert', lease })).toThrow('scope_required')
    reopened.pluginRequest({ operation: 'prune', sessionIds: [] })
    expect(reopened.pluginRequest({ operation: 'scope', sessionId: 's1' })).toBeNull()
    expect(reopened.pluginRequest({ operation: 'resolve', sessionId: 's1', id: ref.id })).toEqual({
      state: 'forbidden'
    })
  })
})
