# Plan — 0209-git-worktree-isolation

## 메타

| 항목 | 값 |
|---|---|
| slug | `0209-git-worktree-isolation` |
| 작성자 | Claude Code |
| 일자 | 2026-08-28 |
| 매핑 | Host Git 기반 신규 세션 worktree 격리 + 향후 Source Control 기반 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 현재 앱 Main은 Git status·branch list·checkout을 직접 실행하지만 Agent 작업은 사용자가 고른 checkout에서 그대로 수행된다. Agent가 파일을 바꾸면 사용자의 원래 checkout과 같은 작업 트리를 공유하고, 앱이 만든 격리 작업의 수명·소유권을 재시작 뒤 식별할 영속 정보도 없다.
- 완료 후 달라지는 것: 사용자는 **신규 세션을 보내기 전** worktree 격리를 선택할 수 있다. Host가 커밋된 현재 HEAD에서 앱 관리 worktree와 Agent 비종속 branch를 만든 뒤 하위 cwd 위치를 보존한 `executionCwd`만 기존 턴 경로에 넣는다.
- 장기 기반: Git command wrapper와 Orca 제품 정책을 분리해 이후 diff·stage·commit·branch·push를 같은 Main Git 계층 위에 추가할 수 있다. 이번 작업은 Source Control UI나 범용 Workspace 프레임워크를 선행하지 않는다.
- 성공을 사용자 관점에서 한 문장으로: 깨끗한 Git checkout에서 격리를 켜고 새 대화를 시작하면 원래 checkout을 건드리지 않는 별도 branch/worktree에서 Agent가 일하며, 앱을 재시작해도 같은 세션이 같은 경로로 복원된다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “Git executable은 기존처럼 앱 Main이 직접 사용한다.” | 라이브 세션 제안 §23 |
| 명시 요구 | “Worktree는 특정 Agent 기능이 아니라 Orca-skin이 제공하는 Git 작업 격리 기능이다.” | 같은 제안 §23 |
| 명시 요구 | “필요한 Git 기능만 추가하고, 현재 `cwd → Runtime → Adapter` 실행 구조는 그대로 유지한다.” | 같은 제안 §23 |
| 명시 요구 | Git CLI를 유지하고 `execFile("git", args)` 배열을 쓰며 Git library·MCP를 도입하지 않는다. | 같은 제안 §3.2·§5·§22 |
| 명시 요구 | base는 준비 시점 HEAD OID, dirty source는 거부, 저장 위치는 repository 밖 앱 관리 영역이다. | 같은 제안 §7.2·§10·§11 |
| 명시 요구 | 실제 repository/branch 문자열이 아닌 안정적 내부 ID를 filesystem identity로 쓴다. | 같은 제안 §11 |
| 명시 요구 | branch naming 실패는 fallback으로 강등하고 Agent 이름은 namespace에 넣지 않는다. | 같은 제안 §7.3·§8 |
| 명시 요구 | worktree metadata는 별도 최소 테이블에 두고 SDK session ID 발급 뒤 nullable 연결을 채운다. | 같은 제안 §13 |
| 명시 요구 | Runtime 종료·LRU·앱 종료에는 지우지 않고, 세션 삭제 때도 clean+새 commit 없음이 증명될 때만 자동 제거한다. | 같은 제안 §14 |
| 명시 요구 | 초기 구현은 Phase 1 핵심과 Phase 2 UX이며 Source Control 확장은 필요할 때만 한다. | 같은 제안 §20 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | Git은 Main의 Host 기능이며 Agent Adapter·SessionRuntime은 worktree를 모른다. | backend-neutral `cwd` 경로가 이미 있다. | 사용자 명시 | ACTIVE | — |
| D-002 | PATH의 `git`을 `execFile`로 직접 실행한다. shell 문자열·Git library·Git MCP를 쓰지 않는다. | Git이 repository/ref/worktree의 정본이다. | 사용자 명시 | ACTIVE | — |
| D-003 | 이번 구현은 Phase 1+2를 한 수직 절단으로 닫는다: 선택 UI, core isolation, fallback+LLM naming, dirty 안내, 영속·resume·안전 삭제를 포함한다. | 수용 기준의 “선택할 수 있다”와 naming failure 격리는 UX 없이 닫히지 않는다. | 요구 종합 | ACTIVE | — |
| D-004 | 격리는 신규 일반 세션만 허용한다. resume에는 기존 metadata를 재사용하고 fork/handoff에는 이번 선택을 노출하지 않는다. | 사용자는 “Fork/Handoff별 별도 Worktree”를 금지했다. 원본 계보의 cwd 정책 변경은 별도 결정이다. | 사용자 명시 + 현행 continuity | ACTIVE | — |
| D-005 | source checkout은 tracked·untracked를 모두 포함해 `git status --porcelain`이 비어야 한다. | worktree에 자동 복제되지 않는 미커밋 상태 전부를 명시적으로 거부해야 데이터 누락을 숨기지 않는다. 기존 checkout UI의 tracked-only dirty 의미와 섞지 않는다. | 사용자 명시의 dirty source + 보수 해석 | ACTIVE | — |
| D-006 | base는 `resolveHead(sourceCwd)`가 준비 초기에 반환한 full OID이고 `worktree add`까지 같은 값으로 고정한다. | 원래 branch가 준비 중 이동해도 기준이 변하지 않는다. | 사용자 명시 | ACTIVE | — |
| D-007 | 경로는 `<userData>/worktrees/<repoId>/<worktreeId>`이며 두 ID는 random UUID다. repo/branch 문자열은 세그먼트가 아니다. | 안정적 내부 identity·repository 밖 저장 요구를 동시에 닫는다. | 사용자 명시 | ACTIVE | — |
| D-008 | branch 기본 prefix는 `work`; LLM은 slug만 제안하고 Orca가 sanitize·`git check-ref-format --branch`·충돌 suffix를 최종 결정한다. 실패 시 `work/<worktreeId 앞 8자>`를 쓴다. | naming은 편의 기능이고 격리의 성공 조건이 아니다. Agent 이름과 분리한다. | 사용자 명시 | ACTIVE | — |
| D-009 | naming completion은 기존 제목 completion과 합치지 않는다. 준비 시 별도 1-shot, 10초 timeout으로 수행한다. | 실패 범위와 기존 제목 동작을 격리한다. 최대 신규 왕복은 격리 신규 세션당 1회다. | 사용자 명시 | ACTIVE | — |
| D-010 | `managed_worktrees`는 최소 metadata만 가지며 `session_id`는 nullable+unique FK(`ON DELETE SET NULL`)다. worktree 생성 후 row를 먼저 기록하고 `session.updated` 영속 뒤 bind한다. | Git+DB 두 저장소 사이 부분 실패를 복구·진단할 identity가 필요하다. 세션 삭제 전 정리 판단에는 row가 남아야 한다. | 사용자 명시 + 저장 순서 분석 | ACTIVE | — |
| D-011 | 생성 중 실패하면 이번 호출이 만든 worktree만 best-effort remove하고, 성공하지 못한 경로는 Agent에 전달하지 않는다. DB insert 실패도 같은 rollback 대상이다. | 반쯤 준비된 경로에서 Agent를 실행하지 않는다. | 파생 정책 | ACTIVE | — |
| D-012 | 세션 삭제는 먼저 worktree 보존/삭제를 판정한 뒤에만 세션·runtime을 지운다. clean+`HEAD == base_oid`일 때만 자동 remove+branch delete하며, dirty·commit 존재·검사 실패면 삭제를 거부하고 사용자에게 이유를 반환한다. | 기존 void 삭제가 먼저 session을 지우면 관리 연결과 사용자 작업을 잃는다. `--force`는 쓰지 않는다. | 사용자 명시 | ACTIVE | — |
| D-013 | 앱 종료·Runtime idle/LRU·Agent 종료에는 worktree 명령을 실행하지 않는다. 부팅 때 Git의 porcelain 목록과 DB를 읽어 상태만 재조정하고 외부 worktree는 관찰만 한다. | 세션 resume의 cwd를 보존하고 외부 소유 작업을 건드리지 않는다. | 사용자 명시 | ACTIVE | — |
| D-014 | repository 단위 mutation queue는 이번 구현에 넣는다. checkout과 worktree add/remove/branch delete가 같은 repo에서 직렬이고 read는 병렬이다. | 현재 checkout write와 신규 create/delete가 실제로 경합할 수 있다. `Map<canonical repoRoot, Promise>`면 충분하다. | 사용자 §15 + 현재 mutation 실측 | ACTIVE | — |
| D-015 | `extraDirs`는 source 경로 그대로 유지한다. worktree 내부 하위 경로로 자동 치환하지 않는다. | 요구는 `executionCwd` 치환만 명시했고 extraDirs는 read scope라 자동 복제하면 별도 권한 의미가 생긴다. | 범위 최소화 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 D-001~D-015를 신설했다. SUPERSEDED·OPEN 결정은 없다.
- 기존 `shared/ipc.ts`의 “worktree는 다루지 않는다(제품 결정)” 주석은 이번 사용자 결정이 대체하므로 IPC 계약 설명과 함께 갱신한다.
- **ACTIVE 결정 ↔ AC 대조**: 충돌 0. D-001↔AC5·AC6, D-002↔AC1, D-003↔AC2·AC14, D-004↔AC2·AC7, D-005↔AC8, D-006↔AC9, D-007↔AC10, D-008·D-009↔AC11, D-010↔AC12·AC13, D-011↔AC4, D-012↔AC15, D-013↔AC13·AC16, D-014↔AC17, D-015↔AC18.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 이미 기존 코드가 충족하는가 | 일부만 | `git-cli.ts`는 PATH `git`+`execFile`과 status/branches/checkout을 제공하지만 worktree command·metadata·선택 payload는 없다. |
| Adapter/Runtime 변경이 필요한가 | 아니오 | `send.ts → buildTurnContext → TurnRequest → claude.ts query`가 `cwd` 문자열을 끝까지 운반한다. Host가 TurnContext 조립 전 effective cwd만 바꾸면 된다. |
| 새 범용 Workspace 계층이 필요한가 | 아니오 | 정책은 `features/worktrees`, command는 `infra/git`, 조립은 `app/chat-turn` 세 책임으로 닫힌다. |
| runner 추출이 과설계인가 | 아니오 | 기존 status/checkout과 신규 worktree가 timeout/env/error/abort를 공유하고 write queue를 한 지점에 걸어야 한다. command object hierarchy는 만들지 않는다. |
| LLM naming이 핵심 경로를 취약하게 하는가 | fallback으로 해소 | completion 실패·timeout·invalid output을 모두 내부 ID slug로 강등하고 worktree add는 계속한다. |
| 세션 삭제에 바로 연동할 수 있는가 | 반환 계약 변경 필요 | 현행 handler는 runtime dispose와 DB delete를 먼저 하는 void 경로다. 안전 검사 실패를 UI에 보여주려면 result union과 순서 변경이 필요하다. |

