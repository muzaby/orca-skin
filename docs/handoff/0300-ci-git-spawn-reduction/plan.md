# Plan — 0300-ci-git-spawn-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0300-ci-git-spawn-reduction` |
| 작성자 | Claude Code |
| 일자 | 2026-11-09 |
| 매핑 | 비기능(테스트 인프라 + production git 실행 경로) — Claude 설계·구현 |
| 상태 | impl/IN_PROGRESS — D-014·D-017 OPEN은 구현 범위 밖(§6) |
| V mode | `Delta V` — Baseline V1 상속 |
| 기준 V | 본문 Baseline `V1` (V1 설계 — 검증자 기입) |
| 이번 V revision | `ΔV3` |
| 유효 V | `V1 + ΔV1 + ΔV2 + ΔV3` |

# Part I — Product & UX Contract

## 1. Context / 목표

- **문제**: 폐쇄망 self-hosted 러너(Windows · HDD · 4코어)에서 CI job 1281초 중 `npm test`가 584초다. vitest 528.21초는 io 테스트가 누적의 94.9%이고, io 시간의 몸통은 git 1회 실행 단가다 — 병목 4파일이 이 컨테이너에서 0.44~0.72초(git 121~186회)인데 러너에서 420~518초다(§8 F-01).
- **완료 후**: git 1회가 Windows에서 프로세스 1개로 뜨고(런처 생략, 앱·테스트 공통), 테스트가 띄우는 git 수가 줄며, 테스트가 저장소를 손으로 세우는 경로가 가드로 막힌다. 테스트 파일·케이스 수와 결과(실패 0)는 그대로다.
- **한 문장**: 같은 테스트를 같은 결과로 돌리면서 io 테스트의 git 실행 수와 git 1회의 프로세스 수를 함께 줄인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Ci 테스트가 여전히 길다. 다음 폐쇄망 환경에서의 평가를 확인하고 어떻게 극복할지 제안하라. 제안울 만들기 위해 필요한 것이 있다면 요구하라." | 1턴 |
| 명시 요구 | "Plan 작성 하지마라. 작성전에 먼저 요약 보고하라. 합의 된 내용을 바탕으로 작성할것" | 1턴 중간 |
| 명시 답 | "1. C:/program files/git/cmd/git.exe 2. 4core 3. 유사한 테스트에서 Git 호출을 최대한 줄이는 방향으로 제안하라 4. 고려하지말것" | 3턴 |
| 명시 질문 | "Git 관련 인프라는 최적화될 여지가 없는가?" | 5턴 |
| 명시 결정 | "모두 수용한다. Plan 작성할 것" | 6턴 |
| 추론 의도 | "모두 수용"의 대상 = 4턴 보고의 결정 4건(반복 변형 축소 · 공유 픽스처 대가 · PATH 위치 · production 호출 축소)과 5턴 보고의 결정 3건(실행 파일 해석 · 직접 호출 금지 가드 · 작은 production 축소) | 6턴이 5턴 보고 직후이고 4턴 결정은 그때까지 미답 |
| 추론 의도 | 3턴 답 4 "고려하지말것" = 템플릿 폴더 복사안 제외 | 4턴 보고에 "폴더 복사안 제외로 이해했다"고 적었고 6턴까지 이견 없음 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 목표는 self-hosted CI 테스트 시간 단축이고 수단은 git 실행 수·git 1회 프로세스 수 축소다 | "유사한 테스트에서 Git 호출을 최대한 줄이는 방향" | 1·3·6턴 | ACTIVE | — |
| D-002 | 러너 사실: git = `C:/Program Files/Git/cmd/git.exe`, CPU 4코어 | 사용자 답 | 3턴 답 1·2 | ACTIVE | — |
| D-003 | 템플릿 폴더 복사(fs 복사)로 저장소를 만들지 않는다 | "4. 고려하지말것" | 3턴 · 4턴 해석 | ACTIVE | — |
| D-004 | 파일 내부 동시 실행·파일 분할·배정 순서 조정은 하지 않는다 | 3턴 답 3 + 4코어(8논리, 워커 7)에서 누적÷7 = 506.8 ≈ 최장 518.2 → 이득 ≤ 약 21초 | 3·4턴 | ACTIVE | — |
| D-005 | production git 실행 파일 해석: PATH가 Git for Windows 런처(`<top>\cmd\git.exe`·`<top>\bin\git.exe`)를 가리키고 `<top>\<msys>\bin\git.exe`가 있으면 그 실제 실행 파일을 띄운다. 앱·테스트 공통 | 런처가 실제 git을 자식으로 띄워 git 1회 = 프로세스 2개 | 5턴 제안 1 · 6턴 | ACTIVE | 4턴 "CI PATH 변경"(A)을 대체 — 5턴 보고 "이게 들어가면 CI PATH 변경은 필요 없다" |
| D-006 | 런처가 하던 환경 설정을 Orca가 같은 규칙으로 넣고, 훅 실행 환경이 같은지 검증한다 | "훅 실행 환경이 같은지 검증하는 항목이 함께 들어갑니다" | 5턴 결정 1 · 6턴 | ACTIVE | — |
| D-007 | 테스트 저장소는 공용 빌더 하나로 만든다 — `init` + `fast-import` + `reset --hard` 최대 3회, 커밋 해시는 marks 파일 | 저장소 생성 헬퍼가 파일마다 따로 있다(§8 F-05) | 4턴 B-1 · 5턴 2 · 6턴 | ACTIVE | — |
| D-008 | 테스트가 저장소 구성 명령(`init`·`add`·`commit`·`fast-import`)을 빌더 밖에서 직접 부르면 red다 | "공용 빌더에 직접 호출 금지 가드까지 둘지" | 5턴 결정 2 · 6턴 | ACTIVE | — |
| D-009 | 저장소를 바꾸지 않는 케이스는 저장소 하나를 공유한다. 회귀가 공유 저장소를 망가뜨리면 뒤 케이스도 red가 되는 대가를 받아들인다 | "결함 검출은 같지만 원인 케이스를 바로 짚기 어려워진다" | 4턴 결정 2 · 6턴 | ACTIVE | — |
| D-010 | 같은 시점의 검증 읽기를 한 번으로 합친다 — `status --porcelain`+`rev-parse --abbrev-ref HEAD` → `status --porcelain -b`, 같은 상태를 두 번 읽지 않는다 | 4턴 B-3 | 4턴 · 6턴 | ACTIVE | — |
| D-011 | 순수 함수 테스트가 덮는 입력 형태를 실제 git으로 반복하지 않는다 — 통합 테스트는 통합 성질만 남긴다 | "입력 형태 검증은 순수 함수 테스트가 계속 맡습니다" | 4턴 결정 1 · 6턴 | ACTIVE | — |
| D-012 | 격리 전역 git 설정에 `init.templateDir =`(빈 값)·`core.fsync = none`을 더한다. 기존 4키는 그대로 | init 1회 파일 18 → 2 · HDD fsync 대기 | 5턴 3 · 6턴 | ACTIVE | 0298 D-003 내용 확장 |
| D-013 | worktree 브랜치 이름 선택은 브랜치 목록 1회 + 고른 후보의 형식 검사 1회로 한다(후보마다 2회 순차 → 이름 충돌 수와 무관하게 2회) | 5턴 표 "브랜치 목록 1회 + 형식 검사 1회로. 이름이 겹칠 때만 이득" | 5턴 결정 3 · 6턴 | ACTIVE | — |
| D-014 | checkout 끝 재조회 축소 — 수용됐으나 조사 결과 전제가 틀렸다(§4). 행동을 바꾸지 않고 줄일 방법이 없어 철회를 제안한다 | 사용자 확인 전까지 구현하지 않는다 | 5턴 결정 3 · 6턴 / 설계자 정정 | OPEN | — |
| D-015 | hostile 대표 테스트의 git 항목을 `repository.test.ts` → `hermetic-config.test.ts`로 바꾼다 | 빌더 커밋은 서명하지 않아 대표가 호스트 서명 설정을 더는 밟지 않는다. 실제 `git commit`이 남는 파일로 0294 검출을 유지한다(§4) | D-007 파생 · 0294 AC | ACTIVE | — |
| D-016 | 0294 시간 예산·호스트 격리와 0298 풀 분류·unit 가드, git 픽스처 규칙(`execGit` 추적·`removeTempRoots`·`FIXTURE_GIT_TIMEOUT_MS`)을 유지한다 | 상속 | 0294 D-001·D-009 · 0298 D-001·D-007 | ACTIVE | — |
| D-017 | setup-node 캐시 저장(158초)·lint(198초)·러너 환경(백신 예외·TEMP 이동)을 이번 범위에 넣을지 | 4턴에 "함께 다룰지"로 물었고 명시 답이 없다 | 4턴 | OPEN | — |

| D-018 | 기존 테스트 케이스를 전부 보존하고, 추가 검증 케이스는 파일 위치와 관계없이 허용한다 | AC13의 신규 파일 한정과 §11의 기존 파일 신규 케이스 요구를 조정 | 2026-11-09 구현 세션 사용자 답: "기존 케이스 보존 + 추가 검증 허용 (권장)" | ACTIVE | V1 AC13 → ΔV1 AC13 |

### 갱신 메모

- ΔV1: D-018 ↔ AC13 정정(아래 §7-B). 나머지 ACTIVE 결정·AC·§10은 유지하며 충돌 0.
- 새 결정: D-001~D-017(최초 설계). 대체: 4턴 CI PATH 변경(A) → D-005.
- `ACTIVE 결정 ↔ AC` 대조: D-001 ↔ AC12·AC18 · D-002 ↔ AC1(런처 경로) · D-003 ↔ AC5(빌더에 fs 복사 없음) · D-004 ↔ 비범위 · D-005 ↔ AC1·AC4 · D-006 ↔ AC2·AC3 · D-007 ↔ AC5·AC6 · D-008 ↔ AC7·AC8 · D-009 ↔ AC9 · D-010 ↔ AC10 · D-011 ↔ AC11 · D-012 ↔ AC14 · D-013 ↔ AC15 · D-015 ↔ AC16 · D-016 ↔ AC13·AC17 — 충돌 0.
- OPEN D-014·D-017은 AC가 없다 — 구현 범위 밖(§6).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 | GitHub windows-latest 대비 io 누적 25.5배·unit 1.9배 — spawn 위주만 느리다(§8 F-02) |
| 이미 충족됐는가 | 아니오 | production 진입점 `runner.ts:27`이 PATH 첫 `git.exe`(러너는 런처)를 그대로 쓴다 · 테스트 측 저장소 구성 호출 344회(§8) |
| 더 작은 해법 | 런처 생략(D-005) 하나가 모든 git 호출의 프로세스를 절반으로 한다 — 코드 1곳 | `rg "gitExecutable\(" app/src/main` → 정의 외 호출 1곳(`runner.ts:27`) |
| D-014 전제 | **틀렸다** — checkout 전에는 `remote get-url`을 읽지 않아 재사용할 값이 없고(`git-cli.ts:35-88`: probe → `diff --shortstat` → checkout → probe → `buildStatus`), 끝의 probe는 tag 같은 이름을 checkout해 detached가 된 경우를 반영한다 | 행동 변경 없이 줄일 호출 0 — 철회 제안(D-014) |
| D-013 효과 | 이름 충돌이 없으면 2회 → 2회(같음), 충돌 k개면 2k → 2회 | 5턴에 그대로 보고한 효과 |
| hostile 대표 | `test-environment.hostile.test.ts:27`의 대표 `repository.test.ts`는 실제 `git commit`이 호스트 서명 설정(`commit.gpgsign` · 없는 `gpg.program`)에 걸리는지로 격리를 본다. 빌더(`fast-import`)는 서명하지 않으므로 옮기면 그 검출이 사라진다 | D-015 — 실제 commit이 남는 `hermetic-config.test.ts`(가드 허용 목록)로 교체 |
| 기존 결정 충돌 | 0298 D-003(격리 설정 내용)을 확장만 한다. 0294 D-009(git 인프라 유지)는 빌더가 같은 추적·정리 규칙을 지나 유지된다 | §16 |

