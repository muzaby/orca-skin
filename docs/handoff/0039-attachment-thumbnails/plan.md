# Plan — 0039-attachment-thumbnails

> 첨부파일(txt/pdf/image) 썸네일 + 텍스트/이미지 주입. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0039-attachment-thumbnails` |
| 작성자 | Claude Code |
| 일자 | 2026-06-22 |
| 매핑 | PHASES "현재 작업 중" / PR (구현 후) |
| 상태 | DRAFT → READY |
| 구현 주체 | **Codex** (기능 구현) |

## Context (왜)

사용자가 첨부 이미지 1·3번처럼 **컴포저**에 txt/pdf/image 를 첨부하면 입력 영역에 썸네일(이미지=미리보기, txt/pdf=배지)을 보여주고, 2번처럼 **프로젝트 페이지 우측 패널**에도 첨부 썸네일을 보여주길 원한다. 나아가 첨부 파일을 모델에 실제로 전달하는 **처리 경로**가 두 갈래로 다르다:

- **프로젝트 페이지**: 첨부 텍스트를 추출해 **system message(systemPromptAppend)로 매 턴 주입**.
- **컴포저**: 첨부 텍스트를 추출해 **유저 턴에 1회 주입**, 이미지는 **streaming-input user 메시지의 content 블록**으로 주입.

현재 컴포저 `AttachMenu` 의 '첨부' 항목은 `disabled` placeholder 이고, 프로젝트 `ProjectFilesCard` 는 영속화 없는 순수 placeholder(`project_files` 테이블 미존재)다. 프로젝트 *지침* 의 systemPromptAppend 주입과 컴포저 *텍스트* 의 user-턴 주입 seam 은 이미 존재하므로, 그 위에 첨부를 얹는다.

### 사용자 확정 사항

- **핸드오프 1개로 통합** (컴포저 + 프로젝트 첨부).
- **컴포저 이미지 = streaming-input user 메시지 content 블록** (`streaming-vs-single-mode` 가이드 §이미지 업로드: `message.content` 배열에 `{type:'image', source:{type:'base64', media_type, data}}`). Orca 는 이미 스트리밍 입력 모드(`createTurnInputStream`)라 자연스러운 경로. (※ `custom-tools` §이미지 반환은 *도구가* 이미지를 돌려주는 경로라 사용자 첨부엔 부적합 — 검토 후 폐기.)
- **PDF 텍스트 추출 신규 의존성 1건 승인** (TRD §2 스택 밖, 권장 `pdfjs-dist` legacy Node build, 대안 `pdf-parse`).

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 **검증 가능한** 항목.

1. 컴포저 '첨부' 메뉴(활성화)로 txt/pdf/image 선택 → 입력 패널 위에 썸네일 칩(이미지=미리보기, txt/pdf=아이콘+파일명 배지) 표시, 각 칩 개별 제거(x) 동작.
2. 전송 시 txt/pdf 추출 텍스트가 user 턴에 1회 결합(텍스트 블록), 전송 후 컴포저 첨부 목록 비워짐.
3. 이미지 첨부가 streaming-input user 메시지 content 블록(`{type:'image', source:{type:'base64', media_type, data}}`, `data` 는 `data:` 접두사 없는 원본 base64)으로 주입. `createTurnInputStream` 이 `string`·블록배열 모두 수용(단위 테스트), 첨부 없으면 기존 string 경로 무회귀.
4. `main/files/extract.ts` 가 mime/확장자 → `txt|pdf|image|other` 분기로 정규형 추출(단위 테스트, pdf 라이브러리 실동작 — 텍스트 추출 1건).
5. 프로젝트 우측 패널에서 파일 추가 → 썸네일 목록 표시, 삭제 동작, 앱 재시작/프로젝트 재진입 후 영속.
6. `0010_project_files.sql` 마이그레이션 적용 + DB 쿼리(add/remove/list/getForSession) 단위 테스트, 프로젝트 삭제 시 CASCADE.
7. 프로젝트의 텍스트 추출 가능 파일(txt/pdf)이 매 턴 `systemPromptAppend` 에 결합(`ExtensionBuilder` 단위 테스트), 이미지 파일은 미주입(제약).
8. 신규 IPC 채널이 `docs/IPC_CONTRACT.md` 에 동기화(§6 절차) — 총 채널 수 정합.
9. 게이트 4종(lint/typecheck/typecheck:test/test) green, 레이어 경계 0, 신규 의존성 = 승인된 PDF 라이브러리 1건뿐.

## 범위 / 비범위

- **범위**: 컴포저 첨부 UI(썸네일)+유저 턴 1회 주입(텍스트 블록+이미지 블록), 프로젝트 첨부 UI(썸네일)+영속화+system 매 턴 주입, 추출기, 마이그레이션/DB 쿼리/IPC, 썸네일 공용 컴포넌트.
- **비범위**: DnD/클립보드 paste 첨부(후속), 이미지 OCR, 원본 파일 다운로드/뷰어, 대용량 파일 청킹·토큰 예산 관리, opencode 어댑터, 첨부의 transcript 영속 렌더(컴포저 첨부는 비영속 입력).

## 설계

### 재사용할 기존 함수·파일 경로

- 컴포저: `app/src/renderer/src/features/chat/components/Composer.tsx` + `composer/AttachMenu.tsx`(현 '첨부' disabled) + `composer/ComposerChip.tsx`.
- 전송 경로: `features/chat/store/chatStore.ts`(`send`) → `chatApi.send` → `SendChatMessageSchema`(`src/shared/protocol.ts`) → `src/main/ipc/chat/send.ts` → `adapter.sendMessage(TurnRequest)`.
- 어댑터/입력: `src/main/adapters/claude.ts`(`sendMessage`) + `adapters/streaming-input.ts`(`createTurnInputStream`, `SDKUserMessage.message.content` = string **또는 content 블록 배열** 가능).
- 시스템 주입: `src/main/extensions/builder.ts`(`ExtensionBuilder.build` 가 프로젝트 지침 → `systemPromptAppend`) + `extensions/types.ts`(`TurnExtensions`/`TurnRequest`).
- 프로젝트: `features/projects/components/ProjectFilesCard.tsx`·`ProjectInstructionsSidebar.tsx`·`SidebarCard.tsx`, `src/main/ipc/handlers/project.ts`, `src/main/db/queries.ts`, `db/migrations/`.
- 파일 IPC 핸들러 패턴: `src/main/ipc/handlers/misc.ts`(`files` 도메인), `src/main/files/scan.ts`(path-traversal 가드 참고 — `isInsideCwd`).
- 0037 승격 패턴: feature→feature boundaries 회피 위해 공용 컴포넌트를 `shared/ui/` 로 `git mv`.

### Part A — 컴포저 첨부 (썸네일 + 유저 턴 1회 주입)

**파일 획득 (경로 기반 — 권장)**
- `AttachMenu` '첨부' 활성화 → 신규 IPC `files:pickAttachments`(main `dialog.showOpenDialog`, txt/pdf/image 필터) → `{path, name, mimeType, size}[]` 반환. **바이트는 renderer↔main 왕복 없음**(경로만 — payload 최소, pdf 추출은 main 일원화).
- 이미지 썸네일 미리보기용 IPC `files:readAttachment`(경로 → `{data(base64), mimeType}`). path-traversal 가드는 "사용자가 명시 선택한 경로 집합" 으로 한정.
- DnD/클립보드 paste 는 비범위(후속) — v1 은 다이얼로그 선택만.

**썸네일 UI**
- 신규 `shared/ui/attachment/AttachmentChip.tsx`(image=썸네일, txt/pdf=아이콘+파일명 배지) + `AttachmentTray.tsx`(칩 행, 각 칩 제거 x). 컴포저/프로젝트 **양쪽 재사용** 위해 처음부터 `shared/ui/` 에 둔다(레이어 경계 안전).
- 입력 패널 위(컨트롤 패널과 입력 패널 사이 또는 입력 패널 상단)에 칩 행 배치 — 스크린샷 1·3.
- 컴포저 첨부 목록은 `Composer` local state(전송 시 소비, 비영속). `send` 후 초기화.

**주입 (유저 턴 1회, claude-code-sdk typescript)**
- `SendChatMessageSchema` 에 `attachments: {path, name, mimeType}[]` 추가(optional, 기본 `[]`).
- `chatStore.send` 가 첨부 목록을 payload 에 실어 전송.
- `send.ts`: 전송 직전 main domain 추출기로 정규화 → `TurnRequest` 에 **백엔드 중립 첨부형** 전달:
  - `attachmentTexts: {name, text}[]` (txt/pdf 추출 결과)
  - `attachmentImages: {name, data(base64), mimeType}[]` (image)
- `claude.ts sendMessage` 가 claude 어댑트:
  1. `createTurnInputStream(text)` → `createTurnInputStream(content: string | ContentBlockParam[])` 로 일반화. content 가 그대로 `SDKUserMessage.message.content` 가 된다. 첨부 없으면 기존 string 경로(무회귀).
  2. 첨부가 있으면 블록 배열 구성:
     ```ts
     const content = [
       { type: 'text', text },                                   // 사용자 입력 본문
       ...attachmentTexts.map((a) => ({ type: 'text' as const,
         text: `\n\n--- 첨부: ${a.name} ---\n${a.text}` })),     // txt/pdf 추출 텍스트
       ...attachmentImages.map((img) => ({ type: 'image' as const,
         source: { type: 'base64' as const, media_type: img.mimeType, data: img.data } }))
     ]
     ```
  3. `media_type` = `image/png|jpeg|webp|gif`, `data` = 원본 base64(`data:` 접두사 없음). 정본: `streaming-vs-single-mode.md` §이미지 업로드.
  - **MCP 도구·`allowedTools` 변경 불필요** — 첨부는 *입력* 이지 도구가 아니다.
- 추출기 `src/main/files/extract.ts`(L1 domain): mime/확장자 → `txt|pdf|image|other`. txt=`fs.readFile` utf8, pdf=승인 라이브러리(`pdfjs-dist` legacy Node build 권장), image=`fs.readFile`→base64(접두사 제거). 순수 분기 + 단위 테스트.

### Part B — 프로젝트 첨부 (우측 패널 썸네일 + 영속화 + system 매 턴 주입)

**영속화**
- 신규 마이그레이션 `app/src/main/db/migrations/0010_project_files.sql`:
  `project_files(id PK, project_id FK→projects ON DELETE CASCADE, name, mime_type, size, content_text, thumb_blob BLOB NULL, created_at)`.
  - 추출 텍스트(`content_text`)를 저장해 **매 턴 재추출 회피**.
  - 이미지 썸네일은 `thumb_blob`(작은 base64/바이트)로 저장(원본 파일 복사 대신 DB 자족 — v1 권장). 원본 보관/대용량은 후속.
- DB 쿼리(`db/queries.ts`): `addProjectFile`/`removeProjectFile`/`listProjectFiles`/`getProjectFilesForSession`(세션→project_id 조인 — `getProjectInstructionsForSession` 패턴 대칭). prepared statement + 단위 테스트(인라인 INSERT 픽스처 — 0010/0033 회귀 회피 관례).

**IPC** (`docs/IPC_CONTRACT.md` §6 동시 갱신)
- `project:files:add`(경로 선택→추출→저장→목록 반환), `project:files:remove`, `project:files:list`.
- 채널 수 갱신: project 도메인 +3, 총계 정합(현 문서 표 기준 갱신 — 구현 시점 실제 수와 일치시킬 것).

**UI**
- `ProjectFilesCard` placeholder → 실제 파일 목록 + 썸네일(Part A `shared/ui/attachment` 재사용) + 추가/삭제 배선. 드롭존 일러스트는 목록 비었을 때만. 스크린샷 2.
- `projectsStore` 에 files 상태/액션 추가(또는 카드 로컬 + IPC 직접) — 기존 projects 패턴에 맞춘다.

**주입 (system 매 턴)**
- `ExtensionBuilder.build()` 의 지침 조회 직후(같은 위치) 프로젝트 파일 `content_text` 들을 결합해 `systemPromptAppend` 에 합류:
  `<지침>\n\n## 첨부 자료\n### <name>\n<content_text>\n…\n\n<stableAppend>` (지침 없으면 첨부 자료부터). 빌더 단위 테스트로 결합 검증.
