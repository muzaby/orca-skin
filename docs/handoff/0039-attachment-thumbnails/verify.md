# Verify — 0039-attachment-thumbnails

> 컴포저 첨부(txt/md/image) user 턴 주입 + 동시성 경고 + workspace 경로 추상화 검증. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0039-attachment-thumbnails` |
| 검증자 | Claude Code |
| 일자 | 2026-06-23 |
| 대상 커밋 | `f55c440` (HEAD — Codex 구현 `92020c4` + Claude 후속 8커밋) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

> plan §인수 기준 1:1 대조. 증거는 `파일:라인` + 테스트 출력.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 다이얼로그·DnD·paste 3경로 txt/md/image → 입력 위 썸네일 칩·개별 제거·전송 후 비움. DnD=`webUtils.getPathForFile`, paste=인라인 바이트 | ✅ | `hooks/useAttachments.ts:58`(pickAttachments=dialog)·`:81`(addDroppedFiles→`fileApi.pathForFile`)·`:99`(onPaste=inline base64)·`:72`(removeAttachment)·`:147`(reset). `preload/index.ts:104` `pathForFile=webUtils.getPathForFile`. 칩=`composer/AttachmentTray.tsx`·`AttachmentChip.tsx`·`AttachmentThumb.tsx`. `Composer.tsx:355`(onPaste)·`:361`(onDrop)·`:434`(AttachmentTray). `chatStore.send` 후 `reset()` 호출. |
| 2 | txt/md 추출(UTF-8·BOM 제거)이 영문 wrapper text(id·sentinel·metadata·truncate marker)로 결합 | ✅ | `files/attachments.ts:41`(BOM `replace(/^﻿/,'')`)·`:106`(truncate@`MAX_FILE_CONTEXT_CHARS=24000`). `prompts/attachment.ts:55` `formatAttachmentPromptBlock`(영문 `DATA_INSTRUCTION`·`<<<ORCA_ATTACHMENT_START id=...>>>` sentinel·metadata attrs·escaping·`neutralizeSentinels`·truncation notice). 테스트 `prompts/attachment.test.ts`(7) green. **편차 ①**(아래). |
| 3 | image=user `image` 블록(`source:{base64, media_type, data}` 접두사 없음), `createTurnInputStream` string·블록배열 수용, 무첨부 string 무회귀 | ✅ | `adapters/claude.ts:304` `buildTurnContent`(무이미지→string, 이미지→`{type:'image',source:{type:'base64',media_type,data}}` 블록배열)·`:236` 주입. `adapters/streaming-input.ts:23` `createTurnInputStream(content: TurnInputContent)` = `MessageParam['content']`(string\|블록배열). `attachments.ts:68` `stripDataUrlPrefix`. 테스트 `build-turn-content.test.ts`·`streaming-input.test.ts` green. |
| 4 | `AttachmentExtractor` + `TextExtractor`(txt/md) 등록·동작, PDF 미등록, 신규 의존성 0 | ✅ | `files/attachments.ts:31`(인터페이스)·`:36`(`TextExtractor.supports`=`.txt`/`.md`·`extract`=readFile+BOM+binary 가드). PDF 등록 없음. `attachments.test.ts`(BOM·truncate·binary) green. `git diff 87bf6fb HEAD -- app/package.json` = 변경 0. |
| 5 | 같은 projectId 동시 query 경고(차단 없음)·종료 시 거둠. `ConcurrencyRegistry` 증감·자기제외·finally decrement | ✅ | `ipc/chat/concurrency-registry.ts`(순수 `Map`·increment/decrement·onChange). `send.ts:348` `concurrency.increment(boundProjectId)`·`:371` 내부 `finally` `decrement`(정상/에러/중단 수렴). 자기제외는 렌더러 차감(AC6). `concurrency-registry.test.ts`(증감/이벤트) green. |
| 6 | `concurrency:event {projectId,count}` 전 webContents 브로드캐스트, 렌더러 자기 inflight 차감 후 판정 | ✅ | `ipc/router.ts:132` `new ConcurrencyRegistry((projectId,count)=>broadcastConcurrency(...))`·`context.ts:69` `wc.send(CHANNELS.concurrencyEvent,ev)`. `shared/api/ipc.ts:95` `concurrencyApi.onEvent`. `chatStore.ts:55` `concurrencyByProjectId`. `Composer.tsx:122` `projectConcurrencyCount-(inflight?1:0)>0`(자기 inflight 차감). |
| 7 | `getWorkspacePath` projectId 경로·mkdir·turn.cwd/files/sync 사용·resume 은 `session.project_id` 해석 | ⚠️✅ | `config/paths.ts:76` `getWorkspacePath(project?)`(mkdirSync). `router.ts:179` `getCwd:(projectId)=>getWorkspacePath(projectId?db.getProject(projectId):null)`. `send.ts:195` `boundProjectId`=resume→`getSessionById().project_id`·신규→`projectId`·`:237` `cwd:ctx.getCwd(boundProjectId)`·`:265` `syncExtensionsForTurn(turn.cwd)`. **편차 ②**(아래) — base 가 userData 아닌 `~/.config/orca/projects`, 시그니처 `(project?)`. |
| 8 | 신규 IPC 채널 IPC_CONTRACT 동기화 — files 1→3 + 이벤트 1, 총 46→49(§6) | ✅ | `docs/IPC_CONTRACT.md:23` "총 49 채널"·`:25` 분포(files 3·concurrency 1)·`:112-113`(pickAttachments·readAttachment)·`:249`(concurrency:event). `shared/ipc.ts:26-27,49` 채널 상수. 합산 검산 49 ✓. |
| 9 | 게이트 4종 green·레이어 경계 0·신규 의존성 0 | ✅ | lint PASS(boundaries 위반 0)·typecheck(node+web+test) PASS·**test 463/463 (68 files)**. package.json 변경 0. |

**충족: 9/9** (AC7 = 의도된 편차와 함께 기능 충족).

### 편차 / 범위 확장 (사람 확인 권장)

- **편차 ① (AC2 — wrapper 결합 방식)**: plan 은 "별도 text 블록"을 명시했으나, 구현은 **이미지 없는 첨부일 때 wrapper 를 본문 text 에 병합해 string 경로를 유지**한다(`build-turn-content.ts:309`). 사유: content-block 배열로 보내면 SDK streaming-input 이 짧은 txt 에도 체계적으로 실패(커밋 `c215a32`). wrapper(sentinel·metadata·자료/지시 분리)는 그대로 보존되어 **목적은 충족**. 이미지 첨부가 있으면 블록배열(첫 text 블록에 mergedText)로 전환.
- **편차 ② (AC7 — workspace base)**: plan/AC7 은 "OS userData base(`~/.config` 하드코딩 금지)"였으나, 구현은 **`~/.config/orca/projects/`** 를 쓴다(`paths.ts:76`, 커밋 `b3426d1`). 사유: 확장 리소스(skills/mcp) 의 `sources/`·`dist/` 가 이미 `~/.config/orca` 아래라, cwd 가 userData 면 부팅 싱크(`~/.config/orca/workspace`)와 실제 턴 cwd 가 갈려 확장이 **엉뚱한 디렉토리로 싱크**된다. 단일 루트 `projects/`(비프로젝트=`default`·소속=`<이름>-<ID8>`)로 일원화해 cwd↔확장 인접성을 회복. 시그니처도 `(project?)` 로 바뀌어 projectId→project 해석은 router 경계에서 수행. **AC 문구(userData)와 충돌하나 엔지니어링상 더 견고**하며 plan 작성자=구현자(Claude)의 의도적 결정. 설계 변경으로 수용.
- **범위 확장 (plan 비범위였던 transcript 영속 첨부 렌더)**: plan §비범위는 "첨부의 transcript 영속 렌더(컴포저 첨부는 비영속 입력)"였으나, 후속 커밋 `2509210`/`caf50ef` 가 **user 버블 썸네일 + DB `attachment` 파트 영속**(이미지는 다운스케일 썸네일만 저장해 DB 크기 bound)을 추가했다(`AttachmentView`·`persist.ts:38`·`reducer/chatReducer.ts`·`transcript/UserMessage.tsx`·`lib/imageThumb.ts`). 사용자 피드백 기반 가산(0034 R1~R7 류). 게이트·경계 무위반. **시각/UX 검증은 사람 영역.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint/typecheck PASS · test **463/463** |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 첨부 | 이견 시 중재 | 9/9 (AC7 편차 동반) |
| 레이어 경계 위반 0 | ✅ | — | lint(boundaries) 위반 0 |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT/PHASES 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 패턴 0(신규 main 파일) |
| 제품 의도 부합(첨부 UX·렌더링 기준 claude.ai) | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| AC2/AC7 편차 수용 (설계 변경) | ✖ 옵션 제시 | ✅ 결정 | **사람 확인 대기** |
| transcript 영속 범위 확장 수용 | ✖ 보조 | ✅ 결정 | **사람 확인 대기** |
| UI/UX 시각 검증(썸네일·드롭존·Notice 패널·DnD 강조) | ✖ | ✅ | 사람 확인 대기 |
| 실환경 검증(이미지 업로드 실전송·동시 query 경고 실기·프로젝트 cwd 싱크) | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 0(PDF 미도입) |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm install && npm rebuild better-sqlite3
$ npm run lint            → PASS (eslint boundaries 위반 0)
$ npm run typecheck       → PASS (node + web + test)
$ npm test                → Test Files 68 passed (68) / Tests 463 passed (463)

# 첨부 핵심 10파일 단독: Test Files 10 passed / Tests 43 passed
#   files/attachments · prompts/attachment · adapters/build-turn-content ·
#   adapters/streaming-input · ipc/chat/concurrency-registry · capabilities/image ·
#   config/paths · shared/protocol.send · ipc/chat/persist · ipc/dto
```

