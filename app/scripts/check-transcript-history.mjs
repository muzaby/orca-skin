import { SCREENS, resolveElectron, runElectron, serveProbe } from './check-transcript-selection.mjs'

import { scenarios } from './transcript-history/scenarios.mjs'
const repetitions = 5
// Q4b″. Raw line coordinates are CSS pixels in the renderer's clock domain.
function passes(record) {
  if (record.error || !record.after) return false
  const { scenario, after, start, before, wheels } = record
  if (!(start.headerHeight > 0) || start.scrollTop !== 0 || !wheels.every((w) => w.trusted))
    return false
  if (scenario === 'states')
    return (
      record.requests === 0 &&
      record.states.map((s) => s.state).join(',') === 'ready,loading,error,ready,loading,end' &&
      record.states.every(
        (s) => s.headerHeight === start.headerHeight && Math.abs(s.top - start.top) <= 1
      )
    )
  if (
    record.requests !== 1 ||
    !wheels[0]?.prevented ||
    before.part !== after.part ||
    before.text !== after.text ||
    before.headerHeight !== after.headerHeight ||
    after.state !== 'end'
  )
    return false
  const writes = record.writes
  if (
    !writes.some((w) => w.event === 'open') ||
    !writes.some((w) => w.event === 'write' && w.correcting && w.owner === 'anchor') ||
    writes.some((w) => w.event === 'write' && w.correcting && w.owner !== 'anchor')
  )
    return false
  if (
    scenario === 'ownership' &&
    !writes.some(
      (w) => w.event === 'blocked' && w.correcting && w.owner === record.screen.split('-')[0]
    )
  )
    return false
  if (
    scenario === 'lateHeight' &&
    (!record.growth || Math.abs(record.growth.final - record.growth.initial - 40) > 0.5)
  )
    return false
  if (
    scenario === 'firstMeasurement' &&
    (!record.growth || record.growth.initial !== 0 || record.growth.final <= 0)
  )
    return false
  if (
    scenario === 'expired' &&
    (wheels.length !== 2 || wheels[1].timestamp - wheels[0].timestamp < 200 || wheels[1].delta >= 0)
  )
    return false
  if (
    (scenario === 'lateHeight' || scenario === 'firstMeasurement') &&
    !writes.some(
      (w) =>
        w.correcting &&
        w.time >= record.growth.at &&
        w.event === (scenario === 'firstMeasurement' ? 'first-measure' : 'resize-above')
    )
  )
    return false
  if (scenario === 'expired' || scenario === 'reverse')
    return (
      wheels.length === 2 &&
      !wheels[1].prevented &&
      (scenario === 'expired' || wheels[1].delta > 0) &&
      Math.abs(after.scrollTop - wheels[1].scrollTop - wheels[1].delta) <= 1
    )
  if (scenario === 'middle' ? before.scrollTop <= 0 : before.scrollTop !== 0) return false
  if (scenario === 'inertia' && (wheels.length !== 30 || !wheels.every((w) => w.prevented)))
    return false
  if (
    scenario === 'followup' &&
    (wheels.length !== 2 ||
      !wheels[1].prevented ||
      wheels[1].timestamp - wheels[0].timestamp >= 200 ||
      wheels[1].at - record.commitAt < 35)
  )
    return false
  return [after, ...record.layouts].every(
    (sample) => sample.part === before.part && Math.abs(sample.top - before.top) <= 1
  )
}

let server
try {
  let binary
  try {
    binary = resolveElectron()
  } catch {
    process.exitCode = 3
    throw Error('Electron binary unavailable')
  }
  server = await serveProbe('transcript-history', {
    'import.meta.env.VITE_OO_DIAGNOSTIC': JSON.stringify('1')
  })
  const result = await runElectron(
    binary,
    server.origin,
    'transcript-history',
    SCREENS,
    repetitions
  )
  const failures = []
  const maximumShift = {}
  for (const screen of SCREENS) {
    maximumShift[screen] = {}
    for (const scenario of scenarios) {
      const shifts = []
      for (let run = 0; run < repetitions; run++) {
        const rows =
          result.records?.filter(
            (r) => r.run === run && r.screen === screen && r.scenario === scenario
          ) ?? []
        if (rows.length !== 1 || !passes(rows[0])) failures.push({ run, screen, scenario })
        const row = rows[0]
        if (row?.states) shifts.push(...row.states.map((s) => Math.abs(s.top - row.start.top)))
        else if (Number.isFinite(row?.lineShiftPx)) {
          shifts.push(Math.abs(row.lineShiftPx))
          if (!['reverse', 'expired'].includes(scenario))
            shifts.push(...row.layouts.map((sample) => Math.abs(sample.top - row.before.top)))
        }
      }
      maximumShift[screen][scenario] = shifts.length ? Math.max(...shifts) : null
    }
  }
  console.log(JSON.stringify({ scope: 'Q4b-anchor', ...result, failures, maximumShift }))
  process.exitCode = result.error || failures.length ? 1 : 0
} catch (error) {
  console.error(error)
  process.exitCode ??= 1
} finally {
  await server?.close()
}
