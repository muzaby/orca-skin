# Plan — 0208-spinner-instructions-usage-tooltip

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0208-spinner-instructions-usage-tooltip` |
| 작성자 | Claude Code (V1) · Codex (ΔV1, 사용자 요청) |
| 일자 | 2026-08-28 |
| 매핑 | PR #401 · `claude/ui-improvements-spinner-guidelines-tooltip-taak09` |
| 상태 | READY |
| V mode | `Delta V` |
| 기준 V | `V1@35b44e6` |
| 이번 V revision | `ΔV1` — V1의 스피너 등가·사용량 안내 배치를 대체 |
| 유효 V | `V1 + ΔV1` |

---

# Part I — ΔV1 Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: V1 r1은 첨부 SVG의 0~239번 형상·배율은 재현하지만 원본의 **241개 시간 슬롯**을 240개로 바꿨고, 원본 파일도 정본으로 남기지 않았다. 사용량 추정치 안내는 새 요구와 반대로 차트·막대 안에 퍼져 있다.
- 완료 후 달라지는 것: 원본 SVG 내용이 이 handoff에 남고, 런타임은 원본의 크기·형상·색·241슬롯 타이밍을 그대로 내면서도 기존의 정적 마크+CSS 성능 특성을 유지한다. 추정치 안내는 전역 설정 > 사용량 설명에만 남는다.
- 성공을 사용자 관점 한 문장으로: **보이는 스피너는 첨부 원본과 같고 가벼우며, 추정치 안내는 차트를 가리지 않고 사용량 설명에서 한 번만 읽힌다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "transcript에서 답볔을 기다리는 스피너 아이콘을 첨부 svg로 대체한다" | 세션 턴 (2026-08-28) |
| 명시 요구 | "지침(우측)아래에 현재 지원하지 않는 첨부 파일 입력란을 제거한다. 그리고 해당 공간만큼 지침 컴포넌트를 확잔한다(높이)" | 같은 턴 |
| 명시 요구 | "세팅.사용량 차트, 세팅.사용량.<provider> 주간/월간 막대바에 마우스 호버시 다음 툴팁을 제공한다" + 문구 원문 | 같은 턴 |
| 명시 요구 | **"스피너로인해 겅능저하가 발생하면 안된다"** (2회 반복) | 플랜 반려 턴 |
| 명시 요구 | "본문 내용을 svg확장자로 사용하라" (업로드 `…convergev3.md`) | 업로드 턴 |
| 명시 요구 | 교체 범위 "세 곳 모두 교체" · 확장 방식 "고정 최소 높이를 준다" · 툴팁 대상 3곳 | AskUserQuestion 1·2차 |
| 명시 요구 | "첨부 svg와 똑같은 스피너로 사용, 단 성능저하가 발생하면 안됨" | 사용자 변경 턴 (2026-08-28) |
| 명시 요구 | `설정 > 사용량` 설명의 "provider별 사용량 한도는 좌측…" 문장을 제거하고 기존 툴팁 문구로 대체 | 같은 턴 |
| 명시 요구 | "차트에서 해당 안내문이 들어간 내용만 모두 제거" — 차트 자체·기존 수치 툴팁은 유지 | 같은 턴 |
| 명시 요구 | "원본을 plan.md 경로에 첨부" | 사용자 추가 턴 |
| 추론 의도 (V1 · 폐기) | 아티팩트를 **인라인 React 컴포넌트**로 옮기고 `.svg` 파일은 남기지 않는다 | 설계자 판단 → D-015·D-017이 대체 |
| 추론 의도 | 성능 제약을 "노드 수·리렌더 수"로 조작화한다 — 사용자가 수치를 지정하지 않았다 | 설계자 판단 (D-003) |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 대기 스피너를 **사용자 제공 아티팩트**로 대체한다 | 사용자: "첨부 svg로 대체한다" | 사용자 턴 | ACTIVE | — |
| D-002 | 교체 범위는 `StatusLine` 렌더 지점 **3곳 전부**다 | 사용자 선택 "세 곳 모두 교체". 두 타일 코드에 "메인 transcript 와 동일한 StatusLine" 주석이 이미 있다 | AskUserQuestion 1차 | ACTIVE | — |
| D-003 | **스피너가 성능을 저하시키면 안 된다** — 원본 스트립을 그대로 펼치지 않는다 | 사용자: "스피너로인해 겅능저하가 발생하면 안된다". 1:1 인라인은 인스턴스당 ≈1767 SVG 노드(3곳 동시 ≈5301)이고 그중 보이는 것은 1프레임뿐이다 | 사용자 턴 + 실측 | ACTIVE | 초안의 "241 프레임 스트립 인라인"을 대체 |
| D-004 | 값싼 인코딩은 **원본과 프레임 단위로 등가**여야 한다 — 눈이 아니라 240/240 으로 증명한다 | 형상·배율만 0~239번 대조해 원본의 241번째 시간 슬롯과 색 차이를 놓쳤다 | 설계자 판단 | SUPERSEDED | D-016 |
| D-005 | 색을 지정하지 않고 **`text-rust` 를 `currentColor` 로 상속**한다 | light `--color-rust=#c96442` 는 첨부 원본 `#d97757` 과 달라 "똑같은" 요구를 충족하지 않는다 | 저장소 규칙 + 실측 | SUPERSEDED | D-016 |
| D-006 | 애니메이션 CSS 는 **`styles/app.css` 의 `@utility` 블록**으로 올린다 | 같은 규칙 "새 CSS 파일·규칙 추가 금지". 인라인 `<style>` 은 문서 전역이라 클래스·키프레임 이름이 새고 인스턴스마다 중복된다. `epitaxy-shine`·`status-beacon`·`tile-in` 이 이미 그 자리다 | 저장소 규칙 | ACTIVE | — |
| D-007 | **`.svg` 파일로 커밋하지 않는다** — 인라인 컴포넌트로 옮긴다 | 사용자가 원본을 `plan.md`와 같은 경로에 첨부하라고 명시했다. 런타임 미사용 원칙만 D-017로 승계한다 | 설계자 판단 → 플랜 승인 | SUPERSEDED | D-015·D-017 |
| D-008 | 첨부 파일 카드를 **제거**한다 — 렌더·컴포넌트 파일·전용 일러스트·i18n 3키까지 | 사용자: "현재 지원하지 않는 첨부 파일 입력란을 제거한다". 이동이 아니라 제거이고, 그 능력 자체가 아직 없다(0039 가 RAG 도입까지 유예로 기록) | 사용자 턴 + 0039 | ACTIVE | — |
| D-009 | `shared/ui/mock.ts` 의 `DISABLED_HATCH_CLASS` 는 **유지**한다 | 소비자가 0 이 되지만 `dom-architecture.md §Mock UI marker (0010)` 이 그것을 **현재 규칙**으로 소유한다. 규칙 폐기는 D-008 의 범위 밖이다 | 설계자 판단 | ACTIVE | — |
| D-010 | 지침 카드는 **고정 최소 높이**로 키운다 — 컬럼 전체 높이 배선이 아니다 | 사용자 선택 "고정 최소 높이를 준다". 우측 컬럼에 높이 클래스가 하나도 없어 전체 높이 배선은 `aside`→사이드바→카드 3단 변경이 필요하다 | AskUserQuestion 2차 | ACTIVE | — |
| D-011 | 본문의 `line-clamp-3` 을 **제거**한다 — 넘치면 카드 안에서 스크롤한다 | 선택지 설명이 "본문은 그 안에서 스크롤합니다"였다. 카드만 키우고 3줄에서 자르면 빈 공간만 남아 "확장"이 성립하지 않는다 | AskUserQuestion 2차 | ACTIVE | — |
| D-012 | 툴팁 문구는 **사용자 원문 그대로**이고 키는 최상위 `usage.estimateNote` 다 | 문구·키는 유지하지만 더는 툴팁이 아니다 | 사용자 턴 + 실측 | SUPERSEDED | D-018 |
| D-013 | 적용 대상은 **3곳** — 일별 토큰 차트 · provider 주간/월간 · 모델별 내역 | 사용자가 차트에 들어간 안내를 모두 제거하도록 변경했다 | AskUserQuestion 2차 + 실측 | SUPERSEDED | D-019 |
| D-014 | 신규 `Tooltip` 컴포넌트를 만들지 않는다 — 기존 관례를 쓴다 | 안내 자체가 툴팁에서 빠지므로 해당 설계가 소멸한다 | 실측 | SUPERSEDED | D-019 |
| D-015 | 업로드 원본을 spinner-reference.svg로 **내용 그대로 보존**하고 plan.md에서 링크한다 | 업로드 SHA-256 259933…aca0. 원본 EOF에 없던 LF 1byte만 repository text 정규화로 붙으며 XML·animation 내용은 동일 | 사용자 변경 턴 + 이번 턴 실측 | ACTIVE | D-007 대체 |
| D-016 | 런타임 스피너는 원본과 **관측 가능한 전 축이 같다** | 18×18·viewBox·spoke/dot/glyph 기하·고정색 `#d97757`·7200ms/241슬롯·마지막 frame-0 중복·감속 모션 frame 0을 원본 파일에서 직접 대조한다 | 사용자 "똑같은" + 실측 | ACTIVE | D-004·D-005 대체 |
| D-017 | 원본 SVG는 **문서·테스트 oracle 전용**이고 프로덕션 번들에 넣지 않는다 | 원본은 54,552 bytes·프레임 DOM 약 1,767개다. 런타임은 정적 마크와 CSS 트랙을 유지해야 D-003을 지킨다 | 사용자 성능 조건 + 실측 | ACTIVE | D-007의 런타임 원칙 승계 |
| D-018 | `usage.estimateNote`를 전역 사용량 설명의 **유일한 문구 SSOT**로 유지한다 | `settings.usage.desc`는 첫 문장만 남기고 `UsageTab`이 두 키를 이어 렌더한다. ko/en에 문구를 복제하지 않는다 | 사용자 변경 턴 + 설계자 판단 | ACTIVE | D-012 대체 |
| D-019 | 추정치 안내는 **전역 사용량 설명 1곳에만** 보이고 모든 차트·막대·도넛에서는 0건이다 | 일별 데이터 툴팁의 날짜·토큰·비용과 각 막대 자체는 유지한다. `Meter.title`은 이 안내만을 위해 생긴 dead API라 함께 제거한다 | 사용자 변경 턴 + 전수 조사 | ACTIVE | D-013·D-014 대체 |
| D-020 | "해당 안내문이 들어간 내용만" 제거한다 | 차트·기간 탭·주간/월간 수치·모델 내역·기존 recharts 툴팁을 삭제하거나 재배치하지 않는다 | 사용자 조건절 | ACTIVE | — |
| D-021 | 저장소 텍스트의 줄바꿈을 `.gitattributes` 로 **LF 로 고정**한다 | AT-21 은 원본의 바이트 수·SHA 를 단언하는데, Windows 기본 `core.autocrlf=true` 체크아웃이 LF→CRLF 로 바꿔 그 단언이 체크아웃 설정에 좌우된다(실측 3 red). `app/.editorconfig` 의 `end_of_line = lf` 와 prettier 기본값이 이미 LF 를 선언하므로 새 정책이 아니라 **기존 선언의 강제**다 | 사용자 결정 + 실측 | ACTIVE | — |

### 갱신 메모

- 신규 결정: ΔV1에서 D-015~D-020이 추가됐고, r3 정정에서 D-021이 추가됐다.
- **변경된 결정**: D-004·D-005·D-007·D-012·D-013·D-014를 각각 D-015~D-019가 대체한다. D-003의 성능 조건과 D-006·D-008~D-011은 유지한다.
- 초안의 `useId()` 중복 id 대책은 **소멸**했다 — D-003 의 마크 7개 형태에는 `<defs>`/`<use>` 가 없다. 결정이 아니라 설계 세부라 Ledger 행을 만들지 않는다.
- **`ACTIVE 결정 ↔ AC` 대조: 충돌 0.** D-001·D-002↔AT-01·AT-02 · D-003·D-017↔AT-03·AT-04·AT-24 · D-006↔AT-22·AT-24 · D-008~D-011↔AT-10~AT-14 · D-015·D-021↔AT-21 · D-016↔AT-22·AT-23·AT-30 · D-018↔AT-25 · D-019·D-020↔AT-25~AT-29. **SUPERSEDED 결정의 반대 요구는 유효 AC에서 제거했다.**
- **D-009 ↔ D-008 비충돌**: D-008 이 지우는 것은 *첨부 입력란*이고 D-009 가 지키는 것은 *빗금 규약*이다 — 후자의 마지막 소비자가 전자였을 뿐 같은 대상이 아니다.
- **D-011 ↔ D-010 비충돌**: D-010 은 카드의 *높이*를, D-011 은 본문의 *잘림*을 정한다. 둘 다 바꿔야 "해당 공간만큼 확장"이 성립한다.

## 4. ΔV1 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| "첨부 SVG와 똑같이"와 "성능 저하 없음"을 동시에 만족할 수 있는가 | 가능 | 원본 스트립을 런타임에 넣지 않고, 보이는 7개 마크만 한 번 그린 뒤 원본에서 읽은 241슬롯 visibility·scale 트랙을 CSS가 진행한다 |
| V1의 240프레임 등가 증명은 충분했는가 | 아니오 | 원본은 7200ms에 241개 시간 슬롯이다. frame 240이 frame 0과 같은 형상이어도 약 29.8755ms를 차지하므로 삭제하면 타이밍이 달라진다 |
| 색도 "똑같은" 범위인가 | 예 | 원본은 항상 #d97757이다. V1의 text-rust는 light 테마에서 #c96442라 원본과 다르다 |
| 원본을 테스트 정본으로 직접 쓸 수 있는가 | 예 | 같은 디렉터리의 [spinner-reference.svg](spinner-reference.svg)를 파싱하면 손으로 옮긴 240행 기대값을 제거하고 원본 변경에도 테스트가 반응한다 |
| 안내 문구 이동 범위가 모호한가 | 아니오 | settings.usage.desc의 둘째 문장만 제거하고 usage.estimateNote를 같은 설명에 붙인다. 차트·막대에서는 그 안내만 제거하고 날짜·토큰·비용·막대·기간 탭은 유지한다 |

- 사용자에게 다시 물을 결정은 없다. "똑같은"은 크기·기하·마크 순서·배율·색·7200ms/241슬롯을 모두 포함하는 것으로 닫는다.
- 업로드 SHA-256은 2599335fdfa6d75a47472fd7455e39abf0cad49ccfaacb6d7af21e6c7899aca0, repository 사본은 마지막 LF 1byte가 붙은 ee57259b2b5cb3c8b7b77509699815800530ca83b05697252799a373009bf79b다. LF를 제외한 54,552 bytes가 완전히 같고 이 파일의 XML 내용이 oracle이다.

## 5. ΔV1 동작 / 사용자 흐름

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 응답 대기 시작 | StatusLine이 정적 마크 7개를 한 번 마운트하고 CSS 8트랙이 원본 241슬롯을 진행 | 첨부 SVG와 같은 18×18, #d97757, 7200ms 루프 |
| 감속 모션 on | 모든 트랙을 멈추고 원본 frame 0을 표시 | spoke, scale 1.0으로 정지 |
| 응답 대기 종료 | StatusLine이 언마운트 | 별도 타이머·cleanup 없음 |
| 설정 > 사용량 진입 | 제목 아래 설명에 기존 첫 문장과 usage.estimateNote를 연속 표시 | provider 위치 안내 대신 SDK 추정치 안내를 한 번 읽음 |
| provider 주간·월간 막대 / 모델별 막대 hover | 막대만 표시하고 V1의 title 속성을 두지 않음 | 추정치 안내 툴팁 없음 |
| 일별 차트 hover | 기존 recharts 패널에 날짜·토큰·비용만 표시 | 추정치 안내 줄 없음 |

### 파생 UX / 엣지케이스

- 사용량 로딩·빈 상태에서도 상단 설명은 항상 보인다. 안내의 전달이 차트 데이터 존재 여부에 좌우되지 않는다.
- weekly 집계 안내는 별도 의미이므로 유지한다. 제거 대상은 usage.estimateNote 문자열뿐이다.
- 스피너의 aria-hidden과 상위 aria-live·aria-label 계약은 유지한다. 색은 테마에 따라 바뀌지 않고 원본과 동일하게 고정한다.

## 6. ΔV1 범위 / 비범위

- 범위: 원본 SVG 동봉·링크·직접 파서 oracle, 241슬롯 런타임 등가, 고정 색 토큰, 성능 회귀 잠금, 전역 사용량 설명의 문구 이동, 세 차트/막대 표면의 안내 제거, V1 전용 title API와 테스트 정리.
- 상속 범위: 세 StatusLine 소비자, 첨부 파일 카드 제거, 지침 카드 min-height·스크롤, i18n ko/en 패리티는 V1 계약을 그대로 유지한다.
- 비범위: 차트·막대·기간 탭·집계 방식 변경, 사용량 계산 또는 청구 의미 변경, 컴포저 UsagePanel 변경, 새 Tooltip 컴포넌트, 원본 SVG의 런타임 import.

| 미룬 항목 | 처리 |
|---|---|
| 글리프 5종을 path로 변환 | 이번 요구는 첨부 원본과 동일성이므로 원본의 폰트 계약을 유지하고 사람 실기에서 확인 |
| CSS 트랙 자동 생성 빌드 단계 | 신규 빌드 의존성을 만들지 않는다. 테스트가 원본→TS/CSS 사본을 직접 대조 |

## 7. ΔV1 Requirements / Acceptance — R ↔ AT

> V1의 AT-05~AT-09·AT-15~AT-20은 아래 AT-21~AT-30이 대체한다. AT-01~AT-04·AT-10~AT-14는 상속하며, 충돌 시 이 표가 우선한다.

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션/산출물 도달 경로 |
|---|---|---|---|---|
| R-08 | AT-21 / AC21 | 업로드 원본 내용이 plan.md와 같은 디렉터리에 **모든 플랫폼에서 같은 바이트로** 남는다 | repository 사본의 마지막 LF를 제외한 54,552 bytes·업로드 SHA 동일, SVG parse 성공, plan 상대 링크 유효, `.gitattributes` 가 LF를 고정하고 원본 텍스트의 CR 0건 | 업로드 → `.gitattributes` LF 고정 → spinner-reference.svg → plan 링크 |
| R-08 | AT-22 / AC22 | 런타임이 원본의 241개 시간 슬롯 전부와 관측 축을 그대로 낸다 | 원본 파서가 slot별 shape·scale·key time을 읽어 함수·CSS와 241/241 대조하고, 18×18·viewBox·기하·#d97757·7200ms도 등호 단언 | reference → sparkFrames·app.css·token → SparkSpinner → StatusLine 3곳 |
| R-08 | AT-23 / AC23 | 등가 oracle이 자기 전사본을 검증하는 허수아비가 아니다 | reference의 slot 수·마지막 slot·key time·색·기하 중 하나를 변조한 fixture가 실패하고, 런타임을 240슬롯으로 되돌려도 실패 | reference parser → expected sequence → runtime source assertions |
| R-02·R-08 | AT-24 / AC24 | 정확도를 높여도 V1의 성능 특성이 나빠지지 않는다 | spinner 유발 React timer/state 0, 인스턴스당 SVG 약 19노드, 동시 3개 약 57노드, 애니메이션 속성 transform·visibility뿐, production build에 reference 문자열·asset 0 | turnStartedAt → one mount → compositor CSS → unmount |
| R-09 | AT-25 / AC25 | 설정 > 사용량 설명에서 provider 위치 문장이 사라지고 추정치 안내가 정확히 한 번 보인다 | 순수 UsageDescription 렌더에 첫 문장 + NOTE 각 1건, ko/en desc에 provider 위치 문장 0건 | UsageTab header → settings.usage.desc + usage.estimateNote |
| R-09 | AT-26 / AC26 | provider 주간·월간 막대에 추정치 안내가 없다 | LimitBarsSection 렌더에 NOTE·title 0건이면서 week/month Meter 트랙 2건과 수치가 남음 | ProviderUsageTab → LimitBarsSection → Meter |
| R-09 | AT-27 / AC27 | 모델별 막대에 추정치 안내가 없다 | N개 모델 렌더에 NOTE·title 0건이면서 Meter N개·모델명·토큰 breakdown이 남음 | UsageTab → ModelUsageList → Meter |
| R-09 | AT-28 / AC28 | 일별 차트 툴팁에서 안내 줄만 사라진다 | active tooltip에 NOTE 0건과 날짜·토큰·비용 양성 짝, inactive는 빈 출력 | TokensPerDayChart → recharts Tooltip → UsageTooltip |
| R-09 | AT-29 / AC29 | usage.estimateNote의 production 소비자는 전역 설명 한 곳뿐이다 | renderer의 비-test callsite 전수 검색 = 1, Meter.title 타입·DOM 전달·V1 전용 주석 = 0 | i18n SSOT → UsageDescription 단일 소비자 |
| R-01·R-05·R-06·R-08·R-09 | AT-30 / AC30 | 실제 앱에서도 원본 동일성과 상속 UX가 성립한다 | 사람 실기: 두 테마·Windows에서 스피너 크기/정렬/색/속도, 감속 모션 frame 0, 지침 카드, 사용량 설명 1건과 세 표면 안내 0건 | 실행 중인 앱 |

