---
name: handoff-verify
description: docs/handoff/ 의 verify.md를 작성할 때 쓴다. **구현이 끝나 보드가 `impl/IMPL_DONE`이고 다음 주체가 검증자면** 로드한다 — 외부 PR 리뷰는 verify가 아니다. 현재 구현을 처음 보는 남의 PR처럼 독립 검증하며 plan의 유효 V와 REQUIRED·REGRESSION pair를 UT→IT→ST→AT 순으로 닫고 현재 변경 산출물의 운영 gate를 확인한다. 역방향 발견은 BLOCKING·PLAN_GAP·NON_BLOCKING·NEXT_HANDOFF로 범위를 판정하며 구현자 보고는 증거로 받지 않는다. 지침 개선은 handoff-review에 위임한다.
---

# handoff-verify — 현재 구현을 독립 검증하기

## 책임

이 스킬은 **이번 구현이 운영에 나가도 되는지 판단하는 실행 스킬**이다.

- 설계자·구현자가 자신이어도 처음 보는 남의 PR처럼 읽는다.
- AC만 채점하지 않는다. **Product & UX Contract / ACTIVE Decision / 유효 V(Baseline V 또는 기준 V + Delta V) / 실제 production path**를 함께 검증한다.
- 구현 보고·코드 주석·이전 verify 결론을 증거로 받지 않는다.
- 기준 밖 결함도 찾되 현재 pair·ACTIVE Decision·기존 blocking 이슈 또는 이번 변경 산출물의 필수 gate에 귀속되지 않으면 현재 PASS를 막지 않는다.
- 못 본 것은 못 봤다고 쓴다.

**하지 않는 일**:

- 검증 종료 때 failure corpus를 직접 갱신하지 않는다.
- 이번 실패를 즉석에서 일반화해 `handoff-plan`이나 자기 SKILL을 수정하지 않는다.
- 반복 실패의 원인 분류·skill 개선은 [`../handoff-review/SKILL.md`](../handoff-review/SKILL.md)에 위임한다.

## 먼저 읽을 것

1. `docs/handoff/AGENTS.md`.
2. 대상 handoff의 `plan.md` 전체 — Decision Ledger, Part I, Technical Design AS-IS/TO-BE, AC, `[구현자 기입]`.
3. 구현 커밋 전후 diff와 구현 전 plan 기준선.
4. [`verify.template.md`](verify.template.md).
5. **수정한 subtree의 가장 구체적인 `AGENTS.md`**. `app/**`가 포함되면 `app/AGENTS.md`의 gate/ABI 규칙이 generic template보다 우선한다.

# 검증 순서

```text
0. 검증 대상 commit/range·구현 전 plan 기준선·plan validity 고정
1. Product/UX + ACTIVE Decision 기억
2. AC 전에 diff 비판적 읽기
3. 역방향 탐색 — 미배선/죽은 코드/비대칭/소비자 누락
4. 구현자가 plan/AC를 바꿨는지 확인
5. Product/UX ↔ end-to-end 경로 검증
6. REQUIRED/REGRESSION V-pair를 UT → IT → ST → AT로 닫기
7. gate/환경 분리/사람 실기 경계
8. repository operation checks(AGENTS/INDEX/trailer)
9. PASS/FAIL/RETURN_TO_PLAN + finding disposition + review signal 기록
```

## 0. 검증 기준선을 잠근다

구현자가 plan을 수정할 수 있으므로 현재 파일만 보고 채점하면 자기 증명이 된다.

- 구현 커밋이 건드린 `plan.md` diff를 먼저 본다.
- AC·Decision Ledger·Product/UX Contract 변경이 설계자/사용자 승인인지 확인한다.
- 구현자가 자기 코드에 맞춰 AC를 완화/재작성했다면 원래 기준으로 채점한다.
- 사용자 결정이 실제로 바뀐 경우만 `SUPERSEDED` 근거를 확인하고 새 기준을 따른다.
- **기준선이 diff로 성립하지 않으면 그 사실을 먼저 적는다.** 설계와 산출이 한 커밋에 들어왔거나 plan 커밋이 따로 없으면 §0의 자기 증명 방지 장치는 작동하지 않는다 — "AC 변경 없음"을 확인했다고 쓰지 말고 **확인할 수 없었다**고 쓰고, 채점 기준으로 삼은 AC·Decision 원문을 이번 문서에 인용해 고정한 뒤 그 기준으로 채점한다. 다음 라운드부터는 plan 커밋과 구현 커밋이 갈리므로 이 예외는 그 라운드에 한정된다.

