# Plan — runtime-model-catalog

## 메타

| 항목 | 값 |
|---|---|
| slug | `0198-runtime-model-catalog` |
| 작성자 | Codex |
| 일자 | 2026-08-24 |
| 매핑 | 런타임 모델 카탈로그 자동 투영 |
| 상태 | DRAFT → READY → IMPL_DONE (r1) → IMPL_DONE (r2) → verify/FAIL (r2) → IMPL_DONE (r3) → verify/FAIL (r3) → IMPL_DONE (r4) → verify/FAIL (r4) → IMPL_DONE (r5) → verify/FAIL (r5) → READY (r6) → IMPL_DONE (r6) → verify/FAIL (r6) → READY (r7) → IMPL_DONE (r7) → verify/FAIL (r7) → READY (r8) → IMPL_DONE (r8) → verify/FAIL (r8) → IMPL_DONE (r9, 부분) → verify/FAIL (r9) → READY (r10) → IMPL_DONE (r10) → **verify/PASS (r10)** |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 현재 모델 목록은 settings 디렉터리 파싱 결과만 보므로 Claude Code의 정확한 `availableModels: string[]`와 인증 뒤 Harness Runtime이 제공하는 LLM이 UI에 자동 반영되지 않는다.
- 완료 후 달라지는 것: 정적 설정 또는 동적 runtime config에서 발견한 `availableModels`와 인증된 Harness LLM을 하나의 파생 카탈로그로 투영하고, 원천이 사라지면 해당 자동 항목도 제거한다.
- 성공을 사용자 관점에서 한 문장으로: 사용자는 환경이나 로그인 상태가 제공하는 실제 모델만 엔진 & 모델과 Composer에서 동시에 보고 선택한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `availableModels`의 철자·대소문자·camelCase를 그대로 지키며 타입은 `string[]`이다. | 사용자 후속 결정 |
| 명시 요구 | 이름에 sonnet/opus/haiku가 포함되면 해당 family, 아니면 custom family이며 custom fallback은 self다. | 최초 사용자 요청 |
| 명시 요구 | 환경 모델과 인증된 Harness Runtime LLM을 두 UI에 자동 투영하고 원본 소멸 시 자동 제거한다. | 최초 사용자 요청 |
| 명시 요구 | Harness 인증 성공 시 자동 등록하고 실패·unavailable·해제 시 제거하며, 앱 로그인 자동 인증에도 같은 규칙을 쓴다. | 최초 사용자 요청 |
| 명시 요구 | Engine & Models에 자동 추가된 Orca Harness 항목은 앱 사용자가 편집할 수 없고 인증 hook/lifecycle을 polling보다 우선한다. | 최초 요청 + 사용자 후속 결정 |
| 추론 의도 | “Harness Runtime LLM 자동 등록”은 기존 settings provider에 모델만 합치는 것이 아니라 인증된 runtime contribution 자체를 카드로 생성·제거하는 요구다. | 사용자의 “새로운 요구사항을 확인하라” 정정 + 최초 흐름도 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 입력 필드 이름과 타입은 정확히 `availableModels: string[]`이다. | 대소문자·띄어쓰기·camelCase를 변경하지 않는다. | 사용자 후속 결정 | ACTIVE | — |
| D-002 | 모델명은 case-insensitive로 sonnet → opus → haiku 순의 첫 일치 family 또는 `custom`으로 분류하되, 같은 family의 `availableModels` 항목을 모두 보존한다. | opus/sonnet/haiku도 배열에 따라 복수 모델일 수 있으므로 family alias 중복을 제거 근거로 쓰지 않는다. | 최초 요구 + 사용자 후속 결정 | ACTIVE | — |
| D-003 | custom 모델은 family 표시를 `custom`, 실제 모델명과 선택·실행·fallback 값은 자기 모델명(self)으로 둔다. | family 표기와 실행 식별자를 분리하며 custom을 실행 alias로 넘기지 않는다. | 최초 요청 + 사용자 후속 결정 | ACTIVE | — |
| D-004 | 정적 settings와 동적 Harness runtime config의 모델을 같은 정규화 함수로 카탈로그에 투영한다. | Engine과 Composer의 결과가 갈리지 않아야 한다. | 최초 사용자 요청 | ACTIVE | — |
| D-005 | Harness 인증 성공은 Engine & Models에 앱 사용자가 편집할 수 없는 read-only Orca Harness 항목을 생성하고 실패·unavailable·해제는 제거한다. | UI 상태가 아니라 실제 Auth 파생 상태이며 renderer와 main mutation 경계 모두 편집을 막는다. | 최초 요청 + 사용자 후속 결정 | ACTIVE | — |
| D-006 | 기존 `AuthRuntime.subscribe` snapshot lifecycle을 트리거로 쓰고 polling·별도 영속 상태를 만들지 않는다. | 앱 로그인 자동 인증도 같은 event path를 지난다. | 최초 사용자 요청 | ACTIVE | — |
| D-007 | 두 UI는 같은 `orca:agent:list` 카탈로그를 소비한다. | 자동 등록 결과의 동일 반영. | 최초 사용자 요청 + 현행 IPC | ACTIVE | — |
| D-008 | runtime contribution fetch는 Gate 로그인 인증 성공 시 contribution별 1회만 수행하고, 새 세션 생성·턴 실행은 cache만 읽는다. Auth 밖 설정 변경이 cache를 무효화하면 같은 canonical key의 settings 행을 포함한 자동 항목 전체를 두 UI에서 숨긴다. **fetch 횟수 조항은 0202 D-004가 대체한다** — 명시적 invalidate 1회당 replay 1회가 추가된다. cache-only 읽기와 미노출 조항은 그대로 ACTIVE다. | Gate 인증을 권위 트리거로 쓰며 세션마다 network 요청할 수 없다. 사용자는 D18에서 재fetch보다 fail-closed 미노출을 선택했다. | 사용자 후속 결정 (2026-08-24) + D25 정정 | **부분 SUPERSEDED** | 0202 D-004 (fetch 횟수 조항만) |
| D-009 | 부팅 deploy 무효화는 Auth 구독·resume·catalog attach보다 먼저 완료하고, 그 뒤 Gate 자동 인증 snapshot이 부팅 세션의 최종 runtime contribution을 만든다. | 일반 설정 변경의 fail-closed 의미를 유지하면서 Gate 인증 fetch 결과가 뒤늦은 부팅 무효화에 지워지는 비결정성을 없앤다. | 사용자 `/handoff-plan` 갱신 지시 (2026-08-25) | ACTIVE | — |
| D-010 | 컴포지션 seam(`bootstrap.ts`가 helper에 무엇을 넘겼는가)은 순서 단언이 아니라 **유일성 가드 + 실재(양성) 가드**로 강제한다 — `auth.subscribe(`를 부르는 production 파일은 하나이고 배포 선언은 변형 없이 넘어가며, **정의 파일을 제외한 production 호출 파일이 `startRuntimeModelCatalogAfterDeploy(`·`createRuntimeModelAuthResume(` 각각 `['bootstrap.ts']`다**(후자가 M-P·M-Q 소멸 축을 함께 덮는다 — verify r9 §8). 음성 술어는 수신자 이름 `auth`에 묶인 현 폭을 유지한다 — production `.subscribe(` 5좌표 중 `auth.` 수신자 2좌표(전부 helper 안), 나머지 3좌표는 queue·backgroundTasks·leases로 Auth 불변식 밖, 차집합 0(D46 · r10 설계 턴 재측정). 순서·동작은 주입 테스트가 계속 맡는다. | `bootstrap.ts`는 `@electron-toolkit/utils`의 CJS `require('electron')` 때문에 vitest가 열지 못한다(verify r7 §8 실측). 저장소는 같은 문제를 음성 소스 스윕으로 이미 두 번 풀었다(`no-node-fetch.test.ts`·`no-cookie-token.test.ts`). **음성 스윕은 "없다"만 잠근다** — 배선의 실재는 X를 지웠을 때 실패하는 양성 단언만 잠근다(verify r8 M-P·r9 M-Q 실측). | 설계 정정 (verify r7 D41 → r8 D44 · r9 D47, 사용자 결정 아님) | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-009는 부팅 deploy 무효화를 Auth 구독·resume·catalog attach보다 먼저 완료한다.
- D35 정정(설계, 사용자 결정 변경 아님): D-009가 열어 둔 **세 항목 사이의 순서**를 `attach < 구독 < resume`으로 §7·§10·§13에 고정했다. D-009 문면은 그대로 ACTIVE다.
- D44·D46·D47 정정(설계 r10, 사용자 결정 변경 아님): **D-010에 양성 실재 술어 2심볼을 명기**하고 §10 부팅 시퀀스 행을 2→4지점(**분모 30→32**)으로 늘렸다. 같은 행 실패 의미의 "호출 소멸은 `noUnusedLocals`가 red로 만든다"(r7 M-J, 정리 1단계 관측)를 실측(M-P 3단계·M-Q 4단계에 초록 수렴 — verify r8 §4·r9 §4)으로 교체했다(D44 ①). D46 술어 폭은 이번 세션 재측정(production `.subscribe(` 5좌표 = `runtime-model-startup.ts:66,67` + `session-activity-projector.ts:38,39,40`, `auth.` 수신자는 앞의 2좌표뿐)으로 현 폭을 유지한다.
- AC11 재게이트(r10 정정분, §5 게이트 재통과): 동작 기준·프로덕션 도달 경로 불변, 검증 수단에 양성 실재 술어를 추가했다. 불변식 "listener가 설치된다"의 장치가 설치를 지운 변이(M-Q)에서 `[]`로 실패한다 — 여분 사본·잔여물 반응이 아니다. `ACTIVE 결정 ↔ AC` 대조: D-010↔AC11(검증 수단)·§10 부팅 시퀀스 4지점 — 충돌 0, 나머지 매핑(D-001~D-009) 불변.
- D41 정정(설계, 사용자 결정 변경 아님): **D-010을 신설**했다. D35가 배제한 것은 *존재 확인 소스 검사를 순서 근거로 쓰는 것*이고, 유일성을 단언하는 음성 스윕은 다른 장치다 — AC11 검증 수단과 §10 부팅 시퀀스 행의 2번째 지점을 그 장치로 바꿨다. vitest에 electron alias를 두는 대안은 `src/main/AGENTS.md`가 P29로 잠근 "electron 무는 3파일은 import하면 즉시 죽는다"를 약화시켜 채택하지 않았다.
- D18·D25 정정: Auth 밖 설정 무효화는 runtime cache와 같은 canonical key의 settings 행을 포함한 자동 항목 전체를 함께 숨긴다. 설정 CRUD는 자동 재fetch하지 않는다.
- 변경된 결정: D-002는 같은 family 복수 항목 보존으로, D-003은 `custom` 분류 표기와 self 실행 식별자의 분리로 보완했다. D-005는 자동 추가된 Orca Harness의 앱 사용자 편집 금지를 renderer와 main 양쪽 계약으로 강화했다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001·D-002·D-004·D-006·D-007.
- **§10 분모가 28 → 30으로 바뀌었다**: cache 수명 행이 4 → 6지점(읽기 소비처 `misc.ts:45`·`turn-setup.ts:58` 추가 — verify r7이 "표 밖 지점"으로 관측한 자리다). 다른 행은 불변이고 AC 총수는 14로 불변이다. r8 합계는 이전 라운드와 직접 비교하지 않는다.
- **정합성 게이트 관측**: 부팅 순서를 서술하는 3곳(§5 상태 전이표·§7 주의사항·§13 생성/시작)이 `deploy 무효화 → attach → 구독 → resume`으로 같은 말을 한다. 이번 턴이 인용한 경로 4건(`infra/source-scan.ts`·`no-node-fetch.test.ts`·`no-cookie-token.test.ts`·`src/main/AGENTS.md §원격 요청은 Chromium 스택으로만`)과 좌표 3건(`bootstrap.ts:394-396`·`:465`, `store.ts:154`, `runtime-catalog.ts:73`)은 실재를 확인했다 — 앞의 두 좌표는 r7 diff로 밀려 이번에 교정했다.
- **AC11 재게이트(§5)**: 동작 기준·프로덕션 도달 경로 불변, 검증 수단만 교체했다. 유일성 가드는 structural proxy가 아니라 **단언 대상 그 자체**다 — "다른 설치 경로가 없다"가 성립해야 helper의 순서 단언이 부팅 순서를 뜻한다. 순서라는 semantic 목표는 여전히 주입 관측이 진다.
- `ACTIVE 결정 ↔ AC` 대조: D-001↔AC1, D-002·D-003↔AC2·AC3, D-004↔AC4, D-005·D-006↔AC5~AC8, D-007↔AC9·AC10, D-008↔AC5~AC8·AC13, D-009↔AC11, D-010↔AC11(검증 수단)·§10 2행 — 충돌 0. D-010은 D-006(`AuthRuntime.subscribe`가 유일 트리거)을 강화하며 어긋나지 않는다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | `agent:list`가 settings 디렉터리만 열거해 runtime config와 Auth 상태를 보지 않는다(`app/src/main/app/handlers/misc.ts:35-42`). |
| 이미 기존 코드가 충족하는가 | 부분 충족 | 두 UI는 이미 같은 `AgentEnvironment[]`를 소비하지만 parser는 고정 3 family만 표현한다(`model-parser.ts:11-30`). |
| 더 작은 해법이 있는가 | 모델 병합만으로는 불충분 | 사용자는 인증 성공 시 LLM 항목 등록과 실패 시 제거를 요구했으므로 기존 카드에 모델만 붙이면 lifecycle·read-only 계약을 잃는다. |
| 선행 자료의 주장을 코드와 대조했는가 | 대조 완료 | runtime augmenter는 현재 env만 반환하고 catalog가 아니며(`runtime-config.ts:45-67`), Auth snapshot hook은 이미 존재한다(`bootstrap.ts:373-385`). |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 의도적 변경 | settings 디렉터리 단독 SSOT라는 0188 주석을 확장한다. 사용자의 새 runtime catalog 요구가 변경 근거다. |

