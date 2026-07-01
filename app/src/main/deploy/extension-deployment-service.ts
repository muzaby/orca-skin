import type { DeployResult } from './deployer'

export interface ExtensionDeploymentServiceOptions {
  deploy: () => DeployResult
  onWarning?: (message: string) => void
}

export class ExtensionDeploymentService {
  // boot deploy 가 성공하면 true. CRUD 는 deployNow() 로 즉시 재배포하므로 별도 dirty 플래그는
  // 두지 않는다 — ensureDeployed 는 "boot 배포가 아직/실패했으면 한 번 더 시도"만 담당한다.
  private deployedOnce = false

  constructor(private readonly opts: ExtensionDeploymentServiceOptions) {}

  deployNow(): DeployResult | null {
    try {
      const result = this.opts.deploy()
      this.deployedOnce = true
      if (!result.validation.ok) {
        for (const err of result.validation.errors) {
          this.opts.onWarning?.(`[deploy] 검증 경고: ${err}`)
        }
      }
      return result
    } catch (e) {
      this.opts.onWarning?.(`[deploy] 확장 배포 건너뜀: ${String(e)}`)
      return null
    }
  }

  ensureDeployed(): DeployResult | null {
    if (this.deployedOnce) return null
    return this.deployNow()
  }
}
