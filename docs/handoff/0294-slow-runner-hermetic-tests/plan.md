# Plan — 0294-slow-runner-hermetic-tests

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**

## 메타

| 항목 | 값 |
|---|---|
| slug | `0294-slow-runner-hermetic-tests` |
| 작성자 | Claude Code |
| 일자 | 2026-11-03 |
| 매핑 | 기준 커밋 `origin/main@eed9741`(`git cat-file -t` = commit, 설계 시점 `HEAD`와 같음) · 브랜치 `ccr-f9f698c1-9uk3t7` |
| 상태 | impl/IMPL_DONE (r1) |
| V mode | `Baseline V` |
| 기준 V | `none` — 테스트 인프라 신규 계약이며 상속할 V가 없다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 — 테스트 인프라·CI. root `AGENTS.md` "리팩토링·버그수정 등 비기능 작업") |
| 측정 증거 | [`evidence/`](evidence/) — 재현 스크립트. 수치는 아래 §8이 정본 |

---

# Part I — Product & UX Contract

## 1. Context / 목표

| 요구 | 지금 문제 | 완료 후 |
|---|---|---|
| A. 저성능 CI 러너 | 시간 예산이 측정 환경(GitHub windows 러너·로컬 병렬) 기준이다 — 케이스 20s·훅 10s(vitest 기본)·`vi.waitFor` 1s(기본)·CI 작업 30분. 1코어 과부하 모사에서 기본 1s `vi.waitFor` 2건이 시간 초과로 깨졌다(§8) | 모든 테스트 시간 예산이 `기준값 × 배율(기본 3)`이다. 운영자는 코드 수정 없이 배율·CI 작업 상한을 올린다 |
| B. 실행환경 설정 차이 | 테스트가 실제 HOME·환경변수를 읽는다 — `~/.config/opencode/opencode.json`의 `mcp`만으로 9파일 27건, Git `commit.gpgsign=true`만으로 16파일 76건이 깨졌다(§8). 테스트 2파일이 실제 `~/.config/orcinus-orca`에 쓴다 | 테스트 프로세스는 빈 임시 HOME·XDG·Git 설정으로 돈다. 호스트에 Claude/OpenCode/Git 설정이 있어도 결과가 같고 실제 홈은 바뀌지 않는다 |
| C. 배포 구성 차이 | 폐쇄망 포크가 `app/deployment/*.ts`(인증·게이트·Plugin·모델 기여·spawn env·사용량·연결 행)를 채우면 OSS 기본값("비어 있다")을 고정한 테스트 7파일 13건이 깨진다(§8) | 기본 배포 내용을 고정한 단언은 두지 않는다. 배포 모듈에 기대는 테스트는 자기 fixture를 명시한다 |

성공 한 문장: **5년 전 사무용 PC급 러너, 사내 설정이 채워진 호스트, 배포를 채운 포크 어디에서도 같은 코드는 같은 테스트 결과를 낸다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Ci 러너 환경이 생각보다 성능이 낮을 수 있다. 5년 전 사무용 데스크톱 pc를 기준하여 .test 기준을 완화하라." | 사용자 턴 1 |
| 명시 요구 | "또한 프로덕선 환경에 따라 인증, 스킬, 모델 플러그인이 있을 수 있으며, opencode, claude 실행환경에서 설정된 값들이 다를 수 있다. 이런것들에 대해서는 잠재덕으로 테스트 코드로 만들지 않거나 기대값들을 변경하라" | 사용자 턴 1 |
| 명시 결정 | 배율 = "실-git도 배율 적용"(실-git 파일 예산까지 같은 배율, 게이트 규칙 유지, 배율 ×3) · 첫 답 "Git 인프라는 유지" | 사용자 질의 응답 1·5 |
| 명시 결정 | 호스트 설정 = "격리 + 기대값 유지" · Git 설정 = "포함" · 배율 덮어쓰기 = "둔다" | 사용자 질의 응답 2·3·4 |
| 추론 의도 | CI 작업 상한도 저장소 변수로 올릴 수 있어야 한다 — 배율만 올리면 작업 상한(30분)이 먼저 끊는다 | 측정: Test 단계 8m43s · 작업 13m43s(run 41647319393) × 3 > 30분 |
| 추론 의도 | 고정 포트 충돌도 "실행환경 값 차이"다 — 포트 45211~는 리눅스 임시 포트 대역(32768–60999) 안이다 | `/proc/sys/net/ipv4/ip_local_port_range` · §8 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 테스트 시간 예산 전부에 **배율 ×3**을 적용한다 — 전역 케이스·훅, `vi.waitFor`, 파일 예산(`vi.setConfig`), 케이스 인라인 타임아웃, 테스트 소유 실시간 마감, 실-git 픽스처 상한·정리 backstop, CI 작업 상한 | "5년 전 사무용 데스크톱 pc를 기준하여" · "실-git도 배율 적용 … 배율은 ×3" | 사용자 턴 1 · 응답 5 | ACTIVE | — |
| D-002 | 배율 SSOT는 한 모듈이다. `ORCA_TEST_TIME_SCALE`로 덮어쓴다 — 미설정·빈 값은 3, **1 이상의 유한한 수**만 허용하고 그 밖은 vitest 시작 시 실패 | "러너 운영자가 코드 수정 없이 더 키울 수 있게" → "둔다" | 응답 4 | ACTIVE | — |
| D-003 | 기준값(base): 케이스 **20s**, 훅 **20s**(vitest 기본 10s에서 케이스와 같게 상향), `vi.waitFor` 기본 **5s**(vitest 기본 1s에서 상향), 파일 예산·인라인·마감·실-git 상수는 **현재 리터럴 그대로**. 실효값 = base × 배율 → 케이스·훅 60s, `vi.waitFor` 15s | 사용자가 고른 ×3 선택지 문구: "케이스·훅 60초, vi.waitFor 기본 15초" | 응답 1·5 | ACTIVE | — |
| D-004 | CI 작업 상한 = 현재값 × 3 — `ci.yml` 30→**90**분, `release.yml` 45→**135**분. 저장소 변수 `ORCA_CI_TIMEOUT_MINUTES`·`ORCA_RELEASE_TIMEOUT_MINUTES`가 있으면 그 값 | D-001 균일 배율. 두 선택지 문구의 CI 값(65·90분)이 갈렸으나 최종 답 "배율 적용"의 정의(현재값×3)로 닫는다. 변수는 D-002 조건절에서 유도 | 응답 5 · §2 추론 | ACTIVE | — |
| D-005 | 호스트 격리: vitest setup이 테스트 파일마다 임시 루트를 만들어 `HOME`·`USERPROFILE`·`XDG_{CONFIG,DATA,CACHE,STATE}_HOME`·(win32)`ProgramData`를 그 아래로 바꾸고, `ANTHROPIC_*`·`CLAUDE_*`·`CLAUDECODE`·`OPENCODE_*`·`GIT_*` 변수를 지운다. **기존 테스트 기대값은 바꾸지 않는다** | "격리 + 기대값 유지" | 응답 2 | ACTIVE | — |
| D-006 | Git 설정도 격리한다 — `GIT_CONFIG_GLOBAL`=빈 파일, `GIT_CONFIG_NOSYSTEM=1`. 기본 브랜치 이름에 기대는 단언 1곳은 저장소가 실제로 만든 이름을 읽는다 | "포함" · Git 3.0의 기본 브랜치 변경도 같은 축 | 응답 3 | ACTIVE | — |
| D-007 | 배포 구성(인증·게이트·Plugin·로그인 프리·모델 기여·augmenter·spawn env·사용량·연결 행)의 **OSS 기본값을 고정한 단언은 테스트로 두지 않는다**(삭제). 배포 모듈을 조립 도구로만 쓰던 테스트는 자기 fixture를 명시하도록 바꾼다(mock 또는 행 조각 helper) | "인증, 스킬, 모델 플러그인이 있을 수 있으며 … 테스트 코드로 만들지 않거나 기대값들을 변경하라" | 사용자 턴 1 | ACTIVE | — |
| D-008 | 번들 스킬(`resources/builtin/skills`)은 바꾸지 않는다 — 포크가 스킬을 더해도 실패 0 | 측정 §8 | 조사 | ACTIVE | — |
| D-009 | 실-git 인프라(픽스처 `execGit`·`removeTempRoots`·게이트 규칙 A~E)는 유지한다. 파일 예산의 **기준값과 도출식 주석은 그대로** 두고 배율만 씌운다 | "Git 인프라는 유지" + "실-git도 배율 적용(게이트 규칙은 유지)" | 응답 1·5 | ACTIVE | — |
| D-010 | 실제 포트에 바인딩하는 테스트는 OS가 준 빈 포트를 쓴다 | §2 추론(임시 포트 대역 충돌) | 조사 | ACTIVE | — |
| D-011 | 리눅스 전용 기존 실패 22건(9파일 — Windows 경로·Claude 플러그인 Linux 차이)은 범위 밖이다 | CI 정본은 windows 러너 | 측정 §8 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-011 (Baseline V).
- 변경된 결정: 없음. 기존 handoff 결정과의 관계는 §16.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001 ↔ AC1·AC2·AC3·AC5~AC9(전 예산 자리) · D-002 ↔ AC4·AC9 · D-003 ↔ AC1~AC3(60s·60s·15s) · D-004 ↔ AC9(90·135분) · D-005 ↔ AC10~AC13(기대값 미변경 = AC16 회귀) · D-006 ↔ AC10·AC12·AC14(브랜치 이름) · D-007 ↔ AC15 · D-008 ↔ AC15(스킬 포크 0건 유지) · D-009 ↔ AC5·AC8(A~E 유지) · D-010 ↔ AC17 · D-011 ↔ AC16(22건 집합 유지).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 시간 초과 원인은 고정 예산, 환경 실패 원인은 호스트 읽기 | §8 측정: 모사 감속 2건 모두 기본 1s `vi.waitFor` · 호스트 실패 전부 HOME/env 키로 분해됨 |
| 이미 기존 코드가 충족하는가 | 일부 — 실-git 파일 예산은 이미 self-hosted spawn 6s × 1.5 가정 | `src/main/infra/git/repository.test.ts:8-13` 주석 · 나머지 예산은 미충족 |
| 더 작은 해법이 있는가 | 개별 테스트 수정(질의 선택지 "개별 테스트만 수정")은 사용자가 고르지 않았다 | 응답 2 |
| 선행 자료 주장 대조 | `vitest.config.ts:25` "늘려도 멈춤은 그대로 잡힌다" — 유효(예산은 유한) | 배율은 유한수만 허용(D-002) |
| ACTIVE 결정·기존 채택 결정과 충돌 | 0248 D-011/AC15·0237 D-030("기본 배포 `[]` 유지")의 **테스트 고정**만 대체 — OSS 기본값이 빈 배열인 사실 자체는 유지 | §16 |

- 사용자에게 올릴 결정: 없음(질의 5건으로 닫음).
- 코드 조사로 닫은 사실: 영향 키·파일·자리 수 전부(§8).

## 5. 동작 / 사용자 흐름

