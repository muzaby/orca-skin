import { Icon } from '../components/atoms/Icon'
import { V1 } from './theme'

export function CapturesPlaceholder(): React.JSX.Element {
  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
        gap: 14,
        background: V1.bg
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: V1.rustSoft,
          color: V1.rust,
          display: 'grid',
          placeItems: 'center'
        }}
      >
        <Icon name="flask" size={26} />
      </div>
      <h1
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 24,
          fontWeight: 600,
          color: V1.ink,
          margin: 0,
          letterSpacing: -0.4
        }}
      >
        캡처 히스토리 & AI 분석
      </h1>
      <p
        style={{
          color: V1.ink2,
          fontSize: 13.5,
          margin: 0,
          maxWidth: 460,
          lineHeight: 1.55
        }}
      >
        준비 중입니다. 캡처 RAW 보관, 채널별 메트릭, ColorChecker / SFR / ΔE 자동 분석, Claude의
        분석 코멘트는 다음 단계에서 제공됩니다.
      </p>
      <div
        style={{
          marginTop: 6,
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: V1.ink3,
          letterSpacing: 0.4
        }}
      >
        PRD §9 · Future Scope
      </div>
    </section>
  )
}
