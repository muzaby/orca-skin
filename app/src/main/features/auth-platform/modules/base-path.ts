// 컨텍스트 경로 정규화 — 패키지 공용 (0176 에서 confluence 사본을 승격).
//
// `baseUrl` 은 경로 없는 origin 이어야 하므로(manifest `OriginSchema`) 컨텍스트 경로
// (`/confluence`·`/api`)는 connector 가 요청 경로 앞에 붙인다. 사람이 손으로 적는 값이라
// 끝의 `/`·빠진 선두 `/` 를 흡수한다 — 그 한 글자가 경로를 통째로 어긋나게 한다.

export function normalizeBasePath(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '' || trimmed === '/') return ''
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading
}
