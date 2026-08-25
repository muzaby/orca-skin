# Plan — 0200-host-managed-runtime-env

## 메타

| 항목 | 값 |
|---|---|
| slug | `0200-host-managed-runtime-env` |
| 작성자 | Claude Code |
| 일자 | 2026-08-25 |
| 매핑 | Claude Code host-managed provider 환경 주입 |
| 상태 | READY |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST=1`은 Claude Code 프로세스 시작 환경에서 판정되므로 `settings.json.env`만으로는 provider URL·token·model을 안정적으로 전달하지 못한다.
- 완료 후 달라지는 것: host-managed 모드에서는 정적 settings와 하네스 런타임 `runtimeEnv`의 API base URL·auth token·model을 모두 최종 `options.env`에 넣는다.
- 성공 기준: 네 입력 레이어 중 어디서 host-managed 모드와 provider 값이 와도 기존 우선순위대로 한 장의 자식 프로세스 환경이 만들어진다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST`와 영향받는 provider 변수는 settings가 아니라 host 환경으로 주입한다. | 라이브 세션 1차 제안 |
| 명시 요구 | "하네스 런타임에서 제공받는 runtimeEnv 에 채워질(api base url, auth token 등) 도 똑같이 적용돼야 한다." | 라이브 세션 후속 결정 |
| 추론 의도 | Agent SDK 사용 구조에서 host 환경은 전역 Electron 환경 변경이 아니라 `query().options.env`로 생성되는 Claude Code 자식 프로세스 환경이다. | SDK 0.3.220 런타임 및 현행 adapter 경로 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | host-managed 플래그와 provider bootstrap 변수는 최종 `options.env`로 전달한다. | settings env는 프로세스 시작 판정 이후의 설정 채널이다. | 사용자 1차 제안 | ACTIVE | — |
| D-002 | `runtimeEnv`의 API URL·token·model·flag에도 D-001을 동일 적용한다. | 런타임 보강값이 실제 실행 자격증명과 endpoint의 최상위 권위다. | 사용자 후속 결정 | ACTIVE | — |
| D-003 | 기존 우선순위 `runtime > settings > app > process`를 유지한다. | 전용/동적 구성이 전역 폴백을 이겨야 한다. | 현행 계약 + 사용자 요구와 양립 | ACTIVE | — |
| D-004 | host-managed 활성 시 settings의 문자열 env 블록 전체를 자식 환경으로 hoist한다. | 일부만 옮기면 두 채널 충돌과 향후 영향 변수 누락이 생긴다. | 현행 fail-safe 계약 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 D-001~D-004를 신설했다. SUPERSEDED/OPEN 결정은 없다.
- ACTIVE 결정 ↔ AC 대조: D-001↔AC1·AC3, D-002↔AC2·AC4, D-003↔AC4, D-004↔AC1·AC5 — 충돌 0.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 | SDK는 `options.env`를 Claude Code spawn env로 사용한다. |
| 이미 충족하는가 | 부분 충족 | runtime/app env가 하나라도 있으면 이미 settings env 전체가 hoist되지만, settings-only + host-managed는 `buildsEnv=false`다. |
| 더 작은 해법 | 있음 | adapter/query 경로를 중복 수정하지 않고 `prepareHarnessConfig`의 env 생성 판정만 확장한다. |
| 선행 주장 대조 | 완료 | `runtimeEnv`는 이미 최상위 spread이고 env fingerprint에도 포함된다. |
| 기존 결정 충돌 | 없음 | 전체 hoist·우선순위·원본 불변·fingerprint 계약을 유지한다. |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: `runtimeEnv`가 비어 있지 않으면 현행도 `options.env`를 만들며, 남은 결함은 host-managed가 상속 process env에만 있고 settings env가 존재하는 정적 경로다.

## 5. 동작 / 사용자 흐름

```text
settings/app/process/runtimeEnv 해석
  → 우선순위대로 host-managed 최종값 판정
  → 활성: settings env 전체 + runtimeEnv를 최종 options.env로 조립
  → 같은 최종 env로 fingerprint 계산
  → query()가 Claude Code 자식 프로세스를 spawn
```

| 시작 상태/이벤트 | 시스템 동작 | 관측 결과 |
|---|---|---|
| settings env가 host-managed를 켬 | env 블록 전체 hoist | provider URL·token·model이 프로세스 환경에 존재한다. |
| runtimeEnv가 flag/provider 값을 제공 | runtime 최상위로 병합 | 런타임 URL·token·model이 settings/app/process를 덮는다. |
| process env가 flag를 켜고 settings env가 provider 값을 제공 | 상속 env를 한 번 읽어 전체 env 생성 | settings provider 값도 자식 프로세스 환경으로 이동한다. |
| 상위 레이어가 flag를 `0`으로 끔 | 하위 레이어의 `1`을 재활성화하지 않음 | 기존 정적 settings 채널을 유지한다. |

