import { useEffect, useRef, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Backend } from '../../../shared/ipc'
import { chatActions, HarnessLogo } from '../features/chat'
import { useI18n } from '../shared/i18n'
import { MenuItem } from '../shared/ui/MenuItem'
import { Popover } from '../shared/ui/Popover'

const choices: { backend: Backend; label: string }[] = [
  { backend: 'claude', label: 'Claude' },
  { backend: 'opencode', label: 'OpenCode' }
]
export function NewChatHarnessMenu({
  open,
  anchorRef,
  boundaryRef,
  onClose
}: {
  open: boolean
  anchorRef: RefObject<HTMLButtonElement | null>
  boundaryRef: RefObject<HTMLElement | null>
  onClose: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const { tr } = useI18n()
  const firstRef = useRef<HTMLButtonElement>(null)
  const secondRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => firstRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])
  return (
    <Popover
      open={open}
      anchorRef={anchorRef}
      boundaryRef={boundaryRef}
      placement="right"
      gap={0}
      onClose={onClose}
    >
      <div
        role="menu"
        aria-label={tr('common.newChat')}
        className="w-44 max-w-[calc(100vw-24px)]"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
            anchorRef.current?.focus()
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const next = document.activeElement === firstRef.current ? secondRef : firstRef
            next.current?.focus()
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            const target = event.key === 'Home' ? firstRef : secondRef
            target.current?.focus()
          } else if (event.key === 'Tab') onClose()
        }}
      >
        {choices.map(({ backend, label }, index) => (
          <MenuItem
            key={backend}
            ref={index === 0 ? firstRef : secondRef}
            role="menuitem"
            data-harness-choice={backend}
            onClick={() => {
              chatActions.newChat()
              chatActions.setModel(null, null, null, backend, { explicitHarness: true })
              onClose()
              navigate('/new')
            }}
          >
            <span
              className="flex size-5 shrink-0 items-center justify-center"
              data-harness-brand={backend}
            >
              <HarnessLogo
                backend={backend}
                className={`size-5 ${backend === 'claude' ? 'text-spinner' : 'text-ink'}`}
              />
            </span>
            <span>{label}</span>
          </MenuItem>
        ))}
      </div>
    </Popover>
  )
}
