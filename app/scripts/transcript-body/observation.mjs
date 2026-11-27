// PerformanceEntry.startTime and duration use the same renderer clock as start/end.
export function overlapsMeasurement({ startTime, duration }, start, end) {
  if (
    ![startTime, duration, start, end].every(Number.isFinite) ||
    startTime < 0 ||
    duration <= 0 ||
    start < 0 ||
    end <= start
  ) {
    throw new RangeError('Invalid performance entry or measurement interval')
  }
  return startTime + duration > start && startTime < end
}
