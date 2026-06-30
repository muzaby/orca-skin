# Verify — 0057-composer-cwd-panel

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 흐름: 구현자 코멘트 확인 → 매트릭스 → 책임분리 → 게이트 → 위생 → PHASES.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0057-composer-cwd-panel` |
| 검증자 | Claude Code |
| 일자 | 2026-06-30 |
| 대상 커밋 | impl `d970fa0`→`082621f`→`0058095` (Codex 기능) + verify 선조치 `0c1921a` (Claude 비기능) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구 변경 (검증 기준 재정의)

설계(plan) 이후 **사용자 요구가 변경**되었다: orca **세션** 화면의 cwd 를 Composer 패널 스택에 노출하던 것을 **취소**하고 **세션 타이틀 영역**(`📂 basename / <타이틀>`)으로 이동한다. 따라서 plan 원본 인수기준 **#1·#7 의 "세션 Composer 패널" 부분은 요구 변경으로 폐기**하고, 변경된 요구(세션=타이틀, 랜딩=패널)로 재대조한다. 구현자(impl 커밋 본문)도 동일하게 기재했다.

## 검증 전 수석엔지니어 리뷰 (사용자 지시) + 선조치

verify 전 실무 관점 코드 리뷰로 잠재 문제 4건을 발견·보고하고 사용자 승인 하에 처리했다.

| # | 심각도 | 문제 | 처분 (사용자 결정) | 증거 |
|---|---|---|---|---|
| F1 | Medium | 프로젝트 랜딩에서 폴더 미선택 시 라벨이 전역 `default` 로 표시되나 실제 출생 cwd 는 프로젝트 파생 폴더(`projects/<name>-<id8>`) — 라벨↔실값 불일치 (세션 시작 후 init 이벤트로 자동 보정) | **현행 유지 + 한계 기록** (cwd 의미론 결정은 0057 범위 밖, 후속 분리) | `chatStore.ts:97,721`·`send.ts:139`·`paths.ts:80` |
| F2 | Low | resume 턴에서 `getSessionById` 이중 호출 (refactor 의도 무산) | **수정** — `resolveTurnCwd(ctx, req, sessionMeta)` 로 기조회 메타 재사용 | `send.ts:135-144,262-264,312-321` |
| F3 | Cosmetic | 이모지 `📁` vs plan AC#2 `📂` | **수정** — `📂` 통일 | `CwdButton.tsx:49` |
| F4 | 보안 | `files:openPath` 가 임의 경로를 무검증 `shell.openPath` | **입력 제한 추가** — 실재 디렉토리 + (projects 루트 하위 ∨ 실재 세션 cwd) 만 허용 | `misc.ts:165-176`·`paths.ts:isWithinDir`·`queries.ts:hasSessionWithCwd` |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> plan `[구현자 기입]` 의 설계 리뷰·놓친 잠재 문제(✅ 4건)를 검토.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 — 사용자 후속 피드백으로 프로젝트 랜딩 포함·세션 패널→타이틀 이동 | 타당 (요구 변경과 정합) | AC#1/#7 재해석 근거로 채택 |
| 놓친 #1 resume cwd 회귀 → `sessions.cwd` DB SSOT 구현 | 타당 | AC#5 매트릭스에서 확인(resume 해석 경로 존재) |
| 놓친 #2 pending cwd 전역 누수 → active 새-채팅 엔트리만 갱신 | 타당 | AC#4 매트릭스·`chatStore.test` 로 확인 |
| 놓친 #3 queued new chat 이 후행 cwd 읽을 위험 → `SendChatMessage.cwd` 스냅샷 | 타당 | `chatStore.test`(payload cwd 스냅샷) 확인 |
| 놓친 #4 `openPath` 실패 UX → renderer console warn, Notice 미추가 | 타당하나 **무검증 경로**는 별개 — verify 리뷰 F4 로 보강(선조치) | F4 수정 반영 |

## 요구사항 충족 매트릭스

> plan 인수 기준 1:1 대조 (요구 변경분은 재해석 표기). 증거 = `파일:라인`.

| # | 인수 기준 (요구 변경 반영) | 충족 | 증거 |
|---|---|---|---|
| 1 | **랜딩**(`/new`·프로젝트)은 Composer 패널 스택 도구승인↔Notice 사이에 cwd 패널, **세션은 패널 제거→타이틀 영역**으로 이동 | ✅ | `Composer.tsx:432-441`(`showLandingCwdPanel` 게이트, 도구승인 map↔Notice 사이)·`NewChatLandingPage.tsx:39`·`ProjectLandingPage.tsx:53`(landing 만 prop 전달)·`ChatTitleBar.tsx:89-95`(타이틀 `CwdButton / 제목`); ChatTile 의 Composer 는 prop 미전달 → 세션 패널 0 |
| 2 | 좌측 정렬 버튼, 라벨=cwd basename, 앞에 `📂` literal, 기본 `default` | ✅ | `CwdButton.tsx:49-50`(`📂`+`{label}`)·`path-basename.ts`(`basenameForDisplay`, 기본 `default`)·패널 래퍼 `flex`(좌측) `Composer.tsx:434` |
| 3 | 랜딩 클릭 → `pickDirectory` 다이얼로그(openDirectory), 선택 시 cwd 반영+라벨 갱신, 취소 no-op | ✅ | `CwdButton.tsx:31-32`→`fileApi.pickDirectory`→`setPendingCwd`·`misc.ts:156-163`(`showOpenDialog openDirectory`, 취소 `null`)·`chatStore.ts:445-456`(SET_CWD active 엔트리) |
| 4 | 랜딩 baseline=항상 default, 새 대화 진입마다 리셋 | ✅ | `chatStore.ts:97`(`freshEntry` cwd=cwdCache=default)·`:401`(전송 후 NEW_CHAT_KEY freshEntry 리셋); `chatStore.test.ts`("default 로 리셋" pass) |
| 5 | 랜딩 cwd → 세션 영속(작업 디렉토리로 실사용·재진입 유지) | ✅ | `SendChatMessage.cwd`(`protocol.ts:64`)→`resolveTurnCwd`(`send.ts:135-144`)→`persist.ts:113`(`sessions.cwd` insert)→`session.ts:66`/`chatReducer.ts:482`(load resume 해석); 마이그레이션 `0010_session_cwd.sql` |
| 6 | 세션 클릭 → cwd 변경 아님, `shell.openPath` | ✅ | `CwdButton.tsx:27-29`(sessionStarted→`openPath`)·`misc.ts:165-176`(검증 후 `shell.openPath`) |
| 7 | 디자인 토큰: 랜딩 패널=배경/테두리 투명, 버튼=투명·borderless·hover. **(세션 grey 패널 폐기 — 요구 변경)** | ✅ | 랜딩 패널 `Composer.tsx:435`(`border-transparent bg-transparent`)·버튼 `CwdButton.tsx:47`(`bg-transparent border-transparent hover:bg-fill-uncontained-hover`, 시맨틱 토큰·raw hex 0) |
| 8 | 신규/변경 IPC 채널 `IPC_CONTRACT.md` 동시 반영 | ✅ | `IPC_CONTRACT.md`(채널 50→52·files 3→5·`pickDirectory`/`openPath` 행·`SendChatMessage.cwd`·session list/load cwd·**openPath 화이트리스트 명시**) |
| 9 | 게이트 통과 + basename 순수함수 + 신규 IPC zod 단위 테스트 | ✅ | 아래 게이트(602 passed)·`path-basename.test.ts`·`protocol.send.test.ts`(cwd·OpenPath)·신규 `paths.test.ts`(isWithinDir 3)·`queries.test.ts`(session cwd 2) |

**충족: 9/9** (요구 변경분 #1·#7 재해석 포함).

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행+출력 | — | typecheck ✅ / lint ✅ / test 602 passed (아래) |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 | 이견 시 중재 | 9/9 ✅ |
| 레이어 경계(boundaries·no-cycle) | ✅ 위반 0 | — | lint green (신규 ipc→config 의존 = 하향 정상) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT·verify 한국어·표 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 | 본 변경 AGENTS.md 무수정 — 해당 없음 |
| 제품 의도 부합(요구 변경) | ✖ 보조 | ✅ 결정 | **세션=타이틀 이동 = 사용자 확정 요구** |
| F1 cwd 의미론(현행 유지) | ✖ 옵션 제시 | ✅ 결정 | **사용자: 현행 유지 + 한계 기록** |
| UI/UX 시각 검증(타이틀/랜딩 패널·테마·이모지 톤) | ✖ | ✅ | **사람 확인 대기** |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck      → ✅ node + web + test 전부 clean
$ cd app && npm run lint           → ✅ eslint --fix 통과(boundaries·no-cycle 위반 0)
$ cd app && npm test               → 602 passed (better-sqlite3 ABI 재빌드 후)
  · 신규/변경 테스트: path-basename 5 · protocol.send(cwd·OpenPath) · paths(isWithinDir 3) · queries(session cwd 2) · chatStore(pending cwd snapshot/reset) 전부 green
  · 환경 제약: electron 미설치로 2 suite(`persist`·`send.runtime-resilience`) import 불가 — 0050~0056 동일 계열(정상환경 606). 본 변경과 무관(electron 바이너리 프록시 차단).
```

