import { describe, expect, it, vi } from 'vitest'
import { focusPanelOrigin } from './panelFocus'

function target(state: 'visible' | 'detached' | 'hidden' | 'inert' = 'visible'): {
  element: HTMLElement
  closest: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
} {
  const focus = vi.fn()
  const closest = vi.fn(() => (state === 'hidden' || state === 'inert' ? {} : null))
  const element = { isConnected: state !== 'detached', closest, focus } as unknown as HTMLElement
  return { element, closest, focus }
}

describe('panel return focus', () => {
  it('prefers the connected origin without scrolling or focusing the fallback', () => {
    const origin = target()
    const fallback = target()
    expect(focusPanelOrigin(origin.element, fallback.element)).toBe(true)
    expect(origin.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(fallback.focus).not.toHaveBeenCalled()
  })

  it.each(['detached', 'hidden', 'inert'] as const)(
    'restores fallback focus only after a removed or %s detail origin',
    (state) => {
      const origin = target(state)
      const fallback = target()
      expect(focusPanelOrigin(origin.element, fallback.element)).toBe(true)
      expect(origin.focus).not.toHaveBeenCalled()
      expect(fallback.closest).toHaveBeenCalledWith('[inert], [hidden]')
      expect(fallback.focus).toHaveBeenCalledWith({ preventScroll: true })
    }
  )

  it.each(['detached', 'hidden', 'inert'] as const)(
    'does not focus a %s fallback after its layer or session is removed',
    (state) => {
      const fallback = target(state)
      expect(focusPanelOrigin(undefined, fallback.element)).toBe(false)
      expect(fallback.focus).not.toHaveBeenCalled()
    }
  )

  it('preserves the existing no-fallback behavior', () => {
    expect(focusPanelOrigin()).toBe(false)
    const origin = target('detached')
    expect(focusPanelOrigin(origin.element)).toBe(false)
    expect(origin.focus).not.toHaveBeenCalled()
  })
})
