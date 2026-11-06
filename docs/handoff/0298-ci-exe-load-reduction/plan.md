# Plan — 0298-ci-exe-load-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0298-ci-exe-load-reduction` |
| 작성자 | Claude Code |
| 일자 | 2026-11-06 |
| 매핑 | 비기능(테스트 인프라) — Claude 설계·구현 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `ΔV1` — 구현 중 발견 정정(§7-B). V1 행은 유지, EP-1·EP-3 규칙 칸만 ΔV1이 대체 |
| 유효 V | `V1 + ΔV1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 문제: self-hosted Windows 러너에서 `npm test`가 0259 시점 5~7분 → 지금 1/6 진행에 36분. 원인은 Windows CI 전역 직렬화(`maxWorkers: 1`, `e7645433`)와 테스트 파일마다 뜨는 vitest 워커 `node` 프로세스다.
- 완료 후: SQLite·git·자식 프로세스를 쓰는 테스트(io)만 프로세스 격리·Windows CI 직렬로 돌고, 나머지(unit)는 프로세스를 띄우지 않고 스레드로 병렬 실행된다. 테스트 git의 저장소별 `git config`와 커밋마다 뜨는 `git maintenance` 하위 프로세스가 사라진다.
- 한 문장: 같은 테스트가 같은 결과를 내면서 CI의 exe 실행 수가 0259 이하로 내려간다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Exe 작업(git, 파일 작업, 기타 윈도우 애플리케이션 호출)을 분류하고 … 이전의 호출수만큼으로 줄일 수 있는 방법을 찾아라" | 라이브 세션 1턴 |
| 명시 요구 | "간접호출을 통한 exe 작업도 모두 포함해야 한다" | 라이브 세션 2턴 |
| 명시 요구 | "Self hosted로 실행중임. 별도 ci runner가 있음" · "a+b 진행." · "runner 환경에서 pwsh이 아닌 powershell을 쓰도록 해야겠다" + `spawn pwsh.exe ENOENT` | 라이브 세션 3턴 |
| 추론 의도 | A = 진단 답변의 "vitest io/unit 2-프로젝트 분리", B = "격리 전역 git 설정 + 저장소별 `git config` 제거" 그대로 | 3턴의 "a+b"가 직전 답변 표의 안 A·B를 가리킴 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | unit(io 외) 테스트는 `threads` 풀, io 테스트는 `forks` 풀로 나눈다 | 파일당 `node` 워커 프로세스 제거(안 A) | 3턴 "a+b 진행" | ACTIVE | — |
| D-002 | Windows + `CI=true` 직렬화는 io 프로젝트에만 둔다. unit은 병렬 | "self hosted로 실행중"(CI=true) — 직렬 대상을 디스크 경합 원인(SQLite·git)으로 좁힘 | 3턴 · `vitest.config.ts:10-13` 주석 | ACTIVE | — |
| D-003 | 격리 전역 git 설정(`GIT_CONFIG_GLOBAL`)에 `user.name=orca test` · `user.email=test@orca.local` · `core.autocrlf=false` · `maintenance.auto=false`를 쓰고, 테스트의 저장소별 신원·autocrlf `git config` 호출을 지운다 | 안 B. 신원 값은 유일한 작성자 단언 `git-diff.test.ts:417`(`'orca test'`)에 맞춤 | 3턴 "a+b" | ACTIVE | 0294 AC11 "빈 전역 설정" 단언을 대체(§16) |
| D-004 | Windows 잠금 테스트는 `pwsh.exe` 대신 Windows PowerShell(`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`)을 띄운다 | "runner 환경에서 pwsh이 아닌 powershell을 쓰도록" — 러너에 pwsh 없음 | 3턴 | ACTIVE | — |
| D-005 | 안 C(중첩 vitest hostile 분리)·D(`node --test` 격리 해제)는 하지 않는다 | 사용자가 "a+b"만 승인 | 3턴 | ACTIVE | — |
| D-006 | unit 워커 스레드에서 `os.homedir()`을 스레드 env 사본(`HOME`/win32 `USERPROFILE`)에 맞춘다 | 스레드의 `process.env`는 사본이라 libuv `os.homedir()`이 실제 홈을 읽는다 — 0294 파일별 홈 격리 유지(AC9) | 구현 중 재현(§7-B) | ACTIVE | — |
| D-007 | unit 가드는 throw와 함께 위반을 기록하고, setup의 `afterEach`·`afterAll`이 기록으로 red를 만든다 | production `runGit`이 throw를 결과로 삼켜 조용히 통과했다(fail-closed 아님) | 구현 중 재현(§7-B) | ACTIVE | — |

### 갱신 메모

- 새 결정: D-001~D-005(이번 handoff 최초 설계).
- 변경된 결정: 없음. 0294의 "git 은 빈 전역 설정" 단언만 D-003으로 대체(§16).
- `ACTIVE 결정 ↔ AC` 대조: D-001 ↔ AC1·AC2·AC3 · D-002 ↔ AC4 · D-003 ↔ AC5·AC6 · D-004 ↔ AC7 · D-005 ↔ 비범위(§6) — 충돌 0.
- ΔV1 추가: D-006 ↔ AC9(격리 유지) · D-007 ↔ AC3(가드 fail-closed) — 충돌 0.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 | 직렬화만 바뀐 커밋에서 Windows Test 3:44 → 7:20(run 38983034999 → 38984772497) · 워커 `node` 659 → 918(strace) |
| 이미 충족됐는가 | 아니오 | `vitest.config.ts:13` 전역 `maxWorkers: 1` · 저장소별 `git config` 36줄(§8) |
| 더 작은 해법 | 직렬화 해제만으로는 워커 프로세스 수가 그대로다 | 워커 `node`가 exe 실행의 37%(918/2,464) |
| 선행 자료 대조 | 0262 직렬화 이유 = "닫힌 DB의 정리 훅도 제한을 넘겼으므로" → io(SQLite·git)는 직렬 유지 | `vitest.config.ts:10-12` |
| 기존 결정 충돌 | 0294 AC11 빈 전역 설정 단언 → D-003이 대체. 호스트 격리(홈·XDG·변수 제거)는 유지 | `test-environment.test.ts:58-64` |

- 사용자에게 올릴 결정: 없음(3턴에서 A·B·powershell 확정).
- 코드 조사로 닫은 사실: threads 비호환 3파일(§8), 작성자 단언 1곳, pwsh 사용처 1곳.

## 5. 동작 / 사용자 흐름

```text
npm test (pretest → vitest run → node --test)
  → vitest.config: 테스트 소스를 io/unit 으로 분류
  → [group 0] unit 프로젝트 — threads 병렬, 자식 프로세스·SQLite 로드 시도 시 즉시 실패
  → [group 1] io 프로젝트 — forks, Windows+CI 는 직렬
  → 같은 테스트 결과 + 적은 exe 실행
  ↘ unit 으로 분류된 파일이 exe/SQLite 를 쓰면: 그 테스트가 분류 안내 메시지로 red
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 운영자/개발자에게 보이는 결과 |
|---|---|---|
| Windows + CI=true | io만 `maxWorkers: 1`, unit 병렬 | io 파일만 순차 진행 |
| 그 외 환경 | 두 프로젝트 모두 기본 병렬 | 로컬 병렬 유지 |
| unit 파일이 자식 프로세스·SQLite를 씀 | 가드가 throw | `[test-pools] …` 메시지와 함께 red |
| 테스트 git commit | 격리 신원으로 커밋, maintenance 하위 프로세스 없음 | 저장소별 설정 없이 커밋 성공 |
| Windows 잠금 테스트 | `powershell.exe`로 잠금 helper 실행 | pwsh 없는 러너에서도 통과 |

