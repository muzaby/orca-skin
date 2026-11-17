// 산출물 게시 영수증 판독 (0324 EP-15). 순수 함수라 저장기(데이터 호스트)와 저장 스트림
// 송신기(에이전트 호스트)가 함께 쓴다 — 송신기는 이 판정으로 확인을 기다릴 이벤트를 고른다.

// 실제 tool_result의 text 영수증만 읽는다. 도구명·세션·원래 메시지 검증은 DB linker가 소유한다.
export function artifactReceiptId(result: unknown): string | null {
  const text =
    typeof result === 'string'
      ? result
      : Array.isArray(result) && result.length === 1 && result[0]?.type === 'text'
        ? (result[0].text as unknown)
        : undefined
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 8192) return null
  try {
    const receipt: unknown = JSON.parse(text)
    if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) return null
    const value = receipt as Record<string, unknown>
    return Object.keys(value).length === 3 &&
      value.type === 'orcinus-orca.artifact.published' &&
      value.version === 1 &&
      typeof value.publicationId === 'string' &&
      value.publicationId.length > 0 &&
      value.publicationId.length <= 128
      ? value.publicationId
      : null
  } catch {
    return null
  }
}
