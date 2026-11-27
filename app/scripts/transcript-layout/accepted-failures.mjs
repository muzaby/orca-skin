// Feed the Electron probe from the Claude/OpenCode CLIs and both production host ports.
// Production owns the user, assistant and failure IDs, the database write and the history cursor.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { configureOpenCode, finishOpenCode } from './opencode-model.mjs'
import { bootPair } from '../smoke-host-pair.mjs'
import { scaleMs } from '../test-time.mjs'

const question = 'Layout question'
const failureMessage = 'Layout response failure'
const success = 'Layout response recovered'

function finish(res) {
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  const emit = (type, fields) =>
    res.write('event: ' + type + '\ndata: ' + JSON.stringify({ type, ...fields }) + '\n\n')
  emit('message_start', {
    message: {
      id: 'msg_' + randomUUID(),
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 0 }
    }
  })
  emit('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
  emit('content_block_delta', { index: 0, delta: { type: 'text_delta', text: success } })
  emit('content_block_stop', { index: 0 })
  emit('message_delta', {
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: 4 }
  })
  emit('message_stop', {})
  res.end()
}

async function capture(root, out, screen) {
  const [backend, agentKind] = screen.split('-')
  const opencode = backend === 'opencode'
  let replies = 0
  let failing = true
  let detail = failureMessage
  const requested = Promise.withResolvers()
  const allowError = Promise.withResolvers()
  const api = createServer(async (req, res) => {
    if (
      !req.url?.startsWith(opencode ? '/v1/chat/completions' : '/v1/messages') ||
      req.url.includes('count_tokens')
    ) {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"input_tokens":1}')
      return
    }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())
    if (
      (opencode ? body.tools?.length : body.tools?.some((tool) => tool.name === 'Read')) &&
      JSON.stringify(body.messages).includes(question)
    ) {
      replies++
      if (failing) {
        if (opencode) {
          requested.resolve()
          await allowError.promise
        }
        res.writeHead(opencode ? 403 : 400, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            type: 'error',
            error: { type: 'invalid_request_error', message: detail }
          })
        )
        return
      }
    }
    if (opencode) finishOpenCode(res, body, success)
    else finish(res)
  })
  api.listen(0, '127.0.0.1')
  await once(api, 'listening')
  let pair
  try {
    const cwd = join(root, 'project')
    await mkdir(cwd)
    const base = 'http://127.0.0.1:' + api.address().port
    if (opencode) await configureOpenCode(root, base, cwd)
    else {
      const env = {
        ANTHROPIC_BASE_URL: base,
        ANTHROPIC_API_KEY: 'layout-local-fixture',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        ENABLE_TOOL_SEARCH: 'false'
      }
      Object.assign(process.env, env)
      const settings = join(
        process.env.HOME,
        '.config',
        'orcinus-orca',
        'sources',
        'settings',
        'claude',
        'fixture',
        'settings.json'
      )
      await mkdir(dirname(settings), { recursive: true })
      await writeFile(settings, JSON.stringify({ env }))
    }
    pair = await bootPair(out, root)
    if (opencode) await pair.invoke('agent', 'oo:harness:recheck', { backend })
    let sessionId = null
    let requestId = 0
    const page = async (query) => {
      const reply = await pair.invoke('data', 'oo:session:history-page', {
        ...query,
        sessionId,
        requestId: ++requestId,
        openGeneration: 1
      })
      assert.equal(reply.status, 'ok', JSON.stringify(reply))
      return reply
    }
    const steps = []
    let initial
    const initialTurns = opencode ? 0 : 3
    const totalTurns = opencode ? 3 : 7
    for (let n = 1; n <= totalTurns; n++) {
      // Exercise restored OpenCode history on the next successful input. The Claude cases
      // retain the live CLI across all six failures and that successful turn.
      if (opencode && n === 2) {
        await pair.close()
        pair = await bootPair(out, root)
        await pair.invoke('agent', 'oo:harness:recheck', { backend })
      }
      const before = pair.received.length
      const requests = replies
      failing = opencode ? n !== 2 : n <= 6
      detail = failureMessage + ' ' + (n <= 2 ? '01' : '0' + n)
      const text = failing ? question : question + ' success'
      const send = pair.invoke('agent', 'oo:chat:send', {
        sessionId,
        backend,
        agentKind,
        cwd,
        projectId: null,
        text,
        providerKey: backend + '-fixture',
        modelFamily: opencode ? 'fixture/local' : 'claude-sonnet-4-6',
        permissionMode: 'bypass',
        clientKey: 'accepted-' + n,
        clientRequestId: 'accepted-' + n
      })
      if (opencode && n === 1) {
        try {
          await Promise.race([
            requested.promise,
            send.then(() => {
              throw Error('model not reached')
            })
          ])
          const rows = await pair.invoke('data', 'oo:session:list')
          assert.equal(
            rows.length,
            1,
            JSON.stringify({ rows, events: pair.received.slice(before) })
          )
          sessionId = rows[0].id
          initial = (await page({ kind: 'latest' })).session
          assert.ok(
            initial.messages.every((msg) => !msg.parts.some((part) => part.type === 'error'))
          )
        } finally {
          allowError.resolve()
        }
      }
      await send
      const events = pair.received.slice(before)
      const commits = events.filter((ev) => ev.type === 'message.committed' && ev.text === text)
      assert.equal(commits.length, 1, JSON.stringify(events))
      const commit = commits[0]
      assert.equal(commit.sessionId, sessionId ?? commit.sessionId)
      assert.equal(commit.messageKey, 'u:accepted-' + n)
      sessionId = commit.sessionId
      assert.ok(replies > requests, 'user request did not reach the local model')
      const faults = events.filter((ev) => ev.type === 'error')
      assert.equal(faults.length, failing ? 1 : 0, JSON.stringify(events))
      const fault = faults[0]
      if (failing) {
        assert.ok(fault.failure?.failureId, JSON.stringify(events))
        assert.equal(fault.failure.ownerUserMessageKey, commit.messageKey)
        assert.equal(fault.messageKey, fault.failure.assistantMessageKey)
        if (agentKind === 'work') {
          const boundary = events.find(
            (ev) =>
              ev.type === 'response.boundary' &&
              ev.boundary.phase === 'end' &&
              ev.boundary.outcome === 'failed'
          )
          assert.ok(boundary, 'Work failure did not close the response')
          assert.equal(fault.failure.responseBoundaryId, boundary.boundary.id)
        }
        assert.equal(
          fault.error.category,
          opencode ? 'permission_denied' : 'stream_error',
          JSON.stringify(fault)
        )
        assert.ok(fault.error.message.includes(opencode ? '(403)' : detail), JSON.stringify(fault))
      }
      steps.push({ text, owner: commit.messageKey, fault, events })
      if (n === initialTurns) initial = (await page({ kind: 'latest' })).session
    }
    assert.equal(
      new Set(steps.filter((s) => s.fault).map((s) => s.fault.failure.failureId)).size,
      opencode ? 2 : 6
    )
    assert.equal(new Set(steps.map((s) => s.owner)).size, totalTurns)
    await pair.close()
    pair = await bootPair(out, root)
    const reopened = (await page({ kind: 'latest' })).session
    assert.equal(
      reopened.messages.filter((msg) => msg.role === 'user').length,
      Math.min(totalTurns, 5)
    )
    const before = []
    let edge = reopened.history.before
    if (totalTurns > 5) assert.ok(edge, 'seven turns should have an earlier page')
    while (edge) {
      assert.ok(!before.some((p) => p.cursor === edge.cursor), 'repeated history cursor')
      const reply = await page({
        kind: edge.kind,
        cursor: edge.cursor,
        ...(edge.kind === 'withinTurn' ? { direction: 'before' } : {})
      })
      before.push({ cursor: edge.cursor, reply })
      edge = reply.session.history.before
    }
    return { id: sessionId, initial, reopened, before, steps, initialTurns, success }
  } finally {
    await pair?.close()
    api.closeAllConnections()
    await new Promise((done) => api.close(done))
  }
}

