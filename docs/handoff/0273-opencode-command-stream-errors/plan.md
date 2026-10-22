# Plan — 0273-opencode-command-stream-errors

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-21 |
| 상태 / 라운드 | IMPL_DONE / r1 |
| V mode / 기준 V / 유효 V | Baseline V / none / V1 |
| 브랜치 | codex-harness-entry-menu |

# Part I — Product & UX Contract

## 1. Context / 목표

수정한다. OpenCode `/스킬` 전송의 준비 시간이 메뉴 조회 제한 때문에 실패하는 경로를 분리하고, SSE 실패의 안전한 단계·원인을 표시한다.
사용자 환경 전체의 원인이 확정됐다고 보고하지 않는다. 실패한 전송을 자동 재제출하지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 보고 | timeout 1회 → 재시도 backend 연결 오류 → “OpenCode 이벤트 스트림 연결 실패” | 현재 사용자 턴 |
| 명시 조건 | 처음 입력은 `/스킬 명령` | 사용자 답변 |
| 명시 조건 | 다른 환경, CLI 1.17.19, Orca 실행 직후 첫 대화, 별도 세션 없음 | 사용자 답변 |
| 추론 의도 | 원인 조사와 해당 실패 경로 복구 | 증상 보고 후 진행 중인 진단·수정 |

## 3. Decision Ledger

| ID | 결정 | 출처 / 이유 | 상태 |
|---|---|---|---|
| D-01 | 메뉴용 명령 조회는 2.5초, 실행 전 권위 조회는 30초와 호출자 취소를 사용 | 실행의 MCP 준비가 메뉴 응답 예산보다 길 수 있음. 구현 판단 | ACTIVE |
| D-02 | 명령 조회가 성공하기 전에는 prompt 수락 상태를 열거나 모델 요청을 보내지 않음 | 중복 전송·불필요한 abort 방지 | ACTIVE |
| D-03 | SSE의 HTTP 상태·timeout·무응답 종료·일반 전송 실패를 고정 문장으로 구분 | SDK가 오류를 callback 후 generator 종료로 바꾸는 실제 구현 | ACTIVE |
| D-04 | 자동 prompt 재시도·CLI 업그레이드·서버 공유 정책 변경은 하지 않음 | 원인 미확정과 제출 중복 방지 | ACTIVE |
| D-05 | 사용자 버전과 로컬 재현을 구분하고 실제 1.17.19 호환 조사를 기록 | 사용자 조건 보존 | ACTIVE |

갱신 메모: 이전 nav 색상 유지 결정과 충돌 없음. ACTIVE 결정 ↔ AC 대조: D01→AC1·2, D02→AC2, D03→AC3·4, D04→AC2·4, D05→AC6, 충돌 0.

## 4. 요구 비판적 검토

| 판정 | 근거 |
|---|---|
| 다중 세션 포화로 원인 확정 불가 | 사용자 환경은 첫 대화. 앞선 연결 포화 실험은 별도 조건 |
| 짧은 명령 조회 제한은 코드상 확인 | `channel.ts:162`가 `native-resources.ts:15`의 2.5초 기본값 사용 |
| 1.17.19에도 MCP 의존 명령 목록 존재 | tag `dc927a7ff071741537cb0bdac7e09b5667ed568d`, `command/index.ts:105`의 mcp.prompts |
| SSE 원인 소실은 실제 SDK 동작 | SDK1.18.27 `serverSentEvents.gen.js` catch가 onSseError 호출 후 break |
| 외부 환경 로그는 현재 없음 | 로컬 로그로 사용자 원인을 확정하지 않음 |

## 5. 동작 / 사용자 흐름

```text
/명령 입력 → 이벤트 연결 → 명령 목록 준비(최대 30초, 취소 가능)
 → 존재하는 native 명령이면 command로 한 번 제출
 → 알려지지 않은 /입력은 기존 일반 prompt 경로
 ↘ 준비 실패: 모델 제출 없이 안전한 단계 오류
SSE 실패 → 안전한 오류 → 소유 연결 정리 → 사용자의 명시 재시도
```

