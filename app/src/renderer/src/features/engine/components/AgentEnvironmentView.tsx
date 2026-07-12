import { useEffect, useState } from 'react'
import type { AgentEnvironment } from '../../../../../shared/ipc'
import { Icon } from '../../../shared/ui/Icon'
import { Trans } from 'react-i18next'
import { uiMessageText, useI18n } from '../../../shared/i18n'
import { EngineCard } from './EngineCard'
import { EngineFormModal } from './EngineFormModal'
import { useEngines } from '../hooks/useEngines'

type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; agent: AgentEnvironment; settingsJson: string }
  | null

export function AgentEnvironmentView(): React.JSX.Element {
  const { tr } = useI18n()
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
      setReadError(e instanceof Error ? e.message : tr('engine.readSettingsFailed'))
    } finally {
      setLoadingKey(null)
    }
  }

  const deleteAgent = async (agent: AgentEnvironment): Promise<void> => {
    if (!window.confirm(tr('engine.deleteConfirm', { name: agent.provider ?? agent.key }))) return
    await remove(agent.key)
  }

  return (
    <section className="flex-1 overflow-auto px-8 pb-10 pt-6">
      <div className="mb-1 flex items-baseline gap-3.5">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
          {tr('engine.title')}
        </h1>
        <span className="text-[13px] text-ink3">{tr('engine.subtitle')}</span>
        <button
          type="button"
          onClick={() => setModal({ mode: 'add' })}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-panel px-3.5 py-[7px] text-[12.5px] font-medium text-ink hover:bg-sidebar"
        >
          <Icon name="plus" size={13} /> {tr('engine.addEngine')}
        </button>
      </div>
      <p className="mb-[22px] mt-1.5 text-[13.5px] text-ink2">
        {/* 카탈로그 값의 <c> 태그가 code 요소로 치환된다. */}
        <Trans i18nKey="engine.blurb" components={{ c: <code /> }} />
      </p>

      {(state.error || readError) && (
        <div className="mb-3 rounded-lg bg-bad/10 px-3 py-2 text-[12px] text-bad">
          {state.error ? uiMessageText(tr, state.error) : readError}
        </div>
      )}

      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-panel px-4 py-6 text-[13px] text-ink2">
          {tr('engine.emptyState')}
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
            await add({ engine: 'claude', provider, settingsJson })
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
