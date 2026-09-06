# Plan — 0216-spinner-artwork-swap

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0216-spinner-artwork-swap` |
| 작성자 | Claude Code |
| 일자 | 2026-09-06 |
| 매핑 | `claude/transcript-spinner-attachment-27cc38` |
| 상태 | READY |
| V mode | `Delta V` |
| 기준 V | `0208-spinner-instructions-usage-tooltip:ΔV1@4e1a412f` |
| 이번 V revision | `ΔV2` — 0208 ΔV1 의 "원본 = 241슬롯 스트립" 동일성 계약을 새 원본으로 대체 |
| 유효 V | `V1 + ΔV1 + ΔV2` |

> **이 plan 은 구현 뒤에 쓰였다.** 사용자가 턴 중간에 "plan 작업을 하지마라 / 이것외에 몇개의
> 요구사항을 만족후 plan 및 verify 작성하겠다" 로 순서를 지정했다(D-209). 아래 관측값은
> 그 구현 턴에서 실제로 잰 것이고, 규범 행(Decision·AC·V node/pair·§10)은 이 문서가 정본이다.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 진행 스피너 아트워크를 새 첨부본으로 교체한다. 현행은 마크가 viewBox 를 작게 써서 18×18 박스임에도 옆 12px 상태문구보다 작게 보인다.
- 완료 후 달라지는 것: 그림·색·주기가 새 원본과 같아지고, 박스가 14×14 로 서서 상태문구보다 크게 읽힌다.
- 성공을 사용자 관점 한 문장으로: 턴이 도는 동안 새 스피너가 상태문구보다 큰 크기로 돌고 스트리밍 출력 속도는 그대로다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "transcript의 spinner를 첨부로 변경해줘" | 라이브 세션 |
| 명시 요구 | "사이즈의 경우 spinner 라인에서 출력되는 상태메시지 폰트보다 컸으면 좋겠다. 사용자/어시스턴트 버블에 출려되는 폰트사이즈로." | 라이브 세션 |
| 명시 요구 | "단 실시간 출력 퍼포먼스에 영향을 주어서는 안된다" | 라이브 세션(턴 중 추가) |
| 명시 요구 | "애플리케이션의 성능감소로 이어지면 안된다" | 라이브 세션(턴 중 추가) |
| 명시 요구 | 색은 첨부 원본 `#C15F3C` · 범위는 세 소비자 전부 · 크기 14×14 | AskUserQuestion |
| 추론 의도 | "첨부로 변경" = 그림·주기·타이밍·감속 모션까지 원본과 관측 등가. 크기만 사용자가 별도 지정했다 | 설계자 판단 (D-203) |
| 추론 의도 | 성능 조건을 "인스턴스당 애니메이션 수 · 애니메이션 속성 · 리렌더 수 · 번들 asset · 런타임 실측" 으로 조작화한다 — 사용자가 수치를 지정하지 않았다 | 설계자 판단 (D-205) |

## 3. Decision Ledger

> 0208 의 ACTIVE 결정(D-001~D-021)을 상속한다. 이번 턴 결정은 `D-2xx` 로 번호를 분리한다.

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-201 | 아트워크를 새 첨부 원본(마크 5종 / 4800ms)으로 교체한다 | 사용자 "transcript의 spinner를 첨부로 변경해줘" | 사용자 턴 | ACTIVE | 0208 D-016 의 동일성 대상 대체 |
| D-202 | 교체 범위는 `StatusLine` 렌더 지점 **3곳 전부** — variant 를 만들지 않는다 | 사용자 "세 곳 모두". 0208 D-002 를 유지한다 | AskUserQuestion | ACTIVE | — (D-002 재확인) |
| D-203 | 바깥 `<svg>` 는 **14×14px** — 원본의 `width/height="100"` 을 쓰지 않는다 | 사용자 "…버블에 출력되는 폰트사이즈로". 버블 `text-[14px]` · 상태문구 `text-[12px]` | 사용자 턴 + 실측 | ACTIVE | 0208 D-016 의 `18×18` 축만 대체 |
| D-204 | 고정색은 **`#C15F3C`** — 토큰 1곳 정의, 테마 스코프 재정의 0, 컴포넌트는 `currentColor` 만 | 사용자 "#C15F3C 로 교체". 새 원본의 `fill`/`stroke` 값 | AskUserQuestion + 원본 | ACTIVE | 0208 D-016 의 `#d97757` 축만 대체 |
| D-205 | **성능은 저하되면 안 된다** — 실시간 출력 경로와 앱 전반 모두. 정적 계약 + 런타임 실측으로 잠근다 | 사용자 "실시간 출력 퍼포먼스에 영향을 주어서는 안된다" · "애플리케이션의 성능감소로 이어지면 안된다" | 사용자 턴 | ACTIVE | 0208 D-003 승계·강화 |
| D-206 | 원본 SVG 는 **문서·테스트 oracle 전용** — 프로덕션 그래프 0건 | 0208 D-017 승계. 새 원본은 14,401 bytes 이고 c2pa manifest 를 포함한다 | 0208 D-017 | ACTIVE | — (승계) |
| D-207 | 애니메이션은 **전역 CSS 트랙**이 소유한다 — 원본의 인라인 `<style>` 을 컴포넌트로 옮기지 않는다 | 인라인이면 인스턴스마다 규칙 사본이 생긴다 | 0208 D-003 + 저장소 규칙 | ACTIVE | — |
| D-208 | 241슬롯 프레임 인코딩(`sparkFrames.ts`·`spark-scale`·마크 7종 트랙)은 **삭제**한다 — 이동이 아니다 | 새 원본에 프레임 스트립이 없다. 남기면 두 사본이 서로 다른 스피너를 서술한다 | 설계자 판단 | ACTIVE | 0208 AR-05·MD-01 대체 |
| D-209 | 이번 작업은 **구현 → plan 순서**로 진행한다 | 사용자 "plan 작업을 하지마라" · "이것외에 몇개의 요구사항을 만족후 plan 및 verify 작성하겠다" | 사용자 턴 | ACTIVE | 이 handoff 한정. 기본값(설계 우선)을 바꾸지 않는다 |

### 갱신 메모

