#!/usr/bin/env node
// 0261 ST-01 (AC2) — 실제 CLI 로 SD-01 을 관측한다. 프롬프트를 보내지 않으므로 API 호출이 없다.
//
//   A  플래그 없이 spawn → setPermissionMode('bypassPermissions') 거부(`not launched` 문구) — 음성 대조
//   B  플래그와 함께 spawn → 수락
//   C  플래그 + local settings `disableBypassPermissionsMode: "disable"` → spawn 정상 · 전환 거부(`disabled` 문구)
//
// 사용: node docs/handoff/0261-bypass-flag-prod-devtools/probe-live-bypass.mjs   (app/node_modules 설치 필요)
// 세 판정이 모두 기대값이면 exit 0, 아니면 1. Orca 대화 spawn 처럼 시작 모드를 명시하고(D-004)
// settingSources 는 ['project','local'] 이다. SDK 를 갱신하면 다시 돌린다 — 안전 근거가 CLI 동작이다.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SDK = join(ROOT, 'app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs')
const { query } = await import(pathToFileURL(SDK).href)

const message = (err) => String(err?.message ?? err)

// 입력 스트림을 열어 둔 채(프롬프트 없음) 초기화와 라이브 전환만 본다.
async function attempt(cwd, extra) {
  let release
  const gate = new Promise((resolve) => (release = resolve))
  const q = query({
    prompt: (async function* () {
      await gate
    })(),
    options: {
      cwd,
      settingSources: ['project', 'local'],
      persistSession: false,
      permissionMode: 'default',
      ...extra
    }
  })
  const result = {}
  try {
    await q.initializationResult()
    result.init = 'ok'
  } catch (err) {
    result.init = `error: ${message(err)}`
  }
  try {
    await q.setPermissionMode('bypassPermissions')
    result.switch = 'ok'
  } catch (err) {
    result.switch = `error: ${message(err)}`
  }
  release()
  q.close?.()
  return result
}

const base = mkdtempSync(join(tmpdir(), 'orca-0261-probe-'))
const plain = join(base, 'plain')
const policy = join(base, 'policy')
mkdirSync(plain)
mkdirSync(join(policy, '.claude'), { recursive: true })
writeFileSync(
  join(policy, '.claude', 'settings.local.json'),
  JSON.stringify({ permissions: { disableBypassPermissionsMode: 'disable' } })
)

const cases = [
  ['A 플래그 없음(음성 대조)', plain, {}, (r) => r.init === 'ok' && /not launched/.test(r.switch)],
  ['B 플래그', plain, { allowDangerouslySkipPermissions: true }, (r) => r.init === 'ok' && r.switch === 'ok'],
  [
    'C 플래그 + 정책 disable',
    policy,
    { allowDangerouslySkipPermissions: true },
    (r) => r.init === 'ok' && /disabled/.test(r.switch)
  ]
]

let ok = true
try {
  for (const [name, cwd, extra, expected] of cases) {
    const r = await attempt(cwd, extra)
    const pass = expected(r)
    ok &&= pass
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  init=${r.init}  switch=${r.switch}`)
  }
} finally {
  rmSync(base, { recursive: true, force: true })
}
console.log(ok ? '판정: 세 케이스 모두 기대값' : '판정: 기대와 다른 케이스가 있다')
process.exit(ok ? 0 : 1)
