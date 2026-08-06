// Browser session store (0157) — session group → Electron `Session` 매핑과 통제된 로그인 창.
//
// 구 `features/sso/auth-window.ts` 를 이식하면서 두 가지를 바꿨다:
//   1. 전용 `'sso'` 파티션 하드코딩 → **session group 별 `persist:auth.<group>`**.
//      같은 group 을 지정한 대상들은 **같은 cookie jar 를 직접 공유**한다(복사 아님) —
//      ADFS SSO cookie 가 각 서비스의 redirect 에서 재사용되고, 서비스별 cookie 도 같은 jar 에
//      저장되지만 domain 규칙에 따라 교차 전송되지 않는다.
//   2. **쿠키 통째 반환 표면 제거.** 구 openAuthWindow 는 `cookies[]` 를 호출자에게 돌려줬다.
//      이제 handle 과 최종 URL·probe 판정만 준다 (AUTH-PLAT-008).
//
// 외부 URL 로드는 이 창에 한정된 의도적 예외다 — 앱 본창의 setWindowOpenHandler 차단 정책은
// 불변(docs/arch/backend/security.md).
//
// 레이어: infra → infra·shared 만.

import { BrowserWindow, session, type Session } from 'electron'
import { getLogger } from '../log/registry'
// 판정 로직은 electron 비의존 모듈에 있다(테스트 가능) — 0157 verify r1 / D1·D7.
import {
  classifyProbeChain,
  isAbortedNavigationError,
  isAllowedOrigin,
  MAX_PROBE_HOPS,
  partitionFor,
  type BrowserProbeResult
} from './session-policy'
import { locationOf } from './net-response'
import { sendOnce } from './net-request'
import {
  ResponseTooLargeError,
  type PreparedRequest,
  type SendOptions,
  type SendResult
} from './authenticated-fetch'

export type { BrowserProbeResult } from './session-policy'
export { classifyProbeResponse, isAllowedOrigin, partitionFor } from './session-policy'

const DEFAULT_TIMEOUT_MS = 300_000

export interface LoginWindowOptions {
  url: string
  isDone(url: string): boolean
  width?: number
  height?: number
  timeoutMs?: number
}

export interface SessionGroupPolicy {
  sessionGroup: string
  // 이 창이 navigate 할 수 있는 origin. 밖으로 나가는 redirect 는 차단된다.
  allowedOrigins: readonly string[]
  // WIA(Negotiate/NTLM) 자동 자격증명을 허용할 도메인. ADFS 호스트로 제한하며 wildcard 금지.
  //
  // ⚠️ Electron 에서 통합 인증 허용 도메인은 per-session `allowNTLMCredentialsForDomains()` 와
  // 프로세스 전역 `--auth-server-allowlist` 스위치가 서로 다른 층위로 존재한다. 여기서는
  // per-session API 만 쓴다 — group 별 분리가 실제로 성립하는지는 실기 확인 항목이며,
  // 분리가 불가능하면 이 필드는 전역 합집합 의미로 강등된다(0157 plan §게이트).
  allowIntegratedAuthDomains?: readonly string[]
}

interface Entry {
  sessionGroup: string
  ses: Session
  policy: SessionGroupPolicy
}

export class BrowserSessionStore {
  private readonly entries = new Map<string, Entry>()

  // handleId 는 session group 을 그대로 쓰지 않는다 — renderer/provider 에 partition 문자열이나
  // group 이름이 새지 않도록 불투명 핸들을 발급한다.
  private readonly handles = new Map<string, string>()
  private seq = 0

