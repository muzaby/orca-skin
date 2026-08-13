---
name: handoff-verify
description: docs/handoff/ 의 verify.md를 작성할 때 쓴다. 구현 완료 후 현재 구현을 독립 검증하며, plan의 Product/UX Contract·Decision Ledger·Acceptance Criteria와 실제 end-to-end 동작을 대조하고 기준 밖 결함도 역방향으로 찾는다. 실패를 일반화해 스킬 자체를 고치는 일은 handoff-review에 위임한다.
---

# handoff-verify — 현재 구현을 독립 검증하기

## 책임

이 스킬은 **이번 구현이 운영에 나가도 되는지 판단하는 실행 스킬**이다.

- 설계자·구현자가 자신이어도 처음 보는 남의 PR처럼 읽는다.
- `plan.md`의 AC만 채점하지 않는다. **Product & UX Contract / ACTIVE Decision / 실제 production path**를 함께 검증한다.
- 구현 보고·코드 주석·이전 verify 결론을 증거로 받지 않는다.
- 기준 밖 결함도 찾는다.
- 못 본 것은 못 봤다고 쓴다.

**하지 않는 일**:

- 검증 종료 때 `failure-patterns.md`를 직접 갱신하지 않는다.
- 이번 실패를 즉석에서 일반화해 `handoff-plan`이나 자기 SKILL을 수정하지 않는다.
- 반복 실패의 원인 분류·skill 개선은 [`../handoff-review/SKILL.md`](../handoff-review/SKILL.md)에 위임한다.

## 먼저 읽을 것

1. `docs/handoff/AGENTS.md`.
2. 대상 handoff의 `plan.md` 전체 — 특히 Decision Ledger, Part I Product & UX Contract, AC, `[구현자 기입]`.
3. 구현 커밋 전후 diff.
4. [`verify.template.md`](verify.template.md).

---

# 검증 순서

```text
0. 검증 대상 commit/range와 구현 전 plan 기준선 고정
1. Product/UX + ACTIVE Decision 기억
2. AC를 보기 전에 diff 비판적 읽기
3. 역방향 탐색 — 미배선/죽은 코드/비대칭/소비자 누락
4. 구현자가 plan/AC를 바꿨는지 확인
5. Product/UX ↔ end-to-end 경로 검증
6. AC 1:1 검증
7. gate/환경 분리/사람 실기 경계
8. PASS/FAIL + 파생 이슈 + review signal 기록
```

---

# 0. 검증 기준선을 먼저 잠근다

## 구현 전 plan 원문 보존

구현자가 plan을 수정할 수 있으므로 현재 파일만 보고 채점하면 자기 증명이 된다.

- 구현 커밋이 건드린 `plan.md` diff를 먼저 본다.
- AC·Decision Ledger·Product/UX Contract가 구현 커밋에서 바뀌었다면 **설계자가 승인한 변경인지** 확인한다.
- 구현자가 자기 코드에 맞춰 AC를 완화/재작성했다면 원래 기준으로 채점한다.
- 사용자 결정이 실제로 바뀐 경우만 Decision `SUPERSEDED` 근거를 확인하고 새 기준을 따른다.

AC가 지나치게 많아 일부만 구현하거나 다시 쓰는 징후가 있으면 전체 매트릭스를 더 엄격하게 본다.

---

# 1. AC 전에 구현 자체를 비판적으로 읽는다

`git diff <base>..<head>`를 통째로 읽으며 묻는다.

- 실환경에서 어떻게 실패하는가: 지연·부분 실패·동시 호출·종료 중·오프라인·권한 거부.
- **false success**가 가능한가: 실패해야 할 때 성공처럼 보이는 경로.
- 상태 변경·마이그레이션·외부 쓰기가 실패 중 어디까지 남는가.
- Product/UX가 요구한 A를 구현했는가, 아니면 합리적이지만 다른 B를 구현했는가.
- 로그/경고를 없애면서 원인 상태는 남기지 않았는가.
- 캐시/snapshot/호출 축소가 기존의 재검증·취소·만료 관측을 없애지 않았는가.
- 모델 컨텍스트 출력·배치·요청 fan-out의 worst-case가 무제한이 되지 않았는가.

