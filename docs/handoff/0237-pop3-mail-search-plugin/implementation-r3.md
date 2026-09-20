# [구현자 기입] r3 — 경량 Plugin Auth와 POP3

작성: **Codex**, 2026-09-20. 사용자 지시에 따라 Codex가 `handoff-plan`으로 ΔV2를 보완하고 `handoff-impl`로 구현했다. 기준은 [plan](plan.md)의 `V1 + ΔV1 + ΔV2`이며, 규범 정정은 구현과 별도 커밋이다. 아래 결과는 구현자 자기확인이고 독립 verify 판정이 아니다.

## 설계 리뷰

**구현 완료, 독립 검증 대기.** 문제의 원인은 HTTP 요청에 묶인 Auth와 서비스별 bootstrap 주입이었다. POP3 전용 deployment 인자를 제거하고 `bindForPlugin(id)`가 자기 인증 값·revision에 한정된 거부 콜백을 제공하게 했다. HTTP 소비자는 기존 `request()`를 사용한다.

`AuthDefinition`/`AuthMethod`의 실행형 probe를 로그인 후보 검증에 연결했다. 프로토콜과 인증 방법의 처리는 플러그인이 소유하며 Auth core에는 메일 분기를 추가하지 않았다. HTTP presentation은 선택적이지만 `request()` 자체는 HTTP(S)로 제한한다. 실행형 probe 확장에 따른 gate 복원 검증 누락은 ΔV2 규범 정정 후 fail-closed로 보완했다.

DB·앱 경로·소켓은 infra를 사용한다. 도구 작업마다 DB를 열고 `finally`에서 닫으며, 동시 sync Promise만 공유한다. 공통 lifecycle·DI 컨테이너·서비스별 deployment 슬롯은 추가하지 않았다. POP3 USER/PASS만 실행 지원하고 IMAP·앱 비밀번호·XOAUTH2는 타입으로 남겼다. 사용하지 않는 `node-pop3` 의존성을 제거했으며 신규 의존성은 없다.

## 강제 지점 전수와 V-pair 자기확인

아래 경로의 `mail/`은 `app/src/main/features/plugins/mail/`, `auth/`는 `app/src/main/features/auth/`다. 테스트 경로는 저장소에서 재현 가능하며 원시 실행 로그는 로컬 `.tmp/pop3-*`에 남겼다.

전수 조사 술어: `withCredential|markExpired|probe.execute|method.probe|definition.probe`, `cleanupExpired|DELETE FROM mail|features/scheduler`, `openFileDatabase|createPop3Socket|destroy|quit|inFlight`, `createPluginBindings|plugin.sync`. 프로덕션 파일과 테스트를 구분해 읽었다. 소켓 음성 가드는 runtime import를 대상으로 하며 `import type { TlsOptions }`는 소켓 생성으로 세지 않는다.

| EP | 확인 지점 | 관측 근거 |
|---|---|---|
| 01 | 4/4 — 검색·첨부·오류·sync 구조화 결과 | integration 내부 경로 변이 3종, pure 오류 변이, manifest 키 단언 |
| 02 | 2/2 — manager 검색·도구 배선 | 소켓이 throw하도록 설정한 검색 입력 6종 모두 정상, lifecycle의 sync 호출 0 |
| 03 | 4/4 — 본문·FTS·파일·삭제 진입점 | store retention 테스트의 행/검색어/파일 단언, `DELETE FROM mail`은 cleanup 한 곳, missing 유지 |
| 04 | 2/2 — tokenizer·질의 길이 | store 한국어 검색과 pure 길이 분기, unicode61 변이 검출 |
| 05 | 3/3 — 초기 sync·change sync·인증 오류 | bootstrap의 두 `plugin.sync()` 경로, binding 회귀, 실제 USER/PASS 거부 |
| 06 | 2/2 — freshness·공유 sync | 299초 미접속/301초 증분, 동시 호출 결과 동일 |
| 07 | 3/3 — 연결·명령·abort 실패 | 비인증 5종 캐시 시각 유지, RETR 취소/예산 초과, persist 직전 취소 |
| 08 | 1/1 — 도구 진입 | 동시 3호출 접속 1회, lifecycle manager 생성 1회 |
| 09 | 2/2 — import 경계·실제 TLS 연결 | native-boundary 및 로컬 TLS 서버 왕복 |
| 10 | 2/2 — bound Auth·mailTools 인자 | HTTP/POP3 동일 deps 타입 조립, 실제 USER/PASS 동일성 |
| 11 | 2/2 — migration 목록·raw 집합 | core/mail CLI 출력, 격리 git fixture의 기존 mail SQL 수정 거부 |
| 12 | 3/3 — 도구별 annotations | `[false,true,false]` 및 sync/search 자리 맞바꿈 검출 |
| 13 | 2/2 — reconcile·보호 판정 | ledger 19/20, 비율 .49/.50의 실제 RETR 호출 차이 |
| 14 | 1/1 — 검색 문서 조립 | From/To/Cc/Subject/Body 각각 누락 변이 5종 검출 |
| 15 | 1/1 — 명령 gate | 허용 명령 실제 송신, DELE 추가 변이 검출 |
| 16 | 3/3 — 명령 거부·분류·revision 콜백 | 거부 후 registry 0, 비인증 5종 registry 1, 이전 revision 거부 무효 |
| 17 | 5/5 — method 선택·candidate commit·resume·문구·gate | plugin-auth 및 기존 login/runtime 회귀, resume/gate/문구 변이 검출 |
| 18 | 1/1 — 첨부 입력 | 두 id 필수 및 각각 optional 변이 검출 |
| 19 | 3/3 — 회복·확인/리셋·ingest | 순수 전이와 실제 반복 sync의 baseline 유지/RETR 재개 |
| 20 | 3/3 — deps·기본 recipe·bootstrap | auth/registry/logger만 선언, 기본 빈 배열, 서비스별 주입 제거 |
| 21 | 3/3 — open 실패·작업 finally·공유 finally | file-database/lifecycle 초기화 실패 close 및 재시도 |
| 22 | 9/9 — 큐·multiline·EOF/error·abort·명령/로그인 timeout·QUIT·TLS·CRLF | pop3-session 40케이스, socket 및 TLS 테스트 |
| 23 | 4/4 — unknown·valid·revision 캡처·만료 인자 | plugin-auth unknown/expired/재인증 경합 및 revision 삭제 변이 |

