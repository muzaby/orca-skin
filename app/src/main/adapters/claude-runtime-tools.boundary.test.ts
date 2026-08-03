import { describe, expect, it } from 'vitest'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { adaptRuntimeTools } from './claude-runtime-tools'
import type { RuntimeToolResult, RuntimeToolSnapshot } from './runtime-tools'

// 형제 파일 `claude-runtime-tools.test.ts` 는 createSdkMcpServer 를 mock 해 **옵션 조립**만 본다.
// 여기서는 mock 없이 실제 SDK 서버 인스턴스를 in-memory transport 로 물려 **경계 통과 후의
// 실제 응답**을 고정한다 — 그 구분이 없어서 0158 verify r1 D5(취소가 빈 성공이 되는 결함)가
// 두 라운드를 통과했다.
// 이 파일의 다른 테스트는 **옵션 조립**만 본다. 그래서 handler 반환값이 SDK 경계를 지난 뒤
// 어떻게 보이는지는 어느 테스트도 보지 않았고, 취소가 `isError` 없는 빈 성공이 되는 결함이
// 통과했다. `createSdkMcpServer` 는 실제 `McpServer` 인스턴스를 주므로 CLI 서브프로세스 없이
// in-memory transport 로 왕복시켜 그 지점을 고정한다.
describe('runtime tool 결과가 실제 MCP 경계를 지난 뒤', () => {
  async function callTool(
    handler: () => Promise<RuntimeToolResult>
  ): Promise<{ content: unknown[]; isError?: boolean }> {
    const snapshot: RuntimeToolSnapshot = {
      revision: 1,
      servers: new Map([
        [
          'records',
          {
            descriptor: {
              id: 'records',
              pluginId: 'plugin-a',
              connectorId: 'connector-a',
              apiVersion: 1,
              tools: [{ name: 'read', description: 'Read' }]
            },
            implementations: [{ name: 'read', inputSchema: {}, handler }]
          }
        ]
      ])
    }
    const adapted = adaptRuntimeTools(snapshot) as {
      mcpServers: Record<string, { instance: { connect(t: unknown): Promise<void> } }>
    }
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await adapted.mcpServers.records.instance.connect(serverTransport)
    const client = new Client({ name: 'test', version: '1.0.0' })
    await client.connect(clientTransport)
    try {
      return (await client.callTool({ name: 'read', arguments: {} })) as {
        content: unknown[]
        isError?: boolean
      }
    } finally {
      await client.close()
    }
  }

  it('정상 결과는 content 를 그대로 싣고 isError 를 세우지 않는다', async () => {
    const res = await callTool(async () => ({ content: [{ type: 'text', text: 'ORCA-1' }] }))

    expect(res.content).toEqual([{ type: 'text', text: 'ORCA-1' }])
    expect(res.isError).toBeFalsy()
  })

  it('플러그인이 isError 를 세우면 그대로 실패로 전달한다', async () => {
    const res = await callTool(async () => ({
      content: [{ type: 'text', text: 'not found' }],
      isError: true
    }))

    expect(res.isError).toBe(true)
  })

  it('handler 가 던지면 빈 성공이 아니라 isError 로 도착한다 (취소·연결 소실 경로)', async () => {
    const res = await callTool(async () => {
      throw new Error('connector connection is closed: connector-a')
    })

    expect(res.isError).toBe(true)
    expect(JSON.stringify(res.content)).toMatch(/connection is closed/i)
  })

  it('MCP 형상이 아닌 반환값은 조용한 빈 성공이 아니라 도구 실패가 된다', async () => {
    // 수정 전 이 입력은 {"content":[],"ok":true,...} 로 도착해 모델에게 "성공, 결과 없음" 이었다.
    const res = await callTool(async () => ({ ok: true, data: { issue: 'ORCA-1' } }) as never)

    expect(res.isError).toBe(true)
    expect(JSON.stringify(res.content)).toMatch(/non-MCP result/i)
    expect(res.content).not.toEqual([])
  })
})
