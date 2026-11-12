# Plan — 0312-bloat-reduction-turn-content-and-composer-catalog

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0305 감사](../0305-code-bloat-audit/audit.md) §3 C-27·C-28·C-36 · §8 분해안 · §9 분할안 H-G·H-J, [0311 plan](../0311-bloat-reduction-pending-queue-claims/plan.md) §2·§6이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0312-bloat-reduction-turn-content-and-composer-catalog` |
| 작성자 | Claude Code |
| 일자 | 2026-11-12 |
| 매핑 | 0305 분할안 H-G(C-27 일부) · H-J(C-36 일부). 나머지는 §4에서 제외 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0245·0268·0276·0280·0281·0289의 V는 문서로 상속하지 않고, 그 테스트를 VP-06이 회귀로 다시 닫는다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 작업 — root `AGENTS.md` 협업 워크플로우) |
| 조사 기준 커밋 | `b620185` (`git cat-file -t` → commit · PR 브랜치 좌표, `git merge-base --is-ancestor b620185 origin/main` 실패) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 같은 일을 두 번 적은 자리가 다섯 군데다. Claude 턴 입력 조립이 세 경로에 세 벌, OpenCode 컴포저 목록의 실패 처리가 두 벌, 목록 범위 키가 main과 renderer에 한 벌씩, 낡은 응답 판정에 이미 다른 축이 덮는 항이 하나, main 소유자 표의 "없으면 만든다"가 두 번이다.
- 완료 후 달라지는 것: 다섯 자리가 각각 한 벌이다. 사용자·하네스가 보는 동작은 그대로다.
- 성공을 사용자 관점에서 한 문장으로: Claude에 보낸 본문·첨부·diff 요구가 처음 전송·이월 입력·후속 전송 어디서나 지금과 같이 전달되고, OpenCode 컴포저의 모델·에이전트·MCP·플러그인 목록이 지금과 같이 뜨고 실패하면 다시 시도할 수 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "305 검토 결과를 기반하여 최적화 작업을 진행해야 한다. 현재 307~311까지 진행됨. 이어서 진행하라." | 라이브 세션 턴 1 |
| 상속 | 회귀 금지 · 판정 단위는 시나리오별 관측 동작 · 목표는 코드 감량 · 백그라운드/서브 에이전트 금지 · 단계마다 커밋 | 0305 plan D-003 · D-011 · D-006 · D-007 |
| 상속 | C-33·C-34는 현행 유지("둘 다 보류") | 0307 plan D-004 |
| 추론 의도 | "이어서"는 0305 분할안에서 아직 다루지 않은 묶음이다. 남은 것은 H-G(7위)·H-J(10위) 둘이고 H-H는 보류다 | 0305 audit §9 · 0311 plan §2 |
| 추론 의도 | 두 묶음을 한 handoff로 묶는다 — 재실측에서 남는 변경이 묶음마다 20줄 안팎이라 따로 열면 절차가 변경보다 크다 | §4 · §14 |
| 추론 의도 | 재실측에서 순증이거나 관측 동작을 바꾸는 항목은 뺀다 — 회귀 금지와 감량 목표를 둘 다 지키는 범위(0309 D-006 · 0311 D-007과 같은 처리) | §4 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이번 handoff는 0305 분할안 H-G와 H-J를 함께 다룬다 | 남은 미보류 묶음이 이 둘뿐이고 각각 남는 변경이 작다(§14). 0310이 두 묶음(H-E·H-I)을 한 handoff로 다룬 선례가 있다 | 설계자 판단 | ACTIVE | — |
| D-002 | 회귀 금지. 판정 단위는 시나리오별 관측 동작이고, 내부 구조에 묶인 테스트는 통합·삭제할 수 있다 | 0305 D-003 | 0305 plan §3 | ACTIVE | — |
| D-003 | 목표는 코드 감량이다. CI·가드·테스트 인프라를 따로 줄이지 않는다 | 0305 D-011 | 0305 plan §3 | ACTIVE | — |
| D-004 | 백그라운드·서브 에이전트를 쓰지 않는다. 단계(M1·M2·M3)마다 커밋을 남긴다 | 0305 D-006 · D-007 | 0305 plan §3 | ACTIVE | — |
| D-005 | 구현 대상은 다섯이다 — (a) Claude 턴 입력 조립을 `batchContent` 한 벌로 (b) 컴포저 목록의 실패 응답을 거절 경로로 합류 (c) `stale()`에서 `disposed` 항 제거 (d) 범위 키 정본을 `shared/composer-catalog.ts` 하나로 (e) main 소유자 표의 "없으면 만든다"를 한 번으로 | H-G·H-J 후보 중 재실측에서 순감이면서 동작이 같은 것이 이것뿐이다(D-006~D-011). 근거는 §8 | 설계자 조사 | ACTIVE | — |
| D-006 | C-27 분해안 1·3단계(`eventBatches`를 파일로 · SDK 옵션 조립을 순수 함수로)를 하지 않는다 | `eventBatches`는 바깥 지역 변수 19개를 읽는다(§8). 옮기면 그만큼 인자·타입 선언이 늘어 순증이다(D-003) | 설계자 조사 | ACTIVE | — |
| D-007 | C-27 분해안 2단계(신호 5종 큐를 큐 하나·drain 하나로)를 하지 않는다 | 신호마다 배치 안 자리가 다르다 — 영수증은 앞(`adapter.ts:936-937`), 예약은 result 배치의 맨 앞(`:959`), 산출 캡처는 telemetry 앞(`:945-958`), 요약·종료는 매 메시지 끝(`:964-965`). 그 자리를 `adapter.turnEnd.test.ts:154,243,272,449`가 잠근다 | 설계자 조사 | ACTIVE | — |
| D-008 | 오류로 끝난 스트림의 꼬리 드레인에 압축 요약을 더하지 않는다 | 정상 종료(`:968-973`)는 요약을 비우고 오류 종료(`:976-980`)는 비우지 않는다. 맞추면 오류 직전에 요약 메시지가 새로 보인다 — 동작 변경이다(D-002) | 설계자 조사 | ACTIVE | 사용자가 동작 변경을 고르면 새 handoff |
| D-009 | C-28(OpenCode 채널)은 이번에 바꾸지 않는다 | 분해안 세 단계 모두 재실측에서 순감이 0이거나 순증이다(§4 전제 정정). `wake = undefined` 3줄만 남는데 잠금을 새로 만드는 비용이 더 크다 | 설계자 조사 | ACTIVE | — |
| D-010 | Claude 응답 범위 재개(`responseOpen`·`responseScope` 두 자리)와 result 경계의 조건문은 바꾸지 않는다 | 합치면 4줄·2줄이 준다. `responseScope++`를 지워도 대상 테스트가 green이었다(§8 실측 m4) — 옮기려면 잠금부터 새로 만들어야 한다 | 설계자 실측 | ACTIVE | — |
| D-011 | C-36의 축 가운데 `retired`·`generation`·`epoch`·`previousOwner`와 `promote` 재키잉은 남긴다 | `retired`는 같은 epoch에서 늦게 온 옛 세대 응답을 거른다(`composerCatalogState.test.ts:245`) — epoch로 대신할 수 없다. `promote`를 재조회로 바꾸면 세션 확정 때 목록이 loading으로 돌아간다(감사 C-36 시나리오 "깜빡이지 않는다") | 설계자 조사 | ACTIVE | — |
| D-012 | 실패 응답(`status: 'cancelled'`·`'error'`)의 슬롯 반영은 거절과 같은 경로를 탄다. 반영이 마이크로태스크 한 번 늦어지고 그 사이 낡으면 버린다 | 두 벌이 같은 문장이다(`composerCatalogState.ts:160-168` ↔ `:187-194`). 늦어진 사이 낡는 경우의 최종 상태는 지금과 같다(§13) | 설계자 판단 | ACTIVE | — |
| D-013 | renderer 상태 키는 `[identity, 정본 범위 키]`다 | 키는 모듈 안 `Map`에서만 쓰고 저장·전송되지 않는다(`composerCatalogState.ts:219`) — 꼴이 바뀌어도 관측되지 않는다 | 설계자 판단 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-013. D-002~D-004는 상속.
- D-001·D-005~D-013은 설계자 판단이다. 완료 보고에서 D-008(오류 꼬리의 요약)과 D-009·D-010(제외) 선택지를 알린다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0.
  - D-005(a) ↔ AC1: 세 경로의 내용 동일을 행동으로 요구한다. `buildTurnContent` 시그니처는 그대로다.
  - D-005(b)·D-012 ↔ AC2: 실패 네 갈래의 슬롯 결과를 요구한다. AC2는 반영 시점을 요구하지 않는다.
  - D-005(c)·D-011 ↔ AC3: 버리는 조건 셋과 받는 조건 하나를 요구한다. AC3은 남긴 축을 지우라고 하지 않는다.
  - D-005(d)·D-013 ↔ AC4: 키의 필드와 정의 수 1을 요구한다.
  - D-005(e) ↔ AC5: 소유자 항목의 네 갈래를 요구한다.
  - D-006~D-010 ↔ AC6: 제외한 자리의 diff 0을 요구한다.
  - D-003 ↔ AC7 · D-002 ↔ AC8.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 세 벌 조립은 한 벌이 빠뜨려도 다른 둘이 통과한다 | `adapter.ts:553,562,1052` |
| 이미 기존 코드가 충족하는가 | 아니오 | EP-01 3자리 · EP-04 2정의(§10) |
| 더 작은 해법이 있는가 | 감사 분해안은 더 크다. 분해안 9단계 중 순감·동작 보존은 아래 다섯 조각뿐이다 | 전제 정정 표 |
| 선행 자료의 주장을 코드와 대조했는가 | **전제 정정 8건** | 아래 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음. `shared/`는 순수 유틸을 허용한다(`app/src/main/AGENTS.md` 레이어 표) | §16 |

전제 정정(0305 감사 분해안 ↔ 현재 코드):

| 후보·단계 | 감사 주장 | 재실측 | 처리 |
|---|---|---|---|
| C-27 1단계 | `eventBatches`를 파일로 뗀다 | 바깥 변수 19개를 읽는다 — 추출은 순증 | D-006 제외 |
| C-27 2단계 | 신호 큐 5종을 하나로 | 신호마다 배치 안 자리와 드레인 시점이 다르고 테스트 4건이 잠근다 | D-007 제외 |
| C-27 3단계 | SDK 옵션 조립을 순수 함수로 | 옵션이 hook 클로저로 지역 큐 5개를 잡는다 — 추출은 순증 | D-006 제외 |
| C-27 (미기재) | — | 턴 입력 조립이 세 벌이다(`:553` 헬퍼 · `:562` 직접 · `:1052` 직접) | D-005(a) |
| C-28 1단계 | 전송 경로 2벌의 prelude·복구 조립을 합치면 약 20줄 | 두 경로는 구조가 다르다 — command는 문맥을 별도 `noReply` 프롬프트로(`channel.ts:231-247`), prompt는 `system` 필드와 본문에(`:281-288`). 공통 식은 `map((part) => part.text)` 한 줄씩 | D-009 제외 |
| C-28 2단계 | 종료 플래그 4개를 상태 값 하나로 | `closed`·`ended`는 겹치지 않는 구간이 있고(`:473` ↔ `:491`) `interrupt`(`:563`)가 `closed`만 본다. `interrupted`·`responseOpen`은 종료가 아니라 응답 단위다 | D-009 제외 |
| C-28 3단계 | 연결·전송·펌프를 함수 셋으로 | 이미 안쪽 함수 셋이다(`submitPrepared`:158 · `run`:327 · `batches`:478). 파일로 가르면 순증 | D-009 제외 |
| C-36 1~3단계 | 판정 두 갈래를 하나로 · 겹치는 축 제거 · `promote`를 재조회로 | `stale()`은 요청 시점, `retired`는 응답 세대를 본다 — 합쳐도 줄지 않는다. 겹치는 축은 `stale()`의 `disposed` 하나다. 두 갈래인 것은 실패 처리다 | D-005(b)(c) · D-011 |

- 사용자에게 올릴 결정: 없음. D-008·D-009·D-010은 완료 보고에 선택지로 적는다.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

UI 변화는 없다. 관측자는 앱 사용자(전송 내용·컴포저 목록)와 Claude SDK(입력 스트림)다.

```text
[Claude 전송] 본문 + 텍스트 첨부 + 이미지 + diff 요구
  → 처음 전송 / 이월 입력(prelude) / 후속 전송(pushTurn) — 세 경로 모두 같은 조립
  → SDK 입력 스트림의 user 메시지

