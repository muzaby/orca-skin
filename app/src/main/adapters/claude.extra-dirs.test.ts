// D-006 — `extraDirs` 는 SDK 옵션 `additionalDirectories` 와 workspace 가드 훅에 **같은 배열**로
// 도달해야 한다. 두 스코프가 갈라지면 가드가 무의미해진다(옵션은 넓은데 가드는 좁거나 그 반대).
//
// **값 비교로는 이 계약이 안 잡힌다.** 두 곳이 각자 `[...extraDirs]` 로 복사해도 값은 같으므로,
// 여기서는 참조 동일성(`toBe`)을 단언한다.

import { describe, it, expect, vi } from 'vitest'

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn((req: unknown) => {
    void req
    const iterable = {
      [Symbol.asyncIterator](): AsyncIterator<never> {
        return { next: async () => ({ done: true, value: undefined as never }) }
      }
    } as AsyncIterable<never> & {
      setPermissionMode: () => void
      interrupt: () => void
      setModel: () => void
    }
    iterable.setPermissionMode = vi.fn()
    iterable.interrupt = vi.fn()
    iterable.setModel = vi.fn()
    return iterable
  })
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }))

// 실제 구현을 그대로 쓰되 인자만 들여다본다 — 훅 동작을 가짜로 바꾸면 배선이 아니라
// 가짜를 단언하게 된다.
vi.mock('./workspace-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./workspace-guard')>()
  return { ...actual, makeWorkspaceGuardHook: vi.fn(actual.makeWorkspaceGuardHook) }
})

import { ClaudeAdapter } from './claude'
import { makeWorkspaceGuardHook } from './workspace-guard'
import type { TurnRequest } from './turn'
import type { RuntimeToolContext } from './runtime-tools'

const guardHookMock = vi.mocked(makeWorkspaceGuardHook)

const baseReq = (): TurnRequest => ({
  sessionId: null,
  text: 'hello',
  cwd: '/tmp/work',
  extensions: { skills: [], hooks: { normalized: {} } }
})

function capture(req: TurnRequest): { option: unknown; guardArg: unknown } {
  queryMock.mockClear()
  guardHookMock.mockClear()
  new ClaudeAdapter().sendMessage(req)
  const call = queryMock.mock.calls[0]?.[0] as
    { options: { additionalDirectories?: string[] } } | undefined
  return { option: call?.options.additionalDirectories, guardArg: guardHookMock.mock.calls[0]?.[1] }
}

describe('ClaudeAdapter — extraDirs 는 옵션과 가드가 같은 배열을 본다 (AC11)', () => {
  it('참조가 동일하다 — 값 복사본이 아니다', () => {
    const extraDirs = ['/tmp/refs', '/tmp/docs']
    const { option, guardArg } = capture({ ...baseReq(), extraDirs })

    expect(option).toEqual(extraDirs)
    expect(guardArg).toBe(option)
  })

  it('extraDirs 미지정이어도 같은 빈 배열을 공유한다', () => {
    const { option, guardArg } = capture(baseReq())

    expect(option).toEqual([])
    expect(guardArg).toBe(option)
  })

  it('가드 훅은 cwd 를 workspace 루트로 함께 받는다', () => {
    capture({ ...baseReq(), extraDirs: ['/tmp/refs'] })
    expect(guardHookMock.mock.calls[0]?.[0]).toBe('/tmp/work')
  })

  it('Work output directory reaches the SDK and guard without mutating user extraDirs', async () => {
    const extraDirs = ['/tmp/refs']
    const context: RuntimeToolContext = {
      cwd: '/tmp/work',
      extraDirs,
      getSignal: () => new AbortController().signal,
      waitForSession: async () => 's1'
    }
    const captured = vi.fn(async () => {})
    const request = baseReq()
    request.extraDirs = extraDirs
    request.runtimeToolContext = context
    request.extensions.outputFiles = { directory: '/tmp/output', capture: captured }
    const { option, guardArg } = capture(request)
    expect(option).toEqual(['/tmp/refs', '/tmp/output'])
    expect(guardArg).toBe(option)
    expect(extraDirs).toEqual(['/tmp/refs'])
    const args = queryMock.mock.calls[0][0] as {
      options: { hooks: Record<string, { hooks: ((...args: unknown[]) => Promise<unknown>)[] }[]> }
    }
    expect(args.options.hooks.Stop).toHaveLength(2)
    await args.options.hooks.PostToolUse[0].hooks[0](
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/output/report.md' },
        tool_response: 'success'
      },
      undefined,
      {}
    )
    expect(captured).toHaveBeenCalledWith(
      '/tmp/output/report.md',
      expect.objectContaining({ cwd: '/tmp/work' })
    )
  })
})
