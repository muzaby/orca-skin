import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MAIN_ROOT = join(import.meta.dirname, '../../../..')
const FIXTURE_PATH = `${join('auth-platform', 'modules', '__fixtures__')}\\`
const FIXTURE_LITERALS = ['jira-platform', 'jira-security', 'confluence-rnd']

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      return entry.isFile() && path.endsWith('.ts') ? [path] : []
    })
  )
  return nested.flat()
}

describe('department fixture isolation', () => {
  it('keeps service-specific connector literals out of main core code', async () => {
    const coreSources = (await sourceFiles(MAIN_ROOT)).filter(
      (path) => !path.includes(FIXTURE_PATH)
    )
    const coreText = await Promise.all(coreSources.map((path) => readFile(path, 'utf8')))

    for (const literal of FIXTURE_LITERALS) {
      expect(
        coreText.some((source) => source.includes(literal)),
        literal
      ).toBe(false)
    }
  })
})
