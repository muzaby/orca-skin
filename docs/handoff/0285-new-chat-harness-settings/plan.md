# Plan — 0285-new-chat-harness-settings

## 메타

| 항목 | 값 |
|---|---|
| slug | `0285-new-chat-harness-settings` |
| 작성자 | Claude Code |
| 일자 | 2026-10-25 |
| 매핑 | 같은 요청의 버그 부분은 [`0284`](../0284-native-toggle-self-write/plan.md)로 분리 |
| 상태 | IMPL_DONE (V1 r1) |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 새 대화 진입이 팝업 한 단계를 거치고, 랜딩의 작업 경로가 매번 바탕화면으로 돌아가며, Claude↔OpenCode 랜딩 전환 때 입력창이 위아래로 튄다. Claude 출력 스타일과 OpenCode 권한 자동 승인 설정이 없다. OpenCode 대화는 git 행과 별도 활자를 쓴다.
- 완료 후 달라지는 것: nav `새 대화` 한 번에 랜딩, 마지막으로 고른 경로가 기본값, 두 하네스 랜딩의 입력창이 같은 자리, 설정 `일반`에 Claude·OpenCode 그룹, OpenCode 대화는 Claude와 같은 활자·git 행 없음.
- 성공을 사용자 관점에서 한 문장으로: "새 대화를 누르면 바로 내가 쓰던 경로로 열리고, 하네스를 바꿔도 입력창이 제자리이며, 설정에서 Claude 응답 방식과 OpenCode 자동 승인을 고를 수 있다."

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "nav -> 새 대화 페이지 클릭시 팝업되는 메뉴를 제거하라. 새 대화 페이지 클릭시 바로 새 대화 렌딩페이지로 이동하도록 변경." | 2026-10-25 세션 |
| 명시 요구 | "nav -> 새 대화 페이지의 프로젝트 경로 기본 설정은 탐색기 모달에서 선택한 마지막 경로로 동작되도록 하라." | 같은 세션 |
| 명시 요구 | "opencode hero 문구를 claude hero 문구 위치에 맞춰라. opencode의 composer 시작 위치가 상대적으로 claude composer의 위치와 맞아야, 컴포저 전환 시 사용자에게 자연스럽다." | 같은 세션 |
| 사용자 답변 | 정렬 기준 = **입력창 상단**(둥근 입력 박스 윗변을 같은 y) | AskUserQuestion |
| 명시 요구 | "설정 -> 일반 탭에서 '업데이트' 항목 아래에 '<로고, 컬러> Claude', '<로고, 컬러> OpenCode', 항목을 추가하라." | 같은 세션 |
| 명시 요구 | Claude: "'출력 스타일' … 콤보박스에는 [Concise, Explanatory, Learning, Proactive] 를 구성하고 Concise 를 기본 설정하라. 이것은 sdk에서 제공하고 있으니 검토하라." | 같은 세션 |
| 사용자 답변 | "sdk에 정의된 setting 값이고 query() 호출시 전달될 수 있는 값아닌가? 그런 배경이면 전역 설정만으로도 진행중인 세션에서도 다음 사용자 턴에서 적용이 가능할 것으로 기대된다" → SDK 검토 후 설명 문구는 **동작에 맞게 수정** | AskUserQuestion 2회 |
| 명시 요구 | OpenCode: "'권한 자동 수락'을 추가하고 '권한 요청이 자동으로 승인됩니다.' 라고 설명하라. on/off 토글 버튼을 제공하라. 이것이 sdk에서 제공하고 있는지 확인하고 검토하라." | 같은 세션 |
| 명시 요구 | "opencode 세션: composer 위 git 패널스택 제거하라" | 같은 세션 |
| 명시 요구 | "transcript의 사용자/어시스턴트 메시지버블의 폰트를 claude transcript와 똑같이 하라. -> claude transcript의 디자인 폰트/테마를 공통 요소로 뽑아내어 모든 하네스(claude, opencode, etc.)에 기본 상속되도록 하라." | 같은 세션 |
| 사용자 답변 | 공통 범위 = **활자 + 마크다운**(크기·굵기·행간·heading·인라인 코드 크기·문단 간격). 색은 OpenCode 팔레트 유지 | AskUserQuestion |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | nav `새 대화`(펼침·접힘 둘 다)는 팝업 없이 `/new`로 이동한다. 하네스 선택 팝업 컴포넌트를 삭제한다 | "팝업되는 메뉴를 제거하라… 바로 … 이동" | 사용자 | ACTIVE | 0267 D-01·D-02·D-03 대체 |
| D-002 | 랜딩 하네스는 마지막으로 쓴 하네스(`lastBackend`)다. 하네스 전환은 Composer 모델 메뉴로 한다 | 팝업이 사라지면 선택 지점은 기존 모델 메뉴(`setModel`의 backend 전환) | 추론 | ACTIVE | 0267 D-04 대체(선택 지점만) |
| D-003 | 이미 `/new`에 있을 때 `새 대화`를 눌러도 초안을 지우지 않는다(다른 nav 항목과 같은 `navigate`) | 팝업 이전 동작(`2544dbdc^:Sidebar.tsx:95`)과 같음; 경로 진입 시 초안 정리는 `useChatRouteSync`가 함 | 추론 | ACTIVE | — |
| D-004 | 작업 경로 버튼(`CwdButton`)의 폴더 선택 대화상자에서 고른 경로를 설정 `lastCwd`로 저장하고, 이후 새 대화 랜딩의 기본 작업 경로로 쓴다. 앱 재시작 후에도 유지된다 | "탐색기 모달에서 선택한 마지막 경로" | 사용자 | ACTIVE | — |
| D-005 | 저장된 경로가 없거나 더 이상 폴더가 아니면 기존 기본값(바탕화면)이다. 프로젝트 랜딩의 기본값은 프로젝트 경로 그대로다. 참조 경로(`+`) 선택은 저장하지 않는다 | "프로젝트 경로 기본 설정" = 작업 경로 | 추론 | ACTIVE | — |
| D-006 | 랜딩 정렬 기준은 입력창 상단이다. 같은 창 크기에서 OpenCode 입력창 윗변 y = Claude 입력창 윗변 y. OpenCode 워드마크의 아랫변은 Claude hero 문구 아랫변과 같은 y다. Claude 랜딩은 현재 위치를 유지한다 | "claude hero 문구 위치에 맞춰라" + 사용자 답변 | 사용자 | ACTIVE | — |
| D-007 | 설정 `일반` 탭의 `업데이트` 그룹 아래에 `Claude` 그룹, 그 아래 `OpenCode` 그룹을 둔다. 그룹 제목 앞에 각 하네스 로고를 브랜드 색(Claude `text-spinner`, OpenCode `text-ink`)으로 표시한다 | 사용자 요구 | 사용자 | ACTIVE | — |
| D-008 | Claude `출력 스타일` 선택지는 `Concise`·`Explanatory`·`Learning`·`Proactive`(표시명 = SDK 이름, 번역 없음), 기본 `Concise`. 설명 문구는 ko "Claude가 응답을 구성하는 방식입니다. 진행 중인 세션에도 다음 메시지부터 적용됩니다." | 사용자 + 설명 문구 수정 답변 | 사용자 | ACTIVE | 원문 문구 대체(사용자 승인) |
| D-009 | 출력 스타일은 전역 설정 하나다. 새 Claude 프로세스는 시작 시 flag 설정 층으로, 실행 중 프로세스는 다음 사용자 턴 입력 전에 `applyFlagSettings({ outputStyle })`로 적용한다. 세션별 재정의는 만들지 않는다. Work·Code 모두 적용, 제목 생성 1회 호출에는 적용하지 않는다 | SDK 검토(§8) + 사용자 답변 | 사용자 | ACTIVE | — |
| D-010 | Orca 출력 스타일 값은 provider 설정 blob의 `outputStyle`보다 우선한다 | Orca UI에서 고른 값이 실제로 적용돼야 한다 | 추론 | ACTIVE | — |
| D-011 | OpenCode `권한 자동 수락` 토글, 기본 off, 설명 "권한 요청이 자동으로 승인됩니다." on이면 이후 도착하는 OpenCode 권한 요청(하위 작업 포함)에 승인 카드 없이 SDK `permission.reply({ reply: 'once' })`로 답한다. 질문(`question.asked`)은 계속 사용자에게 묻는다. 이미 떠 있는 승인 카드는 그대로 둔다 | "권한 요청이 자동으로 승인" — 요청을 받아 자동 승인; off로 돌리면 즉시 묻기로 돌아가도록 `always`가 아닌 `once` | 사용자 + 추론 | ACTIVE | — |
| D-012 | OpenCode 세션 Composer 위 git 행(`GitRow`)을 표시하지 않는다. Claude는 기존대로 | 사용자 요구 | 사용자 | ACTIVE | — |
| D-013 | 대화 본문 활자(사용자 버블·대기 버블·어시스턴트 본문·Markdown의 크기·굵기·행간·heading·인라인 코드 크기·문단/목록 간격)는 Claude 현재 값을 공통 정본으로 옮기고 모든 하네스가 기본 상속한다. 색 토큰은 하네스별로 유지한다 | 사용자 요구 + 범위 답변 | 사용자 | ACTIVE | `design-system.md`의 "OpenCode 공유 본문 … 전용 본문 활자" 대체 |
| D-014 | 하네스 설정 패치는 하네스 단위로 병합한다. `harnesses.claude.outputStyle`만 저장해도 `instructions`·`executablePath`가 지워지지 않는다 | 현재 병합은 한 단계(`settings-store.ts:105`)라 형제 필드를 덮는다 | 추론 — 데이터 보존 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-014.
- 변경된 결정: 0267 D-01~D-04 → D-001·D-002(사용자 변경). `design-system.md` OpenCode 본문 활자 규칙 → D-013(사용자 변경).
- 기존 ACTIVE 중 유지: 0267 D-10(직접 고른 하네스 유지 — 이제 모델 메뉴 선택에만 해당), 0228 D-003(마지막 에이전트 종류 기억), OpenCode 랜딩의 작업 컨텍스트는 입력 아래(`Composer.tsx:403`).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1, D-002↔AC1, D-003↔AC2, D-004↔AC3·AC4, D-005↔AC4, D-006↔AC5·AC6, D-007↔AC7, D-008↔AC7, D-009↔AC8·AC9·AC10, D-010↔AC8, D-011↔AC11·AC12, D-012↔AC13, D-013↔AC14·AC15·AC16, D-014↔AC17.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 출력 스타일은 SDK가 제공하는가 | 제공 — 설정 키 + 실행 중 적용 경로 | `Settings.outputStyle`(`sdk.d.ts:8715`), `applyFlagSettings`(`:2970`), 내장 4종이 CLI에 있음(`claude.exe` 2.1.296: `name:"Concise"…"Proactive",source:"built-in"`) |
| 실행 중 다음 턴에 반영되는가 | 반영 — CLI가 시스템 프롬프트를 만들 때마다 병합 설정의 `outputStyle`을 읽는다 | CLI `uW()`: `Qn()?.outputStyle||pM` → 프롬프트 빌더 `H5t`가 매 호출 `uW()` await. `intro`·`doing_tasks` 절은 캐시 절(`em`) 밖 |
| 세션 메뉴 재정의는 SDK 기능인가 | 아니다 — 앱 기능. 이번 범위 아님(D-009) | 사용자 답변 |
| OpenCode 자동 승인은 SDK가 제공하는가 | 두 수단 존재. 요청 응답 `permission.reply`를 채택 | `client.permission.reply`(`approval.ts:40`), 세션 규칙 `permission: PermissionRuleset`(`types.gen.d.ts:8098`) |
| 세션 규칙(`'*': allow`)을 쓰지 않는 이유 | Orca는 생성 시 `'*': ask`를 고정(`channel.ts:313`, `adapter.ts:176`)해 전부 Orca로 받는다. 규칙은 세션마다 남아 토글 off가 기존 세션에 즉시 반영되지 않는다 | 동 |
| 이미 충족됐는가 | 아니오 | 팝업 `Sidebar.tsx:114·169`, 경로 기본값 Desktop `bootstrap.ts:732`, OpenCode 랜딩 `pt-[25.375cqh]` `opencode/surfaces.ts:8` |
| git 행 제거는 능력 자체를 없애는가 | OpenCode Composer의 행만. diff 우측 패널 타일은 남음 | `Composer.tsx:257-259` |
| ACTIVE 결정 충돌 | 0267 D-01~04, design-system OpenCode 본문 규칙 — 사용자 변경으로 대체 | §3 |

