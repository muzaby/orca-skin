// Continuity(fork/handoff) 산출물의 언어 결정 — 순수 모듈(런타임 의존 0), main·renderer 양측 공용.
// 언어 소스는 settings.language(선호 언어, LLM 응답 언어 — uiLocale 아님)이고, **발생(draft 생성)
// 시점 스냅샷**으로만 쓴다(0127, 사용자 결정): 제목 마커·자동 메시지는 영속 데이터라 이후
// 설정 변경·uiLocale 전환에 반응하지 않는다. 지원은 ko/en 2종 고정(사용자 결정) — 자유 문자열
// 언어의 전수 번역은 불가하므로 한국어 계열만 ko, 그 외 전부 en.
export type ContinuityLang = 'ko' | 'en'
export type ContinuityKind = 'fork' | 'handoff'

// settings.language(자유 문자열) → ko/en 판정. 보수적 규칙:
//  · 미정의/공백 → 'ko' (SettingsSchema 기본 '한국어' 정합 — 마커는 생략 불가라 앱 기본 언어)
//  · trim·lowercase 후 '한국'|'한글'|'korean' 포함, 정확히 'ko'|'kor', 'ko-' 접두(ko-KR) → 'ko'
//  · 그 외 전부 → 'en'. 'ko' 는 부분 문자열 매칭하지 않는다('kokoro' 오탐 방지).
export function continuityLangFor(language: string | undefined): ContinuityLang {
  const normalized = language?.trim().toLowerCase() ?? ''
  if (!normalized) return 'ko'
  if (normalized.includes('한국') || normalized.includes('한글') || normalized.includes('korean'))
    return 'ko'
  if (normalized === 'ko' || normalized === 'kor' || normalized.startsWith('ko-')) return 'ko'
  return 'en'
}

// 제목 마커 — 영속 데이터라 i18n 카탈로그 비대상(0097 D3 유지). 렌더러 draft 제목과 main 의
// DB 초기 제목(initialTitle)이 문자열 단위로 일치해야 하므로 양측이 이 테이블·continuityTitle
// 하나만 쓴다(0127 — 구 이중 하드코딩 제거).
export const CONTINUITY_TITLE_MARKER: Record<ContinuityLang, Record<ContinuityKind, string>> = {
  ko: { fork: '분기', handoff: '핸드오프' },
  en: { fork: 'Fork', handoff: 'Handoff' }
}

// `[마커] base` — 렌더러 draft ↔ main initialTitle 의 단일 조립점. base 는 호출부가
// `원본 제목 trim || 세션 id 앞 8자` 폴백을 적용해 넘긴다(기존 계약 유지).
export function continuityTitle(kind: ContinuityKind, lang: ContinuityLang, base: string): string {
  return `[${CONTINUITY_TITLE_MARKER[lang][kind]}] ${base}`
}
