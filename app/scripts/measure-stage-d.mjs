import { pathToFileURL } from 'node:url'
import {
  resolveElectron,
  runElectron,
  selectionExitCode,
  serveProbe
} from './check-transcript-selection.mjs'

export function imageLane(records, budget) {
  const durations = records.flatMap((record) => record.imageTimesMs ?? [NaN])
  if (
    !Number.isFinite(budget) ||
    budget <= 0 ||
    !durations.length ||
    durations.some((value) => !Number.isFinite(value) || value < 0)
  )
    return null
  durations.sort((a, b) => a - b)
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1]
  return { p95, max: durations.at(-1), lane: p95 >= budget ? 'image' : 'compute' }
}

export async function main(scenario = 'image') {
  let electron
  try {
    electron = resolveElectron()
  } catch (error) {
    return { env: false, verdict: false, error: String(error) }
  }
  let probe
  try {
    probe = await serveProbe('stage-d')
    const runs = scenario === 'catalogs' ? 1 : 9
    const result = await runElectron(electron, probe.origin, 'stage-d', [scenario], runs)
    if (scenario === 'catalogs') {
      return {
        env: true,
        environment: 'linux-electron',
        ...result,
        verdict:
          !result.error &&
          result.catalogs?.length === runs * 3 &&
          result.catalogs.every(
            ({ mountedRows, lastItemReachable, opensStoredOutput }) =>
              mountedRows > 0 && lastItemReachable !== false && opensStoredOutput !== false
          )
      }
    }
    const decision = imageLane(result.records ?? [], result.budget)
    return {
      env: true,
      environment: 'linux-electron',
      ...result,
      decision,
      verdict:
        !result.error &&
        decision !== null &&
        result.records.length === 9 &&
        result.planGeometry?.openedLast &&
        result.planGeometry.lastVisible &&
        result.planGeometry.tookFocus &&
        result.planGeometry.rectReads > 0 &&
        result.planGeometry.rectReadsAfterResize > 0 &&
        result.planGeometry.rectReadsAfterResize < result.planGeometry.comments &&
        result.installLog?.readingPositionPreserved &&
        result.installLog.followsTail &&
        result.installLog.finalOutputPresent &&
        result.installLog.completions === 1 &&
        result.installLog.mountedRows > 0 &&
        result.installLog.mountedRows <= 200 &&
        result.records.every(
          (record) => record.imageTimesMs.length === 5 && record.renderedThumbnails === 5
        )
    }
  } catch (error) {
    return { env: true, verdict: false, error: String(error) }
  } finally {
    await probe?.close()
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await main(process.argv[2] === '--catalogs' ? 'catalogs' : 'image')
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = selectionExitCode(result)
}
