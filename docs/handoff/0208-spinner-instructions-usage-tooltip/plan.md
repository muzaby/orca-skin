# Plan — 0208-spinner-instructions-usage-tooltip

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0208-spinner-instructions-usage-tooltip` |
| 작성자 | Claude Code |
| 일자 | 2026-08-28 |
| 매핑 | — |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 서로 독립인 renderer UI 결함 3건 — 대기 스피너가 폰트 의존 글리프 6종을 200ms `setInterval`→`setState` 로 돌린다(`StatusLine.tsx:9,67-73`) · 프로젝트 랜딩 우측에 동작 0 인 첨부 placeholder 가 자리를 차지하고 지침은 3줄에서 잘린다(`ProjectFilesCard.tsx` · `ProjectInstructionsCard.tsx:23`) · 사용량 수치가 SDK 추정치라는 사실이 화면 어디에도 없다.
- 완료 후 달라지는 것: 스피너가 지정 아티팩트로 서면서 리렌더가 0 이 되고, 지침 카드가 되찾은 세로 공간을 쓰며, 사용량 막대 호버에 추정치 안내가 뜬다.
- 성공을 사용자 관점 한 문장으로: **턴이 도는 동안 화면이 더 가벼워지고, 지침은 더 보이고, 사용량 숫자는 자기가 추정치임을 밝힌다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "transcript에서 답볔을 기다리는 스피너 아이콘을 첨부 svg로 대체한다" | 세션 턴 (2026-08-28) |
| 명시 요구 | "지침(우측)아래에 현재 지원하지 않는 첨부 파일 입력란을 제거한다. 그리고 해당 공간만큼 지침 컴포넌트를 확잔한다(높이)" | 같은 턴 |
| 명시 요구 | "세팅.사용량 차트, 세팅.사용량.<provider> 주간/월간 막대바에 마우스 호버시 다음 툴팁을 제공한다" + 문구 원문 | 같은 턴 |
| 명시 요구 | **"스피너로인해 겅능저하가 발생하면 안된다"** (2회 반복) | 플랜 반려 턴 |
| 명시 요구 | "본문 내용을 svg확장자로 사용하라" (업로드 `…convergev3.md`) | 업로드 턴 |
| 명시 요구 | 교체 범위 "세 곳 모두 교체" · 확장 방식 "고정 최소 높이를 준다" · 툴팁 대상 3곳 | AskUserQuestion 1·2차 |
| 추론 의도 | 아티팩트를 **인라인 React 컴포넌트**로 옮긴다 — `.svg` 파일은 `currentColor` 상속이 끊겨 테마 규칙을 깬다 (D-007) | 설계자 판단 → 플랜 승인 |
| 추론 의도 | 성능 제약을 "노드 수·리렌더 수"로 조작화한다 — 사용자가 수치를 지정하지 않았다 | 설계자 판단 (D-003) |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 대기 스피너를 **사용자 제공 아티팩트**로 대체한다 | 사용자: "첨부 svg로 대체한다" | 사용자 턴 | ACTIVE | — |
| D-002 | 교체 범위는 `StatusLine` 렌더 지점 **3곳 전부**다 | 사용자 선택 "세 곳 모두 교체". 두 타일 코드에 "메인 transcript 와 동일한 StatusLine" 주석이 이미 있다 | AskUserQuestion 1차 | ACTIVE | — |
| D-003 | **스피너가 성능을 저하시키면 안 된다** — 원본 스트립을 그대로 펼치지 않는다 | 사용자: "스피너로인해 겅능저하가 발생하면 안된다". 1:1 인라인은 인스턴스당 ≈1767 SVG 노드(3곳 동시 ≈5301)이고 그중 보이는 것은 1프레임뿐이다 | 사용자 턴 + 실측 | ACTIVE | 초안의 "241 프레임 스트립 인라인"을 대체 |
| D-004 | 값싼 인코딩은 **원본과 프레임 단위로 등가**여야 한다 — 눈이 아니라 240/240 으로 증명한다 | D-003 이 형태를 바꾸므로 시퀀스 동일성이 별도 계약이 된다. 짧은 쪽이 아니라 **같은 쪽**이 계약이다 | 설계자 판단 | ACTIVE | — |
| D-005 | 색을 지정하지 않고 **`text-rust` 를 `currentColor` 로 상속**한다 | `renderer/AGENTS.md §스타일` raw hex 금지. 원본의 `#d97757` 은 `tokens.css:194` 의 **dark 값**이고 light 는 `:21` `#c96442` 라 그대로 박으면 라이트에서 틀리다 | 저장소 규칙 + 실측 | ACTIVE | — |
| D-006 | 애니메이션 CSS 는 **`styles/app.css` 의 `@utility` 블록**으로 올린다 | 같은 규칙 "새 CSS 파일·규칙 추가 금지". 인라인 `<style>` 은 문서 전역이라 클래스·키프레임 이름이 새고 인스턴스마다 중복된다. `epitaxy-shine`·`status-beacon`·`tile-in` 이 이미 그 자리다 | 저장소 규칙 | ACTIVE | — |
| D-007 | **`.svg` 파일로 커밋하지 않는다** — 인라인 컴포넌트로 옮긴다 | `<img>`/`<object>` 로 물리면 `currentColor` 상속이 끊겨 D-005 가 깨지고, `?raw` 는 타입·lint 밖의 문자열 주입이다. 저장소 `.svg` 선례 0건 | 설계자 판단 → 플랜 승인 | ACTIVE | — |
| D-008 | 첨부 파일 카드를 **제거**한다 — 렌더·컴포넌트 파일·전용 일러스트·i18n 3키까지 | 사용자: "현재 지원하지 않는 첨부 파일 입력란을 제거한다". 이동이 아니라 제거이고, 그 능력 자체가 아직 없다(0039 가 RAG 도입까지 유예로 기록) | 사용자 턴 + 0039 | ACTIVE | — |
| D-009 | `shared/ui/mock.ts` 의 `DISABLED_HATCH_CLASS` 는 **유지**한다 | 소비자가 0 이 되지만 `dom-architecture.md §Mock UI marker (0010)` 이 그것을 **현재 규칙**으로 소유한다. 규칙 폐기는 D-008 의 범위 밖이다 | 설계자 판단 | ACTIVE | — |
| D-010 | 지침 카드는 **고정 최소 높이**로 키운다 — 컬럼 전체 높이 배선이 아니다 | 사용자 선택 "고정 최소 높이를 준다". 우측 컬럼에 높이 클래스가 하나도 없어 전체 높이 배선은 `aside`→사이드바→카드 3단 변경이 필요하다 | AskUserQuestion 2차 | ACTIVE | — |
| D-011 | 본문의 `line-clamp-3` 을 **제거**한다 — 넘치면 카드 안에서 스크롤한다 | 선택지 설명이 "본문은 그 안에서 스크롤합니다"였다. 카드만 키우고 3줄에서 자르면 빈 공간만 남아 "확장"이 성립하지 않는다 | AskUserQuestion 2차 | ACTIVE | — |
| D-012 | 툴팁 문구는 **사용자 원문 그대로**이고 키는 최상위 `usage.estimateNote` 다 | 두 탭이 공유하는 어휘라 `settings.usage.*` 가 아니다 — `usage.weekly`·`usage.monthly`·`usage.pctUsed` 가 이미 그 네임스페이스에 산다 | 사용자 턴 + 실측 | ACTIVE | — |
| D-013 | 적용 대상은 **3곳** — 일별 토큰 차트 · provider 주간/월간 · 모델별 내역 | 사용자 다중선택. **컴포저 도넛 팝오버는 범위 밖**이고, `UsagePanel` 은 `LimitBarsSection` 을 쓰지 않고 `Meter` 를 직접 부르므로 자동으로 번지지 않는다 | AskUserQuestion 2차 + 실측 | ACTIVE | — |
| D-014 | 신규 `Tooltip` 컴포넌트를 만들지 않는다 — 기존 관례를 쓴다 | 저장소에 tooltip 컴포넌트·라이브러리가 0건이다. 관례는 네이티브 `title=`(다수)·SVG `<title>`(`UsageCircle.tsx:21`)·recharts `content=`(`TokensPerDayChart.tsx:82`) 셋이다 | 실측 | ACTIVE | — |

