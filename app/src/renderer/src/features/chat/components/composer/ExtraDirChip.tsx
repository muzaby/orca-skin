import { basenameForDisplay } from '../../../../../../shared/path-basename'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { chipSurface } from './chipSurface'

interface ExtraDirChipProps {
  path: string
  disabled?: boolean
  onRemove: () => void
}

// 추가된 참조 경로 칩(CLI `/add-dir` 대응). 툴팁은 **절대 경로 원문** 이다 — 라벨은 basename
// 이라 같은 이름의 폴더가 여럿이면 툴팁만이 구분 수단이다.
export function ExtraDirChip({
  path,
  disabled = false,
  onRemove
}: ExtraDirChipProps): React.JSX.Element {
  const { tr } = useI18n()
  const name = basenameForDisplay(path)

  return (
    <span
      title={path}
      data-surface="extra-dir"
      className={`${chipSurface('outlined')} max-w-[14rem]`}
    >
      <Icon name="folder" size={12} className="shrink-0" />
      <span className="min-w-0 truncate">{name}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={tr('chat.composer.extraDirRemoveAria', { name })}
        className="-mr-0.5 grid h-4 w-4 shrink-0 cursor-default place-items-center rounded-full text-t5 outline-none hide-focus-ring ring-focus transition-colors hover:bg-fill-uncontained-hover hover:text-t7 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="x" size={10} />
      </button>
    </span>
  )
}