기준선을 잠근 뒤 **plan validity**를 먼저 감사한다.

- V mode가 맞는가. 상속 기준이 없으면 Baseline V이고, Delta V라면 기준 handoff·plan revision·commit과 적용 순서로 유효 V를 재구성할 수 있는가.
- 변경 효과에 필요한 레벨이 선택됐고 모든 `NEW`·`CHANGED` 왼쪽 node에 같은 레벨 `REQUIRED` pair, 영향받은 `INHERITED` 상위 node에 `REGRESSION` pair가 있는가.
- 각 pair에 production path·§10 강제 지점 전수·직접 oracle이 있는가. 구조적 proxy·0건/전수·배선 존재처럼 적대 증거가 필요한 pair는 선택 이유와 변이가 있고, 나머지는 직접 oracle로 충분한 이유가 있는가.
- 현재 변경 산출물에 적용되는 subtree·repository gate가 열거됐는가. 관련 없는 기존 실패를 새 blocking 범위로 올리지 않았는가.
- 구현/검증에 필요한 계약·node·pair·경로·강제 지점·oracle이 빠졌거나 서로 모순되어 구현자가 선택해야 한다면 `PLAN_GAP`이다. 다만 이미 명시된 Decision·AC·코드 계약을 구현이 위반하면 pair 행 누락을 이유로 결함을 낮추지 않고 `PAIR_FAIL`로 판정하며 plan gap도 함께 기록할 수 있다.
- V 도입 전 작성된 진행 중 plan은 AC·§10·production path에서 **읽기 전용 V 매핑을 합성**한다. 형식이 옛것이라는 이유만으로 migrate하거나 `PLAN_GAP`을 만들지 않고, 실제 판정에 필요한 계약/증거가 빠졌을 때만 gap으로 판정한다.

## 1. AC 전에 구현 자체를 비판적으로 읽는다

`git diff <base>..<head>`를 통째로 읽으며 묻는다.

- 지연·부분 실패·동시 호출·종료 중·오프라인·권한 거부에서 어떻게 실패하는가.
- **false success**가 가능한가.
- 상태 변경·마이그레이션·외부 쓰기가 실패 중 어디까지 남는가.
- Product/UX가 요구한 A가 아니라 합리적이지만 다른 B를 구현하지 않았는가.
- 로그/경고만 없애고 원인 상태는 남기지 않았는가.
- 캐시/snapshot/호출 축소가 재검증·취소·만료 관측을 없애지 않았는가.
- 모델 컨텍스트 출력·배치·요청 fan-out의 worst-case가 무제한이 되지 않았는가.

## 2. 역방향 탐색 — 코드에서 기준 밖 표면을 찾는다

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh <base>..<head>
```

스크립트는 후보만 준다. 추가로 직접 본다.

- 변경 export의 프로덕션 참조 0건.
- 테스트에만 등장하는 신규 함수/포트.
- 형제 파일 정책 비대칭.
- 신규 레지스트리/스토어 값의 기존 소비처 전수와 부작용.
- producer ↔ consumer 파생 불일치.
- 같은 규칙의 중복 구현/SSOT drift.
- 외부 SDK/문서 예제/fixture의 실제 계약 타입·의미.

발견은 숨기지 않되 바로 blocking으로 승격하지 않는다. 현재 유효 V-pair·ACTIVE Decision·이전 blocking 이슈에 매핑되면 `BLOCKING`, 필요한 기준선 자체가 빠졌으면 `PLAN_GAP`, 이번 변경 산출물의 필수 gate 위반이면 `BLOCKING`, 그 밖은 `NON_BLOCKING` 또는 `NEXT_HANDOFF`다.

**테스트가 있다는 사실과 프로덕션에 배선됐다는 사실을 분리한다.** 두 방향을 모두 본다.

- 유일한 호출자가 테스트면 기능은 **미배선**이다.
- 테스트가 production symbol을 부르지 않고 **같은 이름·같은 형상의 로컬 재구현**을 세워 그것을 단언하면, 배선돼 있어도 **그 테스트는 production 계약을 잠그지 않는다**. production 구현이나 그 호출부가 깨져도 통과한다. 인자 타입만 production 것을 빌려 쓰는 경우도 같다 — 타입은 형상을 잠그고 동작은 잠그지 않는다.

“이 파일이 없으면 어떤 production 코드가 깨지는가”에 답할 수 없으면 그 테스트는 증거가 아니다.

이 절차의 대표 실증은 [`references/0157-case.md`](references/0157-case.md)다. 이 파일은 역방향 탐색·test-only symbol·형제 정책 비대칭·“테스트 불가” 오판의 근거 사례이며 고아 reference로 두지 않는다.

## 3. Product & UX Contract를 end-to-end로 검증한다

```text
사용자/시스템 시작점
  → main/feature 진입점
  → 계약/상태/저장
  → consumer/renderer/tool/external output
  → 성공/실패/취소 결과
