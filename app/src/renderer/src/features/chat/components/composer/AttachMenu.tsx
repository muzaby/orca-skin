import { Icon } from '../../../../shared/ui/Icon'

const MENU_ITEM =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-ink hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'

interface AttachMenuProps {
  onPickSkill: () => void
}

export function AttachMenu({ onPickSkill }: AttachMenuProps): React.JSX.Element {
  return (
    <div role="none" className="flex w-[180px] flex-col">
      <button type="button" role="menuitem" disabled className={MENU_ITEM} title="준비 중">
        <Icon name="plus" size={13} />
        <span>첨부</span>
      </button>
      <button type="button" role="menuitem" onClick={onPickSkill} className={MENU_ITEM}>
        <Icon name="bolt" size={13} />
        <span>Skill</span>
      </button>
    </div>
  )
}
