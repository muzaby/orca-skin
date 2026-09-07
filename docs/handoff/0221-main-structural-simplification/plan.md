# Plan — Main 책임·수명주기·실행 경계 단순화

## 메타

| 항목 | 값 |
|---|---|
| 작성자 | Codex — 사용자 진단·개선 요청 수행 |
| 일자 | 2026-09-08 |
| 상태 | READY |
| 기준 코드 | `054ede9b` |
| V mode / 기준 V / revision | Delta V / V1 (`eeb95e4a`) / ΔV1 |
| 유효 V | V1 + ΔV1 |

# Part I — Product & UX Contract

## 1. 목표

현재 Main에서 배포·입력 구성·자원 종료의 책임이 갈라진 지점을 정리한다. 호출자가 쓰지 않는 데이터와 옛 계약을 제거하고 기존 기능의 수명주기를 닫는다.
완료 후 사용자에게 보이는 채팅·MCP·스킬·설정·인증 동작은 유지되며, 실패·취소 경로에서도 자원과 정책이 누락되지 않는다.

## 2. 요구 출처

사용자 명시 요구: “Main 내 코드가 구조적으로 취약한점을 진단하고 개선하라”, 추가 진단 축은 “파편화”, “결집/결합”, “중복된 기능”이다.
조건 원문: “단 해결을 위해 플랫폼화(비대화) 하는 것은 안되며 회귀 또한 안된다.” 목적 원문: “추후 구조적으로 계층이 더 생길것을 대비해(srt, cowork, opencode adapter 등) 경량화/모듈화를 미리 준비하는 것이다.”
설계 해석: 현재의 책임·계약을 줄이고 명확히 하며, 미래 기능용 실행 플랫폼·registry·DSL을 선행 구현하지 않는다.

## 3. Decision Ledger

| ID | 결정 | 이유/조건·출처 | 상태 |
|---|---|---|---|
| D-01 | Main의 실제 소비·호출 경로로 구조를 진단한다 | 사용자 요청. 파일 수·줄 수만으로 파편화 또는 비대화를 판정하지 않는다 | ACTIVE |
| D-02 | 기존 모듈 안에서 공통 책임을 모으고 죽은 전달·계약을 제거한다 | 사용자 경량화·모듈화 목적. 새 범용 플랫폼·DI container·계층 추가 금지 | ACTIVE |
| D-03 | 공개 IPC·DB 형식·정상 동작·인증/원격 스택·보안 정책을 보존한다 | 사용자 회귀 금지. 입증된 누락·오류 경로만 바로잡는다 | ACTIVE |
| D-04 | SRT·cowork·OpenCode 런타임 구현은 하지 않는다 | 미래 구조 준비라는 범위. 앞선 SRT 도입 보류 결정 유지 | ACTIVE |
| D-05 | 테스트 환경의 ABI·사용자 폴더 격리를 코드 실패와 구분한다 | 현재 baseline에서 Node 127 / 설치 SQLite 140 불일치와 profile EPERM 확인 | ACTIVE |
| D-06 | 성능 저하를 유발하는 hot path의 중복 작업·동기 I/O·전체 재처리·버퍼링도 진단한다 | 사용자 추가 요청. 실측과 잠재 위험을 구분하며 근거 없는 cache·상주 서비스 추가 금지 | ACTIVE |
| D-07 | 개별 결함 보완에 한정하지 않고 책임·모듈 경계·중복을 재편하는 리팩토링을 수행한다 | 사용자 정정: “리팩토링 수준으로 요구한 것임”. r1 수정은 유지하고 파편화된 제출·설정·사용량 책임을 통합 | ACTIVE |

갱신 메모: 새 작업 Baseline V이며 SRT 계획을 상속하지 않는다. 추가 사용자 요구 D-06은 기존 경량화 범위를 보완한다. D-01~06 ↔ AC1~11 대조에서 충돌 없음. 사용자에게 추가로 결정받을 제품 정책·의존성은 없다.

## 4. 비판적 검토

| 판단 | 근거 | 처리 |
|---|---|---|
| 단순한 대형 파일 분할은 근거 부족 | `bootstrap.ts`는 실제 부팅 조립부이며 순서·조기 IPC·구독 순서를 소유한다 | 구성 루트·기존 하향 DAG 유지 |
| 작은 순수 파일이 모두 파편화는 아니다 | env fingerprint·respawn·admission·LRU에는 독립 불변식과 테스트가 있다 | 의미 있는 순수 경계 유지 |
| 일부 중복은 서로 다른 정책이다 | MCP는 미해결 서버 전체 제거, app env는 해당 값의 키 제거 | 함수 하나로 합치지 않고 값별 판정 오류만 수정 |
| 단일 Claude 모델 정책은 미래 제약이다 | settings/runtime catalog가 Claude model parser를 사용한다 | 현재 모델 동작 유지, OpenCode 구현 때 명시 경계로 사용. 새 다중 모델 registry 금지 |
| 인증과 gate 분리는 유효하다 | 연결 수명과 앱 진입 정책의 소비자가 다르다 | feature 통합·플랫폼 재구축 제외 |

## 5. 동작과 상태

| 시작 | 유지·개선할 흐름 | 결과 |
|---|---|---|
| 엔진 설정 CRUD | source 변경 → 기존 직렬 배포 → finally의 설정/runtime/catalog 무효화 | 최신 plugin MCP·스킬 산출물과 모델 목록 |
| 채팅 신규·resume·continuation | 입력 준비 → runtime/lease 획득 → 요청 실행 → 소유한 자원 정리 | 정상 idle 재사용, 실패 close, listener 잔존 없음 |
| 채널 완료·오류·강제 해체 | 경로별 frame 종료 → 공통 채널 handle/token/메타 회수 | 구세대 이벤트·중복 종료 통지 방지 |
| 제목 생성 후 앱 종료 | 생성 작업 취소·dispose → DB 종료 | 늦은 completion이 제목/DB를 갱신하지 않음 |
| 인증된 다운로드 | 동일 Chromium 요청·홉별 정책 → 수신 시 크기 검사 | 허용 크기 본문 보존, 초과 즉시 abort |

UI·IPC·영속 스키마 변경은 없다. 동시 배포·취소·owner 소멸·늦은 완료·본문 길이 미신고를 직접 검증한다.

## 6. 범위

범위는 §8에서 확인한 책임 중복·누락·불필요 계약 및 관련 테스트·현재 문서다. renderer 기능 변경, auth/gate 통합, SDK 교체, 새 의존성, OS 격리 설치는 제외한다.
미래 Claude 외 모델 해석과 공유 실행 포트 설계는 실제 새 adapter가 생길 때 다룬다. 기존 폐쇄망 배포 확장점과 보안·재시작 정책은 제거하지 않는다.

## 7. Acceptance — R ↔ AT