| 상태/이벤트 | 동작 / 관측 |
|---|---|
| 명령 준비가 2.5초보다 길고 30초 안에 성공 | 메뉴 deadline과 독립적으로 실제 native 명령 제출 |
| 준비 timeout | 한국어 준비 단계 오류, command/prompt 제출 없음 |
| 준비 중 중단/close | 실제 command.list 요청도 취소, 뒤늦게 전송하지 않음 |
| 초기 SSE 실패 | 원인 종류가 구분되는 연결 오류, 모델 제출 없음 |
| 응답 중 SSE 실패 | 같은 안전한 원인 표시, 현재 generation 종료 |
| 명시 재시도 | 새 연결 시도로 진행, 이전 실패 때문에 자동 prompt를 더 보내지 않음 |

## 6. 범위 / 비범위

범위: OpenCode adapter의 명령 준비 budget·취소·수락 순서, SSE 오류 전달, 실제 SDK 경유 회귀와 버전 조사.
비범위: SSE broker·프로젝트 간 server 공유·plugin 비활성화·새 설정/UI·native 이력 계약 변경. 앞선 성능 제안 전체를 이번 오류의 원인으로 취급하지 않는다.

## 7. Requirements / Acceptance — R ↔ AT

| R / AT | AC | 동작 기준 | 검증 / production path |
|---|---|---|---|
| R1 / AT1 | AC1 | 2.5초를 넘긴 `/명령` 준비가 성공하면 정확한 native 명령/인자를 한 번 전송 | adapter.sendMessage → 실제 SDK fetch → command 응답과 실제 frame |
| R2 / AT2 | AC2 | 준비 timeout·close는 미제출을 유지하며 취소가 SDK Request까지 도달 | 같은 path에서 command/prompt 0과 signal 관측 |
| R3 / AT3 | AC3 | SSE HTTP/timeout/EOF/전송 실패를 안전한 문장으로 구분, 원문 비밀 없음 | 실제 SDK onSseError → error event + 순수 분류 테스트 |
| R4 / AT4 | AC4 | 실패 뒤 명시 재시도가 새 stream에서 정상 제출, 자동 재제출 없음 | 같은 adapter의 실패 채널 → 새 채널 |
| R5 / AT5 | AC5 | 메뉴용 짧은 조회와 기존 slash/일반 입력·중단·소유권 동작 유지 | native-resources·persistent·server·runtime 회귀 |
| R6 / AT6 | AC6 | 1.17.19 조사·재현 여부와 원인 미확정 범위를 사실로 보고 | 고정 태그·가능한 CLI probe·구현 보고 |

## 7-A. V / Trace Matrix

Baseline V1. 이번 작업에서 상속하는 명시 V 없음. 직접 행동 출력으로 판정하므로 선택 변이 없음.

| Node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R1~R6 / AT1~AT6 | R / AT | §7 | NEW |
| SD1 / ST1 | SD / ST | 명령 준비→제출·중단과 SSE 실패→명시 재시도 | NEW |
| AR1 / IT1 | AR / IT | channel→native read→SDK signal/budget, SDK SSE callback→frame | NEW |
| MD1 / UT1 | MD / UT | 안전한 준비 오류 분류와 default/read 옵션 의미 | NEW |

| Pair | left ↔ right | requiredness | production path | 직접 oracle / §10 |
|---|---|---|---|---|
| VP-01 | R1~R6 ↔ AT1~AT6 | REQUIRED | sendMessage→SDK→native command/error frame→명시 재시도 | persistent test의 느린 명령·취소·SSE 실패/재시도 및 보고 / EP01·02 |
| VP-02 | SD1 ↔ ST1 | REQUIRED | 준비→수락→native command, 실패→cleanup→새 채널 | persistent:`waits beyond the menu deadline…`, `cancels command preparation…`, `retries explicitly after…` / EP01·02 |
| VP-03 | AR1 ↔ IT1 | REQUIRED | adapter→channel→native-resources→SDK Request, SDK SSE→frame | 위 테스트 + native-resources options 테스트 / EP01·02 |
| VP-04 | MD1 ↔ UT1 | REQUIRED | signal 결합 / 안전 오류 분류 | native-resources 및 errors의 실제 반환값 / EP01·02 |