### 파생 UX / 엣지케이스

- 단일 파일 실행(`vitest run <file>`): 그 파일이 속한 프로젝트에서만 돈다.
- 중첩 vitest(hostile·test-time 스크립트 테스트): 같은 설정을 읽어 같은 분류를 쓴다.
- 폐쇄망: 동작 변화 없음(네트워크 무관).

## 6. 범위 / 비범위

- **범위**: vitest 프로젝트 분리 + 분류 SSOT + unit 런타임 가드 · 격리 git 설정 내용 · 테스트의 저장소별 신원/autocrlf `git config` 제거 · 잠금 테스트 PowerShell 교체 · `app/AGENTS.md` 작업 규칙.
- **비범위**: 안 C·D(D-005) · Git for Windows 런처·conhost 등 Windows 전용 multiplier 측정 · 워크플로 `shell:` 지정(테스트가 띄우는 실행 파일만 범위 — §17).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| hostile 중첩 vitest 분리(안 C) | 아니오 | 후속(사용자 결정 필요) |
| Windows 프로세스 생성 수 실측 | 아니오 | 후속 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | vitest 실행에서 워커 `node` 프로세스 수 = io 파일 수 (unit은 프로세스 0) | ST 측정: strace execve 집계(§19) | `npm test` → vitest.config → projects |
| R-01 | AT-01 / AC2 | 자식 프로세스 import·git 픽스처·`runGit`·SQLite·`process.env.TZ`·강제 목록 중 하나라도 있는 파일은 io, 없으면 unit | UT `test-pools.test.mjs` 분기별 입력 | `classifyTestSource` |
| R-01 | AT-01 / AC3 | unit 풀에서 자식 프로세스 생성(async·sync 4형태)·better-sqlite3 네이티브 로드는 안내 메시지로 throw | UT(worker thread) + IT(unit 풀 실제 파일) | `vitest-unit-guard.mjs` |
| R-01 | AT-01 / AC4 | Windows+`CI=true`면 io만 `maxWorkers: 1`, unit은 미지정. 그 외는 둘 다 미지정. unit group 0 → io group 1 | UT `buildProjects` 3환경 | `vitest.config.ts` |
| R-02 | AT-02 / AC5 | 격리 전역 설정 아래 새 저장소에서 `user.name`=`orca test`, `user.email`=`test@orca.local`, `core.autocrlf`=`false`이고, `git commit`이 `git maintenance`를 띄우지 않는다 | IT 실 git(`GIT_TRACE` stderr에 maintenance 없음) | `vitest-setup` → `GIT_CONFIG_GLOBAL` → git |
| R-02 | AT-02 / AC6 | 테스트 소스에 저장소별 신원·autocrlf `git config` 호출이 없고, 그 파일들의 커밋 테스트가 통과한다 | 음성 스캔 UT + 기존 실-git 스위트 green | 테스트 → git commit |
| R-03 | AT-03 / AC7 | Windows 잠금 테스트가 Windows PowerShell로 실행되고 pwsh 없는 러너에서 통과한다 | Windows CI + 사람 실기(self-hosted) · 음성 `rg pwsh` 0 | `file-mutation.test.ts` |
| R-04 | AT-04 / AC8 | Linux 실패 집합이 기준선(9파일 22건, Windows 경로)과 같고 Windows CI gate가 green | gate 실행 비교 | `npm test` |
| R-04 | AT-04 / AC9 | 0294 호스트 격리(홈·XDG·변수 제거·hostile 대표 테스트)가 유지된다 | `test-environment*.test.ts` green | vitest-setup |
| R-01·02 | AT-05 / AC10 | npm test exe 실행 수(Linux strace, vitest+`node --test`)가 0259 기준(2,420) 이하 | ST 측정(§19) | `npm test` |

