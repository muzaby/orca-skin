import { pathToFileURL } from 'node:url'
import {
  resolveElectron,
  runElectron,
  serveProbe,
  selectionExitCode
} from './check-transcript-selection.mjs'

export const SCREENS = [
  'git-inline',
  'git-split',
  'artifact-code',
  'artifact-markdown',
  'transcript-file',
  'transcript-diff',
  'transcript-work'
]
export const SCENARIOS = ['c1', 'c2', 'c4', 'c5']
function scenarios(screen) {
  return SCENARIOS.filter(
    (s) => s !== 'c4' || screen === 'git-inline' || screen === 'transcript-diff'
  )
}
function newKey(r) {
  if (!Array.isArray(r.keysBefore) || !r.keysBefore.length || !Array.isArray(r.keysAfter))
    return false
  const previous = new Set(r.keysBefore)
  return r.keysAfter.some((k) => !previous.has(k))
}
export function cancelFailures(r) {
  return (
    !newKey(r) ||
    (r.screen.startsWith('transcript-') &&
      (!Array.isArray(r.outerBefore) ||
        !r.outerBefore.length ||
        !Array.isArray(r.outerAfter) ||
        r.outerBefore.length !== r.outerAfter.length ||
        r.outerBefore.some((key, i) => key !== r.outerAfter[i]))) ||
    r.endpointsConnected !== true ||
    !r.selectionBefore ||
    r.selectionAfter !== '' ||
    r.clipboard !== 'unchanged'
  )
}
export function copyFailures(r) {
  return (
    !r.expected ||
    r.clipboard !== r.expected ||
    !Number.isInteger(r.mounted) ||
    r.mounted < 1 ||
    r.mounted >= 150 ||
    r.reachedFirst !== true ||
    r.reachedLast !== true ||
    (r.scenario === 'c1' &&
      r.screen.startsWith('transcript-') &&
      (!r.crossExpected || r.crossClipboard !== r.crossExpected))
  )
}
export function isolationFailures(r) {
  return (
    !newKey(r) ||
    !r.selectionBefore ||
    r.selectionAfter !== r.selectionBefore ||
    r.clipboard !== r.selectionBefore
  )
}
export function judgeVisibleViews(records) {
  const failures = [],
    seen = new Set()
  for (const r of records) {
    const { screen, scenario } = r ?? {}
    const key = screen + '/' + scenario
    let reason
    if (!SCREENS.includes(screen) || !scenarios(screen).includes(scenario) || seen.has(key)) {
      failures.push({ screen, scenario, reason: 'unknown record' })
      continue
    }
    seen.add(key)
    const check =
      scenario === 'c2' ? cancelFailures : scenario === 'c4' ? isolationFailures : copyFailures
    if (r.error) reason = String(r.error)
    else if (check(r)) reason = scenario + ' evidence'
    if (reason) failures.push({ screen, scenario, reason })
  }
  for (const screen of SCREENS)
    for (const scenario of scenarios(screen))
      if (!seen.has(screen + '/' + scenario))
        failures.push({ screen, scenario, reason: 'missing record' })
  return { verdict: !failures.length, failures }
}
export const MAIN_DEPS = { resolveElectron, runElectron, serveProbe }
export async function main(deps = MAIN_DEPS) {
  let binary, served
  try {
    binary = deps.resolveElectron()
  } catch (error) {
    return { env: false, verdict: false, reason: '환경 없음', error: String(error) }
  }
  try {
    served = await deps.serveProbe('visible-views')
    const out = await deps.runElectron(binary, served.origin, 'visible-views', SCREENS, 1)
    if (out.error) return { env: true, verdict: false, ...out }
    return {
      env: true,
      electron: out.electron,
      records: out.records,
      ...judgeVisibleViews(out.records)
    }
  } catch (error) {
    return { env: true, verdict: false, error: String(error) }
  } finally {
    await served?.close()
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await main()
  console.log(JSON.stringify(result))
  process.exitCode = selectionExitCode(result)
}
