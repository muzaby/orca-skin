// Chromium can publish a match rectangle before its scroll is committed. After moving to a
// unique match, ask the browser for that same match again in the settled viewport.
function overlaps(a, b) {
  return (
    a &&
    b &&
    a.width > 0 &&
    a.height > 0 &&
    b.width > 0 &&
    b.height > 0 &&
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function distanceToViewport(rect, viewport) {
  if (!rect || !rect.width || !rect.height) return Infinity
  return Math.hypot(
    Math.max(0, -rect.x - rect.width, rect.x - viewport.width),
    Math.max(0, -rect.y - rect.height, rect.y - viewport.height)
  )
}

export async function findVisibleTarget(wc, find, needle, readTarget, budgetMs = 15000) {
  const deadline = performance.now() + budgetMs
  const [width, height] = await wc.executeJavaScript('[innerWidth, innerHeight]')
  const viewport = { x: 0, y: 0, width, height }
  const samples = []
  const observe = async (first) => {
    const before = await readTarget()
    const remaining = deadline - performance.now()
    if (remaining <= 0) throw Error('native find exceeded its remaining observation budget')
    const result = await find(wc, needle, first, remaining)
    const after = await readTarget()
    samples.push({ before, native: result.selectionArea, after, matches: result.matches })
    return {
      nativeMatches: result.matches,
      findRect: result.selectionArea,
      markerRect: after,
      nativeFind:
        result.matches === 1 &&
        Boolean(overlaps(after, viewport) && overlaps(after, result.selectionArea))
    }
  }
  let observation = await observe(true)
  let nearest = distanceToViewport(samples[0].before, viewport)
  while (!observation.nativeFind && observation.nativeMatches === 1) {
    const distance = distanceToViewport(observation.markerRect, viewport)
    if (distance >= nearest) break
    nearest = distance
    observation = await observe(false)
  }
  return { ...observation, findSamples: samples }
}
