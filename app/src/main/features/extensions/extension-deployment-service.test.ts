import { describe, expect, it } from 'vitest'
import { ExtensionDeploymentService } from './extension-deployment-service'
import type { DeployResult } from './deployer'

function result(tag: number): DeployResult {
  return {
    engine: 'claude',
    dryRun: false,
    actions: [`run-${tag}`],
    backedUp: false,
    validation: { ok: true, errors: [] }
  }
}

describe('ExtensionDeploymentService — 비동기 직렬화 (0109)', () => {
  it.each([true, false])(
    'strict caller and default caller share the final failure (strictFirst=%s)',
    async (strictFirst) => {
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      const initialFailure = new Error('initial deployment failed')
      const lastFailure = new Error('last deployment failed')
      let runs = 0
      const service = new ExtensionDeploymentService({
        deploy: async () => {
          if (++runs === 1) {
            await held
            throw initialFailure
          }
          throw lastFailure
        }
      })
      const first = service.deployNow({ throwOnFailure: strictFirst })
      const second = service.deployNow({ throwOnFailure: !strictFirst })
      const settled = Promise.allSettled([first, second])
      release()
      const outcomes = await settled
      expect(runs).toBe(2)
      expect(outcomes[strictFirst ? 0 : 1]).toEqual({ status: 'rejected', reason: lastFailure })
      expect(outcomes[strictFirst ? 1 : 0]).toEqual({ status: 'fulfilled', value: null })
    }
  )

  it('a failed attempt still runs the queued retry and resolves both callers with its success', async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let runs = 0
    const service = new ExtensionDeploymentService({
      deploy: async () => {
        if (++runs === 1) {
          await held
          throw new Error('first failed')
        }
        return result(runs)
      }
    })
    const strict = service.deployNow({ throwOnFailure: true })
    const regular = service.deployNow()
    const settled = Promise.all([strict, regular])
    release()
    expect(await settled).toEqual([result(2), result(2)])
    expect(runs).toBe(2)
    expect(await service.deployNow({ throwOnFailure: true })).toEqual(result(3))
  })

  it('진행 중 deployNow 는 완주 후 1회 재실행으로 코얼레스되고, 최신 결과로 resolve 된다', async () => {
    let runs = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const service = new ExtensionDeploymentService({
      deploy: async () => {
        runs += 1
        if (runs === 1) await gate
        return result(runs)
      }
    })

    const first = service.deployNow()
    // 진행 중 연타 3회 — 재실행 예약은 1회로 합쳐진다.
    const second = service.deployNow()
    const third = service.deployNow()
    release()

    const results = await Promise.all([first, second, third])
    expect(runs).toBe(2) // 최초 1 + 코얼레스된 재실행 1
    for (const r of results) expect(r?.actions).toEqual(['run-2'])
  })

  it('완료 후의 deployNow 는 새 실행을 시작한다', async () => {
    let runs = 0
    const service = new ExtensionDeploymentService({
      deploy: async () => {
        runs += 1
        return result(runs)
      }
    })
    await service.deployNow()
    await service.deployNow()
    expect(runs).toBe(2)
  })

  it('ensureDeployed 는 boot 성공 후 no-op, 실패 상태면 재시도한다', async () => {
    let fail = true
    let runs = 0
    const warnings: string[] = []
    const service = new ExtensionDeploymentService({
      deploy: async () => {
        runs += 1
        if (fail) throw new Error('첫 배포 실패')
        return result(runs)
      },
      onWarning: (m) => warnings.push(m)
    })

    expect(await service.deployNow()).toBeNull() // boot 실패 → null + 경고
    expect(warnings).toHaveLength(1)

    fail = false
    expect(await service.ensureDeployed()).not.toBeNull() // 재시도
    expect(await service.ensureDeployed()).toBeNull() // 성공 후 no-op
    expect(runs).toBe(2)
  })
})
