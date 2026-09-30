import { useNavigate } from 'react-router-dom'
import { MailArchiveSourceManager } from '../features/mail-archive'
import { useSettingsModalStore } from '../features/settings'

export function MailArchiveSettingsContent(): React.JSX.Element {
  const navigate = useNavigate()
  const hide = useSettingsModalStore((state) => state.hide)
  return (
    <MailArchiveSourceManager
      onOpenArchive={() => {
        hide()
        navigate('/mail-archive')
      }}
    />
  )
}
