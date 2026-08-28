import { Button } from '../../../shared/ui/Button'
import { Icon, type IconName } from '../../../shared/ui/Icon'
import { useI18n } from '../../../shared/i18n'
import { COMPOSER_PANEL_ICON_SIZE, composerPanelSurface } from './composer/composerPanel'

interface NoticeProps {
  title?: string
  children?: React.ReactNode
  icon?: IconName
  onClose?: () => void
}

// 컴포저 패널스택의 범용 안내 메시지 패널. 내용은 props 로 주입한다 — 어떤 소스(동시 턴 가드 ·
// 향후 중앙서버 푸시 등)든 같은 패널 크롬으로 렌더한다. onClose 가 있으면 우측 × 닫기 노출.
//
// 표면은 `composerPanel.ts` 가 소유한다(0206 D-021) — git 행과 **같은 스택에 나란히 서므로**
// 배경·반경·여백이 갈리면 두 패널이 다른 시스템으로 읽힌다.
export function Notice({
  title,
  children,
  icon = 'alert',
  onClose
}: NoticeProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className={`flex items-start gap-g4 leading-relaxed text-ink ${composerPanelSurface}`}>
      <Icon name={icon} size={COMPOSER_PANEL_ICON_SIZE} className="mt-p1 shrink-0" />
      <div className="min-w-0">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className="text-ink2">{children}</div>}
      </div>
      {onClose && (
        <Button
          iconOnly
          leadingIcon="x"
          size="small"
          onClick={onClose}
          aria-label={tr('common.close')}
          className="ml-auto -mt-1 shrink-0 text-ink3"
        />
      )}
    </div>
  )
}