```text
[개발자/CI가 npm test 또는 vitest run 실행]
  → vitest.config 로드: ORCA_TEST_TIME_SCALE 해석(미설정=3) → 케이스·훅 예산 = 20s × 배율
       ↘ 잘못된 값(0.5·abc·Infinity) → 즉시 실패, 메시지에 변수명·값
  → 테스트 파일마다 setup: 임시 HOME·XDG·Git 설정, 하네스 변수 제거, vi.waitFor 기본 5s × 배율
  → 테스트 실행 — 호스트 설정·배포 구성·느린 러너와 무관한 결과
  → 파일 종료: 임시 루트 정리(실패는 무시 — 실제 홈은 건드리지 않았다)
[CI] 작업 상한 = vars.ORCA_CI_TIMEOUT_MINUTES || 90 (release: … || 135)
     Test 단계에 ORCA_TEST_TIME_SCALE = vars.ORCA_TEST_TIME_SCALE 전달
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 변수 미설정 | 배율 3 | 케이스·훅 60s, `vi.waitFor` 기본 15s, CI 90분 |
| `ORCA_TEST_TIME_SCALE=5` | 배율 5 | 모든 예산 5배(케이스 100s 등). CI 상한은 별도 변수 |
| `ORCA_TEST_TIME_SCALE=0.5`·`abc` | config 로드 throw | vitest 비정상 종료 + `ORCA_TEST_TIME_SCALE` 메시지 |
| 테스트가 실제로 멈춤 | 유한 예산에서 끊김 | 실패 보고가 3배 늦어질 뿐 — 멈춤은 그대로 실패 |
| 호스트에 `~/.config/opencode` mcp·`CLAUDE_CONFIG_DIR`·서명 강제 git | setup이 가림 | 깨끗한 호스트와 같은 결과, 실제 홈 무변경 |
| 포크가 `app/deployment` 채움 | 기본값 고정 단언 없음 | 같은 결과 |

### 파생 UX / 엣지케이스

- 외부환경/폐쇄망: CI 변수는 GitHub 저장소 Variables에 둔다(코드 수정 없음). self-hosted 러너도 같은 변수를 읽는다.
- concurrency: 임시 루트는 파일마다 따로 — 병렬 워커가 HOME을 공유하지 않는다.
- opt-in 실기 테스트(`ORCA_TEST_OPENCODE_EXE`·`ORCA_ARTIFACT_LIVE`): `ORCA_*` 변수는 지우지 않는다.

## 6. 범위 / 비범위

- **범위**: `app/vitest.config.ts`, 신규 `app/scripts/test-time.mjs`·`test-host.mjs`·`vitest-setup.mjs`(+테스트), `app/scripts/check-test-budgets.mjs`(+테스트), 예산·마감 자리 테스트 파일, 실-git 픽스처 상수, 배포 결합 13건, `loopback-callback.test.ts`, `service.test.ts:245`, `.github/workflows/{ci,release}.yml`, 문서(`app/AGENTS.md`·`docs/guides/release-operations.md`).
- **비범위**: 프로덕션 코드의 타임아웃(테스트가 아닌 앱 동작), 리눅스 기준선 22건(D-011), 번들 스킬(D-008), 프로덕션 기본 배포 내용(빈 배열 유지).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| Windows 백신·디스크 지연의 기계 모사 | 아니오 | 사람 실기 AC18 |
| 리눅스 기준선 22건 | 아니오 | 별도 handoff 후보 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 실효 케이스 예산 = 20_000 × 배율 | vitest 테스트: `task.timeout === 20_000 * 해석 배율`(무설정 60_000) | `vitest.config.ts` → worker |
| R-01 | AT-01 / AC2 | 실효 훅 예산 = 20_000 × 배율 | node 테스트: `ORCA_TEST_TIME_SCALE` 1·3·5로 `vitest.config.ts` import → `test.hookTimeout` 20_000·60_000·100_000, `testTimeout`도 같음 | 같음 |
| R-01 | AT-01 / AC3 | `vi.waitFor` 무옵션 5_000×배율, 명시 `t`는 `t×배율`, 숫자 인자도 ×배율, `interval` 보존 | 순수 함수 테스트 4분기 + vitest 배선 테스트: 무옵션 `vi.waitFor`가 1.5s 넘게 재시도 후 성공 | setup → 모든 `vi.waitFor` 호출(172곳/51파일) |
| R-02 | AT-02 / AC4 | 배율 해석: 미설정·`''`·공백→3, `1`·`1.5`·`5`→그 값, `0`·`0.99`·`-1`·`abc`·`Infinity`·`NaN`→throw(메시지에 변수명·원값) · 잘못된 값이면 vitest가 비정상 종료 | 순수 함수 테스트 + node 테스트: 잘못된 값으로 config import → reject | `test-time.mjs` → config |
| R-01 | AT-01 / AC5 | 파일 예산 20곳이 `scaledBudget({...})`를 지나고 기준값은 현재 리터럴 그대로 | 게이트 (F) red/green 테스트 + `--report` 출력 20곳 = §10 EP-03 목록(차집합 0) | 각 테스트 파일 최상위 `vi.setConfig` |
| R-01 | AT-01 / AC6 | 케이스 인라인 타임아웃 6곳이 `scaleMs(base)`를 지난다 | 게이트 (F) red/green + `--report` 6곳 = EP-04 | it/test 셋째 인자 |
| R-01 | AT-01 / AC7 | 테스트 소유 실시간 마감 4곳은 `scaleMs`, 의미 대기 6곳은 허용 목록(파일·값·사유) | 게이트 (H): 새 리터럴 마감(≥1000ms)이 허용 목록 밖이면 red · `--report` 10곳 = EP-05 | 테스트 본문 `setTimeout`·`Date.now()+N` |
| R-01 | AT-01 / AC8 | 실-git 픽스처 상수 3개(`FIXTURE_GIT_TIMEOUT_MS`·`KILL_GRACE_MS`·`RM_RETRY.retryDelay`)가 `scaleMs(600_000·5_000·200)` · 게이트 (G): 픽스처 기준 상한 > 실-git 파일 기준 예산 최대값 · 기존 규칙 (A)~(E) 그대로 통과 | 게이트 node 테스트(G red/green) + 기존 `check-test-budgets.test.mjs` 케이스 유지 + 픽스처 상수 vitest 테스트 | `temp-repo.testfixture.ts` |
| R-02 | AT-02 / AC9 | `ci.yml` 상한 `fromJSON(vars.ORCA_CI_TIMEOUT_MINUTES \|\| '90')`, `release.yml` `… \|\| '135'`, 두 Test 단계 env `ORCA_TEST_TIME_SCALE: ${{ vars.ORCA_TEST_TIME_SCALE }}` · Windows CI green | node 테스트(워크플로 텍스트 단언) + `gate:` PR Windows CI 실행 | GitHub Actions |
| R-03 | AT-03 / AC10 | 격리 env 순수 함수: 지움 = `ANTHROPIC_`·`CLAUDE_`·`OPENCODE_`·`GIT_` 접두사 + `CLAUDECODE` · 보존 = 그 밖(`ORCA_*`·`PATH`·`TEMP`·`TMPDIR`·프록시) · 바꿈 = `HOME`·`USERPROFILE`·XDG 4종·(win32만)`ProgramData` → 루트 하위 · Git = `GIT_CONFIG_GLOBAL`(빈 파일)·`GIT_CONFIG_NOSYSTEM=1` | node 테스트: 키 표본마다 단언(형제 키와 맞바꿔도 red), win32/linux 분기 각각 | `test-host.mjs` |
| R-03 | AT-03 / AC11 | 배선: 모든 테스트 파일에서 `os.homedir()`가 setup 루트 하위이고 setup 전 원래 HOME과 다르다 · XDG 4종 루트 하위 · `GIT_CONFIG_NOSYSTEM='1'` · `GIT_CONFIG_GLOBAL` 빈 파일 · 지움 대상 키 0 | vitest 배선 테스트(원래 HOME은 setup이 전역 심볼에 기록) | `vitest-setup.mjs` → `process.env` |
| R-03 | AT-03 / AC12 | 합성 사내 호스트(전역 opencode `mcp` enabled/disabled · `OPENCODE_CONFIG`·`OPENCODE_CONFIG_DIR`·`OPENCODE_DISABLE_PROJECT_CONFIG` · `ANTHROPIC_MODEL`·`CLAUDE_CODE_DISABLE_1M_CONTEXT`·`CLAUDE_CONFIG_DIR` · `~/.gitconfig`와 `GIT_CONFIG_SYSTEM` 파일의 `commit.gpgsign=true`+없는 gpg)에서 원인별 대표 9파일이 통과 | vitest 시스템 테스트: 자식 vitest를 그 env로 실행 → exit 0 | 실제 config·setup·production reader |
| R-03 | AT-03 / AC13 | 위 실행 뒤 합성 HOME 트리(경로·크기·mtime)가 실행 전과 같다 — 실제 홈 쓰기 2파일 포함 | AC12와 같은 시스템 테스트의 사후 단언 | 같음 |
| R-03 | AT-03 / AC14 | `service.test.ts` 별칭 rollback 케이스가 기본 브랜치 이름(`master`)에 기대지 않는다 | 기대값을 저장소 생성 직후 `git symbolic-ref --short HEAD`로 읽은 이름에서 가져온다 · 변이: 픽스처 `git init`에 `-b develop`(기본 브랜치가 다른 호스트·Git 3.0 모사) → AS-IS 단언 red, TO-BE green | `features/worktrees/service.test.ts` |
| R-04 | AT-04 / AC15 | 배포 결합 13자리(EP-10)를 처리: 삭제 6 · 단언 절 삭제 2 · fixture 고정 2 · 행 조각 helper 전환 3 → 포크 모사 실행에서 기준 대비 신규 실패 0 | 포크 모사 절차(`evidence/fork-deployment.py` → 전체 스위트 → `newfails.mjs`) + 삭제 자리 음성 검색 + 남긴 테스트 green | `app/deployment/*.ts` 소비 테스트 |
| R-01·R-03 | AT-05 / AC16 | 회귀: 리눅스 깨끗한 호스트 실패 집합 = 기준선 22건 그대로 · 케이스 수 = 기준 8,445 − 삭제 6 + 신규 · 저성능 모사(1코어·8워커)·합성 사내 호스트에서 기준 대비 신규 실패 0 | `evidence/*-run.sh` + `newfails.mjs` | 전체 스위트 |
| R-05 | AT-06 / AC17 | `loopback-callback.test.ts`가 OS 빈 포트를 받아 쓰고 같은 포트 재바인딩 단언을 유지 · 테스트가 실제 바인딩하는 고정 포트 리터럴 0 | 그 파일 green + 검색 `rg -n "nextPort\|4521[0-9]" app/src --glob '*.test.ts'` → 0 | `infra/loopback-callback.ts` |
| R-01 | AT-07 / AC18 | **사람 실기**: 5년 전 사무용 PC급 Windows(사내 백신 포함) 또는 self-hosted 러너에서 `cd app && npm test` green, 소요 시간 기록 | 사람 실행 기록 | 실제 외부환경 — 백신·디스크 지연은 리눅스에서 모사 불가 |
| — | AC19 | 문서: `app/AGENTS.md`(예산·격리 규칙, 게이트 F~H), `docs/guides/release-operations.md`(저장소 변수 2+1종), `vitest.config.ts` 주석 · `node scripts/check-doc-inventory.mjs --check` green | 문서 diff + 인벤토리 게이트 | 문서 |

### AC 검증 주의사항

- 기존 테스트 재사용: `check-test-budgets.test.mjs`의 (A)~(E) 케이스(최상위 describe 9 · test 28, `:48`~`:254`)를 유지하되 fixture 문자열을 `scaledBudget` 형태로 갱신한다 — 케이스 이름·의도는 그대로.
- 사람 실기 항목: AC18만 — CPU 모사는 AC16이 기계로 닫고, 백신·디스크 지연만 남는다.
- 0건 기준(AC17 고정 포트·AC15 삭제 자리)은 음성 검색이다 — 양성 짝은 AC17 green·AC15 남긴 테스트 green.
- AC12의 대표 9파일은 격리 없이(AC12 변이 M-A) 같은 env에서 실제로 실패한다 — §8 측정. 대표 파일이 나중에 호스트 독립적으로 바뀌면 그 자리를 다른 대표로 바꾼다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 신규 테스트 인프라 계약, 상속할 V 없음.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 A · D-001·D-003 — 모든 시간 예산 = base × 배율 | NEW | — |
| R-02 | R | §5 — 배율·CI 상한 덮어쓰기와 검증 | NEW | — |
| R-03 | R | §1 B — 호스트 설정 무관 결과 + 실제 홈 무변경 | NEW | — |
| R-04 | R | §1 C — 배포 구성 무관 | NEW | — |
| R-05 | R | D-010 — 고정 포트 비의존 | NEW | — |
| SD-01 | SD | §9 — config 로드 → 파일별 setup → 실행 → 정리, 자식 프로세스 상속 | NEW | — |
| AR-01 | AR | §9·§10 — 배율 SSOT ↔ 소비자(config·setup·픽스처·테스트·게이트) | NEW | — |
| AR-02 | AR | §9·§10 — 격리 env ↔ production reader·자식 프로세스 | NEW | — |
| AR-03 | AR | §10 — 예산 게이트 (F)(G)(H) + (A)~(E) | NEW (A~E는 INHERITED 내용) | `scripts/check-test-budgets.mjs@eed9741` |
| MD-01 | MD | §10 — 배율 순수 함수 | NEW | — |
| MD-02 | MD | §10 — 격리 env 순수 함수 | NEW | — |
| AT-01~07 · ST-01 · IT-01~03 · UT-01~02 | 검증 | §7 · §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 배율 해석 → config(케이스·훅) → setup(waitFor) → 파일 예산·인라인·마감·픽스처 → 실행 | 신규 `src/main/infra/test-environment.test.ts`('케이스 예산'·'waitFor 기본 대기') · `scripts/test-time.test.mjs`('config 예산'·'waitFor 옵션') · `scripts/check-test-budgets.test.mjs`(F·G·H) · `--report` 대조 | required — 구조 oracle(게이트). **M1** `vitest.config.ts` hookTimeout 제거 → AC2 red · **M2** wrapper가 명시 timeout을 배율 없이 통과 → AC3 red · **M3** EP-03 한 자리를 리터럴로 되돌림 → (F) red · **M4** EP-04 한 자리 리터럴 → (F) red · **M5** EP-05 마감 한 자리 리터럴 → (H) red · **M6** 픽스처 기준 상한을 300_000 → (G) red | EP-01(2)·EP-02(1)·EP-03(20)·EP-04(6)·EP-05(10)·EP-06(3) = 42 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `ORCA_TEST_TIME_SCALE` → `resolveTestTimeScale` → config import 실패/성공 · `vars.*` → 워크플로 | `scripts/test-time.test.mjs`('배율 해석' 표본 12개 · '잘못된 배율은 config 로드 실패') · `scripts/test-time.test.mjs`('워크플로 상한·변수') · `gate:` PR Windows CI | required — **M7** 하한 비교를 `> 0`으로 → '0.99' 표본 red · **M8** `ci.yml` 기본 90을 30으로 → 워크플로 테스트 red | EP-07(4)·EP-08(2) = 6 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 합성 HOME/env → 자식 vitest → config → setup(격리) → production reader(opencode 전역 설정·Claude 경로·git) → 결과·홈 트리 | 신규 `src/main/infra/test-environment.hostile.test.ts`('합성 사내 호스트에서 대표 테스트가 통과하고 홈이 바뀌지 않는다') | required — **M-A** `vitest.config.ts`에서 `setupFiles` 제거 → 자식 실패(exit≠0) · **M-B** 지움 접두사에서 `OPENCODE_` 제거 → 자식 실패 · **M-C** 지움 접두사에서 `GIT_` 제거 → 자식 env의 `GIT_CONFIG_SYSTEM`(서명 강제 파일)이 살아 `repository.test.ts` 실패 · **M-D** HOME 리다이렉트 제거 → 홈 트리 변화 red | EP-09(15) · AC12 대표 9파일 |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 포크 `app/deployment/*.ts` → 소비 테스트 13자리 | 자리별: 삭제 6 → 음성 검색 `rg` 0 · 절 삭제 2·fixture 고정 2·helper 전환 3 → 각 파일 green(기본 배포) + 포크 모사 green(`evidence/fork-deployment.py`) | required — 포크 모사가 곧 적대 증거: **M9** 아무 자리 하나 되돌림 → 포크 실행에서 그 자리 red | EP-10(13) |
| VP-05 | R-05 ↔ AT-06 | REQUIRED | 테스트 → OS 빈 포트 → `awaitLoopbackCallback({port})` | `src/main/infra/loopback-callback.test.ts` 전 케이스 | not selected — 직접 행동 oracle(실제 바인딩) | EP-11(1) |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | vitest 시작 → 파일마다 setup → afterAll 정리 → 자식 프로세스 env 상속 | `test-environment.test.ts`('파일마다 다른 루트'·'자식 프로세스가 격리 env를 받는다') · VP-03 시스템 테스트 | not selected — 행동 단언 | EP-09 적용 자리(1) |
| VP-07 | AR-01 ↔ IT-01 | REQUIRED | `scripts/test-time.mjs` → config·setup·픽스처·테스트 파일 import | VP-01 좌표와 같음 + `typecheck`는 oracle 아님 | VP-01 M1~M6 | EP-01~EP-06 |
| VP-08 | AR-02 ↔ IT-02 | REQUIRED | setup → `process.env` → `os.homedir()`·XDG·git 자식 | `test-environment.test.ts`(AC11) · VP-03 | VP-03 M-A~M-D | EP-09(15) |
| VP-09 | AR-03 ↔ IT-03 | REQUIRED | 테스트 소스 → 게이트 (A)~(H) → CI 'Test budget guard' 단계 | `scripts/check-test-budgets.test.mjs`(기존 A~E + 신규 F·G·H·report) · `gate:node scripts/check-test-budgets.mjs` | VP-01 M3~M6 | EP-03~EP-06 |
| VP-10 | MD-01 ↔ UT-01 | REQUIRED | 순수 함수 | `scripts/test-time.test.mjs` | VP-02 M7 | EP-08 |
| VP-11 | MD-02 ↔ UT-02 | REQUIRED | 순수 함수 | `scripts/test-host.test.mjs` | **M10** 지움 술어와 보존 술어 맞바꿈(`ORCA_` 지움) → red | EP-09 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint·typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error |
| vitest | 테스트 인프라 자체 | `./node_modules/.bin/vitest run` — 리눅스는 기준선 22건 분리 | 22건 밖 신규 실패 |
| node scripts 테스트 | 신규·변경 `scripts/*.mjs` | `node --test "scripts/*.test.mjs"` | 전부 |
| 예산·인벤토리 게이트 | 게이트 변경 · 문서 변경 | `node scripts/check-test-budgets.mjs` · `node scripts/check-doc-inventory.mjs --check` | 전부 |
| Windows CI | 정본 통합 게이트 · 워크플로 변경 | PR `CI` 실행 | 전부 |
| commit trailer | message bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 측정 (2026-11-03, 리눅스 컨테이너 Xeon 2.1GHz 4코어 · Node 22.23.4 · vitest 4.1.10)

| 실행 | 방법 | 결과 |
|---|---|---|
| 기준선(깨끗한 호스트) | `evidence/clean-host-run.sh` — `env -i` + 빈 HOME | 8,445케이스 · 실패 22(9파일, Windows 경로·Claude 플러그인 Linux 차이) · 2m16s |
| 에이전트 실제 호스트 | 실제 `~/.claude`·`CLAUDE_*` 60여 변수 | 기준선과 같은 22 |
| 합성 사내 호스트(설정·변수) | HOME 파일 + 환경변수, gitconfig는 무해 | **+33**(11파일) |
| 합성 사내 호스트(결합) | `evidence/hostile-host-run.sh` — 위 + `CLAUDE_CONFIG_DIR`·`OPENCODE_CONFIG_DIR`·`OPENCODE_DISABLE_PROJECT_CONFIG`·서명 강제 gitconfig | **+113**(29파일) · 실행 중 HOME 새 파일 = confluence 다운로드 경로 |
| ↳ 분해: `~/.config/opencode/opencode.json` | 키별 HOME | `mcp` enabled 12 ∪ disabled 17 = **27**(9파일) · `plugin`·`model`·`agent`·`permission`·스킬·캐시·auth.json·`~/.claude*`·orca sources·`~/.agents` = 0 |
| ↳ 분해: 환경변수 | 변수 하나씩 | `OPENCODE_CONFIG` 16 · `OPENCODE_CONFIG_DIR` 16 · `OPENCODE_DISABLE_PROJECT_CONFIG` 2 · `CLAUDE_CONFIG_DIR` 3 · `ANTHROPIC_MODEL` 1 · `CLAUDE_CODE_DISABLE_1M_CONTEXT` 1 · 나머지 12종(프록시·API 키·BASE_URL·BEDROCK·TMPDIR·OPENCODE_DB 등) 0 |
| ↳ 분해: `~/.gitconfig` | 키별 | `commit.gpgsign=true`+없는 gpg **76**(16파일) · `init.defaultBranch=develop` 1(`service.test.ts:245`) · autocrlf·hooksPath·pull.rebase·user 0 |
| 실제 홈 쓰기 | 직렬 실행 + 파일 mtime | `bootstrap.opencode-warmup.test.ts` → `~/.config/orcinus-orca/orcinus-orca.json` · `confluence/connector.test.ts` → `~/.config/orcinus-orca/downloads/confluence/confluence-test` |
| 저성능 모사 S1 | `evidence/slow-runner-run.sh … 4` (1코어·4워커, 6m42s = 2.96×) | +1 `UsageTab.chart.test.ts`(기본 1s `vi.waitFor`) |
| 저성능 모사 S2 | `… 8` (1코어·8워커, 6m47s) | +2 위 1 + `bootstrap.opencode-warmup.test.ts:282`(기본 1s) · 최장 케이스 `managed-mcp-document-contract` 26.6s/60s · `syntax.test.ts` 12.8s/20s · `error-report.registry` 11.8s/20s |
| 포크 모사 | `evidence/fork-deployment.py`(id `acme-*`) | **+13**(7파일) — fixture와 같은 id 포크에서도 13 · 번들 스킬 추가 0 |
| 고정 포트 | 부하 중 전체 실행 2회 · 단독 300회 | `loopback-callback` favicon 케이스 "fetch failed" 2회 · 단독 0회 → 45211~ 가 임시 포트 대역(32768–60999) 안 |
| 시제품(커밋 안 함) | 격리 setup + waitFor 배율을 별도 작업 트리에 적용 | 합성 사내 호스트(결합과 같은 요인) +0 · S2 +0 · 실행 중 HOME 새 파일 0 |
| CI 실측 | run 41647319393(windows-latest) | 작업 13m43s · Test 8m43s · Lint 2m15s · Typecheck 53s · npm ci 1m16s |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `vi.setConfig` | `node evidence/scan-test-budgets.mjs app` `setConfig` | 20 | 실-git 16(게이트 A 대상) + 기타 4 |
| 케이스 타임아웃 인자 | 같은 스캔 `case` | 6(5파일) | 훅 타임아웃 0 |
| 실시간 마감 후보 | 같은 스캔 `deadline` 4 + `setTimeout` 6 | 10 | 예산 4 · 의미 대기 6(§10 EP-05) |
| `vi.waitFor` | 같은 스캔 `waitFor` | 172(51파일) | 기본 156 · 명시 timeout 13 · interval만 3 |
| 기타 대기 API | `rg -n "waitUntil\(\|expect\.poll\(" app/src -g '*.test.ts'` | 0 | 로컬 helper(`opencode-continuation.test.ts:59`)는 `vi.waitFor` 경유 |
| 호스트 env 키(프로덕션) | `rg -o --no-filename "\b(ANTHROPIC\|CLAUDE\|OPENCODE\|XDG\|GIT)_[A-Z0-9_]+\b\|\bCLAUDECODE\b\|\b(USERPROFILE\|ProgramData\|APPDATA\|LOCALAPPDATA)\b" app/src/main app/src/shared -g '!*.test.ts' -g '!*.testfixture.ts' \| sort -u` | 58종 | D-005 술어 밖 **0**(상수 식별자 포함 전부 접두사 일치) — `homedir()` 29곳·`env.HOME` 2곳은 HOME/USERPROFILE 리다이렉트가 덮는다 |
| 실제 바인딩 고정 포트 | `rg -n "listen\(\|port:\s*[0-9]{4}" app/src -g '*.test.ts'` → 바인딩 확인 | 1파일 | `oauth.test.ts`는 `listen` 주입이라 바인딩 없음 |
| 기본 브랜치 리터럴 | `rg -n "'master'\|'main'" app/src/main -g '*.test.ts'` | 1 | `service.test.ts:245` |
| 배포 모듈 참조 테스트 | `rg -l "deployment/(auth-definitions\|gate-auth\|harness-runtime\|plugins\|connections\|spawn-env\|usage-fetcher)'" app/src -g '*.test.ts'` ∪ `rg -l "from '\./(auth-definitions\|gate-auth\|harness-runtime\|plugins\|connections\|spawn-env\|usage-fetcher)'" app/src/main/app/deployment -g '*.test.ts'` | 15 | 포크에서 실패 7파일 13건은 전부 이 15파일 안 — 5파일은 기본값 직접 단언, `bootstrap.harness`(bootstrap→`gate-auth`)·`mcp-reconcile`(prepare-input→`spawn-env`)은 다른 모듈 경유 |

### 수치 / 전칭 표현 검산

- 합성 호스트 +33 = opencode mcp 27 ∪ env 분해(중복 포함) — 11파일 목록이 분해 합집합과 같다(`newfails.mjs` 비교).
- 포크 13 = 삭제 6 + 절 삭제 2 + fixture 고정 2 + helper 전환 3.
- 예산 자리 42 = 2+1+20+6+10+3(EP-01~06).
- "유일한 바인딩 고정 포트 테스트" 반례 검색: 위 표 — `loopback-callback.test.ts` 하나.
- 기존 테스트 존재 확인: `check-test-budgets.test.mjs:48-254` describe 블록 · `deployment-wiring.test.ts:527-582`('production 배포 factory — 기본 배포 계약') · `:673`('기본 배포는 주입점을 비워 둔다') · `login-free-deployment.test.ts:339`(AC15)·`:305`(AC10 each) · `connections.test.ts:70` · `mail.integration.test.ts:445` · `managed-mcp-document-contract.test.ts:66-71` · `bootstrap.harness.test.ts` 'start forwards its real settings service…' · `mcp-reconcile.test.ts` 'traces warmup navigation…'.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`
- 현재 책임 소유자: 예산 = `vitest.config.ts`(케이스 20s) + vitest 기본(훅 10s·waitFor 1s) + 파일별 리터럴 · 호스트 = 없음(테스트가 실제 HOME/env를 읽음).
- 문제 경로 ①: 느린 러너 → `vi.waitFor` 1s 초과 → "expected … length 1 got 0"(§8 S1·S2).
- 문제 경로 ②: 호스트 `~/.config/opencode/opencode.json` mcp → `openCodeGlobalConfigFiles(env, homedir())`(`adapters/opencode/v1/global-plugins.ts:6`) → 어댑터가 MCP 연결 요청 추가 → fake 서버 요청 목록 불일치.
- 문제 경로 ③: 호스트 `commit.gpgsign=true` → 테스트 `git commit` 실패.
- 문제 경로 ④: 포크 `GATE_AUTH_DEFINITIONS` → `bootstrap.ts:435` `auth.tryBind` → stub에 없음.

```text
vitest run → vitest.config.ts(testTimeout 20s) → worker(실제 HOME/env 상속)
  → 테스트 → production reader(homedir()/process.env) → 호스트 설정 유입
  → vi.waitFor(기본 1s) / 파일 리터럴 예산 / CI 30분
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`, `AR-03`
- 변경 후 책임 소유자: 배율 = `app/scripts/test-time.mjs`(SSOT) · 격리 = `app/scripts/test-host.mjs`(순수) + `app/scripts/vitest-setup.mjs`(적용) · 강제 = `check-test-budgets.mjs` (F)(G)(H).

```text
vitest run
  → vitest.config.ts: import test-time.mjs(ORCA_TEST_TIME_SCALE 해석, 잘못되면 throw)
       testTimeout = hookTimeout = scaleMs(20_000) · setupFiles: [scripts/vitest-setup.mjs]
  → 파일마다 vitest-setup.mjs:
       루트 = mkdtemp(tmpdir, 'orca-test-host-') · env = hermeticTestEnv(process.env, 루트, platform)
       → process.env 갱신(지움·바꿈) · vi.waitFor = 배율 wrapper(1회) · afterAll(루트 정리)
  → 테스트: vi.setConfig(scaledBudget({…})) · it(…, scaleMs(N)) · 마감 scaleMs(N)
       production reader → 임시 HOME/XDG(빈) · git 자식 → 빈 전역 설정
CI: timeout-minutes = fromJSON(vars.* || 기본) · env ORCA_TEST_TIME_SCALE = vars.ORCA_TEST_TIME_SCALE
게이트(CI 'Test budget guard'): (A)~(E) 기존 + (F) 배율 경유 + (G) 픽스처 상한 > 최대 예산 + (H) 마감 허용 목록
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 예산 숫자가 config·vitest 기본·파일 리터럴에 흩어짐 | `test-time.mjs` 한 곳 + 각 자리는 기준값만 | D-001·D-002 | AR-01 / VP-01·07 · §11 |
| data/control flow | worker가 호스트 env 상속 | setup이 파일마다 격리 env로 교체 | D-005·D-006 | AR-02 / VP-03·08 |
| state/contract | 배포 기본값 고정 단언 8개 + 기본 조립 의존 5개 | 고정 단언 삭제, fixture·helper 명시 | D-007 | R-04 / VP-04 |
| error/lifecycle | 임시 루트 없음 | 파일 종료 시 루트 정리(실패 무시) · 잘못된 배율은 시작 실패 | D-002 | SD-01 / VP-06 |
| test seam/관측점 | 예산 위반을 잡는 장치 = 실-git 게이트 A~E | + F·G·H · `--report` · 배선 테스트 · 시스템 테스트 | 회귀 방지 | AR-03 / VP-09 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `scripts/test-time.mjs` | 배율 해석·환산 | env → scale · base → ms · waitFor 옵션 → 환산 옵션 | `vitest.config.ts` · `vitest-setup.mjs` · 테스트 파일 · `temp-repo.testfixture.ts` · 게이트(기준값 상수) |
| `scripts/test-time.d.mts` | TS 호출부 타입 | — | TS 테스트(`tsconfig.test`·`tsconfig.web` 둘 다 `noImplicitAny:false`라 없으면 any — 타입을 위해 둔다) |
| `scripts/test-host.mjs` | 격리 env 계산(순수) | `{ env, root, platform }` → `{ set, remove }` | `vitest-setup.mjs` |
| `scripts/vitest-setup.mjs` | 적용(I/O)·waitFor 설치·정리 | — | vitest `setupFiles` |
| `scripts/check-test-budgets.mjs` | 예산 형태 강제 | 테스트 소스 → 위반 목록 / `--report` | CI·`npm test`(node --test) |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-01 / VP-01 EP-01 | 전역 케이스·훅 = `scaleMs(20_000)` | `test-time.mjs` `BASE_CASE_MS`·`BASE_HOOK_MS` | config | 2자리: `app/vitest.config.ts` `testTimeout` · `hookTimeout` | `rg -n "testTimeout\|hookTimeout" app/vitest.config.ts` → TO-BE 2 | 느린 러너에서 일반 케이스·훅 초과 |
| AR-01 / VP-01 EP-02 | `vi.waitFor` 무옵션 `5_000×s`, 명시 `t×s`, 숫자 `t×s`, `interval` 보존 | `test-time.mjs` `scaledWaitForOptions` | setup | 1자리: `app/scripts/vitest-setup.mjs` wrapper 설치 — 호출 172곳(51파일)은 전부 `vi.waitFor` 경유 | `rg -n "vi\.waitFor\s*=" app/scripts` → 1 · `rg -c "vi\.waitFor\(" app/src -g '*.test.ts'` → 172/51(변화 0) | §8 S1·S2 실패 재발 |
| AR-01 / VP-01·09 EP-03 | 파일 예산 = `vi.setConfig(scaledBudget({기준값}))` · 기준값 = 현재 리터럴 | 각 파일 + `scaledBudget` | 테스트 작성자 · 게이트 (F) | 20자리: `app/artifact-sdk-live:26` · `chat-turn/opencode-continuation:54` · `chat-turn/prepare-progress:33` · `git-execution:16` · `legacy-paths:34` · `managed-mcp-document-contract:8` · `managed-mcp.cli.integration:23` · `worktrees/ipc-integration:30` · `worktrees/reject-reasons:23` · `worktrees/safe-delete:27` · `worktrees/service:21` · `git/git-cli:30` · `git/git-consistency:11` · `git/git-diff-commit:14` · `git/git-diff:41` · `git/git-safety:13` · `git/git-snapshot:11` · `git/probe:9` · `git/queue-entry:22` · `git/repository:13` (경로 접두사 `app/src/main/`) | `node evidence/scan-test-budgets.mjs app` `setConfig` → 20 · TO-BE `node scripts/check-test-budgets.mjs --report` `setConfig` 20 = 목록(차집합 0) | 리터럴로 남은 파일은 배율 무시 |
| AR-01 / VP-01·09 EP-04 | 케이스 인라인 타임아웃 = `scaleMs(기준값)` | 각 자리 | 게이트 (F) | 6자리: `adapters/opencode/v1/adapter.persistent:321`(10_000) · `discovery-cache.hold-race:45`(10000) · `:60`(10000) · `app/handlers/session-resources.claude-assembly:127`(20000) · `app/harnesses/opencode/native-storage.integration:68`(330000) · `infra/config/file-mutation:250`(45_000) | 같은 스캔 `case` → 6 · `--report` `case` | 인라인이 전역(60s)보다 작게 남아 이김 |
| AR-01 / VP-01·09 EP-05 | 테스트 소유 실시간 마감 = `scaleMs(기준값)` · 의미 대기 = 허용 목록 `{file, value, reason}` | 게이트 `SEMANTIC_DELAYS` | 게이트 (H) | 10자리 — **예산 4**: `app/artifact-sdk-live:71`(90_000 abort) · `app/managed-mcp.cli.integration:322`(60_000 close) · `:420`(10_000 exit) · `infra/config/file-mutation:221`(30_000 준비) / **의미 6**: `adapter.persistent:299`(2700 — production AbortSignal 2.5s를 넘기는 대기) · `session-resources.claude-assembly:106`(1000 — mtime 구분) · `features/plugins/mail/sync-manager:40`(25_000 — fake 타이머 지연 응답 자극) · `adapter.test:343`(5_001)·`:387`(5000 — `vi.setSystemTime`) · `infra/git/git-snapshot:51`(60_000 — 데이터 시각) | 같은 스캔 `deadline`+`setTimeout` → 10 | 의미 대기를 배율하면 production 계약 시험이 바뀐다 · 예산 마감을 안 하면 느린 러너에서 끊김 |
| AR-01 / VP-01 EP-06 | 실-git 픽스처 상수 = `scaleMs(600_000)`·`scaleMs(5_000)`·`retryDelay: scaleMs(200)` · (G) 기준 상한 600_000 > 최대 기준 예산 369_000 | `infra/git/temp-repo.testfixture.ts` | 픽스처 · 게이트 (G) | 3자리: `FIXTURE_GIT_TIMEOUT_MS` · `KILL_GRACE_MS` · `RM_RETRY` | `rg -n "const (FIXTURE_GIT_TIMEOUT_MS\|KILL_GRACE_MS\|RM_RETRY)" app/src/main/infra/git/temp-repo.testfixture.ts` → 3 | 상한이 배율된 파일 예산보다 먼저 끊음 |
| R-02 / VP-02 EP-07 | CI 상한·배율 전달 | 워크플로 | GitHub Actions | 4자리: `ci.yml` `timeout-minutes` · `ci.yml` Test `env.ORCA_TEST_TIME_SCALE` · `release.yml` `timeout-minutes` · `release.yml` Test `env.ORCA_TEST_TIME_SCALE` | `rg -n "timeout-minutes\|ORCA_TEST_TIME_SCALE" .github/workflows` → TO-BE 4 | 작업이 테스트보다 먼저 끊김 · 변수 무시 |
| MD-01 / VP-02·10 EP-08 | 배율 해석: 유한수 ≥1, 미설정·빈 값 = 3 | `test-time.mjs` `resolveTestTimeScale` | config import 시 | 2자리: `resolveTestTimeScale` 본문 · `TEST_TIME_SCALE` 모듈 상수(로드 시 1회 해석) | `rg -n "export (function resolveTestTimeScale\|const TEST_TIME_SCALE)" app/scripts/test-time.mjs` → 2 | 0·음수·NaN 배율로 예산 0/무한 |
| AR-02 / VP-03·08·11 EP-09 | 격리 env | `test-host.mjs` | setup | 15자리 — 적용 1(`vitest-setup.mjs`) · 바꿈 7(`HOME`·`USERPROFILE`·`XDG_CONFIG_HOME`·`XDG_DATA_HOME`·`XDG_CACHE_HOME`·`XDG_STATE_HOME`·win32 `ProgramData`) · 지움 술어 5(`ANTHROPIC_`·`CLAUDE_`·`OPENCODE_`·`GIT_` 접두사·`CLAUDECODE`) · Git 2(`GIT_CONFIG_GLOBAL`·`GIT_CONFIG_NOSYSTEM`) | §8 "호스트 env 키" 검색 → 술어 밖 0 · `rg -n "HOME\|USERPROFILE\|XDG_\|ProgramData\|GIT_CONFIG\|ANTHROPIC_\|CLAUDE\|OPENCODE_\|GIT_" app/scripts/test-host.mjs` → 15 | 호스트 설정이 테스트로 샌다 · 실제 홈 쓰기 |
| R-04 / VP-04 EP-10 | 배포 결합 처리 | 각 테스트 | 구현자 | 13자리 — **삭제 6**: `deployment-wiring.test.ts` 'createPluginBindings 는 기본 배포에서 비어 있다'·'createConnectionSources 는 gate·plugin row 만 만든다'·'augmenter factory 3종은 기본 배포에서 비어 있다'·'createUsageFetcher 는 기본 배포에서 undefined 다…'·'기본 배포는 주입점을 비워 둔다…' · `login-free-deployment.test.ts` '기본 production 배포는 … 비어 있다 (AC15)' / **절 삭제 2**: `mail.integration.test.ts` 'compiles HTTP and POP3 recipes…'의 `createPluginBindings(deps)` `[]` 단언(제목의 "OSS default remains empty" 포함) · `managed-mcp-document-contract.test.ts` 'matches deployment recipes…'의 production `createPluginBindings` `[]`·add/remove 단언 / **fixture 고정 2**: `bootstrap.harness.test.ts` 'start forwards its real settings service…' → `./deployment/gate-auth`·`./deployment/auth-definitions` mock 추가 · `harnesses/opencode/mcp-reconcile.test.ts` 'traces warmup navigation…' → `../../deployment/spawn-env` mock(`SPAWN_ENV_INJECTOR: undefined`) / **helper 전환 3**: `login-free-deployment.test.ts` 'wire %s는 …(AC10)' ×2 → production `createConnectionSources` 대신 `gateRows`+`pluginRows` · `connections.test.ts` '기본 factory는 gate·plugin row만 만든다' → 제목·대상을 `gateRows` 단위로 바꿔 "catalog 입력이 없으면 행에 catalog 키가 없다"를 유지 | `evidence/fork-deployment.py <worktree app>` → 전체 스위트 → `newfails.mjs` → 13 · 삭제 음성: `rg -n "기본 배포에서 비어\|기본 배포에서 undefined\|주입점을 비워\|gate·plugin row만\|gate·plugin row 만\|OSS default remains empty\|비어 있다 \(AC15\)" app/src -g '*.test.ts'` → AS-IS 8줄(삭제 6 + 제목 변경 2: mail·connections) · TO-BE 0 | 포크 CI 실패 |
| R-05 / VP-05 EP-11 | 동적 빈 포트 | 테스트 | 테스트 | 1자리: `infra/loopback-callback.test.ts` `nextPort`/`port()` | `rg -n "nextPort\|45211" app/src -g '*.test.ts'` → AS-IS 2줄 · TO-BE 0 | 다른 프로세스 포트와 충돌 |

- 자리 목록은 그 검색 출력과 차집합 0이어야 한다. verify가 시도해 테스트가 잡지 못한 고장은 목록 안팎 모두 다음 구현이 고친다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).
- 같은 규칙이 여러 레이어에 있다면 SSOT: 배율·기준값은 `test-time.mjs`만 갖는다. 게이트는 `BASE_*`를 import하고 숫자를 다시 적지 않는다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 칸: 없음.
- Git 키의 역할: `GIT_CONFIG_GLOBAL`은 HOME 리다이렉트와 겹치는 이중 방어다. 시스템 설정(`/etc/gitconfig`·`Program Files\Git\etc\gitconfig`)은 `GIT_CONFIG_NOSYSTEM`만 막는다 — 테스트가 시스템 파일을 만들 수 없어 그 자리의 좌표는 UT(AC10)·배선(AC11)까지다.
- 선택적 필드: `vi.waitFor(cb, options)`의 `options` 미지정·숫자·객체(timeout 유/무) 4분기 모두 §AC3. `interval`은 그대로 넘긴다.
- 외부 경계: `vi.waitFor`는 vitest 4.1.10 `test.DNmyFkvJ.js:3359` — `{ interval = 50, timeout = 1e3 }` 기본, 가짜 타이머면 poll마다 `advanceTimersByTime(interval)`. wrapper는 timeout만 바꾸므로 가짜 타이머 의미 불변(시제품 확인: 3s 가짜 타이머 발화).

### 계약 세부

```text
test-time.mjs
  DEFAULT_TEST_TIME_SCALE = 3 · TEST_TIME_SCALE_ENV = 'ORCA_TEST_TIME_SCALE'
  BASE_CASE_MS = 20_000 · BASE_HOOK_MS = 20_000 · BASE_WAIT_FOR_MS = 5_000
  resolveTestTimeScale(env = process.env): number
    raw 미설정·trim()==='' → 3 · Number(raw) 유한 && ≥ 1 → 그 값 · 그 밖 → throw Error(`ORCA_TEST_TIME_SCALE=<raw> — 1 이상의 유한한 수여야 한다`)
  TEST_TIME_SCALE = resolveTestTimeScale()            // import 시 1회
  scaleMs(baseMs, scale = TEST_TIME_SCALE): number  // baseMs 양의 유한수 아니면 throw · Math.ceil(baseMs*scale)
  scaledBudget({ testTimeout?, hookTimeout? }, scale?) → 준 키만 scaleMs
  scaledWaitForOptions(options, scale?) → number n → { timeout: scaleMs(n) } · undefined → { timeout: scaleMs(5_000) }
                                          · 객체 → { ...options, timeout: scaleMs(options.timeout ?? 5_000) }
test-host.mjs
  HERMETIC_REMOVE_PREFIXES = ['ANTHROPIC_','CLAUDE_','OPENCODE_','GIT_'] · HERMETIC_REMOVE_KEYS = ['CLAUDECODE']
  hermeticTestEnv({ env, root, platform }) → { set: Record<string,string>, remove: string[] }
    set: HOME·USERPROFILE = <root>/home · XDG_CONFIG_HOME/DATA/CACHE/STATE = <root>/xdg-{config,data,cache,state}
         platform==='win32' → ProgramData = <root>/programdata
         GIT_CONFIG_GLOBAL = <root>/gitconfig · GIT_CONFIG_NOSYSTEM = '1'
    remove: env 키 중 접두사·정확 키 일치(set 대상은 제외)
vitest-setup.mjs (파일마다)
  root = mkdtempSync(join(tmpdir(), 'orca-test-host-')) · 하위 디렉토리·빈 gitconfig 생성
  globalThis[Symbol.for('orca.test.host')] = { root, originalHome }   // 배선 테스트용
  remove 키 delete · set 키 대입
  vi.waitFor 가 marker(Symbol.for('orca.test.waitFor.scaled')) 없으면 wrapper 설치
  afterAll(() => rmSync(root, { recursive, force, maxRetries: 3 }) — 실패는 삼킨다(임시 폴더 잔여만 남음)
check-test-budgets.mjs
  (B) parseBudget: `vi.setConfig(scaledBudget({ … }))` 의 기준값을 읽는다(리터럴 직접 형태는 (F) 위반)
  (F) 모든 *.test.ts: vi.setConfig 인자 = scaledBudget(객체) · it/test/describe/bench/suite·before*/after* 타임아웃 인자 = scaleMs(…) — TypeScript AST
  (G) 실-git 스위트 기준 예산 최대값 < temp-repo.testfixture.ts 의 FIXTURE_GIT_TIMEOUT_MS 기준값
  (H) 테스트 본문 setTimeout(_, 리터럴 ≥1000) · Date.now()/performance.now() + 리터럴 → scaleMs 경유 또는 SEMANTIC_DELAYS {file, value, reason}
  --report: 종류·파일:줄·형태 목록 출력(분모 대조용)
