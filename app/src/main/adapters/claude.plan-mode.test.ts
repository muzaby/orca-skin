import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { HookCallback, Options, PermissionResult } from '@anthropic-ai/claude-agent-sdk'

const fixture = vi.hoisted(() => ({
  options: undefined as unknown,
  steps: [] as (() => Promise<unknown>)[]
}))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(({ options }) => {
    fixture.options = options
    return {
      async *[Symbol.asyncIterator]() {
        for (const step of fixture.steps) {
          const message = await step()
          if (message) yield message
        }
      },
      close: vi.fn(),
      interrupt: vi.fn(),
      setPermissionMode: vi.fn(),
      setModel: vi.fn()
    }
  })
}))
import { ClaudeAdapter, makeCanUseTool } from './claude'
import type { ApprovalResolution, NormalizedEvent, PermissionAction } from '../../shared/ipc'
import { NORMALIZED_MODES, toClaudePermissionMode } from '../../shared/permission-mode'

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
  fixture.steps.length = 0
})
const options = (): Options => fixture.options as Options
const signal = (): AbortSignal => new AbortController().signal
function call(
  id: string,
  input: Record<string, unknown>,
  agentID?: string
): Promise<PermissionResult | null> {
  return options().canUseTool!('ExitPlanMode', input, {
    signal: signal(),
    requestId: `request-${id}`,
    toolUseID: id,
    ...(agentID ? { agentID } : {})
  } as never)
}
async function hook(
  event: 'PostToolUse' | 'Stop',
  value: Record<string, unknown> = {}
): Promise<void> {
  for (const matcher of options().hooks?.[event] ?? []) {
    if (matcher.matcher && !new RegExp(matcher.matcher).test(String(value.tool_name))) continue
    for (const callback of matcher.hooks as HookCallback[])
      await callback({ hook_event_name: event, ...value } as never, undefined, { signal: signal() })
  }
}
const assistant = (
  id: string,
  name: string,
  input: unknown,
  child = false
): Record<string, unknown> => ({
  type: 'assistant',
  session_id: 's',
  uuid: `message-${id}`,
  ...(child ? { parent_tool_use_id: 'agent-call' } : {}),
  message: { content: [{ type: 'tool_use', id, name, input }] }
})
async function setup(resolution: ApprovalResolution = { behavior: 'allow' }): Promise<{
  plans: string
  actions: PermissionAction[]
  modes: unknown[][]
  events: NormalizedEvent[]
  consume: () => Promise<void>
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-plan-mode-'))
  roots.push(root)
  const plans = path.join(root, 'plans')
  await mkdir(plans)
  const actions: PermissionAction[] = []
  const modes: unknown[][] = []
  const live = new ClaudeAdapter().sendMessage({
    sessionId: 's',
    text: 'plan',
    cwd: root,
    env: { CLAUDE_CONFIG_DIR: root },
    extensions: { skills: [], hooks: { normalized: {} } },
    requestApproval: async (action) => {
      actions.push(action)
      return resolution
    },
    onPermissionModeChanged: (sid, mode) => modes.push([sid, mode])
  })
  const events: NormalizedEvent[] = []
  return {
    plans,
    actions,
    modes,
    events,
    consume: async () => {
      try {
        for await (const batch of live.eventBatches) events.push(...batch.events)
      } finally {
        live.close()
      }
    }
  }
}