### AC 검증 주의사항

- 사람 실기 항목: AC7의 self-hosted 러너 통과만(실제 외부환경). 경로 선택 로직은 Windows CI도 실행한다.
- 총량 기준(AC1·AC10): 측정 명령·집계식은 §19. 기준선 0259 = 2,420, 변경 전 HEAD = 2,464(이번 세션 strace).

## 7-A. V / Trace Matrix

- V mode: Baseline V (상속 V 없음). 변경 시작 수준: 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance |
|---|---|---|---|
| R-01·AT-01 | R/AT | §7 AC1~AC4 | NEW |
| R-02·AT-02 | R/AT | §7 AC5·AC6 | NEW |
| R-03·AT-03 | R/AT | §7 AC7 | NEW |
| R-04·AT-04 | R/AT | §7 AC8·AC9 | NEW |
| SD-01·ST-01 | SD/ST | §9 npm test 수명주기(분류 → group 0 unit → group 1 io), AC1·AC10 | NEW |
| AR-01·IT-01 | AR/IT | §9 test-pools ↔ vitest.config ↔ unit 가드 배선 | NEW |
| AR-02·IT-02 | AR/IT | §9 test-host 설정 내용 ↔ vitest-setup 기록 ↔ git 자식 | NEW |
| MD-01·UT-01 | MD/UT | §10 EP-1 분류 규칙 | NEW |
| MD-02·UT-02 | MD/UT | §10 EP-2 프로젝트 필드 | NEW |
| MD-03·UT-03 | MD/UT | §10 EP-3 가드 자리 | NEW |
| MD-04·UT-04 | MD/UT | §10 EP-4 설정 키 | NEW |

### Pair registry

| Pair | left ↔ right | req | production path | 직접 oracle (자리별 좌표) | 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | MD-01 ↔ UT-01 | REQUIRED | 소스 → `stripComments` → 규칙 6개 → pool | 신규 `scripts/test-pools.test.mjs` — 규칙마다 해당 신호 하나만 든 입력 → `io`+사유 · 신호 없음 → `unit` · 주석 안 신호 → `unit` · `runGit`+`execFileImpl` → `unit` | not selected — 분기별 직접 입력 | EP-1 (6) |
| VP-02 | MD-02 ↔ UT-02 | REQUIRED | `buildProjects({platform,ci,io})` → 두 프로젝트 | 같은 파일 — (win32,ci) → io.maxWorkers 1·unit 미지정 / (linux,ci) · (win32,비ci) → 둘 다 미지정 / pool·groupOrder·setupFiles 값 단언 | not selected | EP-2 (6) |
| VP-03 | MD-03 ↔ UT-03 | REQUIRED | `installUnitGuard()` → 4 spawn 형태·dlopen | 같은 파일 — worker thread에서 설치 후 `spawn`·`spawnSync`·`execFileSync`·`execSync` 각각 throw(메시지 `[test-pools]`) · `better_sqlite3.node` dlopen throw · 다른 `.node`/설치 전은 통과 | not selected | EP-3 (5) |
| VP-04 | MD-04 ↔ UT-04 | REQUIRED | `HERMETIC_GIT_CONFIG` 문자열 | `scripts/test-host.test.mjs` — 4키 값 단언 | not selected | EP-4 (4) |
| VP-05 | AR-01 ↔ IT-01 | REQUIRED | vitest.config → unit 프로젝트(threads+가드) / io 프로젝트(forks) | 신규 `src/main/infra/test-pools.test.ts`(unit) — `isMainThread===false` · 가드 심볼 · `process.getBuiltinModule('node:child_process').spawnSync` throw / `test-environment.test.ts`(io) — `isMainThread===true` | not selected | EP-2 (6) |
| VP-06 | AR-02 ↔ IT-02 | REQUIRED | `vitest-setup` 기록 → `GIT_CONFIG_GLOBAL` → git | 신규 `src/main/infra/git/hermetic-config.test.ts` — 임시 저장소 `git config --get` 3키 · `GIT_TRACE=1 git commit` stderr에 `maintenance` 없음 / `test-environment.test.ts` — 파일 내용 = `HERMETIC_GIT_CONFIG` | required — 4키 중 하나를 지우면 해당 단언 red(구조 proxy 아님 확인) | EP-4 (5) |
| VP-07 | SD-01 ↔ ST-01 | REQUIRED | `npm test` → 분류 → group 0 → group 1 → `node --test` | `gate:` §19 strace 집계 — 워커 node = io 파일 수 · 신원/autocrlf config 0 · maintenance 0 · 총계 ≤ 2,420 | not selected | 0 — 측정 pair |
| VP-08 | R-02 ↔ AT-02 | REQUIRED | 테스트 → 저장소 생성 → commit | `gate: rg` §10 EP-5 → 0 · 실-git 16파일 green | not selected | EP-5 (36 → 0) |
| VP-09 | R-03 ↔ AT-03 | REQUIRED | 잠금 테스트 → `powershell.exe` → FileShare.None | Windows CI `file-mutation.test.ts:'waits for an actual Windows FileShare.None handle to be released'` · 사람 실기 | not selected | EP-6 (1) |
| VP-10 | R-04 ↔ AT-04 | REQUIRED | `npm test` 전체 | Linux 실패 집합 비교(기준선 9파일 22건) · Windows CI · `test-environment*.test.ts` | not selected | 0 — 회귀 pair |
| VP-11 | R-01 ↔ AT-01 | REQUIRED | AC1~AC4 | VP-01·02·03·05·07 좌표 합 | not selected | EP-1~3 |

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 명령 | 실패 범위 |
|---|---|---|---|
| app lint·typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 변경 유발분 |
| test-budgets guard | 새 실-git 스위트·테스트 소스 | `node scripts/check-test-budgets.mjs` | 변경 유발분 |
| doc-inventory guard | 문서·스크립트 추가 | `node scripts/check-doc-inventory.mjs --check` | 변경 유발분 |
| npm test | 테스트 인프라 자체 변경 | `npm test` (Linux 기준선 실패 9파일 분리) | AC8 |
| trailer | 커밋 프로토콜 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