표 분모는 유효 §10의 23군·65지점이다. 이전 r2의 전역 verifier/reporter와 raw-reader closure 경로는 ΔV2가 대체했으며 현재 전수에 중복 계산하지 않았다.

| Pair | 자기상태 | 이번 실행 증거 |
|---|---|---|
| VP-01·07·18 | SELF_PASS | integration freshness/증분/왕복, pure 5분 경계 |
| VP-02 | SELF_PASS | 비인증 5종 뒤 캐시 유지, throw 소켓의 검색 6입력 |
| VP-03·15 | SELF_PASS | store 14일 경계, 본문/FTS/첨부 정리와 orphan 회수 |
| VP-04·19 | SELF_PASS | 세 첨부 왕복·원본 bytes/mtime 유지·Temp 경로, 파일명 정규화 |
| VP-05·21·27 | SELF_PASS | 실제 인증 거부 후 서버 회수·재인증 복원, 비인증 상태 유지 |
| VP-06·16·17 | SELF_PASS | 한국어 2/3글자 검색, 5필드 정규화, EUC-KR fixture 색인 |
| VP-08·09 | SELF_PASS | RETR/persist 취소·sync 예산, 동시 3호출 공유 |
| VP-10·20·29 | SELF_PASS | 실제 TLS 및 명령 송신, byte 동일성·fragment/coalesce·종결 |
| VP-11·26 | SELF_PASS | HTTP/POP3 동일 deps recipe, password 공백/콜론 보존 왕복 |
| VP-12 | SELF_PASS | migration CLI core/mail 동기화 및 append-only 거부 |
| VP-13·24 | SELF_PASS | descriptor annotations·필수 id, manifest → 첨부 3회 |
| VP-14·25 | SELF_PASS | RETR로 본 보호 경계, fingerprint 변경·확인·회복 |
| VP-22·23 | SELF_PASS | 후보 probe 실패 무저장·문구 구분·method 우선·복원 무접속·gate |
| VP-28·30 | SELF_PASS | DB 수명/재시도, bound credential 및 stale rejection |

자기확인 pair: 30 SELF_PASS. 독립 검증과 사내 서버 실기는 포함하지 않는다.

## 이번 라운드 수정의 잠금

아래 각 변이는 원본을 복구한 뒤 다음 변이를 실행했다. `검출`은 대상 테스트 실패 또는 production migration CLI의 명시적 오류를 뜻한다. 타입 오류를 테스트 성공으로 계산하지 않았다.

