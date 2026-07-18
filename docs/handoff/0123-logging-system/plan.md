# Plan — 0123-logging-system

## 메타

| 항목 | 값 |
|---|---|
| slug | `0123-logging-system` |
| 작성자 | Claude Code |
| 일자 | 2026-07-18 |
| 매핑 | PHASES "현재 작업 중" (보드 링크) — 짝 핸드오프 `0124-log-wiring` 의 선행 |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 로그 시스템을 만든다. **핵심은 구축 후 에이전트가 분석할 수 있어야 한다**. 개발/배포에 따라 정책을 다르게 한다 — 배포 정책은 로그 최소화, 단 **필수 동작·경계에서는 확실한 동작확인**이 가능해야 한다. 핸드오프는 2개로 구분: **구현(본 건) + 로그 배선(0124)** | 라이브 세션 요청 (2026-07-18) |
| 명시 요구 | 첨부한 "Electron 애플리케이션 로그 시스템 구현 가이드"에서 Orca 환경에 맞춰 취사선택하라("취할 것은 취하고 버릴 것은 버려라"). 논의되지 않은 것 중 구현이 필요하면 구현한다. 수석엔지니어의 실무 관점으로 검토 | 라이브 세션 요청 (2026-07-18) |
| 추론 의도 | "에이전트가 분석"= 로컬 JSONL 을 Claude Code/Codex 가 grep·jq 로 직접 읽는 시나리오 (원격 수집 서버가 아님 — PRD §11 OQ4 미결이므로 로컬 파일이 1차 소비 지점이라고 해석) | 추론 — PRD §11 OQ4 + 저장소가 에이전트 협업 워크스페이스라는 사실 |
| 추론 의도 | "필수 동작·경계" = 앱 생명주기·부팅·턴·마이그레이션·업데이트 같은 주요 작업 경계와 프로세스/IPC 신뢰 경계. 어떤 이벤트를 남길지의 확정은 0124(배선)의 카탈로그 소관 | 추론 |

## Context (왜)

Orca main 프로세스에는 로거가 없다 — `console.*` 62곳(30파일)이 `[tag]` prefix 관례로 흩어져 있고, 파일에 남는 것이 없어 배포본에서 장애가 나면 재현·분석 수단이 없다. 유일한 구조화 선례는 dev 전용 콘솔 토글 `wire-log` 뿐이다. 본 핸드오프는 **중앙집중 LogManager + JSONL 파일 + redaction + 장애 수집**의 인프라를 만든다. 기존 call site 이관과 이벤트 카탈로그 확정은 `0124-log-wiring` 이 잇는다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 로거 부재 — `console.log/warn/error` 62곳·30파일, `[main]`/`[boot]`/`[update]` 등 prefix 관례. `electron-log` 류 의존성 없음 | `grep -rn 'console\.' app/src/main` · `app/package.json` |
| dev 전용 콘솔 로그 토글 선례 — 모듈 스코프 플래그 + electron 비의존 분리(순수 vitest 가능) | `app/src/main/infra/ipc/wire-log.ts:7-15` (0025/0068) |
| 전역 미처리 예외 가드가 이미 존재 — SDK stdin write 에러를 흡수해 네이티브 에러창을 막는 **의도된 동작**(교체 시 보존 필수) | `app/src/main/index.ts:51-61` |
| 종료 정리 순서 — `will-quit` 에서 `routerRef?.shutdown()` → `closeDb()` (둘 다 동기) | `app/src/main/index.ts:229-234` |
| infra 모듈 싱글턴 패턴 — `initDb()/closeDb()` + module-scoped `connection`. 프로세스 전역 수명 인프라의 배치 선례 | `app/src/main/infra/db/index.ts:7-41` |
| dev userData 리다이렉트 — `import.meta.env.DEV` 면 부팅 전 `userData` 를 `orca-dev` 로. 하위 코드가 `getPath('userData')` 만 참조하면 **dev/prod 데이터가 자동 격리**되고 prod 번들에선 dead-code 제거 | `app/src/main/index.ts:14-21` · `infra/config/paths.ts` |
| `sanitizeCause` 는 Error → `{name, message}` 평탄화라 **stack/code/cause 체인이 소실** — 파일 로그용 직렬화는 별도 필요 | `app/src/main/infra/errors.ts:63-79` |
| invoke 검증 프리미티브 `handle(channel, schema, invalidPolicy, fn)` — zod safeParse 단일 경로. 단 **invoke 전용**이라 one-way send(`ipcMain.on`) 수신용 프리미티브는 없음 | `app/src/main/infra/ipc/handle.ts:24-46` |
| preload 패턴 — 도메인별 객체를 `orca` 로 묶어 `contextBridge.exposeInMainWorld`, `ipcRenderer` 원본 미노출 | `app/src/preload/index.ts:214-216, 241-250` |
| 채널 명명 `orca:<domain>:<action>`, `CHANNELS` 상수 SSOT + 카탈로그 총 66채널 | `app/src/shared/ipc.ts:79` · `docs/IPC_CONTRACT.md:23` |
| 보안 베이스라인 — 비밀의 "로그/에러 메시지 노출 **절대 금지** — 마스킹 의무" · dev/prod 분기는 `import.meta.env.DEV` 인라인 가드(§1.7 선례) | `docs/arch/backend/security.md:54, 101-103` |
| 신규 의존성은 사용자 승인 필수(TRD §2 스택 표 밖) — electron-log/pino 도입은 게이트 대상 | `app/AGENTS.md` "의존성 정책" |
| 텔레메트리/에러 리포팅 정책은 미결 Open Question — 원격 전송은 에이전트 단독 결정 금지 | `docs/PRD.md` §11 OQ4 |
| 로그 문자열은 영어(코드 식별자·로그 규약) | root `AGENTS.md` §6 |
| Electron 프로세스 장애 이벤트 — `app.on('render-process-gone')`(reason·exitCode)·`child-process-gone`, `webContents` `'unresponsive'`/`'preload-error'`/`'did-fail-load'` | https://www.electronjs.org/docs/latest/api/app · https://www.electronjs.org/docs/latest/api/web-contents |
| `AsyncLocalStorage` 로 비동기 실행 흐름에 요청별 ID 전파(공식 로깅 사례) | https://nodejs.org/api/async_context.html |

