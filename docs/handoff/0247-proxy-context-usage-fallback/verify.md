# Verify — 0247-proxy-context-usage-fallback

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0247-proxy-context-usage-fallback` |
| 검증자 | Claude Code |
| 일자 | 2026-10-02 |
| 대상 커밋/range | `f96bdbe8..0d103854` |
| 구현 전 plan 기준 | `f96bdbe8` (V1 READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `f96bdbe8:V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — VP-04 의 AC13 사람 실기 대기 |
| 자기 검증 여부 | 아니오 — 설계·검증 Claude, 구현 Codex. 그래도 보고에 없던 변이 5축(X1~X5)을 더했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 `상태` READY→IMPL_DONE 과 `[구현자 기입]` 절만. `git diff f96bdbe8 0d103854 -- plan.md` 의 `-` 행은 상태 1행과 템플릿 자리표시자뿐이다.
- 기준선이 diff로 성립하는가: 예 — 설계 `f96bdbe8` 와 구현 `0d103854` 가 별도 커밋.
- Decision Ledger · Product/UX · AC · V node/pair/§10/oracle 변경: 없음.
- 채점에 사용할 원 기준: `f96bdbe8` 의 D-001~D-010 · AC1~AC13 · VP-01~VP-09 · EP-01~EP-05 · M1~M8.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 이 경로를 소유한 V 가 없다(§7-A) |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01~06·SD·AR·MD 전부 VP-01~09 에 짝 |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | INHERITED 없음 |
| pair별 path·§10 전수·직접 oracle | 유효 | VP-01~09 모두 path·자리 수·oracle 기재 |
| 선택적 적대 증거·선택 이유 | 유효 | VP-01·03·05·07 선택, 나머지는 직접 값 관측 사유 |
| `SUPERSEDED` 이관 | 해당 없음 | — |
| 운영 gate·범위 | 유효 | lint·typecheck·비-DB vitest·smoke·inventory·trailer |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | assistant 합 0/부재면 마지막 양수 메인 `message_delta` | `claude-map.ts:455-465` 관측 → `:786-787` 판정 |
| D-002 | usage 미반환이면 미갱신 | smoke C `[0,0,0]` · AC3 |
| D-003 | 분모 = CLI 창, 없으면 200k | smoke A 200,000 · D 262,144 — 분모 코드 무변경 |
| D-004 | 출처 표기 없음 | telemetry·IPC·DB 타입 diff 0 |
| D-005 | JSONL 미사용 | diff 에 파일 읽기 0 |
| D-006 | assistant 양수 우선 | `(turn.assistantContext ?? 0) <= 0` 조건 · AC2 · M2/M8 red |
| D-007 | 턴 단위 관측, 채널 `lastAssistantUsage` 수명 무변경 | `:746-747`·`:428` 리셋 · `lastAssistantUsage` 수명 줄 무변경 |
| D-008 | 사이드체인·핸드오프 압축 전 제외 | `:456` 게이트 · AC4/AC7 · M4/M6 red |
| D-009 | `primaryModelScore` 재사용 | `claude-map.ts:465`·`:538` 2곳, `(?? 0) +` 사본 0 |
| D-010 | 원장 규칙 무변경 | `tracker.ts:53` 게이트 무변경 · AC9 |

