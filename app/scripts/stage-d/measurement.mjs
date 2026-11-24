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
    before?.environment === 'linux-electron' &&
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