- 사용자에게 올릴 결정: 없음(정렬 기준·공통 범위·재정의·설명 문구는 답변으로 닫음).
- 코드 조사로 닫은 사실: SDK 두 경로, 설정 병합 결함(D-014), 하네스별 랜딩·활자 위치.

## 5. 동작 / 사용자 흐름

```text
nav 새 대화 클릭 → /new (팝업 없음) → 랜딩: 마지막 하네스 · 마지막 경로
  작업 경로 클릭 → 폴더 선택 → 경로 칩 갱신 + lastCwd 저장
  모델 메뉴에서 하네스 전환 → 입력창 같은 y, hero/워드마크 같은 줄
설정 > 일반 > Claude > 출력 스타일 변경 → 새 프로세스는 처음부터, 실행 중은 다음 메시지부터
설정 > 일반 > OpenCode > 권한 자동 수락 on → 이후 권한 요청 자동 승인(질문은 계속 표시)
OpenCode 대화 → Composer 위 git 행 없음 · 본문 활자 = Claude
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 다른 화면에서 `새 대화` | `navigate('/new')`, 진입 시 초안 정리(기존) | 마지막 하네스 랜딩 |
| `/new`에서 `새 대화` | 같은 경로 — 아무것도 바꾸지 않음 | 초안 유지 |
| 폴더 선택 완료 | 초안 cwd 변경 + `lastCwd` 저장 + 이번 실행 기본값 갱신 | 경로 칩 갱신 |
| 폴더 선택 취소 | 변화 없음 | 그대로 |
| `lastCwd` 저장 실패 | 초안 cwd는 바뀜, 오류 토스트(`saveFailed`) | 이번 대화는 진행 가능 |
| 앱 시작, `lastCwd` 폴더 있음/없음 | 그 경로 / 바탕화면 | 랜딩 경로 |
| 출력 스타일 변경(실행 중 세션) | 다음 `pushTurn` 전에 1회 적용 | 다음 답변부터 스타일 변화 |
| 스타일 적용 실패 | 그 턴을 오류로 끝냄(effort와 같은 계약 `adapter.ts:1025-1027`) | 오류 표시, 입력은 기존 오류 처리 |
| 자동 수락 on + 권한 요청 | 카드 없이 `once` 응답 | 도구가 바로 진행 |
| 자동 수락 응답 실패 | 기존 `replyToApproval` 실패와 같이 채널 중단(`channel.ts:353-355`) | 기존 오류 |
| 자동 수락 on + 질문 | 기존 질문 카드 | 질문 표시 |

### 파생 UX / 엣지케이스

- keyboard / a11y: nav `새 대화` 버튼에서 `aria-haspopup`·`aria-expanded`를 없앤다. 설정 Select·Toggle은 기존 컴포넌트의 라벨 계약을 쓴다. 로고는 장식(`aria-hidden`)이고 그룹 제목 텍스트가 이름이다.
- theme: 로고 색은 시맨틱 토큰(`text-spinner`·`text-ink`), 두 테마 확인.
- 랜딩 정렬: 참조 경로가 여러 개라 Claude 경로 행이 두 줄이 되면 그만큼 Claude 입력창이 내려간다 — 기본 한 줄 상태를 기준으로 한다.
- 다른 locale: en 문구 동시 추가.

## 6. 범위 / 비범위

- **범위**: §2의 9개 요구 중 기능 8개(버그는 0284).
- **비범위**: 세션별 출력 스타일 재정의, OpenCode 세션 규칙 기반 승인, 기존 승인 카드 일괄 처리, OpenCode 도구 카드·전용 chrome 디자인 변경, 랜딩 외 Composer 배치.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 세션별 출력 스타일 재정의 | 예 — 세션별 저장 스키마. 사용자 결정으로 하지 않음 | 후속 요구 시 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 펼침·접힘 nav의 `새 대화` 클릭은 팝업을 열지 않고 `/new`로 이동하며, 랜딩 하네스는 직전 하네스다 | `app/Sidebar.interaction.test.ts`: 두 모드에서 클릭 → `navigate('/new')` 1회, `role="menu"` 0개, `aria-haspopup` 없음. `chatStore.landingDefault` 계열: `seedLandingBackend('opencode')` 후 `/new` 진입 초안 backend = opencode | `Sidebar` 버튼 → router → `useChatRouteSync` |
| R-01 | AT-02 / AC2 | `/new`에서 다시 누르면 초안 텍스트·첨부가 남는다 | Sidebar 테스트: `/new` 상태에서 클릭 → `chatActions.newChat` 호출 0 | 동 |
| R-02 | AT-03 / AC3 | 작업 경로 폴더 선택 후 새 대화(같은 실행·재시작 후)를 열면 그 경로가 기본이다 | renderer: `setPendingCwd(p)` → `settingsApi.set({ lastCwd: p })` 1회 + 이후 `newChat()` 초안 cwd = p. main: `orca:session:cwd`가 존재하는 `lastCwd`를 반환 | `CwdButton` → `chatActions.setPendingCwd` → settings → 다음 부트 `bootstrapChat` |
| R-02 | AT-04 / AC4 | 저장 경로가 없거나 폴더가 아니면 바탕화면, 프로젝트 랜딩은 프로젝트 경로, 참조 경로 선택은 저장 안 함 | main 핸들러 단위: 미설정·삭제된 경로·파일 경로 → Desktop. renderer: `useDirectoryPicker` 경로는 `lastCwd` 미기록 | `sessionCwd` 핸들러 |
| R-03 | AT-05 / AC5 | 같은 창 크기에서 OpenCode 입력창 윗변 = Claude 입력창 윗변(±1px), 워드마크 아랫변 = Claude hero 아랫변(±2px). Claude는 변경 전 위치 그대로(±1px) | **사람 실기**(dev 빌드 DevTools 측정, 1280×800·1440×900·1024×700, 참조 경로 0개) — 레이아웃 계산이 jsdom에 없다 | `/new` → `Landing` |
| R-03 | AT-06 / AC6 | 두 하네스 랜딩이 같은 공통 프레임·hero 슬롯을 쓰고 OpenCode의 입력 아래 컨텍스트는 중앙 정렬 높이에 들어가지 않는다 | `pages/NewChatLandingPage.harness.test.ts`: 두 하네스 렌더의 프레임 요소가 같은 class, OpenCode 슬롯에 공통 슬롯 표식·입력 위 여백 표식, 하단 컨텍스트가 흐름 밖 표식(구조 단언 — AC5의 보조) | 동 |
| R-04 | AT-07 / AC7 | 설정 `일반`에서 `업데이트` 다음에 로고+`Claude` 그룹(출력 스타일 Select: 4개, 기본 Concise, 지정 설명), 그 다음 로고+`OpenCode` 그룹(권한 자동 수락 Toggle, 기본 off, 지정 설명) | `features/settings/components/generalTab.render.test.ts`: 그룹 제목 순서 `…업데이트, Claude, OpenCode`, 옵션 값 배열, 초기 선택, 설명 문자열(ko·en), 로고 슬롯 렌더 | 설정 모달 → `GeneralTab` |
| R-05 | AT-08 / AC8 | 새 Claude 대화 프로세스는 첫 턴부터 설정한 스타일로 시작한다(provider 설정 값보다 우선). 제목 생성 1회 호출에는 넣지 않는다 | `adapters/claude/adapter.output-style.test.ts`(신규): fake SDK가 받은 `Options.settings` JSON의 `outputStyle` = 설정값(미설정이면 `Concise`), provider blob의 `outputStyle:'Learning'`보다 우선, `complete()` 옵션에는 없음 | `sendMessage` → `query()` |
| R-05 | AT-09 / AC9 | 실행 중 세션에서 스타일을 바꾸면 다음 사용자 턴 입력 전에 `applyFlagSettings({ outputStyle })`를 정확히 1회 보내고, 바뀌지 않으면 보내지 않는다 | 같은 신규 파일: 순서 로그 `applyFlagSettings` → 입력 push, 두 번째 동일 턴은 호출 0 | `pushTurn` |
| R-05 | AT-10 / AC10 | 실제 Claude에서 `Explanatory`로 바꾸면 진행 중 세션의 다음 답변에 `★ Insight` 블록이 나타나고 `Concise`로 되돌리면 사라진다 | **사람 실기**(실 API — CLI 내부 동작) | 실제 앱 |
| R-06·07 | AT-11 / AC11 | 자동 수락 on이면 root·하위 작업의 `permission.asked`에 `requestApproval` 없이 `reply:'once'`, 질문은 기존대로 `requestApproval`. off면 기존 승인 경로. 토글은 이후 요청부터 반영 | `adapters/opencode/v1/adapter.test.ts` 신규 케이스: preferences getter를 요청 사이에 바꿔 두 요청의 응답 경로가 갈리는지, child session 요청, question 요청 | `openCodeChannel` 이벤트 루프 → `replyToApproval` |
| R-06 | AT-12 / AC12 | 설정 저장값이 main 어댑터에 실시간으로 전달된다 | `app/harnesses` 조립: `preferences('opencode')`가 저장 직후 새 값 — 기존 `bootstrap.ts:194` getter 재사용을 IT로 단언 | settings-store → `preferences` getter → adapter |
| R-08 | AT-13 / AC13 | OpenCode 세션 Composer에 git 행이 없고 Claude Code 세션에는 있다 | Composer 렌더 테스트(신규 `features/chat/components/Composer.gitRow.test.ts`): backend별 `GitRow` 렌더 여부 | `ChatTile` → `Composer` |
| R-09 | AT-14 / AC14 | OpenCode 사용자 버블·대기 버블·어시스턴트 본문의 활자 class가 Claude와 같은 공통 정본에서 오고 색 class만 다르다 | `features/chat/harnesses/common/transcript/typography.test.ts`(신규): 두 하네스 appearance·message class에서 활자 토큰 집합이 같음, 색 토큰은 각자 | `UserMessage`·`PendingSteerTurn`·`AssistantMessage` |
| R-09 | AT-15 / AC15 | OpenCode Markdown 본문(heading·strong·문단·목록·인라인 코드 크기)이 Claude와 같은 렌더 class를 쓴다 | `opencode/transcript` 렌더 테스트: `OpenCodeText` 출력의 prose class에 크기·간격 재정의 없음, 색 재정의만 | `OpenCodeAssistantSegment`·`Timeline`·`AgentViews` |
| R-09 | AT-16 / AC16 | 실제 화면에서 같은 메시지를 두 하네스로 보면 글자 크기·굵기·줄간격·heading 크기가 같다(색 제외). 대화 텍스트 크기 설정 3단계에서도 같다 | **사람 실기**(white/dark) | 실제 앱 |
| R-10 | AT-17 / AC17 | `harnesses.claude.outputStyle`만 저장해도 같은 하네스의 `instructions`·`executablePath`와 다른 하네스 값이 남는다 | `main/infra/settings-store.test.ts` 신규 케이스 | `settings:set` |
| 회귀 | AT-18 / AC18 | Claude 랜딩·Claude transcript·Claude git 행은 변경 전과 같다 | 기존 `pages/NewChatLandingPage.harness.test.ts`·`agentModeLanding.render.test.ts`·Claude transcript 렌더 테스트 green + AC5·AC16 실기의 Claude 측 | 기존 |

### AC 검증 주의사항

- 기존 테스트 재사용: `generalTab.render.test.ts`·`NewChatLandingPage.harness.test.ts`·`Sidebar.interaction.test.ts`·`settings-store.test.ts`·`opencode/v1/adapter.test.ts` 파일 존재 확인. 케이스는 신규로 추가한다.
- 사람 실기 항목: AC5(레이아웃 실측), AC10(실 CLI 동작), AC16(시각). 각 하위 로직(프레임 공유·적용 호출·class 정본)은 AC6·AC9·AC14·AC15로 내렸다.
- N회 기준(AC9): sink `handle.applyFlagSettings`의 프로덕션 호출부 — `rg -n "applyFlagSettings\(" app/src/main/adapters/claude --glob '!**/*.test.ts'` → `adapter.ts:1036`(effort) · `native-resources.ts:160·172`(플러그인 flag) = 3. AC9는 **출력 스타일 키를 담은 호출**만 센다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 명시 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음. 0267의 결정은 Decision 대체로만 다룬다.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-10 | R | §7 | NEW | — |
| R-11 | R | Claude 표면 회귀(AC18) | INHERITED | 기존 테스트 |
| AT-01~AT-18 | AT | §7 | NEW (AT-18 INHERITED) | — |
| SD-01 | SD | `lastCwd` 수명주기: 선택 → 저장 → 같은 실행 기본값 → 재부트 seed | NEW | — |
| SD-02 | SD | 출력 스타일 수명주기: spawn flag → 턴마다 변경 감지 → live 적용 | NEW | — |
| SD-03 | SD | 자동 수락 이벤트 흐름: `permission.asked` → 설정 판정 → reply | NEW | — |
| ST-01~03 | ST | §7 AC3·AC9·AC11 | NEW | — |
| AR-01 | AR | 설정 스키마·패치 병합 → `preferences` getter → 두 어댑터 | NEW | — |
| AR-02 | AR | `SettingsModal`에 로고 슬롯 주입(app → settings feature) | NEW | — |
| IT-01·02 | IT | §7 AC12·AC17 / AC7 | NEW | — |
| MD-01 | MD | 공통 활자 정본 모듈 | NEW | — |
| MD-02 | MD | Composer git 행 하네스 게이트 | NEW | — |
| MD-03 | MD | 공통 랜딩 프레임·hero 슬롯 | NEW | — |
| UT-01~03 | UT | §7 AC14·AC15 / AC13 / AC6 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02 | REQUIRED | nav 버튼 click → `navigate` → router | `app/Sidebar.interaction.test.ts` 신규 `'navigates straight to the landing from expanded and collapsed nav'` · `'keeps the draft when already on the landing'` | required — 두 모드 중 하나만 고치는 회귀: 접힘 버튼 핸들러를 팝업 토글로 되돌려 red | EP-1 (2) |
| VP-02 | SD-01 ↔ ST-01 | REQUIRED | `CwdButton` pick → `setPendingCwd` → `settingsApi.set` + `cwdCache` → `newChat` / 부트 `sessionApi.cwd()` → 핸들러 stat | `features/chat/store/chatStore.lastCwd.test.ts`(신규) `'persists the picked work path and seeds later drafts'` · `main/app/handlers/session.test.ts`(신규 또는 기존 파일) `'returns the remembered work path only while it is a directory'` | required — 핸들러가 stat 없이 반환(삭제 경로 케이스 red) · `cwdCache` 미갱신(같은 실행 케이스 red) | EP-2 (4) |
| VP-03 | R-03 ↔ AT-05·06 | REQUIRED | `Landing` → 프레임 → hero 슬롯 → `Composer` | AT-05 사람 실기 · `pages/NewChatLandingPage.harness.test.ts` 신규 `'shares the landing frame and hero slot across harnesses'` | not selected — AC5 실측이 의미 oracle, AC6은 보조 | EP-5 (3) |
| VP-04 | R-04 ↔ AT-07 | REQUIRED | `SettingsModal`(로고 슬롯) → `GeneralTab` → `settingsApi.get/set` | `generalTab.render.test.ts` 신규 `'shows Claude and OpenCode groups after updates with defaults'` · `'saves only the chosen harness field'` | required — 두 그룹 순서 맞바꿈 시 red(형제 슬롯) | EP-6 (2) |
| VP-05 | SD-02 ↔ ST-02 | REQUIRED | preferences getter → `sendMessage` flag 설정 / `pushTurn` → `applyFlagSettings` → 입력 push | `adapters/claude/adapter.output-style.test.ts`(신규) `'starts new queries with the configured style over provider settings'` · `'applies a changed style once before the next turn input'` · `'leaves the one-shot completion without a style'` | required — `pushTurn` 비교 변수 미갱신(매 턴 호출) 시 red, spawn 병합 순서 뒤집기(provider 우선) 시 red | EP-3 (3) |
| VP-06 | SD-03 ↔ ST-03 | REQUIRED | `permission.asked`·`question.asked` → 설정 판정 → `permission.reply` / `requestApproval` | `adapters/opencode/v1/adapter.test.ts` 신규 `'auto-accepts permissions once while enabled and still asks questions'` · `'reads the auto-accept preference per request including child sessions'` | required — `once`→`always` 맞바꿈 red, question 분기에도 자동 승인 적용 시 red | EP-4 (2) |
| VP-07 | AR-01 ↔ IT-01 | REQUIRED | `settings:set` → `mergeSettings` → `SettingsSchema` → `preferences(id)` | `main/infra/settings-store.test.ts` 신규 `'merges a partial harness preference without clearing siblings'` · `main/app/harnesses/registry.test.ts` 또는 bootstrap IT `'passes saved harness preferences to adapters live'` | required — 병합을 한 단계로 되돌리면 red · 패치 스키마에 기본값(`instructions ''`)을 남기면 red | EP-7 (2) |
| VP-08 | AR-02 ↔ IT-02 | REQUIRED | `SidebarUserButton` → `SettingsModal` prop → `GeneralTab` 그룹 제목 | `generalTab.render.test.ts`의 로고 슬롯 단언 + `SettingsModal.render.test.ts` 신규 `'passes the harness brand slot to the general tab'` | not selected | EP-6 (2) |
| VP-09 | MD-01 ↔ UT-01 | REQUIRED | 공통 정본 → claude/opencode appearance·surfaces·`OpenCodeText` | `common/transcript/typography.test.ts`(신규) + `opencode/transcript` 렌더 테스트 신규 `'renders OpenCode prose with shared typography and its own colours'` | required — OpenCode 한 자리에 기존 `font-[440]` 복귀 시 red | EP-8 (5) |
| VP-10 | MD-02 ↔ UT-02 | REQUIRED | `ComposerModule.showGitRow` → `Composer` gitRow 슬롯 | `features/chat/components/Composer.gitRow.test.ts`(신규) `'renders the git row only for harnesses that allow it'` | required — Claude/OpenCode 값 맞바꿈 red | EP-9 (2) |
| VP-11 | MD-03 ↔ UT-03 | REQUIRED | 프레임 토큰 → 두 landing presentation | VP-03의 구조 테스트 | not selected | EP-5 (3) |
| VP-12 | R-11 ↔ AT-18 | REGRESSION | Claude 랜딩·transcript·git 행 | 기존 `NewChatLandingPage.harness.test.ts`·`agentModeLanding.render.test.ts`·Claude transcript 렌더 스위트 + AC5·AC16 Claude 측 | not selected | 0 — 동작 불변 확인 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint·typecheck | renderer·main·shared 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경 유발분 |
| 관련 vitest(비-DB) | pair 좌표 | `./node_modules/.bin/vitest run <위 파일들>` | 이번 변경 유발분 |
| 문서 인벤토리 | 설정 키 추가 → 생성물 갱신 | `node scripts/check-doc-inventory.mjs` 후 `--check` | 이번 변경 유발분 |
| 디자인 문서 | 컴포넌트 삭제·공통 시각 규칙 변경 | `design-components.md`·`design-system.md`·`rendering.md` 갱신 | renderer AGENTS §6 |
| trailer 파싱 | 커밋 | `git log -1 --format='%(trailers:only=true)'` | 이번 커밋 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 새 대화 팝업은 `Sidebar`가 두 모드에서 연다 | `app/Sidebar.tsx:110-118`·`:165-173`, `app/NewChatHarnessMenu.tsx` |
| 랜딩 하네스 기억은 이미 있음 | `chatStore.ts:171-196`(`seedLandingBackend`), `:1784`(`lastBackend` 저장) |
| 기본 cwd는 바탕화면, renderer seed는 `orca:session:cwd` 1곳 | `bootstrap.ts:732`, `handlers/session.ts:56`, `chatStore.ts:2072` |
| `CwdButton`만 작업 경로를 바꾼다 | `CwdButton.tsx:52-53`; 참조 경로는 `useDirectoryPicker.ts:54` |
| Claude 랜딩 = 세로 중앙, OpenCode = 상단 `25.375cqh` | `claude/surfaces.ts:6-8`, `opencode/surfaces.ts:6-8` |
| Claude 경로 행은 입력 위, OpenCode는 입력 아래(`pt-6`) | `Composer.tsx:230·251·403` |
| 워드마크 비율 720×129 | `opencode/Wordmark.tsx:34` |
| 출력 스타일 SDK 표면 | §4 첫 두 행 |
| Claude 어댑터는 preferences를 받지 않는다 | `app/harnesses/claude/module.ts:33`, `adapter.ts:343-346` |
| live effort 적용 패턴 | `adapter.ts:1035-1038` |
| OpenCode 권한 이벤트 → `replyToApproval` | `channel.ts:343-355`, `approval.ts:7-51` |
| 설정 병합은 하네스 맵 한 단계 | `settings-store.ts:105`; 패치 스키마가 기본값을 채움(`protocol.ts:746-753`) |
| `SettingsModal`은 prop 없이 app에서 마운트 | `app/SidebarUserButton.tsx:133` |
| git 행 판정은 agentKind만 본다 | `Composer.tsx:257`, `agentPresentation.ts:11-13` |
| 활자: Claude 버블 `text-body`, OpenCode `14px·font-[440]·leading-[1.6]`; 본문 Claude `leading-[1.7]`, OpenCode `leading-[1.6] font-[440]` + prose 재정의 | `claude/transcript/appearance.ts:3`, `opencode/transcript/appearance.ts:3-6`, `claude/surfaces.ts:3`, `opencode/surfaces.ts:3`, `opencode/transcript/Text.tsx:6-30` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| Sidebar 팝업 배선 | `rg -n "harnessMenu|NewChatHarnessMenu|setHarnessMenuOpen|aria-haspopup" app/src/renderer/src/app/Sidebar.tsx` | 14 | 두 모드 버튼 + 상태 + 렌더 |
| 팝업 참조 | `rg -ln "NewChatHarnessMenu|data-harness-choice" app/src/renderer/src docs` | 4 | 컴포넌트·Sidebar·테스트·카탈로그 |
| `pickDirectory()` 호출 | `rg -n "pickDirectory\(\)" app/src/renderer/src --glob '!**/*.test.*'` | 3 | CwdButton · useDirectoryPicker · api 정의 |
| 랜딩 프레임 토큰 | `rg -n "landingRoot|landingAlign|landingColumn" app/src/renderer/src --glob '!**/*.test.*'` | 15 | contracts 3 · 각 surfaces 3 · 각 presentation 3 |
| 버블·본문 활자 소비 | `rg -n "appearance\.(userBubble|pendingBubble)|[Ss]urfaces\.message" app/src/renderer/src --glob '!**/*.test.*'` | 5 | UserMessage · PendingSteerTurn · PendingAssistant · assistant registry 2 |
| `OpenCodeText` 사용 | `rg -n "<OpenCodeText" app/src/renderer/src` | 4 | AssistantSegment · Timeline · AgentViews 2 |
| `GitRow` 렌더 | `rg -n "<GitRow " app/src/renderer/src --glob '!**/*.test.*'` | 1 | `Composer.tsx:258` |
| 설정 하네스 쓰기 | `rg -n "harnesses: \{" app/src --glob '!**/*.test.*'` | 1 | store 병합만 — renderer 쓰기 0 |

### 수치 / 전칭 표현 검산

- "renderer 쓰기 0" 반례 검색: `rg -n "executablePath|instructions" app/src/renderer/src --glob '!**/*.test.*'`에서 설정 패치 없음 → D-014 병합 변경의 기존 소비자 영향 없음.
- 문서 앵커: `design-components.md:411`(팝업 행), `design-system.md:37`(OpenCode 본문 규칙), `rendering.md:13`("같은 전용 문단·코드·heading 스타일").

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

```text
nav 새 대화 → setHarnessMenuOpen → NewChatHarnessMenu → newChat()+setModel(explicit) → /new
boot → sessionApi.cwd() → Desktop → cwdCache
CwdButton pick → setPendingCwd (초안만)
Landing → harnessLanding(backend).{root,align,column,Header} → 하네스별 기하
settings > 일반: 프로필·환경설정·알림·업데이트 (하네스 그룹 없음)
Claude query(): flag settings = provider blob (+plugins)
OpenCode permission.asked → requestApproval → 카드
Composer gitRow = agentUiPolicy(agentKind).showGitRow (backend 무관)
transcript 활자 = 하네스 appearance/surfaces/Text 각자
```

### TO-BE — 변경 후 목표 구조와 동작 경로

```text
nav 새 대화 → navigate('/new')                       (팝업 삭제)
boot → sessionApi.cwd() → lastCwd(폴더면) ‖ Desktop → cwdCache
CwdButton pick → setPendingCwd → settingsApi.set({lastCwd}) + cwdCache
Landing → common LandingFrame(Claude 기하) + hero 슬롯 → 하네스는 Header·여백만 공급
settings > 일반: … 업데이트 · [logo] Claude(출력 스타일) · [logo] OpenCode(권한 자동 수락)
  → settings:set (하네스 단위 병합) → preferences(id) getter
