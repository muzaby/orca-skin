# Verify — 0074-workspace-isolation-guide

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0074-workspace-isolation-guide` |
| 검증자 | Claude Code |
| 일자 | 2026-07-06 |
| 대상 커밋 | `a6bc047` (가이드) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 — pass-through 를 경고 블록으로 명시해야 오용 방지 | 타당 | 가이드 §3.1 "왜 allow 를 쓰지 않나" blockquote 확인 |
| 선조치 #1 — Bash 스크리닝을 `readRoots` 기준으로 단순화 + 한계 명시 | 타당(정적 파싱 한계 내 합리) | 매트릭스 #7 증거 |
| 선조치 #2 — `additionalDirectories` 인자화 | 타당 | 매트릭스 #6 증거 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | SDK options 코드레벨만, settings.json 미사용 | ✅ | 가이드 §2 options 스켈레톤·헤더 "settings.json 미사용" |
| 2 | 밖 r/w 차단 = PreToolUse 훅, 모드-독립 | ✅ | §1 결론표·§1.1 평가순서·§4 모드별 표(각 모드 "밖=훅 deny") |
| 3 | dontAsk 배제 + plan/AskUserQuestion/ExitPlanMode/acceptEdits 유지 | ✅ | §1 "dontAsk 를 매달면 안 된다"·§4 대화형 흐름 열·§8 원칙2 |
| 4 | 안 경로 pass-through(`{}`), allow 아님 | ✅ | §3.1 반환 표 + 경고 blockquote·§3.4 `passThrough()` 반환 |
| 5 | read 예외 read허용·write차단 + 최소권한 test-first | ✅ | §3.2 표·"최소권한 우선" note·§7 체크리스트 마지막 항목 |
| 6 | additionalDirectories `[]` + 옵션·훅 동일 배열 공유 | ✅ | §2 `ADDITIONAL_DIRS`·§5 확장 시나리오 |
| 7 | 모드별 표 + 검증 체크리스트 + Bash 한계 | ✅ | §4 표·§7 체크리스트·§3.5 한계 blockquote·§8 원칙4 |
| 8 | 모든 출처 사이트 표기 | ✅ | plan §자료조사 W1~W9·A1·C1~C3, 가이드 본문에 원문 인용·URL 언급 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | — | — | N/A(문서 산출물) |
| 인수 기준 ↔ 문서 대조 | ✅ | 이견 시 중재 | 8/8 충족 |
| SDK 사실 정확성(평가순서·모드·필드명) | ✅ W1 문서 대조 | — | 모순 0 |
| 문서 형식/링크/한국어 | ✅ | — | 컨벤션 부합 |
| 출처 전량 표기(사용자 명시 요구) | ✅ | — | W1~W9·A1·C1~C3 표기 |
| 가이드 배치 위치 적정성 | ✖ 제안 | ✅ 결정 | `docs/guides/` — 사람 확인 대기 |

## 게이트 재실행 결과

```
코드 게이트 N/A — 문서 산출물(코드 변경 0). 정합성 검토로 갈음:
- 가이드 TS 스니펫 필드명(hookSpecificOutput·permissionDecision·permissionDecisionReason,
  permissionMode 값 목록) ↔ W1(agent-sdk/permissions) 원문 일치 ✅
- 평가순서(Hooks→Deny→Ask→Mode→Allow→canUseTool) ↔ W1 6-step 일치 ✅
- 출처 사이트 전량 표기 확인 ✅
```

## 위생 검토

- 가이드·핸드오프에 키/토큰/이메일/IP·비밀 혼입: 없음.
- 장문 코드설명서/변동성 이력 혼입: 없음(가이드는 표준 how-to, 이력은 핸드오프로 분리).

## PHASES.md 정합성

- 범용 독립 가이드라 PHASES(Orca 페이즈 이력) 승격은 하지 않는다 — orca 제품 페이즈가 아닌 독립 문서(사용자 결정 "범용 독립"). INDEX 행만 등록.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 초안 검증에서 `dontAsk` 실재를 오히려 의심했으나 fetch 로 교정 — 검증 우선이 주효.
- 구현 단계: 가이드가 orca 어댑터에 실제로 배선되지 않았으므로 "실환경 실측"은 미수행(범용 문서 특성). 대상 앱 적용 시 §7 체크리스트로 실측 필요.
- 검증 단계: W7(user-input)·W8(settings)·W9(hooks) 는 직접 fetch 하지 않고 W1 교차 커버에 의존 — 사실 충돌 가능성은 낮으나 100% 원문 대조는 아님(정직하게 표기).

## 결론 / 다음 단계

- 상태: **PASS** (인수 8/8). 커밋 `a6bc047` + 본 핸드오프 등록.
- 사람 확인 대기: ① 가이드 배치 위치(`docs/guides/`) 승인 ② 대상 앱 적용 시 §7 체크리스트 실측 ③ PR #192 머지 승인.
