// Confluence connector 런타임 (0160). `AuthenticatedFetch` 를 fake 로 주입해 네트워크 없이
// 돌린다 — connector 가 raw credential 을 안 보는 구조 덕에 fake 가 그대로 성립한다.

import { rm } from 'node:fs/promises'
import { describe, expect, it, afterEach } from 'vitest'
import type {
  AuthenticatedFetch,
  AuthenticatedFetchRequest,
  AuthenticatedFetchResponse,
  ConnectorContext
} from '../../../../contracts/connector-plugin'
import { createConfluenceConnector, type ConfluencePageResult } from './connector'
import { pageDir } from './download-store'

const SERVER = { id: 'confluence-test', label: 'Confluence Test', baseUrl: 'https://wiki.invalid' }
const cleanup: string[] = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

interface Route {
  match: (req: AuthenticatedFetchRequest) => boolean
  respond: () => Partial<AuthenticatedFetchResponse> & { status: number }
}

function context(routes: Route[]): { ctx: ConnectorContext; seen: AuthenticatedFetchRequest[] } {
  const seen: AuthenticatedFetchRequest[] = []
  const authenticatedFetch: AuthenticatedFetch = async (req) => {
    seen.push(req)
    const route = routes.find((r) => r.match(req))
    if (!route) return { status: 404, headers: {}, body: '{}' }
    const partial = route.respond()
    return { headers: {}, body: '', ...partial }
  }
  return {
    seen,
    ctx: {
      connectionId: 'conn-1',
      bindingId: 'bind-1',
      authenticatedFetch,
      signal: new AbortController().signal,
      logger: () => undefined
    }
  }
}

const okUser: Route = {
  match: (r) => r.path.endsWith('/user/current'),
  respond: () => ({ status: 200, body: JSON.stringify({ username: 'alice' }) })
}

describe('ConfluenceConnector — start', () => {
  it('start 가 상태 코드별 health 와 message 를 낸다', async () => {
    const connector = createConfluenceConnector(SERVER)

    const ready = context([okUser])
    expect(await connector.start(ready.ctx)).toEqual({ health: 'ready' })

    for (const status of [401, 403]) {
      const denied = context([
        { match: (r) => r.path.endsWith('/user/current'), respond: () => ({ status, body: '{}' }) }
      ])
      const result = await connector.start(denied.ctx)
      expect(result.health).toBe('unauthenticated')
      expect(result.message).toContain('자격증명')
    }

    const broken = context([
      { match: (r) => r.path.endsWith('/user/current'), respond: () => ({ status: 500, body: '' }) }
    ])
    const unreachable = await connector.start(broken.ctx)
    expect(unreachable.health).toBe('unreachable')
    expect(unreachable.message).toContain(SERVER.label)
  })

  it('JSON 이 아닌 200 응답도 실패로 본다 (로그인 HTML 이 200 으로 오는 배포)', async () => {
    const connector = createConfluenceConnector(SERVER)
    const html = context([
      {
        match: (r) => r.path.endsWith('/user/current'),
        respond: () => ({ status: 200, body: '<html><body>login</body></html>' })
      }
    ])
    expect((await connector.start(html.ctx)).health).toBe('unreachable')
  })

  it('컨텍스트 경로가 요청 path 에 붙는다', async () => {
    const connector = createConfluenceConnector({ ...SERVER, apiBasePath: '/confluence' })
    const { ctx, seen } = context([
      {
        match: (r) => r.path.includes('/user/current'),
        respond: () => ({ status: 200, body: '{}' })
      }
    ])
    await connector.start(ctx)
    expect(seen[0].path).toBe('/confluence/rest/api/user/current')
  })
})

describe('ConfluenceConnector — search', () => {
  it('검색 결과를 요약 목록으로 정규화한다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      {
        match: (r) => r.path.endsWith('/content/search'),
        respond: () => ({
          status: 200,
          body: JSON.stringify({
            results: [
              { id: '1', title: '설계', type: 'page', space: { key: 'ENG' } },
              { id: '2', title: '회의록', type: 'page' },
              { title: '잘못된 항목' }
            ]
          })
        })
      }
    ])

    const result = await connector.invoke(ctx, { operation: 'search', params: { text: 'x' } })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    // id 가 없는 항목은 조용히 버린다 — 모델에게 반쪽짜리 참조를 주지 않는다.
    expect(result.data).toEqual({
      hits: [
        { id: '1', title: '설계', type: 'page', spaceKey: 'ENG' },
        { id: '2', title: '회의록', type: 'page' }
      ]
    })
  })
})

