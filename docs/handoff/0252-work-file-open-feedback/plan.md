# Plan — 0252-work-file-open-feedback

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**
> 같은 세션 요청 1)(원격 사용량 내역)은 [`0251-remote-usage-breakdown`](../0251-remote-usage-breakdown/plan.md)로 분리했다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0252-work-file-open-feedback` |
| 작성자 | Claude Code |
| 일자 | 2026-10-06 |
| 매핑 | — |
| 상태 | verify/PASS (r1.2 · 기계 범위) — AC14 사람 실기 대기 |
| V mode | `Baseline V` |
| 기준 V | `none` — 0242 카드·toast 동작은 INHERITED 노드로만 참조한다(§7-A) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제 ①: Work transcript 파일 카드에서 저장·탐색기에서 보기·휴지통 동작을 누르면 카드 아래에 '처리 중' 줄이 잠깐 생겼다 사라져 카드 높이가 순간적으로 바뀐다(`ArtifactCard.tsx:126-130`).
- 해결하려는 문제 ②: 우측 패널 '컨텍스트'의 파일 항목이 전체 경로를 그대로 보여 주고(`TaskContextContent.tsx:167-169`), 누르면 파일을 열지 않고 탐색기에서 위치만 보여 준다(`:153` `mode:'reveal'`). 없는 파일도 같은 경로로 실패해 원인이 "위치를 열지 못했습니다"로만 보인다.
- 완료 후 달라지는 것: 카드는 동작 중에도 높이가 그대로이고 실패는 toast 로만 알린다. 컨텍스트 파일 항목은 파일명만 보이고 마우스를 올리면 전체 경로가 뜬다. 누르면 파일이 있는지 먼저 확인하고, 없으면 toast, 있으면 허용 형식은 기본 앱으로 열고, 열 수 없으면 탐색기에서 위치를 연다.
- 바뀌지 않는 것: 카드의 미리보기·다운로드·메뉴 동작과 실패 toast, 컨텍스트 폴더 칩, 웹 출처 링크, 파일을 열 수 있는 범위(세션 폴더·첨부).
- 성공을 한 문장으로: **"파일 카드는 흔들리지 않고, 컨텍스트 파일은 이름으로 보이며 누르면 열리거나 위치가 열리고, 없으면 토스트로 알려 준다."**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "work모드의 transcript 에 파일 카드에서 파일을 열때, '여는중' 같은 모델 카드의 크기를 순간적으로 변경하는 안내를 제거하라. 실패 흡수는 에러 토스트가 하도록 한다." | 2026-10-06 세션 요청 2) |
| 명시 요구 | "work 모드의 transcript에서, 우측 패널의 컨텍스트 내 항목 표기에서 항목이 파일일 경우 파일명으로만 표시한다. 마우스 호버시 전체경로를 툴팁으로 표기." | 요청 3) |
| 명시 요구 | "파일열기를 시도할때 열지 못하는 경우 해당 파일의 위치 열기(탐색기). 없는 파일인지 우선 확인하여 없을 경우 에러 토스트가 흡수." | 요청 3) |
| 명시 결정 | 실행 파일·스크립트 처리 → "허용 형식만 열기" — 선택지 원문: "문서·이미지·텍스트·데이터 형식(pdf, docx, xlsx, png, txt, md, csv, json, log 등)만 기본 앱으로 연다. 나머지는 '열지 못하는 경우'로 보고 탐색기에서 위치를 연다." | 질의 4 답 |
| 추론 의도 | '여는중' 같은 안내 = 카드 아래 `chat.artifacts.working`('처리 중') 상태 줄. 카드에서 높이를 바꾸는 조건부 문구는 이것 하나다 | `ArtifactCard.tsx` 전수(§8) — `여는 중` 문자열은 저장소에 0건 |
| 추론 의도 | "파일 열기" = OS 기본 앱으로 열기. 폴백이 탐색기라는 문장이 같은 OS 수준 동작을 가리킨다 | 요청 3) 원문 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | transcript 파일 카드에서 동작 중 카드 아래에 붙던 '처리 중' 상태 줄을 제거한다. 동작 중 카드 마크업은 버튼 비활성 속성 외에 달라지지 않는다 | 요청 2) "카드의 크기를 순간적으로 변경하는 안내를 제거" | 사용자 | ACTIVE | 0242 AC18 "busy → `working` 1" 을 대체(§16) |
| D-002 | 파일 카드 동작·미리보기 실패는 toast 로만 알린다(카드 안 문구 0) | 요청 2) "실패 흡수는 에러 토스트가 하도록" — 0242 D-011 이 이미 구현 | 사용자 · 0242 | ACTIVE | — |
| D-003 | 동작 중 상태는 버튼 비활성으로만 드러낸다 | 0242 D-012 "버튼 비활성은 작업 중(busy)만" 유지 | 0242 | ACTIVE | — |
| D-004 | 컨텍스트 패널의 파일 항목(Read 출처)은 파일명만 표시하고, 마우스를 올리면 전체 경로를 툴팁으로 보인다 | 요청 3) | 사용자 | ACTIVE | — |
| D-005 | 파일 항목을 누르면 파일을 연다. 열지 못하는 경우 그 파일의 위치를 탐색기에서 연다(파일 선택 상태) | 요청 3) | 사용자 | ACTIVE | 현재 "누르면 위치만 연다"를 대체 |
| D-006 | 열기 전에 파일이 있는지 먼저 확인한다. 없으면 error toast 만 띄우고 열기·탐색기 모두 하지 않는다 | 요청 3) "없는 파일인지 우선 확인하여 없을 경우 에러 토스트가 흡수" | 사용자 | ACTIVE | — |
| D-007 | 기본 앱으로 여는 것은 허용 형식뿐이다: `pdf docx xlsx pptx` · `png jpg jpeg gif bmp webp tif tiff` · `txt md markdown log csv tsv json jsonl xml yaml yml`. 그 밖의 형식(실행 파일·스크립트·바로가기·설치 파일·매크로/OLE/스크립트를 실행할 수 있는 문서·확장자 없음)은 "열지 못하는 경우"로 보고 위치를 연다 | 질의 4 답 — 기본 앱 열기는 실행 파일·스크립트를 실행한다 | 사용자(범주) · 설계(목록) | ACTIVE | — |
| D-008 | 허용 형식 판정은 실제 경로(realpath)의 확장자를 소문자로 비교한다 | 바로가기·연결 경로가 허용 확장자 뒤에 실행 파일을 숨기지 못하게 | 설계 | ACTIVE | — |
| D-009 | 열 수 있는 범위는 지금과 같다 — 그 Work 세션의 기록된 폴더(cwd·추가 폴더) 안 파일 또는 그 세션 첨부로 기록된 파일. 이 판정은 기존 `reveal` 과 새 열기가 **같은 함수**를 쓴다 | 보안 규칙의 두 사본 방지 | 설계 | ACTIVE | — |
| D-010 | 없는 파일 판정은 범위 판정(경로 문자열 기준)을 통과한 경로에만 준다. 범위 밖 경로는 존재 여부와 무관하게 거부한다 | 범위 밖 경로의 존재 여부를 알려 주지 않는다 | 설계 | ACTIVE | — |
| D-011 | 기본 앱 열기 성공과 위치 열기 폴백은 toast 를 띄우지 않는다. 범위 밖·디렉터리·IO 오류는 toast `openFailed` | 열린 창이 결과다. 실패만 toast(D-002 와 같은 원칙) | 설계 | ACTIVE | — |
| D-012 | 첨부 항목(경로가 기록된 것)도 D-005~D-011 을 따른다. 표시 이름은 원래 첨부 이름(이미 파일명)이고 툴팁은 저장 경로 | 첨부도 파일이다 | 설계 | ACTIVE | — |
| D-013 | 폴더 칩·웹 출처는 바꾸지 않는다 | 요청 범위 밖 | 설계 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-013 (신규 handoff).
- 변경된 결정: handoff 내부 없음. **외부 결정 변경**: 0242 AC18 의 "busy 면 `working` 문구 1" 을 D-001 이 0 으로 바꾼다(§16). 0242 AC22 의 실패 문구 "파일 위치를 열지 못했습니다." 는 파일 항목에서 "파일을 열지 못했습니다." 로 바뀐다(D-005 파생).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0242 D-011(동작 시 toast)·D-012(비활성은 busy 만)·D-014(결과 받은 뒤 뷰어 공간), 0211/0226 컨텍스트 범위 규칙.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1 · D-002↔AC2·AC9 · D-003↔AC1 · D-004↔AC3 · D-005↔AC5·AC6 · D-006↔AC8 · D-007↔AC5·AC7 · D-008↔AC7 · D-009↔AC10 · D-010↔AC8 · D-011↔AC5·AC6·AC9 · D-012↔AC4 · D-013↔AC11. 반대 방향을 요구하는 AC 없음.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 카드 높이 변화의 원인은 busy 조건부 상태 줄 하나다 | `ArtifactCard.tsx:126-130` · 미리보기 대기(`opening`)는 `aria-busy`·커서만 바꾼다(`:50-52`) |
| 이미 충족되는가 | 실패 toast 는 이미 된다(0242 D-011). 상태 줄·파일명 표시·열기·존재 확인은 아니다 | `ArtifactCards.tsx:61-74` · `TaskContextContent.tsx:153·168` |
| 더 작은 해법 | 렌더러에서 `fileApi.openPath` 를 두 번(열기 → 실패 시 reveal) 부르는 안 → main 에 "파일 열기" 모드가 없고 존재 확인·허용 형식 판정이 렌더러 신뢰에 걸린다. 기각 — main 한 채널이 판정한다 | `files.ts:119-196` |
| 선행 자료 대조 | 0242 AC18 이 '처리 중' 1 을 요구해 테스트가 잠갔다 — 사용자 요청으로 뒤집는다 | `ArtifactCard.render.test.ts:105-126` |
| 기존 결정과 충돌 | 0242 AC18 문구 부분만 변경(§16). 범위 보안 규칙은 유지(D-009) | `files.ts:116-165` |

- 사용자에게 올릴 결정: 없음 — 실행 형식 처리는 질의 4 로 닫았다.
- 코드 조사로 닫은 사실: 저장소에 `여는 중`·`열기 중` 문자열 0건, 카드의 조건부 문구는 `chat.artifacts.working` 하나(§8). `shell.openPath` 는 실패 시 오류 문자열을, 성공 시 `""` 를 돌려준다(`electron.d.ts` `openPath(path): Promise<string>`).

## 5. 동작 / 사용자 흐름

```text
[transcript 파일 카드: 다운로드·메뉴 동작]
  → 버튼 비활성(카드 높이 불변) → 완료 → 실패면 toast