- 사용자에게 올릴 결정: 없음. 사용자의 2026-08-25 갱신 지시는 D24의 권장안인 부팅 deploy 선행 순서를 채택한 것으로 기록했다.
- 코드 조사로 닫은 사실: `availableModels`는 OS subprocess env 문자열로 직렬화하지 않고 Harness native settings/runtime config의 정확한 배열 필드로 운반해야 현재 타입 안전성을 보존한다.

## 5. 동작 / 사용자 흐름

```text
ANTHROPIC_DEFAULT_<FAMILY>_MODEL
  → 먼저 family 기본 항목 구성
settings.availableModels 또는 runtimeConfig.availableModels
  → trim·빈 값 제거·모델명 중복 제거·family 분류 후 순서대로 추가
  → 파생 모델 카탈로그
  → Engine & Models + Composer model selector

Plugin/App login → Auth snapshot
  → verified 성공 → contribution fetch 1회 → process-memory cache → read-only Orca Harness 등록
  ↘ 실패/unavailable/revoke/unauthorized → contribution 제거
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 정적 `availableModels` 존재 | `ANTHROPIC_DEFAULT_<FAMILY>_MODEL` 항목을 먼저 구성하고 배열 항목을 stable order로 추가한다. | 같은 family의 복수 모델과 custom 모델이 두 UI에 모두 보인다. |
| Gate 인증 snapshot이 `verified:true`이고 usable | 해당 Auth의 Harness contribution을 로그인 lifecycle에서 1회 fetch하고 process-memory cache에 publish한다. | read-only Orca Harness 카드와 Composer 선택지가 나타난다. |
| 인증 실패·unavailable·revoke·401/403 | 해당 Auth contribution을 무효화하고 카탈로그에서 제외한다. | 자동 카드와 Composer 선택지가 함께 사라진다. |
| 새 세션 생성·턴 실행 | network resolve를 호출하지 않고 로그인 때 채운 cache snapshot을 읽는다. | 모델 선택과 실행 준비가 추가 fetch 없이 동작한다. |
| 재인증 성공 | 기존 cache를 무효화하고 해당 Gate 로그인의 fetch 1회 결과만 채택한다. | 최신 모델 목록이 다시 나타나며 stale 결과가 되살아나지 않는다. |
| 앱 재시작 | 부팅 deploy 무효화를 먼저 끝내고 catalog attach → Auth 구독 → resume 순으로 설치한 뒤 Gate 자동 인증 결과를 반영한다. | 저장 grant만으로는 노출되지 않고 verified fetch 뒤 자동 항목이 결정적으로 나타난다. |
| Auth 밖 설정 변경으로 contribution cache 무효화 | 같은 canonical key의 runtime entry와 settings 행을 함께 catalog에서 제외한다. | 두 UI에서 자동 항목이 사라지고 실행만 실패하는 유령 행이나 편집 버튼이 남지 않는다. |

### 파생 UX / 엣지케이스

- loading / empty / error: resolve 중에는 이전 인증 결과를 새 성공으로 간주하지 않는다. 실패는 자동 항목 미노출이며 기존 사용자 설정 카드는 유지한다.
- cancel / retry / close / restart: fetch 취소·실패 결과는 cache에 넣지 않는다. 재시작 시 영속 grant만으로 노출하지 않고 Gate 자동 인증 성공에서 다시 1회 fetch한다.
- concurrency / multi-session: 동일 Gate 로그인 안의 중복 성공 이벤트는 single-flight/cache로 1회 fetch에 합류한다. 새 세션 수와 무관하게 network 호출 수는 늘지 않으며 늦은 옛 성공은 generation fence로 폐기한다.
- keyboard / a11y / theme: read-only 카드는 편집·삭제 버튼을 disabled로 남기지 않고 동작 버튼 자체를 숨기며 읽기 전용 배지를 텍스트로 표시한다.
- 외부환경/오프라인/폐쇄망: 네트워크 unavailable은 자동 항목 제거로 수렴하며 polling이나 외부 서비스 의존성을 추가하지 않는다.

## 6. 범위 / 비범위

- **범위**: `availableModels` 정규화, family/custom/self fallback, 정적+runtime catalog 합성, Auth lifecycle 기반 동적 등록·제거, IPC provenance/read-only 계약, Engine과 Composer 반영, 관련 문서·테스트.
- **비범위**: 새로운 인증 방법, polling, 모델 카탈로그 DB 영속, 사용자가 runtime 자동 항목을 편집하는 우회 채널, OpenCode 지원, SDK에 없는 별도 모델 discovery API.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 모델별 표시명·가격·context metadata | 아니오 | 후속 |
| 다중 family 문자열의 별도 우선순위 UI | 아니오 | D-002의 결정적 순서로 처리 |

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | 정확한 `availableModels` 배열만 입력으로 인정하며 유사 철자·비배열은 자동 모델을 만들지 않는다. | 계약/단위 테스트: exact key·array 성공, casing 오타·문자열·혼합 타입 거부 | settings/augmenter → parser |
| AC2 | 모델명 포함 식별자로 sonnet·opus·haiku·custom을 결정적으로 분류하고 같은 family의 복수 모델을 모두 보존한다. | 순수 단위 테스트: 대소문자, 부분 포함, 무일치, 복수 식별자, 동일 family N개 | parser → catalog |
| AC3 | custom 모델은 두 UI에서 `custom`으로 분류되고 실제 모델명을 함께 표시하며 선택·실행·fallback은 자기 모델명이다. | renderer+순수+turn setup 테스트: family 라벨과 실제 모델명, self 선택값이 adapter 요청에 전달 | catalog → ModelMenu → chat send → model resolution |
| AC14 | settings에서는 `ANTHROPIC_DEFAULT_<FAMILY>_MODEL` 항목을 먼저 구성한 뒤 `availableModels` 항목을 배열 순서대로 추가한다. | parser 단위 테스트: env 기본 항목 선행, 모델명 중복만 제거, 같은 family 추가 항목 보존 | settings env + availableModels → parser |
| AC4 | 정적 settings와 runtime config가 같은 중복 제거·분류·기본 선택 규칙을 쓴다. | 단위 테스트: 같은 배열이 양 producer에서 동일 `AgentModelView` 생성 | 두 producer → shared normalizer |
| AC5 | 인증 성공한 Harness LLM은 settings 디렉터리 유무와 무관하게 앱 사용자가 편집할 수 없는 read-only Orca Harness로 등록되고, contribution cache가 무효화되면 같은 canonical key의 settings 행까지 미노출된다. | catalog+renderer+IPC 테스트: 등록 중 카드 액션 부재·mutation reject, 무효화 뒤 두 UI 목록과 mutation 후보에서 key 부재 | Auth subscribe → runtime catalog → agent:list/engine IPC |
| AC6 | 수동·자동 Gate 로그인은 각각 인증 성공 시 contribution fetch를 정확히 1회 수행하고 같은 등록 경로를 쓴다. | auth-resume 배선 테스트: 로그인당 fetch 1회, 중복 verified 이벤트는 추가 호출 0 | authResume/login → AuthChange → fetch/cache |
| AC7 | revoke·expired·unauthorized·unavailable·resolve 실패 또는 Auth 밖 cache 무효화 시 영향받은 canonical contribution key만 제거된다. 충돌하지 않는 사용자 설정 entry는 보존한다. | 상태 전이 테스트: 원인별 제거, 같은 key의 settings 행 미노출, 다른 key의 사용자 설정 entry 보존 | AuthChange/runtime failure/settings invalidation → catalog |
| AC8 | Gate 로그인 fetch의 무효화 전 시작한 늦은 성공은 자동 entry를 되살리지 않고 재인증은 새 fetch 1회만 허용한다. | deferred promise 통합 테스트: invalidate 뒤 stale completion 폐기와 세대별 호출 수 | Auth subscribe → single-flight/cache → generation fence |
| AC9 | Engine & Models는 자동 Orca Harness를 표시하되 앱 사용자에게 편집·삭제 액션을 제공하지 않고 직접 IPC mutation도 거부한다. | renderer 컴포넌트 테스트 + 사람 시각 확인 | agentStore → AgentEnvironmentView |
| AC10 | Composer는 Engine과 같은 자동·정적 모델 집합을 표시하고 사라진 선택은 유효한 기본값으로 재화해한다. | selector/store 테스트: 동일 입력 집합, 제거 후 stale selection 미전송 | agentStore → ModelMenu/chat store |
| AC11 | 앱 재시작 때 부팅 deploy 무효화를 Auth 구독·resume·catalog attach보다 먼저 끝낸다. 저장 grant만으로는 자동 entry를 노출하지 않고 Gate 자동 인증 성공 뒤 contribution을 1회 fetch해 최종 catalog에 유지한다. | bootstrap 순서 테스트 + 상태 기계 테스트: deploy invalidation 선행, restore 전 0회, verified 후 1회와 최종 entry 존재. **순서 단언은 주입된 관측 주체가 실행 순서를 기록해 내린다 — 호출의 *존재*만 보는 소스 문자열 검사(`readFileSync`+`toContain`)는 순서를 보지 못하므로 이 AC의 순서 근거가 아니다**(D35 정정). **컴포지션 seam은 순서가 아니라 유일성 + 실재로 강제한다 — `auth.subscribe(`를 부르는 production 파일이 `runtime-model-startup.ts` 하나임을 음성 소스 스윕으로, 정의 파일 제외 `startRuntimeModelCatalogAfterDeploy(`·`createRuntimeModelAuthResume(` production 호출 파일이 각각 `['bootstrap.ts']`임을 양성 소스 스윕으로 단언한다**(D-010, D44·D47 정정) | deploy invalidation → catalog attach → Auth subscribe/resume → fetch/cache |
| AC12 | 기존 settings 기반 모델 CRUD와 기본 sonnet/opus/haiku 동작은 회귀하지 않는다. | 기존 parser/settings/engine 테스트 + 정적 게이트 | engine IPC → deploy → agent:list |
| AC13 | 로그인 후 새 세션을 여러 개 만들고 턴을 실행해도 contribution fetch 호출 수는 증가하지 않고 cache snapshot만 사용한다. | 통합 테스트: Gate 로그인 1회 + 세션 N개 + 턴 M개에서 fetch 총 1회 | Gate login → cache → session/turn setup |

### AC 검증 주의사항

- 기존 테스트 재사용: `settings.test.ts`의 `toAgentEnvironments`와 parser 테스트, `runtime-config.test.ts`의 generation fence, auth resume 테스트가 존재하지만 동적 catalog 의미는 신규 케이스로 추가한다.
- 사람 실기 항목: AC9의 실제 배지·버튼 부재와 두 테마만 시각 확인한다. 목록/분류/read-only 판정은 자동 테스트로 내린다.
- 순서 기준(D35 정정): **부팅 deploy 무효화 완료 < catalog attach < Auth 구독 < `authResume.run()`** 순서를 고정한다. attach를 `authResume.run()` 뒤에 두면 probe가 먼저 verified가 됐을 때 `await bridge.attach()`가 `runtime.resolve` 네트워크 왕복을 부팅 경로에서 기다린다 — `bootstrap.ts:394-396`의 "네트워크 왕복이라 부팅을 붙들면 안 되고"를 어기는 순서다. attach 시점에는 복원 grant가 아직 `verified:false`이므로(`features/auth/store.ts:154,206`) `reconcile`이 `runtime-catalog.ts:73`에서 즉시 반환해 fetch가 없다. fetch 관측점은 Gate 로그인 성공 hook 하나이며 session/turn setup spy에서 network 호출 0을 함께 단언한다.
- **컴포지션 유일성 + 실재(D-010)**: 순서는 helper 안에서 주입 관측으로 잠기고, "`bootstrap.ts`가 그 helper를 실제로 쓰는가"는 **음성 스윕 2술어 + 양성 스윕 2술어**가 잠근다 — 음성: `src/main`에서 `auth.subscribe(` 호출 파일 1개(`runtime-model-startup.ts`)·`RUNTIME_MODEL_CONTRIBUTIONS.` 0건 / 양성: 정의 파일 제외 `startRuntimeModelCatalogAfterDeploy(`·`createRuntimeModelAuthResume(` production 호출 파일 각 `['bootstrap.ts']`(r10 설계 턴 재측정 — `bootstrap.ts:622`·`:629` 각 1건, import 식별자 행은 호출 형태 불일치로 제외). 장치 방향 — 음성은 여분 사본에, 양성은 소멸에 반응하므로 **소멸 변이(M-P·M-Q)는 양성 술어에 심어 검증한다**. 가드 자신은 `infra/source-scan.ts` 관용구를 따르고 **판정 지점 5종**(대상 집합·술어 4)에 자기 테스트를 둔다.
- 총량/0건 기준: 자동 entry 제거와 사용자 entry 보존을 함께 단언해 “전체 목록이 비어서 통과”하는 거짓 양성을 막는다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 모델 parser는 `ModelAlias='sonnet'|'opus'|'haiku'`와 ANTHROPIC_DEFAULT 환경 키만 안다. | `app/src/main/features/harnesses/claude/model-parser.ts:11-30,56-96` |
| agent 목록 원천은 settings tree뿐이고 handler는 동기 응답이다. | `app/src/main/app/handlers/misc.ts:35-42` |
| runtime augmenter 반환은 `runtimeEnv`와 `validUntil`뿐이며 generation cache가 이미 있다. | `app/src/main/features/harnesses/runtime-config.ts:45-67,91-115` |
| Auth lifecycle은 snapshot과 `verified`, `credentialChanged`를 분리해 방송한다. | `app/src/main/contracts/auth.ts:340-381` |
| Engine read-only 여부는 현재 adapter 문자열로 추측해 claude면 모두 수정 가능하다. | `app/src/renderer/src/features/engine/components/EngineCard.tsx:19-50` |
| 두 UI는 이미 같은 `AgentEnvironment[]` store를 소비한다. | `useEngines.ts`, `ModelMenu.tsx` |
| 외부 문서 조회 | 공식 사이트 검색 tool은 401이었으므로 사용자가 확정한 exact `availableModels: string[]` 계약을 권위 입력으로 삼는다. |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `AgentEnvironment` 직접 UI 소비 축 | `rg "AgentEnvironment" app/src/renderer/src/features` | 2 feature 축 | Engine과 chat selector가 동일 IPC DTO를 읽는다. |
| `agentList` main 등록 | `rg "CHANNELS.agentList" app/src/main` | 2 | handler 1, handler 등록 테스트 1이다. |
| Auth snapshot bootstrap 구독 | `rg "auth.subscribe" app/src/main/app/bootstrap.ts` | 2 | product sync 구독과 auth-resume 재평가 구독이다. |
| runtime config model 입력 | `rg "availableModels" app/src` | 0 | 신규 계약이므로 producer부터 consumer까지 추가해야 한다. |

### 수치 / 전칭 표현 검산

- 재측정 수치: `availableModels` 코드 소비 0건, main `agentList` 생산 handler 1건, renderer 소비 feature 축 2개.
- 내역 합 = 총계: Engine 1 + Composer 1 = UI 소비 축 2.
- “유일한” 반례 검색: `rg "CHANNELS.agentList" app/src/main`에서 production handler는 `handlers/misc.ts` 한 곳뿐이다.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `docs/arch/frontend/ux-domains.md §Agent/model UX`, `settings.test.ts`, `runtime-config.test.ts`, `auth-resume.test.ts` 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 현재 책임 소유자: settings tree가 provider 열거와 모델 parsing을 모두 소유하고 runtime config는 선택된 기존 key의 spawn env만 보강한다.
- 현재 경로: `listProviders` → `parseClaudeModels` → `toAgentEnvironments` → 동기 `agent:list` → agentStore → 두 UI.
- 현재 오류/정리 경로: runtime config 실패·Auth 해제는 cache invalidation만 하며 agent 목록에는 영향이 없다.
- 직접 원인: catalog가 Auth/runtime lifecycle을 구독하지 않고 DTO에 provenance/read-only가 없다.

```text
settings directory → fixed-family parser → agent:list → Engine + Composer
AuthChange → plugin sync / runtime cache invalidate ──X── model catalog
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 변경 후 책임 소유자: harnesses slice의 순수 model normalizer가 family/self-fallback을 소유하고, app composition의 runtime catalog reconciler가 Auth와 runtime config를 합성한다.
- 변경 후 경로: settings + verified runtime contributions → catalog snapshot → `agent:list` → 동일 agentStore → 두 UI.
- 오류/정리 경로: Auth unusable 또는 resolve failure는 contribution generation을 올리고 자동 snapshot을 제거한다. late completion은 기존 runtime generation fence와 catalog generation을 모두 통과해야 publish된다.
- 유지/대체: 기존 settings CRUD와 single `agent:list` consumer path는 유지하고 settings-only SSOT와 adapter 기반 mutation 추측은 provenance 계약으로 대체한다.

```text
settings.availableModels ─┐
                          ├→ normalizeAvailableModels → catalog snapshot → agent:list
AuthSnapshot → runtime contribution resolve ┘                         ├→ Engine(read-only)
                                                                     └→ Composer
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | settings parser 단독 | pure normalizer + app reconciler | 정적·동적 동일 규칙과 lifecycle 합성 | model parser/catalog · AC1~AC8 |
| data/control flow | 동기 settings 목록 | settings snapshot + async runtime snapshot | 인증 원천 소멸을 반영 | misc/bootstrap · AC5~AC8 |
| state/contract | provenance 없음 | `source:'settings'|'runtime'`, `readOnly` | UI가 문자열로 권한 추측 금지 | shared IPC · AC9 |
| error/lifecycle | cache invalidate만 | invalidate + dynamic entry removal + stale fence | 실패 뒤 유령 모델 금지 | catalog lifecycle tests · AC7·AC8 |
| test seam/관측점 | parser 개별 테스트 | pure normalize + injected reconciler | Electron 없이 상태 전이 검증 | 신규 순수 모듈 · AC1~AC8 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `features/harnesses/claude/available-models.ts` | exact field 검증·정규화·family/self fallback | unknown → `ParsedModel[]` | settings parser, runtime catalog |
| `features/harnesses/runtime-catalog.ts` | settings와 runtime snapshot 합성·generation fence | entries/contributions/Auth snapshot → catalog | app bootstrap/handler |
| `app/deployment/harness-runtime.ts` | AuthId↔runtime LLM contribution 선언 | 좁은 deployment definitions | bootstrap composition |
| `shared/ipc.ts` | secret 없는 provenance/read-only wire 계약 | `AgentEnvironment` | main/preload/renderer |
| renderer Engine/chat | DTO를 표시·선택하고 stale selection 화해 | catalog snapshot → UI/action | pages/app composition |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| `availableModels: string[]` exact shape | `available-models.ts` validator/type guard | settings parser·runtime augmenter boundary | settings load·runtime resolve 2지점 | invalid field는 자동 모델 0, 기존 기본 모델 유지 |
| family 분류 + model identity + custom self fallback | `normalizeAvailableModels`·`modelKey` | 정적·동적 producer·두 UI | catalog materialize 2지점·선택/표시 2지점 | family alias 충돌로 모델 유실 또는 custom alias 실행 |
| runtime entry의 Auth 파생성 | `RuntimeModelContribution.authId` + reconciler | bootstrap | Gate verified·revoke·expired·unauthorized·fetch failure 5전이 | unusable이면 entry 부재 |
| 로그인당 fetch 1회·세션 fetch 0회 | runtime catalog single-flight process cache | Gate login reconciler·session/turn readers | 로그인 성공 1지점에서만 fetch; session create·turn setup 2지점은 read-only cache | 중복 fetch 또는 cache miss 시 명시 실패 |
| read-only provenance | runtime-managed canonical key + `AgentEnvironment.source/readOnly` | catalog mapper·runtime entry mapper·Engine renderer·engine mutation handler | settings DTO 생성·runtime DTO 생성·UI action·IPC mutation 4종(IPC mutation 4좌표), 실효 6지점·7좌표 | 충돌 settings 행 노출, UI 편집 액션 노출 또는 main mutation 허용 |
| contribution cache 수명과 catalog 가시성의 결합 | `canonicalAgentKey` + runtime catalog invalidation/reconcile | settings CRUD·부팅 deploy·Auth invalidation·catalog reconciler·두 읽기 소비처 | settings CRUD 전체 무효화·부팅 deploy 선행 무효화·Auth key 무효화·영향받은 모든 authId reconcile(배포 선언은 변형 없이 helper로 넘어간다 — `src/main`에 `RUNTIME_MODEL_CONTRIBUTIONS.` 0건)·**목록 읽기 미노출**·**턴 후보 읽기 미노출** 6지점 | cache MISS인데 행이 남는 유령 상태 또는 다른 auth의 entry만 stale 상태. 읽기 2지점을 빼면 무효화가 다 돌아도 행이 화면에 남는다(r6 M-B 자리) |
| 부팅 시퀀스 순서 | `startRuntimeModelCatalogAfterDeploy` 5단계 + `createRuntimeModelAuthResume` 유일·실재 설치 | 컴포지션 루트(`bootstrap.ts`) · 음성 가드 · 양성 가드 | helper 내부 5단계 순서 1지점 · **listener 설치 유일성** 1지점(`src/main` 전체에서 `auth.subscribe(` 호출 파일 = `runtime-model-startup.ts` 1개) · **startup 호출 실재** 1지점(정의 파일 제외 `startRuntimeModelCatalogAfterDeploy(` production 호출 파일 = `['bootstrap.ts']`) · **listener 설치 실재** 1지점(정의 파일 제외 `createRuntimeModelAuthResume(` production 호출 파일 = `['bootstrap.ts']`) = 4지점 | invalidate가 attach 뒤로 가면 Gate fetch가 지워지고(r5 D24), attach가 subscribe 뒤로 가면 부팅이 network를 await한다. **배선 소멸은 컴파일러·기존 게이트가 잡지 못한다** — startup 호출 블록 삭제는 3단계(verify r8 M-P), listener helper 폐기는 4단계(verify r9 M-Q) unused 정리 만에 typecheck 0·eslint 0·vitest 베이스라인 동일 초록으로 수렴한다. 소멸을 red로 만드는 것은 양성 실재 2지점뿐이다(D44 ① 정정) |
| 두 UI 동일 snapshot | `orca:agent:list` | agentStore | Engine/Composer load·refresh 2소비축 | 목록 차이 테스트 실패 |

- 같은 규칙의 SSOT: family 분류와 모델 정규화는 main 순수 함수 하나를 두 producer가 호출하고 renderer는 결과만 표시한다.
- 선택적 필드 의미: `availableModels===undefined`는 새 자동 목록 미제공, `[]`는 명시적 빈 목록이며 runtime contribution에서는 자동 entry 제거 신호다. `readOnly:true`만 mutation 금지이며 undefined/false는 settings CRUD 항목이다.
- 외부 SDK 경계: 정확한 field는 `availableModels`, 값은 string array다. subprocess `Record<string,string>`인 `runtimeEnv`에 JSON 문자열로 재인코딩하지 않고 runtime config의 동등한 typed field로 전달한다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `features/harnesses/claude/available-models.ts` + test | 모델 정규화 | trim, empty drop, stable dedupe, family, self fallback, default | 순수 단위 |
| `features/harnesses/claude/model-parser.ts` + test | 정적 입력 합성 | env family 기본 항목을 먼저 만들고 exact top-level `availableModels`을 뒤에 병합 | 순수 단위 |
| `adapters/harness-config.ts` | runtime 계약 | `HarnessRuntimeConfig.availableModels?` typed field 추가; env fingerprint와 분리 | 계약/typecheck |
| `features/harnesses/runtime-config.ts` + test | augmenter 결과 운반 | typed 배열을 cache/generation 결과에 포함 | deferred 단위 |
| `features/harnesses/runtime-catalog.ts` + test | 파생 catalog | Gate-login single-flight fetch, process cache, removal, late result fence | 순수/주입 통합 |
| `app/deployment/harness-runtime.ts` + wiring test | 배포 선언 | AuthId와 harness/provider key를 묶은 runtime model contributions 추가 | shape/semantic 계약 |
| `app/bootstrap.ts`, `app/context.ts`, `handlers/misc.ts` | lifecycle/IPC 배선 | Gate 인증 성공에서만 fetch, session/handler는 catalog cache snapshot 조회 | bootstrap 통합 |
| `app/runtime-model-startup.ts` + test **(r8)** | Auth 무효화 조립 | `createRuntimeModelAuthInvalidator`가 `AUTH_INVALIDATED_HARNESS_KEYS`와 선언에서 key를 계산하고 owner 전원을 재조정한다 — `bootstrap.ts`는 선언을 변형 없이 넘긴다 | 주입 단위 |
| `app/no-stray-auth-subscribe.test.ts` **(r8 신규 · r9~r10 확장)** | 컴포지션 유일성 + 실재 가드 | `infra/source-scan.ts`로 음성 2술어(`auth.subscribe(` 호출 파일 1개·`RUNTIME_MODEL_CONTRIBUTIONS.` 0건) + 양성 2술어(정의 파일 제외 `startRuntimeModelCatalogAfterDeploy(`·`createRuntimeModelAuthResume(` 호출 파일 각 `['bootstrap.ts']`)를 단언하고, 대상 집합·술어 4에 가드 자기 테스트를 둔다 | 순수(node) |
| `app/handlers/misc.runtime-catalog.test.ts` **(r8)** | 0건 단언의 총량 동반 | 비충돌 settings 행 1개를 fixture에 넣어 보존과 미노출을 같은 `toEqual`에서 단언한다 | 주입 단위 |
| `shared/ipc.ts`, `shared/protocol.ts` | provenance 계약 | source/readOnly wire 필드와 schema 갱신 | protocol test |
| Engine components + i18n | read-only UX | 배지 표시, edit/delete 숨김 | component + 시각 |
| chat model selection/store tests | stale selection | 제거된 runtime 모델 선택 재화해 | 순수 reducer/selector |
| `docs/arch/backend/auth.md`, `provider-runtime.md`, `frontend/ux-domains.md`, `IPC_CONTRACT.md` | 현재 구조 동기화 | runtime-derived catalog와 exact field 의미 기록 | doc checks |

### 테스트 가능성

- Electron/DB/native 분리: normalizer와 runtime catalog state machine은 `features/harnesses`의 별도 순수 파일로 두고 Auth/runtime 포트를 주입한다.
- 기존 메커니즘 재사용: runtime config generation fence는 stale 결과 방지에 재사용한다. catalog는 Gate 로그인당 single-flight process cache를 소유하며 session/turn 경로에는 fetch 포트를 주입하지 않는다.
- 순서 관측: deferred augmenter, 명시적 AuthChange fixture, publish callback spy로 `success start → revoke → late success` 순서를 고정한다.

## 12. End-to-end 영향

### producer → consumer

```text
settings / Auth+runtime augmenter
  → normalizeAvailableModels
  → RuntimeModelCatalog snapshot
  → toAgentEnvironments / AgentEnvironment provenance
  → agentStore
  → EngineCard + ModelMenu + chat selection reconciliation
```

- producer 기준: 원천이 가진 exact 모델명과 provenance를 보존하고 family만 파생한다.
- consumer 파생 규칙: renderer는 family를 재분류하지 않고 main이 보낸 alias/model/readOnly를 사용한다.
- 정본 우회 방지: Engine의 버튼 노출과 main mutation handler가 같은 `readOnly` provenance를 각각 UX·권한 경계에서 강제한다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| Engine & Models | runtime 카드 증가, read-only action 분기 | AC9·AC12 |
| Composer ModelMenu | runtime 모델 증가·제거 | AC10·AC12 |
| chat default/selection | custom alias와 제거된 선택 처리 | AC3·AC10 |
| title model resolver | haiku family가 있으면 기존 저가 선택 유지 | AC2·AC12 |
| usage provider keys | runtime-only entry를 원격 usage 후보로 오인하지 않도록 settings entries 경로 유지 | AC12 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 부팅 deploy 무효화를 먼저 완료하고 → runtime catalog attach → Auth 구독 → `authResume.run()` 순으로 설치한다(§7 순서 기준). Gate 수동/자동 로그인 verified snapshot이 contribution fetch 1회를 발화하고 성공 snapshot을 process-memory cache에 원자 publish한다.
- 취소/중단: Auth unusable 전이는 in-flight resolve를 abort하고 generation을 올린 뒤 entry를 즉시 제거한다.
- 종료/quit/crash/renderer-gone: catalog는 메모리 파생 상태라 별도 저장·cleanup 없이 프로세스와 함께 사라진다.
- retry/timeout/partial failure: Gate 로그인 fetch 실패는 해당 contribution만 제거하고 다른 entries는 유지한다. 새 세션은 재시도 트리거가 아니며 다음 Gate 재인증만 새 fetch를 허용한다.
- cleanup/rollback: runtime 등록은 파일·DB를 쓰지 않으므로 제거는 memory snapshot 원자 교체 한 번이다.
- 다중 저장소 쓰기: 제품 상태는 메모리 catalog 한 곳뿐이다. 설계 산출 상태는 이 plan과 `INDEX.md` 두 사본이므로 같은 커밋에서 READY로 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력 상한: settings 모델 수 + 인증된 runtime contribution별 `availableModels.length`; 입력 배열 크기 이상의 모델을 만들지 않는다.
- 새 요청 상한: Gate 로그인 1회 × 해당 Auth contribution 수이며 polling 0, 새 세션 N × 턴 M의 추가 fetch는 0이다. 같은 로그인 내 중복 verified snapshot은 single-flight/cache hit로 network 0회다.
- 구조적 목표: 별도 순수 normalizer와 catalog state machine 두 응집 모듈로 분리해 bootstrap에 parsing/state machine을 인라인하지 않는다.
- 캐시 트레이드오프: process-memory cache는 Gate 재인증·revoke·expired·unauthorized에서 해당 contribution을 버린다. session/turn은 stale-while-revalidate를 하지 않으며 유령 entry보다 미노출을 택한다.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포 포트: `RuntimeConfigAugmenter.resolve`는 선택적으로 정확한 `availableModels: string[]`을 반환하며 contribution 선언은 `authId`, `key`, `harnessId`, `modelProviderId`를 묶는다.
- 구현 문서: `docs/guides/closed-network-extensions.md`의 Harness runtime recipe에 exact field와 Auth lifecycle 의미를 추가한다.
- shape 검증: 가이드 예제를 실제 `RuntimeConfigAugmenter`와 contribution 타입에 `satisfies`로 대입해 typecheck한다.
- semantics 검증: `undefined`=미제공, `[]`=명시적 제거, reject=unavailable 제거, late resolve=폐기 의미를 contract test와 대조한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| settings directory가 모델 목록 SSOT | `settings-entries.ts`, 0188 | §9 TO-BE | 변경 — 사용자 요구로 runtime-derived source를 합성하되 settings CRUD SSOT는 유지 |
| feature 교차 import 금지 | `app/src/main/AGENTS.md` | §9·§11 | 유지 — harnesses 내부 응집, app 주입 |
| Auth 상태는 snapshot lifecycle | `contracts/auth.ts`, `bootstrap.ts` | D-006, §13 | 유지·재사용 |
| GUI와 credential invalidation 분리 | `contracts/auth.ts` | §10 runtime derivation | 유지 — catalog는 usable snapshot 전이를 보고 env cache는 credentialChanged를 계속 봄 |
| 두 UI가 `agent:list` 소비 | `ux-domains.md` | D-007, §12 | 유지 |
| main mutation도 권한 강제 | 보안/IPC 일반 원칙 | §10 | 강화 — renderer 숨김만 믿지 않음 |
| 규칙을 음성 소스 스윕으로 강제 | `infra/net/no-node-fetch.test.ts` · `features/auth/no-cookie-token.test.ts` · `infra/source-scan.ts` | D-010, §10 부팅 시퀀스·cache 수명 행 | 유지·확장 — 같은 관용구의 3번째 사이트이며 새 메커니즘이 아니다 |
| electron 무는 파일은 테스트가 import하면 죽는다(P29) | `src/main/AGENTS.md §원격 요청은 Chromium 스택으로만` | D-010 근거 | 유지 — vitest electron alias 대안을 이 규칙 약화로 기각했다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| `availableModels`를 OS env 문자열로 오해 | typed top-level/runtime config field로만 운반하고 exact-shape 음성 테스트를 둔다. |
| verified-only snapshot은 `credentialChanged:false`라 기존 early return에 막힘 | catalog reconcile은 GUI push 뒤 별도 usable-state 분기로 두고 plugin/env invalidation 규칙과 섞지 않는다. |
| runtime-only entry가 settings CRUD/usage 후보로 샘 | provenance를 DTO와 main mutation 경계에서 강제하고 usage는 기존 settings entry 열거를 유지한다. |
| stale Composer 선택이 제거 뒤 전송됨 | agent snapshot 갱신 시 선택 유효성을 재검사하고 기본 선택으로 화해한다. |
| custom alias 충돌 | 실제 모델명을 key·Composer label로 그대로 쓰고 stable dedupe하며 family 표시는 별도 metadata로 둔다. |

- 되돌리기 어려운 결정: `AgentEnvironment` provenance와 augmenter `availableModels`는 wire/배포 계약이므로 문서와 테스트를 같은 변경에서 잠근다.
- 신규 의존성: 없음. 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/main/features/harnesses/**`
- `app/src/main/adapters/harness-config.ts`
- `app/src/main/app/{bootstrap,context,handlers/misc,deployment/harness-runtime}*`
- `app/src/shared/{ipc,protocol}.ts`
- `app/src/renderer/src/features/{engine,chat}/**`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/{IPC_CONTRACT.md,arch/backend/auth.md,arch/backend/provider-runtime.md,arch/frontend/ux-domains.md,guides/closed-network-extensions.md}`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md`, `app/src/main/AGENTS.md`, `app/src/renderer/AGENTS.md`, `docs/AGENTS.md` 및 하위 문서 가이드.
- ABI/네트워크 제약: DB 변경이 없으므로 `npm test` pretest를 피하고 관련 vitest를 직접 실행한다. 공식 문서 web search는 현 환경 401이었으며 사용자 확정 계약을 기준선으로 기록했다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run`으로 model parser/normalizer, runtime config/catalog, bootstrap wiring, protocol, engine, composer selection 대상 suite를 실행한다.
- 문서 게이트: `cd app && node scripts/check-doc-inventory.mjs --check`와 저장소 루트 `git diff --check`를 실행한다.
- 사람 실기: 앱에서 수동 plugin login·자동 app login·revoke를 각각 수행해 read-only 카드와 Composer 항목의 동시 출현/제거를 두 테마에서 확인하고 스크린샷을 남긴다.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축으로 작성됐다.
- [x] Delta의 각 변경이 구현 파일 또는 AC에 추적 가능하다.
- [x] AS-IS의 settings-only SSOT는 runtime 합성으로 대체됨을 명시했다.
- [x] 수치·전칭 표현·문서 앵커·기존 테스트 인용을 실측했다.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 사람 실기로 미룬 순수 로직이 없다.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다.
- [x] producer/consumer 양쪽 의미를 확인했다.
- [x] 상한·one-way door를 계산했다.
- [x] 게이트 명령이 대상 subtree의 현재 AGENTS.md와 충돌하지 않는다.
- [x] ACTIVE Decision과 AC 대조 결과 충돌 0을 §3에 기록했다.
- [x] 산출물 문장 규칙을 적용했다.

---

> **[구현자 기입]** 구현 턴에서 `handoff-impl` 절차에 따라 아래 결과를 기록한다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: D-001~D-008과 AC1~AC13을 production path에 반영했다. `rg "availableModels|runtimeModelCatalog|readOnly" app/src`로 producer→catalog→IPC→두 UI 경로를 재확인했다.
- 이견 / 현실성 문제: §10의 read-only 강제 지점은 3곳이 아니라 DTO·Engine UI·add·update·delete·read 6곳이었다. 선언된 runtime key는 인증 해제 뒤에도 main mutation 4종을 계속 거부하도록 선조치했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| exact `availableModels` | settings load·runtime resolve (2) | 2/2 | `available-models.test` + `model-parser.test` + `runtime-config.test` 통과 | — |
| family·custom self | 정적·동적 producer (2) | 2/2 | normalizer/model selection/settings 테스트에서 family 4종·self 확인 | — |
| Auth 파생 전이 | verified·revoke·expired·unauthorized·failure (5) | 5/5 | runtime catalog usable/unusable/failure/generation 테스트 통과 | — |
| 로그인 fetch·세션 cache | login 1·session create·turn setup (3) | 3/3 | 실제 runtime service를 쓴 warm-cache 테스트에서 login+2 resolve의 augmenter 1회 | — |
| read-only provenance | 설계 3, 실측 6 | 6/6 | `rg "assertMutable|readOnly"`로 DTO·UI·IPC 4종 확인, catalog 선언 key 테스트 통과 | — |
| 두 UI 동일 snapshot | Engine·Composer (2) | 2/2 | agentStore refresh 배선·ModelMenu/EngineCard 소비와 selection 테스트 확인 | — |

- §10에 없는데 같은 불변식이 필요했던 지점: Engine `read`도 runtime settings 파일 접근을 막아야 했다. add/update/delete와 함께 4/4를 닫았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구·상태에 소비자가 있는가 | ✅ `engine.card.readOnly`를 EngineCard가 소비 | 한국어·영어 catalog 동시 추가 |
| 새 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ fetch 실패/unavailable 행 | 자동 항목 제거, settings 항목 보존 |
| 실패가 “아무 일도 안 일어남”으로 보이지 않는가 | ✅ 원천 소멸과 동일하게 두 UI 항목이 제거 | provider-state push 뒤 agent refresh |
| 늦은 응답이 화면을 되돌리지 않는가 | ✅ generation fence 테스트 | revoke 뒤 late success 폐기 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | Auth state push가 catalog publish보다 먼저 끝나면 renderer가 옛 목록을 다시 읽는다. | ✅ 선조치 — catalog `onChange`에서 provider state를 한 번 더 push | `bootstrap.ts` catalog callback |
| 2 | 현재 entry만 read-only로 보면 revoke 직후 같은 key를 사용자 파일로 만들 수 있다. | ✅ 선조치 — contribution 선언 key 자체를 불변 read-only로 판정 | `runtime-catalog.test` 인증 전 단언 |
| 3 | §10 read-only 지점 수가 main mutation 4종을 누락했다. | 📝 plan 수정 제안 — 3지점→6지점 | `engine.ts` add/update/delete/read 전수 |

### 설계 대비 명시적 차이

- plan은 별도 catalog cache를 설계했지만 구현은 catalog snapshot과 기존 `HarnessRuntimeConfigService` cache를 결합했다. Gate reconcile이 기존 cache를 warm하므로 session/turn resolve는 network 없이 같은 config를 얻는다.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | production 20개·테스트 6개·현재 문서 4개, 신규 의존성 0 |
| 실행 명령 | 관련 vitest, `npm run lint`, `npm run typecheck`, `node scripts/check-doc-inventory.mjs --check`, `git diff --check` |
| 관측한 게이트 산출 | 관련 11파일 92케이스 + 최종 cache 2파일 16케이스 통과; lint 0 error/기존 warning 1; typecheck 3/3; doc inventory 9 items·76 channels |
| 강제 지점 전수 | 20/20 — 2+2+5+3+6+2 |
| AC 자기보고 | ✅ AC1~AC8·AC10~AC13 = 12, ⚠️ AC9 = 실제 앱 두 테마 시각 확인 대기 |
| 합계 검산 | `✅ 12 · ⚠️ 1 · ❌ 0 = 총 13` |
| 블로커 / 역질문 | 코드 블로커 없음. GUI 캡처 도구/X server 부재로 AC9 사람 실기만 대기 |
| 대상 커밋 | `803bd50` — r1 구현 좌표(verify r2에서 실재 재확인) |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 신규 구현 r1이다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: read-only AC는 있었지만 §10의 main 강제 지점 분모가 4 IPC 중 1개로 축약돼 있었다.
- 반복해서 부딪히는 환경 한계: GUI/X server·스크린샷 도구가 없다.
- 현재 라운드 수: 1.

## [검증자 기입] 파생 이슈

> 라운드별 검증 판정 원문은 [`verify.md`](verify.md). 아래는 재구현이 닫을 목록이다.
> D1~D10은 r2, D11~D16은 r3, D17~D23·W1은 r4, D24~D31은 r5, D32~D39는 r6, D40~D43은 r7, D44~D46은 r8, D47은 r9 산출이다.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | `parseClaudeModels`의 `byAlias` Map이 같은 alias에서 마지막 항목을 남겨 두 producer의 default가 갈린다 | verify r2 · AC4 | 첫 항목 탐색으로 교체; 사용자 원문의 `DEFAULT` 선행 항목이 default를 유지 | closed r3 |
| D2 | 세션 로드(`modelFamily=null`)에서 `selectionExists`가 항상 false라 저장된 provider가 첫 provider로 바뀐다 | verify r2 · AC10·AC12 | null 선택을 기존 provider의 default hydrate 상태로 인정 | closed r3 |
| D3 | runtime 경계가 `availableModelsOf` 없이 정규화해 문자열 입력이 가짜 모델을 만든다 | verify r2 · AC1·§10 1행 | runtime에도 exact shape guard와 음성 테스트 적용 | closed r3 |
| D4 | `assertMutable`이 정규화 전 키를 봐 대소문자·공백 변형으로 우회된다 | verify r2 · §10 5행 | canonical key를 main mutation 4종 전에 강제 | closed r3 |
| D5 | AC6·AC11·AC13이 주장한 bootstrap/auth-resume 배선 테스트가 없다 | verify r2 | pre-attach resume replay·snapshot catch-up·실제 turn resolve cache 테스트 추가 | closed r3 |
| D6 | resolve reject로 entry가 제거되는 경로에 테스트가 없다 | verify r2 · AC7 | 다른 entry 보존까지 포함한 reject fixture 추가 | closed r3 |
| D7 | `available-models.test.ts`의 케이스 이름이 단언과 어긋난다 | verify r2 | 다중 family 보존 의미로 이름 교정 | closed r3 |
| D8 | `agent:list`가 settings·runtime의 같은 key를 병합하지 않는다 | verify r2 | runtime 우선 key 병합으로 단일 행 보장 | closed r3 |
| D9 | `useEngines.ts` 중복 import · `availableModels` 항목의 `[1m]` 미해석 | verify r2 | import 통합, 공용 suffix parser 적용 | closed r3 |
| D10 | plan 인용 해시 `7fb771f` 부재 · r1 커밋 type 오표기 · r2 설계/구현 동일 커밋 | verify r2 | 좌표를 `803bd50`으로 교정; 과거 커밋은 재작성하지 않고 r3를 `fix` 구현 커밋으로 분리 | closed r3 |
| D11 | 두 producer의 기본 선택이 여전히 갈린다 — 배열 첫 항목 vs `FALLBACK_ORDER`, 5배열 중 3배열 불일치 | verify r3 · AC4·D-004 | 공유 default 규칙 하나로 모으고 §10에 "기본 선택 동일성" 행을 신설; env 우선권 적용 여부는 사람 결정 | closed r4 |
| D12 | augmenter가 `validUntil`을 주면 만료 뒤 턴이 재fetch한다(`AUGMENTER_CALLS=2`) | verify r3 · AC13·D-008·§10 4행 | 턴 경로를 catalog snapshot 전용으로 막거나 만료를 Gate 재인증으로만 처리; 가이드 6-a 예제와 정합 | closed r4 |
| D13 | key 충돌 시 `agent:list`는 runtime 행, `turn-setup`은 settings 행을 쓴다 | verify r3 · D-007 | 턴 경로도 `mergeAgentEnvironments`와 같은 우선순위로 병합 | closed r4 |
| D14 | `IPC_CONTRACT.md:69`의 "custom의 alias/model은 원문 self"가 `alias='custom'` 코드와 어긋난다 | verify r3 | D-003 재정의에 맞춰 문장 갱신 | closed r4 |
| D15 | 커밋/좌표 위생 4건 — INDEX `fb04047` 부재 · `a5f06c4` trailer 파싱 0건 · `d479e7c`가 `Agent: codex`+`designed` · `8e17aae`에 규범 행·verify 혼입 | verify r3 | 좌표는 이번 검증 커밋에서 교정; 나머지는 다음 라운드 커밋 규약 준수 | partial r4 |
| D16 | `!verified \|\| status!=='valid'`의 뒤 항을 지워도 10케이스 전건 통과(변이 M1) | verify r3 · AC7 | `status:'expired'`·`'unknown'`을 `verified:true`와 함께 넣는 케이스 추가 | closed r4 |
| D17 | `npm run typecheck` exit 2 · `error TS2741` 7건 — `cached` 를 인터페이스에 넣고 fake 7곳 중 1곳만 갱신 | verify r4 · AC12 | `runtime-catalog.test.ts` fake 7곳에 `cached` 추가 | closed r5 |
| D18 | Auth 밖 `invalidate(undefined)` 2지점이 cache 를 비우는데 catalog entry 는 남아 턴이 영구 실패 | verify r4 · §10 4행·Part I §5·§14 | **사용자 결정 A:** cache와 catalog entry를 함께 제거하고 Gate 재인증 전에는 미노출 | accepted r5 |
| D19 | `cached()` 가 `sourceRevision` 대조까지 건너뛴다 — settings 편집이 턴에 반영되지 않는다 | verify r4 | 사용자 선택 A에 따라 settings 편집 시 runtime entry를 숨기고 다음 Gate 인증에서 새 revision resolve | closed r5 |
| D20 | `isReadOnly` 만 key 를 정규화하고 `cached()`·`mergeAgentEnvironments` 는 원문 key 를 쓴다 | verify r4 | 세 소비처의 key 정규화를 한 함수로 모은다 | closed r5 |
| D21 | `turn-setup.ts` 가 `features/harnesses/models` 를 두 줄로 import (r2 D9 와 같은 축) | verify r4 | import 통합 | closed r5 |
| D22 | `validUntil` 의미가 catalog contribution key 여부로 갈리는데 가이드가 그대로다 | verify r4 · §15 | 6-a와 예제 뒤에 contribution/settings 분기 및 미노출 복구를 기록 | closed r5 |
| D23 | INDEX 대상 커밋의 `(r4 구현)` 자리표시자 · plan 메타 `상태` 행 볼드 중첩 깨짐 | verify r4 | r4 좌표는 검증 커밋에서 교정; 메타 행 정정 | closed r5 |
| W1 | `markDefaultModel` 의 `?? models[0]` 폴백이 구현자 스위트로 잠기지 않는다(변이 M3) | verify r4 | 전 항목 custom 배열 케이스 추가 | closed r5 |
| D24 | 부팅 deploy 무효화(`bootstrap.ts:641`)가 Gate 인증이 방금 fetch한 entry를 지우고 재조정 트리거가 없다 | verify r5 · AC11·Part I §5 | **D-009:** 부팅 deploy 무효화를 Auth 구독·resume·catalog attach 앞으로 옮겨 verified fetch를 최종 상태로 만든다. | closed r6 |
| D25 | 같은 key의 settings 디렉터리가 있으면 무효화 뒤 settings 행이 남아 D18 유령이 재현된다 | verify r5 · D-008·Part I §14 | **D-008·AC5·AC7:** 무효화된 canonical contribution key는 settings 행도 두 UI에서 미노출로 수렴시킨다. | closed r6 |
| D26 | `engine.ts:39`·`bootstrap.ts:641`의 `catalog.invalidate()`를 지워도 401케이스 전건 통과(변이 M-E·M-F) | verify r5 | engine 실제 handler callback과 startup production seam 배선 테스트를 추가하고 각 호출 삭제 변이가 실패함을 관측한다. | closed r6 |
| D27 | `mergeAgentEnvironments`·`entries` map의 canonical key가 잠기지 않는다(변이 M-G·M-H) | verify r5 | 대소문자·공백이 다른 settings/runtime key 충돌과 빈 runtime row 미노출을 production 함수로 단언한다. | closed r6 |
| D28 | `invalidate(key)`의 key 필터가 잠기지 않는다(변이 M-I) | verify r5 | 기존 두 contribution 중 한 key만 제거하는 catalog 케이스와 r6 settings 충돌 필터 변이를 함께 재실행한다. | closed r6 |
| D29 | `bootstrap.ts:488`이 자기 authId만 재조정해 cross-auth `AUTH_INVALIDATED_HARNESS_KEYS` 경로가 열려 있다 | verify r5 · §10 cache 수명 행 | canonical key를 소유한 모든 authId를 계산해 snapshot을 재조정하고 A/B 공동 key fixture를 잠근다. | partial r6 — helper는 닫혔고 호출부가 열려 D34로 이어진다 |
| D30 | 게이트 자기보고 `2092케이스/44 ABI fail`이 재측정 `2090/42`와 다르다(plan·INDEX 2사본) | verify r5 | r6은 대상 스위트 실측 5파일/39케이스만 보고한다. 전체 스위트는 ABI red 뒤 최종 집계 없이 중단된 사실을 분리한다. | closed r6 |
| D31 | 좌표·기준선 위생 3건 — `176a73f`에 규범 행 D-008 혼입(D15 축) · INDEX `(r5 구현)` 자리표시자 · §10 read-only 행이 아직 `3지점` | verify r5 | 과거 혼입은 history로 보존한다. INDEX 좌표는 교정됐고 §10은 실효 6지점·7좌표로 정정한다. | closed r6 — 단 같은 축이 D36·D37로 재발했다 |
| D32 | `misc.ts:45`의 3번째 인자를 지워도 전체 스위트가 베이스라인과 같다(변이 M-B) — AC5가 지목한 두 UI **목록** 경로가 잠기지 않았다 | verify r6 · AC5·§10 6행 | `agent:list` handler를 `engine.runtime-catalog.test.ts`의 `vi.mock('../../infra/ipc/handle')` 패턴으로 열어 catalog 주입 후 충돌 행 미노출을 단언한다 | closed r7 |
| D33 | `auth.subscribe`×2 + `authResume.run()`을 deploy 앞으로 되돌려도 전건 통과하고 typecheck exit 0(변이 M-H) — AC11·D-009의 실제 배선이 소스 문자열 grep으로만 잠겼다 | verify r6 · AC11·AC6 | `resumeAuth` 설치를 순수 팩토리로 한 겹 더 뽑아 "helper에 무엇을 넘겼는가"를 주입 테스트로 잠근다. 규범 축(AC11 검증 수단·§10 행)은 D35에서 닫혔고 남은 것은 잠금 구현이다 | closed r8 — D40 이 닫히며 인용 변이 M-H(=M-H2)가 검출된다 |
| D34 | cross-auth 루프에 `.filter(item => item === authId)`를 붙여 r5 D29 버그를 되살려도 미검출(변이 M-D2) | verify r6 · §10 cache 수명 4행 | helper 반환값이 아니라 호출 결과로 재조정된 authId 집합을 관측하는 seam을 만든다 | closed r8 — D40 이 닫히며 호출부 좁힘(M-D3)이 검출된다 |
| D35 | plan §7 순서 기준(attach 마지막)과 구현(attach 3번째)이 어긋나는데 "설계 대비 차이 없음"으로 보고됐다 | verify r6 · §7·D-009 | **§7을 구현 순서로 정정했다** — attach를 resume 뒤에 두면 `await attach()`가 부팅에서 network를 기다린다. 함께 AC11 검증 수단에서 소스 문자열 검사를 배제하고 §10에 부팅 시퀀스 순서 행(2지점)을 신설했다. | closed(설계) r6 |
| D36 | INDEX·plan 두 사본의 r6 좌표 `d214581`이 실재하지 않는다(`git cat-file -t` 실패, `git rev-list --all` 전수 부재). 실제 좌표는 `a843557` | verify r6 · §11 | 좌표는 이번 검증 커밋에서 교정했다. 다음 라운드는 좌표를 적기 전에 `git cat-file -t`로 확인한다 | closed r6(교정) |
| D37 | `a843557`이 규범 행(D-009·AC5·AC7·AC11·§10 2행)과 구현을 한 커밋에 담아 §0 기준선이 성립하지 않는다 — r3 D15·r5 D31①의 3회차 | verify r6 · §0 | 설계 턴 커밋과 구현 커밋을 나눈다. 과거 커밋은 history rewrite 없이 남긴다 | closed r7 |
| D38 | `docs/arch/backend/auth.md:583`이 "Model 선택 UI 는 계속 settings.json 에서 파생한다 … 카탈로그 목록에 넣지 않는다"로 남아 같은 파일 `:496`·코드와 어긋난다 | verify r6 · 기준 밖 · §16 | 현재 동작(settings + runtime catalog 합성)으로 문장을 정정한다 — `803bd50`이 §6.1·§6.2만 고치고 §6.5 말미를 두고 갔다 | closed r7 |
| D39 | `bootstrap.ts:382-384`의 "listener 를 resume 보다 먼저 붙인다" 주석이 bridge 팩토리 위에 남아 실제 listener(`:642-657`)를 가리키지 않는다 | verify r6 · 위생 | 주석을 listener가 있는 자리로 옮긴다. 불변식 자체는 closure 안에서 지켜진다 | closed r7 |
| D40 | `bootstrap.ts` 호출부 2좌표가 잠기지 않는다 — `resumeAuth: () => {}` + subscribe×2·`run()`을 deploy 앞으로 되돌려도 2100케이스 green·typecheck exit 0(변이 M-H2, r6 M-H 재현), `contributions`를 자기 authId로 좁혀도 미검출(M-D3, r5 D29 재현) | verify r7 · AC6·AC11·§10 cache 수명 4행·부팅 시퀀스 2행 | startup 인자 묶음 전체를 순수 factory로 뽑아 `resumeAuth` 실체와 `contributions` 폭을 주입 테스트로 단언하거나 두 helper를 하나로 합쳐 지점을 1로 줄인다. 같은 변경에서 `createRuntimeModelAuthResume`의 이름·배치를 배선 책임에 맞춘다 | closed r8 — 음성 가드가 M-H2·M-D3를 각각 검출하고 무효화 조립을 helper로 이설했다 |
| D41 | AC11 검증 수단이 소스 문자열 검사를 전면 배제해(D35) 합성 seam을 잠글 수단이 남지 않는다 — `bootstrap.ts`는 `@electron-toolkit/utils`의 CJS `require('electron')` 때문에 vitest가 열 수 없다(verify r7 §8 실측) | verify r7 · AC11 검증 수단·§10 부팅 시퀀스 행 | 이 저장소의 음성 소스 가드 관용구(`infra/net/no-node-fetch.test.ts` + `infra/source-scan.ts`)를 §10 2번째 지점의 수단으로 허용할지, 아니면 지점 수를 1로 줄일지 규범 행에서 정한다 · **규범 정정 필요** | **closed(설계) r8** — D-010 신설, AC11 검증 수단·§10 두 행 정정. 음성 가드를 채택하고 electron alias 대안은 P29 약화로 기각했다 |
| D42 | 신규 `misc.runtime-catalog.test.ts`의 `toEqual([])`가 한쪽만 잠근다 — handler가 settings 입력을 통째로 버려도 전건 통과(변이 M-B3) | verify r7 · AC5 | fixture에 비충돌 settings 행 1개를 넣고 같은 `toEqual`에서 보존과 미노출을 함께 단언한다(r6 AC5 probe 형태) | closed r8 — 보존 행을 동반한 단언이 M-B3를 검출했다 |
| D43 | `6934d77` 본문이 리터럴 `\n`으로 한 줄이라 trailer가 파싱되지 않는다(`git interpret-trailers --parse` 0건) — r3 D15와 같은 축 | verify r7 · §11 | 과거 커밋은 rewrite하지 않는다. 다음 라운드부터 trailer를 실제 개행으로 적고 커밋 후 `git log -1 --format='%(trailers:only=true)'`로 확인한다 | closed r8 — 구현 커밋 뒤 파싱 결과를 관측한다 |
| D44 | 유일성 가드가 "배선"이 아니라 "그 파일에 호출문이 있다"를 잰다 — `bootstrap.ts`의 runtime-model Auth 배선을 지우고 그로 인해 unused가 된 심볼까지 정리하면 typecheck 0·eslint 0·vitest 215/215·2108/2108 green이고 production Auth listener는 0개다(변이 M-P, 3단계 수렴). §10 부팅 시퀀스 행의 실패 의미 "호출 자체의 소멸은 `noUnusedLocals`가 typecheck를 red로 만든다(r7 M-J)"가 거짓이다 — r7 M-J는 정리 1단계에서 멈춘 관측이다 | verify r8 · AC6·AC11·§10 부팅 시퀀스 행·D-010 | ① §10 실패 의미 문장을 실측으로 정정한다 ② 소멸 축을 잠글지, 잠근다면 양성 술어(그 파일의 export를 부르는 production 파일 ≥1)·타입 강화 중 무엇으로 할지 D-010에서 정한다 · **규범 정정 필요** | **closed(설계) r10** — ① §10 실패 의미를 M-P 3단계·M-Q 4단계 실측으로 정정 ② D-010이 양성 실재 술어(대상 심볼 2건 명기)를 채택. 코드 절반(startup 호출 가드)은 r9 선행 구현 |
| D45 | `bootstrap.ts:372` 주석 "아래 `auth.subscribe` 는 change 에만 발화하고"가 그 파일에 없는 구성을 가리킨다 — r7 이설 뒤 남았고 D-010은 그 파일에서 해당 호출을 금지한다. 불변식 자체(ref 대입이 `run()` 앞)는 성립한다 | verify r8 · 기준 밖 · 위생 | 주석을 helper를 가리키도록 고친다. r7 D39와 같은 축 | **closed r10** — `bootstrap.ts:372-374`가 `createRuntimeModelAuthResume`를 설치 주체로 명시(검증 재독, verify r10 §12) |
| D46 | 가드 술어가 수신자 이름 `auth`에 묶여 `authRuntime.subscribe(` 형태는 우회한다. 오늘 더 엄격한 술어와의 차집합이 0이라 현재 `1건`은 참인 전수이므로 판정을 막지 않는다 | verify r8 · 기준 밖 · 관측 | D44를 정할 때 술어 폭도 함께 본다 | **closed(설계) r10** — D-010에 술어 폭을 기록했다. r10 설계 턴 재측정: production `.subscribe(` 5좌표 중 `auth.` 수신자 2좌표(전부 helper 안), 나머지 3좌표는 Auth 불변식 밖 — 차집합 0이라 현 술어 유지 |
| D47 | 채택한 양성 술어가 소멸 축을 절반만 덮는다 — `bootstrap.ts:629`를 `resumeAuth: () => void authResume.run()`으로 바꾸고 unused를 4단계 정리하면 typecheck 0·eslint 0·vitest 210/215 파일·2066/2108 케이스가 **베이스라인과 동일**하고 production Auth listener는 0개다(변이 M-Q). §10 부팅 시퀀스 행이 "listener 설치 유일성" 1지점만 열거해 **설치 실재**가 지점으로 없다 | verify r9 · AC6·AC11·§10 부팅 시퀀스 행·D-010 | ① §10 부팅 시퀀스 행에 설치 실재 지점을 세우고 분모를 고친다 ② D-010에 양성 술어의 대상 심볼을 적는다 — `createRuntimeModelAuthResume(` production 호출부 `['bootstrap.ts']`가 M-P·M-Q를 함께 덮는다 · **규범 정정 필요** | **closed(설계) r10** — ① §10 부팅 시퀀스 행 4지점(분모 30→32) ② D-010에 대상 심볼 2건 명기. **설치 실재 가드의 잠금 구현은 r10 재구현이 §10 신설 지점으로 닫는다** → 구현·검증 완료: 인용 변이 M-Q 수렴 검출(verify r10 §4) |

## [구현자 기입] r2 사용자 피드백 반영

- 판정: env family 기본 모델을 먼저 구성하고 `availableModels`를 뒤에 합치며, family alias가 같아도 실제 모델명이 다르면 전부 보존한다.
- 강제 지점: 정적 parser 병합 1/1, 정적·runtime normalizer 2/2, main·renderer model key 2/2, Engine·Composer 표시 2/2를 닫았다.
- custom은 `alias:'custom'`·`model:<실제 이름>`으로 만들고, 선택 key·default·fallback 해석은 `model`을 우선해 `custom` 문자열이 SDK에 전달되지 않는다.
- 관측: 관련 Vitest 5파일 39케이스 통과, lint 0 error/기존 warning 1, typecheck 3/3, doc inventory 9 items·76 channels, `git diff --check` 통과.
- AC 자기보고: ✅ AC1~AC8·AC10~AC14 = 13, ⚠️ AC9 = 실제 앱 두 테마 시각 확인 대기. `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14`.
- Review Signals: 사용자 피드백은 r1의 family alias 중복 제거와 custom alias 의미가 같은 `alias` 필드에 겹친 축을 바로잡았다. 현재 라운드는 2다.

## [구현자 기입] r3 verify/FAIL 재구현

- 판정: verify r2의 D1~D10을 전건 닫았다. D1은 사용자 원문의 `ANTHROPIC_DEFAULT_<FAMILY>_MODEL` 선행 구성이 default 우선권도 가진다는 해석으로 구현했다.
- 강제 지점: exact shape 2/2, family/model identity 4/4, Auth 전이 5/5, 로그인·세션·턴 3/3, read-only 6/6, 두 UI snapshot 2/2로 총 22/22다.
- Product/UX: 세션 로드의 `modelFamily:null`은 저장 provider를 유지한 채 그 provider의 default 모델로 hydrate한다. settings/runtime key 충돌은 runtime read-only 행 하나로 합친다.
- 관측: 관련 Vitest 18파일 124케이스 통과; bridge/turn 대상 2파일 11케이스 통과; lint 0 error/기존 warning 1; typecheck 3/3; doc inventory 9 items·76 channels; `git diff --check` 통과.
- AC 자기보고: ✅ AC1~AC8·AC10~AC14 = 13, ⚠️ AC9 두 테마 시각 확인. `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14`.
- Review Signals: r2와 같은 모델 identity 축의 재구현이며 현재 라운드는 3이다. 다음 재구현이 필요하면 handoff-review를 먼저 수행한다.

## [구현자 기입] r4 verify/FAIL 재구현

- **판정: D11~D14·D16 해결, D15 부분 처리.** review round 15(`1a2c0c6`) 뒤 AC4·AC13과 형제 소비처를 전수 재측정했다. 과거 커밋 trailer/type 혼입은 history rewrite 없이 보고만 유지한다.
- **D11 / AC4 해결.** `markDefaultModel` 한 함수가 settings·runtime의 sonnet→haiku→opus→첫 항목 규칙을 소유하며, 동일 3모델 배열의 default가 `claude-sonnet-4-5`로 일치하는 production 함수 테스트를 추가했다. §10의 기본 선택 동일성 행 신설은 규범 변경이므로 설계자 정정 제안으로 남긴다.
- **D12 / AC13 해결.** runtime catalog 항목의 턴은 `HarnessRuntimeConfigService.cached()`만 읽고 cache miss를 명시 실패로 만들었다. `validUntil` 뒤 시계를 120초 이동한 두 번째 턴에서도 augmenter 호출은 1회다.
- **D13 해결.** `resolveTurnProvider`가 `agent:list`와 같은 `mergeAgentEnvironments`를 사용해 key 충돌 시 runtime 행을 선택하며, settings/runtime 충돌 fixture가 실행 모델 `runtime-model`을 단언한다.
- **D14·D16 해결.** IPC 문서는 custom을 `alias='custom'`·`model=self`로 정정했고, `verified:true`인 `expired`·`unknown` 두 상태가 entry를 제거하는 테스트를 추가했다.
- **강제 지점 자기보고: 22/22.** exact shape 2/2 · family/model/self 4/4 · Auth 전이 5/5 · 로그인/세션 fetch 3/3 · read-only 6/6 · 두 UI snapshot 2/2. 추가 불변식인 producer default 동일성은 production 함수 대조 1/1, key 충돌 소비처는 목록·턴 2/2다.
- **Product/UX 파생:** runtime cache가 없으면 턴이 network fallback 없이 오류로 끝난다. 이는 D-008의 “Gate 로그인만 fetch”를 지키며 버튼 무반응이 아니라 기존 턴 오류 경로로 관측된다. 신규 문자열·의존성·IPC 채널은 없다.
- **설계 대비 차이 재유도:** 전용 catalog cache 대신 runtime service cache를 쓰는 기존 차이의 고유 실패 모드 `validUntil`을 AC13에서 다시 단언했고 1회 로그인 + 만료 후 2턴의 fetch 수 1을 관측했다.
- **게이트:** 대상 5파일/44케이스 PASS · typecheck 3구성 PASS · eslint 0 error · doc inventory PASS · 전체 vitest는 기존 better-sqlite3 바인딩 부재 5파일/42케이스만 FAIL.
- **AC 자기보고:** ✅ AC1~AC5·AC7·AC8·AC10·AC12~AC14 = 11, ⚠️ AC6·AC9·AC11 = 3, ❌ 0, 총 14. AC6·AC11 bootstrap 배선과 AC9 두 테마는 기존 사람/통합 경계다.
- **Review Signals:** r3의 동일 증상 D11·D13을 각각 공유 규칙과 형제 소비처 전수로 닫았다. 신규 파생 결함은 없고 D15의 과거 커밋 위생은 history rewrite 없이 남는다.

## [구현자 기입] r5 verify/FAIL 재구현

- **설계 리뷰:** 사용자 선택 A를 D-008에 반영했다. Auth 밖 settings 무효화는 재fetch하지 않고 runtime cache와 자동 catalog entry를 함께 제거한다.
- **강제 지점 전수:** runtime cache 무효화 3지점 중 auth-change 1곳은 기존 reconcile 제거, settings CRUD·부팅 deploy 2곳은 catalog invalidate를 추가해 3/3이다. exact shape 2/2 · family/model/self 4/4 · Auth 전이 5/5 · 로그인/세션 fetch 3/3 · read-only 6/6 · 두 UI snapshot 2/2, 총 22/22를 유지했다.
- **Product/UX 파생 검토:** 설정 변경 뒤 실행 불가능한 자동 모델은 Engine과 Composer에서 함께 사라진다. 기존 settings 모델은 유지되고 신규 사용자 문자열·무반응 경로는 없다.
- **놓친 잠재 문제 + 대응:** settings 무효화 중 늦은 fetch가 entry를 되살릴 수 있어 auth generation fence를 같은 invalidate 표면에 적용했다. 늦은 결과 fixture에서 catalog 0건을 관측했다.
- **설계 대비 명시적 차이:** 만료 축은 contribution key에서 턴 fetch 0을 유지한다. 공유 축은 settings CRUD·부팅 deploy가 cache와 catalog를 함께 비운다. 재진입은 같은 credential snapshot reconcile이 새 fetch를 허용한다. 다른 무효화 축인 auth-change는 기존 removeForAuth를 유지한다.
- **구현 보고:** D17~D23·W1 전건을 닫았다. canonical key를 merge/read-only/invalidate에 공유하고, fake 7곳·custom fallback 음성 기준·운영 가이드를 갱신했다.
- **관측한 게이트 산출:** eslint 0 error/기존 warning 1 · typecheck 3/3 · 대상 4파일 37/37 · doc inventory 9 items/76 channels · 전체 vitest 211파일 중 206 pass/5 ABI fail, 2092케이스 중 2048 pass/44 ABI fail.
- **AC 자기보고:** ✅ AC1~AC8·AC10~AC14 = 13, ⚠️ AC9 두 테마 시각 확인 = 1, ❌ 0, 총 14. `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14`.
- **Review Signals:** r4 D18은 cache 수명 공유 축 누락이었고 r5에서 invalidate 호출자 3/3을 닫았다. 신규 의존성·IPC·DB 변경은 없다.

## [구현자 기입] r6 verify/FAIL 재구현

- **설계 리뷰:** D-008·D-009와 AC5·AC7·AC11을 그대로 수행했다. 부팅 deploy 무효화 뒤에 catalog attach와 Auth 구독·resume을 한 production seam으로 묶었다.
- **강제 지점 전수:** cache 수명 4/4는 settings CRUD·부팅 deploy·Auth key 무효화·cross-auth owner reconcile이다. read-only는 settings DTO·runtime DTO·Engine action·IPC add/update/delete/read의 실효 6지점·7좌표를 유지했다.
- **이번 라운드 수정의 잠금:** startup catalog invalidate 삭제, engine catalog invalidate 삭제, settings collision filter 제거 변이 3건은 각 대상 스위트를 exit 1로 만들었다. production helper 배선은 `bootstrap.ts` source seam과 helper의 순서 단언을 함께 쓴다.
- **Product/UX 파생 검토:** cache가 빈 canonical runtime key는 colliding settings 행도 Engine·Composer·턴 후보에서 사라진다. 다른 key의 사용자 settings 행은 보존하며 신규 문자열·로딩·재시도 상태는 없다.
- **놓친 잠재 문제 + 대응:** `AUTH_INVALIDATED_HARNESS_KEYS[A]`가 B 소유 key를 가리킬 수 있었다. canonical key 소유자 전원을 계산해 현재 snapshot을 재조정하고 A/B 공동 key fixture로 선조치했다.
- **설계 대비 명시적 차이:** 없음. D-009의 부팅 순서는 `settings invalidate → runtime invalidate → catalog invalidate → attach → Auth subscribe/resume`로 구현했다.
- **구현 보고:** production 5파일·테스트 5파일·handoff 2파일, 신규 의존성·IPC·DB 변경 0이다. D24~D30을 닫았고 D31의 과거 커밋은 history rewrite 없이 유지했다.
- **대상 커밋:** `a843557` — r6 production·테스트 구현 좌표. *[검증자 교정]* 원문은 `d214581`이었으나 그 객체는 이 저장소의 어떤 ref에도 없다(D36).
- **관측한 게이트 산출:** 대상 5파일/40케이스 PASS, eslint 0 error, typecheck 3구성 PASS, `git diff --check` PASS. 전체 vitest는 기존 DB ABI 경계에서 `queries` 28건·`chat-turn.continuity` 2건 red를 출력한 뒤 최종 집계 없이 중단됐다.
- **AC 자기보고:** ✅ AC1~AC8·AC10~AC14 = 13, ⚠️ AC9 두 테마 시각 확인 = 1, ❌ 0. `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14`.
- **Review Signals:** r5 D24·D25·D29의 cache 수명 축을 부팅 순서·동일 key 미노출·cross-auth owner 전수로 닫았다. 현재 라운드는 6이며 review round 17 이후 첫 구현이다.


## [구현자 기입] r7 verify/FAIL 재구현

- **설계 리뷰:** D35가 정정한 `deploy 무효화 < catalog attach < Auth 구독 < resume` 순서를 그대로 수행했다. D32~D34의 잠금과 D38~D39의 문서·주석 정합만 바꾸고 제품 계약·공개 타입·의존성은 바꾸지 않았다.
- **강제 지점 전수:** 부팅 시퀀스 2/2는 순수 helper의 5단계와 Auth resume factory의 구독 2회→run 순서로 관측했다. cache 수명 4/4 중 cross-auth owner 호출 결과는 공유 key의 A·B 모두 reconcile됨을 관측했다. read-only 6지점·7좌표 중 목록 IPC 좌표는 실제 `agent:list` callback에서 충돌 settings 행 0건을 관측했다.
- **이번 라운드 수정의 잠금:** `agent:list`의 catalog 세 번째 인자를 제거하면 신규 handler 테스트가 settings 행을 반환해 실패한다. Auth resume factory에서 구독 하나를 제거하거나 run을 앞으로 옮기면 순서 테스트가 실패한다. cross-auth 실행 helper에서 owner 반복을 자기 authId로 좁히면 reconcile 관측값 `['a','b']`가 깨진다.
- **Product/UX 파생 검토:** 신규 사용자 대면 문자열·상태·실패 경로는 없다. Engine과 Composer가 이미 공유하는 `agent:list` snapshot의 충돌 행 미노출만 production callback에서 잠갔다.
- **놓친 잠재 문제 + 대응:** D32의 source 문자열 검사를 새로 만들지 않고 IPC 등록 callback을 호출했다. D33은 부팅 helper에 전달되는 callback을 순수 factory 산출로 만들어 두 listener 설치와 실제 run callback 순서를 함께 잠갔다. D34는 반환값만 검사하지 않고 invalidate와 reconcile side effect를 관측했다.
- **설계 대비 명시적 차이:** 없음. 전용 상태·저장소·새 추상화 수명은 추가하지 않았고 기존 startup seam에 실행 helper 두 개를 두었다.
- **구현 보고:** production 2파일, 테스트 2파일(신규 1), 현재 아키텍처 문서 1파일, handoff 2파일을 변경했다. D32~D34·D38·D39를 닫았고 D37은 이번 규범 커밋과 구현 커밋 분리를 준수해 닫았다. 신규 의존성·IPC·DB 변경은 0이다.
- **대상 커밋:** `(r7 구현 — 검증자 기입)`.
- **관측한 게이트 산출:** 대상 Vitest 2파일·5케이스 PASS, typecheck 3/3 PASS, eslint 0 error, doc inventory PASS, `git diff --check` PASS.
- **AC 자기보고:** ✅ AC1~AC8·AC10~AC14 = 13, ⚠️ AC9 두 테마 시각 확인 = 1, ❌ 0. `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14`.
- **Review Signals:** D32는 read-only 목록 잠금 축, D33은 부팅 배선 잠금 축, D34는 cross-auth cache 수명 축으로 모두 r6에서 보고만 초록이었던 production 좌표다. 현재 라운드는 7이며 review round 18 뒤 첫 구현이다.

## [구현자 기입] r8 verify/FAIL 재구현

- **설계 리뷰:** D-010과 r8 변경 3행을 그대로 수행했다. 제품 계약·공개 타입·신규 의존성은 바꾸지 않았다.
- **강제 지점 전수:** §10은 exact shape 2 + identity 4 + Auth 전이 5 + fetch 3 + read-only 7 + cache 수명 6 + 부팅 2 + UI 2 = **31좌표/30지점**이다. `rg -n "auth\\s*\\.\\s*subscribe\\s*\\(" app/src/main --glob '*.ts' --glob '!*.test.ts'`의 production 호출은 startup 2좌표·1파일이고 `rg -n "RUNTIME_MODEL_CONTRIBUTIONS\\s*\\." app/src/main --glob '*.ts' --glob '!*.test.ts'`의 production 변형은 0건이다.
- **이번 라운드 수정의 잠금:** M-H2(bootstrap subscribe 추가)와 M-D3(contribution filter 추가)는 유일성 가드를 각각 red로 만들었다. M-B3(settings 전건 폐기)는 handler 테스트를 red로 만들었다.
- **Product/UX 파생 검토:** 신규 문자열·상태·저장소·실패 경로는 없다. 기존 목록에서 충돌 runtime 행은 숨기되 비충돌 settings 행은 보존하는 결과만 더 강하게 잠갔다.
- **놓친 잠재 문제 + 대응:** 음성 가드의 대상 집합·Auth subscribe 술어·contribution 변형 술어를 각각 결함 주입으로 확인했다. bootstrap의 무효화 key 조립을 helper로 옮겨 배포 선언은 변형 없이 전달한다.
- **설계 대비 명시적 차이:** 없음. `createRuntimeModelAuthResume`은 listener 유일 설치점으로 유지하고, 새 invalidator helper가 cross-auth owner 재조정을 보존한다.
- **구현 보고:** production 2파일·테스트 3파일·handoff 2파일을 변경했다. 신규 의존성·IPC·DB 변경은 0이다.
- **대상 커밋:** `(r8 구현 — 검증자 기입)`.
- **관측한 게이트 산출:** 대상 3파일/11케이스 PASS, typecheck 3/3 PASS, eslint 0 error, scripts/doc inventory PASS. 전체 Vitest는 비-DB 210개 파일이 pass했고 기존 Electron ABI의 DB 5파일/44케이스만 red다.
- **AC 자기보고:** ✅ AC1~AC8·AC10~AC14 = 13, ⚠️ AC9 두 테마 시각 확인 = 1, ❌ 0. `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14`.
- **Review Signals:** r7의 D40은 배선 유일성·선언 무변형, D42는 음성 단언의 반대편 보존 축이다. 현재 라운드는 8이며 review round 19 뒤 첫 구현이다.

## [구현자 기입] r9 피드백 제안 검토·부분 구현

- **설계 리뷰:** D44의 두 제안 가운데 양성 술어를 채택했다. production composition root의 실제 호출 존재를 직접 재며, `resumeAuth` 타입 강화는 빈 callback을 막아도 startup helper 호출 자체의 소멸을 막지 못한다. Decision·AC·§10 규범 행은 구현자 권한으로 바꾸지 않았다.
- **강제 지점 전수:** 부팅 시퀀스의 listener 설치 지점 1개와 startup 호출 지점 1개를 각각 음성·양성 술어로 검사한다. production `auth.subscribe(` 파일은 `runtime-model-startup.ts` 1개, helper 정의 파일을 제외한 `startRuntimeModelCatalogAfterDeploy(` 호출 파일은 `bootstrap.ts` 1개다.
- **이번 라운드 수정의 잠금:** D44가 인용한 M-P의 소거 방향으로 `bootstrap.ts` 호출명을 제거하면 신규 양성 가드가 `expected [] to deeply equal ['bootstrap.ts']`로 실패했다. 원상 복구 뒤 대상 2파일·12케이스가 통과했다.
- **Product/UX 파생 검토:** 신규 사용자 문자열·상태·저장소·실패 경로는 없다. 기존 runtime 모델 catalog의 부팅 진입점 소멸만 기계적으로 차단한다.
- **놓친 잠재 문제 + 대응:** 신규 양성 술어의 대상 집합은 중첩 production 포함·테스트 제외 fixture로, 추출과 실재 판정은 정의·주석·문자열만 있는 0건 fixture와 실제 호출 1건 fixture로 확인했다. basename 비교는 현재 동명 파일이 없지만 향후 동명 composition root를 구분하지 못할 수 있어 기준 밖 관측으로 남긴다.
- **설계 대비 명시적 차이:** D44의 양성 술어 제안을 코드로 먼저 구현했지만 D-010과 §10 실패 의미의 규범 정정은 아직 없다. 만료·공유·재진입·다른 무효화 축은 검사 전용 소스 스윕이고 런타임 상태가 없어 해당 없음이다.
- **구현 보고:** 테스트 1파일과 handoff 보고 1파일을 변경했다. D44의 production 소멸 변이는 검출하지만 규범 행 정정이 남아 D44 상태는 open을 유지한다. D45·D46은 관측 범위이고 신규 의존성·IPC·DB 변경은 0이다.
- **대상 커밋:** `(r9 부분 구현 — 좌표는 INDEX)`.
- **관측한 게이트 산출:** 대상 Vitest 2파일·12케이스 PASS, typecheck 3/3 PASS, eslint 0 error·기존 warning 1, doc inventory 9항목·76채널 PASS, `git diff --check` PASS. M-P 소거 변이는 대상 1파일·7케이스 중 신규 가드 1건 red로 검출했다.
- **AC 자기보고:** ✅ AC1~AC8·AC10~AC14 = 13, ⚠️ AC9 두 테마 시각 확인 = 1, ❌ 0. `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14`.
- **Review Signals:** bootstrap 호출부 잠금은 r5~r8과 같은 배선 축이며 r8 D44가 인용한 소거 변이를 이번에는 검출한다. 현재 라운드는 9이고 handoff-review round 20 뒤 첫 구현이다.

## [구현자 기입] r10 verify/FAIL 재구현

- **설계 리뷰:** r10 설계 턴(D44·D46·D47 정정)이 정한 §10 부팅 시퀀스 4지점·D-010 양성 실재 술어 2심볼을 그대로 수행했다. Decision·AC·§10 규범 행은 이번 커밋에서 바꾸지 않았다 — `plan.md` 변경은 본 `[구현자 기입] r10`뿐이다.
- **강제 지점 전수:** 부팅 시퀀스 행 **4/4** — ① 5단계 순서: `runtime-model-startup.test.ts` 주입 관측(기존) ② 설치 유일성: `no-stray-auth-subscribe.test.ts:38` 음성 단언 ③ startup 호출 실재: `:42` 양성 단언 ④ **설치 실재(신설 지점)**: `:46` 양성 단언 `toEqual(['bootstrap.ts'])`. 이번 턴 전수 검색(불변식의 주어 = 설치/호출 심볼): 테스트 제외 `auth.subscribe(` 파일 1(`runtime-model-startup.ts`) · 정의 파일 제외 `startRuntimeModelCatalogAfterDeploy(` 호출 파일 1(`bootstrap.ts:622`) · 정의 파일 제외 `createRuntimeModelAuthResume(` 호출 파일 1(`bootstrap.ts:629` — `:74` import 식별자는 호출 형태 불일치로 미포함). 다른 7행은 r10 diff 밖(verify r9 §5가 재측정 완료).
- **이번 라운드 수정의 잠금:** 분모 = D47 인용 변이 **M-Q** 1건. `bootstrap.ts:629`의 `resumeAuth: createRuntimeModelAuthResume({…})`를 `resumeAuth: () => void authResume.run()`으로 치환하자 신설 가드만 red — `expected [] to deeply equal ['bootstrap.ts']`(1 failed | 8 passed). 회귀 확인으로 M-P(호출 블록 삭제)도 다시 심어 **2 red**(startup·설치 실재 둘 다)를 관측했다 — r9 장치의 시야 유지. 원상 복구 후 대상 2파일·14케이스 전건 green. D45 주석 정정은 동작 보존 위생이라 인용 변이 없음 — 잠금 해당 없음(주석은 어떤 게이트의 판정에도 안 들어간다).
- **Product/UX 파생 검토:** 신규 사용자 문자열·상태·저장소·실패 경로 없음. production 코드 변경은 `bootstrap.ts` 주석 3줄(D45)뿐이라 관측 가능한 동작 불변.
- **놓친 잠재 문제 + 대응:** 신설 술어의 판정 지점을 fixture로 확인했다 — 대상 집합(중첩 포함·테스트 제외, `:73`), 실재 판정(정의 파일·import 절 식별자·주석·문자열 전부 0건 → 실제 호출만 1건, 신설 self-test `detects resume installer calls…`). 공통 helper `productionCallers`로 추출해 두 양성 술어의 정의 파일 제외 규칙이 한 벌이다. basename 비교의 동명 파일 한계는 r9와 동일(오늘 동명 production 파일 각 1개 — 기준 밖 관측 유지).
- **설계 대비 명시적 차이:** 없음 — §10 4지점·D-010 문면 그대로다. 만료·공유·재진입·다른 무효화 축은 검사 전용 소스 스윕에 런타임 상태가 없어 전 축 해당 없음(r9와 동일 근거).
- **구현 보고:** 변경 2파일 — `no-stray-auth-subscribe.test.ts`(+술어 1·단언 3·self-test 1, 7→9케이스) · `bootstrap.ts`(D45 주석 3줄). 신규 의존성·IPC·스키마·DB 변경 0. 이번 라운드가 닫는 파생 이슈: D47 구현 절반(§10 ④ 지점, M-Q 검출 관측 위), D45(주석이 helper를 가리킨다 — `bootstrap.ts:372-374` 재독 확인). D44·D46·D47 규범 절반은 설계 커밋(좌표는 INDEX)이 닫았다.
- **대상 커밋:** `(r10 구현 — 좌표는 INDEX)`.
- **관측한 게이트 산출:** 대상 vitest 2파일·**14케이스** PASS(가드 7→9케이스) · typecheck node/web/test 3구성 **0 error** · eslint **0 error·1 warning**(`useTranscriptVirtualizer.ts:22` 기존) · 전체 vitest(Electron ABI 미빌드 환경) **210 pass/5 fail 파일 · 2068 pass/42 fail 케이스** — 실패 5파일이 `app/AGENTS.md` ABI 베이스라인 목록과 일치, 총 케이스 2108→**2110**(+2 = 이번 신설). doc inventory `9 items, 76 channels` PASS · `git diff --check` 출력 없음. lint `--fix` 실행 후 `git status --short` = 내 변경 2파일뿐.
- **AC 자기보고:** ✅ AC1~AC8·AC10~AC14 = 13, ⚠️ AC9 두 테마 시각 확인 = 1, ❌ 0. `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14`. r9에서 ⚠️였던 AC6·AC11은 M-Q 잠금 관측(위)으로 ✅ 주장 — 검증자 재측정 대상.
- **Review Signals:** r5~r9와 같은 bootstrap 배선 축의 마지막 열린 반쪽(설치 실재)을 닫는다. 규범(§10 ④·D-010 심볼)은 이번 라운드 시작 전에 이미 있었다. 현재 라운드 10, review round 21 완료 후 첫 구현.
