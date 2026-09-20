import { EventEmitter } from 'node:events'
import { mkdtemp, realpath, rm, readFile, stat, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createAuthRuntime } from '../../features/auth/runtime'
import { createMemoryGrantPersistence } from '../../features/auth/store'
import { createVault } from '../../infra/vault'
import { warmFileSqlite } from '../../infra/db/warm-file-sqlite'
import { createPop3Socket } from '../../infra/net/pop3-socket'
import { userDataPath } from '../../infra/config/user-data-path'
import { createMailAuth, mailSessionConfig } from '../../features/plugins/mail/auth'
import { mailTools } from '../../features/plugins/mail/tools'
import { createMailSyncManager } from '../../features/plugins/mail/sync-manager'
import { RuntimeToolRegistry } from '../../features/extensions/runtime-tool-registry'
import { createPluginBinding, createPluginBindings, type PluginDeploymentDeps } from './plugins'
import { confluenceTools } from '../../features/plugins/confluence/tools'
import { patSpec } from '../../features/auth/specs/credential'
import { Pop3Error } from '../../infra/net/pop3-errors'
import { parseMail } from '../../features/plugins/mail/mime'
import { prepareTemporaryFilesPath } from '../../infra/config/temp-path'

vi.mock('../../infra/net/pop3-socket', () => ({ createPop3Socket: vi.fn() }))
vi.mock('../../infra/config/user-data-path', () => ({ userDataPath: vi.fn() }))
vi.mock('../../infra/config/temp-path', () => ({ prepareTemporaryFilesPath: vi.fn() }))

const roots: string[] = []
const close: (() => void)[] = []
beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const fn of close.splice(0)) fn()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
  vi.clearAllMocks()
})

class ServerSocket extends EventEmitter {
  commands: string[] = []
  destroyed = false
  constructor(private reply: (line: string) => string | Buffer | null) {
    super()
    queueMicrotask(() => this.emit('data', Buffer.from('+OK ready\r\n')))
  }
  write(chunk: string | Uint8Array): boolean {
    const line = Buffer.from(chunk).toString().replace(/\r\n$/, '')
    this.commands.push(line)
    const reply = this.reply(line)
    if (reply !== null) queueMicrotask(() => this.emit('data', Buffer.from(reply)))
    return true
  }
  destroy(): void {
    this.destroyed = true
    this.emit('close')
  }
}

