import type { AgentModelView } from '../../../../../shared/ipc'
import { useI18n } from '../../../shared/i18n'

interface EngineModelListProps {
  models: AgentModelView[]
}

export function EngineModelList({ models }: EngineModelListProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="relative mt-3 flex flex-col gap-1.5">
      {models.map((model) => (
        <div
          key={model.model ?? model.alias}
          className="flex items-center gap-2 rounded-lg bg-bg2 px-2.5 py-2"
        >
          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink3 ring-1 ring-border">
            {model.alias}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold text-ink">
            {model.model ?? tr('engine.sdkDefaultModel')}
          </span>
          {model.oneMillionContext && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-ink3 ring-1 ring-border">
              1M
            </span>
          )}
          {model.isDefault && (
            <span className="rounded bg-t3 px-1.5 py-0.5 text-[10px] font-semibold text-t8">
              ✓ default
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
