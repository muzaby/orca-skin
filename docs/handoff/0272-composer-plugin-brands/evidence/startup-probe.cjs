const { spawn, execFile } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { createServer } = require('node:net')
const { performance } = require('node:perf_hooks')
const { join } = require('node:path')

const executable = process.argv[2]
const engineFile = process.argv[3]
const directory = process.cwd()
async function port() {
  const server = createServer()
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const value = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return value
}
function stop(child) {
  if (child.exitCode != null) return Promise.resolve()
  return new Promise((resolve) => execFile(join(process.env.SystemRoot || 'C:\\Windows', 'System32/taskkill.exe'),
    ['/PID', String(child.pid), '/T', '/F'], {windowsHide:true}, () => resolve()))
}
async function trial(label, settings) {
  const started = performance.now()
  const stages = []
  const mark = (stage, data = {}) => stages.push({stage, ms:Math.round(performance.now()-started), ...data})
  const child = spawn(executable, ['serve', '--hostname=127.0.0.1', `--port=${await port()}`, '--print-logs'], {
    cwd: directory, windowsHide:true, stdio:['ignore','pipe','pipe'],
    env:{...process.env, OPENCODE_CONFIG_CONTENT:JSON.stringify({...settings, share:'disabled'}), OPENCODE_SERVER_PASSWORD:'local-probe-disposable'}
  })
  const errors = {pluginFailures:0, pluginLoadEvents:0, configLoadEvents:0, codes:[]}
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); if(stderr.length>2000000) stderr=stderr.slice(-1000000) })
  const sessionIDs = []
  const controller = new AbortController()
  const total = setTimeout(()=>controller.abort(), 55000)
  let base
  const headers = {Authorization:`Basic ${Buffer.from('opencode:local-probe-disposable').toString('base64')}`,'content-type':'application/json'}
  async function request(path, method='GET', payload, timeout=45000) {
    const response = await fetch(`${base}${path}${path.includes('?')?'&':'?'}directory=${encodeURIComponent(directory)}`, {
      method, headers, ...(payload ? {body:JSON.stringify(payload)}:{}),
      signal:AbortSignal.any([controller.signal, AbortSignal.timeout(timeout)])
    })
    if(!response.ok) throw new Error(`HTTP_${response.status}`)
    return response.json()
  }
  try {
    base = await new Promise((resolve, reject)=>{
      let output=''
      const timer=setTimeout(()=>reject(new Error('listen_timeout')),15000)
      child.stdout.on('data',(chunk)=>{output+=chunk.toString(); const match=/opencode server listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(output); if(match){clearTimeout(timer);resolve(match[1])}})
      child.once('error',reject)
      child.once('exit',()=>{clearTimeout(timer);reject(new Error('server_exit'))})
    })
    mark('listening')
    await request('/global/health')
    mark('health')
    const metadata = Promise.allSettled([
      request('/agent','GET',undefined,2500),
      request('/provider','GET',undefined,2500)
    ]).then((values)=>mark('parallel-composer-catalog', {results:values.map((v)=>v.status)}))
    const created = await request('/session','POST',{title:'Disposable Orca startup timing probe',permission:[{permission:'*',pattern:'*',action:'deny'}]})
    if(created.id) sessionIDs.push(created.id)
    mark('first-session-created')
    const response=await fetch(`${base}/event?directory=${encodeURIComponent(directory)}`,{headers,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])})
    const reader=response.body.getReader()
    await reader.read()
    mark('first-sse-event')
    await reader.cancel()
    await metadata
    const config=await request('/config')
    mark('effective-config', {plugins:Array.isArray(config.plugin)?config.plugin.length:0,mcp:config.mcp?Object.keys(config.mcp).length:0})
    const mcp=await request('/mcp')
    const statuses={}
    for(const value of Object.values(mcp||{})){const s=value?.status||'unknown';statuses[s]=(statuses[s]||0)+1}
    mark('mcp-status', {statuses})
    const warm=await request('/session','POST',{title:'Disposable warm startup timing probe',permission:[{permission:'*',pattern:'*',action:'deny'}]})
    if(warm.id) sessionIDs.push(warm.id)
    mark('warm-session-created')
  } catch(error) {
    mark('failed', {reason:error.name==='TimeoutError'||error.name==='AbortError'?error.name:String(error.message).replace(/https?:\/\/\S+/g,'<url>').slice(0,120)})
  } finally {
    clearTimeout(total)
    for(const id of sessionIDs) { try { await request(`/session/${encodeURIComponent(id)}`,'DELETE',undefined,3000) } catch {} }
    for(const line of stderr.split(/\r?\n/)) {
      if(/failed to load plugin/i.test(line)) errors.pluginFailures++
      if(/loading plugin/i.test(line)) errors.pluginLoadEvents++
      if(/loading/.test(line)&&/(?:config|settings)/i.test(line)) errors.configLoadEvents++
      const code=/\b(ENOENT|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|ECONNREFUSED|ETIMEDOUT)\b/.exec(line)
      if(code&&!errors.codes.includes(code[1])) errors.codes.push(code[1])
      if(/loading|bootstrapping|failed to load plugin|plugin config hook failed/i.test(line)) {
        const time=/timestamp=([^ ]+)/.exec(line)?.[1]
        const event=/failed to load plugin/i.test(line)?'plugin-load-failed':/bootstrapping/i.test(line)?'bootstrap':/(?:config|settings)/i.test(line)?'config-loading':/plugin/i.test(line)?'plugin-loading':'other-loading'
        if(time) stages.push({stage:`log:${event}`,time})
      }
    }
    await stop(child)
  }
  process.stdout.write(JSON.stringify({label, stages, errors})+'\n')
}
(async()=>{
  await trial('native-user-config',{})
  if(engineFile) await trial('orca-engine-config',JSON.parse(readFileSync(engineFile,'utf8').replace(/^\uFEFF/,'')))
})().catch((error)=>{process.stdout.write(JSON.stringify({fatal:error.name})+'\n');process.exitCode=1})
