# Plan — 0211-worktree-session-ux

## 메타

| 항목 | 값 |
|---|---|
| slug | `0211-worktree-session-ux` |
| 작성자 | Claude Code |
| 일자 | 2026-08-30 (V1) · 2026-08-31 (ΔV1) |
| 매핑 | 0209·0210 격리 기능의 사용자 대면 잔여 3건 (준비 안내 · 표시 이름 · diff 실데이터) + 라운드 1 사용자 피드백 3건 (표시 정본 소멸 · 변경량 출처 · 조회 계기) |
| 상태 | READY |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | `V1` @ `0d8cf037` (ΔV1 의 기준) |
| 이번 V revision | `ΔV1` |
| 유효 V | `V1 + ΔV1` |

> **ΔV1 진입 사유**(2026-08-31). 라운드 1 구현물을 사용자가 실기하고 3건을 지적했다 — 그중 둘은
> **사용자 결정 변경**(D-009·D-011·D-017 대체)이고 하나는 **계획 누락**(2턴 시퀀스를 보는 oracle 부재)이다.
> 라운드 1의 verify 는 아직 수행되지 않았다 — 이 갱신은 `verify/FAIL` 이 아니라 **설계 입력**이고
> 라운드 수를 올리지 않는다(사용자 명시: “사용자 변심과 피드백이기 때문에 턴 증가가 아니다”).

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

### ΔV1 — 라운드 1 실기 후 사용자 피드백 (2026-08-31)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “워크트리 활성화 후 턴 시작시, transcript 상단의 타이틀 우측의 디렉토리 버튼과 composer의 git 패널스택의 디렉토리 경로가 요구했던대로 버튼 텍스트가 사용자가 지정했던 경로의 basename으로 출력되었다. 그러나 두번째 메시지 턴 이후에는 실제 디렉토리 경로(워크트리 브랜치)의 basename으로 변경되고 있다.” | 피드백 §1 |
| 명시 요구 | “매번 확인하고 랜더링하는것인지, 실제로 그렇다면 성능 저하이며 불필요하다. 다른 문제라면 역시 잘못된 점을 찾아 검토하라.” | 피드백 §1 |
| 명시 요구 | “composer의 git 패널스택의 diff 표시가 부정확하다. 실제로는 변경사항이 있는데도 '+0-0' 표시가 발생하고 있다. 또한 실제 표시내용도 우측 패널과 차이가 있다.” | 피드백 §2 |
| 명시 요구 | “참고로 untracked file은 수치에 추가하지 않도록 변경하겠다.” | 피드백 §2 |
| 명시 요구 | “composer의 git 패널 스택의 diff와 우측패널의 git 동작이 버튼 이벤트마다 매번 발생하고 있다. … 메시지 완료시에 git 상태를 저장하고, 이를 렌더러에서 한번만 전체 렌더링 하는것으로 해야겠다. 클릭시 매번 git 동작을 프로세싱하니 사용자 경험을 해친다.” | 피드백 §3 |
| 명시 요구 | 대안 승인 — “제안한 대안으로 plan을 업데이트하라.” (§1 키 유무 판정 · §2 단일 출처 + untracked C-1 · §3 store 소유 + 마운트 계기 제거) | 피드백 후속 턴 |
| 명시 요구 | “이것은 사용자 변심과 피드백이기 때문에 턴 증가가 아니다.” | 피드백 후속 턴 |
| 추론 의도 | §1 의 “성능 저하” 가설은 사용자가 스스로 조건절(“실제로 그렇다면”)을 달았다 — 원인 규명이 요구이고 성능은 그 가설 중 하나다. | 조사 결과 원인은 상태 소멸이었다(§4 ΔV1) |

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
| D-009 | git 행의 **브랜치와 변경량은 worktree 실측 그대로** 둔다. | 그것이 이번 격리 세션의 진짜 작업이고 사용자가 문제 삼은 것은 “프로젝트 텍스트” 하나다. | 사용자 요구 범위 | **SUPERSEDED** | → D-025 (변경량 축만 대체 — 브랜치 축은 D-025 가 같은 문장으로 승계) |
| D-010 | diff 비교 범위는 두 종류다. 격리 세션 = `base_oid` → 현재 작업 트리, 비격리 세션 = `HEAD` → 현재 작업 트리. | 사용자 선택 둘. 비격리 세션에는 base 를 알 채널이 없어 가짜 base 를 만들지 않는다. | 사용자 명시 | ACTIVE | — |
| D-011 | 미추적 파일(`ls-files --others --exclude-standard`)도 diff 목록에 넣고 전량 추가로 센다. | 에이전트가 만든 새 파일은 커밋 전까지 untracked 라, 빼면 “브랜치에서 작업된 내용”이 조용히 비는 경우가 생긴다. 0209 D-005 가 같은 축에서 untracked 를 유의미로 판정했다. | 추론 의도 + 선례 | **SUPERSEDED** | → D-026 (“센다” 절만 반전 — “목록에 넣는다” 절은 D-026 이 승계) |
| D-012 | 커밋을 고르면 그 커밋 하나의 변경(`<sha>^` → `<sha>`)을 본다. `전체 변경`은 D-010 의 범위다. | UI 에 이미 선택 축이 있다(`DiffTileContent.tsx:93` 의 `aria-pressed` 토글). 실데이터를 붙이면서 선택만 죽은 버튼으로 남기지 않는다. | 파생 정책 | ACTIVE | — |
| D-013 | 커밋 목록은 격리 세션에서만 채워진다(`base_oid..HEAD`). 비격리 세션은 `전체 변경` 하나만 남는다. | D-010 이 비격리에 base 를 주지 않으므로 “이 세션의 커밋” 을 셀 수 없다. | D-010 파생 | ACTIVE | — |
| D-014 | diff 데이터는 IPC **둘**이다 — 요약(파일 목록 + 커밋 목록)과 파일 본문. 본문은 파일을 펼칠 때만 부른다. | 0206 D-017 이 파일 항목을 기본 접힘으로 고정했다. 요약에 본문을 실으면 열자마자 저장소 전체를 읽는다. | 기존 계약 + 상한 | ACTIVE | — |
| D-015 | 파일 본문은 old/new **전문 두 벌**이다. unified patch 를 돌려주지 않는다. | 소비자 `DiffTable` 의 계약이 `{oldValue,newValue}` 다(`DiffTable.tsx:9`). patch 를 주면 renderer 에 파서를 새로 만들어야 한다. | 소비자 계약 | ACTIVE | — |
| D-016 | 상한은 파일 200 · 커밋 100 · 파일 본문 각 측 1 MiB · 동시 펼침 20 이다. 넘으면 잘라내고 **잘렸다는 사실을 값으로** 돌려준다. | 저장소 크기에 상한이 없다. 조용히 자르면 사용자가 diff 를 전부 본 것으로 읽는다. | 파생 정책 | ACTIVE | — |
| D-017 | diff 조회 계기는 **셋**이다 — 타일이 열릴 때 · cwd 변경 · 턴 종료 전이. 새 폴링을 만들지 않는다. | 뒤 둘은 git 행이 이미 쓰는 계기다(0206 D-004, `GitRow.tsx` 의 `shouldRefetchGitStatus`). 앞 하나만 새로 붙는다. | 기존 계약 승계 | **SUPERSEDED** | → D-028 (“타일이 열릴 때” 를 계기에서 뺀다 — 나머지 둘과 폴링 금지는 D-028 이 승계) |
| D-018 | `diffTileMock.ts` 와 `chat.rightpanel.diffMockNotice` 를 삭제한다. | 0206 이 “실제 데이터가 붙을 때 이 파일만 사라지면 된다”고 적었다(`diffTileMock.ts:7`). 남기면 예시 문구가 실데이터 위에 뜬다. | 기존 계약 승계 | ACTIVE | — |
| D-019 | DB 스키마를 바꾸지 않는다. 마이그레이션 0건. | 필요한 네 값(`source_cwd`·`repo_root`·`base_oid`·`branch`)이 `managed_worktrees` 에 이미 있다. | 조사 결과 | ACTIVE | — |
| D-020 | worktree 소실 폴백(0210 D-107) 뒤에는 표시 이름이 **원본 경로 파생으로 자연 복귀**한다. 폴백 전용 표시 분기를 만들지 않는다. | 그 폴백은 managed row 를 삭제하고 `sessions.cwd` 를 `source_cwd` 로 갱신한다 — row 가 없으면 D-007 의 정본이 사라지고 실행 경로가 곧 원본이라 폴백 파생이 정답을 준다. 분기를 만들면 같은 결과를 두 경로로 계산한다. | 0210 D-107 파생 | ACTIVE | — |
| D-021 | 격리 세션의 diff base 는 `managed_worktrees.base_oid` 이고, 그 row 가 없으면(비격리·폴백 후) `HEAD` 다. 유예 브랜치(`worktreeBaseRef`)를 renderer 가 따로 읽지 않는다. | 0210 D-101 의 유예 브랜치는 이미 `base_oid` 로 접혀 저장된다(`service.ts:92`~) — 두 번째 출처를 만들면 갈라진다. | 0210 D-101 파생 | ACTIVE | — |
| D-022 | `session.updated` 의 표시 정본 판정은 **`worktree` 키의 유무**로 한다. 값이 아니다 — 키가 없으면 기존 상태를 보존하고, 키가 있으면 그 값(`null` 포함)으로 덮는다. | `patch.cwd` 유무로 판정하던 V1 규칙이 SDK `system/init` 과 충돌한다: 그 이벤트가 매 턴 `patch:{cwd}` 를 보내(`claude-map.ts:185`) 폴백 통지와 wire 상 **구분 불가**다. 키 축은 두 신호를 구분한다. | 조사 결과 | ACTIVE | — |
| D-023 | 0210 D-107 폴백 통지는 `patch: { cwd, worktree: null }` 을 **명시 발신**한다. | D-022 가 키를 판정 축으로 바꾸면 폴백은 스스로 키를 실어야 한다. 이 한 지점이 D-020(폴백 후 원본 복귀)의 유일한 발화점이다. | D-022 파생 | ACTIVE | — |
| D-024 | resume 턴은 표시 정본을 **재발신하지 않는다**. 전달 지점은 V1 의 둘(`session:load` · 신규 격리 확정) 그대로다. | 매 턴 재발신은 턴마다 DB 조회를 새로 만들면서 1턴째 깜빡임(`emit` → `onSessionConfirmed` 순서)은 고치지 못한다. D-022 가 소멸 자체를 없애므로 재발신이 필요 없다. | 파생 정책 | ACTIVE | — |
| D-025 | 컴포저 git 행의 **변경량은 diff 요약의 합계**를 읽는다. **브랜치는 worktree 실측 그대로**다(D-009 승계). | 사용자 명시 — “실제 표시내용도 우측 패널과 차이가 있다”. 두 표면이 다른 명령(`diff HEAD --shortstat` vs `diff <base_oid> --numstat`)을 쓰는 한 일치는 우연이고, 격리 세션에서 에이전트가 커밋하면 앞의 값이 `+0−0` 이 된다. | 사용자 명시 | ACTIVE | D-009 를 대체 |
| D-026 | 미추적 파일은 **목록에 남고 변경량은 0** 이다 — `added`/`removed` 에 기여하지 않는다. | 사용자 명시 — “untracked file은 수치에 추가하지 않도록 변경하겠다”. 목록에서까지 빼면 에이전트가 만든 새 파일이 화면에서 사라져 D-011 의 근거(“조용히 비는 경우”)가 되살아난다. | 사용자 명시 | ACTIVE | D-011 을 대체 |
| D-027 | `GitStatus.dirty` 를 DTO 에서 **제거**한다. `gitStatus()` 는 `diff HEAD --shortstat` 을 더 이상 돌리지 않는다. | D-025 로 프로덕션 소비자가 0이 된다(현재 유일 소비자 `gitRowState.ts:53-54`). checkout 의 dirty 게이트는 자기 `dirtyStat` 을 따로 부르므로(`git-cli.ts:121`) 능력은 남는다. 값을 남기면 다음 사람이 어느 것이 표시 정본인지 모른다. | 파생 정책 | ACTIVE | — |
| D-028 | diff 요약 조회 계기는 **둘**이다 — cwd/세션 변경 · 턴 종료 전이. **타일 열림은 계기가 아니다.** 폴링은 여전히 없다. | 사용자 명시 — “클릭시 매번 git 동작을 프로세싱하니 사용자 경험을 해친다”. 커밋 선택은 사용자가 **다른 범위**를 요구한 것이라 계기가 아니라 질의 축이다(D-012) — 그것은 그대로 조회한다. | 사용자 명시 | ACTIVE | D-017 을 대체 |
| D-029 | diff 요약과 선택 커밋은 **세션 상태**가 소유한다. `DiffTileContent` 로컬 `useState` 에 두지 않는다. | 사용자 명시 — “렌더러에서 한번만 전체 렌더링”. 타일은 `tiles` 배열에서 조건 렌더라 닫으면 언마운트되고(`RightPanel.tsx:168`~) 로컬 상태가 소멸한다 — 계기를 줄여도 마운트가 계기인 한 반복된다. 펼침·본문은 로컬로 남긴다(기본 접힘이라 재열기 시 조회 0). | 사용자 명시 | ACTIVE | — |
| D-030 | diff 타일 헤더에 **수동 새로고침** 버튼을 둔다. | D-028 이 “타일 열림” 계기를 없애면서 *사용자가 스스로 갱신할 수단*도 함께 사라진다 — 앱 밖에서 커밋/체크아웃하면 다음 턴까지 화면이 낡는다. 능력을 옮기는 것이 아니라 없애는 것이므로 대체 affordance 를 같은 변경에서 둔다. 0206 D-013 의 금지 셋(설정·펼치기·이동)에 걸리지 않는다 — 대응 동작이 실재한다. | 파생 정책 | ACTIVE | — |
| D-031 | 조회 소유자는 **한 훅**이다 — `useGitSnapshot`. `GitRow`·`DiffTileHeader`·`DiffTileContent` 는 전부 store 를 읽기만 한다. | 지금은 `GitRow` 와 `DiffTileContent` 가 각자 마운트 계기를 갖는다. 소유자가 둘이면 계기를 줄여도 한쪽만 줄어든다 — 0206 D-020(“조회는 한 곳뿐”)을 상태 축까지 확장한다. | 0206 D-020 파생 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 D-001~D-021 을 신설했다. 이 handoff 의 첫 설계 턴이라 `SUPERSEDED`·`OPEN` 은 없다.
- 0209·0210 의 ACTIVE 결정 중 이번 본문이 바꾸는 것은 없다 — 0209 D-001(Adapter 는 worktree 를 모른다)·D-015(`extraDirs` 불변), 0210 D-101(유예)·D-104(경로)·D-105(dirty 미거부)·D-107(폴백 영속)는 그대로다. 본 plan 은 표시와 읽기만 추가한다.
- 0206 D-010~D-019(diff 타일 배치)는 유지되고 D-012(예시 안내)만 본 plan D-018 이 종료시킨다 — 그 문구의 존재 조건이 “배선할 IPC 가 없다”였고 그 조건이 사라진다.
- **ACTIVE 결정 ↔ AC 대조**: 충돌 0. D-020↔AT-04(row 부재 폴백) · D-021↔AT-09(base 출처) · D-001·D-004↔AT-01, D-002↔AT-01·AT-03, D-003↔AT-01, D-005↔AT-03, D-006↔AT-02, D-007·D-008↔AT-04·AT-05·AT-06, D-009↔AT-07, D-010↔AT-09, D-011↔AT-09, D-012↔AT-11, D-013↔AT-12, D-014·D-015↔AT-10, D-016↔AT-15, D-017↔AT-09, D-018↔AT-13, D-019↔§11 변경 파일에 마이그레이션 없음.

