import { SCREENS, resolveElectron, runElectron, serveProbe } from './check-transcript-selection.mjs'

import { scenarios } from './transcript-history/scenarios.mjs'
if (process.argv.includes('--perf')) {
  const { measureBodies } = await import('./transcript-body/perf.mjs')
  process.exit(await measureBodies())
}
const repetitions = process.argv.includes('--search') ? 0 : 5
// Q4b″. Raw line coordinates are CSS pixels in the renderer's clock domain.
function passes(record) {
  if (record.error) return false
  if (record.scenario === 'unitOpen') {
    const keys = Array.from({ length: 10 }, (_, i) => ['u:' + (i + 1), 'a:' + (i + 1)]).flat()
    return (
      JSON.stringify(record.first) === JSON.stringify(keys.slice(10)) &&
      JSON.stringify(record.ids) === JSON.stringify(keys) &&
      record.rowsBeforeScroll.length === 0 &&
      Math.abs(record.unitPlacement.top - record.unitPlacement.bottom) <= 1 &&
      record.requests.join(',') === 'earlierTurn'
    )
  }
  if (record.scenario === 'pullShort') {
    const { before, opening, frames } = record
    return (
      record.requests.join(',') === 'earlierTurn' &&
      opening.at(-1) >= 47 &&
      Math.abs(frames[0].top - before.top) <= 1 &&
      frames.some((f) => f.height > 0 && f.height < 47) &&
      frames.at(-1).height === 0
    )
  }
  if (record.scenario === 'framesUnit') {
    const before = record.before
    return (
      before.hit?.text &&
      record.requests.join(',') === 'withinUnit' &&
      record.layouts.every(
        (s) =>
          Math.abs(s.top - before.top) <= 1 && JSON.stringify(s.hit) === JSON.stringify(before.hit)
      )
    )
  }
  if (['openFrames', 'entryPrepend', 'entryCancel'].includes(record.scenario)) {
    const { firstPaint, moving, samples, writes } = record
    const last = samples.at(-1)
    if (
      !firstPaint.some((f) => f.opacity > 0 && f.opacity < 1) ||
      !firstPaint.every((f) => f.line && Math.abs(f.top - f.bottom) <= 1) ||
      !moving.some((f) => f.line && f.top > 1 && f.top < f.bottom - 1) ||
      !last
    )
      return false
    if (record.scenario === 'entryCancel')
      return (
        last.bottom - last.top > 1 &&
        !writes.some((w) => w.event === 'write' && ['claude', 'opencode'].includes(w.owner))
      )
    if (record.scenario === 'openFrames' && !writes.some((w) => w.event === 'open')) {
      // Idle unit fill may arrive after the native bottom movement has completed.
      // AC12 still requires the middle frames and both settled bottom positions.
      return (
        Math.abs(record.before.scrollTop - moving.at(-1).bottom) <= 1 &&
        Math.abs(last.top - last.bottom) <= 1
      )
    }
    if (record.scenario === 'entryPrepend') {
      const backend = record.screen.split('-')[0]
      const open = writes.findIndex((w) => w.event === 'open')
      const settled = writes.findIndex((w) => w.event === 'settled')
      const pause = writes[open - 1]
      if (
        pause?.owner !== backend ||
        pause.event !== 'write' ||
        Math.abs(pause.top - record.before.scrollTop) > 1 ||
        Math.abs(writes[open].top - pause.top) > 1 ||
        settled <= open ||
        !writes.slice(settled + 1).some((w) => w.owner === backend && w.event === 'write')
      )
        return false
    }
    return (
      Math.abs(last.top - last.bottom) <= 1 &&
      writes.some((w) => w.event === 'open') &&
      samples
        .filter((s) => s.correcting)
        .every((s) => s.line !== null && Math.abs(s.line - record.before.top) <= 1)
    )
  }
  if (record.error || !record.after) return false
  const { scenario, after, start, before, wheels } = record
  if (!(start.headerHeight > 0) || start.scrollTop !== 0 || !wheels.every((w) => w.trusted))
    return false
  const anchored = () =>
    record.requests === 1 &&
    before?.hit?.text &&
    [after, ...record.layouts].every(
      (sample) =>
        sample.part === before.part &&
        sample.text === before.text &&
        Math.abs(sample.top - before.top) <= 1 &&
        JSON.stringify(sample.hit) === JSON.stringify(before.hit)
    )
  if (scenario === 'framesWheel' && !wheels.some((w) => w.trusted && w.delta < 0)) return false
  if (scenario.startsWith('frames')) return anchored()
  if (scenario === 'pullEnd')
    return record.requests === 0 && record.spinners === 0 && record.heights.every((h) => h === 0)
  if (scenario.startsWith('pull')) {
    if (
      !record.opening.some((h) => h > 0 && h < 48) ||
      !record.held.every((h) => Math.abs(h - 48) <= 1) ||
      record.requests !== 1
    )
      return false
    if (scenario === 'pullFailure')
      return (
        record.closing.some((h) => h > 0 && h < 48) &&
        record.closing.at(-1) === 0 &&
        after.state === 'error' &&
        Math.abs(start.top - after.top) <= 1
      )
    return anchored() && (scenario !== 'pullSuccess' || Math.abs(record.joinGap) <= 1)
  }
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
    !wheels[scenario === 'nested' ? 1 : 0]?.prevented ||
    before.part !== after.part ||
    before.text !== after.text ||
    before.headerHeight !== after.headerHeight ||
    after.state !== 'end'
  )
    return false
  if (
    scenario === 'nested' &&
    (wheels.length !== 2 ||
      wheels[0].prevented ||
      record.nestedRead?.requests !== 1 ||
      !(record.nestedRead.scrollTop < 40))
  )
    return false
  if (
    scenario === 'footerResize' &&
    (!record.growth ||
      record.growth.final - record.growth.initial !== 39 ||
      !record.footerSizes.includes(record.growth.final))
  )
    return false
  if (scenario === 'doublePrepend' && !(Math.abs(record.betweenPrepends - before.top) <= 1))
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
  if (process.argv.includes('--layout')) {
    server = await serveProbe('transcript-layout')
    const result = await runElectron(binary, server.origin, 'transcript-layout', SCREENS, 1)
    console.log(JSON.stringify(result))
    process.exitCode = result.records?.length === 8 && result.records.every((row) => row.ok) ? 0 : 1
  } else {
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
    for (const screen of SCREENS) {
      for (const keyboard of [false, true]) {
        const resultForHit = result.searches?.find(
          (sample) => sample.screen === screen && sample.keyboard === keyboard
        )
        if (
          !resultForHit?.visible ||
          resultForHit.selected !== 'u:63' ||
          resultForHit.owner !== 'u:63:user' ||
          resultForHit.focused !== keyboard ||
          resultForHit.requests?.join(',') !== 'target'
        )
          failures.push({ screen, keyboard, scenario: 'search' })
      }
    }
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
  }
} catch (error) {
  console.error(error)
  process.exitCode ??= 1
} finally {
  await server?.close()
}
