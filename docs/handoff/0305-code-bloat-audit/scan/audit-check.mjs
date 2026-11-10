#!/usr/bin/env node
// 0305 감사 검사·렌더 — plan §10 EP-06 규칙 K1~K14 · K17 · K7b · K18 · K19.
// 사용: node audit-check.mjs --check   → 위반 목록 (0 이면 exit 0)
//       node audit-check.mjs --write   → audit.md 생성 블록 갱신
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyBucket, countLines } from './volume.mjs'

export const LENSES = ['L1', 'L4', 'L5']
export const TYPES = ['remove', 'restructure']
export const EXCESS = ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7']
export const EFFECTS = ['user', 'none']
export const TRACE_IDS = ['T1', 'T2', 'T3', 'T4', 'T5']
export const DENSITY = ['excess', 'necessary']
export const DEEP_MIN_PROD = 3000
export const BLOCKS = ['volume', 'scenarios', 'candidates', 'approvals', 'traces', 'reviews', 'deep', 'decomposition', 'split']
const REQUIRED = ['bucket', 'lens', 'type', 'scenarios', 'origin', 'preserve', 'evidence', 'saving', 'risk']
const TOP_KEYS = {
  scenarios: ['scenarios', 'unreached'],
  candidates: ['lenses', 'candidates', 'approvals'],
  traces: ['traces'],
  reviews: ['reviews'],
  deep: ['reviews'],
  split: ['handoffs', 'deferred']
}
const CANDIDATE_KEYS = [...REQUIRED, 'id', 'title', 'excess', 'decisionChange', 'approval', 'superseded', 'decomposition']

const blank = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)
const num = (id) => Number.parseInt(id, 10)

