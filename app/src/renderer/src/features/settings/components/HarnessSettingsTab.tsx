import type { Backend } from '../../../../../shared/ipc'
import { HarnessSettingsTab as CommonHarnessSettingsTab } from '../common/components/HarnessSettingsTab'
import { harnessSettingsConfiguration } from '../harnesses/registry'

export function HarnessSettingsTab({ backend }: { backend: Backend }): React.JSX.Element {
  return (
    <CommonHarnessSettingsTab
      backend={backend}
      configuration={harnessSettingsConfiguration(backend)}
    />
  )
}