### AC 검증 주의사항

- frame 240은 frame 0과 같은 그림이지만 별도 시간 슬롯이다. SPARK_TOTAL_FRAMES는 241, SPARK_FRAME_MS는 7200/241이며 240×30ms로 정규화하지 않는다.
- shape·scale 기대값은 spinner-reference.svg를 파싱해 만든다. 테스트 안에 ORIGINAL_FRAMES 240행을 다시 두지 않는다.
- 음성 단언 AT-26~AT-29에는 막대·모델·날짜·토큰·비용 양성 짝을 둔다. 차트를 통째로 지워 통과할 수 없다.
- AT-21의 바이트·SHA 단언은 **체크아웃 줄바꿈에 좌우된다**. `.gitattributes` 로 LF를 고정하지 않으면 Windows 기본값이 CRLF로 받아 같은 내용이 다른 바이트가 된다 — 그 상태에서는 AT-23의 여러 줄 변조 fixture도 조용히 적용되지 않는다(D-021).
- performance는 "체감"만 보지 않는다. timer/state·DOM 상한·animated property·production bundle 경계를 각각 잠근다.

## 7-A. ΔV1 V / Trace Matrix

- V mode: Delta V.
- 기준 V: V1@35b44e6. 이 문서의 Appendix A가 기준 설계를, Appendix B가 r1 구현 증거를 보존한다.
- 유효 계약: V1에서 아래 SUPERSEDED node를 제거하고 ΔV1 NEW/CHANGED node를 합친다.

### ΔV1 Node registry

| Node | 레벨 | provenance | 계약 / 대체 |
|---|---|---|---|
| R-01·R-02·R-05·R-06 | R | INHERITED | 새 스피너 3곳, 성능, 파일 카드 제거, 지침 카드 확장 |
| R-03·R-04 | R | SUPERSEDED | R-08이 241슬롯·고정색·감속 모션까지 대체 |
| R-07 | R | SUPERSEDED | R-09가 안내의 새 위치·제외 표면을 대체 |
| R-08 | R | NEW | 첨부 원본 직접 oracle, 전 축 동일성, 성능 비회귀 |
| R-09 | R | NEW | 추정치 안내는 전역 설명 한 곳, 차트·막대 0곳 |
| AT-01~AT-04·AT-10~AT-14 | AT | INHERITED | Appendix A의 기존 oracle 유지 |
| AT-05~AT-09·AT-15~AT-20 | AT | SUPERSEDED | AT-21~AT-30으로 대체 |
| AT-21~AT-30 | AT | NEW | §7의 열 개 AC |
| SD-01 | SD | INHERITED | 프레임 진행이 React 상태를 거치지 않음 |
| AR-01·AR-02 | AR | CHANGED | AR-05의 reference→TS/CSS 241슬롯 배선으로 대체 |
| AR-03·AR-04 | AR | SUPERSEDED/CHANGED | AR-06의 단일 문구 소비와 제거 지점 전수로 대체 |
| AR-05 | AR | NEW | reference asset → parser → runtime data/CSS/token |
| AR-06 | AR | NEW | i18n NOTE → UsageDescription 1곳, chart/meter 0곳 |
| MD-01 | MD | CHANGED | 240 반복식 대신 241슬롯 source-derived model |
| MD-02 | MD | INHERITED | 지침 카드 min-height·scroll |
| MD-03 | MD | NEW | SVG reference parser와 mutation-sensitive oracle |
| ST-02·IT-05·IT-06·UT-03 | ST/IT/UT | NEW | 아래 ΔV pair의 성능·배선·민감도 증거 |

### ΔV1 Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 적대 증거 | §10 EP |
|---|---|---|---|---|---|---|
| ΔVP-01 | R-08 ↔ AT-21 | REQUIRED | upload → `.gitattributes` → reference → plan | EOF LF 정규화를 제외한 SHA·XML·relative link 검사 + LF 고정 | XML 내용 1byte 변경 · CRLF 체크아웃 | EP-09 (3) |
| ΔVP-02 | R-08 ↔ AT-22 | REQUIRED | reference → runtime tracks → 3 StatusLine | 241/241 + 기하·색·기간 등호 | 241→240 회귀 | EP-10 (4) |
| ΔVP-03 | MD-03 ↔ AT-23·UT-03 | REQUIRED | parser → expected → assertions | 변조 fixture가 red | 마지막 slot·색·key time 변조 | EP-09·10 (6) |
| ΔVP-04 | R-02·SD-01 ↔ AT-24·ST-02 | REGRESSION | turn start → one mount → CSS → unmount | timer 0·노드 상한·property allowlist·bundle 0 | timer 또는 reference import 재도입 | EP-11 (4) |
| ΔVP-05 | AR-05 ↔ AT-22·IT-05 | REQUIRED | reference → TS functions/CSS/token | parser 대조 + CSS 원문 + build output | duration·token·window 한 지점 변경 | EP-10 (4) |
| ΔVP-06 | R-09 ↔ AT-25 | REQUIRED | i18n → UsageDescription | 렌더 NOTE 1 + provider 문장 0 | NOTE 렌더 제거 | EP-12 (7) |
| ΔVP-07 | R-09 ↔ AT-26~AT-28 | REQUIRED | settings charts/meters → rendered DOM | 음성 NOTE + 각 표면 양성 짝 | chart 전체 삭제 | EP-12 (7) |
| ΔVP-08 | AR-06 ↔ AT-29·IT-06 | REQUIRED | NOTE key → one production callsite | 비-test callsite 1, title API 0 | chart callsite 하나 복원 | EP-12 (7) |
| ΔVP-09 | R-01·R-05·R-06·R-09 ↔ AT-30 | REGRESSION | 실행 앱의 네 표면 | 사람 실기 | not selected — 시각·OS 폰트 | 0 |

### 현재 설계 변경의 운영 gate

| Gate | 이번 산출물 | 명령 | blocking |
|---|---|---|---|
| docs handoff | plan·INDEX·reference SVG | cd app && node scripts/check-doc-inventory.mjs --check | 이번 diff가 낸 오류 |
| repository hygiene | Markdown·SVG 추가 | git diff --check + SVG parser + SHA 대조 | 모두 |
| message bus | 설계 커밋 1개 | git trailer의 Agent·Handoff·Status | 파싱 0건 |

---

# Part II — ΔV1 Technical Design

## 8. ΔV1 Research — 현재 코드와 원본

| 발견 | 실측 |
|---|---|
| 첨부 원본 | 54,552 bytes, 18×18, viewBox 0 0 100 100, color #d97757, 7200ms, keyframe 241개 |
| 원본 시간축 | n/241 지점의 241슬롯, frame 240은 frame 0과 같은 spoke·scale 1이지만 마지막 약 29.8755ms를 차지 |
| V1 r1 | shapeAtFrame·scaleAtFrame은 0~239에서 불일치 0, 그러나 240슬롯·30ms로 정규화하고 light 색이 다름 |
| V1 런타임 비용 | 마크 7개, 약 19 SVG 노드, CSS 트랙 8개, spinner 전용 React timer 0 |
| 현재 사용량 안내 | UsageLimitViews 1, ModelUsageList 1, UsageTooltip 1 = production callsite 3 |
| 현재 전역 설명 | ko/en 모두 첫 문장 + provider 위치 둘째 문장을 한 키에 결합 |
| Meter.title | V1 안내를 위해서만 추가됐고 다른 의미의 소비자 없음 |

### 수치 / 전칭 검산

- 원본 top-level frame group 241, use 116, text 115, circle 10이다. runtime asset으로 넣으면 V1의 노드 상한을 깨므로 docs/test oracle 전용이다.
- 원본의 0~239 shape·scale와 현 함수 비교 결과 불일치 0, frame 240 == frame 0은 참이다. "같은 그림"과 "같은 시간축"은 다른 계약이다.
- usage.estimateNote의 production 호출은 현재 세 곳이고, 목표는 정확히 한 곳이다. 설정 외 UsagePanel에는 현재도 NOTE가 없다.

## 9. ΔV1 Architecture — AS-IS → TO-BE

| 축 | AS-IS r1 | TO-BE ΔV1 | 이유 |
|---|---|---|---|
| 원본 정본 | repo에 없음, 테스트 240행 손 전사 | handoff의 원본 내용 SVG를 파서가 직접 읽음 | 자기복제 oracle 제거 |
| 시간축 | 240×30ms, 24-frame pulse 반복 | 241×(7200/241)ms full-period scale + visibility | 마지막 슬롯 포함 |
| 색 | text-rust/currentColor | 고정 semantic spinner token #d97757/currentColor | 두 테마에서 원본 동일 |
| 런타임 구조 | 7 mark + 8 CSS animation | 같은 구조·같은 animation/DOM 상한 | 성능 비회귀 |
| 전역 설명 | token 설명 + provider 위치 | token 설명 + usage.estimateNote | 사용자 요청 |
| provider/model Meter | title=NOTE | title prop 없음 | 안내 제거 |
| daily tooltip | 날짜·토큰·비용+NOTE | 날짜·토큰·비용 | 안내 줄만 제거 |

### TO-BE control flow

1. 테스트는 spinner-reference.svg를 읽어 241개의 shape·scale·key time과 정적 기하·색·기간을 추출한다.
2. production은 원본 파일을 import하지 않는다. SparkSpinner의 7개 마크와 app.css의 full-period 트랙만 사용한다.
3. UsageDescription이 settings.usage.desc와 usage.estimateNote를 이어 렌더하고, 나머지 settings chart/meter는 NOTE를 알지 못한다.

## 10. ΔV1 계약 / 강제 지점

| EP | SSOT | 강제 지점 전수 | 실패 의미 |
|---|---|---|---|
| EP-09 원본 보존 | spinner-reference.svg 내용·두 SHA | reference 파일 1 + plan 상대 링크 1 + `.gitattributes` LF 고정 1 = 3 | 파일이 없거나 EOF LF 외 내용이 변하면 동일성 기준이 사라짐. 줄바꿈이 고정되지 않으면 같은 내용이 플랫폼마다 다른 바이트가 되어 단언이 체크아웃 설정에 좌우된다 |
| EP-10 원본→runtime | reference parser | sparkFrames.ts·SparkSpinner.tsx·app.css·tokens.css = 4 | 한 축만 다르면 눈으로 비슷해도 "똑같은"이 아님 |
| EP-11 성능 | D-003/AT-24 | StatusLine timer 0·SparkSpinner 노드 상한·CSS property allowlist·production build asset 0 = 4 | 정확도 대가로 main thread/DOM/bundle 비용이 증가 |
| EP-12 안내 위치 | usage.estimateNote | UsageDescription add 1·Model remove 1·provider remove 1·daily remove 1·Meter API remove 1·ko/en desc 수정 2 = 7 | 안내가 중복되거나 차트 내용까지 사라짐 |

- 색의 raw 값은 tokens.css의 semantic token 정의 한 곳만 소유한다. SparkSpinner는 currentColor만 쓰고 StatusLine이 token class를 준다.
- CSS는 24-frame 독립 pulse를 반복하지 않는다. 241 mod 24 = 1이라 pulse가 720ms마다 재시작하면 원본의 마지막 슬롯에서 위상이 달라진다.
- shape visibility는 연속 window 경계만 두고, scale은 원본 241 stop을 full-period keyframe으로 둔다. CSS 크기는 전역 1회이며 인스턴스당 DOM·animation 수는 늘지 않는다.

## 11. ΔV1 구현 설계

| 파일 | 변경 | 테스트 seam |
|---|---|---|
| docs/handoff/0208.../spinner-reference.svg | 업로드 내용 추가; repository final LF 1byte 정규화 | 두 SHA·prefix bytes·XML·plan link |
| shared/ui/sparkFrames.ts | total 241, frame ms 7200/241, frame 240 window 포함, 24-frame modulo 가정 제거 | pure shapeAtFrame·scaleAtFrame |
| shared/ui/SparkSpinner.tsx | 기하 유지, semantic fixed-color class 계약 반영 | static markup geometry/node count |
| styles/tokens.css | 두 테마에서 같은 spinner-reference color token 정의 | CSS source assertion |
| styles/app.css | 7200ms full-period scale 241 stops와 source-derived visibility windows | reference parser↔CSS source |
| StatusLine.tsx | text-rust를 fixed spinner token class로 교체; timer 0 유지 | statusLine render/source |
| UsageTab.tsx | 순수 UsageDescription export·NOTE 1회 추가; ModelUsageList의 title 제거 | settings render |
| UsageLimitViews.tsx | provider Meter title 제거 | two positive bars |
| TokensPerDayChart.tsx | NOTE 줄·불필요 tr/max-width/comment 제거; 날짜·토큰·비용 유지 | direct UsageTooltip render |
| shared/ui/Meter.tsx | title prop·DOM 전달·V1 주석 제거 | 기본 Meter 양성 렌더 |
| i18n resources ko/en | settings.usage.desc를 첫 문장만 남김; usage.estimateNote 유지 | key parity + exact copy |
| sparkFrames.test.ts | 240행 전사 삭제, committed SVG parser 기반 241/241 비교 | mutation-sensitive helper |
| sparkCss.test.ts | 241 slot·7200ms·fixed token·allowlist·reference non-import 검사 | CSS/source/build boundary |
| usageTooltip.render.test.ts | 설명 NOTE 1, 세 chart/meter NOTE 0와 양성 짝 | pure SSR |
| meter.render.test.ts | V1 title 계약 삭제, ratio clamp/track 양성 회귀만 유지 | pure SSR |
| usagePanel.render.test.ts | V1 범위 제외만을 위한 파일이면 삭제; 독립 가치가 있으면 NOTE 0 + bar 양성만 유지 | feature boundary |

### 테스트 가능성

- SVG parser는 test helper에 두고 XML의 frame group, use/text/circle, transform scale, keyframe percentage, outer style을 읽는다. production code는 fs나 docs 경로를 import하지 않는다.
- CSS animation을 브라우저 시간으로 기다리지 않는다. source slot table과 runtime pure functions/CSS stops를 같은 index로 비교한다.
- mutation test는 파서 내부 상수를 바꾸는 방식이 아니라 reference 문자열 복사본 한 축을 바꿔 실제 oracle 방향을 검증한다.

## 12. ΔV1 End-to-end 영향

~~~text
spinner-reference.svg → test parser → expected 241 slots ─┐
sparkFrames + app.css + token → SparkSpinner → StatusLine ├→ exactness/perf gates
                                                       ───┘
ko/en usage.estimateNote → UsageDescription → settings header
provider/model/daily chart paths ─────────────────────→ NOTE 0 + original data
~~~

- producer는 원본 SVG와 i18n NOTE 두 개다. 전자는 test-only, 후자는 production 단일 소비자다.
- 부팅·IPC·DB·네트워크·스토어 스키마는 바뀌지 않는다. 새 요청과 저장소 쓰기는 0이다.

## 13. ΔV1 Lifecycle / 오류 / 정리

- mount/unmount 수명은 V1과 같다. CSS animation은 StatusLine DOM 수명에 묶이고 별도 timer cleanup이 없다.
- reference parse 실패는 테스트의 즉시 red다. production 런타임은 docs 파일 부재에 의존하지 않는다.
- 다중 사본은 reference↔TS↔CSS↔token 네 곳과 plan↔INDEX 두 곳이다. 전자는 IT-05, 후자는 문서 gate와 마무리 절차가 잠근다.

## 14. ΔV1 성능 / 상한

- 인스턴스당 출력 상한은 기존과 같은 svg 1 + line 10 + circle 1 + text 5 + wrapper 약 2 = 약 19노드다. 세 소비자 동시 상한은 약 57이다.
- animation 개수는 scale 1 + shape visibility 7 = 8/instance로 유지한다. animated property allowlist는 transform·visibility이고 layout 속성은 금지한다.
- full-period scale CSS stop은 24→241로 늘지만 app.css에 전역 1회 존재한다. 원본 54,552-byte asset과 1,767-node strip은 production import/build 결과에서 0건이어야 한다.
- spinner 전용 React commit은 mount/unmount 외 0이고 기존 useElapsed 1초 갱신만 남는다.

## 15. ΔV1 외부 포트 / 문서 계약

외부 API·SDK·schema 변경은 없다. spinner-reference.svg는 구현 포트가 아니라 이 handoff의 검증 oracle이며 배포 asset이 아니다.

## 16. ΔV1 기존 규칙과의 관계

| 규칙 | 판정 |
|---|---|
| raw hex 금지·semantic token 우선 | 유지 — #d97757은 tokens.css의 전용 token 한 곳, component는 currentColor |
| 새 CSS 파일 금지 | 유지 — 기존 app.css·tokens.css만 수정 |
| features → shared 의존 방향 | 유지 — StatusLine이 shared SparkSpinner를 소비 |
| shared에 도메인 문구 금지 | 강화 — Meter.title과 usage 문구 연결을 제거 |
| UI 시각 검증 | 유지하되 원본 slot·DOM·copy 위치는 기계 검증, 사람은 실제 렌더만 확인 |
| V1 파일 카드·지침 카드 결정 | 상속 — 이번 Delta에서 해당 코드 경로를 건드리지 않음 |
| `app/.editorconfig` `end_of_line = lf` · prettier 기본 `endOfLine: lf` | 강제(r3) — 두 규칙이 이미 LF를 선언하지만 git이 강제하지 않아 Windows 체크아웃이 CRLF였다. `.gitattributes`가 같은 선언을 체크아웃에 적용한다 (D-021) |

## 17. ΔV1 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| 241-stop CSS가 커짐 | global 1회, DOM·animation·React commit 상한 유지; production bundle 크기를 r1 기준과 비교 기록 |
| CSS percentage 반올림으로 slot 경계가 흔들림 | 원본 key time을 그대로 파싱하고 충분한 정밀도로 직렬화; source test가 각 경계 등호 검사 |
| 원본 글리프가 OS별 다름 | 원본 font-family·glyph를 그대로 유지하고 Windows 사람 실기 |
| fixed color가 기존 테마 강조색과 다름 | "첨부와 똑같은" 요구를 우선하며 semantic fixed token으로 규칙 준수 |
| NOTE 제거 중 차트 자체를 손상 | 각 음성 단언에 bar/model/date/token/cost 양성 짝 |

