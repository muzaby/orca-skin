# Plan — 0247-proxy-context-usage-fallback

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**
> 설계 증거: [`probe-proxy-usage.mjs`](probe-proxy-usage.mjs) → [`probe-evidence.json`](probe-evidence.json) — 번들 CLI 2.1.286 을 루프백 프록시 모형에 붙여 관측했다(외부 호출 0).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0247-proxy-context-usage-fallback` |
| 작성자 | Claude Code |
| 일자 | 2026-10-02 |
| 매핑 | — |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: usage 를 `message_delta` 에만 싣는 프록시(LiteLLM·OpenRouter 류) 뒤에서는 컨텍스트 도넛이 뜨지 않는다. SDK assistant 프레임 usage 가 0/0 이고 Orca 가 그 0 으로 턴 컨텍스트를 덮는다 — probe `delta` 턴 3개 모두 Orca telemetry 컨텍스트 0.
- 완료 후 달라지는 것: 그 환경에서 턴이 끝날 때마다 도넛·패널이 마지막 요청의 실제 입력 컨텍스트를 보이고, 같은 값이 사용량 원장에 적재돼 재시작 후에도 복원된다.
- 바뀌지 않는 것: usage 를 정상 보고하는 환경(1P·Bedrock·usage 를 `message_start` 에 싣는 프록시)과 usage 를 전혀 주지 않는 프록시의 화면은 지금과 같다.
- 성공을 한 문장으로: **"프록시를 거쳐도 프록시가 usage 를 어딘가에 싣는 한, 매 턴 끝에 도넛이 실제 사용량으로 뜬다."**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "정상적인 메시지 반환에서 컨텍스트 사용량을 얻을 수 없을때 폴백모드로 동작할 수 있는 방안을 제시해야 한다. 다음 실측 배경처럼 컨텍스트 사용량을 추적할 수 있는 폴백 구현을 제안하라." | 라이브 세션 턴1 (2026-10-02) |
| 배경 입력 | 사용자 실험 요약(2026-10-01, Qwen3.8-27B, LiteLLM/OpenRouter, 5회) — §2-(나) "delta가 있는 환경에서는 이게 1순위 신호", §3 "(폐기) 세션 트랜스크립트 JSONL 파일" | 턴1 첨부 |
| 명시 결정 | 창: "Cli 설정값 사용하되, 없으면 폴백으로 200k 기본 정책으로" · 표기: "표기 없음 (Recommended)" | 턴2 질의 응답 |
| 명시 결정 | usage 미반환 프록시: "2단계 없음" — 앞선 질문 "Delta형으로 폴백하는거 아니었나? 그것도 안되는 상황을 묻는건가?" 에 그 상황이 맞다고 설명한 뒤의 답 | 턴3 질의 응답 |
| 추론 의도 | "폴백"은 정상 보고 환경을 바꾸지 않는다는 뜻으로 읽는다 — 조건절 "정상적인 메시지 반환에서 … 얻을 수 없을때" | 턴1 원문 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 1단계 폴백 = **메인 체인 `message_delta.usage`** 의 마지막 양수 관측. 이번 턴 메인 assistant usage 의 컨텍스트 합이 0 이거나 없을 때만 쓴다 | 사용자 "얻을 수 없을때 폴백모드" · 배경 §2-(나) · probe `delta` 요청별 값이 모형 서버 값과 일치 | 턴1 · 설계 | ACTIVE | — |
| D-002 | **2단계 폴백 없음** — `message_delta` 에도 usage 가 없는 프록시(probe `none`)는 현행대로 도넛을 갱신하지 않는다. 배경의 `/context`(CLI 재계산)·스트림 글자 수 추정·JSONL 은 채택하지 않는다 | 사용자 "2단계 없음" | 턴3 | ACTIVE | — |
| D-003 | 도넛 분모 = **CLI 설정값**(CLI 가 보고하는 `contextWindow` — 미지 모델은 `CLAUDE_CODE_MAX_CONTEXT_TOKENS`), 없으면 **200k 기본 정책**(현행 `contextWindowOf` 체인). 프록시 `/model/info` 조회는 하지 않는다 | 사용자 "Cli 설정값 사용하되, 없으면 폴백으로 200k 기본 정책으로" · 설정 시 CLI 압축 창도 같은 값(probe `delta-max262k`) | 턴2 | ACTIVE | — |
| D-004 | 폴백 값의 출처를 화면에 표기하지 않는다 — telemetry·IPC·DB 계약 무변경 | 사용자 "표기 없음 (Recommended)" | 턴2 | ACTIVE | — |
| D-005 | 세션 트랜스크립트 JSONL 은 읽지 않는다 | 배경 "(폐기) 세션 트랜스크립트 JSONL 파일" | 턴1 첨부 | ACTIVE | — |
| D-006 | assistant usage 가 양수인 턴의 컨텍스트 값은 바꾸지 않는다 — `message_delta` 가 다른 양수를 실어도 assistant 값이 이긴다 | D-001 조건절 · 0002/0065 의 "마지막 assistant 스냅샷" 계약 | 설계 | ACTIVE | — |
| D-007 | 폴백 관측은 **턴 단위**다 — result 와 압축 경계에서 비우고 다음 턴으로 넘기지 않는다. 채널 단위 `lastAssistantUsage` 의 현행 수명은 건드리지 않는다 | 로컬 명령 턴(`/context` 등)의 빈 컨텍스트 스킵 계약(rendering §1.9) 보존 | 설계 | ACTIVE | — |
| D-008 | 메인 체인만 본다 — `parent_tool_use_id` 가 있는 `message_delta`(서브에이전트) 와 핸드오프 도착 턴의 압축 전 구간은 제외한다 | 배경 "사이드체인 … 메인 context에 안 쌓임 → 제외" · 0127 승계 무효화 | 턴1 첨부 · 설계 | ACTIVE | — |
| D-009 | 컨텍스트 합 정의는 `shared/usage/primary-model.ts` 의 `primaryModelScore` 를 재사용한다 — 새 사본을 만들지 않는다 | 0149 SSOT("hasContextTokens 와 같은 정의") | 설계 | ACTIVE | — |
| D-010 | 원장 적재 규칙은 바꾸지 않는다 — 폴백 값도 `hasContextTokens` 게이트를 그대로 지나 적재·복원된다. 비용은 CLI 추정치(`modelUsage`) 그대로 | 재시작 후 복원(R-01)의 유일한 경로가 원장 최신 행 | 설계 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-010 (신규 handoff).
- 변경된 결정: 없음. 배경 문서의 제안 경로 중 `/model/info`(D-003)·`/context` resume·글자 수 추정·JSONL(D-002·D-005)은 사용자 응답으로 채택하지 않았다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0065 압축 근사, 0127 핸드오프 도착 무효화, 0134/0141 분모 체인, 0245 "창·요약 env 는 CLI 설정으로 관리"(guide §3-e) — §16.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1·AC10A · D-002↔AC3·AC10C · D-003↔AC10D·AC11 · D-004↔AC1(필드 무추가) · D-005↔§6 비범위 · D-006↔AC2 · D-007↔AC5·AC6 · D-008↔AC4·AC7 · D-009↔§10 EP-01·EP-02 · D-010↔AC9.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 원인은 두 겹이다 | CLI 는 assistant 프레임을 `message_start` usage(프록시 0/0)로 내보낸다(probe `delta` assistant `[0,0]`). Orca 는 키만 있으면 그 0 을 스냅샷으로 채택해 result 를 덮는다(`claude-map.ts:510`·`754-759`) |
| 이미 기존 코드가 충족하는가 | 아니오 | `stream_event` 분기는 `text_delta`·`thinking_delta` 만 읽고 `message_delta` 를 버린다(`claude-map.ts:436-465`) |
| 더 작은 해법이 있는가 | 예 — 배경의 4경로 중 1경로 | `message_delta` 하나로 사용자 환경(delta형)이 정확히 풀린다. 창은 CLI 설정으로 이미 표시된다(probe `delta-max262k` → Orca telemetry `contextWindow` 262,144) |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 — 8건 중 3건 정정 | 아래 표 |
| ACTIVE·기존 채택 결정과 충돌하는가 | 충돌 없음 | guide §3-e "창·요약 env 설정은 CLI 설정으로 관리한다. Orca가 기본값을 주입하지 않으므로"(`closed-network-extensions.md:740`) = D-003. raw secret 송출 예외 3곳 표(security §1.4-b) 무변경 |

**배경 문서 주장 ↔ probe 실측** (번들 CLI 2.1.286, 모델 `qwen3.8-27b`, 모형 서버 입력 = 요청 본문 길이/4)

| 배경 주장 | 실측 | 판정 |
|---|---|---|
| SDK assistant usage 0/0 | `delta`·`none` 메인 assistant 전부 `{input 0, output 0}` | 확인 |
| `message_delta.usage.input_tokens` = 요청별 현재 크기 | `delta` 턴1 `[15,432, 17,023]` = 모형 서버 값 | 확인 |
| `result.usage` = 요청 합산 | 32,455 = 15,432 + 17,023 (`p1` 도 32,440 = 15,419 + 17,021) | 확인 |
| JSONL 에 실제 값 | `delta` `[15,432, 17,023, 17,075]`, `none` 은 전부 0 | 확인 (delta형만) |
| `AUTO_COMPACT_WINDOW=150000` → `contextWindow` 150,000 | `contextWindow` 200,000 유지, `getContextUsage().rawMaxTokens` 만 150,000 | **정정** |
| `/context` 는 usage 미반환에서도 정확 | 프록시가 `count_tokens` 를 지원할 때만 정확(17,078). 미지원 `delta` 는 26,106(메시지 누락), `none` 은 로컬 추정 31,673 | **정정** |
| (다) 베이스 = 첫 요청 input − 추정 | usage 미반환 환경에는 첫 요청 input 자체가 없다 | **정정** — 성립 조건 부재 |
| 창 상한은 `/model/info` 만 신뢰 | `CLAUDE_CODE_MAX_CONTEXT_TOKENS=262144` → `contextWindow`·압축 창 모두 262,144 | 대안 확인 (D-003) |

- 사용자에게 올릴 결정: 없음 — 창·2단계·표기 3건은 턴2·턴3 에서 닫았다.
- 코드 조사로 닫은 사실: 원인 두 겹, `message_delta` 미사용, CLI 창 설정의 Orca 도달, 원장 누락(`tracker.ts:53`).

## 5. 동작 / 사용자 흐름

```text
[usage 를 message_delta 에 싣는 프록시 경유 모델로 메시지 전송]
  → CLI 가 요청 N회 수행 (도구 루프 포함)
  → 턴 종료
  → 도넛·패널 = 마지막 요청의 입력 컨텍스트 / CLI 창
  → 사용량 원장 1행 적재 → 재시작·세션 재진입 시 같은 값 복원
  ↘ usage 를 전혀 주지 않는 프록시: 도넛 갱신 없음 (현행)
  ↘ usage 를 정상 보고하는 환경: 현행 그대로
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| delta형 프록시 턴 종료 | 마지막 양수 `message_delta` 로 컨텍스트 결정 | 도넛 = 마지막 요청 입력 / 창. 원장 1행 |
| 정상 보고 환경 턴 종료 | 마지막 assistant usage (현행) | 현행과 같음 |
| usage 미반환 프록시 턴 종료 | 폴백 없음 | 도넛 갱신 없음 (현행) |
| 로컬 명령 턴(`/context`·`/help`) | 이번 턴 `message_delta` 관측 없음 → 현행 규칙(합성 assistant 0/0 스냅샷) | 직전 도넛 유지 — 현행과 같음 |
| 압축 턴 | 경계 이전 관측 폐기. 경계 이후 관측이 있으면 그 값, 없으면 현행 압축 근사 | 압축 후 값 |
| 핸드오프 도착 턴(압축 전) | 관측하지 않음 → 현행 무효화 | '미측정' 시작 (현행) |
| 앱 재시작·세션 재진입 | 원장 최신 행 복원 | delta형도 마지막 값 복원 (현행은 없음) |
| 창 설정 `CLAUDE_CODE_MAX_CONTEXT_TOKENS=262144` | CLI 가 그 값을 창·압축 기준으로 보고 | 분모 262k. 미설정이면 200k |

