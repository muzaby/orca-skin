# Plan — 0298-ci-exe-load-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0298-ci-exe-load-reduction` |
| 작성자 | Claude Code |
| 일자 | 2026-11-06 (ΔV5 2026-11-08) |
| 매핑 | 비기능(테스트 인프라) — Claude 설계·구현 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `ΔV5` — verify r1 RETURN_TO_PLAN 정정 · 0299 verify D2 · 사용자 7턴(§7-F). `ΔV4` 기본 io 병렬(§7-E) · `ΔV3` 실측 반영(§7-D) · `ΔV2` 실측 CI(§7-C) · `ΔV1` 구현 중 정정(§7-B) |
| 유효 V | `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5` |

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
| 명시 요구 | "verify 지적사항 보완." · "298에서 제시한 ci 규칙 등 준수사항을 handoff-impl이 준수하도록 규칙개정" | 7턴(`/handoff-plan 298`, 2026-11-08) |
| 추론 의도 | "ci 규칙 등 준수사항" = `app/AGENTS.md` scripts 절의 0294·0298 테스트 규칙과 `ci.yml` gate. 0299 r1이 관련 스위트만 돌려 CI에서 전역 가드가 red였고, 사용자가 "298 준수"를 따로 요구해서야 r1.2가 unit 테스트의 git 조회를 mock으로 바꿨다 | 0299 [`r1.2-ci-failure.txt`](../0299-concurrency-notice-turn-end-flicker/evidence/r1.2-ci-failure.txt) · 0299 plan r1.2 설계 리뷰 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | unit(io 외) 테스트는 `threads` 풀, io 테스트는 `forks` 풀로 나눈다 | 파일당 `node` 워커 프로세스 제거(안 A) | 3턴 "a+b 진행" | ACTIVE | — |
| D-002 | Windows + `CI=true` 직렬화는 io 프로젝트에만 둔다. unit은 병렬 | "self hosted로 실행중"(CI=true) — 직렬 대상을 디스크 경합 원인(SQLite·git)으로 좁힘 | 3턴 · `vitest.config.ts:10-13` 주석 | SUPERSEDED | D-011 |
| D-003 | 격리 전역 git 설정(`GIT_CONFIG_GLOBAL`)에 `user.name=orca test` · `user.email=test@orca.local` · `core.autocrlf=false` · `maintenance.auto=false`를 쓰고, 테스트의 저장소별 신원·autocrlf `git config` 호출을 지운다 | 안 B. 신원 값은 유일한 작성자 단언 `git-diff.test.ts:417`(`'orca test'`)에 맞춤 | 3턴 "a+b" | ACTIVE | 0294 AC11 "빈 전역 설정" 단언을 대체(§16) |
| D-004 | Windows 잠금 테스트는 `pwsh.exe` 대신 Windows PowerShell(`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`)을 띄운다 | "runner 환경에서 pwsh이 아닌 powershell을 쓰도록" — 러너에 pwsh 없음 | 3턴 | ACTIVE | — |
| D-005 | 안 C(중첩 vitest hostile 분리)·D(`node --test` 격리 해제)는 하지 않는다 | 사용자가 "a+b"만 승인 | 3턴 | ACTIVE | — |
| D-006 | unit 워커 스레드에서 `os.homedir()`을 스레드 env 사본(`HOME`/win32 `USERPROFILE`)에 맞춘다 | 스레드의 `process.env`는 사본이라 libuv `os.homedir()`이 실제 홈을 읽는다 — 0294 파일별 홈 격리 유지(AC9) | 구현 중 재현(§7-B) | ACTIVE | — |
| D-008 | io 직렬 범위는 바로 정하지 않는다. `ORCA_TEST_IO_MODE`(`serial`·`sqlite-serial`·`parallel`·`workers2`)로 고르고 실험 워크플로로 Windows에서 실측한 뒤 결정한다. 미설정이면 현행(D-002) | "테스트ci 작성하여 우선 테스트해보자" — 0259 대비 Windows test 2:50 → 5:50, io 파일이 0259 테스트 시간의 82%(160.3/196.5초) | 4턴 | ACTIVE | D-002는 미설정 기본값으로 유지 |
| D-009 | 실측 요약용 `.mjs`(`summarize-vitest-report.mjs`)를 만들지 않는다. 실험 워크플로는 vitest 기본 reporter의 파일별 줄·Duration 줄을 그대로 남기고 분석은 로그에서 한다 | "Mjs 만들지마라" | 5턴 | ACTIVE | ΔV2 AC12 요약 단계·VP-14 대체 |
| D-010 | 실측 모드 정정: `workers2` 삭제(vitest — 같은 `groupOrder`의 프로젝트는 `maxWorkers`가 같아야 한다) · `sqlite-serial`의 `io-sqlite`는 group 1로 · 모드마다 2회 반복. `parallel-shared`(unit `isolate: false`)는 로컬 실측 179파일 988건 실패(모듈 mock·상태 누수, import 143 → 39.8초)로 넣지 않는다 | 실측 1회차(run 42199401362): workers2 설정 오류 · parallel 251초인데 unit 구간이 벽시계 190.8초/테스트 합 94.8초 — import 175.5초가 최대 비용 | 실측 · 사용자 "테스트 ci 만들어서 결과를" | ACTIVE | D-008 모드 목록 대체 |
| D-011 | 기본(미설정)은 io 병렬 — 플랫폼·`CI`와 무관하게 unit·io가 같은 group 0, io `maxWorkers` 미지정. 실측 모드(`serial`·`sqlite-serial`·`parallel`)는 남긴다. 새 `.mjs`(test-pools·test-source·vitest-unit-guard·test-pools.test)는 유지 | "Io 병렬, mjs 유지" — 실측 2회차 parallel 3:15·3:48 vs serial 4:31·4:46, 6 job 실패 0 | 6턴 | ACTIVE | D-002 대체 · D-009 범위 = 요약 스크립트만 |
| D-007 | unit 가드는 throw와 함께 위반을 기록하고, setup의 `afterEach`·`afterAll`이 기록으로 red를 만든다 | production `runGit`이 throw를 결과로 삼켜 조용히 통과했다(fail-closed 아님) | 구현 중 재현(§7-B) | ACTIVE | — |
| D-012 | handoff-impl이 0298 테스트 규칙·CI gate를 따르게 하는 지침 개정은 `handoff-review` round 44(APPLY·Tier 1, `Handoff: none` 별도 커밋)로 한다. 0298 구현 범위에 넣지 않는다 | "handoff-impl이 준수하도록 규칙개정" — handoff SKILL 변경은 review 몫(root `AGENTS.md` 카브아웃 · `handoff-plan` "이 SKILL을 고치지 않는다") | 7턴 | ACTIVE | — |
| D-013 | `app/AGENTS.md` test-pools 항목에 세 문장을 둔다 — unit 테스트의 oracle이 아닌 exe는 mock으로 대체(io 신호·`FORCED_IO`는 프로세스·DB·프로세스 전역 상태가 oracle일 때만) · unit 가드 실패의 환경 의존 · 테스트를 추가·수정한 변경의 로컬 확인 명령 | 현재 문장 "신호 없이 프로세스를 띄우는 파일은 `FORCED_IO` 에 사유와 함께 올린다"가 사용자가 받아들인 0299 r1.2 처리(`probeRepo` mock · `FORCED_IO` 제거)와 반대 방향이다. D-012의 일반 규칙이 가리킬 app 구체 명령이 필요하다 | 7턴(추론 — §2) | ACTIVE | D-007·§7-B "신호 없이 git을 띄우는 파일 → forced" 처리를 대체 |
| D-014 | unit 가드 상태는 스레드에 하나다 — 다시 설치하면 첫 상태를 돌려주고 감싸기를 새로 만들지 않는다 | verify r1 F2(재진입 early-return 미잠금, 창 안 확장 후보) 채택 — 테스트 1건으로 닫히고 경계 선언에 필요한 실측(실행 중 재설치 0건)이 없다 | verify r1 F2 | ACTIVE | — |

