// Confluence Data Center 서비스 런타임 (0160 → 0181 복원).
//
// **raw credential 을 보지 않는다** — `ctx.request(…)` 만 부르고 헤더 주입은 `ProviderApi` 가
// 한다. 그래서 이 파일에는 vault·secret·전역 fetch import 가 없다.
//
// 0181 변경점: `ConfluenceContext`(구 connector 계약) → `ConfluenceContext`. 요청에서 `target`
// 필드가 사라졌다 — provider 하나가 곧 대상이라 요청마다 자기를 지목할 필요가 없다.
//
// 취득(REST)과 가공(Markdown 변환·저장)을 **모듈 경계로** 나눈다 — `rest.ts` 는 요청만 만들고,
// `storage-to-markdown.ts` 는 문자열만 다루며, `download-store.ts` 는 파일만 쓴다. 여기는 그
// 셋을 순서대로 부르는 오케스트레이션이다.

import type { ProviderRequest, ProviderResponse } from '../../../../contracts/provider'
import { DownloadStore, pageDir, type SavedAsset } from './download-store'
import { mapWithLimit, partitionSettled } from './limit'
import {
  attachmentDataRequest,
  attachmentDownloadRequest,
  attachmentListRequest,
  clampLimit,
  clampStart,
  currentUserRequest,
  normalizeBasePath,
  pageRequest,
  searchRequest,
  userRequest,
  type SearchInput
} from './rest'
import { storageToMarkdown, UNKNOWN_USER_LABEL, USER_TOKEN_PATTERN } from './storage-to-markdown'

// ── 이 런타임이 보는 세상 (0181) ─────────────────────────────────────────────
// `ProviderApi` 를 그대로 받지 않고 좁힌 포트를 받는다 — 이 모듈에 필요한 것은 인증된 요청
// 하나뿐이고, 넓게 받으면 `materialize`·`token` 같은 값 표면까지 딸려온다.
export interface ConfluenceContext {
  readonly request: (req: ProviderRequest, signal?: AbortSignal) => Promise<ProviderResponse>
  readonly signal?: AbortSignal
  readonly logger: (message: string, meta?: Record<string, unknown>) => void
}

export type ConfluenceHealth = 'ready' | 'unauthenticated' | 'unreachable' | 'error'

export interface ConfluenceStatus {
  health: ConfluenceHealth
  message?: string
}

export interface ConfluenceInvocation {
  operation: string
  params?: Record<string, unknown>
}

export type ConfluenceResult =
  { ok: true; data: unknown } | { ok: false; message: string; health?: ConfluenceHealth }

