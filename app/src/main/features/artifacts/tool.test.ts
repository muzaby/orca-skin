import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createArtifactToolServer } from './tool'
import type { RuntimeToolServer, RuntimeToolContext } from '../../adapters/runtime-tools'
import type { ArtifactReceipt } from './service'

const artifact = {
  publicationId: 'pub',
  artifactFileId: 'file',
  title: 'Report',
  filename: 'report.md',
  kind: 'markdown' as const,
  sizeBytes: 7,
  publishedAt: 1
}
function fixture(): {
  service: {
    publish: ReturnType<typeof vi.fn<() => Promise<ArtifactReceipt>>>
    getRef: ReturnType<typeof vi.fn<() => typeof artifact>>
  }
  context: RuntimeToolContext & { waitForSession: ReturnType<typeof vi.fn<() => Promise<string>>> }
  controller: AbortController
  published: ReturnType<typeof vi.fn>
  server: RuntimeToolServer
} {
  const controller = new AbortController()
  const context = {
    cwd: 'C:/work',
    extraDirs: ['C:/extra'],
    getSignal: () => controller.signal,
    waitForSession: vi.fn(async () => 'session')
  }
  const service = {
    publish: vi.fn(async () => ({
      type: 'orca.artifact.published' as const,
      version: 1 as const,
      publicationId: 'pub'
    })),
    getRef: vi.fn(() => artifact)
  }
  const published = vi.fn()
  return {
    service,
    context,
    controller,
    published,
    server: createArtifactToolServer(service, published)
  }
}
describe('model artifact tool contract', () => {
  it('always exposes only path/title and the single source of publishing instructions', () => {
    const { server } = fixture()
    expect(server.descriptor.id).toBe('orca_artifacts')
    expect(server.descriptor.alwaysLoad).toBe(true)
    expect(server.descriptor.instructions).toContain('Do not publish application internals')
    expect(server.implementations.map((t) => t.name)).toEqual(['publish_artifact'])
    expect(Object.keys(server.implementations[0].inputSchema)).toEqual(['path', 'title'])
    expect(z.object(server.implementations[0].inputSchema).safeParse({ path: '' }).success).toBe(
      false
    )
  })
  it('waits for the host session, snapshots its signal and returns bounded JSON receipt only', async () => {
    const { service, context, published, server } = fixture()
    const result = await server.implementations[0].handler({ path: 'report.md' }, context)
    expect(context.waitForSession).toHaveBeenCalledWith(context.getSignal())
    expect(service.publish).toHaveBeenCalledWith(
      { path: 'report.md' },
      expect.objectContaining({
        sessionId: 'session',
        cwd: 'C:/work',
        extraDirs: ['C:/extra'],
        signal: context.getSignal()
      })
    )
    expect(JSON.parse(result.content[0].text)).toEqual({
      type: 'orca.artifact.published',
      version: 1,
      publicationId: 'pub'
    })
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(8192)
    expect(published).toHaveBeenCalledWith('session', artifact)
  })
  it('does not roll back successful publication when notification fails', async () => {
    const { context, published, server } = fixture()
    published.mockImplementation(() => {
      throw new Error('renderer gone')
    })
    expect(
      (await server.implementations[0].handler({ path: 'report.md' }, context)).isError
    ).not.toBe(true)
  })
  it('fails missing context and host cancellation without raw errors or hidden success', async () => {
    const { context, server, service } = fixture()
    expect((await server.implementations[0].handler({ path: 'report.md' })).isError).toBe(true)
    context.waitForSession.mockRejectedValueOnce(new Error('secret filesystem path'))
    const result = await server.implementations[0].handler({ path: 'report.md' }, context)
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(service.publish).not.toHaveBeenCalled()
  })
})