- 사용자에게 올릴 결정: 없음. prefix 설정 UI는 사용자가 “설정 가능한 prefix”를 예로 들었지만 초기 범위의 필수 조건은 아니다. V1은 상수 `work`로 시작하고 설정 surface는 후속이다.
- 조사로 닫은 사실: Main Git 실행은 `infra/git/git-cli.ts`, 신규 턴 cwd 선택은 renderer `SendChatMessage.cwd`, 세션 cwd 영속은 `HistoryWriter.persist(session.updated)`, 삭제는 `app/handlers/session.ts`, 앱 관리 경로 SSOT는 `infra/config/paths.ts`다.

## 5. 동작 / 사용자 흐름

```text
[랜딩: cwd 선택 + "Worktree에서 격리" 선택]
  → chat:send { sessionId:null, cwd:sourceCwd, worktreeIsolation:true }
  → admission/lease 후, TurnContext 조립 전 prepareIsolation
      → repoRoot + relative(sourceCwd, repoRoot)
      → clean 검사 → HEAD full OID snapshot
      → branch slug completion (실패/invalid → short-id)
      → branch collision suffix + git validation
      → <userData>/worktrees/<repoId>/<worktreeId>
      → git worktree add -b branch path baseOid
      → managed_worktrees insert(session_id=null)
      → executionCwd = join(worktreeRoot, source relative path)
  → 기존 TurnContext.cwd → TurnRequest.cwd → SessionRuntime → Adapter → SDK
  → session.updated → sessions insert(executionCwd) → managed row bind(sessionId)

[resume]
  → sessions.cwd의 executionCwd 재사용 → 기존 실행 경로

[세션 삭제]
  → managed row 없음: 기존 삭제
  → managed row 있음: git 검사
      clean && HEAD == baseOid → worktree remove → branch delete → metadata/session 삭제
      그 외/검사 실패 → 삭제 거부 + 한국어 이유, 모든 산출물 보존
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 격리 off | worktree service를 부르지 않는다 | 기존 cwd 세션과 동일 |
| 격리 on + non-repo/Git 없음 | 준비를 실패 값으로 종료 | Agent는 시작하지 않고 저장소/Git 오류 안내 |
| 격리 on + dirty source | Git mutation 전에 거부 | “커밋된 현재 HEAD에서 시작하며 미커밋 변경이 있다” 안내 |
| naming 성공 | sanitize+validate+collision resolve | 의미 있는 `work/<slug>` branch |
| naming 실패/timeout/invalid | short-id fallback | 격리는 정상 생성 |
| worktree add 성공, DB insert 실패 | 생성한 worktree remove+branch delete best-effort | 턴 실패; orphan이면 구조화 로그로 identity 보존 |
| SDK init 전 앱/renderer 종료 | nullable metadata가 남음 | 다음 부팅에서 unmanaged가 아니라 Orca-managed orphan으로 식별 |
| resume | sessions.cwd 사용 | 같은 worktree 하위 cwd에서 계속 작업 |
| session delete + 작업 없음 | 안전 제거 후 session delete | 기존 삭제 UX 성공 |
| session delete + dirty/commit/검사 실패 | 아무것도 제거하지 않음 | 보존 이유 안내, 세션도 유지 |
| 외부 worktree 발견 | list 결과와 metadata를 비교만 함 | V1 UI 노출 없음, 절대 mutation 없음 |

### 파생 UX / 엣지케이스

- 선택 chip은 랜딩 `CwdPanel`에만 나타나고 session inflight 동안 disabled다. non-repo 여부는 send 시 Main이 최종 판정하므로 stale renderer status가 안전 결정을 소유하지 않는다.
- 체크 상태는 새 draft-local 값이며 새 채팅 기본값은 `false`다. 세션 생성 뒤에는 편집하거나 저장된 세션 상태를 토글하지 않는다.
- 오류는 i18n `ko.ts` label로 표시하고 raw stderr 전체를 renderer에 내보내지 않는다. command module이 첫 오류 문장을 분류된 reason으로 접는다.
- Windows에서는 path 비교/queue key에 `realpath`+`normalize` 결과를 쓰되 DB에는 실제 절대 경로를 보존한다. 하위 경로의 상대값이 `..`로 repo 밖이면 거부한다.
- 취소 신호는 naming completion과 Git runner에 전달한다. add 완료 직후 취소라면 D-011 rollback을 수행한다.

## 6. 범위 / 비범위

- **범위**: 공통 Git runner, repository/worktree 최소 함수, repo write queue, worktree service+naming, app-data 경로, 신규 migration+queries, 신규 세션 send 선택, effective cwd 치환, session.updated bind, resume, 안전한 session delete, 랜딩 chip·오류 UX, 관련 현재-state 문서.
- **비범위**: diff/stage/unstage/discard/commit/history/fetch/pull/push UI, GitHub/PR/API, 자동 stash/WIP commit/patch·untracked 복제, 외부 worktree mutation/UI, prefix 설정 UI, 범용 Workspace 테이블, fork/handoff별 worktree, Agent별 구현, Git dependency, `.git` 직접 파싱.

| 미룬 항목 | 나중 비용 | 처리 |
|---|---|---|
| title+branch 단일 completion | 낮음 — naming port 반환 형상만 바꾸면 됨 | 비용/지연 실측 후 별도 |
| prefix 설정 | 낮음 — naming input에 문자열 추가 | V1은 `work` 고정 |
| orphan 관리 UI | 중간 — metadata와 reconciliation 결과는 이미 있음 | 별도 UX |
| Source Control | 큼, 그러나 runner/worktree API와 독립 | 요구가 생길 때 command별 점진 확장 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 모든 Git 호출은 PATH `git`+`execFile` 인자 배열이며 shell=false다 | fake exec seam으로 executable·args·options 관측; shell 문자열/신규 Git dependency 정적 가드 | Main feature → infra/git/runner → OS git |
| R-02 | AT-02 / AC2 | 신규 일반 세션에서만 isolation을 선택하고 기본은 off다 | reducer+schema+landing component test; resume/fork/handoff payload 조합 거부 | CwdPanel → chatStore.send → SendChatMessageSchema |
| R-03 | AT-03 / AC3 | Host가 Agent 실행 전에 worktree를 만든다 | deferred addWorktree test에서 add resolve 전 runtime acquire 미호출, resolve 후 1회 | send prepare 단계 → TurnContext → runtime |
| R-04 | AT-04 / AC4 | 준비 실패/취소 시 Agent가 시작하지 않고 이번 호출 산출물만 rollback한다 | add/DB insert/abort 각 실패 주입 후 runtime 0회, remove 대상 ID 일치 | 같은 경로 + service rollback |
| R-05 | AT-05 / AC5 | Adapter는 worktree API/type을 import하지 않고 executionCwd만 받는다 | TurnRequest cwd 직접 단언 + boundaries/typecheck + adapter subtree `worktree` import 0 | TurnContext.cwd → TurnRequest.cwd → adapter query cwd |
| R-06 | AT-06 / AC6 | SessionRuntime/TurnCoordinator 실행 구조를 바꾸지 않는다 | 기존 cwd request/runtime suites regression; production diff에서 worktree 호출 0 | 기존 runtime path |
| R-07 | AT-07 / AC7 | 격리 선택은 신규 일반 세션 전용이다 | `sessionId!=null`, forkFrom, handoffFrom과 isolation 조합 schema red | IPC admission |
| R-08 | AT-08 / AC8 | tracked·untracked dirty source는 mutation 전에 거부한다 | porcelain fixture 3종(tracked/untracked/both)에서 add 0; clean에서 add 1 | service → worktree status porcelain |
| R-09 | AT-09 / AC9 | base는 준비 초기에 읽은 full HEAD OID다 | HEAD 응답 뒤 branch 이동을 모사해 add의 base가 최초 OID인지 직접 관측 | resolveHead → addWorktree(base) |
| R-10 | AT-10 / AC10 | repository 밖 UUID 경로를 쓰고 하위 cwd를 보존한다 | repo root/하위 cwd 표, Windows/POSIX path table에서 executionCwd와 `<userData>/worktrees` containment 단언 | paths → service path mapping |
| R-11 | AT-11 / AC11 | naming 실패가 격리를 실패시키지 않고 Agent 이름 없는 valid unique branch가 항상 생긴다 | completion throw/timeout/invalid/충돌 0·1·2 fixture에서 fallback/suffix와 check-ref 호출 단언 | naming → worktree module → add |
| R-12 | AT-12 / AC12 | 생성 metadata는 session_id null로 기록되고 session.updated 뒤 동일 row가 bind된다 | DB integration: insert→unbound 조회→session insert→bind→restart reopen 조회 | service → DbQueries → HistoryWriter event order |
| R-13 | AT-13 / AC13 | 재시작/resume은 동일 executionCwd를 쓰며 runtime/app 종료는 worktree를 지우지 않는다 | DB reopen+session load/send test; shutdown/supervisor close에서 remove 호출 0 | sessions.cwd → resolveTurnCwd |
| R-14 | AT-14 / AC14 | Git 없음·non-repo·dirty 오류는 앱 전체 실패가 아니라 해당 send 오류다 | runner ENOENT/rev-parse failure fixture 후 다음 non-isolated send 성공 | send error relay |
| R-15 | AT-15 / AC15 | session 삭제는 clean+HEAD==base만 자동 제거하고 나머지는 전부 보존한다 | clean/no-commit, dirty, advanced HEAD, Git 검사 failure 표에서 remove/branch/db/session 호출 순서·0/1회 단언 | session delete handler → worktree service → DB |
| R-16 | AT-16 / AC16 | external worktree는 자동 mutation하지 않는다 | porcelain list에 managed/external 혼합 후 remove/delete target이 managed ID뿐임을 단언 | reconcile/list → managed metadata |
| R-17 | AT-17 / AC17 | 같은 repo write는 직렬, 다른 repo write는 병렬, read는 queue 밖이다 | deferred promise로 동시 시작 수와 완료 순서 직접 관측 | git-cli checkout + worktree mutation → repo queue |
| R-18 | AT-18 / AC18 | extraDirs는 원값을 유지하고 executionCwd만 치환한다 | buildTurnContext 입력에서 cwd changed/extraDirs identical 단언 | prepare result → buildTurnContext |
| R-19 | AT-19 / AC19 | 기존 status/branch list/checkout 의미가 유지된다 | 기존 `git-cli.test.ts`+handler tests 전건; runner 추출 전후 결과 contract | 기존 Git IPC → runner |
| R-20 | AT-20 / AC20 | 신규 UI 문구와 실패 이유가 한국어·키보드 접근 가능하다 | i18n key presence, chip button role/aria/disabled state component test + 사람 Windows 시각 실기 | CwdPanel/Notice → 사용자 |

### AC 검증 주의사항

- 사람 실기는 AC20의 실제 Electron Windows 포커스·배치만 맡는다. 선택 상태·schema·오류 분기·path 계산은 모두 자동화한다.
- runner는 `execFile`을 생성자/함수 인자로 주입하는 테스트 seam을 둔다. 실제 PATH의 Git 설치 여부가 UT의 성공 조건이 되지 않는다.
- DB 테스트는 신규 migration append-only와 FK 순서를 실제 in-memory SQLite에서 관측한다. 네이티브 ABI 제한 환경은 CI/Windows gate로 분리 보고한다.
- AC5의 0건 정적 가드는 양성 TurnRequest cwd assertion과 쌍이다. worktree import를 지워 dead path가 되어도 직접 cwd oracle이 red여야 한다.

## 7-A. V / Trace Matrix

- V mode 판정: **Baseline V**. 신규 product capability이며 상속할 worktree V가 없다.
- 변경이 시작되는 수준: R. 신규 UX, 세션 수명주기, IPC/DB/Git 경계, path/naming 알고리즘까지 네 레벨이 모두 필요하다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 isolation 선택·성공 | NEW | — |
| R-02 | R | §7 오류 안내·기존 send 생존 | NEW | — |
| R-03 | R | §7 안전 삭제 | NEW | — |
| R-04 | R | §7 기존 Git UI | INHERITED | `git-cli.test.ts`, `handlers/git.test.ts` |
| SD-01 | SD | §5 신규 세션 prepare→Agent | NEW | — |
| SD-02 | SD | §5 metadata null→bind→resume | NEW | — |
| SD-03 | SD | §5 session delete 판단→제거/보존 | CHANGED | 기존 즉시 DB delete |
| SD-04 | SD | Runtime/app 종료 무관 | INHERITED | supervisor lifecycle |
| AR-01 | AR | Renderer→IPC→worktree feature→Git | NEW | — |
| AR-02 | AR | HistoryWriter session insert→metadata bind | NEW | — |
| AR-03 | AR | Host executionCwd→기존 adapter | CHANGED | 기존 source cwd 전달 |
| AR-04 | AR | infra Git runner 공통 경계 | CHANGED | `git-cli.ts` private run |
| AR-05 | AR | DB migration/queries | NEW | — |
| MD-01 | MD | path mapping + containment | NEW | — |
| MD-02 | MD | naming sanitize/validate/fallback/collision | NEW | — |
| MD-03 | MD | porcelain parse + clean/delete proof | NEW | — |
| MD-04 | MD | repo mutation queue | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-02 | REQUIRED | CwdPanel → store → schema → send | 신규 draft의 boolean과 화면 chip 직접 관측 | chip 제거 시 component test red | EP-01·EP-02 |
| VP-02 | R-02 ↔ AT-14 | REQUIRED | runner error → service result → chat error → renderer | error event와 후속 send 성공 | not selected | EP-03·EP-08 |
| VP-03 | R-03 ↔ AT-15 | REQUIRED | delete click → handler → safety proof → remove/db | 표별 결과 union과 호출 순서 | dirty 판정 제거 시 remove spy red | EP-06·EP-07 |
| VP-04 | R-04 ↔ AT-19 | REGRESSION | 기존 Git IPC → runner → git | 기존 contract suite | runner가 read env를 잃는 변이 | EP-04 |
| VP-05 | SD-01 ↔ ST-01(AC3·4) | REQUIRED | chat:send → prepare → buildTurnContext → runtime | deferred order log | prepare await 제거 변이 | EP-03 |
| VP-06 | SD-02 ↔ ST-02(AC12·13) | REQUIRED | create → DB null row → session.updated → bind → reopen/resume | 실제 DB row+cws 직접 관측 | bind 제거 시 reopen red | EP-05·EP-06 |
| VP-07 | SD-03 ↔ ST-03(AC15) | REQUIRED | sessionDelete → inspect → remove or preserve | 네 상태 table의 결과·DB 존재 | 검사 failure를 clean 취급하는 변이 | EP-06·EP-07 |
| VP-08 | SD-04 ↔ ST-04(AC13) | REGRESSION | runtime/app close → no Git mutation → resume | remove spy 0 + resume cwd | not selected — 양성 resume와 쌍 | EP-07 |
| VP-09 | AR-01 ↔ IT-01(AC1·2) | REQUIRED | renderer payload → main schema → worktree service → runner | IPC integration request/args | raw command를 feature에 심으면 architecture sweep red | EP-01~EP-04 |
| VP-10 | AR-02 ↔ IT-02(AC12) | REQUIRED | HistoryWriter insert session → bind FK | DB integration+event order | 순서 swap 시 FK/red | EP-05·EP-06 |
| VP-11 | AR-03 ↔ IT-03(AC5·6·18) | REQUIRED | service executionCwd → TurnContext → TurnRequest → adapter | 최종 query cwd와 unchanged extraDirs | Adapter createWorktree 변이 정적 red | EP-03·EP-08 |
| VP-12 | AR-04 ↔ IT-04(AC1·17·19) | REQUIRED | git APIs → runner/read or mutation queue → execFile | injected exec log+queue concurrency | shell 옵션/queue bypass 변이 | EP-04 |
| VP-13 | AR-05 ↔ IT-05(AC12·15) | REQUIRED | migration → DbQueries → feature service | migrate/reopen/delete integration | metadata cascade 삭제 변이 | EP-05·EP-06 |
| VP-14 | MD-01 ↔ UT-01(AC10·18) | REQUIRED | repo/source/userData IDs → map → executionCwd | POSIX/Windows table output | repo name을 path에 쓰는 변이 | EP-09 |
| VP-15 | MD-02 ↔ UT-02(AC11) | REQUIRED | prompt → complete → sanitize → check-ref → collision/fallback | failure matrix 최종 branch | fallback 제거/Agent prefix 변이 | EP-10 |
| VP-16 | MD-03 ↔ UT-03(AC8·15·16) | REQUIRED | porcelain/HEAD → classify → policy | fixture classification 직접 관측 | untracked line 무시 변이 | EP-11 |
| VP-17 | MD-04 ↔ UT-04(AC17) | REQUIRED | canonical root → promise chain → mutation | deferred concurrency log | global mutex/queue bypass 변이 | EP-12 |

# Part II — Technical Design

## 8. 현재 구조 조사

| 대상 | 검색/관측 | 실측 | 의미 |
|---|---|---|---|
| Git 실행 | `infra/git/git-cli.ts` | private `run` 1곳, public status/branches/checkout 3종 | runner를 추출하되 public 결과 계약 유지 |
| Git IPC | handler/preload/renderer 검색 | status·branches·checkout 3채널 | worktree 생성은 별도 Git UI IPC가 아니라 `chat:send` 준비 단계 |
| cwd 경로 | send/turn/request/adapter 검색 | payload→TurnContext→TurnRequest→query 연속 경로 확인 | Adapter/Runtime 구조 변경 불필요 |
| session cwd | migration 0010 + HistoryWriter + load | `sessions.cwd` nullable, init에서 insert | executionCwd를 기존 칼럼에 쓰면 resume 성립 |
| migration | migrations 정렬 | 최신 0017 | 신규는 append-only `0018_managed_worktrees.sql` |
| session 삭제 | `app/handlers/session.ts` | dispose→DB delete→settings, 반환 void | worktree 판정을 앞으로 옮기고 result union 필요 |
| app path | `infra/config/paths.ts` | config/projects/downloads SSOT 존재, userData 인자는 `devUserDataDir`만 | `managedWorktreesDir(userData)` 추가, bootstrap이 실제 userData 주입 |
| completion | `features/chat/title-generation.ts` | adapter.complete 1-shot+30초 title | naming은 같은 port를 별도 10초 call로 재사용 |
| landing UI | `CwdPanel.tsx` | cwd+BranchChip+extraDirs, 신규 세션 전용 | isolation chip의 정확한 편집 창 |
| 기존 금지 문구 | `shared/ipc.ts` | “worktree는 다루지 않는다(제품 결정)” 1곳 | 이번 결정으로 갱신 필요 |

## 9. 변경 후 아키텍처와 책임

```text
renderer/features/chat (선택 상태·표시)
  → shared protocol (worktreeIsolation boolean, delete result)
  → main/app/chat-turn (준비 순서·오류 relay·effective cwd 주입)
      → main/features/worktrees (제품 정책·rollback·metadata·lifecycle)
          → main/infra/git/worktree.ts (Git command/parse)
          → main/infra/db (metadata persistence)
          → RuntimeTitleAdapter.complete (선택적 slug 제안)
      → 기존 TurnContext → runtime → adapters

