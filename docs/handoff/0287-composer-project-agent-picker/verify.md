# Verify — 0287-composer-project-agent-picker

## 메타

| 항목 | 값 |
|---|---|
| slug | `0287-composer-project-agent-picker` |
| 검증자 | Claude Code |
| 일자 | 2026-10-29 |
| 대상 커밋/range | `4fdd30d..118d056`. 판정은 HEAD `81153e2` 위에서 수행 |
| 구현 전 plan 기준 | V1 `4fdd30d` |
| V mode / 유효 V | Baseline V1 |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — AC6·7·15 시각 확인은 구현자 실제 Chromium 캡처(`visual-check.md`)만 있고 사람 시각 인수 미실시 |
| 자기 검증 여부 | 아니오 — 구현 codex |

## 0. 기준선 / 후행 정본

- 구현 커밋 `118d056`의 `plan.md` 변경은 메타 상태·`[구현자 기입]` 자리표시자뿐이다.
- 후행 영향: 0289 D21이 `snapshot:false·share:disabled` 강제(`native-storage.ts:13`)를 "바꾸지 않음"으로 고정했다 — 0287 D-001과 같은 방향. 0289 ΔV1 A4가 `Controls.tsx`에 `!snapshot.models.stale`을 추가했으나 에이전트 슬롯(A1~A5)은 건드리지 않았다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| NEW ↔ REQUIRED | 유효 | 12 node·VP-01~12 |
| §10 자리 | 유효 | S5+A10+P16 = 31, Q-S/Q-A/Q-P 검색 기록 |
| 적대 증거 | 유효 | M-A1·M-P1·M-P2 |

## 1. 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 설정 우선순위 | 정상 | `native-storage.ts:13` `{...config, share, snapshot:false}` — config 뒤 강제. XS1 뒤집기 red |
| 수동 선택 보존 | 정상 | `agentSelection.ts` 유효 선택 유지, loading/error는 기존 값 |
| 비동기 대상 fence | 정상 | P-RACE 5조건 green |
| 즉시 등록 금지(D-007) | 정상 | P-ADD green — 선택 후 create 호출 0 |

## 2. 고장 이력 (HEAD에 재적용)

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 |
|---|---|---|---|---|---|
| M-A1 | `Controls.tsx:20` | 맞바꿈 | agents.status → models.status | 잡음 1/17 | routes returned first agent … while models still load |
| M-P1 | `Composer.tsx:256` | 제거 | 상단 CwdPanel landingProjects | 잡음 11/14 | claude composer 케이스들 |
| M-P2 | `Composer.tsx:416` | 제거 | 하단 CwdPanel landingProjects | 잡음 2/14 | opencode composer 케이스들 |
| XS1 | `native-storage.ts:13` | 뒤집기 | config가 snapshot:false를 덮음 | 잡음 5/40 | forces snapshots off for input undefined/true/false |
| X1 | `agentSelection.ts:10` | 다른 값 | 첫 항목 → 마지막 항목 | 잡음 2/8 | uses returned order … · routes returned first agent … |
| X2 | `landingProjectOptions.ts:19` | 제거 | 경로 검색 | 잡음 2/16 | searches paths … · searches names or full paths |

- 검산: 시도 6 = 잡음 6 · 못 잡음 0 · 동치 0. 덮개 회귀: 이전 verify 없음.

## 3. V-pair closeout

| Pair | 결과 | 근거 |
|---|---|---|
| VP-01·05·09 (UT) | PASS | `native-storage`·`agentSelection`·`landingProjectOptions` green, XS1·X1·X2 red |
| VP-02·06·10 (IT) | PASS | `server`·`Controls.selection-flow`·`NewChatLandingPage.project-picker` green, M-A1·M-P1·M-P2 red |
| VP-03·07·11 (ST) | PASS | 같은 좌표 + `project-binding`(DB, Node ABI 재빌드 후 green) |
| VP-04·08·12 (AT) | PASS(기계) | AC6·7·15 시각 부분은 사람 인수 대기 |

- AC 합계 재측정: 기계 ✅ 16 · ❌ 0 = 16, trailer `Criteria-Met: 16/16` 일치. 단 AC6·7·15의 white/dark·회전 시각은 사람 확인 전이다.

## 4. 게이트

[0289 verify §6](../0289-opencode-runtime-retention/verify.md)과 같은 HEAD 실행 — typecheck·lint·doc inventory PASS, Windows CI success. trailer 2커밋 파싱 정상.

## 5. 파생 이슈

| # | 이슈 | 분류 |
|---|---|---|
| V1 | AC6·7·15 시각 인수(white/dark·좁은 폭·회전/reduced motion) | 사람 실기 |

## Review Signals

- 첫 verify. 후행 0289가 같은 `Controls.tsx`를 수정했으나 에이전트 슬롯 변이(M-A1)는 HEAD에서도 red.