- 새로 추가된 결정: D-201~D-209.
- 변경된 결정: 0208 D-016 이 축별로 갈라진다 — 그림·주기는 D-201, 크기는 D-203, 색은 D-204. D-002→D-202 · D-003→D-205 · D-017→D-206 은 승계다.
- 유지되는 기존 ACTIVE: 0208 D-006(감속 모션 동작) · D-008~D-011(지침 카드) · D-018~D-020(사용량 안내) · D-021(원본 줄바꿈 LF). 지침 카드·사용량 안내는 이번 변경 경로에 없다.
- **`ACTIVE 결정 ↔ AC` 대조: 충돌 0.** D-201↔AT-201·AT-202 · D-202↔AT-206 · D-203↔AT-203 · D-204↔AT-204 · D-205↔AT-207~AT-209·AT-211 · D-206↔AT-209 · D-207↔AT-208 · D-208↔AT-205 · D-209↔해당 AC 없음(절차 결정).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 단 원인은 박스가 아니다 | 현행 spoke 는 `scale(0.74)` × 반경 26.5/100 → 18px 박스에서 실지름 ≈7px. 새 원본은 마크가 13.44~86.56(sD)까지 차서 14px 박스에서 ≈10px. 박스를 줄여도 커 보인다 |
| 이미 기존 코드가 충족하는가 | 아니오 | `SparkSpinner.tsx` 는 마크 7종·241슬롯 구조라 새 아트워크를 표현할 수 없다 |
| 더 작은 해법이 있는가 | 아니오 | 마크 집합·주기·타이밍 함수가 전부 다르다. 크기만 바꾸면 D-201 을 충족하지 못한다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 | 0208 plan 의 "3곳"·"노드 19"·"트랙 8" 을 이번 세션에 재측정했다(§8) |
| ACTIVE 결정과 충돌하는가 | 부분 충돌 → 축별 대체로 해소 | 0208 D-016 이 `18×18`·`#d97757`·`7200ms/241슬롯` 을 원본 동일성으로 못박았다. 원본 교체로 D-201·D-203·D-204 가 축별 supersede |

- 사용자에게 올릴 결정: 없음 (색·범위·크기를 AskUserQuestion 으로 닫았다).
- 코드 조사로 닫은 사실: 상태문구 12px · 버블 14px · `StatusLine` 렌더 지점 3 · 현행 노드 19 · 트랙 8 · 전역 stop 288.

## 5. 동작 / 사용자 흐름

```text
[턴 시작 — turnStartedAt 설정]
  → [StatusLine 마운트 → SparkSpinner 1개 · 상태문구 · 경과초]
  → [브라우저가 전역 CSS 트랙으로 마크 5종을 4800ms 주기로 순환]
  ↘ [prefers-reduced-motion: reduce → 애니메이션 정지, 마크 b 만 표시]
[턴 종료 — turnStartedAt = null]
  → [StatusLine 이 null 반환 → 스피너 언마운트]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 턴 시작 | `StatusLine` 마운트, SVG 1개 삽입 | 14×14 스피너가 12px 상태문구 왼쪽에서 돈다 |
| 스트리밍 델타 도착 | `LiveText` 만 재렌더 — 스피너는 CSS 소유 | 텍스트가 흐르는 동안 스피너 속도 변화 없음 |
| 경과 1s 틱 | `StatusLine` 재렌더 — 스피너 DOM 동일 | 애니메이션 위상이 끊기지 않음 |
| 감속 모션 설정 | 트랙 5개 `animation: none`, `animate-spark-b` 만 `opacity: 1` | 정지한 마크 하나 |
| 턴 종료 | `StatusLine` null | 스피너 사라짐 |

### 파생 UX / 엣지케이스

- loading / empty / error: 스피너는 진행 상태 전용이다. 재시도·오류 문구는 `RetryStatus`·`ErrorCard` 소유라 범위 밖이다.
- concurrency: 동시 3곳까지 산다(transcript · 작업 타일 · 서브에이전트 타일). 비용 예산은 그 최악(×3)으로 센다.
- a11y: `aria-hidden="true"` 유지 — 접근성 문구는 바깥 `<span aria-label>` 이 갖는다.
- theme: 고정색이라 두 테마에서 같다. 토큰을 테마 스코프에 재정의하지 않는다.

## 6. 범위 / 비범위

- **범위**: `SparkSpinner` 아트워크·크기·색, `app.css` 의 `spark-*` 트랙, `tokens.css` 의 `--color-spinner`, 프레임 인코딩 모듈·테스트 삭제, 새 원본 oracle 배선, `.gitattributes` 줄바꿈 고정.
- **비범위**: 상태문구 문안·경과초·활동 라벨, 지침 카드·사용량 안내(0208 다른 축), `ConversationStatusLine`/`StatusPopover`(이름만 겹치는 별개 컴포넌트).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 상태문구 폰트 크기 조정 | 아니오 | 사용자가 스피너 크기만 지정했다 — 문구는 12px 유지 |
| 빌드 산출 도달을 **커밋된 테스트**로 잠그기 | 아니오 | AT-212 는 재현 명령으로만 닫는다. §17 리스크 참조 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-201 | AT-201 | 원본이 저장소에 바이트 그대로 산다 | `sha256 = f94d5f7b40db6183de9eef999dface8153090cace9e3f802cba029d1cb753d7b` · 14,401 bytes · CR 0 · `.gitattributes` 에 `eol=lf` 행 | upload → `.gitattributes` → reference → 파서 |
| R-201 | AT-202 | 렌더 출력의 마크 기하가 원본과 같다 | 원본을 파싱한 마크 5종의 자식 태그·속성 전수(`line 16`·`circle 3`·`path 13`)와 렌더 출력이 등호. 주기 4800ms · `cubic-bezier(.35,0,.25,1)` · 감속 마크 `b` | `StatusLine` → `SparkSpinner` → DOM |
| R-202 | AT-203 | 스피너 박스가 14×14 다 | 렌더 출력 `width="14" height="14"` · `viewBox` 는 원본값. 상태문구는 `text-[12px]`, 버블은 `text-[14px]` — **세 값 동시 단언** | 동일 |
| R-203 | AT-204 | 고정색이 `#C15F3C` 로 한 곳에 정의된다 | `--color-spinner` 정의 1건 + 값이 원본 색과 등호 + `[data-theme='dark']` 재정의 0 + 컴포넌트 raw hex 0 · `currentColor` 보유 · 소비자 `text-spinner` | `tokens.css` → `text-spinner` → `currentColor` |
| R-204 | AT-205 | 241슬롯 인코딩이 저장소에서 사라진다 | 렌더러 소스 전수에서 구 심볼 6종 검색 0건 + 양성 짝(새 트랙 리터럴 존재 · `@keyframes spark-scale` 부재) | 해당 없음(삭제) |
| R-205 | AT-206 | 세 소비자가 분기 없이 같은 스피너를 받는다 | `rg '<StatusLine' --include=*.tsx` = 3 · 렌더 출력 `<svg>` 1 · variant prop 0 | 3 렌더 지점 → 1 컴포넌트 |
| R-206 | AT-207 | 인스턴스 비용이 현행보다 늘지 않는다 | 인스턴스당 애니메이션 = 5(현행 8 이하) · SVG 노드 = 38 · 전역 keyframe stop = 41(현행 288 이하) | 렌더 출력 + `app.css` 원문 |
| R-206 | AT-208 | 애니메이션이 레이아웃을 건드리지 않고 전역 1회만 파싱된다 | `spark-*` keyframe 의 애니메이션 속성 차집합이 `{transform, opacity}` 밖에서 0 · 트랙마다 `@keyframes` 전역 **정확히 1개** · 컴포넌트 인라인 `<style>`·`style=` 0 | `app.css` 전역 → 유틸리티 |
| R-206 | AT-209 | 실시간 출력 경로가 스피너 때문에 재렌더되지 않는다 | `StatusLine.tsx` 코드 줄에 `setInterval`·`useState`·`style={` 0 + `useElapsed`·`<SparkSpinner` 보유. 원본 asset·`.testlib` 이 프로덕션 소스 그래프에 0건(차집합) | 델타 → `LiveText` 만 재렌더 |
| R-206 | AT-211 | 런타임 비용이 교체 전보다 **줄어든다** | 동시 3개 · 5s 창 · 3회 평균으로 style recalc·layout·main-thread task 를 교체 전/후/없음 3조건 비교. 신 ≤ 구, fps 60 유지 | 실행 중 Chromium |
| R-207 | AT-210 | 실행 앱에서 새 스피너가 상태문구보다 크게 보이고 스트리밍이 끊기지 않는다 | 사람 실기 | 앱 실행 |
| R-208 | AT-212 | 트랙이 Tailwind 빌드 산출까지 도달한다 | 렌더러 CSS 빌드 산출에 `.animate-spark-a`~`e` 5개 + `@keyframes spark-a`~`e` 5개 + stop 41 + 구 트랙 0건 | `app.css` → Tailwind → 번들 CSS |

