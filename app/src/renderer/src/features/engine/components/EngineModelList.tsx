import type { AgentModelView } from '../../../../../shared/ipc'

interface EngineModelListProps {
  models: AgentModelView[]
}

export function EngineModelList({ models }: EngineModelListProps): React.JSX.Element {
  const visible = models.length > 0 ? models : [{ name: 'SDK 기본 모델' }]
  return (
    <div className="relative mt-3 flex flex-col gap-1.5">
      {visible.map((model) => {
        const family = model.family ?? (model.name === 'SDK 기본 모델' ? 'fallback' : 'model')
        return (
          <div
            key={`${family}/${model.name}`}
            className="flex items-center gap-2 rounded-lg bg-cream-50/70 px-2.5 py-2"
          >
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink3 ring-1 ring-border">
              {family}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold text-ink">
              {model.name}
            </span>
            {model.default && (
              <span className="rounded bg-rust-soft px-1.5 py-0.5 text-[10px] font-semibold text-rust">
                ✓ default
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
