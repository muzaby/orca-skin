import { describe, expect, it, vi, type Mock } from 'vitest'
import type {
  NativeHistoryResult,
  NativeHistorySnapshot
} from '../../adapters/common/native-history'
import type { DbQueries } from '../../infra/db'
import {
  refreshNativeHistory,
  validNativeSnapshot,
  type NativeSyncDependencies
} from './native-sync'

function fixture(): {
  snapshot: NativeHistorySnapshot
  replace: Mock<() => boolean>
  get: Mock<() => { payload_json: string } | undefined>
  releaseIdleRuntime: Mock
  read: Mock<() => Promise<NativeHistoryResult>>
  deps: NativeSyncDependencies
  change: () => void
  hide: () => void
  start: () => void
} {
  let version = 10
  let visible = true
  let busy = false
  const snapshot: NativeHistorySnapshot = {
    sessionId: 's',
    cwd: '/w',
    sourceKey: 'source',
    revision: 'r1',
    messages: [
      {
        id: 'native-id',
        role: 'assistant',
        createdAt: 1,
        parts: [{ type: 'text', text: 'external reply' }]
      }
    ]
  }
  const replace = vi.fn(() => true)
  const get = vi.fn(() => undefined as { payload_json: string } | undefined)
  const db = {
    getSessionById: () => (visible ? { id: 's' } : undefined),
    nativeHistory: { observe: () => ({ version, frontier: 4 }), get, replace }
  } as unknown as DbQueries
  const releaseIdleRuntime = vi.fn()
  const read = vi.fn<() => Promise<NativeHistoryResult>>(async () => ({
    status: 'ready',
    snapshot
  }))
  return {
    snapshot,
    replace,
    get,
    releaseIdleRuntime,
    read,
    deps: { db, read, releaseIdleRuntime, isBusy: () => busy },
    change: () => {
      version += 1
    },
    hide: () => {
      visible = false
    },
    start: () => {
      busy = true
    }
  }
}

describe('native snapshot synchronization', () => {
  it('releases only idle runtime before reading and commits snapshot, frontier and search together', async () => {
    const f = fixture()
    f.read.mockImplementation(async () => {
      expect(f.releaseIdleRuntime).toHaveBeenCalledOnce()
      return { status: 'ready', snapshot: f.snapshot }
    })
    expect(await refreshNativeHistory('s', f.deps)).toEqual({ status: 'ready' })
    expect(f.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 's',
        frontier: 4,
        expectedVersion: 10,
        messages: [{ id: 'native-id', role: 'assistant', createdAt: 1, content: 'external reply' }]
      })
    )
  })
  it('does not close or read a live session', async () => {
    const f = fixture()
    f.start()
    expect(await refreshNativeHistory('s', f.deps)).toEqual({ status: 'busy' })
    expect(f.read).not.toHaveBeenCalled()
    expect(f.releaseIdleRuntime).not.toHaveBeenCalled()
  })
  it.each(['change', 'hide', 'start'] as const)(
    'discards a result after %s without replacing the archive',
    async (race) => {
      const f = fixture()
      f.read.mockImplementation(async () => {
        f[race]()
        return { status: 'ready', snapshot: f.snapshot }
      })
      expect(await refreshNativeHistory('s', f.deps)).toEqual({ status: 'busy' })
      expect(f.replace).not.toHaveBeenCalled()
    }
  )
  it.each(['missing', 'busy', 'unavailable', 'migration-required'] as const)(
    'preserves the archive on native %s',
    async (status) => {
      const f = fixture()
      f.read.mockResolvedValue({ status, message: 'reason' })
      expect(await refreshNativeHistory('s', f.deps)).toEqual({ status, message: 'reason' })
      expect(f.replace).not.toHaveBeenCalled()
    }
  )
  it('keeps previous snapshot when reading or committing fails, and rejects changed roots', async () => {
    const f = fixture()
    f.read.mockRejectedValueOnce(new Error('native secret path'))
    expect(await refreshNativeHistory('s', f.deps)).toMatchObject({ status: 'unavailable' })
    f.get.mockReturnValue({
      payload_json: JSON.stringify({ ...f.snapshot, sourceKey: 'different' })
    })
    expect(await refreshNativeHistory('s', f.deps)).toMatchObject({ status: 'migration-required' })
    expect(f.replace).not.toHaveBeenCalled()
    f.get.mockReturnValue(undefined)
    f.replace.mockImplementation(() => {
      throw new Error('disk full')
    })
    expect(await refreshNativeHistory('s', f.deps)).toMatchObject({ status: 'unavailable' })
  })
  it('rejects duplicate native identities rather than guessing message order', async () => {
    const f = fixture()
    f.snapshot.messages.push({ ...f.snapshot.messages[0], id: 'other', sourceIds: ['native-id'] })
    expect(validNativeSnapshot(f.snapshot, 's')).toBe(false)
    expect(await refreshNativeHistory('s', f.deps)).toMatchObject({ status: 'unavailable' })
    expect(f.replace).not.toHaveBeenCalled()
  })
})

it('rejects a cursor from a different source or revision before committing anything', async () => {
  for (const mismatch of [{ sourceKey: 'other' }, { revision: 'other' }]) {
    const f = fixture()
    f.read.mockResolvedValue({
      status: 'ready',
      snapshot: f.snapshot,
      cursor: { version: 1, sourceKey: 'source', revision: 'r1', checkpoint: {}, ...mismatch }
    })
    expect((await refreshNativeHistory('s', f.deps)).status).toBe('unavailable')
    expect(f.replace).not.toHaveBeenCalled()
  }
})