### AC 검증 주의사항

- 기존 테스트 재사용: `statusLine.render.test.ts`·`sparkCss.test.ts` 는 원본 축이 통째로 바뀌므로 **기대값이 아니라 파서와 기대 산출을 새 원본 기준으로 다시 쓴다**. 손 전사 기대값을 두지 않는다.
- 사람 실기 항목: AT-210 만. "커 보이는가" 는 폰트 렌더링·DPI 의존이라 순수 테스트로 내리지 않는다. 크기 **수치**는 AT-203 이 잠근다.
- AT-205 의 음성 스윕은 `.test.ts`·`.testlib.ts` 를 제외하지 **않는다**(삭제가 목적이라 테스트에 남아도 회귀). 술어 문자열은 조각으로 조립해 스윕 파일 자신이 걸리지 않게 한다 — 자기 제외 예외를 만들면 그 파일의 실제 회귀도 함께 가린다.
- AT-211·AT-212 는 **커밋된 테스트가 아니라 재현 명령**이다. 방법·수치는 §14 가 갖는다. 창이 가려지면 rAF 가 멈춰 모든 수치가 0 이 되므로 **rAF 프레임 수를 먼저 관측해 유효성을 증명한 뒤** 재는 것이 절차의 일부다.
- 애니메이션 수 기준: 현행 8 = `animate-spark-scale` 1 + visibility 7. 새 값 5 = 마크 그룹 5 × 1. 렌더 출력의 `animate-spark-[a-e]` 등장 수로 관측한다.

## 7-A. V / Trace Matrix

- V mode 판정: **Delta V** — 0208 이 이 표면의 V1+ΔV1 을 갖는다.
- 기준 V 상속 근거: `0208-spinner-instructions-usage-tooltip:ΔV1@4e1a412f`.
- 변경이 시작되는 수준: **R**(제품이 받는 그림·크기·색이 바뀐다) → 아래 전 레벨.

### ΔV2 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-201 | R | §7 새 원본과 관측 등가 | NEW | 0208 R-08 의 원본 축 대체 |
| R-202 | R | §7 14×14 | NEW | 0208 R-08 의 18×18 축 대체 |
| R-203 | R | §7 `#C15F3C` | NEW | 0208 R-08 의 고정색 축 대체 |
| R-204 | R | §7 241슬롯 삭제 | NEW | 0208 AR-05 소비 계약 종료 |
| R-205 | R | §7 3곳 동일 | INHERITED | 0208 R-01 (D-002) |
| R-206 | R | §7·§14 성능 비회귀 | CHANGED | 0208 R-02 — 예산 축이 트랙 8→5 · 노드 19→38 로 이동하고 런타임 실측이 더해진다 |
| R-207 | R | §7 실기 | INHERITED | 0208 R-01 실기 축 |
| R-208 | R | §7 빌드 산출 도달 | NEW | 0208 IT-05 의 빌드 축 승계(테스트 아닌 재현 명령) |
| 0208 R-08 | R | — | SUPERSEDED | R-201·R-202·R-203 |
| AT-201~AT-212 | AT | §7 | NEW | 0208 AT-21~AT-24 대체, AT-30 실기 승계 |
| 0208 AT-21~AT-24 | AT | — | SUPERSEDED | AT-201·AT-202·AT-207·AT-208 |
| SD-201 | SD | §5·§13 | INHERITED | 0208 SD-01 — 프레임 진행이 React 상태를 거치지 않음 |
| AR-201 | AR | §9·§10 | CHANGED | 0208 AR-05 — reference→파서→CSS/토큰 배선이 새 원본 형상으로 |
| MD-201 | MD | §10·§11 | CHANGED | 0208 MD-01 — 241슬롯 모델 → 마크 5종 트랙 모델 |
| MD-202 | MD | §11 | CHANGED | 0208 MD-03 — 파서가 새 원본 문법(`@keyframes kA~kE`·`.sA~.sE`)을 읽는다 |
| ST-201·IT-201·UT-201 | ST/IT/UT | §7·§10 | NEW | 아래 pair 의 성능·배선·민감도 증거 |

