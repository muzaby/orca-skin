import { useEffect, useRef, useState } from 'react'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, instructions: string) => Promise<void> | void
}

// 새 프로젝트 생성 모달 — name 필수 (1-120자), instructions 선택 (0-8000자).
// AuthExpiredModal 의 dialog 마크업 패턴을 따른다 (bg-black/40 backdrop, panel card).
// `!open` 시 컴포넌트가 unmount 되므로 재오픈 시 useState 초기값이 자동 reset 됨.
export function CreateProjectModal(props: CreateProjectModalProps): React.JSX.Element | null {
  if (!props.open) return null
  return <CreateProjectModalOpen onClose={props.onClose} onCreate={props.onCreate} />
}

function CreateProjectModalOpen({
  onClose,
  onCreate
}: Omit<CreateProjectModalProps, 'open'>): React.JSX.Element {
  const [name, setName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    queueMicrotask(() => nameRef.current?.focus())
  }, [])

  const canSave = name.trim().length >= 1 && !busy

  const save = async (): Promise<void> => {
    if (!canSave) return
    setBusy(true)
    try {
      await onCreate(name.trim(), instructions)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={onClose}>
      <div
        className="w-[520px] max-w-[92vw] rounded-xl border border-border bg-panel p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 font-serif text-[16px] font-semibold text-ink">새 프로젝트</div>

        <label className="mb-3 block">
          <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-ink3">
            이름
          </div>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && canSave) {
                e.preventDefault()
                void save()
              }
            }}
            maxLength={120}
            placeholder="예: cam-validation-v3"
            className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-border-strong"
          />
        </label>

        <label className="mb-4 block">
          <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-ink3">
            지침 (선택)
          </div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={8000}
            rows={6}
            placeholder="Claude 의 응답을 이 프로젝트에 맞게 조정하는 지침. 예: 모든 응답을 한국어로, 코드 예시는 TypeScript 로."
            className="w-full resize-none rounded-md border border-border bg-bg px-2.5 py-1.5 text-[12.5px] leading-[1.6] text-ink outline-none focus:border-border-strong"
          />
          <div className="mt-1 text-right text-[10.5px] text-ink3">
            {instructions.length} / 8000
          </div>
        </label>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="cursor-pointer rounded-md border border-border bg-panel px-3 py-1.5 text-[12.5px] text-ink2"
          >
            취소
          </button>
          <button
            onClick={() => void save()}
            disabled={!canSave}
            className="cursor-pointer rounded-md border-0 bg-ink px-3 py-1.5 text-[12.5px] text-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            만들기
          </button>
        </div>
      </div>
    </div>
  )
}
