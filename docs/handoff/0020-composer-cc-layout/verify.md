# Verify — 0020-composer-cc-layout

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목      | 값                                              |
| --------- | ----------------------------------------------- |
| slug      | `0020-composer-cc-layout`                       |
| 검증자    | Claude Code                                     |
| 일자      | 2026-06-14                                      |
| 대상 커밋 | `08c95fe` (INDEX 기재 Codex env `97f4c52`, 위생 노트 ①) |
| 라운드    | 1                                               |
| 상태      | PASS                                            |

## 요구사항 충족 매트릭스

> plan 의 9개 인수 기준을 1:1 로 대조. 증거(`파일:라인`, 테스트, 명령 결과) 첨부.

| #   | 인수 기준                                                                                            | 충족 | 증거                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 전송/중단 버튼이 textarea 와 **같은 첫 행** 우측 inline (별도 footer 행 아님)                        | ✅   | `Composer.tsx:343` `<div className="flex items-end gap-2">` 안에 `HighlightedTextarea`(`:349`) + 전송/중단 `Button`(`:361-385`, `shrink-0`·`self-end`=`mb-1`). footer 행(`:387`)과 분리.                                                                                            |
| 2   | footer **우측**에 `모델 칩 · 작업량 칩 · 도넛` 이 **이 순서**로                                      | ✅   | `Composer.tsx:414` `<span className="ml-auto …">` → 모델 칩(`:416-425`) → 작업량 칩(`:426-434`) → 도넛 usage 버튼(`:435-463`) 순.                                                                                                                                                   |
| 3   | footer **좌측**에 `권한모드 칩`+`+` 만 (기존 첨부/현재프레임/Skill 칩 제거)                          | ✅   | `Composer.tsx:391-413` repo zone = 권한모드 `ComposerChip`(`:395`) + `+` `ComposerChip`(`:404`, `icon="plus"`·`label="+"`) 2개뿐. 기존 3칩 제거(diff `-110`).                                                                                                                       |
| 4   | `+` 메뉴에 `첨부`(비활성)·`현재 프레임`(비활성)·`Skill`, Skill 선택 시 `SkillsMenu` 오픈            | ✅   | `AttachMenu.tsx:13-24` 첨부(`disabled`)·현재 프레임(`disabled`)·Skill(`onClick={onPickSkill}`). `Composer.tsx:492-497` `onPickSkill` → `setMenuOpen(true)` → `SkillsMenu`(`:527-529`, anchor=`attachButtonRef`).                                                                    |
| 5   | 여러 줄 입력 시 위로 성장 + 상한 도달 후 내부 스크롤, 상한은 현행 160px 보다 큼                      | ✅   | `HighlightedTextarea.tsx:155,193` mirror+textarea 둘 다 `max-h-40`(160px) → `max-h-56`(224px). 패널 하단 고정으로 위로 성장은 기성립. (시각 확인은 사람 — 책임표)                                                                                                                  |
| 6   | 작업량 칩 `낮음/중간/높음/매우 높음/최대`(=`low/medium/high/xhigh/max`) 선택, 기본 **high**          | ✅   | `effort.ts:3-9` `EFFORT_LABELS` 한국어 5종. `EffortMenu.tsx:14` `EFFORT_OPTIONS` 5종 라디오. 기본 `chatReducer.ts:96` `effort: 'high'`. 테스트 `chatReducer.permission.test.ts:100-103` (`initialChatState.effort==='high'`).                                                       |
| 7   | 작업량 선택값이 `send` payload → `TurnRequest` → 어댑터 → SDK `Options.effort`(per-turn)            | ✅   | store payload `chatStore.ts:234` → schema `protocol.ts:32` → `TurnRequest.effort` `extensions/types.ts:59` → `send.ts:259` → 어댑터 `claude-code.ts:214,258`(`...(effort ? { effort } : {})`). 테스트 `claude-code.effort.test.ts:41-48`(query options.effort==='xhigh').        |
| 8   | 입력 영역·전송 버튼 디자인 Claude Code 톤(원형 전송 버튼·정렬)                                       | ✅   | 전송/중단 버튼 `Composer.tsx:371,383` `rounded-full`·`iconOnly`. 패널 `:339` `rounded-r7`·`shadow`. (어감/시각 최종 판단은 사람 — 책임표)                                                                                                                                          |
| 9   | 게이트 4종 통과, 레이어 경계 위반 0, 신규 의존성 0                                                   | ✅   | 아래 게이트 재실행 결과. boundaries=`npm run lint` green. `package.json` diff 무변경(신규 의존성 0).                                                                                                                                                                               |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목                       | 에이전트(Claude) | 사람(사용자)  | 결과                                              |
| -------------------------- | ---------------- | ------------- | ------------------------------------------------- |
| 게이트 lint/typecheck/test/build | ✅          | —             | 4종 통과 (test 381/381, ABI 재빌드 후)            |
| 인수 기준 ↔ 코드 대조      | ✅               | 이견 시 중재  | 9/9 충족(위 매트릭스)                             |
| 레이어 경계 위반 0         | ✅               | —             | lint green (boundaries main+renderer)             |
| 문서 형식/링크/한국어      | ✅               | —             | IPC_CONTRACT payload 갱신 1행 확인                |
| AGENTS.md 위생 스캔        | ✅ grep          | ✅ 최종 판단  | AGENTS.md 변경 없음 — 스캔 N/A                     |
| 제품 의도 부합(CC 레이아웃)| ✖ 보조           | ✅ 결정       | 사람 확인 대기 (시각)                             |
| Open Questions             | ✖               | ✅            | 해당 없음                                          |
| UI/UX 시각 검증            | ✖               | ✅            | **사람 확인 대기** (인수 5·8 시각·어감)           |
| 신규 의존성 승인           | ✖ 제안           | ✅            | 신규 의존성 0 — N/A                                |
| 실환경 effort 적용 확인    | ✖               | ✅            | **사람 확인 대기** (실제 SDK 턴 1회)              |
| PR 머지 승인               | ✖               | ✅            | —                                                 |