### ΔV2 Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| ΔVP-201 | R-201 ↔ AT-201 | REQUIRED | upload → `.gitattributes` → `spinner-reference.svg` → 파서 | SHA-256 · byte 수 · CR 0 · `.gitattributes` 행 | required — 바이트/0건 주장이라 방향 입증 필요. 변이: XML 1byte 변경 | EP-201 (4) |
| ΔVP-202 | R-201·AR-201 ↔ AT-202·IT-201 | REQUIRED | reference → 파서 → `sparkTracks.ts`/`app.css` → `SparkSpinner` → 3 StatusLine | 마크 5종 자식 태그·속성 전수 등호 + 주기·타이밍·감속 마크 | required — 파서 oracle 민감도. 변이: 원본 `r` 1곳·`app.css` stop 배율 1곳 | EP-202 (5) |
| ΔVP-203 | R-202 ↔ AT-203 | REQUIRED | `SparkSpinner` → DOM → StatusLine 줄 | `width/height="14"` + 12px/14px 동시 단언 | required — 자리를 말하는 불변식이라 **형제 값 교환**에도 실패해야 한다. 변이: 12↔14 맞바꿈 | EP-203 (3) |
| ΔVP-204 | R-203 ↔ AT-204 | REQUIRED | `tokens.css` → `text-spinner` → `currentColor` | 토큰 정의 1건 등호 + 테마 스코프 0 + raw hex 0 | required — 0건 주장. 변이: 고정색 되돌림 | EP-204 (4) |
| ΔVP-205 | R-204 ↔ AT-205 | REQUIRED | 해당 없음(삭제) | 전 소스 음성 스윕 + 새 트랙 리터럴 양성 짝 | required — 음성 게이트. 변이: `spark-scale` 문자열 1곳 복원 | EP-205 (2) |
| ΔVP-206 | R-205 ↔ AT-206 | REGRESSION | 3 렌더 지점 → 1 컴포넌트 | `<StatusLine` 전수 3 + 출력 `<svg>` 1 | not selected — 렌더 출력과 전수 grep 이 곧 계약이다 | EP-206 (2) |
| ΔVP-207 | R-206·SD-201 ↔ AT-207·AT-208·ST-201 | REQUIRED | turn start → 1 mount → 전역 CSS → unmount | 애니메이션 5 · 노드 38 · stop 41 · property 차집합 0 · keyframe 전역 1개 | required — allowlist/차집합 oracle. 변이: keyframe 에 `width` stop 추가 · 감속 블록에서 트랙 1개 누락 | EP-207 (5) |
| ΔVP-208 | R-206 ↔ AT-209·UT-201 | REGRESSION | 델타 → `LiveText` 만 재렌더 | timer/state 0 + leak 차집합 0 + 양성 짝 | required — 0건/전수. 변이: 트랙 클래스 리터럴 조립(Tailwind 방출 파괴) | EP-207·EP-208 (3) |
| ΔVP-209 | R-206 ↔ AT-211 | REQUIRED | 실행 Chromium → 합성 → main thread | 교체 전/후/없음 3조건의 recalc·layout·task 차분 | required — 측정 유효성 자체가 조건. 변이 아닌 **전제 검사**: rAF 프레임 수 > 0 | EP-209 (2) |
| ΔVP-210 | R-208 ↔ AT-212 | REQUIRED | `app.css` → Tailwind → 번들 CSS | 빌드 산출의 유틸리티·keyframe·stop 수와 구 트랙 0건 | not selected — 산출물 직접 관측이 곧 계약이다 | EP-210 (1) |
| ΔVP-211 | R-207 ↔ AT-210 | REGRESSION | 실행 앱 transcript | 사람 실기 | not selected — 시각·DPI 의존 | 0 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree (`app/**`) | renderer 소스·CSS·테스트를 바꾼다 | `npm run lint && npm run typecheck` → `./node_modules/.bin/vitest run src/renderer` | 이번 변경이 낸 실패만 blocking. `@opencode-ai/sdk` 미설치 기인 typecheck 2건은 분리 보고 |
| repository (docs) | plan·INDEX·reference SVG·`.gitattributes` 를 추가한다 | `cd app && node scripts/check-doc-inventory.mjs --check` | 이번 diff 가 낸 오류 |
| message bus | 설계 커밋과 구현 커밋을 분리한다 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 스피너는 마크 7종 + 전역 CSS 트랙 8개, 인스턴스당 19 노드 | 교체 전 `shared/ui/SparkSpinner.tsx:28` |
| 프레임 표(241항)는 `sparkFrames.ts` 가 갖고 컴포넌트는 클래스만 소비한다 | 교체 전 `shared/ui/sparkFrames.ts:30` |
| 상태문구 컨테이너 = `text-[12px]` | `features/chat/components/StatusLine.tsx:118` |
| 어시스턴트 버블 본문 = `text-[14px]` | `features/chat/components/transcript/AssistantMessage.tsx:39` |
| 진행 중 버블도 같은 14px 셸을 쓴다 | `features/chat/components/transcript/PendingAssistant.tsx:21` |
| 고정색 토큰 정의는 1곳 | `styles/tokens.css:51` |
| renderer 는 raw hex 금지 · 새 CSS 파일 금지 · Tailwind 유틸 우선 | `app/src/renderer/AGENTS.md §스타일` |
| `@utility` 는 클래스 **리터럴**이 소스에 있을 때만 방출된다 | `sparkCss.test.ts` 마지막 describe |
| 원본 SVG 는 `text=auto eol=lf` 위에 전용 행으로 한 번 더 고정된다 | `.gitattributes:9`(0208분) |
| 새 원본은 `@keyframes kA~kE` · `.s`/`.sA~.sE` · `animation-duration: 4.80s` · `cubic-bezier(.35,0,.25,1)` · 감속 모션 `.sB { opacity: 1 }` | `docs/handoff/0216-spinner-artwork-swap/spinner-reference.svg:3-62` |
| vitest 환경이 `node` 라 DOM 이 없다 — 렌더 검증은 `renderToStaticMarkup` 뿐 | `app/vitest.config.ts` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `StatusLine` 렌더 지점 | `rg '<StatusLine' --include=*.tsx` | 3 | D-202 의 분모(`PendingAssistant`·`SubAgentTileContent`·작업 타일 경유) |
| `SparkSpinner` 소비자 | `rg 'SparkSpinner' --include=*.tsx` | 1 | `StatusLine.tsx` 하나 |
| 교체 전 인스턴스 SVG 노드 | 렌더 출력 `svg 1·g 2·line 10·circle 1·text 5` | 19 | AT-207 의 비교 기준 |
| 교체 전 전역 `spark-*` stop | keyframe 별 stop 합 `241+11+21+3×5` | 288 | AT-207 의 비교 기준 |
| 새 원본 마크 노드 | `grep -o '<line[ />]'` 등 | line 16 · circle 3 · path 13 · g 5 | 인스턴스 38 노드의 내역 |
| 새 원본 keyframe stop | kA~kE 합 `6+17+6+6+6` | 41 | 전역 CSS 가 288 → 41 로 준다 |
| 새 원본 CR | `tr -d '\r'` 후 바이트 불변 | 0 | LF 확정 |
| 구 심볼 저장소 전수 | `spark-scale`·`spark-spoke`·`spark-dot`·`spark-g1~g5`·`spark-frames`·`spark-strip`·`ten-spoked`·`SPARK_FRAME_SCALES`·`SPARK_TOTAL_FRAMES`·`SPARK_FRAME_MS`·`SPARK_SHAPE_WINDOWS`·`SPARK_SHAPES`·`SparkShape`·`sparkFrames`·`SPARK_SCALE_CLASS` (0208 문서 제외) | 0 | R-204 충족 실측 |

