import { execFileSync } from 'node:child_process'
import { resolveElectron, runElectron, serveProbe } from '../check-transcript-selection.mjs'
import { bodyCorpora, inputs, screens } from './fixtures.mjs'

const coordinates = (row) => JSON.stringify([row?.screen, row?.input, row?.run])
const plans = Array.from({ length: 3 }, (_, run) =>
  screens.flatMap((screen) => inputs.map((input) => ({ screen, input, run })))
).flat()

function validCounts(input, counts) {
  if (!counts) return false
  if (input === 'B5') return counts.paragraphs === 2443 && counts.checked === 2443
  if (input === 'B4') return counts.paragraphs === 1 && counts.inline === 25001
  if (input === 'B2')
    return (
      counts.regular === 3000 &&
      counts.fences === 40 &&
      counts.tables === 2 &&
      counts.list === 30000 &&
      counts.structure === 1 &&
      counts.cells === 1 &&
      counts.footnote === 1
    )
  return counts.paragraphs === 1
}

function rectanglesOverlap(a, b) {
  return (
    [a, b].every(
      (r) =>
        r &&
        ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(r[k])) &&
        r.width > 0 &&
        r.height > 0
    ) &&
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export function judgeBodyMatrix(records, calibration) {
  const errors = []
  const expected = new Set(plans.map(coordinates))
  if (calibration?.calibration !== true || calibration.supported !== true || calibration.lost !== 0)
    errors.push('observer calibration')
  if (!Array.isArray(records)) return { ok: false, errors: [...errors, 'record array missing'] }
  const builds = new Set()
  for (const row of records) {
    if (!row || typeof row !== 'object') {
      errors.push('invalid record')
      continue
    }
    const key = coordinates(row)
    if (!expected.delete(key)) errors.push(key + ' unexpected or duplicate')
    const sizesMatch = Object.hasOwn(bodyCorpora, row.input) && bodyCorpora[row.input]
    const frames = (entries) =>
      Array.isArray(entries) &&
      entries.every(
        (e) =>
          Number.isFinite(e?.start) && e.start >= 0 && Number.isFinite(e.duration) && e.duration > 0
      )
    builds.add(JSON.stringify([row.sha, row.electron, row.chrome, row.os, row.dpr]))
    if (
      row.error ||
      !Number.isInteger(row.run) ||
      !sizesMatch ||
      Object.entries(sizesMatch).some(([k, n]) => row[k] !== n) ||
      row.complete !== true ||
      row.stable !== 10 ||
      row.delivered !== (row.input === 'B3' ? row.characters : row.bytes) ||
      row.pending !== 0 ||
      row.lateMutation !== false ||
      row.supported !== true ||
      row.lost !== 0 ||
      !(
        Number.isFinite(row.start) &&
        Number.isFinite(row.end) &&
        row.start >= 0 &&
        row.start < row.end
      ) ||
      !frames(row.longtask) ||
      row.longtask.length > 0 ||
      !frames(row.longAnimationFrame) ||
      !row.longAnimationFrame.every(
        (f) =>
          Number.isFinite(f.styleAndLayoutStart) &&
          f.styleAndLayoutStart >= 0 &&
          Array.isArray(f.scripts) &&
          f.scripts.every(
            (s) =>
              typeof s?.invoker === 'string' &&
              Number.isFinite(s.duration) &&
              s.duration >= 0 &&
              Number.isFinite(s.forcedLayout) &&
              s.forcedLayout >= 0
          )
      ) ||
      row.sourceMatches !== true ||
      row.formattedBodyMatches !== true ||
      row.selectionMatches !== true ||
      row.searchTarget !== true ||
      row.nativeFind !== true ||
      !Number.isInteger(row.nativeMatches) ||
      row.nativeMatches < 1 ||
      !rectanglesOverlap(row.findRect, row.markerRect) ||
      !validCounts(row.input, row.bodyCounts) ||
      !Array.isArray(row.phases) ||
      ![
        'first input',
        'markdown mounted',
        'final render',
        row.input === 'B3' ? 'last delta' : 'last page'
      ].every((name) => row.phases.some((p) => p?.name === name)) ||
      !row.phases.every(
        (p, i) =>
          typeof p?.name === 'string' &&
          Number.isFinite(p.at) &&
          p.at >= row.start &&
          p.at <= row.end &&
          (!i || row.phases[i - 1].at <= p.at)
      ) ||
      typeof row.electron !== 'string' ||
      !row.electron ||
      typeof row.chrome !== 'string' ||
      !row.chrome ||
      typeof row.os !== 'string' ||
      !row.os ||
      typeof row.sha !== 'string' ||
      !row.sha ||
      !Array.isArray(row.viewport) ||
      row.viewport.length !== 2 ||
      row.viewport[0] !== 1000 ||
      row.viewport[1] !== 600 ||
      !Number.isFinite(row.dpr) ||
      row.dpr <= 0
    )
      errors.push(key + ' measurement')
  }
  if (builds.size > 1) errors.push('mixed build or browser environment')
  for (const key of expected) errors.push(key + ' missing')
  return { ok: errors.length === 0, errors }
}

export async function measureBodyMatrix(binary, origin) {
  const records = []
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  async function sample(plan, calibrate = false) {
    const url = new URL(origin)
    url.search = new URLSearchParams({ ...plan, ...(calibrate && { calibrate: '1' }) }).toString()
    try {
      const result = await runElectron(binary, url.href, 'transcript-body', [plan.screen], 1)
      if (coordinates(result) !== coordinates(plan))
        return { ...plan, error: 'wrong renderer identity', received: coordinates(result) }
      return { ...result, sha }
    } catch (error) {
      return { ...plan, sha, error: String(error) }
    }
  }
  const calibration = await sample(plans[0], true)
  console.log(JSON.stringify({ calibration }))
  for (const plan of plans) {
    const record = await sample(plan)
    records.push(record)
    console.log(JSON.stringify(record))
  }
  const verdict = judgeBodyMatrix(records, calibration)
  console.log(JSON.stringify({ verdict }))
  return verdict.ok ? 0 : 1
}

export async function measureBodies() {
  let binary
  try {
    binary = resolveElectron()
  } catch {
    return 3
  }
  const server = await serveProbe('transcript-body')
  try {
    return await measureBodyMatrix(binary, server.origin)
  } finally {
    await server.close()
  }
}
