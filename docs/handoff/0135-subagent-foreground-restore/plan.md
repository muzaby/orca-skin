# Plan — 0135-subagent-foreground-restore

> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0135-subagent-foreground-restore` |
| 작성자 | Claude Code |
| 일자 | 2026-07-21 |
| 매핑 | PHASES (verify PASS 시 승격) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "서브에이전트 및 도구 사용 응답이 정상동작 하지 않는 상황 … inflight 애니메이션이 안나오고 완료 상태로 렌더링 … continue 를 보내면 응답을 반환하지만 inflight 없이 턴이 끝나는 것처럼 렌더링 … 검토하라" → 검토 후 "단기 핸드오프 문서와 중기 핸드오프 문서를 먼저 작성하고 구현을 시작하라" | 라이브 세션 요청(2026-07-21, 영속 트랜스크립트 없음) |
| 추론 의도 | **단기** = 회귀 즉시 원복(구 foreground 의미론 고정), **중기** = 신 CLI 의 백그라운드 의미론을 Orca 런타임이 올바르게 수용(→ `0136-background-subagent-runtime`) — 검토 보고에서 제시한 2 단계안을 사용자가 그대로 채택한 것으로 해석(추론) | 검토 보고(본 세션) + 사용자 지시 문구 "단기/중기" |

## Context (왜)

2026-07-20 lockfile 재생성(`5dee1af`) + SDK 핀(0134, `3472608`)으로 `@anthropic-ai/claude-agent-sdk` 가 **0.3.143 → 0.3.215** (CLI 2.1.143 → 2.1.215) 로 점프했다. CLI **2.1.198** 부터 서브에이전트(Agent/Task 도구)가 **기본 백그라운드 실행**으로 바뀌어, "foreground 가 기본, `ORCA_SUBAGENT_BACKGROUND=1` 일 때만 백그라운드 주입" 이라는 Orca 의 가정(0104 계열)이 무효화됐다. 결과로 ① 부모 Agent tool_result 가 런치 영수증으로 **즉시** 도착해 렌더가 "완료" 로 오표시되고, ② 메인 턴 result 가 조기 도착해 프레임이 닫힌 뒤 서브에이전트 진행/정착 이벤트가 `unframed` 백로그에 적체되며, ③ 다음 send 때 백로그가 벌크 배달돼 "inflight 없이 끝난 턴" 처럼 렌더된다. 본 핸드오프는 **가장 작은 원복**: canUseTool 에서 `run_in_background: false` 를 명시 주입해 구(2.1.143) foreground 의미론을 고정한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| CLI 2.1.198: "Subagents now run in the background by default, so Claude keeps working while they run and is notified when they finish (previously a gradual rollout)" | 웹 https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md §2.1.198 |
| SDK 0.3.215 `AgentInput.run_in_background` 문서: "Agents run in the background by default; … **Set to false to run this agent synchronously** when you need its result before continuing" — **false 명시가 공식 opt-out** | npm 패키지 실측 `@anthropic-ai/claude-agent-sdk@0.3.215` `sdk-tools.d.ts:500-503` |
| SDK 0.3.143 동 필드 문서: "Set to true to run this agent in the background" — 구버전 기본은 foreground | npm 패키지 실측 `@anthropic-ai/claude-agent-sdk@0.3.143` `sdk-tools.d.ts:298-301` |
| SDK 점프 경위: lock 재생성 `5dee1af` (0.3.143→0.3.215), 타입 적응 `c69f24d`, 스펙 핀 `3472608`(0134) | `git log`, `app/package.json:33` |
| Orca 의 서브에이전트 분기: `backgroundSubagents` on 이면 `run_in_background: true` 주입, **off 면 무주입 passthrough** — 신 CLI 에선 passthrough = 백그라운드 | `app/src/main/adapters/claude.ts:109-121` |
| off 경로의 기존 종착: Agent/Task 는 `RISKY_TOOLS` 미포함이라 말미 allow passthrough — 조기 allow 반환으로 바꿔도 승인 게이트 우회가 생기지 않는다 | `app/src/main/adapters/risky-tools.ts:6-12`, `claude.ts:171-186` |
| 렌더 오표시 메커니즘(참고): `isAsyncLaunchedResult` 는 output 이 `{status:'async_launched'}` 객체일 때만 '실행 중' 유지하는데 claude-map 은 wire `p.content`(모델용 텍스트)를 result 로 실음 → 감지 실패. 구조화 판정은 중기(0136) 소관 | `app/src/renderer/src/features/chat/lib/parts.ts:275-281`, `app/src/main/adapters/claude-map.ts:330-338` |
| 프레임 적체 메커니즘(참고): terminal 에서 프레임 닫힘 → 이후 이벤트 `unframed` 버퍼 → 다음 `openFrame()` 에서만 배달. 라이브 배달은 중기(0136) 소관 | `app/src/main/features/sessions/session-runtime.ts:294-306`, `:258-265` |
| 기존 단위 테스트: 백그라운드 주입/차단/off-passthrough 3분기 고정 | `app/src/main/adapters/claude.canusetool.test.ts:203-246` |

## 인수 기준 (Acceptance Criteria)

1. `makeCanUseTool` 서브에이전트 분기(Agent/Task): `backgroundSubagents` off(기본)이고 모델 입력에 `run_in_background` 가 **없으면** `updatedInput` 에 `run_in_background: false` 를 주입해 allow 한다(신 CLI 기본 백그라운드를 구 foreground 로 고정).
2. 모델이 `run_in_background` 를 **명시**한 경우(true/false 모두) 그 값을 보존한다 — 강제 덮어쓰기 없음. (명시 true 의 실런타임 지원은 `0136` 이 담당.)
3. `backgroundSubagents` on(`ORCA_SUBAGENT_BACKGROUND=1`) 경로는 기존 그대로 `run_in_background: true` 주입 — 회귀 없음.
4. 차단된 서브에이전트 타입 deny(`isSubagentBlocked`)가 주입보다 우선 — 기존 우선순위 불변.
5. 서브에이전트 분기 이외(AskUserQuestion/ExitPlanMode/위험 도구/안전 도구)의 canUseTool 동작 불변.
6. 단위 테스트(`claude.canusetool.test.ts`): ① off 기본 → false 주입 ② 명시 true 보존 ③ 명시 false 보존 ④ on → true 주입(기존) ⑤ deny 우선(기존) 갱신·추가. 구 "off passthrough" 테스트는 새 계약(false 주입)으로 교체.
7. 게이트: `npm run lint` + `npm run typecheck` 0 error + 순수 vitest(어댑터 스위트 포함) green. (electron ABI egress 베이스라인 분리 보고 관례 유지.)

## 범위 / 비범위

- **범위**: `app/src/main/adapters/claude.ts` 의 `makeCanUseTool` 서브에이전트 분기 1곳 + 동 테스트.
- **비범위**: 백그라운드 경로의 구조화 결과 매핑·프레임 밖 이벤트 라이브 배달·busy 릴리즈 밸브 → **`0136-background-subagent-runtime`**. mock 어댑터(자체 시나리오 구동이라 canUseTool 미경유) 무변. IPC/DB/렌더러 무변.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- SDK 0.3.215 가 `run_in_background: false` 를 동기(foreground) 실행으로 준수한다 — 타입 문서 명시(자료조사 2행). 신규 의존성 0.
- canUseTool 의 `updatedInput` 주입이 도구 입력으로 반영된다 — 기존 on-경로(true 주입)가 동일 메커니즘으로 동작해온 전제 재사용.

## 설계

- `claude.ts` `makeCanUseTool` 의 `isSubagentTool` 분기 말미(passthrough 낙하 지점)를 명시 반환으로 교체:
  - `opts.backgroundSubagents` → true 주입(기존).
  - 그 외: `input.run_in_background !== undefined` 면 input 그대로 allow, 아니면 `{...input, run_in_background: false}` allow.
- 레이어: adapters 내부 단일 파일 — 경계 변화 없음.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 모델이 명시적으로 `run_in_background: true` 를 요청한 턴은 여전히 백그라운드로 돌 수 있고, 그 경우 0136 착륙 전까지는 보고된 증상(완료 오표시·지연 배달)이 재현될 수 있다 — 0136 이 같은 브랜치에 함께 실리므로 창은 실질 0.
- foreground 복원으로 서브에이전트 실행 중 메인 턴이 결과를 기다린다(구 UX) — AgentTaskRow '실행 중' shimmer·우측 패널 child 트랜스크립트가 종전대로 라이브 동작.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 미래 CLI 가 `run_in_background: false` opt-out 을 제거할 가능성 | 타입 문서에 명시된 공식 계약이라 낮음. 중기(0136)가 백그라운드 수용을 준비해 의존도를 낮춘다 |
| 병렬 에이전트를 의도한 모델 흐름이 동기화로 느려짐 | 명시 true 보존(AC2)으로 모델 의도는 존중. 기본값만 고정 |

- 되돌리기 어려운 결정: 없음(1 분기 수정, 즉시 revert 가능).
- 단독 결정 금지 항목: 없음 — "백그라운드를 제품 기본으로 전환할지"는 0136 Open Question 으로 이관.

## 영향 받는 파일

- `app/src/main/adapters/claude.ts`
- `app/src/main/adapters/claude.canusetool.test.ts`

## 참고 문서

- `docs/arch/backend/provider-runtime.md` (canUseTool 게이트), `docs/arch/backend/adapters.md`
- CLI CHANGELOG §2.1.198 (자료조사)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + 순수 vitest(어댑터 스위트). DB/electron 실기는 환경 제약 시 사람/CI 몫으로 분리 보고.
- 신규 테스트 요구: canUseTool 서브에이전트 분기 계약(AC6).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 인용, 단기/중기 분할은 추론으로 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·웹 URL·git hash).
- [x] 인수 기준 — 번호·조사 근거·검증 가능.
- [x] 의존 기술 — SDK opt-out 계약 명시, 신규 의존성 0.
- [x] 파생 UX — 명시 true 잔존 창·foreground UX 복원 명시.
- [x] 리스크 — opt-out 제거 리스크·완화 기재, Open Question 은 0136 으로 분리.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 직접).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계의 "말미 passthrough 를 명시 반환으로 교체" 접근이 최소 표면이다. Agent/Task 는 `RISKY_TOOLS` 밖이라 조기 allow 반환이 승인 게이트를 우회하지 않음을 코드로 재확인(`claude.ts:171` 위험도구 분기는 서브에이전트 분기 이후라 도달 자체가 없다).
- 이견 / 우려: 없음. 1 분기 수정으로 인수 기준 전부 충족.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 모델이 `run_in_background` 를 명시한 경우(true/false)의 보존을 AC2 로만 두면 테스트 공백 | ✅ 명시 true·명시 false 보존 케이스를 각각 테스트로 고정 | `claude.canusetool.test.ts` |

## [구현자 기입] 구현 체크리스트

- [x] `makeCanUseTool` 분기 수정 (AC1~5) — off 기본 false 주입 + 명시값 보존
- [x] 테스트 갱신·추가 (AC6) — off→false / 명시 true·false 보존 / Task 도구명 / on→true(기존) / deny 우선(기존)
- [x] 게이트 (AC7)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/adapters/claude.ts`, `app/src/main/adapters/claude.canusetool.test.ts` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run` |
| 게이트 결과 | lint 0 error(1 pre-existing warning 무관) / typecheck 3분할 0 error / vitest 1099/1099(canusetool 스위트 포함, `chat-turn.continuity` 1파일 로드 실패 = electron egress 베이스라인) + scripts 25/25 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `2cd306b` |
