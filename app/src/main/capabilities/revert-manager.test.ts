import { describe, it, expect } from 'vitest'
import { RevertManager } from './revert-manager'
import type { RevertCapabilities } from './types'

const ALL_FALSE: RevertCapabilities = {
  conversationRevert: false,
  conversationUnrevert: false,
  fileCheckpointCreate: false,
  fileCheckpointRestore: false
}

describe('RevertManager', () => {
  it('cap 전부 false 면 모든 메서드가 미지원 throw (claude 현 상태)', async () => {
    const rm = new RevertManager(ALL_FALSE)
    await expect(rm.revertConversation('m1')).rejects.toThrow('지원하지 않습니다')
    await expect(rm.unrevertConversation()).rejects.toThrow('지원하지 않습니다')
    await expect(rm.createFileCheckpoint()).rejects.toThrow('지원하지 않습니다')
    await expect(rm.restoreFileCheckpoint('c1')).rejects.toThrow('지원하지 않습니다')
  })

  it('conversation cap=true 면 미지원 가드를 통과(미구현 seam throw 로 전이)', async () => {
    const rm = new RevertManager({ ...ALL_FALSE, conversationRevert: true })
    // 가드를 통과하면 "미지원" 이 아니라 "미구현 (seam)" 으로 throw — cap 데이터가 동작을 구동함을 증명.
    await expect(rm.revertConversation('m1')).rejects.toThrow('미구현')
  })

  it('conversation 과 file 은 독립 — file cap 만 켜도 conversation 은 여전히 미지원(§5 병합 금지)', async () => {
    const rm = new RevertManager({ ...ALL_FALSE, fileCheckpointCreate: true })
    await expect(rm.createFileCheckpoint()).rejects.toThrow('미구현')
    await expect(rm.revertConversation('m1')).rejects.toThrow('지원하지 않습니다')
  })

  it('file restore cap=true 면 가드 통과', async () => {
    const rm = new RevertManager({ ...ALL_FALSE, fileCheckpointRestore: true })
    await expect(rm.restoreFileCheckpoint('c1')).rejects.toThrow('미구현')
  })
})