### 수치 / 전칭 표현 검산

- 내역 합 = 총계: 노드 `1+5+16+3+13 = 38` · stop `6+17+6+6+6 = 41`.
- "세 소비자" 전칭: `<StatusLine` 3건 전수. `ConversationStatusLine`·`StatusPopover` 는 이름만 겹치는 별개이고 `rg 'SparkSpinner'` 1건이 반례 부재를 보인다.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 실재 · 교체 전 `sparkCss.test.ts` describe 6개 · `statusLine.render.test.ts` describe 3개 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 교체 전 구조

- 관련 V node: `AR-201`(=0208 AR-05) · `MD-201` · `SD-201`.
- 책임 소유자: `sparkFrames.ts` 가 241슬롯 모델, `app.css` 가 그 사본인 트랙 8개, `SparkSpinner.tsx` 가 마크 7종 DOM.
- 경로: 원본(241프레임 스트립) → `sparkReference.testlib`(테스트 전용 파서) → 기대값 → `sparkFrames.ts`/`app.css` 대조.
- 제약: 새 원본에는 프레임 스트립·`#ten-spoked`·글리프가 없다. 파서·모델·트랙이 전부 존재하지 않는 문법을 읽는다.

```text
[spinner-reference.svg (241 프레임 스트립)]
  → [sparkReference.testlib 파서]
  → [sparkFrames.ts 241항 + app.css spark-scale/spoke/dot/g1~g5]
  → [SparkSpinner 마크 7종 · 19 노드 · 애니메이션 8]
  → [StatusLine ×3]
```

### TO-BE — 교체 후 구조

- 관련 V node: `AR-201` · `MD-201` · `MD-202` · `SD-201`.
- 책임 소유자: `sparkTracks.ts` 가 마크 5종 ↔ 트랙 클래스와 주기, `app.css` 가 `kA~kE` 에서 옮긴 keyframe 5개, `SparkSpinner.tsx` 가 마크 5종 DOM.
- 경로: 새 원본 → 파서(마크 기하·keyframe stop·주기·색·감속 마크) → 기대값 → `sparkTracks.ts`/`app.css`/`tokens.css` 대조.
- 유지: 전역 CSS 소유 · `currentColor` 상속 · 원본 프로덕션 0건 · 3 소비자 무분기.
- 제거: `sparkFrames.ts`(241항) · `spark-scale`·`spark-spoke`·`spark-dot`·`spark-g1~g5` 트랙 · `sparkFrames.test.ts`. **이동이 아니라 삭제다**(D-208).