여기서 발견한 문제는 AC에 없어도 파생 이슈로 올린다.

---

# 2. 역방향 탐색 — 코드에서 기준 밖 표면을 찾는다

기본 출발점:

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh <base>..<head>
```

스크립트 결과는 후보일 뿐이다. 추가로 직접 본다.

- 변경 export의 프로덕션 참조 0건.
- 테스트에만 등장하는 신규 함수/포트.
- 형제 파일의 정책 비대칭.
- 신규 레지스트리/스토어 값의 **기존 소비처 전수**와 부작용.
- producer가 맞게 보내는데 consumer가 다른 합성값으로 잘못 파생하는 경로.
- 같은 규칙을 두 레이어가 따로 구현한 drift.
- 외부 SDK/문서 예제/fixture가 실제 계약 타입과 의미를 만족하는지.

**테스트가 있다는 사실과 프로덕션에 배선됐다는 사실을 분리한다.** 유일한 호출자가 테스트면 기능은 미배선이다.

---

# 3. Product & UX Contract를 end-to-end로 검증한다

AC 매트릭스 전에 Part I의 핵심 흐름을 실제 코드 경로에 연결한다.

```text
사용자/시스템 시작점
  → main/feature 진입점
  → 계약/상태/저장
  → consumer/renderer/tool/external output
  → 성공/실패/취소 결과