| R / AT / AC | 동작 기준 | 직접 검증 | 도달 경로 |
|---|---|---|---|
| R-01 / AT-01 / AC1 | 엔진 CRUD가 MCP·스킬과 같은 배포 직렬화/구성을 사용하며 실패 때도 캐시를 무효화한다 | 실제 IPC callback + 기존 deployment service의 동시 작업·실패 테스트 | engine handler → deployExtensions → deployment service |
| R-02 / AT-02 / AC2 | 매 턴 확장이 실제 필요한 지침·plugin·runtime tool·skill 정보를 전달한다 | builder 산출 및 Claude plugin/runtime tool 소비 테스트, 미사용 MCP 필드·의존 제거 | bootstrap → builder → adapter |
| R-03 / AT-03 / AC3 | 같은 미해결 변수가 반복돼도 관련 env 키를 모두 제외한다 | 반복/혼합/정상 문자열과 입력 불변성 | turn setup → expandEnvRecord |
| R-04 / AT-04 / AC4 | 단발·대화 실행의 공통 settings/env/source 값이 유지되고 SDK 옵션 타입으로 검사된다 | 양쪽 query 옵션 및 기존 adapter 회귀 | Claude complete/sendMessage → query |
| R-05 / AT-05 / AC5 | 요청 준비·실행 실패·owner 소멸에서 listener·runtime·turn·lease를 정확히 정리한다 | 실제 send 경로의 오류 주입과 정상 idle 반환 | chat send → acquire/run → finally |
| R-06 / AT-06 / AC6 | 채널 종료 통지·handle 회수·spawn 메타 초기화가 구세대/중복 종료에도 일관된다 | one-shot/persistent/error/retire 기존 행동 테스트 | SessionRuntime consume/pump/teardown |
| R-07 / AT-07 / AC7 | 종료한 앱은 진행 중·뒤늦게 끝난 제목 생성에서 DB 쓰기를 하지 않는다 | 정상 제목, dispose abort, abort 무시 후 resolve 테스트 및 shutdown 배선 | bootstrap → TitleGenerator → shutdown |
| R-08 / AT-08 / AC8 | 두 인증 경로 모두 maxBytes를 실제 Chromium 수신 중 적용하고 redirect/cookie/abort를 유지한다 | fake Electron emitter로 선언 길이·누적 초과·오류·취소·3xx·정상 bytes 검증 | sender/netFetch 또는 BrowserSessionStore → sendOnce |
| R-09 / AT-09 / AC9 | IPC 핸들러는 사용 속성만 요구하고 필요 없는 auth/gate를 전달받지 않는다 | 최소 typed fixture와 typecheck, 기존 IPC 행동 테스트 | bootstrap RouterContext → register handlers |
| R-10 / AT-10 / AC10 | 실제 LRU·도구·runtime config 기능이 유지되며 무동작/미사용 계약만 제거한다 | registry/pool/supervisor 및 runtime config/tool 테스트 | 기존 production 소비자 전체 |
| R-11 / AT-11 / AC11 | 성능 위험을 실제 호출 경로와 입력량 기준으로 분류하고, 이번 변경의 중복 계산·수신 버퍼 상한 개선을 행동 증거로 확인한다 | hot path 조사, builder 불필요 MCP 조회 제거, maxBytes 초과 시 다음 chunk 보관/전체 concat 전에 중단 | turn build / IPC·이벤트 / 네트워크 data 수신 |

사람 실기로 미룬 순수 로직은 없다. 실제 사내망/GUI를 이 변경의 자동 테스트가 대신했다고 보고하지 않는다.

## 7-A. V / Trace Matrix

Baseline V1: 위 각 `R-n`·`AT-n`은 NEW다. 아래 노드는 동작을 잠글 검증 계약을 새로 설정하는 것이며 기능 신규 도입을 뜻하지 않는다.

| 노드 | 레벨·계약 | provenance |
|---|---|---|
| R-01~11 / AT-01~11 | §7 각각의 사용자·소비자 계약/인수 검사 | NEW |
| SD-01 / ST-01 | 채팅·제목의 획득/종료와 늦은 작업 정리 | NEW |
| SD-02 / ST-02 | 확장 배포 직렬화·실제 수신 제한 | NEW |
| AR-01 / IT-01 | builder→adapter의 필요한 전달만 유지 | NEW |
| AR-02 / IT-02 | 좁은 handler 의존과 bootstrap 배선 | NEW |
| MD-01 / UT-01 | env 값별 누락 판정·SDK 공통 옵션 | NEW |
| MD-02 / UT-02 | 채널 retire·LRU/registry·기존 도구 계약 | NEW |

| Pair | left ↔ right | requiredness | production path / 직접 oracle | 적대 증거 | §10 지점 |
|---|---|---|---|---|---|
| VP-01~10 | R-01~10 ↔ AT-01~10 (각 번호 독립 pair) | REQUIRED | §7 각 도달 경로와 행동 단언 | VP-01·07·08·09는 아래 배선/경계 대조, 나머지 직접 실패/취소 행동 | 각각 EP-01 / 02 / 03 / 04 / 05 / 06 / 07 / 08 / 09 / 10 |
| VP-11 | SD-01 ↔ ST-01 | REQUIRED | send 실패 → finally, shutdown → title dispose → 늦은 resolve | 제목 dispose 호출 제거 시 늦은 DB 쓰기 테스트 또는 배선 가드 실패 | EP-05~07 |
| VP-12 | SD-02 ↔ ST-02 | REQUIRED | IPC → 배포 queue, capped 요청 → Chromium data emitter | direct deploy 복귀 / maxBytes 전달 제거를 각각 검출 | EP-01·08 |
| VP-13 | AR-01 ↔ IT-01 | REQUIRED | builder → extensions → Claude query | 직접 산출·소비 단언, 추가 변이 미선정 | EP-02·04 |
| VP-14 | AR-02 ↔ IT-02 | REQUIRED | bootstrap → narrow handler context → callback | 불필요 속성 참조는 타입 오류, 실제 callback을 실행 | EP-07·09 |
| VP-15 | MD-01 ↔ UT-01 | REQUIRED | env input → 키별 drop, completion/send → typed options | 동일 미해결 변수 반복·정상 env 대조 | EP-03·04 |
| VP-16 | MD-02 ↔ UT-02 | REQUIRED | runtime retire → frame/metadata, pool → victim close | 구세대·중복 close·backlog 기존 행동 테스트 | EP-06·10 |
| VP-17 | R-11 ↔ AT-11 | REQUIRED | hot path 조사 → 작업량/버퍼 증거 → 개선/유지/후속 구분 | wall-clock 속도 개선을 추정하지 않고 불필요 작업 제거·수신 중단 직접 단언 | EP-02·08 |

REQUIRED 총량은 VP-01~17의 개별 pair다. 상속 V가 없으므로 REGRESSION requiredness pair는 없으며, 기존 기능 회귀는 각 REQUIRED의 행동 증거와 아래 운영 gate에 포함한다.

| Gate | 적용 이유 | 명령/증거 |
|---|---|---|
| Main·shared lint | 수정 레이어/순환·console·코딩 규칙 | ESLint `src/main src/shared` (autofix 없음) |
| 타입 3구성 | 내부 계약/fixture 변경 | `npm run typecheck` |
| 변경 행동 및 Main 회귀 | 기존 실제 기능·오류·취소 경로 | Vitest affected suites, 이어 Main 전체. 실패는 baseline과 비교 |
| 문서·diff | 현재 구조와 핸드오프 정합 | `node scripts/check-doc-inventory.mjs --check`, `git diff --check` |
| 메시지 버스 | plan/impl 분리·상태·trailer | 설계 선행 커밋, INDEX·구현 보고 및 trailer 파싱 |

# Part II — Technical Design

## 8. Research

