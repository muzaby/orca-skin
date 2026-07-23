# Verify — 0147-donut-per-step-id-dedup

## 메타

| 항목 | 값 |
|---|---|
| slug | `0147-donut-per-step-id-dedup` |
| 검증자 | Claude Code |
| 일자 | 2026-07-23 |
| 대상 커밋 | `1715173` |
| 라운드 | 1 |
| 상태 | PASS* (기계 PASS · 시각 실기 대기) |

## 구현자 코멘트 확인

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| override·reducer 무변경으로 폭발 반경 최소, `contextSignal` 가드는 child/dedup 과 독립 belt-and-suspenders | 타당 | 매트릭스 #1~#4 에서 상류 캡처만 검증, override/reducer 무회귀 확인 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | per-step id 중복 제거(첫 양-컨텍스트 판독만, 같은 id 뒤 0/중복 스킵) | ✅ | `claude-map.ts:290-315` (`stepId`·`capturedStepIds` 가드) · 테스트 "per-step id 중복 제거: 같은 id 의 뒤따르는 0 usage 가 첫 판독을 덮지 않는다" |
| 2 | 서브에이전트 child usage 무오염 | ✅ | `claude-map.ts:295` (`parentToolRunId === undefined`) · 테스트 "서브에이전트 child 의 usage 는 스냅샷을 오염시키지 않는다"(`capturedStepIds.has('childC')===false`) |
| 3 | 전부-0/부재 판독은 실측 result 미오염 | ✅ | `claude-map.ts:308-312` (`contextSignal > 0`) · 테스트 "전부-0 메인 스텝은 실측 result 를 0 으로 덮지 않는다" |
| 4 | `lastStepUsage` = 마지막 distinct 메인 스텝(합산 아님) | ✅ | `claude-map.ts:313` 새 id 마다 덮어씀 · 테스트 "distinct 스텝은 마지막 스텝으로 갱신된다" (Y 값 5200/155200, result 누적 10200/305200 아님) |
| 5 | `lastAssistantUsage`→`lastStepUsage` 리네임 + 참조 갱신 | ✅ | `claude-map.ts:32`(타입)·`210`(delete)·`457-458`(override) · 테스트 1051·1142 갱신 · grep `lastAssistantUsage` 소스 0건 |
| 6 | 게이트(lint/typecheck/vitest) 통과 | ✅ | 아래 게이트 결과 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 error(1 pre-existing warning) · typecheck 3분할 0 · claude-map 58/58 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 6/6 ✅ |
| 레이어 경계 위반 0 | ✅ | — | adapters 내부 순수 함수 변경, 경계 무영향 |
| 문서 형식/한국어 | ✅ | — | plan/verify 한국어·표 준수 |
| 제품 의도(컨텍스트=마지막 distinct 스텝 정의) | ✖ 보조 | ✅ 결정 | 사용자 dedup 지시·합산 미지시 확인 |
| UI/UX 시각 검증(도넛 렌더) | ✖ | ✅ | **사람 실기 대기** |
| PR 머지 승인 | ✖ | ✅ | 요청 시 |

## 게이트 재실행 결과

```
$ cd app
$ ./node_modules/.bin/vitest run src/main/adapters/claude-map.test.ts
  Test Files  1 passed (1)
       Tests  58 passed (58)          # 54 기존 + 4 신규
$ npm run lint
  ✖ 1 problem (0 errors, 1 warning)   # warning = TanStack Virtual, 본 변경 무관
$ npm run typecheck
  typecheck:node / :web / :test → 0 error
```

> egress 차단으로 electron ABI postinstall 실패(알려진 베이스라인) — 순수 vitest·lint·typecheck 는 정상. `npm test` 전체(better-sqlite3 DB 로드)·electron dev 실기는 CI/사람 몫.

## 위생 검토

- AGENTS.md 변경 없음 — 위생 스캔 대상 아님. 커밋 trailer 에 키/토큰/이메일 노출 없음(세션 URL·Co-Authored-By 는 규약).

## PHASES.md 정합성

- `docs/PHASES.md` "현재 작업 중" 보드 링크 유지. 승격 행은 INDEX `verify/PASS*` 기준.

## 검증 자기 리뷰

- 설계 단계: 컨텍스트 "마지막 distinct 스텝" 정의를 사용자에게 명시 확인함(합산 vs 스냅샷). 잘 갈랐다.
- 구현 단계: `message.id` 부재 폴백(현행 동작)으로 무회귀 확보. 실 SDK 는 항상 id 제공이라 dedup 실효.
- 검증 단계: 도넛의 *실제 화면 렌더*는 순수 매퍼 테스트로 못 본다 — 사람 실기 필요(멀티스텝/서브에이전트 턴 후 도넛 지속·% 정합).

## 결론 / 다음 단계

- 상태: **PASS\*** — 기계 인수 6/6 + 게이트 그린. **사람 실기 대기**: 도구/서브에이전트 멀티스텝 턴 후 도넛이 사라지지 않고 메인 컨텍스트 % 표시. PR 은 사용자 요청 시.
- Next-Action: none (사람 실기/PR 승인 대기).