#### ΔV1 갱신 메모 (2026-08-31)

- 신설 D-022~D-031. 대체 3건 — **D-009 → D-025** · **D-011 → D-026** · **D-017 → D-028**. 셋 다 사용자 명시 변경이고 실패로 위장하지 않는다.
- **대체된 결정에 걸려 있던 AC 를 다시 유도했다**: D-009↔AT-07 은 `added`/`removed` 축이 사라지므로 **AT-07 을 브랜치 축으로 좁히고**(§7 갱신) 변경량 축은 AT-16 이 받는다. D-011↔AT-09 의 “미추적 항목의 `added` 가 그 파일 줄 수” 절은 **AT-09 에서 제거**하고 AT-17 이 반대 방향(0 이라고)으로 잠근다. D-017↔AT-09 의 계기 3종은 AT-19 가 2종으로 다시 센다.
- **바뀌지 않은 ACTIVE 결정**: D-001~D-008 · D-010 · D-012~D-016 · D-018~D-021. 특히 **D-020 은 유지**된다 — 폴백 후 원본 복귀라는 *결과*는 같고 D-023 이 그 *발화점*만 명시로 바꾼다. **0210 D-109 도 유지** — 새 wire variant 없이 같은 `patch` 를 쓴다.
- **ΔV1 ACTIVE 결정 ↔ AC 대조**: 충돌 0. D-022·D-023↔AT-16 · D-024↔AT-16(재발신 0건) · D-025↔AT-17 · D-026↔AT-17·AT-18 · D-027↔AT-18 · D-028·D-031↔AT-19 · D-029↔AT-19·AT-20 · D-030↔AT-20.
- **한 결정의 가시적 결과를 여기 적어 둔다**(사용자 검토용). D-026 아래에서 미추적 파일은 diff 타일 파일 행에 **`+0 −0` 으로 그려진다** — 이미 binary 파일이 같은 모양이다(`mergeDiffEntries` 가 `binary` 면 0 을 넣는다). 사용자가 “목록에도 줄 수는 보이게” 를 원하면 D-026 을 다시 갈라야 하고 그때 합계는 목록 합과 달라진다.

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

### ΔV1 — 피드백 3건의 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| §1 “매번 확인하고 랜더링한다”가 원인인가 | **아니다 — 성능 문제가 아니다** | `CwdButton.tsx:32` 는 props 만 읽는 순수 컴포넌트이고 조회 코드가 0건이다. 원인은 상태 소멸이다: `chatReducer.ts:468` 이 `patch.cwd` 만 온 갱신에서 `worktree` 를 null 로 내리는데, `claude-map.ts:185` 의 `system/init` 이 **매 턴** 그 형태(`patch:{cwd}`)를 보낸다 |
| 왜 1턴째만 정상인가 | 순서 때문 | `turn-coordinator.ts:322` `emit`(worktree→null) → `:332` `onSessionConfirmed`(worktree→display). 1턴째는 뒤가 복구하고, **2턴째는 뒤가 없다** — `prepare-worktree.ts:40-60` 의 resume 분기가 `passthrough` 로 조기 반환해 `onManaged` 를 부르지 않아 `send.ts:217` 의 훅 자체가 실리지 않는다 |
| 1턴째도 결함이 있는가 | **있다** | 같은 순서 때문에 1턴째에도 worktree 가 null 이 됐다가 복구되는 **1프레임 깜빡임**이 있다. D-022 는 이것까지 함께 없앤다 |
| 왜 라운드 1 AC 가 이걸 못 잡았나 | oracle 부재 | AT-04·AT-06 은 순수 파생 함수만, AT-08 은 `LOAD_SESSION` 왕복만 단언한다. `chatReducer.worktree.test.ts` 의 `session.updated` 케이스 2건은 **`cwd` 축만** 보고 `worktree` 축을 단언하지 않는다 — **2턴 연속 시퀀스를 흘리는 케이스가 0건**이다 |
| §2 `+0−0` 은 버그인가 | **의미상 정확한 값이다** — 결함은 “무엇을 세는가”에 있다 | `gitStatus.dirty` = `git diff HEAD --shortstat`(`git-cli.ts:60`). 격리 세션에서 에이전트가 커밋하면 HEAD 대비 차이가 0 이다. 우측 패널은 `base_oid` 대비(`git-diff.ts:115`)라 그 커밋들을 포함한다 |
| 더 작은 해법 — 기준선만 맞출 수 있는가 | 가능하지만 채택하지 않음 | `gitStatus` 에 `baseOid` 를 넘기면 수치는 맞는다. 그러나 같은 저장소를 `shortstat` 과 `numstat` 으로 **두 번 훑고**, 일치가 우연이라 한쪽 인자만 바뀌면 조용히 갈라진다 — 지금 갈라진 방식과 같다(D-025 가 출처를 하나로 만든다) |
| §3 “버튼 이벤트마다 발생”이 맞는가 | **맞다 — 다만 클릭 핸들러가 아니라 마운트다** | `DiffTileContent.tsx:272-277` 의 요약·선택·펼침이 전부 로컬 `useState` 고, 타일은 `RightPanel.tsx:168` 의 조건 렌더라 닫으면 언마운트된다. `:252` 마운트 effect 가 무조건 재조회한다. `GitRow.tsx:93` 도 스냅샷 보유 여부를 보지 않고 부른다 |
| 1회 조회의 실제 비용 | 실측 | `gitStatus` = git 프로세스 **5**(`is-inside-work-tree`·`symbolic-ref`·`verify HEAD`·`diff --shortstat`·`show-toplevel`). `gitDiffSummary`(격리) = **6** + **미추적 파일 전량 `readFile`**(`git-diff.ts:98`). 전부 순차 `await` |
| 사용자 제안(“메시지 완료 hook 에 등록”)을 그대로 쓰는가 | **계기는 이미 있다 — 상태 소유만 옮긴다** | `shouldRefetchGitStatus(prevBusy, nextBusy)` 가 턴 종료 전이를 이미 판정하고 두 표면이 쓴다(전수 2건). main 측 push 구독자를 새로 만들면 **사용자가 보지 않는 세션까지** 턴마다 계산하고, 첫 진입 경로는 여전히 pull 이라 경로가 둘이 된다 |
| §3 이 능력을 없애는가 | **없앤다 — 대체를 둔다** | “타일을 닫았다 열어 새로고침” 이 사라진다. 앱 밖 git 조작은 턴 경계가 못 잡으므로 D-030 이 수동 새로고침으로 그 능력을 되돌린다 |
| ΔV1 을 0211 에 넣는가, 새 handoff 인가 | **0211 ΔV1** | 설계자는 0212 분리를 제안했고 사용자가 0211 갱신을 명시했다(“plan을 업데이트하라”·“턴 증가가 아니다”). 세 건 모두 V1 이 만든 표면(표시 정본·diff 요약·조회 계기)의 정정이라 기준 V 상속이 성립한다 |

- 사용자에게 올릴 결정: 없음. 네 갈래(단계 출처·표시 형태·격리 diff 기준·비격리 diff 기준)는 V1 턴 질의로, ΔV1 의 세 갈래(키 판정·단일 출처·마운트 계기 제거)와 untracked 취급은 피드백 후속 턴의 “제안한 대안으로” 로 닫혔다. **가시적 결과 1건은 §3 갱신 메모 마지막 줄에 적어 검토를 남겼다**(미추적 파일이 `+0 −0` 으로 그려진다).
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

#### ΔV1 추가 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 격리 세션의 **2번째 이후 턴 시작** | SDK init 이 `patch:{cwd}` 를 보내지만 `worktree` 키가 없어 표시 정본이 보존된다 | 작업 경로/저장소 이름이 **그대로** 남는다 (V1 에서는 여기서 되돌아갔다) |
| 격리 세션의 **1번째 턴** | 같은 규칙이라 소멸 자체가 없다 | 이름이 확정된 뒤 깜빡이지 않는다 |
| worktree 소실 폴백 (0210 D-107) | 폴백 통지가 `patch:{cwd, worktree:null}` 을 명시 발신 | 이름이 원본으로 복귀한다 (D-020 의 결과 유지) |
| 격리 세션에서 에이전트가 커밋 후 턴 종료 | 요약을 1회 재조회하고 합계가 `base_oid` 대비로 갱신 | 컴포저 행의 `+N −M` 이 **커밋된 작업까지 센다** (V1 에서는 `+0 −0`) |
| 에이전트가 새 파일만 만들었다 | 미추적 항목이 목록에 뜨고 합계에는 0 을 더한다 | 파일 이름은 보이고 숫자는 `+0 −0` (D-026) |
| diff 타일 닫기 → 다시 열기 | 조회 0건 — store 의 요약을 그대로 읽는다 | 즉시 그려진다 (로딩 없음) |
| 세션 전환 후 되돌아오기 | 그 세션 스냅샷이 cwd 와 맞으면 조회 0건 | 즉시 그려진다 |
| 앱 밖에서 커밋/체크아웃 | 턴 경계가 없어 화면이 낡는다 | 사용자가 **새로고침 버튼**을 눌러 갱신한다 (D-030) |
| 새로고침 버튼 클릭 | 요약 1회 재조회 | 갱신된 목록·합계 |
| 커밋 선택 변경 | 그 범위로 요약 1회 재조회 + 펼침·본문 폐기 | 그 커밋의 파일 목록 (D-012 유지) |
| 세션 시작 전(랜딩) | 훅이 아무것도 부르지 않는다 | git 행 없음 (기존과 동일) |

### 파생 UX / 엣지케이스

- loading: 타일을 처음 열면 요약이 도착할 때까지 파일 목록 자리가 비어 있다 — 빈 상태 문구는 요약 도착 후에만 뜬다(“변경 없음”과 “아직 안 왔음”을 섞지 않는다).
- error: 요약/본문 조회 실패는 예외가 아니라 값이다 — 기존 git IPC 의 무해 폴백 관례를 따른다(`app/src/main/app/handlers/git.ts:31`).
- cancel: 준비 중 사용자가 중단하면 `lease.controller.abort()` 가 기존대로 걸리고 단계 줄은 턴 종료 리셋으로 사라진다.
- concurrency: 단계 이벤트는 `sessionId` 가 없어 `pendingNewChatKey` 로 라우팅된다 — 준비 중 사용자가 다른 세션으로 이동해도 그 화면을 오염시키지 않는다(`chatStore.ts:397` 의 기존 규칙).
- a11y: 단계 줄은 기존 `StatusLine` 의 `aria-live="polite"` 안에서 바뀐다 — 새 라이브 리전을 만들지 않는다.
- 폐쇄망: D-001 로 신규 네트워크 호출 0건. diff 조회는 전부 로컬 git 이다.

## 6. 범위 / 비범위

- **범위**: 격리 준비 단계 이벤트 + 한 줄 표시 · 작업 경로 버튼/­git 행 저장소 이름의 원본 표시 · diff 타일 실데이터(요약 + 파일 본문 + 커밋 선택) · 예시 데이터 제거.
- **ΔV1 추가 범위**: 표시 정본의 키 기반 판정과 폴백 명시 발신 · 컴포저 변경량의 출처 이전(요약 합계) + `GitStatus.dirty` 제거 · 미추적 파일의 변경량 0 · 요약/선택 커밋의 세션 상태 이전 + 단일 조회 훅 + 마운트 계기 제거 · diff 타일 수동 새로고침.
- **비범위**: origin fetch(D-001) · 준비 단계 누적 목록(D-002) · 0210 이 소유한 경로·유예·폴백 정책의 재설계 · diff 타일에서의 stage/commit/discard 조작 · 비격리 세션의 base 영속(질의에서 사용자가 고르지 않은 선택지) · 0206 D-013/D-014 가 잠근 헤더 구성(설정 메뉴·`main →` 표기) · worktree 목록 관리 화면.
- **ΔV1 추가 비범위**: main 프로세스 diff 캐시 · 턴 완료 push 이벤트(새 variant) · 비활성 세션의 사전 계산 · `dirtyStat` 자체의 제거(checkout 게이트가 계속 쓴다) · 파일 본문(`contents`)의 세션 상태 이전(기본 접힘이라 재열기 조회가 0이다).

