import { resolveElectron, runElectron, serveProbe } from './check-transcript-selection.mjs'

import { pathToFileURL } from 'node:url'

export const requiredMeasurements = [
  'pairedWidth-open',
  'pairedWidth-bottom',
  'pairedWidth-reading',
  'pairedWidth-close',
  'pairedWidth-reverse',
  'pairedWidth-reopen',
  'depth-interrupt',
  'depth-forward',
  'depth-back',
  'resize-persistence',
  'mode-width-work',
  'mode-width-code',
  'kindWidth-host-clamp',
  'kindWidth-equal',
  'switch-claude-code-to-claude-code',
  'switch-claude-code-to-claude-work',
  'switch-claude-to-opencode',
  'switch-opencode-to-opencode',
  'switch-opencode-to-claude',
  'native-drag-mode-persistence',
  'native-drag-no-transition',
  'long-task-observation',
  'artifact-A1-pending',
  'artifact-A2-open',
  'artifact-A3-push-pop-to-same',
  'artifact-A4-reveal',
  'artifact-A5-missing',
  'artifact-A6-session-change',
  'artifact-A7-latest',
  'artifact-A8-back-escape-focus',
  'artifact-A9-close',
  'surface-auth-open',
  'surface-installer-open',
  'surface-boot-open',
  'surface-gate-open',
  'surface-login-open',
  'surface-detail-open',
  'surface-search-open',
  'surface-toast-open',
  'surface-modal-open',
  'surface-popover-open',
  'surface-toggle',
  'surface-modal-close',
  'surface-auth-close',
  'surface-installer-close',
  'surface-popover-close',
  'surface-projects-tab',
  'surface-settings-open',
  'surface-settings-tab',
  'surface-extensions-tab',
  'surface-schedules-tab',
  'surface-artifacts-tab',
  'surface-floating-close',
  'surface-sidebar-collapse',
  'surface-disclosure-close'
]

export function passesRightPanel(result) {
  if (
    result?.error ||
    !Array.isArray(result?.records) ||
    result.records.some((row) => row.ok !== true)
  )
    return false
  return [false, true].every((reduced) => {
    const names = new Set(
      result.records.filter((row) => row.reduced === reduced).map((row) => row.name)
    )
    return requiredMeasurements.every((name) => names.has(name))
  })
}

async function main() {
  let server
  try {
    let binary
    try {
      binary = resolveElectron()
    } catch {
      process.exitCode = 3
      throw Error('Electron binary unavailable')
    }
    server = await serveProbe('right-panel')
    const result = await runElectron(binary, server.origin, 'right-panel', [], 1)
    console.log(JSON.stringify(result))
    if (!passesRightPanel(result)) process.exitCode = 1
  } catch (error) {
    console.error(error)
    process.exitCode ??= 1
  } finally {
    await server?.close()
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main()
