// Confluence connector 런타임 (0160). `ctx.request` 를 fake 로 주입해 네트워크 없이
// 돌린다 — connector 가 raw credential 을 안 보는 구조 덕에 fake 가 그대로 성립한다.

import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import type { ConnectorContext, ConnectorResult } from '../../../../contracts/connector'
import type { InternalApiRequest, InternalApiResponse } from '../../../../contracts/internal-api'
import {
  createConfluenceConnector,
  type ConfluencePagesResult,
  type ConfluenceSearchResult
} from './connector'
import { pageDir } from './download-store'

const SERVER = { id: 'confluence-test', label: 'Confluence Test', baseUrl: 'https://wiki.invalid' }
const cleanup: string[] = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

interface Route {
  match: (req: InternalApiRequest) => boolean
  respond: (req: InternalApiRequest) => Partial<InternalApiResponse> & {
    status: number
  }
}

function context(routes: Route[]): { ctx: ConnectorContext; seen: InternalApiRequest[] } {
  const seen: InternalApiRequest[] = []
  const request = async (req: InternalApiRequest): Promise<InternalApiResponse> => {
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
      request,
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

// 도구 표면과 1:1 로 두 축이다 (0164 r3 — 사용자 재지정):
//   search → id·제목·작성자 + 페이지네이션 좌표 (본문 없음)
//   pages  → 받은 id 들의 본문 Markdown + 첨부
const STORAGE =
  '<p>본문</p><ac:image><ri:attachment ri:filename="diagram.png" /></ac:image>' +
  '<ac:structured-macro ac:name="jira" />'
// 첨부를 참조하지 않는 본문 — 받지는 않지만 **목록은 조회해 진단으로 남긴다** (0168).
const PLAIN_STORAGE = '<p>첨부 없는 본문</p>'
// `/download/` 밖의 host-relative 이미지(이모티콘 등) — 첨부 후보가 아니다.
const ICON_STORAGE = '<p><img src="/images/icons/emoticons/smile.png" /></p>'

function searchRoute(envelope: Record<string, unknown>): Route {
  return {
    match: (r) => r.path.endsWith('/content/search'),
    respond: () => ({ status: 200, body: JSON.stringify(envelope) })
  }
}

function pageRoute(storage = STORAGE): Route {
  return {
    // 요청된 id 를 그대로 돌려준다 — 여러 페이지를 받는 경로를 검증하려면 필요하다.
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

// 0169 — 멘션이 있는 본문. `ri:userkey` 는 불투명 키라 이름은 REST 로만 얻는다.
const MENTION_STORAGE =
  '<p>담당 <ac:link><ri:user ri:userkey="key-1" /></ac:link> 확인 바랍니다.</p>'

function userRoute(body: Record<string, unknown>, status = 200): Route {
  return {
    match: (r) => r.path.endsWith('/rest/api/user'),
    respond: () => ({ status, body: JSON.stringify(body) })
  }
}

function hit(id: string): Record<string, unknown> {
  return {
    id,
    title: `문서 ${id}`,
    type: 'page',
    space: { key: 'ENG' },
    history: { createdBy: { displayName: '홍길동' } }
  }
}

function ok<T>(result: ConnectorResult): T {
  if (!result.ok) throw new Error(`invoke 실패: ${result.message}`)
  return result.data as T
}

async function search(
  ctx: ConnectorContext,
  connector: ReturnType<typeof createConfluenceConnector>,
  params: Record<string, unknown> = { text: 'x' }
): Promise<ConfluenceSearchResult> {
  return ok<ConfluenceSearchResult>(await connector.invoke(ctx, { operation: 'search', params }))
}

describe('ConfluenceConnector — search', () => {
  it('id·제목·작성자만 돌려주고 본문은 건드리지 않는다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      searchRoute({
        results: [
          hit('1'),
          { id: '2', title: '문서 2', type: 'page', version: { by: { displayName: '김철수' } } },
          // id 가 없는 항목은 조용히 버린다 — 모델에게 반쪽짜리 참조를 주지 않는다.
          { title: '잘못된 항목' }
        ],
        start: 0,
        limit: 50,
        size: 2,
        totalSize: 2
      }),
      pageRoute()
    ])

    const data = await search(ctx, connector)
    expect(data.hits).toEqual([
      { id: '1', title: '문서 1', type: 'page', author: '홍길동', spaceKey: 'ENG' },
      // history 확장이 빠진 배포는 마지막 수정자로 폴백한다.
      { id: '2', title: '문서 2', type: 'page', author: '김철수' }
    ])
    // 검색은 페이지 본문도 첨부도 만지지 않는다 — 그래야 자동 허용이 정직하다.
    expect(seen.filter((r) => /\/content\/\d+$/.test(r.path))).toHaveLength(0)
    expect(seen.filter((r) => r.path.includes('attachment'))).toHaveLength(0)
  })

  it('작성자 정보가 없으면 필드를 아예 싣지 않는다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      searchRoute({ results: [{ id: '1', title: '문서 1', type: 'page' }], size: 1, totalSize: 1 })
    ])
    expect(await search(ctx, connector)).toMatchObject({ hits: [{ id: '1', title: '문서 1' }] })
    expect((await search(ctx, connector)).hits[0].author).toBeUndefined()
  })

  it('요청에 limit·start 를 실어 보낸다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([okUser, searchRoute({ results: [], size: 0, totalSize: 0 })])
    await search(ctx, connector, { text: 'x', limit: 20, start: 40 })
    expect(seen[0].query).toMatchObject({ limit: '20', start: '40' })
    // 작성자를 얻으려면 history 확장이 필요하다.
    expect(seen[0].query?.expand).toContain('history')
  })

  it('limit 은 50 을 넘지 못한다 — 1턴 상한(사용자 결정)', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([okUser, searchRoute({ results: [], size: 0, totalSize: 0 })])
    await search(ctx, connector, { text: 'x', limit: 500 })
    expect(seen[0].query?.limit).toBe('50')
  })

  it('더 남았으면 다음 오프셋을 준다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      searchRoute({
        results: [hit('1'), hit('2')],
        start: 0,
        limit: 2,
        size: 2,
        totalSize: 7
      })
    ])
    const data = await search(ctx, connector, { text: 'x', limit: 2 })
    expect(data).toMatchObject({ start: 0, limit: 2, size: 2, totalSize: 7, nextStart: 2 })
  })

  it('마지막 페이지에는 다음 오프셋이 없다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      searchRoute({ results: [hit('7')], start: 6, limit: 2, size: 1, totalSize: 7 })
    ])
    expect((await search(ctx, connector, { text: 'x', start: 6 })).nextStart).toBeUndefined()
  })

  // 사용자 결정 2026-08-04 — "허용치가 낮으면 해당 숫자를 따른다".
  it('서버가 limit 을 낮추면 그 값으로 오프셋을 민다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      // 50 을 요청했지만 서버는 25 만 적용했다. 50 을 더하면 26~50 번째가 통째로 사라진다.
      searchRoute({ results: [hit('1')], start: 0, limit: 25, size: 25, totalSize: 120 })
    ])
    const data = await search(ctx, connector, { text: 'x', limit: 50 })
    expect(data.limit).toBe(25)
    expect(data.nextStart).toBe(25)
  })

  it('totalSize 가 없으면 한도를 채웠는지로 다음을 판단한다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const full = context([
      okUser,
      searchRoute({ results: [hit('1'), hit('2')], limit: 2, size: 2 })
    ])
    expect(
      (await search(full.ctx, createConfluenceConnector(SERVER), { text: 'x', limit: 2 })).nextStart
    ).toBe(2)

    const partial = context([okUser, searchRoute({ results: [hit('1')], limit: 2, size: 1 })])
    expect(
      (await search(partial.ctx, connector, { text: 'x', limit: 2 })).nextStart
    ).toBeUndefined()
  })
})

