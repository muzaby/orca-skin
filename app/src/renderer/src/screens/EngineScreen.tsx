import { Icon } from '../components/atoms/Icon'
import { Status } from '../components/atoms/Status'

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

const ICON_BTN =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2'

const TONE_BG: Record<Engine['tone'], string> = {
  green: 'bg-[#e8f1e3]',
  red: 'bg-[#f7dad4]',
  amber: 'bg-cream-100',
  slate: 'bg-cream-100'
}

const TONE_ICON: Record<Engine['tone'], string> = {
  green: '#5a8a4f',
  red: '#b54a3a',
  amber: '#6b6452',
  slate: '#6b6452'
}

export function EngineScreen(): React.JSX.Element {
  return (
    <section className="flex-1 overflow-auto px-8 pb-10 pt-6">
      <div className="mb-1 flex items-baseline gap-3.5">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
          엔진 & 모델
        </h1>
        <span className="text-[13px] text-ink3">백엔드 CLI 및 API 엔드포인트</span>
        <button className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-strong bg-panel px-3.5 py-[7px] text-[12.5px] font-medium text-ink">
          <Icon name="plus" size={13} /> 엔진 추가
        </button>
      </div>
      <p className="mb-[22px] mt-1.5 text-[13.5px] text-ink2">
        프로젝트마다 엔진을 따로 지정할 수 있습니다. 세션 안에서 <span className="kbd">⌘</span>{' '}
        <span className="kbd">⇧</span> <span className="kbd">M</span>으로 전환됩니다.
      </p>

      <div className="flex flex-col gap-2.5">
        {ENGINES.map((e) => (
          <div
            key={e.id}
            className={`rounded-xl bg-panel px-4 py-3.5 ${
              e.active ? 'border border-border-strong' : 'border border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`grid h-9 w-9 place-items-center rounded-lg ${TONE_BG[e.tone]}`}>
                <Icon name="cpu" size={16} color={TONE_ICON[e.tone]} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{e.name}</span>
                  <span className="text-[11px] text-ink3">{e.kind}</span>
                  {e.active && (
                    <span className="rounded-sm bg-rust-soft px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] text-rust">
                      현재 프로젝트
                    </span>
                  )}
                </div>
                <div className="mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11.5px] text-ink2">
                  {e.cmd}
                </div>
              </div>
              <Status
                tone={e.tone === 'red' ? 'red' : e.tone === 'green' ? 'green' : 'slate'}
                label={e.status === 'connected' ? '연결됨' : e.status === 'idle' ? '대기' : '오류'}
              />
              <span className="font-mono text-[11px] text-ink3">{e.version}</span>
              <button className={ICON_BTN}>
                <Icon name="settings" size={13} />
              </button>
            </div>
            {e.error && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-md border border-[#f0c9b8] bg-[#fbe9e2] px-3 py-[7px] text-[11.5px] text-[#a0432e]">
                <Icon name="alert" size={11} color="#a0432e" /> {e.error}
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {e.models.map((m, i) => {
                const primary = i === 0 && e.active
                return (
                  <span
                    key={m}
                    className={`rounded-sm px-2 py-[3px] font-mono text-[11px] ${
                      primary ? 'bg-rust-soft font-semibold text-rust' : 'bg-cream-50 text-ink2'
                    }`}
                  >
                    {primary ? '✓ ' : ''}
                    {m}
                  </span>
                )
              })}
              <button className="cursor-pointer rounded-sm border border-dashed border-border-strong bg-transparent px-2 py-[3px] text-[11px] text-ink3">
                + 모델
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
