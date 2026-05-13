import { Icon } from '../components/atoms/Icon'
import { V1 } from './theme'

interface Skill {
  name: string
  desc: string
  enabled: boolean
}

interface Mcp {
  name: string
  cmd: string
  tools: number
  status: 'green' | 'amber' | 'red'
  enabled: boolean
}

const SKILLS: Skill[] = [
  { name: 'bayer-analysis', desc: 'RAW 프레임을 채널별로 분리하고 SNR/DR 계산', enabled: true },
  { name: 'mtf-sfr', desc: 'Slanted-edge MTF / SFR 계산 (ISO 12233)', enabled: true },
  { name: 'capture-batch', desc: '시퀀스 캡처 헬퍼 (노출 sweep, gain sweep)', enabled: true },
  { name: 'flat-field', desc: 'Flat field 보정 / vignetting 분석', enabled: false },
  { name: 'color-checker', desc: 'X-Rite 차트 자동 검출 + ΔE 계산', enabled: false }
]

const MCPS: Mcp[] = [
  {
    name: 'cam-board-mcp',
    cmd: 'node ./mcp/board-server.js',
    tools: 14,
    status: 'green',
    enabled: true
  },
  { name: 'github', cmd: 'mcp-server-github', tools: 8, status: 'green', enabled: true },
  {
    name: 'jira-validation',
    cmd: 'mcp-jira --project=CAMVAL',
    tools: 6,
    status: 'amber',
    enabled: false
  }
]

function SectionHead({
  title,
  count,
  action
}: {
  title: string
  count?: string
  action?: string
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
      <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: V1.ink }}>
        {title}
      </span>
      {count && <span style={{ fontSize: 12, color: V1.ink3 }}>{count}</span>}
      {action && (
        <button
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: V1.rust,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          + {action}
        </button>
      )}
    </div>
  )
}

function Toggle({ on }: { on: boolean }): React.JSX.Element {
  return (
    <div
      style={{
        width: 30,
        height: 17,
        background: on ? V1.rust : V1.borderStrong,
        borderRadius: 9,
        position: 'relative',
        flex: '0 0 auto',
        cursor: 'pointer'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 1.5,
          left: on ? 14.5 : 1.5,
          width: 14,
          height: 14,
          background: '#fff',
          borderRadius: '50%',
          boxShadow: '0 1px 2px rgba(0,0,0,.2)',
          transition: 'left .15s'
        }}
      />
    </div>
  )
}

function PermRow({ label, desc }: { label: string; desc: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <Icon name="check" size={13} color="#5a8a4f" />
      <div style={{ flex: 1 }}>
        <div style={{ color: V1.ink, fontWeight: 500 }}>{label}</div>
        <div style={{ color: V1.ink3, fontSize: 11.5 }}>{desc}</div>
      </div>
      <button
        style={{
          fontSize: 11,
          color: V1.ink3,
          border: 0,
          background: 'transparent',
          cursor: 'pointer'
        }}
      >
        편집
      </button>
    </div>
  )
}

export function SkillsMcp(): React.JSX.Element {
  return (
    <section style={{ flex: 1, overflow: 'auto', padding: '24px 32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
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
          Skills & MCP
        </h1>
        <span style={{ color: V1.ink3, fontSize: 13 }}>Claude가 사용할 수 있는 도구</span>
      </div>
      <p style={{ color: V1.ink2, fontSize: 13.5, marginTop: 6, marginBottom: 22 }}>
        <b>cam-validation-v3</b> 프로젝트에 설치된 항목입니다.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 22 }}>
        <div>
          <SectionHead title="Skills" count="3 / 5 활성" action="설치" />
          <div
            style={{
              background: V1.panel,
              border: `1px solid ${V1.border}`,
              borderRadius: 12,
              overflow: 'hidden'
            }}
          >
            {SKILLS.map((s, i) => (
              <div
                key={s.name}
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderBottom: i < SKILLS.length - 1 ? `1px solid ${V1.border}` : 'none'
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    background: 'var(--cream-50)',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  <Icon name="bolt" size={14} color={s.enabled ? V1.rust : V1.ink3} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: s.enabled ? V1.ink : V1.ink3
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: V1.ink2, marginTop: 1 }}>{s.desc}</div>
                </div>
                <Toggle on={s.enabled} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHead title="MCP 서버" count="2 / 3 연결됨" action="추가" />
          <div
            style={{
              background: V1.panel,
              border: `1px solid ${V1.border}`,
              borderRadius: 12,
              overflow: 'hidden'
            }}
          >
            {MCPS.map((m, i) => (
              <div
                key={m.name}
                style={{
                  padding: '12px 14px',
                  borderBottom: i < MCPS.length - 1 ? `1px solid ${V1.border}` : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`dot ${m.status}`} />
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: V1.ink
                    }}
                  >
                    {m.name}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: V1.ink3 }}>
                    {m.tools} 툴
                  </span>
                  <Toggle on={m.enabled} />
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: V1.ink2,
                    marginTop: 4,
                    paddingLeft: 17
                  }}
                >
                  {m.cmd}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <SectionHead title="권한" />
            <div
              style={{
                background: V1.panel,
                border: `1px solid ${V1.border}`,
                borderRadius: 12,
                padding: 14,
                fontSize: 12.5
              }}
            >
              <PermRow label="하드웨어 보드 제어" desc="capture, set_exposure, set_gain" />
              <PermRow label="파일 시스템 (워크스페이스)" desc="cam-validation-v3/ 안에서만" />
              <PermRow label="네트워크" desc="회사 GitLab + 로컬 MCP만 허용" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
