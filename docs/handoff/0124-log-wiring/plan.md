# Plan — 0124-log-wiring

## 메타

| 항목 | 값 |
|---|---|
| slug | `0124-log-wiring` |
| 작성자 | Claude Code |
| 일자 | 2026-07-18 |
| 매핑 | PHASES "현재 작업 중" (보드 링크) — **선행: `0123-logging-system` verify/PASS 후 착수** |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 로그 시스템 핸드오프 2개 중 두 번째 = **로그 배선**. 배포 정책에서는 로그를 최소화하되 **필수 동작·경계에서는 확실한 동작확인**이 가능해야 한다. 에이전트가 분석할 수 있어야 한다 | 라이브 세션 요청 (2026-07-18) |
| 명시 요구 | 0123 **verify 이후 배선(본 건)도 진행**한다. **배선 시 chat event 에서 delta 는 제외**한다 | 라이브 세션 요청 (2026-07-18, 후속 지시) |
| 명시 요구 | **"클로드가 모두 진행하라"** — 0123·0124 의 구현·검증까지 전부 Claude 전담. 0123 verify/PASS 직후 대기 없이 본 건 impl→verify 수행 | 라이브 세션 요청 (2026-07-18, 후속 지시 — 앞선 추론을 사용자가 명시 확정) |
| 명시 요구 | **어시스턴트 델타를 wire log 를 포함한 로그 배선 전체에서 배제** — 기존 콘솔 wireLog 출력도 예외가 아니다(AC8 의 "기존 콘솔 wireLog 출력 불변" 단서 폐기) | 라이브 세션 요청 (2026-07-18, 구현 전 검토 턴) |
| 명시 요구 | **디버그 패널의 wire log 스위치를 "로그" 스위치로 변경, 켜지면 콘솔창에도 로그 출력** — 구현 전 검토에서 결정 3건으로 구체화: ① **통합 게이트**(ON = wire 이벤트(델타 제외) debug 기록 + 모든 로그 레코드 콘솔 미러 / OFF = wire 미기록 + 콘솔 침묵, 파일 기록은 기존 정책 유지 — dev 기본값 OFF 에선 콘솔 침묵으로 0123 무조건 미러를 대체) ② **배제는 델타 2종만**(telemetry·subagent.task 는 유지) ③ **wire 레코드는 payload 전체**(redaction 통과, dev 전용 + 로그 스위치 게이트 하에서만) | 라이브 세션 요청 (2026-07-18, 구현 전 검토 턴 — AskUserQuestion 확정 3건) |
| 추론 의도 | "delta 제외" = 스트리밍 델타 이벤트(`message.delta`·`message.reasoning.delta`, `app/src/shared/ipc.ts:483,540`)를 info 카탈로그만이 아니라 **debug·wire 기록·콘솔 미러를 포함한 배선의 전 경로에서 미기록** — 구현 전 검토 턴에서 사용자가 "wire log 포함" 을 명시 확정(추론→명시 승격) | 추론 — "로그 최소화" 취지의 일관 적용 |
| 추론 의도 | "배선" = (a) prod 에 남길 이벤트 카탈로그를 확정하고 (b) 기존 `console.*` call site 를 로거로 이관하며 (c) 재발을 기계 강제(eslint)하는 작업 | 추론 — 0123 이 인프라만 다루므로 소비 지점 연결이 별도 필요 |
| 추론 의도 | "에이전트가 분석" 요구를 배선 규율로 번역: 이벤트 이름은 grep 가능한 고정 문자열(`<domain>.<operation>.<state>`), 자유 서술 메시지에 의존하지 않는다 | 추론 |

## Context (왜)