Claude query(): flag settings = provider blob + outputStyle(우선) ; pushTurn: 변경 시 applyFlagSettings
OpenCode permission.asked → autoApprove? reply('once') : requestApproval
Composer gitRow = harness.showGitRow && agentUiPolicy(agentKind).showGitRow
transcript 활자 = common typography → 하네스는 색만
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 하네스 선택 = nav 팝업 | 모델 메뉴(기존) | D-001·002 | VP-01 · Sidebar |
| 책임/소유권 | 랜딩 기하 = 하네스 각자 | 공통 프레임 | D-006 | VP-03·11 · Landing |
| 책임/소유권 | 활자 = 하네스 각자 | 공통 정본 | D-013 | VP-09 |
| data/control flow | 경로 선택 = 초안만 | + 설정·실행 기본값 | D-004 | VP-02 |
| data/control flow | 스타일 없음 | spawn + live | D-009 | VP-05 |
| data/control flow | 권한 = 항상 카드 | 설정 판정 | D-011 | VP-06 |
| state/contract | `HarnessPreferences{instructions,executablePath?}` | + Claude `outputStyle`, OpenCode `autoApprovePermissions`; 최상위 `lastCwd` | D-004·008·011 | VP-07 |
| state/contract | 패치 한 단계 병합 | 하네스 단위 병합, 패치 스키마 기본값 없음 | D-014 | VP-07 |
| error/lifecycle | — | 스타일 적용 실패 = 턴 오류(effort 동형), 저장 실패 = 토스트 | §5 | VP-05·02 |
| test seam | 팝업 테스트 | 직접 이동 테스트 | AC1 | VP-01 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/harness.ts` (shared) | `CLAUDE_OUTPUT_STYLES`·`DEFAULT_CLAUDE_OUTPUT_STYLE`, 하네스별 preferences 타입 | — | main·renderer |
| `shared/protocol.ts` (shared) | 설정 스키마·패치 스키마 | zod | main |
| `main/infra/settings-store.ts` (infra) | 하네스 단위 병합 | patch → settings | handlers |
| `main/app/handlers/session.ts` (app) | `lastCwd` 검증 후 반환 | → string | preload |
| `main/adapters/claude/adapter.ts` (adapters) | 스타일 spawn·live 적용 | preferences getter | module |
| `main/adapters/opencode/v1/{adapter,channel}.ts` (adapters) | 자동 승인 판정 | preferences getter | module |
| `renderer/features/settings/components/GeneralTab.tsx` | 두 그룹 UI | settingsApi | SettingsModal |
| `renderer/features/chat/components/Landing.tsx` + 공통 프레임 | 랜딩 기하 | presentation | NewChatLandingPage |
| `renderer/features/chat/harnesses/common/transcript/typography.ts` (신규) | 활자 정본 | class 문자열 | appearance·surfaces·Text |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| R-01 / VP-01 (EP-1) | `새 대화`는 `navigate('/new')`만 | `Sidebar.tsx` | renderer | 펼침 버튼 onClick 1 · 접힘 버튼 onClick 1 = 2자리 | `rg -n "it.path === '/new'" app/src/renderer/src/app/Sidebar.tsx` → 구현 후 0(분기 없음) 또는 onClick 2 | 한 모드에 팝업 잔존 |
| SD-01 / VP-02 (EP-2) | `lastCwd`: 절대 경로 문자열 \| null | `SettingsSchema.lastCwd` | renderer·main | (a) `setPendingCwd` 저장 (b) `cwdCache` 갱신 (c) `sessionCwd` 핸들러 stat 검증 (d) `SettingsPatchSchema` 수용 = 4자리 | `rg -n "lastCwd" app/src --glob '!**/*.test.*'` → 4자리 + 스키마 선언 | 재시작 후 유실·삭제 경로 seed |
| SD-02 / VP-05 (EP-3) | `outputStyle` 적용 | `preferences().outputStyle ?? DEFAULT` | Claude adapter | (a) `sendMessage` flag 설정 병합(provider 뒤) (b) `pushTurn` 변경 감지·적용 (c) `appliedOutputStyle` 갱신 = 3자리. `complete()`(`adapter.ts:416`)는 제외 | `rg -n "outputStyle" app/src/main/adapters/claude --glob '!**/*.test.*'` | 새/실행 중 세션 미적용 또는 매 턴 중복 |
| SD-03 / VP-06 (EP-4) | 자동 승인 = `permission.asked`만, `once` | `preferences().autoApprovePermissions === true` | OpenCode channel | (a) 이벤트 루프 분기(요청마다 getter 호출) (b) reply 값 = 2자리 | `rg -n "autoApprovePermissions" app/src/main/adapters/opencode --glob '!**/*.test.*'` | 질문 자동 처리·off 미반영 |
| MD-03 / VP-03·11 (EP-5) | 공통 프레임·hero 슬롯·입력 위 여백 | `features/chat/components/landingFrame.ts`(신규) | renderer | (a) `Landing`의 프레임 class (b) OpenCode hero 슬롯(워드마크 아랫변 정렬 + 입력 위 여백 = Claude 경로 행 스택) (c) OpenCode 하단 컨텍스트 흐름 밖 = 3자리 | `rg -n "landingRoot|landingAlign|landingColumn|landingFrame" app/src/renderer/src --glob '!**/*.test.*'` | 전환 시 입력창 이동 |
| R-04 / VP-04·08 (EP-6) | 그룹 순서·로고 슬롯 | `GeneralTab` | renderer | (a) 그룹 렌더 순서 (b) `SettingsModal` → `GeneralTab` 슬롯 전달 = 2자리 | `rg -n "SettingsGroup" app/src/renderer/src/features/settings/components/GeneralTab.tsx` | 순서 바뀜·로고 없음 |
| AR-01 / VP-07 (EP-7) | 하네스 단위 병합, 패치에 기본값 없음 | `settings-store.ts` · `SettingsPatchSchema.harnesses` | main | (a) `mergeSettings` (b) 패치 스키마 = 2자리 | `rg -n "harnesses" app/src/main/infra/settings-store.ts app/src/shared/protocol.ts` | 형제 설정 소실 |
| MD-01 / VP-09 (EP-8) | 활자 class 정본 | `common/transcript/typography.ts` | renderer | claude appearance 1 · opencode appearance 1 · claude surfaces.message 1 · opencode surfaces.message 1 · `OpenCodeText` 1 = 5자리 | `rg -n "userBubble|pendingBubble|message:|data-component=\"opencode-text\"" app/src/renderer/src/features/chat/harnesses --glob '!**/*.test.*'` | 하네스 간 활자 차이 잔존 |
| MD-02 / VP-10 (EP-9) | `ComposerModule.showGitRow` | contracts | renderer | (a) 두 모듈 값 (b) `Composer` 게이트 = 2자리 | `rg -n "showGitRow" app/src/renderer/src/features/chat --glob '!**/*.test.*'` | OpenCode git 행 잔존 |

- 같은 규칙 SSOT: 스타일 목록·기본값은 `shared/harness.ts` 하나 — Select 옵션·zod enum·어댑터 기본값이 같은 배열을 쓴다. 활자는 `typography.ts` 하나.
- 선택적 필드: `outputStyle` 부재 → `Concise`. 손상 값 → zod `.catch('Concise')`. `autoApprovePermissions` 부재·손상 → `false`(fail-closed). `lastCwd` 부재 → Desktop.
- 외부 SDK 경계: `applyFlagSettings`의 인자 타입 `{ outputStyle?: string | null }`(`Settings[K] | null`). 문자열 이름 그대로 전달. OpenCode `permission.reply({ requestID, directory, reply: 'once' })`.
- **패치 스키마**: `SettingsPatchSchema.harnesses`는 하네스별 `.partial()`이고 기본값을 넣지 않는다 — 기본값이 있으면 부분 패치가 `instructions:''`로 덮는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `renderer/src/app/Sidebar.tsx` | 이동 | 팝업 상태·`aria-haspopup`·`aria-expanded`·`harnessMenu` 제거, 두 모드 모두 `navigate(it.path)` | Sidebar 테스트 |
| `renderer/src/app/NewChatHarnessMenu.tsx` | 삭제 | 파일 삭제 | — |
| `shared/harness.ts` | 상수·타입 | `CLAUDE_OUTPUT_STYLES = ['Concise','Explanatory','Learning','Proactive'] as const`, `DEFAULT_CLAUDE_OUTPUT_STYLE='Concise'`, `ClaudePreferences`·`OpenCodePreferences`, `HarnessSettings` 하네스별 타입 | typecheck |
| `shared/protocol.ts` | 스키마 | Claude preferences `outputStyle: enum.catch(default).default(default)`, OpenCode `autoApprovePermissions: boolean.catch(false).default(false)`, 최상위 `lastCwd: string.nullable().default(null)`; 패치 스키마 동반 | 스키마 단위 |
| `main/infra/settings-store.ts` | 병합 | `harnesses`를 하네스별 `{...current[id], ...patch[id]}` | store 테스트 |
| `main/app/handlers/session.ts` | seed | `sessionCwd`: `lastCwd`가 절대 경로이고 `stat().isDirectory()`면 반환, 아니면 `ctx.getCwd()` | 핸들러 단위(fs 임시 디렉토리) |
| `renderer/.../store/chatStore.ts` | 저장 | `setPendingCwd`: 초안 변경 후 `cwdCache = cwd`, `settingsApi.set({ lastCwd: cwd })` 실패 시 `reportError(saveFailed)`(`lastBackend` 저장 패턴 `:1785-1792`) | store 테스트 |
| `renderer/.../components/landingFrame.ts`(신규) + `Landing.tsx` + 양 `landing/presentation.ts`·`surfaces.ts`·`contracts.ts` | 공통 기하 | 프레임 class(Claude 현재 `items-center px-4`)와 hero 슬롯 높이·입력 위 여백 토큰을 공통으로. 하네스 presentation은 `Header`·`heroAlign`만. landing* surfaces 키 제거 | 랜딩 렌더 테스트 |
| `renderer/.../harnesses/opencode/landing/Brand.tsx` · `Composer.tsx` | OpenCode 슬롯 | 워드마크를 hero 슬롯 아래 정렬(`mb-8` 대신 슬롯 공통 하단 간격), 입력 위 여백 = Claude `pt-3`+경로 행 높이 토큰, 입력 아래 컨텍스트는 `absolute`/흐름 밖 + 하단 여백은 Claude `pb-[18px]`와 동일 | 동 |
| `renderer/.../settings/components/{parts,GeneralTab,SettingsModal}.tsx` + `app/SidebarUserButton.tsx` | 설정 UI | `SettingsGroup`에 `leading?: ReactNode`; `SettingsModal`에 `harnessBrand?: (backend) => ReactNode` prop, app이 `HarnessLogo` 주입; GeneralTab이 `settingsApi.get`으로 두 값 로드, 변경 시 `settingsApi.set({ harnesses: { claude: { outputStyle } } })` 등 | generalTab 렌더 |
| `shared/i18n/resources/{ko,en}.ts` | 문구 | `settings.general.claude`·`.outputStyle`·`.outputStyleDesc`·`.opencode`·`.autoApprove`·`.autoApproveDesc`·`.autoApproveToggle` | i18n 키 테스트 |
| `main/app/harnesses/claude/module.ts` · `adapters/claude/adapter.ts` | 스타일 | `new ClaudeAdapter(ext, snapshots, () => options.preferences('claude'))`; `sendMessage` flag 설정에 `outputStyle` 병합(provider 뒤), `pushTurn`에서 `appliedOutputStyle` 비교·적용(effort 블록 동형) | `adapter.output-style.test.ts` |
| `adapters/opencode/v1/{index,adapter,channel}.ts` | 자동 승인 | adapter가 `preferences` getter를 받아 channel에 전달. 루프 분기: `permission.asked`이고 getter on이면 `client.permission.reply({..., reply:'once'})`, 아니면 기존 `replyToApproval` | `adapter.test.ts` |
| `renderer/.../harnesses/contracts.ts` · 양 `composer/Module.tsx` · `components/Composer.tsx` | git 행 | `ComposerModule.showGitRow`(Claude true · OpenCode false), `Composer` 게이트에 AND | Composer 렌더 |
| `renderer/.../harnesses/common/transcript/typography.ts`(신규) + 양 `appearance.ts`·`surfaces.ts` + `opencode/transcript/Text.tsx` | 활자 | Claude 현재 값(`text-body` 버블, 본문 14px·`leading-[1.7]`, Markdown 기본)을 정본으로. OpenCode는 정본 + 색 class만, `Text.tsx` prose에서 크기·굵기·간격 재정의 삭제·색 유지 | typography 테스트 |
| `docs/arch/frontend/{design-components,design-system,rendering}.md` | 문서 | 팝업 행 삭제, OpenCode 본문 활자 규칙 → 공통 상속, `Settings` 그룹 서술 | doc gate |

### 테스트 가능성

- electron 의존: `sessionCwd` 판정은 `fs.stat` 순수 함수로 분리(`resolveLandingCwd(lastCwd, fallback, stat)`).
- 기존 메커니즘 재사용: `preferences` getter(`bootstrap.ts:194`)는 매 호출 `settings.getAll()`이라 실시간 — 형상·시점이 맞다. effort live 적용 패턴은 같은 seam(fake `Query.applyFlagSettings`)으로 관측된다(`adapter.effort.test.ts`).
- 순서 관측(AC9): fake Query가 `applyFlagSettings`·`streamInput`/push 호출을 같은 배열에 기록.

## 12. End-to-end 영향

```text
GeneralTab → settings:set → SettingsStore(merge) → preferences(id) → Claude spawn/pushTurn · OpenCode event loop
CwdButton → chatStore → settings:set(lastCwd) ; boot: sessionCwd → chatStore cwdCache → newChat 초안
```

- producer 기준: 설정값의 정본은 main 설정 파일. renderer는 표시·쓰기만.
- consumer 파생 규칙: 어댑터는 요청 시점마다 getter를 읽고 캐시하지 않는다(OpenCode) / 마지막 적용값만 기억(Claude).

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `send.ts:197·262`(하네스 instructions 읽기) | 병합 변경 후에도 같은 경로 | AC17 |
| OpenCode server pool `preferences()`(instructions·executablePath) | 필드 추가만 | AC17 |
| `sessionApi.cwd()` 소비 | renderer seed 1곳뿐 | AC3·AC4 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: Claude 스타일은 query 생성 시, OpenCode 판정은 요청 도착 시.
- 취소/중단: 자동 승인 응답도 기존 `approvalSignal`을 쓴다.
- retry/partial failure: `lastCwd` 저장 실패는 초안을 되돌리지 않는다(토스트만).
- **다중 저장소 쓰기**: `setPendingCwd`는 renderer 초안(메모리) + 설정 파일 두 곳. 저장 실패 시 관측 = 초안 경로 변경 + 다음 부트에 이전 `lastCwd` — 허용(토스트로 고지). 산출 문서 사본은 `plan.md`·`INDEX.md`.

## 14. 성능 / 상한 / 최적화

- 새 요청 수: 출력 스타일 변경 시 세션당 다음 턴 1회 `applyFlagSettings`. 자동 승인은 기존 reply 1회와 같음.
- 프롬프트 캐시: 스타일 변경 턴은 시스템 프롬프트가 바뀌어 캐시 재작성 — 사용자 동작 시에만.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 새 대화 클릭은 하네스 팝업 | 0267 D-01~03 | D-001 | 변경(사용자) |
| 선택 하네스의 새 초안으로 진입 | 0267 D-04 | D-002 | 변경 — 선택 지점만 모델 메뉴로 |
| 직접 고른 하네스 유지 | 0267 D-10 | §3 메모 | 유지 |
| OpenCode 공유 본문 = 전용 본문 활자 | `design-system.md:37` | D-013 | 변경(사용자) |
| 라이브·확정 텍스트 같은 전용 스타일 | `rendering.md:13` | D-013 | 변경 — "같은 공통 스타일" |
| OpenCode 컨텍스트는 입력 아래 | `Composer.tsx:403`·`CwdPanel.tsx:19` 주석 | §11 | 유지(위치 유지, 흐름만 분리) |
| "노출 판정은 `gitRowView` 한 곳" | `GitRow.tsx:125-127` | D-012 | 유지 — 하네스 게이트는 렌더 슬롯 상위(Composer)의 기존 agentKind 게이트와 같은 자리 |
| 하네스 공통 셸에 하네스 표면 전파 금지 | renderer AGENTS §1 | §11 | 유지 — 공통으로 옮기는 것은 사용자 지정 Claude 활자·랜딩 기하 |
| 의존성 추가 | app AGENTS | — | 없음 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 랜딩 정렬이 경로 행 높이 토큰에 의존 | 기본 한 줄 기준(§5), 토큰은 `CwdPanel` 클래스와 같은 모듈에서 정의 |
| 자동 승인으로 위험 명령이 묻지 않고 실행 | 기본 off, 사용자가 켜는 설정, 설명 문구 명시 |
| 스타일 이름이 CLI 버전에 따라 사라짐 | 미지원 이름이면 CLI가 기본 스타일로 대체(`uW`: `e[h]??null`) — 오류 없음 |

- 되돌리기 어려운 결정: 설정 키 이름(`lastCwd`·`harnesses.claude.outputStyle`·`harnesses.opencode.autoApprovePermissions`). `last*` 형제(`lastBackend`·`lastAgentKind`) 관례를 따른다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- §11 표의 파일 전부.
- `docs/generated/inventory.md`(재생성), `docs/arch/frontend/{design-components,design-system,rendering}.md`.

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §ABI`, `app/src/renderer/AGENTS.md`(디자인 계약 1~6), `app/src/main/AGENTS.md`(레이어).
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트: §7-A pair 좌표 파일 직접 `vitest run`.
- 사람 실기: AC5·AC10·AC16 (Windows, white/dark).