async function setup(withProbe = true): Promise<{
  root: string
  temp: string
  options: { accountId: string; timeouts: { commandMs: number; connectMs: number } }
  session: ReturnType<typeof mailSessionConfig>
  runtime: ReturnType<typeof createAuthRuntime>['runtime']
  auth: ReturnType<ReturnType<typeof createAuthRuntime>['runtime']['bindForPlugin']>
  server: ReturnType<typeof mailTools>
  registry: RuntimeToolRegistry
  binding: ReturnType<typeof createPluginBinding>
  sockets: ServerSocket[]
  login: () => ReturnType<ReturnType<typeof createAuthRuntime>['runtime']['login']>
  reject: () => void
  accept: () => void
  remote: (next: string[]) => void
}> {
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-integration-'))
  roots.push(root)
  vi.mocked(userDataPath).mockResolvedValue(root)
  // 프로덕션 `prepareTemporaryFilesPath` 는 realpath 를 돌려준다. mkdtemp 원본은 Windows
  // 러너에서 `C:\\Users\\RUNNER~1\\...` 8.3 별칭이라 그대로 쓰면 mock 이 프로덕션과 다른
  // 값을 준다 — fixture 를 실제 계약에 맞춘다.
  const temp = await realpath(await mkdtemp(join(tmpdir(), 'orca-mail-export-')))
  roots.push(temp)
  vi.mocked(prepareTemporaryFilesPath).mockResolvedValue(temp)
  // 좌표는 선언 입력에만 있고 런타임 옵션에는 없다 — 사본이 하나임을 fixture 도 따른다.
  const options = { accountId: 'account', timeouts: { commandMs: 100, connectMs: 100 } }
  const mail = createMailAuth('mail', '메일', { host: 'mail.test', ...options })
  if (!withProbe) delete mail.methods[0].probe
  const secrets = new Map<string, string>()
  const vault = createVault({
    get: (key) => secrets.get(key),
    set: (key, value) => void secrets.set(key, value),
    delete: (key) => void secrets.delete(key)
  })
  const wiki = {
    id: 'wiki',
    label: 'Wiki',
    origin: 'https://wiki.test',
    methods: [
      patSpec({
        label: 'PAT',
        fieldLabel: '토큰',
        present: { location: 'header', name: 'Authorization', scheme: 'bearer' }
      })
    ]
  }
  const { runtime } = createAuthRuntime({
    definitions: [mail, wiki],
    vault,
    persistence: createMemoryGrantPersistence(),
    fetchImpl: vi.fn()
  })
  const sockets: ServerSocket[] = []
  let rejected = false
  let remote = ['u1']
  const reply = (line: string): string => {
    const [command, index] = line.split(' ')
    if (command === 'USER' || command === 'PASS')
      return rejected ? '-ERR bad credentials\r\n' : '+OK\r\n'
    if (command === 'UIDL')
      return `+OK\r\n${remote.map((uidl, i) => `${i + 1} ${uidl}\r\n`).join('')}.\r\n`
    if (command === 'TOP') return `+OK\r\nDate: ${new Date().toUTCString()}\r\n.\r\n`
    if (command === 'RETR')
      return `+OK\r\nFrom: alice@example.test\r\nTo: bob@example.test\r\nCc: carol@example.test\r\nSubject: 회의일정 ${index}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n회의실 예약 ${index}\r\n.\r\n`
    return '+OK\r\n'
  }
  vi.mocked(createPop3Socket).mockImplementation(() => {
    const socket = new ServerSocket(reply)
    sockets.push(socket)
    return socket
  })
  const auth = runtime.bindForPlugin('mail')
  const session = mailSessionConfig(auth.origin, options)
  const server = mailTools(auth, options)
  const registry = new RuntimeToolRegistry()
  const binding = createPluginBinding({ auth, server, registry })
  runtime.subscribe((change) => {
    if (change.kind === 'snapshot') binding.sync()
  })
  const login = (): ReturnType<typeof runtime.login> =>
    runtime.login('mail', 'password', { username: 'alice', password: ' p:a:ss ' })
  return {
    root,
    temp,
    options,
    session,
    runtime,
    auth,
    server,
    registry,
    binding,
    sockets,
    login,
    reject: () => {
      rejected = true
    },
    accept: () => {
      rejected = false
    },
    remote: (next: string[]) => {
      remote = next
    }
  }
}

