# Plan — 0229-edit-preview-while-running

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0229-edit-preview-while-running` |
| 작성자 | Claude Code |
| 일자 | 2026-09-11 |
| 매핑 | 없음 |
| 상태 | DRAFT → READY |
| V mode | `Delta V` |
| 기준 V | `0228-landing-mode-memory-and-edit-diff-rendering:V1@5259ede` |
| 이번 V revision | `ΔV1` |
| 유효 V | `0228:V1 + ΔV1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: `Edit` 카드가 **완료(`수정됨`)** 에서는 실제 파일 줄번호와 줄 전체를 그리지만 **진행 중(`수정 중`)** 에서는 0228 이전과 같다. 조각 문자열과 1부터 센 줄번호가 그대로 보인다.
- 완료 후 달라지는 것: 승인 대기·실행 중에도 같은 화면을 본다. 사용자는 **승인 전에** 어느 줄이 어떻게 바뀔지 본다.
- 성공을 사용자 관점에서: **승인 버튼을 누르기 전에 바뀔 줄을 정확히 볼 수 있다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "'수정됨' 에는 정상 출력되는 것을 확인했다. 하지만 '수정 중' 에서는 이전과 똑같다. 검토하라" | 라이브 세션 |
| 승계 요구 | 0228 의 "정확하지 않은 텍스트 타겟 및 라인넘버" — 기대 출력은 `46 - async function animate(): Promise<void> {` | 0228 §2 |
| 추론 의도 | `수정 중` 이 오래 머무는 유일한 경우는 **승인 대기**다. 그래서 이 상태의 diff 가 승인 판단의 입력이다 | `Composer` 가 `ToolApprovalBody` 를 띄우는 동안 카드의 verb 는 `수정 중` 이다 |
| 추론 의도 | 미리보기는 **제안된 변경**이지 일어난 일이 아니다. 완료 결과가 오면 그것이 정본이다 | 설계 |

## 3. Decision Ledger

> 0228 의 ACTIVE 결정은 그대로 살아 있다. 아래는 이번 턴의 증분이다.

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| E-001 | 진행 중 `Edit` 카드도 완료 카드와 같은 줄번호·전체 줄을 그린다 | "'수정 중' 에서는 이전과 똑같다" | 사용자 | ACTIVE | — |
| E-002 | 미리보기 출처는 **main 이 편집 전 파일을 읽어 만든 hunk** 다 | SDK 는 실행 전 diff 를 주지 않는다 — `CanUseTool` options 전수(`sdk.d.ts:206-266`)에 patch/diff 필드가 없다 | 코드 조사 | ACTIVE | — |
| E-003 | 미리보기 계산은 `diff` 패키지의 `structuredPatch` 를 쓴다 | SDK `structuredPatch` 필드 형상이 jsdiff 의 반환 형상 그대로다 — 같은 함수를 쓰면 문맥 폭(기본 4줄)까지 일치해 완료 시 화면이 튀지 않는다 | `node -e` 실측 | ACTIVE | — |
| E-004 | 미리보기 대상은 `Edit` 하나다 | 0228 D-009·D-010 승계 — `Write` 는 입력이 이미 파일 전체이고 `MultiEdit` 은 SDK 스키마에 없다 | 0228 | ACTIVE | — |
| E-005 | 읽기 범위는 workspace guard 의 `readRoots` 안으로 제한한다 | 미리보기는 **승인 전** 시점이라, 모델이 지목한 임의 경로를 main 이 먼저 읽으면 승인 게이트를 우회해 읽는 것이 된다 | `adapters/workspace-guard.ts:96` | ACTIVE | — |
| E-006 | 파일 크기 상한 1 MiB. 넘으면 미리보기 없이 기존 폴백 | 턴 이벤트 루프에서 동기로 읽는다 — 상한이 없으면 큰 파일 하나가 스트림을 멈춘다 | 설계 | ACTIVE | — |
| E-007 | `old_string` 이 정확히 1회가 아니면(`replace_all` 제외) 미리보기를 만들지 않는다 | 어느 자리인지 모르는 채로 줄번호를 그리면 0228 이 없앤 거짓 좌표가 되돌아온다 | 0228 EP-05 와 같은 이유 | ACTIVE | — |
| E-008 | 미리보기는 **영속하지 않는다** | 완료 결과의 패치가 정본이고 이미 영속된다. 둘 다 저장하면 같은 hunk 를 두 번 적는다 | 설계 | ACTIVE | — |
| E-009 | 렌더 우선순위는 `결과 패치 > 미리보기 > 도구 입력 쌍` 이다 | 완료되면 예측을 사실로 교체한다 | 설계 | ACTIVE | — |
| E-010 | 읽기 실패(부재·권한·디코딩)는 조용히 미리보기 없음이다 — 턴을 막지 않는다 | 미리보기는 표시 보조이지 실행 경로가 아니다 | 설계 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: E-001 ~ E-010.
- 변경된 결정: 없음. 0228 의 D-001~D-013 은 전부 유지된다 — 이번 변경은 완료 경로를 건드리지 않는다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0228 D-006(패치가 줄의 정본) · D-011(패널과 같은 문법 경로) · D-012(3열 계약) · D-013(Work 본문 불변).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. E-004("`Edit` 하나") ↔ AC10("`Write`/`MultiEdit` 에는 만들지 않는다") → 일치. E-008("영속 안 함") ↔ AC9 → 일치. E-009("결과 > 미리보기") ↔ AC2 → 일치. 0228 D-009("`Write` 제외") ↔ AC10 → 같은 방향.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | `DiffBody.tsx:45` 가 `call.result?.structuredOutput` 만 본다. 진행 중에는 `call.result == null` 이라 패치 자체가 없다 |
| 이미 기존 코드가 충족하는가 | 아니오 | 승인 카드(`ApprovalCard.tsx` `ToolApprovalBody`)는 `file_path` 한 줄만 보여준다 — diff 가 없다 |
| SDK 가 실행 전 diff 를 주는가 | **아니오** | `CanUseTool` options 전수(`sdk.d.ts:206-266`): `suggestions`·`blockedPath`·`decisionReason`·`title`·`displayName`·`description`·`toolUseID`·`agentID`·`requestId`·`matchedAskRule`. patch/diff 없음 |
| 더 작은 해법이 있는가 | 있으나 요구를 못 채운다 | 진행 중에는 줄번호 칸을 비우는 안(거짓 좌표 제거)은 10줄이면 되지만 **전체 줄**을 못 준다 — 사용자가 본 문제의 절반만 없앤다 |
| 렌더러가 직접 파일을 읽을 수 있는가 | 아니오 | 파일 IPC 5종(`filesList`·`filesPick*`·`filesOpenPath`·`filesReadAttachment`)에 임의 파일 본문 읽기가 없다. 새로 만들면 렌더러에 광범위 read 권한이 생긴다 |
| 예측을 사실처럼 보이게 하는가 | 아니오 | 카드의 동사가 `수정 중` 이다 — 완료 시제(`수정됨`)와 다른 문자열이고, 완료되면 결과 패치로 교체된다(E-009) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음 | 0228 의 완료 경로 계약을 건드리지 않는다. `diff` 는 이미 채택된 의존성이다(`app/AGENTS.md §의존성 정책`) |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: `claude.ts:561` 의 `flatMap` 이 어댑터 소유 이벤트 후처리 지점이고, 같은 함수 스코프에 `cwd`(`:468` 사용)와 `additionalDirectories`(`:386` 선언)가 살아 있다 — 가드 루트를 그대로 재사용할 수 있다.

