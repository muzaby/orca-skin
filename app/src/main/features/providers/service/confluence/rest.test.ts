import { describe, expect, it } from 'vitest'
import {
  attachmentDataRequest,
  attachmentDownloadRequest,
  attachmentListRequest,
  buildSearchCql,
  clampLimit,
  clampStart,
  currentUserRequest,
  MAX_SEARCH_LIMIT,
  escapeCqlLiteral,
  normalizeBasePath,
  pageRequest,
  searchRequest,
  userRequest,
  XSRF_HEADER
} from './rest'
import { normalizeServerConfig } from './connector'

const ROOT = { apiBasePath: '' }
const CONTEXT = { apiBasePath: '/confluence' }

describe('normalizeBasePath', () => {
  it('앞 슬래시를 붙이고 뒤 슬래시를 뗀다', () => {
    expect(normalizeBasePath('confluence')).toBe('/confluence')
    expect(normalizeBasePath('/confluence/')).toBe('/confluence')
    expect(normalizeBasePath('/confluence')).toBe('/confluence')
  })

  it('빈 값과 루트는 빈 문자열이다', () => {
    expect(normalizeBasePath(undefined)).toBe('')
    expect(normalizeBasePath('')).toBe('')
    expect(normalizeBasePath('   ')).toBe('')
    expect(normalizeBasePath('/')).toBe('')
  })
})