```

각 `ACTIVE` Decision에 대해:

- 구현이 그대로 따르는가.
- Product/UX 본문과 Technical Design이 서로 다르게 말하지 않는가.
- 구현자가 최신 턴만 반영해 과거 ACTIVE 결정을 잃지 않았는가.
- `SUPERSEDED`는 실제 사용자 변경 근거가 있는가.

UI/표시 계약은 **producer와 consumer를 둘 다** 본다. main payload가 맞다는 이유로 화면 결과를 통과시키지 않는다.

---

# 4. 구현 보고와 structural proxy를 증거로 쓰지 않는다

- `Criteria-Met: N/N`은 증거가 아니다.
- 파일:라인은 “구현됨”의 증거이지 “검증됨”의 증거가 아니다.
- 함수 호출 지점 1개, `Promise.all` 존재, 특정 시그니처 존재 같은 형태가 **semantic 목표를 실제 보장하는지** 확인한다.
- AC가 `N회`를 말하면 계획된 관측 주체에서 횟수를 단언한다. 한 파일의 호출 지점 수와 공유 sink의 총 호출 수를 혼동하지 않는다.
- 순서 AC는 실제 훅/로그/주입 경계에서 순서를 관측한다. 코드 읽기만으로 “아마 순서가 맞다”를 주지 않는다.

## 기존 테스트 인용 검증

plan이 “기존 테스트가 보장”한다고 했다면:

- 실제 테스트 케이스/핵심 입력이 존재하는가.
- 그 분기가 실제 실행되는가.
- 파일명이 달라졌더라도 같은 **동작 단언**이 존재하는가.

없으면 미검증이다. 구현 중 새 테스트를 만들었으면 “기존 회귀”가 아니라 “신규 회귀”로 정정해서 보고한다.

---

# 5. 사람 실기 전에 테스트 가능한 핸들을 끝까지 찾는다

“UI라서”, “SDK라서”, “electron이라서”를 이유로 바로 사람에게 넘기지 않는다.

먼저 묻는다.

- 이 라이브러리에 in-memory/test transport가 있는가.
- 막힌 것이 시스템 전체인가, electron/native를 import하는 파일 하나인가.
- 같은 조립을 electron 비의존 부품으로 재구성할 수 있는가.
- 구조적 port에 fake/adversarial 구현을 주입하면 재현 가능한가.
- renderer의 시각이 아니라 순수 상태/후보/정렬/파생 로직인가.

가능한 부분까지 기계 검증하고 **남는 경계만 좁혀서** 사람 실기로 넘긴다.

사람 실기에는 반드시 무엇을 띄우고 무엇을 눌러 어떤 결과를 볼지 적는다. 자기 비범위 때문에 실행 불가능한 실기는 유효한 검증 수단이 아니다.

---

# 6. AC 1:1 매트릭스

각 AC에 대해 다음을 독립적으로 확인한다.

- Product/UX 목적을 실제로 만족하는가.
- 검증 수단이 동작을 직접 겨누는가.
- 프로덕션 도달 경로가 실제 존재하는가.
- 선택적 필드의 미지정 분기까지 검증됐는가.
- 외부 SDK 경계는 실제 요구 타입/의미를 만족하는가.
- fixture/example도 사용자를 안내한다면 계약을 만족하는가.
- 총량/0건 기준은 허용 대상까지 지워서 맞춘 것이 아닌가.
- 구조적 목표가 더 나쁜 과분해/배관을 강요해서 숫자만 맞춘 것은 아닌가.

## 외부가 구현하는 포트/계약

코어에 concrete consumer가 없어 문서가 사실상 진입 경로라면 두 층을 검증한다.

- **shape**: 문서 예제가 실제 타입에 대입/typecheck 가능한가.
- **semantics**: 문서의 성공/실패/null/retry 설명이 contract test와 같은가.

시그니처가 그대로여도 실패 의미가 달라졌으면 문서 drift다.

---

# 7. 숫자·음성 기준·상한을 재측정한다

- plan의 N개 소비처/파일/테스트 수를 다시 센다.
- 총량은 내역 합과 맞는지 본다.
- “0건”은 정당한 이력/예외를 지워서 만든 결과가 아닌지 본다.
- “N 이하”는 제거 대상과 허용 대상이 섞인 무의미한 총량이 아닌지 본다.
- 모델 컨텍스트 출력·요청 fan-out의 실제 worst-case 상한이 설계값을 지키는지 본다.

---

# 8. 환경 기인 실패를 분리한다

이 저장소의 알려진 better-sqlite3 ABI/egress 제약 등은 **변경 무관임을 명령과 실패 목록으로 분리**한 뒤에만 예외로 인정한다.

- lint/typecheck처럼 환경 중립 게이트는 반드시 실행.
- 테스트가 환경 문제로 실패하면 변경 관련 실패를 별도로 필터해 0건인지 증거를 남긴다.
- “환경 때문에 못 봄”을 넓게 쓰지 않는다. 어디까지 실제 검증했고 어디부터 남았는지 좁혀 적는다.

---

# 9. PASS / FAIL 판정

## PASS

- Product/UX 핵심 흐름과 ACTIVE Decision이 충족됨.
- 각 AC가 직접/대리/사람 실기 중 어떤 수준으로 검증됐는지 정직하게 표시됨.
- 기준 밖 중대 결함 없음.
- 미검증 경계가 사람 책임으로 명확하고, PASS 의미를 왜곡하지 않음.

## FAIL

미충족 항목을 `plan.md`의 `[검증자 기입] 파생 이슈`로 이관한다. 제품 결정이 필요하면 해결안으로 위장하지 말고 사용자 결정 대기로 표시한다.

반복 라운드에서 유사한 문제가 다시 나오면 **review signal**로 기록한다. 여기서 원인 분류나 skill 변경은 하지 않는다.

---

# review signal — 메타 리뷰에 넘길 사실만 기록

verify는 분석 결론 대신 다음 **사실**만 남길 수 있다.

- 이전 라운드와 동일/유사 증상인지.
- plan의 어느 지침/AC가 있었거나 없었는지.
- 사용자 결정이 중간에 바뀌었는지 여부와 근거.
- 검증 환경 한계가 무엇이었는지.

A~F 원인 분류와 SKILL 변경은 `handoff-review`가 한다.

## 마무리

- PASS: INDEX를 `verify/PASS`로 갱신하고 완료 행을 archive로 이동.
- FAIL: INDEX를 `verify/FAIL`, 다음 구현 주체, 라운드 +1로 갱신.
- 라운드가 3을 초과하면 사용자 에스컬레이션과 함께 `handoff-review`가 선행되어야 한다.
- 커밋 형식은 `docs/git-template.md`를 따른다.