### 갱신 메모

- 신규 결정: D-001 ~ D-014. 이번 handoff 의 첫 턴이라 타 handoff 승계는 없다.
- **변경된 결정**: 초안 설계는 원본 241 프레임을 그대로 인라인했다. 사용자의 성능 제약(2회 반복)으로 **D-003 이 그 형태를 대체**하고, 형태가 바뀌면서 시퀀스 동일성이 새 계약이 되어 **D-004 가 추가**됐다. 나머지 12건은 문장 그대로다.
- 초안의 `useId()` 중복 id 대책은 **소멸**했다 — D-003 의 마크 7개 형태에는 `<defs>`/`<use>` 가 없다. 결정이 아니라 설계 세부라 Ledger 행을 만들지 않는다.
- **`ACTIVE 결정 ↔ AC` 대조: 충돌 0.** 확인한 쌍 — D-001·D-002↔AT-01·AT-02 · D-003↔AT-03·AT-04 · D-004↔AT-05·AT-06 · D-005↔AT-09 · D-006↔AT-07·AT-08 · D-007↔AT-04(파일이 아니라 컴포넌트라야 노드를 셀 수 있다) · D-008↔AT-10 · D-009↔AT-11 · D-010↔AT-12 · D-011↔AT-12 · D-012↔AT-14 · D-013↔AT-15·AT-16·AT-17·AT-19 · D-014↔AT-15·AT-17. **반대를 요구하는 AC 0건.**
- **D-009 ↔ D-008 비충돌**: D-008 이 지우는 것은 *첨부 입력란*이고 D-009 가 지키는 것은 *빗금 규약*이다 — 후자의 마지막 소비자가 전자였을 뿐 같은 대상이 아니다.
- **D-011 ↔ D-010 비충돌**: D-010 은 카드의 *높이*를, D-011 은 본문의 *잘림*을 정한다. 둘 다 바꿔야 "해당 공간만큼 확장"이 성립한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 (3건 전부) | 스피너는 실제로 `setInterval` 리렌더 루프다(`StatusLine.tsx:67-73`) · 파일 카드는 핸들러·state 0 인 순수 placeholder 다 · `Meter.tsx:29-36` 에 `title`·`role`·hover 가 전무하다 |
| 이미 기존 코드가 충족하는가 | 1/3 부분 충족 | 일별 토큰 차트에는 recharts 툴팁이 **이미 있다**(`TokensPerDayChart.tsx:82-86`) → 새로 만들지 않고 그 패널에 줄을 더한다. 나머지 2건은 0건 |
| 더 작은 해법이 있는가 / 제거라면 능력 자체가 없어도 되는가 | 예 — 능력이 아직 없다 | `docs/handoff/0039-attachment-thumbnails/plan.md:20` 이 프로젝트 파일 첨부를 RAG 지식베이스 도입까지 **의도적 유예**로 기록한다. 지금 지우는 것은 그 유예의 시각적 잔여물이다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 — 2건 정정 | (a) `dom-architecture.md:157` 이 `DISABLED_HATCH_CLASS` 를 "자동화 nav·파일 첨부 카드 등이 공유"라 적었으나 실측 소비자는 파일 카드 **1곳**뿐이다. (b) 조사 초안이 `UsagePanel` 을 `LimitBarRow` 공유 소비자로 봤으나 실측은 `Meter` 직접 호출이라 **공유하지 않는다** |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 0 · 주의 1 | `renderer/AGENTS.md §스타일`(raw hex·새 CSS 금지)이 D-005·D-006 을 낳았다. §16 에서 본문 문장과 대조 |

