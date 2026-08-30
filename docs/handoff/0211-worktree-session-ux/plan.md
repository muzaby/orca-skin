# Plan — 0211-worktree-session-ux

## 메타

| 항목 | 값 |
|---|---|
| slug | `0211-worktree-session-ux` |
| 작성자 | Claude Code |
| 일자 | 2026-08-30 |
| 매핑 | 0209·0210 격리 기능의 사용자 대면 잔여 3건 (준비 안내 · 표시 이름 · diff 실데이터) |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제 셋. (a) 격리 세션을 시작하면 준비가 끝날 때까지 화면이 무작위 영어 동사 하나(`Pondering…`)만 보여준다 — `deriveActivityLabel(undefined, …)`가 `{status:'streaming'}`을 돌려주고(`app/src/renderer/src/features/chat/lib/activityLabel.ts:40`), `prepareTurnWorktree`는 renderer 로 아무 이벤트도 내지 않는다(`app/src/main/app/chat-turn/prepare-worktree.ts:22`). (b) 세션이 서면 작업 경로 버튼이 `basename(executionCwd)`를 그린다(`CwdButton.tsx:27`) — 0210 D-104 가 경로를 `<repo>-<hash8>/<브랜치 slug>` 로 바꿨지만 그 basename 은 **브랜치 slug** 라 여전히 사용자가 고른 폴더 이름이 아니다. (c) diff 타일 데이터가 전부 예시다(`DiffTileContent.tsx:12`이 `diffTileMock`을 읽는다).
- 완료 후 달라지는 것. 준비 중에는 지금 무엇을 하는지가 한국어 한 줄로 바뀌며 보이고, 세션이 서도 작업 경로/저장소 이름은 사용자가 고른 것 그대로 남으며(누르면 실제 실행 경로가 열린다), diff 타일은 이 브랜치에서 실제로 작업된 내용을 그린다.
- 성공을 사용자 관점에서 한 문장으로: 격리를 켜고 대화를 시작하면 앱이 지금 무엇을 하는지 말해 주고, 끝난 뒤에도 내가 고른 프로젝트에서 일하고 있다는 것이 화면에 남으며, 변경사항 패널이 그 브랜치의 진짜 작업을 보여준다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “다음은 워크트리로 세션 시작 시, 클로드 제품의 어시스턴트의 메시지이다. orca 제품도 사용자 ux를 헤치지 않도록, 클로드 제품처럼 상황을 설명해야 한다.” | 라이브 세션 §1 |
| 명시 요구 | 참조 목록 원문 — `worktree 생성중` · `origin 새로고침중` · `워크트리 추가중` · `워크트리 파일 체크아웃중` · `claude code 시작중` · `claude code 생각중` | 라이브 세션 §1 |
| 명시 요구 | “클로드 제품은 워크트리 환경에서도 작업 디렉토리를 실제 브랜치가 있는 경로의 디렉토리 이름으로 ui에 출력한다. 다만 클릭시 실제 작업 경로로 탐색기가 열린다.” | 라이브 세션 §2 |
| 명시 요구 | “반면 orca 제품은 실제 경로의 디렉토리 이름으로 변경되어 ui 에 출력하고 있다. 이 경우 사용자는 선택한 디렉토리가 변경되는 것처럼 생각할 수있다.” | 라이브 세션 §2 |
| 명시 요구 | 적용 자리 둘 — “transcript 상단 디렉토리 버튼 텍스트, git 패널스택 좌측의 프로젝트 텍스트” | 라이브 세션 §2 |
| 명시 요구 | “diff 패널이 이제는 실제로 브랜치에서 작업된 내용을 출력해야한다.” | 라이브 세션 §3 |
| 명시 요구 | 단계 문구 기준 = “Orca 실제 단계를 서술”, origin fetch 없음 | 질의 응답 §단계 출처 |
| 명시 요구 | 표시 형태 = “한 줄 교체, 클로드 제품도 한 줄 교체이다” | 질의 응답 §표시 형태 |
| 명시 요구 | 격리 세션 diff 기준 = “base_oid → 현재 작업 트리” | 질의 응답 §diff 기준 |
| 명시 요구 | 비격리 세션 diff 기준 = “HEAD 대비 미커밋 변경만” | 질의 응답 §비격리 세션 |
| 추론 의도 | 참조 목록 6줄 중 마지막 `claude code 생각중`은 기존 `StatusLine` 이 이미 하는 일이다 — 신규 대상은 앞 5줄이다. | `StatusLine.tsx:104` 가 이미 진행 표시를 그린다 |
| 추론 의도 | 미추적 파일도 “브랜치에서 작업된 내용”이다 — 에이전트가 만든 새 파일은 커밋 전까지 untracked 다. | 0209 D-005 는 0210 D-105 가 대체했지만, 그 대체는 *격리를 막지 않는다*는 것이지 untracked 가 무의미하다는 뜻이 아니다 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 준비 단계 문구는 Orca 가 실제로 하는 일만 서술한다. `origin 새로고침`에 해당하는 fetch 는 구현하지도 표시하지도 않는다. | 사용자가 “Orca 실제 단계를 서술”을 골랐다. 폐쇄망 대상 제품에 새 네트워크 의존을 만들지 않는다. | 사용자 명시 | ACTIVE | — |
| D-002 | 표시는 기존 `StatusLine` 한 줄의 문구 교체다. 완료 단계를 쌓는 누적 목록을 만들지 않는다. | 사용자 명시 — “한 줄 교체, 클로드 제품도 한 줄 교체이다”. | 사용자 명시 | ACTIVE | — |
| D-003 | 단계는 main 이 발신하는 이벤트로 온다. renderer 는 경과 시간·추측으로 단계를 만들지 않는다. | 준비 각 단계의 소요는 저장소 크기·LLM 왕복에 좌우돼 renderer 가 알 수 없다. 시간 기반 가짜 단계는 D-001 의 “실제 단계” 를 깬다. | 파생 정책 | ACTIVE | — |
| D-004 | 단계는 `repo` · `base` · `branch` · `worktree` · `session` 다섯이다. `worktree add` 를 “추가”와 “파일 체크아웃”으로 쪼개지 않는다. | 현재 `prepare` 의 관측 가능한 경계가 정확히 그 다섯이다(`service.ts:70`~). `git worktree add` 한 명령이 추가와 체크아웃을 함께 하므로 쪼개면 가짜 단계가 된다(D-001). **`clean` 단계는 두지 않는다** — 0210 D-105 가 `isClean` 게이트를 걷어냈다. | 파생 정책 | ACTIVE | — |
| D-005 | 단계 줄은 **격리 준비 경로에서만** 뜬다. 비격리 새 세션·resume 의 화면은 바뀌지 않는다. | 요구 범위가 “워크트리로 세션 시작 시”다. 모든 턴으로 넓히면 요구에 없는 회귀 표면을 만든다. | 사용자 요구 범위 | ACTIVE | — |
| D-006 | 준비 거부(`git-unavailable`·`not-repo`·`invalid-path`·`create-failed`) 넷은 기존 `error` 이벤트 문구를 그대로 쓴다. 단계 줄은 사라진다. | `PrepareWorktreeResult` 의 현재 사유가 정확히 그 넷이다(`service.ts:20`~) — `dirty` 는 0210 D-105 가 지웠다. 문구를 두 벌 만들면 갈라진다. | 기존 계약 승계 | ACTIVE | — |
| D-007 | 표시 이름의 정본은 `managed_worktrees` row 다 — `source_cwd`(작업 경로 버튼)와 `repo_root`(git 행 저장소). renderer 가 실행 경로에서 원본 이름을 역산하지 않는다. | 역산(`git rev-parse --git-common-dir` 등)은 파생 합성값이라 정본을 우회한다. row 는 이미 두 값을 모두 갖는다(`migrations/0018_managed_worktrees.sql`). | 파생 정책 | ACTIVE | — |
| D-008 | 이름만 원본이고 **동작은 실행 경로**다 — 작업 경로 버튼 클릭은 `executionCwd` 를 열고, git 조회·diff 조회는 `executionCwd` 로 한다. | 사용자 명시 — “다만 클릭시 실제 작업 경로로 탐색기가 열린다”. | 사용자 명시 | ACTIVE | — |
| D-009 | git 행의 **브랜치와 변경량은 worktree 실측 그대로** 둔다. | 그것이 이번 격리 세션의 진짜 작업이고 사용자가 문제 삼은 것은 “프로젝트 텍스트” 하나다. | 사용자 요구 범위 | ACTIVE | — |
| D-010 | diff 비교 범위는 두 종류다. 격리 세션 = `base_oid` → 현재 작업 트리, 비격리 세션 = `HEAD` → 현재 작업 트리. | 사용자 선택 둘. 비격리 세션에는 base 를 알 채널이 없어 가짜 base 를 만들지 않는다. | 사용자 명시 | ACTIVE | — |
| D-011 | 미추적 파일(`ls-files --others --exclude-standard`)도 diff 목록에 넣고 전량 추가로 센다. | 에이전트가 만든 새 파일은 커밋 전까지 untracked 라, 빼면 “브랜치에서 작업된 내용”이 조용히 비는 경우가 생긴다. 0209 D-005 가 같은 축에서 untracked 를 유의미로 판정했다. | 추론 의도 + 선례 | ACTIVE | — |
| D-012 | 커밋을 고르면 그 커밋 하나의 변경(`<sha>^` → `<sha>`)을 본다. `전체 변경`은 D-010 의 범위다. | UI 에 이미 선택 축이 있다(`DiffTileContent.tsx:93` 의 `aria-pressed` 토글). 실데이터를 붙이면서 선택만 죽은 버튼으로 남기지 않는다. | 파생 정책 | ACTIVE | — |
| D-013 | 커밋 목록은 격리 세션에서만 채워진다(`base_oid..HEAD`). 비격리 세션은 `전체 변경` 하나만 남는다. | D-010 이 비격리에 base 를 주지 않으므로 “이 세션의 커밋” 을 셀 수 없다. | D-010 파생 | ACTIVE | — |
| D-014 | diff 데이터는 IPC **둘**이다 — 요약(파일 목록 + 커밋 목록)과 파일 본문. 본문은 파일을 펼칠 때만 부른다. | 0206 D-017 이 파일 항목을 기본 접힘으로 고정했다. 요약에 본문을 실으면 열자마자 저장소 전체를 읽는다. | 기존 계약 + 상한 | ACTIVE | — |
| D-015 | 파일 본문은 old/new **전문 두 벌**이다. unified patch 를 돌려주지 않는다. | 소비자 `DiffTable` 의 계약이 `{oldValue,newValue}` 다(`DiffTable.tsx:9`). patch 를 주면 renderer 에 파서를 새로 만들어야 한다. | 소비자 계약 | ACTIVE | — |
| D-016 | 상한은 파일 200 · 커밋 100 · 파일 본문 각 측 1 MiB · 동시 펼침 20 이다. 넘으면 잘라내고 **잘렸다는 사실을 값으로** 돌려준다. | 저장소 크기에 상한이 없다. 조용히 자르면 사용자가 diff 를 전부 본 것으로 읽는다. | 파생 정책 | ACTIVE | — |
| D-017 | diff 조회 계기는 **셋**이다 — 타일이 열릴 때 · cwd 변경 · 턴 종료 전이. 새 폴링을 만들지 않는다. | 뒤 둘은 git 행이 이미 쓰는 계기다(0206 D-004, `GitRow.tsx` 의 `shouldRefetchGitStatus`). 앞 하나만 새로 붙는다. | 기존 계약 승계 | ACTIVE | — |
| D-018 | `diffTileMock.ts` 와 `chat.rightpanel.diffMockNotice` 를 삭제한다. | 0206 이 “실제 데이터가 붙을 때 이 파일만 사라지면 된다”고 적었다(`diffTileMock.ts:7`). 남기면 예시 문구가 실데이터 위에 뜬다. | 기존 계약 승계 | ACTIVE | — |
| D-019 | DB 스키마를 바꾸지 않는다. 마이그레이션 0건. | 필요한 네 값(`source_cwd`·`repo_root`·`base_oid`·`branch`)이 `managed_worktrees` 에 이미 있다. | 조사 결과 | ACTIVE | — |
| D-020 | worktree 소실 폴백(0210 D-107) 뒤에는 표시 이름이 **원본 경로 파생으로 자연 복귀**한다. 폴백 전용 표시 분기를 만들지 않는다. | 그 폴백은 managed row 를 삭제하고 `sessions.cwd` 를 `source_cwd` 로 갱신한다 — row 가 없으면 D-007 의 정본이 사라지고 실행 경로가 곧 원본이라 폴백 파생이 정답을 준다. 분기를 만들면 같은 결과를 두 경로로 계산한다. | 0210 D-107 파생 | ACTIVE | — |
| D-021 | 격리 세션의 diff base 는 `managed_worktrees.base_oid` 이고, 그 row 가 없으면(비격리·폴백 후) `HEAD` 다. 유예 브랜치(`worktreeBaseRef`)를 renderer 가 따로 읽지 않는다. | 0210 D-101 의 유예 브랜치는 이미 `base_oid` 로 접혀 저장된다(`service.ts:92`~) — 두 번째 출처를 만들면 갈라진다. | 0210 D-101 파생 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 D-001~D-021 을 신설했다. 이 handoff 의 첫 설계 턴이라 `SUPERSEDED`·`OPEN` 은 없다.
- 0209·0210 의 ACTIVE 결정 중 이번 본문이 바꾸는 것은 없다 — 0209 D-001(Adapter 는 worktree 를 모른다)·D-015(`extraDirs` 불변), 0210 D-101(유예)·D-104(경로)·D-105(dirty 미거부)·D-107(폴백 영속)는 그대로다. 본 plan 은 표시와 읽기만 추가한다.
- 0206 D-010~D-019(diff 타일 배치)는 유지되고 D-012(예시 안내)만 본 plan D-018 이 종료시킨다 — 그 문구의 존재 조건이 “배선할 IPC 가 없다”였고 그 조건이 사라진다.
- **ACTIVE 결정 ↔ AC 대조**: 충돌 0. D-020↔AT-04(row 부재 폴백) · D-021↔AT-09(base 출처) · D-001·D-004↔AT-01, D-002↔AT-01·AT-03, D-003↔AT-01, D-005↔AT-03, D-006↔AT-02, D-007·D-008↔AT-04·AT-05·AT-06, D-009↔AT-07, D-010↔AT-09, D-011↔AT-09, D-012↔AT-11, D-013↔AT-12, D-014·D-015↔AT-10, D-016↔AT-15, D-017↔AT-09, D-018↔AT-13, D-019↔§11 변경 파일에 마이그레이션 없음.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| §1 “화면이 아무 설명을 안 한다”가 증상이 아니라 원인인가 | 원인 확인 | `activityLabel.ts:40` — `activity` 가 `undefined` 면 무조건 `streaming`. 새 세션은 `chat.activity` 가 오기 전이므로 `StatusLine` 이 무작위 동사(`VERBS`, `StatusLine.tsx:11`)를 그린다. |
| 이미 기존 코드가 준비 단계를 알리는가 | 아니오 | `foreground:'preparing'` 라벨이 있으나(`ko.ts:457` `응답 준비 중…`) 그 스냅샷은 `sessionId` 필수라(`ipc.ts:1204`) 세션 발급 전 격리 준비에는 발신되지 않는다. |
| §2 이름 문제가 표시층 결함인가 저장층 결함인가 | 표시층 | `sessions.cwd = executionCwd` 는 resume 이 요구하는 정본이라 옳다(0209 §5). 잘못된 것은 그 값을 사람이 읽는 이름으로 그대로 쓴 `CwdButton.tsx:27`·`gitRowState.ts:24` 둘이다. |
| 0210 D-104 의 새 경로가 이미 문제를 해결했는가 | 아니오 | `<repo>-<hash8>/<브랜치 slug>` 의 basename 은 브랜치 slug 다 — 사람이 읽을 수 있게는 됐지만 “고른 폴더 이름” 은 여전히 아니다. 0210 은 *식별 가능성*을, 이 plan 은 *동일성*을 다룬다. |
| 더 작은 해법 — 경로에서 원본 이름을 역산할 수 있는가 | 가능하지만 채택하지 않음 | `git rev-parse --git-common-dir` 로 본 저장소를 되찾을 수 있다. 그러나 DB row 가 정본을 이미 갖고(`0018_managed_worktrees.sql:4-8`), 역산은 소비자가 정본을 우회하는 합성값이다(D-007). |
| §3 diff 가 이미 실데이터인가 | 아니오 | `DiffTileContent.tsx:12` 이 `MOCK_COMMITS`·`MOCK_FILES`·`MOCK_TREE` 를 직접 읽는다. git diff 용 IPC 채널은 0건(`orca:git:*` 는 `status`·`branches`·`checkout` 셋). |
| 선행 자료(0206)의 “배선할 IPC 가 없다”가 아직 맞는가 | 맞다 | `CHANNELS` 79건 중 git 도메인 3건, diff 관련 0건. 본 plan 이 그 조건을 끝낸다. |
| ACTIVE 결정·기존 계약과 충돌하는가 | 충돌 0 | 0206 D-014(“비교 대상은 현재 브랜치만 — base 를 알 채널이 없어 `main →` 을 붙이면 가짜 값이 된다”)의 조건이 격리 세션에서만 해소된다. 본 plan 은 헤더 표기를 바꾸지 않아 그 결정을 건드리지 않는다. |
| `shared/ipc.ts` 의 “worktree 는 다루지 않는다(제품 결정)” 주석과 충돌하는가 | 이미 0209 가 대체 | 그 주석은 `orca:git:*` 3종의 범위 설명이다. 0209 갱신 메모가 대체를 명시했고 본 plan 이 git 도메인을 5종으로 늘린다. |

