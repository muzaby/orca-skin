import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createMailArchiveService } from './service'

const roots: string[] = []
const services: Array<ReturnType<typeof createMailArchiveService>> = []

afterEach(async () => {
  for (const service of services.splice(0)) service.close()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function rawMail(index: number): string {
  return [
    'From: sender@example.test',
    'To: team@example.test',
    `Subject: 배치 메일 ${index}`,
    `Message-ID: <batch-${index}@example.test>`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    `본문 ${index}`,
    ''
  ].join('\r\n')
}

describe('mail archive import service', () => {
  it('imports an EML folder in batches and keeps a cancelled partial result searchable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-archive-service-'))
    roots.push(root)
    const folder = join(root, 'eml')
    await mkdir(folder)
    await Promise.all(
      [1, 2, 3].map((index) => writeFile(join(folder, `${index}.eml`), rawMail(index)))
    )
    const service = createMailArchiveService(root)
    services.push(service)
    let cancelled = false
    const result = await service.import(
      { inputKind: 'eml-folder', paths: [folder] },
      (progress) => {
        if (!cancelled && progress.processedMessages >= 1) {
          cancelled = service.cancel(progress.jobId)
        }
      }
    )
    expect(result.state).toBe('cancelled')
    expect(result.messages).toBeGreaterThanOrEqual(1)
    expect(service.search({ query: '본문', limit: 10 }).length).toBeGreaterThanOrEqual(1)
  })
})
