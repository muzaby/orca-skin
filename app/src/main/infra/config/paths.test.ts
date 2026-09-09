import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { PRODUCT_SLUG } from '../../../shared/product'
import {
  devUserDataDir,
  getWorkspacePath,
  isWithinDir,
  managedWorktreesDir,
  orcaConfigDir,
  orcaJsonPath,
  sourcesSkillsDir,
  projectsDir,
  downloadsDir,
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
  const root = join(homedir(), '.config', PRODUCT_SLUG, 'projects')

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

  it('projectsDir 는 ~/.config/<slug>/projects', () => {
    expect(projectsDir()).toBe(root)
  })
})

describe('downloadsDir', () => {
  it('downloadsDir 는 orcaConfigDir 하위다', () => {
    // workspace-guard 의 read 예외 루트(`orcaConfigDir()`) 안이어야 모델이 결과물을 읽을 수 있다.
    expect(downloadsDir()).toBe(join(homedir(), '.config', PRODUCT_SLUG, 'downloads'))
    expect(isWithinDir(downloadsDir(), join(homedir(), '.config', PRODUCT_SLUG))).toBe(true)
  })
})

describe('devUserDataDir', () => {
  it('appData 하위 sibling `<slug>-dev` 를 반환한다', () => {
    expect(devUserDataDir(join('/x', 'AppData'))).toBe(join('/x', 'AppData', 'orcinus-orca-dev'))
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

// AC3 · AC4 — 격리 worktree 루트. 0210 D-102·D-103.
describe('managedWorktreesDir', () => {
  it('orcaConfigDir 하위다 — `<userData>` 도 저장소 내부도 아니다 (AC3)', () => {
    expect(managedWorktreesDir(false)).toBe(join(orcaConfigDir(), 'worktrees'))
  })

  it('dev 만 `-dev` 로 갈라진다 (AC4)', () => {
    expect(managedWorktreesDir(true)).toBe(join(orcaConfigDir(), 'worktrees-dev'))
    expect(managedWorktreesDir(true)).not.toBe(managedWorktreesDir(false))
  })

  // D-103 의 조건절이 여기 산다. config 루트까지 갈랐다면 dev 가 settings·plugins·projects 를
  // 통째로 잃는데, 그 회귀는 worktree 경로만 보는 단언으로는 보이지 않는다.
  it('orcaConfigDir 자체는 dev 에서도 그대로다 (AC3)', () => {
    expect(orcaConfigDir()).toBe(join(homedir(), '.config', PRODUCT_SLUG))
    expect(projectsDir()).toBe(join(orcaConfigDir(), 'projects'))
    expect(downloadsDir()).toBe(join(orcaConfigDir(), 'downloads'))
  })
})

// ── AT-04 / §10 EP-03 — 설정 루트와 그 하위가 전부 새 슬러그 파생인가 (0225) ─────────────
// 케이스를 함수마다 하나씩 둔다. 한 케이스에 몰면 첫 실패가 나머지를 가려 "몇 곳이 옛 이름인가"
// 를 못 센다.
describe('설정 루트 파생 (0225 AT-04)', () => {
  const root = join(homedir(), '.config', PRODUCT_SLUG)

  it('orcaConfigDir 가 ~/.config/orcinus-orca 다', () => {
    expect(orcaConfigDir()).toBe(root)
    expect(root.endsWith('orcinus-orca')).toBe(true)
  })

  it('managedWorktreesDir 는 prod/dev 둘 다 새 루트 하위다', () => {
    expect(managedWorktreesDir(false)).toBe(join(root, 'worktrees'))
    expect(managedWorktreesDir(true)).toBe(join(root, 'worktrees-dev'))
  })

  it('orcaJsonPath 는 <루트>/orcinus-orca.json 이다', () => {
    expect(orcaJsonPath()).toBe(join(root, `${PRODUCT_SLUG}.json`))
  })

  it('sourcesSkillsDir 는 <루트>/sources/skills 다', () => {
    expect(sourcesSkillsDir()).toBe(join(root, 'sources', 'skills'))
  })

  it('projectsDir 는 <루트>/projects 다', () => {
    expect(projectsDir()).toBe(join(root, 'projects'))
  })

  it('downloadsDir 는 <루트>/downloads 다', () => {
    expect(downloadsDir()).toBe(join(root, 'downloads'))
  })
})
