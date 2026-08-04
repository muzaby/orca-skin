// Confluence Data Center connector 런타임 (0160).
//
// **raw credential 을 보지 않는다** — `ctx.authenticatedFetch(bindingId, …)` 만 부르고 헤더 주입은
// broker 가 한다 (AUTH-PLAT-009). 그래서 이 파일에는 vault·secret·전역 fetch import 가 없다.
//
// 취득(REST)과 가공(Markdown 변환·저장)을 **모듈 경계로** 나눈다 — `rest.ts` 는 요청만 만들고,
// `storage-to-markdown.ts` 는 문자열만 다루며, `download-store.ts` 는 파일만 쓴다. 여기는 그
// 셋을 순서대로 부르는 오케스트레이션이다.

import type {
  ConnectorContext,
  ConnectorRequest,
  ConnectorResult,
  ConnectorRuntimeV1,
  ConnectorStatus
} from '../../../../contracts/connector-plugin'
import { DownloadStore, pageDir, type SavedAsset } from './download-store'
import { mapWithLimit } from './limit'
import {
  attachmentDataRequest,
  attachmentListRequest,
  currentUserRequest,
  normalizeBasePath,
  pageRequest,
  searchRequest,
  type SearchInput
} from './rest'
import { storageToMarkdown } from './storage-to-markdown'

export interface ConfluenceServerConfig {
  // connector ID. 도구 서버 ID·다운로드 디렉터리가 여기서 파생되므로 바꾸면 이름이 전부 바뀐다.
  id: string
  label: string
  // 경로 없는 origin. manifest `OriginSchema` 가 형태를 강제한다.
  baseUrl: string
  // 컨텍스트 경로(`/confluence`). 없으면 생략.
  apiBasePath?: string
  // 첨부 하나의 상한. 넘으면 그 파일만 실패로 기록하고 나머지는 계속 받는다.
  maxAttachmentBytes?: number
  // 동시 다운로드 상한.
  downloadConcurrency?: number
}

const DEFAULT_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
const DEFAULT_DOWNLOAD_CONCURRENCY = 4
// 도구 결과에 인라인으로 싣는 Markdown 상한. 전체 본문은 `page.md` 에 있으므로 여기서는
// 모델이 "무엇을 받았는지" 판단할 만큼만 준다 — 대용량 페이지가 컨텍스트를 통째로 먹지 않게.
const PREVIEW_CHARS = 4000

// 검색 한 번이 본문 변환까지 하므로(0164 r2 — 사용자 요구 "search 후 pageids 추출하여 마크다운
// 변환 및 이미지 첨부 다운로드") 몇 개를 펼칠지 상한이 필요하다. 상한이 없으면 검색 결과 25건이
// 곧 25번의 페이지 조회 + 첨부 다운로드가 되어 사내 서버와 모델 컨텍스트를 동시에 때린다.
const DEFAULT_MAX_PAGES = 5
const MAX_MAX_PAGES = 10
// 페이지 하나가 이미 첨부를 동시 다운로드한다 — 페이지까지 넓게 열면 곱해진다.
const PAGE_CONCURRENCY = 2

// operation 은 **도구 표면과 1:1** 이다. 0164 r2 에서 도구를 `confluence_search` 하나로 줄이면서
// `verify`·`page`·`attachments` 도 함께 지웠다 — `invoke` 를 부르는 곳은 도구 handler 뿐이라
// 남겨 두면 아무도 부르지 않는 분기가 된다(자격증명 검증은 `start()` 가 한다).
export const CONFLUENCE_OPERATIONS = {
  search: 'search'
} as const

export interface ConfluenceSearchHit {
  id: string
  title: string
  spaceKey?: string
  type: string
}

export interface ConfluenceSearchResult {
  // 질의가 맞춘 전체 목록. 본문을 펼치지 않은 것까지 포함한다 — 모델이 다음 질의를 좁힐 근거다.
  hits: ConfluenceSearchHit[]
  // 상한 안에서 실제로 Markdown 으로 변환하고 첨부까지 받은 페이지.
  pages: ConfluencePageResult[]
  // 페이지 하나가 404·권한 오류여도 검색 전체를 실패시키지 않는다.
  failedPages: Array<{ pageId: string; title: string; message: string }>
  // 상한에 걸려 본문을 펼치지 않은 hit 수. 0 이 아니면 모델이 질의를 좁혀야 한다는 신호다.
  skippedPages: number
}