```

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/scripts/test-time.mjs`·`.d.mts` (신규) | 배율 SSOT | §10 계약 세부 | `scripts/test-time.test.mjs`(순수 + config import + 워크플로 텍스트) |
| `app/scripts/test-host.mjs` (신규) | 격리 env 순수 계산 | §10 | `scripts/test-host.test.mjs` |
| `app/scripts/vitest-setup.mjs` (신규) | 적용·waitFor·정리 | §10 | `src/main/infra/test-environment.test.ts` |
| `app/vitest.config.ts` | 예산·setup 배선 | `testTimeout`·`hookTimeout` = `scaleMs(BASE_*)`, `setupFiles`, 주석 갱신(배율·격리 근거) | AC1·AC2 |
| `app/src/main/infra/test-environment.test.ts` (신규) | 배선 단언 | AC1·AC3(1.5s 넘게 재시도)·AC11·파일별 루트·자식 env 상속(`process.execPath -e`로 `HOME` 출력) | — |
| `app/src/main/infra/test-environment.hostile.test.ts` (신규) | 시스템 테스트 | 합성 HOME/env 구성 → `execFile(process.execPath, [vitest.mjs, 'run', …9파일, '--reporter=dot'], { cwd: app, env })` → exit 0 · 사후 HOME 트리 동일. 자식 env에서 XDG·`GIT_CONFIG_GLOBAL`·`GIT_CONFIG_NOSYSTEM`은 지우고 `GIT_CONFIG_SYSTEM`=서명 강제 파일을 둬 "격리 없으면 새는" 조건을 만든다. 예산 `scaledBudget({ testTimeout: 180_000 })` | 대표 9파일: `adapters/claude/adapter.context-policy` · `adapters/claude/workspace-guard` · `app/handlers/engine.import` · `app/bootstrap.opencode-warmup` · `app/chat-turn/opencode-runtime` · `app/managed-mcp-lifecycle` · `app/bootstrap.native-history` · `infra/git/repository` · `features/plugins/confluence/connector` (리눅스·Windows 기준선 실패 없는 파일) |
| `app/scripts/check-test-budgets.mjs`·`.test.mjs` | 게이트 F·G·H·report | §10 · 기존 A~E fixture를 scaled 형태로 갱신 | node 테스트 |
| EP-03 20파일 | 파일 예산 | `vi.setConfig(scaledBudget({ 기존 값 }))` + import. 도출식 주석은 기준값 설명으로 유지하고 "실효 = × 배율" 한 줄 | 게이트 F |
| EP-04 5파일 6자리 | 인라인 | `scaleMs(기존 값)` | 게이트 F |
| EP-05 4자리 | 마감 | `scaleMs(기존 값)` · 의미 6자리는 게이트 허용 목록에 사유와 등록 | 게이트 H |
| `infra/git/temp-repo.testfixture.ts` | 픽스처 상수 | EP-06 3자리 `scaleMs` | 게이트 G + 상수 vitest 단언 |
| EP-10 7파일 | 배포 결합 | §10 처분 그대로 | 포크 모사 |
| `infra/loopback-callback.test.ts` | 동적 포트 | `net.createServer().listen(0,'127.0.0.1')`로 받은 포트를 닫고 사용 · 같은 포트 재바인딩 단언 유지 | 파일 green |
| `features/worktrees/service.test.ts:245` | 브랜치 이름 | 저장소 생성 직후 `git symbolic-ref --short HEAD`(픽스처 `execGit`)로 읽은 이름과 비교 | AC14 |
| `.github/workflows/ci.yml`·`release.yml` | CI 상한·배율 | `timeout-minutes: ${{ fromJSON(vars.ORCA_CI_TIMEOUT_MINUTES \|\| '90') }}`(release: `ORCA_RELEASE_TIMEOUT_MINUTES`·`'135'`) · Test 단계 `env: ORCA_TEST_TIME_SCALE: ${{ vars.ORCA_TEST_TIME_SCALE }}` | AC9 |
| `app/AGENTS.md` · `docs/guides/release-operations.md` | 문서 | 예산 작성 규칙(`scaledBudget`·`scaleMs`·리터럴 금지·의미 대기 등록) · 격리(테스트는 실제 HOME/env를 보지 않는다, 호스트 의존 시험은 env를 명시 주입) · 게이트 F~H · 저장소 변수 3종 | AC19 |

