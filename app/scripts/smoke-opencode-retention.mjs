// Explicit local-only CLI acceptance: isolated files, loopback model and MCP fixtures.
import { createServer as createViteServer } from 'vite'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import assert from 'node:assert/strict'

const source = resolve(process.env.ORCA_SMOKE_SOURCE || '.')
const baseline = process.argv.includes('--baseline')
const root = await mkdtemp(join(tmpdir(), 'orca-retention-cli-'))
const records = [],
  requests = [],
  children = [],
  versions = {}
const at = (event, data = {}) => {
  records.push({ at: new Date().toISOString(), event, ...data })
  console.log(JSON.stringify({ event, ...data }))
}
const loader = await createViteServer({
  root: source,
  configFile: false,
  logLevel: 'silent',
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true },
  plugins: [
    {
      name: 'smoke-electron',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'electron') return '\0smoke-electron'
      },
      load(id) {
        if (id === '\0smoke-electron')
          return 'export const app={isPackaged:false};export const BrowserWindow={getAllWindows:()=>[]};export const webContents={getAllWebContents:()=>[]};export const ipcMain={handle(){}};export const shell={};export const net={fetch:globalThis.fetch};'
      }
    }
  ]
})
const load = (path) => loader.ssrLoadModule(`/src/main/${path}.ts`)
const { OpenCodeServerPool } = await load('adapters/opencode/v1/server')
const { OpenCodeAdapter } = await load('adapters/opencode/v1/adapter')
const { createManagedMcpSource } = await load('features/extensions/common/mcp/managed-source')
const { ManagedMcpBridge } = await load('features/extensions/common/mcp/bridge')
const { createPluginBinding } = await load('app/deployment/plugins')
const { setRootLogger } = await load('infra/log/registry')
const logger = {
  debug: (event, data) => at(event, data),
  info() {
    /* debug events are the acceptance trace */
  },
  warn() {
    /* no raw diagnostic payloads in the trace */
  },
  error() {
    /* errors are reported by the scenario */
  },
  child: () => logger
}
setRootLogger(logger)
const answerRpc = (body) => ({
  jsonrpc: '2.0',
  id: body.id,
  result:
    body.method === 'initialize'
      ? {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: { name: 'retention-local', version: '1' }
        }
      : body.method === 'tools/list'
        ? {
            tools: [
              {
                name: 'ping',
                description: 'Local fixture',
                inputSchema: { type: 'object', properties: {} }
              }
            ]
          }
        : body.method === 'tools/call'
          ? { content: [{ type: 'text', text: 'local' }] }
          : {}
})
let modelGate
let modelCalls = 0,
  httpConnections = 0
