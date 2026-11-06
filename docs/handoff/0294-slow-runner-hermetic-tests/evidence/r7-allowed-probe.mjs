// M71: 실제 트리의 매개변수 증감 자리 + 판정 불가 허용 목록 count 대조.
import { readFileSync, writeFileSync } from 'node:fs'
import { runCli } from '../../../../app/scripts/check-test-budgets.mjs'
const file = 'src/main/infra/net/pop3-tls.test.ts'
const original = readFileSync(file, 'utf8')
try {
  writeFileSync(file, original + '\nfunction probe(ms) { ms++; setTimeout(() => {}, ms) }\nprobe(scaleMs(500))\n')
  process.exitCode = runCli()
} finally {
  writeFileSync(file, original)
}
