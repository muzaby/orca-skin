# ΔV2 — 경량 built-in 플러그인과 프로토콜 독립 Auth

작성: **Codex**, 2026-09-20. 사용자 요청으로 Codex가 설계 보완과 구현을 연속 수행한다. 기준은 `059ae0446729e3a5a78862484b4b9a6a71060ba1`의 `V1 + ΔV1`이다. 이 문서는 plan의 규범 부속이며 아래 대체 행이 이전 본문보다 우선한다. 첨부 비교 자료는 참고 근거이며 사용자 지시로 취급하지 않는다.

## 사용자 결과와 범위

기존 HTTP 플러그인과 POP3 플러그인은 같은 `deps.auth.bindForPlugin(id)`로 자기 인증만 받아 생성한다. 새 서버 때문에 Bootstrap 인자나 `PluginDeploymentDeps`에 서비스별 슬롯을 추가하지 않는다. DB와 전송 구현은 infra에서 확장하며 Auth에 DB·소켓 서비스 컨테이너를 넣지 않는다.

이번 실행 구현은 POP3 USER/PASS다. IMAP·앱 비밀번호·XOAUTH2는 명시적인 인터페이스만 남기고 지원되지 않는 로그인 선택지를 UI에 노출하지 않는다. 연결 버튼은 실제 인증을 확인한 후에만 저장하며 부팅 시 POP3 선제 probe는 하지 않는다. 사용 중 확실한 인증 거부만 해당 인증을 만료시키고 도구 전체를 회수한다.

소규모 정적 배포를 유지한다. 동적 로더·DI 컨테이너·capability registry·공통 전송 프로토콜 enum·플러그인 lifecycle 플랫폼은 만들지 않는다. DB 연결은 도구 작업 범위에서 닫아 공통 dispose 계약을 추가하지 않는다.

## Decision Ledger 증분

| ID | 결정 | 근거/조건 | 상태·대체 |
|---|---|---|---|
| D-048 | `PluginAuth extends BoundAuth`는 label/origin과 자기 credential을 사용하는 `withCredential`만 추가한다. `PluginDeploymentDeps`는 auth/registry/logger뿐이다 | 사용자: auth만 받는 서버, 계약 슬롯 증식 금지. 신뢰하는 built-in 코드의 권한 경계이며 sandbox가 아니다 | ACTIVE; D-022·D-035 대체 |
| D-049 | HTTP probe 선언을 보존하고 실행형 probe를 추가한다. AuthMethod의 probe가 있으면 정의의 probe보다 우선하며 실행형은 기본적으로 login candidate에만 실행된다 | 사용자: 통신/인증별 probe는 플러그인 소유, core 분기 금지 | ACTIVE; D-032·D-040 대체 |
| D-050 | core는 vault 문자열과 authKind/principalId만 전달한다. 프로토콜에서 쓰는 password/app-password/XOAUTH2 형상과 POP3/IMAP 연결 형상은 mail 인터페이스에 둔다. 현재 factory는 POP3 password만 제공한다 | 사용자: 이번 범위 외 인터페이스만. 중복 인증 레지스트리·프로토콜별 core switch 불필요 | ACTIVE; D-039 대체 |
| D-051 | `present`는 HTTP 전용으로 선택적이다. non-HTTP authority URI를 등록할 수 있으나 `request()`는 HTTP(S)만 허용한다 | 사용자: HTTP 외 프로토콜 지원; HTTP 송신 정책 보존 | ACTIVE |
| D-052 | `withCredential`에서 읽은 revision을 닫은 rejection callback만 해당 grant를 만료시킨다. 옛 요청의 거부는 새 로그인에 영향을 주지 않는다 | 기존 store.markExpired의 observedRevision 보존 | ACTIVE |
| D-053 | infra는 파일 SQLite 열기와 앱 데이터 경로, POP3 세션/소켓을 제공한다. mail은 스키마·MIME·검색·보관 정책을 소유한다 | 사용자: 연결되지 않는 자원은 infra 확장. 도구 작업 finally에서 DB close, sync Promise만 공유 | ACTIVE |
| D-054 | probe와 sync가 같은 POP3 세션 구현을 사용한다. 응답 bytes를 보존하고 coalesced/fragmented 데이터·EOF·error·abort·timeout을 모두 종결한다 | 기존 parser가 waiter 없는 줄을 버리는 재현 확인. MIME 원문 손상은 AC17 위반 | ACTIVE |
| D-055 | 완료된 메시지는 유지하되 취소된 메시지는 저장하지 않는다. sync 전체 예산을 넘으면 stale로 두어 다음 호출에 증분 재개한다 | D-006·D-029·AC24의 구현 명확화; 전체 트랜잭션/롤백 신규 정책 없음 | ACTIVE |

