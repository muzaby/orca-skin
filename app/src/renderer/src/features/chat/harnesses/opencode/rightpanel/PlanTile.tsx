import { PlanTileContent } from '../../common/rightpanel/PlanTileContent'
import { planEmptyDescriptionKey, planSelectHintKey } from '../rightPanel'

export function PlanContent(): React.JSX.Element {
  return (
    <PlanTileContent
      emptyDescriptionKey={planEmptyDescriptionKey}
      selectHintKey={planSelectHintKey}
    />
  )
}
