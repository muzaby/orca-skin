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

const SCENARIO_LABELS: Record<MockScenarioId, string> = {
  text_streaming: '텍스트 스트리밍',
  reasoning: '추론 블록',
  tool_calls: '도구 호출',
  tool_approval: '도구 승인',
  ask_question: '사용자 질문',
  plan_review: '계획 검토',
  subagent_task: '서브에이전트',
  subagent_task_child: '서브에이전트 child',
  subagent_task_aborted: '서브에이전트 중단',
  subagent_task_multi: '서브에이전트 복수',
  subagent_task_running: '서브에이전트 진행 중',
  error: '에러',
  full: '전체'
}

const SCENARIO_OPTIONS = MOCK_SCENARIO_IDS.map((id) => ({ value: id, label: SCENARIO_LABELS[id] }))

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
  const { state, setMock } = useDebugMock()

  return (
    <FloatingPanel title="디버그">
      <PanelSection label="Mock" />
      <PanelToggle
        label="Mock 모드"
        value={state.enabled}
        onChange={(enabled) => setMock({ enabled })}
      />
      <PanelSelect
        label="시나리오"
        value={state.scenarioId}
        options={SCENARIO_OPTIONS}
        onChange={(scenarioId) => setMock({ scenarioId })}
      />
      <PanelSlider
        label="컨텍스트 사용량"
        value={Math.round(state.contextUsageRatio * 100)}
        onChange={(value) => setMock({ contextUsageRatio: value / 100 })}
      />
      <PanelToggle
        label="Wire 메시지"
        value={state.wireLog}
        onChange={(wireLog) => setMock({ wireLog })}
      />

      <PanelSection label="테마" />
      <PanelRadio
        label="컬러 팔레트"
        value={t.theme}
        options={[
          { value: 'white', label: '화이트' },
          { value: 'dark', label: '다크' }
        ]}
        onChange={(v) => setTweak('theme', v)}
      />
      <PanelSection label="레이아웃" />
      <PanelRadio
        label="밀도"
        value={t.density}
        options={[
          { value: 'compact', label: '조밀' },
          { value: 'normal', label: '보통' },
          { value: 'comfortable', label: '넓게' }
        ]}
        onChange={(v) => setTweak('density', v)}
      />
      <PanelToggle
        label="사이드바 접기"
        value={t.sidebarCollapsed}
        onChange={(v) => setTweak('sidebarCollapsed', v)}
      />
      {updateSection}
      {ssoSection}
    </FloatingPanel>
  )
}