| 선택 증거 / pair | 심은 결함 | 관측 |
|---|---|---|
| VP-02·21 | 비인증 오류까지 authFailure | integration 실패 |
| VP-03 | cleanup transaction 생략 / FTS 삭제 항목 이탈 / 파일 sweep 생략 | 각각 store 실패 |
| VP-04 | sync·search·attachment 내부 루트 노출 / 오류 원문 노출 / stored_name 노출 | 5종 각각 integration·pure·store 실패 |
| VP-05 | auth_failed를 일반 오류로 축소 / 검색 도구만 남기는 부분 gating | 각각 session·binding/integration 실패 |
| VP-06 | trigram → unicode61 | store 실패 |
| VP-08 | 실패 시 lastSyncAt 갱신 | integration 실패 |
| VP-09 | 공유 Promise 조건 제거 | lifecycle 실패 |
| VP-10 | 소켓 생성 no-op | socket/TLS 실패 |
| VP-12 | 이미 커밋된 mail migration 수정 | 격리 fixture baseline exit 0 → 변이 exit 1 |
| VP-13 | sync/search의 readOnlyHint 맞바꿈 | tools 실패 |
| VP-14 | 임계 부호 반전 / 표본 조건 제거 / missing 본문 삭제 | 3종 각각 pure·store/integration 실패 |
| VP-17 | 검색 5필드 각각 빈 값 | 5종 각각 pure 실패 |
| VP-20 | whitelist에 DELE 추가 | native-boundary 실패 |
| VP-21·27 | rejection callback no-op | plugin-auth/integration 실패 |
| VP-22·27 | probe 결과 무시 / 거부와 도달 실패 문구 맞바꿈 | 각각 plugin-auth 실패 |
| VP-23 | resume 조건 제거 / gate 선택 조건 제거 | 각각 plugin-auth·gate 실패 |
| VP-24 | manifest 생략 / mailId optional / attachmentId optional | 3종 각각 store/integration·tools 실패 |
| VP-25 | 확인 횟수 1 / fingerprint 비교 제거 | 각각 pure/integration 실패 |
| VP-28 | manager close 제거 / DB initialize 실패 close 제거 | 각각 lifecycle·file-database 실패 |
| VP-29 | 대기자 없는 수신 buffer 폐기 | session 실패 |
| VP-30 | observed revision 인자 제거 | plugin-auth 실패 |

검산 단위는 위 표의 증거군이다: 선택 증거 **21행** · 별도 인용 변이 **0행** · 선택 증거와 겹치지 않는 새 oracle **0행** = **21행**. 직접 oracle인 나머지 pair는 별도 변이를 요구하지 않는다. 추가로 TLS 연결을 TCP로 바꾸는 변이도 socket 테스트가 검출했다.

처음에는 resume 테스트가 이미 검증된 runtime을 재사용했고, 표본 경계가 구현 상수를 같이 읽었으며, 경로 테스트가 Windows JSON escaping을 반영하지 않아 해당 변이를 놓쳤다. 각각 새 runtime 복원·리터럴 경계값·직렬화된 경로 비교로 고쳤고 동일 변이가 실패함을 재측정했다. 이 중간 결과를 최종 검출 결과와 구분한다.

## Product/UX 파생 검토

연결 실패는 기존 입력 폼으로 돌아가고 자격증명을 저장하지 않는다. 거부와 네트워크 도달 실패의 문구를 구분한다. 기존 grant가 있으면 실패한 후보가 덮어쓰지 않는다. 실제 인증 거부는 세 도구를 함께 회수하고 재인증하면 복원한다.

비인증 오류는 캐시 검색과 `stale/cacheAsOf`를 유지한다. 검색만으로 동기화·정리를 시작하지 않는다. 첨부는 검색 매니페스트의 id로 건별 반환하며 내부 원본은 유지한다. 이번 변경에 신규 화면·IPC·미지원 인증 선택지는 없다.

## 놓친 잠재 문제 + 대응

| 발견 | 대응 / 상태 |
|---|---|
| 대량 UIDL 소실에서 확인 전 ledger를 missing으로 바꾸면 다음 비교 기준이 사라짐 | ingest 허용 후에만 markMissing, 서로 다른 fingerprint 2회 뒤 같은 fingerprint 확인으로 재현·수정 |
| RETR 바이트/남은 줄 소실 및 idle socket 오류 후 추가 write | byte 큐 유지, 실패 상태 확인, abort 구독 정리; 실제 stream 테스트로 수정 |
| MIME 파싱 뒤 persist 직전 취소가 protocol_failed로 보임 | 최종 오류 경계에서 취소·예산 우선 분류, 메시지/파일 0·socket 종료 재현 |
| SQLite 초기화·파일 write 실패와 Windows 계정 경로 별칭 | 초기화 실패 close, 생성 부분 파일 회수, 단일 경로 segment 및 기존 account 소유 확인 |
| 실제 사내 TLS/프록시/인코딩·초기 10,000통 성능 | 미실행. 테스트 CA의 로컬 TLS와 EUC-KR bytes fixture를 실제 사내 환경 검증으로 간주하지 않음 |

