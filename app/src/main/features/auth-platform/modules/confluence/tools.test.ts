// Confluence runtime tool contribution (0160).
//
// 도구 handler 의 계약은 하나다: **`content` 가 있는 `RuntimeToolResult` 를 반환한다.**
// `ctx.invoke` 결과를 그대로 흘리면 MCP 경계에서 "성공, 결과 없음" 이 되어 connector 오류가
// 성공으로 뒤집힌다(0158 verify r1 D5).

import { describe, expect, it } from 'vitest'
import type { PluginToolContext } from '../../../../adapters/runtime-tools'
import { CONFLUENCE_TOOL_NAMES, confluenceToolServerId, createConfluenceTools } from './tools'
import { CONFLUENCE_OPERATIONS } from './connector'

function toolContext(invoke: PluginToolContext['invoke']): PluginToolContext {
  return {
    connectionId: 'conn-1',
    invoke,
    logger: () => undefined,
    signal: new AbortController().signal
  }
}

const contribution = createConfluenceTools('confluence-dc', 'Confluence')

describe('createConfluenceTools — descriptor', () => {
  it('정적 server ID 를 connector ID 에서 파생한다', () => {
    expect(contribution.descriptor.id).toBe(confluenceToolServerId('confluence-dc'))
    expect(contribution.descriptor.connectorId).toBe('confluence-dc')
  })

  it('도구 3종을 선언한다', () => {
    expect(contribution.descriptor.tools.map((t) => t.name)).toEqual([
      CONFLUENCE_TOOL_NAMES.search,
      CONFLUENCE_TOOL_NAMES.getPage,
      CONFLUENCE_TOOL_NAMES.downloadAttachments
    ])
  })

  it('검색만 readOnlyHint:true 이고 쓰기 도구는 false 다', () => {
    // MCP 의 readOnlyHint 는 "환경을 변경하지 않는다" 다. 로컬에 파일을 쓰면 false 가 정직하다.
    const byName = new Map(contribution.descriptor.tools.map((t) => [t.name, t]))
    expect(byName.get(CONFLUENCE_TOOL_NAMES.search)?.annotations?.readOnlyHint).toBe(true)
    expect(byName.get(CONFLUENCE_TOOL_NAMES.getPage)?.annotations?.readOnlyHint).toBe(false)
    expect(byName.get(CONFLUENCE_TOOL_NAMES.downloadAttachments)?.annotations?.readOnlyHint).toBe(
      false
    )
  })

  it('설명에 connector 라벨이 들어가 서버가 여러 개여도 구분된다', () => {
    const other = createConfluenceTools('confluence-lab', 'Confluence — 연구소')
    expect(other.descriptor.id).not.toBe(contribution.descriptor.id)
    expect(other.descriptor.tools[0].description).toContain('연구소')
  })
})

describe('createConfluenceTools — handler', () => {
  it('구현 이름 집합이 descriptor 와 일치한다', () => {
    const impls = contribution.create(toolContext(async () => ({ ok: true, data: null })))
    expect(impls.map((i) => i.name).sort()).toEqual(
      contribution.descriptor.tools.map((t) => t.name).sort()
    )
  })

  it('각 도구가 대응하는 connector operation 을 부른다', async () => {
    const calls: string[] = []
    const impls = contribution.create(
      toolContext(async (operation) => {
        calls.push(operation)
        return { ok: true, data: {} }
      })
    )
    for (const impl of impls) await impl.handler({})
    expect(calls).toEqual([
      CONFLUENCE_OPERATIONS.search,
      CONFLUENCE_OPERATIONS.page,
      CONFLUENCE_OPERATIONS.attachments
    ])
  })

  it('모든 handler 가 content 를 채운다', async () => {
    const impls = contribution.create(toolContext(async () => ({ ok: true, data: { a: 1 } })))
    for (const impl of impls) {
      const result = await impl.handler({})
      expect(result.content.length).toBeGreaterThan(0)
      expect(result.content[0].type).toBe('text')
      expect(result.isError).toBeUndefined()
    }
  })

  it('connector 실패를 isError 로 옮긴다', async () => {
    const impls = contribution.create(
      toolContext(async () => ({ ok: false, message: '연결이 끊겼습니다' }))
    )
    for (const impl of impls) {
      const result = await impl.handler({})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('연결이 끊겼습니다')
    }
  })

  it('예상치 못한 결과 형상도 isError 로 만든다', async () => {
    const impls = contribution.create(toolContext(async () => 'not a connector result'))
    const result = await impls[0].handler({})
    // 조용한 빈 성공을 만들지 않는 것이 요점이다.
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('예상치 못한')
  })

  it('연결이 끊긴 뒤의 invoke 예외는 잡지 않는다 — SDK 가 isError 로 변환한다', async () => {
    const impls = contribution.create(
      toolContext(async () => {
        throw new Error('connection is gone')
      })
    )
    await expect(impls[0].handler({})).rejects.toThrow('connection is gone')
  })

  it('입력을 그대로 connector 에 넘긴다', async () => {
    let received: unknown
    const impls = contribution.create(
      toolContext(async (_op, params) => {
        received = params
        return { ok: true, data: null }
      })
    )
    await impls[1].handler({ pageId: '123', includeAttachments: false })
    expect(received).toEqual({ pageId: '123', includeAttachments: false })
  })
})
