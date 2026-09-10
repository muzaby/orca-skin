import { useEffect, useRef, useState, type RefObject } from 'react'

export interface CatalogSearchControls {
  open: boolean
  inputRef: RefObject<HTMLInputElement | null>
  triggerRef: RefObject<HTMLButtonElement | null>
  close: () => void
  reset: () => void
  toggle: () => void
}

export function useCatalogSearch(onClear: () => void): CatalogSearchControls {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const reset = (): void => {
    setOpen(false)
    onClear()
  }
  const close = (): void => {
    reset()
    triggerRef.current?.focus({ preventScroll: true })
  }
  const toggle = (): void => {
    if (open) close()
    else setOpen(true)
  }

  return { open, inputRef, triggerRef, close, reset, toggle }
}
