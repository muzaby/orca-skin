const fs=require('fs'), cp=require('child_process'), path=require('path')
const scratch=path.resolve('node_modules/.cache/orca/0241')
const git='src/main/infra/git/', ui='src/renderer/src/features/chat/components/composer/'
const diff=git+'git-diff.ts', consistency=git+'git-consistency.test.ts'
const tests=[]
function replace(s,a,b){if(!s.includes(a))throw Error('Missing mutation target: '+a); return s.replace(a,b)}
function add(id,file,edit,test,pattern){tests.push({id,file,edit,test,pattern})}
add('M01-origin-local-cache',git+'git-snapshot.ts',s=>{
 s="import { readFile } from 'node:fs/promises'\nimport { join } from 'node:path'\nconst originCache = new Map<string, Awaited<ReturnType<import('./gateway').GitGateway['read']>>>()\n"+s
 return replace(s,"const origin = await gateway.read(cwd, ['remote', 'get-url', 'origin'])", "const key = cwd + await readFile(join(probe.commonDir, 'config'), 'utf8')\n  const origin = originCache.get(key) ?? await gateway.read(cwd, ['remote', 'get-url', 'origin'])\n  originCache.set(key, origin)")
},consistency,'global insteadOf')
add('M02-relative-path',git+'git-executable.ts',s=>s.replace(/    if \(!entry[\s\S]*?      continue\n/,'') ,git+'git-executable.test.ts','ignores cwd-dependent')
add('M03-read-prefix',git+'gateway.ts',s=>replace(s,"['--no-optional-locks', ...args]",'args'),git+'gateway.test.ts','applies read flags')
add('M04-summary-safety',diff,s=>replace(s,"'diff',\n    ...DIFF_SAFETY_ARGS,", "'diff',"),consistency,'summary pins')
add('M05-history-safety',diff,s=>replace(s,"[...common, ...DIFF_SAFETY_ARGS, '--raw', '--numstat']", "[...common, '--raw', '--numstat']"),consistency,'summary pins')
add('M06-fallback-history-safety',diff,s=>replace(s,'[...common, ...DIFF_SAFETY_ARGS], HISTORY_MAX_BUFFER','common, HISTORY_MAX_BUFFER'),consistency,'history-fallback pins')
for(const [id,context,name] of [['M07-full-patch-safety','PATCH_CONTEXT','patch pins'],['M08-reduced-patch-safety','3','cumulative fallback']]){
 add(id,diff,s=>replace(s,"'diff',\n      ...DIFF_SAFETY_ARGS,",`'diff',\n      ...(context === ${context} ? [] : DIFF_SAFETY_ARGS),`),consistency,name)
}
add('M09-checkout-safety',git+'git-cli.ts',s=>replace(s,"['diff', ...DIFF_SAFETY_ARGS, 'HEAD', '--shortstat']","['diff', 'HEAD', '--shortstat']"),'src/main/app/git-execution.test.ts','checkout returns')
add('M10-checkout-status',ui+'branchChipState.ts',s=>replace(s,"{ kind: 'switched', status: result.status }","{ kind: 'switched' }"),ui+'branchChipState.test.ts','성공이면')
add('M11-summary-head',diff,s=>replace(s,"    ...revArgs\n  ])", "    revArgs[0], 'HEAD'\n  ])"),consistency,'summary pins')
add('M12-history-head',diff,s=>replace(s,"[...common, ...DIFF_SAFETY_ARGS, '--raw', '--numstat']", "[...common.map((arg) => arg === logRange ? logRange.split('..')[0] + '..HEAD' : arg), ...DIFF_SAFETY_ARGS, '--raw', '--numstat']"),consistency,'summary pins')
add('M13-fallback-history-head',diff,s=>replace(s,'[...common, ...DIFF_SAFETY_ARGS], HISTORY_MAX_BUFFER',"[...common.map((arg) => arg === logRange ? logRange.split('..')[0] + '..HEAD' : arg), ...DIFF_SAFETY_ARGS], HISTORY_MAX_BUFFER"),consistency,'history-fallback pins')
add('M14-born-head',diff,s=>replace(s,'      headOid\n    ])',"      'HEAD'\n    ])"),consistency,'bornAt pins')
for(const [id,when,context,name] of [
 ['M15-full-cumulative-head',"range.kind === 'cumulative'",'PATCH_CONTEXT','patch pins'],
 ['M16-reduced-cumulative-head',"range.kind === 'cumulative'",'3','cumulative fallback'],
 ['M18-full-selected-head',"range.kind === 'commit'",'PATCH_CONTEXT','selected pins'],
 ['M19-reduced-selected-head',"range.kind === 'commit'",'3','selected fallback']]){
 add(id,diff,s=>replace(s,`runPatch(input.cwd, ${context}, revArgs, runner)`,`runPatch(input.cwd, ${context}, ${when} ? [revArgs[0], 'HEAD'] : revArgs, runner)`),consistency,name)
}
add('M17-cat-file-head',diff,s=>replace(s,"['cat-file', 'commit', sha]","['cat-file', 'commit', 'HEAD']"),consistency,'selected pins')
add('M20-owner-sweep',ui+'useGitIdentityRemote.ts',s=>s+"\nvoid gitApi.snapshot({cwd: '/unexpected', includeSummary: false})\n",ui+'gitQueryOwner.test.ts')
add('M21-effect-tick',ui+'useGitSnapshot.ts',s=>replace(s,'[cwd, sessionId, owner, tick, refreshTick, statusKey, summaryKey]','[cwd, sessionId, owner, refreshTick, statusKey, summaryKey]'),ui+'gitQueryReason.test.ts')
add('M22-feature-call-axis','src/main/features/worktrees/service.ts',s=>"import { runGit } from '../../infra/git/runner'\n"+s+"\nexport const boundaryRegression = (): unknown => runGit('/repo', ['status'])\n",'src/main/features/worktrees/ipc-integration.test.ts','features/\\*\\*')
tests.sort((a,b)=>a.id.localeCompare(b.id))
const start=Number(process.argv[2]??0), end=Number(process.argv[3]??tests.length)
const results=[]
for(const m of tests.slice(start,end)){
 const before=fs.readFileSync(m.file,'utf8'); const after=m.edit(before)
 if(before===after)throw Error('No mutation '+m.id)
 fs.writeFileSync(path.join(scratch,m.id+'.before'),before)
 let result
 try {
  fs.writeFileSync(m.file,after)
  const args=['node_modules/vitest/vitest.mjs','run',m.test,...(m.pattern?['-t',m.pattern]:[])]
  const run=cp.spawnSync(process.execPath,args,{encoding:'utf8',timeout:180000,windowsHide:true})
  const output=(run.stdout??'')+(run.stderr??'')
  fs.writeFileSync(path.join(scratch,m.id+'.log'),output)
  const counts=output.match(/Tests\s+[^\n]*?([1-9]\d*) failed/)
  result={id:m.id,file:m.file,test:m.test,pattern:m.pattern,status:run.status,red:run.status===1&&!!counts,failed:counts?Number(counts[1]):0}
 }finally{fs.writeFileSync(m.file,before)}
 results.push(result); process.stdout.write(JSON.stringify(result)+'\n')
 fs.writeFileSync(path.join(scratch,`mutations-${start}-${end}.json`),JSON.stringify(results,null,2))
 if(!result.red) {process.exitCode=1;break}
}