### 갱신 메모

- 새 결정: D-001~D-005(이번 handoff 최초 설계).
- 변경된 결정: 없음. 0294의 "git 은 빈 전역 설정" 단언만 D-003으로 대체(§16).
- `ACTIVE 결정 ↔ AC` 대조: D-001 ↔ AC1·AC2·AC3 · D-002 ↔ AC4 · D-003 ↔ AC5·AC6 · D-004 ↔ AC7 · D-005 ↔ 비범위(§6) — 충돌 0.
- ΔV1 추가: D-006 ↔ AC9(격리 유지) · D-007 ↔ AC3(가드 fail-closed) — 충돌 0.
- ΔV2 추가: D-008 ↔ AC11·AC12, D-002 ↔ AC4(미설정 분기로 유지) — 충돌 0.
- ΔV4: D-011 ↔ AC4′(미설정 = 병렬) · D-002 SUPERSEDED — AC4는 AC4′로 대체, 충돌 0.
- ΔV5: D-012 ↔ 비범위(§7-F — 0298 AC 없음) · D-013 ↔ AC13 · D-014 ↔ AC3(§7-F VP-03 자리 R1·R2) — 충돌 0. D-007은 유지(기록·훅), §7-B forced 처리만 D-013이 대체.

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
- **비범위**: 안 C·D(D-005) · Git for Windows 런처·conhost 등 Windows 전용 multiplier 측정 · 워크플로 `shell:` 지정(테스트가 띄우는 실행 파일만 범위 — §17) · handoff 지침(`handoff-impl` 등) 개정(D-012 — review 경로).

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

## 7-C. ΔV2 — io 직렬 범위 실측 CI (2026-11-06, 사용자 요구 변경)

| R | AT / AC | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|---|
| R-05 | AT-06 / AC11 | `ORCA_TEST_IO_MODE` 미설정 → 현행(AC4) · `serial` → io 1워커·unit 뒤 · `parallel` → io 기본 워커·unit과 같은 그룹 · `workers2` → io 2워커·같은 그룹 · `sqlite-serial` → SQLite 신호 io만 1워커(`io-sqlite`), 나머지 io 기본 워커, 셋 다 같은 그룹 · 그 밖의 값 → 설정 로드 실패 | UT `buildProjects`·`resolveIoMode` 모드별 입력 | `vitest.config.ts` |
| R-05 | AT-06 / AC12 | 실험 워크플로가 모드 × 반복 행렬을 지정한 러너(기본 `windows-latest`, self-hosted 라벨 가능)에서 돌리고, 마지막 단계에 프로젝트별 벽시계·파일 수·상위 느린 파일을 출력한다 | 워크플로 실행 1회 + 요약 스크립트 UT | `.github/workflows/test-pools-experiment.yml` |

| Pair | left ↔ right | req | path | 직접 oracle | §10 |
|---|---|---|---|---|---|
| VP-13 | MD-06 ↔ UT-06 (NEW 모드) | REQUIRED | env → `resolveIoMode` → `buildProjects({mode, ioSqlite})` | `scripts/test-pools.test.mjs` 모드 5입력 + 잘못된 값 1 | EP-8 (6) |
| VP-14 | AR-03 ↔ IT-03 (NEW 요약) | REQUIRED | vitest JSON 보고서 → `summarize-vitest-report.mjs` → stdout | `scripts/summarize-vitest-report.test.mjs` — 가짜 보고서 2풀 → 풀별 벽시계·합·상위 목록 | EP-9 (3) |
| VP-15 | R-05 ↔ AT-06 | REQUIRED | `workflow_dispatch`/PR(워크플로 파일 변경) → 행렬 job → 요약 | GitHub 실행 1회 관측 | 0 — 운영 pair |

| pair | 계약 | 언제 강제 (자리) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|
| VP-13 | 모드 분기 | 미설정 · `serial` · `sqlite-serial` · `parallel` · `workers2` · 잘못된 값 (6) | `rg -n "'serial'\|'sqlite-serial'\|'parallel'\|'workers2'" app/scripts/test-pools.mjs` | 측정한 모드와 실제 구조가 다르면 비교가 무의미 |
| VP-14 | 요약 항목 | 풀별 벽시계(최소 시작 → 최대 종료) · 풀별 파일 수·시간 합 · 상위 느린 파일 (3) | `rg -n "wall\|top" app/scripts/summarize-vitest-report.mjs` | 잘린 로그에서 판단 근거가 사라진다 |

- 기본 동작 불변: `npm test`·`ci.yml`은 변수를 설정하지 않는다 — 미설정 분기 = AC4.
- 선언 경계: 실험 워크플로의 시간은 러너별 편차가 크다(같은 코드 5:22 vs 8:18, run 41986335666·42001198642). 비교는 같은 실행 묶음 안에서만 하고 반복 입력으로 표본을 늘린다.

## 7-D. ΔV3 — 실측 1회차 반영 (2026-11-06)