### 파생 UX / 엣지케이스

- loading / empty / error: 도넛은 턴 종료에만 갱신된다(현행). 오류 result 도 관측이 있으면 같은 규칙을 탄다(현행 assistant 경로와 같다).
- cancel / retry / close / restart: 취소로 result 가 오지 않은 턴의 관측은 다음 result 에서 비워진다 — 그 사이 값은 실제 최신 컨텍스트라 허용한다.
- concurrency / multi-session: 관측 상태는 채널(`MapContext`) 단위라 세션 간 공유가 없다.
- 표기: 출처 문구를 추가하지 않는다(D-004). 압축 임박 경고는 현행 `nearCompaction` 이 그대로 쓴다.
- 외부환경: 실제 프록시의 SSE 형상은 루프백 모형으로 대체 검증하고, 실 프록시 1회 확인은 사람 실기(AC13)다.

## 6. 범위 / 비범위

- **범위**: `claude-map` 의 `message_delta` 폴백(관측·판정·턴 경계 리셋) · 단위/통합 테스트 · opt-in 실 CLI smoke · 현재 상태 문서(`provider-runtime.md §8` · `rendering.md §1.9` · guide §3-e).
- **비범위**:
  - usage 미반환 프록시의 2단계 폴백 — `getContextUsage`·스트림 글자 수 추정·JSONL (D-002·D-005).
  - 프록시 `/model/info` 조회·창 자동 주입 (D-003).
  - 폴백 출처 표기 (D-004).
  - 프록시 모델 비용 정책 — CLI 가 미지 모델에 붙이는 추정 단가를 그대로 원장에 둔다(D-010).
  - `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 와 `nearCompaction` 버퍼(33k) 정합 — 분모가 `contextWindow` 이고 압축 창은 별개인 기존 한계.
  - 채널 단위 `lastAssistantUsage` carry-over 정리 (D-007).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| usage 미반환 프록시 지원 | 아니오 — §10 EP-03 판정 뒤에 단계 하나를 더하는 additive 변경 | 후속 handoff 후보 |
| 폴백 출처 표기 | 아니오 — optional 필드 additive. DB 영속까지 가면 그때 마이그레이션을 결정 | 후속 |
| 프록시 비용 표시 | 아니오 — 원장 값 정책만 바뀐다 | 후속 후보 (verify 에서 관측 시 NEXT_HANDOFF) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC10A · AC9 · AC13 | delta형 프록시에서 턴마다 telemetry 컨텍스트 = 마지막 메인 요청의 입력. 같은 값이 원장에 들어가 재시작 후 복원된다 | smoke A: 턴별 `contextTokens` = 모형 서버의 마지막 메인 요청 입력 · AC9 원장 1행·복원 값 · 사람 실기 AC13 | `SessionRuntime.send` → `ClaudeAdapter` → 번들 CLI → `claudeToNormalized` → telemetry |
| R-02 | AT-02 / AC2 · AC10B | assistant usage 가 양수인 환경의 컨텍스트 값은 바뀌지 않는다 | UT AC2 · 기존 컨텍스트 UT 무수정 통과 · smoke B | 같은 경로, assistant 분기 |
| R-03 | AT-03 / AC3 · AC10C | usage 미반환 프록시는 telemetry 컨텍스트 0 — 도넛 미갱신·원장 0행(현행) | UT AC3 · smoke C · `tracker.test.ts` 빈 컨텍스트 케이스 | 같은 경로 → tracker 게이트 |
| R-04 | AT-04 / AC5 · AC6 · AC7 · AC10A | 로컬 명령 턴은 0(직전 유지), 압축 턴은 경계 이후 값 또는 현행 근사, 핸드오프 도착 턴은 현행 무효화 | UT AC5~AC7 · smoke A 의 `/context` 턴 0 | 같은 경로, result 판정 |
| R-05 | AT-05 / AC10D · AC11 | 분모 = CLI 보고 창. `CLAUDE_CODE_MAX_CONTEXT_TOKENS=262144` 면 262,144, 미설정이면 200,000. 출처 표기 없음 | smoke D `telemetry.contextWindow` · `contextWindow.test.ts` ①·③ | CLI `modelUsage` → `normalizeResultTelemetry` → `contextWindowOf` |
| R-06 | AT-06 / AC12 | 현재 상태 문서와 운영 가이드가 폴백·미지원 범위·창 설정을 서술한다 | 문서 본문 `rg` · doc inventory `--check` | 문서 |

**모듈·통합 AC** (R 아래 레벨 — MD↔UT · AR↔IT 의 증거)

| AC | 동작 기준 | 검증 수단 |
|---|---|---|
| AC1 | delta형 다요청 턴: 메인 assistant `{0,0}`×2, 메인 `message_delta` input 15,432 → 17,023, result `usage.input_tokens` 32,455 → telemetry `inputTokens` **17,023**. `costUsd`·`modelUsage`·`contextWindow`·`model` 은 result 값 그대로 | `claude-map` UT |
| AC2 | 정상 보고 보존: 메인 assistant `{input 120, cache_read 5,200}` 뒤 메인 `message_delta` input 999 → telemetry `inputTokens` 120·`cacheReadTokens` 5,200. 기존 컨텍스트 UT(`claude-map.test.ts:712`·`763`·`779`·`1088`~`1330`) 무수정 통과 | `claude-map` UT |
| AC3 | usage 미반환: 메인 assistant `{0,0}` + `message_delta` output 만 → telemetry 컨텍스트 합 0 | `claude-map` UT |
| AC4 | 사이드체인 제외: `parent_tool_use_id` 가 있는 `message_delta`(input 50,000)만 양수 → telemetry 컨텍스트 합 0 | `claude-map` UT |
| AC5 | 턴 경계: 턴 N 이 17,023 으로 끝난 뒤 턴 N+1(합성 assistant `{0,0,0,0}`·`message_delta` 없음) → 턴 N+1 telemetry 컨텍스트 합 0 (17,023 누수 없음) | `claude-map` UT (한 ctx 로 두 턴) |
| AC6 | 압축 경계: 경계 전 `message_delta` 150,000 → `compact_boundary`(post_tokens 30,000) → result → `inputTokens` 30,000(현행 근사). 경계 뒤 `message_delta` 31,000 이 있으면 31,000 | `claude-map` UT 2케이스 |
| AC7 | 핸드오프 도착(`handoffArrival`, 압축 전): 메인 `message_delta` 90,000 → result 에 컨텍스트 3종 없음(현행 삭제) | `claude-map` UT |
| AC8 | 필드 병합: `message_delta` 가 input 1,200·cache_read 30,000·cache_creation `null` → telemetry input 1,200·cacheRead 30,000·cacheCreation 은 result 값 유지(현행 병합 규칙과 같다) | `claude-map` UT |
| AC9 | 원장·복원: AC1 telemetry → `UsageTracker.recordTurnUsage` 가 `insertTurnUsage` 1회(input 17,023) → 그 행을 `usageRowToTelemetry` 로 복원하면 컨텍스트 합 17,023. AC3 telemetry 는 `insertTurnUsage` 0회 | 통합 테스트(fake DB) |
| AC10 | smoke(실 CLI·루프백): A delta형 3턴(도구 루프 턴·일반 턴·`/context`) = `[마지막 요청 입력, 마지막 요청 입력, 0]` · B 1P형 같은 3턴 = 같은 규칙 · C usage 미반환 = `[0, 0, 0]` · D `CLAUDE_CODE_MAX_CONTEXT_TOKENS=262144` → `contextWindow` 262,144 (A 는 200,000) | `node scripts/smoke-context-usage-sdk.mjs` |
| AC11 | 분모 체인 무변경: `contextWindow.test.ts` ① top-level 실측 우선 · ③ 실측 부재면 200k 케이스 통과 | 기존 renderer UT |
| AC12 | `provider-runtime.md §8`·`rendering.md §1.9` 가 "assistant usage 가 0/부재면 메인 `message_delta` usage, 둘 다 없으면 미갱신"을 서술. guide §3-e 에 "프록시 모델 창 = `CLAUDE_CODE_MAX_CONTEXT_TOKENS`(도넛·압축 공통)"·"usage 미반환 프록시는 도넛 미지원" 행 | `rg` · doc inventory `--check` |
| AC13 | 사람 실기: 실 프록시(LiteLLM 또는 OpenRouter 경유 비-Claude 모델)에서 도구 포함 2턴 → 도넛 표시·값이 프록시 로그의 마지막 요청 입력과 일치·앱 재시작 후 복원 | 사람 실기 |

### AC 검증 주의사항

- 기존 테스트 재사용: `claude-map.test.ts:712`(멀티스텝)·`763`(graceful fallback)·`779`(cache 보존)·`1088`·`1128`·`1159`·`1181`(압축)·`1208`·`1244`·`1278`·`1300`(핸드오프), `tracker.test.ts:389`·`408`(빈 컨텍스트), `chatReducer.usage.test.ts:34`·`74`(reducer 게이트), `contextWindow.test.ts:35`·`48` 케이스 존재를 확인했다.
- 사람 실기 항목: AC13 만 — 실 프록시의 SSE 형상은 사용자 환경에만 있다. 판정 로직은 UT·IT·smoke 로 기계 검증한다.
- N회 기준: AC9 의 `insertTurnUsage` 1회/0회 — sink 호출부는 `tracker.ts:55` 1곳(`rg -n "insertTurnUsage\(" app/src/main --glob '!*.test.*'` → 정의 `usage-queries.ts` + 호출 `tracker.ts` 1). 관측 주체(fake DB)가 그 호출부를 직접 모형한다.
- 순서 기준: AC5·AC6 은 한 `MapContext` 에 메시지를 순서대로 넣어 관측한다.
- 0건 기준: AC3·AC4·AC5 의 "합 0" 은 같은 픽스처에 양수 `message_delta` 를 메인으로 옮기면 양수가 되는 짝(AC1)과 함께 읽는다 — 0 은 관측 실패가 아니라 판정 결과다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 이 경로(telemetry 컨텍스트 산출)를 명시적 V 로 소유한 기존 handoff 가 없다(0002·0065·0127·0134·0141 은 V 도입 전).
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 delta형 도넛·원장·복원 | NEW | — |
| R-02 | R | §7 정상 보고 환경 불변 | NEW | — |
| R-03 | R | §7 usage 미반환 현행 유지 | NEW | — |
| R-04 | R | §7 로컬 명령·압축·핸드오프 규칙 유지 | NEW | — |
| R-05 | R | §7 분모 출처·표기 없음 | NEW | — |
| R-06 | R | §7 문서 | NEW | — |
| AT-01..AT-06 | AT | §7 R 행의 AT | NEW | — |
| SD-01 | SD | §5·§13 턴 단위 관측 수명 — 관측 → result 판정 → 리셋, 한 채널 다턴 | NEW | — |
| ST-01 | ST | AC10 smoke A~D | NEW | — |
| AR-01 | AR | §9·§12 telemetry → 원장 → 복원 → 화면 게이트 | NEW | — |
| IT-01 | IT | AC9 | NEW | — |
| MD-01 | MD | §10 EP-01~EP-04 `claude-map` 폴백 규칙 | NEW | — |
| UT-01 | UT | AC1~AC8 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | MD-01 ↔ UT-01 | REQUIRED | `stream_event(message_delta)`·`assistant`·`compact_boundary`·`result` → `claudeToNormalized` → `ctx.turnUsage` → telemetry `usage` | AC1~AC8 의 `inputTokens`/`cacheReadTokens` 값 | **required** — 우선순위·턴 경계·게이트는 행복 경로 1케이스로 잠기지 않는다. M1~M8 (§10 아래), 자리 EP-01~EP-04 | EP-01~EP-04 (5자리) |
| VP-02 | AR-01 ↔ IT-01 | REQUIRED | telemetry → `UsageTracker.recordTurnUsage` → `insertTurnUsage` → 행 → `usageRowToTelemetry` → 컨텍스트 합 · telemetry → `chatReducer` → `lastTelemetry` | AC9 의 17,023 왕복 · 0행 · reducer 게이트는 무변경 기존 케이스 `chatReducer.usage.test.ts:34`·`74` | not selected — 값이 끝까지 직접 관측된다 | EP-05 (3자리) |
| VP-03 | SD-01 ↔ ST-01 | REQUIRED | `SessionRuntime.send` → `ClaudeAdapter.sendMessage`(`includePartialMessages`) → 번들 CLI → 루프백 SSE → `claudeToNormalized` → 프레임 telemetry, 한 채널 3턴 | AC10 A~D 턴별 값 | **required** — 실 CLI 가 usage 를 싣는 자리가 바뀌면 UT 만으로는 모른다. M1 적용 시 smoke A 가 red 여야 한다 | EP-01~EP-04 (5자리, 실 경로) |
| VP-04 | R-01 ↔ AT-01 | REQUIRED | 프록시 환경 → VP-03 경로 → 원장 → 재시작 복원 | AC10A(라이브 값) · AC9(원장·복원) · AC13(실 프록시·재시작) | not selected — 직접 관측 | EP-01~EP-05 (8자리) |
| VP-05 | R-02 ↔ AT-02 | REQUIRED | 정상 보고 환경 → assistant 분기 → result | AC2 · 기존 UT · AC10B | required — M2·M8 (VP-01 과 공유, 자리 EP-02·EP-03) | EP-02·EP-03 (2자리) |
| VP-06 | R-03 ↔ AT-03 | REQUIRED | usage 미반환 → result → tracker 게이트 | AC3 · AC10C · `tracker.test.ts:389`·`408` | not selected — 0 과 짝 양수(AC1)를 함께 본다 | EP-01 양수 가드·EP-03 (2자리) |
| VP-07 | R-04 ↔ AT-04 | REQUIRED | 로컬 명령·압축·핸드오프 턴 → result 판정 | AC5~AC7 · AC10A `/context` 턴 | required — M3·M5·M6 (VP-01 과 공유) | EP-01 핸드오프 게이트·EP-04 (3자리) |
| VP-08 | R-05 ↔ AT-05 | REQUIRED | CLI `modelUsage[].contextWindow` → `normalizeResultTelemetry`(`claude-map.ts:903-908`) → `contextWindowOf` | AC10D · AC11 | not selected — 분모 코드 무변경, 값 직접 관측 | 0 — 이번 변경이 분모 경로를 건드리지 않는다 |
| VP-09 | R-06 ↔ AT-06 | REQUIRED | 문서 | AC12 | not selected | 0 — 문서 |

`§10 강제 지점 전수`의 N 은 §10 항목 수가 아니라 자리 수다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| lint | `app/src/**`·`app/scripts/**` 수정 | `cd app && npm run lint` (`--fix` — 실행 후 트리 변화 확인) | 현재 변경이 만든 error 만 blocking |
| typecheck | 같음 | `cd app && npm run typecheck` | 같음 |
| vitest (비-DB) | 같음 | `cd app && ./node_modules/.bin/vitest run src/main/adapters src/main/features/usage src/main/infra/ipc src/renderer/src/features/chat` | 같음. DB 로드 스위트는 범위 밖 |
| smoke | ST·AT 증거 (CI 밖, 선례 0246 D-012) | `cd app && node scripts/smoke-context-usage-sdk.mjs` → exit 0 | 불일치 1건이라도 blocking |
| doc inventory | `docs/**` 수정 | `cd app && node scripts/check-doc-inventory.mjs --check` | 같음 |
| trailer | 커밋 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| SDK 를 `includePartialMessages: true` 로 띄운다 — `stream_event` 가 이미 들어온다 | `app/src/main/adapters/claude.ts:485` |
| `stream_event` 는 `text_delta`·`thinking_delta` 만 정규화하고 나머지는 `[]` | `app/src/main/adapters/claude-map.ts:436-465` |
| assistant usage 스냅샷은 숫자 키가 하나라도 있으면 채택 — `{0,0}` 도 채택 | `claude-map.ts:496-511` |
| result 는 스냅샷 필드만 덮는다(필드 병합). 스냅샷 없으면 압축 근사 → 핸드오프 삭제 → result.usage | `claude-map.ts:749-789` |
| `compact_boundary` 가 스냅샷을 지운다 | `claude-map.ts:420-422` |
| 턴 경계 리셋 선례 — result 에서 `lastAssistantText` 를 비운다 | `claude-map.ts:713-715` |
| `MapContext` 는 채널 단위 — 장수명 채널(0067) 하나에 1회 생성돼 모든 턴이 공유한다. `claude-map.ts:73` 주석의 "턴 1회 생성"은 0067 이전 서술 | `app/src/main/adapters/claude.ts:391-395` |
| 원장 적재 게이트 = input+cacheRead+cacheCreation > 0 | `app/src/main/features/usage/tracker.ts:53`·`299-303` |
| renderer 갱신 게이트 = `contextTokens > 0` | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:1063` |
| 복원 = 원장 최신 행 → `usageRowToTelemetry` | `app/src/main/features/history/reader.ts:37-38` · `app/src/main/infra/ipc/dto.ts:69-95` |
| 분모 체인 ① top-level ② modelUsage ③ `contextWindowFor`(200k / `1m`) | `app/src/renderer/src/features/chat/lib/contextWindow.ts:15-36` |
| 컨텍스트 합 SSOT `primaryModelScore` (shared, 양 프로세스) | `app/src/shared/usage/primary-model.ts:20-22` |
| SDK `message_delta.usage` 타입: `input_tokens`·`cache_*` 는 `number \| null`, `output_tokens: number` | `@anthropic-ai/sdk` `BetaMessageDeltaUsage` (`messages.d.mts:1613-1658`) |
| CLI 창 결정: 미지 모델 + `CLAUDE_CODE_MAX_CONTEXT_TOKENS` → 그 값, 아니면 200,000 | 번들 CLI 2.1.286 문자열(`lv()` · "set CLAUDE_CODE_MAX_CONTEXT_TOKENS to its real window") · study `08 §8.2` 5행 |
| 프레임은 terminal(telemetry) 에서 닫힌다 — 턴 뒤 이벤트는 프레임 밖으로 샌다 | `app/src/main/features/sessions/session-runtime.ts:134-136`·`641-653` |
| 실 CLI opt-in smoke 선례(루프백 픽스처·`SessionRuntime` 경유) | `app/scripts/smoke-effort-sdk.mjs:182-220` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| telemetry 생산자 | `rg -n "type: 'telemetry'" app/src/main --glob '!*.test.*'` | 3 | `claude-map.ts:792`(실), `mock-scenarios.ts:687`(dev), `turn-coordinator.ts:555`(usage 없는 합성). 컨텍스트 값 생산자는 claude 경로에서 `claude-map` 하나 |
| `stream_event` 소비 | `rg -n "stream_event" app/src/main --glob '!*.test.*'` | 3 | `claude-map.ts:436`(정규화) · `claude.ts:660`·`679`(응답 스코프·영수증 — usage 무관) |
| `message_delta`/`message_start` 를 다루는 코드·테스트 | `rg -n "message_delta\|message_start" app/src` | 0 | 관측 지점이 없다 — 신설 |
| `lastAssistantUsage` 참조 | `rg -n "lastAssistantUsage" --glob '!docs/handoff/**' --glob '!docs/archive/**'` | 코드 6줄 · 테스트 4줄 · 문서 2줄 (`-c`) | 수명·이름 무변경(D-007) |
| `insertTurnUsage(` 호출 | `rg -n "insertTurnUsage\(" app/src/main --glob '!*.test.*'` | 호출 1 | `tracker.ts:55` |

### 수치 / 전칭 표현 검산

- 재측정 수치: probe 7런 — `p1`·`delta`·`delta-ct200`·`none`·`none-ct200` 각 3턴, `delta-acw150k`·`delta-max262k` 각 1턴 = 17턴.
- 내역 합 = 총계: `delta` 턴1 15,432 + 17,023 = 32,455 = `result.usage.input_tokens`. `p1` 턴1 15,419 + 17,021 = 32,440.
- "모든 메인 assistant 프레임에 usage 객체가 있다": probe 17턴의 메인 assistant 관측에 `usage` 부재 0건 — 현행 graceful fallback(`claude-map.test.ts:763`)은 실 스트림에서 도달하지 않는다.
- 문서 앵커: `rendering.md §1.9`(`:188`) · `provider-runtime.md §8`(`:340`) · guide `### 3-e`(`:731`) · study `08 §8.2`(`:18`) 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`, `MD-01`
- 현재 책임 소유자: `claude-map`(SDK → telemetry 컨텍스트 산출) — 순수 매퍼, 채널 `MapContext` 공유.
- 문제의 직접 원인: delta형 프록시에서 assistant `{0,0}` 이 스냅샷으로 채택되고, 실제 값이 실린 `message_delta` 는 버려진다.

```text
CLI stream (includePartialMessages)
  ├ stream_event message_start/…/message_delta → text·thinking delta 만, message_delta 버림 (436-465)
  ├ assistant usage {0,0}                       → ctx.lastAssistantUsage = {0,0}   (510)
  └ result usage 32,455(합산)                  → 컨텍스트 3종을 {0,0} 으로 덮음   (754-759)
       → telemetry 컨텍스트 0
          → tracker hasContextTokens=false → 원장 0행        (tracker.ts:53)
          → reducer contextTokens=0 → lastTelemetry 미갱신   (chatReducer.ts:1063)
          → 도넛 없음 · 재시작 복원 대상 없음
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `MD-01`
- 변경 후 책임 소유자: 그대로 `claude-map`. 턴 단위 관측 `ctx.turnUsage` 를 더한다.
- 유지: 채널 `lastAssistantUsage`·압축 근사·핸드오프 무효화·필드 병합·소비 게이트 전부. 제거·이동한 책임 없음.

```text
CLI stream
  ├ stream_event message_delta (메인·게이트·합>0)  → ctx.turnUsage.delta = 마지막 값       EP-01
  ├ assistant usage (현행 게이트)                  → lastAssistantUsage(현행)
  │                                                 + ctx.turnUsage.assistantContext = 합   EP-02
  ├ system/compact_boundary                        → delete ctx.turnUsage (현행 삭제 옆)    EP-04②
  └ result → turn = ctx.turnUsage; ctx.turnUsage = undefined                                EP-04①
       → turn.delta ∧ (assistantContext 없음 또는 0) → delta 로 컨텍스트 3종 필드 병합      EP-03
         아니면 → 현행 체인(lastAssistantUsage → 압축 근사 → 핸드오프 삭제 → result.usage)
       → telemetry 컨텍스트 17,023 → 원장 1행 → 도넛 → 재시작 복원                            EP-05(무변경)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | `claude-map` 단독 | 같음 | 생산자 한 곳 유지 | MD-01 / VP-01 · `claude-map.ts` |
| data/control flow | `message_delta` 버림 | 메인 `message_delta` 를 턴 관측으로 저장 | D-001 | SD-01 / VP-03 · smoke A |
| state/contract | `MapContext.lastAssistantUsage`(채널) | + `MapContext.turnUsage`(턴). shared·IPC·DB 무변경 | D-004·D-007 | MD-01 / VP-01 · 타입 |
| error/lifecycle | 압축 경계에서 스냅샷 삭제 | + 턴 관측도 삭제, result 에서 턴 관측 리셋 | D-007 | SD-01 / VP-07 · AC5·AC6 |
| test seam/관측점 | `claude-map` UT | + 원장 IT + 실 CLI smoke | VP-02·VP-03 | IT-01·ST-01 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `adapters/claude-map.ts` | 턴 관측·판정·리셋 | SDKMessage → NormalizedEvent | `claude.ts` |
| `shared/usage/primary-model.ts` | 컨텍스트 합 정의(무변경) | usage → number | `claude-map.ts`(신규 사용) · `dto.ts` · 기존 |
| `features/usage/tracker.ts` | 원장 게이트(무변경) | telemetry → 행 | bootstrap 구독 |
| `scripts/smoke-context-usage-sdk.mjs` | 실 CLI 증거(신규, opt-in) | 루프백 SSE → 판정 | 사람·검증자 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| MD-01 / VP-01·03·04·06·07 | **EP-01** `message_delta` 관측 — 메인 체인(`readParentToolRunId(msg) === undefined`) ∧ `!(ctx.handoffArrival && ctx.compacted !== true)` ∧ 컨텍스트 합 > 0 일 때만 `turnUsage.delta` 를 그 값으로 **교체**(마지막 값). 1자리 | `primaryModelScore` | `claude-map` stream_event 분기 | `stream_event` 수신 | 사이드체인·승계·output-only 값이 메인 컨텍스트가 되거나 첫 요청 값이 남는다 |
| MD-01 / VP-01·03·04·05 | **EP-02** assistant 관측 — 현행 스냅샷 게이트 안에서 `turnUsage.assistantContext = primaryModelScore(snapshot)`(0 포함). 1자리 | 같음 | `claude-map` assistant 분기 | assistant 수신 | 1P 양수가 있어도 delta 가 덮거나, `{0,0}` 턴에 폴백이 안 켜진다 |
| MD-01 / VP-01·03·04·05·06 | **EP-03** 판정 — `turn.delta` 존재 ∧ `(turn.assistantContext ?? 0) <= 0` 이면 delta 의 정의된 필드로 `inputTokens`·`cacheReadTokens`·`cacheCreationTokens` 를 덮는다. 아니면 현행 체인. 1자리 | 본 표 | `claude-map` result 분기 | result 수신 | 1P 값이 바뀌거나 폴백이 안 켜진다 |
| MD-01 / VP-01·03·04·07 | **EP-04** 턴 경계 리셋 — ① result(`lastAssistantText` 리셋과 같은 자리, 판정 전에 읽고 비운다) ② `compact_boundary`(`delete ctx.lastAssistantUsage` 옆). 2자리 | 본 표 | `claude-map` | result·경계 수신 | 이전 턴·압축 전 값이 다음 턴·압축 후로 샌다 |
| AR-01 / VP-02·04 | **EP-05** 소비 게이트 3자리 — ① `tracker.ts:53` `hasContextTokens` ② `chatReducer.ts:1063` `contextTokens > 0` ③ `dto.ts:69-95` 복원. **무변경 상속** | 기존 | tracker·reducer·dto | 턴 종료·세션 로드 | 폴백 값이 원장·화면·복원 중 한 곳에서 빠진다 |

**등록 적대 증거** — 구현자·검증자가 자리마다 심어 red 를 확인한다.

| M | 자리 | 변이 | 기대 red |
|---|---|---|---|
| M1 | EP-01 | `message_delta` 캡처 제거 | AC1(0 ≠ 17,023) · smoke A |
| M2 | EP-03 | 우선순위 역전 — assistant 양수여도 delta 사용 | AC2(999 ≠ 120) |
| M3 | EP-04① | result 리셋 제거 | AC5(턴 N+1 에 17,023) |
| M4 | EP-01 | 메인 체인 가드 제거 | AC4 |
| M5 | EP-04② | 압축 경계 리셋 제거 | AC6(150,000 사용) |
| M6 | EP-01 | 핸드오프 게이트 제거 | AC7 |
| M7 | EP-01 | 교체 대신 첫 양수 유지 | AC1(15,432 ≠ 17,023) |
| M8 | EP-02 | `assistantContext` 기록 제거(항상 부재) | AC2(delta 999 가 덮음) |

- 같은/동일 규칙의 SSOT: 컨텍스트 합 = `primaryModelScore`(D-009). `claude-map` 은 이 함수를 import 해 EP-01·EP-02 에서 쓴다 — 정규식·합산식 사본 0. 관측: `rg -n "primaryModelScore" app/src/main/adapters/claude-map.ts` ≥ 2 (EP-01·EP-02), 수식 `(\?\? 0\) \+` 의 신규 사본 0.
- `실패 의미`에 "다른 게이트가 막는다"를 적지 않았다.
- 선택적 필드 의미: `turnUsage` 미정의 = 이번 턴 관측 없음. `assistantContext` 미정의 = 이번 턴 메인 assistant usage 없음(0 과 같이 폴백 허용). `delta` 미정의 = 양수 관측 없음(폴백 불가).
- 외부 SDK 경계: `message_delta` 의 `event.usage` 는 `null` 필드를 가질 수 있다 — 기존 `assignNums`(숫자만 복사)로 좁힌다. `event` 의 타입 좁히기는 현행처럼 구조적 캐스트로 하고 SDK 타입 값 import 는 하지 않는다(매퍼 순수성, `claude-map.ts:2`).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/claude-map.ts` | 턴 관측·판정·리셋 | 아래 스케치 | 순수 단위 |
| `app/src/main/adapters/claude-map.test.ts` | UT-01 | AC1~AC8 신규 `describe` | — |
| `app/src/main/features/usage/tracker.test.ts` (또는 같은 디렉토리 신규 `*.test.ts`) | IT-01 | AC9 — `claudeToNormalized` → `UsageTracker`(기존 `fakeDb`) → `usageRowToTelemetry` | fake DB |
| `app/scripts/smoke-context-usage-sdk.mjs` (신규) | ST-01 | AC10 A~D | opt-in, CI 밖 |
| `docs/arch/backend/provider-runtime.md` §8 | 현재 상태 | 폴백 bullet | — |
| `docs/arch/frontend/rendering.md` §1.9 | 현재 상태 | 컨텍스트 입력 bullet 보강 | — |
| `docs/guides/closed-network-extensions.md` §3-e | 운영 | 2행 추가 | — |

### `claude-map.ts` 스케치 (계약은 §10, 코드는 구현자 재량)

```ts
type UsageSnapshot = NonNullable<MapContext['lastAssistantUsage']>

// MapContext 에 추가 — 이번 턴(다음 result 까지) 메인 체인 usage 관측. 폴백 판정 전용(0247).
// assistantContext: 마지막 메인 assistant usage 의 컨텍스트 합(0 포함 — 프록시는 0/0 을 싣는다).
// delta: 마지막 **양수** 메인 message_delta usage. result·compact_boundary 에서 비운다.
turnUsage?: { assistantContext?: number; delta?: UsageSnapshot }

// stream_event 분기 첫머리 (EP-01) — 이벤트는 내지 않는다(현행 [] 유지)
if (ev?.type === 'message_delta') {
  if (parentToolRunId === undefined && !(ctx.handoffArrival && ctx.compacted !== true)) {
    const snapshot: UsageSnapshot = {}
    assignNums(snapshot, { inputTokens: u?.input_tokens, outputTokens: u?.output_tokens,
      cacheReadTokens: u?.cache_read_input_tokens, cacheCreationTokens: u?.cache_creation_input_tokens })
    if (primaryModelScore(snapshot) > 0) (ctx.turnUsage ??= {}).delta = snapshot
  }
  return []
}

// assistant 분기 — 현행 스냅샷 생성 직후, 같은 게이트 안 (EP-02)
;(ctx.turnUsage ??= {}).assistantContext = primaryModelScore(snapshot)

// compact_boundary — delete ctx.lastAssistantUsage 옆 (EP-04②)
delete ctx.turnUsage

// result — lastAssistantText 리셋 자리에서 읽고 비운다 (EP-04①), 판정 (EP-03)
const turn = ctx.turnUsage
ctx.turnUsage = undefined
if (telemetry && turn?.delta && !((turn.assistantContext ?? 0) > 0)) {
  overrideContext(telemetry, turn.delta)   // 현행 필드 병합과 같은 함수로 뽑는다
} else if (telemetry && ctx.lastAssistantUsage) { /* 현행 */ }
else if (telemetry && ctx.compacted) { /* 현행 */ }
else if (telemetry && ctx.handoffArrival) { /* 현행 */ }
```

- 필드 병합: 현행 `754-759` 의 "정의된 필드만 덮는다"를 함수로 뽑아 assistant·delta 두 경로가 같이 쓴다 — 규칙 사본을 두지 않는다.
- `event` 좁히기 타입에 `type?: string; usage?: Record<string, unknown>` 를 더한다. `delta.type` 분기(텍스트·생각)는 그대로다.
- 순서: result 분기에서 중복 result UUID 조기 반환(`707-712`) 뒤, `lastAssistantText` 리셋과 같은 자리에서 `turnUsage` 를 읽고 비운다 — 중복 result 가 현재 턴 관측을 지우지 않는다.

### smoke (`app/scripts/smoke-context-usage-sdk.mjs`)

- 형태: `smoke-effort-sdk.mjs` 와 같다 — `node:http` 루프백 `/v1/messages`(SSE) · vite `ssrLoadModule` 로 `/src/main/adapters/claude.ts`·`/src/main/features/sessions/session-runtime.ts` 로드 · env `HOME`=임시, `ANTHROPIC_BASE_URL`=루프백, `ANTHROPIC_AUTH_TOKEN`=`local-fixture`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, 모델 `qwen3.8-27b`.
- 픽스처 usage 형태: probe 와 같다(`p1`·`delta`·`none`). 마지막 `READ_FIXTURE_FILE` 지시 뒤 `tool_result` 가 없으면 `Read` 도구를 부르는 도구 루프. 입력 토큰 = 요청 본문 길이/4.
- 실행: 케이스마다 `new SessionRuntime(new ClaudeAdapter())` 한 채널로 3턴(`READ_FIXTURE_FILE …` · 일반 · `/context`)을 `runtime.send` 하고 프레임의 telemetry `usage` 를 읽는다.
- 단언: A·B 턴1·2 = 그 턴 마지막 메인 요청(`tools > 0`)의 입력, 턴3 = 0 · C 전 턴 0 · D(`CLAUDE_CODE_MAX_CONTEXT_TOKENS=262144`, delta형 1턴) `contextWindow === 262144` · A `contextWindow === 200000`.
- 증거: 결과 JSON 을 임시 폴더에 쓰고 경로를 출력한다(선례와 같다).

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: `claude-map.ts` 는 이미 순수(`claude-map.ts:2`) — 새 seam 불필요. IT 는 기존 `fakeDb` 를 재사용한다.
- 기존 메커니즘 재사용: 필드 병합·`assignNums`·`readParentToolRunId`·`primaryModelScore`·smoke 하네스 — 모두 같은 메시지·같은 시점에서 쓰인다.
- 순서 관측: 한 `MapContext` 에 메시지를 순서대로 넣는다(AC5·AC6). 실 CLI 순서는 smoke 의 한 채널 3턴이 본다.

## 12. End-to-end 영향

### producer → consumer

```text
CLI(message_delta) → claude-map(EP-01~04) → telemetry → bus usage 구독(tracker) → turn_usage
                                                      → relay → chatReducer.lastTelemetry → 도넛·패널