[컨텍스트 파일 항목 클릭]
  → main: 범위 확인 → 존재 확인
      ├ 없음 → toast "파일이 없습니다…" (열기·탐색기 0)
      ├ 허용 형식 → 기본 앱 열기 ── 실패 → 탐색기 위치 열기
      ├ 허용 밖 형식 → 탐색기 위치 열기
      └ 범위 밖·디렉터리·IO → toast "파일을 열지 못했습니다."
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 카드 동작 시작(busy) | 다운로드·메뉴·미리보기 버튼 비활성 | 카드 높이 그대로, 문구 없음 |
| 카드 동작 실패 | `reportArtifactIssue` | toast(기존) |
| 컨텍스트 항목 표시 | 파일명 렌더, `title`=전체 경로 | 이름만 보이고 hover 시 전체 경로 |
| 허용 형식 파일 클릭 | `shell.openPath(실제 경로)` → `""` | 기본 앱이 열린다, toast 0 |
| 허용 형식이지만 열기 오류 | `openPath` 오류 문자열 → `showItemInFolder` | 탐색기가 파일을 선택해 열린다, toast 0 |
| 허용 밖 형식 클릭 | `showItemInFolder` | 탐색기 위치, toast 0 |
| 없는 파일 클릭(범위 안) | 열기·탐색기 0 | toast `파일을 사용할 수 없습니다` + `이름: 파일이 없습니다…` |
| 범위 밖·디렉터리·IO 오류 | reject | toast `파일을 열지 못했습니다` + `이름: 파일을 열지 못했습니다.` |
| 다른 세션으로 이동한 뒤 늦은 클릭 | 요청 0(기존 가드) | 아무 일 없음 |

### 파생 UX / 엣지케이스

- loading: 열기 요청 동안 기존처럼 컨텍스트 버튼이 비활성(`openingPath`)이다 — 크기 변화 없음.
- error: 실패 문구는 패널 안에 남지 않는다(인라인 alert 0, 0242 AC22 유지).
- concurrency: 열기 진행 중 다른 항목 클릭은 기존 `opening` ref 가드로 무시된다.
- keyboard / a11y: 파일 항목 `aria-label` 은 "{파일명} 파일 열기". 카드에서 사라진 상태 줄 대신 버튼 비활성이 상태를 전한다.
- 외부환경: Windows 는 연결 프로그램이 없는 형식에 "연결 프로그램 선택" 창을 띄울 수 있다 — `openPath` 가 오류를 주지 않으면 폴백하지 않는다(§17, AC14 실기).

## 6. 범위 / 비범위

- **범위**: `ArtifactCard` 상태 줄 제거 · `TaskContextContent` 파일 표시·클릭 흐름 · 새 IPC 채널 `orca:files:openContextFile` · main 공유 해석기·허용 형식 판정 · i18n 3키 · `IPC_CONTRACT.md` · inventory · 관련 테스트.
- **비범위**: 카드 미리보기(뷰어) 흐름 · `list` 변형 카드 · 폴더 칩 · 웹 출처 · `filesOpenPath` 의 `directory`·sessionId 없는 `reveal` 동작 · 허용 형식 설정 UI.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 허용 형식 추가(hwp·xls 등) | 아니오 — 상수 1곳 | 사용자 요청 시 |
| **IPC 채널 이름·결과 형태** | **예 — 공개 계약** | 지금 확정(§10) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | transcript 카드가 busy 여도 '처리 중' 문구와 `role="status"` 가 없고, busy 마크업에서 `disabled=""` 속성을 지우면 idle 마크업과 같다 | 렌더 테스트: idle/busy 마크업 비교 · 문구 0 · status 0 | `AssistantTurn` → `ArtifactCards` → `ArtifactCard` |
| R-02 | AT-02 / AC2 | 카드 동작·미리보기 실패는 toast 로 알리고 카드에 문구를 남기지 않는다 | 기존 `ArtifactCards.lifecycle.test.ts:276`·`artifactViewerStore.test.ts:143` green | `ArtifactCards.run` · `openArtifactViewer` |
| R-03 | AT-03 / AC3 | Read 출처 파일 항목 텍스트 = 파일명(`C:\w\docs\a.md`·`/w/docs/a.md` → `a.md`), `title` = 전체 경로, `aria-label` = "a.md 파일 열기" | 렌더 테스트(경로 2종) | `TaskTile` 컨텍스트 → `TaskContextContent` |
| R-03 | AT-03 / AC4 | 첨부 항목 텍스트 = 원래 첨부 이름(유지), `title` = 저장 경로(있으면). 경로가 있는 첨부 클릭도 `openContextFile({path, sessionId})` 를 부르고 경로 없는 첨부는 비활성 | 기존 첨부 사례 갱신(호출 대상 `openPath`→`openContextFile`) | 동상 |
| R-04 | AT-04 / AC5 | 범위 안 허용 형식 파일 → main 이 `shell.openPath(실제 경로)` 1회·`showItemInFolder` 0·결과 `{outcome:'opened'}` → 렌더러 toast 0 | main 통합(실 fs·SQLite·electron mock) + 렌더러 테스트 | 항목 클릭 → `fileApi.openContextFile` → preload → `filesOpenContextFile` |
| R-05 | AT-05 / AC6 | `shell.openPath` 가 오류 문자열을 주면 `showItemInFolder(실제 경로)` 1회·결과 `{outcome:'revealed', reason:'open-failed'}` → toast 0 | main 통합(openPath mock 이 `'no app'`) + 렌더러 테스트 | 동상 |
| R-05 | AT-05 / AC7 | 허용 목록 밖(`.exe .bat .cmd .ps1 .py .js .lnk .html .svg .docm .xls .rtf` · 확장자 없음 · 끝 점 `a.pdf.`)은 `openPath` 0·`showItemInFolder` 1·`{outcome:'revealed', reason:'unsupported-type'}`. 대문자 `.PDF` 는 허용 | 판정 순수 표 + main 통합 대표 3종(`.py`·`.exe`·확장자 없음) | 동상 |
| R-06 | AT-06 / AC8 | 범위 안 없는 파일 → `openPath`·`showItemInFolder` 0·`{outcome:'missing'}` → toast 1건 `title:'fileUnavailable'`, `detail:'gone.md: 파일이 없습니다. 삭제되었거나 이동되었을 수 있습니다.'`. 범위 밖 없는 경로 → reject `허용되지 않은` | main 통합 2사례 + 렌더러 테스트 | 동상 |
| R-07 | AT-07 / AC9 | 그 밖 실패(범위 밖·디렉터리·IO reject) → toast 1건 `title:'openFailed'`, `detail:'{파일명}: 파일을 열지 못했습니다.'`, 패널 `role="alert"` 0 | 렌더러 테스트(기존 0242 AC22 사례 갱신) | 동상 |
| R-08 | AT-08 / AC10 | 새 채널과 기존 `reveal`+sessionId 가 같은 범위 해석기를 쓴다 — 기존 '컨텍스트 파일 reveal' 보안 사례가 두 입구 모두에서 같은 거부/허용을 낸다. 해석기 정의 1곳 | main 통합 `it.each(['reveal','open'])` + `rg -n "export async function resolveContextFile" app/src/main` = 1 | `files.ts` 두 핸들러 |
| R-09 | AT-09 / AC11 | 폴더 칩은 지금처럼 `openPath({mode:'directory', sessionId})` 를 부른다 | 기존 directory 테스트 green + 렌더러 폴더 클릭 단언 | `TaskContextContent` 폴더 칩 |
| R-10 | AT-10 / AC12 | IPC 계약: `CHANNELS.filesOpenContextFile = 'orca:files:openContextFile'`, 요청 `{path, sessionId}` zod(무효 = reject), 응답 `OpenContextFileResult`, preload·`fileApi`·`IPC_CONTRACT.md` 행, inventory 채널 수 | 스키마 테스트 · `ipc-documentation.test.ts` · `check-doc-inventory.mjs --check` | preload → main |
| R-10 | AT-10 / AC13 | i18n ko/en 리프 키 집합 일치(신규 `chat.taskTile.sourceMissing`, 문구 변경 `openSourceFile`·`sourceOpenFailed`), 레지스트리 T34(catch 1개·event `files.context-open.failed`·title `openFailed`) 유지 | `resources.test.ts` · `reportSites.registry.test.ts` | — |
| R-11 | AT-11 / AC14 | Windows 실기: ①`.pdf`·`.txt` 항목 → 기본 앱 ②`.py` → 탐색기에서 선택 ③항목의 파일을 지운 뒤 클릭 → toast ④파일명만 보이고 hover 시 전체 경로 ⑤카드 다운로드·탐색기에서 보기 중 카드 높이 불변 | 사람 실기 — §19 절차 | `npm run dev` Electron |

