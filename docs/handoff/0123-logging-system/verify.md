# Verify — 0123-logging-system

## 메타

| 항목 | 값 |
|---|---|
| slug | `0123-logging-system` |
| 검증자 | Claude Code |
| 일자 | 2026-07-18 |
| 대상 커밋 | `cefb1ec` |
| 라운드 | 1 |
| 상태 | PASS |

> 본 건은 사용자 지시("클로드가 모두 진행")로 Claude 가 구현까지 수행 — 구현자=검증자 동일 주체 라운드. 매트릭스는 커밋된 코드·테스트 출력만을 증거로 삼아 대조했다.

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 1 — one-way send 실패가 sender 에 안 보임(dev 콘솔 미러로 수용) | 타당 — 로깅 채널에 응답 왕복을 붙이는 것이 더 큰 왜곡 | 매트릭스 #7 에 폐기+warn 집계 증거로 반영 |
| 이견 2 — preload 발신도 `process:'renderer'` 일괄(위조 방지 우선, scope 로 구분) | 타당 — sender 기반으로 preload/renderer 를 신뢰 있게 가를 신호가 없음 | 스키마 계약과 모순 없음(`LogProcess` 에 `'preload'` 는 향후 확장 여지로 유지). observability.md §2 표와 일치 |
| 선조치 ✅ #1 zod record 의 `__proto__` own-key 소실 → raw 단계 검사 + pipe | 타당 — 파싱 후 검사는 실제로 구멍(테스트로 재현됨) | 매트릭스 #7 증거에 포함 |
| 선조치 ✅ #2 summary 합승(별도 타이머 없음) · #3 did-fail-load -3 제외 · #4 `pat` 오탐 분리 · #5 renderer 배치(`shared/logging.ts`) | 모두 구현 세부 경계 내 — 설계 의도 변경 없음 | 각각 #11·#8·#5·#7 증거에 포함. #5 는 설계 §8 문언("shared/api/ipc.ts 의 logApi")과 다르나 4-layer 경계·단일 진입점 원칙은 보존 — 설계 변경 아닌 배치 세부로 판정 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 공유 로그 계약 (`LogLevel`·`LogProcess`·`SerializedError`·`LogInput`·`LogRecord`·이벤트 패턴, 런타임 의존 0) | ✅ | `app/src/shared/logging.ts` — import 0(타입/상수만). `LOG_EVENT_PATTERN` 세그먼트 2~5 강제 |
| 2 | main LogManager 싱글턴 + facade + enrich 강제 부여 | ✅ | `infra/log/index.ts`(initLog/getLogger/closeLog — db 패턴) · `log-manager.ts:133-144`(enrich 가 입력의 공통 필드 무시·재부여) · `log-manager.test.ts` "공통 필드 강제 부여" 3케이스 |
| 3 | 로거 무예외 불변식 (emergency 1회성, 재귀 금지) | ✅ | `log-manager.ts:65-92`(emit try/catch + `internalErrorReported` 래치) · `log-manager.test.ts` "emit 무예외 불변식" 2케이스(transport throw·BigInt) · emergency 는 주입 콘솔 1줄(`infra/log/index.ts` `emergency()`) — 로거 미경유 |
| 4 | JSONL + 10MB×5 로테이션 + 재실행 연속 | ✅ | `file-transport.ts`(기본 10MB·5개, 시프트/삭제) · `file-transport.test.ts` 6케이스 — 로테이션 시프트·보관 상한 삭제·**재실행 크기 승계 후 연속 로테이션**·1줄=1레코드 |
| 5 | 중앙 redaction (key+값 패턴, 파일 직전 항상 통과, 토큰 미잔존 테스트) | ✅ | `redact.ts` + `log-manager.ts:71`(emit 경로 필수 통과) · `redact.test.ts` 7케이스 + `log-manager.test.ts` "redaction 통합"(파일 라인에 토큰 원문 부재 직접 단언) |
| 6 | `serializeError` (name/message/code/stack/cause≤3, IPC 용 `sanitizeCause` 병존) | ✅ | `serialize-error.ts`(주석으로 용도 구분, `infra/errors.ts` 무변경) · `serialize-error.test.ts` 5케이스. stack 은 파일 전용 — renderer 로 재전송 경로 없음(로그는 단방향 인제스트) |
| 7 | IPC 브리지 (preload 4메서드·32KB·zod strict·위조 거부·폐기+warn 집계) | ✅ | `preload/index.ts` `sendLog`(32KB 사전 검사, `ipcRenderer` 미노출) · `shared/protocol.ts` `LogInputSchema`(strict + raw 단계 data 트리 검사) · `app/handlers/log.ts`(크기→스키마 순 검증, 실패 폐기 + `ipc.payload.rejected` warn — suppressor 가 집계) · `protocol.log.test.ts` 7케이스(위조 5종 거부·`__proto__` 거부·깊이/길이/scope) |
| 8 | 전역 장애 수집 (가드 교체+flush·process-gone 2종·webContents 3종·renderer 전역 훅) | ✅ | `src/main/index.ts` — `app.unhandled.rejection`/`app.uncaught.exception`(+flushLogSync, SDK stdin 흡수 주석 보존)·`app.renderer.gone`(reason/exitCode/windowId)·`app.child-process.gone`·`window.webcontents.unresponsive`/`window.preload.failed`/`window.load.failed`(-3 제외) · renderer `shared/logging.ts` `registerGlobalErrorLogging()` ← `main.tsx` 부트 등록. **실제 크래시 재현은 사람 실기 대기(책임 분리)** |
| 9 | 종료 flush (will-quit: shutdown → closeLog → closeDb) | ✅ | `src/main/index.ts` will-quit 핸들러(순서 명시 주석) · fatal 경로 `flushLogSync()`(#8) · `FileTransport.close()` 가 잔여 버퍼 동기 flush(`file-transport.test.ts` "close() 가 잔여 버퍼를 flush") |
| 10 | dev/prod 정책 (dev=debug+콘솔 미러 / prod=info 파일만, DEV 인라인 가드 dead-code) | ✅ | `infra/log/index.ts`(`dev: import.meta.env.DEV`, `consoleMirror: import.meta.env.DEV ? … : undefined`) · `log-manager.test.ts` "레벨 정책" 2케이스. **prod 번들 실측(out/ 검사)은 빌드 불가 환경 — 사람/CI 대기**(0089 §1.7 동일 패턴 선례로 코드 판정) |
| 11 | 반복 억제 (fingerprint 60s, suppressedCount 집계) | ✅ | `suppress.ts` · `suppress.test.ts` 6케이스 + `log-manager.test.ts` "반복 억제 통합"(drop 후 창 만료 시 fingerprint/suppressedCount/windowMs 합승 단언) |
| 12 | sessionId(실행당 UUID) / correlationId(ALS 전파+자동 주입) | ✅ | `infra/log/index.ts`(`randomUUID()` 1회) · `log-context.ts` · `log-manager.test.ts`(컨텍스트 자동 주입·명시값 우선 2케이스) |
| 13 | 문서 동기화 (IPC_CONTRACT 66→67 log 도메인·observability.md 신설·인벤토리) | ✅ | `docs/IPC_CONTRACT.md`(헤더·§1 도메인 21/one-way 방향·§2 총계 67·§2.13-b 신설) · `docs/arch/backend/observability.md` · `docs/AGENTS.md` 인벤토리 2행(67·21 정정 + observability 행) |
| 14 | 게이트 + 레이어 경계 0 + 신규 의존성 0 | ✅ | 아래 "게이트 재실행" — lint 에러 0(boundaries 포함)·typecheck 3분할·vitest **991/991**·scripts 25/25. `package.json` diff 없음(의존성 0) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전체 green (아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 14/14 |
| 레이어 경계 위반 0 | ✅ | — | lint 에러 0 (`infra/log` 는 infra·shared 만 의존) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT·observability.md·AGENTS 인벤토리 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 패턴 없음 (docs/AGENTS.md 변경분은 채널 수·인벤토리 행) |
| electron 실행 실기 (JSONL 실파일 생성·renderer 강제 kill 기록·main 예외 flush·크래시 재현) | ✖ (egress 차단 — electron 바이너리 없음) | ✅ | **사람 실기 대기** — `npm run dev` 후 `<appData>/orca-dev/logs/application.jsonl` 확인 |
| prod 번들 dead-code (debug 경로·콘솔 미러 제거) | ✖ (build 불가 환경) | ✅ / CI | **사람·CI 대기** (windows CI 는 egress 정상) |
| 제품 의도 부합 / PR 머지 승인 | ✖ 보조 | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ | ✅ | 해당 없음 (0) |

## 게이트 재실행 결과

```
$ cd app && npm run lint          → 0 errors (1 warning = 기존 useTranscriptVirtualizer, 무관)
$ npm run typecheck               → node/web/test 3분할 모두 통과
$ ./node_modules/.bin/vitest run  → Test Files 129 passed / Tests 991 passed (991)
$ node --test scripts/*.test.mjs  → pass 25 / fail 0
```

better-sqlite3 를 Node ABI 로 소스 리빌드(`npm rebuild better-sqlite3`)하여 DB 로드 스위트 포함 전체 green (egress 차단 환경에서 electron ABI/빌드만 불가 — `app/AGENTS.md` ABI 가이드 절차 준수).

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴 스캔 결과: `docs/AGENTS.md` 변경 2행(IPC 채널 수 정정 + observability 인벤토리) — 해당 패턴 없음.
- 변동성/일회성/장문 코드설명서 혼입 여부: 없음 — 인벤토리 1행 요약만.

## PHASES.md 정합성

- 0123 행 승격(커밋 `cefb1ec`) — 본 검증 커밋에서 수행. INDEX `verify/PASS` 동시 갱신.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: `설계 §8` 의 renderer 소비 지점 지시가 코드 관례(fire-and-forget vs invoke 패스-스루)와 미세하게 어긋나 구현 턴에서 배치를 재결정했다 — 설계 시 preload/renderer 코드까지 확인했어야 함.
- 구현 단계: zod record 의 `__proto__` 소실은 구현 중 테스트가 잡았다 — 신뢰 경계 검증은 "파싱 전 raw" 원칙을 처음부터 설계에 명시했어야 함.
- 검증 단계: 구현자=검증자 동일 주체라 교차 검증 효과가 제한적. electron 실행 실기가 환경상 불가해 파일 실생성·크래시 경로의 최종 판정은 사람/CI 몫으로 남는다(책임 분리표 명시).

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 사용자 지시에 따라 대기 없이 `0124-log-wiring` impl 로 즉시 진행.