turn_usage 최신 행 → reader → usageRowToTelemetry → LOAD_SESSION → 도넛
```

- producer 기준: telemetry 컨텍스트 3종 = 그 턴 마지막 요청의 입력(정상 보고면 assistant, 아니면 `message_delta`).
- consumer 파생 규칙: `contextTokens`·`hasContextTokens`·`primaryModelScore` — 모두 input+cacheRead+cacheCreation(무변경).
- 파생 합성값이 정본을 우회하지 않는가: 출처 필드를 새로 만들지 않는다(D-004) — 우회 대상 없음.

### 기존 소비처 영향

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `UsageTracker.recordTurnUsage` (`tracker.ts:51-93`) | delta형 턴도 1행 적재(현행 0행). 비용은 CLI 추정치 그대로 — 사용량 한도 화면에 프록시 턴 비용이 나타난다 | AC9 · `tracker.test.ts:389`·`408` |
| 세션 비용 시드 `SUM(total_cost_usd)` (`usage-queries.ts:59`) | delta형 세션도 재로드 시 비용이 시드된다 | AC9 (같은 행) |
| `chatReducer` telemetry (`chatReducer.ts:1063`) | delta형 턴에서 `lastTelemetry` 갱신 시작 | AC10A · AC13 |
| `Composer` 도넛·상태 모델 (`Composer.tsx:206-222`·`421-450`) | 표시 시작, 분모는 `contextWindowOf` 그대로 | AC11 |
| `UsagePanel` (`UsagePanel.tsx:30-34`) | 같은 값 | AC11 |
| 복원 (`reader.ts:37-38` · `dto.ts:69-95`) | delta형도 복원 | AC9 |
| 사용량 통계 (`usage-queries.ts:233-247`) | delta형 턴 토큰이 일별 합에 포함 — 기존 정의(턴당 컨텍스트) 그대로 | — |
| `turn_model_usage.context_window` | 무변경(`modelUsage` 값) | AC10D |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `turnUsage` 는 첫 관측에서 생긴다(`??=`).
- 취소/중단: result 없이 끝난 턴의 관측은 다음 result 에서 비워진다 — 그 값이 그 사이 최신 컨텍스트라 허용한다(§5).
- 종료/quit/crash: `MapContext` 는 채널과 함께 사라진다 — 영속 없음.
- retry/timeout/partial failure: 오류 result 도 같은 판정을 탄다(현행 assistant 경로와 같다).
- cleanup: result(EP-04①)·`compact_boundary`(EP-04②).
- **다중 저장소 쓰기**: 코드는 해당 없음 — 새 쓰기 지점이 없고 원장 쓰기는 현행 1곳(`tracker.ts:55`). 문서 산출물은 상태 사본이 2곳이다 — `plan.md` 메타 `상태` 와 `INDEX.md` 행. 두 사본을 같은 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력: 없음 — `message_delta` 는 이벤트를 내지 않는다.
- 새 요청 수: 0 — CLI 제어 요청·네트워크 호출을 더하지 않는다(D-002·D-003).
- 메모리: 채널당 스냅샷 1개(숫자 4개) + 정수 1개, 턴마다 교체.
- 캐시/호출 축소: 해당 없음.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 외부 구현자가 구현하는 port/schema/config 를 바꾸지 않는다. 운영자가 쓰는 CLI env(`CLAUDE_CODE_MAX_CONTEXT_TOKENS`)는 CLI 계약이고 guide §3-e 가 안내만 한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 컨텍스트 입력 = 마지막 assistant 스냅샷, 필드 병합 | 0002·0065 · `provider-runtime.md:346` | §10 EP-03 "아니면 현행 체인", 병합 함수 공유 | 유지 — 폴백은 assistant 합 0/부재일 때만 |
| 스냅샷 미수신 시 `result.usage` graceful fallback | `provider-runtime.md:346` · `claude-map.test.ts:763` | §9 TO-BE 현행 체인 마지막 | 유지 |
| 압축 경계 스냅샷 무효화·근사 | 0064·0065 | EP-04② | 유지 + 턴 관측도 무효화 |
| 핸드오프 도착 무효화 | 0127 | EP-01 게이트 | 유지 |
| 빈 컨텍스트 턴 스킵(원장·reducer) | `rendering.md:195` · `tracker.ts:296-303` | EP-05 · AC5 | 유지 |
| 분모 체인 | 0134·0141·0149 · `contextWindow.ts` | D-003 · VP-08 | 유지(코드 무변경) |
| "창·요약 env 는 CLI 설정으로 관리, Orca 기본값 주입 없음" | 0245 · guide `:740` | D-003 · AC12 | 유지 — 안내 보강만 |
| raw secret 송출 예외 3곳 | security §1.4-b | D-003(`/model/info` 미채택) | 유지 |
| 원격 요청은 `net.fetch` 단일 스택 | `app/src/main/AGENTS.md` | 새 요청 0 | 해당 없음 |
| 매퍼 순수성(SDK 타입-only) | `claude-map.ts:2` | §10 외부 SDK 경계 | 유지 |
| 문서에 코드 수치 금지 | `docs/AGENTS.md` 작성 규칙 2 | AC12 문서 문장 | 유지 — 개수를 쓰지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 1P 응답의 `message_delta` 가 다른 입력 값을 싣는 경우 | assistant 합이 양수면 delta 를 쓰지 않는다(D-006, M2·M8 잠금) |
| 마지막 요청만 `message_delta` usage 가 빠지는 프록시 | 같은 턴의 이전 요청 값이 남는다 — 0 보다 정확한 근사로 수용 |
| 프록시 턴 비용(CLI 추정 단가)이 사용량 화면에 나타남 | D-010 — 비용 정책은 비범위. verify 에서 관측되면 NEXT_HANDOFF |
| CLI 가 usage 를 싣는 자리를 바꿈 | smoke(VP-03)를 SDK 업그레이드 gate 로 돌린다 |
| usage 미반환 프록시 사용자는 여전히 도넛이 없음 | D-002 사용자 결정. guide §3-e 에 명시 |

- 되돌리기 어려운 결정: 없음 — 저장 형식·IPC·공개 계약 무변경.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/adapters/claude-map.ts`
- `app/src/main/adapters/claude-map.test.ts`
- `app/src/main/features/usage/` 테스트 1개(수정 또는 신규)
- `app/scripts/smoke-context-usage-sdk.mjs` (신규)
- `docs/arch/backend/provider-runtime.md`
- `docs/arch/frontend/rendering.md`
- `docs/guides/closed-network-extensions.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md`(레이어 — `adapters → shared` 만 새로 쓴다).
- ABI/네트워크 등 환경 제약: smoke 는 플랫폼 CLI 바이너리가 설치돼 있어야 하고 루프백만 쓴다. DB 로드 스위트는 범위 밖.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/main/adapters src/main/features/usage src/main/infra/ipc src/renderer/src/features/chat`.
- smoke: `cd app && node scripts/smoke-context-usage-sdk.mjs`.
- 문서: `cd app && node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: AC13.