[OpenCode 컴포저 목록] 구독 → 부분(agents·models·mcp·plugins) 조회
  → 값 응답: 목록 표시
  ↘ 취소 응답 / 오류 응답 / 거절 / 다른 부분의 응답: 오류 표시(직전 값 유지) → 다시 시도
  ↘ 낡은 응답(무효화·구독 해제·남의 소유자): 버림
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| Claude 처음 전송(S-04) | 이월 입력들 → 본문 순으로 입력 스트림에 넣는다 | 지금과 같다 |
| Claude 후속 전송(S-06·S-07) | 라이브 설정 적용 뒤 입력을 넣는다 | 지금과 같다 |
| 만료된 대화 복구 전송 | 본문 앞에 보관 이력을 붙이고 첨부는 그대로 싣는다 | 지금과 같다 |
| 컴포저 목록 조회 실패(S-05) | 그 부분만 오류, 직전 값 유지 | 오류 표시와 다시 시도가 지금과 같다 |
| 구독 해제 뒤 늦은 응답 | 버린다 | 화면이 되돌아가지 않는다 |
| 새 대화가 세션으로 확정 | 상태를 새 키로 옮기고 모델만 다시 확인 | 목록이 깜빡이지 않는다 |
| main의 준비가 죽은 뒤 다시 시도 | 옛 준비를 놓고 새로 준비 | 다시 시도하면 목록이 뜬다 |

