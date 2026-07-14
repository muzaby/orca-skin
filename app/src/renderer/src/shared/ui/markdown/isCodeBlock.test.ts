import { describe, it, expect } from 'vitest'
import { isCodeBlock } from './isCodeBlock'

describe('isCodeBlock', () => {
  it('언어 있는 펜스 → 블록', () => {
    expect(isCodeBlock('language-ts', 'const a = 1\n')).toBe(true)
  })

  it('언어 없는 다중행 펜스(트리 구조) → 블록', () => {
    // ``` 뒤 언어 없이 트리를 출력한 경우 — 회귀 대상 버그.
    expect(isCodeBlock(undefined, 'root\n├── a\n└── b\n')).toBe(true)
  })

  it('언어 없는 단일행 펜스(후행 개행) → 블록', () => {
    // mdast→hast 가 블록 코드에 후행 개행을 부착한다.
    expect(isCodeBlock(undefined, 'plain line\n')).toBe(true)
  })

  it('개행 없는 인라인 코드 → 인라인', () => {
    expect(isCodeBlock(undefined, 'inlineCode')).toBe(false)
  })

  it('빈 문자열·언어 없음 → 인라인', () => {
    expect(isCodeBlock(undefined, '')).toBe(false)
  })
})