- **제약(명시)**: system 프롬프트는 텍스트 전용 → **프로젝트 이미지 첨부는 우측 패널 썸네일 표시·참조용일 뿐 매 턴 주입 대상 아님**(OCR 미도입). 텍스트 추출 가능 파일(txt/pdf)만 `content_text` 가 있어 주입된다.

### 레이어 경계 준수

- 추출기·DB·빌더 = `src/main/{files,db,extensions}`(L1 domain). 어댑트(content 블록 변환) = `adapters/claude.ts`(L2). IPC 핸들러 = `ipc/handlers`(L3). 구체 `image/*`·SDK content 블록 어휘는 어댑터 안에만(백엔드 중립 — handoff 0016).
- 썸네일 컴포넌트 = `shared/ui/attachment/`(feature→feature 차단 회피, 0037 식).
- cross-feature 데이터는 pages/app props 주입.

## 영향 받는 파일

- **신규**: `app/src/main/files/extract.ts`(+`extract.test.ts`), `app/src/main/db/migrations/0010_project_files.sql`, `app/src/renderer/src/shared/ui/attachment/AttachmentChip.tsx`·`AttachmentTray.tsx`.
- **수정**: `features/chat/components/composer/AttachMenu.tsx`·`Composer.tsx`, `features/chat/store/chatStore.ts`, `src/shared/protocol.ts`(`SendChatMessageSchema` + project files 스키마)·`src/shared/ipc.ts`(CHANNELS), `src/main/ipc/chat/send.ts`, `src/main/adapters/claude.ts`·`adapters/streaming-input.ts`, `src/main/extensions/builder.ts`·`extensions/types.ts`(`TurnRequest`/`TurnExtensions` 첨부형), `src/main/db/queries.ts`, `src/main/ipc/handlers/project.ts`·`misc.ts`(files IPC), `features/projects/components/ProjectFilesCard.tsx`(+필요 시 `projectsStore`), `src/preload/index.ts`, `docs/IPC_CONTRACT.md`.

