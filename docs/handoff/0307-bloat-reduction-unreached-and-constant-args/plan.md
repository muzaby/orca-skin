# Plan — 0307-bloat-reduction-unreached-and-constant-args

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0305 감사](../0305-code-bloat-audit/audit.md) §3 후보 표 · §4 승인 목록 · §8 분해안 · §9 분할안이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0307-bloat-reduction-unreached-and-constant-args` |
| 작성자 | Claude Code |
| 일자 | 2026-11-11 |
| 매핑 | 0305 분할안 H-A · H-B · H-K |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0305는 감사 문서의 V라 코드 계약을 상속하지 않는다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 작업 — root `AGENTS.md` 협업 워크플로우) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0305 감사가 화면에서 닿지 않는 코드와, 늘 같은 값만 들어오는 인자·선택적 의존성을 찾았다. 그 코드는 테스트·문서·IPC 계약에 딸린 분량을 함께 끌고 있다.
- 완료 후 달라지는 것: 후보 15건의 코드가 사라지거나 한 벌로 줄고, 사용자가 보는 화면과 동작은 그대로다.
- 성공을 사용자 관점에서 한 문장으로: 앱을 쓰는 사람은 차이를 느끼지 못하고, 코드를 읽는 사람은 닿지 않는 경로와 실행되지 않는 분기를 더는 만나지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "305 핸드오프 결과를 바탕으로 최적화 진행하라" | 라이브 세션 턴 1 |
| 명시 요구 | 이번 범위는 "H-A + H-B + H-K" | 질의 1 답 |
| 명시 요구 | H-A 미도달 후보 "9건 전부 승인" | 질의 1 답 |
| 명시 요구 | 0225 이관 코드 제거(C-10·C-11) "승인" | 질의 1 답 |
| 명시 요구 | C-33·C-34 "둘 다 보류" | 질의 1 답 |
| 상속 | 회귀 금지 · 판정 단위는 시나리오별 관측 동작 · 목표는 코드 감량 · 백그라운드/서브 에이전트 금지 | 0305 plan D-003 · D-011 · D-006 |
| 추론 의도 | 승인됐지만 이번 범위(H-A·H-B·H-K)에 없는 C-10·C-11은 다음 handoff(H-C)로 간다 — 범위 답과 승인 답을 둘 다 그대로 따른 해석 | 질의 1 두 답의 교집합 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이번 handoff는 0305 분할안 H-A · H-B · H-K를 구현한다 | "H-A + H-B + H-K" | 질의 1 | ACTIVE | — |
| D-002 | H-A 9건(C-01 C-02 C-03 C-04 C-05 C-06 C-08 C-09 C-32) 제거를 승인한다 | "9건 전부 승인" | 질의 1 | ACTIVE | — |
| D-003 | 0225 이관 코드(C-10·C-11) 제거를 승인한다. 실행은 H-C handoff다 | "승인" · 범위 답에 H-C 없음 | 질의 1 · §2 추론 행 | ACTIVE | 0292 "유지" 결정을 대체 |
| D-004 | C-33(`window.oo` 래퍼) · C-34(백그라운드 이중 모델)는 현행 유지한다 | "둘 다 보류" | 질의 1 | ACTIVE | — |
| D-005 | 회귀 금지. 판정 단위는 시나리오별 관측 동작이고, 내부 구조에 묶인 테스트는 통합·삭제할 수 있다 | 0305 D-003 원문 "**회귀 금지**. 이전 핸드오프의 요구 조건을 **개념적으로**…" | 0305 plan §3 | ACTIVE | — |
| D-006 | 목표는 코드 감량이다. CI·가드·테스트 인프라를 따로 줄이지 않는다 | 0305 D-011 | 0305 plan §3 | ACTIVE | — |
| D-007 | 백그라운드·서브 에이전트를 쓰지 않는다. 단계마다 커밋을 남긴다 | 0305 D-006 "토큰이 금장 소모되어 에이전트 작업이 중단, 컨텍스트를 소실한다" · D-007 | 0305 plan §3 | ACTIVE | — |
| D-008 | C-12(세션 행 6회 조회·3중 검증)는 이번에 구현하지 않는다 | 재실측에서 전제가 틀렸다 — 조회 사이에 `await`가 있어 재조회가 삭제·변경 경쟁 가드다(§4·§8) | 설계자 조사 | ACTIVE | — |
| D-009 | C-26(턴 조정기 선택적 호출)은 이번에 구현하지 않는다 | 13곳 중 `hasCanonical?`·`getState?` 4곳이 보류된 C-34의 전환 스위치이고, 나머지는 계약 타입이 다른 구현자에게도 열려 있다(§8) | 설계자 조사 | ACTIVE | — |
| D-010 | C-37은 1단계(`onStage` 제거)만, C-38은 1단계(props 필수화)만 한다 | C-37 2단계는 0303 EP-04 테스트가 잠근 manager 합류를 지운다 · C-38 2단계는 절감 추정이 없다 | 설계자 조사 | ACTIVE | — |
| D-011 | C-02(백그라운드 원본 출력 읽기)의 제거 범위 | 읽기만 지우면 `capture`가 아무도 읽지 않는 스냅샷을 계속 쓴다(§4). 읽기만 / 캡처까지 / 보류 중 사용자 결정 필요 | 설계자 조사 | OPEN | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-011.
- 변경된 결정: 0292의 0225 이관 "유지" → D-003(사용자 승인). 실행은 H-C.
- D-011이 OPEN인 동안 C-02는 이번 범위 밖이다. 답이 오면 ΔV로 넣는다 — 나머지 14건의 구현을 막지 않는다.
- D-008·D-009·D-010은 사용자가 고른 묶음에서 후보를 뺀 설계자 판단이다. 근거는 §4·§8이고, 사용자가 되돌리면 ΔV로 넣는다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0.
  - D-002("9건 전부") ↔ AC1~AC8: 8건이 AC를 갖고 C-02만 D-011(OPEN)로 빠진다.
  - D-004("보류") ↔ AC12: `hasCanonical`·`window.oo` 래퍼를 건드리는 AC 없음 — `rg 'hasCanonical|api/ipc' §7` 대조.
  - D-005("회귀 금지") ↔ AC1~AC15: 각 행의 동작 기준 뒷절이 유지되는 동작이다.
  - D-006("코드 감량") ↔ AC17: prod 순감을 요구한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 후보마다 호출부·생산자·주입 지점을 이번 세션에 다시 셌다(§8 전수 조사) |
| 이미 기존 코드가 충족하는가 | 아니오 | 후보 15건의 표적이 모두 트리에 있다(§8) |
| 더 작은 해법이 있는가 / 제거라면 능력 자체가 없어도 되는가 | 타당 — 제거 8건은 화면 호출부·생산자 0 | §8 전수 조사 N열 |
| 선행 자료의 주장을 코드와 대조했는가 | **전제 정정 3건** | 아래 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | C-01은 0231의 "main·preload API를 남긴다"를 뒤집는다 — D-002로 승인됨 | `docs/arch/backend/background-tasks.md:25` |

전제 정정(0305 감사 주장 ↔ 현재 코드):

| 후보 | 감사 주장 | 재실측 | 처리 |
|---|---|---|---|
| C-12 | 같은 세션 행 6회 조회·3중 검증이 중복이다 | `send.ts:83`과 `:163` 사이에 `await normalizeAttachments`(`:146`), `resolve-turn.ts:74`와 `:104` 사이에 `await resolveTurnProvider`(`:96`), `:160` 앞에 `await prepareNativeSession`. `:104` 주석: "await한 사이 세션이 삭제/변경되면 오래된 출생 속성으로 실행하지 않는다" | D-008 — 제외 |
| C-02 | 읽기 경로 42줄만 지우면 된다 | `background-controller.ts:378`의 `outputs.capture`가 스냅샷을 쓰고 읽는 곳은 `:352 readSnapshot`뿐이다 — 읽기만 지우면 쓰기 전용 저장이 남는다 | D-011 — OPEN |
| C-37 | manager 쪽 합류는 production이 닿지 않는다 | 맞다(`tools.ts:40`이 flight마다 manager를 새로 만든다). 다만 `mail.integration.test.ts:1139` "EP-04 manager waits for incremental before full…"이 그 합류를 잠근다 | D-010 — 1단계만 |

그 밖의 좌표 변화: 0306 이름 정리로 채널 접두사가 `oo:`, renderer 전역이 `window.oo`다. 감사 문서의 `orca:`·`window.orca` 좌표는 이 이름으로 읽는다.

- 사용자에게 올릴 결정: D-011(C-02 범위) 1건.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

UI 변화는 없다. 관측자는 앱 사용자(화면이 그대로다)와 코드 소비자(preload API·IPC 계약 문서)다.

```text
[사용자 조작 S-02 S-04 S-05 S-10 S-16 S-17 S-18 S-19 S-25 S-31]
  → [main/renderer 경로 — 미도달 분기·fallback 없이 같은 경로]
  → [지금과 같은 화면 결과]
  ↘ [오류 문구·거부 조건도 지금과 같다]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 백그라운드 작업 개별 중단(S-10) | `controller.stop` — 변경 없음 | 지금과 같다 |
