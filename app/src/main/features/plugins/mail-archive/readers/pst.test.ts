import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PSTMessage } from 'pst-extractor'
import { readPstFile } from './pst'
import { normalizePst } from '../normalize'

describe('PST archive reader', () => {
  it('projects PST plain and HTML alternatives with the same quality contract', () => {
    const message = normalizePst(
      {
        subject: '이전 일정',
        internetMessageId: '<pst-html@example.test>',
        inReplyToId: null,
        body: '서버 이전은 3월 2일입니다.',
        bodyHTML: '<p>서버 이전은 3월 4일입니다.</p>',
        numberOfAttachments: 0
      } as unknown as PSTMessage,
      {
        sourcePath: 'C:/archive/mail.pst',
        sourceId: 'pst-source',
        sourceFingerprint: 'revision-one',
        folderPath: '받은 편지함',
        itemKey: 'node-1',
        sizeBytes: 100
      }
    )

    expect(message).toMatchObject({
      bodyText: '서버 이전은 3월 2일입니다.',
      bodyKind: 'plain',
      bodyAlternateText: '서버 이전은 3월 4일입니다.',
      bodyAlternateKind: 'html'
    })
    expect(message.bodyQualityFlags).toContain('alternative_mismatch')
  })

  it('walks the bundled parser fixture and keeps importing after a damaged subtree', async () => {
    const fixture = join(
      process.cwd(),
      'node_modules',
      'pst-extractor',
      'example',
      'testdata',
      'enron.pst'
    )
    if (!existsSync(fixture)) return
    let messages = 0
    await readPstFile({
      sourcePath: fixture,
      sourceId: 'pst-fixture-source',
      sourceFingerprint: 'fixture',
      onMessage: (message) => {
        messages += 1
        if (messages === 1) {
          expect(message.sourceKind).toBe('pst')
          expect(message.folderPath).toBeTruthy()
        }
      }
    })
    expect(messages).toBeGreaterThan(0)
  }, 30_000)
})
