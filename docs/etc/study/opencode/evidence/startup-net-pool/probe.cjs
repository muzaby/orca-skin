const { app, net } = require('electron')
const http = require('node:http')
const path = require('node:path')
const { performance } = require('node:perf_hooks')
app.setPath('userData',path.join(__dirname,'electron-user-data'))
app.disableHardwareAcceleration()
const controllers=[]
const rows=[]
let server
const deadline=setTimeout(()=>{console.log(JSON.stringify({fatal:'probe_deadline',rows}));app.exit(1)},15000)
async function health(base,stage) {
  const start=performance.now()
  try {
    const response=await net.fetch(base+'/health',{signal:AbortSignal.timeout(2000)})
    await response.text()
    rows.push({stage,status:response.status,ms:Math.round(performance.now()-start)})
  } catch(error) {rows.push({stage,error:error.name,ms:Math.round(performance.now()-start)})}
}
app.whenReady().then(async()=>{
  server=http.createServer((req,res)=>{
    if(req.url==='/stream') {res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache'});res.write('data: ready\n\n');return}
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end('{}')
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  const base='http://127.0.0.1:'+server.address().port
  for(let i=0;i<6;i++) {
    const control=new AbortController();controllers.push(control)
    const response=await net.fetch(base+'/stream',{signal:control.signal})
    await response.body.getReader().read()
    if(i===4) await health(base,'five-open-streams')
  }
  await health(base,'six-open-streams')
  controllers[0].abort()
  await health(base,'after-one-stream-aborted')
  console.log(JSON.stringify({electron:process.versions.electron,chrome:process.versions.chrome,rows}))
}).catch(error=>console.log(JSON.stringify({fatal:error.name}))).finally(()=>{
  for(const control of controllers)control.abort()
  server?.closeAllConnections();server?.close()
  clearTimeout(deadline);app.quit()
})