- 사용자에게 올릴 결정: D-014 철회 확인 · D-017 범위.
- 코드 조사·실측으로 닫은 사실: 런처 동작(Git for Windows 소스 F-03), production git 진입점 1곳(F-04), 테스트 측 호출 분포(§8), fast-import 동치(F-14).

## 5. 동작 / 흐름

```text
git 1회 (Windows)
AS-IS  runGit → execFile(C:\…\Git\cmd\git.exe) ─► [런처: env 설정] ─► mingw64\bin\git.exe   = 프로세스 2개
TO-BE  runGit → execFile(C:\…\Git\mingw64\bin\git.exe, env=런처 규칙)                       = 프로세스 1개

테스트 저장소
AS-IS  test → git init → (add → commit → rev-parse)×N → branch/checkout …      = 1 + 3N + α 회
TO-BE  test → createRepo(spec) → init · fast-import(+marks) · reset --hard        = 1~3 회
       test 가 init/add/commit/fast-import 를 직접 띄우면 → io 가드 기록 → 그 테스트 red
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/개발자에게 보이는 결과 |
|---|---|---|
| Windows · PATH가 Git for Windows 런처 | 실제 실행 파일 + 런처 규칙 env로 실행 | git 결과·훅 동작 동일, 프로세스 절반 |
| Windows · PATH가 실제 `git.exe`이거나 다른 배치 | 찾은 파일 그대로(지금과 같음) | 변화 없음 |
| 비-Windows | 찾은 파일 그대로 | 변화 없음 |
| 테스트가 저장소 구성 명령을 직접 띄움 | io 가드가 위반 기록 | `[test-git] …` 메시지와 함께 그 테스트 red |
| 허용 목록 파일의 구성 명령 수가 목록 `count`와 다름 | io 가드 파일 끝 검사 | 그 파일 red |
| 빌더의 `fast-import` 실패 | 빌더가 stderr와 함께 throw | 그 케이스 red(픽스처 실패) |

### 파생 UX / 엣지케이스

- 사용자 저장소 훅(sh 스크립트)은 런처 경유와 같은 PATH·`MSYSTEM`·`HOME`에서 돈다 — AC3가 Windows에서 잠근다.
- 빌더 커밋은 서명·훅·clean 필터를 거치지 않는다. 그 자체가 시험 대상인 케이스는 허용 목록으로 실제 명령을 쓴다(§10 EP-04).

## 6. 범위 / 비범위

- **범위**: D-005·D-006(실행 파일 해석) · D-007·D-008(빌더·가드) · D-009~D-011(공유·읽기 합치기·반복 변형) · D-012(격리 설정) · D-013(브랜치 이름) · D-015(hostile 대표).
- **비범위**: D-014(OPEN — 철회 제안) · D-017(OPEN — 캐시·lint·러너 환경) · D-004(동시 실행·분할·순서) · production 동작별 호출 수 변경(상태 2회·요약 4회는 설계 결정으로 유지 — §8 F-07) · git 내부 자식 프로세스(`worktree add`의 3개).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| D-014 checkout 재조회 | 아니오 | 사용자 확인 — 철회면 닫힘 |
| D-017 캐시·lint·러너 환경 | 아니오 | 사용자 결정 시 별도 handoff |
| 후보 형식 검사 생략(`slugOf` 출력은 `[a-z0-9-]`라 항상 유효) | 아니오 | 합의 밖 — 제안만(§17) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | win32에서 PATH의 첫 `git.exe`가 `<top>\cmd\git.exe` 또는 `<top>\bin\git.exe`이고 `<top>\<msys>\bin\git.exe`가 있으면(`msys` = `mingw64`·`clangarm64`·`ucrt64`·`mingw32` 순) runGit은 그 실제 파일을 띄운다. 그 밖(비-win32 · 런처 위치가 아님 · 실제 파일 없음 · PATH에 git 없음)은 지금과 같다 | UT `git-executable.test.ts` — §10 EP-02 규칙 칸 분기마다 입력 | `runGit` → `gitExecutable` → `execFile` |
| R-01 | AT-01 / AC2 | 직접 실행할 때 자식 env = 런처 규칙(§10 EP-02 표): `MSYSTEM` 항상 · `PLINK_PROTOCOL` 없으면 `ssh` · `HOME` 없으면 `HOMEDRIVE+HOMEPATH`(디렉토리이고 시스템 디렉토리 아님) 아니면 `USERPROFILE` · PATH 앞 `<top>\<msys>\bin;<top>\usr\bin;<HOME>\bin;` · `<top>\etc\git-bash.config`의 `MSYS=`. env는 호출 시점의 `process.env`에서 만들고 기존 PATH 키 이름(대소문자)을 보존한다 | UT — 분기마다 입력 | `runGit` env |
| R-01 | AT-01 / AC3 | Windows에서 같은 셸 alias를 런처 경유(`<top>\cmd\git.exe`)와 production `runGit`으로 실행하면 sh가 본 `MSYSTEM`·`HOME`·`PLINK_PROTOCOL`·PATH·`command -v sh`가 같고, 사용자 저장소의 `pre-commit` 훅이 production `gitCheckout(commit-wip)`에서 실행된다 | IT `git-launch.win32.test.ts`(win32 전용, 그 밖은 skip 사유) · Windows CI | `runGit` → 실제 git → sh |
| R-01 | AT-01 / AC4 | 테스트 측 git 실행(`execGit('git', …)`·빌더)도 AC1·AC2와 같은 해석을 쓴다 — 이름 `'git'`이 해석된 파일·env로 바뀐다 | IT `io-git-guard.test.ts` — 가드 관측 spawn 파일 = `gitExecutable()` 결과 | 픽스처 → `execFile` |
| R-02 | AT-02 / AC5 | `createRepo(roots, spec)`는 커밋 0개면 1회(init), 파일 없는 커밋만이면 2회, 그 밖 3회로 저장소를 만들고 각 커밋 OID를 marks에서 돌려준다. 같은 명세를 porcelain(`add`·`commit`)으로 만든 저장소와 커밋 OID·브랜치·HEAD·`status --porcelain`이 같다(날짜·메시지·삭제·바이너리·한글/공백 경로·브랜치·detached 포함) | IT `temp-repo.test.ts` 동치 · UT `fast-import-stream.test.ts` | 테스트 → 빌더 → git |
| R-02 | AT-02 / AC6 | `appendCommit(repo, commit, opts)`는 체크아웃된 브랜치에 커밋 하나를 더하고 OID를 돌려준다 — 파일이 있으면 2회(fast-import · reset --hard), 없으면 1회 | IT `temp-repo.test.ts` | 테스트 → 빌더 |
| R-02 | AT-02 / AC7 | io 테스트에서 테스트 측 `init`·`add`·`commit`·`fast-import`가 빌더 밖에서 뜨면 그 테스트가 red다. 허용 목록(`{file, subcommand, count, reason}`)의 파일은 관측 수가 `count`와 같아야 하고 다르면 그 파일이 red다 | UT `test-pools.test.mjs` 판정 분기 · IT `io-git-guard.test.ts` 배선 | io setup → spawn 감시 |
| R-02 | AT-02 / AC8 | io 테스트에서 테스트 측 git을 이름(`'git'`)으로 띄우면 red다 | 같은 UT·IT | 같은 경로 |
| R-02 | AT-02 / AC9 | git-cli의 AC4 케이스 1개 + AC7 이름 거부 6케이스가 저장소 하나를 공유하고, 그 저장소를 세우는 git은 3회 이하다. 각 케이스의 단언(트리·브랜치 불변, `reason`)은 그대로다 | 집계(§19 census `--max-file`) + 등록 변이 M-05·M-06 | `gitCheckout` |
| R-02 | AT-02 / AC10 | §10 EP-06의 검증 읽기 3자리가 각각 한 번의 git 읽기로 같은 단언을 한다 | 등록 변이 M-07·M-08 · 코드 diff | 테스트 검증 |
| R-02 | AT-02 / AC11 | git-cli URL 케이스가 통합 성질 4가지 — origin 없음 → null · 추가가 다음 조회에 보인다 · worktree에서 같은 값 · 변경·삭제가 다음 조회에 보인다 — 를 유지하고 URL 형식 변형은 `github-url.test.ts`에만 있다 | 등록 변이 M-09·M-10 | `gitSnapshot` → `buildStatus` |
| R-02 | AT-02 / AC12 | 리눅스 집계(§19)에서 io 전체 git 1002 → 840 이하, 테스트 측 538 → 380 이하, 파일별 git-cli 186 → 135 · git-consistency 131 → 85 · git-diff 144 → 115 · worktrees/service 121 → 115 이하 | `gate: node evidence/git-spawn-census.mjs <dir> --max-…` (기준선에서 red 관측) | io 전체 |
| R-02 | AT-02 / AC13 (V1, ΔV1로 대체) | vitest `Test Files`·`Tests`의 통과·건너뜀 수가 변경 전과 같고(새 테스트 파일분만 증가) 실패 0. 기존 케이스의 `expect` 변경은 EP-05·EP-06·EP-07 자리에만 있다 | 전후 gate 비교 · `git diff` | `npm test` |
| R-03 | AT-03 / AC14 | 격리 설정에 `init.templateDir =`·`core.fsync = none`이 있고 기존 4키(신원 2·autocrlf·maintenance.auto)가 남는다. 새 저장소 `git init`이 `.git` 아래 파일 2개만 만들고 경고가 없다 | `test-environment.test.ts`(내용 일치) · `hermetic-config.test.ts`(동작) | vitest-setup → `GIT_CONFIG_GLOBAL` |
| R-04 | AT-04 / AC15 | `chooseBranchName`은 이름 충돌 수와 무관하게 git을 2회(브랜치 목록 1 · 고른 후보 형식 검사 1) 부르고 고르는 이름은 지금과 같다 — 충돌 0·1·k, 디렉토리 잔여물, 형식 거부, 목록 실패 분기 | UT `naming.test.ts` — 호출 수 단언 포함 | `WorktreeService.prepare` |
| R-05 | AT-05 / AC16 | hostile 대표 교체 뒤에도 격리를 끄면 hostile 테스트가 red다 | 등록 변이 M-11 | 대표 vitest 중첩 실행 |
| R-05 | AT-05 / AC17 | 0294 예산 가드·0298 풀 분류·unit 가드가 green이고 새 픽스처 파일이 예산 규칙 (F)·(G)·(H′)를 지난다 | `check-test-budgets.mjs` · `test-pools.test.mjs` | gate |
| R-01·02 | AT-06 / AC18 | 같은 커밋 기준 self-hosted 러너 Test 단계 시간이 기준 584초보다 짧다(전후 각 2회 기록) | 사람 실기 | self-hosted job |

### AC 검증 주의사항

- 사람 실기는 AC18(실제 폐쇄망 러너)뿐이다. AC3은 Windows CI(`ci.yml` windows-latest)가 기계로 닫는다.
- AC12는 리눅스 집계다 — Windows 전용 분기가 호출 수를 바꾸는지는 확인하지 않았다(§10 선언 경계).
- AC9~AC11은 테스트를 고치는 AC라 "같은 결함을 여전히 잡는가"를 등록 변이로 본다 — 호출 수만 보면 약해진 테스트도 통과한다.

## 7-A. V / Trace Matrix

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01 / AT-01 | R/AT | git 1회 = 프로세스 1개, 결과·훅 동일 · AC1~AC4 | NEW | — |
| R-02 / AT-02 | R/AT | 테스트 측 git 축소 · AC5~AC13 | NEW | — |
| R-03 / AT-03 | R/AT | 격리 설정 확장 · AC14 | NEW | — |
| R-04 / AT-04 | R/AT | 브랜치 이름 선택 호출 수 · AC15 | NEW | — |
| R-05 / AT-05 | R/AT | 0294·0298 계약 유지 · AC16·AC17 | INHERITED | 0294 hostile AC · 0298 AC2·AC3 |
| R-06 / AT-06 | R/AT | 러너 시간 · AC18 | NEW | — |
| SD-01 / ST-01 | SD/ST | git 실행 경로 해석 → env → spawn → 훅(§9) | NEW | — |
| AR-01 / IT-01 | AR/IT | 해석 하나를 production `runGit`과 픽스처 `execGit`이 공유 | NEW | — |
| AR-02 / IT-02 | AR/IT | 빌더 → 테스트 18파일 → io 가드 | NEW | — |
| MD-01 / UT-01 | MD/UT | `resolveGitCommand` 경로·env 규칙 | NEW | — |
| MD-02 / UT-02 | MD/UT | fast-import 스트림 조립·marks 해석 | NEW | — |
| MD-03 / UT-03 | MD/UT | io 가드 판정 `judgeGitSpawn` | NEW | — |
| MD-04 / UT-04 | MD/UT | `chooseBranchName` | CHANGED | `naming.test.ts` 2케이스 |
| MD-05 / UT-05 | MD/UT | `HERMETIC_GIT_CONFIG` | CHANGED | 0298 D-003 · `test-environment.test.ts:60` |
| MD-06 / UT-06 | MD/UT | git-cli 공유·읽기 합치기·URL 케이스(EP-05~07) | CHANGED | `git-cli.test.ts` |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `runGit` → 해석 → `execFile` → git | AC1·AC2 → VP-06 좌표 · AC3 → `git-launch.win32.test.ts` · AC4 → `io-git-guard.test.ts:'픽스처 git 은 해석된 실행 파일로 뜬다'` | — (하위 pair가 짐) | EP-01·EP-02 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | io 테스트 → 빌더/테스트 git → spawn | AC12 → `gate: node evidence/git-spawn-census.mjs <trace> --max-total 840 --max-test-side 380 --max-file …`(기준선 red 관측) · AC13 → 전후 gate | — | EP-03~EP-07 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | vitest-setup → 전역 설정 파일 → git init | `test-environment.test.ts:'XDG 4종은 루트 아래, git 은 고정 전역 설정…'` · `hermetic-config.test.ts:'새 저장소가 … 템플릿 파일 없이'`(신규 단언) | — | EP-08 |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `prepare` → `chooseBranchName` → gateway | `naming.test.ts` 신규 5케이스(EP-09 분기) | — | EP-09 |
| VP-05 | R-05 ↔ AT-05 | REGRESSION | hostile 중첩 vitest · 예산·풀 가드 | `test-environment.hostile.test.ts` · `check-test-budgets.mjs` · `test-pools.test.mjs` | **required** — M-11(대표가 격리를 실제로 밟는가) | EP-10 |
| VP-06 | MD-01 ↔ UT-01 | REQUIRED | `resolveGitCommand(input)` | `git-executable.test.ts` — EP-02 규칙 칸 분기 입력 전부 | — | EP-02 |
| VP-07 | MD-02 ↔ UT-02 | REQUIRED | 명세 → 스트림 · marks → OID | `fast-import-stream.test.ts` — EP-04 스트림 규칙 칸 | — | EP-04 |
| VP-08 | MD-03 ↔ UT-03 | REQUIRED | spawn 관측 → 판정 | `scripts/test-pools.test.mjs` — EP-03 판정 표 칸마다 입력 | **required** — M-03(빌더 프레임 판정 제거)·M-04(production 프레임 판정 제거) | EP-03 |
| VP-09 | AR-01 ↔ IT-01 | REQUIRED | `runGit`·`execGit` → 같은 해석 | `io-git-guard.test.ts` · `runner.test.ts`(주입 `execFileImpl`이 받은 파일·env) | **required** — M-01(`execGit`이 해석을 건너뜀) | EP-01 |
| VP-10 | AR-02 ↔ IT-02 | REQUIRED | 테스트 → 빌더 → git · 직접 호출 → 가드 → red | `temp-repo.test.ts`(동치) · `io-git-guard.test.ts`(직접 `runGit(dir,['init'])` 위반 기록 · 빌더 통과 · production 경로 통과 · 이름 `'git'` 위반) | **required** — M-02(io 프로젝트에서 가드 setup 제거) | EP-03·EP-04 |
| VP-11 | SD-01 ↔ ST-01 | REQUIRED | `runGit` → 실제 git → sh(alias·훅) | `git-launch.win32.test.ts` 2케이스(Windows CI) | — | EP-02 |
| VP-12 | MD-06 ↔ UT-06 | REQUIRED | git-cli 케이스 → `gitCheckout`·`gitSnapshot` | `git-cli.test.ts` 해당 케이스 | **required** — M-05~M-10(고친 케이스가 같은 결함을 잡는가) | EP-05~EP-07 |
| VP-13 | R-06 ↔ AT-06 | REQUIRED | self-hosted job → `npm test` | 사람 실기 — 같은 커밋 전후 Test 단계 시간 각 2회(AC18). 기계 oracle 없음: 실제 폐쇄망 러너는 이 저장소의 CI가 닿지 않는다 | — | 0 — 러너 측정만 |

### 등록 변이 (선택적 적대 증거)

| ID | 심을 자리 | 바꾸는 것 | 기대 |
|---|---|---|---|
| M-01 | `temp-repo.testfixture.ts` `execGit` | `'git'`을 해석하지 않고 그대로 실행 | `io-git-guard.test.ts` red(AC4·AC8) |
| M-02 | `scripts/test-pools.mjs` `buildProjects` io 프로젝트 | io 가드 setup 파일 제거 | `io-git-guard.test.ts` red |
| M-03 | `judgeGitSpawn` 빌더 프레임 판정 | 빌더 예외 제거 | `test-pools.test.mjs` red + 빌더 쓰는 io 테스트 red |
| M-04 | `judgeGitSpawn` production 프레임 판정 | production 예외 제거 | `test-pools.test.mjs` red + `git-cli.test.ts` commit-wip 케이스 red |
| M-05 | `git-cli.ts` `gitCheckout` | 이름 검사를 `resolveDirty` 뒤로 이동 | AC7 공유 케이스 red |
| M-06 | `git-cli.ts` `gitCheckout` | `dirty && resolution === undefined` 분기 제거 | AC4 케이스 red |
| M-07 | `git-cli.ts` `resolveDirty` stash | `stash push` → `stash push -u` | AC5 stash 케이스 red(합친 읽기가 미추적 파일을 본다) |
| M-08 | `git-cli.ts` `gitCheckout` 거부 경로 | 거부 전에 `checkout -- .` 실행 | AC4·AC7 red(합친 `status -b` 읽기가 트리 변화를 본다) |
| M-09 | `git-snapshot.ts` `buildStatus` | `githubUrl`을 cwd별로 기억(재조회 안 함) | URL 케이스 red |
| M-10 | `git-snapshot.ts` `buildStatus` | linked worktree(`probe.gitDir ≠ probe.commonDir`)면 `githubUrl: null` | URL 케이스 red |
| M-11 | `scripts/vitest-setup.mjs` | 격리 git 변수 설정을 끔 | hostile 테스트 red(교체한 대표가 서명 설정에 걸린다) |

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| `ci.yml` 단계 전부의 로컬 대응 | `app/**` 변경 | `app/AGENTS.md` test-pools 항목 "로컬 확인" 7명령 | 이번 변경이 유발한 실패 |
| Windows CI | AC3·AC4가 win32 분기 | `ci.yml` run green | 같음 |
| 집계 gate | AC12 | §19 | 같음 |
| 문서 링크 | `docs/handoff/INDEX.md` 갱신 | `node app/scripts/check-doc-inventory.mjs --check` | 같음 |
| trailer 파싱 | 커밋 | `git log -1 --format='%(trailers:only=true)'` | 같음 |

## 7-B. ΔV1 — AC13 내부 정합 정정 (2026-11-09, Codex)

**READY.** 사용자가 "기존 케이스 보존 + 추가 검증 허용 (권장)"을 선택했다. V1 AC13의 신규 파일 한정이 §11의 `naming.test.ts` 신규 5케이스와 충돌해 그 한정만 대체한다.

| 변경 | provenance / requiredness | 유효 계약 / oracle | 유지 항목 |
|---|---|---|---|
| R-02 ↔ AT-02 / AC13 | CHANGED / REQUIRED, 기존 VP-02로 추적 | 변경 전 케이스 ID를 전부 보존하며 통과·건너뜀을 유지하고 실패 0이다. 추가 검증 케이스는 파일 위치와 무관하게 허용한다. 기존 케이스의 `expect` 변경 허용 자리는 V1 그대로다. | AC5~AC12, EP-03~EP-07, 선택 증거·path·분모 |
| VP-02 | CHANGED / REQUIRED | 전후 vitest 산출의 기존 케이스 ID 차집합 ∅와 상태 비교, 신규 ID는 별도 집계. 환경 실패 분리는 `docs/handoff/AGENTS.md` 기준이다. | AC12 집계 명령·임계 840/380 |

- **정합성 확인:** D-018과 §11의 기존 파일 신규 케이스가 양립한다. 원래 케이스를 지우거나 새 케이스로 바꾸는 권한은 추가하지 않았다.
- **영향 범위:** 테스트 추가 허용만 바뀐다. production 동작·기존 케이스 단언·운영 gate·Windows 및 self-hosted 실기는 V1을 상속한다.

## 7-C. ΔV2 — D-013 통합 oracle 정합 정정 (2026-11-09, Codex)

**READY.** `app/src/main/app/git-execution.test.ts`의 `prepares without baseRef in four executions…`는 `check-ref-format → show-ref`를 기대한다. D-013·EP-09는 `for-each-ref → check-ref-format`을 요구하므로 두 명령명 단언의 정정 없이는 두 계약이 양립하지 않는다.

| 변경 | provenance / requiredness | 유효 계약 / oracle | 유지 항목 |
|---|---|---|---|
| R-02 ↔ AT-02 / AC13 | CHANGED / REQUIRED, 기존 VP-02 | ΔV1을 상속하고 `expect` 정정 허용 자리에 EP-09의 위 통합 케이스 명령 벡터 1곳만 추가한다. 기대 명령은 `rev-parse, for-each-ref, check-ref-format, worktree`다. | 케이스 ID·4회 호출·쓰기 정책·generation 단언, 그 밖의 기존 `expect` 제한 |
| VP-04 | CHANGED / REQUIRED | 기존 `naming.test.ts` + `git-execution.test.ts`의 위 통합 케이스. 후자는 실제 `WorktreeService.prepare → listBranchRefs/validateBranchName → gateway → git` 배선을 관측한다. | EP-09 분모 1·경로·선택 증거 |

- **출처:** D-013의 이미 합의된 실행 경로와 기존 assertion의 충돌이다. 제품 동작이나 새 정책을 결정하지 않으며 D-018의 기존 케이스 보존도 유지한다.
- **정합성 확인:** AC15와 통합 케이스는 모두 목록 1회·고른 이름 검사 1회를 요구한다. 전체 호출 예산 4회는 변경하지 않는다.

## 7-D. ΔV3 — 모듈 pair의 강제 자리 분리 (2026-11-09, Codex)

**READY.** V1 VP-07은 순수 스트림·marks 함수가 path인데 EP-04의 분모는 소비 테스트 18파일이었다. 소비처와 모듈 자리를 분리하며 기존 B1~B13 계약은 그대로 둔다.

| 변경 | provenance / requiredness | 유효 §10 자리 / oracle | 유지 항목 |
|---|---|---|---|
| VP-07, MD-02 ↔ UT-02 | CHANGED / REQUIRED | EP-11: `fast-import-stream.testfixture.ts`의 `fastImportStream`·`parseMarks` 2자리. `fast-import-stream.test.ts`의 스트림·기본 시각·부모·marks 케이스. | B1~B10 스트림·OID 의미, 적대 증거 not selected |
| VP-10, AR-02 ↔ IT-02 | CHANGED / REQUIRED | EP-03 1 + EP-04 소비처 18 + EP-12 공용 빌더 2 = 21자리. 기존 소비 테스트와 `temp-repo.test.ts`·`io-git-guard.test.ts`. | M-02, B1~B13, 빌더 밖 직접 구성 금지 |

| §10 추가 자리 | SSOT / 언제 강제 | 자리 검색 명령 | 실패 의미 / 직접 oracle |
|---|---|---|---|
| EP-11 (2) | `fastImportStream`·`parseMarks`, 공용 순수 모듈 본문 | `rg -n '^export function (fastImportStream|parseMarks)' app/src/main/infra/git/fast-import-stream.testfixture.ts` → 2 | 스트림·marks 의미가 달라짐. `fast-import-stream.test.ts` |
| EP-12 (2) | `createRepo`·`appendCommit`, 실행·stdin·marks·시간 상한·추적/정리 배선 | `rg -n '^export async function (createRepo|appendCommit)' app/src/main/infra/git/temp-repo.testfixture.ts` → 2 | 파일·index·HEAD·OID·정리 의미가 달라짐. `temp-repo.test.ts`의 동치·호출 수·일반 브랜치 복원·실패·끊긴 자식 케이스 |

- **정합성 확인:** EP-04 소비처 분모 18은 바꾸지 않는다. 모듈 UT가 소비 테스트 18자리를 닫았다고 세지 않도록 VP-07의 분모를 2로 정정한다.
- **출처:** §9·§11이 이미 지정한 공용 함수의 자리 누락이다. 새 제품 동작·정책·AC·선택 변이를 추가하지 않는다.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 이번 세션 실측 (리눅스 컨테이너 4코어 · git 2.43.0 · Node 22.23.4)

| 파일 | 케이스 | 리눅스 | git 실행 | 러너(사용자) | git 1회당(러너, 상한) |
|---|---:|---:|---:|---:|---:|
| `infra/git/git-cli.test.ts` | 20 | 0.72s | 186 | 518.2s | 2.79s |
| `infra/git/git-diff.test.ts` | 32 | 0.44s | 144 | 447.1s | 3.10s |
| `features/worktrees/service.test.ts` | 12 | 0.59s | 121 | 444.3s | 3.67s |
| `infra/git/git-consistency.test.ts` | 8 | 0.53s | 131 | 420.5s | 3.21s |

- 재현: `evidence/spawn-trace.mjs`를 `NODE_OPTIONS=--import`로 얹고 io 파일마다 vitest 실행(§19). 기준선 집계 = [`evidence/baseline-census.tsv`](evidence/baseline-census.tsv).
- io 75파일 중 git을 띄우는 파일 18개 · 합계 **1002회 = 테스트 측 538 + production 464**, 테스트 측 저장소 구성 명령 344. Electron 미설치로 3파일은 돌지 않았다(git 언급 0 — `rg -c "\bgit\b|runGit|execGit"` 0).

### 발견 / 제약

| ID | 발견 | 근거 |
|---|---|---|
| F-01 | 러너 git 1회 ≈ 2.8~3.7초, 리눅스 ≈ 4ms | 위 표 |
| F-02 | GitHub windows-latest io 누적 132.0초·unit 94.8초 vs 러너 3368초(25.5배)·180초(1.9배) | 0298 plan §7-D · 사용자 수치 |
| F-03 | Git for Windows `cmd\git.exe`는 `MSYSTEM`·`PLINK_PROTOCOL`·`HOME`·PATH를 설정하고 `<top>\mingw64\bin\git.exe`를 `CreateProcess`로 띄워 종료까지 기다린다 | `git-for-windows/MINGW-packages` `mingw-w64-git/git-wrapper.c:124-205`(setup_environment) · `782-790`(git.exe 분기) · `847-911`(CreateProcess·Wait) — 2026-11-09 열람 |
| F-04 | production git 실행은 `runGit` 한 곳이 `gitExecutable()`로 PATH 첫 `git.exe`를 고른다 | `runner.ts:27` · `git-executable.ts:29-34` · `rg "gitExecutable\(" app/src/main --glob '!*.test.ts'` → 호출 1 |
| F-05 | 저장소 생성 헬퍼가 테스트 파일마다 따로 있다 — 17벌, 공용 픽스처는 정리만 제공 | `rg -nE "^(async )?function (makeRepo\|repo\|repository\|commit\|initRepo)\(\|^\s+async function (repo\|commit)\(" app/src --glob '*.test.ts'` → 17 · `temp-repo.testfixture.ts` |
| F-06 | 테스트 소스 12개가 git을 이름(`'git'`)으로 띄운다(픽스처 포함) | `rg -lE "(execFileSync\|execFile\|execGit\|exec\|spawn\|spawnSync)\(\s*'git'" app/src --glob '*.test.ts' --glob '*.testfixture.ts'` → 12 |
| F-07 | production 동작별 호출 수는 이미 작다 — 상태 2회(probe + `remote get-url`, 매번 현재 값 — git-cli URL·consistency 테스트가 잠금), 상태+요약 4회, probe 1회(unborn 3회) | `git-snapshot.ts:15-46` · `probe.ts:30-60` · `git-cli.test.ts:65-92` · `git-consistency.test.ts:153` |
| F-08 | `git worktree add -b` 1회는 git 내부 자식 3개(`symbolic-ref`·`branch`·`reset`)를 더 띄운다 — 4파일 실제 git 637 = Node spawn 582 + 내부 자식 55 | `strace -f -e execve` 집계(이번 세션) |
| F-09 | `init.templateDir =`(빈 값)이면 init이 파일 2개만 만들고 경고가 없다 · `core.fsync = none` 수용 · 테스트가 템플릿 파일에 기대는 곳 0 | 이번 세션 git 2.43 실행 · `rg "info/exclude\|\.git/hooks\|\.git/description" app/src` 0 |
| F-10 | `slugOf` 출력은 `[a-z0-9-]`뿐이고 후보는 `work/<slug>[-N]` 또는 `work/<hex8>` | `naming.ts:6-13,67-77` |
| F-11 | 공유 가능(저장소를 바꾸지 않는) 케이스 묶음은 git-cli AC4 + AC7 이름 거부 6케이스뿐이다. 나머지는 케이스마다 다른 이력을 세우거나 저장소를 바꾼다 | 케이스별 git 쓰기 집계(이번 세션) · `git-cli.test.ts:150-216` |
| F-12 | URL 형식(ssh·`ssh://`·자격 증명 제거·사내 GitHub)은 `github-url.test.ts` 3개 `it.each`(URL 34줄)가 덮는다 | `github-url.test.ts:5-58` |
| F-13 | io 분류·예산 규칙은 `temp-repo.testfixture` import를 신호로 쓴다 — 빌더로 옮긴 파일도 io·실-git 예산 대상으로 남는다 | `scripts/test-source.mjs` `FIXTURE`·`isRealGitSuite` |
| F-14 | 같은 내용·날짜·신원·메시지(`-m` 값 + `\n`)면 porcelain(`add`·`commit`·`branch`)과 `fast-import`가 같은 커밋 OID를 만든다 — 한글·공백 경로 · 바이너리 · 삭제 · 여러 줄 메시지 · 추가 브랜치 포함 2커밋에서 main `321126fd…`·feature `f0f3148d…` 일치, `reset --hard` 뒤 `status --porcelain` 0줄, marks `:1`·`:2`가 두 OID | 이번 세션 git 2.43 실행(격리 설정 + `init.templateDir =`) |

### 수치 검산

| 식 | 값 | 판정 |
|---|---|---|
| 538 + 464 | 1002 | 일치 |
| 4파일 test-side 115+86+88+56 = 345 · production 71+58+43+65 = 237 | 582 | 일치 |
| 3547.7 / 7 | 506.8 | D-004 근거 |
| 518.2 + 447.1 + 444.3 + 420.5 | 1830.1 (누적의 51.6%) | 일치 |

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
production  runGit(cwd,args) ─ gitExecutable() = PATH 첫 git.exe ─ execFile(file, args, env=process.env+α)
테스트      makeRepo/repo/repository/commit (파일별 17벌) ─ execGit('git') / execFileSync('git') / runGit
            → PATH 의 이름 해석 → 런처 → 실제 git
가드        unit 풀만(모든 spawn 금지). io 풀은 감시 없음
```

### TO-BE

```text
production  runGit ─ gitCommand() = { file, env(base) } ─ execFile(file, args, env(process.env)+α)
                      └ resolveGitCommand: 런처 → 실제 파일 + 런처 규칙 env / 그 밖 → 찾은 파일, env 그대로
테스트      createRepo / appendCommit (temp-repo.testfixture) ─ execGit('git') ─ gitCommand() 공유
            fast-import 스트림 = fast-import-stream.testfixture (순수)
가드        io 풀 setup(vitest-io-guard) ─ spawn 관측 → judgeGitSpawn → 위반 기록 → afterEach/afterAll red
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | V 연결 |
|---|---|---|---|
| 실행 파일 | PATH 첫 `git.exe` | 런처면 실제 파일 + env | MD-01 / VP-06 · `git-executable.ts` |
| env | `process.env` + `GIT_TERMINAL_PROMPT`·`GIT_OPTIONAL_LOCKS` | + 런처 규칙(호출 시점 계산) | SD-01 / VP-11 · `runner.ts` |
| 테스트 저장소 | 파일별 헬퍼 17벌 | 빌더 하나 | AR-02 / VP-10 · `temp-repo.testfixture.ts` |
| 테스트 git 이름 실행 | 12 파일 | 0(픽스처가 해석) | AR-01 / VP-09 |
| io 감시 | 없음 | 구성 명령·이름 실행 감시 | MD-03 / VP-08 · `test-pools.mjs` |
| 격리 설정 | 4키 | + `init.templateDir`·`core.fsync` | MD-05 / VP-03 · `test-host.mjs` |
| 브랜치 이름 | 후보마다 2회 | 목록 1 + 검사 1 | MD-04 / VP-04 · `naming.ts` |

### 핵심 책임 분리

| 모듈 | 책임 | 입력/출력 | 누가 import |
|---|---|---|---|
| `infra/git/git-executable.ts` | PATH 탐색(기존) + `resolveGitCommand`(순수) + `gitCommand()`(캐시) | `{env, platform, isFile, readFile}` → `{ file, env(base) }` | `runner.ts` · `temp-repo.testfixture.ts` |
| `infra/git/runner.ts` | 실행 | `gitCommand()` 결과로 `execFile` | production 전부 |
| `infra/git/fast-import-stream.testfixture.ts` | 명세 → fast-import 입력 · marks 해석(순수) | `RepoSpec` → `Buffer` · marks 텍스트 → OID[] | 빌더 |
| `infra/git/temp-repo.testfixture.ts` | 빌더 `createRepo`·`appendCommit` + 기존 `execGit`·정리 | 명세 → `{ root, oids }` | io 테스트 |
| `scripts/test-pools.mjs` | `judgeGitSpawn`(순수) · `installIoGitGuard` · `IO_GIT_ALLOWED` · `FIXTURE_BUILDERS` · io setup 배선 | spawn 옵션·스택 → 위반 | vitest 설정 · `vitest-io-guard.mjs` |
| `scripts/vitest-io-guard.mjs` | io 프로젝트 setup — 가드 설치·기록 비우며 red | — | `buildProjects` io |

## 10. 계약 / 타입 / 강제 지점

| V / pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-09 · EP-01 | git을 띄우는 모든 자리가 같은 해석을 쓴다 | `gitCommand()` | 2자리 — `runner.ts` `runGit`(`:27` 실행 파일·`:38-42` env) · `temp-repo.testfixture.ts` `execGit`(`:53`) | `rg -n "gitExecutable\(\|gitCommand\(" app/src/main` · `rg -n "execFile\(" app/src/main/infra/git --glob '!*.test.ts'` | 한 자리만 바꾸면 테스트 또는 앱 한쪽만 런처를 탄다 |
| MD-01 / VP-06 · EP-02 | 런처 판별·env 규칙(아래 표) | `resolveGitCommand` | 1자리 — 함수 본문, 규칙 칸 R1~R10 | `rg -n "resolveGitCommand" app/src/main` | 규칙과 다르면 훅·자격 증명·전역 설정이 런처 경유와 달라진다 |
| MD-03 / VP-08 · EP-03 | io 가드 판정(아래 표) | `judgeGitSpawn` · `IO_GIT_ALLOWED` | 1자리 — 판정 함수, 칸 J1~J9 | `rg -n "judgeGitSpawn\|IO_GIT_ALLOWED" app/scripts` | 구성 명령 직접 호출·이름 실행이 조용히 통과 |
| AR-02 / VP-10 · EP-04 | 테스트 측 저장소 구성은 빌더만 | 빌더 + 가드 | 18파일(§8 집계 목록) — 테스트 측 구성 명령 344회 → 허용 목록 4회(hermetic-config) + `temp-repo.test.ts` 동치 비교분 | `node evidence/git-spawn-census.mjs <trace>` build 열 + 가드 위반 0 | 헬퍼 사본이 남아 호출이 줄지 않는다 |
| MD-06 / VP-12 · EP-05 | 공유 저장소 묶음 | `git-cli.test.ts` | 7케이스 — AC4(`:151`) · AC7 이름 거부 `injections` 6(`:200-216`) | `rg -n "injections\|reason:dirty" app/src/main/infra/git/git-cli.test.ts` | 케이스마다 저장소를 세운다 |
| MD-06 / VP-12 · EP-06 | 검증 읽기 합치기 | `git-cli.test.ts` | 3자리 — AC4 `:155,162,163` · AC5 `:190,192` · AC7 `:206,213,214` | `rg -n "porcelain\(\|'--abbrev-ref'" app/src/main/infra/git/git-cli.test.ts` | 같은 시점을 두 번 읽는다 |
| MD-06 / VP-12 · EP-07 | URL 케이스 통합 성질만 | `git-cli.test.ts:65-92` | 1자리 | `rg -n "set-url" app/src/main/infra/git/git-cli.test.ts` | 형식 변형을 실제 git으로 반복 |
| MD-05 / VP-03 · EP-08 | 격리 설정 내용 | `test-host.mjs` `HERMETIC_GIT_CONFIG` | 1자리 `:55-64` + 단언 2자리(`test-environment.test.ts:65` · `hermetic-config.test.ts`) | `rg -n "HERMETIC_GIT_CONFIG" app/scripts app/src` | 템플릿·fsync 비용이 남는다 |
| MD-04 / VP-04 · EP-09 | 브랜치 이름 선택 호출 수 | `naming.ts` | 1자리 — 후보 루프 `:68-76`(소비처는 `naming.ts` 하나) | `rg -n "validateBranchName\|branchExists\|listBranchRefs" app/src/main --glob '!*.test.ts'` | 충돌마다 2회 순차 |
| R-05 / VP-05 · EP-10 | hostile 대표 | `test-environment.hostile.test.ts:19-29` | 1자리 — git 대표 항목 | `rg -n "REPRESENTATIVES" -A12 app/src/main/infra/test-environment.hostile.test.ts` | 대표가 서명 설정을 밟지 않아 격리 붕괴를 못 잡는다 |

### EP-02 런처 판별·env 규칙 (`resolveGitCommand`)

| 칸 | 조건 | 결과 | UT 입력 |
|---|---|---|---|
| R1 | 비-win32 | 찾은 파일, env 변경 없음 | `platform:'linux'` |
| R2 | win32 · PATH에 git 없음 | `null`(지금과 같음) | 빈 PATH |
| R3 | win32 · 찾은 파일의 부모 폴더가 `cmd`·`bin`이 아님 | 찾은 파일 그대로 | `C:\Tools\git.exe` |
| R4 | win32 · `<top>\cmd\git.exe`이고 `<top>\mingw64\bin\git.exe` 있음 | 실제 파일 = mingw64, `MSYSTEM=MINGW64` | 대소문자 섞인 경로 포함 |
| R5 | win32 · `<top>\bin\git.exe` | R4와 같은 판별 | `…\Git\bin\git.exe` |
| R6 | `msys` 순서 — `mingw64`·`clangarm64`·`ucrt64`·`mingw32` 중 처음 존재 | 그 폴더, `MSYSTEM`=대문자 이름 | `clangarm64`만 존재 |
| R7 | 런처 위치지만 실제 파일 없음 | 찾은 파일 그대로 | msys 폴더 없음 |
| R8 | `PLINK_PROTOCOL` 있음 / 없음 | 유지 / `ssh` | 두 입력 |
| R9 | `HOME` 있음 / 없고 `HOMEDRIVE+HOMEPATH`가 디렉토리·시스템 디렉토리 아님 / 그 밖 | 유지 / 그 경로 / `USERPROFILE`(없으면 미설정) | 네 입력(시스템 디렉토리 포함) |
| R10 | PATH | `<top>\<msys>\bin;<top>\usr\bin;` + (`HOME` 있고 길이+6 < 260이면 `<HOME>\bin;`) + 기존 PATH. 기존 PATH 키 이름 보존(`Path` 등) · `<top>\etc\git-bash.config`의 `MSYS=`가 있으면 `MSYS` 앞에 붙임 | `Path` 키 · 긴 HOME · config 유/무 |

- env는 `env(base)` 함수로 돌려 호출 시점의 `process.env`에 적용한다 — 테스트 setup이 파일마다 `HOME`을 바꾸므로 해석 시점 env를 캐시하면 틀린다. 캐시는 파일 경로·`top`·`msys`만.
- 런처의 MSys1 경로(`<top>\mingw\bin`)는 다루지 않는다 — R4~R6 조건이 MSys2 배치에서만 성립한다(선언 경계).

### EP-03 io 가드 판정 (`judgeGitSpawn`) — fail-closed

입력: spawn 파일·인자·스택(app 프레임 목록, 캡처 시 `Error.stackTraceLimit` 상향)·허용 목록. "테스트 측" = 테스트 소스(`*.test.ts`·`*.testfixture.ts`) 프레임이 있고 production 프레임(`infra/git/runner.ts` 제외)이 없다.

| 칸 | 조건 | 판정 | UT 입력 |
|---|---|---|---|
| J1 | git이 아닌 실행 파일 | 무시 | `node` spawn |
| J2 | production 프레임 있음(테스트가 부른 대상 코드) | 통과 | commit-wip 스택 |
| J3 | 테스트 프레임 없음(비동기로 끊긴 production) | 통과 | runner 프레임만 |
| J4 | 테스트 측 · 하위 명령 ∉ {init, add, commit, fast-import} | 통과(J8 제외) | `status` · `remote add` · `worktree add` |
| J5 | 테스트 측 · 구성 명령 · 스택에 `FIXTURE_BUILDERS`(`createRepo`·`appendCommit`) 프레임 | 통과 | 빌더 스택 |
| J6 | 테스트 측 · 구성 명령 · 허용 목록 파일 | 파일별 계수 — 파일 끝에 `count`와 다르면 위반 | 같은 수 · 많음 · 적음 |
| J7 | 테스트 측 · 구성 명령 · 그 밖 | 위반 | `runGit(dir,['init'])` · `execGit('git',['-C',d,'commit'])` |
| J8 | 테스트 측 · 실행 파일이 이름(`git`·`git.exe`, 경로 없음) | 위반 | `execFile('git')` · `execFileSync('git')` |
| J9 | 하위 명령 추출 — 앞의 `-C <dir>`·`-c <kv>`·`--no-optional-locks`·`--*=` 옵션을 건너뜀 | 첫 비옵션 인자 | 옵션 조합 4종 |

- 감시 대상은 unit 가드와 같다 — `ChildProcess.prototype.spawn` + `spawnSync`·`execFileSync`·`execSync`(문자열 명령은 첫 낱말). 기록 → `afterEach`·`afterAll`에서 비우며 red(0298 D-007 방식).
- 허용 목록 초기값: `src/main/infra/git/hermetic-config.test.ts` — init 2 · add 1 · commit 1(사유: 실제 `git commit`의 신원·maintenance가 시험 대상, hostile 대표) · `src/main/infra/git/temp-repo.test.ts` — 동치 비교용 porcelain 구성(수는 구현 시 고정).

### EP-04 빌더 명세 (`createRepo`·`appendCommit`)

| 칸 | 명세 | fast-import 스트림 / 실행 | UT·IT 입력 |
|---|---|---|---|
| B1 | `branch`(기본 `main`) | `init --initial-branch=<branch>` | 기본 · `trunk` |
| B2 | 커밋 0개 | init만(1회) | unborn |
| B3 | 커밋 `files` 없음 | `commit refs/heads/<b>` 빈 트리, reset 생략(2회) | 빈 커밋 연속 |
| B4 | `files: {path: string \| Buffer \| null}` | `M 100644 inline <path>` + `data <bytes>` / `D <path>` | 삭제 · 바이너리 · 한글·공백 경로 · `"`로 시작·개행 포함 경로는 C 인용 |
| B5 | `message` | `data`에 `message + '\n'`(`git commit -m`과 같은 바이트) | 여러 줄 |
| B6 | `date`(ISO) / 없음 | author·committer `<epoch> +0000` / 실행 시각 | 두 입력 |
| B7 | 신원 | `HERMETIC_GIT_IDENTITY` | `git-diff.test.ts:411` 작성자 단언 유지 |
| B8 | `branches: {name: index}` | `reset refs/heads/<name>` + `from :<mark>` | 추가 브랜치 2개 |
| B9 | `detach: index` | `checkout --detach <oid>`(reset 대신) | detached |
| B10 | OID | `--export-marks=<file>` → `:<mark> <oid>` 해석 | marks 텍스트 |
| B11 | 작업 트리 | 파일이 하나라도 있으면 `reset --hard`(B9면 checkout) | — |
| B12 | `appendCommit` | `from refs/heads/<b>^0` 커밋 1개 + (파일 있으면) `reset --hard` | 기존 저장소 |
| B13 | 실패 | 자식 종료 코드 ≠ 0 → stderr 포함 throw · 자식은 `running` 추적(정리 훅이 kill) | fast-import 문법 오류 |

- 빌더는 `execGit` 하나로 띄우고 `FIXTURE_GIT_TIMEOUT_MS`를 넘긴다(예산 규칙 C·G). 임시 루트는 호출자가 넘긴 `roots`에 등록한다(`removeTempRoots` 경로).
- stdin 입력은 `execFile`이 반환한 자식의 `stdin.end(buffer)`로 쓴다.

### 선언 경계 (게이트가 green인 채로 남는 차이)

- AC12는 리눅스 git 2.43 집계다. Windows 전용 분기·GfW 버전 차이로 호출 수가 다를 수 있다 — 측정하지 않았다.
- 빌더 커밋은 clean 필터·훅·서명을 거치지 않는다. 그것이 시험 대상인 파일은 허용 목록으로만 실제 명령을 쓴다(J6).
- 런처의 MSys1 배치·`HOME` 길이 260 초과 같은 경로는 런처와 다를 수 있다(R10).
- io 가드는 vitest io 프로젝트만 본다. `node --test scripts/*.test.mjs`가 띄우는 git은 대상이 아니다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/infra/git/git-executable.ts` | 해석 | `resolveGitCommand`(순수, `isFile`·`readFile`·`env`·`platform` 주입) · `gitCommand()` 캐시 · 기존 `resolveGitExecutable` 유지 | `git-executable.test.ts` |
| `app/src/main/infra/git/runner.ts` | 실행 | `resolveExecutable` 옵션을 `{file, env}`로(테스트 주입 유지) | `runner.test.ts` |
| `app/src/main/infra/git/git-launch.win32.test.ts`(신규) | Windows 훅 동치 | alias env 비교 · pre-commit 훅 실행 | `it.runIf(win32 && 런처)` |
| `app/src/main/infra/git/fast-import-stream.testfixture.ts`(신규) | 스트림·marks(순수) | B1~B10 | `fast-import-stream.test.ts`(unit 풀) |
| `app/src/main/infra/git/temp-repo.testfixture.ts` | 빌더 | `createRepo`·`appendCommit` · `execGit`가 `'git'`을 `gitCommand()`로 해석 | `temp-repo.test.ts`(동치) |
| `app/scripts/test-pools.mjs` · `test-pools.d.mts` | 가드 | `judgeGitSpawn` · `installIoGitGuard` · `IO_GIT_ALLOWED` · `FIXTURE_BUILDERS` · `IO_GUARD_SETUP` 배선 | `test-pools.test.mjs` |
| `app/scripts/vitest-io-guard.mjs`(신규) | io setup | 설치·red | `io-git-guard.test.ts`(신규) |
| `app/scripts/test-host.mjs` | 격리 설정 | 2키 추가 | `test-environment.test.ts` · `hermetic-config.test.ts` |
| `app/src/main/features/worktrees/naming.ts` · `infra/git/repository.ts` | 브랜치 이름 | `listBranchRefs`(`for-each-ref --format=%(refname) refs/heads/<base> refs/heads/<base>-*`) 1회 → 정확 일치 판정 → 고른 후보만 `validateBranchName` | `naming.test.ts` |
| io git 18파일(§8 목록) | 픽스처 이전 | 헬퍼 → 빌더 · `execFileSync('git')` → `execGit` · EP-05~07 | 기존 케이스 |
| `app/src/main/infra/test-environment.hostile.test.ts` | 대표 교체 | EP-10 | M-11 |
| `app/AGENTS.md` scripts 절 | 작업 규칙 | 빌더 사용 규칙·io 가드·허용 목록 등록법 한 항목 | — |

### 테스트 가능성

- 해석·판정·스트림은 모두 순수 함수 seam(파일 시스템·env·스택을 인자로 받음)이라 리눅스에서 win32 경로 분기까지 UT로 닫는다(`path.win32`).
- Windows 실측이 필요한 것은 AC3(훅 동치)뿐이고 Windows CI가 기계로 돈다.

## 13. Lifecycle / 오류 / 정리

- 빌더 자식은 `execGit`의 `running` 집합에 들어가 `removeTempRoots`가 kill 후 지운다 — fast-import가 예산에 끊겨도 같은 경로.
- `gitCommand()`는 기존처럼 못 찾으면 캐시를 비운다(`git-executable.ts:40-45` 의미 유지).
- io 가드 위반은 테스트를 throw로 막지 않는다(production이 오류를 삼킬 수 있음) — 기록 후 훅에서 red(0298 D-007과 같은 이유).

## 14. 성능 / 상한

| 항목 | AS-IS | TO-BE 추정 | 근거 |
|---|---:|---:|---|
| io git 실행(리눅스 집계) | 1002 | ≈ 800 (AC 840) | 빌더 −154 · 공유 −23 · 읽기 합치기 −10 · URL −15 |
| 테스트 측 | 538 | ≈ 345 (AC 380) | 같음 |
| Windows 프로세스(4파일) | 582×2 + 55 = 1219 | ≈ 430 + 55 = 485 | D-005 + 호출 축소 |
| 러너 vitest wall | 528초 | 측정 대상(AC18) | 단가 ∝ 프로세스 가정이면 io 누적 −55~60% |

- 이 추정은 "git 시간 ∝ 프로세스 수" 가정이다. 런처가 단가의 몇 %인지는 측정하지 않았다 — AC18이 실측한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 시간 예산 = 기준값 × 배율 | 0294 D-001·D-002 | 빌더가 `FIXTURE_GIT_TIMEOUT_MS` 사용 | 유지 |
| git 인프라(execGit 추적·removeTempRoots) | 0294 D-009 | 빌더가 같은 경로 | 유지 |
| hostile 대표 목록 | 0294 AC(hostile) | D-015 | 변경 — 대표 1개 교체, 원인 축(서명 강제) 유지 |
| 격리 설정 내용 | 0298 D-003 | D-012 | 확장 |
| unit 가드 기록·훅 red | 0298 D-007 | io 가드가 같은 방식 | 유지·재사용 |
| 풀 분류 신호 | 0298 · `test-source.mjs` | 빌더 import가 `FIXTURE` 신호 | 유지 |
| 상태 조회 매번 현재 값 | `git-cli.test.ts:65` · `git-consistency.test.ts:153` | F-07 · M-09 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 런처와 env가 달라 사용자 훅·자격 증명이 다르게 동작 | EP-02 표 + AC3 Windows IT. 판별 실패 시 지금 경로로 폴백(R3·R7) |
| 공유 저장소 연쇄 red(D-009) | 7케이스 한 묶음뿐 — 수용된 대가 |
| 빌더가 porcelain과 다른 저장소를 만든다 | AC5 OID 동치(같은 바이트 커밋) |
| 가드가 정상 production 경로를 막는다 | J2·J3 + M-04 + 전체 io green |
| 테스트 개정이 검출력을 잃는다 | M-05~M-10 |
| 합의 밖 추가 여지 | 후보 형식 검사 생략(F-10) — 제안만, 구현하지 않는다 |

- 신규 의존성: 없음. 되돌리기 어려운 결정: 없음(실행 파일 해석은 판별 실패 시 지금 동작).

## 18. 영향 받는 파일 / 문서

- `app/src/main/infra/git/{git-executable,runner,temp-repo.testfixture,repository}.ts` · 신규 `fast-import-stream.testfixture.ts`·`temp-repo.test.ts`·`fast-import-stream.test.ts`·`git-launch.win32.test.ts`
- `app/src/main/features/worktrees/naming.ts` · `app/src/main/infra/io-git-guard.test.ts`(신규) · `test-environment.hostile.test.ts`
- `app/scripts/{test-pools.mjs,test-pools.d.mts,test-pools.test.mjs,test-host.mjs}` · 신규 `vitest-io-guard.mjs`
- io git 18파일(§8) · `app/AGENTS.md` scripts 절

## 19. 게이트

- 적용 가이드: `app/AGENTS.md` test-pools 항목 "로컬 확인"(마이그레이션·문서 인벤토리·예산 가드 · lint · typecheck · 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs`).
- 집계 gate(AC12), `app/`에서:

```bash
T=<빈 폴더>; for f in $(node -e "import('./scripts/test-pools.mjs').then(m=>console.log(m.partitionTestFiles(process.cwd()).io.join('\n')))"); do
  ORCA_SPAWN_TRACE=$T/$(echo $f | tr / _).jsonl NODE_OPTIONS="--import $PWD/../docs/handoff/0300-ci-git-spawn-reduction/evidence/spawn-trace.mjs" \
  ./node_modules/.bin/vitest run "$f" >/dev/null 2>&1; done
node ../docs/handoff/0300-ci-git-spawn-reduction/evidence/git-spawn-census.mjs $T --max-total 840 --max-test-side 380 \
  --max-file src/main/infra/git/git-cli.test.ts=135 --max-file src/main/infra/git/git-consistency.test.ts=85 \
  --max-file src/main/infra/git/git-diff.test.ts=115 --max-file src/main/features/worktrees/service.test.ts=115
```

- 기준선에서 위 명령은 exit 1(`total 1002 > 840` 등)이다 — 이번 세션 관측.
- 사람 실기: AC18(self-hosted 러너 전후 각 2회).

## READY self-review (V1)

- Decision Ledger: ACTIVE 15 · OPEN 2(D-014·D-017, 구현 범위 밖) · 4턴 A안은 D-005가 대체 — 관측: §3 표.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0(§3 갱신 메모).
- 사용자 표현 원문 보존: §2 인용 5건. "고려하지말것"의 해석은 4턴에 보고했고 이견 없음.
- 수치 실측: 1002·538·464·344(`baseline-census.tsv`) · 17(F-05 명령) · 12(F-06 명령) · init이 만드는 파일 18 → 2(F-09) · 런처 소스 줄 범위(F-03).
- pair 13개 모두 production path·§10 EP(VP-13은 0 + 이유)·직접 oracle 좌표를 갖고, 적대 증거는 구조적 판정·테스트 개정 pair(VP-05·08·09·10·12)만 선택했다(M-01~M-11).
- 규칙 칸 ↔ 입력 칸: EP-02 R1~R10 · EP-03 J1~J9 · EP-04 B1~B13 모두 입력 열이 있다.
- 열린 입력 집합 판정(io 가드): fail-closed — 구성 명령은 빌더·허용 목록 밖이면 위반(J7), 이름 실행은 위반(J8).
- 사람 실기로 미룬 순수 로직: 없음(AC18은 실제 러너 시간뿐).
- INDEX 후보 표 겹침: 0294 행(예산 해석기)은 이번 변경이 해석기를 고치지 않아 비겹침.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- **r1 / Codex / 유효 V1+ΔV1+ΔV2+ΔV3.** REQUIRED VP-01~04·06~13, REGRESSION VP-05. 이전 verify·인용 파생 이슈는 없다. 독립 검증을 대신하지 않는다.
- 사용자 승인 D-018을 ΔV1에 반영했다. 기존 케이스 ID를 보존하며 새 검증은 기존 파일에도 추가한다. ΔV2는 D-013과 기존 통합 명령 벡터의 충돌, ΔV3는 순수 모듈·공용 빌더와 소비처 분모의 혼동을 고쳤다. 세 규범 정정은 구현과 별도 설계 커밋이다.
- 경계 D-014·D-017은 OPEN 그대로다. checkout 재조회·캐시·lint 최적화·러너 설정은 추가하지 않았다.
- 현재는 **impl/IN_PROGRESS**. 로컬 전체 gate와 Windows CI를 확인 중이며, 아래 SELF_PASS는 해당 직접 oracle·변이에 대한 자기보고다. AC13·AC18은 아직 합계에서 제외한다. AC3은 #1030에서 실제 2케이스 통과했다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

자리 재검색 결과는 [impl-r1-slots.txt](evidence/impl-r1-slots.txt), 소비처 18파일은 [baseline-census.tsv](evidence/baseline-census.tsv)의 SUM 제외 행과 대조한다. 고유 자리 **42 = 2+1+1+18+7+3+1+3+1+1+2+2**. pair 간 중복은 합산하지 않는다. 유효 ΔV3의 EP-11·12를 적용했다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 | 실제 파일·env·훅 | EP-01 2 + EP-02 1 = 3 | 3/3 SELF_PASS | `git-executable.test.ts` 18케이스·`runner.test.ts` 3케이스·`io-git-guard.test.ts:픽스처 git 은 해석된 실행 파일로 뜬다` | cmd/bin·각 MSys 후보·결손·현재 HOME/Path/MSYS, 전달된 file/env 값 비교 | 없음 |
| VP-02 | 구성 가드·18소비처·공유/읽기/URL | EP-03~07 = 30 | 구조 30/30; 전체 상태 비교 SELF_BLOCKED | `node evidence/git-spawn-census.mjs <trace> --max-total 840 --max-test-side 380 --max-file …` → 829/377, 파일별 122/68/106/114; 기존 18 io 파일 | 실제 spawn 전수, 이전 1002/538; 직접 구성은 허용 목록만, 가드 위반 0 | AC13 전체 비교 |
| VP-03 | 격리 설정+단언 | EP-08 3 | 3/3 SELF_PASS | `test-environment.test.ts:XDG 4종은 루트 아래…`·`hermetic-config.test.ts`·`test-host.test.mjs` | 기존 4키+빈 templateDir/fsync none; init 파일 2개·stderr 공백 | 없음 |
| VP-04 | 목록·선택 검사 | EP-09 1 | 1/1 SELF_PASS | `naming.test.ts` 8케이스 + `git-execution.test.ts:prepares without baseRef in four executions…` | 충돌 0/1/12/9999·dirTaken·형식 거부·목록 실패; 목록1+검사1, 전체4회 | 없음 |
| VP-05 | 예산·격리·풀 | EP-10 1 | 1/1 SELF_PASS | hostile 테스트 + `check-test-budgets.mjs` + `test-pools.test.mjs`; M-11 red | 실제 commit 대표를 hermetic-config로 교체; 격리 끄면 2건 실패 | 없음 |
| VP-06 | 런처 R1~R10 | EP-02 1 | 1/1 SELF_PASS | `git-executable.test.ts` 18케이스; S02 27변이 red | win/linux·없음·후보 순서·HOME 4분기·긴 HOME·Path 키·config·동시/실패 재시도 | 없음 |
| VP-07 | stream·marks | EP-11 2 | 2/2 SELF_PASS | `fast-import-stream.test.ts` B6/B4~B8/B2·B12/B10 4케이스 | UTF8 바이트·NUL/255·인용/개행·삭제·부모·날짜·복수 branch·marks 순서/오류 | 없음 |
| VP-08 | J1~J9 | EP-03 1 | 1/1 SELF_PASS | `node --test scripts/test-pools.test.mjs` 51케이스; M-03a/M-04a red | 정규화된 src stack·production/빌더·외부 src·명령 옵션·허용 많음/적음/일치 | 없음 |
| VP-09 | runGit·execGit 운반 | EP-01 2 | 2/2 SELF_PASS | `runner.test.ts` 주입 실행부·`io-git-guard.test.ts` 실제 alias; M-01/S01 red | 구별되는 absolute file·호출 시점 env marker·timeout, runner와 픽스처 모두 관측 | 없음 |
| VP-10 | 가드·소비처·공용 빌더 | EP-03 1 + EP-04 18 + EP-12 2 = 21 | 21/21 SELF_PASS | `temp-repo.test.ts` 5케이스·기존 18파일·`io-git-guard.test.ts` 6케이스; M-02/03b/04b red | 동일 OID/HEAD/refs/status·1/2/3회·append1/2회·stderr·kill-before-rm; child Vitest test/afterAll/allowance red | 없음 |
| VP-11 | Windows sh·hook | EP-02 1 | 1/1 SELF_PASS | `git-launch.win32.test.ts` #1030 Windows 2케이스 통과, Linux skip(사유 명시) | launcher 강제 PATH와 직접 actual file, MSYSTEM/HOME/PLINK/PATH/sh 전체 출력 비교 | 없음 |
| VP-12 | 공유7·읽기3·URL1 | EP-05~07 = 11 | 11/11 SELF_PASS | `git-cli.test.ts` 기존 20케이스, M-05~10 전부 red·S05-sharing census red | dirty/브랜치/미추적 파일·origin 추가/변경/삭제·linked worktree 값 | 없음 |
| VP-13 | 폐쇄망 실제 시간 | 기계 자리 0 | SELF_BLOCKED | 사용자 self-hosted Test 단계 전후 각2회 | 실제 584초 대비 시간은 이 환경에서 관측 불가 | AC18 사람 실기 |

## [구현자 기입] 이번 라운드 수정의 잠금

**선택 증거 13(M-01~11, M-03·04는 UT/IT 각각) + 인용 변이 0 + 새 oracle 8(K-) + sweep 100(S-) = 표 121행. 기존120개는 red, CI 수정 후121개 전수를 다시 실행 중이다.** 재현 spec은 [impl-r1-mutations.jsonl](evidence/impl-r1-mutations.jsonl), 최종 결과는 [impl-r1-mutations.tsv](evidence/impl-r1-mutations.tsv). 하네스: `python3 .agents/skills/handoff-verify/scripts/mutate.py docs/handoff/0300-ci-git-spawn-reduction/evidence/impl-r1-mutations.jsonl --cwd app`. 소거 시 사용하지 않는 import/지역변수 잔여물을 함께 제거했다. 119개 전수 실행 후 naming 경계 수정에 닿은 4개를 재실행하고 새 경계 1개를 추가했다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `M-01` — `src/main/infra/git/temp-repo.testfixture.ts` | §7 등록 변이 | 해당 없음(r1) | vitest 2 failed  /  4 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-02` — `scripts/test-pools.mjs` | §7 등록 변이 | 해당 없음(r1) | vitest 6 failed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-03a` — `scripts/test-pools.mjs` | §7 등록 변이 | 해당 없음(r1) | node --test fail 1 · 빌더 예외는 두 함수·정본 파일만, 허용 목록은 계수; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-03b` — `scripts/test-pools.mjs` | §7 등록 변이 | 해당 없음(r1) | vitest 1 failed  /  5 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-04a` — `scripts/test-pools.mjs` | §7 등록 변이 | 해당 없음(r1) | node --test fail 1 · git 식별·production·비동기로 끊긴 경로·일반 명령; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-04b` — `scripts/test-pools.mjs` | §7 등록 변이 | 해당 없음(r1) | vitest 2 failed  /  18 passed (20); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-05` — `src/main/infra/git/git-cli.ts` | §7 등록 변이 | 해당 없음(r1) | vitest 6 failed  /  14 passed (20); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-06` — `src/main/infra/git/git-cli.ts` | §7 등록 변이 | 해당 없음(r1) | vitest 7 failed  /  13 passed (20); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-07` — `src/main/infra/git/git-cli.ts` | §7 등록 변이 | 해당 없음(r1) | vitest 1 failed  /  19 passed (20); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-08` — `src/main/infra/git/git-cli.ts` | §7 등록 변이 | 해당 없음(r1) | vitest 10 failed  /  10 passed (20); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-09` — `src/main/infra/git/git-snapshot.ts` | §7 등록 변이 | 해당 없음(r1) | vitest 1 failed  /  19 passed (20); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-10` — `src/main/infra/git/git-snapshot.ts` | §7 등록 변이 | 해당 없음(r1) | vitest 1 failed  /  19 passed (20); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `M-11` — `scripts/vitest-setup.mjs` | §7 등록 변이 | 해당 없음(r1) | vitest 2 failed  /  115 passed (117); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S01-file` — `src/main/infra/git/runner.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  1 passed (3); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S01-env` — `src/main/infra/git/runner.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  2 passed (3); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S01-fixture-env` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  5 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R1` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R2` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  16 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R3` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R4` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 11 failed  /  7 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R5` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R6-order` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 4 failed  /  14 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R7` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 5 failed  /  13 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R8-default` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R8-preserve` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R9-home` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  16 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R9-path` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 3 failed  /  15 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R9-directory` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  16 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R9-system` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 4 failed  /  14 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R9-SystemRoot` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R9-SYSTEMROOT` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R9-WINDIR` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R9-profile` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 5 failed  /  13 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R10-home` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R10-home-drop` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R10-msys-path` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R10-usr-path` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R10-old-path` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R10-path-key` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R10-config` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  16 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R10-old-msys` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R10-reader` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S02-R-cache` — `src/main/infra/git/git-executable.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  17 passed (18); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J1` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · git 식별·production·비동기로 끊긴 경로·일반 명령; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J3` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · git 식별·production·비동기로 끊긴 경로·일반 명령; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J4` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · git 식별·production·비동기로 끊긴 경로·일반 명령; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J6` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · 빌더 예외는 두 함수·정본 파일만, 허용 목록은 계수; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J7` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 4 · git 식별·production·비동기로 끊긴 경로·일반 명령; 빌더 예외는 두 함수·정본 파일만, 허용 목록은 계수; 앞 옵션을 건너뛰고 app 스택을 정규화한다; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J8` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · 이름 실행은 빌더·허용 목록에서도 red; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J9-C` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · 앞 옵션을 건너뛰고 app 스택을 정규화한다; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J9-c` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · 앞 옵션을 건너뛰고 app 스택을 정규화한다; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J9-no-locks` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · 앞 옵션을 건너뛰고 app 스택을 정규화한다; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-J9-equals` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · 앞 옵션을 건너뛰고 app 스택을 정규화한다; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-allow-count` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · 빌더 예외는 두 함수·정본 파일만, 허용 목록은 계수; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-builder-file` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · 빌더 예외는 두 함수·정본 파일만, 허용 목록은 계수; io git guard — J1~J9; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-watch-spawnSync` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · io 감시는 async spawn·sync 3형태를 보존하고 builtin을 한 번 동기화한다; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-watch-execFileSync` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · io 감시는 async spawn·sync 3형태를 보존하고 builtin을 한 번 동기화한다; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-watch-execSync` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · io 감시는 async spawn·sync 3형태를 보존하고 builtin을 한 번 동기화한다; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-watch-async` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · io 감시는 async spawn·sync 3형태를 보존하고 builtin을 한 번 동기화한다; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `K-cap-observer` — `scripts/test-pools.mjs` | 새 oracle 민감도 | 해당 없음(r1) | vitest 2 failed  /  3 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-01` — `src/main/infra/git/git-cli.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 12 failed  /  8 passed (20); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-02` — `src/main/infra/git/git-diff.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 12 failed  /  9 passed  /  11 skipped (32); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-03` — `src/main/infra/git/git-consistency.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 8 failed (8); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-04` — `src/main/features/worktrees/service.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 11 failed  /  1 passed (12); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-05` — `src/main/infra/git/git-snapshot.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 3 failed (3); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-06` — `src/main/features/worktrees/safe-delete.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 6 failed  /  1 passed (7); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-07` — `src/main/infra/git/git-diff-commit.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 3 failed (3); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-08` — `src/main/app/git-execution.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 3 failed (3); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-09` — `src/main/infra/git/queue-entry.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 4 failed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-10` — `src/main/infra/git/repository.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  5 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-11` — `scripts/vitest-setup.mjs` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  115 passed (117); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-12` — `src/main/infra/git/git-safety.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  1 passed (2); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-13` — `src/main/app/legacy-paths.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 3 failed  /  3 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-14` — `src/main/app/chat-turn/prepare-progress.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  3 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-15` — `src/main/infra/git/probe.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  1 passed (3); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-16` — `src/main/features/worktrees/reject-reasons.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  3 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-17` — `src/main/features/worktrees/ipc-integration.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-18` — `src/main/infra/git/hermetic-config.test.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed (2); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B1` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B4-delete` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B4-bytes` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B4-quote` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B5` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B6-date` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B6-now` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B7-swap` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B8` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B10-index` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B12` — `src/main/infra/git/fast-import-stream.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  3 passed (4); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B2` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  4 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B3` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  4 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B9` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  4 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B11` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 초회 green → 일반 브랜치 파일·index 단언 추가 후 red | vitest 1 failed  /  4 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B12-reset` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  4 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B13-stdin` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 3 failed  /  2 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B13-tracking` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  4 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B13-kill` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  4 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B13-create-cap` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  3 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B13-append-cap` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  4 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S04-B13-error` — `src/main/infra/git/temp-repo.testfixture.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  4 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S05-share` — `src/main/infra/git/git-cli.test.ts` | §10 열거 sweep | 해당 없음(r1) | [census] over: src/main/infra/git/git-cli.test.ts total 146 > 135; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S08-config-1` — `scripts/test-host.mjs` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed (2); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S08-config-2` — `scripts/test-host.mjs` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed (2); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S08-config-3` — `scripts/test-host.mjs` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  1 passed (2); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S08-config-5` — `scripts/test-host.mjs` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed (2); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S08-config-6` — `scripts/test-host.mjs` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed (2); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S08-config-7` — `scripts/test-host.mjs` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  1 passed (2); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S08-file-writer` — `scripts/vitest-setup.mjs` | §10 열거 sweep | 해당 없음(r1) | vitest 2 failed  /  7 passed (9); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S09-ref` — `src/main/features/worktrees/naming.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 4 failed  /  4 passed (8); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S09-directory` — `src/main/features/worktrees/naming.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  7 passed (8); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S09-validate` — `src/main/features/worktrees/naming.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 6 failed  /  2 passed (8); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S09-format` — `src/main/infra/git/repository.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  5 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S03-app-frames` — `scripts/test-pools.mjs` | §10 열거 sweep | 해당 없음(r1) | node --test fail 1 · 외부 라이브러리의 src 프레임을 production 앱 프레임으로 세지 않는다; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `K-io-record` — `scripts/test-pools.mjs` | 새 oracle 민감도 | 해당 없음(r1) | vitest 4 failed  /  2 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `K-builder-counter` — `scripts/test-pools.mjs` | 새 oracle 민감도 | 해당 없음(r1) | vitest 3 failed  /  2 passed (5); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `K-afterEach` — `scripts/vitest-io-guard.mjs` | 새 oracle 민감도 | 해당 없음(r1) | vitest 1 failed  /  5 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `K-afterAll` — `scripts/vitest-io-guard.mjs` | 새 oracle 민감도 | 해당 없음(r1) | vitest 2 failed  /  4 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `K-allowance-finalize` — `scripts/vitest-io-guard.mjs` | 새 oracle 민감도 | 해당 없음(r1) | vitest 1 failed  /  5 passed (6); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `K-census-filter` — `../docs/handoff/0300-ci-git-spawn-reduction/evidence/spawn-trace.mjs` | 새 oracle 민감도 | 해당 없음(r1) | node --test fail 1 · git census는 감시기를 빼고 테스트 측·production을 구분하며 초과를 거부한다; 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |
| `S09-exhausted-validation` — `src/main/features/worktrees/naming.ts` | §10 열거 sweep | 해당 없음(r1) | vitest 1 failed  /  7 passed (8); 명령은 spec의 `oracle` | SELF_PASS · red(exit 1) |

## [구현자 기입] Product/UX 파생 검토

- UI·IPC 오류 형태는 바꾸지 않았다. Git 출력·HEAD·브랜치·dirty 거부·미추적 파일·URL의 다음 조회 반영은 기존 통합 단언과 M-05~10으로 확인했다.
- 사용자 pre-commit 훅과 sh 환경은 production `gitCheckout(commit-wip)`·`runGit` 경로를 실행하는 Windows 테스트로 확인한다. Linux mock 결과만으로 AC3을 닫지 않는다.
- 실패한 fast-import는 stderr를 포함해 throw하고, 종료되지 않은 자식은 정리 훅이 먼저 kill한 뒤 임시 루트를 지운다. 새 사용자 대면 문자열이나 빈 화면 상태는 없다.
- 공유 dirty 픽스처가 오염되면 후속 케이스도 실패할 수 있다. D-009에서 승인한 대가이며 before 상태를 한 번 읽어 후속 실행의 오염을 계속 검출한다.

## [구현자 기입] 놓친 잠재 문제 + 대응

- **CI #1030 / 현재 결함 / 선조치:** Windows 재실행은 `test-environment.test.ts:자식 프로세스도 격리된 홈을 받는다` 1건 실패였다. io 감시기의 execFile 래퍼가 Node의 custom promisify symbol을 잃어 stdout 객체가 문자열로 바뀌었다. symbol descriptor를 보존하고 stdout·stderr·child를 실제 Node 자식에서 관측하는 회귀 테스트를 추가했다. 관련 Vitest 20케이스·Node51케이스 통과. [실패와 Windows AC3 증거](evidence/impl-r1-ci1030.txt). 사용자가 병합 후 main에서 계속하라고 지정하여 main으로 전환했다.
- **현재 결함/선조치:** 일반 브랜치의 reset 제거 변이(S04-B11)가 초회 green이었다. detached 동치 테스트만으로 일반 브랜치의 작업 트리 복원을 관측하지 못했다. 파일 바이트·index·status 직접 단언을 추가해 같은 변이가 red가 됐다. 최종 전수 변이도 red다.
- **현재 결함/선조치:** 외부 도구의 `/src/` stack을 앱 production으로 오인하면 가드와 census가 느슨해졌다. `/app/src/` 프레임으로 한정하고 가드 UT 및 별도 trace→census Node 통합 oracle을 추가했다. 감시기 scripts 프레임은 집계에서 제외한다. K-census-filter red.
- **현재 결함/선조치:** 후보 9,999개가 전부 찬 경계에서도 D-013의 목록1+검사1을 지켜야 했다. 선택·검사를 루프 밖에서 합치고 전체 id fallback 검사 단언과 S09-exhausted-validation을 추가했다.
- **환경:** preinstalled better-sqlite3는 Electron ABI140, 실행 Node24는 ABI137이었다. `npm rebuild better-sqlite3` 후 기준선과 구현을 동일 ABI로 실행했다. 기준선 Linux 전체에 C:/ 경로 관련 22실패가 있다. 구현 실패와 ID·서명을 전수 비교해 gate 결과에 기록한다.
- **환경:** native Node의 fixture constants import는 extensionless TS 런타임 import를 해석하지 못했다. 상수 모듈 적재 시 Git 모듈이 필요 없도록 아래 lazy import로 수정했다. Node test-time 관련 19케이스 통과.

### 설계 대비 명시적 차이

- `temp-repo.testfixture.ts`에서 Git 실행 해석과 순수 스트림 모듈을 함수 내부 dynamic import한다. 별도 구현·캐시는 만들지 않으며 같은 모듈의 함수와 타입을 쓴다.
- **만료:** dynamic import는 Node 모듈 캐시이며 자체 TTL 없음. gitCommand의 miss/failure 재시도·현재 env 적용은 그대로다(AC1·2·4, EP-01·02).
- **공유:** 같은 프로세스의 빌더/execGit이 같은 해석 모듈을 공유한다. 파일별 env 사본은 저장하지 않는다. 동시 첫 호출 캐시 테스트와 실제 fixture env marker로 확인했다(AC2·4).
- **재진입:** await 후 각 호출의 stdin·marks 경로·running 추적은 독립이다. 소비처의 다중 생성·append와 실패/정리 테스트로 확인했다(AC5·6, EP-12).
- **다른 무효화 축:** 성공 executable 경로 캐시는 기존대로이며 setup의 HOME/Path 변경은 호출 시점 env에 반영된다. git 미설치·탐색 오류는 캐시를 비워 다음 호출 재탐색한다(AC1·2).
- Node 스크립트 테스트의 격리 config·io setup 배열 단언은 확장된 필드를 반영했다. Vitest 기존 expect 변경 허용은 EP-05~07 및 ΔV2 한 곳이다. 테스트 삭제·케이스 이름 변경은 없다.

## [구현자 기입] 구현 보고

- 구현 좌표: **(r1 구현 — 좌표는 INDEX)**. 상태 impl/IN_PROGRESS, Verified-By pending. 문서의 SELF_PASS는 독립 verify 판정이 아니다.
- `runGit`과 fixture의 실행 파일·env 해석 통합, fast-import 빌더·marks OID·소비처18 이전, io 가드·정확한 허용 횟수, dirty 공유7·읽기3·URL1, 격리 설정2키·hostile 대표, 이름 선택2회까지 구현했다.
- [호출 집계](evidence/impl-r1-census.tsv): **829 = 테스트 측377 + production452**, build203. 기존 1002/538/344/464 대비 감소. git-cli122≤135, consistency68≤85, diff106≤115, service114≤115. io78파일을 각각 실행했고, 기존 환경 실패 파일은 별도 집합 비교한다. 집계의 Linux 값으로 Windows 호출 수나 실제 러너 시간을 추정해 AC를 닫지 않는다.
- gate: typecheck 3프로젝트 통과, lint 오류0·기존 경고2. migration/inventory/budget 통과, 전체 Node 826/826 통과. 파일 필터 없는 Vitest·Windows CI 결과는 진행 중이다. Linux 기준선 22실패는 아직 면제 판정하지 않았다.

| AC | 자기보고 | 근거 |
|---|---|---|
| AC1 | ✅ | R1~R7 UT·runner 전달 |
| AC2 | ✅ | R8~R10·현재 env/caching UT |
| AC3 | ✅ | #1030 재실행에서 Windows 런처 환경·실제 훅 2케이스 통과 |
| AC4 | ✅ | fixture alias·실제 spawn file/env |
| AC5 | ✅ | porcelain 동치·stream·1/2/3회 |
| AC6 | ✅ | append OID·부모·1/2회 |
| AC7 | ✅ | J1~9·자동 afterEach/afterAll/allowance 중첩 Vitest |
| AC8 | ✅ | 이름 git async/sync 위반 |
| AC9 | ✅ | 공유7·CLI122·M05/06·S05 |
| AC10 | ✅ | 읽기3·M07/08 |
| AC11 | ✅ | origin 통합·M09/10 |
| AC12 | ✅ | 829/377 및 파일4 상한 |
| AC13 | ⚠ 대기 | 전체 기존 case ID·상태 비교 및 Windows CI |
| AC14 | ✅ | 고정 설정6키·init파일2·경고0 |
| AC15 | ✅ | naming8·production prepare4회 |
| AC16 | ✅ | hostile M11 red |
| AC17 | ✅ | budget·pool·unit guard·fixture 규칙 |
| AC18 | ⚠ 사람 실기 | 폐쇄망 전후 각2회 |

**검산: ✅16 + ⚠2 + ❌0 = AC18개.** 최종 기계 gate를 확인한 뒤 합계를 갱신한다. AC18은 관측 없이 ✅로 바꾸지 않는다.

## [구현자 기입] Review Signals — 사실만

- r1 구현이며 독립 verify는 아직 없다. 규범 정정3건을 구현 커밋과 분리했다.
- 기존 변이120개 red·CI 수정 후121개 재실행 중, 초회 B11 누락1개를 잠금 추가 후 재실행했다. 실패를 숨기거나 테스트를 삭제하지 않았다.
- 기존 Linux 전체 기준선은 8,593케이스·22실패·9skip였다. ABI 복구 전 결과는 비교 기준으로 쓰지 않는다.
- 수정·신규 테스트 소스 31파일(스크립트 3·Vitest/fixture 28)을 개별 판정했다. 실-Git 예산20파일·자식 timeout·추적/정리·호스트 격리·풀 분류·중복 config 규칙 위반0. Node 전체826케이스에서 소스 가드도 통과했다.
- 최종 Vitest·Windows CI 결과 확인 중. 폐쇄망 시간만 사람 실기로 남는다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
