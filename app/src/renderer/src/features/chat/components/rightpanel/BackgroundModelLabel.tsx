import { useI18n } from '../../../../shared/i18n'
import { modelDisplayLabel } from '../../lib/parts'
import { useSubagentMeta } from '../../store/chatStore'

export function BackgroundModelLabel({
  toolUseId,
  model,
  persistedModel
}: {
  toolUseId?: string
  model?: string
  persistedModel?: string
}): React.JSX.Element {
  const live = useSubagentMeta(toolUseId ?? '')
  const { tr } = useI18n()
  const observed = model || live?.model || persistedModel
  return <>{observed ? modelDisplayLabel(observed) : tr('common.unknown')}</>
}
