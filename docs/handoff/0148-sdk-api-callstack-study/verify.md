# Verify — 0148-sdk-api-callstack-study

## 메타

| 항목 | 값 |
|---|---|
| slug | `0148-sdk-api-callstack-study` |
| 검증자 | Claude Code |
| 일자 | 2026-07-26 |
| 대상 커밋 | (구현 커밋 — push 후 기재) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

비기능 작업이라 설계자·구현자·검증자가 모두 Claude 다. 구현 턴에서 설계와 **어긋난 지점 3건**을 발견해 선조치했고, 아래 매트릭스에 반영했다.

| 구현 중 발견 | 검증자 판단 | 반영 |
|---|---|---|
| **다이어그램 구성비 오기** — plan AC8 이 "flowchart 6 · sequence 3 · state 1" 이라 했으나 실제 산출은 flowchart 5 · sequence 4 · state 1 (총 10 은 일치) | 설계 시 문서별 배분을 어림한 값이 실제 서술 흐름과 달라진 것. **총량이 맞고 각 장이 요구 다이어그램을 가지므로 산출물이 아니라 plan 의 숫자가 틀렸다** | ✅ plan AC8 · `api/README.md` · 루트 `README.md` · INDEX 4곳을 실측값으로 정정 |
| **README 범위 절이 거짓이 됨** — plan 은 "범위 절 무변경"(AC10)이었으나, `api/00` 이 애플리케이션 진입점을 다루므로 "애플리케이션 코드는 다루지 않는다"가 더 이상 참이 아니다 | 거짓 문장을 남기는 것이 AC 문구를 지키는 것보다 나쁘다. 다만 **기존 두 bullet 은 한 글자도 건드리지 않고 예외 1줄만 추가**해 원래 스탠스를 보존했다 | ✅ 3번째 bullet 추가. AC10 은 "기존 bullet 무변경 + 예외 1줄 추가"로 판정(아래 매트릭스 #10) |
| **`PostToolUseHookSpecificOutput` 누락** — AC7 이 요구한 hook 타입 8종 중 1종이 어느 문서에도 없었다(union 서술을 `…` 로 접었던 탓) | 명백한 누락 | ✅ `api/06` §6.1 에 union 전문 + 대표 3종 비교표 추가. 그 과정에서 `updatedToolOutput`(실행 *후* 출력 재작성)이라는 새 사실을 확보해 서술 강화 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `api/` 에 `README.md` + `00`~`07` 총 9 파일 | ✅ | `ls docs/etc/study/claude/api/ \| wc -l` → **9**. 총 **2,114줄** |
| 2 | `api/00` 4계열 분류 + 매핑표에 `파일:라인` | ✅ | `00-진입점-분류.md` §0.1 계열 A/B/C/D 표, §0.2 계열별 매핑표 4개. **앱측 인용 27건 전수 재확인** (아래 게이트) |
| 3 | `api/00` 미도달 채널 목록 | ✅ | §0.3 — 6 채널군 표 + "72 채널 중 SDK 도달 5개 + 계열 D 2개" + mock 어댑터 제외 사유 |
| 4 | `api/00` 콜스택 미서술, 링크만 + 경계 선언 | ✅ | §0.4 경계 선언 존재("이 문서 이후의 모든 문서(1~7장)는 SDK 만 다룬다"). 매핑표의 "딥다이브" 열이 전부 링크 |
| 5 | **`api/01`~`07` 에 앱 어휘 0** | ✅ | `grep -rn 'app/src/\|orca:\|Orca\|어댑터' api/0[1-7]-*.md` → **빈 출력** (2회 실행, 06 수정 후 재확인) |
| 6 | **딥다이브 6단 골격** — 골격 표기 + `sdk.mjs` 인용 ≥1 + "코드에서 확인 안 됨" ≥1 | ✅ | 7개 문서 전수: 골격표기 7~14 / `sdk.mjs` 인용 **2~13건** / 관측불가 절 **각 1** / `.d.ts` 인용 4~11건 |
| 7 | SDK 심볼 전수 배정 | ✅ | 23 심볼 grep 전수 매칭 (`query()`·`Query` 5종·`CanUseTool`/`PermissionResult`·hook 8종·`SDKUserMessage`·`SDKMessage`·`Options`·`pathToClaudeCodeExecutable`·`package.json`·`MessageParam`·`Base64ImageSource`). 초기 1건 누락(`PostToolUseHookSpecificOutput`) 발견 → 보강 후 **전건 매칭** |
| 8 | 신규 mermaid 10개, 문법 오류 없음 | ✅ | `grep -c '```mermaid'` 합계 **10**. 구조 검증 스크립트(헤더 유효성·괄호/따옴표 균형·subgraph↔end 짝·fence 균형) → **ALL STRUCTURALLY VALID**. 구성비 flowchart 5·sequence 4·state 1 |
| 9 | `api/README.md` 4요소 | ✅ | 목차 표 · 근거 등급 상속 고지(1부 링크) · 1부↔2부 대조표("두 개의 축") · 스냅샷 고지(미니파이 식별자 취약성 + 로그 문자열 앵커 권고) |
| 10 | 루트 README 2부 행 + 다이어그램 19 + **범위 절/01~07 무변경** | ✅(단서) | 2부 섹션·30초 요약 1줄·"총 **19개**" 추가. `git diff --stat api/../0[1-7]-*.md` → **빈 출력**(01~07 본문 무변경). **범위 절은 기존 2 bullet 무변경 + 예외 1줄 추가** — 구현자 코멘트 2번 참조 |
| 11 | `docs/AGENTS.md` 인벤토리 1부/2부 갱신 | ✅ | `docs/AGENTS.md:27` — "분석 2부 16편", 1부/2부 내용 분리, 읽는 시점에 2부·`api/00` 용도 추가 |
| 12 | 모든 주장에 근거, 미확인 분리 표기 | ✅ | **SDK 인용 38건 line-by-line 재확인**(아래 게이트) · 앱 인용 27건 재확인 · 각 문서 ⑥절에 "코드에서 확인 안 됨" 표(총 **43 항목**) |
| 13 | `app/src/**` · `package.json` 무변경 | ✅ | `git status --short app/` → **빈 출력**. `npm install --ignore-scripts` 는 lock 도 바꾸지 않았다 |
| 14 | handoff 3종 + INDEX + PHASES 정합 | ✅ | `0148-…/{plan,verify}.md` · `INDEX.md` 행 · `PHASES.md` 정합 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck | ✅ | — | lint **0 error**(기존 warning 1 — `useTranscriptVirtualizer.ts:22`, 변경 무관 베이스라인) · typecheck **3/3 clean** |
| 인수 기준 ↔ 산출물 대조 | ✅ | 이견 시 중재 | 14/14 충족 |
| 인용 정확성(SDK 38 + 앱 27) | ✅ | — | 전건 일치. 3건 정정(`setModel` JSDoc 2326→2325, `PostToolUse` 2246→2229, `UserPromptSubmit` 6883→7102, `claude-executable` 20-22→19-21) |
| 경계 규칙(기계 게이트) | ✅ | — | grep 빈 출력 |
| 문서 형식/링크 | ✅ | — | 상대 링크 전수 해석 검증 → **ALL RESOLVE**. 1건 정정(`IPC_CONTRACT.md` 상대 깊이 `../../../` → `../../../../`) |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 패턴 **0** (아래) |
| 기술적 정확도 최종 검토 | ✖ 보조 | ✅ 결정 | **사람 확인 대기** — 특히 §7.3 Options→플래그 표, §6.6 hook ID 치환 |
| mermaid **렌더** 확인 | ✖ 구조 검증만 | ✅ | **사람 확인 대기** (렌더러 미보유 — 구조 검증으로 갈음) |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)     ← 기존 베이스라인(react-hooks/incompatible-library)

