import { resolveElectron, runElectron, serveProbe } from '../check-transcript-selection.mjs'

// Isolate each measurement: a hung renderer or Chromium allocation failure must still
// produce a failing record and leave the other inputs runnable.
export async function measureBodyMatrix(binary, origin) {
  const records = []
  for (let run = 0; run < 3; run++) {
    for (const screen of ['claude-code', 'opencode-code']) {
      for (const input of ['B1', 'B2', 'B3', 'B4', 'B5']) {
        const url = new URL(origin)
        url.search = new URLSearchParams({ screen, input }).toString()
        let result
        try {
          result = await runElectron(binary, url.href, 'transcript-body', [screen], 1)
        } catch (error) {
          result = { error: String(error) }
        }
        const record = { run, screen, input, ...result }
        records.push(record)
        console.log(JSON.stringify(record))
      }
    }
  }
  return records.length === 30 &&
    records.every(
      (row) =>
        row.complete && row.longtask.length === 0 && (row.input !== 'B1' || row.selectionMatches)
    )
    ? 0
    : 1
}

export async function measureBodies() {
  let binary
  try {
    binary = resolveElectron()
  } catch {
    return 3
  }
  const server = await serveProbe('transcript-body')
  try {
    return await measureBodyMatrix(binary, server.origin)
  } finally {
    await server.close()
  }
}