### AC 검증 주의사항

- 기존 테스트 재사용: `ArtifactCard.render.test.ts:105` 'disables actions only while busy…'(실재 — '처리 중' 단언을 뒤집는다) · `ArtifactCards.lifecycle.test.ts:276` · `artifactViewerStore.test.ts:143` · `TaskContextContent.test.ts` 첨부 사례·0242 AC22 사례 · `files.contextDirectory.test.ts:166-` '컨텍스트 파일 reveal' 블록 · `files.openPath.test.ts` 실재 확인.
- 사람 실기 항목: AC14 — OS 기본 앱 실행·탐색기 창·카드 시각 높이는 Electron 실기만 관측한다. 판정 로직(허용 형식·존재·범위·결과→toast)은 전부 AC5~AC10 기계 테스트로 내렸다.
- N회 기준: AC5~AC8 의 `openPath`·`showItemInFolder` 횟수는 새 핸들러 한 번 호출 안의 횟수다. sink 프로덕션 호출부 전수 `rg -n "shell\.(openPath|showItemInFolder)" app/src/main/app/handlers/files.ts` → 현재 3(`:163`·`:184`·`:194`), 구현 후 새 핸들러 2 추가 — 관측(electron mock)이 모든 호출부를 모형한다.
- 0건 기준: AC1 문구 0 은 transcript 변형 한정이다(`list` 변형은 원래 0).

## 7-A. V / Trace Matrix

- V mode 판정: 카드·컨텍스트 열기에 상속할 V 가 있는 plan 은 0242 이나 이번 변경은 그 V 의 일부(AC18·AC22)만 닿는다. 0242 는 종료(PASS)된 별도 handoff 라 Delta V 로 잇지 않고 Baseline V1 + INHERITED 노드로 참조한다.
- 기준 V 상속 근거: 없음. INHERITED 출처 = `0242:plan@3569f57d` (`origin/main` 에서 `git cat-file -t` = commit 확인).
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 카드 높이 불변(AC1) | CHANGED | `0242:plan@3569f57d` AC18("busy → working 1") |
| R-02 | R | §7 카드 실패 toast(AC2) | INHERITED | `0242:plan@3569f57d` AC19·AC20 |
| R-03 | R | §7 파일명·툴팁(AC3·AC4) | NEW | — |
| R-04 | R | §7 기본 앱 열기(AC5) | NEW | — |
| R-05 | R | §7 위치 열기 폴백(AC6·AC7) | NEW | — |
| R-06 | R | §7 없는 파일 toast(AC8) | NEW | — |
| R-07 | R | §7 기타 실패 toast(AC9) | CHANGED | `0242:plan@3569f57d` AC22(문구 변경) |
| R-08 | R | §7 범위 보안 공유(AC10) | INHERITED | `files.ts:116-165` · `files.contextDirectory.test.ts:166-` |
| R-09 | R | §7 폴더 칩 유지(AC11) | INHERITED | `files.contextDirectory.test.ts:78-` |
| R-10 | R | §7 IPC·i18n 계약(AC12·AC13) | NEW | — |
| R-11 | R | §7 실기(AC14) | NEW | — |
| AT-01~AT-11 | AT | §7 검증 수단 칸 | R 과 같은 provenance | — |
| SD-01 | SD | §5·§13 클릭 → 해석 → 열기/폴백/missing → toast | NEW | — |
| ST-01 | ST | §11 렌더러+main 테스트 | NEW | — |
| AR-01 | AR | §10 IPC 채널 `filesOpenContextFile` | NEW | — |
| AR-02 | AR | §10 공유 해석기 `resolveContextFile` | CHANGED | `files.ts:120-165` 인라인 reveal 판정 |
| AR-03 | AR | §10 i18n·레지스트리 | CHANGED | `ko.ts:832-833` · 레지스트리 T34 |
| IT-01~IT-03 | IT | §11 테스트 | AR 과 같은 provenance | — |
| MD-01 | MD | §10 허용 형식 판정 `opensWithDefaultApp` | NEW | — |
| MD-02 | MD | §10 렌더러 결과→toast 매핑 | NEW | — |
| UT-01·UT-02 | UT | §11 테스트 | MD 와 같은 provenance | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `ArtifactCards`(files busy) → `ArtifactCard` transcript 마크업 | AC1 마크업 차이 = `disabled` 뿐 | required — 음성 불변식. M1: 상태 줄 복원 · M2: 다른 문구(`aria-live` span 등)로 대체 → 마크업 비교 red | EP-01 (1) |
| VP-02 | R-02 ↔ AT-02 | REGRESSION | `run` → `artifactOperationIssues` → `reportArtifactIssue` · `openArtifactViewer` → `blocked` | 기존 테스트 2건 | not selected — 기존 행동 테스트 직접 oracle | 0 + 이유: 경로 무변경 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `messages` → `createTaskContextSourceSelector` → 항목 렌더 | AC3·AC4 텍스트·title·aria | required — 형제 자리: M3 텍스트↔title 맞바꿈(이름이 title, 전체 경로가 텍스트) → red | EP-07 (3) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 클릭 → `openContextPath` → `fileApi.openContextFile` → preload → 핸들러 → `resolveContextFile` → `opensWithDefaultApp` → `shell.openPath` | AC5 호출 인자·횟수·결과·toast 0 | not selected — 직접 oracle | EP-03 (2) · EP-08 (7) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | VP-04 경로 → 오류 분기/허용 밖 분기 → `showItemInFolder` | AC6·AC7 | required — M4: 허용 판정 제거(항상 openPath) · M5: 오류 시 폴백 제거 · M6: 판정을 요청 경로 확장자로 | EP-03 (2) · EP-04 (1) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | VP-04 경로 → 해석기 존재 확인 → `missing` → 렌더러 toast | AC8 shell 0·결과·toast 1 | required — M7: 존재 확인을 realpath 뒤로(→ reject 로 바뀜) · M8: 범위 판정 전 missing 반환 | EP-02 (2) · EP-06 (1) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | reject → catch → `reportError` T34 | AC9 toast·alert 0 | not selected — 직접 oracle + 레지스트리 변이 기존 | EP-06 (1) |
| VP-08 | R-08 ↔ AT-08 | REGRESSION | `filesOpenPath` reveal+sessionId · `filesOpenContextFile` → `resolveContextFile` | AC10 it.each 두 입구 | required — M9: 새 채널에 연결 경로 검사 없는 사본 사용 → open 입구 사례 red | EP-05 (2) |
| VP-09 | R-09 ↔ AT-09 | REGRESSION | 폴더 칩 → `openPath({mode:'directory'})` | 기존 directory 테스트 + 렌더러 단언 | not selected | 0 + 이유: 경로 무변경 |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | `CHANNELS` → 스키마 → preload → `fileApi` → 핸들러 등록 → 문서·inventory | AC12·AC13 | not selected — 직접 oracle | EP-08 (7) · EP-09 (6) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | Electron 실기 | §19 결과 | not selected — 사람 실기 | 0 + 이유: 실기 |
| VP-12 | SD-01 ↔ ST-01 | REQUIRED | VP-04~VP-07 경로 결합 | 렌더러 결과별 toast 표 + main 결과 표 | VP-05·VP-06 변이 공유 | EP-02 · EP-04 · EP-06 |
| VP-13 | AR-01 ↔ IT-01 | REQUIRED | VP-10 경로 | 스키마 reject/accept · 등록 | not selected | EP-08 |
| VP-14 | AR-02 ↔ IT-02 | REQUIRED | 두 핸들러 → 해석기 | AC10 | VP-08 M9 공유 | EP-05 |
| VP-15 | AR-03 ↔ IT-03 | REQUIRED | i18n 리소스 · 레지스트리 | AC13 | not selected | EP-09 |
| VP-16 | MD-01 ↔ UT-01 | REQUIRED | 순수 | AC7 판정 표 | VP-05 M4·M6 공유 | EP-03 |
| VP-17 | MD-02 ↔ UT-02 | REQUIRED | 순수(렌더러 결과 처리) | AC5·AC6·AC8·AC9 toast 표 | VP-06 공유 | EP-06 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| 관련 vitest | 수정 모듈 | §19 목록 | 같음. DB 스위트 ABI 서명 실패는 환경 기준선 |
| doc inventory | IPC 채널 수 | `cd app && node scripts/check-doc-inventory.mjs --check` | 불일치 blocking |
| 커밋 trailer 파싱 | message-bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| transcript 카드 busy 상태 줄: `{file?.busy && transcript && (<div className="mt-1 …" role="status">{tr('chat.artifacts.working')}</div>)}` — 한 줄이 생겨 카드가 커진다 | `ArtifactCard.tsx:126-130` |
| 미리보기 대기는 `aria-busy` + `aria-busy:cursor-progress` 뿐(크기 불변) | `ArtifactCard.tsx:50-52` · `ArtifactCards.tsx:37-40` |
| busy 는 `runArtifactAction` 이 save·reveal·trash 동안 켠다 | `artifactStore.ts:227-229·259-263` |
| 카드 실패는 toast(`reportArtifactIssue`), `busy` 사유는 실패가 아니라 건너뛴다 | `ArtifactCards.tsx:55-75` |
| `chat.artifacts.working` 은 `artifactFailureKey('busy')` 도 쓴다 — 키는 남긴다 | `artifactFeedback.ts:20-21` |
| 컨텍스트 파일 항목: 텍스트 = `source.path`(전체 경로), `title` = `source.path`, 클릭 = `openPath({mode:'reveal', sessionId})` | `TaskContextContent.tsx:145-170` |
| 실패 toast 는 catch 1곳(T34): event `files.context-open.failed`, title `openFailed`, detail `basename: 사유` | `TaskContextContent.tsx:49-62` · 레지스트리 `reportSites.registry.test.ts:152-159` |
| main reveal+sessionId 판정: 절대·비루트 → 범위(폴더·첨부) → realpath → 파일 → 별칭/연결 경로 검사 → 범위 재확인 → `showItemInFolder` | `files.ts:120-165` |
| `fs.realpath` 가 먼저라 없는 파일은 ENOENT reject — "없음"과 "범위 밖"을 렌더러가 구분하지 못한다 | `files.ts:127` |
| IPC 오류는 메시지 문자열만 렌더러에 간다 — 사유 구분은 반환값이어야 한다 | `infra/ipc/handle.ts:30-45` (`ipcMain.handle` throw 전파) |
| `shell.openPath(path): Promise<string>` — 실패 시 오류 문자열, 성공 시 `""`. `showItemInFolder(fullPath): void` | `node_modules/electron/electron.d.ts:13153-13171` |
| Work 세션만 컨텍스트 파일을 연다(`allowContextFileOpen`) | `shared/agent-session-policy.ts:6·14·19` |
| 렌더러 레지스트리는 catch 자리만 센다 — catch 밖 `reportError` 는 대상이 아니다 | `reportSites.registry.test.ts:556-565·589-597` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| '여는 중' 계열 문자열 | `rg -n "여는 중\|여는중\|열기 중" app/src` | 0 | 사용자 표현은 근사 — 실제 대상은 '처리 중' |
| 카드의 조건부 문구 | `ArtifactCard.tsx` 의 `&& (` 렌더 분기 | 2 | `transcript &&` 부제(정적, 크기 불변) · `file?.busy && transcript`(가변) — 가변은 1 |
| `chat.artifacts.working` 소비 | `rg -n "artifacts.working" app/src/renderer --glob '!**/resources/**'` | 2 | 카드(제거) · `artifactFeedback`(유지) |
| `fileApi.openPath` 렌더러 호출 | `rg -n "openPath\(" app/src/renderer --glob '!*.test.*'` | 3 + 래퍼 1 | `CwdButton` · `DiffTileContent` · `TaskContextContent` — 바뀌는 것은 마지막의 파일 경로만 |
| main `shell.openPath`/`showItemInFolder` in files.ts | `rg -n "shell\." app/src/main/app/handlers/files.ts` | 3 | `:163` reveal+session · `:184` reveal · `:194` directory |
| `sessionId` 있는 `reveal` 렌더러 호출 | `TaskContextContent.tsx:153` | 1 | 이번에 새 채널로 옮긴다 — main 분기는 계약(`IPC_CONTRACT.md:178`)이라 남기고 해석기를 공유 |
| IPC 채널 | `docs/generated/inventory.md:13` | 101 | → 102 |

