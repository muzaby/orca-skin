// browser-session-store 의 **순수 부분**만 검증한다 (0157 verify r1 / D1·D7).
// 클래스 본체는 Electron `session`/`BrowserWindow` 의존이라 여기서 다루지 않는다 —
// 실동작(파티션 공유·WIA)은 사람 실기 항목.

import { describe, expect, it } from 'vitest'
import {
  classifyProbeChain,
  classifyProbeResponse,
  isAbortedNavigationError,
  isAllowedOrigin,
  MAX_PROBE_HOPS,
  partitionFor
} from './session-policy'

const ADFS = 'https://adfs.corp.invalid'
const WIKI = 'https://wiki.corp.invalid'
const ALLOWED = [ADFS, WIKI]

describe('partitionFor — session group 격리 (AC6)', () => {
  it('group 이름이 partition 에 1:1 로 매핑된다', () => {
    expect(partitionFor('corp-adfs')).toBe('persist:auth.corp-adfs')
  })

  it('다른 group 은 다른 partition 을 얻는다 (cookie jar 격리)', () => {
    expect(partitionFor('corp-adfs')).not.toBe(partitionFor('partner-idp'))
  })

  it('같은 group 은 항상 같은 partition 이다 (jar 직접 공유 — 복사 아님)', () => {
    expect(partitionFor('corp-adfs')).toBe(partitionFor('corp-adfs'))
  })

  it('persist: 접두사를 써서 세션이 앱 재시작을 넘어 유지된다', () => {
    expect(partitionFor('x').startsWith('persist:')).toBe(true)
  })
})

describe('classifyProbeResponse — 3xx 는 미인증 (D1 회귀)', () => {
  it('200 은 인증됨', () => {
    const v = classifyProbeResponse({
      status: 200,
      ok: true,
      location: null,
      requestUrl: `${WIKI}/me`,
      allowedOrigins: ALLOWED
    })
    expect(v.result.ok).toBe(true)
  })

  it('**ADFS 로그인 페이지로 302 되는 응답을 authenticated 로 오판하지 않는다**', () => {
    // 이것이 D1 의 실제 시나리오다. 구 구현은 redirect:'follow' 라 로그인 페이지의 200 을
    // 받아 ok=true 가 됐고, provider 가 valid binding 을 만들었다.
    const v = classifyProbeResponse({
      status: 302,
      ok: false,
      location: `${ADFS}/adfs/ls/?wa=wsignin1.0`,
      requestUrl: `${WIKI}/me`,
      allowedOrigins: ALLOWED
    })
    expect(v.result.ok).toBe(false)
    expect(v.result.status).toBe(302)
    // ADFS 는 allowlist 안이므로 경고 대상이 아니다(정상적인 미인증 흐름).
    expect(v.redirectOutsideAllowlist).toBe(false)
  })

  it('3xx 전 범위를 미인증으로 읽는다', () => {
    for (const status of [301, 302, 303, 307, 308]) {
      const v = classifyProbeResponse({
        status,
        ok: false,
        location: `${ADFS}/login`,
        requestUrl: `${WIKI}/me`,
        allowedOrigins: ALLOWED
      })
      expect(v.result.ok).toBe(false)
    }
  })

  it('allowlist 밖으로의 redirect 를 표시한다', () => {
    const v = classifyProbeResponse({
      status: 302,
      ok: false,
      location: 'https://evil.invalid/harvest',
      requestUrl: `${WIKI}/me`,
      allowedOrigins: ALLOWED
    })
    expect(v.result.ok).toBe(false)
    expect(v.redirectOutsideAllowlist).toBe(true)
  })

  it('상대 Location 을 요청 URL 기준으로 절대화해 판정한다', () => {
    const v = classifyProbeResponse({
      status: 302,
      ok: false,
      location: '/login',
      requestUrl: `${WIKI}/me`,
      allowedOrigins: ALLOWED
    })
    // 같은 origin 이므로 allowlist 안이다.
    expect(v.redirectOutsideAllowlist).toBe(false)
  })

  it('파싱 불가 Location 은 allowlist 밖으로 취급한다(보수적)', () => {
    const v = classifyProbeResponse({
      status: 302,
      ok: false,
      location: 'http://[bad',
      requestUrl: `${WIKI}/me`,
      allowedOrigins: ALLOWED
    })
    expect(v.redirectOutsideAllowlist).toBe(true)
  })

  it('401/403 은 미인증', () => {
    for (const status of [401, 403]) {
      const v = classifyProbeResponse({
        status,
        ok: false,
        location: null,
        requestUrl: `${WIKI}/me`,
        allowedOrigins: ALLOWED
      })
      expect(v.result.ok).toBe(false)
    }
  })
})