// data: { volume, scenarios, candidates, traces, reviews, split, auditMd } — 없는 단계는 undefined.
// facts: { channels:Set, features:string[], fileExists(path), fileContains(path, text), handoffIds:Set }
// 반환: { errors: string[], pending: string[] }
export function check(data, facts, { complete = false } = {}) {
  const errors = []
  const pending = []
  const err = (rule, msg) => errors.push(`${rule} ${msg}`)
  const need = (name) => {
    if (data[name] !== undefined) return true
    if (complete) err('K12', `완료 선언 뒤 data/${name}.json 없음`)
    else pending.push(name)
    return false
  }

  // K13 — 모르는 최상위 키
  for (const [name, keys] of Object.entries(TOP_KEYS)) {
    if (data[name] === undefined) continue
    for (const k of Object.keys(data[name])) if (!keys.includes(k)) err('K13', `${name}.json 모르는 키 ${k}`)
  }

  const scenarioIds = new Set()
  if (need('scenarios')) {
    const sc = data.scenarios
    const mappedCh = new Set()
    const mappedFt = new Set()
    for (const s of sc.scenarios ?? []) {
      scenarioIds.add(s.id)
      for (const c of s.channels ?? []) mappedCh.add(c)
      for (const f of s.features ?? []) mappedFt.add(f)
    }
    for (const u of sc.unreached?.channels ?? []) mappedCh.add(u.name)
    for (const u of sc.unreached?.features ?? []) mappedFt.add(u.name)
    for (const c of facts.channels) if (!mappedCh.has(c)) err('K1', `채널 미귀속 ${c}`)
    for (const c of mappedCh) if (!facts.channels.has(c)) err('K2', `없는 채널 참조 ${c}`)
    for (const f of facts.features) if (!mappedFt.has(f)) err('K3', `feature 미귀속 ${f}`)
    for (const f of mappedFt) if (!facts.features.includes(f)) err('K3', `없는 feature 참조 ${f}`)
  }

  const candidateIds = new Set()
  const candidateById = new Map()
  if (need('candidates')) {
    const cd = data.candidates
    const buckets = data.volume?.buckets ?? {}
    for (const c of cd.candidates ?? []) {
      candidateIds.add(c.id)
      candidateById.set(c.id, c)
      for (const k of Object.keys(c)) if (!CANDIDATE_KEYS.includes(k)) err('K13', `${c.id} 모르는 키 ${k}`)
      for (const k of REQUIRED) {
        if (k === 'scenarios') {
          if (!Array.isArray(c.scenarios)) err('K4', `${c.id} 필수 칸 누락 scenarios`)
        } else if (blank(c[k])) err('K4', `${c.id} 필수 칸 누락 ${k}`)
      }
      if (c.lens !== undefined && !LENSES.includes(c.lens)) err('K13', `${c.id} 모르는 lens ${c.lens}`)
      if (c.type !== undefined && !TYPES.includes(c.type)) err('K13', `${c.id} 모르는 type ${c.type}`)
      for (const x of c.excess ?? []) if (!EXCESS.includes(x)) err('K13', `${c.id} 모르는 excess ${x}`)
      if (Array.isArray(c.scenarios)) {
        for (const s of c.scenarios) if (!scenarioIds.has(s)) err('K5', `${c.id} 없는 시나리오 ${s}`)
        if (c.scenarios.length === 0 && c.type !== 'remove') err('K5', `${c.id} remove 아닌데 scenarios 빈 배열`)
      }
      if (c.bucket !== undefined && !blank(c.bucket)) {
        const b = buckets[c.bucket]
        if (!b) err('K6', `${c.id} 없는 버킷 ${c.bucket}`)
        else if (c.saving) {
          if ((c.saving.prod ?? 0) > (b.prod?.lines ?? 0)) err('K6', `${c.id} saving.prod 가 버킷 현재 값 초과`)
          if ((c.saving.test ?? 0) > (b.test?.lines ?? 0)) err('K6', `${c.id} saving.test 가 버킷 현재 값 초과`)
        }
      }
      if (c.saving && blank(c.saving.basis)) err('K4', `${c.id} 필수 칸 누락 saving.basis`)
      if (Array.isArray(c.origin)) {
        for (const id of c.origin) if (!facts.handoffIds.has(id)) err('K7', `${c.id} 없는 출처 handoff ${id}`)
      } else if (c.origin && typeof c.origin === 'object') {
        if (c.origin.unknown !== true || blank(c.origin.search)) err('K7', `${c.id} 출처 미상인데 search 없음`)
      }
      for (const s of c.superseded ?? []) {
        if (!facts.handoffIds.has(s.id) || !facts.handoffIds.has(s.by)) err('K7b', `${c.id} superseded 의 handoff 미실재`)
        if (!(num(s.by) > num(s.id))) err('K7b', `${c.id} superseded.by 가 후속이 아님`)
        if (!Array.isArray(c.origin) || !c.origin.includes(s.by)) err('K7b', `${c.id} superseded.by 가 origin 에 없음`)
        if (blank(s.concept)) err('K7b', `${c.id} superseded.concept 빈 값`)
      }
      const needsApproval = c.type === 'remove' || c.decisionChange === true
      if (needsApproval && c.approval !== 'required') err('K8', `${c.id} 승인 필요인데 approval≠required`)
      if (c.approval !== undefined && !['required', 'none'].includes(c.approval)) err('K13', `${c.id} 모르는 approval ${c.approval}`)
      if (c.lens === 'L4' && blank(c.excess)) err('K17', `${c.id} lens=L4 인데 excess 없음`)
      // K19 — restructure 후보의 분해안
      // 완료 선언 전에는 아직 쓰지 않은 분해안을 대기로 센다(data 파일 부재와 같은 규칙).
      if (c.type === 'restructure' && blank(c.decomposition)) {
        if (complete) err('K19', `${c.id} restructure 인데 decomposition 없음`)
        else pending.push(`decomposition:${c.id}`)
      }
      ;(Array.isArray(c.decomposition) ? c.decomposition : []).forEach((d, i) => {
        const at = `${c.id} 분해 ${i + 1}단계`
        if (blank(d.cut)) err('K19', `${at} cut 빈 값`)
        if (blank(d.keep)) err('K19', `${at} keep 빈 값`)
        if (blank(d.files)) err('K19', `${at} files 빈 배열`)
        for (const f of d.files ?? []) if (!facts.fileExists(f)) err('K19', `${at} files 미실재 ${f}`)
        if (blank(d.scenarios)) err('K19', `${at} scenarios 빈 배열`)
        for (const s of d.scenarios ?? []) if (!scenarioIds.has(s)) err('K19', `${at} 없는 시나리오 ${s}`)
        for (const k of Object.keys(d)) if (!['cut', 'keep', 'files', 'scenarios'].includes(k)) err('K13', `${at} 모르는 키 ${k}`)
      })
    }
    const want = new Set((cd.candidates ?? []).filter((c) => c.type === 'remove' || c.decisionChange === true).map((c) => c.id))
    const have = new Set(cd.approvals ?? [])
    for (const id of want) if (!have.has(id)) err('K8', `승인 목록에 없음 ${id}`)
    for (const id of have) if (!want.has(id)) err('K8', `승인 목록의 잉여 ${id}`)
    // K14 — 렌즈
    const lensIds = (cd.lenses ?? []).map((l) => l.id)
    if (lensIds.length !== LENSES.length || LENSES.some((l) => !lensIds.includes(l))) err('K14', `lenses 집합 ≠ ${LENSES.join(',')}`)
    for (const l of cd.lenses ?? []) {
      if (blank(l.method) || l.denominator === undefined || blank(String(l.denominator))) err('K14', `${l.id} method·denominator 누락`)
      const n = (cd.candidates ?? []).filter((c) => c.lens === l.id).length
      if (l.count !== n) err('K14', `${l.id} 후보 수 ${l.count} ≠ 행 수 ${n}`)
    }
  }

  // 후보를 가리키는 칸: [{ where, x, candidate }]
  const pointers = []
  if (need('traces')) {
    const ids = (data.traces.traces ?? []).map((t) => t.id)
    if (ids.length !== TRACE_IDS.length || TRACE_IDS.some((t) => !ids.includes(t))) err('K11', `추적 ID 집합 ≠ ${TRACE_IDS.join(',')}`)
    for (const t of data.traces.traces ?? []) {
      if (!scenarioIds.has(t.scenario)) err('K11', `${t.id} 없는 시나리오 ${t.scenario}`)
      ;(t.steps ?? []).forEach((s, i) => {
        const at = `${t.id}#${i + 1}`
        if (!facts.fileExists(s.file)) err('K11', `${at} 파일 미실재 ${s.file}`)
        else if (!facts.fileContains(s.file, s.symbol)) err('K11', `${at} 심볼 미검출 ${s.symbol}`)
        if (!EFFECTS.includes(s.effect)) err('K13', `${at} 모르는 effect ${s.effect}`)
        if (!Array.isArray(s.excess)) err('K11', `${at} excess 칸 누락`)
        for (const e of s.excess ?? []) {
          if (!EXCESS.includes(e.x)) err('K13', `${at} 모르는 excess ${e.x}`)
          pointers.push({ where: at, x: e.x, candidate: e.candidate })
        }
        if (s.effect === 'none' && blank(s.excess) && blank(s.keep)) err('K11', `${at} effect=none 인데 후보·유지 근거 없음`)
      })
    }
  }

  if (need('reviews')) {
    const reviewed = new Set()
    for (const r of data.reviews.reviews ?? []) {
      reviewed.add(r.scenario)
      if (!scenarioIds.has(r.scenario)) err('K17', `없는 시나리오의 검토 ${r.scenario}`)
      if (blank(r.read)) err('K17', `${r.scenario} read 빈 배열`)
      for (const f of r.read ?? []) if (!facts.fileExists(f)) err('K17', `${r.scenario} read 파일 미실재 ${f}`)
      for (const x of EXCESS) {
        const v = r.verdicts?.[x]
        if (v === 'none') continue
        if (!Array.isArray(v) || v.length === 0) err('K17', `${r.scenario} ${x} 판정 없음`)
        else for (const id of v) pointers.push({ where: r.scenario, x, candidate: id })
      }
      for (const x of Object.keys(r.verdicts ?? {})) if (!EXCESS.includes(x)) err('K13', `${r.scenario} 모르는 범주 ${x}`)
    }
    for (const s of scenarioIds) if (!reviewed.has(s)) err('K17', `검토 없는 시나리오 ${s}`)
  }

  // K18 — 분량 상위 버킷의 심화 검토
  if (need('deep')) {
    const buckets = data.volume?.buckets ?? {}
    const reviewed = new Set()
    for (const r of data.deep.reviews ?? []) {
      reviewed.add(r.bucket)
      for (const k of Object.keys(r)) if (!['bucket', 'read', 'verdicts', 'density', 'basis'].includes(k)) err('K13', `심화 ${r.bucket} 모르는 키 ${k}`)
      if (!buckets[r.bucket]) err('K18', `없는 버킷의 심화 검토 ${r.bucket}`)
      if (blank(r.read)) err('K18', `심화 ${r.bucket} read 빈 배열`)
      for (const f of r.read ?? []) {
        if (!facts.fileExists(f)) err('K18', `심화 ${r.bucket} read 파일 미실재 ${f}`)
        else if (facts.bucketOf(f) !== r.bucket) err('K18', `심화 ${r.bucket} read 파일이 다른 버킷 ${f}`)
      }
      let pointed = 0
      for (const x of EXCESS) {
        const v = r.verdicts?.[x]
        if (v === 'none') continue
        if (!Array.isArray(v) || v.length === 0) err('K18', `심화 ${r.bucket} ${x} 판정 없음`)
        else
          for (const id of v) {
            pointed += 1
            pointers.push({ rule: 'K18', where: `심화 ${r.bucket}`, x, candidate: id })
          }
      }
      for (const x of Object.keys(r.verdicts ?? {})) if (!EXCESS.includes(x)) err('K13', `심화 ${r.bucket} 모르는 범주 ${x}`)
      if (!DENSITY.includes(r.density)) err('K13', `심화 ${r.bucket} 모르는 density ${r.density}`)
      if (r.density === 'excess' && pointed === 0) err('K18', `심화 ${r.bucket} density=excess 인데 후보 0`)
      if (blank(r.basis)) err('K18', `심화 ${r.bucket} basis 빈 값`)
    }
    for (const [name, b] of Object.entries(buckets))
      if ((b.prod?.lines ?? 0) >= DEEP_MIN_PROD && !reviewed.has(name)) err('K18', `심화 검토 없는 버킷 ${name}`)
  }

  if (data.candidates !== undefined) {
    for (const p of pointers) {
      const rule = p.rule ?? 'K17'
      const c = candidateById.get(p.candidate)
      if (!c) err(rule, `${p.where} ${p.x} 가 없는 후보 ${p.candidate} 를 가리킴`)
      else if (!(c.excess ?? []).includes(p.x)) err(rule, `${p.where} ${p.x} ↔ ${p.candidate} excess 범주 불일치`)
    }
  }

  if (need('split')) {
    const sp = data.split
    const seen = new Map()
    const hit = (id) => seen.set(id, (seen.get(id) ?? 0) + 1)
    for (const h of sp.handoffs ?? []) {
      for (const id of h.candidates ?? []) hit(id)
      if (blank(h.scenarios)) err('K10', `${h.id} 회귀 시나리오 0개`)
      for (const s of h.scenarios ?? []) if (!scenarioIds.has(s)) err('K10', `${h.id} 없는 시나리오 ${s}`)
    }
    for (const d of sp.deferred ?? []) {
      hit(d.candidate)
      if (blank(d.reason)) err('K10', `deferred ${d.candidate} 사유 없음`)
    }
    for (const id of candidateIds) {
      const n = seen.get(id) ?? 0
      if (n === 0) err('K9', `분할안에 없는 후보 ${id}`)
      if (n > 1) err('K9', `분할안에 ${n}회 나온 후보 ${id}`)
    }
    for (const id of seen.keys()) if (!candidateIds.has(id)) err('K9', `분할안이 없는 후보 참조 ${id}`)
  }

  // K12 — audit.md 생성 블록 = 렌더 결과
  if (data.auditMd !== undefined) {
    const rendered = render(data, facts.lineCount ?? (() => 0))
    for (const name of BLOCKS) {
      const got = extractBlock(data.auditMd, name)
      if (got === null) err('K12', `생성 블록 누락 ${name}`)
      else if (got !== rendered[name]) err('K12', `생성 블록 ≠ 렌더 결과 ${name}`)
    }
  } else if (complete) err('K12', 'audit.md 없음')

  return { errors, pending }
}

