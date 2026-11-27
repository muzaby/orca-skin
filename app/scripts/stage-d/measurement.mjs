import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'

const appRoot = fileURLToPath(new URL('../../', import.meta.url))
export const MEASUREMENT_ENVIRONMENTS = new Set(['linux-electron', 'win32-electron'])
export const measurementEnvironment = (platform = process.platform) => platform + '-electron'

export function appGit(...args) {
  return execFileSync('git', args, { cwd: appRoot, maxBuffer: 128 * 1024 * 1024 })
}

export function parseMeasureArgs(argv, { fixedBaseline }) {
  const index = argv.indexOf('--app-source')
  const expected = index < 0 ? undefined : argv[index + 1]
  if (index >= 0 && !/^[0-9a-f]{40}$/.test(expected ?? ''))
    throw Error('--app-source requires a full commit SHA')
  const baseline = argv.includes('--baseline') ? fixedBaseline : undefined
  if (baseline && expected && baseline !== expected)
    throw Error('--app-source differs from baseline')
  return { baseline, expected }
}

export function appSourceIdentity({ git = appGit, baseline, expected } = {}) {
  const pinned = baseline || expected
  const text = (...args) =>
    git(...args)
      .toString()
      .trim()
  if (pinned) {
    const mismatch = baseline
      ? 'Baseline application sources must equal '
      : 'Application sources must equal '
    try {
      git('diff', '--quiet', pinned, '--', 'src')
    } catch {
      throw Error(mismatch + pinned)
    }
    if (text('ls-files', '--others', '--exclude-standard', '--', 'src'))
      throw Error(mismatch + pinned)
  }
  const commit = text('rev-parse', pinned || 'HEAD')
  if (pinned || !text('status', '--porcelain', '--untracked-files=all', '--', 'src'))
    return { commit, tree: text('rev-parse', commit + ':./src'), dirty: false }
  const hash = createHash('sha256').update(git('diff', 'HEAD', '--binary', '--', 'src'))
  const paths = git('ls-files', '--others', '--exclude-standard', '-z', '--', 'src').toString()
  for (const path of paths.split('\0').filter(Boolean)) {
    const bytes = readFileSync(resolve(appRoot, path))
    hash.update(`\0${path}\0${bytes.length}\0`).update(bytes)
  }
  return { commit, tree: null, dirty: true, diffSha256: hash.digest('hex') }
}

export function provenance({ platform, git = appGit, baseline, expected } = {}) {
  const appSource = appSourceIdentity({ git, baseline, expected })
  return {
    environment: measurementEnvironment(platform),
    tool: git('rev-parse', 'HEAD').toString().trim(),
    appSource,
    sha: appSource.commit,
    dirty: appSource.dirty
  }
}

export function stampProvenance(result, stamp) {
  const conflict = Object.keys(stamp).some(
    (key) => Object.hasOwn(result, key) && !isDeepStrictEqual(result[key], stamp[key])
  )
  return { ...result, ...stamp, ...(conflict ? { provenanceConflict: true } : {}) }
}

const timeFields = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
const countFields = ['C1', 'C2']

function measurement(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function distribution(values) {
  if (!values.length || !values.every(measurement)) return null
  const sorted = values.toSorted((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return {
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted.at(-1)
  }
}

export function summarize(samples) {
  return Object.fromEntries(
    [...timeFields, ...countFields].map((name) => [
      name,
      distribution(samples.map((sample) => sample[name]))
    ])
  )
}

function missingFields(samples, required) {
  return required.filter(
    (name) => !samples.length || samples.some((sample) => !measurement(sample[name]))
  )
}

export function hostDecision(samples, budget) {
  const missing = missingFields(samples, ['T1', 'T2', 'T3', 'T4', 'T5'])
  if (missing.length || !measurement(budget)) return { decision: 'unavailable', missing }
  const host = distribution(samples.map(({ T1, T2 }) => T1 + T2))
  const window = distribution(samples.map(({ T3, T4, T5 }) => T3 + T4 + T5))
  return {
    decision: host.median >= budget && host.median > window.median ? 'on' : 'off',
    host,
    window
  }
}

export function rendererDecision(samples, budget, hostQuery = true) {
  const missing = missingFields(
    samples,
    hostQuery ? ['T1', 'T2', 'T3', 'T4', 'T5'] : ['T3', 'T4', 'T5']
  )
  if (missing.length || !measurement(budget)) return { decision: 'unavailable', missing }
  const longTasks = samples.flatMap((sample) => sample.longTasks ?? []).filter(measurement)
  const synchronous = samples.flatMap(({ T3, T4 }) => [T3, T4])
  return {
    decision: [...longTasks, ...synchronous].some((duration) => duration >= budget) ? 'on' : 'off',
    longestTask: longTasks.length ? Math.max(...longTasks) : null,
    longestSync: Math.max(...synchronous)
  }
}

export function compatibleRun(before, after) {
  return (
    MEASUREMENT_ENVIRONMENTS.has(before?.environment) &&
    !before.provenanceConflict &&
    !after?.provenanceConflict &&
    !(before.appSource?.tree && before.appSource.tree === after?.appSource?.tree) &&
    before.environment === after?.environment &&
    typeof before.electron === 'string' &&
    before.electron === after.electron &&
    before.baseline === true &&
    after.baseline === false &&
    typeof before.sha === 'string' &&
    typeof after.sha === 'string' &&
    before.sha !== after.sha &&
    Array.isArray(before.measurements) &&
    Array.isArray(after.measurements) &&
    before.measurements.length > 0 &&
    before.measurements.length === after.measurements.length &&
    before.measurements.every((entry, index) => {
      const next = after.measurements[index]
      return (
        entry?.id &&
        entry.id === next?.id &&
        entry.size === next.size &&
        entry.source === next.source
      )
    })
  )
}
