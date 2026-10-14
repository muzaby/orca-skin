import type { AgentEnvironment } from '../../../../../../../shared/ipc'
import { useI18n } from '../../../../../shared/i18n'
import { chatActions, useChatSession } from '../../../store/chatStore'

const SELECT_CLASS =
  'h-8 max-w-44 cursor-pointer rounded-md border-0 bg-transparent px-2 text-[12.5px] text-oc-ink outline-none hover:bg-oc-hover focus-visible:ring-2 focus-visible:ring-accent'

export function OpenCodeAgentControl({
  agents
}: {
  agents: AgentEnvironment['agents']
}): React.JSX.Element {
  const { tr } = useI18n()
  const selected = useChatSession((state) => state.harnessAgent)
  return (
    <select
      aria-label={tr('harness.agent')}
      className={SELECT_CLASS}
      value={selected ?? ''}
      onChange={(event) => chatActions.setHarnessOptions({ agent: event.target.value })}
    >
      <option value="">{tr('harness.defaultAgent')}</option>
      {(agents ?? []).map((agent) => (
        <option key={agent.name} value={agent.name}>
          {agent.name}
        </option>
      ))}
    </select>
  )
}

export function OpenCodeVariantControl({
  variants
}: {
  variants: readonly string[]
}): React.JSX.Element {
  const { tr } = useI18n()
  const selected = useChatSession((state) => state.modelVariant)
  return (
    <select
      aria-label={tr('harness.variant')}
      className={SELECT_CLASS}
      value={variants.includes(selected ?? '') ? selected : ''}
      onChange={(event) => chatActions.setHarnessOptions({ variant: event.target.value })}
    >
      <option value="">{tr('harness.defaultVariant')}</option>
      {variants.map((variant) => (
        <option key={variant} value={variant}>
          {variant}
        </option>
      ))}
    </select>
  )
}
