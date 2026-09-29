import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PSTMessage } from 'pst-extractor'
import { readPstFile, walkPstMessages, type PstFolderLike, type PstWalkReport } from './pst'
import { normalizePst } from '../normalize'

function item(id: number, messageClass: string): unknown {
  return { descriptorNodeId: { toString: () => String(id) }, messageClass }
}

function folder(
  name: string,
  children: readonly unknown[],
  subfolders?: () => PstFolderLike[]
): PstFolderLike {
  let cursor = 0
  return {
    displayName: name,
    hasSubfolders: subfolders !== undefined,
    // 목차가 손상된 폴더에서 라이브러리는 emailCount=-1을 내지만 getNextChild()로는 읽힌다.
    emailCount: -1,
    getNextChild: () => children[cursor++] ?? null,
    getSubFolders: subfolders ?? (() => [])
  } as PstFolderLike
}

describe('PST archive reader', () => {
  it('projects PST plain and HTML alternatives, recipients, and transport References', () => {
    const message = normalizePst(
      {
        subject: '이전 일정',
        internetMessageId: '<pst-html@example.test>',
        inReplyToId: '',
        transportMessageHeaders:
          'Subject: 이전 일정\r\nReferences: <root@example.test>\r\n <parent@example.test>\r\nX-Other: 1\r\n',
        senderName: '김철수',
        senderEmailAddress: '/O=EXCHANGELABS/OU=EXCHANGE/CN=RECIPIENTS/CN=KIM',
        numberOfRecipients: 2,
        getRecipient: (index: number) =>
          index === 0
            ? { recipientType: 1, displayName: 'Lee', smtpAddress: 'lee@example.test' }
            : { recipientType: 2, displayName: 'Park', emailAddress: 'park@example.test' },
        clientSubmitTime: new Date(1_700_000_000_000),
        messageDeliveryTime: new Date(1_700_000_500_000),
        body: '서버 이전은 3월 2일입니다.',
        bodyHTML: '<p>서버 이전은 3월 4일입니다.</p>',
        numberOfAttachments: 0
      } as unknown as PSTMessage,
      { sourceId: 'pst-source', folderPath: '받은 편지함', itemKey: 'node-1' }
    )

    expect(message).toMatchObject({
      from: '김철수',
      to: 'Lee <lee@example.test>',
      cc: 'Park <park@example.test>',
      sentAt: 1_700_000_000_000,
      references: '<root@example.test> <parent@example.test>',
      bodyText: '서버 이전은 3월 2일입니다.',
      bodyKind: 'plain',
      bodyAlternateText: '서버 이전은 3월 4일입니다.',
      bodyAlternateKind: 'html'
    })
    expect(message.bodyQualityFlags).toContain('alternative_mismatch')
  })

  it('reads folders whose contents table fell back, keeps only mail, and reports unreadable subtrees', () => {
    const root = folder(
      '',
      [
        item(1, 'IPM.Note'),
        item(2, 'IPM.Appointment'),
        item(3, 'IPM.Contact'),
        item(4, 'REPORT.IPM.Note.NDR')
      ],
      () => [
        folder('받은 편지함', [item(5, 'IPM.Note.SMIME.MultipartSigned'), item(6, 'IPM.Task')]),
        folder('손상', [], () => {
          throw new Error('bad subfolder table')
        })
      ]
    )
    const report: PstWalkReport = { unreadableFolders: [], unreadableMessages: 0 }
    const found = [...walkPstMessages(root, report)].map(({ message, folderPath }) => [
      message.descriptorNodeId.toString(),
      folderPath
    ])

    expect(found).toEqual([
      ['1', ''],
      ['4', ''],
      ['5', '받은 편지함']
    ])
    expect(report.unreadableFolders).toEqual(['손상 (하위 폴더)'])
  })

  it('walks the bundled parser fixture', async () => {
    const fixture = join(
      process.cwd(),
      'node_modules',
      'pst-extractor',
      'example',
      'testdata',
      'enron.pst'
    )
    if (!existsSync(fixture)) return
    const folders = new Set<string | null>()
    const result = await readPstFile({
      sourcePath: fixture,
      sourceId: 'pst-fixture-source',
      onMessage: (message) => void folders.add(message.folderPath)
    })
    expect(result.messages).toBeGreaterThan(0)
    expect(result.unreadableFolders).toEqual([])
    expect([...folders].every(Boolean)).toBe(true)
  }, 30_000)
})