0123 이 로깅 인프라(LogManager·JSONL·redaction·장애 훅)를 만들지만, 인프라만으로는 파일이 비어 있다. main 전역의 `console.*` **35곳(20파일, 0123 반영 후 재실측 — 최초 설계 시점 측정치 62/30 은 0123 이 index.ts 전역 가드 등을 이관하며 감소)** 은 파일에 남지 않고 이벤트 이름도 없어 검색·집계가 불가능하다. 본 핸드오프는 **prod 이벤트 카탈로그를 확정**하고, 기존 call site 를 로거로 이관하며, `no-console` lint 로 회귀를 차단한다. 아울러 구현 전 검토(2026-07-18)에서 사용자 확정한 **디버그 패널 "로그" 스위치(구 wire 스위치)의 통합 게이트** — wire 이벤트 debug 기록 + 콘솔 미러 동시 제어 — 를 배선한다. 완료되면 배포본의 JSONL 만으로 "어떤 버전에서, 어떤 흐름 중, 어디서, 무엇이 실패했나"를 에이전트가 재구성할 수 있다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `console.*` 분포 — **총 35곳/20파일 (0123 반영 후 재실측)**. 밀집: `app/bootstrap.ts`(9) · `app/chat-turn.ts`(4) · `app/updater.ts`(2) · `infra/config/orca-config.ts`(2) · `features/providers/provider-registry.ts`(2) · `infra/log/index.ts`(2, 정당 예외), 나머지 산개. prefix 관례 `[main]`·`[boot]`·`[recovery]`·`[scheduler]`·`[mcp]`·`[update]`·`[shutdown]` 등. *최초 설계 시점 62/30 은 0123 구현 전 측정치 — stale* | `grep -rn 'console\.' app/src/main` (2026-07-18 재실측) |
| **wire-log 콘솔 출력의 AC3 충돌 (구현 전 검토 발견)** — `wireLog()` 의 `console.log` 는 `infra/ipc/wire-log.ts:14` 로, AC3 의 no-console 예외 범위(`infra/log/**`) 밖. 콘솔 출력을 유지하면 lint 위반 → AC8 개정(로거 흡수)으로 자연 해소 | `app/src/main/infra/ipc/wire-log.ts:13-15` · 본 plan AC3/AC8 |
| **wire 호출부는 2곳뿐** — `sendChatEvent`(`infra/ipc/send.ts:22`, 전 outbound NormalizedEvent chokepoint — 델타 포함)와 `turn-coordinator.ts:211`(`input.echo`, 사용자 텍스트 80자 포함 — 결정 ③ dev 전용 payload 허용에 포섭) | `app/src/main/infra/ipc/send.ts:22` · `features/chat/turn-coordinator.ts:211` |
| **델타 외 고빈도 이벤트** — `telemetry`(사용량 틱)·`subagent.task`(progress 반복 발화)도 같은 chokepoint 통과. 사용자 결정 ②로 **배제는 델타 2종만**, 이들은 유지(스위치 ON 일 때만 기록되므로 폭증 위험 제한적) | `app/src/shared/ipc.ts:567-589` · `adapters/claude-map.ts:244,430` |
| **스위치 전달 경로** — 디버그 패널 토글은 전용 채널이 아니라 `orca:debug:setMock` 의 `DebugMockState.wireLog` 필드. 핸들러는 `import.meta.env.DEV` 게이트(`misc.ts:310-318`)라 prod 에선 스위치 부재·콘솔 무출력 불변. 상태 비영속(재시작 OFF, IPC_CONTRACT 기록) | `app/src/main/app/handlers/misc.ts:310-318` · `app/src/shared/ipc.ts:170-176` · `docs/IPC_CONTRACT.md` §2.13 |
| **0123 콘솔 미러는 무조건** — dev 에서 `consoleMirror` 가 `writeRecord` 마다 항상 발화(`infra/log/index.ts:51`·`log-manager.ts:146-149`). 결정 ①(통합 게이트)에 따라 런타임 게이트 setter 로 전환 필요(파이프라인 불변, 0123 소폭 수정을 사용자 지시로 범위 편입) | `app/src/main/infra/log/index.ts:30-56` |
| 부팅 진단은 이미 구조화 — `BootReportStep{status,critical,durationMs,message}` 수집 + renderer 전달, 경고는 `console.warn('[boot] …')` 로만 콘솔 출력 | `app/src/main/app/boot-report.ts` (0077) |
| IPC 검증 실패가 무기록 — `handle()` 의 'reject'/fallback 경로 모두 로그 없음(무효 payload 가 조용히 사라짐) | `app/src/main/infra/ipc/handle.ts:30-37` |
| wire-log — dev 전용 콘솔 토글, `sendChatEvent` 가 이벤트마다 `wireLog(ev.type, ev)` 호출(아웃바운드 와이어의 기존 chokepoint). electron 비의존 설계(0068) | `app/src/main/infra/ipc/wire-log.ts` · `infra/ipc/send.ts` |
| 턴 이벤트 파이프라인 — `bus.emit('turn.event')` 단일 팬아웃, 구독 순서 usage→history→title→relay 를 `bootstrap.ts` 가 소유. 턴 셋업은 `app/chat-turn.ts` | `app/src/main/AGENTS.md` "단일 턴 이벤트 파이프라인" · `app/src/main/app/chat-turn.ts` |
| 비밀·원문 보호 — 비밀의 로그 노출 절대 금지(마스킹 의무). LLM 프롬프트/응답 원문도 같은 취지로 미기록 대상 | `docs/arch/backend/security.md:54` |
| 로그 문자열은 영어. 현재 main 에는 한국어 로그가 혼재("`[main] bootstrap 실패:`" 등) — 0121 후속 제안에서도 지적된 상충 | root `AGENTS.md` §6 · `app/src/main/index.ts:210` · `docs/handoff/0121-design-consistency-audit/plan.md` 후속 제안 |
| eslint flat config 에 `src/main/**` 블록이 이미 존재(boundaries) — `no-console` 규칙을 같은 블록에 추가 가능 | `app/eslint.config.mjs` |
| 에러 분류 계층 — `ErrorClassifier`/`makeClassifiedError` 가 턴 에러를 8 category 로 정규화(로그 error 레코드의 `code` 원천으로 재사용 가능) | `app/src/main/infra/errors.ts:20-61` |

