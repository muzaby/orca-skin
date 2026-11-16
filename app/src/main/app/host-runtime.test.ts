// 호스트 공용 런타임 — 셸 메시지의 분배 (0324 4b·4c · EP-9 · EP-19 · EP-21).
import { describe, expect, it, vi } from 'vitest'
import { testHostEnvironment } from '../infra/host-environment.testfixture'
import {
  hostEnvironmentArg,
  parseHostEnvironment,
  startHostRuntime,
  type ParentPort,
  type RawPort
} from './host-runtime'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function fakePort(): RawPort & { closed: boolean; emit(data: unknown): void } {
  const listeners: Array<(event: { data: unknown }) => void> = []
  return {
    closed: false,
    postMessage: vi.fn(),
    on(event: string, listener: never) {
      if (event === 'message') listeners.push(listener)
      return undefined
    },
    start: vi.fn(),
    close() {
      this.closed = true
    },
    emit: (data) => listeners.forEach((listener) => listener({ data }))
  } as RawPort & { closed: boolean; emit(data: unknown): void }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(shutdown: () => Promise<void> | void = () => {}) {
  let deliver: (event: { data: unknown; ports: RawPort[] }) => void = () => {}
  const posted: unknown[] = []
  const parent: ParentPort = {
    postMessage: (message) => posted.push(message),
    on: (_event, listener) => {
      deliver = listener
    }
  }
  const deps = {
    parent,
    connectClient: vi.fn(),
    attachPeer: vi.fn(),
    peerUnavailable: vi.fn(),
    prepareInstall: vi.fn(),
    shutdown: vi.fn(shutdown),
    exit: vi.fn(),
    onInvalid: vi.fn()
  }
  const runtime = startHostRuntime(deps)
  const send = (data: unknown, ports: RawPort[] = []): void => deliver({ data, ports })
  return { ...deps, runtime, send, posted }
}

describe('호스트 런타임', () => {
  it('창 포트 — 셸이 정한 창 id 와 신뢰 판정을 그대로 연결에 싣는다', () => {
    const h = setup()
    const port = fakePort()
    h.send({ type: 'client.connect', clientId: 7, trusted: true }, [port])
    expect(h.connectClient).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      clientId: 7,
      trusted: true
    })
    // 넘긴 포트로 쓰는가.
    h.connectClient.mock.calls[0][0].post({ kind: 'event', channel: 'c', payload: 1 })
    expect(port.postMessage).toHaveBeenCalledExactlyOnceWith({
      kind: 'event',
      channel: 'c',
      payload: 1
    })
    expect(h.attachPeer).not.toHaveBeenCalled()
  })

  it('피어 포트는 피어 링크로, 확보 실패는 그 통지로 간다', () => {
    const h = setup()
    const port = fakePort()
    h.send({ type: 'peer.connect' }, [port])
    expect(h.attachPeer).toHaveBeenCalledTimes(1)
    const received = vi.fn()
    h.attachPeer.mock.calls[0][0].onMessage(received)
    port.emit({ kind: 'notify', method: 'turn.end' })
    expect(received).toHaveBeenCalledExactlyOnceWith({ kind: 'notify', method: 'turn.end' })
    expect(h.connectClient).not.toHaveBeenCalled()
    h.send({ type: 'peer.unavailable' })
    expect(h.peerUnavailable).toHaveBeenCalledTimes(1)
  })

  it('포트가 빠진 연결 메시지·형식이 틀린 메시지는 버리고, 딸려 온 포트는 닫는다', () => {
    const h = setup()
    h.send({ type: 'client.connect', clientId: 1, trusted: false })
    h.send({ type: 'peer.connect' })
    const stray = fakePort()
    h.send({ type: 'client.connect', clientId: 'x' }, [stray])
    expect(h.onInvalid).toHaveBeenCalledTimes(3)
    expect(stray.closed).toBe(true)
    expect(h.connectClient).not.toHaveBeenCalled()
    expect(h.attachPeer).not.toHaveBeenCalled()
  })

  it('셸 서비스 — 호출은 service.call 로 나가고 응답·깨어남은 클라이언트가 받는다', async () => {
    const h = setup()
    const wake = vi.fn()
    h.runtime.shell.onWake(wake)
    const pending = h.runtime.shell.call('secrets.isAvailable')
    expect(h.posted).toEqual([
      { type: 'service.call', id: 0, name: 'secrets.isAvailable', args: [] }
    ])
    h.send({ type: 'service.result', id: 0, ok: true, value: true })
    await expect(pending).resolves.toBe(true)
    h.send({ type: 'wake', reason: 'resume' })
    expect(wake).toHaveBeenCalledExactlyOnceWith('resume')
  })

  it('업데이트 설치 직전 통지를 넘긴다', () => {
    const h = setup()
    h.send({ type: 'update.prepare-install' })
    expect(h.prepareInstall).toHaveBeenCalledTimes(1)
  })

  it('종료 — 정리가 끝난 뒤에 끝나고, 두 번 와도 한 번만 정리한다', async () => {
    let finish: () => void = () => {}
    const h = setup(() => new Promise<void>((resolve) => (finish = resolve)))
    h.send({ type: 'shutdown' })
    h.send({ type: 'shutdown' })
    await flush()
    expect(h.shutdown).toHaveBeenCalledTimes(1)
    expect(h.exit).not.toHaveBeenCalled()
    finish()
    await flush()
    expect(h.exit).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('종료 — 정리가 던져도 끝난다', async () => {
    const h = setup(() => {
      throw new Error('cleanup')
    })
    h.send({ type: 'shutdown' })
    await flush()
    expect(h.exit).toHaveBeenCalled()
  })
})

describe('호스트 환경 인자', () => {
  it('만든 인자를 다시 읽으면 같은 값이다', () => {
    const environment = testHostEnvironment({ isPackaged: true })
    expect(parseHostEnvironment(['node', 'entry.js', hostEnvironmentArg(environment)])).toEqual(
      environment
    )
  })

  it('없거나 필드가 빠지면 던진다', () => {
    expect(() => parseHostEnvironment(['node'])).toThrow('호스트 환경 인자가 없다')
    const rest: Record<string, unknown> = { ...testHostEnvironment() }
    delete rest.userData
    expect(() => parseHostEnvironment([`--oo-host-environment=${JSON.stringify(rest)}`])).toThrow(
      'userData'
    )
    expect(() =>
      parseHostEnvironment([
        `--oo-host-environment=${JSON.stringify({ ...testHostEnvironment(), isPackaged: 'no' })}`
      ])
    ).toThrow('isPackaged')
  })
})