- 사용자에게 올릴 결정: 없음. 네 갈래(단계 출처·표시 형태·격리 diff 기준·비격리 diff 기준)는 이번 턴 질의로 닫혔다.
- 코드 조사로 닫은 사실: 준비 단계 이벤트의 발신 지점은 `WorktreeService.prepare`(`features/worktrees/service.ts:51`), renderer 발신 권한은 `send.ts` 가 갖고(`send.ts:5` 헤더 “renderer 발신과 정리를 한다”), `sessionId` 없는 이벤트의 라우팅은 `pendingNewChatKey`(`chatStore.ts:397`), 표시 이름 두 소비자는 `CwdButton.tsx:27`·`gitRowState.ts:24`, diff 소비자 계약은 `DiffTable.tsx:9`.

## 5. 동작 / 사용자 흐름

```text
[랜딩: 작업 경로 선택 + "Worktree에서 격리" 켬 + 전송]
  → renderer: BEGIN_TURN (inflight, 단계 = 없음)
  → main prepare 진행에 따라 worktree.preparing 5회
      repo     → "저장소를 확인하는 중…"
      base     → "기준 커밋을 확인하는 중…"
      branch   → "브랜치 이름을 짓는 중…"
      worktree → "워크트리를 만드는 중…"
      session  → "세션을 시작하는 중…"
  → session.updated 도착 → 단계 줄 소멸 → 기존 진행 표시(동사 + 경과)
  ↘ 준비 거부 → 단계 줄 소멸 + 기존 error 문구(사유 4종 한국어)

[세션이 선 뒤]
  작업 경로 버튼   라벨 = basename(source_cwd)    클릭 = executionCwd 열기
  git 행 저장소    라벨 = basename(repo_root)     브랜치·변경량 = worktree 실측
  변경사항 타일    base_oid → 작업 트리 (격리) / HEAD → 작업 트리 (비격리)

[앱 재시작 후 resume]
  → sessions.cwd(executionCwd)로 복원 → managed_worktrees row 재조회
  → 위 세 표시가 그대로 복원된다
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 격리 off 로 전송 | `worktree.preparing` 을 내지 않는다 | 기존 화면 그대로 (단계 줄 없음) |
| 격리 on, 준비 진행 | 단계 5종을 순서대로 1회씩 발신 | 진행 표시 문구가 단계마다 바뀐다 |
| 격리 on, dirty source | 거부하지 않는다(0210 D-105) | 단계가 `base` 로 그대로 넘어간다 — 미커밋 변경 안내는 칩 툴팁이 갖는다 |
| 격리 on, 저장소 아님 | `repo` 단계 뒤 거부 | 단계 줄이 사라지고 “Git 저장소가 아닙니다.” |
| 격리 on, git 실행 실패 | `repo` 단계 뒤 거부 | 단계 줄이 사라지고 “Git 을 실행하지 못했습니다.” |
| 격리 on, 유예 브랜치 해석 실패 | `base` 단계 뒤 거부 | 단계 줄이 사라지고 “기준 브랜치(…)를 확인하지 못했습니다.” |
| 격리 on, 브랜치 이름 실패 | fallback slug 로 계속 | 단계 줄이 `worktree` 로 그대로 넘어간다 (0209 D-008 유지) |
| `session.updated` 도착 | 단계 상태를 비운다 | 기존 진행 표시(동사 + 경과 + 활동 사실)로 교체 |
| 턴 종료 | `TURN_END_RESET` 이 단계 상태를 비운다 | 진행 표시 자체가 사라진다 |
| 세션 시작 후 (격리) | 표시 이름을 row 에서 읽는다 | 작업 경로/저장소 이름이 랜딩에서 고른 것과 같다 |
| 표시 이름 조회 실패 | row 없음 → 현행 파생 | 실행 경로 basename (현재 동작) — 화면이 비지 않는다 |
| worktree 소실 폴백 후 (0210 D-107) | row 가 삭제돼 `worktree` 가 `undefined` | 실행 경로가 곧 원본이라 이름이 원본으로 복귀한다(D-020) |
| 변경사항 타일 열기 | 요약 1회 조회 | 파일 목록 + 커밋 목록 (격리) |
| 타일 열림 + 턴 종료 | 요약 재조회 | 에이전트가 방금 만든 변경이 반영된다 |
| 파일 펼치기 | 그 파일 본문 1회 조회 | old/new diff 표 |
| 변경 없음 | 요약 파일 0건 | 빈 상태 문구 |
| 파일 200 초과 / 커밋 100 초과 | 잘라내고 truncated 표시 | “일부만 표시” 안내 |
| 파일이 1 MiB 초과 / binary | 본문 대신 사유 | “미리보기를 표시할 수 없습니다” |
| 21번째 파일 펼치기 | 가장 오래 펼친 파일을 접는다 | 펼침 상한 도달 (D-016) |

### 파생 UX / 엣지케이스

- loading: 타일을 처음 열면 요약이 도착할 때까지 파일 목록 자리가 비어 있다 — 빈 상태 문구는 요약 도착 후에만 뜬다(“변경 없음”과 “아직 안 왔음”을 섞지 않는다).
- error: 요약/본문 조회 실패는 예외가 아니라 값이다 — 기존 git IPC 의 무해 폴백 관례를 따른다(`app/src/main/app/handlers/git.ts:31`).
- cancel: 준비 중 사용자가 중단하면 `lease.controller.abort()` 가 기존대로 걸리고 단계 줄은 턴 종료 리셋으로 사라진다.
- concurrency: 단계 이벤트는 `sessionId` 가 없어 `pendingNewChatKey` 로 라우팅된다 — 준비 중 사용자가 다른 세션으로 이동해도 그 화면을 오염시키지 않는다(`chatStore.ts:397` 의 기존 규칙).
- a11y: 단계 줄은 기존 `StatusLine` 의 `aria-live="polite"` 안에서 바뀐다 — 새 라이브 리전을 만들지 않는다.
- 폐쇄망: D-001 로 신규 네트워크 호출 0건. diff 조회는 전부 로컬 git 이다.

## 6. 범위 / 비범위

- **범위**: 격리 준비 단계 이벤트 + 한 줄 표시 · 작업 경로 버튼/­git 행 저장소 이름의 원본 표시 · diff 타일 실데이터(요약 + 파일 본문 + 커밋 선택) · 예시 데이터 제거.
- **비범위**: origin fetch(D-001) · 준비 단계 누적 목록(D-002) · 0210 이 소유한 경로·유예·폴백 정책의 재설계 · diff 타일에서의 stage/commit/discard 조작 · 비격리 세션의 base 영속(질의에서 사용자가 고르지 않은 선택지) · 0206 D-013/D-014 가 잠근 헤더 구성(설정 메뉴·`main →` 표기) · worktree 목록 관리 화면.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 비격리 세션의 세션-시작 HEAD 영속 | 예 — 새 컬럼 + 마이그레이션 | 사용자가 “HEAD 대비 미커밋 변경만”을 골라 이번엔 필요 없다. 후속 요구 시 새 handoff. |
| diff 타일의 쓰기 조작(stage/commit) | 아니오 | 읽기 계약이 서면 그 위에 얹는다. 후속. |
| 단계 이벤트를 비격리 턴까지 넓히기 | 아니오 | 이벤트 형태는 그대로 두고 발신 지점만 늘리면 된다(D-005 는 범위 결정이지 구조 제약이 아니다). 후속. |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 | 격리 준비가 진행되면 다섯 단계가 `repo → base → branch → worktree → session` 순서로 정확히 1회씩 관측되고, 화면 문구가 그 단계의 한국어 라벨로 바뀐다 | 통합: fake git operations 로 `prepare` 를 돌려 수집한 단계 배열이 정확히 그 5개 순서라고 단언. 렌더: `StatusLine` 에 `prepareStep='branch'` 를 주면 `브랜치 이름을 짓는 중…` 이 나오고 무작위 동사가 **안** 나온다고 단언 | `send.ts` → `prepareTurnExecution(onProgress)` → `sendChatEvent` → `chatStore.receive` → `PendingAssistant` → `StatusLine` |
| R-02 | AT-02 | 준비가 거부되면 단계 상태가 비워지고 현재 사유 4종의 문구가 뜬다 | 통합: 저장소가 아닌 경로로 `prepare` → 마지막 관측이 `repo` 단계이고 그 뒤 `error` message 가 “Git 저장소가 아닙니다.” 라고 단언. 리듀서: `error` 수신이 `worktreePrepareStep` 을 null 로 만든다고 단언 | 같은 경로 + `send.ts` 의 `preparedExecution.kind==='rejected'` 분기 |
| R-03 | AT-03 | 격리를 끄고 보낸 새 세션은 `worktree.preparing` 을 한 번도 받지 않는다 | 통합: `enabled:false` 로 `prepareTurnExecution` 실행 → 수집한 단계 배열 길이 0 이라고 단언 | `prepare-worktree.ts` 의 `passthrough` 분기 |
| R-04 | AT-04 | 격리 세션의 작업 경로 버튼 라벨이 `basename(source_cwd)` 다 | 순수: 라벨 파생 함수에 `{cwd:'/wt/<uuid>/app', sourceCwd:'/repo/orca-skin/app'}` 를 주면 `app`, `{cwd:'/wt/<uuid>', sourceCwd:'/repo/orca-skin'}` 를 주면 `orca-skin` 이라고 단언 (실행 경로 basename 인 `<uuid>` 가 **아님**) | `LoadedSession.worktree`/`session.updated.patch.worktree` → `chatReducer` → `CwdButton` |
| R-05 | AT-05 | 그 버튼을 누르면 `executionCwd` 가 열린다 | 렌더/단위: `openPath` 스텁을 주고 클릭 → 인자가 `session.cwd`(실행 경로)이고 `source_cwd` 가 **아니라고** 단언 | `CwdButton.handleClick` → `fileApi.openPath` |
| R-06 | AT-06 | 격리 세션의 git 행 저장소 이름이 `basename(repo_root)` 다 | 순수: `gitRowView` 에 worktree 상태(`root='/wt/<uuid>'`)와 `repoRoot='/repo/orca-skin'` 을 주면 `repo` 가 `orca-skin` 이라고 단언 | `gitRowState.gitRowView` → `GitRow` · `DiffTileHeader` |
| R-07 | AT-07 | 같은 행의 브랜치와 +N/−M 은 worktree 실측 그대로다 (회귀) | 순수: 같은 입력에서 `branch` 가 worktree 브랜치이고 `added`/`removed` 가 worktree `dirty` 값이라고 단언 | 위와 같은 경로 |
| R-08 | AT-08 | 앱을 다시 켜고 resume 해도 AT-04·AT-06 이 같다 | 통합: 임시 DB 에 row 를 넣고 세션을 로드해 `LoadedSession.worktree` 가 `{sourceCwd, repoRoot}` 를 싣는다고 단언. 새 `DbQueries` 로 다시 열어도 같은 값이라고 단언 | `session:load` → `DbQueries.getManagedWorktreeBySession` → `LoadedSession` → `LOAD_SESSION` 리듀서 |
| R-09 | AT-09 | 변경사항 타일이 실제 파일 목록을 그린다 — managed row 가 있으면 `base_oid` 대비, 없으면(비격리·폴백 후) `HEAD` 대비이며 둘 다 미추적 파일을 포함한다 | 통합(임시 저장소): base 커밋 후 추적 파일 1개 수정 + 미추적 파일 1개 생성 → 요약의 `files` 가 그 2건이고 미추적 항목의 `added` 가 그 파일 줄 수라고 단언. 격리 row 를 붙이면 `base.kind==='worktree-base'`, 없으면 `'head'` 라고 단언 | `DiffTileContent` → `gitApi.diffSummary` → `orca:git:diffSummary` → `git-diff.ts` |
| R-10 | AT-10 | 파일을 펼치면 그 파일의 실제 old/new 가 표로 그려진다 | 통합(임시 저장소): 파일 본문 조회가 `{kind:'text', oldValue: base 시점 내용, newValue: 작업 트리 내용}` 이라고 단언. 미추적 파일은 `oldValue===''` 라고 단언 | `DiffFileHeaders` onToggle → `gitApi.diffFile` → `orca:git:diffFile` |
| R-11 | AT-11 | 커밋을 고르면 그 커밋 하나의 변경만 보인다 | 통합(임시 저장소): base 위에 커밋 2개 → `commit:<sha2>` 로 요약을 부르면 파일 목록이 sha2 가 바꾼 파일만이고, 같은 인자의 본문 조회 `oldValue` 가 sha1 시점 내용이라고 단언 | 같은 두 채널의 `commit` 인자 |
| R-12 | AT-12 | 격리 세션의 커밋 목록은 `base_oid..HEAD` 실제 커밋이고, 비격리 세션은 빈 목록이다 | 통합(임시 저장소): 격리 row + 커밋 2개 → `commits` 길이 2 이고 subject 가 실제 제목이라고 단언. row 없이 부르면 `commits` 길이 0 이라고 단언 | 같은 요약 채널 |
| R-13 | AT-13 | 예시 데이터와 예시 안내 문구가 제품에서 사라진다 | 전수: `rg 'diffTileMock' app/src` = 0건, `rg 'diffMockNotice' app/src` = 0건. 파일 `diffTileMock.ts` 부재 | — (제거) |
| R-14 | AT-14 | 변경이 없으면 빈 상태 문구가 뜨고, 요약 도착 전에는 뜨지 않는다 | 렌더: `summary=null` 이면 빈 상태 문구가 **없고**, `summary={files:[]}` 이면 있다고 단언 | `DiffTileContent` 의 요약 상태 3분기 |
| R-15 | AT-15 | 상한 초과가 값으로 표시된다 — 파일 201건이면 200건 + 잘림 표시, 1 MiB 초과 파일은 본문 대신 사유 | 순수: 요약 정규화 함수에 201행 numstat 을 주면 `files.length===200 && filesTruncated===true` 라고 단언. 통합: 1 MiB 초과 파일의 본문 조회가 `{kind:'unavailable', reason:'too-large'}` 라고 단언 | `git-diff.ts` 의 정규화 · `DiffTileContent` 의 안내 |

### AC 검증 주의사항

- 기존 테스트 재사용: `gitRowState.test.ts` 는 실재하고 `repoNameFromRoot`·`gitRowView` 케이스를 갖는다 — AT-06·AT-07 은 그 파일에 케이스를 **추가**한다(파일명을 계약으로 삼지 않는다). `composerPanel.render.test.ts`·`gitRow.render.test.ts` 도 실재한다.
- 사람 실기 항목: 없다. 문구 선택·단계 순서·이름 파생·diff 범위 판정·상한 절단은 전부 순수 함수 또는 임시 저장소 통합으로 내려간다. 시각 확인은 이번 요구에 없다(배치를 바꾸지 않는다).
- N회/총량 기준: AT-01 의 “정확히 1회씩”은 `onProgress` sink 의 프로덕션 호출부 전수를 센다 — `rg 'onProgress\(' app/src/main` 이 `service.ts` 4건 + `prepare-worktree.ts` 1건 = 5건임을 확인하고, 관측 지점은 그 5건 전부를 지나는 격리 신규 세션 한 호출이다. 테스트 fake 는 git operations 만 대체하고 `onProgress` 호출부는 프로덕션 코드 그대로 지난다.
- 총량/0건 기준: AT-13 의 두 `rg` = 0건은 **제거 대상만** 센다 — 허용 예외 없음(`diffTileMock`·`diffMockNotice` 는 0206 이 이번 작업을 위해 만든 임시 식별자다). 0건 게이트 단독으로는 “실데이터가 붙었다”를 증명하지 못하므로 AT-09·AT-10 양성 단언과 짝지어 잠근다(§5 방향 규칙).

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 이 작업은 0206(diff 타일 배치)·0209(격리 코어)·0210(경로·유예·폴백) **세** 기준선에 걸치고 그 위에 신규 Requirement(준비 단계 안내)를 얹는다. Delta V 는 단일 기준 V 의 증분이라 세 기준선을 동시에 상속할 수 없다 — 대신 세 handoff 가 잠근 동작을 이 Baseline 안의 `INHERITED` + `REGRESSION` 으로 명시한다.
- 기준 V 상속 근거: 없음(Baseline).
- 변경이 시작되는 수준: R — 사용자가 관측하는 결과 셋이 모두 바뀐다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 준비 단계 5종 표시 | NEW | — |
| R-02 | R | §7 준비 거부 문구 | NEW | — |
| R-03 | R | §7 비격리 무변화 | NEW | — |
| R-04 | R | §7 작업 경로 버튼 라벨 | NEW | — |
| R-05 | R | §7 버튼 클릭 = 실행 경로 | NEW | — |
| R-06 | R | §7 git 행 저장소 이름 | NEW | — |
| R-07 | R | §7 git 행 브랜치·변경량 | INHERITED | 0206 AC(git 행 표시) @ `62eeefb` |
| R-08 | R | §7 resume 후 표시 복원 | NEW | — |
| R-09~R-15 | R | §7 diff 실데이터 7건 | NEW | — |
| AT-01~AT-06, AT-08~AT-15 | AT | §7 검증 수단 칸 | NEW | — |
| AT-07 | AT | §7 검증 수단 칸 | INHERITED | 0206 `gitRowState.test.ts` @ `62eeefb` |
| SD-01 | SD | §5 준비 흐름 · §9 TO-BE | NEW | — |
| SD-02 | SD | §5 resume 흐름 · §13 | NEW | — |
| SD-03 | SD | §5 diff 조회 계기 3종 · §9 | NEW | — |
| SD-04 | SD | §5 격리 준비 거부 경로 | INHERITED | 0210 ΔV1 준비 경로 @ `origin/main` |
| SD-05 | SD | §5 worktree 소실 폴백 후 표시 | INHERITED | 0210 D-107 @ `origin/main` |
| AR-01 | AR | §10 `worktree.preparing` 이벤트 계약 | NEW | — |
| AR-02 | AR | §10 `LoadedSession.worktree`·`session.updated.patch.worktree` | NEW | — |
| AR-03 | AR | §10 `orca:git:diffSummary`·`orca:git:diffFile` 계약 | NEW | — |
| AR-04 | AR | §10 격리 준비 코어 배선 | INHERITED | 0209 AR @ `ec3ec1bc` + 0210 ΔV1 |
| MD-01 | MD | §11 단계 라벨 파생(순수) | NEW | — |
| MD-02 | MD | §11 표시 이름 파생(순수) | NEW | — |
| MD-03 | MD | §11 diff 범위 해석(순수 SSOT) | NEW | — |
| MD-04 | MD | §11 요약 정규화·상한 절단(순수) | NEW | — |
| MD-05 | MD | §11 파일 목록 → 평탄 트리 행(순수) | NEW | — |
| MD-06 | MD | §11 `visibleTreeRows` 접힘 파생 | INHERITED | 0206 `diffTileTree.ts` @ `62eeefb` |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `send.ts:prepareTurnExecution` → `service.prepare(onProgress)` → `sendChatEvent` → `chatStore.receive` → `StatusLine` | 수집한 단계 배열 == `['repo','base','branch','worktree','session']` + 라벨 렌더 단언 | required — 단계 배열은 “5개가 다 있다”는 존재 주장이라 자리 뒤바뀜에 둔감할 수 있다. `base`↔`branch` 발신 지점을 맞바꾸는 변이와 `worktree` 발신 1건 제거 변이를 심는다 | EP-01 (5) · EP-02 (1) · EP-03 (1) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 같은 경로 + `send.ts` rejected 분기 → `error` 이벤트 | 거부 시 마지막 단계 == `repo` 이고 error message == “Git 저장소가 아닙니다.” | not selected — 거부 경로의 관측이 직접 행동 결과(발신된 이벤트 두 개)다 | EP-04 (3) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `prepare-worktree.ts` passthrough 분기 | `enabled:false` 실행에서 단계 배열 길이 0 | not selected — 직접 0건 관측이며 VP-01 의 양성 단언이 같은 sink 를 잠근다 | EP-01 (5) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `LoadedSession.worktree` → `LOAD_SESSION`/`session.updated` 리듀서 → `CwdButton` | 두 입력(하위 경로·저장소 루트)에서 각각 `app`·`orca-skin` | required — 라벨 파생은 “원본을 쓴다”는 자리 주장이다. `sourceCwd` 대신 `cwd` 를 읽도록 맞바꾸는 변이를 심는다 | EP-05 (2) · EP-06 (2) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | `CwdButton.handleClick` → `fileApi.openPath` | `openPath` 인자 == `session.cwd` | not selected — 인자값을 직접 관측한다 | EP-05 (2) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | `gitRowView(repoRoot)` → `GitRow` · `DiffTileHeader` | worktree 상태 입력에서 `repo === 'orca-skin'` | required — VP-04 와 같은 자리 주장이다. `repoRoot` 대신 `status.root` 를 읽는 변이를 심는다 | EP-05 (2) |
| VP-07 | R-07 ↔ AT-07 | REGRESSION | 같은 경로 | 같은 입력에서 `branch`·`added`·`removed` 가 worktree 실측 | not selected — 기존 0206 oracle 을 그대로 재실행한다 | EP-05 (2) |
| VP-08 | SD-02 ↔ ST-01 | REQUIRED | `session:load` → `getManagedWorktreeBySession` → `LoadedSession` → 리듀서 | 임시 DB 를 닫고 새 `DbQueries` 로 다시 열어도 같은 `{sourceCwd,repoRoot}` | not selected — 재시작 왕복 자체가 직접 관측이다 | EP-06 (2) |
| VP-09 | AR-03 ↔ IT-01 | REQUIRED | `DiffTileContent` → `gitApi.diffSummary` → handler → `git-diff.ts` | 임시 저장소에서 추적 수정 1 + 미추적 1 = `files` 2건, base kind 가 row 유무로 갈림 | not selected — 실제 저장소 상태 대비 산출을 직접 비교한다 | EP-07 (2) · EP-08 (3) |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | `DiffFileHeaders` onToggle → `gitApi.diffFile` → handler → `git-diff.ts` | old/new 문자열이 base 시점·작업 트리 내용과 문자열 동일 | not selected — 내용 동일성 비교가 직접 oracle 이다 | EP-07 (2) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | 두 채널의 `commit` 인자 → 범위 해석 SSOT | 커밋 2개 중 sha2 지정 시 파일 목록·oldValue 가 sha1 기준 | required — 범위 해석이 두 채널에 걸린 SSOT 주장이다. 본문 조회만 working 범위를 쓰도록 되돌리는 변이를 심는다 | EP-07 (2) |
| VP-12 | R-12 ↔ AT-12 | REQUIRED | 요약 채널 → 커밋 목록 조립 | row 있으면 길이 2 + subject 일치, 없으면 길이 0 | not selected — 양·음 두 입력의 직접 산출 비교다 | EP-07 (2) |
| VP-13 | R-13 ↔ AT-13 | REQUIRED | — (제거) | `rg 'diffTileMock'` = 0 · `rg 'diffMockNotice'` = 0 · 파일 부재 | required — 0건 스윕은 남은 잔여물에만 반응한다. VP-09·VP-10 의 양성 단언과 짝지으며, mock import 를 되살리는 변이가 이 스윕에서 red 인지 확인한다 | EP-09 (2) |
| VP-14 | R-14 ↔ AT-14 | REQUIRED | `DiffTileContent` 요약 상태 3분기 | `null` → 빈 상태 없음, `{files:[]}` → 빈 상태 있음 | not selected — 두 입력의 렌더 산출 차이를 직접 본다 | EP-08 (3) |
| VP-15 | R-15 ↔ AT-15 | REQUIRED | 정규화 함수 · 본문 조회 | 201행 → 200 + `filesTruncated`, 1 MiB 초과 → `too-large` | not selected — 경계값 입력의 직접 산출이다 | EP-08 (3) |
| VP-16 | MD-05 ↔ UT-01 | REQUIRED | `buildDiffTreeRows(files)` → `visibleTreeRows` → `DiffFileTree` | 중첩 경로 목록에서 depth·단독 디렉토리 압축이 기대 배열과 일치 | not selected — 순수 함수의 입출력 비교다 | EP-08 (3) |
| VP-17 | MD-06 ↔ UT-02 | REGRESSION | 같은 경로 | 기존 `diffTileTree` 케이스가 새 타입에서 그대로 통과 | not selected — 기존 oracle 재실행 | EP-09 (2) |
| VP-18 | SD-04 ↔ ST-02 | REGRESSION | 0209·0210 격리 준비 코어 | `service.test.ts`·`send.worktree.test.ts`·`prepare-worktree.test.ts` 가 계속 green |
| VP-19 | SD-05 ↔ ST-03 | REGRESSION | `recoverMissingWorktree` → row 삭제 → `patch.cwd` | 폴백 후 `LoadedSession.worktree` 가 `undefined` 이고 라벨이 원본 basename | not selected — row 부재·라벨 두 값을 직접 관측한다 | EP-06 (2) | not selected — 기존 oracle 재실행 | EP-01 (5) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app` 정적 게이트 | `app/src/**` 를 바꾼다 | `npm run lint` · `npm run typecheck` (ABI 중립, `app/AGENTS.md §better-sqlite3 ABI`) | 이번 변경이 낸 error 만 blocking |
| `app` 테스트 | 신규·회귀 pair 가 vitest 다 | `./node_modules/.bin/vitest run` (DB 스위트 포함 시 `npm test`) | 이번 변경이 낸 red 만 blocking. ABI egress 차단 기인 DB red 는 기준선으로 분리 보고 |
| 문서 인벤토리 | IPC 채널 79→81 · NormalizedEvent 21→22 · git 도메인 3→5 로 생성물 수치가 바뀐다 | `node scripts/check-doc-inventory.mjs` 재생성 후 `--check` | 재생성 누락은 blocking |
| IPC 계약 문서 | 신규 채널 2종 + 신규 이벤트 1종은 `docs/IPC_CONTRACT.md` 가 정본이다 | 신규 행 3건 존재 확인 | 누락은 blocking |
| i18n 카탈로그 | ko/en 신규 키를 추가한다 | `resources.test.ts` (리프 키 패리티·빈 값·플레이스홀더) | 패리티 실패는 blocking |
| 마이그레이션 append-only | 변경 없음(D-019) | `check-migrations-appendonly.mjs` | 해당 없음 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 격리 준비는 renderer 에 아무 신호도 내지 않는다 — `prepare` 는 결과 union 하나만 돌려준다 | `app/src/main/features/worktrees/service.ts:70` · `app/src/main/app/chat-turn/prepare-worktree.ts:55` |
| 준비 거부 사유는 현재 **4종**이고 `dirty` 는 없다 | `service.ts:20`~ (`PrepareWorktreeResult`) |
| `prepare` 의 관측 가능한 경계는 5개다 — repo 판정 · base 해석 · 브랜치 이름 · `worktree add` · 실행 cwd 확정 | `service.ts:78`·`:91`·`:105`·`:118` · `prepare-worktree.ts:57` |
| resume 경로는 `recoverMissingWorktree` 를 먼저 지나 폴백할 수 있다 — 신규 격리 경로와 분기가 다르다 | `prepare-worktree.ts:34`~ |
| renderer 발신 권한은 `send.ts` 가 갖는다 — 헤더가 “renderer 발신과 정리를 한다”로 책임을 명시 | `app/src/main/app/chat-turn/send.ts:5` |
| `sessionId` 없는 이벤트는 `pendingNewChatKey` 로 라우팅된다(`message.queued` 선례) | `app/src/renderer/src/features/chat/store/chatStore.ts:392` |
| 전송 즉시 `BEGIN_TURN` 이 `inflight`·`turnStartedAt` 을 세워 준비 중에도 `StatusLine` 이 이미 떠 있다 | `chatReducer.ts:385` · `chatStore.ts:621` |
| `activity` 미도착이면 라벨이 `streaming` 으로 접혀 무작위 동사가 나온다 | `activityLabel.ts:40` · `StatusLine.tsx:11` |
| 작업 경로 버튼 라벨은 `basename(cwd)` 하나다 | `CwdButton.tsx:27` |
| git 행 저장소 이름은 `basename(status.root)` 하나다 — worktree 에서는 `--show-toplevel` 이 worktree 루트를 준다 | `gitRowState.ts:24` · `git-cli.ts:65` |
| `managed_worktrees` 가 `repo_root`·`source_cwd`·`base_oid`·`branch` 를 이미 갖는다 — 0210 은 스키마를 바꾸지 않았다 | `migrations/0018_managed_worktrees.sql:4-8` (마이그레이션 18건 유지) |
| 세션→row 조회 메서드가 이미 있다 | `infra/db/queries.ts:812` `getManagedWorktreeBySession` |
| diff 타일 데이터는 전부 예시이고 “실제 데이터가 붙을 때 이 파일만 사라지면 된다”가 명시돼 있다 | `rightpanel/diffTileMock.ts:7` |
| diff 소비자 계약은 `{oldValue,newValue}` 전문이다 — patch 파서가 없다 | `DiffTable.tsx:9` · `lib/diffLines.ts` |
| git 실행 헬퍼는 `runGit(cwd, args, {readOnly})` 하나이고 읽기에 `GIT_OPTIONAL_LOCKS=0`·`GIT_TERMINAL_PROMPT=0` 을 건다 | `infra/git/runner.ts:19` · `git-cli.ts:31` |
| 읽기 IPC 는 zod 실패 시 무해 폴백을 쓴다 | `app/handlers/git.ts:31` |
| main 레이어 규칙 — feature 는 다른 feature 를 import 하지 않고, 조립은 컴포지션 루트가 한다 | `app/src/main/AGENTS.md §feature 수직 슬라이스` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| IPC 채널 | `CHANNELS` 리터럴 파싱 | 79 | 신규 2건 추가 시 81. 생성물 재생성 필요 |
| `orca:git:*` 채널 | 같은 파싱 | 3 | `status`·`branches`·`checkout`. diff 관련 0건 |
| `NormalizedEvent` variant | 인벤토리 생성물 대조 + 유니온 본문 수동 계수(typed 20 + `ChatActivitySnapshot`) | 21 | 신규 1건 추가 시 22 |
| DB 마이그레이션 | `migrations/` 파일 수 | 18 | 본 plan 은 늘리지 않는다(D-019) |
| `basenameForDisplay` 소비처 | `rg basenameForDisplay app/src` | 3 프로덕션 | `CwdButton`·`ExtraDirChip`·`toolMeta` 각 1. 앞 하나만 이번 대상 |
| `diffTileMock` 참조 | `rg diffTileMock app/src` | 2 | `DiffTileContent.tsx` · `diffTileTree.ts`(타입 import). 둘 다 대체 대상 |
| `diffMockNotice` 참조 | `rg diffMockNotice app/src` | 3 | `ko.ts` · `en.ts` · `DiffTileContent.tsx`. 전부 제거 |
| `gitRowView` 소비처 | `rg gitRowView app/src` | 2 프로덕션 | `GitRow.tsx` · `DiffTileHeader.tsx`. 저장소 이름 변경이 둘 다에 닿는다 |
| `onProgress` 발신 지점(설계 후 목표) | `service.ts` 4 + `prepare-worktree.ts` 1 | 5 | AT-01 의 분모 |
| 표시 이름 전달 지점 | `LoadedSession` 조립 + `session.updated` patch | 2 | EP-06 의 분모 |

