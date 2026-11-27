import { createServer, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { z } from 'zod'
import { appendFile } from 'node:fs/promises'
import type { RuntimeToolServer } from '../adapters/common/runtime-tools'
import { PRODUCT_SLUG } from '../../shared/product'
import { scaledBudget, scaleMs } from '../../../scripts/test-time.mjs'
import type { TurnRequest } from '../adapters/common/turn'
import { ClaudeAdapter } from '../adapters/claude/adapter'
import { SessionRuntime } from '../features/sessions/session-runtime'

vi.setConfig(scaledBudget({ testTimeout: 180_000, hookTimeout: 30_000 }))

function streamMessage(response: ServerResponse, tool: string | undefined, argument: string): void {
  response.writeHead(200, { 'Content-Type': 'text/event-stream' })
  const send = (event: string, value: object) =>
    response.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...value })}\n\n`)
  send('message_start', {
    message: {
      id: randomUUID(),
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 24, output_tokens: 0 }
    }
  })
  if (tool) {
    send('content_block_start', {
      index: 0,
      content_block: { type: 'tool_use', id: 'toolu_' + randomUUID(), name: tool, input: {} }
    })
    send('content_block_delta', {
      index: 0,
      delta: {
        type: 'input_json_delta',
        partial_json: JSON.stringify(tool === 'Read' ? { file_path: argument } : { argument })
      }
    })
  } else {
    send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
    send('content_block_delta', {
      index: 0,
      delta: { type: 'text_delta', text: 'Fixture complete.' }
    })
  }
  send('content_block_stop', { index: 0 })
  send('message_delta', {
    delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null },
    usage: { output_tokens: 8 }
  })
  send('message_stop', {})
  response.end()
}

it.each(['command', 'hook', 'mcp', 'combined', 'native', 'external', 'builtin'])(
  'runs %s capabilities across ON/OFF/ON on the same native conversation',
  async (fixture) => {
    const hasCommand = fixture === 'combined' || fixture === 'command'
    const hasHook = fixture === 'combined' || fixture === 'hook'
    const pluginMcp = fixture === 'combined' || fixture === 'mcp'
    const hasMcp = pluginMcp || ['native', 'external', 'builtin'].includes(fixture)
    const fixtureTool =
      fixture === 'builtin'
        ? 'mcp__fixturehost__echo'
        : fixture === 'native'
          ? 'mcp__fixtureuser__echo'
          : fixture === 'external'
            ? 'mcp__plugin_' + PRODUCT_SLUG + '_external__echo'
            : 'mcp__plugin_fixture_gate__echo'
    const base = await mkdtemp(join(tmpdir(), 'oo-claude-input-'))
    const nativeRoot = join(base, 'home', '.claude')
    const cwd = join(base, 'project')
    const installation = join(base, 'active-installation')
    const mark = join(base, 'hook-count')
    const calls = join(base, 'mcp-calls')
    const put = async (file: string, body: string | object) => {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, typeof body === 'string' ? body : JSON.stringify(body))
    }
    let inputNumber = 0
    let replyNumber = 0
    const requests: { turn: number; tools: string[]; messages: string }[] = []
    const endpoint = createServer(async (request, response) => {
      if (!request.url?.startsWith('/v1/messages') || request.url.includes('count_tokens')) {
        response
          .writeHead(200, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ input_tokens: 24 }))
        return
      }
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      const body = JSON.parse(Buffer.concat(chunks).toString())
      const tools = (body.tools ?? []).map((tool: { name: string }) => tool.name)
      requests.push({ turn: inputNumber, tools, messages: JSON.stringify(body.messages) })
      const reply = replyNumber++
      const requestedTool = reply === 0 ? 'Read' : hasMcp && reply === 1 ? fixtureTool : undefined
      streamMessage(
        response,
        requestedTool,
        requestedTool === 'Read' ? join(cwd, 'control-' + inputNumber) : 'input-' + inputNumber
      )
    })
    await new Promise<void>((resolve) => endpoint.listen(0, '127.0.0.1', resolve))
    const address = endpoint.address()
    if (!address || typeof address === 'string') throw new Error('fixture endpoint unavailable')
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' &&
          /^(path|systemroot|windir|comspec|pathext|tmp|temp)$/i.test(entry[0])
      )
    )
    Object.assign(env, {
      HOME: join(base, 'home'),
      USERPROFILE: join(base, 'home'),
      CLAUDE_CONFIG_DIR: nativeRoot,
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:' + address.port,
      ANTHROPIC_API_KEY: 'local-test',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      ENABLE_TOOL_SEARCH: 'false',
      API_TIMEOUT_MS: '10000'
    })
    const count = async (path: string) =>
      (await readFile(path, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean)
    let selected = true
    const key =
      fixture === 'builtin'
        ? 'managed:builtin:fixture-source'
        : fixture === 'external'
          ? 'managed:user:external'
          : fixture === 'native'
            ? 'mcp:fixtureuser'
            : 'plugin:fixture@local'
    const adapter = new ClaudeAdapter({ global: () => ({ [key]: selected }) })
    const runtime = new SessionRuntime(adapter)
    try {
      await mkdir(cwd, { recursive: true })
      await put(join(installation, '.claude-plugin/plugin.json'), {
        name: 'fixture',
        version: '1.0.0'
      })
      if (hasCommand)
        await put(
          join(installation, 'commands/check.md'),
          '---\ndescription: verify this conversation\n---\ncommand-body-8721 $ARGUMENTS'
        )
      const hook = join(installation, 'hook.cjs')
      await put(hook, `require('node:fs').appendFileSync(${JSON.stringify(mark)}, 'hook\\n')`)
      if (hasHook)
        await put(join(installation, 'hooks/hooks.json'), {
          hooks: {
            UserPromptSubmit: [
              { hooks: [{ type: 'command', command: '"' + process.execPath + '" "' + hook + '"' }] }
            ]
          }
        })
      const mcp = join(installation, 'mcp.cjs')
      await put(
        mcp,
        `require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
      const q=JSON.parse(line); if(q.id===undefined) return;
      let result={};
      if(q.method==='initialize') result={protocolVersion:q.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}};
      if(q.method==='tools/list') result={tools:[{name:'echo',description:'fixture echo',inputSchema:{type:'object',properties:{argument:{type:'string'}},required:['argument']}}]};
      if(q.method==='tools/call'){const value=q.params.arguments.argument;require('node:fs').appendFileSync(${JSON.stringify(calls)},value+'\\n');result={content:[{type:'text',text:'reply-'+value}]};}
      process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:q.id,result})+'\\n');
    });`
      )
      if (pluginMcp)
        await put(join(installation, '.mcp.json'), {
          gate: { command: process.execPath, args: [mcp] }
        })
      await put(join(nativeRoot, 'plugins/installed_plugins.json'), {
        version: 2,
        plugins: { 'fixture@local': [{ scope: 'user', installPath: installation }] }
      })
      await put(join(nativeRoot, 'settings.json'), { enabledPlugins: { 'fixture@local': true } })
      const config = { command: process.execPath, args: [mcp] }
      if (fixture === 'native')
        await put(join(nativeRoot, '.claude.json'), { mcpServers: { fixtureuser: config } })
      const server: RuntimeToolServer = {
        descriptor: {
          id: 'fixturehost',
          connectorId: 'fixture-source',
          executionScope: 'application',
          alwaysLoad: true,
          tools: [{ name: 'echo', description: 'fixture echo' }]
        },
        implementations: [
          {
            name: 'echo',
            inputSchema: { argument: z.string() },
            handler: async (args) => {
              await appendFile(calls, String(args.argument) + '\n')
              return { content: [{ type: 'text', text: 'reply-' + args.argument }] }
            }
          }
        ]
      }
      const extensions: TurnRequest['extensions'] = { skills: [], hooks: { normalized: {} } }
      if (fixture === 'external')
        extensions.managedMcp = {
          revision: 1,
          users: {},
          plugins: new Map(),
          definitions: { external: config },
          desired: { external: false }
        }
      if (fixture === 'builtin') {
        extensions.runtimeTools = { revision: 1, servers: new Map([['fixturehost', server]]) }
        extensions.managedMcp = {
          revision: 1,
          users: {},
          plugins: new Map([
            [
              'fixturehost',
              {
                identity: {
                  kind: 'builtin',
                  name: 'Fixture',
                  sourceId: 'fixture-source',
                  mentionId: 'fixture-source'
                },
                server,
                authorized: () => true,
                credentialRevision: () => 1
              }
            ]
          ])
        }
      }
      let nativeId: string | null = null
      for (const on of [true, false, true]) {
        selected = on
        inputNumber++
        replyNumber = 0
        const controlResult = 'control-file-result-' + randomUUID()
        await put(join(cwd, 'control-' + inputNumber), controlResult)
        const uuid = randomUUID()
        const request: TurnRequest = {
          cwd,
          env,
          sessionId: nativeId,
          promptUuid: uuid,
          text:
            on && hasCommand
              ? '/fixture:check turn-' + inputNumber
              : 'Exercise fixture capabilities input-' + inputNumber,
          permissionMode: 'bypass',
          extensions
        }
        const stop = setTimeout(() => runtime.close(), scaleMs(30_000))
        try {
          let finished = false
          for await (const event of runtime.send(request)) {
            if (event.type === 'error') throw new Error(JSON.stringify(event))
            if (event.type === 'session.updated') {
              if (nativeId) expect(event.sessionId).toBe(nativeId)
              nativeId = event.sessionId
            }
            if (event.type === 'telemetry') finished = true
          }
          expect(finished).toBe(true)
          const commands = await runtime.nativeResources()
          expect(commands.commands?.some((command) => command.name === 'fixture:check')).toBe(
            on && hasCommand
          )
        } finally {
          clearTimeout(stop)
        }
        const turn = requests.filter((request) => request.turn === inputNumber)
        expect(turn.length).toBeGreaterThan(0)
        expect(turn[0].tools).toContain('Read')
        expect(turn.at(-1)?.messages).toContain(controlResult)
        expect(turn[0].tools.includes(fixtureTool), turn[0].tools.join(', ')).toBe(on && hasMcp)
        if (on && hasCommand) expect(turn[0].messages).toContain('command-body-8721')
        if (on && hasMcp) expect(turn.at(-1)?.messages).toContain('reply-input-' + inputNumber)
        expect(await count(mark)).toHaveLength(hasHook ? (inputNumber === 3 ? 2 : 1) : 0)
        expect(await count(calls)).toEqual(
          hasMcp ? (inputNumber === 3 ? ['input-1', 'input-3'] : ['input-1']) : []
        )
      }
    } finally {
      runtime.close()
      endpoint.closeAllConnections()
      await new Promise<void>((resolve) => endpoint.close(() => resolve()))
      await rm(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    }
  }
)
