import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { hermeticDirectories, hermeticTestEnv, isHostHarnessKey } from './test-host.mjs'

const ROOT = join('/', 'tmp', 'orca-test-host-x')
const HOST = {
  ANTHROPIC_MODEL: 'corp-model',
  ANTHROPIC_BASE_URL: 'https://llm.corp.example',
  CLAUDE_CONFIG_DIR: '/corp/claude',
  CLAUDE_CODE_DISABLE_1M_CONTEXT: '1',
  CLAUDECODE: '1',
  OPENCODE_CONFIG: '/corp/opencode.json',
  OPENCODE_CONFIG_DIR: '/corp/oc',
  GIT_CONFIG_SYSTEM: '/corp/gitconfig',
  GIT_DIR: '/corp/.git',
  ORCA_TEST_TIME_SCALE: '5',
  ORCA_TEST_OPENCODE_EXE: '/bin/opencode',
  PATH: '/usr/bin',
  TEMP: 'C:\\Temp',
  TMPDIR: '/tmp',
  HTTPS_PROXY: 'http://proxy.corp.example:8080',
  CI: 'true',
  HOME: '/home/real',
  XDG_CONFIG_HOME: '/home/real/.config'
}

describe('호스트 격리 env (0294 AC10)', () => {
  test('하네스·git 변수는 지우고 ORCA_*·PATH·임시 폴더·프록시·CI 는 남긴다', () => {
    const { remove } = hermeticTestEnv({ env: HOST, root: ROOT, platform: 'linux' })
    assert.deepEqual(remove.sort(), [
      'ANTHROPIC_BASE_URL',
      'ANTHROPIC_MODEL',
      'CLAUDECODE',
      'CLAUDE_CODE_DISABLE_1M_CONTEXT',
      'CLAUDE_CONFIG_DIR',
      'GIT_CONFIG_SYSTEM',
      'GIT_DIR',
      'OPENCODE_CONFIG',
      'OPENCODE_CONFIG_DIR'
    ])
    for (const kept of [
      'ORCA_TEST_TIME_SCALE',
      'ORCA_TEST_OPENCODE_EXE',
      'PATH',
      'TEMP',
      'TMPDIR',
      'HTTPS_PROXY',
      'CI'
    ])
      assert.equal(remove.includes(kept), false, kept)
  })

  test('지움 술어는 접두사와 정확 키다 — 이름이 비슷한 키는 남는다', () => {
    assert.equal(isHostHarnessKey('CLAUDE'), false)
    assert.equal(isHostHarnessKey('MY_CLAUDE_X'), false)
    assert.equal(isHostHarnessKey('GITHUB_TOKEN'), false)
    assert.equal(isHostHarnessKey('OPENCODE_X'), true)
    assert.equal(isHostHarnessKey('CLAUDECODE'), true)
  })

  test('홈·XDG 4종·git 은 루트 아래로 — 서로 다른 자리다', () => {
    const { set } = hermeticTestEnv({ env: HOST, root: ROOT, platform: 'linux' })
    assert.deepEqual(set, {
      HOME: join(ROOT, 'home'),
      USERPROFILE: join(ROOT, 'home'),
      XDG_CONFIG_HOME: join(ROOT, 'xdg-config'),
      XDG_DATA_HOME: join(ROOT, 'xdg-data'),
      XDG_CACHE_HOME: join(ROOT, 'xdg-cache'),
      XDG_STATE_HOME: join(ROOT, 'xdg-state'),
      GIT_CONFIG_GLOBAL: join(ROOT, 'gitconfig'),
      GIT_CONFIG_NOSYSTEM: '1'
    })
    assert.equal(new Set(hermeticDirectories(set)).size, 5)
  })

  test('ProgramData 는 win32 에서만 바꾼다', () => {
    assert.equal(
      hermeticTestEnv({ env: HOST, root: ROOT, platform: 'win32' }).set.ProgramData,
      join(ROOT, 'programdata')
    )
    assert.equal(
      'ProgramData' in hermeticTestEnv({ env: HOST, root: ROOT, platform: 'linux' }).set,
      false
    )
  })

  test('바꾸는 GIT_ 키는 지움 목록에 오르지 않는다', () => {
    const env = { GIT_CONFIG_GLOBAL: '/corp/global', GIT_CONFIG_NOSYSTEM: '0' }
    assert.deepEqual(hermeticTestEnv({ env, root: ROOT, platform: 'linux' }).remove, [])
  })
})

describe('격리 전역 git 설정 내용 (0298)', () => {
  test('신원 · core.autocrlf=false · maintenance.auto=false 를 담는다', async () => {
    const { HERMETIC_GIT_CONFIG, HERMETIC_GIT_IDENTITY } = await import('./test-host.mjs')
    assert.deepEqual(HERMETIC_GIT_IDENTITY, { name: 'orca test', email: 'test@orca.local' })
    assert.equal(
      HERMETIC_GIT_CONFIG,
      '[user]\n\tname = orca test\n\temail = test@orca.local\n[core]\n\tautocrlf = false\n[maintenance]\n\tauto = false\n'
    )
  })
})