### 수치 / 전칭 표현 검산

- 재측정 수치(origin/main 기준 재실측): 채널 79 · git 도메인 3 · 마이그레이션 18 — 0210 이 셋 다 늘리지 않았다.
- 내역 합 = 총계: `NormalizedEvent` 유니온 본문에서 `type:` 리터럴 20건 + `ChatActivitySnapshot` 참조 1건 = 21 = 인벤토리 21.
- “유일한/항상/절대” 반례 검색: “diff 를 읽는 IPC 가 없다”의 반례를 `rg "'orca:git" app/src/shared/ipc.ts` 로 확인 — 3건뿐이고 diff 없음. “표시 이름 소비자가 둘뿐이다”의 반례를 `rg gitRowView`·`rg basenameForDisplay` 로 확인 — git 행 계열 2건 + 작업 경로 버튼 1건이며 `ExtraDirChip`·`toolMeta` 는 worktree 경로를 받지 않는다.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 존재. `docs/handoff/AGENTS.md §공통 V 추적 프로토콜`·`§산출물 문장 규칙` 존재. `gitRowState.test.ts`·`diffTileTree` 소비 테스트·`resources.test.ts`(리프 키 패리티 케이스) 존재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-04`, `AR-04`(0209 상속) · `MD-06`(0206 상속).
- 현재 책임 소유자: 준비 = `features/worktrees/service.ts`, 순서·발신 = `app/chat-turn/send.ts`, 표시 이름 = renderer 두 순수 함수, diff = renderer 상수 모듈.
- 현재 entry → flow → state → consumer: `chat:send` → `prepareTurnExecution` → (침묵) → `TurnContext.cwd=executionCwd` → `session.updated{patch:{cwd}}` → 리듀서 `cwd` → `CwdButton`·`GitRow` 가 그 경로 하나에서 이름을 파생.
- 현재 오류/취소 경로: 거부는 `error` 이벤트 1건, 중단은 `lease.controller.abort()`. 준비 중 화면 상태는 `inflight` 하나뿐이다.
- 문제의 직접 원인: (a) 준비 구간에 renderer 로 가는 신호가 0건, (b) 사람이 읽는 이름과 실행 경로가 같은 값 하나에서 파생, (c) diff 소비자가 상수 모듈을 import.

```text
[chat:send worktreeIsolation:true]
  → prepareTurnExecution        (renderer 신호 0건 — onRecovered 는 resume 전용)
  → buildTurnContext(cwd=executionCwd)
  → session.updated{patch:{cwd:executionCwd}}
  → chatReducer.cwd = executionCwd
  → CwdButton(basename)  ·  GitRow(basename(status.root))
  → DiffTileContent → diffTileMock (상수)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`·`SD-02`·`SD-03` · `AR-01`~`AR-03` · `MD-01`~`MD-05`.
- 변경 후 책임 소유자. 단계 **발생**은 `features/worktrees/service.ts`(콜백 호출), 단계 **발신**은 `app/chat-turn/send.ts`(electron 의존을 feature 밖에 둔다), 단계 **문구**는 renderer 순수 파생. 표시 이름 **정본**은 `managed_worktrees` row 이고 **전달**은 `LoadedSession`/`session.updated`, **파생**은 renderer 순수 함수. diff **읽기**는 `infra/git/git-diff.ts`, **범위 판정**은 그 파일의 단일 해석 함수, **조립**은 `app/handlers/git.ts`.
- 변경 후 entry → flow → state → consumer: 아래 도식.
- 변경 후 오류/취소 경로: 준비 거부는 기존 `error` 이벤트 그대로(D-006)이고 단계 상태만 추가로 비워진다. diff 조회 실패는 무해 폴백 값이라 타일이 사라지지 않는다.
- 유지하는 기존 메커니즘: `pendingNewChatKey` 라우팅 · `StatusLine` 단일 진행 표시 · `statusForCwd` 의 늦은 응답 폐기 · `shouldRefetchGitStatus` 의 턴 종료 전이 · `visibleTreeRows` 접힘 파생 · `runGit` 읽기 옵션. 대체하는 메커니즘: `diffTileMock` 상수 → IPC 두 채널(D-018).

```text
[chat:send worktreeIsolation:true]
  → prepareTurnExecution({ onProgress })
      service.prepare  →  onProgress('repo'|'base'|'branch'|'worktree')
      send.ts          →  onProgress('session')  (worktree 확보 후 런타임 확보 전)
        각 호출 → sendChatEvent { type:'worktree.preparing', step }
  → chatStore.receive (sessionId 없음 → pendingNewChatKey)
  → chatReducer.worktreePrepareStep
  → StatusLine: prepareStep 이 있으면 그 라벨, 없으면 기존 파생

  → session.updated { patch:{ cwd, worktree:{ sourceCwd, repoRoot } } }
  → chatReducer.cwd(실행) + chatReducer.worktree(표시 정본)
  → CwdButton  label=basename(worktree.sourceCwd ?? cwd)   click=cwd
  → GitRow     repo =basename(worktree.repoRoot ?? status.root)   branch/±=status

  → DiffTileContent
      열림·cwd 변경·턴 종료 → gitApi.diffSummary({cwd, sessionId, commit?})
      파일 펼침             → gitApi.diffFile({cwd, sessionId, path, commit?})
      → handlers/git.ts → infra/git/git-diff.ts
          resolveDiffRange(sessionId, commit) ← managed_worktrees | HEAD
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 준비 구간 관측성 | renderer 신호 0건 | 단계 이벤트 5회 | R-01 | `AR-01` / VP-01 · `service.ts`·`send.ts`·`ipc.ts` |
| 진행 표시 파생 | `activity` 만 본다 | `prepareStep` 우선, 없으면 기존 | D-002 한 줄 교체 | `MD-01` / VP-01 · `activityLabel.ts` |
| 표시 이름 정본 | 실행 경로 하나 | row 의 `source_cwd`·`repo_root` | D-007 | `AR-02` / VP-04·VP-06 · `LoadedSession`·리듀서 |
| 버튼 동작 | 라벨과 같은 값 | 라벨=원본, 동작=실행 경로 | D-008 | `MD-02` / VP-05 · `CwdButton.tsx` |
| resume 복원 | `cwd` 만 | `cwd` + `worktree` | R-08 | `SD-02` / VP-08 · `handlers/session.ts` |
| diff 데이터원 | 상수 모듈 | git 읽기 IPC 2종 | R-09·R-10 | `AR-03` / VP-09·VP-10 · `git-diff.ts` |
| diff 범위 | 없음 | `working(base)` \| `commit(sha)` 단일 해석 | D-010·D-012 | `MD-03` / VP-11 · `git-diff.ts` |
| 트리 구성 | 상수 배열 | 파일 목록 → 평탄 트리 순수 파생 | R-09 | `MD-05` / VP-16 · 신규 순수 모듈 |
| 상한 | 없음(고정 데이터) | 200/100/1 MiB/20 + 잘림 값 | D-016 | `MD-04` / VP-15 · `git-diff.ts` |
| 예시 표면 | mock + 안내 문구 | 삭제 | D-018 | `R-13` / VP-13 · 파일 제거 |
| test seam | diff 검증 불가 | 순수 4곳 + 임시 저장소 통합 | §11 | `MD-01`~`MD-05` / VP-01·09·10·15·16 |