## READY self-review

- [x] Decision Ledger에 0267 대체·design-system 대체를 기록했다.
- [x] Part I만으로 완료 상태가 이해된다.
- [x] "제거"(팝업 컴포넌트 삭제)를 이동으로 바꾸지 않았다. 설명 문구 변경은 사용자 승인.
- [x] AS-IS/TO-BE 같은 축, Delta → 파일·AC.
- [x] 수치 실측 — §8 전수 8행.
- [x] AC 18개, 각 행동·검증·경로.
- [x] Baseline V, NEW node 전부 REQUIRED pair, Claude 표면 REGRESSION.
- [x] 사람 실기는 레이아웃 실측·실 CLI·시각만, 하위 로직은 UT/IT로 내림.
- [x] 데이터 보존(D-014)을 Decision·AC·§10에 귀속.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3에 적었다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: V1 r1의 ACTIVE Decision과 AC를 유지했다. nav 직접 이동, 마지막 경로, 공통 랜딩, 설정 두 그룹, 스타일 live 적용, 요청별 자동 승인, git 행 게이트, 공통 활자를 구현했다.
- 이견 / 현실성 문제: 없음. DOM 구조 테스트는 픽셀 위치·실제 글꼴·실 CLI 응답의 증거가 아니므로 AC5·10·16 및 AC18의 시각 부분은 사람 실기로 남긴다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. Part II의 파일 배치는 아래 명시적 차이에 기록했고 규범 행은 바꾸지 않았다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

