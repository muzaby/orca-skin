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

### r5 — verify/FAIL 보완

- **메타 리뷰**: DIAGNOSE_ONLY로 r1~r4를 대조했다. `prepare-worktree.ts`·선택 변이·전수 분모가 plan과 impl 지침에 이미 명시되어 반복 원인은 B(명시 seam/증거 미수행)+F(별칭 rollback 결함)다; 지침 patch와 Tier 회귀는 불필요하다.
- **변경과 강제 지점**: `prepare-worktree.ts`를 신설해 EP-03을 2/2로 닫고, send의 `prepare await → TurnContext` 순서와 cwd·extraDirs 배선을 source oracle로 잠갔다. Git 작업 함수는 service에 주입해 실제 별칭 worktree rollback을 관측했다.
- **D1·D12**: 구성 경로의 부모를 `realpath`한 canonical candidate로 porcelain path와 대조하고, rollback 뒤 빈 repo bucket은 `rmdir`로만 제거한다. 별칭 fixture에서 remove 1회·worktree 목록 원복·bucket 0개를 단언한다.
- **자기확인**: VP-04·05·13·15·17은 SELF_PASS, 나머지 12 pair는 독립 검증 전 SELF_BLOCKED다. AC 자기보고는 ✅14 · ⚠️6 · ❌0 = 20이며 사람 실기는 AC20 Windows 시각 확인 1건이다.
- **Product/UX·잠재 문제**: 실패 메시지와 화면 상태는 불변이고 새 문자열은 없다. D5·D9·D11·D13·D14와 NEXT_HANDOFF D6·D10은 범위 밖으로 유지하며 신규 의존성·PLAN_GAP은 없다.

### r6 — verify/FAIL 보완

- **설계 리뷰**: DIAGNOSE_ONLY로 r5의 D17~D20을 재현했다. gate 결과를 다시 읽지 않은 B와 production 결과 대신 source proxy를 둔 B가 원인이며 plan·impl 지침은 이미 두 축을 명시하므로 지침 변경은 하지 않았다.
- **강제 지점 전수와 V-pair 자기확인**: EP-03 2/2와 EP-08 4/4를 `prepareTurnExecution`의 production 배선으로 묶었다. VP-04·05·11·13·15·17은 `SELF_PASS`, 나머지 11 pair는 독립 검증 전 `SELF_BLOCKED`다.
- **이번 라운드 수정의 잠금**: 준비 promise 미완료 동안 build/runtime 호출은 각각 0회이고 완료 뒤 각 1회다. managed cwd를 source cwd로 되돌린 변이는 신규 suite 1 red이며 최종 request 관측값이 `/managed/repo`에서 `/repo`로 바뀐다.
- **Product/UX 파생 검토**: 사용자 대면 문자열·실패 상태·extraDirs 값은 불변이다. 준비 실패는 callback 이전에 반환하므로 runtime과 TurnContext를 만들지 않는 기존 상태 전이도 유지한다.
- **놓친 잠재 문제 + 대응**: D21의 DB insert 실패 빈 bucket과 기존 D5·D9·D11·D13·D14는 이번 BLOCKING 두 건과 독립이어서 유지한다. 신규 의존성·공개 계약·PLAN_GAP은 없다.
- **구현 보고**: D17은 `ResolvedHarnessSettings` fixture로 typecheck 3구성을 green으로 만들었다. D18은 source 읽기 oracle을 제거하고 준비→TurnContext→runtime acquire를 실행하는 seam으로 바꿔 managed cwd와 원래 extraDirs가 runtime 관측 request까지 도달함을 검증했다. AC 자기보고는 **✅13 · ⚠️7 · ❌0 = 20**이다.
- **Review Signals**: r6이며 r5와 같은 증거 축이다. 반복 원인은 지침 부재가 아니라 r5에서 선택한 source proxy와 gate 재확인 누락이고, 이번에는 인용 변이 M-Q의 동작 동치 변형을 1 red로 관측했다.

### r7 — 외부 CI typecheck 보완

- **설계 리뷰**: DIAGNOSE_ONLY로 사용자 보고 `TS2353`을 현재 `ResolvedHarnessSettings` 선언과 대조했다. r6 fixture가 계약의 실제 필드를 읽지 않고 과거 형상을 추정한 B이며 지침은 이미 타입·gate 실측을 요구하므로 변경하지 않았다.
- **강제 지점 전수와 V-pair 자기확인**: 제품 코드와 EP 분모는 불변이다. VP-04·05·11·13·15·17은 `SELF_PASS`, 나머지 11 pair는 독립 검증 전 `SELF_BLOCKED`다.
- **이번 라운드 수정의 잠금**: fixture를 `providerKey`·`provider`·`settings`·`sourceRevision` 네 실제 필드로 구성했다. 사용자 실패 명령 `npm run typecheck:test`를 그대로 재실행해 진단 0을 관측했다.
- **Product/UX 파생 검토**: 테스트 fixture만 바뀌어 사용자 대면 동작·문자열·상태 전이는 변하지 않는다.
- **놓친 잠재 문제 + 대응**: r6 구현과 기존 D5·D9·D11·D13·D14·D21은 변경하지 않았다. 신규 의존성·공개 계약·PLAN_GAP은 없다.
- **구현 보고**: D17의 잘못된 r6 closeout을 r7 관측으로 교정했다. `typecheck:test`와 전체 typecheck 3구성은 진단 0, 대상 suite는 1파일 3케이스 green, lint는 0 error·기존 warning 1이다. AC 자기보고는 **✅13 · ⚠️7 · ❌0 = 20**이다.
- **Review Signals**: r7이며 r6의 gate 축이 다시 열렸다. 반복 원인은 명시 타입을 읽지 않은 fixture 추정과 로컬 checkout·외부 CI 계약 차이를 커밋 전 재확인하지 않은 B다.

### r8 — Windows 별칭 rollback oracle 보완

