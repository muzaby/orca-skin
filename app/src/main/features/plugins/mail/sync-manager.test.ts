import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PluginAuth } from '../../../contracts/auth'
import type { MailStore } from './store'
import { createMailSyncManager } from './sync-manager'

const storage = vi.hoisted(() => ({
  saveMessage: vi.fn(async () => {}),
  saveState: vi.fn(),
  state: () => ({ lastSyncAt: null, protection: { kind: 'none' } }),
  cleanupExpired: vi.fn(async () => 0),
  ledger: () => [],
  markMissing: vi.fn(),
  close: vi.fn()
}))
vi.mock('./store', () => ({ createMailStore: async () => storage as unknown as MailStore }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => vi.useRealTimers())

// DB 경계만 대체한다. 연결·명령 타이머는 실제 withMailSession/POP3 경로를 지난다.
class MailSocket extends EventEmitter {
  destroyed = false
  commands: string[] = []
  constructor(private mode: 'slow' | 'command-timeout' | 'connect-timeout') {
    super()
    if (mode !== 'connect-timeout')
      queueMicrotask(() => this.emit('data', Buffer.from('+OK ready\r\n')))
  }
  write(chunk: string | Uint8Array): boolean {
    const line = Buffer.from(chunk).toString().trim()
    this.commands.push(line)
    if (line === 'UIDL') {
      queueMicrotask(() => this.emit('data', Buffer.from('+OK\r\n1 u1\r\n2 u2\r\n3 u3\r\n.\r\n')))
    } else if (line.startsWith('TOP') || line.startsWith('RETR')) {
      if (this.mode !== 'command-timeout') {
        setTimeout(() => {
          if (!this.destroyed)
            this.emit('data', Buffer.from('+OK\r\nSubject: slow\r\n\r\nbody\r\n.\r\n'))
        }, 25_000)
      }
    } else queueMicrotask(() => this.emit('data', Buffer.from('+OK\r\n')))
    return true
  }
  destroy(): void {
    this.destroyed = true
    this.emit('close')
  }
}

async function fixture(mode: 'slow' | 'command-timeout' | 'connect-timeout' = 'slow'): Promise<{
  manager: Awaited<ReturnType<typeof createMailSyncManager>>
  sockets: MailSocket[]
}> {
  const sockets: MailSocket[] = []
  const auth = {
    authId: 'mail',
    withCredential: async (
      operation: (credential: unknown, reject: () => void) => Promise<unknown>
    ) => operation({ authKind: 'password', value: 'alice:password' }, () => {})
  } as PluginAuth
  const manager = await createMailSyncManager({
    auth,
    root: '/unused',
    options: { accountId: 'a' },
    session: {
      host: 'mail.test',
      port: 110,
      tls: false,
      timeouts: { connectMs: 15_000, commandMs: 30_000 }
    },
    socketFactory: () => {
      const socket = new MailSocket(mode)
      sockets.push(socket)
      return socket
    }
  })
  return { manager, sockets }
}

it('AC10 — sync continues past 120 seconds while each command responds within its limit', async () => {
  const { manager, sockets } = await fixture()
  let completed = false
  const syncing = manager.sync().then((result) => {
    completed = true
    return result
  })
  await vi.advanceTimersByTimeAsync(121_000)
  expect(completed).toBe(false)
  expect(sockets[0].destroyed).toBe(false)
  await vi.advanceTimersByTimeAsync(30_000)
  expect(await syncing).toMatchObject({ synced: true, newMails: 3 })
  expect(storage.saveMessage).toHaveBeenCalledTimes(3)
  expect(sockets[0].destroyed).toBe(true)
  manager.close()
})

it('AC10 — caller abort closes the in-flight command and reports cancelled', async () => {
  const { manager, sockets } = await fixture()
  const controller = new AbortController()
  const syncing = manager.sync(controller.signal)
  await vi.advanceTimersByTimeAsync(1_000)
  controller.abort()
  expect(await syncing).toMatchObject({ synced: false, error: 'cancelled' })
  expect(sockets[0].destroyed).toBe(true)
  expect(storage.saveMessage).not.toHaveBeenCalled()
  manager.close()
})

it.each(['connect-timeout', 'command-timeout'] as const)(
  'AC10 — %s remains enforced',
  async (mode) => {
    const { manager, sockets } = await fixture(mode)
    const syncing = manager.sync()
    await vi.advanceTimersByTimeAsync(31_000)
    expect(await syncing).toMatchObject({ synced: false, error: 'timeout' })
    expect(sockets[0].destroyed).toBe(true)
    manager.close()
  }
)
