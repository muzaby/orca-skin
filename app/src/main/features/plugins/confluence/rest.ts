// Confluence Data Center REST 요청 빌더 (0160) — **순수 함수만**. 네트워크·fs 의존 0.
//
// 요청을 여기서 조립하는 이유는 실패 축이 대부분 "요청을 어떻게 만들었는가" 에 있기 때문이다:
//   - 첨부 다운로드는 XSRF 보호 대상이라 `X-Atlassian-Token: nocheck` 가 없으면 거부된다.
//   - 컨텍스트 경로(`https://host/confluence`) 배포는 origin 에 경로를 넣을 수 없으므로
//     (등록이 형태를 강제한다) prefix 를 요청 path 마다 붙여야 한다.
//   - CQL 은 문자열 질의라 사용자 입력을 그대로 이으면 질의가 깨지거나 의도와 달라진다.
// 전부 문자열 조립이므로 실서버 없이 단위 테스트로 고정할 수 있다.

import type { ProviderRequest } from '../../../contracts/auth'

// Confluence DC 의 REST 진입점. Cloud(`/wiki/rest/api`)는 이번 범위가 아니다.
const REST_PREFIX = '/rest/api'

// 첨부 다운로드 엔드포인트의 XSRF 보호를 통과하기 위한 헤더. 참조 구현
// (`@atlassian-dc-mcp/common@0.29.0` `build/attachment-download.js:54-59`)도 같은 값을 쓴다.
export const XSRF_HEADER = { 'X-Atlassian-Token': 'nocheck' } as const

export interface ConfluenceEndpoint {
  // 컨텍스트 경로. 없으면 ''. 앞에 '/' 가 붙고 뒤에는 안 붙는 형태로 정규화된다.
  apiBasePath: string
}

// `/confluence/`, `confluence`, '' 를 모두 `/confluence` · '' 로 정규화한다. 배포마다 사람이
// 적는 값이라 형태를 강제하지 않고 여기서 흡수한다.
// 패키지 공용으로 승격(0176) — usage connector 도 같은 규칙을 쓴다. 기존 import 경로 무회귀.
export { normalizeBasePath } from './base-path'

function restPath(endpoint: ConfluenceEndpoint, suffix: string): string {
  return `${endpoint.apiBasePath}${REST_PREFIX}${suffix}`
}

// CQL 문자열 리터럴 이스케이프. CQL 은 `"` 로 감싼 리터럴 안에서 `\` 로 이스케이프한다 —
// 역슬래시를 **먼저** 치환해야 이스케이프 문자 자체가 두 번 처리되지 않는다.
export function escapeCqlLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export interface SearchInput {
  cql?: string
  text?: string
  spaceKey?: string
  limit?: number
  // 페이지네이션 오프셋(Confluence 의 `start`). 이전 응답의 `nextStart` 를 그대로 넣는다.
  start?: number
}

// 검색 CQL 을 만든다. `cql` 이 오면 그대로 쓰고(고급 사용자), 아니면 text/spaceKey 로 조립한다.
export function buildSearchCql(input: SearchInput): string {
  if (input.cql !== undefined && input.cql.trim() !== '') return input.cql.trim()
  const clauses = ['type = page']
  if (input.spaceKey !== undefined && input.spaceKey.trim() !== '') {
    clauses.push(`space = "${escapeCqlLiteral(input.spaceKey.trim())}"`)
  }
  if (input.text !== undefined && input.text.trim() !== '') {
    clauses.push(`text ~ "${escapeCqlLiteral(input.text.trim())}"`)
  }
  return clauses.join(' AND ')
}

// 한 번의 도구 호출이 가져오는 최대 건수 (사용자 결정 2026-08-04 — "1턴의 limit 은 50까지").
// **서버가 더 낮은 값을 적용하면 그 값을 따른다** — 응답의 `limit` 이 실효 페이지 크기이고,
// 다음 오프셋은 요청값이 아니라 그 실효값으로 밀어야 건너뛰거나 겹치지 않는다.
export const MAX_SEARCH_LIMIT = 50
const DEFAULT_SEARCH_LIMIT = MAX_SEARCH_LIMIT

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_LIMIT)
}

export function clampStart(start: number | undefined): number {
  if (start === undefined || !Number.isFinite(start)) return 0
  return Math.max(Math.trunc(start), 0)
}

type RequestFields = Omit<ProviderRequest, 'target'>