## 이벤트 카탈로그 (prod `info` — "필수 동작·경계")

> 배선의 정본. 아래 + 모든 `warn`/`error` 가 prod 파일에 남는 전부다(그 외는 `debug` — dev 전용). scope = `child()` 인자.

| scope | 이벤트 (`<domain>.<operation>.<state>`) | 부가 데이터(메타만) |
|---|---|---|
| `app` | `app.start.completed` · `app.quit.started` | 버전·플랫폼(공통 필드로 충족) |
| `boot` | `boot.step.completed`(critical 실패 시 `boot.step.failed`=error) · `boot.sequence.completed` | step id·durationMs — `boot-report.ts` 기록 지점에 연동 |
| `db` | `db.migration.started/completed/failed` | fromVersion·toVersion·durationMs |
| `session` | `session.create.completed` · `session.resume.completed` | sessionId(내부 id)·provider |
| `chat` | `chat.turn.started/completed/failed` · `chat.turn.cancelled` | correlationId·durationMs·모델 별칭·inputTokens/outputTokens·finishReason — **프롬프트/응답/도구 입출력 원문 금지** |
| `engine` | `engine.spawn.started/completed/failed` · `engine.channel.teardown` | provider·이유 |
| `updater` | `update.check/download/install` 의 `started/completed/failed` | 현재/대상 버전 |
| `scheduler` | `scheduler.job.fired/failed` | job id·durationMs |
| `extensions` | `extensions.deploy.completed/failed` | 대상 표준·개수 |
| `settings` | `settings.patch.applied` | 변경 키 이름만(값 금지) |
| `ipc` | `ipc.payload.rejected`(warn) | channel·이유 요약 — `handle()`/`on()` 검증 실패 경로 |

## 인수 기준 (Acceptance Criteria)