### 테스트 가능성

- 순수부(`test-time.mjs`·`test-host.mjs`)는 Node 내장만 쓰는 별도 파일 — `node --test`로 vitest 없이 돈다.
- config import 테스트는 Node 22.18+ 타입 제거로 `vitest.config.ts`를 직접 import한다(시제품: Node 22.23.4 `node x.ts` 동작). 배율 변경 확인은 `?scale=N` 쿼리로 모듈 캐시를 피한 동적 import + `process.env` 설정, 또는 `execFile(process.execPath, ['-e', …])` 자식으로 한다.
- 순서 관측: 해당 없음.

## 12. End-to-end 영향

```text
ORCA_TEST_TIME_SCALE / vars → test-time.mjs → config·setup·픽스처·테스트 → 실효 예산
호스트 env → vitest-setup(격리) → process.env → homedir()/XDG/git 자식 → production reader
```

- producer 기준: 배율은 `test-time.mjs`만 계산한다. 소비자는 기준값만 들고 다시 곱하지 않는다(이중 배율 금지 — `vi.waitFor` 옵션에 `scaleMs`를 쓰지 않는다, wrapper가 곱한다).
- 파생 합성값이 정본을 우회하지 않는가: 게이트 (F)(H)가 리터럴 예산을 막는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 변경 영향 | 회귀 AC |
|---|---|---|
| 모든 테스트 파일(925) | setup 추가 — 파일당 mkdtemp 1회 | AC16 |
| 호스트 env를 일부러 주입하는 테스트(`vi.stubEnv`·명시 env 객체) | 영향 없음 — 주입값이 이긴다 | AC16 |
| opt-in 실기(`ORCA_TEST_OPENCODE_EXE`·`ORCA_ARTIFACT_LIVE`) | `ORCA_*` 보존 · 자식 HOME은 테스트가 직접 지정 | AC10 |
| 실-git 스위트 16 | 빈 전역 git 설정 · 저장소별 `user.*`는 이미 로컬 설정(`service.test.ts:33-34` 등) | AC12·AC16 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: config 로드 시 배율 해석(잘못되면 vitest 즉시 실패). 파일 시작 시 setup.
- 종료: `afterAll`이 루트를 지운다. Windows EBUSY 등 실패는 삼킨다 — 남는 것은 OS 임시 폴더의 `orca-test-host-*`뿐이고 실제 홈은 쓰이지 않았다.
- timeout: 모든 예산은 유한(배율 유한수) — 멈춤은 계속 실패로 보고된다.
- **다중 저장소 쓰기**: 해당 없음(제품 저장소 없음). 문서 사본: 판정은 `plan.md`와 `INDEX.md` 두 곳 — 둘 다 이번 설계 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- 케이스 상한: 정상 케이스 시간은 불변. 멈춘 케이스 하나가 보고되기까지 20s → 60s.
- 최악: 리눅스 기준 전체 2m16s · 저성능 모사 6m47s — 실효 케이스 상한 60s를 넘은 케이스 0(최장 26.6s).
- CI: 작업 13m43s × 3 ≈ 41분 < 90분.
- setup 비용: 파일당 mkdtemp·mkdir 6·writeFile 1 — 시제품 전체 실행 시간 차이 측정 범위 안(합성 호스트 3워커 실행 정상 종료).
- 시스템 테스트 비용: 자식 vitest 9파일 — 리눅스 수십 초, Windows 직렬은 더 길다 → 예산 `scaledBudget({ testTimeout: 180_000 })`.

