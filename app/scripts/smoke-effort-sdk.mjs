// Opt-in bundled CLI checks using only a loopback model fixture.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { createServer as createViteServer } from 'vite'

const selected = process.argv.find((arg) => arg.startsWith('--case='))?.slice(7)
if (selected && !['A', 'B', 'C', 'D', 'E'].includes(selected)) {
  throw new Error('Expected --case=A|B|C|D|E')
}
const root = join(tmpdir(), 'orcinus-orca')
await mkdir(root, { recursive: true })
const cwd = await mkdtemp(join(root, 'effort-smoke-'))
const requests = []
const results = []
const server = createServer(async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (req.url?.includes('count_tokens')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ input_tokens: 1 }))
    return
  }
  if (!req.url?.split('?')[0].endsWith('/messages')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
    return
  }
  const body = JSON.parse(Buffer.concat(chunks).toString())
  requests.push({
    model: body.model,
    effort: body.output_config?.effort,
    beta: req.headers['anthropic-beta'] ?? ''
  })
  const message = {
    id: `fixture_${requests.length}`,
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text: 'Local effort fixture complete.' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 }
  }
  if (body.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    emit('message_start', {
      type: 'message_start',
      message: { ...message, content: [], stop_reason: null }
    })
    emit('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' }
    })
    emit('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: message.content[0].text }
    })
    emit('content_block_stop', { type: 'content_block_stop', index: 0 })
    emit('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 1 }
    })
    emit('message_stop', { type: 'message_stop' })
    res.end()
  } else {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(message))
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

const env = { ...process.env }
// Isolate SDK model/auth/settings inputs while retaining OS process-launch inputs.
for (const key of Object.keys(env)) {
  if (/^(ANTHROPIC_|CLAUDE_CODE_USE_|CLAUDE_CODE_EFFORT|CLAUDE_CODE_DISABLE_1M)/.test(key))
    delete env[key]
}
Object.assign(env, {
  HOME: cwd,
  USERPROFILE: cwd,
  CLAUDE_CONFIG_DIR: join(cwd, '.claude'),
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  ANTHROPIC_API_KEY: 'local-fixture',
  ANTHROPIC_AUTH_TOKEN: 'local-fixture',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  CLAUDE_CODE_TMPDIR: root
})

const loader = await createViteServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true }
})

async function run(group, label, action) {
  if (selected && selected !== group) return
  const start = requests.length
  try {
    await action()
    const result = { group, label, ok: true, requests: requests.slice(start) }
    results.push(result)
    console.log(JSON.stringify(result))
  } catch (error) {
    const result = {
      group,
      label,
      ok: false,
      error: String(error),
      requests: requests.slice(start)
    }
    results.push(result)
    console.log(JSON.stringify(result))
  }
}

async function oneTurn(model, effort) {
  const start = requests.length
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  const live = query({
    prompt: 'Return the local fixture response.',
    options: {
      cwd,
      model,
      env,
      settingSources: [],
      persistSession: false,
      maxTurns: 1,
      abortController: controller,
      ...(effort ? { effort } : {})
    }
  })
  try {
    let success = false
    for await (const event of live) {
      if (event.type === 'result') {
        assert.equal(event.subtype, 'success')
        success = true
      }
    }
    assert.equal(success, true, 'CLI did not complete a successful turn')
    const observed = requests.slice(start)
    assert.equal(observed.length, 1, 'Expected exactly one model request')
    return observed[0]
  } finally {
    clearTimeout(timer)
    live.close()
  }
}

try {
  const { CLAUDE_MODEL_DEFAULT_EFFORT, CLAUDE_ALIAS_VERSION } = await loader.ssrLoadModule(
    '/src/shared/model-effort.ts'
  )
  const { parseClaudeModelName } = await loader.ssrLoadModule('/src/shared/model-identity.ts')
  const { ClaudeAdapter } = await loader.ssrLoadModule('/src/main/adapters/claude.ts')
  const { SessionRuntime } = await loader.ssrLoadModule(
    '/src/main/features/sessions/session-runtime.ts'
  )

  for (const row of CLAUDE_MODEL_DEFAULT_EFFORT) {
    const model = `claude-${row.family}-${row.major}${row.minor ? `-${row.minor}` : ''}`
    await run('A', model, async () => {
      assert.equal((await oneTurn(model)).effort, row.effort)
    })
  }
  for (const [alias, version] of Object.entries(CLAUDE_ALIAS_VERSION)) {
    await run('B', alias, async () => {
      const name = parseClaudeModelName((await oneTurn(alias)).model)
      assert.equal(name?.family, alias)
      assert.deepEqual(name?.version, version)
    })
  }
  await run('C', 'runtime → adapter → live CLI [high, low, low]', async () => {
    const start = requests.length
    const adapter = new ClaudeAdapter()
    const sendMessage = adapter.sendMessage.bind(adapter)
    let spawns = 0
    adapter.sendMessage = (request) => {
      spawns++
      return sendMessage(request)
    }
    const runtime = new SessionRuntime(adapter)
    const timer = setTimeout(() => runtime.close(), 45_000)
    try {
      for (const effort of ['high', 'low', 'low']) {
        let completed = false
        for await (const event of runtime.send({
          sessionId: null,
          text: 'Local fixture turn.',
          cwd,
          model: 'claude-opus-5-5',
          effort,
          env,
          extensions: { skills: [], hooks: { normalized: {} } }
        })) {
          if (event.type === 'error') throw new Error(event.error.message)
          if (event.type === 'telemetry') completed = true
        }
        assert.equal(completed, true, 'Runtime frame did not complete')
        assert.equal(runtime.channelAlive, true, 'CLI channel was restarted or closed')
      }
      assert.deepEqual(
        requests.slice(start).map((request) => request.effort),
        ['high', 'low', 'low']
      )
      assert.equal(spawns, 1, 'Effort changes must reuse the same CLI channel')
    } finally {
      clearTimeout(timer)
      runtime.close()
    }
  })
  await run('D', 'Haiku ignores explicit effort', async () => {
    assert.equal((await oneTurn('claude-haiku-4-5', 'high')).effort, undefined)
  })
  for (const model of ['claude-opus-4-7[1m]', 'gw-opus-4.7[1m]']) {
    await run('E', model, async () => {
      const observed = await oneTurn(model)
      assert.equal(observed.model, model.replace('[1m]', ''))
      assert.ok(observed.beta.split(',').includes('context-1m-2025-08-07'))
    })
  }
} finally {
  await loader.close()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await writeFile(join(cwd, 'result.json'), JSON.stringify({ results }, null, 2))
  console.log(`Evidence: ${join(cwd, 'result.json')}`)
}
assert.ok(results.length > 0, 'No smoke cases ran')
process.exitCode = results.some((result) => !result.ok) ? 1 : 0
