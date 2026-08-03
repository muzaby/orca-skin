import { beforeEach, describe, expect, it } from 'vitest'
import { useExtensionsModalStore } from './extensionsModalStore'

describe('extensions modal store', () => {
  beforeEach(() => useExtensionsModalStore.setState({ open: false }))

  it('사이드바 액션으로 열고 공용 Modal 닫기 동작으로 닫는다', () => {
    useExtensionsModalStore.getState().show()
    expect(useExtensionsModalStore.getState().open).toBe(true)
    useExtensionsModalStore.getState().hide()
    expect(useExtensionsModalStore.getState().open).toBe(false)
  })
})