export interface ConfluenceServerConfig {
  // connector ID. 도구 서버 ID·다운로드 디렉터리가 여기서 파생되므로 바꾸면 이름이 전부 바뀐다.
  id: string
  label: string
  // 경로 없는 origin. 등록이 형태를 강제한다.
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

// 한 번에 본문을 펼칠 페이지 수 상한 — **이 값이 권위다.** `invoke` 는 도구 스키마 밖에서도
// 호출되는 계약이라 실제 강제는 여기서 일어난다. 도구 스키마는 이 상수를 import 해 쓴다.
// (검색 상한과 우연히 같은 50 이지만 다른 것이다 — 검색 페이지 크기 vs 일괄 조회 배치 크기.)
export const MAX_PAGES_PER_CALL = 50
// 페이지 하나가 이미 첨부를 동시 다운로드한다 — 페이지까지 넓게 열면 곱해진다.
const PAGE_CONCURRENCY = 2
// 멘션 이름 조회 동시성. 첨부와 달리 페이지당 한 자릿수가 보통이라 낮게 잡는다.
const USER_LOOKUP_CONCURRENCY = 4
// 페이지당 이름 조회 상한. 멘션이 많은 페이지 × 배치 50페이지가 곱해지는 것을 막는다.
const MAX_USER_LOOKUPS = 50

// operation 은 **도구 표면과 1:1** 이다 (0164 r3 — 사용자 재지정):
//   search → id·제목·작성자만(본문 없음), 페이지네이션
//   pages  → 받은 id 들의 본문 + 첨부
// `verify` 는 두지 않는다 — 자격증명 검증은 `start()` 가 실제 요청 경로로 한다.
export const CONFLUENCE_OPERATIONS = {
  search: 'search',
  pages: 'pages'
} as const

export interface ConfluenceSearchHit {
  id: string
  title: string
  // 작성자 표시 이름(`history.createdBy`). 없으면 마지막 수정자로 폴백한다.
  author?: string
  spaceKey?: string
  type: string
}

export interface ConfluenceSearchResult {
  hits: ConfluenceSearchHit[]
  // 이번 응답이 덮은 구간. `limit` 은 **서버가 실제로 적용한 값**이다 — 요청보다 낮을 수 있고,
  // 그때는 다음 오프셋도 그 값만큼만 밀어야 결과를 건너뛰지 않는다.
  start: number
  limit: number
  size: number
  // 서버가 주면 전체 건수. CQL 검색은 보통 준다.
  totalSize?: number
  // 더 남았으면 다음 호출에 그대로 넣을 오프셋. 없으면 끝이다.
  nextStart?: number
}

export interface ConfluencePagesResult {
  pages: ConfluencePageResult[]
  // 페이지 하나가 404·권한 오류여도 나머지를 버리지 않는다.
  failedPages: Array<{ pageId: string; message: string }>
  // 상한을 넘겨 처리하지 않은 id. 다음 호출에 그대로 넣으면 된다.
  skippedPageIds: string[]
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
  // 페이지에는 딸려 있으나 본문이 참조하지 않은 첨부 이름 (0168). **받지는 않는다** — 변환기가
  // 이미지 참조를 못 알아봤을 때 그 사실이 조용히 묻히지 않게 하는 진단 값이다.
  unreferencedAttachments: string[]
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

// 런타임 표면 — 0181 에서 `descriptor` 가 사라졌다. 대상·origin·인증 방식·presentation 은
// 이제 `Provider` 선언이 갖는다(중복 선언 제거).
export interface ConfluenceRuntime {
  start(ctx: ConfluenceContext): Promise<ConfluenceStatus>
  invoke(ctx: ConfluenceContext, request: ConfluenceInvocation): Promise<ConfluenceResult>
  stop(ctx: ConfluenceContext): Promise<void>
}

export function createConfluenceRuntime(raw: ConfluenceServerConfig): ConfluenceRuntime {
  const config = normalizeServerConfig(raw)
  const endpoint = { apiBasePath: normalizeBasePath(config.apiBasePath) }
  const maxAttachmentBytes = config.maxAttachmentBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES
  const concurrency = config.downloadConcurrency ?? DEFAULT_DOWNLOAD_CONCURRENCY

  async function json(
    ctx: ConfluenceContext,
    req: ReturnType<typeof pageRequest>
  ): Promise<unknown> {
    const res = await ctx.request(req, ctx.signal)
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
    // 자격증명 실검증 지점. provider 의 probe 대신 여기서 하는 이유는 **실제 요청과 같은 경로**로
    // 검증되기 때문이다 — provider 는 connector 의 origin·컨텍스트 경로를 모른다.
    async start(ctx: ConfluenceContext): Promise<ConfluenceStatus> {
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

    async invoke(ctx: ConfluenceContext, request: ConfluenceInvocation): Promise<ConfluenceResult> {
      const params = request.params ?? {}
      switch (request.operation) {
        case CONFLUENCE_OPERATIONS.search: {
          const input = params as SearchInput
          const body = await json(ctx, searchRequest(endpoint, input))
          return {
            ok: true,
            data: parseSearchResponse(body, clampStart(input.start), clampLimit(input.limit))
          }
        }

        case CONFLUENCE_OPERATIONS.pages: {
          const pageIds = requireStringArray(params.pageIds, 'pageIds')
          const includeAttachments = params.includeAttachments !== false
          return { ok: true, data: await fetchPages(ctx, pageIds, includeAttachments) }
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

  // 받은 id 들의 본문 + 첨부. `search` 가 id·제목·작성자만 주므로(0164 r3) 모델이 본문에 닿는
  // 유일한 경로다. 중복 id 는 한 번만 처리한다 — 같은 페이지를 두 번 내려받을 이유가 없다.
  async function fetchPages(
    ctx: ConfluenceContext,
    pageIds: readonly string[],
    includeAttachments: boolean
  ): Promise<ConfluencePagesResult> {
    const unique = [...new Set(pageIds)]
    const targets = unique.slice(0, MAX_PAGES_PER_CALL)

    const { values: pages, failures: failedPages } = partitionSettled(
      await mapWithLimit(targets, PAGE_CONCURRENCY, (pageId) =>
        fetchPage(ctx, pageId, includeAttachments)
      ),
      (error, index) => ({ pageId: targets[index], message: error.message })
    )

    return { pages, failedPages, skippedPageIds: unique.slice(MAX_PAGES_PER_CALL) }
  }

  async function fetchPage(
    ctx: ConfluenceContext,
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

    // 본문이 참조하지 않아도 **목록은 조회한다** (0168). 받지 않는 것과 보지 않는 것은 다르다 —
    // 조회를 건너뛰면 "첨부 없는 페이지" 와 "이미지 참조를 못 알아본 페이지" 가 같은 출력이 되어
    // 검출 실패가 무성으로 묻힌다. 다운로드 대상은 여전히 본문이 참조한 것뿐이다.
    const downloads = includeAttachments
      ? await collectAttachments(ctx, pageId, converted.referencedAttachments, store)
      : { assets: [], failed: [], unreferenced: [] }

    const title = typeof page.title === 'string' ? page.title : pageId
    // 멘션 자리표시자를 표시 이름으로 바꾼 **뒤에** 저장한다 — `page.md`·미리보기 어디에도
    // `{{user:…}}` 가 남으면 안 된다(0169).
    const body = await resolveMentions(ctx, converted.markdown, converted.referencedUsers)
    const markdown = `# ${title}\n\n${body}\n`
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
      unreferencedAttachments: downloads.unreferenced,
      unhandledMacros: converted.unhandledMacros
    }

    // 무엇을 받았고 무엇이 폴백됐는지 디렉터리 안에 남긴다 — 결과를 나중에 되짚을 수 있어야 한다.
    await store.saveText('manifest.json', `${JSON.stringify(manifestOf(result), null, 2)}\n`)
    return result
  }

  // 멘션 자리표시자(`@{{user:<userkey>}}`) → `@표시이름` (0169).
  //
  // `ri:userkey` 는 불투명해서 본문만으로는 이름을 알 수 없다 — 키마다 한 번 조회한다.
  // **조회 실패가 페이지를 죽이지 않는다**(0168 D1 에서 배운 것과 같은 규칙): 사내 디렉터리
  // 정책으로 403 이 오거나 탈퇴 사용자라 404 여도 본문은 저장돼야 한다. 그래서 마지막에
  // **남은 토큰을 전부** 기본 라벨로 훑어 치운다 — 자리표시자가 본문으로 새는 것이 최악이다.
  async function resolveMentions(
    ctx: ConfluenceContext,
    markdown: string,
    userkeys: readonly string[]
  ): Promise<string> {
    if (userkeys.length === 0) return markdown

    // 페이지당 조회 수 상한. 없으면 사람 200명을 나열한 페이지 × 배치 50페이지 = 만 번의
    // 요청이 된다(0168 D1 과 같은 계열 — 이번엔 출력이 아니라 **요청** 축이다). 상한을 넘긴
    // 키는 조회하지 않고 기본 라벨로 떨어지므로 본문은 여전히 온전하다.
    const targets = userkeys.slice(0, MAX_USER_LOOKUPS)
    if (userkeys.length > targets.length) {
      ctx.logger('confluence.mentions.truncated', {
        total: userkeys.length,
        looked: targets.length
      })
    }

    const names = new Map<string, string>()
    const looked = await mapWithLimit(targets, USER_LOOKUP_CONCURRENCY, async (userkey) => {
      const name = displayNameOf(await json(ctx, userRequest(endpoint, userkey)))
      if (name !== undefined) names.set(userkey, name)
    })
    // `mapWithLimit` 이 실패를 삼키므로 여기서 세지 않으면 **관측 지점이 0** 이 된다 —
    // 사내 디렉터리가 조회를 막아 모든 멘션이 `@사용자` 로 떨어져도 알 길이 없다.
    const failed = looked.filter((r) => !r.ok).length
    if (failed > 0) ctx.logger('confluence.mentions.lookup-failed', { failed, of: targets.length })

    return markdown.replace(
      USER_TOKEN_PATTERN,
      (_match, key: string) =>
        // 해석 못 한 키는 조용히 지우지 않고 "사용자" 로 남긴다 — 멘션이 있었다는 사실은 보존한다.
        names.get(key) ?? UNKNOWN_USER_LABEL
    )
  }

  // 참조가 0개일 때의 목록 조회는 **진단 전용**이다 — 받을 것이 없으므로, 그 조회가 실패했다고
  // 페이지를 실패로 떨어뜨리면 진단을 켠 대가로 멀쩡하던 페이지를 잃는다. 참조가 있을 때는
  // 목록 실패 = 받을 수 없음이므로 그대로 전파한다(0160 이래의 동작).
  async function collectAttachments(
    ctx: ConfluenceContext,
    pageId: string,
    filenames: readonly string[],
    store: DownloadStore
  ): Promise<DownloadOutcome> {
    if (filenames.length > 0) return downloadAttachments(ctx, pageId, filenames, store)
    try {
      return await downloadAttachments(ctx, pageId, filenames, store)
    } catch (error) {
      ctx.logger('confluence.attachments.list-failed', { pageId, message: String(error) })
      return { assets: [], failed: [], unreferenced: [] }
    }
  }

  async function downloadAttachments(
    ctx: ConfluenceContext,
    pageId: string,
    filenames: readonly string[],
    store: DownloadStore
  ): Promise<DownloadOutcome> {
    const listed = parseAttachments(await json(ctx, attachmentListRequest(endpoint, pageId)))
    // 본문이 참조한 것만 받는다. 목록 전체를 받으면 쓰지 않는 파일이 디스크에 쌓인다.
    const wanted = listed.filter((item) => filenames.includes(item.title))
    // 본문이 가리키는데 목록에 없는 첨부 — 이미지 링크가 깨진 채 남으므로 조용히 넘기지 않는다.
    const missing = filenames
      .filter((name) => !listed.some((item) => item.title === name))
      .map((filename) => ({ filename, message: '페이지 첨부 목록에 없습니다' }))
    // 받지 않은 나머지. 참조가 0개면 목록 전체가 여기 담겨 "본문에서 못 찾았다" 를 드러낸다.
    const unreferenced = listed
      .filter((item) => !filenames.includes(item.title))
      .map((item) => item.title)

    if (wanted.length === 0) return { assets: [], failed: missing, unreferenced }

    // 동시성 상한 — 첨부가 수십 개면 사내 서버가 429/타임아웃을 낸다.
    const results = await mapWithLimit(wanted, concurrency, (item) =>
      downloadOne(ctx, pageId, item, store)
    )

    // 첨부 하나가 404·크기 초과여도 페이지 전체를 실패시키지 않는다.
    const { values: assets, failures } = partitionSettled(results, (error, index) => ({
      filename: wanted[index].title,
      message: error.message
    }))
    return { assets, failed: [...missing, ...failures], unreferenced }
  }

  // 첨부 하나를 받는다 — **좌표가 둘이고, `_links.download` 가 1순위다** (0171).
  //   ⓐ 목록이 준 `_links.download`(`/download/attachments/…`) — Atlassian 이 DC 다운로드
  //      좌표로 문서화한 쪽. 사용자가 실제로 쓰는 주소이기도 하다.
  //   ⓑ `/child/attachment/{id}/data` — 0160~0169 의 1순위였다. **실측 결과 GET 이 405 로
  //      막힌다**(사용자 보고 2026-08-05) — 그 경로는 문서상 *업로드(POST)* 좌표이고,
  //      배포에 따라 GET 을 302 로 넘겨 주기도 해서 지금도 폴백으로는 살려 둔다.
  //
  // 0169 는 "현행 경로가 302 로 동작하는 것이 broker 주석에 실측돼 있다" 를 근거로 순서를
  // 반대로 뒀는데, 그 주석은 **다른 배포의 관찰**이었다. 405 는 그 전제를 반증한다.
  //
  // 어느 쪽으로 받든 **버전은 목록 조회 시점의 현재 버전**이다 — 본문 URL 의 `?version=N`
  // (삽입 시점)을 따르지 않는다.
  async function downloadOne(
    ctx: ConfluenceContext,
    pageId: string,
    item: AttachmentEntry,
    store: DownloadStore
  ): Promise<SavedAsset> {
    const fetchBytes = async (req: RequestFields): Promise<Uint8Array> => {
      const res = await ctx.request(req, ctx.signal)
      if (res.status < 200 || res.status >= 300) throw new HttpStatusError(res.status)
      if (res.bodyBytes === undefined) throw new Error('바이너리 본문이 비어 있습니다')
      return res.bodyBytes
    }

    // 시도 순서. 목록이 링크를 안 주는 배포에서는 ⓑ 하나만 남는다.
    const attempts: RequestFields[] = [
      ...(item.downloadPath !== undefined
        ? [attachmentDownloadRequest(endpoint, item.downloadPath, maxAttachmentBytes)]
        : []),
      attachmentDataRequest(endpoint, pageId, item.id, maxAttachmentBytes)
    ]

    let bytes: Uint8Array | undefined
    let used = attempts[0]
    for (const [index, req] of attempts.entries()) {
      try {
        bytes = await fetchBytes(req)
        used = req
        break
      } catch (error) {
        const last = index === attempts.length - 1
        // **재시도 가치가 있을 때만** 다음 좌표로 넘어간다. 취소(abort)는 사용자가 그만두라고
        // 한 것이고, 크기 초과는 같은 파일이라 다시 받아도 같은 상한에 걸린다.
        if (last || !isRetriableDownloadError(error)) throw error
        ctx.logger('confluence.attachment.retry', {
          pageId,
          filename: item.title,
          path: req.path,
          message: String(error)
        })
      }
    }
    if (bytes === undefined) throw new Error('첨부를 받지 못했습니다')

    return store.saveAsset(item.title, bytes, {
      ...(item.mediaType !== undefined ? { mediaType: item.mediaType } : {}),
      ...(item.version !== undefined ? { version: item.version } : {}),
      // 어디서 받았는지 절대 URL 로 남긴다 (0171, 사용자 요청). 파일만 보고는 출처를 되짚을 수
      // 없고, 405 처럼 좌표 자체가 문제일 때 **어느 주소가 쓰였는지**가 진단의 시작점이다.
      sourceUrl: absoluteUrl(used)
    })
  }

  // 요청 서술자 → 사람이 브라우저에 붙여 넣을 수 있는 절대 URL.
  function absoluteUrl(req: RequestFields): string {
    const query = new URLSearchParams(req.query ?? {}).toString()
    return `${config.baseUrl}${req.path}${query === '' ? '' : `?${query}`}`
  }
}

type RequestFields = ReturnType<typeof attachmentDataRequest>

interface DownloadOutcome {
  assets: SavedAsset[]
  failed: Array<{ filename: string; message: string }>
  // 목록에 있으나 본문이 참조하지 않아 **받지 않은** 첨부 이름.
  unreferenced: string[]
}

// 두 번째 다운로드 좌표를 시도할 가치가 있는 실패인가. **HTTP 상태 실패만** 그렇다 —
// `/data` 가 404·405 를 주는 배포에서 `_links.download` 가 성공하는 것이 이 폴백의 존재 이유다.
// 취소·크기 초과·네트워크 중단은 좌표를 바꿔도 결과가 같다.
function isRetriableDownloadError(error: unknown): boolean {
  return error instanceof HttpStatusError
}

class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`Confluence 응답 상태: ${status}`)
    this.name = 'HttpStatusError'
  }
}

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
      mediaType: asset.mediaType,
      version: asset.version,
      // 출처를 파일 옆에 남긴다 (0171) — 나중에 원본 페이지의 첨부와 대조할 수 있어야 한다.
      sourceUrl: asset.sourceUrl
    })),
    failedAssets: result.failedAssets,
    unreferencedAttachments: result.unreferencedAttachments,
    unhandledMacros: result.unhandledMacros
  }
}

