import { useI18n } from '../../../../shared/i18n'
import { chipSurface } from './chipSurface'

interface WorktreeToggleProps {
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}

export function WorktreeToggle({
  checked,
  disabled,
  onChange
}: WorktreeToggleProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <label
      className={`${chipSurface('segment')} cursor-default has-disabled:cursor-not-allowed has-disabled:opacity-50`}
      title={tr('chat.composer.worktreeIsolationHelp')}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="m-0 size-3.5 shrink-0 accent-selected"
      />
      <span className="min-w-0 truncate">{tr('chat.composer.worktreeIsolation')}</span>
    </label>
  )
}
