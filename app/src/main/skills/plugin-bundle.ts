// 확장 정규 레이어 골격 보장. ~/.config/orca 디렉토리 자체를 Claude 어댑터용 로컬 플러그인으로
// 머티리얼라이즈한다 — `.claude-plugin/plugin.json`(매니페스트)을 두고 백엔드-중립 정규 소스
// skills/ · agents/ · commands/ 디렉토리를 보장한다. claude-code query() 에는
// plugins:[{type:'local', path: orcaConfigDir()}] + skills:'all' 로 명시 로드한다.
//
// 부팅 시 멱등하게 골격만 보장한다. 사용자가 넣은 SKILL.md/에이전트/커맨드는 절대 덮어쓰지 않는다.
// (opencode 어댑터는 미구현 — 같은 정규 소스를 opencode 형식으로 머티리얼라이즈하는 일은 future anchor.)

import { mkdir, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { orcaConfigDir, skillsDir, agentsDir, commandsDir } from '../config/paths'

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

// 골격 보장 후 플러그인 루트(=orcaConfigDir) 반환. 경로는 앱 파생값(사용자 입력 없음) → 경로순회 위험 없음.
export async function ensureOrcaPlugin(): Promise<string> {
  const root = orcaConfigDir()
  await mkdir(join(root, '.claude-plugin'), { recursive: true })
  await mkdir(skillsDir(), { recursive: true })
  await mkdir(agentsDir(), { recursive: true })
  await mkdir(commandsDir(), { recursive: true })

  const manifest = join(root, '.claude-plugin', 'plugin.json')
  if (!(await exists(manifest))) {
    await writeFile(
      manifest,
      JSON.stringify(
        {
          name: 'orca',
          description: 'Orca 정규 확장(skills/agents/commands) — Orca 가 관리',
          version: '1.0.0'
        },
        null,
        2
      ),
      'utf8'
    )
  }
  return root
}
