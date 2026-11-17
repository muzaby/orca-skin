// 호스트 프로세스의 시작 순서 (0324 4b·4c · AC18′ · AC46 · AC5′).
import { afterEach, describe, expect, it, vi } from 'vitest'

const order: string[] = []
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log }
const mocks = vi.hoisted(() => ({
  initLog: vi.fn(),
  closeLog: vi.fn(),
  flushLogSync: vi.fn(),
  setStallThread: vi.fn(),
  startLoopStallMonitor: vi.fn(),
  reportError: vi.fn()
}))

vi.mock('../infra/log', () => ({
  initLog: mocks.initLog,
  closeLog: mocks.closeLog,
  flushLogSync: mocks.flushLogSync
}))
vi.mock('../infra/perf/stall-monitor', () => ({
  setStallThread: mocks.setStallThread,
  startLoopStallMonitor: mocks.startLoopStallMonitor
}))
vi.mock('../infra/error-report', () => ({ reportError: mocks.reportError }))

import { hostEnvironment, setHostEnvironment } from '../infra/host-environment'
import { testHostEnvironment } from '../infra/host-environment.testfixture'
import { hasIpcTransport, ipcTransport, setIpcTransport } from '../infra/ipc/transport'
import { setShellServices, shellServices } from '../infra/shell-services'
import { runHostProcess, type HostAssembly, type HostProcessContext } from './host-process'
import { hostEnvironmentArg, type ParentPort } from './host-runtime'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(
  name: 'data-host' | 'agent-host',
  start: () => Promise<{ type: 'ready' }> = async () => ({ type: 'ready' })
) {
  order.length = 0
  mocks.initLog.mockImplementation((process: string) => {
    order.push(`log:${process}`)
    return log
  })
  mocks.setStallThread.mockImplementation((thread: string) => void order.push(`thread:${thread}`))
  mocks.startLoopStallMonitor.mockImplementation(
    (thread: string) => void order.push(`monitor:${thread}`)
  )
  const posted: unknown[] = []
  const parent: ParentPort = { postMessage: (message) => posted.push(message), on: () => {} }
  const exit = vi.fn()
  const environment = testHostEnvironment()
  let context: HostProcessContext | undefined
  let onError: ((kind: 'rejection' | 'exception', error: unknown) => void) | undefined
  const assembly: HostAssembly = {
    start: vi.fn(() => {
      order.push('start')
      return start() as never
    }),
    attachPeer: vi.fn(),
    shutdown: vi.fn()
  }
  const created = runHostProcess({
    name,
    parent,
    argv: ['node', 'entry.js', hostEnvironmentArg(environment)],
    exit,
    create: (given) => {
      // 조립을 만드는 시점에 환경·전송·셸 서비스가 이미 서 있어야 한다.
      order.push(
        `create:env=${hostEnvironment().userData === environment.userData}:transport=${hasIpcTransport()}`
      )
      context = given
      return assembly
    },
    onProcessError: (listener) => {
      onError = listener
    }
  })
  return {
    created,
    assembly,
    posted,
    exit,
    environment,
    context: () => context!,
    onError: () => onError!
  }
}

afterEach(() => {
  setHostEnvironment(null)
  setIpcTransport(null)
  setShellServices(null)
  vi.clearAllMocks()
})

describe('호스트 프로세스 시작', () => {
  it.each(['data-host', 'agent-host'] as const)(
    '%s — 환경 → 로그 → 멈춤 계측 → 전송 → 조립 순서로 서고, 시작이 끝나면 준비를 한 번 알린다',
    async (name) => {
      const h = setup(name)
      expect(order).toEqual([
        `log:${name}`,
        `thread:${name}`,
        `monitor:${name}`,
        'create:env=true:transport=true',
        'start'
      ])
      // 이벤트 루프 멈춤 계측은 그 호스트 이름으로 한 번만 시작한다(AC5′).
      expect(mocks.startLoopStallMonitor).toHaveBeenCalledExactlyOnceWith(name)
      expect(h.created).toBe(h.assembly)
      expect(ipcTransport()).toBe(h.context().transport)
      expect(shellServices()).toBe(h.context().shell)
      expect(h.posted).toEqual([])
      await flush()
      expect(h.posted).toEqual([{ type: 'ready' }])
      expect(h.exit).not.toHaveBeenCalled()
    }
  )

  it('준비 메시지는 조립이 돌려준 것 그대로다 — 데이터 호스트의 UI 언어 사본이 실린다', async () => {
    const ready = { type: 'ready' as const, mirror: { uiLocale: 'en' } }
    const h = setup('data-host', async () => ready)
    await flush()
    expect(h.posted).toEqual([ready])
  })

  it('시작이 던지면 준비를 알리지 않고 로그를 비운 뒤 종료 코드 1로 끝낸다', async () => {
    const failure = new Error('db locked')
    const h = setup('data-host', async () => {
      throw failure
    })
    await flush()
    expect(h.posted).toEqual([])
    expect(log.error).toHaveBeenCalledWith('host.start.failed', failure, { host: 'data-host' })
    expect(mocks.flushLogSync).toHaveBeenCalledOnce()
    expect(h.exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  // 조립 생성자가 설정 사본처럼 아직 없는 것을 읽어 던지면, 전역 예외 처리기가 삼켜 준비 없이 멈췄다(r1.15).
  it('조립 생성이 던지면 준비를 알리지 않고 로그를 비운 뒤 종료 코드 1로 끝낸다', () => {
    const failure = new Error('settings copy not received')
    const posted: unknown[] = []
    const exit = vi.fn()
    mocks.initLog.mockImplementation(() => log)
    expect(() =>
      runHostProcess({
        name: 'agent-host',
        parent: { postMessage: (message) => posted.push(message), on: () => {} },
        argv: ['node', 'entry.js', hostEnvironmentArg(testHostEnvironment())],
        exit,
        create: () => {
          throw failure
        }
      })
    ).toThrow(failure)
    expect(posted).toEqual([])
    expect(log.error).toHaveBeenCalledWith('host.start.failed', failure, {
      host: 'agent-host',
      stage: 'create'
    })
    expect(mocks.flushLogSync).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('조립이 셸에 보내는 메시지는 부모 포트로 간다', () => {
    const h = setup('data-host')
    h.context().toShell({ type: 'peer.ensure' })
    expect(h.posted).toEqual([{ type: 'peer.ensure' }])
  })

  it.each([
    ['rejection', 'app.unhandled.rejection'],
    ['exception', 'app.uncaught.exception']
  ] as const)('전역 %s 는 오류 보고 1건으로 남기고 로그를 비운다', (kind, event) => {
    const h = setup('agent-host')
    const error = new Error('boom')
    h.onError()(kind, error)
    expect(mocks.reportError).toHaveBeenCalledExactlyOnceWith({
      event,
      scope: 'app',
      title: 'unexpected',
      level: 'error',
      error
    })
    expect(mocks.flushLogSync).toHaveBeenCalledOnce()
  })
})