## 15. 외부 구현 포트 / 문서 계약

- 외부(운영자)가 설정하는 값: 저장소 Variables `ORCA_TEST_TIME_SCALE`·`ORCA_CI_TIMEOUT_MINUTES`·`ORCA_RELEASE_TIMEOUT_MINUTES`.
- 구현 문서: `docs/guides/release-operations.md` 트러블슈팅에 "느린 러너" 행.
- shape 검증: 워크플로 텍스트 테스트(AC9) + Windows CI 파싱.
- semantics 검증: AC4(잘못된 값 시작 실패).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0248 D-011 · AT-06/AC15 "기본 배포 `[]` 유지 … 가상 배포 테스트로 검증" | `docs/handoff/0248-login-free-plugin-auth/plan.md:61,155` | §10 EP-10 삭제 6 | **변경(테스트 고정만)** — 사용자 D-007. OSS 기본값이 빈 배열인 코드·`docs/arch/backend/auth.md:130` 서술은 유지 |
| 0237 D-030 "기본 OSS 배포의 Auth/Plugin 배열은 계속 비어 있다" | `docs/guides/closed-network-extensions.md:1027` | 같음 | 유지(서술) · 테스트 고정만 삭제 |
| 0207 "기본 배포는 주입점을 비워 둔다" 테스트 | `deployment-wiring.test.ts:673` | EP-10 | 변경(삭제) — D-007 |
| 0218 실-git 예산 규칙 (A)~(E) | `scripts/check-test-budgets.mjs:14-31` | §10 EP-03·EP-06 | 유지 + (F)(G)(H) 추가 — D-009 |
| 0211 ΔV5 "케이스 예산 20초" | `vitest.config.ts:13-26` | EP-01 | 변경 — 기준값 20s 유지, 실효 ×배율(D-003) |
| `app/AGENTS.md` "`npm test` 는 DB 동작을 실제로 봐야 할 때만" | `app/AGENTS.md` ABI 가이드 | §7-A gate | 유지 |
| 가이드 "동작 확인의 살아 있는 예제는 deployment-wiring.test.ts" | `closed-network-extensions.md:99` | EP-10 | 유지 — 가상 배포 테스트는 남고 기본값 고정 블록만 삭제 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| Windows에서 `ProgramData`·`USERPROFILE` 변경이 자식(git·pwsh)에 부작용 | Windows CI가 oracle(AC9). 실패하면 그 키만 PLAN_GAP으로 올린다 |
| `vi.waitFor` monkeypatch가 vitest 업그레이드에 깨짐 | marker 단언(AC3 배선)이 즉시 red — 업그레이드 PR에서 드러난다 |
| 멈춘 테스트 보고 지연(3배) | 사용자 결정 D-001의 대가. 예산은 유한 |
| 시스템 테스트 대표 파일이 나중에 호스트 독립화되면 민감도 상실 | AC 주의사항 — 대표 교체. 변이 M-A로 확인 |
| 의미 대기 허용 목록이 새 예산 마감의 우회로가 됨 | 허용 목록 항목마다 사유 필수 · verify가 사유를 검토 |