### 수치 / 전칭 표현 검산

- 재측정: inventory 채널 101 · files.ts `shell.` 호출 3 · `ArtifactCard` 가변 문구 1.
- "유일한" 검산: "카드에서 높이를 바꾸는 조건부 문구는 하나" ← `rg -n "&& \(" app/src/renderer/src/features/chat/components/ArtifactCard.tsx` → 2(`:80` 정적 부제 · `:126` busy).
- 문서 앵커: `IPC_CONTRACT.md:178` `orca:files:openPath` 행 실재 · `ko.ts:832-833` `openSourceFile`·`sourceOpenFailed` 실재 · `en.ts:824-825` 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`
- 카드: `runArtifactAction` busy → `ArtifactCard` 가 상태 줄 렌더 → 완료 후 제거(높이 출렁임).
- 컨텍스트: 항목 클릭 → `fileApi.openPath({mode:'reveal', sessionId})` → `files.ts` 인라인 판정 → `showItemInFolder`. 실패는 reject 하나로 뭉친다.

```text
TaskContextContent click
  → fileApi.openPath(reveal, sessionId) → filesOpenPath
  → [inline] realpath(ENOENT→reject) → 범위 → showItemInFolder
  → catch → toast "파일 위치를 열지 못했습니다."
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`~`AR-03`
- 카드: busy 는 버튼 비활성만. 상태 줄 없음.
- 컨텍스트: 파일 항목 클릭 → `fileApi.openContextFile({path, sessionId})` → `filesOpenContextFile` → `resolveContextFile`(범위 → 존재 → 실경로 검증) → `missing` | 허용 형식이면 `openPath` → 오류면 `showItemInFolder` | 허용 밖이면 `showItemInFolder` → 결과 반환 → 렌더러가 결과로 toast 결정.
- 유지: `filesOpenPath` 의 세 모드 동작(reveal+sessionId 도 해석기만 공유하고 결과는 같다).

```text
TaskContextContent click(file)
  → fileApi.openContextFile → filesOpenContextFile
  → resolveContextFile: 범위(문자열) → 존재(stat) ─없음→ {missing}
                       → realpath·파일·연결 경로·범위 재확인 → target
  → opensWithDefaultApp(target)? openPath(target) ─오류→ showItemInFolder(target)
                               : showItemInFolder(target)
  → 결과 → 렌더러: missing → toast fileUnavailable / 그 외 0 / reject → toast openFailed
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 범위 판정이 `files.ts` 핸들러 안 인라인 | `context-file.ts` 해석기 1곳 + 두 핸들러가 호출 | D-009 | AR-02 / VP-14 · `context-file.ts` |
| data/control flow | 클릭 = 위치 열기 | 클릭 = 존재 확인 → 열기 → 폴백 | D-005·D-006 | SD-01 / VP-12 |
| state/contract | `openPath` → `void` | 새 채널 → `OpenContextFileResult` | 사유를 반환값으로 | AR-01 / VP-13 |
| error/lifecycle | 모든 실패 = reject 1종 | missing = 결과, 나머지 = reject | D-006·D-011 | SD-01 / VP-06·VP-07 |
| 표시 | 전체 경로 텍스트 · 카드 상태 줄 | 파일명 텍스트 · 상태 줄 없음 | D-001·D-004 | R-01·R-03 / VP-01·VP-03 |
| test seam | 인라인 판정 | 해석기·허용 판정 별도 모듈(electron 미import) | 단위 테스트 | MD-01 / VP-16 |

사라지는 책임 없음 — 인라인 판정은 해석기로 **이동**하고 reveal+sessionId 분기가 그것을 호출한다.

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `renderer/.../ArtifactCard.tsx` | 카드 표시 | busy → 비활성만 | `ArtifactCards` |
| `renderer/.../rightpanel/TaskContextContent.tsx` | 항목 표시·클릭·결과→toast | 결과/예외 → `reportError` | `TaskTile` |
| `renderer/src/shared/api/ipc.ts` `fileApi.openContextFile` | 래퍼 | → preload | `TaskContextContent` |
| `preload/index.ts` `files.openContextFile` | invoke | → main | 렌더러 |
| `main/app/handlers/context-file.ts` (신규, electron 미import) | `resolveContextFile` · `opensWithDefaultApp` · 허용 상수 | 범위 포트 + 경로 → 해석 결과 | `files.ts` |
| `main/app/handlers/files.ts` | 두 핸들러 · shell 호출 | — | `registerFilesHandlers` |
| `shared/ipc.ts`·`shared/protocol.ts` | 채널·타입·zod | — | main·preload·renderer |

## 10. 계약 / 타입 / 강제 지점

**IPC (이름 확정 — 공개 계약)**

```ts
// shared/ipc.ts
CHANNELS.filesOpenContextFile = 'orca:files:openContextFile'
export interface OpenContextFileRequest { path: string; sessionId: string }
export type OpenContextFileResult =
  | { outcome: 'opened' }
  | { outcome: 'revealed'; reason: 'unsupported-type' | 'open-failed' }
  | { outcome: 'missing' }
// shared/protocol.ts — 무효 payload 는 reject
export const OpenContextFileRequestSchema = z.object({
  path: z.string().min(1),
  sessionId: z.string().min(1).max(256)
})
```

**해석기 (`main/app/handlers/context-file.ts`, electron import 0)**

```ts
export interface ContextFileScope {
  recordedContextDirectories(sessionId: string): string[]
  recordedAttachmentFiles(sessionId: string): string[]
}
export type ContextFileResolution = { state: 'missing' } | { state: 'file'; target: string }
export async function resolveContextFile(scope: ContextFileScope, sessionId: string, path: string): Promise<ContextFileResolution>
export const CONTEXT_FILE_OPEN_EXTENSIONS: ReadonlySet<string> // D-007 목록 23개, 점 없는 소문자
export function opensWithDefaultApp(target: string): boolean   // extname(target).slice(1).toLowerCase() ∈ 집합
```

`resolveContextFile` 순서: ① 절대·비루트 아니면 throw `허용되지 않은 경로입니다.` ② 폴더·첨부 둘 다 비면 throw ③ 문자열 범위(`isWithinDir(path, 폴더)` 또는 첨부 `directoryIdentity` 일치) 계산 ④ `fs.stat(path)` 가 `ENOENT`/`ENOTDIR` → 문자열 범위 안이면 `{state:'missing'}`, 밖이면 throw `허용되지 않은 경로입니다.`; 그 밖 stat 오류는 그대로 throw ⑤ 기존 `files.ts:127-162` 판정(realpath·파일·별칭/연결 경로·범위 재확인)을 그대로 옮긴다 — 파일 아님은 throw `파일만 열 수 있습니다.` ⑥ `{state:'file', target}`.

