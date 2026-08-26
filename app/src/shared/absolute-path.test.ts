// `extraDirs` 절대 경로 강제 (AC12) — 판정 자체와 IPC 스키마 양쪽.
//
// 이 배열은 0075 workspace 가드의 read/write 루트로 그대로 흘러가므로, 여기가 느슨하면
// 사용자가 지목한 적 없는 폴더가 에이전트에게 열린다.

import { describe, expect, it } from 'vitest'
import { isAbsolutePath } from './absolute-path'
import { SendChatMessageSchema } from './protocol'

const send = (extraDirs: unknown): { success: boolean } =>
  SendChatMessageSchema.safeParse({
    sessionId: null,
    projectId: null,
    text: 'hi',
    extraDirs
  })

describe('isAbsolutePath', () => {
  it.each(['/abs', '/abs/nested', '/abs/trailing/', 'C:\\work', 'c:/work', '\\\\server\\share\\x'])(
    '%s 는 절대 경로다',
    (value) => {
      expect(isAbsolutePath(value)).toBe(true)
    }
  )

  it.each(['refs', './refs', '../x', '', 'x/../y', 'C:relative'])(
    '%s 는 절대 경로가 아니다',
    (value) => {
      expect(isAbsolutePath(value)).toBe(false)
    }
  )

  it('UNC 는 share 뒤에 경로가 붙어도 절대다 — 루트가 구분자를 먹는다', () => {
    expect(isAbsolutePath('\\\\server\\share')).toBe(true)
    expect(isAbsolutePath('\\\\server\\share\\deep\\path')).toBe(true)
    // 그래도 UNC 안의 빈 세그먼트는 거부한다.
    expect(isAbsolutePath('\\\\server\\share\\\\x')).toBe(false)
  })

  it('빈 세그먼트가 있으면 거부한다', () => {
    expect(isAbsolutePath('/a//b')).toBe(false)
    expect(isAbsolutePath('C:\\a\\\\b')).toBe(false)
  })

  it('NUL 이 섞이면 거부한다', () => {
    expect(isAbsolutePath('/a\0b')).toBe(false)
  })

  // 플랫폼과 무관해야 한다 — 게이트는 Linux 에서도 windows-latest CI 에서도 같은 답을 내야
  // 하고, `path.isAbsolute` 는 그러지 못한다.
  it('실행 플랫폼과 무관하게 판정한다', () => {
    expect(isAbsolutePath('C:\\work')).toBe(true)
    expect(isAbsolutePath('/srv/work')).toBe(true)
  })
})

describe('SendChatMessageSchema.extraDirs', () => {
  it('절대 경로 배열을 통과시킨다', () => {
    expect(send(['/abs/refs']).success).toBe(true)
    expect(send(['/a', 'C:\\b']).success).toBe(true)
  })

  it('상대 경로 원소를 거부한다', () => {
    expect(send(['refs']).success).toBe(false)
    expect(send(['../x']).success).toBe(false)
    expect(send(['/ok', 'relative']).success).toBe(false)
  })

  it('빈 문자열·빈 세그먼트를 거부한다', () => {
    expect(send(['']).success).toBe(false)
    expect(send(['/a//b']).success).toBe(false)
  })

  it('미지정과 빈 배열은 통과한다 — 둘 다 "없음" 이다', () => {
    expect(send(undefined).success).toBe(true)
    expect(send([]).success).toBe(true)
  })
})