- 되돌리기 어려운 결정: 없음(테스트 인프라). 변수 이름 3종은 운영자 설정이라 바꾸면 안내 필요.
- 신규 의존성: 없음(`typescript` 기존 devDependency `^5.9.3`).

## 18. 영향 받는 파일 / 문서

- `app/vitest.config.ts` · `app/scripts/{test-time.mjs,test-time.d.mts,test-time.test.mjs,test-host.mjs,test-host.test.mjs,vitest-setup.mjs,check-test-budgets.mjs,check-test-budgets.test.mjs}`
- `app/src/main/infra/{test-environment.test.ts,test-environment.hostile.test.ts}` (신규)
- §10 EP-03(20)·EP-04(5파일)·EP-05(3파일)·EP-06(1)·EP-10(7)·EP-11(1) 파일 · `features/worktrees/service.test.ts`
- `.github/workflows/{ci.yml,release.yml}` · `app/AGENTS.md` · `docs/guides/release-operations.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 환경 제약: 리눅스 컨테이너는 기준선 22건(D-011)을 분리 보고한다. Electron 바이너리가 없으면 `node node_modules/electron/install.js`(이번 설계 세션에서 다운로드 가능 확인).
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run` 전체(인프라 변경이라 전수) · `node --test "scripts/*.test.mjs"` · `node scripts/check-test-budgets.mjs` · `node scripts/check-doc-inventory.mjs --check`.
- 적대 측정(verify 재실행): `evidence/clean-host-run.sh` · `hostile-host-run.sh` · `slow-runner-run.sh … 8` · `fork-deployment.py`(작업 트리 사본) + `newfails.mjs`.
- 사람 실기: AC18.

