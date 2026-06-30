# Plan — 0057-composer-cwd-panel

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 흐름: **의도 → 조사 → 설계 → 리스크**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0057-composer-cwd-panel` |
| 작성자 | Claude Code |
| 일자 | 2026-06-30 |
| 매핑 | PHASES (구현 후 승격) / PR (없음) |
| 상태 | DRAFT → READY |
| 구현 주체 | **Codex** (기능 구현) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

> "사용자가 말한 것"과 "내가 해석한 것"을 가른다.

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | composer 에 디렉토리 경로 표시 패널 스택 1개 추가. 좌측 정렬 버튼 1개(라벨 = default cwd basename, prefix 폴더 이모지, 예 `📂 orca`). 랜딩 중 클릭 = 폴더 선택 대화상자, 선택 시 cwd 변경. orca 세션 전환 시 버튼 = 폴더 변경이 아닌 "해당 폴더 열기". 디자인 토큰은 composer 스타일을 따르되 — 랜딩 = 패널 배경·테두리 투명, orca 세션 = 패널 배경/테두리 회색풍, 버튼은 양 모드 모두 배경 투명·테두리 없음·hover 있음. 패널 위치 = 도구승인카드와 notice 사이. | **라이브 세션 요청**(영속 트랜스크립트 없음 — 본 plan 작성 세션의 요청 요약 인용) |
| 명시 결정 (이번 세션 Q&A) | ① 폴더 아이콘은 **📂 이모지 그대로**(SVG Icon 아님). ② cwd 적용·지속성 = **랜딩은 항상 default cwd 베이스라인, orca 세션에서는 사용자 지정 cwd 로 영속**. ③ 기본 라벨 = **실제 cwd basename 그대로**(기본값에선 `default`). | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 (추론임을 표기) | 원 요구 "선택 시 cwd 변경" + Q&A "랜딩은 항상 default" 를 합쳐 → **랜딩 버튼은 폴더 선택 시 라벨을 선택 폴더 basename 으로 갱신**하되, **새 대화 진입마다 default 로 리셋**한다(랜딩 baseline = 항상 default). cwd 는 **세션 출생 시점(랜딩에서 첫 전송)에 고정**되고 세션 중에는 읽기 전용(열기만). — 두 발화의 충돌을 메우는 *내 해석*이므로 리스크 섹션에서 사용자 정정 가능하게 명시. | (해석) |

## Context (왜)

검증 엔지니어(Orca 사용자)가 채팅을 시작하기 전에 **작업 폴더(cwd)를 고르고**, 세션 진행 중에는 **그 폴더를 OS 파일 탐색기로 빠르게 열** 수 있도록 composer 에 cwd 진입점을 노출한다. 현재 cwd 는 UI 어디에도 표시되지 않으며 내부 경로(`~/.config/orca/projects/default`)로 고정돼 있어, 사용자가 자기 프로젝트 디렉토리에서 작업한다는 감각을 줄 수 없다. 본 패널은 (a) 현재 cwd 가시화, (b) 랜딩에서의 cwd 선택, (c) 세션에서의 폴더 열기를 한 버튼으로 제공한다.

## 자료조사 (Research)

> 모든 발견에 레퍼런스 명시. 레퍼런스 없는 주장은 리스크/Open Question 으로 분리.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| cwd 단일 해석기 `getWorkspacePath(project?)` — 미소속이면 `projects/default`, 소속이면 `projects/<안전이름>-<id8>`. `project.cwd`(절대경로 오버라이드)는 **future scope, 현재 항상 미설정**(주석 명시). | `app/src/main/config/paths.ts:74-85`, 주석 `:14-16`·`:75-76` |
| 따라서 기본 cwd 의 basename 은 실제로 `default`(요구 예시 `orca` 는 실값 아님). | 동상 `paths.ts:80` |
| 폴더 선택 대화상자 선례 — `dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })`. 디렉토리용은 `properties: ['openDirectory']` 로 **신규** 필요. | `app/src/main/ipc/handlers/misc.ts:138-153` |
| OS 탐색기 열기 선례 — `shell.openPath(path)` / `shell.showItemInFolder(path)`(현재 skill 전용). 임의 경로용 채널은 **신규**. | `app/src/main/ipc/handlers/misc.ts:111-117`, import `:26` |
| IPC end-to-end — renderer `shared/api/ipc.ts` → preload `contextBridge` `window.orca.*` → main handler. cwd **읽기**는 `window.orca.session.cwd()` 존재(세터는 없음). | `app/src/preload/index.ts:109`, `app/src/renderer/src/shared/api/ipc.ts:103`, `app/src/main/ipc/handlers/misc.ts:138-153` |
| 렌더러 cwd 캐시(module `cwdCache`) + 세션별 `SessionEntry.cwd`(생성 시 캐시 복사). | `app/src/renderer/src/features/chat/store/chatStore.ts` |
| 랜딩 vs 세션 판별 — 랜딩 `NewChatLandingPage`(`isEmpty` = messages 0 && !loadingSession, sessionId 없음), 세션 `ChatPage`(`:sessionId`). store 셀렉터 `useChatSession(s => s.sessionId)`(NEW_CHAT_KEY/null = 랜딩). | `app/src/renderer/src/pages/NewChatLandingPage.tsx`, `app/src/pages/ChatPage.tsx`, `app/src/app/router.tsx` |
| composer 패널 스택 = `flex flex-col gap-2`. 순서: ask(`:411-418`) → **도구승인 map(`:419-426`)** → **Notice 들(`:427-440`)** → 입력/plan 패널(`:441-`) → 컨트롤 패널. **삽입 지점 = `:426`(도구승인 map)과 `:427`(첫 Notice) 사이.** | `app/src/renderer/src/features/chat/components/Composer.tsx:409-440` |
| 좌측 정렬 composer 버튼 재사용 후보 `ComposerChip` — `inline-flex h-7 … bg-transparent px-p5 text-footnote text-t6 … hover:bg-fill-contained-hover hover:text-t7`, 아이콘+라벨. **단 Icon SVG 렌더**라 이모지는 leading 텍스트 노드로 대체 필요. | `app/src/renderer/src/features/chat/components/composer/ComposerChip.tsx` |
| 회색풍 표면 토큰 선례 — Notice 는 `bg-sidebar border-border`. 컨트롤 패널만 투명·borderless. | `app/src/renderer/src/features/chat/components/Notice.tsx`, `Composer.tsx` 컨트롤 패널 |
| 시맨틱 토큰 정의(`--color-sidebar`·`--color-border`·`--color-fill-uncontained-hover`·`--color-fill-contained-hover` 등) + white/dark 두 스코프. raw hex 금지. | `app/src/renderer/src/styles/tokens.css`, `app/AGENTS.md` "스타일링" |
| IPC 채널은 `shared/ipc.ts`(CHANNELS 상수 + 순수 TS 타입) + `shared/protocol.ts`(zod, main 전용). 변경 시 `IPC_CONTRACT.md` 동시 갱신(§6). | `app/src/shared/ipc.ts`, `app/src/shared/protocol.ts`, `docs/IPC_CONTRACT.md §6` |

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 **검증 가능한** 항목.

1. composer 패널 스택의 도구승인 카드 map 과 첫 Notice 사이(현 `Composer.tsx:426`↔`427`)에 디렉토리 경로 패널 1개가 렌더된다.
2. 패널 내부에 좌측 정렬 버튼 1개. 라벨 = 현재 cwd basename, 앞에 `📂` 이모지(literal). 기본값(미선택)에선 `📂 default`.
3. 랜딩(세션 미시작) 상태에서 버튼 클릭 → `dialog.showOpenDialog({ properties: ['openDirectory'] })` 대화상자가 열린다. 폴더 선택 시 그 cwd 가 (곧 시작할) 세션 cwd 로 반영되고 버튼 라벨이 선택 폴더 basename 으로 갱신된다. 취소/빈 선택 시 변화 없음.
4. 랜딩 baseline cwd 는 항상 default — 새 대화(new chat) 진입마다 default 로 초기화된다.
5. 랜딩에서 고른 cwd 는 orca 세션으로 전환된 뒤 그 세션에 영속된다(세션의 작업 디렉토리로 실제 사용되고, 세션 재진입 시 유지된다).
6. orca 세션(세션 시작 후) 상태에서 버튼 클릭 → cwd 변경이 아니라 `shell.openPath(cwd)` 로 해당 폴더를 OS 파일 탐색기에서 연다.
7. 디자인 토큰: 버튼 아이콘·패널 기본 스타일은 composer 스타일을 따른다. **랜딩** = 패널 배경·테두리 투명. **orca 세션** = 패널 배경 회색풍 + 동일 톤 테두리. 버튼은 두 모드 모두 배경 투명·테두리 없음·hover 효과 있음.
8. 신규/변경 IPC 채널(디렉토리 선택 · openPath · cwd 영속 경로)이 `docs/IPC_CONTRACT.md` 에 동시 반영된다(채널 수·도메인·시그니처).
9. 게이트(lint/typecheck/test) 통과. basename 순수 함수 + 신규 IPC zod 스키마에 단위 테스트 동반.

## 범위 / 비범위

- **범위**: 위 인수 기준 1~9. composer 패널 컴포넌트(렌더러) + 디렉토리 선택/폴더 열기 IPC(preload/main) + 세션 출생 시 cwd 영속 + basename 순수 함수 + IPC_CONTRACT 갱신.
- **비범위**:
  - 세션 도중 cwd 재변경(세션 출생 후 cwd 는 읽기 전용 — 열기만). 추후 필요 시 별도 핸드오프.
  - 프로젝트(`project.cwd`) 단위 영속·프로젝트 랜딩(`ProjectLandingPage`)에서의 cwd 선택 — 본 작업은 새 대화(non-project) 랜딩 기준. 프로젝트 통합은 후속.
  - cwd 히스토리/최근 폴더 목록, 경로 직접 입력 등 부가 UX.
  - opencode 등 타 어댑터 cwd 처리.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `dialog`/`shell`(electron, `handlers/misc.ts` 선례), `getWorkspacePath`(`config/paths.ts`), `ComposerChip` 스타일, `chatStore`/`SessionEntry.cwd`, IPC `handle`/`handlePlain` 헬퍼.
- 전제: 세션 cwd 는 **세션 출생(첫 전송) 시 1회 확정**되고 그 후 불변(추론 의도 §). 랜딩 pending cwd 는 renderer 상태(NEW_CHAT 엔트리)에 보관.
- **신규 의존성 없음**(electron `dialog`/`shell` 은 기존 사용). 새 npm 패키지 도입 없음.

## 설계

- **렌더러 (features 레이어)**: `app/src/renderer/src/features/chat/components/composer/` 에 `DirectoryPanel`(가칭) 신설 후 `Composer.tsx` 패널 스택의 `:426`(도구승인 map)과 `:427`(첫 Notice) 사이에 삽입.
  - 모드 판별 = `useChatSession(s => s.sessionId)` (NEW_CHAT_KEY/null = 랜딩, string = 세션).
  - 버튼은 `ComposerChip` 클래스 문자열을 재사용하되 leading SVG Icon 대신 **`📂` 텍스트 노드 + cwd basename** 렌더(Icon 컴포넌트 미사용). 좌측 정렬은 패널 래퍼 `flex`(기본 좌측).
  - 패널 래퍼 표면 클래스는 모드 분기: 랜딩 = `bg-transparent border border-transparent`(투명), 세션 = `bg-sidebar border border-border`(회색풍). 라운드·패딩은 다른 패널과 동일 토큰(`rounded-r*`·`px-*`/`py-*`).
  - 클릭 핸들러: 랜딩 → `window.orca.files.pickDirectory()` → 결과 있으면 pending cwd 갱신(store action). 세션 → `window.orca.files.openPath(cwd)`.
- **basename**: 렌더러는 sandbox(node `path` 불가) → `app/src/shared/` 에 순수 `basename(p: string): string`(POSIX `/` + Windows `\` 양 구분자, 말미 슬래시 정리) 추가 + 단위 테스트. (renderer/main 공용.)
- **IPC (신규)** — `shared/ipc.ts` CHANNELS + `shared/protocol.ts` zod, preload 브리지, main handler:
  - `files:pickDirectory` → `Promise<string | null>`. main: `dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })`, 취소 시 `null`.
  - `files:openPath` → 입력 `{ path: string }`, `Promise<void>`. main: `shell.openPath(path)`.
  - **cwd 영속**: cwd 는 랜딩에서만 가변·세션 출생 시 고정이므로 **별도 setter 불필요**. 권장안 — 첫 전송(세션 생성) 페이로드에 `cwd?: string` 를 실어 main 이 세션 레코드에 영속하고, **세션 cwd 해석기**가 "세션에 명시 cwd 있으면 그것(mkdir -p), 없으면 `getWorkspacePath(project)` 폴백" 순으로 결정. 정확한 영속 컬럼(sessions 테이블 cwd) / 마이그레이션 / send 스키마 확장은 구현 디테일이며 `IPC_CONTRACT.md` 와 동시 갱신한다.
- **레이어 경계**: 렌더러 4-layer(컴포넌트=features, cross-feature 데이터 필요 시 page/app props), main L0(shared 스키마)→L3(ipc handler). `boundaries`/`import/no-cycle` 위반 0.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 대화상자 취소/빈 선택 → no-op(라벨 유지).
- `openPath` 실패(경로 부재·권한 없음) → 조용히 무시 또는 가벼운 알림. **선택은 구현자 판단이되, 사용자 노출 UX 변경이면 ⚠️ 보고만.**
- 긴 경로명 → 버튼 `max-w` + ellipsis truncate, `title` 속성에 전체 cwd 노출.
- 테마 3종(white/dark) — 표면·hover 색은 시맨틱 토큰만(raw hex 금지). 단, `📂` 이모지 자체는 토큰 recolor 불가(리스크 참조).
- a11y: 모드별 `aria-label`("작업 폴더 선택" / "작업 폴더 열기"), 키보드 포커스·`ring-focus` 적용.
- 빈/로딩 상태: cwd 미로딩 시 라벨 폴백(`default`) 또는 스켈레톤 — basename 계산은 cwd 문자열 도착 후.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 세션 단위 절대경로 cwd 영속은 PRD/`paths.ts` 가 "future scope"로 둔 항목 활성화 | 사용자가 라이브로 명시 요청 → **사용자 결정으로 기록**. 단, **세션 출생 후 cwd 불변** 가정과 **랜딩 라벨 갱신/리셋 해석**(추론 의도 §)을 본 표에 명시해 검토 게이트에서 정정 가능하게 둔다. |
| `📂` 이모지는 디자인 토큰 recolor 불가 → 테마/다크모드 색 일관성 약화 | 사용자 명시 선택(Q&A ①). **수용** — composer 다른 아이콘과 톤 차이를 사용자가 인지·동의. |
| send 페이로드/세션 스키마 확장은 IPC 계약·DB 마이그레이션을 건드림 | `IPC_CONTRACT.md` 동시 갱신(인수 기준 8), 마이그레이션은 신규 `NNNN_*.sql`(기존 파일 수정 금지). |

- 되돌리기 어려운 결정: 세션 cwd 영속 컬럼/마이그레이션(추가는 신규 파일로).
- **단독 결정 금지 항목(Open Question)** → 사용자에게: (a) 위 "세션 출생 후 cwd 불변 + 랜딩 리셋" 해석이 의도와 맞는지, (b) `openPath` 실패 시 사용자 알림 노출 여부.

## 영향 받는 파일

- `app/src/renderer/src/features/chat/components/composer/DirectoryPanel.tsx` (신규)
- `app/src/renderer/src/features/chat/components/Composer.tsx` (패널 삽입)
- `app/src/renderer/src/features/chat/store/chatStore.ts` (pending cwd 상태/액션, 세션 cwd 반영)
- `app/src/renderer/src/shared/api/ipc.ts` + `app/src/preload/index.ts` (pickDirectory·openPath 브리지)
- `app/src/shared/ipc.ts` + `app/src/shared/protocol.ts` (CHANNELS + zod 스키마, send 페이로드 cwd)
- `app/src/main/ipc/handlers/misc.ts` (pickDirectory·openPath handler) + 세션 생성/cwd 해석 경로(`config/paths.ts` 또는 세션 영속 경로)
- `app/src/shared/<basename>.ts` (+ 테스트) — 순수 basename 헬퍼
- `docs/IPC_CONTRACT.md` (채널 동시 갱신)

## 참고 문서

- `docs/TRD.md` (cwd / 세션 / 데이터 모델)
- `docs/arch/frontend/dom-architecture.md` (패널 `app-frame-*` 마커·`data-*`)
- `docs/arch/backend/persistence.md` (세션 영속·마이그레이션 규칙)
- IPC 변경 시: `docs/IPC_CONTRACT.md` (§6 변경 절차 — **반드시 동시 갱신**)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (better-sqlite3 Node ABI 재빌드 후 전체 green 확인).
- 신규 테스트 요구: `basename` 순수 함수(양 구분자·말미 슬래시·빈 입력) + 신규 IPC zod 스키마(pickDirectory 반환·openPath 입력·send 페이로드 cwd).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 출처(라이브 세션 요청 + Q&A)로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`)를 붙였다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다.
- [x] 의존 기술 — 의존·전제를 식별했고, 신규 의존성 없음을 확인했다.
- [x] 파생 UX — 로딩/에러/빈상태/테마/접근성 엣지케이스를 펼쳤다.
- [x] 리스크 — 트레이드오프·되돌리기 어려운 결정을 적고, Open Question 은 사용자로 분리했다.