export interface ConfluencePageResult {
  pageId: string
  title: string
  spaceKey?: string
  version?: number
  directory: string
  markdownPath: string
  markdownPreview: string
  previewTruncated: boolean
  assets: SavedAsset[]
  failedAssets: Array<{ filename: string; message: string }>
  unhandledMacros: string[]
}

// 사람이 손으로 적는 값을 흡수한다 (0164 r2). manifest 의 `OriginSchema` 는 **경로 없는 origin**
// 만 받는데, 브라우저 주소창에서 복사하면 `https://wiki.corp/` 나 `https://wiki.corp/confluence`
// 가 되기 십상이다. 그 한 글자가 패키지 등록을 통째로 거부시키고(all-or-nothing) 흔적은 로그뿐
// 이라, 사용자에게는 "servers.ts 에 구성했는데 UI 에 없다" 로만 보인다(사용자 보고 2026-08-04).
// 여기서 origin 과 컨텍스트 경로로 갈라 준다 — 두 값이 가리키는 서버는 같다.
export function normalizeServerConfig(config: ConfluenceServerConfig): ConfluenceServerConfig {
  let parsed: URL
  try {
    parsed = new URL(config.baseUrl)
  } catch {
    // 스킴이 없는 등 해석 불가면 손대지 않는다 — manifest 가 거부하고 진단에 사유가 남는다.
    return config
  }
  const fromUrl = normalizeBasePath(parsed.pathname)
  // 명시된 `apiBasePath` 가 우선한다(그 필드가 이 값의 정본이다).
  const apiBasePath = config.apiBasePath ?? (fromUrl === '' ? undefined : fromUrl)
  return {
    ...config,
    baseUrl: parsed.origin,
    ...(apiBasePath !== undefined ? { apiBasePath } : {})
  }
}