- 사용자에게 올릴 결정: 없음 — 4건을 2회 질의 + 1회 제약 반려로 닫았다.
- 코드 조사로 닫은 사실: 렌더 하네스가 이미 있다(`gitRow.render.test.ts:1-27` — `react-dom/server` + `createElement`, 신규 의존성 0). `useI18n` 은 모듈 임포트 시 동기 초기화라(`shared/i18n/index.ts:11`) Provider 없이 렌더된다 — `diffTile.render.test.ts` 가 `useI18n` 소비 컴포넌트를 그대로 렌더하는 선례다.

## 5. 동작 / 사용자 흐름

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

## 6. 범위 / 비범위

- **범위**: `StatusLine` 스피너 교체(3 소비자) · `app.css` 트랙 신설 · 파일 카드 제거와 지침 카드 확장 · 사용량 막대 3곳 툴팁 · 관련 i18n(ko/en) · 어긋난 문서 사본 정정.
- **비범위**: 컴포저 도넛 팝오버 툴팁(D-013) · `Meter` 외 다른 사용량 표면 · 프로젝트 파일 첨부 기능 자체(0039 유예 유지) · `shared/ui/mock.ts` 폐기(D-009) · 글리프를 path 로 대체하는 작업(실기에서 깨지면 후속).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 글리프 5종의 폰트 의존 제거 | 아니오 — 마크 데이터만 바뀐다 | 후속 (실기 결과에 따라) |
| 컴포저 도넛 팝오버 툴팁 | 아니오 — 같은 i18n 키를 재사용한다 | 후속 |
| `usage.estimateNote` 키 이름 | **예 — i18n 공개 키** | 지금 확정 (D-012) |