> impl 보고의 "better-sqlite3 Node ABI 11건 환경 실패"는 `npm rebuild better-sqlite3`(Node v22 ABI)로 해소 — 전체 463 green. 0019 dual-ABI 계열과 동일 처치.

## 위생 검토

- 신규 main 파일(`files/attachments.ts`·`prompts/attachment.ts`·`ipc/chat/concurrency-registry.ts`·`capabilities/image.ts`) 키/토큰/이메일/IP 패턴 스캔: **0건**.
- AGENTS.md 변경 없음. IPC_CONTRACT.md 는 §6 절차대로 도메인 분포·총수(49)·최종 업데이트 일자 동시 갱신.
- path 가드: `assertAllowedAttachmentPath`(홈 디렉토리 화이트리스트, `misc.ts` pick/read 진입 모두 적용) — path-traversal 보호 유지.

## PHASES.md 정합성

- "페이즈 표" 에 0039 행 승격(커밋 `f55c440`). 형식·커밋 기재 기존 행과 일치.
- **위생 노트 ①**: INDEX 대상 커밋 기재 `92020c4`(Codex env) ↔ 브랜치 실 HEAD `f55c440`(Codex 구현 위에 Claude 후속 8커밋: 첨부 에러경로·transcript 영속·UI 보정·cwd 일원화·L1 이동·훅 추출·Notice 일반화). history 기록용.

## 결론 / 다음 단계

- **상태: PASS** — 인수 9/9(AC7 의도된 편차 동반), 게이트 4종 green, 레이어 경계 0, 신규 의존성 0.
- `INDEX.md` `verify/PASS` → `PHASES.md` 표 승격.
- **사람 확인 대기**: ① AC2/AC7 편차 + transcript 영속 범위 확장의 설계 수용 여부, ② 첨부 UX/시각 검증(썸네일·드롭존·Notice 패널), ③ 실환경(이미지 실전송·동시 query 경고·프로젝트 cwd 확장 싱크), ④ PR 머지.
