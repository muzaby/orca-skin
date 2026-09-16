import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = process.cwd()
const SOURCE_ROOT = join(APP_ROOT, 'src')
const PACKAGE_NAME = '@atlassian-dc-mcp/jira'
const PACKAGE_IMPORT = /(?:from\s+|import\s*\()\s*['"]@atlassian-dc-mcp\//

function productSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return productSourceFiles(full)
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) return []
    return [full]
  })
}

describe('Jira native migration boundary', () => {
  it('upstream package를 manifest dependency로 설치하지 않는다', () => {
    const pkg = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf8')) as Record<
      string,
      Record<string, string> | undefined
    >

    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies'
    ]) {
      expect(
        pkg[field]?.[PACKAGE_NAME],
        `${field} must not include ${PACKAGE_NAME}`
      ).toBeUndefined()
    }

    const lock = JSON.parse(readFileSync(join(APP_ROOT, 'package-lock.json'), 'utf8')) as {
      packages?: Record<string, unknown>
    }
    expect(lock.packages?.[`node_modules/${PACKAGE_NAME}`]).toBeUndefined()
  })

  it('product source에서 @atlassian-dc-mcp package를 import하지 않는다', () => {
    const offenders = productSourceFiles(SOURCE_ROOT)
      .filter((file) => PACKAGE_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(APP_ROOT, file).replaceAll('\\', '/'))

    expect(offenders).toEqual([])
  })

  it('지원하지 않는 upload descriptor를 노출하지 않는다', () => {
    const offenders = productSourceFiles(SOURCE_ROOT)
      .filter((file) => readFileSync(file, 'utf8').includes('jira_uploadAttachment'))
      .map((file) => relative(APP_ROOT, file).replaceAll('\\', '/'))

    expect(offenders).toEqual([])
  })
})