const local = createServer(async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  let body = {}
  try {
    body = JSON.parse(Buffer.concat(chunks).toString())
  } catch {
    /* optional body */
  }
  if (req.url === '/mcp') {
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end()
      return
    }
    if (body.method === 'initialize') httpConnections++
    if (body.id === undefined) {
      res.writeHead(202)
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(answerRpc(body)))
    return
  }
  modelCalls++
  at('model.request', { count: modelCalls })
  if (modelGate) await modelGate
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  const chunk = (delta, finish_reason = null) => ({
    id: `local-${modelCalls}`,
    object: 'chat.completion.chunk',
    created: 1,
    model: 'model',
    choices: [{ index: 0, delta, finish_reason }]
  })
  res.write(
    `data: ${JSON.stringify(chunk({ role: 'assistant', content: 'Local retention response.' }))}\n\n`
  )
  res.write(`data: ${JSON.stringify(chunk({}, 'stop'))}\n\n`)
  res.end('data: [DONE]\n\n')
})
await new Promise((done) => local.listen(0, '127.0.0.1', done))
const address = `http://127.0.0.1:${local.address().port}`
const stdio = join(root, 'stdio.cjs')
await writeFile(
  stdio,
  String.raw`const fs=require('fs');fs.appendFileSync(${JSON.stringify(join(root, 'stdio-starts'))},'start\n');const reply=${answerRpc.toString()};require('readline').createInterface({input:process.stdin}).on('line',line=>{try{const body=JSON.parse(line);if(body.id!==undefined)process.stdout.write(JSON.stringify(reply(body))+'\n')}catch{}});`
)
const env = {
  HOME: join(root, 'home'),
  USERPROFILE: join(root, 'home'),
  XDG_CONFIG_HOME: join(root, 'config'),
  XDG_DATA_HOME: join(root, 'data'),
  XDG_CACHE_HOME: join(root, 'cache'),
  XDG_STATE_HOME: join(root, 'state'),
  OPENCODE_DISABLE_AUTOUPDATE: 'true',
  OPENCODE_DISABLE_MODELS_FETCH: 'true',
  OPENCODE_CONFIG: join(root, 'opencode.json')
}
await mkdir(env.HOME)
await writeFile(env.OPENCODE_CONFIG, JSON.stringify({ $schema: 'https://opencode.ai/config.json' }))
const cwd = join(root, 'project')
await mkdir(cwd)
const config = {
  provider: {
    fixture: {
      npm: '@ai-sdk/openai-compatible',
      name: 'Local fixture',
      options: { baseURL: `${address}/v1`, apiKey: 'local-fixture' },
      models: { model: { name: 'Local fixture', limit: { context: 8192, output: 1024 } } }
    }
  },
  model: 'fixture/model',
  small_model: 'fixture/model'
}
let enabled = true
const definitions = {
  stdio: { command: process.execPath, args: [stdio] },
  http: { type: 'http', url: `${address}/mcp` }
}
const plugin = createPluginBinding({
  auth: { authId: 'local-builtin', snapshot: () => ({ status: 'valid', credentialRevision: 1 }) },
  server: {
    descriptor: {
      id: 'local-builtin',
      connectorId: 'local-builtin',
      executionScope: 'application',
      tools: []
    },
    implementations: []
  },
  registry: {
    add() {
      /* fixture registry */
    },
    remove() {
      /* fixture registry */
    }
  }
})
const managed = createManagedMcpSource({
  users: () => (enabled ? definitions : {}),
  definitions: () => ({ definitions, desired: { stdio: enabled, http: enabled } }),
  resolver: () => () => undefined,
  plugins: () => [
    {
      identity: {
        kind: 'builtin',
        sourceId: 'local-builtin',
        name: 'Local builtin',
        mentionId: 'local-builtin'
      },
      server: plugin.server,
      authorized: () => true,
      credentialRevision: () => 1
    }
  ]
})
managed.refresh()
const bridge = new ManagedMcpBridge(managed)
const trackedFetch = async (input, init) => {
  const req = new Request(input, init)
  requests.push({ at: Date.now(), path: new URL(req.url).pathname, method: req.method })
  const response = await fetch(req)
  at('http', { path: new URL(req.url).pathname, status: response.status })
  if (new URL(req.url).pathname === '/mcp') {
    const payload = await response.clone().json()
    at('mcp.status', {
      entries: Object.fromEntries(Object.entries(payload).map(([id, entry]) => [id, entry.status]))
    })
  }
  return response
}
const pool = new OpenCodeServerPool({
  dataDirectory: root,
  preferences: () => undefined,
  fetchImpl: trackedFetch,
  readVersion: (bin) =>
    new Promise((done, reject) =>
      execFile(bin, ['--version'], { windowsHide: true, timeout: 15000 }, (error, text) => {
        if (error) reject(error)
        else {
          versions.cli = text.trim()
          done(text)
        }
      })
    ),
  spawnProcess: (...args) => {
    const child = spawn(...args)
    children.push(child)
    at('actual.spawn', { index: children.length })
    child.once('exit', () => at('actual.exit', { index: children.indexOf(child) + 1 }))
    return child
  }
})
const adapter = new OpenCodeAdapter(
  pool,
  trackedFetch,
  undefined,
  undefined,
  { global: () => ({}) },
  undefined,
  { snapshot: managed.snapshot, acquire: (snapshot) => bridge.acquire(snapshot) }
)
const providerSettings = {
  providerKey: 'fixture',
  provider: 'fixture',
  sourceRevision: 'local',
  settings: config
}
const prepare = () => adapter.prepareComposer({ cwd, env, providerSettings })
let service
if (!baseline) {
  const { ComposerPreparationService } = await load('app/composer-preparation-service')
  service = new ComposerPreparationService(async () => ({
    key: 'local-validated',
    acquire: prepare
  }))
}
const scope = {
  backend: 'opencode',
  sessionId: null,
  cwd,
  projectId: null,
  providerKey: null,
  agentKind: 'code'
}
async function catalog(owner) {
  if (service) {
    await Promise.all(
      ['agents', 'models', 'mcp'].map((part) =>
        service.owners('catalog').read(1, { owner, scope, part }, () => {})
      )
    )
    await service.owners('catalog').release(1, owner)
  } else {
    const lease = await prepare()
    try {
      await Promise.all(
        ['agents', 'models', 'mcp'].map((part) => lease.read(part, AbortSignal.timeout(120000)))
      )
    } finally {
      await lease.release()
    }
  }
}
const stages = []
const childExited = (child) => child.exitCode !== null || child.signalCode !== null
async function waitUntil(predicate, message, timeout = 15000) {
  const expires = Date.now() + timeout
  while (!predicate()) {
    assert.ok(Date.now() < expires, message)
    await delay(25)
  }
}
async function stage(name, action) {
  at(`stage.${name}.start`)
  await action()
  await delay(80)
  const row = {
    stage: name,
    timestamp: new Date().toISOString(),
    spawned: children.length,
    exited: children.filter(childExited).length,
    requests: requests.length,
    mcpStatus: requests.filter((r) => r.path === '/mcp').length,
    modelCalls,
    httpConnections,
    instanceAttachments: records.filter((r) => r.event === 'opencode.retention.instance.attach')
      .length,
    instanceIds: new Set(
      records.filter((r) => r.event === 'opencode.retention.instance.attach').map((r) => r.instance)
    ).size,
    disposals: requests.filter((r) => r.path === '/instance/dispose').length,
    bridges: baseline ? null : records.filter((r) => r.event === 'managed-mcp.bridge.open').length
  }
  stages.push(row)
  console.log(JSON.stringify(row))
}
let live, iterator
let turnInFlight = false
adapter.configureResourceActivity?.(() => !turnInFlight)
async function finishTurn() {
  for (;;) {
    const next = await iterator.next()
    if (next.done) throw new Error('channel ended')
    const error = next.value.events.find((event) => event.type === 'error')
    if (error) throw new Error(error.error?.message || 'turn failed')
    if (next.value.events.some((event) => event.type === 'turn.ended')) {
      turnInFlight = false
      return
    }
  }
}
const deadline = setTimeout(() => {
  adapter.close()
  local.closeAllConnections()
}, 240000)
try {
  await stage('boot', async () => {
    if (baseline) return
    const { OpenCodeWarmup } = await load('app/opencode-warmup')
    const warmup = new OpenCodeWarmup({
      service,
      allowed: () => true,
      settings: () => ({ lastBackend: 'opencode', lastCwd: cwd }),
      cwd: () => cwd,
      installed: () => adapter.isInstalled()
    })
    warmup.update()
    await waitUntil(
      () => records.some((record) => record.event === 'composer.owner.detach'),
      'Warmup did not release its owner',
      60000
    )
    warmup.close()
    assert.equal(modelCalls, 0)
    for (const path of ['/agent', '/provider', '/mcp'])
      assert.ok(requests.some((request) => request.path === path))
    // Warmup now releases its observation before independent additive connections settle.
    await waitUntil(
      () =>
        Object.values(records.findLast((record) => record.event === 'mcp.status')?.entries ?? {})
          .length === 3 &&
        Object.values(records.findLast((record) => record.event === 'mcp.status').entries).every(
          (status) => status === 'connected'
        ),
      'Initial MCP attempts did not settle connected',
      60000
    )
    assert.deepEqual(
      Object.values(records.findLast((record) => record.event === 'mcp.status').entries),
      ['connected', 'connected', 'connected']
    )
    assert.equal(requests.filter((request) => request.path.startsWith('/session')).length, 0)
  })
  await stage('landing', () => catalog('landing'))
  await stage('navigation-return', () => catalog('return'))
  await stage('first-send', async () => {
    live = adapter.sendMessage({
      sessionId: null,
      cwd,
      env,
      providerSettings,
      model: 'fixture/model',
      text: 'Say local.',
      extensions: { skills: [], hooks: { normalized: {} }, managedMcp: managed.snapshot() }
    })
    iterator = live.eventBatches[Symbol.asyncIterator]()
    await finishTurn()
  })
  await stage('second-send', async () => {
    await live.pushTurn({ text: 'Say local again.' })
    await finishTurn()
  })
  await stage('idle-toggle', async () => {
    enabled = false
    managed.refresh()
    await adapter.reconcileConnections?.()
    enabled = true
    managed.refresh()
    await adapter.reconcileConnections?.()
  })
  await stage('busy-toggle', async () => {
    let resume
    modelGate = new Promise((done) => {
      resume = done
    })
    const count = modelCalls
    await live.pushTurn({ text: 'Delayed local reply.' })
    const result = finishTurn()
    while (modelCalls === count) await delay(20)
    turnInFlight = true
    const changes = requests.filter((request) =>
      /\/(connect|disconnect)$/.test(request.path)
    ).length
    enabled = false
    managed.refresh()
    await adapter.reconcileConnections?.()
    assert.equal(
      requests.filter((request) => /\/(connect|disconnect)$/.test(request.path)).length,
      changes
    )
    resume()
    modelGate = undefined
    await result
    await adapter.reconcileConnections?.()
    enabled = true
    managed.refresh()
    await adapter.reconcileConnections?.()
  })
  await stage('idle-expiry', async () => {
    live.close()
    await iterator.return()
    live = undefined
    await delay(91_000)
  })
  await stage('return-after-expiry', () => catalog('expired'))
  await stage('quit', async () => {
    service?.close()
    adapter.close()
    await bridge.close()
    await waitUntil(() => children.every(childExited), 'Owned child remains after quit')
  })
  assert.ok(children.every(childExited), 'Owned child remains after quit')
  if (!baseline) {
    assert.equal(stages.find((r) => r.stage === 'second-send').spawned, 1)
    assert.equal(stages.find((r) => r.stage === 'return-after-expiry').spawned, 2)
  }
  const report = {
    baseline,
    versions,
    sdk: JSON.parse(
      await (
        await import('node:fs/promises')
      ).readFile('node_modules/@opencode-ai/sdk/package.json', 'utf8')
    ).version,
    scenario:
      'isolated main-process assembly; loopback model and stdio/http/builtin MCP; no renderer timing measurement',
    stages,
    records,
    requests
  }
  await writeFile(
    process.env.ORCA_SMOKE_REPORT || join(root, 'report.json'),
    JSON.stringify(report, null, 2)
  )
} finally {
  clearTimeout(deadline)
  live?.close()
  service?.close()
  adapter.close()
  await bridge.close()
  local.closeAllConnections()
  await new Promise((done) => local.close(done))
  await loader.close()
}