| Gate | 명령 / 범위 |
|---|---|
| subtree | 관련 Vitest, npm run lint/typecheck, Electron ABI 유지 후 build |
| repository | harness-boundary, doc-inventory, test-budgets, 변경 문서 link, diff check |
| message-bus | 설계/구현 별도 commit, trailer 파싱, plan/INDEX 상태 재확인 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 대상 / 검색 | 관측 / 의미 |
|---|---|
| `rg -n openCodeNativeCommands app/src/main/adapters/opencode/v1` | 제출의 lookup과 inventory의 두 production 소비. 실행 call만 긴 budget 사용 |
| SDK SSE 생성 코드 | 연결 시도는 존재. sseMaxRetryAttempts=0이 첫 fetch를 생략하는 것은 아님 |
| `channel.ts`의 iterator.next / for await | 초기·실행 중 종료에 각각 일반 연결 오류만 남음 |
| 1.17.19 event handler | `/event`가 server.connected를 처음 전송. endpoint 폐기라고 단정 불가 |

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| 명령 준비 | responseOpen을 연 뒤 메뉴용 2.5초 lookup | 취소 가능한 실행용 30초 lookup 성공 후 수락 상태 열기 |
| 메뉴 | 2.5초 조회 | 유지 |
| SSE | SDK callback 오류 미수집, done이면 generic error | callback의 실패 보관, 초기/후속 종료 때 안전 분류 |
| 취소 | 명령 lookup에 호출자 signal 미전달 | channel signal과 read timeout 결합, 수락 전 abort 재확인 |
| 재시도 | 명시 사용자 입력 | 유지. 실패 stream에서 prompt 재전송 없음 |

## 10. 계약 / 타입 / 강제 지점

| EP / Pair | 계약 / SSOT | 언제 강제 — 자리 목록 | 자리 검색 | 실패 의미 |
|---|---|---|---|---|
| EP01 / VP01~04 | 실행 read budget·취소·미제출 | (1) channel 명령 lookup의 30초/signal 전달 (2) native-resources command.list의 timeout+caller 결합 (3) channel 준비 오류 변환 (4) lookup 뒤 수락/responseOpen 순서 | `rg -n 'openCodeNativeCommands|AbortSignal|responseOpen = true|openCodePreparationError' app/src/main/adapters/opencode/v1/{channel,native-resources}.ts`에서 해당 path 소비 전수 | 잘못된 2.5초 제한·취소 후 전송·미제출 abort |
| EP02 / VP01~04 | SSE 안전한 실패 원인 | (1) onSseError 보관 (2) 초기 iterator.next 종료/abort 판정 (3) 후속 stream 종료 판정 (4) errors의 stage/timeout/status/EOF/일반 분류 함수 출력 | `rg -n 'onSseError|iterator.next|이벤트 연결|이벤트 스트림|openCodePreparationError' app/src/main/adapters/opencode/v1/{channel,errors}.ts` | 원인 소실·비밀 노출·취소의 연결 오류 오표시 |

강제 지점은 EP01의 4자리와 EP02의 4자리다. EP02(4)의 분기별 출력은 HTTP/timeout/EOF/일반 오류의 구별 값으로 판정한다. 운영 상태 사본은 이 plan 메타와 INDEX 해당 행 둘을 함께 갱신한다.

## 11. 구현 설계

| 파일 | 변경 / 테스트 |
|---|---|
| `app/src/main/adapters/opencode/v1/native-resources.ts` | 마지막 선택 인자로 read signal/timeout 전달. 기존 inventory 기본값 유지 |
| `…/channel.ts` | 실행 전 lookup 분리·오류/취소 처리·SSE 실패 보관과 초기/후속 소비 |
| `…/errors.ts` | stage별 고정 문장, HTTP 숫자 allowlist, raw cause 전달 없음 |
| `…/adapter.persistent.test.ts` | 실제 SDK와 AbortSignal을 사용하는 느린 lookup·close·HTTP SSE 실패/명시 재시도 |
| `…/native-resources.test.ts`, `…/errors.test.ts` | default/read signal과 안전 분류 경계 |

## 12. End-to-end 영향

오류는 기존 NormalizedEvent.error→SessionRuntime→TurnCoordinator의 화면 경로를 따른다. renderer·IPC shape·DB schema·native 설정은 변경하지 않는다.

## 13. Lifecycle / 오류 / 정리

