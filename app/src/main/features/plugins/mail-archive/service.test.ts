import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { warmFileSqlite } from '../../../infra/db/warm-file-sqlite'
import { archiveMailIdentityKey, archiveSourceId } from './identity'
import { createIndexOperations, inProcessIndex } from './index-operations'
import type { readPstFile } from './readers/pst'
import { createMailArchiveService, type MailArchiveService } from './service'
import { runSourceJob } from './source-job'
import { createMailArchiveStore } from './store'
import type {
  MailArchiveAttachmentExportInput,
  MailArchiveAttachmentExportOutput,
  NormalizedArchiveMail
} from './types'

const roots: string[] = []
const services: MailArchiveService[] = []

beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const service of services.splice(0)) service.close()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function tempRoot(prefix: string): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  roots.push(root)
  return root
}

function rawMail(index: number): string {
  return [
    'From: sender@example.test',
    'To: team@example.test',
    `Subject: 서버 이전 ${index}`,
    `Message-ID: <batch-${index}@example.test>`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    `이전 작업 본문 ${index}`,
    ''
  ].join('\r\n')
}

function rawMailWithAttachment(): string {
  return [
    'From: sender@example.test',
    'Subject: 첨부 선택 추출',
    'Message-ID: <attachment-export@example.test>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="archive-export"',
    '',
    '--archive-export',
    'Content-Type: text/plain; charset=utf-8',
    '',
    '메일 본문 검색에는 첨부 내용이 없습니다.',
    '--archive-export',
    'Content-Type: text/plain; name="export-me.txt"',
    'Content-Disposition: attachment; filename="export-me.txt"',
    '',
    'only-the-selected-file',
    '--archive-export--',
    ''
  ].join('\r\n')
}

/** PST 대신 쓰는 JSON 스냅샷. 지문·batch·검증 경로는 실제 source job을 그대로 탄다. */
function snapshotReader(onRead?: (path: string) => Promise<void>): typeof readPstFile {
  return async (options) => {
    const snapshot = JSON.parse(await readFile(options.sourcePath, 'utf8')) as {
      mails: Array<{ id: string; body: string }>
      unreadableFolders?: string[]
    }
    for (const item of snapshot.mails) {
      const partial: Omit<NormalizedArchiveMail, 'identityKey'> = {
        sourceId: options.sourceId,
        itemKey: item.id,
        folderPath: '받은 편지함',
        sentAt: 1_700_000_000_000,
        from: 'sender@example.test',
        to: 'team@example.test',
        cc: '',
        subject: 'PST 누적 이력',
        bodyText: item.body,
        bodyKind: 'plain',
        bodyAlternateText: null,
        bodyAlternateKind: null,
        bodyAlternateOmitted: false,
        bodyQualityFlags: [],
        bodySelectionReason: 'plain_preferred',
        messageId: `<${item.id}@example.test>`,
        inReplyTo: null,
        references: null,
        attachments: []
      }
      await options.onMessage({ ...partial, identityKey: archiveMailIdentityKey(partial) })
    }
    await onRead?.(options.sourcePath)
    return {
      messages: snapshot.mails.length,
      unreadableFolders: snapshot.unreadableFolders ?? [],
      unreadableMessages: 0
    }
  }
}

/** 프로세스 경계만 빼고 실제 index 연산·store·source job을 쓰는 서비스. */
function archiveService(
  root: string,
  hooks: {
    afterBatch?: (signal: AbortSignal) => Promise<void>
    readPst?: typeof readPstFile
    extract?: (
      input: MailArchiveAttachmentExportInput
    ) => Promise<MailArchiveAttachmentExportOutput>
  } = {}
): MailArchiveService {
  const service = createMailArchiveService({
    index: inProcessIndex(createIndexOperations(() => createMailArchiveStore(root))),
    source: {
      run: (input, channel, signal) =>
        runSourceJob(
          input,
          {
            ready: channel.ready,
            batch: async (revision, mails) => {
              await channel.batch(revision, mails)
              await hooks.afterBatch?.(signal)
            }
          },
          signal,
          hooks.readPst
        ),
      extract: (input) =>
        hooks.extract?.(input) ??
        Promise.reject(new Error('mail_attachment_export_not_configured')),
      dispose: () => undefined
    }
  })
  services.push(service)
  return service
}

