import type { StaticUsageProviderModule } from '../../../../contracts/usage-report'

/**
 * Opt-in static usage provider registry.
 *
 * Fresh installs intentionally register no provider modules. Deployments that
 * need an enterprise quota source should add a module under `modules/<name>/`
 * and append it here; no usage service, scheduler, IPC, tracker, enumeration, or
 * materializer code should change for provider activation.
 *
 * Example activation:
 *   import { exampleUsageProviderModule } from './_example'
 *   export const STATIC_USAGE_PROVIDER_MODULES = [exampleUsageProviderModule]
 */
export const STATIC_USAGE_PROVIDER_MODULES: StaticUsageProviderModule[] = []
