import { Icon } from '../../../shared/ui/Icon'
import { Status } from '../../../shared/ui/Status'

interface AgentEnvironment {
  id: string
  name: string
  platform: string
  status: 'connected' | 'idle' | 'error'
  models: string[]
  active?: boolean
  version: string
  tone: 'green' | 'amber' | 'red' | 'slate'
  error?: string
}

const AGENT_ENVIRONMENT: AgentEnvironment[] = [
  {
    id: 'cc',
    name: 'Claude Code',
    platform: 'CLI · Anthropic',
    status: 'connected',
    models: ['claude-sonnet-4.5', 'claude-opus-4.1', 'claude-haiku-4.5'],
    active: true,
    version: 'v0.42.1',
    tone: 'green'
  },
  {
    id: 'oc',
    name: 'OpenCode',
    platform: 'CLI · sst.dev',
    status: 'connected',
    models: ['gpt-4.1', 'gpt-5-codex', 'gemini-2.5-pro'],
    version: 'v1.18.0',
    tone: 'green'
  },
  {
    id: 'lc',
    name: 'Local · llama.cpp',
    platform: 'OpenAI-compatible API',
    status: 'idle',
    models: ['qwen-coder-30b', 'devstral-24b'],
    version: 'b5024',
    tone: 'slate'
  },
  {
    id: 'cu',
    name: 'Custom endpoint',
    platform: 'OpenAI-compatible',
    status: 'error',
    error: '401 Unauthorized — API 키 확인 필요',
    models: ['qwen-2.5-coder-72b'],
    version: '—',
    tone: 'red'
  }
]

const ICON_BTN =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2'

export function AgentEnvironmentView(): React.JSX.Element {
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
        {AGENT_ENVIRONMENT.map((e) => (
          <div
            key={e.id}
            className={`rounded-xl bg-panel px-4 py-3.5 ${
              e.active ? 'border border-border-strong' : 'border border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{e.name}</span>
                  <span className="text-[11px] text-ink3">{e.platform}</span>
                  {e.active && (
                    <span className="rounded-sm bg-rust-soft px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] text-rust">
                      현재 프로젝트
                    </span>
                  )}
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
