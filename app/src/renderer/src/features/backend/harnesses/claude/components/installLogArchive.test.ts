import { expect, it } from 'vitest'
import { InstallLogArchive } from './installLogArchive'

it('reconstructs output exactly and bounds the visual rows of a long line', () => {
  const archive = new InstallLogArchive()
  const pieces = ['first\npart', 'ial\r\n', 'x'.repeat(159) + '🐬' + '끝'.repeat(65_536), '\nlast']
  for (const piece of pieces) archive.append(piece)
  expect(archive.rows.map((row) => row.text).join('')).toBe(pieces.join(''))
  expect(archive.rows.slice(0, 4)).toEqual([
    { offset: 0, text: 'first\n' },
    { offset: 6, text: 'partial\r\n' },
    { offset: 15, text: 'x'.repeat(159) },
    { offset: 174, text: '🐬' + '끝'.repeat(158) }
  ])
  expect(archive.rows.every((row) => row.text.length <= 160)).toBe(true)
})
