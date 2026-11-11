# Plan — 0310-bloat-reduction-test-only-exports-and-model-wiring

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0305 감사](../0305-code-bloat-audit/audit.md) §3 C-07·C-29 · §9 분할안 H-E·H-I, [0309 plan](../0309-bloat-reduction-chat-activity-state/plan.md) D-002, [0307 plan](../0307-bloat-reduction-unreached-and-constant-args/plan.md) D-012다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0310-bloat-reduction-test-only-exports-and-model-wiring` |
| 작성자 | Claude Code |
| 일자 | 2026-11-11 |
| 매핑 | 0305 분할안 H-E(C-07 + 고아 2파일) · H-I(C-29) |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0202의 런타임 모델 배선 V는 이번에 바꾸지 않는 자리(D-007)만 덮는다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 작업 — root `AGENTS.md` 협업 워크플로우) |
| 조사 기준 커밋 | `eecef01` (`git cat-file -t` → commit · PR 브랜치 좌표, `main` 조상 여부 미확인) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 제품 경로 어디서도 불리지 않고 테스트만 부르는 함수가 prod 소스에 남아 있고, 그 테스트는 죽은 코드를 잠근다. 런타임 모델 무효화는 호출 1곳짜리 함수 3개에 걸쳐 있다.
- 완료 후 달라지는 것: 죽은 export 21개와 고아 컴포넌트 2파일, 그 전용 테스트가 없다. 무효화 규칙이 함수 하나에 있다. 화면과 동작은 그대로다.
- 성공을 사용자 관점에서 한 문장으로: 앱이 지금과 똑같이 동작하고, 자격증명이 바뀌면 모델 목록이 지금과 같은 때에 다시 맞춰진다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "305 핸드오프 결과를 바탕으로 최적화 진행하겠다. 309까지 작업했다. 이어서 plan 만들어라" | 라이브 세션 턴 1 |
| 명시 요구 | 0310 범위는 "H-E 테스트 전용 export, H-I 런타임 모델 배선 팩토리" — 선택지 설명: "C-07 죽은 것만(0309 D-002로 승인됨) + 참조 0인 BayerPattern.tsx·Histogram.tsx" · "C-29. 감사 추정 절감 prod 약 25줄. 회귀 판정은 부팅·연결 상태·모델 선택(S-01·S-02·S-23)" | 질의 2 답(복수 선택) |
| 상속 | C-07은 "죽은 것만 제거 승인" — "제품 코드 어디서도 불리지 않고 테스트만 부르는 함수는 그 테스트와 함께 지웁니다. 테스트 지원 파일(*.testlib.ts)과 의도된 seam(메모리 저장소 대역, 포크가 채우는 인증 spec 등)은 남기고 항목별 분류표를 plan에 적습니다." | 0309 plan §2 · D-002 |
| 상속 | 회귀 금지 · 판정 단위는 시나리오별 관측 동작 · 목표는 코드 감량 · 백그라운드/서브 에이전트 금지 · 단계마다 커밋 | 0305 plan D-003 · D-011 · D-006 · D-007 |
| 추론 의도 | H-I의 감사 분해안(한 줄 클로저 3개 되돌리기)이 채택 결정·가드와 충돌하면 그 자리는 두고, 같은 파일의 다른 호출 1곳짜리 함수를 줄인다 — 회귀 금지와 감량 목표를 둘 다 지키는 범위(0309 D-006과 같은 처리) | §4 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이번 handoff는 0305 분할안 H-E와 H-I를 다룬다 | "H-E 테스트 전용 export, H-I 런타임 모델 배선 팩토리" | 질의 2 | ACTIVE | — |
| D-002 | C-07은 죽은 것만 지운다 — 제품 코드에서 불리지 않고 테스트만 부르는 함수와 그 테스트. 테스트 지원 파일과 의도된 seam은 남긴다 | "죽은 것만 제거 승인" | 0309 D-002 | ACTIVE | — |
| D-003 | 회귀 금지. 판정 단위는 시나리오별 관측 동작이고, 내부 구조에 묶인 테스트는 통합·삭제할 수 있다 | 0305 D-003 | 0305 plan §3 | ACTIVE | — |
| D-004 | 목표는 코드 감량이다. CI·가드·테스트 인프라를 따로 줄이지 않는다 | 0305 D-011 | 0305 plan §3 | ACTIVE | — |
| D-005 | 백그라운드·서브 에이전트를 쓰지 않는다. 단계마다 커밋을 남긴다 | 0305 D-006 · D-007 | 0305 plan §3 | ACTIVE | — |
| D-006 | "죽었다"의 판정은 셋을 다 만족하는 것이다 — ① prod 소스(`.d.ts` 포함)에 선언 외 참조 0 ② 포크·배포 확장 문서와 아키텍처 문서가 진입점으로 지목하지 않음 ③ 지워도 살아 있는 코드를 관측하던 테스트가 줄지 않음(관측만 하던 자리는 직접 단언으로 바꾼다) | D-002의 "죽은 것만"·"의도된 seam은 남기고"를 판정 가능한 조건으로 옮긴 것 | 설계자 판단 | ACTIVE | — |
| D-007 | C-29의 한 줄 클로저 3개(`createRuntimeModelSnapshotReader`·`…ReconcileVerified`·`…ReconcileSnapshot`)를 되돌리지 않는다 | `no-stray-auth-subscribe.test.ts:16-21`이 bootstrap에서 그 호출 형태를 정규식으로 요구하고, `runtime-model-startup.ts:59-63` 주석과 `docs/arch/backend/auth.md:158`이 0202 D4·D-008의 채택 결정으로 적는다 | 설계자 조사 | ACTIVE | 채택 결정 변경이라 사용자가 되돌리면 ΔV |
| D-008 | H-I의 구현 대상은 무효화 사슬이다 — `affectedRuntimeModelAuthIds`·`invalidateRuntimeModelsForAuth`를 유일한 호출자 `createRuntimeModelAuthInvalidator`에 합친다 | 두 함수는 prod 호출이 같은 파일 한 곳씩이고 나머지 참조는 자기 테스트 2건이다(§8). 배선 정의는 그대로 한 파일에 남는다(감사 C-29 위험 칸의 조건) | 설계자 조사 | ACTIVE | — |
| D-009 | `classifyAppCommand`를 남긴다 | `docs/arch/backend/provider-runtime.md:588`이 AppCommandPolicy의 seam으로 지목한다(D-006 ②). 지우려면 아키텍처 상태 표를 바꿔야 한다 | 설계자 조사 | ACTIVE | 사용자가 제거를 고르면 ΔV(약 10줄) |
| D-010 | 고아 2파일(`BayerPattern.tsx`·`Histogram.tsx`)을 지우고 문서의 그 행·언급을 걷는다. `stage-*` 토큰은 남긴다 | 0307의 camera 제거 뒤 참조 0(0309 §4) · 질의 2 선택지 설명에 포함. 토큰 제거는 CSS 범위라 D-004의 감량 대상(코드)과 판정 수단이 다르다 | 질의 2 · 설계자 판단 | ACTIVE | — |
| D-011 | 삭제로 새로 고아가 되는 심볼은 `lens-exports.mjs`가 새로 보고하는 것까지 지운다(폐포). 자기 파일 안에서만 쓰는 export의 `export` 떼기는 하지 않는다 | 폐포를 남기면 죽은 코드가 한 겹 더 생긴다. `export` 떼기는 줄 수가 줄지 않는다(D-004) | 설계자 판단 | ACTIVE | 0307 §11-4("보고되지 않는 미사용 export는 H-E 범위")를 닫는다 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-011. D-002~D-005는 상속.
- D-006~D-011은 설계자 판단이다. 완료 보고에서 D-007(채택 결정을 바꿔 한 줄 클로저를 걷을지)·D-009(`classifyAppCommand` 제거 여부)의 선택지를 알린다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0.
  - D-002·D-006 ↔ AC1·AC2: AC1이 제거 23이름을, AC2가 유지 39이름을 집합으로 요구한다 — 두 집합의 교집합 0(§8 분류표).
  - D-003 ↔ AC3·AC4: 두 행의 동작 기준이 "지금과 같다"이고 기대값은 변경 전 코드에서 얻는다(§7 주의사항).
  - D-007 ↔ AC5: 세 팩토리와 가드 파일의 diff 0을 요구한다. AC4는 그 셋을 지우라고 하지 않는다.
  - D-009 ↔ AC1·AC2: `classifyAppCommand`는 유지 집합에 있다.
  - D-010 ↔ AC1·AC6: 2파일 부재와 문서 링크 0을 요구하고 `tokens.css`는 §18에 없다.
  - D-004 ↔ AC7: prod·test 순감을 요구한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 죽은 함수의 테스트는 제품 동작을 잠그지 않으면서 잠근 것처럼 보인다 | `gitQueryReason.test.ts:24-104`는 `gitStatusQueryReason`·`gitSummaryQueryReason`을 재지만 훅은 `planGitSnapshotQuery`만 부른다(`useGitSnapshot.ts:121`) |
| 이미 기존 코드가 충족하는가 | 아니오 | §8 스캐너 출력 — dead 10 · testOnly 50 |
| 더 작은 해법이 있는가 | 없음 — 삭제가 최소다 | — |
| 선행 자료의 주장을 코드와 대조했는가 | **전제 정정 4건** | 아래 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | C-29 분해안이 0202 D4와 충돌 → D-007로 제외 | `no-stray-auth-subscribe.test.ts:16-21` |

전제 정정(0305 감사 주장 ↔ 현재 코드):

| 후보 | 감사 주장 | 재실측 | 처리 |
|---|---|---|---|
| C-07 | 테스트만 쓰는 prod export 50개 | 50개 중 죽은 것은 19개다. 31개는 스캐너 오탐 1 · 테스트 지원 7 · 테스트 대역 4 · 포크 표면 8 · 호환 alias 4 · 살아 있는 코드의 관측 진입 6 · 문서 지목 seam 1 | §8 분류표 |
| C-07 | `OoApi`는 테스트 2파일만 쓴다 | `preload/index.d.ts:1,5`가 `window.oo`의 타입으로 쓴다 — 스캐너가 `.d.ts`를 뺀다(`lens-exports.mjs:4`) | 유지 |
| C-29 | 한 줄 클로저 3개를 호출 자리의 식으로 되돌린다(25줄) | 그 호출 형태를 소스 스윕 테스트가 요구한다 | D-007 — 제외 |
| C-29 | export 팩토리 7개 전부 호출 1곳 | 그 밖에 export 2개(`affectedRuntimeModelAuthIds`·`invalidateRuntimeModelsForAuth`)가 같은 파일 한 곳에서만 불린다 | D-008 — 대상 |

조사에서 새로 본 것:

- `docs/arch/backend/system-prompt.md:127`은 `getCwd`가 `projects/<이름>-<프로젝트ID8>`을 준다고 적지만 그 이름을 만드는 `workspaceDirName`의 prod 호출이 0이다(`paths.ts:105`). 문서가 낡았다 — 이번에 그 문장을 현재 코드(`getWorkspacePath`, `paths.ts:110-115`)에 맞춘다(AC6).
- `stage-*` 토큰은 고아 2파일 밖에서 쓰이지 않는다(`git grep -n 'stage-' -- app/src/renderer/src ':!*.css'`에서 두 파일 제외 0줄). D-010으로 남기고 완료 보고에 적는다.

- 사용자에게 올릴 결정: 없음(범위는 질의 2로 닫았다).
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

UI 변화는 없다. 관측자는 앱 사용자(연결 화면·모델 선택)와 포크 구현자(확장 표면이 그대로다)다.

```text
[자격증명이 바뀜 — 로그인·갱신·로그아웃]
  → [그 인증이 선언한 키 + 그 인증이 기여한 키의 하네스 캐시를 비운다]
  → [비운 키를 기여한 모든 인증의 모델 목록을 현재 snapshot으로 다시 맞춘다]
  ↘ [선언도 기여도 없는 인증이면 아무 일도 하지 않는다]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 자격증명 변경(S-02·S-23) | 위 흐름 — 비우기가 전부 끝난 뒤 재조정 | 모델 목록이 지금과 같은 때에 바뀐다 |
