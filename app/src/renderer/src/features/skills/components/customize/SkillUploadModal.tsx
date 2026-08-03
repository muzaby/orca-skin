import { useRef, useState } from 'react'
import { Modal } from '../../../../shared/ui/Modal'
import { Icon } from '../../../../shared/ui/Icon'
import type { UploadSkillRequest } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'

export function SkillUploadModal({
  open,
  onClose,
  onUpload
}: {
  open: boolean
  onClose: () => void
  onUpload: (req: UploadSkillRequest) => Promise<void>
}): React.JSX.Element {
  const { tr } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accept = async (file: File): Promise<void> => {
    try {
      setError(null)
      await onUpload({ fileName: file.name, content: await file.text() })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('skills.upload.failed'))
    }
  }
  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void accept(f)
  }
  return (
    <Modal open={open} title={tr('skills.upload.title')} onClose={onClose} width={620}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`grid w-full cursor-pointer place-items-center gap-2.5 rounded-r5 border border-dashed px-4 py-10 text-center transition-colors ${dragging ? 'border-rust bg-rust-soft/40' : 'border-border-strong bg-bg hover:bg-bg2'}`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-r4 border border-border bg-panel text-ink3">
          <Icon name="upload" size={16} />
        </span>
        <span className="text-body text-ink2">{tr('skills.upload.dropHint')}</span>
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
      {error && <div className="mt-g4 text-footnote text-bad">{error}</div>}
      <div className="mt-4">
        <div className="mb-g3 text-footnote font-medium text-ink2">
          {tr('skills.upload.requirements')}
        </div>
        <ul className="list-disc space-y-1 pl-p7 text-footnote text-ink3">
          <li>{tr('skills.upload.reqLine1')}</li>
          <li>{tr('skills.upload.reqLine2')}</li>
        </ul>
      </div>
    </Modal>
  )
}
