#!/usr/bin/env node
// 0317 넓은 감사 1단계 — 대상 유도 · 판정 단위 추출 · 검사(K1~K12) · 렌더 · 감량 합 판정.
// 계약 정본: ../plan.md §10 (EP-01~EP-10). 0315 scan/check.mjs 를 복사해 plan §11 의 차이 7행만 고쳤다. 순수 함수는 git·파일 시스템을 받지 않는다.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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

// ── i18n 미사용 키 근거(D-016 · plan §9 i18n 표) ────────────────────────────
// check()(K1~K12)와 별개인 근거 생성 도구다(r2 — verify r1 발견 1). 키가 참조되는 형태를 형태별로
// 세어 후보 근거의 "참조 0" 주장을 재실행 가능한 명령(`--i18n`) 하나로 만든다.

const lineIndex = (text) => {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return (pos) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}
const IDENT = /[A-Za-z_$][\w$]*/y

function skipQuoted(text, i) {
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++
    else if (text[j] === text[i]) return j + 1
    else if (text[j] === '\n') break
  }
  throw new Error(`닫히지 않은 문자열 @${i}`)
}
function skipTemplate(text, i) {
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++
    else if (text[j] === '`') return j + 1
    else if (text[j] === '$' && text[j + 1] === '{') j = skipBalanced(text, j + 1) - 1
  }
  throw new Error(`닫히지 않은 템플릿 @${i}`)
}
function skipComment(text, j) {
  if (text[j] !== '/') return j
  if (text[j + 1] === '/') {
    const end = text.indexOf('\n', j)
    return end < 0 ? text.length : end
  }
  if (text[j + 1] === '*') {
    const end = text.indexOf('*/', j + 2)
    if (end < 0) throw new Error(`닫히지 않은 주석 @${j}`)
    return end + 2
  }
  return j
}
function skipBalanced(text, i) {
  let depth = 0
  for (let j = i; j < text.length; j++) {
    const c = text[j]
    const after = skipComment(text, j)
    if (after !== j) j = after - 1
    else if (c === "'" || c === '"') j = skipQuoted(text, j) - 1
    else if (c === '`') j = skipTemplate(text, j) - 1
    else if ('{(['.includes(c)) depth++
    else if ('})]'.includes(c) && --depth === 0) return j + 1
  }
  throw new Error(`닫히지 않은 괄호 @${i}`)
}
function skipWs(text, i) {
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++
    const after = skipComment(text, i)
    if (after === i) return i
    i = after
  }
}
/** 값 식의 끝(마지막 토큰 다음 위치). 깊이 0 의 `,`·`}` 에서 멈춘다 · `satisfies`/`as` 뒤 타입의 `<>` 는 괄호로 센다. */
function skipValue(text, i) {
  let j = i
  let last = i
  let typeMode = false
  let angle = 0
  while (j < text.length) {
    const c = text[j]
    const after = skipComment(text, j)
    if (/\s/.test(c)) j++
    else if (after !== j) j = after
    else if (angle === 0 && (c === ',' || c === '}')) break
    else {
      if (c === "'" || c === '"') j = skipQuoted(text, j)
      else if (c === '`') j = skipTemplate(text, j)
      else if ('{(['.includes(c)) j = skipBalanced(text, j)
      else if (typeMode && (c === '<' || c === '>')) {
        angle += c === '<' ? 1 : -1
        j++
      } else if (/[A-Za-z_$]/.test(c)) {
        IDENT.lastIndex = j
        const word = IDENT.exec(text)[0]
        if (word === 'satisfies' || word === 'as') typeMode = true
        j += word.length
      } else j++
      last = j
    }
  }
  return last
}

/**
 * 카탈로그 본문(`export const <이름>[: 타입] = { … }`)의 잎 키와 객체를 줄 범위와 함께 낸다.
 * 키는 식별자 또는 따옴표 문자열 · 값은 문자열·템플릿·객체·그 밖의 식. 펼침·계산 키·축약 속성은 모르는 형태라 throw 한다.
 */