| 발견 | 현재 코드 증거 | 처리 |
|---|---|---|
| 배포 경로 중복 | `app/handlers/engine.ts:24` direct deploy vs `app/bootstrap.ts:195`의 서비스/skillRoots/mcpConfig | 기존 deployExtensions 재사용 |
| 죽은 턴 데이터·결합 | `features/extensions/builder.ts:67`의 mcp 생산, `adapters/turn.ts:89` 필드. 실제 소비는 bootstrap의 plugin 배포 | 필드·builder McpStore 인자 제거 |
| env 판정 오류 | `features/harnesses/env.ts:16`의 누적 missing 증분 비교 | 값별 missing을 보고 집합과 분리 |
| 흐릿한 SDK 경계 | `adapters/claude-adapt.ts`의 object 반환, `claude.ts`의 공통 옵션 반복 | 기존 파일 내부 typed 공통 조립 |
| 정리 범위 빈틈 | `app/chat-turn/send.ts` owner listener 등록 뒤 inner try 이전 요청 조립 | 바깥 체인 정리 소유자에서 listener 포함 회수 |
| 채널 회수 중복 | `features/sessions/session-runtime.ts` consume/pump/teardown | 같은 클래스 내부 공통 retire 경로 |
| 제목 작업 소유 누락 | `features/chat/title-generation.ts`와 bootstrap 지역 TitleGenerator | 작업 controller·dispose, bootstrap shutdown 배선 |
| 수신 상한 위치 오류 | `infra/net/transport.ts`·`browser-session.ts`의 후검사, `net-request.ts:89`의 전체 수신 | 기존 sendOnce 안에서 bounded 수신·abort |
| 과대 context | `app/context.ts`의 미사용 auth/gate와 광범위 handler 인자 | 지역 Pick/구조 타입, 미사용 필드 제거 |
| 옛 계약 | registry evictIdle는 no-op, PluginToolContext/RuntimeToolContribution 생산·소비 없음, 동명 HarnessModelProviderEntry 두 의미 | 사체 제거·runtime 대상 타입 이름 구분 |

전수 조사: TS AST로 Main production `.ts` 232개를 읽었다(테스트 제외, 상대 import 기준). 이는 진단 기준선이며 상시 문서 인벤토리는 `docs/generated/inventory.md`가 소유한다.
소비자 검색은 `TurnExtensions`, `new ExtensionBuilder`, `PluginToolContext`, `RuntimeToolContribution`, `evictIdle`, `RouterContext`, `sendOnce`, `createSender`, `TitleGenerator` 전수로 시행한다. 이동·삭제 후 타입 검사로 남은 호출을 닫는다.

## 9. AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| 배포 | engine만 직접 deploy, 기타는 직렬 서비스 | 기존 서비스 한 경로, cache finally 유지 |
| 턴 구성 | 소비되지 않는 MCP와 별도 실제 plugin 배포 | plugin 배포가 MCP를 소유, 턴은 필요한 값만 전달 |
| 실행 준비 | settings/env 옵션 중복, object 반환 | 현재 adapter-local 함수에서 SDK 타입으로 조립 |
| 수명주기 | listener·채널·제목 종료 책임 분산 | 해당 소유 모듈 내부에서 획득과 종료를 짝지음 |
| 원격 수신 | 전체 buffering 뒤 위 계층에서 상한 재검사 | sendOnce가 상한 넘는 chunk를 보관하기 전에 abort |
| 의존성 | handler가 전체 context 접근, 미사용 auth/gate 전달 | consumer별 최소 계약, 같은 app 레이어 유지 |

새 서비스 레이어/실행 registry/정책 DSL/외부 의존성은 추가하지 않는다. 기존 feature 교차 import 금지, Chromium 단일 원격 스택, 권한·workspace guard, lease/LRU 정책을 유지한다.

## 10. 모듈과 강제 지점

| EP | 지점 전수·책임 | 변경 / 실패 의미 |
|---|---|---|
| EP-01 | engine add/update/delete → refreshHarnessSettings (3 IPC 진입) | 배포 closure 호출, finally 무효화. bypass면 산출 경합 가능 |
| EP-02 | TurnExtensions 계약, ExtensionBuilder 생성·build, bootstrap 생성자 배선 | 미사용 mcp 제거, 필요한 plugin/runtime tool/지침 유지 |
| EP-03 | expandEnvRecord loop (1 값별 판정) | 같은 missing 이름의 뒤 키도 drop. 보고 목록은 중복 제거 |
| EP-04 | Claude complete / sendMessage (2 query 진입) | 공통 settings/settingSources/env만 결집. 도구·hook·plugin 차이 유지 |
| EP-05 | send의 준비 실패/실행 종료 (2 정리 가지), owner listener 등록/제거 | 정리 함수 또는 바깥 finally 소유로 묶되 성공 idle 반환·실패 close 구분 |
| EP-06 | consumeOneShot / pump / teardown (3 종료 진입) | 채널 handle/token/meta retire 공통화, frame/drain/backlog 전이 유지 |
| EP-07 | TitleGenerator 생성/완료/dispose + Bootstrap 생성·shutdown | abort 무시 completion까지 쓰기 차단, DB 종료 앞 dispose |
| EP-08 | createSender→netFetch manual→sendOnce, BrowserSessionStore→sendOnce (2 경로) | maxBytes 내부 옵션 전달·Content-Length/누적 검사·abort 정착과 listener 회수 |
| EP-09 | RouterContext의 사용 handler 전수 및 bootstrap 조립 | 각 consumer가 읽는 속성만 요구; 미사용 auth/gate 제거. optional runtime의 의미는 임의 변경하지 않음 |
| EP-10 | SessionRuntimeRegistry / RuntimePool / runtime-tools / runtime-config 소비자 | 무동작 API·미사용 type 제거, 역할 구분 rename. 실제 LRU·도구 기능 유지 |

네트워크는 기존 `SendOnceOptions`에 선택 `maxBytes`를 더한다. 표준 `typeof fetch` 주입을 유지하면서 Main 내부 RequestInit 확장으로 같은 선택 상한을 manual 경로에 전달하며, 기본 요청 동작은 바꾸지 않는다.
본문 상한 초과 시 추가 buffering을 중단하고 request를 abort한다. browser 경로의 중복 후검사는 제거하되 주입 fetch를 쓰는 transport의 결과 검증은 유지한다.
제목 작업은 TitleGenerator 내부 controller 집합과 disposed flag만 갖고, async shutdown framework를 만들지 않는다. 코드 이동은 getter·callback capture 시점과 finally 도달성을 함께 검사한다.

## 11. 구현·검증 순서

1. baseline 확인·설계 커밋. DB ABI를 뒤집지 않기 위해 설치된 Electron의 Node 실행 모드(ABI140)와 시험 전용 USERPROFILE을 사용할 수 있음.
2. 독립 범위 병렬: adapter/확장 전달·env, 세션/채팅 수명주기, handler 배포·context. bootstrap 수정은 루트가 통합.
3. 원격 수신 경계와 필수 callback/에러 회귀를 구현하고, 실제 생산 호출 경로가 새 검사를 소비하는지 확인.
4. affected 테스트 → Main 전체·타입·lint·문서 gate. 환경 실패와 코드 실패를 분리하고 관련 없는 기존 red를 성공으로 보고하지 않음.
5. 구현 기록·남은 한계·INDEX 갱신, 독립 검토 수행. 새 발견은 계약 범위 안에서만 수정하며 새 제품 결정을 발명하지 않음.

## 12. READY 점검