다음 좌표는 모두 이번 관련 vitest 실행 집합 안이다. 경로의 `main/`은 `app/src/main/`, `renderer/`는 `app/src/renderer/src/`를 뜻한다.

| 좌표 | 직접 oracle (`파일:테스트명`) |
|---|---|
| T1 | `renderer/app/Sidebar.interaction.test.ts:navigates straight to the landing from expanded and collapsed nav`(두 모드), `keeps the draft when already on the landing`, `seeds the next landing with the last harness` |
| T2 | `renderer/features/chat/store/chatStore.lastCwd.test.ts:persists the picked work path and seeds later drafts` · `keeps the chosen path when the boot query finishes late` · `keeps the chosen draft and reports a failed persistence write` · `treats picking the current path as an explicit choice before a late project seed` |
| T3 | `main/app/handlers/session.test.ts:returns the remembered work path only while it is a directory` |
| T4 | `renderer/features/settings/components/generalTab.render.test.ts:shows Claude and OpenCode groups after updates with defaults` · `renders the English harness descriptions`; `generalTab.interaction.test.ts:saves only the chosen harness field` |
| T5 | `main/adapters/claude/adapter.output-style.test.ts:starts new queries with the configured style over provider settings` · `applies a changed style once before the next turn input` · `leaves the one-shot completion without a style` · `does not push or remember a rejected style update` |
| T6 | `main/adapters/opencode/v1/adapter.test.ts:auto-accepts permissions once while enabled and still asks questions` · `reads the auto-accept preference per request including child sessions` |
| T7 | `main/infra/settings-store.test.ts:merges a partial harness preference without clearing siblings` · `defaults absent or damaged harness preferences and rejects damaged patches`; `main/app/harnesses/registry.preferences.test.ts:passes saved harness preferences to adapters live` |
| T8 | `renderer/features/settings/components/SettingsModal.render.test.ts:passes the harness brand slot to the general tab` |
| T9 | `renderer/features/chat/harnesses/common/transcript/typography.test.ts:inherits shared bubble and body typography for both harnesses` · `renders OpenCode prose with shared typography and its own colours` |
| T10 | `renderer/pages/NewChatLandingPage.harness.test.ts:renders the git row only for harnesses that allow it` |
| T11 | `renderer/pages/NewChatLandingPage.harness.test.ts:shares the landing frame and hero slot across harnesses` |
| T12 | `renderer/pages/NewChatLandingPage.harness.test.ts` · `renderer/pages/agentModeLanding.render.test.ts` · `renderer/features/chat/harnesses/claude/transcript`의 기존 렌더 케이스 |

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 | nav 직접 이동 | EP-1 펼침·접힘 2 | 2/2 | T1 두 모드 각각 navigate 1회, 메뉴 없음; 같은 경로에서 newChat 0회 | `/new`, 접힘 true/false, 마지막 opencode가 구별되어 유지 | 없음 |
| VP-02 | lastCwd | EP-2 저장·캐시·stat·patch 4 | 4/4 | 저장·캐시=T2, stat=T3, patch=T7 | 선택/프로젝트/참조 경로 분리, 삭제·파일·상대 경로는 fallback, 새 store에도 `C:/chosen` 유지 | 없음 |
| VP-05 | outputStyle | EP-3 spawn·live·적용값 3 | 3/3 | T5 spawn 설정 및 동일/변경 턴 호출 순서·횟수 관측 | spawn provider Learning/사용자 Proactive 구분, live Explanatory 적용; 동일 값 중복 0·실패 시 입력 0 | 실제 CLI 답변은 AC10 별도 |
| VP-06 | permission 자동 수락 | EP-4 요청 분기·reply 2 | 2/2 | T6 getter 3회, 수동 승인 2회, root/child HTTP reply 관측 | false→true→false에 reject→once→reject; question은 승인 요청 1회 | 없음 |
| VP-03·11 | 공통 랜딩 구조 | EP-5 프레임·hero/위 여백·흐름 밖 context 3 | 3/3(구조) | T11 root/align/column/hero class 배열 동일, center·max-width·hero 끝 정렬·위 여백·absolute 관측 | claude/opencode 교대 렌더; OpenCode context가 absolute | AC5 픽셀 실측 |
| VP-04·08 | 그룹 순서·브랜드 전달 | EP-6 그룹·SettingsModal 전달 2 | 2/2 | T4 업데이트→Claude→OpenCode, 옵션/기본값/설명/브랜드; T8 슬롯 전달 | ko/en 문구, 서로 다른 claude/opencode 슬롯; Learning 로드→Proactive 저장·toggle true | 없음 |
| VP-07 | 하네스 부분 병합 | EP-7 merge·patch schema 2 | 2/2 | T7 부분 패치→재시작·손상 값·실제 registry 조립 getter 관측 | 두 instructions sentinel·서로 다른 executablePath, style/boolean 변경 후 보존 | 없음 |
| VP-09 | 공통 활자 | EP-8 양 appearance·양 message·OpenCodeText 5 | 5/5 | T9 두 버블 토큰·message 동등; live/확정 Markdown h1/p/strong/code/ul/li class 동등 | 양 palette 유지; OpenCode 기존 font440·leading1.6·문단/heading 간격 override 없음 | AC16 실제 글꼴 |
| VP-10 | git 행 | EP-9 두 모듈 값(묶음)·Composer gate 2 | 2/2 | T10 실제 Composer 렌더에서 GitRow leaf 존재 여부 | Claude code=true, OpenCode code=false, Claude work=false | 없음 |