## 인수 기준 (Acceptance Criteria)

1. **공유 로그 계약**: `app/src/shared/logging.ts` 에 `LogLevel('error'|'warn'|'info'|'debug')` · `ProcessType('main'|'renderer'|'preload')` · `SerializedError{name,message,code?,stack?,cause?}` · `LogInput{level,event,scope,message?,correlationId?,data?,error?}` · `LogRecord = LogInput + {schemaVersion:1, timestamp, process, appVersion, sessionId, windowId?}` 가 정의된다. 이벤트 이름은 `<domain>.<operation>.<state>` 규칙(소문자·점 구분, 검증 가능한 패턴 상수 포함). 런타임 의존 0 (shared 레이어).
2. **main LogManager 싱글턴**: `app/src/main/infra/log/` 에 `initLog()/getLogger()/closeLog()` (db 싱글턴 패턴). `getLogger()` facade 는 `child(scope)` + `debug/info(event, data?)`·`warn(event, data?)`·`error(event, error?, data?)`. emit 파이프라인은 enrich(공통 필드 **main 이 강제 부여** — 호출자 값 무시) → redact → serialize → write.
3. **로거 무예외 불변식**: emit 내부의 어떤 실패(직렬화·redaction·fs)도 호출자에게 throw 되지 않는다. 내부 오류는 emergency 경로(콘솔 1줄, 최초 1회성/저빈도)로만 남기고 **로거가 로거를 재귀 호출하지 않는다**. 단위 테스트로 고정.
4. **JSONL 파일 + 로테이션**: `<userData>/logs/application.jsonl` 에 1줄 = 1 JSON 레코드. 파일 10MB 도달 시 `application.1.jsonl` … 로 시프트, 보관 5개 초과분 삭제. 앱 재실행 후에도 기존 파일에 이어쓰고 로테이션이 연속 동작한다. 로테이션 로직은 경로 주입식으로 tmp dir 단위 테스트.
5. **Redaction**: 파일 기록 직전 중앙 redactor 를 항상 통과. key 기반(`authorization/cookie/password/secret/token/accessToken/refreshToken/apiKey/credential/privateKey` 등, 대소문자 무시) + 값 패턴(`Bearer …`·JWT 형식·`-----BEGIN … PRIVATE KEY`·AWS AccessKey·`sk-` 류) 재귀 마스킹. "토큰/키를 넣은 로그가 파일에 원문으로 남지 않는다"를 단위 테스트로 증명.
6. **에러 직렬화**: `serializeError(unknown)` 이 `name/message/code/stack/cause`(cause 깊이 제한 ≤3)를 보존하는 `SerializedError` 를 만든다(기존 `sanitizeCause` 는 IPC 용으로 유지 — 용도 병기 주석). stack 은 파일 로그에만 남고 renderer 로 재전송되지 않는다.
7. **IPC 브리지 (renderer/preload → main)**: `CHANNELS.logEmit = 'orca:log:emit'` + `src/shared/protocol.ts` 의 `LogInputSchema`(level enum · event 패턴 · scope 길이 제한 · 문자열 필드 ≤8KB · 직렬화 payload ≤32KB · 객체 깊이/키 수 제한 · `__proto__`/`constructor`/`prototype` 키 거부). preload 는 `orca.log.{debug,info,warn,error}` 만 노출(fire-and-forget `ipcRenderer.send`, `ipcRenderer` 원본 미노출). main 수신부는 검증 실패 시 **폐기 + 집계 warn 1회성**. `timestamp/process/appVersion/sessionId/windowId` 는 sender 가 보낸 값이 있어도 main 이 덮어쓴다(위조 방지 — `event.sender.id` 로 windowId 부여).
8. **전역 장애 수집**: (a) `index.ts` 의 `uncaughtException`/`unhandledRejection` 가드를 로거 기반으로 교체 — 기존 "SDK stdin 에러 흡수, 네이티브 크래시 다이얼로그 방지" 동작을 보존하면서 `error` 레벨 기록 + 동기 flush. (b) `app.on('render-process-gone')`·`child-process-gone` 에서 reason·exitCode·windowId 기록. (c) `webContents` `'unresponsive'`·`'preload-error'`·`'did-fail-load'` 기록. (d) renderer 전역 `window.onerror`/`unhandledrejection` → `orca.log.error` 배선.
9. **종료 flush**: `will-quit` 에서 `closeLog()` 가 `closeDb()` 이전에 실행되어 버퍼가 유실되지 않는다(동기 flush). fatal 경로(8-a)에서도 동기 flush 보장.
10. **dev/prod 정책**: dev(`import.meta.env.DEV`) = `debug` 이상 파일 기록 + 콘솔 pretty 미러 / prod = `info` 이상 파일만·콘솔 미러 없음. dev 전용 경로는 인라인 가드로 prod 번들에서 dead-code 제거(security.md §1.7 선례).
11. **반복 억제**: fingerprint(`event + error.name + error.code`) 가 60초 창 내 반복되면 개별 기록 대신 `suppressedCount` 집계 레코드 1건. 단위 테스트 포함.
12. **sessionId / correlationId**: sessionId 는 앱 실행당 `crypto.randomUUID()` 1회. `infra/log/log-context.ts` 의 `AsyncLocalStorage` + `runWithLogContext()` 로 main 비동기 흐름에 correlationId 전파(enrich 가 스토어 값을 자동 주입). 본 핸드오프는 메커니즘까지 — 턴 단위 배선은 0124.
13. **문서 동기화**: `docs/IPC_CONTRACT.md` 에 log 도메인 신설(§6 변경 절차 — 채널 총계 66→67 실측 갱신) + `docs/arch/backend/observability.md` 신설(로그 스키마·레벨 정책·파일 위치·redaction 규칙 정본, `docs/AGENTS.md` 인벤토리 갱신).
14. **게이트/위생**: `cd app && npm run lint && npm run typecheck && npm test` 통과(제약 환경이면 lint+typecheck+순수 vitest, DB ABI 베이스라인 분리 보고). 레이어 경계 위반 0. **신규 의존성 0**.

