// Opt-in context-usage checks through SessionRuntime, the real adapter, and the bundled CLI.
// Model responses come only from a loopback fixture; evidence is written under the OS temp folder.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

const selected = process.argv.find((arg) => arg.startsWith('--case='))?.slice(7)
if (selected && !['A', 'B', 'C', 'D'].includes(selected)) {
  throw new Error('Expected --case=A|B|C|D')
}

const MODEL = 'qwen3.8-27b'
const root = join(tmpdir(), 'orcinus-orca')
await mkdir(root, { recursive: true })
const evidenceDir = await mkdtemp(join(root, 'context-usage-smoke-'))
const results = []
const loader = await createViteServer({
  root: join(dirname(fileURLToPath(import.meta.url)), '..'),
  configFile: false,
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true }
})

function fixtureServer(mode, cwd) {
  const requests = []
  const errors = []
  let countTokensCalls = 0
  const server = createServer(async (req, res) => {
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const raw = Buffer.concat(chunks).toString()
      if (req.url?.includes('count_tokens')) {
        countTokensCalls++
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            type: 'error',
            error: { type: 'not_found_error', message: 'count_tokens unsupported' }
          })
        )
        return
      }
      if (!req.url?.split('?')[0].endsWith('/messages')) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{}')
        return
      }
      const body = JSON.parse(raw)
      const inputTokens = Math.ceil(raw.length / 4)
      const messages = body.messages ?? []
      const blocksOf = (message) =>
        Array.isArray(message?.content)
          ? message.content
          : [{ type: 'text', text: String(message?.content ?? '') }]
      // CLI reminders can follow the instruction, so search all user text blocks.
      const markerAt = messages.findLastIndex(
        (message) =>
          message.role === 'user' &&
          blocksOf(message).some(
            (block) => block?.type === 'text' && block.text.includes('READ_FIXTURE_FILE')
          )
      )
      const answered = messages
        .slice(markerAt + 1)
        .some((message) => blocksOf(message).some((block) => block?.type === 'tool_result'))
      const wantsTool =
        markerAt >= 0 && !answered && (body.tools ?? []).some((tool) => tool.name === 'Read')
      const n = requests.length + 1
      const block = wantsTool
        ? {
            type: 'tool_use',
            id: `toolu_fixture_${n}`,
            name: 'Read',
            input: { file_path: join(cwd, 'notes.txt') }
          }
        : { type: 'text', text: `Local context fixture reply ${n}.` }
      const outputTokens = 12
      requests.push({
        n,
        model: body.model,
        stream: body.stream === true,
        tools: (body.tools ?? []).length,
        messages: messages.length,
        trueInputTokens: inputTokens,
        kind: wantsTool ? 'tool_use' : 'text'
      })
      const startUsage =
        mode === 'p1'
          ? {
              input_tokens: inputTokens,
              output_tokens: 1,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0
            }
          : { input_tokens: 0, output_tokens: 0 }
      const deltaUsage =
        mode === 'p1'
          ? { output_tokens: outputTokens }
          : mode === 'delta'
            ? { input_tokens: inputTokens, output_tokens: outputTokens }
            : { output_tokens: 0 }
      const message = {
        id: `fixture_${n}`,
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [block],
        stop_reason: wantsTool ? 'tool_use' : 'end_turn',
        stop_sequence: null
      }
      if (body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        const emit = (event, data) =>
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        emit('message_start', {
          type: 'message_start',
          message: { ...message, content: [], stop_reason: null, usage: startUsage }
        })
        emit('content_block_start', {
          type: 'content_block_start',
          index: 0,
          content_block:
            block.type === 'tool_use'
              ? { type: 'tool_use', id: block.id, name: block.name, input: {} }
              : { type: 'text', text: '' }
        })
        emit('content_block_delta', {
          type: 'content_block_delta',
          index: 0,
          delta:
            block.type === 'tool_use'
              ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) }
              : { type: 'text_delta', text: block.text }
        })
        emit('content_block_stop', { type: 'content_block_stop', index: 0 })
        emit('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: message.stop_reason, stop_sequence: null },
          usage: deltaUsage
        })
        emit('message_stop', { type: 'message_stop' })
        res.end()
      } else {
        const usage =
          mode === 'none'
            ? { input_tokens: 0, output_tokens: 0 }
            : { input_tokens: inputTokens, output_tokens: outputTokens }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ...message, usage }))
      }
    } catch (error) {
      errors.push(String(error))
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'Local context fixture failed' }))
    }
  })
  return { server, requests, errors, countTokensCalls: () => countTokensCalls }
}

function fixtureEnv(cwd, port, extraEnv) {
  const env = { ...process.env }
  // Retain OS launch inputs while isolating model/auth/settings from the host.
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC_|CLAUDE_CODE_|CLAUDE_AUTOCOMPACT)/.test(key)) delete env[key]
  }
  return {
    ...env,
    HOME: cwd,
    USERPROFILE: cwd,
    CLAUDE_CONFIG_DIR: join(cwd, '.claude'),
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
    ANTHROPIC_API_KEY: 'local-fixture',
    ANTHROPIC_AUTH_TOKEN: 'local-fixture',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_TMPDIR: root,
    ...extraEnv
  }
}

