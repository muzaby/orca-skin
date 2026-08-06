import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CHANNELS } from './ipc'

const IPC_DOCUMENT_PATH = fileURLToPath(new URL('../../../docs/IPC_CONTRACT.md', import.meta.url))

describe('IPC contract documentation', () => {
  it('keeps the header, domain summary, and CHANNELS count at 82', () => {
    const document = readFileSync(IPC_DOCUMENT_PATH, 'utf8')
    const header = document.match(/## 2\. 채널 카탈로그 \(총 (\d+) 채널\)/)
    const summary = document.match(/도메인별 분포: (.+) = \*\*(\d+)\*\*\./)

    expect(header?.[1]).toBe('82')
    expect(summary?.[2]).toBe('82')

    const domainTotal = [...(summary?.[1] ?? '').matchAll(/`[^`]+` (\d+)/g)].reduce(
      (total, match) => total + Number(match[1]),
      0
    )
    expect(domainTotal).toBe(82)
    expect(Object.values(CHANNELS)).toHaveLength(82)
  })
})
