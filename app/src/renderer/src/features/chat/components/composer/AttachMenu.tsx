import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'

const MENU_ITEM =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-ink hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'

interface AttachMenuProps {
  onPickAttachment: () => void
  onPickSkill: () => void
}

export function AttachMenu({ onPickAttachment, onPickSkill }: AttachMenuProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div role="none" className="flex w-[180px] flex-col">
      <button type="button" role="menuitem" onClick={onPickAttachment} className={MENU_ITEM}>
        <Icon name="plus" size={13} />
        <span>{tr('chat.composer.attach')}</span>
      </button>
      <button type="button" role="menuitem" onClick={onPickSkill} className={MENU_ITEM}>
        <Icon name="bolt" size={13} />
        <span>Skill</span>
      </button>
    </div>
  )
}
