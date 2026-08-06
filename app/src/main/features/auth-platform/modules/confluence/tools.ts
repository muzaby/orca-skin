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
  PluginToolContext,
  RuntimeToolContribution,
  RuntimeToolImplementation,
  RuntimeToolResult
} from '../../../../adapters/runtime-tools'
import type { ConnectorResult } from '../../../../contracts/connector'
import { CONFLUENCE_OPERATIONS, MAX_PAGES_PER_CALL } from './connector'
import { MAX_SEARCH_LIMIT } from './rest'
import { renderPagesResult, renderSearchResult } from './search-render'

export const CONFLUENCE_TOOL_NAMES = {
  search: 'confluence_search',
  getPages: 'confluence_get_pages'
} as const

export function confluenceToolServerId(connectorId: string): string {
  return `${connectorId}-tools`
}

// `ctx.invoke` 가 준 `ConnectorResult` 를 **반드시** MCP 결과로 옮긴다. 그대로 반환하면
// `content` 가 없어 모델에게 "성공, 결과 없음" 으로 보이고 connector 오류까지 성공으로
// 뒤집힌다(0158 verify r1 D5).
//
// 성공 본문은 **JSON 으로 감싸지 않는다** — Markdown 을 JSON 문자열에 넣으면 줄바꿈이 `\n`
// 두 글자로 새어 나온다(0164 r2 사용자 보고). 렌더러가 텍스트를 만든다.
function toToolResult(raw: unknown, render: (data: unknown) => string): RuntimeToolResult {
  const result = raw as ConnectorResult | undefined
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

export function createConfluenceTools(
  connectorId: string,
  connectorLabel: string
): RuntimeToolContribution {
  const serverId = confluenceToolServerId(connectorId)

  return {
    descriptor: {
      id: serverId,
      connectorId,
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

    create: (ctx: PluginToolContext): readonly RuntimeToolImplementation[] => [
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
          toToolResult(await ctx.invoke(CONFLUENCE_OPERATIONS.search, input), renderSearchResult)
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
          toToolResult(await ctx.invoke(CONFLUENCE_OPERATIONS.pages, input), renderPagesResult)
      }
    ]
  }
}
