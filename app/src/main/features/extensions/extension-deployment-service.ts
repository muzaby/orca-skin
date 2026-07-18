import type { DeployResult } from './deployer'
import { getLogger } from '../../infra/log/registry'

export interface ExtensionDeploymentServiceOptions {
  deploy: () => Promise<DeployResult>
  onWarning?: (message: string) => void
}

export class ExtensionDeploymentService {
  // boot deploy 가 성공하면 true. CRUD 는 deployNow() 로 즉시 재배포하므로 별도 dirty 플래그는
  // 두지 않는다 — ensureDeployed 는 "boot 배포가 아직/실패했으면 한 번 더 시도"만 담당한다.
  private deployedOnce = false
  // 비동기 전환(0109)에 따른 in-flight 직렬화 — dist 는 backup-then-write 라 동시 실행이
  // 겹치면 서로의 산출물을 지운다. 진행 중 deployNow 는 "완주 후 1회 재실행" 으로 코얼레스
  // 되고(연타 CRUD 안전), 모든 호출자는 마지막(최신 소스 반영) 결과로 resolve 된다.
  private inflight: Promise<DeployResult | null> | null = null
  private rerun = false

  constructor(private readonly opts: ExtensionDeploymentServiceOptions) {}

  deployNow(): Promise<DeployResult | null> {
    if (this.inflight) {
      this.rerun = true
      return this.inflight
    }
    this.inflight = this.runSerialized().finally(() => {
      this.inflight = null
    })
    return this.inflight
  }

  private async runSerialized(): Promise<DeployResult | null> {
    let result = await this.attempt()
    while (this.rerun) {
      this.rerun = false
      result = await this.attempt()
    }
    return result
  }

  private async attempt(): Promise<DeployResult | null> {
    try {
      const result = await this.opts.deploy()
      this.deployedOnce = true
      if (!result.validation.ok) {
        for (const err of result.validation.errors) {
          this.opts.onWarning?.(`[deploy] validation warning: ${err}`)
        }
      }
      return result
    } catch (e) {
      // 배포 실패는 부팅/CRUD 를 막지 않는다(비-critical) — warn 으로 기록하고 skip.
      getLogger()
        .child('extensions')
        .warn('extensions.deploy.failed', { standard: 'claude', message: String(e) })
      this.opts.onWarning?.(`[deploy] skipped extension deploy: ${String(e)}`)
      return null
    }
  }

  ensureDeployed(): Promise<DeployResult | null> {
    if (this.deployedOnce) return Promise.resolve(null)
    return this.deployNow()
  }
}