export async function acceptedFailures() {
  const root = await mkdtemp(join(tmpdir(), 'oo-layout-failures-'))
  const cache = resolve('node_modules/.cache')
  await mkdir(cache, { recursive: true })
  const out = await mkdtemp(join(cache, 'oo-layout-hosts-'))
  try {
    const { build } = await import('vite')
    const { resolveConfig } = await import('electron-vite')
    const config = (await resolveConfig({}, 'build', 'production')).config.main
    config.build.outDir = out
    await build({ ...config, logLevel: 'warn' })
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !/^(CLAUDE|ANTHROPIC|OPENCODE|ORCINUS_ORCA_PROVIDER)/i.test(key)
      )
    )
    const scopes = {}
    for (const screen of ['claude-code', 'claude-work', 'opencode-code']) {
      const scope = join(root, screen)
      await mkdir(scope)
      const home = join(scope, 'home')
      const env = {
        ...inherited,
        HOME: home,
        USERPROFILE: home,
        CLAUDE_CONFIG_DIR: join(home, '.claude'),
        XDG_CONFIG_HOME: join(scope, 'config'),
        XDG_DATA_HOME: join(scope, 'data'),
        XDG_CACHE_HOME: join(scope, 'cache'),
        XDG_STATE_HOME: join(scope, 'state')
      }
      await promisify(execFile)(
        process.execPath,
        [fileURLToPath(import.meta.url), '--capture', scope, out, screen],
        {
          env,
          timeout: scaleMs(180_000),
          maxBuffer: 8 * 1024 * 1024
        }
      )
      scopes[screen] = JSON.parse(await readFile(join(scope, 'fixture.json'), 'utf8'))
    }
    return scopes
  } finally {
    await Promise.all(
      [root, out].map((dir) =>
        rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 })
      )
    )
  }
}

if (process.argv[2] === '--capture') {
  const fixture = await capture(process.argv[3], process.argv[4], process.argv[5])
  await writeFile(join(process.argv[3], 'fixture.json'), JSON.stringify(fixture))
}
