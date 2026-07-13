import type { StaticUsageProviderModule } from '../../../../../contracts/usage-report'

/**
 * Inactive template for a deployment-owned static usage provider.
 *
 * This module is typechecked but is not imported by `../index.ts`, so it is not
 * loaded or materialized by default. Copy it to `modules/<provider>/`, replace
 * the endpoint/header mapping with your company's contract, and add the module
 * to `STATIC_USAGE_PROVIDER_MODULES` when you intentionally opt in.
 */
export const exampleUsageProviderModule: StaticUsageProviderModule = {
  adapter: 'claude',
  provider: 'example',
  defaultSettings: {
    usageReport: {
      endpoint: 'https://usage.example.invalid/report',
      tokenSecretName: 'usage-report-token'
    }
  },
  usage: {
    config: {
      endpoint: 'https://usage.example.invalid/report',
      headers: {
        Authorization: 'Bearer ${SECRET:usage-report-token}'
      },
      map: {}
    }
  }
}
