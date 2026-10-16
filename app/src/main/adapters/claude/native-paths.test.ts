import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { claudeNativePaths } from './native-paths'
import { readUserClaudeSettings } from './settings'
import { claudePlansDirectory, planFileTarget } from './plan-file'
import { guardToolAccess, resolveGuardRoots } from './workspace-guard'

const roots: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('Claude native root consumers', () => {
  it('uses the native default and preserves home expansion for plans', () => {
    const home = path.resolve('fixture-home')
    expect(claudeNativePaths(() => undefined, home).root).toBe(path.join(home, '.claude'))
    expect(claudeNativePaths(() => '~/native', home).plans).toBe(path.join(home, 'native', 'plans'))
  })

  it('imports settings and permits plan writes at the same custom native root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'orca-native-paths-'))
    roots.push(root)
    const native = path.join(root, 'native')
    await mkdir(native)
    const settings = '{"model":"native-default"}'
    await writeFile(path.join(native, 'settings.json'), settings)
    vi.stubEnv('CLAUDE_CONFIG_DIR', native)
    expect(readUserClaudeSettings()).toEqual({ exists: true, settingsJson: settings })
    const plans = claudePlansDirectory((key) => process.env[key])
    expect(plans).toBe(path.join(native, 'plans'))
    const plan = path.join(plans, 'test.md')
    expect(planFileTarget('Write', { file_path: plan }, plans)).toBe(plan)
    const guard = resolveGuardRoots(path.join(root, 'workspace'))
    expect(guardToolAccess('Write', { file_path: plan }, guard)).toBeNull()
    expect(
      guardToolAccess('Write', { file_path: path.join(root, 'outside.md') }, guard)
    ).not.toBeNull()
  })

  it('does not turn a custom native root into filesystem-wide write permission', () => {
    expect(() =>
      resolveGuardRoots(path.resolve('workspace'), [], path.parse(process.cwd()).root)
    ).toThrow('native root')
  })
})
