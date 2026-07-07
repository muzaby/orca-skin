import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { resolveBuiltinSkillsDir } from './builtin-resources'

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
