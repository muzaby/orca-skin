import { expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import type { Settings } from '../../shared/ipc'
import type { RuntimeToolSnapshot } from '../adapters/runtime-tools'

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn((request: unknown) => {
    void request
    return {
      [Symbol.asyncIterator](): AsyncIterator<never> {
        return { next: async () => ({ done: true, value: undefined as never }) }
      }
    }
  })
}))
vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query: queryMock
}))

import { ClaudeAdapter } from '../adapters/claude'
import { resolveAgentProfile } from '../features/agents/profiles'
import { ExtensionBuilder } from '../features/extensions/builder'
import { applyMigrations } from '../infra/db/migrate'
import { DbQueries } from '../infra/db/queries'

it('composes Work only into the SDK header while retaining Coding execution, tools, plugins and approval', async () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-profile-query-'))
  const db = new Database(':memory:')
  try {
    mkdirSync(join(root, '.claude-plugin'))
    writeFileSync(join(root, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'fixture' }))
    applyMigrations(db)
    const snapshot: RuntimeToolSnapshot = {
      revision: 7,
      servers: new Map([
        [
          'fixture',
          {
            descriptor: {
              id: 'fixture',
              connectorId: 'fixture',
              tools: [
                {
                  name: 'write',
                  description: 'Fixture write',
                  annotations: { readOnlyHint: false }
                }
              ]
            },
            implementations: [
              { name: 'write', inputSchema: {}, handler: async () => ({ content: [] }) }
            ]
          }
        ]
      ])
    }
    const builder = new ExtensionBuilder(
      new DbQueries(db),
      () => [],
      () => ({ language: '한국어', accountInstructions: 'Keep facts' }) as Settings,
      'fixture',
      () => [root],
      { snapshot: () => snapshot }
    )
    const adapter = new ClaudeAdapter()
    const requestApproval = vi.fn(
      async () => ({ behavior: 'deny', message: 'fixture deny' }) as const
    )
    const options: Options[] = []
    queryMock.mockClear()
    for (const kind of ['coding', 'work'] as const) {
      const profile = resolveAgentProfile(kind)
      const extensions = builder.build(null, null, {
        agentInstructions: profile.instructions,
        agentProfileKey: profile.key
      })
      const live = adapter.sendMessage({
        sessionId: null,
        text: 'same user prompt',
        cwd: root,
        extraDirs: [join(root, 'reference')],
        model: 'fixture-model',
        permissionMode: 'accept_edits',
        extensions,
        requestApproval
      })
      const call = queryMock.mock.calls.at(-1)![0] as {
        prompt: AsyncIterable<unknown>
        options: Options
      }
      options.push(call.options)
      const firstInput = await call.prompt[Symbol.asyncIterator]().next()
      expect(firstInput.value).toMatchObject({ message: { content: 'same user prompt' } })
      live.close()
    }
    expect(queryMock).toHaveBeenCalledTimes(2)
    const [coding, work] = options
    const codingPrompt = coding.systemPrompt as { append: string }
    const workPrompt = work.systemPrompt as { append: string }
    const section = `# Agent\n${resolveAgentProfile('work').instructions}\n\n`
    expect(workPrompt.append.split('# Agent\n')).toHaveLength(2)
    expect(workPrompt.append.replace(section, '')).toBe(codingPrompt.append)
    for (const field of [
      'cwd',
      'additionalDirectories',
      'model',
      'permissionMode',
      'settingSources',
      'plugins',
      'extraArgs',
      'pathToClaudeCodeExecutable'
    ] as const) {
      expect(work[field]).toEqual(coding[field])
    }
    expect(work.plugins).toEqual([{ type: 'local', path: root }])
    expect(work.mcpServers?.fixture).toMatchObject({ type: 'sdk', name: 'fixture' })
    expect(coding.mcpServers?.fixture).toMatchObject({ type: 'sdk', name: 'fixture' })
    expect(work.hooks?.PreToolUse).toHaveLength(coding.hooks!.PreToolUse!.length)
    for (const option of options) {
      const result = await option.canUseTool!(
        'mcp__fixture__write',
        {},
        {
          signal: new AbortController().signal,
          toolUseID: 'fixture-call',
          requestId: 'fixture-request'
        }
      )
      expect(result).toMatchObject({ behavior: 'deny', message: 'fixture deny' })
    }
    expect(requestApproval).toHaveBeenCalledTimes(2)
    await adapter.complete({ prompt: 'title fixture' })
    expect(queryMock).toHaveBeenCalledTimes(3)
    expect(
      JSON.stringify(
        (queryMock.mock.calls.at(-1)![0] as { options: Options }).options.systemPrompt ?? null
      )
    ).not.toContain('# Agent')
  } finally {
    db.close()
    rmSync(root, { recursive: true, force: true })
  }
})
