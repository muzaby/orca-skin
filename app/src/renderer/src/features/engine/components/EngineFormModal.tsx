import {
  EngineFormModal as CommonEngineFormModal,
  type EngineFormModalProps
} from '../common/components/EngineFormModal'
import { OpenCodeProviderForm } from '../harnesses/opencode/ProviderForm'
import { engineFormPolicy } from '../harnesses/configuration'

export function EngineFormModal(props: EngineFormModalProps): React.JSX.Element {
  if (props.mode === 'add' && props.engine === 'opencode')
    return <OpenCodeProviderForm {...props} />
  return <CommonEngineFormModal {...props} {...engineFormPolicy} />
}