## 위생 검토

- 본 verify 선조치는 코드(`app/**`)·`IPC_CONTRACT.md` 만 변경, AGENTS.md 무수정 → 키/토큰/이메일/IP 스캔 해당 없음.
- 신규 의존성 0, IPC 채널 수 변동 0(기존 0057 채널의 동작 강화만).

## PHASES.md 정합성

- 0052~0056 lifecycle P1 시리즈와 별개 라인. 0057 을 "완료 (커밋 …)" 로 페이즈 표 승격, 요구 변경(세션 타이틀 이동)·F1 한계 주석 포함.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan 이 프로젝트 랜딩을 비범위로 뒀으나 사용자 후속 피드백으로 포함됨 — 설계 시점에 "프로젝트 랜딩 cwd 의미론(F1)"을 Open Question 으로 올렸으면 라벨 불일치를 조기 포착했을 것.
- **구현 단계**: `openPath` 실패 UX(#4)는 다뤘으나 **경로 무검증**(F4)은 놓침 — 검증 리뷰에서 선조치로 보강.
- **검증 단계**: F1 은 코드로 닫지 않고 한계로 남김(사용자 결정). 헤드리스 환경이라 타이틀/랜딩 패널·이모지 톤·테마 3종 시각 회귀는 **사람 확인 대기**로 분리 — verify 가 시각 판정은 못 한다.

## 결론 / 다음 단계

- 상태: **PASS (r1)** — 인수 9/9(요구 변경 반영), 게이트 green, 레이어 경계 0, 신규 의존성 0.
- **알려진 한계(F1)**: 프로젝트 랜딩 미선택 라벨=`default`(실 출생 cwd=프로젝트 파생 폴더). 세션 시작 후 자동 보정. cwd 의미론 정합은 후속 핸드오프 분리(사용자 결정).
- **사람 확인 대기**: 타이틀 `📂 basename / 제목`·랜딩 패널 시각 회귀, 이모지 톤(테마 3종), 실환경 openPath 동작, PR 머지.
- INDEX `verify/PASS` + PHASES 승격.
