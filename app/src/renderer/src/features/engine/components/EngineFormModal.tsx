import {
  EngineFormModal as CommonEngineFormModal,
  type EngineFormModalProps
} from '../common/components/EngineFormModal'
import { engineFormPolicy } from '../harnesses/configuration'

export function EngineFormModal(props: EngineFormModalProps): React.JSX.Element {
  return <CommonEngineFormModal {...props} {...engineFormPolicy} />
}
