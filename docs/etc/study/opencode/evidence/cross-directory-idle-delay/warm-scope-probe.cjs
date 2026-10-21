const { app, net } = require('electron')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { spawn, execFile } = require('node:child_process')
const { performance } = require('node:perf_hooks')
const { pathToFileURL } = require('node:url')
const { OpenCodeAdapter, OpenCodeServerPool } = require('./adapter-server.cjs')
app.setPath('userData', path.join(__dirname, 'electron-data'))
app.disableHardwareAcceleration()
const root = path.join(__dirname, 'isolated')
for (const name of ['config', 'cache', 'state', 'data', 'A', 'B'])
  fs.mkdirSync(path.join(root, name), { recursive: true })
const env = { OPENCODE_DISABLE_MODELS_FETCH: 'true', OPENCODE_DISABLE_PROJECT_CONFIG: 'true', OPENCODE_DISABLE_AUTOUPDATE: 'true' }
for (const name of ['CONFIG', 'CACHE', 'STATE', 'DATA']) env['XDG_' + name + '_HOME'] = path.join(root, name.toLowerCase())
const started = performance.now(), trace = [], lives = [], iterators = [], children = [], sessions = []
let server, pool, adapter, firstOwner = false, modelRequests = 0, finishing = false, ownerCount = 0
const allowMultiple = true
const singleServer = process.env.ORCA_PROBE_SINGLE_SERVER === '1'
const steps = [], scopes = []
const sockets = new Set()
const mark = (stage, data = {}) => {
  const value = { stage, ms: Math.round(performance.now() - started), ...data }
  trace.push(value); console.log(JSON.stringify(value))
}
function json(response, data, headers = {}) {
  response.writeHead(200, { 'content-type': 'application/json', ...headers })
  response.end(JSON.stringify(data))
}
async function read(request) {
  let body = ''; for await (const chunk of request) body += chunk
  return body ? JSON.parse(body) : undefined
}
async function frame(iterator, label) {
  const result = []
  for (;;) {
    const next = await iterator.next()
    if (next.done) break
    for (const event of next.value.events) {
      if (event.type === 'session.created' || event.type === 'session.updated') {
        if (event.sessionId && !sessions.some(x => x.id === event.sessionId))
          sessions.push({ id: event.sessionId, label })
      }
      if (event.type === 'error') mark(label + '-error', { code: event.error?.code })
      result.push(event.type)
    }
    if (next.value.events.some(event => event.type === 'turn.ended')) break
  }
  mark(label + '-frame', { ended: result.includes('turn.ended'), error: result.includes('error') })
  return result
}
async function finish(error) {
  if (finishing) return
  finishing = true; clearTimeout(deadline)
  if (error) mark('failed', { name: error.name, message: String(error.message).slice(0, 120) })
  for (const live of lives) live.close()
  await Promise.allSettled(iterators.map(iterator => iterator.return()))
  adapter?.close(); pool?.close()
  await Promise.all(children.filter(child => child.pid && child.exitCode == null).map(child =>
    new Promise(resolve => execFile(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, resolve))))
  for (const socket of sockets) socket.destroy()
  server?.close()
  const result = { cli: '1.17.19', electron: process.versions.electron, mode: singleServer ? 'research-shared-server' : 'production-per-directory-server', diskDependencies: 'already installed from prior isolated probes', pluginSetupDelayMs: 1200, steps, modelRequests, trace }
  fs.writeFileSync(path.join(__dirname, singleServer ? 'warm-shared-result.json' : 'warm-production-result.json'), JSON.stringify(result, null, 2))
  app.exit(error ? 1 : 0)
}
const deadline = setTimeout(() => void finish(new Error('probe-deadline')), 150000)
app.whenReady().then(async () => {
  server = http.createServer(async (request, response) => {
    try {
      if (request.url.startsWith('/plugin?')) {
        const url = new URL(request.url, 'http://localhost'), phase = url.searchParams.get('phase')
        const directory = url.searchParams.get('directory')
        mark('plugin-' + phase, { label: directory ? path.basename(directory) : undefined })
        if (phase === 'setup') await new Promise(resolve => setTimeout(resolve, 1200))
        json(response, {}); return
      }
      if (request.url === '/mcp') {
        if (request.method === 'POST') {
          const body = await read(request)
          if (body?.method === 'initialize') {
            if (firstOwner && !allowMultiple) { mark('B-mcp-http-blocked'); return }
            firstOwner = true; ownerCount++; mark(ownerCount === 1 ? 'A-mcp-initialize' : 'B-mcp-initialize')
            json(response, { jsonrpc: '2.0', id: body.id, result: { protocolVersion: body.params.protocolVersion, capabilities: { tools: {}, prompts: {} }, serverInfo: { name: 'controlled-single-client', version: '1' } } }, { 'mcp-session-id': 'owner-' + ownerCount })
            return
          }
          if (!body || body.id === undefined) { response.writeHead(202); response.end(); return }
          const result = body.method === 'tools/list' ? { tools: [] } : body.method === 'prompts/list' ? { prompts: [] } : {}
          json(response, { jsonrpc: '2.0', id: body.id, result }); return
        }
        if (request.method === 'DELETE') { response.writeHead(204); response.end(); return }
        if (String(request.headers['mcp-session-id'] ?? '').startsWith('owner-')) {
          response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }); response.write(': ready\n\n'); return
        }
        mark('B-mcp-sse-blocked'); return
      }
      if (request.url.startsWith('/model/')) {
        await read(request); modelRequests++; mark('model-request', { index: modelRequests })
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        const base = { id: 'controlled', object: 'chat.completion.chunk', created: 1, model: 'probe' }
        response.write('data: ' + JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: 'Controlled response' }, finish_reason: null }] }) + '\n\n')
        response.write('data: ' + JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }) + '\n\n')
        response.end('data: [DONE]\n\n'); return
      }
      response.writeHead(404); response.end()
    } catch { response.writeHead(500); response.end() }
  })
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  const pluginFile = path.join(__dirname, 'warm-scope-plugin.mjs')
  fs.writeFileSync(pluginFile, `const base = ${JSON.stringify(base)};\nawait fetch(base + '/plugin?phase=import');\nexport default async ({directory}) => {\n await fetch(base + '/plugin?phase=setup&directory=' + encodeURIComponent(directory));\n return { config: async () => { await fetch(base + '/plugin?phase=config&directory=' + encodeURIComponent(directory)); } };\n};\n`)
  const settings = {
    model: 'probe/probe', small_model: 'probe/probe', share: 'disabled',
    plugin: [pathToFileURL(pluginFile).href],
    provider: { probe: { npm: '@ai-sdk/openai-compatible', name: 'Local probe', options: { baseURL: base + '/model/v1', apiKey: 'disposable-local-key' }, models: { probe: { name: 'probe', limit: { context: 8192, output: 256 } } } } },
    mcp: { controlled: { type: 'remote', url: base + '/mcp', oauth: false } }
  }
  const fetchImpl = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url)
    const label = url.searchParams.get('directory')?.split(/[\\/]/).at(-1)
    mark('sdk-start', { label, method: request.method, route: url.pathname.replace(/\/session\/[^/]+/, '/session/<id>') })
    const response = await net.fetch(request, { bypassCustomProtocolHandlers: true })
    mark('sdk-response', { label, route: url.pathname.replace(/\/session\/[^/]+/, '/session/<id>'), status: response.status })
    return response
  }
  pool = new OpenCodeServerPool({ dataDirectory: root, preferences: () => undefined, fetchImpl,
    executable: () => path.resolve(__dirname, '../opencode-1.17.19/package/bin/opencode.exe'),
    spawnProcess: (...args) => { mark('spawn', { label: path.basename(args[2].cwd) }); const child = spawn(...args); children.push(child); return child }
  })
  // Research seam only: same server URL, SDK directory parameter still distinguishes A and B.
  const servers = singleServer ? { acquire: (config, env) => pool.acquire(config, env, path.join(root, 'A')), installed: () => pool.installed(), close: () => pool.close() } : pool
  adapter = new OpenCodeAdapter(servers, fetchImpl)
  const counters = () => ({ spawns: trace.filter(x => x.stage === 'spawn').length, globalEvents: trace.filter(x => x.stage === 'sdk-start' && x.route === '/global/event').length, configs: trace.filter(x => x.stage === 'sdk-start' && x.route === '/config').length, mcpConnections: ownerCount, pluginImports: trace.filter(x => x.stage === 'plugin-import').length, pluginSetups: trace.filter(x => x.stage === 'plugin-setup').length, pluginConfigHooks: trace.filter(x => x.stage === 'plugin-config').length })
  const run = async (step, scope, existingIndex) => {
    const before = counters(), began = performance.now(); mark('step-start', { step, label: scope })
    let live, iterator
    if (existingIndex === undefined) {
      live = adapter.sendMessage({ sessionId: null, cwd: path.join(root, scope), text: 'Reply with a short greeting.', model: 'probe/probe', providerSettings: { key: 'probe', settings }, env, extensions: { skills: [], hooks: { normalized: {} } } })
      lives.push(live); scopes.push(scope)
      iterator = live.eventBatches[Symbol.asyncIterator](); iterators.push(iterator)
    } else {
      live = lives[existingIndex]; iterator = iterators[existingIndex]
      await live.pushTurn({ text: 'Another short greeting.', model: 'probe/probe' })
    }
    const result = await frame(iterator, step)
    if (result.includes('error') || !result.includes('turn.ended')) throw Error(step + '-frame-failed')
    const after = counters(), delta = Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]]))
    steps.push({ step, scope, ms: Math.round(performance.now() - began), delta, total: after }); mark('step-result', steps.at(-1))
  }
  await run('A1-first', 'A')
  await run('A1-followup', 'A', 0)
  await run('A2-new-session', 'A')
  await run('B1-first-path', 'B')
  await run('B1-followup', 'B', 2)
  await run('B2-new-session', 'B')
  await run('A3-return-new-session', 'A')
  for (let index = 0; index < scopes.length; index++) if (scopes[index] === 'A') { lives[index].close(); await iterators[index].return() }
  mark('A-all-channels-closed-B-held')
  await run('A4-after-last-A-owner-close', 'A')
  await finish()
}).catch(error => void finish(error))