## READY self-review

- [x] Decision Ledger 가 턴1~3 결정을 보존한다 — D-001~D-010 ACTIVE, OPEN 0.
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §1 성공 문장·§5 상태표.
- [x] 조건절·이유절을 재해석하지 않았다 — "얻을 수 없을때"(D-001)·"없으면 … 200k"(D-003)·"2단계 없음"(D-002)을 원문 인용.
- [x] Product/UX 핵심 동작이 AC 와 Technical Design 에 연결된다 — §5 상태표 8행 ↔ AC1·AC2·AC3·AC5·AC6·AC7·AC9·AC10D.
- [x] Technical Design 에 AS-IS·TO-BE 가 같은 축으로 있다 — §9 두 도식이 같은 4개 메시지 축.
- [x] Delta 각 행이 파일·AC 에 추적된다 — §9 Delta 5행 ↔ §11 파일표.
- [x] AS-IS 에서 사라진 책임: 없음(§9 TO-BE "유지").
- [x] 수치·외부 규약·앵커·기존 테스트를 실측했다 — §8 검산 · probe 17턴 · 테스트 줄 번호 확인.
- [x] 각 AC 가 행동 단언·검증 수단·도달 경로를 가진다 — §7 두 표.
- [x] Baseline V 를 썼다 — 상속 대상 없음(§7-A).
- [x] 모든 NEW node 에 같은 레벨 REQUIRED pair 가 있다 — R 6·SD·AR·MD ↔ VP-01~09.
- [x] INHERITED node 없음 — Baseline.
- [x] 각 pair 의 경로·자리 분모·oracle 이 있고, 적대 증거는 VP-01·03·05·07 만 선택했다(이유: 우선순위·경계·실 CLI 자리).
- [x] 운영 gate 가 열거됐다 — §7-A 6행.
- [x] 사람 실기로 미룬 순수 로직이 없다 — AC13 은 실 프록시 SSE 만.
- [x] semantic 목표를 structural proxy 로만 검증하지 않는다 — 전 AC 가 토큰 값을 직접 단언.
- [x] "X 가 쓰인다" 불변식의 장치가 X 삭제에 반응한다 — M1(캡처 삭제 → AC1·smoke red)·M8(관측 삭제 → AC2 red). 자리 불변식(우선순위)은 M2 맞바꿈.
- [x] 정책 파라미터 단위/범위 — 토큰 정수, 판정 임계 "합 > 0".
- [x] 참조 구현 coverage — smoke 선례의 픽스처 형태(SSE)를 그대로 쓰고 usage 형태 3종(`p1`·`delta`·`none`)을 전부 다룬다.
- [x] 신규 계약의 SSOT·강제 지점·seam — `turnUsage` ↔ EP-01~04 ↔ `claude-map` UT.
- [x] 기존 소비처 전수 — §12 표 8행.
- [x] producer/consumer 양쪽 의미 — §12.
- [x] 상한·one-way door — §14 새 요청 0 · §17 one-way door 0.
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다 — `npm test` 미사용, 비-DB vitest 직접 호출.
- [x] Decision Ledger 와 본문을 교차검증했고 `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙 — 판정 먼저, 표 위주.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §8).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: … (Part I/II의 정확한 절 인용)
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

> `§10`의 `언제 강제` 칸은 **하나의 불변식이 성립해야 하는 지점 목록**이다. 한 지점만 닫아도
> 대표 경로 AC는 통과하므로 게이트 green은 전수를 뜻하지 않는다.
> **각 행의 `재현 명령 / 관측`은 이번 턴에 실제로 실행한 것만 적는다** — 산출물에서 표식을 다시
> 찾지 못하면 그 행은 닫힌 것이 아니다.
> **그 관측이 구조적 proxy·0건/전수 스윕·배선 존재 oracle이고 이번 턴에 장치를 만들거나 고쳤다면,
> 등록된 결함을 심어 실패하는지 먼저 확인한다** — 눈이 없는 장치의 `0건`은 전수의 증거가 아니다.
> 직접 행동 결과를 관측하는 oracle에는 mutation을 자동 요구하지 않는다(impl §3).
> **`전건`·`미분류 0`·`잔여 0` 행의 관측은 차집합이다** — 총계·합계는 그 주장을 반증할 수 없다(impl §8).
> **`닫은 지점`은 §10 항목이 아니라 자리로 세고 그 수를 낸 검색 명령을 적는다** — pair production path의 계약 운반 edge를 자리 후보에 넣는다(impl §2).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: 없음 / … → 현재 pair·Decision·AC 필수면 PLAN_GAP, 아니면 별도 finding

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED / REGRESSION | SELF_PASS / SELF_BLOCKED | … | required — 결과 / not selected — 직접 oracle 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

> pair가 적대 증거를 선택했거나 파생 이슈가 변이를 인용했거나 이번 턴에 구조적 proxy·0건/전수·배선 oracle을 만들었다면
> 그 결함을 심어 장치의 방향·민감도를 확인한다(impl §3). 형제 슬롯이 서로 다른 계약을 가지면
> 지우는 변이에 더해 **형제와 맞바꾸는 변이**도 심는다. 그 밖의 hunk에는 mutation을 새로 발명하지
> 않고 `해당 없음 — 직접 oracle …`을 적는다. mutation이 없다는 이유만으로 현재 FAIL 범위를 늘리지 않는다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `파일:줄` — … | `VP-… 선택 증거` / `D<N> 인용 변이` / `구조·전수·배선 oracle 민감도` | red / green / 최초 | `<케이스명>` 외 N건 | 잠김 / **잠금 없음 — 사유** / 해당 없음 — 직접 oracle |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K = 표 행 T` — 행이 없는 claim은 `SELF_PASS`·`closed`로 적지 않는다(impl §8).
- **덮개 회귀**: 이전 라운드에 red였는데 이번에 green인 행 0건 / N건 → 사유와 함께 적는다. 장치를 교체·삭제했으면 구 장치가 잡던 자리가 새 장치의 하한이다(impl §3).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 / … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … / **표에 없음** | … |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

