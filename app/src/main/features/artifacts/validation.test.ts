import { describe, expect, it } from 'vitest'
import { artifactInput, assertLocalPath, containsPath, classifyFileError } from './validation'

describe('artifact input boundaries', () => {
  it('accepts only supported extensions and bounded trimmed titles', () => {
    expect(artifactInput({ path: 'report.HTM' })).toEqual({
      path: 'report.HTM',
      title: 'report.HTM',
      filename: 'report.HTM',
      kind: 'html'
    })
    expect(artifactInput({ path: 'report.md', title: '  Result  ' }).title).toBe('Result')
    for (const input of [
      { path: 'a.exe' },
      { path: '' },
      { path: 'a.md', title: '' },
      { path: 'a.md', title: 'a'.repeat(161) },
      { path: 'a'.repeat(4097) },
      { path: 'a.md', body: 'no' }
    ]) {
      expect(() => artifactInput(input)).toThrow()
    }
  })
  it('rejects UNC, devices, streams, rooted/drive-relative paths and Windows reserved basenames', () => {
    for (const path of [
      '\\\\host\\share\\a.md',
      '//host/share/a.md',
      '\\\\?\\C:\\a.md',
      'C:a.md',
      'C:\\a.md:stream',
      '\\a.md',
      'NUL.md',
      'aux.html',
      'a\0.md',
      'a.md.'
    ]) {
      expect(() => artifactInput({ path })).toThrow()
    }
    expect(() => assertLocalPath('C:\\work\\a.md')).not.toThrow()
  })
  it('uses path segments rather than a string prefix', () => {
    expect(containsPath('C:\\work\\..notes\\a.md', 'C:\\work')).toBe(true)
    expect(containsPath('C:\\workspace\\a.md', 'C:\\work')).toBe(false)
    expect(containsPath('C:\\work\\..\\a.md', 'C:\\work')).toBe(false)
  })
  it('does not describe access and IO failures as missing', () => {
    expect(classifyFileError({ code: 'ENOENT' })).toEqual({ state: 'missing' })
    expect(classifyFileError({ code: 'ENOTDIR' })).toEqual({ state: 'missing' })
    for (const code of ['EPERM', 'EACCES'])
      expect(classifyFileError({ code })).toEqual({ state: 'unavailable', reason: 'access-denied' })
    expect(classifyFileError(new Error('unsafe-path'))).toEqual({
      state: 'unavailable',
      reason: 'unsafe-path'
    })
    expect(classifyFileError({ code: 'EIO' })).toEqual({ state: 'unavailable', reason: 'io-error' })
  })
})
