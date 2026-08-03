import type { RefObject } from 'react'
import { Popover } from '../../../../shared/ui/Popover'
import { Icon, type IconName } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'

function MenuRow({
  icon,
  label,
  onClick
}: {
  icon: IconName
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-g5 rounded-r4 border-0 bg-transparent px-p5 py-p3 text-left text-footnote text-ink hover:bg-fill-uncontained-hover"
    >
      <Icon name={icon} size={14} color="var(--color-ink2)" />
      <span className="flex-1">{label}</span>
    </button>
  )
}

export function SkillAddMenu({
  open,
  anchorRef,
  onClose,
  onAuthor,
  onUpload
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onAuthor: () => void
  onUpload: () => void
}): React.JSX.Element | null {
  const { tr } = useI18n()
  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} placement="bottom">
      <div role="menu" className="min-w-[220px] p-1">
        <MenuRow
          icon="doc"
          label={tr('skills.addMenu.author')}
          onClick={() => {
            onClose()
            onAuthor()
          }}
        />
        <MenuRow
          icon="upload"
          label={tr('skills.addMenu.upload')}
          onClick={() => {
            onClose()
            onUpload()
          }}
        />
      </div>
    </Popover>
  )
}
