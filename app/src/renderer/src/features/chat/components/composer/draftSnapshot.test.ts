import { describe, expect, it } from 'vitest'
import {
  clearDraftAfterAcceptedSubmit,
  createDraftSnapshot,
  replaceDraft,
  replaceDraftRange,
  setDraftComposition,
  updateDraftSelection,
  updateDraftText
} from './draftSnapshot'

describe('DraftSnapshot', () => {
  it('텍스트만 revision을 증가시키고 selection 변경은 같은 revision을 유지한다', () => {
    const initial = createDraftSnapshot()
    const typed = updateDraftText(initial, '한글', 2, 2)
    const selected = updateDraftSelection(typed, 0, 2)

    expect(typed.revision).toBe(1)
    expect(selected).toMatchObject({ revision: 1, selectionStart: 0, selectionEnd: 2 })
  })

  it('오래된 자동완성 및 submit clear 명령을 no-op 처리한다', () => {
    const first = replaceDraft(createDraftSnapshot(), '/ski')
    const latest = updateDraftText(first, '/skill 더 입력', 12, 12)

    expect(replaceDraftRange(latest, first.revision, 0, 4, '/skill ')).toBe(latest)
    expect(clearDraftAfterAcceptedSubmit(latest, first.revision)).toBe(latest)
    expect(clearDraftAfterAcceptedSubmit(latest, latest.revision).text).toBe('')
  })

  it('현재 revision의 범위 치환과 IME 종료 최종값을 원자적으로 반영한다', () => {
    const partial = replaceDraft(createDraftSnapshot(), '/ski')
    const completed = replaceDraftRange(partial, partial.revision, 0, 4, '/skill ')
    const composing = setDraftComposition(completed, true)
    const ended = setDraftComposition(composing, false, '/skill 한', 8, 8)

    expect(completed).toMatchObject({ text: '/skill ', selectionStart: 7, selectionEnd: 7 })
    expect(composing.composing).toBe(true)
    expect(ended).toMatchObject({ text: '/skill 한', composing: false })
    expect(ended.revision).toBe(completed.revision + 1)
  })
})