describe('ConfluenceConnector — page', () => {
  const STORAGE =
    '<p>본문</p><ac:image><ri:attachment ri:filename="diagram.png" /></ac:image>' +
    '<ac:structured-macro ac:name="jira" />'

  function pageRoutes(attachments: unknown[]): Route[] {
    return [
      okUser,
      {
        match: (r) => /\/content\/\d+$/.test(r.path),
        respond: () => ({
          status: 200,
          body: JSON.stringify({
            id: '123',
            title: '설계 문서',
            space: { key: 'ENG' },
            version: { number: 4 },
            body: { storage: { value: STORAGE } }
          })
        })
      },
      {
        match: (r) => r.path.endsWith('/child/attachment'),
        respond: () => ({ status: 200, body: JSON.stringify({ results: attachments }) })
      },
      {
        match: (r) => r.path.endsWith('/data'),
        respond: () => ({ status: 200, body: '', bodyBytes: new Uint8Array([1, 2, 3]) })
      }
    ]
  }

  it('페이지를 Markdown 으로 저장하고 경로·미리보기를 반환한다', async () => {
    cleanup.push(pageDir(SERVER.id, '123'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context(
      pageRoutes([{ id: 'att-1', title: 'diagram.png', metadata: { mediaType: 'image/png' } }])
    )

    const result = await connector.invoke(ctx, { operation: 'page', params: { pageId: '123' } })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    const page = result.data as ConfluencePageResult

    expect(page.title).toBe('설계 문서')
    expect(page.spaceKey).toBe('ENG')
    expect(page.version).toBe(4)
    expect(page.markdownPath.endsWith('page.md')).toBe(true)
    expect(page.markdownPreview).toContain('# 설계 문서')
    expect(page.previewTruncated).toBe(false)
    // 폴백된 매크로가 조용히 사라지지 않고 집계된다.
    expect(page.unhandledMacros).toEqual(['jira'])
  })

  it('참조된 첨부만 내려받는다', async () => {
    cleanup.push(pageDir(SERVER.id, '123'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context(
      pageRoutes([
        { id: 'att-1', title: 'diagram.png' },
        // 본문이 참조하지 않는 첨부 — 받지 않는다.
        { id: 'att-2', title: 'unused.zip' }
      ])
    )

    const result = await connector.invoke(ctx, { operation: 'page', params: { pageId: '123' } })
    if (!result.ok) throw new Error('unreachable')
    const page = result.data as ConfluencePageResult

    expect(page.assets.map((a) => a.filename)).toEqual(['diagram.png'])
    const dataRequests = seen.filter((r) => r.path.endsWith('/data'))
    expect(dataRequests).toHaveLength(1)
    expect(dataRequests[0].path).toContain('att-1')
  })

  it('첨부 요청은 바이너리 수신과 XSRF 헤더를 함께 쓴다', async () => {
    cleanup.push(pageDir(SERVER.id, '123'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context(pageRoutes([{ id: 'att-1', title: 'diagram.png' }]))
    await connector.invoke(ctx, { operation: 'page', params: { pageId: '123' } })

    const dataRequest = seen.find((r) => r.path.endsWith('/data'))
    expect(dataRequest?.responseType).toBe('binary')
    expect(dataRequest?.headers).toEqual({ 'X-Atlassian-Token': 'nocheck' })
    expect(dataRequest?.maxBytes).toBeGreaterThan(0)
  })

  it('첨부 하나가 실패해도 페이지 저장은 완료된다', async () => {
    cleanup.push(pageDir(SERVER.id, '123'))
    const connector = createConfluenceConnector(SERVER)
    const routes = pageRoutes([{ id: 'att-1', title: 'diagram.png' }])
    routes[3] = { match: (r) => r.path.endsWith('/data'), respond: () => ({ status: 404 }) }
    const { ctx } = context(routes)

    const result = await connector.invoke(ctx, { operation: 'page', params: { pageId: '123' } })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    const page = result.data as ConfluencePageResult
    expect(page.assets).toEqual([])
    expect(page.failedAssets).toEqual([{ filename: 'diagram.png', message: expect.any(String) }])
    // 본문은 그대로 저장됐다.
    expect(page.markdownPath.endsWith('page.md')).toBe(true)
  })

  it('includeAttachments:false 면 첨부 목록도 조회하지 않는다', async () => {
    cleanup.push(pageDir(SERVER.id, '123'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context(pageRoutes([{ id: 'att-1', title: 'diagram.png' }]))
    await connector.invoke(ctx, {
      operation: 'page',
      params: { pageId: '123', includeAttachments: false }
    })
    expect(seen.filter((r) => r.path.includes('attachment'))).toHaveLength(0)
  })

  it('pageId 가 없으면 던진다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([okUser])
    await expect(connector.invoke(ctx, { operation: 'page', params: {} })).rejects.toThrow(/pageId/)
  })
})

describe('ConfluenceConnector — 알 수 없는 operation', () => {
  it('실패 결과로 돌려준다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([okUser])
    const result = await connector.invoke(ctx, { operation: 'nope' })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.message).toContain('nope')
  })
})
