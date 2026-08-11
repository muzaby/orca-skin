// Confluence 런타임 도구 (0160 → 0181 복원).
//
// 도구 handler 의 계약은 하나다: **`content` 가 있는 `RuntimeToolResult` 를 반환한다.**
// 런타임 결과를 그대로 흘리면 MCP 경계에서 "성공, 결과 없음" 이 되어 오류가 성공으로
// 뒤집힌다(0158 verify r1 D5).

import { describe, expect, it } from 'vitest'
import type { ProviderToolContext } from '../../../../contracts/provider'
import { CONFLUENCE_TOOL_NAMES, confluenceToolServerId, createConfluenceToolServer } from './tools'
import { CONFLUENCE_OPERATIONS, type ConfluenceResult, type ConfluenceRuntime } from './connector'

// invoke 만 대체하는 최소 런타임 — 도구 계층이 런타임을 어떻게 부르는지에만 관심이 있다.
function server(
  invoke: (operation: string, params?: Record<string, unknown>) => Promise<ConfluenceResult>,
  providerId = 'confluence-dc',
  label = 'Confluence'
): ReturnType<typeof createConfluenceToolServer> {
  const runtime: ConfluenceRuntime = {
    start: async () => ({ health: 'ready' }),
    invoke: async (_ctx, request) => invoke(request.operation, request.params),
    stop: async () => undefined
  }
  const ctx: ProviderToolContext = {
    providerId,
    label,
    origin: 'https://wiki.example.corp',
    request: async () => ({
      ok: true,
      status: 200,
      finalUrl: 'https://wiki.example.corp/',
      headers: {},
      body: ''
    })
  }
  return createConfluenceToolServer(ctx, runtime)
}

const contribution = server(async () => ({ ok: true, data: null }))

describe('createConfluenceToolServer — descriptor', () => {
  it('정적 server ID 를 connector ID 에서 파생한다', () => {
    expect(contribution.descriptor.id).toBe(confluenceToolServerId('confluence-dc'))
    expect(contribution.descriptor.connectorId).toBe('confluence-dc')
  })

  it('찾기와 읽기 2종을 선언한다', () => {
    // 사용자 재지정 2026-08-04 — search 는 id·제목·작성자, getPages 가 본문+첨부.
    expect(contribution.descriptor.tools.map((t) => t.name)).toEqual([
      CONFLUENCE_TOOL_NAMES.search,
      CONFLUENCE_TOOL_NAMES.getPages
    ])
  })

  it('search 는 자동 허용, getPages 는 파일을 쓰므로 승인 대상이다', () => {
    // MCP 의 readOnlyHint 는 "환경을 변경하지 않는다" 다. 로컬에 파일을 쓰면 false 가 정직하다.
    const byName = new Map(contribution.descriptor.tools.map((t) => [t.name, t]))
    expect(byName.get(CONFLUENCE_TOOL_NAMES.search)?.annotations?.readOnlyHint).toBe(true)
    expect(byName.get(CONFLUENCE_TOOL_NAMES.getPages)?.annotations?.readOnlyHint).toBe(false)
  })

  it('설명에 라벨이 들어가 서버가 여러 개여도 구분된다', () => {
    const other = server(
      async () => ({ ok: true, data: null }),
      'confluence-lab',
      'Confluence — 연구소'
    )
    expect(other.descriptor.id).not.toBe(contribution.descriptor.id)
    expect(other.descriptor.tools[0].description).toContain('연구소')
  })
})

describe('createConfluenceToolServer — handler', () => {
  it('구현 이름 집합이 descriptor 와 일치한다', () => {
    const impls = server(async () => ({ ok: true, data: null })).implementations
    expect(impls.map((i) => i.name).sort()).toEqual(
      contribution.descriptor.tools.map((t) => t.name).sort()
    )
  })

  it('각 도구가 대응하는 connector operation 을 부른다', async () => {
    const calls: string[] = []
    const impls = server(async (operation) => {
      calls.push(operation)
      return { ok: true, data: {} }
    }).implementations
    for (const impl of impls) await impl.handler({})
    expect(calls).toEqual([CONFLUENCE_OPERATIONS.search, CONFLUENCE_OPERATIONS.pages])
  })

  it('모든 handler 가 content 를 채운다', async () => {
    const impls = server(async () => ({ ok: true, data: { hits: [], pages: [] } })).implementations
    for (const impl of impls) {
      const result = await impl.handler({})
      expect(result.content.length).toBeGreaterThan(0)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBeUndefined()
    }
  })

  it('getPages 의 본문을 JSON 으로 감싸지 않는다 — Markdown 줄바꿈이 살아 있어야 한다', async () => {
    // 회귀: 이전 구현은 `JSON.stringify(data)` 를 실어 본문 줄바꿈이 `\n` 두 글자로 새어 나왔다.
    const impls = server(async () => ({
      ok: true,
      data: {
        pages: [
          {
            pageId: '1',
            title: '센서 스펙',
            directory: '/d',
            markdownPath: '/d/page.md',
            markdownPreview: '| a | b |\n| --- | --- |\n| 1 | 2 |',
            previewTruncated: false,
            assets: [],
            failedAssets: [],
            unhandledMacros: []
          }
        ],
        failedPages: [],
        skippedPageIds: []
      }
    })).implementations
    const text = (await impls[1].handler({ pageIds: ['1'] })).content[0].text
    expect(text).toContain('| a | b |\n| --- | --- |')
    expect(text).not.toContain('\\n')
    expect(text).not.toContain('"markdownPreview"')
  })

  it('런타임 실패를 isError 로 옮긴다', async () => {
    const impls = server(async () => ({ ok: false, message: '연결이 끊겼습니다' })).implementations
    for (const impl of impls) {
      const result = await impl.handler({})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('연결이 끊겼습니다')
    }
  })

  it('예상치 못한 결과 형상도 isError 로 만든다', async () => {
    const impls = server(
      async () => 'not a runtime result' as unknown as ConfluenceResult
    ).implementations
    const result = await impls[0].handler({})
    // 조용한 빈 성공을 만들지 않는 것이 요점이다.
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('예상치 못한')
  })

  it('연결이 끊긴 뒤의 invoke 예외는 잡지 않는다 — SDK 가 isError 로 변환한다', async () => {
    const impls = server(async () => {
      throw new Error('connection is gone')
    }).implementations
    await expect(impls[0].handler({})).rejects.toThrow('connection is gone')
  })

  it('입력을 그대로 런타임에 넘긴다', async () => {
    let received: unknown
    const impls = server(async (_op, params) => {
      received = params
      return { ok: true, data: null }
    }).implementations
    await impls[0].handler({ text: '센서', spaceKey: 'QA', limit: 10, start: 20 })
    expect(received).toEqual({ text: '센서', spaceKey: 'QA', limit: 10, start: 20 })

    await impls[1].handler({ pageIds: ['1', '2'], includeAttachments: false })
    expect(received).toEqual({ pageIds: ['1', '2'], includeAttachments: false })
  })
})