// 자격증명 검증용 — 가장 가벼운 인증 필요 엔드포인트.
export function currentUserRequest(endpoint: ConfluenceEndpoint): RequestFields {
  return { method: 'GET', path: restPath(endpoint, '/user/current') }
}

export function searchRequest(endpoint: ConfluenceEndpoint, input: SearchInput): RequestFields {
  return {
    method: 'GET',
    path: restPath(endpoint, '/content/search'),
    query: {
      cql: buildSearchCql(input),
      limit: String(clampLimit(input.limit)),
      start: String(clampStart(input.start)),
      // 공간·버전에 더해 **작성자**(`history.createdBy`)를 함께 받는다 — 검색이 돌려줘야 하는
      // 값이라(사용자 결정 2026-08-04) 목록마다 사용자 조회를 다시 하지 않는다.
      expand: 'space,version,history'
    }
  }
}

// 본문(storage XHTML)까지 받는 페이지 조회.
export function pageRequest(endpoint: ConfluenceEndpoint, pageId: string): RequestFields {
  return {
    method: 'GET',
    path: restPath(endpoint, `/content/${encodeURIComponent(pageId)}`),
    query: { expand: 'body.storage,space,version' }
  }
}

// 멘션(`ri:userkey`)의 표시 이름 조회. 키는 불투명해서 본문만으로는 이름을 알 수 없다.
export function userRequest(endpoint: ConfluenceEndpoint, userkey: string): RequestFields {
  return { method: 'GET', path: restPath(endpoint, '/user'), query: { key: userkey } }
}

// 첨부 목록은 검색 상한과 무관하다 — 페이지 하나에 딸린 첨부를 한 번에 본다.
const ATTACHMENT_LIST_LIMIT = 200

export function attachmentListRequest(endpoint: ConfluenceEndpoint, pageId: string): RequestFields {
  return {
    method: 'GET',
    path: restPath(endpoint, `/content/${encodeURIComponent(pageId)}/child/attachment`),
    // `version` 을 함께 받아 **어느 버전을 내려받았는지** 기록한다 (0169). 목록이 주는 값이
    // 곧 현재 버전이라, 본문 URL 의 `?version=N`(삽입 시점)을 따르지 않는다는 증거가 된다.
    query: { limit: String(ATTACHMENT_LIST_LIMIT), expand: 'version' }
  }
}

// 바이트를 받는 유일한 요청. `responseType:'binary'` 와 XSRF 헤더가 **둘 다** 필요하다 —
// 전자가 없으면 UTF-8 로 손상되고, 후자가 없으면 403 이 돌아온다.
export function attachmentDataRequest(
  endpoint: ConfluenceEndpoint,
  pageId: string,
  attachmentId: string,
  maxBytes: number
): RequestFields {
  return {
    method: 'GET',
    path: restPath(
      endpoint,
      `/content/${encodeURIComponent(pageId)}/child/attachment/${encodeURIComponent(attachmentId)}/data`
    ),
    headers: { ...XSRF_HEADER },
    responseType: 'binary',
    maxBytes
  }
}

// 첨부 목록이 준 `_links.download`(`/download/attachments/…?version=N&…`)로 받는 폴백 경로
// (0169). Atlassian 문서상 `/data` 는 *업로드(POST)* 로 문서화된 좌표이고 GET 은 302 에
// 의존한다 — 리다이렉트가 막힌 배포에서도 첨부를 받을 수 있게 두 번째 좌표를 둔다.
//
// 링크는 `_links.base`(origin + 컨텍스트 경로) 기준 **상대 경로**라 `apiBasePath` 를 앞에
// 붙인다. 쿼리는 요청 계약의 `query` 로 분해한다 — 경로에 `?` 를 남기면 인코딩이 두 번 된다.
export function attachmentDownloadRequest(
  endpoint: ConfluenceEndpoint,
  downloadPath: string,
  maxBytes: number
): RequestFields {
  const [rawPath, rawQuery = ''] = downloadPath.split('?')
  const query: Record<string, string> = {}
  for (const [name, value] of new URLSearchParams(rawQuery)) query[name] = value
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  return {
    method: 'GET',
    path: `${endpoint.apiBasePath}${path}`,
    ...(Object.keys(query).length > 0 ? { query } : {}),
    headers: { ...XSRF_HEADER },
    responseType: 'binary',
    maxBytes
  }
}
