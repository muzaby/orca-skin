// Confluence connector 런타임 (0160). `AuthenticatedFetch` 를 fake 로 주입해 네트워크 없이
// 돌린다 — connector 가 raw credential 을 안 보는 구조 덕에 fake 가 그대로 성립한다.

import { rm } from 'node:fs/promises'
import { describe, expect, it, afterEach } from 'vitest'
import type {
  AuthenticatedFetch,
  AuthenticatedFetchRequest,
  AuthenticatedFetchResponse,
  ConnectorContext,
  ConnectorResult
} from '../../../../contracts/connector-plugin'
import { createConfluenceConnector, type ConfluenceSearchResult } from './connector'
import { pageDir } from './download-store'

const SERVER = { id: 'confluence-test', label: 'Confluence Test', baseUrl: 'https://wiki.invalid' }
const cleanup: string[] = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

interface Route {
  match: (req: AuthenticatedFetchRequest) => boolean
  respond: (req: AuthenticatedFetchRequest) => Partial<AuthenticatedFetchResponse> & {
    status: number
  }
}

function context(routes: Route[]): { ctx: ConnectorContext; seen: AuthenticatedFetchRequest[] } {
  const seen: AuthenticatedFetchRequest[] = []
  const authenticatedFetch: AuthenticatedFetch = async (req) => {
    seen.push(req)
    const route = routes.find((r) => r.match(req))
    if (!route) return { status: 404, headers: {}, body: '{}' }
    const partial = route.respond(req)
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

// 검색이 본문까지 펼친다(0164 r2) — `confluence_get_page` 를 없앤 뒤 모델이 본문에 닿는 유일한
// 경로다. 그래서 여기 테스트는 "검색 → 페이지 조회 → 첨부 다운로드" 전 구간을 한 번에 본다.
describe('ConfluenceConnector — search', () => {
  const STORAGE =
    '<p>본문</p><ac:image><ri:attachment ri:filename="diagram.png" /></ac:image>' +
    '<ac:structured-macro ac:name="jira" />'
  // 첨부를 참조하지 않는 본문 — 첨부 목록 조회 자체가 없어야 한다.
  const PLAIN_STORAGE = '<p>첨부 없는 본문</p>'

  function searchRoute(results: unknown[]): Route {
    return {
      match: (r) => r.path.endsWith('/content/search'),
      respond: () => ({ status: 200, body: JSON.stringify({ results }) })
    }
  }

  function pageRoute(storage = STORAGE): Route {
    return {
      // 요청된 id 를 그대로 돌려준다 — 여러 페이지를 펼치는 경로를 검증하려면 필요하다.
      match: (r) => /\/content\/\d+$/.test(r.path),
      respond: (r) => {
        const id = r.path.split('/').pop() ?? '0'
        return {
          status: 200,
          body: JSON.stringify({
            id,
            title: `문서 ${id}`,
            space: { key: 'ENG' },
            version: { number: 4 },
            body: { storage: { value: storage } }
          })
        }
      }
    }
  }

  function attachmentRoutes(attachments: unknown[]): Route[] {
    return [
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

  function hit(id: string): Record<string, unknown> {
    return { id, title: `문서 ${id}`, type: 'page', space: { key: 'ENG' } }
  }

  function searchResult(result: ConnectorResult): ConfluenceSearchResult {
    if (!result.ok) throw new Error(`search 실패: ${result.message}`)
    return result.data as ConfluenceSearchResult
  }

  it('hit 을 정규화하고 각 페이지를 Markdown 으로 저장한다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'), pageDir(SERVER.id, '2'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      searchRoute([
        hit('1'),
        { id: '2', title: '문서 2', type: 'page' },
        // id 가 없는 항목은 조용히 버린다 — 모델에게 반쪽짜리 참조를 주지 않는다.
        { title: '잘못된 항목' }
      ]),
      pageRoute(),
      ...attachmentRoutes([
        { id: 'att-1', title: 'diagram.png', metadata: { mediaType: 'image/png' } }
      ])
    ])

    const data = searchResult(
      await connector.invoke(ctx, { operation: 'search', params: { text: 'x' } })
    )

    expect(data.hits).toEqual([
      { id: '1', title: '문서 1', type: 'page', spaceKey: 'ENG' },
      { id: '2', title: '문서 2', type: 'page' }
    ])
    expect(data.pages.map((p) => p.pageId)).toEqual(['1', '2'])
    expect(data.failedPages).toEqual([])
    expect(data.skippedPages).toBe(0)

    const first = data.pages[0]
    expect(first.title).toBe('문서 1')
    expect(first.spaceKey).toBe('ENG')
    expect(first.version).toBe(4)
    expect(first.markdownPath.endsWith('page.md')).toBe(true)
    expect(first.markdownPreview).toContain('# 문서 1')
    expect(first.previewTruncated).toBe(false)
    // 폴백된 매크로가 조용히 사라지지 않고 집계된다.
    expect(first.unhandledMacros).toEqual(['jira'])
    expect(first.assets.map((a) => a.filename)).toEqual(['diagram.png'])
  })

  it('본문을 펼치는 개수에 상한을 둔다 (기본 5, maxPages 로 조절)', async () => {
    const ids = ['1', '2', '3', '4', '5', '6', '7']
    cleanup.push(...ids.map((id) => pageDir(SERVER.id, id)))
    const connector = createConfluenceConnector(SERVER)
    const routes = [okUser, searchRoute(ids.map(hit)), pageRoute(PLAIN_STORAGE)]

    const byDefault = searchResult(
      await connector.invoke(context(routes).ctx, { operation: 'search', params: { text: 'x' } })
    )
    // 상한이 없으면 검색 한 번이 곧 7번의 페이지 조회 + 첨부 다운로드가 된다.
    expect(byDefault.pages).toHaveLength(5)
    expect(byDefault.skippedPages).toBe(2)
    // 펼치지 않은 hit 도 목록에는 남는다 — 모델이 질의를 좁힐 재료다.
    expect(byDefault.hits).toHaveLength(7)

    const narrowed = searchResult(
      await connector.invoke(context(routes).ctx, {
        operation: 'search',
        params: { text: 'x', maxPages: 2 }
      })
    )
    expect(narrowed.pages.map((p) => p.pageId)).toEqual(['1', '2'])
    expect(narrowed.skippedPages).toBe(5)
  })

  it('페이지 하나가 실패해도 나머지는 돌려준다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'), pageDir(SERVER.id, '2'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      searchRoute([hit('1'), hit('2')]),
      {
        // 2번만 권한 오류.
        match: (r) => r.path.endsWith('/content/2'),
        respond: () => ({ status: 403, body: '{}' })
      },
      pageRoute(PLAIN_STORAGE)
    ])

    const data = searchResult(
      await connector.invoke(ctx, { operation: 'search', params: { text: 'x' } })
    )
    expect(data.pages.map((p) => p.pageId)).toEqual(['1'])
    expect(data.failedPages).toEqual([
      { pageId: '2', title: '문서 2', message: expect.stringContaining('403') }
    ])
  })

  it('본문이 참조한 첨부만 바이너리+XSRF 로 내려받는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      searchRoute([hit('1')]),
      pageRoute(),
      ...attachmentRoutes([
        { id: 'att-1', title: 'diagram.png' },
        // 본문이 참조하지 않는 첨부 — 받지 않는다.
        { id: 'att-2', title: 'unused.zip' }
      ])
    ])

    const data = searchResult(
      await connector.invoke(ctx, { operation: 'search', params: { text: 'x' } })
    )
    expect(data.pages[0].assets.map((a) => a.filename)).toEqual(['diagram.png'])

    const dataRequests = seen.filter((r) => r.path.endsWith('/data'))
    expect(dataRequests).toHaveLength(1)
    expect(dataRequests[0].path).toContain('att-1')
    expect(dataRequests[0].responseType).toBe('binary')
    expect(dataRequests[0].headers).toEqual({ 'X-Atlassian-Token': 'nocheck' })
    expect(dataRequests[0].maxBytes).toBeGreaterThan(0)
  })

  it('첨부 하나가 실패해도 페이지 저장은 완료된다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      searchRoute([hit('1')]),
      pageRoute(),
      {
        match: (r) => r.path.endsWith('/child/attachment'),
        respond: () => ({
          status: 200,
          body: JSON.stringify({ results: [{ id: 'att-1', title: 'diagram.png' }] })
        })
      },
      { match: (r) => r.path.endsWith('/data'), respond: () => ({ status: 404 }) }
    ])

    const page = searchResult(
      await connector.invoke(ctx, { operation: 'search', params: { text: 'x' } })
    ).pages[0]
    expect(page.assets).toEqual([])
    expect(page.failedAssets).toEqual([{ filename: 'diagram.png', message: expect.any(String) }])
    // 본문은 그대로 저장됐다.
    expect(page.markdownPath.endsWith('page.md')).toBe(true)
  })

  it('본문이 참조한 첨부가 목록에 없으면 실패로 남긴다 — 조용히 넘기지 않는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([okUser, searchRoute([hit('1')]), pageRoute(), ...attachmentRoutes([])])

    const page = searchResult(
      await connector.invoke(ctx, { operation: 'search', params: { text: 'x' } })
    ).pages[0]
    expect(page.failedAssets).toEqual([
      { filename: 'diagram.png', message: expect.stringContaining('목록') }
    ])
  })

  it('본문이 첨부를 참조하지 않으면 첨부 목록조차 조회하지 않는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      searchRoute([hit('1')]),
      pageRoute(PLAIN_STORAGE),
      ...attachmentRoutes([{ id: 'att-1', title: 'diagram.png' }])
    ])

    await connector.invoke(ctx, { operation: 'search', params: { text: 'x' } })
    expect(seen.filter((r) => r.path.includes('attachment'))).toHaveLength(0)
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
