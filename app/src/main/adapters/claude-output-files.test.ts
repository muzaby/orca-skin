import path from 'node:path'
import { describe, expect, it, vi, type Mock } from 'vitest'
import type { HookCallback, HookInput } from '@anthropic-ai/claude-agent-sdk'
import { explicitOutputLinks, makeOutputFilesHook } from './claude-output-files'
import type { RuntimeToolContext } from './runtime-tools'

const directory = path.resolve('/orca/output')
const output = (name: string): string => path.join(directory, name)
const inputBase = { session_id: 's1', cwd: '/work', transcript_path: '/work/transcript.jsonl' }

describe('explicit output links', () => {
  it('extracts direct, angle, encoded, parenthesized and image destinations without remote or plain-text paths', () => {
    expect(
      explicitOutputLinks(
        [
          '[보고서](/tmp/report.md)',
          '[공백](</tmp/my report.pdf> "title")',
          '[인코딩](/tmp/%EA%B2%B0%EA%B3%BC.csv)',
          '[괄호](/tmp/result(1).png)',
          '![그림](/tmp/image.png)',
          `[실제](<${output('actual.md')}>)`,
          '[웹](https://example.com/report.md)',
          '[상대](../report.md)',
          '[잘못된 인코딩](/tmp/%XX.md)',
          '/tmp/plain.md'
        ].join('\n'),
        directory
      )
    ).toEqual([
      output('report.md'),
      output('my report.pdf'),
      output('결과.csv'),
      output('result(1).png'),
      output('image.png'),
      output('actual.md')
    ])
  })

  it('resolves used references once and ignores unused definitions and code samples', () => {
    expect(
      explicitOutputLinks(
        [
          '[참고][REPORT]',
          '[report][]',
          '[report]',
          '[report]: </tmp/report.md> "title"',
          '[unused]: /tmp/unused.md',
          '`[inline](/tmp/inline.md)`',
          '``[inline-with-backtick `](/tmp/inline2.md)``',
          '```markdown',
          '[fence](/tmp/fence.md)',
          '```',
          '~~~',
          '[tilde](/tmp/tilde.md)',
          '~~~',
          '    [indented](/tmp/indented.md)',
          '\\[escaped](/tmp/escaped.md)'
        ].join('\n'),
        directory
      )
    ).toEqual([output('report.md')])
  })

  it('does not rebase nested, remote-style or sibling absolute paths into the output root', () => {
    expect(
      explicitOutputLinks(
        '[nested](/tmp/nested/report.md) [other](/tmp-other/report.md) [UNC](//host/report.md)',
        directory
      )
    ).toEqual(['/tmp/nested/report.md', '/tmp-other/report.md'])
  })
})

type Capture = (
  path: string,
  context: RuntimeToolContext,
  expectedContent?: string
) => Promise<void>
function setup(): {
  context: RuntimeToolContext
  capture: Mock<Capture>
  fire: (input: HookInput) => ReturnType<HookCallback>
  setSignal: (signal: AbortSignal) => void
} {
  let currentSignal = new AbortController().signal
  const context: RuntimeToolContext = {
    cwd: '/work',
    extraDirs: ['/references'],
    getSignal: () => currentSignal,
    waitForSession: vi.fn(async () => 's1')
  }
  const capture = vi.fn<Capture>(async () => {})
  const hooks = makeOutputFilesHook({ directory, capture }, context).hooks!
  const fire = (input: HookInput): ReturnType<HookCallback> =>
    hooks[input.hook_event_name]![0].hooks[0](input, undefined, {
      signal: new AbortController().signal
    })
  return { context, capture, fire, setSignal: (signal: AbortSignal) => (currentSignal = signal) }
}

describe('Work output hooks', () => {
  it('is absent without Work output injection or its channel context', () => {
    expect(makeOutputFilesHook()).toEqual({})
    expect(makeOutputFilesHook({ directory, capture: vi.fn() })).toEqual({})
  })

  it('captures successful Write/Edit only and keeps their original filesystem path', async () => {
    const { fire, capture, context } = setup()
    for (const tool_name of ['Write', 'Edit', 'Read', 'Bash']) {
      await fire({
        ...inputBase,
        hook_event_name: 'PostToolUse',
        tool_use_id: 't1',
        tool_name,
        tool_input: { file_path: '/tmp/report.md' },
        tool_response: 'success'
      })
    }
    await fire({
      ...inputBase,
      hook_event_name: 'PostToolUse',
      tool_use_id: 'failed',
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/failed.md' },
      tool_response: { isError: true }
    })
    expect(capture).toHaveBeenCalledTimes(2)
    expect(capture.mock.calls[0][0]).toBe('/tmp/report.md')
    expect(capture.mock.calls[0][1].cwd).toBe(context.cwd)
    expect(capture.mock.calls[0][1].extraDirs).toBe(context.extraDirs)
  })

  it('captures final linked binary files and reports capture failure without blocking the remaining files or loop', async () => {
    const { fire, capture } = setup()
    capture.mockRejectedValueOnce(new Error('storage failure'))
    const result = await fire({
      ...inputBase,
      hook_event_name: 'Stop',
      stop_hook_active: false,
      last_assistant_message: '[시트](/tmp/result.xlsx) [이미지](/tmp/chart.png)'
    })
    expect(capture.mock.calls.map(([filePath]) => filePath)).toEqual([
      output('result.xlsx'),
      output('chart.png')
    ])
    expect(result).toEqual({ systemMessage: '출력 파일을 저장하지 못했습니다.' })
    expect(result).not.toHaveProperty('continue', false)
  })
  it('passes the full Write content so a different task overwriting the same path cannot be captured as that Write', async () => {
    const { fire, capture } = setup()
    await fire({
      ...inputBase,
      hook_event_name: 'PostToolUse',
      tool_use_id: 'write',
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/report.md', content: '# Final' },
      tool_response: 'success'
    })
    expect(capture).toHaveBeenCalledWith('/tmp/report.md', expect.any(Object), '# Final')
  })

  it('captures the current channel signal per invocation and accepts a fresh signal after an interrupt', async () => {
    const { fire, capture, setSignal } = setup()
    const first = new AbortController()
    const next = new AbortController()
    setSignal(first.signal)
    const stop: HookInput = {
      ...inputBase,
      hook_event_name: 'Stop',
      stop_hook_active: false,
      last_assistant_message: '[파일](/tmp/report.md)'
    }
    await fire(stop)
    const firstContext = capture.mock.calls[0][1]
    first.abort()
    await fire(stop)
    expect(capture).toHaveBeenCalledTimes(1)
    setSignal(next.signal)
    await fire(stop)
    expect(capture).toHaveBeenCalledTimes(2)
    expect(firstContext.getSignal()).toBe(first.signal)
    expect(capture.mock.calls[1][1].getSignal()).toBe(next.signal)
  })
})