lookup 취소는 channel signal을 따르고 다른 runtime signal은 건드리지 않는다. 준비 실패 전에 responseOpen을 열지 않아 미제출 root를 abort하지 않는다.
SSE 실패는 현재 generation만 종료하며 기존 finally의 controller/iterator/release 정리를 유지한다. 사용자의 재입력 외 자동 prompt 재시도는 없다.
새 저장소 쓰기 없음. 상태 사본 plan/INDEX는 같은 구현 commit에 갱신한다.

## 14. 성능 / 상한 / 최적화

실행용 목록 준비에만 최대 30초 예산을 적용한다. 메뉴 read는 2.5초를 유지한다. 별도 스킬 캐시·server 보존·SSE 구독 증가 없음.

## 15. READY self-review

READY. 사용자 CLI1.17.19와 첫 실행 조건을 보존했고, 현재 원격 원인 미확정과 확인 가능한 코드 결함을 구분했다. AC6행, EP8자리, 직접 행동 oracle, 운영 gate의 범위가 일치한다.

## [구현자 기입] 구현 보고

구현했다. 실제 SDK Request를 통한 느린 명령·취소·초기/실행 중 SSE 실패와 명시 재시도를 검증했다. 사용자 환경 자체의 두 번째 SSE 실패 원인은 미확정이다.

| 항목 | 관측 |
|---|---|
| 변경 | channel의 준비 전 수락 상태 이동·30초/signal 전달, native command read 옵션, 안전 오류 분류, 실제 SDK 회귀 |
| CLI1.17.19 실측 | 격리 XDG와 의도적으로 3.5초 지연한 stdio MCP. `/command` 2.5초 요청은 2,503ms timeout, 후속 조회는 1,694ms 성공. 첫/재시도 SSE 모두 HTTP200·server.connected |
| 원시 근거 | [결과](evidence/compatibility-result.json), [probe](evidence/compatibility-probe.cjs), [제어 MCP](evidence/delayed-mcp.cjs). 자신의 임시 session·child만 정리, 모델 prompt 없음 |
| 재현 준비 | npm `opencode-windows-x64@1.17.19` tarball을 임시 폴더에 pack/extract하고 두 script를 같은 폴더에서 실행. 전역 설치본·native 사용자 DB/설정은 변경하지 않음 |
| red 재현 | 새 느린 명령 테스트를 baseline channel로 실행: reads[0].aborted가 true라 실패. 수정 복원 뒤 통과 |
| 테스트 | focused 3파일44개 pass. 확장 23파일199개 중22파일192개 pass; native-cursor 7개는 Electron140/Node127 ABI 불일치로 미실행 |
| 타입·린트 | node/web/test 모두 exit0. lint 오류0·기존 virtualizer 경고2. lint의 무관한 execution-config formatting은 원복 |
| repository | boundary·inventory·real-git budget16 suites·diff check 통과, inventory diff 없음 |
| 빌드 | Electron ABI already ok, electron-vite build exit0. 기존 SubAgentTaskDetail 정적/동적 import 경고 유지 |
| AC 자기보고 | ✅6 · ⚠️0 · ❌0 = 총6. 사용자 실제 환경에서 재시도 실패 원인을 확정했다는 의미는 아님 |
| 대상 커밋 | r1 구현 — 좌표는 INDEX의 검증자 기입 |

### 강제 지점 전수

아래 P는 `adapter.persistent.test.ts`, E는 `errors.test.ts`다. 선택 변이·인용 변이·신규 구조 proxy oracle은 없으며 직접 행동 결과를 관측했다.

| Pair / EP | §10 지점 | 닫은 지점 | 직접 oracle / 운반 값 | 남긴 곳 |
|---|---|---|---|---|
| VP01~04 / EP01 | 실행 lookup의 budget/signal, read 결합, 준비 오류 변환, 수락 순서(4) | 4/4 | P:`waits beyond the menu deadline…` 실행/메뉴 서로 다른 실제 abort 상태와 command/인자; `cancels command preparation…` 실제 Request 취소; `fails command preparation safely…` echo·모델 제출·root abort 없음 | — |
| VP01~04 / EP02 | SSE callback, 초기 판정, 후속 판정, 안전 분류(4) | 4/4 | P:`retries explicitly after…` HTTP503→정상 재시도; `reports an initial…` timeout/EOF; `preserves a safe stream failure…` 연결 후 TypeError; E:`sanitizes…` HTTP401/503·두 stage·EOF·일반 실패, 비밀 없음 | — |

