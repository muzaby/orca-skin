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

export async function findVisibleTarget(wc, find, needle, readTarget) {
  const [width, height] = await wc.executeJavaScript('[innerWidth, innerHeight]')
  const viewport = { x: 0, y: 0, width, height }
  const samples = []
  const observe = async (first) => {
    const before = await readTarget()
    const result = await find(wc, needle, first)
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
  if (!observation.nativeFind && observation.nativeMatches === 1) {
    // This also guards against an unrelated native match outside the target paragraph:
    // the positive result still requires both rectangles to overlap within the visible window.
    observation = await observe(false)
  }
  return { ...observation, findSamples: samples }
}
