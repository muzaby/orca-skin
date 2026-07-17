import { useState, type RefObject } from 'react'
import { Popover } from '../../../../shared/ui/Popover'
import { Icon, type IconName } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'

function MenuRow({
  icon,
  label,
  trailing,
  onClick
}: {
  icon: IconName
  label: string
  trailing?: IconName
  onClick?: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-r4 border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] text-ink hover:bg-fill-uncontained-hover"
    >
      <Icon name={icon} size={14} color="var(--color-ink2)" />
      <span className="flex-1">{label}</span>
      {trailing && <Icon name={trailing} size={13} color="var(--color-ink3)" />}
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
  const [subOpen, setSubOpen] = useState(false)
  const { tr } = useI18n()
  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} placement="bottom">
      <div
        className="relative"
        onMouseEnter={() => setSubOpen(true)}
        onMouseLeave={() => setSubOpen(false)}
      >
        <MenuRow icon="plus" label={tr('skills.addMenu.create')} trailing="chevR" />
        {subOpen && (
          <div
            role="menu"
            className="absolute left-full top-0 z-10 ml-1 min-w-[220px] rounded-lg border border-border bg-panel p-1 shadow-lg"
          >
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
        )}
      </div>
    </Popover>
  )
}
