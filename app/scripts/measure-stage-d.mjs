import { runHostMeasurements } from './stage-d/host-runner.mjs'
import { runShellMeasurements } from './stage-d/shell-runner.mjs'
import { runInstallFlow } from './stage-d/install-runner.mjs'
import {
  compatibleRun,
  provenance,
  stampProvenance,
  parseMeasureArgs
} from './stage-d/measurement.mjs'
import { readFile } from 'node:fs/promises'
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

const fixedBaseline = 'c7d2adf2ddb548a2ce897cfc4f19173a2879b77f'

export async function main(scenario = 'image', baseline = false, expected) {
  const stamp = provenance({ baseline: baseline ? fixedBaseline : undefined, expected })
  return stampProvenance(await measure(scenario, baseline, stamp), stamp)
}

async function measure(scenario, baseline, stamp) {
  let electron
  try {
    electron = resolveElectron()
  } catch (error) {
    return { env: false, verdict: false, error: String(error) }
  }
  let probe
  try {
    if (scenario === 'host') return await runHostMeasurements(electron, baseline, stamp)
    if (scenario === 'usage') return await runHostMeasurements(electron, baseline, stamp, 'usage')
    if (scenario === 'data-flows') return await runHostMeasurements(electron, baseline, stamp, true)
    if (scenario === 'shell') return await runShellMeasurements(electron, baseline, stamp)
    if (scenario === 'installer') return await runInstallFlow(electron)
    const panelComparison = scenario === 'resources' || scenario === 'panel-timings'
    probe = await serveProbe(baseline && panelComparison ? 'stage-d-baseline' : 'stage-d')
    const runs = scenario === 'catalogs' ? 1 : 9
    const result = await runElectron(electron, probe.origin, 'stage-d', [scenario], runs)
    if (scenario === 'panel-timings')
      return {
        env: true,
        ...result,
        baseline,
        verdict:
          !result.error &&
          result.samples?.length === runs &&
          result.samples.every(
            ({ geometry, provider }) =>
              geometry.paragraphs === 2000 &&
              geometry.comments === 129 &&
              provider.storedCharacters === 307845 &&
              (baseline || provider.obsoleteDiscarded)
          )
      }
    if (scenario === 'resources')
      return {
        env: true,
        ...result,
        baseline,
        verdict:
          !result.error &&
          result.samples?.length === runs &&
          result.samples.every(
            (sample) =>
              sample.mounted > 0 &&
              (baseline || sample.mounted < 200) &&
              sample.last === 'm8' &&
              sample.resource === 'resource-9999'
          )
      }
    if (scenario === 'geometry')
      return {
        env: true,
        ...result,
        verdict:
          !result.error &&
          result.geometry?.openedLast &&
          result.geometry.tookFocus &&
          result.geometry.lastVisible
      }
    if (scenario === 'overlap')
      return { env: true, ...result, verdict: !result.error && result.overlap?.thumbnails === 5 }
    if (scenario === 'interactions') {
      return {
        env: true,
        ...result,
        verdict:
          !result.error &&
          result.composer?.length === 3 &&
          result.composer.every((entry) => entry.sessionSwitch === true) &&
          (baseline || result.resources.mounted < 200)
      }
    }
    if (scenario === 'catalogs') {
      return {
        env: true,
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
  const compare = process.argv.indexOf('--compare')
  const scenario =
    [
      'host',
      'data-flows',
      'usage',
      'shell',
      'catalogs',
      'installer',
      'geometry',
      'interactions',
      'resources',
      'panel-timings',
      'overlap'
    ].find((name) => process.argv.includes('--' + name)) ?? 'image'
  try {
    const { baseline, expected } = parseMeasureArgs(process.argv.slice(2), { fixedBaseline })
    const result =
      compare < 0
        ? await main(scenario, Boolean(baseline), expected)
        : await compareEvidence(process.argv.slice(compare + 1))
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = selectionExitCode(result)
  } catch (error) {
    console.error(String(error))
    process.exitCode = 1
  }
}

async function compareEvidence(paths) {
  try {
    if (paths.length !== 2) throw Error('--compare requires baseline and applied JSON paths')
    const [before, after] = await Promise.all(
      paths.map(async (path) => JSON.parse(await readFile(path, 'utf8')))
    )
    if (!before.verdict || !after.verdict || !compatibleRun(before, after))
      throw Error('Incompatible or incomplete host measurements')
    return {
      env: true,
      verdict: true,
      sources: [before, after].map(({ environment, tool, appSource, sha }) => ({
        environment,
        tool: tool ?? null,
        appSource: appSource ?? null,
        sha
      })),
      measurements: before.measurements.map(({ id, size, host, renderer }, index) => ({
        id,
        size,
        host,
        renderer,
        applied: {
          host: after.measurements[index].host,
          renderer: after.measurements[index].renderer
        }
      }))
    }
  } catch (error) {
    return { env: true, verdict: false, error: String(error) }
  }
}
