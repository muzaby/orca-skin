# Plan — Main 책임·수명주기·실행 경계 단순화

## 메타

| 항목 | 값 |
|---|---|
| 작성자 | Codex — 사용자 진단·개선 요청 수행 |
| 일자 | 2026-09-08 |
| 상태 | READY |
| 기준 코드 | `054ede9b` |
| V mode / 기준 V / revision | Baseline V / none / V1 |
| 유효 V | V1 |

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

## [구현자 기입]

구현 전. 완료/미충족 pair와 gate, 구조 변화·실행 결과·추가 발견을 여기에 기록한다.
