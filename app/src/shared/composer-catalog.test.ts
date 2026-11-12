import { expect, it } from 'vitest'
import { composerScopeKey, type ComposerCatalogScope } from './composer-catalog'

it('serializes the six scope fields in a fixed order', () => {
  const scope: ComposerCatalogScope = {
    backend: 'opencode',
    sessionId: 'session',
    cwd: 'C:/work',
    projectId: 'project',
    providerKey: 'team',
    agentKind: 'code'
  }
  expect(composerScopeKey(scope)).toBe(
    JSON.stringify(['opencode', 'session', 'C:/work', 'project', 'team', 'code'])
  )
})
