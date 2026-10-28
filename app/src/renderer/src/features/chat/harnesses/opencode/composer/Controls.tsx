import { useEffect, useRef, useState } from 'react'
import type { AgentEnvironment } from '../../../../../../../shared/ipc'
import { useI18n } from '../../../../../shared/i18n'
import { Popover } from '../../../../../shared/ui/Popover'
import { chatActions, useChatSession } from '../../../store/chatStore'
import { MenuItem, MenuTitle } from '../../../../../shared/ui/MenuItem'
import { Icon } from '../../../../../shared/ui/Icon'
import { OpenCodeIcon } from '../Icon'
import type { ComposerControlProps } from '../../contracts'
import { modelKey } from '../../../components/composer/modelSelection'
import { useComposerCatalog } from './useComposerCatalog'
import { resolveAgentSelection } from './agentSelection'

export function OpenCodeModeControl({ providerKey }: ComposerControlProps): React.JSX.Element {
  const { snapshot } = useComposerCatalog(providerKey)
  return (
    <OpenCodeAgentControl
      agents={snapshot.agents.value}
      authoritative={snapshot.agents.value !== undefined}
      status={snapshot.agents.status}
    />
  )
}

export function OpenCodeEffortControl({
  agents,
  providerKey,
  modelFamily
}: ComposerControlProps): React.JSX.Element | null {
  const { snapshot } = useComposerCatalog(providerKey)
  const model = agents
    .find((a) => a.key === providerKey)
    ?.models.find((m) => modelKey(m) === modelFamily)
  const runtime = snapshot.models.value?.find((m) => m.id === (model?.model ?? modelFamily))
  return (
    <OpenCodeVariantControl
      authoritative={snapshot.models.value !== undefined && !snapshot.models.stale}
      variants={snapshot.models.value ? (runtime?.variants ?? []) : (model?.variants ?? [])}
      status={snapshot.models.status}
    />
  )
}

function OpenCodeSelect({
  label,
  value,
  options,
  onChange,
  compact = false,
  emptyLabel,
  loading = false
}: {
  label: string
  loading?: boolean
  compact?: boolean
  emptyLabel?: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const itemsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      const items = itemsRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
      const selected = Math.max(
        0,
        options.findIndex((option) => option.value === value)
      )
      if (items?.[selected]) items[selected].focus()
      else itemsRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, value, options])
  const close = (): void => {
    setOpen(false)
    anchorRef.current?.focus()
  }
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        data-component="opencode-select"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-[28px] max-w-[176px] shrink-0 items-center gap-[4px] rounded-[6px] px-[8px] text-[13px] font-[440] leading-[20px] text-oc-ink outline-none hover:bg-oc-hover focus-visible:ring-2 focus-visible:ring-oc-focus"
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className="truncate">
          {options.find((option) => option.value === value)?.label ??
            (value || emptyLabel || label)}
        </span>
        <OpenCodeIcon name="chevron-down" />
      </button>
      <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div
          ref={itemsRef}
          role="group"
          tabIndex={-1}
          aria-label={label}
          aria-busy={loading}
          className={`flex max-h-[320px] flex-col overflow-auto ${compact ? 'w-max max-w-[calc(100vw-24px)]' : 'w-[300px]'}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close()
              return
            }
            if (event.key === 'Tab') {
              close()
              return
            }
            const items = [
              ...Array.from(
                itemsRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ??
                  []
              ),
              ...Array.from(
                itemsRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
              )
            ]
            const index = items.findIndex((item) => item === document.activeElement)
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : event.key === 'ArrowDown'
                    ? (index + 1) % items.length
                    : event.key === 'ArrowUp'
                      ? (index - 1 + items.length) % items.length
                      : null
            if (next !== null) {
              event.preventDefault()
              items[next]?.focus()
            }
          }}
        >
          <MenuTitle
            afterLabel={
              loading ? (
                <span data-agent-loading aria-hidden="true">
                  <Icon
                    name="spinner"
                    size={12}
                    className="animate-spin motion-reduce:animate-none"
                  />
                </span>
              ) : undefined
            }
          >
            {label}
          </MenuTitle>
          {options.map((option) => (
            <MenuItem
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              tabIndex={value === option.value ? 0 : -1}

              onClick={() => {
                onChange(option.value)
                close()
              }}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {option.label}
              </span>
              {compact ? (
                <span className="flex w-3 shrink-0 items-center">
                  {value === option.value && <Icon name="check" size={12} />}
                </span>
              ) : (
                value === option.value && <Icon name="check" size={12} className="shrink-0" />
              )}
            </MenuItem>
          ))}
        </div>
      </Popover>
    </>
  )
}

export function OpenCodeAgentControl({
  agents,
  authoritative = false,
  status
}: {
  agents: AgentEnvironment['agents']
  authoritative?: boolean
  status?: 'loading' | 'ready' | 'error'
}): React.JSX.Element {
  const { tr } = useI18n()
  const selected = useChatSession((state) => state.harnessAgent)
  const resolved = resolveAgentSelection(selected, agents, authoritative, status)
  useEffect(() => {
    if (resolved !== (selected ?? ''))
      chatActions.setHarnessOptions({ agent: resolved, ...(selected ? { variant: '' } : {}) })
  }, [resolved, selected])
  return (
    <OpenCodeSelect
      label={tr('harness.agent')}
      value={resolved}
      compact
      emptyLabel={tr(
        status === 'loading'
          ? 'harness.agentLoading'
          : status === 'error'
            ? 'harness.agentError'
            : 'harness.noAgents'
      )}
      onChange={(value) => chatActions.setHarnessOptions({ agent: value })}
      loading={status === 'loading'}
      options={(agents ?? []).map((agent) => ({ value: agent.name, label: agent.name }))}
    />
  )
}

export function OpenCodeVariantControl({
  variants,
  authoritative = false,
  status
}: {
  variants: readonly string[]
  authoritative?: boolean
  status?: 'loading' | 'ready' | 'error'
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const selected = useChatSession((state) => state.modelVariant)
  useEffect(() => {
    if (authoritative && selected && !variants.includes(selected))
      chatActions.setHarnessOptions({ variant: '' })
  }, [variants, selected, authoritative])
  if (!variants.length && (!status || status === 'ready')) return null
  return (
    <OpenCodeSelect
      label={tr('harness.variant')}
      loading={status === 'loading'}
      value={variants.includes(selected ?? '') ? (selected ?? '') : ''}
      onChange={(value) => chatActions.setHarnessOptions({ variant: value })}
      options={[
        { value: '', label: tr('harness.defaultVariant') },
        ...variants.map((variant) => ({ value: variant, label: variant }))
      ]}
    />
  )
}
