# Verify — 0124-log-wiring

## 메타

| 항목 | 값 |
|---|---|
| slug | `0124-log-wiring` |
| 검증자 | Claude Code |
| 일자 | 2026-07-18 |
| 대상 커밋 | `2f56498` (plan 개정 `7b174d2` 포함, 브랜치 `claude/handoff-124-review-r454o3`) |
| 라운드 | 1 |
| 상태 | **PASS*** (기계 검증 전 항목 충족 — AC1 JSONL 샘플·AC12 스위치 실기만 electron 제약으로 사람/CI 대기, 0019/0102 선례) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> 본 건은 비기능(Claude 전담) — 설계·구현·검증 동일 주체. 구현 전 **수석 엔지니어 비판적 검토 턴**(사용자 지시)이 사실상의 구현자 설계 리뷰 역할을 했고, 발견 전부를 plan 개정(`7b174d2`)으로 선반영했다.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| AC8 콘솔 불변 ↔ 신규 요구 충돌·AC3 예외 범위 모순 | 타당 | plan AC5/AC8 개정 — wireLog 콘솔 제거·로거 흡수로 동시 해소 (`wire-log.ts` console 잔존 0) |
| console.* 62/30 stale → 35/20 재실측 | 타당 | AC2 기준 재산정 + 이관 표 35곳 전수 (plan 구현 보고) |
| ✅ 선조치: getLogger electron 의존 → `infra/log/registry.ts` 분리 | 타당 — 0068 wire-log 선례와 동형, 0123 파이프라인 불변 | 순수 vitest 스위트(turn-coordinator·session-runtime 등) 무회귀로 확인 (1002 pass) |
| ✅ 선조치: `extensions.deploy.failed` 를 서비스 catch 에서 직접 기록 | 타당 (onWarning 문자열로는 실패/경고 구분 불가) | `extension-deployment-service.ts` catch — 카탈로그 행 충족 |
| ⚠️ 없음 (Open Question 해당 없음 — 사용자 결정 3건은 AskUserQuestion 으로 기확정) | — | — |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 카탈로그 배선 (+JSONL 샘플) | ✅* | 전 행 `파일:라인` = plan 구현 보고 "카탈로그 발화 근거". **JSONL 샘플만 사람/CI 대기**(electron egress 403 — plan 개정 단서 발동, 캡처 절차 명기) |
| 2 | console.* 전면 이관 (35곳/20파일) | ✅ | `grep -rn 'console\.' app/src/main --include='*.ts'`(비-test) 잔존 = `infra/log/index.ts:25,36`(예외) + 주석 2건뿐. 이관 표 1:1 (plan 구현 보고) |
| 3 | no-console 기계 강제 | ✅ | `eslint.config.mjs` main/shared 블록 `'no-console': 'error'` + `src/main/infra/log/**` override 한정. `npm run lint` 0 error |
| 4 | correlationId 턴 배선 | ✅ | `app/chat-turn.ts:766-768` `handlePlain(chatSend, …runWithLogContext({correlationId: randomUUID()}, …))` — AsyncLocalStorage 전파는 0123 `log-manager.test.ts` "correlationId 자동 주입" 케이스가 보증. 실 JSONL 대조는 #1 샘플에 합류 |
| 5 | 원문·델타 미기록 (전 경로) | ✅ | 유일 로그 chokepoint `wire-log.ts:11` `EXCLUDED_WIRE_LABELS` = 델타 2종, `wire-log.test.ts` "excludes streaming delta events on every path" green. grep: 델타 참조는 이벤트 방출(adapters)·소비 앵커(coordinator)뿐 — 로그 경로 0. 콘솔 wireLog 덤프 자체 제거(사용자 재확정). wire 레코드 payload 전체는 결정 ③ dev 예외(redaction·8KB 절단 통과 — `LogManager.emit` 파이프라인 불변) |
| 6 | IPC 검증 실패 가시화 | ✅ | `infra/ipc/handle.ts:33-41` reject/fallback 양 정책 `ipc.payload.rejected` warn + 신규 `handle.test.ts` 4/4. log `on()` 폐기 경로는 0123 `handlers/log.ts:15` 기존 배선 확인 |
| 7 | boot-report 연동 | ✅ | `boot-report.ts:110-118`(step ok=info/critical=error/degraded=warn) + `:62`(sequence). renderer 전달(BootReport 구조) 무변경 — `getReport()` 시그니처 불변 |
| 8 | wire-log 처분 (개정) | ✅ | `wire-log.ts` console 0·sink 주입식(`setWireSink`)·전용 테스트 5/5. sink 는 `misc.ts` DEV 블록에서만 주입(`:319-323`) → prod dead-code + debug 레벨 prod 드랍 + 스위치 기본 OFF 3중 방어. `input.echo`(`turn-coordinator.ts:233`)·`sendChatEvent`(`send.ts:22`) 호출부 불변 |
| 9 | 로그 영어화 | ✅ | 이관 로그 전부 영어 event+data (`grep` 한국어 로그 문자열 잔존 0 — UI 카피·주석은 무관) |
| 10 | renderer 최소 배선 | ✅ | renderer 신규 info 배선 0 — 변경은 DebugPanel 라벨/필드·i18n 뿐. `rendererLog` 소비처 불변(전역 에러 훅만) |
| 11 | 게이트/위생 | ✅ | 아래 게이트 절. 레이어 경계 0(boundaries green — registry 는 infra 내부·상향 import 없음), 신규 의존성 0, IPC 채널 67 불변(`DebugMockState` 필드 개명은 AC12 허용 + IPC_CONTRACT §2.13 갱신) |
| 12 | 로그 스위치 (신설) | ✅* | (a) `ipc.ts:170-176`·`protocol.ts` `log` 개명 (b) i18n `debug.log` ko `로그`/en `Logs` (c) `misc.ts:324-334` `applyLogSwitch` = `setWireLog`+`setConsoleMirror` 동시 호출, DEV 블록 유지·기본 OFF·비영속 불변. 미러 게이트 `log-manager.ts:68-70,155` + 테스트 2/2(기본 OFF·왕복). **패널 실기(토글→콘솔 출력)는 사람 확인 대기** |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 아래 절 — green(베이스라인 분리) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 12/12 (2건 * 실기 유보) |
| 레이어 경계 위반 0 | ✅ | — | boundaries+no-cycle 0 error |
| 문서 형식/링크/한국어 | ✅ | — | plan/observability/IPC_CONTRACT 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사용자 결정 3건(AskUserQuestion) 기반 — 부합 |
| Open Questions | ✖ | ✅ | 해당 없음 |
| UI/UX 시각 검증 | ✖ | ✅ | **대기**: 디버그 패널 "로그" 토글 실기(콘솔 미러 ON/OFF·`ipc.wire.event` 기록·델타 미출력) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 0 — 해당 없음 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck   # node/web/test 3종 — 0 error
$ npm run lint                  # 0 error, 1 warning(0102 TanStack 기존 수용) — no-console 위반 0
$ ./node_modules/.bin/vitest run
  Test Files  1 failed | 130 passed (131)
  Tests       1002 passed (1002)
  # 실패 1파일 = chat-turn.continuity.test.ts 로드 실패(electron 바이너리 egress 403,
  # 0112 기록과 동일한 환경 베이스라인 — 실행된 테스트 실패 0, 변경 무관)
