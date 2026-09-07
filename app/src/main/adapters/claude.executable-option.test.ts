// AC38 (0215 ΔV4 · EP-29) — 해석된 실행 파일 경로가 **두 query() 호출 모두**에 실린다.
//
// 해석기 자체는 claude-executable.test.ts 가 잠근다. 여기서 보는 것은 배선이다: 한쪽 스프레드가
// 빠지면 그 경로만 SDK 기본 해석으로 돌아가고, dev 에서는 같은 바이너리라 조용히 통과한 뒤
// 패키징에서만 asar spawn 실패로 터진다(0105 의 원래 버그). 두 슬롯을 각각 단언한다.

import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import type { ResolvedHarnessSettings } from './harness-config'
import type { RuntimeToolSnapshot } from './runtime-tools'

// vi.mock 팩토리는 호이스팅되므로 sentinel 도 vi.hoisted 로 만든다.
const { SENTINEL, queryMock } = vi.hoisted(() => ({
  SENTINEL: '/bundled/app.asar.unpacked/node_modules/@anthropic-ai/x/claude',
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

vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query: queryMock
}))
vi.mock('./claude-executable', () => ({ resolveClaudeExecutable: () => SENTINEL }))

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'

function optionsOfFirstCall(): Options {
  return (
    queryMock.mock.calls[0]?.[0] as {
      options: Options
    }
  ).options
}

describe('claudeExecutableOption 배선', () => {
  it('sendMessage 경로가 해석 결과를 SDK 로 넘긴다', () => {
    queryMock.mockClear()
    const req: TurnRequest = {
      sessionId: null,
      text: 'hello',
      // workspace 가드가 cwd 를 루트로 요구한다(claude.cwd.test.ts 와 같은 최소 형태).
      cwd: '/ws/project',
      extensions: { skills: [], hooks: { normalized: {} } }
    }
    new ClaudeAdapter().sendMessage(req)
    expect(optionsOfFirstCall().pathToClaudeCodeExecutable).toBe(SENTINEL)
  })

  it('complete(runCompletion) 경로도 같은 결과를 넘긴다', async () => {
    queryMock.mockClear()
    await new ClaudeAdapter().complete({ prompt: 'title please' })
    expect(optionsOfFirstCall().pathToClaudeCodeExecutable).toBe(SENTINEL)
  })
})

describe('Claude 공통 실행 옵션', () => {
  it('대화 query는 plugin과 메모리 도구를 계속 소비한다', () => {
    const pluginRoot = mkdtempSync(join(tmpdir(), 'orca-query-plugin-'))
    try {
      mkdirSync(join(pluginRoot, '.claude-plugin'))
      writeFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), '{"name":"fixture"}')
      const runtimeTools: RuntimeToolSnapshot = {
        revision: 1,
        servers: new Map([
          [
            'records',
            {
              descriptor: {
                id: 'records',
                connectorId: 'fixture',
                tools: [{ name: 'lookup', description: 'Read records' }]
              },
              implementations: [
                {
                  name: 'lookup',
                  inputSchema: {},
                  handler: async () => ({ content: [{ type: 'text', text: 'fixture' }] })
                }
              ]
            }
          ]
        ])
      }
      queryMock.mockClear()
      new ClaudeAdapter().sendMessage({
        sessionId: null,
        text: 'hello',
        cwd: '/ws/project',
        extensions: {
          skills: [],
          hooks: { normalized: {} },
          pluginRoots: [pluginRoot],
          runtimeTools
        }
      })
      const options = optionsOfFirstCall()
      expect(options.plugins).toEqual([{ type: 'local', path: pluginRoot }])
      expect(options.mcpServers?.records).toMatchObject({ type: 'sdk', name: 'records' })
    } finally {
      rmSync(pluginRoot, { recursive: true, force: true })
    }
  })

  it.each([undefined, {}, { env: { API_KEY: 'fixture' }, model: 'fixture-model' }])(
    'complete/send가 같은 settings/env/source를 쓰고 실행별 도구 정책을 보존한다: %j',
    async (settings) => {
      const providerSettings: ResolvedHarnessSettings | undefined = settings
        ? { providerKey: 'fixture', provider: 'claude', sourceRevision: '1', settings }
        : undefined
      const env = settings ? { PATH: '/fixture/bin', APP_VALUE: 'fixture' } : undefined
      const adapter = new ClaudeAdapter()
      queryMock.mockClear()
      await adapter.complete({ prompt: 'title', providerSettings, env })
      const completion = optionsOfFirstCall()
      queryMock.mockClear()
      adapter.sendMessage({
        sessionId: null,
        text: 'hello',
        cwd: '/ws/project',
        providerSettings,
        env,
        extensions: { skills: [], hooks: { normalized: {} } }
      })
      const conversation = optionsOfFirstCall()
      for (const options of [completion, conversation]) {
        expect(options.settingSources).toEqual(['project', 'local'])
        expect(options.env).toEqual(env)
        expect(options.settings).toBe(
          settings && Object.keys(settings).length > 0 ? JSON.stringify(settings) : undefined
        )
        if (!settings || Object.keys(settings).length === 0) {
          expect(options).not.toHaveProperty('settings')
        }
        if (!env) expect(options).not.toHaveProperty('env')
      }
      expect(completion.tools).toEqual([])
      expect(completion.allowedTools).toEqual([])
      expect(completion.maxTurns).toBe(1)
      expect(completion.persistSession).toBe(false)
      expect(completion).not.toHaveProperty('hooks')
      expect(completion).not.toHaveProperty('plugins')
      expect(completion).not.toHaveProperty('mcpServers')
      expect(conversation).not.toHaveProperty('maxTurns')
      expect(conversation).not.toHaveProperty('persistSession')
      expect(conversation.hooks?.PreToolUse).toBeDefined()
      expect(conversation.hooks?.Stop).toBeDefined()
    }
  )
})
