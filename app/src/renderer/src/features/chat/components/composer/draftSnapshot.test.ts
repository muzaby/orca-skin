import { describe, expect, it } from 'vitest'
import {
  clearDraftAfterAcceptedSubmit,
  createDraftSnapshot,
  replaceDraft,
  replaceDraftRange,
  setDraftComposition,
  updateDraftSelection,
  updateDraftSelectionWhenIdle,
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

  it('IME 조합 중 selection-only 갱신을 차단한다', () => {
    const typed = updateDraftText(createDraftSnapshot(), '한글 입력', 5, 5)
    const composing = setDraftComposition(typed, true)

    expect(updateDraftSelectionWhenIdle(composing, 0, 2)).toBe(composing)
    expect(updateDraftSelectionWhenIdle(typed, 0, 2)).toMatchObject({
      revision: typed.revision,
      selectionStart: 0,
      selectionEnd: 2
    })
  })

  // 0149 — 조합 중 거부를 순수 모듈이 소유한다(구: 컨트롤러가 변이 경로마다 손으로 가드).
  // 새 삽입 경로가 늘어도 가드를 잊을 수 없다는 것이 이 테스트의 요지다.
  it('IME 조합 중에는 텍스트 변이(전문 치환·범위 치환·전송 후 비우기)를 전부 거부한다', () => {
    const typed = updateDraftText(createDraftSnapshot(), '한글 입력', 5, 5)
    const composing = setDraftComposition(typed, true)

    expect(replaceDraft(composing, '/skill ')).toBe(composing)
    expect(replaceDraftRange(composing, composing.revision, 0, 2, 'x')).toBe(composing)
    expect(clearDraftAfterAcceptedSubmit(composing, composing.revision)).toBe(composing)
  })

  it('조합이 끝나면 같은 변이가 정상 적용된다', () => {
    const typed = updateDraftText(createDraftSnapshot(), '한글 입력', 5, 5)

    expect(replaceDraft(typed, '/skill ')).toMatchObject({ text: '/skill ' })
    expect(clearDraftAfterAcceptedSubmit(typed, typed.revision)).toMatchObject({ text: '' })
  })
})
