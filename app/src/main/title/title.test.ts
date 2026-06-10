import { describe, expect, it } from 'vitest'
import { MAX_AUTO_TITLE_LENGTH, normalizeTitle, shouldGenerateTitle, titlePrompt } from './title'

describe('normalizeTitle', () => {
  it('양끝 따옴표와 공백/개행을 제거하고 정규화한다', () => {
    expect(normalizeTitle('  “첫 번째\n대화   제목.”  ')).toBe('첫 번째 대화 제목')
  })

  it('최대 60자로 절단한다', () => {
    const result = normalizeTitle('a'.repeat(MAX_AUTO_TITLE_LENGTH + 10))
    expect(result).toBe('a'.repeat(MAX_AUTO_TITLE_LENGTH))
  })

  it('빈 값은 null 로 반환한다', () => {
    expect(normalizeTitle('   \n\t  ')).toBeNull()
    expect(normalizeTitle('""')).toBeNull()
  })
})

describe('titlePrompt', () => {
  it('첫 사용자 메시지를 포함한다', () => {
    expect(titlePrompt('로그 분석해줘')).toContain('로그 분석해줘')
  })
})

describe('shouldGenerateTitle', () => {
  it('새 세션이고 user title 이 아니며 아직 시작하지 않았으면 생성한다', () => {
    expect(
      shouldGenerateTitle({
        isNewSession: true,
        titleSource: 'auto',
        alreadyStarted: false,
        sessionId: 's1',
        firstUserText: 'hello'
      })
    ).toBe(true)
  })

  it('resume 경로와 이미 시작한 턴은 생성하지 않는다', () => {
    expect(
      shouldGenerateTitle({
        isNewSession: false,
        titleSource: 'auto',
        alreadyStarted: false,
        sessionId: 's1',
        firstUserText: 'hello'
      })
    ).toBe(false)
    expect(
      shouldGenerateTitle({
        isNewSession: true,
        titleSource: 'auto',
        alreadyStarted: true,
        sessionId: 's1',
        firstUserText: 'hello'
      })
    ).toBe(false)
  })

  it('사용자 rename 과 불완전한 입력은 생성하지 않는다', () => {
    expect(
      shouldGenerateTitle({
        isNewSession: true,
        titleSource: 'user',
        alreadyStarted: false,
        sessionId: 's1',
        firstUserText: 'hello'
      })
    ).toBe(false)
    expect(
      shouldGenerateTitle({
        isNewSession: true,
        titleSource: 'auto',
        alreadyStarted: false,
        sessionId: null,
        firstUserText: 'hello'
      })
    ).toBe(false)
    expect(
      shouldGenerateTitle({
        isNewSession: true,
        titleSource: 'auto',
        alreadyStarted: false,
        sessionId: 's1',
        firstUserText: '   '
      })
    ).toBe(false)
  })
})