## 게이트 재실행 결과

```
$ npm run lint        # eslint --cache --fix ./src
  → PASS (boundaries 위반 0)
$ npm run typecheck   # typecheck:node && :web && :test
  → PASS (3종 전부)
$ npm test            # vitest run
  → 최초 9 FAIL (db/queries.test.ts) — better-sqlite3 Electron ABI 잔존(코드 무관, 0019 클래스)
$ npm rebuild better-sqlite3 && npm test
  → Test Files 51 passed (51) / Tests 381 passed (381)
$ npm run build       # tsc --noEmit && electron-vite build
  → PASS (✓ built)
```

- 신규 테스트 3종 확인: `claude-code.effort.test.ts`(어댑터→query options), `protocol.send.test.ts`(effort 5종 허용·미지값 거부), `chatReducer.permission.test.ts`(기본 high·`SET_EFFORT`).
- test red 9건은 plan/0019 가 다루는 dual-ABI 게이트 위생 문제로, **본 변경과 무관**(Node ABI 재빌드 시 381 전부 green). 0019 가 영구 해소 예정.

## 위생 검토

- AGENTS.md 변경 없음 — 키/토큰/이메일/IP 스캔 대상 없음.
- IPC_CONTRACT.md: `orca:chat:send` payload 에 `effort?` 추가, 총 채널 수 **36 유지**(신규 채널 아닌 payload 확장이라 정합). 한국어 컨벤션·표 형식 유지.
- 신규 컴포넌트(`EffortMenu`/`AttachMenu`)·헬퍼(`effort.ts`)는 `features/chat/components/composer/` 내부 — 4-layer 경계 보존. `EffortLevel` 은 L0 `shared/ipc.ts`(`:95`)에 두어 main·renderer 양쪽 하향 import.

## PHASES.md 정합성

- "페이즈 표" 에 0020 행 승격(범위 요약 + `완료 (커밋 …)`). "현재 작업 중" 은 보드 링크만 유지(변경 없음).

## 위생 노트

① INDEX 의 대상 커밋 `97f4c52` 는 Codex 의 분리 환경 해시다. 본 브랜치(`claude/0020-handoff-protocol-nq3cmo`)에는 동일 *내용* 이 `08c95fe`(구현+보고 squash)로 존재한다 — 0002·0010 등 선례와 동형. 검증은 브랜치 HEAD 내용 기준.

## 결론 / 다음 단계

- **상태: PASS** — 인수 9/9 충족, 게이트 4종 통과(ABI 재빌드 후 381/381), 레이어 경계 0, 신규 의존성 0.
- INDEX `verify/PASS`, 다음 주체 `—`. PHASES 표 승격.
- 사람 확인 대기(가치판단): ① composer CC 레이아웃 시각 회귀(인수 1·8 정렬·원형 버튼), ② autogrow 상한 실기(인수 5), ③ 실환경 SDK 턴 1회 `effort` 적용 관측(인수 7 — 헤드리스 검증은 mock query 단위까지).