- 오류/재시도: env 조립은 순수 동기 경로이며 기존 query 오류 전파를 바꾸지 않는다.
- multi-session: 최종 env fingerprint 변경이 기존 respawn 판정을 계속 구동한다.
- 폐쇄망: base URL과 token 원문은 로그/DB/fingerprint에 남기지 않는다.

## 6. 범위 / 비범위

- 범위: spawn env 조립 판정, runtimeEnv 포함 우선순위 회귀 테스트, 관련 현재상태 문서 정합.
- 비범위: Claude Code 내부 host-managed 변수 목록 추측, IPC/UI/DB/새 의존성, 전역 `process.env` 변경.

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | settings-only에서 flag=`1`이면 settings 문자열 env 전체가 `env`로 이동하고 settings에는 env가 없다. | 순수 테스트로 flag·URL·token·model과 비-env 설정 보존 단언 | settings service → `prepareHarnessConfig` → TurnRequest → `query` |
| AC2 | runtimeEnv의 flag·URL·token·model은 모두 최종 `env`에 있고 runtime 값이 충돌을 이긴다. | 네 레이어 충돌 테스트 | runtime augmenter → config.runtimeEnv → prepare → query |
| AC3 | process env의 flag=`1`도 settings env hoist를 활성화한다. | 주입 baseEnv 테스트 | Electron process env → prepare → query |
| AC4 | 최종 flag 판정도 `runtime > settings > app > process`를 따르며 상위 `0`은 하위 `1`을 끈다. | 레이어별 table test | 네 producer → prepare 판정 |
| AC5 | host-managed가 꺼진 settings-only 경로는 `env`를 만들지 않고 settings 참조와 env 블록을 보존한다. | 기존/신규 무회귀 테스트 | 정적 settings → prepare → settings option |
| AC6 | 최종 env 변경은 secret 원문 없는 fingerprint를 바꾸고 타입·lint를 통과한다. | fingerprint 테스트 + 정적 gate | prepared fingerprint → respawn 판정 |

### AC 검증 주의사항

- 기존 `options.env를 만들지 않는 턴` 테스트는 AC5의 실제 케이스로 재사용한다.
- 사람 실기 없음: `baseEnv` 주입 seam과 최종 PreparedHarnessConfig로 전 경로를 기계 검증할 수 있다.
- 총량 기준 없음. `query()` 소비 경로 2개(`complete`, `sendMessage`)는 같은 PreparedHarnessConfig를 소비한다.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `buildsEnv`는 runtime/app env 존재만 본다. | `app/src/main/adapters/harness-config.ts:234-255` |
| runtimeEnv는 settings/app/process 뒤에 spread되어 최상위다. | `app/src/main/adapters/harness-config.ts:247-254` |
| env 전체 hoist와 WeakMap 참조 안정성이 이미 구현됐다. | `app/src/main/adapters/harness-config.ts:168-205` |
| query 진입점 두 곳 모두 prepared settings/env를 전달한다. | `app/src/main/adapters/claude.ts:247-270,370-383` |
| SDK는 0.3.220으로 고정된다. | `app/package-lock.json:12,65-81` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| production `prepareHarnessConfig` 호출 | `rg 'prepareHarnessConfig\\(' app/src/main --glob '*.ts'`에서 테스트 제외 | 2 | resolved와 unresolved helper 내부 호출이다. |
| Claude `query` 호출 | `rg 'query\\(' app/src/main/adapters/claude.ts` | 2 | complete/send 모두 같은 adapter 변환을 쓴다. |
| env 조립 직접 구현 | `rg 'baseEnv:' app/src/main --glob '*.ts'`에서 테스트 제외 | 2 | turn setup의 resolved/unresolved 경로뿐이다. |

### 수치 / 전칭 표현 검산

- provider 설정 경로의 query 소비는 2곳이며 둘 다 `adaptSettings`와 `adaptEnv`를 함께 호출한다.
- 기존 테스트 `options.env 를 만들지 않는 턴에는 settings 채널을 건드리지 않는다`가 실제 존재한다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
runtimeEnv/appEnv 존재 판정
  → 있으면 base+app+settings+runtime 조립/hoist
  → 없으면 settings.env 유지
```

- settings-only 경로는 process env의 host-managed 플래그를 보지 않아 provider 값을 settings 채널에 남긴다.
- runtimeEnv가 비어 있지 않은 경로는 이미 올바른 최종 env와 fingerprint를 만든다.

### TO-BE

```text
runtime/settings/app의 flag 우선 확인
  → 필요할 때만 base env snapshot
  → 최종 flag=`1` 또는 runtime/app env 존재 시 조립/hoist
  → 동일 snapshot으로 env와 fingerprint 생성