export function extractBlock(md, name) {
  const open = `<!-- gen:${name} -->\n`
  const close = `\n<!-- /gen:${name} -->`
  const a = md.indexOf(open)
  const b = md.indexOf(close)
  if (a < 0 || b < 0 || b < a) return null
  return md.slice(a + open.length, b)
}

export function replaceBlock(md, name, body) {
  const open = `<!-- gen:${name} -->\n`
  const close = `\n<!-- /gen:${name} -->`
  const a = md.indexOf(open)
  const b = md.indexOf(close)
  if (a < 0 || b < 0 || b < a) throw new Error(`audit.md 에 gen:${name} 블록 없음`)
  return md.slice(0, a + open.length) + body + md.slice(b)
}

const cell = (v) => String(v).replaceAll('|', '\\|').replaceAll('\n', ' ')
const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n')
const PENDING = '(대기 — 이 단계의 data 파일이 아직 없다)'
const originText = (o) => (Array.isArray(o) ? o.join('·') : `미상(${o?.search ?? ''})`)

// data → { 블록 이름: 본문 }. 합계·순위는 여기서 계산한다(저장하지 않는다).
// lineCount(path) 는 심화 검토의 읽은 줄 수에만 쓴다 — 없으면 0.
export function render(data, lineCount = () => 0) {
  const out = {}
  if (data.volume) {
    const rows = Object.entries(data.volume.buckets)
      .map(([name, b]) => [name, b.prod?.lines ?? 0, b.test?.lines ?? 0, Object.values(b).reduce((n, k) => n + k.files, 0)])
      .sort((a, b) => b[1] + b[2] - (a[1] + a[2]) || a[0].localeCompare(b[0]))
    const sum = (i) => rows.reduce((n, r) => n + r[i], 0)
    const ratio = (p, t) => (p > 0 ? (t / p).toFixed(2) : '—')
    out.volume = table(
      ['버킷', 'prod 줄', 'test 줄', 'test/prod', '파일'],
      [['**합계**', sum(1), sum(2), ratio(sum(1), sum(2)), data.volume.totals.files], ...rows.map((r) => [r[0], r[1], r[2], ratio(r[1], r[2]), r[3]])]
    )
  } else out.volume = PENDING
  if (data.scenarios) {
    const s = data.scenarios
    out.scenarios =
      table(
        ['ID', '사용자 조작', '관측 결과', '채널', 'feature'],
        s.scenarios.map((x) => [x.id, x.action, x.result, (x.channels ?? []).map((c) => c.replace('orca:', '')).join(' · ') || '—', (x.features ?? []).join(' · ') || '—'])
      ) +
      '\n\n' +
      table(
        ['미도달', '이름', '근거'],
        [...(s.unreached?.channels ?? []).map((u) => ['채널', u.name, u.note]), ...(s.unreached?.features ?? []).map((u) => ['feature', u.name, u.note])]
      )
  } else out.scenarios = PENDING
  if (data.candidates) {
    const c = data.candidates
    const total = (k) => c.candidates.reduce((n, x) => n + (x.saving?.[k] ?? 0), 0)
    out.candidates =
      table(['렌즈', '방법', '분모', '후보 수'], c.lenses.map((l) => [l.id, l.method, l.denominator, l.count])) +
      `\n\n후보 ${c.candidates.length}건 · 예상 절감 합 prod ${total('prod')}줄 · test ${total('test')}줄\n\n` +
      table(
        ['ID', '후보', '버킷', '렌즈·범주', '유형', '시나리오', '출처', '보존할 개념 요구', '근거', '절감 prod/test', '위험'],
        c.candidates.map((x) => [
          x.id,
          x.title ?? '',
          x.bucket,
          [x.lens, ...(x.excess ?? [])].join(' '),
          x.type,
          (x.scenarios ?? []).join(' ') || '없음',
          originText(x.origin) + (x.superseded?.length ? ` (배제: ${x.superseded.map((s) => `${s.id}→${s.by} ${s.concept}`).join('; ')})` : ''),
          x.preserve,
          x.evidence,
          `${x.saving?.prod ?? 0}/${x.saving?.test ?? 0} — ${x.saving?.basis ?? ''}`,
          x.risk
        ])
      )
    const ap = c.candidates.filter((x) => (c.approvals ?? []).includes(x.id))
    out.approvals = table(
      ['ID', '후보', '승인이 필요한 이유', '없어지는 것', '절감 prod/test'],
      ap.map((x) => [
        x.id,
        x.title ?? '',
        [x.type === 'remove' ? '제거' : null, x.decisionChange ? '채택 결정 변경' : null].filter(Boolean).join(' · '),
        x.preserve,
        `${x.saving?.prod ?? 0}/${x.saving?.test ?? 0}`
      ])
    )
  } else out.candidates = out.approvals = PENDING
  if (data.traces) {
    out.traces = data.traces.traces
      .map(
        (t) =>
          `**${t.id} — ${t.title} (${t.scenario})**\n\n` +
          table(
            ['#', '파일:심볼', '하는 일', '효과', '과잉 → 후보', '유지 근거'],
            t.steps.map((s, i) => [
              i + 1,
              `\`${s.file.replace('app/src/', '')}\`:\`${s.symbol}\``,
              s.does,
              s.effect === 'user' ? '있음' : '없음',
              (s.excess ?? []).map((e) => `${e.x}→${e.candidate}`).join(' ') || '—',
              s.keep ?? '—'
            ])
          )
      )
      .join('\n\n')
  } else out.traces = PENDING
  if (data.reviews) {
    out.reviews = table(
      ['시나리오', ...EXCESS, '읽은 파일'],
      data.reviews.reviews.map((r) => [
        r.scenario,
        ...EXCESS.map((x) => (r.verdicts[x] === 'none' ? '—' : (r.verdicts[x] ?? []).join(' '))),
        r.read.map((f) => f.replace('app/src/', '')).join(' · ')
      ])
    )
  } else out.reviews = PENDING
  if (data.deep) {
    out.deep = table(
      ['버킷', ...EXCESS, '밀도', '읽은 파일 줄 수(상한) / prod 줄', '판정 근거', '읽은 파일'],
      data.deep.reviews.map((r) => {
        const prod = data.volume?.buckets?.[r.bucket]?.prod?.lines ?? 0
        const read = r.read.reduce((n, f) => n + lineCount(f), 0)
        return [
          r.bucket,
          ...EXCESS.map((x) => (r.verdicts[x] === 'none' ? '—' : (r.verdicts[x] ?? []).join(' '))),
          r.density === 'excess' ? '과도' : '필요',
          `${read} / ${prod}${prod > 0 ? ` (${Math.round((read / prod) * 100)}%)` : ''}`,
          r.basis,
          r.read.map((f) => f.slice(f.lastIndexOf('/') + 1)).join(' · ')
        ]
      })
    )
  } else out.deep = PENDING
  if (data.candidates) {
    out.decomposition = table(
      ['후보', '단계', '떼어내는 것', '그 뒤에도 같아야 하는 동작', '파일', '회귀 시나리오'],
      data.candidates.candidates.flatMap((c) =>
        (c.decomposition ?? []).map((d, i) => [
          i === 0 ? `${c.id} ${c.title ?? ''}` : c.id,
          i + 1,
          d.cut,
          d.keep,
          (d.files ?? []).map((f) => `\`${f.replace('app/src/', '')}\``).join(' · '),
          (d.scenarios ?? []).join(' ')
        ])
      )
    )
  } else out.decomposition = PENDING
  if (data.split && data.candidates) {
    const by = new Map(data.candidates.candidates.map((c) => [c.id, c]))
    const sum = (ids, k) => ids.reduce((n, id) => n + (by.get(id)?.saving?.[k] ?? 0), 0)
    out.split =
      table(
        ['순위', '후속 handoff', '후보', '예상 절감 prod/test', '회귀 판정 시나리오', '비고'],
        data.split.handoffs.map((h, i) => [i + 1, `${h.id} ${h.title}`, h.candidates.join(' '), `${sum(h.candidates, 'prod')}/${sum(h.candidates, 'test')}`, h.scenarios.join(' '), h.note ?? '—'])
      ) +
      '\n\n' +
      table(['보류 후보', '사유'], (data.split.deferred ?? []).map((d) => [d.candidate, d.reason]))
  } else out.split = PENDING
  return out
}

