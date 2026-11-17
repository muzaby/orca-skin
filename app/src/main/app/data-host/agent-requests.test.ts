import { describe, expect, it, vi } from 'vitest'
import {
  createRemoteExtensionDeploy,
  createRemoteHarnessHost,
  createRemoteShellRunner
} from './agent-requests'

// 0324 EP-21′ — 데이터 호스트 조립의 교차 요청 5자리: 확보 4(`runShell`·`harnessInstalled`·
// `harnessListModels`·`deployExtensions`) · 확보 안 함 1(`cancelShell`).
function fakeLink(): {
  calls: Array<{ via: 'request' | 'requestEnsured'; op: string; args: unknown[] }>
  link: {
    request: ReturnType<typeof vi.fn>
    requestEnsured: ReturnType<typeof vi.fn>
  }
} {
  const calls: Array<{ via: 'request' | 'requestEnsured'; op: string; args: unknown[] }> = []
  const link = {
    request: vi.fn(async (op: string, ...args: unknown[]) => {
      calls.push({ via: 'request', op, args })
      return undefined
    }),
    requestEnsured: vi.fn(async (op: string, ...args: unknown[]) => {
      calls.push({ via: 'requestEnsured', op, args })
      return `result:${op}`
    })
  }
  return { calls, link }
}

describe('예약 셸 명령 (runShell 확보 · cancelShell 확보 안 함)', () => {
  it('실행은 확보 요청으로 가고 실행 id 는 부를 때마다 새로 매긴다', async () => {
    const f = fakeLink()
    const run = createRemoteShellRunner(() => f.link as never)
    const input = { command: 'echo 1', cwd: '/work', timeoutMs: 777, maxOutputBytes: 99 }
    await expect(run(input)).resolves.toBe('result:runShell')
    await run({ ...input, command: 'echo 2' })
    expect(f.calls).toEqual([
      {
        via: 'requestEnsured',
        op: 'runShell',
        args: [
          { runId: 'run_1', command: 'echo 1', cwd: '/work', timeoutMs: 777, maxOutputBytes: 99 }
        ]
      },
      {
        via: 'requestEnsured',
        op: 'runShell',
        args: [
          { runId: 'run_2', command: 'echo 2', cwd: '/work', timeoutMs: 777, maxOutputBytes: 99 }
        ]
      }
    ])
  })

  it('실행 중 중단은 같은 실행 id 의 취소를 확보 없이 보낸다 — 취소 실패는 삼킨다', async () => {
    const f = fakeLink()
    let finish!: (value: unknown) => void
    f.link.requestEnsured.mockImplementationOnce(async (op: string, ...args: unknown[]) => {
      f.calls.push({ via: 'requestEnsured', op, args })
      return new Promise((resolve) => (finish = resolve))
    })
    f.link.request.mockImplementationOnce(async (op: string, ...args: unknown[]) => {
      f.calls.push({ via: 'request', op, args })
      throw new Error('peer gone')
    })
    const run = createRemoteShellRunner(() => f.link as never)
    const controller = new AbortController()
    const pending = run({
      command: 'sleep',
      cwd: '/w',
      signal: controller.signal,
      timeoutMs: 1,
      maxOutputBytes: 1
    })
    await vi.waitFor(() => expect(f.calls).toHaveLength(1))
    controller.abort()
    await vi.waitFor(() => expect(f.calls).toHaveLength(2))
    expect(f.calls[1]).toEqual({ via: 'request', op: 'cancelShell', args: ['run_1'] })
    finish('done')
    await expect(pending).resolves.toBe('done')
  })

  it('끝난 실행의 중단 신호는 취소를 보내지 않는다', async () => {
    const f = fakeLink()
    const run = createRemoteShellRunner(() => f.link as never)
    const controller = new AbortController()
    await run({
      command: 'x',
      cwd: '/w',
      signal: controller.signal,
      timeoutMs: 1,
      maxOutputBytes: 1
    })
    controller.abort()
    expect(f.link.request).not.toHaveBeenCalled()
  })
})

describe('로그인 프리 연결의 하네스 능력 (확보)', () => {
  it('설치 판정과 모델 목록은 확보 요청이다 — 환경 변수는 복사해 넘기고 없으면 비운다', async () => {
    const f = fakeLink()
    const host = createRemoteHarnessHost(() => f.link as never)
    await expect(host.installed('opencode')).resolves.toBe('result:harnessInstalled')
    const env = { TOKEN_A: 'a-value' }
    await host.listModels('opencode', 'team', { env })
    await host.listModels('claude', 'solo', {})
    expect(f.calls).toEqual([
      { via: 'requestEnsured', op: 'harnessInstalled', args: ['opencode'] },
      { via: 'requestEnsured', op: 'harnessListModels', args: ['opencode', 'team', env] },
      { via: 'requestEnsured', op: 'harnessListModels', args: ['claude', 'solo', undefined] }
    ])
    expect(f.calls[1]!.args[2]).not.toBe(env)
  })
})

describe('확장 배포 (확보)', () => {
  it('관리형 MCP 를 먼저 다시 계산하고 배포를 확보 요청으로 보낸다 — 옵션을 그대로 싣는다', async () => {
    const f = fakeLink()
    const order: string[] = []
    const refresh = vi.fn(() => void order.push('refresh'))
    f.link.requestEnsured.mockImplementation(async (op: string) => {
      order.push(op)
    })
    const deploy = createRemoteExtensionDeploy(() => f.link as never, refresh)
    await deploy({ throwOnFailure: true })
    await deploy()
    expect(order).toEqual(['refresh', 'deployExtensions', 'refresh', 'deployExtensions'])
    expect(f.link.requestEnsured.mock.calls).toEqual([
      ['deployExtensions', { throwOnFailure: true }],
      ['deployExtensions', undefined]
    ])
    expect(f.link.request).not.toHaveBeenCalled()
  })

  it('배포 실패는 부른 쪽으로 간다', async () => {
    const f = fakeLink()
    f.link.requestEnsured.mockRejectedValueOnce(new Error('에이전트 호스트를 띄우지 못했다'))
    const deploy = createRemoteExtensionDeploy(() => f.link as never, vi.fn())
    await expect(deploy()).rejects.toThrow('띄우지 못했다')
  })
})
