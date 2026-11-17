import { describe, expect, it, vi } from 'vitest'
import { createShellBrowserSessions, type ShellSessionClient } from './shell-browser-session'

function fakeShell(): ShellSessionClient & {
  calls: Array<[string, unknown[]]>
  navigate(loginId: string, seq: number, url: string): void
  results: Map<string, (args: unknown[]) => unknown>
} {
  const calls: Array<[string, unknown[]]> = []
  const listeners = new Set<(loginId: string, seq: number, url: string) => void>()
  const results = new Map<string, (args: unknown[]) => unknown>()
  return {
    calls,
    results,
    call: vi.fn(async (name: string, ...args: unknown[]) => {
      calls.push([name, args])
      return results.get(name)?.(args)
    }) as never,
    onLoginNavigated: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    navigate: (loginId, seq, url) => {
      for (const listener of listeners) listener(loginId, seq, url)
    }
  }
}

describe('셸 서비스 위의 파티션 세션', () => {
  it('정책 등록은 셸에 보내고 핸들은 호스트가 불투명 값으로 발급한다', () => {
    const shell = fakeShell()
    const sessions = createShellBrowserSessions(shell, { randomId: () => 'x' })
    expect(() => sessions.acquire('sso')).toThrow('등록되지 않은 session group')
    sessions.register({ sessionGroup: 'sso', allowedOrigins: ['https://a.corp'] })
    expect(shell.calls).toEqual([
      ['session.register', [{ sessionGroup: 'sso', allowedOrigins: ['https://a.corp'] }]]
    ])
    const handle = sessions.acquire('sso')
    expect(handle).not.toContain('sso')
    expect(sessions.acquire('sso')).toBe(handle)
  })

  it('로그인 창의 이동마다 호스트의 판정을 셸에 답하고, 창이 끝나면 판정 함수를 놓는다', async () => {
    const shell = fakeShell()
    let finish!: (value: { finalUrl: string }) => void
    shell.results.set('session.openLogin', () => new Promise((resolve) => (finish = resolve)))
    const sessions = createShellBrowserSessions(shell, { randomId: () => 'r' })
    sessions.register({ sessionGroup: 'sso', allowedOrigins: [] })
    const handle = sessions.acquire('sso')
    const isDone = vi.fn((url: string) => url.startsWith('https://done/'))
    const opened = sessions.openLoginWindow(handle, { url: 'https://idp/start', isDone })
    await Promise.resolve()
    const [, [group, options]] = shell.calls.find(([name]) => name === 'session.openLogin')!
    const { loginId } = options as { loginId: string; url: string }
    expect(group).toBe('sso')
    expect(options).toEqual({ loginId, url: 'https://idp/start' })
    shell.navigate(loginId, 0, 'https://idp/next')
    shell.navigate('other-login', 0, 'https://done/x')
    shell.navigate(loginId, 1, 'https://done/cb')
    expect(shell.calls.filter(([name]) => name === 'session.loginVerdict')).toEqual([
      ['session.loginVerdict', [loginId, 0, false]],
      ['session.loginVerdict', [loginId, 1, true]]
    ])
    finish({ finalUrl: 'https://done/cb' })
    await expect(opened).resolves.toEqual({ finalUrl: 'https://done/cb' })
    shell.navigate(loginId, 2, 'https://done/late')
    expect(isDone).toHaveBeenCalledTimes(2)
  })

  it('판정 함수가 던지면 끝나지 않은 것으로 답한다', async () => {
    const shell = fakeShell()
    shell.results.set('session.openLogin', () => new Promise(() => {}))
    const sessions = createShellBrowserSessions(shell)
    sessions.register({ sessionGroup: 'g', allowedOrigins: [] })
    void sessions.openLoginWindow(sessions.acquire('g'), {
      url: 'https://idp/',
      isDone: () => {
        throw new Error('bad')
      }
    })
    await Promise.resolve()
    const { loginId } = shell.calls.find(([name]) => name === 'session.openLogin')![1][1] as {
      loginId: string
    }
    shell.navigate(loginId, 0, 'https://idp/a')
    expect(shell.calls.at(-1)).toEqual(['session.loginVerdict', [loginId, 0, false]])
  })

  it('요청과 쿠키 비우기는 그룹 이름으로 셸에 간다 · 모르는 핸들은 던진다', async () => {
    const shell = fakeShell()
    const sessions = createShellBrowserSessions(shell)
    sessions.register({ sessionGroup: 'g', allowedOrigins: [] })
    const handle = sessions.acquire('g')
    await sessions.send(
      handle,
      { url: 'https://a/', method: 'GET', headers: { x: '1' } },
      { responseType: 'binary' }
    )
    await sessions.clear(handle, { scope: 'origin', origin: 'https://a' })
    expect(shell.calls.slice(1)).toEqual([
      [
        'session.send',
        ['g', { url: 'https://a/', method: 'GET', headers: { x: '1' } }, { responseType: 'binary' }]
      ],
      ['session.clear', ['g', { scope: 'origin', origin: 'https://a' }]]
    ])
    expect(() => sessions.send('nope', { url: 'https://a/', method: 'GET', headers: {} })).toThrow(
      '유효하지 않은 browser session handle'
    )
  })
})
