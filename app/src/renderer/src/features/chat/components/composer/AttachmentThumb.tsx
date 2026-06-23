import { Icon } from '../../../../shared/ui/Icon'

interface AttachmentThumbProps {
  name: string
  isImage: boolean
  previewUrl?: string
  // 주어지면 제거 x 버튼 노출(컴포저). 없으면 read-only(트랜스크립트 버블).
  onRemove?: () => void
}

// 파일명에서 확장자 라벨 파생 — 'spec.md' → 'MD', 확장자 없으면 'FILE'.
function extLabel(name: string): string {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : ''
  return ext ? ext.toUpperCase() : 'FILE'
}

// 첨부 썸네일 한 칸 — 이미지는 다운스케일 미리보기만, 비-이미지는 확장자만. 파일명은 hover 툴팁.
export function AttachmentThumb({
  name,
  isImage,
  previewUrl,
  onRemove
}: AttachmentThumbProps): React.JSX.Element {
  return (
    <div
      title={name}
      className="group/attachment relative h-14 w-14 shrink-0 overflow-hidden rounded-r4 border border-border bg-sidebar"
    >
      {isImage && previewUrl ? (
        <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] font-semibold tracking-wide text-ink2">
          {extLabel(name)}
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-panel text-ink3 opacity-0 shadow-sm transition group-hover/attachment:opacity-100 hover:text-ink"
          aria-label={`${name} 첨부 제거`}
        >
          <Icon name="x" size={10} />
        </button>
      )}
    </div>
  )
}
