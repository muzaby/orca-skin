import { useI18n } from '../../../../../shared/i18n'
import { Button } from '../../../../../shared/ui/Button'
import { useRightPanelNav } from './panelNavigation'

export function PanelBackButton(): React.JSX.Element | null {
  const nav = useRightPanelNav()
  const { tr } = useI18n()
  if (!nav?.canGoBack) return null
  return (
    <Button
      iconOnly
      size="small"
      leadingIcon="arrowL"
      data-panel-back=""
      aria-label={tr('header.back')}
      onClick={nav.back}
    />
  )
}