### 파생 UX / 엣지케이스

- loading / empty / error: 위 표. 성공한 빈 목록은 `ready`다(변화 없음).
- cancel / retry / close / restart: 취소 응답은 오류 슬롯이다. 구독 해제는 `dispose`가 epoch를 올려 진행 중 응답을 낡게 만든다.
- concurrency: 실패 반영이 마이크로태스크 한 번 늦어진다(D-012). 그 사이 무효화·플러그인 개정이 끼면 실패 반영은 버려지고 그 사건이 정한 상태가 남는다(§13).
- 외부 소비자: IPC 채널·스키마·`ComposerCatalogResult` 타입 변화 없음.

## 6. 범위 / 비범위

- **범위**: `adapters/claude/adapter.ts`의 턴 입력 조립 세 자리 · `composerCatalogState.ts`의 실패 처리·`stale()`·`stateKey` · `shared/composer-catalog.ts`에 범위 키 · `composer-catalog-owner.ts`의 키 정의 삭제와 `read` 머리 · `composer-preparation-service.ts`의 import · 딸린 테스트.
- **비범위**: `eventBatches`·SDK 옵션 구조(D-006) · 신호 큐(D-007) · 오류 꼬리 요약(D-008) · `opencode/v1/channel.ts` 전부(D-009) · 응답 범위 재개·result 조건문(D-010) · 남긴 축과 `promote`(D-011) · C-33·C-34(0307 D-004).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| D-008 오류 꼬리의 요약 | 아니오 | 사용자가 동작 변경을 고르면 새 handoff |
| D-009 · D-010 | 아니오 | 하지 않는다 |
| H-H(C-34) · C-33 | 아니오 | 0307 D-004 보류 그대로 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | Claude 입력의 세 경로가 본문·텍스트 첨부·이미지·diff 요구를 같은 꼴로 싣는다. 복구 전송은 본문 앞에 보관 이력을 붙이고 첨부를 그대로 싣는다 — §10 T1~T4 | §7-A VP-01 좌표 | `sendMessage` → `openChannel` → 입력 스트림 · `LiveTurn.pushTurn` |
| R-02 | AC2 | 컴포저 목록 조회의 실패 네 갈래가 그 부분을 오류 슬롯으로 만들고 직전 값을 지킨다. 에이전트 캐시는 채워지지 않는다 — §10 F1~F5 | VP-02 좌표 | `ComposerCatalogState.read` → `sessionApi.composerCatalog` 응답 |
| R-03 | AC3 | 낡은 응답은 버린다 — epoch가 바뀜 · 소유자가 현재도 직전도 아님 · 구독 해제 뒤. 직전 소유자의 응답은 받는다 — §10 X1~X4 | VP-03 좌표 | 같은 경로의 `.then`·`.catch` 머리 |
| R-04 | AC4 | 범위 키는 여섯 필드를 정한 순서로 직렬화한 값이고 정의가 한 곳이다. renderer 상태는 `identity`가 다르면 다른 상태다 — §10 Q1~Q3 | VP-04 좌표 · EP-04 검색 1정의 | main `ComposerCatalogOwners.read` · `ComposerPreparationService.acquire` · renderer `composerCatalogState()` |
| R-05 | AC5 | main 소유자 항목의 네 갈래가 지금과 같다 — 없으면 만든다 · 범위가 다르면 거부 · 준비가 죽었으면 놓고 새로 만든다 · 새 항목은 살아 있는 표에 등록된다 — §10 E1~E4 | VP-05 좌표 | `oo:` 컴포저 목록 IPC → `registerComposerCatalogHandlers` → `owners.read` |
| R-06 | AC6 | 제외한 자리가 그대로다 | `git diff <설계 커밋>..HEAD -- app/src/main/adapters/opencode` 0줄 · `adapter.ts` diff가 EP-01 자리와 import·구조 분해 줄에만 있다 · `adapter.turnEnd.test.ts` diff 0줄 | 해당 없음 |
| R-07 | AC7 | prod 순감이 28줄 이상이다. test 증감을 보고한다 | `git diff --numstat <설계 커밋>..HEAD -- app/src`를 prod/test로 갈라 합산 | 해당 없음 |
| R-08 | AC8 | §19 게이트가 green이거나 실패가 기준선과 같은 환경 서명이다 | §19 명령 산출과 변경 전 실패 집합의 차집합 | CI |
| R-09 | AC9 | 개발 빌드에서 Claude에 첨부·이미지를 붙여 처음·후속 전송이 되고, OpenCode 컴포저 목록이 뜬다 | 사람 실기 — §19 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: 인용한 케이스는 이번 세션에 실재를 확인했다 — `adapter.context-policy.test.ts:152`(세 경로) · `adapter.fork.test.ts`의 `recreates an expired conversation…` · `composerCatalogState.test.ts:176,207,245,356` · `composer-promotion.test.ts:157,332` · `handlers/composer-catalog.test.ts:156,184`.
- 기대값의 출처: 고쳐 쓰는 테스트 입력은 **변경 전 코드에서 먼저 green**임을 확인한 뒤 합친다(M1이 테스트 먼저, M2·M3이 코드).
- 사람 실기 항목: AC9. 조립·판정 로직은 AC1~AC5가 기계로 본다.
- 총량/0건 기준: AC4의 "정의 1"은 양성 검색(정의 줄 1)과 EP-04의 필드 나열 검색(1벌)으로 본다. AC6의 diff 0은 손대지 않는 자리의 비영향 확인이다.
- AC7의 28은 §14 실측 합(34)에서 포맷 오차를 뺀 값이다.
- 환경 한계: `composer-catalog.test.ts`·`composer-preparation-service.test.ts:23`은 이 환경에서 `C:/` 경로 때문에 변경 전에도 실패한다(§8). VP-04·VP-05의 좌표는 그 파일을 쓰지 않는다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 코드 계약 V가 없다.
- 기준 V 상속 근거: 없음. 손대지 않는 자리는 AC6이 diff 0으로, 닿는 상위 동작은 VP-06이 회귀로 본다.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: `SD↔ST`는 두지 않는다 — 상태·수명주기가 바뀌지 않는다. `AR↔IT`는 범위 키가 모듈 경계를 넘어(`app/` → `shared/`) 두 프로세스가 함께 쓰게 되어 VP-04 하나를 둔다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-09 | R | §7 각 행 | NEW | — |
| AT-01~AT-09 | AT | §7 검증 수단 칸 | NEW | — |
| MD-01 | MD | §10 T1~T4 턴 입력 조립 | CHANGED | `adapter.ts:547-570,1051-1059` |
| MD-02 | MD | §10 F1~F5 실패 처리 | CHANGED | `composerCatalogState.ts:157-194` |
| MD-03 | MD | §10 X1~X4 낡음 판정 | CHANGED | `composerCatalogState.ts:109-115` |
| AR-01 | AR | §10 Q1~Q3 범위 키 | CHANGED | `composer-catalog-owner.ts:17-26` · `composerCatalogState.ts:220-229` |
| MD-04 | MD | §10 E1~E4 소유자 항목 | CHANGED | `composer-catalog-owner.ts:73-83` |
| UT-01~UT-04 · IT-01 | UT · IT | §10 규칙 칸 ↔ UT 입력 칸 | CHANGED | §10 좌표 칸 |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | MD-01 ↔ UT-01 | REQUIRED | `sendMessage(req)` → `batchContent` × (prelude · 처음) → 입력 스트림 / `pushTurn(next)` → `batchContent` → `pushInput` | §10 T1~T4 | required — 형제 슬롯(인자 넷, 경로 셋). 변이: (a) `b.attachmentTexts ?? []`를 `[]`로 (b) `b.attachmentImages ?? []`를 `[]`로 (c) `b.requirements ?? []`를 `[]`로 (d) 처음 경로를 `batchContent(req)`로 (e) 처음 경로에서 `...req`를 뺌 (f) `pushInput`의 `next.promptUuid` 제거 | EP-01 3자리 |
| VP-02 | MD-02 ↔ UT-02 | REQUIRED | `read(part)` → `sessionApi.composerCatalog` → `.then`(낡음 검사 → 실패면 throw) → `.catch`(낡음 검사 → 실패 슬롯 → publish) | §10 F1~F5 | required — 합류라 한 갈래가 빠져도 나머지가 통과한다. 변이: (g) `'status' in result` 항 제거 (h) `result.part !== part` 항 제거 (i) `.catch`의 실패 슬롯 대입 제거 | EP-02 2자리 |
| VP-03 | MD-03 ↔ UT-03 | REQUIRED | 같은 path의 `stale(epoch, owner)` 두 호출 | §10 X1~X4 | required — 항을 지우는 변경이라 남은 항의 민감도를 본다. 변이: (j) `epoch !== this.epoch` 항 제거 (k) `owner !== this.previousOwner` 항 제거 (l) `dispose`의 `this.epoch++` 제거 | EP-03 1자리 + `dispose` 1자리 |
| VP-04 | AR-01 ↔ IT-01 | REQUIRED | `shared/composer-catalog.ts` `composerScopeKey` → main `owners.read`(항목 범위 대조) · `acquire`(해석 공유) → renderer `stateKey` → `states` Map | §10 Q1~Q3 | required — 형제 슬롯(필드 여섯, `identity`). 변이: (m) 키에서 `scope.sessionId` 제거 (n) `scope.agentKind` 제거 (o) `stateKey`에서 `identity` 제거 (p) `stateKey`에서 정본 키 제거 | EP-04 정의 1 · 호출 3자리 |
| VP-05 | MD-04 ↔ UT-04 | REQUIRED | `owners.read(sender, request)` 머리 → 항목 조회 → 범위 대조 → 죽은 준비 놓기 → 표 확보 → 항목 생성 | §10 E1~E4 | required — 순서 재배치. 변이: (q) 범위 대조 줄 제거 (r) `void this.release(…)` 제거 (s) `entry = undefined` 제거 (t) 표 확보를 죽은 준비 놓기 앞으로 옮김 | EP-05 1자리(머리 블록) |
| VP-06 | R-01~R-05 ↔ AT-01~AT-05 | REGRESSION | 위 다섯 path의 상위 — Claude 어댑터 스위트 · 컴포저 목록 renderer·main 스위트 | 변경 전 green이던 `src/main/adapters/claude` · `src/renderer/src/features/chat/harnesses/opencode` · `src/main/app/handlers/composer-catalog.test.ts` · `src/renderer/src/features/chat/store/composer-promotion.test.ts` 케이스가 그대로 green | not selected — 직접 실행 결과의 집합 대조 | 0 — 새 강제 지점 없음 |

