import { Home as V5Home } from './Home'
import { AccountMenu } from '../../components/account/AccountMenu'

export interface AccountMenuScreenProps {
  withLang?: boolean
}

/** v5 AccountMenu overlay screen (DESIGN.md §5 #17-18).
 *  Renders Home behind an absolutely-positioned drop-up over the sidebar
 *  account row. `withLang` opens the LanguageSubmenu fly-out from inside
 *  the AccountMenu container (anchored via `left: calc(100% + 8px)`). */
export function AccountMenuScreen({ withLang = false }: AccountMenuScreenProps): React.JSX.Element {
  return (
    <>
      <V5Home />
      <div
        style={{
          position: 'fixed',
          left: 0,
          bottom: 0,
          width: 'var(--sidebar-w)',
          height: 'calc(100vh - var(--titlebar-h))',
          pointerEvents: 'none'
        }}
      >
        <AccountMenu langOpen={withLang} />
      </div>
    </>
  )
}
