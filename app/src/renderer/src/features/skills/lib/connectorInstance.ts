// 서버 추가 흐름의 **순수 로직** (0161) — React 비의존.
//
// 사용자 요구: "플러그인에서 추가 버튼 클릭 시 컨플루언스를 선택, base url·pat 혹은
// id/passwd 입력". 그 흐름이 두 단계로 갈린다:
//
//   ① 서버 만들기 — 템플릿 선택 + 주소 입력 → `plugins.createInstance`
//   ② 인증하기   — 0160 의 `connectorConnect.ts` 가 이어받는다
//
// 두 단계를 분리하는 이유는 실패 지점이 다르기 때문이다. ①이 성공하고 ②가 실패해도 서버는
// 남는다(저장된 서버) — 카탈로그에서 다시 연결하면 된다.

import type { ConnectorTemplateInfoDto } from '../../../../../shared/ipc'

export type InstanceStep = 'template' | 'server' | 'auth'

export interface InstanceDraft {
  templateId: string | null
  label: string
  baseUrl: string
  apiBasePath: string
}

export const EMPTY_DRAFT: InstanceDraft = {
  templateId: null,
  label: '',
  baseUrl: '',
  apiBasePath: ''
}

// 템플릿이 하나뿐이면 선택 단계를 건너뛴다 — 선택지가 없는 선택 화면은 클릭만 늘린다.
export function initialStep(templates: readonly ConnectorTemplateInfoDto[]): InstanceStep {
  return templates.length === 1 ? 'server' : 'template'
}

export function initialDraft(templates: readonly ConnectorTemplateInfoDto[]): InstanceDraft {
  return templates.length === 1
    ? { ...EMPTY_DRAFT, templateId: templates[0].templateId }
    : { ...EMPTY_DRAFT }
}

export type DraftProblem =
  'template_required' | 'label_required' | 'base_url_invalid' | 'api_base_path_invalid'

// 전송 전 검증 — main 의 zod 스키마와 같은 규칙을 renderer 에서 먼저 본다. 서버 왕복 없이
// 즉시 사유를 보여주기 위한 것이고, **강제 지점은 여전히 main** 이다(fail-closed).
export function validateDraft(draft: InstanceDraft): DraftProblem | null {
  if (draft.templateId === null) return 'template_required'
  if (draft.label.trim() === '') return 'label_required'
  if (!isOrigin(draft.baseUrl.trim())) return 'base_url_invalid'
  const path = draft.apiBasePath.trim()
  if (path !== '' && !/^\/[A-Za-z0-9\-._~/]*[A-Za-z0-9\-._~]$/.test(normalizePath(path))) {
    return 'api_base_path_invalid'
  }
  return null
}

function isOrigin(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    if (url.username !== '' || url.password !== '') return false
    return raw === url.origin
  } catch {
    return false
  }
}

function normalizePath(raw: string): string {
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`
  return withLeading.replace(/\/+$/, '')
}

// 전송 형상 — 빈 컨텍스트 경로는 **키 자체를 보내지 않는다**(스키마가 빈 문자열을 거부한다).
export function toCreateRequest(draft: InstanceDraft): {
  templateId: string
  label: string
  baseUrl: string
  apiBasePath?: string
} {
  const path = normalizePath(draft.apiBasePath.trim())
  return {
    templateId: draft.templateId ?? '',
    label: draft.label.trim(),
    baseUrl: draft.baseUrl.trim(),
    ...(draft.apiBasePath.trim() !== '' ? { apiBasePath: path } : {})
  }
}

export interface PastedUrlParts {
  origin: string
  // 첫 경로 세그먼트 — 컨텍스트 경로 **후보**다. 자동 확정하지 않는다(`/display` 를
  // 컨텍스트 경로로 오인할 수 있어 사용자가 확인해야 한다).
  suggestedBasePath: string
}

// 사용자는 브라우저 주소창의 전체 URL 을 붙여넣는다. 그대로 받으면 origin 스키마가 거부하고
// 사용자는 이유를 모른다 — origin 과 경로를 갈라 **제안**한다.
export function splitPastedUrl(raw: string): PastedUrlParts | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const first = url.pathname.split('/').filter((part) => part !== '')[0]
    return {
      origin: url.origin,
      // Confluence 의 잘 알려진 뷰 경로는 컨텍스트 경로가 아니다 — 제안에서 뺀다.
      suggestedBasePath: first !== undefined && !VIEW_SEGMENTS.has(first) ? `/${first}` : ''
    }
  } catch {
    return null
  }
}

const VIEW_SEGMENTS = new Set(['display', 'pages', 'spaces', 'wiki', 'rest', 'x'])

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