export function createConfluenceConnector(raw: ConfluenceServerConfig): ConnectorRuntimeV1 {
  const config = normalizeServerConfig(raw)
  const endpoint = { apiBasePath: normalizeBasePath(config.apiBasePath) }
  const maxAttachmentBytes = config.maxAttachmentBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES
  const concurrency = config.downloadConcurrency ?? DEFAULT_DOWNLOAD_CONCURRENCY

  async function json(
    ctx: ConnectorContext,
    req: ReturnType<typeof pageRequest>
  ): Promise<unknown> {
    const res = await ctx.authenticatedFetch(
      { bindingId: ctx.bindingId, connectorId: config.id, ...req },
      ctx.signal
    )
    if (res.status < 200 || res.status >= 300) {
      throw new HttpStatusError(res.status)
    }
    try {
      return JSON.parse(res.body) as unknown
    } catch {
      // 인증 실패 시 로그인 HTML 이 200 으로 돌아오는 배포가 있다 — JSON 이 아니면 실패다.
      throw new Error('Confluence 응답이 JSON 이 아닙니다 (인증 또는 경로 설정을 확인하세요)')
    }
  }

  return {
    descriptor: {
      id: config.id,
      pluginId: CONFLUENCE_PLUGIN_ID,
      apiVersion: 1,
      label: config.label,
      acceptedAuthProviders: [CONFLUENCE_PAT_PROVIDER_ID, CONFLUENCE_BASIC_PROVIDER_ID],
      baseUrl: config.baseUrl,
      // 기본값은 PAT(Bearer). ID/비밀번호 binding 은 아래 presentations 가 BasicPair 로 돌린다.
      presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' },
      presentations: {
        personal_access_token: { location: 'header', name: 'Authorization', scheme: 'Bearer' },
        basic: { location: 'header', name: 'Authorization', scheme: 'BasicPair' }
      }
    },

    // 자격증명 실검증 지점. provider 의 probe 대신 여기서 하는 이유는 **실제 요청과 같은 경로**로
    // 검증되기 때문이다 — provider 는 connector 의 origin·컨텍스트 경로를 모른다.
    async start(ctx: ConnectorContext): Promise<ConnectorStatus> {
      try {
        await json(ctx, currentUserRequest(endpoint))
        return { health: 'ready' }
      } catch (error) {
        if (error instanceof HttpStatusError && (error.status === 401 || error.status === 403)) {
          return { health: 'unauthenticated', message: '자격증명이 거부되었습니다' }
        }
        ctx.logger('confluence.start.failed', { message: String(error) })
        return {
          health: 'unreachable',
          message: `${config.label} 서버에 연결하지 못했습니다`
        }
      }
    },

    async invoke(ctx: ConnectorContext, request: ConnectorRequest): Promise<ConnectorResult> {
      const params = request.params ?? {}
      switch (request.operation) {
        case CONFLUENCE_OPERATIONS.search: {
          const body = await json(ctx, searchRequest(endpoint, params as SearchInput))
          const hits = parseSearchHits(body)
          return { ok: true, data: await expandHits(ctx, hits, clampMaxPages(params.maxPages)) }
        }

        default:
          return { ok: false, message: `알 수 없는 operation: ${request.operation}` }
      }
    },

    // 연결 종료 시 정리할 원격 자원이 없다 — 상태를 서버에 남기지 않는 read-only connector 다.
    async stop(): Promise<void> {
      return undefined
    }
  }

  // 검색 결과를 본문까지 펼친다. `confluence_get_page` 를 없앤 뒤(0164 r2) 모델이 본문에 닿는
  // 유일한 경로다 — 검색이 id 만 주면 그 id 로 할 수 있는 일이 없다.
  async function expandHits(
    ctx: ConnectorContext,
    hits: readonly ConfluenceSearchHit[],
    maxPages: number
  ): Promise<ConfluenceSearchResult> {
    // 첨부·댓글은 본문 변환 대상이 아니다.
    const pageHits = hits.filter((hit) => hit.type === 'page')
    const targets = pageHits.slice(0, maxPages)

    const settled = await mapWithLimit(targets, PAGE_CONCURRENCY, (hit) =>
      fetchPage(ctx, hit.id, true)
    )

    const pages: ConfluencePageResult[] = []
    const failedPages: ConfluenceSearchResult['failedPages'] = []
    settled.forEach((result, index) => {
      if (result.ok) pages.push(result.value)
      else
        failedPages.push({
          pageId: targets[index].id,
          title: targets[index].title,
          message: result.error.message
        })
    })

    return { hits: [...hits], pages, failedPages, skippedPages: pageHits.length - targets.length }
  }

  async function fetchPage(
    ctx: ConnectorContext,
    pageId: string,
    includeAttachments: boolean
  ): Promise<ConfluencePageResult> {
    const raw = await json(ctx, pageRequest(endpoint, pageId))
    const page = raw as {
      id?: unknown
      title?: unknown
      space?: { key?: unknown }
      version?: { number?: unknown }
      body?: { storage?: { value?: unknown } }
    }
    const storage = typeof page.body?.storage?.value === 'string' ? page.body.storage.value : ''
    const converted = storageToMarkdown(storage)

    const dir = pageDir(config.id, pageId)
    const store = new DownloadStore(dir)
    await store.ensure()

    // 본문이 참조하지 않으면 목록 조회조차 하지 않는다 — 요청 하나를 아끼는 것보다,
    // "참조 0개" 를 "전부 받기" 로 오해할 여지를 남기지 않는 것이 요점이다.
    const downloads =
      includeAttachments && converted.referencedAttachments.length > 0
        ? await downloadAttachments(ctx, pageId, converted.referencedAttachments, store)
        : { assets: [], failed: [] }

    const title = typeof page.title === 'string' ? page.title : pageId
    const markdown = `# ${title}\n\n${converted.markdown}\n`
    const markdownPath = await store.saveText('page.md', markdown)

    const result: ConfluencePageResult = {
      pageId,
      title,
      ...(typeof page.space?.key === 'string' ? { spaceKey: page.space.key } : {}),
      ...(typeof page.version?.number === 'number' ? { version: page.version.number } : {}),
      directory: dir,
      markdownPath,
      markdownPreview: markdown.slice(0, PREVIEW_CHARS),
      previewTruncated: markdown.length > PREVIEW_CHARS,
      assets: downloads.assets,
      failedAssets: downloads.failed,
      unhandledMacros: converted.unhandledMacros
    }

    // 무엇을 받았고 무엇이 폴백됐는지 디렉터리 안에 남긴다 — 결과를 나중에 되짚을 수 있어야 한다.
    await store.saveText('manifest.json', `${JSON.stringify(manifestOf(result), null, 2)}\n`)
    return result
  }

  async function downloadAttachments(
    ctx: ConnectorContext,
    pageId: string,
    filenames: readonly string[],
    store: DownloadStore
  ): Promise<{ assets: SavedAsset[]; failed: Array<{ filename: string; message: string }> }> {
    const listed = parseAttachments(await json(ctx, attachmentListRequest(endpoint, pageId)))
    // 본문이 참조한 것만 받는다. 목록 전체를 받으면 쓰지 않는 파일이 디스크에 쌓인다.
    const wanted = listed.filter((item) => filenames.includes(item.title))
    // 본문이 가리키는데 목록에 없는 첨부 — 이미지 링크가 깨진 채 남으므로 조용히 넘기지 않는다.
    const missing = filenames
      .filter((name) => !listed.some((item) => item.title === name))
      .map((filename) => ({ filename, message: '페이지 첨부 목록에 없습니다' }))

    if (wanted.length === 0) return { assets: [], failed: missing }

    // 동시성 상한 — 첨부가 수십 개면 사내 서버가 429/타임아웃을 낸다.
    const results = await mapWithLimit(wanted, concurrency, async (item) => {
      const res = await ctx.authenticatedFetch(
        {
          bindingId: ctx.bindingId,
          connectorId: config.id,
          ...attachmentDataRequest(endpoint, pageId, item.id, maxAttachmentBytes)
        },
        ctx.signal
      )
      if (res.status < 200 || res.status >= 300) throw new HttpStatusError(res.status)
      if (res.bodyBytes === undefined) throw new Error('바이너리 본문이 비어 있습니다')
      return store.saveAsset(item.title, res.bodyBytes, item.mediaType)
    })

    const assets: SavedAsset[] = []
    const failed: Array<{ filename: string; message: string }> = [...missing]
    results.forEach((result, index) => {
      if (result.ok) assets.push(result.value)
      // 첨부 하나가 404·크기 초과여도 페이지 전체를 실패시키지 않는다.
      else failed.push({ filename: wanted[index].title, message: result.error.message })
    })
    return { assets, failed }
  }
}

