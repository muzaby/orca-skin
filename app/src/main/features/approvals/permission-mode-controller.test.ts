import { describe, it, expect } from 'vitest'
import { PermissionModeController } from './permission-mode-controller'

describe('PermissionModeController', () => {
  it('미설정 세션은 기본 모드(auto_classified)를 돌려준다', () => {
    const c = new PermissionModeController()
    expect(c.getCurrentMode('s1')).toBe('auto_classified')
  })

  it('생성자로 기본 모드를 바꿀 수 있다', () => {
    const c = new PermissionModeController('default')
    expect(c.getCurrentMode('s1')).toBe('default')
  })

  it('setMode 로 세션 모드를 저장하고 getCurrentMode 로 읽는다', async () => {
    const c = new PermissionModeController()
    await c.setMode('s1', 'accept_edits')
    expect(c.getCurrentMode('s1')).toBe('accept_edits')
  })

  it('세션 간 모드가 격리된다', async () => {
    const c = new PermissionModeController()
    await c.setMode('s1', 'bypass')
    await c.setMode('s2', 'plan')
    expect(c.getCurrentMode('s1')).toBe('bypass')
    expect(c.getCurrentMode('s2')).toBe('plan')
  })

  it('setMode 는 같은 세션 값을 덮어쓴다', async () => {
    const c = new PermissionModeController()
    await c.setMode('s1', 'plan')
    await c.setMode('s1', 'dont_ask')
    expect(c.getCurrentMode('s1')).toBe('dont_ask')
  })

  it('forget 후에는 기본 모드로 되돌아간다', async () => {
    const c = new PermissionModeController()
    await c.setMode('s1', 'bypass')
    c.forget('s1')
    expect(c.getCurrentMode('s1')).toBe('auto_classified')
  })
})
