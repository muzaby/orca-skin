import { useChatSession } from '../features/chat'
import { useOpenSettings } from '../features/settings'
import { MailArchivePluginCard } from '../features/mail-archive/MailArchivePluginCard'

export function MailArchivePluginSlot(): React.JSX.Element {
  const sessionId = useChatSession((state) => state.sessionId)
  const openSettings = useOpenSettings()
  return (
    <MailArchivePluginCard
      currentSessionId={sessionId}
      onManageSources={() => openSettings('mail-archive')}
    />
  )
}
