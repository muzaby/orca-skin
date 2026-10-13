# Plan — 0260-docs-handoff-resync

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장은 [`§산출물 문장 규칙`](../AGENTS.md)을 따른다 — 판정 먼저, 주장 한 줄에 관측 하나, 표 한 칸 3줄.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0260-docs-handoff-resync` |
| 작성자 | Claude Code |
| 일자 | 2026-10-13 |
| 매핑 | 없음 (문서 전수 재동기화 — 0191/0192 의 후속 접촉) |
| 상태 | verify/RETURN_TO_PLAN (r1 → 라운드 2) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0191/0192 는 구 템플릿(V 없음). 게이트 장치(`doc-gate.sh`)만 운영 gate 로 승계 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 현재 상태 문서(`docs/arch/**`·SSOT·PRD/TRD·guides·해설 미러)의 마지막 전수 동기화는 0191(2026-08-18)·0192(2026-08-19)다. 그 뒤 0193~0259 **67개 핸드오프**가 들어왔고(`ls docs/handoff/0[12]*/ | 0193 이상 = 67`), 각 핸드오프는 자기 문서만 고쳤다 — 옛 절(Phase/anchor·구현 상태 표·dist/settingSources/릴리스 게시 서술)이 코드와 모순된 채 남았다(§8 표).
- 완료 후 달라지는 것: 범위 문서(§6)의 코드 인용 사실이 현재 코드와 일치하고, 0193~0259 각 핸드오프의 결과가 **어느 현재 문서에 사는지**(또는 문서 영향이 없는 이유)가 표 하나로 추적되며, 세 게이트(`doc-gate.sh check`·`check-doc-inventory.mjs --check`·`drift-check.sh check`)가 초록이다.
- 성공을 사용자 관점에서 한 문장으로: 새 세션의 에이전트가 `docs/INDEX.md` 라우팅으로 연 어느 문서든 2026-10-13 의 코드와 다른 말을 하지 않고, 핸드오프를 뒤져 현재 상태를 복원할 필요가 없다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "@./docs 경로의 문서들을 전체적으로 업데이트하라. 현재까지의 핸드오프가 모두 적용돼야 한다" | 사용자 턴 1 (라이브 세션) |
| 명시 요구 | "계속" — 모델 전환 뒤 같은 작업을 이어가라 | 사용자 턴 2 |
| 추론 의도 | "전체적으로" = 범위 문서 **전수** 대조(샘플 아님) — 추론 | 문장의 수식어·0191 의 선례(전수 스윕) |
| 추론 의도 | "현재까지의 핸드오프" 중 이번에 적용할 구간 = **0193~0259** — 0192 이전은 0191 이 전수 동기화했고 그 뒤 접촉이 없었다 — 추론 | `docs/archive/handoffs/INDEX-history.md` 최신 PASS 0251·0253 · 보드 PASS 45행 전부 0193 이상 |
| 추론 의도 | `docs/handoff/<past>`·`archive/`·`etc/`·`spec/` 는 "현재 상태 문서" 가 아니라 증거·원문이라 본문 갱신 대상이 아니다 — 저장소 규칙 적용 | 루트 `AGENTS.md` 핵심 원칙 1 · `docs/AGENTS.md` 표 · `doc-gate.sh` SCOPE |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 범위 문서 전수를 0193~0259 반영 상태로 갱신한다 | 사용자 원문 "전체적으로" · "모두 적용" | 사용자 턴 1 | ACTIVE | — |
| D-002 | 이력 서술은 삭제 + 링크로 처리하고 `arch/` 에 델타 서술을 새로 쓰지 않는다 | `docs/AGENTS.md` 작성 규칙 4 · 0191 D-003(구 ChatEvent 표 등 이력 표는 삭제+링크) | 저장소 규칙 · 0191 plan | ACTIVE | — |
| D-003 | PRD/TRD 는 **사실 정정 · 구현 완료 표기 · TRD §2 F16+ 기능 행 추가**만 한다. PRD §11 의 미결 OQ 는 결정하지 않고, 해소된 OQ3 의 비고에 적힌 낡은 사실(draft 게시)만 정정한다 | 루트 `AGENTS.md` 원칙 2(OQ 단독 결정 금지) · 재구성은 사용자 요구가 아님 | 설계자 기본값 — **사용자 확인 대상** | ACTIVE | — |
| D-004 | 보드의 `verify/PASS` 45행(사람 실기 대기)은 archive 로 옮기지 않는다 | 각 행 비고 "archive 이동은 ACxx 실기 뒤" 가 기존 결정이다 | `docs/handoff/INDEX.md` 비고 | ACTIVE | — |
| D-005 | ADR 본문은 고치지 않는다. ADR 의 구 경로(`orca.db`·`orca-dev`)는 doc-gate baseline 에 `역사` 로 분류한다 | `decisions/README.md` "기존 ADR 을 고쳐 쓰지 않는다" | 저장소 규칙 | ACTIVE | — |
| D-006 | `docs/handoff/<past>`·`archive/`·`etc/`·`spec/<vendor>/` 는 비범위. `spec/` 원문 미러는 편집 금지 | `docs/AGENTS.md` 표 · doc-gate SCOPE | 저장소 규칙 | ACTIVE | — |
| D-007 | **범위 확장 2건**: 루트 `AGENTS.md`·`app/AGENTS.md` 의 "TRD §15" 참조(TRD 는 12절, Future Work 는 §10)와 `app/AGENTS.md:74` CSP 문장(`img-src` 누락)은 `docs/` 밖이지만 `docs/AGENTS.md:59`·`security.md §1.6` 과 같은 사실의 사본이라 함께 정정한다 | 사본을 한쪽만 고치면 갈라진다(`docs/AGENTS.md` 작성 규칙 3) · 1줄 정정 | 설계자 기본값 — **사용자 확인 대상** | ACTIVE | — |
| D-008 | `observability.md §5` 로그 이벤트 카탈로그의 정본은 **코드 열거 명령**이다. handoff 0124 plan 포인터는 폐지한다 | 코드 열거 28종 ≠ 0124 표(`app.legacy.migrated`·`auth.grant.orphaned` 등 추가분) — 핸드오프 plan 은 과거 증거 | 코드 `rg "info\('" app/src/main` | ACTIVE | — |
| D-009 | 0192 verify F1·F2·F3 를 이번 접촉에서 닫는다 — `limits` 라벨 문구(F1)·비-ts 경로의 인용 파일 기준 상대경로 해석(F2)·"exit 0 고정" 문구(F3) | 0192 verify "다음 접촉 시 함께 닫는다" — 이번이 다음 접촉 | `0192/verify.md:164,183-185,209` | ACTIVE | — |
| D-010 | 검증 장치는 **데이터(TSV) + 스크립트** 다 — `drift-assertions.tsv`(사실 단언)·`status-marks.tsv`(상태 표식 유지 판정)·`handoff-coverage.tsv`(핸드오프→문서) 를 `drift-check.sh check` 가 대조한다. 수치는 산문이 아니라 `check` 산출이 갖는다 | 0192 원칙(손으로 적은 수치는 재현되지 않는다) 승계 | 0192 plan §19 · verify r2 E1 | ACTIVE | — |
| D-011 | 버전·용량 같은 코드 상수는 문서에 값으로 적지 않고 정본 파일(`package.json`·`bootstrap.ts`)을 가리킨다 | 수치 복제 금지 규칙의 확장 — "latest"·"Unlimited" 가 낡은 방식이 그것이다 | `docs/AGENTS.md` 작성 규칙 2 | ACTIVE | — |
| D-012 | `generated/inventory.md` 는 스크립트로만 바뀐다. 문서 변경이 수치를 요구하면 산문에 적지 않고 생성물을 링크한다 | 생성물 편집 금지 | `docs/AGENTS.md` 표 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-012 전부(신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0191 D-003(이력 표 삭제+링크 — D-002 로 승계) · 0192 D-003(`doc-gate.sh` 는 CI 밖, 사람이 돌린다 — 유지).
- 사용자 미질의 기본값 2건(D-003·D-007)은 READY 보고에서 사용자에게 명시한다 — 거부 시 D-003 은 PRD/TRD 범위 축소, D-007 은 세 파일 1줄 되돌림으로 닫힌다(둘 다 one-way door 아님).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-002 ↔ AC4(adapters §1.5 "삭제+링크") 일치 · D-003 ↔ AC12·AC13("사실 정정·완료 표기·F16+ 행만", OQ 미결 항목 비접촉) 일치 · D-005 ↔ AC21(ADR 사이트는 baseline 분류만) 일치 · D-007 ↔ AC17(세 파일 1줄) 일치 · D-010 ↔ AC18~AC20(TSV 장치) 일치 · D-011 ↔ AC2·AC3(값 대신 정본 파일) 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 원인은 "핸드오프별 국소 갱신 + 전수 접촉 부재" 이고 요구가 그 전수 접촉이다 | 0193~0259 중 현재 문서가 번호로 인용하는 것은 22건(`rg` 표, §8) — 나머지는 자기 plan 에만 산다 |
| 이미 기존 코드가 충족하는가 | 부분 — 게이트 장치(doc-gate·inventory)는 있고 초록이나 **의미 드리프트는 보지 않는다**(`prose-veracity 계측불가`) | `doc-gate.sh check` 현재 exit 1(미분류 28·미등재 12·미판정 104) · `check-doc-inventory.mjs --check` exit 0 |
| 더 작은 해법이 있는가 | 없음 — 문서 수정 없이 모순을 없앨 수 없다. 단 **구조 재편은 하지 않는다**(파일 이동·절 번호 변경 0) | 절 번호는 외부 참조 anchor(`ARCHITECTURE.md §3` 매핑표) |
| 선행 자료의 주장을 코드와 대조했는가 | 했다 — §8 표의 사실 전부 이번 세션 `rg`/파일 읽기로 재측정 | 예: SessionRuntime 상태 `contracts/session-state.ts:1`, cap `bootstrap.ts:991-992` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 없음 — 채택 결정(Provider 어휘 폐기·2계층 영속성·Harness 어휘)은 전부 유지하고 그 결정을 **어긴** 낡은 문장을 고친다 | GLOSSARY §3 · persistence §1 · 0188 D-005 |

- 사용자에게 올릴 결정: D-003(PRD/TRD 깊이)·D-007(docs 밖 1줄 2파일) — 기본값으로 진행하고 READY 보고에 명시. 그 밖에 제품 동작·공개 계약을 바꾸는 항목은 없다(문서 작업).
- 코드 조사로 닫은 사실: §8 표 전부(SessionRuntime 상태·cap 정책·SDK 버전 고정·settingSources·disallowedTools·hooks·gate 조건·CSP·릴리스 게시·nav 항목·마이그레이션 0019~0027·로그 이벤트 열거·`openSkillPicker`/`useChat`/`LiveStatus`/`SessionInfo`/`ErrorCode` 부재).

## 5. 동작 / 사용자 흐름

> 비UI. 소비자는 새 세션의 코딩 에이전트와 사람 독자, 운영자는 게이트를 돌리는 에이전트다.

```text
[에이전트가 docs/INDEX.md 라우팅으로 문서를 연다]
  → [문서의 코드 인용·상태 표기를 그대로 설계 입력으로 쓴다]
  → [성공: 코드와 일치 — 핸드오프 디렉토리를 뒤지지 않는다]
  ↘ [실패(현재): 낡은 사실을 전제로 설계한다 — 예: "disallowedTools 는 안 넘긴다" 를 믿고 WebSearch 차단을 다시 만든다]

[문서를 고친 에이전트가 게이트를 돌린다]
  → doc-gate.sh regen → 신규 사이트 분류/판정 → doc-gate.sh check
  → node scripts/check-doc-inventory.mjs --check
  → drift-check.sh check
  → [전부 exit 0 → 커밋] ↘ [하나라도 차집합 ≠ 0 → 그 행을 이름으로 짚고 멈춘다]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 범위 문서 수정 후 `doc-gate.sh regen` | 기존 판정 보존, 신규/이동 사이트는 `UNCLASSIFIED`/`UNJUDGED` | `check` 가 미분류·미판정을 이름으로 출력하고 exit 1 — 분류/판정 전에는 통과 없음 |
| `drift-check.sh check` | 단언 TSV 전행(must_not=0·must≥1·anchor 실재) · 표식 사이트 ↔ 유지 행 양방향 차집합 · 커버리지 행 전건·확인어 매치 | 차집합 셋 다 0 → exit 0; 아니면 실패 행 출력 + exit 1 |
| 정정 문구를 누가 되돌린다 | 해당 단언 행의 `must` 가 0건 | `drift-check.sh check` red — 어느 문서의 어느 사실인지 행 id 로 짚는다 |
| 새 핸드오프가 들어오는데 커버리지 행이 없다 | 0193~0259 범위만 세므로 영향 없음 | 이번 장치는 **이 구간의 완결성**만 잠근다 — 상시 게이트가 아니다(§6 비범위) |