- Decision·AC·EP 대조: D-02는 기존 모듈/타입 내 결집과 제거로 구현하며 공통 플랫폼 추가 0을 목표로 한다.
- 오류·취소: EP-05~08에 늦은 완료·중복 정리·중도 abort의 직접 oracle을 명시했다.
- 참조 소비/등록/타입: §8의 전수 검색과 타입 검사로 닫으며 생산 기능은 테스트를 위해 제거하지 않는다.
- 순수/배선 테스트: 실제 callback을 실행하고 TitleGenerator shutdown·network 상한 전달의 배선 제거를 검출한다.
- 범위/비범위: 기존 Claude와 도구 동작 유지가 범위이며 미래 adapter·SRT 도입을 선행 조건으로 삼지 않는다.

## ΔV1 — 동작을 보존하는 Main 책임 재편

### 요구 해석과 선택

사용자 정정에 따라 완료 범위를 확장한다. V1의 오류 경로 보완만으로 Main 구조 리팩토링이 완료됐다고 판정하지 않는다. 공개 동작을 유지하면서 함께 변경돼야 하는 코드·상태·변환의 소유자를 맞춘다. 새로운 제품 기능·범용 실행 플랫폼은 만들지 않는다.

단순 파일 축소, 큰 파일의 기계적 분할, 새로운 공통 서비스 플랫폼을 검토하고 제외했다. 선택은 기존 소유자에 중복·전달 wrapper를 흡수하고, 큰 DB 클래스에서는 독립적인 사용량 SQL 책임만 고정 구성 객체로 분리하는 것이다. 큰 auth lifecycle·SDK 메시지 매핑·mock 시나리오는 길이만으로 분할하지 않는다. 서로 다른 cache 만료·오류·경로 정규화 정책도 합치지 않는다.

### AS-IS → TO-BE

| 책임 | AS-IS | TO-BE·구조 효과 |
|---|---|---|
| 채팅 제출 | 신규/busy 적재가 payload·queued 이벤트를 각각 조립하고 index/deps callback으로 우회 | enqueue가 두 흐름의 적재·발신을 소유. 공통 payload/queued 발신 공유, send가 직접 호출. busy-reserve 파일·중간 callback 계약 제거 |
| 턴 해석 | turn-setup에 provider/env 해석과 renderer 발신이 함께 있어 큐·취소 코드도 설정 모듈에 의존 | 해석은 resolve-turn, submitted는 enqueue, forward는 send의 coordinator 조립으로 이동. turn-setup 제거 |
| 설정 소스 | settings 서비스와 별도 디렉토리 열거 파일, runtime 입력을 models:[]로 보정 | 열거·entry 타입은 settings, 기본 provider 선택은 models. resolve가 실제 사용하는 key/harnessId/modelProviderId만 요구. settings-entries 및 bootstrap 보정 wrapper 제거 |
| Claude 모델 | parser와 available-models가 타입/알고리즘을 나눠 갖고 catalog가 파서 내부 순서를 조립 | model-parser가 settings/runtime 진입을 구분해 최종 모델 목록을 반환. available-models 제거, 최종 default 결정 중복 제거 |
| 사용량 영속 | DbQueries가 session/history/project/scheduler와 사용량 SQL을 함께 소유 | 같은 DB 연결의 고정 usage 속성이 UsageQueries 소유. 사용량 메서드 forwarding·registry 없이 소비자가 해당 포트를 사용 |
| 사용량 기록/복원 | subscriber가 DB·tracker를 함께 조작, usage-map이 기록 판정과 IPC 변환을 함께 소유 | 원장 기록·재집계·방송은 UsageTracker, DB→wire 변환은 기존 dto. subscriber/usage-map 제거 |
| 이력 읽기 | session IPC callback이 파트·usage·비용·lineage·worktree 조립을 직접 소유 | history reader가 같은 조회/조립을 수행. handler는 입력 검증·읽기 호출·activity 부착 담당 |
| MCP 구성 | convert가 expand 결과의 속성명만 바꾸는 중간 계층 | convert가 확장·서버별 제외·target 반환을 직접 소유. expand 파일/중간 result wrapper 제거 |

불변식: busy admission과 적재 사이에 await를 넣지 않는다. 활성 턴은 getter로 읽는다. usage→history→title→relay 구독 순서, 원장 messageId 연결, DB SQL·준비 정책·스키마, settings/cache 무효화·runtime 빈 모델 의미, MCP 미해결 서버 전체 제외를 보존한다. 새로운 실행 registry·CRUD framework·공개 IPC·새 의존성은 없다.

### 추가 인수 기준

| R / AT / AC | 관측 계약 | 직접 검증·도달 경로 |
|---|---|---|
| R-12 / AT-12 / AC12 | 신규·busy 제출이 하나의 적재 모듈에서 같은 첨부/요구사항/표시 메타·queued/submitted wire를 만들며 동기 admission과 listen 해제를 유지한다 | 실제 send→busy/new→queue→event 및 기존 queued-requirements/pending queue 테스트 |
| R-13 / AT-13 / AC13 | provider/env 해석과 renderer 발신이 분리되며 신규·resume·continuation의 준비 값·await 순서·게터 의미가 유지된다 | resolve-turn/provider 구성 테스트, 실제 send/continuation/runtime tools/권한 회귀 |
| R-14 / AT-14 / AC14 | 설정 서비스가 소스 열거·캐시를 소유하고 SDK용 settings/runtime 모델 파서는 각자의 빈 목록/default 의미를 보존한다 | 실제 설정 파일·mtime/invalidate 테스트와 parser/runtime catalog 사례; bootstrap은 타입 보정 없이 서비스 주입 |
| R-15 / AT-15 / AC15 | 사용량 SQL과 기록 수명이 각자의 소유자로 모이며 원장·집계·방송 결과가 동일하다 | 동일 SQLite 연결의 usage queries·session 삭제·기간/remote 보고서·모델별 원장·tracker/구독 순서 회귀 |
| R-16 / AT-16 / AC16 | 이력 reader가 기존 LoadedSession 내용을 동일하게 복원하며 handler는 activity와 IPC 경계만 덧붙인다 | 실제 DB→reader→handler: 없는 세션·parts 순서/완료·telemetry/비용·lineage·worktree/cwd |
| R-17 / AT-17 / AC17 | MCP 구성 변환이 한 모듈에서 수행되고 정상 값·입력 불변성·서버별 제외·이유가 유지된다 | toClaudeConfig를 통한 stdio/http/sse·빈 소스·복수 변수·미해결 서버 및 resolver 테스트 |
| R-18 / AT-18 / AC18 | 모델 목록 소유권은 고정 선언의 canonical key를 한 번 구성해 판정하며 기본 모델은 최종 목록에서 결정한다 | canonical 충돌·빈 cache에서도 read-only 유지·settings/runtime default/alias 테스트. 새 캐시 서비스 없이 반복 정규화 감소 |

### ΔV 추적

R/AT-12~18, AR/IT-03~06, MD/UT-03~05는 NEW다. V1 노드의 정상/실패 의미는 변경하지 않는다.