describe('ConfluenceConnector — pages', () => {
  async function pages(
    ctx: ConnectorContext,
    connector: ReturnType<typeof createConfluenceConnector>,
    params: Record<string, unknown>
  ): Promise<ConfluencePagesResult> {
    return ok<ConfluencePagesResult>(await connector.invoke(ctx, { operation: 'pages', params }))
  }

  it('받은 id 들을 Markdown 으로 저장하고 경로·미리보기를 반환한다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'), pageDir(SERVER.id, '2'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      pageRoute(),
      ...attachmentRoutes([
        { id: 'att-1', title: 'diagram.png', metadata: { mediaType: 'image/png' } }
      ])
    ])

    const data = await pages(ctx, connector, { pageIds: ['1', '2'] })
    expect(data.pages.map((p) => p.pageId)).toEqual(['1', '2'])
    expect(data.failedPages).toEqual([])
    expect(data.skippedPageIds).toEqual([])

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

  it('중복 id 는 한 번만 처리한다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([okUser, pageRoute(PLAIN_STORAGE)])
    const data = await pages(ctx, connector, { pageIds: ['1', '1', '1'] })
    expect(data.pages.map((p) => p.pageId)).toEqual(['1'])
    expect(seen.filter((r) => /\/content\/\d+$/.test(r.path))).toHaveLength(1)
  })

  it('한 번에 처리할 개수에 상한을 두고 남은 id 를 돌려준다', async () => {
    const ids = Array.from({ length: 55 }, (_, index) => String(index + 1))
    cleanup.push(...ids.map((id) => pageDir(SERVER.id, id)))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([okUser, pageRoute(PLAIN_STORAGE)])

    const data = await pages(ctx, connector, { pageIds: ids })
    expect(data.pages).toHaveLength(50)
    // 조용히 버리지 않는다 — 남은 id 를 그대로 줘 다음 호출로 이어가게 한다.
    expect(data.skippedPageIds).toEqual(['51', '52', '53', '54', '55'])
  })

  it('페이지 하나가 실패해도 나머지는 돌려준다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      // 2번만 권한 오류.
      { match: (r) => r.path.endsWith('/content/2'), respond: () => ({ status: 403, body: '{}' }) },
      pageRoute(PLAIN_STORAGE)
    ])

    const data = await pages(ctx, connector, { pageIds: ['1', '2'] })
    expect(data.pages.map((p) => p.pageId)).toEqual(['1'])
    expect(data.failedPages).toEqual([{ pageId: '2', message: expect.stringContaining('403') }])
  })

  it('본문이 참조한 첨부만 바이너리+XSRF 로 내려받는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      pageRoute(),
      ...attachmentRoutes([
        { id: 'att-1', title: 'diagram.png' },
        // 본문이 참조하지 않는 첨부 — 받지 않는다.
        { id: 'att-2', title: 'unused.zip' }
      ])
    ])

    const data = await pages(ctx, connector, { pageIds: ['1'] })
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

    const page = (await pages(ctx, connector, { pageIds: ['1'] })).pages[0]
    expect(page.assets).toEqual([])
    expect(page.failedAssets).toEqual([{ filename: 'diagram.png', message: expect.any(String) }])
    // 본문은 그대로 저장됐다.
    expect(page.markdownPath.endsWith('page.md')).toBe(true)
  })

  it('본문이 참조한 첨부가 목록에 없으면 실패로 남긴다 — 조용히 넘기지 않는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([okUser, pageRoute(), ...attachmentRoutes([])])

    const page = (await pages(ctx, connector, { pageIds: ['1'] })).pages[0]
    expect(page.failedAssets).toEqual([
      { filename: 'diagram.png', message: expect.stringContaining('목록') }
    ])
  })

  it('includeAttachments:false 면 첨부 목록도 조회하지 않는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      pageRoute(),
      ...attachmentRoutes([{ id: 'att-1', title: 'diagram.png' }])
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'], includeAttachments: false })
    expect(seen.filter((r) => r.path.includes('attachment'))).toHaveLength(0)
    // 진단 조회도 함께 꺼진다 — 받지 않겠다고 한 호출자가 추가 요청을 물지 않는다.
    expect(data.pages[0].unreferencedAttachments).toEqual([])
  })

  // 0168 — 0164 의 "참조 0개면 목록 조회조차 하지 않는다" 를 **의도적으로 뒤집는다**. 받지
  // 않는 것과 보지 않는 것은 다르다: 조회를 건너뛰면 "첨부 없는 페이지" 와 "이미지 참조를 못
  // 알아본 페이지" 가 같은 출력이 되어 검출 실패가 무성으로 묻힌다(사용자 보고 2026-08-05).
  it('참조가 없어도 첨부 목록을 조회해 진단으로 남긴다 — 받지는 않는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      pageRoute(PLAIN_STORAGE),
      ...attachmentRoutes([
        { id: 'att-1', title: 'diagram.png' },
        { id: 'att-2', title: 'b.png' }
      ])
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })

    // 목록은 **한 번만** 조회한다.
    expect(seen.filter((r) => r.path.endsWith('/child/attachment'))).toHaveLength(1)
    // 바이트를 받는 요청은 나가지 않는다 — 다운로드 대상은 여전히 본문이 참조한 것뿐이다.
    expect(seen.filter((r) => r.path.endsWith('/data'))).toHaveLength(0)
    expect(data.pages[0].assets).toEqual([])
    expect(data.pages[0].unreferencedAttachments).toEqual(['diagram.png', 'b.png'])
  })

  it('참조 밖 첨부는 받지 않고 이름만 남긴다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      pageRoute(),
      ...attachmentRoutes([
        { id: 'att-1', title: 'diagram.png', metadata: { mediaType: 'image/png' } },
        { id: 'att-2', title: '회의록.pdf' }
      ])
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })
    expect(data.pages[0].assets.map((a) => a.filename)).toEqual(['diagram.png'])
    expect(data.pages[0].unreferencedAttachments).toEqual(['회의록.pdf'])
    expect(data.pages[0].failedAssets).toEqual([])
  })

  it('download 경로 밖 img 는 첨부 후보가 아니다 — 실패로 새지 않는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([okUser, pageRoute(ICON_STORAGE), ...attachmentRoutes([])])
    const data = await pages(ctx, connector, { pageIds: ['1'] })
    expect(data.pages[0].assets).toEqual([])
    // 이모티콘 경로를 첨부로 오인하면 여기에 "목록에 없습니다" 가 쌓인다.
    expect(data.pages[0].failedAssets).toEqual([])
    expect(seen.filter((r) => r.path.endsWith('/data'))).toHaveLength(0)
  })

  it('진단용 목록 조회가 실패해도 페이지 저장은 완료된다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      pageRoute(PLAIN_STORAGE),
      {
        match: (r) => r.path.endsWith('/child/attachment'),
        respond: () => ({ status: 500, body: '{}' })
      }
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })
    // 받을 것이 없는 조회의 실패가 멀쩡한 페이지를 떨어뜨리면 안 된다.
    expect(data.failedPages).toEqual([])
    expect(data.pages[0].unreferencedAttachments).toEqual([])
  })

  // 0169 — 멘션이 변환에서 통째로 사라지던 것을 자리표시자 + 이름 해석으로 되살린다.
  it('멘션 userkey 를 표시 이름으로 치환한다', async () => {
    const dir = pageDir(SERVER.id, '1')
    cleanup.push(dir)
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      pageRoute(MENTION_STORAGE),
      ...attachmentRoutes([]),
      userRoute({ username: 'gdhong', displayName: '홍길동' })
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })

    expect(data.pages[0].markdownPreview).toContain('@홍길동')
    expect(data.pages[0].markdownPreview).not.toContain('{{user:')
    // 저장된 본문에도 같은 것이 들어간다 — 미리보기만 고치면 page.md 가 어긋난다.
    expect(await readFile(join(dir, 'page.md'), 'utf8')).toContain('@홍길동')
    // 키당 한 번만 조회한다.
    expect(seen.filter((r) => r.path.endsWith('/rest/api/user'))).toHaveLength(1)
  })

  it('사용자 조회가 실패해도 자리표시자를 흘리지 않는다', async () => {
    const dir = pageDir(SERVER.id, '1')
    cleanup.push(dir)
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      pageRoute(MENTION_STORAGE),
      ...attachmentRoutes([]),
      userRoute({}, 403)
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })

    // 페이지는 살아 있고,
    expect(data.failedPages).toEqual([])
    // 자리표시자는 본문 어디에도 남지 않으며,
    expect(await readFile(join(dir, 'page.md'), 'utf8')).not.toContain('{{user:')
    // 멘션이 있었다는 사실은 보존된다.
    expect(data.pages[0].markdownPreview).toContain('@사용자')
  })

  it('displayName 이 없으면 username 으로 폴백한다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      pageRoute(MENTION_STORAGE),
      ...attachmentRoutes([]),
      userRoute({ username: 'gdhong' })
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })
    expect(data.pages[0].markdownPreview).toContain('@gdhong')
  })

  it('멘션이 없으면 사용자 조회를 하지 않는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([okUser, pageRoute(), ...attachmentRoutes([])])
    await pages(ctx, connector, { pageIds: ['1'] })
    expect(seen.filter((r) => r.path.endsWith('/rest/api/user'))).toHaveLength(0)
  })

  // 0169 — 본문 URL 은 삽입 시점 버전(`?version=1`)을 달고 있다. 우리는 목록이 준 **현재**
  // 버전을 받고, 그 번호를 기록해 사후 확인이 가능하게 한다.
  it('본문 URL 의 옛 version 을 따르지 않고 현재 첨부를 받는다', async () => {
    const dir = pageDir(SERVER.id, '1')
    cleanup.push(dir)
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      pageRoute('<p><img src="/download/attachments/1/shot.png?version=1&amp;api=v2" /></p>'),
      ...attachmentRoutes([
        {
          id: 'att-9',
          title: 'shot.png',
          metadata: { mediaType: 'image/png' },
          version: { number: 3 },
          _links: { download: '/download/attachments/1/shot.png?version=3&api=v2' }
        }
      ])
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })

    expect(data.pages[0].assets).toHaveLength(1)
    expect(data.pages[0].assets[0].version).toBe(3)
    // 첨부 목록은 version 확장을 달고 나간다.
    const list = seen.find((r) => r.path.endsWith('/child/attachment'))
    expect(list?.query).toMatchObject({ expand: 'version' })

    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
      assets: Array<{ version?: number }>
    }
    expect(manifest.assets[0].version).toBe(3)
  })

  // 0171 — 사용자 실측: `/child/attachment/{id}/data` 는 GET 이 **405** 다(문서상 업로드 좌표).
  // 그래서 목록이 준 `_links.download` 를 1순위로 둔다.
  it('download 링크를 먼저 쓰고 data 경로는 두드리지 않는다', async () => {
    const dir = pageDir(SERVER.id, '1')
    cleanup.push(dir)
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      pageRoute(),
      {
        match: (r) => r.path.endsWith('/child/attachment'),
        respond: () => ({
          status: 200,
          body: JSON.stringify({
            results: [
              {
                id: 'att-1',
                title: 'diagram.png',
                version: { number: 2 },
                _links: { download: '/download/attachments/1/diagram.png?version=2' }
              }
            ]
          })
        })
      },
      // 이 경로가 열려 있어도 쓰지 않는다 — 실서버에서 405 를 주기 때문이다.
      { match: (r) => r.path.endsWith('/data'), respond: () => ({ status: 405, body: '{}' }) },
      {
        match: (r) => r.path.includes('/download/attachments/'),
        respond: () => ({ status: 200, body: '', bodyBytes: new Uint8Array([9, 9]) })
      }
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })

    expect(data.pages[0].assets.map((a) => a.filename)).toEqual(['diagram.png'])
    expect(seen.filter((r) => r.path.includes('/download/attachments/'))).toHaveLength(1)
    expect(seen.filter((r) => r.path.endsWith('/data'))).toHaveLength(0)

    // 어디서 받았는지 절대 URL 로 남는다 (0171, 사용자 요청).
    expect(data.pages[0].assets[0].sourceUrl).toBe(
      'https://wiki.invalid/download/attachments/1/diagram.png?version=2'
    )
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
      assets: Array<{ sourceUrl?: string }>
    }
    expect(manifest.assets[0].sourceUrl).toBe(
      'https://wiki.invalid/download/attachments/1/diagram.png?version=2'
    )
  })

  it('download 링크가 없으면 data 경로로 받고 그 URL 을 남긴다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      pageRoute(),
      ...attachmentRoutes([{ id: 'att-1', title: 'diagram.png' }])
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })
    expect(data.pages[0].assets[0].sourceUrl).toBe(
      'https://wiki.invalid/rest/api/content/1/child/attachment/att-1/data'
    )
  })

  it('download 링크가 실패하면 data 경로로 재시도한다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      pageRoute(),
      {
        match: (r) => r.path.endsWith('/child/attachment'),
        respond: () => ({
          status: 200,
          body: JSON.stringify({
            results: [
              {
                id: 'att-1',
                title: 'diagram.png',
                _links: { download: '/download/attachments/1/diagram.png' }
              }
            ]
          })
        })
      },
      {
        match: (r) => r.path.includes('/download/attachments/'),
        respond: () => ({ status: 404, body: '{}' })
      },
      {
        match: (r) => r.path.endsWith('/data'),
        respond: () => ({ status: 200, body: '', bodyBytes: new Uint8Array([7]) })
      }
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })
    expect(data.pages[0].assets.map((a) => a.filename)).toEqual(['diagram.png'])
    expect(seen.filter((r) => r.path.endsWith('/data'))).toHaveLength(1)
  })

  it('두 다운로드 경로가 모두 실패해도 페이지 저장은 완료된다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      pageRoute(),
      {
        match: (r) => r.path.endsWith('/child/attachment'),
        respond: () => ({
          status: 200,
          body: JSON.stringify({
            results: [
              {
                id: 'att-1',
                title: 'diagram.png',
                _links: { download: '/download/attachments/1/diagram.png' }
              }
            ]
          })
        })
      },
      {
        match: (r) => r.path.includes('/download/attachments/'),
        respond: () => ({ status: 500, body: '{}' })
      },
      // 실서버가 주는 값 그대로 — 이 상태 코드가 결과에 보여야 진단이 된다.
      { match: (r) => r.path.endsWith('/data'), respond: () => ({ status: 405, body: '{}' }) }
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })
    expect(data.failedPages).toEqual([])
    expect(data.pages[0].assets).toEqual([])
    expect(data.pages[0].failedAssets).toEqual([
      { filename: 'diagram.png', message: expect.stringContaining('405') }
    ])
  })

  it('취소·크기 초과는 다음 다운로드 좌표로 재시도하지 않는다', async () => {
    cleanup.push(pageDir(SERVER.id, '1'))
    const connector = createConfluenceConnector(SERVER)
    const { ctx, seen } = context([
      okUser,
      pageRoute(),
      {
        match: (r) => r.path.endsWith('/child/attachment'),
        respond: () => ({
          status: 200,
          body: JSON.stringify({
            results: [
              {
                id: 'att-1',
                title: 'diagram.png',
                _links: { download: '/download/attachments/1/diagram.png' }
              }
            ]
          })
        })
      },
      {
        // 상태 실패가 아니라 전송 자체가 던지는 경우(취소·상한 초과).
        match: (r) => r.path.includes('/download/attachments/'),
        respond: () => {
          throw new Error('응답이 상한을 초과했습니다 (999 > 10 bytes)')
        }
      }
    ])
    const data = await pages(ctx, connector, { pageIds: ['1'] })

    // 같은 파일을 다시 받아도 같은 상한에 걸린다 — 다음 좌표를 두드리지 않는다.
    expect(seen.filter((r) => r.path.endsWith('/data'))).toHaveLength(0)
    expect(data.pages[0].failedAssets[0].message).toContain('상한을 초과')
  })

  it('manifest 에 참조 밖 첨부를 기록한다', async () => {
    const dir = pageDir(SERVER.id, '1')
    cleanup.push(dir)
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([
      okUser,
      pageRoute(PLAIN_STORAGE),
      ...attachmentRoutes([{ id: 'att-1', title: 'diagram.png' }])
    ])
    await pages(ctx, connector, { pageIds: ['1'] })

    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
      unreferencedAttachments?: unknown
    }
    expect(manifest.unreferencedAttachments).toEqual(['diagram.png'])
  })

  it('pageIds 가 없거나 비어 있으면 던진다', async () => {
    const connector = createConfluenceConnector(SERVER)
    const { ctx } = context([okUser])
    for (const params of [{}, { pageIds: [] }, { pageIds: [''] }, { pageIds: 'x' }]) {
      await expect(connector.invoke(ctx, { operation: 'pages', params })).rejects.toThrow(/pageIds/)
    }
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
