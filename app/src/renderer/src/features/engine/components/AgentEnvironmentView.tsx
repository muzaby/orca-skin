import { useEffect, useState } from 'react'
import type { AgentEnvironment } from '../../../../../shared/ipc'
import { Icon } from '../../../shared/ui/Icon'
import { EngineCard } from './EngineCard'
import { EngineFormModal } from './EngineFormModal'
import { useEngines } from '../hooks/useEngines'

type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; agent: AgentEnvironment; settingsJson: string }
  | null

export function AgentEnvironmentView(): React.JSX.Element {
  const { agents, state, refresh, add, update, remove, read } = useEngines()
  const [modal, setModal] = useState<ModalState>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [readError, setReadError] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openEdit = async (agent: AgentEnvironment): Promise<void> => {
    setLoadingKey(agent.key)
    setReadError(null)
    try {
      const result = await read(agent.key)
      setModal({ mode: 'edit', agent, settingsJson: result.settingsJson })
    } catch (e) {
      // 과거엔 read 실패가 조용히 삼켜져 "편집이 안 열린다"로 보였다 — 이제 사유를 표시한다.
      setReadError(e instanceof Error ? e.message : '설정을 불러오지 못했어요.')
    } finally {
      setLoadingKey(null)
    }
  }

  const deleteAgent = async (agent: AgentEnvironment): Promise<void> => {
    if (!window.confirm(`${agent.provider ?? agent.key} provider 를 삭제할까요?`)) return
    await remove(agent.key)
  }

  return (
    <section className="flex-1 overflow-auto px-8 pb-10 pt-6">
      <div className="mb-1 flex items-baseline gap-3.5">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
          엔진 & 모델
        </h1>
        <span className="text-[13px] text-ink3">provider settings 환경</span>
        <button
          type="button"
          onClick={() => setModal({ mode: 'add' })}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-panel px-3.5 py-[7px] text-[12.5px] font-medium text-ink hover:bg-sidebar"
        >
          <Icon name="plus" size={13} /> 엔진 추가
        </button>
      </div>
      <p className="mb-[22px] mt-1.5 text-[13.5px] text-ink2">
        <code>~/.config/orca/sources/settings</code> 의 provider settings 를 기반으로 Composer 모델
        메뉴가 구성됩니다. 편집 후 앱 재시작 없이 모델 메뉴가 갱신됩니다.
      </p>

      {(state.error || readError) && (
        <div className="mb-3 rounded-lg bg-rust-soft px-3 py-2 text-[12px] text-rust">
          {state.error ?? readError}
        </div>
      )}

      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-panel px-4 py-6 text-[13px] text-ink2">
          등록된 provider 가 없습니다. 엔진 추가 버튼으로 claude-code provider 를 생성하세요.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {agents.map((agent) => (
            <EngineCard
              key={agent.key}
              agent={agent}
              busy={state.busy || loadingKey === agent.key}
              onEdit={(next) => void openEdit(next)}
              onDelete={(next) => void deleteAgent(next)}
            />
          ))}
        </div>
      )}

      {modal?.mode === 'add' && (
        <EngineFormModal
          mode="add"
          busy={state.busy}
          onClose={() => setModal(null)}
          onSubmit={async ({ provider, settingsJson }) => {
            await add({ engine: 'claude-code', provider, settingsJson })
            setModal(null)
          }}
        />
      )}
      {modal?.mode === 'edit' && (
        <EngineFormModal
          mode="edit"
          provider={modal.agent.provider ?? modal.agent.key}
          initialSettingsJson={modal.settingsJson}
          busy={state.busy}
          onClose={() => setModal(null)}
          onSubmit={async ({ settingsJson }) => {
            await update({ key: modal.agent.key, settingsJson })
            setModal(null)
          }}
        />
      )}
    </section>
  )
}
