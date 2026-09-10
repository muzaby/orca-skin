import { describe, expect, it, vi } from 'vitest'
import { sidePaneBounds, resizeSidePaneByKey, startSidePaneDrag } from './sidePaneResize'

function fixture(): {
  target: HTMLElement
  shield: { remove: () => void }
  dispatch: (type: string, extra?: Record<string, unknown>) => void
  change: ReturnType<typeof vi.fn>
  finish: ReturnType<typeof vi.fn>
  stop: () => void
} {
  const win = new EventTarget()
  const shield = { className: '', setAttribute: vi.fn(), remove: vi.fn() }
  const target = {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    ownerDocument: {
      defaultView: win,
      createElement: () => shield,
      body: { append: vi.fn() }
    }
  } as unknown as HTMLElement
  const change = vi.fn()
  const finish = vi.fn()
  const dispatch = (type: string, extra: Record<string, unknown> = {}): void => {
    const event = new Event(type)
    Object.assign(event, extra)
    win.dispatchEvent(event)
  }
  const stop = startSidePaneDrag({
    target,
    pointerId: 7,
    right: 1000,
    bounds: { min: 320, max: 760 },
    onChange: change,
    onFinish: finish
  })
  return { target, shield, dispatch, change, finish, stop }
}

describe('shared side pane resize lifecycle', () => {
  it('clamps drag and keyboard widths to the host while reserving the main content', () => {
    expect(sidePaneBounds(1000)).toEqual({ min: 320, max: 760 })
    expect(sidePaneBounds(450)).toEqual({ min: 210, max: 210 })
    expect(resizeSidePaneByKey('ArrowLeft', 500, { min: 320, max: 760 })).toBe(520)
    expect(resizeSidePaneByKey('ArrowRight', 320, { min: 320, max: 760 })).toBe(320)
    expect(resizeSidePaneByKey('Home', 500, { min: 320, max: 760 })).toBe(320)
    expect(resizeSidePaneByKey('End', 500, { min: 320, max: 760 })).toBe(760)
    expect(resizeSidePaneByKey('Enter', 500, { min: 320, max: 760 })).toBeUndefined()
    const f = fixture()
    f.dispatch('pointermove', { pointerId: 2, clientX: 100 })
    expect(f.change).not.toHaveBeenCalled()
    f.dispatch('pointermove', { pointerId: 7, clientX: 100 })
    expect(f.change).toHaveBeenLastCalledWith(760)
    f.dispatch('pointermove', { pointerId: 7, clientX: 990 })
    expect(f.change).toHaveBeenLastCalledWith(320)
    f.stop()
  })
  it.each(['pointerup', 'pointercancel', 'blur', 'escape', 'unmount'])(
    'releases capture and iframe shield on %s, ignoring later moves',
    (end) => {
      const f = fixture()
      expect(f.target.setPointerCapture).toHaveBeenCalledWith(7)
      expect(f.target.ownerDocument.body.append).toHaveBeenCalledWith(f.shield)
      if (end === 'unmount') f.stop()
      else if (end === 'escape') f.dispatch('keydown', { key: 'Escape' })
      else f.dispatch(end, { pointerId: 7 })
      f.dispatch('pointermove', { pointerId: 7, clientX: 450 })
      expect(f.change).not.toHaveBeenCalled()
      expect(f.shield.remove).toHaveBeenCalledOnce()
      expect(f.target.releasePointerCapture).toHaveBeenCalledWith(7)
      expect(f.finish).toHaveBeenCalledOnce()
      f.stop()
      expect(f.finish).toHaveBeenCalledOnce()
    }
  )
})
