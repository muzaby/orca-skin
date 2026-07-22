# Plan — 0144-debug-log-config

> 비기능(관측성 인프라) 작업 — Claude 직접 plan→impl→verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0144-debug-log-config` |
| 작성자 | Claude Code |
| 일자 | 2026-07-22 |
| 매핑 | PHASES (0123/0124 로깅 시스템 후속) / PR (요청 시) |
| 상태 | DRAFT → READY → IMPL |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | (1) `~/.config/orca/orca.json` 에 디버그 필드 추가 — 활성화 시 debug 레벨 로그 전체 출력. (2) 메시지 델타 로그(있으면) 모두 제거. (3) 기존 (풀) 메시지 로그에서 메시지 페이로드 부분만 제거. | 라이브 세션 요청(본 태스크 개요/요구사항) |
| 명시 결정 | ① 출력 범위 = **wire 이벤트까지**(prod 노출, 본문 제거). ② 페이로드 제거 = **메시지 본문만**(메타 유지). ③ 필드 = **boolean `debug`**. | 라이브 세션 AskUserQuestion 응답(2026-07-22) |
| 추론 의도 | 설치본(prod) 사용자 피드백 로그의 진단성 강화 + 대화 내용 유출 방지. debug 는 사용자가 언제라도 켤 수 있는 opt-in 스위치. | 개요("정보가 충분하지 않다")에서 해석 |

## Context (왜)

prod 는 `info` 이상만 파일 기록(`observability.md` §4)이라 배포 후 받은 로그가 진단에 부족하다.
사용자가 orca.json 에 `"debug": true` 를 넣어 언제라도 debug 레벨 로깅을 켜되, 대화 흐름(메시지/턴
이벤트)은 보이면서 **메시지 본문은 남기지 않고** 델타 노이즈도 없어야 한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 레벨 정책 `minRank = dev ? debug : info`, 생성자 1회 결정 | `app/src/main/infra/log/log-manager.ts:61` · `index.ts:53` |
| `initLog()` 가 `loadOrcaConfig()` 보다 먼저 실행 → 생성자 주입 불가, 런타임 setter 필요 | `app/src/main/index.ts:26` · `app/src/main/app/bootstrap.ts:275` |
| orca.json 스키마 = version·env·update 만 | `app/src/main/infra/config/orca-file.ts:64-88` |
| config 로더/캐시 재사용 | `app/src/main/infra/config/orca-config.ts:15,30` |
| 델타 2종은 전 경로 로깅 제외(단일 필터점) | `app/src/main/infra/ipc/wire-log.ts:11,24-28` |
| 풀 메시지 로그 = `ipc.wire.event` `{type,payload}`, 전체 DEV 게이트 | `app/src/main/app/handlers/misc.ts:318,322-324` |
| 메시지 본문 필드(NormalizedEvent) | `app/src/shared/ipc.ts:513,530,552-566` (message.completed.message.text / reasoning.text / queued·committed.text+attachmentViews / input.echo.text / delta.text) |
| 로깅 정본 문서 (prod info, wire=dev 전용 결정) | `@docs/arch/backend/observability.md` §4/§5/§6 |

## 인수 기준 (Acceptance Criteria)

1. `orca.json` 에 `"debug": true` 를 넣으면 `parseOrcaFile`/`OrcaConfig.debug === true` 로 파싱된다(누락/false/비불린 안전).
2. prod(`dev:false`) `LogManager` 에서 `setDebugEnabled(true)` 후 `debug` 레코드가 기록되고, `setDebugEnabled(false)` 면 info 이상만 기록된다. dev(`dev:true`)는 플래그와 무관하게 항상 debug.
3. 부팅 시 `loadOrcaConfig().debug === true` 면 `setLogDebug(true)` 가 호출되어 prod 파일 레벨이 debug 로 올라간다.
4. prod 에서 debug 활성 시 `ipc.wire.event` 가 파일에 남되, 그 `data` 에 메시지 본문(`text`·`message`·`attachmentViews`)이 **없고** `type`·`sessionId` 등 메타는 유지된다.
5. `message.delta`·`message.reasoning.delta` 는 prod/dev 모든 경로에서 로그에 남지 않는다(기존 제외 유지).
6. DEV 무회귀: `npm run dev` + 디버그 패널 "로그" 스위치 → 기존처럼 풀 payload wire 로그 + 콘솔 미러.
7. 게이트: lint 0 error · typecheck 0 · 신규/기존 순수 vitest green · 레이어 경계 0 · 신규 의존성 0 · IPC 채널 불변.

## 범위 / 비범위

- **범위**: orca.json `debug` 필드 · 런타임 레벨 setter · prod wire sink(본문 제거) · 문서 갱신 · 단위 테스트.
- **비범위**: `tool.call.*` args/result(도구 I/O) 제거 — 요구 3("메시지 본문") 범위 밖(redaction 은 계속 통과). 원격 전송(OQ4). 신규 IPC 채널/설정 UI.

## 의존 기술 / 전제

- 기존 모듈 재사용: `LogManager` 파이프라인·`EXCLUDED_WIRE_LABELS`·`loadOrcaConfig`/`getOrcaConfig`·zod. **신규 의존성 0.**
- 전제: prod 에는 dev 콘솔 미러 미주입(파일만) — 사용자는 `application.jsonl` 을 전달.

## 설계

- **config**: `OrcaConfigTopSchema` 에 `debug: z.boolean().optional()`, `OrcaConfig.debug?: boolean`, `parseOrcaFile` 조립에 조건부 포함.
- **레벨 setter**: `LogManager` 에 `dev` 필드 보관 + `debugEnabled` + `setDebugEnabled(on)` 이 `minRank` 재계산(`(dev||on)?debug:info`). `index.ts` 에 `setLogDebug(on)` export.
- **부팅 배선**: `bootstrap.ts` orca-config 스텝에서 `const cfg = loadOrcaConfig(); setLogDebug(cfg.debug === true)`; prod 한정 `if (cfg.debug && !import.meta.env.DEV) setWireLog(true)`.
- **본문 제거 + prod sink**: `wire-log.ts` 에 순수 `stripMessageContent(data)` export(내용 키 `text`·`message`·`attachmentViews`·`delta` 제거). `misc.ts` sink 주입을 dev(풀, 무변)/prod(strip) 분기.
- 레이어: 전부 infra/app 하향 — 경계 위반 없음(app→infra, infra→shared).

## 파생 UX / 엣지케이스

- 손상/비불린 `debug` → zod 로 기본값(false) 폴백(기존 orca.json 관용). 
- prod debug on 시 renderer debug 로그도 파일에 남음(설계 의도 — "모든 debug 로그"); redaction 공통 적용.
- 동시성/멀티세션: 레벨은 프로세스 전역 1개(부팅 시 1회 설정) — 세션별 분기 없음.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| prod wire 노출로 로그량 급증 | opt-in(기본 off) + 델타 제외 + 본문 제거 + 10MB×5 로테이션 |
| 도구 I/O(args/result) 잔존 가능 유출 | 요구 범위 밖 명시 + redaction(비밀 마스킹·8KB) 유지; verify 에 후속 판단 여지 기록 |
| observability.md "wire=dev 전용" 결정 개정 | 사용자 명시 결정으로 개정 — 문서 동시 갱신 |

## 영향 받는 파일

- `app/src/main/infra/config/orca-file.ts`, `.../infra/log/log-manager.ts`, `.../infra/log/index.ts`,
  `.../app/bootstrap.ts`, `.../infra/ipc/wire-log.ts`, `.../app/handlers/misc.ts`
- 테스트: `orca-file.test.ts` · `log-manager.test.ts` · `wire-log.test.ts`
- 문서: `docs/arch/backend/observability.md`

## 참고 문서

- `@docs/arch/backend/observability.md` §4/§5/§6
- IPC 변경 없음 → `IPC_CONTRACT.md` 무변경.

## 게이트

- `cd app && npm run lint && npm run typecheck` + 순수 vitest(`infra/config/orca-file`·`infra/log/log-manager`·`infra/ipc/wire-log`).
- 신규 테스트: orca.json debug 파싱 · setDebugEnabled 레벨 · stripMessageContent.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구/결정을 출처로 인용, 추론 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인`/`@docs` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 신규 의존성 0 확인.
- [x] 파생 UX — 손상값/renderer 로그/동시성 펼침.
- [x] 리스크 — 로그량·도구 I/O·문서 개정 트레이드오프 기록.