## 범위 / 비범위

- **범위**: 위 인수 기준 전부 — 로깅 인프라(타입·LogManager·파일·redaction·IPC 브리지·장애 훅·정책·문서).
- **비범위**:
  - **원격 전송/텔레메트리** — PRD §11 OQ4 미결(단독 결정 금지). 로컬 파일이 종점. 아키텍처상 transport 를 뒤에서 추가할 수 있게만 유지.
  - **crashReporter(네이티브 덤프)·Support Bundle·audit 로그 분리** — Future. 에이전트가 로컬 JSONL 을 직접 읽는 구조라 우선순위 낮음(단일 사용자 로컬 도구).
  - **기존 `console.*` call site 이관·이벤트 카탈로그 확정·eslint no-console 강제·wire-log 처분** — `0124-log-wiring`.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- Node 내장: `fs`(append/rename/stat) · `node:async_hooks`(`AsyncLocalStorage`) · `crypto.randomUUID`. Electron: `app.getPath('userData')`·`app.getVersion()`·프로세스 장애 이벤트.
- 전제: dev userData 리다이렉트(`index.ts:19-21`)가 로그 디렉터리의 dev/prod 격리를 그대로 제공한다 → `app.setAppLogsPath()`/`getPath('logs')` 대신 **`<userData>/logs/`** 채택(DB `<userData>/orca.db` 선례와 동거, 백업·진단 시 한 폴더).
- **신규 의존성: 없음** (electron-log/pino 미도입 — JSONL·redaction·정책 제어는 어차피 자체 구현이 필요하고, 파일 append+로테이션은 소규모 코드로 충분. 도입하려면 사용자 승인이 필요한데 이득이 크지 않다).