**핸들러 (`files.ts`)**

- `filesOpenContextFile`: `resolveContextFile` → `missing` 이면 `{outcome:'missing'}`(shell 0) → `opensWithDefaultApp(target)` 아니면 `showItemInFolder(target)` + `{outcome:'revealed', reason:'unsupported-type'}` → `await shell.openPath(target)` 오류 문자열이면 `showItemInFolder(target)` + `{outcome:'revealed', reason:'open-failed'}` → `{outcome:'opened'}`.
- `filesOpenPath` reveal+sessionId: `resolveContextFile` → `missing` 이면 throw(지금처럼 reject) → `showItemInFolder(target)`.

**강제 지점**

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리) | 실패 의미 |
|---|---|---|---|---|---|
| R-01 / VP-01 | EP-01 카드 높이 불변 | `ArtifactCard.tsx` | 렌더러 | transcript busy 분기 제거 (1) | 카드 출렁임 |
| R-06 / VP-06 | EP-02 존재 확인 선행 | `resolveContextFile` | main | stat 이 realpath 보다 앞 (1) · 핸들러가 `missing` 이면 shell 0 (1) (2) | 없는 파일이 reject 로 뭉치거나 탐색기가 열린다 |
| R-04·R-05 / VP-04·VP-05·VP-16 | EP-03 허용 형식 판정 | `opensWithDefaultApp` | main | 정의 (1) · 핸들러 호출(target 인자) (1) (2) | 실행 파일이 기본 앱으로 실행된다 |
| R-05 / VP-05 | EP-04 열기 실패 폴백 | `filesOpenContextFile` | main | `openPath` 오류 분기 (1) | 열리지 않고 아무 일도 없음 |
| R-08 / VP-08·VP-14 | EP-05 공유 해석기 | `context-file.ts` | main | reveal+sessionId (1) · open 채널 (1) (2) | 두 입구의 보안 판정이 갈라진다 |
| R-06·R-07 / VP-06·VP-07·VP-17 | EP-06 결과 → toast | `TaskContextContent` | 렌더러 | `missing` → toast (1) · catch → toast T34 (1) · `opened`/`revealed` → 0 (1) (3) | 없는 파일 무반응 · 성공에 toast |
| R-03 / VP-03 | EP-07 표시 | `TaskContextContent` | 렌더러 | 텍스트=파일명 (1) · `title`=전체 경로 (1) · `aria-label` (1) (3) | 전체 경로 노출·툴팁 없음 |
| R-10 / VP-10·VP-13 | EP-08 IPC 사본 | `shared/ipc.ts` | 전 레이어 | `CHANNELS` · 스키마 · preload · `fileApi` · 핸들러 등록 · `IPC_CONTRACT.md` 행 · inventory (7) | 채널 불일치·문서 드리프트 |
| R-10 / VP-15 | EP-09 i18n | `ko.ts`·`en.ts` | 렌더러 | ko 3 · en 3 (6) | 키 누락·문구 불일치 |

- 같은 규칙의 SSOT: 범위·존재 판정 = `resolveContextFile` 1곳(EP-05). 허용 형식 = `CONTEXT_FILE_OPEN_EXTENSIONS` 1곳 — 렌더러는 판정하지 않는다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드: `OpenContextFileResult.reason` 은 `revealed` 에서만 존재(판별 유니언).
- 외부 경계: `shell.openPath` 는 reject 하지 않고 문자열을 준다 — 빈 문자열만 성공이다.

**i18n**

