// 셸 전송의 창 참조 (0324 EP-9) — `WebContents` 하나의 수명을 `ClientRef` 로 옮기는 규칙.

import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => unknown>(),
  listeners: new Map<string, (event: unknown, raw: unknown) => void>(),
  contents: [] as unknown[],
  windows: [] as unknown[]
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, raw: unknown) => unknown) =>
      electron.handlers.set(channel, listener),
    on: (channel: string, listener: (event: unknown, raw: unknown) => void) =>
      electron.listeners.set(channel, listener)
  },
  webContents: { getAllWebContents: () => electron.contents },
  BrowserWindow: { getAllWindows: () => electron.windows }
}))

import { clientOf, createElectronTransport } from './electron-transport'
import type { ClientRef } from './transport'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 반환 형상은 구현이 정본이다
function fakeContents(id: number) {
  const emitter = new EventEmitter()
  let destroyed = false
  const sent: Array<{ channel: string; payload: unknown }> = []
  return Object.assign(emitter, {
    id,
    sent,
    isDestroyed: () => destroyed,
    send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
    destroy: () => {
      destroyed = true
      emitter.emit('destroyed')
    }
  })
}

type Contents = ReturnType<typeof fakeContents>
const ref = (contents: Contents): ClientRef => clientOf(contents as never)

beforeEach(() => {
  electron.handlers.clear()
  electron.listeners.clear()
  electron.contents = []
  electron.windows = []
})

describe('clientOf', () => {
  it('같은 창이면 같은 참조를 돌려주고 id 는 창 id 다', () => {
    const contents = fakeContents(7)
    expect(ref(contents)).toBe(ref(contents))
    expect(ref(contents).id).toBe(7)
  })

  it('구독 전에는 창에 리스너를 달지 않는다', () => {
    const contents = fakeContents(1)
    ref(contents).send('c', 1)
    expect(contents.eventNames()).toEqual([])
    expect(contents.sent).toEqual([{ channel: 'c', payload: 1 }])
  })

  it.each([
    ['창이 파괴됨', (contents: Contents) => contents.destroy()],
    ['renderer 프로세스 종료', (contents: Contents) => contents.emit('render-process-gone')],
    [
      '최상위 문서가 새로 읽힘',
      (contents: Contents) => contents.emit('did-start-navigation', {}, 'app://x', false, true)
    ]
  ])('%s → 닫힘을 한 번 알리고 리스너를 거둔다', (_name, trigger) => {
    const contents = fakeContents(1)
    const client = ref(contents)
    const closed = vi.fn()
    client.onClosed(closed)

    trigger(contents)
    trigger(contents)

    expect(closed).toHaveBeenCalledTimes(1)
    expect(client.isClosed()).toBe(true)
    expect(contents.eventNames()).toEqual([])
    // 닫힌 참조는 표에서 빠져 다음 요청이 새 참조를 받는다.
    expect(ref(contents)).not.toBe(client)
  })

  it.each([
    ['같은 문서 안의 이동', [{}, 'app://x#a', true, true]],
    ['하위 프레임의 이동', [{}, 'https://frame', false, false]]
  ])('%s 은 닫힘이 아니다', (_name, args) => {
    const contents = fakeContents(1)
    const client = ref(contents)
    const closed = vi.fn()
    client.onClosed(closed)

    contents.emit('did-start-navigation', ...args)

    expect(closed).not.toHaveBeenCalled()
    expect(client.isClosed()).toBe(false)
    expect(ref(contents)).toBe(client)
  })

  it('문서가 새로 읽힌 뒤에는 새 참조가 생기고 옛 참조로의 전송은 버려진다', () => {
    const contents = fakeContents(3)
    const before = ref(contents)
    before.onClosed(() => {})
    contents.emit('did-start-navigation', {}, 'app://x', false, true)

    const after = ref(contents)
    before.send('old', 1)
    after.send('new', 2)

    expect(after).not.toBe(before)
    expect(after.id).toBe(3)
    expect(after.isClosed()).toBe(false)
    expect(contents.sent).toEqual([{ channel: 'new', payload: 2 }])
  })

  it('파괴된 창은 구독이 없어도 닫힌 것으로 보이고 전송을 버린다', () => {
    const contents = fakeContents(1)
    const client = ref(contents)
    contents.destroy()

    client.send('c', 1)

    expect(client.isClosed()).toBe(true)
    expect(contents.sent).toEqual([])
  })

  it('구독 해제한 리스너는 닫힘을 받지 않는다', () => {
    const contents = fakeContents(1)
    const closed = vi.fn()
    ref(contents).onClosed(closed)()

    contents.destroy()

    expect(closed).not.toHaveBeenCalled()
  })

  it('이미 닫힌 참조에 구독하면 바로 부른다', () => {
    const contents = fakeContents(1)
    const client = ref(contents)
    client.onClosed(() => {})
    contents.emit('render-process-gone')
    const late = vi.fn()

    client.onClosed(late)

    expect(late).toHaveBeenCalledTimes(1)
  })
})

describe('createElectronTransport', () => {
  it('요청 이벤트의 창 참조와 신뢰 판정을 Electron 이벤트에서 만든다', async () => {
    const contents = fakeContents(5)
    const isTrusted = vi.fn((event: unknown) => (event as { ok: boolean }).ok)
    const transport = createElectronTransport({ isTrusted: isTrusted as never })
    const seen: Array<{ id: number; trusted: boolean; raw: unknown }> = []
    transport.handle('oo:x', (event, raw) => {
      seen.push({ id: event.sender.id, trusted: event.trusted, raw })
      return 'done'
    })
    transport.on('oo:y', (event, raw) => {
      seen.push({ id: event.sender.id, trusted: event.trusted, raw })
    })

    expect(await electron.handlers.get('oo:x')!({ sender: contents, ok: true }, 'a')).toBe('done')
    electron.listeners.get('oo:y')!({ sender: contents, ok: false }, 'b')

    expect(seen).toEqual([
      { id: 5, trusted: true, raw: 'a' },
      { id: 5, trusted: false, raw: 'b' }
    ])
  })

  it('방송 대상은 파괴되지 않은 창 전부다', () => {
    const alive = fakeContents(1)
    const dead = fakeContents(2)
    dead.destroy()
    electron.contents = [alive, dead]

    const clients = createElectronTransport({ isTrusted: () => true }).clients()

    expect(clients.map((client) => client.id)).toEqual([1])
  })

  it('한 창만 맡는 통지의 대상은 먼저 열린 창이다', () => {
    const first = fakeContents(1)
    const second = fakeContents(2)
    const transport = createElectronTransport({ isTrusted: () => true })
    electron.windows = [
      { isDestroyed: () => true, webContents: fakeContents(9) },
      { isDestroyed: () => false, webContents: first },
      { isDestroyed: () => false, webContents: second }
    ]

    expect(transport.primaryClient()?.id).toBe(1)

    electron.windows = []
    expect(transport.primaryClient()).toBeUndefined()
  })
})
