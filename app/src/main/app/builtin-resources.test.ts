import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { stripCommentsAndStrings } from '../infra/source-scan'
import { resolveBuiltinSkillsDir, resolveWorkProfilePluginDir } from './builtin-resources'

describe('resolveBuiltinSkillsDir', () => {
  it('dev 모드에서는 app root 의 resources/builtin/skills 를 가리킨다', () => {
    expect(
      resolveBuiltinSkillsDir({
        isPackaged: false,
        resourcesPath: '/ignored/resources',
        appPath: '/repo/app'
      })
    ).toBe(join('/repo/app', 'resources', 'builtin', 'skills'))
  })

  it('packaged 모드에서는 process.resourcesPath 하위 builtin/skills 를 가리킨다', () => {
    expect(
      resolveBuiltinSkillsDir({
        isPackaged: true,
        resourcesPath: '/App/Contents/Resources',
        appPath: '/ignored/app.asar'
      })
    ).toBe(join('/App/Contents/Resources', 'builtin', 'skills'))
  })
})

describe('resolveWorkProfilePluginDir', () => {
  it('passes actual Electron host paths through the Bootstrap RouterContext wiring', () => {
    // Bounded call-site contract: resolver unit tests cannot observe incorrect host inputs.
    const source = stripCommentsAndStrings(
      readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')
    )
    expect(source).toMatch(
      /workProfilePluginPath:\s*resolveWorkProfilePluginDir\(\{\s*isPackaged:\s*app\.isPackaged,\s*resourcesPath:\s*process\.resourcesPath,\s*appPath:\s*app\.getAppPath\(\)\s*\}\)/
    )
  })

  it('loads the dev plugin from the application root, independently of cwd', () => {
    expect(
      resolveWorkProfilePluginDir({
        isPackaged: false,
        resourcesPath: '/ignored',
        appPath: '/application'
      })
    ).toBe(join('/application', 'resources', 'claude-plugins', 'work-profile'))
  })

  it('loads the packaged plugin outside app.asar from extraResources', () => {
    const input = {
      isPackaged: true,
      resourcesPath: '/installed/resources',
      appPath: '/installed/resources/app.asar'
    }
    expect(resolveWorkProfilePluginDir(input)).toBe(
      join('/installed/resources', 'claude-plugins', 'work-profile')
    )
    expect(resolveWorkProfilePluginDir(input)).not.toContain('app.asar')
  })
})
