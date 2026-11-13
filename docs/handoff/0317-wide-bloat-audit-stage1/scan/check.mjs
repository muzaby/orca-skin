#!/usr/bin/env node
// 0317 넓은 감사 1단계 — 대상 유도 · 판정 단위 추출 · 검사(K1~K12) · 렌더 · 감량 합 판정.
// 계약 정본: ../plan.md §10 (EP-01~EP-10). 0315 scan/check.mjs 를 복사해 plan §11 의 차이 7행만 고쳤다. 순수 함수는 git·파일 시스템을 받지 않는다.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BASE = '1168b67'
const H = 'app/src/renderer/src/features/chat/harnesses/'
const O = 'app/src/main/adapters/opencode/v1/'
const S = 'app/src/renderer/src/shared/'

/** EP-10 T1 — 대상 버킷 접두사(D-002). */
export const BUCKETS = [H, 'app/src/main/adapters/opencode/', 'app/src/main/app/chat-turn/', S]

/** EP-10 T7 — 0315 가 읽은 파일(0315 scan/check.mjs AREAS 의 파일, 중복 제거). */
export const READ_0315 = [
  'app/src/renderer/src/features/chat/reducer/chatReducer.ts',
  'app/src/renderer/src/features/chat/store/chatStore.ts',
  'app/src/main/adapters/opencode/v1/session-context.ts',
  'app/src/main/features/auth/store.ts',
  'app/src/main/adapters/claude/map.ts'
]

const whole = (id, file, lines, label) => ({ id, file, ranges: [[1, lines]], label })

/** EP-01·EP-02 — 감사 구간(파일 전체, 기준 커밋의 줄 수). 경로 사전순. */
export const AREAS = [
  whole('F01', `${O}adapter.ts`, 399, 'opencode adapter'),
  whole('F02', `${O}discovery-cache.ts`, 315, 'opencode discovery cache'),
  whole('F03', `${O}mcp-control.ts`, 335, 'opencode mcp control'),
  whole('F04', `${O}server.ts`, 485, 'opencode server'),
  whole('F05', `${H}claude/composer/QuestionCard.tsx`, 325, 'claude question card'),
  whole('F06', `${H}claude/rightpanel/CanonicalBackgroundContent.tsx`, 410, 'claude background (canonical)'),
  whole('F07', `${H}claude/rightpanel/LegacySubAgentTile.tsx`, 346, 'claude sub-agent tile (legacy)'),
  whole('F08', `${H}common/rightpanel/GitContextBar.tsx`, 328, 'git context bar'),
  whole('F09', `${S}i18n/resources/en.ts`, 1425, 'i18n en'),
  whole('F10', `${S}i18n/resources/ko.ts`, 1434, 'i18n ko'),
  whole('F11', `${S}ui/CascadeMenu.tsx`, 343, 'cascade menu')
]
const I18N_AREAS = ['F09', 'F10']

export const CELLS = ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8', 'L1', 'L5', 'L6']
const EXCESS = CELLS.slice(0, 8)
const LENSES = ['L1', 'L4', 'L5', 'L6']
const TYPES = ['merge', 'restructure', 'remove']
const PREMISES = ['raceGuard', 'formLock', 'agentsRule']
const CONDITIONS = { ui: ['safe', 'risk'], perf: ['equal_or_better', 'worse', 'unknown'] }
const PROGRESS = ['P1', 'P2', 'P3', 'P4']
const TOP_KEYS = ['base', 'progress', 'areas', 'units', 'candidates']
const REQUIRED = [
  'id',
  'area',
  'lens',
  'type',
  'sites',
  'duplicate',
  'preserve',
  'keepStructure',
  'saving',
  'hotEntry',
  'premises',
  'conditions'
]
const OPTIONAL = ['excess', 'approval', 'i18nKeys', 'dynamicPrefix']
export const BLOCKS = ['areas', 'units', 'candidates', 'premises', 'ruling']
export const LIMIT = 30

/** EP-07 — 핫패스 진입 심볼: `messages` 를 구독하는 컴포넌트(D-015). */
export const HOT_ENTRIES = ['CanonicalBackgroundContent', 'LegacySubAgentHeader', 'LegacySubAgentContent']