main/app/handlers/session (삭제 조립)
  → worktree service 안전 판정
  → 기존 runtime dispose / session DB delete
```

- `infra/git/runner.ts`: process 실행 결과 `{ok, stdout, stderr, code, aborted}`와 read env 옵션만 소유한다. Session/UI/branch 정책을 import하지 않는다.
- `infra/git/repository.ts`: `resolveRepoRoot`, `resolveHead`, `isClean`, `validateBranchName`, `branchExists`를 소유한다. 현재 `git-cli.ts`의 기존 repo helper는 필요한 만큼만 이관한다.
- `infra/git/worktree.ts`: add/remove/list/deleteBranch command와 porcelain parser를 소유한다. raw args는 여기서 끝난다.
- `infra/git/mutation-queue.ts`: canonical repoRoot key별 promise tail을 소유한다. 실패 tail도 다음 작업이 진행하도록 settle 후 정리한다.
- `features/worktrees/naming.ts`: prompt, slug sanitize, fallback, collision suffix 결정. Git validation/exists는 주입 포트로 받는다.
- `features/worktrees/service.ts`: source 검증, ID/path/base, naming, add, DB write, rollback, bind, resume reconciliation, safe delete를 조립한다.
- `app/chat-turn/prepare-worktree.ts`: chat app composition seam. `payload.worktreeIsolation`과 신규 일반 세션 여부를 확인하고 service에 active adapter completion snapshot/abort를 넘긴다.
- renderer는 다른 feature를 import하지 않고 chat feature 내부 state/component에서 선택을 관리한다.

## 10. 계약·강제 지점 전수

| EP | 강제 지점 | 수량/파일 | 실패 의미 |
|---|---|---|---|
| EP-01 | renderer draft state/action/chip | reducer·store·CwdPanel 3축 | 사용자가 선택하거나 기본 off를 유지할 수 없음 |
| EP-02 | shared/preload IPC 계약 | `ipc.ts`·`protocol.ts`·preload/global type·renderer api 4축 | 값이 신뢰 경계를 건너거나 delete 이유를 복원하지 못함 |
| EP-03 | 신규 턴 준비 순서 | `send.ts`+`prepare-worktree.ts` 2곳 | Agent가 source cwd에서 먼저 시작하거나 실패 뒤 실행됨 |
| EP-04 | Git process와 기존 API | runner·repository·worktree·git-cli·handler 5곳 | shell/환경/오류 의미 드리프트 또는 raw command 누출 |
| EP-05 | migration 등록 | `0018` SQL + `migrate.ts` import/list 2곳 | 새 설치/업그레이드 중 한쪽이 metadata를 잃음 |
| EP-06 | metadata query/이벤트 연결 | DbQueries + HistoryWriter/app callback + service 3곳 | nullable row가 session에 결합되지 않거나 삭제 전에 사라짐 |
| EP-07 | lifecycle mutation | session handler + bootstrap shutdown/supervisor 소비처 전수 | 안전 증명 없이 삭제하거나 runtime close에 잘못 결합 |
| EP-08 | cwd 종단 | prepare result→buildTurnContext→TurnRequest→adapter query 4좌표 | 격리했지만 Agent가 원본 checkout에서 실행 |
| EP-09 | path SSOT | config paths + service mapping 2곳 | repo 내부/문자열 identity/하위 cwd 유실 |
| EP-10 | naming | prompt/normalize/collision/fallback 4분기 | 편의 실패가 격리 실패가 되거나 invalid ref 생성 |
| EP-11 | dirty/delete proof parser | status porcelain + HEAD/base + managed/external 3분류 | 사용자 변경 손실 또는 외부 worktree mutation |
| EP-12 | mutation queue | checkout/add/remove/deleteBranch 4 mutation 진입 | 동일 repo 경합 또는 global serialization |

### 타입 / API

```ts
type WorktreeIsolation = { enabled: false } | { enabled: true }

