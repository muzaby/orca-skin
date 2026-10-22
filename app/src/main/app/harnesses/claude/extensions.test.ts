import { expect, it, vi } from 'vitest'
const f = vi.hoisted(() => ({
  deploy: vi.fn(async () => ({
    engine: 'claude',
    validation: { ok: true, errors: [] },
    actions: [],
    backedUp: false,
    dryRun: false
  }))
}))
vi.mock('../../../features/extensions/claude/deployer', () => ({ deploy: f.deploy }))
import { createClaudeDeploymentService } from './extensions'
it('finishes immutable publication inside the serialized deployment and drains it before close', async () => {
  const gate = Promise.withResolvers<void>()
  const entered = Promise.withResolvers<void>()
  const publish = vi.fn(async () => {
    entered.resolve()
    await gate.promise
  })
  const service = createClaudeDeploymentService(
    { enabledConfig: () => ({ mcpServers: {} }), resolver: () => () => undefined } as never,
    () => [],
    publish
  )
  const first = service.deployNow({ throwOnFailure: true })
  await entered.promise
  const second = service.deployNow({ throwOnFailure: true })
  let closed = false
  const close = service.close().then(() => {
    closed = true
  })
  expect(f.deploy).toHaveBeenCalledTimes(1)
  expect(closed).toBe(false)
  gate.resolve()
  await Promise.all([first, second, close])
  expect(f.deploy).toHaveBeenCalledTimes(2)
  expect(publish).toHaveBeenCalledTimes(2)
  await expect(service.deployNow({ throwOnFailure: true })).rejects.toThrow()
})
