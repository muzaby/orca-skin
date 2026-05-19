import { useEffect, useState } from 'react'
import type { SkillInfo } from '../../../shared/ipc'

// 부팅 시 main 의 캐시된 스킬 목록을 한 번 로드. main 이 app init 시점에 스캔한
// 결과이므로 hot-reload 는 앱 재시작으로만 반영된다 (본 PR 범위).
export function useSkills(): SkillInfo[] {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  useEffect(() => {
    window.orca.skills
      .list()
      .then(setSkills)
      .catch(() => setSkills([]))
  }, [])
  return skills
}
