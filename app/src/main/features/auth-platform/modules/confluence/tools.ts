// Confluence runtime tool contribution (0160, 0164 r2 로 도구 1종) — 모델에게 노출되는 표면.
//
// **정적 descriptor 가 승인 정책의 SSOT 다** (0158). factory 는 실행 스키마와 handler 만 준다 —
// `readOnlyHint` 를 런타임에 뒤집을 표면이 없다.
//
// **도구는 `confluence_search` 하나다** (사용자 결정 2026-08-04 — "mcp 도구는 search 만 노출해야
// 함(get page 안됨) / search 후 pageids 추출하여 마크다운 변환 및 이미지 첨부 다운로드할 것").
// 검색이 페이지 id 만 돌려주면 그 id 로 본문에 닿을 도구가 없으므로, 검색 한 번이 변환·다운로드
// 까지 끝낸다.
//
// 그래서 이 도구는 **로컬에 파일을 쓴다** → MCP 정의상 "환경을 변경한다" → `readOnlyHint: false`
// 이고 승인 카드를 거친다. 원격이 read-only 라는 요구는 write 계열 도구를 두지 않는 것으로 지킨다.

import { z } from 'zod'
import type {
  PluginToolContext,
  RuntimeToolContribution,
  RuntimeToolImplementation,
  RuntimeToolResult
} from '../../../../adapters/runtime-tools'
import type { ConnectorResult } from '../../../../contracts/connector-plugin'
import { CONFLUENCE_OPERATIONS, CONFLUENCE_PLUGIN_ID } from './connector'
import { renderSearchResult } from './search-render'

export const CONFLUENCE_TOOL_NAMES = {
  search: 'confluence_search'
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
      pluginId: CONFLUENCE_PLUGIN_ID,
      connectorId,
      apiVersion: 1,
      tools: [
        {
          name: CONFLUENCE_TOOL_NAMES.search,
          description:
            `Search pages in ${connectorLabel} (Confluence Data Center) with CQL or plain text, ` +
            'then read the top matches: each matched page is converted to Markdown and its ' +
            'referenced image attachments are downloaded under the Orca downloads directory. ' +
            'Returns the Markdown body inline plus the saved file paths.',
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
            .max(100)
            .optional()
            .describe('How many search hits to list. Defaults to 25.'),
          maxPages: z
            .number()
            .int()
            .min(1)
            .max(10)
            .optional()
            .describe(
              'How many of the hits to convert to Markdown and download attachments for. ' +
                'Defaults to 5, capped at 10.'
            )
        },
        handler: async (input) =>
          toToolResult(await ctx.invoke(CONFLUENCE_OPERATIONS.search, input), renderSearchResult)
      }
    ]
  }
}