> AS-IS 의 `diffTileMock` 책임은 **삭제**다(이동이 아니다) — 그 데이터의 소비자였던 세 View 는 props 계약을 유지한 채 실데이터를 받는다.

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `features/worktrees/service.ts` | 준비 단계 경계에서 콜백 호출. electron 을 모른다 | `onProgress?: (step) => void` | `app/chat-turn/prepare-worktree.ts` |
| `app/chat-turn/prepare-worktree.ts` | `onProgress` 를 service 로 통과 + `session` 단계 발생 지점 제공 | 위 콜백을 인자로 받는다 | `send.ts` |
| `app/chat-turn/send.ts` | 콜백을 `sendChatEvent` 로 잇는다 | `WebContents` | 컴포지션 루트 |
| `infra/git/git-diff.ts` | 범위 해석 + 요약/본문 조회 + 상한 절단 | `(cwd, base|commit)` → DTO | `app/handlers/git.ts` |
| `app/handlers/git.ts` | 채널 2종 등록 + `sessionId` → row 조회 주입 | zod 요청 → DTO | 컴포지션 루트 |
| renderer 순수 모듈 4종 | 단계 라벨 키 · 표시 이름 · 트리 행 · 요약 상태 파생 | 값 → 값 | 각 컴포넌트 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-01 · VP-03 · VP-18 | `worktree.preparing` 단계 5종이 준비 경계마다 정확히 1회 (EP-01, 5지점: `repo`·`base`·`branch`·`worktree` = `service.prepare` 내부 4, `session` = `prepare-worktree.ts` 의 신규 격리 분기 1) | `WorktreePrepareStep` 유니온 (`shared/ipc.ts`) | 구현자 | 준비 각 경계 | 지점이 빠지면 그 구간에 화면이 다시 무작위 동사로 돌아간다. 순서가 어긋나면 사용자가 실제와 다른 진행을 읽는다 |
| AR-01 / VP-01 | 단계 이벤트의 renderer 라우팅 (EP-02, 1지점: `chatStore.receive` 의 `sessionId` 없는 분기) | `chatStore.receive` | 구현자 | 이벤트 수신 | 라우팅이 없으면 이벤트가 활성 세션(다른 대화)으로 새어 남의 화면을 오염시킨다 |
| MD-01 / VP-01 | `prepareStep` 이 있으면 그것이 라벨을 이긴다 (EP-03, 1지점: `deriveActivityLabel` 반환 조립) | `lib/activityLabel.ts` | 구현자 | 매 렌더 파생 | 우선순위가 없으면 단계 문구가 무작위 동사에 덮여 R-01 이 화면에 도달하지 않는다 |
| AR-01 / VP-02 | 단계 상태 소멸 (EP-04, 3지점: `BEGIN_TURN` · `session.updated` · `TURN_END_RESET`) | `chatReducer` | 구현자 | 턴 시작·세션 확정·턴 종료 | 하나라도 빠지면 준비가 끝났는데 “워크트리를 만드는 중…”이 남아 거짓 상태가 된다 |
| MD-02 / VP-04 · VP-05 · VP-06 · VP-07 · VP-19 | 표시 이름은 원본, 동작·조회는 실행 경로. row 부재는 실행 경로 폴백(D-020) (EP-05, 2지점: `CwdButton` 라벨/클릭 · `gitRowView` repo) | 두 순수 함수 | 구현자 | 매 렌더 파생 | 한 지점만 고치면 두 표면 중 하나가 계속 UUID 를 보여준다. 반대로 동작까지 원본으로 바꾸면 탐색기가 남의 경로를 연다(D-008 위반) |
| AR-02 / VP-04 · VP-06 · VP-08 | 표시 정본 전달 (EP-06, 2지점: `session:load` 의 `LoadedSession` 조립 · `session.updated` patch 조립) | `LoadedSession.worktree` 타입 | 구현자 | 세션 로드·세션 확정 | patch 만 채우면 재시작 후 이름이 UUID 로 되돌아가고, load 만 채우면 첫 세션에서 이름이 바뀌는 순간을 사용자가 본다 |
| MD-03 / VP-09~VP-12 | diff 범위 해석은 두 채널이 **같은 함수** 를 쓴다. base 출처는 `managed_worktrees.base_oid` 하나다(D-021) (EP-07, 2지점: 요약 조회 · 본문 조회) | `git-diff.ts` 의 `resolveDiffRange` | 구현자 | 각 채널 진입 | 두 벌이 되면 목록은 base 대비인데 본문은 HEAD 대비가 되어 같은 화면의 두 숫자가 어긋난다 |
| MD-04 / VP-09 · VP-14 · VP-15 · VP-16 | 상한 절단과 잘림 표시 (EP-08, 3지점: 파일 목록 200 · 커밋 목록 100 · 본문 1 MiB) | `git-diff.ts` 상수 | 구현자 | 각 조회 정규화 | 절단 없이 내보내면 대형 저장소에서 IPC 페이로드가 `maxBuffer` 를 넘겨 조회 자체가 실패한다. 절단하고 표시하지 않으면 사용자가 전부 본 것으로 읽는다 |
| R-13 / VP-13 · VP-17 | 예시 표면 소멸 (EP-09, 2지점: `diffTileMock.ts` 파일 · `diffMockNotice` i18n 키 ko/en) | — | 구현자 | 제거 시 | 파일만 지우고 키를 남기면 `resources.test.ts` 는 통과하지만 죽은 키가 카탈로그에 남는다. 키만 지우고 파일을 남기면 실데이터 옆에 상수 import 가 살아 다음 사람이 어느 쪽이 정본인지 모른다 |

- 같은/동일 규칙이 여러 레이어에 있는 것: diff 범위 해석 하나뿐이고 `resolveDiffRange` 를 SSOT 로 둔다. 정규식·경로 규칙 복붙은 만들지 않는다.
- `실패 의미`에 “다른 게이트가 막는다”를 적은 행: 없음. 각 행의 실패 의미는 그 지점 자체의 관측 결과로 적었다.
- 선택적 필드의 의미. `LoadedSession.worktree` = `undefined` 는 “격리 세션이 아니거나 row 가 없다”이고 소비자는 실행 경로 파생으로 폴백한다(격리 여부를 별도 boolean 으로 두지 않는다 — 두 필드가 어긋날 수 있다). `GitDiffRequest.sessionId` = `undefined` 는 “세션 이전(랜딩)”이라 `HEAD` 범위다. `GitDiffRequest.commit` = `undefined` 는 `전체 변경`이다.
- 상호배타 상태는 discriminated union 으로 잠근다 — `GitDiffRange` 는 `{kind:'working', base}` \| `{kind:'commit', sha}`, `GitDiffFileContent` 는 `{kind:'text'…}` \| `{kind:'binary'}` \| `{kind:'unavailable', reason}`. 평면 boolean 조합(`isBinary && isTooLarge`)을 타입이 허용하지 않게 한다.
- 외부 SDK 경계: 없음. 이번 변경은 git CLI 와 Electron IPC 만 지난다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | 계약 | `WorktreePrepareStep` 유니온 · `worktree.preparing` variant · `LoadedSession.worktree` · `session.updated.patch.worktree` · diff DTO 5종 · 채널 2건 | 타입 |
| `app/src/shared/protocol.ts` | 스키마 | `GitDiffRequestSchema` · `GitDiffFileRequestSchema` (경로는 상대·`..` 금지) | 순수 단위 |
| `app/src/main/features/worktrees/service.ts` | 발생 | `prepare(input.onProgress?)` 4지점 호출 (`repo`·`base`·`branch`·`worktree`) | 기존 `service.test.ts` 에 콜백 수집 케이스 추가 |
| `app/src/main/app/chat-turn/prepare-worktree.ts` | 통과 + `session` 지점 | `onProgress` 를 service 로 넘기고, **신규 격리 분기에서만** worktree 확보 후 `session` 을 호출한다 — resume·recover·passthrough 분기는 부르지 않는다(D-005) | 기존 `prepare-worktree.test.ts` |
| `app/src/main/app/chat-turn/send.ts` | 발신 | `onProgress` → `sendChatEvent({type:'worktree.preparing', step})` | 기존 `send.worktree.test.ts` |
| `app/src/main/infra/git/git-diff.ts` (신규) | 읽기 | `resolveDiffRange` · `diffSummary` · `diffFile` · 상한 상수 | 임시 저장소 통합 + 정규화 순수 함수 |
| `app/src/main/infra/git/git-diff-parse.ts` (신규) | 순수 | numstat/`log` 출력 파싱 + 상한 절단 | 순수 단위 (git 미의존) |
| `app/src/main/app/handlers/git.ts` | 등록 | 채널 2건 + `sessionId` → `getManagedWorktreeBySession` 주입 | 기존 `git.test.ts` |
| `app/src/main/app/handlers/session.ts` | 전달 | `LoadedSession.worktree` 조립 | 통합(임시 DB) |
| `app/src/main/features/chat/turn-coordinator.ts` 또는 `history/writer.ts` 인접 | 전달 | `session.updated` patch 에 `worktree` 동봉 | 통합 |
| `app/src/preload/index.ts` | 노출 | `git.diffSummary` · `git.diffFile` | 타입 |
| `app/src/renderer/src/shared/api/ipc.ts` | 노출 | `gitApi.diffSummary` · `gitApi.diffFile` | 타입 |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | 상태 | `worktreePrepareStep` · `worktree` 필드 + 소멸 3지점 | 순수 리듀서 단위 |
| `app/src/renderer/src/features/chat/store/chatStore.ts` | 라우팅 | `worktree.preparing` 을 `pendingNewChatKey` 로 | 순수 라우팅 단위 |
| `app/src/renderer/src/features/chat/lib/activityLabel.ts` | 파생 | `prepareStep` 우선 분기 | 순수 단위 |
| `app/src/renderer/src/features/chat/components/StatusLine.tsx` | 표시 | `prepareStep` 라벨 렌더 | 렌더 단언 |
| `app/src/renderer/src/features/chat/components/CwdButton.tsx` | 표시 | 라벨은 `sourceCwd`, 클릭은 `cwd` | 순수 파생 + 렌더 |
| `app/src/renderer/src/features/chat/components/composer/gitRowState.ts` | 파생 | `gitRowView` 가 `repoRoot` 를 우선 읽는다 | 기존 `gitRowState.test.ts` |
| `app/src/renderer/src/features/chat/components/rightpanel/diffTileData.ts` (신규) | 순수 | `buildDiffTreeRows(files)` + 요약 상태 파생 | 순수 단위 |
| `app/src/renderer/src/features/chat/components/rightpanel/DiffTileContent.tsx` | 소비 | 실데이터 조회·펼침 상한·빈 상태·잘림 안내 | 렌더 (props-only View 유지) |
| `app/src/renderer/src/features/chat/components/rightpanel/diffTileTree.ts` | 타입 | `MockTreeRow` → `DiffTreeRow` | 기존 케이스 유지 |
| `app/src/renderer/src/features/chat/components/rightpanel/diffTileMock.ts` | 제거 | 삭제 | — |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | 단계 5 + diff 빈 상태/잘림/미리보기 불가 키 추가, `diffMockNotice` 제거 | `resources.test.ts` |
| `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md` | 문서 | 신규 채널 2 · 이벤트 1 행 추가 · 생성물 재생성 | 게이트 |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: `git-diff-parse.ts`(numstat·log 파싱과 절단 — `runGit` 미의존), `diffTileData.ts`(파일 목록 → 트리 행), `activityLabel.ts`(기존 순수 파일에 분기 추가), `gitRowState.ts`(기존 순수 파일). 각각 import graph 가 electron 을 물지 않는다.
- 기존 메커니즘 재사용 적합성: `sendChatEvent` 는 `sessionId` 없는 이벤트를 이미 보낸다(`message.queued` 선례) — 형상 적합. `shouldRefetchGitStatus` 는 `prevBusy && !nextBusy` 전이 판정이라 diff 재조회에도 그대로 맞다(시점 적합). `statusForCwd` 의 cwd 태그 폐기는 diff 요약에도 같은 형상으로 적용한다.
- 순서를 관측할 훅: `onProgress` 콜백 자체가 순서 관측 지점이다 — 테스트가 배열로 수집해 AT-01 의 순서 단언을 만든다. 별도 로그를 만들지 않는다.
- 임시 저장소 통합 테스트는 `mkdtemp` + `runGit` 실제 실행이다 — `worktree.test.ts`·`repository.test.ts` 가 이미 쓰는 형태다. Windows 러너에서 경로 구분자를 값으로 비교하지 않는다(0208 AT-29 선례).