### 파생 UX / 엣지케이스

- loading / empty / error: `drift-check.sh` 는 TSV 가 비어 있거나 범위 문서가 0 이면 exit 2(preflight) — 빈 산출이 통과로 읽히지 않는다(0192 판정 지점 12 승계).
- cancel / retry: 게이트는 멱등. `regen` 은 판정 보존이라 반복 실행이 안전하다.
- concurrency: 두 에이전트가 같은 baseline TSV 를 동시에 고치면 git 충돌 — 이번 작업은 단일 주체(Claude)라 해당 없음.
- 외부환경/오프라인: 세 게이트는 네트워크를 쓰지 않는다. `node_modules` 가 비어 있어도 `check-doc-inventory.mjs` 는 Node 내장만 쓴다(이번 세션 실측 exit 0).

## 6. 범위 / 비범위

- **범위**: `docs/**/*.md` 중 `handoff/`·`archive/`·`etc/`·`spec/` 를 뺀 전부(`find` 기준 46파일 — `CLAUDE.md` stub 2·`generated/inventory.md`·ADR 본문 8 은 읽기만) + D-007 의 루트/`app` AGENTS 3줄 + `0192/doc-gate.sh`·`0192/plan.md §19` 의 F1~F3 정정 + 신규 `0260/{drift-check.sh, drift-assertions.tsv, status-marks.tsv, handoff-coverage.tsv}`.
- **비범위**: 문서 파일 이동·절 번호 변경 · `docs/spec/**` 원문 · ADR 본문 · `docs/etc/**` · 지난 핸드오프 plan/verify 본문(0192 F1~F3 제외) · 보드 PASS 행 archive 이동(D-004) · 코드(`app/src/**`) 변경 · 상시 CI 게이트 추가(`doc-gate.sh` 가 CI 밖인 것은 0192 D-003 유지).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `drift-check.sh`/`doc-gate.sh` 를 CI 에 올리기 | 아니오 — 운영 결정(0192 D-003 이 보류) | 후속 — `NEXT_HANDOFF` 후보로 verify 에 적는다 |
| PRD §11 미결 OQ(OQ4~OQ7·OQ9·OQ10) 결정 | 아니오 — 제품 결정 | 사용자 |
| 보드 PASS 45행 archive 이동 | 아니오 | 사람 실기 뒤(D-004) |
| 0193~0259 이전 구간의 TRD §2 기능 행(0090~0190 중 미기재) | 아니오 — F11~F15 가 선례 범위를 정했고 0191 이 그 상태를 PASS 로 닫았다 | 후속 — verify `NEXT_HANDOFF` 후보. 이번엔 0193~0259 만(D-001 범위) |

## 7. Requirements / Acceptance — `R ↔ AT`