| 키 | ko | en |
|---|---|---|
| `chat.taskTile.openSourceFile` (변경) | `{{name}} 파일 열기` | `Open {{name}}` |
| `chat.taskTile.sourceOpenFailed` (변경) | `파일을 열지 못했습니다.` | `Could not open the file.` |
| `chat.taskTile.sourceMissing` (신규) | `파일이 없습니다. 삭제되었거나 이동되었을 수 있습니다.` | `The file does not exist. It may have been deleted or moved.` |

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/features/chat/components/ArtifactCard.tsx` | 카드 | `:126-130` 상태 줄 삭제 | 렌더(SSR) |
| `app/src/renderer/src/features/chat/components/rightpanel/TaskContextContent.tsx` | 컨텍스트 | 파일 텍스트 `basenameForDisplay(source.path)` · 파일/첨부 클릭 → `openContextFile` · 결과 처리(EP-06) · catch 는 1개 유지(폴더·파일 공용, T34) | 렌더 + 콜백 캡처(기존 하네스) |
| `app/src/renderer/src/shared/api/ipc.ts` | 래퍼 | `fileApi.openContextFile` | 타입 |
| `app/src/preload/index.ts` | preload | `files.openContextFile` | 타입 |
| `app/src/shared/ipc.ts` · `protocol.ts` | 계약 | §10 | 스키마 단위 |
| `app/src/main/app/handlers/context-file.ts` (신규) | 해석기·허용 판정 | §10 — `files.ts:120-162` 판정 이동 + 존재 선행 | 실 fs(임시 디렉터리) + 순수 |
| `app/src/main/app/handlers/files.ts` | 핸들러 | 새 채널 등록 · reveal+sessionId 가 해석기 호출 | 기존 electron mock 통합 |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | §10 i18n | `resources.test.ts` |
| `app/src/renderer/src/shared/errors/reportSites.registry.test.ts` | 레지스트리 | T34 `line` 메타 갱신(catch 수 불변) | 자체 |
| `docs/IPC_CONTRACT.md` | 계약 문서 | files 표에 `orca:files:openContextFile` 행 | AC12 |
| `docs/generated/inventory.md` | 생성물 | 재생성 | `--check` |

### 신규·변경 테스트

| 테스트 | 무엇을 단언하는가 | AC |
|---|---|---|
| `ArtifactCard` 렌더 | busy/idle 마크업 비교 · '처리 중' 0 · `role="status"` 0 (기존 :105 사례 뒤집기) | AC1 |
| `opensWithDefaultApp` 순수 | 허용 23 · 거부 표(§7 AC7 목록) · 대문자 · 끝 점 · 확장자 없음 · ADS(`a.txt:b.exe`) | AC7 |
| main 통합(실 fs·SQLite·electron mock) | opened · open-failed 폴백 · unsupported 3종 · missing(범위 안/밖) · 디렉터리 거부 · 기존 reveal 보안 사례 `it.each(['reveal','open'])` | AC5~AC8·AC10 |
| `TaskContextContent` 렌더러 | 파일명·title·aria · 결과 4종 → toast 표 · reject → toast·alert 0 · 폴더 칩 `directory` 호출 · 늦은 클릭 0 | AC3~AC6·AC8·AC9·AC11 |
| 스키마 | `OpenContextFileRequestSchema` accept/reject(빈 path·빈/257자 sessionId) | AC12 |

### 테스트 가능성

- electron 분리: `context-file.ts` 는 `electron` 을 import 하지 않는다 — 해석기·판정을 electron mock 없이 실 fs 로 시험한다. shell 호출은 `files.ts` 에만 둔다.
- 기존 하네스 재사용: `files.contextDirectory.test.ts` 는 electron mock(`openPath`·`showItemInFolder` 스파이)·실 SQLite·임시 폴더를 이미 갖는다(:18-77).
- 렌더러: `TaskContextContent.test.ts` 의 `vi.mock('../../../../shared/api/ipc')` 에 `openContextFile` 을 더하고 jsxDEV 캡처로 클릭 콜백을 부른다(:13-42 선례).

## 12. End-to-end 영향

### producer → consumer

```text
main resolveContextFile/handler → OpenContextFileResult → preload → fileApi → TaskContextContent → reportError → ErrorToastHost
```

- producer 기준: 결과는 판정 결과만 담는다(문구 없음). 문구는 렌더러 i18n 이 만든다.
- consumer 파생 규칙: `missing` 만 toast. `opened`·`revealed` 는 toast 0.
- 파생 가능한 합성값이 정본을 우회하지 않는가: 렌더러는 확장자·존재를 판정하지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `registerFilesHandlers` | 채널 1개 추가 등록 | AC12 |
| `CwdButton`·`DiffTileContent` 의 `openPath` | 무변경 | AC11 · 기존 `files.openPath.test.ts` |
| `filesOpenPath` reveal+sessionId | 해석기 공유, 결과 동일 | AC10 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 채널은 부팅 시 `registerFilesHandlers` 에서 등록된다.
- 취소/중단: 없음 — 한 번의 invoke.
- 종료/quit/renderer-gone: 진행 중 invoke 결과는 버려진다. 렌더러는 `mounted` ref 로 상태 갱신을 막는다(기존).
- retry/timeout/partial failure: 열기 실패는 폴백으로 흡수, 그 외는 toast 후 사용자가 다시 누른다.
- 늦은 응답: 세션을 옮긴 뒤 도착한 결과도 사용자가 요청한 동작이라 `missing` toast 는 띄운다(0242 ΔV2 원칙 — 동작 결과를 버리지 않는다). 클릭 시점의 세션 가드(`current()`)는 유지한다.
- **다중 저장소 쓰기**: 해당 없음 — 읽기와 OS 호출뿐이다. 판정과 `openPath` 사이 파일 교체(TOCTOU)는 기존 reveal 과 같은 창이다(§17).

## 14. 성능 / 상한 / 최적화

- 새 요청 수: 클릭 1회 = invoke 1회. 해석기는 기존 reveal 판정 + `stat` 1회.
- 출력 길이: 결과 객체 고정 크기.
- 최적화 없음.

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

- 해당 없음 — 배포가 구현하는 포트가 아니다. 계약 문서는 `IPC_CONTRACT.md` 행(EP-08).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| AC18 "busy 면 비활성 + `working` 문구" | `0242:plan@3569f57d` `:694` | D-001 · AC1 | **변경** — 문구 0, 비활성 유지(사용자 요청 2) |
| D-011 동작 시 실패를 toast 로 | 0242 `:58` | D-002 · AC2 | 유지 |
| D-012 비활성은 busy 만 | 0242 `:59` | D-003 | 유지 |
| AC22 컨텍스트 열기 실패 toast·alert 0 | 0242 `:698` | AC9 | 유지(파일 문구만 "파일을 열지 못했습니다.") |
| 컨텍스트 reveal 범위 규칙(폴더·첨부·연결 경로·재확인) | `files.ts:116-165` · `IPC_CONTRACT.md:178` | D-009 · AC10 | 유지 — 함수로 이동만 |
| `orca:files:openPath` 계약 | `IPC_CONTRACT.md:178` | §6 비범위 | 유지(새 채널은 추가) |
| 렌더러 catch 레지스트리 | `reportSites.registry.test.ts` | EP-06 | 유지(T34 catch 1개) |
| 외부 URL·임의 경로 오픈 차단 | `app/AGENTS.md` 보안 베이스라인 · `files.ts:116-118` | D-007·D-009 | 유지 — 범위 + 허용 형식으로 더 좁힌다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| Windows 는 연결 프로그램이 없는 허용 형식(예: `.md`)에 "연결 프로그램 선택" 창을 띄우고 `openPath` 가 오류를 주지 않을 수 있다 → 폴백 없음 | 수용 — 사용자가 앱을 고를 수 있는 가시 상태다. AC14 실기에서 관측해 기록 |
| 판정과 열기 사이 파일 교체(TOCTOU) | 기존 reveal 과 같은 창. 실경로 확장자로 판정해 창을 좁힌다(D-008) |
| 허용 목록이 좁아 자주 쓰는 형식(`hwp`·`xls`)이 탐색기로 간다 | 수용 — 질의 4 결정. 추가는 상수 1곳 |
| 렌더러 '처리 중' 제거로 느린 저장의 진행 신호가 비활성 버튼뿐이다 | 수용 — D-001·D-003 |

- 되돌리기 어려운 결정: IPC 채널 이름·결과 형태(§10).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/chat/components/{ArtifactCard.tsx, ArtifactCard.render.test.ts}`
- `app/src/renderer/src/features/chat/components/rightpanel/{TaskContextContent.tsx, TaskContextContent.test.ts}`
- `app/src/renderer/src/shared/api/ipc.ts` · `app/src/preload/index.ts` · `app/src/shared/{ipc,protocol}.ts` (+ 스키마 테스트)
- `app/src/main/app/handlers/{context-file.ts(신규), files.ts}` (+ 테스트)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` · `app/src/renderer/src/shared/errors/reportSites.registry.test.ts`
- `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크 제약: `files.contextDirectory.test.ts` 는 better-sqlite3 를 로드한다(Node ABI 필요). 렌더러·순수 테스트는 ABI 무관.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/renderer/src/features/chat/components/ArtifactCard.render.test.ts src/renderer/src/features/chat/components/ArtifactCards.lifecycle.test.ts src/renderer/src/features/chat/store/artifactViewerStore.test.ts src/renderer/src/features/chat/components/rightpanel/TaskContextContent.test.ts src/renderer/src/shared/i18n src/renderer/src/shared/errors src/shared src/main/app/handlers/context-file.test.ts src/main/app/handlers/files.openPath.test.ts` + DB 스위트 `src/main/app/handlers/files.contextDirectory.test.ts`.
- 위생: `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기(AC14, Windows `npm run dev`): Work 세션에서 `.pdf`·`.txt`·`.py` 를 Read 하게 한 뒤 컨텍스트 패널에서 ①파일명만 보이고 hover 시 전체 경로 ②`.pdf`·`.txt` 클릭 → 기본 앱 ③`.py` 클릭 → 탐색기에서 선택 ④파일을 지우고 클릭 → toast ⑤산출물 카드 다운로드·탐색기에서 보기 중 카드 높이 불변. 연결 프로그램 없는 `.md` 의 동작(앱 선택 창 여부)을 기록한다.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — 질의 4 답이 D-007 에 원문으로 있다.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — "제거"를 다른 위치 이동으로 바꾸지 않았다(D-001, 대체 표시 없음). "우선 확인"을 D-006·EP-02 순서로 잠갔다.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 상태표 9행 ↔ AC1·AC2·AC3·AC5~AC9.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축/구체성으로 작성되어 있다.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일/모듈 또는 AC에 추적 가능하다.
- [x] AS-IS에서 사라진 책임은 이동(인라인 판정 → 해석기)으로 명시했다.
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다(§8 검산).
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 상속 기준이 없어 Baseline V 를 썼고 0242 동작은 INHERITED/CHANGED 노드로 출처 커밋을 붙였다.
- [x] 모든 NEW/CHANGED node에 같은 레벨 REQUIRED pair가 있다.
- [x] 영향받은 INHERITED node(R-02·R-08·R-09)는 REGRESSION 이다.
- [x] 각 pair의 경로·§10 전수 분모·직접 oracle이 있고 적대 증거는 음성 불변식·순서·보안 판정 pair 에만 있다.
- [x] 현재 변경 산출물의 운영 gate가 열거됐다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — AC14 는 OS 앱·탐색기·시각 높이만.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC1 은 마크업 비교(의미), AC10 은 두 입구의 행동 비교 + 정의 1곳.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다(§12 표).
- [x] producer/consumer 양쪽 의미를 확인했다.
- [x] 상한·총량·one-way door를 계산했다(§14·§6 표).
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 교차검증했고 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §8).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: V1의 D-001~D-013과 AC1~AC14를 유지했다. 범위 해석기는 기존 reveal 판정을 옮기고 두 입구에서 호출한다.
- 이견 / 현실성 문제: §7의 신설 shell 호출부 예상은 2였지만 실제 호출부는 3이다(허용 밖 reveal·기본 앱 open·실패 reveal). `rg -n 'shell\.(openPath|showItemInFolder)' app/src/main/app/handlers/files.ts`는 기존 3 + 신설 3 = 6줄이다. AC의 호출 횟수·결과 계약과 차이는 없다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 폴더 실패는 기존 `directoryOpenFailed`를 유지하고 파일 실패만 `sourceOpenFailed` 문구를 바꿨다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01 | EP-01 카드 높이 | 1 | 1/1 | `ArtifactCard.render.test.ts`의 busy/idle 마크업 비교가 disabled 외 차이를 거부한다. M1·M2 각각 red 1 | 없음 |
| VP-06·VP-12 | EP-02 존재 확인 | 2 | 2/2 | `rg -n -e 'stat\(' -e realpath -e missing app/src/main/app/handlers/context-file.ts app/src/main/app/handlers/files.ts`: stat `context-file.ts:59` → realpath `:67`; missing 반환 `files.ts:167`. 순수 missing 2 + main shell 0 단언 green | 없음 |
| VP-04·VP-05·VP-16 | EP-03 허용 형식 | 2 | 2/2 | 정의 `context-file.ts:41` + 실제 target 인자 `files.ts:169`. 허용 23·거부 15 사례, M4 정의/호출부와 M6 red | 없음 |
| VP-05·VP-12 | EP-04 열기 실패 폴백 | 1 | 1/1 | `files.ts:174-177` 오류 문자열 분기; native 오류 사례에서 open 1·reveal 1·reason open-failed. M5 red 1 | 없음 |
| VP-08·VP-14 | EP-05 공유 해석기 | 2 | 2/2 | `rg -n 'resolveContextFile' app/src/main/app/handlers/files.ts`: 호출 `:124`·`:166`; `rg -n 'export async function resolveContextFile' app/src/main`: 정의 `context-file.ts:45` 1줄. 양 입구 scope 사례 green, M9 open junction red | 없음 |
| VP-06·VP-07·VP-17 | EP-06 결과→toast | 3 | 3/3 | `rg -n -e result.outcome -e reportError -e files.context-open app/src/renderer/src/features/chat/components/rightpanel/TaskContextContent.tsx`: missing `:51-57`·catch T34 `:61-75`. 결과 4종 표에서 missing 1건·opened/revealed 0건, reject 1건 green | 없음 |
| VP-03 | EP-07 표시 | 3 | 3/3 | `rg -n -e source.path -e source.name -e aria-label -e title= app/src/renderer/src/features/chat/components/rightpanel/TaskContextContent.tsx`: label `:157`·title `:161`·text `:178`. Windows/POSIX와 첨부 원래 이름 단언 green; M3 양 source 자리 red | 없음 |
| VP-10·VP-13 | EP-08 IPC 사본 | 7 | 7/7 | `rg -n -e filesOpenContextFile -e OpenContextFileRequestSchema -e openContextFile app/src/shared app/src/preload app/src/main/app/handlers/files.ts app/src/renderer/src/shared/api/ipc.ts docs/IPC_CONTRACT.md docs/generated/inventory.md`: 7사본 확인. 실제 preload→invoke 테스트 + IPC 문서 3사례 green, inventory 102채널 일치 | 없음 |
| VP-10·VP-15 | EP-09 i18n | 6 | 6/6 | `rg -n -e openSourceFile -e sourceOpenFailed -e sourceMissing app/src/renderer/src/shared/i18n/resources/ko.ts app/src/renderer/src/shared/i18n/resources/en.ts`: ko `:832-834`, en `:824-826` 각 3줄. resources/레지스트리 스위트 green | 없음 |

