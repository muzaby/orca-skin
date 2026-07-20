import type { SsoProviderModule } from '../../../contracts/sso'

/**
 * Opt-in SSO module registry.
 *
 * Fresh installs intentionally register no SSO module (null = no login gate).
 * A closed-network deployment that needs a company login should add its module
 * under `modules/<name>/` and register it here; no service, IPC, or gate code
 * should change for activation. See ./AGENTS.md for the self-contained guide.
 *
 * Example activation:
 *   import { exampleSsoModule } from './_example'
 *   export const SSO_MODULE_REGISTRATION: SsoProviderModule | null = exampleSsoModule
 */
export const SSO_MODULE_REGISTRATION: SsoProviderModule | null = null
