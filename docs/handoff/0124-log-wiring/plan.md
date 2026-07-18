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
| 추론 의도 | "진행하라"의 수신자가 Claude(검증 턴 수행자)이고 본 건은 기존 `console.*` 이관 중심의 비기능(리팩토링) 성격이므로, **0123 verify/PASS 직후 Claude 가 대기 없이 본 건의 impl→verify 를 직접 수행**하는 것으로 해석 | 추론 — `handoff/AGENTS.md` "비기능 = Claude 직접 구현" 규칙 부합 |
| 추론 의도 | "delta 제외" = 스트리밍 델타 이벤트(`message.delta`·`message.reasoning.delta`, `app/src/shared/ipc.ts:480,537`)를 info 카탈로그만이 아니라 **debug·wire-log 미러를 포함한 배선의 전 경로에서 미기록** | 추론 — "로그 최소화" 취지의 일관 적용 |
| 추론 의도 | "배선" = (a) prod 에 남길 이벤트 카탈로그를 확정하고 (b) 기존 `console.*` call site 를 로거로 이관하며 (c) 재발을 기계 강제(eslint)하는 작업 | 추론 — 0123 이 인프라만 다루므로 소비 지점 연결이 별도 필요 |
| 추론 의도 | "에이전트가 분석" 요구를 배선 규율로 번역: 이벤트 이름은 grep 가능한 고정 문자열(`<domain>.<operation>.<state>`), 자유 서술 메시지에 의존하지 않는다 | 추론 |

## Context (왜)

0123 이 로깅 인프라(LogManager·JSONL·redaction·장애 훅)를 만들지만, 인프라만으로는 파일이 비어 있다. main 전역의 `console.*` 62곳(30파일)은 파일에 남지 않고 이벤트 이름도 없어 검색·집계가 불가능하다. 본 핸드오프는 **prod 이벤트 카탈로그를 확정**하고, 기존 call site 를 로거로 이관하며, `no-console` lint 로 회귀를 차단한다. 완료되면 배포본의 JSONL 만으로 "어떤 버전에서, 어떤 흐름 중, 어디서, 무엇이 실패했나"를 에이전트가 재구성할 수 있다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `console.*` 분포 — 총 62곳/30파일. 밀집: `app/bootstrap.ts`(9) · `app/chat-turn.ts`(4) · `index.ts`(3) · `app/updater.ts`(2), 나머지는 features/infra 산개. prefix 관례 `[main]`·`[boot]`·`[recovery]`·`[scheduler]`·`[mcp]`·`[update]`·`[shutdown]` 등 | `grep -rn 'console\.' app/src/main` |
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

1. **카탈로그 배선**: 위 표의 이벤트가 해당 코드 경로에 실제로 발화된다 — 각 행에 대해 `파일:라인` 근거를 구현 보고에 명시(대표 흐름: 부팅→턴 1회→종료의 dev 실행 JSONL 샘플 캡처 포함).
2. **console.* 전면 이관**: `app/src/main/**` 에서 `console.*` 직접 호출 0 (허용 예외: `infra/log/` 내부 emergency 경로 + dev 콘솔 미러 구현부). 기존 62곳은 삭제(무가치)·`debug`(dev 진단)·카탈로그 이벤트(info/warn/error) 중 하나로 분류 이관하고, 이관 표(기존 → 처분)를 구현 보고에 첨부한다.
3. **기계 강제**: `app/eslint.config.mjs` 의 `src/main/**` 블록에 `no-console: error` 추가, 예외는 `infra/log/**` 한정 override. `npm run lint` 로 회귀 차단.
4. **correlationId 배선**: 턴 진입(`app/chat-turn.ts`)이 `runWithLogContext({correlationId})` 로 감싸져 한 턴에서 발생한 chat/engine/db 로그가 동일 correlationId 를 갖는다(JSONL 샘플로 증명).
5. **원문·델타 미기록**: chat 이벤트 데이터에 프롬프트·응답·도구 입출력 원문이 포함되지 않는다(토큰 수·duration·finishReason 등 메타만). **스트리밍 델타 이벤트(`message.delta`·`message.reasoning.delta`)는 배선의 어느 경로(info 카탈로그·debug·wire-log 미러)에서도 기록하지 않는다(사용자 결정 2026-07-18)**. grep 근거 + 카탈로그 표와 1:1.
6. **IPC 검증 실패 가시화**: `handle()` 'reject'/fallback 및 log `on()` 폐기 경로에서 `ipc.payload.rejected`(warn, suppress 적용) 기록.
7. **boot-report 연동**: 부팅 스텝 완료/실패가 카탈로그 `boot.*` 로 파일에 남는다(기존 renderer 전달 동작 불변).
8. **wire-log 처분(결정)**: `wireLog()` 는 dev 콘솔 도구로 유지하되, 활성 시 로거 `debug`(`ipc.wire.event`) 로도 미러한다 — 주입식으로 연결해 electron 비의존·순수 vitest 성질을 보존한다(0068). 토글 off 기본값 불변. **단 미러는 델타 이벤트(`message.delta`·`message.reasoning.delta`)를 제외한다(사용자 결정 — 기존 콘솔 wireLog 자체의 출력은 불변)**.
9. **로그 영어화**: 이관되는 로그 문자열(이벤트·message)은 영어로 통일(root AGENTS.md §6). UI 카피는 무관.
10. **renderer 최소 배선**: renderer 는 boot 실패 표면화·전역 에러(0123 훅) 외 신규 info 배선 없음 — renderer 상세는 `debug` 레벨 원칙 확인(grep 근거).
11. **게이트/위생**: lint(no-console 포함)+typecheck+test 통과(제약 환경 베이스라인 분리 보고), 레이어 경계 위반 0, 신규 의존성 0, IPC 채널 변경 0.

## 범위 / 비범위

- **범위**: 위 인수 기준 — 카탈로그 확정·이관·강제·correlationId 턴 배선·wire-log 미러.
- **비범위**: 로깅 인프라 자체 변경(0123 소관 — 결함 발견 시 파생 이슈로 회송) · renderer 상세 계측 · 로그 뷰어 UI · 원격 전송(OQ4) · debug 모드 런타임 토글 UI(설정 키 추가 포함 — 필요성이 확인되면 후속 핸드오프).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 전제: `0123-logging-system` 이 verify/PASS 로 완료되어 `getLogger()`/`runWithLogContext()`/`on()` 이 존재한다.
- 기존 모듈 재사용: `boot-report.ts` 기록 지점 · `bus` 턴 파이프라인 · `ErrorClassifier`(error 레코드 code) · `wire-log`.
- **신규 의존성: 없음**.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 사용자 노출 UI 없음. N/A (테마·a11y).
- 스트리밍 델타(`message.delta`·`message.reasoning.delta`)·토큰 단위 이벤트는 **전 레벨·전 경로 미기록(사용자 결정)** — info 카탈로그는 물론 debug·wire-log 미러도 제외(파일 폭증 방지, suppress 는 최후 방어).
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

- 수정(대표): `app/eslint.config.mjs` · `app/src/main/index.ts` · `app/src/main/app/{bootstrap,chat-turn,boot-report,updater}.ts` · `app/src/main/app/handlers/*.ts` · `app/src/main/infra/ipc/{handle,send,wire-log}.ts` · `app/src/main/features/{scheduler,extensions,history,chat,…}/**`(console 이관 산개분) · `docs/arch/backend/observability.md`(카탈로그 승격)
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
