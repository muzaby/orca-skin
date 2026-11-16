// 클라이언트 ↔ 워커 메시지 계약 (0324 VP-10) — 요청 3종을 실제 처리 함수에 넣고, 응답을
// 클라이언트의 파서(`parseResponse`)로 읽는다. 워커 프로세스만 빼고 같은 경로다.

import { describe, expect, it } from 'vitest'
import { diffLinesWithinCap } from '../inline'
import { parseResponse, resultSize, type ComputeRequest, type WireResponse } from '../protocol'
import { handleMessage } from './handler'

async function roundTrip(request: ComputeRequest, id = 7): Promise<WireResponse> {
  // 워커 경계는 structured clone 이다 — JSON 왕복으로 "복제 가능한 값만 실린다"를 함께 본다.
  const wire = JSON.parse(JSON.stringify(await handleMessage({ ...request, id }))) as unknown
  const parsed = parseResponse(wire)
  if (!parsed) throw new Error('응답 형식이 아니다')
  return parsed
}

describe('워커 처리 함수', () => {
  it('highlight — 테마 색이 입혀진 HTML 을 낸다', async () => {
    const response = await roundTrip({
      kind: 'highlight',
      code: 'const a = 1',
      lang: 'typescript',
      theme: 'github-dark'
    })
    if (!response.ok || !('html' in response.result)) throw new Error('highlight 응답이 아니다')
    expect(response.id).toBe(7)
    expect(response.result.html).toContain('<pre class="shiki github-dark"')
    expect(response.result.html).toContain('const')
    expect(resultSize(response.result)).toBe(response.result.html.length)
  })

  it('highlight — 테마가 다르면 결과가 다르다', async () => {
    const html = async (theme: 'github-light' | 'github-dark'): Promise<string> => {
      const response = await roundTrip({
        kind: 'highlight',
        code: 'let x',
        lang: 'javascript',
        theme
      })
      return response.ok && 'html' in response.result ? response.result.html : ''
    }
    expect(await html('github-light')).not.toBe(await html('github-dark'))
  })

  it('diffTokens — 축마다 줄 수만큼 토큰 행을 내고 없는 축은 null 이다', async () => {
    const response = await roundTrip({
      kind: 'diffTokens',
      oldText: null,
      newText: 'const a = 1\nconst b = 2',
      lang: 'typescript',
      theme: 'github-light'
    })
    if (!response.ok || !('old' in response.result)) throw new Error('diffTokens 응답이 아니다')
    expect(response.result.old).toBeNull()
    expect(response.result.new?.map((row) => row.map((t) => t.content).join(''))).toEqual([
      'const a = 1',
      'const b = 2'
    ])
    expect(resultSize(response.result)).toBe('const a = 1const b = 2'.length)
  })

  it('diffLines — UI 스레드의 상한 있는 계산과 같은 줄을 낸다', async () => {
    const response = await roundTrip({
      kind: 'diffLines',
      oldValue: 'a\nb\nc\n',
      newValue: 'a\nc\nd\n'
    })
    if (!response.ok || !('lines' in response.result)) throw new Error('diffLines 응답이 아니다')
    expect(response.result.lines).toEqual(diffLinesWithinCap('a\nb\nc\n', 'a\nc\nd\n'))
    expect(resultSize(response.result)).toBe(4)
  })

  it('계산이 던지면 그 요청만 실패 응답이 된다', async () => {
    const response = await roundTrip({
      kind: 'highlight',
      code: 'x',
      lang: 'no-such-language',
      theme: 'github-light'
    })
    expect(response.ok).toBe(false)
    expect(response.id).toBe(7)
  })
})

describe('parseResponse', () => {
  it.each([
    null,
    1,
    {},
    { id: 'x', ok: true, result: {} },
    { id: 1, ok: true },
    { id: 1, ok: false }
  ])('형식이 아닌 값 %j 은 null 이다', (raw) => expect(parseResponse(raw)).toBeNull())
})
