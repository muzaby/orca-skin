const { app, net } = require('electron')
const { spawn, execFile } = require('node:child_process')
const fs = require('node:fs'), path = require('node:path'), sockets = require('node:net')
const { performance } = require('node:perf_hooks')
const { OpenCodeAdapter } = require('./adapter-bundle.cjs')
app.setPath('userData', path.join(__dirname, 'cli117-electron-data'))
app.disableHardwareAcceleration()
const root = path.resolve(__dirname, '../opencode-1.17.19'), isolated = path.join(root, 'context-probe-data')
for (const name of ['config', 'cache', 'state', 'data', 'project']) fs.mkdirSync(path.join(isolated, name), { recursive: true })
let child, adapter, lease, iterator, sessionID
const control = new AbortController(), started = performance.now(), stages = [], requests = {}
const mark = (stage, data = {}) => stages.push({ stage, ms: Math.round(performance.now() - started), ...data })
const deadline = setTimeout(() => { mark('deadline'); control.abort(new Error('deadline')) }, 40000)
const headers = { Authorization: 'Basic ' + Buffer.from('opencode:disposable-context-probe').toString('base64') }
app.whenReady().then(async () => {
  const socket = sockets.createServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  const env = { ...process.env, OPENCODE_SERVER_USERNAME: 'opencode', OPENCODE_SERVER_PASSWORD: 'disposable-context-probe', OPENCODE_DISABLE_MODELS_FETCH: 'true',
    OPENCODE_CONFIG_CONTENT: JSON.stringify({ share: 'disabled', command: { probe: { template: 'Metadata probe; do not execute' } }, mcp: { delayed: { type: 'local', command: [process.execPath, path.join(root, 'delayed-mcp.cjs')], timeout: 10000 } } }) }
  // The MCP helper needs a plain Node executable, not the enclosing Electron app.
  env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ share: 'disabled', command: { probe: { template: 'Metadata probe; do not execute' } }, mcp: { delayed: { type: 'local', command: [process.env.ORCA_PROBE_NODE, path.join(root, 'delayed-mcp.cjs')], timeout: 10000 } } })
  for (const name of ['CONFIG', 'CACHE', 'STATE', 'DATA']) env['XDG_' + name + '_HOME'] = path.join(isolated, name.toLowerCase())
  child = spawn(path.join(root, 'package/bin/opencode.exe'), ['serve', '--hostname=127.0.0.1', '--port=' + port], { cwd: path.join(isolated, 'project'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stderr.resume()
  const url = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(Error('listen_timeout')), 15000)
    child.stdout.on('data', chunk => { output += chunk; const match = /opencode server listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output); if (match) { clearTimeout(timer); resolve(match[1]) } })
    child.once('error', reject); child.once('exit', () => { clearTimeout(timer); reject(Error('server_exit')) })
  })
  mark('listening')
  const health = await net.fetch(url + '/global/health', { headers, signal: control.signal })
  await health.json(); mark('health', { status: health.status })
  adapter = new OpenCodeAdapter({ acquire: async () => ({ url, headers, release: () => {} }), installed: async () => ({ installed: true, version: '1.17.19' }), close: () => {} },
    (input, init) => { const request = new Request(input, init); const pathname = new URL(request.url).pathname.replace(/\/session\/[^/]+/, '/session/<id>'); requests[request.method + ' ' + pathname] = (requests[request.method + ' ' + pathname] || 0) + 1; return net.fetch(request, { bypassCustomProtocolHandlers: true }) })
  const directory = path.join(isolated, 'project')
  lease = await adapter.client({}, undefined, directory)
  iterator = lease.events(control.signal)
  const first = await iterator.next(); mark('global-sse-ready', { connected: first.value?.type === 'server.connected' })
  const ready = lease.prepare(control.signal)
  const commands = lease.commands(control.signal)
  const composer = lease.composer(control.signal).then(() => true, () => false)
  await ready; mark('project-ready')
  const session = await lease.client.session.create({ directory, title: 'Isolated Desktop sequence probe', permission: [{ permission: '*', pattern: '*', action: 'deny' }] }, { signal: control.signal, throwOnError: true })
  sessionID = session.data.id; mark('session-created')
  const values = await commands; mark('commands-ready', { hasProbe: values.some(value => value.name === 'probe') })
  await lease.commands(control.signal); mark('command-cache-hit')
  mark('composer', { ready: await composer })
}).catch(error => mark('failed', { name: error.name })).finally(async () => {
  if (sessionID && lease) { try { await lease.client.session.delete({ sessionID, directory: path.join(isolated, 'project') }, { signal: AbortSignal.timeout(3000) }); mark('session-removed') } catch {} }
  control.abort(); await iterator?.return(undefined); lease?.release(); adapter?.close()
  if (child?.pid) await new Promise(resolve => execFile(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, resolve))
  clearTimeout(deadline)
  const result = { cli: '1.17.19', electron: process.versions.electron, stages, requests }
  fs.writeFileSync(path.join(__dirname, 'cli117-context-result.json'), JSON.stringify(result)); console.log(JSON.stringify(result)); app.quit()
})