```text
[spinner-reference.svg (마크 5종 · kA~kE · 4800ms)]
  → [sparkReference.testlib 파서 (신규 문법)]
  → [sparkTracks.ts 5항 + app.css spark-a~spark-e + tokens.css #C15F3C]
  → [SparkSpinner 마크 5종 · 38 노드 · 애니메이션 5 · 14×14]
  → [StatusLine ×3]
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 아트워크 | 마크 7종(spoke·dot·글리프 5) | 마크 5종(`line 16`·`circle 3`·`path 13`) | D-201 | `R-201` / ΔVP-202 · `SparkSpinner.tsx` |
| 시간축 | 7200ms · 241 step-end 슬롯 | 4800ms · cubic-bezier 보간 · stop 41 | D-201(원본 값) | `MD-201` / ΔVP-202·ΔVP-207 · `app.css` |
| 박스 | 18×18 | 14×14 (`viewBox` 동일) | D-203 | `R-202` / ΔVP-203 · `SparkSpinner.tsx` |
| 색 | `--color-spinner: #d97757` | `--color-spinner: #C15F3C` | D-204 | `R-203` / ΔVP-204 · `tokens.css` |
| 모델 소유 | `sparkFrames.ts` 241항 | `sparkTracks.ts` 5항 (삭제 후 신설) | D-208 | `MD-201` / ΔVP-205 · 파일 삭제 |
| 애니메이션 속성 | transform · visibility | transform · opacity | 원본이 opacity 로 페이드한다 | `R-206` / ΔVP-207 · allowlist |
| test seam | 241슬롯 파서 | 마크 기하 + keyframe stop 파서 | `MD-202` | ΔVP-202 · `sparkReference.testlib.ts` |
| 프레임 진행 소유 | 브라우저 CSS | 브라우저 CSS (**불변**) | D-205 | `SD-201` / ΔVP-208 · `StatusLine.tsx` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/ui/sparkTracks.ts` | 마크 ↔ 트랙 클래스 리터럴 · 주기 · 감속 마크 | 없음 → 상수 | `SparkSpinner.tsx` · `sparkCss.test.ts` |
| `shared/ui/SparkSpinner.tsx` | 마크 5종 SVG DOM | `className` → `React.JSX.Element` | `features/chat/components/StatusLine.tsx` |
| `styles/app.css` | keyframe 5 + `@utility` 5 + 감속 모션 | — | Tailwind 빌드 |
| `styles/tokens.css` | 고정색 1건 | — | `text-spinner` |
| `shared/ui/sparkReference.testlib.ts` | 원본 파싱(테스트 전용) | SVG 문자열 → 기하·stop·주기·색·감속 마크 | `sparkCss.test.ts` · `statusLine.render.test.ts` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| R-201 / ΔVP-201 (**EP-201**) | 원본 바이트 | `spinner-reference.svg` | `sparkCss.test.ts` + `.gitattributes` | 테스트 실행 · 체크아웃 | 4 지점: SHA · byte 수 · CR 0 · `.gitattributes` 행. 하나라도 빠지면 oracle 이 다른 파일을 읽는다 |
| AR-201 / ΔVP-202 (**EP-202**) | 마크 기하·주기·타이밍·감속 마크 | 원본 → 파서 | `sparkCss.test.ts` · `statusLine.render.test.ts` | 테스트 실행 | 5 지점: `line`(16) · `circle`(3) · `path`(13) · keyframe stop(41) · 주기/타이밍. 한 지점만 닫으면 나머지 축이 조용히 갈라진다 |
| R-202 / ΔVP-203 (**EP-203**) | 14 ↔ 12 ↔ 14 | 렌더 출력 + 소스 | `statusLine.render.test.ts` | 테스트 실행 | 3 지점: 스피너 `width`·`height` · 상태문구 `text-[12px]` · 버블 `text-[14px]`. 형제 값 교환이 통과하지 않게 함께 단언한다 |
| R-203 / ΔVP-204 (**EP-204**) | 고정색 | `tokens.css` 1행 | `sparkCss.test.ts` | 테스트 실행 | 4 지점: 정의 1건 · 값 등호 · dark 스코프 0 · 컴포넌트 raw hex 0 |
| R-204 / ΔVP-205 (**EP-205**) | 241슬롯 부재 | 렌더러 소스 전수 | `sparkCss.test.ts` | 테스트 실행 | 2 지점: 음성 스윕(구 심볼 6종) + 양성 짝. 음성만 두면 파일을 통째로 비워도 통과한다 |
| R-205 / ΔVP-206 (**EP-206**) | 3 소비자 무분기 | 렌더 지점 | `statusLine.render.test.ts` | 테스트 실행 | 2 지점: `<StatusLine` 전수 3 · 출력 `<svg>` 1 |
| R-206 / ΔVP-207 (**EP-207**) | 인스턴스 비용 | 렌더 출력 + `app.css` | `statusLine.render.test.ts` · `sparkCss.test.ts` | 테스트 실행 | 5 지점: 애니메이션 5 · 노드 38 · stop 41 · property 차집합 0 · keyframe 전역 1개 |
| R-206 / ΔVP-208 (**EP-208**) | 실시간 경로 비회귀 | `StatusLine.tsx` + 소스 그래프 | `statusLine.render.test.ts` · `sparkCss.test.ts` | 테스트 실행 | 3 지점: timer/state 0 · 인라인 style 0 · 원본/`.testlib` leak 0 |
| R-206 / ΔVP-209 (**EP-209**) | 런타임 비용 | 실행 Chromium | 사람/에이전트 재현 | 측정 시 | 2 지점: rAF 프레임 > 0(측정 유효성) · 신 ≤ 구. 유효성 검사를 빼면 가려진 창의 0 을 "비용 없음" 으로 읽는다 |
| R-208 / ΔVP-210 (**EP-210**) | 빌드 도달 | 번들 CSS | 사람/에이전트 재현 | 측정 시 | 1 지점: 유틸리티 5 + keyframe 5 + stop 41 + 구 트랙 0 |

- SSOT 공유 방법: 트랙 클래스 이름은 `sparkTracks.ts` 의 **따옴표 리터럴**이 SSOT 다. `app.css` 는 사본이고 `sparkCss.test.ts` 가 이름 일치와 리터럴성을 함께 잠근다 — 조립하면 Tailwind 가 유틸리티를 방출하지 않아 스피너만 조용히 멈춘다.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: **없음**.
- 선택적 필드의 `true/false/undefined` 의미: 해당 없음.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/ui/SparkSpinner.tsx` | 마크 5종 SVG | 14×14 · `fill`/`stroke` = `currentColor` · 그룹 5개에 트랙 클래스 · 좌표는 원본 **문자열 그대로** | 렌더 출력(순수) |
| `shared/ui/sparkTracks.ts` (신규) | 트랙 상수 | `SPARK_MARKS` · `SPARK_TRACK_CLASS` · `SPARK_PERIOD_MS = 4800` · `SPARK_REDUCED_MOTION_MARK` | 순수 |
| `shared/ui/sparkFrames.ts` · `sparkFrames.test.ts` | — | **삭제** (D-208) | — |
| `shared/ui/sparkReference.testlib.ts` | 새 원본 파서 | `.sA~.sE` 자식 태그 전수 · `@keyframes kA~kE` stop 문자열(계산 금지) · duration/timing · 루트 `fill` · 감속 마크 | 테스트 전용 |
| `shared/ui/sparkCss.test.ts` | CSS/토큰/성능 대조 | 새 원본 기준 재작성. EP-201·202·204·205·207·208 | 순수 |
| `features/chat/components/statusLine.render.test.ts` | 렌더 출력 대조 | 새 기하 · 14×14 · 12/14 동시 단언 · 노드 38 · 애니메이션 5. EP-202·203·206·207·208 | 순수 |
| `styles/app.css` | 트랙 | 구 트랙 8 삭제 → `spark-a~spark-e` 5 + `@utility` 5 + 감속 모션 블록 | CSS 원문 |
| `styles/tokens.css` | 고정색 | `--color-spinner: #C15F3C` | CSS 원문 |
| `.gitattributes` | 줄바꿈 고정 | 새 원본 경로에 `text eol=lf` 행 추가 | `git check-attr` |
| `docs/handoff/0216-.../{plan.md,spinner-reference.svg}` · `INDEX.md` | 설계·원본·보드 | 신규 | — |

### CSS 이식 규칙 (원본 → `app.css`)

- 원본 `.s` 의 공통 선언(`transform-origin: 50px 50px` · `transform-box: view-box` · `opacity: 0` · `4.80s` · `infinite` · `cubic-bezier(.35,0,.25,1)`)을 `@utility animate-spark-<m>` 각각에 전개한다. Tailwind `@utility` 는 클래스 하나를 방출하므로 공용 `.s` 를 따로 만들지 않는다(renderer AGENTS: 새 CSS 규칙 대신 유틸리티).
- 원본 `@keyframes kA~kE` 는 이름만 `spark-a~spark-e` 로 바꾸고 **stop 문자열·값은 그대로** 옮긴다. 손 전사를 피하려면 원본에서 생성한다.
- 원본 감속 모션 블록은 트랙 5개를 열거한 블록으로 옮기고 `animate-spark-b` 만 `opacity: 1` 을 받는다.
- `4.80s` 는 `4800ms` 로 적는다. 파서는 원본의 `4.80s` 를 ms 로 환산해 **값으로** 비교하고, 타이밍 함수는 공백·선행 0 을 정규화해 비교한다.

### 테스트 가능성

- electron/DB/native 분리: 해당 없음 — renderer 순수 컴포넌트라 `vitest run src/renderer` 가 ABI 를 건드리지 않는다.
- 기존 메커니즘 재사용: `codeOf`·`walkSourceFiles`(`sourceScan.testlib.ts`)를 그대로 쓴다 — 주석 제외·POSIX 경로 고정 성질이 새 술어에도 필요하다.
- JSX 미사용 유지: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다 — `createElement` 로 렌더한다(0204 선례).
- 파서는 구조가 예상과 다르면 **던진다**. 조용히 빈 값을 돌려주면 변조 fixture 가 통과한다. c2pa manifest 는 base64 덩어리라 먼저 잘라낸다.

