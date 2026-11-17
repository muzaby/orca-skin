// 호스트 쪽 파티션 세션 (0324 AC27′ · EP-10′ — "파티션 세션 요청은 셸 서비스가 한다").
//
// 인증 코드가 받는 `BrowserSessionPort` 를 셸 서비스 위에 세운다. Electron `session`·`BrowserWindow` 는
// 셸만 연다:
// - `register`·`acquire` 는 동기다 — 핸들은 호스트가 불투명 값으로 발급하고(그룹 이름이 renderer·
//   provider 로 새지 않게), 정책 등록은 셸에 순서대로 보낸다. 같은 채널의 순서가 뒤따르는 요청보다
//   등록을 먼저 처리하게 한다.
// - 로그인 창이 끝났는지(`isDone`)는 호스트가 판정한다. 셸은 이동할 때마다 묻고(`login.navigated`)
//   호스트가 `session.loginVerdict` 로 답한다. 판정 함수는 배포가 준 클로저라 경계를 넘지 못한다.
// 이 파일은 Electron 을 모른다.

import type { BrowserSessionPort } from '../../features/auth/specs/browser-session'
import type { SessionGroupPolicy } from '../../infra/browser-session-policy'
import type {
  ShellServiceArgs,
  ShellServiceName,
  ShellServiceResults
} from '../../../shared/shell-services'

export interface ShellSessionClient {
  call<N extends ShellServiceName>(
    name: N,
    ...args: ShellServiceArgs<N>
  ): Promise<ShellServiceResults[N]>
  onLoginNavigated(listener: (loginId: string, seq: number, url: string) => void): () => void
}

export function createShellBrowserSessions(
  shell: ShellSessionClient,
  options: { onRegisterError?(error: unknown): void; randomId?(): string } = {}
): BrowserSessionPort {
  const groups = new Set<string>()
  const handles = new Map<string, string>()
  const randomId = options.randomId ?? (() => Math.random().toString(36).slice(2, 10))
  let seq = 0
  // 진행 중 로그인 창의 판정 함수.
  const logins = new Map<string, (url: string) => boolean>()

  shell.onLoginNavigated((loginId, navigation, url) => {
    const isDone = logins.get(loginId)
    if (!isDone) return
    let done = false
    try {
      done = isDone(url)
    } catch {
      done = false
    }
    void shell.call('session.loginVerdict', loginId, navigation, done).catch(() => undefined)
  })

  const groupOf = (handleId: string): string => {
    const group = handles.get(handleId)
    if (!group) throw new Error('유효하지 않은 browser session handle')
    return group
  }

  return {
    register(policy: SessionGroupPolicy) {
      groups.add(policy.sessionGroup)
      void shell
        .call('session.register', {
          sessionGroup: policy.sessionGroup,
          allowedOrigins: [...policy.allowedOrigins],
          ...(policy.allowIntegratedAuthDomains
            ? { allowIntegratedAuthDomains: [...policy.allowIntegratedAuthDomains] }
            : {})
        })
        .catch((error: unknown) => options.onRegisterError?.(error))
    },
    acquire(sessionGroup) {
      for (const [handleId, group] of handles) if (group === sessionGroup) return handleId
      if (!groups.has(sessionGroup)) throw new Error(`등록되지 않은 session group: ${sessionGroup}`)
      const handleId = `bs_${++seq}_${randomId()}`
      handles.set(handleId, sessionGroup)
      return handleId
    },
    async openLoginWindow(handleId, opts) {
      const loginId = `login_${++seq}_${randomId()}`
      logins.set(loginId, opts.isDone)
      try {
        return await shell.call('session.openLogin', groupOf(handleId), { loginId, url: opts.url })
      } finally {
        logins.delete(loginId)
      }
    },
    send: (handleId, req, sendOptions) =>
      shell.call(
        'session.send',
        groupOf(handleId),
        {
          url: req.url,
          method: req.method,
          headers: req.headers,
          ...(req.body !== undefined ? { body: req.body } : {})
        },
        sendOptions
      ),
    clear: (handleId, opts) => shell.call('session.clear', groupOf(handleId), opts)
  }
}
