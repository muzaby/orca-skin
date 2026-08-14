// Confluence runtime tool contribution (0160, 표면 재지정 0164 r3) — 모델에게 노출되는 도구 2종.
//
// **정적 descriptor 가 승인 정책의 SSOT 다** (0158). factory 는 실행 스키마와 handler 만 준다 —
// `readOnlyHint` 를 런타임에 뒤집을 표면이 없다.
//
// **찾기와 읽기를 나눈다** (사용자 결정 2026-08-04):
//   `confluence_search`    — pageId·제목·작성자만. 원격도 로컬도 바꾸지 않는다 → 자동 허용.
//   `confluence_get_pages` — 받은 pageId 들의 본문 Markdown + 첨부. 로컬에 쓴다 → 승인 카드.
//
// 검색이 본문까지 끌고 오던 r2 구조에서는 **모든 검색이 승인 대상**이었다. 나누면 탐색은
// 자유롭고 내려받기만 승인을 받는다 — MCP 의 `readOnlyHint` 정의("환경을 변경하지 않는다")에
// 도구 경계를 맞춘 결과다.

import { z } from 'zod'
import type {
  RuntimeToolImplementation,
  RuntimeToolResult,
  RuntimeToolServer
} from '../../../adapters/runtime-tools'
import { authToolServerId } from '../../../adapters/runtime-tool-policy'
import type { AuthenticatedRequest, AuthenticatedResponse } from '../../../contracts/auth'

// Plugin 이 자기 도구를 만들 때 필요한 것 전부 (0188). 구 `ProviderToolContext` 는 **Auth
// 계약 안**에 있었다 — 인증 코어가 "런타임 도구 서버" 라는 소비자 개념을 알아야 성립하는
// 구조였다. 이제 Plugin 이 자기 형상을 소유하고, 컴포지션 루트가 `BoundAuth` 에서 채운다.
export interface ConfluencePluginContext {
  // vault 네임스페이스이자 `${BINDING:<id>}` 참조 대상인 Auth 식별자. 도구 서버 이름의 원천.
  authId: string
  label: string
  origin: string
  // 인증된 요청. **raw credential 을 받지 않는다** — 헤더 주입은 Auth 안에서 끝난다.
  request(req: AuthenticatedRequest, signal?: AbortSignal): Promise<AuthenticatedResponse>
}
import {
  CONFLUENCE_OPERATIONS,
  createConfluenceRuntime,
  MAX_PAGES_PER_CALL,
  type ConfluenceContext,
  type ConfluenceResult,
  type ConfluenceRuntime
} from './connector'
import { MAX_SEARCH_LIMIT } from './rest'
import { renderPagesResult, renderSearchResult } from './search-render'

export const CONFLUENCE_TOOL_NAMES = {
  search: 'confluence_search',
  getPages: 'confluence_get_pages'
} as const

// 런타임이 준 `ConfluenceResult` 를 **반드시** MCP 결과로 옮긴다. 그대로 반환하면
// `content` 가 없어 모델에게 "성공, 결과 없음" 으로 보이고 connector 오류까지 성공으로
// 뒤집힌다(0158 verify r1 D5).
//
// 성공 본문은 **JSON 으로 감싸지 않는다** — Markdown 을 JSON 문자열에 넣으면 줄바꿈이 `\n`
// 두 글자로 새어 나온다(0164 r2 사용자 보고). 렌더러가 텍스트를 만든다.
function toToolResult(raw: unknown, render: (data: unknown) => string): RuntimeToolResult {
  const result = raw as ConfluenceResult | undefined
  if (result === null || typeof result !== 'object' || typeof result?.ok !== 'boolean') {
    return {
      content: [{ type: 'text', text: 'connector 가 예상치 못한 결과를 반환했습니다' }],
      isError: true
    }
  }
  if (!result.ok) {
    return { content: [{ type: 'text', text: result.message }], isError: true }
  }
  return { content: [{ type: 'text', text: render(result.data) }] }
}

// 0181 — 정적 descriptor 와 구현을 **한 번에** 만든다. 구 구조는 `RuntimeToolContribution`
// (descriptor + connection 별 factory)이었지만, 연결이 provider 하나에 1건이라 두 단계로 나눌
// 이유가 사라졌다. `readOnlyHint` 를 런타임에 뒤집을 표면이 없다는 성질은 그대로다.
//
// **id·label·origin 을 인자로 받지 않는다.** 배포가 그것들을 다시 적게 두면 `AuthId` 와
// 어긋날 수 있고, 그러면 도구는 모델에 보이는데 호출은 인증 대상을 못 찾아 죽는다. 전부
// `ctx` 에서 파생한다 — 배포가 채우는 것은 컨텍스트 경로(`apiBasePath`) 같은 실값뿐이다.
export interface ConfluenceToolOptions {
  // 컨텍스트 경로(`/confluence`). `origin` 에 붙이면 등록 검사가 그 선언을 거부하므로 여기다.
  apiBasePath?: string
  maxAttachmentBytes?: number
  downloadConcurrency?: number
}

