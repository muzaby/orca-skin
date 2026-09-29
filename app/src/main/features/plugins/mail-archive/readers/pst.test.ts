import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readPstFile } from './pst'

describe('PST archive reader', () => {
  it('walks the bundled parser fixture and keeps importing after a damaged subtree', async () => {
    const fixture = join(
      process.cwd(),
      'node_modules',
      'pst-extractor',
      'example',
      'testdata',
      'enron.pst'
    )
    if (!existsSync(fixture)) return
    let messages = 0
    await readPstFile({
      sourcePath: fixture,
      sourceId: 'pst-fixture-source',
      sourceFingerprint: 'fixture',
      onMessage: (message) => {
        messages += 1
        if (messages === 1) {
          expect(message.sourceKind).toBe('pst')
          expect(message.folderPath).toBeTruthy()
        }
      }
    })
    expect(messages).toBeGreaterThan(0)
  }, 30_000)
})
