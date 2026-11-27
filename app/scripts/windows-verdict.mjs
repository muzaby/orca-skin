// Evaluate a locked measurement plan. The CLI supplies the only filesystem access.
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, win32 } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual, parseArgs } from 'node:util'

const pass = '충족',
  fail = '위반',
  unknown = '미판정',
  record = '기록 전용'
const operators = new Map([
  ['<', (a, b) => a < b],
  ['≤', (a, b) => a <= b],
  ['=', (a, b) => a === b],
  ['≥', (a, b) => a >= b],
  ['>', (a, b) => a > b]
])
const numericUnits = ['ms', 'px', 'frames', 'bytes', '건']
const keyOf = (...values) => JSON.stringify(values)
const unsupported = (value) => '지원 안 함: ' + String(value)
const finite = Number.isFinite
const textValue = (value) => typeof value === 'string' && value.trim().length > 0
const fields = ['sample', 'scenario', 'operation', 'load', 'harness']
const same = (a, b, keys) => keys.every((k) => a?.[k] === b?.[k])
const repeats = (cell) => cell.repeats ?? 3
const sides = (cell) => (cell.side === 'pair' ? ['before', 'after'] : [cell.side])
const metrics = (cell) =>
  cell.rule.aggregate === 'ratio' ? [cell.rule.numerator, cell.rule.denominator] : [cell.metric]
const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function safePath(path) {
  return (
    textValue(path) &&
    !isAbsolute(path) &&
    !win32.parse(path).root &&
    !path.split(/[\\/]/).includes('..')
  )
}

function readEvidence(ref, readRaw) {
  if (!safePath(ref?.path)) return { reason: '원본 없음' }
  const data = readRaw(ref.path)
  if (data == null) return { reason: '원본 없음' }
  if (createHash('sha256').update(data).digest('hex') !== ref.sha256)
    return { reason: '원본 해시 불일치' }
  const bytes = Buffer.from(data)
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe
  return { text: bytes.toString(utf16 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '') }
}

