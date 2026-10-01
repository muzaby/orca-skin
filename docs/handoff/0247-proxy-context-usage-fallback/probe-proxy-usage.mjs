// 설계 증거(0247): 번들 CLI를 프록시 모형(루프백)에 붙여 usage 결손 환경의 컨텍스트 신호를 관측한다.
// 외부 모델 호출 없음. 실행: `node docs/handoff/0247-proxy-context-usage-fallback/probe-proxy-usage.mjs`
// getContextUsage·/context·JSONL 관측은 채택하지 않은 경로(plan D-002·D-005)의 판단 근거로만 남긴다.
// 구현 검증용 실 CLI smoke 는 plan §11 의 app/scripts/smoke-context-usage-sdk.mjs 다.
//
// usage 형태 3종을 모형한다.
//   p1    — 1P 형: message_start 에 input, message_delta 에 output 만
//   delta — usage 를 message_delta 에만 싣는 프록시(LiteLLM·OpenRouter 류): message_start 는 0/0
//   none  — usage 를 전혀 싣지 않는 프록시: message_start 0/0, message_delta output 0
// 모형 서버의 "실제 입력 토큰"은 요청 본문 길이/4 로 정한다 — 대화가 자랄수록 커지는 결정적 값이다.
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '../../../app')
const require = createRequire(join(appDir, 'package.json'))
const { query } = await import(pathToFileURL(require.resolve('@anthropic-ai/claude-agent-sdk')).href)
const sdkVersion = JSON.parse(
  await readFile(join(dirname(require.resolve('@anthropic-ai/claude-agent-sdk')), 'package.json'), 'utf8')
).version
const { createServer: createViteServer } = await import(
  pathToFileURL(join(appDir, 'node_modules/vite/dist/node/index.js')).href
)

const MODEL = 'qwen3.8-27b'
const root = join(tmpdir(), 'orcinus-orca')
await mkdir(root, { recursive: true })

const pickUsage = (u) =>
  u && typeof u === 'object'
    ? Object.fromEntries(
        ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']
          .filter((k) => k in u)
          .map((k) => [k, u[k]])
      )
    : u

function fixtureServer(mode, countTokensStatus) {
  const requests = []
  let countTokensCalls = 0
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString()
    let body = {}
    try {
      body = JSON.parse(raw)
    } catch {
      // health check
    }
    if (req.url?.includes('count_tokens')) {
      countTokensCalls++
      if (countTokensStatus !== 200) {
        res.writeHead(countTokensStatus, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'count_tokens unsupported' } }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ input_tokens: Math.ceil(raw.length / 4) }))
      return
    }
    if (!req.url?.split('?')[0].endsWith('/messages')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
      return
    }
    const inputTokens = Math.ceil(raw.length / 4)
    const messages = body.messages ?? []
    const blocksOf = (m) => (Array.isArray(m?.content) ? m.content : [{ type: 'text', text: String(m?.content ?? '') }])
    // 마지막 READ 지시 이후에 tool_result 가 없으면 도구를 부른다 — CLI 가 지시 뒤에 리마인더 블록을 덧붙여도 잡힌다.
    const markerAt = messages.findLastIndex(
      (m) => m.role === 'user' && blocksOf(m).some((b) => b?.type === 'text' && b.text.includes('READ_FIXTURE_FILE'))
    )
    const answered = messages.slice(markerAt + 1).some((m) => blocksOf(m).some((b) => b?.type === 'tool_result'))
    const wantsTool = markerAt >= 0 && !answered
    const n = requests.length + 1
    const block = wantsTool
      ? { type: 'tool_use', id: `toolu_fx_${n}`, name: 'Read', input: { file_path: join(server.cwd, 'notes.txt') } }
      : { type: 'text', text: `Fixture reply ${n}.` }
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
        ? { input_tokens: inputTokens, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
        : { input_tokens: 0, output_tokens: 0 }
    const deltaUsage =
      mode === 'p1'
        ? { output_tokens: outputTokens }
        : mode === 'delta'
          ? { input_tokens: inputTokens, output_tokens: outputTokens }
          : { output_tokens: 0 }
    const id = `fixture_${n}`
    if (body.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      emit('message_start', {
        type: 'message_start',
        message: { id, type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: startUsage }
      })
      if (block.type === 'tool_use') {
        emit('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} } })
        emit('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } })
      } else {
        emit('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
        emit('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: block.text } })
      }
      emit('content_block_stop', { type: 'content_block_stop', index: 0 })
      emit('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: wantsTool ? 'tool_use' : 'end_turn', stop_sequence: null },
        usage: deltaUsage
      })
      emit('message_stop', { type: 'message_stop' })
      res.end()
    } else {
      const usage = mode === 'none' ? { input_tokens: 0, output_tokens: 0 } : { input_tokens: inputTokens, output_tokens: outputTokens }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id, type: 'message', role: 'assistant', model: body.model, content: [block], stop_reason: wantsTool ? 'tool_use' : 'end_turn', stop_sequence: null, usage }))
    }
  })
  return { server, requests, countTokens: () => countTokensCalls }
}