export function catalogTree(text) {
  const head = /export const (\w+)(?:\s*:[^=]*)?\s*=\s*\{/.exec(text)
  if (!head) throw new Error('카탈로그 선언이 없다')
  const lineOf = lineIndex(text)
  const leaves = []
  const objects = []
  const parseObject = (open, path, keyAt) => {
    let i = open + 1
    for (;;) {
      i = skipWs(text, i)
      if (text[i] === '}') {
        if (path) objects.push({ path, from: lineOf(keyAt), to: lineOf(i) })
        return i + 1
      }
      if (text[i] === ',') {
        i++
        continue
      }
      const keyAt2 = i
      let key
      if (text[i] === "'" || text[i] === '"') {
        const end = skipQuoted(text, i)
        key = text.slice(i + 1, end - 1)
        i = end
      } else {
        IDENT.lastIndex = i
        const m = IDENT.exec(text)
        if (!m || m.index !== i) throw new Error(`모르는 속성 형태 @${lineOf(i)}줄`)
        key = m[0]
        i += key.length
      }
      i = skipWs(text, i)
      if (text[i] !== ':') throw new Error(`모르는 속성 형태(콜론 없음) @${lineOf(i)}줄`)
      i = skipWs(text, i + 1)
      const child = path ? `${path}.${key}` : key
      if (text[i] === '{') i = skipValue(text, parseObject(i, child, keyAt2))
      else {
        const end = skipValue(text, i)
        leaves.push({ path: child, from: lineOf(keyAt2), to: lineOf(end - 1), value: text.slice(i, end) })
        i = end
      }
    }
  }
  parseObject(head.index + head[0].length - 1, '', head.index)
  return { name: head[1], leaves, objects }
}

/**
 * 잎 키 집합을 지울 때 사라지는 줄. 같은 줄에 남는 속성이 있으면 그 줄은 남고, 자식이 전부 지워진 객체는 함께 지운다.
 * 주석·빈 줄은 세지 않는다. 반환 `{ lines, sites(키마다 첫 줄), missing(카탈로그에 없는 키), objects(함께 지워지는 객체) }`.
 */
export function catalogRemoval(tree, keys) {
  const leafByPath = new Map(tree.leaves.map((l) => [l.path, l]))
  const present = keys.filter((k) => leafByPath.has(k))
  const removed = new Set(present)
  const parentOf = (p) => (p.includes('.') ? p.slice(0, p.lastIndexOf('.')) : '')
  const children = new Map()
  for (const n of [...tree.leaves, ...tree.objects]) {
    const parent = parentOf(n.path)
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent).push(n.path)
  }
  const deepestFirst = [...tree.objects].sort((a, b) => b.path.split('.').length - a.path.split('.').length)
  for (const o of deepestFirst) {
    const ch = children.get(o.path) ?? []
    if (ch.length > 0 && ch.every((c) => removed.has(c))) removed.add(o.path)
  }
  const occupants = new Map()
  const occupy = (line, id) => {
    if (!occupants.has(line)) occupants.set(line, new Set())
    occupants.get(line).add(id)
  }
  for (const l of tree.leaves) for (let n = l.from; n <= l.to; n++) occupy(n, l.path)
  for (const o of tree.objects) {
    occupy(o.from, o.path)
    occupy(o.to, o.path)
  }
  const lines = [...occupants]
    .filter(([, ids]) => [...ids].every((id) => removed.has(id)))
    .map(([n]) => n)
    .sort((a, b) => a - b)
  return {
    lines,
    sites: present.map((k) => leafByPath.get(k).from),
    missing: keys.filter((k) => !leafByPath.has(k)),
    objects: tree.objects.filter((o) => removed.has(o.path)).map((o) => o.path)
  }
}

/**
 * 잎 키를 지운 카탈로그 본문 — catalogRemoval 의 줄을 빼고, 본문에서 더 쓰지 않는 이름 import(`import { … } from`)를
 * 목록에서 뺀다(목록이 비면 그 줄을 지운다). 반환 `{ text, lines, droppedImports }`.
 */
