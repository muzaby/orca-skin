import { isBackend } from '../../../../../shared/harness'
import {
  EngineCard as CommonEngineCard,
  type EngineCardProps
} from '../common/components/EngineCard'
import { engineHarnessConfiguration } from '../harnesses/configuration'

export function EngineCard(props: EngineCardProps): React.JSX.Element {
  const adapter = props.agent.adapter
  const adapterLabel = isBackend(adapter) ? engineHarnessConfiguration(adapter).cardLabel : adapter
  return <CommonEngineCard {...props} adapterLabel={adapterLabel} />
}
