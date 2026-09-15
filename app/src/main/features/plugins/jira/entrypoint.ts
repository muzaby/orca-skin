import { createRequire } from 'node:module'

type PackageResolver = (specifier: string) => string

const require = createRequire(import.meta.url)

export function resolveJiraEntrypoint(resolve: PackageResolver = require.resolve): string {
  return resolve('@atlassian-dc-mcp/jira')
}
