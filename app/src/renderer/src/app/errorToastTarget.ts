import type { AppErrorTarget, AppSettingsTab } from '../../../shared/app-error'
import { reportError } from '../shared/errors'

interface ErrorTargetDependencies {
  navigate(path: string): void
  openSettings(tab: AppSettingsTab): void
  revealLog(): Promise<void>
}

function isValidTarget(target: unknown): target is AppErrorTarget {
  if (!target || typeof target !== 'object') return false
  if ('kind' in target && target.kind === 'page' && 'path' in target) {
    return (
      typeof target.path === 'string' &&
      target.path.startsWith('/') &&
      !target.path.startsWith('//')
    )
  }
  if ('kind' in target && target.kind === 'settings' && 'tab' in target) {
    return (
      typeof target.tab === 'string' &&
      (target.tab === 'general' || target.tab === 'usage' || target.tab.startsWith('provider:'))
    )
  }
  return false
}

export async function openErrorTarget(
  target: AppErrorTarget | undefined,
  deps: ErrorTargetDependencies
): Promise<void> {
  if (isValidTarget(target)) {
    if (target.kind === 'page') deps.navigate(target.path)
    else deps.openSettings(target.tab)
    return
  }
  try {
    await deps.revealLog()
  } catch (error) {
    reportError({ event: 'errors.reveal-log.failed', scope: 'errors', title: 'openFailed', error })
  }
}
