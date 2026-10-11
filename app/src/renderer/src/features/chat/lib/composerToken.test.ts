// 0259 AC2·AC3 · VP-10 — 메뉴 토큰 삽입의 공백 규칙.
import { describe, expect, it } from 'vitest'
import { insertComposerToken } from './composerToken'

describe('insertComposerToken', () => {
  it('빈 입력 → 토큰 + 공백', () => {
    expect(insertComposerToken('', 0, '/review')).toMatchObject({ text: '/review ', caret: 8 })
  })
  it('공백으로 끝난 앞 → 그대로 이어 붙임', () => {
    expect(insertComposerToken('hi ', 3, '/review')).toMatchObject({
      text: 'hi /review ',
      caret: 11
    })
  })
  it('글자 뒤 → 앞에 공백 1개', () => {
    expect(insertComposerToken('hi', 2, '@jira')).toMatchObject({ text: 'hi @jira ', caret: 9 })
  })
  it('커서 뒤가 공백이면 뒤 공백을 더하지 않는다 · 커서는 토큰 뒤', () => {
    expect(insertComposerToken('a b', 1, '/x')).toMatchObject({ text: 'a /x b', caret: 4 })
  })
  it('replaceDraftRange 입력(start·replacement)이 결과와 맞는다', () => {
    const r = insertComposerToken('hi', 2, '@jira')
    expect('hi'.slice(0, r.start) + r.replacement + 'hi'.slice(r.start)).toBe(r.text)
  })
})
