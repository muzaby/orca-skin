import { resolve } from 'node:path'
import type { SettingsStore } from '../infra/settings-store'
import type { ExtensionControl } from '../adapters/common/extension-control'

export function extensionProjectKey(directory: string): string {
  const path = resolve(directory).replaceAll('\\', '/')
  return process.platform === 'win32' ? path.toLowerCase() : path
}

export function extensionControl(
  settings: Pick<SettingsStore, 'getAll' | 'patch'>
): ExtensionControl {
  return {
    global: (backend) => ({ ...settings.getAll().nativeExtensionChoices?.[backend] }),
    projectMcp: (directory) => ({
      ...settings.getAll().projectMcpChoices?.[extensionProjectKey(directory)]
    }),
    setProjectMcp: (directory, id, enabled) => {
      const key = extensionProjectKey(directory)
      const current = settings.getAll().projectMcpChoices ?? {}
      if (current[key]?.[id] === enabled) return
      settings.patch({
        projectMcpChoices: { ...current, [key]: { ...current[key], [id]: enabled } }
      })
    }
  }
}