/** EP-08 — 감사 대상이 아닌 파일(D-006). */
export const EXCLUDED = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.testfixture\./,
  /^app\/scripts\//,
  /^\.github\//,
  /^app\/src\/main\/adapters\/claude\/mock/
]

/** EP-02 P1~P5 — 줄마다 위에서부터 첫 일치만 쓴다. */
const UNIT_PATTERNS = [
  /^(?:export )?(?:async )?function (\w+)/,
  /^ {2}(?:(?:private|public|static|readonly) )*(?:async )?(?!if\b|for\b|while\b|switch\b|return\b|constructor\b)(\w+)\(/,
  /^\s+case '([^']+)':/,
  /^ {2}if \(msg\.type === '(\w+)'/,
  /^(?:export )?const (\w+) = /
]

/** EP-10 T7 — 읽은 파일 집합: 0305 deep·reviews 의 `reviews[].read` 합집합 ∪ extra. */
export function collectRead({ deep, reviews, extra = [] }) {
  const read = new Set(extra)
  for (const doc of [deep, reviews]) for (const row of doc?.reviews ?? []) for (const path of row.read ?? []) read.add(path)
  return read
}

/** EP-10 T1~T6 — `files` = [{path, lines}](lines = 개행 수), `read` = 읽은 경로 집합. 경로 사전순. */
export function deriveTargets({ files, read }) {
  const out = new Set()
  for (const { path, lines } of files) {
    if (!BUCKETS.some((b) => path.startsWith(b))) continue
    if (!/\.tsx?$/.test(path)) continue
    if (/\.test\.|\.testfixture\.|\.d\.ts$/.test(path)) continue
    if (!(lines >= LIMIT_LINES)) continue
    if (read.has(path)) continue
    out.add(path)
  }
  return [...out].sort()
}
export const LIMIT_LINES = 300

/** 구간 줄 범위 안에서 판정 단위를 뽑는다(U6 범위 밖 무시 · U7 같은 이름은 첫 등장만). */
export function extractUnits(text, ranges) {
  const lines = text.split('\n')
  const seen = new Map()
  for (const [from, to] of ranges) {
    for (let n = from; n <= to && n <= lines.length; n++) {
      const line = lines[n - 1]
      for (const pattern of UNIT_PATTERNS) {
        const match = pattern.exec(line)
        if (!match) continue
        if (!seen.has(match[1])) seen.set(match[1], n)
        break
      }
    }
  }
  return [...seen].map(([name, line]) => ({ name, line }))
}