  // 정책 등록. 같은 group 을 두 provider 가 선언하면 origin allowlist 를 합집합으로 넓힌다
  // (같은 cookie jar 를 의도적으로 공유하는 경우).
  register(policy: SessionGroupPolicy): void {
    const existing = this.entries.get(policy.sessionGroup)
    if (!existing) return void this.create(policy)
    existing.policy = {
      ...existing.policy,
      allowedOrigins: [...new Set([...existing.policy.allowedOrigins, ...policy.allowedOrigins])],
      allowIntegratedAuthDomains: [
        ...new Set([
          ...(existing.policy.allowIntegratedAuthDomains ?? []),
          ...(policy.allowIntegratedAuthDomains ?? [])
        ])
      ]
    }
    this.applyIntegratedAuth(existing)
  }

  private create(policy: SessionGroupPolicy): void {
    const ses = session.fromPartition(partitionFor(policy.sessionGroup))
    const entry: Entry = { sessionGroup: policy.sessionGroup, ses, policy }
    this.entries.set(policy.sessionGroup, entry)
    this.applyIntegratedAuth(entry)
  }

  private applyIntegratedAuth(entry: Entry): void {
    const domains = entry.policy.allowIntegratedAuthDomains ?? []
    // 빈 목록이면 자동 자격증명을 아무 도메인에도 보내지 않는다(명시 allowlist 만).
    entry.ses.allowNTLMCredentialsForDomains(domains.join(','))
  }

  // session group 의 handle 발급. 같은 group 이면 같은 handle 을 재사용한다.
  acquire(sessionGroup: string): string {
    for (const [handleId, group] of this.handles) {
      if (group === sessionGroup) return handleId
    }
    if (!this.entries.has(sessionGroup)) {
      throw new Error(`등록되지 않은 session group: ${sessionGroup}`)
    }
    const handleId = `bs_${++this.seq}_${Math.random().toString(36).slice(2, 10)}`
    this.handles.set(handleId, sessionGroup)
    return handleId
  }

  private entryOf(handleId: string): Entry {
    const group = this.handles.get(handleId)
    const entry = group ? this.entries.get(group) : undefined
    if (!entry) throw new Error('유효하지 않은 browser session handle')
    return entry
  }

  async openLoginWindow(handleId: string, opts: LoginWindowOptions): Promise<{ finalUrl: string }> {
    const entry = this.entryOf(handleId)
    if (!isAllowedOrigin(opts.url, entry.policy.allowedOrigins)) {
      throw new Error('허용되지 않은 origin 으로의 로그인 창 요청')
    }
    return openWindow(entry, opts)
  }

