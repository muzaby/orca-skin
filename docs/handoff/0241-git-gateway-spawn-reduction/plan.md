# Plan — 0241-git-gateway-spawn-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0241-git-gateway-spawn-reduction` |
| 작성자 | Claude Code |
| 일자 | 2026-09-25 |
| 매핑 | — (브랜치 `claude/git-infrastructure-performance-4f58s3`) |
| 상태 | **READY** |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 요청 하나가 git.exe 여러 개로 늘어난다. 턴 종료마다 세션당 7~8회, 브랜치 전환 1회에 9회 실행된다(§8 표).
- 완료 후 달라지는 것: git 실행이 main의 **단일 관문**을 지나고, 변하는 값은 요청당 probe 1회로 확인하며, OID로 정해지는 결과는 재사용된다.
- 성공을 사용자 관점에서 한 문장으로: 새 커밋이 없는 턴 종료에서 git 실행은 1회이고, 표시 값은 지금과 같거나 더 정확하다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Git.exe 실행 횟수 줄이는 방법. 캐싱. 결과 재활용 등 아키텍처링 관점에서 진단하라" | 라이브 세션 턴 1 |
| 명시 요구 | "계약 변경은 문제없다. 안전성 유지 혹은 상승, 유지보수 상승. 비용 최소화의 방향을 제안하라" | 라이브 세션 턴 2 |
| 명시 요구 | "전체 plan만 작성하라" | 라이브 세션 턴 3 |
| 추론 의도 | "전체"는 턴 2에서 제안한 단계 1~3(계측·안전 조치, GitReader, 계약 전환)을 한 plan에 담으라는 뜻이다. "plan만"은 이번 턴에 구현하지 않는다는 뜻이다 | 턴 2 응답의 "1·2와 3을 나눌지" 질문에 대한 답 |
| 추론 의도 | "비용"은 git 실행 비용과 구현·유지 비용 둘 다다. 두 비용이 충돌하면 안전성 → 유지보수 → 실행 비용 순으로 우선한다 | 턴 2 문장의 나열 순서 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | git.exe 실행 횟수를 줄인다. 수단은 호출 통합·캐싱·결과 재활용이다 | "Git.exe 실행 횟수 줄이는 방법. 캐싱. 결과 재활용" | 턴 1 | ACTIVE | — |
| D-002 | IPC 공개 계약 변경을 허용한다 | "계약 변경은 문제없다" | 턴 2 | ACTIVE | — |
| D-003 | 우선순위: 안전성 유지·상승 → 유지보수 상승 → 비용 최소화 | "안전성 유지 혹은 상승, 유지보수 상승. 비용 최소화의 방향" | 턴 2 | ACTIVE | — |
| D-004 | 단계 1~3을 한 plan에 담는다. 이번 턴은 plan만 작성한다 | "전체 plan만 작성하라" | 턴 3 | ACTIVE | — |
| D-005 | 변하는 값(저장소 좌표·HEAD·브랜치·dirty)은 캐시하지 않고 요청마다 probe 1회로 확인한다 | D-003 안전성. 캐시 무효화 버그가 생길 자리를 설계로 없앤다 | 설계 | ACTIVE | — |
| D-006 | 캐시 대상은 다음 셋뿐이다. ① OID로 정해지는 결과 ② git 실행 파일 경로(찾은 경우만) ③ origin URL(config 내용이 같을 때만) | D-005의 보완 | 설계 | ACTIVE | — |
| D-007 | 실패·타임아웃·중단·폴백 결과는 캐시하지 않는다. 예외는 origin 없음(exit 2)뿐이다(EP-09) | 타임아웃은 비결정적이다. 한 번의 부하가 영구 저하로 굳으면 안 된다 | 설계 | ACTIVE | — |
| D-008 | git 실행 파일은 PATH의 **절대 경로 항목**에서만 찾는다. 빈 항목·상대 항목은 건너뛰고, win32는 `git.exe`만 찾는다. 찾지 못한 결과는 memo하지 않는다 | D-003 안전성. 저장소 cwd의 가짜 git 실행을 차단한다. 앱을 켠 채 git을 설치해도 재시작이 필요 없다 | 설계 | ACTIVE | — |
| D-009 | Windows `cmd\git.exe` 런처 우회는 범위 밖이다 | 효과와 부작용(HOME·PATH 설정)이 실측되지 않았다. 추측으로 구현하지 않는다 | 설계 | ACTIVE | — |
| D-010 | `orca:git:status`와 `orca:git:diffSummary`를 `orca:git:snapshot` 하나로 합친다. 요약 포함 여부는 `includeSummary`로 정한다 | D-002. 같은 계기로 함께 도는 두 조회가 probe를 공유한다 | 설계 | ACTIVE | — |
| D-011 | checkout 성공 결과에 전환 후 `status`를 싣는다. renderer는 재조회하지 않는다 | 재조회 왕복과 그 사이 경합 구간을 없앤다 | 설계 | ACTIVE | — |
| D-012 | `GitDiffSummary.uncommitted` 필드를 삭제한다 | 항상 빈 값이고 renderer 소비처 0건이다(0211 §18 I-06) | 설계 | ACTIVE | — |
| D-013 | `ifRevision`/`unchanged` 응답은 도입하지 않는다 | main 캐시로 실행 비용은 이미 닫힌다. renderer에 이전 요약 보존 규칙을 늘리지 않는다(D-003 유지보수) | 설계 | ACTIVE | — |
| D-014 | 읽기용 diff·log에 `--no-ext-diff --no-textconv`를 붙인다 | 캐시 결정성 확보 + 저장소 config가 지정한 외부 프로그램의 실행 차단(D-003). textconv 사용자의 diff 표시는 원본 기준이 된다 | 설계 | ACTIVE | — |
| D-015 | 쓰기(checkout 해소 3종·checkout·worktree add/remove·branch -d·worktree repair)는 `gateway.mutate`를 거친다. 읽기 전용 env를 싣지 않고, 끝나면 세대를 +1 한다 | 지금은 해소 3종이 읽기 전용 env로 실행된다(`git-cli.ts:34`) | 설계 | ACTIVE | — |
| D-016 | 읽기는 전역 동시 실행 상한 4를 둔다. 쓰기는 상한 밖이다 | 여러 세션이 동시에 턴을 끝낼 때의 폭주를 흡수한다. 사용자 작업(쓰기)은 지연시키지 않는다 | 설계 | ACTIVE | — |
| D-017 | in-flight 중복 제거는 **진행 중인 실행만** 공유하고 완료 결과는 보관하지 않는다. 키에 세대를 넣는다 | 완료 결과를 보관하는 것은 D-005 위반이다 | 설계 | ACTIVE | — |
| D-018 | `removeForSession` 판정 순서와 worktree 이름 후보 루프의 동작은 바꾸지 않는다. 관문 경유만 바꾼다 | 순서를 바꾸면 dirty+커밋 동시 상황의 사유 문구가 바뀐다. 이름 규칙을 복제하면 SSOT가 둘이 된다 | 설계 | ACTIVE | — |
| D-019 | `runGit` 직접 사용과 `child_process` import는 `infra/git`의 관문·runner로 한정하고 lint로 강제한다. `app/legacy-paths.ts`의 repair도 `infra/git/worktree.ts`를 거친다 | D-003 유지보수. 새 호출부가 관문을 우회할 길을 막는다 | 설계 | ACTIVE | — |
| D-020 | production 실행 로그·계측은 범위 밖이다. 요청별 실행 횟수는 테스트 oracle로 고정한다 | 로그 폭주 없이 회귀를 잡는다(D-003 비용) | 설계 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-020 (신규 handoff).
- 변경된 결정: 없음.
- 사용자 확인 권장: D-014는 textconv를 쓰는 사용자의 diff 표시를 바꾼다. D-003에서 파생해 ACTIVE로 두었고, 사용자가 반대하면 SUPERSEDED로 처리한다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-005↔AC1·AC3(매 요청 probe 1회 단언), D-007↔AC8, D-008↔AC11·AC12, D-014↔AC10, D-017↔AC13, D-018↔AC20·AC24(순서·사유 불변)를 대조했다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당. renderer 계기는 이미 절제돼 있고 증폭은 main에서 일어난다 | `useGitSnapshot.ts:17-37` 계기는 초기·식별자·턴 종료·수동뿐. `git-cli.ts:62-73`이 status 1회에 4회 실행 |
| 이미 기존 코드가 충족하는가 | 부분. `repoCoords` 캐시가 `git-diff.ts`에만 있다 | `git-diff.ts:195` · `git-cli.ts`는 캐시 없음 |
| 더 작은 해법이 있는가 | probe 통합만으로 status 4→2가 된다. 턴 종료 1회까지 가려면 OID 캐시가 필요하다 | §14 |
| 선행 자료를 코드와 대조했는가 | 대조함. 턴 1 진단의 "Windows 런처 2배"는 미실측이라 D-009로 범위에서 뺐다 | — |
| ACTIVE·기존 결정과 충돌하는가 | 0211 D-063("좌표만 캐시")과 충돌하지 않는다. TO-BE는 좌표 캐시조차 없앤다 | `git-diff.ts:188` 주석 |

