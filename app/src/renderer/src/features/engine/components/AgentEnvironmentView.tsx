import { Icon } from '../../../shared/ui/Icon'
import { MOCK_HATCH_BG } from '../../../shared/ui/mock'
import { useAgents } from '../../../shared/hooks/useAgents'

const ICON_BTN =
  'grid h-7 w-7 cursor-not-allowed place-items-center rounded-md border-0 bg-transparent text-ink2 opacity-60'

const AGENT_ENV_BG =
  'https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/cd02a42d9-Vq_H3mgS.svg'

export function AgentEnvironmentView(): React.JSX.Element {
  const agents = useAgents()

  return (
    <section className="flex-1 overflow-auto px-8 pb-10 pt-6">
      <div className="mb-1 flex items-baseline gap-3.5">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
          엔진 & 모델
        </h1>
        <span className="text-[13px] text-ink3">orca.json agent 환경</span>
        <button
          disabled
          data-state="mock"
          style={{ backgroundImage: MOCK_HATCH_BG }}
          className="ml-auto inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border-strong bg-panel px-3.5 py-[7px] text-[12.5px] font-medium text-ink opacity-65"
          title="후속 구현 예정"
        >
          <Icon name="plus" size={13} /> 엔진 추가
        </button>
      </div>
      <p className="mb-[22px] mt-1.5 text-[13.5px] text-ink2">
        <code>~/.config/orca/orca.json</code> 의 agents 항목을 기반으로 Composer 모델 메뉴가
        구성됩니다. 세션 생성 후에는 같은 adapter 안에서 provider 와 모델을 턴 단위로 전환합니다.
      </p>

      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-panel px-4 py-6 text-[13px] text-ink2">
          등록된 agent 가 없습니다. <code>~/.config/orca/orca.json</code> 에 agents 항목을 추가한 뒤
          앱을 재시작하세요.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {agents.map((agent) => (
            <div
              key={agent.key}
              className="relative overflow-hidden rounded-xl border border-border bg-panel px-4 py-3.5"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 top-0 h-36 w-36 translate-x-1/2 bg-contain bg-center bg-no-repeat opacity-[0.06]"
                style={{ backgroundImage: `url(${AGENT_ENV_BG})` }}
              />
              <div className="relative flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{agent.adapter}</span>
                    <span className="text-[11px] text-ink3">{agent.provider ?? 'default'}</span>
                    {!agent.supported && (
                      <span className="rounded-sm bg-cream-50 px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] text-ink3">
                        미지원 adapter
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink3">{agent.key}</div>
                </div>
                <button
                  disabled
                  data-state="mock"
                  style={{ backgroundImage: MOCK_HATCH_BG }}
                  className={ICON_BTN}
                >
                  <Icon name="settings" size={13} />
                </button>
              </div>
              <div className="relative mt-2.5 flex flex-wrap gap-1.5">
                {(agent.models.length > 0 ? agent.models : [{ name: 'SDK 기본 모델' }]).map(
                  (model) => {
                    const label = model.family ?? model.name
                    return (
                      <span
                        key={label}
                        className={`rounded-sm px-2 py-[3px] font-mono text-[11px] ${
                          model.default
                            ? 'bg-rust-soft font-semibold text-rust'
                            : 'bg-cream-50 text-ink2'
                        }`}
                      >
                        {model.default ? '✓ ' : ''}
                        {label}
                      </span>
                    )
                  }
                )}
                <button
                  disabled
                  data-state="mock"
                  style={{ backgroundImage: MOCK_HATCH_BG }}
                  className="cursor-not-allowed rounded-sm border border-dashed border-border-strong bg-transparent px-2 py-[3px] text-[11px] text-ink3 opacity-65"
                  title="후속 구현 예정"
                >
                  + 모델
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
