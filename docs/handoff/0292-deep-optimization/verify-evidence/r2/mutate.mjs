// 0292 r2 verify 고장 재실행기 — mutations.json 의 고장을 심고 vitest 를 돌린 뒤 원문으로 되돌린다.
// 사용(app 디렉터리에서): node ../docs/handoff/0292-deep-optimization/verify-evidence/r2/mutate.mjs <id...> [--suite|--related|--full]
//   --suite(기본) 은 항목의 `suite` 테스트 파일만, --related 는 `vitest related <첫 파일>`, --full 은 전체 스위트다.
//   여러 id 는 함께 심는다. 보고는 기준선 실패 ID(head-failed-ids.txt — r2 HEAD 전체 실행) 밖의 실패 수다.
//   0 이면 그 범위에서 못 잡음이다. vitest 실행기는 ORCA_VITEST 로 바꿀 수 있다
//   (기본: Electron Node 모드 `./node_modules/electron/dist/electron ./node_modules/vitest/vitest.mjs`).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const app = join(repo, 'app')
const { entries } = JSON.parse(readFileSync(join(here, 'mutations.json'), 'utf8'))
const args = process.argv.slice(2)
const mode = args.includes('--full') ? 'full' : args.includes('--related') ? 'related' : 'suite'
const ids = args.filter((arg) => !arg.startsWith('--'))
const chosen = ids.map((id) => {
  const entry = entries.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`unknown mutation ${id}`)
  if (entry.run === 'bundle') throw new Error(`${id} is a bundle-gate mutation — build and run scan/bundle-measure.mjs`)
  return entry
})
const baseline = new Set(
  readFileSync(join(here, 'head-failed-ids.txt'), 'utf8').split('\n').filter(Boolean)
)
const originals = new Map()
try {
  for (const entry of chosen) {
    const path = join(repo, entry.file)
    if (!originals.has(path)) originals.set(path, readFileSync(path, 'utf8'))
    let text = readFileSync(path, 'utf8')
    for (const { old, new: replacement } of entry.edits) {
      const count = text.split(old).length - 1
      if (count !== 1) throw new Error(`${entry.id}: snippet occurs ${count} times in ${entry.file}`)
      text = text.replace(old, () => replacement)
    }
    writeFileSync(path, text)
  }
  const report = join(mkdtempSync(join(tmpdir(), 'orca-0292-r2-mutate-')), 'report.json')
  const runner = (
    process.env.ORCA_VITEST ?? './node_modules/electron/dist/electron ./node_modules/vitest/vitest.mjs'
  ).split(' ')
  const target = relative(app, join(repo, chosen[0].file))
  const suite = [...new Set(chosen.flatMap((entry) => entry.suite ?? []))].map((file) =>
    relative(app, join(repo, file))
  )
  if (mode === 'suite' && suite.length === 0) throw new Error('no suite recorded — use --related')
  const vitestArgs =
    mode === 'full' ? ['run'] : mode === 'related' ? ['related', target, '--run'] : ['run', ...suite]
  spawnSync(runner[0], [...runner.slice(1), ...vitestArgs, '--reporter=json', `--outputFile=${report}`], {
    cwd: app,
    stdio: 'ignore',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  })
  const result = JSON.parse(readFileSync(report, 'utf8'))
  const failed = []
  for (const file of result.testResults) {
    const name = relative(repo, file.name).replaceAll('\\', '/')
    const bad = file.assertionResults.filter((assertion) => assertion.status === 'failed')
    if (file.status !== 'passed' && bad.length === 0) failed.push(`${name}\t<file-level>`)
    for (const assertion of bad)
      failed.push(`${name}\t${[...(assertion.ancestorTitles ?? []), assertion.title].join(' > ')}`)
  }
  const fresh = failed.filter((id) => !baseline.has(id))
  console.log(
    JSON.stringify({
      ids,
      mode,
      files: result.testResults.length,
      tests: result.numTotalTests,
      newFailures: fresh.length,
      caughtBy: fresh.slice(0, 5)
    })
  )
} finally {
  for (const [path, text] of originals) writeFileSync(path, text)
}