class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`Confluence 응답 상태: ${status}`)
    this.name = 'HttpStatusError'
  }
}

// 패키지 식별자 — connector·provider·runtime tool 이 공유한다.
export const CONFLUENCE_PLUGIN_ID = 'confluence'
export const CONFLUENCE_PAT_PROVIDER_ID = 'confluence-pat'
export const CONFLUENCE_BASIC_PROVIDER_ID = 'confluence-basic'

function manifestOf(result: ConfluencePageResult): Record<string, unknown> {
  return {
    pageId: result.pageId,
    title: result.title,
    spaceKey: result.spaceKey,
    version: result.version,
    markdown: 'page.md',
    assets: result.assets.map((asset) => ({
      filename: asset.filename,
      bytes: asset.bytes,
      mediaType: asset.mediaType
    })),
    failedAssets: result.failedAssets,
    unhandledMacros: result.unhandledMacros
  }
}

interface AttachmentEntry {
  id: string
  title: string
  mediaType?: string
}

function parseAttachments(body: unknown): AttachmentEntry[] {
  const results = (body as { results?: unknown }).results
  if (!Array.isArray(results)) return []
  return results.flatMap((entry): AttachmentEntry[] => {
    const item = entry as { id?: unknown; title?: unknown; metadata?: { mediaType?: unknown } }
    if (typeof item.id !== 'string' || typeof item.title !== 'string') return []
    return [
      {
        id: item.id,
        title: item.title,
        ...(typeof item.metadata?.mediaType === 'string'
          ? { mediaType: item.metadata.mediaType }
          : {})
      }
    ]
  })
}

function parseSearchHits(body: unknown): ConfluenceSearchHit[] {
  const results = (body as { results?: unknown }).results
  if (!Array.isArray(results)) return []
  return results.flatMap((entry): ConfluenceSearchHit[] => {
    const item = entry as {
      id?: unknown
      title?: unknown
      type?: unknown
      space?: { key?: unknown }
    }
    if (typeof item.id !== 'string' || typeof item.title !== 'string') return []
    return [
      {
        id: item.id,
        title: item.title,
        type: typeof item.type === 'string' ? item.type : 'page',
        ...(typeof item.space?.key === 'string' ? { spaceKey: item.space.key } : {})
      }
    ]
  })
}

export function clampMaxPages(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_PAGES
  return Math.min(Math.max(Math.trunc(value), 1), MAX_MAX_PAGES)
}