검색 대조: EP01의 submit lookup·read request·catch·responseOpen, EP02의 callback·초기 next·후속 EOF·분류 반환을 재확인했다. 양 production 경로 밖 inventory·기존 error classifier는 별도 역할이며 누락 소비 자리 없음.

| Pair | requiredness | 자기 상태 | 관측 |
|---|---|---|---|
| VP01 | REQUIRED | SELF_PASS | AC1~6 아래 행과 실제 CLI evidence |
| VP02 | REQUIRED | SELF_PASS | P의 lookup→command, close→미제출, 실패→명시 재시도 |
| VP03 | REQUIRED | SELF_PASS | 실제 설치 SDK가 전달한 Request.signal·body와 SSE callback/error frame |
| VP04 | REQUIRED | SELF_PASS | 메뉴/실행 abort 구별과 E의 반환 message·cause 부재 |

### 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 결과 | 실패 테스트 | 결과 |
|---|---|---|---|---|
| baseline channel 복원 | 사용자 timeout 재현. 선택 mutation 의무와 별개인 원래 코드 비교 | 이번 턴 red | P:`waits beyond the menu deadline…` 1 failed | 수정 복원 후 focused44 pass |

분모 검산: 선택 증거0 · 인용 변이0 · 새 구조 oracle0 = 의무 잠금0행. 위 행은 원래 결함 재현 기록이다.

### Product/UX 파생 검토와 잠재 문제

| 관측 / 문제 | 대응 |
|---|---|
| 새 준비 오류 문구가 화면까지 전달되는가 | E에서 classifier 출력 동일, P에서 NormalizedEvent.error로 관측. 기존 화면 consumer 유지 |
| 실패 후 자동 전송·늦은 준비 완료 | P에서 명시 재시도의 text만 단일 prompt로 확인, close 뒤 command/prompt 없음 |
| 단순히 메뉴 제한도 늘어나는가 | P에서 동일 시각 메뉴 요청은 abort, 실행 요청은 유지됨 |
| 실제 원격 SSE 실패 원인 부재 | 보고만. 같은1.17.19의 기본 SSE와 재접속은 격리 CLI에서 성공 |
| Desktop 기준 전체 시작 흐름 요구 추가 | 후속 설계로 시작/이벤트 공유·준비 수명을 보완. 이번 수정만으로 전체 parity를 달성했다고 하지 않음 |
| 설계 대비 차이 | 구현 의미 차이 없음. DB 관련 기존 suite는 ABI 환경 한계로 분리 |

### AC 자기보고

| AC | 관측 |
|---|---|
| AC1 | ✅ 실제 2.7초 대기 후 실행 신호 유지, native:slow와 exact argument 단일 command |
| AC2 | ✅ Request까지 close 전달, 준비 timeout의 echo·POST·abort 없음 |
| AC3 | ✅ 초기 HTTP/timeout/EOF 및 연결 후 전송 실패, raw secret 없음 |
| AC4 | ✅ 실패 뒤 새 stream의 명시 retry만 prompt, 자동 재전송 없음 |
| AC5 | ✅ focused와 확장192개, 메뉴 timeout 구별·기존 slash/소유권 회귀 |
| AC6 | ✅ 실제1.17.19 controlled MCP probe와 사용자 환경 미확정 범위 분리 |

검산: ✅6 · ⚠️0 · ❌0 = 총6. 다음 주체는 독립 검증자다.

### Review Signals

r1 최초 수정. 이전 성능 보고가 조사한 짧은 command 조회가 실제 첫 스킬 실행에도 적용됨을 이번 입력 조건으로 좁혔다. 다른 환경 로그 부재와 Node/Electron ABI 한계는 구현 검증과 구분했다.

## [검증자 기입] 파생 이슈 — verify r1 (2026-10-22)

판정 정본은 [verify.md](verify.md) — **PASS**.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| N1 | `[구현자 기입]` 설계 리뷰 누락·Product/UX와 잠재 문제 병합 | repository operation | 이후 구현 턴은 7필드 유지 | NON_BLOCKING | open |
| T1 | VP-03·§10 EP01·02 8자리 → 0275, AC6 → 0274로 계약이 뒤집힘 | VP-03 · EP01·02 · AC6 | 0275 verify §0-1·0274 verify AC12가 판정 | PLAN_GAP → 최신 handoff 이관 | transferred |
