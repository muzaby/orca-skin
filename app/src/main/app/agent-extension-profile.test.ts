import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { prepareAgentExtensionProfile } from './agent-extension-profile'
import { resolveAgentProfile } from '../features/agents/profiles'
import { ExtensionBuilder } from '../features/extensions/builder'
import type { DbQueries } from '../infra/db'
import type { Settings } from '../../shared/ipc'

const bundledPlugin = resolve('resources/claude-plugins/work-profile')

describe('agent extension profile', () => {
  it('only Work reads the required plugin and preserves independent builder snapshots', async () => {
    const roots = ['/base/app', '/base/user']
    const builder = new ExtensionBuilder(
      {} as DbQueries,
      () => [],
      () => ({}) as Settings,
      'fixture',
      () => roots
    )
    Object.freeze(roots)
    const [workProfile, codeProfile] = await Promise.all([
      prepareAgentExtensionProfile('work', bundledPlugin),
      prepareAgentExtensionProfile('code', '/missing')
    ])
    const work = builder.build(null, null, workProfile)
    const code = builder.build(null, null, codeProfile)
    expect(work.pluginRoots).toEqual([...roots, bundledPlugin])
    expect(code.pluginRoots).toEqual(roots)
    expect(roots).toEqual(['/base/app', '/base/user'])
    expect(work.systemPromptAppend).toContain(resolveAgentProfile('work').instructions)
    expect(work.agentProfileKey).toBe('work:4')
    expect(code).not.toHaveProperty('agentProfileKey')
    expect(code.systemPromptAppend).not.toContain('<work_instructions>')
    expect(codeProfile).not.toHaveProperty('pluginRoots')
  })

  it.each(['relative/plugin', '', resolve('missing-work-profile')])(
    'rejects an unusable Work path (%s) without affecting Code',
    async (path) => {
      await expect(prepareAgentExtensionProfile('work', path)).rejects.toThrow('Work 프로필 리소스')
      await expect(prepareAgentExtensionProfile('code', path)).resolves.not.toHaveProperty(
        'pluginRoots'
      )
    }
  )

  it.each([
    'manifest missing',
    'style missing',
    'manifest invalid',
    'manifest foreign',
    'style empty'
  ])('rejects %s without writing to the resource root', async (condition) => {
    const root = await mkdtemp(join(tmpdir(), 'orca-profile-validation-'))
    try {
      await mkdir(join(root, '.claude-plugin'))
      await mkdir(join(root, 'output-styles'))
      if (condition !== 'manifest missing')
        await writeFile(
          join(root, '.claude-plugin/plugin.json'),
          condition === 'manifest invalid'
            ? '{'
            : JSON.stringify({
                name: condition === 'manifest foreign' ? 'foreign' : 'orcinus-orca-work-profile'
              })
        )
      if (condition !== 'style missing')
        await writeFile(
          join(root, 'output-styles/work.md'),
          condition === 'style empty' ? '  ' : 'fixture'
        )
      const before = await readdir(root, { recursive: true })
      await expect(prepareAgentExtensionProfile('work', root)).rejects.toThrow('Work 프로필 리소스')
      expect(await readdir(root, { recursive: true })).toEqual(before)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