describe('mail declaration → auth → plugin → infra', () => {
  it('search stays local and stale without a prior sync for every input shape', async () => {
    const f = await setup()
    vi.mocked(createPop3Socket).mockImplementation(() => {
      throw new Error('search must stay local')
    })
    for (const input of [
      {},
      { query: '' },
      { query: 'x'.repeat(1000) },
      { query: '2026-09-20' },
      { query: 'alice@example.test' },
      { query: '회의', limit: 999 }
    ]) {
      expect(await f.server.implementations[1].handler(input)).toMatchObject({
        structuredContent: { total: 0, stale: true, cacheAsOf: null }
      })
    }
    expect(createPop3Socket).not.toHaveBeenCalled()
  })
  it.each([
    [100, 10, true],
    [100, 50, false],
    [100, 49, true],
    [19, 1, false],
    [20, 1, true]
  ] as const)(
    'protection uses RETR as its observable boundary (%i ledger, %i retained)',
    async (count, retained, blocked) => {
      const f = await setup()
      await f.login()
      const manager = await createMailSyncManager({
        auth: f.auth,
        options: f.options,
        session: f.session,
        root: f.root,
        socketFactory: createPop3Socket
      })
      close.push(() => manager.close())
      const now = Date.now()
      for (let i = 0; i < count; i++)
        await manager.store.saveMessage({
          uidl: `old-${i}`,
          messageNumber: i + 1,
          headerDate: now,
          firstSeenAt: now,
          effectiveDate: now,
          fromAddr: '',
          toAddrs: '',
          ccAddrs: '',
          subject: 'cached',
          bodyText: '',
          attachments: []
        })
      f.remote([...Array.from({ length: retained }, (_, i) => `old-${i}`), 'new'])
      const result = await manager.sync()
      expect('protection' in result && result.protection === 'bulk_loss_suspected').toBe(blocked)
      expect(
        f.sockets
          .flatMap((socket) => socket.commands)
          .filter((command) => command.startsWith('RETR'))
      ).toEqual(blocked ? [] : [`RETR ${retained + 1}`])
      expect(manager.store.countMail()).toBe(count + (blocked ? 0 : 1))
    }
  )
  it('an explicitly unprobed declaration still reports rejection on its first sync', async () => {
    const f = await setup(false)
    f.reject()
    await f.login()
    expect(f.auth.snapshot().status).toBe('valid')
    expect(f.sockets).toHaveLength(0)
    expect(await f.server.implementations[0].handler({})).toMatchObject({
      structuredContent: { error: 'auth_failed' }
    })
    expect(f.auth.snapshot().status).toBe('expired')
  })
  it('indexes decoded EUC-KR bytes and finds their Korean body text', async () => {
    const f = await setup()
    const manager = await createMailSyncManager({
      auth: f.auth,
      options: f.options,
      session: f.session,
      root: f.root,
      socketFactory: createPop3Socket
    })
    close.push(() => manager.close())
    const raw = Buffer.concat([
      Buffer.from(
        'Content-Type: text/plain; charset=euc-kr\r\nContent-Transfer-Encoding: 8bit\r\n\r\n'
      ),
      Buffer.from([0xc8, 0xb8, 0xc0, 0xc7, 13, 10])
    ])
    await manager.store.saveMessage(
      await parseMail(raw, { uidl: 'euc', messageNumber: 1, firstSeenAt: Date.now() })
    )
    expect(manager.search('회의').total).toBe(1)
    expect(f.sockets).toHaveLength(0)
  })
  it('cancellation after MIME parsing reports cancelled and never commits that message', async () => {
    const f = await setup()
    await f.login()
    const controller = new AbortController()
    const manager = await createMailSyncManager({
      auth: f.auth,
      options: f.options,
      session: f.session,
      root: f.root,
      socketFactory: createPop3Socket
    })
    close.push(() => manager.close())
    const result = await manager.sync(controller.signal, (event) => {
      if (event.stage === 'persist') controller.abort()
    })
    expect(result).toMatchObject({ error: 'cancelled' })
    expect(manager.store.countMail()).toBe(0)
    expect(await readdir(manager.store.attachmentRoot)).toEqual([])
    expect(f.sockets.at(-1)?.destroyed).toBe(true)
  })
  it('bulk-loss observations keep their baseline until the same fingerprint is confirmed', async () => {
    const f = await setup()
    await f.login()
    const now = Date.now()
    const manager = await createMailSyncManager({
      auth: f.auth,
      options: f.options,
      session: f.session,
      root: f.root,
      socketFactory: createPop3Socket,
      now: () => now
    })
    close.push(() => manager.close())
    for (let i = 0; i < 20; i++)
      await manager.store.saveMessage({
        uidl: `old-${i}`,
        messageNumber: i + 1,
        headerDate: now,
        firstSeenAt: now,
        effectiveDate: now,
        fromAddr: '',
        toAddrs: '',
        ccAddrs: '',
        subject: 'old',
        bodyText: '',
        attachments: []
      })
    f.remote(['new-a'])
    expect(await manager.sync()).toMatchObject({ protection: 'bulk_loss_suspected' })
    f.remote(['new-b'])
    expect(await manager.sync()).toMatchObject({ protection: 'bulk_loss_suspected' })
    expect(f.sockets.flatMap((s) => s.commands).filter((c) => c.startsWith('RETR'))).toEqual([])
    expect(await manager.sync()).toMatchObject({ synced: true, newMails: 1 })
    expect(manager.store.countMail()).toBe(21)
  })

  it.each(['cancel', 'budget'] as const)(
    '%s during RETR closes socket without a partial message',
    async (mode) => {
      const f = await setup()
      await f.login()
      const controller = new AbortController()
      let opened: ServerSocket | undefined
      vi.mocked(createPop3Socket).mockImplementation(() => {
        opened = new ServerSocket((line) => {
          if (line === 'UIDL') return '+OK\r\n1 u1\r\n.\r\n'
          if (line.startsWith('TOP')) return '+OK\r\n.\r\n'
          if (line.startsWith('RETR')) {
            if (mode === 'cancel') queueMicrotask(() => controller.abort())
            return null
          }
          return '+OK\r\n'
        })
        return opened
      })
      const manager = await createMailSyncManager({
        auth: f.auth,
        options: { ...f.options, timeouts: { syncMs: 30, commandMs: 1000, connectMs: 1000 } },
        session: { ...f.session, timeouts: { syncMs: 30, commandMs: 1000, connectMs: 1000 } },
        root: f.root,
        socketFactory: createPop3Socket
      })
      close.push(() => manager.close())
      expect(await manager.sync(controller.signal)).toMatchObject({
        error: mode === 'cancel' ? 'cancelled' : 'timeout'
      })
      expect(opened?.destroyed).toBe(true)
      expect(manager.store.countMail()).toBe(0)
      expect(await readdir(manager.store.attachmentRoot)).toEqual([])
      expect(f.auth.snapshot().status).toBe('valid')
    }
  )

  it('manifest identifiers export each attachment unchanged without revealing source paths', async () => {
    const f = await setup()
    await f.login()
    const manager = await createMailSyncManager({
      auth: f.auth,
      options: f.options,
      session: f.session,
      root: f.root,
      socketFactory: createPop3Socket
    })
    close.push(() => manager.close())
    const now = Date.now()
    await manager.store.saveMessage({
      uidl: 'attachments',
      messageNumber: 1,
      headerDate: now,
      firstSeenAt: now,
      effectiveDate: now,
      fromAddr: '',
      toAddrs: '',
      ccAddrs: '',
      subject: '첨부',
      bodyText: '',
      attachments: [1, 2, 3].map((n) => ({
        filename: `item-${n}.bin`,
        mimeType: 'application/octet-stream',
        sizeBytes: 2,
        bytes: new Uint8Array([n, 255])
      }))
    })
    const search = await f.server.implementations[1].handler({ query: '첨부' })
    const hits = (
      search.structuredContent as {
        results: { mailId: string; attachments: { attachmentId: string }[] }[]
      }
    ).results
    expect(hits[0].attachments).toHaveLength(3)
    expect(JSON.stringify(search)).not.toContain('storedName')
    expect(JSON.stringify(search)).not.toContain(JSON.stringify(f.root).slice(1, -1))
    for (const attachment of hits[0].attachments) {
      const source = await manager.store.findAttachment(hits[0].mailId, attachment.attachmentId)
      expect(source).not.toBeNull()
      const before = await readFile(source!.path)
      const beforeStat = await stat(source!.path)
      const exported = await f.server.implementations[2].handler({
        mailId: hits[0].mailId,
        attachmentId: attachment.attachmentId
      })
      const saved = exported.structuredContent as { savedPath: string }
      expect(saved.savedPath.startsWith(f.temp)).toBe(true)
      expect(JSON.stringify(exported)).not.toContain(JSON.stringify(f.root).slice(1, -1))
      expect(await readFile(saved.savedPath)).toEqual(before)
      expect(await readFile(source!.path)).toEqual(before)
      expect((await stat(source!.path)).mtimeMs).toBe(beforeStat.mtimeMs)
    }
  })
  it('compiles HTTP and POP3 recipes with identical deployment deps; OSS default remains empty', async () => {
    const f = await setup()
    const deps: PluginDeploymentDeps = { auth: f.runtime, registry: f.registry }
    const wikiAuth = deps.auth.bindForPlugin('wiki')
    const bindings = [
      createPluginBinding({
        auth: wikiAuth,
        server: confluenceTools(wikiAuth, { apiBasePath: '/confluence' }),
        registry: deps.registry
      }),
      f.binding
    ]
    expect(bindings.map((binding) => binding.auth.authId)).toEqual(['wiki', 'mail'])
    expect(createPluginBindings(deps)).toEqual([])
    expect(f.sockets).toHaveLength(0)
  })

  it('probes the candidate, persists it, syncs with identical USER/PASS and searches locally', async () => {
    const f = await setup()
    expect(f.binding.toolNames()).toHaveLength(3)
    await f.login()
    expect(f.auth.snapshot().status).toBe('valid')
    expect(f.sockets).toHaveLength(1)
    expect(f.sockets[0].commands).toEqual(['USER alice', 'PASS  p:a:ss ', 'QUIT'])
    const simultaneous = await Promise.all(
      [1, 2, 3].map(() => f.server.implementations[0].handler({}))
    )
    expect(simultaneous[1]).toEqual(simultaneous[0])
    expect(simultaneous[2]).toEqual(simultaneous[0])
    const synced = simultaneous[0]
    expect(JSON.stringify(synced)).not.toContain(JSON.stringify(f.root).slice(1, -1))
    expect(synced.structuredContent).toMatchObject({ synced: true, newMails: 1 })
    expect(f.sockets[1].commands.slice(0, 2)).toEqual(f.sockets[0].commands.slice(0, 2))
    for (const query of ['', 'alice', 'bob', 'carol', '회의', '예약']) {
      const found = await f.server.implementations[1].handler({ query })
      expect(found.structuredContent).toMatchObject({ total: 1, stale: false })
      expect(JSON.stringify(found)).not.toContain(JSON.stringify(f.root).slice(1, -1))
    }
    expect(f.sockets).toHaveLength(2)
    await f.server.implementations[0].handler({})
    expect(f.sockets).toHaveLength(2)
    expect(f.sockets.every((socket) => socket.destroyed)).toBe(true)
  })

  it('syncs only new UIDLs after freshness expires; missing mail survives until retention', async () => {
    const f = await setup()
    await f.login()
    let now = Date.now()
    const manager = await createMailSyncManager({
      auth: f.auth,
      options: f.options,
      session: f.session,
      root: f.root,
      socketFactory: createPop3Socket,
      now: () => now
    })
    close.push(() => manager.close())
    await manager.sync()
    now += 299_000
    expect(await manager.sync()).toMatchObject({ fresh: true })
    expect(f.sockets).toHaveLength(2)
    now += 2_000
    f.remote(['u1', 'u2', 'u3'])
    expect(await manager.sync()).toMatchObject({ synced: true, newMails: 2 })
    expect(f.sockets[2].commands.filter((line) => line.startsWith('RETR'))).toEqual([
      'RETR 3',
      'RETR 2'
    ])
    now += 301_000
    f.remote(['u3'])
    await manager.sync()
    expect(manager.search('').total).toBe(3)
    expect(manager.store.ledger().filter((row) => row.state === 'missing')).toHaveLength(2)
    f.remote([])
    now += 15 * 86400_000
    expect(manager.search('').total).toBe(3)
    await manager.sync()
    expect(manager.search('').total).toBe(0)
  })

  it('USER rejection expires auth and removes all tools; new login restores them', async () => {
    const f = await setup()
    await f.login()
    f.reject()
    expect(await f.server.implementations[0].handler({})).toMatchObject({
      structuredContent: { error: 'auth_failed' }
    })
    expect(f.auth.snapshot().status).toBe('expired')
    expect(f.registry.snapshot().servers).toHaveLength(0)
    expect(f.binding.toolNames()).toHaveLength(3)
    f.accept()
    await f.login()
    expect(f.registry.snapshot().servers).toHaveLength(1)
  })

  it.each(['connection_failed', 'tls_failed', 'timeout', 'parse_failed', 'db_failed'] as const)(
    '%s preserves valid auth and stale cache',
    async (code) => {
      const f = await setup()
      await f.login()
      let now = Date.now()
      const manager = await createMailSyncManager({
        auth: f.auth,
        options: f.options,
        session: f.session,
        root: f.root,
        socketFactory: createPop3Socket,
        now: () => now
      })
      close.push(() => manager.close())
      await manager.sync()
      const cacheAsOf = manager.search('').cacheAsOf
      now += 301_000
      vi.mocked(createPop3Socket).mockImplementation(() => {
        throw new Pop3Error(code)
      })
      expect(await manager.sync()).toMatchObject({ error: code })
      expect(manager.search('')).toMatchObject({ stale: true, total: 1, cacheAsOf })
      expect(f.auth.snapshot().status).toBe('valid')
      expect(f.registry.snapshot().servers).toHaveLength(1)
    }
  )
})