// ── CLI 껍질 ─────────────────────────────────────────────────────────────
function loadFacts(root) {
  const ipc = readFileSync(join(root, 'app/src/shared/ipc.ts'), 'utf8')
  const channels = new Set([...ipc.matchAll(/'(orca:[A-Za-z:._-]+)'/g)].map((m) => m[1]))
  const features = readdirSync(join(root, 'app/src/renderer/src/features'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
  const handoffIds = new Set()
  for (const d of readdirSync(join(root, 'docs/handoff'))) {
    const m = /^(\d{4})-/.exec(d)
    if (m) handoffIds.add(m[1])
  }
  const history = readFileSync(join(root, 'docs/archive/handoffs/INDEX-history.md'), 'utf8')
  for (const m of history.matchAll(/\b(\d{4})-[a-z]/g)) handoffIds.add(m[1])
  const cache = new Map()
  const read = (p) => {
    // 디렉토리는 파일이 아니다 — 읽으려 하면 EISDIR 로 죽으므로 미실재로 센다.
    if (!cache.has(p)) {
      const abs = join(root, p)
      cache.set(p, existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null)
    }
    return cache.get(p)
  }
  return {
    channels,
    features,
    handoffIds,
    fileExists: (p) => typeof p === 'string' && read(p) !== null,
    bucketOf: (p) => classifyBucket(p),
    lineCount: (p) => (read(p) === null ? 0 : countLines(read(p))),
    fileContains: (p, text) => typeof text === 'string' && text !== '' && (read(p) ?? '').includes(text)
  }
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).trim()
  const dir = join(here, '..')
  const data = {}
  for (const name of ['volume', 'scenarios', 'candidates', 'traces', 'reviews', 'deep', 'split']) {
    const p = join(dir, 'data', `${name}.json`)
    if (existsSync(p)) data[name] = JSON.parse(readFileSync(p, 'utf8'))
  }
  const mdPath = join(dir, 'audit.md')
  if (existsSync(mdPath)) data.auditMd = readFileSync(mdPath, 'utf8')
  const facts = loadFacts(root)
  if (process.argv.includes('--write')) {
    let md = data.auditMd
    if (md === undefined) throw new Error('audit.md 없음')
    const rendered = render(data, facts.lineCount)
    for (const name of BLOCKS) md = replaceBlock(md, name, rendered[name])
    writeFileSync(mdPath, md)
    console.log('[audit-check] audit.md 생성 블록 갱신')
    return
  }
  const complete = (data.auditMd ?? '').includes('<!-- audit:complete -->')
  const { errors, pending } = check(data, facts, { complete })
  for (const p of pending) console.log(`[audit-check] 대기: ${p.includes(':') ? p : `data/${p}.json`}`)
  if (errors.length) {
    for (const e of errors) console.error(`[audit-check] ${e}`)
    console.error(`[audit-check] 위반 ${errors.length}`)
    process.exit(1)
  }
  console.log(`[audit-check] ok${complete ? ' — 완료 선언' : ''}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
