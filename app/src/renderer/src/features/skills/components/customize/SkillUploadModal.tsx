import { useRef, useState } from 'react'
import { Modal } from '../../../../shared/ui/Modal'
import { Icon } from '../../../../shared/ui/Icon'
import type { SkillItem } from './data'

// "스킬 업로드" — 폴더/파일 추가 플로우(첨부 3). 드래그앤드롭 또는 클릭으로 파일을 받는다.
// 정적 스킨이므로 실제 파싱/폴더 읽기(IPC) 없이 파일명만 취득해 stub 스킬을 append 한다.
export function SkillUploadModal({
  open,
  onClose,
  onUpload
}: {
  open: boolean
  onClose: () => void
  onUpload: (skill: SkillItem) => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const accept = (fileName: string): void => {
    const base = fileName
      .replace(/\.(md|zip|skill)$/i, '')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .toLowerCase()
    const name = base || 'uploaded-skill'
    onUpload({
      id: `${name}-${Date.now()}`,
      name,
      desc: `${fileName} 에서 업로드됨`,
      enabled: true,
      addedBy: '로컬 (업로드)',
      updatedAt: '방금',
      trigger: '슬래시 명령어',
      version: '0.1.0',
      triggers: name,
      body: `업로드된 스킬 패키지: ${fileName}\n\n(스킨 데모 — 실제 SKILL.md 파싱은 후속 실연동에서 처리됩니다.)`
    })
    onClose()
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) accept(f.name)
  }

  return (
    <Modal open={open} title="스킬 업로드" onClose={onClose} width={620}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`grid w-full cursor-pointer place-items-center gap-2.5 rounded-r5 border border-dashed px-4 py-10 text-center transition-colors ${
          dragging ? 'border-rust bg-rust-soft/40' : 'border-border-strong bg-bg hover:bg-cream-50'
        }`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-r4 border border-border bg-panel text-ink3">
          <Icon name="upload" size={16} />
        </span>
        <span className="text-[13px] text-ink2">드래그 앤 드롭하거나 클릭하여 업로드</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.zip,.skill"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) accept(f.name)
          e.target.value = ''
        }}
      />

      <div className="mt-4">
        <div className="mb-1.5 text-[12px] font-medium text-ink2">파일 요구사항</div>
        <ul className="list-disc space-y-1 pl-4 text-[12px] text-ink3">
          <li>.md 파일에는 YAML 형식의 스킬 이름과 설명이 포함되어야 합니다</li>
          <li>.zip 또는 .skill 파일에는 SKILL.md 파일이 포함되어야 합니다</li>
        </ul>
        <button
          type="button"
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-rust underline-offset-2 hover:underline"
        >
          스킬 생성에 대해 자세히 알아보기 또는 예시 보기
        </button>
      </div>
    </Modal>
  )
}
