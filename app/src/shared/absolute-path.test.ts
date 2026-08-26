// `extraDirs` 절대 경로 강제 (AC12) — 판정 자체와 IPC 스키마 양쪽.
//
// 이 배열은 0075 workspace 가드의 read/write 루트로 그대로 흘러가므로, 여기가 느슨하면
// 사용자가 지목한 적 없는 폴더가 에이전트에게 열린다.

import { describe, expect, it } from 'vitest'
import { isAbsolutePath, isFilesystemRoot } from './absolute-path'
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

// D-019 — 루트는 모든 경로의 조상이라 가드 루트로 오르면 0075 격리가 no-op 이 된다.
describe('isFilesystemRoot', () => {
  it.each(['/', 'C:\\', 'c:/', '\\\\srv\\share', '\\\\srv\\share\\'])('%s 는 루트다', (value) => {
    expect(isFilesystemRoot(value)).toBe(true)
  })

  it.each(['/a', '/a/b', 'C:\\work', '\\\\srv\\share\\x', '/a/'])(
    '%s 는 루트가 아니다',
    (value) => {
      expect(isFilesystemRoot(value)).toBe(false)
    }
  )

  it('절대 경로가 아니면 루트도 아니다', () => {
    expect(isFilesystemRoot('refs')).toBe(false)
    expect(isFilesystemRoot('')).toBe(false)
  })

  // 텍스트 층의 한계를 명시적으로 잠근다 — 이 별칭들은 `resolveGuardRoots` 가 정규화 후 잡는다.
  it('정규화해야 드러나는 별칭은 텍스트 층에서 잡히지 않는다', () => {
    expect(isFilesystemRoot('/.')).toBe(false)
    expect(isFilesystemRoot('/a/..')).toBe(false)
  })
})

describe('SendChatMessageSchema.extraDirs — 루트 거부 (AC12)', () => {
  it.each(['/', 'C:\\', '\\\\srv\\share'])('%s 를 거부한다', (value) => {
    expect(send([value]).success).toBe(false)
  })

  it('루트가 섞이면 배열 전체가 거부된다', () => {
    expect(send(['/abs/ok', '/']).success).toBe(false)
  })

  it('루트 밑의 실제 폴더는 계속 통과한다 — 범위 정책이 아니다', () => {
    expect(send(['/etc']).success).toBe(true)
    expect(send(['/a/b/c']).success).toBe(true)
  })
})

// D-019 확장 — cwd 는 `writeRoots[0]` 이라 루트면 가드가 판정할 바깥이 아예 없다.
describe('SendChatMessageSchema.cwd — 루트 거부 (AC26)', () => {
  const withCwd = (cwd: unknown): { success: boolean } =>
    SendChatMessageSchema.safeParse({ sessionId: null, projectId: null, text: 'hi', cwd })

  it.each(['/', 'C:\\', '\\\\srv\\share'])('%s 를 거부한다', (value) => {
    expect(withCwd(value).success).toBe(false)
  })

  it('루트 밑의 실제 폴더는 통과한다', () => {
    expect(withCwd('/repo/app').success).toBe(true)
  })

  it('null·미지정은 통과한다 — 프로젝트 파생으로 넘어간다', () => {
    expect(withCwd(null).success).toBe(true)
    expect(withCwd(undefined).success).toBe(true)
  })
})
