import type { CSSProperties } from 'react'
import { Icon } from '../components/atoms/Icon'
import { Status } from '../components/atoms/Status'
import { V1 } from './theme'

interface Engine {
  id: string
  name: string
  kind: string
  cmd: string
  status: 'connected' | 'idle' | 'error'
  models: string[]
  active?: boolean
  version: string
  tone: 'green' | 'amber' | 'red' | 'slate'
  error?: string
}

const ENGINES: Engine[] = [
  {
    id: 'cc',
    name: 'Claude Code',
    kind: 'CLI · Anthropic',
    cmd: 'claude-code --workdir ./cam-validation-v3',
    status: 'connected',
    models: ['claude-sonnet-4.5', 'claude-opus-4.1', 'claude-haiku-4.5'],
    active: true,
    version: 'v0.42.1',
    tone: 'green'
  },
  {
    id: 'oc',
    name: 'OpenCode',
    kind: 'CLI · sst.dev',
    cmd: 'opencode run',
    status: 'connected',
    models: ['gpt-4.1', 'gpt-5-codex', 'gemini-2.5-pro'],
    version: 'v1.18.0',
    tone: 'green'
  },
  {
    id: 'lc',
    name: 'Local · llama.cpp',
    kind: 'OpenAI-compatible API',
    cmd: 'http://127.0.0.1:8080/v1',
    status: 'idle',
    models: ['qwen-coder-30b', 'devstral-24b'],
    version: 'b5024',
    tone: 'slate'
  },
  {
    id: 'cu',
    name: 'Custom endpoint',
    kind: 'OpenAI-compatible',
    cmd: 'https://api.together.xyz/v1',
    status: 'error',
    error: '401 Unauthorized — API 키 확인 필요',
    models: ['qwen-2.5-coder-72b'],
    version: '—',
    tone: 'red'
  }
]

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

export function EngineSettings(): React.JSX.Element {
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
          엔진 & 모델
        </h1>
        <span style={{ color: V1.ink3, fontSize: 13 }}>백엔드 CLI 및 API 엔드포인트</span>
        <button
          style={{
            marginLeft: 'auto',
            padding: '7px 14px',
            border: `1px solid ${V1.borderStrong}`,
            borderRadius: 8,
            background: V1.panel,
            color: V1.ink,
            fontWeight: 500,
            fontSize: 12.5,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Icon name="plus" size={13} /> 엔진 추가
        </button>
      </div>
      <p style={{ color: V1.ink2, fontSize: 13.5, marginTop: 6, marginBottom: 22 }}>
        프로젝트마다 엔진을 따로 지정할 수 있습니다. 세션 안에서 <span className="kbd">⌘</span>{' '}
        <span className="kbd">⇧</span> <span className="kbd">M</span>으로 전환됩니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ENGINES.map((e) => (
          <div
            key={e.id}
            style={{
              background: V1.panel,
              border: `1px solid ${e.active ? V1.borderStrong : V1.border}`,
              borderRadius: 12,
              padding: '14px 18px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background:
                    e.tone === 'green' ? '#e8f1e3' : e.tone === 'red' ? '#f7dad4' : '#eee9dc',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <Icon
                  name="cpu"
                  size={16}
                  color={e.tone === 'red' ? '#b54a3a' : e.tone === 'green' ? '#5a8a4f' : V1.ink2}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: V1.ink }}>{e.name}</span>
                  <span style={{ fontSize: 11, color: V1.ink3 }}>{e.kind}</span>
                  {e.active && (
                    <span
                      style={{
                        fontSize: 10,
                        color: V1.rust,
                        fontWeight: 600,
                        padding: '1px 6px',
                        background: V1.rustSoft,
                        borderRadius: 3,
                        letterSpacing: 0.4
                      }}
                    >
                      현재 프로젝트
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11.5,
                    color: V1.ink2,
                    marginTop: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {e.cmd}
                </div>
              </div>
              <Status
                tone={e.tone === 'red' ? 'red' : e.tone === 'green' ? 'green' : 'slate'}
                label={e.status === 'connected' ? '연결됨' : e.status === 'idle' ? '대기' : '오류'}
              />
              <span style={{ fontSize: 11, color: V1.ink3, fontFamily: 'var(--mono)' }}>
                {e.version}
              </span>
              <button style={iconBtn1}>
                <Icon name="settings" size={13} />
              </button>
            </div>
            {e.error && (
              <div
                style={{
                  marginTop: 10,
                  padding: '7px 12px',
                  background: '#fbe9e2',
                  border: '1px solid #f0c9b8',
                  borderRadius: 6,
                  fontSize: 11.5,
                  color: '#a0432e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Icon name="alert" size={11} color="#a0432e" /> {e.error}
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {e.models.map((m, i) => (
                <span
                  key={m}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    padding: '3px 8px',
                    background: i === 0 && e.active ? V1.rustSoft : 'var(--cream-50)',
                    color: i === 0 && e.active ? V1.rust : V1.ink2,
                    borderRadius: 4,
                    fontWeight: i === 0 && e.active ? 600 : 400
                  }}
                >
                  {i === 0 && e.active ? '✓ ' : ''}
                  {m}
                </span>
              ))}
              <button
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  background: 'transparent',
                  border: `1px dashed ${V1.borderStrong}`,
                  color: V1.ink3,
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                + 모델
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