| 응답 전송(S-04·S-05) | 전체-중단 게이트(`send.ts:115`) 없이 진행 | 지금과 같다 — 그 게이트를 켜는 화면 조작이 없었다 |
| 산출물 탐색기에서 보기(S-19) | `artifact:reveal` — 변경 없음 | 지금과 같다 |
| 로그인 게이트 상태 조회(S-02) | `provider:state` — 변경 없음 | 지금과 같다 |
| 구 설정 파일에 `projectMcpChoices`가 남아 있음(S-25) | 스키마가 그 키를 모른다 | 설정이 로드되고 다른 값이 유지된다 |
| 개발 빌드에서 mock 켬(S-31) | 어댑터 선택 한 곳이 mock을 고른다 | mock 응답이 재생된다 |
| 컨텍스트 파일 열기(S-17) | 가드 한 벌이 정책을 판정 | 허용되지 않은 경로는 열리지 않는다 |
| 모델 목록 조회·턴 준비(S-01·S-04) | 런타임 구성 서비스 한 경로 | 지금과 같은 목록·같은 실행 구성 |
| diff 요구사항 추가·선택·삭제(S-18) | 필수 props 직접 호출 | 지금과 같다 |
| @ 멘션(S-16) | 플러그인 목록 한 번 계산 | 같은 자동완성·같은 칩 판정 |

### 파생 UX / 엣지케이스

- loading / empty / error: 변화 없음. 삭제하는 오류 문구는 "백그라운드 작업 전체 중단을 확인하고 있습니다…" 1개다 — 띄우는 조작이 화면에 없다.
- cancel / retry / close / restart: 변화 없음.
- concurrency / multi-session: 변화 없음 — 경쟁 가드인 세션 재조회(C-12)는 건드리지 않는다(D-008).
- 외부 소비자: preload `window.oo`에서 메서드 3개(`chat.stopAllBackgroundTasks` · `artifacts.openFolder` · `provider.list`)가 사라진다. renderer 호출부는 0이다(§8).

## 6. 범위 / 비범위