1. **카탈로그 배선**: 위 표의 이벤트가 해당 코드 경로에 실제로 발화된다 — 각 행에 대해 `파일:라인` 근거를 구현 보고에 명시(대표 흐름: 부팅→턴 1회→종료의 dev 실행 JSONL 샘플 캡처 포함. **단 electron 실행이 불가한 제약 환경에서는 JSONL 샘플을 사람/CI 실기 대기로 분리 보고한다 — 0019/0102 선례**).
2. **console.* 전면 이관**: `app/src/main/**` 에서 `console.*` 직접 호출 0 (허용 예외: `infra/log/` 내부 emergency 경로 + dev 콘솔 미러 구현부). 기존 **35곳(20파일, 재실측)** 은 삭제(무가치)·`debug`(dev 진단)·카탈로그 이벤트(info/warn/error) 중 하나로 분류 이관하고, 이관 표(기존 → 처분)를 구현 보고에 첨부한다.
3. **기계 강제**: `app/eslint.config.mjs` 의 `src/main/**` 블록에 `no-console: error` 추가, 예외는 `infra/log/**` 한정 override. `npm run lint` 로 회귀 차단.
4. **correlationId 배선**: 턴 진입(`app/chat-turn.ts`)이 `runWithLogContext({correlationId})` 로 감싸져 한 턴에서 발생한 chat/engine/db 로그가 동일 correlationId 를 갖는다(JSONL 샘플로 증명).
5. **원문·델타 미기록**: chat *카탈로그* 이벤트 데이터에 프롬프트·응답·도구 입출력 원문이 포함되지 않는다(토큰 수·duration·finishReason 등 메타만). **스트리밍 델타 이벤트(`message.delta`·`message.reasoning.delta`)는 배선의 어느 경로(info 카탈로그·debug·wire 기록·콘솔 미러)에서도 기록하지 않는다 — 기존 콘솔 wireLog 출력도 예외가 아니다(사용자 결정 2026-07-18, 구현 전 검토 턴에서 "wire log 포함" 재확정)**. 배제는 델타 2종만이며 telemetry·subagent.task 는 유지한다(결정 ②). grep 근거 + 카탈로그 표와 1:1. *단 `ipc.wire.event` debug 레코드는 결정 ③의 dev 전용 예외(AC8)를 따른다.*
6. **IPC 검증 실패 가시화**: `handle()` 'reject'/fallback 및 log `on()` 폐기 경로에서 `ipc.payload.rejected`(warn, suppress 적용) 기록.
7. **boot-report 연동**: 부팅 스텝 완료/실패가 카탈로그 `boot.*` 로 파일에 남는다(기존 renderer 전달 동작 불변).
8. **wire-log 처분(개정 — 사용자 결정 ①③, 2026-07-18 구현 전 검토)**: `wireLog()` 의 `console.log` 직접 출력을 **제거**하고, 주입된 로거 sink 를 통한 `debug`(`ipc.wire.event`) 기록으로 대체한다 — 컴포지션 루트가 sink 를 주입해 electron 비의존·순수 vitest 성질을 보존한다(0068). 스위치 ON + 델타 2종(`message.delta`·`message.reasoning.delta`) 이 아닐 때만 발화(필터는 wire-log 내부). **레코드 data 는 payload 전체**(redaction·8KB 절단 통과) — dev 전용 debug 레벨 + 스위치 게이트라 prod 파일에는 절대 남지 않음을 근거로 원문 금지 정책의 dev 예외를 인정한다(결정 ③). `input.echo` 사이트(사용자 텍스트 80자)도 같은 예외에 포섭. 토글 off 기본값·비영속 불변. 이로써 wire-log 의 console 잔존이 0 이 되어 AC3 예외(`infra/log/**` 한정)와 정합한다.
9. **로그 영어화**: 이관되는 로그 문자열(이벤트·message)은 영어로 통일(root AGENTS.md §6). UI 카피는 무관.
10. **renderer 최소 배선**: renderer 는 boot 실패 표면화·전역 에러(0123 훅) 외 신규 info 배선 없음 — renderer 상세는 `debug` 레벨 원칙 확인(grep 근거).
11. **게이트/위생**: lint(no-console 포함)+typecheck+test 통과(제약 환경 베이스라인 분리 보고), 레이어 경계 위반 0, 신규 의존성 0, IPC 채널 변경 0 (**단 `DebugMockState` 필드 개명은 AC12 로 허용 — 채널 수 67 불변, IPC_CONTRACT §2.13 debug 표 동시 갱신**).
12. **로그 스위치(신설 — 사용자 결정 ①, 2026-07-18)**: 디버그 패널의 wire 스위치를 "로그" 스위치로 개편한다 — (a) `DebugMockState.wireLog` → `log` 필드 개명(+`DebugMockPatchSchema`·bootstrap 기본값 `false`·`useDebugMock`·`DebugPanel`), (b) i18n 라벨 `debug.wireLog` → `debug.log`(ko `로그` / en `Logs`), (c) **통합 게이트**: 핸들러(`misc.ts` DEV 블록 유지)가 스위치 변경 시 wire 기록 플래그(`setWireLog`)와 `infra/log` 의 **콘솔 미러 런타임 게이트**(신설 setter — `LogManager` 파이프라인 불변, 0123 소폭 수정을 사용자 지시로 범위 편입)를 동시 제어한다. ON = wire 이벤트(델타 제외) debug 기록 + 모든 로그 레코드 콘솔 미러 / OFF = wire 미기록 + 콘솔 침묵(파일 기록은 기존 정책 유지). **dev 기본값 OFF 에서는 콘솔이 침묵한다 — 0123 의 무조건 dev 미러를 대체하는 의도된 동작 변화.** prod 는 핸들러 부재 + 미러 미주입으로 무영향. 비영속(재시작 OFF) 불변.

