// Orca Skill 원천소스 = ~/.config/orca/plugins/orca-skills 플러그인 번들.
// claude-code query() 에 plugins:[{type:'local',path}] + skills:'all' 로 명시 로드한다.
// 부팅 시 번들 골격(plugin.json + skills/)을 멱등하게 보장한다. 사용자가 넣은 SKILL.md 는
// 절대 덮어쓰지 않는다.

import { mkdir, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { skillsPluginDir } from '../config/paths'

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

// 번들 골격 보장 후 경로 반환. 경로는 앱 파생값(사용자 입력 없음) → 경로순회 위험 없음.
export async function ensureSkillsPlugin(): Promise<string> {
  const dir = skillsPluginDir()
  await mkdir(join(dir, '.claude-plugin'), { recursive: true })
  await mkdir(join(dir, 'skills'), { recursive: true })

  const manifest = join(dir, '.claude-plugin', 'plugin.json')
  if (!(await exists(manifest))) {
    await writeFile(manifest, JSON.stringify({ name: 'orca-skills' }, null, 2), 'utf8')
  }
  return dir
}