## 12. End-to-end 영향

```text
tokens.css(#C15F3C) → text-spinner → StatusLine → SparkSpinner(currentColor) → 3 소비자 DOM
app.css(spark-a~e) → @utility 리터럴 → SparkSpinner 그룹 5개 → 브라우저 애니메이션
```

- producer 기준: 원본 SVG 가 그림·시간·색의 정본이다.
- consumer 파생 규칙: 컴포넌트는 색을 모르고 트랙 이름만 소비한다. 크기(14)만 원본을 따르지 않는 **명시 결정**이다(D-203).
- 정본 우회 가능성 1건: 컴포넌트가 인라인 `style` 로 scale/opacity 를 그리면 프레임 진행이 JS 로 올라와 D-205 를 깬다. AT-208·AT-209 가 `style=` 0건을 잠근다.

### 기존 소비처

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `PendingAssistant` (transcript) | 스피너 DOM 만 교체 — props·store 불변 | AT-206·AT-209 |
| `SubAgentTileContent` | 동일 | AT-206 |
| 작업 타일 (`ChatTile` 경유) | 동일 | AT-206 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `turnStartedAt != null` 이면 `StatusLine` 이 스피너를 마운트한다.
- 취소/종료: `turnStartedAt = null` → `StatusLine` 이 `null` 반환 → SVG 언마운트. CSS 애니메이션은 노드와 함께 사라져 별도 정리가 없다.
- retry/partial failure: `RetryStatus` 가 별도 줄로 뜨고 스피너는 계속 돈다(현행 유지).
- **다중 저장소 쓰기**: 코드 축에는 없다. 문서 축에 판정 사본이 둘 있다 — `plan.md` 상태와 `INDEX.md` 보드 행. 같은 커밋에서 함께 갱신한다(§18 에 두 파일 모두 열거).

## 14. 성능 / 상한 / 최적화

### 정적 상한

- 인스턴스 38 노드 × 동시 3 = **114 노드**(교체 전 19×3 = 57). 애니메이션 5 × 3 = **15**(교체 전 8×3 = 24).
- 전역 CSS: keyframe stop **288 → 41** · `@utility` **8 → 5**. 인스턴스 수와 무관하게 1회 파싱이다.
- 새 네트워크/IPC 요청: 0.
- React 재렌더: 불변 — 프레임 진행은 브라우저 소유이고 `StatusLine` 재렌더는 경과초 1s 틱 하나뿐이다.

### 런타임 실측 (AT-211 · ΔVP-209)

방법: 같은 Electron 39.8.10 으로 스피너 CSS·마크만 담은 격리 페이지를 띄우고 CDP `Performance.getMetrics` 의 누적값을 차분한다. 조건은 **동시 3개**(최악) · 5,000ms 창 · 3회 평균이고, 모드는 `none`/`old`/`new` 를 순서 편향이 보이도록 번갈아 돈다. 앱 코드·DB·better-sqlite3 ABI 는 건드리지 않는다.

| mode | fps | style recalc | recalc 시간 | layout | layout 시간 | main-thread task |
|---|---|---|---|---|---|---|
| none | 60.2 | 0회 | 0ms | 0회 | 0ms | 73.6ms |
| old | 60.2 | 301회 | 95.2ms | 167회 | 80.3ms | 399.7ms |
| new | 60.1 | 300.7회 | 72.3ms | 147회 | 10.4ms | 243.2ms |

- 기준선 대비 순증가: 구 65.2ms/s → **신 33.9ms/s (−48%)**. 프레임당 1.09ms → **0.57ms**(16.7ms 예산의 3.4%, 3개 동시).
- layout 시간이 80.3 → 10.4ms(−87%)로 준 이유는 구 구현의 `<text>` 글리프 5개가 사라졌기 때문이다 — SVG 텍스트 레이아웃이 비용의 주범이었다.
- 우려했던 축(step-end → cubic-bezier 보간)은 실측에서 **recalc 횟수가 두 구현 모두 초당 60회로 같다**. 구 구현도 이미 프레임마다 스타일을 재계산하고 있었고 보간으로 늘어난 항은 없다.
- **측정 유효성 전제**: 창이 가려지면 rAF 가 멈춰 모든 수치가 0 이 된다. rAF 프레임 수를 먼저 재서 60fps 를 확인한 뒤 측정한다(§10 EP-209). 이 전제를 빠뜨린 1차 측정은 전 모드 recalc 0 을 냈고 폐기했다.
- **측정의 한계**: 전체 앱이 아니라 격리 페이지다. 구/신을 같은 조건에서 비교한 값이라 비교는 유효하지만, 스트리밍 마크다운과 동시에 돌 때의 절대값은 아니다. 측정 하네스는 저장소에 커밋하지 않았다 — 재현은 위 방법 서술을 따른다.

### 빌드 산출 도달 (AT-212 · ΔVP-210)