describe('isAllowedOrigin (browser session 경로)', () => {
  it('allowlist 안/밖을 가른다', () => {
    expect(isAllowedOrigin(`${ADFS}/adfs/ls`, ALLOWED)).toBe(true)
    expect(isAllowedOrigin('https://evil.invalid/', ALLOWED)).toBe(false)
  })
})

// 0174 — 체인 판정. 0157 D1("3xx = 미인증")을 **최종 origin 기준**으로 대체한다.
describe('classifyProbeChain — 리다이렉트를 따라간 뒤 판정한다', () => {
  const PROBE = `${WIKI}/me`

  it('체인이 probe origin 으로 완주하면 인증이다', () => {
    // 실기 사례: probe → 302 IdP → 302 back → 200. 인증됐는데도 첫 홉이 302 라
    // "3xx = 미인증" 규칙에서는 **어떤 경우에도** 성공할 수 없었다.
    const verdict = classifyProbeChain({
      probeUrl: PROBE,
      finalUrl: `${WIKI}/me`,
      status: 200,
      hops: 2
    })
    expect(verdict.result.ok).toBe(true)
    expect(verdict.redirectOutsideAllowlist).toBe(false)
  })

  it('IdP 로그인 폼에서 멈추면 미인증이다 — 0157 D1 회귀 방지', () => {
    // D1 의 실제 결함: 로그인 폼이 200 을 준다. 최종 origin 이 probe origin 이 아니므로 미인증.
    const verdict = classifyProbeChain({
      probeUrl: PROBE,
      finalUrl: `${ADFS}/adfs/ls?wa=wsignin1.0`,
      status: 200,
      hops: 1
    })
    expect(verdict.result.ok).toBe(false)
  })

  it('probe origin 으로 돌아왔어도 2xx 가 아니면 미인증이다', () => {
    const verdict = classifyProbeChain({ probeUrl: PROBE, finalUrl: PROBE, status: 401, hops: 0 })
    expect(verdict.result.ok).toBe(false)
    expect(verdict.result.status).toBe(401)
  })

  it('allowlist 밖 홉에서 멈추면 미인증 + 경고다', () => {
    const verdict = classifyProbeChain({
      probeUrl: PROBE,
      finalUrl: 'https://evil.example/steal',
      status: 302,
      hops: 1,
      stopped: 'outside_allowlist'
    })
    expect(verdict.result.ok).toBe(false)
    expect(verdict.redirectOutsideAllowlist).toBe(true)
  })

  it('홉 상한을 넘기면 미인증이다 — 로그인 루프', () => {
    // 루프는 probe origin 을 오갈 수 있다. 완주하지 못했으므로 origin 이 같아도 미인증.
    const verdict = classifyProbeChain({
      probeUrl: PROBE,
      finalUrl: PROBE,
      status: 302,
      hops: MAX_PROBE_HOPS,
      stopped: 'too_many_hops'
    })
    expect(verdict.result.ok).toBe(false)
    expect(verdict.redirectOutsideAllowlist).toBe(false)
  })

  it('해석 불가능한 URL 은 미인증으로 접는다', () => {
    const verdict = classifyProbeChain({
      probeUrl: PROBE,
      finalUrl: 'not-a-url',
      status: 200,
      hops: 0
    })
    expect(verdict.result.ok).toBe(false)
  })
})

// 0174 — 로그인 창이 안 뜨던 원인.
describe('isAbortedNavigationError', () => {
  it('errno -3 과 code ERR_ABORTED 를 모두 비치명으로 본다', () => {
    expect(isAbortedNavigationError({ errno: -3, code: 'ERR_ABORTED' })).toBe(true)
    expect(isAbortedNavigationError({ errno: -3 })).toBe(true)
    expect(isAbortedNavigationError({ code: 'ERR_ABORTED' })).toBe(true)
  })

  it('다른 오류는 치명으로 남긴다', () => {
    // 이름 해석 실패·인증서 오류는 진짜 실패다 — 삼키면 빈 창이 떠 있는다.
    expect(isAbortedNavigationError({ errno: -105, code: 'ERR_NAME_NOT_RESOLVED' })).toBe(false)
    expect(isAbortedNavigationError(new Error('로그인 창 타임아웃'))).toBe(false)
    expect(isAbortedNavigationError(null)).toBe(false)
    expect(isAbortedNavigationError('ERR_ABORTED')).toBe(false)
  })
})
