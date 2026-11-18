// Claude Exchange 비교자 — steer 복원 콜백만 바뀌어도 다시 그린다 (0325 VP-12 · EP-3b ②).
import { describe, expect, it } from 'vitest'
import { Exchange } from './Exchange'
import { agentPresentation } from '../presentation'

type Props = Parameters<typeof Exchange>[0]
const compare = (Exchange as unknown as { compare: (prev: Props, next: Props) => boolean }).compare

describe('Exchange memo comparator', () => {
  const base: Props = {
    transcriptPolicy: agentPresentation.code.transcript,
    exchange: {
      startIndex: 0,
      turns: [
        { role: 'user', startIndex: 0, messages: [{ role: 'user', createdAt: 1, parts: [] }] }
      ]
    },
    reserve: false,
    pending: false,
    onRestoreSteerDraft: () => {}
  }

  it('re-renders when only the steer-restore callback changes', () => {
    expect(compare(base, { ...base })).toBe(true)
    expect(compare(base, { ...base, onRestoreSteerDraft: () => {} })).toBe(false)
  })
})
