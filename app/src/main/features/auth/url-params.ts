// URL 파라미터 조회 — **쿼리와 프래그먼트를 모두 본다** (0197 A-3).
//
// 두 흐름이 같은 규칙을 쓴다: OAuth 콜백(`oauth.ts` 의 `parseCallbackUrl`)과 browser-session 의
// 로그인 final URL(`specs/browser-session.ts` 의 `pickUrlParam`). 프래그먼트를 보는 이유도 같다 —
// `response_mode=fragment` 로 돌려주는 배포가 있다.
//
// **공유 조각은 `string | null` lookup 이지 그 위의 정책이 아니다.** 두 소비자의 빈 문자열
// 규칙이 다르기 때문이다 — `parseCallbackUrl` 은 `''` 를 값으로 유지하고(`code=` 로 끝난 콜백을
// error 규약으로 따로 판정한다), `pickUrlParam` 은 `''` 를 버린다(빈 코드로 교환을 내보내면
// 실패 사유가 SP 응답으로 미뤄진다). 그 차이는 각자 위에 얹는다.

// 파싱에 실패하면 `null` — 호출부가 "이 URL 은 우리 것이 아니다" 로 접는다.
export function urlParams(rawUrl: string): ((name: string) => string | null) | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''))
  return (name) => url.searchParams.get(name) ?? fragment.get(name)
}
