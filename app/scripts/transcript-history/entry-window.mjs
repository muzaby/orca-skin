function atBottom(frame) {
  return frame && frame.bottom > 1 && Math.abs(frame.top - frame.bottom) <= 1
}

function movingFrame(frame) {
  return frame.line && frame.top > 1 && frame.top < frame.bottom - 1
}

function missedEntryWindow({ firstPaint, moving, unitRequest }) {
  // A broken first paint or absent movement stays a failed product observation.
  if (!firstPaint.some((f) => f.opacity > 0 && f.opacity < 1)) return false
  if (!firstPaint.every((f) => f.line && Math.abs(f.top - f.bottom) <= 1)) return false
  if (!atBottom(unitRequest) || !atBottom(moving.at(-1))) return false

  const lastMoving = moving.findLast(movingFrame)
  return lastMoving !== undefined && lastMoving.time < unitRequest.time
}

export async function completeEntryAttempt(scenario, entry, cancel, settle) {
  // Classify the input before sending a wheel or releasing the pending native page.
  if (['entryPrepend', 'entryCancel'].includes(scenario) && missedEntryWindow(entry))
    return { missedEntry: entry }
  if (scenario === 'entryCancel') await cancel()
  return { ...entry, ...(await settle()) }
}

export function recordMissedEntry(discarded, coordinate, entry) {
  discarded.push({ ...coordinate, reason: 'within-unit-request-after-bottom', ...entry })
  if (coordinate.attempt >= 2) throw Error('Could not deliver entry input during bottom movement')
}
