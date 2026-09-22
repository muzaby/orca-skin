import { useRef, useState } from 'react'
import type { ProviderAuthKind, ProviderInfo } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { MenuItem } from '../../../../shared/ui/MenuItem'
import { Popover } from '../../../../shared/ui/Popover'
import { providerAuthActionKind, providerAuthMenuItems } from './providerAuthActionModel'

export interface ProviderAuthActionsProps {
  provider: ProviderInfo
  authKind: ProviderAuthKind | null
  onLogin: (authKind?: ProviderAuthKind) => void
  onReauth: (authKind?: ProviderAuthKind) => void
  onRevoke: () => void
}

/**
 * Provider 상세 상단의 인증 액션.
 *
 * 미인증 provider는 검정 primary 인증 버튼 하나만 노출하고, 인증 정보가 있으면
 * 스킬 탭의 추가 버튼과 같은 primary dropdown으로 재인증/연결 해제를 묶는다.
 * 메뉴를 닫는 작업을 callback보다 먼저 수행해 인증 흐름이나 상태 방송으로 패널이
 * 교체되어도 열린 popover가 남지 않게 한다.
 */
export function ProviderAuthActions({
  provider,
  authKind,
  onLogin,
  onReauth,
  onRevoke
}: ProviderAuthActionsProps): React.JSX.Element {
  const { tr } = useI18n()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  if (providerAuthActionKind(provider) === 'authenticate') {
    return (
      <Button
        size="small"
        variant="primary"
        onClick={() => onLogin(authKind ?? undefined)}
        data-action="provider-authenticate"
      >
        {tr('skills.provider.authenticate')}
      </Button>
    )
  }

  const closeThen = (action: () => void): void => {
    setOpen(false)
    action()
  }

  return (
    <>
      <Button
        ref={anchorRef}
        size="small"
        variant="primary"
        dropdown
        expanded={open}
        onClick={() => setOpen((value) => !value)}
        aria-label={tr('skills.provider.reauth')}
        data-action="provider-reauth-menu"
      >
        {tr('skills.provider.reauth')}
      </Button>
      <Popover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        placement="bottom"
        align="end"
      >
        {providerAuthMenuItems.map((item) => (
          <MenuItem
            key={item.kind}
            danger={item.danger}
            icon={item.kind === 'reauth' ? 'refresh' : 'power'}
            onClick={() =>
              closeThen(item.kind === 'reauth' ? () => onReauth(authKind ?? undefined) : onRevoke)
            }
          >
            {tr(item.kind === 'reauth' ? 'skills.provider.reauth' : 'skills.provider.revoke')}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}
