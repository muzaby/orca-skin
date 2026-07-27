import type { ReactNode } from 'react'
import { MOCK_SCENARIO_IDS, type MockScenarioId } from '../../../../../shared/ipc'
import { useTweakContext } from '../../../shared/theme'
import {
  FloatingPanel,
  PanelRadio,
  PanelSection,
  PanelSelect,
  PanelSlider,
  PanelToggle
} from '../../../shared/ui/FloatingPanel'
import { useDebugMock } from '../hooks/useDebugMock'
import { useI18n, type MessageKey } from '../../../shared/i18n'

// 시나리오 라벨은 카탈로그 키만 두고 렌더에서 tr() 해석한다(0096 패턴, 0097).
const SCENARIO_LABEL_KEYS: Record<MockScenarioId, MessageKey> = {
  text_streaming: 'debug.scenarios.text_streaming',
  reasoning: 'debug.scenarios.reasoning',
  tool_calls: 'debug.scenarios.tool_calls',
  tool_approval: 'debug.scenarios.tool_approval',
  ask_question: 'debug.scenarios.ask_question',
  plan_review: 'debug.scenarios.plan_review',
  subagent_task: 'debug.scenarios.subagent_task',
  subagent_task_child: 'debug.scenarios.subagent_task_child',
  subagent_task_aborted: 'debug.scenarios.subagent_task_aborted',
  subagent_task_multi: 'debug.scenarios.subagent_task_multi',
  subagent_task_running: 'debug.scenarios.subagent_task_running',
  error: 'debug.scenarios.error',
  full: 'debug.scenarios.full'
}

// ssoSection/updateSection: app 레이어가 주입하는 그룹(features/login·features/update).
// features 교차 import 를 피하려고 슬롯 prop 으로 받는다(없으면 미표시).
export function DebugPanel({
  ssoSection,
  updateSection
}: {
  ssoSection?: ReactNode
  updateSection?: ReactNode
}): React.JSX.Element {
  const { t, setTweak } = useTweakContext()
  const { tr } = useI18n()
  const { state, setMock } = useDebugMock()
  const scenarioOptions = MOCK_SCENARIO_IDS.map((id) => ({
    value: id,
    label: tr(SCENARIO_LABEL_KEYS[id])
  }))

  return (
    <FloatingPanel title={tr('debug.title')}>
      <PanelSection label="Mock" />
      <PanelToggle
        label={tr('debug.mockMode')}
        value={state.enabled}
        onChange={(enabled) => setMock({ enabled })}
      />
      <PanelSelect
        label={tr('debug.scenario')}
        value={state.scenarioId}
        options={scenarioOptions}
        onChange={(scenarioId) => setMock({ scenarioId })}
      />
      <PanelSlider
        label={tr('debug.contextUsage')}
        value={Math.round(state.contextUsageRatio * 100)}
        onChange={(value) => setMock({ contextUsageRatio: value / 100 })}
      />
      <PanelToggle label={tr('debug.log')} value={state.log} onChange={(log) => setMock({ log })} />

      <PanelSection label={tr('debug.themeSection')} />
      <PanelRadio
        label={tr('debug.palette')}
        value={t.theme}
        options={[
          { value: 'white', label: tr('settings.general.themeWhite') },
          { value: 'dark', label: tr('settings.general.themeDark') }
        ]}
        onChange={(v) => setTweak('theme', v)}
      />
      <PanelSection label={tr('debug.layoutSection')} />
      {/* 밀도(t.density)는 설정 → 일반 → 환경설정이 단독 노출한다(0132 가 정식 노출 지점을
          만든 뒤 디버그 패널 라디오는 중복이 됐다 — 0149 에서 사용자 결정으로 제거). */}
      <PanelToggle
        label={tr('header.collapseSidebar')}
        value={t.sidebarCollapsed}
        onChange={(v) => setTweak('sidebarCollapsed', v)}
      />
      {updateSection}
      {ssoSection}
    </FloatingPanel>
  )
}
