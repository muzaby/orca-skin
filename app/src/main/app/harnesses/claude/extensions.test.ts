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
it('blocks new queries behind publication and propagates the final deployment failure', async () => {
  const gate = Promise.withResolvers<Awaited<ReturnType<typeof f.deploy>>>()
  const service = createClaudeDeploymentService(
    { enabledConfig: () => ({}), resolver: () => () => undefined },
    () => []
  )
  await service.ensureDeployed()
  f.deploy.mockReturnValueOnce(gate.promise)
  const publishing = service.deployNow({ throwOnFailure: true })
  const opening = service.ensureDeployed()
  const results = Promise.allSettled([publishing, opening])
  gate.reject(new Error('locked directory'))
  for (const result of await results)
    expect(result).toMatchObject({ status: 'rejected', reason: expect.any(Error) })
  await service.ensureDeployed()
  expect(f.deploy).toHaveBeenCalledTimes(3)
})
