import type { AgentEnvironment } from '../../../../../shared/ipc'
import { Button } from '../../../shared/ui/Button'
import { useI18n } from '../../../shared/i18n'
import { EngineModelList } from './EngineModelList'

interface EngineCardProps {
  agent: AgentEnvironment
  busy?: boolean
  onEdit: (agent: AgentEnvironment) => void
  onDelete: (agent: AgentEnvironment) => void
}

export function EngineCard({
  agent,
  busy = false,
  onEdit,
  onDelete
}: EngineCardProps): React.JSX.Element {
  const { tr } = useI18n()
  const canMutate = agent.adapter === 'claude' && agent.readOnly !== true
  return (
    <div className="rounded-xl border border-border bg-panel px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-ink">{agent.adapter}</span>
            <span className="text-[11px] text-ink3">{agent.provider ?? 'default'}</span>
            {!agent.supported && (
              <span className="rounded-sm bg-bg2 px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] text-ink3">
                {tr('engine.card.unsupportedAdapter')}
              </span>
            )}
            {agent.readOnly && (
              <span className="rounded-sm bg-bg2 px-1.5 py-px text-[10px] font-semibold text-ink3 ring-1 ring-border">
                {tr('engine.card.readOnly')}
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-ink3">{agent.key}</div>
        </div>
        {canMutate && (
          <Button
            variant="contained"
            size="small"
            disabled={!canMutate || busy}
            onClick={() => onEdit(agent)}
          >
            {tr('common.edit')}
          </Button>
        )}
        {canMutate && (
          <Button
            variant="danger-ghost"
            size="small"
            disabled={!canMutate || busy}
            onClick={() => onDelete(agent)}
          >
            {tr('common.delete')}
          </Button>
        )}
      </div>
      <EngineModelList models={agent.models} />
    </div>
  )
}