export function stripCatalog(text, keys) {
  const { lines } = catalogRemoval(catalogTree(text), keys)
  const drop = new Set(lines)
  const kept = text.split('\n').filter((_, i) => !drop.has(i + 1))
  const droppedImports = []
  const out = []
  for (let i = 0; i < kept.length; i++) {
    const m = /^import \{([^}]*)\} from (.+)$/.exec(kept[i])
    if (!m) {
      out.push(kept[i])
      continue
    }
    const rest = [...kept.slice(0, i), ...kept.slice(i + 1)].join('\n')
    const specs = m[1].split(',').map((s) => s.trim()).filter(Boolean)
    const keep = specs.filter((s) => new RegExp(`\\b${s.split(/\s+as\s+/).pop().replace(/^type\s+/, '')}\\b`).test(rest))
    droppedImports.push(...specs.filter((s) => !keep.includes(s)))
    if (keep.length > 0) out.push(keep.length === specs.length ? kept[i] : `import { ${keep.join(', ')} } from ${m[2]}`)
  }
  return { text: out.join('\n'), lines, droppedImports }
}

/**
 * 본문의 두 보기(길이·줄바꿈 보존). comments: 주석만 공백 · code: 주석과 문자열·템플릿 정적 부분까지 공백(`${…}` 안은 코드로 둔다).
 * 같은 줄에서 닫히지 않는 따옴표·닫히지 않는 백틱은 문자로 본다(정규식 리터럴 안의 따옴표).
 */
export function codeViews(text) {
  const comments = text.split('')
  const code = text.split('')
  const blank = (arr, from, to) => {
    for (let k = from; k < to; k++) if (arr[k] !== '\n') arr[k] = ' '
  }
  const scanTemplate = (i) => {
    const marks = []
    let j = i + 1
    let segStart = j
    while (j < text.length) {
      if (text[j] === '\\') j += 2
      else if (text[j] === '`') {
        marks.push([segStart, j])
        for (const [a, b] of marks) blank(code, a, b)
        return j + 1
      } else if (text[j] === '$' && text[j + 1] === '{') {
        marks.push([segStart, j])
        j = scanCode(j + 2, true)
        segStart = j
      } else j++
    }
    return i + 1
  }
  const scanCode = (i, inExpr) => {
    let depth = 0
    while (i < text.length) {
      const ch = text[i]
      if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
        const end = skipComment(text, i)
        blank(comments, i, end)
        blank(code, i, end)
        i = end
      } else if (ch === "'" || ch === '"') {
        let j = i + 1
        while (j < text.length && text[j] !== ch && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1
        if (text[j] === ch) {
          const index = /\[\s*$/.test(text.slice(Math.max(0, i - 8), i)) && /^\s*\]/.test(text.slice(j + 1, j + 9))
          if (!index) blank(code, i + 1, j)
          i = j + 1
        } else i++
      } else if (ch === '`') i = scanTemplate(i)
      else {
        if (inExpr && ch === '{') depth++
        else if (inExpr && ch === '}') {
          if (depth === 0) return i + 1
          depth--
        }
        i++
      }
    }
    return i
  }
  scanCode(0, false)
  return { comments: comments.join(''), code: code.join('') }
}

