// 테스트 프로세스의 호스트 격리 계산 (0294) — 순수 함수. 적용(I/O)은 `vitest-setup.mjs` 가 한다.
//
// 사내 PC·self-hosted 러너에는 Claude/OpenCode/Git 설정이 채워져 있다. 테스트가 그것을 읽으면
// 같은 코드가 호스트마다 다른 결과를 낸다(0294 §8: opencode 전역 mcp 27건, 서명 강제 git 76건).
// 그래서 홈·XDG 루트를 테스트 전용 임시 루트로 바꾸고 하네스·git 변수를 지운다.
//
// 지우는 술어는 접두사다 — 프로덕션이 읽는 키를 하나씩 나열하면 새 키가 조용히 샌다.
// `ORCA_*`(opt-in 실기 테스트·배율)·PATH·임시 폴더·프록시는 건드리지 않는다.

import { join } from 'node:path'

export const HERMETIC_REMOVE_PREFIXES = ['ANTHROPIC_', 'CLAUDE_', 'OPENCODE_', 'GIT_']
export const HERMETIC_REMOVE_KEYS = ['CLAUDECODE']

/** 지울 키인가. */
export function isHostHarnessKey(key) {
  return (
    HERMETIC_REMOVE_KEYS.includes(key) || HERMETIC_REMOVE_PREFIXES.some((p) => key.startsWith(p))
  )
}

/**
 * @param {{ env: Record<string, string | undefined>, root: string, platform: string }} input
 * @returns {{ set: Record<string, string>, remove: string[] }}
 */
export function hermeticTestEnv({ env, root, platform }) {
  const home = join(root, 'home')
  const set = {
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: join(root, 'xdg-config'),
    XDG_DATA_HOME: join(root, 'xdg-data'),
    XDG_CACHE_HOME: join(root, 'xdg-cache'),
    XDG_STATE_HOME: join(root, 'xdg-state'),
    // HOME 리다이렉트와 겹치는 이중 방어. 시스템 설정(/etc/gitconfig · Git for Windows 의
    // etc/gitconfig)은 NOSYSTEM 만 막는다.
    GIT_CONFIG_GLOBAL: join(root, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1'
  }
  // OpenCode 는 win32 에서 %ProgramData%\opencode 의 관리 설정도 읽는다.
  if (platform === 'win32') set.ProgramData = join(root, 'programdata')
  const remove = Object.keys(env).filter((key) => isHostHarnessKey(key) && !(key in set))
  return { set, remove }
}

/** `set` 중 디렉토리로 만들어 둘 값(파일인 GIT_CONFIG_GLOBAL·플래그 제외). */
export function hermeticDirectories(set) {
  return Object.entries(set)
    .filter(([key]) => key !== 'GIT_CONFIG_GLOBAL' && key !== 'GIT_CONFIG_NOSYSTEM')
    .map(([, value]) => value)
}
