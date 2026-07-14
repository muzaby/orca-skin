import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  devUserDataDir,
  getWorkspacePath,
  isWithinDir,
  projectsDir,
  safeProjectName,
  shortProjectId,
  workspaceDirName
} from './paths'

// getWorkspacePath 는 mkdirSync 부작용이 있으나 경로 *문자열* 만 검증한다 — fs no-op 으로 격리.
vi.mock('node:fs', () => ({ mkdirSync: () => undefined }))

describe('safeProjectName', () => {
  it('공백류를 언더스코어로 바꾼다', () => {
    expect(safeProjectName('My Project')).toBe('My_Project')
    expect(safeProjectName('a\t b\nc')).toBe('a_b_c')
  })

  it('비안전 문자를 하이픈으로 바꾸고 양끝 구두점을 정리한다', () => {
    expect(safeProjectName('foo/bar:baz')).toBe('foo-bar-baz')
    expect(safeProjectName('  ..hello..  ')).toBe('hello')
  })

  it('길이를 40자로 캡한다', () => {
    expect(safeProjectName('a'.repeat(100))).toHaveLength(40)
  })

  it('빈 결과는 project 폴백', () => {
    expect(safeProjectName('   ')).toBe('project')
    expect(safeProjectName('///')).toBe('project')
  })
})

describe('shortProjectId', () => {
  it('하이픈 제거 후 앞 8자를 쓴다', () => {
    expect(shortProjectId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400')
  })
})

describe('workspaceDirName', () => {
  it('<이름>-<ID8> 로 조합한다', () => {
    expect(workspaceDirName({ id: '550e8400-e29b-41d4', name: 'My Project' })).toBe(
      'My_Project-550e8400'
    )
  })
})

describe('getWorkspacePath', () => {
  const root = join(homedir(), '.config', 'orca', 'projects')

  it('프로젝트 없으면 projects/default', () => {
    expect(getWorkspacePath(null)).toBe(join(root, 'default'))
    expect(getWorkspacePath()).toBe(join(root, 'default'))
  })

  it('프로젝트 소속이면 파생 디렉토리', () => {
    expect(getWorkspacePath({ id: '550e8400-e29b-41d4', name: 'My Project' })).toBe(
      join(root, 'My_Project-550e8400')
    )
  })

  it('cwd 지정값(future)이 파생값보다 우선한다', () => {
    expect(getWorkspacePath({ id: '550e8400', name: 'My Project', cwd: '/abs/repo' })).toBe(
      '/abs/repo'
    )
  })

  it('projectsDir 는 ~/.config/orca/projects', () => {
    expect(projectsDir()).toBe(root)
  })
})

describe('devUserDataDir', () => {
  it('appData 하위 sibling `orca-dev` 를 반환한다', () => {
    expect(devUserDataDir(join('/x', 'AppData'))).toBe(join('/x', 'AppData', 'orca-dev'))
  })
})

describe('isWithinDir', () => {
  it('하위 경로와 동일 경로는 true', () => {
    expect(isWithinDir('/repo/orca/sub', '/repo/orca')).toBe(true)
    expect(isWithinDir('/repo/orca', '/repo/orca')).toBe(true)
  })

  it('상위/형제/이탈(..) 경로는 false', () => {
    expect(isWithinDir('/repo', '/repo/orca')).toBe(false)
    expect(isWithinDir('/repo/other', '/repo/orca')).toBe(false)
    expect(isWithinDir('/repo/orca/../../etc', '/repo/orca')).toBe(false)
  })

  it('정규화로 중복 슬래시·trailing 슬래시를 흡수한다', () => {
    expect(isWithinDir('/repo/orca/sub/', '/repo//orca')).toBe(true)
  })
})