---

> **[구현자 기입]** — Claude 비기능 직접 구현.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `infra/config/orca-file.ts`(debug 스키마/타입/파싱) · `infra/log/log-manager.ts`(`setDebugEnabled`+mutable minRank) · `infra/log/index.ts`(`setLogDebug` export) · `app/bootstrap.ts`(config→setLogDebug 배선) · `infra/ipc/wire-log.ts`(`stripMessageContent`) · `app/handlers/misc.ts`(prod wire sink 분기) · 테스트 3종 · `docs/arch/backend/observability.md` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run infra/config/orca-file infra/log infra/ipc infra/config` |
| 게이트 결과 | lint ✅ 0 error(1 pre-existing warning=TanStack Virtual 무관) · typecheck ✅ 3분할 0 · vitest ✅ 91/91(신규 orca-file 2·log-manager 2·wire-log 4). DB/electron 스위트는 egress ABI 제약으로 비실행(변경 무관). |
| 블로커 / 역질문 | 없음 |
| 부팅 순서 확인 | `orca-config` 스텝(bootstrap:274, `loadOrcaConfig`+`setLogDebug`+config 캐시 채움)이 `registerMiscHandlers`(bootstrap:490, prod `getOrcaConfig()`+`setWireLog`)보다 선행 — 캐시 히트라 dir/throw 리스크 없음, 레벨·wire 배선이 chat 이벤트 유입 전 완료. |
| 대상 커밋 | (커밋 후 기입) |