| 실측 (windows-latest, 모드당 1회) | Vitest 단계 | vitest 내부 |
|---|---:|---|
| serial | 5:00 | 298.5초 |
| parallel | 4:13 | 251.1초 · unit 벽 190.8 / 합 94.8 · io 벽 59.8 / 합 132.0 |
| sqlite-serial | 4:14 | 252.4초 = transform 25.5 · setup 54.1 · import 175.5 · tests 214.8 |
| workers2 | 설정 오류 | `Projects "io" and "unit" have different 'maxWorkers' but same 'sequence.groupOrder'` |
| 0259 (#727) | — | 161.2초 = transform 23.5 · setup 0 · import 119.1 · tests 196.5 |

| R | AT / AC | 동작 기준 (대체) | 검증 수단 |
|---|---|---|---|
| R-05 | AT-06 / AC11′ | 모드 `serial` · `sqlite-serial`(io-sqlite 1워커 group 1) · `parallel` · 미설정(현행) · 그 밖 → 로드 실패. 같은 group의 프로젝트는 `maxWorkers`가 같고 어느 모드도 `isolate`를 바꾸지 않는다 | UT 모드 5입력 + 잘못된 값 + "같은 group 같은 maxWorkers" 단언 |
| R-05 | AT-06 / AC12′ | 실험 워크플로가 vitest 기본 reporter(파일별 `|project|` 줄 + Duration 분해)와 `node --test` dot 출력만 남기고, 새 `.mjs` 없이 job 로그가 API 5,000줄 안에 든다 | 워크플로 실행 1회 관측 |

- SUPERSEDED: ΔV2 VP-14·EP-9(요약 스크립트) → 폐기(D-009). AC12 → AC12′. EP-8 `workers2` 분기 → 삭제(EP-8′ 5자리: 미설정·serial·sqlite-serial·parallel·잘못된 값) + 같은 group 같은 `maxWorkers` 단언.
- 함께 고치는 현재 결함: `scripts/test-time.test.mjs`가 설정을 읽을 때 `ORCA_TEST_IO_MODE`를 지우지 않아 실험 job에서 실패(sqlite-serial job Script tests).

## 7-E. ΔV4 — 기본 io 병렬 (2026-11-06, 사용자 결정)

| R | AT / AC | 동작 기준 (대체) | 검증 수단 | 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC4′ (AC4 대체) | `ORCA_TEST_IO_MODE` 미설정이면 플랫폼·`CI`와 무관하게 unit(threads)·io(forks)가 같은 group 0에서 돌고 io `maxWorkers`는 미지정 — Windows CI 직렬화 없음 | UT `buildProjects` 미설정 × (win32,'true')·(linux,undef) · `test-time.test.mjs` 프로젝트 예산 | `vitest.config.ts` → `npm test` · `ci.yml` |
| R-04 | AT-04 / AC8′ | Windows CI(`ci.yml`) gate green, Test 단계 시간 기록 | PR CI 실행 관측 | `ci.yml` |

- §10 EP-2 대체: `io.maxWorkers`·`io.groupOrder` 자리의 규칙 = 미설정이면 `undefined`·0. 검색 명령은 그대로(`rg -n "pool:\|maxWorkers:\|groupOrder:\|setupFiles:" app/scripts/test-pools.mjs`).
- 함께 고칠 서술: `vitest.config.ts` 풀 주석 · `app/AGENTS.md` test-pools 항목("Windows+`CI=true` 직렬" · "unit 이 먼저… io 가 뒤") · `test-pools.mjs` 헤더 주석.
- 선언 경계: 0262의 "닫힌 DB 정리 훅 시간 초과"는 GitHub windows-latest 병렬 6 job에서 재현 0이다. self-hosted 러너는 미측정 — 재발하면 실측 모드 `sqlite-serial`이 대안(같은 워크플로로 확인).

## 7-F. ΔV5 — verify r1 정정 · 0299 D2 · app 테스트 규칙 문서 (2026-11-08)

판정: verify r1의 PLAN_GAP 2건을 닫는다. F1은 VP-13 자리 목록을 path edge까지 검색 명령으로 다시 열거해 고정하고(10자리), F2는 창 안 확장 후보로 채택한다(D-014). 0299 verify D2는 plan 목록 ↔ 트리 정합으로 반영하고, 사용자 7턴 요청은 D-012(지침 개정 = review 경로)와 D-013(`app/AGENTS.md`)으로 나눈다.

| 발견 | 출처 | 분류 | 이번 정정 |
|---|---|---|---|
| F1 VP-13 edge 2곳(`ioSqlite` 산출 · config `mode` 전달) 무좌표 | [verify r1](verify.md) F1 | 이행(path edge) — 목록 미고정 | VP-13 §10 대체(분기 5 + edge 5), edge마다 좌표 |
| F2 가드 재진입 early-return 미잠금 | verify r1 F2 | 확장 후보(창 안) | 채택 — D-014 · VP-03 자리 R1·R2 |
| F3 r1.2~r1.4 `[구현자 기입]` 필드 접힘 | verify r1 F3 | 이행(운영 gate) `BLOCKING` | plan 규범 변경 없음 — r2 의무 4 |
| D2 forced 목록 2건 ↔ 트리 1건 | [0299 verify §6 D2](../0299-concurrency-notice-turn-end-flicker/verify.md) · INDEX 후보 표 | plan 내부 정합(목록 ↔ 검색 출력) | VP-01 forced 목록 대체(1) · 후보 표 행 흡수 |
| 사용자 7턴 규칙 개정 | §2 | 사용자 요구 | D-012(review round 44) · D-013 → R-06·AC13·VP-16 |

### Requirements 추가

| R | AT / AC | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|---|
| R-06 | AT-07 / AC13 (NEW) | `app/AGENTS.md` test-pools 항목이 굵은 표지 세 문장을 갖는다 — `**exe 대체**`: unit 테스트의 production 경로가 그 테스트의 oracle이 아닌 exe(git 조회 등)를 띄우면 그 경로를 mock으로 대체하고, io 신호·`FORCED_IO`는 프로세스·DB·프로세스 전역 상태가 oracle일 때만 쓴다 · `**환경 의존**`: unit 가드 실패는 폴더 존재·PATH에 따라 환경마다 다르게 날 수 있고 한 환경에서라도 나면 그 파일의 규칙 위반이다 · `**로컬 확인**`: 테스트를 추가·수정한 변경이 IMPL_DONE 전에 돌릴 `ci.yml` 단계의 ABI-중립 대응 명령(가드 3종 · lint · typecheck · 파일 필터 없는 `vitest run` · `node --test scripts/*.test.mjs`) | VP-16 `gate:` | 에이전트 → `app/AGENTS.md` scripts 절 → 테스트 작성·gate |

- AC 문장은 바꾸지 않는다. AC11′(실측 모드)·AC3(가드)의 검증 수단은 아래 VP-13·VP-03 좌표가 넓힌다. AC 총수 13 → 14(AC13 추가).

### Node · Pair (ΔV5)

| Node | provenance | 근거 |
|---|---|---|
| MD-06·UT-06 | CHANGED | §10 자리 목록 대체(F1) |
| MD-03·UT-03 | CHANGED | 자리 R1·R2 추가(D-014) |
| MD-01·UT-01 | CHANGED | forced 목록 1(D2) |
| R-06·AT-07 | NEW | D-013 |
| R-01·AT-01 · R-04·AT-04 | INHERITED | V1 — 하위 변경이 닿아 회귀 |

| Pair | left ↔ right | req | production path | 직접 oracle (자리별 좌표) | 적대 증거 |
|---|---|---|---|---|---|
| VP-13 | MD-06 ↔ UT-06 | REQUIRED | env·트리 → `vitest.config.ts`(E2 수신 · E3·E4 전달) → `resolveIoMode`(E5) · `partitionTestFiles`(E1) → `buildProjects` 분기 5 | 분기 5: `scripts/test-pools.test.mjs` 'io 실측 모드 (0298 ΔV2)' 기존 6케이스 / E1: 신규 같은 파일 'partitionTestFiles — ioSqlite 는 sqlite 신호 io 만 (ΔV5)' — 임시 앱 디렉토리 `src/`에 `db.test.ts`(`openDb(` 한 줄) · `git.test.ts`(`temp-repo.testfixture` import 한 줄) · `pure.test.ts`(무신호) → `{ io: [db, git], unit: [pure], ioSqlite: [db] }` 전체 deepEqual / E2~E5: 신규 같은 파일 'vitest.config.ts 배선 — 실측 모드와 SQLite 부분집합 전달 (ΔV5)' — 자식 node가 `vitest.config.ts`를 import(`test-time.test.mjs` `configBudgets` 방식, env는 `ORCA_TEST_IO_MODE`만 바꿈): 입력 `serial` → status 0 · `io` {maxWorkers 1, groupOrder 1} · `unit` groupOrder 0 / 입력 `sqlite-serial` → 이름 `[io, io-sqlite, unit]` · `io-sqlite.include` = 같은 테스트의 `partitionTestFiles(APP).ioSqlite`(길이 > 0 단언) · `io.include` ∩ `io-sqlite.include` = ∅ | not selected — 분기·edge별 직접 입력 |
| VP-03 | MD-03 ↔ UT-03 | REQUIRED | unit setup → `installUnitGuard` 재호출 → 상태 반환(R1) · 기록(R2) | 신규 `scripts/test-pools.test.mjs` 'installUnitGuard — 워커 스레드에서 실제 모듈로' 케이스 '재설치는 첫 상태를 돌려주고 위반은 그 상태에 쌓인다 (ΔV5)' — worker에서 `a = install()` · `b = install()` · `spawnSync` 시도 → `a === b` · `a.violations.length === 1` / 기존 8자리는 V1·ΔV1 좌표 그대로 | not selected |
| VP-01 | MD-01 ↔ UT-01 | REQUIRED | `FORCED_IO` → `forced` 규칙 → io | `scripts/test-pools.test.mjs` 'FORCED_IO 는 프로세스 격리가 필요한 파일만 남기고 Git 조회를 대체한 send 검사는 unit 이다'(0299 r1.2가 'FORCED_IO 는 실측한 파일 목록 그대로다'를 대체) · 'io 와 unit 이 겹치지 않고 합이 전체 *.test.ts 다'(forced ∈ io) | not selected |
| VP-16 | R-06 ↔ AT-07 | REQUIRED | 에이전트가 app 테스트 추가·수정 → `app/AGENTS.md` test-pools 항목 → 확인 명령 | `gate: rg -n "\*\*(exe 대체\|환경 의존\|로컬 확인)\*\*" app/AGENTS.md` → 3 · `**로컬 확인**`에 적은 명령을 현재 트리에서 실행해 적은 결과(통과, 또는 app 환경 서명으로 분리한 실패)와 일치 · `node scripts/check-doc-inventory.mjs --check` | not selected |
| VP-11 | R-01 ↔ AT-01 | REGRESSION | AC1~AC4′ | VP-01·02·03·05·07 좌표 합(VP-03은 ΔV5 좌표 포함) | not selected |
| VP-10 | R-04 ↔ AT-04 | REGRESSION | 전체 gate | 실패 집합 기준선 비교(Linux) · PR Windows CI | not selected |

### §10 강제 지점 (ΔV5)

| pair | 계약 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|
| VP-13 (ΔV2·ΔV3 EP-8′ 대체) | 실측 모드·SQLite 부분집합이 env·트리에서 프로젝트 구성까지 운반된다 | 분기 5: 미설정 · `serial` · `sqlite-serial` · `parallel` · 잘못된 값 / edge 5: E1 `partitionTestFiles` 산출 `if (reasons.includes('sqlite')) ioSqlite.push` · E2 `vitest.config.ts` 수신 `const { io, ioSqlite } = partitionTestFiles(…)` · E3 `vitest.config.ts` 전달 `ioSqlite,` · E4 `vitest.config.ts` 전달 `mode: resolveIoMode()` · E5 `resolveIoMode` env 읽기 `env[IO_MODE_ENV]` = **10** | 분기: `rg -n "'serial'\|'sqlite-serial'\|'parallel'" app/scripts/test-pools.mjs` / edge: `rg -n "ioSqlite\|resolveIoMode\(\|IO_MODE_ENV\]" app/vitest.config.ts app/scripts/test-pools.mjs` → 13줄 = 자리 5 + 제외 8(아래) | 실험 job이 고른 모드·SQLite 묶음이 설정에 닿지 않으면 기본 구조를 재고도 green — 모드 비교가 무의미 |
| VP-03 (ΔV5 추가) | 가드 상태는 스레드에 하나 | R1 재설치 반환 `if (proc[UNIT_GUARD]) return proc[UNIT_GUARD]` · R2 상태 기록 `proc[UNIT_GUARD] = state` (2) — ΔV1 8자리와 합 **10** | `rg -n "UNIT_GUARD\]" app/scripts/test-pools.mjs` → 2 | 재설치가 새 상태를 만들면 위반이 setup이 비우는 상태와 다른 곳에 쌓일 수 있다 |
| VP-01 (ΔV1 forced 행 대체) | forced 목록 | `src/main/infra/loopback-callback.test.ts` (**1**) — `send.agent-profile.test.ts`는 0299 r1.2(`2c7ee29`, `probeRepo` mock)로 unit | `rg -n "test.ts':" app/scripts/test-pools.mjs` → 1 | 빠지면 그 파일이 unit 스레드끼리 EADDRINUSE |
| VP-16 | app 테스트 작성 규칙 문서 | T1 `**exe 대체**` · T2 `**환경 의존**` · T3 `**로컬 확인**` (**3**) | `rg -n "\*\*(exe 대체\|환경 의존\|로컬 확인)\*\*" app/AGENTS.md` → 3(구현 뒤) | 에이전트가 신호 없는 git 조회 파일을 `FORCED_IO`로 올려 exe가 다시 늘거나, 관련 스위트만 돌려 트리 전체 가드를 놓친다(0299 r1) |

- VP-13 edge 검색의 제외 8줄: `test-pools.mjs` 주석 2(`ioSqlite` 설명 · `@param`) · 빈 배열 선언·반환 2(E1 산출의 시작·끝 — E1 좌표가 같이 관측) · 함수 정의 1(`resolveIoMode(env = process.env)` — 본체가 E5) · 매개변수 기본값 1(`ioSqlite = []` — E3를 지웠을 때 떨어지는 폴백, E3 좌표가 관측) · `sqlite-serial` 분기 본문 2(분기 자리).
- 규칙 칸 ↔ 입력 칸: 분기 5는 기존 6케이스, E1은 io 형제(git)·unit(pure)·대상(db) 3입력, E2~E5는 `serial`·`sqlite-serial` 2입력(미설정은 `test-time.test.mjs` 'vitest.config.ts 배선'이 이미 본다), R1·R2는 재설치 1입력, VP-16은 표지 3.
- 구별 값: E1의 git 파일은 io이지만 `ioSqlite`가 아니다(형제 맞바꿈 감지). E4는 `serial`이 기본과 다른 maxWorkers·groupOrder를 내서 `mode` 미전달과 구별된다. E3은 `io-sqlite.include` 비어 있지 않음 단언으로 기본값 `[]`와 구별된다.
- **선언 경계**: (a) 실험 워크플로가 job env를 넘기는 edge는 VP-15(GitHub 실행 관측 — run 42207662226에서 모드별 프로젝트 구성 확인) 몫이다. (b) VP-03은 함수 계약(재설치 시 같은 상태)이고, 실제 vitest 실행에서 재설치가 일어나는지는 다루지 않는다. (c) VP-16 문서 문장을 에이전트가 따르는지는 기계 판정 밖이다 — 정책의 기계 잠금은 `FORCED_IO` 정확 목록 단언(VP-01) · unit 가드(VP-03) · 저장소별 git config 스캔(VP-08)이다.
- 0299 r1.2가 0298 산출물(`test-pools.mjs` `FORCED_IO` · 그 고정 테스트)을 바꾼 것은 VP-01 목록으로 흡수한다. INDEX 후보 표의 0299 D2 행은 이 ΔV5로 닫는다.

### r2 구현 의무

1. F1 — VP-13 E1~E5 좌표 2테스트를 만들고 분기 5 좌표를 다시 인용한다.
2. F2 — VP-03 R1·R2 재설치 테스트.
3. D-013 — `app/AGENTS.md` test-pools 항목의 "신호 없이 프로세스를 띄우는 파일은 `FORCED_IO` 에 사유와 함께 올린다"를 T1으로 바꾸고 T2·T3를 더한다. T3 명령은 현재 트리에서 실행해 결과를 구현 보고에 적는다(태그 없는 클론이면 마이그레이션 가드는 append-only를 건너뛴다).
4. F3 — r2 `[구현자 기입]` 일곱 필드를 채운다. 강제 지점 전수 표는 유효 V의 REQUIRED pair 전부를 덮고 r1.2~r1.4가 바꾼 ΔV2~ΔV4 자리(VP-13 · EP-2 io.maxWorkers·io.groupOrder)를 포함한다. r1.2~r1.4 절은 원문 그대로 둔다.
5. 직전 verify 고장 이력의 `못 잡음` 중 E1-iosq·C-cfg-mode(이행)·E3-reentry(채택)를 재실행해 red를 보인다. E2-badmode(`동치`)는 재실행 의무 밖이다.
6. gate — §7-A 운영 gate + D-012가 개정한 `handoff-impl` gate(IMPL_DONE 전 `ci.yml` 단계 집합 · 기준선 분리 조건 · 추가·수정 테스트 파일의 subtree 테스트 규칙).

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
- ΔV5 점검: CHANGED·NEW 노드 4(MD-06·MD-03·MD-01·R-06) ↔ REQUIRED pair 4(VP-13·03·01·16), 영향 상위 REGRESSION 2(VP-11·10). §10 검색 재실행 — VP-13 edge 13줄 = 자리 5 + 제외 8 · 분기 4줄(모드 상수 1 + 분기 3 — 미설정은 `parallel` 줄, 잘못된 값은 `resolveIoMode`·마지막 `throw`) · VP-03 `UNIT_GUARD\]` 2 · VP-01 forced 1. 규칙 칸 ↔ 입력 칸·구별 값·선언 경계 3건은 §7-F. 인용 테스트 'io 실측 모드 (0298 ΔV2)'·'FORCED_IO 는 프로세스 격리가 필요한…'·'installUnitGuard — 워커 스레드에서 실제 모듈로'·`test-time.test.mjs` `configBudgets` 실재(`rg -n` 확인).

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

## [구현자 기입] 구현 보고 (r1.2 — ΔV2 실측 CI, 사용자 요구 변경 턴)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/scripts/test-pools.mjs`(모드)·`test-pools.d.mts`·`test-pools.test.mjs` · `app/scripts/summarize-vitest-report.mjs`(+test) · `app/vitest.config.ts` · `.github/workflows/test-pools-experiment.yml` · `app/AGENTS.md` |
| 강제 지점 | EP-8 6/6 — 'io 실측 모드 (0298 ΔV2)' 6케이스 · EP-9 3/3 — 'summarizeReport' 2케이스 |
| 잠금 | `mutate.py` 9행(EP-8 6 · EP-9 3) 전부 red, 원복 확인 · `선택 증거 0 · 인용 변이 0 · 새 oracle 0 · sweep 9 = 9` |
| 게이트 | lint 0 error · typecheck 0 · `node --test` 817/817 · test-budgets · doc-inventory · `ORCA_TEST_IO_MODE=sqlite-serial` vitest 3파일 + 요약 출력 실측 · `=fast` → 로드 실패 메시지 |
| AC 자기보고 | AC11 ✅(UT 6) · AC12 ⚠️ 워크플로 첫 실행 대기 — `✅ 9 · ⚠️ 3 · ❌ 0 = 총 12` (분모 10 → 12: ΔV2 AC 2 추가) |
| 기본 동작 | 미설정 분기 = r1 구조(AC4 UT 그대로 green) — `ci.yml`·`npm test` 는 변수를 설정하지 않는다 |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

## [구현자 기입] 구현 보고 (r1.3 — ΔV3, 사용자 요구 변경 턴)

| 항목 | 내용 |
|---|---|
| 변경 | `summarize-vitest-report.mjs`·`.test.mjs` 삭제(D-009) · 모드 `workers2` 삭제·`io-sqlite` group 1(D-010) · `test-time.test.mjs`가 `ORCA_TEST_IO_MODE`를 지움(현재 결함 선조치) · 워크플로 vitest 기본 reporter·Summary 단계 삭제·반복 `[1,2]` |
| 강제 지점 | EP-8′ 5/5 + 같은 group 같은 `maxWorkers` — `test-pools.test.mjs` 'io 실측 모드' 6케이스 · 로컬 `ORCA_TEST_IO_MODE=sqlite-serial node --test scripts/test-time.test.mjs` 12/12 |
| 로컬 실측 | `ORCA_TEST_IO_MODE=parallel-shared`(제외 전): 179파일 988건 실패 · import 39.8초 |
| 게이트 | lint 0 error · typecheck 0 · `node --test` 전체 green · doc-inventory |
| AC 자기보고 | AC11′ ✅ · AC12′ ⚠️ 실행 대기 — `✅ 9 · ⚠️ 3 · ❌ 0 = 총 12` |
| 대상 커밋 | `(r1.3 구현 — 좌표는 INDEX)` |

### r1.3 실측 2회차 (run 42207662226, windows-latest, 모드 × 2)

| 모드 | Vitest 단계 | vitest Duration (transform · setup · import · tests) | 프로젝트 완료 구간 |
|---|---|---|---|
| parallel #1 / #2 | 3:15 / 3:48 | 193.9초 (23.7 · 38.4 · 144.9 · 207.9) / 224.5초 (26.5 · 52.9 · 172.4 · 212.0) | io 2→57초, unit 57→194초 / io 2→55초, unit 55→225초 |
| sqlite-serial #1 / #2 | 3:22 / 4:23 | 201.4초 / 261.2초 | io 2→36초 · unit 37→169초 · io-sqlite 172→202초 / io-sqlite 178→261초 |
| serial #1 / #2 | 4:31 / 4:46 | 269.8초 / 283.9초 | unit 1→154초 · io 156→270초 / unit 1→159초 · io 161→284초 |
| 0259 (#727) | — | 161.2초 (23.5 · 0 · 119.1 · 196.5) | — |

- AC12′ ✅ — job 로그 1,768줄(API 5,000줄 안), 파일별 `io`/`unit` 줄과 Duration 분해가 남는다. 6 job 모두 실패 0.
- 판정: parallel의 병렬 효율(누적 415초 / 벽 194초 = 2.1)은 0259(339 / 161 = 2.1)와 같고, 파일당 0.21초로 0259(0.245초)보다 짧다. 0259 대비 남은 차이는 io 직렬화다. 기본 모드 변경(D-002)은 사용자 결정 대기.

## [구현자 기입] 구현 보고 (r1.4 — ΔV4 기본 io 병렬, 사용자 결정 턴)

| 항목 | 내용 |
|---|---|
| 변경 | `buildProjects` 미설정 = `parallel`(unit·io group 0, io `maxWorkers` 미지정) · 쓰지 않게 된 `platform`·`ci` 인자 제거(`vitest.config.ts`·`test-pools.d.mts`) · 주석·`app/AGENTS.md` 서술 갱신 · `.mjs` 유지(D-011) |
| 강제 지점 | EP-2 io.maxWorkers·io.groupOrder 2/2 — `test-pools.test.mjs` '직렬 없이 둘 다 maxWorkers 미지정·같은 그룹 0' 4환경 · '미설정 = parallel' |
| 잠금 | `mutate.py` 3행(미설정 io 1워커 · group 1 · 미설정 분기 분리) 전부 red, 원복 확인 |
| 게이트 | lint 0 error · typecheck 0 · `node --test` 815/815 · test-budgets · doc-inventory · Linux vitest 161초, 실패 9파일 22건 = 기준선 |
| PR Windows CI | run 42233452074 green — Test 5:10(node --test 26.1초 포함) · 같은 브랜치 직전 직렬 기본값 run 42209145424 Test 5:43 · 단일 표본(러너 편차 큼) |
| AC 자기보고 | AC4′ ✅ · AC8′ ✅ run 42233452074 green — `✅ 11 · ⚠️ 2 · ❌ 0 = 총 13` (분모 12 → 13: AC8′ 추가) |
| 대상 커밋 | `(r1.4 구현 — 좌표는 INDEX)` |


---

## [구현자 기입] 설계 리뷰 (r2 — ΔV5)

- 동의 / 그대로 진행: 유효 V는 `V1 + ΔV1~ΔV5`다. §7-F의 F1·F2·D-013·F3을 수행하며 r1.2~r1.4 원문은 보존한다.
- 이견 / 현실성 문제: §19의 원시 워커 태그 집계에는 현재 트리의 기존 hostile 중첩 워커 2가 포함된다. 원시 77·본 실행 75·중첩 2를 모두 보고하고, D-005 비범위인 중첩 실행 구조는 유지한다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 보드의 Claude 구현 표기는 사용자 `handoff-impl 298` 지시로 Codex가 승계하며 Decision·AC·V 규범 행은 수정하지 않았다.

## [구현자 기입] 강제 지점 전수 (§10 대조, r2)

아래 스크립트 경로는 `app/` 기준이다. `P`는 `scripts/test-pools.test.mjs`, `H`는 `scripts/test-host.test.mjs`이며, 좌표는 아래 테스트명과 결합한다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 | io 규칙·sqlite·forced | 6규칙 + sqlite 6분기 + forced 1 = 13 | 13/13 | `P:classifyTestSource — 규칙마다 그 신호 하나만 든 입력` · `P:FORCED_IO 는 프로세스 격리가 필요한 파일만 남기고 Git 조회를 대체한 send 검사는 unit 이다` | 각 신호만 있는 입력 → 정확한 `{pool,reasons}`; forced loopback ∈ io, send.profile ∈ unit | — |
| VP-02·05 | 프로젝트 필드 | unit.pool·unit.setupFiles·unit.groupOrder·io.pool·io.maxWorkers·io.groupOrder (6) | 6/6 | `P:buildProjects — 환경별 필드` 6건 · `src/main/infra/test-pools.test.ts:워커 스레드에서 돌고 가드가 설치돼 있다` · `test-environment.test.ts:풀 배선 (0298)` | threads/forks 구별; 환경 4종 → maxWorkers 미지정·group 0; setup 배열 전체 단언 | — |
| VP-03 | 가드·기록·훅·재설치 | spawn·spawnSync·execFileSync·execSync·dlopen·violations.push·afterEach·afterAll·R1·R2 (10) | 10/10 | `P:installUnitGuard — 워커 스레드에서 실제 모듈로` 4건 · `P:afterAll 에서 삼킨 자식 프로세스 시도 → vitest 비정상 종료 + [test-pools]` · `test-pools.test.ts:위반을 남긴 테스트는 호출자가 오류를 삼켜도 afterEach 가 red 로 만든다` | 5형태 throw; 다른 .node 전달; 두 install 상태·spawnSync 래퍼 동일; 첫 상태에 위반 1건; 삼킨 throw도 파일 red | — |
| VP-04·06 | 격리 git 설정 | 신원 2키·autocrlf·maintenance + 파일 기록 (5) | 5/5 | `H:신원 · core.autocrlf=false · maintenance.auto=false 를 담는다` · `src/main/infra/git/hermetic-config.test.ts` 2건 · `test-environment.test.ts` 파일 내용 단언 | 실제 새 저장소 4키 읽기; `GIT_TRACE=1` 작동 확인 후 maintenance 부재·작성자 확인 | — |
| VP-08 | 저장소별 config 삭제 | 신원 32 + autocrlf 4 → 0 (36) | 36/36 | ``P:테스트 소스에 `git config user.*`·`core.autocrlf` 호출이 없다`` · 전체 vitest의 실-git 스위트 | 소스 스캔 offenders=[]; `E5-config` 재삽입 시 음성 단언 red | — |
| VP-09 | PowerShell | Windows FileShare.None helper (1) | 0/1 | `src/main/infra/config/file-mutation.test.ts:waits for an actual Windows FileShare.None handle to be released` — Linux skip | Windows PowerShell 경로는 원문 유지; Linux에서는 실행하지 않음 | pwsh 없는 self-hosted 실기(Windows CI는 6케이스 PASS) |
| VP-12 | 스레드 홈 정렬 | 본체·unit setup 호출 (2) | 2/2 | `P:alignThreadHomedir — 워커 스레드의 os.homedir 를 스레드 env 에 맞춘다` 2건 · `test-pools.test.ts:os.homedir() 는 setup 이 이 파일에 준 홈이다` · hostile 스위트 | 다른 `-thread` 홈 → 반환값; 미정렬 대조는 원래 홈; 파일별 임시 홈 배선 | — |
| VP-13 | 모드·SQLite 부분집합 | 분기 5 + E1~E5 = 10 | 10/10 | 분기: `P:io 실측 모드 (0298 ΔV2)` 6건; E1: `P:DB·Git·순수 파일을 구별해 전체 분할과 SQLite 부분집합을 운반한다`; E2~E5: `P:vitest.config.ts 배선 — 실측 모드와 SQLite 부분집합 전달 (ΔV5)` 2건 | db/git/pure 전체 deepEqual; serial → io maxWorkers 1·group 1, unit 0; sqlite-serial → 실제 트리의 비어 있지 않은 ioSqlite, io와 교집합 ∅ | — |
| VP-16 | 테스트 작성 규칙 | T1 exe 대체·T2 환경 의존·T3 로컬 확인 (3) | 3/3 | `rg -n '\*\*(exe 대체\|환경 의존\|로컬 확인)\*\*' app/AGENTS.md` → 3; T3 전체 실행은 아래 gate 산출 | 표지 3개 각각 제거 → 개수 gate red; 명령은 CI 단계 집합과 일치 | — |

- 자리 재열거: 6규칙·sqlite 6분기·forced 1·프로젝트 6·가드 10·설정 5·삭제 36·PowerShell 1·홈 2·모드 10·문서 3. §7-F 검색 결과와 고정 목록 차집합은 ∅이며 VP-13 edge 검색 13줄은 자리 5 + 선언된 제외 8이다.
- §10 자리 목록 밖에서 본 운반 자리: 없음 — 새 production 분기는 만들지 않았다(`git diff --name-only`의 앱 변경은 테스트 1파일·지침 1파일).
- 직전 `못 잡음`: `E1-iosq`·`C-cfg-mode`는 F1 새 테스트, `E3-reentry`는 F2 새 재설치 테스트가 red로 바꾼다(잠금 표·명세/결과 참조). `E2-badmode`는 §7-F 의무 5의 동치 경계로 재실행 대상 밖이다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01·02·03·04·05·08·12·13·16 | REQUIRED | SELF_PASS | 위 자리별 좌표 + 현재 gate 산출 | not selected — 분기별 직접 입력·64행 sweep |
| VP-06 | REQUIRED | SELF_PASS | `hermetic-config.test.ts` 2케이스 | required — `E4-0~3` 4키 제거 각각 red |
| VP-07 | REQUIRED | SELF_PASS | `gate: strace` 성공 execve·io 워커 집계(아래) | not selected |
| VP-09 | REQUIRED | SELF_BLOCKED | `file-mutation.test.ts` Linux skip | Windows CI file-mutation 6케이스 PASS; self-hosted 실기 대기 |
| VP-10 | REGRESSION | SELF_PASS | Linux 파일·케이스 차집합 ∅ · Windows CI #1024 success | not selected |
| VP-11 | REGRESSION | SELF_PASS | VP-01·02·03·05·07 좌표 합 | not selected |
| VP-15 | REQUIRED | SELF_PASS (상속) | GitHub run 42207662226 job 6/6 success 재조회; job 127858231804 로그 1,769줄·Duration 193.89s | not selected — 실측 워크플로는 이번 diff에서 불변 |

VP-14는 D-009로 폐기됐다. 현재 REQUIRED 13·REGRESSION 2 = 15 pair이며 SELF_PASS 14 / SELF_BLOCKED 1(VP-09)다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

명세와 결과는 [r2-mutations.jsonl](evidence/r2-mutations.jsonl)·[r2-mutations.tsv](evidence/r2-mutations.tsv)다. 하네스는 `.agents/skills/handoff-verify/scripts/mutate.py`이고 `원복 확인: 모든 파일 원문 그대로`를 확인했다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| E1-child-process·git-fixture·run-git·sqlite·timezone·forced (6) | sweep — VP-01 규칙 | red | P classifyTestSource | 잠김 |
| E1-sq0~5·runinj·tzbr·cpimp·strip·forced (11) | sweep — VP-01 하위 분기·forced 목록 | red; forced는 ΔV5 목록 1로 정정 | P 해당 신호·주석·주입·forced 단언 | 잠김 |
| E2-unitpool·iopool·guardsetup·excl·unitgroup·iogroup·iomax (7) | sweep — VP-02·05 필드·형제 맞바꿈 | red | P buildProjects 환경별 필드 | 잠김 |
| E2-par·serial·serial-grp·sqs-max·sqs-grp·sqs-rest·sqs-swap·resolve-empty·resolve-bad (9) | sweep — VP-13 분기·형제 맞바꿈 | red | P io 실측 모드 | 잠김 |
| **E1-iosq**·**C-cfg-mode**·**E3-reentry** (3) | 인용 변이 — F1·F2 | **green** | 새 partition·실제 config serial·재설치 케이스 | 잠김 |
| E1-iosq-swap·C-cfg-receive·C-cfg-sqlite·C-cfg-env (4) | sweep — VP-13 E1~E5·io 형제 구별 | 최초 | 새 partition·실제 config sqlite-serial/serial | 잠김 |
| E3-spawn·spawnSync·execFileSync·execSync·dlopen·dlopen-any·push·state·hook-each·hook-all·drain (11) | sweep — VP-03; 직전 red 보존 | red; state는 최초 | P installUnitGuard·afterAll + vitest test-pools의 실제 훅 | 잠김 |
| E7-body·call·key (3) | sweep — VP-12 | red | P alignThreadHomedir·vitest 홈 배선 | 잠김 |
| E4-0~3 (4) | VP-06 선택 증거 | red | 실제 git hermetic-config 2케이스 | 잠김 |
| E4-write·name·E5-config (3) | sweep — VP-04·06·08 | red | test-environment·H 설정 내용·P 음성 스캔 | 잠김 |
| T-exe 대체·환경 의존·로컬 확인 (3) | 새 oracle — VP-16 표지 전수 gate | 최초 | `rg -c` 결과 2 ≠ 3 | 잠김 |

- 분모 검산: 선택 증거 4 · 인용 변이 3 · 새 oracle 3 · sweep 54 = **64**행(중복은 앞 범주에 귀속). Windows PowerShell 1자리는 Linux 실행 경계라 남겼다.
- 덮개 회귀: red → green 0건(재실행 64행 중 red 64·SKIP 0). 직전 verify가 red였던 변경 oracle의 분기·가드·홈·설정·배선 행은 같은 실수로 재앵커했고, 0299가 제거한 두 번째 forced 항목은 ΔV5가 폐기했다.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구·상태의 소비자 | app 테스트 작성 규칙 3개 → 에이전트가 읽는 test-pools 항목; gate 명령은 실제 실행 | — |
| seam 재배치와 정리 스코프 | production 재배치 없음; 새 임시 앱 디렉토리는 finally에서 rmSync | — |
| 새 실패 경로의 상태표 | 테스트의 `[test-pools]` 위반 출력은 기존 §5 unit 위반 행; 제품 동작 변경 없음 | — |
| 조용한 통과 가능성 | config mode·ioSqlite 누락/가드 재설치 제거는 새 케이스가 red | F1·F2 잠금 표 |
| 늦은 응답·화면 되돌림 | 해당 없음 — UI·요청 수명주기 무변경 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | GitHub CI와 이 실행기의 플랫폼·Node 버전 차이 | 환경/비귀속 실패를 구분해 보고 | 변경 전·후 9파일 22건 및 unhandled rejection 1건 동일; C:/ 경로·win32 전용 plugin 제어 — r2-baseline-failures.json·r2-gates.json |
| 2 | node --test가 npm test의 vitest red 뒤에는 실행되지 않음 | 선조치 — 전체 스크립트 테스트를 별도 실행·측정 | node --test scripts/*.test.mjs 819/819 passed |
| 3 | app 테스트 가드가 env에 따라 다르게 실패할 수 있음 | D-013 문서 반영; 수정 테스트 파일의 가드 위반 0 확인 | 시간 예산 위반 0(신규 timeout 없음·.mjs는 TS 가드 대상 밖); 호스트 격리 위반 0(임시 앱 finally 정리·config 읽기만); 풀 위반 0(Node·worker가 직접 oracle) |

### 설계 대비 명시적 차이

- 계측 설명 보완: §19 원시 태그 집계는 77이고 본 실행 io 워커는 75다. trace의 clone/fork 부모를 따라 기존 hostile 중첩 2를 분리했으며, 본 실행 io 자리 75와 unit의 threads 동작을 직접 대조한다.
- 구현 메커니즘 차이는 없음 — ΔV5가 정한 oracle과 문서만 추가했다. 재설치 케이스는 같은 상태뿐 아니라 같은 spawnSync 래퍼도 단언한다(D-014의 “새로 감싸지 않는다”).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 대체물·새 캐시 없음 | `git diff` production 무변경 |
| 공유 | 실제 워커 builtin 변경이 부모로 새지 않아야 함 | AC3 · P 기존 워커 격리 경로; 부모의 자식 Node가 config를 정상 import |
| 재진입 | 위반 상태와 래퍼가 새로 생기면 첫 상태가 비어 있음 | AC3 · R1·R2 신규 케이스; E3-reentry/state red |
| 다른 무효화 | 외부 ORCA_TEST_IO_MODE 상속이 config 기대를 바꾸지 않아야 함 | AC11′ · config 자식마다 mode 명시; 기존 test-time은 변수를 지운 기본 구성 |

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/scripts/test-pools.test.mjs` ΔV5 4케이스 · `app/AGENTS.md` T1~T3 · 본 보고·INDEX · 재현 증거 |
| 실행 명령 | T3의 CI 대응 7명령 + `npm test` 기준선·strace 측정 + `mutate.py` 64행(명세/결과 링크 위) |
| 관측한 게이트 산출 | 가드 3종 PASS(태그 부재로 append-only만 skip) · lint 0 error/2 기존 warning · typecheck 3종 PASS · vitest 927파일: 915 passed/9 failed/3 skipped, 22실패는 변경 전과 파일·케이스 차집합 ∅ 및 OS 원인; node --test 819/819 passed; [Windows CI #1024](https://github.com/muzaby/orca-skin/actions/runs/42460603101) 가드·lint·typecheck·전체 테스트 success([관측](evidence/r2-windows-ci.json)) |
| 추가·수정 테스트의 subtree 규칙 | `git diff --name-only a2a61a70 -- '*test*'` → `app/scripts/test-pools.test.mjs` 1파일; 시간 예산 위반 0(신규 timeout 없음·.mjs는 TS 가드 대상 밖); 호스트 격리 위반 0(임시 앱 finally 정리·config 읽기만); 풀 위반 0(Node·worker가 직접 oracle) |
| V-pair 자기확인 | SELF_PASS 14 / SELF_BLOCKED 1(VP-09) — pair별 좌표는 전수 표 |
| 강제 지점 전수 | **85/86** — Windows PowerShell 1 남김; forced 2→1·가드 8→10·VP-13 10·VP-16 3을 유효 V로 합성 |
| exe 측정 (VP-07) | npm test 1174 + 별도 node --test 34 = **1208 ≤ 2,420**; 원시 fork 워커 **77 = 본 실행 io 75 + 기존 hostile 중첩 2**·unit 852 스레드; 신원/autocrlf config 쓰기 0·maintenance 0(양쪽 합). 기준선과 같은 CI 미설정 조건이며 D-011의 구성 불변은 UT로 확인 |
| 블로커 / 역질문 | 코드·계약 블로커 없음; AC7 pwsh 없는 self-hosted 실기만 대기 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

**AC 자기보고**

| AC | 판정 / 이번 턴 관측 |
|---|---|
| AC1 | ✅ 본 실행의 fork 워커 75 = partition io 75; unit 852는 threads. §19 원시 태그 집계 77에는 기존 hostile의 중첩 io 2가 더해진다(D-005 비범위); 부모 귀속도 함께 보고 |
| AC2 | ✅ P classifyTestSource 19케이스; 6규칙·sqlite 6분기·forced 목록 직접 입력 |
| AC3 | ✅ P installUnitGuard 4케이스·unit test-pools 4케이스·afterAll 중첩 실행; 재진입 포함 |
| AC4′ | ✅ buildProjects 4환경·미설정=parallel; io/unit group 0·maxWorkers 미지정 |
| AC5 | ✅ hermetic-config 2케이스 — 실제 git 4키·trace maintenance 부재 |
| AC6 | ✅ P 저장소별 config 스캔 0; 전체 실-git 스위트 실행 |
| AC7 | ⚠️ pwsh 없는 self-hosted Windows 실기 대기; Linux FileShare.None skip |
| AC8 | ✅ Linux 변경 전·후 9파일 22건·unhandled 1건 동일, 파일/케이스 차집합 ∅; Windows CI #1024 success |
| AC8′ | ✅ [Windows CI #1024](https://github.com/muzaby/orca-skin/actions/runs/42460603101) success — Test 단계 277.9초(로그 시각), Vitest 246.05초·924파일/8,589 passed, node 819/819 |
| AC9 | ✅ test-environment·hostile·unit 홈 배선 실행; E7-body/call/key red |
| AC10 | ✅ 성공 execve **1208 ≤ 2,420**(npm test + 별도 스크립트 테스트) |
| AC11′ | ✅ 기존 모드 6케이스 + 실제 config 2케이스; E1~E5 직접 관측 |
| AC12′ | ✅ GitHub 실험 run 42207662226 job 6/6 success; 재조회한 parallel 로그 1,769줄·Duration 분해; 새 요약 mjs 없음 |
| AC13 | ✅ app/AGENTS.md T1~T3 검색 3; T3 명령 전부 실행; marker 제거 3행 red |

**합계 검산**: `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14`. ΔV5의 AC13 추가로 직전 13에서 현재 14로 분모가 바뀌었다.

## [구현자 기입] Review Signals — 사실만 (r2)

- 같은 축 여부: F1 모드 옆 배선·F2 재진입을 §7-F의 유한 목록으로 잠갔다(`E1-iosq`·`C-cfg-mode`·`E3-reentry` green → red).
- 막았어야 할 지침·AC: 이전 §10이 모드 분기만 열거했던 F1은 ΔV5 edge 5로 보완됐다; F3는 이번 턴 일곱 필드와 전수 표를 모두 채웠다.
- 반복 환경 한계: Linux C:/ 절대 경로·win32 전용 플러그인 제어; 9파일 22건과 unhandled 1건이 변경 전과 동일; AC7 self-hosted만 사람 몫.
- 현재 라운드·impl 턴: `r2`(verify r1 이후 첫 구현 턴). handoff 지침 변경은 D-012에 따라 이번 diff에 없다.

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