## 7. Requirements / Acceptance — `R ↔ AT`

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

## 7-A. V / Trace Matrix

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

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

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

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

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

## 10. 계약 / 타입 / 강제 지점

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

## 11. 구현 설계

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

## 12. End-to-end 영향

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

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `turnStartedAt` 이 non-null 이 되면 `StatusLine` 이 `SparkSpinner` 를 마운트한다. 트랙 8개가 같은 시점에 시작하므로 서로 위상이 맞는다.
- 취소/중단: `turnStartedAt` → null 이면 `StatusLine:99` 가 `null` 을 반환해 통째로 언마운트된다 — 애니메이션도 함께 사라진다(`clearInterval` 대상 없음).
- 종료/quit/crash/renderer-gone: CSS 애니메이션은 렌더러 수명에 묶여 별도 정리가 없다. **AS-IS 대비 정리 대상이 하나 줄었다.**
- retry/timeout/partial failure: 해당 없음 — 세 변경 모두 I/O 를 하지 않는다.
- cleanup/rollback: 해당 없음.
- **다중 저장소 쓰기**: 코드 저장소는 없다. **문서·사본 축은 있다** — (a) 트랙 이름·타이밍이 `sparkFrames.ts` 와 `app.css` **두 곳**에 산다(EP-02·EP-03), (b) i18n 문구가 `ko.ts`·`en.ts` **두 곳**에 산다(EP-05), (c) 제거 사실이 코드와 문서 주석 **세 곳**에 산다(EP-07), (d) 이 handoff 의 판정·상태가 `plan.md` 와 `INDEX.md` **두 곳**에 산다. 한쪽만 갱신하면 두 사본이 서로 다른 말을 한다. (a)는 `sparkCss.test.ts`, (b)는 typecheck+`resources.test.ts` 가 기계로 막고, **(c)·(d)는 기계 게이트가 없어 §10 강제 지점의 전수 grep 과 마무리 절차가 유일한 방법**이다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: SVG 노드 = **마크 7종 × 인스턴스 3** = `<line> 10 + <text> 5 + <circle> 1 + <svg> 1 + 래퍼 2` ≈ **19/인스턴스 · 57 최악**. AS-IS 스트립 인라인 대비 **93배 감소**(1767 → 19).
- 새 요청 수: **0** — 네트워크·IPC 를 추가하지 않는다.
- 구조적 목표의 달성 가능성: D-003 이 요구하는 것은 "저하 없음"이고, 실제 결과는 **개선**이다 — 리렌더가 초당 5회에서 0회로 내려가고(경과 초 1회 틱만 잔존) 애니메이션이 브라우저 축으로 내려간다. CSS 키프레임은 `app.css` 에서 **전역 1회 파싱**이라 인스턴스 수와 무관하다.
- 캐시/snapshot/호출 축소로 잃는 부수 효과: **1건** — 200ms 리렌더가 부수적으로 제공하던 "표시 파생의 잦은 재평가"가 사라진다. 실측상 그 파생(`deriveActivityLabel`)의 입력은 `activity` 와 `elapsedSec` 뿐이고 둘 다 초 단위 이하로 바뀌지 않으므로 **손실 없음**이다 — `StatusLine.tsx:80` 의 기존 주석이 같은 사실을 이미 인정한다. 회귀 테스트는 AT-03 의 양성 짝(`useElapsed` 잔존)이 담당한다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 배포·플러그인·외부 구현자가 구현할 port/schema/config 를 만들거나 바꾸지 않는다. `Meter.title` 은 저장소 내부 prop 이다.