> 검증 수단의 `DA-*`·`SM`·`HC` 는 `drift-check.sh` 의 세 TSV 다(§10·§11). 각 AC 의 "정정 문구" 는 `drift-assertions.tsv` 행이 되고, 그 행의 `must_not`/`must`/`anchor` 가 oracle 이다 — 구현자가 행을 늘릴 수 있으나 줄이지 못한다.

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `GLOSSARY.md` 가 코드와 일치한다 — SessionRuntime 상태 어휘 = `cold/live/busy/interrupting/error/closed`; Project 행 채널 수치 없음; 로그인 게이트 행에 일일 게이트 조건(ADR-008 링크); Credential 행이 Auth 플랫폼(Grant→vault, Harness env 주입, MCP `${BINDING:}`) 기준; SessionAdapter 행 메서드가 `adapters/types.ts` 와 일치; 표제어 신설 4건(AgentKind(Work/Code)·managed worktree·백그라운드 작업·일일 로그인 게이트) | DA 행: `idle` 0 + `live` ≥1(anchor `contracts/session-state.ts`) · `5채널` 0 · `dailyReloginRequired\|일일` ≥1(anchor `features/gate/daily.ts`) · 신설 표제어 각 ≥1(anchor `shared/agent-kind.ts`·`features/worktrees/service.ts`·`features/chat/background-controller.ts`) | 에이전트가 용어 SSOT 를 설계 입력으로 읽는 경로 |
| R-01 | AT-01 / AC2 | `arch/backend/overview.md`: §2 스택 표가 SDK 버전을 값으로 적지 않고 `app/package.json` 고정 핀을 가리킨다(D-011); §3 트리에 `features/{agents,artifacts,worktrees}`·`plugins/{confluence,jira,mail}`·`handlers/{artifacts,context-file,error,git,session-directory}`·`infra/{error-report,git,background-output}`·`app/{daily-gate,error-report-*,artifact-sender,agent-extension-profile,runtime-model-startup,settings-reactions,legacy-paths}` 가 있다; §3.1 부트 단계에 저장 경로 이관·미완료 도구 호출 복구가 있다; §4 구현 상태 표에서 Artifacts 가 ✅(0223) 이고 0193~0259 주요 기능 행이 있다 | DA 행: `latest` 0(§2 표 범위) · 디렉토리 이름 각 ≥1(anchor = 실제 디렉토리 `test -d`) · `Artifacts 디렉토리.*미구현` 0 · `legacy-paths\|저장 경로 이관` ≥1(anchor `app/legacy-paths.ts`) | 부트 시퀀스·레이어 지도를 읽는 경로 |
| R-01 | AT-01 / AC3 | `runtime-ipc.md`: §1.5 cap 정책이 `BoundedRuntimeCapPolicy` 이고 용량은 값 대신 `bootstrap.ts` 를 가리킨다; §3.2 로깅은 `observability.md` 링크로 대체(`TBD`·`electron-log` 0); §3.3 userData 가 `orcinus-orca`; worktree 준비 단계가 세션 시작 흐름에 있다 | DA 행: `Unlimited` 0 + `Bounded` ≥1(anchor `bootstrap.ts:BoundedRuntimeCapPolicy`) · `electron-log` 0 · `orcinus-orca` ≥1 · `worktree` ≥1 | 동시성·IPC 구조를 읽는 경로 |
| R-01 | AT-01 / AC4 | `adapters.md`: §1.5 구 ChatEvent 표 삭제 + IPC_CONTRACT §3 링크(D-002); §1.7 채택표에서 permissionMode/canUseTool·hooks·createSdkMcpServer·plugins·AsyncIterable·forkSession 이 ✅ 이고 `settingSources: ['project','local']` 명시·`disallowedTools: ['WebSearch']` 용도 명시; §2.1 dist 레이아웃·§2.3 Artifacts 경로는 각각 standardization §5.1·persistence §1.4 링크로 대체(모순 제거); §3.1 매트릭스 Skill/MCP 행·§3.2.5 줄번호 현행 | DA 행: `ChatEvent` 표 헤더 0 · `⏳` 0(§1.7) · `settingSources` 행에 `project.*local` ≥1(anchor `claude-adapt.ts:adaptSettingSources`) · `WebSearch` ≥1(anchor `claude.ts:disallowedTools`) · `<userData>/artifacts/<sessionId>` 0 · `builder.ts:73` 0 | 어댑터 호출·SDK 옵션을 설계 입력으로 읽는 경로 |
| R-01 | AT-01 / AC5 | `persistence.md`: 마이그레이션 표에 0019~0027 행(개수는 쓰지 않음); 저장 대상 표에 `managed_worktrees`·`artifact_files`·`session_artifacts`·`background_task_events`·`sessions` 추가 컬럼(baseline·extra_dirs) ; §1.1 electron-store 경로 형식 현행 | DA 행: 테이블 이름 각 ≥1(anchor `infra/db/migrations/00(19..27)_*.sql` 실재) | DB 스키마를 읽는 경로 |
| R-01 | AT-01 / AC6 | `standardization.md`: 헤더 "두 SDK 미설치" 0; §5.1 settingSources·disallowedTools 서술이 AC4 와 같은 사실; §5.2 dist 레이아웃이 `dist/<engine>/plugins/orcinus-orca/{skills,.mcp.json}`(§5.1 과 같은 말); 부재 심볼 `ProviderSettingsLoader` 정리 | DA 행: `미설치` 0 · `dist/[^ ]*\.claude/skills` 0 · `plugins/orcinus-orca` ≥1(anchor `infra/config/paths.ts`) · `ProviderSettingsLoader` 0 | 배포 계층을 읽는 경로 |
| R-01 | AT-01 / AC7 | `security.md`: §1.1 줄번호 `210-213`; §1.3·§1.4 자격증명 모델 = vault+Grant(auth.md 링크, "TBD/EngineSettings" 0); §1.5 DevTools 문장은 코드에 `openDevTools` 0건이면 삭제; §1.6 CSP 를 `index.html:8` 전문 기준으로(`img-src … assets-proxy` 포함, "Google Fonts 외 금지" 0); §1.7 게이트 조건 `valid ∧ verified ∧ ¬dailyReloginRequired`·릴리스 **즉시 게시**·줄번호·`usage-source.ts` 이력 0; Agent provider auth token 절의 settingSources·uv 정정 | DA 행: `줄 21-23` 0 · `TBD` 0 · `assets-proxy` ≥1(anchor `index.html:assets-proxy`) · `수동 Publish\|draft\(수동` 0 · `dailyReloginRequired\|일일` ≥1 · `\buv\b` 0 | 보안 경계를 읽는 경로 |
| R-01 | AT-01 / AC8 | `observability.md §5` 정본이 코드 열거 명령(D-008, 0124 plan 포인터 0); `backend/terms.md §6` 에서 NormalizedEvent 가 `provider` 를 갖는다는 문장 0 | DA 행: `0124.*plan` 0 + `rg` 명령 ≥1 · `sessionId·provider` 0 | 로깅·용어 해설 경로 |
| R-01 | AT-01 / AC9 | `auth.md §3` 모듈 지도에 `plugins/jira`·`plugins/mail`·`deployment/spawn-env.ts`·`harnesses/runtime-catalog.ts` 행; `provider-runtime.md`·`background-tasks.md`·`system-prompt.md` 는 대조 결과 변경 0 또는 소폭(변경 시 DA 행 추가) | DA 행: 네 경로 각 ≥1(anchor 실재) | 인증 플랫폼 경로 |
| R-01 | AT-01 / AC10 | `arch/frontend/overview.md`: §2 기준일 갱신; §3 표에서 Composer `openSkillPicker`·Tweaks "dev 전용"·Projects "mockup"·SkillsMcp 🚧·"멀티세션 UI ❌"·nav 4-항목·MCP "mcpServers+allowedTools 주입" 이 0 이고 0223~0259 행(산출물·Work/Code·transcript 뷰어·worktree·오류 토스트·일일 게이트·텍스트 크기·메뉴 그룹 등)이 있다 | DA 행: `openSkillPicker` 0 · `mockup` 0 · `4-항목` 0 · `AttachMenu\|CascadeMenu` ≥1(anchor `composer/AttachMenu.tsx`) · `GeneralTab\|transcriptTextSize` ≥1 | renderer 구현 상태 경로 |
| R-01 | AT-01 / AC11 | frontend 나머지: `dom-architecture.md §1.2` nav 5항목·`/plugins` 페이지; `state.md` §1.3 테마 2종·§1.4/§4.4 이력 서술 삭제+링크·slots 에 `projectsSlot`·`useChat.ts` 인용 0·§2 Phase-4 anchor 표 현행(0249/0254 배지 ✅)·`ChatEvent.sessionId` 행 정정; `rendering.md` §1.1 가상화 현행(`@tanstack/react-virtual`)·`LiveStatus` 0·telemetry 행; `ux-domains.md` §1.2 chip·§1.6 RISKY_TOOLS 에 PowerShell·"PermissionModeController 미연동/ModeMenu 2종" 0·`pendingApprovals` 분리 스토어·§2 표(nav 5항목·`/plugins`·artifacts·Debug authBypass)·§2.1·§3.2 줄번호 `:1920`; `frontend/terms.md` §6 라우트에 `/artifacts`·`/plugins` | DA 행: `useChat` 0 · `LiveStatus` 0 · `PowerShell` ≥1(anchor `adapters/risky-tools.ts:PowerShell`) · `4-항목\|4항목` 0 · `chatStore.ts:1243` 0 + `:1920` ≥1(anchor `chatStore.ts` 해당 줄의 `onEvent`) · `/artifacts` ≥1(anchor `app/router.tsx`) | renderer 구조·UX 카탈로그 경로 |
| R-01 | AT-01 / AC12 | `PRD.md`(D-003): §7.1 영속화 "잔여 artifacts FS"·자격증명 "잔여" → 현행; §7.3 인터페이스 스케치의 `SessionInfo`·`AsyncIterable<ChatEvent>` 는 **역사 스케치**임을 표기하거나 현행 계약 링크로 대체; §7.4 "One-shot 매 턴 query()" → 장수명 채널(adapters.md 링크); §8 Phase 3 "Artifact FS 잔여"·Phase 4 "배지·탭 잔여" 현행; §9 Projects 채널 수치 0; §11 OQ3 비고 "draft(수동 Publish)" → 즉시 게시(release-operations 링크); §12 `ARCHITECTURE.md` 중복 행 → `arch/frontend`·`arch/backend`; 머리 메타 "최종 동기화" 갱신. **OQ 질문·미결 항목은 비접촉** | DA 행: `One-shot` 0 · `수동 Publish` 0 · `5채널` 0 · `docs/ARCHITECTURE.md` 중복(§12) 1건 이하 · `OQ4\|OQ5\|OQ6\|OQ7\|OQ9\|OQ10` 행 텍스트 불변(git diff 로 확인) | 제품 의도 경로 |
| R-01 | AT-01 / AC13 | `TRD.md`(D-003): 헤더·§1 의 `ARCHITECTURE.md (Renderer) + (Main)` 중복 → `arch/frontend`·`arch/backend`; §2 에 **F16+ 행**(0193~0259 기능을 역량 단위로 묶어 출처 번호 표기, 11행 이상); §3 N3(Ctrl+N 미구현 표기)·N4(DB SSOT)·N6(자격증명 현행); §4 SDK "latest" 0·cheerio/turndown 행·"스위트 4종" 수치 0·마이그레이션 경로 `infra/db/migrations/NNNN_`·패키징 draft 0; §5.2 도메인 목록·예약 표(session:* 구현·credentials 폐기); §5.4 터미널 의미; §6.4 `SessionInfo`→`SessionListItem`; §6.5 ChatState 현행; §6.6 오류 표→`ErrorCategory`; §6.8/§6.8.1 dist 레이아웃·settingSources·uv·`provider:${key}` 폐기 반영; §7.1 anchor·env 표; §9.2 CI 트리거(PR 포함)·draft 0; §10 anchor 중 구현된 것 ✅ 이관; §11 시나리오 수치 0·scripts 목록 현행; §12 중복 | DA 행: `SessionInfo` 0 + `SessionListItem` ≥1(anchor `shared/ipc.ts:SessionListItem`) · `ErrorCode\b` 0 · `src/main/db/migrations` 0 · `13종` 0 · `4종` 0(§4) · `latest` 0(§4) · `F16` ≥1 · `pull_request` ≥1(anchor `.github/workflows/ci.yml:pull_request`) | 기술 사양 경로 |
| R-01 | AT-01 / AC14 | `IPC_CONTRACT.md`: §2 도메인 목록에 artifact·git·error; §2.5 스캔 경로에서 `<cwd>/.claude/skills` 0; §2.6-b "worktree 범위 아님·UI 도 두지 않는다" 0(0209~0211 반영); §2.10 "handleChatSend 가 mcpServers+allowedTools 주입" 0 → plugin `.mcp.json` 배포 + `${BINDING:}` 해석 순서 현행; §2.14 credentials 예약 → 폐기 표기; §3 telemetry 행; §6 절차 6·7(총 채널 수 갱신 → 생성물 재생성·FRONTEND/BACKEND → arch/); §7 오류 형상 → `ClassifiedError` | DA 행: `<cwd>/.claude/skills\|cwd>/\.claude` 0 · `worktree 범위 아님` 0 · `allowedTools 주입\|mcpServers.*주입` 0 · `ClassifiedError` ≥1(anchor `shared/ipc.ts:ClassifiedError`) · `FRONTEND_ARCHITECTURE\|BACKEND_ARCHITECTURE` 0(§6) | 채널 SSOT 경로 |
| R-01 | AT-01 / AC15 | guides: `workspace-isolation-permissions.md` §1·§6·§8 "disallowedTools Orca 미채택(rg=0건)" 0 → WebSearch 차단 용도; §3.4 스케치 `.config/orca` → `orcinus-orca`; PowerShell 비격리 주석 현행; `closed-network-extensions.md` §1.7 경로 패턴 `features/plugins/<sp>/`·예시(Confluence·Jira·Mail)·§6.1 참조 절 번호 실재; `release-operations.md` 대조(변경 0 예상) | DA 행: `미채택` 0 · `/\.config/orca[^-i]` 0 · `features/plugins/<` ≥1 · `auth.md §7` 참조가 가리키는 절 제목 실재(anchor grep `^## 7`) | 운영 절차 경로 |
| R-01 | AT-01 / AC16 | 해설 미러: `claude-code-spec.md` §10·§11·§12 의 Orca 채택 표기 현행(고급 기능 anchor ⏳ → 채택 ✅, cwd 기본 `home` → 프로젝트/worktree cwd, "시스템 프롬프트 미사용" → `# Orca` 헤더 append); `claude-taskxxx-spec.md` §5.4 RISKY_TOOLS 에 PowerShell·0212 ⏳ → ✅ | DA 행: `Phase 4\+` 0(두 파일) · `PowerShell` ≥1(claude-taskxxx-spec) · `0212` 행에 `⏳` 0 | 외부 스펙 해설 경로 |
| R-01 | AT-01 / AC17 | 라우터·규칙 문서: `ARCHITECTURE.md` 파일 맵에 `background-tasks.md` 행·system-prompt 행 헤더 `# Agent`·`# Tools` 포함·"그 외" 표에 `decisions/`·`generated/`·`opencode-sdk-spec.md`·`claude-taskxxx-spec.md`; `docs/INDEX.md` 라우팅은 신규 절 링크 필요 시만 행 추가; `docs/AGENTS.md:59`·루트 `AGENTS.md:42`·`app/AGENTS.md:98` 의 `TRD §15` → `TRD §10`(D-007); `app/AGENTS.md:74` CSP 문장에 `img-src`(D-007) | DA 행: `background-tasks.md` ≥1(ARCHITECTURE) · `TRD §15` 0(세 파일) · `assets-proxy` ≥1(app/AGENTS) | 진입점 경로 |
| R-03 | AT-03 / AC18 | 상태 표식 전건 판정: 범위 문서의 `⏳`·`🚧`·`미구현`·`잔여`·`TBD`·`Phase 4+` 사이트는 **정정(표식 제거)** 되거나 `status-marks.tsv` 에 `유지` 행(근거 = 코드 좌표 또는 "실제 미구현")을 갖는다 — 판정 없는 표식 0 | `drift-check.sh check` 표식 축: 미등재 0 · 잔류 0(양방향 차집합). 유지 행의 근거 칸이 비면 형식오류 | 에이전트가 "미구현/잔여" 를 믿고 중복 구현하는 경로 차단 |
| R-02 | AT-02 / AC19 | 핸드오프 커버리지: 0193~0259 디렉토리 전건이 `handoff-coverage.tsv` 에 있고, 각 행은 `반영 문서(들)`+`확인어(ERE)` 또는 `—`+이유(비기능 정리·연구·보류 등)를 갖는다. 확인어는 그 문서에서 ≥1 매치 | `drift-check.sh check` 커버리지 축: 디렉토리 ↔ 행 양방향 차집합 0 · 확인어 미매치 0 · 반영 문서 경로 실재 | 사용자 요구 "모두 적용" 의 관측 |
| R-01 | AT-01 / AC20 | `drift-assertions.tsv` 전행 통과 — `must_not` 0건·`must` ≥1건·`anchor` 실재(파일 또는 `파일:ERE`). AC1~AC17 의 DA 행이 여기 산다 | `drift-check.sh check` 단언 축 exit 0 · 행 수는 산출이 갖는다(산문에 적지 않음) | 정정 사실의 되돌림 감지 |
| R-04 | AT-04 / AC21 | doc-gate: `regen` 후 신규 심볼(현재 28)·경로(12)·시제(104) 사이트 전건 분류/판정 → `check` 차집합 9종 전부 0·exit 0. ADR 사이트는 `역사`(D-005). `limits` 는 F1(라벨 "맨 CamelCase (산문+펜스)")·F2(인용 파일 기준 상대경로 실재는 제외)·F3(주석/plan "exit 0 고정" → "한계 크기는 exit 를 바꾸지 않는다") 반영 | `bash doc-gate.sh check` 출력 `전부 공집합 — 통과` · `limits` 산출에서 `app/AGENTS.md:3` 류 상대경로 사이트 부재 · `0192/plan.md`·`doc-gate.sh` 에 `exit 0 고정` 0 | 0192 운영 gate 승계 |
| R-04 | AT-04 / AC22 | `node scripts/check-doc-inventory.mjs --check` 가 `generated doc ok`·`prose ok`·`links ok` 3줄·exit 0 — 문서 변경 뒤에도 유지되고 `generated/inventory.md` 는 스크립트 재생성 외 diff 0 | 명령 출력 3줄 · `git diff --stat docs/generated/` | CI(`ci.yml`) 경로 |
| R-01 | AT-01 / AC23 | 산출물 규칙: 이번 diff 가 `arch/**` 에 추가하는 문장에 델타 서술(`에서 제거`·`→` 수치 변화) 0 · 수치 복제 0(AC22) · 한국어 · 핸드오프 번호는 `(0NNN)` 출처 표기만 | `git diff docs/arch | grep '^+' | grep -E '에서 제거|에서 재작성'` 0 · AC22 | `docs/AGENTS.md` 작성 규칙 4 |
| R-01 | AT-01 / AC24 | 보드·커밋: plan READY 커밋이 구현 커밋과 분리되고, 구현 커밋 trailer(`Agent: claude`·`Handoff`·`Status: implemented`·`Criteria-Met`·`Verified-By: pending`)가 파싱되며, INDEX 행 상태가 plan 메타·verify 판정과 같다 | `git log -1 --format='%(trailers:only=true)'` 비공집합 · INDEX 행 ↔ plan 메타 대조 | 메시지 버스 |

### AC 검증 주의사항