  // 같은 세션으로 요청하고 **판정만** 돌려준다. 응답 본문·쿠키는 반환하지 않는다.
  //
  // **리다이렉트를 우리가 직접 돈다 (0174).** 두 가지가 바뀌었다:
  //
  //   1. `ses.fetch(..., {redirect:'manual'})` 을 버렸다 — Electron 의 manual 은 3xx 에서 요청을
  //      **취소**해버려(웹 fetch 규약과 다르다) probe 가 예외로 죽었다. `sendOnce` 는
  //      `net.request` 의 redirect 이벤트로 3xx 를 받아 돌려준다.
  //   2. 0157 D1 의 "3xx = 미인증" 을 **최종 origin 기준**으로 대체했다. 이 배포는 인증에
  //      성공해도 probe 가 302 로 로그인 URL 을 가리키고 그 체인이 자동 완주하는 구조라,
  //      3xx 를 곧 미인증으로 접으면 로그인이 **영원히** 성립하지 않는다(실측).
  //
  // D1 의 목적(로그인 폼의 200 을 성공으로 오독하지 않기)은 그대로다 — 체인이 IdP origin 에
  // 머문 채 끝나면 여전히 미인증이다. 홉마다 allowlist 를 먼저 확인하므로 세션이 통제 밖
  // origin 으로 끌려가지도 않는다.
  async probe(handleId: string, url: string): Promise<BrowserProbeResult> {
    const entry = this.entryOf(handleId)
    if (!isAllowedOrigin(url, entry.policy.allowedOrigins)) {
      throw new Error('허용되지 않은 origin 으로의 probe 요청')
    }

    let currentUrl = url
    let status = 0
    let hops = 0
    let stopped: 'outside_allowlist' | 'too_many_hops' | undefined

    for (;;) {
      const { facts } = await sendOnce({
        url: currentUrl,
        session: entry.ses,
        // 세션의 쿠키·통합 인증(WIA)을 실어야 probe 가 의미를 갖는다.
        credentials: 'include'
      })
      status = facts.status
      const next = locationOf(facts, currentUrl)
      if (next === null) break
      if (hops >= MAX_PROBE_HOPS) {
        stopped = 'too_many_hops'
        break
      }
      if (!isAllowedOrigin(next, entry.policy.allowedOrigins)) {
        stopped = 'outside_allowlist'
        currentUrl = next
        break
      }
      currentUrl = next
      hops += 1
    }

    const verdict = classifyProbeChain({
      probeUrl: url,
      finalUrl: currentUrl,
      status,
      hops,
      ...(stopped !== undefined ? { stopped } : {})
    })
    if (verdict.redirectOutsideAllowlist) {
      getLogger()
        .child('auth')
        .warn('auth.probe.redirect-outside-allowlist', {
          sessionGroup: entry.sessionGroup,
          // 어느 origin 을 선언해야 하는지 로그가 지목하게 한다 — 경로·쿼리는 싣지 않는다.
          blockedOrigin: safeOrigin(currentUrl)
        })
    }
    // 실패 판정의 근거를 남긴다. 이게 없으면 "로그인이 안 된다" 만 보이고 다음 수정 지점이 없다.
    if (!verdict.result.ok) {
      getLogger()
        .child('auth')
        .info('auth.probe.unauthenticated', {
          sessionGroup: entry.sessionGroup,
          status,
          hops,
          finalOrigin: safeOrigin(currentUrl),
          ...(stopped !== undefined ? { stopped } : {})
        })
    }
    return verdict.result
  }

  // 같은 세션(cookie jar·통합 인증)으로 **실제 요청**을 보낸다 (0178). probe 와 달리 응답 본문을
  // 그대로 돌려준다 — SSO 로그인으로 사내 REST 를 부르는 경로가 여기다.
  //
  // 리다이렉트는 **따라가지 않는다.** 홉마다 대상 정책을 다시 봐야 하므로 추종은 호출자
  // (`features/auth-platform/api.ts`)의 몫이다 — `sendOnce` 계약 그대로다.
  //
  // 상한은 응답을 다 받은 뒤에 잰다. `net.request` 가 본문을 모아서 주므로 스트리밍 중단 지점이
  // 없다 — credential 주입 경로(`createSender`)의 스트리밍 상한과 다른 점이고, 첨부 다운로드는
  // 그쪽 경로를 쓴다.
  async send(
    handleId: string,
    req: PreparedRequest,
    options?: SendOptions,
    signal?: AbortSignal
  ): Promise<SendResult> {
    const entry = this.entryOf(handleId)
    if (!isAllowedOrigin(req.url, entry.policy.allowedOrigins)) {
      throw new Error('허용되지 않은 origin 으로의 요청')
    }
    const { facts, body } = await sendOnce({
      url: req.url,
      method: req.method,
      headers: req.headers,
      ...(req.body !== undefined ? { body: req.body } : {}),
      session: entry.ses,
      credentials: 'include',
      ...(signal ? { signal } : {})
    })
    const bytes = body ?? new Uint8Array(0)
    const limit = options?.maxBytes
    if (limit !== undefined && bytes.byteLength > limit) {
      throw new ResponseTooLargeError(bytes.byteLength, limit)
    }
    const headers = normalizeHeaders(facts.headers)
    if (options?.responseType === 'binary') {
      return { status: facts.status, headers, body: '', bodyBytes: bytes }
    }
    return { status: facts.status, headers, body: Buffer.from(bytes).toString('utf8') }
  }

