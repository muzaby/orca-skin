import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExtensionsModalStore } from '../features/skills'

export function SkillsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const show = useExtensionsModalStore((state) => state.show)

  // 기존 /skills 딥링크는 유지하되, 전용 페이지 대신 기본 화면 위 카탈로그 모달로 전환한다.
  useEffect(() => {
    show('skills')
    navigate('/new', { replace: true })
  }, [navigate, show])

  return <></>
}