type PrepareWorktreeResult =
  | { kind: 'passthrough'; executionCwd: string }
  | { kind: 'managed'; worktreeId: string; executionCwd: string }
  | { kind: 'rejected'; reason: 'git-unavailable' | 'not-repo' | 'dirty' | 'invalid-path' | 'create-failed'; message: string }

type DeleteSessionResult =
  | { ok: true }
  | { ok: false; reason: 'worktree-dirty' | 'worktree-has-commits' | 'worktree-check-failed' | 'worktree-remove-failed'; message: string }
```

- wire에는 `worktreeIsolation?: boolean`만 둔다. boolean은 신규 draft에서 on/off 한 축뿐이며 서버 schema가 다른 상태와의 불가능 조합을 `superRefine`으로 막는다.
- service 내부 결과는 discriminated union으로 실패 이유와 성공 identity를 분리한다. raw Git stderr는 로그에만 남기고 wire에는 한국어 안전 문구를 보낸다.
- `runGit(cwd, args, {signal, readOnly, timeoutMs, maxBuffer})`는 배열만 받으며 기본 env에 `GIT_TERMINAL_PROMPT=0`, readOnly일 때 `GIT_OPTIONAL_LOCKS=0`을 더한다.
- branch validation은 현재 정규식만 신뢰하지 않고 `git check-ref-format --branch <candidate>`를 최종 oracle로 쓴다. IPC checkout의 기존 `GitBranchNameSchema`는 별도 사용자 입력 방어로 유지한다.

### DB / 두 저장소 쓰기 순서

```sql
CREATE TABLE managed_worktrees (
  id TEXT PRIMARY KEY,
  session_id TEXT UNIQUE REFERENCES sessions(id) ON DELETE SET NULL,
  repo_root TEXT NOT NULL,
  source_cwd TEXT NOT NULL,
  worktree_root TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL,
  base_oid TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_managed_worktrees_session ON managed_worktrees(session_id);
```

| 실패 지점 | 관측 상태 | 보상/다음 동작 |
|---|---|---|
| Git add 전 | DB·Git 모두 없음 | 오류 반환 |
| Git add 성공, DB insert 실패 | Git worktree+branch만 존재 | 같은 repo queue에서 non-force remove→branch delete best-effort; 실패 identity 구조화 로그 |
| DB insert 성공, Agent 시작 전 실패 | nullable managed row+Git worktree | 이번 호출 identity로 rollback 후 row 삭제; rollback 실패면 row 유지해 managed orphan 표시 |
| Agent 시작, session.updated 전 종료 | nullable row+Git worktree | 보존; 부팅 reconciliation 대상 |
| session insert 성공, bind 실패 | sessions.cwd+nullable row | `worktree_root`가 cwd의 조상인 유일 row를 부팅/다음 init에 재bind; 모호하면 보존+로그 |
| 삭제 중 Git remove 성공, DB delete 실패 | worktree 없음+metadata/session 존재 | metadata 상태 재조회에서 missing으로 식별; session 삭제 재시도 가능, branch delete 실패는 보존 로그 |

- DB transaction은 session insert와 bind를 같은 `HistoryWriter.persist(session.updated)` 동기 구간에 둔다. DbQueries에 `insertSessionAndBindManagedWorktree` transaction을 제공해 실제 구현에서 두 DB 쓰기를 원자화한다. TurnContext에는 feature ID를 추가하지 않고 `executionCwd`로 unbound row를 유일 조회한다.
- 세션 삭제 transaction은 Git이라는 외부 저장소와 원자화할 수 없다. 그래서 안전 검사를 먼저 하고 Git remove 성공 뒤 metadata/session을 DB transaction으로 지운다. Git 성공·DB 실패는 데이터 손실이 아니라 stale metadata이며 reconciliation으로 닫는다.

## 11. 알고리즘

### 생성

1. `sourceCwd`를 realpath하고 `resolveRepoRoot`; repo-relative subpath가 repo 밖이면 거부한다.
2. `isClean`을 먼저 실행한다. porcelain 한 줄이라도 있으면 mutation 0으로 종료한다.
3. `resolveHead` full OID를 한 번 읽어 `baseOid`로 고정한다.
4. UUID `repoId`, `worktreeId`를 만든다. V1은 repo별 영속 repo ID 테이블을 추가하지 않고 **각 managed row의 path bucket ID**로 repoId를 쓴다. 같은 repo 재사용 식별은 canonical `repo_root` query로 수행한다.
5. naming completion을 10초/abort 신호로 시도한다. 결과는 lowercase ASCII kebab slug로 접고 40자를 제한한다.
6. `work/<slug>`를 validate하고 local branch 충돌 시 `-2`부터 증가한다. completion 어느 단계든 실패하면 `work/<id8>`에 같은 충돌 규칙을 적용한다.
7. 같은 repo mutation queue에서 `worktree add -b branch worktreeRoot baseOid`를 실행한다.
8. metadata를 insert하고 `executionCwd=resolve(worktreeRoot, relativeSubpath)`의 containment와 디렉터리 존재를 확인한다.
9. 성공값만 `buildTurnContext`의 payload cwd로 교체한다. source cwd는 metadata에만 남는다.

### 삭제 증명

1. session ID로 managed row를 찾는다. 없으면 기존 삭제 경로다.
2. worktree root에서 porcelain clean을 확인한다. 실패/비어 있지 않음은 보존이다.
3. `rev-parse HEAD`가 `base_oid`와 byte-equal인지 확인한다. 다르면 새 commit 존재로 보존한다.
4. 같은 repo queue에서 non-force `git worktree remove <path>` 후 `git branch -d <branch>`를 실행한다. branch가 이미 없으면 성공으로 정규화한다.
5. Git 제거가 성공한 뒤 metadata+session DB transaction과 기존 settings cleanup을 수행한다.

## 12. 테스트 전략

| 층 | 대상 | 핵심 suite |
|---|---|---|
| UT | naming/path/porcelain/queue | failure matrix, OS path table, untracked dirty, managed/external, deferred concurrency |
| IT | runner/repository/worktree | injected exec args/env/abort/error, 기존 git-cli contract |
| IT | DB | migration fresh+upgrade, nullable insert, atomic bind, reopen, delete/reconciliation |
| IT | chat pipeline | add-before-runtime, effective cwd, failure no-runtime, extraDirs unchanged |
| ST | lifecycle | create→session.updated→restart→resume; safe delete 4상태; shutdown no-remove |
| AT | renderer/product | landing toggle→wire→error/success state, delete rejection 안내, keyboard/aria |
| 사람 | Windows Electron | 실제 Git repo 하위 cwd에서 UI 배치·생성·원본 checkout 무변경·resume |

선택 결함 변이:

- M1: prepare await를 제거해 runtime을 먼저 시작한다 → VP-05 red.
- M2: porcelain parser가 `?? file`을 무시한다 → VP-16 red.
- M3: base OID 대신 branch 이름을 add에 넘긴다 → AT-09 red.
- M4: Adapter에서 worktree를 생성한다 → boundaries/static guard red.
- M5: naming catch를 제거한다 → AT-11 fallback test red.
- M6: dirty delete를 clean으로 취급한다 → VP-03/VP-07 red.
- M7: queue를 global key로 바꾼다 → 다른 repo 병렬 test red.

## 13. lifecycle / 오류 / 성능

- 생성 준비는 신규 격리 세션 한 번뿐이다. Git read 4~6회 + write 1회, naming completion 최대 1회다. title completion은 기존대로 첫 턴 후 별도다.
- timeout: generic Git 10초, worktree add/remove 30초, naming 10초. timeout은 강제 삭제로 이어지지 않는다.
- cancellation: send lease signal을 naming/runner에 전달한다. Git child abort 후 실제 상태를 `listWorktrees`로 확인하고 이번 ID가 생성됐을 때만 rollback한다.
- write queue의 key는 canonical repo root다. queue map entry는 tail settle 시 identity가 같을 때 삭제해 메모리 증가를 막는다.
- 부팅 reconciliation은 read-only이며 worktree 수에 선형이다. 자동 prune, remove, branch rename은 하지 않는다.
- 로그는 worktree ID·session ID·분류 reason만 기본 기록하고 prompt·stderr 전체·사용자 경로는 기존 redaction 정책을 따른다.

## 14. 변경 파일 지도

### 신규

- `app/src/main/infra/git/runner.ts`, `runner.test.ts` — process seam.
- `app/src/main/infra/git/repository.ts`, `repository.test.ts` — repo/HEAD/clean/ref API.
- `app/src/main/infra/git/worktree.ts`, `worktree.test.ts` — worktree command/porcelain.
- `app/src/main/infra/git/mutation-queue.ts`, test — repo write serialization.
- `app/src/main/features/worktrees/service.ts`, `service.test.ts` — 생성/rollback/bind/delete 정책.
- `app/src/main/features/worktrees/naming.ts`, `naming.test.ts` — completion/fallback/collision.
- `app/src/main/app/chat-turn/prepare-worktree.ts`, test — send composition seam.
- `app/src/main/infra/db/migrations/0018_managed_worktrees.sql`.
- renderer isolation chip/state tests.

### 수정

- `app/src/main/infra/git/git-cli.ts` — runner/repository/queue 재사용, 기존 export 유지.
- `app/src/main/app/chat-turn/send.ts`, `deps.ts`, bootstrap 배선 — prepare step와 service 주입.
- `app/src/main/features/history/writer.ts`, `infra/db/queries.ts`, `migrate.ts` — atomic bind/metadata queries.
- `app/src/main/app/handlers/session.ts` — safe delete result/순서.
- `app/src/shared/{ipc,protocol}.ts`, preload/global types, renderer IPC facade — wire contract.
- `app/src/renderer/src/features/chat/{reducer,store}/`, `components/CwdPanel.tsx` — draft 선택/전송/안내.
- `app/src/shared/i18n/ko.ts` — label/error.
- `docs/IPC_CONTRACT.md`, `docs/arch/backend/{persistence,overview}.md` — 현재 계약·영속 구조. 구현 뒤 현재 상태만 기록한다.

### 원칙적으로 수정하지 않음

- `app/src/main/features/sessions/session-runtime.ts`, `turn-coordinator.ts`.
- `app/src/main/adapters/claude.ts` 및 Adapter lifecycle/type.
- GitHub/PR 관련 모듈과 Source Control 대형 UI.

## 15. 운영 게이트

구현자는 아래를 순서대로 실행하고 결과를 `[구현자 기입]`에 기록한다.

1. `cd app && npm run typecheck`
2. `cd app && npm run lint` 후 `git status --short`로 autofix 혼입 확인
3. 변경 순수 suite: `cd app && ./node_modules/.bin/vitest run <worktree/git/chat/renderer 관련 파일>`
4. DB suite: `cd app && npm test`; ABI/egress 제한이면 정확한 실패 suite를 분리하고 CI Windows를 필수 gate로 둔다.
5. `cd app && node scripts/check-migrations-appendonly.mjs`
6. `cd app && node scripts/check-doc-inventory.mjs --check`
7. `git diff --check`
8. architecture sweep: `rg -n "createWorktree|addWorktree|removeWorktree" app/src/main/adapters app/src/main/features/sessions` 결과 0.
9. dependency sweep: package/lock에 신규 Git dependency 0, `exec(` shell Git 0.
10. Windows 사람 실기: clean repo 하위 cwd 격리→원본과 변경 분리→앱 재시작 resume→dirty/commit 삭제 거부.

## 16. 문서 정합성 교차검증

- Ledger↔AC: D-001~D-015 전건 §3 매핑, 충돌 0.
- 동일 대상 대조: §5·§10·§11의 base는 모두 최초 HEAD OID; delete는 모두 clean+HEAD==base; runtime/app 종료는 모두 no-remove다.
- V requiredness: NEW/CHANGED R·SD·AR·MD 노드 전부 같은 레벨 REQUIRED pair가 있다. 기존 Git UI와 runtime 종료는 REGRESSION pair, 비영향 항목을 REQUIRED로 부풀리지 않았다.
- 인용 경로: `git-cli.ts`, `send.ts`, `turn-context.ts`, `writer.ts`, `handlers/session.ts`, `CwdPanel.tsx`, migration 0010/0017, `paths.ts`, `title-generation.ts` 실재 확인.
- 범위 정합: fork/handoff별 worktree, 자동 stash, Source Control, 외부 mutation은 §6 비범위이며 AC가 반대로 요구하지 않는다.

## 17. 리스크 / 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| Git+DB 부분 실패 | orphan/stale metadata | stable ID, 보상 순서, nullable row, read-only reconciliation |
| Windows path alias/case | queue 중복·containment 오류 | realpath/normalize canonical key, 플랫폼 path table |
| naming latency | 첫 send 지연 | 10초 timeout+short-id fallback; title와 독립 |
| 세션 삭제 UX 변화 | 작업 있는 세션 삭제 불가 | 이유 result+한국어 안내; force 삭제는 별도 제품 결정 |
| branch delete 실패 | orphan branch | worktree 제거 성공은 보존하고 structured log; 사용자 작업은 손실 없음 |
| 기존 checkout과 경합 | Git lock 오류 | repo mutation queue에 기존 checkout까지 포함 |
| nullable orphan 누적 | disk 사용 | V1 자동 삭제 금지, managed orphan 식별; 관리 UI 후속 |

## 18. READY self-review

- [x] Decision Ledger에 ACTIVE/SUPERSEDED/OPEN 상태를 기록했다.
- [x] Product/UX Contract를 Technical Design보다 앞에 두었다.
- [x] 사용자 조건절과 금지 범위를 §2·§6에 보존했다.
- [x] 코드로 닫을 사실과 사용자 결정이 필요한 항목을 구분했다.
- [x] Git/cwd/DB/delete/UI/문서 경로를 현재 코드에서 확인했다.
- [x] 모든 AC에 행동, 검증 수단, production path가 있다.
- [x] Baseline V와 R/SD/AR/MD REQUIRED·REGRESSION pair를 만들었다.
- [x] 각 pair에 path, direct oracle, EP를 연결했다.
- [x] semantic 목표를 구조적 proxy만으로 검증하지 않는다.
- [x] DB+Git 두 저장소의 쓰기 순서와 실패 관측을 열거했다.
- [x] 변경 subtree gate와 repository gate를 열거했다.
- [x] 순수 로직은 사람 실기로 미루지 않았다.
- [x] 신규 dependency·Workspace framework·Adapter/Runtime 재설계를 배제했다.
- [x] ACTIVE 결정↔AC, lifecycle 사본, V requiredness, 인용 경로를 교차검증했다.

## 19. [구현자 기입]

- 구현 커밋: r1 구현 커밋(이 문서와 같은 구현 커밋, 좌표는 검증자 기입).
- 변경 요약: 공통 `runGit`·repo mutation queue·repository/worktree command를 추가하고 기존 checkout을 queue에 편입했다. 신규 세션 send는 Host worktree 준비를 TurnContext/Runtime보다 먼저 수행하며 renderer draft chip→IPC→Main→`executionCwd`를 연결했다. `0018_managed_worktrees`와 session insert transaction의 nullable bind, resume cwd 재사용, clean+HEAD==base 안전 삭제와 사용자 보존 이유를 구현했다.
- AC 자기보고: **✅ 19 · ⚠️ 1 · ❌ 0 = 20**. AC1~AC19는 typecheck와 관련 12 suite 127 case 및 실제 임시 Git repository 4 case에서 관측했다. AC20의 한국어/영어 label·button/disabled 배선은 코드와 typecheck로 확인했으나 실제 Windows Electron 키보드·배치는 ⚠️ 사람 실기다.
- V pair 자기보고: **SELF_PASS 17 / 17**. VP-01은 draft 기본 off/토글/reset+schema 불가능 조합, VP-05는 `send.ts`의 prepare await가 TurnContext/runtime보다 앞인 위치, VP-06·10·13은 실제 SQLite nullable→bind→ON DELETE SET NULL, VP-12·17은 deferred queue, VP-14~16은 실제 Git/path/dirty/safe-delete 결과를 직접 관측했다.
- 강제 지점 전수: **EP-01~EP-12 = 12/12군**. renderer 3축, shared/preload 4축, send 준비 2축, Git 5축, migration 2축, metadata 3축, lifecycle 2축, cwd 종단 4축, path 2축, naming 4분기, dirty/delete 3분류, mutation 4진입을 구현 후 `rg`·typecheck·suite로 재열거했다. adapters/sessions subtree의 worktree 생성 호출 차집합은 0줄이다.
- 결함 변이 결과: M2(untracked dirty 무시)는 service test dirty case red, M4(Adapter worktree 생성)는 architecture sweep 0, M6(dirty를 clean 취급)는 safe-delete dirty case red, M7(global queue)는 다른 repo 병렬 순서 단언 red 방향을 확인했다. 직접 결과 oracle인 나머지 pair에는 임의 mutation을 추가하지 않았다.
- 게이트 결과: `npm run lint` 0 error/기존 warning 1, `npm run typecheck` 3구성 green, 관련 suite **12파일 127케이스 green**(실제 Git safe-delete 4케이스 포함), migration append-only/sync green, doc inventory/link green, `git diff --check` green. 전체 `npm test` 최초 실행은 **255파일 중 252 green, 2577/2581 green**이었고 당시 red 4건(migration expectation 3+신규 bind test 1)은 수정 후 관련 12파일 127케이스 전건 green으로 재실행했다. 잔여 미수집 suite 1개는 아래 환경 제한이다.
- 환경 제한: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts` 환경이라 Electron binary가 없어 `chat-turn.continuity.test.ts`가 0건 수집(`Electron failed to install correctly`)했다. perceptible UI screenshot과 Windows 실제 Git 실기는 이 환경에서 수행할 수 없어 AC20을 ⚠️로 남겼다.
- 파생 이슈: **NON_BLOCKING D1** — V1은 외부 worktree를 mutation하지 않는 계약을 “관리 row로 찾은 대상만 삭제” 구조로 닫았지만, 부팅 reconciliation/UI 노출은 여전히 후속 범위다. **NON_BLOCKING D2** — add 실패 뒤 생성됐을 수 있는 branch는 best-effort `branch -d`로 정리하며 실패 시 Git stderr만 남는다; orphan 관리 UI 전까지 자동 force cleanup은 하지 않는다. PLAN_GAP은 없다.

### r2 — Windows CI 경로 표기 회귀 수정

- 외부 피드백 재현: Windows 전체 suite에서 생성 성공 자체는 관측됐지만 `executionCwd.startsWith(managed)`가 false였다. `realpath()`가 drive letter 대소문자나 junction 표기를 canonicalize할 수 있어 동일 경로의 문자열 표기가 달라진 것이 원인이다.
- 수정: 테스트의 문자열 prefix proxy를 production과 같은 path containment 술어 `isWithinDir(executionCwd, managed)`로 교체했다. 제품 코드·계약·V node/pair·강제 지점은 변경하지 않았다.
- 회귀 범위: VP-14/MD-01/UT-01의 Windows path oracle만 정정했다. POSIX·Windows 모두 `resolve/relative/isAbsolute` 의미로 containment를 판정하며 `..` 탈출은 계속 false다.
- 게이트: `service.test.ts` 4/4, 관련 Git/worktree suite, typecheck 3구성, lint 0 error, doc/migration/diff gate를 재실행한다. AC 분모는 **✅19 · ⚠️1 · ❌0 = 20**, V pair는 **SELF_PASS 17/17**로 불변이다.

### r3 — Windows temp junction 기준점 교정

- 외부 피드백 재현: r2의 `isWithinDir(executionCwd, managed)`도 Windows 전체 suite에서 false였다. child만 `realpath()` canonical 값이고 parent는 runner temp junction의 원 표기라, path-aware 비교여도 서로 다른 filesystem identity를 입력한 것이 원인이다.
- 수정: 서비스가 DB에 실제 기록한 canonical `worktreeRoot`를 fake DB에서 회수하고, `isWithinDir(executionCwd, recorded.worktreeRoot)`를 단언한다. 이제 child와 parent 모두 production이 사용하는 canonical identity다.
- 회귀 범위: VP-14/MD-01/UT-01 oracle의 **비교 함수뿐 아니라 양 입력의 identity 단계**를 닫았다. 제품 코드는 이미 `realpath(worktreeRoot)`를 metadata와 execution cwd 양쪽에 사용하므로 변경하지 않았다.
- 게이트: exact failing service suite, Git infra suite, typecheck·lint·doc/migration/diff를 재실행한다. AC/V/EP 분모는 r2와 같다.

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.
> 판정 원문과 재현 명령은 [`verify.md`](verify.md).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | `worktree add` 실패·취소 시 worktree를 제거하지 않고 branch만 지운다 | verify r3 · VP-05 · D-011 · AC4 · §13 | `listWorktrees`로 실제 생성 여부를 확인한 뒤 이번 ID만 remove + 디렉터리 정리 | BLOCKING | open |
| D2 | 같은 repo의 두 mutation 생산자가 다른 queue key를 만든다(raw `--show-toplevel` ↔ `canonicalPath`) | verify r3 · VP-12 · D-014 · AC17 · §10 EP-12 | queue key를 canonical repo root 한 함수로 모으고 checkout도 그것을 쓴다 | BLOCKING | open |
| D3 | bind가 unbound row를 cwd 포함 first-match로 잡는다 — 유일성·모호 시 보존 규칙 없음 | verify r3 · VP-06 · D-010 · AC12 · §10 DB표 | 조상 row가 정확히 1건일 때만 bind, 그 외는 보존+구조화 로그 | BLOCKING | open |
| D4 | 토글 칩이 `aria-pressed` 없이 색으로만 상태를 알리고 `ComposerChip`의 className 계약을 덮는다 | verify r3 · VP-01 · AC20 | 토글 상태를 chipSurface가 소유하는 형태로 올리고 aria 상태를 붙인다 | NON_BLOCKING | open |
| D5 | Git/dirty 거부가 `schema_validation_error`로 분류돼 나간다 | verify r3 · VP-02 · AC14 | 준비 실패에 맞는 분류를 쓰고 i18n 문구로 표시한다 | NON_BLOCKING | open |
| D6 | `listWorktrees`·`parseWorktreeList`가 프로덕션 미배선 — 부팅 reconciliation과 external 비교 관측이 없다 | verify r3 · D-013 · AC16 | 후속 handoff에서 read-only reconciliation과 orphan 식별을 배선 | NEXT_HANDOFF | open |
| D7 | `session:delete` 핸들러가 `{fallback: undefined}`인 채 `DeleteSessionResult`를 선언한다 | verify r3 · AC15 | 무효 payload에도 union을 돌려주는 fallback 값을 둔다 | NON_BLOCKING | open |
| D8 | §16의 "AC 전건 pair 매핑" 주장과 §7-A registry가 어긋난다 — AC9·AC20을 인용하는 pair 행이 없다 | verify r3 · plan §7-A | 다음 revision에서 두 AC의 pair를 추가하거나 §16 주장을 좁힌다 | 기록(planner) | open |
| D9 | naming 충돌 루프 상한이 9999회 × Git read 2회로 시간 유계가 아니다 | verify r3 · AC11 | 상한을 실제 필요 범위로 낮추고 초과 시 short-id로 강등 | NON_BLOCKING | open |
| D10 | 외부 worktree UI·orphan 관리, add 실패 후 branch 잔여 정리 (구현자 r1 D1·D2 승계) | verify r3 | 후속 handoff | NEXT_HANDOFF | open |

### r4 — verify/FAIL 보완

- **설계 리뷰**: `APPLY` 모드의 선행 review 결과는 B/F다. plan §7·§9·§10과 impl §3·§5가 seam·변이·전수 증거를 이미 요구했으므로 handoff 지침 중복 추가 없이 구현과 증거를 보완했다.
- **강제 지점 전수와 V-pair 자기확인**: EP-09 하위 cwd fixture, EP-10 naming 실패/충돌, EP-12 alias queue를 신규 test로 관측했다. VP-14·VP-15·VP-17은 `SELF_PASS`; 전체 17 pair 중 나머지는 독립 검증 전 `SELF_BLOCKED`로 보수 표기한다.
- **이번 라운드 수정의 잠금**: queue alias swap은 `mutation-queue.test.ts`에서 두 번째 mutation의 조기 시작을 검출하고, containment 소거는 `executionCwd != worktreeRoot`와 정확 subpath 단언이 red로 만든다. runner는 fake `execFile`로 executable·args·env·shell 부재를 직접 관측한다.
- **Product/UX 파생 검토**: 선택 chip은 `aria-pressed`와 동일 selected tone을 `chipSurface`에서 함께 소유한다. 무효 session delete payload도 `DeleteSessionResult` union을 반환해 renderer의 `undefined.ok`를 막는다.
- **놓친 잠재 문제 + 대응**: D6·D10은 NEXT_HANDOFF로 유지한다. D5 error taxonomy와 D9 naming 시간 상한, send 준비 순서의 deferred seam은 이번 수정에서 닫지 않았으며 다음 검증 결과에 남긴다.
- **구현 보고**: D1은 add 실패 뒤 porcelain 목록에서 이번 경로를 exact containment로 찾아 remove하고, D2는 모든 mutation key를 realpath+normalize하며, D3는 조상 후보가 정확히 하나일 때만 bind하고 모호하면 구조화 로그 후 보존한다. AC 자기보고는 **✅ 16 · ⚠️ 3 · ❌ 1 = 20**이며 `Criteria-Met`은 16/20이다.
- **Review Signals**: r4이며 r2·r3와 같은 oracle 축을 이번에는 비어 있지 않은 subpath와 alias 교환 변이로 잠갔다. 반복 원인은 기존 지침 부재가 아니라 명시 seam·변이 실행 누락(B)과 구현 결함(F)이었다.