| 두 인증이 같은 키를 기여(대소문자·공백만 다름) | 둘 다 재조정, 인증마다 한 번 | 한쪽 카드만 빈 캐시 위에 남지 않는다 |
| 앱 부팅(S-01) | 변화 없음 | 지금과 같다 |
| git 행·변경 목록 조회 | 변화 없음 — 판정은 `planGitSnapshotQuery` 그대로 | 지금과 같다 |
| 포크가 `patSpec`·`confluenceTools` 등을 import | 변화 없음 | 포크 빌드가 깨지지 않는다 |

### 파생 UX / 엣지케이스

- loading / empty / error · cancel / retry / close / restart: 변화 없음.
- concurrency: 무효화는 동기 실행이다 — 순서(비우기 전부 → 재조정)가 유일한 축이고 §10 I4가 잠근다.
- 외부 소비자: 포크·배포 확장 표면 12이름(§8 K4·K5)은 그대로다. IPC 채널·스키마 변화 없음(`UpdateInstallResultSchema`는 어떤 핸들러도 쓰지 않는다 — `updater.ts:173`은 타입만 쓴다).

## 6. 범위 / 비범위

- **범위**: §8 분류표의 제거 15묶음(X-01~X-15, 이름 23 + 딸린 비export 4) · 그 전용 테스트 · 무효화 사슬 합치기(D-008) · 문서 5곳.
- **비범위**: 한 줄 클로저 3개(D-007) · `classifyAppCommand`(D-009) · `stage-*` 토큰(D-010) · 유지 39이름 · 자기 파일 안에서만 쓰는 export 574개의 `export` 떼기(D-011) · 그 밖의 분할안 묶음(H-D·H-G·H-J).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 한 줄 클로저 3개 · `classifyAppCommand` | 아니오 | 사용자가 채택 결정 변경을 고르면 ΔV |
| `stage-*` 토큰 | 아니오 | 완료 보고에 적는다 |
| H-D · H-G · H-J | 아니오 | 0305 분할안에 남는다 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | §8 제거 묶음 X-01~X-15의 선언과 2파일이 없다 | EP-01 검색 0줄 · `lens-exports.mjs`의 dead·testOnly 목록에 제거 이름 0 · typecheck 3종 | 해당 없음 — 참조 0 |
| R-02 | AC2 | §8 유지 39이름(dead 8 + testOnly 31)이 그대로 export된다. 삭제가 새 고아를 만들지 않는다 | `lens-exports.mjs` 출력의 dead 집합 = §8 K7 8이름, testOnly 집합 = §8 K1~K6 31이름(집합 일치 — 빠져도 늘어도 실패) | 포크 import · `preload/index.d.ts` |
| R-03 | AC3 | 지운 테스트가 살아 있는 코드를 관측하던 자리 5곳(§10 L1~L5)은 같은 동작을 계속 단언한다 | §7-A VP-02의 좌표 5개 | reducer · 메일 마이그레이션 · git 조회 판정 · 브랜치 목록 |
| R-04 | AC4 | 자격증명 변경의 무효화가 §5 흐름대로 동작한다 — §10 I1~I6. 규칙은 `createRuntimeModelAuthInvalidator` 하나에 있다 | `runtime-model-startup.test.ts` 기존 1건 + 고쳐 쓴 2건(§7-A VP-03) | `AuthChange` → `createRuntimeModelAuthChangeHandler` → `invalidateForAuth`(`bootstrap.ts:616`) |
| R-05 | AC5 | 한 줄 팩토리 3개와 그 가드가 그대로다 | `git diff <설계 커밋>..HEAD -- app/src/main/app/no-stray-auth-subscribe.test.ts` 0줄 · `runtime-model-startup.ts`의 세 함수 본문 diff 0 · 그 테스트 green | bootstrap 배선 |
| R-06 | AC6 | 문서가 지운 파일·이름을 가리키지 않고, `system-prompt.md:127`이 현재 cwd 규칙을 적는다 | EP-02 검색 0줄 · `node scripts/check-doc-inventory.mjs --check`(상대 링크 해석) | 문서 |
| R-07 | AC7 | prod 순감이 280줄 이상이고 test도 순감한다. 수치를 보고한다 | `git diff --numstat <설계 커밋>..HEAD -- app/src`를 prod/test로 갈라 합산 | 해당 없음 |
| R-08 | AC8 | §19 게이트가 green이거나 실패가 기준선과 같은 환경 서명이다 | §19 명령 산출 | CI |
| R-09 | AC9 | 개발 빌드가 뜨고, 연결 화면에서 자격증명을 바꾸면 모델 목록이 다시 맞춰진다 | 사람 실기 — §19 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: 인용한 케이스는 이번 세션에 실재를 확인했다 — `gitSnapshotPlan.test.ts:6,13` · `gitQueryReason.test.ts:112` · `repository.test.ts:29` · `runtime-model-startup.test.ts:248` · `chatReducer.parts.test.ts:72,141` · `migrate.test.ts:38`.
- 기대값의 출처: AC4의 고쳐 쓴 2건은 `createRuntimeModelAuthInvalidator`의 공개 시그니처가 그대로라 **합치기 전 코드에서 먼저 green**임을 확인한 뒤 합친다. AC3의 고쳐 쓴 단언도 같은 순서다.
- 사람 실기 항목: AC9. 판정 로직은 AC4가 기계로 본다.
- 총량/0건 기준: AC1의 불변식은 "없다"라 음성 검색이 방향에 맞다. "유지 이름이 있다"는 AC2의 집합 일치가 양성 짝이다 — 유지 이름을 잘못 지우면 testOnly 집합에서 빠져 실패하고, 포크 표면이면 typecheck는 통과하므로 이 집합 대조가 유일한 장치다.
- AC7의 280은 §14 단계 지도의 합(약 345)에서 포맷·주석 오차를 뺀 값이다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 코드 계약 V가 없다.
- 기준 V 상속 근거: 없음. 0202의 배선 V가 덮는 자리는 AC5가 diff 0으로 비영향을 본다.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: `AR↔IT`·`SD↔ST`는 두지 않는다 — `bootstrap.ts`의 조립과 `createRuntimeModelAuthInvalidator`의 시그니처가 바뀌지 않고 모듈 내부만 바뀐다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-09 | R | §7 각 행 | NEW | — |
| AT-01~AT-09 | AT | §7 검증 수단 칸 | NEW | — |
| MD-01 | MD | §10 무효화 규칙 I1~I6 | CHANGED | `runtime-model-startup.ts:9-58`(세 함수) |
| UT-01 | UT | §10 규칙 칸 ↔ UT 입력 칸 | CHANGED | `runtime-model-startup.test.ts:197,225,248` |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01·R-02 ↔ AT-01·AT-02 | REQUIRED | 소스 트리 | `gate:rg` EP-01 → 0줄 · `gate:node …/lens-exports.mjs` 집합 일치 · `gate:npm run typecheck` | required — 0건·전수 주장. 변이: (a) 유지 이름 `patSpec` 선언 삭제 → typecheck red(테스트 import) + testOnly 집합 불일치 (b) 제거 이름 `locationOf`를 되살림 → testOnly 집합 불일치(테스트가 없으면 dead 집합 불일치) | EP-01 149줄 35파일 |
| VP-02 | R-03 ↔ AT-03 | REQUIRED | L1 `RECV_EVENT` → `chatReducer` → `messages[].parts` · L2 `applyMigrationList` → `_migrations` · L3 `useGitSnapshot` effect → `planGitSnapshotQuery` · L4 훅 소스 배선 · L5 `listBranchRefs` → `gateway.read` | §10 L1~L5 좌표 | required — 삭제가 잠금을 함께 지우지 않았는지. 변이: (c) reducer가 reasoning 파트의 `signature`를 버림 → L1 red (d) `applyMigrationList`의 `record(…)` 제거 → L2 red (e) `planGitSnapshotQuery` 첫 분기를 `includeSummary: true`로 → L3 red (f) 훅 deps에서 `refreshTick` 제거 → L4 red | L1~L5 (5자리) |
| VP-03 | MD-01 ↔ UT-01 | REQUIRED | `createRuntimeModelAuthInvalidator(input)` → 반환 함수 `(authId)` → `input.invalidate` × 키 → `input.snapshotOf` · `input.reconcile` × 소유 인증 | §10 I1~I6 좌표 | required — 형제 슬롯(선언 키 항 ↔ 기여 키 항, 트리거 인증 ↔ 소유 인증). 변이: (g) 선언 키 항 제거 → I1 red (h) 기여 키 항 제거 → I1 red (i) 정규화 비교를 원문 비교로 → I2 red (j) 소유 인증 `Set` 제거 → I3 red (k) 재조정을 비우기 앞으로 → I4 red (l) `snapshotOf(owner)`를 `snapshotOf(authId)`로 맞바꿈 → I5 red | EP-03 3자리 |
| VP-04 | R-05 ↔ AT-05 | REGRESSION | bootstrap의 reader·sink 배선 | `no-stray-auth-subscribe.test.ts` 전체 · `runtime-model-startup.test.ts:93,128,145` | not selected — 손대지 않는 자리의 diff 0 | 0 — 변경 없음 |
| VP-05 | R-06 ↔ AT-06 | REQUIRED | 문서 → 소스 링크 | `gate:rg` EP-02 → 0줄 · `gate:node scripts/check-doc-inventory.mjs --check` | not selected — 링크 해석은 가드가 직접 본다 | EP-02 5줄 3파일 + `system-prompt.md:127` |

