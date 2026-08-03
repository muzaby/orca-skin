import { describe, expect, it } from 'vitest'
import {
  attachmentDataRequest,
  attachmentListRequest,
  buildSearchCql,
  clampLimit,
  currentUserRequest,
  escapeCqlLiteral,
  normalizeBasePath,
  pageRequest,
  searchRequest,
  XSRF_HEADER
} from './rest'

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

describe('clampLimit', () => {
  it('범위를 벗어난 값을 잘라낸다', () => {
    expect(clampLimit(undefined)).toBe(25)
    expect(clampLimit(0)).toBe(1)
    expect(clampLimit(-5)).toBe(1)
    expect(clampLimit(1000)).toBe(100)
    expect(clampLimit(7.9)).toBe(7)
    expect(clampLimit(Number.NaN)).toBe(25)
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
      expand: 'space,version'
    })
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
      attachmentDataRequest(ROOT, '1', 'a', 1)
    ]
    const reserved = ['authorization', 'cookie', 'proxy-authorization']
    for (const req of requests) {
      const names = Object.keys(req.headers ?? {}).map((n) => n.toLowerCase())
      expect(names.filter((n) => reserved.includes(n))).toEqual([])
    }
  })
})
