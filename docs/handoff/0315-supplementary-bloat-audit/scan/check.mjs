#!/usr/bin/env node
// 0315 보완 감사 — 판정 단위 추출 · 검사(K1~K10) · 렌더 · 중단 규칙 판정.
// 계약 정본: ../plan.md §10 (EP-01~EP-09). 순수 함수는 git·파일 시스템을 받지 않는다.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BASE = 'c1af29f'
const R = 'app/src/renderer/src/features/chat/'
const M = 'app/src/main/'

/** EP-01·EP-02 — 감사 구간(기준 커밋의 줄 번호, 양끝 포함). */
export const AREAS = [
  { id: 'A1', file: `${R}reducer/chatReducer.ts`, ranges: [[961, 1329]], label: 'RECV_EVENT 본문' },
  { id: 'A2', file: `${R}reducer/chatReducer.ts`, ranges: [[1454, 1596]], label: 'LOAD_SESSION 본문' },
  {
    id: 'A3',
    file: `${R}store/chatStore.ts`,
    ranges: [
      [349, 380],
      [470, 644],
      [698, 1010]
    ],
    label: '이벤트 라우팅'
  },
  { id: 'A4', file: `${M}adapters/opencode/v1/session-context.ts`, ranges: [[1, 567]], label: 'session-context' },
  { id: 'A5', file: `${M}features/auth/store.ts`, ranges: [[1, 517]], label: 'auth store' },
  { id: 'A6', file: `${M}adapters/claude/map.ts`, ranges: [[1, 1019]], label: 'claude map' }
]

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
const OPTIONAL = ['excess', 'approval']
export const BLOCKS = ['areas', 'units', 'candidates', 'premises', 'ruling']
export const SMALL_LIMIT = 30

/** EP-07 — 핫패스 진입 심볼. */
export const HOT_ENTRIES = [
  'ingestChatEvent',
  'receive',
  'receiveDeltaBatch',
  'claudeToNormalized',
  'offer',
  'startEvents'
]

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

/** EP-06 — 중단 규칙의 두 축(D-015). 판정은 저장하지 않고 여기서 계산한다. */
export function ruling(candidates) {
  const P = candidates.filter(passes)
  const H = P.filter((c) => c.lens === 'L6' && c.hotEntry !== null && c.hotEntry !== undefined)
  const large = P.filter((c) => c.saving.prod >= SMALL_LIMIT)
  const impl = P.length === 0 ? '없음' : large.length === 0 ? '1건' : '영역별 묶음'
  const reasons = []
  if (H.length > 0) reasons.push('W1')
  if (large.length > 0) reasons.push('W2')
  let bundles = []
  if (impl === '1건') bundles = [{ area: null, ids: P.map((c) => c.id) }]
  if (impl === '영역별 묶음') {
    const byArea = new Map()
    for (const c of P) byArea.set(c.area, [...(byArea.get(c.area) ?? []), c.id])
    bundles = [...byArea].sort(([a], [b]) => a.localeCompare(b)).map(([area, ids]) => ({ area, ids }))
  }
  const brief = (list) => list.map((c) => ({ id: c.id, prod: c.saving.prod }))
  return {
    impl,
    wideAudit: reasons.length > 0 ? '연다' : '열지 않는다',
    reasons,
    bundles,
    P: brief(P),
    H: brief(H)
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
    passes(c) ? '통과' : '걸림'
  ])
  const premiseRows = candidates.map((c) => [
    c.id,
    ...PREMISES.map((k) => `**${c.premises?.[k]?.verdict}** — ${c.premises?.[k]?.evidence}`),
    `**${c.conditions?.ui?.verdict}** — ${c.conditions?.ui?.evidence}`,
    `**${c.conditions?.perf?.verdict}** — ${c.conditions?.perf?.evidence}`
  ])
  const valid = candidates.filter((c) => Number.isInteger(c.saving?.prod))
  const r = ruling(valid)
  const list = (xs) => (xs.length === 0 ? '없음' : xs.map((x) => `${x.id}(${x.prod}줄)`).join(' · '))
  const removes = candidates.filter((c) => c.type === 'remove')
  const rulingText =
    table(
      ['축', '값', '근거'],
      [
        ['구현 건수', r.impl, `통과 후보 P = ${list(r.P)}`],
        [
          '넓은 감사',
          r.wideAudit,
          r.reasons.length === 0
            ? '핫패스 L6 통과 후보 없음 · 30줄 이상 통과 후보 없음'
            : `${r.reasons.join(' · ')} — 핫패스 L6 통과 후보 H = ${list(r.H)}`
        ],
        [
          '구현 묶음',
          r.bundles.length === 0 ? '없음' : r.bundles.map((b) => `${b.area ?? '전체'}: ${b.ids.join(' ')}`).join(' / '),
          `후보 ${candidates.length}건 중 통과 ${r.P.length}건`
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
    premises: table(['후보', '경쟁 가드', '형태 잠금', 'AGENTS 채택 규칙', 'UI', '성능'], premiseRows),
    ruling: rulingText
  }
}

/**
 * K1~K10. `facts` = { fileAt(path) → 기준 커밋 본문 | null, auditMd: string | null }.
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
    if (!blank(c.id) && !/^B-\d{2}$/.test(c.id)) red('K3', `${id} id 형식`)
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
    const listed = new Set([...approvalPart.matchAll(/^\| (B-\d{2}) \|/gm)].map((m) => m[1]))
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
  const mode = argv[0]
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
    const { violations, pending } = check(data, { fileAt, auditMd })
    for (const v of violations) console.error(`RED ${v}`)
    console.log(
      `[0315-audit] 단위 ${(data.units ?? []).length} · 후보 ${(data.candidates ?? []).length} · 위반 ${violations.length} · 대기 ${pending.length}`
    )
    return violations.length === 0 ? 0 : 1
  }
  console.error('usage: check.mjs --check | --write | --units | --ruling')
  return 2
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)))
