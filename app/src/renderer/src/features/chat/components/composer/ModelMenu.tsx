import { Icon } from '../../../../shared/ui/Icon'
import type { AgentEnvironment } from '../../../../../../shared/ipc'

import { modelKey, type ModelSelection } from './modelSelection'
import { MenuItem, MenuTitle } from '../../../../shared/ui/MenuItem'
import { useI18n } from '../../../../shared/i18n'

interface ModelMenuProps {
  agents: AgentEnvironment[]
  sessionBackend: string | null
  selection: ModelSelection | null
  onPick: (selection: ModelSelection) => void
}

// harness-provider 키(`<harnessId>-<modelProviderId>`)로만 묶고, 그 아래는 모델 한 줄씩.
// 패밀리(alias)를 따로 세우지 않는다 — 행 라벨 `modelKey` 는 실행 경로가 SDK 에 넘기는
// 식별자와 같은 값(model ?? alias)이라 목록이 곧 실제 선택지가 된다.
// 활자는 모드 팝오버와 같은 계단을 쓴다(MenuTitle 11px / 라벨 13px / 보조 11.5px).
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
    <div role="none" className="flex max-h-[320px] w-[300px] flex-col overflow-auto">
      <MenuTitle>{tr('chat.composer.modelMenuTitle')}</MenuTitle>
      {visible.map((agent) => (
        <div key={agent.key} className="pt-1">
          <div className="px-2.5 pb-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink3">
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
                onClick={() =>
                  onPick({ providerKey: agent.key, modelFamily: modelId, adapter: agent.adapter })
                }
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {modelId}
                </span>
                {model.oneMillionContext && (
                  <span className="shrink-0 text-[11.5px] text-ink3">1M</span>
                )}
                {model.isDefault && (
                  <span className="shrink-0 text-[11.5px] text-rust">default</span>
                )}
                {active && <Icon name="check" size={12} className="shrink-0" />}
              </MenuItem>
            )
          })}
        </div>
      ))}
    </div>
  )
}
