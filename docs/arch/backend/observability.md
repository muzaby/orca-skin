# Observability — 로깅 정본 (0123/0124)

> Orca 의 구조화 로깅 시스템 SSOT. 코드 정본: `app/src/shared/logging.ts`(계약) · `app/src/main/infra/log/`(구현) · `app/src/main/app/handlers/log.ts`(인제스트). IPC 채널은 [IPC_CONTRACT.md §2.13-b](../../IPC_CONTRACT.md), 보안 근거(마스킹 의무·DEV 가드)는 [security.md](security.md) §1.4/§1.7. 설계 이력: `docs/handoff/0123-logging-system/` · `0124-log-wiring/`.

## 1. 목표와 원칙

1. **에이전트 분석 가능** — 로그는 JSONL(1줄=1 JSON)로, 고정 이벤트명(`<domain>.<operation>.<state>`) 기준 grep/jq 만으로 "어떤 버전에서, 어떤 흐름 중, 어디서, 무엇이 실패했나"를 재구성할 수 있어야 한다.
2. **중앙집중** — 파일 소유자는 main 프로세스 하나. renderer/preload 는 제한된 IPC(`orca:log:emit`)로 `LogInput` 만 보내고, 공통 필드는 main 이 강제 부여한다(출처·버전 위조 방지).
3. **로거 장애 ≠ 앱 장애** — emit 은 절대 throw 하지 않는다. 내부 실패는 emergency 콘솔 1줄(1회성)로만 보고하고, 로거가 로거를 재귀 호출하지 않는다. 쓰기 실패 시 transport 는 스스로 비활성화된다.
4. **배포 최소화, 경계는 확실히** — prod 는 `info` 이상만 파일 기록(카탈로그 화이트리스트 — §5), dev 는 `debug` 까지 파일 기록 + **콘솔 미러는 디버그 패널 "로그" 스위치 ON 일 때만**(0124 통합 게이트 — 기본 OFF 는 콘솔 침묵). dev 전용 경로는 `import.meta.env.DEV` 인라인 가드로 prod 번들에서 제거된다.

## 2. 레코드 스키마 (`LogRecord`, schemaVersion 1)

| 필드 | 부여 주체 | 설명 |
|---|---|---|
| `schemaVersion` | main | 고정 `1` — 형식 변경 대비 |
| `timestamp` | main | UTC ISO 8601 |
| `level` | 호출자 | `error` · `warn` · `info` · `debug` |
| `event` | 호출자 | `<domain>.<operation>.<state>` — 소문자 세그먼트 2~5개(`LOG_EVENT_PATTERN`) |
| `scope` | 호출자 | 발생 모듈 (`child(scope)` 로 점 연결 — 예: `main.updater`) |
| `message` | 호출자(선택) | 사람용 부연 — 검색은 event 로 한다 |
| `process` | main | `main` · `renderer` · `preload` |
| `appVersion` / `sessionId` | main | 앱 버전 / 실행 단위 UUID(부팅마다 재발급) |
| `windowId` | main | renderer 발신 시 실제 sender 의 webContents id |
| `correlationId` | 호출자 or main | 작업 흐름 단위 — 미지정 시 `AsyncLocalStorage` 컨텍스트에서 자동 주입 |
| `error` | 호출자 | `SerializedError{name,message,code?,stack?,cause?}` (cause 깊이 ≤3) |
| `data` | 호출자 | 이벤트별 메타 — **원문(프롬프트/응답/도구 입출력) 금지, 수치·식별자만** |

## 3. 파이프라인과 파일

