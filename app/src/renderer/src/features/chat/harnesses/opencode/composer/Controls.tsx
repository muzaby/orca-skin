import { useEffect, useRef, useState } from 'react'
import type { AgentEnvironment } from '../../../../../../../shared/ipc'
import { useI18n } from '../../../../../shared/i18n'
import { Popover } from '../../../../../shared/ui/Popover'
import { chatActions, useChatSession } from '../../../store/chatStore'
import { MenuItem, MenuTitle } from '../../../../../shared/ui/MenuItem'
import { Icon } from '../../../../../shared/ui/Icon'
import { OpenCodeIcon } from '../Icon'

function OpenCodeSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
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
      items?.[selected]?.focus()
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
          {options.find((option) => option.value === value)?.label ?? options[0]?.label}
        </span>
        <OpenCodeIcon name="chevron-down" />
      </button>
      <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div
          ref={itemsRef}
          role="none"
          className="flex max-h-[320px] w-[300px] flex-col overflow-auto"
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
            const items = Array.from(
              itemsRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []
            )
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
          <MenuTitle>{label}</MenuTitle>
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
              {value === option.value && <Icon name="check" size={12} className="shrink-0" />}
            </MenuItem>
          ))}
        </div>
      </Popover>
    </>
  )
}

export function OpenCodeAgentControl({
  agents
}: {
  agents: AgentEnvironment['agents']
}): React.JSX.Element {
  const { tr } = useI18n()
  const selected = useChatSession((state) => state.harnessAgent)
  return (
    <OpenCodeSelect
      label={tr('harness.agent')}
      value={selected ?? ''}
      onChange={(value) => chatActions.setHarnessOptions({ agent: value })}
      options={[
        { value: '', label: tr('harness.defaultAgent') },
        ...(agents ?? []).map((agent) => ({ value: agent.name, label: agent.name }))
      ]}
    />
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
    <OpenCodeSelect
      label={tr('harness.variant')}
      value={variants.includes(selected ?? '') ? (selected ?? '') : ''}
      onChange={(value) => chatActions.setHarnessOptions({ variant: value })}
      options={[
        { value: '', label: tr('harness.defaultVariant') },
        ...variants.map((variant) => ({ value: variant, label: variant }))
      ]}
    />
  )
}
