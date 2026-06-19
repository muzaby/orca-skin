import { useRef, useState } from 'react'
import { Modal } from '../../../../shared/ui/Modal'
import { Icon } from '../../../../shared/ui/Icon'
import type { UploadSkillRequest } from '../../../../../../shared/ipc'

export function SkillUploadModal({
  open,
  onClose,
  onUpload
}: {
  open: boolean
  onClose: () => void
  onUpload: (req: UploadSkillRequest) => Promise<void>
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accept = async (file: File): Promise<void> => {
    try {
      setError(null)
      await onUpload({ fileName: file.name, content: await file.text() })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '스킬 업로드에 실패했습니다.')
    }
  }
  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void accept(f)
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
        className={`grid w-full cursor-pointer place-items-center gap-2.5 rounded-r5 border border-dashed px-4 py-10 text-center transition-colors ${dragging ? 'border-rust bg-rust-soft/40' : 'border-border-strong bg-bg hover:bg-cream-50'}`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-r4 border border-border bg-panel text-ink3">
          <Icon name="upload" size={16} />
        </span>
        <span className="text-[13px] text-ink2">드래그 앤 드롭하거나 클릭하여 업로드</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.skill"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void accept(f)
          e.target.value = ''
        }}
      />
      {error && <div className="mt-2 text-[12px] text-rust">{error}</div>}
      <div className="mt-4">
        <div className="mb-1.5 text-[12px] font-medium text-ink2">파일 요구사항</div>
        <ul className="list-disc space-y-1 pl-4 text-[12px] text-ink3">
          <li>.md 또는 .skill 파일에 YAML frontmatter와 스킬 지침을 포함합니다</li>
          <li>업로드한 파일은 Orca 스킬 sources에 SKILL.md로 저장됩니다</li>
        </ul>
      </div>
    </Modal>
  )
}
