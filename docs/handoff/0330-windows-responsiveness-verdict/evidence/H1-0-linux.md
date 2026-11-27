# 0330 WU-M Linux 사전 실행

최신 기록은 [r3 사전 실행](#r3-사전-실행)에 있다. 앞선 측정은 r1과 [r2 사전 실행](#r2-사전-실행)에 기록했다.

측정 도구는 `ae27c4f77358287c109db816e91daaa28343b4c1`다. Linux x64에서 Node 22.23.3, Electron 39.8.10 및 가상 디스플레이(Xvfb)를 사용했다. 아래 값은 H1-0 재현 기록이다.

## 입력과 빌드

| 확인 | 관측 |
|---|---|
| `measure-ui-inputs.mjs --write-inputs` | 216개 파일의 SHA-256 목록이 `inputs-sha256.txt`와 바이트 단위로 일치했다. 목록 SHA-256은 `07b4cfc85c5e522b11c5de73611bceaba2665b12e4bf6e50e8e6e5c8488631aa`이다. |
| `electron-vite build` · `VITE_OO_DIAGNOSTIC=1 electron-vite build` | renderer 산출에서 `__ooDev`가 있는 파일은 설치용 0개, 진단용 1개다. |

## 기준 앱과 후속 앱

각 작업 트리의 HEAD에 같은 도구를 두고 §19 H1-0의 `git restore --source=… --staged --worktree -- app/src`를 실행했다. 기준 및 후속 앱은 각 참조와의 소스 diff가 0이고 미추적 소스가 0개였다. 출력의 `tool`은 위 커밋, `environment`는 `linux-electron`이다.

| 도구 · 옵션 | 앱 커밋 | 앱 소스 tree | 관측 | 종료 코드 |
|---|---|---|---|---|
| E 도구 small | `ae27c4f7` | `cdd028ae9e0ef36383e743507e2afccd807553ad` | 첫 본문 747.3ms · 기능 충족 · 크기 충족 | 0 |
| E 기준 small | `7db1c7ce` | `9235fa7cb7ea2506abd5a6b38bda665ded21882b` | 첫 본문 841.0ms · 기능 충족 · 크기 충족 | 0 |
| E 후속 small | `eae9081b` | `6d2962222fe8c1629a937c1b10cabd5839bc1a07` | 첫 본문 747.8ms · 기능 충족 · 크기 충족 | 0 |
| E 도구 long | `ae27c4f7` | `cdd028ae9e0ef36383e743507e2afccd807553ad` | 첫 본문 8,910.6ms · 기능 충족 · 크기 충족 · Linux 시간 기준 미충족 | 1 |
| E 기준 long | `7db1c7ce` | `9235fa7cb7ea2506abd5a6b38bda665ded21882b` | 첫 본문 6,079.0ms · 기능 충족 · 크기 충족 | 0 |
| E 후속 long | `eae9081b` | `6d2962222fe8c1629a937c1b10cabd5839bc1a07` | 첫 본문 8,440.1ms · 기능 충족 · 크기 충족 · Linux 시간 기준 미충족 | 1 |
| D 도구 host | `ae27c4f7` | `cdd028ae9e0ef36383e743507e2afccd807553ad` | 측정 7행 · 실행 판정 충족 | 0 |
| D 도구 geometry | `ae27c4f7` | `cdd028ae9e0ef36383e743507e2afccd807553ad` | 마지막 댓글 표시 충족 · 포커스 충족 | 0 |
| D 기준 host | `c7d2adf2` | `cd989a2f9b8c2689fcb467d3fa2e655d66228cc5` | 측정 7행 · 실행 판정 충족 | 0 |
| D 후속 host | `7db1c7ce` | `9235fa7cb7ea2506abd5a6b38bda665ded21882b` | 측정 7행 · 실행 판정 충족 | 0 |

같은 도구에서 수집한 stage-d 기준·후속 JSON 쌍과 0328의 `r1.2-host-baseline.json`·`r1.2-host-applied.json` 쌍을 각각 `--compare`로 읽었다. 두 실행 모두 종료 코드 0이었다.


## 장문 기록 단독 재측정

위 표의 첫 도구·후속 long 측정은 전체 테스트와 함께 실행했다. 아래 두 실행은 같은 도구 커밋, 같은 소스와 입력을 사용하고 다른 검사가 끝난 뒤 차례로 실행했다. Linux 시간 기준은 3,729ms다.

| 앱 | 동시 실행(ms) | 단독 실행(ms) | 단독 기능 / 크기 | 단독 종료 코드 |
|---|---:|---:|---|---:|
| 도구 | 8,910.6 | 2,289.2 | 충족 / 충족 | 0 |
| 후속 | 8,440.1 | 2,287.1 | 충족 / 충족 | 0 |

## 판독기 예제

| 입력 | 합의만 | 최종 확정 포함 |
|---|---|---|
| failing | 불합격 · 1 | 불합격 · 1 |
| passing | 판정 보류(사용자 확정 대기) · 1 | 합격 · 0 |

`windows-verdict.test.mjs`의 두 `report CLI` 테스트가 stdout 전체를 각각의 기대 JSON과 대조했다. 실패 예제에는 스크롤 지연 위반, 앞삽입 반복 결측, 검색 대상 표시 결측, T17 소유자 FAIL이 함께 남았다.

## §10 자리 재검색

`site_census.mjs`에 §10의 검색식과 아래 좌표를 입력했다. 판독기 182줄(운반 178), stage-d 26줄(운반 19), stage-e 12줄(운반 9), 렌더러 3줄을 분류한 결과 미분류와 목록만 있는 줄이 각각 0이었다. renderer 검색의 세 번째 줄은 기존 스크롤 루트 조회다.

| 파일(app 기준) | 계약 또는 제외 근거 | 검색에 걸린 줄 |
|---|---|---|
| `scripts/measure-stage-d.mjs` | S6/S11 | 175 |
| `scripts/measure-stage-d.mjs` | S6/S7/S10 | 37 |
| `scripts/measure-stage-d.mjs` | S8/S9 | 194,199–200 |
| `scripts/measure-stage-d.mjs` | 제외(import) | 5,7–8 |
| `scripts/measure-stage-e.mjs` | E0/E4~7/V4/V5 | 22,28,30 |
| `scripts/measure-stage-e.mjs` | E0/E5 | 16 |
| `scripts/measure-stage-e.mjs` | V5 | 83,86 |
| `scripts/measure-stage-e.mjs` | 제외(import) | 2,4,9 |
| `scripts/stage-d-host/electron-main.mjs` | S4 | 87 |
| `scripts/stage-d-shell/probe.ts` | S5 | 282 |
| `scripts/stage-d/measurement.mjs` | S1/S8 | 9 |
| `scripts/stage-d/measurement.mjs` | S11 | 17,20,23 |
| `scripts/stage-d/measurement.mjs` | S1~3/S7 | 58,60–61 |
| `scripts/stage-d/measurement.mjs` | S7/S10/S11 | 45–47 |
| `scripts/stage-d/measurement.mjs` | S8 | 137,141 |
| `scripts/stage-d/measurement.mjs` | 제외(declaration) | 16,27,68,135 |
| `scripts/stage-e/baseline-source.mjs` | E1~4 | 1,17 |
| `scripts/stage-e/verdict.mjs` | V1~V4 | 33 |
| `scripts/windows-verdict.mjs` | C1~C4 | 697,713,716,719,721,724 |
| `scripts/windows-verdict.mjs` | P1/P2/P4 | 384 |
| `scripts/windows-verdict.mjs` | P1/P3/P4/P5 | 515,521,544,549,567,570,572–575,578–579,581–582,586 |
| `scripts/windows-verdict.mjs` | P1/P4/P5 | 600,607–612,616,619,621,624,626,628–630,632,634,642,646,654,657,664–671 |
| `scripts/windows-verdict.mjs` | P1/P5 | 292,297,313,326–328,330 |
| `scripts/windows-verdict.mjs` | P1~P5 공통 키·연산 | 12,29 |
| `scripts/windows-verdict.mjs` | P2 | 45,47,87–89,91–93,96–97,100–104,106,113–115,117–118,120–121,125–126,128,137,148,150,152,155,160,162,164–165,167,169–170,172–174,177–180,184–188,191–193,197–200,202–204 |
| `scripts/windows-verdict.mjs` | P2/P3 | 411,413,415–416,422–425,427,429,431–432,435,438,440–441,446–447,452,456 |
| `scripts/windows-verdict.mjs` | P2/P3/P5 | 355–356,358,365,368,463,481 |
| `scripts/windows-verdict.mjs` | P3 | 246,254,492–493,498,501–505 |
| `scripts/windows-verdict.mjs` | P3/P4 | 214,216–218,222–223,225,230–233,236,238,240,272–275,282,284,286 |
| `scripts/windows-verdict.mjs` | 제외(comment) | 408 |
| `scripts/windows-verdict.mjs` | 제외(declaration) | 244,268,490 |
| `src/renderer/src/features/chat/components/transcript/TranscriptViewport.tsx` | 제외(스크롤 루트 조회, 속성 작성 없음) | 560 |
| `src/renderer/src/features/chat/harnesses/claude/transcript/Timeline.tsx` | R1 | 122 |
| `src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.tsx` | R2 | 122 |

## 통합 테스트의 변경 전후 대조

Git 기준 트리와 구현 트리에 동일한 Node 22.23.3, SQLite Node ABI 127을 사용했다. 두 트리의 파일 제한 없는 Vitest 실행에서 실패한 테스트 이름의 차집합은 양방향 0개다.

| 트리 | 파일 | 테스트 |
|---|---|---|
| 설계 기준 `a8bbe99a` | 9 failed · 1139 passed · 4 skipped (1152) | 22 failed · 10900 passed · 1 expected fail · 11 skipped (10934) |
| 구현 최종 | 9 failed · 1140 passed · 4 skipped (1153) | 22 failed · 10903 passed · 1 expected fail · 11 skipped (10937) |

OpenCode와 Composer 사례는 Linux에서 `C:/…`를 작업 트리 아래로 해석하거나 절대 경로 검사에서 거부했다. Claude 플러그인은 `native-resources.ts:39`에서 `win32`일 때만 프로젝트별 제어를 활성화한다. Linux에서는 적용을 요구하는 테스트에 재시작 필요 또는 제어 불가 상태가 반환됐다.

| 실패 파일(app 기준) | 변경 전후 각각 실패한 테스트 수 |
|---|---:|
| `src/main/adapters/claude/adapter.native-plugins.test.ts` | 5 |
| `src/main/adapters/claude/native-resources.test.ts` | 3 |
| `src/main/adapters/claude/project-reconciliation.test.ts` | 2 |
| `src/main/adapters/opencode/v1/adapter.instances.test.ts` | 2 |
| `src/main/adapters/opencode/v1/adapter.persistent.test.ts` | 1 |
| `src/main/adapters/opencode/v1/adapter.test.ts` | 1 |
| `src/main/app/composer-catalog.test.ts` | 6 |
| `src/main/app/composer-preparation-service.test.ts` | 1 |
| `src/main/app/handlers/session-resources.claude-assembly.test.ts` | 1 |

두 트리 모두 Claude 플러그인 제어 시 같은 미처리 거부 1건을 기록했다. 직접 원인은 `이 플러그인은 프로젝트별 제어를 지원하지 않습니다.`였다.

## 생산자의 환경 필드 변이

호스트의 `electron-main.mjs`와 셸의 `probe.ts`에서 각각 `environment: measurementEnvironment()` 한 항을 `environment: undefined`로 바꿨다. 아래 명령을 원본, 변이, 복원 순서로 각 생산자에 적용했다. 원본에서는 환경이 `linux-electron`이고 SHA가 도구와 일치했다. 환경이 빠지면 호스트와 셸 모두 종료 코드가 0에서 1로 바뀌었다. 판정은 상위 CLI가 출처를 덧붙이기 전 반환값을 읽는다.

```sh
# RUNNER를 host와 shell로 각각 실행한다.
RUNNER=host xvfb-run -a node --input-type=module <<'JS'
import { resolveElectron } from './scripts/check-transcript-selection.mjs'
import { runHostMeasurements } from './scripts/stage-d/host-runner.mjs'
import { runShellMeasurements } from './scripts/stage-d/shell-runner.mjs'
import { provenance } from './scripts/stage-d/measurement.mjs'

const run = { host: runHostMeasurements, shell: runShellMeasurements }[process.env.RUNNER]
const source = provenance()
const result = await run(resolveElectron(), false, source)
console.log({ env: result.env, environment: result.environment, sha: result.sha })
if (!result.env || result.environment !== source.environment || result.sha !== source.sha)
  process.exitCode = 1
JS
```

## 재현 명령

`app/`에서 실행했다. 소스 복원 및 CLI 인자는 [§19 H1-0](../plan.md#h1-0-wu-m-사전-실행linux-지금)에 있다.

- `node --test scripts/*.test.mjs`
- `./node_modules/.bin/vitest run`
- `npm run lint`
- `npm run typecheck`
- `./node_modules/.bin/electron-vite build`
- `node scripts/smoke-hosts.mjs out/main`
- `node scripts/smoke-preload.mjs out/preload`

H1-0의 측정 뒤 진단용 JavaScript에 lint 설명 주석을, 렌더러 테스트에 반환 타입을 추가했다. 판독기는 종료 시각 없는 재시도가 확정 시각 비교를 가리지 않도록 U18에서 보완했다. 실제 Electron 측정 스크립트와 제품 실행 코드는 위 커밋과 같다. stage-d/e 도구·생산자 검색에서 `linux-electron` 리터럴은 `stage-d/measurement.mjs:9` 한 곳, 옛 기준 좌표 `3d8e1d90`은 0곳이었다.

## r2 사전 실행

ΔV1의 도구 커밋은 `40a545e432c7bd6de717050b26f0c40470eac4d8`이다. 아래의 각 Electron 실행에서 실제 결과의 `tool`과 `environment: linux-electron`을 대조했다. 이후 보강한 stage-d 테스트는 후속 SHA 인자 거부를 검사한다.

### H1-0

재생 입력 216개가 고정 목록과 바이트 단위로 같았다. 목록 SHA-256은 `07b4cfc85c5e522b11c5de73611bceaba2665b12e4bf6e50e8e6e5c8488631aa`이다. 일반 renderer 번들의 `__ooDev` 검색은 0파일, 진단 번들은 1파일이었다.

| 실행 | 앱 커밋 | 앱 소스 tree | 관측 | 종료 |
|---|---|---|---|---:|
| D 도구 host | `40a545e4` | `017b27d0803eb82e1e6748cf85f2b77155c03474` | 측정 7행 · 판정 충족 | 0 |
| D 도구 shell | `40a545e4` | `017b27d0803eb82e1e6748cf85f2b77155c03474` | 자원 검증 body-and-mime · 딥링크 표시 충족 · 판정 충족 | 0 |
| D 도구 geometry | `40a545e4` | `017b27d0803eb82e1e6748cf85f2b77155c03474` | 마지막 댓글 표시 충족 · 포커스 충족 | 0 |
| D 기준 host | `c7d2adf2` | `cd989a2f9b8c2689fcb467d3fa2e655d66228cc5` | 측정 7행 · 판정 충족 | 0 |
| D 후속 host | `7db1c7ce` | `9235fa7cb7ea2506abd5a6b38bda665ded21882b` | 측정 7행 · 판정 충족 | 0 |
| E 도구 small | `40a545e4` | `017b27d0803eb82e1e6748cf85f2b77155c03474` | 첫 본문 262.7ms · 기능 충족 · 크기 충족 | 0 |
| E 기준 small | `7db1c7ce` | `9235fa7cb7ea2506abd5a6b38bda665ded21882b` | 첫 본문 339.6ms · 기능 충족 · 크기 충족 | 0 |
| E 후속 small | `eae9081b` | `6d2962222fe8c1629a937c1b10cabd5839bc1a07` | 첫 본문 162.1ms · 기능 충족 · 크기 충족 | 0 |
| E 도구 long | `40a545e4` | `017b27d0803eb82e1e6748cf85f2b77155c03474` | 첫 본문 4,038.7ms · 기능 충족 · 크기 충족 · 시간 미충족 | 1 |
| E 기준 long | `7db1c7ce` | `9235fa7cb7ea2506abd5a6b38bda665ded21882b` | 첫 본문 5,706.4ms · 기능 충족 · 크기 충족 | 0 |
| E 후속 long | `eae9081b` | `6d2962222fe8c1629a937c1b10cabd5839bc1a07` | 첫 본문 4,071.0ms · 기능 충족 · 크기 충족 · 시간 미충족 | 1 |

D 기준·후속 JSON과 0328 보관 JSON 쌍을 각각 `--compare`로 읽었다. 두 쌍 모두 `verdict: true`, 종료 0이었다. E 장문 도구·후속은 통합 게이트와 동시 실행한 첫 값을 위 표에 보존했다. 같은 커밋과 입력을 단독으로 차례로 재실행한 결과는 아래와 같다.

| E long | 첫 본문(ms) | 기능 · 크기 · 3,729ms 시간 기준 | 종료 |
|---|---:|---|---:|
| 도구 | 2,075.9 | 충족 · 충족 · 충족 | 0 |
| 후속 | 2,028.0 | 충족 · 충족 · 충족 | 0 |

기존 예제의 합의/확정 조합 네 출력은 저장된 JSON과 일치했다. 같은 passing 예제의 T17/0326 machine을 근거 없는 FAIL로 교체했을 때 열은 FAIL, `ownerFailures`는 T17/0326 한 건, `holds`는 `소유 판정 근거 없음` 한 건, 전체는 불합격·종료 1이었다. verify 1의 독립 입력 19건도 같은 CLI로 다시 실행했다. 두 실행 결과의 차이는 `ownerFailNoRef` 행이었다.

### 자리 검색

§20-C P6′의 명세 좌표 24개는 `measure-stage-d.mjs`의 36, 37, 175, 194, 199, 200과 `stage-d/measurement.mjs`의 9, 10, 16, 27, 45, 46, 47, 57, 58, 60, 61, 68, 72, 135, 137, 138, 139, 141이다. 제외 좌표는 첫 파일의 import 5~8이다. 검색 결과 28줄에서 목록을 뺀 집합과 목록에서 결과를 뺀 집합은 모두 공집합이었다. 정적 분류기는 24개 중 함수 선언 5줄을 declaration으로, 나머지 19줄을 value로 표시했다. 호스트·셸 자식 검색 결과는 각각 0줄이었다.

§10-A 판독기 검색 결과는 184줄(운반 180·제외 4)이다. 목록과 결과의 양방향 차집합은 공집합이었다.

| 파일(app 기준) | 계약 또는 제외 근거 | 검색에 걸린 줄 |
|---|---|---|
| `scripts/windows-verdict.mjs` | C1~C4 | 704,720,723,726,728,731 |
| `scripts/windows-verdict.mjs` | P1/P2/P4 | 384 |
| `scripts/windows-verdict.mjs` | P1/P3/P4/P5 | 515,521,544,549,567,570,572–575,578–579,581–582,586 |
| `scripts/windows-verdict.mjs` | P1/P4/P5 | 600,607–612,616,619,621,624,626,628–630,632,635,644–645,652,660,663,670–678 |
| `scripts/windows-verdict.mjs` | P1/P5 | 292,297,313,326–328,330 |
| `scripts/windows-verdict.mjs` | P1~P5 공통 키·연산 | 12,29 |
| `scripts/windows-verdict.mjs` | P2 | 45,47,87–89,91–93,96–97,100–104,106,113–115,117–118,120–121,125–126,128,137,148,150,152,155,160,162,164–165,167,169–170,172–174,177–180,184–188,191–193,197–200,202–204 |
| `scripts/windows-verdict.mjs` | P2/P3 | 411,413,415–416,422–425,427,429,431–432,435,438,440–441,446–447,452,456 |
| `scripts/windows-verdict.mjs` | P2/P3/P5 | 355–356,358,365,368,463,481 |
| `scripts/windows-verdict.mjs` | P3 | 246,254,492–493,498,501–505 |
| `scripts/windows-verdict.mjs` | P3/P4 | 214,216–218,222–223,225,230–233,236,238,240,272–275,282,284,286 |
| `scripts/windows-verdict.mjs` | 제외(comment) | 408 |
| `scripts/windows-verdict.mjs` | 제외(declaration) | 244,268,490 |

### 통합 게이트

Node 22.23.3 및 SQLite Node ABI 127에서 파일 필터 없이 Vitest를 실행했다. 구현 전 `99d4def2`와 직전 실측 트리 `f5ce4ca9`의 `app/` 차이는 0줄이다. r2 결과는 파일 `9 failed | 1140 passed | 4 skipped (1153)`, 테스트 `22 failed | 10903 passed | 1 expected fail | 11 skipped (10937)`다. 이전 실행과 실패한 22개 이름의 양방향 차집합은 0건이다. 미처리된 Windows 플러그인 제어 오류도 양쪽 1건이었다. 실패 파일과 플랫폼 원인은 [변경 전후 대조](#통합-테스트의-변경-전후-대조)에 있다.

가드 5개가 통과했고 린트는 오류 0·경고 12, TypeScript 오류는 0이었다. Node 전체 1,153건, 직접 시험 56건, 렌더러 하네스 3건이 통과했다. 일반 빌드에서 두 호스트의 기동·포트 요청·종료와 preload의 `ooBridge` 7개 키를 확인했다.

## r3 사전 실행

도구 커밋은 `515ff58d60eb5d76744cc34aaad20bc7f186d928`이다. Node 22.23.3과 Electron 39.8.10을 사용했다. §19 H1-0의 재생 입력 216개가 고정 목록과 바이트 단위로 일치했다. 목록 SHA-256은 `07b4cfc85c5e522b11c5de73611bceaba2665b12e4bf6e50e8e6e5c8488631aa`다. 일반 renderer 번들에서 `__ooDev`가 있는 파일은 0개, 진단 번들은 1개였다.

### 기준 앱과 후속 앱 재생

각 실행의 `environment`는 `linux-electron`이었다. §19 H1-0의 소스 복원 후 앱 소스와 지정 커밋을 대조했고, JSON의 도구 SHA·앱 commit·tree·dirty를 확인했다. E 시나리오는 전체 테스트와 빌드 종료 뒤 순차 실행했다.

| 실행 | 앱 커밋 | 앱 소스 tree | 관측 | 종료 |
|---|---|---|---|---:|
| D 도구 host | `515ff58d` | `017b27d0803eb82e1e6748cf85f2b77155c03474` | 측정 7행 · 판정 충족 | 0 |
| D 도구 geometry | `515ff58d` | `017b27d0803eb82e1e6748cf85f2b77155c03474` | 마지막 댓글 표시·포커스 충족 | 0 |
| D 기준 host | `c7d2adf2` | `cd989a2f9b8c2689fcb467d3fa2e655d66228cc5` | 측정 7행 · 판정 충족 | 0 |
| D 후속 host | `7db1c7ce` | `9235fa7cb7ea2506abd5a6b38bda665ded21882b` | 측정 7행 · 판정 충족 | 0 |
| E 도구 small | `515ff58d` | `017b27d0803eb82e1e6748cf85f2b77155c03474` | 첫 본문 215.6ms · 기능·크기 충족 | 0 |
| E 기준 small | `7db1c7ce` | `9235fa7cb7ea2506abd5a6b38bda665ded21882b` | 첫 본문 227.0ms · 기능·크기 충족 | 0 |
| E 후속 small | `eae9081b` | `6d2962222fe8c1629a937c1b10cabd5839bc1a07` | 첫 본문 112.3ms · 기능·크기 충족 | 0 |
| E 도구 long | `515ff58d` | `017b27d0803eb82e1e6748cf85f2b77155c03474` | 첫 본문 2,053.1ms · 기능·크기 충족 · 3,729ms 기준 충족 | 0 |
| E 기준 long | `7db1c7ce` | `9235fa7cb7ea2506abd5a6b38bda665ded21882b` | 첫 본문 2,552.2ms · 기능·크기 충족 | 0 |
| E 후속 long | `eae9081b` | `6d2962222fe8c1629a937c1b10cabd5839bc1a07` | 첫 본문 1,872.6ms · 기능·크기 충족 · 3,729ms 기준 충족 | 0 |

D 기준·후속 출력 한 쌍과 0328의 보관 JSON 한 쌍을 각각 `--compare`로 읽었다. 두 실행 모두 `verdict: true`와 종료 0을 반환했다.

### 판독기 CLI

failing 예제는 확정 전후 모두 불합격·1, passing 예제는 확정 전 보류·1, 확정 후 합격·0이었다. 출력 네 개를 각각 저장된 expected JSON과 대조했다. 확정된 passing 예제 사본의 소유자 행 변경 결과는 다음과 같다.

| 입력 | stdout | stderr 또는 보고서 관측 | 종료 |
|---|---|---|---:|
| T17/0326에 scrol 키의 FAIL 추가 | 0바이트 | `소유 행 대상 없음: T17/0326/scrol` | 2 |
| T17을 T71로 변경 | 0바이트 | `소유 행 대상 없음: T71/0326` | 2 |
| machine에 fail 입력 | 0바이트 | `소유 판정 값 오류: T17/0326 machine=fail` | 2 |
| scrol을 scroll로 수정 | 불합격 JSON | scroll의 machine만 FAIL. 소유 실패는 T17/0326 한 건, hold는 소유 판정 근거 없음 | 1 |

U39·U40과 새 CLI 시험을 구현 전후에 재생했다. 구현 전에는 U39만 통과했고, 구현 후에는 세 시험 모두 통과했다. 이전 verify 1의 변형 19건은 r2 출력과 같았다. verify 2의 11건 중 `keyedUnknownCellFailNoRef`와 `unknownTaskFailNoRef`만 합격·0에서 대상 진단·2로 바뀌었다.

### 소유자 검사 자리 검색

§21-C의 명령은 `rg -n 'ownersCheck|소유 행 대상 없음|소유 판정 값 오류' app/scripts/windows-verdict.mjs`다. 파일 하나의 경로를 표시하도록 `-H`를 주고 `site_census.mjs`에 같은 검색과 다음 목록을 전달했다.

| 줄 | 분류 | 관측 |
|---:|---|---|
| 342 | 제외 | 검사 함수 선언 |
| 347 | P5 ⑨ a | 같은 task·owner 쌍이 없는 행의 진단 |
| 353 | P5 ⑨ b | 같은 task·owner의 셀 키와 다른 행의 진단 |
| 358 | P5 ⑨ c | 잘못된 열·값의 진단. 정적 분류기의 comment 표식은 템플릿 문자열에 붙었고 실제 throw는 U40과 CLI에서 관측했다. |
| 624 | P5 ⑨ 호출 | 계획 검사 직후, 셀·원본 판독 전 |

검색 결과 5줄에서 명세 좌표 4개와 제외 1개를 빼면 공집합이며 역방향 차집합도 공집합이다. §10-A의 판독기 전체 검색은 189줄, 운반 185줄, 제외 4줄이었다. 아래 목록과의 양방향 차집합은 각각 0줄이었다.

| 파일(app 기준) | 계약 또는 제외 근거 | 검색에 걸린 줄 |
|---|---|---|
| `scripts/windows-verdict.mjs` | C1~C4 | 726,742,745,748,750,753 |
| `scripts/windows-verdict.mjs` | P1/P2/P4 | 405 |
| `scripts/windows-verdict.mjs` | P1/P3/P4/P5 | 536,542,565,570,588,591,593–596,599–600,602–603,607 |
| `scripts/windows-verdict.mjs` | P1/P4/P5 | 621,629–634,638,641,643,646,648,650–652,654,657,666–667,674,682,685,692–700 |
| `scripts/windows-verdict.mjs` | P1/P5 | 292,297,313,326–328,330 |
| `scripts/windows-verdict.mjs` | P1~P5 공통 키·연산 | 12,29 |
| `scripts/windows-verdict.mjs` | P2 | 45,47,87–89,91–93,96–97,100–104,106,113–115,117–118,120–121,125–126,128,137,148,150,152,155,160,162,164–165,167,169–170,172–174,177–180,184–188,191–193,197–200,202–204 |
| `scripts/windows-verdict.mjs` | P2/P3 | 432,434,436–437,443–446,448,450,452–453,456,459,461–462,467–468,473,477 |
| `scripts/windows-verdict.mjs` | P2/P3/P5 | 376–377,379,386,389,484,502 |
| `scripts/windows-verdict.mjs` | P3 | 246,254,513–514,519,522–526 |
| `scripts/windows-verdict.mjs` | P3/P4 | 214,216–218,222–223,225,230–233,236,238,240,272–275,282,284,286 |
| `scripts/windows-verdict.mjs` | P5 ⑨ | 345,347,349,353,358 |
| `scripts/windows-verdict.mjs` | 제외(comment) | 429 |
| `scripts/windows-verdict.mjs` | 제외(declaration) | 244,268,511 |

### 통합 게이트와 변이

§19 H6의 가드 5개가 통과했다. 린트는 오류 0·경고 12, TypeScript 오류는 0이었다. Node 스크립트 전체 1,155건, 직접 시험 4파일 58건, P10 렌더러 시험 3건이 통과했다. 일반/진단 빌드와 일반 빌드의 두 호스트 기동·종료 및 preload의 `ooBridge` 7개 키를 확인했다.

Node 22.23.3·SQLite ABI 127에서 필터 없이 실행한 Vitest 결과는 파일 9 실패·1,140 통과·4 건너뜀, 테스트 22 실패·10,903 통과·1 예상 실패·11 건너뜀이었다. r2 실행 커밋 `8e3384e7`과 ΔV2 설계 커밋 `d77d3f3c`의 `app/` 차이는 0줄이다. r2 로그와 이번 로그에서 실패한 테스트 이름 22개의 양방향 차집합은 공집합이었다. 양쪽 모두 Windows 플러그인 제어의 같은 미처리 거부 1건을 기록했다. [실패 파일과 환경별 원인](#통합-테스트의-변경-전후-대조)

판독기 선택 증거 13개와 열거 sweep 113개를 격리된 소스에서 실행했다. 126개 모두 예상한 시험에서 실패했다. verify 2 판독기 변이 10건의 재현 결과는 9개 검출·순서 대조 1개 통과였다. [변이 원장](r3-mutations.tsv)