const blank = (v) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
const verdictShape = (v) => v === 'none' || (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string'))
const idsOf = (v) => (Array.isArray(v) ? v : [])
const inRanges = (area, file, line) =>
  area.file === file && area.ranges.some(([from, to]) => line >= from && line <= to)

/** D-008 — 통과 후보. */
export function passes(c) {
  return (
    PREMISES.every((k) => c.premises?.[k]?.verdict === 'clear') &&
    c.conditions?.ui?.verdict === 'safe' &&
    c.conditions?.perf?.verdict === 'equal_or_better'
  )
}

const isI18n = (c) => c.i18nKeys !== undefined

/** EP-06 — 감량 합 판정(D-008·D-016). i18n 미사용 키 후보는 sum·total 밖의 별도 집계다. */
export function ruling(candidates) {
  const main = candidates.filter((c) => !isI18n(c))
  const I = candidates.filter(isI18n)
  const P = main.filter(passes)
  const add = (list) => list.reduce((n, c) => n + c.saving.prod, 0)
  const sum = add(P)
  const blockedCells = (c) => [
    ...PREMISES.filter((k) => c.premises?.[k]?.verdict !== 'clear'),
    ...(c.conditions?.ui?.verdict === 'safe' ? [] : ['ui']),
    ...(c.conditions?.perf?.verdict === 'equal_or_better' ? [] : ['perf'])
  ]
  return {
    verdict: sum < LIMIT ? '0305 계열 종료' : '다음 단계 사용자 결정',
    sum,
    limit: LIMIT,
    P: P.map((c) => ({ id: c.id, prod: c.saving.prod })),
    blocked: main.filter((c) => !passes(c)).map((c) => ({ id: c.id, prod: c.saving.prod, cells: blockedCells(c) })),
    total: add(main),
    i18n: {
      candidates: I.length,
      keys: I.reduce((n, c) => n + (Array.isArray(c.i18nKeys) ? c.i18nKeys.length : 0), 0),
      prod: add(I),
      items: I.map((c) => ({ id: c.id, keys: Array.isArray(c.i18nKeys) ? c.i18nKeys.length : 0, prod: c.saving.prod, pass: passes(c) }))
    }
  }
}

/** 생성 블록 본문을 뽑는다(없으면 null). */
export function readBlock(md, name) {
  const open = `<!-- gen:${name} -->\n`
  const close = `<!-- /gen:${name} -->`
  const start = md.indexOf(open)
  if (start < 0) return null
  const end = md.indexOf(close, start)
  if (end < 0) return null
  return md.slice(start + open.length, end)
}

export function writeBlocks(md, blocks) {
  let out = md
  for (const name of BLOCKS) {
    const open = `<!-- gen:${name} -->\n`
    const close = `<!-- /gen:${name} -->`
    const start = out.indexOf(open)
    const end = out.indexOf(close, start)
    if (start < 0 || end < 0) throw new Error(`audit.md 에 gen:${name} 블록이 없다`)
    out = out.slice(0, start + open.length) + blocks[name] + out.slice(end)
  }
  return out
}

const cell = (v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')
const verdictText = (v) => (v === 'none' ? '—' : Array.isArray(v) ? v.join(' ') : '(대기)')
const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n') + '\n'

/** `audit.json` → 생성 블록 5개. */
export function render(data) {
  const areas = data.areas ?? []
  const units = data.units ?? []
  const candidates = data.candidates ?? []
  const areaRows = AREAS.map((a) => {
    const rec = areas.find((x) => x.id === a.id)
    const lines = a.ranges.reduce((sum, [from, to]) => sum + to - from + 1, 0)
    return [
      a.id,
      `\`${a.file.split('/').pop()}\` ${a.ranges.map(([f, t]) => `${f}-${t}`).join(' · ')} (${lines}줄)`,
      ...CELLS.map((k) => verdictText(rec?.verdicts?.[k])),
      rec?.basis ?? '(대기)'
    ]
  })
  const unitRows = units.map((u) => [u.area, `\`${u.name}\``, verdictText(u.l6), u.basis ?? '(대기)'])
  const candidateRows = candidates.map((c) => [
    c.id,
    c.area,
    c.lens + (c.excess ? ` (${c.excess.join(' ')})` : ''),
    c.type,
    c.duplicate,
    (c.sites ?? []).map((s) => `\`${s}\``).join(' · '),
    c.preserve,
    c.keepStructure,
    `${c.saving?.prod}줄 — ${c.saving?.basis}`,
    c.hotEntry ?? '—',
    (passes(c) ? '통과' : '걸림') + (isI18n(c) ? ` · i18n 키 ${c.i18nKeys.length}개(문턱 밖)` : '')
  ])
  const premiseRows = candidates.map((c) => [
    c.id,
    ...PREMISES.map((k) => `**${c.premises?.[k]?.verdict}** — ${c.premises?.[k]?.evidence}`),
    `**${c.conditions?.ui?.verdict}** — ${c.conditions?.ui?.evidence}`,
    `**${c.conditions?.perf?.verdict}** — ${c.conditions?.perf?.evidence}`,
    isI18n(c) ? c.dynamicPrefix : '—'
  ])
  const valid = candidates.filter((c) => Number.isInteger(c.saving?.prod))
  const r = ruling(valid)
  const list = (xs) => (xs.length === 0 ? '없음' : xs.map((x) => `${x.id}(${x.prod}줄)`).join(' · '))
  const removes = candidates.filter((c) => c.type === 'remove')
  const rulingText =
    table(
      ['항목', '값', '근거'],
      [
        ['판정', r.verdict, `통과 후보 감량 합 ${r.sum}줄 ${r.sum < r.limit ? '<' : '≥'} ${r.limit}줄`],
        ['통과 후보 P', `${r.P.length}건 · ${r.sum}줄`, list(r.P)],
        ['걸린 후보', `${r.blocked.length}건`, r.blocked.length === 0 ? '없음' : r.blocked.map((b) => `${b.id}(${b.prod}줄 — ${b.cells.join('·')})`).join(' · ')],
        ['전체 후보 합(민감도)', `${r.total}줄`, `i18n 미사용 키를 뺀 후보 ${r.P.length + r.blocked.length}건`],
        [
          'i18n 미사용 키(문턱 밖 별도 집계)',
          `후보 ${r.i18n.candidates}건 · 키 ${r.i18n.keys}개 · ${r.i18n.prod}줄`,
          r.i18n.items.length === 0 ? '없음' : r.i18n.items.map((x) => `${x.id}(키 ${x.keys}개 · ${x.prod}줄 · ${x.pass ? '통과' : '걸림'})`).join(' · ')
        ]
      ]
    ) +
    '\n승인 목록(`remove` 유형 — 사용자 승인 뒤에만 제거한다):\n\n' +
    table(
      ['후보', '무엇을 지우는가', '통과 여부'],
      removes.map((c) => [c.id, c.duplicate, passes(c) ? '통과' : '걸림'])
    )
  return {
    areas: table(['구간', '범위', ...CELLS, '판정 근거'], areaRows),
    units: table(['구간', '단위', 'L6', '근거'], unitRows),
    candidates: table(
      ['후보', '구간', '렌즈', '유형', '되풀이되는 것', '자리', '보존 동작', '남기는 구조', '감량(prod)', '핫패스', '통과'],
      candidateRows
    ),
    premises: table(['후보', '경쟁 가드', '형태 잠금', 'AGENTS 채택 규칙', 'UI', '성능', '동적 키 접두사와 겹치지 않는다'], premiseRows),
    ruling: rulingText
  }
}

/**
 * K1~K12. `facts` = { fileAt(path) → 기준 커밋 본문 | null, auditMd: string | null,
 *   files: [{path, lines}], read: Set<path> }(files·read 는 K11 의 입력).
 * 반환 `{ violations, pending }` — 진행표가 완료를 선언하기 전의 빈 판정은 pending 이다.
 */
export function check(data, facts) {
  const violations = []
  const pending = []
  const red = (rule, message) => violations.push(`${rule}: ${message}`)
  const done = PROGRESS.every((p) => data.progress?.[p] === true)
  const wait = (rule, message) => (done ? red(rule, message) : pending.push(`${rule}: ${message}`))

  for (const key of Object.keys(data)) if (!TOP_KEYS.includes(key)) red('K10', `모르는 최상위 키 ${key}`)

  const areas = data.areas ?? []
  const units = data.units ?? []
  const candidates = data.candidates ?? []
  const byId = new Map(candidates.map((c) => [c.id, c]))

  // K11 — 대상 목록 = 유도 결과(양방향). 진행 단계와 무관하게 red 다.
  const targets = new Set(deriveTargets({ files: facts.files ?? [], read: facts.read ?? new Set() }))
  const areaFiles = new Set(AREAS.map((a) => a.file))
  for (const path of targets) if (!areaFiles.has(path)) red('K11', `유도 대상인데 AREAS 에 없다 ${path}`)
  for (const path of areaFiles) if (!targets.has(path)) red('K11', `AREAS 에 있는데 유도 대상이 아니다 ${path}`)

  // K1 — 구간 × 11칸
  const areaIds = areas.map((a) => a.id)
  for (const a of AREAS) if (!areaIds.includes(a.id)) wait('K1', `구간 ${a.id} 판정 없음`)
  for (const a of areas) {
    if (!AREAS.some((x) => x.id === a.id)) {
      red('K1', `모르는 구간 ${a.id}`)
      continue
    }
    for (const k of CELLS) {
      const v = a.verdicts?.[k]
      if (v === undefined || v === null) wait('K1', `${a.id}.${k} 판정 없음`)
      else if (!verdictShape(v)) red('K1', `${a.id}.${k} 값이 후보 ID 배열도 "none" 도 아니다`)
    }
    if (blank(a.basis)) wait('K1', `${a.id} 근거 없음`)
  }

  // K2 — 판정 단위 전수
  const key = (area, name) => `${area}\u0000${name}`
  const extracted = new Set()
  for (const a of AREAS) {
    const text = facts.fileAt(a.file)
    if (text === null) {
      red('K2', `기준 커밋에 ${a.file} 없음`)
      continue
    }
    for (const u of extractUnits(text, a.ranges)) extracted.add(key(a.id, u.name))
  }
  const seenUnits = new Set()
  for (const u of units) {
    const k = key(u.area, u.name)
    if (seenUnits.has(k)) red('K2', `단위 ${u.area}/${u.name} 중복 행`)
    seenUnits.add(k)
    if (!extracted.has(k)) red('K2', `추출되지 않은 단위 ${u.area}/${u.name}`)
    if (u.l6 === undefined || u.l6 === null) wait('K2', `${u.area}/${u.name} L6 판정 없음`)
    else if (!verdictShape(u.l6)) red('K2', `${u.area}/${u.name} L6 값 형식 오류`)
    if (blank(u.basis)) wait('K2', `${u.area}/${u.name} 근거 없음`)
  }
  for (const k of extracted) if (!seenUnits.has(k)) red('K2', `단위 누락 ${k.replace('\u0000', '/')}`)

  // K3~K6·K8·K9 — 후보
  const seenIds = new Set()
  for (const c of candidates) {
    const id = c.id ?? '(id 없음)'
    if (seenIds.has(c.id)) red('K3', `${id} id 중복`)
    seenIds.add(c.id)
    for (const f of REQUIRED) {
      const missing = f === 'hotEntry' ? !(f in c) : blank(c[f])
      if (missing) red('K3', `${id} 필수 칸 ${f} 누락`)
    }
    for (const f of Object.keys(c)) if (![...REQUIRED, ...OPTIONAL].includes(f)) red('K3', `${id} 모르는 키 ${f}`)
    if (!blank(c.id) && !/^W-\d{2}$/.test(c.id)) red('K3', `${id} id 형식`)
    if (!blank(c.area) && !AREAS.some((a) => a.id === c.area)) red('K3', `${id} 모르는 area ${c.area}`)
    if (!blank(c.lens) && !LENSES.includes(c.lens)) red('K3', `${id} 모르는 lens ${c.lens}`)
    if (!blank(c.type) && !TYPES.includes(c.type)) red('K3', `${id} 모르는 type ${c.type}`)

    // K4 — 자리
    const area = AREAS.find((a) => a.id === c.area)
    const sites = Array.isArray(c.sites) ? c.sites : []
    let inside = 0
    for (const site of sites) {
      const match = /^(.+):(\d+)$/.exec(String(site))
      if (!match) {
        red('K4', `${id} 자리 형식 ${site}`)
        continue
      }
      const [, file, lineText] = match
      const line = Number(lineText)
      if (EXCLUDED.some((p) => p.test(file))) red('K4', `${id} 자리가 감사 대상 밖 ${file}`)
      const text = facts.fileAt(file)
      if (text === null) {
        red('K4', `${id} 자리 파일 미실재 ${file}`)
        continue
      }
      if (line < 1 || line > text.split('\n').length) red('K4', `${id} 자리 줄 초과 ${site}`)
      if (area && inRanges(area, file, line)) inside++
    }
    if (c.lens === 'L6' && sites.length < 2) red('K4', `${id} L6 인데 자리 2 미만`)
    if (sites.length > 0 && area && inside === 0) red('K4', `${id} 구간 ${c.area} 안의 자리 0`)

    // K5 — 전제 3칸
    for (const p of PREMISES) {
      const cellValue = c.premises?.[p]
      if (cellValue === undefined) {
        red('K5', `${id} 전제 칸 ${p} 누락`)
        continue
      }
      if (!['clear', 'blocks'].includes(cellValue.verdict)) red('K5', `${id} ${p} 판정 enum 밖`)
      if (blank(cellValue.evidence)) red('K5', `${id} ${p} 근거 없음`)
    }

    // K6 — 조건 2칸
    for (const [name, allowed] of Object.entries(CONDITIONS)) {
      const cellValue = c.conditions?.[name]
      if (cellValue === undefined) {
        red('K6', `${id} 조건 칸 ${name} 누락`)
        continue
      }
      if (!allowed.includes(cellValue.verdict)) red('K6', `${id} ${name} 판정 enum 밖`)
      if (blank(cellValue.evidence)) red('K6', `${id} ${name} 근거 없음`)
    }

    // K8 — 감량 · 핫패스 · 범주
    if (!Number.isInteger(c.saving?.prod) || c.saving.prod < 1) red('K8', `${id} saving.prod 가 1 이상 정수가 아니다`)
    if (blank(c.saving?.basis)) red('K8', `${id} saving.basis 없음`)
    if ('hotEntry' in c && c.hotEntry !== null && !HOT_ENTRIES.includes(c.hotEntry))
      red('K8', `${id} hotEntry 가 진입 심볼이 아니다`)
    if (c.lens === 'L4' && blank(c.excess)) red('K8', `${id} L4 인데 excess 없음`)
    if (c.excess !== undefined && !(Array.isArray(c.excess) && c.excess.every((x) => EXCESS.includes(x))))
      red('K8', `${id} excess 가 X1~X8 밖`)

    // K12 — i18n 미사용 키(D-016)
    const i18nShape = I18N_AREAS.includes(c.area) && c.lens === 'L1' && c.type === 'remove'
    const hasKeys = 'i18nKeys' in c
    const keysOk = Array.isArray(c.i18nKeys) && c.i18nKeys.length > 0 && c.i18nKeys.every((k) => typeof k === 'string' && k.trim() !== '')
    if (i18nShape && !keysOk) red('K12', `${id} i18n 구간의 L1 remove 인데 i18nKeys 없음`)
    if (hasKeys && !i18nShape) red('K12', `${id} i18nKeys 가 있는데 F09·F10 의 L1 remove 가 아니다`)
    if (hasKeys && blank(c.dynamicPrefix)) red('K12', `${id} i18nKeys 가 있는데 dynamicPrefix 근거 없음`)
    if ('dynamicPrefix' in c && !hasKeys) red('K12', `${id} dynamicPrefix 가 있는데 i18nKeys 없음`)

    // K9 — 승인
    if (c.type === 'remove' && c.approval !== 'required') red('K9', `${id} remove 인데 approval≠required`)
    if (c.approval !== undefined && !['required', 'none'].includes(c.approval)) red('K3', `${id} 모르는 approval`)
  }

  // K7 — 연결
  const referencedByArea = new Set()
  for (const a of areas) {
    for (const k of CELLS) {
      for (const id of idsOf(a.verdicts?.[k])) {
        const c = byId.get(id)
        if (!c) {
          red('K7', `${a.id}.${k} 가 없는 후보 ${id} 를 가리킨다`)
          continue
        }
        referencedByArea.add(id)
        if (c.area !== a.id) red('K7', `${a.id}.${k} → ${id} 의 area 불일치(${c.area})`)
        const matches = k.startsWith('X') ? c.lens === 'L4' && idsOf(c.excess).includes(k) : c.lens === k
        if (!matches) red('K7', `${a.id}.${k} → ${id} 의 렌즈·범주 불일치`)
      }
    }
  }
  const referencedByUnit = new Set()
  for (const u of units) {
    for (const id of idsOf(u.l6)) {
      const c = byId.get(id)
      if (!c) {
        red('K7', `단위 ${u.area}/${u.name} 가 없는 후보 ${id} 를 가리킨다`)
        continue
      }
      referencedByUnit.add(id)
      if (c.area !== u.area) red('K7', `단위 ${u.area}/${u.name} → ${id} 의 area 불일치(${c.area})`)
      if (c.lens !== 'L6') red('K7', `단위 ${u.area}/${u.name} → ${id} 는 L6 후보가 아니다`)
    }
  }
  for (const c of candidates) {
    if (!referencedByArea.has(c.id)) red('K7', `${c.id} 를 가리키는 구간 칸이 없다`)
    if (c.lens === 'L6' && !referencedByUnit.has(c.id)) red('K7', `L6 후보 ${c.id} 를 가리키는 단위가 없다`)
  }

  // K9·K10 — 문서 사본
  if (facts.auditMd === null || facts.auditMd === undefined) {
    wait('K10', 'audit.md 없음')
  } else {
    const rendered = render(data)
    for (const name of BLOCKS) {
      const body = readBlock(facts.auditMd, name)
      if (body === null) red('K10', `필수 생성 블록 ${name} 누락`)
      else if (body !== rendered[name]) red('K10', `생성 블록 ${name} ≠ 렌더 결과`)
    }
    const rulingBlock = readBlock(facts.auditMd, 'ruling') ?? ''
    const approvalPart = rulingBlock.split('승인 목록')[1] ?? ''
    const listed = new Set([...approvalPart.matchAll(/^\| (W-\d{2}) \|/gm)].map((m) => m[1]))
    const removes = new Set(candidates.filter((c) => c.type === 'remove').map((c) => c.id))
    const same = listed.size === removes.size && [...removes].every((id) => listed.has(id))
    if (!same) red('K9', '승인 블록과 remove 후보 집합 불일치')
  }

  return { violations, pending }
}

// ── CLI 껍질 ────────────────────────────────────────────────────────────────
function main(argv) {
  const here = dirname(fileURLToPath(import.meta.url))
  const root = join(here, '..')
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).trim()
  const cache = new Map()
  const fileAt = (path) => {
    if (!cache.has(path)) {
      try {
        cache.set(path, execFileSync('git', ['show', `${BASE}:${path}`], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }))
      } catch {
        cache.set(path, null)
      }
    }
    return cache.get(path)
  }
  const targetFacts = () => {
    const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', BASE, '--', ...BUCKETS], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n')
      .filter(Boolean)
    const files = paths.map((path) => ({ path, lines: /\.tsx?$/.test(path) ? (fileAt(path)?.match(/\n/g)?.length ?? 0) : 0 }))
    const json = (name) => JSON.parse(readFileSync(join(repo, 'docs/handoff/0305-code-bloat-audit/data', name), 'utf8'))
    return { files, read: collectRead({ deep: json('deep.json'), reviews: json('reviews.json'), extra: READ_0315 }) }
  }
  const mode = argv[0]
  if (mode === '--targets') {
    const { files, read } = targetFacts()
    const lines = new Map(files.map((f) => [f.path, f.lines]))
    for (const path of deriveTargets({ files, read })) console.log(`${lines.get(path)}\t${path}`)
    return 0
  }
  if (mode === '--units') {
    for (const a of AREAS) for (const u of extractUnits(fileAt(a.file), a.ranges)) console.log(`${a.id}\t${u.name}\t${u.line}`)
    return 0
  }
  const dataPath = join(root, 'data', 'audit.json')
  const mdPath = join(root, 'audit.md')
  const data = JSON.parse(readFileSync(dataPath, 'utf8'))
  if (mode === '--ruling') {
    console.log(JSON.stringify(ruling(data.candidates ?? []), null, 2))
    return 0
  }
  if (mode === '--write') {
    writeFileSync(mdPath, writeBlocks(readFileSync(mdPath, 'utf8'), render(data)))
    console.log('audit.md 생성 블록 갱신')
    return 0
  }
  if (mode === '--check') {
    const auditMd = existsSync(mdPath) ? readFileSync(mdPath, 'utf8') : null
    const { violations, pending } = check(data, { fileAt, auditMd, ...targetFacts() })
    for (const v of violations) console.error(`RED ${v}`)
    console.log(
      `[0317-audit] 단위 ${(data.units ?? []).length} · 후보 ${(data.candidates ?? []).length} · 위반 ${violations.length} · 대기 ${pending.length}`
    )
    return violations.length === 0 ? 0 : 1
  }
  console.error('usage: check.mjs --check | --write | --units | --ruling | --targets')
  return 2
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)))
