import { expect, it } from 'vitest'
import {
  isSelectedProject,
  landingProjectOptions,
  projectForDirectory
} from './landingProjectOptions'
const items = [
  { id: 'z', name: '같은 이름', cwd: 'C:/Alpha' },
  { id: 'a', name: '같은 이름', cwd: 'D:/Beta' },
  { id: 'legacy', name: 'legacy', cwd: null }
]
it('preserves catalog order and searches names or full paths, excluding pathless rows', () => {
  expect(landingProjectOptions(items).map((p) => p.id)).toEqual(['z', 'a'])
  expect(landingProjectOptions(items, '  ALPHA ')).toEqual([items[0]])
  expect(landingProjectOptions(items, '같은')).toHaveLength(2)
  expect(landingProjectOptions(items, 'missing')).toEqual([])
})
it('matches canonical Windows paths without merging names or conflicting selected IDs', () => {
  expect(projectForDirectory(items, 'c:\\ALPHA\\')?.id).toBe('z')
  expect(projectForDirectory(items, 'E:/new')).toBeUndefined()
  expect(isSelectedProject({ ...items[0], cwd: 'C:/Alpha' }, 'c:/alpha/', null)).toBe(true)
  expect(isSelectedProject({ ...items[0], cwd: 'C:/Alpha' }, 'c:/alpha/', 'a')).toBe(false)
})