interface AttachmentEntry {
  id: string
  title: string
  mediaType?: string
  // 목록 조회 시점의 **현재 버전**. 본문 URL 이 달고 있는 삽입 시점 버전과 다를 수 있다.
  version?: number
  // `_links.download` — DC 의 정식 다운로드 좌표(`/download/attachments/…`). 폴백에 쓴다.
  downloadPath?: string
}

function parseAttachments(body: unknown): AttachmentEntry[] {
  const results = (body as { results?: unknown }).results
  if (!Array.isArray(results)) return []
  return results.flatMap((entry): AttachmentEntry[] => {
    const item = entry as {
      id?: unknown
      title?: unknown
      metadata?: { mediaType?: unknown }
      version?: { number?: unknown }
      _links?: { download?: unknown }
    }
    if (typeof item.id !== 'string' || typeof item.title !== 'string') return []
    const download = item._links?.download
    return [
      {
        id: item.id,
        title: item.title,
        ...(typeof item.metadata?.mediaType === 'string'
          ? { mediaType: item.metadata.mediaType }
          : {}),
        ...(typeof item.version?.number === 'number' ? { version: item.version.number } : {}),
        ...(typeof download === 'string' && download !== '' ? { downloadPath: download } : {})
      }
    ]
  })
}

// `/rest/api/user?key=` 응답 → 표시 이름. `displayName` 이 없는 배포는 `username` 으로 폴백한다.
function displayNameOf(body: unknown): string | undefined {
  const user = body as { displayName?: unknown; username?: unknown }
  for (const value of [user.displayName, user.username]) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

// 검색 응답 → hit 목록 + **페이지네이션 좌표**.
//
// 요청한 `limit` 을 그대로 다음 오프셋에 쓰면 안 된다 — Confluence 는 사이트 설정에 따라 더 낮은
// 값을 적용하고 그 사실을 응답의 `limit` 으로 알린다(사용자 결정 2026-08-04 — "허용치가 낮으면
// 해당 숫자를 따른다"). 실효값으로 밀지 않으면 결과가 통째로 건너뛰어진다.
export function parseSearchResponse(
  body: unknown,
  requestedStart: number,
  requestedLimit: number
): ConfluenceSearchResult {
  const envelope = body as { start?: unknown; limit?: unknown; size?: unknown; totalSize?: unknown }
  const hits = parseSearchHits(body)

  const start = typeof envelope.start === 'number' ? envelope.start : requestedStart
  // 서버가 limit 을 안 주면 요청값을 쓴다. 0 이하는 신뢰하지 않는다(오프셋이 전진하지 못한다).
  const serverLimit = typeof envelope.limit === 'number' ? envelope.limit : requestedLimit
  const limit = serverLimit > 0 ? Math.min(serverLimit, requestedLimit) : requestedLimit
  const size = typeof envelope.size === 'number' ? envelope.size : hits.length
  const totalSize = typeof envelope.totalSize === 'number' ? envelope.totalSize : undefined

  // 총계를 주면 그걸 믿고, 없으면 "이번에 한도만큼 채워 왔다" 를 다음이 있다는 신호로 본다.
  const hasMore = totalSize !== undefined ? start + size < totalSize : size >= limit && size > 0
  return {
    hits,
    start,
    limit,
    size,
    ...(totalSize !== undefined ? { totalSize } : {}),
    ...(hasMore ? { nextStart: start + limit } : {})
  }
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
      history?: { createdBy?: { displayName?: unknown; username?: unknown } }
      version?: { by?: { displayName?: unknown } }
    }
    if (typeof item.id !== 'string' || typeof item.title !== 'string') return []
    const author = parseAuthor(item)
    return [
      {
        id: item.id,
        title: item.title,
        type: typeof item.type === 'string' ? item.type : 'page',
        ...(author !== undefined ? { author } : {}),
        ...(typeof item.space?.key === 'string' ? { spaceKey: item.space.key } : {})
      }
    ]
  })
}

// 작성자 = `history.createdBy`. 그 확장이 빠진 배포도 있어 마지막 수정자로 폴백한다 —
// 없는 것보다는 누가 손댔는지가 낫고, 없으면 필드를 아예 싣지 않는다(빈 문자열 금지).
function parseAuthor(item: {
  history?: { createdBy?: { displayName?: unknown; username?: unknown } }
  version?: { by?: { displayName?: unknown } }
}): string | undefined {
  const candidates = [
    item.history?.createdBy?.displayName,
    item.history?.createdBy?.username,
    item.version?.by?.displayName
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

// 도구 입력은 SDK 가 스키마로 걸러 주지만, connector 는 **자기 입력을 스스로 검증한다** —
// `invoke` 는 도구 밖에서도 호출될 수 있는 계약이다.
function requireStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${name} 가 필요합니다`)
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item !== '')
  if (items.length === 0) throw new Error(`${name} 가 필요합니다`)
  return items
}
