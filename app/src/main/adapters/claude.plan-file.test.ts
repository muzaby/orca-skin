// 0249 VP-11′ — production 어댑터의 hooks와 canUseTool을 포획해 같은 셀의 배선을 확인한다.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { CanUseTool, HookCallback, Options } from '@anthropic-ai/claude-agent-sdk'

const { captured, queryMock, messages } = vi.hoisted(() => {
  const captured: { options?: unknown } = {}
  const messages: unknown[] = []
  return {
    captured,
    messages,
    queryMock: vi.fn((args: { options: unknown }) => {
      captured.options = args.options
      return {
        async *[Symbol.asyncIterator]() {
          for (const message of messages) yield message
        },
        setPermissionMode: vi.fn(),
        interrupt: vi.fn(),
        setModel: vi.fn(),
        close: vi.fn()
      }
    })
  }
})
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }))

import { ClaudeAdapter } from './claude'
import type { ApprovalResolution, PermissionAction } from '../../shared/ipc'
import type { LiveTurn } from './types'

const roots: string[] = []
const lives: LiveTurn[] = []
afterEach(async () => {
  for (const live of lives.splice(0)) live.close()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function setup(
  narrative?: string,
  settingsEnv = false
): Promise<{
  root: string
  plans: string
  actions: PermissionAction[]
  approve: CanUseTool
  hook: (event: 'PostToolUse' | 'Stop', value?: Record<string, unknown>) => Promise<void>
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-claude-plan-'))
  roots.push(root)
  const plans = path.join(root, 'plans')
  await mkdir(plans)
  messages.length = 0
  if (narrative)
    messages.push({ type: 'assistant', message: { content: [{ type: 'text', text: narrative }] } })
  const actions: PermissionAction[] = []
  const requestApproval = async (action: PermissionAction): Promise<ApprovalResolution> => {
    actions.push(action)
    return { behavior: 'allow' }
  }
  const live = new ClaudeAdapter().sendMessage({
    sessionId: 'plan-session',
    text: 'write plan',
    cwd: root,
    extensions: { skills: [], hooks: { normalized: {} } },
    ...(settingsEnv
      ? {
          providerSettings: {
            providerKey: 'claude-fixture',
            provider: 'fixture',
            sourceRevision: 'fixture-v1',
            settings: { env: { CLAUDE_CONFIG_DIR: root } }
          }
        }
      : { env: { CLAUDE_CONFIG_DIR: root } }),
    requestApproval
  })
  lives.push(live)
  for await (const batch of live.eventBatches) void batch
  const options = captured.options as Options
  expect(options.canUseTool).toBeTypeOf('function')
  return {
    root,
    plans,
    actions,
    approve: options.canUseTool!,
    hook: async (event, value = {}) => {
      for (const matcher of options.hooks?.[event] ?? []) {
        if (
          event === 'PostToolUse' &&
          matcher.matcher &&
          !new RegExp(matcher.matcher).test(String(value.tool_name))
        )
          continue
        for (const callback of matcher.hooks as HookCallback[]) {
          await callback({ hook_event_name: event, ...value } as never, undefined, {
            signal: new AbortController().signal
          })
        }
      }
    }
  }
}
function planOf(actions: PermissionAction[]): string {
  const action = actions.at(-1)!
  if (action.kind !== 'plan_review') throw new Error('not a plan review')
  expect(action.request).not.toHaveProperty('planFilePath')
  return action.request.plan
}
async function approve(
  approveTool: CanUseTool,
  input: Record<string, unknown>
): ReturnType<CanUseTool> {
  return approveTool('ExitPlanMode', input, { signal: new AbortController().signal } as never)
}

describe('0249 VP-11′·VP-10 — 어댑터 파일 출처 배선과 수명', () => {
  it('AC14′ — Write 훅의 파일 본문·경로가 요청과 CLI allow에 도착하고 Stop 뒤에는 비운다', async () => {
    const fixture = await setup('서술 계획')
    const file = path.join(fixture.plans, 'written.md')
    await writeFile(file, '# 디스크의 계획')
    await fixture.hook('PostToolUse', {
      tool_name: 'Write',
      tool_input: { file_path: file },
      tool_response: {}
    })
    const result = await approve(fixture.approve, {})
    expect(planOf(fixture.actions)).toBe('# 디스크의 계획')
    expect(result).toMatchObject({
      behavior: 'allow',
      updatedInput: { plan: '# 디스크의 계획', planFilePath: file }
    })
    await fixture.hook('Stop')
    const input = {}
    const afterStop = await approve(fixture.approve, input)
    expect(planOf(fixture.actions)).toBe('서술 계획')
    expect(afterStop?.behavior).toBe('allow')
    if (afterStop?.behavior !== 'allow') throw new Error('expected allow')
    expect(afterStop.updatedInput).toBe(input)
  })

  it('Write a→Edit b→서브에이전트 c→Exit에서 마지막 메인 b만 읽는다', async () => {
    const fixture = await setup()
    for (const [name, toolName, agentId] of [
      ['a', 'Write', undefined],
      ['b', 'Edit', undefined],
      ['c', 'Write', 'child']
    ] as const) {
      const file = path.join(fixture.plans, `${name}.md`)
      await writeFile(file, `# ${name}`)
      await fixture.hook('PostToolUse', {
        tool_name: toolName,
        tool_input: { file_path: file },
        tool_response: {},
        ...(agentId ? { agent_id: agentId } : {})
      })
    }
    const result = await approve(fixture.approve, {
      plan: '옛 입력',
      planFilePath: path.join(fixture.plans, 'a.md')
    })
    expect(planOf(fixture.actions)).toBe('# b')
    expect(result).toMatchObject({
      updatedInput: { plan: '# b', planFilePath: path.join(fixture.plans, 'b.md') }
    })
    await fixture.hook('Stop')
    await approve(fixture.approve, {})
    expect(planOf(fixture.actions)).toBe('')
  })

  it('입력이 차 있어도 파일을 다시 읽어 CLI 캐시의 낡은 값을 보정한다', async () => {
    const fixture = await setup()
    const file = path.join(fixture.plans, 'cached.md')
    await writeFile(file, '# 쓰기 전')
    await fixture.hook('PostToolUse', {
      tool_name: 'Write',
      tool_input: { file_path: file },
      tool_response: {}
    })
    await writeFile(file, '# 쓰기 후')
    const result = await approve(fixture.approve, {
      plan: '# 쓰기 전',
      planFilePath: file,
      extra: 'keep'
    })
    expect(planOf(fixture.actions)).toBe('# 쓰기 후')
    expect(result).toMatchObject({
      updatedInput: { plan: '# 쓰기 후', planFilePath: file, extra: 'keep' }
    })
  })

  it('추적 없이 settings CLAUDE_CONFIG_DIR의 선언 경로도 읽는다', async () => {
    const fixture = await setup(undefined, true)
    const file = path.join(fixture.plans, 'declared.md')
    await writeFile(file, '# 선언 계획')
    const result = await approve(fixture.approve, { plan: '틀린 본문', planFilePath: file })
    expect(planOf(fixture.actions)).toBe('# 선언 계획')
    expect(result).toMatchObject({ updatedInput: { plan: '# 선언 계획', planFilePath: file } })
  })

  it('정상 입력은 production allow에서도 본문과 참조를 보존한다', async () => {
    const fixture = await setup()
    const file = path.join(fixture.plans, 'normal.md')
    await writeFile(file, '# 정상\n계획')
    await fixture.hook('PostToolUse', {
      tool_name: 'Write',
      tool_input: { file_path: file },
      tool_response: {}
    })
    const input = { plan: '\uFEFF# 정상\r\n계획\r\n ', planFilePath: file }
    const result = await approve(fixture.approve, input)
    expect(planOf(fixture.actions)).toBe(input.plan)
    expect(result?.behavior).toBe('allow')
    if (result?.behavior !== 'allow') throw new Error('expected allow')
    expect(result.updatedInput).toBe(input)
  })

  it('세션마다 셀을 격리하고 실패·밖 경로·비md·서브에이전트 쓰기는 제외한다', async () => {
    const first = await setup()
    const file = path.join(first.plans, 'first.md')
    await writeFile(file, '# 첫 세션')
    await first.hook('PostToolUse', {
      tool_name: 'Write',
      tool_input: { file_path: file },
      tool_response: {}
    })
    const second = await setup('둘째 서술')
    for (const [name, extra] of [
      ['failed.md', { tool_response: { isError: true } }],
      ['child.md', { agent_id: 'child', tool_response: {} }],
      ['other.txt', { tool_response: {} }]
    ] as const) {
      const ignored = path.join(second.plans, name)
      await writeFile(ignored, '# 무시')
      await second.hook('PostToolUse', {
        tool_name: 'Write',
        tool_input: { file_path: ignored },
        ...extra
      })
    }
    await second.hook('PostToolUse', {
      tool_name: 'Write',
      tool_input: { file_path: file },
      tool_response: {}
    })
    await approve(second.approve, {})
    expect(planOf(second.actions)).toBe('둘째 서술')
    await approve(first.approve, {})
    expect(planOf(first.actions)).toBe('# 첫 세션')
  })
})