> 범위 밖이라 이번에 고치지 않더라도 **적는다** — 적지 않으면 그 선택지가 존재한 적도 없게 된다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 선조치(구현 세부) / 📝 **plan 수정 제안**(설계가 틀렸다는 증거) / ⚠️ 보고만(제품·AC·Decision·의존성) | … |

> 가운데 갈래가 구현 턴의 핵심 산출이다 — plan을 고치는 것은 설계자 책임이지만, **고쳐야
> 한다는 증거를 만드는 것은 구현자만 할 수 있다.** 무엇이 틀렸는지·코드에서 무엇을 봤는지·
> 어느 절을 어떻게 바꿔야 하는지를 함께 적는다.

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 없음 / …

> 차이가 있으면 **대체물이 갖고 원본이 갖지 않던 실패 모드를 축마다 한 줄씩** 적고, 그 축에서 다시 확인한
> AC·§10 행을 관측과 함께 남긴다. 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다(impl §6).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … / 해당 없음 + 근거 | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … / 해당 없음 + 근거 | … |
| 재진입 | … / 해당 없음 + 근거 | … |
| 다른 무효화 축 | … / 해당 없음 + 근거 | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님) | 테스트 N파일 / M케이스 · error·warning 수 · 환경 기인 실패 분리 근거 |
| V-pair 자기확인 | `SELF_PASS N / SELF_BLOCKED M`; pair별 상세는 위 표 |
| 강제 지점 전수 | N/M |
| **AC 자기보고**(`Criteria-Met`) | N/M — 각 AC 옆에 **이번 턴에 재현한 관측값**을 적는다. 표식을 다시 찾지 못한 AC는 ✅로 세지 않는다 |
| **합계 검산** | `✅ N · ⚠️ M · ❌ K = 총 T` — 분모를 다시 세고 **이 줄을 쓴 뒤** 커밋 trailer를 적는다 |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` — 자기 환경의 해시를 적지 않는다 |

## [구현자 기입] Review Signals — 사실만

> 원인 분류(A~F)와 지침 변경은 `handoff-review`가 한다.

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 / …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: 없음 / …
- 현재 라운드·impl 턴: `rN` / `rN.k`

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | … | … | … | … | … |
