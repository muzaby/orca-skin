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
import { prepareHarnessConfig, type ResolvedHarnessSettings } from './harness-config'
import type { RuntimeToolSnapshot } from './runtime-tools'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

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
import { getTemporaryFilesPath } from '../infra/config/temp-path'

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
  it.each(['work', 'code'])(
    'pins SDK internal temp for %s and completion despite broad env/settings overrides',
    async (kind) => {
      const root = getTemporaryFilesPath()
      const env = { PATH: '/fixture/bin', CLAUDE_CODE_TMPDIR: 'C:/wide-env', TMP: 'C:/os-temp' }
      const providerSettings: ResolvedHarnessSettings = {
        providerKey: 'fixture',
        provider: 'claude',
        sourceRevision: '1',
        settings: { env: { claude_code_tmpdir: 'C:/wide-settings', OTHER: 'preserve' } }
      }
      const adapter = new ClaudeAdapter()
      queryMock.mockClear()
      adapter.sendMessage({
        sessionId: null,
        text: 'fixture',
        cwd: '/ws/project',
        env,
        providerSettings,
        extensions: {
          ...(kind === 'work' ? { agentProfileKey: 'work:fixture' } : {}),
          skills: [],
          hooks: { normalized: {} }
        }
      })
      const conversation = optionsOfFirstCall()
      queryMock.mockClear()
      await adapter.complete({ prompt: 'title', env, providerSettings })
      for (const options of [conversation, optionsOfFirstCall()]) {
        expect(options.env).toMatchObject({
          CLAUDE_CODE_TMPDIR: root,
          PATH: '/fixture/bin',
          TMP: 'C:/os-temp'
        })
        expect(JSON.parse(options.settings as string).env).toEqual({
          CLAUDE_CODE_TMPDIR: root,
          OTHER: 'preserve'
        })
      }
      expect(conversation.additionalDirectories).toContain(root)
    }
  )
  it('the query SDK server receives the channel context and returns its receipt', async () => {
    queryMock.mockClear()
    const channelSignal = new AbortController().signal
    const runtimeTools: RuntimeToolSnapshot = {
      revision: 1,
      servers: new Map([
        [
          'records',
          {
            descriptor: {
              id: 'records',
              connectorId: 'fixture',
              tools: [{ name: 'lookup', description: 'lookup' }]
            },
            implementations: [
              {
                name: 'lookup',
                inputSchema: {},
                handler: async (_input, context) => ({
                  content: [
                    {
                      type: 'text',
                      text: context ? await context.waitForSession(context.getSignal()) : 'missing'
                    }
                  ]
                })
              }
            ]
          }
        ]
      ])
    }
    const live = new ClaudeAdapter().sendMessage({
      sessionId: null,
      text: 'hello',
      cwd: '/ws/project',
      extensions: { skills: [], hooks: { normalized: {} }, runtimeTools },
      runtimeToolContext: {
        cwd: '/ws/project',
        extraDirs: [],
        getSignal: () => channelSignal,
        waitForSession: async () => 'confirmed-session'
      }
    })
    const config = optionsOfFirstCall().mcpServers!.records
    if (config.type !== 'sdk') throw new Error('expected SDK server')
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await config.instance.connect(serverTransport)
    const client = new Client({ name: 'query-fixture', version: '1' })
    try {
      await client.connect(clientTransport)
      const result = await client.callTool({ name: 'lookup', arguments: {} })
      expect(result.content).toEqual([{ type: 'text', text: 'confirmed-session' }])
    } finally {
      await client.close()
      live.close()
    }
  })

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
        const root = getTemporaryFilesPath()
        if (env)
          expect(options.env).toEqual({
            CLAUDE_CODE_USE_POWERSHELL_TOOL: '1',
            ...env,
            CLAUDE_CODE_TMPDIR: root
          })
        else {
          expect(options.env?.CLAUDE_CODE_TMPDIR).toBe(root)
          expect(
            Object.entries(process.env).every(
              ([key, value]) =>
                key.toUpperCase() === 'CLAUDE_CODE_TMPDIR' || options.env?.[key] === value
            )
          ).toBe(true)
        }
        expect(JSON.parse(options.settings as string)).toEqual({
          skipWebFetchPreflight: true,
          ...settings,
          env: {
            ...(env
              ? settings?.env
              : {
                  CLAUDE_CODE_USE_POWERSHELL_TOOL:
                    process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL ?? '1'
                }),
            CLAUDE_CODE_TMPDIR: root
          }
        })
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
      expect(conversation).not.toHaveProperty('allowedTools')
      expect(conversation).not.toHaveProperty('tools')
      expect(conversation.disallowedTools).toEqual(['WebSearch'])
    }
  )

  it.each(['work', 'code'])(
    '%s 대화는 도구 노출과 PowerShell 승인 정책을 분리한다',
    async (kind) => {
      const requestApproval = vi
        .fn()
        .mockResolvedValueOnce({ behavior: 'allow', updatedInput: { command: 'approved command' } })
        .mockResolvedValueOnce({ behavior: 'deny', message: 'fixture deny' })
      queryMock.mockClear()
      new ClaudeAdapter().sendMessage({
        sessionId: null,
        text: 'hello',
        cwd: '/ws/project',
        requestApproval,
        extensions: {
          ...(kind === 'work' ? { agentProfileKey: 'work:fixture' } : {}),
          skills: [],
          hooks: { normalized: {} }
        }
      })
      const options = optionsOfFirstCall()
      expect(options).not.toHaveProperty('allowedTools')
      expect(options).not.toHaveProperty('tools')
      expect(options.disallowedTools).toEqual(['WebSearch'])
      const input = { command: "Set-Content -LiteralPath 'output.txt' -Value 'fixture'" }
      const context = {
        signal: new AbortController().signal,
        toolUseID: 'fixture-call',
        requestId: 'fixture-request'
      }
      expect(await options.canUseTool!('PowerShell', input, context)).toEqual({
        behavior: 'allow',
        updatedInput: { command: 'approved command' }
      })
      expect(
        await options.canUseTool!('PowerShell', input, {
          ...context,
          requestId: 'second-request',
          toolUseID: 'second-call'
        })
      ).toEqual({
        behavior: 'deny',
        message: 'fixture deny'
      })
      expect(requestApproval).toHaveBeenCalledTimes(2)
      expect(requestApproval).toHaveBeenCalledWith(
        {
          kind: 'tool_approval',
          toolName: 'PowerShell',
          input,
          providerRequest: {
            generation: expect.any(String),
            toolUseId: 'fixture-call',
            requestId: 'fixture-request'
          }
        },
        context.signal
      )
    }
  )

  it.each(['process', 'app', 'provider', 'runtime', 'custom'])(
    '%s의 명시 env를 실제 설정 조립부터 query까지 보존한다',
    (highest) => {
      const layers = ['process', 'app', 'provider', 'runtime', 'custom']
      const values = layers.map((layer, index) => {
        const env: Record<string, string> = {}
        if (index <= layers.indexOf(highest)) {
          env.CLAUDE_CODE_USE_POWERSHELL_TOOL = layer === highest ? '0' : '1'
        }
        return env
      })
      const settings = { env: values[2], skipWebFetchPreflight: false }
      const prepared = prepareHarnessConfig({
        config: {
          key: 'fixture',
          harnessId: 'claude',
          modelProviderId: 'fixture',
          settings: { providerKey: 'fixture', provider: 'claude', sourceRevision: '1', settings },
          runtimeEnv: values[3]
        },
        baseEnv: () => ({ PATH: '/fixture/bin', ...values[0] }),
        appEnv: { APP_VALUE: 'fixture', ...values[1] },
        customEnv: () => values[4]
      })
      queryMock.mockClear()
      new ClaudeAdapter().sendMessage({
        sessionId: null,
        text: 'hello',
        cwd: '/ws/project',
        ...prepared,
        extensions: { skills: [], hooks: { normalized: {} } }
      })
      const options = optionsOfFirstCall()
      expect(options.env?.CLAUDE_CODE_USE_POWERSHELL_TOOL).toBe('0')
      expect(JSON.parse(options.settings as string)).toEqual({
        skipWebFetchPreflight: false,
        env: { CLAUDE_CODE_TMPDIR: getTemporaryFilesPath() }
      })
      expect(settings.env).toBe(values[2])
    }
  )
})
