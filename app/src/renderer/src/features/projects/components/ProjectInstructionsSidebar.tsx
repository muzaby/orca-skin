import { useState } from 'react'
import { EditInstructionsModal } from './EditInstructionsModal'
import { ProjectInstructionsCard } from './ProjectInstructionsCard'
import { projectsActions, useProjectsState } from '../store/projectsStore'

interface ProjectInstructionsSidebarProps {
  projectId: string
}

// 프로젝트 랜딩의 우측 사이드바 — 지침 카드 + 편집 모달.
// 카드 자체가 chrome(테두리·라운드)·내부 패딩을 가지므로 셸은 카드 스택 배치 +
// 스토어 조회 + 모달 open state/update IPC 만 담당(분해는 handoff 0035).
// 바깥 여백/패딩은 page 의 grid 컬럼(px-6 py-8)이 담당 — 셸은 gap 만.
// 파일 첨부 카드는 0208 에서 제거했다(동작 0 인 placeholder). 그 세로 공간은 지침 카드
// 본문의 min-h 로 넘어갔다 — 카드가 하나뿐이어도 gap 은 후속 카드를 위해 남긴다.
export function ProjectInstructionsSidebar({
  projectId
}: ProjectInstructionsSidebarProps): React.JSX.Element {
  const list = useProjectsState((s) => s.list)
  const { update } = projectsActions
  const project = list.find((p) => p.id === projectId) ?? null
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <ProjectInstructionsCard
        instructions={project?.instructions ?? ''}
        onEdit={() => setEditOpen(true)}
      />

      <EditInstructionsModal
        open={editOpen}
        initial={project?.instructions ?? ''}
        projectName={project?.name ?? ''}
        onClose={() => setEditOpen(false)}
        onSave={async (instructions) => {
          await update(projectId, { instructions })
        }}
      />
    </div>
  )
}