```

- 책임은 adapter 조립 포트 `harness-config.ts`에 유지한다.
- adapter query 직전에는 새 조건 로직을 두지 않는다.

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 이유 | 연결 |
|---|---|---|---|---|
| env 생성 판정 | runtime/app 존재 | 기존 조건 + 최종 host-managed 활성 | settings/process flag 지원 | AC1·AC3·AC4 |
| runtimeEnv | 비어 있지 않으면 이미 env | flag/provider 값도 table test로 명시 잠금 | 사용자 후속 요구 | AC2 |
| snapshot | buildsEnv 뒤 baseEnv 호출 | 판정에 필요하면 1회 lazy snapshot 후 재사용 | process flag와 일관된 한 장 | AC3·AC6 |
| 비활성 경로 | settings 참조 유지 | 그대로 유지 | 무회귀 | AC5 |

### 핵심 책임 분리

| 모듈 | 책임 | 입력/출력 | 호출자 |
|---|---|---|---|
| `adapters/harness-config.ts` | flag 우선순위 판정·env 조립·hoist·fingerprint | runtime/settings/app/base → PreparedHarnessConfig | turn setup |
| `adapters/claude.ts` | prepared 값을 SDK options로 변환 | settings/env → query options | complete/send |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| host-managed 활성값 | `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST === '1'` | prepare | 네 레이어 병합 판정 | settings provider 값이 spawn env에 없음 |
| env 우선순위 | prepare spread 순서 | prepare | 매 resolved turn | 잘못된 endpoint/token/model 사용 |
| 전체 hoist | `withEnvBlockHoisted` | prepare | buildsEnv인 매 turn | 두 채널 drift |
| runtimeEnv 전달 | `config.runtimeEnv` 최종 spread | prepare | 매 resolved turn | 동적 자격증명/URL 무시 |
| env fingerprint | `harnessEnvFingerprint(finalEnv)` | prepare | 조립 직후 | 환경 변경에도 기존 프로세스 재사용 |

- 선택적 의미: `env=undefined`는 SDK 기본 상속, flag 미정/`0`은 비활성, 정확히 문자열 `1`만 활성이다.
- 외부 SDK 경계: `options.env`는 상속을 포함한 완전한 `Record<string,string>`이어야 한다.

## 11. 구현 설계

| 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/harness-config.ts` | spawn 입력 SSOT | lazy base snapshot과 우선순위 flag 판정 추가 | 주입 `baseEnv` |
| `app/src/main/adapters/harness-config.test.ts` | 의미 회귀 | settings/runtime/process/상위 disable 및 fingerprint 단언 | 순수 Vitest |
| `docs/arch/backend/auth.md` | 현재상태 계약 | host-managed 예외와 runtimeEnv 포함 설명 | 문서 grep/diff |

### 테스트 가능성

- electron/native 의존 없음: 기존 순수 adapter 테스트에서 전부 닫는다.
- 순서 관측점은 최종 `PreparedHarnessConfig.env`와 settings env 제거 여부다.

## 12. End-to-end 영향

```text
runtime model augmenter/settings/app/process
  → prepareHarnessConfig
  → TurnRequest env/settings + fingerprint
  → ClaudeAdapter adaptEnv/adaptSettings
  → SDK query/Claude Code process
```

- producer 기준은 네 레이어의 명시 우선순위다.
- consumer는 추가 파생 없이 prepared 값을 그대로 SDK에 전달한다.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: query spawn 직전 이미 조립된 env를 사용한다.
- 취소/종료/retry: 변경 없음.
- 다중 저장소 쓰기: 코드에는 해당 없음. handoff 상태 사본은 plan/verify와 INDEX를 각 단계 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 네트워크/출력/요청 수 증가 없음.
- base env는 host-managed 판정에 필요할 때 한 번 snapshot하고 최종 조립에 재사용한다.
- 일반 settings-only 비활성 경로의 참조 동일성과 `env=undefined` fast path를 보존한다.

## 15. 외부 구현 포트 / 문서 계약

- 공개 타입/포트 변경 없음. runtime augmenter의 기존 `runtimeEnv: Record<string,string>` 의미만 회귀 테스트로 강화한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문 | 결과 |
|---|---|---|---|
| runtime > settings > app > process | harness-config 주석/테스트 | §7 AC4, §10 | 유지 |
| env 생성 시 settings env 전체 hoist | harness-config 주석/테스트 | D-004, AC1 | 유지 |
| 정적 fast path 참조 안정성 | harness-config WeakMap/테스트 | AC5, §14 | 유지 |
| adapter 하향 의존/순수 변환 | main AGENTS | §9·§11 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 문자열 `true` 등 비공식 truthy 오인 | 정확히 `1`만 활성으로 고정 |
| baseEnv를 두 번 읽어 판정/실행 drift | lazy snapshot 1회 재사용 |
| runtime 요구가 기존 동작이라 테스트가 형식화에 그침 | 네 레이어 충돌과 flag 자체를 함께 심어 의미를 잠금 |