- 기존 테스트 재사용: 코드 테스트는 쓰지 않는다. 재사용하는 장치는 `doc-gate.sh check`(0192, 3축 양방향 차집합 — 이번 세션 실행 exit 1·미분류 28/미등재 12/미판정 104 관측)와 `check-doc-inventory.mjs --check`(exit 0 관측).
- 사람 실기 항목: 없음 — 문서 사실성의 최종 판정(`prose-veracity`)은 grep 이 못 하지만 **이번 작업이 바꾼 사실은 전부 DA 행으로 좌표화**하고, 바꾸지 않은 문장의 사실성은 범위가 아니다(0192 등록부 "계측불가" 승계).
- N회/총량 기준: 해당 없음. 0건 기준(`must_not`)은 **반드시 양성 단언(`must`+anchor)과 짝**이다 — 0건만 있는 행은 형식오류로 거부한다(§10 EP-13).
- 총량/0건 기준: `TRD §15` 0 의 분모는 세 파일(루트·docs·app AGENTS) — `rg 'TRD §15' --glob '!docs/handoff/**'` 이번 세션 3건. 상태 표식 0 의 분모는 범위 문서 46파일(`drift-check.sh` SCOPE = `doc-gate.sh` SCOPE 와 같은 `find` 식 — 복사하지 않고 같은 함수 정의를 쓴다).

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V** — 0191/0192 는 구 템플릿이라 명시적 V 가 없다(0192 plan 에 `Node registry` 0건, `grep -c 'VP-' 0192/plan.md` = 0).
- 기준 V 상속 근거: 없음. 운영 gate 로서 `doc-gate.sh` 만 승계(§현재 변경의 운영 gate).
- `SUPERSEDED` 로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 AC1~AC17·AC20·AC23 — 범위 문서의 코드 인용 사실이 현재 코드와 일치 | NEW | — |
| R-02 | R | §7 AC19 — 0193~0259 전건의 반영 위치가 추적된다 | NEW | — |
| R-03 | R | §7 AC18 — 상태 표식 전건이 판정된다 | NEW | — |
| R-04 | R | §7 AC21·AC22 — 기존 위생 게이트가 초록으로 유지된다 | NEW | — |
| AT-01 | AT | `drift-check.sh check` 단언 축 + 각 DA 행의 anchor | NEW | — |
| AT-02 | AT | `drift-check.sh check` 커버리지 축 | NEW | — |
| AT-03 | AT | `drift-check.sh check` 표식 축 | NEW | — |
| AT-04 | AT | `doc-gate.sh check` · `check-doc-inventory.mjs --check` 산출 | NEW | — |
| SD-01 | SD | §9 TO-BE — 같은 사실은 한 정본 + 링크(SSOT 구조); 사본이 남는 사실은 §10 EP-01~EP-07 의 자리 전부가 같은 말을 한다 | NEW | — |
| ST-01 | ST | DA 행 중 **다중 파일 사실**(settingSources·disallowedTools·dist 레이아웃·릴리스 게시·nav 항목·SessionRuntime 상태·자격증명 모델)의 자리별 행 — 자리 하나라도 낡으면 red | NEW | — |
| AR-01 | AR | §10 EP-11 — doc-gate baseline 3 TSV 가 데이터 계약(버킷·축·판정 어휘)을 지키고 신규 사이트가 조용히 통과하지 않는다 | NEW (장치는 0192 승계) | — |
| IT-01 | IT | `doc-gate.sh check` exit 0 + `미분류 표식`·`미판정 표식` 0 (차집합 관측) | NEW | — |
| AR-02 | AR | §10 EP-10·§13 — 판정·상태 사본(plan 메타 ↔ INDEX 행 ↔ verify 판정 ↔ 커밋 trailer)이 같은 값 | NEW | — |
| IT-02 | IT | INDEX 행·plan 메타·trailer 를 한 명령으로 나란히 출력해 대조(`sed -n` + `git log --format=%(trailers)`) | NEW | — |
| MD-01 | MD | §11 `drift-check.sh` — 세 축 판정 의미: 단언(must_not=0 ∧ must≥1 ∧ anchor 실재), 표식(사이트 ↔ 유지 행 양방향), 커버리지(디렉토리 ↔ 행 양방향 + 확인어). 0건 단독 행 거부 | NEW | — |
| UT-01 | UT | 결함 심기 — ① DA 행의 정정 문구를 문서에서 지움 → 단언 축 red ② 유지 행 1개 삭제 → 표식 축 미등재 red ③ 커버리지 행 1개 삭제 → red ④ anchor 를 부재 경로로 바꿈 → red | NEW | — |
| MD-02 | MD | `doc-gate.sh limits` 의 `non-ts-paths` 가 인용 파일 기준 상대경로로 실재하는 인용을 세지 않는다(F2); 라벨·주석 문구(F1·F3) | NEW (0192 파생) | — |
| UT-02 | UT | `limits` 산출 전후 diff — `app/AGENTS.md:3 ../docs/handoff/INDEX.md` 류 24사이트 부재(0192 verify F2 의 분해 24/46 재현) + 존재하지 않는 상대경로 인용을 임시 삽입하면 여전히 세어진다(방향) | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 코드 사실 → 문서 문장(정정) → `drift-assertions.tsv` 행 → `drift-check.sh check` → 에이전트가 읽는 문서 | 자리마다 `drift-assertions.tsv:<id>`(must_not/must/anchor) — `gate:bash docs/handoff/0260-docs-handoff-resync/drift-check.sh check` | required — 0건 단언은 구조적 proxy 라 방향 확인: UT-01 ① (정정 문구 제거 → red). 심을 자리 = EP-01·EP-02·EP-03 각 1자리 + 단일 파일 행 1자리 | EP-01~EP-07·EP-13 (자리 수는 `check` 산출 `단언 N행`) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `docs/handoff/0193..0259` 디렉토리 → `handoff-coverage.tsv` 행(반영 문서·확인어) → 문서 본문 grep → `check` | `handoff-coverage.tsv` 전행 — `gate:drift-check.sh check` 커버리지 축 | required — 전수 주장: UT-01 ③(행 삭제 → red) + 확인어를 부재 단어로 바꿈 → red | EP-09 (67자리 = 디렉토리 수) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 범위 문서 표식 사이트 → 정정(제거) 또는 `status-marks.tsv` 유지 행 → `check` 양방향 차집합 | `status-marks.tsv` 전행 — `gate:drift-check.sh check` 표식 축 | required — 전수 주장: UT-01 ②(유지 행 삭제 → 미등재 red) + 문서에 표식 1개 삽입 → 미등재 red | EP-08 (자리 수 = 표식 사이트 수, `check` 산출) |
| VP-04 | R-04 ↔ AT-04 | REGRESSION 성격의 REQUIRED(기존 장치 유지) | 문서 수정 → `doc-gate.sh regen` → baseline 분류/판정 → `check`; `check-doc-inventory.mjs --check` | `gate:bash docs/handoff/0192-doc-gate-baselines-as-data/doc-gate.sh check` · `gate:node app/scripts/check-doc-inventory.mjs --check` | not selected — 0192 AC1 이 baseline 1행 삭제 red 를 이미 잠갔고 이번에 장치를 바꾸지 않는다(`limits` 만 변경, `check` 경로 불변) | EP-11·EP-12 (baseline 3파일 + inventory 1) |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED | 한 사실의 사본 자리 전부(EP-01~EP-07 열거) → 각 자리 DA 행 → `check` | 자리별 `drift-assertions.tsv:<id>` — 자리는 §10 의 `rg` 분모로 센다 | required — 형제 자리 민감도: 자리 하나만 되돌림(예: TRD §6.8 의 settingSources 만 낡은 문장으로) → 그 행만 red 이고 다른 자리 행은 green(자리 식별) | EP-01(13 후보)·EP-02(21)·EP-03(dist 사이트)·EP-04(릴리스 게시)·EP-05(4)·EP-06(2)·EP-07(4) |
| VP-06 | AR-01 ↔ IT-01 | REQUIRED | `regen` → TSV(신규 = UNCLASSIFIED/UNJUDGED) → 사람 판정 → `check` 형식오류 축이 표식 잔존을 짚음 | `gate:doc-gate.sh check` 출력의 `형식오류 0`·`미분류(사이트) 0`·`미판정 0`·`잔류 0` | not selected — 직접 oracle(차집합 출력)이 방향을 갖는다; 0192 AC1 잠금 승계 | EP-11 (3자리 = 3 TSV) |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | plan 메타 상태 → INDEX 행 → 커밋 trailer → verify 판정 | `gate:git log -1 --format='%(trailers:only=true)'` 비공집합 · `sed -n '/0260-docs/p' docs/handoff/INDEX.md` 와 plan 메타 나란히 출력 | not selected — 두 사본을 한 출력으로 대조하는 직접 관측 | EP-10 (사본 3자리: plan 메타·INDEX 행·trailer; verify 턴에 verify 판정 추가) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | TSV 행 → `drift-check.sh` 판정 함수 → exit/출력 | UT-01 ①~④ 각각 `gate:drift-check.sh check` red 관측(실패 행 id 출력) | required — 장치 자체가 0건/전수 oracle 이라 민감도 확인이 의무(handoff-impl §3) | EP-13 (판정 함수 3 + 형식 검사 1 = 4자리) |
| VP-09 | MD-02 ↔ UT-02 | REQUIRED | 범위 문서의 비-ts 인용 → `limits` 상대경로 해석 → 산출 수 | `gate:doc-gate.sh limits` 전후 산출 비교(`non-ts-paths` 라벨) — 전 70(0192 r3 관측) → 후 = 실제 미해결 수 · 결함 변이 삽입 시 +1 | required — 음성 변화(수가 줄어듦)만으로는 방향이 안 보인다: 부재 상대경로 1건 삽입 → +1 관측 | EP-14 (1자리 = `limits` 해석 함수) |

`§10 강제 지점 전수` 의 N 은 자리 수다. EP-01~EP-07 의 후보 수는 §8 전수 조사의 술어 매치 수이고, 실제 자리(낡은 사실을 운반하는 줄)는 구현 턴에 자리마다 판정해 DA 행으로 적는다 — 후보 ≥ 자리.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| doc-gate 3축 | 범위 문서를 고치면 심볼·경로·시제 사이트가 이동/신설된다 | `bash docs/handoff/0192-doc-gate-baselines-as-data/doc-gate.sh regen && … check` → `전부 공집합 — 통과` | 이번 변경이 만든 미분류·미판정·잔류만 blocking(현재 exit 1 의 128건은 이번 범위 안이라 전부 닫는다) |
| 인벤토리 가드 3종 | 수치 복제·링크 파손은 CI 가 막는다 | `node app/scripts/check-doc-inventory.mjs --check` 3줄 ok | prose/links 위반 blocking |
| drift-check 3축 | 이번 handoff 의 장치 | `bash docs/handoff/0260-docs-handoff-resync/drift-check.sh check` exit 0 | 차집합 ≠ 0 blocking |
| message-bus | trailer 파싱·INDEX 사본 | `git log -1 --format='%(trailers:only=true)'` · INDEX 행 | 파싱 0건·사본 불일치 blocking |
| app 게이트(lint/typecheck/vitest) | **적용 안 함** — `app/src/**` 변경 0. `app/AGENTS.md` 1줄 2곳은 문서 | `git diff --stat -- app/src` = 0 | 해당 없음 |

> 보안·데이터 무결성 제약은 이번 요구 경로에 없다(문서 작업). 비밀·개인정보가 문서에 들어가지 않는 것은 `docs/AGENTS.md` 위생 규칙으로 유지한다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| SessionRuntime 상태는 `'cold' \| 'live' \| 'busy' \| 'interrupting' \| 'error' \| 'closed'` — `idle` 없음 | `app/src/main/contracts/session-state.ts:1` |
| cap 정책 `new BoundedRuntimeCapPolicy()` + `capacity` 상수 | `app/src/main/app/bootstrap.ts:991-992` |
| SDK 는 exact pin(`"@anthropic-ai/claude-agent-sdk": "0.3.296"`), `@opencode-ai/sdk` 도 설치됨 | `app/package.json` (0258) |
| `settingSources` = `['project','local']` | `app/src/main/adapters/claude-adapt.ts:96-97` (0117) |
| `disallowedTools: ['WebSearch']`; hooks = `adaptHooks(extensions.hooks)` + 어댑터 내부 Stop/PreToolUse 훅 병합 | `app/src/main/adapters/claude.ts:559`·`:561-599` |
| 게이트 통과 = `status==='valid' && verified && !dailyReloginRequired` | `app/src/main/features/gate/index.ts:88` · `gate/daily.ts:18` (0255) |
| CSP 전문 — `img-src 'self' data: https://assets-proxy.anthropic.com` 포함 | `app/src/renderer/index.html:8` |
| webPreferences 줄 `210-213`; `openDevTools` 호출 `src/main` 에 0건 | `app/src/main/index.ts` · `rg openDevTools app/src/main` = 0 |
| 릴리스: `v*` 태그 → `--publish always`(즉시 게시), dispatch → `--publish never` | `.github/workflows/release.yml` · `docs/guides/release-operations.md:9,31` |
| nav 5항목(`/new`·`/projects`·`/artifacts`·`/agent`·`/plugins`), 라우트에 `/artifacts`·`/plugins` | `app/src/renderer/src/app/navItems.ts` · `app/router.tsx` |
| `openSkillPicker`·`useChat.ts`·`LiveStatus`·`SessionInfo`·`ErrorCode` 는 코드에 없다; `SessionListItem`·`ClassifiedError`·`ErrorCategory` 가 현행 | `rg` 각 0건 / `app/src/shared/ipc.ts:1429` 등 |
| RISKY_TOOLS = Bash·PowerShell·Write·Edit·MultiEdit·NotebookEdit | `app/src/main/adapters/risky-tools.ts` |
| 마이그레이션 0019~0027: baseline_oid/ref · artifact_files/session_artifacts(kind·category·pinned 재구축) · agent_kind(`coding`→`code`/`work`) · projects cwd/cwd_key · background_task_events | `app/src/main/infra/db/migrations/0019_*.sql`~`0027_*.sql` |
| 로그 info 이벤트 코드 열거 28종 — 0124 plan 표에 없는 `app.legacy.migrated`·`auth.grant.orphaned`·`chat.postturn.step`·`chat.session.discarded`·`chat.steer.orphaned`·`legacy.paths.rebased` | `rg -o "info\('[a-z.]+'" app/src/main \| sort -u` |
| 디렉토리: `features/{agents,approvals,artifacts,auth,chat,extensions,gate,harnesses,history,orchestration,plugins,scheduler,sessions,usage,worktrees}` · `infra/{background-output,browser-session,bus,config,cron,db,error-report,git,ipc,log,net,…}` · `app/handlers/{artifacts,boot,context-file,context,cost,engine,error,files,git,log,mcp,misc,project,providers,session-directory,session,settings,skills,update}` | `ls app/src/main/features app/src/main/infra app/src/main/app/handlers` (이번 세션) |
| `AgentKind = 'code' \| 'work'` · worktree 서비스 · 백그라운드 컨트롤러 · 일일 게이트 모듈 | `app/src/shared/agent-kind.ts:3-4` · `features/worktrees/service.ts` · `features/chat/background-controller.ts` · `app/daily-gate.ts` |
| doc-gate baseline 형식: `symbol-buckets.tsv`(심볼\t버킷) · `path-exceptions.tsv`(축\t사이트\t경로\t사유) · `tense-sites.tsv`(종류\t심볼\t사이트\t판정) — `regen` 은 `(종류,심볼,file:line)` 키로 이전 판정을 보존하므로 **줄 이동 = 신규** | `0192/doc-gate.sh:9-12,228-255` |
| 0192 F1~F3 의 자리: 라벨 행 `0192/plan.md §19 등록부 "추출 / 맨 CamelCase 산문"` · `doc-gate.sh` `limits` 의 non-ts 해석(`:290-302`) · "exit 0 고정" 문구 `doc-gate.sh:7,260` + `0192/plan.md:275,379,595,641` | `rg 'exit 0 고정' docs/handoff/0192-*` = 6건 |
| 외부 SDK/API | 해당 없음 — 벤더 사실은 `docs/spec/**` 원문 미러를 바꾸지 않는다(D-006) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 범위 문서 | `find docs -name '*.md'` − `handoff/archive/etc/spec` | 46 | 그중 stub 2·생성물 1·ADR 8 은 본문 비편집 |
| 핸드오프 0193~0259 디렉토리 | `ls -d docs/handoff/0[12]*/` 중 번호 ≥193 | 67 | 커버리지 TSV 분모. `verify.md` 없는 것 6(0205·0208·0214·0219·0220 — 0219/0220 은 사용자 보류) |
| 현재 문서가 번호로 인용하는 핸드오프(0193~0259) | `rg -l '\b0NNN\b'` 범위 문서, N=0193..0259 | 22 | 45건은 번호 인용 없음 → 커버리지 행에서 확인어로 잠근다 |
| `settingSources` 후보 사이트 | `rg -n settingSources` 범위 문서 | 13 | EP-01 분모 |
| `disallowedTools` 후보 | 같은 방식 | 21 | EP-02 분모 |
| dist 레이아웃 후보 `\.claude/skills` / `\.mcp\.json` | 같은 방식 | 21 / 12 | EP-03 — `~/.claude/skills`(정상 스캔 루트)·plugin `.mcp.json`(정상) 을 자리마다 가른다 |
| 릴리스 `draft` 후보 / `수동 Publish` | 같은 방식 | 21 / 3 | EP-04 — 롤백 절차의 draft 되돌리기(정상)와 "draft 게시"(낡음)를 가른다 |
| nav `4-항목\|4항목\|4 항목` | 같은 방식 | 4 | EP-05 |
| `cold/idle\|idle/busy` / `5채널` | 같은 방식 | 2 / 2 | EP-06 / GLOSSARY·PRD |
| 상태 표식 `⏳`·`🚧`·`미구현`·`잔여`·`TBD`·`Phase 4+` | 같은 방식 | 31·3·32·40·9·6 | EP-08 후보(중복 줄 포함) — 자리 수는 `drift-check.sh` 산출 |
| `useChat` / `LiveStatus` / `SessionInfo` / `ErrorCode\b` / `openSkillPicker` | 같은 방식 | 14 / 1 / 3 / 3 / 1 | 부재 심볼 인용 |
| `ARCHITECTURE.md` 인용 | 같은 방식 | 27 | 대부분 정상 링크(라우터) — TRD 헤더·PRD §12 의 "(Renderer)+(Main)" 중복만 자리 |
| doc-gate 현재 차집합 | `doc-gate.sh check` | 미분류 28 · 미등재 12 · 미판정 104 | 이번 변경 전 상태(exit 1) — 전부 범위 안 |
| 로그 info 이벤트 | `rg -o "info\('[a-z.]+'"` | 28 | observability §5 정본을 명령으로 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 위 표 전부 이번 세션 측정(2026-10-13). 산문에 적는 수치는 §8 에만 두고 문서 본문엔 적지 않는다(D-010·D-011).
- 내역 합 = 총계: 범위 46 = 편집 후보 35 + stub 2 + 생성물 1 + ADR 8 ✓ · 핸드오프 67 = verify 있음 61 + 없음 6 ✓.
- "유일한/항상/절대" 반례 검색: "disallowedTools Orca 미채택(rg=0건)" 의 반례 = `claude.ts:559` 1건 · "DevTools 자동 오픈" 의 근거 = `rg openDevTools app/src/main` 0건(문장 삭제 근거).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `docs/handoff/AGENTS.md §공통 V 추적 프로토콜`·`§INDEX.md 운영`·`§산출물 문장 규칙` 실재(`grep -n '^## '`) · `release-operations.md:9` "즉시 게시" 실재 · `decisions/008` 실재 · `auth.md` `## 7` 절(Plugin) 실재는 구현 턴에 `grep '^## 7'` 로 재확인(AC15).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`
- 현재 책임 소유자: 각 핸드오프의 구현/검증 턴이 자기 plan 이 가리킨 문서만 갱신. 전수 대조는 0191(수동)·0192(3축 게이트)가 마지막.
- 현재 entry → flow → consumer: 코드 변경 → (핸드오프 plan 이 지정한 문서만) 갱신 → `doc-gate.sh` 는 사람이 돌릴 때만 → 에이전트가 `docs/INDEX.md` 라우팅으로 문서 읽음.
- 현재 오류 경로: 낡은 문장은 심볼·경로가 실재하면 doc-gate 를 통과한다(`prose-veracity 계측불가`). 예: "disallowedTools 는 넘기지 않는다" — 심볼 실재·시제 술어 없음 → 어느 축도 안 잡는다.
- 문제의 직접 원인: 의미 드리프트에 대한 **자리 단위 단언**이 없고, 상태 표식(⏳·잔여)에 판정 주체가 없다.

```text
[코드 변경 (핸드오프 N)]
  → [plan N 이 지정한 문서만 갱신]
  → [doc-gate: 심볼·경로·시제만, 사람이 돌릴 때만]
  → [에이전트: INDEX 라우팅 → 낡은 문장을 설계 입력으로]
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `MD-01`
- 변경 후 책임 소유자: 이번 턴(Claude)이 범위 문서 전수를 코드와 대조해 정정하고, 정정한 사실마다 DA 행·판정 행을 남긴다. 장치는 `0260/drift-check.sh` 가 소유한다.
- 변경 후 entry → flow → consumer: 코드 사실(§8) → 문서 정정(정본 1곳 + 사본은 링크 또는 같은 말) → TSV 행 → `drift-check.sh check` + `doc-gate.sh check` + 인벤토리 → 커밋 → 에이전트가 읽음.
- 변경 후 오류 경로: 누가 정정을 되돌리면 `drift-check.sh check` 가 행 id 로 red. 새 표식을 판정 없이 넣으면 표식 축 미등재 red.
- 유지하는 기존 메커니즘: `doc-gate.sh`(변경은 `limits` 의 F1~F3 만) · `check-doc-inventory.mjs`(불변) · 문서 파일/절 구조(불변). 제거/대체: `observability §5` 의 0124 plan 포인터 → 명령(대체) · `adapters §1.5` 구 ChatEvent 표 → IPC_CONTRACT §3 링크(삭제+링크) · `security §1.5` DevTools 문장(삭제 — 코드 근거 0).

```text
[코드 사실 §8]
  → [범위 문서 정정 — 정본 1곳, 사본은 링크/같은 말]
  → [drift-assertions.tsv · status-marks.tsv · handoff-coverage.tsv]
  → [drift-check.sh check ∧ doc-gate.sh check ∧ inventory --check = 0]
  → [에이전트: INDEX 라우팅 → 현재 사실]
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 핸드오프별 국소 갱신 | 전수 대조 1회 + 자리 단위 단언 장치 | 의미 드리프트 누적 | AR-01 / VP-01·VP-05 · `drift-check.sh` |
| data/control flow | 사실 → 문서(검증 없음) | 사실 → 문서 → TSV 행 → check | 되돌림 감지 | SD-01 / VP-05 · 세 TSV |
| state/contract | 상태 표식에 판정 주체 없음 | 표식 = 정정 또는 유지 행(근거) | "잔여" 를 믿고 중복 구현하는 경로 차단 | R-03 / VP-03 · `status-marks.tsv` |
| error/lifecycle | regen 뒤 미판정이 쌓임(104) | regen → 전건 판정 → check 0 | 0192 운영 gate 승계 | AR-01 / VP-06 |
| test seam/관측점 | `prose-veracity 계측불가` | 바꾼 사실만 좌표화(anchor) — 계측 한계는 그대로 등록 | 측정 가능한 범위를 정직하게 좁힌다 | MD-01 / VP-08 · UT-01 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `0260/drift-check.sh` | 세 TSV 대조 + preflight + 형식 검사 | TSV·범위 문서 → 차집합 출력·exit | 구현자·검증자(수동) |
| `0260/drift-assertions.tsv` | 정정 사실의 자리별 단언 | id·file·must_not·must·anchor·note | `drift-check.sh` |
| `0260/status-marks.tsv` | 남는 표식의 유지 판정 | file·marker·snippet·근거 | `drift-check.sh` |
| `0260/handoff-coverage.tsv` | 0193~0259 → 문서/확인어 | handoff·docs·확인어·비고 | `drift-check.sh` |
| `0192/doc-gate.sh` | 심볼·경로·시제 3축(불변) + `limits` F1~F3 | 범위 문서·baseline → 차집합 | 구현자·검증자 |
| 범위 문서 46 | 현재 상태 서술 | — | 에이전트·사람 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| SD-01 / VP-05 | **EP-01** settingSources = `['project','local']` (사용자 settings 미상속) | `claude-adapt.ts:adaptSettingSources` | 구현자(DA 행) | `check` 때 — 자리 = `rg settingSources` 범위 문서 13 후보 중 낡은 문장을 운반하는 줄 전부(adapters §1.7·§2.1·§3.1 · standardization §5.1 · security 토큰 절 · TRD §6.8·§6.8.1·§7.1 · claude-code-spec §11 · workspace 가이드) | 한 자리라도 "생략=상속" 이면 red |
| SD-01 / VP-05 | **EP-02** disallowedTools = `['WebSearch']` (격리 해제가 아니라 WebSearch 차단) | `claude.ts:559` | 구현자 | 자리 = `rg disallowedTools` 21 후보 중 "넘기지 않는다/미채택/보류" 줄 | red |
| SD-01 / VP-05 | **EP-03** dist 레이아웃 = `dist/<engine>/plugins/orcinus-orca/{skills,.mcp.json}` | `infra/config/paths.ts` · standardization §5.1 | 구현자 | 자리 = `rg 'dist/[^ ]*\.claude/skills\|dist/<engine>/\.mcp'` 줄(adapters §2.1·§3.1 · standardization §5.2 · TRD §6.8·§6.8.1) | red |
| SD-01 / VP-05 | **EP-04** 릴리스 = `v*` 태그 push 시 즉시 게시, dispatch 는 dry-run | `release.yml` · `release-operations.md` | 구현자 | 자리 = `rg '수동 Publish\|draft\(수동\|Releases \*\*draft'` 줄(security §1.7 · PRD OQ3 비고 · TRD §4·§9.2·§10) — 롤백 절차의 draft 는 정상 | red |
| SD-01 / VP-05 | **EP-05** nav = 5항목(`navItems.ts`) + `/plugins`·`/artifacts` 페이지 | `navItems.ts` · `router.tsx` | 구현자 | 자리 = `rg '4-항목\|4항목\|4 항목\|플러그인 모달'` 줄(frontend overview §3 · dom-architecture §1.2 · ux-domains §2 · frontend/terms §6) | red |
| SD-01 / VP-05 | **EP-06** SessionRuntime 상태 어휘 | `contracts/session-state.ts:1` | 구현자 | 자리 = `rg 'cold/idle\|idle/busy'`(GLOSSARY · 그 밖 1) | red |
| SD-01 / VP-05 | **EP-07** 자격증명 모델 = Auth Grant→vault, Harness env 주입, MCP `${BINDING:}`; "어댑터별 base URL/API key 저장은 Future/TBD/Phase 3+" 폐기 | `auth.md` · `contracts/auth.ts` | 구현자 | 자리 = GLOSSARY Credential 행 · security §1.3·§1.4 · TRD N6 · PRD §7.1 | red |
| R-03 / VP-03 | **EP-08** 표식 전건 판정 | `status-marks.tsv` | 구현자 | `check` 표식 축 — 자리 = 범위 문서의 표식 사이트 전부(산출이 센다) | 미등재/잔류 ≠ 0 red |
| R-02 / VP-02 | **EP-09** 커버리지 전건 | `handoff-coverage.tsv` | 구현자 | 자리 = 디렉토리 67 | 결손/확인어 미매치 red |
| AR-02 / VP-07 | **EP-10** 판정·상태 사본 일치 | plan 메타 → INDEX 행 → trailer → verify | 설계자/구현자/검증자 | 각 턴 커밋 전 — 자리 3(+verify 1) | 사본 불일치 = 메시지 버스 오염 |
| AR-01 / VP-06 | **EP-11** baseline 3 TSV 어휘·전건 판정 | `doc-gate.sh:9-12` | 구현자 | `regen` 뒤 `check` — 자리 3 | `형식오류`·`미분류`·`미판정` ≠ 0 |
| R-04 / VP-04 | **EP-12** 수치 복제 금지·링크 실재 | `check-doc-inventory.mjs` | 구현자 | 커밋 전 — 자리 1(명령) | prose/links 위반 |
| MD-01 / VP-08 | **EP-13** `drift-check.sh` 판정 함수 3 + 형식 검사(0건 단독 행 거부·빈 칸 거부) | 스크립트 | 구현자 | 스크립트 작성 직후 UT-01 ①~④ | 장치가 결함을 못 보면 모든 PASS 가 무의미 |
| MD-02 / VP-09 | **EP-14** `limits` non-ts 상대경로 해석 | `doc-gate.sh:290-302` | 구현자 | `limits` 전후 비교 + 결함 삽입 | F2 재발 |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 공유 방법: SCOPE 정의는 `doc-gate.sh scope_files()` 와 같은 `find` 식을 `drift-check.sh` 가 **복사**해야 한다(별 스크립트) — 복사 사실을 두 파일 주석에 적고, 차이가 나면 `drift-check.sh preflight` 가 `doc-gate.sh sweep` 의 파일 수와 비교해 die 한다(공유 대신 대조).
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: 없음.
- 선택적 필드: TSV 는 빈 칸 금지(`-` 로 명시). `must_not`/`must` 중 하나가 `-` 일 수 있으나 `must_not` 만 있는 행은 거부(EP-13).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `docs/handoff/0260-docs-handoff-resync/drift-check.sh` (신규) | 세 축 대조 | `check` 서브커맨드 하나. preflight(SCOPE>0·TSV 존재·doc-gate 파일 수 일치) → 단언 축 → 표식 축 → 커버리지 축 → 요약·exit | UT-01 결함 심기 ①~④ |
| `…/drift-assertions.tsv` (신규) | 자리별 단언 | `id\tfile\tmust_not\tmust\tanchor\tnote` — AC1~AC17 의 DA 행 | 행 단위 red/green |
| `…/status-marks.tsv` (신규) | 유지 판정 | `file\tmarker\tsnippet\t근거` — snippet 은 줄 앞 60자(탭·`\|` 정리) | 표식 축 |
| `…/handoff-coverage.tsv` (신규) | 커버리지 | `handoff\tdocs(;구분, 또는 -)\t확인어(ERE 또는 -)\t비고` | 커버리지 축 |
| 범위 문서 35(§6) | 현재 상태 | AC1~AC17 의 정정 | DA 행 |
| `docs/handoff/0192-…/doc-gate.sh` | `limits` | F2: 비-ts 인용을 인용 파일 디렉토리 기준으로도 `test -e` 해 실재면 제외 · F1/F3 주석 문구 | `limits` 전후 비교 |
| `docs/handoff/0192-…/plan.md §19·§11` | 등록부 문구 | F1 라벨 행 "맨 CamelCase (산문·펜스 포함)" · F3 "exit 0 고정" → "한계 크기는 exit 를 바꾸지 않는다(preflight 는 exit 2)" | grep 0 |
| `docs/handoff/0192-…/baselines/*.tsv` | 분류/판정 | `regen` 뒤 신규 전건 판정 | `check` |
| 루트 `AGENTS.md:42` · `docs/AGENTS.md:59` · `app/AGENTS.md:74,98` | 참조 정정(D-007) | `TRD §15` → `TRD §10` · CSP 문장 `img-src` 추가 | DA 행 |
| `docs/handoff/INDEX.md` | 보드 | 0260 행 추가/갱신 | EP-10 |

### 테스트 가능성

- electron/DB/native 의존부: 없음 — 전부 bash·grep·find. `drift-check.sh` 는 `set -uo pipefail`, GNU grep `-P` 미사용(`-E` 만) 으로 doc-gate 와 같은 환경 가정.
- 기존 메커니즘 재사용: `doc-gate.sh` 의 SCOPE 식·exit 규약(0 통과·1 차집합·2 preflight)을 그대로 쓴다.
- 순서 관측: 세 축은 독립이라 순서 없음. 출력은 축별 라벨 + 차집합 줄.

## 12. End-to-end 영향

### producer → consumer

```text
코드 사실(app/src · workflows · package.json)
  → 문서 문장(정본 1곳 + 사본 링크/같은 말)
  → TSV 행(anchor 가 코드 좌표를 다시 가리킴)
  → drift-check / doc-gate / inventory
  → 에이전트·사람 독자
```

- producer 기준: 코드가 진실(루트 `AGENTS.md` 원칙 1). 문서는 코드 경로를 인용하고 값은 적지 않는다(D-011).
- consumer 파생 규칙: 사본 문서는 정본을 링크하거나 **같은 말**을 한다 — 같은 말인 자리는 EP-01~EP-07 로 전부 등록.
- 파생 가능한 합성값: 채널·테이블·마이그레이션 수는 생성물만 갖는다(D-012).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `doc-gate.sh` baseline(0192) | 범위 문서 편집으로 사이트 이동 → `regen` 후 전건 재판정 필요 | AC21 |
| `check-doc-inventory.mjs` 링크 검사 | 문서 간 링크 추가/변경 | AC22 |
| `docs/INDEX.md` 라우팅 | 새 절을 가리켜야 할 때만 행 추가 | AC17 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: plan READY 커밋(이 문서 + INDEX 행) → 구현 턴(문서·TSV·baseline·스크립트, 커밋 1~2개) → verify 커밋.
- 취소/중단: 구현 중간 중단 시 `drift-check.sh check`·`doc-gate.sh check` 가 red 인 상태로 커밋하지 않는다 — red 상태의 커밋은 `Status: partial` 로만.
- retry/partial failure: `regen` 은 멱등·판정 보존. 문서 편집 → regen → 판정의 반복이 정상 경로.
- cleanup/rollback: 전부 git. 문서 이동 없음이라 링크 파손 위험은 인벤토리 가드가 잡는다.
- **다중 저장소 쓰기**: 판정·상태 사본이 **네 곳**에 산다 — ① `plan.md` 메타 상태 ② `INDEX.md` 행(단계·상태·다음 주체·라운드) ③ 커밋 trailer(`Status`·`Criteria-Met`·`Verified-By`) ④ (verify 턴) `verify.md` 판정. 쓰기 순서: 문서/TSV → plan `[구현자 기입]` → INDEX → 커밋(trailer 는 합계 검산 줄을 쓴 **뒤**). 사이에서 죽으면: ①만 갱신·②미갱신 = 보드가 "다음 주체" 를 틀리게 말한다 → 다음 턴 착수 전 §EP-10 대조로 발견(verify §0 가 INDEX 실상 대조를 의무로 갖는다). 허용 불가 조합 = trailer 가 본문과 다른 값(0190 사례) → trailer 는 마지막에 한 번만 쓴다. 또 하나의 두 곳 쓰기: **문서 본문 ↔ baseline/TSV** — 문서를 고치고 TSV 를 안 고치면 `check` red 가 그 자체로 발견 장치다(허용 가능한 중간 상태, 커밋 전 해소).

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: `drift-check.sh` 는 TSV 행 수 × 범위 파일 46 의 grep — 수백 행 × 46 파일, 수 초. `doc-gate.sh check` 는 0192 관측 13~19초.
- 새 요청 수: 네트워크 0.
- 구조적 목표: AC 24 ≤ 25(skill 상한) — 분할하지 않는다. DA 행 수는 상한을 두지 않고 산출이 센다.
- 캐시/최적화로 잃는 것: 없음.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port/schema/config: 없음. 세 TSV 는 이 handoff 내부 데이터다.
- 문서 계약 변경 중 외부 구현자 행동이 달라지는 것: `closed-network-extensions.md §1.7` 의 Plugin 디렉토리 패턴(`features/plugins/<sp>/`)과 예시 — **shape**: 실제 디렉토리 `confluence`·`jira`·`mail` 과 대입(`ls`) · **semantics**: 로그인 프리/자격증명 Plugin 등록 경로(`app/deployment/plugins.ts`)는 auth.md §7 과 같은 말인지 대조(AC15).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| Provider 어휘 폐기·Backend/Adapter 통일 | GLOSSARY §3 | 건드리지 않음 — 낡은 "LLM Provider" 용례가 발견되면 정정(AC23 톤) | 유지 |
| 2계층 영속성 모델 | persistence.md §1 | AC4(adapters §2.3 Artifacts 경로를 §1.4 로 링크) | 유지 — 모순 제거 |
| Harness 어휘, `engine` 은 compat boundary | 0188 D-005 · GLOSSARY | 신규 문장에 Engine 을 쓰지 않음; `dist/<engine>/` 경로는 compat 로 그대로 | 유지 |
| `arch/` 는 현재 상태만, 핸드오프 번호는 출처 표기 | `docs/AGENTS.md` 규칙 4 | AC23 | 유지 |
| 수치 복제 금지 | `docs/AGENTS.md` 규칙 2 | AC22·D-011·D-012 | 유지·확장(버전·용량 값도 적지 않음) |
| `doc-gate.sh` 는 CI 밖 | 0192 D-003 | §6 비범위 | 유지 |
| ADR 은 고쳐 쓰지 않는다 | `decisions/README.md` | D-005 | 유지 |
| OQ 단독 결정 금지 | 루트 `AGENTS.md` 원칙 2 | D-003·AC12 | 유지 — 참조 절 번호만 정정(D-007) |
| 보드 PASS 행은 archive 로 | `INDEX.md` 머리 · 각 행 비고 "실기 뒤" | D-004 | 유지(실기 대기 행은 비고가 우선) |
| PR 은 사용자 요청 시 | `docs/handoff/AGENTS.md §커밋·git 규약` | 이번 세션 환경 지침(push 후 draft PR 생성)과 충돌 | **환경 지침 우선·draft 로 생성하고 사용자에게 보고** — 닫기는 사용자 1클릭 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 정정 자체가 틀린다(새 드리프트 생산) | 모든 정정 문구에 anchor(코드 좌표) 필수 — anchor 없는 DA 행은 형식오류. 구현 턴은 §8 표 외 사실도 그 자리에서 `rg` 로 재확인 |
| `regen` 뒤 판정 104+ 건을 성급히 `참` 으로 찍는다 | 판정은 자리마다 줄을 읽고 결정하고, `정정됨` 은 실제 편집한 줄에만. verify 가 표본 아닌 **전건** 재판정 가능하게 TSV 가 좌표를 갖는다 |
| 작업량이 커 한 커밋이 비대해진다 | 구현 커밋을 (a) 장치+스크립트 (b) 문서 정정 (c) baseline 판정 으로 나눌 수 있다 — 전부 `Status: implemented` 전 중간은 `partial` |
| 사용자 기본값(D-003·D-007) 거부 | 되돌림 비용 1줄 3곳 / PRD·TRD 범위 축소 — one-way door 아님 |
| 0192 `limits` 변경이 산출 수치를 바꿔 과거 기록과 어긋난다 | 등록부는 수치를 갖지 않는다(0192 r3 결정) — 변동은 코퍼스 이동으로 해석, 기록은 verify 에 전후 값 |

- 되돌리기 어려운 결정: 없음.
- 신규 의존성: 없음(bash·coreutils·grep·node 내장).

## 18. 영향 받는 파일 / 문서

- 신규: `docs/handoff/0260-docs-handoff-resync/{plan.md, verify.md, drift-check.sh, drift-assertions.tsv, status-marks.tsv, handoff-coverage.tsv}`
- 수정(문서): `docs/{GLOSSARY,IPC_CONTRACT,PRD,TRD,ARCHITECTURE,INDEX,AGENTS,claude-code-spec,claude-taskxxx-spec}.md` · `docs/arch/backend/{overview,runtime-ipc,adapters,persistence,standardization,security,observability,terms,auth}.md`(+ `provider-runtime`·`background-tasks`·`system-prompt` 대조 후 필요 시) · `docs/arch/frontend/{overview,dom-architecture,state,rendering,ux-domains,terms,layers}.md` · `docs/guides/{workspace-isolation-permissions,closed-network-extensions}.md`
- 수정(장치): `docs/handoff/0192-doc-gate-baselines-as-data/{doc-gate.sh, plan.md, baselines/*.tsv}`
- 수정(D-007): 루트 `AGENTS.md` · `app/AGENTS.md`
- 수정(보드): `docs/handoff/INDEX.md`
- 비변경: `app/src/**` · `docs/spec/**` · `docs/etc/**` · `docs/archive/**` · `docs/decisions/*.md` · `docs/generated/inventory.md`(재생성 외)

## 19. 게이트

- 적용할 하위 가이드: `docs/AGENTS.md`(작성 규칙 1~7) · `docs/handoff/AGENTS.md`(§산출물 문장 규칙·§INDEX.md 운영·§커밋·git 규약) · `docs/guides/AGENTS.md`(가이드 2종 수정 시).
- ABI/네트워크 등 환경 제약: `app/node_modules` 비어 있음 — app 게이트 불필요(`app/src` 변경 0). `check-doc-inventory.mjs` 는 Node 내장만 사용(이번 세션 exit 0 확인).
- 기본 정적 게이트: `bash docs/handoff/0192-doc-gate-baselines-as-data/doc-gate.sh check` · `node app/scripts/check-doc-inventory.mjs --check` · `bash docs/handoff/0260-docs-handoff-resync/drift-check.sh check` — 셋 다 exit 0.
- 관련 테스트: 코드 테스트 없음. 결함 심기 UT-01 ①~④·UT-02 를 구현 턴 `[구현자 기입] 이번 라운드 수정의 잠금` 에 red 관측으로 적는다.
- 사람 실기: 없음.
- 계측 한계: 0192 등록부(`doc-gate.sh limits`)를 승계한다. 이번 장치가 새로 보는 것은 **이번에 바꾼 사실의 되돌림**과 **표식·커버리지의 완결성**이며, 바꾸지 않은 문장의 사실성(`prose-veracity`)은 여전히 계측 밖이다.

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 여러 턴의 결정을 보존한다 — 사용자 턴 2개(원문 인용) + 승계 결정 2건(0191 D-003·0192 D-003) 기록.
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §1 성공 문장 + §7 AC 24.
- [x] 조건절·이유절을 재해석하지 않았다 — "모두 적용" 을 "0193~0259" 로 좁힌 것은 **추론**으로 표시(§2).
- [x] 각 핵심 동작이 AC 와 Technical Design 에 연결된다 — §5 흐름의 두 경로 ↔ VP-01~VP-09.
- [x] AS-IS/TO-BE 가 같은 축으로 있다 — §9 두 다이어그램 4단계 동일.
- [x] Delta 각 행이 구현 파일/AC 로 추적된다 — §9 Delta 5행 → §11 표.
- [x] 사라진 책임의 처리 — 0124 plan 포인터(대체)·구 ChatEvent 표(삭제+링크)·DevTools 문장(삭제, 근거 `rg` 0) 명시.
- [x] 수치·전칭·앵커를 실측했다 — §8 표 전부 이번 세션 측정; `auth.md ## 7` 만 구현 턴 재확인으로 남김(AC15 에 적음).
- [x] 각 AC 가 행동 단언·검증 수단·도달 경로를 가진다 — §7 표 5열.
- [x] Baseline V — 상속 기준 없음(0192 plan `VP-` 0건).
- [x] 모든 NEW node 에 같은 레벨 REQUIRED pair — R 4/AT 4 → VP-01~04 · SD/ST → VP-05 · AR/IT → VP-06·07 · MD/UT → VP-08·09.
- [x] INHERITED 없음 — Baseline.
- [x] pair 마다 경로·§10 분모·자리별 oracle 좌표(TSV 행 id / gate 명령) — 적대 증거는 VP-01·02·03·05·08·09 에 이유와 함께, VP-04·06·07 은 직접 oracle 근거로 not selected.
- [x] 운영 gate 열거 — app 게이트는 적용 안 함을 근거(`app/src` diff 0)와 함께.
- [x] 사람 실기로 미룬 순수 로직 없음.
- [x] structural proxy 만의 AC 없음 — 0건 단언은 양성 단언+anchor 와 짝(EP-13).
- [x] "X 가 쓰인다" 장치는 X 를 지웠을 때 실패 — UT-01 ①; 자리 식별은 VP-05 형제 자리 변이.
- [x] 정책 파라미터 단위 — TSV 열 의미 §11.
- [x] 참조 구현 coverage — 해당 없음(코드 아님).
- [x] 신규 계약마다 SSOT·강제 지점·seam — §10 EP-13·EP-14.
- [x] producer/consumer 양쪽 — §12.
- [x] 상한·one-way door — §14·§17 (없음).
- [x] 게이트 명령이 subtree AGENTS 와 충돌하지 않는다 — `docs/AGENTS.md` 는 명령을 지정하지 않고 CI 가드만 요구; `app/AGENTS.md` 게이트는 `app/src` 미변경이라 비적용.
- [x] 본문 완성 후 Ledger 교차검증 — §3 갱신 메모에 `ACTIVE ↔ AC` 대조 6건 판정.
- [x] 산출물 문장 규칙 — 표 칸 3줄 상한 초과 칸은 AC 표의 긴 열거 칸 4건(AC2·AC11·AC12·AC13)으로, **열거는 줄이지 않는다**(규칙 5) — 서술은 없다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: D-001~D-012 를 그대로 수행했다. 정정 사실마다 DA 행을 두고 `drift-check.sh check` 로 관측했다(행 수는 `check` 산출 — AC20).
- 이견 / 현실성 문제: ① AC7 "§1.1 줄번호 `210-213`"·AC11 "§3.2 `:1920`" 은 줄번호를 새 값으로 바꾸라는 술어다 — 줄번호는 다음 편집에 다시 낡으므로 심볼 좌표(`webPreferences` 블록·`ingestChatEvent`)로 바꿨다(아래 설계 대비 차이, AC 자기보고 ⚠️). ② §8 전수 조사 표 "`verify.md` 없는 것 6" 은 실측 5다(`0205·0208·0214·0219·0220`, 커버리지 TSV `verify` 열 기준). ③ AC10 `mockup` 0 은 파일 전체 술어라 참인 Phase 1 행(`mockup 시각 재현`)도 걸렸다 — 그 행을 "디자인 프로토타입(`project/`) 시각 재현" 으로 바꿔 술어를 그대로 지켰다(DA-F12).
- ACTIVE Decision과 충돌하는 설계 발견: 없음. D-007 의 "세 파일 1줄" 범위는 넘겼다 — `app/AGENTS.md` 의 같은 문서 낡은 사실 5곳(DevTools·OQ2·`:50` 삭제 모듈·CI 단계·package name)을 선조치했다(DA-AG5~AG8). D-005 에 따라 ADR-005:36 의 `cold/idle/…` 는 비접촉.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-05 | EP-01 settingSources | 13 후보 | **12/12** — 현재값 서술 자리 | `rg -n settingSources <scope>` = 15줄 → 현재값 12(TRD 320·371·507 · adapters 34·85·143·182 · security 228 · standardization 117·119 · spec 392·476) = DA-TR11·TR21·TR20·A09·A10·A11·A12·SE08·S06·S08·CS3·CS1 | 이력·외부 3줄(TRD:329·security:230 이력, system-prompt:141 가이드 처방 — Orca 행은 DA-SY1). workspace 가이드는 HEAD 에도 0줄 |
| VP-05 | EP-02 disallowedTools | 21 후보 | **9/9** — Orca 값 서술 자리 | `rg -n disallowedTools <scope>` = 18줄 → TRD:320(TR12)·adapters:86(A04)·std:119(S07)·spec:392(CS3)·471(CS2)·guide 37·331·333·380(GD1 파일 단위 must_not `미채택` + must) | guide 4자리는 자리별 must 없음 — 파일 단위 must_not 이 회귀를 잡는다. 나머지 9줄은 CLI 참조·OQ9 질문·가이드 일반 예시 |
| VP-05 | EP-03 dist 레이아웃 | adapters §2.1·§3.1 · std §5.2 · TRD §6.8·§6.8.1 | **낡은 자리 0** + 양성 5파일 | `rg -nE 'dist/[^ ]*\.claude/skills\|dist/<engine>/\.mcp\|dist/plugins/orcinus' <scope>` = 0 · DA-A05·S03·TR13·SE10·GD6 | 없음 — §10 밖 2자리(security §1.4-b·closed-network §1)의 `<engine>` 누락도 정정 |
| VP-05 | EP-04 릴리스 즉시 게시 | security §1.7 · PRD OQ3 · TRD §4·§9.2·§10 | **낡은 자리 0** + 양성 6 | `rg -nE '수동 Publish\|draft\(수동\|Releases \*\*draft' <scope>` = 0 · DA-SE06·PR2·TR14·TR15·TR16·O19 | 없음 |
| VP-05 | EP-05 nav 5항목 | frontend overview · dom-arch · ux-domains · terms | **낡은 자리 0** + 양성 4 | `rg -nE '4-항목\|4 항목\|플러그인 모달' <scope>` = 0 · DA-F05·D01·UX5·FT2 | 없음(`4항` 1줄은 rendering §1.9 패널 서술 — DA-RN4 로 정정) |
| VP-05 | EP-06 상태 어휘 | GLOSSARY · 그 밖 1 | **1/2** | `rg -nE 'cold/idle\|idle/busy' <scope>` = 1 (ADR-005:36) · DA-G01 | ADR-005:36 — ADR 본문 비접촉(D-005) |
| VP-05 | EP-07 자격증명 모델 | GLOSSARY · security §1.3·§1.4 · TRD N6 · PRD §7.1 | **4/4** + TRD §4·§10 | DA-G04·SE02·TR17·PR5 (+TR18·TR19) | 없음 |
| VP-03 | EP-08 표식 전건 | 산출 사이트 전부 | **82/82** | `drift-check.sh check` 표식 축 미등재 0·잔류 0 | 없음 |
| VP-02 | EP-09 커버리지 | 디렉토리 67 | **67/67** | 같은 명령 커버리지 축 결손 0·잔류 0·미매치 0 | 없음 |
| VP-07 | EP-10 사본 일치 | plan 메타·INDEX·trailer | **2/3** | plan 메타 `상태`·INDEX 행 = `impl/IMPL_DONE (r1)` | trailer — 커밋 직후 `git log -1 --format='%(trailers:only=true)'` 로 관측(검증 턴 기록) |
| VP-06 | EP-11 baseline 3 TSV | 3 | **3/3** | `doc-gate.sh check` 형식오류·미분류·미판정·잔류 전부 0, `전부 공집합 — 통과` | 없음 |
| VP-04 | EP-12 inventory | 명령 1 | **1/1** | `node scripts/check-doc-inventory.mjs --check` ok 3줄 · `git diff --stat docs/generated` 0 | 없음 |
| VP-08 | EP-13 판정 함수 3 + 형식 1 | 4 | **4/4** | 아래 잠금 표 1~10 | 없음 |
| VP-09 | EP-14 limits 해석 | 1 | **1/1** | `doc-gate.sh limits` non-ts-paths 72 → 47 → 결함 삽입 48 | 없음 |

- §10에 없는데 같은 불변식이 필요했던 지점: SCOPE 사본 대조에 `EXTRA_SCOPE` 배열도 포함(preflight 2행). EP-03 의 `dist/plugins/orcinus-orca`(`<engine>` 누락) 2자리.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `gate:bash docs/handoff/0260-docs-handoff-resync/drift-check.sh check` 단언 축 불일치 0 | 잠금 1~4 red |
| VP-02 | REQUIRED | SELF_PASS | 같은 명령 커버리지 축 67/67 | 잠금 6·7 red |
| VP-03 | REQUIRED | SELF_PASS | 같은 명령 표식 축 82/82 | 잠금 5 red (+ 구현 중 신규 `미구현` 표식 1건을 미등재로 자연 검출) |
| VP-04 | REQUIRED | SELF_PASS | `gate:doc-gate.sh check` 통과 · `gate:check-doc-inventory.mjs --check` ok 3줄 | not selected |
| VP-05 | REQUIRED | SELF_PASS | 자리별 DA 행(위 표) | 잠금 1·11·12 — 되돌린 자리의 행만 red |
| VP-06 | REQUIRED | SELF_PASS | `gate:doc-gate.sh check` — regen 후 미분류 21 심볼·7 경로·104 시제 → 0 | not selected |
| VP-07 | REQUIRED | SELF_PASS(2/3) | plan 메타 ↔ INDEX 행 나란히 대조 | not selected — trailer 는 커밋 후 |
| VP-08 | REQUIRED | SELF_PASS | 잠금 1~10·13·14 | 전부 red |
| VP-09 | REQUIRED | SELF_PASS | `gate:doc-gate.sh limits` 전후 | 잠금 15 (+1) |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 1. TRD §6.8 settingSources → "생략" | VP-01 ① EP-01 · VP-05 | 해당 없음(r1) | `check` exit 1 · DA-TR11 만 | red |
| 2. standardization §5.1 disallowedTools → "넘기지 않는다" | VP-01 ① EP-02 | 해당 없음 | DA-S07 | red |
| 3. adapters §3.1 dist → `.claude/skills` | VP-01 ① EP-03 | 해당 없음 | DA-A05(must_not) | red |
| 4. GLOSSARY 상태 어휘 → `cold/idle` | VP-01 ① 단일 파일 | 해당 없음 | DA-G01(must_not·must) | red |
| 5. status-marks 행 1개 삭제(ux-domains ⏳) | UT-01 ② | 해당 없음 | 미등재 1 | red |
| 6. coverage 행 삭제(0231) | UT-01 ③ | 해당 없음 | 결손 1 | red |
| 7. coverage 확인어 → 부재 단어 | VP-02 | 해당 없음 | 확인어 미매치 1 | red |
| 8. anchor → 부재 경로 | UT-01 ④ | 해당 없음 | DA-A03 anchor 없음 | red |
| 9. must_not 단독 행 추가 | EP-13 형식 | 해당 없음 | 형식오류(0건 단독) 1 | red |
| 10. 빈 칸 행 추가 | EP-13 형식 | 해당 없음 | 형식오류(빈 칸) 1 | red |
| 11. adapters §2.1 자리만 되돌림 | VP-05 형제 | 해당 없음 | DA-A11 만(A09·A10·A12 green) | red |
| 12. standardization §5.1 자리만 되돌림 | VP-05 형제 | 해당 없음 | DA-S02·S08 만(S06·S07 green) | red |
| 13. doc-gate SCOPE 식 변경 | 새 oracle(preflight 사본) | 해당 없음 | exit 2 "SCOPE 식이 … 다르다" | red |
| 14. doc-gate EXTRA_SCOPE 변경 | 새 oracle(preflight 사본) | 해당 없음 | exit 2 "EXTRA_SCOPE 가 … 다르다" | red |
| 15. 부재 상대경로 인용 삽입(`docs/guides/AGENTS.md`) | VP-09 UT-02 | 해당 없음 | non-ts-paths 47 → 48 | +1 |

- **분모 검산**: 선택 증거 6 pair(VP-01 4행 · VP-02 2행 · VP-03 1행 · VP-05 3행(1 공유) · VP-08 형식 2행 + UT-01 ①~④ 공유 · VP-09 1행) · 인용 변이 0(r1) · 새 oracle 1(preflight 사본 대조 2행) = 표 행 15. 변이 후 원복은 `drift-check.sh check` 통과·`*.mutbak` 0 으로 확인.
- **덮개 회귀**: 해당 없음 — 0192 장치(`doc-gate.sh`)의 `check` 경로는 바꾸지 않았다(`limits` 만 F2). 0192 AC1 의 baseline 1행 삭제 red 는 그대로다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문자열·상태에 소비자가 있는가 | 문서 독자(에이전트) + `drift-check.sh` 가 세 TSV 를 소비 — 산출은 실패 행 id 를 출력 | 없음 |
| 실패가 "아무 일도 안 일어남"으로 보이는가 | 아니오 — 축별 차집합과 행 id 를 인쇄하고 exit 1, preflight 는 exit 2 + 사유 | 없음 |
| 새 핸드오프가 들어오면 | 커버리지 축은 0193~0259 만 센다(상시 게이트 아님, plan §6 비범위) | 상시화는 사용자 결정 — NEXT_HANDOFF 후보 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 구현 중 내가 쓴 문장 2건이 틀렸다 — IPC telemetry 행에서 `sessionCostUsd` 를 지웠고, adapters 가 runtime tool 에 `allowedTools` 를 준다고 적었다 | 둘 다 되돌려 정정(DA-IP9·DA-A13) | `chatReducer.ts` 누산·`StatusPopover` 표시 / `adaptRuntimeTools` 는 `{ mcpServers }` 만 반환 |
| 2 | 시제 판정 중 낡은 단언 7사이트 발견(`chatStore.ts:48`·`SEND` 액션·`rg RevertManager = 주석 1건`·`provider` 필드·`supportedBackends` 현재형·IPC `options.env` "앱 env 만") | 정정 후 `정정됨` 판정 | `tense-sites.tsv` 정정됨 7행 |
| 3 | 프로덕션 DevTools 를 코드가 막지 않는다 | 보고만 — 제품 보안 결정 | `openDevTools`·`webPreferences.devTools`·메뉴 설정 0건 |
| 4 | `app/src/main/AGENTS.md` chat-turn 표에 `background`·`permission-mode-observer`·`prepare-worktree`·`project-binding` 모듈이 없다 | 보고만 — 범위 밖 | `ls app/src/main/app/chat-turn/` |
| 5 | 0193 이전 미기재 TRD §2 기능 행 | NEXT_HANDOFF 후보(§6 비범위) | plan §6 표 |
| 6 | ADR-005:36 의 구 상태 어휘 | 비접촉(D-005) — GLOSSARY 가 SSOT | `rg 'cold/idle'` = ADR 1줄 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: ① `status-marks.tsv` 키 = **표식 앞뒤 24자 문맥(UTF-8 문자 단위)** — plan §11 의 "줄 앞 60자 snippet" 대신. 한 줄의 표식 여러 개를 구분하고, 표식 근처 문장이 바뀌면 재판정을 요구한다. ② SCOPE 사본 대조 = **식·`EXTRA_SCOPE` 문자열 동일성** — plan §10 의 "파일 수 비교" 대신. 수가 같고 집합이 다른 경우도 잡는다. ③ AC7·AC11 의 줄번호 술어 → 심볼 좌표. ④ D-007 범위 밖 `app/AGENTS.md` 5곳 선조치.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 공유 | ① 같은 파일 안 동일 문맥 두 사이트가 `sort -u` 로 한 행이 된다 | AC18 — raw 82 = unique 82(0건) |
| 만료 | 해당 없음 — TSV 는 시간에 의존하지 않는다 | — |
| 재진입 | 해당 없음 — 읽기 전용 스크립트 | — |
| 다른 무효화 축 | ② `scope_files()` 의 두 줄 밖 변경(grep 추가 등)은 동일성 대조가 못 본다 · ① 표식 앞뒤 24자 안의 편집이 재판정을 강제한다(의도) | EP-11 — 잠금 13·14 exit 2 · 구현 중 RISKY_TOOLS 문맥 변경이 미등재 1 + 잔류 1 로 검출됨 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 범위 문서(`docs/**`) + 루트/`docs`/`app` AGENTS 3 + `0192/{doc-gate.sh, plan.md, baselines/*.tsv}` + 신규 `0260/{drift-check.sh, drift-assertions.tsv, status-marks.tsv, handoff-coverage.tsv}` — 목록은 `git show --stat` 이 정본 |
| 실행 명령 | `bash docs/handoff/0260-docs-handoff-resync/drift-check.sh check` · `bash docs/handoff/0192-doc-gate-baselines-as-data/doc-gate.sh {regen,check,limits}` · `cd app && node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출** | drift-check `단언 축 불일치 0 · 표식 82/82 · 커버리지 67/67 · 전부 공집합 — 통과` exit 0 · doc-gate `심볼 276사이트/165심볼 · 경로 13줄 · 시제 126사이트 · 전부 공집합 — 통과` exit 0 · inventory `generated doc ok · prose ok · links ok` exit 0 · `git diff --stat docs/generated` 0 · AC23 술어 0 · PRD OQ4~7·9·10 행 diff 0 |
| V-pair 자기확인 | SELF_PASS 9 (VP-07 은 trailer 제외 2/3) |
| 강제 지점 전수 | EP-01 12/12 · EP-02 9/9 · EP-03~05 낡은 자리 0 · EP-06 1/2(ADR) · EP-07 4/4 · EP-08 82/82 · EP-09 67/67 · EP-10 2/3 · EP-11 3/3 · EP-12 1/1 · EP-13 4/4 · EP-14 1/1 |
| **AC 자기보고**(`Criteria-Met`) | ✅ AC1·2·3·4·5·6·8·9·10·12·13·14·15·16·17·18·19·20·21·22·23 (DA 행 green + 각 축 차집합 0) · ⚠️ AC7·AC11(줄번호 술어 → 심볼 좌표) · ⚠️ AC24(커밋 후 trailer 파싱 미관측) |
| **합계 검산** | ✅ 21 · ⚠️ 3 · ❌ 0 = 총 24 (분모 변경 없음) |
| 블로커 / 역질문 | D-003(PRD/TRD 정정 깊이)·D-007(AGENTS 범위)은 설계자 기본값 — 사용자 확인 대상으로 남는다 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 라운드 r1. 같은 축 반복 없음(최초 구현).
- 0192 baseline 은 0193~0259 동안 regen 되지 않아 시제 104·심볼 21·경로 7 이 쌓여 있었다 — 장치는 있었으나 상시 게이트가 아니었다(0192 D-003).
- 구현 중 장치가 내 편집을 두 번 잡았다(신규 `미구현` 표식 · RISKY_TOOLS 문맥 변경) — 문맥 키 설계가 의도대로 동작.
- 환경 한계: `app/node_modules` 없음 — SDK 타입 확인은 고정 핀 tarball(`npm pack @anthropic-ai/claude-agent-sdk@0.3.296`)로 대신했다.

---

## [검증자 기입] 파생 이슈

> r1 검증 — [`verify.md`](verify.md) §13 이 정본. 상태는 다음 턴이 갱신한다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| G1 | 커버리지 `-` 행의 진위를 보는 oracle 이 없다 — 거짓 `-` 2행이 전 gate 통과 | VP-02 · AC19 · MD-01 | `-` 행 핸드오프의 커밋이 지운·옮긴 `app/src` 이름이 기준 커밋 범위 문서에 인용됐으면 red 인 축을 추가 | PLAN_GAP | open |
| G2 | 코드 인용 좌표 정책 미결 — AC4·AC7·AC11 은 줄번호 갱신, 구현은 식·심볼 좌표 | VP-01 · AC4·AC7·AC11 | Decision 으로 정책을 정하고 영향 AC 술어를 정정 | PLAN_GAP | open |
| D1 | 해설 미러 §11:409·§5.5:238·§14.3:498 "권한 우회 미사용" ↔ Work·Code 메뉴 `bypass`(0224) | VP-01 · AC16 · R-01 | 3자리 현행화 + 자리별 DA 행 | BLOCKING | open |
| D2 | §7.3:319 `--fork-session` "❌ 미사용" ↔ §11:405 ✅ · `forkSession` | VP-01 · R-01 | 정정 + DA 행 | BLOCKING | open |
| D3 | 커버리지 0221·0222 `-` 사유 거짓 · 0205 사유 근거 0 | VP-02 · AC19 | 반영 문서·확인어로 교체 · 0205 사유 정정 | BLOCKING | open |
| D4 | AC11 `:1920 ≥1` 0건 · AC7 동작 기준 줄번호 부재 | VP-01 · AC7·AC11 | G2 결정에 따른다 | BLOCKING | open |
| N1~N6 | 확인어 약함(0202·0213·0239) · §7.2·§7.5 사유 · 스킬 재스캔 서술 · 가이드 EP-02 파일 단위 행 · DA-UX9 식 anchor · §8 "6"→5 | VP-01·02·05 / plan 본문 | r2·ΔV1 에서 함께 | NON_BLOCKING | open |
| X1~X5 | DevTools · main AGENTS chat-turn 표 · TRD 0193 이전 F 행 · 장치 상시화 · `bypass` 의 `allowDangerouslySkipPermissions` 부재 | 비귀속 | 새 handoff 후보 | NEXT_HANDOFF | open |
