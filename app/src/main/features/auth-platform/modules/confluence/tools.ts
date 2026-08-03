// Confluence runtime tool contribution (0160) — 모델에게 노출되는 MCP 도구 3종.
//
// **정적 descriptor 가 승인 정책의 SSOT 다** (0158). factory 는 실행 스키마와 handler 만 준다 —
// `readOnlyHint` 를 런타임에 뒤집을 표면이 없다.
//
// `readOnlyHint` 를 정직하게 선언한다: MCP 정의는 "도구가 **환경을 변경하지 않는다**" 이지
// "원격을 변경하지 않는다" 가 아니다. 페이지·첨부를 로컬에 쓰는 두 도구는 환경을 바꾸므로
// `false` 이고 승인 카드를 거친다. 원격이 read-only 라는 요구는 write 계열 도구를 두지 않는
// 것으로 지킨다.

import { z } from 'zod'
import type {
  PluginToolContext,
  RuntimeToolContribution,
  RuntimeToolImplementation,
  RuntimeToolResult
} from '../../../../adapters/runtime-tools'
import type { ConnectorResult } from '../../../../contracts/connector-plugin'
import { CONFLUENCE_OPERATIONS, CONFLUENCE_PLUGIN_ID } from './connector'

export const CONFLUENCE_TOOL_NAMES = {
  search: 'confluence_search',
  getPage: 'confluence_get_page',
  downloadAttachments: 'confluence_download_attachments'
} as const

export function confluenceToolServerId(connectorId: string): string {
  return `${connectorId}-tools`
}

// `ctx.invoke` 가 준 `ConnectorResult` 를 **반드시** MCP 결과로 옮긴다. 그대로 반환하면
// `content` 가 없어 모델에게 "성공, 결과 없음" 으로 보이고 connector 오류까지 성공으로
// 뒤집힌다(0158 verify r1 D5).
function toToolResult(raw: unknown): RuntimeToolResult {
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
  return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] }
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
            `Search pages in ${connectorLabel} (Confluence Data Center) with CQL or plain text. ` +
            'Returns page ids and titles only — call confluence_get_page to read a page.',
          // 원격도 로컬도 바꾸지 않는다 — 유일하게 자동 허용되는 도구다.
          annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
        },
        {
          name: CONFLUENCE_TOOL_NAMES.getPage,
          description:
            `Download one ${connectorLabel} page as Markdown with its referenced attachments. ` +
            'Writes page.md, assets/ and manifest.json under the Orca downloads directory and ' +
            'returns those paths plus a truncated Markdown preview.',
          // 로컬 파일을 쓴다 → 환경 변경 → 승인 대상.
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
        },
        {
          name: CONFLUENCE_TOOL_NAMES.downloadAttachments,
          description:
            `Download attachments of one ${connectorLabel} page to the Orca downloads directory. ` +
            'Omit filenames to download every attachment of the page.',
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
          limit: z.number().int().min(1).max(100).optional()
        },
        handler: async (input) =>
          toToolResult(await ctx.invoke(CONFLUENCE_OPERATIONS.search, input))
      },
      {
        name: CONFLUENCE_TOOL_NAMES.getPage,
        inputSchema: {
          pageId: z
            .string()
            .min(1)
            .describe('Confluence page id, as returned by confluence_search.'),
          includeAttachments: z
            .boolean()
            .optional()
            .describe('Download attachments referenced by the page body. Defaults to true.')
        },
        handler: async (input) => toToolResult(await ctx.invoke(CONFLUENCE_OPERATIONS.page, input))
      },
      {
        name: CONFLUENCE_TOOL_NAMES.downloadAttachments,
        inputSchema: {
          pageId: z.string().min(1),
          filenames: z
            .array(z.string().min(1))
            .optional()
            .describe('Attachment file names to download. Omit for all attachments.')
        },
        handler: async (input) =>
          toToolResult(await ctx.invoke(CONFLUENCE_OPERATIONS.attachments, input))
      }
    ]
  }
}
