// `opencode models <provider> --verbose --pure` 출력 해석 (0291).
//
// CLI 출력은 문서화된 machine 형식이 아니다. v1.18.27 의 실제 형상은 모델마다
//
//   provider/model
//   {                      ← 0열 `{` 로 시작해 0열 `}` 로 끝나는 pretty JSON (JSON.stringify(m, null, 2))
//     ...
//   }
//
// 이다. 형식이 바뀌어 블록을 해석하지 못하면 부분 목록 대신 throw 한다 — 조용히 일부 모델만
// 카드로 나가는 것보다 연결 실패가 낫다.
//
// 순수 모듈이다 — child_process·fs 를 import 하지 않는다.
import type { HarnessListedModel } from '../../common/harness-config'

const PROVIDER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
export const OPENCODE_LISTING_PARSE_ERROR = '모델 목록을 해석하지 못했습니다.'

// 실행 전 검사 — 플래그·경로로 해석될 수 있는 값은 실행 0회로 거부한다.
export function assertOpenCodeProviderId(provider: string): void {
  if (!PROVIDER_ID.test(provider)) {
    throw new Error(`OpenCode provider id 형식이 올바르지 않습니다: ${provider.slice(0, 100)}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function variantsOf(value: unknown): string[] | undefined {
  if (!isRecord(value)) return undefined
  const names = Object.entries(value)
    .filter(([, variant]) => !(isRecord(variant) && variant.disabled === true))
    .map(([name]) => name)
  return names.length > 0 ? names : undefined
}

function modelOf(id: string, detail: unknown): HarnessListedModel {
  if (!isRecord(detail)) return { id }
  const name =
    typeof detail.name === 'string' && detail.name.trim() !== '' ? detail.name : undefined
  const variants = variantsOf(detail.variants)
  return {
    id,
    ...(name !== undefined ? { name } : {}),
    ...(variants !== undefined ? { variants } : {})
  }
}

export function parseOpenCodeModelListing(stdout: string, provider: string): HarnessListedModel[] {
  const lines = stdout.replace(/\r\n/g, '\n').split('\n')
  const prefix = `${provider}/`
  const models: HarnessListedModel[] = []
  const seen = new Set<string>()
  let index = 0
  while (index < lines.length) {
    const header = lines[index]!.trim()
    index++
    if (header === '') continue
    if (header.startsWith('{') || header.startsWith('}')) {
      throw new Error(OPENCODE_LISTING_PARSE_ERROR)
    }
    let detail: unknown = undefined
    if (lines[index]?.startsWith('{')) {
      const start = index
      while (index < lines.length && !lines[index]!.startsWith('}')) index++
      if (index >= lines.length) throw new Error(OPENCODE_LISTING_PARSE_ERROR)
      const block = lines.slice(start, index + 1).join('\n')
      index++
      try {
        detail = JSON.parse(block)
      } catch {
        throw new Error(OPENCODE_LISTING_PARSE_ERROR)
      }
    }
    // 다른 provider 접두·형식이 아닌 줄은 버린다(경고·배너 줄 포함).
    if (!header.startsWith(prefix) || /\s/.test(header) || header.length === prefix.length) continue
    if (seen.has(header)) continue
    seen.add(header)
    models.push(modelOf(header, detail))
  }
  return models
}
