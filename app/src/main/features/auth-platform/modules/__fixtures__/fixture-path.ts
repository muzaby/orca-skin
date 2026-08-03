import { isAbsolute, relative, resolve, sep } from 'node:path'

export function isFixtureSource(sourcePath: string, fixtureRoot: string): boolean {
  const fromFixtureRoot = relative(resolve(fixtureRoot), resolve(sourcePath))
  return (
    fromFixtureRoot === '' ||
    (!isAbsolute(fromFixtureRoot) &&
      fromFixtureRoot !== '..' &&
      !fromFixtureRoot.startsWith(`..${sep}`))
  )
}