| Pair | 노드 / requiredness | production 경로·oracle | 강제 지점 |
|---|---|---|---|
| DP-01 | R-12↔AT-12 / REQUIRED | send→enqueue의 신규/busy 실경로→queue·wire 결과 | EP-11 |
| DP-02 | R-13↔AT-13 / REQUIRED | resolve-turn→runtime request→coordinator/continuation 입력·이벤트 | EP-12 |
| DP-03 | R-14↔AT-14 / REQUIRED | 소스 열거→resolve, settings/runtime 입력→각 parser→catalog | EP-13·14 |
| DP-04 | R-15↔AT-15 / REQUIRED | telemetry→tracker→db.usage→delta, 동일 연결 SQL 회귀 | EP-15·16 |
| DP-05 | R-16↔AT-16 / REQUIRED | DB→history reader→sessionLoad callback의 완전 DTO | EP-17 |
| DP-06 | R-17↔AT-17 / REQUIRED | MCP source→convert→config/dropped, resolver 동작 | EP-18 |
| DP-07 | R-18↔AT-18 / REQUIRED | 선언→canonical membership, 최종 모델 목록→default | EP-14 |
| DP-08 | AR-03↔IT-03 / REQUIRED | 제출·해석 소유 분리 후 실제 send의 신규/취소/continuation | EP-11·12 |
| DP-09 | AR-04↔IT-04 / REQUIRED | 설정 서비스 직접 주입→runtime 구성→모델 목록 | EP-13·14 |
| DP-10 | AR-05↔IT-05 / REQUIRED | tracker와reader가 db.usage 포트 사용, bootstrap 구독 순서 | EP-15~17 |
| DP-11 | AR-06↔IT-06 / REQUIRED | bootstrap→toClaudeConfig→deployer의 실제 확장 구성 | EP-18 |
| DP-12 | MD-03↔UT-03 / REQUIRED | 공통 queued payload 조립·동기 적재와 기존 이벤트 구분 | EP-11 |
| DP-13 | MD-04↔UT-04 / REQUIRED | parser 정책 차이·default·canonical membership | EP-14 |
| DP-14 | MD-05↔UT-05 / REQUIRED | 같은 SQL의 row/기간/원격값 및 DB→DTO 변환 | EP-15~17 |

상속 회귀: V1 VP-01~17을 REGRESSION으로 재실행한다. 변경하지 않는 auth·권한·remote 보안 정책도 기존 Main 전체 테스트와 레이어 gate로 확인한다.
기존 행동 oracle은 새 소유자/포트에서 유지한다. 경로 이동 때문에 기존 테스트를 지우고 카운트만 맞추지 않는다. 구조 효과는 실제 삭제/신규 모듈·import·호출자 diff로 기록하며 새 줄 수/파일 수 gate를 만들지 않는다.
새 배선 oracle의 선택 증거는 EP-11 busy 직접 호출 삭제, EP-16 bootstrap의 tracker 기록 호출 삭제다. 둘 다 관련 실제 callback 결과가 실패해야 한다. V1의 선택 증거는 변경된 소유 경로에서도 같은 결함을 검출해야 한다.

### §10 추가 강제 지점

| EP | 소유 경계·전수 지점 | 보존·실패 의미 |
|---|---|---|
| EP-11 | send 신규/busy 분기, enqueue, index의 cancel submitted, turn-request의 submitted | 동기 실행·큐 순서·첨부/requirements·held/listen·wire를 유지. 중간 callback/중복 payload 계약 제거 |
| EP-12 | resolveTurnProvider 생산, send/resolve-turn/continuation의 해석 소비, 기존 turn-setup import 소비자 | 준비/검증 시점 불변. 취소·큐 코드가 해석 모듈을 의존하지 않음 |
| EP-13 | settings source 열거·entry/defaultProvider 소비, Service.resolve, bootstrap settings 포트 주입 | mtime/list cache·기본 provider·손상 파일 의미 유지, models:[] 보정 제거 |
| EP-14 | settings parser/runtime parser 진입, available-models helper 소비, catalog ownership/list | 빈 runtime 목록은 제거, settings alias 폴백 유지. canonical/default/중복 의미 불변 |
| EP-15 | DbQueries 사용량 statement/method와 모든 소비자·fixture | UsageQueries가 같은 연결·같은 SQL·동일 lazy/eager 정책을 소유. 기존 facade 사본 없음 |
| EP-16 | bootstrap telemetry subscriber, UsageTracker, usage-map의 기록 판정 | 원장·model row·messageId·context값·해당 provider만 방송·사용량 구독 순서 보존 |
| EP-17 | session load IPC, 기존 loadParts/usage/lineage/worktree 조립, usage DTO 변환 | 완전한 LoadedSession·정렬/오류/cwd/activity 의미 보존. 페이지네이션·새 캐시 없음 |
| EP-18 | convert→expand 생산 경로, bootstrap·테스트·현재 문서 소비 | 단일 target 변환 모듈에서 확장. 미해결 env는 서버 전체 제외, 입력 불변 |

### 구현 순서·게이트

1. ΔV1 설계만 별도 커밋하고 r1의 기준선/증거를 유지한다.
2. 독립 범위 병렬: 채팅 제출·해석 / 설정·모델 / 사용량 DB·기록·이력. bootstrap·MCP 통합·문서는 root가 소유한다.
3. 각 이동에서 기존 테스트를 새 소유 경계로 옮기고, 부족한 실제 callback·DB→reader 테스트를 먼저 확보한다. 구조적 이동에 불필요한 새 테스트 프레임워크는 만들지 않는다.
4. 영향 테스트·타입 3구성·Main 전체·Main/shared lint·문서/링크·diff gate. 실행은 기존 Electron Node ABI140와 시험용 USERPROFILE을 유지한다.
5. 동일 코드 변경 전/후의 실제 모듈/의존/중복 경계 변화와 유지한 책임을 진단 보고서에 기록한다. 속도 향상률은 실측 없이는 쓰지 않는다.

준비 판정: READY. 사용자 제품 선택·신규 의존성·외부 SDK 변경이 필요한 항목은 없다. 구현 중 새 불확실성이 생기면 해당 계약만 되먹인다.

## [구현자 기입]

### r1 — 설계 리뷰

구현 자기판정은 SELF_PASS다. 공개 IPC·DB 형식·UI·의존성 변경 없이 기존 소유자 안에서 책임을 모았다. 구조·성능 진단은 [진단 보고서](../../etc/study/main-structure/diagnosis.md)에 보존한다.

설계의 범용 플랫폼 금지와 optional runtime 의미를 유지했다. 제목 작업은 controller와 timeout을 같은 Map에서 관리해 dispose가 둘을 회수한다. 새 공유 캐시·만료 정책·재진입 계층은 없다.
EP-01 구현 중 독립 검토에서 큐의 기존 warn/null 처리가 엔진의 reject까지 삼키는 회귀를 발견했다. 같은 서비스에 호출별 `throwOnFailure` 옵션을 추가해 엔진의 실패 전달과 기존 MCP·스킬의 관용 처리를 함께 보존했다. D-03의 구현 보완이며 새 제품 결정은 없다.

### 강제 지점 전수와 V-pair 자기확인

