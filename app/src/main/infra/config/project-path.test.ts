import { describe, expect, it } from 'vitest'
import { projectPath } from './project-path'

describe('project path identity', () => {
  it('normalizes Windows case, separators, trailing slash and dot segments', () => {
    expect(projectPath('C:\\Work\\area\\..\\Demo\\').key).toBe(projectPath('c:/work/demo').key)
    expect(projectPath('C:\\Work\\Demo\\').name).toBe('Demo')
  })
  it('keeps duplicate basenames at different directories separate', () => {
    const a = projectPath('C:\\TeamA\\Demo')
    const b = projectPath('C:\\TeamB\\Demo')
    expect(a.name).toBe(b.name)
    expect(a.key).not.toBe(b.key)
  })
  it('preserves POSIX case and rejects relative paths and normalized roots', () => {
    expect(projectPath('/work/Demo').key).not.toBe(projectPath('/work/demo').key)
    for (const value of ['relative', '/', '/work/..', 'C:\\', 'C:\\work\\..']) {
      expect(() => projectPath(value)).toThrow()
    }
  })
})
