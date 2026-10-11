// `/` 자동완성 후보를 출처 라벨 섹션으로 묶는다(0259 D-004) — 순수 함수. 후보 순서를 바꾸지 않으므로
// 화면 위→아래 순서와 키보드 활성 인덱스가 같다(연속된 같은 출처만 한 섹션).
import type { SkillInfo } from '../../../../../shared/ipc'

export interface SkillSection {
  key: string
  label: string
  items: { skill: SkillInfo; index: number }[]
}

export function groupSkillSuggestions(skills: readonly SkillInfo[]): SkillSection[] {
  const sections: SkillSection[] = []
  skills.forEach((skill, index) => {
    const last = sections.at(-1)
    if (last && last.items[0].skill.sourceId === skill.sourceId) last.items.push({ skill, index })
    else
      sections.push({
        key: `${skill.sourceId}:${index}`,
        label: skill.sourceLabel,
        items: [{ skill, index }]
      })
  })
  return sections
}
