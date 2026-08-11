import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CHANNELS } from './ipc'

const REPO_DOCS = new URL('../../../docs/', import.meta.url)
const IPC_DOCUMENT_PATH = fileURLToPath(new URL('IPC_CONTRACT.md', REPO_DOCS))
const INVENTORY_PATH = fileURLToPath(new URL('generated/inventory.md', REPO_DOCS))

/**
 * 채널 **수치** 는 문서 본문이 아니라 생성물(`docs/generated/inventory.md`)이 갖는다 —
 * 이전 판은 `IPC_CONTRACT.md` 헤더에 총계를 적어두고 이 테스트로 고정했는데, 같은 수치를
 * 인용한 다른 문서들(PRD·TRD 등)은 그 고정을 받지 못해 갈라졌다. 이제 생성물이 유일한
 * 표현이고 `scripts/check-doc-inventory.mjs` 가 전 문서를 훑는다.
 *
 * 여기서는 그 생성물이 **실제 코드와 맞는지** 와, IPC_CONTRACT 의 도메인 목록이 코드의
 * 도메인과 일치하는지를 본다.
 */
describe('IPC contract documentation', () => {
  const channels = Object.values(CHANNELS)
  const codeDomains = new Set(channels.map((channel) => channel.split(':')[1]))

  it('생성물의 채널 수가 CHANNELS 실측과 일치한다', () => {
    const inventory = readFileSync(INVENTORY_PATH, 'utf8')
    const channelRow = inventory.match(/\| IPC 채널 \| \*\*(\d+)\*\* \|/)
    const domainRow = inventory.match(/\| IPC 도메인 \| \*\*(\d+)\*\* \|/)

    expect(channelRow?.[1]).toBe(String(channels.length))
    expect(domainRow?.[1]).toBe(String(codeDomains.size))
  })

  it('IPC_CONTRACT 의 도메인 목록이 코드의 도메인과 일치한다', () => {
    const document = readFileSync(IPC_DOCUMENT_PATH, 'utf8')
    const namingSection = document.match(/^- 도메인: (.+)$/m)
    const documented = new Set(
      [...(namingSection?.[1] ?? '').matchAll(/`([a-z]+)`/g)].map((match) => match[1])
    )

    // 문서에만 있는 도메인 = 코드에서 사라졌는데 문서가 남긴 것.
    expect([...documented].filter((domain) => !codeDomains.has(domain))).toEqual([])
    // 코드에만 있는 도메인 = 새 도메인을 문서가 못 따라간 것.
    expect([...codeDomains].filter((domain) => !documented.has(domain))).toEqual([])
  })

  it('채널 상수에 중복이 없다', () => {
    expect(new Set(channels).size).toBe(channels.length)
  })
})