§10 검색 명령을 다시 실행하고 선언·운반·소비처를 분리해 대조했다. 검색 일치 줄 수를 강제 자리 수로 세지 않았다.

| EP | 검색 출력과 고정 목록의 차집합 |
|---|---|
| EP-1 | 기존 `/new` 조건 0줄. `onClick.*navigate` 보완 검색에서 Sidebar 96·141 두 자리가 나왔으며 고정 목록 밖 클릭은 없음. |
| EP-2 | lastCwd 검색은 shared 선언/patch·session handler/helper·store 저장. `cwdCache =` 보완 검색의 setPendingCwd가 캐시 자리이며, 부트 seed는 고정 4자리 밖의 기존 운반 자리(늦은 응답 T2 추가). |
| EP-3 | adapter spawn 519–522·pushTurn 1048–1051을 세 자리로 대조. complete 경로는 의도적 제외이며 T5에서 옵션 부재 관측. 목록 밖 스타일 sink 없음. |
| EP-4 | channel 355의 요청 판정·357의 once 응답을 두 자리로 대조. preferences getter의 module→index→adapter 운반은 EP-7 조립 T7로 보조 확인. |
| EP-5 | Landing의 root/align/column/hero, Composer 위 여백/하단 context가 고정 세 자리. CwdPanel의 contextRow는 높이 토큰 소비처이며 정렬 실측의 대체 증거로 세지 않음. |
| EP-6 | GeneralTab의 여섯 그룹에서 마지막 두 그룹·SettingsModal 전달이 고정 두 자리. app의 SidebarUserButton 로고 공급은 목록 밖 운반 자리로 코드 대조했으며 닫은 수에 추가하지 않음. |
| EP-7 | mergeSettings 한 곳·SettingsPatchSchema 한 곳. SettingsSchema.harnesses는 저장값 선언이며 별도 병합 자리가 아님. |
| EP-8 | appearance 두 곳·surfaces 두 곳·Text 한 곳을 대조. 나머지 검색 결과는 공통 UserMessage/PendingSteerTurn 소비처·타입 선언·오류 message 필드이며 하네스 활자 정의 자리가 아님. |
| EP-9 | 두 composer Module 값과 Composer AND gate를 고정 두 자리로 대조. 나머지는 기존 agentKind 정책·sessionStarted 전달·GitRow 내부 diff 허용 판정이며 신규 하네스 게이트가 아님. |