---

> **[구현자 기입]** 이하는 구현 턴(Codex)에서 채운다. 설계자(Claude)는 위쪽을, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: Composer 패널 삽입 위치, files IPC 분리, send payload 기반 세션 출생 cwd 고정, `sessions.cwd` 영속화 방향으로 구현했다. 사용자 후속 피드백에 따라 **프로젝트 랜딩도 `/new`와 동일 정책**(랜딩 baseline은 default, 선택 cwd는 해당 새 세션 출생 시 고정, 세션 진입 후에는 열기만)으로 포함했고, 추가 피드백에 따라 세션 페이지의 Composer 패널 스택 노출을 제거하고 타이틀 영역의 `[📁 basename] / <타이틀>` 형태로 이동했다.
- 이견 / 우려: send payload만 확장하면 resume 세션에서 cwd가 default/project fallback으로 되돌아갈 수 있어, DB 컬럼(`sessions.cwd`)과 resume 해석 경로까지 같이 구현했다. 또한 pending cwd가 전역 `cwdCache`에 섞이면 새 대화 리셋 정책이 깨지므로 active 새-채팅 엔트리에만 저장하도록 분리했다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | resume 세션 cwd 회귀 가능성 | ✅ 구현함 — `sessions.cwd` 마이그레이션/insert/select/load/resume 해석을 추가 | send payload 는 새 세션 출생 순간에만 유효하므로 DB SSOT 필요 |
| 2 | pending cwd 전역 누수 가능성 | ✅ 구현함 — `cwdCache` 는 default baseline 으로 두고, 선택 cwd 는 active 새-채팅 엔트리만 갱신 | 새 대화/프로젝트 랜딩 모두 default baseline 으로 리셋 |
| 3 | queued new chat 이 나중 cwd 를 읽을 위험 | ✅ 구현함 — `SendChatMessage.cwd` 에 전송 시점 cwd 스냅샷 포함 | `newChatQueue` payload 가 cwd 를 보존 |
| 4 | `openPath` 실패 UX 미정 | ✅ 구현함 — IPC reject 를 renderer 에서 catch 후 console warning 처리, 사용자-facing Notice 는 추가하지 않음 | 제품 UX 변경은 범위 밖 |