- **범위**(15건): H-A `C-01 C-03 C-04 C-05 C-06 C-08 C-09 C-32` · H-B `C-13 C-16 C-17 C-30` · H-K `C-37(1단계) C-38(1단계) C-39`. 딸린 테스트·i18n 키·문서(`IPC_CONTRACT.md` · `arch/` · `generated/inventory.md`).
- **비범위**: C-02(D-011) · C-12(D-008) · C-26(D-009) · C-37 2단계 · C-38 2단계(D-010) · C-10·C-11(H-C) · C-33·C-34(D-004) · 그 밖의 분할안 묶음.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| C-02 | 아니오 | D-011 답 뒤 ΔV |
| C-10·C-11 | 아니오 | H-C handoff(승인됨) |
| C-12 · C-26 · C-37 2단계 · C-38 2단계 | 아니오 | 0305 분할안에 남는다 — 사용자가 되돌리면 ΔV |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 (C-01) | 전체 중단 채널·컨트롤러 경로·전송 게이트가 없다. 개별 중단은 요청·ACK·미확인 상태가 지금과 같다 | 기존 개별 중단 테스트 3건 green · `Stop`/`Promote` 스키마가 `generation` 없는 입력을 거부 · 음성 검색 EP-01 0건 | `chat:stopBackgroundTask` → `controller.stop` |
| R-02 | AC2 (C-03) | 산출물 폴더 열기 채널이 없다. 탐색기에서 보기는 검증된 원본만 연다 | 기존 `artifacts.test.ts` reveal 케이스 green · artifact 채널 등록 집합 = `CHANNELS` artifact 도메인 전수 · EP-02 0건 | `artifact:reveal` → `shell.showItemInFolder` |
| R-03 | AC3 (C-04) | `provider:list` 채널이 없다. `provider:state`는 첫 스냅샷에 복원 진행 여부를 싣는다 | `providers.test.ts` "등록 집합이 CHANNELS 의 provider 도메인 전수와 일치한다" · "첫 스냅샷에도…" green · EP-03 0건 | `provider:state` → `connectionState` |
| R-04 | AC4 (C-05) | camera feature와 그 i18n 네임스페이스가 없다. 다른 화면의 라우팅·번들은 그대로다 | EP-04 0건 · `resources.test.ts`의 ko/en 키 대칭 green · typecheck:web | `app/router.tsx` (경로 없음 — 삭제뿐) |
| R-05 | AC5 (C-06) | 참조 없는 export 16개의 선언이 없다 | `lens-exports.mjs` dead 목록에 16개 이름 0건 · typecheck 3종 | 해당 없음 — 참조 0 |
| R-06 | AC6 (C-08) | `structured_output` 파트 타입·세그먼트·카드가 없다. text·tool·error·compact 파트의 세그먼트화는 지금과 같다 | `parts.test.ts`의 세그먼트 케이스에서 structured 입력만 뺀 기대가 green · EP-06 0건 | DB `message_parts` → `parts.ts` 세그먼트 → `AssistantSegment` |
| R-07 | AC7 (C-09) | 설정 스키마·타입에 `projectMcpChoices`가 없다. 그 키가 남은 구 설정 파일도 로드되고 다른 키 값이 유지되며, `settings.patch`로 그 키를 쓸 수 없다 | `extension-catalog.test.ts` "does not reactivate legacy choice bytes…"를 고쳐 로드 성공·다른 키 유지·patch 무시를 단언 · EP-07 0건 | 설정 파일 → `SettingsStore.getAll` |
| R-08 | AC8 (C-32) | `subagent.backgroundSet` 이벤트 변형이 없다. 서브에이전트 시작·정착 이벤트 처리는 지금과 같다 | `turn-coordinator.test.ts`의 서브에이전트 정착 케이스 green(backgroundSet 입력 케이스 3건은 삭제) · EP-08 0건 | 어댑터 이벤트 → coordinator → `chatStore` |
| R-09 | AC9 (C-16) | 어댑터 선택이 한 판정이다: DEV mock이 켜졌으면 payload의 하네스와 무관하게 mock, 아니면 세션에 묶인 하네스 → payload 하네스 → 활성 하네스 순 | 신규 단위 테스트 4분기(§7-A VP-09) | `chat:send` → `handleChatSend` 1단계 |
| R-10 | AC10 (C-17) | 컨텍스트 열기 정책 가드가 한 벌이다: 세션 없음·정책 불허면 디렉토리와 첨부 목록이 모두 비고, 허용이면 각각 기록된 목록이다 | `files.contextDirectory.test.ts` + 신규 케이스(§7-A VP-10) | `files:openContextFile` → `contextFileScope` |
| R-11 | AC11 (C-30) | 로그인 서비스의 `onStep`·`onSnapshot`이 필수 의존성이다. 로그인 단계 전이와 스냅샷 통지(`revoked`·`expired`·`verified`·`credential-committed`)는 지금과 같다 | `login.test.ts` 기존 통지 케이스 green + 통지 원인별 단언(§7-A VP-11) | `provider:login` → `LoginService` → `runtime.ts:209-210` publish |
| R-12 | AC12 (C-13) | `harnessRuntime`·`runtimeModelCatalog`·`background`가 필수다. 모델 목록과 턴 준비는 읽기 전용 key면 캐시, 아니면 resolve, 캐시가 없으면 오류다 | `misc.runtime-catalog.test.ts` · `resolve-turn` 테스트의 3분기(§7-A VP-12) · EP-12 0건 | `agent:list` → `misc.ts` · `chat:send` → `resolveTurnProvider` |
| R-13 | AC13 (C-37) | 메일 동기화에 단계 콜백이 없다. 동기화 결과·취소·오류는 지금과 같다 | `sync-manager.test.ts` · `mail.integration.test.ts` green(호출 인자만 변경) · EP-13 0건 | 메일 도구 → `tools.ts sync` → `manager.sync` |
| R-14 | AC14 (C-38) | diff 리뷰의 요구사항 props 6개가 필수다. 초안 변경·추가·선택·삭제 콜백이 지금과 같은 인자로 불린다 | `diffRequirementSelection.render.test.ts` · `fileDiffRequirementReveal.test.ts` · `diffTileWiring.test.ts` green + 콜백 4종 단언(§7-A VP-14) | `DiffTileContent` → `DiffReview` → `FileDiffSection` |
| R-15 | AC15 (C-39) | 유효 플러그인 id 집합 = 멘션 자동완성이 낸 id ∪ 관측된 네이티브 플러그인 id(관리형 MCP 포함 여부는 `includeManagedMcp`) | `ComposerInputController.test.ts` 2분기(§7-A VP-15) | 컴포저 입력 → `validPluginIds` → 칩 판정 |
| R-16 | AC16 | `IPC_CONTRACT.md`에 삭제한 채널 3행이 없고, `background-tasks.md`·`layers.md`·`ux-domains.md`·`design-components.md`·`design-system.md`가 삭제된 것을 현재형으로 서술하지 않는다 | `node scripts/check-doc-inventory.mjs --check` green · EP-16 0건 | 문서 |
| R-17 | AC17 | prod 코드가 순감한다. 테스트 코드는 순증하지 않는다 | `git diff --numstat <설계 커밋>..HEAD -- app/src` 를 prod/test로 갈라 합산 — prod 순증감 < 0 · test 순증감 ≤ 0 | 해당 없음 |
| R-18 | AC18 | §19 게이트가 green이거나 실패가 기준선과 같은 환경 서명이다 | §19 명령 산출 | CI |
| R-19 | AC19 | 설치본·개발 빌드에서 화면이 그대로다 | 사람 실기 — §19 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: 인용한 케이스명은 이번 세션에 `rg`로 실재를 확인했다 — `background-controller.test.ts:50,81,422` · `artifacts.test.ts:238,251` · `providers.test.ts:34,40,49` · `mail.integration.test.ts:1139`.
- 사람 실기 항목: AC19만. 개발 빌드 mock 재생과 설치본 화면은 Electron 실행이 필요하다(egress 차단 환경에서 불가).
- 총량/0건 기준: 음성 검색마다 허용 예외를 §10에 먼저 열거했다. 삭제의 불변식은 "없다"라 음성 게이트가 방향에 맞고, 과삭제는 같은 행의 유지 동작 테스트가 막는다.
- AC17의 test 조건: C-13·C-30이 테스트 조립에 의존성을 더하지만 C-01·C-03·C-08·C-32가 지우는 테스트가 더 크다고 추정한다. 구현 중 순증이 나오면 수치와 사유를 보고하고 설계자 판단을 받는다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 코드 V가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01~R-08 | R | §7 AC1~AC8 — 미도달 코드 제거와 유지 동작 | NEW | — |
| R-09~R-15 | R | §7 AC9~AC15 — 한 벌로 줄인 판정·필수 의존성 | NEW | — |
| R-16~R-19 | R | §7 AC16~AC19 — 문서·감량·게이트·실기 | NEW | — |
| AR-01 | AR | §9·§10 EP-01~03 — 채널 3종의 스키마 → preload → 래퍼 → 핸들러 사슬 | NEW | — |
| AR-02 | AR | §9·§10 EP-12 — 컴포지션 루트가 주입하는 런타임 구성 의존성 | NEW | — |
| MD-01 | MD | §10 EP-09 — 어댑터 선택 판정 | NEW | — |
| MD-02 | MD | §10 EP-10 — 컨텍스트 열기 정책 가드 | NEW | — |
| MD-03 | MD | §10 EP-15 — 유효 플러그인 id 파생 | NEW | — |
| AT-01~AT-19 · IT-01·02 · UT-01~03 | AT·IT·UT | 아래 Pair registry의 oracle | NEW | — |

### Pair registry