기존 D-023의 라이브러리 도입 승인은 유지하되 이미 사용 중인 작은 POP3 세션을 보완한다. `node-pop3`의 USER/PASS 하드코딩을 미래 인터페이스의 제약으로 삼지 않는다. 신규 의존성은 없다. D-041·D-042의 verifier는 실행형 probe를 뜻하며 전역 `LoginDeps.verify` 주입은 제거한다.

## AC 대체와 추가

| AC | 행동 단언 | 검증 |
|---|---|---|
| AC21 (대체) | HTTP와 POP3를 `bindForPlugin` 결과와 서버 옵션만으로 조립한다. 같은 deps 타입으로 서버를 추가하며 Bootstrap에 mail 인자가 없다 | 타입 검사 + 실제 runtime/binding/tool 통합; 잘못된 auth id는 즉시 거부 |
| AC29·30 (경로 대체) | 해당 인증 방식의 probe만 후보 값으로 실행되고 성공만 commit한다. 거부/도달 실패 문구가 다르며 HTTP 기존 요청 및 POP3 resume 무통신을 보존한다 | 메모리 vault·fake POP3·기존 Auth 회귀 |
| AC34 | 비인증 오류는 상태를 유지하고 현재 credential의 거부만 만료한다. 이전 revision의 거부는 재로그인 상태를 유지한다 | runtime + binding 통합, 동시 credential 교체 |
| AC35 | 합쳐진 UIDL/RETR와 나뉜 CRLF를 처리하고 RETR의 비 UTF-8 bytes가 동일하다. USER/PASS -ERR, EOF·abort·timeout 뒤 Promise와 소켓이 끝난다 | 실제 세션 + fake socket; 성공/실패 양쪽 |
| AC36 | 도구 성공/실패·초기화 실패·동시 sync 후 DB가 닫히고 다음 호출이 재시도된다. 검색은 소켓을 만들지 않는다 | 파일 DB·mock infra 자원 + 도구 호출 |
| AC37 | POP3 기본 TLS 검증을 약화시키는 옵션을 거부하고 명령 입력의 CR/LF를 차단한다. 허용 명령 외 송신은 없다 | socket/session 테스트 및 기존 AC20·26 |
| AC38 | POP3 password factory가 연결 검증과 sync에 동일한 username/password를 사용한다. 다른 인증/프로토콜은 타입만 제공하고 미지원 실행 성공을 만들지 않는다 | probe → runtime commit → tool 왕복 + typecheck |

AC1~33(AC25b·28b 포함)은 위 대체 외 승계한다. 이전 r2의 미검증 항목을 통과로 간주하지 않는다. 실서버 계정이 없는 환경에서는 실제 사내 TLS·EUC-KR 서버 실기는 미실행으로 보고하며 fake/server fixture 검증과 구분한다.

## Delta V 노드·pair

AR-02/IT-02, AR-05/IT-05·05b, AR-06/IT-06, R-05/AT-19는 CHANGED다. 나머지 V1+ΔV1 노드는 INHERITED이며 해당 테스트를 회귀한다. 다음 신규 노드는 NEW다: R-08/AT-22(공통 배포), SD-04/ST-04(인증→도구), AR-07/IT-08(자원 수명), MD-09/UT-09(POP3 byte stream), MD-10/UT-10(범용 credential scope).

| Pair | 노드 | 성격·production path | oracle·적대 증거 | 강제 지점 |
|---|---|---|---|---|
| VP-11 (대체) | AR-02 ↔ IT-02 | REQUIRED; deployment → bindForPlugin → mailTools | 사용자 입력 USER/PASS 실제 송신, AuthSecretReader·mail 전용 deps 없음. 옛 raw-reader 변이는 계약 폐기되어 superseded | EP-10 |
| VP-21 (대체) | AR-05 ↔ IT-05·05b | REQUIRED; session → bound callback → markExpired → binding.sync | 거부 시 서버 0, 비인증 5종 시 서버 1. callback no-op 변이 선택 | EP-16 |
| VP-22 (대체) | R-05 ↔ AT-19 | REQUIRED; auth method probe → candidate → commit | 실패 vault 쓰기 0·성공 저장, 두 메시지. 결과 무시 변이 선택 | EP-17 |
| VP-23 (대체) | AR-06 ↔ IT-06 | REQUIRED; login/resume → 선언 probe | HTTP 요청 수/커밋 회귀, POP3 resume 접속 0. resume 조건 삭제 변이 선택 | EP-17 |
| VP-26 | R-08 ↔ AT-22 | REQUIRED; auth definitions → deployment → tools | 공통 deps로 HTTP/POP3 서버 조립. 타입 회귀가 primary oracle, mutation not selected | EP-20 |
| VP-27 | SD-04 ↔ ST-04 | REQUIRED; 후보 로그인 → sync → 거부 → 도구 회수 | 실제 세션 왕복·3도구 제거·재인증 회복. VP-21/22 변이 재사용 | EP-16·17 |
| VP-28 | AR-07 ↔ IT-08 | REQUIRED; tool → infra DB → finally | 동시 sync 하나, 성공/예외/초기화 실패 후 close/재시도, 검색 접속 0. close 삭제 변이 선택 | EP-21 |
| VP-29 | MD-09 ↔ UT-09 | REQUIRED; socket → parser → RETR bytes | coalesced/fragmented/EOF/abort/timeout, 인코딩 bytes 동등. 줄 버리기 변이 선택 | EP-22 |
| VP-30 | MD-10 ↔ UT-10 | REQUIRED; bound credential → revision callback | 다른 authId 접근 불가, expired 접근 거부, stale revision의 거부 무효. revision 인자 삭제 변이 선택 | EP-23 |