## READY self-review

- [x] Decision Ledger가 질의 5건의 결정을 보존한다 — D-001~D-011.
- [x] Part I만으로 완료 상태가 설명된다 — §1 표·§5 전이표.
- [x] 조건절 원문 인용 — §2 사용자 문장 원문, "Git 인프라는 유지"·"실-git도 배율 적용"을 D-009·D-001로 함께 보존.
- [x] 사용자 결정과 조사 사실 구분 — §4.
- [x] 수치 실측 — §8 전 수치 이번 세션 측정, 검산 §8 끝.
- [x] 저장소 규칙 입력 — 게이트 A~E·ABI 가이드·doc inventory·`noImplicitAny:false` 선례(`statusLine.render.test.ts:27`).
- [x] AC마다 행동 단언·검증·경로 — §7.
- [x] Baseline V · 모든 NEW node에 REQUIRED pair — VP-01~11.
- [x] pair마다 경로·§10 분모·좌표·적대 증거 — §7-A·§10.
- [x] 운영 gate 열거 — §7-A.
- [x] 사람 실기는 외부환경 1건(AC18)뿐.
- [x] structural proxy만으로 semantic 목표를 닫지 않는다 — 게이트(F·G·H)는 형태, 행동은 AC1~AC3·AC12·AC16 모사 실행.
- [x] "X가 쓰인다" 장치가 X를 지우면 red — M1~M10·M-A~M-D.
- [x] 정책 파라미터 단위·범위 — 배율 유한수 ≥1, ms 정수(`Math.ceil`).
- [x] 신규 모듈의 레이어·강제·seam — §9 책임 표·§11.
- [x] producer/consumer — §12(이중 배율 금지).
- [x] worst-case — §14.
- [x] `ACTIVE 결정 ↔ AC` 대조 — §3 갱신 메모.
- [x] 문장 규칙 — 판정 먼저·표 위주.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: §10 계약 세부 그대로 — `test-time.mjs`·`test-host.mjs`·`vitest-setup.mjs`·게이트 (F)(G)(H)·`--report`.
- 이견 / 현실성 문제: AC12 Git 변이 M-C(`GIT_CONFIG_GLOBAL` 미설정)는 HOME 리다이렉트와 겹쳐 민감도 0이었다 — 시스템 테스트 입력에 `GIT_CONFIG_COUNT`·`KEY_n`·`VALUE_n`(env 주입 설정, `GIT_` 지움만 막음)을 더해 M-C를 `GIT_` 지움 제거로 심었다(아래 차이).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 EP-01 | 전역 케이스·훅 | 2 | 2/2 | `rg -n "testTimeout\|hookTimeout" app/vitest.config.ts` → 2 · `scripts/test-time.test.mjs`'케이스·훅 예산 = 20_000 × 배율' · `test-environment.test.ts`'케이스 예산은 기준값 × 배율이다' | 배율 미설정·1·5 → 60_000·20_000·100_000(t·h 각각) | — |
| VP-01 EP-02 | `vi.waitFor` 배율 | 1 | 1/1 | `rg -n "vi\.waitFor\s*=" app/scripts` → 1 · `test-time.test.mjs`'waitFor 옵션 네 갈래' · `test-environment.test.ts`'무옵션 vi.waitFor 는 … 1초를 넘겨' | 미지정·숫자 4000·객체(timeout 2000+interval 10)·객체(interval만) → 15_000·12_000·6_000(+10)·10_000(배율 2) | 호출 173/52 = 기존 172/51 + 신규 배선 테스트 1 |
| VP-01·09 EP-03 | `vi.setConfig(scaledBudget)` | 20 | 20/20 | `node scripts/check-test-budgets.mjs --report` setConfig 21 − §10 목록 20 = 차집합 `{infra/test-environment.hostile}`(신규·scaled) · gate (F) `check-test-budgets.test.mjs`'리터럴 vi.setConfig 는 걸리고…' | 기준값 = 기존 리터럴 그대로(diff) | — |
| VP-01·09 EP-04 | 케이스 인라인 `scaleMs` | 6 | 6/6 | `--report` case 6 scaled · gate (F)'케이스 셋째 인자 리터럴은 걸리고…' | it·it.each·it.skipIf 형태 각각 | — |
| VP-01·09 EP-05 | 마감 4 scaled + 의미 6 | 10 | 10/10 | `--report` deadline 4 scaled · 6 semantic · gate (H) 3케이스 | 의미 대기: 파일·값 둘 다 맞아야 통과(다른 파일 같은 값 red) | — |
| VP-01 EP-06 | 픽스처 상수 | 3 | 3/3 | `rg -n "const (FIXTURE_GIT_TIMEOUT_MS\|KILL_GRACE_MS\|RM_RETRY)"` → 3 · `test-time.test.mjs`'상한·kill 유예·rm 재시도 간격이 기준값 × 배율이다' · gate (G) | 600_000·5_000·200 각각(서로 다른 기준값) | — |
| VP-02 EP-07 | CI 상한·배율 전달 | 4 | 4/4 | `rg -n "^\s+timeout-minutes\|^\s+ORCA_TEST_TIME_SCALE:" .github/workflows` → 4 · `test-time.test.mjs`'작업 상한은…'·'두 Test 단계가…' · Windows CI 실행은 push 뒤(검증자 확인) | ci 90 / release 135 서로 다른 기본값 | Windows CI 실행 결과 |
| VP-02·10 EP-08 | 배율 해석 | 2 | 2/2 | `rg -n "export (function resolveTestTimeScale\|const TEST_TIME_SCALE)\b"` → 2 · `test-time.test.mjs`'배율 해석' 3케이스 · '잘못된 배율이면 config 로드가 실패한다' · 'vitest 자체가 비정상 종료한다' | ''·공백·1·1.5·5·0·0.99·-1·abc·Infinity·NaN | — |
| VP-03·08·11 EP-09 | 격리 env | 15 | 15/15 | `test-host.test.mjs` 5케이스 · `test-environment.test.ts` 격리 4케이스 · `test-environment.hostile.test.ts` | 지움 9키·보존 7키 표본 · win32/linux 분기 · 바꾸는 GIT_ 키 비지움 | 시스템 git 설정 파일 실물은 UT·배선까지(plan §10 Git 메모) |
| VP-04 EP-10 | 배포 결합 | 13 | 13/13 | 음성 `rg … -g '*.test.ts'` → 0 · 포크 모사(`fork-deployment.py` → 전체 스위트) 기준 대비 +0 · 각 파일 green | 포크 id `acme-*`(fixture 와 겹치지 않음) | — |
| VP-05 EP-11 | 동적 빈 포트 | 1 | 1/1 | `rg -n "nextPort\|45211" app/src -g '*.test.ts'` → 0 · `loopback-callback.test.ts` 전 케이스 green | 같은 포트 재바인딩 단언 유지 | — |