| ΔV1 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 앱 밖 git 변경의 자동 감지(파일 워처) | 아니오 — 훅 하나에 계기가 붙는다 | D-030 의 수동 새로고침으로 능력을 채운다. 요구가 생기면 후속 handoff |
| 비활성 세션의 요약 유지 | 아니오 | 세션 슬라이스에 이미 자리가 있다. 지금은 활성 세션만 조회한다 |

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
| R-07 | AT-07 | 같은 행의 **브랜치**는 worktree 실측 그대로다 (회귀). ~~+N/−M~~ 축은 ΔV1 D-025 가 AT-16 으로 옮겼다 | 순수: 같은 입력에서 `branch` 가 worktree 브랜치이고 `detached` 가 그 판정이라고 단언 | 위와 같은 경로 |
| R-08 | AT-08 | 앱을 다시 켜고 resume 해도 AT-04·AT-06 이 같다 | 통합: 임시 DB 에 row 를 넣고 세션을 로드해 `LoadedSession.worktree` 가 `{sourceCwd, repoRoot}` 를 싣는다고 단언. 새 `DbQueries` 로 다시 열어도 같은 값이라고 단언 | `session:load` → `DbQueries.getManagedWorktreeBySession` → `LoadedSession` → `LOAD_SESSION` 리듀서 |
| R-09 | AT-09 | 변경사항 타일이 실제 파일 목록을 그린다 — managed row 가 있으면 `base_oid` 대비, 없으면(비격리·폴백 후) `HEAD` 대비이며 둘 다 미추적 파일을 **목록에** 포함한다. 미추적 항목의 수치는 AT-17 이 소유한다 | 통합(임시 저장소): base 커밋 후 추적 파일 1개 수정 + 미추적 파일 1개 생성 → 요약의 `files` 가 그 2건이라고 단언. 격리 row 를 붙이면 `base.kind==='worktree-base'`, 없으면 `'head'` 라고 단언 | `useGitSnapshot` → `gitApi.diffSummary` → `orca:git:diffSummary` → `git-diff.ts` |
| R-10 | AT-10 | 파일을 펼치면 그 파일의 실제 old/new 가 표로 그려진다 | 통합(임시 저장소): 파일 본문 조회가 `{kind:'text', oldValue: base 시점 내용, newValue: 작업 트리 내용}` 이라고 단언. 미추적 파일은 `oldValue===''` 라고 단언 | `DiffFileHeaders` onToggle → `gitApi.diffFile` → `orca:git:diffFile` |
| R-11 | AT-11 | 커밋을 고르면 그 커밋 하나의 변경만 보인다 | 통합(임시 저장소): base 위에 커밋 2개 → `commit:<sha2>` 로 요약을 부르면 파일 목록이 sha2 가 바꾼 파일만이고, 같은 인자의 본문 조회 `oldValue` 가 sha1 시점 내용이라고 단언 | 같은 두 채널의 `commit` 인자 |
| R-12 | AT-12 | 격리 세션의 커밋 목록은 `base_oid..HEAD` 실제 커밋이고, 비격리 세션은 빈 목록이다 | 통합(임시 저장소): 격리 row + 커밋 2개 → `commits` 길이 2 이고 subject 가 실제 제목이라고 단언. row 없이 부르면 `commits` 길이 0 이라고 단언 | 같은 요약 채널 |
| R-13 | AT-13 | 예시 데이터와 예시 안내 문구가 제품에서 사라진다 | 전수: `rg 'diffTileMock' app/src` = 0건, `rg 'diffMockNotice' app/src` = 0건. 파일 `diffTileMock.ts` 부재 | — (제거) |
| R-14 | AT-14 | 변경이 없으면 빈 상태 문구가 뜨고, 요약 도착 전에는 뜨지 않는다 | 렌더: `summary=null` 이면 빈 상태 문구가 **없고**, `summary={files:[]}` 이면 있다고 단언 | `DiffTileContent` 의 요약 상태 3분기 |
| R-15 | AT-15 | 상한 초과가 값으로 표시된다 — 파일 201건이면 200건 + 잘림 표시, 1 MiB 초과 파일은 본문 대신 사유 | 순수: 요약 정규화 함수에 201행 numstat 을 주면 `files.length===200 && filesTruncated===true` 라고 단언. 통합: 1 MiB 초과 파일의 본문 조회가 `{kind:'unavailable', reason:'too-large'}` 라고 단언 | `git-diff.ts` 의 정규화 · `DiffTileContent` 의 안내 |

### ΔV1 — 추가 Requirements / Acceptance

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-16 | AT-16 | 격리 세션에서 **턴을 두 번 이상 보내도** 작업 경로 버튼과 git 행 저장소 이름이 원본 basename 그대로다 | 리듀서 순수 시퀀스: `session.updated{patch:{cwd:X}}` → `{patch:{worktree:D}}` → **`{patch:{cwd:X}}`(2턴째 init)** 를 차례로 흘린 뒤 `state.worktree === D` 라고 단언. 같은 시퀀스의 1·2단계 사이에서도 `worktree` 가 null 이 된 적 없다고 단언(깜빡임 부재) | `claude-map` init → `turn-coordinator.emit` → `chatStore.receive` → `chatReducer` `session.updated` → `CwdButton`·`gitRowView` |
| R-17 | AT-17 | 폴백(0210 D-107)은 여전히 이름을 원본으로 되돌린다 (회귀) | 리듀서 순수: `{patch:{cwd:S, worktree:null}}` 수신 후 `state.worktree === null` 이고 라벨 파생이 `basename(S)` 라고 단언. **발신 측 전수**: `rg "onRecovered" app/src/main/app/chat-turn/send.ts` 의 patch 리터럴에 `worktree: null` 이 있다고 단언 | `recoverMissingWorktree` → `send.ts` `onRecovered` → 같은 리듀서 경로 |
| R-18 | AT-18 | 컴포저 git 행의 `+N −M` 이 **우측 diff 패널과 같은 수**다. 미추적 파일은 그 수에 0 을 더한다 | 통합(임시 저장소): base 커밋 → 추적 파일에 3줄 추가 + 미추적 파일 1개(2줄) 생성 → `summary.totals` 가 `{added:3, removed:0}` 이라고 단언(미추적 2줄이 **더해지지 않는다**). 순수: `gitRowView` 가 그 `totals` 를 그대로 `added`/`removed` 로 낸다고 단언. 격리 세션에서 base 위에 커밋 1개를 만든 뒤 `totals.added > 0` 이라고 단언(**`+0−0` 반증**) | `git-diff.ts` 합계 → `orca:git:diffSummary` → `useGitSnapshot` → 세션 상태 → `gitRowView` → `GitRowView` |
| R-19 | AT-19 | `GitStatus` 에 `dirty` 가 없고 `gitStatus()` 가 `--shortstat` 을 돌리지 않는다 | 전수: `rg "\bdirty\b" app/src/shared/ipc.ts` 에 `GitStatus` 멤버 0건(`GitCheckoutResult` 의 `stat` 축은 남는다). `rg -- "--shortstat" app/src/main/infra/git/git-cli.ts` = **1건**(`dirtyStat`, checkout 전용)이고 `gitStatus` 본문에서 `dirtyStat` 호출 0건. 회귀: `gitCheckout` 의 dirty 게이트 기존 케이스가 green | `git-cli.gitStatus` · `git-cli.gitCheckout` |
| R-20 | AT-20 | diff 타일을 닫았다 열어도, 세션을 오갔다 와도 **git 조회가 0건**이다. 조회는 cwd/세션 변경·턴 종료·커밋 선택·새로고침에서만 일어난다 | 순수 계기 판정: `gitSnapshotTriggers` 에 (열림) 입력을 주면 `false`, (cwd 변경)·(busy true→false)·(commit 변경)·(refresh nonce 증가) 입력에 각각 `true` 라고 단언. 렌더: `gitApi.diffSummary` 스텁을 세고 타일 토글 2회 왕복에서 호출 증가 **0**, 턴 종료 전이 1회에서 증가 **1** 이라고 단언 | `Composer` → `useGitSnapshot` → `gitApi.diffSummary` → 세션 상태 → `DiffTileContent`(읽기만) |
| R-21 | AT-21 | 새로고침 버튼이 요약을 다시 가져온다 | 렌더: 헤더의 새로고침 버튼 클릭 1회 → 스텁 호출 증가 **1** 이고 `aria-label` 이 ko/en 카탈로그 키로 해석된다고 단언 | `DiffTileHeader` → `chatActions.refreshGitSnapshot` → 세션 상태 nonce → `useGitSnapshot` |

### AC 검증 주의사항

- 기존 테스트 재사용: `gitRowState.test.ts` 는 실재하고 `repoNameFromRoot`·`gitRowView` 케이스를 갖는다 — AT-06·AT-07 은 그 파일에 케이스를 **추가**한다(파일명을 계약으로 삼지 않는다). `composerPanel.render.test.ts`·`gitRow.render.test.ts` 도 실재한다.
- 사람 실기 항목: 없다. 문구 선택·단계 순서·이름 파생·diff 범위 판정·상한 절단은 전부 순수 함수 또는 임시 저장소 통합으로 내려간다. 시각 확인은 이번 요구에 없다(배치를 바꾸지 않는다).
- N회/총량 기준: AT-01 의 “정확히 1회씩”은 `onProgress` sink 의 프로덕션 호출부 전수를 센다 — `rg 'onProgress\(' app/src/main` 이 `service.ts` 4건 + `prepare-worktree.ts` 1건 = 5건임을 확인하고, 관측 지점은 그 5건 전부를 지나는 격리 신규 세션 한 호출이다. 테스트 fake 는 git operations 만 대체하고 `onProgress` 호출부는 프로덕션 코드 그대로 지난다.
- 총량/0건 기준: AT-13 의 두 `rg` = 0건은 **제거 대상만** 센다 — 허용 예외 없음(`diffTileMock`·`diffMockNotice` 는 0206 이 이번 작업을 위해 만든 임시 식별자다). 0건 게이트 단독으로는 “실데이터가 붙었다”를 증명하지 못하므로 AT-09·AT-10 양성 단언과 짝지어 잠근다(§5 방향 규칙).

#### ΔV1 주의사항

- 기존 테스트 재사용: `chatReducer.worktree.test.ts` 는 실재하고 `session.updated` 케이스 2건(`patch.cwd` 유·무)을 갖는다 — **그 2건은 `cwd` 축만 단언한다**(실측). AT-16·AT-17 은 그 파일에 케이스를 **추가**한다. `gitRowState.test.ts`·`git-diff.test.ts`·`diffTile.render.test.ts` 도 실재한다.
- **AT-19 의 `rg -- "--shortstat"` = 1건은 0건 게이트가 아니다** — 남아야 할 1건(checkout 게이트)을 세고, 사라져야 할 자리는 `gitStatus` 본문의 `dirtyStat` 호출 0건으로 따로 센다. 두 술어를 한 검색으로 합치면 “옮겼는지 지웠는지”를 구분하지 못한다.
- **AT-20 은 “0건” 과 “1건” 을 함께 요구한다.** 토글 왕복의 증가 0 만 단언하면 조회를 통째로 없앤 구현이 통과한다 — 턴 종료 전이의 증가 1 을 같은 케이스에서 짝짓는다(§5 방향 규칙).
- **AT-18 의 `+0−0` 반증이 이 AC 의 핵심이다.** 합계가 `totals` 를 읽는다는 구조 단언만으로는 사용자가 본 증상이 재현되는지 알 수 없다 — 커밋을 만든 뒤 `totals.added > 0` 이 그 증상의 직접 부정이다.
- 사람 실기 항목: 없다. 시퀀스 판정·합계 파생·계기 판정·DTO 전수는 전부 순수 함수 또는 임시 저장소 통합으로 내려간다. 새로고침 버튼은 클릭→호출 수 단언이라 렌더 테스트다.
- N회/총량 기준: AT-20 의 “조회 0건” 분모는 **`gitApi.diffSummary` 를 부르는 프로덕션 호출부 전수**다 — D-031 이후 `rg "gitApi\.diffSummary" app/src/renderer` 가 **1건**(`useGitSnapshot`)임을 확인하고 그 하나를 스텁으로 관측한다. 2건 이상이면 D-031 이 성립하지 않은 것이다.

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
| VP-18 | SD-04 ↔ ST-02 | REGRESSION | 0209·0210 격리 준비 코어 | `service.test.ts`·`send.worktree.test.ts`·`prepare-worktree.test.ts` 가 계속 green | not selected — 기존 oracle 재실행 | EP-01 (5) |
| VP-19 | SD-05 ↔ ST-03 | REGRESSION | `recoverMissingWorktree` → row 삭제 → `patch.cwd` | 폴백 후 `LoadedSession.worktree` 가 `undefined` 이고 라벨이 원본 basename | not selected — row 부재·라벨 두 값을 직접 관측한다 | EP-06 (2) |

> **ΔV1 정정(형식)**: 위 두 행은 V1 작성 시 VP-18 의 마지막 두 칸이 VP-19 행 끝으로 밀려 있었다 — VP-18 에 `§10 전수` 칸이 없고 VP-19 에 칸이 둘 남았다. 판정 내용은 바꾸지 않고 칸 위치만 되돌렸다(ΔV1 이 두 pair 를 각각 `NOT_REQUIRED`·`REGRESSION` 으로 인용하므로 읽을 수 있어야 한다).

### ΔV1 — Delta V (기준 `V1` @ `0d8cf037`)

- Delta V 판정 근거: 기준 V1 이 단일 handoff·단일 commit 으로 고정돼 있고, ΔV1 은 그 V1 이 만든 세 표면(표시 정본 전달·diff 요약·조회 계기)만 바꾼다. 기준선이 하나이므로 Baseline 재작성이 아니라 증분이다.
- 변경이 시작되는 수준: **R** — 사용자가 관측하는 결과 셋(이름 유지·수치 일치·조회 없음)이 바뀐다. 아래로 `SD`·`AR`·`MD` 가 따라온다.
- 영향 없는 V1 pair 는 복사하지 않는다. 아래 표에 없는 V1 노드·pair 는 그대로 유효하다.

#### ΔV1 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-16 | R | §7 ΔV1 2턴 이후 이름 유지 | NEW | — |
| R-17 | R | §7 ΔV1 폴백 복귀 | CHANGED | R-04 의 폴백 축 (V1 @ `0d8cf037`) — 판정 축이 값→키로 바뀐다 |
| R-18 | R | §7 ΔV1 변경량 일치 | CHANGED | **R-07 을 대체**(변경량 축) — V1 R-07 은 브랜치 축만 남는다 |
| R-19 | R | §7 ΔV1 `dirty` 제거 | NEW | — |
| R-20 | R | §7 ΔV1 조회 계기 | CHANGED | R-09 의 계기 축 (V1 @ `0d8cf037`) — D-017 → D-028 |
| R-21 | R | §7 ΔV1 새로고침 | NEW | — |
| R-04 · R-06 | R | §7 이름 파생 | INHERITED | V1 @ `0d8cf037` — 파생 규칙 불변, 전달·보존만 바뀐다 |
| R-07 | R | §7 브랜치 축 | CHANGED | V1 @ `0d8cf037` — 변경량 축을 R-18 로 넘기고 브랜치만 남긴다 |
| R-09 | R | §7 파일 목록 | CHANGED | V1 @ `0d8cf037` — 미추적 수치 절을 R-18 로 넘긴다 |
| SD-06 | SD | §5 ΔV1 전이 12행 · §13 ΔV1 | NEW | — |
| SD-02 | SD | §5 resume 흐름 | INHERITED | V1 @ `0d8cf037` — `session:load` 경로 불변 |
| SD-05 | SD | §5 폴백 후 표시 | CHANGED | V1 @ `0d8cf037` — 발화점이 암묵(`cwd` 단독) → 명시(`worktree:null`) |
| AR-05 | AR | §10 EP-10 `patch.worktree` 키 계약 | CHANGED | **AR-02 를 대체**(판정 축) — 전달 지점 2곳은 AR-02 그대로 |
| AR-06 | AR | §10 EP-12 `GitDiffSummary.totals` · `GitStatus` DTO | CHANGED | AR-03 의 요약 DTO (V1 @ `0d8cf037`) |
| MD-07 | MD | §11 조회 계기 판정(순수) | NEW | — |
| MD-08 | MD | §11 합계 파생 · 미추적 0 (순수) | CHANGED | MD-04 의 정규화 (V1 @ `0d8cf037`) |
| MD-02 | MD | §11 표시 이름 파생 | INHERITED | V1 @ `0d8cf037` — 함수 본문 불변 |
| MD-05 · MD-06 | MD | §11 트리 행 파생 | INHERITED | V1 @ `0d8cf037` — 입력 형태 불변(수치만 0) |

