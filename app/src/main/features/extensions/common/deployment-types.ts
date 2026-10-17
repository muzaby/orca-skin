import type { Backend } from '../../../../shared/ipc'

export interface DeployResult {
  engine: Backend
  dryRun: boolean
  actions: string[]
  backedUp: boolean
  validation: { ok: boolean; errors: string[] }
}