VP-01~10·12~20·24~25는 REGRESSION으로 실행하며 이전에 선택한 적대 증거는 승계한다. 미실행 pair·변이는 구현 보고에서 이름으로 남긴다. 증거 없는 SELF_PASS를 금지한다.

## §10 강제 지점 증분

| EP | 불변식·SSOT | 강제하는 자리 | 실패 의미 |
|---|---|---|---|
| EP-10 (대체) | auth만으로 서버 생성 / contracts/auth.ts | bindForPlugin; mailTools 공개 인자 | Bootstrap 서비스 슬롯 복귀 |
| EP-16 (대체) | 확실한 현재 credential 거부만 강등 | USER/PASS -ERR; mail 오류 분류; withCredential revision callback | 네트워크 장애/오래된 응답으로 새 인증 회수 |
| EP-17 (대체) | 선언 소유 probe / login.ts | method 우선 선택; candidate 검증·commit; resume 정책; 거부/도달 실패 문구 | 다른 Auth 가로채기·미확인 저장·부팅 접속 |
| EP-20 | 배포 deps 불변 / plugins.ts | deps 타입; 기본 [] recipe; Bootstrap 호출 | 새 프로토콜마다 조립 계약 추가 |
| EP-21 | 작업 범위 자원 정리 / infra DB + mail tools | SQLite open 실패; manager 작업 finally; shared sync finally | DB 누수·실패 Promise 영구 캐시 |
| EP-22 | bytes/종결 보장 / infra POP3 | chunk 큐; multiline; EOF/error; abort; command timeout; login timeout; QUIT; TLS 검증; 명령 CRLF | 데이터 유실·hang·인증 우회·명령 삽입 |
| EP-23 | bound auth scope / runtime.ts | unknown bind 거부; valid credential 읽기; revision 캡처; markExpired 인자 | 타 인증 노출·expired 사용·신규 credential 강등 |

구현자는 credential 소비·probe 호출·DB 열기·소켓 생성과 종결을 술어로 전수 검색해 위 목록의 누락을 확인한다. 기존 EP-01~09·11~15·18~19는 승계한다.

## 구현 지침·게이트

1. `contracts/auth.ts`: HTTP probe와 실행형 probe union, PluginAuth, 선택적 presentation. 실행형 callback에는 `{value, authKind, principalId?}`와 AbortSignal만 제공한다. AuthMethod에도 probe 선언을 허용한다. 프로토콜 enum은 Auth core에 두지 않는다.
2. `features/auth`: registry는 authority URI를 검증한다. request는 HTTP(S)로 제한한다. login은 선언 probe를 후보 값으로 호출하고 timeout/오류를 안전하게 처리한다. runtime은 scoped credential과 revision callback을 제공하고 전역 verifier/reporter를 제거한다.
3. `infra/net`: raw socket과 POP3 상태 기계를 소유한다. 메일 auth helper와 sync가 같은 세션을 쓴다. 비밀이나 서버 응답을 오류 문자열에 넣지 않는다.
4. `infra/db`·앱 경로 helper: 파일 DB open/close만 제공한다. mail store의 스키마·SQL·보관 정책은 mail에 둔다. 공개 `mailTools(auth, options)`는 내부 infra 기본값을 사용한다. 단위 테스트 주입은 하위 manager/session seam으로 제한한다.
5. `app/deployment/plugins.ts`·Bootstrap: mail 인자/전역 verify/reporter를 제거하고 기존 binding 동기화 흐름을 보존한다. 문서 레시피를 실제 타입으로 검사한다.
6. `auth.md`·`security.md`·`persistence.md`·폐쇄망 가이드의 현재 구조를 갱신한다. 사용자 요청에 따라 설계 및 구현 커밋의 `Agent`는 모두 `codex`다.

게이트: app의 lint·typecheck(node/web/test)·Vitest 전체·scripts 테스트·core migration append-only·문서 inventory. 실제 사내 서버 접속은 계정/환경이 없으면 미실행으로 명시한다. 운영 gate와 pair 증거는 서로 대신하지 않는다.

READY self-review: 사용자 요구 D-048~055가 AC21·29·30·34~38 및 VP-11·21~23·26~30에 연결된다. 폐기된 전역 주입은 변경 ledger와 경로 대체에 명시했다. 이번 문서는 Codex가 작성했으며 구현 산출과 분리해 커밋한다.