- 고정 자리 검산: 2 + 4 + 3 + 2 + 3 + 2 + 2 + 5 + 2 = **25자리**. 중복 참조 EP-5·6은 한 번만 셌다. 고정 목록과 위 직접 oracle 대응을 뺀 미대응 자리는 없음; 시각 실측은 이 구조 자리 수에 포함하지 않는다.
- 검색에서 확인한 목록 밖 운반 자리는 위 표에 남겼다. 정의가 필요한 새 Decision·AC·pair는 발견하지 않았다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | T1 | M1 red |
| VP-02 | REQUIRED | SELF_PASS | T2·T3·T7 | M2·M3 red |
| VP-03 | REQUIRED | SELF_BLOCKED | T11 구조 확인, AC5 실측 대기 | not selected |
| VP-04 | REQUIRED | SELF_PASS | T4·T8 | M4 red |
| VP-05 | REQUIRED | SELF_PASS | T5 | M5·M6 red |
| VP-06 | REQUIRED | SELF_PASS | T6 | M7·M8 red |
| VP-07 | REQUIRED | SELF_PASS | T7 | M9·M10 red |
| VP-08 | REQUIRED | SELF_PASS | T4·T8 | not selected |
| VP-09 | REQUIRED | SELF_PASS | T9 | M11 red |
| VP-10 | REQUIRED | SELF_PASS | T10 | M12 red |
| VP-11 | REQUIRED | SELF_PASS | T11 | not selected |
| VP-12 | REGRESSION | SELF_BLOCKED | T12 자동 회귀 확인, AC5·16의 Claude 측 실기 대기 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

각 변이는 프로덕션 파일에 한 번씩 적용했다. 실패를 관측한 뒤 원본 바이트 복원 및 동일 테스트 재실행 green을 확인했다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 접힘 nav의 /new 이동 제거 | VP-01 선택 증거(접힘 click 회귀) | 최초 | T1 접힘 케이스, 1/4 실패 | red → 복원 4/4 green |
| M2 stat 없이 lastCwd 반환 | VP-02 선택 증거 | 최초 | T3, 1/1 실패 | red → 복원 1/1 green |
| M3 cwdCache 갱신 제거 | VP-02 선택 증거 | 최초 | T2, 3/5 실패(최종 재실행) | red → 복원 5/5 green |
| M4 Claude/OpenCode 그룹 맞바꿈 | VP-04 선택 증거 | 최초 | T4 기본 그룹 케이스, 1/5 실패 | red → 복원 5/5 green |
| M5 appliedOutputStyle 갱신 제거 | VP-05 선택 증거 | 최초 | T5 live 케이스, 1/4 실패 | red → 복원 4/4 green |
| M6 provider 설정을 사용자 스타일 뒤에 병합 | VP-05 선택 증거 | 최초 | T5 spawn 케이스, 1/4 실패 | red → 복원 4/4 green |
| M7 permission reply once→always | VP-06 선택 증거 | 최초 | T6 두 케이스, 2/20 실패 | red → 복원 20/20 green |
| M8 question도 자동 승인 분기로 보냄 | VP-06 선택 증거 | 최초 | T6 질문 케이스, 1/20 실패 | red → 복원 20/20 green |
| M9 harnesses 병합을 한 단계로 되돌림 | VP-07 선택 증거 | 최초 | T7 형제 보존, 1/15 실패 | red → 복원 15/15 green |
| M10 patch instructions에 빈 문자열 default 복귀 | VP-07 선택 증거 | 최초 | T7 형제 보존, 1/15 실패 | red → 복원 15/15 green |
| M11 OpenCode userBubble에 font440 복귀 | VP-09 선택 증거 | 최초 | T9 토큰 비교, 1/2 실패 | red → 복원 2/2 green |
| M12 Claude/OpenCode showGitRow 맞바꿈 | VP-10 선택 증거 | 최초 | T10 git 행, 1/5 실패 | red → 복원 5/5 green |