## [구현자 기입] 구현 체크리스트

- [x] 랜딩 cwd 버튼 및 세션 타이틀 영역 cwd 버튼 추가(Composer 패널 스택 노출 제거)
- [x] `files:pickDirectory` / `files:openPath` IPC 추가
- [x] `SendChatMessage.cwd` + zod 스키마 확장
- [x] `sessions.cwd` 마이그레이션 및 DB query/type/load/resume 경로 반영
- [x] 랜딩/프로젝트 랜딩 pending cwd 엔트리 상태와 새 대화 리셋 정책 구현
- [x] basename 순수 함수 및 IPC/chatStore 테스트 추가
- [x] `docs/IPC_CONTRACT.md` 갱신

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/renderer/src/features/chat/components/composer/DirectoryPanel.tsx`, `Composer.tsx`, `chatStore.ts`, `chatReducer.ts`, IPC/preload/api, main files/chat/session/db 경로, `app/src/shared/path-basename.ts`, tests, `docs/IPC_CONTRACT.md` |
| 실행 명령 | `cd app && npm run lint`, `cd app && npm run typecheck`, `cd app && npm test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (606 passed). 최초 test 는 better-sqlite3 ABI 불일치로 실패 후 `npm rebuild better-sqlite3` 재실행으로 해소 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `f6238d8` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | 구현자 코멘트 §… / 사용자 / verify r<N> | … | open / 구현중 / 해결 |