## 7-B. ΔV1 — 구현 중 발견 정정 (2026-11-06)

출처는 전부 구현 중 재현이다(같은 에이전트, 규범 정정은 별도 커밋). V1 노드는 유지하고 아래 행만 더하거나 대체한다.

| 발견 | 재현 | 정정 |
|---|---|---|
| 스레드에서 홈 격리 붕괴 | 전체 실행에서 `test-environment.hostile.test.ts` red — 합성 홈 6항목 → 9항목 · `node -e` 실험: 워커가 `process.env.HOME`을 바꿔도 `os.homedir()`은 프로세스 값 | D-006 · EP-7 신설 · VP-12 신설 |
| 가드 throw를 production이 삼킴 | `send.agent-profile.test.ts`가 unit에서 green(git 16회 시도) | D-007 · EP-3 규칙 칸 대체(기록 + 훅 red) · VP-03 oracle에 `it.fails` 추가 |
| 신호 없이 git을 띄우는 파일 | 위 파일 — production `handleChatSend`가 작업 폴더 git 조회 | EP-1 `forced` 목록에 1건 추가 |
| SQLite 진입점 누락 | 가드가 4파일 red(`last-model`·`mail/store/migrate`·`mail/mime`·`mail.integration`) — `openFileDatabase`·`warmFileSqlite` 사용 | EP-1 `sqlite` 규칙 칸 대체 |
| 설정 예산 검사가 단일 프로젝트 전제 | `scripts/test-time.test.mjs` 'vitest.config.ts 배선' red | VP-02 oracle에 프로젝트별 예산 단언 추가 |

### ΔV1 Pair · §10

| Pair | left ↔ right | req | path | 직접 oracle | §10 |
|---|---|---|---|---|---|
| VP-12 | MD-05 ↔ UT-05 (NEW — 스레드 홈 정렬) | REQUIRED | unit setup → `alignThreadHomedir` → `os.homedir` | `scripts/test-pools.test.mjs` 'alignThreadHomedir' 2입력(맞춤 → 스레드 값 / 안 맞춤 → 프로세스 값) · `src/main/infra/test-pools.test.ts` 'os.homedir() 는 setup 이 이 파일에 준 홈이다' · `test-environment.hostile.test.ts` | EP-7 (2) |

| pair | 계약 | 언제 강제 (자리) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|
| VP-01 (ΔV1 대체) | `sqlite` 규칙 칸 | 드라이버 import · `openDb(` · `openFileDatabase(` · `initDb(` · `warmFileSqlite` · `new Database(` (6 분기) | `rg -n "const SQLITE" -A1 app/scripts/test-pools.mjs` | 분기 하나가 빠지면 그 진입점 파일이 unit → 가드 red |
| VP-01 (ΔV1 추가) | `forced` 목록 | `send.agent-profile.test.ts` · `loopback-callback.test.ts` (2) | `rg -n "test.ts':" app/scripts/test-pools.mjs` | 빠지면 그 파일이 unit에서 red |
| VP-03 (ΔV1 대체) | 가드 판정 | V1 5자리 + 위반 기록(`state.violations.push`) + setup 훅(`afterEach`·`afterAll`) = 8 | `rg -n "violations.push\|afterEach(check)\|afterAll(check)" app/scripts` | 기록·훅이 빠지면 삼킨 throw가 조용히 통과 |
| VP-12 | 스레드 홈 정렬 | `alignThreadHomedir` 본체 · `vitest-unit-guard.mjs` 호출 (2) | `rg -n "alignThreadHomedir" app/scripts/test-pools.mjs app/scripts/vitest-unit-guard.mjs` | unit 파일이 실제 홈에 쓴다(0294 회귀) |

