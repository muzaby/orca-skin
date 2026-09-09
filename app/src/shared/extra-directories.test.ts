import { describe, expect, it } from 'vitest'
import {
  directoryIdentity,
  parseStoredExtraDirectories,
  sameExtraDirectories
} from './extra-directories'

describe('extra directory identity and persisted parsing', () => {
  it('normalizes Windows case/separators while retaining POSIX case', () => {
    expect(directoryIdentity('C:\\Reference\\')).toBe(directoryIdentity('c:/reference'))
    expect(directoryIdentity('/Reference')).not.toBe(directoryIdentity('/reference'))
  })
  it('uses set identity for same scope and detects scope growth', () => {
    expect(sameExtraDirectories(['C:/A', 'C:/B'], ['c:\\b', 'c:/a', 'C:/A'])).toBe(true)
    expect(sameExtraDirectories(['C:/A'], ['C:/A', 'C:/B'])).toBe(false)
    expect(sameExtraDirectories()).toBe(true)
  })
  it('rejects malformed, relative and root stored paths', () => {
    expect(parseStoredExtraDirectories('invalid')).toEqual([])
    expect(parseStoredExtraDirectories(JSON.stringify(['C:/ok', 'relative', 'C:/', 3]))).toEqual([
      'C:/ok'
    ])
  })
})