- **설계 리뷰**: DIAGNOSE_ONLY로 외부 Windows red를 재현 경로와 대조했다. rollback 동작이 아니라 삭제 전 경로의 문자열 prefix를 filesystem identity로 간주한 oracle 결함 B이며 지침 변경은 필요 없다.
- **강제 지점 전수와 V-pair 자기확인**: EP-09의 별칭 rollback 지점만 영향을 받는다. VP-04·05·11·13·15·17은 `SELF_PASS`, 나머지 11 pair는 독립 검증 전 `SELF_BLOCKED`다.
- **이번 라운드 수정의 잠금**: remove spy가 삭제 전에 `realpath(input.path)`를 저장하고 `isWithinDir`로 physical root 포함을 판정한다. 텍스트 별칭·drive letter 표기가 달라도 같은 filesystem identity를 비교한다.
- **Product/UX 파생 검토**: 테스트 oracle만 바뀌어 rollback 동작·사용자 문자열·상태 전이는 변하지 않는다.
- **놓친 잠재 문제 + 대응**: production rollback과 기존 open 이슈는 변경하지 않았다. 신규 의존성·공개 계약·PLAN_GAP은 없다.
- **구현 보고**: 사용자 보고의 `startsWith(realpath(physical))`를 path-aware identity 단언으로 교체했다. 대상 suite와 전체 typecheck·lint·test gate 결과를 다시 기록한다. AC 자기보고는 **✅13 · ⚠️7 · ❌0 = 20**이다.
- **Review Signals**: r8이며 r2·r3과 같은 Windows path identity 축이다. 반복 원인은 경로 문자열과 filesystem identity를 섞은 B이고 이번 oracle은 삭제 전 양쪽을 canonicalize한다.

### r9 — Windows main worktree identity 보완

- **설계 리뷰**: DIAGNOSE_ONLY로 외부 Windows red를 대조했다. r8이 remove 경로만 canonicalize하고 바로 다음 main worktree 단언의 raw `{ path: repo }` 비교를 남긴 B이며 지침 변경은 필요 없다.
- **강제 지점 전수와 V-pair 자기확인**: EP-09의 별칭 rollback oracle만 영향을 받는다. VP-04·05·11·13·15·17은 `SELF_PASS`, 나머지 11 pair는 독립 검증 전 `SELF_BLOCKED`다.
- **이번 라운드 수정의 잠금**: rollback 뒤 목록 1건·`master` branch를 별도 단언하고, Git path와 repo를 각각 `realpath`한 뒤 양방향 `isWithinDir`로 동일 identity를 판정한다. 관련 테스트 파일의 raw path 비교 차집합은 0줄이다.
- **Product/UX 파생 검토**: 테스트 oracle만 바뀌어 rollback 동작·사용자 문자열·상태 전이는 변하지 않는다.
- **놓친 잠재 문제 + 대응**: `parseWorktreeList`의 문자열 보존 계약과 production rollback은 변경하지 않았다. 신규 의존성·공개 계약·PLAN_GAP은 없다.
- **구현 보고**: Windows 8.3 short path와 Git의 long path를 직접 비교하던 형제 단언을 filesystem identity 비교로 교체했다. 대상 반복 suite와 전체 typecheck·lint·test gate 결과를 기록한다. AC 자기보고는 **✅13 · ⚠️7 · ❌0 = 20**이다.
- **Review Signals**: r9이며 r8과 같은 Windows identity 축이다. 반복 원인은 한 테스트의 형제 단언을 전수로 닫지 않은 B이고 이번에는 raw path 비교 검색 차집합을 확인했다.

### r10 — production send 배선과 turn 반납 복구

- **설계 리뷰**: PLAN_GAP은 없다. 선행 `handoff-review` 커밋 `f823841` 뒤 r9의 BLOCKING D18·D22와 기록 D23을 기존 VP-05·VP-11·AC6·EP-03·EP-08 안에서 재구현했다.
- **강제 지점 전수와 V-pair 자기확인**: EP-03 2/2와 EP-08 4/4를 실제 `handleChatSend` 진입 테스트가 지난다. VP-04·05·11·13·15·17은 `SELF_PASS`, 나머지 11 pair는 독립 검증 전 `SELF_BLOCKED`다.
- **이번 라운드 수정의 잠금**: 선택 증거 M-A′ 1 · 인용 변이 M-Q′ 1 · 신규 D22 oracle 1 = 표 행 3이다. M-Q′(prepared cwd 폐기)와 `leaderTurn` 조기 대입 제거는 대상 3케이스를 red로 만들며, M-A′는 준비 완료 전 호출 0회 단언을 깬다.
- **Product/UX 파생 검토**: 신규 문자열·상태 전이는 없다. 준비 대기 중에는 context/runtime이 0회이고 runtime 확보 실패는 기존 오류 이벤트 뒤 turn·chain을 반납하므로 무응답이나 잔존 busy 상태를 만들지 않는다.
- **놓친 잠재 문제 + 대응**: D5·D9·D11·D12·D13·D14·D21과 NEXT_HANDOFF D6·D10은 이번 두 BLOCKING과 독립이어서 유지한다. 신규 의존성·공개 계약·PLAN_GAP은 없다.
- **구현 보고**: `send.worktree.test.ts`가 실제 handler의 production callback을 통과해 managed cwd·extraDirs·prepared snapshot을 runtime 경계에서 관측한다. startNew/startResume 직후 `leaderTurn`을 공개해 acquire reject 두 경로에서 release 1회를 관측했고, 6·7단계와 0188 D-019 주석을 복원했다. AC 자기보고는 **✅13 · ⚠️7 · ❌0 = 20**이다.
- **Review Signals**: r10이며 D18은 r5~r9와 같은 배선 oracle 축, D22는 r6 재배치가 만든 cleanup 축이다. plan/AC는 두 축을 이미 요구했지만 앞선 테스트가 production handler에 진입하지 않아 검출하지 못했다.

### r11 — cwd 종단 4좌표와 queue 진입 4지점을 전수로 닫는다