$ npm run typecheck
typecheck:node  ✅   typecheck:web  ✅   typecheck:test  ✅

# 문서 전용 기계 게이트
$ grep -rn 'app/src/\|orca:\|Orca\|어댑터' docs/etc/study/claude/api/0[1-7]-*.md
(빈 출력)                                                            ← AC5

$ cat docs/etc/study/claude/api/*.md | grep -c '```mermaid'
10                                                                    ← AC8
$ (구조 검증) RESULT: ALL STRUCTURALLY VALID                          ← AC8

$ git diff --stat docs/etc/study/claude/0[1-7]-*.md
(빈 출력)                                                            ← AC10

$ git status --short app/
(빈 출력)                                                            ← AC13

$ (상대 링크 해석 검증) ALL RELATIVE LINKS RESOLVE                     ← 문서 형식
$ (SDK 인용 38건 sed 대조) 전건 일치                                   ← AC12
$ (앱 인용 27건 sed 대조) 전건 일치                                    ← AC2/AC12
```

`npm test` 는 **의도적으로 미실행**. 문서 전용 변경이라 검증 가치가 없고, `pretest` 가 better-sqlite3 ABI 를 Node 로 뒤집어 이후 `dev`/`build` 를 깨뜨리는 부작용만 남는다(`app/AGENTS.md` ABI 가이드).

## 위생 검토

- 키/토큰/이메일/IP 패턴 스캔: `api/` 9파일 + 루트 README + `docs/AGENTS.md` — **0 건**. 코드 인용은 전부 공개 저장소 경로와 SDK 패키지 내용이다.
- 변동성/일회성 정보 혼입: 없음. 버전 의존 사실은 **스냅샷 고지**(`api/README.md` 말미)로 격리했다.
- 장문 코드설명서화 우려: 2,114줄이지만 표 위주 + 1부 절 링크로 중복을 배제했다. 각 문서 150~330줄.

## PHASES.md 정합성

문서 전용 작업이라 Phase 로드맵 행에 해당하지 않는다 — `PHASES.md` "현재 작업 중" 은 보드 링크만 유지하는 규약(`docs/handoff/AGENTS.md` §1)에 따라 별도 행을 추가하지 않고 `INDEX.md` 로 추적한다. `0147`(같은 성격의 study 작업)과 동일한 처리.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 다이어그램 구성비를 문서를 쓰기 전에 확정하려 한 것이 무리였다(AC8 오기). 총량만 걸고 구성비는 산출 후 기재했어야 한다. 또한 "범위 절 무변경"을 AC 로 못박은 것이 `api/00` 의 존재와 충돌했다 — **설계 시점에 자기 산출물이 자기 AC 를 위반한다는 것을 못 봤다.**
- **구현 단계**: hook 타입 union 을 `…` 로 접으면서 AC7 이 요구한 심볼 하나가 문서에서 사라졌다. **AC 를 기계 검증하기 전까지 몰랐다** — 축약은 전수 요구와 상충한다는 것을 먼저 인지했어야 한다.
- **검증 단계**: mermaid 를 **구조 검증으로만** 통과시켰다. 실제 렌더러를 돌리지 못했으므로 의미론적 오류(예: 존재하지 않는 노드 참조, 잘못된 화살표 레이블 위치)는 잡지 못한다 — 사람 확인 항목으로 명시했다. 또한 SDK 딥다이브의 **기술적 주장 자체**(예: "`skills` 가 `allowedTools` 로 접힌다")는 미니파이 코드 독해에 의존하므로, 실제 구동 관측으로 교차 검증하지 않았다.

## 결론 / 다음 단계

**PASS (r1).** 인수 기준 14/14 충족. 구현 중 발견한 설계 오류 3건은 전부 선조치·기록했다.

사람 확인 대기:
1. 2부 기술 정확도 최종 검토 (특히 §7.3 Options→CLI 플래그 표, §6.6 hook 콜백 ID 치환)
2. mermaid 10개 실제 렌더 확인
3. PR 머지 승인

후속 후보(비범위 — 별도 핸드오프):
- 실제 구동 JSONL 덤프로 2부의 wire 서술을 교차 검증 (1부 §7.5 재현 절차 활용)
- SDK 버전 bump 시 2부 인용 라인의 일괄 재검증 스크립트
