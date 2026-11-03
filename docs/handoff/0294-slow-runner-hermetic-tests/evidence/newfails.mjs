// 두 vitest JSON 보고서(--reporter=json)를 비교해 새로 실패한 케이스를 센다.
// 사용: node newfails.mjs <기준.json> <비교.json> [full]
// 경로는 `src/` 앞까지 잘라 작업 트리 위치가 달라도 같은 키가 되게 한다.
import { readFileSync } from 'node:fs'
const key = (name) => name.replace(/^.*?(?=src[\\/])/, '').replaceAll('\\', '/')
const load = (path) => {
  const report = JSON.parse(readFileSync(path, 'utf8'))
  const failed = new Set()
  for (const file of report.testResults) {
    for (const test of file.assertionResults)
      if (test.status === 'failed') failed.add(`${key(file.name)} > ${test.fullName}`)
    if (file.status === 'failed' && file.assertionResults.length === 0) failed.add(`${key(file.name)} > <suite>`)
  }
  return failed
}
const base = load(process.argv[2])
const current = load(process.argv[3])
const added = [...current].filter((item) => !base.has(item))
const removed = [...base].filter((item) => !current.has(item))
const files = {}
for (const item of added) files[item.split(' > ')[0]] = (files[item.split(' > ')[0]] ?? 0) + 1
console.log('added', added.length, 'removed', removed.length)
for (const [file, count] of Object.entries(files).sort()) console.log(count, file)
if (process.argv[4] === 'full') for (const item of added) console.log('  +', item)