```text
SessionRuntime.send → ClaudeAdapter(includePartialMessages) → 번들 CLI → SSE
  → claudeToNormalized: stream_event(message_delta)/assistant/compact_boundary/result
  → telemetry → UsageTracker(hasContextTokens) → insertTurnUsage → usageRowToTelemetry 복원
              → chatReducer(contextTokens > 0) → lastTelemetry → 도넛
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 수용 | 마지막 요청만 delta usage 가 빠지면 같은 턴 이전 양수가 남는다 — plan §17 수용 리스크 |
| false success 가능성 | 없음 | output-only·0·null delta 는 양수 가드로 버린다(X2 red) |
| partial failure/rollback | 해당 없음 | 새 쓰기 지점 0, `MapContext` 메모리 상태만 |
| A 대신 B 를 구현했는가 | 아니오 | §5 상태표 8행이 UT·smoke 에 대응 |
| 증상만 제거 | 아니오 | 원인(0 스냅샷 채택)을 판정 우선순위로 처리 |
| 최적화가 잃은 관측 | 해당 없음 | — |
| 출력/요청 상한 | 증가 0 | `message_delta` 분기는 `[]` 반환, 새 요청 0 |

- `message_delta` 조기 `return []`: 이전에도 이 이벤트는 `delta.type` 이 텍스트/생각이 아니라 `[]` 로 끝났다 — 동작 동일.
- 중복 result UUID: 리셋이 중복 조기 반환(`:735-740`) 뒤에 있다. X5(리셋을 앞으로 옮김)가 red 라 순서가 잠겨 있다.

## 3. 역방향 탐색

`scan-surface.sh` 는 이 환경에 `rg` 가 없어 실행되지 않았다 — Grep 도구로 대체했다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export | 없음 | `overrideContext`·`UsageSnapshot` 모두 모듈 내부 |
| 테스트 전용 참조 | 없음 | 신규 심볼은 production 분기에서 호출된다 |
| 형제 정책 비대칭 | 정상 | assistant·delta 가 같은 게이트(사이드체인·핸드오프)와 같은 병합 함수를 쓴다 |
| 신규 상태의 소비처 | 1곳 | `turnUsage` 는 `claude-map` result 분기만 읽는다 |
| producer ↔ consumer 파생 | 일치 | 컨텍스트 합 정의 = `primaryModelScore` = `hasContextTokens` = `contextTokens` |
| `message_delta` 다른 소비처 | 0 | `app/src` 비테스트 grep 결과 `claude-map.ts` 2줄(주석·분기)뿐 |

- AC9 IT 는 production `claudeToNormalized`·`UsageTracker`·`usageRowToTelemetry` 를 import 한다. insert → row 사상은 테스트가 손으로 쓴다 — 이번 diff 가 SQL·DTO 를 바꾸지 않아 plan 의 fake DB 범위대로 수용한다.

## 4. 기존 테스트 / semantic 검증 확인

- 기존 mapper 케이스 96 무수정 — 파일 110 중 신규 14.
- 등록 변이 재측정: M1~M8 8/8 검출, 실패 케이스 수가 구현 보고와 전부 같다. VP-03 M1(실 CLI) red.
- 자리 미지정 등록 변이: 해당 없음 — M1~M8 은 EP 자리를 지정한다.
- 이전 라운드 대조: r1 최초.
- 독립 축(보고에 없던 변이) X1~X5 5/5 검출.

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 delta 캡처 삭제 | mapper 110 | red 8 | VP-01 등록 |
| M2 assistant 양수에도 delta 우선 | mapper | red 2 (AC2·cache-only) | VP-01·05 등록 |
| M3 result 리셋 삭제 | mapper | red 2 (AC5·채널 이전 snapshot) | VP-01·07 등록 |
| M4 메인 체인 가드 삭제 | mapper | red 1 (AC4) | VP-01 등록 |
| M5 압축 경계 리셋 삭제 | mapper | red 1 (AC6 압축 전) | VP-01·07 등록 |
| M6 핸드오프 게이트 삭제 | mapper | red 1 (AC7) | VP-01·07 등록 |
| M7 첫 양수 유지(`??=`) | mapper | red 1 (AC1) | VP-01 등록 |
| M8 assistantContext 기록 삭제 | mapper | red 2 (AC2·cache-only) | VP-01·05 등록 |
| M1 (실 CLI) | smoke `--case=A` | red — `A turn 1: 0 !== 19075`, exit 1 | VP-03 등록 |
| X1 판정 `<= 0` → `< 0` | mapper | red 8 | 독립 — EP-03 경계값 |
| X2 delta 양수 가드 `> 0` → `>= 0` | mapper | red 1 (마지막 양수 유지) | 독립 — EP-01 가드 |
| X3 delta 병합을 input 만으로 축소 | mapper | red 2 (AC8·cache-only delta) | 독립 — 병합 공유 |
| X4 assistantContext 를 input 만으로(SSOT 이탈) | mapper | red 1 (cache-only assistant) | 독립 — D-009 |
| X5 리셋을 중복 UUID 검사 앞으로 이동 | mapper | red 1 (중복 result) | 독립 — EP-04① 순서 |

- 재현: `/tmp/mut0247/run.cjs` — 변이별 단독 적용 → `vitest run src/main/adapters/claude-map.test.ts` → finally 원문 복원. 실행 후 `git status` clean.
- `N회` 관측 주체: AC9 `insertTurnUsage` mock 1회/0회 — 호출부 `tracker.ts:55` 1곳.
- 순서 관측: 한 `MapContext` 에 메시지를 순서대로 넣는 UT(AC5·AC6·중복 result), 실 CLI 는 한 채널 3턴.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|
| VP-01 | MD-01 ↔ UT-01 | PASS | mapper 110/110 · M1~M8 red | 5/5 |
| VP-02 | AR-01 ↔ IT-01 | PASS | tracker AC9 2케이스 · 기존 reducer 게이트 케이스 | 3/3 |
| VP-03 | SD-01 ↔ ST-01 | PASS | smoke A~D 4그룹 `ok:true` · M1 smoke A red | 5/5 (실 경로) |
| VP-04 | R-01 ↔ AT-01 | **실기 대기** | AC10A·AC9 기계 범위 PASS, AC13 미실행 | 8/8 |
| VP-05 | R-02 ↔ AT-02 | PASS | AC2 · 기존 96 무수정 · smoke B `[19075,19135,0]` · M2/M8 | 2/2 |
| VP-06 | R-03 ↔ AT-03 | PASS | AC3 · AC9 0행 · smoke C `[0,0,0]` | 2/2 |
| VP-07 | R-04 ↔ AT-04 | PASS | AC5~7 · smoke A `/context` 0 · M3/M5/M6 | 3/3 |
| VP-08 | R-05 ↔ AT-05 | PASS | smoke A 창 200,000 · D 262,144 · `contextWindow.test.ts` 통과 | 0 |
| VP-09 | R-06 ↔ AT-06 | PASS | 세 문서 해당 문장 · inventory `--check` 통과 | 0 |

- root `PAIR_FAIL`: 없음. `BLOCKED_BY`: 없음.
- smoke oracle 은 픽스처 서버가 센 마지막 메인 요청 입력(`trueInputTokens`)이다 — 매퍼와 독립.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | UT 17,023, 비용·modelUsage·창 result 유지 · M1/M7/X1 red |
| AC2 | ✅ | UT 120·5,200 · M2/M8 red |
| AC3 | ✅ | UT 합 0 · smoke C |
| AC4 | ✅ | UT 합 0 · M4 red |
| AC5 | ✅ | UT 다음 턴 0 · M3 red |
| AC6 | ✅ | UT 30,000 / 31,000 · M5 red |
| AC7 | ✅ | UT 컨텍스트 3종 부재 · M6 red |
| AC8 | ✅ | UT input 1,200·cacheRead 30,000·cacheCreation 700 유지 · X3 red |
| AC9 | ✅ | tracker IT insert 1회(17,023) → 복원 17,023 · output-only 0회 |
| AC10 | ✅ | smoke A `[19075,19135,0]` · B 같음 · C `[0,0,0]` · D 창 262,144 |
| AC11 | ✅ | `contextWindow.test.ts` 통과(chat 스위트 내) |
| AC12 | ✅ | provider-runtime §8 "프록시 usage 폴백" · rendering §1.9 "컨텍스트 입력의 원천" · guide §3-e 2행 |
| AC13 | ⚠️ | 사람 실기 — 실 프록시·앱 재시작 |

- 합계 재측정: ✅ 12 · ⚠️ 1 · ❌ 0 = 총 13. 자기보고 12/13 과 일치.
- 합계 사본 대조: 본문 12/13 ↔ trailer `Criteria-Met: 12/13` ↔ INDEX 비고 `✅12·⚠️1` — 일치.

### pair별 plan §10 강제 지점 분모

| EP | 계약 | plan 자리 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| EP-01 | 메인 delta 마지막 양수 | 1 | `claude-map.ts:455-466` | 1/1 |
| EP-02 | assistant 합 기록 | 1 | `:538` (스냅샷 게이트 안) | 1/1 |
| EP-03 | 판정 | 1 | `:786-787` | 1/1 |
| EP-04 | result·압축 리셋 | 2 | `:746-747` · `:428` | 2/2 |
| EP-05 | 소비 게이트 | 3 | `tracker.ts:53` · `chatReducer.ts:1063` · `dto.ts:69` | 3/3 |

- 합 8/8 — 구현 보고 8/8 과 일치. 표 밖 필요 지점: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| lint | PASS | 0 error · 1 warning(`useTranscriptVirtualizer.ts:22`, 이번 diff 밖) · 실행 후 트리 변화 0 |
| typecheck | PASS | node·web·test 3구성 진단 0 |
| vitest (비-DB) | PASS | 262파일 중 261 pass / 2,328 중 2,323 pass. 실패 5 = `settlement.integration.test.ts` ABI 서명(아래) |
| smoke | PASS | exit 0, 4그룹 `ok:true`, `fixtureErrors` 전부 빈 배열 |
| doc inventory | PASS | generated·prose·links ok |
| trailer | PASS | `0d103854` 6키 파싱 |

- `settlement.integration.test.ts` 5실패: `NODE_MODULE_VERSION 140 … requires 127` — better-sqlite3 Electron ABI. 이 스위트는 `claude-map` 을 import 하는 DB 스위트라 Node ABI 로 전환해 다시 돌렸다 → 4파일 63/63 pass(`usage` 디렉토리 포함). 변경 무관.

## 7. 숫자 / 음성 기준 / 상한 재측정

- `message_delta` 비테스트 소비처: 1파일.
- `primaryModelScore` 사용: `claude-map.ts` 2자리(EP-01·EP-02).
- 0 기준(AC3·4·5)은 같은 픽스처의 양수 짝(AC1)과 함께 관측했다.
- 상한: 새 이벤트·요청 0.

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC13 | 실 CLI + 루프백 SSE 3형상(p1·delta·none) · 원장/복원 IT | 실 LiteLLM/OpenRouter 경유 비-Claude 모델로 도구 포함 2턴 → 도넛 표시, 값이 프록시 로그의 마지막 요청 입력과 일치, 앱 재시작 후 같은 값 복원 |

## 9. 게이트 재실행

- 실행: `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run src/main/adapters src/main/features/usage src/main/infra/ipc src/renderer/src/features/chat` · `node scripts/smoke-context-usage-sdk.mjs` · `node scripts/check-doc-inventory.mjs --check`.
- `npm test` 미사용. DB 스위트 1개만 `ensure-sqlite-abi.mjs node` 로 전환해 실행했다.
- 게이트의 트리 변경: 없음(`git status` clean).
- 잔여물: Electron ABI 복귀 중 0246 D1 을 재현했다 — `electron: rebuilt` 출력 뒤에도 바이너리가 plain Node 에서 로드됐다(`.forge-meta` = `x64--140`). `.forge-meta` 삭제 후 재실행 → `NODE_MODULE_VERSION 140` 확인. 또 `node scripts/ensure-sqlite-abi.mjs electron` 을 npm 밖에서 직접 부르면 `electron-builder.cmd` 를 PATH 에서 못 찾아 실패한다(`node_modules/.bin` 을 PATH 에 넣어 우회). 둘 다 이번 diff 밖 — §13 D2.
- 변이 runner 는 저장소 밖 `/tmp/mut0247` 에 있다.

## 11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: 구현 행 `impl/IMPL_DONE`·다음 Claude 는 실제 상태와 일치. 대상 커밋 자리표시자를 `f96bdbe8`(V1 설계) · `0d103854`(r1) 로 채운다(`git cat-file -t` 둘 다 commit). 구현자 비고 4줄.
- trailer: `Agent: codex` · `Handoff` · `Status: implemented` · `Criteria-Met: 12/13` · `Criteria-Pending` · `Verified-By: pending` — 허용값·파싱 모두 정상.
- `[구현자 기입]` 7필드: 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals — 7/7, 모두 표/목록 형식.
- plan 구현 보고 `대상 커밋` 행은 자리표시자 유지(좌표 정본은 INDEX).

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| I1 `MapContext` 주석 "턴 1회" → "채널 1회" | 타당 — plan §8 이 이미 지적 | 수용 |
| I2 rendering §1.9 분모 서술을 `contextWindowOf` 체인으로 정정 | 타당 — 코드와 일치 | 수용 |
| I3 프록시 턴 CLI 추정 비용 원장 노출 | D-010 비범위 — smoke A 턴1 `costUsd` 0.147 관측 | D1 NEXT_HANDOFF |
| I4 취소 턴 관측 잔존 | plan §13 수용 | 기록 |

- 문서 정정 과정에서 provider-runtime §8·rendering §1.9 의 "`else delete` 금지" 근거와 "`/context` 100% 일치 불가" 문장이 빠졌다. 근거는 `claude-map.ts` 주석(`:781-785`)에 남아 있다 — D3 NON_BLOCKING.

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | delta형 프록시 턴이 원장에 쌓이며 CLI 추정 단가 비용이 사용량 한도·세션 비용에 나타난다 | 비귀속 — D-010 명시 비범위, plan §6·§17 | NEXT_HANDOFF | 프록시 모델 비용 정책 handoff 후보 |
| D2 | `ensure-sqlite-abi.mjs electron` 의 false "rebuilt"(0246 D1 재현) + npm 밖 직접 호출 시 `electron-builder.cmd` PATH 미해결 | 비귀속(0104 도구) | NEXT_HANDOFF | 0246 D1 과 같은 후속 handoff 에 합친다 |
| D3 | arch 문서에서 필드 병합 `else delete` 금지 근거 문장 소실 | 비귀속 — AC12 는 충족 | NON_BLOCKING | 다음 문서 손질 때 한 줄 복원 고려 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음(r1).
- 관련 plan 지침/AC: EP-01~05·M1~M8 이 모두 있었고 전부 red 로 잠겼다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: better-sqlite3 ABI 전환 — 0246 D1 의 false "rebuilt" 가 다시 관측됐다.

## 15. 결론

- 상태: **PASS (기계 범위)**.
- pair 결과: REQUIRED PASS 8 · 실기 대기 1(VP-04 AC13) · PAIR_FAIL 0 · BLOCKED_BY 0.
- PLAN_GAP: 없음.
- ACTIVE Decision D-001~D-010 충족.
- AC: ✅ 12 · ⚠️ 1 · ❌ 0.
- 운영 gate: lint·typecheck·vitest(ABI 서명 5건 분리 후 Node ABI 재실행 green)·smoke·inventory·trailer PASS.
- NEXT_HANDOFF D1·D2 · NON_BLOCKING D3.
- 남은 사람 확인: AC13.
- 다음 단계: 사람 AC13 실기 → 통과 시 archive 이동.
