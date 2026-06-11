import { Icon } from '../../../../shared/ui/Icon'
import type { AgentEnvironment } from '../../../../../../shared/ipc'

import { modelKey, type ModelSelection } from './modelSelection'

const MENU_ITEM =
  'flex w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-sidebar'

interface ModelMenuProps {
  agents: AgentEnvironment[]
  sessionBackend: string | null
  selection: ModelSelection | null
  onPick: (selection: ModelSelection) => void
}

export function ModelMenu({
  agents,
  sessionBackend,
  selection,
  onPick
}: ModelMenuProps): React.JSX.Element {
  const visible = agents.filter(
    (agent) => agent.supported && (!sessionBackend || agent.adapter === sessionBackend)
  )
  if (visible.length === 0) {
    return (
      <div className="w-[260px] px-3 py-2 text-[12px] text-ink3">사용 가능한 모델이 없습니다.</div>
    )
  }
  return (
    <div role="none" className="flex max-h-[320px] w-[300px] flex-col overflow-auto p-1">
      {visible.map((agent) => {
        const models = agent.models.length > 0 ? agent.models : [{ name: 'SDK 기본 모델' }]
        return (
          <div key={agent.key} className="py-1">
            <div className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">
              {agent.key}
            </div>
            {models.map((model) => {
              const family = model.name === 'SDK 기본 모델' ? null : modelKey(model)
              const active =
                selection?.providerKey === agent.key && selection.modelFamily === family
              return (
                <button
                  key={`${agent.key}/${family ?? 'default'}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() =>
                    onPick({ providerKey: agent.key, modelFamily: family, adapter: agent.adapter })
                  }
                  className={MENU_ITEM}
                >
                  <Icon name="cpu" size={13} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      {family ?? 'SDK 기본 모델'}
                      {model.default && <span className="text-[10px] text-rust">default</span>}
                      {active && <Icon name="check" size={12} />}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-ink3">
                      {model.name}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