- 신규 의존성 없음. 되돌리기 어려운 공개 계약 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/adapters/harness-config.ts`
- `app/src/main/adapters/harness-config.test.ts`
- `docs/arch/backend/auth.md`
- `docs/handoff/0200-host-managed-runtime-env/{plan,verify}.md`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용 가이드: `app/AGENTS.md`, `app/src/main/AGENTS.md`, `docs/AGENTS.md`, `docs/handoff/AGENTS.md`.
- 기본: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `cd app && ./node_modules/.bin/vitest run src/main/adapters/harness-config.test.ts`.
- 문서/패치: `git diff --check`; 사람 실기 없음.

## READY self-review

- [x] Decision/Part I/AC/Technical Design 추적과 ACTIVE 충돌 0을 확인했다.
- [x] AS-IS/TO-BE/Delta와 강제 지점 5행을 작성했다.
- [x] query 2곳·production prepare 경로 2곳·기존 테스트를 실측했다.
- [x] semantic 목표를 최종 env/settings/fingerprint 동작으로 검증한다.
- [x] 신규 계약·의존성·IPC·DB·사람 실기 없음과 하위 게이트를 확인했다.

---

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: §9의 중앙 조립 지점에서 판정하고 adapter query 경로는 건드리지 않았다.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---:|---|---|
| host-managed 활성값 | 네 레이어 병합 판정 | 4/4 | 관련 Vitest 5건: settings/runtime/app/process와 상위 `0` 관측 | — |
| env 우선순위 | prepare spread 순서 | 4/4 | 네 레이어 runtime 충돌 케이스에서 URL·token·model·flag 전부 runtime | — |
| 전체 hoist | buildsEnv인 매 turn | 2/2 | settings-only/runtime 케이스 모두 provider settings env `undefined` | — |
| runtimeEnv 전달 | resolved turn 최종 spread | 4/4 | runtime provider 변수 4종 최종값 단언 | — |
| env fingerprint | 조립 직후 | 1/1 | 기존 fingerprint suite 포함 관련 파일 36/36 | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 없음.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|
| `buildsEnv`에서 `hostManaged` 제거 | 이번 hunk 되돌림 | settings-only/process-host 2건 | 잠김 — 34 pass/2 fail |
| 최종 spread에서 runtimeEnv를 settingsEnv보다 먼저 이동 | D-002·D-003 | 관련 포함 7건 | 잠김 — 29 pass/7 fail |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구·상태 소비자 | 해당 없음 | UI 변경 없음 |
| 새 실패 경로와 Part I 전이 | 새 실패 경로 없음 | 순수 조립만 변경 |
| 실패가 무반응으로 보이는가 | 해당 없음 | 기존 query 오류 전파 유지 |
| 늦은 응답이 상태를 되돌리는가 | 해당 없음 | 비동기 상태 변경 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | process host-managed 판정과 env 조립이 서로 다른 snapshot을 읽을 수 있음 | ✅ 선조치 — lazy snapshot 1회 재사용 | process test가 baseEnv 1회 호출을 단언 |
| 2 | `true`/`0`을 일반 truthy로 처리하면 모드가 오활성화됨 | ✅ 선조치 — 정확히 문자열 `1`만 활성 | 비활성 fast-path 테스트 |

### 설계 대비 명시적 차이

- 없음.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 값 수명 계약 무변경 | AC6 fingerprint suite 36/36 |
| 공유 | 해당 없음 — turn-local 객체 | AC1·AC2 최종 객체 단언 |
| 재진입 | 해당 없음 — 순수 동기 조립 | baseEnv 1회 단언 |
| 다른 무효화 축 | 상위 명시 `0` | AC4 runtime `0`이 최종값 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `harness-config.ts`, 해당 테스트, `auth.md`, plan/INDEX |
| 실행 명령 | 관련 Vitest, mutation 2종, lint, typecheck, diff check |
| 관측한 게이트 산출 | 관련 테스트 1파일 36/36 · lint 0 error/기존 warning 1 · typecheck 3/3 |
| 강제 지점 전수 | 15/15 |
| AC 자기보고 | 6/6 — AC1 5변수+settings 제거, AC2 runtime 4변수, AC3 base 1회, AC4 상위 0, AC5 참조 동일, AC6 fingerprint+정적 gate |
| 합계 검산 | ✅ 6 · ⚠️ 0 · ❌ 0 = 총 6 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 기존 전체-hoist 축을 host-managed static 경로로 확장했다.
- 막았어야 할 plan 지침·AC: 이번 plan AC1~AC5가 직접 잠근다.
- 반복 환경 한계: 없음.
- 현재 라운드 수: 1.

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | 없음 | — | — | — |