try {
  const { ClaudeAdapter } = await loader.ssrLoadModule('/src/main/adapters/claude.ts')
  const { SessionRuntime } = await loader.ssrLoadModule(
    '/src/main/features/sessions/session-runtime.ts'
  )
  const { primaryModelScore } = await loader.ssrLoadModule('/src/shared/usage/primary-model.ts')
  const cases = [
    { group: 'A', mode: 'delta', window: 200_000 },
    { group: 'B', mode: 'p1', window: 200_000 },
    { group: 'C', mode: 'none', window: 200_000 },
    {
      group: 'D',
      mode: 'delta',
      window: 262_144,
      extraEnv: { CLAUDE_CODE_MAX_CONTEXT_TOKENS: '262144' },
      short: true
    }
  ]
  for (const spec of cases) {
    if (selected && selected !== spec.group) continue
    const cwd = join(evidenceDir, spec.group)
    await mkdir(cwd, { recursive: true })
    await writeFile(join(cwd, 'notes.txt'), 'Local context usage fixture line.\n'.repeat(200))
    const fixture = fixtureServer(spec.mode, cwd)
    await new Promise((resolve) => fixture.server.listen(0, '127.0.0.1', resolve))
    const env = fixtureEnv(cwd, fixture.server.address().port, spec.extraEnv)
    const adapter = new ClaudeAdapter()
    const sendMessage = adapter.sendMessage.bind(adapter)
    let spawns = 0
    adapter.sendMessage = (request) => {
      spawns++
      return sendMessage(request)
    }
    const runtime = new SessionRuntime(adapter)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      runtime.close()
    }, 90_000)
    const result = { group: spec.group, mode: spec.mode, ok: false, turns: [] }
    results.push(result)
    try {
      const texts = spec.short
        ? ['Plain local fixture reply please.']
        : [
            'READ_FIXTURE_FILE notes.txt then answer.',
            'Second turn, plain local fixture reply.',
            '/context'
          ]
      for (const [index, text] of texts.entries()) {
        const requestStart = fixture.requests.length
        const usages = []
        const eventTypes = []
        for await (const event of runtime.send({
          sessionId: null,
          text,
          cwd,
          model: MODEL,
          env,
          extensions: { skills: [], hooks: { normalized: {} } }
        })) {
          eventTypes.push(event.type)
          if (event.type === 'error') throw new Error(event.error.message)
          if (event.type === 'telemetry') usages.push(event.usage)
        }
        const requests = fixture.requests.slice(requestStart)
        const mainRequests = requests.filter((request) => request.tools > 0)
        const usage = usages[0]
        const contextTokens = usage ? primaryModelScore(usage) : null
        const expectedContextTokens =
          text === '/context' || spec.mode === 'none'
            ? 0
            : (mainRequests.at(-1)?.trueInputTokens ?? null)
        result.turns.push({
          text,
          requests,
          eventTypes,
          telemetry: usage,
          contextTokens,
          expectedContextTokens
        })
        assert.equal(timedOut, false, `${spec.group}: CLI runtime timed out`)
        assert.deepEqual(fixture.errors, [], `${spec.group}: fixture errors`)
        assert.equal(usages.length, 1, `${spec.group} turn ${index + 1}: telemetry frame`)
        assert.equal(runtime.channelAlive, true, `${spec.group}: CLI channel closed`)
        if (text !== '/context') {
          assert.ok(mainRequests.length > 0, `${spec.group}: no main model request`)
          assert.ok(
            mainRequests.every((request) => request.stream),
            `${spec.group}: usage must traverse the SSE stream`
          )
          assert.equal(usage?.contextWindow, spec.window, `${spec.group}: CLI context window`)
          if (!spec.short && index === 0) {
            assert.ok(mainRequests.length >= 2, `${spec.group}: expected a tool loop`)
            assert.equal(mainRequests[0].kind, 'tool_use', `${spec.group}: Read tool request`)
            assert.equal(mainRequests.at(-1)?.kind, 'text', `${spec.group}: tool loop completed`)
            assert.ok(eventTypes.includes('tool.call.completed'), `${spec.group}: Read tool result`)
          }
        }
        assert.equal(
          contextTokens,
          expectedContextTokens,
          `${spec.group} turn ${index + 1}: last main request context`
        )
      }
      assert.equal(spawns, 1, `${spec.group}: turns must reuse one CLI channel`)
      result.ok = true
    } catch (error) {
      result.error = String(error)
    } finally {
      clearTimeout(timer)
      runtime.close()
      fixture.server.closeAllConnections()
      await new Promise((resolve) => fixture.server.close(resolve))
      result.spawns = spawns
      result.countTokensCalls = fixture.countTokensCalls()
      result.fixtureErrors = fixture.errors
      console.log(JSON.stringify(result))
    }
  }
} finally {
  await loader.close()
  const evidenceFile = join(evidenceDir, 'result.json')
  await writeFile(
    evidenceFile,
    JSON.stringify({ model: MODEL, generatedAt: new Date().toISOString(), results }, null, 2) + '\n'
  )
  console.log(`Evidence: ${evidenceFile}`)
}
assert.ok(results.length > 0, 'No smoke cases ran')
process.exitCode = results.some((result) => !result.ok) ? 1 : 0
