// 사용자 생성 connector 인스턴스의 ID 파생 (0161) — **순수 함수만**.
//
// 사용자 결정(2026-08-03): ID 는 **host 에서 파생**한다. 그 선택이 두 개의 문을 여는데 둘 다
// 여기서 닫는다:
//
//   1. **같은 host, 다른 컨텍스트 경로** 를 구분할 수 없다
//      → 컨텍스트 경로를 ID 에 **포함**한다. `wiki.corp` 와 `wiki.corp/confluence` 가 다른 ID.
//   2. **주소를 고치면 ID 가 바뀐다** — ID 에서 도구 서버 ID·승인 키(`mcp__<server>__<tool>`)·
//      다운로드 경로가 전부 파생되므로 주소 수정은 그것들의 이동이다
//      → 주소를 **생성 후 불변**으로 두고 수정 대신 삭제·재생성한다. 이 파일은 그 정책의
//        근거이지 강제 지점이 아니다(강제는 IPC 에 수정 채널을 두지 않는 것).
//
// 결과는 `PLUGIN_ID_PATTERN`(케밥 소문자)을 만족해야 한다 — manifest·IPC 가 같은 규칙을 쓴다.

import { PLUGIN_ID_MAX_LENGTH, PLUGIN_ID_PATTERN } from '../../../shared/protocol'

export interface DeriveConnectorIdInput {
  templateId: string
  baseUrl: string
  apiBasePath?: string
}

// 임의 문자열을 케밥 소문자 조각으로. `.`·`:`·`/`·`_` 등 비허용 문자는 전부 `-` 로 접고,
// 연속 `-` 를 하나로 줄인 뒤 양끝을 정리한다.
export function kebabSegment(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function deriveConnectorId(input: DeriveConnectorIdInput): string {
  const host = hostOf(input.baseUrl)
  const parts = [
    kebabSegment(input.templateId),
    kebabSegment(host),
    kebabSegment(input.apiBasePath ?? '')
  ]
  const joined = parts.filter((part) => part !== '').join('-')
  // 길이 상한을 넘으면 잘라내되 끝에 `-` 가 남지 않게 한다(패턴 위반 방지).
  const capped = joined.slice(0, PLUGIN_ID_MAX_LENGTH).replace(/-+$/, '')
  return capped
}

// 파생 결과가 실제로 등록 가능한 형태인지. 파생 함수와 분리해 두면 호출부가
// "만들었는데 등록에서 거부" 를 만나기 전에 걸러낼 수 있다.
export function isValidConnectorId(id: string): boolean {
  return id.length > 0 && id.length <= PLUGIN_ID_MAX_LENGTH && PLUGIN_ID_PATTERN.test(id)
}

function hostOf(baseUrl: string): string {
  try {
    // 포트가 있으면 함께 넣는다 — `wiki.corp` 와 `wiki.corp:8443` 은 다른 서버다.
    return new URL(baseUrl).host
  } catch {
    return ''
  }
}