// 컴포지션 루트가 부르는 표면 (`app/deployment/plugins.ts`). **한 번만** 부르고 결과를
// 재사용한다 — 매번 새로 만들면 handler identity 가 달라져 RuntimeToolRegistry revision 이
// 오르고 persistent runtime 이 불필요하게 respawn 한다(0188 D-023).
export function confluenceTools(
  ctx: ConfluencePluginContext,
  opts: ConfluenceToolOptions = {}
): RuntimeToolServer {
  return createConfluenceToolServer(
    ctx,
    createConfluenceRuntime({
      id: ctx.authId,
      label: ctx.label,
      baseUrl: ctx.origin,
      ...opts
    })
  )
}

// 런타임을 주입받는 하위 표면 — 도구 계층(descriptor·handler)만 검증할 때 쓴다.
export function createConfluenceToolServer(
  ctx: ConfluencePluginContext,
  runtime: ConfluenceRuntime
): RuntimeToolServer {
  const providerId = ctx.authId
  const connectorLabel = ctx.label
  // 서버 이름 규칙의 SSOT 는 `adapters/runtime-tool-policy.ts` 하나다 — Plugin 마다 조립하면
  // 서로 다른 문자열을 고를 수 있다.
  const serverId = authToolServerId(ctx.authId)
  const request: ConfluenceContext = {
    request: (req, signal) => ctx.request(req, signal),
    logger: () => undefined
  }
  const invoke = (operation: string, params?: Record<string, unknown>): Promise<ConfluenceResult> =>
    runtime.invoke(request, { operation, ...(params ? { params } : {}) })

  return {
    descriptor: {
      id: serverId,
      connectorId: providerId,
      tools: [
        {
          name: CONFLUENCE_TOOL_NAMES.search,
          description:
            `Search pages in ${connectorLabel} (Confluence Data Center) with CQL or plain text. ` +
            'Returns page ids, titles and authors only — no page body. ' +
            `Returns at most ${MAX_SEARCH_LIMIT} hits per call; when more exist the result gives ` +
            'the exact `start` offset to pass on the next call. ' +
            'Pass the page ids you want to read to confluence_get_pages.',
          // 원격도 로컬도 바꾸지 않는다 — 자동 허용되는 도구다.
          annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
        },
        {
          name: CONFLUENCE_TOOL_NAMES.getPages,
          description:
            `Read ${connectorLabel} pages by id: each page is converted to Markdown and its ` +
            'referenced image attachments are downloaded under the Orca downloads directory. ' +
            'Returns the Markdown body inline plus the saved file paths. ' +
            'Takes the page ids returned by confluence_search.',
          // 페이지 Markdown·첨부를 로컬에 쓴다 → 환경 변경 → 승인 대상.
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
        }
      ]
    },

    implementations: [
      {
        name: CONFLUENCE_TOOL_NAMES.search,
        inputSchema: {
          cql: z.string().optional().describe('Raw CQL. Overrides text/spaceKey when provided.'),
          text: z.string().optional().describe('Free text to match in page content.'),
          spaceKey: z.string().optional().describe('Restrict the search to one space key.'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(MAX_SEARCH_LIMIT)
            .optional()
            .describe(
              `How many hits to return, at most ${MAX_SEARCH_LIMIT}. The server may apply a ` +
                'lower limit; the result reports the one actually used.'
            ),
          start: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe(
              'Offset into the result set. Pass the `start` value the previous call reported ' +
                'as next; do not compute it yourself.'
            )
        },
        handler: async (input) =>
          toToolResult(await invoke(CONFLUENCE_OPERATIONS.search, input), renderSearchResult)
      },
      {
        name: CONFLUENCE_TOOL_NAMES.getPages,
        inputSchema: {
          pageIds: z
            .array(z.string().min(1))
            .min(1)
            // connector 가 실제로 강제하는 배치 상한과 같은 값이어야 한다 — 어긋나면 스키마가
            // 통과시킨 입력을 connector 가 `skippedPageIds` 로 잘라낸다.
            .max(MAX_PAGES_PER_CALL)
            .describe('Confluence page ids, as returned by confluence_search.'),
          includeAttachments: z
            .boolean()
            .optional()
            .describe('Download attachments referenced by the page bodies. Defaults to true.')
        },
        handler: async (input) =>
          toToolResult(await invoke(CONFLUENCE_OPERATIONS.pages, input), renderPagesResult)
      }
    ] satisfies readonly RuntimeToolImplementation[]
  }
}
