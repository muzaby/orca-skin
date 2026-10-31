// 0290 vitest 실패 ID 추출 — `vitest run --reporter=json --outputFile=<report>` 결과에서
// 실패 케이스(파일\t조상 > 제목)와 케이스 없이 실패한 파일(<file-level>)을 정렬해 출력한다.
// 기준선(baseline/vitest-failed-ids.txt)과 `comm -13` 으로 비교하면 신규 실패만 남는다.
//
// usage (repo root): node docs/handoff/0290-simplify-0254-0289/scan/vitest-failed-ids.mjs <report.json>
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const root = resolve(new URL('.', import.meta.url).pathname, '../../../..')
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const ids = []
for (const file of report.testResults) {
  const name = relative(root, file.name)
  const failed = file.assertionResults.filter((a) => a.status === 'failed')
  if (file.status !== 'passed' && failed.length === 0) ids.push(`${name}\t<file-level>`)
  for (const a of failed) ids.push(`${name}\t${[...(a.ancestorTitles ?? []), a.title].join(' > ')}`)
}
process.stdout.write(ids.sort().join('\n') + '\n')
