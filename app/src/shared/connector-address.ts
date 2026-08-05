// connector 주소 규칙의 **정본** — origin 형태와 컨텍스트 경로 형태. 순수 술어/상수만이고
// zod 를 물지 않는다.
//
// 왜 `protocol.ts` 가 아니라 별도 파일인가: 이 규칙을 renderer 도 써야 한다(입력 검증을 전송
// 전에 먼저 보여주려고). `protocol.ts` 는 zod 스키마라 **main 전용**이므로(app/AGENTS.md) 거기서
// 가져오면 renderer 번들에 zod 가 딸려 들어간다. 규칙만 여기 두고 zod 는 protocol 이 감싼다.
//
// 이 규칙은 네 자리가 함께 쓴다 — IPC 요청 스키마 · 인스턴스 저장소 · 플러그인 manifest ·
// renderer 입력 검증. 한 벌이 아니면 "여기선 통과, 보내면 거부" 가 조용히 생긴다.

// origin 만 허용한다 — 경로·쿼리·fragment·URL 자격증명·비 http(s) 를 거부한다. SSRF 표면의
// 첫 관문이다(사내망이 목적이라 private IP 는 막지 않는다).
export function isBareOrigin(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    // URL 자격증명(`https://u:p@host`)은 origin 문자열에 안 실리므로 원문으로 판별한다.
    if (url.username !== '' || url.password !== '') return false
    return raw === url.origin
  } catch {
    return false
  }
}

// 컨텍스트 경로 — 앞 `/` 필수, 뒤 `/` 금지, 쿼리·fragment 금지.
export const API_BASE_PATH_PATTERN = /^\/[A-Za-z0-9\-._~/]*[A-Za-z0-9\-._~]$/
