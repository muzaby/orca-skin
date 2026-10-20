import { reportError } from '../errors'
import { useEffect, useState } from 'react'
import type { SkillInfo } from '../../../../shared/ipc'
import { skillApi } from '../api/ipc'

// 마운트 시 설치 인벤토리를 조회한다. 세션별 호출 가능 명령은 native 리소스 구독이 담당한다.
export function useSkills(): SkillInfo[] {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  useEffect(() => {
    skillApi
      .list()
      .then(setSkills)
      .catch((error) => {
        reportError({
          event: 'skills.list.load-failed',
          scope: 'skills',
          title: 'loadFailed',
          error: error
        })
        setSkills([])
      })
  }, [])
  return skills
}