- **설계 리뷰**: `PLAN_GAP` 없음. r10 verify의 BLOCKING D24와 NON_BLOCKING D25·D27을 기존 VP-11·VP-12·VP-14·AC4·AC5·EP-08·EP-09·EP-12 안에서 닫았다. 규범 행은 건드리지 않았다. 라운드 11이지만 선행 `handoff-review`(round 24, `f823841`)가 r10 직전에 수행됐고 그 두 규칙이 r10·r11에서 실제로 발동해 이번 라운드에 재수행하지 않았다 — r10 verify 결론도 새 review를 요구하지 않았다.
- **강제 지점 전수와 V-pair 자기확인**: EP-08 **4/4**(잠김) · EP-09 **2/2**(잠김) · EP-12 **4/4**(잠김) · EP-03 2/2(r10 승계, M-A′ red 재확인). EP-12 분모는 해법 이름이 아니라 불변식의 주어로 셌다 — `rg -n "runGit\(" src/main/infra/git --glob '!*.test.ts'` 12건 중 상태를 바꾸는 호출은 `git-cli.ts:142`(checkout) · `worktree.ts:18`(add) · `:30`(remove) · `:39`(branch -d) **4건**이고 나머지 8건은 `readOnly: true`다. `rg -n "withRepoMutation" …` 이 그 4건을 전부 감싼다. VP-05·11·12·14·17은 `SELF_PASS`, 나머지 12 pair는 독립 검증 전 `SELF_BLOCKED`다.
- **이번 라운드 수정의 잠금**

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M-A′ `send.ts` 격리 배선 전체 삭제(import·`makeClassifiedError`·`getLogger` 잔여 정리) | `VP-05 선택 증거` | red | `준비 완료 전에는…` 외 4건 | 잠김 |
| 정적 sweep `rg -n "createWorktree\|addWorktree\|removeWorktree" adapters sessions` | `VP-11 선택 증거` | 0줄 | `rg -in "worktree"` 엄격화 차집합 1줄(주석) | 잠김 — 0건은 전수 |
| M-O `addWorktree` 가 `withRepoMutation` 우회 | `VP-12 선택 증거` | green | `queue-entry.test.ts > addWorktree` 1건 | 잠김 |
| M-L′ repo 이름·프롬프트 slug 를 경로 세그먼트로 | `VP-14 선택 증거` | green | `managed 경로 세그먼트는 UUID뿐…` 1건 | 잠김 |
| M-Q′ `buildTurn` 콜백이 준비된 `executionCwd` 를 버림 | `D18 인용 변이` | red | 3건 | 잠김 |
| M-T `TurnRequest` 가 `turn.cwd` 대신 source cwd | `D24 인용 변이` | green | `…TurnRequest 조립까지 그대로 간다` 1건 | 잠김 |
| M-T2 `TurnRequest` extraDirs 를 `payload` 에서 다시 읽음 | `새 oracle 형제 축` | 미실행 | `turn이 계승한 extraDirs…` 1건 | 잠김 |
| M-U2 `claude.ts` `sendMessage` 가 `req.cwd` 대신 `process.cwd()` | `새 oracle 민감도` | 미실행 | `claude.cwd.test.ts` 2건 | 잠김 |
| M-O2 `gitCheckout` 이 queue 우회(형제 진입점) | `새 oracle 민감도` | 미실행 | `queue-entry.test.ts > gitCheckout` 외 10건 | 잠김 |
| M-V `onRuntimeAcquired` 배선 제거 | `새 oracle 민감도` | 미실행 | `runtime 인출 뒤 확보가 실패해도…` 1건 | 잠김 |

- **분모 검산**: `선택 증거 4 · 인용 변이 2 · 새 oracle 4 = 표 행 10`. 행이 없는 pair·이슈를 `SELF_PASS`·`closed` 로 적지 않았다.
- **덮개 회귀**: 이전 라운드에 red 였는데 이번에 green 인 행 **0건**. r10 의 M-A′·M-Q′·M-S 를 그대로 재실행해 셋 다 red 를 유지했다(M-S 는 `leaderTurn` 축, 이번 M-V 는 그 형제인 `leaderRuntime` 축이다).
- **Product/UX 파생 검토**: 새 사용자 대면 문자열 0. 준비 거부는 기존 오류 이벤트 1건을 보내고 context·runtime·TurnRequest 를 하나도 만들지 않는다 — Part I 상태 전이표의 `격리 on + dirty source` 행이고 "아무 일도 안 일어남" 이 아니다. runtime 확보가 예외로 끝나도 turn 과 핸들을 각각 1회 반납하므로 세션이 `실행 중` 으로 남지 않는다.
- **놓친 잠재 문제 + 대응**

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | r10 verify 가 EP-08 4번째 좌표를 `claude.ts:264` 로 적었으나 그 줄은 `complete()`(제목·naming 1-shot) 경로다 | ⚠️ 보고만 — 좌표 정정 | chat 경로는 `sendMessage` 의 `claude.ts:365` `cwd,` 이고 `:288` 에서 `req` 를 분해한다. 264 에 심은 변이(M-U)는 341케이스 green, 365 에 심자(M-U2) 2건 red |
| 2 | D27 의 `abort` 주입 후 runtime 0회는 여전히 미관측 | ⚠️ 보고만 | 준비 **거부**(dirty·add 실패·DB insert 실패가 모두 이 union 으로 수렴) 경로는 닫았다. `AbortController` 를 service 에 주입하는 케이스는 이번 범위 밖 |
| 3 | D26 — VP-09 등록 변이("raw command 를 feature 에 심으면 sweep red")를 강제하는 장치가 없다 | ⚠️ 보고만 | `rg -n "runGit" src/main/features --glob '!*.test.ts'` = 0줄이지만 지키는 테스트가 없다. VP-09 는 `SELF_BLOCKED` 로 둔다 |
| 4 | D5·D9·D11·D13·D14·D21 과 NEXT_HANDOFF D6·D10 | ⚠️ 유지 | 이번 두 축(cwd 종단·queue 진입)과 독립이다 |

