import { accessSync, constants } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  MAIN_DEPS as selection,
  SCREENS,
  RUNS,
  serveProbe,
  runElectron,
  selectionExitCode
} from './check-transcript-selection.mjs'
import { STEPS } from './transcript-streaming/steps.mjs'

export function stepShapeFailures(steps) {
  if (!Array.isArray(steps) || steps.length !== STEPS.length) return ['step count']
  const failures = []
  for (const [i, expected] of STEPS.entries()) {
    const actual = steps[i]
    if (
      !actual ||
      ['step', 'view', 'parsedChars', 'tailLength'].some((key) => actual[key] !== expected[key])
    ) {
      failures.push('step shape: ' + expected.step)
      continue
    }
    if (
      ![actual.missing, actual.duplicated].every(
        (items) => Array.isArray(items) && !items.length
      ) ||
      actual.latestPresent !== true
    )
      failures.push('body markers: ' + expected.step)
    if (expected.stableDelta === null) continue
    const baseline = steps[0]?.stableBlocks
    if (
      !Number.isInteger(baseline) ||
      baseline < 1 ||
      actual.stableBlocks !== baseline + expected.stableDelta
    )
      failures.push('stable blocks: ' + expected.step)
  }
  return failures
}
export function pinStepFailures(steps) {
  return steps
    .filter(
      (s) =>
        s?.step !== 'completed' &&
        !(
          Number.isFinite(s?.bottomDistance) &&
          Math.abs(s.bottomDistance) <= 1 &&
          s.latestVisible === true
        )
    )
    .map((s) => 'bottom: ' + s?.step)
}
export function unpinStepFailures(steps, preconditions) {
  const failures = []
  if (preconditions?.tailBelow !== true || preconditions?.rowTopAbove !== true)
    failures.push('reading position preconditions')
  for (const s of steps)
    if (
      s?.step !== 'completed' &&
      !(Number.isFinite(s?.offset) && Math.abs(s.offset - steps[0]?.offset) <= 1)
    )
      failures.push('offset: ' + s?.step)
  return failures
}
export function judgeStreamingRuns(records) {
  const failures = []
  const seen = new Set()
  for (const r of Array.isArray(records) ? records : []) {
    const id = [r?.screen, r?.scenario, r?.run].join('/')
    if (
      !SCREENS.includes(r?.screen) ||
      !['P1', 'U1'].includes(r?.scenario) ||
      !Number.isInteger(r?.run) ||
      r.run < 0 ||
      r.run >= RUNS ||
      seen.has(id)
    ) {
      failures.push({ id, reason: 'unknown record' })
      continue
    }
    seen.add(id)
    const steps = Array.isArray(r.steps) ? r.steps : []
    const reasons = [
      ...stepShapeFailures(steps),
      ...(r.scenario === 'P1' ? pinStepFailures(steps) : unpinStepFailures(steps, r.preconditions))
    ]
    if (r.error) reasons.push(String(r.error))
    for (const reason of reasons) failures.push({ id, reason })
  }
  for (const screen of SCREENS)
    for (const scenario of ['P1', 'U1'])
      for (let run = 0; run < RUNS; run++) {
        const id = [screen, scenario, run].join('/')
        if (!seen.has(id)) failures.push({ id, reason: 'missing record' })
      }
  return { verdict: failures.length === 0, failures }
}
export const MAIN_DEPS = {
  resolveElectron() {
    const binary = selection.resolveElectron()
    accessSync(binary, constants.X_OK)
    return binary
  },
  serveProbe: () => serveProbe('transcript-streaming'),
  runElectron: (binary, origin) => runElectron(binary, origin, 'transcript-streaming')
}
export async function main(deps = MAIN_DEPS) {
  let binary
  try {
    binary = deps.resolveElectron()
  } catch (error) {
    return { env: false, verdict: false, reason: '환경 없음', error: String(error) }
  }
  let served
  try {
    served = await deps.serveProbe()
    const result = await deps.runElectron(binary, served.origin)
    return { env: true, ...result, ...judgeStreamingRuns(result.records) }
  } catch (error) {
    return { env: true, verdict: false, error: String(error) }
  } finally {
    if (served) await served.close()
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await main()
  console.log(JSON.stringify(result))
  process.exitCode = selectionExitCode(result)
}