// 세션 트랜스크립트(JSONL)의 메인 체인 assistant usage — 사후 소스 비교용.
async function transcriptUsage(configDir, sessionId) {
  if (!sessionId) return null
  const { readdir } = await import('node:fs/promises')
  const projects = join(configDir, 'projects')
  const dirs = await readdir(projects).catch(() => [])
  for (const d of dirs) {
    const file = join(projects, d, `${sessionId}.jsonl`)
    const text = await readFile(file, 'utf8').catch(() => undefined)
    if (text === undefined) continue
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((e) => e.type === 'assistant' && !e.isSidechain && e.message?.usage)
      .map((e) => ({ id: e.message.id, usage: pickUsage(e.message.usage) }))
  }
  return null
}

function summarizeContextUsage(cu) {
  if (!cu || typeof cu !== 'object') return cu
  if ('error' in cu) return cu
  return {
    totalTokens: cu.totalTokens,
    maxTokens: cu.maxTokens,
    rawMaxTokens: cu.rawMaxTokens,
    percentage: cu.percentage,
    model: cu.model,
    categories: (cu.categories ?? []).map((c) => ({ name: c.name, kind: c.kind, tokens: c.tokens }))
  }
}

async function runMode(label, mode, { countTokensStatus = 404, extraEnv = {}, turns }) {
  const cwd = await mkdtemp(join(root, `ctx-probe-${label}-`))
  await writeFile(join(cwd, 'notes.txt'), 'fixture line for the context probe\n'.repeat(200))
  const fx = fixtureServer(mode, countTokensStatus)
  fx.server.cwd = cwd
  await new Promise((r) => fx.server.listen(0, '127.0.0.1', r))
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC_|CLAUDE_CODE_|CLAUDE_AUTOCOMPACT)/.test(key)) delete env[key]
  }
  Object.assign(env, {
    HOME: cwd,
    USERPROFILE: cwd,
    CLAUDE_CONFIG_DIR: join(cwd, '.claude'),
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${fx.server.address().port}`,
    ANTHROPIC_AUTH_TOKEN: 'local-fixture',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_TMPDIR: root,
    ...extraEnv
  })
  const queue = []
  let wake
  async function* input() {
    for (;;) {
      while (queue.length > 0) yield queue.shift()
      await new Promise((r) => (wake = r))
    }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  const q = query({
    prompt: input(),
    options: {
      cwd,
      model: MODEL,
      env,
      settingSources: [],
      // Orca 와 같이 세션을 영속한다 — 트랜스크립트(JSONL)의 usage 를 함께 관측한다.
      includePartialMessages: true,
      allowedTools: ['Read'],
      abortController: controller
    }
  })
  const it = q[Symbol.asyncIterator]()
  const out = { label, mode, extraEnv, countTokensStatus, turns: [] }
  try {
    for (const spec of turns) {
      const requestStart = fx.requests.length
      queue.push({ type: 'user', message: { role: 'user', content: spec.text }, parent_tool_use_id: null, session_id: '' })
      wake?.()
      const sdkMessages = []
      const turn = { text: spec.text, assistantUsage: [], messageStart: [], messageDelta: [], contextUsageTwin: null, result: null }
      for (;;) {
        const { value: m, done } = await it.next()
        if (done) throw new Error('stream ended before result')
        sdkMessages.push(m)
        if (typeof m.session_id === 'string' && m.session_id !== '') out.sessionId = m.session_id
        const main = m.parent_tool_use_id == null
        if (m.type === 'assistant' && main) {
          turn.assistantUsage.push(pickUsage(m.message?.usage))
          if (m.context_usage) {
            turn.contextUsageTwin = {
              total_tokens: m.context_usage.total_tokens,
              raw_max_tokens: m.context_usage.raw_max_tokens,
              percentage: m.context_usage.percentage
            }
          }
        }
        if (m.type === 'system' && m.subtype !== 'init') {
          const text = JSON.stringify(m)
          ;(turn.systemNotices ??= []).push({ subtype: m.subtype, mentionsWindow: /context window|MAX_CONTEXT_TOKENS/i.test(text), text: text.slice(0, 600) })
        }
        if (m.type === 'stream_event' && main) {
          if (m.event?.type === 'message_start') turn.messageStart.push(pickUsage(m.event.message?.usage))
          if (m.event?.type === 'message_delta') turn.messageDelta.push(pickUsage(m.event.usage))
        }
        if (m.type === 'result') {
          turn.result = {
            subtype: m.subtype,
            usage: pickUsage(m.usage),
            modelUsage: Object.fromEntries(
              Object.entries(m.modelUsage ?? {}).map(([k, v]) => [
                k,
                { inputTokens: v.inputTokens, outputTokens: v.outputTokens, contextWindow: v.contextWindow, costUSD: v.costUSD }
              ])
            )
          }
          break
        }
      }
      turn.fixtureRequests = fx.requests.slice(requestStart)
      turn.sdkMessages = sdkMessages
      turn.transcriptAssistantUsage = await transcriptUsage(join(cwd, '.claude'), out.sessionId)
      if (spec.contextUsage) {
        for (const detail of spec.contextUsage) {
          const before = fx.countTokens()
          const started = Date.now()
          const cu = await q.getContextUsage({ detail }).catch((e) => ({ error: String(e) }))
          turn[`getContextUsage_${detail}`] = {
            ...summarizeContextUsage(cu),
            elapsedMs: Date.now() - started,
            countTokensCalls: fx.countTokens() - before
          }
        }
      }
      out.turns.push(turn)
    }
  } finally {
    clearTimeout(timer)
    q.close()
    fx.server.closeAllConnections()
    await new Promise((r) => fx.server.close(r))
  }
  return out
}

// Orca 의 현재 매퍼로 같은 SDK 메시지를 정규화해 AS-IS 도넛 분자를 재현한다.
const loader = await createViteServer({
  root: appDir,
  configFile: false,
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true }
})
const evidence = { sdkVersion, model: MODEL, generatedAt: new Date().toISOString(), runs: [] }
try {
  const { claudeToNormalized } = await loader.ssrLoadModule('/src/main/adapters/claude-map.ts')
  const plan = [
    { label: 'p1', mode: 'p1', countTokensStatus: 200 },
    { label: 'delta', mode: 'delta' },
    { label: 'delta-ct200', mode: 'delta', countTokensStatus: 200 },
    { label: 'none', mode: 'none' },
    { label: 'none-ct200', mode: 'none', countTokensStatus: 200 },
    { label: 'delta-acw150k', mode: 'delta', extraEnv: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '150000' }, short: true },
    { label: 'delta-max262k', mode: 'delta', extraEnv: { CLAUDE_CODE_MAX_CONTEXT_TOKENS: '262144' }, short: true }
  ]
  for (const p of plan) {
    const turns = p.short
      ? [{ text: 'Plain reply please.', contextUsage: ['summary'] }]
      : [
          { text: 'READ_FIXTURE_FILE notes.txt then answer.', contextUsage: ['summary'] },
          { text: 'Second turn, plain reply.', contextUsage: ['summary', 'full'] },
          { text: '/context' }
        ]
    const run = await runMode(p.label, p.mode, { countTokensStatus: p.countTokensStatus, extraEnv: p.extraEnv, turns })
    for (const turn of run.turns) {
      const ctx = { sessionId: 'probe', cwd: '' }
      const telemetry = turn.sdkMessages
        .flatMap((m) => claudeToNormalized(m, ctx))
        .find((e) => e.type === 'telemetry')?.usage
      const contextTokens = telemetry
        ? (telemetry.inputTokens ?? 0) + (telemetry.cacheReadTokens ?? 0) + (telemetry.cacheCreationTokens ?? 0)
        : null
      const mainRequests = turn.fixtureRequests.filter((r) => r.tools > 0)
      turn.asIs = {
        telemetryContext: telemetry
          ? { inputTokens: telemetry.inputTokens, cacheReadTokens: telemetry.cacheReadTokens, cacheCreationTokens: telemetry.cacheCreationTokens, contextWindow: telemetry.contextWindow, model: telemetry.model }
          : null,
        contextTokens,
        donutUpdates: contextTokens !== null && contextTokens > 0,
        lastMainRequestTrueInput: mainRequests.at(-1)?.trueInputTokens ?? null
      }
      delete turn.sdkMessages
    }
    evidence.runs.push(run)
    console.log(JSON.stringify({ label: p.label, turns: run.turns.map((t) => ({ text: t.text, reqs: t.fixtureRequests.map((r) => r.trueInputTokens), asIs: t.asIs.contextTokens, summary: t.getContextUsage_summary?.totalTokens, full: t.getContextUsage_full?.totalTokens ?? t.getContextUsage_full?.error, twin: t.contextUsageTwin?.total_tokens, deltas: t.messageDelta.map((d) => d.input_tokens), assistant: t.assistantUsage.map((a) => a?.input_tokens), resultIn: t.result?.usage?.input_tokens, jsonl: t.transcriptAssistantUsage?.map((x) => x.usage.input_tokens), cw: Object.values(t.result?.modelUsage ?? {})[0]?.contextWindow, rawMax: t.getContextUsage_summary?.rawMaxTokens, notices: (t.systemNotices ?? []).map((n) => `${n.subtype}${n.mentionsWindow ? '*' : ''}`) })) }))
  }
} finally {
  await loader.close()
}
const file = join(here, 'probe-evidence.json')
await writeFile(file, JSON.stringify(evidence, null, 2) + '\n')
console.log(`Evidence: ${file}`)
