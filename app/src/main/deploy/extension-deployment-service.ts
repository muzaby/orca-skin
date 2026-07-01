import type { DeployResult } from './deployer'

export interface ExtensionDeploymentServiceOptions {
  deploy: () => DeployResult
  onWarning?: (message: string) => void
}

export class ExtensionDeploymentService {
  private dirty = true
  private deployedOnce = false

  constructor(private readonly opts: ExtensionDeploymentServiceOptions) {}

  markDirty(): void {
    this.dirty = true
  }

  deployNow(): DeployResult | null {
    try {
      const result = this.opts.deploy()
      this.deployedOnce = true
      this.dirty = false
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
    if (this.deployedOnce && !this.dirty) return null
    return this.deployNow()
  }
}