- **분모 검산**: 선택 증거 12 · 인용 변이 0 · 별도 신규 oracle 변이 0 = 표 12행. 등록된 구조 oracle는 M1·4·11·12에 포함된다. VP-03·08·11·12는 not selected를 유지했고, 그 밖의 직접 행동 oracle에 새 변이를 추가하지 않았다.
- **덮개 회귀**: 최초 r1이라 이전 verify 고장 이력 없음. 기존 팝업 검사는 D-001에 따라 직접 이동 검사로 대체했고 Claude 기존 렌더 스위트는 유지했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있음. ko/en의 두 그룹·설명·토글 라벨을 GeneralTab이 렌더하고 T4로 관측. 로고는 app 공급→Modal→GeneralTab 전달. | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | §5·13의 설정 저장 실패는 reportError(saveFailed), cwd는 현재 초안 유지. live 스타일 실패는 입력 전 reject. | T2·T4·T5에서 각 실패 관측 |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 저장 실패는 토스트 경로로 보고하고 UI 저장값을 보존. 초기 설정 읽기 실패도 loadFailed로 보고. | 초기 로드 실패 시 두 컨트롤은 비활성 유지; 설정을 다시 열면 재조회 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 부트 cwd는 선택 revision이 바뀌면 폐기. 프로젝트 seed는 같은 경로를 다시 골라도 cwdSelected를 존중. 설정 저장은 동시에 한 건만 허용. | T2 늦은 부트/프로젝트 응답, T4 저장 후 표시값 관측 |
| 로딩·취소·재시도는 무엇을 보이는가 | 설정 로드/저장 중 두 컨트롤 disabled. 스타일 적용 실패는 다음 턴 재시도 가능; 자동 승인도 기존 approvalSignal 사용. | 실 API 취소의 신규 정책 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 부트 cwd 응답이 직접 고른 새 경로보다 늦게 오면 기본값 캐시가 되돌아갈 수 있음 | 선택 revision으로 오래된 응답 폐기 | T2 late boot |
| 2 | 현재 경로를 다시 고르면 reducer가 같은 객체를 반환해 프로젝트 기본값이 덮을 수 있음 | 명시 선택은 값 동일 여부와 무관하게 cwdSelected=true | T2 late project seed |
| 3 | 초안·캐시와 디스크 저장은 원자적이지 않음 | §13대로 초안/캐시는 유지하고 실패 보고. 재부트는 이전 저장값일 수 있음 | T2 rejected persistence |
| 4 | 하네스 설정 로드 실패 후 기본값을 사용자가 저장할 수 있음 | 로드 성공 전 두 컨트롤 비활성, 실패 메시지, 재진입 시 다시 로드 | GeneralTab harnessLoaded·reportError 경로 |
| 5 | 랜딩 정렬은 실제 폰트·창 크기의 영향을 받음 | 기본 한 줄·참조 경로 0개 계약으로 공통 높이 토큰 사용. 수치 통과는 주장하지 않음 | AC5 사람 실기 대기 |

### 설계 대비 명시적 차이

- `resolveLandingCwd`는 `session-cwd.ts`로 분리하고 실제 등록된 IPC callback에서 임시 폴더/파일을 사용해 검증했다.
- git 행 검사는 기존 `NewChatLandingPage.harness.test.ts`에서 실제 Composer에 들어간다. GitRow leaf만 대체하며 ChatTile의 상위 배선을 검증했다고 세지 않는다.
- preferences 조립 IT는 `registry.preferences.test.ts`에 추가했다. 실제 registry·main module·OpenCode implementation을 거쳐 leaf 어댑터 생성자에 도달하며 bootstrap 자체를 실행한 검사는 아니다.
- Markdown의 공통 wrapper 토큰은 하위 레이어 `shared/ui/markdown/typography.ts`가 소유하고 feature의 공통 typography가 이를 사용한다. shared→feature 역방향 import를 만들지 않았다.
- 랜딩 Header에 `framed`를 전달해 공통 hero 안에서는 중복 margin을 없애고 프로젝트/기존 Header 사용처의 margin은 유지했다.
- 만료·credential·별도 디스크 삭제 축은 이번 신규 설정에 해당 없음. 재진입(설정 재조회), 캐시 무효화(부트 응답), 동시 저장, 실패 후 retry는 위 경로로 확인했다.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | shared 설정 타입/스키마; main 설정 병합·경로 조회·하네스 어댑터; renderer nav·랜딩·설정·활자·git 게이트; 관련 테스트; IPC·디자인 문서·생성 인벤토리 |
| 실행 명령 | `cd app; npm run lint`, `npm run typecheck`, 아래 관련 vitest 명령, `node scripts/check-doc-inventory.mjs` 및 `--check`, `node scripts/check-test-budgets.mjs`, `git diff --check` |
| **관측한 게이트 산출** | lint 0 errors/기존 incompatible-library 2 warnings; typecheck node/web/test 통과; 관련 vitest **51파일 633케이스 통과**. 최종 프레임 단언 보강 후 해당 1파일 5케이스 재통과. |
| 문서 gate | 생성물·prose 정상. 전체 링크 검사는 기존 `.tmp/opencode-dev`·`app/.temp/opencode` 외부 체크아웃의 깨진 링크 각 5개로 exit 1; 이 두 임시 트리 제외 링크 검사 결과 `[]`. 변경 문서의 링크 오류 없음. |
| 추가 gate | test-budgets 16 real-git suites ok; diff whitespace 오류 없음. ABI 전환 명령은 사용하지 않음. |
| V-pair 자기확인 | SELF_PASS 10 · SELF_BLOCKED 2(VP-03·12 사람 실기). 독립 verify는 미수행. |
| 강제 지점 전수 | 구조·행동 자리 25/25에 직접 좌표 대응. AC5 픽셀·AC10 실 CLI·AC16 글꼴과 AC18 시각 회귀는 별도 미확인. |
| **AC 자기보고** | 아래 18행 |
| **합계 검산** | ✅ 14 · ⚠️ 4 · ❌ 0 = 총 18 |
| 블로커 / 역질문 | PLAN_GAP 없음. 사람 실기 AC5·10·16 및 AC18의 Claude 시각 비교 대기. |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

관련 테스트 재현 명령(비-DB, app에서 실행):

```powershell
node node_modules/vitest/vitest.mjs run src/main/adapters/claude/adapter src/main/adapters/opencode/v1/adapter.test.ts src/main/app/harnesses/registry src/main/app/handlers/session.test.ts src/main/infra/settings-store.test.ts src/shared/protocol.harness.test.ts src/renderer/src/app/Sidebar.interaction.test.ts src/renderer/src/pages/NewChatLandingPage.harness.test.ts src/renderer/src/pages/agentModeLanding.render.test.ts src/renderer/src/features/settings/components src/renderer/src/features/chat/store/chatStore.lastCwd.test.ts src/renderer/src/features/chat/store/chatStore.project.test.ts src/renderer/src/features/chat/store/chatStore.landingDefault.test.ts src/renderer/src/features/chat/components/AgentModeToggle.test.ts src/renderer/src/features/chat/components/CwdPanel src/renderer/src/features/chat/harnesses/common/transcript/typography.test.ts src/renderer/src/features/chat/harnesses/claude/transcript src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.render.test.ts src/renderer/src/features/chat/harnesses/opencode/transcript/AssistantSegment.render.test.ts src/renderer/src/shared/errors/reportSites.registry.test.ts --maxWorkers=2
```

| AC | 자기보고 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | T1 펼침·접힘 navigate 1회, 메뉴/팝업 속성 없음, 마지막 opencode seed |
| AC2 | ✅ | T1 동일 /new 클릭에서 newChat 미호출·초안 상태 유지 |
| AC3 | ✅ | T2 선택 저장·새 초안 cwd, T7 재시작 저장값, T3 유효 폴더 반환 |
| AC4 | ✅ | T3 미설정·삭제·파일·상대 경로 fallback, T2 프로젝트 우선 및 참조 추가 시 lastCwd 쓰기 증가 없음 |
| AC5 | ⚠️ | T11 구조 확인만. 세 창 크기의 ±1px/±2px 및 기존 Claude 비교 미실측 |
| AC6 | ✅ | T11 root/align/column/hero 동일, OpenCode 위 여백과 absolute context 관측 |
| AC7 | ✅ | T4 그룹 순서·4옵션·Concise/off·ko/en 설명, T8 로고 슬롯 전달 |
| AC8 | ✅ | T5 사용자 스타일 우선 및 기본 Concise, complete에 Orca 스타일 미주입 |
| AC9 | ✅ | T5 변경 시 입력 전 적용 1회, 동일 값 추가 호출 0, 실패 시 입력 없음 |
| AC10 | ⚠️ | SDK 호출은 T5로 확인. 실제 Claude Insight 표시/해제 미실행 |
| AC11 | ✅ | T6 root/child once, question 수동, on/off를 요청별로 반영 |
| AC12 | ✅ | T7 store patch 직후 실제 registry가 전달한 두 getter의 값 변경 |
| AC13 | ✅ | T10 Claude code만 git 행 존재, OpenCode와 Claude work에는 없음 |
| AC14 | ✅ | T9 양 하네스 버블·message 활자 토큰 동일 및 palette 유지 |
| AC15 | ✅ | T9 live/확정 OpenCode Markdown 요소 class가 공통 렌더와 동일 |
| AC16 | ⚠️ | T9 class 확인만. white/dark·텍스트 크기 3단계 실제 글꼴 미관측 |
| AC17 | ✅ | T7 부분 패치 후 instructions·executablePath·다른 하네스 값 및 재시작 보존 |
| AC18 | ⚠️ | T12 자동 회귀 통과. AC5·16에 포함된 Claude 시각 회귀 확인 대기 |

✅ 14 · ⚠️ 4 · ❌ 0 = 총 18. AC 분모는 V1의 18개를 유지했다.

## [구현자 기입] Review Signals — 사실만

- 최초 V1 r1 구현이다. 이전 verify 지적이나 같은 라운드의 추가 구현 턴은 없다.
- 기존 executable-option 검사의 chat 기대값에 신규 기본 스타일을 반영했다. complete 기대값은 그대로이며 관련 20케이스가 통과했다.
- 샌드박스에서는 Claude plan-mode/plan-file 테스트의 상위 경로 접근이 막혔다. 권한 확장 실행에서 해당 14케이스 및 최종 관련 전체 633케이스가 통과했다.
- lint가 파일을 쓰므로 편집과 직렬화했다. 최종 오류는 없고 기존 useVirtualizer 경고 두 곳만 남았다.
- 문서 링크 실패 10개는 기존 외부 임시 체크아웃 안에 있다. 검사기를 바꾸거나 임시 트리를 삭제하지 않았고, 전체 명령의 exit 1을 통과로 기록하지 않았다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