describe('요청 경로 — 컨텍스트 경로', () => {
  it('컨텍스트 경로 prefix 를 모든 경로에 붙인다', () => {
    // baseUrl 은 경로 없는 origin 이어야 하므로(manifest OriginSchema) prefix 는 path 몫이다.
    const paths = [
      currentUserRequest(CONTEXT).path,
      searchRequest(CONTEXT, {}).path,
      pageRequest(CONTEXT, '123').path,
      attachmentListRequest(CONTEXT, '123').path,
      attachmentDataRequest(CONTEXT, '123', 'att1', 1).path
    ]
    expect(paths.every((p) => p.startsWith('/confluence/rest/api'))).toBe(true)
  })

  it('prefix 가 없으면 rest 경로로 시작한다', () => {
    const paths = [
      currentUserRequest(ROOT).path,
      searchRequest(ROOT, {}).path,
      pageRequest(ROOT, '123').path,
      attachmentListRequest(ROOT, '123').path,
      attachmentDataRequest(ROOT, '123', 'att1', 1).path
    ]
    expect(paths.every((p) => p.startsWith('/rest/api'))).toBe(true)
  })

  it('경로는 절대 URL 이 아니다 — baseUrl 우회 정책에 걸리지 않는다', () => {
    const paths = [searchRequest(CONTEXT, {}).path, pageRequest(CONTEXT, '1').path]
    for (const path of paths) {
      expect(path.startsWith('/')).toBe(true)
      expect(path).not.toMatch(/^https?:\/\//)
      expect(path.startsWith('//')).toBe(false)
    }
  })

  it('pageId 를 URL 인코딩해 경로 조작을 막는다', () => {
    expect(pageRequest(ROOT, '../../admin').path).toBe('/rest/api/content/..%2F..%2Fadmin')
  })
})

describe('CQL', () => {
  it('CQL 리터럴을 이스케이프한다', () => {
    // 역슬래시를 먼저 처리해야 이스케이프 문자가 두 번 처리되지 않는다.
    expect(escapeCqlLiteral('say "hi"')).toBe('say \\"hi\\"')
    expect(escapeCqlLiteral('back\\slash')).toBe('back\\\\slash')
    expect(escapeCqlLiteral('both\\"x')).toBe('both\\\\\\"x')
  })

  it('사용자 입력을 CQL 에 그대로 잇지 않는다', () => {
    const cql = buildSearchCql({ text: 'a" OR type = "blogpost' })
    // 따옴표가 이스케이프돼 질의 구조가 바뀌지 않는다.
    expect(cql).toBe('type = page AND text ~ "a\\" OR type = \\"blogpost"')
  })

  it('spaceKey 와 text 를 AND 로 묶는다', () => {
    expect(buildSearchCql({ spaceKey: 'ENG', text: 'design' })).toBe(
      'type = page AND space = "ENG" AND text ~ "design"'
    )
  })

  it('명시 cql 이 있으면 그대로 쓴다', () => {
    expect(buildSearchCql({ cql: 'label = "x"', text: 'ignored' })).toBe('label = "x"')
  })

  it('아무 조건이 없으면 page 타입만 건다', () => {
    expect(buildSearchCql({})).toBe('type = page')
  })
})

// 1턴 상한 50 (사용자 결정 2026-08-04 — "1턴의 limit 은 50까지").
describe('clampLimit', () => {
  it('범위를 벗어난 값을 잘라낸다', () => {
    expect(clampLimit(undefined)).toBe(MAX_SEARCH_LIMIT)
    expect(clampLimit(0)).toBe(1)
    expect(clampLimit(-5)).toBe(1)
    expect(clampLimit(1000)).toBe(MAX_SEARCH_LIMIT)
    expect(clampLimit(7.9)).toBe(7)
    expect(clampLimit(Number.NaN)).toBe(MAX_SEARCH_LIMIT)
  })
})

describe('clampStart', () => {
  it('음수·비수치를 0 으로 되돌린다', () => {
    expect(clampStart(undefined)).toBe(0)
    expect(clampStart(-1)).toBe(0)
    expect(clampStart(Number.NaN)).toBe(0)
    expect(clampStart(50)).toBe(50)
    expect(clampStart(50.9)).toBe(50)
  })
})

describe('searchRequest', () => {
  it('검색 요청 경로와 쿼리를 만든다', () => {
    const req = searchRequest(ROOT, { text: 'design', spaceKey: 'ENG', limit: 5 })
    expect(req.method).toBe('GET')
    expect(req.path).toBe('/rest/api/content/search')
    expect(req.query).toEqual({
      cql: 'type = page AND space = "ENG" AND text ~ "design"',
      limit: '5',
      start: '0',
      // 작성자(`history.createdBy`)를 검색이 함께 받는다 (0164 r3).
      expand: 'space,version,history'
    })
  })

  it('오프셋을 그대로 싣는다 — 페이지네이션의 유일한 좌표다', () => {
    expect(searchRequest(ROOT, { text: 'x', start: 50 }).query?.start).toBe('50')
  })
})

describe('pageRequest', () => {
  it('storage 본문을 함께 요청한다', () => {
    const req = pageRequest(ROOT, '12345')
    expect(req.path).toBe('/rest/api/content/12345')
    expect(req.query?.expand).toContain('body.storage')
  })
})

describe('attachmentDataRequest', () => {
  it('첨부 다운로드 요청에 XSRF 우회 헤더를 넣는다', () => {
    const req = attachmentDataRequest(ROOT, '123', 'att-1', 4096)
    expect(req.headers).toEqual({ ...XSRF_HEADER })
    expect(req.path).toBe('/rest/api/content/123/child/attachment/att-1/data')
  })

  it('바이너리 수신과 크기 상한을 함께 선언한다', () => {
    const req = attachmentDataRequest(ROOT, '123', 'att-1', 4096)
    // 둘 중 하나라도 빠지면 파일이 손상되거나 main 메모리가 무제한으로 커진다.
    expect(req.responseType).toBe('binary')
    expect(req.maxBytes).toBe(4096)
  })

  it('예약 헤더를 직접 설정하지 않는다', () => {
    const requests = [
      currentUserRequest(ROOT),
      searchRequest(ROOT, {}),
      pageRequest(ROOT, '1'),
      attachmentListRequest(ROOT, '1'),
      attachmentDataRequest(ROOT, '1', 'a', 1),
      attachmentDownloadRequest(ROOT, '/download/attachments/1/a.png', 1),
      userRequest(ROOT, 'k1')
    ]
    const reserved = ['authorization', 'cookie', 'proxy-authorization']
    for (const req of requests) {
      const names = Object.keys(req.headers ?? {}).map((n) => n.toLowerCase())
      expect(names.filter((n) => reserved.includes(n))).toEqual([])
    }
  })
})

// 0164 r2 — 사람이 손으로 적는 주소를 흡수한다. 이 정규화가 없으면 주소 끝의 `/` 하나가
// 패키지 등록 전체를 거부시키고(all-or-nothing) 서버가 UI 에서 통째로 사라진다.
describe('normalizeServerConfig', () => {
  const base = { id: 'confluence-dc', label: '위키' }

  it('경로 없는 origin 은 그대로 둔다', () => {
    expect(normalizeServerConfig({ ...base, baseUrl: 'https://wiki.corp' })).toEqual({
      ...base,
      baseUrl: 'https://wiki.corp'
    })
  })

  it('끝의 슬래시를 떼어낸다', () => {
    expect(normalizeServerConfig({ ...base, baseUrl: 'https://wiki.corp/' }).baseUrl).toBe(
      'https://wiki.corp'
    )
  })

  it('주소에 붙은 컨텍스트 경로를 apiBasePath 로 옮긴다', () => {
    expect(normalizeServerConfig({ ...base, baseUrl: 'https://wiki.corp/confluence/' })).toEqual({
      ...base,
      baseUrl: 'https://wiki.corp',
      apiBasePath: '/confluence'
    })
  })

  it('명시된 apiBasePath 가 우선한다', () => {
    const out = normalizeServerConfig({
      ...base,
      baseUrl: 'https://wiki.corp/wiki',
      apiBasePath: '/confluence'
    })
    expect(out).toEqual({ ...base, baseUrl: 'https://wiki.corp', apiBasePath: '/confluence' })
  })

  it('포트는 보존한다', () => {
    expect(normalizeServerConfig({ ...base, baseUrl: 'https://wiki.corp:8090/x' })).toEqual({
      ...base,
      baseUrl: 'https://wiki.corp:8090',
      apiBasePath: '/x'
    })
  })

  it('해석할 수 없는 주소는 손대지 않는다 — manifest 가 거부하고 진단에 사유가 남는다', () => {
    const bad = { ...base, baseUrl: 'wiki.corp' }
    expect(normalizeServerConfig(bad)).toEqual(bad)
  })
})

// 0169 — 첨부를 받는 좌표가 둘이 됐다. 링크는 `_links.base`(origin + 컨텍스트 경로) 기준
// 상대 경로라, 컨텍스트 경로를 안 붙이면 배포에 따라 404 가 된다.
describe('attachmentDownloadRequest', () => {
  it('download 링크를 컨텍스트 경로와 쿼리를 살려 요청으로 만든다', () => {
    const req = attachmentDownloadRequest(
      CONTEXT,
      '/download/attachments/12345/foo.png?version=3&modificationDate=1700000000000&api=v2',
      4096
    )
    expect(req.path).toBe('/confluence/download/attachments/12345/foo.png')
    // 쿼리는 path 에 남기지 않는다 — 남기면 인코딩이 두 번 된다.
    expect(req.query).toEqual({
      version: '3',
      modificationDate: '1700000000000',
      api: 'v2'
    })
    expect(req.headers).toEqual({ ...XSRF_HEADER })
    expect(req.responseType).toBe('binary')
    expect(req.maxBytes).toBe(4096)
  })

  it('쿼리가 없는 링크와 앞 슬래시가 빠진 링크도 받는다', () => {
    expect(
      attachmentDownloadRequest(ROOT, '/download/attachments/1/a.png', 1).query
    ).toBeUndefined()
    expect(attachmentDownloadRequest(ROOT, 'download/attachments/1/a.png', 1).path).toBe(
      '/download/attachments/1/a.png'
    )
  })
})

describe('userRequest', () => {
  it('멘션 userkey 를 쿼리로 조회한다', () => {
    const req = userRequest(CONTEXT, 'd3b07384d113edec49eaa6238ad5ff00')
    expect(req.path).toBe('/confluence/rest/api/user')
    expect(req.query).toEqual({ key: 'd3b07384d113edec49eaa6238ad5ff00' })
  })
})

describe('attachmentListRequest — 버전 확장', () => {
  it('현재 버전을 알 수 있게 version 확장을 요청한다', () => {
    // 이게 없으면 "최신을 받았다" 를 사후에 확인할 수단이 없다.
    expect(attachmentListRequest(ROOT, '1').query).toMatchObject({ expand: 'version' })
  })
})