| AC / pair | 강제 지점·관측 | 자기결과 |
|---|---|---|
| AC1 / VP-01 | EP-01: engine add/update/delete 모두 같은 큐 호출. 실제 service+IPC 테스트 8개, service 6개 통과. 동시 배포·실패 원본 전달·finally 무효화 확인 | ✅ SELF_PASS |
| AC2 / VP-02 | EP-02: TurnExtensions·builder·bootstrap 생성자에서 MCP 필드/인자 제거. builder 5개와 실제 plugin/SDK runtime tool query 소비 테스트 통과 | ✅ SELF_PASS |
| AC3 / VP-03 | EP-03: 값별 missing Set으로 반복 변수의 후속 키도 제외. 정상 값·보고 이름 중복 제거·입력 불변성 확인 | ✅ SELF_PASS |
| AC4 / VP-04 | EP-04: complete/sendMessage의 공통 settings/source/env 조립. `claude.executable-option.test.ts` 6개와 SDK Options 타입 검사 통과 | ✅ SELF_PASS |
| AC5 / VP-05 | EP-05: owner 리스너 등록 뒤 요청 조립 실패에서 잔존 1개를 재현하고 바깥 finally로 회수. 정상 idle 반납·owner 소멸·실행 실패 테스트 통과 | ✅ SELF_PASS |
| AC6 / VP-06 | EP-06: one-shot/pump/teardown이 같은 retireChannel 사용. SessionRuntime 기존 행동 테스트 54개 통과 | ✅ SELF_PASS |
| AC7 / VP-07 | EP-07: bootstrap 보관·shutdown dispose·생성/완료/종료 후 경로. 제목 생성 4개와 bootstrap 배선/종료 테스트 통과 | ✅ SELF_PASS |
| AC8 / VP-08 | EP-08: credential 및 cookie sender의 실제 sendOnce 도달. 네트워크 12개에서 정상 bytes·3xx·선언/누적 초과·선취소·최초/늦은 오류 확인 | ✅ SELF_PASS |
| AC9 / VP-09 | EP-09: 전체 RouterContext를 받던 handler 11개의 공개 인자를 필요한 속성으로 제한. context 계약 타입 검사·실제 IPC callback 테스트 통과 | ✅ SELF_PASS |
| AC10 / VP-10 | EP-10: no-op registry API와 미사용 tool 타입 제거·runtime 대상 타입 rename. registry 8개·pool/supervisor·runtime config/tool 회귀 통과 | ✅ SELF_PASS |
| AC11 / VP-17 | EP-02·08: 소비 없는 MCP 조립 제거와 초과 첫 chunk에서 abort를 직접 확인. 자동완성·세션 로딩·월 집계·모델 목록의 비용 후보를 별도 기록 | ✅ SELF_PASS |

AC 검산: ✅ 11 · ⚠️ 0 · ❌ 0 = 11. 독립 verify의 PASS를 선점하는 표가 아니다.

| 추가 pair | 관측 | 자기결과 |
|---|---|---|
| VP-11 | send 준비 실패 정리, title dispose 뒤 abort 무시 resolve의 DB 쓰기 차단, shutdown 호출 삭제 검출 | SELF_PASS |
| VP-12 | 실제 engine/MCP callback 동시 호출 maxActive=1, 양쪽 네트워크 maxBytes 전달 삭제 검출 | SELF_PASS |
| VP-13 | builder 실제 산출과 plugin 매니페스트·SDK 메모리 MCP 서버의 query 옵션 소비 확인 | SELF_PASS |
| VP-14 | 최소 handler fixture 타입 검사, bootstrap 실제 prototype의 종료·배포 전달 실행 | SELF_PASS |
| VP-15 | 동일 missing 반복 RED→GREEN, 단발/대화 공통 옵션 직접 비교 | SELF_PASS |
| VP-16 | 기존 runtime frame/drain/backlog/구세대·pool/LRU·도구·runtime config 행동 회귀 통과 | SELF_PASS |

유효 pair 검산: VP-01~10·VP-17의 11개 + VP-11~16의 6개 = SELF_PASS 17 / SELF_BLOCKED 0.
강제 지점은 §10 EP-01~10 그대로이며, 추가된 service의 실패 전달은 EP-01의 동시/실패 계약을 구현한다. 새로운 feature 간 import나 production 모듈은 없다.

### 이번 라운드 수정의 잠금

| 구분 | 실제 결함 주입·재현 | 관측 |
|---|---|---|
| 선택 증거 — VP-01·12 | 기존 engine direct deploy 상태에서 신규 IPC/service 테스트 실행 | 행동 실패 7개 RED, 큐 통합 후 GREEN |
| 선택 증거 — VP-07·11 | bootstrap의 `this.titles?.dispose()` 삭제 | bootstrap 테스트 1개 RED |
| 선택 증거 — VP-08·12 | netFetch manual → sendOnce의 maxBytes 전달 삭제 | credential text/binary 2개 RED |
| 선택 증거 — VP-08·12 | BrowserSessionStore → sendOnce의 maxBytes 전달 삭제 | cookie 경로 1개 RED |
| 선택 증거 — VP-09·14 | TypeScript compiler host에서 boot handler Pick을 전체 RouterContext로 확대 | test config의 TS2344 1건 RED. 디스크 원본 불변 |
| 보강 선택 증거 — VP-01·14 | bootstrap wrapper의 deployNow 옵션 전달 삭제 | 실제 prototype+service 테스트 1개 RED |
| 새 배선 oracle — EP-07 | TitleGenerator 생성 시 bootstrap 소유 필드 대입 삭제 | 소유 배선 검사 1개 RED |
| 새 배선 oracle — EP-07 | 이벤트 구독의 titles.maybeStart 호출 제거 | 구독 배선 검사 1개 RED |

잠금 검산: 선택 증거 6 · 인용 변이 0 · 새 배선 oracle 2 = 8행. 일부 행은 여러 pair가 같은 경계를 공유한다.
모든 디스크 변이는 원문 보관 후 finally에서 복원했다. 복원 뒤 bootstrap/network 2파일 15개 통과. 그 밖의 변경은 직접 행동 oracle이며 추가 변이 대상이 아니다.

### Product/UX 파생 검토

- 채팅·권한·MCP·스킬·설정의 공개 IPC와 정상 결과를 유지했다. 추가된 UI 문자열·화면·영속 포맷은 없다.
- 엔진 source 저장 후 배포 실패는 기존처럼 호출자에게 전달하고, 캐시 무효화는 실패 때도 실행한다. MCP/스킬의 기존 경고 후 진행 동작은 유지한다.
- 네트워크 크기 초과는 기존 ResponseTooLargeError를 더 이른 수신 시점에 반환한다. 허용 본문·cookie jar·홉별 정책은 유지한다.
- 종료한 제목 생성은 새 DB/renderer 작업을 하지 않는다. 정상 제목 자동 생성은 양성 테스트로 확인했다.

### 놓친 잠재 문제 + 대응