## 설계

데이터 흐름:

```
renderer facade ─ orca.log.* (preload, ≤32KB) ─┐            ┌─ file-transport (JSONL + rotation)
                                               ├→ ipcMain.on('orca:log:emit')
main 코드 ─ getLogger().child(scope).* ────────┘   → zod 검증 → LogManager.emit
                                                     └ enrich → suppress → redact → serialize ─┤
                                                                                               └─ dev 콘솔 미러 (DEV 한정)
```

모듈 (전부 `app/src/main/infra/log/` — infra 는 infra·shared 만 의존, 상위 전 레이어가 소비 가능):

1. `log-manager.ts` — 싱글턴 수명(`initLog/getLogger/closeLog`) + facade(`child(scope)`) + emit 파이프라인. **electron 값(버전·경로)은 init 시 주입**해 나머지를 electron 비의존 순수 모듈로 유지(vitest node 테스트 가능 — `wire-log` 0068 선례).
2. `file-transport.ts` — append 버퍼(소량 배치) + `flushSync()`(fatal/종료용) + 크기 로테이션. 쓰기 실패 시 transport 를 비활성화하고 emergency 1줄만(앱 기능 무영향 — AC3/AC14).
3. `redact.ts` — key 집합 + 값 패턴 재귀 마스킹(`'[REDACTED]'`). 문자열 8KB 절단 포함.
4. `serialize-error.ts` — `serializeError()`(AC6). `infra/errors.ts` 는 수정하지 않고 병존(IPC 용 `sanitizeCause` vs 파일 로그용 — 주석으로 용도 구분).
5. `suppress.ts` — fingerprint 60s 창 집계(AC11).
6. `log-context.ts` — `AsyncLocalStorage<{correlationId}>` + `runWithLogContext()`(AC12).
7. IPC 수신 — `app/src/main/app/handlers/log.ts` 의 `registerLogHandlers()`. one-way send 수신이므로 기존 `handle()`(invoke 전용) 대신 **`infra/ipc/handle.ts` 에 `on(channel, schema, fn)` 프리미티브를 추가**(safeParse + 실패 폐기 — invoke 등록부와 대칭).
8. preload — `app/src/preload/index.ts` 의 `orca` 객체에 `log` 도메인 추가(payload 크기 사전 검사 후 send). renderer 는 `src/renderer/src/shared/api/ipc.ts` 에 `logApi` + 얇은 scope-단위 facade(`shared/` 배치, 도메인 로직 없음).
9. 배선 — `index.ts` 모듈 스코프에서 `initLog()`(userData 리다이렉트 직후·전역 가드 교체), `will-quit` 에 `closeLog()`(AC9), 장애 이벤트 훅(AC8)은 `createWindow`/`whenReady` 의 해당 지점.

