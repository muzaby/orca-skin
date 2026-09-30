import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { warmFileSqlite } from '../../../infra/db/warm-file-sqlite'
import { createMailArchiveStore } from './store'
import { fingerprint } from './fingerprint'
import { createMailArchiveService } from './service'
import { readEmlFile } from './readers/eml'
import { archiveMailIdentityKey, archiveSourceId } from './identity'
import type { MailArchiveIndexWorker, MailArchiveWorkerFactory } from './worker-contract'
import type {
  MailArchiveAttachmentExportInput,
  MailArchiveAttachmentExportOutput,
  MailArchiveEmlBatchItem,
  NormalizedArchiveMail
} from './types'

const roots: string[] = []
const services: Array<ReturnType<typeof createMailArchiveService>> = []

beforeAll(warmFileSqlite)
afterEach(async () => {
  for (const service of services.splice(0)) service.close()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

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
    'To: team@example.test',
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

function pstSnapshotMail(
  sourceId: string,
  sourcePath: string,
  sourceFingerprint: string,
  input: { readonly id: string; readonly body: string }
): NormalizedArchiveMail {
  const partial: Omit<NormalizedArchiveMail, 'identityKey'> = {
    sourceKind: 'pst',
    sourceId,
    sourcePath,
    sourceFingerprint,
    itemKey: input.id,
    folderPath: '받은 편지함',
    sentAt: 1_700_000_000_000,
    from: 'sender@example.test',
    to: 'team@example.test',
    cc: '',
    subject: 'PST 누적 이력',
    bodyText: input.body,
    bodyKind: 'plain',
    bodyAlternateText: null,
    bodyAlternateKind: null,
    bodyAlternateOmitted: false,
    bodyQualityFlags: [],
    bodySelectionReason: 'plain_preferred',
    messageId: `<${input.id}@example.test>`,
    inReplyTo: null,
    references: null,
    threadKey: `<${input.id}@example.test>`,
    attachments: [],
    sizeBytes: input.body.length
  }
  return { ...partial, identityKey: archiveMailIdentityKey(partial) }
}

async function preprocessEml(path: string): Promise<MailArchiveEmlBatchItem> {
  const signal = new AbortController().signal
  const normalized = await readEmlFile(
    path,
    archiveSourceId('eml', path),
    await fingerprint(path, signal),
    signal
  )
  const { sourceKind, sourceId, identityKey, ...item } = normalized
  expect(sourceKind).toBe('eml')
  expect(sourceId).toBeTruthy()
  expect(identityKey).toBeTruthy()
  return item
}

function testWorkerFactory(
  root: string,
  hooks: {
    afterBatch?: (path: string, signal: AbortSignal) => Promise<void>
    beforeCommit?: (path: string) => Promise<void>
    onRevoked?: () => void
    parsed?: () => void
    extract?: (
      input: MailArchiveAttachmentExportInput
    ) => Promise<MailArchiveAttachmentExportOutput>
    readPst?: (
      sourcePath: string,
      sourceId: string,
      sourceFingerprint: string
    ) => Promise<NormalizedArchiveMail[]>
  } = {}
): MailArchiveWorkerFactory {
  const store = createMailArchiveStore(root)
  const activeEpochs = new Set<string>()
  const assertEpoch = (epoch: string): void => {
    if (!activeEpochs.has(epoch)) throw new Error('mail_import_epoch_revoked')
  }
  const index: MailArchiveIndexWorker = {
    openEpoch: async (epoch) => {
      activeEpochs.add(epoch)
    },
    revokeEpoch: async (epoch) => {
      activeEpochs.delete(epoch)
      hooks.onRevoked?.()
    },
    beginRevision: async (input) => store.beginRevision(input),
    upsertBatch: async ({ epoch, ...input }) => {
      assertEpoch(epoch)
      await hooks.beforeCommit?.(input.mails[0]?.sourcePath ?? '')
      assertEpoch(epoch)
      return store.upsertBatch(input)
    },
    verifyRevision: async (sourceId, revision, sourceFingerprint, epoch) => {
      assertEpoch(epoch)
      store.verifyRevision(sourceId, revision, sourceFingerprint)
    },
    activateRevision: async (sourceId, revision, sourceFingerprint, epoch) => {
      assertEpoch(epoch)
      store.activateRevision(sourceId, revision, sourceFingerprint)
    },
    abortRevision: async (sourceId, revision, state) =>
      store.abortRevision(sourceId, revision, state),
    search: async (request) => store.search(request),
    get: async (request) => store.get(request.id),
    thread: async (request) => store.thread(request),
    attachmentLocation: async (attachmentId) => store.attachmentLocation(attachmentId),
    sourcePathInUse: async (path) => store.sourcePathInUse(path),
    sources: async () => store.sources(),
    removeSource: async (sourceId) => store.removeSource(sourceId),
    stats: async () => store.stats(),
    close: () => store.close()
  }
  return {
    createIndex: () => index,
    createSource: () => ({
      close: () => undefined,
      extract: async (input) => {
        if (hooks.extract) return hooks.extract(input)
        throw new Error('mail_attachment_export_not_configured')
      },
      run: async (input, callbacks, signal) => {
        signal.throwIfAborted()
        const startFingerprint = await fingerprint(input.sourcePath, signal)
        const decision = await callbacks.onReady(startFingerprint)
        let messages = 0
        let revision: number | null = null
        const skipped = decision.action === 'skip'
        if (decision.action === 'scan') {
          revision = decision.revision
          hooks.parsed?.()
          const sourceMessages =
            input.sourceKind === 'pst' && hooks.readPst
              ? await hooks.readPst(input.sourcePath, input.sourceId, startFingerprint)
              : [await readEmlFile(input.sourcePath, input.sourceId, startFingerprint, signal)]
          for (const message of sourceMessages) {
            signal.throwIfAborted()
            await callbacks.onBatch(revision, [message])
            messages += 1
            await hooks.afterBatch?.(input.sourcePath, signal)
          }
        }
        signal.throwIfAborted()
        const endFingerprint = await fingerprint(input.sourcePath, signal)
        await callbacks.onComplete({
          startFingerprint,
          endFingerprint,
          revision,
          messages,
          skipped
        })
      }
    })
  }
}

describe('mail archive import service', () => {
  it('accepts preprocessed EML without rereading and lets the producer read ahead during index consumption', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-eml-internal-'))
    roots.push(root)
    const firstPath = join(root, 'first.eml')
    const nextPath = join(root, 'next.eml')
    await writeFile(firstPath, rawMail(1))
    await writeFile(nextPath, rawMail(2))
    const first = await preprocessEml(firstPath)
    await rm(firstPath) // The snapshot is authoritative; attachment reads still revalidate later.
    let release!: () => void
    const held = new Promise<void>((r) => {
      release = r
    })
    let enter!: () => void
    const entered = new Promise<void>((r) => {
      enter = r
    })
    let parsed = 0
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        parsed: () => parsed++,
        beforeCommit: async (path) => {
          if (path === firstPath) {
            enter()
            await held
          }
        }
      })
    )
    services.push(service)
    let acknowledged = false
    const consuming = service.importEmlBatch([first]).then((result) => {
      acknowledged = true
      return result
    })
    await entered
    const next = await preprocessEml(nextPath)
    expect(next.bodyText).toContain('본문 2')
    expect(acknowledged).toBe(false)
    expect((await service.stats()).totalMessages).toBe(0)
    await expect(service.importEmlBatch([next])).rejects.toThrow('mail_import_already_running')
    await expect(service.import({ inputKind: 'files', paths: [nextPath] })).rejects.toThrow(
      'mail_import_already_running'
    )
    release()
    expect(await consuming).toMatchObject({ messages: 1, inserted: 1, failures: [] })
    const before = await service.search({ query: '본문 1' })
    expect(await service.importEmlBatch([next])).toMatchObject({ inserted: 1, failures: [] })
    expect(await service.importEmlBatch([first])).toMatchObject({ inserted: 0, skipped: 1 })
    expect(await service.search({ query: '본문 1' })).toEqual(before)
    expect((await service.stats()).emlMessages).toBe(2)
    expect(parsed).toBe(0)
  })

  it.each(['cancel', 'remove', 'close'] as const)(
    'settles internal batch %s during index wait without publishing late data',
    async (action) => {
      const root = await mkdtemp(join(tmpdir(), 'orca-eml-cancel-'))
      roots.push(root)
      const paths = [join(root, 'a.eml'), join(root, 'b.eml')]
      for (const [n, path] of paths.entries()) await writeFile(path, rawMail(n))
      const items = await Promise.all(paths.map(preprocessEml))
      let release!: () => void
      const held = new Promise<void>((r) => {
        release = r
      })
      let enter!: () => void
      const entered = new Promise<void>((r) => {
        enter = r
      })
      let revoke!: () => void
      const revoked = new Promise<void>((r) => {
        revoke = r
      })
      const service = createMailArchiveService(
        root,
        testWorkerFactory(root, {
          beforeCommit: async (path) => {
            if (path === paths[1]) {
              enter()
              await held
            }
          },
          onRevoked: revoke
        })
      )
      services.push(service)
      let jobId = ''
      const consuming = service.importEmlBatch(items, (progress) => {
        jobId = progress.jobId
      })
      await entered
      const removal =
        action === 'remove' ? service.removeSource(archiveSourceId('eml', paths[0]!)) : undefined
      if (action === 'cancel') expect(service.cancel(jobId)).toBe(true)
      if (action === 'close') service.close()
      await revoked
      release()
      expect(await consuming).toMatchObject({ state: 'cancelled', messages: 1, inserted: 1 })
      if (removal) expect(await removal).toMatchObject({ state: 'removed', importCancelled: true })
      const reader =
        action === 'close' ? createMailArchiveService(root, testWorkerFactory(root)) : service
      if (reader !== service) services.push(reader)
      expect(await reader.search({ query: '본문 0' })).toHaveLength(action === 'remove' ? 0 : 1)
      expect(await reader.search({ query: '본문 1' })).toHaveLength(0)
      expect((await reader.stats()).totalMessages).toBe(action === 'remove' ? 0 : 1)
    }
  )

  it('rejects an invalid batch as a whole before creating source revisions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-eml-invalid-'))
    roots.push(root)
    const path = join(root, 'first.eml')
    await writeFile(path, rawMail(1))
    const item = await preprocessEml(path)
    const service = createMailArchiveService(root, testWorkerFactory(root))
    services.push(service)
    await expect(
      service.importEmlBatch([item, { ...item, sourceFingerprint: 'invalid' }])
    ).rejects.toThrow('mail_eml_batch_invalid')
    expect(await service.sources()).toEqual([])
    expect((await service.stats()).totalMessages).toBe(0)
  })

  it('rolls back the entire corrupt PST revision after a stored batch while preserving prior IDs and attachments', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-pst-corrupt-'))
    roots.push(root)
    const path = join(root, 'archive.pst')
    await writeFile(path, 'verified container')
    let corrupt = false
    const factory = testWorkerFactory(root, {
      readPst: async (sourcePath, sourceId, sourceFingerprint) => {
        const mail = pstSnapshotMail(sourceId, sourcePath, sourceFingerprint, {
          id: corrupt ? 'new' : 'old',
          body: corrupt ? '미검증 신규 본문' : '이전 검증 본문'
        })
        const attachments = [{ name: 'report.txt', mimeType: 'text/plain', sizeBytes: 12 }]
        return [
          { ...mail, attachments, identityKey: archiveMailIdentityKey({ ...mail, attachments }) }
        ]
      },
      afterBatch: async () => {
        if (corrupt) throw new Error('mail_pst_folder_read_failed')
      }
    })
    const service = createMailArchiveService(root, factory)
    services.push(service)
    await service.import({ inputKind: 'files', paths: [path] })
    const old = (await service.search({ query: '이전 검증' }))[0]
    const snapshot = await service.get({ id: old.id })
    const oldSources = await service.sources()
    corrupt = true
    await writeFile(path, 'changed and corrupt container')
    expect(await service.import({ inputKind: 'files', paths: [path] })).toMatchObject({
      messages: 0,
      inserted: 0,
      skipped: 0,
      failures: [{ path: 'archive.pst', reason: 'mail_pst_folder_read_failed' }]
    })
    expect(await service.search({ query: '미검증 신규' })).toHaveLength(0)
    expect(await service.get({ id: old.id })).toEqual(snapshot)
    expect(await service.sources()).toEqual(oldSources)
    service.close()
    const restarted = createMailArchiveService(root, testWorkerFactory(root))
    services.push(restarted)
    expect(await restarted.get({ id: old.id })).toEqual(snapshot)
    expect((await restarted.stats()).totalMessages).toBe(1)
    expect(await restarted.search({ query: '미검증 신규' })).toHaveLength(0)
  })
  it('skips an unchanged source without reparsing and preserves changed contents as archive history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-service-'))
    roots.push(root)
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    let parsed = 0
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, { parsed: () => parsed++ })
    )
    services.push(service)

    const first = await service.import({ inputKind: 'files', paths: [path] })
    const duplicate = await service.import({ inputKind: 'files', paths: [path] })
    expect(first).toMatchObject({ messages: 1, inserted: 1, skipped: 0, failures: [] })
    expect(duplicate).toMatchObject({ messages: 1, inserted: 0, skipped: 1, failures: [] })
    expect(parsed).toBe(1)

    await writeFile(path, rawMail(2))
    const changed = await service.import({ inputKind: 'files', paths: [path] })
    expect(changed).toMatchObject({ messages: 1, inserted: 1, skipped: 0 })
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '본문 2', limit: 10 })).toHaveLength(1)
    expect(await service.stats()).toMatchObject({ totalMessages: 2, emlMessages: 2 })
  })

  it('keeps the last verified revision when the source changes during parsing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-revision-'))
    roots.push(root)
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    const service = createMailArchiveService(root, testWorkerFactory(root))
    services.push(service)
    await service.import({ inputKind: 'files', paths: [path] })

    await writeFile(path, rawMail(2))
    let changedOnce = false
    const serviceWithMutation = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        afterBatch: async (sourcePath) => {
          if (changedOnce) return
          changedOnce = true
          await writeFile(sourcePath, rawMail(3))
        }
      })
    )
    services.push(serviceWithMutation)
    const failed = await serviceWithMutation.import({ inputKind: 'files', paths: [path] })

    expect(failed.failures).toEqual([
      { path: 'mail.eml', reason: 'mail_source_changed_during_import' }
    ])
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '본문 2', limit: 10 })).toHaveLength(0)
    expect(await service.stats()).toMatchObject({ totalMessages: 1, emlMessages: 1 })
  })

  it('reuses PST mail across full-file revisions and counts edited Message-ID payloads separately', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-pst-revisions-'))
    roots.push(root)
    const path = join(root, 'archive.pst')
    const writeSnapshot = async (mails: Array<{ id: string; body: string }>): Promise<void> =>
      writeFile(path, JSON.stringify({ mails }))
    await writeSnapshot([{ id: 'mail-a', body: '기존 본문 승인' }])
    let parsed = 0
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        parsed: () => parsed++,
        readPst: async (sourcePath, sourceId, sourceFingerprint) => {
          const snapshot = JSON.parse(await readFile(sourcePath, 'utf8')) as {
            mails: Array<{ id: string; body: string }>
          }
          return snapshot.mails.map((mail) =>
            pstSnapshotMail(sourceId, sourcePath, sourceFingerprint, mail)
          )
        }
      })
    )
    services.push(service)

    const first = await service.import({ inputKind: 'files', paths: [path] })
    const unchanged = await service.import({ inputKind: 'files', paths: [path] })
    expect(first).toMatchObject({ messages: 1, inserted: 1, skipped: 0, failures: [] })
    expect(unchanged).toMatchObject({ messages: 1, inserted: 0, skipped: 1, failures: [] })
    expect(parsed).toBe(1)

    await writeSnapshot([
      { id: 'mail-a', body: '기존 본문 승인' },
      { id: 'mail-b', body: '새 메일 추가' }
    ])
    const appended = await service.import({ inputKind: 'files', paths: [path] })
    expect(appended).toMatchObject({ messages: 2, inserted: 1, skipped: 1 })

    await writeSnapshot([
      { id: 'mail-a', body: '수정 본문 승인' },
      { id: 'mail-b', body: '새 메일 추가' }
    ])
    const edited = await service.import({ inputKind: 'files', paths: [path] })
    expect(edited).toMatchObject({ messages: 2, inserted: 1, skipped: 1 })
    expect(await service.search({ query: '기존 본문', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '수정 본문', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '새 메일', limit: 10 })).toHaveLength(1)
    expect(await service.stats()).toMatchObject({ totalMessages: 3, pstMessages: 3 })
  })

  it('keeps completed EML files and exposes a snapshot when cancellation happens in the next file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-batch-'))
    roots.push(root)
    const folder = join(root, 'eml')
    await mkdir(folder)
    await Promise.all(
      [1, 2, 3].map((index) => writeFile(join(folder, `${index}.eml`), rawMail(index)))
    )
    let jobId = ''
    let batches = 0
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        afterBatch: async () => {
          batches += 1
          if (batches === 2) {
            const snapshot = await service.stats()
            expect(snapshot.progress?.processedFiles).toBe(1)
            expect(service.cancel(jobId)).toBe(true)
          }
        }
      })
    )
    services.push(service)
    const result = await service.import(
      { inputKind: 'eml-folder', paths: [folder] },
      (progress) => {
        jobId = progress.jobId
      }
    )
    expect(result.state).toBe('cancelled')
    expect(result.messages).toBe(1)
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(1)
    expect(await service.search({ query: '본문 2', limit: 10 })).toHaveLength(0)
    expect((await service.stats()).lastImport).toEqual(result)
  })

  it('does not promote a staged file when its import epoch is cancelled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-cancel-'))
    roots.push(root)
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    let jobId = ''
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        afterBatch: () => {
          expect(service.cancel(jobId)).toBe(true)
          return Promise.resolve()
        }
      })
    )
    services.push(service)
    const result = await service.import({ inputKind: 'files', paths: [path] }, (progress) => {
      jobId = progress.jobId
    })
    expect(result.state).toBe('cancelled')
    expect(await service.search({ query: '본문 1', limit: 10 })).toHaveLength(0)
    expect(await service.stats()).toMatchObject({ totalMessages: 0 })
  })

  it('revokes an in-flight import before removing a source and cannot restore deleted mail', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-remove-source-'))
    roots.push(root)
    const path = join(root, 'mail.eml')
    await writeFile(path, rawMail(1))
    const service = createMailArchiveService(root, testWorkerFactory(root))
    services.push(service)
    await service.import({ inputKind: 'files', paths: [path] })

    await writeFile(path, rawMail(2))
    let entered!: () => void
    const batchEntered = new Promise<void>((resolve) => {
      entered = resolve
    })
    let release!: () => void
    const holdBatch = new Promise<void>((resolve) => {
      release = resolve
    })
    const concurrentService = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        afterBatch: async (_sourcePath, signal) => {
          entered()
          await Promise.race([
            holdBatch,
            new Promise<void>((resolve) =>
              signal.addEventListener('abort', () => resolve(), { once: true })
            )
          ])
        }
      })
    )
    services.push(concurrentService)

    const importing = concurrentService.import({ inputKind: 'files', paths: [path] })
    await batchEntered
    const removed = await concurrentService.removeSource(archiveSourceId('eml', path))
    release()
    const importResult = await importing

    expect(importResult.state).toBe('cancelled')
    expect(removed).toMatchObject({
      state: 'removed',
      removedMessages: 1,
      preservedMessages: 0,
      importCancelled: true
    })
    expect(await concurrentService.search({ query: '본문 1', limit: 10 })).toHaveLength(0)
    expect(await concurrentService.search({ query: '본문 2', limit: 10 })).toHaveLength(0)
    expect(await concurrentService.sources()).toHaveLength(0)
  })

  it('does not cancel an unrelated import when removing another source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-unrelated-'))
    roots.push(root)
    const firstPath = join(root, 'first.eml')
    const secondPath = join(root, 'second.eml')
    await writeFile(firstPath, rawMail(1))
    await writeFile(secondPath, rawMail(2))
    let removeDuringBatch = false
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        afterBatch: async () => {
          if (!removeDuringBatch) return
          expect(await service.removeSource(archiveSourceId('eml', firstPath))).toMatchObject({
            state: 'removed',
            importCancelled: false
          })
        }
      })
    )
    services.push(service)
    await service.import({ inputKind: 'files', paths: [firstPath] })
    removeDuringBatch = true
    expect(await service.import({ inputKind: 'files', paths: [secondPath] })).toMatchObject({
      state: 'completed',
      inserted: 1,
      failures: []
    })
    expect(await service.search({ query: '본문 2' })).toHaveLength(1)
    expect(await service.search({ query: '본문 1' })).toHaveLength(0)
  })

  it('exports only a picked attachment and removal waits for an in-flight export', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-export-service-'))
    roots.push(root)
    const sourcePath = join(root, 'mail.eml')
    const destinationPath = join(root, 'saved-attachment.txt')
    await writeFile(sourcePath, rawMailWithAttachment())
    let entered!: () => void
    const exportEntered = new Promise<void>((resolve) => {
      entered = resolve
    })
    let release!: () => void
    const holdExport = new Promise<void>((resolve) => {
      release = resolve
    })
    const service = createMailArchiveService(
      root,
      testWorkerFactory(root, {
        extract: async (input) => {
          entered()
          await holdExport
          const temporaryPath = join(root, '.selected.orca-part')
          await writeFile(temporaryPath, Buffer.alloc(input.sizeBytes, 0x61))
          return { temporaryPath, bytesWritten: input.sizeBytes }
        }
      })
    )
    services.push(service)
    await service.import({ inputKind: 'files', paths: [sourcePath] })
    const hit = (await service.search({ query: 'export-me.txt', limit: 10 }))[0]!
    const message = await service.get({ id: hit.id })
    const attachment = message!.attachments[0]!

    await expect(service.exportAttachment(attachment.id, async () => sourcePath)).rejects.toThrow(
      'mail_attachment_destination_is_source'
    )

    const exporting = service.exportAttachment(attachment.id, async () => destinationPath)
    await exportEntered
    let removed = false
    const removing = service.removeSource(archiveSourceId('eml', sourcePath)).then((result) => {
      removed = true
      return result
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(removed).toBe(false)

    release()
    await expect(exporting).resolves.toMatchObject({
      state: 'exported',
      name: 'export-me.txt',
      sizeBytes: attachment.sizeBytes
    })
    expect(await readFile(destinationPath)).toEqual(Buffer.alloc(attachment.sizeBytes, 0x61))
    await expect(removing).resolves.toMatchObject({ state: 'removed', removedMessages: 1 })
    expect(await service.get({ id: hit.id })).toBeNull()
  })
})
