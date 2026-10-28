import { existsSync, statSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { harnessEnvFingerprint } from '../../common/harness-config'
import { nativeOpenCodeEnvironment, nativeWorkingDirectory } from './native-storage'
import { profileComponents, type ProfileComponents } from './diagnostics'

export function openCodeExecutableIdentity(executable: string): string {
  const stat = existsSync(executable) ? statSync(executable) : undefined
  return JSON.stringify([executable, stat?.mtimeMs, stat?.ctimeMs, stat?.size])
}

export function openCodeServerProfile(
  executable: string,
  config: Record<string, unknown>,
  env?: Record<string, string>,
  directory?: string
): { key: string; cwd: string; environment: NodeJS.ProcessEnv; components: ProfileComponents } {
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
    environment,
    components: profileComponents(openCodeExecutableIdentity(executable), cwd, environment)
  }
}

/** Storage identity excludes execution-only MCP projections and bridge capabilities. */
export function openCodeStorageProfile(
  executable: string,
  env?: Record<string, string>,
  directory?: string
): string {
  const source = { ...process.env, ...env }
  const storage = Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => /^(OPENCODE_DB|XDG_.*|HOME|USERPROFILE)$/i.test(key))
      .sort(([a], [b]) => a.localeCompare(b))
  )
  const relative = Object.entries(storage).some(
    ([key, value]) =>
      value && key !== 'HOME' && key !== 'USERPROFILE' && value !== ':memory:' && !isAbsolute(value)
  )
  return harnessEnvFingerprint({
    executable: openCodeExecutableIdentity(executable),
    storage: JSON.stringify(storage),
    cwd: relative ? nativeWorkingDirectory(directory) : ''
  })
}