  // scope='origin' 은 해당 origin 쿠키만, 'group' 은 session group 전체를 비운다.
  // connector-only disconnect 가 공유 세션을 통째로 날리지 않게 기본은 호출부에서 'origin'.
  async clear(
    handleId: string,
    opts: { scope: 'origin' | 'group'; origin?: string }
  ): Promise<void> {
    const entry = this.entryOf(handleId)
    if (opts.scope === 'group') {
      await entry.ses.clearStorageData({ storages: ['cookies'] })
      return
    }
    if (!opts.origin) throw new Error("scope='origin' 에는 origin 이 필요합니다")
    const cookies = await entry.ses.cookies.get({ url: opts.origin })
    await Promise.all(
      cookies.map((c) =>
        entry.ses.cookies.remove(opts.origin as string, c.name).catch(() => undefined)
      )
    )
  }

  // 앱 종료·전체 로그아웃 시 모든 group 정리.
  async clearAll(): Promise<void> {
    await Promise.all(
      [...this.entries.values()].map((e) =>
        e.ses.clearStorageData({ storages: ['cookies'] }).catch(() => undefined)
      )
    )
  }
}

function openWindow(entry: Entry, opts: LoginWindowOptions): Promise<{ finalUrl: string }> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: opts.width ?? 480,
      height: opts.height ?? 640,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: partitionFor(entry.sessionGroup)
      }
    })
    let settled = false
    const timer = setTimeout(
      () => fail(new Error('로그인 창 타임아웃')),
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    )
    function finish(finalUrl: string): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!win.isDestroyed()) win.destroy()
      // 쿠키는 세션(=cookie jar)에 남고 호출자에게 넘기지 않는다.
      resolve({ finalUrl })
    }
    function fail(err: Error): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!win.isDestroyed()) win.destroy()
      reject(err)
    }
    const check = (url: string): void => {
      if (opts.isDone(url)) return finish(url)
      // allowlist 밖으로 나가는 내비게이션은 차단한다(피싱·토큰 유출 경로 차단).
      if (!isAllowedOrigin(url, entry.policy.allowedOrigins)) {
        getLogger()
          .child('auth')
          .warn('auth.browser.navigation-blocked', {
            sessionGroup: entry.sessionGroup,
            // 어느 origin 을 allowedOrigins 에 넣어야 하는지 로그가 지목하게 한다.
            blockedOrigin: safeOrigin(url)
          })
        fail(new Error('허용되지 않은 origin 으로 이동'))
      }
    }
    win.webContents.on('did-navigate', (_e, url) => check(url))
    win.webContents.on('will-redirect', (_e, url) => check(url))
    // popup·새 창·download 는 차단한다.
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.on('closed', () => fail(new Error('사용자가 로그인 창을 닫았습니다')))
    void win.loadURL(opts.url).catch((err) => {
      // **ERR_ABORTED(-3) 는 실패가 아니다 (0174).** SSO 는 로그인 URL 이 곧바로 IdP 로 튀는 것이
      // 정상이고, 그때 최초 로드는 "대체됨" 으로 거절된다. 이것을 치명으로 보고 창을 destroy 해서
      // **로그인 창이 아예 뜨지 않았다.** 결말은 내비게이션 이벤트·타임아웃·사용자 닫기가 정한다.
      if (isAbortedNavigationError(err)) {
        getLogger()
          .child('auth')
          .info('auth.browser.load-superseded', { sessionGroup: entry.sessionGroup })
        return
      }
      fail(err instanceof Error ? err : new Error(String(err)))
    })
  })
}

// `net.request` 헤더는 값이 배열로 올 수 있다 — 소비자(`InternalApiResponse`)는 문자열만 안다.
function normalizeHeaders(raw: Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(raw)) {
    out[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value
  }
  return out
}

// URL 에서 origin 만 뽑는다 — 로그에 경로·쿼리(토큰이 실릴 수 있다)를 싣지 않기 위해서다.
function safeOrigin(rawUrl: string): string {
  try {
    return new URL(rawUrl).origin
  } catch {
    return ''
  }
}
