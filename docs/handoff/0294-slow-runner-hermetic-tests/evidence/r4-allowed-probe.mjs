// 0294 r4 M52 재현. app/ 에서 실행하며, 호출이 실패해도 테스트 소스를 원복한다.
// 허용 목록은 r4-mutations.jsonl의 M52-1 또는 M52-2가 검사기에 주입한다.
import { readFileSync, writeFileSync } from 'node:fs'
import { runCli } from '../../../../app/scripts/check-test-budgets.mjs'
const file = 'src/main/infra/net/pop3-tls.test.ts'
const original = readFileSync(file, 'utf8')
try {
  writeFileSync(file, original + '\nsetTimeout(f, Math.max(1000, 5000))\n')
  process.exitCode = runCli()
} finally {
  writeFileSync(file, original)
}
