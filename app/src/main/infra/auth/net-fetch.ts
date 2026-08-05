// Chromium 네트워크 스택 전송자 (0173) — main 의 원격 요청은 전부 이걸 탄다.
//
// ── 왜 Node 전역 fetch 가 아닌가 ──────────────────────────────────────────────
// Node(undici) 스택과 Chromium 스택은 폐쇄망 사내 배포에서 세 가지가 결정적으로 다르다:
//   1. **프록시** — Chromium 은 OS 프록시 설정·PAC 를 따르고, undici 는 따르지 않는다.
//   2. **인증서** — Chromium 은 OS 신뢰 저장소를 본다. undici 는 Node 자체 CA 번들만 보므로
//      사내 사설 CA 로 서명된 서버는 검증에 실패한다 — *브라우저로는 열리는데 앱만 안 되는*
//      증상이 여기서 나온다.
//   3. **클라이언트 인증서·세션 설정**이 붙지 않는다.
//
// ── `redirect:'manual'` 은 net.fetch 로 못 한다 (0174) ────────────────────────
// Electron 의 manual 은 웹 fetch 규약과 달리 **리다이렉트에서 요청을 취소**한다(3xx 를 돌려주지
// 않는다). 그런데 `broker.sendFollowingRedirects` 는 **3xx 를 받아** 정책을 재검사하고 다음 홉을
// 보내도록 설계돼 있다(0160) — 그대로 두면 첨부 다운로드가 끊긴다. 그래서 manual 요청만
// `net.request` 기반 `sendOnceAsResponse` 로 우회한다(그쪽은 redirect 이벤트를 받아 3xx 를 만든다).
//
// ── 이 파일을 테스트가 import 하지 않는다 (P29) ──────────────────────────────
// electron 을 무는 파일이므로 컴포지션 루트(`app/bootstrap.ts`)만 import 한다. 소비자는
// `typeof fetch` 포트로 주입받는다.

import { net } from 'electron'
import { sendOnceAsResponse } from './net-request'

export const netFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  // manual 은 "3xx 를 그대로 돌려달라" 는 뜻이다 — net.fetch 는 그걸 못 하므로 우회한다.
  if (init?.redirect === 'manual') {
    return sendOnceAsResponse({
      url,
      ...(init.method !== undefined ? { method: init.method } : {}),
      ...(init.headers !== undefined ? { headers: toHeaderRecord(init.headers) } : {}),
      ...(typeof init.body === 'string' ? { body: init.body } : {}),
      ...(init.credentials !== undefined ? { credentials: init.credentials } : {}),
      ...(init.signal !== null && init.signal !== undefined ? { signal: init.signal } : {})
    })
  }

  // 그 밖(follow·error·미지정)은 net.fetch 의 동작이 규약과 같다.
  return net.fetch(input as string | Request, { ...init, bypassCustomProtocolHandlers: true })
}

function toHeaderRecord(headers: HeadersInit): Record<string, string> {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...headers }
}
