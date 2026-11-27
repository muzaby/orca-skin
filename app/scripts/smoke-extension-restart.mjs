// AC3 exercises the bundled data/agent host window ports, the native database and a local model.
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { bootPair } from './smoke-host-pair.mjs'
import { scaleMs } from './test-time.mjs'

const file = fileURLToPath(import.meta.url)
const cli = process.env.ORCINUS_ORCA_TEST_OPENCODE_EXE
assert.ok(cli, 'Set ORCINUS_ORCA_TEST_OPENCODE_EXE to the tested local CLI')
async function verify(root, out) {
  assert.equal(homedir(), join(root, 'home'))
  const records = []
  const calls = []
  const endpoint = createServer(async (req, res) => {
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
      if (req.url === '/mcp') {
        const server = new McpServer({ name: 'restart-docs', version: '1' })
        server.registerTool('marker', { inputSchema: {} }, async () => {
          calls.push('called')
          return { content: [{ type: 'text', text: 'restart-docs-result' }] }
        })
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true
        })
        res.on('close', () => {
          void server.close()
        })
        await server.connect(transport)
        await transport.handleRequest(req, res, body)
        return
      }
      const messages = body.messages ?? []
      const content = JSON.stringify(
        messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
      )
      const mark = content.match(/OO_RESTART_[A-Z_]+/)?.[0]
      const names = (body.tools ?? []).map((tool) => tool.function.name)
      const last = messages.map((m) => m.role).lastIndexOf('user')
      if (mark && names.length) records.push({ mark, names, messages })
      const use =
        mark &&
        names.includes('docs_marker') &&
        !messages.slice(last + 1).some((m) => m.role === 'tool')
      const tools = use
        ? [
            {
              index: 0,
              id: 'call-docs',
              type: 'function',
              function: { name: 'docs_marker', arguments: '{}' }
            }
          ]
        : undefined
      const delta = {
        role: 'assistant',
        ...(tools ? { tool_calls: tools } : { content: 'fixture answer' })
      }
      const base = {
        id: 'local',
        model: body.model,
        created: 1,
        usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 }
      }
      const finish = tools ? 'tool_calls' : 'stop'
      if (body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        for (const [d, reason] of [
          [delta, null],
          [{}, finish]
        ])
          res.write(
            'data: ' +
              JSON.stringify({
                ...base,
                object: 'chat.completion.chunk',
                choices: [{ index: 0, delta: d, finish_reason: reason }]
              }) +
              '\n\n'
          )
        res.end('data: [DONE]\n\n')
      } else {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            ...base,
            object: 'chat.completion',
            choices: [{ index: 0, message: delta, finish_reason: finish }]
          })
        )
      }
    } catch (error) {
      res.writeHead(500)
      res.end(String(error))
    }
  })
  endpoint.listen(0, '127.0.0.1')
  await once(endpoint, 'listening')
  const base = 'http://127.0.0.1:' + endpoint.address().port
  const settings = {
    model: 'fixture/local',
    small_model: 'fixture/local',
    enabled_providers: ['fixture'],
    lsp: false,
    formatter: false,
    provider: {
      fixture: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Fixture',
        options: { baseURL: base + '/v1', apiKey: 'local' },
        models: { local: { name: 'Local', limit: { context: 32768, output: 1024 } } }
      }
    }
  }
  const a = join(root, 'A'),
    b = join(root, 'B')
  await Promise.all([a, b, join(root, 'app')].map((path) => mkdir(path, { recursive: true })))
  for (const [path, data] of [
    [
      join(
        homedir(),
        '.config',
        'orcinus-orca',
        'sources',
        'settings',
        'opencode',
        'fixture',
        'settings.json'
      ),
      settings
    ],
    [
      join(process.env.XDG_CONFIG_HOME, 'opencode', 'opencode.json'),
      {
        $schema: 'https://opencode.ai/config.json',
        ...settings,
        mcp: { docs: { type: 'remote', url: base + '/mcp', oauth: false, enabled: true } }
      }
    ],
    [
      join(root, 'app', 'orcinus-orca-settings.json'),
      { harnesses: { opencode: { executablePath: cli, autoApprovePermissions: true } } }
    ]
  ]) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(data))
  }
  // Initialize the harness-owned database before measuring application restarts.
  await promisify(execFile)(cli, ['db', 'select count(*) from sqlite_master'], {
    cwd: a,
    timeout: scaleMs(60000)
  })
  let pair
  try {
    const start = async () => {
      pair = await bootPair(out, root)
      const check = await pair.invoke('agent', 'oo:harness:recheck', { backend: 'opencode' })
      assert.ok(check)
      const catalog = await pair.invoke('agent', 'oo:extensions:catalog', { backend: 'opencode' })
      return catalog.items.find((item) => item.kind === 'mcp' && item.id === 'docs')
    }
    const choice = async (enabled) => {
      const result = await pair.invoke('agent', 'oo:extensions:setEnabled', {
        backend: 'opencode',
        kind: 'mcp',
        id: 'docs',
        enabled
      })
      assert.equal(result.resources.items.find((item) => item.id === 'docs')?.selected, enabled)
      const disk = JSON.parse(
        await readFile(join(root, 'app', 'orcinus-orca-settings.json'), 'utf8')
      )
      assert.equal(disk.nativeExtensionChoices?.opencode?.['mcp:docs'], enabled)
    }
    const send = async (mark, cwd, sessionId = null, on = false) => {
      const pos = pair.received.length,
        before = calls.length
      await pair.invoke('agent', 'oo:chat:send', {
        sessionId,
        backend: 'opencode',
        agentKind: 'code',
        cwd,
        projectId: null,
        text: mark,
        providerKey: 'opencode-fixture',
        modelFamily: 'fixture/local',
        clientKey: mark,
        clientRequestId: mark
      })
      const events = pair.received.slice(pos)
      const error = events.find((event) => event.type === 'error')
      assert.ok(!error, JSON.stringify(error))
      assert.ok(
        events.some((event) => event.type === 'turn.ended'),
        JSON.stringify(events.map((event) => event.type))
      )
      const echo = events.filter(
        (event) => event.type === 'message.committed' && event.text === mark
      )
      assert.equal(echo.length, 1)
      const own = records.filter((record) => record.mark === mark)
      assert.ok(own.length, mark)
      assert.equal(own[0].names.includes('docs_marker'), on)
      assert.equal(calls.length - before, on ? 1 : 0)
      console.log('confirmed', mark, echo[0].sessionId, on)
      return echo[0].sessionId
    }
    assert.equal((await start())?.canToggle, true)
    await choice(true)
    const first = await send('OO_RESTART_ORIGINAL', a, null, true)
    const nativeId = (mark) => {
      const db = new Database(join(process.env.XDG_DATA_HOME, 'opencode', 'opencode.db'), {
        readonly: true,
        fileMustExist: true
      })
      try {
        const rows = db
          .prepare(
            `SELECT part.session_id FROM part JOIN message ON message.id=part.message_id WHERE json_extract(part.data,'$.text')=? AND json_extract(message.data,'$.role')='user'`
          )
          .all(mark)
        assert.equal(rows.length, 1, mark)
        return rows[0].session_id
      } finally {
        db.close()
      }
    }
    const originalNativeId = nativeId('OO_RESTART_ORIGINAL')
    await choice(false)
    await send('OO_RESTART_SAME', a)
    await send('OO_RESTART_OTHER', b)
    await pair.close()
    pair = undefined
    assert.equal((await start())?.selected, false)
    assert.equal(await send('OO_RESTART_RESUME', a, first), first)
    assert.equal(nativeId('OO_RESTART_RESUME'), originalNativeId)
    assert.equal(nativeId('OO_RESTART_ORIGINAL'), originalNativeId)
    const history = JSON.stringify(
      records.find((record) => record.mark === 'OO_RESTART_RESUME').messages
    )
    assert.ok(history.includes('OO_RESTART_ORIGINAL'))
    assert.ok(history.includes('restart-docs-result'))
    await send('OO_RESTART_NEW_A', a)
    await send('OO_RESTART_NEW_B', b)
    const rows = await pair.invoke('data', 'oo:session:list')
    assert.equal(rows.filter((row) => row.id === first).length, 1)
    console.log(
      'AC3 confirmed persisted selection, two host generations, model schemas, handler calls and prior native history'
    )
  } finally {
    await pair?.close()
    endpoint.closeAllConnections()
    endpoint.close()
  }
}
if (process.argv[2] === '--isolated') {
  await verify(process.argv[3], process.argv[4])
} else {
  const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-extension-restart-'))
  try {
    const isolated = {
      ...process.env,
      HOME: join(root, 'home'),
      USERPROFILE: join(root, 'home'),
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_DATA_HOME: join(root, 'data'),
      XDG_CACHE_HOME: join(root, 'cache'),
      XDG_STATE_HOME: join(root, 'state'),
      OPENCODE_DISABLE_INSTALL: '1',
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENCODE_DISABLE_MODELS_FETCH: '1',
      OPENCODE_DISABLE_DEFAULT_PLUGINS: '1'
    }
    const child = promisify(execFile)(
      process.execPath,
      [file, '--isolated', root, resolve(process.argv[2] ?? 'out/main')],
      { env: isolated, timeout: scaleMs(200000), maxBuffer: 8 * 1024 * 1024 }
    )
    child.child.stdout.pipe(process.stdout)
    child.child.stderr.pipe(process.stderr)
    await child
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
}
