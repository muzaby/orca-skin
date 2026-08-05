// 서버 추가 흐름의 **순수 로직** (0161·0162·0163) — React 비의존.
//
// 사용자 요구: "플러그인에서 추가 버튼 클릭 시 컨플루언스를 선택, base url·pat 혹은
// id/passwd 입력". 그 흐름이 세 단계로 갈린다:
//
//   ① 템플릿 고르기 — 추가 버튼의 메뉴 (`connectorAddMenu.ts`, 0162)
//   ② 서버 만들기   — 주소 입력 → `plugins.createInstance` (여기)
//   ③ 인증하기     — 0160 의 `connectorConnect.ts` 가 이어받는다
//
// 단계를 나누는 이유는 실패 지점이 다르기 때문이다. ②가 성공하고 ③이 실패해도 서버는
// 남는다(저장된 서버) — 카탈로그에서 다시 연결하면 된다.
//
// **주소는 한 칸이다** (0163). 0161 은 origin 과 컨텍스트 경로를 따로 물었는데, 사용자가
// 아는 것은 브라우저 주소창의 URL 하나뿐이다("컨텍스트 경로라는 사용자가 이해할 수 없는
// 옵션을 제공하고 있다"). 하나로 받아 **제출할 때** 앱이 쪼개고, 무엇이 적용되는지는
// `describeApiBase` 로 되보여준다.

// 경로 규칙의 정본은 main 스키마와 **같은 상수**다 — renderer 가 자기 사본을 들면 "여기선
// 통과, 보내면 거부" 가 조용히 생긴다.
import { API_BASE_PATH_PATTERN } from '../../../../../shared/connector-address'

export interface InstanceDraft {
  templateId: string | null
  label: string
  // 사용자가 친 그대로. **타이핑 중 고치지 않는다** — 0161 은 매 키 입력마다 origin 으로
  // 되썼는데, 그 탓에 `https://wiki.corp/` 의 `/` 가 지워져 이어 치면
  // `https://wiki.corpconfluence` 가 됐다(형태상 유효한 origin 이라 검증도 통과했다).
  address: string
}

export const EMPTY_DRAFT: InstanceDraft = {
  templateId: null,
  label: '',
  address: ''
}

// 템플릿은 **메뉴가 이미 골랐다**(0162). 모달은 그 선택을 받아 주소만 묻는다 —
// 이전에는 모달 안에 선택 단계가 있었지만, 등록 템플릿이 1개라 그 단계가 조건부로
// 건너뛰어져 "무엇을 추가하는지" 가 화면에서 사라졌다.
export function draftForTemplate(templateId: string): InstanceDraft {
  return { ...EMPTY_DRAFT, templateId }
}

export interface ServerAddress {
  // 경로 없는 origin — main 의 `OriginSchema` 가 요구하는 형태.
  baseUrl: string
  // 컨텍스트 경로. 없으면 `undefined`(빈 문자열이 아니다 — 스키마가 빈 값을 거부한다).
  apiBasePath?: string
}

// Confluence 가 컨텍스트 경로 **뒤에** 붙이는 잘 알려진 세그먼트. 여기서부터는 보고 있는
// 문서의 경로이지 배포 경로가 아니다.
const VIEW_SEGMENTS = new Set(['display', 'pages', 'spaces', 'wiki', 'rest', 'x', 'browse'])

// 사용자가 붙여넣은 URL 을 origin + 컨텍스트 경로로 쪼갠다.
//
//   https://wiki.corp                        → origin, 경로 없음
//   https://wiki.corp/confluence             → + /confluence
//   https://wiki.corp/confluence/display/S/P → + /confluence   (뷰 경로 앞까지)
//   https://wiki.corp/display/S/P            → 경로 없음        (첫 세그먼트가 뷰 경로)
export function splitServerUrl(raw: string): ServerAddress | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  // `https://u:p@host` 는 자격증명이 주소에 섞인 것이라 받지 않는다.
  if (url.username !== '' || url.password !== '') return null
  if (url.hostname === '') return null

  const segments: string[] = []
  for (const segment of url.pathname.split('/')) {
    if (segment === '') continue
    if (VIEW_SEGMENTS.has(segment.toLowerCase())) break
    segments.push(segment)
  }
  const path = segments.length > 0 ? `/${segments.join('/')}` : ''
  // 경로에 허용되지 않는 문자가 있으면 컨텍스트 경로로 쓰지 않는다 — main 스키마가 거부할
  // 값을 만들어 보내면 사용자는 이유를 알 수 없는 실패를 본다.
  if (path !== '' && !API_BASE_PATH_PATTERN.test(path)) return null

  return { baseUrl: url.origin, ...(path !== '' ? { apiBasePath: path } : {}) }
}

// 실제로 요청에 쓰일 주소를 사람이 읽을 한 줄로. 자동 추정을 **숨기지 않고 되보여주는** 것이
// 0161 의 "자동 확정하지 않는다" 가 지키려던 목적(오인 방지)을 대신한다.
export function describeApiBase(address: ServerAddress): string {
  return `${address.baseUrl}${address.apiBasePath ?? ''}`
}

export type DraftProblem = 'template_required' | 'label_required' | 'address_invalid'

// 전송 전 검증 — main 의 zod 스키마와 같은 규칙을 renderer 에서 먼저 본다. 서버 왕복 없이
// 즉시 사유를 보여주기 위한 것이고, **강제 지점은 여전히 main** 이다(fail-closed).
export function validateDraft(draft: InstanceDraft): DraftProblem | null {
  if (draft.templateId === null) return 'template_required'
  if (draft.label.trim() === '') return 'label_required'
  if (splitServerUrl(draft.address) === null) return 'address_invalid'
  return null
}

export interface CreateRequestShape {
  templateId: string
  label: string
  baseUrl: string
  apiBasePath?: string
}

// 전송 형상 — 빈 컨텍스트 경로는 **키 자체를 보내지 않는다**(스키마가 빈 문자열을 거부한다).
// 주소가 해석되지 않으면 `null`; 호출부는 `validateDraft` 로 이미 걸렀어야 한다.
export function toCreateRequest(draft: InstanceDraft): CreateRequestShape | null {
  const address = splitServerUrl(draft.address)
  if (address === null || draft.templateId === null) return null
  return {
    templateId: draft.templateId,
    label: draft.label.trim(),
    baseUrl: address.baseUrl,
    ...(address.apiBasePath !== undefined ? { apiBasePath: address.apiBasePath } : {})
  }
}

export type CreateFailure =
  'already_exists' | 'invalid_input' | 'unknown_template' | 'register_failed' | 'unknown'

// main 이 `${reason}: ${detail}` 형태로 던진다(handlers/plugins.ts). 사용자에게 다른 안내를
// 해야 하는 종류만 갈라낸다.
export function classifyCreateFailure(error: unknown): CreateFailure {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/already_exists/.test(message)) return 'already_exists'
  if (/invalid_input|invalid_id/.test(message)) return 'invalid_input'
  if (/unknown_template/.test(message)) return 'unknown_template'
  if (/register_failed/.test(message)) return 'register_failed'
  return 'unknown'
}
