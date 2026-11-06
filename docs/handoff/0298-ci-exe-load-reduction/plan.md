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
| 이번 V revision | `V1` |
| 유효 V | `V1` |

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

### 갱신 메모

- 새 결정: D-001~D-005(이번 handoff 최초 설계).
- 변경된 결정: 없음. 0294의 "git 은 빈 전역 설정" 단언만 D-003으로 대체(§16).
- `ACTIVE 결정 ↔ AC` 대조: D-001 ↔ AC1·AC2·AC3 · D-002 ↔ AC4 · D-003 ↔ AC5·AC6 · D-004 ↔ AC7 · D-005 ↔ 비범위(§6) — 충돌 0.

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

## [구현자 기입] 설계 리뷰

## [구현자 기입] 강제 지점 전수 (§10 대조)

## [구현자 기입] 이번 라운드 수정의 잠금

## [구현자 기입] Product/UX 파생 검토

## [구현자 기입] 놓친 잠재 문제 + 대응

## [구현자 기입] 구현 보고

## [구현자 기입] Review Signals — 사실만

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