```
renderer/preload ─ orca.log.* (≤32KB) ─┐
                                       ├→ zod(LogInputSchema) → LogManager.emit
main ─ getLogger().child(scope).* ─────┘     enrich → suppress → redact → JSONL
                                                                    └→ dev 콘솔 미러(로그 스위치 게이트, 0124)
파일: ~/.config/orca/logs/application.jsonl (홈 디렉토리 고정 — dev/prod 공통, 격리 없음)
로테이션: 10MB × 5개(base + .1~.4) — 초과 시 오래된 것부터 삭제, 재실행 후에도 연속
종료: will-quit 에서 closeLog()(flush) → closeDb() · fatal 경로는 flushLogSync() 즉시
```

- **반복 억제**: warn/error 는 fingerprint(`event|error.name|error.code`) 60초 창으로 첫 건만 기록, 창 만료 시 `suppressedCount` 집계 레코드.
- **Redaction**(파일 기록 직전 필수 통과): 민감 키(authorization/cookie/password/secret/token/apiKey/credential/privateKey/pat/auth/key …) + 값 패턴(Bearer/Basic/JWT/PEM/AWS AKIA/`sk-`/GitHub PAT/Slack) 재귀 마스킹 → `[REDACTED]`. 문자열 8KB 절단.

## 4. 신뢰 경계 (renderer 인제스트)

`orca:log:emit` 은 유일한 R→M one-way send 채널. main 은 `LogInputSchema`(strict) 로 level enum·event 패턴·scope 형식·문자열 8KB·payload 32KB·깊이 6/키 64/배열 128·`__proto__` 류 키를 검증하고, 실패는 폐기 + `ipc.payload.rejected` warn 집계. 공통 필드를 실어 보내면 strict 위반으로 거부된다. preload 는 `orca.log.{debug,info,warn,error}` 4메서드만 노출한다(`ipcRenderer` 원본 미노출).

## 5. 이벤트 카탈로그 (prod `info` 화이트리스트)

정본은 [`docs/handoff/0124-log-wiring/plan.md`](../../handoff/0124-log-wiring/plan.md) "이벤트 카탈로그" — 0124 완료 시 본 절로 승격한다. 원칙:

- prod 파일에 남는 것 = 카탈로그 `info` + 모든 `warn`/`error`. 그 외는 `debug`(dev 전용).
- 앱 생명주기·부팅 스텝·DB 마이그레이션·세션 생성/재개·chat 턴 시작/완료/실패(메타만)·엔진 spawn·업데이터·스케줄러·확장 배포·설정 변경(키 이름만)·IPC 검증 실패.
- **금지**: 프롬프트/응답/도구 입출력 원문 · 스트리밍 델타(`message.delta`·`message.reasoning.delta` — **전 레벨·전 경로**, 구 콘솔 wire 덤프 포함, 사용자 결정 2026-07-18) · 함수 진입/종료 · 렌더링 상태 변경 · 비밀(마스킹 의무).
- **dev 전용 예외(사용자 결정 2026-07-18)**: 디버그 패널 "로그" 스위치 ON 일 때만 발화하는 `ipc.wire.event` debug 레코드는 outbound `NormalizedEvent` payload 전체(redaction·8KB 절단 통과)를 실을 수 있다 — debug 레벨 + 스위치 게이트 + prod 핸들러 부재의 3중 방어로 prod 파일에는 절대 남지 않는다. 델타 2종은 이 예외에서도 제외.
- 로그 문자열은 영어(root AGENTS.md §6).

## 6. 비범위 / Future

- **원격 전송/텔레메트리** — PRD §11 OQ4 미결(옵트인 정책 사용자 결정 대기). 로컬 파일이 종점.
- **crashReporter(네이티브 덤프) · Support Bundle · audit 로그 분리** — Future(0123 plan 비범위 참조).
- ~~debug 모드 런타임 토글 UI~~ — **0124 범위 편입(사용자 지시 2026-07-18)**: 디버그 패널 "로그" 스위치(기존 `orca:debug:setMock` 재사용, dev 전용)가 wire 이벤트 debug 기록 + 콘솔 미러를 통합 게이트한다. 신규 설정 키/채널 추가는 여전히 비범위.
