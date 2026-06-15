import type { AgentEnvironment } from '../../../../../shared/ipc'
import { Icon } from '../../../shared/ui/Icon'
import { EngineModelList } from './EngineModelList'

const AGENT_ENV_BG =
  'https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/cd02a42d9-Vq_H3mgS.svg'

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
  const canMutate = agent.adapter === 'claude-code'
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-panel px-4 py-3.5">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-36 w-36 translate-x-1/2 bg-contain bg-center bg-no-repeat opacity-[0.06]"
        style={{ backgroundImage: `url(${AGENT_ENV_BG})` }}
      />
      <div className="relative flex items-center gap-3">
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
          className="grid h-7 w-7 place-items-center rounded-md border-0 bg-transparent text-ink2 hover:bg-sidebar hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="엔진 설정 편집"
        >
          <Icon name="settings" size={13} />
        </button>
        <button
          type="button"
          disabled={!canMutate || busy}
          onClick={() => onDelete(agent)}
          className="grid h-7 w-7 place-items-center rounded-md border-0 bg-transparent text-ink2 hover:bg-rust-soft hover:text-rust disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="엔진 삭제"
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
      <EngineModelList models={agent.models} />
    </div>
  )
}
