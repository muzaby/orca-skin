import type { DeployResult } from './deployer'
import { getLogger } from '../../infra/log/registry'

interface ExtensionDeploymentServiceOptions {
  deploy: () => Promise<DeployResult>
  onWarning?: (message: string) => void
}

export class ExtensionDeploymentService {
  // boot deploy 가 성공하면 true. CRUD 는 deployNow() 로 즉시 재배포하므로 별도 dirty 플래그는
  // 두지 않는다 — ensureDeployed 는 "boot 배포가 아직/실패했으면 한 번 더 시도"만 담당한다.
  private deployedOnce = false
  // 비동기 전환(0109)에 따른 in-flight 직렬화 — dist 는 backup-then-write 라 동시 실행이
  // 겹치면 서로의 산출물을 지운다. 진행 중 deployNow 는 "완주 후 1회 재실행" 으로 코얼레스
  // 되고(연타 CRUD 안전), 모든 호출자는 마지막(최신 소스 반영) 결과를 받는다.
  private inflight: Promise<DeployResult> | null = null
  private rerun = false

  constructor(private readonly opts: ExtensionDeploymentServiceOptions) {}

  deployNow(options?: { throwOnFailure?: boolean }): Promise<DeployResult | null> {
    if (this.inflight) {
      this.rerun = true
    } else {
      this.inflight = this.runSerialized().finally(() => {
        this.inflight = null
      })
    }
    // 배포 큐는 하나다. 기본 호출의 관용 처리가 엔진 CRUD의 기존 오류 전달까지 삼키지 않는다.
    return options?.throwOnFailure ? this.inflight : this.inflight.catch(() => null)
  }

  private async runSerialized(): Promise<DeployResult> {
    for (;;) {
      this.rerun = false
      try {
        const result = await this.attempt()
        if (!this.rerun) return result
      } catch (error) {
        // 실패한 시도 뒤에도 최신 source를 반영할 예약은 실행한다. 마지막 결과만 호출자에게 준다.
        if (!this.rerun) throw error
      }
    }
  }

  private async attempt(): Promise<DeployResult> {
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
      // 모든 실패는 기록한다. 기본 호출의 warn/null과 엔진의 reject는 deployNow에서 구분한다.
      getLogger()
        .child('extensions')
        .warn('extensions.deploy.failed', { standard: 'claude', message: String(e) })
      this.opts.onWarning?.(`[deploy] skipped extension deploy: ${String(e)}`)
      throw e
    }
  }

  ensureDeployed(): Promise<DeployResult | null> {
    if (this.deployedOnce) return Promise.resolve(null)
    return this.deployNow()
  }
}
