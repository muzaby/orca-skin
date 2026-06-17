import type { AgentEnvironment } from '../../../../../shared/ipc'
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
  const canMutate = agent.adapter === 'claude'
  return (
    <div className="rounded-xl border border-border bg-panel px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-ink">{agent.adapter}</span>
            <span className="text-[11px] text-ink3">{agent.provider ?? 'default'}</span>
            {!agent.supported && (
              <span className="rounded-sm bg-cream-50 px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] text-ink3">
                미지원 adapter
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-ink3">{agent.key}</div>
        </div>
        <button
          type="button"
          disabled={!canMutate || busy}
          onClick={() => onEdit(agent)}
          className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-border-strong hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-40"
        >
          편집
        </button>
        <button
          type="button"
          disabled={!canMutate || busy}
          onClick={() => onDelete(agent)}
          className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-rust hover:bg-rust-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          삭제
        </button>
      </div>
      <EngineModelList models={agent.models} />
    </div>
  )
}