- 규칙 칸 ↔ 입력 칸: `sqlite` 6분기마다 `test-pools.test.mjs` 입력 1개. 가드 기록·훅은 `test-pools.test.ts` 2케이스(비운 위반 · `it.fails`). 홈 정렬 2입력.
- 선언 경계 추가: 스레드에서 `os.homedir` 외에 프로세스 환경을 읽는 경로(네이티브 애드온의 `getenv`)는 맞추지 않는다 — unit 가드가 네이티브 SQLite만 허용 목록 없이 막고, 그 밖의 네이티브 로드는 현재 트리 unit 실행에서 0건(가드 dlopen 관측).
- 신호 정본 이동: `FIXTURE`·`SPAWN_GIT`·`RUN_GIT`·`INJECTS_RUNNER`·`stripComments`·`isRealGitSuite`를 `app/scripts/test-source.mjs`로 옮기고 `check-test-budgets.mjs`가 import·재수출한다(§11 추가, 동작 불변 — `check-test-budgets.test.mjs` 641건).

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 전역 직렬화 | `app/vitest.config.ts:13` `maxWorkers: win32 && CI ? 1 : undefined` |
| vitest 4 forks+isolate = 파일당 프로세스 1 | strace: 0259 워커 659 = 파일 659 · HEAD 918 = 918 |
| 프로젝트별 `pool`·`maxWorkers`·`sequence.groupOrder` 지원 | `node_modules/vitest/dist/chunks/reporters.d.DtoKVV2s.d.ts` `NonProjectOptions`에 없음 · `groupOrder` 2626행 |
| threads 비호환 3파일 | `--pool=threads` 실행: `gate/daily.test.ts`(TZ) · `loopback-callback.test.ts`(EADDRINUSE) · `test-environment.test.ts`(자식 env) |
| 격리 git 설정은 빈 파일 | `scripts/vitest-setup.mjs:27` `writeFileSync(set.GIT_CONFIG_GLOBAL, '')` |
| 작성자 단언 유일 | `git-diff.test.ts:417` `'orca test'` (`rg "%an|author"` 결과 1) |
| `git commit` → `git maintenance run --auto` 자식 | strace 하위 git 248 중 137 · `maintenance.auto=false`로 커밋 2회 execve 7 → 5 |
| 잠금 테스트만 pwsh | `rg -i pwsh app/src` → `file-mutation.test.ts:185` 1건 · 파일 신호 방식(`:229` 주석) |
| better-sqlite3 네이티브는 생성자에서 지연 로드 | `node_modules/better-sqlite3/lib/database.js` `DEFAULT_ADDON` |

### 전수 조사

| 대상 | 검색 | N | 의미 |
|---|---|---:|---|
| 저장소별 신원 config | `rg -n "'config', '(user\.email\|user\.name)'" app/src` | 32 (16파일) | EP-5 삭제 대상 |
| 저장소별 autocrlf config | `rg -n "'config', 'core\.autocrlf'" app/src` | 4 | EP-5 삭제 대상 |
| 자식 프로세스 spawn 파일(런타임) | strace 워커 귀속 | 19 | 정적 분류가 전부 io여야 함 |
| SQLite 사용 파일 | `rg -l "better-sqlite3\|openDb\(\|new Database\(" app/src --glob '*.test.ts'` | 42 | io |
| TZ 변경 파일 | `rg -l "process\.env\.TZ" app/src --glob '*.test.ts'` | 1 | io(TZ 규칙) |

### 수치 검산

- npm test exe(Linux strace): 0259 2,401+19 = 2,420 · HEAD 2,435+29 = 2,464.
- HEAD 내역: 워커 918 + 중첩 45 + git 직접 1,203 + git 간접 246 + helper 6 + 테스트 node 1 + 실행기 16 + node --test 29 = 2,464.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
vitest.config.ts — 단일 프로젝트, pool forks(기본), win32+CI → maxWorkers 1
  → 918 파일 × node 프로세스 1 → vitest-setup(빈 GIT_CONFIG_GLOBAL)
  → 실-git 테스트: init → config user.email/name(+autocrlf) → commit → git maintenance 자식
```

### TO-BE

```text
vitest.config.ts → scripts/test-pools.mjs
  partitionTestFiles(appDir) → { io, unit }      (classifyTestSource 규칙 6개)
  buildProjects({ platform, ci, io }) →
    unit: threads · setupFiles [vitest-setup, vitest-unit-guard] · groupOrder 0
    io:   forks · maxWorkers (win32&&ci ? 1 : undefined) · groupOrder 1
vitest-setup → GIT_CONFIG_GLOBAL ← HERMETIC_GIT_CONFIG (test-host.mjs)
  → 실-git 테스트: init → commit (설정 호출·maintenance 자식 없음)
