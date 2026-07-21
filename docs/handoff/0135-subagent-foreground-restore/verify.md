# Verify — 0135-subagent-foreground-restore

## 메타

| 항목 | 값 |
|---|---|
| slug | `0135-subagent-foreground-restore` |
| 검증자 | Claude Code |
| 일자 | 2026-07-21 |
| 대상 커밋 | `2cd306b` |
| 라운드 | 1 |
| 상태 | PASS* |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 §"조기 allow 반환이 승인 게이트를 우회하지 않음" | 타당 — Agent/Task 는 `RISKY_TOOLS`(risky-tools.ts:6) 밖이라 서브에이전트 분기가 위험도구 분기(claude.ts:171)보다 앞서 반환해도 우회 없음 | 매트릭스 AC5 증거로 채택 |
| 선조치 #1(명시 true·false 보존 테스트 고정) | 타당 | AC2·AC6 로 검증 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | off 기본 + `run_in_background` 부재 → false 주입 allow | ✅ | `claude.ts:122-125`(rec.run_in_background === undefined → false 주입), 테스트 "off(기본) → run_in_background:false 명시 주입" |
| 2 | 모델 명시값(true/false) 보존 | ✅ | `claude.ts:126`(else → input 그대로), 테스트 "명시 true 보존"·"명시 false 보존" |
| 3 | on(ORCA_SUBAGENT_BACKGROUND=1) → true 주입(기존) | ✅ | `claude.ts:114-119` 무변, 테스트 "backgroundSubagents on → true 주입" |
| 4 | 차단 타입 deny 가 주입보다 우선 | ✅ | `claude.ts:111-113` 무변, 테스트 "차단된 서브에이전트 타입은 deny" |
| 5 | 서브에이전트 외 분기 불변 | ✅ | AskUserQuestion/ExitPlanMode/위험도구/안전도구 분기 diff 0, 기존 테스트 전량 green |
| 6 | 테스트 갱신·추가 | ✅ | `claude.canusetool.test.ts` — off→false / 명시 true·false / Task 도구명 / on→true / deny 우선 |
| 7 | 게이트 | ✅ | 아래 게이트 결과 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 통과 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 |
| 레이어 경계 위반 0 | ✅ | — | boundaries lint 통과 |
| 실환경 서브에이전트 foreground 실행(런치→완료 라이브·inflight shimmer) | ✖ | ✅ | 사람 실기 대기 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
npm run lint       → 0 error (1 pre-existing warning: useTranscriptVirtualizer, 무관)
npm run typecheck  → node/web/test 3분할 0 error
vitest run         → 1099 passed / 138 files (chat-turn.continuity 1파일 로드 실패 = electron egress 베이스라인)
node --test scripts → 25/25
```

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: SDK opt-out 계약을 npm 패키지 실측(`sdk-tools.d.ts`)으로 검증해 근거가 견고했다.
- 구현 단계: 1 분기 수정으로 표면 최소. 명시값 보존 테스트를 선조치로 채운 판단이 적절.
- 검증 단계: 실환경 라이브 동작(foreground 서브에이전트가 실제로 부모 턴을 블록하고 결과를 라이브 렌더)은 electron 실기라 못 봤다 — 0136 과 같은 브랜치라 통합 실기는 사람 몫.

## 결론 / 다음 단계

- 상태: **PASS\*** — 인수 7/7 기계 충족. `*` = 실환경 서브에이전트 foreground 실기·PR 머지가 사람 대기. PHASES 승격.
