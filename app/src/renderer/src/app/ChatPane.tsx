import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../components/atoms/Icon'
import { Avatar } from '../components/atoms/Avatar'
import { V1 } from './theme'

const iconBtn1: CSSProperties = {
  width: 28,
  height: 28,
  border: 0,
  background: 'transparent',
  borderRadius: 6,
  color: V1.ink2,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center'
}

const chip1: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 9px',
  border: `1px solid ${V1.border}`,
  background: V1.panel,
  borderRadius: 999,
  color: V1.ink2,
  fontSize: 11.5,
  cursor: 'pointer'
}

interface MsgProps {
  kind: 'user' | 'claude'
  children: ReactNode
  inProgress?: boolean
}

function Msg({ kind, children, inProgress }: MsgProps): React.JSX.Element {
  if (kind === 'user') {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        <Avatar kind="user" size={28} />
        <div style={{ flex: 1, paddingTop: 3 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, color: V1.ink, marginBottom: 4 }}>
            김재훈
          </div>
          <div style={{ fontSize: 13.5, color: V1.ink, lineHeight: 1.6 }}>{children}</div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Avatar kind="claude" size={28} />
      <div style={{ flex: 1, paddingTop: 3 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 12.5,
            color: V1.ink,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          Claude
          {inProgress && (
            <span
              style={{
                fontSize: 11,
                color: V1.ink3,
                fontWeight: 400,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span className="dot amber" /> 응답 중
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: V1.ink,
            lineHeight: 1.65,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

interface ToolProps {
  name: string
  args: string
  status: 'done' | 'running' | string
  duration?: string
}

function Tool({ name, args, status, duration }: ToolProps): React.JSX.Element {
  const colors =
    status === 'done'
      ? { dot: 'green', label: '완료' }
      : status === 'running'
        ? { dot: 'amber', label: '실행 중…' }
        : { dot: 'slate', label: status }
  return (
    <div
      style={{
        border: `1px solid ${V1.border}`,
        borderRadius: 10,
        background: V1.panel,
        padding: '8px 12px',
        fontSize: 12.5,
        fontFamily: 'var(--mono)',
        color: V1.ink,
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}
    >
      <span className={`dot ${colors.dot}`} />
      <span style={{ fontWeight: 600, color: V1.rust }}>{name}</span>
      <span
        style={{
          color: V1.ink3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0
        }}
      >
        ({args})
      </span>
      <span style={{ fontSize: 11, color: V1.ink3, fontFamily: 'var(--sans)' }}>
        {colors.label}
        {duration ? ` · ${duration}` : ''}
      </span>
    </div>
  )
}

function Table(): React.JSX.Element {
  const rows: [string, string, string, string, string][] = [
    ['R', '108.3', '4.21', '32.4', ''],
    ['G1', '142.7', '4.04', '34.1', ''],
    ['G2', '141.9', '4.79', '32.7', '−1.42 dB vs G1'],
    ['B', '95.6', '4.18', '31.9', '']
  ]
  return (
    <div
      style={{
        border: `1px solid ${V1.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        fontSize: 12,
        fontFamily: 'var(--mono)',
        background: V1.panel
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr 1fr 1fr 1.6fr',
          padding: '8px 12px',
          background: 'var(--cream-50)',
          color: V1.ink2,
          fontSize: 11,
          borderBottom: `1px solid ${V1.border}`
        }}
      >
        <span>채널</span>
        <span>μ (DN)</span>
        <span>σ</span>
        <span>SNR (dB)</span>
        <span></span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr 1fr 1fr 1.6fr',
            padding: '7px 12px',
            color: V1.ink,
            borderBottom: i < rows.length - 1 ? `1px solid ${V1.border}` : 'none',
            alignItems: 'center'
          }}
        >
          <span style={{ fontWeight: 600 }}>{r[0]}</span>
          <span>{r[1]}</span>
          <span>{r[2]}</span>
          <span
            style={{
              color: r[0] === 'G2' ? V1.rust : V1.ink,
              fontWeight: r[0] === 'G2' ? 600 : 400
            }}
          >
            {r[3]}
          </span>
          <span style={{ fontSize: 11, color: V1.rust, fontFamily: 'var(--sans)' }}>{r[4]}</span>
        </div>
      ))}
    </div>
  )
}

export function ChatPane(): React.JSX.Element {
  return (
    <section
      style={{
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: V1.bg
      }}
    >
      <div
        style={{
          padding: '14px 24px 10px',
          borderBottom: `1px solid ${V1.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 17,
              color: V1.ink,
              fontWeight: 600,
              letterSpacing: -0.3
            }}
          >
            Low-light SNR at G2 channel
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: V1.ink3,
              marginTop: 2,
              display: 'flex',
              gap: 8,
              alignItems: 'center'
            }}
          >
            <span>cam-validation-v3</span>
            <span>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="dot green" /> Claude Code · sonnet-4.5
            </span>
            <span>·</span>
            <span>3 skills · 2 MCP</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button style={iconBtn1}>
            <Icon name="search" size={14} />
          </button>
          <button style={iconBtn1}>
            <Icon name="copy" size={14} />
          </button>
          <button style={iconBtn1}>
            <Icon name="settings" size={14} />
          </button>
        </div>
      </div>

      <div
        className="scroll"
        style={{
          flex: 1,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22
        }}
      >
        <Msg kind="user">
          저조도 환경에서 G2 채널의 SNR이 G1보다 약 1.4dB 낮게 측정됩니다. 보드를 바꿔도 같은
          패턴이라 디바이스 이슈는 아닌 것 같은데, 우선 캡처를 10장 받아서 채널별 통계를 봐줘.
        </Msg>
        <Msg kind="claude">
          <p>
            좋아요. 보드(<code>OV-9282 / Rev.C</code>)와 연결 상태 확인했습니다. 캡처 시퀀스
            시작합니다.
          </p>
          <Tool
            name="hardware.capture"
            args="frames=10, exposure_ms=33, gain=4x"
            status="done"
            duration="3.2s"
          />
          <Tool
            name="analysis.bayer_split"
            args="pattern=RGGB, dark_subtract=true"
            status="done"
            duration="0.8s"
          />
          <p>통계가 나왔어요. 채널별 평균 / 표준편차입니다:</p>
          <Table />
          <p>
            G1과 G2 차이가 <b>1.42 dB</b>로 일관되게 나타납니다. row-noise 패턴이 의심스러운데, 아래
            라이브 뷰에서 G2-only 디버그 모드 켜고 같이 보시죠.
          </p>
        </Msg>
        <Msg kind="user">
          그래, 디버그 토글 켜줘. 그리고 노출을 50ms로 올리면 어떻게 되는지도 같이 보고싶어.
        </Msg>
        <Msg kind="claude" inProgress>
          <Tool name="hardware.set_exposure" args="value_ms=50" status="running" />
        </Msg>
      </div>

      <div style={{ padding: '12px 24px 18px' }}>
        <div
          style={{
            background: V1.panel,
            border: `1px solid ${V1.border}`,
            borderRadius: 14,
            padding: '10px 12px',
            boxShadow: '0 1px 2px rgba(0,0,0,.03)'
          }}
        >
          <div style={{ minHeight: 36, color: V1.ink3, fontSize: 13, padding: '6px 4px' }}>
            Orca에게 메시지 보내기…
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
            <button style={chip1}>
              <Icon name="plus" size={12} /> 첨부
            </button>
            <button style={chip1}>
              <Icon name="cam" size={12} /> 현재 프레임
            </button>
            <button style={chip1}>
              <Icon name="bolt" size={12} /> Skill
            </button>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: V1.ink3 }}>claude-sonnet-4.5</span>
              <button
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: 0,
                  background: V1.rust,
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <Icon name="send" size={14} color="#fff" />
              </button>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