- §10에 없는데 같은 불변식이 필요했던 지점: 추가 발견 없음. EP-07의 공유 JSX는 파일/첨부 두 branch를 모두 시험했다. EP-03은 정의와 호출부 양쪽 M4를 실행했다.
- 강제 지점 검산: `1 + 2 + 2 + 1 + 2 + 3 + 3 + 7 + 6 = 27`, 닫은 자리 27/27. 검색의 주어는 busy 표시·존재·범위·형식·결과·표시 속성·채널·문구다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | busy의 disabled를 지우면 idle과 같은 markup | M1·M2 red 각 1 |
| VP-02 | REGRESSION | SELF_PASS | ArtifactCards.lifecycle/artifactViewerStore 기존 실패 toast 사례 green | 해당 없음 — 직접 oracle |
| VP-03 | REQUIRED | SELF_PASS | 파일명·title·aria와 첨부 이름·저장 경로·무경로 비활성 green | M3 파일 2·첨부 1 red |
| VP-04 | REQUIRED | SELF_PASS | 실제 채널 open 호출 target·횟수·opened 결과; renderer toast 0 green | 해당 없음 — 직접 oracle |
| VP-05 | REQUIRED | SELF_PASS | open-failed 폴백·지원 밖 3종·실경로 확장자 green | M4 호출 3·정의 15, M5 1, M6 1 red |
| VP-06 | REQUIRED | SELF_PASS | 범위 안 missing·범위 밖 reject·shell 0·missing toast 1 green | M7 2·M8 1 red |
| VP-07 | REQUIRED | SELF_PASS | reject toast 1·인라인 alert 없음; T34 단일 catch 유지 green | 해당 없음 — 직접 oracle |
| VP-08 | REGRESSION | SELF_PASS | 기존 보안 사례를 reveal/open 두 입구로 실행 green | M9 open junction 1 red, reveal 동일 사례 green |
| VP-09 | REGRESSION | SELF_PASS | directory main 기존 사례 + renderer directory 호출·기존 실패 detail green | 해당 없음 — 직접 oracle |
| VP-10 | REQUIRED | SELF_PASS | 스키마·IPC 문서·i18n·레지스트리·inventory green | 해당 없음 — 직접 oracle |
| VP-11 | REQUIRED | SELF_BLOCKED | Windows 기본 앱/탐색기 창·hover·실제 카드 높이는 사람 실기 대기 | 해당 없음 — §19 사람 실기 |
| VP-12 | REQUIRED | SELF_PASS | 실제 main 결과표 + renderer 결과별 toast표 green | VP-05·VP-06 공유 M4~M8 red |
| VP-13 | REQUIRED | SELF_PASS | 무효 payload reject; fileApi→실제 preload→invoke 요청·응답 보존 green | 해당 없음 — 직접 oracle |
| VP-14 | REQUIRED | SELF_PASS | 정의 1곳·호출 2곳 + 양 입구 scope 사례 green | VP-08 공유 M9 red |
| VP-15 | REQUIRED | SELF_PASS | ko/en 키 대조와 T34 event/title catch 레지스트리 green | 해당 없음 — 직접 oracle |
| VP-16 | REQUIRED | SELF_PASS | 허용/비허용 순수 형식 표·대문자·끝 점·ADS green | VP-05 공유 M4 정의·M6 red |
| VP-17 | REQUIRED | SELF_PASS | opened/revealed toast 0·missing/reject toast 1 green | VP-06 공유 M7·M8 red |

- pair 검산: SELF_PASS 16 · SELF_BLOCKED 1 = 등록 pair 17. 독립 verify 판정은 선점하지 않는다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 busy 상태 줄 복원 | VP-01 | 최초 | ArtifactCard.render busy markup / 1 red | 원본 byte 복원 |
| M2 busy aria-live span 삽입 | VP-01 | 최초 | 동상 / 1 red(마크업 비교) | 원본 byte 복원 |
| M3 파일 텍스트↔title 교환 | VP-03 | 최초 | TaskContextContent 파일명/tooltip Windows·POSIX / 2 red | 원본 byte 복원 |
| M3 첨부 텍스트↔title 교환 | VP-03·D-012 | 최초 | TaskContextContent original name / 1 red | 원본 byte 복원 |
| M4 핸들러 허용 판정 제거 | VP-05·VP-16 | 최초 | files.contextDirectory 지원 밖 py·exe·무확장자 / 3 red | 원본 byte 복원 |
| M4 판정 함수가 항상 true | VP-05·VP-16 | 최초 | context-file 비허용 형식 표 / 15 red | 원본 byte 복원 |
| M5 오류 시 폴백 호출 제거 | VP-05 | 최초 | files.contextDirectory native error string / 1 red | 원본 byte 복원 |
| M6 요청 경로 확장자로 판정 | VP-05 | 최초 | files.contextDirectory resolved extension / 1 red | 원본 byte 복원 |
| M7 realpath를 stat 앞에 호출 | VP-06 | 최초 | context-file absent path·replaced parent / 2 red | 원본 byte 복원 |
| M8 문자열 범위 검사 없는 missing | VP-06 | 최초 | context-file outside absent path / 1 red | 원본 byte 복원 |
| M9 신규 채널에 lexical-only 해석기 사본 | VP-08·VP-14 | 최초 | files.contextDirectory open in-scope escaping junction / 1 red; reveal 형제 1 green | 원본 byte 복원 |

