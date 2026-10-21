const { app, net } = require('electron')
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const { spawn } = require('node:child_process'), { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const { OpenCodeAdapter, OpenCodeServerPool } = require('./adapter-server.cjs')
app.setPath('userData', path.join(__dirname, 'electron-data'))
app.disableHardwareAcceleration()
const root = path.join(__dirname, 'isolated'), started = performance.now(), trace = [], children = [], lives = [], iterators = [], previews = [], sockets = new Set()
const env = { OPENCODE_DISABLE_MODELS_FETCH: 'true', OPENCODE_DISABLE_PROJECT_CONFIG: 'true', OPENCODE_DISABLE_AUTOUPDATE: 'true' }
for (const name of ['config', 'cache', 'state', 'data', 'A', 'B']) fs.mkdirSync(path.join(root, name), { recursive: true })
for (const name of ['CONFIG','CACHE','STATE','DATA']) env['XDG_'+name+'_HOME'] = path.join(root,name.toLowerCase())
const mark = (stage, data={}) => { const item = { stage, ms: Math.round(performance.now()-started), ...data }; trace.push(item); fs.writeFileSync(path.join(__dirname,'trace.json'),JSON.stringify(trace,null,2)); console.log(JSON.stringify(item)) }
let adapter, pool, server, finishing = false, unblock
const providerGate = new Promise(resolve => { unblock=resolve })
let holdProvider = true
function json(res,data) { res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(data)) }
async function read(req) { let raw=''; for await(const data of req) raw+=data; return raw ? JSON.parse(raw) : undefined }
async function frame(live) {
 const iterator=live.eventBatches[Symbol.asyncIterator](); iterators.push(iterator)
 const events=[]
 for(;;) { const next=await iterator.next(); if(next.done) break; events.push(...next.value.events); if(next.value.events.some(e=>e.type==='turn.ended'||e.type==='error')) break }
 assert(!events.some(e=>e.type==='error'), JSON.stringify(events.filter(e=>e.type==='error')))
 assert(events.some(e=>e.type==='turn.ended')); return iterator
}
async function finish(error) {
 if(finishing) return; finishing=true; clearTimeout(deadline); unblock()
 if(error) mark('failed',{message:String(error.message).slice(0,250)})
 fs.writeFileSync(path.join(__dirname,'result.json'), JSON.stringify({success:!error,cli:'1.17.19',electron:process.versions.electron,trace},null,2))
 for(const live of lives) live.close()
 await Promise.race([Promise.allSettled([...iterators.map(i=>i.return()),...previews.map(p=>p.release())]),new Promise(r=>setTimeout(r,5000))])
 adapter?.close(); pool?.close(); for(const socket of sockets) socket.destroy(); server?.close()
 fs.writeFileSync(path.join(__dirname,'result.json'), JSON.stringify({success:!error,cli:'1.17.19',electron:process.versions.electron,trace},null,2))
 app.exit(error?1:0)
}
const deadline=setTimeout(()=>void finish(new Error('probe deadline')),180000)
app.whenReady().then(async()=>{
 server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost')
  if(url.pathname==='/hook') { mark('plugin-'+url.searchParams.get('phase'),{scope:url.searchParams.get('scope')}); if(url.searchParams.get('phase')==='setup') await new Promise(r=>setTimeout(r,1000)); return json(res,{}) }
  if(url.pathname.startsWith('/model/')) {
   await read(req); mark('model-request'); res.writeHead(200,{'content-type':'text/event-stream'})
   const base={id:'probe',object:'chat.completion.chunk',created:1,model:'probe'}
   res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{role:'assistant',content:'Prepared agent response'},finish_reason:null}]})+'\n\n')
   res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})+'\n\n')
   return res.end('data: [DONE]\n\n')
  }
  res.writeHead(404);res.end()
 })
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s))})
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base='http://127.0.0.1:'+server.address().port
 const plugin=path.join(__dirname,'plugin.mjs')
 fs.writeFileSync(plugin,`const base=${JSON.stringify(base)}; await fetch(base+'/hook?phase=import'); export default async ({directory})=>{ const scope=directory.split(/[\\\\/]/).at(-1); await fetch(base+'/hook?phase=setup&scope='+scope); return { config:async(cfg)=>{await fetch(base+'/hook?phase=config&scope='+scope);cfg.agent={...cfg.agent,['Atlas-'+scope]:{mode:'primary',description:'Fixture plugin agent',prompt:'Respond briefly'}}} } };`)
 const settings={model:'probe/probe',small_model:'probe/probe',share:'disabled',plugin:[pathToFileURL(plugin).href],provider:{probe:{npm:'@ai-sdk/openai-compatible',name:'Local probe',options:{baseURL:base+'/model/v1',apiKey:'disposable'},models:{probe:{name:'probe',limit:{context:8192,output:256}}}}}}
 const fetchImpl=async(input,init)=>{ const request=new Request(input,init),url=new URL(request.url); const route=url.pathname.replace(/\/session\/[^/]+/,'/session/<id>'); mark('sdk-start',{route,scope:url.searchParams.get('directory')?.split(/[\\/]/).at(-1)}); if(url.pathname==='/provider'&&holdProvider) await providerGate; return net.fetch(request,{bypassCustomProtocolHandlers:true}) }
 pool=new OpenCodeServerPool({dataDirectory:root,preferences:()=>undefined,fetchImpl,executable:()=>path.resolve(__dirname,'../../.git/opencode-1.17.19/package/bin/opencode.exe'),spawnProcess:(...args)=>{mark('spawn');const child=spawn(...args);children.push(child);return child}})
 adapter=new OpenCodeAdapter(pool,fetchImpl)
 const prepared={providerKey:'probe',provider:'probe',sourceRevision:'probe',settings}
 const a=await adapter.prepareComposer({cwd:path.join(root,'A'),env,providerSettings:prepared});previews.push(a)
 const models=a.read('models',new AbortController().signal)
 const agents=await a.read('agents',new AbortController().signal)
 assert(agents.some(a=>a.name==='Atlas-A'));mark('A-agents-visible',{names:agents.map(a=>a.name)})
 assert(!trace.some(x=>x.stage==='sdk-start'&&['/config','/global/event','/session','/command','/mcp'].includes(x.route)))
 await a.read('agents',new AbortController().signal)
 await Promise.all([a.read('agents',new AbortController().signal,true),a.read('agents',new AbortController().signal,true)])
 assert.equal(trace.filter(x=>x.stage==='sdk-start'&&x.route==='/agent').length,2)
 assert.equal(trace.filter(x=>x.stage==='plugin-setup').length,1)
 const submit=(scope)=>{ const live=adapter.sendMessage({sessionId:null,cwd:path.join(root,scope),env,providerSettings:prepared,text:'A short greeting.',model:'probe/probe',harnessAgent:'Atlas-'+scope,extensions:{skills:[],hooks:{normalized:{}}}});lives.push(live);return live }
 const la=submit('A');await frame(la);mark('A-first-prompt-complete-provider-still-held')
 holdProvider=false;unblock();await models;await a.release()
 const b=await adapter.prepareComposer({cwd:path.join(root,'B'),env,providerSettings:prepared});previews.push(b)
 assert((await b.read('agents',new AbortController().signal)).some(x=>x.name==='Atlas-B'));mark('B-agents-visible-A-idle')
 const lb=submit('B');await frame(lb);await b.release()
 assert.equal(trace.filter(x=>x.stage==='spawn').length,1)
 assert.equal(trace.filter(x=>x.stage==='plugin-import').length,1)
 assert.equal(trace.filter(x=>x.stage==='plugin-setup').length,2)
 assert.equal(trace.filter(x=>x.stage==='plugin-config').length,2)
 assert.equal(trace.filter(x=>x.stage==='sdk-start'&&x.route==='/global/event').length,1)
 assert(!trace.some(x=>x.stage==='sdk-start'&&x.route==='/instance/dispose'))
 for(const live of lives) live.close();await Promise.all(iterators.map(i=>i.return()))
 const stop=Date.now()+10000;while(children.some(c=>c.exitCode===null)&&Date.now()<stop) await new Promise(r=>setTimeout(r,50))
 assert(children.every(c=>c.exitCode!==null));mark('all-owners-released-server-exited')
 await finish()
}).catch(error=>void finish(error))
