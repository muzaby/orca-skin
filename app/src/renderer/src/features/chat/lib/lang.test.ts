import { describe, it, expect } from 'vitest'
import { extToLang, stripLineNumberGutter } from './lang'

describe('extToLang', () => {
  it('확장자를 shiki 언어로 매핑', () => {
    expect(extToLang('/a/b/hello.py')).toBe('python')
    expect(extToLang('C:\\x\\index.ts')).toBe('typescript')
    expect(extToLang('app.tsx')).toBe('tsx')
    expect(extToLang('data.yml')).toBe('yaml')
    expect(extToLang('run.sh')).toBe('bash')
  })

  it('미지원/무확장자는 undefined', () => {
    expect(extToLang('Makefile')).toBeUndefined()
    expect(extToLang('image.png')).toBeUndefined()
  })
})

describe('stripLineNumberGutter', () => {
  it('모든 줄이 cat -n 형태면 프리픽스 제거', () => {
    expect(stripLineNumberGutter('   1\tfoo\n   2\tbar')).toBe('foo\nbar')
    expect(stripLineNumberGutter('1→a\n2→b')).toBe('a\nb')
  })

  it('일부만 매칭하면 원본 유지', () => {
    const t = '   1\tfoo\nplain line'
    expect(stripLineNumberGutter(t)).toBe(t)
  })

  it('거터 없는 코드는 그대로', () => {
    const t = 'def f():\n    return 1'
    expect(stripLineNumberGutter(t)).toBe(t)
  })
})