- **설계 대비 명시적 차이**: 없음. plan 이 지정한 메커니즘을 바꾸지 않았고 신규 의존성·공개 계약 변경도 없다.
- **구현 보고**

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/chat-turn/{send,runtime-entry}.ts` · `app/chat-turn/send.worktree.test.ts` · `features/worktrees/service.test.ts` · 신규 `adapters/claude.cwd.test.ts` · 신규 `infra/git/queue-entry.test.ts` |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node --test scripts/*.test.mjs` · `git diff --check` |
| **관측한 게이트 산출** | typecheck exit 0 · `error TS` **0줄**(3구성) / lint exit 0 · **0 error · warning 1**(기존 `useTranscriptVirtualizer`), 실행 후 `git status --short` 에 도구 변경분 0 / vitest **263파일 중 262 pass · 2609/2609 케이스** / scripts **59/59** / migrations `sync ok: 18` · `append-only ok since v0.3.1` / doc-inventory generated·prose·links ok / `git diff --check` 0줄 |
| 환경 기인 실패 분리 | **1파일 0건 수집** — `app/chat-turn.continuity.test.ts` `Electron failed to install correctly`. `app/AGENTS.md §제약 환경` 의 알려진 서명이고 r1 부터 동일하다 |
| V-pair 자기확인 | `SELF_PASS 5 / SELF_BLOCKED 12`; pair 별 근거는 위 잠금 표 |
| 강제 지점 전수 | EP-03 2/2 · EP-08 4/4 · EP-09 2/2 · EP-12 4/4 |
| **AC 자기보고**(`Criteria-Met`) | AC5 를 ⚠️→✅ 로 올렸다 — `TurnRequest cwd 직접 단언`(M-T red) + adapter 옵션 cwd(M-U2 red) + 기존 정적 0건. 나머지는 r10 verify 재측정을 그대로 승계 |
| **합계 검산** | `✅ 13 · ⚠️ 7 · ❌ 0 = 총 20` — ✅ = AC1·2·3·5·6·7·8·11·12·16·17·18·19 / ⚠️ = AC4·9·10·13·14·15·20. 분모 변경 없음 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r11 구현 — 좌표는 INDEX)` |

- **Review Signals**
  - 이번에 닫은 불변식은 r5~r10 과 **같은 축**이다 — "격리로 정한 cwd 는 준비 결과부터 어댑터 옵션까지 한 값으로 간다". 이번에는 좌표를 4개로 열거해 전수로 닫았고, 형제 축(`extraDirs`)도 두 출처가 구별되는 값으로 갈라 함께 잠갔다.
  - 그것을 막았어야 할 지침은 있었다 — AC5 가 `TurnRequest cwd 직접 단언` 을, VP-11 이 `최종 query cwd` 를 명시한다. 열 라운드 동안 그 좌표에 단언이 0이었고, 앞선 라운드들이 매번 **그 라운드가 만든 장치가 보는 자리**에서 변이를 골랐기 때문이다.
  - 반복 환경 한계: `chat-turn.continuity.test.ts` 0건 수집(Electron 바이너리 부재)이 r1 부터 같다. 다만 이번 두 좌표는 그 스위트 없이 닫혔다.
  - 현재 라운드 수: **11**.

### r12 — 남은 8 pair 의 증거를 만들고, 그 장치들의 눈을 확인한다

- **설계 리뷰**: `PLAN_GAP` 없음. r11 verify 가 남긴 8 `PAIR_FAIL`(VP-01·02·06·07·08·09·10·16)과 `BLOCKED_BY` 1(VP-03)은 전부 "아직 만들지 않은 증거"였고 규범 행을 바꾸지 않고 닫았다. 프로덕션 코드는 **0줄 변경**이다 — 이번 라운드 산출은 전부 oracle 이다. 라운드 12지만 선행 `handoff-review`(round 25)가 r11 직후에 수행됐고 그 신설 규칙(분모 검산·덮개 회귀·라벨 술어 검증)이 이번 라운드에서 실제로 발동해 재수행하지 않았다.
- **강제 지점 전수와 V-pair 자기확인**: EP-01 **3/3** · EP-06 **3/3** · EP-07 **2/2** · EP-11 **3/3** · EP-04 features 음성 축 신설. r11 verify 가 `부분` 으로 남긴 EP-06·EP-11 이 이번에 전수로 닫혔다. **EP-07 은 전수를 세다가 열려 있는 자리를 찾았다** — 두 지점 중 `session handler` 만 잠겨 있었고 `bootstrap` 배선은 지워도 전 스위트 2635 초록이었다(아래 §놓친 잠재 문제 1). VP-01·02·03·06·07·08·09·10·16 은 `SELF_PASS`, 나머지 8 pair 는 r11 verify 판정을 승계한다.
- **이번 라운드 수정의 잠금**

| 심은 결함 | 갈래 / 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M-I 격리 칩을 `CwdPanel` 에서 삭제 | `VP-01 선택 증거` | **green**(r5~r11) | `칩이 렌더되고 라벨을 단다` 1건 | 잠김 — **덮개 회귀 복구** |
| M-AE handler 가 보존 이유를 무시하고 삭제 진행 | `VP-03 선택 증거` | 미실행 | `worktree 가 보존되면…` 1건 | 잠김 |
| M-AG `insertSession` 이 bind 를 부르지 않음 | `VP-06 선택 증거` | 미실행 | 2건 | 잠김 |
| M6 삭제 판정이 `isClean` null 을 clean 으로 취급 | `VP-07 선택 증거` | 미실행 | 2건 | 잠김 |
| M-AJ features 프로덕션이 `execFile` 을 직접 부름 | `VP-09 선택 증거` · `D26 인용 변이` | 미실행(장치 부재) | 2건 | 잠김 |
| M-AJ2 features 프로덕션이 `runGit` 을 직접 부름 | `VP-09 선택 증거`(형제 축) | 미실행 | 2건 | 잠김 |
| M-AL bind 를 `insertSession` 앞으로(순서 swap) | `VP-10 선택 증거` | 미실행 | 2건 | 잠김 |
| M-AK `isClean` 이 untracked 를 무시 | `VP-16 선택 증거` | 미실행 | 3건 | 잠김 |
| M-AJ3 스윕의 주석·문자열 제거를 무력화 | `새 oracle 자기 눈`(EP-04 스윕) | 미실행 | 1건 | 잠김 |
| M-AM `bootstrap` 의 `removeManagedWorktree` 배선 제거 | `새 oracle 배선`(EP-07) | 미실행 | 1건 | 잠김 |
| M-AM2 배선은 있으나 무동작(`async () => ({ ok: true })`) | `새 oracle 배선`(EP-07) | 미실행 | 1건 | 잠김 |
| M-AN2 다른 슬라이스가 `removeForSession` 을 부름 | `새 oracle 0건 스윕`(AC13 음성 축) | 미실행 | 1건 | 잠김 |
| M-AN3 **같은 파일 안** 두 번째 호출부 | `새 oracle 분류 단위`(AC13) | 미실행 | 1건 | 잠김 |

- **분모 검산**: `선택 증거 8 · 인용 변이 1(D26 — M-AJ 행과 동일) · 새 oracle 5 = 필수 표 행 13`. `SELF_PASS` 로 올린 9 pair 가 전부 행을 갖는다 — `not selected` 인 VP-02·VP-08 은 등록 증거가 없어 아래 직접 oracle 행이 그 자리다. 행이 없는 pair·이슈를 `SELF_PASS`·`closed` 로 적지 않았다.
- **직접 oracle 민감도**(의무 아님 — 실측만 기록): M-K·M-J(VP-01 눌림·토글) red 1 / M-AB·M-AC·M-AD(VP-02 세 거부 이유) red 1 / M6b·M-Y·M-X(VP-07 HEAD·신규 commit·호출 순서) red 2·1·1 / M-Z2(VP-16 external 침범) red 1 / M-AF(VP-06 writer 가 cwd 미전달) red 2 / M-AH2(VP-08 재개가 요청 cwd 사용) red 1 / M-AI·M-AI2(VP-09 branch·baseOid 갈림) red 1 / M-AJ4(features 가 `node:child_process` import) red 1.
- **덮개 회귀**: 이전 라운드에 red 였는데 이번에 green 인 행 **0건**. r11 의 M-T(red 2) · M-T2(red 1) · M-U2(red 2) · M-V(red 1) · M-O(red 3) 를 그대로 재실행해 전부 red 를 유지했다. 반대 방향으로 M-I 가 r5~r11 의 green 에서 red 로 돌아섰다.
- **Product/UX 파생 검토**: 새 사용자 대면 문자열 0 — 프로덕션 변경이 0줄이다. 다만 **EP-07 배선 결함(§놓친 잠재 문제 1)은 제품 실패였다**: 그 한 줄이 없으면 `session:delete` 가 managed worktree 검사를 건너뛰고 `?? { ok: true }` 폴백으로 세션을 지운다 — 사용자는 커밋하지 않은 작업이 든 worktree 를 남긴 채 세션만 잃고, 화면에는 성공으로 보인다. Part I 상태 전이표의 `삭제 + dirty worktree` 행이 아무 경고 없이 `삭제 성공` 행으로 접히는 경우다.
- **놓친 잠재 문제 + 대응**

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | EP-07 두 지점 중 `bootstrap.ts:863` 배선이 잠금 0 — 지워도 전 스위트 **2635 전건 green**. hook 이 optional 이라 typecheck 도 부재를 못 잡는다 | ✅ **선조치** — 배선 형태와 유일 호출부를 보는 oracle 신설 | M-AM·M-AM2·M-AN3 red 1. 단위(`session.delete.test.ts` 주입)만 잠그고 **그 단위를 부르는 배선**을 안 잠근 자리였다(impl §3) |
| 2 | VP-06 의 **유일성 축**(M-E: `matches.length === 1` → `>= 1`)은 이번 신규 장치로는 green 이다 | ⚠️ 보고만 — provenance 정정 | r4 가 만든 `infra/db/` 장치가 red 1 로 잡는다. 내 writer 층 장치는 EP-06 의 *다른* 지점(3번째)이라 이 축을 대신하지 않는다. `SELF_PASS` 근거에서 M-E 를 내 잠금으로 세지 않았다 |
| 3 | 첫 M-T 측정이 green 이었다 — `resolved.executionCwd ?? turn.cwd` 로 심어 테스트 스코프에서 **등가 변이**였다 | ✅ 선조치 — r11 좌표(`payload.cwd ?? ctx.getCwd(...)`)로 다시 심어 red 2 | 등가 변이의 green 을 덮개 회귀로 보고했다면 없는 회귀를 만들 뻔했다 |
| 4 | 변이 측정 스크립트의 파서가 **전건 red** 를 `NO-CASES` 로 읽었다(`Tests N failed (N)` 에는 `passed` 절이 없다) | ✅ 선조치 — 파서 교정 후 전 행 재측정 | M-U2 가 실제로는 red 2 인데 `NO-CASES` 로 나왔다. 이 버그는 green 을 만들지는 않는다(green 판정은 `passed` 절을 요구) |
| 5 | 첫 EP-04 스윕이 주석 속 `spawn(resume)` 을 호출로 셌고, 자체 `stripComments` 를 손으로 만들었다 | ✅ 선조치 — 저장소가 이미 소유한 `infra/source-scan` 의 `stripCommentsAndStrings`·`sourceFiles` 로 교체 | 같은 헬퍼를 `no-node-fetch.test.ts`·`no-cookie-token.test.ts` 가 쓴다. 사본을 세 번째로 만들 자리가 아니었다 |
| 6 | D5·D9·D11·D12(부분)·D13·D14·D21·D29·D32 와 NEXT_HANDOFF D6·D10 | ⚠️ 유지 | 이번 축(증거 신설)과 독립이다. D11 은 이번 라운드에도 재현했다 — 아래 게이트 산출 |

- **설계 대비 명시적 차이**: 없음. plan 이 지정한 메커니즘을 바꾸지 않았고 프로덕션 코드·신규 의존성·공개 계약 변경이 0이다. `worktree-bind.test.ts` 를 `features/history/` 가 아니라 `app/chat-turn/` 에 둔 것은 배치 선택이다 — 영속은 `features/history`, 재개는 `app/chat-turn` 이라 두 레이어의 합성이고, feature 안에 두면 `boundaries/dependencies` 가 features→app 을 error 로 막는다(실측 1건).
- **구현 보고**

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 6 — `features/worktrees/{safe-delete,reject-reasons,ipc-integration}.test.ts` · `app/handlers/session.delete.test.ts` · `app/chat-turn/worktree-bind.test.ts` · `renderer/…/CwdPanel.isolation.test.ts`. 수정 1 — `app/chat-turn/send.worktree.test.ts`(VP-02 send 층 케이스 + 하네스 `extraDirs ?? []` 교정). **프로덕션 0줄** |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node --test scripts/*.test.mjs` · `git diff --check` |
| **관측한 게이트 산출** | typecheck exit 0 · `error TS` **0줄**(3구성) / lint exit 0 · **0 error · warning 1**(기존 `useTranscriptVirtualizer`), 실행 후 `git status --porcelain` 에 도구 변경분 0 / vitest **269파일 · 2638케이스**, 268 pass 파일 / scripts **59/59** / migrations `sync ok: 18` · `append-only ok since v0.3.1` / doc-inventory generated·prose·links ok / `git diff --check` 0줄 |
| 환경 기인 실패 분리 | **1파일 0건 수집** — `app/chat-turn.continuity.test.ts` `Electron failed to install correctly`(`app/AGENTS.md §제약 환경` 의 알려진 서명, r1 부터 동일). **간헐 1건** — `infra/git/mutation-queue.test.ts > serializes filesystem aliases` 가 전 스위트 10회 중 **3회 red**, 단독 실행 8/8 green. 이것은 **D11 로 이미 기록된 선재 결함**이고(verify r4: 전 스위트 4회 중 2회 red) 이번 변경은 그 경로를 건드리지 않았다(프로덕션 0줄) |
| V-pair 자기확인 | `SELF_PASS 9`(VP-01·02·03·06·07·08·09·10·16) / 나머지 8은 r11 verify 판정 승계; pair 별 근거는 위 잠금 표 |
| 강제 지점 전수 | EP-01 3/3 · EP-06 3/3 · EP-07 2/2 · EP-11 3/3 (EP-03 2/2 · EP-08 4/4 · EP-09 2/2 · EP-12 4/4 는 r11 승계) |
| **AC 자기보고**(`Criteria-Met`) | AC13·AC14·AC15 를 ⚠️→✅ 로 올렸다 — AC13 은 재시작 resume(M-AH2 red)과 종료 시 remove 0회(M-AN2·M-AN3 red) 두 축, AC14 는 세 거부 이유 + 후속 send 성공(service·send 두 층), AC15 는 네 상태 표 + 호출 순서·0/1회 + handler union |
| **합계 검산** | `✅ 16 · ⚠️ 4 · ❌ 0 = 총 20` — ✅ = AC1·2·3·5·6·7·8·11·12·13·14·15·16·17·18·19 / ⚠️ = AC4(abort 주입, D32)·AC9(HEAD 이동 모사 미관측)·AC10(Windows 경로 표기, CI 러너)·AC20(Windows 시각 실기). 분모 변경 없음 |
| **Windows CI 후속** | 첫 푸시가 windows 러너에서 **3건 red** 였다 — 이 환경(POSIX)에서는 전건 green 이었다. 둘 다 Windows 전용 축이고 제품 결함이 아니라 **내 oracle 의 결함**이다: (A) `worktree-bind.test.ts` 가 sqlite 핸들을 연 채 temp 디렉토리를 지워 `EBUSY: unlink orca.db` 2건 — Windows 는 열린 파일을 unlink 하지 못한다. (B) `ipc-integration.test.ts` 가 git stdout(`C:/…`)과 Node 경로(`C:\…`)를 문자열로 비교해 1건. 실패 출력의 git 목록에 `branch refs/heads/work/f17d0001` 이 그대로 있었다 — 제품은 정상이고 단언만 틀렸다 |
| **후속 수정** | (A) 핸들을 여는 자리를 `openHandle` 한 곳으로 모으고 `afterEach` 가 `rm` **앞에** 전부 닫는다(`new Database(` 출현 1건으로 검산). 테스트마다 손으로 닫으면 단언이 먼저 throw 할 때 그 close 를 건너뛴다. (B) 문자열 비교를 버리고 `listWorktrees` + `realpath` + 양방향 `isWithinDir` **동일성**으로 바꿨다 — `service.test.ts` 가 r3 에서 같은 축을 닫은 형태다. 오라클을 교체했으므로 VP-09 변이를 전부 재측정했다: M-AH·M-AI·M-AI2·M-AJ·M-AJ2·M-AJ3 전건 red 유지 + **신규 M-AI3**(기록 worktreeRoot 가 git 이 만든 경로와 갈림) red 1 — 구 장치의 경로 축을 새 장치가 덮는다. 덮개 회귀 0건 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r12 구현 — 좌표는 INDEX)` |

- **Review Signals**
  - 이번에 닫은 것은 r5~r11 의 "같은 불변식의 다음 좌표" 축이 **아니다** — 8 pair 가 전부 미작성 증거였다. 대신 **같은 축이 한 단계 위에서 재발했다**: EP-07 에서 단위(핸들러)는 잠그고 그것을 부르는 배선은 안 잠근 자리를 찾았다. impl §3 이 0198 r5 사례로 서술하는 바로 그 패턴이고, 이번에는 전수를 세다가 구현 턴 안에서 걸렸다.
  - 그것을 막았어야 할 지침은 있었고 **이번에는 작동했다** — §2 의 "지점 수만큼 닫고 개수를 보고한다" 가 EP-07 을 `2/2` 로 세게 했고, 두 번째 지점에 눈이 없다는 사실이 그 셈에서 나왔다.
  - round 25 review 가 신설한 세 규칙이 전부 발동했다: 분모 검산(필수 13행 분리) · 덮개 회귀(M-I 의 green→red 와 r11 5변이 재실행) · 라벨 술어 검증(첫 스윕이 주석을 호출로 세던 것을 자기 눈 케이스가 잡았다).
  - **Windows 경로 표기는 이 handoff 에서 세 번째로 열린 축이다** — r2(`Windows CI 경로 표기 회귀`) · r3(`Windows temp junction 기준점 교정`) · r12(내 신규 oracle 의 문자열 비교). 매번 *그 라운드가 새로 쓴 단언*에서 났고, 앞선 두 라운드가 만든 해법(`realpath` + 양방향 `isWithinDir`)이 같은 파일에 이미 있었는데 새 테스트가 그것을 쓰지 않았다. 열린 sqlite 핸들의 `EBUSY` 는 이 handoff 에서 **새 축**이다.
  - 그 둘을 막았어야 할 지침은 **없다** — `app/AGENTS.md §제약 환경` 은 egress·ABI 만 다루고, POSIX 전용 환경에서 Windows 러너용 단언을 쓰는 규칙은 어디에도 없다. 이 환경에서 green 은 Windows green 을 뜻하지 않는데 구현자는 그 차이를 볼 수 없다. `handoff-review` 후보다.
  - 반복 환경 한계: `chat-turn.continuity.test.ts` 0건 수집(Electron 바이너리 부재)이 r1 부터 같다. D11 간헐도 r4 부터 같은 비율이다. Windows 시각 확인은 사람 몫이고, **Windows 경로·파일 잠금은 CI 러너만 관측한다 — 이 환경의 green 은 그 축의 증거가 아니다.**
  - 현재 라운드 수: **12**. 선행 review 는 round 25.


## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.
> 판정 원문과 재현 명령은 [`verify.md`](verify.md).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | `worktree add` 실패·취소 rollback — r4가 `listWorktrees` 확인을 넣었으나 별칭 managed root에서 대상을 못 찾고(git=canonical ↔ 구성값=별칭) 잠금이 0이다 | verify r3·r4 · VP-05 · D-011 · AC4 · §13 | 대상 식별을 canonical 한 축으로 맞추고 취소 rollback을 관측하는 oracle을 만든다 | BLOCKING | **closed (r5 확인 — M-R1 red)** |
| D2 | 같은 repo의 두 mutation 생산자가 다른 queue key를 만든다(raw `--show-toplevel` ↔ `canonicalPath`) | verify r3 · VP-12 · D-014 · AC17 · §10 EP-12 | queue key를 canonical repo root 한 함수로 모으고 checkout도 그것을 쓴다 | BLOCKING | **closed (r4 — M-D red)** |
| D3 | bind가 unbound row를 cwd 포함 first-match로 잡는다 — 유일성·모호 시 보존 규칙 없음 | verify r3 · VP-06 · D-010 · AC12 · §10 DB표 | 조상 row가 정확히 1건일 때만 bind, 그 외는 보존+구조화 로그 | BLOCKING | **closed (r4 — M-E·M-P red)** |
| D4 | 토글 칩이 `aria-pressed` 없이 색으로만 상태를 알리고 `ComposerChip`의 className 계약을 덮는다 | verify r3 · VP-01 · AC20 | 토글 상태를 chipSurface가 소유하는 형태로 올리고 aria 상태를 붙인다 | NON_BLOCKING | **closed (r4 — 코드 성립, 잠금 0)** |
| D5 | Git/dirty 거부가 `schema_validation_error`로 분류돼 나간다 | verify r3 · VP-02 · AC14 | 준비 실패에 맞는 분류를 쓰고 i18n 문구로 표시한다 | NON_BLOCKING | open |
| D6 | `listWorktrees`·`parseWorktreeList`가 프로덕션 미배선 — 부팅 reconciliation과 external 비교 관측이 없다 | verify r3 · D-013 · AC16 | 후속 handoff에서 read-only reconciliation과 orphan 식별을 배선 | NEXT_HANDOFF | open |
| D7 | `session:delete` 핸들러가 `{fallback: undefined}`인 채 `DeleteSessionResult`를 선언한다 | verify r3 · AC15 | 무효 payload에도 union을 돌려주는 fallback 값을 둔다 | NON_BLOCKING | **closed (r4 — 잠금 0, 이유 값은 D13)** |
| D8 | §16의 "AC 전건 pair 매핑" 주장과 §7-A registry가 어긋난다 — AC9·AC20을 인용하는 pair 행이 없다 | verify r3 · plan §7-A | 다음 revision에서 두 AC의 pair를 추가하거나 §16 주장을 좁힌다 | 기록(planner) | open |
| D9 | naming 충돌 루프 상한이 9999회 × Git read 2회로 시간 유계가 아니다 | verify r3 · AC11 | 상한을 실제 필요 범위로 낮추고 초과 시 short-id로 강등 | NON_BLOCKING | open |
| D10 | 외부 worktree UI·orphan 관리, add 실패 후 branch 잔여 정리 (구현자 r1 D1·D2 승계) | verify r3 | 후속 handoff | NEXT_HANDOFF | open |
| D11 | `withRepoMutation`이 key를 `await`로 해석한 뒤 등록해 큐 진입 순서가 호출 순서와 다르다 — 새 별칭 단언이 간헐 red다(200회 중 18회 역전, 전 스위트 4회 중 2회 red) | verify r4 · VP-17 · AC17 | key 해석을 등록보다 앞당기거나 단언을 상호배제로 좁힌다 | NON_BLOCKING | open |
| D12 | 준비 실패·취소 rollback이 `<managed>/<repoId>` 빈 버킷을 남긴다(취소 3회 → 3개) | verify r4 · D-011 · AC4 | rollback이 비게 된 bucket까지 정리한다 | NON_BLOCKING | **부분 closed (r5 — add 실패 경로만, M-R2 red)** |
| D13 | `session:delete`의 스키마 실패 fallback 이유가 `worktree-check-failed`다 — worktree 검사 실패가 아니다 | verify r4 · AC15 · D7 파생 | 무효 payload용 이유를 따로 둔다 | NON_BLOCKING | open |
| D14 | AT-11이 열거한 naming fixture 중 timeout·invalid와 `check-ref` 호출 단언이 없다 | verify r4 · VP-15 · AC11 | 남은 matrix 행을 채운다 | NON_BLOCKING | open |
| D15 | 구현 커밋 4건의 제목·본문이 영어다 — `docs/handoff/AGENTS.md §커밋·git 규약`은 한국어 메시지를 규정한다 | verify r4 · repository op | 다음 라운드부터 한국어 메시지를 쓴다 | 기록 | **closed (r5 — 한국어 커밋)** |
| D16 | plan의 `### r4` 구현자 절이 `## [검증자 기입] 파생 이슈` 안에 있다 | verify r4 · repository op | 다음 라운드 절은 `§19 [구현자 기입]` 아래에 붙인다 | 기록 | open |
| D17 | `npm run typecheck`가 exit 2 · `error TS` 3건 — 전부 이번 라운드가 신설한 `prepare-worktree.test.ts`의 `providerSettings` 타입이다 | verify r5 · plan §15 gate 1 · `app/AGENTS.md` 기본 게이트 | 테스트 fixture를 `ResolvedHarnessSettings` 계약에 맞춘다 | BLOCKING | **closed (r7 — 실제 4필드 fixture, typecheck 3구성 진단 0)** |
| D18 | 준비 seam의 결과를 버려도(`executionCwd` 미대입) lint 0 error·전 스위트 2595 green — worktree는 만들어지고 Agent는 원본 checkout에서 돈다 | verify r5 · VP-05 · VP-11 · AC3·AC5·AC18 · §10 EP-08 | 소스 텍스트가 아니라 runtime acquire 순서와 최종 `TurnRequest.cwd`를 관측하는 oracle을 만든다 | BLOCKING | **closed (r10 확인 — M-A′·M-Q′ 둘 다 red)** |
| D19 | `[구현자 기입]` r5 절이 impl §8 7필드 중 4개만 갖는다 — `이번 라운드 수정의 잠금`·`구현 보고`·`Review Signals`와 게이트 산출 보고가 없다 | verify r5 · repository op | 다음 라운드 절은 일곱 필드를 이름 그대로 채운다 | 기록 | **closed (r6 — 7/7 필드)** |
| D20 | INDEX 비고가 "lint·typecheck … gate green"이라고 적었으나 `npm run typecheck`는 exit 2다 | verify r5 · repository op | 게이트 산출을 다시 읽어 적는다 | 기록 | **closed (r6 — INDEX에 r6 관측값 반영)** |
| D21 | DB insert 실패 rollback이 `<managed>/<repoId>` 빈 bucket을 남긴다(3회 → 3개) — 같은 함수의 `!added.ok` 형제 분기와 정책이 다르다 | verify r5 · D-011 · AC4 | 두 rollback 분기의 bucket 정리를 한 경로로 모은다 | NON_BLOCKING | open |
| D22 | `supervisor.startNew/startResume(turn)`은 `acquireRuntime` 콜백 안(`send.ts:182·187`)인데 `leaderTurn = turn`은 콜백 밖(213)이다 — 사이의 `await acquireTurnRuntime`(189)이 reject하면 finally의 `supervisor.release(leaderTurn)`(408)이 실행되지 않아 turn 등록이 남는다 | verify r9 · AC6 · VP-11 | turn 등록과 `leaderTurn` 대입을 한 지점에 두거나 콜백이 실패해도 핸들을 돌려준다 | BLOCKING | **closed (r10 확인 — M-S red 2)** |
| D23 | `send.ts`의 단계 주석 `── 6. TurnContext 조립`·`── 7. 런타임 확보`와 `0188 D-019` 근거 주석이 삭제됐다 — `src/main/AGENTS.md`는 `send.ts`를 "이름 붙은 12단계 시퀀스"로 서술한다 | verify r9 · repository op | 재배치한 단계에 같은 이름의 주석을 복원한다 | 기록 | **closed (r10 — 세 주석 복원)** |
| D24 | TurnRequest 조립(`send.ts:319`)이 `turn.cwd` 대신 source cwd를 써도 lint 0 · typecheck 0 · 전 스위트 2598 green — worktree는 만들어지고 Agent는 원본 checkout에서 돈다 | verify r10 · VP-11 · AC5 · §10 EP-08 4번째 좌표 | 같은 harness를 `acquireTurnRuntime` 성공으로 이어 TurnRequest의 `cwd`·`extraDirs`를 단언한다 | BLOCKING | **closed (r11 — M-T red 2 · M-T2 · M-U2 red)** |
| D25 | `leaderRuntime`이 `await` 뒤(`send.ts:221`)에만 대입돼 acquire가 throw하면 생성된 runtime 핸들이 닫히지 않는다 — D22의 형제 축이고 `ac622203:213`에도 같았던 선재 결함이다 | verify r10 · AC6 인접 | `leaderTurn`과 같은 축으로 맞춘다 | NON_BLOCKING | **closed (r11 — M-V red, 호출부 1/1 배선)** |
| D26 | VP-09 등록 변이("raw command를 feature에 심으면 sweep red")를 강제하는 장치가 없다 — `rg -n "runGit" src/main/features` = 0줄은 사실이나 그것을 지키는 테스트가 없다 | verify r10 · VP-09 | `no-node-fetch.test.ts` 형태의 가드를 두거나 pair의 적대 증거를 직접 oracle로 바꾼다 | NON_BLOCKING | **closed (r12 — `infra/source-scan` 기반 스윕, M-AJ·M-AJ2·M-AJ4 red, 자기 눈 M-AJ3 red)** |
| D27 | AC4의 "add/DB insert/abort 각 실패 주입 후 runtime 0회"가 관측 0이다 — VP-05는 자기 oracle로 통과했으나 이 행은 열려 있다 | verify r10 · AC4 | 준비 거부·abort·DB insert 실패를 주입해 runtime 0회를 단언한다 | NON_BLOCKING | **closed (r11 — 거부 경로 0회 관측; abort 는 D32)** |
| D28 | `### r10` 구현 보고와 INDEX 비고에 게이트 산출(파일/케이스/error 수)이 없다 — 거짓 주장은 없으나 impl §7이 요구한 관측값도 없다 | verify r10 · repository op | 게이트 결과를 관측값으로 적는다 | 기록 | open |
| D29 | `resolveDirty` 의 `stash push`·`commit -a`·`reset --hard` 가 `readOnly: true` 를 붙이는 `run()`(`git-cli.ts:33`)을 지난다 — queue 계약은 지켜지나 같은 파일이 `checkout` 은 mutation 으로 부르는 형제 비대칭이다 | verify r11 · D-014 인접 · §10 EP-12 | 상태를 바꾸는 명령은 read 라벨을 붙이지 않는다 | NON_BLOCKING | open |
| D30 | `queue-entry.test.ts` 의 `whileQueueHeld` 가 150ms 고정 대기다 — 느린 러너에서 git 이 그보다 오래 걸리면 우회해도 통과할 수 있다(이 환경 10회 반복은 4/4 안정) | verify r11 · VP-12 oracle | 시간이 아니라 queue 진입 자체를 관측하는 형태로 좁힌다 | 기록 | open |
| D31 | `send.worktree.test.ts` 가 모듈 10개를 mock 한다 — EP-08 좌표 3은 `buildTurnRequest` 의 **입력**이고 실제 `TurnRequest` 객체가 아니다. 이음매는 `turn-request.ts:93` 의 타입 spread 로 성립한다 | verify r11 · VP-11 범위 | 다음 라운드가 이 경계를 오해하지 않게 문서가 갖는다 | 기록 | open |
| D32 | AC4 의 `abort` 주입 후 runtime 0회가 관측 0이다 | verify r11 · AC4 (D27 에서 분리) | `AbortController` 를 service 에 주입해 취소 경로를 단언한다 | NON_BLOCKING | open |

