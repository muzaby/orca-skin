// (C) 플랫폼별 힌트 룩업 — 키-값 데이터라 JSON(platformHints.json)에 둔다(가이드 5.2: 긴 산문은
// JSON 금지, 키-값은 JSON 최적). 키 = NodeJS.Platform, 값 = 시스템 프롬프트에 실을 힌트 텍스트.
//
// 현재 엔트리 0 — 구조·접근자만 갖춘 스캐폴드다. 실제 플랫폼 힌트 콘텐츠(예: Windows 셸 문법)와
// 라이브 주입(buildAppend 조건부 블록 연동)은 별도 결정(handoff 0030 비범위).

import hints from './platformHints.json'

const PLATFORM_HINTS = hints as Record<string, string>

export function getPlatformHint(platform: NodeJS.Platform): string | null {
  return PLATFORM_HINTS[platform] ?? null
}