## 12. End-to-end 영향

### producer → consumer

```text
service.prepare(onProgress)
  → send.ts sendChatEvent          [worktree.preparing]
  → chatStore.receive              [pendingNewChatKey 라우팅]
  → chatReducer.worktreePrepareStep
  → deriveActivityLabel            [prepareStep 우선]
  → StatusLine                     [한 줄 문구]

managed_worktrees row
  → handlers/session.ts (load) · session.updated patch (live)
  → chatReducer.worktree
  → CwdButton 라벨 · gitRowView repo

git CLI
  → git-diff.ts (범위 해석 + 절단)
  → handlers/git.ts
  → gitApi
  → DiffTileContent → DiffFileTree · DiffCommitList · DiffFileHeaders → DiffTable
```

- producer 기준: 단계는 “그 일을 시작하기 직전”에 발신한다(완료 시점이 아니다) — 사용자가 기다리는 동안 무엇을 기다리는지 읽어야 한다. diff 요약의 `added`/`removed` 는 git numstat 원값이고 미추적 파일만 renderer 가 아니라 main 이 줄 수로 채운다.
- consumer 파생 규칙: renderer 는 단계에서 문구만 고른다(순서·존재를 추론하지 않는다). 표시 이름은 `worktree` 가 있으면 그것, 없으면 실행 경로 폴백 — 두 값을 합성하지 않는다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: 확인함. renderer 는 `cwd` 에서 원본 이름을 역산할 능력이 없도록 원본 문자열을 받아서 쓴다(D-007). diff 의 `+N/−M` 총합을 git 행 값과 맞추려 하지 않는다 — 둘은 범위가 다르다(git 행은 HEAD 대비 미커밋, diff 타일은 base 대비)는 사실을 §5 상태 표가 갖는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `CHANNELS` 79 → 81 | `check-doc-inventory.mjs` 재생성 필요. preload 화이트리스트가 채널 리터럴을 열거하므로 두 곳 모두 추가 | §7-A 운영 gate 문서 인벤토리 행 |
| `NormalizedEvent` 21 → 22 | 이벤트를 `switch` 로 소비하는 곳이 새 variant 를 만난다 — `history/writer.ts`·`turn-coordinator.ts`·`chatStore.receive` 전수 확인 대상 | AT-01(라우팅) · AT-02(소멸) |
| `history/writer.ts` | 단계 이벤트는 **영속하지 않는다**(`message.queued` 와 같은 미영속 UI 신호) — writer 가 무시하는지 확인 | AT-01 |
| `LoadedSession` 소비자 | 필드 추가는 optional 이라 기존 소비자 무영향 — `LOAD_SESSION` 리듀서만 읽는다 | AT-08 |
| `gitRowView` 소비자 2곳 | 시그니처에 `repoRoot` 가 붙으면 `GitRow`·`DiffTileHeader` 둘 다 갱신 필요 | AT-06 · AT-07 |
| `diffTileTree.ts` | 타입 이름 변경이 기존 테스트에 닿는다 | AT-13(VP-17 회귀) |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 단계 상태는 `BEGIN_TURN` 에서 null 로 시작한다 — 이전 턴의 잔여가 새 턴 첫 프레임에 보이지 않는다.
- 취소/중단: 준비 중 `lease.controller.abort()` 가 걸리면 `service.prepare` 가 중단되고 더 이상 단계가 오지 않는다. 화면은 턴 종료 리셋으로 정리된다.
- 종료/quit/crash/renderer-gone: 단계 이벤트는 미영속이라 복구 대상이 아니다. 표시 이름은 DB row 이므로 재부팅 후 복원된다(AT-08).
- retry/timeout/partial failure: diff 조회는 재시도하지 않는다 — 다음 계기(타일 재열기·턴 종료)가 자연 재시도다(0206 D-004 와 같은 규칙).
- cleanup/rollback: 이번 변경은 새 부작용 자원을 만들지 않는다. 0209 의 worktree rollback 경로는 그대로다.
- **다중 저장소 쓰기**: 이번 변경의 쓰기 지점은 **0건**이다 — 단계 이벤트는 미영속, 표시 이름은 기존 row 읽기, diff 는 전부 읽기 전용(`runGit(..., {readOnly:true})`)이다. 0209 가 갖는 “worktree 생성 + DB insert” 2저장소 쓰기는 본 plan 이 건드리지 않는다. 산출 문서 축에서는 판정·상태가 `plan.md` 와 `INDEX.md` 두 곳에 산다 — 두 사본을 같은 턴에 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`. 요약 = 파일 200 × (경로 + 숫자 2 + status) ≈ 수십 KB. 커밋 100 × (sha + subject + author + 시각) ≈ 수십 KB. 본문 = 1회 1파일 × 각 측 1 MiB = 최대 2 MiB/호출. renderer 가 동시에 들고 있는 본문은 펼침 20개 상한이라 최악 40 MiB — 상한이 없으면 파일 200개 전부 펼쳤을 때 400 MiB 라 그 차이가 상한을 두는 이유다.
- 새 요청 수의 `원천 상한 × 배치 상한`. 요약은 조회 계기 3종 × 1 = 사용자 조작·턴 종료당 1회(폴링 0). 본문은 사용자 펼침당 1회. 준비 단계 이벤트는 격리 신규 세션당 정확히 5건이다.
- git 프로세스 수. 요약 1회 = `diff --numstat` 1 + `ls-files --others` 1 + (격리면) `log` 1 = 최대 3. 본문 1회 = `show` 1 + 파일 읽기 1. `runGit` 의 `maxBuffer` 는 본문 조회에서 4 MiB 로 명시한다(1 MiB 상한 × 안전 여유).
- 구조적 목표(줄/파일/모듈 수): 없음.
- 캐시/최적화로 잃는 부수 효과: 요약을 세션 상태에 캐시하면 외부에서 저장소를 바꿔도 화면이 낡는다 — 그래서 계기 3종을 두고 폴링을 두지 않는 선택이다(D-017). 늦게 도착한 응답은 cwd 태그로 버린다(`statusForCwd` 선례) — 이 규칙이 없으면 cwd 를 바꾼 뒤 옛 저장소의 diff 가 화면을 되돌린다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 외부/배포가 구현할 port·schema·config 를 만들지 않는다. 신규 계약은 전부 앱 내부 IPC 이고 그 정본은 `docs/IPC_CONTRACT.md` 다(§7-A 운영 gate).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| “diff 타일 데이터는 전부 예시다 — 실제 데이터가 붙을 때 이 파일만 사라지면 된다” | `diffTileMock.ts:7` (0206 D-010·D-011) | §6 범위 · D-018 · §11 제거 행 | **변경** — 그 조건(“배선할 IPC 가 없다”)이 본 plan 으로 끝난다. 예고된 종료다 |
| 0206 D-012 “예시 안내 문구가 그 사실을 말하는 유일한 자리” | `ko.ts:767` | D-018 · AT-13 | **변경** — 말할 사실이 사라지므로 문구도 사라진다 |
| 0206 D-014 “비교 대상은 현재 브랜치만 — base 를 알 채널이 없다” | `DiffTileHeader.tsx:13` | §6 비범위 | **유지** — 헤더 표기를 바꾸지 않는다. 본문의 범위만 실데이터가 된다 |
| 0206 D-004 “턴이 끝나는 전이에서만 다시 조회” | `gitRowState.ts:54` | D-017 | **유지** + 계기 1종(타일 열림) 추가. 폴링은 여전히 없다 |
| 0206 D-008 “저장소 이름은 git 루트에서 읽는다” | `gitRowState.ts:20` | D-007 · AT-06 | **변경** — worktree 에서 git 루트가 worktree 루트라 그 규칙이 원본 이름을 주지 못한다. 정본을 row 로 올린다 |
| 0206 D-019 “View 는 props 만 읽는다” | `DiffTable.tsx:4` | §11 `DiffTileContent` 행 | **유지** — 실데이터를 붙여도 세 View 의 props-only 계약을 지킨다 |
| 0209 D-001 “Adapter·SessionRuntime 은 worktree 를 모른다” | 0209 plan §3 | §9 TO-BE | **유지** — 단계 발신은 컴포지션 루트가 한다 |
| 0209 D-005 “untracked 를 모두 포함해 dirty 를 판정” | 0209 plan §3 | D-011 | **변경 없음(이미 대체됨)** — 0210 D-105 가 *거부*를 지웠다. 본 plan 은 untracked 를 *표시* 축에서만 쓴다 |
| 0210 D-104 “worktree 디렉토리는 `<repo>-<hash8>/<브랜치 slug>`” | 0210 plan §3 | §1 문제 (b) · D-007 | **유지** — 경로는 그대로 두고 표시 이름의 정본만 row 로 올린다 |
| 0210 D-105 “dirty source 를 거부하지 않는다” | 0210 plan §3 | D-004 · D-006 · §5 상태 표 | **유지** — `clean` 단계와 dirty 거부 행을 만들지 않는다 |
| 0210 D-101 “격리 ON 이면 브랜치 선택을 유예한다” | 0210 plan §3 | D-021 | **유지** — 유예 값은 `base_oid` 로 접혀 저장되므로 diff 가 그 하나만 읽는다 |
| 0210 D-107 “worktree 소실 시 source_cwd 로 폴백하고 영속” | 0210 plan §3 | D-020 · §5 상태 표 | **유지** — row 삭제가 표시 폴백을 자동으로 옳게 만든다 |
| 0210 D-109 “폴백 통지는 새 wire variant 없이 `patch.cwd` 로” | 0210 plan §3 | §10 EP-06 | **유지** — 본 plan 은 같은 `patch` 에 optional `worktree` 를 더할 뿐 새 variant 를 만들지 않는다 |
| 0209 D-008 “naming 실패는 fallback 으로 강등” | 0209 plan §3 | §5 상태 전이표 | **유지** — 실패해도 `worktree` 단계로 넘어간다 |
| main 레이어 규칙 “feature 는 electron 을 조립하지 않는다” | `app/src/main/AGENTS.md` | §9 핵심 책임 분리 | **유지** — `onProgress` 콜백으로 electron 의존을 `send.ts` 에 남긴다 |
| 읽기 IPC 무해 폴백 관례 | `handlers/git.ts:31` | §5 파생 UX error 행 | **유지** — diff 두 채널도 값 폴백이다 |
| “코드에서 셀 수 있는 수치를 문서에 적지 마라” | root `AGENTS.md` 원칙 4 | §7-A 운영 gate 문서 인벤토리 행 | **유지** — 수치는 생성물 재생성으로 반영한다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 대형 저장소에서 요약 조회가 느려 타일이 늦게 찬다 | 계기 3종만 두고 폴링을 만들지 않는다(D-017). 파일 200 상한이 페이로드를 묶는다(D-016) |
| 미추적 파일 포함이 `node_modules` 같은 대량 항목을 끌어온다 | `--exclude-standard` 로 `.gitignore` 를 존중한다. 그래도 넘치면 200 상한 + 잘림 표시로 접힌다 |
| 단계 이벤트가 준비 실패 순간과 경합해 마지막 단계가 남는다 | 소멸 지점 3곳을 §10 EP-04 로 못박고 VP-02 가 `error` 수신 소멸을 직접 단언한다 |
| `session.updated` patch 확장이 다른 소비자를 깨뜨린다 | optional 필드이며 `history/writer.ts`·`turn-coordinator.ts`·`chatStore` 전수 확인을 §12 표로 요구한다 |
| Windows 경로 구분자가 diff 경로 단언을 깬다 | git 은 경로를 `/` 로 준다 — main 이 그 형태를 그대로 계약으로 고정하고 테스트가 경로를 값으로 비교하지 않는다(0208 AT-29 선례) |
| 준비 단계 문구가 실제보다 오래 남아 정지처럼 보인다 | 기존 경과 카운터가 5초 뒤부터 함께 뜬다(`StatusLine.tsx` `showCounter`) — 문구는 바뀌지 않아도 시간은 흐른다 |

- 되돌리기 어려운 결정: IPC 채널 이름 2건(`orca:git:diffSummary`·`orca:git:diffFile`)과 이벤트 이름 1건(`worktree.preparing`) — 이름은 계약이므로 이 plan 이 확정한다. DTO 는 union 이라 이후 멤버 추가가 가능하다.
- 신규 의존성: 없음. git CLI·기존 IPC·기존 렌더 컴포넌트만 쓴다 → 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/ipc.ts` · `app/src/shared/protocol.ts`
- `app/src/main/features/worktrees/service.ts`
- `app/src/main/app/chat-turn/{prepare-worktree,send}.ts` (0210 이 방금 바꾼 파일 — 충돌 주의)
- `app/src/main/infra/git/{git-diff,git-diff-parse}.ts` (신규)
- `app/src/main/app/handlers/{git,session}.ts`
- `app/src/main/features/chat/turn-coordinator.ts` (patch 동봉 지점)
- `app/src/preload/index.ts` · `app/src/renderer/src/shared/api/ipc.ts`
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` · `store/chatStore.ts`
- `app/src/renderer/src/features/chat/lib/activityLabel.ts` · `components/StatusLine.tsx` · `components/CwdButton.tsx`
- `app/src/renderer/src/features/chat/components/composer/gitRowState.ts` · `GitRow.tsx`
- `app/src/renderer/src/features/chat/components/rightpanel/{DiffTileContent,DiffTileHeader,diffTileTree}.tsx|ts` · `diffTileData.ts` (신규) · `diffTileMock.ts` (삭제)
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md` (재생성) · `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md §feature 수직 슬라이스` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크 등 환경 제약: DB 스위트(`managed-worktrees.test.ts`·`worktree-bind.test.ts`·신규 `session:load` 통합)는 better-sqlite3 Node ABI 를 요구한다. egress 차단 환경이면 그 red 를 기준선으로 분리 보고한다.
- 기본 정적 게이트: `npm run lint` · `npm run typecheck` (ABI 중립).
- 관련 테스트: `./node_modules/.bin/vitest run` 로 비-DB 스위트, DB 동작이 필요한 pair(VP-08)는 `npm test`.
- 문서 게이트: `node scripts/check-doc-inventory.mjs` 재생성 후 `--check`.
- 사람 실기: 없음(§7 AC 검증 주의사항).

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 이번 턴 결정을 보존한다 — D-001~D-019 ACTIVE, 첫 턴이라 나머지 없음.
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §5 흐름·상태 표가 구현 방식 없이 결과를 말한다.
- [x] 조건절·이유절을 재해석하지 않았다 — 사용자 6줄 목록과 “한 줄 교체, 클로드 제품도 한 줄 교체이다”를 §2 에 원문으로 인용했다.
- [x] Product/UX 의 각 동작이 AC 와 Technical Design 에 연결된다 — §5 상태 표 20행이 AT-01~AT-15 와 §9 Delta 로 이어진다.
- [x] AS-IS 와 TO-BE 가 같은 축·구체성으로 있다 — 둘 다 entry/flow/state/consumer + 도식.
- [x] Delta 의 각 변경이 §11 파일 또는 AC 로 추적된다 — 11행 전부 V node + 파일/테스트를 갖는다.
- [x] AS-IS 에서 사라진 책임을 명시했다 — `diffTileMock` = 삭제(§9 TO-BE 주석).
- [x] 수치·전칭·앵커·기존 테스트 인용을 실측했다 — §8 전수 조사 9행 + 검산 4행.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다 — §7 표 3열.
- [x] Baseline V 를 썼고 근거를 적었다 — §7-A 첫 줄(두 기준선에 걸쳐 Delta V 불가).
- [x] 모든 NEW/CHANGED node 에 같은 레벨 REQUIRED pair 가 있다 — R-01~R-06·R-08~R-15 / SD-01~03 / AR-01~03 / MD-01~05.
- [x] 영향받은 INHERITED node 는 REGRESSION 이다 — R-07(VP-07) · MD-06(VP-17) · SD-04(VP-18) · SD-05(VP-19). NOT_REQUIRED 는 Baseline 이라 쓰지 않았다.
- [x] 각 pair 가 경로·§10 전수 분모·직접 oracle 을 갖고, 적대 증거를 고른 5건(VP-01·04·06·11·13)만 이유·변이를 갖는다.
- [x] 운영 gate 를 열거했고 무관한 기존 실패를 blocking 으로 만들지 않았다 — ABI 기인 DB red 는 기준선 분리(§19).
- [x] 사람 실기로 미룬 순수 로직이 없다 — §7 검증 주의사항에 “없다”와 근거.
- [x] semantic 목표를 structural proxy 만으로 검증하지 않는다 — AT-13 의 0건 스윕은 AT-09·AT-10 양성 단언과 짝지었다.
- [x] “X 가 쓰인다” 불변식의 장치가 X 제거·형제 교체에 실패한다 — VP-01 은 `base`↔`branch` 교체 변이, VP-04·VP-06 은 원본↔실행 경로 교체 변이를 등록했다.
- [x] 정책 파라미터의 단위/범위가 명확하고 불가능 조합을 타입이 막는다 — §10 의 두 discriminated union, 상한 단위(개·MiB).
- [x] 참조 구현 union/enum coverage — §10 이 `WorktreePrepareStep` 5멤버·`GitDiffRange` 2멤버·`GitDiffFileContent` 3멤버를 전수 나열한다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam 이 있다 — §10 9행 · §11 테스트 가능성.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 6행(채널·이벤트·writer·LoadedSession·gitRowView·diffTileTree).
- [x] producer/consumer 양쪽 의미를 확인했다 — §12 producer 기준·consumer 파생 규칙·우회 점검.
- [x] 상한·총량·one-way door 를 계산했다 — §14 · §17 되돌리기 어려운 결정(이름 3건).
- [x] 게이트 명령이 대상 subtree 의 현재 `AGENTS.md` 와 충돌하지 않는다 — §19 가 ABI 중립 둘을 기본으로 두고 `npm test` 를 DB 필요 시로 한정한다.
- [x] 본문 완성 후 Decision Ledger 와 교차검증했고 대조 결과를 §3 갱신 메모에 적었다 — 충돌 0.
- [x] 산출물 문장 규칙을 지켰다 — 판정 먼저, 한 줄 한 관측, Part I 은 결과·Part II 는 경로.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: Decision·AC·§10 을 계약으로 수행했다. 설계가 전제한 세 가지가 코드에서 그대로 성립했다 — `sendChatEvent` 의 sessionId 없는 발신(`message.queued` 선례) · `managed_worktrees` 의 네 값 · `DiffTable` 의 `{oldValue,newValue}` 계약.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision 과 충돌하는 설계 발견: 없음. 다만 §11 의 전달 지점 하나가 레이어 규칙과 충돌했다(아래 §설계 대비 명시적 차이).

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·03·18 | 단계 5종 1회씩 | EP-01 `repo`·`base`·`branch`·`worktree`(service 4) + `session`(prepare-worktree 1) | 5/5 | `rg "onProgress\?\.\(" app/src/main` → `service.ts:90·106·119·133` + `prepare-worktree.ts:80` = 5건. 케이스 `다섯 단계가 이 순서로 정확히 1회씩 온다` → `['repo','base','branch','worktree','session']` | — |
| VP-01 | 이벤트 라우팅 | EP-02 `chatStore.receive` sessionId 없는 분기 (1) | 1/1 | `rg "worktree.preparing" chatStore.ts` → 1건(`:399`) | — |
| MD-01/VP-01 | 단계가 라벨을 이긴다 | EP-03 `deriveActivityLabel` 반환 조립 (1) | 1/1 | `activityLabel.ts:46` 조기 반환. 케이스 `활동 사실이 있어도 단계가 이긴다` → `status==='preparing'` · `facts===[]` | — |
| VP-02 | 단계 상태 소멸 | EP-04 `BEGIN_TURN` · `session.updated` · `TURN_END_RESET` (3) | 3/3 | `rg "worktreePrepareStep: null" chatReducer.ts` → `:261`(초기값)·`:307`(TURN_END_RESET)·`:414`(BEGIN_TURN)·`:470`(session.updated). 소멸 케이스 3건이 지점마다 따로 단언 | — |
| VP-04·05·06·07·19 | 이름=원본, 동작=실행 경로 | EP-05 `CwdButton` 라벨/클릭 · `gitRowView` repo (2) | 2/2 | `CwdButton.tsx:32` 라벨=`cwdDisplayName` · `:40` 클릭=`openPath({path: cwd})`. `gitRowState.ts:49` repo=`repoDisplayName(status.root, worktree)` | — |
| VP-04·06·08 | 표시 정본 전달 | EP-06 `session:load` 조립 · `session.updated` patch (2) | 2/2 | `handlers/session.ts:88` row→`worktree` · `send.ts:206` `onSessionConfirmed`→`patch.worktree`. 케이스 `session.updated 의 worktree 를 담는다` green | resume 왕복(VP-08)은 ABI 차단 |
| VP-09~12 | 범위 해석 SSOT | EP-07 요약 조회 · 본문 조회 (2) | 2/2 | `rg "await resolveDiffRange\(input\)" git-diff.ts` → `:112`(요약)·`:181`(본문) 2건이 같은 함수. 본문만 우회하는 변이 M5 가 red | — |
| VP-09·14·15·16 | 상한과 잘림 표시 | EP-08 파일 200 · 커밋 100 · 본문 1 MiB (3) | 3/3 | `git-diff-parse.ts` 상수 3종. 경계 양쪽 케이스(200/201 · 100/101) + `too-large` | — |
| VP-13·17 | 예시 표면 소멸 | EP-09 `diffTileMock.ts` 파일 · `diffMockNotice` ko/en (2) | 2/2 | 파일 부재(`ls rightpanel/ | grep -i mock` → `diffTileMockRemoved.test.ts` 하나). 스윕 5케이스: import 0건 · 카탈로그 2개를 집었고 그 안에 키 0건 · 호출부 0건 | — |

