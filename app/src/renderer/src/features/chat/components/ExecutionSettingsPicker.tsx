// 제어형 실행 설정 입력 — 모델·작업 종류·노력·권한을 한 값(`PromptExecution`)으로 고른다.
// 예약 작업 모달이 pages 슬롯으로 쓴다. 컴포저와 달리 세션 상태를 읽지 않는다 — 고른 값은
// 호출자가 갖고, 선택 규칙은 `lib/executionSettings.ts` 가 갖는다. 펼치는 메뉴는 컴포저의
// 것(`ModelMenu`·`ModeMenu`·`EffortMenu`)을 그대로 쓴다.

import { useEffect } from 'react'
import type { AgentKind } from '../../../../../shared/agent-kind'
import { HARNESS_CAPABILITIES } from '../../../../../shared/harness'
import { defaultEffortForModel } from '../../../../../shared/harnesses/claude/model-effort'
import type { PromptExecution } from '../../../../../shared/scheduled-tasks'
import { useAgents } from '../../../shared/hooks/useAgents'
import { useI18n } from '../../../shared/i18n'
import { HarnessLogo } from '../../../shared/ui/HarnessLogo'
import { Icon, type IconName } from '../../../shared/ui/Icon'
import { MENU_CHIP_GROUP, MenuChip } from '../../../shared/ui/MenuChip'
import { MenuItem, MenuTitle } from '../../../shared/ui/MenuItem'
import { EFFORT_LABEL_KEYS } from '../harnesses/claude/composer/effort'
import { EffortMenu } from '../harnesses/claude/composer/EffortMenu'
import { ModeMenu } from '../harnesses/claude/composer/ModeMenu'
import { modeMenuOptions, permissionModeLabelKey } from '../harnesses/claude/composer/modes'
import { agentPresentation } from '../lib/agentPresentation'
import {
  executionAgentKinds,
  executionForKind,
  executionForModel,
  executionModelOptions,
  executionOptionValue,
  withExecutionEffort
} from '../lib/executionSettings'
import { ModelMenu } from './composer/ModelMenu'
import { selectedModelShape, type ModelSelection } from './composer/modelSelection'

// 작업 종류 아이콘 — 코드는 nav 세션과 같은 글리프를 쓴다.
function agentKindIcon(kind: AgentKind): IconName {
  return kind === 'code' ? agentPresentation.code.navIcon : agentPresentation[kind].icon
}

interface ExecutionSettingsPickerProps {
  value: PromptExecution | null
  onChange: (value: PromptExecution | null) => void
}

export function ExecutionSettingsPicker({
  value,
  onChange
}: ExecutionSettingsPickerProps): React.JSX.Element {
  const { tr } = useI18n()
  const agents = useAgents()
  const options = executionModelOptions(agents)
  const fallback = options.find((option) => option.isDefault) ?? options[0]
  // 값이 없으면 카탈로그의 기본 모델로 채운다(새 작업). 저장된 값은 건드리지 않는다.
  useEffect(() => {
    if (value == null && fallback) onChange(executionForModel(fallback, null))
  }, [value, fallback?.value]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = options.find((option) => option.value === executionOptionValue(value))
  const selection: ModelSelection | null = value
    ? {
        providerKey: value.providerKey,
        modelFamily: value.modelFamily,
        modelAlias: null,
        adapter: value.backend
      }
    : null
  const kinds = value ? executionAgentKinds(value) : []
  const effort = value?.effort ?? defaultEffortForModel(value?.modelFamily)

  return (
    <div data-execution-settings="" className={MENU_CHIP_GROUP}>
      <MenuChip
        segment
        title={tr('schedules.modal.model')}
        muted={value == null}
        leading={value && <HarnessLogo backend={value.backend} className="size-3.5 shrink-0" />}
        // 카탈로그에서 사라진 저장값도 원문으로 보인다 — 조용히 다른 모델로 바뀌지 않게.
        label={
          current?.label ??
          value?.modelFamily ??
          value?.providerKey ??
          tr('schedules.modal.modelPlaceholder')
        }
      >
        {(close) => (
          <ModelMenu
            agents={agents}
            sessionBackend={null}
            selection={selection}
            onPick={(picked) => {
              const option = options.find(
                (item) =>
                  item.execution.providerKey === picked.providerKey &&
                  item.execution.modelFamily === picked.modelFamily
              )
              if (option) onChange(executionForModel(option, value))
              close()
            }}
          />
        )}
      </MenuChip>
      {value && kinds.length > 1 && (
        <MenuChip
          segment
          title={tr('schedules.modal.agentKind')}
          icon={agentKindIcon(value.agentKind)}
          label={tr(agentPresentation[value.agentKind].label)}
        >
          {(close) => (
            <div role="none" className="flex w-[200px] flex-col">
              <MenuTitle>{tr('schedules.modal.agentKind')}</MenuTitle>
              {kinds.map((kind) => (
                <MenuItem
                  key={kind}
                  role="menuitemradio"
                  aria-checked={kind === value.agentKind}
                  icon={agentKindIcon(kind)}
                  onClick={() => {
                    onChange(executionForKind({ ...value, agentKind: kind }, value.permissionMode))
                    close()
                  }}
                >
                  <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">
                    {tr(agentPresentation[kind].label)}
                  </span>
                  {kind === value.agentKind && <Icon name="check" size={12} />}
                </MenuItem>
              ))}
            </div>
          )}
        </MenuChip>
      )}
      {value?.backend === 'claude' && (
        <MenuChip
          segment
          title={tr('schedules.modal.effort')}
          label={tr(EFFORT_LABEL_KEYS[effort])}
        >
          {(close) => (
            <EffortMenu
              effort={effort}
              defaultEffort={defaultEffortForModel(value.modelFamily)}
              onPick={(next) => {
                onChange(withExecutionEffort(value, next))
                close()
              }}
            />
          )}
        </MenuChip>
      )}
      {value && HARNESS_CAPABILITIES[value.backend].permissionModes && (
        <MenuChip
          segment
          align="end"
          title={tr('schedules.modal.permission')}
          label={tr(permissionModeLabelKey(value.permissionMode, value.agentKind))}
        >
          {(close) => (
            <ModeMenu
              mode={value.permissionMode}
              options={modeMenuOptions(selectedModelShape(agents, selection), value.agentKind)}
              onPick={(permissionMode) => {
                onChange({ ...value, permissionMode })
                close()
              }}
            />
          )}
        </MenuChip>
      )}
    </div>
  )
}
