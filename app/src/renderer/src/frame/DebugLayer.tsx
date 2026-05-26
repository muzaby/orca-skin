import { useTweakContext } from '../app/providers/TweakProvider'
import { DebugSlot } from './Frame'
import { TweaksPanel, TweakSection, TweakRadio, TweakToggle } from './debug/TweaksPanel'

// TweaksPanel 을 DebugSlot 에 배치하는 레이어.
// TweakContext 에서 직접 상태를 읽어 App.tsx 에서 상태 전달 불요.
export function DebugLayer(): React.JSX.Element {
  const { t, setTweak } = useTweakContext()
  return (
    <DebugSlot>
      <TweaksPanel>
        <TweakSection label="테마" />
        <TweakRadio
          label="컬러 팔레트"
          value={t.theme}
          options={[
            { value: 'classic', label: '클래식' },
            { value: 'dark', label: '다크' },
            { value: 'cool', label: '쿨' }
          ]}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakSection label="레이아웃" />
        <TweakRadio
          label="밀도"
          value={t.density}
          options={[
            { value: 'compact', label: '조밀' },
            { value: 'normal', label: '보통' },
            { value: 'comfortable', label: '넓게' }
          ]}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakToggle
          label="사이드바 접기"
          value={t.sidebarCollapsed}
          onChange={(v) => setTweak('sidebarCollapsed', v)}
        />
      </TweaksPanel>
    </DebugSlot>
  )
}