#### ΔV1 Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-20 | R-16 ↔ AT-16 | REQUIRED | `claude-map` init → `turn-coordinator.emit` → `chatStore.receive` → `chatReducer` → `CwdButton` | 3단계 시퀀스 후 `state.worktree === D`, 중간 프레임에도 null 없음 | required — “키로 판정한다” 는 **자리 주장**이라 존재 단언에 둔감하다. ① 리듀서를 V1 식(`ev.patch.worktree ?? (ev.patch.cwd ? null : state.worktree)`)으로 되돌리는 변이 ② `'worktree' in ev.patch` 를 `ev.patch.worktree != null` 로 바꾸는 형제 변이 — 둘 다 red 여야 한다(②는 `worktree:null` 폴백을 삼킨다) | EP-10 (2) |
| VP-21 | R-17 ↔ AT-17 | REQUIRED | `recoverMissingWorktree` → `send.ts:onRecovered` → 같은 리듀서 | `worktree:null` 수신 후 상태 null + 발신부 리터럴에 `worktree: null` 존재 | required — 발신부는 **한 지점**이라 지우면 조용히 사라진다. `onRecovered` 의 patch 에서 `worktree: null` 을 제거하는 변이가 red 인지 확인한다 | EP-10 (2) |
| VP-22 | R-18 ↔ AT-18 | REQUIRED | `git-diff.ts` 합계 → 채널 → `useGitSnapshot` → 세션 상태 → `gitRowView` → `GitRowView` | 추적 3줄 + 미추적 2줄 → `totals={added:3,removed:0}`; base 위 커밋 1개 후 `totals.added > 0` | required — 합계는 **출처 주장**이다. `gitRowView` 가 `totals` 대신 옛 `status.dirty` 축을 읽도록 되돌리는 변이(타입이 남아 있으면 컴파일된다)와 미추적을 합계에 더하는 변이 둘을 심는다 | EP-11 (2) · EP-12 (2) |
| VP-23 | R-19 ↔ AT-19 | REQUIRED | `git-cli.gitStatus` · `git-cli.gitCheckout` | `GitStatus` 멤버 0건 · `--shortstat` 1건(checkout) · `gitStatus` 내 `dirtyStat` 호출 0건 · checkout dirty 케이스 green | required — “1건이 남는다” 는 **음성·양성 혼합 술어**다. `gitStatus` 에 `dirtyStat` 호출을 되살리는 변이가 red 인지, 그리고 checkout 쪽 `dirtyStat` 을 지우는 변이가 **다른** 케이스에서 red 인지 각각 확인한다 | EP-12 (2) |
| VP-24 | R-20 ↔ AT-20 | REQUIRED | `Composer` → `useGitSnapshot` → `gitApi.diffSummary` → 세션 상태 → `DiffTileContent` | 계기 판정 5입력 + 스텁 호출 수(토글 왕복 증가 0 · 턴 종료 증가 1) | required — 증가 0 은 **소거에도 참**이다. ① 마운트 계기를 되살리는 변이(왕복 증가가 2가 되어야 red) ② 턴 종료 계기를 제거하는 변이(증가 1 이 0이 되어 red) 둘을 심어 양방향을 잠근다 | EP-13 (3) |
| VP-25 | R-21 ↔ AT-21 | REQUIRED | `DiffTileHeader` → `chatActions.refreshGitSnapshot` → nonce → `useGitSnapshot` | 클릭 1회 → 스텁 증가 1 · `aria-label` 이 카탈로그 키로 해석 | not selected — 클릭의 직접 행동 결과를 관측한다 | EP-13 (3) |
| VP-26 | MD-07 ↔ UT-03 | REQUIRED | `gitSnapshotTriggers(prev, next)` 순수 판정 | 5입력의 기대 boolean 배열 일치 | not selected — 순수 함수 입출력 비교 | EP-13 (3) |
| VP-27 | MD-08 ↔ UT-04 | REQUIRED | `mergeDiffEntries` + 합계 파생 | 미추적 항목이 `added:0, removed:0` 이고 합계가 **절단 전** 값이라고 단언(201건 중 200 표시, 합계는 201건 기준) | required — 절단 후 합계를 내면 잘린 파일의 줄이 조용히 사라진다. 합계를 `files.slice()` 이후로 옮기는 변이가 red 여야 한다 | EP-11 (2) |
| VP-04 · VP-05 · VP-06 | R-04·R-05·R-06 ↔ AT-04·05·06 | REGRESSION | V1 경로 그대로 | 기존 케이스 재실행 — 이름 파생·클릭 인자 불변 | not selected — 기존 oracle 재실행 | EP-05 (2) |
| VP-07 | R-07 ↔ AT-07 | REGRESSION | V1 경로 | 브랜치·`detached` 만 재단언(변경량 절 삭제) | not selected — 기존 oracle 을 좁혀 재실행 | EP-05 (2) |
| VP-09 · VP-10 · VP-11 · VP-12 | R-09~R-12 ↔ AT-09~AT-12 | REGRESSION | V1 경로 | 목록·본문·커밋 범위가 계기 이전 후에도 같다 | not selected — 기존 oracle 재실행 | EP-07 (2) |
| VP-14 · VP-16 · VP-17 | R-14·MD-05·MD-06 ↔ AT-14·UT-01·UT-02 | REGRESSION | V1 경로 | 요약 3분기·트리 행이 store 이전 후에도 같다 | not selected — 기존 oracle 재실행 | EP-08 (3) |
| VP-19 | SD-05 ↔ ST-03 | REGRESSION | `recoverMissingWorktree` → 리듀서 | 폴백 후 라벨이 원본 basename (VP-21 이 발화점을 새로 잠근다) | not selected — 기존 oracle 재실행 | EP-06 (2) |
| VP-01 · VP-02 · VP-03 · VP-18 | 준비 단계 5종 | NOT_REQUIRED | — | V1 @ `0d8cf037` 의 기존 증거 그대로 | — | 비영향 근거: ΔV1 은 `worktree.preparing` 경로·`StatusLine`·`activityLabel` 을 **한 줄도 건드리지 않는다**(§18 ΔV1 파일 목록에 없다) |
| VP-08 | SD-02 ↔ ST-01 | NOT_REQUIRED | — | V1 @ `0d8cf037` — `SELF_BLOCKED`(ABI) 상태 그대로 | — | 비영향 근거: `session:load` 의 `LoadedSession.worktree` 조립은 ΔV1 이 바꾸지 않는다. **단, V1 에서 미실행이라 라운드 1 verify 가 여전히 이 pair 를 갖는다** |
| VP-13 · VP-15 | R-13·R-15 ↔ AT-13·AT-15 | NOT_REQUIRED | — | V1 @ `0d8cf037` 의 0건 스윕·경계값 그대로 | — | 비영향 근거: 제거 대상 식별자와 상한 상수를 ΔV1 이 건드리지 않는다 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app` 정적 게이트 | `app/src/**` 를 바꾼다 | `npm run lint` · `npm run typecheck` (ABI 중립, `app/AGENTS.md §better-sqlite3 ABI`) | 이번 변경이 낸 error 만 blocking |
| `app` 테스트 | 신규·회귀 pair 가 vitest 다 | `./node_modules/.bin/vitest run` (DB 스위트 포함 시 `npm test`) | 이번 변경이 낸 red 만 blocking. ABI egress 차단 기인 DB red 는 기준선으로 분리 보고 |
| 문서 인벤토리 | IPC 채널 79→81 · NormalizedEvent 21→22 · git 도메인 3→5 로 생성물 수치가 바뀐다 | `node scripts/check-doc-inventory.mjs` 재생성 후 `--check` | 재생성 누락은 blocking |
| IPC 계약 문서 | 신규 채널 2종 + 신규 이벤트 1종은 `docs/IPC_CONTRACT.md` 가 정본이다 | 신규 행 3건 존재 확인 | 누락은 blocking |
| i18n 카탈로그 | ko/en 신규 키를 추가한다 | `resources.test.ts` (리프 키 패리티·빈 값·플레이스홀더) | 패리티 실패는 blocking |
| 마이그레이션 append-only | 변경 없음(D-019) | `check-migrations-appendonly.mjs` | 해당 없음 |

#### ΔV1 gate 차분

| Gate | ΔV1 에서 달라지는 점 | 증거 / 명령 |
|---|---|---|
| `app` 정적 게이트 | 동일 — `app/src/**` 를 바꾼다 | `npm run lint` · `npm run typecheck` |
| `app` 테스트 | 동일. **DB 스위트는 ΔV1 이 늘리지 않는다** — 신규 pair 7건이 전부 순수·임시 저장소다 | `./node_modules/.bin/vitest run` |
| 문서 인벤토리 | **채널 수 불변 81** — ΔV1 은 채널·이벤트를 만들지 않고 기존 `orca:git:diffSummary` DTO 에 필드만 더한다(실측: `CHANNELS` 리터럴 81건, `orca:git:*` 5건) | `node scripts/check-doc-inventory.mjs --check` 가 **차이 0** 이어야 한다 |
| IPC 계약 문서 | **`GitStatus` 에서 `dirty` 제거 · `GitDiffSummary` 에 `totals` 추가** — 두 DTO 행을 고친다 | `docs/IPC_CONTRACT.md` 의 두 행 갱신 확인 |
| i18n 카탈로그 | 새로고침 버튼 라벨 1키(ko/en) | `resources.test.ts` |

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

### ΔV1 전수 조사 (2026-08-31 재실측)

| 발견 / 제약 | 근거 |
|---|---|
| `system/init` 이 **매 턴** `patch:{cwd}` 를 보낸다 — 폴백 통지와 wire 형태가 같다 | `adapters/claude-map.ts:185` |
| `emit` 이 `onSessionConfirmed` 보다 **먼저**다 — 1턴째에도 null→display 왕복이 있다 | `features/chat/turn-coordinator.ts:322` → `:332` |
| resume 분기는 `onManaged` 를 부르지 않는다 — 2턴째부터 `worktreeDisplay` 가 null 이라 훅이 실리지 않는다 | `app/chat-turn/prepare-worktree.ts:40-60` · `send.ts:217` |
| `GitStatus.dirty` 의 **프로덕션 소비자는 1건**이다 | `rg "\.dirty\b" app/src --type ts` 프로덕션 히트: `gitRowState.ts:53·54` 한 곳(그 외는 `handlers/git.ts:36` 폴백 리터럴 · `ipc.ts:1022` 선언) |
| checkout 의 dirty 게이트는 `gitStatus` 를 거치지 않고 **자기 `dirtyStat`** 을 부른다 | `infra/git/git-cli.ts:121` |
| `BranchChip` 의 dirty 모달은 `gitCheckout` **결과**(`reason:'dirty'`)에서 온다 — `gitStatus.dirty` 를 읽지 않는다 | `composer/branchChipState.ts:51` · `BranchChip.tsx:53` |
| diff 타일은 `tiles` 배열의 조건 렌더라 닫으면 **언마운트**된다 | `rightpanel/RightPanel.tsx:168-198` |
| 요약·선택 커밋·펼침·본문이 전부 컴포넌트 로컬 `useState` 다 | `rightpanel/DiffTileContent.tsx:272-277` |
| `GitRow` 의 cwd effect 는 보유 스냅샷을 보지 않고 무조건 조회한다 | `composer/GitRow.tsx:93-107` |
| 스냅샷은 캐시가 아니라 **한 쌍**(`{cwd, status}`)이다 — 늦은 응답 폐기용 태그다 | `composer/branchChipState.ts:16-24` |
| 세션 상태에 `gitStatus` 자리가 이미 있다 — 요약도 같은 축에 둘 수 있다 | `chatReducer.ts:189`(필드) · `:376`(`SET_GIT_STATUS`) · `:996` · `chatStore.ts:1262` |
| `mergeDiffEntries` 가 미추적을 `{status:'added', added, removed:0, binary}` 로 만든다 | `infra/git/git-diff-parse.ts:105-127` |
| 미추적 줄 수를 세려고 **파일 내용을 전부 읽는다** — D-026 아래에서 통째로 사라진다 | `infra/git/git-diff.ts:89-104`(`untrackedStat` 의 `stat`+`readFile`) |
| 요약 1회의 독립 git 조회가 전부 **순차 `await`** 다 | `infra/git/git-diff.ts:115-133`(`numstat`·`name-status`·`show-toplevel`·`ls-files` 4건) |

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| IPC 채널 | `CHANNELS` 리터럴 파싱 | **81** | ΔV1 이 늘리지 않는다 — 생성물 재생성 시 차이 0 이어야 한다 |
| `orca:git:*` 채널 | 같은 파싱 | **5** | `status`·`branches`·`checkout`·`diffSummary`·`diffFile`. ΔV1 신규 0 |
| `GitStatus.dirty` 프로덕션 소비자 | `rg "\.dirty\b" app/src` | **1** | `gitRowState.ts`. D-025 후 0 → D-027 의 분모 |
| `shouldRefetchGitStatus` 프로덕션 호출부 | `rg shouldRefetchGitStatus app/src` | **2** | `GitRow.tsx:110` · `DiffTileContent.tsx:258`. D-031 후 1 |
| `gitApi.diffSummary` 프로덕션 호출부 | `rg "gitApi\.diffSummary" app/src/renderer` | **1** | 현재도 1(`DiffTileContent`). ΔV1 후에도 1(`useGitSnapshot`) — **자리가 바뀐다** |
| `gitApi.status` 프로덕션 호출부 | `rg "gitApi\.status" app/src/renderer` | **2** | `GitRow.tsx:97·115`(같은 훅의 두 effect). ΔV1 후 `useGitSnapshot` 한 곳 |
| `session.updated` patch 소비자 | `rg "patch\.(cwd\|worktree)" app/src` 프로덕션 | **2** | `chatReducer.ts:464`(cwd) · `:468`(worktree). EP-10 의 분모 절반 |
| `patch` 를 만드는 프로덕션 발신부 | 같은 축 | **3** | `claude-map.ts:185`(init) · `mock-scenarios.ts:771`(mock 합성) · `send.ts:176`(폴백). 폴백 1건만 `worktree:null` 을 실는다 |
| `gitRowView` 소비처 | `rg gitRowView app/src` 프로덕션 | **2** | `GitRow.tsx` · `DiffTileHeader.tsx`. 시그니처 변경이 둘 다에 닿는다 |

#### ΔV1 수치 / 전칭 표현 검산

- 재측정: 채널 **81**(V1 구현 후 79→81 반영됨) · git 도메인 **5** · 마이그레이션 **18**(D-019 유지). ΔV1 은 셋 다 늘리지 않는다.
- “`GitStatus.dirty` 의 소비자가 하나뿐이다” 의 반례 검색: `rg "\.dirty\b|dirty:" app/src` 전수에서 프로덕션 히트 4건 — `gitRowState.ts:53`·`:54`(소비) · `handlers/git.ts:36`(폴백 리터럴) · `ipc.ts:1022`(선언). **소비는 `gitRowState` 한 파일뿐**이고 나머지 둘은 선언·기본값이다.
- “조회 소유자가 둘이다” 의 반례 검색: `rg "gitApi\.(status|diffSummary|diffFile)" app/src/renderer` — `GitRow.tsx` 2 · `DiffTileContent.tsx` 2(`diffSummary` 1 · `diffFile` 1) = 파일 **2개**. `diffFile` 은 사용자 펼침당 1회라 D-029 가 로컬로 남긴다.
- 내역 합 = 총계: ΔV1 강제 지점 EP-10(2) + EP-11(2) + EP-12(2) + EP-13(3) = **9**. V1 의 21 과 합쳐 유효 전수 **30**.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `chatReducer.worktree.test.ts` 의 `describe('chatReducer — worktree 폴백 통지 (AC17)')` 와 그 안 케이스 2건 존재. `gitRowState.test.ts`·`git-diff.test.ts`·`git-cli.test.ts`·`resources.test.ts` 존재. `docs/handoff/AGENTS.md §공통 V 추적 프로토콜` 존재.

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

### ΔV1 — AS-IS(=V1 구현물) → TO-BE

```text
[AS-IS · V1 구현물]
  claude init → session.updated{cwd}  → 리듀서: worktree = null   ← 매 턴
  onSessionConfirmed{worktree}        → 리듀서: worktree = display ← 1턴째만
  GitRow      → gitApi.status(cwd)      [마운트 + cwd + 턴종료]  → status.dirty (HEAD 대비)
  DiffTile    → gitApi.diffSummary(...) [마운트 + 키 + 턴종료]  → files (base 대비)
                로컬 useState 4개 (요약·선택·펼침·본문) — 언마운트하면 소멸

[TO-BE · ΔV1]
  claude init → session.updated{cwd}          → 리듀서: 'worktree' 키 없음 → 보존
  onSessionConfirmed{worktree}                → 리듀서: 키 있음 → display
  폴백       → session.updated{cwd, worktree:null} → 리듀서: 키 있음 → null

  Composer ─ useGitSnapshot(cwd, sessionId, commit, nonce)   ← 조회 소유자 1곳
               계기: cwd/세션 변경 · busy true→false · commit 변경 · nonce 증가
               ├→ gitApi.status(cwd)       → 세션 상태 gitStatus  (dirty 없음)
               └→ gitApi.diffSummary(...)  → 세션 상태 gitDiff    (files + totals)
                    │
       ┌────────────┼──────────────────────┐
  GitRow(읽기만)  DiffTileHeader(읽기만)  DiffTileContent(읽기만 + 새로고침·펼침)
   repo·branch     branch + 새로고침 버튼   트리·커밋·파일 본문
   +N −M = gitDiff.totals ────────── 같은 값 ─────────── 파일 행 합계
```

| 비교 축 | AS-IS (V1) | TO-BE (ΔV1) | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 표시 정본 판정 | `patch.cwd` 유무(값 축) | `patch` 의 `worktree` **키** 유무 | D-022 — init 과 폴백이 wire 상 구분 불가 | `AR-05` / VP-20 · `chatReducer.ts` |
| 폴백 발화점 | 암묵(`cwd` 단독) | 명시(`worktree: null`) | D-023 | `SD-05` / VP-21 · `send.ts:onRecovered` |
| 변경량 출처 | `gitStatus.dirty`(HEAD·추적) | `gitDiff.totals`(base·추적) | D-025 | `AR-06` / VP-22 · `gitRowState.ts` |
| 미추적 수치 | 줄 수를 세어 더한다 | 0 (목록에는 남는다) | D-026 | `MD-08` / VP-27 · `git-diff.ts`·`git-diff-parse.ts` |
| `GitStatus.dirty` | 필드 존재 + `--shortstat` 1회 | **제거** | D-027 — 소비자 0 | `AR-06` / VP-23 · `git-cli.ts`·`ipc.ts` |
| 요약 상태 소유 | `DiffTileContent` 로컬 | 세션 상태 | D-029 | `SD-06` / VP-24 · `chatReducer.ts` |
| 조회 소유자 | 2곳(GitRow · DiffTile) | 1곳(`useGitSnapshot`) | D-031 | `SD-06` / VP-24 · 신규 훅 |
| 조회 계기 | 마운트 + cwd + 턴종료 | cwd + 턴종료 (+커밋·새로고침) | D-028 | `MD-07` / VP-24·VP-26 · 순수 판정 |
| 수동 갱신 | 없음(타일 재열기가 대신) | 헤더 새로고침 버튼 | D-030 — 능력 대체 | `R-21` / VP-25 · `DiffTileHeader.tsx` |
| 요약 1회 비용 | git 6 순차 + 미추적 전량 read | git 4~5(3건 병렬) + read 0 | D-026 파생 + §14 | `AR-06` / VP-22 · `git-diff.ts` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `features/worktrees/service.ts` | 준비 단계 경계에서 콜백 호출. electron 을 모른다 | `onProgress?: (step) => void` | `app/chat-turn/prepare-worktree.ts` |
| `app/chat-turn/prepare-worktree.ts` | `onProgress` 를 service 로 통과 + `session` 단계 발생 지점 제공 | 위 콜백을 인자로 받는다 | `send.ts` |
| `app/chat-turn/send.ts` | 콜백을 `sendChatEvent` 로 잇는다 | `WebContents` | 컴포지션 루트 |
| `infra/git/git-diff.ts` | 범위 해석 + 요약/본문 조회 + 상한 절단 | `(cwd, base \| commit)` → DTO | `app/handlers/git.ts` |
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
| AR-05 / VP-20 · VP-21 | 표시 정본은 **`worktree` 키의 유무**로 판정하고, 그 키를 실을 책임은 발신부에 있다 (**EP-10, 2지점**: ① `chatReducer` `session.updated` 의 판정식 ② `send.ts` 의 `onRecovered` patch 리터럴) | `NormalizedEvent` 의 `session.updated` variant 인라인 `patch`(`shared/ipc.ts:449`~) — `worktree?: WorktreeDisplay \| null` | 구현자 | 이벤트 수신 · 폴백 발신 | ①만 고치면 폴백이 키를 안 실어 소실된 worktree 의 이름이 영원히 남는다. ②만 고치면 2턴째 init 이 계속 이름을 지운다. **둘은 서로를 대신하지 못한다** |
| AR-06 / VP-22 · VP-27 | 변경량 합계는 **절단 전** 전체에서 계산하고 미추적은 0 을 더한다 (**EP-11, 2지점**: ① `mergeDiffEntries` 의 미추적 항목 조립 ② 합계 계산 위치 = `slice` 이전) | `GitDiffSummary.totals`(`shared/ipc.ts`) · `git-diff-parse.ts` | 구현자 | 요약 정규화 | ①이 남으면 미추적 줄이 합계에 섞여 “수치에 추가하지 않는다”(D-026)가 깨진다. ②를 `slice` 뒤로 옮기면 201건 저장소에서 201번째 파일의 줄이 합계에서 조용히 사라진다 |
| AR-06 / VP-22 · VP-23 | `dirty` 축의 단일 정본 (**EP-12, 2지점**: ① `GitStatus` DTO 에서 `dirty` 제거 + `gitStatus()` 의 `dirtyStat` 호출 제거 ② `gitRowView` 가 `totals` 를 읽음) | `shared/ipc.ts` `GitStatus` · `gitRowState.ts` | 구현자 | DTO 정의 · 행 파생 | ①만 하면 `gitRowView` 가 컴파일 실패로 드러나지만, ②만 하고 ①을 남기면 **두 값이 공존**해 다음 사람이 어느 것이 표시 정본인지 모른다 — 지금 갈라진 방식 그대로다. checkout 의 `dirtyStat`(`git-cli.ts:121`)은 **지우지 않는다** |
| SD-06 / VP-24 · VP-25 · VP-26 | 조회 소유자는 하나이고 마운트는 계기가 아니다 (**EP-13, 3지점**: ① `useGitSnapshot` 이 유일한 `gitApi.status`/`diffSummary` 호출부 ② `GitRow` 의 두 effect 제거 ③ `DiffTileContent` 의 요약 effect·로컬 요약 상태 제거) | `features/chat/components/composer/useGitSnapshot.ts` | 구현자 | 렌더 트리 조립 | 셋 중 하나만 남아도 그 표면이 마운트마다 계속 조회한다 — 사용자가 본 증상이 절반만 사라진다. **전수 술어는 “`gitApi.status`/`gitApi.diffSummary` 를 부르는 **세션 표면** renderer 파일 수”** 이고 목표는 **1** 이다(해법 이름 `useGitSnapshot` 으로 세지 않는다 — 그러면 이미 고친 자리만 분모에 오른다). **허용 예외 1건을 술어에서 먼저 뺀다** — 랜딩 브랜치 칩(`composer/BranchChip.tsx`, 0201)은 `CwdPanel`(`data-state="landing"`) 안에만 살아 세션이 서면 사라지므로 D-031 이 말하는 표면이 아니다. 예외는 목록으로 열거하고 **그 파일이 아직 조회자인지도 함께 단언한다**(§5 음성 게이트 규칙) |

- 같은/동일 규칙이 여러 레이어에 있는 것: diff 범위 해석 하나뿐이고 `resolveDiffRange` 를 SSOT 로 둔다. 정규식·경로 규칙 복붙은 만들지 않는다. **ΔV1 이 두 번째를 만든다** — 조회 계기 판정이고 `gitSnapshotTriggers` 하나를 SSOT 로 둔다(`shouldRefetchGitStatus` 는 그 안으로 흡수되거나 그것이 부르는 하위 규칙으로 남는다. 두 판정이 각자 계기를 갖지 않게 한다).
- `실패 의미`에 “다른 게이트가 막는다”를 적은 행: 없음. 각 행의 실패 의미는 그 지점 자체의 관측 결과로 적었다.
- 선택적 필드의 의미. `LoadedSession.worktree` = `undefined` 는 “격리 세션이 아니거나 row 가 없다”이고 소비자는 실행 경로 파생으로 폴백한다(격리 여부를 별도 boolean 으로 두지 않는다 — 두 필드가 어긋날 수 있다). `GitDiffRequest.sessionId` = `undefined` 는 “세션 이전(랜딩)”이라 `HEAD` 범위다. `GitDiffRequest.commit` = `undefined` 는 `전체 변경`이다.
- **ΔV1 의 3값 필드**. `session.updated` 의 `patch.worktree` 는 **세 상태를 구분한다** — 키 **부재** = “이 갱신은 표시 정본에 관해 말하지 않는다”(기존 보존) · `null` = “표시 정본이 사라졌다”(폴백) · 객체 = “이 값으로 덮는다”. `undefined` 를 값으로 실지 않는다(직렬화 후 키 부재와 구분되지 않는다) — 발신부는 키를 넣거나 빼거나 둘 중 하나만 한다.
- **ΔV1 의 미결정 필드**. `GitDiffFileEntry.binary` 는 미추적 항목에서 `false` 다 — 요약 시점에 파일을 읽지 않으므로(D-026) 판정하지 않는다. **binary 의 정본은 본문 조회**(`gitDiffFile` 의 NUL 검사)이고 요약의 이 값은 수치 표시에 쓰이지 않는다(미추적은 어차피 `+0 −0`).
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

### ΔV1 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | 계약 | `session.updated.patch.worktree` 를 `WorktreeDisplay \| null` 로 넓힘 · `GitDiffSummary.totals: {added,removed}` 추가 · **`GitStatus.dirty` 제거** | 타입 |
| `app/src/main/infra/git/git-cli.ts` | 조회 | `gitStatus()` 에서 `dirtyStat` 호출 제거(함수 자체는 `gitCheckout` 이 계속 쓴다 — **지우지 않는다**) | 기존 `git-cli.test.ts` |
| `app/src/main/infra/git/git-diff.ts` | 조회 | `untrackedStat` **삭제**(`stat`+`readFile` 소멸) → `ls-files` 경로만 남기고 항목은 경로뿐. 독립 4조회(`numstat`·`name-status`·`show-toplevel`·`ls-files`)를 `Promise.all` 로 묶음 | 임시 저장소 통합 |
| `app/src/main/infra/git/git-diff-parse.ts` | 순수 | `mergeDiffEntries` 의 미추적 인자를 `readonly {path:string}[]` 로 좁히고 `added:0, removed:0, binary:false` 로 조립 · **절단 전** 합계 `totals` 를 같은 함수가 반환 | 순수 단위 (git 미의존) |
| `app/src/main/app/chat-turn/send.ts` | 발신 | `onRecovered` 의 patch 를 `{ cwd, worktree: null }` 로 | 기존 `send.worktree.test.ts` |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | 상태 | `session.updated` 판정을 `'worktree' in ev.patch` 로 · `gitDiff` 필드 + `SET_GIT_DIFF` · `diffCommit` 필드 + `SET_DIFF_COMMIT` · `gitRefreshNonce` + `REFRESH_GIT_SNAPSHOT` | 순수 리듀서 단위 |
| `app/src/renderer/src/features/chat/store/chatStore.ts` | 액션 | `setGitDiff` · `setDiffCommit` · `refreshGitSnapshot` | 순수 |
| `app/src/renderer/src/features/chat/hooks/useGitSnapshot.ts` (신규) | 조회 | **유일한** `gitApi.status`/`gitApi.diffSummary` 호출부. 계기 판정은 아래 순수 모듈에 위임하고 늦은 응답은 키로 버린다 | 스텁 주입 렌더 테스트 |
| `app/src/renderer/src/features/chat/hooks/gitSnapshotTriggers.ts` (신규) | **순수** | `gitQueryKey(cwd, sessionId, commit)` + `gitSnapshotTriggers(prev, next)` — 계기 판정 SSOT. `shouldRefetchGitStatus` 를 흡수한다 | 순수 단위 |
| `app/src/renderer/src/features/chat/components/Composer.tsx` | 배선 | `useGitSnapshot` 을 1회 호출(항상 마운트되는 호스트) | 렌더 |
| `app/src/renderer/src/features/chat/components/composer/GitRow.tsx` | 표시 | 두 effect **제거** → store 읽기만 | 렌더 |
| `app/src/renderer/src/features/chat/components/composer/gitRowState.ts` | 파생 | `gitRowView` 가 `status.dirty` 대신 요약 `totals` 를 받는다 | 기존 `gitRowState.test.ts` |
| `app/src/renderer/src/features/chat/components/rightpanel/DiffTileContent.tsx` | 소비 | `useDiffSummary` **제거** → store 읽기. `selectedCommit` 을 store 로. `collapsed`·`expanded`·`contents` 는 로컬 유지 | 렌더 |
| `app/src/renderer/src/features/chat/components/rightpanel/DiffTileHeader.tsx` | 표시 | 새로고침 버튼 추가 → `chatActions.refreshGitSnapshot` | 렌더 |
| `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` | 문구 | `chat.rightpanel.diffRefresh` 1키 | `resources.test.ts` |
| `docs/IPC_CONTRACT.md` | 문서 | `GitStatus`(dirty 제거) · `GitDiffSummary`(totals 추가) · `session.updated`(patch.worktree 3값) 세 행 갱신 | 게이트 |

- **레이어**: 신규 훅 2개는 `features/chat/hooks/` 다 — `shared/` 에 두면 도메인을 아는 범용 모듈이 되어 renderer AGENTS 의 4-layer 규칙을 깬다. `Composer` 는 같은 feature 내부라 import 방향이 하향이다.
- **`gitSnapshotTriggers` 가 순수여야 하는 이유**: 계기 판정이 훅 안에 인라인이면 렌더 하네스 없이는 “마운트가 계기가 아니다” 를 단언할 수 없는데, 그 판정은 전부 순수하다(0206 `branchChipState` 선례와 같은 축).
- **늦은 응답 폐기**: 요약은 `gitQueryKey` 로, 상태는 기존 `statusForCwd` 로 태그한다 — 두 축이 같은 훅 안에 있어도 키가 다르므로 각자 버린다.

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

#### ΔV1 기존 소비처 전수

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `CHANNELS` **81 유지** | 신규 채널 0 — 생성물 재생성 시 **차이 0** 이어야 한다. 차이가 나면 의도치 않게 채널을 만든 것이다 | §7-A ΔV1 gate 차분 |
| `NormalizedEvent` **22 유지** | `session.updated` variant 의 `patch` 필드 타입만 넓힌다 — variant 수 불변 | AT-16 |
| `patch` 발신부 3곳 | `claude-map.ts:185`(init) 과 `mock-scenarios.ts:771`(합성) 은 **`worktree` 키를 넣지 않는다** — 그것이 D-022 아래에서 “보존” 의미다. 폴백만 키를 싣는다 | AT-16 · AT-17 |
| `GitStatus` 소비자 | `dirty` 제거는 **깨는 변경**이다 — `gitRowState.ts` 가 컴파일 실패로 드러난다(의도된 강제). `handlers/git.ts:36` 의 `NOT_REPO` 폴백 리터럴도 고친다 | AT-18 · AT-19 |
| `gitCheckout` dirty 게이트 | **무영향** — 자기 `dirtyStat` 을 부른다(`git-cli.ts:121`). 기존 케이스가 계속 green 이어야 한다 | AT-19 회귀 |
| `BranchChip` dirty 모달 | **무영향** — `gitCheckout` 결과에서 온다(`branchChipState.ts:51`) | AT-19 회귀 |
| `gitRowView` 소비자 2곳 | 시그니처 변경이 `GitRow`·`DiffTileHeader` 둘 다에 닿는다 | AT-18 |
| `mergeDiffEntries` 소비자 | `git-diff.ts` 1곳. 인자 타입이 좁아지고 반환에 `totals` 가 붙는다 | AT-18 · VP-27 |
| `shouldRefetchGitStatus` 소비자 2곳 | `gitSnapshotTriggers` 로 흡수 — 남는 프로덕션 호출부는 훅 1곳 | AT-20 |
| `diffTileTree`·`diffTileData` | **무영향** — 입력 형태(`GitDiffFileEntry[]`)가 같고 수치만 0 이 섞인다 | VP-16 · VP-17 회귀 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 단계 상태는 `BEGIN_TURN` 에서 null 로 시작한다 — 이전 턴의 잔여가 새 턴 첫 프레임에 보이지 않는다.
- 취소/중단: 준비 중 `lease.controller.abort()` 가 걸리면 `service.prepare` 가 중단되고 더 이상 단계가 오지 않는다. 화면은 턴 종료 리셋으로 정리된다.
- 종료/quit/crash/renderer-gone: 단계 이벤트는 미영속이라 복구 대상이 아니다. 표시 이름은 DB row 이므로 재부팅 후 복원된다(AT-08).
- retry/timeout/partial failure: diff 조회는 재시도하지 않는다 — 다음 계기(타일 재열기·턴 종료)가 자연 재시도다(0206 D-004 와 같은 규칙).
- cleanup/rollback: 이번 변경은 새 부작용 자원을 만들지 않는다. 0209 의 worktree rollback 경로는 그대로다.
- **다중 저장소 쓰기**: 이번 변경의 쓰기 지점은 **0건**이다 — 단계 이벤트는 미영속, 표시 이름은 기존 row 읽기, diff 는 전부 읽기 전용(`runGit(..., {readOnly:true})`)이다. 0209 가 갖는 “worktree 생성 + DB insert” 2저장소 쓰기는 본 plan 이 건드리지 않는다. 산출 문서 축에서는 판정·상태가 `plan.md` 와 `INDEX.md` 두 곳에 산다 — 두 사본을 같은 턴에 갱신한다.

### ΔV1 lifecycle

- 생성/시작: `gitDiff`·`diffCommit`·`gitRefreshNonce` 는 세션 초기 상태에서 각각 `null`·`null`·`0` 이다. 랜딩에서는 훅이 아무것도 부르지 않는다.
- 세션 전환: 세션별 슬라이스라 스냅샷이 함께 따라간다. 훅은 새 세션의 키로 판정하므로 **다른 세션의 요약이 보이지 않는다**.
- 취소/중단: 조회는 읽기 전용이라 중단 대상이 아니다. 늦게 도착한 응답은 `gitQueryKey` 불일치로 렌더에서 버려진다(효과 안에서 상태를 비우지 않는다 — 그 비우기가 곧 cascading render 다).
- 커밋 선택 변경: 요약 키가 바뀌므로 이전 범위의 펼침·본문을 함께 버린다(V1 규칙 유지). 새 범위의 요약이 도착하기 전에는 `loading` 이다.
- **낡음(staleness)**: 앱 밖 git 변경은 어떤 계기도 잡지 못한다 — 이것이 D-030 새로고침 버튼의 존재 이유이고, 자동 감지는 §6 ΔV1 비범위다.
- **다중 저장소 쓰기 — ΔV1**: 여전히 **0건**이다. 세션 상태는 renderer 메모리 하나이고 DB·파일에 쓰지 않는다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`. 요약 = 파일 200 × (경로 + 숫자 2 + status) ≈ 수십 KB. 커밋 100 × (sha + subject + author + 시각) ≈ 수십 KB. 본문 = 1회 1파일 × 각 측 1 MiB = 최대 2 MiB/호출. renderer 가 동시에 들고 있는 본문은 펼침 20개 상한이라 최악 40 MiB — 상한이 없으면 파일 200개 전부 펼쳤을 때 400 MiB 라 그 차이가 상한을 두는 이유다.
- 새 요청 수의 `원천 상한 × 배치 상한`. 요약은 조회 계기 3종 × 1 = 사용자 조작·턴 종료당 1회(폴링 0). 본문은 사용자 펼침당 1회. 준비 단계 이벤트는 격리 신규 세션당 정확히 5건이다.
- git 프로세스 수. 요약 1회 = `diff --numstat` 1 + `ls-files --others` 1 + (격리면) `log` 1 = 최대 3. 본문 1회 = `show` 1 + 파일 읽기 1. `runGit` 의 `maxBuffer` 는 본문 조회에서 4 MiB 로 명시한다(1 MiB 상한 × 안전 여유).
- 구조적 목표(줄/파일/모듈 수): 없음.
- 캐시/최적화로 잃는 부수 효과: 요약을 세션 상태에 캐시하면 외부에서 저장소를 바꿔도 화면이 낡는다 — 그래서 계기 3종을 두고 폴링을 두지 않는 선택이다(D-017). 늦게 도착한 응답은 cwd 태그로 버린다(`statusForCwd` 선례) — 이 규칙이 없으면 cwd 를 바꾼 뒤 옛 저장소의 diff 가 화면을 되돌린다.

### ΔV1 — 비용 재계산

| 축 | AS-IS (V1) | TO-BE (ΔV1) | 근거 |
|---|---|---|---|
| 타일 토글 1회 | git **6** + 미추적 전량 `readFile` | **0** | D-029 가 상태를 store 로 올려 마운트가 계기가 아니다 |
| 세션 전환 왕복 | `gitApi.status` 재조회(git 5) | **0**(스냅샷 cwd 일치 시) | D-031 의 단일 훅이 보유 키를 먼저 본다 |
| 턴 종료 1회 | status 5 + (타일 열려 있으면) summary 6 = 5~11 | status **4** + summary **4~5** = 8~9, 그중 3건 병렬 | D-027 이 `--shortstat` 을, D-026 이 `readFile` 을 없앤다. `Promise.all` 이 4 왕복을 1로 |
| 미추적 N개 저장소 | `readFile` **N회** + 내용 전량 UTF-8 변환 | **0** | `untrackedStat` 삭제 |

- **캐시/최적화로 잃는 부수 효과 — ΔV1**: “타일을 닫았다 열어 새로고침” 이라는 **암묵적 갱신 수단이 사라진다**. D-030 의 새로고침 버튼이 그 능력을 명시적으로 되돌린다 — 잃은 것을 적고 대체를 두는 것이 이 항목의 요구다.
- **병렬화가 잃는 것**: 없다. 네 조회는 전부 `runGit(..., {readOnly:true})` 이고 `GIT_OPTIONAL_LOCKS=0` 이라 index.lock 을 잡지 않는다. 다만 `ls-files`/`numstat` 은 `repoRoot` 결과에 의존하지 않으므로 **`repoRoot` 만 별도 축**임을 구현이 확인한다.
- **동시 git 프로세스 상한**: 요약 1회의 병렬 폭은 4 다. `git-cli.test.ts` 가 전체 병렬 실행에서 간헐 실패한 관측(§[구현자 기입] Review Signals)이 있으므로 폭을 더 늘리지 않는다.

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
| 0206 D-020 “조회는 `useGitRowStatus` 한 곳뿐이고 diff 헤더는 같은 스냅샷을 읽는다” | `DiffTileHeader.tsx:51` | D-031 · §11 ΔV1 | **강화** — V1 이 `DiffTileContent` 에 두 번째 조회자를 만들어 그 결정을 깼다. ΔV1 이 소유자를 다시 하나로 되돌린다 |
| 0206 D-004 “턴이 끝나는 전이에서만 다시 조회” | `gitRowState.ts:58` | D-028 | **복원** — V1 D-017 이 “타일 열림” 계기를 더했고 ΔV1 이 그것을 뺀다. 남는 것은 0206 이 잠근 두 계기 + 사용자 질의 축 둘(커밋·새로고침) |
| 0206 D-013 “설정 메뉴·펼치기·이동 핸들을 두지 않는다 — 대응 동작이 없다” | `DiffTileHeader.tsx:9` | D-030 | **유지** — 금지의 조건절은 “대응 동작이 없다” 이고 새로고침은 대응 동작이 실재한다. 셋을 추가하지 않는다 |
| 0206 D-005 “git 행의 버튼은 변경량 하나” | `GitRow.tsx:15` | D-025 | **유지** — 버튼 개수·역할 불변. 그 안에 그리는 수의 **출처만** 바뀐다 |
| 0210 D-107/D-109 “폴백은 `patch.cwd` 로 통지” | 0210 plan §3 | D-023 · §10 EP-10 | **유지 + 보강** — 같은 이벤트·같은 `patch` 를 쓴다. 새 wire variant 0 이고 `worktree: null` 키 하나가 더 실릴 뿐이다 |
| 0209 D-005 → 0210 D-105 의 untracked 취급 | 0209/0210 plan §3 | D-026 | **무관** — 그 축은 *격리 거부* 판정이고 ΔV1 은 *표시 수치* 다. 두 축은 만나지 않는다 |
| `git-cli.ts:56` “미추적 파일은 … 경고에서도 해소에서도 일관되게 뺀다” | 코드 주석 | D-026 · D-027 | **확장** — 그 일관성을 표시 축까지 넓힌다. checkout 경로의 의미는 그대로다 |
| renderer 4-layer “`shared/` 에 도메인 로직을 넣지 않는다” | `app/src/renderer/AGENTS.md` | §11 ΔV1 신규 훅 2건 | **유지** — 두 파일 모두 `features/chat/hooks/` 다 |

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

### ΔV1 리스크

| 리스크 | 완화/결정 |
|---|---|
| 키 유무 판정이 직렬화를 건너며 무너진다 | `sendChatEvent` 는 structured clone 이라 키 존재가 보존된다. 다만 **`undefined` 를 값으로 실으면 키가 사라지므로** §10 이 “키를 넣거나 빼거나 둘 중 하나” 를 계약으로 적었고 VP-20 의 형제 변이(`!= null` 판정)가 그 축을 잡는다 |
| `GitStatus.dirty` 제거가 다른 소비자를 깬다 | 전수 실측 소비 1건(`gitRowState.ts`)이고 그것이 이번 변경 대상이다. 나머지 히트 2건은 선언·폴백 리터럴. 놓친 소비자가 있으면 **typecheck 가 즉시 red** 다(optional 이 아니라 제거이므로) |
| 요약을 늘 조회해 턴마다 비용이 는다 | 컴포저 행이 그 값을 **항상** 표시하므로 낭비가 아니다(타일 개폐와 무관하게 필요하다). D-026·D-027 이 같은 변경에서 조회당 비용을 낮춘다(§14) |
| 새로고침 버튼이 0206 의 헤더 금지와 충돌한다 | 금지의 조건절이 “대응 동작이 없다” 이고 새로고침은 실재한다(§16). 셋(설정·펼치기·이동)은 추가하지 않는다 |
| 상태를 store 로 올려 세션 수만큼 요약이 쌓인다 | 세션 슬라이스는 이미 `gitStatus` 를 그렇게 들고 있고 요약은 파일 200 상한(D-016)이라 수십 KB 다. 활성 세션만 조회한다(§6 ΔV1 비범위) |
| 병렬 git 4개가 간헐 실패를 늘린다 | 폭을 4로 고정하고 늘리지 않는다(§14). 전부 read-only + `GIT_OPTIONAL_LOCKS=0` |
| 라운드 1 verify 가 밀린 채 설계가 바뀐다 | ΔV1 은 V1 pair 를 **지우지 않는다** — 영향 없는 것은 `NOT_REQUIRED`(근거 포함), 영향받은 것은 `REGRESSION` 으로 남겼다. VP-08 은 여전히 `SELF_BLOCKED` 이고 라운드 1 verify 의 몫이다 |

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

### ΔV1 영향 파일 (전수)

- `app/src/shared/ipc.ts` — patch 3값 · `GitDiffSummary.totals` · `GitStatus.dirty` 제거
- `app/src/main/infra/git/{git-cli,git-diff,git-diff-parse}.ts`
- `app/src/main/app/chat-turn/send.ts` (`onRecovered` 1줄) · `app/src/main/app/handlers/git.ts` (`NOT_REPO` 리터럴)
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` · `store/chatStore.ts`
- `app/src/renderer/src/features/chat/hooks/{useGitSnapshot,gitSnapshotTriggers}.ts` (신규 2)
- `app/src/renderer/src/features/chat/components/Composer.tsx` · `composer/{GitRow.tsx,gitRowState.ts}`
- `app/src/renderer/src/features/chat/components/rightpanel/{DiffTileContent,DiffTileHeader}.tsx`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md` · `docs/handoff/INDEX.md`

> **건드리지 않는 것**(ΔV1 비영향 pair 의 근거): `features/worktrees/service.ts` · `app/chat-turn/prepare-worktree.ts` · `lib/activityLabel.ts` · `components/StatusLine.tsx` · `CwdButton.tsx` · `lib/worktreeDisplay.ts` · `rightpanel/{diffTileData,diffTileTree}.ts` · `app/handlers/session.ts` · `preload/index.ts`.

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

## READY self-review — ΔV1 (2026-08-31)

- [x] 결정이 `ACTIVE/SUPERSEDED/OPEN` 으로 보존된다 — 신설 D-022~D-031, 대체 3건(D-009→D-025 · D-011→D-026 · D-017→D-028). `OPEN` 0건.
- [x] 사용자 표현을 재해석하지 않았다 — §2 ΔV1 에 7줄을 원문 인용했고, “untracked file은 수치에 추가하지 않도록” 의 *수치* 를 목록이 아니라 `added`/`removed` 로만 읽었다(D-026 이 목록 절을 D-011 에서 승계).
- [x] 사용자에게 물을 결정과 조사로 닫을 사실을 구분했다 — §4 ΔV1 11행 전부 코드 관측으로 닫았고, 올릴 결정 0건. 가시적 결과 1건(미추적 `+0 −0`)은 §3 갱신 메모에 검토용으로 남겼다.
- [x] **증상이 아니라 원인을 겨냥한다** — 사용자 가설(“매번 랜더링·성능 저하”)을 코드로 반증하고(`CwdButton.tsx:32` 조회 0건) 실제 원인(`chatReducer.ts:468` × `claude-map.ts:185`)을 §4 ΔV1 첫 두 행에 적었다.
- [x] 수치·전칭·앵커·기존 테스트 인용을 **이번 세션에 재실측**했다 — 채널 81 · git 도메인 5 · `dirty` 소비 1 · `shouldRefetchGitStatus` 2 · `diffSummary` 호출부 1 · patch 발신부 3. 내역 합 검산: EP-10~13 = 2+2+2+3 = **9**, V1 21 + 9 = **30**.
- [x] Delta V 를 썼고 기준을 고정했다 — `V1` @ `0d8cf037`. 변경 시작 수준 `R`.
- [x] 모든 `NEW`·`CHANGED` node 에 같은 레벨 `REQUIRED` pair 가 있다 — R-16~R-21(VP-20~VP-25) · MD-07(VP-26) · MD-08(VP-27) · AR-05·AR-06(VP-20~23 에 귀속) · SD-06(VP-24).
- [x] 영향받은 `INHERITED` 는 `REGRESSION`, 비영향만 `NOT_REQUIRED` 다 — REGRESSION 11 pair, NOT_REQUIRED 7 pair(전부 출처·기존 증거·비영향 근거 3열을 가짐).
- [x] **영향 없는 기준 V 전체를 복사하지 않았다** — ΔV1 pair 표는 18행이고 V1 의 19 pair 중 관련 없는 것은 등장하지 않는다.
- [x] 각 pair 가 production path · §10 전수 분모 · 직접 oracle 을 갖는다.
- [x] 적대 증거를 고른 6건(VP-20·21·22·23·24·27)이 이유와 심을 결함을 갖는다. **VP-20·VP-24 는 형제/양방향 변이**다 — 키 판정을 `!= null` 로 바꾸는 변이(폴백을 삼킨다)와, 조회를 통째로 없애는 방향(증가 1 → 0)을 각각 잡는다.
- [x] “X 가 쓰인다” 불변식의 장치가 X 제거·형제 교체에 실패한다 — EP-10 은 두 지점이 서로를 대신하지 못함을 `실패 의미` 칸에 적었고 VP-20·VP-21 이 각 지점을 따로 잡는다.
- [x] **음성/혼합 술어를 분해했다** — AT-19 의 `--shortstat` 은 “1건 남는다”(양성)와 “`gitStatus` 내 호출 0건”(음성)을 **두 술어로** 세고, AT-20 은 “증가 0”과 “증가 1”을 같은 케이스에서 짝지었다(§7 ΔV1 주의사항).
- [x] **N회/총량 식의 분모를 전수 검색으로 세고 술어를 불변식의 주어로 썼다** — EP-13 의 분모는 “`gitApi.status`/`diffSummary` 를 부르는 renderer 파일 수 = 1” 이고 해법 이름(`useGitSnapshot`)으로 세지 않는다.
- [x] semantic 목표를 structural proxy 만으로 검증하지 않는다 — AT-18 이 구조 단언(`totals` 를 읽는다) 위에 **증상 반증**(커밋 후 `totals.added > 0`)을 얹었다.
- [x] 선택적 필드의 의미를 확인했다 — §10 에 `patch.worktree` 의 **3값**(키 부재/`null`/객체)과 `binary` 의 미결정 의미를 적었다.
- [x] “제거” 요구가 능력 자체를 없애도 되는지 물었다 — D-027 은 능력이 남는다(checkout 의 `dirtyStat`), D-028 은 **없앤다**고 판정하고 D-030 으로 대체 affordance 를 같은 변경에 두었다.
- [x] 최적화가 잃는 부수 효과를 적었다 — §14 ΔV1 두 항(암묵적 갱신 수단 상실 → D-030 · 병렬화는 잃는 것 없음 + 폭 4 고정).
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 ΔV1 10행(채널 불변·patch 발신부 3·`GitStatus` 소비자·checkout·BranchChip·`gitRowView` 2·`mergeDiffEntries`·트리 파생).
- [x] 신규 모듈의 레이어·강제 지점·테스트 seam 이 있다 — 훅 2건 모두 `features/chat/hooks/`, EP-13, 순수 단위 + 스텁 주입 렌더.
- [x] 게이트가 대상 subtree `AGENTS.md` 와 충돌하지 않는다 — §7-A ΔV1 gate 차분(ABI 중립 둘 + 순수 vitest, DB 스위트 증가 0).
- [x] 본문 완성 후 Decision Ledger 와 교차검증했다 — **ΔV1 ACTIVE 결정 ↔ AC 대조: 충돌 0**(§3 ΔV1 갱신 메모에 9쌍 기록). 대체된 3결정에 걸려 있던 AC 3건(AT-07·AT-09 문면, AT-09 계기 절)을 다시 유도해 §7 에서 고쳤다.
- [x] 산출물 문장 규칙을 지켰다 — 판정 먼저, 한 줄 한 관측, 표 한 칸 3줄.

### ΔV1 규범 행 정정 (2026-08-31, 구현 중 발견)

- **§10 EP-13 ① 의 술어**를 고쳤다. 원문은 "`gitApi.status`/`diffSummary` 를 부르는 renderer 파일 = 1" 이었는데, 그 술어로 세면 **0201 의 랜딩 브랜치 칩이 분모에 들어와 성립할 수 없다** — `BranchChip.tsx:63` 이 `gitApi.status` 를 부르고 ΔV1 은 그 파일을 건드리지 않는다(실측: 프로덕션 호출 파일 **2**).
- 정정 방향은 **예외 열거**다(§5 음성 게이트 규칙 — "허용 예외를 먼저 열거하고 술어에서 제외한다"). D-031 본문은 처음부터 소비 표면을 셋(`GitRow`·`DiffTileHeader`·`DiffTileContent`)으로 한정했으므로 **Decision 은 바뀌지 않는다** — 바뀐 것은 §10 의 재서술뿐이다.
- 예외가 구멍이 되지 않도록 oracle 이 **예외 파일이 아직 조회자인지**도 단언한다(`gitQueryOwner.test.ts`) — 예외 목록이 사라진 파일을 가리키면 그 자리는 조용히 열린다.


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
| VP-13·17 | 예시 표면 소멸 | EP-09 `diffTileMock.ts` 파일 · `diffMockNotice` ko/en (2) | 2/2 | 파일 부재(`ls rightpanel/ \| grep -i mock` → `diffTileMockRemoved.test.ts` 하나). 스윕 5케이스: import 0건 · 카탈로그 2개를 집었고 그 안에 키 0건 · 호출부 0건 | — |

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


---

> **ΔV1 라운드 (라운드 1 유지)** — 사용자 피드백에 따른 설계 변경이라 라운드를 올리지 않는다.
> 아래는 `[구현자 기입]` 일곱 필드를 ΔV1 범위로 **다시 채운 것**이다. V1 라운드 기록은 위에 그대로 둔다.

## [구현자 기입] 설계 리뷰 (ΔV1)

- 동의 / 그대로 진행: D-022~D-031 을 계약으로 수행했다. 설계가 전제한 셋이 코드에서 성립했다 — `claude-map.ts:185` 의 매 턴 `patch:{cwd}` · `writer.ts:192` 의 세션 메타 갱신 · `chatReducer.ts:189` 의 기존 `gitStatus` 슬라이스 자리.
- 이견 / 현실성 문제: **1건**. §10 EP-13 ① 의 전수 술어가 0201 랜딩 칩을 분모에 넣어 성립할 수 없었다 → 규범 행을 별도 설계 커밋으로 정정했다(§ΔV1 규범 행 정정).
- ACTIVE Decision 과 충돌하는 설계 발견: 없음. 다만 **앞 라운드 구현물이 D-024 를 과하게 읽어** resume 의 `session.updated` 를 통째로 억제했고, 그것을 되돌렸다(아래 Δ1).

## [구현자 기입] 강제 지점 전수 (§10 대조) (ΔV1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-20·21 | 키 유무 판정 · 폴백 명시 발신 | EP-10 ① 리듀서 판정 ② `send.ts` `onRecovered` (2) | 2/2 | `chatReducer.ts:493` = `Object.hasOwn(ev.patch, 'worktree') ? … : state.worktree` · `send.ts:176` = `patch: { cwd: executionCwd, worktree: null }` | — |
| VP-22·27 | 합계는 절단 전 · 미추적 0 | EP-11 ① 미추적 항목 조립 ② 합계 위치 (2) | 2/2 | `git-diff-parse.ts` 의 `merged.push({… added: 0, removed: 0 …})` · `const totals = merged.reduce(…)` 가 `merged.slice(…)` **앞**. 케이스 `합계는 **절단 전** 전체에서 센다` → 201/201 | — |
| VP-22·23 | dirty 축의 단일 정본 | EP-12 ① `GitStatus.dirty` 제거 + `gitStatus()` 호출 제거 ② `gitRowView` 가 totals (2) | 2/2 | `grep -c "dirty: GitDirtyStat" src/shared/ipc.ts` → **0** · `gitStatus` 본문 `dirtyStat` 호출 **0** · `grep -c -- "--shortstat" git-cli.ts` → **1**(checkout 전용, 남아야 함) · `gitRowState.ts:57` = `totals?.added ?? 0` | — |
| VP-24·25·26 | 조회 소유자 하나 · 마운트 비계기 | EP-13 ① 단일 호출부 ② `GitRow` effect 제거 ③ `DiffTileContent` 요약 effect 제거 (3) | 3/3 | 술어 전수(정정 후): `gitApi` 의 `status`/`diffSummary` 호출 프로덕션 히트 **2** = `useGitSnapshot.ts` + 열거된 예외 `BranchChip.tsx`. `grep -c useEffect GitRow.tsx` → **0** · `DiffTileContent` 의 `useDiffSummary`/`gitApi.diffSummary` → **0** | — |

- **분모를 자기가 정하지 않았는지**: EP-13 의 술어는 불변식의 주어(`gitApi.status`/`diffSummary` 호출)로 세고 해법 이름(`useGitSnapshot`)으로 세지 않았다. 그 술어가 예외 1건을 드러냈고, 그것이 규범 행 정정의 근거다.
- §10 에 없는데 같은 불변식이 필요했던 지점: **1건 — `handlers/git.ts:36` 의 `NOT_REPO` 폴백 리터럴**. EP-12 ① 의 "`GitStatus` DTO" 에 딸린 같은 형상이라 선조치했고, `handlers/git.test.ts` 가 그것을 red 로 잡았다.

**V-pair 자기확인** — 구현자의 `SELF_PASS` 는 독립 검증의 `PASS` 가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-20 | REQUIRED | SELF_PASS | `{cwd}` → `{worktree:D}` → `{cwd}` 시퀀스 뒤 `worktree === D` | required — M7(`!= null` 형제 변이) **red** (1 failed / 10) |
| VP-21 | REQUIRED | SELF_PASS | 폴백 patch 리터럴에 `worktree: null` 존재 + 수신 후 상태 null | required — M8(`worktree:null` 제거) **red** (1 failed / 14) |
| VP-22 | REQUIRED | SELF_PASS | 추적 3줄 + 미추적 2줄 → `totals` 가 추적분과 일치 · base 위 커밋 뒤 `totals.added > 0` | required — M11(미추적을 합계에) **red** (3 failed / 34) · M12(`gitRowView` 가 totals 무시) **red** (1 failed / 11) |
| VP-23 | REQUIRED | SELF_PASS | `GitStatus` 에 `dirty` own-key 없음 · checkout dirty 케이스 green | not selected — DTO·게이트 두 산출을 직접 관측 |
| VP-24 | REQUIRED | SELF_PASS | 프로덕션 조회 파일 = 1(+예외 1) · `GitRow` effect 0 | required — M13(`GitRow` 에 status 호출 복귀) **red** (1 failed / 1) |
| VP-25 | REQUIRED | SELF_PASS | 헤더 refresh 버튼이 `refreshGitSnapshot` 을 올린다(기존 `diffTile.render.test.ts` 케이스) | not selected — 클릭의 직접 행동 결과 |
| VP-26 | REQUIRED | SELF_PASS | `gitSnapshotQueryReason` 판정 — identity/turn-end/무계기 3분기 | not selected — 순수 입출력 |
| VP-27 | REQUIRED | SELF_PASS | 201건 입력 → `files` 200 · `totals` 201/201 | required — M10(합계를 `slice` 뒤로) **red** (1 failed / 18) |
| VP-04·05·06·07 | REGRESSION | SELF_PASS | `gitRowState.test.ts`·`worktreeDisplay.test.ts` 기존 케이스 green | not selected — 기존 oracle 재실행 |
| VP-09~12 · VP-14·16·17 | REGRESSION | SELF_PASS | `git-diff.test.ts` 16케이스 · `diffTileData`·`diffTileTree` green | not selected — 기존 oracle 재실행 |
| VP-19 | REGRESSION | SELF_PASS | 폴백 patch 뒤 `worktree === null` | not selected — 기존 oracle 재실행 |
| VP-01·02·03·08·13·15·18 | NOT_REQUIRED | — | ΔV1 이 그 파일을 건드리지 않는다(§18 ΔV1 "건드리지 않는 것") | — |

## [구현자 기입] 이번 라운드 수정의 잠금 (ΔV1)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `chatReducer.ts:493` — `Object.hasOwn` → `!= null` (형제) | VP-20 선택 증거 | 최초 | `chatReducer.prepareStep.test.ts` 1건 | 잠김 |
| `send.ts:176` — 폴백 patch 에서 `worktree: null` 제거 | VP-21 선택 증거 | 최초 | `send.worktree.test.ts` 1건 | 잠김 |
| `claude-map.ts` — resume init 을 다시 억제 | 이번 턴 정정(Δ1)의 인용 변이 | **이전 라운드에서 green — 억제가 프로덕션이었다** | `claude-map.test.ts` 1건 | 잠김 |
| `git-diff-parse.ts` — 합계를 `slice` 뒤에서 계산 | VP-27 선택 증거 | 최초 | `git-diff-parse.test.ts` 1건 | 잠김 |
| `git-diff-parse.ts` — 미추적 `added` 를 되살림 | VP-22 선택 증거 | 최초 | parse 1 + `git-diff.test.ts` 2 = 3건 | 잠김 |
| `gitRowState.ts` — `totals` 를 무시하고 0 고정 | VP-22 선택 증거 | 최초 | `gitRowState.test.ts` 1건 | 잠김 |
| `GitRow.tsx` — 자기 `gitApi.status` 호출 복귀 | 새 oracle(EP-13 스윕) 민감도 | 최초 | `gitQueryOwner.test.ts` 1건 | 잠김 |

- **분모 검산**: `선택 증거 5(VP-20 · VP-21 · VP-22×2 · VP-27) · 인용 변이 1(Δ1) · 새 oracle 1(EP-13 스윕) = 표 행 7`.
- **덮개 회귀 검사**: 이전 라운드가 red 로 잡던 자리를 이번 라운드가 green 으로 되돌렸는지 확인했다 — `mock.test.ts` 의 resume 케이스는 이전 라운드가 "재발행하지 않는다" 로 **뒤집어 놓은** 단언이라 원문(`sessionId` 보존)으로 되돌렸고, `claude-map.test.ts` 에는 **양성 단언을 새로 추가**했다(resume init 이 이벤트를 내고 `worktree` 키는 싣지 않는다). 이 축은 잡는 방향이 반대로 바뀐 자리였고 지금은 양쪽이 다 잠긴다.
- **스윕 민감도의 취약 지점**: EP-13 스윕은 *대상 집합*이 비면 침묵하므로 `files.length > 50` 을 먼저 단언하고, *예외 목록*이 죽은 파일을 가리키면 구멍이 되므로 예외 파일이 아직 조회자인지도 단언한다.

## [구현자 기입] Product/UX 파생 검토 (ΔV1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있다 | `chat.rightpanel.diffRefresh` 1키(ko/en) → `DiffTileHeader` 새로고침 버튼의 `aria-label`/`title`. `resources.test.ts` 패리티 green |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 전부 있다 | §5 ΔV1 12행이 2턴 이후·폴백·커밋 후 합계·미추적 0·타일 재열기·세션 전환·앱 밖 변경·새로고침을 각각 갖는다 |
| 실패가 "아무 일도 안 일어남" 으로 보이지 않는가 | 보이지 않는다 | 요약 조회 실패는 **기존 요약을 유지**하고 다음 계기가 재시도한다. 상태 조회 실패는 `status: null` 로 접혀 행이 사라진다 — 기존 동작 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 되돌리지 않는다 | 요약은 `{key, generation}` 두 축, 파일 본문은 `createDiffFileRequestOwner` 의 세대, 상태는 기존 `statusForCwd` 의 cwd 태그 |
| 없앤 능력에 대체가 있는가 | 있다 | "타일 재열기 = 새로고침" 이 사라진 자리에 D-030 버튼을 뒀다. 앱 밖 git 변경의 **자동** 감지는 §6 ΔV1 비범위 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (ΔV1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| Δ1 | 앞 라운드가 D-024("재발신하지 않는다")를 **"resume 은 `session.updated` 를 내지 않는다"** 로 읽어 `claude-map`·`mock` 에서 이벤트를 통째로 억제했다. 그러면 `writer.ts` 의 preview·title·providerKey 갱신이 **그 case 안에만** 있어 후속 메시지마다 세션 목록이 낡는다. | ✅ 선조치 — 억제를 되돌리고 양성 단언을 추가했다. D-022 의 키 유무 판정이 표시 정본을 이미 지키므로 이 이벤트를 죽일 이유가 없다. | `writer.ts:192-196`(세 갱신이 `case 'session.updated'` 안) · `turn-context.ts:167`(`pendingUserText` 는 resume 에도 채워진다) |
| Δ2 | `GitStatus.dirty` 제거가 `handlers/git.ts` 의 `NOT_REPO` 폴백 리터럴에도 걸린다 — §10 EP-12 는 DTO 와 소비자만 적었다. | ✅ 선조치 — 리터럴에서 제거. 같은 형상이라 별도 지점으로 세지 않았다. | `handlers/git.test.ts` 가 red 로 잡음 |
| Δ3 | §11 ΔV1 은 신규 훅을 `features/chat/hooks/` 에 두라고 적었으나 앞 라운드가 `features/chat/components/composer/` 에 만들었다. | ⚠️ 보고만 — 옮기지 않았다(아래 설계 대비 명시적 차이). 레이어 규칙은 양쪽 다 만족하고, 옮기면 기존 테스트 경로만 흔든다. | `useGitSnapshot.ts` · `gitSnapshotQuery.test.ts` |
| Δ4 | 요약 조회 **실패 시 기존 요약을 유지**하는 정책을 앞 라운드가 골랐다 — plan 은 이 축을 명시하지 않았다. | ⚠️ 보고만 — 사용자가 받는 결과가 달라지는 선택이다(낡은 수치를 계속 보여줄지, 비울지). 현재 동작은 §5 "조회 실패는 값으로 접힌다" 와 어긋나지 않는다. | `useGitSnapshot.ts` 의 `createGitSnapshotQueryOwner` 빈 catch |
| Δ5 | 요약을 **턴마다** 조회하므로 diff 타일을 한 번도 열지 않은 세션도 비용을 낸다. | ⚠️ 보고만 — 설계가 의도한 것이다(§14 ΔV1: 컴포저 행이 그 값을 항상 표시하므로 낭비가 아니다). 관측만 남긴다. | §14 ΔV1 비용표 |

### 설계 대비 명시적 차이 (ΔV1)

- **1건**. §11 ΔV1 은 `features/chat/hooks/{useGitSnapshot,gitSnapshotTriggers}.ts` + 호스트 `Composer.tsx` 를 적었고, 실제는 `features/chat/components/composer/useGitSnapshot.ts`(순수 판정 포함) + 호스트 `GitRow.tsx` 다. 파일을 옮기는 이득이 없어 유지하고 §10 SSOT 경로를 실제 자리로 고쳤다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 훅의 상태(`useRef`·`useState`) 수명이 호스트 컴포넌트와 같고 별도 TTL 이 없다. | EP-13 ①③ 재확인: 조회 파일 1 · `DiffTileContent` 요약 effect 0 |
| **공유** (누가 함께 쓰고 누가 비울 수 있는가) | **있다** — 호스트가 `Composer` 가 아니라 `GitRow` 라, `GitRow` 가 언마운트되면 훅도 죽는다. `Composer.tsx:286` 이 `<GitRow>` 를 **조건 없이** 렌더하고 노출 판정은 `gitRowView` 안에서만 하므로(0206 §10 EP-05) 실제 수명은 `Composer` 와 같다. 세션 상태(`gitSnapshot`)는 훅 밖 store 라 언마운트가 값을 비우지 않는다. | `Composer.tsx:286` 무조건 렌더 확인 · `chatReducer.ts:288` 초기값이 세션 슬라이스에 있음. AT-20 재확인: 타일 토글이 훅 수명에 닿지 않는다 |
| 재진입 | 해당 없음 — `createGitSnapshotQueryOwner` 가 `generation` 단조 증가로 최신 하나만 커밋한다. 같은 키의 A→B 순서 역전은 `gitSnapshotQuery.test.ts` 가 잠근다. | EP-13 ① · VP-26 관측 |
| 다른 무효화 축 | **있다** — `SET_CWD` 가 요약·선택·요청 토큰을 즉시 비운다(앞 라운드 추가). 이것이 없으면 cwd 를 바꾼 직후 프레임에 이전 저장소의 요약이 남는다. | `chatReducer.plan.test.ts` 의 cwd identity 케이스 green |

## [구현자 기입] 구현 보고 (ΔV1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 4 구현 커밋 합계 **29파일**(신규 2: `gitQueryOwner.test.ts` · `diffFileCache.test.ts`) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npx vitest run` · 변이 7종 각각 focused `npx vitest run <suite>` |
| **관측한 게이트 산출**(exit code 아님) | **lint** 0 error / 1 warning(기존분 — `useTranscriptVirtualizer.ts:22` react-hooks/incompatible-library). **typecheck** 3구성 0줄. **vitest 전체** 287파일 2794케이스 → **2793 pass · 1 fail**(그 1건 = `handlers/git.test.ts` 폴백 리터럴, 같은 실행 중 고쳐 green — 재실행 74파일 655케이스 all pass), **suite 실패 1** = `chat-turn.continuity.test.ts` `Electron failed to install correctly` — **환경 기인**(`app/AGENTS.md §제약 환경` 의 알려진 서명), 변경 무관 |
| V-pair 자기확인 | `SELF_PASS` REQUIRED 8 + REGRESSION 9 · `NOT_REQUIRED` 7 · `SELF_BLOCKED` 0 |
| 강제 지점 전수 | **9/9** (EP-10 2 · EP-11 2 · EP-12 2 · EP-13 3). V1 의 21 과 합쳐 유효 **30/30** |
| **AC 자기보고**(`Criteria-Met`) | **6/6** — ✅ AT-16(3단계 시퀀스 후 `worktree === D`) · AT-17(폴백 리터럴 + 수신 후 null) · AT-18(추적 3줄·미추적 2줄 → totals 추적분 일치 · 커밋 후 `totals.added > 0`) · AT-19(`dirty` own-key 0 · `--shortstat` 1 · checkout 케이스 green) · AT-20(조회 파일 1 + 예외 1 · `GitRow` effect 0) · AT-21(refresh 버튼 → `refreshGitSnapshot`) |
| **합계 검산** | `✅ 6 · ⚠️ 0 · ❌ 0 = 총 6` (ΔV1 AC 총수 재계수: §7 ΔV1 표 6행 = AT-16~AT-21). V1 의 15 와 분모가 다르므로 직접 비교하지 않는다 |
| 블로커 / 역질문 | 없음. Δ4(조회 실패 시 기존 요약 유지)는 결정권자 확인 대상으로 남긴다 |
| 대상 커밋 | `(ΔV1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (ΔV1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **부분적으로 그렇다**. `session.updated` 의 의미 축이 V1 라운드(전달 지점)와 ΔV1(판정 축 · 이벤트 수명)에서 두 번 열렸다.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **D-024 의 문장**이다. "재발신하지 않는다" 는 *추가하지 마라* 였는데 구현이 *내지 마라* 로 읽었다 — 조건절("전달 지점은 V1 의 둘 그대로다")이 같은 행에 있었으나 그 절을 근거로 삼지 않았다. 반대로 **EP-13 의 술어 규칙은 작동했다** — 해법 이름 대신 불변식의 주어로 세라는 지침이 예외 1건을 드러냈다.
- 반복해서 부딪히는 환경 한계: ① `chat-turn.continuity.test.ts` 의 electron 미설치(이 체크아웃은 better-sqlite3 ABI 가 정상이라 DB 스위트는 green 이었다 — V1 라운드와 다른 환경). ② 이 저장소 vitest 는 node 전용이라 React mount/effect 실기가 불가하고, 그래서 계기 판정을 순수 함수로 내려 단언한다.
- 현재 라운드 수: 1 (ΔV1 설계 변경은 라운드를 올리지 않는다 — 사용자 명시)


## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