| Pair | left ↔ right | req. | production path | 직접 oracle (자리별 좌표 · 분기 입력) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | renderer `chatApi.stopBackgroundTask` → preload → `background.ts` handler → `controller.stop` | `background-controller.test.ts:'bounds a stop request whose SDK never acknowledges it'` · `:'keeps stop ACK distinct from terminal…'` · `:'turns an individual stop ACK without terminal evidence…'` · 신규 `protocol` 케이스: `{sessionId}`만 준 입력을 `StopBackgroundTaskSchema`·`PromoteBackgroundTaskSchema`가 거부 | required — 0건 스윕 민감도: `stopAll` 메서드 복원 시 EP-01 검색이 red | EP-01 (11자리) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `artifactApi.reveal` → preload → `handlers/artifacts.ts` reveal → `service.openFolderPath`·`revealPath` | `artifacts.test.ts:'rejects exports into the canonical root and reveals only the verified original ID'` · 같은 파일의 채널 등록 전수 케이스(`:172` 표에서 `artifactOpenFolder` 행 삭제) | not selected — 직접 행동 oracle | EP-02 (5자리) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `providerApi.state` → preload → `handlers/providers.ts` | `providers.test.ts:'등록 집합이 CHANNELS 의 provider 도메인 전수와 일치한다'` · `:'첫 스냅샷에도 복원 진행 여부를 싣는다'` | not selected | EP-03 (4자리) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 해당 없음 — import 처 0 | `gate:npm run typecheck` · `resources.test.ts` ko/en 대칭 | not selected | EP-04 (4자리) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | 해당 없음 — 참조 0 | `gate:node ../docs/handoff/0305-code-bloat-audit/scan/lens-exports.mjs` 의 dead 절에 16개 이름 0 · `gate:npm run typecheck` | not selected | EP-05 (16자리) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | DB part row → `parts.ts` `segmentAssistantParts` → Claude·OpenCode `AssistantSegment` | `parts.test.ts:'error / structured_output 는 개별 세그먼트, 빈 text 는 스킵'`을 error·빈 text 입력으로 고친 케이스 · `projection.test.ts`·`Timeline.render.test.ts`·`workActivity.test.ts`에서 structured 입력 행만 제거 | not selected | EP-06 (9자리) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | 설정 파일 → `SettingsStore` 생성 → `getAll` · `patch` | `extension-catalog.test.ts:'does not reactivate legacy choice bytes…'` — 입력: `projectMcpChoices`와 다른 키 1개(기본값과 다른 값)가 든 구 store. 단언: `getAll()` 성공 · 다른 키 값 유지 · `patch({projectMcpChoices})` 뒤 `getAll()`에 그 키 없음 | not selected | EP-07 (3자리) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | Claude 어댑터 이벤트 → `turn-coordinator` 이벤트 루프 → `chatStore` `onChatEvent` | `turn-coordinator.test.ts`의 `subagentStarted`·settled 케이스(backgroundSet 없는 것) green · `gate:npm run typecheck`(판별 유니온 소진) | not selected | EP-08 (2자리) |
| VP-09 | MD-01 ↔ UT-01 | REQUIRED | `handleChatSend` 1단계 → 신규 순수 함수 `selectTurnAdapter`(`admission.ts`) | 신규 `admission.test.ts` 4입력: ① mock 있음·enabled → mock(payload.backend가 다른 하네스여도) ② mock 있음·disabled·세션 backend=B → B ③ mock null·payload.backend=B·활성=A → B ④ 셋 다 없음·활성=A → A. 추가: registry에 없는 backend → `null` | not selected | EP-09 (2자리) |
| VP-10 | MD-02 ↔ UT-02 | REQUIRED | `files:openContextFile` → `contextFileScope` → 가드 | `files.contextDirectory.test.ts` 기존 케이스 + 신규 3입력: 세션 없음 → 디렉토리 `[]`·첨부 `[]` · 정책 불허 세션 → 둘 다 `[]`(DB에 cwd·첨부 기록이 있어도) · 허용 세션 → 디렉토리 목록과 첨부 목록이 서로 다른 값 | not selected | EP-10 (2자리) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | `provider:login` → `LoginService` → `deps.onStep`·`deps.onSnapshot` → `runtime.ts` publish | `login.test.ts`: 통지 9자리마다 원인 값을 구별해 단언 — `onStep(null)`(취소) · `onStep(step)`(진행·실패) · `onSnapshot(id,'revoked')` · `'expired'`(2자리) · `'verified'` · 전달받은 `cause` · `'credential-committed'` | required — 맞바꿈: `'expired'`↔`'verified'`(`login.ts:363,365`) | EP-11 (9자리) |
| VP-12 | AR-02 ↔ IT-02 | REQUIRED | `bootstrap.ts` ctx 조립 → `misc.ts agentList` · `resolve-turn.ts resolveTurnProvider` · `engine.ts` 무효화 | `misc.runtime-catalog.test.ts` · resolve-turn 테스트 — 자리마다 3입력: 읽기 전용 key → `cached` 호출·`resolve` 미호출 · 일반 key → `resolve(target)` 호출(인자 `harnessId`·`modelProviderId`를 서로 다른 값으로) · 읽기 전용 key인데 캐시 없음 → 오류. `engine.ipc.test.ts`: CRUD 뒤 `invalidate(key,'harness-settings-crud')`·`runtimeModelCatalog.invalidate(key)` 호출 | required — 호출 대체 `resolve`→`cached`, 인자 맞바꿈 `harnessId`↔`modelProviderId`(0262 r4·r6에서 같은 자리가 미잠금이었다) — 자리: `misc.ts` · `resolve-turn.ts` 각각 | EP-12 (9자리) |
| VP-13 | R-13 ↔ AT-13 | REQUIRED | 메일 도구 → `tools.ts sync` → `manager.sync(signal, mode)` | `sync-manager.test.ts` · `mail.integration.test.ts`(EP-04 케이스 포함) · `tools.sync.test.ts` — `mode` 인자가 2번째 자리로 온 뒤에도 `'full'`·`'incremental'` 구별 케이스가 green | required — 맞바꿈: `tools.ts`의 `mode` 인자를 지움(기본값 `incremental`로 폴백) → full 케이스 red | EP-13 (3자리) |
| VP-14 | R-14 ↔ AT-14 | REQUIRED | `DiffTileContent` → `DiffReview` → `FileDiffSection` → 본문·행 컴포넌트 → 콜백 | `diffRequirementSelection.render.test.ts` · `fileDiffRequirementReveal.test.ts` · `diffTileWiring.test.ts` — 콜백 6자리(`:625,826,830,841,884,901`)마다 구별 인자: 초안 변경(본문 문자열) · 초안 취소(`null`) · 추가(제출 객체) · 선택(id A) · 삭제(id B≠A) | required — 맞바꿈: `onSelectRequirement`↔`onRemoveRequirement` 전달(`DiffReview.tsx`) | EP-14 (6자리) |
| VP-15 | MD-03 ↔ UT-03 | REQUIRED | `ComposerInputController` → `observedPlugins` → `validPluginIds` → 칩 판정 | `ComposerInputController.test.ts` 2입력: `includeManagedMcp=false` → 네이티브 플러그인 id만 유효(관리형 id는 무효) · `true` → 둘 다 유효. 멘션 자동완성이 낸 id와 겹치지 않는 값으로 채운다 | not selected | EP-15 (1자리) |
| VP-16 | R-16 ↔ AT-16 | REQUIRED | 문서 | `gate:node scripts/check-doc-inventory.mjs --check` · EP-16 검색 0건 | not selected | EP-16 (8자리) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/**` 수정 | §19 | 이번 변경이 만진 파일의 실패와 가드 위반만 blocking |
| 문서 인벤토리 | 채널·feature 수가 바뀐다 | `node scripts/check-doc-inventory.mjs` 재생성 후 `--check` | 같음 |
| 제품 이름 가드 | 삭제로 `ALLOWED` 개수가 바뀔 수 있다 | `node scripts/check-product-naming.mjs` | 같음 |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `StopAllBackgroundTasksSchema`는 `Stop`·`Promote` 스키마의 base다 — 지우면 두 스키마가 `generation`을 잃는다 | `shared/protocol.ts:235-241` |
| `service.openFolderPath()`는 reveal 핸들러도 쓴다 — 서비스 메서드는 남긴다 | `handlers/artifacts.ts:115` |
| `structured_output`은 OpenCode `AssistantSegment`도 `structured` 세그먼트로 그린다 | `opencode/transcript/AssistantSegment.tsx:33-41` |
| `structured_output` 생산자는 이력에도 없다 | `git log -S"type: 'structured_output'" -- app/src/main` → 0 |
| `MessagePartType`(DB)에도 멤버가 있다. 마이그레이션 SQL 주석은 append-only라 그대로 둔다 | `infra/db/types.ts:20` · `migrations/0004_message_parts.sql:11` |
| `subagent.backgroundSet`을 읽는 coordinator 코드는 없다 — 테스트 3건은 무시되는 이벤트를 넣는다 | `rg backgroundSet main/features/chat/turn-coordinator.ts` → 0 · `turn-coordinator.test.ts:1413,1430,1449` |
| `SettingsPatch`는 이미 `projectMcpChoices`를 뺀다 | `shared/ipc.ts:1179` |
| mock 판정이 전송마다 2회, 조건식이 같다 | `send.ts:71,102` |
| 컨텍스트 가드 2벌의 조건식이 글자까지 같다 | `handlers/files.ts:54-60,73-79` |
| production은 `harnessRuntime`·`runtimeModelCatalog`·`onStep`·`onSnapshot`·`background`를 늘 준다 | `bootstrap.ts:894` · `runtime.ts:209-210` · `chat-turn/index.ts:48,103` |
| `ctx.settings`는 타입이 필수인데 `?.`로 읽는다 | `context.ts:22` · `send.ts:198,268` |
| `onStage`의 production 호출부는 `undefined`를 넘기는 1곳, 테스트 참조 0 | `tools.ts:66` · `rg -c onStage -g '*.test.*' main` → 0 |
| diff props 6개의 호출 사슬은 1개 | `rg '<DiffReview\|<FileDiffSection' renderer/src` → 2(`DiffTileContent.tsx:96` · `DiffReview.tsx:158`) |
| 저장소 규칙: 채널을 바꾸면 `IPC_CONTRACT.md`를 같은 PR에서 고친다 · `arch/`는 현재 상태만 · 수치는 `generated/inventory.md` | `docs/AGENTS.md` 작성 규칙 2·4·6 |
| 저장소 규칙: 판정과 발신을 섞지 않는다 — `admission.ts`는 순수 | `app/src/main/AGENTS.md` chat-turn 작업 규칙 1 |
| INDEX 후보 표와 겹침: 0296 행(`send.wait-phase.test.ts`)은 `send.ts`를 테스트하지만 `clientKey` 경로다 — 이번 변경(1단계 어댑터 선택·게이트 삭제)과 형태가 다르다 | `INDEX.md` 새 handoff 후보 0296 행 |

### 전수 조사

`cd app/src` 기준, 테스트 제외는 `-g '!*.test.*'`.

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| C-01 renderer 호출부 | `rg -U 'chatApi\s*\??\.\s*stopAllBackgroundTasks' renderer` | 0 | 미도달 |
| C-01 i18n `stopAll` 소비 | `rg "stopAll" renderer/src -g '!*resources/*' -g '!*.test.*'` | 0 | 키도 미사용 |
| C-03 renderer 호출부 | `rg -U 'artifactApi\s*\??\.\s*openFolder' renderer` | 0 | 미도달 |
| C-03 i18n `openFolder` 소비(artifact 네임스페이스) | `rg "\.openFolder'" renderer/src -g '!*resources/*' -g '!*.test.*'` | 0 | 키도 미사용 |
| C-04 renderer 호출부 | `rg -U 'providerApi\s*\??\.\s*list\b' renderer` | 0 | 미도달 |
| C-05 import 처 | `rg 'CameraView\|features/camera' renderer -g '!*.test.*'` | 2 | 자기 파일뿐 |
| C-06 16개 식별자 | 식별자마다 `rg -n "\b<name>\b" .` | 각 1 | 선언뿐 — 테스트 참조도 0 |
| C-08 생산자 | `rg "type: 'structured_output'" main -g '!*.test.*'` | 0 | 미생산 |
| C-09 참조 | `rg projectMcpChoices . -g '!*.test.*'` | 3 | 스키마 1·타입 2 |
| C-32 참조 | `rg backgroundSet . -g '!*.test.*'` | 2 | 타입 1·renderer no-op 1 |
| C-13 `harnessRuntime` 테스트 | `rg -l harnessRuntime -g '*.test.*' .` | 16 | 나머지 조립은 fallback 분기를 탄다 |
| C-30 생성 지점 | `rg -c 'new LoginService\(' -g '*.test.*' .` | 9 (1파일) | 테스트 조립 수정 범위 |
| C-37 `manager.sync(` 테스트 호출 | `rg -c '\.sync\(' main/features/plugins/mail main/app/deployment -g '*.test.*'` | 47 (5파일) | 인자 자리 수정 범위 |

### 수치 / 전칭 표현 검산

- C-06 "16개 전부 선언뿐": 16개 각각 검색 결과 1줄 — 합 16.
- "production은 늘 준다"(C-13·C-30): 생성 지점이 각 1곳(`bootstrap.ts:894` · `runtime.ts` LoginService 생성)이고 조건부 주입이 없다.
- 기존 테스트 케이스 존재 확인: §7 AC 주의사항의 좌표.
- 0305 예상 절감(H-A 360 · H-B 71 · H-K 46)은 승계하지 않는다 — 범위가 달라졌고 AC17은 실측 차이로 판정한다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `AR-01` · `AR-02` · `MD-01~03`.
- 채널 사슬: `shared/ipc.ts CHANNELS` → `shared/protocol.ts` 스키마 → `preload/index.ts` 메서드 → `renderer/shared/api/ipc.ts` 래퍼 → (호출부 없음). main 쪽 핸들러와 컨트롤러 메서드는 살아 있다.
- 선택적 의존성: `RouterContext.harnessRuntime?` — 없으면 `misc.ts:75`·`resolve-turn.ts:279`의 fallback이 `harnessSettings.resolve`·빈 `runtimeEnv`로 대신한다. 테스트 조립 다수가 이 분기만 실행한다.
- 문제의 직접 원인: 화면이 쓰지 않게 된 뒤에도 사슬의 나머지가 남았고, 테스트 편의를 위한 optional이 production에 실행되지 않는 분기를 만들었다.

```text
renderer (호출 0) ─x─ api/ipc.ts 래퍼 → preload 메서드 → CHANNELS → 핸들러 → 컨트롤러/서비스
bootstrap ──주입──> ctx.harnessRuntime? ──있음──> cached/resolve
테스트 조립 ──생략──> ctx.harnessRuntime? ──없음──> fallback (production 미실행)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같음.
- 채널 사슬: 3개 채널의 CHANNELS 상수·preload 메서드·래퍼·핸들러·전용 타입이 없다. 공유 스키마 base는 `StopBackgroundTaskSchema`에 접힌다(`BackgroundStateSchema.extend({ generation, taskId })`), `Promote`는 `BackgroundStateSchema.extend({ generation, toolUseId })`.
- 필수 의존성: `RouterContext.harnessRuntime`·`runtimeModelCatalog`, `ChatRuntimeDeps.background`, `LoginServiceDeps.onStep`·`onSnapshot`. fallback 분기가 없다.
- 유지하는 메커니즘: 개별 중단·reveal·`provider:state`·세션 재조회 경쟁 가드·manager 합류.

```text
renderer ─ api/ipc.ts ─ preload ─ CHANNELS ─ 핸들러   (호출부가 있는 채널만)
bootstrap ──주입──> ctx.harnessRuntime ──> isReadOnly ? cached : resolve ──없음──> 오류
테스트 조립 ──같은 포트의 fake──> 같은 분기
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 호출부 없는 채널 3개가 4계층에 걸쳐 있다 | 없음 | 미도달 | AR-01 / VP-01~03 · M1 |
| data/control flow | mock 판정 2회, 컨텍스트 가드 2벌, 플러그인 목록 2회 계산 | 각 1회 | 같은 식의 반복 | MD-01~03 / VP-09·10·15 · M2·M3 |
| state/contract | `harnessRuntime?`·`runtimeModelCatalog?`·`background?`·`onStep?`·`onSnapshot?`·props 6개 optional | 필수 | production이 늘 준다 | AR-02 / VP-11·12·14 · M2·M3 |
| state/contract | `structured_output` 파트 · `subagent.backgroundSet` 이벤트 · `projectMcpChoices` 키 | 없음 | 생산자·소비자 0 | R-06~08 / VP-06~08 · M1 |
| error/lifecycle | 전체-중단 게이트 오류 1종 | 없음 | 켜는 조작 없음 | R-01 / VP-01 |
| test seam/관측점 | 어댑터 선택이 `handleChatSend` 인라인 | `admission.ts`의 순수 함수 `selectTurnAdapter` | 4분기를 IPC 없이 단언 | MD-01 / VP-09 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `main/app/chat-turn/admission.ts` `selectTurnAdapter` (신규, 순수) | 이번 턴의 어댑터 선택 | `{ mock: SessionAdapter\|null, mockEnabled, active: SessionAdapter\|null, bound?: Backend, requested?: Backend, get(id) }` → `SessionAdapter \| null` | `send.ts` 1단계 |
| `main/app/handlers/files.ts` `contextSession` (신규, 파일 내부) | 컨텍스트 열기가 허용된 세션 행 조회 | `sessionId` → 세션 행 \| `undefined` | `recordedContextDirectories` · `recordedAttachmentFiles` |

`selectTurnAdapter` 규칙(순서대로): ① `mock && mockEnabled` → `mock` ② 선택 id = `bound ?? requested ?? active?.id`, 선택 id가 있고 `active?.id`와 다르면 `get(선택 id)`(없으면 `null`) ③ 그 밖은 `active`. 세션·payload 불일치 오류 판정(`send.ts:85-99`)은 지금 자리에 그대로 둔다 — 이 함수는 선택만 한다.

## 10. 계약 / 타입 / 강제 지점

자리 검색은 `cd app/src` 기준이다. 삭제 행의 `언제 강제`는 "지금 있는 자리(= 지울 자리)"이고, 완료 조건은 같은 검색이 허용 예외만 남기는 것이다.

| V node / pair | 계약/필드 | 자리 목록 (= 분모) | 자리 검색 명령 → 완료 시 | 실패 의미 |
|---|---|---|---|---|
| EP-01 / VP-01 | 전체 중단 경로 없음 | `shared/ipc.ts:32` 상수 · `shared/protocol.ts:235` 스키마(접기) · `shared/background-task.ts:207` 결과 타입 · `preload/index.ts:24,158-162` · `renderer/…/api/ipc.ts:21,127-130` · `chat-turn/background.ts:8,65-67` · `background-controller.ts:17` import · `:72` 집합 · `:239-241` `isStoppingAll` · `:259-336` `stopAll` · `chat-turn/send.ts:115-125` 게이트 = 11 | `rg -n 'StopAllBackgroundTasks\|stopAllBackgroundTasks\|isStoppingAll\|stoppingAll\|controller\.stopAll' . ` → 0건. i18n `stopAll` 키(ko·en)도 삭제 | 미도달 경로가 남는다 |
| EP-02 / VP-02 | 폴더 열기 채널 없음 | `shared/ipc.ts:78` · `preload/index.ts:257` · `api/ipc.ts:374` · `handlers/artifacts.ts:96-` 핸들러 · i18n `openFolder`(artifact 네임스페이스 ko:794·en:790) = 5 | `rg -n 'artifactOpenFolder\|artifacts\.openFolder\|openFolder:' . -g '!*.test.*'` → 0건. 허용: `openFolderPath`(서비스) · skills 네임스페이스의 `openFolder` 키가 있으면 그 줄 | 같음 |
| EP-03 / VP-03 | `provider:list` 없음 | `shared/ipc.ts:163` · `preload/index.ts:381` · `api/ipc.ts:329` · `handlers/providers.ts:46` = 4 | `rg -n 'providerList\|provider\.list\(' .` → 0건 | 같음 |
| EP-04 / VP-04 | camera feature 없음 | `features/camera/index.ts` · `features/camera/components/CameraView.tsx` · i18n `camera` 네임스페이스 ko:581- · en:577- = 4 | `rg -n "CameraView\|features/camera\|'camera\.\|^  camera: \{" renderer` → 0건. 허용: `Icon.tsx`의 `cam` 경로 | 같음 |
| EP-05 / VP-05 | dead export 16 없음 | §8 C-06의 16개 선언(파일은 `lens-exports.mjs` dead 절) = 16 | `lens-exports.mjs` dead 절에서 16개 이름 0. 선언을 지워 고아가 된 import·지역 값은 lint가 잡는 대로 지운다 | 같음 |
| EP-06 / VP-06 | `structured_output` 없음 | `shared/ipc.ts:1570` 멤버(+`:1533` 주석 정정) · `infra/db/types.ts:20` · `lib/parts.ts:507` 세그먼트 kind · `:558-559` 분기 · `:653-654` 비교 · `claude/transcript/StructuredOutputCard.tsx`(파일) · `claude/…/AssistantSegment.tsx:6,34` · `claude/…/registry.ts:41`(+`:24-25` 주석) · `opencode/…/AssistantSegment.tsx:33-` case(+i18n `chat.transcript.structuredOutput` 미사용 시 삭제) = 9 | `rg -n "structured_output\|StructuredOutputCard\|kind: 'structured'\|case 'structured'" .` → 0건. 허용: `migrations/0004_message_parts.sql` 주석 · `structuredOutput`(도구 결과 필드 — 다른 개념) | 같음 |
| EP-07 / VP-07 | `projectMcpChoices` 없음 | `shared/protocol.ts:778` · `shared/ipc.ts:1157` · `:1179` = 3 | `rg -n projectMcpChoices . -g '!*.test.*'` → 0건. 허용: VP-07 테스트의 구 store 입력 | 구 파일 로드 실패가 가장 나쁜 상태 — VP-07이 본다 |
| EP-08 / VP-08 | `subagent.backgroundSet` 없음 | `shared/ipc.ts:726-743` 변형과 그 주석 · `chatStore.ts:978-983` case와 주석 = 2 | `rg -n backgroundSet .` → 0건(테스트 포함 — 관련 케이스 삭제) | 같음 |
| EP-09 / VP-09 | 어댑터 선택 1판정 | `send.ts:70-71` · `:101-107` = 2 | `rg -n 'mockAdapter' main/app/chat-turn -g '!*.test.*'` → `send.ts` 1건(`selectTurnAdapter` 호출 인자) | mock이 꺼졌는데 mock으로 가거나 그 반대 |
| EP-10 / VP-10 | 컨텍스트 가드 1벌 | `files.ts:54-60` · `:73-79` = 2 | `rg -c 'allowContextFileOpen' main/app/handlers/files.ts` → 1 | 한쪽 목록만 정책을 우회 |
| EP-11 / VP-11 | `onStep`·`onSnapshot` 필수 | `login.ts:107,108` 선언 · 호출 `:249,253,324,358,363,365,663,974,987` = 9(호출) | `rg -n 'deps\.on(Step\|Snapshot)\?' main/features/auth` → 0건 · `rg -n 'on(Step\|Snapshot)\?:' main/features/auth/login.ts` → 0건 | 통지 누락 — 화면이 로그인 단계를 못 따라간다 |
| EP-12 / VP-12 | 런타임 구성 의존성 필수 | `context.ts:55,56` 선언 · `misc.ts:56` · `:71-76` · `engine.ts:30,45,46,53` · `resolve-turn.ts:237` · `:275-279` · `deps.ts:41` `background?` · `send.ts:631` `background?.observe` · `send.ts:198,268` `ctx.settings?.` = 9 | `rg -n 'harnessRuntime\?\|runtimeModelCatalog\?\|deps\.background\?\|ctx\.settings\?\.' main -g '!*.test.*'` → 0건 · `rg -n 'ctx\.harnessRuntime\s*$\|ctx\.harnessRuntime \?' main -g '!*.test.*'` → 0건 | 읽기 전용 key가 resolve로 가면 턴마다 네트워크(0291 D-008 위반) |
| EP-13 / VP-13 | `onStage` 없음 | `sync-manager.ts:40` 타입 시그니처 · `:82` 매개변수와 호출 9줄(`:95,98,112,119,163,173,192` 외 재귀 `:88`) · `types.ts:157` `MailSyncStageEvent` · `tools.ts:66` 인자 = 3(파일) | `rg -n 'onStage\|MailSyncStageEvent' main` → 0건 | `mode`가 기본값으로 폴백하면 full 동기화가 incremental로 돈다 — VP-13 변이 |
| EP-14 / VP-14 | diff props 6개 필수 | 선언: `DiffReview.tsx:28-30,43-49` · `FileDiffSection.tsx:52-66,206-238,534-540,596-602,701,800-801,866` · 호출 `:625,826,830,841,884,901` = 6(호출) | `rg -n '(activeRequirementId\|selectionVersion\|onSelectRequirement\|onDraftChange\|onAddRequirement\|onRemoveRequirement)\?[:.]' renderer/src/features/chat/harnesses/common/rightpanel -g '!*.test.*'` → 0건 | 콜백이 조용히 안 불린다 |
| EP-15 / VP-15 | 플러그인 목록 1회 계산 | `ComposerInputController.tsx:238-248` = 1 | `rg -c 'nativePluginMentions\(' …/ComposerInputController.tsx` → 2(`observedPlugins` 안의 2호출뿐) | 관리형 MCP id가 꺼진 상태에서 유효로 판정 |
| EP-16 / VP-16 | 문서가 현재 상태 | `IPC_CONTRACT.md:60,230,525` 행 삭제 · `arch/backend/background-tasks.md:25,27` 전체 중단 서술 정정 · `arch/frontend/layers.md:72` · `ux-domains.md:108` · `design-components.md:316` · `design-system.md:173` camera 서술 정정 · `generated/inventory.md` 재생성 = 8 | `rg -n 'stopAllBackgroundTasks\|artifact:openFolder\|provider:list\|features/camera' docs -g '!handoff/**' -g '!archive/**' -g '!etc/**'` → 0건 | 문서가 없는 채널·feature를 안내 |

- **선언 경계**:
  1. `background-tasks.md`의 "원본 출력 읽기" 서술과 `readBackgroundOutput` 사슬은 D-011이 닫힐 때까지 그대로다 — EP-01·EP-16 검색에서 `readBackgroundOutput`은 대상이 아니다.
  2. VP-07에서 구 설정 파일의 `projectMcpChoices` 바이트가 디스크에 남는지 지워지는지는 정하지 않는다. 계약은 "로드 성공 · 다른 키 유지 · patch로 못 씀"이다.
  3. PRD §9의 카메라 향후 범위(`PRD.md:214`)는 고치지 않는다 — 제품 의도이고 구현 서술이 아니다.
  4. C-06 삭제로 고아가 되는 2차 심볼은 lint·typecheck가 보고하는 것만 지운다. 보고되지 않는 미사용 export는 0305 C-07(H-E) 범위다.
  5. EP-11·EP-12·EP-14의 "필수"는 타입 계약이다. `as never`·부분 캐스트로 조립한 테스트가 런타임에 `undefined`를 넘기는 것까지 막지는 않는다 — 그런 조립은 typecheck:test가 보고하는 것만 고친다.
- 열린 입력 집합을 판정하는 산출물: 해당 없음.
- 같은 규칙의 SSOT: 어댑터 선택 = `selectTurnAdapter` 한 곳 · 컨텍스트 정책 = `contextSession` 한 곳.
- 선택적 필드의 의미: 이번 변경 뒤 EP-11·12·14의 필드는 `undefined`를 받지 않는다. `activeRequirementId`는 `string | null` 필수다(`null` = 선택 없음).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

구현은 묶음별 커밋 3개로 나눈다(D-007). 묶음 안에서도 후보 단위로 게이트(lint·typecheck)를 돌린다.

| 단계 | 변경/신규 파일 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| M1 (H-A) | `shared/{ipc,protocol,background-task,artifacts,logging,plugin-catalog}.ts` · `preload/index.ts` · `renderer/…/api/ipc.ts` · `main/app/chat-turn/{background,send}.ts` · `main/features/chat/background-controller.ts` · `main/app/handlers/{artifacts,providers}.ts` · `renderer/…/features/camera/**` · C-06 선언 파일 · `infra/db/types.ts` · `lib/parts.ts` · 두 하네스 `AssistantSegment.tsx` · `StructuredOutputCard.tsx` · `registry.ts` · `chatStore.ts` · i18n ko/en · 문서 EP-16 | EP-01~08·16 삭제 | 기존 테스트 + `protocol` 스키마 케이스 |
| M2 (H-B) | `main/app/chat-turn/{admission,send,deps,resolve-turn}.ts` · `main/app/{context}.ts` · `main/app/handlers/{misc,engine,files}.ts` · `main/features/auth/login.ts` | EP-09~12 | `admission.test.ts`(순수) · `files.contextDirectory.test.ts` · `login.test.ts` · `misc.runtime-catalog.test.ts` · resolve-turn 테스트 |
| M3 (H-K) | `main/features/plugins/mail/{sync-manager,types,tools}.ts` · `rightpanel/{DiffReview,FileDiffSection}.tsx` · `composer/ComposerInputController.tsx` | EP-13~15 | 기존 메일·diff·컴포저 테스트 |

구현 규칙:

- 삭제는 표적만 한다. 표적을 지워 미사용이 된 import·지역 헬퍼·타입은 lint/typecheck가 가리키는 대로 따라 지운다(`stopAll`이 혼자 쓰던 헬퍼 등). 따라 지운 것은 구현 보고에 나열한다.
- 테스트는 지우는 능력만 단언하던 케이스를 삭제하고, 유지 동작을 함께 보던 케이스는 유지 동작 단언만 남긴다. 삭제한 케이스 수를 파일별로 보고한다.
- C-13 테스트 조립: fallback 분기에 기대던 테스트는 `HarnessRuntimeConfigService`·`RuntimeModelCatalog` 포트의 fake를 준다. fake는 `resolve`·`cached`·`isReadOnly`·`merge`·`invalidate`만 구현하고, 공용 fixture 1개로 둔다(테스트 파일마다 복붙 금지).
- `sync(signal, mode)`로 시그니처가 바뀐다 — 2번째 자리가 `mode`다. 테스트 47호출의 `undefined` 자리 인자를 지운다.

### 테스트 가능성

- 순수 파일: `admission.ts`(이미 순수 — electron import 없음). `selectTurnAdapter`는 `SessionAdapter` 타입만 import한다.
- 기존 메커니즘 재사용: `providers.test.ts`·`artifacts.test.ts`의 "등록 집합 = CHANNELS 도메인 전수" 케이스가 채널 삭제의 양쪽 누락(상수만 지움·핸들러만 지움)을 잡는다.
- 순서 관측: 해당 없음.

## 12. End-to-end 영향

### producer → consumer

```text
shared CHANNELS/스키마 → preload window.oo → renderer api 래퍼 → (소비자 0)   ← 삭제
bootstrap ctx → handlers/misc · chat-turn/resolve-turn · handlers/engine          ← 필수화
```

- producer 기준: preload가 내보내는 `OoApi` 타입에서 메서드 3개가 빠진다.
- consumer 파생 규칙: `window.oo` 타입 선언(`OoApi`)을 쓰는 renderer 코드는 typecheck:web이 전수 확인한다.
- 합성값의 정본 우회: 해당 없음.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| 핸들러 등록 집합 테스트(provider·artifact·chat) | 채널 수 −3 | AC2·AC3 |
| `docs/generated/inventory.md` | 채널·feature 수 변경 | AC16 |
| `scripts/check-product-naming.mjs` `ALLOWED` | 삭제 파일에 등록 항목이 있으면 개수 변경 | AC18 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 변화 없음.
- 취소/중단: 전체-중단 게이트 삭제. 개별 중단·응답 취소는 그대로.
- 종료/quit: `Scheduler.stopAll`은 다른 심볼이다 — EP-01 검색 술어(`controller\.stopAll`·`stopAllBackgroundTasks`)에 걸리지 않는다.
- retry/timeout/partial failure: 변화 없음.
- **다중 저장소 쓰기**: 코드 동작은 해당 없음. 문서 상태 사본은 `plan.md` 메타 · `INDEX.md` 보드 · 0305 보드 행 비고 3곳이다 — 이번 설계 커밋이 셋을 함께 쓴다.

## 14. 성능 / 상한 / 최적화

- 새 출력·요청: 없음.
- 구조적 목표: AC17은 상대 목표(prod 순감, test 순증 없음)다. 절대 줄 수는 약속하지 않는다 — 0305 추정은 범위가 달라 승계하지 않았다.
- 호출 축소로 잃는 부수 효과: C-39는 `nativePluginMentions` 호출 2회를 줄인다 — 순수 함수라 부수 효과 없음(`useMemo` 의존성은 `observedPlugins`로 바뀐다).

## 15. 외부 구현 포트 / 문서 계약

- 폐쇄망 포크가 구현하는 `app/deployment/*`는 `LoginService` deps·`RouterContext`를 직접 만들지 않는다 — `rg -n 'new LoginService\|harnessRuntime' main/app/deployment -g '!*.test.*'`로 구현 턴에 0건을 확인하고, 0이 아니면 PLAN_GAP으로 돌린다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 전체 중단·원본 출력 읽기 API를 main·preload에 남긴다 | `background-tasks.md:25` (0231) | §10 EP-01 · 선언 경계 1 | 전체 중단만 변경(D-002), 읽기는 유지(D-011) |
| 0225 이관 코드 유지 | 0292 | §3 D-003 | 변경 승인 — 실행은 H-C |
| 직접 호출 금지(`api/ipc.ts` 래퍼 경유) | `arch/frontend/state.md:120-121` | §3 D-004 | 유지 |
| 구 모델 표시 fallback | 0231 plan | §3 D-004 · D-009 | 유지 |
| 런타임 관리 key는 캐시만 읽는다 | 0291 D-008 (`resolve-turn.ts:274` 주석) | §10 EP-12 실패 의미 | 유지 — VP-12가 잠근다 |
| manager 합류(0303 EP-04) | `mail.integration.test.ts:1139` | §3 D-010 | 유지 |
| 판정과 발신을 섞지 않는다 | `app/src/main/AGENTS.md` | §9 `selectTurnAdapter` | 준수 — 오류 발신은 `send.ts`에 남는다 |
| 마이그레이션 append-only | `app/AGENTS.md` | §10 EP-06 허용 예외 | 준수 |
| 채널 변경 시 `IPC_CONTRACT.md` 동시 갱신 | `docs/AGENTS.md` 6 | §10 EP-16 | 준수 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| C-13으로 테스트 조립 수정이 넓어져 test 줄이 는다 | 공용 fake 1개 · AC17 test 조건 · 순증이면 보고 |
| 스키마 base를 접다가 `generation` 검증을 잃는다 | VP-01의 스키마 거부 케이스 |
| 구 설정 파일 로드 실패 | VP-07 |
| preload API 축소가 외부 소비자를 깬다 | 소비자는 번들된 renderer뿐 — typecheck:web 전수 |
| mock 분기 이동으로 개발 빌드 재생이 깨진다 | VP-09 4입력 + AC19 실기 |

- 되돌리기 어려운 결정: 없음 — 저장 포맷·공개 계약 변경 없음(preload는 내부 계약).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/**` — §11 표.
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/background-tasks.md` · `docs/arch/frontend/{layers,ux-domains,design-components,design-system}.md` · `docs/generated/inventory.md`.
- `docs/handoff/INDEX.md` · 이 plan.

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` §better-sqlite3 ABI · 제약 환경 게이트 가이드, §로컬 확인.
- 환경 제약: egress 차단이면 Electron ABI·DB 로드 스위트는 알려진 서명으로 분리 보고한다. 기준선은 설계 커밋에서 같은 명령의 실패 집합이다.
- 후보 단위(수정 루프): `cd app && npm run lint && npm run typecheck` + 관련 스위트 `./node_modules/.bin/vitest run <suite>`.
- IMPL_DONE 전 전체: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs`.
- 사람 실기(AC19): 개발 빌드에서 디버그 패널 mock 켜고 전송 → 재생 확인 · 백그라운드 작업 개별 중단 · 산출물 탐색기에서 보기 · 변경사항 패널에서 요구사항 추가·선택·삭제 · @ 멘션 자동완성 · 로그인 게이트 단계 표시.

## READY self-review

- [x] Decision Ledger가 이번 세션 답 4건과 0305 상속 결정을 보존한다 — D-001~D-007.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §5 상태 표.
- [x] 조건절·이유절을 재해석하지 않았다 — 범위 답과 승인 답의 교집합은 §2 추론 행으로 분리 표기.
- [x] 사용자 결정과 코드 사실을 구분했다 — D-011만 OPEN, D-008~D-010은 근거와 함께 설계자 판단으로 표기.
- [x] Technical Design에 AS-IS·TO-BE·Delta가 같은 축으로 있다 — §9.
- [x] 수치·전칭·기존 테스트 인용을 실측했다 — §8.
- [x] 각 AC가 행동 단언·검증 수단·도달 경로를 가진다 — §7.
- [x] Baseline V이고 NEW node마다 같은 레벨 REQUIRED pair가 있다 — §7-A.
- [x] pair마다 path·§10 자리·검색 명령·oracle 좌표가 있고 적대 증거는 VP-01·11·12·13·14만 선택 이유와 함께 등록했다.
- [x] 규칙 칸 분기 ↔ 입력: `selectTurnAdapter` 3규칙 ↔ VP-09 4입력+1 · 컨텍스트 가드 3분기 ↔ VP-10 3입력 · 런타임 구성 3분기 ↔ VP-12 3입력 · `includeManagedMcp` 2분기 ↔ VP-15 2입력.
- [x] 선언 경계 5건을 §10에 적었다. 열린 입력 집합 산출물 없음.
- [x] INDEX 후보 표 겹침 확인 — 0296 행, 형태 다름(§8).
- [x] 운영 gate 열거 — §7-A · §19.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC19는 Electron 실행만.
- [x] structural proxy만으로 닫는 semantic AC 없음 — 음성 검색은 "없다" 불변식에만 쓰고 유지 동작은 행동 테스트가 본다.
- [x] 자리를 말하는 불변식의 맞바꿈: VP-11 원인 값 · VP-12 인자 · VP-14 콜백.
- [x] 신규 계약의 SSOT·강제 지점·seam — `selectTurnAdapter`(§9·EP-09·`admission.test.ts`).
- [x] 등록 변경의 기존 소비처 — §12.
- [x] 게이트 명령이 `app/AGENTS.md`와 일치 — §19.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md). 필드는 [`plan.template.md`](../../../.agents/skills/handoff-plan/plan.template.md)의 `[구현자 기입]` 절을 그대로 쓴다.

## [구현자 기입] 설계 리뷰

## [구현자 기입] 강제 지점 전수 (§10 대조)

## [구현자 기입] 이번 라운드 수정의 잠금

## [구현자 기입] Product/UX 파생 검토

## [구현자 기입] 놓친 잠재 문제 + 대응

## [구현자 기입] 구현 보고

## [구현자 기입] Review Signals — 사실만

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