$ node --test scripts/*.test.mjs  # 25/25 pass
```

- `npm test`(pretest ABI flip) 대신 vitest 직접 실행 — app/AGENTS.md 제약 환경 가이드 준수. DB 로드 스위트는 `npm rebuild better-sqlite3`(Node ABI 소스 컴파일) 후 green.

## 위생 검토

- 키/토큰/이메일/IP 패턴: 변경 파일 스캔 결과 없음. 로그 data 는 메타(이름·개수·duration·category)만 — 값 기록은 `settings.patch.applied` 포함 전무.
- wire 레코드 payload 전체(dev 예외)는 redact 파이프라인(파일 기록 직전 필수 통과)을 그대로 지난다 — 비밀 마스킹 유지.

## PHASES.md 정합성

- `docs/PHASES.md` "현재 작업 중" → 0124 행 승격(본 커밋에서 반영). 0025 등 과거 행의 wireLog 서술은 이력이므로 불변.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 최초 plan 이 0123 구현 *이전* 측정치(62/30)와 델타 라인 번호를 검증 없이 실었고, AC3↔AC8 의 eslint 예외 모순을 놓쳤다 — 구현 전 비판적 검토(사용자 지시)가 없었으면 구현 중 발견됐을 것. 선행 핸드오프 완료 후 **수치 재실측을 plan 갱신 절차에 포함**해야 한다.
- 구현 단계: `engine.spawn.started/completed` 가 동기 호출 전후라 정보량이 얇다(실 spawn 완료는 SDK 내부) — 유의미한 완료 신호가 필요해지면 session.updated 연동으로 후속 개선.
- 검증 단계: 이번 verify 는 electron 실기(JSONL 샘플·스위치 토글·콘솔 미러 육안)를 못 본다 — 사람/CI 몫으로 명시 분리했다. dev 기본 콘솔 침묵(결정 ①)의 개발 경험 회귀 여부도 실사용 피드백 대상.

## 결론 / 다음 단계

- 상태: **PASS*** — 기계 검증 전 항목 충족. PHASES 승격 + INDEX 갱신.
- 사람 확인 대기: ① `npm run dev` 실기 — 디버그 패널 "로그" ON → 콘솔 미러+`ipc.wire.event` 기록·델타 미기록·OFF 시 콘솔 침묵, ② 부팅→턴→종료 JSONL 샘플 확인(`<userData(orca-dev)>/logs/application.jsonl`), ③ PR 머지.
