// 세션 밖에서 고르는 실행 설정(`PromptExecution`)의 선택 규칙 — 순수. 예약 작업처럼 대화가
// 아직 없는 자리에서 모델·작업 종류·노력·권한을 한 값으로 고를 때 쓴다. 화면은
// `components/ExecutionSettingsPicker.tsx`.

import type { AgentKind } from '../../../../../shared/agent-kind'
import { HARNESS_CAPABILITIES, isBackend } from '../../../../../shared/harness'
import type { AgentEnvironment, EffortLevel } from '../../../../../shared/ipc'
import {
  agentPermissionPolicy,
  permissionModeForAgent,
  type NormalizedPermissionMode
} from '../../../../../shared/permission-mode'
import type { PromptExecution } from '../../../../../shared/scheduled-tasks'
import { modelKey, selectionLabel } from '../components/composer/modelSelection'

export interface ExecutionModelOption {
  value: string
  label: string
  execution: Pick<PromptExecution, 'backend' | 'providerKey' | 'modelFamily'>
  isDefault: boolean
}

const SEPARATOR = '\u0000'

// 선택지 값 — provider 와 모델을 함께 식별한다(같은 모델이 여러 provider 에 있을 수 있다).
export function executionOptionValue(value: PromptExecution | null): string {
  return value ? `${value.providerKey}${SEPARATOR}${value.modelFamily ?? ''}` : ''
}

// 고를 수 있는 모델 전수 — 지원되는 하네스의 카탈로그만.
export function executionModelOptions(agents: readonly AgentEnvironment[]): ExecutionModelOption[] {
  return agents.flatMap((agent) => {
    const backend = agent.adapter
    if (!agent.supported || !isBackend(backend)) return []
    return agent.models.map((model) => {
      const modelFamily = modelKey(model)
      return {
        value: `${agent.key}${SEPARATOR}${modelFamily}`,
        label:
          selectionLabel({
            providerKey: agent.key,
            modelFamily,
            modelAlias: model.alias,
            adapter: agent.adapter,
            provider: agent.provider
          }) ?? model.alias,
        execution: { backend, providerKey: agent.key, modelFamily },
        isDefault: model.isDefault
      }
    })
  })
}

export function executionAgentKinds(value: PromptExecution): readonly AgentKind[] {
  return HARNESS_CAPABILITIES[value.backend].agentKinds
}

export function executionPermissionModes(
  value: PromptExecution
): readonly NormalizedPermissionMode[] {
  return agentPermissionPolicy[value.agentKind].menuModes
}

// 작업 종류를 정하고, 그 종류가 메뉴에 두지 않는 권한이면 그 종류의 값으로 맞춘다.
export function executionForKind(
  base: Omit<PromptExecution, 'permissionMode'>,
  mode: NormalizedPermissionMode | undefined
): PromptExecution {
  const modes: readonly NormalizedPermissionMode[] = agentPermissionPolicy[base.agentKind].menuModes
  const permissionMode =
    mode && modes.includes(mode) ? mode : permissionModeForAgent(mode ?? modes[0]!, base.agentKind)
  return { ...base, permissionMode }
}

// 모델을 바꾸면 그 하네스가 지원하지 않는 종류·권한이 남지 않게 맞춘다. 나머지는 유지한다.
export function executionForModel(
  option: ExecutionModelOption,
  previous: PromptExecution | null
): PromptExecution {
  const kinds: readonly AgentKind[] = HARNESS_CAPABILITIES[option.execution.backend].agentKinds
  const agentKind = previous && kinds.includes(previous.agentKind) ? previous.agentKind : kinds[0]!
  return executionForKind({ ...previous, ...option.execution, agentKind }, previous?.permissionMode)
}

// 노력 미지정은 키를 싣지 않는다(= 모델 기본값).
export function withExecutionEffort(
  value: PromptExecution,
  effort: EffortLevel | undefined
): PromptExecution {
  const next: PromptExecution = {
    backend: value.backend,
    agentKind: value.agentKind,
    providerKey: value.providerKey,
    modelFamily: value.modelFamily,
    permissionMode: value.permissionMode
  }
  return effort ? { ...next, effort } : next
}
