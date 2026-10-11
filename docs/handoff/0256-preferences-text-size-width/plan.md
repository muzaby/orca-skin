# Plan — 0256-preferences-text-size-width

## 메타

| 항목 | 값 |
|---|---|
| slug | `0256-preferences-text-size-width` |
| 작성자 | Claude Code |
| 일자 | 2026-10-11 |
| 매핑 | 사용자 라이브 세션 (`/handoff-plan`) — 9개 요청 중 1~3번. 나머지는 0257·0258·0259 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 앱 기본 글자 크기가 '밀도' 설정(조밀 11.5 / 보통 13 / 넓게 14.5px)에 묶여 있고, 대화 내용만 키우거나 대화 열을 넓힐 방법이 없다(`theme.ts:6-10` · `tokens.css:170`).
- 완료 후 달라지는 것: 앱 기준 글자는 항상 '넓게'와 같은 14.5px이고 '밀도' 항목은 사라진다. 환경설정에 '대화 내용 텍스트 크기'(작게·보통·크게)와 '대화 기록 너비'(좁게·보통·넓게)가 생긴다.
- 성공을 사용자 관점에서 한 문장으로: 설정에서 대화 글자 크기와 대화 열 너비를 각각 고르면 트랜스크립트(너비는 입력창 포함)만 바뀌고 재시작 후에도 유지된다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "제품의 폰트 기본 포인트를 설정->환경설정->밀도의 '넓게' 옵션을 기준으로 한다. 그리고 '밀도' 항목을 제거한다." | 사용자 턴 1 |
| 명시 요구 | "설정->환경설정에 '대화 내용 텍스트 크기' 항목을 추가하고 '대화 내용 텍스트의 크기입니다.' 라고 설명하라. 선택 옵션은 '작게', '보통', '크게'. 차례대로 1,2,3 번째 첨부이미지를 참고하라." | 사용자 턴 1 |
| 명시 요구 | "설정->환경설정에 '대화 기록 너비' 항목을 추가하고 '트랜스크립트와 입력창 열의 최대 너비입니다.' 라고 설명하라. 선택 옵션은 '좁게', '보통', '넓게'. 차례대로 4,5,6 번째 첨부이미지를 참고하라." | 사용자 턴 1 |
| 명시 요구 | 너비 기본값 = "보통 (960px)" | 사용자 턴 2 (질의 응답) |
| 추론 의도 | 텍스트 크기는 트랜스크립트 글자만 바꾼다 — 첨부 1~3에서 입력창 placeholder·칩·헤더 폭이 세 장 모두 같다 | 첨부 1~3 실측(§8) |
| 추론 의도 | '보통' 텍스트 크기 = 지금 '넓게' 화면 그대로 | 기준 글자를 '넓게'로 고정하라는 같은 턴의 요구 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 앱 루트 글자 크기는 14.5px 고정이다 | "폰트 기본 포인트를 … '넓게' 옵션을 기준으로 한다" — `DENSITY_FONT.comfortable` = 14.5 | 사용자 턴 1 | ACTIVE | — |
| D-002 | '밀도' 행·`density` 저장 키·코드 경로를 제거한다. 저장된 값은 매핑하지 않고 버린다 | "그리고 '밀도' 항목을 제거한다." | 사용자 턴 1 | ACTIVE | — |
| D-003 | '대화 내용 텍스트 크기' 행: 설명 "대화 내용 텍스트의 크기입니다." · 옵션 작게·보통·크게 · 기본 보통 | 사용자 문장 원문 · 기본값은 설계자(보통 = 현재 화면) | 사용자 턴 1 / 설계자 | ACTIVE | — |
| D-004 | 텍스트 배율 = 작게 13/14 · 보통 1 · 크게 15/14. 메인 트랜스크립트 안 글자에만 적용한다 | 첨부 1~3 같은 문장 폭 비 1.078 · 1.156 ≈ 14/13 · 15/13. 입력창은 세 장 모두 불변 | 첨부 실측(§8) | ACTIVE | — |
| D-005 | '대화 기록 너비' 행: 설명 "트랜스크립트와 입력창 열의 최대 너비입니다." · 옵션 좁게 768 · 보통 960 · 넓게 1200px | 사용자 문장 원문 + 첨부 4~6 실측(DPR 1.25: 962·1202·1485px) | 사용자 턴 1 / 실측 | ACTIVE | — |
| D-006 | 너비 기본값 = 보통(960px) | 질의 응답 "보통 (960px)" | 사용자 턴 2 | ACTIVE | — |
| D-007 | 저장 키 = `transcriptTextSize`(`small`·`medium`·`large`) · `transcriptWidth`(`narrow`·`medium`·`wide`). 손상 값은 `medium` 으로 복구 | settings 파일 키는 되돌리기 비싸다 — 화면 문구가 아닌 대상(트랜스크립트) 기준 이름 | 설계자 | ACTIVE | — |
| D-008 | 너비는 기존 `--reading-column` 하나를 바꾼다. 랜딩 두 페이지의 720px 상한은 유지한다 | 트랜스크립트·채팅 컴포저가 이미 같은 `ReadingColumn` 을 쓴다(`ReadingColumn.tsx:18`) | 설계자 | ACTIVE | — |
| D-009 | 텍스트 배율 경로: TweakProvider가 전역 `--chat-text-scale` 을 쓰고, 트랜스크립트 루트만 `--transcript-text-scale` 로 받아들이며, 타이포 토큰(`@theme inline`)과 트랜스크립트 closure의 고정 글자 크기가 그 값을 곱한다 | 전역 값을 직접 곱하면 설정·사이드바·우측 패널 글자까지 바뀐다(D-004 위반) | 설계자 | ACTIVE | — |
| D-010 | 환경설정 행 순서 = 모양 · 폰트 · 언어 · 대화 내용 텍스트 크기 · 대화 기록 너비. 컨트롤은 기존 드롭다운 | 밀도 자리를 이어받는다. 3지선다 행은 이미 `SettingsSelect` 를 쓴다 | 설계자 | ACTIVE | — |
| D-011 | 비범위: 우측 패널(서브에이전트 대화·계획·아티팩트) 글자 · 컴포저 입력 글자 · 여백 배율 · 옛 `density` 값의 이관 | D-004 범위 밖 · D-002 "제거" | 설계자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-011 (신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 언급되지 않았지만 유지되는 결정: 해당 없음(신규).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001 ↔ AC2 · D-002 ↔ AC1·AC2·AC3·AC11 · D-003 ↔ AC1·AC4 · D-004 ↔ AC6·AC7·AC8·AC12 · D-005 ↔ AC1·AC9 · D-006 ↔ AC5·AC9 · D-007 ↔ AC4·AC5 · D-008 ↔ AC9·AC10 · D-009 ↔ AC6·AC7·AC8 · D-010 ↔ AC1 · D-011 ↔ AC7(배율 1 유지 자리)·§6.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 기준 글자는 `TweakProvider` 한 효과가 정한다 | `TweakProvider.tsx:140-142` `fontSize = DENSITY_FONT[t.density]` |
| 이미 기존 코드가 충족하는가 | 아니오 — 트랜스크립트 전용 글자 배율·너비 설정 없음 | `--reading-column: 768px` 상수(`tokens.css:170`) |
| 더 작은 해법이 있는가 / 제거라면 능력 자체가 없어도 되는가 | 밀도는 능력째 제거한다(D-002). 텍스트 크기를 `zoom` 으로 하면 가상화 측정(`useTranscriptVirtualizer`)과 여백까지 바뀐다 — 글자 크기만 곱한다 | 첨부 1·3 버블 좌측 여백 15px 동일(§8) |
| 선행 자료의 주장을 코드와 대조했는가 | PRD §F10·:258 "밀도 11.5/13/14.5" 가 현행 — 이번에 정정 대상 | `docs/PRD.md:88,258` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 0149 "밀도는 설정 → 일반 → 환경설정이 단독 노출" 을 D-002가 대체 — 사용자 결정 | `DebugPanel.tsx:88-89` 주석 |

- 사용자에게 올릴 결정: 없음(너비 기본값 질의 완료 — D-006).
- 코드 조사로 닫은 사실: Tailwind 4.3.3 은 `@theme` 토큰을 `var(--text-body)` 로, `@theme inline` 토큰은 값 자체(`calc(1rem * var(--transcript-text-scale, 1))`)로 유틸에 넣는다 — 설계 턴 컴파일 probe(§8).

## 5. 동작 / 사용자 흐름

```text
[설정 → 일반 → 환경설정]
  → '대화 내용 텍스트 크기' 선택 → 즉시 트랜스크립트 글자만 13/14·1·15/14 배
  → '대화 기록 너비' 선택 → 즉시 트랜스크립트·채팅 입력창 열 최대폭 768·960·1200px
  → 저장 성공: 재시작 후 같은 값
  ↘ 저장 실패: 화면 값이 이전 값으로 돌아가고 오류 토스트(기존 setTweak 계약)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 첫 실행 · 저장값 없음 | 스키마 기본값 `medium`·`medium` | 글자 보통(배율 1), 열 960px |
| 업데이트 직후 · 저장된 `density` 있음 | 다음 설정 로드에서 키 삭제 | 기준 글자 14.5px. 밀도 행 없음 |
| 텍스트 크기 변경 | `--chat-text-scale` 갱신 | 트랜스크립트 글자만 변함. 입력창·사이드바·설정 창·우측 패널 불변 |
| 너비 변경 | `--reading-column` 갱신 | 트랜스크립트와 채팅 입력창이 같은 폭으로 변함. 랜딩 입력창은 720px 상한 유지 |
| 창이 열보다 좁다 | 기존 `w-full max-w` 동작 | 열은 창 폭 − 좌우 24px 거터로 줄어든다(현행) |
| 저장값 손상(`"huge"` 등) | 스키마 `.catch('medium')` | 보통으로 동작, 다음 저장에서 정상값 기록 |

### 파생 UX / 엣지케이스

- loading: 설정 로드 전 첫 프레임은 기본값(보통·960px) — 다른 값을 고른 사용자는 짧게 기본 폭을 본다(테마와 같은 현행 수용).
- 스트리밍 중 변경: 진행 중 응답도 즉시 새 크기로 다시 그려진다. 스크롤 핀은 기존 `useScrollAnchor` 가 유지한다.
- 포털 팝오버(트랜스크립트 안 버튼이 연 메뉴): 트랜스크립트 밖에 그려지므로 배율 1.
- keyboard/a11y: 드롭다운은 기존 `SettingsSelect` 그대로.
- 다중 창/세션: 설정은 앱 전역 1벌.

## 6. 범위 / 비범위

- **범위**: 루트 14.5px 고정 · 밀도 제거(설정 키·UI·코드·현행 문서) · 두 설정 키와 행 · 트랜스크립트 글자 배율 경로 · `--reading-column` 설정화 · 관련 테스트·문서.
- **비범위**: D-011 4항목.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 우측 패널 대화(서브에이전트) 글자 배율 | 아니오 — 그 루트에 같은 선언 1줄 추가로 확장 | 후속 후보 |
| 저장 키 이름 | **예 — settings 파일 키** | D-007로 지금 확정 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01·R-02·R-03 | AT-01 / AC1 | 환경설정 그룹에 '밀도' 행이 없고 행 순서가 모양·폰트·언어·대화 내용 텍스트 크기·대화 기록 너비다. 두 신규 행의 설명은 정확히 "대화 내용 텍스트의 크기입니다." · "트랜스크립트와 입력창 열의 최대 너비입니다." 이고 옵션 라벨 순서는 작게·보통·크게 / 좁게·보통·넓게다 | GeneralTab render UT(ko): 라벨 순서 배열 일치 · 각 행 설명이 **그 행 라벨 바로 다음**에 온다 · 옵션 순서 · `밀도` 미포함 | 설정 모달 → `GeneralTab` |
| R-01 | AT-02 / AC2 | 루트 글자 크기는 항상 14.5px이고 TweakProvider는 루트 `font-size` 를 쓰지 않는다 | CSS 원문 UT: `app.css` base 의 `html` 블록에 `font-size: 14.5px` · lifecycle UT: 효과 실행 후 `documentElement.style.fontSize === ''` · `rg -n -i density app/src` 0건 | `app.css` → 모든 rem 토큰 |
| R-01 | AT-03 / AC3 | 저장된 `density` 는 다음 로드에서 디스크에서 사라지고 형제 키는 보존된다. `density` patch는 결과에 남지 않는다 | settings-migration UT(`{density:'compact', lastSessionId:'s1'}` → settings·raw 둘 다 `density` 없음, `lastSessionId` 보존) · settings-store UT(`patch({density:'compact'})` → 반환·raw에 없음) | `SettingsStore.load/patch` |
| R-02 | AT-04 / AC4 | `transcriptTextSize` 기본 `medium` · 유효값 보존 · 불량값 `medium` 복구 · patch 저장 후 새 store 인스턴스(같은 backend)에서 같은 값 | settings-migration·settings-store UT | `orca:settings:set` → `SettingsStore.patch` → 재시작 `getAll` |
| R-03 | AT-05 / AC5 | `transcriptWidth` 기본 `medium` · 유효값 보존 · 불량값 `medium` 복구 · patch 저장 후 재로드 유지 | 같은 UT | 같음 |
| R-02 | AT-06 / AC6 | 텍스트 크기 값이 바뀌면 TweakProvider가 `documentElement` 에 `--chat-text-scale` 을 `small`→`13/14` · `medium`→`1` · `large`→`15/14` 로 쓴다. `setTweak` 은 `settingsApi.set({transcriptTextSize})` 1회이고 실패 시 이전 값 복원 | lifecycle UT(`setProperty` 호출 인자 3값) · store UT(patch 인자·롤백) | `GeneralTab` → `setTweak` → 효과 |
| R-02 | AT-07 / AC7 | 배율 선언 `[--transcript-text-scale:var(--chat-text-scale,1)]` 은 트랜스크립트 스크롤 루트 한 곳에만 있다. 컴포저·설정·우측 패널은 선언 밖이라 배율 1이다 | TranscriptView render UT: 루트 요소 className 에 선언 포함 · 원문 스캔: renderer 전체에서 선언 문자열을 가진 파일 = `TranscriptView.tsx` 1개 | `ChatTile` → `TranscriptView` 루트 |
| R-02 | AT-08 / AC8 | 트랜스크립트 closure(TranscriptView.tsx 에서 상대 import로 닿는 `.tsx` 전부)의 글자 크기는 배율을 따른다: 다섯 타이포 토큰 또는 `text-[calc(<길이>*var(--transcript-text-scale,1))]` 만 허용, 고정 `text-[<길이>]`·`text-xs\|sm\|base\|lg\|xl…`·인라인 `fontSize` 0건. 다섯 토큰은 `@theme inline` 에서 `* var(--transcript-text-scale, 1)` 을 곱한다 | 원문 스캔 UT: 시험 시점에 closure를 계산해 위반 0 · closure에 `Markdown.tsx`·`UserMessage.tsx`·`StatusLine.tsx` 포함(걷기 장치 생존) · CSS 원문 UT: 다섯 토큰 정의 | `TranscriptView` → `Exchange` → … → `Markdown` |
| R-03 | AT-09 / AC9 | 너비 값이 바뀌면 TweakProvider가 `--reading-column` 을 `narrow` 768px · `medium` 960px · `wide` 1200px 로 쓴다. `tokens.css` 기본값은 `medium` 매핑과 같다 | lifecycle UT(3값) · CSS 원문 UT: `--reading-column` 기본값 = `TRANSCRIPT_WIDTH_PX.medium` | `setTweak` → 효과 → `ReadingColumn` |
| R-03 | AT-10 / AC10 | 트랜스크립트와 채팅 컴포저는 같은 `ReadingColumn` 폭을 쓰고, 새 대화·프로젝트 랜딩은 720px 상한을 유지한다 | 원문 UT: `ReadingColumn` 이 `max-w-[var(--reading-column)]` · 소비 3자리(`Composer.tsx` ColumnWrap · `TranscriptView.tsx` · `ProjectLandingPage.tsx`) · 랜딩 `max-w-[720px]` 2자리 유지 | `ChatTile` · 랜딩 페이지 |
| R-04 | AT-11 / AC11 | 현행 문서가 밀도를 더 서술하지 않고 두 신규 키·14.5px 기준·배율 경로를 서술한다. 인벤토리 생성물이 맞다 | `rg -n -i "density\|밀도" docs/PRD.md docs/TRD.md docs/IPC_CONTRACT.md docs/GLOSSARY.md docs/arch` → 0 · `rg -n "transcriptTextSize" docs/IPC_CONTRACT.md docs/arch/backend/persistence.md docs/TRD.md` → 각 1+ · `node scripts/check-doc-inventory.mjs --check` exit 0 | 문서 |
| R-02·R-03 | AT-12 / AC12 | 실제 앱에서 보통/보통은 이전 '넓게' 화면과 글자가 같고 열만 960px이다. 작게·크게는 트랜스크립트 글자만 바뀌고(입력창·사이드바·헤더 불변) 좁게·넓게는 열 폭이 바뀐다. 재시작 후 유지된다 | 사람 실기 — `npm run dev`, 첨부 1~6과 나란히 비교 | 앱 실행 |
| 전체 | AT-13 / AC13 | lint·typecheck 0 오류, 관련 vitest green | §19 gate | 전체 |

### AC 검증 주의사항

- 기존 테스트 재사용: `TweakProvider.lifecycle.test.ts:94,107,114`(fontSize·density 단언)와 `TweakProvider.store.test.ts:39` · `tweakConsumers.render.test.ts:19,57` · `settings-migration.test.ts:22,31,40,48` 는 density를 단언하므로 **새 계약으로 고친다** — 열람 확인.
- 사람 실기 항목: AC12만 — 글자 렌더 크기·열 폭은 vitest(`environment: 'node'`)가 계산하지 못한다. 배율 값·선언 위치·closure 규칙·토큰 정의는 AC6~AC10이 기계로 잠근다.
- 0건 기준(AC8): 허용 형태(토큰 5종·배율 calc)와 제거 대상(고정 길이·Tailwind 기본 크기)을 분리했다. 색 arbitrary(`text-[var(--color-…)]`·`text-[#…]`)는 글자 크기가 아니므로 술어에서 뺀다.
- AC2 음성 `rg density` 는 "없다"만 잠근다 — 루트 14.5px의 존재는 CSS 원문 UT가 잠근다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 기준 14.5px·밀도 제거(D-001·D-002) | NEW | — |
| R-02 | R | §5 대화 텍스트 크기(D-003·D-004·D-009) | NEW | — |
| R-03 | R | §5 대화 기록 너비(D-005·D-006·D-008) | NEW | — |
| R-04 | R | §6 현행 문서 정합 | NEW | — |
| AT-01..AT-13 | AT | §7 | NEW | — |
| SD-01 | SD | §9 설정 수명주기(선택 → 저장 → 재시작 복원 → DOM 변수) | NEW | — |
| ST-01 | ST | §11 renderer store 저장 인자 + main store 재로드 | NEW | — |
| AR-01 | AR | §10 EP-01·EP-02 설정 계약(zod ↔ `Settings` ↔ `Tweaks`) | NEW | — |
| AR-02 | AR | §10 EP-03·EP-04·EP-05 CSS 변수 계약(쓰는 쪽 TweakProvider · 받는 쪽 트랜스크립트 루트 · 소비 토큰) | NEW | — |
| IT-01·IT-02 | IT | §11 | NEW | — |
| MD-01 | MD | §10 EP-08 TS 매핑 SSOT | NEW | — |
| MD-02 | MD | §10 EP-06 closure 글자 크기 규칙 | NEW | — |
| MD-03 | MD | §10 EP-07 환경설정 행 | NEW | — |
| UT-01..UT-03 | UT | §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·AT-02·AT-03 | REQUIRED | 앱 부팅 → `app.css` 루트 → rem 토큰 · 설정 로드 → `migrateRawSettings` → 디스크 | AC1 render · AC2 CSS·lifecycle · AC3 migration/store UT | not selected — 값·부재를 직접 관측 | EP-03 ① (1) · EP-04 ① (1) · EP-09 (51) |
| VP-02 | R-02 ↔ AT-04·AT-06·AT-07·AT-08 | REQUIRED | `GeneralTab` → `setTweak` → `settingsApi.set` → 효과 `--chat-text-scale` → 트랜스크립트 루트 선언 → 토큰/closure 글자 | AC4·AC6·AC7·AC8 UT | **required** — 자리 계약. M1 선언을 `TranscriptView` 루트에서 지움 · M2 선언을 `Composer` 루트로 옮김(형제 자리 맞바꿈) | EP-01 (4) · EP-02 (3) · EP-03 ② (1) · EP-04 ② (5) · EP-05 (1) · EP-06 (38) |
| VP-03 | R-03 ↔ AT-05·AT-09·AT-10 | REQUIRED | `GeneralTab` → `setTweak` → 효과 `--reading-column` → `ReadingColumn`(트랜스크립트·컴포저) | AC5·AC9·AC10 UT | not selected — 값·소비 자리를 직접 관측 | EP-01 (4) · EP-02 (3) · EP-03 ③ (1) · EP-04 ③ (1) |
| VP-04 | R-04 ↔ AT-11 | REQUIRED | 현행 문서 | AC11 `rg` 양·음 + inventory `--check` | not selected — 문서 직접 관측 | EP-10 (15) |
| VP-05 | R-02·R-03 ↔ AT-12 | REQUIRED | 앱 실행 | 사람 실기 | not selected — 실기 직접 관측 | 0 — 기계 경로는 VP-02·VP-03 이 잠근다 |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | 선택 → `settingsApi.set({key})` → `SettingsStore.patch` → 새 `SettingsStore`(같은 backend) `getAll` → `TweakProvider.load` → 효과 | store UT patch 인자 · main store 재로드 UT · load 매핑 UT | not selected — 각 edge 값을 직접 관측 | EP-01 (4) · EP-02 ③ (1) |
| VP-07 | AR-01 ↔ IT-01 | REQUIRED | `ipc.ts` enum → zod 두 스키마 → `Settings` → `Tweaks` load 매핑 | settings-store UT + TweakProvider load UT | **required** — M3 `load()` 매핑에서 `transcriptWidth` 를 빼 기본값으로 남김 | EP-01 (4) · EP-02 (3) |
| VP-08 | AR-02 ↔ IT-02 | REQUIRED | 효과 `setProperty('--chat-text-scale'·'--reading-column')` → `TranscriptView` 선언 → `@theme inline` 토큰 | lifecycle UT · TranscriptView render UT · CSS 원문 UT | **required** — M1·M2(VP-02) + M4 토큰 블록을 `@theme`(inline 아님)로 되돌림 | EP-03 (3) · EP-04 (7) · EP-05 (1) |
| VP-09 | MD-01 ↔ UT-01 | REQUIRED | `TRANSCRIPT_TEXT_SCALE` · `TRANSCRIPT_WIDTH_PX` → 효과 | lifecycle UT 값 단언 | **required** — 하드코딩 표. M5 `small`↔`large` 값 맞바꿈 · M6 `medium` 너비 768 | EP-08 (2) |
| VP-10 | MD-02 ↔ UT-02 | REQUIRED | closure 파일 → 글자 크기 클래스 | 원문 스캔 UT | **required** — 0건 스윕. M7 `Markdown.tsx` 본문에 `text-[13px]` 재삽입 · M8 closure 걷기를 1단계로 줄임(포함 단언이 red여야 함) | EP-06 (38) |
| VP-11 | MD-03 ↔ UT-03 | REQUIRED | `GeneralTab` 행 배열 | AC1 render | **required** — 형제 슬롯. M9 두 신규 행의 설명 문구 맞바꿈 | EP-07 (3) |

`§10 강제 지점 전수`의 N은 자리 수다. 변이 M1~M9의 심을 자리는 §10 "등록 변이"가 정본이다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/src/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 유발한 오류만 blocking |
| 관련 vitest | 설정·Tweak·트랜스크립트·CSS 원문 테스트 | `cd app && ./node_modules/.bin/vitest run src/main/infra/settings src/renderer/src/shared/theme src/renderer/src/app/tweakConsumers src/renderer/src/features/settings src/renderer/src/features/chat/components/transcript src/renderer/src/styles` | 이번 변경 범위 실패만 blocking |
| 문서 인벤토리 | settings 키 개수가 생성물에 있다(`inventory.md:39`) | `cd app && node scripts/check-doc-inventory.mjs` 로 재생성 → `--check` exit 0 | 동일 |
| trailer 파싱 | 커밋 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 루트 글자 = `DENSITY_FONT[t.density]`(11.5/13/14.5) — TweakProvider 효과 1곳 | `theme.ts:6-10` · `TweakProvider.tsx:140-142` |
| 밀도 저장 키 = zod 2곳 + 타입 1곳 | `protocol.ts:678,724,798` · `ipc.ts:1048,1087` |
| 설정 행은 `SettingsRow`+`SettingsSelect`, 밀도 행은 환경설정 그룹 마지막 | `GeneralTab.tsx:105-165` |
| 트랜스크립트·채팅 컴포저 폭 = `--reading-column`(768px) 하나 | `tokens.css:170` · `ReadingColumn.tsx:18` · `Composer.tsx:529-538` · `TranscriptView.tsx:88` |
| 랜딩 입력창은 `max-w-[720px]` 래퍼 안 | `NewChatLandingPage.tsx:38` · `ProjectLandingPage.tsx:95` |
| 타이포 토큰 5종은 `@theme`(var 참조) — 루트에서 해석된 값을 상속하므로 하위에서 배율 변수를 바꿔도 안 바뀐다 | `tokens.css:202-212` · probe 아래 |
| Tailwind 4.3.3 컴파일 probe: `@theme { --text-body: 1rem }` → `.text-body{font-size:var(--text-body)}` · `@theme inline { --text-scaled: calc(1rem * var(--transcript-text-scale, 1)) }` → `.text-scaled{font-size:calc(1rem * var(--transcript-text-scale, 1))}` · `text-[calc(13.5px*var(--transcript-text-scale,1))]` → `font-size:calc(13.5px * …)` · `[--x:…]` 임의 속성 지원 | 설계 턴 `@tailwindcss/node` `compile()` 실행 |
| `var(--text-*)` 를 직접 참조하는 코드 0건 — inline 전환 시 변수 미방출 영향 없음 | `rg -n "var\(--text-" app/src/renderer/src` → 0 |
| 어시스턴트 본문 = `Markdown` 고정 `text-[13.5px]`, 사용자 버블 = `text-body` | `Markdown.tsx:134` · `UserMessage.tsx:53` |
| vitest `environment: 'node'` — 계산된 CSS 없음. CSS 원문 테스트 선례 | `vitest.config.ts` · `shared/ui/depthCss.test.ts` |
| 설정 enum SSOT 선례 = `ipc.ts` const 배열 + zod `z.literal/enum` | `ipc.ts:1065` `UPDATE_CHECK_INTERVAL_HOURS` |
| zod 4 `z.object` 는 모르는 키를 버린다 — `density` 는 parse에서 빠지고 `migrateRawSettings` 가 raw를 다시 쓴다 | `settings-migration.ts:49-59` · `settings-store.ts:49-55` |
| i18n en은 `typeof ko` — 키 패리티는 typecheck가 강제 | `en.ts` 머리 주석 |
| 첨부 1~3(1006px, DPR 1.25): 같은 사용자 문장 폭 565 · 609 · 653px, 줄 간격 24 · 25 · 28px, 입력창 placeholder 위치 동일 | PIL 실측(설계 턴) |
| 첨부 4~6(1920px): 입력창 테두리 폭 962 · 1202 · 1485px, 중심 1128 동일 → CSS 768 · 960 · ~1190 | PIL 실측(설계 턴) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| density 비테스트 참조 | `rg -n -i density app/src --glob '!*.test.*' -c` | 43 / 9파일 | GeneralTab 13 · TweakProvider 8 · ko 5 · en 5 · theme.ts 3 · tokens.css 3 · protocol.ts 3 · ipc.ts 2 · DebugPanel 1 |
| density 테스트 참조 | `rg -n -i density app/src --glob '*.test.*' -c` | 8 / 4파일 | migration 4 · tweakConsumers 2 · store 1 · lifecycle 1 (+ lifecycle `fontSize` 2줄 `:94,:114`) |
| '밀도' 문구(비테스트) | `rg -n 밀도 app/src --glob '!*.test.*'` | 6 / 5파일 | ko 2 · parts.tsx 주석 · GeneralTab 주석 · DebugPanel 주석 · composerPanel 주석 |
| 트랜스크립트 closure `.tsx` | 상대 import 걷기(설계 턴 스크립트) | 50 | 고정 글자 크기를 가진 파일 17 |
| closure 고정 글자 크기 | 위 50파일에서 `text-\[[0-9.]+px\]` · `text-(xs\|sm\|base\|lg\|xl)` | 38 | §10 EP-06 표 |
| closure 토큰 글자 크기 | 같은 50파일에서 `text-(caption\|footnote\|body\|code\|heading)` | 49 | 토큰 inline 전환으로 자동 배율 |
| `ReadingColumn` 소비 | `rg -n "<ReadingColumn" app/src/renderer/src` | 3 | Composer ColumnWrap · TranscriptView · ProjectLandingPage |
| 현행 문서 density/밀도 | `rg -n -i "density\|밀도" docs/PRD.md docs/TRD.md docs/IPC_CONTRACT.md docs/GLOSSARY.md docs/arch` | 15 | §10 EP-10 |

### 수치 / 전칭 표현 검산

- closure 고정 글자 38 = StatusLine 6 + Markdown 10 + Exchange 3 + (AssistantMessage·ErrorCard·PendingSteerTurn·ReasoningBlock·TranscriptView 각 2 = 10) + (AttachmentThumb·AskExchange·CompactBoundaryMarker·ForkBoundaryMarker·PendingAssistant·StructuredOutputCard·WorkActivity·MenuItem·SparkSpinner 각 1 = 9) ✓.
- "선언은 트랜스크립트 루트 한 곳" — 현재 `--transcript-text-scale` 문자열 0건(`rg` → 0), 구현 후 1파일이어야 한다.
- 문서 앵커: IPC_CONTRACT `### 2.4 Settings`(`:119`) · persistence.md `### 1.2`(`:20`) · TRD `### 6.7`(`:293`) 표제 실재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`
- 현재 책임 소유자: 루트 글자·테마·폰트·언어의 DOM 적용 = `TweakProvider`. 열 폭 = `tokens.css` 상수.
- 현재 흐름: `GeneralTab` → `setTweak('density')` → `settingsApi.set` → 효과 `documentElement.style.fontSize` → 모든 rem.
- 문제: 글자 크기 조절이 앱 전체에만 걸리고, 트랜스크립트 고정 px(`Markdown` 13.5px 등)은 밀도와도 무관하다.

```text
GeneralTab ─setTweak('density')─→ store ─effect─→ html.style.fontSize = 11.5|13|14.5px
tokens.css: --reading-column 768px ─→ ReadingColumn(transcript · composer)
Markdown text-[13.5px] (고정) · UserBubble text-body (rem)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`, `MD-01`~`MD-03`
- 변경 후 책임: 루트 14.5px = `app.css` base. 두 설정의 DOM 적용 = `TweakProvider`(전역 변수). 배율 수용 범위 = 트랜스크립트 루트. 배율 소비 = 타이포 토큰(`@theme inline`) + closure 고정 크기.
- 오류: `setTweak` 저장 실패 → 기존 롤백 + `settings.tweak.save-failed` 토스트(`TweakProvider.tsx:63-71` 그대로).

```text
app.css  html { font-size: 14.5px }
GeneralTab ─setTweak('transcriptTextSize'|'transcriptWidth')─→ store ─effect─→
  html.style  --chat-text-scale: 13/14|1|15/14   --reading-column: 768|960|1200px
TranscriptView root  [--transcript-text-scale:var(--chat-text-scale,1)]
  └─ .text-body = calc(1rem * var(--transcript-text-scale, 1))   (@theme inline, 5 tokens)
  └─ Markdown text-[calc(13.5px*var(--transcript-text-scale,1))] … (closure 38)
ReadingColumn max-w-[var(--reading-column)] → transcript · chat composer (landing 720 cap)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 루트 글자 = TweakProvider 효과 | 루트 글자 = `app.css` 상수 · TweakProvider는 두 변수만 | D-001·D-002 | AR-02 / VP-08 · `app.css` · `TweakProvider.tsx` |
| data/control flow | `density` → fontSize | `transcriptTextSize` → `--chat-text-scale` → 트랜스크립트 선언 · `transcriptWidth` → `--reading-column` | D-004·D-008·D-009 | SD-01 / VP-06 |
| state/contract | `density` 키 | `density` 삭제 · 두 키 신설(enum SSOT `ipc.ts`) | D-002·D-007 | AR-01 / VP-07 |
| 타이포 토큰 | `@theme` var 참조 | `@theme inline` + 배율 곱 | D-009 | AR-02 / VP-08 |
| closure 고정 크기 | 38자리 고정 px | 38자리 배율 calc | D-004 | MD-02 / VP-10 |
| test seam | density 단언 4파일 | 새 계약 단언 + closure 스캔 + CSS 원문 | 검증 | MD-01~03 / VP-09~11 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/ipc.ts` | 두 enum 배열·타입·`Settings` 필드 | — | protocol.ts · renderer |
| `shared/protocol.ts` | zod 기본값·복구·patch 검증 | raw → `Settings` | settings-store · migration |
| `renderer/shared/config/theme.ts` | `TRANSCRIPT_TEXT_SCALE` · `TRANSCRIPT_WIDTH_PX` 매핑 SSOT | enum → number | TweakProvider · 테스트 |
| `renderer/shared/theme/TweakProvider.tsx` | 두 Tweak 투영·DOM 변수 적용 | settings → html style | App |
| `features/chat/components/transcript/TranscriptView.tsx` | 배율 수용 선언 | 전역 변수 → 범위 변수 | ChatTile |
| `styles/tokens.css` · `styles/app.css` | 토큰 inline 배율 · 루트 14.5px · 열 기본값 | — | Tailwind |
| `features/settings/components/GeneralTab.tsx` | 두 행 · 밀도 행 제거 | Tweak ↔ 드롭다운 | 설정 모달 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-07 · EP-01 | 두 키 enum·기본값·복구 (4자리) | `ipc.ts` 배열 | ① `ipc.ts` 배열+타입 ② `ipc.ts` `Settings` ③ `SettingsSchema` ④ `SettingsPatchSchema` | parse/patch 시 | 한 자리라도 빠지면 저장되지 않거나 타입 불일치 |
| AR-01 / VP-07 · EP-02 | `Tweaks` 투영 (3자리) | `Tweaks` 타입 | ① 타입 ② `DEFAULTS` ③ `load()` 매핑 | 부팅 load | ③ 누락 = 재시작 후 기본값으로 보임 |
| AR-02 / VP-08 · EP-03 | DOM 적용 (3자리) | TweakProvider | ① `fontSize` 효과 삭제 ② `--chat-text-scale` 효과 ③ `--reading-column` 효과 | 값 변경마다 | ①이 남으면 인라인이 CSS 14.5를 덮지 않아도 죽은 코드 · ②③ 누락 = 선택 무반응 |
| AR-02 / VP-08 · EP-04 | CSS (7자리) | `app.css`·`tokens.css` | ① `html { font-size: 14.5px }` ②~⑥ 토큰 5종 inline 배율 ⑦ `--reading-column: 960px` | 빌드 | ② 누락 토큰은 트랜스크립트에서 배율 무시 |
| AR-02 / VP-02 · EP-05 | 배율 수용 선언 (1자리) | TranscriptView | `TranscriptView.tsx:83` 루트 className | 렌더 | 누락 = 전 트랜스크립트 배율 1 · 다른 자리 = 그 영역까지 배율 |
| MD-02 / VP-10 · EP-06 | closure 글자 크기 (38자리/17파일) | 아래 표 | 구현자 | 렌더 | 남은 자리는 배율 무시 |
| MD-03 / VP-11 · EP-07 | 환경설정 행 (3자리) + i18n ko·en | `GeneralTab` | ① 밀도 행 삭제 ② 텍스트 크기 행 ③ 너비 행 | 렌더 | 문구·순서 불일치 |
| MD-01 / VP-09 · EP-08 | 배율·폭 매핑 (2자리) | `theme.ts` | ① `TRANSCRIPT_TEXT_SCALE` ② `TRANSCRIPT_WIDTH_PX` | 효과 | 값 오류 |
| VP-01 · EP-09 | density 제거 (51) | — | 비테스트 43 · 테스트 8 | 구현 | 잔여 = 죽은 키·타입 |
| VP-04 · EP-10 | 현행 문서 (15자리) | 문서 | PRD.md:88,258 · TRD.md:46,101,300 · IPC_CONTRACT.md:131 · GLOSSARY.md:25 · persistence.md:27 · layers.md:83 · overview.md:61 · state.md:32,161,171 · terms.md:61 · ux-domains.md:100 | 커밋 | 문서가 없는 설정을 서술 |

**EP-06 자리 표** (줄은 설계 턴 기준)

| 파일 | 자리 |
|---|---|
| `features/chat/components/StatusLine.tsx` | 117 `[12px]` · 128·136·141·148·154 `[11px]` |
| `shared/ui/markdown/Markdown.tsx` | 13 `[12px]` · 21 `[18px]` · 24 `[16px]` · 27 `[14.5px]` · 30 `[13.5px]` · 33 `[12.5px]` · 36 `[12px]` · 85 `[12.5px]` · 115 `[12px]` · 134 `[13.5px]` |
| `transcript/Exchange.tsx` | 92 `[12.5px]` · 98 `[10.5px]` · 105 `[11.5px]` |
| `transcript/AssistantMessage.tsx` | 43 `[14px]` · 48 `text-xs` |
| `transcript/ErrorCard.tsx` | 28 `[13px]` · 33 `[11px]` |
| `transcript/PendingSteerTurn.tsx` | 30 · 39 `[11px]` |
| `transcript/ReasoningBlock.tsx` | 32 `[13px]` · 34 `[11px]` |
| `transcript/TranscriptView.tsx` | 90 · 95 `[13px]` |
| 1자리 파일 9 | `composer/AttachmentThumb.tsx:35` · `transcript/AskExchange.tsx:23` · `transcript/CompactBoundaryMarker.tsx:40` · `transcript/ForkBoundaryMarker.tsx:14` · `transcript/PendingAssistant.tsx:26` · `transcript/StructuredOutputCard.tsx:18` · `transcript/WorkActivity.tsx:33` · `shared/ui/MenuItem.tsx:63` · `shared/ui/SparkSpinner.tsx:11` |

변환 규칙: `text-[Npx]` → `text-[calc(Npx*var(--transcript-text-scale,1))]`, `text-xs` → `text-[calc(0.75rem*var(--transcript-text-scale,1))]`. closure 밖 소비처(컴포저의 `AttachmentThumb`·`MenuTitle` 등)는 변수 미선언이라 배율 1 — 화면 불변.

### 등록 변이 (선택 적대 증거 정본)

| ID | 심을 자리 | 결함 | red여야 할 oracle |
|---|---|---|---|
| M1 | `TranscriptView.tsx` 루트 | 배율 선언 제거 | AC7 render UT |
| M2 | 선언을 `Composer.tsx` 루트(`app-frame-composer`)로 이동 | 형제 자리 맞바꿈 | AC7 render UT + 선언 파일 스캔 |
| M3 | `TweakProvider.tsx` `load()` | `transcriptWidth` 매핑 삭제 | load 매핑 UT |
| M4 | `tokens.css` | 토큰 블록을 `@theme`(inline 없음)로 | CSS 원문 UT |
| M5 | `theme.ts` | `small`↔`large` 배율 맞바꿈 | lifecycle UT |
| M6 | `theme.ts` | `medium` 폭 768 | lifecycle UT + `--reading-column` 기본값 대조 |
| M7 | `Markdown.tsx:134` | `text-[13.5px]` 복귀 | closure 스캔 UT |
| M8 | 스캔 UT의 closure 걷기 | 1단계만 걷기 | closure 포함 단언(`Markdown.tsx`) |
| M9 | `GeneralTab.tsx` | 두 신규 행 설명 맞바꿈 | AC1 render UT |

- 같은 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: enum은 `ipc.ts` 배열 하나를 zod·renderer가 import한다. 매핑 값은 `theme.ts` 하나이고 `tokens.css` 기본값은 CSS 원문 UT가 `TRANSCRIPT_WIDTH_PX.medium` 과 대조한다.
- `실패 의미`에 "다른 게이트가 막는다"를 적었다면 그 범위를 이 턴에 측정한 근거: 해당 없음.
- 선택적 필드의 `true/false/undefined` 의미: 두 키 모두 필수 필드(스키마 기본값). patch에서 미지정 = 변경 없음.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | enum SSOT | `TRANSCRIPT_TEXT_SIZES = ['small','medium','large'] as const`·`TRANSCRIPT_WIDTHS = ['narrow','medium','wide'] as const` + 타입 · `Settings` 에 두 필드 · `DensityPref`·`density` 삭제 | typecheck |
| `app/src/shared/protocol.ts` | zod | `SettingsSchema` 두 키 `z.enum(배열).catch('medium').default('medium')` · `SettingsPatchSchema` 두 키 · `density` 2자리와 `DensityPref` export 삭제 | migration/store UT |
| `app/src/main/infra/settings-migration.test.ts` | 회귀 | density 단언을 "삭제·형제 보존"으로 교체 · 두 키 기본/보존/복구 | UT |
| `app/src/main/infra/settings-store.test.ts` | 회귀 | `patch({density})` 무시 · 두 키 patch → 새 인스턴스 재로드 유지 | IT(인메모리 backend) |
| `app/src/renderer/src/shared/config/theme.ts` | 매핑 | `DensityId`·`DENSITY_FONT` 삭제 · `TRANSCRIPT_TEXT_SCALE`(13/14·1·15/14) · `TRANSCRIPT_WIDTH_PX`(768·960·1200) | UT |
| `app/src/renderer/src/shared/theme/TweakProvider.tsx` | 적용 | `Tweaks` 두 필드 · `DEFAULTS` `medium`·`medium` · `load()` 매핑 · fontSize 효과 삭제 · 효과 2개(`setProperty`) | lifecycle·store UT |
| `app/src/renderer/src/styles/app.css` | 루트 | base에 `html { font-size: 14.5px; }` | CSS 원문 UT |
| `app/src/renderer/src/styles/tokens.css` | 토큰 | 타이포 5종(+line-height·weight 하위 토큰)을 `@theme inline` 블록으로, 값은 `calc(<기존값> * var(--transcript-text-scale, 1))` · `--reading-column: 960px` · density 주석 3곳 정정 | CSS 원문 UT |
| `.../transcript/TranscriptView.tsx` | 수용 | 루트 className에 `[--transcript-text-scale:var(--chat-text-scale,1)]` · `:90,:95` 변환 | render UT |
| EP-06 나머지 16파일 | 배율 | §10 변환 규칙 | closure 스캔 UT |
| `app/src/renderer/src/features/settings/components/GeneralTab.tsx` | UI | 밀도 행·옵션·선택자 삭제 · 두 행(옵션 배열은 enum 배열 + 라벨 키) | render UT |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | density 5키 삭제 · `transcriptTextSize`·`…Desc`·`…Small/Medium/Large` · `transcriptWidth`·`…Desc`·`…Narrow/Medium/Wide`(en: "Transcript text size" · "The size of conversation text." · "Transcript width" · "Maximum width of the transcript and composer column.") | typecheck(패리티) |
| `TweakProvider.{store,lifecycle}.test.ts` · `app/tweakConsumers.render.test.ts` | 회귀 | density·fontSize 단언 교체(새 기본값·setProperty 3종·GeneralTab 선택 키) | UT |
| 신규 `app/src/renderer/src/features/settings/components/generalTab.render.test.ts` | AC1 | `useTweakContext` mock(tweakConsumers 선례) + `renderToStaticMarkup` | UT |
| 신규 `app/src/renderer/src/styles/typeScale.test.ts` | AC2·AC8·AC9 | CSS 원문 + closure 걷기 스캔(설계 턴 스크립트와 같은 규칙: `(import\|export)…from '\.…'` 상대 경로, `.tsx`, 테스트 제외) | UT |
| `DebugPanel.tsx`·`composerPanel.ts`·`parts.tsx` | 주석 | 밀도 서술 정정 | — |
| 문서 15자리 + `docs/generated/inventory.md` | 현행화 | §10 EP-10 · 인벤토리 재생성 | AC11 |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: `theme.ts`(매핑) · settings-migration(순수). settings-store는 `RawSettingsBackend` 인메모리 주입(기존 seam).
- 기존 메커니즘 재사용 시 형상/시점 적합성: `--font-app` 효과(`TweakProvider.tsx:144-146`)와 같은 `setProperty` 형태 — 값이 바뀔 때만 실행.
- 순서를 관측할 훅/로그/주입 경계: 해당 없음(순서 계약 없음).

## 12. End-to-end 영향

### producer → consumer

```text
GeneralTab → setTweak → settings:set → SettingsStore(zod) → disk
boot → settings:get → TweakProvider.load → effects → html style vars → TranscriptView/ReadingColumn
```

- producer 기준: 저장 값은 enum 문자열. 숫자 배율·px는 renderer 매핑만 안다.
- consumer 파생 규칙: 트랜스크립트 루트는 `var(--chat-text-scale,1)` 로 받고, 소비 클래스는 `var(--transcript-text-scale,1)` 기본 1.
- 파생 가능한 합성값이 정본을 우회하지 않는가: 숫자를 저장하지 않는다 — 매핑 변경이 저장값 이관을 요구하지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| 모든 rem 기반 UI(설정·사이드바·컴포저) | 기본 밀도(13px) 사용자는 글자·여백이 14.5/13 = 1.115배 | AC2 · AC12(실기) |
| `ReadingColumn` 3자리 | 기본 폭 768 → 960 | AC10 · AC12 |
| `Markdown` 비트랜스크립트 소비(`ApprovalCard`·`ArtifactPreviewContent`·`PlanTileContent`·`SkillDetail`) | 변수 미선언 → 배율 1, 크기 불변 | AC7 · AC8 |
| 포털 팝오버(`Popover` → `document.body`) | 배율 1 | AC7 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 부팅 load 전 첫 프레임은 `DEFAULTS` 효과(보통·960px).
- 취소/중단: 해당 없음.
- 종료/quit/crash/renderer-gone: 저장은 `settings:set` 동기 쓰기 — 기존과 동일.
- retry/timeout/partial failure: `setTweak` 실패 롤백(기존).
- cleanup/rollback: 효과는 값만 덮어쓴다. 해제 시 원복 불요(앱 수명 = 문서 수명).
- **다중 저장소 쓰기**: 해당 없음 — 설정 1곳(electron-store). 문서 산출의 상태 사본은 이 plan과 `INDEX.md` 두 곳이며 마무리 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력·요청 수: 해당 없음.
- 배율 변경은 CSS 변수 1개 갱신 → 트랜스크립트 리플로 1회. 가상화 head 항목은 `measureElement` 가 다시 잰다(기존 경로).
- 캐시/호출 축소: 해당 없음.

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

- 해당 없음 — 내부 설정 계약. IPC 페이로드 형태(`Settings`)는 `IPC_CONTRACT.md` §2.4 를 같은 변경에서 갱신한다(docs/AGENTS 규칙 6).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 밀도 = 설정 단독 노출(0132·0149) | `DebugPanel.tsx:88-89` | D-002 | 변경 — 사용자 결정으로 밀도 자체 제거 |
| PRD F10 밀도 11.5/13/14.5 | `docs/PRD.md:88,258` | D-001·D-002 | 변경 — 사용자 요구로 정정 |
| 새 CSS 규칙 금지·Tailwind 유틸 우선 | `src/renderer/AGENTS.md` §스타일 | `app.css` `html` 한 줄 · 토큰 `@theme inline` | 유지 — 문서 루트 기준값은 JSX에서 닿지 않는 base 레이어 몫이고, 토큰 수정은 `tokens.css` `@theme` 규칙 안이다 |
| 새 토큰은 두 테마 스코프에 값 | 같은 문서 | 배율 토큰 | 유지 — 테마 무관 값이라 `[data-theme='dark']` 재정의 불요(`--color-spinner` 선례) |
| `--reading-column` = transcript·composer 단일 출처 | `tokens.css:169` 주석 · `ReadingColumn.tsx:8` | D-008 | 유지 — 값만 설정화 |
| 설정 enum SSOT = `ipc.ts` | `ipc.ts:1062-1066` 주석 | EP-01 | 유지 |
| `docs/arch` 에 이력 금지 | `docs/AGENTS.md` 규칙 4 | EP-10 | 유지 — "0256에서 제거" 같은 델타를 쓰지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 기본 밀도 사용자의 전체 UI가 11.5% 커진다 | 사용자 요구 그대로(D-001). AC12 실기에서 잘림 확인 |
| 기본 폭 768→960 | 사용자 결정(D-006) |
| `@theme inline` 전환으로 `--text-*` 변수가 `:root` 에 방출되지 않는다 | 직접 참조 0건(§8). 스캔 UT가 신규 참조를 막지는 않으므로 §16에 기록 |
| closure 신규 파일이 고정 px를 다시 쓴다 | AC8 스캔이 시험 시점 closure를 다시 계산한다 |

- 되돌리기 어려운 결정: 저장 키 이름(D-007).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{ipc,protocol}.ts`
- `app/src/main/infra/settings-{migration,store}.test.ts`
- `app/src/renderer/src/shared/{config/theme.ts,theme/TweakProvider.tsx,theme/TweakProvider.*.test.ts,i18n/resources/{ko,en}.ts}`
- `app/src/renderer/src/styles/{app.css,tokens.css}` · 신규 `styles/typeScale.test.ts`
- `app/src/renderer/src/features/settings/components/{GeneralTab.tsx,parts.tsx}` · 신규 `generalTab.render.test.ts`
- EP-06 17파일 · `features/debug/components/DebugPanel.tsx` · `features/chat/components/composer/composerPanel.ts` · `app/tweakConsumers.render.test.ts`
- `docs/{PRD,TRD,IPC_CONTRACT,GLOSSARY}.md` · `docs/arch/backend/persistence.md` · `docs/arch/frontend/{layers,overview,state,terms,ux-domains}.md` · `docs/generated/inventory.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md §테스트`.
- ABI/네트워크 등 환경 제약: DB 미사용 — `npm test` 불요.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-A gate 표의 vitest 명령.
- 사람 실기: AC12.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — 턴 2 질의 응답 D-006.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — "제거"를 능력 제거로(D-002), 원문 설명 문구 인용.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §3 대조 줄.
- [x] Technical Design에 AS-IS와 TO-BE가 같은 축으로 있다.
- [x] AS-IS → TO-BE Delta의 각 변경이 파일 또는 AC에 추적된다.
- [x] AS-IS에서 사라진 책임(루트 글자 효과)은 `app.css` 로 이동이라고 적었다.
- [x] 수치·전칭·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 표.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] Baseline V를 썼다.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair가 있다.
- [x] INHERITED node 없음.
- [x] 각 pair의 경로·§10 자리 수·직접 oracle이 있고 적대 증거는 자리·0건·표 pair만 선택했다.
- [x] 운영 gate가 열거됐다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 실기는 렌더 크기·폭(AC12)만.
- [x] semantic 목표(트랜스크립트만 배율)를 선언 자리 render + closure 스캔 + 토큰 원문으로 잠갔다.
- [x] "X가 쓰인다" 불변식(선언·토큰 inline)은 지우면(M1·M4) red, 자리를 바꾸면(M2) red다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다.
- [x] 부팅 변경의 기존 소비처를 전수 확인했다 — §12 표.
- [x] producer/consumer 양쪽 의미를 확인했다.
- [x] one-way door(저장 키)를 지금 확정했다.
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다.
- [x] 본문 완성 후 `ACTIVE 결정 ↔ AC` 대조를 §3에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출** | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
