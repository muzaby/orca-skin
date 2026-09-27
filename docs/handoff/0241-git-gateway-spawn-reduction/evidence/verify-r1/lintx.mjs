import { ESLint } from '/home/user/orca-skin/app/node_modules/eslint/lib/api.js'
const eslint = new ESLint({ cache: false, cwd: process.cwd() })
const cases = [
 ['X-L1 require node:child_process','src/main/features/worktrees/service.ts',"const cp = require('node:child_process'); void cp"],
 ['X-L2 export * runner','src/main/infra/git/repository.ts',"export * from './runner'"],
 ['X-L3 import runner.js','src/main/infra/git/repository.ts',"import { runGit } from './runner.js'; void runGit"],
 ['X-L4 type-only runner import','src/main/infra/git/probe.ts',"import type { GitRunResult } from './runner'; export type X = GitRunResult"],
 ['X-L5 app/ runner import','src/main/app/legacy-paths.ts',"import { runGit } from '../infra/git/runner'; void runGit"],
 ['X-L6 createRequire','src/main/features/worktrees/service.ts',"import { createRequire } from 'node:module'; const r = createRequire(import.meta.url); void r('child_process')"],
]
for (const [n,f,s] of cases){ const [r]=await eslint.lintText(s,{filePath:f}); console.log(n, JSON.stringify(r.messages.filter(m=>m.severity===2).map(m=>m.ruleId))) }
