// 0215 VP-03 (AR-01 ↔ IT · §10 EP-01) — **배선**을 본다.
//
// `makeCanUseTool` 단위 테스트는 provider 를 자기가 주입하므로 `claude.ts` 가 그것을 실제로
// 넘기는지는 보지 못한다 — 인자를 지워도 단위는 전건 통과한다(0198 r5 와 같은 자리). 그래서
// 여기서는 production 어댑터가 만든 `options.canUseTool` 을 붙잡아, **매퍼가 쓴 같은 ctx** 를
// 읽어 계획 본문을 채우는지 확인한다.
import { describe, it, expect, vi } from 'vitest'

const { queryMock, messages, captured } = vi.hoisted(() => {
  const messages: unknown[] = []
  const captured: { canUseTool?: unknown } = {}
  return {
    messages,
    captured,
    queryMock: vi.fn((args: { options?: { canUseTool?: unknown } }) => {
      captured.canUseTool = args.options?.canUseTool
      return {
        async *[Symbol.asyncIterator]() {
          for (const msg of messages) yield msg
        },
        setPermissionMode: vi.fn(),
        interrupt: vi.fn(),
        setModel: vi.fn()
      }
    })
  }
})

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }))

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'
import type { ApprovalResolution, PermissionAction } from '../../shared/ipc'

type CanUseTool = (
  toolName: string,
  input: unknown,
  options: { signal?: AbortSignal }
) => Promise<{ behavior: string }>

async function drive(narrative: string | null): Promise<PermissionAction[]> {
  messages.length = 0
  if (narrative !== null) {
    messages.push({ type: 'assistant', message: { content: [{ type: 'text', text: narrative }] } })
  }
  const seen: PermissionAction[] = []
  const requestApproval = async (action: PermissionAction): Promise<ApprovalResolution> => {
    seen.push(action)
    return { behavior: 'allow' }
  }
  const req: TurnRequest = {
    sessionId: 's1',
    text: 'hello',
    cwd: '/tmp',
    extensions: { mcp: {}, skills: [], hooks: { normalized: {} } },
    requestApproval
  }
  const live = new ClaudeAdapter().sendMessage(req)
  // 스트림을 끝까지 소비해야 매퍼가 assistant 텍스트를 ctx 에 남긴다.
  for await (const _batch of live.eventBatches) void _batch
  const canUseTool = captured.canUseTool as CanUseTool
  await canUseTool('ExitPlanMode', {}, {})
  return seen
}

describe('ClaudeAdapter — 계획 서술 배선 (AT-01 · VP-03)', () => {
  it('매퍼가 담은 이번 턴 서술이 계획 본문이 된다', async () => {
    const seen = await drive('## 계획\n1. 파서를 고친다')
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      kind: 'plan_review',
      request: { plan: '## 계획\n1. 파서를 고친다' }
    })
  })

  it('서술이 없으면 빈 본문이다 — 양성 짝이 우연히 통과하지 않는다', async () => {
    const seen = await drive(null)
    expect(seen[0]).toMatchObject({ kind: 'plan_review', request: { plan: '' } })
  })
})