- 신규 의존성 0, 외부 승인 0이다.
- one-way door는 없다. i18n key를 유지하고 위치만 바꾸며 reference는 test-only다.

## 18. ΔV1 영향 파일

- 추가: docs/handoff/0208-spinner-instructions-usage-tooltip/spinner-reference.svg
- 추가(r3): 저장소 루트 `.gitattributes` — D-021의 LF 고정
- 수정: 같은 디렉터리 plan.md, docs/handoff/INDEX.md
- 다음 구현 턴 수정: sparkFrames.ts·SparkSpinner.tsx·app.css·tokens.css·StatusLine.tsx
- 다음 구현 턴 수정: UsageTab.tsx·UsageLimitViews.tsx·TokensPerDayChart.tsx·Meter.tsx·ko.ts·en.ts
- 다음 구현 턴 테스트: sparkFrames.test.ts·sparkCss.test.ts·statusLine.render.test.ts·usageTooltip.render.test.ts·meter.render.test.ts·usagePanel.render.test.ts

## 19. ΔV1 게이트

- 설계 턴: git diff --check, XML parse, 업로드↔repository prefix SHA와 EOF LF 검사, plan 상대 링크 검사, cd app && node scripts/check-doc-inventory.mjs --check.
- 구현 턴 정적: cd app && npm run lint && npm run typecheck.
- 구현 턴 관련 테스트: renderer shared/chat/settings/projects의 direct vitest. better-sqlite3 DB 로드 스위트는 이 변경의 gate가 아니다.
- 구현 턴 production: 앱 production build 후 spinner-reference.svg·spark-strip·ten-spoked 문자열 0, bundle size r1 대비 증분 기록.
- 사람 실기: AT-30.

## ΔV1 READY self-review

- [x] 사용자 변경 요구 4건이 D-015~D-020과 AT-21~AT-30에 연결됐다.
- [x] 기준 V1@35b44e6과 SUPERSEDED node가 명시돼 유효 V를 재구성할 수 있다.
- [x] 원본 XML 내용을 final-LF 정규화만 허용한 산출물과 직접 oracle로 고정했다.
- [x] "똑같은"을 기하·색·241슬롯·기간까지 정의하고 240프레임 정규화를 금지했다.
- [x] 성능을 React commit·DOM·animation property·bundle 네 축으로 잠갔다.
- [x] NOTE 음성 단언마다 차트·막대·수치 양성 짝이 있다.
- [x] usage.estimateNote SSOT와 production 단일 소비자 경로가 명시됐다.
- [x] 영향을 받는 node/pair만 Delta로 다시 쓰고 파일 카드·지침 카드 계약은 상속했다.
- [x] 각 새 AC가 행동, oracle, 도달 경로를 가진다.
- [x] 다음 구현자는 파일별 변경·test seam·gate를 추측 없이 수행할 수 있다.

---

# Appendix A.1 — V1 Product & UX Contract (history)

> 아래 §A4~§A7은 V1@35b44e6의 설계 기록이다. ΔV1과 충돌하는 문장은 SUPERSEDED이며 구현 판단에 사용하지 않는다.

## A4. V1 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 (3건 전부) | 스피너는 실제로 `setInterval` 리렌더 루프다(`StatusLine.tsx:67-73`) · 파일 카드는 핸들러·state 0 인 순수 placeholder 다 · `Meter.tsx:29-36` 에 `title`·`role`·hover 가 전무하다 |
| 이미 기존 코드가 충족하는가 | 1/3 부분 충족 | 일별 토큰 차트에는 recharts 툴팁이 **이미 있다**(`TokensPerDayChart.tsx:82-86`) → 새로 만들지 않고 그 패널에 줄을 더한다. 나머지 2건은 0건 |
| 더 작은 해법이 있는가 / 제거라면 능력 자체가 없어도 되는가 | 예 — 능력이 아직 없다 | `docs/handoff/0039-attachment-thumbnails/plan.md:20` 이 프로젝트 파일 첨부를 RAG 지식베이스 도입까지 **의도적 유예**로 기록한다. 지금 지우는 것은 그 유예의 시각적 잔여물이다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 — 2건 정정 | (a) `dom-architecture.md:157` 이 `DISABLED_HATCH_CLASS` 를 "자동화 nav·파일 첨부 카드 등이 공유"라 적었으나 실측 소비자는 파일 카드 **1곳**뿐이다. (b) 조사 초안이 `UsagePanel` 을 `LimitBarRow` 공유 소비자로 봤으나 실측은 `Meter` 직접 호출이라 **공유하지 않는다** |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 0 · 주의 1 | `renderer/AGENTS.md §스타일`(raw hex·새 CSS 금지)이 D-005·D-006 을 낳았다. §16 에서 본문 문장과 대조 |

- 사용자에게 올릴 결정: 없음 — 4건을 2회 질의 + 1회 제약 반려로 닫았다.
- 코드 조사로 닫은 사실: 렌더 하네스가 이미 있다(`gitRow.render.test.ts:1-27` — `react-dom/server` + `createElement`, 신규 의존성 0). `useI18n` 은 모듈 임포트 시 동기 초기화라(`shared/i18n/index.ts:11`) Provider 없이 렌더된다 — `diffTile.render.test.ts` 가 `useI18n` 소비 컴포넌트를 그대로 렌더하는 선례다.

## A5. V1 동작 / 사용자 흐름

