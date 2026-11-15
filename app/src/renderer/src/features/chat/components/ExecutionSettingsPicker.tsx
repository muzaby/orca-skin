// 제어형 실행 설정 입력 — 모델·작업 종류·노력·권한을 한 값(`PromptExecution`)으로 고른다.
// 예약 작업 모달이 pages 슬롯으로 쓴다. 컴포저와 달리 세션 상태를 읽지 않는다 — 고른 값은
// 호출자가 갖고, 선택 규칙은 `lib/executionSettings.ts` 가 갖는다.

import { useEffect } from 'react'
import type { AgentKind } from '../../../../../shared/agent-kind'
import type { EffortLevel } from '../../../../../shared/ipc'
import type { NormalizedPermissionMode } from '../../../../../shared/permission-mode'
import type { PromptExecution } from '../../../../../shared/scheduled-tasks'
import { useAgents } from '../../../shared/hooks/useAgents'
import { useI18n, type MessageKey } from '../../../shared/i18n'
import { MODAL_INPUT, MODAL_LABEL } from '../../../shared/ui/Modal'
import { EFFORT_LABEL_KEYS } from '../harnesses/claude/composer/effort'
import {
  executionAgentKinds,
  executionForKind,
  executionForModel,
  executionModelOptions,
  executionOptionValue,
  executionPermissionModes,
  withExecutionEffort
} from '../lib/executionSettings'

const EFFORTS = Object.keys(EFFORT_LABEL_KEYS) as EffortLevel[]

const MODE_LABEL_KEYS: Record<NormalizedPermissionMode, MessageKey> = {
  default: 'chat.composer.modes.default.label',
  accept_edits: 'chat.composer.modes.accept_edits.label',
  plan: 'chat.composer.modes.plan.label',
  dont_ask: 'chat.composer.modes.dont_ask.label',
  bypass: 'chat.composer.modes.bypass.label',
  auto_classified: 'chat.composer.modes.auto_classified.label'
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
  const current = executionOptionValue(value)
  const known = options.some((option) => option.value === current)
  const kinds = value ? executionAgentKinds(value) : []
  const modes = value ? executionPermissionModes(value) : []

  return (
    <>
      <label className="block min-w-40">
        <div className={MODAL_LABEL}>{tr('schedules.modal.model')}</div>
        <select
          data-execution-model=""
          value={current}
          onChange={(event) => {
            const option = options.find((item) => item.value === event.target.value)
            onChange(option ? executionForModel(option, value) : null)
          }}
          className={MODAL_INPUT}
        >
          <option value="">{tr('schedules.modal.modelPlaceholder')}</option>
          {/* 카탈로그에서 사라진 저장값도 보이게 둔다 — 조용히 다른 모델로 바뀌지 않게. */}
          {value && !known && (
            <option value={current}>{value.modelFamily ?? value.providerKey}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {value && kinds.length > 1 && (
        <label className="block">
          <div className={MODAL_LABEL}>{tr('schedules.modal.agentKind')}</div>
          <select
            data-execution-kind=""
            value={value.agentKind}
            onChange={(event) =>
              onChange(
                executionForKind(
                  { ...value, agentKind: event.target.value as AgentKind },
                  value.permissionMode
                )
              )
            }
            className={MODAL_INPUT}
          >
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind === 'code' ? 'Code' : 'Work'}
              </option>
            ))}
          </select>
        </label>
      )}
      {value && (
        <>
          <label className="block">
            <div className={MODAL_LABEL}>{tr('schedules.modal.effort')}</div>
            <select
              data-execution-effort=""
              value={value.effort ?? ''}
              onChange={(event) => {
                const effort = event.target.value as EffortLevel | ''
                onChange(withExecutionEffort(value, effort || undefined))
              }}
              className={MODAL_INPUT}
            >
              <option value="">{tr('schedules.modal.effortDefault')}</option>
              {EFFORTS.map((effort) => (
                <option key={effort} value={effort}>
                  {tr(EFFORT_LABEL_KEYS[effort])}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className={MODAL_LABEL}>{tr('schedules.modal.permission')}</div>
            <select
              data-execution-permission=""
              value={value.permissionMode}
              onChange={(event) =>
                onChange({
                  ...value,
                  permissionMode: event.target.value as NormalizedPermissionMode
                })
              }
              className={MODAL_INPUT}
            >
              {/* 정책 메뉴 밖의 저장값도 보이게 둔다. */}
              {!modes.includes(value.permissionMode) && (
                <option value={value.permissionMode}>
                  {tr(MODE_LABEL_KEYS[value.permissionMode])}
                </option>
              )}
              {modes.map((mode) => (
                <option key={mode} value={mode}>
                  {tr(MODE_LABEL_KEYS[mode])}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </>
  )
}