- **분모 검산**: 선택 증거 9종(M1~M9)의 production 자리 11 · 인용 변이 0 · 새 oracle 0 = 잠금 표 11행. M3 파일/첨부, M4 정의/호출부는 각 두 자리다. 구조적 추가 oracle은 만들지 않고 실제 결과·마크업을 관측했다.
- **덮개 회귀**: 이전 장치 교체 없음. 모든 변이 후 byte-for-byte 복원 true를 확인했고 최종 관련 스위트 17파일·444케이스 green을 재현했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | missing → sourceMissing → fileUnavailable toast; reject → sourceOpenFailed → openFailed toast | 결과 4종 + reject 사례 green |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 해석기만 이동했다. opening ref·mounted ref·finally는 같은 renderer 함수 안에 남는다 | 중복 클릭 가드·다음 세션 늦은 클릭 0 green |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 없는 파일 → missing toast 행; 그 밖 실패 → reject toast 행; native 오류 → 위치 열기 행 | main/renderer 결과표 green |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | missing/reject toast 1; open-failed 폴백 reveal 1. 카드 아래 상태 줄은 없다 | AC1·AC6·AC8·AC9 green |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 결과는 toast로만 알리고 화면 내용을 바꾸지 않는다. 세션 이동 뒤 missing도 요청한 사용자에게 알린다 | pending 요청 중 중복 클릭 0·이동 뒤 missing toast 1 green |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 기본 tmpdir가 사용자 프로필 아래라 sandbox에서 realpathSync가 EPERM | 테스트 실행 TEMP/TMP만 `app/node_modules/.cache/test-tmp`로 지정했다. 앱·테스트 동작 계약은 변경하지 않았다 | 초기 DB-context 55건 setup 실패 → 동일 테스트 workspace TEMP에서 green |
| 2 | OS 기본 앱·연결 프로그램 선택창·실제 카드 높이는 mock에서 보이지 않는다 | AC14는 사람 실기 대기, 완료 수에 넣지 않는다 | §19 절차·VP-11 SELF_BLOCKED |
| 3 | 실제 shell 호출부와 설계 예상 수치가 다름 | 실제 호출부 6곳을 검색하고 각 신규 branch sink를 직접 시험했다. 규범 AC·§10은 그대로다 | `files.ts:126·147·157·170·173·175` |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 없음. 새 파일 open mode는 renderer 내부 판별자 `file`이며 공개 요청은 계획한 `{path, sessionId}` 그대로다. 첨부·폴더·웹 경로도 계획한 경계를 유지했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 캐시·추가 저장소 없음 | AC8 실제 stat 선행 green |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — 대체물 없음. 기존 두 입구가 해석기를 공유한다 | AC10 두 입구 scope·세션 재확인 green |
| 재진입 | 해당 없음 — 대체물 없음. 기존 opening ref 가드 유지 | 동시 두 항목 클릭 IPC 1 green |
| 다른 무효화 축 | 해당 없음 — 대체물 없음. 파일 교체 TOCTOU는 §17 수용 범위 유지 | M6 actual target 확장자 red |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | §18 production·계약·테스트·문서 + preload 실제 wire 테스트. 신규 `context-file.ts`·`context-file.test.ts` |
| 실행 명령 | §19 관련 vitest 목록 + `src/preload/index.test.ts`·`src/shared/protocol.send.test.ts`·`src/shared/ipc-documentation.test.ts`, `--maxWorkers=2`; TEMP/TMP workspace 지정. `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출**(exit code 아님) | 관련 vitest **17파일·444케이스 green**, 97.67s. inventory 생성/문서/상대링크 **green: 102채널·수치 재서술 없음·모든 상대링크 해석**. `npm run lint`: 오류 0·기존 경고 1(`useTranscriptVirtualizer.ts:22`, incompatible-library). `npm run typecheck`: node/web/test 3구성 오류 0. Prettier 형식 변경 외 동작 변경 없음; lint 지적의 테스트 helper 반환형 1곳을 명시했다 |
| V-pair 자기확인 | SELF_PASS 16 / SELF_BLOCKED 1(Windows 사람 실기) |
| 강제 지점 전수 | EP-01~EP-09의 27/27자리. 선택 M1~M9 11자리 모두 red → byte 복원 → 관련 suite green |
| **AC 자기보고**(`Criteria-Met`) | 13/14. AC1~AC13 기계 증거 green, AC14 사람 실기 대기 |
| **합계 검산** | ✅ 13 · ⚠️ 1 · ❌ 0 = AC 총 14. 아래 AC 행을 세어 검산했다 |
| 블로커 / 역질문 | 제품·계약 PLAN_GAP 없음. AC14 OS 창·시각 실기만 미실행 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

- root 별도 회귀 관측: ArtifactCards.lifecycle·artifactViewerStore·i18n·errors·files.openPath **10파일·262케이스 green**. 위 17파일 스위트와 겹치므로 합산하지 않는다.

| AC | 자기보고 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | ArtifactCard busy/idle disabled 외 markup 동일·상태 줄 0 |
| AC2 | ✅ | ArtifactCards.lifecycle + artifactViewerStore 실패 toast 기존 사례 green |
| AC3 | ✅ | TaskContextContent Windows/POSIX 파일명·tooltip·aria green |
| AC4 | ✅ | 첨부 원래 이름·저장 경로 tooltip·새 IPC·무경로 비활성 green |
| AC5 | ✅ | 실제 main opened/open 1/reveal 0 + renderer toast 0 green |
| AC6 | ✅ | native 오류 문자열 → reveal 1/open-failed + toast 0 green |
| AC7 | ✅ | 허용 23종·거부 15종 순수 + py/exe/무확장자 실제 handler + 실제 경로 확장자 green |
| AC8 | ✅ | 승인 missing/shell 0·범위 밖 missing reject·fileUnavailable detail green |
| AC9 | ✅ | rejected file open toast 1/openFailed/인라인 alert 0 green |
| AC10 | ✅ | 동일 보안 사례 reveal/open 두 입구 green·해석기 정의 1곳 |
| AC11 | ✅ | main directory 기존 사례·renderer directory mode와 기존 실패 detail green |
| AC12 | ✅ | 요청 accept/reject·등록·실제 preload wire·IPC 문서 3사례·inventory green |
| AC13 | ✅ | ko/en 리프 집합·T34 catch/event/title 레지스트리 green |
| AC14 | ⚠️ | Windows 기본 앱/탐색기 창·실제 카드 높이 사람 실기 대기 |

- AC 합계 재측정: ✅ 13 · ⚠️ 1 · ❌ 0 = 14. `Criteria-Met: 13/14`, `Criteria-Pending: AC14 Windows 기본 앱·탐색기·시각 실기`.

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 최초 구현. 0242의 busy 상태 줄 요구만 이번 D-001로 대체했고 실패 toast·busy 비활성·범위 보안은 유지했다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: AC1 markup 비교가 문구 없는 새 높이 변화(M2)도 검출했다. M9는 open의 연결 경로 검사 누락을 검출하고 reveal 형제 사례는 green이었다.
- 반복해서 부딪히는 환경 한계: Node ABI의 SQLite는 정상이다. 프로필 아래 realpath sandbox 제한은 테스트 TEMP/TMP workspace 지정으로 해소했다. OS 실제 창은 사람 실기가 필요하다.
- 현재 라운드·impl 턴: r1. 구현 결과 자기보고이며 다음은 독립 verify다.

## [구현자 기입] 설계 리뷰 (r1.2)

- 동의 / 그대로 진행: V1의 계약과 production은 유지했다. 새 파일 열기 채널을 기존 등록 전수 테스트의 명시적 기대 집합에 넣었다.
- 이견 / 현실성 문제: 없음. CI run `37424040442`에서 guards·lint·typecheck는 성공했고, 테스트는 `misc-split.test.ts` 등록 집합 1건만 실패했다(619파일·6302케이스 통과, 1파일·1케이스 skip).
- ACTIVE Decision과 충돌하는 설계 발견: 없음. REQUIRED gate의 누락된 테스트 기대값을 보완하는 같은 라운드의 두 번째 구현 턴이다.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1.2)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-10·VP-13 | EP-08 신규 IPC 등록 | 7 | r1의 7/7 유지, 기존 등록 oracle 1곳 보완 | `misc-split.test.ts`의 기대 집합에 새 채널을 추가했다. 실제/기대 26개 일치·중복 0, 2케이스 green | 없음 |

- 전수 검색: `rg -n 'EXPECTED|registerFilesHandlers|filesOpenPath' app/src --glob '*.test.ts'`와 파일 채널 리터럴·고정 개수 검색. 등록·호출·소비 타입·preload·문서·provider 도메인 테스트 7파일을 대조했고 stale 등록 기대 집합은 `misc-split.test.ts` 1곳이었다. production 파일은 `git diff -- app/src/main/app/handlers/files.ts` 0행이다.
- V-pair 자기확인: VP-10·VP-13 `SELF_PASS` — 신규 등록 전수 2케이스 green. 나머지 pair의 production과 oracle은 변경하지 않았으며 r1 관측을 승계한다. VP-11 Windows 실기 `SELF_BLOCKED`를 유지한다.
- §10 밖 신규 계약 경로: 없음. EP-08의 실제 등록을 확인하는 기존 회귀 oracle 보완이다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r1.2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `files.ts`의 새 context-file 채널 등록 블록 삭제 | 수정한 등록 전수 oracle · VP-10·VP-13 | 최초 | `misc-split.test.ts`의 필요한 채널 등록 집합 단언 1 red, 조기 설정 읽기 형제 1 green | production byte 복원 true → 원본 2케이스 green |

- 분모 검산: 이번 수정이 고친 구조적 oracle 1 · 이번 수정이 닿은 선택/인용 변이 0 = 표 1행. r1의 M1~M9 11자리 관측은 당시 증거로 유지하며 이번 턴의 재실행으로 세지 않는다.
- 덮개 회귀: 명시적 집합 동등과 중복 단언을 유지했다. `arrayContaining` 또는 수치만 비교하는 단언으로 약화하지 않았다.

## [구현자 기입] Product/UX 파생 검토 (r1.2)

- 새 사용자 문자열·상태·소비자: 해당 없음 — 테스트 기대 목록과 그 설명만 수정했다.
- seam 재배치·정리 스코프·실패 경로·늦은 응답: 해당 없음 — production diff 0행으로 r1의 동작을 유지한다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1.2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | r1의 관련 17파일 목록이 기존 IPC 등록 전수 회귀를 포함하지 않아 기대값 누락을 놓쳤다 | 등록 집합을 갱신하고 이 파일 전체를 추가 실행했다. 고정 채널 수를 테스트명에 중복하지 않는다 | 수정 전 1 failed/1 passed → 수정 후 2 passed, 등록 삭제 probe 1 red |

- 설계 대비 차이: 없음. 만료·공유·재진입·기타 무효화 대체물은 해당 없음(production/저장소/캐시 변경 0).

## [구현자 기입] 구현 보고 (r1.2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/app/handlers/misc-split.test.ts`, 이 구현 보고, INDEX의 0252 행 |
| 실행 명령 | `vitest run src/main/app/handlers/misc-split.test.ts --maxWorkers=2`; `eslint src/main/app/handlers/misc-split.test.ts`; 등록 삭제 probe; `git diff --check` |
| 관측한 게이트 산출 | 수정 전 **1파일·1 failed/1 passed**, 수정/복원 뒤 **1파일·2 passed**. 해당 파일 ESLint **오류 0·경고 0**. production diff 0행. 새 커밋의 CI 결과는 push 후 확인한다 |
| V-pair 자기확인 | 영향 pair VP-10·VP-13 SELF_PASS. r1의 기능 결과를 승계하며 VP-11 사람 실기는 그대로 대기 |
| 강제 지점 전수 | EP-08 production 7/7 유지. 등록 oracle 누락 1곳 수정·같은 축 추가 stale 기대 집합 없음 |
| AC 자기보고 (`Criteria-Met`) | **13/14** 유지. AC12 등록 회귀 2케이스 추가. AC1~13은 기존 기능 구현·CI 관측을 승계하며 AC14는 Windows 실기 미실행 |
| 합계 검산 | r1의 AC 표 **✅13 · ⚠️1 · ❌0 = 14**, AC 분모 변경 0 |
| 블로커 / 역질문 | PLAN_GAP 없음. 독립 verify와 AC14 실기 대기 |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1.2)

- 같은 불변식의 재발: 최초 CI 피드백이다. 실제 등록은 맞았고 기존 테스트의 기대 집합이 빠졌다.
- 막았어야 할 계약: AC12·EP-08의 등록 증거와 필수 CI gate. r1 관련 실행 집합에 기존 `misc-split.test.ts`가 없었다.
- 환경 한계: 없음. 원격 CI와 로컬 실패 모두 같은 배열 차이를 보였고 ABI·컴파일·네트워크 실패 서명이 아니다.
- 현재 라운드·impl 턴: r1.2. 다음은 여전히 Claude 독립 verify다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| 1 | CI의 기존 IPC 등록 기대 집합에 신규 파일 열기 채널이 누락됨 | 필수 CI Test gate · VP-10·AC12·EP-08 | 기대 집합을 갱신하고 등록 누락 검출력을 유지 | BLOCKING | **closed** — r1.2 수정, 검증자 등록 삭제 probe `misc-split` red 1, 원격 CI run `37425385848` success ([verify.md §13](verify.md)) |
| D2 | `Criteria-Pending` 문구가 trailer("실제 카드 높이 실기")와 plan("시각 실기")에서 표현만 다름 | message-bus | 값 13/14·AC14 동일 | NON_BLOCKING | 기록 |
| D3 | r1 관련 테스트 목록이 기존 IPC 등록 전수 테스트(`misc-split.test.ts`)를 빠뜨려 CI에서 처음 드러남 | Review Signal | review 판단 | NON_BLOCKING | 기록 |
