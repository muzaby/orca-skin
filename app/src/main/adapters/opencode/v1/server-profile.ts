import { existsSync, statSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { harnessEnvFingerprint } from '../../common/harness-config'
import { nativeOpenCodeEnvironment, nativeWorkingDirectory } from './native-storage'

export function openCodeExecutableIdentity(executable: string): string {
  const stat = existsSync(executable) ? statSync(executable) : undefined
  return JSON.stringify([executable, stat?.mtimeMs, stat?.ctimeMs, stat?.size])
}

export function openCodeServerProfile(
  executable: string,
  config: Record<string, unknown>,
  env?: Record<string, string>,
  directory?: string
): { key: string; cwd: string; environment: NodeJS.ProcessEnv } {
  const environment = nativeOpenCodeEnvironment(config, env)
  const source = nativeWorkingDirectory(directory)
  const paths = new Set([
    'OPENCODE_CONFIG',
    'OPENCODE_CONFIG_DIR',
    'OPENCODE_MODELS_PATH',
    'OPENCODE_DB',
    'NPM_CONFIG_USERCONFIG',
    'NODE_EXTRA_CA_CERTS'
  ])
  let relativeXdg = false
  for (const [key, value] of Object.entries(environment)) {
    if (!value || isAbsolute(value) || value === ':memory:') continue
    const driveRelative = process.platform === 'win32' && /^[a-z]:/i.test(value)
    if (!driveRelative && /^[a-z][a-z\d+.-]*:/i.test(value)) continue
    const name = process.platform === 'win32' ? key.toUpperCase() : key
    if (/^XDG_(?:DATA|CONFIG|STATE|CACHE)_HOME$/.test(name)) relativeXdg = true
    else if (paths.has(name)) environment[key] = resolve(source, value)
  }
  const cwd = relativeXdg ? source : nativeWorkingDirectory()
  return {
    key: harnessEnvFingerprint({
      executable: openCodeExecutableIdentity(executable),
      environment: JSON.stringify(
        Object.entries(environment).sort(([a], [b]) => a.localeCompare(b))
      ),
      cwd
    }),
    cwd,
    environment
  }
}