const CHAIN = /[A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*|\s*(?:\?\.)?\[\s*(['"])[\w$-]+\1\s*\])+/g
const CHAIN_SPLIT = /\s*\??\.\s*|\s*(?:\?\.)?\[\s*['"]|['"]\s*\]/
/** 리소스 객체로 보는 루트 이름 — 조상 객체 통째·계산 접근 형태(`ancestorProp`)에만 쓴다. */
export const CATALOG_ROOTS = ['ko', 'en']

/**
 * 키 모양 표식 색인. 코드(`.md` 밖): 점을 담은 따옴표 문자열 · 멤버 체인(점·`?.`·정적 대괄호) · 템플릿 머리/꼬리.
 * 문서(`.md`): 점 경로 낱말. `files` = [{path, text}].
 */
export function refIndex(files) {
  const idx = { strings: new Map(), chains: new Map(), rooted: new Map(), heads: [], tails: [], words: new Map() }
  const put = (map, k, loc) => {
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(loc)
  }
  for (const { path, text } of files) {
    const lineOf = lineIndex(text)
    if (path.endsWith('.md')) {
      for (const m of text.matchAll(/(?<![\w$./-])[A-Za-z_$][\w$-]*(?:\.[A-Za-z_$][\w$-]*)+(?:\.\*)?/g))
        put(idx.words, m[0], { path, line: lineOf(m.index), text: m[0] })
      continue
    }
    const view = codeViews(text)
    for (const m of view.comments.matchAll(/(['"`])([\w.:-]+)\1/g)) if (m[2].includes('.')) put(idx.strings, m[2], { path, line: lineOf(m.index), text: m[0] })
    for (const m of view.code.matchAll(CHAIN)) {
      const segs = m[0].split(CHAIN_SPLIT).filter(Boolean)
      const loc = { path, line: lineOf(m.index), text: m[0].replace(/\s+/g, '') }
      for (let a = 0; a < segs.length; a++) for (let b = a + 2; b <= segs.length; b++) put(idx.chains, segs.slice(a, b).join('.'), loc)
      if (CATALOG_ROOTS.includes(segs[0])) put(idx.rooted, segs.slice(1).join('.'), loc)
    }
    for (const m of view.comments.matchAll(/`([\w.:-]*)\$\{/g)) if (m[1].includes('.')) idx.heads.push({ path, line: lineOf(m.index), head: m[1] })
    for (const m of view.comments.matchAll(/\}([\w.:-]*)`/g)) if (m[1].startsWith('.') && m[1].length > 1) idx.tails.push({ path, line: lineOf(m.index), tail: m[1] })
  }
  return idx
}

const PLURAL = ['', '_zero', '_one', '_two', '_few', '_many', '_other', '_plural']
/** 형태 이름 — 정적 참조(STATIC) · 템플릿 조립(TEMPLATE) · 문서 언급(DOC). */
export const REF_FORMS = {
  STATIC: ['string', 'prop', 'ancestorString', 'ancestorProp'],
  TEMPLATE: ['templateHead', 'templateHeadLoose', 'templateTail'],
  DOC: ['bare', 'bareAncestor']
}

/**
 * 키 하나가 색인에 나타나는 자리를 형태별로 낸다.
 * string: 키 경로와 같은 따옴표 문자열(복수형 접미사 · `translation:` 접두 포함) · prop: 키 경로를 담은 멤버 체인(루트 무관) ·
 * ancestorString: 조상 경로 문자열(2단 이상은 그대로, 1단은 끝 점 붙은 것만 — 끝 점 형태는 2단 이상도) ·
 * ancestorProp: ko/en 에서 시작해 조상에서 끝나는 체인(통째·계산 접근) · templateHead: 점으로 끝나는 머리(plan §9 1단계 형태) ·
 * templateHeadLoose: 점을 담되 점으로 끝나지 않는 머리 · templateTail: 점으로 시작하는 꼬리 · bare/bareAncestor: 문서 낱말.
 */
export function i18nRefs(idx, key) {
  const segs = key.split('.')
  const ancestors = segs.slice(0, -1).map((_, i) => segs.slice(0, i + 1).join('.'))
  const hits = []
  const add = (form, locs) => {
    for (const loc of locs ?? []) hits.push({ form, ...loc })
  }
  for (const v of [...PLURAL.map((s) => key + s), `translation:${key}`]) add('string', idx.strings.get(v))
  add('prop', idx.chains.get(key))
  for (const a of ancestors) {
    if (a.includes('.')) add('ancestorString', idx.strings.get(a))
    add('ancestorString', idx.strings.get(`${a}.`))
    add('ancestorProp', idx.rooted.get(a))
  }
  for (const h of idx.heads)
    if (key.startsWith(h.head)) hits.push({ form: h.head.endsWith('.') ? 'templateHead' : 'templateHeadLoose', path: h.path, line: h.line, text: h.head })
  for (const t of idx.tails) if (key.endsWith(t.tail)) hits.push({ form: 'templateTail', path: t.path, line: t.line, text: t.tail })
  add('bare', idx.words.get(key))
  for (const [word, locs] of idx.words) if (word.endsWith(`.${key}`)) add('bare', locs)
  for (const a of ancestors.filter((x) => x.includes('.'))) {
    add('bareAncestor', idx.words.get(a))
    add('bareAncestor', idx.words.get(`${a}.*`))
  }
  return hits
}

// ── §9 i18n 유도(plan rev.3 참조 형태 표) — 순수 함수. `--i18n` 은 기준 커밋에서 파일을 모아 넘기기만 한다 ──
export const I18N_KO = `${S}i18n/resources/ko.ts`
export const I18N_EN = `${S}i18n/resources/en.ts`
const I18N_CODE = /\.(?:[cm]?[jt]sx?|json)$/
const PLURAL_SUFFIX = /_(?:zero|one|two|few|many|other)$/
/** §9 i18n 2단계의 키 — 잎 경로에서 복수형 접미사(`_zero`~`_other`)를 뗀 것. */
export const i18nBase = (key) => key.replace(PLURAL_SUFFIX, '')
/** §9 `formLock` 의 test 범위 — `*.test.*` · `*.testfixture.*` · `app/scripts/**` · `app/eslint.config.mjs`. */
export const isI18nTest = (p) => /\.test\.|\.testfixture\./.test(p) || p.startsWith('app/scripts/') || p === 'app/eslint.config.mjs'

/**
 * §9 i18n 범위 — 경로 목록 → `{ prod, test }`(입력 순서 유지). 둘 다 `app/src/**` · `app/scripts/**` · `app/eslint.config.mjs` 의
 * 코드 파일(`.[cm]?[jt]sx?` · `.json`)만 본다. prod = `app/src/**` 의 test 아닌 파일에서 리소스 2파일을 뺀 것 · test = `isI18nTest`.
 */
export function i18nScopes(paths) {
  const inRoots = (p) => p.startsWith('app/src/') || p.startsWith('app/scripts/') || p === 'app/eslint.config.mjs'
  const code = paths.filter((p) => inRoots(p) && I18N_CODE.test(p))
  return {
    prod: code.filter((p) => p.startsWith('app/src/') && !isI18nTest(p) && p !== I18N_KO && p !== I18N_EN),
    test: code.filter(isI18nTest)
  }
}

/** §9 i18n 1단계 명령의 범위 — prod 중 이 접두사 아래 파일. */
const STEP1_ROOTS = ['app/src/renderer/src/', 'app/src/shared/']

/**
 * §9 i18n 1~3단계 — `koText`(ko.ts 본문) · `prod`([{path, text}] — `i18nScopes` 의 prod 파일) → 유도.
 * 키(`i18nBase`)마다 prod 에 STATIC 형태 참조가 1개라도 있으면 referenced, 아니고 1단계 번역 키 접두사로 시작하면 prefixed,
 * 둘 다 아니면 eligible(후보 자격)이다. TEMPLATE·DOC 형태는 판정에 쓰지 않는다(형태 표 — 보고만).
 */
export function deriveI18n({ koText, prod }) {
  const keys = catalogTree(koText).leaves.map((l) => l.path)
  const step1 = []
  for (const f of prod) {
    if (!STEP1_ROOTS.some((root) => f.path.startsWith(root))) continue
    const lineOf = lineIndex(f.text)
    for (const m of f.text.matchAll(/`([A-Za-z0-9_.]+\.)\$\{/g)) step1.push({ path: f.path, line: lineOf(m.index), head: m[1] })
  }
  const heads = [...new Set(step1.map((s) => s.head))].sort()
  const keyHeads = heads.filter((h) => keys.some((k) => k.startsWith(h)))
  const idx = refIndex(prod)
  const bases = [...new Set(keys.map(i18nBase))]
  const referenced = []
  const prefixed = []
  const eligible = []
  for (const b of bases) {
    if (i18nRefs(idx, b).some((h) => REF_FORMS.STATIC.includes(h.form))) referenced.push(b)
    else if (keyHeads.some((h) => b.startsWith(h))) prefixed.push(b)
    else eligible.push(b)
  }
  return { keys, step1, heads, keyHeads, idx, bases, referenced, prefixed, eligible }
}

/**
 * 후보 키 하나의 형태별 집계 — `idx` = `{ prod, test, rule }` 색인. prod 의 TEMPLATE 은 `template` 로 세고 다른 범위의 TEMPLATE 은
 * 세지 않는다(`counted: false`). 그 밖은 범위 이름으로 센다 — test 는 `formLock` 근거(STATIC), rule 은 `agentsRule` 근거(DOC).
 * `step1` = 1단계 번역 키 접두사로 시작하면 1. 반환 `{ tally, hits }` — hits 는 세지 않은 적중까지 담는다.
 */
export function refTally({ idx, key, keyHeads }) {
  const tally = { prod: 0, test: 0, rule: 0, template: 0, step1: keyHeads.some((h) => key.startsWith(h)) ? 1 : 0 }
  const hits = []
  for (const scope of ['prod', 'test', 'rule']) {
    for (const h of i18nRefs(idx[scope], key)) {
      const template = REF_FORMS.TEMPLATE.includes(h.form)
      const counted = !(template && scope !== 'prod')
      hits.push({ scope, counted, ...h })
      if (counted) tally[template ? 'template' : scope]++
    }
  }
  return { tally, hits }
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
  if (mode === '--i18n') return i18nReport({ repo, fileAt, data })
  if (mode === '--i18n-strip') return i18nStrip({ repo, fileAt, data, args: argv.slice(1) })
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
  console.error('usage: check.mjs --check | --write | --units | --ruling | --targets | --i18n')
  return 2
}

/**
 * `--i18n-strip <app 디렉터리> <W-ID…|all> [--except 키,키]` — 삭제 실험용. 기준 커밋의 ko.ts·en.ts 에서 고른 i18n 후보 키를
 * 지운 본문을 그 디렉터리(기준 커밋 사본)에 쓴다. 지운 뒤 다시 파싱해 "남은 키 = 전체 − 지운 잎"을 양방향 차집합으로 본다.
 */
function i18nStrip({ repo, fileAt, data, args }) {
  const [dir, ...rest] = args
  const exceptAt = rest.indexOf('--except')
  const except = exceptAt >= 0 ? rest[exceptAt + 1].split(',') : []
  const ids = rest.filter((x, i) => !x.startsWith('--') && !(exceptAt >= 0 && i === exceptAt + 1))
  if (!dir || ids.length === 0) {
    console.error('usage: check.mjs --i18n-strip <app 디렉터리> <W-ID…|all> [--except 키,키]')
    return 2
  }
  if (resolve(dir) === join(repo, 'app') || !existsSync(join(dir, `${S}i18n/resources/ko.ts`.replace(/^app\//, '')))) {
    console.error('기준 커밋 사본의 app 디렉터리만 받는다(작업 트리 app/ · 리소스 파일이 없는 디렉터리는 거부)')
    return 2
  }
  const picked = data.candidates.filter((c) => Array.isArray(c.i18nKeys) && (ids.includes('all') || ids.includes(c.id)))
  const bases = picked.flatMap((c) => c.i18nKeys).filter((k) => !except.includes(k))
  let ok = true
  for (const name of ['ko', 'en']) {
    const path = `${S}i18n/resources/${name}.ts`
    const text = fileAt(path)
    const all = catalogTree(text).leaves.map((l) => l.path)
    const leaves = all.filter((p) => bases.includes(i18nBase(p)))
    const stripped = stripCatalog(text, leaves)
    const left = catalogTree(stripped.text).leaves.map((l) => l.path)
    const expected = all.filter((p) => !leaves.includes(p))
    const gap = expected.filter((p) => !left.includes(p)).length + left.filter((p) => !expected.includes(p)).length
    if (gap > 0 || leaves.length !== bases.length) ok = false
    writeFileSync(join(dir, path.replace(/^app\//, '')), stripped.text)
    console.log(`${name}.ts: 후보 ${picked.map((c) => c.id).join(',')} · 키 ${bases.length} · 잎 ${leaves.length} · 삭제 줄 ${stripped.lines.length} · 뺀 import ${stripped.droppedImports.join(',') || '없음'} · 남은 잎 ${left.length} · 기대와 차집합 ${gap}`)
  }
  return ok ? 0 : 1
}

/** `--i18n` — i18n 미사용 키 근거 보고(기준 커밋 트리 · prod/test/rule 세 범위). */
function i18nReport({ repo, fileAt, data }) {
  const KO = I18N_KO
  const EN = I18N_EN
  const koTree = catalogTree(fileAt(KO))
  const enTree = catalogTree(fileAt(EN))
  const koKeys = koTree.leaves.map((l) => l.path)
  const enKeys = enTree.leaves.map((l) => l.path)
  const diff = (a, b) => a.filter((x) => !new Set(b).has(x))
  const ls = (...paths) =>
    execFileSync('git', ['ls-tree', '-r', '--name-only', BASE, '--', ...paths], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n')
      .filter(Boolean)
  const readMany = (paths) => {
    if (paths.length === 0) return []
    const out = execFileSync('git', ['cat-file', '--batch'], { cwd: repo, input: paths.map((p) => `${BASE}:${p}`).join('\n') + '\n', maxBuffer: 1024 * 1024 * 1024 })
    const files = []
    let pos = 0
    for (const path of paths) {
      const nl = out.indexOf(10, pos)
      const header = out.subarray(pos, nl).toString()
      if (header.endsWith(' missing')) throw new Error(`기준 커밋에 없다 ${path}`)
      const size = Number(header.split(' ')[2])
      files.push({ path, text: out.subarray(nl + 1, nl + 1 + size).toString('utf8') })
      pos = nl + 1 + size + 1
    }
    return files
  }
  const scopePaths = i18nScopes(ls('app/src', 'app/scripts', 'app/eslint.config.mjs'))
  const RULE_HANDOFF = /^docs\/handoff\/03(?:0[5-9]|1[0-6])-[^/]+\/plan\.md$|^docs\/handoff\/0314-0305-derivative-closeout\/ledger\.md$/
  const scopes = {
    prod: readMany(scopePaths.prod),
    test: readMany(scopePaths.test),
    rule: readMany(
      ls('AGENTS.md', 'app/AGENTS.md', 'app/src/main/AGENTS.md', 'app/src/renderer/AGENTS.md', 'docs/arch', 'docs/decisions', 'docs/handoff').filter(
        (p) => p.endsWith('.md') && (!p.startsWith('docs/handoff/') || RULE_HANDOFF.test(p))
      )
    )
  }
  const derived = deriveI18n({ koText: fileAt(KO), prod: scopes.prod })
  const idx = { prod: derived.idx, test: refIndex(scopes.test), rule: refIndex(scopes.rule) }
  const loc = (h) => `${h.path.replace(/^app\/src\/renderer\/src\//, 'r/').replace(/^app\/src\//, 'src/')}:${h.line}`
  const leavesOf = (tree, bases) => tree.leaves.map((l) => l.path).filter((p) => bases.includes(i18nBase(p)))
  const out = (s) => console.log(s)

  out(`[i18n] 기준 ${BASE} · 잎 키 ko ${koKeys.length} · en ${enKeys.length} · ko−en ${diff(koKeys, enKeys).length} · en−ko ${diff(enKeys, koKeys).length}`)
  out(`[i18n] 범위 파일 prod ${scopes.prod.length} · test ${scopes.test.length} · rule ${scopes.rule.length}`)

  // plan §9 1단계 — 명령 범위(renderer/src + shared, test 제외)의 `접두사.${` 머리(deriveI18n)
  const { step1, heads: step1Heads, keyHeads } = derived
  out(`[i18n] 1단계 줄 ${new Set(step1.map(loc)).size} · 접두사 ${step1Heads.length} · 번역 키 접두사 ${keyHeads.length}: ${keyHeads.join(' ')}`)
  out(`[i18n] 1단계 번역 키가 아닌 접두사: ${diff(step1Heads, keyHeads).join(' ') || '없음'}`)

  // 유도 — prod 정적 참조 0 ∧ 1단계 접두사 밖(deriveI18n)
  const { bases, referenced, prefixed, eligible } = derived
  const audited = data.candidates.filter((c) => Array.isArray(c.i18nKeys)).flatMap((c) => c.i18nKeys)
  out(`[i18n] 유도: 키(복수형 접미사 뗌) ${bases.length} · prod 정적 참조 있음 ${referenced.length} · 0 ${prefixed.length + eligible.length}(1단계 접두사로 쓰임 ${prefixed.length} · 후보 자격 ${eligible.length})`)
  const leafCount = (set) => koKeys.filter((k) => set.includes(i18nBase(k))).length
  out(`[i18n] 유도(잎 기준): 0 ${leafCount(prefixed) + leafCount(eligible)}(1단계 접두사로 쓰임 ${leafCount(prefixed)} · 후보 자격 ${leafCount(eligible)})`)
  out(`[i18n] 1단계 접두사별(키 · 잎): ${keyHeads.map((h) => `${h} ${prefixed.filter((b) => b.startsWith(h)).length}·${koKeys.filter((k) => k.startsWith(h) && prefixed.includes(i18nBase(k))).length}`).join(' · ')}`)
  out(`[i18n] 유도−audit.json: ${diff(eligible, audited).join(' ') || '∅'}`)
  out(`[i18n] audit.json−유도: ${diff(audited, eligible).join(' ') || '∅'}`)

  const consumers = Object.entries(scopes).flatMap(([scope, files]) =>
    files.filter((f) => /from ['"][^'"]*(?:i18n\/resources|\.)\/(?:ko|en)['"]/.test(f.text)).map((f) => `${scope}:${loc({ path: f.path, line: 0 }).replace(/:0$/, '')}`)
  )
  out(`[i18n] 리소스 모듈을 import 하는 파일 ${consumers.length}: ${consumers.join(' ')}`)
  const textReaders = Object.entries(scopes).flatMap(([scope, files]) =>
    files.filter((f) => /(?:resources\/|['"])(?:ko|en)\.ts['"]/.test(f.text)).map((f) => `${scope}:${loc({ path: f.path, line: 0 }).replace(/:0$/, '')}`)
  )
  out(`[i18n] 카탈로그 원문을 읽는 파일 ${textReaders.length}: ${textReaders.join(' ')}`)

  // 후보별
  const all = { ko: new Set(), en: new Set() }
  for (const c of data.candidates.filter((x) => Array.isArray(x.i18nKeys))) {
    const koRm = catalogRemoval(koTree, leavesOf(koTree, c.i18nKeys))
    const enRm = catalogRemoval(enTree, leavesOf(enTree, c.i18nKeys))
    koRm.lines.forEach((n) => all.ko.add(n))
    enRm.lines.forEach((n) => all.en.add(n))
    const sites = [...koRm.sites.map((n) => `${KO}:${n}`), ...enRm.sites.map((n) => `${EN}:${n}`)]
    const missing = c.i18nKeys.filter((k) => leavesOf(koTree, [k]).length === 0)
    out(`\n== ${c.id} 키 ${c.i18nKeys.length} · 삭제 줄 ko ${koRm.lines.length} + en ${enRm.lines.length} = ${koRm.lines.length + enRm.lines.length}(audit ${c.saving.prod}) · 함께 비는 객체 ${koRm.objects.join(' ') || '없음'}`)
    out(`   sites 유도−audit ${diff(sites, c.sites).length} · audit−유도 ${diff(c.sites, sites).length} · 카탈로그에 없는 키 ${missing.join(' ') || '0'}`)
    const tally = { prod: 0, test: 0, rule: 0, template: 0, step1: 0 }
    for (const key of c.i18nKeys) {
      const rows = []
      const seen = new Set()
      const one = refTally({ idx, key, keyHeads })
      for (const k of Object.keys(tally)) tally[k] += one.tally[k]
      for (const h of one.hits) {
        seen.add(`${h.path}:${h.line}`)
        if (h.counted) rows.push(`${h.scope} ${h.form} ${loc(h)} «${h.text}»`)
      }
      for (const [scope, files] of Object.entries(scopes)) {
        for (const f of files) {
          let at = f.text.indexOf(key)
          while (at >= 0) {
            const line = f.text.slice(0, at).split('\n').length
            if (!seen.has(`${f.path}:${line}`)) {
              const text = f.text.split('\n')[line - 1].trim().slice(0, 110)
              rows.push(`${scope} substr ${loc({ path: f.path, line })} «${text}»`)
              seen.add(`${f.path}:${line}`)
            }
            at = f.text.indexOf(key, at + key.length)
          }
        }
      }
      for (const r of rows) out(`   ${key} — ${r}`)
    }
    out(`   합계 prod 정적 ${tally.prod} · test 정적 ${tally.test} · rule 문서 ${tally.rule} · prod 템플릿 ${tally.template} · 1단계 접두사 겹침 ${tally.step1}`)
  }
  const together = (tree) => catalogRemoval(tree, leavesOf(tree, audited)).lines.length
  out(`\n[i18n] 후보 전부를 함께 지울 때 삭제 줄 ko ${together(koTree)} + en ${together(enTree)} = ${together(koTree) + together(enTree)}(후보별 줄의 합집합 ${all.ko.size + all.en.size})`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)))
