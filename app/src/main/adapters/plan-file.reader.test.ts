// 실제 reader 함수를 fs 포트에서 관측한다: stat 뒤 성장에도 bounded read, 열린 핸들 정리.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'

const { lstatMock, openMock, realpathMock, handle, stat } = vi.hoisted(() => {
  const stat = { isFile: () => true, isSymbolicLink: () => false, size: 1, ino: 1, dev: 1 }
  const handle = { stat: vi.fn(), read: vi.fn(), close: vi.fn() }
  return { stat, handle, lstatMock: vi.fn(), openMock: vi.fn(), realpathMock: vi.fn() }
})
vi.mock('node:fs/promises', () => ({ lstat: lstatMock, open: openMock, realpath: realpathMock }))

import { nodePlanFileReader } from './plan-file'

const filePath = path.resolve('plans/a.md')
beforeEach(() => {
  vi.resetAllMocks()
  lstatMock.mockResolvedValue(stat)
  openMock.mockResolvedValue(handle)
  handle.stat.mockResolvedValue(stat)
  realpathMock.mockResolvedValue(filePath)
  handle.close.mockResolvedValue(undefined)
})

describe('0249 VP-12 — bounded reader와 핸들 정리', () => {
  it('stat 뒤 성장해도 상한 + 초과 probe 1바이트만 읽고 반환을 거부한다', async () => {
    handle.read.mockImplementation(async (bytes: Buffer, offset: number, length: number) => {
      bytes.fill('x', offset, offset + length)
      return { bytesRead: length }
    })
    expect(await nodePlanFileReader(4)(filePath)).toBeNull()
    expect(handle.read).toHaveBeenCalledExactlyOnceWith(expect.any(Buffer), 0, 5, 0)
    expect(handle.close).toHaveBeenCalledTimes(1)
  })

  it('짧은 read를 끝까지 누적하고 성공 경로도 핸들을 닫는다', async () => {
    handle.read.mockImplementation(
      async (bytes: Buffer, offset: number, _length: number, position: number) => {
        const remaining = Buffer.from('plan').subarray(position, position + 2)
        remaining.copy(bytes, offset)
        return { bytesRead: remaining.length }
      }
    )
    expect(await nodePlanFileReader(4)(filePath)).toBe('plan')
    expect(handle.read).toHaveBeenCalledTimes(3)
    expect(handle.close).toHaveBeenCalledTimes(1)
  })

  it.each([
    'stat reject',
    'not file',
    'oversized',
    'different inode',
    'realpath reject',
    'linked parent',
    'read reject'
  ])('%s 후 null을 반환하고 이미 연 핸들은 닫는다', async (failure) => {
    if (failure === 'stat reject') handle.stat.mockRejectedValue(new Error('stat failed'))
    if (failure === 'not file') handle.stat.mockResolvedValue({ ...stat, isFile: () => false })
    if (failure === 'oversized') handle.stat.mockResolvedValue({ ...stat, size: 5 })
    if (failure === 'different inode') handle.stat.mockResolvedValue({ ...stat, ino: 2 })
    if (failure === 'realpath reject') realpathMock.mockRejectedValue(new Error('realpath failed'))
    if (failure === 'linked parent') realpathMock.mockResolvedValue(path.resolve('outside/a.md'))
    if (failure === 'read reject') handle.read.mockRejectedValue(new Error('read failed'))
    expect(await nodePlanFileReader(4)(filePath)).toBeNull()
    expect(handle.close).toHaveBeenCalledTimes(1)
    if (failure !== 'read reject') expect(handle.read).not.toHaveBeenCalled()
  })
})
