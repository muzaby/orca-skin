import { AgentEnvironmentView as CommonAgentEnvironmentView } from '../common/components/AgentEnvironmentView'
import { EngineCard } from './EngineCard'
import { EngineFormModal } from './EngineFormModal'

export function AgentEnvironmentView(): React.JSX.Element {
  return <CommonAgentEnvironmentView Card={EngineCard} Form={EngineFormModal} />
}
