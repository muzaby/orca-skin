// provider key 어휘 — `${adapter}-${provider}` 합성 키 (handoff 0010 규약 유지). 세션의
// provider_key 영속·secret-store 키(`provider:${providerKey}`)·renderer ModelMenu 가 공유하는
// 식별자다. agent 목록 조회/모델 해석은 handoff 0014 에서 settings/provider-settings.ts 로 이전.

export interface SecretReader {
  get(name: string): string | undefined
}

// provider 디렉토리 이름 = providerKey(`${adapter}-${provider}`)의 구성 요소. 영숫자·_·- 만 허용.
// MCP 서버 키도 동일 제약(deploy/deployer.ts 가 재사용).
export const PROVIDER_NAME_RE = /^[A-Za-z0-9_-]+$/

export function providerKeyOf(adapter: string, provider: string): string {
  const normalized = provider.trim().toLowerCase()
  return normalized ? `${adapter}-${normalized}` : adapter
}

export interface ParsedProviderKey {
  adapter: string
  provider?: string
}

// 합성 키 → {adapter, provider}. provider 나 future adapter id 가 하이픈을 포함할 수 있으므로 알려진
// adapter 목록과의 최장 접두 매칭으로 분해한다. 매칭 실패(미지 adapter)는 undefined —
// 구 데이터/오타 키는 호출자가 기본 provider 로 폴백한다.
export function parseProviderKey(
  key: string | null | undefined,
  knownAdapters: Iterable<string>
): ParsedProviderKey | undefined {
  if (!key) return undefined
  let best: ParsedProviderKey | undefined
  for (const adapter of knownAdapters) {
    if (key === adapter) {
      if (!best || adapter.length > best.adapter.length) best = { adapter }
    } else if (key.startsWith(`${adapter}-`)) {
      const provider = key.slice(adapter.length + 1)
      if (provider && (!best || adapter.length > best.adapter.length)) {
        best = { adapter, provider }
      }
    }
  }
  return best
}