R-06~R-09는 diff·측정·게이트·실기라 pair 없이 §19가 닫는다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/**` 수정 | §19 | 이번 변경이 만진 파일에서 난 실패와 기준선 밖 실패만 blocking |
| 테스트 풀·예산 가드 | 테스트 파일을 수정·추가한다 | `[test-pools]` · `node scripts/check-test-budgets.mjs` | 만진 파일의 위반만 blocking |
| 레이어 경계 | `shared/`에 함수를 더하고 renderer가 값을 import한다 | `npm run lint`(`boundaries/dependencies`) | 전부 blocking |
| 문서 인벤토리·이름 검사기 | `docs/handoff/**` 수정 | `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` | 전부 blocking |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| Claude 턴 입력 조립은 세 자리다 — prelude는 헬퍼, 처음과 후속은 `buildTurnContent`를 네 인자로 직접 부른다 | `adapter.ts:547-558`(헬퍼) · `:562-567` · `:1052-1057` |
| 구조 분해의 기본값 셋(`attachmentTexts = []` 등)은 처음 경로와 헬퍼의 타입 표기에만 쓰인다 | `adapter.ts:510-512,549-551,564-566` |
| `buildTurnContent`는 export이고 네 위치 인자로 단위 테스트된다 | `adapter.ts:1088` · `build-turn-content.test.ts:88,95,103` |
| 세 경로 테스트는 텍스트 첨부·이미지를 싣지만 diff 요구는 싣지 않는다 | `adapter.context-policy.test.ts:152-181` |
| 실패 응답 처리와 거절 처리가 같은 세 줄이다(슬롯 대입 → publish) | `composerCatalogState.ts:160-168` ↔ `:187-194` |
| 부분 불일치 응답은 이미 throw로 거절 경로에 합류한다 | `composerCatalogState.ts:159` |
| `dispose`는 `disposed = true`와 `epoch++`를 함께 한다. `read`는 `disposed`면 새 요청을 내지 않는다 | `composerCatalogState.ts:207-208` · `:147` |
| 범위 키의 필드 나열이 두 벌이다. main 것은 export이고 두 곳이 부른다 | `composer-catalog-owner.ts:17-26,76` · `composer-preparation-service.ts:47` · `composerCatalogState.ts:220-229` |
| `composer-catalog.ts:48-53`의 `canonicalJson([...])`은 준비 식별자(cwd·해석 결과 포함)라 범위 키의 사본이 아니다 | `composer-catalog.ts:48-53` |
| `read` 머리는 표 확보를 두 번 한다 — 죽은 준비를 놓으면 `release`가 그 sender의 표를 지울 수 있어서다 | `composer-catalog-owner.ts:73-83,177-178` |
| `shared/composer-catalog.ts`는 타입만 갖는다. `shared/`는 순수 유틸을 허용하고 테스트 파일을 둔다 | `app/src/main/AGENTS.md` 레이어 표 · `app/src/shared/absolute-path.test.ts` |
| arch 문서는 이 다섯 자리의 이름을 적지 않는다 | `git grep -n -E 'composerScopeKey\|stateKey\|batchContent' -- docs/arch docs/IPC_CONTRACT.md` → 0줄 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---|---|
| EP-01 턴 입력 조립 자리 | `git grep -n -E 'buildTurnContent\(\|batchContent\(' b620185 -- app/src/main/adapters/claude/adapter.ts` | 5줄 | 정의 1(`:1088`) · 헬퍼 본문 1(`:553`) · 조립 자리 3(`:560,562,1052`) |
| EP-02 실패 슬롯 대입 | `git grep -n -E 'failedSlot\(part\)' b620185 -- …/composerCatalogState.ts` | 2줄 | `:164`(실패 응답) · `:191`(거절) |
| EP-03 낡음 판정 | `git grep -n -E 'stale\(\|this\.disposed' b620185 -- …/composerCatalogState.ts` | 8줄 | `stale` 정의 `:109` · 호출 `:158,188` · `disposed` 항 `:111` · 그 밖의 `disposed` 읽기·쓰기 `:41,147,206,207` |
| EP-04 범위 키 | `git grep -n -E 'composerScopeKey\|stateKey\(\|scope\.agentKind,?$' b620185 -- app/src` | 정의 2 · 호출 5 | 정의 `owner.ts:17` · `State.ts:220` / 호출 `owner.ts:76` · `service.ts:47` · `State.ts:248,258,265` |
| EP-05 소유자 표 확보 | `git grep -n -E 'this\.entries\.(get\|set)\(' b620185 -- app/src/main/app/composer-catalog-owner.ts` | 8줄 | `read` 머리 4줄(`:73,74,80,81`)이 대상 |
| `eventBatches`가 읽는 바깥 변수 | `adapter.ts:867-996`을 읽어 셈 | 19 | `handle`·`resources`·`backgroundMapper`·`ctx`·`responseOpen`·`responseScope`·`previewRoots`·`readForPreview`·`receipts`·`req`·`getPlanFiles`·`capturedOutputs`·drain 3·`abortController`·`close`·`signal`·`onAbort` |

### 설계 시점 실측

후보 변경을 임시로 적용해 재고 되돌렸다(작업 트리 변경 0으로 복구).

| 측정 | 방법 | 결과 |
|---|---|---|
| 줄 수 | D-005 다섯 + D-009·D-010 제외분까지 적용한 `git diff --numstat` | prod `+56 −99`. 제외분(응답 범위 −4 · result 조건 −2 · `wake` −3)을 빼면 §14 |
| 타입 | `npm run typecheck` | 3종 통과 |
| 포맷 | `npx prettier --check` 6파일 | 통과 |
| 회귀 | `vitest run`(claude·opencode 어댑터 · 컴포저 main · opencode renderer · sessions) 변경 전/후 | 둘 다 `28 failed · 1576 passed` — 실패 식별자 집합 동일 |
| 기준선 실패 원인 | 실패 메시지 | `C:/` 경로를 Linux가 상대 경로로 읽음 · `better_sqlite3.node` 부재 |
| m1 (a) 텍스트 첨부 제거 | Claude 대상 스위트 | red — 세 경로 3건 |
| m2 (c) diff 요구 제거 | 같음 | **green — 잠금 없음** → T1 입력에 요구를 더한다 |
| m2b (b) 이미지 제거 | 같음 | red — 세 경로 3건 |
| m3 (d) 복구 이력 누락 | 같음 | red — `adapter.fork.test.ts` 1건 |
| m3b (e) 처음 경로 첨부 누락 | 같음 | red — 세 경로 중 `initial` 1건 |
| m4 `responseScope++` 제거 | 같음 | green — D-010의 근거 |

VP-02~VP-05의 변이 (g)~(t)는 설계 시점에 돌리지 못했다. 구현자가 M1에서 돌려 `못 잡음`이면 §10 입력 칸대로 입력을 더한다.

### 수치 / 전칭 표현 검산

- "세 벌": EP-01의 조립 자리 3 = `:560`(헬퍼 경유) + `:562` + `:1052`.
- "두 정의": EP-04의 정의 2. `composer-catalog.ts:48-53`은 필드가 달라(cwd 정규화·`resolved.prepared`) 사본이 아니다.
- "`disposed`면 새 요청을 내지 않는다": `read`의 반환 순서는 에이전트 캐시(`:142`) → 진행 중 요청(`:146`) → `disposed`(`:147`)다. 앞 둘은 요청을 새로 내지 않는다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

```text
Claude:   prelude ─ batchContent(b) ─┐
          처음    ─ buildTurnContent(recovered, texts, images, reqs) ─┼→ 입력 스트림
          후속    ─ buildTurnContent(next.text, …?? [], …?? [], …?? []) ─┘
컴포저:   응답 ─ 낡음? ─ 부분 불일치 → throw ─────────────┐
                       ─ 실패 응답 → 슬롯=실패, publish   │
          거절 ────────────── 낡음? → 슬롯=실패, publish ←┘
          stale = disposed || epoch 다름 || 소유자 다름
범위 키:  main owner.ts composerScopeKey(6필드)   renderer stateKey(identity + 6필드)
소유자:   표 확보 → 항목 → 범위 대조 → 죽었으면 release + 표 다시 확보
```

### TO-BE — 변경 후 목표 구조와 동작 경로

```text
Claude:   prelude ─ batchContent(b) ─┐
          처음    ─ batchContent({ ...req, text: recovered }) ─┼→ 입력 스트림
          후속    ─ batchContent(next) ─┘
컴포저:   응답 ─ 낡음? ─ 부분 불일치 또는 실패 응답 → throw ┐
          거절 ────────────── 낡음? → 슬롯=실패, publish ←──┘
          stale = epoch 다름 || 소유자 다름
범위 키:  shared composerScopeKey(6필드) ← main 2곳 · renderer stateKey = [identity, 정본 키]
소유자:   항목 → 범위 대조 → 죽었으면 release → 표 확보(한 번)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 범위 키를 main `app/`과 renderer가 각자 적는다 | `shared/`가 정본 | 필드가 늘 때 한 곳만 고친다 | AR-01 / VP-04 |
| data/control flow | 턴 입력 세 벌 | 한 벌 | 한 경로만 인자를 빠뜨리는 회귀를 없앤다 | MD-01 / VP-01 |
| state/contract | `stale()`이 세 항 | 두 항 | `disposed`는 epoch가 덮는다 | MD-03 / VP-03 |
| error/lifecycle | 실패 응답은 즉시, 거절은 다음 마이크로태스크에 반영 | 둘 다 다음 마이크로태스크 | 한 경로 | MD-02 / VP-02 · §13 |
| test seam/관측점 | 범위 키를 직접 보는 테스트 없음 | `shared/composer-catalog.test.ts` | 필드 여섯을 한 입력으로 잠근다 | IT-01 / VP-04 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/composer-catalog.ts` | 범위 타입과 범위 키 | `ComposerCatalogScope` → `string` | main `app/` 2파일 · renderer 1파일 |
| `adapters/claude/adapter.ts` `batchContent` | 한 입력 묶음 → SDK content | `Pick<TurnContinuation, 4필드>` → `TurnInputContent` | `openChannel` 안 세 자리 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-01 — EP-01 | 한 입력 묶음의 네 필드 | `adapter.ts` `batchContent` | 구현자 | 3자리: prelude(`:560`) · 처음(`:562`) · 후속(`:1052`) | `git grep -n -E 'buildTurnContent\(\|batchContent\(' -- app/src/main/adapters/claude/adapter.ts` → 변경 뒤 정의 1 · 헬퍼 본문 1 · `batchContent(` 3 | 한 경로에서 첨부·요구가 모델에 전달되지 않는다 |
| MD-02 / VP-02 — EP-02 | 실패 → 실패 슬롯 | `composerCatalogState.ts` `read` | 구현자 | 2자리: `.then`의 throw 조건 · `.catch`의 슬롯 대입 | `git grep -n -E "failedSlot\(part\)\|'status' in result" -- …/composerCatalogState.ts` → 변경 뒤 2줄 | 취소·오류가 loading으로 남아 다시 시도 버튼이 뜨지 않는다 |
| MD-03 / VP-03 — EP-03 | 낡은 응답을 버린다 | 같은 파일 `stale` · `dispose` | 구현자 | 2자리: `stale` 본문 · `dispose`의 `epoch++` | `git grep -n -E 'stale\(\|this\.epoch' -- …/composerCatalogState.ts` | 구독을 푼 뒤 온 응답이 캐시·화면을 되돌린다 |
| AR-01 / VP-04 — EP-04 | 범위 키 | `shared/composer-catalog.ts` `composerScopeKey` | 구현자 | 정의 1 · 호출 3자리: `owner.ts` `read` · `service.ts` `acquire` · `State.ts` `stateKey` | `git grep -n -E 'composerScopeKey\|scope\.agentKind,?$' -- app/src` → 변경 뒤 정의 1 · 필드 나열 1벌 | 다른 범위가 같은 상태·준비를 공유하거나, 같은 범위가 갈라져 목록이 다시 로딩된다 |
| MD-04 / VP-05 — EP-05 | 소유자 항목 확보 | `composer-catalog-owner.ts` `read` 머리 | 구현자 | 1자리(머리 블록 — 조회·대조·놓기·표 확보 순) | `git grep -n -E 'this\.entries\.(get\|set)\(' -- app/src/main/app/composer-catalog-owner.ts` → 변경 뒤 `read` 머리 3줄 | 죽은 준비가 놓이지 않거나, 새 항목이 버려진 표에 들어가 종료 때 해제되지 않는다 |

선언 경계:

- 실패 응답의 반영 시점은 계약이 아니다(D-012). 실패 응답이 온 틱과 다음 마이크로태스크 사이에 publish가 한 번 있는지를 세는 테스트는 만들지 않는다. 설계 시점 실측에서 그 차이에 반응한 기존 테스트는 0이다(§8 회귀 행).
- renderer 상태 키의 문자열 꼴은 계약이 아니다(D-013). 계약은 Q2·Q3의 같음/다름이다.
- 포크가 `composer-catalog-owner.ts`에서 `composerScopeKey`를 import하는 경우는 이 트리에서 관측할 수 없다. `docs/guides`에 그 이름은 없다(`git grep -n composerScopeKey -- docs/guides` → 0줄).

규칙 칸 ↔ UT 입력 칸:

| 규칙 | 분기 | 입력 | 기대 | 좌표 |
|---|---|---|---|---|
| T1 네 필드 | 경로 셋(처음·prelude·후속) × 필드 넷 | 본문 = 경로 이름 · 텍스트 첨부 2 · 이미지 1 · **diff 요구 1(추가)** | 이미지 블록 뒤 text 블록이 `본문 → @"경로" 2줄 → 요구 블록` 순 | `adapter.context-policy.test.ts:152` 세 케이스 고쳐 씀 — 입력에 `requirements` 추가, 기대 text에 `formatDiffRequirementsPrompt([요구])` 추가 |
| T2 복구 본문 | 복구 이력이 있다 | `recovery: { history: 'archived context' }` | 입력 text가 보관 이력 머리말을 포함하고 `hello`로 끝난다 | `adapter.fork.test.ts` `recreates an expired conversation…` 기존 |
| T3 복구 없음 | 복구 이력이 없다 | T1의 처음 경로 | text가 본문으로 시작한다 | T1 `initial` |
| T4 후속 uuid | 후속 입력의 `promptUuid`가 입력에 실린다 | `pushTurn({ text, promptUuid: 'p-1' })` | SDK user 메시지의 `uuid`가 `'p-1'` | T1 `pushTurn` 케이스에 `promptUuid`와 `message.uuid` 단언 추가 |
| F1 취소 응답 | `status: 'cancelled'` | 에이전트 조회 2번째가 취소 | 에이전트 캐시 `undefined` · 슬롯 `error` | `composerCatalogState.test.ts:356` 기존 + 슬롯 단언 한 줄 추가 |
| F2 오류 응답 | `status: 'error'` | 모델 값이 있는 상태에서 retry가 `{ part: 'models', status: 'error', failure }` | 슬롯 `{ status: 'error', value: 직전 값 }` | `:176` 케이스에 단계 추가 |
| F3 거절 | promise 거절 | 같은 케이스의 `gate.reject` | 같음 | `:176` 기존 |
| F4 부분 불일치 | `result.part !== part` | 모델 retry가 `{ part: 'agents', value: [], generation: 'g' }` | 모델 슬롯 `error`, 직전 값 유지 | `:176` 케이스에 단계 추가 |
| F5 낡은 실패 | 구독 해제 뒤 실패 응답 | 해제 뒤 `{ part: 'agents', status: 'cancelled' }` | 스냅샷이 해제 직전과 같다 | `:207` 케이스 끝에 단계 추가 |
| X1 epoch | 무효화 뒤 온 옛 응답 | `:207`의 `invalidate` → `gate.resolve` | 슬롯이 `error` 그대로 | `:207` 기존 |
| X2 소유자 | 현재도 직전도 아닌 소유자 | 승격을 두 번 거친 뒤 첫 소유자의 응답 | 버린다 | `composer-promotion.test.ts:157` — 구현자가 변이 (k)로 확인, `못 잡음`이면 그 케이스에 두 번째 승격 단계 추가 |
| X3 직전 소유자 | 승격 직후 직전 소유자의 응답 | 초안 조회가 승격 뒤 도착 | 받는다(목록 표시) | `composer-promotion.test.ts:157` 기존 |
| X4 구독 해제 | 해제 뒤 값 응답 | `:207`의 `remove()` → `next.resolve` | 값이 `current` 그대로 | `:207` 기존 — 이제 `dispose`의 `epoch++`만이 막는다(변이 (l)) |
| Q1 필드 여섯 | 필드마다 | 여섯 값이 서로 다른 범위 하나 | `composerScopeKey(scope)`가 `JSON.stringify([backend, sessionId, cwd, projectId, providerKey, agentKind])`와 같다 | 신규 `app/src/shared/composer-catalog.test.ts` — 진입 `composerScopeKey`, 관측 반환 문자열 |
| Q2 identity 다름 | 같은 범위 · 다른 identity | `composerCatalogState(scope, 1)` · `(scope, 2)` | 서로 다른 인스턴스 | `composer-promotion.test.ts:332` 기존 |
| Q3 identity 같음 | 같은 범위 · 같은 identity / 다른 범위 · 같은 identity | `(scope, 1)` 두 번 · `({ ...scope, cwd: 다른 값 }, 1)` | 같은 인스턴스 / 다른 인스턴스 | `composerCatalogState.test.ts`에 케이스 1건 추가 — 진입 `composerCatalogState`, 관측 `toBe`·`not.toBe` |
| E1 항목 없음 | 처음 보는 소유자 | 첫 `call(sender, req)` | `prepare` 1회, 값 응답 | `handlers/composer-catalog.test.ts:156` 첫 호출 |
| E2 범위 다름 | 같은 소유자·다른 범위 | `scope.cwd`만 바꾼 요청 | `status: 'error'` · `failure.stage: 'owner'` · `prepare` 추가 호출 0 | `:156` 마지막 단언 + `prepare` 횟수 단언 한 줄 추가 |
| E3 죽은 준비 | 준비의 signal이 abort됨 | `a.control.abort()` 뒤 `refresh` 요청 | `a.release` 1회 · 새 세대 응답 | `:156` 기존 |
| E4 살아 있는 표 | 죽은 준비가 그 sender의 유일한 항목 | 같은 케이스(sender 4, 소유자 1) | 종료 때 `b.release` 1회 | `:156` 기존 마지막 단언 |

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/claude/adapter.ts` | 턴 입력 조립 | 구조 분해에서 기본값 셋 삭제 · `batchContent` 인자 타입을 `Pick<TurnContinuation, 'text' \| 'attachmentTexts' \| 'attachmentImages' \| 'requirements'>`로 · 처음 경로 `batchContent({ ...req, text: recoveredPrompt(req.recovery?.history, text) })` · 후속 `pushInput(batchContent(next), next.promptUuid)` | `sendMessage` + `queryMock`의 입력 스트림 |
| `app/src/shared/composer-catalog.ts` | 범위 키 정본 | `composerScopeKey` 추가(main 것 그대로) | 순수 단위 |
| `app/src/main/app/composer-catalog-owner.ts` | 소유자 표 | `composerScopeKey` 정의 삭제·shared에서 import · `read` 머리를 조회 → 대조 → 놓기 → 표 확보 순으로 | 핸들러 통합 |
| `app/src/main/app/composer-preparation-service.ts` | 준비 공유 | import 출처만 shared로 | 변경 없음 |
| `…/opencode/composer/composerCatalogState.ts` | 목록 상태 | `stale()`에서 `this.disposed \|\|` 삭제 · `.then`의 실패 분기를 `if (result.part !== part \|\| 'status' in result) throw …`로(주석 `Cancellation is an ownership outcome…` 유지) · `stateKey`를 `JSON.stringify([identity, composerScopeKey(scope)])`로 | 클래스 단위 |
| 테스트 5파일 | §10 입력 칸 | `adapter.context-policy.test.ts` · `composerCatalogState.test.ts` · `handlers/composer-catalog.test.ts` · (필요 시) `composer-promotion.test.ts` · 신규 `shared/composer-catalog.test.ts` | — |

단계와 커밋(D-004):

| 단계 | 내용 | 커밋 |
|---|---|---|
| M1 | §10 입력 칸의 테스트 추가·수정. 변경 전 코드에서 green 확인. 변이 (g)~(t) 중 변경 전 코드에 심을 수 있는 것을 돌려 `못 잡음`을 메운다 | `test(…)` |
| M2 | Claude 턴 입력 조립(D-005 a) | `refactor(claude)` |
| M3 | 컴포저 목록 넷(D-005 b~e) | `refactor(composer)` |

### 테스트 가능성

- electron/DB 의존: 없음. 대상 테스트는 전부 unit 풀이다. `shared/composer-catalog.test.ts`는 import가 타입과 그 함수뿐이다.
- Q1 테스트는 `Promise`·타이머를 쓰지 않는다 — 시간 예산 규칙(F~H′) 해당 자리 0.
- 변이 (t)는 변경 뒤 코드에만 심을 수 있다(M3 뒤 sweep).

## 12. End-to-end 영향

### producer → consumer

```text
TurnRequest/TurnContinuation ─ batchContent ─ buildTurnContent ─ 입력 스트림 ─ ClaudeInputReceipts.submitted(content, uuid)
ComposerCatalogScope ─ composerScopeKey ─ owner 항목 범위 · 준비 해석 공유 키 · renderer 상태 키
```

- `receipts.submitted`에 넘어가는 content는 같은 `batchContent` 결과다(`adapter.ts:573,577`) — 영수증 본문 상관(`input-receipts.ts` `hookText`)이 보는 값도 그대로다.
- `{ ...req, text }`는 `TurnRequest` 전체를 펼치지만 `batchContent`는 네 필드만 읽는다.

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음 — 등록·초기화 값이 늘지 않는다.

## 13. Lifecycle / 오류 / 정리

실패 응답 반영이 한 마이크로태스크 늦어지는 사이 끼어들 수 있는 사건별 최종 상태:

| 끼어든 사건 | AS-IS (실패 슬롯 → 사건) | TO-BE (사건 → 실패는 낡아 버림 또는 그대로 반영) | 같은가 |
|---|---|---|---|
| 무효화 이벤트(`:82-90`) | 실패 슬롯 → 전 슬롯 error | 전 슬롯 error, 실패는 epoch 불일치로 버림 | 같다 |
| 플러그인 개정(`:70-81`) | 실패 슬롯 → 전 부분 재조회로 loading | loading, 실패는 버림 | 같다 |
| 구독 해제(`dispose`) | 실패 슬롯(보는 이 없음) | 버림 | 관측자 없음 |
| 승격(`promote`) | 실패 슬롯 유지 | 직전 소유자라 낡지 않음 → 실패 슬롯 반영 | 같다 |

- `.finally`의 `flights` 정리는 그대로다(`:195-197`).
- `dispose` 뒤 `disposed`는 `intent`·`read`·`dispose` 재진입 가드로 계속 쓴다 — 필드는 남는다.

## 14. 성능 / 상한 / 최적화

단계 지도(설계 시점 실측 diff를 조각별로 가름):

| 조각 | 파일 | 순증감 |
|---|---|---|
| (a) 턴 입력 조립 | `adapter.ts` | −13 |
| (b) 실패 합류 | `composerCatalogState.ts` | −8 |
| (c) `stale()` 항 | 같음 | −4 |
| (d) 범위 키 | `composerCatalogState.ts` −7 · `composer-catalog-owner.ts` −10 · `shared/composer-catalog.ts` +10 · `composer-preparation-service.ts` 0 | −7 |
| (e) 표 확보 | `composer-catalog-owner.ts` | −2 |
| 합 | | **−34** |

- AC7 임계 28 = 34에서 포맷·import 줄 오차 6을 뺀 값.
- test는 늘어난다 — 신규 1파일(약 15줄)과 입력 단계 추가(약 30줄). D-002의 "통합·삭제할 수 있다"에 해당하는 구조 결합 테스트는 이 다섯 자리에 없다.
- 실행 비용 변화 없음.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 포트·스키마·설정 변화 없음. `LiveTurn`·`ComposerCatalogLease` 시그니처 그대로.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 세 입력 경로가 같은 첨부 위임을 쓴다(0245 AC21) | `adapter.context-policy.test.ts:150` | §10 T1 | 유지 — 입력에 요구를 더해 강화 |
| 취소는 소유권 결과이지 빈 목록이 아니다 | `composerCatalogState.ts:161` 주석 | §10 F1 | 유지 |
| 같은 epoch의 옛 세대 응답을 거른다 | `composerCatalogState.test.ts:245` | D-011 | 유지 — 손대지 않음 |
| 획득이 해제보다 먼저(`Acquire before release`) | `composer-catalog-owner.ts:162-164` | §10 E3 | 유지 — `adopt`는 손대지 않음 |
| `shared/`는 런타임 의존 0 | `app/src/main/AGENTS.md` 레이어 표 | §11 | 유지 — `JSON.stringify`뿐 |
| renderer는 `shared/`를 import할 수 있다 | `composerCatalogState.ts:1-6`(이미 타입 import) | §11 | 유지 — 값 import로 바뀌므로 lint로 확인 |
| 후보 표 겹침 | `INDEX.md ## 새 handoff 후보` | — | 0행 — 0262·0294·0296·0299·0302·0308 행의 대상 파일과 겹치지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| `{ ...req, text }`가 뒤에 더해질 필드를 의도치 않게 싣는다 | `batchContent` 인자 타입이 네 필드만 읽게 고정한다 |
| 실패 반영 시점 변화가 화면 깜빡임을 만든다 | 한 마이크로태스크 안이라 렌더 프레임이 끼지 않는다. §13 표로 최종 상태 동일을 보였다 |
| 변이 (g)~(t)를 설계 시점에 돌리지 못했다 | M1이 먼저 돌리고 입력을 메운다. verify 1회째가 전수 재실행한다 |
| Windows 전용 경로 테스트를 이 환경에서 못 본다 | 좌표를 Linux에서 도는 파일로만 잡았다. Windows CI가 나머지를 본다 |

## 18. 영향 받는 파일 / 문서

- 코드: §11 표의 prod 5파일 · 테스트 4~5파일.
- 문서: `docs/arch/**` 변경 없음(§8 마지막 행). `docs/generated/inventory.md`는 채널·슬라이스 수가 그대로라 재생성 결과가 같아야 한다(가드로 확인).
- handoff: 이 plan · `INDEX.md`.

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` — better-sqlite3 ABI · 제약 환경 게이트 가이드, CI 표 · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- 환경 제약: `app/node_modules`는 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts`로 설치한다. vitest 실패는 변경 전 같은 명령의 실패 식별자 집합과 차집합으로 분리한다(§8 기준선 원인).
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 가드 스크립트: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs`.
- 테스트: 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"`.
- 이번 handoff 전용: EP-01~EP-05 검색 · AC6 diff · AC7 numstat.
- 실행 방식: 긴 명령도 포그라운드로 돌리고 변이는 대상 테스트 파일을 지정해 한 번에 몇 개씩 돌린다(D-004 · 설계 턴에서 백그라운드 실행이 응답 없이 길어져 사용자가 취소했다).
- 사람 실기(AC9): 개발 빌드에서 (a) Claude 세션에 텍스트 파일·이미지를 붙여 전송하고, 응답 중 한 번 더 전송한다 — 두 입력 모두 첨부가 보인다 (b) diff 요구를 단 전송이 된다 (c) OpenCode 새 대화에서 모델·에이전트 목록이 뜨고 첫 전송 뒤에도 비지 않는다 (d) MCP·플러그인 메뉴를 연다.

## READY self-review

- [x] Decision Ledger — D-001~D-013, 상속 3건은 출처 plan을 적었다.
- [x] Product & UX Contract가 앞에 있고 §5 흐름만으로 완료 상태를 설명한다.
- [x] 사용자 문장을 §2에 원문으로 두었다. 범위 선택은 추론 행으로 표시했다.
- [x] 사용자에게 올릴 제품 결정 0 — 동작을 바꾸는 후보(D-008)는 제외하고 보고 항목으로 남겼다.
- [x] 수치 실측: EP-01 `5줄(자리 3)` · EP-02 `2` · EP-04 `정의 2·호출 5` · 바깥 변수 `19` · diff `+56 −99` · 회귀 `28 failed · 1576 passed` 전후 동일.
- [x] 저장소 규칙: `shared/` 순수 규칙 · 테스트 풀/예산 가드 · 후보 표 겹침 0.
- [x] 각 AC가 동작 기준·검증 수단·도달 경로를 가진다 — §7.
- [x] Baseline V. `CHANGED` node MD-01~04·AR-01마다 같은 레벨 `REQUIRED` pair VP-01~05.
- [x] 영향받는 상위 회귀는 VP-06 `REGRESSION`. `NOT_REQUIRED` 행 없음.
- [x] pair마다 path·§10 자리·검색 명령·좌표. 적대 증거는 VP-01~05에 이유와 변이 (a)~(t).
- [x] 규칙 칸 분기 T1~T4·F1~F5·X1~X4·Q1~Q3·E1~E4마다 입력이 있다. X2는 기존 좌표의 민감도를 구현자가 변이 (k)로 확인하고 모자라면 더할 입력을 적었다.
- [x] 선언 경계 3건 — 반영 시점은 실측(반응한 테스트 0)과 함께, 포크 import는 문서 검색 0줄과 함께 적었다. 열린 입력 집합 판정 산출물은 만들지 않는다.
- [x] 운영 gate 5행.
- [x] 사람 실기는 AC9의 실환경뿐이다.
- [x] structural proxy만으로 닫는 semantic AC 없음 — AC4의 "정의 1" 검색은 Q1~Q3 행동 단언과 짝이다.
- [x] "쓰인다" 불변식의 장치: T1은 필드를 지우면(변이 a~c) 실패하고 Q1은 필드를 지우거나 맞바꾸면 문자열이 달라 실패한다.
- [x] 정책 파라미터·배타 상태·참조 구현: 해당 없음.
- [x] 신규 계약 `composerScopeKey`(shared)의 레이어·강제 지점·seam — §9·§10·§11.
- [x] producer/consumer — §12, 영수증 상관이 보는 content까지 확인.
- [x] worst-case·one-way door: 해당 없음(키는 메모리 안에서만 산다).
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 갱신 메모에 적었다 — 충돌 0.
- [x] 문장 규칙 — 표 칸 3줄·문단 3문장.

---

## [구현자 기입] 설계 리뷰

(구현 턴에서 채운다 — `plan.template.md`의 `[구현자 기입]` 절 전부)

## [검증자 기입] 파생 이슈

(검증 턴에서 채운다)