## 참고 문서

- `docs/spec/claude/agent-sdk/streaming-vs-single-mode.md` §이미지 업로드 — **이미지 첨부 정본**(streaming-input user 메시지 content 블록).
- `docs/spec/claude/agent-sdk/typescript.md` — `SDKUserMessage`/`MessageParam`.
- `docs/arch/backend/system-prompt.md` — append 주입 메커니즘.
- `docs/IPC_CONTRACT.md` §6 — 채널 변경 절차(**반드시 동시 갱신**).
- `docs/TRD.md §6`(데이터 모델)·`§2`(의존성 — PDF 라이브러리 승인 근거).

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test`.
- 신규 테스트: `extract.ts` 분기 / `createTurnInputStream` 블록배열 수용 / claude 어댑트 image `source` 블록 구성 / `ExtensionBuilder` 첨부 결합 / 0010 마이그레이션 + project_files 쿼리(CASCADE 포함) / `SendChatMessageSchema` attachments 파싱.
- 신규 의존성(PDF 라이브러리)은 `package.json` + PR 설명에 *왜* 명시.

---

## [Codex 기입] 구현 체크리스트

- [ ] `extract.ts`(+test) — txt/pdf/image/other 분기, pdf 라이브러리 배선
- [ ] `streaming-input.ts` content 블록 일반화 + test
- [ ] `claude.ts` 어댑트(텍스트/이미지 블록 구성) + test
- [ ] `protocol.ts`/`ipc.ts` 스키마·채널 + `send.ts` 추출·TurnRequest 배선
- [ ] 컴포저 UI(`AttachMenu`/`Composer` + `shared/ui/attachment`) + files IPC(pick/read)
- [ ] `0010_project_files.sql` + `queries.ts`(+test) + project files IPC
- [ ] `ProjectFilesCard` 실배선 + `ExtensionBuilder` 첨부 결합(+test)
- [ ] `IPC_CONTRACT.md` 동기화 + 게이트 4종 green

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `typecheck:test` / `test` |
| 게이트 결과 | lint … / typecheck … / test … (N passed) |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |
