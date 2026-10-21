const { app, net } = require('electron')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { OpenCodeAdapter } = require('./adapter-bundle.cjs')
app.setPath('userData', path.join(__dirname, 'pooled-electron-data'))
app.disableHardwareAcceleration()
let server, adapter
const lives = [], iterators = [], responses = new Set(), counts = {}
let sessions = 0, releases = 0
const deadline = setTimeout(() => { console.log(JSON.stringify({ fatal: 'deadline', counts })); app.exit(1) }, 20000)
function emit(payload) {
  for (const response of responses) response.write('data: ' + JSON.stringify({ directory: 'C:/work', payload }) + '\n\n')
}
function json(response, data) {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify(data))
}
async function frame(iterator) {
  const events = []
  for (;;) {
    const next = await iterator.next()
    if (next.done) return events
    events.push(...next.value.events)
    if (next.value.events.some(x => x.type === 'error' || x.type === 'turn.ended')) return events
  }
}
app.whenReady().then(async () => {
  server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost')
      counts[url.pathname] = (counts[url.pathname] || 0) + 1
      if (request.headers.authorization !== 'Basic pooled-probe') { response.writeHead(401); response.end(); return }
      if (url.pathname === '/global/event') {
        response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
        responses.add(response)
        response.on('close', () => responses.delete(response))
        response.write('data: ' + JSON.stringify({ payload: { id: 'connected', type: 'server.connected', properties: {} } }) + '\n\n')
        return
      }
      if (url.pathname === '/config') { json(response, {}); return }
      if (url.pathname === '/agent') { json(response, [{ name: 'build', mode: 'primary' }]); return }
      if (url.pathname === '/provider') { json(response, { all: [], connected: [], default: {} }); return }
      if (url.pathname === '/command') { json(response, []); return }
      if (url.pathname === '/session') { json(response, { id: 's' + (++sessions) }); return }
      if (url.pathname.endsWith('/prompt_async')) {
        let data = ''
        for await (const chunk of request) data += chunk
        const body = JSON.parse(data), id = url.pathname.split('/')[2], aid = 'a-' + body.messageID
        response.writeHead(204); response.end()
        setImmediate(() => {
          const info = {
            id: aid, sessionID: id, parentID: body.messageID, role: 'assistant',
            time: { created: 100, completed: 120 }, modelID: 'model', providerID: 'provider',
            mode: 'build', agent: 'build', path: { cwd: 'C:/work', root: 'C:/work' }, cost: 0,
            tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }
          }
          emit({ id: 'e1-' + aid, type: 'message.updated', properties: { sessionID: id, info } })
          const part = { id: 'p-' + aid, messageID: aid, sessionID: id, type: 'text', text: 'Reply ' + id, time: { start: 1, end: 2 } }
          emit({ id: 'e2-' + aid, type: 'message.part.updated', properties: { sessionID: id, time: 2, part } })
          emit({ id: 'e3-' + aid, type: 'session.idle', properties: { sessionID: id } })
        })
        return
      }
      if (url.pathname.endsWith('/abort')) { json(response, true); return }
      response.writeHead(404); response.end()
    } catch { response.writeHead(500); response.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = 'http://127.0.0.1:' + server.address().port
  adapter = new OpenCodeAdapter({
    acquire: async () => ({ url, headers: { Authorization: 'Basic pooled-probe' }, release: () => { releases++ } }),
    installed: async () => ({ installed: true, version: 'test' }), close: () => {}
  }, (input, init) => net.fetch(input, { ...init, bypassCustomProtocolHandlers: true }))
  for (let index = 0; index < 8; index++) {
    const live = adapter.sendMessage({ sessionId: null, cwd: 'C:/work', text: 'Probe ' + index, extensions: { skills: [], hooks: { normalized: {} } } })
    lives.push(live); iterators.push(live.eventBatches[Symbol.asyncIterator]())
  }
  const result = await Promise.all(iterators.map(frame))
  for (const events of result) if (events.some(x => x.type === 'error') || !events.some(x => x.type === 'turn.ended')) throw Error('frame_failed')
  lives[0].close(); await iterators[0].return()
  await lives[1].pushTurn({ text: 'Warm followup' })
  if (!(await frame(iterators[1])).some(x => x.type === 'turn.ended')) throw Error('followup_failed')
  for (const live of lives) live.close()
  await Promise.all(iterators.map(iterator => iterator.return()))
  adapter.close()
  const resultData = { electron: process.versions.electron, chrome: process.versions.chrome, completedFrames: result.length, warmFollowup: true, releases, counts }
  fs.writeFileSync(path.join(__dirname, 'pooled-electron-result.json'), JSON.stringify(resultData))
  console.log(JSON.stringify(resultData))
}).catch(error => {
  console.log(JSON.stringify({ fatal: error.name, reason: error.message, counts }))
  process.exitCode = 1
}).finally(() => {
  for (const live of lives) live.close()
  adapter?.close(); server?.closeAllConnections(); server?.close(); clearTimeout(deadline); app.quit()
})