## 5. 동작 / 사용자 흐름

```text
[모델이 Edit 호출]
  → [main: 편집 전 파일을 읽어 미리보기 hunk 생성]
  → [카드 `수정 중` — 실제 줄번호 + 전체 줄 + 문법 색]
  → [승인/자동 실행 → 결과 패치 도착 → 같은 카드가 결과 좌표로 교체]
  ↘ [읽기 불가·다중 일치·상한 초과 → 미리보기 없음 → 기존 입력 쌍 렌더]
  ↘ [거부/중단 → 결과에 패치 없음 → 입력 쌍 렌더]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| `Edit` tool_use 도착, 파일이 workspace 안·상한 이하·`old_string` 1회 | 편집 전 파일을 읽어 hunk 생성 후 started 이벤트에 동행 | `수정 중` 카드가 실제 줄번호와 전체 줄을 보인다 |
| 같은 상황에서 `replace_all: true` | 모든 occurrence 를 반영한 hunk 전량 | 카드가 바뀔 자리 전부를 보인다 |
| `old_string` 0회 또는 2회 이상(`replace_all` 아님) | 미리보기 없음 | 기존 입력 쌍 렌더(줄번호 1부터) |
| 파일이 workspace 밖 | 읽지 않음 | 기존 입력 쌍 렌더 |
| 파일이 1 MiB 초과 | 읽지 않음 | 기존 입력 쌍 렌더 |
| 읽기 실패(부재·권한) | 조용히 미리보기 없음, 턴 계속 | 기존 입력 쌍 렌더 |
| 결과 도착(성공) | 결과 패치가 미리보기를 대체 | 같은 카드가 결과 좌표로 그려진다 |
| 결과 도착(오류·거부·중단) | 결과에 패치 없음 | 입력 쌍 렌더로 되돌아간다 |
| 세션 재로드 | 미리보기는 영속되지 않음 | 완료된 편집은 결과 패치로, 미완 편집은 입력 쌍으로 |

### 파생 UX / 엣지케이스

- loading / empty / error: 미리보기가 없는 모든 경우가 **변경 전과 똑같은 화면**이다 — 빈 본문이 되는 분기가 없다.
- cancel / retry / close / restart: 미리보기는 라이브 상태라 취소·재시작 후 남지 않는다.
- concurrency / multi-session: 미리보기는 tool_use id 별로 만들어 이벤트에 실린다 — 세션 간 공유 상태가 없다.
- keyboard / a11y / theme: 진행 중 카드도 완료 카드와 같은 `DiffTable` 이라 문법 색·테마 추종이 그대로 걸린다.
- 외부환경/오프라인/폐쇄망: 파일 읽기는 로컬이라 무관.

## 6. 범위 / 비범위

- **범위**: `Edit` 진행 중 카드의 실제 줄번호·전체 줄·문법 색 · 미리보기 생성과 그 경계(workspace·상한·일치 횟수) · 완료 시 교체.
- **비범위**: 승인 카드(`ToolApprovalBody`) 자체에 diff 를 넣는 일 · `Write` 덮어쓰기 미리보기 · Work 모드 본문 · 미리보기 영속 · 0228 의 D2(헤더 `+N -M` 기준) 결정.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 승인 카드 본문에 diff 직접 노출 | 아니오 — 같은 파생을 읽어 배치만 한다 | 후속 |
| `editPreview` 필드 이름(이벤트·파트 계약) | **예 — 공개 계약** | 지금 확정(§10) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-03′ | AT-Δ1 / AC1 | 진행 중 `Edit` 카드가 실제 파일 줄번호와 줄 전체를 그린다 | `result` 없이 `editPreview` 만 가진 `ToolCall` 렌더의 거터가 `46`, 본문이 원래 줄 전체 | `claude.ts` enricher → `tool.call.started` → 리듀서 파트 → `DiffBody` |
| R-03′ | AT-Δ2 / AC2 | 결과가 오면 결과 패치가 미리보기를 대체한다 | 미리보기와 결과 패치가 **다른 좌표**일 때 렌더가 결과 좌표를 쓴다 | 같은 경로 + `tool.call.completed` |
| R-04′ | AT-Δ3 / AC3 | 진행 중 카드에도 문법 색이 붙는다 | 토큰 주입 상태에서 미리보기 렌더에 `span[style]` 존재 | `DiffBody` → `DiffTable(filePath)` |
| R-05 | AT-Δ4 / AC4 | 일치가 1회가 아니면 미리보기가 없다 | `old_string` 0회·2회 입력에 빌더가 `null` | `buildEditPreview` |
| R-05 | AT-Δ5 / AC5 | `replace_all` 은 모든 자리를 반영한다 | 3회 등장 파일에서 hunk 들이 3자리 전부를 담는다 | 같은 경로 |
| R-06 | AT-Δ6 / AC6 | workspace 밖 경로는 읽지 않는다 | 밖 경로 입력에서 reader 가 **호출되지 않고** 결과가 `null` | `guardToolAccess` → 빌더 |
| R-06 | AT-Δ7 / AC7 | 상한 초과 파일은 읽지 않는다 | 1 MiB 초과를 보고하는 stat 에서 본문 read 미호출·결과 `null` | 실제 reader |
| R-06 | AT-Δ8 / AC8 | 읽기 실패는 턴을 막지 않는다 | reader 가 throw 해도 이벤트가 그대로 흐르고 `editPreview` 만 없다 | enricher |
| R-07 | AT-Δ9 / AC9 | 미리보기는 영속되지 않는다 | `HistoryWriter` 의 started 분기 산출 JSON 에 `editPreview` 키 부재 | `writer.ts:313` |
| R-05 | AT-Δ10 / AC10 | `Edit` 외 도구에는 미리보기를 만들지 않는다 | `Write`·`MultiEdit`·`Read` 입력에서 결과 `null` | enricher |

### AC 검증 주의사항

- 기존 테스트 재사용: 0228 의 `DiffBody.render.test.ts` 8케이스를 REGRESSION 으로 그대로 돌린다 — 완료 경로 렌더가 변하지 않아야 한다(케이스 실재 확인함).
- 사람 실기 항목: 승인 대기 화면에서 미리보기가 실제로 보이는지 1건. 그 외 로직은 전부 순수 테스트 대상이다.
- N회/총량 기준: AC6·AC7 의 "읽지 않는다"는 **주입한 reader 의 호출 횟수 0**으로 관측한다 — 부작용 부재를 결과값으로만 보면 반증할 수 없다.
- 총량/0건 기준: AC9 는 0건 스윕이라 적대 증거가 필요하다(§7-A VP-Δ6).

## 7-A. V / Trace Matrix

- V mode 판정: `Delta V` — 0228 의 R-03(완료 카드 줄번호)·R-04(문법 강조)를 **진행 중 상태까지** 넓힌다.
- 기준 V 상속 근거: `0228-landing-mode-memory-and-edit-diff-rendering:V1@5259ede`.
- 변경이 시작되는 수준: R.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-03′ | R | §7 진행 중 카드의 줄번호·전체 줄 | CHANGED | 0228 R-03 |
| R-04′ | R | §7 진행 중 카드의 문법 색 | CHANGED | 0228 R-04 |
| R-05 | R | §7 미리보기 생성 규칙(일치·대상 도구) | NEW | — |
| R-06 | R | §7 미리보기 읽기 경계(workspace·상한·실패) | NEW | — |
| R-07 | R | §7 미리보기 비영속 | NEW | — |
| AT-Δ1…AT-Δ10 | AT | §7 표 | NEW | — |
| SD-Δ1 | SD | §5·§9 미리보기 → 결과 패치 승계 수명주기 | NEW | — |
| AR-Δ1 | AR | §10 `tool.call.started.editPreview` 계약(이벤트·파트·비영속) | NEW | — |
| MD-Δ1 | MD | §10·§11 `buildEditPreview` 불변식 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-Δ1 | R-03′ ↔ AT-Δ1·AT-Δ2 | REQUIRED | `claude.ts enricher → started 이벤트 → 리듀서 파트 → DiffBody → DiffTable` | 미리보기만 있는 렌더와 결과까지 있는 렌더의 거터·본문 직접 단언 | not selected — 화면 산출 직접 관측 | EP-Δ4 (1) |
| VP-Δ2 | R-04′ ↔ AT-Δ3 | REQUIRED | 같은 경로 → `useDiffSyntax` → `syntaxText` | 토큰 주입 렌더의 `span[style]` | not selected — 산출 직접 관측 | EP-Δ4 |
| VP-Δ3 | R-05 ↔ AT-Δ4·Δ5·Δ10 | REQUIRED | `buildEditPreview(input, reader, roots)` | 일치 0·1·2회, `replace_all`, 비-Edit 도구의 반환값 | not selected — 반환값 직접 관측 | EP-Δ3 (1) |
| VP-Δ4 | R-06 ↔ AT-Δ6·Δ7·Δ8 | REQUIRED | `guardToolAccess` → reader → enricher | **주입 reader 의 호출 횟수 0** + throw 시 이벤트 흐름 유지 | required — 가드 조건을 항상 통과로 바꾸는 변이(결과값만 보면 침묵한다) | EP-Δ1·EP-Δ2 (2) |
| VP-Δ5 | SD-Δ1 ↔ ST-Δ1 | REQUIRED | `started(preview) → completed(result) → 같은 카드` | 두 이벤트를 순서대로 넣은 뒤 좌표가 결과 쪽인지 | not selected — 상태 전이 직접 관측 | EP-Δ4 |
| VP-Δ6 | R-07 ↔ AT-Δ9 | REQUIRED | `started 이벤트 → HistoryWriter → DB JSON` | writer 산출 JSON 의 키 집합 | required — writer 가 `editPreview` 를 함께 적는 변이(0건 스윕이라 방향을 따로 입증한다) | EP-Δ5 (1) |
| VP-Δ7 | AR-Δ1 ↔ IT-Δ1 | REQUIRED | `enricher → NormalizedEvent → 리듀서 파트 → ToolCall` | 이벤트에 실은 값이 파트를 거쳐 `ToolCall` 까지 같은 형상으로 도달 | not selected — 왕복 산출 직접 비교 | EP-Δ4 |
| VP-Δ8 | MD-Δ1 ↔ UT-Δ1 | REQUIRED | `buildEditPreview` 순수부 | hunk 좌표·문맥 폭 직접 단언 | not selected — 반환값 직접 관측 | EP-Δ3 |
| VP-R1 | 0228 R-03 ↔ AT-06·07·10·12·13 | REGRESSION | 0228 완료 경로 | `DiffBody.render.test.ts` 8케이스 + `claude-map.fileEdit.test.ts` 4케이스 | not selected — 기존 직접 oracle | 0228 EP-04·EP-05 |
| VP-R2 | 0228 R-04 ↔ AT-08·09 | REGRESSION | 0228 문법 강조 | `diffSyntax.render.test.ts` 2케이스 + DiffBody 토큰 2케이스 | not selected — 기존 직접 oracle | 0228 EP-06 |
| VP-N1 | 0228 R-01·R-02 ↔ AT-01…05 | NOT_REQUIRED | 랜딩 종류 축 — 이번 변경 경로가 `chatStore`·`steps`·`protocol` 어디에도 닿지 않는다 | 기존 증거: `5259ede` 의 `chatStore.agentKind`·`chatStore.landingDefault`·`steps` 스위트 | — | — |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree `app/**` 정적 게이트 | main·shared·renderer 를 고친다 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| subtree `app/**` 순수 테스트 | 순수 빌더·enricher·렌더를 추가한다 | `./node_modules/.bin/vitest run <suite>` | better-sqlite3 ABI red 30파일은 환경 기인 분리 |
| repository — 문서 인벤토리 | `docs/` 를 고치고 `NormalizedEvent` 필드가 는다 | `node scripts/check-doc-inventory.mjs --check` | 링크·수치 위반만 blocking |
| message-bus — 커밋 trailer | 설계·구현·검증 커밋 분리 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 진행 중 카드는 `call.result == null` 이라 패치 경로가 열리지 않는다 | `DiffBody.tsx:45` |
| 승인 대기 UI 는 `file_path` 한 줄만 보여준다 — diff 가 없다 | `ApprovalCard.tsx` `summarizeToolInput` |
| SDK 는 실행 전 diff 를 주지 않는다 | `sdk.d.ts:206-266` `CanUseTool` options 전수 |
| 어댑터에 이벤트 후처리 seam 이 있다 | `claude.ts:561` `claudeToNormalized(...).flatMap(...)` |
| 같은 스코프에 가드 입력이 살아 있다 | `claude.ts:386` `additionalDirectories` 선언 · `:468` `makeWorkspaceGuardHook(cwd, additionalDirectories)` |
| 경로 허용 판정이 이미 순수 함수로 있다 | `workspace-guard.ts:96` `guardToolAccess` (`null` = 통과) · `:54` `resolveGuardRoots` |
| `diff.structuredPatch` 가 SDK 와 **같은 형상·기본 문맥 4줄**을 낸다 | `node -e` 실측 — `{oldStart,oldLines,newStart,newLines,lines}` |
| `diff` 는 이미 채택된 의존성이다 | `app/AGENTS.md §의존성 정책` |
| 구조화 출력이 이벤트 → 파트 → `ToolCall` 로 흐르는 선례가 있다 | `chatReducer.ts:955` · `parts.ts:241` |
| `HistoryWriter` 의 started 분기가 영속 필드를 고른다 | `writer.ts:313` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `tool.call.started` 프로덕션 생산자 | `rg "type: 'tool.call.started'" app/src --glob '!*.test.*'` | 2 (`claude-map` 1 · `mock-scenarios` 다수는 테스트 시나리오) | 실제 어댑터 생산자는 `claude-map` 하나 |
| `tool.call.started` 프로덕션 소비자 | `rg "tool.call.started" app/src --glob '!*.test.*'` | 6 (리듀서·스토어·writer·coordinator 2·boundary) | 필드 추가 시 확인할 소비처 목록 |
| 파일 본문 읽기 IPC | `rg "files[A-Z]" app/src/shared/ipc.ts` | 5 (list·pickAttachments·pickDirectory·openPath·readAttachment) | 렌더러에 임의 파일 read 가 없다 |
| `main` 의 `diff` import | `rg "from 'diff'" app/src/main` | 0 | 이번에 첫 사용 — 채택 목록에는 이미 있다 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 위 표 전건을 이번 세션에서 셌다.
- "SDK 가 실행 전 diff 를 주지 않는다" 반례 검색: `rg "diff|patch" sdk.d.ts` → 12건, 전부 `get_workspace_diff`(별도 control request)·`task_updated.patch`(상태 patch)·산문이다. `CanUseTool` 경로에는 없다.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `DiffBody.render.test.ts` 8케이스 · `claude-map.fileEdit.test.ts` 4케이스 · `diffSyntax.render.test.ts` 2케이스 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-Δ1`, `AR-Δ1`
- 현재 책임 소유자: 줄의 정본은 **완료 결과**의 `structuredPatch` 하나다.
- 현재 entry → flow → state → consumer: `tool_use` 는 `args` 만 싣고 흐른다. 카드는 결과가 올 때까지 입력 쌍으로 그린다.
- 현재 오류/취소/정리 경로: 변경 없음.
- 문제의 직접 원인: 진행 중에는 파일 위치를 아는 값이 **어디에도 없다** — SDK 도 주지 않고 렌더러도 파일을 못 읽는다.

```text
[tool_use(Edit)] → [tool.call.started: args 만] → [카드: 입력 쌍, 줄번호 1부터]
[tool_result]    → [structuredOutput: {structuredPatch}] → [카드: 실제 좌표]
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 동일
- 변경 후 책임 소유자: 줄의 정본이 **둘**이고 순서가 있다 — 진행 중에는 미리보기, 완료되면 결과 패치(E-009).
- 변경 후 entry → flow → state → consumer: 어댑터가 `tool_use(Edit)` 를 보면 가드 안에서 편집 전 파일을 읽어 `structuredPatch` 를 만들고 started 이벤트에 `editPreview` 로 동행시킨다. 리듀서가 파트에 싣고 `DiffBody` 가 결과 다음 우선순위로 읽는다.
- 변경 후 오류/취소/정리 경로: 읽기 실패·가드 거부·상한 초과·일치 불일치가 전부 `null` 로 수렴해 기존 폴백으로 간다. 새 실패 표면이 화면에 없다.
- 유지하는 기존 메커니즘: `readFileEditStructuredPatch`·`fileEditPatchLines`·`patchLinesToDiffLines`·`DiffTable`. 신설은 미리보기 생성과 그 동행 필드뿐이다.

```text
[tool_use(Edit)]
  → [enricher: guardToolAccess → 상한 확인 → readFile → buildEditPreview]
  → [tool.call.started + editPreview:{structuredPatch}]
  → [리듀서 파트 → ToolCall.editPreview]
  → [DiffBody: result 패치 > editPreview > 입력 쌍] → [DiffTable]
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 줄의 정본 1개(결과) | 정본 2개 + 우선순위 | E-001·E-009 | SD-Δ1 / VP-Δ1·VP-Δ5 · `DiffBody.tsx` |
| data/control flow | started 는 `args` 만 | started 가 `editPreview` 동행 | E-002 | AR-Δ1 / VP-Δ7 · `claude.ts`·`ipc.ts` |
| state/contract | 파트에 미리보기 없음 | 파트에 라이브 전용 필드 | 렌더가 결과 없이 읽어야 한다 | AR-Δ1 / VP-Δ6 · `chatReducer.ts`·`parts.ts` |
| error/lifecycle | 폴백 3분기 | 폴백 7분기(가드·상한·읽기실패·일치·비-Edit 추가) | 거짓 좌표보다 폴백을 택한다 | SD-Δ1 / VP-Δ3·VP-Δ4 · `edit-preview.ts` |
| test seam/관측점 | 어댑터 enrich 없음 | 순수 빌더 + 주입 reader | `claude.ts` 는 electron 의존이라 직접 테스트 불가 | MD-Δ1 / VP-Δ8 · `edit-preview.test.ts` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/src/main/adapters/edit-preview.ts` **(신규)** | 미리보기 생성 — 가드 판정·일치 규칙·`structuredPatch` 호출 | `(input, roots, reader)` → `FileEditPatchHunk[] \| null` | `claude.ts` |
| `app/src/main/adapters/claude.ts` | 실제 reader 주입 + started 이벤트 동행 | `NormalizedEvent[]` → 같은 배열(편집 건만 필드 추가) | 어댑터 내부 |
| `app/src/shared/ipc.ts` | `tool.call.started.editPreview` · `tool_call` 파트 필드 | 타입 | main·renderer |
| `.../reducer/chatReducer.ts` | 이벤트 → 파트 | — | 리듀서 |
| `.../lib/parts.ts` | 파트 → `ToolCall` | — | 파생 |
| `.../tool-bodies/DiffBody.tsx` | 세 입력 중 우선순위 판정 | `ToolCall` → `DiffLine[][]` | 레지스트리 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| EP-Δ1 · R-06 / VP-Δ4 | 미리보기 읽기는 `guardToolAccess` 가 통과시킨 경로만 | `edit-preview.ts` | main | 매 `Edit` tool_use | 승인 전에 workspace 밖 파일을 읽는다 |
| EP-Δ2 · R-06 / VP-Δ4 | 1 MiB 초과 파일은 본문을 읽지 않는다 | `claude.ts` 의 reader | main | 매 읽기 | 큰 파일 하나가 턴 이벤트 스트림을 멈춘다 |
| EP-Δ3 · R-05 / VP-Δ3·VP-Δ8 | `old_string` 은 정확히 1회(또는 `replace_all`) | `edit-preview.ts` `buildEditPreview` | main | 미리보기 생성 시 | 카드가 엉뚱한 자리를 실제 좌표처럼 보인다 |
| EP-Δ4 · SD-Δ1 / VP-Δ1·VP-Δ5·VP-Δ7 | 렌더 우선순위 `결과 > 미리보기 > 입력 쌍` | `DiffBody.tsx` `buildBlocks` | renderer | 매 카드 렌더 | 완료 후에도 예측이 남아 사실과 다른 좌표를 보인다 |
| EP-Δ5 · R-07 / VP-Δ6 | started 파트 영속에 `editPreview` 를 넣지 않는다 | `writer.ts` started 분기 | main | 매 영속 | 같은 hunk 를 미리보기·결과로 두 번 저장한다 |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 공유 방법: 패치 **해석**은 0228 의 `shared/file-edit-tool.ts` 가 계속 소유한다. 이번에 만드는 것은 **생성**뿐이고 main 에만 둔다 — 렌더러는 생성하지 않는다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드의 `true/false/undefined` 의미: `editPreview === undefined` = 미리보기 없음(폴백). `null` 은 만들지 않는다.
- 외부 SDK 경계의 실제 요구 타입/의미: `diff.structuredPatch(...).hunks` 가 `FileEditPatchHunk[]` 를 그대로 만족하는지 타입으로 확인한다 — `as` 단언을 쓰지 않는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/edit-preview.ts` **(신규)** | 미리보기 생성 | `buildEditPreview` + 일치 규칙 + 가드 호출 | 순수(reader 주입) |
| `app/src/main/adapters/claude.ts` | 배선 | 가드 루트 1회 계산 + 상한 reader + `flatMap` 에서 started 이벤트 보강 | electron 의존 — 배선만 |
| `app/src/shared/ipc.ts` | 계약 | `tool.call.started.editPreview?: unknown` · `tool_call` 파트 동일 필드(라이브 전용 주석) | 타입 |
| `.../reducer/chatReducer.ts` | 이벤트 → 파트 | started 분기에 조건부 필드 | 리듀서 테스트 |
| `.../lib/parts.ts` | 파트 → `ToolCall` | `toolCallFromPart` 에 조건부 필드 | 순수 |
| `.../reducer/chatReducer.ts` (`ToolCall`) | 타입 | `editPreview?: unknown` | 타입 |
| `.../tool-bodies/DiffBody.tsx` | 우선순위 | `result 패치 → editPreview → 입력 쌍` | 렌더 |
| `docs/IPC_CONTRACT.md` | 채널 계약 | `tool.call.started` 필드 추가 서술 | 문서 게이트 |

세부:

1. **`buildEditPreview(input, roots, readFile)`** — `input` 이 `Edit` 형상(`file_path`·`old_string`·`new_string` 문자열)이 아니면 `null`. `guardToolAccess('Edit', input, roots)` 가 사유 문자열을 주면 **reader 를 부르지 않고** `null`. `readFile(path)` 가 `null`(부재·상한 초과·읽기 실패)이면 `null`. 본문에서 `old_string` 을 세어 `replace_all` 이 아닌데 1회가 아니면 `null`. 그 외에는 치환본을 만들고 `structuredPatch(p, p, before, after).hunks` 를 돌려준다. 빈 hunk 는 `null`.
2. **`claude.ts`** — `resolveGuardRoots(cwd, additionalDirectories)` 를 턴당 1회 계산한다(가드 훅과 같은 입력). reader 는 `statSync().size > 1 MiB` 면 `null`, 아니면 `readFileSync(p, 'utf8')`, throw 는 `null` 로 삼킨다. `flatMap` 안에서 `event.type === 'tool.call.started' && event.toolName === 'Edit'` 일 때만 부르고, 결과가 있으면 `{ ...event, editPreview: { structuredPatch: hunks } }` 로 바꾼다.
3. **`DiffBody`** — `readFileEditStructuredPatch(call.result?.structuredOutput) ?? readFileEditStructuredPatch(call.editPreview)` 순서로 hunk 를 고르고, 없으면 기존 `buildPairLines`. 0228 의 리더를 그대로 재사용하므로 hunk 정합 검증(0228 EP-05)이 미리보기에도 자동으로 걸린다.

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: `edit-preview.ts` 는 `workspace-guard`·`diff` 만 import 한다 — electron 을 타지 않아 vitest 대상이다. `claude.ts` 는 electron 을 타므로 배선만 두고 단언하지 않는다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `guardToolAccess` 는 `PreToolUse` 훅용이지만 순수 함수라 시점 제약이 없다. `readFileEditStructuredPatch` 는 `{structuredPatch}` 래퍼만 보므로 미리보기에도 그대로 맞는다.
- 순서를 관측할 훅/로그/주입 경계: reader 를 주입 포트로 두어 **호출 횟수**로 EP-Δ1·EP-Δ2 를 관측한다.

## 12. End-to-end 영향

### producer → consumer

```text
claude.ts enricher → NormalizedEvent.tool.call.started.editPreview
  → chatReducer(파트) → parts.toolCallFromPart → ToolCall.editPreview
  → DiffBody(우선순위) → DiffTable
  ↘ HistoryWriter: 싣지 않는다(EP-Δ5)
```

- producer 기준: hunk 좌표는 `diff.structuredPatch` 가 준 값 그대로다.
- consumer 파생 규칙: 0228 의 `fileEditPatchLines` → `patchLinesToDiffLines` 를 그대로 지난다 — 미리보기와 결과가 **같은 줄 생성기**를 쓴다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: `DiffBody` 는 결과 패치가 있으면 미리보기를 읽지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `chatReducer.ts:933` started 분기 | 조건부 필드 1개 추가 | AC1 |
| `writer.ts:313` started 분기 | **변경 없음** — 필드를 읽지 않는다 | AC9 |
| `turn-coordinator.ts:506` `openToolRuns` | 무영향 — `toolRunId`·`parentToolRunId` 만 본다 | VP-R1 |
| `response-boundary.ts:13` | 무영향 — 타입만 본다 | VP-R1 |
| `chatStore.ts:361` 코얼레서 | 무영향 — started 는 델타 배칭 대상이 아니다 | VP-R1 |
| `parts.ts` `partsToolCalls` | 조건부 필드 1개 추가 | AC1 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `Edit` tool_use 마다 1회. 턴당 편집 수에 비례한다.
- 취소/중단: 미리보기는 라이브 상태라 별도 정리가 없다.
- 종료/quit/crash/renderer-gone: 영속하지 않으므로 남는 것이 없다.
- retry/timeout/partial failure: 읽기 실패는 `null` 로 흡수하고 이벤트는 그대로 흐른다(AC8).
- cleanup/rollback: 새 구독·타이머·핸들 없음. `readFileSync` 는 즉시 닫힌다.
- **다중 저장소 쓰기**: 없다 — 미리보기는 어디에도 쓰지 않는다. 문서 산출은 `plan.md`/`verify.md` 와 `INDEX.md` 두 곳이므로 같은 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: hunk 문맥 4줄 × 변경 자리 수. `replace_all` 의 worst-case 는 파일 전체가 바뀌는 경우이고 그때 미리보기 크기는 파일 크기에 근접한다 — **1 MiB 상한이 그 상한이기도 하다**. 영속하지 않으므로 DB 증가는 0이다.
- 새 요청 수: 0 — 새 IPC 채널이 없다.
- 읽기 비용: 편집 1건당 동기 `statSync` + `readFileSync` 1회, 1 MiB 이하. 같은 루프가 이미 편집마다 동기 DB 쓰기를 한다.
- 구조적 목표: 없음.
- 캐시/호출 축소로 잃는 부수 효과: 파일 캐시를 두지 않는다 — 연속 편집에서 앞 편집이 파일을 바꾸므로 캐시는 곧 거짓 미리보기가 된다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 외부 구현자가 채우는 포트를 만들지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 줄의 정본은 결과의 구조화 패치(0228 D-006) | `file-edit-tool.ts` 헤더 | E-009 | **보완** — 결과가 없는 동안만 미리보기가 선다 |
| 구조화 출력은 TaskXXX 와 `Edit` 에만(0228 D-008) | `ipc.ts` `structuredOutput` 주석 | 변경 없음 | 유지 — 새 필드는 started 이벤트의 별도 키다 |
| `Write` 는 패치를 싣지 않는다(0228 D-009) | `file-edit-tool.ts:30` | E-004 | 유지 |
| hunk 정합 검증은 리더가 갖는다(0228 EP-05) | `file-edit-tool.ts` `asHunk` | §11 구현 설계 3 | 유지 — 미리보기도 같은 리더를 지난다 |
| workspace 밖 r/w 차단(0075) | `workspace-guard.ts` 헤더 | E-005 | 유지 — 같은 판정을 읽기에도 적용한다 |
| main 에서 Node 전역 `fetch` 금지(0173) | `app/AGENTS.md` | 해당 없음 | 무관 — 원격 요청이 없다 |
| 새 의존성은 사용자 승인 필요 | `app/AGENTS.md §의존성 정책` | §17 | 유지 — `diff` 는 이미 채택 목록에 있다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 미리보기가 예측이라 실제와 다를 수 있다 | 일치 1회 규칙(E-007) + 완료 시 즉시 교체(E-009). 카드 동사가 `수정 중` 이라 미완임을 말한다 |
| 승인 전 파일 읽기가 새 read 표면이다 | `guardToolAccess` 의 `readRoots` 안으로 제한(E-005). CLI 자신도 같은 파일을 곧 읽는다 |
| 동기 읽기가 이벤트 루프를 멈춘다 | 1 MiB 상한(E-006) + 캐시 없음 |
| 문맥 폭이 결과와 달라 화면이 튄다 | 같은 `diff.structuredPatch` 기본값(문맥 4)을 쓴다(E-003) — 실측으로 확인 |
| 라이브 전용 필드가 영속 타입에 붙는다 | 필드 주석에 라이브 전용을 못박고 AC9 가 writer 산출로 강제한다 |

- 되돌리기 어려운 결정: `editPreview` 필드 이름(이벤트·파트 공개 계약).
- 신규 의존성: 없음 — `diff` 는 채택 완료. → 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/main/adapters/{edit-preview.ts,claude.ts}`
- `app/src/shared/ipc.ts`
- `app/src/renderer/src/features/chat/{reducer/chatReducer.ts,lib/parts.ts,components/transcript/tool-bodies/DiffBody.tsx}`
- `docs/IPC_CONTRACT.md` · `docs/handoff/0229-edit-preview-while-running/plan.md` · `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md §레이어 DAG` · `app/src/renderer/AGENTS.md §테스트`
- ABI/네트워크 등 환경 제약: DB 로드 스위트 30파일 red 는 기존 베이스라인 — 분리 보고한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`
- 관련 테스트: `./node_modules/.bin/vitest run src/main/adapters src/renderer/src/features/chat/components src/renderer/src/features/chat/lib src/shared`
- 문서 게이트: `node scripts/check-doc-inventory.mjs --check`
- 사람 실기: 승인 대기 화면에서 미리보기 확인 1건.

## READY self-review

- [x] 0228 의 ACTIVE 결정을 지우지 않고 E-001~E-010 을 증분으로 쌓았다.
- [x] Part I 만 읽어도 완료 상태가 이해된다.
- [x] 사용자 문장("'수정 중' 에서는 이전과 똑같다")을 §2 에 원문으로 인용했다.
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다.
- [x] AS-IS·TO-BE 가 같은 축으로 있고 Delta 5행이 §11 파일 또는 AC 로 추적된다.
- [x] AS-IS 에서 사라진 책임 없음 — 결과 패치 경로는 그대로 산다(보완).
- [x] 수치·전칭·외부 규약·기존 테스트 인용을 §8 에서 실측했다(SDK options 전수 포함).
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 경로를 가진다.
- [x] Delta V 이고 기준 V 를 commit 으로 고정했다 — 유효 V = `0228:V1 + ΔV1`.
- [x] 모든 NEW/CHANGED node 에 같은 레벨 REQUIRED pair 가 있다(R 5 · SD 1 · AR 1 · MD 1 → pair 8).
- [x] 영향받은 INHERITED 는 REGRESSION 2건, 비영향은 NOT_REQUIRED 1건에 출처·기존 증거를 적었다.
- [x] 각 pair 가 경로·§10 분모·직접 oracle 을 갖고 적대 증거는 VP-Δ4·VP-Δ6 둘만 이유와 함께 선택했다.
- [x] 운영 gate 4종을 열거했고 DB ABI 기존 실패를 blocking 으로 삼지 않았다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 가드·상한·일치·우선순위 전부 순수 테스트 대상이다.
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — AC6·AC7 은 reader **호출 횟수**를 본다.
- [x] 신규 계약(`editPreview`·`buildEditPreview`)의 SSOT·강제 지점·테스트 seam 이 있다.
- [x] started 이벤트의 기존 소비처 6곳을 §12 에 전수로 적었다.
- [x] producer/consumer 양쪽 의미를 §12 에서 확인했다.
- [x] 상한·one-way door 를 §14·§17 에서 계산했다.
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다.
- [x] 본문 완성 후 교차검증했고 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.