- 사용자에게 올릴 결정: 없음(D-014는 갱신 메모에 사용자 확인 권장으로 표기).
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

```text
[턴 종료 tick / 수동 새로 고침 / 초기·cwd 변경]
  → renderer가 orca:git:snapshot 1회 호출 (계기에 따라 includeSummary)
  → main: probe 1회 → status 조립 (origin URL은 config 내용이 같으면 캐시)
         → includeSummary면 (commonDir, base, head) 키로 요약 캐시 조회, 없을 때만 diff‖log
  → 컴포저 git 행·변경사항 타일이 갱신된다
  ↘ 저장소 아님/git 없음 → status.isRepo=false (지금과 같은 무해 폴백)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 초기 마운트·cwd 변경 | snapshot(includeSummary=false) | 브랜치 칩 표시. 지금과 같음 |
| 턴 종료·수동 새로 고침 | snapshot(includeSummary=true) | 칩과 변경 목록 갱신. IPC 2회 → 1회 |
| 브랜치 전환 성공 | checkout 결과의 `status`로 칩 갱신 | 재조회 없이 새 브랜치 표시 |
| 타일에서 패치 조회 | probe + 캐시된 패치 | 같은 범위를 다시 열어도 git 실행 1회 |
| 앱 실행 중 git 설치 | 다음 요청에서 실행 파일을 다시 찾는다 | 재시작 없이 칩이 나타난다 |

### 파생 UX / 엣지케이스

- loading / empty / error: 폴백 값과 의미는 지금과 같다(`isRepo:false`, `unavailable:true`).
- cancel / retry / close / restart: 캐시는 프로세스 메모리에만 있어 재시작하면 비어 있다. 영속화하지 않는다.
- concurrency / multi-session: 같은 인자의 동시 읽기는 실행 1회를 공유한다. 전역 읽기는 최대 4개가 동시에 돈다.
- 외부환경: 저장소 config에 `include`·`includeIf`·`worktreeConfig`가 있으면 origin URL을 캐시하지 않는다(§10 EP-09).

## 6. 범위 / 비범위

- **범위**: `infra/git` 관문·probe·캐시·실행 파일 해석, git IPC 계약 전환(snapshot·checkout 결과·`uncommitted` 삭제), renderer 호출부 3곳, `legacy-paths` repair 경로, lint 경계, IPC_CONTRACT·inventory 갱신.
- **비범위**: Windows 런처 우회(D-009), fs.watch, `.git` 파일 직접 읽기, `cat-file --batch` 상주 프로세스, production 계측(D-020), worktree 이름 루프 최적화(D-018), 캐시 영속화.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| Windows 런처 우회 | 아니오 — runner 내부 구현만 바뀐다 | NEXT_HANDOFF 후보(Windows 실측 선행) |
| `ifRevision` 응답 | 아니오 — 선택 필드로 추가할 수 있다 | 후속 |
| IPC 채널 이름 `orca:git:snapshot` | **예 — 공개 계약** | 지금 확정(D-010) |

## 7. Requirements / Acceptance — `R ↔ AT`

"실행 1회"는 관문이 runner를 1번 부른 것이다. 관측은 `createGitGateway({ run: countingRunner })`로 한다. countingRunner는 실제 `runGit`을 감싸 인자를 기록하고, 실제 임시 저장소에서 돈다.

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | baseline이 있는 세션에서 HEAD가 그대로면 요약 포함 snapshot 두 번째 호출의 실행은 1회다 | 2회째 기록 = `[probe 인자]` 정확 일치. 결과는 1회째와 deep-equal | renderer tick → `orca:git:snapshot` → `gitSnapshot` |
| R-01 | AT-02 / AC2 | HEAD가 새 커밋으로 움직이면 첫 조회는 probe·diff·log 3회, 같은 HEAD 재조회는 1회다 | 커밋 후 기록 집합 = {probe, diff, log}. 결과 files·commits가 새 커밋을 포함한다 | 같음 |
| R-01 | AT-03 / AC25 | baseline 없는 레거시 세션(`bornAt`)은 같은 HEAD에서 `rev-list`를 다시 부르지 않는다 | 2회째 기록에 `rev-list` 0건. base.oid는 1회째와 같다 | 같음 |
| R-02 | AT-04 / AC3 | 상태만 요청하면 첫 호출은 probe·`remote get-url` 2회, 두 번째는 1회다. `remote set-url` 뒤에는 새 URL을 준다 | 기록 정확 일치 + set-url 후 `githubUrl` 변경. 기존 케이스 "origin 주소를…현재 값을 읽는다" 통과 | renderer 초기 마운트 → snapshot(includeSummary=false) |
| R-02 | AT-05 / AC4 | 저장소가 아닌 디렉토리는 `isRepo:false`이고 실행 ≤2회, 없는 경로는 0회다 | 기록 길이 단언 + 결과 deep-equal `NOT_REPO` | 같음 |
| R-02 | AT-06 / AC5 | 커밋 0개 저장소에서 `branch`는 브랜치 이름, `detached:false`, 요약 `base.kind:'none'`이다 | 결과 단언 + 실행 ≤4회(probe 폴백 3 + origin 1) | 같음 |
| R-02 | AT-07 / AC6 | detached HEAD면 `branch:null`, `detached:true`다 | 기존 케이스 "detached HEAD 면…" 통과 | 같음 |
| R-03 | AT-08 / AC7 | 같은 범위 패치의 두 번째 호출은 실행 1회(probe)다. 커밋 선택 패치도 두 번째는 1회다(`cat-file` 캐시) | 2회째 기록 = `[probe]`. 결과 deep-equal | 타일 → `orca:git:diffPatch` → `gitDiffPatch` |
| R-03 | AT-09 / AC8 | 전문맥 조회 실패로 얻은 축소 결과는 캐시되지 않는다. 같은 요청을 다시 하면 전문맥을 다시 시도한다 | 2회째 기록에 `--unified=1000000` 존재 | 같음 |
| R-06 | AT-10 / AC9 | 모든 읽기 실행은 `--no-optional-locks`로 시작하고 `readOnly:true`다. 쓰기 실행에는 둘 다 없다 | **차집합** — 읽기 기록 중 조건 불만족 0건, 쓰기 기록 중 조건 만족 0건 | 관문 `read`/`mutate` |
| R-06 | AT-11 / AC10 | 저장소 config에 `diff.external`과 textconv 드라이버가 있어도 요약·패치 조회가 그 프로그램을 실행하지 않는다 | 마커 파일을 쓰는 스크립트를 드라이버로 등록 → 조회 후 마커 부재. diff/log 기록 중 두 플래그 누락 0건(차집합) | 요약·패치 경로 |
| R-05 | AT-12 / AC11 | PATH에 `.`·빈 항목·상대 항목이 있고 cwd에 실행 가능한 가짜 `git`이 있어도 그것을 실행하지 않는다 | posix 실제 실행: 가짜 git이 쓰는 마커 부재 + 결과가 진짜 git 기준. 해석 함수 단위 테스트(win32 규칙 포함) | 모든 git 실행 → runner |
| R-05 | AT-13 / AC12 | git을 찾지 못하면 실행 0회로 `unavailable`이 되고, prepare는 `git-unavailable`을 준다. 이후 PATH에 git이 생기면 재시작 없이 찾는다 | spawn 0회 단언 + reject 사유 단언 + PATH 교체 후 `isRepo:true` | runner·`WorktreeService.prepare` |
| R-04 | AT-14 / AC13 | 인자가 같은 동시 읽기 2건은 실행 1회를 공유한다. 쓰기가 끝난 뒤 들어온 같은 읽기는 새로 실행한다 | 지연 runner로 실행 횟수 단언(1 → 쓰기 후 2) | 관문 |
| R-04 | AT-15 / AC14 | 서로 다른 읽기 10건을 동시에 요청하면 동시 실행은 최대 4다 | 지연 runner의 최대 in-flight 관측값 = 4 | 관문 |
| R-04 | AT-16 / AC15 | clean 트리 전환 성공 결과는 `{ok:true, branch, status}`이고 `status.branch`는 새 브랜치다. origin 캐시 적중 시 실행 4회. dirty·해소 없음은 2회이며 결과 형태는 지금과 같다 | 결과 단언 + 기록 정확 일치. 기존 checkout 케이스 전부 통과 | 칩 → `orca:git:checkout` → `gitCheckout` |
| R-07 | AT-17 / AC16 | renderer는 계기당 snapshot을 1회 부른다. 초기·cwd 변경은 `includeSummary:false`, 턴 종료·수동은 `true`, sessionId만 바뀌면 호출하지 않는다 | 순수 계획 함수의 표 단언(계기 6종 × 기대 요청) | `useGitSnapshot` |
| R-07 | AT-18 / AC17 | 전환 성공 후 칩은 결과의 `status`로 갱신되고 추가 snapshot 호출이 없다 | `checkoutOutcome`이 `status`를 싣는다 + 배선 테스트에서 성공 후 `gitApi.snapshot` 호출 0건 | `BranchChip.tsx` |
| R-07 | AT-19 / AC18 | 원격 메뉴는 snapshot의 `status.githubUrl`을 쓴다 | `gitIdentityRemoteWiring` 케이스가 snapshot 경로로 통과 | `useGitIdentityRemote` |
| R-07 | AT-20 / AC19 | `orca:git:status`·`orca:git:diffSummary`가 없고 `orca:git:snapshot`이 있다. `GitDiffSummary`에 `uncommitted`가 없다. 잘못된 요청은 zod가 거절한다 | `ipc-documentation.test.ts` + `check-doc-inventory --check` + typecheck + 스키마 케이스 | preload → handler |
| R-08 | AT-21 / AC20 | `baseRef` 없는 worktree 준비는 실행 4회(probe·check-ref-format·show-ref·worktree add), 새 세션 passthrough 기준선은 1회다. 결과는 지금과 같다 | 기록 정확 일치 + 기존 `service.test`·`prepare-worktree.test` 통과 | `chat:send` → `prepareTurnWorktree` |
| R-08 | AT-22 / AC21 | 경로 이관 repair가 `repairWorktree`를 거치고 동작은 지금과 같다 | 기존 `legacy-paths.test` 16건 통과(주입 seam만 교체) | 부팅 → `repairMovedWorktrees` |
| R-09 | AT-23 / AC22 | `infra/git/runner.ts`·`child_process`를 허용 파일 밖에서 import하면 lint가 실패한다 | 변이: `features/worktrees/service.ts`에 runner import를 심으면 `npm run lint` error | `app/eslint.config.mjs` |
| R-09 | AT-24 / AC23 | 불변 캐시는 크기 상한을 넘기면 가장 오래 안 쓴 항목부터 버린다 | 단위: 상한·접근 순서·크기 계산 | 관문 캐시 |
| R-09 | AT-25 / AC24 | 기존 git·worktree 동작 테스트가 계약 변경분 외에는 수정 없이 통과한다 | §19 스위트 전체 green. 수정된 기대값은 `uncommitted`·채널명·`status` 추가분뿐(diff로 확인) | 전 경로 |

### AC 검증 주의사항

- 기존 테스트 재사용: `git-cli.test.ts` 32건, `git-diff.test.ts` 92건, `git-diff-commit.test.ts` 26건, `repository.test.ts` 9건, `legacy-paths.test.ts` 16건, worktrees 30건(`rg -c "it\("`, 이번 세션 실측). AC4·AC6·AC15가 인용한 케이스명이 `git-cli.test.ts:66,118,129,142`에 있음을 확인했다.
- 사람 실기 항목: 없음. 실행 횟수와 결과는 모두 실제 git 임시 저장소에서 자동 단언한다.
- N회 기준: sink는 `runGit` 하나다(`rg "execFile" src/main` 실행 → production 1곳 `runner.ts:32`, 테스트 픽스처 1곳). TO-BE의 모든 production 호출부는 관문을 지나므로(AC22) countingRunner가 전 호출부를 모형한다. 픽스처의 `execFile`은 관측 대상이 아니다.
- AC9·AC10은 "있다"를 몇 건 세지 않고 **차집합 0건**으로 센다. 0211 AT-39 방식이다(`git-diff.test.ts:342`).
- AC1·AC2·AC7의 "정확 일치"는 방향을 함께 잠근다. 관문을 우회하면 기록이 0건이 되어 실패하고, 캐시를 빼면 기록이 늘어 실패한다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V. 이 영역의 0211 V를 상속해 일부만 바꾸는 작업이 아니다. 관문 재구성은 새 계약이다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | 턴 종료 요약 비용 — AC1·AC2·AC25 | NEW | — |
| R-02 | R | 상태 조회 비용·정확성 — AC3~AC6 | NEW | — |
| R-03 | R | 패치 비용과 폴백 비캐시 — AC7·AC8 | NEW | — |
| R-04 | R | 동시성·전환 — AC13~AC15 | NEW | — |
| R-05 | R | 실행 파일 해석 안전성 — AC11·AC12 | NEW | — |
| R-06 | R | 읽기 무잠금·외부 프로그램 차단 — AC9·AC10 | NEW | — |
| R-07 | R | IPC 계약 전환 — AC16~AC19 | NEW | — |
| R-08 | R | worktree 준비·이관 경로 — AC20·AC21 | NEW | — |
| R-09 | R | 유지보수 경계·회귀 — AC22~AC24 | NEW | — |
| SD-01 | SD | 턴 종료 tick → snapshot → probe → 캐시 → store (§9 TO-BE) | NEW | — |
| SD-02 | SD | 칩 전환 → mutate → 결과 status → 칩 (§9 TO-BE) | NEW | — |
| AR-01 | AR | 관문 단일 경유(read/mutate)와 lint 경계 (§10 EP-01·EP-05·EP-10) | NEW | — |
| AR-02 | AR | preload·handler·renderer 배선 (§10 EP-08) | NEW | — |
| MD-01 | MD | `probeRepo` 파서와 폴백 (§11) | NEW | — |
| MD-02 | MD | 불변 LRU 캐시와 키 (§10 EP-03·EP-06) | NEW | — |
| MD-03 | MD | in-flight 공유·세마포어·세대 (§10 EP-05) | NEW | — |
| MD-04 | MD | `resolveGitExecutable` (§10 EP-04) | NEW | — |
| MD-05 | MD | renderer 조회 계획 함수 (§11) | NEW | — |
| MD-06 | MD | origin URL 캐시 검증값 (§10 EP-09) | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02·03 | REQUIRED | tick → `gitApi.snapshot` → handler → `gitSnapshot` → probe → 요약 캐시 → store | AC1·AC2·AC25 기록 정확 일치 | not selected — 정확 일치가 캐시 제거·우회 양방향에 반응 | EP-03(5)·EP-06(5) |
| VP-02 | R-02 ↔ AT-04~07 | REQUIRED | 초기 마운트 → snapshot(false) → probe → origin 캐시 → status | AC3~AC6 결과·기록 단언 | required — config 내용 비교를 mtime 비교로 바꾸는 변이. 같은 길이 URL로 즉시 set-url 했을 때 AC3 실패 확인. 심을 자리: `origin-url.ts` 검증 함수 | EP-09(1) |
| VP-03 | R-03 ↔ AT-08·09 | REQUIRED | 타일 → `diffPatch` → probe → cat-file 캐시 → 패치 캐시 | AC7·AC8 | required — 폴백 결과를 캐시에 넣는 변이 → AC8 실패. 자리: `gitDiffPatch` 폴백 분기 | EP-03(패치 2자리) |
| VP-04 | R-04 ↔ AT-14~16 | REQUIRED | 칩 → `orca:git:checkout` → `gitCheckout` → mutate → probe | AC13~AC15 | not selected — 지연 runner 관측이 직접 oracle | EP-05(7)·EP-07(1) |
| VP-05 | R-05 ↔ AT-12·13 | REQUIRED | 모든 요청 → runner → `resolveGitExecutable` → execFile(절대 경로) | AC11 마커 부재·AC12 0회 | required — 해석 함수에서 상대 항목 필터를 지우는 변이 → AC11 실패. 자리: `git-executable.ts` | EP-04(1) |
| VP-06 | R-06 ↔ AT-10·11 | REQUIRED | 읽기 호출부 → `gateway.read` → runner | AC9·AC10 차집합 0건 + 마커 부재 | required — `read`에서 플래그 추가를 지우는 변이·`DIFF_SAFETY_ARGS` 한 자리를 지우는 변이 → 각각 실패 | EP-01(1)·EP-02(6) |
| VP-07 | R-07 ↔ AT-17~20 | REQUIRED | renderer 3호출부 → preload → handler | AC16 표·AC17·AC18 배선·AC19 문서 가드 | not selected — 표 단언과 채널 실측 가드가 직접 oracle | EP-08(3) |
| VP-08 | R-08 ↔ AT-21·22 | REQUIRED | `chat:send` → `prepareTurnWorktree` → probe/mutate · 부팅 → repair | AC20 기록 + 기존 스위트 | not selected | EP-05(repair 1자리 포함) |
| VP-09 | R-09 ↔ AT-23~25 | REQUIRED | lint 설정 · 관문 캐시 · 전 스위트 | AC22 lint · AC23 단위 · AC24 green | required — AC22 자체가 변이 증거(runner import 심기) | EP-10(1) |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | 위 VP-01 경로 전체를 실제 저장소로 커밋 전후 2회 실행 | 커밋 전후 snapshot 결과가 새 커밋 반영 + 실행 수 1→3→1 | not selected | EP-03·EP-06·EP-08 (11) |
| VP-11 | SD-02 ↔ ST-02 | REQUIRED | 실제 저장소에서 checkout → 결과 status → 다음 snapshot | 결과 status와 이후 snapshot status 동일 | not selected | EP-05·EP-07 (8) |
| VP-12 | AR-01 ↔ IT-01 | REQUIRED | production 모듈 전체 → 관문 | AC22 lint + AC9 차집합 | VP-09와 공유 | EP-01·EP-05·EP-10 (9) |
| VP-13 | AR-02 ↔ IT-02 | REQUIRED | preload `git.snapshot` → `CHANNELS.gitSnapshot` → `registerGitHandlers` | `ipc-documentation.test` + 스키마 거절 케이스 | not selected | EP-08(3) |
| VP-14 | MD-01 ↔ UT-01 | REQUIRED | `probeRepo` | 정상·하위 디렉토리·worktree·unborn·detached·비저장소·경로 없음 7케이스 | not selected | 0 — 순수 파서 |
| VP-15 | MD-02 ↔ UT-02 | REQUIRED | `createImmutableCache` | AC23 | not selected | EP-06(5) |
| VP-16 | MD-03 ↔ UT-03 | REQUIRED | `createGitGateway` | AC13·AC14 | not selected | EP-05(1 세대) |
| VP-17 | MD-04 ↔ UT-04 | REQUIRED | `resolveGitExecutable` | posix·win32 규칙 표 단언 | VP-05와 공유 | EP-04(1) |
| VP-18 | MD-05 ↔ UT-05 | REQUIRED | `planGitSnapshotQuery` | AC16 표 | not selected | 0 — 순수 함수 |
| VP-19 | MD-06 ↔ UT-06 | REQUIRED | `readOriginUrl` | 내용 같음 → 캐시, 다름 → 재조회, include 존재 → 매번 조회 | VP-02와 공유 | EP-09(1) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `app` lint·typecheck | `app/src/**` 수정 | `cd app && npm run lint && npm run typecheck` | 현재 변경이 만든 error |
| 비-DB vitest | git·worktree·renderer 순수 스위트 | `./node_modules/.bin/vitest run src/main/infra/git src/main/features/worktrees src/main/app/chat-turn src/main/app/legacy-paths.test.ts src/renderer/src/features/chat src/shared` | 현재 변경 관련 red. DB ABI red는 기준선으로 분리(`app/AGENTS.md §better-sqlite3 ABI`) |
| 문서 인벤토리 | 채널 수·IPC 문서 변경 | `node scripts/check-doc-inventory.mjs --check` (app에서) | 불일치 |
| 커밋 trailer | message bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| production에서 git을 실행하는 곳은 `runner.ts` 하나다 | `rg "node:child_process" src/main` → production 1(`infra/git/runner.ts`), 픽스처 1 |
| `runGit` 직접 import는 `infra/git` 밖에 1곳 있다 | `app/legacy-paths.ts:16` (`worktree repair`) |
| `execFile('git')`은 bare 이름이고 cwd는 사용자 저장소다 | `runner.ts:32-37` |
| 읽기 전용 표시가 두 방식이다 | env: `runner.ts:28` · 플래그: `git-diff.ts:44,52` |
| 해소 3종(stash/commit/reset)이 읽기 전용 env로 실행된다 | `git-cli.ts:34,107-111` |
| 좌표 캐시는 `git-diff.ts`에만 있다 | `git-diff.ts:195-218` |
| 한 번의 `rev-parse`가 6개 값을 준다(born 저장소) | 이번 세션 실측 git 2.43: inside·toplevel·git-dir·common-dir·HEAD oid·symbolic HEAD |
| unborn 저장소에서는 위 호출이 exit 128이다 | 실측 |
| 하위 디렉토리에서 `--git-common-dir`은 cwd 기준 상대 경로다 | 실측 `../.git`. `path.resolve(cwd, v)`로 정규화한다 |
| unborn 저장소에서 `diff HEAD --shortstat`은 실패한다 | 실측 exit 128 → 지금의 `rev-parse --verify HEAD` 선행 호출은 probe의 `head.kind`로 대체 가능 |
| `--no-ext-diff --no-textconv`는 diff·log 모두 받는다 | 실측 exit 0 |
| status 소비처: 3곳 | `useGitSnapshot.ts:105` · `BranchChip.tsx:81` · `useGitIdentityRemote.ts:68` |
| `uncommitted` 소비처: 타입 1·주석 1·생산자 1, renderer 읽기 0 | `rg uncommitted src` |
| 채널 수는 생성물이 갖고 CI가 대조한다 | `ipc-documentation.test.ts` · `ci.yml:55-56` |
| 위생 가드용 source-scan은 문자열 리터럴을 지운다 → import 경로 검사에 쓸 수 없다 | `source-scan.ts:47`. 그래서 lint(`no-restricted-imports`)로 강제한다 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `infra/git` 외부 import | `rg "from '.*infra/git/" src/main` (테스트 제외) | 7 | 4개 파일(`prepare-worktree`·`handlers/git`·`legacy-paths`·worktrees 2) |
| renderer `gitApi` 호출 파일 | `rg "gitApi\." renderer` (테스트 제외) | 4 | `BranchChip`·`useGitIdentityRemote`·`useGitSnapshot`·`useGitPatch` |
| `gitApi` 참조 테스트 | 같은 검색(테스트) | 3 | `gitIdentityRemoteWiring`·`gitQueryOwner`·`gitPatchQuery` |
| git 채널 | `shared/ipc.ts:74-82` | 5 | status·branches·checkout·diffSummary·diffPatch |
| 쓰기 호출부 | 코드 읽기 | 7 | 해소 3종·checkout·worktree add·remove·branch -d (+ repair 1 = 8) |

### 수치 / 전칭 표현 검산 — AS-IS 요청별 실행 수(코드 읽기, 이번 세션)

| 요청 | 실행 수 | 내역 |
|---|---:|---|
| status | 4 | inside 1(`git-cli.ts:48`) + symbolic-ref·toplevel·remote 3(`:69-73`) |
| diffSummary (baseline 있음, 좌표 캐시 적중) | 3 | diff·rev-parse HEAD(`git-diff.ts:258-261`) + log(`:266`) |
| 턴 종료 합계 | 7 (+ 타일 열림 시 패치 1 = 8) | 4 + 3 (+1) |
| checkout clean + renderer 재조회 | 9 | inside·rev-parse HEAD·shortstat·toplevel·checkout 5 + status 4 |
| checkout dirty, 해소 없음 | 4 | inside·rev-parse·shortstat·symbolic-ref |
| 새 세션 passthrough 기준선 | 2 | `prepare-worktree.ts` resolveHead·resolveHeadRef |
| worktree 준비(baseRef 없음, 후보 1) | 6 | toplevel 1 + ref·oid 2 + check-ref·show-ref 2 + add 1 |

- "유일한 실행 지점" 반례 검색: `rg "execFile|spawn\(" src/main` 중 git 실행은 runner 1곳과 픽스처뿐이다.
- 문서 앵커 확인: `IPC_CONTRACT.md` `### 2.6-b Git`(198행)이 존재한다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01, SD-02, AR-01.
- 현재 책임 소유자: 판정 함수가 `git-cli.ts`·`git-diff.ts`·`repository.ts` 세 파일에 흩어져 있고 각자 `runGit`을 부른다.
- 문제의 직접 원인: 같은 질문(저장소인가·루트·HEAD)을 파일마다 따로 묻고, OID로 정해지는 결과도 매번 다시 계산한다.

```text
tick ─┬─ gitApi.status ──> gitStatus ──> runGit ×4
      └─ gitApi.diffSummary ──> gitDiffSummary ──> runGit ×3 (좌표 캐시만)
칩 전환 ──> gitCheckout ──> runGit ×5 ──> renderer refresh ──> gitStatus ×4
legacy-paths ──> runGit (관문 없음)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01, SD-02, AR-01, AR-02.
- 변경 후 책임 소유자: `infra/git/gateway.ts`가 유일한 실행 관문이다. 판정은 `probe.ts` 하나가 갖는다.

```text
tick ──> gitApi.snapshot({includeSummary}) ──> handler ──> gitSnapshot
           ├─ probeRepo ──> gateway.read ×1
           ├─ readOriginUrl ──> (config 내용 같음) 캐시 | gateway.read ×1
           └─ summary? ──> immutableCache[(commonDir, base, head)] | gateway.read diff‖log
칩 전환 ──> gitCheckout ──> probe·shortstat(read) ──> gateway.mutate(checkout) ──> probe ──> {ok, branch, status}
legacy-paths ──> worktree.repairWorktree ──> gateway.mutate
gateway.read  = 세마포어(4) + in-flight 공유(키에 세대) + --no-optional-locks + readOnly
gateway.mutate = withRepoMutation + 세대 +1 (finally)
runner = resolveGitExecutable(절대 경로) ──> execFile
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 3파일이 각자 판정·실행 | probe 1곳, 실행은 관문 1곳 | D-019 | AR-01 / VP-12 · `gateway.ts`·`probe.ts` |
| data/control flow | status·summary 별도 IPC | snapshot 1 IPC, probe 공유 | D-010 | SD-01 / VP-10 · `git-snapshot.ts` |
| state/contract | `uncommitted` 필드, checkout 결과에 status 없음 | 필드 삭제, `status` 추가 | D-011·D-012 | AR-02 / VP-13 · `shared/ipc.ts` |
| 캐시 | 좌표 캐시(cwd 키, 무효화 없음) | 좌표 캐시 **삭제**. OID 결과 LRU + origin URL(내용 검증) + 실행 파일 경로 | D-005·D-006 | MD-02·MD-06 / VP-15·VP-19 |
| error/lifecycle | 실패도 매번 재실행(캐시 없음) | 실패·폴백은 캐시 안 함 | D-007 | VP-03 · AC8 |
| 보안 | bare `git`, cwd = 저장소 | PATH 절대 항목 해석. diff·log 외부 프로그램 차단 | D-008·D-014 | VP-05·VP-06 |
| test seam | `runner = runGit` 기본 인자(`git-diff.ts`만) | 모든 공개 함수가 `gateway` 인자를 받는다(기본값 = production 관문) | 실행 수 oracle | VP-01~VP-09 |

**사라지는 책임**: `repoCoordsCache`(삭제 — probe가 대체), `insideWorkTree`·`repoRoot`(삭제 — probe), `headOid`(삭제 — probe.head), `gitAvailable`의 `--version` 실행(대체 — 실행 파일 해석 결과), `READ_ONLY_GIT_FLAG` 호출부별 부착(이동 — `gateway.read`).

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `infra/git/git-executable.ts` | PATH에서 git 절대 경로 해석 | `{env, platform, isFile}` → `string \| null` | runner |
| `infra/git/runner.ts` | execFile 실행 | 기존 `GitRunResult` + `unavailable?: true` | gateway만 |
| `infra/git/gateway.ts` | read/mutate 관문, 세마포어·in-flight·세대 | `GitGateway` | infra/git 내부 모듈 |
| `infra/git/immutable-cache.ts` | 크기 상한 LRU | `get/set` | gateway 소비 모듈 |
| `infra/git/probe.ts` | 저장소 판정 1회 | `RepoProbe` | git-cli·git-diff·git-snapshot·repository |
| `infra/git/origin-url.ts` | origin URL + 검증값 캐시 | `string \| null` | git-snapshot·git-cli |
| `infra/git/git-snapshot.ts` | status(+summary) 조립 | `GitSnapshotResult` | `app/handlers/git.ts` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-06·12 — **EP-01** | 읽기는 `--no-optional-locks` 선두 + `readOnly:true` | `gateway.read` | gateway | 모든 읽기 실행 직전 (1자리) | 사용자 저장소 index.lock 경합 |
| R-06 / VP-06 — **EP-02** | diff·log 읽기에 `--no-ext-diff --no-textconv` | `DIFF_SAFETY_ARGS` 상수(`git-diff.ts`) | 호출부 | 6자리: 요약 diff · log 정상 · log 폴백 · 패치 전문맥 · 패치 축소 · checkout shortstat | 외부 프로그램 실행·캐시 비결정 |
| MD-02 / VP-01·03 — **EP-03** | 캐시에는 `ok` 결과만 넣는다 | 각 `set` 호출부 | git-diff | 5자리: 요약 diff · history(정상만) · 패치(전문맥만) · commit parent · bornAt 기준 | 일시 실패가 영구화 |
| MD-04 / VP-05 — **EP-04** | 실행은 절대 경로로만 | `resolveGitExecutable` | runner | 실행마다 (1자리) | 저장소 안 가짜 git 실행 |
| AR-01 / VP-04·08 — **EP-05** | 쓰기는 `gateway.mutate` 경유 + 세대 +1 | `gateway.mutate` | git-cli·worktree | 8자리: stash·commit-wip·discard·checkout·worktree add·remove·branch -d·repair (+세대 1) | 락 없이 쓰기 / 쓰기 전 읽기 결과 공유 |
| MD-02 / VP-15 — **EP-06** | 캐시 키 = `[commonDir, kind, ...oid]` | `cacheKey()` | git-diff | EP-03의 5자리와 같은 자리의 `get` | 다른 저장소 설정의 결과 공유 |
| SD-02 / VP-04·11 — **EP-07** | checkout 성공 결과에 `status` | `gitCheckout` | git-cli | 성공 반환 1자리 | 칩이 옛 브랜치 표시 |
| AR-02 / VP-07·13 — **EP-08** | renderer의 상태 조회는 `gitApi.snapshot`만 | `gitApi` | renderer | 3자리: `useGitSnapshot`·`BranchChip` 초기 로드·`useGitIdentityRemote` | 없는 채널 호출(typecheck가 잡는다) |
| MD-06 / VP-02·19 — **EP-09** | origin URL 캐시는 `<commonDir>/config` 내용이 같고 `include`·`includeIf`·`worktreeConfig`가 없을 때만 적중. 저장 대상은 성공한 URL과 exit 2(`No such remote`, 실측)의 `null`뿐 | `readOriginUrl` | origin-url | 조회마다 (1자리) | 원격 변경 후 옛 URL 표시 |
| AR-01 / VP-09 — **EP-10** | `runner`·`child_process` import 허용 파일 = `gateway.ts`·`runner.ts`·테스트·픽스처 | `app/eslint.config.mjs` | lint | `npm run lint` (1자리) | 관문 우회 호출부 |

- 같은 규칙의 SSOT: 브랜치 이름은 기존 `GitBranchNameSchema`, OID 형식은 기존 `revParseOid` 정규식을 유지한다. probe도 HEAD oid를 같은 함수로 검증한다.
- "다른 게이트가 막는다" 기재: EP-08의 "typecheck가 잡는다" — 채널을 지우면 `window.orca.git.status` 타입이 사라져 호출부가 컴파일 오류가 된다. 구현 턴에 채널 제거 후 typecheck 실패를 관측해 기록한다.
- 선택적 필드 의미: `GitSnapshotResult.summary`는 `includeSummary:false`면 항상 `null`이다. `true`인데 `null`이면 폴백(zod 실패)이며 renderer는 요약 조회 실패로 처리한다. `GitRunResult.unavailable`은 실행 파일을 못 찾았을 때만 `true`고 그 외에는 없다.

### 새 타입

```ts
// shared/ipc.ts
export interface GitSnapshotQuery { cwd: string; sessionId?: string; includeSummary: boolean }
export interface GitSnapshotResult { status: GitStatus; summary: GitDiffSummary | null }
export type GitCheckoutResult =
  | { ok: true; branch: string; status: GitStatus }
  | { ok: false; reason: 'dirty'; from: string | null; stat: GitDirtyStat }
  | { ok: false; reason: 'not-repo' | 'error'; message: string; applied?: GitDirtyResolution }
// GitDiffSummary 에서 uncommitted 삭제

// infra/git/probe.ts
export type RepoHead =
  | { kind: 'branch'; name: string; oid: string }
  | { kind: 'detached'; oid: string }
  | { kind: 'unborn'; name: string | null }
export type RepoProbe =
  | { kind: 'unavailable' }                 // 실행 파일 없음
  | { kind: 'not-repo' }                    // 경로 없음·작업 트리 밖
  | { kind: 'repo'; root: string; gitDir: string; commonDir: string; head: RepoHead }
```

`CHANNELS.gitSnapshot = 'orca:git:snapshot'`를 추가하고 `gitStatus`·`gitDiffSummary`를 삭제한다. 스키마는 `GitSnapshotRequestSchema = GitDiffRequestSchema.extend({ includeSummary: z.boolean() })`이다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `infra/git/git-executable.ts` (신규) | 실행 파일 해석 | PATH 분리(win32 `;`, 그 외 `:`), 빈 항목·`!isAbsolute` 제외, 후보 `git.exe`(win32)/`git`, 첫 `isFile` 적중. 양성만 memo | 순수 — `isFile` 주입 |
| `infra/git/runner.ts` | 실행 | 해석 결과가 null이면 spawn 없이 `{ok:false, unavailable:true}`. 경로는 절대 경로로 execFile | 기존 `execFileImpl` + resolver 주입 |
| `infra/git/gateway.ts` (신규) | 관문 | `createGitGateway({run, maxConcurrentReads=4})` → `read(cwd, args, {maxBuffer, timeoutMs})`, `mutate(repoPath, fn)`, `generation()`. read 키 = `JSON.stringify([gen, cwd, args, maxBuffer])`. 완료 시 in-flight 맵에서 제거. production 싱글턴 `gitGateway` | 가짜 run 주입 |
| `infra/git/immutable-cache.ts` (신규) | LRU | `createImmutableCache<V>({maxUnits, sizeOf})`, Map 삽입 순서 LRU | 순수 |
| `infra/git/probe.ts` (신규) | 판정 | stat → `rev-parse --is-inside-work-tree --show-toplevel --git-dir --git-common-dir HEAD --symbolic-full-name HEAD`. 실패 시 좌표 4개만 다시 묻고, 성공하면 `symbolic-ref -q HEAD`로 unborn 이름을 얻는다. 경로는 `resolve(cwd, v)` 후 `canonicalPath` | gateway 주입 + 실저장소 |
| `infra/git/origin-url.ts` (신규) | 원격 URL | config 파일 내용을 읽어 `Map<commonDir, {content, url}>` 대조. include 류가 있으면 캐시 우회 | fs·gateway 주입 |
| `infra/git/git-snapshot.ts` (신규) | snapshot 조립 | probe 1회 → status. `includeSummary`면 같은 probe로 `summarize(probe, baseline)` | gateway 주입 |
| `infra/git/git-diff.ts` | 요약·패치 | `repoCoords`·`headOid` 삭제. `resolveDiffRange`가 probe.head를 받는다. base oid = head oid면 diff 생략(빈 결과). diff·log·cat-file·rev-list·패치 결과를 LRU에 저장(ok만). `DIFF_SAFETY_ARGS` 부착. 공개 함수 인자 `runner` → `gateway` | gateway 주입 |
| `infra/git/git-cli.ts` | branches·checkout | `insideWorkTree`·`repoRoot`·`dirtyStat` 선행 rev-parse 삭제 → probe. 해소 3종·checkout은 `gateway.mutate`. 성공 시 probe로 `status` 조립. `gitStatus` 삭제(`git-snapshot`으로 이동) | gateway 주입 |
| `infra/git/repository.ts` | 기존 판정 API | `resolveRepoRoot`·`resolveHead`·`resolveHeadRef`를 probe 위로 재구현. `gitAvailable`은 삭제(probe `unavailable`) | gateway 주입 |
| `infra/git/worktree.ts` | 쓰기 | add/remove/deleteBranch를 `gateway.mutate`로. `repairWorktree` 신설 | 기존 |
| `infra/git/mutation-queue.ts` | 저장소 락 | 유지. `gateway.mutate` 내부에서만 부른다 | 기존 |
| `features/worktrees/service.ts` | 준비 | `resolveRepoRoot`+`gitAvailable`+head 2회 → probe 1회. 판정 순서·사유 문구 불변(D-018) | 기존 operations 주입 |
| `app/chat-turn/prepare-worktree.ts` | passthrough 기준선 | resolveHead·resolveHeadRef → probe 1회 | 기존 |
| `app/legacy-paths.ts` | repair | `git: GitRunner` 주입 → `repair: typeof repairWorktree` | 기존 테스트의 주입부만 교체 |
| `app/handlers/git.ts` | IPC | status·diffSummary 핸들러 → snapshot 핸들러 1개. 폴백 `{status: NOT_REPO, summary: null}` | 통합 |
| `shared/ipc.ts`·`shared/protocol.ts` | 계약 | §10 새 타입·채널·스키마. `uncommitted` 삭제 | 스키마 케이스 |
| `preload/index.ts`·`renderer/src/shared/api/ipc.ts` | 배선 | `git.snapshot` 추가, `status`·`diffSummary` 삭제 | typecheck |
| `renderer/.../useGitSnapshot.ts` | 조회 owner | 두 effect를 하나로 합친다. 순수 `planGitSnapshotQuery(prevStatus, prevSummary, next)` → `{status, summary}` 사유. summary 사유가 있으면 owner.run(`includeSummary:true`)의 onResult가 `setGitStatus`와 `receiveGitSnapshotSummary`를 둘 다 부른다. status 사유만 있으면 `includeSummary:false` | 순수 함수 표 |
| `renderer/.../BranchChip.tsx`·`branchChipState.ts` | 전환 | `checkoutOutcome`의 `switched`가 `status`를 싣는다. 성공 시 `setSnapshot({cwd, status})`. 초기 로드는 `snapshot(false).status` | 순수 + 배선 |
| `renderer/.../useGitIdentityRemote.ts` | 원격 메뉴 | load = `snapshot({cwd, includeSummary:false}).then(r => r.status)` | 기존 wiring 테스트 |
| `app/eslint.config.mjs` | 경계 | `src/main/**`에 `no-restricted-imports` 패턴 `**/infra/git/runner`·`node:child_process`, 허용 파일 override | AC22 변이 |
| `docs/IPC_CONTRACT.md §2.6-b`·`docs/generated/inventory.md` | 계약 문서 | 채널 행 교체, checkout 결과·요약 필드 갱신. inventory는 스크립트로 재생성 | `--check` |

### 캐시 상한 (단위: 문자 수)

| 캐시 | 키 | 상한 |
|---|---|---|
| 패치 | `[commonDir, 'patch', baseOid, targetOid]` | 32,000,000자 |
| 요약 diff·history·commit parent·bornAt 기준 | `[commonDir, kind, ...oid]` (bornAt은 `[commonDir, 'born', bornAt, headOid]`) | 합계 8,000,000자 |

### 테스트 가능성

- electron 비의존: `infra/git` 전체가 node 전용이다. 새 모듈도 electron을 import하지 않는다.
- 기존 메커니즘 재사용: `withRepoMutation`은 형상 그대로 `gateway.mutate`가 감싼다. `temp-repo.testfixture.ts` 정리 규약을 새 실저장소 테스트에도 쓴다.
- 순서 관측: 지연 가능한 가짜 run(Promise 수동 해제)으로 in-flight 수와 공유 여부를 관측한다.

## 12. End-to-end 영향

### producer → consumer

```text
gateway/probe → gitSnapshot → IPC GitSnapshotResult → useGitSnapshot → chatStore(setGitStatus, receiveGitSnapshotSummary) → GitRow·변경사항 타일
```

- producer 기준: `status`는 요청 시점 probe, `summary`는 같은 probe의 HEAD 기준이다. 두 값이 한 시점을 본다. AS-IS는 두 IPC 사이에 커밋이 끼면 서로 다른 HEAD를 볼 수 있었다.
- consumer 파생 규칙: 기존 reducer 액션을 그대로 쓴다. 새 합성값은 없다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `registerGitHandlers` (`bootstrap.ts:987`) | 등록 채널 5 → 4 | AC19 |
| `repairMovedWorktrees` 부팅 호출 | 주입 형태만 변경 | AC21 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 관문 싱글턴은 모듈 로드 시 만든다. 실행 파일 해석은 첫 실행 때 한다.
- 취소/중단: `signal`은 `worktree add`만 쓴다(mutate). in-flight 공유 대상인 읽기는 signal을 받지 않는다. 받게 되면 한 호출자의 취소가 다른 호출자에게 번진다.
- retry/timeout/partial failure: 타임아웃·aborted·실패 결과는 캐시하지 않는다(EP-03).
- cleanup/rollback: prepare 롤백 순서는 불변이다.
- **다중 저장소 쓰기**: 해당 없음. 캐시는 메모리 한 곳이고 git 쓰기는 기존과 같은 단일 명령이다. 문서 산출물은 `plan.md`와 `INDEX.md` 행 두 곳이며, 이 설계 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

| 요청 | AS-IS | TO-BE |
|---|---:|---:|
| 턴 종료, 새 커밋 없음 (타일 닫힘) | 7 | 1 |
| 턴 종료, 새 커밋 있음 | 7 | 3 |
| 타일 열림 추가분 | +1 | +1(probe, 캐시 적중) |
| 초기 상태 (origin 캐시 적중) | 4 | 1 |
| checkout clean | 9 | 4 |
| checkout dirty·해소 없음 | 4 | 2 |
| 새 세션 passthrough | 2 | 1 |
| worktree 준비(baseRef 없음) | 6 | 4 |
| 비저장소 디렉토리 턴 종료 | 2(status 1 + 요약 1) | 2 |

- 메모리 worst-case: 패치 32M자 + 기타 8M자 ≈ UTF-16 기준 80MB 상한. 패치 1건 상한은 기존 `PATCH_MAX_BUFFER` 16MB다.
- 동시 실행 worst-case: 읽기 4 + 쓰기(저장소당 직렬) 저장소 수.
- 잃는 부수 효과: ① textconv 표시(D-014) ② 캐시된 diff는 이후 `.gitattributes` 변경을 반영하지 않는다 — 같은 OID 쌍인 동안만이고 새 커밋이 생기면 새로 계산한다 ③ 외부에서 일어난 커밋과 동시에 진행 중인 읽기는 커밋 전 결과를 공유할 수 있다(지금의 동시 호출과 같은 수준) ④ 전역 config의 `url.*.insteadOf` 변경은 저장소 config 내용이 바뀔 때까지 origin URL에 반영되지 않는다. 이 컨테이너에서 전역 insteadOf가 `remote get-url` 출력을 바꾸는 것을 실측했다. 영향은 링크 표시뿐이다.

## 15. 외부 구현 포트 / 문서 계약

- 외부 구현자가 구현하는 포트는 없다. IPC 소비자는 이 저장소의 renderer뿐이다.
- 구현 문서: `docs/IPC_CONTRACT.md §2.6-b`. shape는 typecheck, semantics는 `ipc-documentation.test`와 AC16~AC19로 대조한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 좌표만 캐시, 파일 내용은 캐시하지 않는다 (0211 D-063) | `git-diff.ts:188` | §9 캐시 행 | 유지. 좌표 캐시조차 없애고, 캐시되는 결과는 OID로 불변이다 |
| 읽기는 저장소를 잠그지 않는다 (0211 D-064), AT-39 차집합 | `git-diff.ts:41-44` | EP-01 | 유지. 부착 자리를 관문으로 옮기고 차집합 oracle을 관문 전체로 넓힌다 |
| 커밋된 것만 본다 (0211 D-111) | `git-diff.ts:143-156` | §11 git-diff 행 | 유지 |
| `uncommitted` 형태만 남김 (0211 I-06) | `git-diff.ts:283-287` | D-012 | 변경 — 계약 변경 허용(D-002)으로 삭제 |
| 상태 응답에 변경량 축이 없다 (0211 D-027) | `IPC_CONTRACT.md:202` | §10 새 타입 | 유지 |
| 브랜치 이름 검사 2중(스키마 + 실행부) | `git-cli.ts:118-125` | §11 git-cli 행 | 유지 |
| 격리 준비는 dirty를 거부하지 않는다 (0210 D-105) | `IPC_CONTRACT.md:41` | §11 service 행 | 유지 |
| 원격 요청 Chromium 단일 스택 | `app/src/main/AGENTS.md` | — | 무관(네트워크 호출 없음) |
| 레이어 DAG | `app/src/main/AGENTS.md` | §11 전체 | 유지. 신규 모듈은 전부 `infra/git` |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| probe 한 호출의 출력 순서 가정 | 7케이스 실저장소 테스트(VP-14). 실패 시 좌표 재질의 폴백 |
| 오래된 git이 인자 조합을 거부 | 거부는 실패로 나타나고 폴백 경로(좌표 4개 + symbolic-ref)가 받는다 |
| PATH 절대 항목 제한으로 git을 못 찾는 환경 | 상대 PATH 항목에만 git이 있는 환경은 지금 cwd에 따라 다른 git을 실행하는 상태라 안전하지 않다. 못 찾으면 `unavailable`로 드러난다 |
| textconv 표시 변경 | D-014, 사용자 확인 권장 |

- 되돌리기 어려운 결정: IPC 채널 이름 `orca:git:snapshot`(D-010).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/infra/git/{git-executable,gateway,immutable-cache,probe,origin-url,git-snapshot}.ts` (신규) + 각 테스트
- `app/src/main/infra/git/{runner,git-diff,git-cli,repository,worktree}.ts`
- `app/src/main/features/worktrees/service.ts`, `app/src/main/app/chat-turn/prepare-worktree.ts`, `app/src/main/app/legacy-paths.ts`, `app/src/main/app/handlers/git.ts`
- `app/src/shared/{ipc,protocol}.ts`, `app/src/preload/index.ts`, `app/src/renderer/src/shared/api/ipc.ts`
- `app/src/renderer/src/features/chat/components/composer/{useGitSnapshot,BranchChip,branchChipState,useGitIdentityRemote}.ts(x)`
- `app/eslint.config.mjs`
- `docs/IPC_CONTRACT.md`, `docs/generated/inventory.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`, `app/src/main/AGENTS.md §두 가지 강제 규칙`.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-A 운영 gate의 vitest 명령. 실저장소 스위트는 `temp-repo.testfixture.ts` 정리 규약을 따른다.
- 문서: `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: 없음.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001~D-004가 사용자 턴 1~3.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §1·§5.
- [x] 조건절·이유절을 재해석하지 않았다 — §2 원문 인용.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 상태 표 5행 ↔ AC16·AC1·AC15·AC7·AC12.
- [x] AS-IS와 TO-BE가 같은 축으로 있다 — §9.
- [x] Delta 각 행이 파일·AC로 이어진다 — §9 Delta 마지막 열.
- [x] 사라진 책임을 명시했다 — §9 "사라지는 책임".
- [x] 수치·전칭·앵커·기존 테스트를 실측했다 — §8.
- [x] 각 AC가 행동 단언·검증·도달 경로를 가진다 — §7.
- [x] Baseline V — §7-A.
- [x] NEW node마다 REQUIRED pair가 있다 — VP-01~VP-19.
- [x] INHERITED node 없음 — Baseline.
- [x] pair의 경로·강제 지점·oracle이 있고, 적대 증거는 필요한 pair에만 선택했다 — VP-02·03·05·06·09.
- [x] 운영 gate를 열거했다 — §7-A.
- [x] 사람 실기로 미룬 순수 로직이 없다.
- [x] structural proxy만으로 검증하는 AC가 없다 — 실행 수는 정확 일치, 안전성은 마커 부재로 단언한다.
- [x] 신규 계약의 SSOT·강제 지점·seam — §10·§11.
- [x] 부팅/등록 변경의 소비처 — §12.
- [x] producer/consumer 의미 — §12.
- [x] 상한·총량·one-way door — §14·§17.
- [x] 게이트 명령이 `app/AGENTS.md`와 충돌하지 않는다 — §19.
- [x] Ledger ↔ AC 대조를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.
