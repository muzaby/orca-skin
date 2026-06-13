import { useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { EditInstructionsModal } from './EditInstructionsModal'
import { projectsActions, useProjectsState } from '../store/projectsStore'

interface ProjectInstructionsSidebarProps {
  projectId: string
}

// 프로젝트 랜딩의 우측 사이드바 — 지침 + 파일 placeholder + 편집 모달 트리거.
// 모달 open state 와 update IPC 호출 모두 feature 내부에서 닫힘.
export function ProjectInstructionsSidebar({
  projectId
}: ProjectInstructionsSidebarProps): React.JSX.Element {
  const list = useProjectsState((s) => s.list)
  const { update } = projectsActions
  const project = list.find((p) => p.id === projectId) ?? null
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="flex flex-col">
      <section className="border-b border-border px-5 py-4">
        <div className="mb-1.5 flex items-center">
          <div className="font-serif text-[13px] font-semibold text-ink">지침</div>
          <button
            onClick={() => setEditOpen(true)}
            className="ml-auto flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-[11px] text-ink2 hover:text-ink"
            title="지침 편집"
          >
            <Icon name="edit" size={11} /> 편집
          </button>
        </div>
        {project?.instructions.trim() ? (
          <pre className="m-0 whitespace-pre-wrap break-words font-sans text-[12px] leading-[1.6] text-ink2">
            {project.instructions}
          </pre>
        ) : (
          <div className="text-[12px] leading-[1.5] text-ink3">
            아직 지침이 없습니다. Claude 의 응답을 이 프로젝트에 맞게 조정하는 지침을 추가하세요.
          </div>
        )}
      </section>

      <section className="px-5 py-4">
        <div className="mb-1.5 flex items-center">
          <div className="font-serif text-[13px] font-semibold text-ink">파일</div>
          <span className="ml-auto rounded-full bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink3">
            준비 중
          </span>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-panel/40 px-4 py-6 text-center">
          <Icon name="doc" size={20} />
          <div className="mt-2 text-[11.5px] leading-[1.55] text-ink3">
            이 프로젝트에서 참조할 PDF, 문서 또는 기타 텍스트를 추가할 수 있게 될 예정입니다.
          </div>
        </div>
      </section>

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
