import { app, utilityProcess, type UtilityProcess } from 'electron'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createMailArchiveWorkerFactory } from '../../src/main/features/plugins/mail-archive/worker-host'
import { createMailArchiveService } from '../../src/main/features/plugins/mail-archive/service'

async function main(): Promise<void> {
  await app.whenReady()
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-workers-'))
  const children = new Set<UtilityProcess>()
  const sourcePids = new Set<UtilityProcess>()
  let indexChild: UtilityProcess | undefined
  let sourceChild: UtilityProcess | undefined
  let cancelOnBatch: (() => void) | undefined
  const workers = createMailArchiveWorkerFactory({
    fork: (path, serviceName) => {
      const child = utilityProcess.fork(path, [], { serviceName, stdio: 'pipe' })
      children.add(child)
      child.on('exit', () => children.delete(child))
      child.stderr?.on('data', (data) => process.stderr.write(data))
      child.on('message', (message) => {
        if (message?.type === 'batch') cancelOnBatch?.()
      })
      if (serviceName.endsWith('Index')) indexChild = child
      if (serviceName.endsWith('Source')) {
        sourceChild = child
        sourcePids.add(child)
      }
      return child
    }
  })
  const service = createMailArchiveService(root, workers)
  let passed = 0
  function pass(label: string): void {
    passed++
    console.log(`PASS ${label}`)
  }

  try {
    const folder = join(root, 'eml')
    await mkdir(folder)
    for (let i = 0; i < 30; i++) {
      await writeFile(
        join(folder, `${i}.eml`),
        `From: person@example.test\r\nTo: team@example.test\r\nMessage-ID: <${i}@example.test>\r\nSubject: batch ${i}\r\n\r\nverified history ${i}`
      )
    }
    const imported = await service.import({ inputKind: 'eml-folder', paths: [folder] })
    assert.equal(imported.inserted, 30)
    assert.deepEqual(imported.failures, [])
    assert.equal(sourcePids.size, 1, 'one source process per batch, not per file')
    assert.equal((await service.stats()).totalMessages, 30)
    pass('production import, ACK RPC, verified SQLite search and source-process reuse')

    const exited = once(indexChild!, 'exit')
    indexChild!.kill()
    await exited
    assert.equal((await service.search({ query: 'verified history', limit: 100 })).length, 30)
    pass('index crash reconnects and preserves verified mail')

    // Hold the first actual PST batch ACK. With the ACK wait removed, the second batch arrives.
    const source = workers.createSource()
    const controller = new AbortController()
    let enter!: () => void
    const entered = new Promise<void>((r) => {
      enter = r
    })
    let release!: () => void
    const held = new Promise<void>((r) => {
      release = r
    })
    let batches = 0
    let count = 0
    const importing = source.run(
      {
        jobId: 'ack',
        epoch: 'ack',
        sourceId: 'pst',
        sourceKind: 'pst',
        sourcePath: resolve('node_modules/pst-extractor/example/testdata/enron.pst')
      },
      {
        onReady: async () => ({ action: 'scan', revision: 1 }),
        onBatch: async (_revision, mails) => {
          batches++
          count += mails.length
          enter()
          await held
        },
        onComplete: async (result) => {
          assert.equal(result.messages, count)
        }
      },
      controller.signal
    )
    await entered
    await delay(300)
    assert.equal(batches, 1, 'source must wait for ACK before the next PST batch')
    assert.equal(count, 25)
    release()
    await importing
    assert.ok(count > 25)
    source.close()
    pass('actual PST batches obey ACK and finish through source-worker.ts')

    let cancelJob = ''
    cancelOnBatch = () => {
      cancelOnBatch = undefined
      assert.equal(service.cancel(cancelJob), true)
    }
    const cancelled = await service.import(
      {
        inputKind: 'files',
        paths: [resolve('node_modules/pst-extractor/example/testdata/enron.pst')]
      },
      (progress) => {
        cancelJob = progress.jobId
      }
    )
    assert.equal(cancelled.state, 'cancelled')
    assert.equal((await service.stats()).totalMessages, 30)
    pass(
      'actual PST cancellation revokes the epoch and discards staging without losing verified mail'
    )

    let stall = false
    const timeoutWorker = createMailArchiveWorkerFactory({
      requestTimeoutMs: 5_000,
      fork: (path, serviceName) => {
        const child = utilityProcess.fork(path, [], { serviceName, stdio: 'ignore' })
        children.add(child)
        child.on('exit', () => children.delete(child))
        const post = child.postMessage.bind(child)
        child.postMessage = (message, transfers) => {
          if (!stall) post(message, transfers)
        }
        return child
      }
    }).createIndex(root)
    assert.equal((await timeoutWorker.stats()).totalMessages, 30)
    stall = true
    await assert.rejects(timeoutWorker.stats(), /mail_archive_index_timeout/)
    stall = false
    assert.equal((await timeoutWorker.stats()).totalMessages, 30)
    timeoutWorker.close()
    pass('request timeout terminates the stalled child and a future read reconnects')

    // Stop a source at a live IPC boundary; a later job must use a fresh process successfully.
    const broken = workers.createSource()
    const stopped = broken.run(
      {
        jobId: 'kill',
        epoch: 'kill',
        sourceId: 'eml',
        sourceKind: 'eml',
        sourcePath: join(folder, '0.eml')
      },
      {
        onReady: async () => {
          sourceChild!.kill()
          return { action: 'scan', revision: 1 }
        },
        onBatch: async () => {
          assert.fail('killed source must not supply a batch')
        },
        onComplete: async () => {
          assert.fail('killed source must not complete')
        }
      },
      new AbortController().signal
    )
    await assert.rejects(stopped, /mail_source_worker_exited_early/)
    broken.close()
    const reimported = await service.import({ inputKind: 'files', paths: [join(folder, '0.eml')] })
    assert.equal(reimported.skipped, 1)
    pass('source crash settles and the next import recovers')

    // A valid EML locator with a mismatched fingerprint must preserve the exact worker error code.
    const extractor = workers.createSource()
    await assert.rejects(
      extractor.extract({
        attachmentId: 'x',
        sourceId: 'x',
        sourceKind: 'eml',
        sourcePath: join(folder, '0.eml'),
        sourceFingerprint: 'wrong',
        itemKey: 'x',
        attachmentIndex: 0,
        name: 'x',
        mimeType: 'text/plain',
        sizeBytes: 0,
        destinationPath: join(root, 'output.txt')
      }),
      /mail_attachment_source_changed/
    )
    extractor.close()
    pass('source attachment errors cross the real process boundary without losing their code')
    console.log(`MAIL_WORKER_INTEGRATION ${passed}/${passed}`)
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    service.close()
    const exits = [...children].map(async (child) => {
      const exited = once(child, 'exit')
      child.kill()
      await exited
    })
    await Promise.all(exits)
    await rm(root, { recursive: true, force: true })
    app.exit(process.exitCode ? 1 : 0)
  }
}
void main().catch((error) => {
  console.error(error)
  app.exit(1)
})
