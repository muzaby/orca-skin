import { describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { CHANNELS } from '../../../shared/ipc'
import { PermissionModeController } from '../../features/approvals/permission-mode-controller'
import { createPermissionModeObserver } from './permission-mode-observer'

vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))

function fixture(sessionId: string | null = 's1'): {
  observer: ReturnType<typeof createPermissionModeObserver>
  controller: PermissionModeController
  owner: { isDestroyed: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> }
  turn: { controller: AbortController; dbSessionId: string | null }
  replace: (sessionId: string | null) => void
} {
  const controller = new PermissionModeController('default')
  const owner = { isDestroyed: vi.fn(() => false), send: vi.fn() }
  const turn = { controller: new AbortController(), dbSessionId: sessionId }
  let active = turn
  return {
    controller,
    owner,
    turn,
    observer: createPermissionModeObserver({
      wc: owner as unknown as WebContents,
      permissionModes: controller,
      getActiveTurn: () => active
    }),
    replace: (dbSessionId) => {
      active = { controller: new AbortController(), dbSessionId }
    }
  }
}

describe('0249 VP-37 — 실제 권한 보고의 세션 소유권과 확정 순서', () => {
  it('현재 세션 controller와 실제 IPC 발신을 같은 보고 값으로 갱신한다', () => {
    const f = fixture()
    f.observer.report('s1', 'plan')
    expect(f.controller.getCurrentMode('s1')).toBe('plan')
    expect(f.owner.send).toHaveBeenCalledExactlyOnceWith(CHANNELS.chatEvent, {
      type: 'session.updated',
      sessionId: 's1',
      patch: { permissionMode: 'plan' }
    })
  })

  it('새 init은 세션 확정 뒤 초기 선택값을 실제 SDK 보고로 대체한다', async () => {
    const f = fixture(null)
    f.observer.report('s1', 'plan')
    expect(f.controller.getCurrentMode('s1')).toBe('default')
    expect(f.owner.send).not.toHaveBeenCalled()
    f.turn.dbSessionId = 's1'
    await f.controller.setMode('s1', 'accept_edits')
    f.observer.confirm('s1')
    expect(f.controller.getCurrentMode('s1')).toBe('plan')
    expect(f.owner.send).toHaveBeenCalledTimes(1)
    f.observer.confirm('s1')
    expect(f.owner.send).toHaveBeenCalledTimes(1)
  })

  it('다른 세션·빈 id와 교체된 턴의 늦은 init을 무시한다', () => {
    const known = fixture()
    known.observer.report('other', 'bypass')
    known.observer.report('', 'bypass')
    expect(known.controller.getCurrentMode('s1')).toBe('default')
    expect(known.controller.getCurrentMode('other')).toBe('default')
    expect(known.owner.send).not.toHaveBeenCalled()
    const pending = fixture(null)
    pending.observer.report('old', 'bypass')
    pending.replace('new')
    pending.observer.confirm('old')
    expect(pending.controller.getCurrentMode('old')).toBe('default')
    expect(pending.owner.send).not.toHaveBeenCalled()
  })

  it('확정 id 불일치, 취소된 턴, 폐기된 창에는 controller/IPC를 쓰지 않는다', () => {
    const mismatch = fixture(null)
    mismatch.observer.report('old', 'plan')
    mismatch.turn.dbSessionId = 'new'
    mismatch.observer.confirm('new')
    expect(mismatch.owner.send).not.toHaveBeenCalled()
    const aborted = fixture()
    aborted.turn.controller.abort()
    aborted.observer.report('s1', 'bypass')
    expect(aborted.controller.getCurrentMode('s1')).toBe('default')
    expect(aborted.owner.send).not.toHaveBeenCalled()
    const destroyed = fixture()
    destroyed.owner.isDestroyed.mockReturnValue(true)
    destroyed.observer.report('s1', 'bypass')
    expect(destroyed.controller.getCurrentMode('s1')).toBe('default')
    expect(destroyed.owner.send).not.toHaveBeenCalled()
  })
})