```text
[턴 시작 — turnStartedAt 설정]
  → StatusLine 이 선다: [스피너 SVG] [동사…] [· facts] [(경과 · ↓토큰)]
  → 스피너는 CSS 트랙만으로 33fps 로 돌고 React 는 초당 1회(경과 초)만 리렌더한다
  ↘ prefers-reduced-motion → 트랙 전부 정지, frame 0(spoke, scale 1.0)만 남는다
[턴 종료 — turnStartedAt = null]
  → StatusLine 이 null 을 반환해 통째로 사라진다

[프로젝트 카드 클릭 → 랜딩]
  → 우측 컬럼에 지침 카드 하나 (파일 카드 없음)
  → 지침이 길면 카드 안에서 스크롤, 짧아도 카드 높이는 유지된다

[설정 · 사용량 / 사용량.<provider>]
  → 막대에 호버 → "표시된 사용량은 SDK가 제공하는 추정치입니다. …"
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| `turnStartedAt == null` | `StatusLine` 이 `null` 반환 | 아무것도 그리지 않는다 (기존 `:99` 계약 유지) |
| 턴 진행 중 | CSS 트랙 8개가 마크 7개를 켜고 끈다 | 스피너가 원본과 같은 시퀀스로 돈다 |
| 감속 모션 on | 트랙 8개 전부 `animation: none` | spoke 가 scale 1.0 으로 정지 |
| 글리프 폰트 부재 | `<text>` 가 tofu/공백 | 5구간(전체의 48%)이 비어 보인다 — 리스크 §17 |
| 지침 없음 | 안내 카피 분기 | 카피 + 유지되는 카드 높이 |
| 지침이 카드보다 김 | `overflow-y-auto` | 카드 안 스크롤 (말줄임 없음) |
| `usageLimits == null` | `LimitBarsSection` 이 로딩 문구 | 막대 없음 → 툴팁도 없음 |

### 파생 UX / 엣지케이스

- loading / empty / error: 사용량 로딩 중에는 막대 자체가 없어 툴팁이 붙을 곳이 없다 — 안내는 막대가 있을 때만 필요하므로 의도된 동작이다.
- cancel / retry / close / restart: 스피너는 `turnStartedAt` 만 본다 — 취소·재시도는 그 값의 전이로 이미 표현된다. 새 경로 없음.
- concurrency / multi-session: `StatusLine` 이 동시 3곳까지 산다(transcript + 작업 타일 + 서브에이전트 타일). D-003 의 노드 예산은 그 최악을 기준으로 센다.
- keyboard / a11y: 스피너는 `aria-hidden` 이고 의미는 상위 `<span aria-live="polite" aria-label>` 이 그대로 전달한다(변경 없음). `title=` 툴팁은 키보드로 열 수 없다 — 같은 수치가 인접 텍스트로 이미 보이므로 정보 손실은 없다.
- theme: 색은 `currentColor` 뿐이라 두 테마가 자동으로 맞는다 (D-005).

## A6. V1 범위 / 비범위

- **범위**: `StatusLine` 스피너 교체(3 소비자) · `app.css` 트랙 신설 · 파일 카드 제거와 지침 카드 확장 · 사용량 막대 3곳 툴팁 · 관련 i18n(ko/en) · 어긋난 문서 사본 정정.
- **비범위**: 컴포저 도넛 팝오버 툴팁(D-013) · `Meter` 외 다른 사용량 표면 · 프로젝트 파일 첨부 기능 자체(0039 유예 유지) · `shared/ui/mock.ts` 폐기(D-009) · 글리프를 path 로 대체하는 작업(실기에서 깨지면 후속).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 글리프 5종의 폰트 의존 제거 | 아니오 — 마크 데이터만 바뀐다 | 후속 (실기 결과에 따라) |
| 컴포저 도넛 팝오버 툴팁 | 아니오 — 같은 i18n 키를 재사용한다 | 후속 |
| `usage.estimateNote` 키 이름 | **예 — i18n 공개 키** | 지금 확정 (D-012) |

## A7. V1 Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 턴 진행 중 대기 표시에 **새 스피너가 서고 옛 글리프가 남지 않는다** | `StatusLine` 렌더 출력에 `<svg` 1개 · 옛 전용 글리프 `✣ ✦ ✧ ★` 0건 · **양성 짝**으로 같은 출력에 상태 문구가 함께 있다 (`✢`·`✶` 은 새 마크에도 있어 술어에서 뺀다) | `PendingAssistant.tsx:71` → `StatusLine` |
| R-01 | AT-02 / AC2 | 세 소비자 **전부** 새 스피너를 받는다 | `rg '<StatusLine' --include=*.tsx` 가 3건이고 셋 다 같은 `StatusLine` 을 부른다 — 소비자별 분기가 없다 | 세 렌더 지점 (§10 EP-01) |
| R-02 | AT-03 / AC3 | 스피너가 **React 리렌더를 부르지 않는다** | `StatusLine.tsx` 원문에 `setInterval`·`SYMBOL_INTERVAL_MS`·`symbolIdx` 가 0건이고, **양성 짝**으로 경과 초 훅(`useElapsed`)은 남아 있다 | 턴 진행 중 상시 |
| R-02 | AT-04 / AC4 | 인스턴스당 SVG 노드가 **마크 7개 규모로 고정**된다 | 렌더 출력에서 `<line>` **정확히 10** · `<text>` **정확히 5** · `<circle>` **정확히 1** · `<svg` **정확히 1**. 스트립을 펼친 형태로 되돌아가면 이 개수가 전부 깨진다 | 같은 경로 |
| R-03 | AT-05 / AC5 | 값싼 인코딩이 원본과 **프레임 단위로 같다** | `for i in 0..239`: `shapeAtFrame(i)`·`scaleAtFrame(i)` 가 원본 전사본과 일치 — **240/240**, 불일치 0 | `SPARK_*` → `app.css` 트랙 |
| R-03 | AT-06 / AC6 | 등가 단언이 **눈을 가진다** | 위상(`SPARK_SEGMENT_PHASE`)을 1프레임 어긋내면 AT-05 가 **240건 실패**한다 | 같은 |
| R-03 | AT-07 / AC7 | `app.css` 타이밍이 TS 상수와 **어긋나지 않는다** | `app.css` 원문에서 읽은 `spark-pulse` duration·steps 가 `SPARK_SEGMENT_MS`(720)·`SPARK_SEGMENT_FRAMES`(24)와, 7200ms 트랙 6종이 `SPARK_PERIOD_MS` 와 일치 | 사본 2곳 (§10 EP-02) |
| R-04 | AT-08 / AC8 | 감속 모션에서 **트랙 8개가 전부** 멈춘다 | `SPARK_PULSE_CLASS` + `SPARK_TRACK_CLASS` 값 8개와 `app.css` 의 `prefers-reduced-motion` 블록에 열거된 클래스 집합의 **차집합이 0** | 감속 모션 설정 |
| R-04 | AT-09 / AC9 | 스피너 색이 **테마를 따른다** | `SparkSpinner.tsx` 에 raw hex 0건이고 채움이 `currentColor` 뿐 · 소비자가 `text-rust` 를 준다 | `StatusLine` → `SparkSpinner` |
| R-05 | AT-10 / AC10 | 첨부 파일 입력란이 **어디에도 남지 않는다** | `rg 'ProjectFilesCard|FileDropIllustration|filesCard'` 가 `app/src` 에서 0건 · 두 파일이 부재 · ko/en 양쪽에 `filesCard` 0건. **양성 짝**: 같은 사이드바에 지침 카드는 그대로 렌더된다 | `ProjectInstructionsSidebar` |
| R-05 | AT-11 / AC11 | 빗금 규약은 **살아 있다** | `shared/ui/mock.ts` 가 존재하고 `DISABLED_HATCH_CLASS` 를 export 한다 — D-009 | `dom-architecture.md §Mock UI marker` |
| R-06 | AT-12 / AC12 | 지침 카드가 **되찾은 공간만큼 크고 본문이 잘리지 않는다** | 긴 지침으로 렌더한 출력에 `line-clamp` 0건이고 본문 전문이 있으며(양성 짝), 본문 컨테이너에 `min-h-[280px]` 이 있다 | `ProjectLandingPage:91` → 사이드바 → 카드 |
| R-06 | AT-13 / AC13 | 페이지 편집이 **기존 계약을 깨지 않는다** | `CwdPanel.landing.test.ts` 의 `showLandingCwdPanel` 원문 단언이 계속 통과한다 | `ProjectLandingPage:79` |
| R-06 | AT-14 / AC14 | i18n 두 카탈로그가 **어긋나지 않는다** | `resources.test.ts` 의 ko↔en leaf-key 패리티·빈 값·placeholder 케이스가 통과한다 | 두 카탈로그 |
| R-07 | AT-15 / AC15 | provider **주간·월간 막대**에 안내가 붙는다 | `LimitBarsSection` 출력에 문구를 값으로 갖는 `title=` 이 **정확히 2건**이고 각각 **Meter 트랙 요소 위**에 있다 — `/rounded-full bg-border[^"]*" title="표시된 사용량/` 로 자리까지 본다 | `ProviderUsageTab:90` |
| R-07 | AT-16 / AC16 | **모델별 내역 막대**에 같은 안내가 붙는다 | `ModelUsageList` 출력의 `title=` 개수가 모델 수와 같고 같은 문구다 | `UsageTab:183` |
| R-07 | AT-17 / AC17 | **일별 토큰 차트** 툴팁이 안내를 함께 낸다 | `UsageTooltip` 이 `active`+datum 에서 날짜·토큰·비용과 **함께** 문구를 내고, `active=false` 면 `null` 이다(음성 짝) | `TokensPerDayChart:84` |
| R-07 | AT-18 / AC18 | `Meter` 의 안내가 **호출자 소유**다 | `title` 미전달 렌더 출력에 `title=` 0건 — 장치가 문구를 지웠을 때 실패한다 | `shared/ui/Meter` |
| R-07 | AT-19 / AC19 | 범위 밖 표면이 **번지지 않는다** | `UsagePanel` 렌더 출력에 `title=` 0건. **양성 짝**: 같은 출력에 두 막대가 그대로 있다 (D-013) | `Composer` → `UsagePanel` |
| R-01·R-06·R-07 | AT-20 / AC20 | 시각·실환경 확인 | **사람 실기** — 스피너 크기·정렬·속도(두 테마) · Windows 에서 글리프 5종 실렌더 · 원본 미리보기와 동일해 보이는가 · 카드 높이 · 호버 툴팁 실제 노출 | 실행 중인 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: `CwdPanel.landing.test.ts:21,36-40`(원문에서 `showLandingCwdPanel` 단언) · `resources.test.ts:33`(ko↔en 패리티) — **둘 다 실재 확인**. `TokensPerDayChart`·`UsageTab`·`ProviderUsageTab`·`UsageLimitViews`·`Meter`·`StatusLine` 에는 기존 테스트가 **0건**이라 전부 신설이다.
- 사람 실기 항목(AT-20): 시각 품질·OS 폰트·애니메이션 체감만 남긴다. 프레임 시퀀스·노드 수·클래스 열거·문구 위치는 전부 순수 렌더 단언으로 내렸다 — 눈으로 미룬 로직 없음.
- 전수/0건 기준(AT-08·AT-10): 허용 예외를 먼저 뺀다. AT-10 의 술어에서 `SparkSpinner.tsx` 주석의 `FileDropIllustration` 언급은 **삭제 대상**이지 예외가 아니다(§10 EP-07). AT-08 은 총계가 아니라 **차집합 0** 으로 센다.
- 노드 수 기준(AT-04): 원본 스트립은 `<line>` 1160 · `<text>` 115 · `<circle>` 10 이었다. 상한이 아니라 **정확한 등호**로 쓰는 이유는, 스트립 형태로의 회귀가 그 셋을 동시에 100배로 만들기 때문이다.
- 위치 기준(AT-15): 문구의 *존재*만 보면 행 아무 데나 붙어도 통과한다. `Meter` 트랙의 클래스와 `title=` 을 한 정규식에 묶어 자리까지 본다.

## A7-A. V1 V / Trace Matrix

- V mode 판정: **Baseline V** — `INDEX.md` 에 이 표면을 다루는 기존 handoff 가 없고 상속할 V node 가 없다.
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: **R** — 사용자가 관측하는 결과 3건이 모두 바뀐다. 아래로 SD·AR·MD 전 층을 포함한다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 스피너 교체 (3 소비자) | NEW | — |
| R-02 | R | §7 성능 — 리렌더 0 · 마크 7개 | NEW | — |
| R-03 | R | §7 프레임 등가 | NEW | — |
| R-04 | R | §7 테마 · 감속 모션 | NEW | — |
| R-05 | R | §7 첨부 카드 제거 | NEW | — |
| R-06 | R | §7 지침 카드 확장 | NEW | — |
| R-07 | R | §7 사용량 추정치 안내 | NEW | — |
| AT-01…AT-20 | AT | §7 각 행 | NEW | — |
| SD-01 | SD | §5·§9 — 스피너 진행이 CSS 트랙만으로 일어나고 React 상태를 거치지 않는다 | NEW | — |
| SD-02 | SD | §5·§9 — 프로젝트 랜딩 우측 컬럼의 카드 스택 수명 | NEW | — |
| AR-01 | AR | §10 EP-02 — `sparkFrames.ts` 트랙 클래스 ↔ `app.css` `@utility` 사본 2곳 | NEW | — |
| AR-02 | AR | §10 EP-03 — 감속 모션 열거가 트랙 전수를 덮는다 | NEW | — |
| AR-03 | AR | §10 EP-04 — `Meter.title` producer(호출부) ↔ consumer(트랙 DOM) | NEW | — |
| AR-04 | AR | §10 EP-05·EP-06 — i18n ko/en 두 사본과 제거 지점 전수 | NEW | — |
| MD-01 | MD | §11 — `scaleAtFrame`/`shapeAtFrame` 인코딩 불변식 | NEW | — |
| MD-02 | MD | §11 — 지침 카드 본문 파생(clamp 제거 + min-h) | NEW | — |
| ST-01 · IT-01…IT-04 · UT-01·UT-02 | ST/IT/UT | 아래 pair | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `PendingAssistant:71 → StatusLine → SparkSpinner` | `statusLine.render.test.ts` — `<svg` 1 · 옛 글리프 0 · 상태 문구 동반 | not selected — 렌더 출력을 직접 본다 | EP-01 (3) |
| VP-02 | R-01 ↔ AT-02 | REQUIRED | 세 소비자 → 같은 `StatusLine` | `rg '<StatusLine'` = 3 + 분기 부재 | not selected — 호출부 전수를 직접 센다 | EP-01 (3) |
| VP-03 | R-02 ↔ AT-03 | REQUIRED | 턴 진행 → `StatusLine` 렌더 | `StatusLine.tsx` 원문 0건 + `useElapsed` 양성 짝 | **required** — 음성 스윕이라 방향을 따로 본다. 심을 결함: `setInterval` 재도입 | EP-01 (3) |
| VP-04 | R-02 ↔ AT-04 | REQUIRED | 같은 경로 | 렌더 출력의 `<line>`/`<text>`/`<circle>`/`<svg>` 개수 등호 | not selected — 출력 노드를 직접 센다 | EP-01 (3) |
| VP-05 | R-03 ↔ AT-05 | REQUIRED | `SPARK_*` → `SparkSpinner` 클래스 → `app.css` 트랙 | `sparkFrames.test.ts` — 240/240 전건 대조 | not selected — 전사본과 직접 비교한다 | EP-02 (8) |
| VP-06 | MD-01 ↔ UT-01 | REQUIRED | 같은 | 위 + 구조 단언(dot 인덱스 10 · 런 시퀀스 · 세그먼트 동일성) | **required** — 등가 단언의 민감도를 입증해야 한다. 심을 결함: `SPARK_SEGMENT_PHASE` ±1 | EP-02 (8) |
| VP-07 | AR-01 ↔ IT-01 | REQUIRED | `sparkFrames.ts` 상수 → `app.css` 원문 | `sparkCss.test.ts` — duration·steps 대조 | **required** — 사본 동기화라 배선을 직접 못 본다. 심을 결함: `app.css` duration 을 720→700 | EP-02 (8) |
| VP-08 | AR-02 ↔ IT-02 | REQUIRED | 트랙 클래스 8 → 감속 모션 블록 | `sparkCss.test.ts` — 차집합 0 | **required** — 0건 주장이라 방향을 본다. 심을 결함: 열거에서 `animate-spark-g3` 제거 | EP-03 (8) |
| VP-09 | R-04 ↔ AT-09 | REQUIRED | `StatusLine` → `SparkSpinner` | `SparkSpinner.tsx` raw hex 0 + `currentColor` 양성 짝 | not selected — 원문을 직접 본다 | EP-01 (3) |
| VP-10 | R-05 ↔ AT-10 | REQUIRED | `ProjectLandingPage:91 → ProjectInstructionsSidebar` | `rg` 차집합 0 + 지침 카드 렌더 양성 짝 | **required** — 0건 주장. 심을 결함: `ProjectFilesCard` import 복원 | EP-06 (6) |
| VP-11 | R-05 ↔ AT-11 | REQUIRED | `shared/ui/mock.ts` | 파일·export 존재 | not selected — 존재를 직접 본다 | EP-06 (6) |
| VP-12 | SD-02 ↔ ST-01 | REQUIRED | 랜딩 → 사이드바 → 카드 스택 | 사이드바 렌더 출력에 카드 1개 · 첨부 드롭존 0 | not selected — 출력을 직접 본다 | EP-06 (6) |
| VP-13 | R-06 ↔ AT-12 | REQUIRED | 사이드바 → `ProjectInstructionsCard` → `SidebarCard.bodyClassName` | `instructionsCard.render.test.ts` — clamp 0 + 전문 + `min-h-[280px]` | not selected — 출력을 직접 본다 | EP-08 (1) |
| VP-14 | MD-02 ↔ UT-02 | REQUIRED | 같은 | 빈 지침/긴 지침 두 분기 | not selected — 분기 출력을 직접 본다 | EP-08 (1) |
| VP-15 | R-06 ↔ AT-13 | REGRESSION | `ProjectLandingPage:79 → Composer` | 기존 `CwdPanel.landing.test.ts` | not selected — 기존 케이스가 원문을 본다 | EP-07 (3) |
| VP-16 | AR-04 ↔ IT-03 | REGRESSION | ko/en 두 카탈로그 | 기존 `resources.test.ts` 패리티 | not selected — 기존 케이스가 두 사본을 본다 | EP-05 (4) |
| VP-17 | R-07 ↔ AT-15 | REQUIRED | `ProviderUsageTab:90 → LimitBarsSection → LimitBarRow → Meter` | `usageTooltip.render.test.ts` — `title=` 2건 + 트랙 자리 정규식 | not selected — 자리까지 직접 본다 | EP-04 (2) |
| VP-18 | R-07 ↔ AT-16 | REQUIRED | `UsageTab:183 → ModelUsageList → Meter` | 같은 파일 — 모델 수만큼 `title=` | not selected — 직접 센다 | EP-04 (2) |
| VP-19 | R-07 ↔ AT-17 | REQUIRED | `TokensPerDayChart:84 → UsageTooltip` | 같은 파일 — 문구 + 날짜·토큰·비용 동반, `active=false` → `null` | not selected — 출력을 직접 본다 | EP-04 (2) |
| VP-20 | AR-03 ↔ IT-04 | REQUIRED | `Meter.title` prop → 트랙 `div` | `title` 미전달 시 0건 | **required** — 0건 주장. 심을 결함: `title` prop 을 트랙 대신 내부 바에 걸기 | EP-04 (2) |
| VP-21 | R-07 ↔ AT-19 | REQUIRED | `Composer → UsagePanel` | 출력에 `title=` 0 + 막대 2개 양성 짝 | not selected — 출력을 직접 본다 | EP-04 (2) |
| VP-22 | R-01·R-06·R-07 ↔ AT-20 | REQUIRED | 실행 중인 앱 | **사람 실기** | not selected — 시각·OS 폰트라 기계 oracle 이 없다 | 0 — 실기 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app/**` subtree — ABI 중립 정적 게이트 | renderer TS/TSX/CSS 를 고친다 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| `app/**` — 관련 순수 vitest | 신설 테스트 6종 + 기존 회귀 2종이 전부 비-DB 다 | `./node_modules/.bin/vitest run src/renderer/src/shared src/renderer/src/features/{chat,settings,projects}` | 같음 |
| repository — 문서 인벤토리 | `docs/**` 를 고친다 | `node app/scripts/check-doc-inventory.mjs --check` | 같음 |
| message-bus — 커밋 trailer | 설계·구현 2커밋을 만든다 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

> egress 차단 환경의 better-sqlite3 DB 로드 스위트 실패(`app/AGENTS.md` 실측 5파일)는 **알려진 기준선**이며 이번 변경과 무관하다 — 새 blocking 범위로 만들지 않는다.

---

# Appendix A.2 — V1 Technical Design (history)

## A8. V1 Research — 당시 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 대기 스피너는 SVG 가 아니라 **유니코드 글리프 6종 + 200ms `setInterval`** 이다 | `StatusLine.tsx:9,24,57,67-73,122-127` |
| 감속 모션 처리는 **2-span 패턴**(애니메이션 span `motion-reduce:hidden` + 정적 `✦` span `motion-reduce:inline`) | 같은 파일 `:122-127` |
| `StatusLine` 은 chat 전용이지만 소비자가 **transcript 밖에도 2곳** 있다 | `PendingAssistant.tsx:71` · `TaskTileContent.tsx:279` · `SubAgentTileContent.tsx:159` |
| 아이콘 관례는 **중앙 path 레지스트리**(Material Outlined w400, `viewBox="0 -960 960 960"`, 단일 fill path) | `Icon.tsx:58-60` |
| 멀티패스·stroke 마크의 탈출구는 **`shared/ui/` 인라인 컴포넌트** | `OrcaLogo.tsx` · 삭제 전 `FileDropIllustration.tsx:1-3` 주석 |
| 커스텀 애니메이션의 자리는 `app.css` 의 `@utility` 블록이고 셋 다 감속 모션 폴백을 갖는다 | `app.css` `epitaxy-shine`(:111) · `tile-in`(:142) · `status-beacon`(:165) |
| `--color-rust` 는 **테마마다 다르다** — light `#c96442` · dark `#d97757` | `tokens.css:21` · `:194` |
| 파일 카드는 **props·state·핸들러가 전부 없다** — `onAdd` 미전달이 `+` 버튼을 비활성화한다 | 삭제 전 `ProjectFilesCard.tsx` 전체 · `SidebarCard.tsx:21` |
| 우측 컬럼에 **높이 클래스가 하나도 없다** | `ProjectLandingPage.tsx:90`(`min-w-0 xl:col-span-2`) · `ProjectInstructionsSidebar.tsx:24`(`flex flex-col gap-4`) · `SidebarCard.tsx:23` |
| 일별 토큰 차트에는 **이미 recharts 툴팁**이 있고 Orca 패널 토큰으로 직접 그린다 | `TokensPerDayChart.tsx:19-39,82-86` |
| `Meter` 에는 `title`·`role`·hover 가 **전무**하다 | `Meter.tsx:29-36` |
| 저장소에 **`Tooltip` 컴포넌트·라이브러리가 없다** | `shared/ui/` 목록 — `Popover`·`FloatingPanel`·`Modal` 은 클릭 구동 |
| SVG 그래픽의 hover 텍스트 선례는 `title?: string` prop → `<title>` 자식 | `UsageCircle.tsx:21,49` |
| vitest 는 `.tsx` 테스트를 **잡지 않는다**(`include: src/**/*.test.ts`) → JSX 없이 `createElement` | `vitest.config.ts` · `gitRow.render.test.ts:1-27` |
| `useI18n` 은 모듈 임포트 시 **동기 초기화**라 Provider 없이 렌더된다 | `shared/i18n/index.ts:11-21` · `diffTile.render.test.ts` 가 `useI18n` 소비 컴포넌트를 렌더 |
| 프로젝트 파일 첨부는 **RAG 지식베이스까지 의도적 유예**다 | `docs/handoff/0039-attachment-thumbnails/plan.md:20` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `StatusLine` 렌더 지점 | `rg '<StatusLine' --include=*.tsx` | 3 | D-002 의 분모. `ConversationStatusLine`·`StatusPopover` 는 이름만 겹치는 별개다 |
| 원본 스트립 프레임 | 업로드 파일 파싱 | 241 | frame 240 = frame 0 (루프 닫는 중복) → **실주기 240** |
| 원본 `<use>` 프레임 | `grep -c '<use href="#ten-spoked"/>'` | 116 | × 10 `<line>` = **1160 노드** |
| 원본 `<text>` 프레임 | `grep -c 'class="spark-text"'` | 115 | 폰트 의존 프레임 (전체의 48%) |
| 원본 `<circle>` 프레임 | `grep -c '<circle cx="50"'` | 10 | dot |
| 원본 인스턴스당 노드 | 1160 + 115 + 10 + 래퍼 482 | **≈1767** | 3곳 동시 ≈ **5301** → D-003 |
| 고유 마크 | 파싱 | **7** | `spoke·dot·✢·✳︎·✶·✻·✽` → 마크 7개 형태의 근거 |
| dot 프레임 인덱스 | 파싱 | 10건 | `10,34,58,82,106,130,154,178,202,226` — **간격 전부 24** |
| dot~dot 세그먼트 scale | 파싱 후 `set()` | **1** | 9개 세그먼트가 완전히 동일 → 단일 `spark-pulse` 트랙의 근거 |
| `LimitBarsSection` 소비자 | `rg 'LimitBarsSection' --include=*.tsx` | **1** | `ProviderUsageTab.tsx:90` 뿐 — `UsagePanel` 은 쓰지 않는다 |
| `Meter` 렌더 지점 | `rg '<Meter' --include=*.tsx` | 4 | `UsagePanel` 2(범위 밖) · `UsageLimitViews` 1 · `UsageTab` 1 |
| `SidebarCard` 소비자(제거 후) | `rg 'SidebarCard' --include=*.tsx` | **1** | `ProjectInstructionsCard` — 파일은 유지 |
| `DISABLED_HATCH_CLASS` 소비자(제거 후) | `rg 'DISABLED_HATCH_CLASS'` | **0** | 정의만 남는다 → D-009 |
| `filesCard` 관련 잔여 | `rg 'filesCard|FileDropIllustration|ProjectFilesCard'` | **1** | `SparkSpinner.tsx:7` 주석 → §10 EP-07 에서 정리 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 프레임 241 → 실주기 **240**(frame 240 == frame 0 을 파싱으로 확인). 노드 1160+115+10+482 = **1767** (내역 합 = 총계).
- 세그먼트 위상: frame 0 이 세그먼트 index **13** → `animation-delay: -13 × 30ms = -390ms`. `SPARK_FRAME_MS = 7200/240 = 30` 으로 검산.
- "모든 세그먼트가 동일하다"(전칭): 9개 세그먼트 튜플을 `set()` 에 넣어 크기 **1** 로 확인 — 반례 0.
- "`UsagePanel` 이 `LimitBarRow` 를 공유한다"(조사 초안의 전칭): **반례 확인** — `UsagePanel.tsx:48,90` 은 `Meter` 를 직접 부른다. 초안 정정.
- 문서 앵커: `dom-architecture.md §Mock UI marker (0010)` 실재(`:155`) · `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 실재.
- 기존 테스트 케이스: `CwdPanel.landing.test.ts:21,36-40` 실재 · `resources.test.ts:33` 실재.

## A9. V1 Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `SD-02`, `AR-03`
- 현재 책임 소유자: 스피너 프레임 = `StatusLine` 의 `useState`+`setInterval` · 우측 카드 스택 = `ProjectInstructionsSidebar` · 사용량 막대 시각 = `Meter`
- 현재 entry → flow → state → consumer: 턴 시작이 `turnStartedAt` 을 세우면 `StatusLine` 이 200ms 타이머를 걸고 `symbolIdx` 를 돌린다 → 매 틱 컴포넌트 전체가 리렌더된다 → 글리프 span 이 바뀐다.
- 현재 오류/취소/정리 경로: `turnStartedAt` 이 null 이 되면 effect cleanup 이 `clearInterval` 하고 컴포넌트가 `null` 을 반환한다.
- 문제의 직접 원인: **프레임 진행이 React 상태 축에 있다.** 초당 5회 리렌더가 transcript 에서 일어나고, 표시 정보(경과 초)는 초 단위로만 바뀌는데 그 파생이 200ms 마다 재평가된다(`:80` 주석이 그 사실을 인정한다).

```text
setInterval(200ms) → setState(symbolIdx) → StatusLine 전체 리렌더 → <span>{SYMBOLS[i]}</span>
ProjectInstructionsSidebar → [ProjectInstructionsCard(line-clamp-3), ProjectFilesCard(동작 0)]
Meter(ratio, tone) → <div class="track"><div class="bar"/></div>   ← title 없음
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `SD-02`, `AR-01`~`AR-04`, `MD-01`, `MD-02`
- 변경 후 책임 소유자: 프레임 진행 = **`app.css` 의 `spark-*` 트랙**(브라우저 애니메이션) · 프레임 데이터 = `shared/ui/sparkFrames.ts` · 마크 그리기 = `shared/ui/SparkSpinner.tsx` · 나머지는 그대로.
- 변경 후 entry → flow → state → consumer: `turnStartedAt` 이 서면 `StatusLine` 이 `SparkSpinner` 를 **한 번** 마운트한다 → 이후 프레임 진행에 React 가 개입하지 않는다 → 리렌더는 `useElapsed` 의 1초 틱만 남는다.
- 변경 후 오류/취소/정리 경로: 언마운트가 곧 애니메이션 종료다 — `clearInterval` 대상이 사라진다.
- 유지하는 기존 메커니즘: `useElapsed` 1초 틱 · `aria-live`/`aria-label` · `deriveActivityLabel` · `SidebarCard` 셸과 `bodyClassName` prop · recharts `Tooltip content=` · 네이티브 `title=` 관례.
- 제거/대체하는 메커니즘: `SYMBOLS`+`setInterval`+`symbolIdx`(삭제) · `motion-reduce` 2-span(→ `app.css` 폴백으로 대체) · `ProjectFilesCard`+`FileDropIllustration`(삭제) · `line-clamp-3`(삭제).

```text
app.css spark-pulse(720ms) ─┐
app.css spark-dot(720ms)   ─┼→ SparkSpinner: <g pulse>[spoke(10 line) · circle · text×5]</g>
app.css spark-spoke/g1..g5 ─┘        ↑ StatusLine 이 text-rust 만 준다 (currentColor)
ProjectInstructionsSidebar → [ProjectInstructionsCard(min-h-[280px] overflow-y-auto)]
Meter(ratio, tone, title) → <div class="track" title={...}><div class="bar"/></div>
                              ↑ LimitBarRow · ModelUsageList 가 tr('usage.estimateNote')
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 프레임 진행 소유권 | `StatusLine` 의 React 상태 | `app.css` 트랙 (브라우저) | D-003 — 리렌더 0 | `SD-01` / VP-03·VP-04 · `StatusLine.tsx`·`app.css` |
| 프레임 데이터 | 글리프 배열 6개 | `sparkFrames.ts` 인코딩(세그먼트 24 + 구간) | D-001·D-004 | `MD-01` / VP-05·VP-06 · `sparkFrames.ts` |
| 마크 렌더 | 글리프 2-span | `SparkSpinner` 마크 7개 (~19 노드) | D-003 — 스트립 1767 노드 회피 | `AR-01` / VP-04·VP-07 · `SparkSpinner.tsx` |
| 감속 모션 | 컴포넌트의 2-span 토글 | `app.css` 의 `prefers-reduced-motion` 블록 | D-006 — 애니메이션과 폴백이 한 자리 | `AR-02` / VP-08 · `app.css` |
| 색 | `text-rust` (유지) | `text-rust` (유지) — SVG 는 색을 지정하지 않는다 | D-005 — 원본의 dark 값 하드코딩을 받지 않는다 | `R-04` / VP-09 |
| 우측 카드 스택 | 지침 + 파일(동작 0) | 지침만 | D-008 | `SD-02` / VP-10·VP-12 · `ProjectInstructionsSidebar.tsx` |
| 지침 본문 | `line-clamp-3` (content 높이) | `min-h-[280px] overflow-y-auto` | D-010·D-011 | `MD-02` / VP-13·VP-14 · `ProjectInstructionsCard.tsx` |
| 사용량 막대 hover | 없음 | 트랙 `div` 의 `title` | D-013·D-014 | `AR-03` / VP-17·VP-18·VP-20 · `Meter.tsx` 외 2 |
| 일별 차트 툴팁 | 날짜·토큰·비용 | + 추정치 안내 줄 | D-013 — 기존 패널 재사용 | `R-07` / VP-19 · `TokensPerDayChart.tsx` |
| test seam | 없음(대상 6종 전부 0건) | props-only 렌더 + 원문 대조 | 순수 로직을 사람 실기로 내리지 않는다 | 전 pair / 신설 테스트 4파일 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/ui/sparkFrames.ts` | 프레임 인코딩과 트랙 상수의 SSOT. 도메인 0 | 없음 → 상수 · `scaleAtFrame`·`shapeAtFrame` | `SparkSpinner`, 두 테스트 |
| `shared/ui/SparkSpinner.tsx` | 마크 7개를 한 번 그린다. 애니메이션은 클래스만 | `className?` → `<svg>` | `features/chat/.../StatusLine` |
| `styles/app.css` | 트랙 8개 + 감속 모션 폴백 | — | Tailwind 빌드 |
| `features/chat/.../StatusLine.tsx` | 대기 표시 조립. 스피너 크기·색만 지정 | props → `<span>` | 세 소비자 |
| `shared/ui/Meter.tsx` | 선형 바 + 선택적 네이티브 툴팁. **문구는 모른다** | `ratio·tone·className·title?` → `<div>` | 4 렌더 지점 |
| `features/settings/.../UsageLimitViews.tsx` · `UsageTab.tsx` | `tr('usage.estimateNote')` 를 `Meter` 에 넘긴다 | — | 설정 탭 |
| `features/projects/.../ProjectInstructionsCard.tsx` | 지침 본문 파생 + 카드 본문 높이 | `instructions·onEdit` → `<SidebarCard>` | 사이드바 |

## A10. V1 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| `R-01`/VP-01·VP-02·VP-03·VP-04·VP-09 | **EP-01** — 새 스피너가 세 소비자 전부에 도달하고 옛 루프가 남지 않는다 | `StatusLine.tsx` | 구현자 | `PendingAssistant:71` · `TaskTileContent:279` · `SubAgentTileContent:159` **(3)** | 한 소비자만 고치면 나머지 둘에 옛 글리프가 남는다. 세 곳이 같은 컴포넌트를 부르므로 분기를 만들지 않는 것이 강제 방법이다 |
| `AR-01`/VP-05·VP-06·VP-07 | **EP-02** — 트랙 클래스 이름이 TS 와 CSS 두 사본에서 같다 | `sparkFrames.ts` `SPARK_PULSE_CLASS`+`SPARK_TRACK_CLASS` | 구현자 | `@utility animate-spark-{pulse,dot,spoke,g1,g2,g3,g4,g5}` **(8)** | 이름이 어긋나면 그 마크는 **애니메이션 없이 항상 보인다** — 화면에 마크 두 개가 겹쳐 보인다. lint·typecheck 는 문자열이라 잡지 못한다 → `sparkCss.test.ts` 가 유일한 게이트다 |
| `AR-02`/VP-08 | **EP-03** — 감속 모션 블록이 트랙 전수를 덮는다 | `app.css` `prefers-reduced-motion` 블록 | 구현자 | 같은 8 클래스 **(8)** | 빠진 트랙만 계속 돈다 — 감속 모션 사용자에게 부분 애니메이션이 남는다. **총계가 아니라 차집합으로 센다** |
| `AR-03`/VP-17·VP-18·VP-20·VP-21 | **EP-04** — 안내 문구를 `Meter` 트랙에 거는 호출부 | `usage.estimateNote` | 구현자 | `UsageLimitViews.tsx` `LimitBarRow` 1 · `UsageTab.tsx` `ModelUsageList` 1 **(2 코드 지점 / 렌더 3+N)** | 한 곳만 걸면 나머지 막대는 안내가 없다. `UsagePanel` 2 지점은 D-013 으로 **의도적 제외**이고 VP-21 이 그것을 양성/음성 짝으로 잠근다 |
| `AR-04`/VP-16 | **EP-05** — i18n 키 변경이 두 카탈로그에 함께 간다 | `resources/ko.ts` | 구현자 | `ko.ts` 추가 1 · `en.ts` 추가 1 · `ko.ts` 삭제 1블록 · `en.ts` 삭제 1블록 **(4)** | 한쪽만 고치면 `en.ts` 가 `typeof ko` 라 **컴파일 에러**다. 그래서 typecheck 가 1차 게이트이고 `resources.test.ts` 가 빈 값·placeholder 축을 덮는다 |
| `R-05`/VP-10·VP-11·VP-12 | **EP-06** — 첨부 카드가 남는 자리 전수 | `ProjectInstructionsSidebar.tsx` | 구현자 | import 1 · 렌더 1 · `ProjectFilesCard.tsx` · `FileDropIllustration.tsx` · `ko.ts` 블록 · `en.ts` 블록 **(6)** | 파일만 지우고 import 를 남기면 빌드가 깨지고, 렌더만 지우면 죽은 파일이 남는다. i18n 을 남기면 아무도 안 보는 키가 쌓인다 |
| 문서 사본/VP-15 | **EP-07** — 제거 사실을 서술하는 문서·주석 사본 | 코드 | 구현자 | `dom-architecture.md:157` 소비자 예시 · `ProjectLandingPage.tsx:22` 레이아웃 주석 · `SparkSpinner.tsx:7` 의 `FileDropIllustration` 참조 **(3)** | 사본이 갈라져 다음 세션이 없는 파일을 찾는다. 기계 게이트가 없어 **전수 grep 이 유일한 방법**이다 |
| `MD-02`/VP-13·VP-14 | **EP-08** — 본문 높이·잘림을 정하는 지점 | `ProjectInstructionsCard.tsx` | 구현자 | `SidebarCard.bodyClassName` 전달 **(1)** | `min-h` 만 주고 `line-clamp-3` 을 남기면 카드는 커지고 본문은 3줄이라 빈 공간만 생긴다 — D-010·D-011 이 함께 성립해야 한다 |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 공유 방법: **트랙 이름과 타이밍이 TS↔CSS 두 사본에 산다.** 타입으로 묶을 수 없어(CSS 는 문자열) `sparkFrames.ts` 를 SSOT 로 두고 `sparkCss.test.ts` 가 `app.css` **원문을 읽어** 대조한다 — 선례는 `CwdPanel.landing.test.ts:21` 이 `.tsx` 원문을 읽는 방식이다.
- `실패 의미` 에 "다른 게이트가 막는다"를 적은 행: **EP-05 하나**. 이 턴에 측정했다 — `en.ts` 는 `export const en: typeof ko` 로 선언돼 키를 한쪽만 지우면 `typecheck:web` 이 error 를 낸다. 다만 typecheck 는 **빈 문자열·placeholder 불일치는 보지 못하므로** 그 축은 `resources.test.ts` 가 따로 덮는다. 두 게이트의 합이 EP-05 의 4지점을 덮는다.
- 선택적 필드의 `true/false/undefined` 의미: `Meter.title?: string` — `undefined` 는 **툴팁 없음**이고 `title` 속성 자체가 DOM 에 나타나지 않는다(React 가 `undefined` 속성을 생략). 빈 문자열은 쓰지 않는다(브라우저가 빈 툴팁을 띄운다). VP-20 이 `undefined` 경로를 잠근다.
- 외부 SDK 경계의 실제 요구 타입/의미: recharts `Tooltip content` 는 `active?: boolean` 과 `payload?: Array<{payload?: T}>` 를 주입한다 — 기존 `UsageTooltip:19-29` 의 시그니처를 그대로 유지하고 본문 줄만 더한다. 새 SDK 계약 없음.

## A11. V1 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/ui/sparkFrames.ts` **(신규)** | 프레임 인코딩 + 트랙 상수 SSOT | `SparkShape` union 7 · `SPARK_TOTAL_FRAMES`/`PERIOD_MS`/`FRAME_MS`/`SEGMENT_FRAMES`/`SEGMENT_MS`/`SEGMENT_PHASE`/`SEGMENT_DELAY_MS` · `SPARK_SEGMENT_SCALES`(24) · `SPARK_SHAPE_WINDOWS` · `SPARK_PULSE_CLASS`·`SPARK_TRACK_CLASS` · `scaleAtFrame`·`shapeAtFrame` | 순수 단위 — electron·DOM 의존 0 |
| `shared/ui/SparkSpinner.tsx` **(신규)** | 마크 7개 렌더 | `<svg 18×18 viewBox="0 0 100 100" aria-hidden>` → pulse `<g>` → spoke `<g>`(10 `<line>`, 고유 `scale(0.74)` 유지) · `<circle r=6.8>` · `<text>`×5 | props-only 렌더(`className?` 하나) |
| `styles/app.css` | 트랙 8개 + 감속 모션 | `@keyframes spark-pulse`(24 stop, 720ms `step-end`, delay `-390ms`, `transform-box: view-box`) · `spark-dot`(720ms) · `spark-spoke`(11 stop, 7200ms) · `spark-g1`~`g5`(3 stop, 7200ms) · 8클래스 감속 폴백 | 원문 대조 |
| `features/chat/.../StatusLine.tsx` | 대기 표시 조립 | `SYMBOLS`·`SYMBOL_INTERVAL_MS`·`symbolIdx`·심볼 `useEffect` 삭제 · 2-span → `<SparkSpinner className="shrink-0 text-rust" />` · `useState` import 정리 · `:80` 주석 정정 | 렌더(`useI18n` 동기 초기화라 Provider 불필요) |
| `features/projects/.../ProjectInstructionsSidebar.tsx` | 카드 스택 | `ProjectFilesCard` import·렌더 삭제 · 헤더 주석 정정 | 렌더 |
| `features/projects/.../ProjectInstructionsCard.tsx` | 지침 본문 | `bodyClassName="min-h-[280px] overflow-y-auto"` 전달 · 본문 `line-clamp-3` 삭제 · 유도 주석 | props-only 렌더 |
| `features/projects/.../ProjectFilesCard.tsx` **(삭제)** | — | — | — |
| `features/projects/.../FileDropIllustration.tsx` **(삭제)** | — | — | — |
| `shared/ui/Meter.tsx` | 선형 바 | `title?: string` prop 추가 → 트랙 `div` 에 `title={title}` | props-only 렌더 |
| `features/settings/.../UsageLimitViews.tsx` | 주간/월간 행 | `LimitBarRow` 의 `<Meter>` 에 `title={tr('usage.estimateNote')}` | `LimitBarsSection` 렌더(이미 export) |
| `features/settings/.../UsageTab.tsx` | 모델별 내역 | 같은 prop 전달 · `ModelUsageList` **export** (테스트 진입) | 렌더 |
| `features/settings/.../TokensPerDayChart.tsx` | 차트 툴팁 | `UsageTooltip` 이 `useI18n` 으로 `tr` 을 얻어 안내 줄을 추가 · **export** (테스트 진입) | 렌더 |
| `shared/i18n/resources/{ko,en}.ts` | 문구 | `usage.estimateNote` 추가 · `projects.filesCard` 블록 삭제 (양쪽 동시) | 기존 `resources.test.ts` |
| `shared/ui/sparkFrames.test.ts` **(신규)** | 240/240 등가 + 구조 + 위상 민감도 | 전사본 240행을 이 파일이 소유한다 | — |
| `shared/ui/sparkCss.test.ts` **(신규)** | TS↔CSS 사본 대조 | `app.css` 원문 읽기 | — |
| `features/chat/.../statusLine.render.test.ts` **(신규)** | 스피너 배선 + 노드 수 + 옛 루프 부재 | — | — |
| `features/projects/.../instructionsCard.render.test.ts` **(신규)** | clamp 부재 + `min-h` + 두 분기 | — | — |
| `features/settings/.../usageTooltip.render.test.ts` **(신규)** | 3곳 문구 + 자리 + 범위 밖 0건 | — | — |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: 불필요 — 대상 6종 전부 renderer 프레젠테이션이라 native 를 로드하지 않는다. `sparkFrames.ts` 는 React 조차 import 하지 않는 **완전 순수 모듈**이라 인코딩 단언이 컴포넌트와 무관하게 선다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `renderToStaticMarkup` 은 effect 를 실행하지 않는다 — `StatusLine` 의 남은 상태는 `useMemo`·`useElapsed` 의 초기값뿐이라 SSR 스냅샷으로 충분하다. 반대로 **애니메이션 자체는 SSR 로 관측할 수 없어** 클래스 이름 존재로만 잠그고, 그 클래스가 실제 트랙을 갖는지는 `sparkCss.test.ts` 가 CSS 쪽에서 잠근다 — 두 테스트가 합쳐져야 배선이 닫힌다.
- 순서를 관측할 훅/로그/주입 경계: 프레임 **순서**는 런타임이 아니라 데이터로 관측한다 — `scaleAtFrame`/`shapeAtFrame` 이 인덱스 함수라 240 프레임을 시간 없이 전건 비교할 수 있다. 브라우저 타이밍을 흉내 내지 않는 것이 이 설계의 요점이다.

## A12. V1 End-to-end 영향

### producer → consumer

```text
[스피너] sparkFrames 상수 → SparkSpinner 클래스 → app.css 트랙 → 브라우저 애니메이션 → 화면
[안내]   ko/en 카탈로그 → useI18n().tr → LimitBarRow·ModelUsageList·UsageTooltip → title/패널 → 호버
[지침]   projectsStore.list → ProjectInstructionsSidebar → ProjectInstructionsCard → SidebarCard body
```

- producer 기준: 프레임 데이터는 `sparkFrames.ts` 가, 문구는 i18n 카탈로그가 **단독 소유**한다. 컴포넌트는 어느 쪽도 지어내지 않는다.
- consumer 파생 규칙: `SparkSpinner` 는 클래스 이름만 소비하고 타이밍을 다시 계산하지 않는다. `Meter` 는 문구를 받기만 하고 만들지 않는다(shared 레이어의 도메인 0 규칙).
- 파생 가능한 합성값이 정본을 우회하지 않는가: **우회 가능성 1건** — `SparkSpinner` 가 `scaleAtFrame` 을 직접 불러 인라인 style 로 스케일을 그릴 수도 있지만, 그러면 프레임 진행이 다시 JS 로 올라와 D-003 을 깬다. 설계상 컴포넌트는 두 함수를 **부르지 않는다**(테스트만 부른다).

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음 — 부팅 시퀀스·레지스트리·스토어 값을 늘리지 않는다. 신규 모듈 2개는 렌더 트리에서만 참조된다.

## A13. V1 Lifecycle / 오류 / 정리

- 생성/시작: `turnStartedAt` 이 non-null 이 되면 `StatusLine` 이 `SparkSpinner` 를 마운트한다. 트랙 8개가 같은 시점에 시작하므로 서로 위상이 맞는다.
- 취소/중단: `turnStartedAt` → null 이면 `StatusLine:99` 가 `null` 을 반환해 통째로 언마운트된다 — 애니메이션도 함께 사라진다(`clearInterval` 대상 없음).
- 종료/quit/crash/renderer-gone: CSS 애니메이션은 렌더러 수명에 묶여 별도 정리가 없다. **AS-IS 대비 정리 대상이 하나 줄었다.**
- retry/timeout/partial failure: 해당 없음 — 세 변경 모두 I/O 를 하지 않는다.
- cleanup/rollback: 해당 없음.
- **다중 저장소 쓰기**: 코드 저장소는 없다. **문서·사본 축은 있다** — (a) 트랙 이름·타이밍이 `sparkFrames.ts` 와 `app.css` **두 곳**에 산다(EP-02·EP-03), (b) i18n 문구가 `ko.ts`·`en.ts` **두 곳**에 산다(EP-05), (c) 제거 사실이 코드와 문서 주석 **세 곳**에 산다(EP-07), (d) 이 handoff 의 판정·상태가 `plan.md` 와 `INDEX.md` **두 곳**에 산다. 한쪽만 갱신하면 두 사본이 서로 다른 말을 한다. (a)는 `sparkCss.test.ts`, (b)는 typecheck+`resources.test.ts` 가 기계로 막고, **(c)·(d)는 기계 게이트가 없어 §10 강제 지점의 전수 grep 과 마무리 절차가 유일한 방법**이다.

## A14. V1 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: SVG 노드 = **마크 7종 × 인스턴스 3** = `<line> 10 + <text> 5 + <circle> 1 + <svg> 1 + 래퍼 2` ≈ **19/인스턴스 · 57 최악**. AS-IS 스트립 인라인 대비 **93배 감소**(1767 → 19).
- 새 요청 수: **0** — 네트워크·IPC 를 추가하지 않는다.
- 구조적 목표의 달성 가능성: D-003 이 요구하는 것은 "저하 없음"이고, 실제 결과는 **개선**이다 — 리렌더가 초당 5회에서 0회로 내려가고(경과 초 1회 틱만 잔존) 애니메이션이 브라우저 축으로 내려간다. CSS 키프레임은 `app.css` 에서 **전역 1회 파싱**이라 인스턴스 수와 무관하다.
- 캐시/snapshot/호출 축소로 잃는 부수 효과: **1건** — 200ms 리렌더가 부수적으로 제공하던 "표시 파생의 잦은 재평가"가 사라진다. 실측상 그 파생(`deriveActivityLabel`)의 입력은 `activity` 와 `elapsedSec` 뿐이고 둘 다 초 단위 이하로 바뀌지 않으므로 **손실 없음**이다 — `StatusLine.tsx:80` 의 기존 주석이 같은 사실을 이미 인정한다. 회귀 테스트는 AT-03 의 양성 짝(`useElapsed` 잔존)이 담당한다.

## A15. V1 외부 구현 포트 / 문서 계약

해당 없음 — 배포·플러그인·외부 구현자가 구현할 port/schema/config 를 만들거나 바꾸지 않는다. `Meter.title` 은 저장소 내부 prop 이다.

## A16. V1 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| raw hex 금지 · 시맨틱 토큰 우선 | `renderer/AGENTS.md §스타일` | §9 Delta "색" 행 · D-005 | **유지** — 원본의 `#d97757` 을 받지 않고 `currentColor` 로 간다 |
| 새 CSS 파일·규칙 추가 금지, Tailwind 유틸로 표현 | 같은 문서 | D-006 · §11 `app.css` 행 | **유지(해석 명시)** — 새 *파일* 을 만들지 않고 기존 `@utility` 블록에 넣는다. `epitaxy-shine`·`status-beacon`·`tile-in` 이 같은 형태의 선례다 |
| 인라인 `style` 은 동적 계산값에만 | 같은 문서 | §12 "우회 가능성" | **유지** — 스케일을 인라인 style 로 쓰지 않는다 |
| 400줄 초과 시 분해 검토 | 같은 문서 | §11 신규 파일 2종 | **유지** — `sparkFrames.ts` ≈60줄 · `SparkSpinner.tsx` ≈70줄. 240행 전사본은 **테스트 파일**이 갖는다 |
| 4-layer 의존 방향 (features → shared) | 같은 문서 · `layers.md §1.1` | §9 책임 분리 표 | **유지** — 신규 2모듈이 `shared/ui/` 이고 `features/chat` 이 그것을 부른다. 역방향 0 |
| `shared/` 에 도메인 로직 금지 | 같은 문서 | D-014 · §10 EP-04 | **유지** — `Meter` 는 문구를 모르고 호출자가 넘긴다 |
| Mock UI marker — 공용 빗금 상수 재사용 | `dom-architecture.md §Mock UI marker (0010)` | D-009 · §10 EP-07 | **유지(예시만 정정)** — 규칙 문장은 그대로 두고 소비자 예시가 사실과 어긋난 부분만 고친다 |
| 프로젝트 파일 첨부는 RAG 도입까지 유예 | `0039-attachment-thumbnails/plan.md:20` | D-008 · §4 | **유지** — 기능이 아니라 그 유예의 *시각적 잔여물* 을 지운다 |
| Icon 은 single-path 규약 | `Icon.tsx:58-60` | D-007 · §8 | **유지** — 멀티마크라 레지스트리에 넣지 않고 인라인 컴포넌트로 간다(`OrcaLogo` 선례) |
| UI 는 시각 검증으로 갈음 | `renderer/AGENTS.md §테스트` | AT-20 · §11 테스트 가능성 | **유지(범위 축소)** — 시각 품질만 사람에게 남기고 노드 수·클래스 열거·문구 자리·프레임 시퀀스는 순수 단언으로 내렸다 |
| 게이트 = `lint && typecheck` (ABI 중립) | `app/AGENTS.md` | §19 | **유지** |

## A17. V1 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| **성능 저하**(사용자 제약 D-003) | 마크 7개 형태로 노드 1767→19, 리렌더 5회/초→0. AT-04 가 노드 개수 등호로 스트립 회귀를 막는다. 순 효과는 개선 |
| 값싼 인코딩이 원본과 미세하게 다름 | AT-05 가 240/240 전건 등가를, AT-06 이 그 단언의 민감도를 잠근다. 증명 실패 시 그 부분만 원본 stop 을 그대로 옮긴다 — 짧은 쪽이 아니라 같은 쪽이 계약이다(D-004) |
| **글리프 5종의 폰트 의존** | 원본 아티팩트의 성질이라 설계로 없애지 않는다. 전체 프레임의 48%가 `<text>` 다. AT-20 의 Windows 실기로 확인하고, 깨지면 5글리프를 path 로 대체하는 후속 handoff 를 연다 |
| TS↔CSS 이름·타이밍 사본이 갈라짐 | `sparkCss.test.ts` 가 원문 대조. lint·typecheck 는 문자열이라 못 잡는다(§10 EP-02 `실패 의미`) |
| `min-h-[280px]` 이 실제 되찾은 공간과 어긋남 | 유도 근거를 코드 주석에 남겼다(3줄 58 + 파일카드 210 + gap 16). 픽셀 정확도는 AT-20 사람 실기 |
| 세 곳 동시 교체로 회귀 표면이 transcript 밖으로 넓음 | 세 소비자가 같은 컴포넌트를 쓰므로 EP-01 이 분기 부재로 강제한다. AT-02 가 호출부 전수를 센다 |
| 문서 사본(EP-07)에 기계 게이트가 없음 | 전수 grep 을 §10 에 지점으로 못박고 구현 보고에 개수를 요구한다 |

- 되돌리기 어려운 결정: `usage.estimateNote` **i18n 키 이름** 하나. 두 카탈로그와 3 호출부에 퍼지므로 지금 확정한다(D-012).
- 신규 의존성: **없음.** recharts·react-dom/server 전부 기존 채택분이다 → 사용자 승인 불필요.

## A18. V1 영향 받는 파일 / 문서

- `app/src/renderer/src/shared/ui/{sparkFrames.ts,SparkSpinner.tsx,Meter.tsx}` (+ 테스트 2)
- `app/src/renderer/src/styles/app.css`
- `app/src/renderer/src/features/chat/components/StatusLine.tsx` (+ 테스트 1)
- `app/src/renderer/src/features/projects/components/{ProjectInstructionsSidebar,ProjectInstructionsCard}.tsx` · **삭제** `{ProjectFilesCard,FileDropIllustration}.tsx` (+ 테스트 1)
- `app/src/renderer/src/features/settings/components/{UsageLimitViews,UsageTab,TokensPerDayChart}.tsx` (+ 테스트 1)
- `app/src/renderer/src/pages/ProjectLandingPage.tsx` (주석)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/arch/frontend/dom-architecture.md` · `docs/handoff/INDEX.md` · 본 문서

## A19. V1 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md §테스트`
- ABI/네트워크 등 환경 제약: egress 차단 시 DB 로드 스위트(실측 5파일)가 red 다 — **알려진 기준선**이며 이번 변경과 무관하다. `npm test` 는 쓰지 않는다(ABI 를 Node 로 뒤집고 DB 동작 검증이 필요 없다).
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`
- 관련 테스트: `./node_modules/.bin/vitest run src/renderer/src/shared src/renderer/src/features/chat src/renderer/src/features/settings src/renderer/src/features/projects` — 신설 6종 + 회귀 `CwdPanel.landing`·`resources`
- 문서 게이트: `node app/scripts/check-doc-inventory.mjs --check` (세는 항목이 IPC 채널·디렉토리 수라 이번 변경으로 값이 바뀌지 않을 것으로 예상 — 실행으로 확인한다)
- 사람 실기: AT-20 의 5건.

## A-READY. V1 self-review (history)

- [x] 여러 턴의 결정이 Decision Ledger에 `ACTIVE/SUPERSEDED/OPEN`으로 보존되어 있다 — D-001~D-014 전부 ACTIVE, 초안의 "스트립 인라인"은 D-003 이 대체(§3 갱신 메모).
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다 — §1·§5·§7 이 구현 파일 없이 완료 상태를 서술한다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — "제거"를 제거로(D-008), "성능 저하 없음"을 노드·리렌더로 조작화하고 그 조작화를 §2 에 추론으로 표시했다.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 상태표 7행이 각각 AT 와 §9 Delta 행을 갖는다.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축으로 작성됐다 — §9 Delta 10행.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일/모듈 또는 AC에 추적 가능하다 — Delta 표의 마지막 칸이 V/파일을 가리킨다.
- [x] AS-IS에서 사라진 책임은 삭제/이동/대체 중 무엇인지 TO-BE에 명시했다 — §9 TO-BE 마지막 두 bullet.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 조사 14행 + 검산 6항. 전칭 반례 1건(`UsagePanel` 공유) 정정.
- [x] 각 AC가 행동 단언, 검증 방법, 프로덕션 도달 경로를 가진다 — §7 표 20행 4칸.
- [x] 상속 기준이 없으면 Baseline V를 사용했고 유효 V를 재구성할 수 있다 — `V1`, 기준 V `none`.
- [x] 변경 효과에 필요한 레벨을 선택했고 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — R 7 · SD 2 · AR 4 · MD 2 전부 pair 보유.
- [x] 영향받은 INHERITED 상위 node는 REGRESSION — VP-15(`CwdPanel.landing`)·VP-16(`resources`) 2건. Baseline V 라 `NOT_REQUIRED` 는 없다.
- [x] 각 pair가 production path, §10 강제 지점 전수, 직접 oracle을 가지며 적대 증거가 필요한 pair만 선택 이유·결함 변이를 갖는다 — 22 pair 중 **6개**(VP-03·06·07·08·10·20)만 `required`, 전부 0건/사본/음성 주장이다.
- [x] 현재 변경 산출물에 적용되는 subtree·repository gate가 열거됐고 관련 없는 기존 실패를 새 blocking 범위로 만들지 않는다 — §7-A 운영 gate 4행 + DB 기준선 분리 명시.
- [x] 사람 실기로 미룬 순수 로직이 없다 — AT-20 은 시각·OS 폰트만. 프레임 시퀀스·노드 수·클래스 열거·문구 자리는 전부 기계 단언.
- [x] semantic 목표를 structural proxy만으로 검증하는 AC가 없다 — AT-04(노드 수)는 구조지만 목표(성능)의 직접 대리이고, 등가라는 semantic 목표는 AT-05 가 별도로 잠근다.
- [x] "X가 쓰인다"를 요구하는 불변식의 검사 장치가 X를 지웠을 때 실패한다 — VP-03·06·07·08·10·20 에 심을 결함을 등록했다. AT-01·AT-10·AT-19 는 음성 술어에 **양성 짝**을 붙여 장치가 침묵으로 통과하지 못하게 했다.
- [x] 정책 파라미터의 단위/범위가 명확하다 — `SPARK_*` 상수에 ms·프레임 단위를 이름과 주석으로 고정. `Meter.title?` 의 `undefined` 의미를 §10 에 적었다.
- [x] 참조 구현 사용 시 계약 union/enum 전수 대비 coverage가 있다 — `SparkShape` 7 멤버 전부가 `SPARK_SHAPE_WINDOWS`·`SPARK_TRACK_CLASS`·`SparkSpinner` 렌더에 등장한다(`Record<SparkShape, …>` 가 타입으로 강제).
- [x] 신규 모듈/계약마다 레이어·강제 지점·테스트 seam이 있다 — §9 책임 분리 · §10 EP-01~08 · §11.
- [x] producer/consumer, 등록자/기존 소비자까지 end-to-end로 닫혔다 — §12. 부팅/등록 변경 없음을 명시.
- [x] 상한·총량·one-way door를 필요한 곳에서 계산했다 — §14 노드 19/57 · one-way door 는 i18n 키 1건(§17).
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 전체 교차검증했고 `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다 — **충돌 0**, 쌍 14건 명시.
- [x] 산출물 문장 규칙을 지켰다 — Part I 은 관측 결과, Part II 는 경로·계약. 노드 수·프레임 수 같은 사실은 Part I 에 결론만, Part II §8 에 측정 근거를 둔다.

---

# Appendix B — V1 r1 구현 기록 (history)

> 이하는 ae27113까지의 V1 구현 증거다. ΔV1 완료 증거로 재사용하지 않으며 다음 구현자는 r2 섹션을 별도로 추가한다.

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 라운드도 같은 이름의 필드를 다시 채운다** — 라운드 표제(`… (r2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §8).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: Part I·Part II 전부. 설계자와 같은 에이전트지만 규범 행(Decision·AC·V·§10)은 별도 설계 커밋으로 먼저 고정한 뒤 구현했다.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·02·03·04·09 | EP-01 스피너가 세 소비자에 도달 | `PendingAssistant:71`·`TaskTileContent:279`·`SubAgentTileContent:159` (3) | 3/3 | `rg '<StatusLine' --include=*.tsx` → **3건**, 셋 다 분기 없이 같은 `StatusLine` 호출 | — |
| VP-05·06·07 | EP-02 트랙 이름 TS↔CSS 사본 | `@utility animate-spark-{pulse,dot,spoke,g1..g5}` (8) | 8/8 | 소스: `grep -c '@keyframes spark-\|@utility animate-spark-' app.css` → **16**. **빌드 산출**(`electron-vite build` → `out/renderer/assets/index-*.css`): 유틸 8/8 · 키프레임 8/8 방출, 차집합 0 | — |
| VP-08 | EP-03 감속 모션이 트랙 전수를 덮는다 | 같은 8 클래스 (8) | 8/8 | `sparkCss.test.ts` "차집합 0" 케이스 — `missing` 배열이 `[]`, `ALL_TRACKS` 길이 8 | — |
| VP-17·18·20·21 | EP-04 안내를 Meter 트랙에 거는 호출부 | `UsageLimitViews` `LimitBarRow` 1 · `UsageTab` `ModelUsageList` 1 (2) | 2/2 | `rg '<Meter' --include=*.tsx` → 4건 중 2건에 `title` 전달, `UsagePanel` 2건은 D-013 으로 미전달. AT-19 가 그 2건을 음성+양성으로 잠금 | — |
| VP-16 | EP-05 i18n 두 카탈로그 | ko 추가1·en 추가1·ko 삭제1·en 삭제1 (4) | 4/4 | `grep -c estimateNote ko.ts en.ts` → 각 1 · `rg filesCard` → **0건**. `typecheck:web` exit 0(= `typeof ko` 위반 없음) | — |
| VP-10·11·12 | EP-06 첨부 카드가 남는 자리 | import·렌더·컴포넌트·일러스트·ko블록·en블록 (6) | 6/6 | `rg 'ProjectFilesCard\|FileDropIllustration\|filesCard' app/src` → **0건**(차집합). `shared/ui/mock.ts` 는 존재 유지(D-009) | — |
| VP-15 | EP-07 제거 사실의 문서 사본 | `dom-architecture.md:157`·`ProjectLandingPage.tsx:22`·`SparkSpinner.tsx:7` (3) | 3/3 | 위 `rg` 0건에 세 파일 전부 포함. `ProjectLandingPage.tsx:22` 는 "파일 placeholder 는 0208 에서 제거"로 남아 새 문장이다 | — |
| VP-13·14 | EP-08 본문 높이·잘림 | `SidebarCard.bodyClassName` 전달 (1) | 1/1 | `instructionsCard.render.test.ts` — `min-h-[280px]…overflow-y-auto` 정규식 + `line-clamp` 0건 + 전문 렌더 | — |

**합계 35/35.** 분모는 §10 이 적은 지점 수(3+8+8+2+4+6+3+1)를 다시 세어 얻었다.

- §10에 없는데 같은 불변식이 필요했던 지점: **1건** — `features/settings` 테스트가 `features/chat`(`UsagePanel`)을 import 하면 eslint `boundaries/dependencies` 가 error 다. AC 는 파일 위치가 아니라 행동이 정본이므로 AT-19 단언을 `features/chat/components/usagePanel.render.test.ts` 로 옮겨 닫았다(선조치). PLAN_GAP 아님 — 계약이 아니라 배치가 바뀌었다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01·02·04·09 | REQUIRED | SELF_PASS | `statusLine.render.test.ts` 4케이스 — `<svg>` 1 · `<line>` 10 · `<text>` 5 · `<circle>` 1 · 옛 글리프 0 | not selected — 렌더 출력 직접 관측 |
| VP-03 | REQUIRED | SELF_PASS | 같은 파일 | **검출** — 스피너를 글리프 span 으로 되돌리자 **3 red** |
| VP-05 | REQUIRED | SELF_PASS | `sparkFrames.test.ts` "240 프레임 전건" — `mismatches` 가 `[]` | not selected — 전사본과 직접 비교 |
| VP-06 | REQUIRED | SELF_PASS | 같은 파일 구조 4케이스 | **검출** — `SPARK_SEGMENT_PHASE` 13→14 시 **2 red** |
| VP-07 | REQUIRED | SELF_PASS | `sparkCss.test.ts` 4케이스 | **검출** — `app.css` pulse 720→700ms 시 **1 red** |
| VP-08 | REQUIRED | SELF_PASS | 같은 파일 차집합 케이스 | **검출** — 감속 열거에서 `.animate-spark-g3` 제거 시 **1 red** |
| VP-10·11·12 | REQUIRED | SELF_PASS | `rg` 0건 + `instructionsCard.render.test.ts` 드롭존 흔적 0 | **검출** — `line-clamp-3`+빈 `bodyClassName` 복원 시 **3 red** |
| VP-13·14 | REQUIRED | SELF_PASS | `instructionsCard.render.test.ts` 4케이스(긴 지침·빈 지침 두 분기) | not selected — 분기 출력 직접 관측 |
| VP-15 | REGRESSION | SELF_PASS | `CwdPanel.landing.test.ts` 통과(전체 실행에 포함) | not selected — 기존 케이스가 원문을 본다 |
| VP-16 | REGRESSION | SELF_PASS | `resources.test.ts` 통과 + `typecheck` exit 0 | not selected — 기존 케이스가 두 사본을 본다 |
| VP-17·18·19·21 | REQUIRED | SELF_PASS | `usageTooltip.render.test.ts` 6 + `usagePanel.render.test.ts` 1 | not selected — 자리 정규식으로 직접 관측 |
| VP-20 | REQUIRED | SELF_PASS | `meter.render.test.ts` 2케이스 | **검출** — `title` 을 트랙 대신 내부 바로 옮기자 **3 red** |
| VP-22 | REQUIRED | **SELF_BLOCKED** | 사람 실기 — 헤드리스 환경이라 앱을 띄울 수 없다 | not selected |

`SELF_PASS 21 / SELF_BLOCKED 1`.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| `sparkFrames.ts:21` — `SPARK_SEGMENT_PHASE` 13 → 14 | `VP-06 선택 증거` | `240 프레임 전건…` 외 **2건** | 잠김 |
| `app.css` — `animation: spark-pulse 720ms` → `700ms` | `VP-07 선택 증거` | `pulse 트랙이 세그먼트 길이…` **1건** | 잠김 |
| `app.css` — 감속 열거에서 `.animate-spark-g3` 삭제 | `VP-08 선택 증거` | `트랙 8개가 전부…차집합 0` **1건** | 잠김 |
| `StatusLine.tsx` — `<SparkSpinner/>` → `<span>✦</span>` | `VP-03 선택 증거` | 노드 수·트랙 클래스·테마 **3건** | 잠김 |
| `ProjectInstructionsCard.tsx` — `line-clamp-3` 복원 + `bodyClassName` 비움 | `VP-10 선택 증거` | 말줄임·min-h·빈 지침 **3건** | 잠김 |
| `Meter.tsx` — `title` 을 트랙 `div` → 내부 바 `div` 로 이동 | `VP-20 선택 증거` | 자리 정규식 3표면 **3건** | 잠김 |

| `sparkFrames.ts:76` — `'animate-spark-g5'` → `` `animate-spark-${'g5'}` `` (템플릿 조립) | `재검토에서 신설한 리터럴 가드 민감도` | 리터럴·조립 **2건** | 잠김 |

심은 결함 **7종 전건 검출**. 복구 후 대상 스위트 재실행 = **40 passed / 40**(리터럴 가드 2케이스 추가).

> `git checkout -- app.css` 로 변이를 되돌리다 **커밋되지 않은 트랙 블록 전체를 날린 사고**가 1회 있었다(설계 커밋이 docs 만 담았기 때문). 블록을 재생성하고 `sparkCss.test.ts` 4케이스로 복구를 확인했다 — 이후 변이는 `cp` 백업/복원으로 처리했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ `usage.estimateNote` 는 3표면이 소비한다(AT-15·16·17이 각각 잠금) | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ 새 실패 경로 없음 — I/O·비동기를 추가하지 않았다. "글리프 폰트 부재" 행이 유일한 열화 상태이고 표에 이미 있다 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | ⚠️ **1건** — 트랙 이름이 갈라지면 그 마크가 *애니메이션 없이 항상 보여* 마크 두 개가 겹친다. 조용한 오작동이라 `sparkCss.test.ts` 가 유일한 눈이다(§10 EP-02) | 잠금 완료 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | ✅ 해당 없음 — 세 변경 모두 비동기 응답을 다루지 않는다 | — |
| (추가) 접근성이 후퇴하지 않는가 | ⚠️ `title=` 툴팁은 키보드로 열 수 없다. 같은 수치가 인접 텍스트로 이미 보여 정보 손실은 없으나, 안내 문구 자체는 마우스 사용자만 본다 | 아래 #2 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `features/settings` 테스트가 `features/chat` 을 import 하면 boundaries error | ✅ 선조치 — AT-19 단언을 `usagePanel.render.test.ts`(chat)로 이설. 계약은 행동이지 파일 위치가 아니다 | `npm run lint` → `boundaries/dependencies` error 1건 → 이설 후 **0 error** |
| 2 | 추정치 안내가 **키보드·스크린리더 사용자에게 도달하지 않는다**(네이티브 `title`) | ⚠️ 보고만 — 제품 결정이다. 일별 차트는 툴팁 본문이라 무관하고, Meter 2표면만 해당. 해소하려면 `aria-describedby` + 시각 표기(각주 한 줄)가 필요한데 그건 새 UX 다 | `Meter.tsx` 트랙 `div` 는 포커스 대상이 아니다 |
| 3 | 글리프 5종이 `Segoe UI Symbol`/`Apple Symbols` 부재 시 공백 — 프레임의 48% | ⚠️ 보고만 — 사용자 제공 아티팩트라 임의로 바꾸지 않는다(§17 등록 리스크) | `sparkFrames.test.ts` 런 시퀀스: 글리프 5구간 × 23프레임 = 115/240 |
| 4 | `SidebarCard.bodyClassName` 의 소비자가 다시 1이 됐다(파일 카드 → 지침 카드) | ✅ 선조치 없음(정상) — prop 이 죽지 않고 소비자만 바뀌었다 | `rg 'bodyClassName'` → 정의 1 + 소비 1 |
| 5 | `shared/ui/mock.ts` 소비자 0 | ⚠️ 보고만 — D-009 가 유지로 확정. `dom-architecture.md` 에 "현재 소비자는 없다"를 명시해 다음 세션이 헤매지 않게 했다 | `rg DISABLED_HATCH_CLASS` → 정의 1건뿐 |
| 6 | **테스트 6종이 전부 소스 문자열만 본다** — Tailwind 가 `@utility` 를 방출하지 않으면 스피너가 조용히 정지하는데 전건 green 이다 | ✅ 선조치 — (a) 빌드 산출을 이번 턴에 직접 확인, (b) `sparkCss.test.ts` 에 **리터럴 가드** 신설(코드 줄의 `animate-spark` 등장이 전부 따옴표 리터럴). 조립 회귀가 실제 실패 모드다 | 빌드 CSS 에서 유틸 8·키프레임 8 방출 확인. 가드 방향은 템플릿 조립 변이로 **2 red** 확인 |
| 7 | `StatusLine.tsx` 헤더 주석이 소비자를 **2곳**으로 적었다 — D-002 는 3곳을 계약으로 만든다 | ✅ 선조치 — "transcript · 작업 타일 · 서브에이전트 타일 셋" + "분기 없이 같은 것을 받는다(D-002)" 로 정정 | `sed -n '1,4p' StatusLine.tsx` 에 세 소비자와 D-002 표기 실재 |
| 8 | 리터럴 가드 **1차 시도가 방향이 틀렸다** — 술어 `` /`[^`]*animate-spark/ `` 가 코드가 아니라 **주석의 백틱**에 반응해 무조건 red 였다 | ✅ 선조치 — 주석 줄을 제외하고 "등장 수 == 따옴표 등장 수" 로 다시 씀 | 1차 술어는 조립이 없는 상태에서도 실패했다(= 조립 회귀를 구분 못 함). 정정 후 조립 변이에만 red |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: **2건.**
  1. `sparkCss.test.ts` 의 pulse 단언을 `steps(24, end)` 문자열 대조 → **키프레임 stop 개수 세기 + `step-end`** 로 바꿨다. 원본이 쓴 `steps(1, end)` 는 CSS 에서 `step-end` 이고, `steps(24,end)` 는 2-stop 램프용 문법이라 24-stop 키프레임에는 쓰이지 않는다. 개수를 실제로 세는 쪽이 더 강한 단언이다.
  2. AT-19 테스트 파일 위치를 settings → chat 으로 옮겼다(위 #1).
  3. `UsageTooltip` 패널에 **`max-w-[240px]`** 를 더했다. plan §11 은 "본문 줄만 더한다" 였는데, 안내 문구가 60자라 폭 제한 없이는 툴팁이 차트를 가로지른다. 시각 변경이라 AT-20 사람 실기 대상이다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — CSS 애니메이션에는 만료 개념이 없고 두 대체물 모두 상태를 갖지 않는다 | AT-07 재확인: `sparkCss.test.ts` 4케이스 green |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | **있다** — `spark-*` 키프레임은 **문서 전역**이라 다른 컴포넌트가 같은 이름을 정의하면 덮어쓴다. 원본의 인스턴스별 `<style>` 에는 없던 축이다 | EP-02 재확인: `grep '@keyframes spark-' app.css` → **8건, 전부 이번 블록**. 다른 파일의 `spark-` 정의 0건(`rg '@keyframes spark-' src` → app.css 만) |
| 재진입 | **있다** — 세 소비자가 동시에 마운트되면 각자 애니메이션 시작 시각이 달라 **위상이 어긋난다**(스트립도 마찬가지지만 인스턴스가 1개일 때는 드러나지 않았다). 시각적 문제일 뿐 계약 위반은 아니다 | AT-02 재확인: 세 소비자가 같은 컴포넌트를 쓰므로 *내용*은 같다. 위상 동기화는 계약에 없다 — AT-20 사람 실기로 넘긴다 |
| 다른 무효화 축 | **있다** — Tailwind `@utility` 는 클래스 리터럴이 소스에 있어야 방출된다. 클래스 이름을 동적으로 조립하면 CSS 가 사라진다 | EP-02 재확인: `sparkFrames.ts:45-53` 이 8개를 **리터럴**로 갖고 `SparkSpinner` 는 그 상수만 참조한다. 문자열 결합 0건 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 수정 13 · 삭제 2 · 신규 9(소스 2 + 테스트 7) · 문서 1 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · **`npx electron-vite build`**(재검토 — 빌드 산출 CSS 확인용) |
| **관측한 게이트 산출**(exit code 아님) | lint **0 error · 1 warning**(warning 은 `useTranscriptVirtualizer.ts:22` react-compiler, 변경 무관 기존분) · typecheck **3구성 전부 출력 0줄, exit 0** · vitest **249파일 2545케이스 중 5파일 46케이스 red** · doc-inventory **3검사 ok, exit 0** |
| 환경 기인 실패 분리 | red 46건 = `infra/db/{queries,migrate}` · `features/extensions/builder` · `features/orchestration/fork` · `app/chat-turn.continuity` **5파일 전부 DB 로드**. 서명 `better_sqlite3.node` 18건. **`git stash` 기준선 재현: 같은 5파일 46케이스**(242파일 2515케이스 중) — 변경 무관. 순증 **7파일 32케이스 전건 green** |
| V-pair 자기확인 | `SELF_PASS 21 / SELF_BLOCKED 1`; pair별 상세는 위 표 |
| 강제 지점 전수 | **35/35** (8그룹). EP-02 는 소스 대조에 더해 **빌드 산출**로 재확인 |
| **AC 자기보고**(`Criteria-Met`) | **19/20** — AT-01~AT-19 는 위 표의 재현 관측으로 각각 확인. **AT-20 은 ⚠️**(사람 실기, 헤드리스라 앱 미기동) |
| **합계 검산** | `✅ 19 · ⚠️ 1 · ❌ 0 = 총 20`. 분모는 §7 의 `AT-\d\d / AC` 행을 다시 세어 **20** 확인. 분모 변경 없음(초안 이후 AC 분할·추가 0) |
| 블로커 / 역질문 | 없음. 사람 실기 5건(AT-20)이 남는다 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음 — r1 이다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: **2건.** (a) boundaries 위반(#1)은 plan §4 "저장소 규칙을 설계 입력으로 읽는다"의 축인데 설계가 **테스트 파일의 import 방향**까지는 보지 않았다 — AC 가 행동 단언이라 이설로 닫혔다. (b) **§10 EP-02 의 `실패 의미` 가 "`sparkCss.test.ts` 가 유일한 게이트"라고 적었지만 그 테스트는 `app.css` **소스**만 본다** — Tailwind 방출 실패는 못 본다. 재검토에서 빌드 산출 확인 + 리터럴 가드로 닫았다(#6).
- 이번 턴에 만든 장치 중 **방향이 틀린 것 1건**(#8) — 술어가 코드가 아니라 산문에 반응했다. 조립 변이로 재확인해 정정했다.
- 반복해서 부딪히는 환경 한계: better-sqlite3 ABI(문서화된 기준선) · 헤드리스라 시각 실기 불가.
- 현재 라운드 수: **1**

---

# Appendix C — ΔV1 r2 구현 기록

> ΔV1(`ac09b7a` 설계) 기준의 구현 증거다. Appendix B 의 r1 증거를 재사용하지 않는다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: Part I·Part II 전부. ΔV1 이 지목한 r1 의 두 결함이 코드에서 그대로 재현됐다 — `sparkFrames.ts:14` 가 `SPARK_TOTAL_FRAMES = 240` 이었고 spoke 마지막 구간이 `[227, 239]` 라 원본 슬롯 240 이 없었다. `StatusLine.tsx:111` 은 `text-rust` 였고 `tokens.css:21` 의 light 값은 `#c96442` 로 원본 `#d97757` 과 다르다.
- 이견 / 현실성 문제: 없음. §10 의 "241 mod 24 = 1 이라 24-frame pulse 를 반복할 수 없다" 를 실측으로 확인했다 — 24 슬롯 = 24×7200/241 = **717.012ms** 라 10 세그먼트가 7170.12ms 이고 7200ms 트랙과 정확히 한 슬롯 어긋난다. full-period 241 stop 외의 선택지가 없다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 다만 D-016(고정색 한 곳)과 `renderer/AGENTS.md §스타일`("새 토큰은 두 테마 스코프 전부에 값을 채운다")의 해석이 갈리는 지점이 하나 있어 아래 `설계 대비 명시적 차이` 에 적었다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| ΔVP-01 | EP-09 원본 보존 | reference 파일 1 + plan 상대 링크 1 **(2)** | 2/2 | `sha256sum` → `ee57259b…f79b`(54,553B), 마지막 LF 제외 54,552B 의 SHA = `2599335f…aca0`(업로드값과 동일). 링크는 `node scripts/check-doc-inventory.mjs --check` → `links ok: every relative markdown link resolves` | — |
| ΔVP-02·05 | EP-10 원본→runtime | `sparkFrames.ts`·`SparkSpinner.tsx`·`app.css`·`tokens.css` **(4)** | 4/4 | `sparkFrames.ts` 241항·`frameKeyTimePct`; `SparkSpinner.tsx` 기하 대조 9케이스; `app.css` `grep -c '^@keyframes spark-'` → **8**, `spark-scale` stop **241**; `tokens.css` `--color-spinner: #d97757` **1건**. 넷 다 원본 파싱값과 등호 | — |
| ΔVP-04 | EP-11 성능 | StatusLine timer 0 · SparkSpinner 노드 상한 · CSS property allowlist · production build asset 0 **(4)** | 4/4 | (1) `statusLine.render.test.ts` — 코드 줄에 `setInterval`·`useState`·`style={` 0건 + `useElapsed` 양성. (2) 렌더 출력 노드 **19**(svg 1·g 2·line 10·circle 1·text 5), 트랙 **8**. (3) `@keyframes spark-*` 8블록의 속성 차집합 = `[]`(transform·visibility 외 0). (4) `grep -rl 'spinner-reference\|spark-strip\|ten-spoked\|testlib' out/` → **0** | — |
| ΔVP-06·07·08 | EP-12 안내 위치 | UsageDescription add 1 · Model remove 1 · provider remove 1 · daily remove 1 · Meter API remove 1 · ko/en desc 2 **(7)** | 7/7 | `UsageTab.tsx` `UsageDescription` 신설(NOTE 1건) · `ModelUsageList` `<Meter … />` title 없음 · `UsageLimitViews` 동일 · `UsageTooltip` NOTE 줄·`max-w-[240px]`·`tr` 제거 · `Meter.tsx` `grep -c title` → **0** · ko/en `desc` 첫 문장만(`좌측`·`left` 0건). production 등장 수 전수 = **1** | — |

**ΔV1 합계 17/17.** 분모는 §10 이 적은 지점 수(2+4+4+7)를 다시 세어 얻었다.

**상속 EP 회귀 확인**(AT-01~04·AT-10~14 가 기대는 V1 강제 지점 — ΔV1 이 대체하지 않았다)

| EP | 지점 | 닫힘 | 재현 관측 |
|---|---|---|---|
| EP-01 | StatusLine 소비자 3 | 3/3 | `grep -rn '<StatusLine' --include=*.tsx src/renderer/src` → `PendingAssistant.tsx:71`·`SubAgentTileContent.tsx:159`·`TaskTileContent.tsx:279`. 나머지 2건은 `StatusLineModel` 타입 참조(이름 충돌, plan §8 이 기록) |
| EP-06 | 첨부 카드 잔여 6 | 6/6 | `grep -rn 'ProjectFilesCard\|FileDropIllustration\|filesCard' src/renderer/src` → **0건**(차집합) |
| EP-07 | 문서·주석 사본 3 | 3/3 | 같은 술어를 `dom-architecture.md`·`ProjectLandingPage.tsx`·`SparkSpinner.tsx` 에 직접 대어 **0건** |
| EP-08 | 지침 카드 본문 1 | 1/1 | `ProjectInstructionsCard.tsx:25` 에 `bodyClassName="min-h-[280px] overflow-y-auto"`, `line-clamp` 은 주석 설명 1줄뿐(코드 0) |

**총 강제 지점 17 + 13 = 30/30.**

- §10에 없는데 같은 불변식이 필요했던 지점: **1건** — `codeOf()`(주석 제외 술어)가 원문 스윕 술어 **9건**(`codeOf(` 호출 7곳)에 필요했는데 §10 은 그것을 지점으로 갖지 않는다. 계약이 아니라 술어 위생이라 PLAN_GAP 이 아니고 선조치했다(아래 `놓친 잠재 문제` #1).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| ΔVP-01 | REQUIRED | SELF_PASS | `sparkFrames.test.ts` AT-21 2케이스 — 업로드 SHA·54,552B·파싱값 | **검출** — 원본 `stroke-width` 1글자 변경 시 **2 red**(M22) |
| ΔVP-02 | REQUIRED | SELF_PASS | 같은 파일 AT-22 4케이스 — `mismatches(REF, RUNTIME)` = `[]`, 241 슬롯 비교 | **검출** — 런타임 241→240 회귀 시 **8 red**(M1) |
| ΔVP-03 | REQUIRED | SELF_PASS | AT-23 6케이스 — 변조 fixture 마다 예상 불일치 문자열 등호 | **검출** — 마지막 슬롯 삭제·배율 변조·key time 변조·글리프 교환·240 모델·구조 파괴 6종 전건 |
| ΔVP-04 | REGRESSION | SELF_PASS | `statusLine.render.test.ts` 3케이스 + `sparkCss.test.ts` 3케이스 | **검출** — `setInterval` 재도입 **1 red**(M10) · testlib import **1 red**(M13·M23) · 키프레임 layout 속성 **1 red**(M14) |
| ΔVP-05 | REQUIRED | SELF_PASS | `sparkCss.test.ts` 4케이스 — CSS 241 stop ↔ 원본 key time·배율 등호, 트랙 8개 duration | **검출** — stop 키타임(M3)·구간 경계(M4)·duration(M5)·클래스 조립(M15) 각 red |
| ΔVP-06 | REQUIRED | SELF_PASS | `usageTooltip.render.test.ts` AT-25 1케이스 + 카탈로그 2케이스 | **검출** — NOTE 렌더 제거 **2 red**(M16) · ko desc 문장 복원 **1 red**(M21) |
| ΔVP-07 | REQUIRED | SELF_PASS | 같은 파일 AT-26~28 5케이스 + `usagePanel.render.test.ts` 1케이스 | **검출** — 툴팁 본문 통째 삭제 **1 red**(M20, 양성 짝) · NOTE 복원 **2 red**(M17·M18) |
| ΔVP-08 | REQUIRED | SELF_PASS | AT-29 2케이스 — production 등장 수 1, `<Meter … title=` 0 | **검출** — `Meter.title` 복원 **1 red**(M19) · 같은 파일 두 번째 소비자 **2 red**(M17b, 강화 후) |
| ΔVP-09 | REGRESSION | **SELF_BLOCKED** | 사람 실기 — 헤드리스 환경이라 앱을 띄울 수 없다 | not selected — 시각·OS 폰트 |
| VP-01·02·04(상속) | REGRESSION | SELF_PASS | `statusLine.render.test.ts` 6케이스 — `<svg>` 1·옛 글리프 0·노드 19 | **검출** — 글리프 1종 누락 **3 red**(M12) |
| VP-10~16(상속) | REGRESSION | SELF_PASS | i18n·CwdPanel.landing·projects 4파일 **23케이스 green**, `grep` 차집합 0 | not selected — 기존 케이스가 원문을 본다 |

`SELF_PASS 10 / SELF_BLOCKED 1`.

## [구현자 기입] 이번 라운드 수정의 잠금

**심은 결함 23종 · 전건 검출.** 각 행은 변이를 넣고 대상 스위트를 돌린 뒤 백업본으로 되돌린 실측이다(`git checkout` 을 쓰지 않는다 — r1 이 그것으로 미커밋 CSS 블록을 날렸다).

| 심은 결함 | 출처 | 실패한 케이스 수 | 결과 |
|---|---|---|---|
| M1 `SPARK_TOTAL_FRAMES` 241→240 + spoke 구간 `[227,239]` | ΔVP-02 `241→240 회귀` | 8 | 잠김 |
| M2 `SPARK_FRAME_SCALES` 두 항 교환 | ΔVP-02 | 3 | 잠김 |
| M3 `app.css` scale stop 키타임 `0.4149%`→`0.4200%` | ΔVP-05 `한 지점 변경` | 1 | 잠김 |
| M4 `app.css` spoke 구간 경계 `14.5228%`→`14.5000%` | ΔVP-05 `window` | 1 | 잠김 |
| M5 `app.css` `spark-g3` duration 7200→7170ms | ΔVP-05 `duration` | 1 | 잠김 |
| M6 감속 열거에서 `.animate-spark-g3` 제거 | 상속 AR-02 | 1 | 잠김 |
| M7 `--color-spinner` 를 rust light 값 `#c96442` 로 | ΔVP-05 `token` | 1 | 잠김 |
| M8 `[data-theme='dark']` 가 `--color-spinner` 재정의 | D-016 두 테마 동일 | 1 | 잠김 |
| M9 소비자가 `text-spinner`→`text-rust` 복귀 | D-016 | 2 | 잠김 |
| M10 `StatusLine` 에 `setInterval`+`useState` 재도입 | ΔVP-04 `timer 재도입` | 1 | 잠김 |
| M11 spoke 마크 배율 `scale(0.74)`→`scale(0.8)` | ΔVP-02 기하 | 1 | 잠김 |
| M12 글리프 5종 중 1종 누락 | 상속 AT-04 | 3 | 잠김 |
| M13 프로덕션이 `sparkReference.testlib` import | ΔVP-04 `reference import 재도입` | 1 | 잠김 |
| M14 `@keyframes spark-scale` 에 `width: 18px` 추가 | ΔVP-04 property allowlist | 1 | 잠김 |
| M15 트랙 클래스 이름을 `join('-')` 로 조립 | 상속 r1 #6 리터럴 가드 | 2 | 잠김 |
| M16 `UsageDescription` 에서 NOTE 제거 | ΔVP-06 `NOTE 렌더 제거` | 2 | 잠김 |
| M17 모델 막대 밑에 NOTE 줄 복원 | ΔVP-07 `chart callsite 복원` | 1 | 잠김 |
| M17b **같은 파일 안** 두 번째 NOTE 소비자 | ΔVP-08 | 1 → **2**(술어 강화 후) | 잠김 |
| M18 차트 툴팁에 NOTE 줄 복원 | ΔVP-07 | 2 | 잠김 |
| M19 `Meter.title` prop·DOM 전달 복원 | ΔVP-08 `title API` | 1 | 잠김 |
| M20 차트 툴팁 본문 통째로 `return null` | ΔVP-07 `chart 전체 삭제` | 1 | 잠김 |
| M21 ko `desc` 에 provider 위치 문장 복원 | ΔVP-06 | 1 | 잠김 |
| M22 원본 SVG 의 `stroke-width` 1글자 변경 | ΔVP-01 `XML 1byte 변경` | 2 | 잠김 |
| M23 프로덕션이 `sourceScan.testlib` import | ΔVP-04(술어 확장 후) | 1 | 잠김 |

- **M17b 가 술어의 결함을 드러냈다.** AT-29 의 초안 술어는 `usage.estimateNote` 를 **파일 목록**으로 셌는데, `ModelUsageList` 가 `UsageTab.tsx` 안에 살기 때문에 같은 파일에 두 번째 소비자가 생겨도 목록이 그대로라 통과했다(1 red — AT-27 만 잡았다). **등장 횟수 + 그 한 번이 `UsageDescription` 함수 본문 안** 으로 바꾸고 재측정해 **2 red** 를 확인했다. "완결성 주장의 관측값은 총계가 아니라 차집합·개수" 규칙이 이 자리에서 한 번 더 필요했다.
- 복구 후 대상 스위트 재실행 = **renderer 79파일 664케이스 전건 green**, 원본 SVG SHA `ee57259b…f79b` 불변.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ `usage.estimateNote` 의 소비자는 `UsageDescription` **1곳**이고 그것이 실제로 렌더된다(AT-25 가 첫 문장·NOTE 각 1건과 순서를 본다). producer 만 남고 화면에 없는 문구는 0 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ 새 실패 경로 없음 — I/O·비동기·타이머를 추가하지 않았다. §5 표의 6행이 그대로 성립하고 "감속 모션 on → frame 0" 은 CSS 블록 8트랙 차집합 0 으로 잠겨 있다 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | ⚠️ **2건** — (a) 트랙 이름이 갈라지면 그 마크가 *애니메이션 없이 항상 보여* 마크가 겹친다(조용한 오작동). (b) `--color-spinner` 가 사라지면 `text-spinner` 유틸이 방출되지 않아 스피너가 부모 색을 조용히 상속한다 | 둘 다 잠금 완료 — (a) M15·M6, (b) M7·M8 + 빌드 산출에서 `.text-spinner { color: var(--color-spinner) }` 실재 확인 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | ✅ 해당 없음 — 이번 변경은 비동기 응답을 다루지 않는다 | — |
| **안내를 옮기면 도달률이 떨어지지 않는가** | ✅ **오히려 올라간다** — r1 의 `title=` 툴팁은 마우스 호버 전용이라 키보드·스크린리더 사용자에게 도달하지 않았다(r1 #2 가 보고만 하고 남긴 이슈). 전역 설명의 본문 텍스트로 옮기면서 그 접근성 결함이 **함께 소멸했다**. 사용량이 비어 있거나 로딩 중이어도 안내가 보인다(막대가 없으면 툴팁도 없던 r1 과 다르다) | r1 #2 종료 |
| (추가) 차트·막대에서 안내만 빼고 데이터가 상했는가 | ✅ 음성 단언마다 양성 짝을 붙였다 — provider 막대 2개+주간/월간 라벨, 모델 막대 N개+모델명+breakdown, 툴팁 날짜·토큰·비용, 도넛 막대 3개 | — |
| (추가) 툴팁 폭 제한 제거가 시각 회귀인가 | ⚠️ r1 이 60자 안내 때문에 넣은 `max-w-[240px]` 를 함께 걷었다. 남은 세 줄은 날짜·토큰·비용뿐이라 폭 제한이 필요 없다 | AT-30 사람 실기 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **원문 스윕 술어가 주석에 반응한다** — 이번 턴에 두 번 걸렸다(원본 leak 스윕이 `SparkSpinner.tsx`·`sparkFrames.ts` 의 *설명 주석* 에 걸려 red, `text-rust` 부재 술어가 그것을 설명하는 주석에 걸려 red) | ✅ 선조치 — `codeOf()`(블록 주석 + `//`·`*` 줄 제거)를 `shared/ui/sourceScan.testlib.ts` 로 뽑아 **원문 스윕 전부**에 적용했다 — `grep -rn 'codeOf(' --include=*.test.ts` → **7 호출**, 술어 9건(leak 스윕 2 · `text-rust` · SparkSpinner raw hex · SparkSpinner 프레임 표 · StatusLine timer · estimateNote 전수 · Meter title · `<Meter title=` 전수) | r1 #8 이 같은 실수를 한 번 했고 사례로 남아 있었다. 한 곳만 고치면 다음 술어가 같은 자리에서 다시 틀린다 |
| 2 | **AT-29 술어가 파일 목록이라 같은 파일 안의 두 번째 소비자를 못 본다** | ✅ 선조치 — 등장 **횟수** + `UsageDescription` 함수 본문 안이라는 자리까지 본다. M17b 로 1 red → 2 red 재측정 | `ModelUsageList` 가 `UsageTab.tsx` 에 산다 — 목록으로 세면 그 파일은 이미 목록에 있다 |
| 3 | **`sparkCss.test.ts` 는 여전히 `app.css` *소스* 만 본다** — Tailwind 가 `@utility` 를 방출하지 않으면 스피너가 조용히 멈추는데 전건 green 이다(r1 Review Signal (b) 가 남긴 축) | ✅ 선조치 — 리터럴 가드를 유지하고, **빌드 산출을 이번 턴에도 직접 확인**했다: 유틸 8/8·키프레임 8/8 방출, 방출된 `spark-scale` stop **241개**·원본 key time 과 값 불일치 **0**, visibility stop 11/21/3/3/3/3/3, 감속 블록이 8트랙 전부 포함, `.text-spinner { color: var(--color-spinner) }`·`--color-spinner: #d97757` 실재 | 소스 테스트만으로는 이 축이 닫히지 않는다는 것이 r1 의 기록된 결론이다 |
| 4 | **241 stop CSS 가 인스턴스 비용을 늘리는가** — 사용자 제약(D-003)의 핵심 질문 | ✅ 늘지 않는다. 실측: 인스턴스당 SVG 노드 **19**(r1과 동일) · 애니메이션 **8**(r1과 동일) · spinner 유발 React timer/state **0**(r1과 동일). 늘어난 것은 **전역 CSS 뿐**이고, JS 번들은 오히려 **250 bytes 줄었다**(프레임 표 241항이 rollup 에서 tree-shake 됨 — `grep -c '0\.34,0\.39,0\.46' index-*.js` → **0**) | 아래 `설계 대비 명시적 차이` 의 성능 표 |
| 5 | 원본 `<svg style="… overflow:hidden">` 를 런타임이 다시 적지 않는다 | ✅ 선조치 없음(정상) — 바깥 `<svg>` 의 UA 기본값이 `overflow: hidden` 이라 동작이 같다. 주석으로 남겨 다음 세션이 "빠뜨렸나" 를 다시 묻지 않게 했다 | `SparkSpinner.tsx` 헤더 주석 |
| 6 | `usagePanel.render.test.ts` 의 양성 짝이 **2개**로 적혀 있었다 | ✅ 선조치 — 실제 렌더는 막대 **3개**(컨텍스트 1 + 주간·월간 2)다. r1 은 `toContain` 이라 개수를 세지 않아 드러나지 않았고, plan §A7 AT-19 의 "두 막대" 는 호출부 2곳을 센 값이다. 개수로 바꾸며 정정 | `UsagePanel.tsx:48`(컨텍스트) + `:90`(한도 행, week·month 두 번 렌더) |
| 7 | `Meter.title` 제거로 `shared/ui` 의 도메인 결합이 사라졌다 | ✅ 부수 이득 — `renderer/AGENTS.md §shared 에 도메인 문구 금지` 가 요구하던 상태로 돌아왔다. `meter.render.test.ts` 는 Meter 고유 계약(트랙·ratio clamp)만 남겼고 title 계약을 지웠다 | plan §16 "shared에 도메인 문구 금지 — 강화" |
| 8 | 글리프 5종의 폰트 의존(프레임의 48%) | ⚠️ 보고만 — 사용자 제공 아티팩트의 성질이라 임의로 바꾸지 않는다(plan §6 미룬 항목). r1 과 같은 상태 | 원본 `.spark-text` 의 `font-family` 를 그대로 옮겼고 렌더 테스트가 원본 값과 등호로 대조한다 |
| 9 | 세 인스턴스의 애니메이션 **위상이 서로 다르다**(각자 마운트 시각 기준) | ⚠️ 보고만 — r1 에서 이미 보고된 축이고 ΔV1 이 계약으로 만들지 않았다. 원본 스트립도 같은 성질이다 | AT-30 사람 실기 |

### 설계 대비 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: **5건.**
  1. **`SPARK_PULSE_CLASS`/`spark-pulse` → `SPARK_SCALE_CLASS`/`spark-scale` 로 이름을 바꿨다.** plan §11 은 이름을 지정하지 않았고, "pulse" 는 사라진 24-frame 반복을 가리키는 이름이라 남기면 다음 세션이 720ms 주기를 다시 상상한다. 클래스·키프레임·감속 블록·소비자·테스트 전부 같은 커밋에서 옮겼다(`grep -c 'spark-pulse'` → **0**).
  2. **`--color-spinner` 를 `@theme` 에 *한 번만* 정의하고 `[data-theme='dark']` 에는 두지 않았다.** plan §11 은 "두 테마에서 같은 token 정의", `renderer/AGENTS.md §스타일` 은 "새 토큰은 두 테마 스코프 전부에 값을 채운다" 라고 적는다. 그러나 §10 은 "raw 값은 semantic token 정의 **한 곳**만 소유한다" 이고, 두 스코프에 같은 값을 적으면 raw hex 사본이 둘이 되어 한쪽만 고치는 r1 유형의 결함이 다시 가능해진다. AGENTS 규칙의 이유절("한쪽만 채우면 그 테마에서 깨진다")은 *테마마다 값이 달라야 하는* 토큰을 겨눈다 — 이 토큰은 반대로 **달라지면 안 된다**. 같은 파일의 `Static accent palette — not themed` 블록(`--color-cream-*`·`--color-indigo`)이 그 선례이고 거기에 넣었다. "두 테마에서 같다" 는 정의를 복제해서가 아니라 **재정의가 없음을 단언해서** 성립시킨다(M8 이 그 방향을 확인한다).
  3. **테스트 헬퍼 모듈 2개를 만들었다** — `sparkReference.testlib.ts`(plan §11 이 지시한 SVG 파서)와 `sourceScan.testlib.ts`(plan 에 없음, 위 #1 의 선조치). `.testlib.ts` 는 vitest `include`(`src/**/*.test.ts`)에 잡히지 않고, 프로덕션이 import 하면 `sparkCss.test.ts` 의 leak 스윕이 잡는다(M13·M23).
  4. **`usagePanel.render.test.ts` 를 지우지 않고 D-019 의 "도넛 0건" 으로 재조준했다.** plan §11 은 "V1 범위 제외만을 위한 파일이면 삭제" 를 허용했지만, D-019 는 안내가 **차트·막대·도넛 전부에서 0건**이라고 적는다 — 컴포저 도넛이 그 "도넛" 이라 독립 가치가 남는다.
  5. **AT-29 술어를 파일 목록에서 등장 횟수 + 함수 본문 위치로 강화했다**(위 #2).
- 신규 의존성: **0**. 새 패키지·새 CSS 파일 없음(`app.css`·`tokens.css` 기존 파일만 수정).

**대체물이 갖고 원본 설계가 갖지 않던 실패 모드 — 축마다**

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | **없다** — CSS 커스텀 속성과 키프레임에는 만료 개념이 없고, 이번 대체물(전역 토큰 1개·전역 키프레임 8개) 어느 쪽도 시간에 따라 상태를 잃지 않는다. r1 이 쓰던 음수 `animation-delay`(위상 보정)마저 사라져 시간 축 상태가 하나 줄었다 | AT-22 재확인: `sparkCss.test.ts` "트랙 8개가 전부 원본의 한 바퀴·계단 타이밍을 쓴다" 가 `-\d+ms` 부재를 함께 단언 — green |
| **공유** (누가 함께 쓰고 누가 비울 수 있는가) | **있다 — 두 곳.** (a) `--color-spinner` 는 `:root` 전역이라 **어떤 컴포넌트든 `text-spinner` 로 소비**할 수 있고, 새 `[data-theme]` 스코프가 재정의하면 원본과 색이 갈린다. r1 의 `text-rust` 는 이미 공유였지만 "테마마다 다르다" 가 의도였으므로 이 축이 새로 계약이 됐다. (b) `spark-*` 키프레임 이름은 **문서 전역**이라 다른 파일이 같은 이름을 정의하면 덮어쓴다 | EP-10 재확인: `--color-spinner` 정의 **1건**(`grep -o '--color-spinner:[^;]*' tokens.css`), `[data-theme='dark']` 이후 구간에 **0건** — M7·M8 각 1 red. `@keyframes spark-` 정의 **8건, 전부 app.css**(`css.split()` 길이 2 로 전역 유일성까지 단언) |
| 재진입 | **있다** — 세 소비자가 서로 다른 시각에 마운트하면 각자의 애니메이션 시작점이 달라 **위상이 어긋난다**. r1 과 같은 성질이지만 슬롯이 241 로 늘어 어긋남의 해상도만 바뀐다. 시각적 문제일 뿐 계약 위반은 아니다 | AT-02(상속) 재확인: 세 소비자가 분기 없이 같은 `StatusLine` 을 부르므로 *내용* 은 같다(`grep -rn '<StatusLine'` → 3). 위상 동기화는 유효 V 의 계약이 아니다 — 위 `놓친 잠재 문제` #9 로 AT-30 에 넘긴다 |
| 다른 무효화 축 | **있다 — 두 개.** (a) Tailwind `@utility`·`@theme` 는 클래스/토큰 리터럴이 스캔 소스에 있을 때만 방출된다. 이름을 조립하거나 토큰을 지우면 **CSS 가 통째로 사라지고 렌더 테스트는 green** 이다. (b) 241 stop 은 `app.css` 사본이라 원본이 바뀌면 손으로 다시 생성해야 한다 | (a) EP-10·EP-11 재확인: 리터럴 가드 2케이스(M15 2 red) + **빌드 산출에서 유틸 8·키프레임 8·`.text-spinner` 방출 직접 확인**. (b) AT-22 재확인: `sparkCss.test.ts` 가 CSS 원문 stop 을 **원본 파싱값과 등호** 로 보므로 원본이 바뀌면 즉시 red — M22 가 그 방향(2 red) |

**성능 — r1 대비 실측 (D-003 · AT-24)**

| 축 | r1 (`ae27113`) | r2 | 판정 |
|---|---|---|---|
| 인스턴스당 SVG 노드 | 19 | **19** | 동일 |
| 인스턴스당 애니메이션 | 8 | **8** | 동일 |
| 동시 3곳 노드 | 57 | **57** | 동일 |
| spinner 유발 React timer/state | 0 | **0** | 동일 |
| 애니메이션 속성 | transform·visibility | **transform·visibility** | 동일(allowlist 차집합 0) |
| renderer JS 번들 | 3,052,441 B | **3,052,191 B** | **−250 B** (프레임 표 tree-shake, `Meter.title`·툴팁 줄 제거) |
| renderer CSS 번들 | 95,819 B (gzip 14,949) | **106,445 B (gzip 16,802)** | +10,626 B (gzip **+1,853 B**) — 전역 1회 파싱 |
| renderer 산출 총합 | 13,503,269 B | **13,513,645 B** | +10,376 B (+0.08%) |
| 빌드에 원본 asset·문자열 | 0 | **0** | 동일 |

241 슬롯 정확도의 대가는 **전역 CSS +10.6KB(gzip +1.8KB) 하나**다. 렌더 트리·자바스크립트·메인 스레드 작업량은 어느 축도 늘지 않았고 JS 는 오히려 줄었다.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 수정 17(소스 9 + 테스트 6 + CSS 2) · 신규 2(테스트 헬퍼) · 삭제 0 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npx prettier --check ./src` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check` · `npx electron-vite build` |
| **관측한 게이트 산출**(exit code 아님) | lint **0 error · 1 warning**(`useTranscriptVirtualizer.ts:22` react-compiler — 이번 diff 밖 기존분) · typecheck **3구성 전부 출력 0줄, exit 0** · prettier **1 warn = `src/main/AGENTS.md`**(이번 diff 가 건드리지 않은 파일, `git status` 에 미변경) · vitest **249파일 2571케이스 중 5파일 48케이스 red** · renderer 전용 **79파일 664케이스 전건 green** · doc-inventory **3검사 ok, exit 0** · build **exit 0** |
| 환경 기인 실패 분리 | red 48건 = `infra/db/{queries,migrate}` · `features/extensions/builder` · `features/orchestration/fork` · `app/chat-turn.continuity` **5파일 전부 DB 로드**. 서명 `better_sqlite3.node` **12건**. **`git stash -u` 기준선 재현: 같은 5파일 48케이스** — 변경 무관(`app/AGENTS.md` 의 알려진 기준선) |
| V-pair 자기확인 | `SELF_PASS 10 / SELF_BLOCKED 1`; pair별 상세는 위 표 |
| 강제 지점 전수 | **ΔV1 17/17 + 상속 13/13 = 30/30** |
| 심은 결함 | **23종 전건 검출**(위 잠금 표) |
| **AC 자기보고**(`Criteria-Met`) | **18/19** — AT-21~AT-29 와 상속 AT-01~04·AT-10~14 를 위 표의 재현 관측으로 각각 확인. **AT-30 은 ⚠️**(사람 실기, 헤드리스라 앱 미기동) |
| **합계 검산** | `✅ 18 · ⚠️ 1 · ❌ 0 = 총 19`. **분모가 r1 의 20 에서 19 로 바뀌었다** — V1 AT-01~AT-20(20) 중 **AT-05~09·AT-15~20 의 11개가 SUPERSEDED**, 남은 상속 9개(AT-01~04·AT-10~14)에 ΔV1 의 AT-21~AT-30(10)을 더해 **9 + 10 = 19**. r1 의 `19/20` 과 직접 비교하지 않는다 |
| 블로커 / 역질문 | 없음. 사람 실기(AT-30) 6건이 남는다 — 두 테마 스피너 크기/정렬/색/속도 · 감속 모션 frame 0 · Windows 글리프 5종 · 지침 카드 · 사용량 설명 1건 · 세 표면 안내 0건 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가: 예 — 두 축이 되풀이됐다.**
  - (a) **"oracle 의 기대값은 원본에서 파생해야 한다."** r1 은 240행을 손으로 전사해 원본의 241번째 슬롯과 고정색을 놓쳤다. r2 는 프레임·key time·기하·색·기간·구간 전부를 원본 파싱값에서 만든다 — 테스트에 남은 손 전사는 **사용자 원문 문구 1건**(그것은 사본이 아니라 계약 자체다)뿐이다.
  - (b) **"원문 술어는 코드를 봐야지 산문을 보면 안 된다."** r1 #8 이 같은 실수를 한 번 했고, r2 에서 **두 번 더** 재현됐다(leak 스윕 · `text-rust` 부재). 이번에는 사례를 지점마다 고치지 않고 `codeOf()` 로 올려 **원문 스윕 술어 9건 전부**(`codeOf(` 호출 7곳)에 적용했다.
- **그것을 막았어야 할 plan 지침·AC가 있었는가: 2건.**
  - (a) plan §11 "SVG parser는 test helper에 두고" 는 파서의 *존재* 만 요구하고 **술어가 주석에 반응하는 축**은 적지 않는다. §10 에도 지점이 없다 — 계약이 아니라 술어 위생이라 이번엔 선조치로 닫았지만, 같은 축이 세 라운드째다.
  - (b) plan §7 AT-29 의 oracle 문장("renderer의 비-test callsite **전수 검색** = 1")은 무엇을 세는지(파일 vs 등장)를 정하지 않는다. 초안 술어가 파일을 셌고 M17b 가 그 눈을 통과했다. 술어를 강화해 닫았다.
- 이번 턴에 만든 장치 중 방향이 틀린 것: **1건**(AT-29 초안 술어, 위 (b)). 나머지 22 변이는 초안 술어가 그대로 잡았다.
- 반복해서 부딪히는 환경 한계: better-sqlite3 ABI(문서화된 기준선, 5파일 48케이스) · 헤드리스라 시각 실기 불가(AT-30·ΔVP-09).
- 현재 라운드 수: **2**

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | … | verify r<N> · VP-… · AC<N> / §10 <N>행 / gate | … | BLOCKING / PLAN_GAP / NON_BLOCKING / NEXT_HANDOFF | open / 구현중 / 해결 |
