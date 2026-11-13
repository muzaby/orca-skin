#!/usr/bin/env node
/**
 * 0318 VP-01 gate — 번역 카탈로그에서 "승인된 54키만, 두 파일에서 똑같이" 빠졌는지 본다.
 *
 *   node docs/handoff/0318-bloat-reduction-0317-approved-candidates/scan/keyset.mjs <기준 커밋> [판정할 디렉터리]
 *
 * 기준 커밋의 ko.ts·en.ts 와 판정 대상(기본 = 작업 트리)의 잎 키·값을 비교한다. 아래 중 하나라도 있으면 exit 1.
 *   남은 승인 키 · 승인 밖 삭제 · 새 키 · 값이 바뀐 키 · 빈 묶음(`{}`) · ko↔en 키 집합 차이
 * 승인 목록의 정본은 0317 `data/audit.json` 의 W-07~W-11 `i18nKeys` 다(W-12 제외 — plan D-003).
 * 대조는 잎 경로의 완전 일치다 — 승인 키 54개는 복수형 잎이 없어 접미사 정규화를 쓰지 않는다.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catalogTree, I18N_KO, I18N_EN } from '../../0317-wide-bloat-audit-stage1/scan/check.mjs'

const APPROVED_IDS = ['W-07', 'W-08', 'W-09', 'W-10', 'W-11']
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const [base, dirArg] = process.argv.slice(2)
if (!base) {
  console.error('usage: keyset.mjs <기준 커밋> [ko.ts·en.ts 가 있는 디렉터리]')
  process.exit(2)
}
const audit = JSON.parse(readFileSync(join(repo, 'docs/handoff/0317-wide-bloat-audit-stage1/data/audit.json'), 'utf8'))
const approved = new Set(audit.candidates.filter((c) => APPROVED_IDS.includes(c.id)).flatMap((c) => c.i18nKeys))
const leaves = (text) => new Map(catalogTree(text).leaves.map((l) => [l.path, l.value]))

let bad = 0
const after = {}
for (const path of [I18N_KO, I18N_EN]) {
  const name = path.split('/').pop()
  const text = readFileSync(dirArg ? join(dirArg, name) : join(repo, path), 'utf8')
  const was = leaves(execFileSync('git', ['-C', repo, 'show', `${base}:${path}`], { encoding: 'utf8' }))
  const now = (after[name] = leaves(text))
  const found = {
    '남은 승인 키': [...approved].filter((k) => now.has(k)),
    '승인 밖 삭제': [...was.keys()].filter((k) => !now.has(k) && !approved.has(k)),
    '새 키': [...now.keys()].filter((k) => !was.has(k)),
    '값 바뀜': [...now].filter(([k, v]) => was.has(k) && was.get(k) !== v).map(([k]) => k),
    '기준에 없는 승인 키': [...approved].filter((k) => !was.has(k)),
    '빈 묶음': text.match(/:\s*\{\s*\}/g) ?? []
  }
  const gone = [...was.keys()].filter((k) => !now.has(k)).length
  console.log(`${name}: 잎 ${was.size} → ${now.size} · 지운 잎 ${gone} · ` + Object.entries(found).map(([k, v]) => `${k} ${v.length}`).join(' · '))
  for (const [kind, list] of Object.entries(found)) for (const k of list) console.log(`  ! ${kind}: ${k}`)
  bad += Object.values(found).reduce((n, v) => n + v.length, 0)
}
const [ko, en] = [after['ko.ts'], after['en.ts']]
const skew = [...ko.keys()].filter((k) => !en.has(k)).concat([...en.keys()].filter((k) => !ko.has(k)))
console.log(`승인 키 ${approved.size} · ko↔en 키 집합 차이 ${skew.length}`)
for (const k of skew) console.log(`  ! ko↔en: ${k}`)
process.exit(bad + skew.length ? 1 : 0)