## 범위 / 비범위

- **범위**: 위 인수 기준 — 카탈로그 확정·이관·강제·correlationId 턴 배선·wire-log 로거 흡수·**로그 스위치 통합 게이트(AC12, 콘솔 미러 게이트 setter 포함 — 사용자 지시로 편입)**.
- **비범위**: 로깅 인프라 자체 변경(0123 소관 — 결함 발견 시 파생 이슈로 회송. **예외: AC12 의 콘솔 미러 런타임 게이트 setter 1개는 사용자 지시로 본 건이 수행**) · renderer 상세 계측 · 로그 뷰어 UI · 원격 전송(OQ4) · **신규 설정 키/IPC 채널 추가**(로그 스위치는 기존 `orca:debug:setMock`·debugMock 구조 재사용 — 구 문구 "debug 모드 런타임 토글 UI 제외" 는 2026-07-18 사용자 지시로 supersede).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 전제: `0123-logging-system` 이 verify/PASS 로 완료되어 `getLogger()`/`runWithLogContext()`/`on()` 이 존재한다.
- 기존 모듈 재사용: `boot-report.ts` 기록 지점 · `bus` 턴 파이프라인 · `ErrorClassifier`(error 레코드 code) · `wire-log`.
- **신규 의존성: 없음**.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 사용자 노출 UI 는 디버그 패널 스위치 라벨 변경("Wire 메시지"→"로그")뿐 — dev 전용, 테마·a11y 는 기존 Toggle 컴포넌트 그대로.
- 스트리밍 델타(`message.delta`·`message.reasoning.delta`)·토큰 단위 이벤트는 **전 레벨·전 경로 미기록(사용자 결정)** — info 카탈로그는 물론 debug·wire 기록·콘솔 미러(구 콘솔 wireLog 출력 포함)도 제외(파일 폭증 방지, suppress 는 최후 방어).
- **로그 스위치 OFF(기본) 의 dev 콘솔 침묵**: 부팅~스위치 ON 이전의 레코드는 콘솔에 안 보인다(파일에는 정책대로 남음) — 결정 ① 의 의도된 트레이드오프. 부팅 진단이 필요하면 파일(JSONL) 또는 스위치 ON 후 재현.
- wire 기록은 debug 레벨이라 suppress(경고/에러 한정) 미적용 — 스위치 수동 제어 + 10MB×5 로테이션이 방어선.
- 턴 실패 시 `chat.turn.failed` 는 ClassifiedError 의 category/message 만 싣는다(원문 cause 는 serializeError 경유 — redaction 통과).
- shutdown 경로(`will-quit`)의 `app.quit.started` 는 flush 이전에 emit 되어야 한다(0123 AC9 순서와 정합).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| prod info 과다 → "배포 최소화" 위배 | 카탈로그 표가 화이트리스트 — 표 밖 info 추가는 verify 에서 FAIL 사유 |
| 62곳 일괄 이관 중 의미 손실(기존 메시지가 담던 맥락 누락) | 이관 표(AC2)로 1:1 추적 + verify 가 대조 |
| no-console 강제가 향후 임시 디버깅을 불편하게 함 | dev 는 로거 콘솔 미러(0123 AC10)가 대체 — 임시 print 는 `debug` 레벨로 |
| 단독 결정 금지 항목(Open Question) | 없음 — 본 건은 기확정 인프라의 소비 배선. 카탈로그 항목 추가/삭제 요구가 생기면 사용자에게 확인 |

