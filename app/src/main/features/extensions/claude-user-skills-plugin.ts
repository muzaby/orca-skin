// 사용자 ~/.claude/skills 래퍼 플러그인 렌더러 (handoff 0117). settingSources 를
// ['project','local'] 로 명시하면 user 소스가 빠져 ~/.claude/skills 탐색이 끊긴다 — SDK 에서
// skill 을 세션에 넣는 유일한 대안 경로인 options.plugins 로 보전하기 위해, 대상 skills
// 디렉토리를 가리키는 최소 구조 플러그인(매니페스트 + skills 링크)을 dist 에 생성한다:
//
//   dist/<engine>/plugins/claude/
//   ├── .claude-plugin/plugin.json   ← {name:'claude', …}
//   └── skills                       ← 정션(Windows)/심링크(POSIX) → ~/.claude/skills
//
// Windows 는 심볼릭 링크에 관리자 권한/개발자 모드가 필요해 배포 앱에서 전제할 수 없으므로
// **디렉토리 정션**을 쓴다 — fs.symlink(target, path, 'junction') 은 일반 권한으로 생성되고,
// macOS/Linux 에선 세 번째 인자가 무시되어 일반 심링크로 동작한다(크로스 플랫폼 코드 1벌).
// deployer 가 매 배포(부팅 ensureDeployed + CRUD deployNow)마다 dist 를 재생성하므로 본 렌더도
// 매 배포 호출된다 — 사용자가 ~/.claude/skills 를 지웠다 다시 만들어도 다음 배포에서 자가 치유.
//
// 동기 fs 금지(0109) — 부팅/CRUD 경로에서 이벤트 루프를 막지 않는다.
import { mkdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Backend } from '../../../shared/ipc'
import { CLAUDE_USER_PLUGIN_NAME } from '../../adapters/claude-plugin'

export const CLAUDE_USER_PLUGIN_MANIFEST = {
  name: CLAUDE_USER_PLUGIN_NAME,
  description: '사용자 ~/.claude/skills 래퍼 (settingSources user 배제 보전)',
  version: '1.0.0'
} as const

export function userClaudePluginRoot(root: string, engine: Backend): string {
  return join(root, 'dist', engine, 'plugins', CLAUDE_USER_PLUGIN_NAME)
}

// 래퍼 플러그인을 렌더한다(성공 시 플러그인 루트 반환). 대상 skills 디렉토리가 없으면 아무것도
// 만들지 않고 null — 배포 앱에선 ~/.claude/skills 부재가 정상이다(클린 머신). 링크 생성 실패
// (권한·볼륨 이슈)도 크래시 대신 경고 + null 로 강등한다(스킬 없이 동작). 이때 매니페스트만
// 남으면 어댑터의 adaptPlugins 매니페스트 가드가 빈 플러그인을 통과시키므로 디렉토리째 정리한다.
export async function renderClaudeUserSkillsPlugin(input: {
  root: string
  engine: Backend
  skillsTarget: string
}): Promise<string | null> {
  try {
    if (!(await stat(input.skillsTarget)).isDirectory()) return null
  } catch {
    return null
  }

  const pluginRoot = userClaudePluginRoot(input.root, input.engine)
  const skillsLink = join(pluginRoot, 'skills')
  try {
    const manifestDir = join(pluginRoot, '.claude-plugin')
    await mkdir(manifestDir, { recursive: true })
    await writeFile(
      join(manifestDir, 'plugin.json'),
      JSON.stringify(CLAUDE_USER_PLUGIN_MANIFEST, null, 2),
      'utf8'
    )
    // 잔존/깨진 링크 방어 후 재생성(멱등). rm 은 링크 자체만 지우고 대상은 따라가지 않는다 —
    // 보통은 deploy 가 dist 를 통째로 재생성해 빈 자리지만, 백업 실패로 dist 를 지우지 못한
    // 경로(deployer 의 rm 폴백)에서도 안전해야 한다.
    await rm(skillsLink, { recursive: true, force: true })
    await symlink(input.skillsTarget, skillsLink, 'junction')
    return pluginRoot
  } catch (e) {
    console.warn('[deploy] user-skills 래퍼 플러그인 생성 실패 — 스킬 없이 진행:', e)
    await rm(pluginRoot, { recursive: true, force: true }).catch(() => undefined)
    return null
  }
}