- §10 자리 목록 밖에서 본 운반 자리: `bootstrap.harness.test.ts`의 `spawn-env` mock도 더했다(필수 아님 — 포크 spawn env 가 그 테스트 경로에 닿지 않게 한 방어). 목록 밖 리터럴 예산 0(`--report` LITERAL 0줄).
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(최초).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | 위 EP-01~06 행 | M1~M6 RED |
| VP-02 | REQUIRED | SELF_PASS | 위 EP-07·08 행 (Windows CI 대기) | M7·M8 RED |
| VP-03 | REQUIRED | SELF_PASS | `test-environment.hostile.test.ts`'합성 사내 호스트에서…' | M-A·M-B·M-C·M-D RED |
| VP-04 | REQUIRED | SELF_PASS | 포크 모사 +0 · 음성 검색 0 | M9 RED(2자리) |
| VP-05 | REQUIRED | SELF_PASS | `loopback-callback.test.ts` 7케이스 | not selected |
| VP-06 | REQUIRED | SELF_PASS | `test-environment.test.ts`'홈은 이 파일의 임시 루트…'·'자식 프로세스도 격리된 홈을 받는다' | not selected |
| VP-07 | REQUIRED | SELF_PASS | VP-01 좌표 | M1~M6 |
| VP-08 | REQUIRED | SELF_PASS | VP-03·AC11 좌표 | M-A~M-D |
| VP-09 | REQUIRED | SELF_PASS | `check-test-budgets.test.mjs` 38→신규 포함 전 케이스 · `gate:node scripts/check-test-budgets.mjs` | M3~M6 |
| VP-10 | REQUIRED | SELF_PASS | `test-time.test.mjs` | M7 |
| VP-11 | REQUIRED | SELF_PASS | `test-host.test.mjs` | M10 RED |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 `vitest.config.ts` hookTimeout 제거 | VP-01 선택 증거 | 최초 | `test-time.test.mjs` config 예산 | 잠김 |
| M2 `scaledWaitForOptions` 객체 timeout 비배율 | VP-01 | 최초 | waitFor 옵션 네 갈래 | 잠김 |
| M3 `repository.test.ts:13` 리터럴 setConfig | VP-01 | 최초 | gate exit 1 | 잠김 |
| M4 `file-mutation.test.ts` 인라인 45_000 리터럴 | VP-01 | 최초 | gate exit 1 | 잠김 |
| M5 `file-mutation.test.ts` `Date.now()+30_000` | VP-01 | 최초 | gate exit 1 | 잠김 |
| M6 픽스처 기준 600_000→300_000 | VP-01 | 최초 | gate (G) exit 1 | 잠김 |
| M7 하한 `< 1` → `<= 0` | VP-02 | 최초 | 배율 해석 '0.99' | 잠김 |
| M8 `ci.yml` 기본 90→30 | VP-02 | 최초 | 워크플로 상한 | 잠김 |
| M9a 포크에서 `mcp-reconcile` spawn-env mock 제거 | VP-04 | 최초 | 1 failed / 7 | 잠김 |
| M9b 포크에서 AC10 을 `createConnectionSources` 로 복귀 | VP-04 | 최초 | 2 failed / 10 | 잠김 |
| M10 지움 접두사에 `ORCA_` 추가 | VP-11 | 최초 | `test-host.test.mjs` | 잠김 |
| M-A `setupFiles: []` | VP-03 | 최초 | 시스템 테스트 1 failed | 잠김 |
| M-B 지움 접두사 `OPENCODE_` 제거 | VP-03 | 최초 | 시스템 테스트 1 failed | 잠김 |
| M-C 지움 접두사 `GIT_` 제거 | VP-03 | 최초 | 첫 시도 green(입력이 NOSYSTEM 에 막힘) → 입력에 `GIT_CONFIG_COUNT` 추가 후 1 failed | 잠김 |
| M-D HOME·USERPROFILE 리다이렉트 제거 | VP-03 | 최초 | 시스템 테스트 1 failed | 잠김 |
| EP-06 `KILL_GRACE_MS`·`RM_RETRY` 리터럴 복귀 | 새 oracle 민감도 | 최초 | `test-time.test.mjs` 픽스처 상수 | 잠김(2/2) |

- **분모 검산**: 선택 증거 16(M1~M8·M9a·M9b·M10·M-A~M-D) · 인용 변이 0 · 새 oracle 1(EP-06 상수 2 변이) = 표 행 17.
- **덮개 회귀**: 해당 없음(최초). 기존 (A)~(E) 게이트 케이스는 fixture 문자열만 scaled 형태로 바꿔 전부 통과(`check-test-budgets.test.mjs` 38/38).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 운영자 대면 3종 — 배율 오류 메시지(vitest 시작 실패 stderr), 게이트 위반 문구(CI 로그), 가이드 트러블슈팅 행 | 소비자 = CI 로그·`docs/guides/release-operations.md` |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 잘못된 배율 → §5 3행 · 멈춤 → 4행 · 정리 실패 → §13(삼킴) | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 잘못된 배율은 exit≠0 + 변수명·값 메시지(`test-time.test.mjs` 확인) | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 포크가 `auth-definitions.ts`에 상수를 더하면 그것을 참조하는 `gate-auth.ts` 원본이 mock 된 모듈에서 export 를 못 찾아 부팅 테스트가 suite 오류 | ✅ 선조치 — `bootstrap.harness.test.ts`의 mock 을 원본 spread + 배열만 덮기로 | 포크 모사 1차 실행 `<suite>` 실패 → 수정 후 +0 |
| 2 | 바깥 실행이 색을 켜면 자식 vitest 출력에 ANSI 코드가 섞여 시스템 테스트 정규식이 빗나감 | ✅ 선조치 — 비교 전 ANSI 제거(`no-control-regex` 회피로 `String.fromCharCode(27)`) | 전체 실행에서만 실패 → `FORCE_COLOR=1` 단독 재현·수정 |
| 3 | `GIT_CONFIG_NOSYSTEM`이 `GIT_CONFIG_SYSTEM` 주입도 무력화해 `GIT_` 지움 변이에 민감도가 없었다 | ✅ 선조치 — 시스템 테스트 입력에 env 주입 설정(`GIT_CONFIG_COUNT`) 추가 | M-C 첫 시도 green → 수정 후 red |
| 4 | 실-git 픽스처 상수 2개가 비공개라 좌표가 없었다 | ✅ 선조치 — export 후 node 테스트(Node 22.18+ 타입 제거 import) | EP-06 변이 2건 red |

### 설계 대비 명시적 차이

- 시스템 테스트 입력에 `GIT_CONFIG_COUNT`·`KEY_n`·`VALUE_n` 추가(위 3) — plan §11 행의 `GIT_CONFIG_SYSTEM`은 유지.
- `KILL_GRACE_MS`·`RM_RETRY`를 export(위 4) — 소비 범위는 테스트뿐.
- `bootstrap.harness.test.ts`는 plan의 `gate-auth`·`auth-definitions` mock 에 더해 `spawn-env` mock 도 둔다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 시간 캐시 없음 | — |
| 공유 | 해당 없음 — export 상수는 불변값 | EP-06 테스트 |
| 재진입 | setup 이 파일마다 재실행돼도 `originalHome`은 첫 기록을 유지 | AC11 '홈은 … 다르다' green |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `app/scripts/{test-time.mjs,test-time.d.mts,test-time.test.mjs,test-host.mjs,test-host.test.mjs,vitest-setup.mjs}` · `app/src/main/infra/{test-environment.test.ts,test-environment.hostile.test.ts}` · 수정 `app/vitest.config.ts` · `app/scripts/check-test-budgets{,.test}.mjs` · EP-03~06·10·11 테스트 파일 · `features/worktrees/service.test.ts` · `.github/workflows/{ci,release}.yml` · `app/AGENTS.md` · `docs/guides/release-operations.md` · evidence 스크립트 2개(경로 해석·`VITEST_PREFIX`) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `evidence/clean-host-run.sh` · `hostile-host-run.sh` · `slow-runner-run.sh … 8` · 포크 모사 · `node --test "scripts/*.test.mjs"` · `node scripts/check-test-budgets.mjs` · `check-doc-inventory --check` · `check-migrations-appendonly` |
| **관측한 게이트 산출**(마지막 수정 뒤) | lint 0 error · 2 warning(변경 밖 `Timeline.tsx`·`useTranscriptVirtualizer.ts`) · typecheck exit 0 · vitest 915파일 8,447케이스: 통과 8,416 · 실패 22 · skip 9 — 실패 22 = 기준선 집합과 차집합 0(Windows 경로·Claude 플러그인 Linux) · node 171/171 · test-budgets ok · doc-inventory ok · migrations ok. 최종 수정(EP-06 export) 뒤 vitest는 영향 범위 76파일 572케이스 재실행 green |
| 적대 측정 | 합성 사내 호스트 +0 · HOME 새 파일 0 / 저성능 모사(1코어·8워커, 6m25s) +0 / 포크 모사 +0 — 모두 구현 트리 기준선 대비 |
| V-pair 자기확인 | `SELF_PASS 11 / SELF_BLOCKED 0` |
| 강제 지점 전수 | 77/77 (2+1+20+6+10+3+4+2+15+13+1) |
| **AC 자기보고**(`Criteria-Met`) | AC1~AC17 ✅(위 좌표) · AC19 ✅(문서 diff + doc-inventory ok) · AC9 의 Windows CI 실행과 AC18 사람 실기 ⚠️ |
| **합계 검산** | `✅ 17 · ⚠️ 2(AC9 Windows CI 대기·AC18 사람 실기) · ❌ 0 = 총 19` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] 구현 보고 (r1.2 — Windows CI red 수정)

| 항목 | 내용 |
|---|---|
| 계기 | Windows CI run 41745171529(r1 push) — `features/chat/attachments.test.ts` 12건 red, 그 밖 911파일 green(8,432 통과) |
| 원인 | windows 러너 `tmpdir()`가 8.3 짧은 이름(`C:\Users\RUNNER~1\…`)이라 setup 이 그 아래에 만든 홈도 짧은 이름이었다. 첨부 검사는 `fs.realpath`(긴 이름) 결과를 `homedir()` 접두사와 비교해 "C: must be inside the user profile directory"로 거부 |
| 수정 | `scripts/vitest-setup.mjs` — 임시 루트를 `realpathSync.native(mkdtemp…)`로 고정(실제 `USERPROFILE`은 긴 이름). 배선 테스트에 '홈은 실경로다' 추가, 루트 포함 비교를 `realpathSync.native(tmpdir())` 기준으로 |
| 재현 · 잠금 | 리눅스에서 `TMPDIR`을 심볼릭 링크로 두면 같은 "표기 ≠ 실경로" — 수정 전 `outside the user home directory` 9건 → 수정 후 0건. 변이(realpath 제거)는 '홈은 실경로다'가 red(링크 TMPDIR). 링크 TMPDIR 의 `unsafe attachment directory` 6건은 링크 고유 검사라 Windows 8.3 과 별개(기준선 동일) |
| **관측한 게이트 산출**(마지막 수정 뒤) | lint 0 error · 2 warning(변경 밖) · typecheck exit 0 · node 171/171 · test-budgets ok · vitest 8,448케이스 실패 22 = 기준선 집합 차집합 0 · HOME 새 파일 0 |
| AC 자기보고 | AC9 ✅ — Windows CI run 41796065410(head `f087d27`) success, 작업 상한 `fromJSON(vars…)` 해석됨. `✅ 18 · ⚠️ 1(AC18 사람 실기) · ❌ 0 = 총 19` |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(최초).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: plan M-C가 HOME 리다이렉트·NOSYSTEM과 겹쳐 민감도 0인 변이였다 — 구현 중 첫 시도 green으로 드러남.
- 반복해서 부딪히는 환경 한계: 리눅스 기준선 22건 · Windows 백신·디스크 지연 모사 불가.
- 현재 라운드·impl 턴: `r1`. 구현자 = 다음 검증자(Claude) — verify 는 보고에 없는 적대 축을 하나 더해야 한다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