### r4 — verify/FAIL 보완

- **설계 리뷰**: `APPLY` 모드의 선행 review 결과는 B/F다. plan §7·§9·§10과 impl §3·§5가 seam·변이·전수 증거를 이미 요구했으므로 handoff 지침 중복 추가 없이 구현과 증거를 보완했다.
- **강제 지점 전수와 V-pair 자기확인**: EP-09 하위 cwd fixture, EP-10 naming 실패/충돌, EP-12 alias queue를 신규 test로 관측했다. VP-14·VP-15·VP-17은 `SELF_PASS`; 전체 17 pair 중 나머지는 독립 검증 전 `SELF_BLOCKED`로 보수 표기한다.
- **이번 라운드 수정의 잠금**: queue alias swap은 `mutation-queue.test.ts`에서 두 번째 mutation의 조기 시작을 검출하고, containment 소거는 `executionCwd != worktreeRoot`와 정확 subpath 단언이 red로 만든다. runner는 fake `execFile`로 executable·args·env·shell 부재를 직접 관측한다.
- **Product/UX 파생 검토**: 선택 chip은 `aria-pressed`와 동일 selected tone을 `chipSurface`에서 함께 소유한다. 무효 session delete payload도 `DeleteSessionResult` union을 반환해 renderer의 `undefined.ok`를 막는다.
- **놓친 잠재 문제 + 대응**: D6·D10은 NEXT_HANDOFF로 유지한다. D5 error taxonomy와 D9 naming 시간 상한, send 준비 순서의 deferred seam은 이번 수정에서 닫지 않았으며 다음 검증 결과에 남긴다.
- **구현 보고**: D1은 add 실패 뒤 porcelain 목록에서 이번 경로를 exact containment로 찾아 remove하고, D2는 모든 mutation key를 realpath+normalize하며, D3는 조상 후보가 정확히 하나일 때만 bind하고 모호하면 구조화 로그 후 보존한다. AC 자기보고는 **✅ 16 · ⚠️ 3 · ❌ 1 = 20**이며 `Criteria-Met`은 16/20이다.
- **Review Signals**: r4이며 r2·r3와 같은 oracle 축을 이번에는 비어 있지 않은 subpath와 alias 교환 변이로 잠갔다. 반복 원인은 기존 지침 부재가 아니라 명시 seam·변이 실행 누락(B)과 구현 결함(F)이었다.