설계 메커니즘 차이: 별도 search 파일 대신 manager의 순수 DB 조회를 사용한다. 작업별 DB 개방의 만료 축은 기존 영속 `lastSyncAt`, 공유 축은 도구의 sync Promise, 재진입 축은 Promise finally 초기화, 다른 무효화 축은 인증 revision으로 각각 확인했다. DB를 전역 캐시하지 않아 dispose 계약을 추가할 필요가 없다. plan의 제품 동작을 바꾸는 미해결 PLAN_GAP은 없다.

## 구현 보고

| 항목 | 관측 |
|---|---|
| 작성/구현 주체 | Codex — 사용자 명시 지시 |
| 구현 좌표 | `(r3 구현 — 좌표는 INDEX)` |
| 전체 회귀 | Vitest 547파일·5,052 pass, 1파일·1케이스 skip; scripts 120 pass |
| 최종 변경 회귀 | auth/gate/deployment/mail/infra 27파일·418 pass; 마지막 테스트 보완 뒤 2파일·24 pass |
| lint | 0 error, 기존 React Compiler/TanStack warning 1 |
| typecheck | node/web/test 3구성 통과. 추가 테스트 union 접근 오류 1건 수정 후 test 재실행 exit 0 |
| migration/doc gate | core 27·mail 1 동기화, append-only 통과; doc 9항목·98채널/prose/links 통과; real-git budget 11스위트 통과 |
| 독립 리뷰 | 첫 리뷰의 persist 취소 분류 지적을 재현·수정했고 재검토 지적 없음. handoff-verify와 별개 |
| 한계 | Electron 설치본 UI·사내 POP3 서버 실기·10,000통 초기 수집 성능 미실행 |

AC 자기보고는 아래 관측을 기준으로 한다. 이전 r2는 35개, ΔV2는 AC34~38 추가로 40개다.

| AC | 상태 | 직접 근거 |
|---|---|---|
| 1·2·3 | ✅ | 299초/301초 및 기존 UIDL RETR 제외 |
| 4·6 | ✅ | 무캐시·sync 없이 6입력 검색, 소켓 0·stale true |
| 5·28b | ✅ | 비인증 5종 캐시 시각·valid·registry 유지 |
| 7·8·9 | ✅ | sync 후 만료 정리 3저장소, 검색만 하면 만료 행 유지 |
| 10·11·12 | ✅ | 매니페스트 및 세 첨부 Temp 반환·원본 bytes/mtime 동일 |
| 13 | ✅ | 6종 안전 오류 메시지, 원문 노출 변이 검출 |
| 14·15 | ✅ | 미인증 registry 0, toolNames 3 유지 |
| 16·17 | ✅ | 한국어 중간어와 EUC-KR 색인 검색 |
| 18·19 | ✅ | core migration 불변, mail append-only 변이 CLI 거부 |
| 20·21 | ✅ | 실제 로컬 TLS, 공통 deps로 bound Auth 서버 조립 |
| 22·23 | ✅ | annotations 자리 맞바꿈 검출, 동시 sync 1회 |
| 24 | ✅ | RETR/persist 취소 무부분 메시지, context 없는 세 handler 왕복 |
| 25·25b·33 | ✅ | 보호 5경계 RETR 차이, 일반 소실 보관, fingerprint 전이 |
| 26·27·28 | ✅ | whitelist 송신·미probe 첫 sync 오류·현재 거부 전체 회수 |
| 29·30 | ✅ | 후보 실패 무저장·문구 구분, HTTP 회귀·POP3 복원 무접속 |
| 31·32 | ✅ | 첨부 id 3건 왕복, 두 id 필수 |
| 34·35 | ✅ | stale revision 거부 무효, byte stream/종결 |
| 36·37·38 | ✅ | 작업 자원 close/재시도, TLS/명령 가드, USER/PASS 공통 경로 |

검산: ✅ **40** · ⚠️ **0** · ❌ **0** = 총 **40**. 이는 기계 검증의 자기보고이며 위에 명시한 환경 실기는 별도 대기다.

## Review Signals — 사실만

- 현재 라운드 r3. r2의 미실행 통합 경로를 실제 Auth → Plugin → POP3/SQLite 왕복으로 연결했다.
- gate probe의 복원 가능성은 기존 접근 정책과 관련 있어 구현 전에 ΔV2 규범을 별도 정정했다.
- 원래 규범이 요구한 byte 보존·취소·보호 baseline 및 선택 변이 감도가 이번 구현에서 결함을 드러냈다. 수정 후 해당 사례를 재실행했다.
- Windows JSON 경로 escaping과 Python 로그 decoding이 실행 환경 차이였다. 로그 디코딩 실패는 UTF-8을 명시해 재실행했으며 기능 실패로 집계하지 않았다.
- 독립 검증자는 이 보고를 증거 대신 사용하지 않고 유효 V와 사내 실기 대기 항목을 다시 판정한다.