## 16. 기존 결정·규칙과의 관계

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

## 17. 리스크 / 트레이드오프

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

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/shared/ui/{sparkFrames.ts,SparkSpinner.tsx,Meter.tsx}` (+ 테스트 2)
- `app/src/renderer/src/styles/app.css`
- `app/src/renderer/src/features/chat/components/StatusLine.tsx` (+ 테스트 1)
- `app/src/renderer/src/features/projects/components/{ProjectInstructionsSidebar,ProjectInstructionsCard}.tsx` · **삭제** `{ProjectFilesCard,FileDropIllustration}.tsx` (+ 테스트 1)
- `app/src/renderer/src/features/settings/components/{UsageLimitViews,UsageTab,TokensPerDayChart}.tsx` (+ 테스트 1)
- `app/src/renderer/src/pages/ProjectLandingPage.tsx` (주석)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/arch/frontend/dom-architecture.md` · `docs/handoff/INDEX.md` · 본 문서

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md §테스트`
- ABI/네트워크 등 환경 제약: egress 차단 시 DB 로드 스위트(실측 5파일)가 red 다 — **알려진 기준선**이며 이번 변경과 무관하다. `npm test` 는 쓰지 않는다(ABI 를 Node 로 뒤집고 DB 동작 검증이 필요 없다).
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`
- 관련 테스트: `./node_modules/.bin/vitest run src/renderer/src/shared src/renderer/src/features/chat src/renderer/src/features/settings src/renderer/src/features/projects` — 신설 6종 + 회귀 `CwdPanel.landing`·`resources`
- 문서 게이트: `node app/scripts/check-doc-inventory.mjs --check` (세는 항목이 IPC 채널·디렉토리 수라 이번 변경으로 값이 바뀌지 않을 것으로 예상 — 실행으로 확인한다)
- 사람 실기: AT-20 의 5건.

## READY self-review

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

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 라운드도 같은 이름의 필드를 다시 채운다** — 라운드 표제(`… (r2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §8).

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
> 직접 행동 결과를 관측하는 oracle에는 mutation을 자동 요구하지 않는다(impl §3).
> **`전건`·`미분류 0`·`잔여 0` 행의 관측은 차집합이다** — 총계·합계는 그 주장을 반증할 수 없다(impl §8).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | `commit·revoke·expiry·401` (4) | 4/4 | `rg …` → 4건 / 테스트 `…` 케이스명 | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 없음 / … → 현재 pair·Decision·AC 필수면 PLAN_GAP, 아니면 별도 finding

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED / REGRESSION | SELF_PASS / SELF_BLOCKED | … | required — 결과 / not selected — 직접 oracle 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

> pair가 적대 증거를 선택했거나 파생 이슈가 변이를 인용했거나 이번 턴에 구조적 proxy·0건/전수·배선 oracle을 만들었다면
> 그 결함을 심어 장치의 방향·민감도를 확인한다(impl §3). 형제 슬롯이 서로 다른 계약을 가지면
> 지우는 변이에 더해 **형제와 맞바꾸는 변이**도 심는다. 그 밖의 hunk에는 mutation을 새로 발명하지
> 않고 `해당 없음 — 직접 oracle …`을 적는다. mutation이 없다는 이유만으로 현재 FAIL 범위를 늘리지 않는다.

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| `파일:줄` — 무엇을 어떻게 바꿨는가(제거 / 형제와 맞바꿈) | `VP-… 선택 증거` / `D<N> 인용 변이` / `구조·전수·배선 oracle 민감도` | `<케이스명>` 외 N건 | 잠김 / **잠금 없음 — 사유** / 해당 없음 — 직접 oracle |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
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
> AC·§10 행을 관측과 함께 남긴다. 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다(impl §6).

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
| **관측한 게이트 산출**(exit code 아님) | 테스트 N파일 / M케이스 · error·warning 수 · 환경 기인 실패 분리 근거 |
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
- 현재 라운드 수: N (3 초과면 다음 재구현 전에 `handoff-review`)

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | … | verify r<N> · VP-… · AC<N> / §10 <N>행 / gate | … | BLOCKING / PLAN_GAP / NON_BLOCKING / NEXT_HANDOFF | open / 구현중 / 해결 |