function hold(): {
  entered: Promise<void>
  enter(): void
  release(): void
  released: Promise<void>
} {
  let enter!: () => void
  let release!: () => void
  return {
    entered: new Promise<void>((resolve) => (enter = resolve)),
    released: new Promise<void>((resolve) => (release = resolve)),
    enter: () => enter(),
    release: () => release()
  }
}

describe('mail archive import service', () => {
  it('skips an unchanged EML and keeps the earlier version when the file changes', async () => {
    const root = await tempRoot('orca-mail-archive-service-')
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    const service = archiveService(root)

    expect(await service.import({ inputKind: 'files', paths: [path] })).toMatchObject({
      messages: 1,
      inserted: 1,
      skipped: 0,
      failures: []
    })
    expect(await service.import({ inputKind: 'files', paths: [path] })).toMatchObject({
      messages: 1,
      inserted: 0,
      skipped: 1
    })

    await writeFile(path, rawMail(2))
    expect(await service.import({ inputKind: 'files', paths: [path] })).toMatchObject({
      inserted: 1
    })
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '본문 2', limit: 10 })).toHaveLength(1)
    expect(await service.sources()).toHaveLength(1)
  })

  it('accumulates PST revisions, reports unreadable folders, and rejects a PST that changes while read', async () => {
    const root = await tempRoot('orca-mail-archive-pst-')
    const path = join(root, 'archive.pst')
    const snapshot = (
      mails: Array<{ id: string; body: string }>,
      unreadableFolders?: string[]
    ): Promise<void> => writeFile(path, JSON.stringify({ mails, unreadableFolders }))
    await snapshot([{ id: 'mail-a', body: '기존 본문 승인' }])
    const service = archiveService(root, { readPst: snapshotReader() })

    expect(await service.import({ inputKind: 'files', paths: [path] })).toMatchObject({
      inserted: 1
    })
    await snapshot(
      [
        { id: 'mail-a', body: '수정 본문 승인' },
        { id: 'mail-b', body: '새 메일 추가' }
      ],
      ['손상 폴더']
    )
    const edited = await service.import({ inputKind: 'files', paths: [path] })
    expect(edited).toMatchObject({
      messages: 2,
      inserted: 2,
      failures: [{ path: 'archive.pst', reason: 'mail_pst_folders_unreadable:1' }]
    })
    expect(await service.search({ query: '기존 본문', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '수정 본문', limit: 10 })).toHaveLength(1)

    await snapshot([{ id: 'mail-c', body: '변경 중 메일' }])
    const changing = archiveService(root, {
      readPst: snapshotReader(async (sourcePath) => writeFile(sourcePath, '{"mails":[]}'))
    })
    service.close()
    const result = await changing.import({ inputKind: 'files', paths: [path] })
    expect(result.failures).toEqual([
      { path: 'archive.pst', reason: 'mail_source_changed_during_import' }
    ])
    expect(await changing.search({ query: '변경 중', limit: 10 })).toHaveLength(0)
    expect(await changing.stats()).toMatchObject({ totalMessages: 3, pstMessages: 3 })
  })

  it('imports an EML folder as one source and keeps completed files when cancelled between files', async () => {
    const root = await tempRoot('orca-mail-archive-batch-')
    const folder = join(root, 'eml')
    await mkdir(folder)
    await Promise.all(
      [1, 2, 3].map((index) => writeFile(join(folder, `${index}.eml`), rawMail(index)))
    )
    const service = archiveService(root)
    let cancelled = false
    const result = await service.import(
      { inputKind: 'eml-folder', paths: [folder] },
      (progress) => {
        if (!cancelled && progress.processedFiles >= 1) cancelled = service.cancel(progress.jobId)
      }
    )

    expect(cancelled).toBe(true)
    expect(result).toMatchObject({ state: 'cancelled', messages: 1 })
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '본문 2', limit: 10 })).toHaveLength(0)
    expect(await service.sources()).toEqual([
      expect.objectContaining({ kind: 'eml', name: 'eml', messageCount: 1 })
    ])
    expect(service.progress()).toBeNull()
  })

  it('does not promote a staged file when its import epoch is cancelled', async () => {
    const root = await tempRoot('orca-mail-archive-cancel-')
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    const service = archiveService(root)
    let cancelled = false
    const result = await service.import({ inputKind: 'files', paths: [path] }, (progress) => {
      if (!cancelled && progress.processedMessages >= 1) cancelled = service.cancel(progress.jobId)
    })

    expect(cancelled).toBe(true)
    expect(result.state).toBe('cancelled')
    expect(await service.stats()).toMatchObject({ totalMessages: 0 })
  })

  it('cancels only the import of the source being removed', async () => {
    const root = await tempRoot('orca-mail-archive-remove-')
    const path = join(root, 'mail.eml')
    const other = join(root, 'other.eml')
    await writeFile(path, rawMail(1))
    await writeFile(other, rawMail(9))
    const gate = hold()
    const service = archiveService(root, {
      afterBatch: async (signal) => {
        gate.enter()
        await Promise.race([
          gate.released,
          new Promise<void>((resolve) =>
            signal.addEventListener('abort', () => resolve(), { once: true })
          )
        ])
      }
    })

    // 다른 자료원을 제거해도 진행 중인 가져오기는 계속된다.
    await writeFile(join(root, 'seed.eml'), rawMail(5))
    gate.release()
    await service.import({ inputKind: 'files', paths: [join(root, 'seed.eml')] })
    const second = hold()
    const concurrent = archiveService(root, {
      afterBatch: async (signal) => {
        second.enter()
        await Promise.race([
          second.released,
          new Promise<void>((resolve) =>
            signal.addEventListener('abort', () => resolve(), { once: true })
          )
        ])
      }
    })
    service.close()
    const importing = concurrent.import({ inputKind: 'files', paths: [path] })
    await second.entered
    const unrelated = await concurrent.removeSource(archiveSourceId('eml', join(root, 'seed.eml')))
    expect(unrelated).toMatchObject({ state: 'removed', importCancelled: false })
    second.release()
    expect(await importing).toMatchObject({ state: 'completed', inserted: 1 })

    // 가져오는 중인 자료원을 제거하면 그 작업을 폐기하고, 늦은 결과가 메일을 되살리지 못한다.
    await writeFile(path, rawMail(2))
    const third = hold()
    const racing = archiveService(root, {
      afterBatch: async (signal) => {
        third.enter()
        await new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true })
        )
      }
    })
    concurrent.close()
    const cancelling = racing.import({ inputKind: 'files', paths: [path] })
    await third.entered
    const removed = await racing.removeSource(archiveSourceId('eml', path))
    expect(await cancelling).toMatchObject({ state: 'cancelled' })
    expect(removed).toMatchObject({ state: 'removed', removedMessages: 1, importCancelled: true })
    expect(await racing.search({ query: '본문 2', limit: 10 })).toHaveLength(0)
    expect(await racing.sources()).toHaveLength(0)
  })

  it('exports only a picked attachment and removal waits for an in-flight export', async () => {
    const root = await tempRoot('orca-mail-archive-export-')
    const sourcePath = join(root, 'mail.eml')
    const destinationPath = join(root, 'saved-attachment.txt')
    await writeFile(sourcePath, rawMailWithAttachment())
    const gate = hold()
    const service = archiveService(root, {
      extract: async (input) => {
        gate.enter()
        await gate.released
        const temporaryPath = join(root, '.selected.orca-part')
        await writeFile(temporaryPath, Buffer.alloc(input.sizeBytes, 0x61))
        return { temporaryPath, bytesWritten: input.sizeBytes }
      }
    })
    await service.import({ inputKind: 'files', paths: [sourcePath] })
    const hit = (await service.search({ query: 'export-me.txt', limit: 10 }))[0]!
    const attachment = (await service.get(hit.id))!.attachments[0]!

    await expect(service.exportAttachment(attachment.id, async () => sourcePath)).rejects.toThrow(
      'mail_attachment_destination_is_source'
    )

    const exporting = service.exportAttachment(attachment.id, async () => destinationPath)
    await gate.entered
    let removed = false
    const removing = service.removeSource(archiveSourceId('eml', sourcePath)).then((result) => {
      removed = true
      return result
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(removed).toBe(false)

    gate.release()
    await expect(exporting).resolves.toMatchObject({ state: 'exported', name: 'export-me.txt' })
    expect(await readFile(destinationPath)).toEqual(Buffer.alloc(attachment.sizeBytes, 0x61))
    await expect(removing).resolves.toMatchObject({ state: 'removed', removedMessages: 1 })
    expect(await service.get(hit.id)).toBeNull()
  })
})
