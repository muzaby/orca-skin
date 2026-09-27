const fs=require('fs'), cp=require('child_process')
const g='src/main/infra/git/', ui='src/renderer/src/features/chat/components/composer/'
const T=[]
const add=(id,file,a,b,tests)=>T.push({id,file,a,b,tests})
add('X03b-slot-leak',g+'gateway.ts','if (next) next()\n        else active--','if (next) next()',[g+'gateway.test.ts',g+'git-snapshot.test.ts',g+'git-consistency.test.ts'])
add('X03c-undercount',g+'gateway.ts','if (next) next()\n        else active--','if (next) next()\n        active--',[g+'gateway.test.ts',g+'__verify'])
add('X04b-gen-success-only',g+'gateway.ts','        } finally {\n          generation++\n        }','        } finally {\n          if (Number.NaN) generation++\n        }',[g+'gateway.test.ts','src/main/app/git-execution.test.ts'])
add('X08b-negative-memo',g+'git-executable.ts','let executable: string | null = null\nexport async function gitExecutable(): Promise<string | null> {\n  return executable ?? (executable = await resolveGitExecutable())\n}','let executable: Promise<string | null> | undefined\nexport async function gitExecutable(): Promise<string | null> {\n  return (executable ??= resolveGitExecutable())\n}',[g+'__verify'])
add('X06-turnend-no-status',ui+'useGitSnapshot.ts','        chatActions.setGitStatus({ cwd, status: result.status })','        if (!includeSummary) chatActions.setGitStatus({ cwd, status: result.status })',[ui+'__probe0241.test.ts'])
const only=process.argv[2]
for(const m of T.filter(t=>!only||t.id.startsWith(only))){
 const before=fs.readFileSync(m.file,'utf8'); if(!before.includes(m.a)) {console.log(m.id,'MISSING TARGET');continue}
 try{ fs.writeFileSync(m.file,before.replace(m.a,m.b))
  const r=cp.spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...m.tests],{encoding:'utf8',timeout:400000})
  const out=(r.stdout||'')+(r.stderr||''); const line=(out.match(/Tests\s+[^\n]*/)||['?'])[0]
  const fails=[...new Set((out.match(/FAIL\s+\S+ > [^\n]*/g)||[]).map(s=>s.slice(0,140)))].slice(0,3)
  console.log(JSON.stringify({id:m.id,status:r.status,tests:line,fails}))
 } finally { fs.writeFileSync(m.file,before) }
}