R-07~R-09는 측정·게이트·실기라 pair 없이 §19가 닫는다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/**` 수정 | §19 | 이번 변경이 만진 파일에서 난 실패와 기준선 밖 실패만 blocking |
| 테스트 풀·예산 가드 | 테스트 18파일을 수정·삭제한다 | `[test-pools]` · `node scripts/check-test-budgets.mjs` | 만진 파일의 위반만 blocking |
| 문서 인벤토리·이름 검사기 | `docs/arch` 4파일 수정 | `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` | 전부 blocking |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 스캐너는 prod 파일 1,032개에서 외부 prod 참조 0인 export 634개를 dead 10 · testOnly 50 · 자기 파일 내부 사용 574로 가른다 | `cd app && node ../docs/handoff/0305-code-bloat-audit/scan/lens-exports.mjs` |
| 스캐너는 `.d.ts`를 읽지 않고 식별자 단어 일치로 센다 | `lens-exports.mjs:4,9` |
| 훅은 `planGitSnapshotQuery`만 부르고 `gitStatusQueryReason`·`gitSummaryQueryReason`은 부르지 않는다 | `useGitSnapshot.ts:121` · 두 이름의 prod 참조는 선언 2줄뿐 |
| `planGitSnapshotQuery`의 여섯 분기는 이미 잠겨 있다 — 첫 조회·cwd 변경(상태만) · 세션만 전환(없음) · 턴 종료·수동(둘 다) · 변화 없음 | `gitSnapshotPlan.test.ts:6-24` |
| `gitQueryReason.test.ts`의 마지막 describe는 훅 소스 배선(살아 있는 코드)을 잰다 | `:112-126` |
| `repository.test.ts`의 `describe('resolveRepoRoot')` 안 첫 케이스는 `listBranchRefs`(살아 있음)를 잰다 | `:29-55` |
| `partsReasoning`은 reducer 테스트 2자리에서 결과 관측에 쓰인다 | `chatReducer.parts.test.ts:72,141` |
| `safeProjectName`·`shortProjectId`의 prod 호출자는 `workspaceDirName`뿐이다 | `paths.ts:106` |
| 무효화 사슬 세 함수 중 bootstrap이 부르는 것은 `createRuntimeModelAuthInvalidator` 하나다 | `bootstrap.ts:616` · 나머지 둘은 `runtime-model-startup.ts:31,50`에서만 |
| 가드가 한 줄 팩토리의 호출 형태를 요구한다 | `no-stray-auth-subscribe.test.ts:16,19,21` |
| 가드 스크립트 등록부에 이번에 만지는 테스트 파일 이름이 없다 | `grep -n '<18파일 이름>' app/scripts/*.mjs` → 0줄 |
| 제거 이름의 문서 참조는 5줄이다 | `design-components.md:60,71` · `design-system.md:38,173` · `layers.md:87` |
| INDEX 후보 표에 이번 파일과 겹치는 행이 없다 | 0308 행은 `chatStore.ts`·`background-controller.ts`, 나머지는 다른 파일 |

### 전수 조사 — 분류표 (D-002 · D-006)

제거(testOnly 19 + dead 2 = 스캐너 이름 21, 폐포 2):

| ID | 파일 | 지우는 것 | 딸린 테스트 처리 |
|---|---|---|---|
| X-01 | `main/features/chat/image.ts:9-29` | `imageCapabilityFor` + 비export `ImageCapability`·`DEFAULT_CLAUDE_IMAGE_CAPABILITY` | `image.test.ts` 파일 삭제 |
| X-02 | `main/features/chat/recovery.ts:92-102` | `groupDanglingToolCallsByMessage` | `recovery.test.ts:56` 케이스 삭제 |
| X-03 | `main/features/chat/subagent-settlement.ts:101-107` | `coerceStoppedToolCompletion`(입력을 그대로 돌려준다) | `subagent-settlement.test.ts:70` 케이스 삭제 · `turn-coordinator.test.ts:1274` 주석 문장 정정 |
| X-04 | `main/features/plugins/mail/store/migrate.ts:19` | `MAIL_MIGRATION_NAMES` | `migrate.test.ts:38`을 `MAIL_MIGRATIONS.map(…)`로(L2) |
| X-05 | `main/infra/config/json-file.ts:41-52` | 비동기 `readJsonObject` + `readFile` import | `json-file.test.ts:28-36` 케이스 삭제 |
| X-06 | `main/infra/config/paths.ts:87-107` | `workspaceDirName` + 폐포 `safeProjectName`·`shortProjectId` | `paths.test.ts:23-55` describe 3개 삭제 |
| X-07 | `main/infra/git/repository.ts:9-15,23-29` | `resolveRepoRoot`·`resolveHeadRef` | `repository.test.ts:56-110` 삭제 · `:29` 케이스는 남기고 describe 이름을 `listBranchRefs`로(L5) |
| X-08 | `main/infra/net/net-response.ts:73-82` | `locationOf` | `net-response.test.ts:70-90` describe 삭제 |
| X-09 | `renderer/…/common/composer/useGitSnapshot.ts:6-37` | `gitStatusQueryReason`·`gitSummaryQueryReason` + 비export `GitSnapshotQueryPoint` | `gitQueryReason.test.ts:24-104` 삭제(`:112` describe와 `:79` 키 단언은 남긴다 — L4) · `gitManualRefresh.test.ts:8-15` 삭제 |
| X-10 | `renderer/…/chat/lib/parts.ts:92-101,493-498` | `partsReasoning`·`partsErrors`(`ReasoningItem`은 남는다 — `ReasoningBlock.tsx:5`) | `parts.test.ts:109,476` 케이스 삭제 · `chatReducer.parts.test.ts:72,141`은 파트 직접 단언으로(L1) |
| X-11 | `renderer/…/chat/lib/planComments.ts:23-26` | `hasSendablePlanFeedback` | `planComments.test.ts:48-58` describe 삭제 |
| X-12 | `shared/file-edit-tool.ts:19,23-25` | `isFileEditToolName` + `FileEditToolName` | `file-edit-tool.test.ts:25-27` 단언 삭제 |
| X-13 | `shared/protocol.ts:274-278` | `UpdateInstallResultSchema` | `update-protocol.test.ts` 파일 삭제 |
| X-14 | `shared/time/clock.ts:35-44,66-71` | `monthDaysLeft`·`weekDaysLeft`·`weekDaysElapsedInMonth` | `clock.test.ts:27,33,45` 케이스 삭제 |
| X-15 | `renderer/src/shared/ui/BayerPattern.tsx` · `Histogram.tsx` | 파일 2개(78 + 47줄) | 테스트 없음 · 문서 EP-02 |

유지(testOnly 31 + dead 8 = 39):

| 분류 | 이름 | N | 근거 |
|---|---|---|---|
| K1 스캐너 오탐 | `OoApi` | 1 | `preload/index.d.ts:1,5` |
| K2 테스트 지원 파일 | `sourceScan.testlib.ts` 2 · `sparkReference.testlib.ts` 2 · `error-report-scan.testlib.ts` 3 | 7 | D-002 "테스트 지원 파일" |
| K3 테스트 대역·기반 | `createMemoryGrantPersistence`(15파일) · `createMemoryOAuthStatePersistence` · `warmFileSqlite`(7) · `scanOffenders`(4) | 4 | D-002 "메모리 저장소 대역" — 살아 있는 코드의 테스트가 쓴다 |
| K4 포크·배포 확장 표면 | `apiKeySpec`·`patSpec`·`passwordSpec` · `confluenceTools`·`jiraTools` · `JIRA_CATALOG_PRESENTATION_INPUT` · `MailCredential`·`MailConnection` | 8 | `docs/guides/closed-network-extensions.md`가 8이름 모두 지목 |
| K5 호환 alias | `DEFAULT_PLUGIN_CATALOG_ICON`·`normalizePluginCatalogPresentation` · `resolveLocalizedPluginText`·`pluginPresentation` | 4 | 0307 D-012 — `plugin-catalog.ts:1` · `pluginPresentation.ts:1` 주석 |
| K6 살아 있는 코드의 관측 진입·정본 상수 | `projectTimeline`(테스트 23자리가 head+tail 합성을 잰다) · `MODE_OPTIONS`(`optionByMode` 비export) · `SPARK_MARKS`·`SPARK_PERIOD_MS`·`SPARK_STEP_HZ`·`SPARK_REDUCED_MOTION_MARK`(`sparkTracks.ts:8-10` — CSS와 손 동기화하는 사본) | 6 | D-006 ③ — 지우면 살아 있는 코드의 테스트가 준다 |
| K6′ 문서 지목 seam | `classifyAppCommand` | 1 | D-009 |
| K7 dead 유지 | `plugin-catalog.ts` 타입·상수 6 · `PluginPresentation` · `DISABLED_HATCH_CLASS` | 8 | 0307 D-012 |

### 수치 / 전칭 표현 검산

- testOnly 50 = 제거 19(X-01~X-14의 스캐너 이름: 1+1+1+1+1+1+2+1+2+2+1+1+1+3) + 유지 31(1+7+4+8+4+6+1). dead 10 = 제거 2 + 유지 8.
- 제거 이름 23 = 스캐너 21 + 폐포 2(`safeProjectName`·`shortProjectId`). 딸린 비export 4 = `ImageCapability`·`DEFAULT_CLAUDE_IMAGE_CAPABILITY`·`GitSnapshotQueryPoint`·`FileEditToolName`(export지만 X-12와 함께 진다 — 참조가 그 함수뿐).
- "prod 참조 0": 23이름 각각 `git grep -n -w <name> -- app/src`에서 `.test.` 밖 줄이 선언(과 폐포 호출 2줄)뿐이다. EP-01 패턴의 prod 36줄 17파일이 전부 선언·자기 파일 내부다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

```text
createRuntimeModelAuthInvalidator(input)(authId)      runtime-model-startup.ts:38-58
  keys = 선언 키 ∪ 기여 키
  → invalidateRuntimeModelsForAuth({keys, …})         :23-36  (호출 1곳)
       for key: invalidate(key)
       → affectedRuntimeModelAuthIds(keys, contributions)  :9-21  (호출 1곳)
       for owner: reconcile(owner, snapshotOf(owner))
```

- 규칙 하나가 함수 3개·입력 객체 타입 3벌에 걸쳐 있고, 안쪽 둘은 자기 테스트만 따로 부른다.

### TO-BE — 변경 후 목표 구조와 동작 경로

```text
createRuntimeModelAuthInvalidator(input)(authId)
  keys = 선언 키 ∪ 기여 키
  for key: invalidate(key)
  owners = keys와 정규화 키가 같은 기여의 authId (중복 제거, 기여 순서)
  for owner: reconcile(owner, snapshotOf(owner))
```

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | 구현/AC |
|---|---|---|---|
| 무효화 규칙의 자리 | 함수 3개 | 함수 1개 | M2 · AC4 |
| 테스트 진입 | 안쪽 함수 2개 + 팩토리 | 팩토리만 | M2 · AC4 |
| 죽은 export | 21 + 폐포 2 | 0 | M1 · AC1 |
| 한 줄 팩토리 3개 | 있음 | 그대로 | AC5 |

### 핵심 책임 분리

- `runtime-model-startup.ts`: 배선 정의를 계속 한 파일에 둔다(0202 D4). import 방향 변화 없음.

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| R-01·R-02 / VP-01 — EP-01 | 제거 23이름 + 딸린 4 + 합쳐지는 2 | §8 분류표 | 구현자 | 149줄 35파일(prod 17 · test 18) — prod 36줄 | `git grep -n -w -E 'imageCapabilityFor\|ImageCapability\|DEFAULT_CLAUDE_IMAGE_CAPABILITY\|groupDanglingToolCallsByMessage\|coerceStoppedToolCompletion\|MAIL_MIGRATION_NAMES\|readJsonObject\|workspaceDirName\|safeProjectName\|shortProjectId\|resolveRepoRoot\|resolveHeadRef\|locationOf\|gitStatusQueryReason\|gitSummaryQueryReason\|GitSnapshotQueryPoint\|partsReasoning\|partsErrors\|hasSendablePlanFeedback\|isFileEditToolName\|FileEditToolName\|UpdateInstallResultSchema\|monthDaysLeft\|weekDaysLeft\|weekDaysElapsedInMonth\|BayerPattern\|Histogram\|HistogramProps\|affectedRuntimeModelAuthIds\|invalidateRuntimeModelsForAuth' -- app/src` → 0줄 | 남은 줄은 죽은 코드다. 게이트가 green인 채로 남는 차이: 스캐너가 단어 일치라 같은 이름의 다른 심볼이 생기면 가려진다 — 지금 트리에 그런 이름 0(검색 149줄 전부 대상) |
| R-06 / VP-05 — EP-02 | 문서의 제거 이름 | `docs/arch/frontend/*.md` | 구현자 | 5줄 3파일 + `system-prompt.md:127` | 위 패턴으로 `git grep -n -w -E … -- docs/arch docs/guides docs/TRD.md docs/PRD.md docs/IPC_CONTRACT.md docs/GLOSSARY.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md` → 0줄 | 문서가 없는 파일을 가리킨다. `design-system.md:38,173`은 행을 지우지 않고 `Bayer·Histogram` 언급만 걷는다 |
| MD-01 / VP-03 — EP-03 | 무효화 규칙 | `runtime-model-startup.ts` `createRuntimeModelAuthInvalidator` | 구현자 | 3자리: 키 합집합 식(`:44-47`) · 비우기 루프 · 소유 인증 재조정 루프 | `git grep -n -E 'invalidate\(\|reconcile\(\|canonicalAgentKey' -- app/src/main/app/runtime-model-startup.ts` | 자격증명이 바뀌어도 낡은 모델 목록이 남거나 다른 인증의 카드가 빈 캐시 위에 남는다 |

선언 경계:

- `lens-exports.mjs`는 `.d.ts`·동적 문자열 참조를 보지 않는다. `.d.ts` 소비는 typecheck가 막고(K1에서 확인), 소스 스윕 테스트가 이름을 정규식으로 요구하는 자리는 EP-01 검색이 테스트 파일까지 훑어 드러낸다 — 23이름에 대해 그런 자리 0.
- 포크 저장소의 import는 이 트리에서 관측할 수 없다. 제거 23이름은 `closed-network-extensions.md`에 없다(EP-02 검색 범위에 `docs/guides` 포함, 0줄).

규칙 칸 ↔ UT 입력 칸:

| 규칙 | 분기 | 입력 | 기대 | 좌표 |
|---|---|---|---|---|
| I1 비울 키 | 선언 키 ∪ 그 인증의 기여 키 | `invalidatedKeys: {a: ['runtime-env']}` · 기여 a `shared`, b `SHARED` · `('a')` | 비운 키 `['runtime-env', 'shared']` | `runtime-model-startup.test.ts:248` 기존 |
| I2 소유 인증 | 정규화 키가 같다(대소문자·앞뒤 공백) / 다르다 | `invalidatedKeys: {x: [' ORCINUS-ORCA-SHARED ']}` · 기여 a `orcinus-orca-shared`, b `ORCINUS-ORCA-SHARED`, c `orcinus-orca-other` · `('x')` | 비운 키는 원문 `[' ORCINUS-ORCA-SHARED ']` · 재조정 a·b, c 없음 | `:197` 고쳐 씀 ① |
| I3 | 한 인증이 맞는 기여를 둘 가진다 | ①에 기여 a `Orcinus-Orca-Shared` 추가 | a는 한 번 | ① |
| I4 순서 | 비우기 전부 → 재조정 | 키 2개·소유 2 — 한 배열에 `inv:`·`rec:` 기록 | `inv` 2개가 `rec` 앞 | `:225` 고쳐 씀 ② |
| I5 snapshot | 소유 인증의 snapshot을 호출 시점에 읽어 넘긴다 | `snapshotOf: (id) => ({ authId: id })` · 트리거 x ≠ 소유 a·b | `reconcile` 인자 쌍 `[a, {authId:'a'}]`·`[b, {authId:'b'}]` | ① |
| I6 | 선언도 기여도 없는 인증 | `('none')` | `invalidate`·`reconcile` 호출 0 | ② 둘째 단언 |
| L1 reducer 파트 | reasoning 파트 보존 | 기존 이벤트 열 | `parts.filter(type==='reasoning')`가 `[{type, text, signature}]` | `chatReducer.parts.test.ts:72,141` 고쳐 씀 |
| L2 마이그레이션 기록 | 전부 적용 | 기존 | `applied`가 `MAIL_MIGRATIONS.map(m => m.name)` | `migrate.test.ts:38` 고쳐 씀 |
| L3 git 조회 판정 | 여섯 분기 | 기존 | 기존 | `gitSnapshotPlan.test.ts:6,13` 변경 없음 |
| L4 훅 배선·키 | `busy` 미참조 · 단일 effect deps · 다른 cwd면 다른 키 | 기존 | 기존 | `gitQueryReason.test.ts:112` describe + `:79` 단언을 그 describe로 옮김 |
| L5 브랜치 목록 | 기존 | 기존 | 기존 | `repository.test.ts:29` 변경 없음 |

## 11. 구현 설계

- 접근 요약: 삭제(M1)와 합치기(M2)를 따로 커밋한다(D-005).
- 단계별 구현:
  1. **M1 — H-E**. X-01~X-15를 지우고 딸린 테스트를 §8 표대로 처리한다. L1·L2·L4의 고쳐 쓴 단언은 prod 삭제 전에 먼저 넣어 green을 확인한다. 문서 EP-02를 같은 커밋에 고친다.
  2. `lens-exports.mjs`를 다시 돌려 dead·testOnly 집합을 §8과 대조한다. §8에 없는 새 이름이 나오면 폐포로 지운다(D-011) — 그 이름이 D-006 ②·③에 걸리면 지우지 않고 `PLAN_GAP`으로 올린다.
  3. **M2 — H-I**. `runtime-model-startup.test.ts:197,225`를 팩토리 진입으로 고쳐 써 **합치기 전 코드에서 green**을 확인한 뒤(I2~I6), 세 함수를 §9 TO-BE로 합친다.
- 변경하지 않는 것: `bootstrap.ts` · `no-stray-auth-subscribe.test.ts` · 한 줄 팩토리 3개 · 유지 39이름 · `tokens.css`.

### 테스트 가능성

| 대상 | seam / 주입점 | 테스트 종류 | 이유 |
|---|---|---|---|
| 무효화 규칙 | `createRuntimeModelAuthInvalidator` 입력 객체(순수) | UT | electron·DB 의존 없음 |
| 집합 일치 | `lens-exports.mjs` 출력 | gate | 열거 원문(§8)과 직접 대조 |

## 12. End-to-end 영향

### producer → consumer

| producer | 정규화/상태 | consumer | 계약 유지 방법 |
|---|---|---|---|
| `AuthChange`(`credentialChanged`) | `createRuntimeModelAuthChangeHandler` → `invalidateForAuth` | `harnessRuntime.invalidate` · 카탈로그 bridge | 팩토리 시그니처 불변 — `bootstrap.ts:616`·`opencode-connection-deployment.test.ts:161` diff 0 |

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음 — 등록·초기화 값을 늘리지 않는다.

## 13. Lifecycle / 오류 / 정리

| 상황 | 동작 | 사용자/운영 로그/정리 |
|---|---|---|
| `invalidate`·`reconcile`이 던짐 | 지금과 같이 전파(잡지 않는다) | 변화 없음 |

## 14. 성능 / 상한 / 최적화

- 예상 호출량·출력 크기: 변화 없음.
- 구조적 목표의 단계 지도(prod 줄):

| 묶음 | 줄 |
|---|---|
| X-01 21 · X-02 12 · X-03 8 · X-04 2 · X-05 14 · X-06 22 · X-07 14 · X-08 11 | 104 |
| X-09 33 · X-10 17 · X-11 5 · X-12 6 · X-13 6 · X-14 16 | 83 |
| X-15 | 125 |
| M2(50줄 → 약 20줄) | 30 |
| 합 | 약 342 |

- 최적화로 생략되는 부수 효과: 없음. 지우는 실-git 테스트 5건(`repository.test.ts:56-110`)만큼 CI의 git 실행이 준다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 포크 표면(K4·K5)을 바꾸지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 관계 | 근거 |
|---|---|---|
| 0202 D4·D-008 — reader·sink는 한 벌, 호출 형태를 스윕이 잠근다 | 유지 | D-007 · AC5 |
| 0307 D-012 — 포크 호환 alias 7 · 빗금 상수 유지 | 유지 | §8 K5·K7 |
| `app/AGENTS.md` 에이전트 원칙 4 "테스트 동반" | 유지 — 지우는 테스트는 지우는 함수 전용이다 | §8 표 · AC3 |
| `renderer/AGENTS.md` "컴포넌트 삭제 시 카탈로그 행 갱신" | 따른다 | EP-02 |
| `docs/AGENTS.md` "`arch/`에 이력을 쓰지 않는다" | 따른다 — 행을 지우고 "제거됨"을 적지 않는다 | EP-02 |

## 17. 리스크 / 트레이드오프

| 리스크 | 영향 | 대응 |
|---|---|---|
| 유지해야 할 포크 표면을 지운다 | 포크 빌드 실패 | AC2 집합 일치 · EP-02가 `docs/guides` 포함 |
| 지운 테스트가 살아 있는 동작의 유일한 잠금이었다 | 조용한 회귀 | AC3 L1~L5 · VP-02 변이 (c)~(f) |
| 합치며 순서·중복 제거가 바뀐다 | 모델 목록 불일치 | I3·I4 — 기대값을 합치기 전 코드에서 얻는다 |
| `design-system.md`의 "카메라 stage" 역할 행이 소비자 없는 토큰만 가리킨다 | 문서가 쓰이지 않는 역할을 설명 | D-010 — 완료 보고에 적고 사용자 판단 |

## 18. 영향 받는 파일 / 문서

| 파일 / 문서 | 변경 | V pair / AC |
|---|---|---|
| prod 16파일(§8 X-01~X-15) + `main/app/runtime-model-startup.ts` | 삭제 · 합치기 | VP-01 · VP-03 |
| test 18파일(§8 표 · `runtime-model-startup.test.ts`) | 삭제 2 · 수정 16 | VP-02 · VP-03 |
| `docs/arch/frontend/{design-components,design-system,layers}.md` · `docs/arch/backend/system-prompt.md` | 행·언급 제거 · 한 문장 정정 | VP-05 |
| `docs/handoff/INDEX.md` | 보드 행 | — |

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` — better-sqlite3 ABI · 제약 환경 게이트 가이드, CI 표 · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- 환경 제약: 이 환경은 `app/node_modules`가 없다 — 구현 턴이 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`로 설치한다. 0309 r1 verify의 기준선(vitest 실패 = DB·Electron 바이너리 부재)과 차집합으로 분리한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 가드 스크립트: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs`.
- 테스트: 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"`.
- 이번 handoff 전용: `cd app && node ../docs/handoff/0305-code-bloat-audit/scan/lens-exports.mjs`(AC1·AC2) · EP-01·EP-02 검색.
- 사람 실기(AC9): 개발 빌드에서 (a) 앱이 뜨고 세션 목록·컴포저가 보인다 (b) 연결 화면에서 자격증명을 저장·삭제 → 모델 선택 목록이 바뀐다 (c) git 저장소 폴더의 세션에서 컴포저 git 행이 보이고 턴이 끝나면 변경 목록이 갱신된다.

## READY self-review

- [x] Decision Ledger — D-001~D-011, 상속 4건은 출처 plan을 적었다.
- [x] Product & UX Contract가 앞에 있고 §5 흐름만으로 완료 상태를 설명한다.
- [x] 사용자 표현 "죽은 것만"·"의도된 seam은 남기고"를 §2에 원문으로 두고 D-006에서 조건으로만 옮겼다.
- [x] 사용자 결정(범위)은 질의로 닫았고 분류 사실은 코드로 닫았다 — §8.
- [x] 수치 실측: 스캐너 `10 + 50 + 574 = 634` · EP-01 `149줄 35파일` · EP-02 `5줄` · 유지 `31 + 8`.
- [x] 저장소 규칙: 가드 등록부에 대상 테스트 0줄 · `no-stray-auth-subscribe.test.ts:16-21` · 후보 표 겹침 0.
- [x] 각 AC가 동작 기준·검증 수단·도달 경로를 가진다 — §7.
- [x] Baseline V. `NEW`·`CHANGED` node마다 같은 레벨 `REQUIRED` pair — R↔AT VP-01·02·05, MD↔UT VP-03.
- [x] 영향받는 상위 회귀는 VP-04 `REGRESSION`. `NOT_REQUIRED` 행 없음.
- [x] pair마다 path·§10 자리·검색 명령·좌표. 적대 증거는 VP-01~03만 이유와 함께.
- [x] 규칙 칸 분기 I1~I6·L1~L5마다 입력이 있다 — I2는 같다/다르다 두 분기를 한 입력(a·b / c)이 덮는다.
- [x] 선언 경계 2건은 측정값과 함께 적었다. 열린 입력 집합 판정 산출물은 만들지 않는다(기존 스캐너를 열거 원문과 대조하는 데만 쓴다).
- [x] 운영 gate 4행.
- [x] 사람 실기는 AC9의 시각·실환경뿐이다.
- [x] structural proxy만으로 닫는 semantic AC 없음 — AC4는 행동 단언, AC1의 음성 검색은 AC2 집합 일치와 짝.
- [x] "유지 이름이 있다"의 장치(AC2)는 그 이름을 지우면 실패한다 — VP-01 변이 (a).
- [x] 정책 파라미터·배타 상태·참조 구현: 해당 없음.
- [x] 신규 모듈·계약 없음. 합친 함수의 seam은 §11.
- [x] producer/consumer — §12, 팩토리 시그니처 불변.
- [x] worst-case·one-way door: 해당 없음(삭제는 git으로 되돌린다).
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 갱신 메모에 적었다 — 충돌 0.
- [x] 문장 규칙 — 표 칸 3줄·문단 3문장.

---
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
> 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개는 oracle 종류와 무관하게 돌린다(impl §3 sweep). 그 밖의 직접 oracle에는 mutation을 더 발명하지 않는다.
> **`전건`·`미분류 0`·`잔여 0` 행의 관측은 차집합이다** — 총계·합계는 그 주장을 반증할 수 없다(impl §9).
> **`닫은 지점`은 §10 항목이 아니라 §10이 고정한 자리로 세고, 기록된 자리 검색 명령을 다시 돌린 출력과 목록의 차집합을 적는다** — 목록이 없거나 출력과 갈리거나 술어가 불변식의 주어가 아니거나 범위가 지적이 인용한 파일로 좁으면 `PLAN_GAP`이다(impl §2).
> **닫은 자리마다 직접 oracle 좌표(`파일:테스트명` / 실패 의미 red를 관측한 `gate:<명령>`)를 적는다** — typecheck·코드 읽기·일회성 실측만 있는 자리는 `남긴 곳`에 적고 세지 않는다(impl §2).
> **좌표는 그 테스트의 실행 구간(들어간 곳 → 관측한 곳, mock한 path 구성요소 제외) 안의 자리만 닫는다** — 안쪽 export로 들어가거나 한쪽 끝을 mock하거나 내부 상태만 단언하거나 production 조립이 주입하는 의존성을 빼 다른 분기를 탄 테스트가 건너뛴 자리는 `남긴 곳`이다. 운반 값을 기본값·빈 값·형제와 같은 값으로만 준 좌표, 자리 규칙이 적은 분기 중 입력이 없는 분기가 있는 좌표도 그 자리를 닫지 않는다(impl §2).
> **`§10이 적은 지점`은 그 pair의 §10 자리 전부다** — 재구현 턴에도 지목된 자리만 적지 않고, 닫지 않은 자리는 `남긴 곳`에 남긴다(impl §9).
> **`운반 항 · 구별 값 · 관측`은 닫힘으로 센 행마다 그 자리가 넘기는 항, 테스트의 구별 입력, 좌표가 관측하는 곳을 적는다** — 셋 중 하나가 빠진 항은 `남긴 곳`이고, 호출·분기를 바꾼 변이의 red로 인자 항을 채우지 않는다(`docs/handoff/AGENTS.md §공통 V`).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | `commit·revoke·expiry·401` (4) | 4/4 | `rg …` → 4건 · commit → `a.test.ts:'…'` · revoke → … | commit: `key`(형제와 다른 값 → 저장 결과 단언) · … / 운반 항 없음 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음 / … → 분류(impl §7): 목록 미고정 → PLAN_GAP · 현재 결함 → 선조치 또는 PLAN_GAP · 확장 후보 → 확장 창이 열려 있으면 PLAN_GAP 가능, 닫혔으면 보고 · 비귀속 → 별도 finding
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 / ID → 잡은 테스트 `파일:테스트명`(재실행 결과) 또는 `동치` 근거·확인 실행 — 분류가 이행·현재 결함이거나 설계자가 채택한 확장 행은 이번 턴에 닫는다. 후보 표로 간 행과 `경계` 행은 제외

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다. 이전 라운드 상태를 유지로 옮기는 행도 좌표를 인용하고, 좌표 없이 났던 `SELF_PASS`는 이번 턴에 재판정한다(impl §2).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED / REGRESSION | SELF_PASS / SELF_BLOCKED | `파일:테스트명` … | required — 결과 / not selected — 직접 oracle 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

> **열거 sweep**: 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개(제거 — 계약이 다른 형제 슬롯이 있으면 맞바꿈을 더함)를
> 심어 red인지 본다(impl §3, 하네스 `.agents/skills/handoff-verify/scripts/mutate.py`). 그 위에 pair가 선택한 적대 증거·
> 파생 이슈의 인용 변이·이번 턴에 만든 구조적 proxy·0건/전수·배선 oracle의 민감도를 심는다. 규칙 칸 분기는 그 칸을 구현한
> diff 자리(조건·조기 반환·후보를 합치는 항)마다 제거 변이를 심어 찾는다. 그 밖의 hunk에는 mutation을
> 새로 발명하지 않는다. mutation이 없다는 이유만으로 현재 FAIL 범위를 늘리지 않는다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `파일:줄` — 무엇을 어떻게 바꿨는가(제거 / 형제와 맞바꿈) | `sweep — §10 자리 / path edge / 규칙 칸 분기(diff 자리)` / `재앵커 — 원 ID` / `VP-… 선택 증거` / `D<N> 인용 변이` / `구조·전수·배선 oracle 민감도` | red / green / 최초 | `<케이스명>` 외 N건 | 잠김 / **잠금 없음 — 테스트 추가** / 동치 — 근거·확인 실행 |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K · sweep S = 표 행 T` — sweep S는 열거 항목 수와 같아야 한다. 행이 없는 claim은 `SELF_PASS`·`closed`로 적지 않는다(impl §9).
- **덮개 회귀**: 이전 라운드에 red였는데 이번에 green인 행 0건 / N건 → 사유와 함께 적는다. 분모는 직전 verify 고장 이력의 `잡음` 행 중 하한 ④와 같은 범위이고, 원문이 옮겨 갔으면 재앵커한 행이다. 장치를 교체·삭제했으면 구 장치가 잡던 자리가 새 장치의 하한이다(impl §3).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 / … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … / **표에 없음** | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
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
> AC·§10 행을 관측과 함께 남긴다. 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다(impl §7).

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
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | `ci.yml` 단계 전부의 로컬 대응(파일 필터 없는 테스트) — 테스트 N파일 / M케이스 · error·warning 수 · 돌리지 못한 단계와 이유 · 기준선 분리 근거(변경 전 실패 집합과 차집합 ∅ + 환경 원인, `docs/handoff/AGENTS.md §판정 범위와 운영 gate`) |
| **추가·수정 테스트의 subtree 규칙** | `git diff --name-only`로 뽑은 테스트 파일 N · 규칙별 위반 0(app: 시간 예산·호스트 격리·풀 분류) · 그 파일들의 규칙 가드 실패 0 — 테스트를 건드리지 않았으면 `해당 없음` |
| V-pair 자기확인 | `SELF_PASS N / SELF_BLOCKED M`; pair별 상세는 위 표 |
| 강제 지점 전수 | N/M |
| **AC 자기보고**(`Criteria-Met`) | N/M — 각 AC 옆에 **이번 턴에 재현한 관측값**을 적는다. 표식을 다시 찾지 못한 AC는 ✅로 세지 않는다 |
| **합계 검산** | `✅ N · ⚠️ M · ❌ K = 총 T` — 분모를 다시 세고 **이 줄을 쓴 뒤** 커밋 trailer를 적는다. 분모가 바뀌었으면(AC 분할·추가) 그 사실을 적고 이전 라운드 합계와 직접 비교하지 않는다 |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r<N> 구현 — 좌표는 INDEX)` — 자기 환경의 해시를 적지 않는다. 좌표 정본은 `INDEX.md` 한 곳이고 검증자가 채운다 |

## [구현자 기입] Review Signals — 사실만

> 원인 분류(A~F)와 지침 변경은 `handoff-review`가 한다.

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 / …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: 없음 / …
- 현재 라운드·impl 턴: `rN` / `rN.k` (verify 3·6회째 FAIL/RETURN_TO_PLAN 또는 verify 없는 impl 턴 3 초과면 — 사용자 요구 변경 턴 제외 — 다음 재구현 전에 `handoff-review`. verify 9회째가 PASS가 아니면 `verify/CLOSED` 종료)

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.
> `발견 분류`는 이행(열거 원문 위반·plan 내부 불일치) · 현재(원본 동작 결함) · 확장(열거 밖 잠금 공백) · 경계 · 비귀속이다. 확장은 verify 1·2회째에만 `PLAN_GAP`이고 이후에는 `NEXT_HANDOFF(확장)`로 INDEX 후보 표에 간다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| D1 | … | verify r<N> · VP-… · AC<N> / §10 <N>행 / gate | … | 이행 / 현재 / 확장 / 경계 / 비귀속 | BLOCKING / PLAN_GAP / NON_BLOCKING / NEXT_HANDOFF | open / 구현중 / 해결 / 후보 표 |
