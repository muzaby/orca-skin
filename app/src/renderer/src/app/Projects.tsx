import { Icon } from '../components/atoms/Icon'
import { V1 } from './theme'

interface Project {
  id: string
  name: string
  desc: string
  engine: string
  model: string
  sessions: number
  captures: number
  last: string
  active?: boolean
  tone: 'green' | 'amber' | 'slate'
}

const PROJECTS: Project[] = [
  {
    id: 'cam',
    name: 'cam-validation-v3',
    desc: 'OV-9282 검증, 저조도 SNR 회귀 테스트',
    engine: 'Claude Code',
    model: 'sonnet-4.5',
    sessions: 12,
    captures: 248,
    last: '14분 전',
    active: true,
    tone: 'green'
  },
  {
    id: 'snr',
    name: 'snr-regression-2026',
    desc: 'IMX-415 야간 모드 SNR 추적, 주간 리그레션',
    engine: 'OpenCode',
    model: 'gpt-4.1',
    sessions: 5,
    captures: 96,
    last: '2시간 전',
    tone: 'amber'
  },
  {
    id: 'aec',
    name: 'aec-tuning-suite',
    desc: '자동 노출 수렴 시간 최적화 — 차량용 캠',
    engine: 'Claude Code',
    model: 'sonnet-4.5',
    sessions: 8,
    captures: 412,
    last: '어제',
    tone: 'green'
  },
  {
    id: 'bay',
    name: 'bayer-debug',
    desc: 'Bayer pattern 디버깅 / 채널 분리 도구',
    engine: 'Local (llama.cpp)',
    model: 'qwen-coder-30b',
    sessions: 3,
    captures: 18,
    last: '4일 전',
    tone: 'slate'
  }
]

export function Projects(): React.JSX.Element {
  return (
    <section style={{ flex: 1, overflow: 'auto', padding: '24px 32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 4 }}>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 28,
            fontWeight: 600,
            color: V1.ink,
            margin: 0,
            letterSpacing: -0.6
          }}
        >
          프로젝트
        </h1>
        <span style={{ color: V1.ink3, fontSize: 13 }}>4개의 활성 워크스페이스</span>
        <button
          style={{
            marginLeft: 'auto',
            padding: '7px 14px',
            border: 0,
            borderRadius: 8,
            background: V1.rust,
            color: '#fff',
            fontWeight: 500,
            fontSize: 12.5,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Icon name="plus" size={13} color="#fff" /> 새 프로젝트
        </button>
      </div>
      <p style={{ color: V1.ink2, fontSize: 13.5, marginTop: 6, marginBottom: 22 }}>
        각 프로젝트는 자체 엔진, 모델, Skill/MCP, 캡처 히스토리를 가집니다.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['모두 (4)', 'Claude Code (2)', 'OpenCode (1)', '로컬 (1)', '보관'].map((c, i) => (
          <button
            key={c}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              border: i === 0 ? `1px solid ${V1.borderStrong}` : `1px solid ${V1.border}`,
              background: i === 0 ? V1.panel : 'transparent',
              color: V1.ink2,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {PROJECTS.map((p) => (
          <div
            key={p.id}
            style={{
              background: V1.panel,
              border: `1px solid ${p.active ? V1.borderStrong : V1.border}`,
              borderRadius: 12,
              padding: 16,
              position: 'relative'
            }}
          >
            {p.active && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 14,
                  fontSize: 10.5,
                  color: V1.rust,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase'
                }}
              >
                활성
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className={`dot ${p.tone}`} />
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: V1.ink
                }}
              >
                {p.name}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: V1.ink2, lineHeight: 1.5, marginBottom: 12 }}>
              {p.desc}
            </div>
            <div
              style={{ display: 'flex', gap: 14, fontSize: 11.5, color: V1.ink3, marginBottom: 10 }}
            >
              <span>
                <Icon name="cpu" size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{' '}
                {p.engine}
              </span>
              <span style={{ fontFamily: 'var(--mono)' }}>{p.model}</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontSize: 11.5,
                color: V1.ink2,
                paddingTop: 10,
                borderTop: `1px solid ${V1.border}`
              }}
            >
              <span>
                <b style={{ color: V1.ink }}>{p.sessions}</b> 대화
              </span>
              <span>
                <b style={{ color: V1.ink }}>{p.captures}</b> 캡처
              </span>
              <span style={{ marginLeft: 'auto', color: V1.ink3 }}>{p.last}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