function json(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function traceEvents(text) {
  const data = json(text)
  return Array.isArray(data) ? data : Array.isArray(data?.traceEvents) ? data.traceEvents : []
}

function hasPointer(root, pointer) {
  if (root === undefined || typeof pointer !== 'string') return false
  if (pointer === '') return true
  if (!pointer.startsWith('/') || /~(?![01])/.test(pointer)) return false
  for (const part of pointer.slice(1).split('/')) {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~')
    if (
      !root ||
      typeof root !== 'object' ||
      !Object.hasOwn(root, key) ||
      (Array.isArray(root) && !/^(0|[1-9]\d*)$/.test(key))
    )
      return false
    root = root[key]
  }
  return true
}

function markerSample(events, range, run, cell) {
  const { opId } = range
  const selections = (run.selections ?? []).filter((op) => op.opId === opId)
  if (
    !textValue(opId) ||
    selections.length !== 1 ||
    !same(selections[0].target, cell.target, ['kind', 'sessionId', 'messageId'])
  )
    return { reason: '다른 선택' }
  const { kind, sessionId, messageId } = cell.target
  const starts = events.filter((e) => e.name === 'oo-select:' + opId)
  const start = starts.length === 1 ? starts[0] : null
  const after = start ? events.filter((e) => e.ts >= start.ts) : []
  if (after.some((e) => e.name === 'oo-highlight-other:' + opId))
    return { status: 'failed', reason: '다른 행 강조' }
  const prefix = 'oo-unobservable:' + opId + ':'
  const unavailable = after.find((e) => e.name?.startsWith(prefix))
  if (unavailable) return { status: 'unobservable', reason: unavailable.name.slice(prefix.length) }
  if (
    after.filter((e) => e.name === ['oo-visible', kind, sessionId, messageId, opId].join(':'))
      .length !== 1
  )
    return { reason: '대상 표시 기록 없음' }
  return {}
}

function tableSample(text, range, obs) {
  // ΔV4(W-045): 같은 ID 행이 여럿이면 둘째 열(`label`)로 한 행을 고르고, 관측 구간이 그 label 이어야 한다.
  const labelled = range.label !== undefined
  if (labelled && (typeof range.label !== 'string' || !range.label))
    return { reason: '구간 형식 지원 안 함' }
  const prefix = '| ' + range.id + ' |' + (labelled ? ' ' + range.label + ' |' : '')
  const lines = text.split(/\r?\n/).filter((line) => line.startsWith(prefix))
  if (lines.length !== 1 || range.id !== obs.metric || (labelled && obs.interval !== range.label))
    return { reason: '지표 없음' }
  const cell = lines[0].trim().split('|').at(-2)?.trim() ?? ''
  const unavailable = /^N\/A\((.*)\)$/.exec(cell.replace(/ \(시도 \d+\)$/, ''))
  if (unavailable) return { status: 'unavailable', reason: unavailable[1] }
  const match = /^(\d+(?:\.\d+)?)ms \/ (\d+(?:\.\d+)?)ms(?: \(시도 \d+\))?$/.exec(cell)
  if (!match || !['median', 'max'].includes(range.column)) return { reason: '값 해석 불가' }
  const value = Number(match[range.column === 'median' ? 1 : 2])
  return isDeepStrictEqual(obs.values, [value]) ? {} : { reason: '원본 값 불일치' }
}

function checkEvidence(cell, run, obs, profile, readRaw) {
  const output = readEvidence(run.runRef, readRaw)
  if (output.reason || !output.text.trim()) return { reason: '수집 실패' }
  const kind = run.runRef.kind
  if (
    !run.tools ||
    !Object.keys(run.tools).length ||
    Object.values(run.tools).some(
      (tool) => !tool?.version || !tool.environment || tool.provenanceConflict
    )
  )
    return { reason: '도구 출처 불명' }
  let runtime
  if (kind === 'electron-json') {
    const data = json(output.text)
    if (data?.env !== true || data.error || data.provenanceConflict) return { reason: '수집 실패' }
    if (
      data.appSource?.commit !== run.sha ||
      data.tool !== run.tool ||
      !isDeepStrictEqual(data.appSource, run.appSource) ||
      (data.sha && data.sha !== run.sha)
    )
      return { reason: '도구 출처 불명' }
    runtime = data.environment
  } else if (kind === 'node-stdout') {
    if (run.exitCode !== 0) return { reason: '수집 실패' }
    const platform = /^Node\s+\S+ · (\w+)\/\S+\s*$/m.exec(output.text)?.[1]
    if (platform) runtime = platform + '-node'
  } else if (['trace', 'app-log'].includes(kind)) {
    if (kind === 'trace' && !traceEvents(output.text).length) return { reason: '수집 실패' }
    const device = readEvidence(run.profileRef, readRaw)
    if (
      /(?:^|\n)\s*(?:Caption\s*:\s*)?Microsoft Windows\b/i.test(device.text ?? '') ||
      /^Caption\s+Version[^\n]*\r?\n[^\n]*\r?\nMicrosoft Windows\b/im.test(device.text ?? '')
    )
      runtime = 'win32-electron'
  }
  if (!['linux-electron', 'win32-electron', 'linux-node', 'win32-node'].includes(runtime))
    return { reason: '런타임 불명' }
  if (runtime !== run.runtime) return { reason: '런타임 불일치: 원본' }
  if (runtime !== profile.os + (cell.buildKind === 'node' ? '-node' : '-electron'))
    return { reason: '런타임 불일치' }
  const raw = readEvidence(obs.rawRef, readRaw)
  if (raw.reason) return raw
  const range = obs.rawRef.range ?? {}
  if (cell.target && range.kind !== 'trace-marker') return { reason: '다른 선택' }
  if (
    (['table-row', 'trace-marker'].includes(range.kind) ||
      (kind === 'electron-json' && range.kind === 'json-pointer')) &&
    !same(obs.rawRef, run.runRef, ['path', 'sha256'])
  )
    return { reason: '다른 실행의 원본' }
  if (kind === 'node-stdout' && range.kind !== 'table-row') return { reason: '지표 없음' }
  if (range.kind === 'table-row')
    return kind === 'node-stdout' ? tableSample(raw.text, range, obs) : { reason: '수집 실패' }
  if (range.kind === 'lines') {
    const n = raw.text.replace(/\r?\n$/, '').split(/\r?\n/).length
    if (
      raw.text &&
      Number.isInteger(range.start) &&
      Number.isInteger(range.end) &&
      1 <= range.start &&
      range.start <= range.end &&
      range.end <= n
    )
      return {}
  } else if (range.kind === 'json-pointer') {
    if (hasPointer(json(raw.text), range.pointer)) return {}
  } else if (range.kind === 'trace-ts' || range.kind === 'trace-marker') {
    const events = traceEvents(raw.text).filter(
      (e) =>
        finite(e?.ts) &&
        finite(range.start) &&
        finite(range.end) &&
        e.ts >= range.start &&
        e.ts <= range.end
    )
    if (range.kind === 'trace-marker')
      return cell.target && kind === 'trace'
        ? markerSample(events, range, run, cell)
        : { reason: '다른 선택' }
    if (events.length) return {}
  } else return { reason: '구간 형식 지원 안 함' }
  return { reason: '구간 없음' }
}

function ruleError(cell) {
  const r = cell.rule
  for (const [value, choices] of [
    [r.operator, [...operators.keys()]],
    [r.mode, ['absolute', 'relative']],
    [r.combine, ['pooled', 'median-of-runs', 'each']],
    [r.aggregate, ['p95', 'median', 'max', 'ratio', 'count', 'equal']],
    [r.inputUnit, [...numericUnits, 'text']],
    [r.unit, [...numericUnits, '비', 'text']]
  ])
    if (!choices.includes(value)) return unsupported(value)
  if (r.aggregate === 'equal') {
    if (r.mode !== 'absolute' || r.combine === 'median-of-runs' || r.operator !== '=')
      return unsupported('조합')
    return r.inputUnit === 'text' && r.unit === 'text' && typeof r.value === 'string'
      ? null
      : '단위 불일치'
  }
  if (r.mode === 'relative' && cell.side !== 'pair') return unsupported('조합')
  if (!finite(r.value) || !numericUnits.includes(r.inputUnit)) return '단위 불일치'
  if (r.aggregate === 'count') {
    if (!operators.has(r.where?.operator)) return unsupported(r.where?.operator)
    if (r.where.unit !== r.inputUnit || !finite(r.where.value)) return '단위 불일치'
  }
  const expectedUnit =
    r.mode === 'relative' || r.aggregate === 'ratio'
      ? '비'
      : r.aggregate === 'count'
        ? '건'
        : r.inputUnit
  return r.unit === expectedUnit ? null : '단위 불일치'
}

function aggregate(rows, r) {
  const values = rows.flatMap((o) => o.values)
  switch (r.aggregate) {
    case 'p95':
      return values.toSorted((a, b) => a - b)[Math.ceil(0.95 * values.length) - 1]
    case 'median':
      return median(values)
    case 'max':
      return values.reduce((max, v) => Math.max(max, v), -Infinity)
    case 'count':
      return values.filter((v) => operators.get(r.where.operator)(v, r.where.value)).length
    case 'equal':
      return values.every((v) => v === r.value)
    case 'ratio': {
      const sum = (metric) =>
        rows
          .filter((o) => o.metric === metric)
          .flatMap((o) => o.values)
          .reduce((a, b) => a + b, 0)
      return sum(r.denominator) === 0 ? null : sum(r.numerator) / sum(r.denominator)
    }
  }
}

function combine(cell, groups) {
  const r = cell.rule
  const bySide = (side) => {
    let runs = groups.filter((g) => g.side === side).map((g) => g.rows)
    if (r.combine === 'pooled') runs = [runs.flat()]
    const aggregates = runs.map((rows) => aggregate(rows, r))
    if (aggregates.includes(null)) return null
    return r.combine === 'median-of-runs' ? [median(aggregates)] : aggregates
  }
  let result = bySide(cell.side === 'before' ? 'before' : 'after')
  if (result && r.mode === 'relative') {
    const before = bySide('before')
    result = before && !before.includes(0) ? result.map((value, i) => value / before[i]) : null
  }
  if (!result) return { status: unknown, reason: '분모 0' }
  const ok = result.every((v) =>
    r.aggregate === 'equal' ? v : operators.get(r.operator)(v, r.value)
  )
  return { status: ok ? pass : fail, aggregate: r.combine === 'each' ? result : result[0] }
}

function planCheck(plan) {
  if (
    !Array.isArray(plan.cells) ||
    !plan.cells.some((c) => c.required === true && c.sample !== 'reference')
  )
    throw Error('필수 셀 없음')
  if (
    !textValue(plan.revision) ||
    !finite(Date.parse(plan.lockedAt)) ||
    !plan.integrationSha ||
    !plan.wBaselineSha ||
    !Array.isArray(plan.profiles) ||
    !Array.isArray(plan.tasks)
  )
    throw Error('잘못된 계획')
  const keys = new Set()
  for (const c of plan.cells) {
    if (
      !textValue(c.key) ||
      keys.has(c.key) ||
      ![...fields, 'owner', 'ownerRevision', 'metric', 'interval', 'profile', 'task'].every((k) =>
        textValue(c[k])
      ) ||
      !['before', 'after', 'pair'].includes(c.side) ||
      !['owner', 'w', 'reference'].includes(c.sample) ||
      !['node', 'install', 'diagnostic'].includes(c.buildKind) ||
      !c.rule ||
      !c.pair?.id ||
      !c.pair.beforeSha ||
      !c.pair.afterSha ||
      typeof c.required !== 'boolean' ||
      !Number.isSafeInteger(repeats(c)) ||
      repeats(c) < 1 ||
      !c.ownerChecks
    )
      throw Error('잘못된 셀: ' + c.key)
    if (
      (c.target || c.metric.startsWith('first-')) &&
      (!['first-body', 'search-target'].includes(c.target?.kind) ||
        ![c.target.sessionId, c.target.messageId, c.target.expectText].every(textValue))
    )
      throw Error('target 필요: ' + c.key)
    keys.add(c.key)
  }
  for (const task of plan.tasks)
    for (const owner of task.owners)
      if (!plan.cells.some((c) => c.task === task.id && c.owner === owner))
        throw Error('예정 셀 없음: ' + task.id + '/' + owner)
  for (const c of plan.cells)
    if (!plan.tasks.some((t) => t.id === c.task && t.owners.includes(c.owner)))
      throw Error('예정 소유자 없음: ' + c.key)
}

function ownersCheck(plan, owners) {
  for (const row of owners.rows) {
    const { task, owner, key } = row
    let target = `${task}/${owner}`
    if (!plan.tasks.some((entry) => entry.id === task && entry.owners.includes(owner)))
      throw Error('소유 행 대상 없음: ' + target)
    if (key != null) {
      target += '/' + key
      if (
        !plan.cells.some((cell) => cell.task === task && cell.owner === owner && cell.key === key)
      )
        throw Error('소유 행 대상 없음: ' + target)
    }
    for (const kind of ['machine', 'windows']) {
      const value = row[kind]
      if (value != null && !['PASS', 'FAIL', '미완'].includes(value))
        throw Error(`소유 판정 값 오류: ${target} ${kind}=${value}`)
    }
  }
}

function observationIndex(manifest, observations, report) {
  const runs = new Map()
  const rows = new Map()
  const byMetric = new Map()
  const conflicting = new Set()
  for (const run of manifest.runs) {
    if (!textValue(run.runId)) throw Error('runId 필요')
    if (runs.has(run.runId) && !isDeepStrictEqual(run, runs.get(run.runId)))
      throw Error('중복 runId: ' + run.runId)
    runs.set(run.runId, run)
  }
  for (const obs of observations) {
    const slot = keyOf(obs.runId, obs.metric, obs.interval)
    const opId = obs.rawRef?.range?.opId
    const key = opId ? keyOf(obs.runId, obs.metric, obs.interval, opId) : slot
    if (!runs.has(obs.runId)) {
      report.unexpected.push(key)
      continue
    }
    if (!rows.has(key)) {
      rows.set(key, obs)
      if (!byMetric.has(slot)) byMetric.set(slot, [])
      byMetric.get(slot).push(key)
    } else if (isDeepStrictEqual(rows.get(key), obs)) report.duplicates.push(key)
    else {
      conflicting.add(key)
      report.conflicts.push({ key, original: rows.get(key), submitted: obs })
    }
  }
  return { runs: [...runs.values()], rows, byMetric, conflicting, matched: new Set() }
}

function runError(cell, run, plan, profile) {
  if (!profile || run.profile !== cell.profile) return '프로필 불일치'
  if (run.buildKind !== cell.buildKind) return '빌드 종류 혼합'
  if (run.pairId !== cell.pair.id) return '짝 없음'
  if (
    !finite(Date.parse(run.startedAt)) ||
    !finite(Date.parse(run.endedAt)) ||
    Date.parse(run.endedAt) < Date.parse(run.startedAt)
  )
    return '실행 시각 불명'
  if (cell.sample === 'w' && Date.parse(run.startedAt) <= Date.parse(plan.lockedAt))
    return '합의 전'
  if (
    !run.sha ||
    run.sha !== run.appSource?.commit ||
    !run.tool ||
    !run.binarySha256 ||
    !(
      (run.appSource.dirty === false && run.appSource.tree) ||
      (cell.buildKind === 'diagnostic' &&
        run.appSource.dirty === true &&
        run.appSource.tree === null &&
        /^[0-9a-f]{64}$/.test(run.appSource.diffSha256 ?? ''))
    )
  )
    return '도구 출처 불명'
  if (cell.sample === 'w') {
    if (run.side === 'after' && run.sha !== plan.integrationSha) return '통합 SHA 아님'
    if (run.side === 'before' && run.sha !== plan.wBaselineSha) return '기준 SHA 아님'
  } else if (cell.sample === 'owner' && run.sha !== cell.pair[run.side + 'Sha'])
    return '소유 SHA 아님'
  return null
}

// A run may contain several selections with the same metric and time interval.
function observationKeys(index, run, cell, metric) {
  const keys = index.byMetric.get(keyOf(run.runId, metric, cell.interval)) ?? []
  if (!cell.target) return keys
  const selected = keys.filter((key) =>
    run.selections?.some(
      (op) =>
        op.opId === index.rows.get(key).rawRef?.range?.opId &&
        same(op.target, cell.target, ['kind', 'sessionId', 'messageId'])
    )
  )
  return selected.length ? selected : keys
}

function sampleValue(cell, run, obs, profile, readRaw) {
  const checked = checkEvidence(cell, run, obs, profile, readRaw)
  if (checked.reason && !checked.status) return checked
  const status = checked.status ?? obs.status
  const detail = checked.reason ?? obs.reason ?? ''
  if (status === 'failed' || status === 'absent') {
    if (run.side === 'after') return { failure: detail || '기능 실패' }
    return { reason: status === 'absent' ? '이전 기능 없음' : '측정 불가: ' + detail }
  }
  if (status === 'unavailable' || status === 'unobservable') {
    if (status === 'unavailable' && detail === '함수 없음' && run.side === 'before')
      return { reason: '이전 기능 없음' }
    return {
      reason: (status === 'unobservable' ? '이 방식으로 관측 불가: ' : '측정 불가: ') + detail
    }
  }
  if (cell.target && status === undefined && obs.values?.length !== 1)
    return { reason: '선택 표본 수 불일치' }
  if (obs.unit !== cell.rule.inputUnit) return { reason: '단위 불일치' }
  if (status === 'censored') {
    if (
      finite(obs.bound) &&
      obs.bound > 0 &&
      cell.rule.mode === 'absolute' &&
      ['max', 'median', 'p95'].includes(cell.rule.aggregate) &&
      ['<', '≤'].includes(cell.rule.operator)
    )
      return { row: { ...obs, values: [obs.bound] } }
    return { reason: '검열' }
  }
  if (status !== undefined) return { reason: unsupported(status) }
  if (
    !Array.isArray(obs.values) ||
    !obs.values.length ||
    !obs.values.every((v) => (cell.rule.aggregate === 'equal' ? typeof v === 'string' : finite(v)))
  )
    return { reason: '표본 없음' }
  return { row: obs }
}

function collectRun(cell, run, index, context) {
  const { plan, profile, readRaw, rawRefs } = context
  const rows = []
  let reason = runError(cell, run, plan, profile)
  let failure
  for (const metric of metrics(cell)) {
    const keys = observationKeys(index, run, cell, metric)
    if (!keys.length) reason ??= '반복 부족'
    for (const key of keys) {
      const obs = index.rows.get(key)
      if (
        run.pairId === cell.pair.id &&
        run.profile === cell.profile &&
        run.buildKind === cell.buildKind
      )
        index.matched.add(key)
      if (obs.rawRef) rawRefs.push(obs.rawRef)
      if (index.conflicting.has(key)) reason ??= '충돌'
      if (reason) continue
      const sample = sampleValue(cell, run, obs, profile, readRaw)
      if (sample.row) rows.push(sample.row)
      reason ??= sample.reason
      failure ??= sample.failure
    }
  }
  return { rows, reason, failure }
}

function combineCensored(cell, groups) {
  // Timings below the reporting floor are nonnegative and strictly below the bound.
  const upper = combine(cell, groups)
  if (!groups.some((g) => g.rows.some((o) => o.status === 'censored'))) return upper
  const at = (upperBound) =>
    groups.map((g) => ({
      ...g,
      rows: g.rows.map((o) =>
        o.status !== 'censored' ? o : { ...o, values: [upperBound ? previousNumber(o.bound) : 0] }
      )
    }))
  const min = combine(cell, at(false)),
    max = combine(cell, at(true))
  return min.status === max.status
    ? { status: min.status, aggregate: null }
    : { status: unknown, reason: '검열' }
}

function previousNumber(positive) {
  const bits = new DataView(new ArrayBuffer(8))
  bits.setFloat64(0, positive)
  bits.setBigUint64(0, bits.getBigUint64(0) - 1n)
  return bits.getFloat64(0)
}

function cellResult(cell, plan, index, report, agreed, readRaw) {
  const profile = plan.profiles.find((p) => p.id === cell.profile)
  const candidates = index.runs.filter(
    (run) => same(run, cell, fields) && sides(cell).includes(run.side)
  )
  const groups = [],
    missing = [],
    rawRefs = []
  const invalid = cell.sample === 'w' && !agreed ? '합의 불일치' : ruleError(cell)
  let failure,
    n = 0
  for (let repeat = 1; repeat <= repeats(cell); repeat++)
    for (const side of sides(cell)) {
      const possible = candidates.filter(
        (run) =>
          run.side === side &&
          run.repeat === repeat &&
          metrics(cell).some((metric) =>
            index.byMetric.has(keyOf(run.runId, metric, cell.interval))
          )
      )
      const exact = possible.filter(
        (run) =>
          run.profile === cell.profile &&
          run.buildKind === cell.buildKind &&
          run.pairId === cell.pair.id
      )
      const runs = exact.length ? exact : possible
      const samples = runs.map((run) =>
        collectRun(cell, run, index, { plan, profile, readRaw, rawRefs })
      )
      const usable = samples.filter((s) => !s.reason)
      let reason = invalid
      if (usable.length > 1)
        report.conflicts.push({
          key: cell.key,
          repeat,
          side,
          runIds: runs.filter((_, i) => !samples[i].reason).map((run) => run.runId)
        })
      if (!reason && usable.length === 1) {
        failure ??= usable[0].failure
        groups.push({ side, rows: usable[0].rows })
        n += usable[0].rows.reduce((sum, o) => sum + o.values.length, 0)
      } else {
        reason ??=
          usable.length > 1
            ? '충돌'
            : (samples[0]?.reason ??
              (cell.side === 'pair' && candidates.some((run) => run.repeat === repeat)
                ? '짝 없음'
                : '반복 부족'))
        missing.push({ key: cell.key, repeat, side, reason })
      }
    }
  const reason = missing[0]?.reason
  let result
  if (failure) result = { status: fail, reason: failure }
  else if (reason) result = { status: reason === '합의 전' ? record : unknown, reason }
  else result = combineCensored(cell, groups)
  if (cell.sample === 'reference' || !cell.required)
    result = {
      ...result,
      status: record,
      reason: cell.sample === 'reference' ? '참고' : result.reason
    }
  else if (missing.length) report.missing.push(...missing)
  else if (result.status === unknown) report.missing.push({ key: cell.key, reason: result.reason })
  return {
    key: cell.key,
    revision: plan.revision,
    aggregate: null,
    n,
    unit: cell.rule.unit,
    rawRefs,
    ...result
  }
}

export function evaluate({
  plan,
  manifest,
  observations,
  owners = { rows: [] },
  decision = {},
  readRaw
}) {
  planCheck(plan)
  ownersCheck(plan, owners)
  const report = {
    revision: plan.revision,
    cells: [],
    violations: [],
    missing: [],
    unexpected: [],
    duplicates: [],
    conflicts: [],
    ownerFailures: [],
    holds: []
  }
  const index = observationIndex(manifest, observations, report)
  const agreement = decision.agreement,
    confirmation = decision.confirmation
  const agreed =
    agreement?.revision === plan.revision &&
    agreement.lockedAt === plan.lockedAt &&
    textValue(agreement.by)
  if (!agreed) report.holds.push('합의 불일치')
  const lastRun = index.runs
    .filter((run) => run.sample === 'w' && finite(Date.parse(run.endedAt)))
    .reduce((last, run) => Math.max(last, Date.parse(run.endedAt)), Date.parse(plan.lockedAt))
  let user = '확정'
  if (!confirmation || !textValue(confirmation.by) || !finite(Date.parse(confirmation.confirmedAt)))
    user = '사용자 확정 대기'
  else if (confirmation.revision !== plan.revision) user = '확정 revision 불일치'
  else if (Date.parse(confirmation.confirmedAt) < lastRun) user = '확정이 실행보다 앞섬'
  if (user !== '확정') report.holds.push(user)
  const ownerMissing = new Set(),
    ownerFailures = new Set()
  let ownerFailureWithoutRef = false
  for (const c of plan.cells) {
    const result = cellResult(c, plan, index, report, agreed, readRaw)
    const entries = owners.rows.filter(
      (row) => row.task === c.task && row.owner === c.owner && (!row.key || row.key === c.key)
    )
    const ownerKey = c.task + '/' + c.owner
    const column = (kind) => {
      const failures = entries.filter((row) => row[kind] === 'FAIL')
      const hasRef = (row) => textValue(row[kind + 'Ref'])
      if (failures.length) {
        if (c.sample !== 'reference') {
          ownerFailures.add(ownerKey)
          if (failures.some((row) => !hasRef(row))) ownerFailureWithoutRef = true
        }
        return 'FAIL'
      }
      const values = entries.filter(hasRef).map((row) => row[kind])
      const value = values.includes('미완') ? '미완' : values.includes('PASS') ? 'PASS' : '미기록'
      if (c.sample !== 'reference' && c.required && c.ownerChecks[kind] && value !== 'PASS')
        ownerMissing.add(ownerKey)
      return value
    }
    report.cells.push({
      ...result,
      ownerMachine: column('machine'),
      ownerWindows: column('windows'),
      w: result.status,
      user
    })
    if (result.status === fail) report.violations.push(c.key)
  }
  for (const task of plan.tasks)
    for (const owner of task.owners) {
      if (!owners.rows.some((row) => row.task === task.id && row.owner === owner))
        ownerMissing.add(task.id + '/' + owner)
    }
  for (const key of index.rows.keys()) if (!index.matched.has(key)) report.unexpected.push(key)
  report.ownerFailures.push(...ownerFailures)
  if (ownerFailureWithoutRef) report.holds.push('소유 판정 근거 없음')
  if (ownerMissing.size) report.holds.push('소유 판정 없음')
  report.missing.push(...ownerMissing)
  if (report.missing.length) report.holds.push('필수 결측')
  const violated = report.violations.length > 0 || report.ownerFailures.length > 0
  report.overall = violated ? '불합격' : report.holds.length ? '판정 보류' : '합격'
  report.overallReason = violated ? '위반 또는 소유자 FAIL' : report.holds.join(', ') || '전건 충족'
  return report
}

function cli() {
  const names = ['plan', 'manifest', 'observations', 'raw-root', 'owners', 'decision']
  const { values } = parseArgs({
    options: Object.fromEntries(names.map((name) => [name, { type: 'string' }]))
  })
  for (const name of names.slice(0, 4)) if (!values[name]) throw Error('--' + name + ' 필요')
  const input = (name) => {
    if (!values[name]) return undefined
    try {
      const data = readFileSync(values[name], 'utf8').replace(/^\uFEFF/, '')
      return name === 'observations'
        ? data
            .split(/\r?\n/)
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line))
        : JSON.parse(data)
    } catch (error) {
      throw Error(values[name] + ': ' + error.message)
    }
  }
  const root = realpathSync(values['raw-root'])
  if (!statSync(root).isDirectory()) throw Error(values['raw-root'] + ' is not a directory')
  const readRaw = (path) => {
    if (!safePath(path)) return null
    try {
      const file = realpathSync(resolve(root, path))
      const rel = relative(root, file)
      return safePath(rel) && statSync(file).isFile() ? readFileSync(file) : null
    } catch {
      return null
    }
  }
  const report = evaluate({
    plan: input('plan'),
    manifest: input('manifest'),
    observations: input('observations'),
    owners: input('owners'),
    decision: input('decision'),
    readRaw
  })
  console.log(JSON.stringify(report, null, 2))
  return report.overall === '합격' ? 0 : 1
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    process.exitCode = cli()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 2
  }
}
