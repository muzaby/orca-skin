import { useNavigate } from 'react-router-dom'
import { useOpenSettings } from '../features/settings/store/settingsModalStore'
import { errorApi } from '../shared/api/ipc'
import { ErrorToastHost } from '../shared/ui/ErrorToastHost'
import { openErrorTarget } from './errorToastTarget'

export function ErrorToastLayer(): React.JSX.Element {
  const navigate = useNavigate()
  const openSettings = useOpenSettings()
  return (
    <ErrorToastHost
      onOpen={(target) => {
        void openErrorTarget(target, { navigate, openSettings, revealLog: errorApi.revealLog })
      }}
    />
  )
}
