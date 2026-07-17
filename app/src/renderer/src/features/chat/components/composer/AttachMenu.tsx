import { MenuItem } from '../../../../shared/ui/MenuItem'
import { useI18n } from '../../../../shared/i18n'

interface AttachMenuProps {
  onPickAttachment: () => void
  onPickSkill: () => void
}

export function AttachMenu({ onPickAttachment, onPickSkill }: AttachMenuProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div role="none" className="flex w-[180px] flex-col">
      <MenuItem role="menuitem" icon="plus" iconSize={13} onClick={onPickAttachment}>
        <span>{tr('chat.composer.attach')}</span>
      </MenuItem>
      <MenuItem role="menuitem" icon="bolt" iconSize={13} onClick={onPickSkill}>
        <span>Skill</span>
      </MenuItem>
    </div>
  )
}