재사용: `db/index.ts` 싱글턴 패턴 · `handle.ts` 검증 대칭 · `CHANNELS`/`protocol.ts` 계약 3분할 · security.md §1.7 DEV 인라인 가드 · preload `orca` 노출 관례.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 사용자 노출 UI 없음(설정 화면·뷰어는 비범위). 테마·a11y N/A.
- 디스크 부족/로그 디렉터리 권한 오류 → transport 자체 비활성화, 앱 기능은 정상(AC3·AC14 게이트).
- renderer 폭주(초당 대량 emit) → suppress(AC11) + payload 상한(AC7)으로 상한. UI 스레드는 fire-and-forget 이라 무영향.
- 다중 창 → `event.sender.id` 기반 windowId 로 구분(AC7).
- dev HMR/재시작 → 실행마다 새 sessionId(실행 단위 식별이 목적이므로 정상).
- 앱 크래시 직전 로그 → fatal 경로 동기 flush(AC9)로 최근 버퍼 보존.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 동기 append 는 단순·크래시 내구적이나 main 블로킹, 완전 비동기는 유실 위험 | **버퍼 배치 + fatal/종료 동기 flush** 절충(AC9). 저볼륨(정책상 info 이상) 전제라 배치 간격은 작게(구현 재량, ≤1s) |
| redaction 누락(새 비밀 형태) | 중앙 단일 경로 강제(AC5) + 값 패턴 병행. 잔여 위험은 0124 에서 "프롬프트/응답 원문 미기록" 카탈로그 규칙로 이중 방어 |
| `orca:log:emit` 이 첫 one-way(send) 수신 채널 — 기존 invoke 관례와 상이 | `on()` 프리미티브를 `handle.ts` 에 대칭 추가 + IPC_CONTRACT 에 send 방향 명기(AC13) |
| 로그 파일이 사용자 디스크에 누적 | 10MB×5 상한(≤50MB) + 로테이션 삭제(AC4) |
| **단독 결정 금지 항목(Open Question)** → 사용자에게: 원격 전송/텔레메트리(PRD §11 OQ4)는 본 설계에서 배제 — 재개하려면 사용자 결정 필요 | 비범위 명기 |

- 되돌리기 어려운 결정: `LogRecord` 스키마(`schemaVersion: 1` 필드로 향후 변경 여지 확보) · 로그 위치 `<userData>/logs/`.

## 영향 받는 파일

- 신규: `app/src/shared/logging.ts` · `app/src/main/infra/log/{log-manager,file-transport,redact,serialize-error,suppress,log-context}.ts`(+`*.test.ts`) · `app/src/main/app/handlers/log.ts` · `docs/arch/backend/observability.md`
- 수정: `app/src/shared/ipc.ts`(CHANNELS) · `app/src/shared/protocol.ts`(LogInputSchema) · `app/src/main/infra/ipc/handle.ts`(`on()` 추가) · `app/src/main/index.ts`(init/가드 교체/장애 훅/closeLog) · `app/src/main/app/bootstrap.ts`(핸들러 등록) · `app/src/preload/index.ts`(+`index.d.ts`) · `app/src/renderer/src/shared/api/ipc.ts` · `docs/IPC_CONTRACT.md` · `docs/AGENTS.md`(인벤토리)

## 참고 문서

- `docs/arch/backend/security.md` §1.4(마스킹 의무)·§1.7(DEV 인라인 가드)
- `docs/IPC_CONTRACT.md` §1 명명·§6 변경 절차 — **반드시 동시 갱신**
- `app/src/main/AGENTS.md` (레이어 DAG — infra 배치)
- `docs/PRD.md` §11 OQ4(텔레메트리 — 비범위 근거)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (제약 환경은 lint+typecheck+순수 vitest, DB ABI 실패 베이스라인 분리 보고 — `app/AGENTS.md` ABI 가이드).
- 신규 테스트 요구: redact · serialize-error · suppress · rotation(경로 주입) · `LogInputSchema`(zod) · emit 무예외 불변식.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 출처(라이브 세션 요청)로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`·웹 URL)를 붙였다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다.
- [x] 의존 기술 — 의존·전제를 식별했고, 신규 의존성 0 을 명시했다(electron-log 미도입 결정 근거 포함).
- [x] 파생 UX — 디스크 부족·폭주·다중 창·HMR·크래시 flush 엣지케이스를 펼쳤다.
- [x] 리스크 — 트레이드오프·되돌리기 어려운 결정을 적고, Open Question(OQ4 원격 전송)은 사용자로 분리했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (Codex=기능 / Claude=비기능). 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).