```

각 ACTIVE Decision이 구현·Product/UX·Technical Design·AC에서 일관되는지 본다. `SUPERSEDED`는 실제 사용자 변경 근거가 있어야 한다. UI/표시 계약은 producer와 consumer를 둘 다 본다.

## 4. 구현 보고와 structural proxy를 증거로 쓰지 않는다

- `Criteria-Met: N/N`은 증거가 아니다. **구현자가 보고한 강제 지점 전수 `N/M`도 같다** — 구현자가 닫고 검증자가 **다시 센다**(§6). 보고를 대조의 출발점으로 쓰되 결론으로 쓰지 않는다.
- **행을 다 센 뒤 합계와 분모를 따로 센다.** 행마다 관측값이 맞아도 합계는 틀린다 — 0187 r1·0189 r1·0190 r1이 전부 합계 축에서 어긋났고 0190 r1의 행 관측값은 재측정과 전부 일치했다. 자기보고 합계가 **본문·커밋 trailer·INDEX 비고에서 같은 값인지** 대조한다(0190 r1은 본문 `14/17` ↔ trailer 3개 `13/17`로 갈렸다).
- 파일:라인은 “구현됨”이지 “검증됨”이 아니다.
- **구현자가 보고한 “설계 대비 차이”는 타당 판정으로 닫히지 않는다.** 대체물이 갖고 원본이 갖지 않던 실패 모드를 실제로 만들어 그 메커니즘에 기대던 AC·§10 행을 다시 단언한다 — 0198 r2는 catalog cache↔runtime cache 결합을 “타당한 차이·warm-cache 테스트로 뒷받침”으로 적었고, 만료를 넣자 AC13이 깨졌다.
- **등록된 적대 증거와 인용 변이를 검증자가 다시 센다.** 구현자가 무엇을 심었다고 보고했든 관계없이 pair가 선택한 변이, 파생 이슈가 인용한 변이, 이번 라운드가 새로 만든 구조적 proxy·0건/전수·배선 oracle의 민감도 검사를 그대로 재현한다. 일반 hunk를 자동 분모로 삼지 않고 직접 행동 oracle이 충분한 pair에 새 mutation을 발명하지 않는다.
- **동작을 보존하는 추출·재배치 라운드에서 hunk 되돌림은 아무것도 재지 못한다.** 되돌리면 동작이 같은 이전 코드로 돌아갈 뿐이라 초록이 정답이므로, 그 초록을 `잠금 없음`이나 `잠김`으로 읽지 않는다.
- **형제 슬롯이 서로 다른 계약을 가지면 소거 변이만으로 부족하다.** 두 슬롯의 산출을 맞바꿔 장치가 red 인지 본다 — 존재만 보는 단언은 두 문자열이 모두 남아 침묵한다(0204 r4: `진행 상황`↔`출력` 본문 맞바꿈에 423케이스 전건 통과).
- **소거 변이는 장치가 침묵할 때까지 민다.** 지운 자리가 남긴 잔여물(unused import·dead local·타입 진단)에 게이트가 걸리면 그 red는 잠금이 아니라 치우면 사라지는 부산물이다 — 잔여물을 치우는 정리를 따라가 **진단이 0이 될 때까지** 밀고 그 상태의 게이트로 판정한다. 0198 r7 M-J는 1단계에서 멈춰 `typecheck red`를 잠금으로 적었고, r8이 3단계까지 밀자 typecheck·eslint·전체 스위트가 전부 초록이었다.
- **검출되지 않은 인용 변이가 있으면 그 파생 이슈는 닫히지 않았다.** 구현자가 `closed`로 적었어도 상태를 되돌리고 §13으로 이관한다.
- mutation은 현재 pair가 선택한 적대 증거 또는 닫는 이슈가 인용한 변이일 때만 blocking 증거가 된다. 새 mutation이 현재 계약 위반을 드러내면 기존 pair를 `PAIR_FAIL`, 필요한 oracle/pair 누락을 드러내면 `PLAN_GAP`, 현재 유효 V와 무관하면 `NON_BLOCKING`/`NEXT_HANDOFF`로 둔다.
- 함수 호출 지점 1개, `Promise.all`, 특정 시그니처가 semantic 목표를 실제 보장하는지 적대 사례를 본다.
- `N회`는 실제 관측 주체에서 횟수를 단언한다.
- 순서 AC는 훅/로그/주입 경계에서 순서를 관측한다.
- “기존 테스트가 보장”한다면 실제 케이스·핵심 입력·분기 실행을 확인한다.

## 5. 사람 실기 전에 테스트 가능한 핸들을 끝까지 찾는다

“UI라서”, “SDK라서”, “electron이라서”를 이유로 바로 사람에게 넘기지 않는다.

- in-memory/test transport가 있는가.
- 막힌 것이 시스템 전체인가, native를 import하는 파일 하나인가.
- electron 비의존 부품으로 조립을 재구성할 수 있는가.
- 구조적 port에 fake/adversarial 구현을 주입할 수 있는가.
- 시각이 아니라 순수 상태/후보/정렬/파생 로직인가.

가능한 부분까지 기계 검증하고 남는 경계만 사람 실기로 넘긴다.

## 6. V-pair closeout — `UT → IT → ST → AT`

각 `REQUIRED`·`REGRESSION` pair를 낮은 레벨부터 독립 판정한다. 결과는 `PASS` · `PAIR_FAIL` · `BLOCKED_BY:<root-pair>` · `NOT_REQUIRED`만 쓴다.

- `MD↔UT`: 모듈 불변식·알고리즘·seam을 직접 단언하고, plan이 선택한 경우에만 음성 대조/결함 변이를 심는다.
- `AR↔IT`: 실제 producer/consumer·모듈 경계·조립·계약 edge를 지난다. 동명 로컬 재구현은 증거가 아니다.
- `SD↔ST`: 시작점부터 저장/상태/오류·정리까지 end-to-end 수명주기를 지난다.
- `R↔AT`: Product/UX 목적과 AC 행동을 production path에서 닫는다. 외부 port/schema/config는 shape + semantics 두 층으로 확인한다.

하위 root 실패로 상위 pair를 독립 판정할 수 없을 때만 `BLOCKED_BY:<root-pair>`로 둔다. 상위 행동을 다른 경로에서 독립 관측할 수 있으면 실행하며, 같은 root 원인을 네 단계의 `PAIR_FAIL`로 부풀리지 않는다. 하나의 직접 증거가 여러 pair를 닫으면 각 행에 공유 증거와 판정 범위를 적는다.

plan §10은 pair 안에서 **별도 분모**로 계속 걷는다. `언제 강제`에 열거된 지점을 코드에서 하나씩 다시 세고, `실패 의미`의 적대 상태를 만든다. “다른 게이트가 막는다”는 주장도 필요한 pair의 선택된 변이로 재측정한다. 표 밖 지점이 현재 pair·ACTIVE Decision·AC에 필수면 `PLAN_GAP`, 그 밖이면 `NON_BLOCKING`/`NEXT_HANDOFF`다.

첫 검증 라운드는 유효 V의 모든 `REQUIRED`·`REGRESSION` pair와 현재 변경의 운영 gate를 실행한다. 재검증은 root 실패 pair·그 종속 pair·이번 변경으로 영향받은 pair·적용 gate를 실행하고, 영향받지 않은 이전 `PASS`는 증거 좌표를 참조한다. 이전 라운드 산문을 복사해 다시 PASS 수에 더하지 않는다.

## 7. 숫자·음성 기준·상한을 재측정한다

- N개 소비처/파일/테스트를 다시 센다.
- 내역 합 = 총계인지 본다.
- 0건 게이트가 정당한 이력/예외를 지우지 않는지 본다.
- 총량 임계가 제거 대상과 허용 대상을 섞지 않는지 본다.
- 모델 출력·요청 fan-out의 worst-case 상한을 재계산한다.

## 8. 환경/ABI 게이트 — 하위 AGENTS를 명령 정본으로 쓴다

`app/**` 검증 시 **`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`를 먼저 읽고 그대로 따른다.** generic `npm test`를 기본 게이트로 강제하지 않는다.

현재 app 규칙의 핵심:

- 기본 코드 수정 게이트: `cd app && npm run lint && npm run typecheck` — ABI 중립.
- DB를 실제로 실행하지 않는 관련 테스트: `./node_modules/.bin/vitest run <suite>` 또는 해당 순수 테스트 명령 — `pretest` 우회.
- `npm test`는 DB 동작을 실제로 검증해야 할 때만 의도적으로 사용한다. 이 명령은 `pretest`로 better-sqlite3를 Node ABI로 바꾼다.
- 그 뒤 `dev/build`는 Electron ABI rebuild가 필요하며 egress 차단 환경에서는 403으로 실패할 수 있다.
- 환경 실패를 변경 무관으로 판정하려면 실패 목록과 알려진 ABI signature를 분리해 증거를 남긴다.

하위 `AGENTS.md`가 이후 바뀌면 **그 문서의 현재 명령이 우선**하며 이 SKILL의 요약을 오래된 정본처럼 사용하지 않는다.

### 자기 게이트 실행도 §4의 대상이다

§4는 구현 보고와 structural proxy를 증거로 받지 말라고 한다. **그 규칙은 검증자 자신이 돌린 게이트에도 그대로 적용된다** — exit code는 "명령이 끝났다"는 형태이지 "검사가 실행됐다"는 의미가 아니고, 게이트 명령 자체가 검증 대상을 바꿀 수 있다.

- **exit code를 통과 증거로 쓰지 않는다.** 실행 산출을 관측해 적는다 — 테스트는 파일 수·케이스 수, 정적 검사는 error/warning 수. 리포터·설정·경로 오류로 **아무것도 실행되지 않고 exit 0**이 나올 수 있고, 그 0을 그대로 옮기면 검증 자체가 false success다.
- **게이트가 작업 트리를 바꿨는지 확인한다.** 포맷·autofix가 붙은 명령(`--fix`·formatter·codegen)은 검증 대상 파일을 쓴다. 실행 후 트리 상태를 보고, 변경이 있으면 그것이 검증 대상에 포함되는지 판정한다 — 검증자가 고친 코드를 검증자가 채점하면 자기 증명이다.
- **구현자가 이번 라운드에 만들거나 고친 구조적 proxy·0건/전수 게이트는 그 자체가 검증 대상이다.** 스윕·정규식·실재 판정 기준을 그대로 재실행해 같은 산출을 얻는 것은 재현이지 검증이 아니다 — **판정 기준을 한 단계 엄격하게 바꿔 재측정하고 차집합을 본다**(부분 문자열 → 접미사, 전체 파일 → 비주석 줄). 차집합이 비어야 그 `0건`이 전수를 뜻한다. **다만 엄격화는 그 스윕이 전수인지를 재지, 그 스윕이 불변식을 잠그는지를 재지 않는다** — 방향은 §4의 소거 변이가 판정한다.
- **자기 명령이 남긴 잔여물도 본다.** 의존성 복구·캐시·로그 등 검증 중 실행한 명령이 만든 미추적 산출물은 구현 결과가 아니다. 남았으면 정리하거나 파생 이슈로 적는다.

## 9. Repository operation checks

코드/AC 외의 협업 운영도 검증 대상이다.

- `AGENTS.md` 변경 시: 비밀/토큰/이메일/IP 등 위생, 일회성·변동성 정보 혼입, 부모↔자식 규칙 충돌을 확인한다. 새 `AGENTS.md`를 만들었다면 `CLAUDE.md` stub/루트 표 필요 여부도 본다.
- `docs/handoff/INDEX.md`: 상태·다음 주체·대상 커밋·PASS archive 이동이 실제 상태와 맞는지 확인한다. **이번 턴에 갱신된 비고가 5줄을 넘으면 그것도 미스매치다** — 상세의 정본은 `plan.md`/`verify.md`다(`docs/handoff/AGENTS.md §산출물 문장 규칙 3`). 다른 행의 옛 비고는 대상이 아니다.
- **대상 커밋 좌표는 검증자가 기입한다** — 구현자가 남긴 `(rN 구현 — 검증자 기입)`을 공유 브랜치의 실제 커밋으로 채운다. 구현자가 해시를 적어 놓았으면 그것도 자기 환경의 좌표이므로 `git cat-file -t <hash>`로 확인하고 교정한다. **좌표 정본은 INDEX 한 곳이다** — plan 구현 보고 행은 자리표시자로 둔다(사본이 둘이면 갈린다, P40).
- **재구현 라운드의 `[구현자 기입]`이 impl §8의 7개 필드를 모두 갖는지 센다** — 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals다. 산문으로 접힌 필드는 그 필드가 요구한 증거가 없는 것이다(0198 r6: `이번 라운드 수정의 잠금`이 표 대신 한 줄이 되며 5 hunk 중 3만 실렸다).
- commit trailer: root `AGENTS.md` / `docs/git-template.md` 허용값을 따르고 **실제로 파싱된다**. 허용되지 않은 `Agent` 값 등을 통과시키지 않고, `git log -1 --format='%(trailers:only=true)' <커밋>`이 적힌 키를 그대로 돌려주는지 본다 — 값이 맞아도 파싱이 0건이면 메시지 버스가 끊긴 것이다(0198 r7: 본문이 리터럴 `\n`으로 한 줄이라 6키가 0건). 인용된 커밋 해시가 실재하는지 확인한다 — 죽은 좌표는 다음 라운드의 기준선을 깬다(0190 D3: `55cdbfe`, 실제는 `8bbd595`).
- reference/script: 이동·삭제 후 살아 있는 소비처 또는 의도적 archive 근거가 있는지 확인한다.

## 10. 사람 vs 에이전트 책임

- 기계적으로 판정 가능한 gate·계약·상태 로직·레이어 경계·문서 형식/위생은 에이전트가 확인한다.
- 제품 의도·Open Question·시각 품질·신규 의존성 승인·PR merge는 사람이 결정한다.
- “UI/SDK/electron”을 이유로 순수 로직까지 사람에게 넘기지 않는다.

## 문서 문장 규칙

[`docs/handoff/AGENTS.md §산출물 문장 규칙`](../../../docs/handoff/AGENTS.md)을 따른다. verify에서 특히:

- 절마다 판정 → 관측 순서다. 표 한 칸이 3줄을 넘으면 근거를 행으로 쪼갠다.
- **이전 라운드 판정은 보존하되 재서술하지 않는다.** r1 원문은 그 자리에 두고 이번 본문은 링크한다 — 같은 판정이 두 곳에 길게 있으면 갈린다.
- 줄이는 것은 서술이다. 재측정 수치·재현 명령·전수 개수·못 본 것의 명시는 줄이지 않는다.

## 11. PASS / FAIL / RETURN_TO_PLAN

- `PASS`: 모든 `REQUIRED`·`REGRESSION` pair와 이번 변경 산출물의 필수 gate가 PASS이고 ACTIVE Decision이 충족되며 `PLAN_GAP`이 없다. `NON_BLOCKING`·`NEXT_HANDOFF`는 기록하되 PASS를 막지 않는다.
- `FAIL`: 하나 이상의 현재 pair 또는 이번 변경 산출물의 필수 gate가 실패했다. root `PAIR_FAIL`과 종속 `BLOCKED_BY`를 분리해 `[검증자 기입] 파생 이슈`로 이관한다.
- `RETURN_TO_PLAN`: 구현자가 새 계약을 발명하지 않고는 닫을 수 없는 `PLAN_GAP`이 있다. root gap과 영향 pair를 적고 설계자로 돌린다.

제품 결정이 필요하면 해결안으로 위장하지 않는다. `FAIL`과 `PLAN_GAP`이 함께 있으면 둘 다 기록하고 다음 주체는 planner다. 명시 계약 위반을 gap으로 약화하지 않는다.

## Review Signals — 사실만

verify는 원인 분류 대신 다음 사실만 남긴다.

- 이전 라운드와 동일/유사 증상인지.
- 관련 plan 지침/AC가 있었는지.
- 사용자 결정 변경 근거가 있는지.
- 반복된 검증 환경 한계가 무엇인지.

A~F 분류와 skill 변경은 `handoff-review`가 한다.

## 마무리

- PASS: INDEX `verify/PASS`, 완료 행 archive 이동.
- FAIL: INDEX `verify/FAIL`, 라운드 +1, 다음 주체는 구현자다.
- RETURN_TO_PLAN 또는 FAIL과 함께 있는 PLAN_GAP: INDEX `verify/RETURN_TO_PLAN`, 다음 주체는 설계자다. 설계자는 Decision·AC·V node/pair·§10·oracle 중 영향받은 규범 행을 새 Delta V revision으로 고치고 별도 커밋으로 `plan/READY`에 돌린다.
- 라운드가 3을 초과하면 다음 재구현 전에 `handoff-review`를 수행한다.
- 커밋 형식은 root `AGENTS.md`와 `docs/git-template.md`를 따른다.
