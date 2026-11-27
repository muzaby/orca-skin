// The additional B5 search/selection variant runs separately from the 30 performance samples.
import { resolveElectron, runElectron, serveProbe } from './check-transcript-selection.mjs'
const binary = resolveElectron()
const server = await serveProbe('transcript-body')
try {
  for (const screen of ['claude-code', 'opencode-code']) {
    const url = new URL(server.origin)
    url.search = new URLSearchParams({
      screen,
      input: 'B5',
      run: '0',
      variant: 'middle-source-parts'
    }).toString()
    const row = await runElectron(binary, url.href, 'transcript-body', [screen], 1)
    console.log(JSON.stringify(row))
    if (
      row.variant !== 'middle-source-parts' ||
      row.screen !== screen ||
      row.ok !== true ||
      row.error
    )
      process.exitCode = 1
  }
} finally {
  await server.close()
}