describe('0249 plan mode callback and handler paths', () => {
  it('started reads available data; the approval callback re-reads the later authoritative file', async () => {
    const f = await setup()
    const file = path.join(f.plans, 'current.md')
    const raw = { allowedPrompts: [{ tool: 'Bash', prompt: '빌드한다' }] }
    let result: PermissionResult | null | undefined
    fixture.steps.push(
      async () => {
        await writeFile(file, '# Before')
        await hook('PostToolUse', {
          tool_name: 'Write',
          tool_input: { file_path: file },
          tool_response: {}
        })
        return assistant('exit', 'ExitPlanMode', raw)
      },
      async () => {
        expect(f.events.find((e) => e.type === 'tool.call.started')).toMatchObject({
          args: { ...raw, plan: '# Before', planFilePath: file }
        })
        await writeFile(file, '# At approval')
        result = await call('exit', raw)
      }
    )
    await f.consume()
    expect(f.actions[0]).toMatchObject({
      kind: 'plan_review',
      request: { plan: '# At approval' },
      input: { ...raw, plan: '# At approval', planFilePath: file },
      providerRequest: { toolUseId: 'exit' }
    })
    expect(result).toMatchObject({ updatedInput: f.actions[0].input })
    expect(raw).not.toHaveProperty('plan')
  })
  it('callback before started preserves identity and duplicate request promise; Stop resets new calls', async () => {
    const f = await setup()
    const file = path.join(f.plans, 'reviewed.md')
    const raw = { allowedPrompts: [] }
    fixture.steps.push(
      async () => {
        await writeFile(file, '# Reviewed')
        await hook('PostToolUse', {
          tool_name: 'Write',
          tool_input: { file_path: file },
          tool_response: {}
        })
        const first = call('old', raw)
        const duplicate = call('old', raw)
        expect(first).toBe(duplicate)
        await first
        await hook('Stop')
        return assistant('old', 'ExitPlanMode', raw)
      },
      async () => {
        await call('new', raw)
        return assistant('new', 'ExitPlanMode', raw)
      }
    )
    await f.consume()
    expect(f.actions).toHaveLength(2)
    expect(f.actions[0].input).toEqual({ ...raw, plan: '# Reviewed', planFilePath: file })
    expect(f.actions[1].input).toBe(raw)
    expect(f.actions[1]).toMatchObject({ request: { plan: '' } })
  })
  it.each([{ behavior: 'deny' }, { behavior: 'deny', message: '수정' }] as const)(
    'retains reviewed canonical input for deny/revise %j',
    async (resolution) => {
      const f = await setup(resolution)
      const file = path.join(f.plans, 'denied.md')
      let result: PermissionResult | null | undefined
      fixture.steps.push(async () => {
        await writeFile(file, '# Reviewed')
        result = await call('denied', { planFilePath: file, extra: true })
      })
      await f.consume()
      expect(f.actions[0].input).toEqual({ planFilePath: file, plan: '# Reviewed', extra: true })
      expect(result).toMatchObject({ behavior: 'deny' })
      expect(result).not.toHaveProperty('updatedPermissions')
    }
  )
  it('child input and Enter/result contracts remain independent of the main plan file', async () => {
    const f = await setup()
    const file = path.join(f.plans, 'main.md')
    const childInput = { allowedPrompts: [] }
    const enterInput = {}
    fixture.steps.push(
      async () => {
        await writeFile(file, '# Main only')
        await hook('PostToolUse', {
          tool_name: 'Write',
          tool_input: { file_path: file },
          tool_response: {}
        })
        const childResult = await call('child', childInput, 'child')
        expect(childResult).toMatchObject({ updatedInput: childInput })
        expect(childResult).not.toHaveProperty('updatedPermissions')
        expect(
          await options().canUseTool!('EnterPlanMode', enterInput, { signal: signal() } as never)
        ).toMatchObject({ behavior: 'allow', updatedInput: enterInput })
        return assistant('child', 'ExitPlanMode', childInput, true)
      },
      async () => assistant('enter', 'EnterPlanMode', enterInput),
      async () => ({
        type: 'user',
        session_id: 's',
        uuid: 'enter-result',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'enter', content: 'Entered plan mode' }]
        },
        tool_use_result: { message: 'Entered plan mode' }
      }),
      async () => assistant('exit-main', 'ExitPlanMode', {}),
      async () => ({
        type: 'user',
        session_id: 's',
        uuid: 'exit-result',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'exit-main', content: '# Main only' }]
        },
        tool_use_result: { plan: '# Main only', filePath: file, planWasEdited: false }
      })
    )
    await f.consume()
    expect(f.actions[0]).toMatchObject({ request: { plan: '' }, input: childInput })
    expect(f.actions[0].input).toBe(childInput)
    expect(
      f.events.find((e) => e.type === 'tool.call.started' && e.toolRunId === 'child')
    ).toMatchObject({ args: childInput, parentToolRunId: 'agent-call' })
    expect(
      f.events.find((e) => e.type === 'tool.call.started' && e.toolRunId === 'enter')
    ).toMatchObject({ args: {} })
    expect(
      f.events.find((e) => e.type === 'tool.call.completed' && e.toolRunId === 'enter')
    ).toMatchObject({ structuredOutput: { message: 'Entered plan mode' } })
    expect(
      f.events.find((e) => e.type === 'tool.call.completed' && e.toolRunId === 'exit-main')
    ).toMatchObject({ structuredOutput: { plan: '# Main only', filePath: file } })
  })
  it('child callback never asks for main files or narrative even without provider request metadata', async () => {
    const getPlanFiles = vi.fn()
    const getPlanNarrative = vi.fn()
    const request = vi.fn().mockResolvedValue({ behavior: 'allow' })
    const input = { plan: '# Child own' }
    const canUse = makeCanUseTool(request, { getPlanFiles, getPlanNarrative })
    const result = await canUse('ExitPlanMode', input, {
      signal: signal(),
      agentID: 'child'
    } as never)
    expect(result).toMatchObject({ updatedInput: input })
    expect(getPlanFiles).not.toHaveBeenCalled()
    expect(getPlanNarrative).not.toHaveBeenCalled()
    expect(request.mock.calls[0][0].request.plan).toBe('# Child own')
  })
  it('only actual main live init/status mode reports reach the observer', async () => {
    const f = await setup()
    fixture.steps.push(async () => ({
      type: 'system',
      subtype: 'init',
      session_id: 's',
      permissionMode: 'plan'
    }))
    for (const mode of NORMALIZED_MODES)
      fixture.steps.push(async () => ({
        type: 'system',
        subtype: 'status',
        session_id: 's',
        status: null,
        permissionMode: toClaudePermissionMode(mode)
      }))
    for (const overrides of [
      { permissionMode: 'unknown' },
      {},
      { permissionMode: 'plan', isReplay: true },
      { permissionMode: 'plan', parent_tool_use_id: 'child' },
      { permissionMode: 'plan', agent_id: 'child' },
      { permissionMode: 'plan', session_id: '' },
      { permissionMode: 'plan', subtype: 'permission_mode_changed' }
    ])
      fixture.steps.push(async () => ({
        type: 'system',
        subtype: 'status',
        session_id: 's',
        ...overrides
      }))
    await f.consume()
    expect(f.modes).toEqual([['s', 'plan'], ...NORMALIZED_MODES.map((mode) => ['s', mode])])
    expect(f.events.filter((e) => e.type === 'session.updated')).toHaveLength(1)
  })
})
