import type { SkillInfo } from '../../../../../shared/ipc'

export interface SkillCatalog {
  skills: SkillInfo[]
  plugins: SkillInfo[]
}

// 사용자/어댑터 스킬과 Orca 번들 플러그인을 UI 카탈로그에서만 분리한다.
// 런타임 skill 목록과 sources/skills 배포 구조는 그대로 유지한다.
export function splitSkillCatalog(items: readonly SkillInfo[]): SkillCatalog {
  const skills: SkillInfo[] = []
  const plugins: SkillInfo[] = []
  for (const item of items) {
    if (item.isBuiltin) plugins.push(item)
    else skills.push(item)
  }
  return { skills, plugins }
}