`@tailwindcss/vite` 로 렌더러 CSS 만 빌드해 산출물을 직접 읽는다(electron-vite 의 prebuild 훅을 타지 않아 ABI 중립). 관측: `.animate-spark-a`~`e` 5개 · `@keyframes spark-a`~`e` 5개 · stop 41 · 구 트랙 문자열 0건 · `--color-spinner: #c15f3c`.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 외부 구현자가 구현할 port/schema/config 가 없다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| D-002 세 곳 전부 | 0208 plan §3 | §7 AT-206 | 유지 (D-202 로 재확인) |
| D-003 성능 저하 금지 | 0208 plan §3 | §7 AT-207~AT-209·AT-211 · §14 | 유지·강화 (D-205 — 런타임 실측을 더한다) |
| D-016 원본 전 축 동일 | 0208 plan §3 | §7 AT-202·AT-203·AT-204 | **변경** — 원본 교체로 그림·주기는 D-201, 크기는 D-203, 색은 D-204 가 축별 대체 |
| D-017 원본은 oracle 전용 | 0208 plan §3 | §7 AT-209 | 유지 (D-206) |
| D-021 원본 줄바꿈 LF 고정 | 0208 plan §3 · `.gitattributes:9` | §11 `.gitattributes` 행 추가 | 유지 — 새 경로에 같은 규칙을 건다 |
| raw hex 금지 · 시맨틱 토큰 | `app/src/renderer/AGENTS.md §스타일` | §7 AT-204 | 유지 |
| 새 CSS 파일·규칙 대신 Tailwind 유틸 | 같은 문서 | §11 CSS 이식 규칙 | 유지 — 공용 `.s` 를 만들지 않고 `@utility` 5개에 전개 |
| 설계 커밋과 구현 커밋 분리 | `handoff-plan/SKILL.md` 마무리 | §19 게이트 | 유지 — D-209 는 **순서**를 바꿨을 뿐 커밋 분리를 면제하지 않는다 |
| 코드 수치를 문서에 재서술 금지 | root `AGENTS.md` 원칙 4 | §8 전수 표 | 유지 — plan 은 조사 산출이고 `docs/arch/`·`docs/generated/` 를 건드리지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 보간 애니메이션이 step 애니메이션보다 페인트가 잦다 | 속성을 `transform`·`opacity` 로 한정(AT-208). §14 실측에서 recalc 횟수는 동일하고 총비용은 48% 낮다 |
| 노드가 19 → 38 로 는다 | 정적 노드라 생성 1회. 애니메이션 8 → 5, 전역 stop 288 → 41 로 준다(AT-207) |
| Tailwind 가 조립된 클래스명을 방출하지 않는다 | 트랙 이름을 `sparkTracks.ts` 의 따옴표 리터럴로 두고 `sparkCss.test.ts` 가 리터럴성을 잠근다(0208 선례) |
| 원본의 c2pa manifest 가 파서 정규식에 걸린다 | 파서가 `<metadata>` 를 먼저 잘라낸다. 구조가 다르면 던진다 |
| **AT-211·AT-212 를 커밋된 테스트가 잠그지 않는다** | 회귀가 조용히 들어올 수 있다. 다만 트랙 미방출은 마크 5개가 동시에 정지 표시되는 **눈에 띄는** 실패다. 자동화는 후속 후보(§파생 이슈) |
| 14px 이 실기에서 여전히 작아 보인다 | AT-210 실기로 확인한다. 수치는 사용자가 지정했으므로 임의로 키우지 않는다 |

- 되돌리기 어려운 결정: 없음 — 전부 렌더러 표시 계층이고 저장 포맷·공개 계약을 건드리지 않는다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/shared/ui/SparkSpinner.tsx`
- `app/src/renderer/src/shared/ui/sparkTracks.ts` (신규)
- `app/src/renderer/src/shared/ui/sparkFrames.ts` (삭제)
- `app/src/renderer/src/shared/ui/sparkFrames.test.ts` (삭제)
- `app/src/renderer/src/shared/ui/sparkReference.testlib.ts`
- `app/src/renderer/src/shared/ui/sparkCss.test.ts`
- `app/src/renderer/src/features/chat/components/statusLine.render.test.ts`
- `app/src/renderer/src/styles/app.css`
- `app/src/renderer/src/styles/tokens.css`
- `.gitattributes`
- `docs/handoff/0216-spinner-artwork-swap/plan.md`
- `docs/handoff/0216-spinner-artwork-swap/spinner-reference.svg`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md §스타일`.
- ABI/환경 제약: DB 를 쓰지 않는 변경이라 `npm test` 로 ABI 를 뒤집지 않는다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `cd app && ./node_modules/.bin/vitest run src/renderer`.
- 문서 게이트: `cd app && node scripts/check-doc-inventory.mjs --check`.
- 재현 측정: §14 의 런타임 실측(AT-211) · 빌드 산출(AT-212).
- 사람 실기: AT-210.
- 커밋: 설계 커밋(`Status: designed`)과 구현 커밋(`Status: implemented`)을 **분리한다**. D-209 가 순서를 바꿨을 뿐 분리 규칙은 그대로다.

## READY self-review

- [x] 여러 턴의 결정이 Decision Ledger 에 보존돼 있다 — 0208 상속분과 이번 `D-2xx` 를 분리했다.
- [x] Part I 만 읽어도 완료 상태가 이해된다.
- [x] 조건절·이유절을 재해석하지 않았다 — 사용자 문장 6개를 §2·§3 에 원문으로 인용했다.
- [x] 물어야 할 제품 결정(색·범위·크기)을 AskUserQuestion 으로 닫고, 폰트 수치는 코드 조사로 닫았다.
- [x] Technical Design 에 AS-IS·TO-BE 가 같은 축으로 있고 Delta 8행이 전부 파일 또는 AC 로 이어진다.
- [x] 수치를 이번 세션에 재측정했다 — 노드 38 = 1+5+16+3+13 · stop 41 = 6+17+6+6+6 · 교체 전 288·19·8·3.
- [x] "세 소비자" 전칭을 `rg` 로 전수 확인했다.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다.
- [x] Delta V 를 썼고 기준 V(`0208:ΔV1@4e1a412f`)에서 유효 V 를 재구성할 수 있다.
- [x] NEW/CHANGED node 에 같은 레벨 REQUIRED pair 가 있고, 영향받은 INHERITED(R-205·R-207·SD-201)는 REGRESSION 이다.
- [x] 각 pair 가 경로·§10 전수 분모·직접 oracle 을 갖고, 적대 증거를 고른 pair 는 이유와 변이를 적었다.
- [x] 음성 게이트(AT-205·AT-209)에 양성 짝을 붙였다.
- [x] 자리를 말하는 불변식(14 ↔ 12 ↔ 14)의 장치가 형제 값 교환에 실패한다 — ΔVP-203 에 그 변이를 적었다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 크기 수치는 AT-203 이 잠근다.
- [x] 게이트 명령이 `app/AGENTS.md` 현행 지침과 충돌하지 않는다(`npm test` 대신 `vitest run`).
- [x] 커밋된 테스트가 잠그지 않는 AC(AT-211·AT-212)를 §17 에 명시했다 — 침묵하지 않았다.
- [x] 본문 완성 후 Decision ↔ AC 를 교차검증하고 결과를 §3 갱신 메모에 적었다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> D-209 로 구현이 먼저 끝나 있으므로, 구현 턴은 **이미 존재하는 작업 트리 산출**을 이 문서의
> Decision·AC·§10 에 대조해 필드를 채운다. 필드를 줄이지 않는다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: (구현 턴 기입)
- 이견 / 현실성 문제: (구현 턴 기입)
- ACTIVE Decision 과 충돌하는 설계 발견: (구현 턴 기입)

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| (구현 턴 기입) | | | | | |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| (구현 턴 기입) | | | | |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| (구현 턴 기입) | | |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| (구현 턴 기입) | | | |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| (구현 턴 기입) | |

## [구현자 기입] Review Signals — 사실만

- (구현 턴 기입)

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | AT-211·AT-212 를 커밋된 테스트가 잠그지 않는다 — 재현 명령뿐이다 | §17 · ΔVP-209·ΔVP-210 | 빌드 산출 검사를 테스트로 승격할지 판단 | NEXT_HANDOFF | open |
