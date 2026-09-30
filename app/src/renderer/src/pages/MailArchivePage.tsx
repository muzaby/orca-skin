import { MailArchiveView } from '../features/mail-archive'
import { useOpenSettings } from '../features/settings'

export function MailArchivePage(): React.JSX.Element {
  const openSettings = useOpenSettings()
  return <MailArchiveView onManageSources={() => openSettings('mail-archive')} />
}
