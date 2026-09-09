import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

// 작성: Codex. 실제 JSX 상하 슬롯을 교환해 순서 oracle을 확인하고 반드시 복원한다.
const root = process.cwd()
const target = resolve(root, 'app/src/renderer/src/features/chat/components/AgentModeToggle.tsx')
const original = readFileSync(target)
const source = original.toString('utf8').replace(/\r\n/g, '\n')
const controls = source.indexOf('      <div\n        data-agent-mode-controls')
const hero = source.indexOf('      <h1\n        data-agent-mode-hero')
const end = source.indexOf('      </h1>', hero) + '      </h1>'.length
if (controls < 0 || hero <= controls || end <= hero) throw new Error('Unexpected toggle layout')
const run = (name) => spawnSync(process.execPath, [
  'node_modules/vitest/vitest.mjs', 'run',
  'src/renderer/src/features/chat/components/AgentModeToggle.test.ts',
  '--reporter=json', `--outputFile=../docs/handoff/0224-work-agent-layer/evidence/${name}.json`
], { cwd: resolve(root, 'app'), encoding: 'utf8', timeout: 180000, windowsHide: true })
let mutant
try {
  writeFileSync(target, source.slice(0, controls) + source.slice(hero, end) + '\n' + source.slice(controls, hero).trimEnd() + source.slice(end))
  mutant = run('r4-landing-slot-mutant')
} finally {
  writeFileSync(target, original)
}
if (!readFileSync(target).equals(original)) throw new Error('Original was not restored')
const restored = run('r4-landing-slot-restored')
const result = { author: 'Codex', mutation: 'controls/hero sibling slot swap', mutantExit: mutant?.status, restoredExit: restored.status, originalRestored: true }
writeFileSync(resolve(root, 'docs/handoff/0224-work-agent-layer/evidence/r4-landing-mutation.json'), JSON.stringify(result, null, 2) + '\n')
process.stdout.write(JSON.stringify(result) + '\n')
if (mutant?.status !== 1 || restored.status !== 0) process.exitCode = 1
