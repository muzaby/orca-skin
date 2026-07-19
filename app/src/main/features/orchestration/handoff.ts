// orchestration/ — Conversation Continuity 서비스 층 (L1 domain, 0051 §A.4 · handoff 0064).
// 0061 이 예약한 이름을 첫 서비스(handoff/fork)로 재생성한다. 이 모듈은 순수 로직만 담고
// 실행 배선(IPC·어댑터 호출)은 L3(ipc/chat)가 소유한다 — 백엔드 리터럴 0.
//
// handoff = rebind 방식(r2): 출발 세션을 SDK forkSession 으로 새 세션에 전체 맥락 전달하고,
// 도착 세션의 첫 프롬프트(아래 자동 메시지)가 SDK 네이티브 /compact 압축으로 요약을 생성한다.
// Orca 자체 요약 파이프라인은 없다.

import type { ContinuityLang } from '../../../shared/continuity-lang'

// 자동 생성 사용자 발화 — plan 확정 문안(사용자 승인, 0064 r2). main 단일 출처이며 렌더러는
// message.user 에코로 표시만 한다. `[핸드오프]`/`[Handoff]` 마커 = 시스템 생성 발화 식별(hermes
// 계보). 언어는 발생 시점의 선호 언어(settings.language) 스냅샷 ko/en 2종(0127, 사용자 결정) —
// uiLocale i18n 비대상.
const HANDOFF_TEMPLATE_KO = `/compact [핸드오프] 이 세션은 이전 세션 "{title}"에서 핸드오프로 이어졌다.
이전 대화의 전체 이력이 이 세션의 컨텍스트에 로드되어 있다. 이전 대화에서
무엇을 했는지 다음 구조를 보존해 압축 요약하라: ① 배경·컨텍스트 ② 목표
③ 확정된 결정·제약 ④ 드러난/잠재/미해결 이슈 ⑤ 다음 단계(1개).
파일 경로·식별자·에러 메시지·확정 코드 조각·정확한 수치는 원문 그대로 보존한다.`

// en 템플릿 — ko 와 동일 구조(①~⑤ + verbatim 보존). 선호 언어가 영어가 아닐 수도 있으므로
// (ko/en 2종 고정 정책) 요약 산출 언어는 {language} 로 별도 지시한다.
const HANDOFF_TEMPLATE_EN = `/compact [Handoff] This session continues from the previous session "{title}" via handoff.
The full history of the previous conversation is loaded into this session's context.
Compactly summarize what was done, preserving this structure: ① background/context
② goals ③ confirmed decisions/constraints ④ surfaced/latent/unresolved issues
⑤ next step (one). Preserve file paths, identifiers, error messages, confirmed code
snippets, and exact figures verbatim. Write the summary in {language}.`

// `{title}` 보간 — 출발 세션 제목, 없으면(미생성/공백) 세션 id 앞 8자 폴백(hermes cli_title 규칙).
// lang 기본 'ko' = 기존 호출 하위호환. preferredLanguage 는 en 템플릿의 {language} 보간 원문
// (settings.language 그대로 — 예: '日本語') — 공백/미전달 시 'English' 폴백.
export function buildHandoffMessage(
  title: string | null,
  sourceSessionId: string,
  lang: ContinuityLang = 'ko',
  preferredLanguage?: string
): string {
  const trimmed = title?.trim() ?? ''
  const label = trimmed !== '' ? trimmed : sourceSessionId.slice(0, 8)
  if (lang === 'ko') return HANDOFF_TEMPLATE_KO.replace('{title}', label)
  const summaryLanguage = preferredLanguage?.trim() || 'English'
  return HANDOFF_TEMPLATE_EN.replace('{title}', label).replace('{language}', summaryLanguage)
}
