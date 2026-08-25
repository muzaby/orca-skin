import { Icon } from '../../../../shared/ui/Icon'
import type { AgentEnvironment } from '../../../../../../shared/ipc'

import { modelKey, type ModelSelection } from './modelSelection'
import { MenuItem } from '../../../../shared/ui/MenuItem'
import { useI18n } from '../../../../shared/i18n'

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
  const { tr } = useI18n()
  const visible = agents.filter(
    (agent) => agent.supported && (!sessionBackend || agent.adapter === sessionBackend)
  )
  if (visible.length === 0) {
    return (
      <div className="w-[260px] px-3 py-2 text-[12px] text-ink3">
        {tr('chat.composer.noModels')}
      </div>
    )
  }
  return (
    <div role="none" className="flex max-h-[320px] w-[300px] flex-col overflow-auto p-1">
      {visible.map((agent) => (
        <div key={agent.key} className="py-1">
          <div className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink3">
            {agent.key}
          </div>
          {agent.models.map((model) => {
            const modelId = modelKey(model)
            const active = selection?.providerKey === agent.key && selection.modelFamily === modelId
            return (
              <MenuItem
                key={`${agent.key}/${modelId}`}
                role="menuitemradio"
                aria-checked={active}
                icon="cpu"
                iconSize={13}
                align="start"
                onClick={() =>
                  onPick({ providerKey: agent.key, modelFamily: modelId, adapter: agent.adapter })
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    {model.alias}
                    {model.oneMillionContext && <span className="text-[10px] text-ink3">1M</span>}
                    {model.isDefault && <span className="text-[10px] text-rust">default</span>}
                    {active && <Icon name="check" size={12} />}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-ink3">
                    {model.model ?? tr('chat.composer.sdkDefaultModel')}
                  </span>
                </span>
              </MenuItem>
            )
          })}
        </div>
      ))}
    </div>
  )
}