- §10 에 없는데 같은 불변식이 필요했던 지점: 없음. 다만 §11 이 지정하지 않은 **새 전달 홉**을 하나 만들었다 — `TurnContext.onSessionConfirmed`(아래 #1). 현재 pair·Decision·AC 로 닫히므로 `PLAN_GAP` 이 아니다.

**V-pair 자기확인** — 구현자의 `SELF_PASS` 는 독립 검증의 `PASS` 가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | 단계 배열 5건 순서 일치 | required — M1(`base`↔`branch` 맞바꿈) red · M2(`worktree` 제거) red |
| VP-02 | REQUIRED | SELF_PASS | 거부 시 `['repo']`, 소멸 3케이스 | not selected — 발신된 이벤트를 직접 관측 |
| VP-03 | REQUIRED | SELF_PASS | 비격리·resume 각 발신 0건 | not selected — 직접 0건 관측 |
| VP-04 | REQUIRED | SELF_PASS | 하위/루트 두 입력에서 `app`·`orca-skin` | required — M3(라벨이 실행 경로) red |
| VP-05 | REQUIRED | SELF_PASS | `CwdButton.tsx:40` 인자 = `cwd` | not selected — 인자값 직접 관측 |
| VP-06 | REQUIRED | SELF_PASS | worktree 상태 입력에서 `orca-skin` | required — M4(worktree 루트 사용) red |
| VP-07 | REGRESSION | SELF_PASS | `gitRowState.test.ts` 기존 케이스 green | not selected — 기존 oracle 재실행 |
| VP-08 | REQUIRED | **SELF_BLOCKED** | 케이스 작성 완료, better-sqlite3 ABI 로 실행 불가 | not selected |
| VP-09 | REQUIRED | SELF_PASS | 추적 1 + 미추적 1 = 2건, base kind 가 row 유무로 갈림 | not selected — 실제 저장소 상태와 직접 비교 |
| VP-10 | REQUIRED | SELF_PASS | old/new 가 base 시점·작업 트리와 문자열 동일 | not selected |
| VP-11 | REQUIRED | SELF_PASS | sha1 → `v0`→`v1`, 전체 범위 → `v0`→`v2-worktree` | required — M5 red (**초회 green, 아래 잠금 표**) |
| VP-12 | REQUIRED | SELF_PASS | row 있으면 2건·subject 일치, 없으면 0건 | not selected — 양·음 두 입력 |
| VP-13 | REQUIRED | SELF_PASS | import 0 · 키 0 · 호출부 0 (+분모 검사 2건) | required — M6(mock import 부활) red |
| VP-14 | REQUIRED | SELF_PASS | `null`→loading, `{files:[]}`→empty 등 4분기 | not selected |
| VP-15 | REQUIRED | SELF_PASS | 200/201 · 100/101 경계 양쪽 | not selected — 경계값 직접 산출 |
| VP-16 | REQUIRED | SELF_PASS | depth·단독 디렉토리 압축·정렬 5케이스 | not selected |
| VP-17 | REGRESSION | SELF_PASS | `diffTileTree.test.ts` 4케이스가 새 타입에서 그대로 green | not selected |
| VP-18 | REGRESSION | SELF_PASS | `prepare-worktree.test.ts` 6케이스 green | not selected |
| VP-19 | REGRESSION | SELF_PASS | 폴백 patch 뒤 `worktree === null` | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `service.ts:106·119` — `base`↔`branch` 발신 자리 **맞바꿈** | VP-01 선택 증거 | 최초 | `다섯 단계가 이 순서로 정확히 1회씩 온다` 1건 | 잠김 |
| `service.ts:133` — `worktree` 발신 1건 제거 | VP-01 선택 증거 | 최초 | 같은 케이스 1건 | 잠김 |
| `worktreeDisplay.ts:27` — 라벨이 `sourceCwd` 대신 `cwd` | VP-04 선택 증거 | 최초 | `저장소 루트를 고른 세션은 원본 저장소 이름을 그린다` 1건 | 잠김 |
| `worktreeDisplay.ts:40` — 저장소 이름이 `repoRoot` 대신 `root` | VP-06 선택 증거 | 최초 | `worktree 루트가 아니라 원본 저장소 루트를 읽는다` 1건 | 잠김 |
| `git-diff.ts:181` — 본문만 범위 해석 우회(working 복귀) | VP-11 선택 증거 | 최초 | **초회 0건(green)** → fixture 보강 뒤 `커밋 범위의 본문은 …` 1건 | 잠김(보강 후) |
| `diffTileData.ts` — 삭제한 mock 을 되살려 import | 새 oracle(0건 스윕) 민감도 | 최초 | `예시 데이터 모듈을 import 하는 파일이 없다` 1건 | 잠김 |

- **분모 검산**: `선택 증거 5(VP-01×2 · VP-04 · VP-06 · VP-11) · 인용 변이 0 · 새 oracle 1(VP-13 스윕) = 표 행 6`.
- **덮개 회귀**: 라운드 1이라 이전 red→green 전이는 없다. 0206 이 잡던 자리가 **두 곳에서 좁아졌고 둘 다 적는다** — ① `diffTile.render.test.ts` 의 래퍼 기본 접힘 단언은 SSR 첫 프레임에 데이터가 없어 `<table> 0 · aria-expanded="true" 0` 으로 좁아졌다(데이터가 있는 상태의 기본 접힘은 AT-17 이 계속 본다). ② 0206 AT-12(예시 표식)는 D-018 이 끝냈고 그 자리에 소멸 단언 2건을 두었다.
- **VP-11 초회 green 의 의미**: fixture 의 작업 트리가 마지막 커밋과 같아 두 범위가 같은 답을 냈다. plan 이 이 변이를 **등록해 두지 않았다면** 그 우연한 일치는 이 라운드에서 보이지 않았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있다 | 단계 5문구 → `StatusLine`(`PendingAssistant` 경유) · diff 문구 6종 → `DiffTileContent`. ko/en 양쪽 등록, `resources.test.ts` 패리티 green |
| seam 을 만들려고 production 을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 있음 — 문제 없음 | `send.ts` 의 `worktreeDisplay` 는 `try` 블록의 `let` 이고 `buildTurn` 콜백이 읽는다. `prepareTurnExecution` 이 `buildTurn` 을 **prepare 이후**에 부르므로 대입 순서가 보장된다(`prepare-worktree.ts:87`). `leaderTurn`·`leaderRuntime` 정리 경로는 건드리지 않았다 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 대부분 있다 · **한 행은 없었다** | 준비 거부 4종·조회 실패·상한 초과·binary·펼침 상한은 §5 표에 있다. **요약 도착 전 우측 영역이 통째로 비는 상태는 표에 없었고**, 그것이 아래 #2다 |
| 실패가 화면에서 "아무 일도 안 일어남" 으로 보이지 않는가 | 보이지 않는다 | 조회 실패는 loading 유지 → 다음 계기가 재시도 · 본문 실패는 사유 문구 3종 · 준비 거부는 기존 error 문구 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 되돌리지 않는다 | 요약은 `JSON.stringify([cwd,sessionId,commit])` 키로 옛 응답을 렌더에서 버린다. git 행은 기존 `statusForCwd` 그대로 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 표시 정본을 **언제** renderer 로 보낼지 §11 이 지정하지 않았다. 준비 시점에는 sessionId 가 없고 `session.updated` 는 어댑터가 만드는 이벤트라 main 이 필드를 얹을 자리가 없었다. | ✅ 선조치 — `TurnContext.onSessionConfirmed` 훅을 신설하고 coordinator 가 `registry.promote` 와 같은 자리에서 부른다. | `turn-coordinator.ts:325` · `send.ts:206` |
| 2 | 요약 도착 전 우측 파일 영역을 아예 그리지 않아 **영역 마커조차 없는 빈 칸**이 됐다. 0206 이 잠근 3영역 배치 계약 위반이고 사용자에게는 "아무 일도 안 일어남" 이다. | ✅ 선조치 — 항목 영역을 항상 그리고 상태 문구만 위에 얹는다. 0206 의 레지스트리 배선 케이스가 이것을 red 로 잡았다. | `DiffTileContent.tsx` · `diffTile.render.test.ts` 등록 배선 케이스 |
| 3 | `DistributiveOmit<NormalizedEvent, 'sessionId'>` 의 제약이 유니온 **공통 키**만 허용해, `sessionId` 없는 variant 가 하나 생기자 mock 시나리오가 컴파일 실패했다. | ✅ 선조치 — 제약을 `PropertyKey` 로 낮췄다. `Omit` 자체는 키가 아닌 값도 받으므로 동작은 그대로다. | `mock-scenarios.ts:22` |
| 4 | `registerGitHandlers()` 가 인자를 받지 않아 base 조회 포트를 넣을 자리가 없었다. optional 로 두면 배선을 잊었을 때 **모든 세션이 조용히 HEAD 범위**로 떨어진다. | ✅ 선조치 — 필수 인자로 만들어 컴파일이 배선을 강제한다. | `handlers/git.ts:29` · `bootstrap.ts:874` |
| 5 | `scripts/check-doc-inventory.mjs` 의 진입 가드가 `import.meta.url === file://${process.argv[1]}` 라 **Windows 에서 참이 되지 않는다** — CLI 로 부르면 아무것도 하지 않고 exit 0 이라 생성물이 낡은 채로 넘어갈 수 있다. | ⚠️ 보고만 — 이번엔 `runCli` 를 직접 import 해 재생성했다. 스크립트 수정은 이 handoff 범위 밖이고, CI(windows-latest)의 `--check` 경로에도 같은 가드가 걸리는지 별도 확인이 필요하다. | `scripts/check-doc-inventory.mjs:439` |
| 6 | 이 저장소의 작업 트리를 **다른 세션이 동시에 쓴다**. 구현 중 브랜치가 `handoff/0211…` → `main` 으로 외부에서 전환됐다. 커밋 전 변경은 이번엔 살아남았지만 다음에는 잃을 수 있다. | ⚠️ 보고만 — 작업 트리 분리 여부는 사용자 판단이다. | `git reflog` `HEAD@{0}`: `checkout: moving from handoff/0211-worktree-session-ux to main` |

### 설계 대비 명시적 차이

- plan 이 지정한 것과 다르게 구현한 것과 그 이유: **1건**. §11 은 `session.updated` patch 동봉 지점을 `features/chat/turn-coordinator.ts` 로 적었으나, coordinator 가 worktree 를 알면 0209 D-001(“Adapter·SessionRuntime 은 worktree 를 모른다”)의 취지와 main 레이어 규칙(feature 는 컴포지션 루트를 모른다)을 깬다. 대신 **턴-국소 훅**을 신설해 coordinator 는 훅을 부르기만 하고 내용은 컴포지션 루트가 채운다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 훅의 수명이 `TurnContext` 와 같고 턴이 끝나면 함께 사라진다. 별도 만료 축이 없다. | EP-06 2지점 재확인: `send.ts:206`(live) · `handlers/session.ts:88`(resume) |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | **있다** — `makeContinuationTurn` 이 자동 연속 턴의 `TurnContext` 를 새로 만들며 훅을 계승하지 않아 연속 턴에서는 발화하지 않는다. 이번 요구에는 옳다(세션 id 확정은 첫 턴 1회이고 연속 턴은 이미 id 를 안다). | `turn-context.ts:206` 이 `onSessionConfirmed` 를 복사하지 않음을 확인. AT-04 는 첫 턴 경로만 요구한다 |
| 재진입 | 해당 없음 — coordinator 가 `session.updated` 를 받는 자리는 새 세션당 1회이고 `registry.promote` 와 같은 지점이다(0067 AC9 가 이미 1회를 잠갔다). | `turn-coordinator.ts:323` 분기 안, promote 직후 |
| 다른 무효화 축 | **있다** — worktree 소실 폴백(0210 D-107)이 `patch.cwd` 만 보내므로 표시 정본이 그때 무효화돼야 한다. 리듀서가 `patch.cwd` 단독 갱신에서 `worktree` 를 null 로 내린다(D-020). | 케이스 `worktree 소실 폴백(patch.cwd 만)은 표시 정본을 지운다` green · `chatReducer.ts:470` |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 수정 36 · 신규 13 · 삭제 1 = **50** (`git status --short` 50줄) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npx vitest run` · `node -e "import('./scripts/check-doc-inventory.mjs').then(m=>m.runCli([],process.cwd()))"` |
| **관측한 게이트 산출**(exit code 아님) | **lint** 0 error / 1 warning(기존분 — `useTranscriptVirtualizer.ts:22` react-hooks/incompatible-library). **typecheck** 3구성 0줄. **vitest** 284파일 2772케이스 → **2713 pass · 52 fail · 7 skip**, 실패 **전건이 better-sqlite3 ABI**(`NODE_MODULE_VERSION 140 vs 127`) — 9파일 전부 DB 로드, 비-ABI 실패 **차집합 0건**. **doc gate** 재생성 후 `ipc-documentation.test.ts` 3케이스 · `handlers/git.test.ts` 4케이스 green |
| V-pair 자기확인 | `SELF_PASS 18 · SELF_BLOCKED 1`(VP-08 — ABI); pair별 상세는 위 표 |
| 강제 지점 전수 | **21/21** (EP-01 5 · EP-02 1 · EP-03 1 · EP-04 3 · EP-05 2 · EP-06 2 · EP-07 2 · EP-08 3 · EP-09 2) |
| **AC 자기보고**(`Criteria-Met`) | **14/15** — ✅ AT-01(단계 배열 5건 일치) · AT-02(`['repo']` + “Git 저장소가 아닙니다.”) · AT-03(발신 0건 ×2) · AT-04(`app`·`orca-skin`) · AT-05(`openPath` 인자=cwd) · AT-06(`orca-skin`) · AT-07(기존 케이스 green) · AT-09(2건 · base kind 분기) · AT-10(old/new 문자열 일치) · AT-11(sha1 → `v0`→`v1`) · AT-12(2건 / 0건) · AT-13(import 0 · 키 0 · 호출부 0) · AT-14(4분기) · AT-15(200/201 · 100/101 · too-large). ⚠️ **AT-08** — 케이스는 있으나 ABI 로 미실행 |
| **합계 검산** | `✅ 14 · ⚠️ 1 · ❌ 0 = 총 15` (AC 총수 재계수: §7 표 15행) |
| 블로커 / 역질문 | 없음. AT-08 은 환경 제약이며 CI(windows-latest, egress 열림)에서 확인된다 |
| 대상 커밋 | `(라운드 1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 라운드 1이라 해당 없음.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가, 있었다면 왜 안 걸렸는가: **VP-11 초회 green** 은 plan 이 변이를 등록해 둔 덕에 드러났다 — 지침이 작동한 사례다. 반대로 §11 이 전달 지점을 coordinator 로 적은 것은 §16 이 “0209 D-001 유지” 라고 적어 두고도 잡지 못했다: 관계표가 *유지*만 선언하고 그 결정이 §11 의 어느 행을 제약하는지는 잇지 않았다.
- 반복해서 부딪히는 환경 한계: ① better-sqlite3 ABI(Electron 140 vs Node 127) — `pretest` 재빌드가 실패해 DB 스위트 9파일이 항상 red. ② 실 git 을 쓰는 스위트가 전체 병렬 실행에서 간헐 실패 — `git-cli.test.ts` 2건이 한 번 red 였고, 격리 재실행 18/18 green · 기준선(origin/main) 도 18/18 green 이었다. 이번 변경이 git 프로세스 부하를 늘린 것이 배경으로 보인다.
- 현재 라운드 수: 1

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
