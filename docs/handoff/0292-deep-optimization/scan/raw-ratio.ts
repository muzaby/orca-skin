// 0292 §8 실측 — Claude 보관 payload 에서 raw 가 차지하는 몫과 파싱 비용을 잰다.
// 앱의 실제 투영 코드(selectClaudeHistory·mapClaudeHistory)를 쓴다. repo root 의 app/ 에서:
//   ./node_modules/.bin/esbuild ../docs/handoff/0292-deep-optimization/scan/raw-ratio.ts --bundle \
//     --platform=node --format=esm --external:@anthropic-ai/claude-agent-sdk --outfile=.tmp/raw-ratio.mjs
//   node .tmp/raw-ratio.mjs <session.jsonl> <sessionId> <cwd>
import { readFileSync } from 'node:fs'
import {
  mapClaudeHistory,
  selectClaudeHistory
} from '../../../../app/src/main/adapters/claude/native-history-map'

const [file, sessionId, cwd] = process.argv.slice(2)
const text = readFileSync(file, 'utf8')
const entries = text
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line))
const selected = await selectClaudeHistory(sessionId, cwd, entries)
const messages = mapClaudeHistory(selected, sessionId, cwd)
const base = { sessionId, cwd, sourceKey: 'k', revision: 'r', messages }
const full = JSON.stringify({ ...base, raw: entries })
const lean = JSON.stringify(base)
const time = (json: string): number => {
  const start = performance.now()
  JSON.parse(json)
  return +(performance.now() - start).toFixed(1)
}
console.log(
  JSON.stringify({
    fileBytes: text.length,
    entries: entries.length,
    payloadBytes: full.length,
    leanBytes: lean.length,
    rawShare: +((full.length - lean.length) / full.length).toFixed(3),
    parseFullMs: time(full),
    parseLeanMs: time(lean)
  })
)