- 되돌리기 어려운 결정: 이벤트 이름(외부 분석 스크립트가 의존하게 됨) — 카탈로그 표를 observability.md 에 승격해 SSOT 화.

## 영향 받는 파일

- 수정(대표): `app/eslint.config.mjs` · `app/src/main/index.ts` · `app/src/main/app/{bootstrap,chat-turn,boot-report,updater}.ts` · `app/src/main/app/handlers/*.ts` · `app/src/main/infra/ipc/{handle,send,wire-log}.ts` · `app/src/main/infra/log/{index,log-manager}.ts`(미러 게이트 setter) · `app/src/main/features/{scheduler,extensions,history,chat,…}/**`(console 이관 산개분) · **AC12 분**: `app/src/shared/{ipc,protocol}.ts`(DebugMockState 필드 개명) · `app/src/renderer/src/features/debug/{components/DebugPanel.tsx,hooks/useDebugMock.ts}` · `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` · `docs/IPC_CONTRACT.md`(§2.13 debug 표) · `docs/arch/backend/observability.md`(카탈로그 승격 + dev wire 예외)
- 정확한 전수는 이관 표(AC2)가 담는다.

## 참고 문서

- `docs/handoff/0123-logging-system/plan.md` (선행 — 스키마·정책 정본)
- `docs/arch/backend/observability.md` (0123 신설 — 본 건이 카탈로그 추가)
- `docs/arch/backend/security.md` §1.4 · root `AGENTS.md` §6(로그 영어)
- IPC 변경 없음 — `docs/IPC_CONTRACT.md` 는 불변 확인만

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (no-console 포함, 제약 환경 베이스라인 분리 보고).
- 신규 테스트 요구: 없음(배선 중심) — 단 `handle()` 검증 실패 로그 경로는 단위 테스트 추가.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(배포 최소화·경계 확인·에이전트 분석)를 출처로 인용했고, "배선"의 해석은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`)를 붙였다.
- [x] 인수 기준 — 번호·검증 방법(grep·JSONL 샘플·이관 표) 명시.
- [x] 의존 기술 — 0123 선행 전제·신규 의존성 0 명시.
- [x] 파생 UX — 스트리밍 폭증·shutdown 순서 엣지케이스를 펼쳤다.
- [x] 리스크 — info 과다·이관 손실·이벤트 이름 고착을 적었다. Open Question 해당 없음을 확인했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (Codex=기능 / Claude=비기능). 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).

## [구현자 기입] 구현 보고 (Claude, 2026-07-18)

### 설계 리뷰 (비판적 검토 턴 — 사용자 지시로 구현 전 수행)

- **동의**: 카탈로그 화이트리스트·correlationId 턴 배선·no-console 강제·0068 electron 비의존 보존 방침 모두 타당. 구현에서 그대로 따랐다.
- **이견→plan 개정 반영(상단 개정 이력 참조)**: ① AC8 "콘솔 wireLog 출력 불변" 이 신규 사용자 요구(델타를 wire log 포함 전 경로 배제)와 충돌 → 콘솔 출력 자체를 로거로 흡수(AC3 의 no-console 예외 범위 밖 문제도 동시 해소). ② console.* 62/30 은 0123 이전 stale 수치 → 재실측 35곳/20파일. ③ 델타 라인 레퍼런스 480/537 → 483/540. ④ 비범위(debug 런타임 토글 UI·0123 인프라 불변)와 AC12 신설의 충돌 → 사용자 지시로 범위 편입 명기.

### 놓친 잠재 문제 + 대응 (✅ 선조치)

- ✅ **getLogger 의 electron 의존**: `infra/log/index.ts` 가 electron 을 import 하므로 순수 vitest 대상 모듈(turn-coordinator·session-runtime·scheduler 등)이 직접 import 하면 테스트가 깨진다 → **electron-free 레지스트리 분리**(`infra/log/registry.ts` 신설, no-op 폴백·`setRootLogger`) — index.ts 는 initLog/closeLog 에서 채우고 비우며 re-export 로 기존 import 경로 무회귀(0068 wire-log 와 동일 패턴). 모듈 스코프 캡처 금지(initLog 이전 import 가 no-op 고정) 규칙을 주석으로 명문화.
- ✅ **extensions.deploy.failed 관측 지점**: `ExtensionDeploymentService.attempt()` 가 실패를 삼키고 onWarning 문자열로만 회귀 → 서비스 catch 에서 직접 `extensions.deploy.failed` warn 기록(구분 불가 문제 해소).
- ✅ **mock.test.ts 의 debugMock 필드**: `wireLog` → `log` 개명 동반 수정.

### 이관 표 (console.* 35곳/20파일 → 처분; 예외 잔존 = `infra/log/index.ts` 2곳)

| 기존 (파일:구라인) | 처분 → 이벤트(레벨) |
|---|---|
| `index.ts:254` bootstrap 실패 | `app.start.failed` (error) + flushLogSync |
| `bootstrap.ts:142` mcp 서버 skip | `mcp.server.skipped` (warn) |
| `bootstrap.ts:148` deploy onWarning | `extensions.deploy.warning` (warn) |
| `bootstrap.ts:177` recovery(is.dev) | `chat.recovery.settled` (debug — is.dev 가드 제거, debug 자체가 dev 전용) |
| `bootstrap.ts:198` scheduler 설정 실패 | `scheduler.settings.failed` (warn) |
| `bootstrap.ts:239/240` skill seed/prune | `extensions.skill.seeded`/`.pruned` (debug) |
| `bootstrap.ts:256/258` scaffold/static 생성 | `providers.scaffold.created`/`providers.static.created` (debug) |
| `bootstrap.ts:360` shutdown emit 실패 | `chat.turn-event.emit-failed` (warn, phase=shutdown) |
| `boot-report.ts:55` 비-critical 경고 | `boot.step.failed` (warn, degraded) — boot.* 배선에 흡수 |
| `handlers/engine.ts:26` deploy 검증 경고 | `extensions.deploy.warning` (warn) |
| `updater.ts:129` check 실패 | `update.check.failed` (warn) |
| `updater.ts:250` electron-updater 로드 실패 | `update.loader.failed` (warn) |
| `chat-turn.ts:127` providerKey 불일치 | `providers.key.mismatch` (warn) |
| `chat-turn.ts:166` env 미해결 | `config.env.unresolved` (warn) |
| `chat-turn.ts:193` emit 실패(격리) | `chat.turn-event.emit-failed` (warn) |
| `chat-turn.ts:592` 승인 sessionId 부재 | `chat.permission.session-missing` (warn) |
| `deployer.ts:163` dist 백업 실패 | `extensions.deploy.backup-failed` (warn) |
| `claude-user-skills-plugin.ts:64` 래퍼 실패 | `extensions.plugin.wrapper-failed` (warn) |
| `provider-settings.ts:121` settings 해석 실패 | `providers.settings.resolve-failed` (warn) |
| `provider-registry.ts:33/37` 파싱/형식 오류 | `providers.settings.parse-failed`/`.invalid` (warn) |
| `external-usage-service.ts:36` 기본 logger | `usage.external.warning` (warn, 주입 기본값 교체) |
| `turn-coordinator.ts:108` settle emit 실패 | `chat.turn-event.emit-failed` (warn, phase=settle) |
| `title-generation.ts:65` 제목 생성 실패 | `chat.title.generation-failed` (warn) |
| `session-runtime.ts:285` 유휴 채널 에러 | `engine.channel.error` (warn) |
| `bus/index.ts:57` 리스너 오류(격리) | `bus.listener.failed` (warn) |
| `orca-config.ts:9/19` 경고/로드 실패 | `config.orca.invalid`/`config.orca.load-failed` (warn) |
| `wire-log.ts:14` `[wire]` 덤프 | **제거** — 주입 sink 경유 `ipc.wire.event` (debug, AC8) |
| `claude-adapt.ts:153` steer gate hook 실패 | `engine.steer.flush-failed` (warn) |
| `claude-settings.ts:33` settings 파싱 실패 | `providers.settings.parse-failed` (warn) |
| `infra/log/index.ts:25/36` emergency·미러 | **예외 잔존** (AC2·AC3 허용, eslint override) |

### 카탈로그 발화 근거 (AC1 — 파일:라인)

`app.start.completed` `index.ts:258` · `app.quit.started` `index.ts:280`(closeLog 이전) · `boot.step.completed/failed` `boot-report.ts:116-118` · `boot.sequence.completed` `boot-report.ts:62` · `db.migration.started/completed/failed` `infra/db/migrate.ts:143,170,163` · `session.create.completed` `features/history/writer.ts:175`(isNewSession 한정) · `session.resume.completed` `app/chat-turn.ts:467` · `chat.turn.started/completed/cancelled/failed` `features/chat/turn-coordinator.ts:191,334,333·338,344·379` · `engine.spawn.started/completed/failed` `features/sessions/session-runtime.ts:177,185,182` · `engine.channel.teardown` `session-runtime.ts:308,319` · `update.check/download/install .started/…` `app/updater.ts:124,153,178`(+completed/failed 인접) · `scheduler.job.fired/failed` `features/scheduler/scheduler.ts:92,95` · `extensions.deploy.completed/failed` `app/bootstrap.ts:152`·`extension-deployment-service.ts`(catch) · `settings.patch.applied` `app/handlers/misc.ts:111`(키 이름만) · `ipc.payload.rejected` `infra/ipc/handle.ts:38`·`app/handlers/log.ts:15`. `update.install.completed` 는 quitAndInstall 재시작 특성상 새 버전의 `app.start.completed` 가 대신 증명(코드 주석 명기).

### 게이트 결과 (제약 환경 베이스라인 분리)

- `npm run typecheck` 3종 0 error ✅ · `npm run lint` 0 error ✅ (경고 1 = 0102 TanStack↔React Compiler 기존 수용, no-console 신규 위반 0)
- vitest 직접 실행(ABI 안 뒤집는 경로): **1002/1002 pass, 130/131 파일** — 실패 1파일 = `chat-turn.continuity.test.ts` **로드 실패**(electron 바이너리 egress 403 미설치, 0112 기록 동일 베이스라인·본 변경 무관). `npm rebuild better-sqlite3`(Node ABI 소스 컴파일)로 DB 스위트 포함 green. scripts `node --test` 25/25 ✅.
- 신규 테스트: `wire-log.test.ts`(5 — sink 주입·스위치·**델타 2종 배제**·telemetry/subagent 유지) · `handle.test.ts`(4 — reject/fallback `ipc.payload.rejected`·유효 통과·no-op 안전) · `log-manager.test.ts` +2(미러 게이트 기본 OFF·ON/OFF 왕복).
- **AC1 JSONL 샘플: 사람/CI 실기 대기** — electron 실행이 egress 403 으로 불가(plan 개정 단서·0019/0102 선례). 캡처 절차: `npm run dev` → 디버그 패널 "로그" ON → 턴 1회 → 종료 → `<userData(orca-dev)>/logs/application.jsonl` 확인.

### 블로커

없음. (AC1 샘플 캡처만 환경 제약으로 사람/CI 이관.)
