import { SCREENS, type ScreenId } from './screens'

export interface ScreenTabsProps {
  screen: ScreenId
  onSelect: (s: ScreenId) => void
}

export function ScreenTabs({ screen, onSelect }: ScreenTabsProps): React.JSX.Element {
  return (
    <div className="screen-tabs">
      {SCREENS.map((s) => (
        <button
          key={s.id}
          className={s.id === screen ? 'active' : ''}
          onClick={() => onSelect(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
