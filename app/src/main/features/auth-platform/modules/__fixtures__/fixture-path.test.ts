import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isFixtureSource } from './fixture-path'

describe('fixture source path classification', () => {
  it('recognizes fixture descendants without relying on a path separator literal', () => {
    const fixtureRoot = join('src', 'main', 'features', 'auth-platform', 'modules', '__fixtures__')

    expect(isFixtureSource(join(fixtureRoot, 'nested', 'package.ts'), fixtureRoot)).toBe(true)
    expect(isFixtureSource(join('src', 'main', 'features', 'chat', 'turn.ts'), fixtureRoot)).toBe(
      false
    )
  })
})