```

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | V 연결 |
|---|---|---|---|
| 풀 | 전부 forks | io forks / unit threads | VP-02·05 |
| 직렬화 | 전체 | io만 | VP-02 |
| 분류 | 없음 | `test-pools.mjs` SSOT + 런타임 가드(fail-closed) | VP-01·03 |
| git 설정 | 빈 전역 + 저장소별 config | 고정 전역 4키 | VP-04·06·08 |
| 잠금 helper | pwsh.exe | Windows PowerShell 절대 경로 | VP-09 |

### 핵심 책임 분리

| 모듈 | 책임 | 호출자 |
|---|---|---|
| `scripts/test-pools.mjs` | 순수: 소스 분류·파일 분할·프로젝트 필드 | `vitest.config.ts` · `test-pools.test.mjs` |
| `scripts/vitest-unit-guard.mjs` | unit 풀 setup: `installUnitGuard()` 호출 | vitest unit 프로젝트 |
| `scripts/test-host.mjs` | `HERMETIC_GIT_CONFIG` 상수 | `vitest-setup.mjs` · 테스트 |

## 10. 계약 / 타입 / 강제 지점

| pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|
| VP-01 | io 규칙 | `test-pools.mjs` `IO_RULES` | 6: `child-process` · `git-fixture` · `run-git` · `sqlite` · `timezone` · `forced` | `rg -n "id: '" app/scripts/test-pools.mjs` → 6 | 규칙 하나가 빠지면 그 신호 파일이 unit → 가드 red 또는 디스크 경합 |
| VP-02·05 | 프로젝트 필드 | `buildProjects` | 6: unit.pool · unit.setupFiles(가드) · unit.groupOrder · io.pool · io.maxWorkers · io.groupOrder | `rg -n "pool:\|maxWorkers:\|groupOrder:\|setupFiles:" app/scripts/test-pools.mjs` | 직렬화가 unit에 걸리거나 io가 병렬 |
| VP-03 | 가드 자리 | `installUnitGuard` | 5: `ChildProcess.prototype.spawn` · `spawnSync` · `execFileSync` · `execSync` · `process.dlopen` | `rg -n "prototype.spawn\|'spawnSync'\|'execFileSync'\|'execSync'\|dlopen" app/scripts/test-pools.mjs` | 그 형태로 unit에서 exe·SQLite가 조용히 실행 |
| VP-04·06 | 설정 키 | `HERMETIC_GIT_CONFIG` | 4 키 + 기록 1(`vitest-setup.mjs` writeFileSync) | `rg -n "HERMETIC_GIT_CONFIG" app/scripts` | 키가 빠지면 신원 없는 commit 실패·maintenance 자식 부활 |
| VP-08 | 저장소별 config 제거 | 테스트 소스 | 36 → 0 (§8 전수) | `rg -n "'config', '(user\.email\|user\.name\|core\.autocrlf)'" app/src` → 0 | exe 감소 미달(기능 영향 없음) |
| VP-09 | PowerShell 경로 | `file-mutation.test.ts` | 1 | `rg -n -i "pwsh\|powershell" app/src/main/infra/config/file-mutation.test.ts` | pwsh 없는 러너에서 ENOENT |

- **선언 경계**: 정적 분류는 주석 제거 후 문자열 신호다. 신호 없이 exe·SQLite를 쓰는 파일은 런타임 가드가 red로 막는다(fail-closed). 프로세스 전역 상태(TZ 외 `chdir`·고정 포트 재사용 등)에 기대는 새 형태는 threads에서 red로 드러나 `forced` 목록에 올린다 — 현재 트리 실측 3파일 외 0(`--pool=threads` 실행).
- 열린 입력 집합: 분류는 fail-closed(런타임 가드)로 설계한다.
- SSOT: 분류·프로젝트 필드·가드 = `test-pools.mjs` 하나. 설정 내용 = `test-host.mjs` 하나.

## 11. 구현 설계

| 파일 | 변경 | 테스트 seam |
|---|---|---|
| `app/scripts/test-pools.mjs` | 신규 — `IO_RULES`·`classifyTestSource`·`partitionTestFiles`·`buildProjects`·`installUnitGuard` | node --test |
| `app/scripts/test-pools.test.mjs` | 신규 — VP-01·02·03 + EP-5 음성 스캔 | node --test |
| `app/scripts/vitest-unit-guard.mjs` | 신규 — `installUnitGuard()` | VP-05 |
| `app/vitest.config.ts` | projects 2개로 교체 | VP-05·07 |
| `app/scripts/test-host.mjs`·`vitest-setup.mjs`·`test-host.test.mjs` | `HERMETIC_GIT_CONFIG` 추가·기록·단언 | VP-04 |
| `app/src/main/infra/git/hermetic-config.test.ts` | 신규 실-git IT(예산·`removeTempRoots`·`FIXTURE_GIT_TIMEOUT_MS`) | VP-06 |
| `app/src/main/infra/test-pools.test.ts` | 신규 unit 배선 IT | VP-05 |
| `app/src/main/infra/test-environment.test.ts` | 빈 설정 단언 → 내용 단언 · `isMainThread` | VP-05·06 |
| 실-git 16파일 | 신원·autocrlf config 줄과 그 주석 삭제 | VP-08 |
| `file-mutation.test.ts` | Windows PowerShell 절대 경로 + 주석 | VP-09 |
| `app/AGENTS.md` | test-pools 규칙 · 격리 git 설정 내용 | — |

## 12~15. End-to-end · Lifecycle · 성능 · 외부 포트

- producer/consumer: 분류(producer) → vitest projects(consumer). 중첩 vitest도 같은 설정을 읽는다.
- lifecycle: 가드는 unit 워커 스레드마다 setup에서 설치, 스레드 종료로 소멸. 다중 저장소 쓰기 해당 없음.
- 성능: 설정 로드 시 테스트 소스 전수 읽기 1회(918파일). 기대 exe: 워커 −856, git 설정 −221, maintenance −136.
- 외부 포트: 해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 결과 |
|---|---|---|
| Windows CI 전역 직렬화 | 0262 `e7645433` | 변경 — io로 좁힘(D-002) |
| 격리 git "빈 전역 설정" 단언 | 0294 AC11 · `test-environment.test.ts:58` | 변경 — 고정 4키(D-003). 호스트 설정 차단은 유지 |
| 잠금 helper pwsh | 0282 `cadca074` | 변경 — 파일 신호 유지, 실행 파일만 교체(D-004) |
| 실-git 예산 (A)~(H′) | `check-test-budgets.mjs` | 유지 — 새 실-git 파일도 준수 |

## 17. 리스크

| 리스크 | 완화 |
|---|---|
| threads에서만 드러나는 새 비호환 | 런타임 red → `forced` 목록 |
| io·unit 동시 실행 경합 | groupOrder로 순차(unit → io) |
| Windows PowerShell 5.1 기동 지연 | 준비 대기 `scaleMs(30_000)` 유지 |

- 신규 의존성: 없음.

## 18. 영향 받는 파일

§11 표.

## 19. 게이트

- 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 정적: `npm run lint && npm run typecheck` · 가드 3종.
- 테스트: `npm test`(DB 포함 — 테스트 인프라 변경이라 의도적 실행).
- **ST 측정(AC1·AC10)**: `CI=true strace -f -qq --seccomp-bpf -s 400 -e trace=execve,clone,clone3,fork,vfork -e signal=none -o <out> -- npm test` 후 성공 execve(`=\s+0$` 및 `execve resumed>… = 0`)를 센다. 워커 수 = `--experimental-import-meta-resolve` 인자를 가진 성공 execve. vitest가 실패하면 `node --test scripts/*.test.mjs`를 같은 방식으로 따로 센다.
- 사람 실기: AC7 self-hosted 러너.

## READY self-review

- Decision Ledger: D-001~005 ACTIVE, 대조 충돌 0(§3).
- AS-IS/TO-BE/Delta 동일 축(§9). Delta 각 행 → §11 파일.
- 수치(§8)는 이번 세션 strace·rg 재측정.
- 모든 NEW node에 REQUIRED pair(VP-01~11). 규칙 칸 분기 ↔ 입력: EP-1 6규칙 + 무신호·주석·주입 3입력, EP-2 3환경, EP-3 5형태 + 통과 2입력.
- 선언 경계·fail-closed 명시(§10). 후보 표 겹침 0(`rg` 결과 없음).
- 사람 실기는 외부환경(AC7)뿐.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: V1 A·B·PowerShell 경로 그대로.
- 이견 / 현실성 문제: V1 §10 EP-3(throw만)·EP-1 sqlite 3분기·forced 1건은 실제 트리에서 부족했다 → 구현 중 재현 후 ΔV1(`1972b165` 설계 커밋)로 정정.
- ACTIVE Decision과 충돌하는 설계 발견: V1 TO-BE의 threads 풀이 0294 파일별 홈 격리를 깬다(D-006으로 해소).

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 | io 규칙 | 6 규칙 + sqlite 6분기 + forced 2 (ΔV1) | 14/14 | `rg -n "id: '" scripts/test-pools.mjs` → 6 · `scripts/test-pools.test.mjs` 'classifyTestSource — 규칙마다…'(13입력)·'FORCED_IO 는 실측한 파일 목록 그대로다' | 규칙마다 그 신호 하나만 든 소스 → `{io,[id]}` · 무신호·주석·`execFileImpl`·`getBuiltinModule` → unit | — |
| VP-02·05 | 프로젝트 필드 | 6 | 6/6 | `rg -n "pool:\|maxWorkers:\|groupOrder:\|setupFiles:" scripts/test-pools.mjs` → 6 · 'buildProjects — 환경별 필드' 4환경 · `test-pools.test.ts` `isMainThread===false` · `test-environment.test.ts` '풀 배선 (0298)' | (win32,'true') → io 1 / (linux,'true')·(win32,undef)·(win32,'false') → undef | — |
| VP-03 | 가드 | 8 (ΔV1) | 8/8 | 'installUnitGuard — 워커 스레드에서 실제 모듈로' 3케이스 · `test-pools.test.ts` 2케이스(+`it.fails`) · 'afterAll 에서 삼킨 자식 프로세스 시도' | 5형태 각각 throw 메시지 · 다른 `.node` 통과 · 삼킨 위반 → 테스트/파일 red | — |
| VP-04·06 | 설정 키 | 4 + 기록 1 | 5/5 | `rg -n HERMETIC_GIT_CONFIG scripts` · `test-host.test.mjs` '격리 전역 git 설정 내용' · `hermetic-config.test.ts` 2케이스 · `test-environment.test.ts` 내용 단언 | 키별 `git config --get` 값 · `GIT_TRACE` stderr에 maintenance 없음(추적 켜짐 확인) | — |
| VP-08 | 저장소별 config | 36 → 0 | 36/36 | `rg -n "'config', '(user\.email\|user\.name\|core\.autocrlf)'" src` → 0 · `test-pools.test.mjs` 음성 스캔 · 실-git 17스위트 green | 삭제 32+4줄 | — |
| VP-09 | PowerShell 경로 | 1 | 0/1 | `rg -n -i pwsh src` → 주석 1건만 | — | Linux `it.skipIf` — Windows CI·self-hosted 실기 대기 |
| VP-12 | 스레드 홈 정렬 | 2 | 2/2 | 'alignThreadHomedir' 2입력 · `test-pools.test.ts` 'os.homedir() 는 setup 이 이 파일에 준 홈이다' · `test-environment.hostile.test.ts` green | 스레드 env `-thread` 값 → 반환 / 정렬 없으면 프로세스 값 | — |

- §10 자리 목록 밖에서 본 운반 자리: `test-time.test.mjs`의 설정 예산 읽기(단일 프로젝트 전제) — 이행 범위(설정 변경의 직접 소비자), 프로젝트별 단언으로 선조치.
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01·02·03·04·05·08·11·12 | REQUIRED | SELF_PASS | 위 표 | not selected |
| VP-06 | REQUIRED | SELF_PASS | `hermetic-config.test.ts` | required — 4키 각각 제거 → red(EP4-*) |
| VP-07 | REQUIRED | SELF_PASS | `gate:` strace(아래 구현 보고) | not selected |
| VP-09 | REQUIRED | SELF_BLOCKED | Windows CI | Linux 실행 불가 |
| VP-10 | REQUIRED | SELF_PASS (Linux) | 실패 집합 = 기준선 9파일 22건 | Windows CI 대기 |

## [구현자 기입] 이번 라운드 수정의 잠금

하네스 `mutate.py` spec 38행 — 전부 red, 원복 확인("모든 파일 원문 그대로").

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 | 결과 |
|---|---|---|---|---|
| `IO_RULES` 6행 각각 제거 | sweep — EP-1 | 최초 | 'classifyTestSource' 2~7건 | 잠김 |
| `SQLITE` 6분기 각각 제거 | sweep — EP-1(ΔV1) | 최초 | 해당 분기 입력 1건씩 | 잠김 |
| `FORCED_IO` 2항목 각각 다른 경로로 | sweep — EP-1(ΔV1) | 최초 | 'FORCED_IO 는 실측한…'·partition | 잠김 |
| unit/io `pool` 제거·맞바꿈 4 · setup 가드 제거 · groupOrder 2 · io maxWorkers 고정 | sweep — EP-2 | 최초 | 'buildProjects' 1건씩 | 잠김 |
| 가드 5형태 각각 제거 | sweep — EP-3 | 최초 | 'installUnitGuard' 1~2건 | 잠김 |
| `violations.push`·`afterEach(check)`·`afterAll(check)` 제거 | sweep — EP-3(ΔV1) | 최초 | `test-pools.test.ts` 1~2건 · afterAll 중첩 실행 | 잠김 |
| 설정 4키·기록 각각 제거 | sweep — EP-4 / VP-06 선택 증거 | 최초 | vitest 1~3건 | 잠김 |
| 저장소별 config 재추가 | sweep — EP-5 | 최초 | 음성 스캔 1건 | 잠김 |
| 홈 정렬 본체·호출 제거 | sweep — EP-7(ΔV1) | 최초 | 'alignThreadHomedir'·homedir 배선 | 잠김 |

- **분모 검산**: 선택 증거 4(VP-06 키) · 인용 변이 0 · 새 oracle 1(afterAll 중첩 실행) · sweep 33 = 표 행 합 38. EP-6(PowerShell)은 Linux에서 실행되지 않아 sweep 밖 — 남긴 곳.
- **덮개 회귀**: 해당 없음(첫 라운드).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구에 소비자가 있는가 | `[test-pools] …` 메시지 — 테스트 실패 출력에 그대로 보인다(관측: `send.agent-profile` red 출력) | — |
| seam 재배치로 정리 코드 스코프가 바뀌었나 | 재배치 없음 | — |
| 이번 실패 경로가 Part I 상태표의 어느 행인가 | "unit 파일이 자식 프로세스·SQLite를 씀" 행 | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | V1 throw만으로는 조용한 통과였다 → D-007로 red | — |
| 늦게 도착한 응답이 되돌리지 않는가 | 해당 없음 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | threads에서 `os.homedir()`이 실제 홈(0294 격리 붕괴) | 📝 ΔV1 D-006 → 구현 | hostile 테스트 6 → 9항목, `node -e` 실험 |
| 2 | production이 가드 throw를 삼킴 | 📝 ΔV1 D-007 → 구현 | `send.agent-profile` unit green |
| 3 | SQLite 진입점·forced 누락 | 📝 ΔV1 → 구현 | 가드 red 4파일 + 1파일 |
| 4 | Linux 벽시계 +20초(169초 vs 149초, strace 없음) — unit → io 순차 그룹과 스레드 재import | ⚠️ 보고만 | Linux는 프로세스 생성이 싸다. Windows 이득은 CI로 확인 |
| 5 | `check-test-budgets` 신호 정본 이동 | ✅ 선조치(동작 불변) | `check-test-budgets.test.mjs` 641 pass |

### 설계 대비 명시적 차이

- 없음 — 차이는 전부 ΔV1로 plan에 반영.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 상태 없음 | — |
| 공유 | 스레드 풀은 프로세스 환경을 공유한다 → 홈 정렬(D-006) | AC9 · hostile green |
| 재진입 | 가드 재설치 → `proc[UNIT_GUARD]` 반환으로 1회 | 'installUnitGuard' |
| 다른 무효화 축 | 스레드에서 `process.dlopen` 공유 없음(스레드별 `process`) | dlopen 0건 실측 |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | §11 + `scripts/test-source.mjs`·`test-pools.d.mts`·`test-host.d.mts`·`test-time.test.mjs`·`check-test-budgets.mjs` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · 가드 3종 · `npm test`(strace) · `vitest run`(strace 없음) · `node --test scripts/*.test.mjs` · `mutate.py` 38행 |
| **관측한 게이트 산출** | lint 0 error·2 warning(기존 renderer) · typecheck 0 · vitest 920파일: 9 failed(Linux 기준선 동일 9파일 22건) · `node --test` 809/809 · test-budgets 17 suites ok · doc-inventory ok |
| **exe 측정 (VP-07)** | npm test 성공 execve: **1,224(vitest) + 31(`node --test`) = 1,255** — 변경 전 2,464 · 0259 2,420. 워커 `node` 918 → **76**(= io 76), git 직접 1,235 → 1,017, git 간접 248 → 110(maintenance 0) |
| 측정 주의 | 이번 실행은 ABI가 이미 Node라 pretest 재빌드 체인(6회)이 없다 — 같은 조건 환산 1,261 |
| V-pair 자기확인 | SELF_PASS 11 / SELF_BLOCKED 1(VP-09 Windows) |
| 강제 지점 전수 | 71/72 (VP-09 1 남김) |
| **AC 자기보고** | AC1 ✅ 워커 76 = io 76 · AC2 ✅ 13입력 · AC3 ✅ · AC4 ✅ · AC5 ✅ · AC6 ✅ 스캔 0 · AC7 ⚠️ Windows · AC8 ⚠️ Linux ✅ / Windows CI 대기 · AC9 ✅ hostile green · AC10 ✅ 1,255 ≤ 2,420 |
| **합계 검산** | `✅ 8 · ⚠️ 2 · ❌ 0 = 총 10` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(첫 라운드).
- 막았어야 할 plan 지침: V1이 스레드의 env 의미(프로세스 환경 공유)를 조사하지 않았다 — 구현 중 hostile 테스트가 잡음.
- 반복 환경 한계: Windows 전용 경로(VP-09)는 Linux에서 실행 불가.
- 현재 라운드·impl 턴: `r1`.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