| 발견 | 대응·관측 | 상태 |
|---|---|---|
| service의 warn/null을 엔진에 그대로 적용하면 실패가 성공으로 보임 | 실제 service/IPC에서 5개 RED 후 호출별 오류 전달로 보완. 영향 3파일 23개 GREEN, 별도 독립 재검토에서 추가 결함 없음 | 해결 |
| 이미 취소된 signal은 request 오류 리스너 등록 전에 반환 | 실제 emitter에서 선취소 오류를 재현. 오류 리스너를 먼저 등록하고 최초/늦은 오류·signal 회수 테스트 추가. 네트워크 12개 GREEN | 해결 |
| Electron IncomingMessage의 end-before-data 등록 요구 | 설치된 electron.d.ts의 요구에 맞춰 등록 순서 정정. 실제 Electron 장애를 실측한 것으로 보고하지 않음 | 코드 정렬 |
| 대형 listing·세션 payload·월 원장·모델 기여 목록의 비용 증가 | [진단 보고서 §4](../../etc/study/main-structure/diagnosis.md#4-후속-측정-후보--이번에는-변경하지-않음)에 실제 경로·입력량·최소 개선·회귀 조건 기록 | 측정 후보 |
| 현재 Claude 모델 해석이 미래 adapter에도 통용될지 미정 | 새 adapter 구현 시 해당 경계를 검토. 사용하지 않는 모델/실행 registry를 미리 만들지 않음 | 후속 범위 |

PLAN_GAP·신규 제품 결정·신규 의존성은 없다. SRT·cowork·OpenCode의 실제 종단 호환성은 미검증이며 이번 구현의 완료 기준에 포함하지 않았다.

### 구현 보고

| 게이트 | 관측 결과 |
|---|---|
| 변경 전 Main 기준선 | Electron Node 모드·시험 전용 USERPROFILE에서 188파일 2,052개 통과, 실패/skip 0 |
| 변경 후 Main 전체 | 같은 실행 환경에서 193파일 2,093개 통과, 실패/skip 0, 프로세스 exit 0 |
| 기준선 대비 테스트 집합 | 파일+fullName 차집합: 삭제는 폐기한 registry idle no-op 검사 1개뿐. 추가 42개 |
| 타입 | `npm run typecheck`: node/web/test 3구성 진단 0. 추가 bootstrap 테스트 이후 test config 재검사도 진단 0 |
| lint | `node node_modules/eslint/bin/eslint.js src/main src/shared`: error 0 / warning 0. 마지막 테스트·주석 변경 파일 재검사도 0/0, autofix 없음 |
| 문서 | `node scripts/check-doc-inventory.mjs --check`: generated/prose/상대링크 검사 통과 |
| diff | `git diff --check`: 공백 오류 0 |
| 독립 검토 | 담당 범위를 바꾼 별도 에이전트가 adapter/확장, 수명주기, 네트워크, 배포 큐를 검토. 위 오류 전달·선취소 결함을 보완한 뒤 추가 재현 결함 없음 |

실행 방법: `app`에서 설치된 `node_modules/electron/dist/electron.exe`를 자식 프로세스로 실행하며 `ELECTRON_RUN_AS_NODE=1`, `USERPROFILE=<app>/node_modules/.cache/orca/main-structure-check/home`을 해당 자식에게만 전달했다. 인자는 `node_modules/vitest/vitest.mjs run src/main --maxWorkers=2 --reporter=json`이다. SQLite ABI 140을 그대로 사용했고 npm rebuild·의존성 설치는 하지 않았다.

환경 기록: 최초 plain Node 실행은 SQLite ABI 127/140 불일치와 실제 profile 파일 권한 오류로 실패했다. 동일 코드를 위 환경에서 재실행해 기준선을 확보했다. Electron fork 종료 경고는 기준선 10건/최종 96건 관측했으나 두 실행 모두 테스트 실패 0·exit 0이었다. 이것을 앱 성능 저하 또는 성능 개선 수치로 해석하지 않는다. 실제 GUI·사내망·대형 입력 벤치마크는 시행하지 않았다.

변경 규모는 기존 모듈 안에서 제한했다. 새 production 파일·계층·의존성·IPC·DB 스키마 추가 없음. 테스트와 문서의 증가를 production 구조의 비대화로 혼합해 세지 않았다.

### Review Signals

- 현재 라운드: r1. 외부 verify FAIL을 재구현한 작업이 아니다.
- D-03은 실패 의미 보존을 요구했지만 초기 service 연결이 하위의 오류 흡수를 놓쳤다. 실제 큐/IPC 경로의 실패 테스트를 reject oracle로 정정했다.
- EP-08에서 기존 선취소 분기와 오류 리스너 등록 순서가 누락되어 있었다. 독립 재현 후 같은 요청 소유자 안에서 수정했다.
- 반복 환경 한계는 SQLite ABI와 Electron fork 종료 경고다. 프로덕션 코드를 우회하거나 실패 테스트를 skip하여 통과시키지 않았다.
- 구현 자기판정과 독립 handoff verify 판정은 구분한다. INDEX는 구현 완료 후 검증자에게 넘긴다.

## [구현자 기입] r2 — ΔV1 책임 재편

### 설계 리뷰

사용자 정정 D-07에 맞춰 국소 오류 보완에서 기존 Main의 책임·모듈 경계 리팩토링으로 범위를 바로잡았다. r1 결과는 유지했다. 함께 변경되는 제출·해석·설정·모델·사용량·이력·MCP의 코드를 각 소유자에 모으고, 호출 전달만 하던 모듈을 제거했다.

[진단 보고서](../../etc/study/main-structure/diagnosis.md) §2 r2에 before/after와 유지한 경계를 기록했다. auth·runtime/pool·admission·continuation·권한·Git root·HTTP header 정책처럼 의미가 다른 경계는 합치지 않았다. 신규 의존성·실행 플랫폼·공개 IPC·DB 스키마·UI 변경은 없다.

### 강제 지점 전수와 V-pair 자기확인

| AC / pair | §10 전수 경로와 관측 | 자기결과 |
|---|---|---|
| AC12 / DP-01·08·12 | EP-11: send의 신규/busy 입력→enqueue, index 취소와 turn-request submitted 소비까지 이동. 공통 payload·queued 이벤트의 요구사항·첨부·ID·시각 보존. 실제 busy send/held/listen과 기존 신규 큐 사례 통과 | SELF_PASS |
| AC13 / DP-02·08 | EP-12: provider/env 생산 함수와 private helper를 resolve-turn으로 이설. send·resolve-turn의 실행 구성 주입, respawn·continuation·활성 getter 유지. 해석과 발신이 분리되고 삭제 모듈 import 없음 | SELF_PASS |
| AC14 / DP-03·09 | EP-13·14: settings 소스 열거·mtime/list 캐시·invalidate·파일 부재/손상 정책 유지. 기본 provider 선택은 models, bootstrap은 settings 서비스를 직접 주입. 실제 settings→runtime resolve와 parser 사례 통과 | SELF_PASS |
| AC15 / DP-04·10·14 | EP-15·16: 사용량 SQL의 생산·소비를 db.usage로 전환. tracker가 telemetry 원장/모델행·집계·방송을 소유. 실제 동일 연결 rollback, 빈 컨텍스트·messageId·실패 전파 및 bootstrap 순서 통과 | SELF_PASS |
| AC16 / DP-05·10·14 | EP-17: reader가 parts·usage·비용·lineage·worktree·cwd를 복원, handler가 유효 입력/현재 activity를 결합. 실제 SQLite→reader→IPC callback 정상/빈 세션·미완료/정렬 사례 통과 | SELF_PASS |
| AC17 / DP-06·11 | EP-18: convert가 target 구성까지 수행. stdio/http/sse·빈 입력·복수/반복 변수·입력 불변·서버별 제외와 정확한 이유 검증. 실제 bootstrap→converter→배포 큐의 deploy 인자까지 확인 | SELF_PASS |
| AC18 / DP-07·13 | EP-14: canonical 선언 key는 catalog 생성 시 한 번 구성. cache가 비어 있어도 소유권 유지. settings alias 폴백/runtime 빈 목록 구분과 최종 기본 모델 유지 | SELF_PASS |

ΔV1 검산: AC12~18은 SELF_PASS 7개, DP-01~14는 SELF_PASS 14개다. V1의 AC1~11/VP-01~17은 이번 Main 전체 실행의 상속 회귀 대상으로 유지한다. 이는 구현 자기검증이며 독립 handoff verify의 PASS가 아니다.

전수 검색은 소유 불변식을 기준으로 수행했다. `message.queued|message.submitted|pendingMessages.enqueue|checkBusyReservation`으로 제출·발신, `PreparedHarnessConfig|prepareHarnessConfig|resolveTurnProvider`로 실행 입력, `insertTurnUsage|insertTurnModelUsage|getLatestTurnUsage|sumSessionCostUsd|recordTurnUsage`로 원장 생산·소비, `loadParts|partFromRow|sessionLoad`로 복원, `toClaudeConfig|mcpConfig`로 배포 도달을 확인했다. 삭제 경로 import·현재 문서 참조도 검색했다. 대상은 `app/src/main`, `app/src/shared`, `docs/arch`이며 과거 handoff 증거의 옛 경로는 이력으로 남겼다.

### 이번 라운드 수정의 잠금

| 선택 증거 / oracle | 실제 재현 | 결과 |
|---|---|---|
| EP-11 busy 직접 호출 삭제 | 실제 handleChatSend의 busy 분기에서 예약 호출 제거 | 실제 큐와 listen 결과 1개 RED |
| 공통 requirements 전달 삭제 | enqueue의 공유 payload에서 requirements spread 제거 | 신규·busy·실제 send·기존 carrier guard 4개 RED |
| 실행 env 주입 호출 삭제 | resolve-turn의 실제 injector 호출 두 곳을 각각 제거 | 각 guard 1개 RED. 옛 turn-setup 위치에서 옮긴 잠금 유지 |
| EP-16 tracker 기록 호출 삭제 | bootstrap의 telemetry callback에서 recordTurnUsage 제거 | 실제 순서/실패 전파 2개 RED |
| 새 구독 등록 연결 삭제 | Bootstrap.register의 registerTurnEvents 호출 제거 | 실제 진입의 등록 배선 guard 1개 RED |
| EP-18 변환 결과 전달 우회 | bootstrap의 mcpConfig 인자를 미확장 소스로 변경 | 실제 deploy 인자 oracle 1개 RED |

모든 디스크 변이는 원문 보관과 finally 복원 후 영향 테스트를 재실행했다. 모델의 선언 getter 관측은 변경 전 반복 읽기 RED, 변경 후 생성 시 한 번 GREEN이다. settings/runtime parser의 서로 다른 빈 목록 정책도 기존 테스트와 직접 runtime 진입 테스트로 잠갔다.

### Product/UX 파생 검토

- 신규·busy·취소·continuation 입력의 wire·첨부·요구사항·승인·listen 정책을 유지했다. 동기 admission과 큐 적재 사이 await를 추가하지 않았다.
- DB 읽기·기록·집계는 동기이며 같은 연결과 transaction을 쓴다. 사용량→history→title→relay의 순서와 critical 실패 전파는 Bootstrap 안의 한 등록 메서드가 계속 소유한다.
- 캐시 무효화·기본 모델·빈 목록 의미, MCP 미해결 서버 전체 제외를 유지했다. 새 페이지 로딩·상주 캐시·배경 서비스는 없다.
- 기존 MCP 배포는 확장한 설정을 plugin의 `.mcp.json`으로 렌더한다. 현재 security 문서 일부가 이를 “평문 파일 없음”으로 서술해 실제 bootstrap/deployer 경로에 맞게 정정했다. 이번 리팩토링으로 비밀 저장 정책을 바꾼 것은 아니다.

### 놓친 잠재 문제 + 대응

| 관측 | 대응·판정 |
|---|---|
| r1의 국소 보완을 구조 리팩토링 완료로 설명한 범위 불일치 | 사용자 D-07을 ΔV1에 반영해 별도 설계 커밋 후 책임 재편 구현 |
| 좁힌 settings 입력을 테스트 fixture가 models 속성으로 보정 | fixture의 불필요한 속성 제거. 공개 계약/기능 변경 없음 |
| MCP 기존 테스트가 입력 불변과 정확한 다중 누락 사유를 직접 확인하지 않음 | frozen env/header·반복 변수·정상 이웃 보존 oracle 보강 |
| 새 bootstrap 테스트의 타입 표기 누락 | 명시 반환 타입 보완 후 test 타입/lint 재검사 |
| 성능 후보를 추론만으로 과도하게 바꿀 위험 | 모델의 반복 정규화만 줄이고 대형 세션·자동완성·월 집계는 실제 비용과 측정 조건을 보고서에 기록. 새 최적화 플랫폼을 만들지 않음 |

PLAN_GAP·추가 제품 결정은 없다. 미래 SRT·cowork·OpenCode의 종단 실행 호환성 검증은 해당 기능을 실제 도입하는 후속 범위다.

### 구현 보고

- 책임 이동 영향 시험: 채팅 64개, harnesses 113개, 사용량/DB/reader/DTO 118개, MCP/vars 28개, bootstrap 6개 통과. 파일·사례가 일부 겹치므로 이를 더해 전체 시험 수로 쓰지 않는다.
- SQL 대조: 이동 SQL과 eager/lazy 준비 정책, 원래 생성자 내 준비 순서가 동일하다. 독립 검토에서 이동 메서드·SQL·tracker 기록·DTO 본문도 receiver 변경 외 동일함을 확인했다.
- 독립 행동 비교: settings parser 350개/runtime parser 70개 입력에 대해 기준 구현과 결과·입력 불변성이 동일했다. 실사용 성능 벤치마크로 해석하지 않는다.
| 통합 게이트 | 결과 |
|---|---|
| r2 Main 전체 | Electron Node·시험 USERPROFILE: 193파일 2,116개 통과, 실패/skip 0, exit 0 |
| V1 상속 회귀 | VP-01~17 관련 기존 Main 테스트 전부 재실행. V1+ΔV1 자기검산 AC 18/18, pair 31/31 SELF_PASS |
| 이전 시험 대조 | r1 2,093개 대비 순증 23개. 파일 이동을 반영한 case 대조에서 남은 차이는 carrier guard 제목 변경과 private hasContextTokens의 두 직접 검사를 실제 tracker 기록·방송 검사로 대체한 것이다. 원래 보호 동작은 유지 |
| 타입 | npm run typecheck의 node/web/test 전부 진단 0. 마지막 테스트의 반환 타입 표기 후 test config 재검사 |
| lint | Main/shared 전체 검사에서 새 bootstrap 테스트 표기 누락만 발견. 해당 파일 정정 후 error 0 / warning 0 |
| 문서·시간 예산 | doc inventory/generated/prose/상대링크 검사, 실제 git 시험 budget 검사 통과 |
| diff | git diff --check 통과 |

원래 SQLite ABI 140을 유지한 Electron Node 실행이며 설치/rebuild는 하지 않았다. r2 실행에 Vitest fork 종료 timeout 경고 39건이 있었으나 시험 실패는 없고 프로세스도 정상 종료했다. r1에도 있던 실행 환경 관측이며, 앱의 처리 속도나 회귀 수치로 해석하지 않는다. 실제 GUI·사내망·대형 입력 성능 측정은 수행하지 않았다.

### Review Signals

r2의 원인은 사용자 요구 범위를 r1에서 좁게 해석한 것이다. 이를 단순 설명 수정으로 닫지 않고 책임/모듈 재편과 실제 경로 oracle을 추가했다. independent reviewer를 구현 영역과 바꿔 채팅/설정, 사용량/이력, MCP/Bootstrap을 검토했다. 재현된 생산 회귀는 없었고 부족한 oracle과 fixture/type 표기를 보완했다. 기존 동작 보존과 미래 기능의 실제 호환성 보장은 구분한다.
