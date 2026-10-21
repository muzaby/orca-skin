import { describe, expect, it, vi, type Mock } from 'vitest'
import { OpenCodeInstances } from './instance-lifecycle'

function fixture(timeoutMs = 1000): {
  actor: OpenCodeInstances
  connect: Mock<(signal: AbortSignal) => Promise<void>>
  dispose: Mock<(directory: string, signal: AbortSignal) => Promise<void>>
  retire: ReturnType<typeof vi.fn>
} {
  const connect = vi.fn<(signal: AbortSignal) => Promise<void>>(async () => {})
  const dispose = vi.fn<(directory: string, signal: AbortSignal) => Promise<void>>(async () => {})
  const retire = vi.fn()
  return {
    actor: new OpenCodeInstances({ connect, dispose, retire, timeoutMs }),
    connect,
    dispose,
    retire
  }
}

describe('OpenCode native instance lifetime', () => {
  it('enforces the default 30-second cleanup budget even when HTTP acknowledgement has arrived', async () => {
    vi.useFakeTimers()
    const connect = vi.fn(async () => {})
    const dispose = vi.fn(async () => {})
    const retire = vi.fn()
    const actor = new OpenCodeInstances({ connect, dispose, retire })
    try {
      const state = await actor.acquire('C:/one')
      state.touched = true
      const releasing = actor.release(state)
      const checked = expect(releasing).rejects.toThrow('정리를 완료하지')
      await vi.advanceTimersByTimeAsync(29_999)
      expect(dispose).toHaveBeenCalledOnce()
      expect(retire).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await checked
      expect(retire).toHaveBeenCalledOnce()
    } finally {
      actor.close(new Error('test complete'))
      vi.useRealTimers()
    }
  })
  it('reserves same-directory owners and never bootstraps an untouched instance to dispose it', async () => {
    const f = fixture()
    const a = await f.actor.acquire('C:/one')
    const same = await f.actor.acquire('C:/one/.')
    expect(same).toBe(a)
    await f.actor.release(a)
    expect(a.controller.signal.aborted).toBe(false)
    await f.actor.release(same)
    expect(a.controller.signal.aborted).toBe(true)
    expect(f.connect).not.toHaveBeenCalled()
    expect(f.dispose).not.toHaveBeenCalled()
  })

  it('waits for both acknowledgement and the matching completion event before allowing reacquisition', async () => {
    const f = fixture()
    const ack = Promise.withResolvers<void>()
    f.dispose.mockReturnValue(ack.promise)
    const a = await f.actor.acquire('C:/one')
    const b = await f.actor.acquire('C:/two')
    a.touched = true
    const closed = vi.fn()
    const releasing = f.actor.release(a).then(closed)
    const acquired = vi.fn()
    const pending = f.actor.acquire('C:/one').then((value) => {
      acquired()
      return value
    })
    await vi.waitFor(() => expect(f.dispose).toHaveBeenCalledOnce())
    f.actor.disposed('C:/unrelated')
    ack.resolve()
    await Promise.resolve()
    expect(closed).not.toHaveBeenCalled()
    expect(acquired).not.toHaveBeenCalled()
    expect(f.actor.active(b)).toBe(true)
    f.actor.disposed('C:/one')
    await releasing
    const replacement = await pending
    expect(replacement).not.toBe(a)
    expect(f.actor.active(replacement)).toBe(true)
    await f.actor.release(replacement)
    await f.actor.release(b)
  })

  it('does not let the old externally disposed owner dispose or erase a replacement', async () => {
    const f = fixture()
    const a = await f.actor.acquire('C:/one')
    a.touched = true
    f.actor.disposed('C:/one')
    const next = await f.actor.acquire('C:/one')
    await f.actor.release(a)
    expect(f.actor.active(next)).toBe(true)
    expect(f.dispose).not.toHaveBeenCalled()
    await f.actor.release(next)
  })

  it.each(['connect', 'dispose', 'completion'] as const)(
    'bounds %s and retires new acquisitions while keeping B alive',
    async (phase) => {
      const f = fixture(25)
      if (phase !== 'completion') f[phase].mockReturnValue(new Promise(() => {}))
      const a = await f.actor.acquire('C:/one')
      const b = await f.actor.acquire('C:/two')
      a.touched = true
      const releasing = f.actor.release(a)
      const queued = f.actor.acquire('C:/one')
      const checked = Promise.all([
        expect(releasing).rejects.toThrow('정리를 완료하지'),
        expect(queued).rejects.toThrow('정리를 완료하지')
      ])
      await checked
      expect(f.retire).toHaveBeenCalledOnce()
      expect(f.actor.active(b)).toBe(true)
      await expect(f.actor.acquire('C:/third')).rejects.toThrow('다시 시작')
      expect(f.connect.mock.calls[0][0].aborted).toBe(true)
      await f.actor.release(b)
    }
  )

  it('cancels cleanup and pending reacquisition at shutdown without waiting for an unresponsive transport', async () => {
    const f = fixture()
    f.dispose.mockReturnValue(new Promise(() => {}))
    const a = await f.actor.acquire('C:/one')
    a.touched = true
    const releasing = f.actor.release(a)
    const queued = f.actor.acquire('C:/one')
    const checked = Promise.all([
      expect(releasing).rejects.toThrow(),
      expect(queued).rejects.toThrow()
    ])
    await vi.waitFor(() => expect(f.dispose).toHaveBeenCalledOnce())
    f.actor.close(new Error('shutdown'))
    await checked
    expect(f.dispose.mock.calls[0][1].aborted).toBe(true)
    expect(f.retire).not.toHaveBeenCalled()
    await expect(f.actor.acquire('C:/two')).rejects.toThrow('shutdown')
  })
})
