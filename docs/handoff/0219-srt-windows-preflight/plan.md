# Plan — 0219-srt-windows-preflight

## 메타

| 항목 | 값 |
|---|---|
| 작성자 | Codex — 설계 역할 |
| 일자 | 2026-09-08 |
| 상태 | READY |
| V mode / 기준 / revision | Baseline V / none / V1 |
| 전체 작업 내 위치 | SRT 도입 제안 §12 P0. 통과 후 공통 실행 기반·Claude 연결·확장·배포를 계속 구현한다. |

# Part I — Product & UX Contract

## 1. Context / 목표

Windows SRT와 Orca 실행 파일 사이의 실제 전달·권한·종료 조건을 먼저 검증한다.
SDK host를 이전하기 전에 작은 bootstrap과 재현 가능한 실증 명령을 만든다.
이 단계만으로 앱의 SRT 도입이 완료됐다고 보고하지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 | “윈도우에서 wsl, docker 없이, appcontainer 등도 없이 … sandbox-runtime … 격리 환경” | 사용자 대화 |
| 명시 | “opencode, cowork는 후에 구현할 것이다” | 사용자 대화 |
| 명시 | “구조적이며 체계적인 모듈화, 경량화” | 사용자 대화 |
| 구현 승인 | “구현하라” | 2026-09-08 사용자 요청, 직전 최종 제안에 대한 후속 |
| 미정 | 최초 관리자 설치 허용 여부 “아직 정하지 않음” | 이전 사용자 답변 |

## 3. Decision Ledger

| ID | 결정 | 이유 / 출처 | 상태 |
|---|---|---|---|
| D-001 | Windows 격리는 SRT만 사용한다 | 사용자 명시 | ACTIVE |
| D-002 | SDK Main 유지·작은 supervisor·실행 bootstrap 방향을 따른다 | 최종 제안 후 구현 요청 | ACTIVE |
| D-003 | P0 실증을 먼저 닫고 후속 단계를 계속한다 | 제안 §12의 선행 조건 | ACTIVE |
| D-004 | npm SRT 0.0.75를 정확히 고정한다 | 조사한 API와 binary를 같이 검증 | ACTIVE |
| D-005 | bootstrap은 C++17/Win32, MSVC로 빌드한다 | 이미 설치된 VS2019·SDK 사용; 추가 런타임·외부 native 라이브러리 없음 | ACTIVE |
| D-006 | bootstrap은 전달·실행·대기만 담당한다 | ACL/WFP/계정/권한 판단은 SRT 소유 | ACTIVE |
| D-007 | 실제 기계의 초기 provisioning은 환경 승인 절차를 거친다 | 기존 관리자 허용 미정; 자동 설치·자가 승격을 앱 부트에 넣지 않음 | OPEN |
| D-008 | 테스트에는 가짜 키와 새 fixture만 쓴다 | 실제 사용자 비밀 읽기·전송 불필요 | ACTIVE |
| D-009 | 미설치·정책 실패는 명시 오류다 | 비격리 실행 fallback 금지 | ACTIVE |

ACTIVE 결정 ↔ AC 대조: D-001/004/009→AC4·5, D-002/003→AC8, D-005/006→AC1·2·3, D-008→AC6·7. 충돌 0.
D-007은 코드·로컬 bootstrap 검증을 막지 않지만 기계 provisioning을 한 것으로 간주할 근거도 아니다.

## 4. 요구 비판적 검토

| 질문 | 판단 / 근거 |
|---|---|
| 기존 구현이 충족하는가 | 미충족. package.json에 SRT 없음, SRT 설치 표식·계정 없음 |
| 더 작은 구현이 있는가 | bootstrap은 원래 stdio HANDLE을 상속한다. 사용자 공간 stream relay·JSON parser·추가 Node 배포가 불필요 |
| 선행 자료와의 차이 | Rust 후보를 C++로 구체화. Windows API 의미와 bootstrap 역할은 동일 |
| 설치 전 큰 변경이 타당한가 | P0 실패 시 상위 통합의 전제가 무너지므로 앱 실행 배선 변경은 P0 이후 |

## 5. 동작 / 사용자 흐름

```text
개발자 build 명령 → 고정 native bootstrap 생성 → 비격리 전달 테스트
SRT 상태 확인 → 미설치면 명시 실패와 설치 방법 표시
승인된 초기 설치 → disposable fixture 기반 SRT 실증 → 성공/실패 evidence
성공 → 후속 공통 실행 계층과 Claude 통합
```

| 사건 | 결과 |
|---|---|
| 잘린/과대/미지원 frame | 대상 프로그램을 시작하지 않고 nonzero 종료 |
| 정상 frame 뒤 SDK 입력 | 대상 프로그램이 후속 입력을 원형 그대로 받음 |
| 실행 파일 없음 / 잘못된 cwd | 명시적인 bootstrap 실패; stdout 프로토콜 오염 없음 |
| SRT 미설치 | 명시 실패; 원래 사용자 권한으로 probe를 대신 실행하지 않음 |
| child 종료 | bootstrap이 같은 exit code로 종료 |
| smoke 실패 / 취소 | child·proxy·SRT session 정리를 시도하고 결과를 분리 보고 |

## 6. 범위 / 비범위

범위: 고정 dependency, native bootstrap, 빌드/단위·실행·SRT 실증 명령, 설치 상태와 운영 문서.
비범위: 이번 P0에 Claude query·세션·DB·UI·MCP handler 배선을 넣지 않는다. 이들은 전체 요청의 후속 단계다.
OpenCode/cowork 제품 구현은 사용자 요청대로 후속이다.

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 직접 검증 / 도달 경로 |
|---|---|---|---|
| R-01 | AT-01 / AC1 | 빈 argv·공백·인용·한글·역슬래시를 대상 프로그램이 정확히 받는다 | build→실제 exe→probe argv 비교 |
| R-01 | AT-02 / AC2 | frame과 한 write로 보낸 후속 입력·stdout·stderr가 원형 유지된다 | 실제 exe→probe bytes/exit 비교 |
| R-02 | AT-03 / AC3 | malformed·truncated·과대·NUL·상대 target·중복 env 요청은 실행 전 실패한다 | sentinel child가 실행되지 않음; stderr 진단/exit |
| R-03 | AT-04 / AC4 | SRT 버전과 WindowsBinShell/public wrapper 계약이 고정된다 | 설치된 package/version/type·argv 결과, native 연결 |
| R-03 | AT-05 / AC5 | 미설치 상태는 실패하고 SRT 준비 상태에서만 제한 실행한다 | check/smoke 실패 경로와 실제 SRT 실행 결과 |
| R-04 | AT-06 / AC6 | 승인 fixture read/write는 성공하고 지정 deny fixture read/write는 실패한다 | SRT 안 실제 probe 결과; 호스트 fixture 내용 비교 |
| R-04 | AT-07 / AC7 | proxy 허용/거부, nested child 수명, reset 뒤 fixture ACL 상태를 관측한다 | 로컬 HTTP fixture·프로세스 probe·ACL 전후 비교; 미확인은 통과로 세지 않음 |
| R-05 | AT-08 / AC8 | 재현 명령·실증 한계·후속 단계가 코드와 일치한다 | 운영 문서→build/test/check/smoke; 앱 연결 미완료 명시 |

## 7-A. V / Trace Matrix

Baseline V. 위 R/AT와 아래 SD/ST·AR/IT·MD/UT는 전부 NEW이며 다른 handoff의 V를 상속하지 않는다.

| Node pair | 계약 |
|---|---|
| SD-01 / ST-01 | build→check→restricted probe→cleanup |
| AR-01 / IT-01 | Node frame producer→native bootstrap→target argv/env/stdio |
| AR-02 / IT-02 | public SRT wrapper→native runner→bootstrap |
| MD-01 / UT-01 | bounded binary frame parsing·Windows quoting·env block |
| MD-02 / UT-02 | 빌드 경로·고정 package·실패 진단 |

| Pair | left ↔ right | requiredness | production path / oracle | 적대 증거 | §10 |
|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02 | REQUIRED | 실제 bootstrap→probe JSON/bytes/exit | not selected — 실제 결과 직접 비교 | EP-01·02 (2) |
| VP-02 | R-02 ↔ AT-03 | REQUIRED | invalid input→child marker 미생성 | not selected — 실행 결과와 exit 직접 관측 | EP-01·03 (2) |
| VP-03 | R-03 ↔ AT-04·05 | REQUIRED | check/wrap→SRT status/native process | not selected — 실제 프로세스 결과 | EP-04·05 (2) |
| VP-04 | R-04 ↔ AT-06·07 | REQUIRED | restricted probe→fixture/network/process/ACL | not selected — 직접 OS 관측 | EP-05·06 (2) |
| VP-05 | R-05 ↔ AT-08 | REQUIRED | 문서 명령→artifact·진단 | not selected — 명령 실행 및 상태 대조 | EP-07 (1) |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | smoke success/failure→finally cleanup | not selected — 자손/ACL 상태 관측 | EP-05·06 (2) |
| VP-07 | AR-01 ↔ IT-01 | REQUIRED | frame encoder→exe→probe | not selected — 실제 byte 비교 | EP-01·02·03 (3) |
| VP-08 | AR-02 ↔ IT-02 | REQUIRED | public wrapper→SRT→exe | not selected — 실제 제한 실행 | EP-04·05 (2) |
| VP-09 | MD-01 ↔ UT-01 | REQUIRED | native parser/quote/env→probe | not selected — 유효/무효 입력 직접 실행 | EP-01·02·03 (3) |
| VP-10 | MD-02 ↔ UT-02 | REQUIRED | build/config→실행 가능 artifact·오류 | not selected — 실행 결과 | EP-04·07 (2) |

운영 gate: native build/test, 변경 scripts ESLint, typecheck, doc-inventory, diff whitespace, plan/INDEX 상태·커밋 trailer 파싱. 기존 무관 실패는 분리한다.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 대상 / 검색 | 관측 | 의미 |
|---|---|---|
| `git log -1` / status | a52e0d1e; 제안 문서만 변경 | 코드 baseline 동일 |
| `rg 'query\\(' app/src/main/adapters/claude.ts` | runCompletion·sendMessage 두 호출 | 후속 단계는 양쪽을 통합해야 함 |
| `app/package.json` | SRT 미도입, Claude 0.3.220 | 이번 단계는 SRT만 고정 추가 |
| `Get-Command cargo,rustc,cl` + 설치 경로 | Rust 없음; VS2019 cl·Windows SDK 실재 | 기존 native toolchain 재사용 |
| SRT 계정·레지스트리 조회 | 설치 증거 없음 | 실제 초기 설치는 별도 환경 동작 |
| SRT 0.0.75 public source | object WindowsBinShell; outer env는 child에 임의 전달 안 됨 | bootstrap frame 필요 |

## 9. AS-IS → TO-BE

AS-IS: SDK→bundled Claude CLI. 공통 제한 실행 계층·SRT binary·bootstrap 없음.
TO-BE(P0): 개발/검증 명령→고정 SRT public wrapper→SRT native runner→bootstrap→시험 프로그램. 앱 query 배선은 아직 동일하다.

| 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 전달 | Windows SRT 경로 미검증 | frame→CreateProcessW→기존 HANDLE 상속 | AR-01 / VP-07 |
| OS 제한 | 기존 앱 guard | SRT fixture 실증; 제품 활성화는 후속 | AR-02 / VP-08 |
| 운영 | SRT 의존성·진단 없음 | 고정 dependency·build/check/smoke 명령 | SD-01 / VP-06 |

## 10. 계약 / 강제 지점

| EP | SSOT / 누가 / 언제 | 계약 | 실패 의미 |
|---|---|---|---|
| EP-01 | native parser / launch 직전 | header magic/version·길이·UTF-8·NUL·필드 수·absolute exe/cwd | child를 만들기 전 reject |
| EP-02 | native launcher / CreateProcessW | lpApplicationName 고정·정확한 quoting·current token·stdio handle allowlist·no breakaway | 다른 실행기/권한/데이터로 실행하면 위반 |
| EP-03 | env block / child 생성 전 | case-insensitive env 충돌 거부·기존 SRT 환경 보존·예약 proxy/profile/CA 덮어쓰기 금지 | credential·proxy 경계 변조 |
| EP-04 | package/build/wrapper bridge | version 0.0.75·절대 native 경로·public API·shell false | 버전 drift/셸 보간/비격리 fallback |
| EP-05 | smoke / SRT 실행 진입 | 초기화 성공 후에만 실행·disposable fixture·fake credentials | 설치 실패를 정상 실행으로 가리거나 실제 비밀 사용 |
| EP-06 | smoke finally / process·proxy·ACL 회수 | child 종료 대기·reset·전후 상태 evidence | 정리 시도만으로 성공 주장 |
| EP-07 | package scripts·운영 문서·plan/INDEX | 실행 가능한 명령·P0 상태·후속 범위 일치 | 부분 산출을 전체 도입 완료로 표시 |

## 11. 구현 설계

| 신규/변경 파일 | 책임 |
|---|---|
| `app/native/sandbox-launcher/main.cpp` | 작은 Win32 실행기; 표준 라이브러리만 사용 |
| `app/scripts/sandbox-launch-frame.mjs` | frame producer·상한·검증 계약 |
| `app/scripts/build-sandbox-launcher.mjs` | vswhere/명시 toolchain→환경 준비→cl; 산출 resources/sandbox/<arch>/ |
| `app/scripts/sandbox-launcher.test.mjs` | 실제 exe/Node probe 기반 전달·실패 테스트 |
| `app/scripts/sandbox-probe.mjs` | 가짜 key·argv·stdio·filesystem/network/child 관측용 fixture |
| `app/scripts/check-sandbox.mjs` | 상태 조회·설치 진입·SRT 실증; 기본 check는 OS provisioning 없음 |
| `app/package.json`, lock | 정확한 SRT dependency·scripts |
| `docs/guides/windows-srt.md` | 명령·권한 변경·결과·제약·후속 |

wire: 4-byte magic `ORCA`, uint32 LE version=1, uint32 LE payload length(최대 1 MiB), payload는 UTF-8 length-prefixed exe·cwd·argv count+strings·env count+(key,value). count 최대 4096. 남는 payload와 NUL은 거부한다.
frame 이후의 stdin은 bootstrap이 읽지 않고 target에 상속한다. `ReadFile`은 필요한 길이만 읽고 stdio buffered reader를 사용하지 않는다.
target은 절대 exe이며 .cmd/.bat를 직접 실행하지 않는다. env 키는 대소문자 무시로 유일해야 하고 SystemRoot·USERPROFILE·HOME·TEMP/TMP·proxy·CA·Git config 예약키는 보존한다.

## 12. End-to-end 영향

현재 앱의 query·approval·MCP·DB 경로는 이번 단계에서 불변이다. 다음 단계는 P0의 실행 계약을 infra/sandbox로 옮겨 SDK 중립 lease와 utility process에 연결한다.
`npm test`의 scripts glob에 들어가는 새 테스트는 native fixture를 숨겨 skip하지 않고, dedicated native 검증과 순수 tests의 실행 전제를 명확히 분리한다.

## 13. Lifecycle / 오류 / 정리

bootstrap은 child 종료까지 대기하고 exit code를 반환한다. 형식 오류는 stderr에 원인 코드만 적고 frame/credential 값을 기록하지 않는다.
smoke는 loopback 서버·child·SRT 초기화 상태를 추적하고 finally에서 닫는다. 실패와 cleanup 실패를 각각 보존한다.
설치는 계정/레지스트리/WFP의 기계 변경이며 SRT 공식 installer만 사용한다. Orca 전용 uninstall을 자동 수행하지 않는다.
다중 저장소: binary는 temp 출력→성공 확인→최종 경로 교체; 실패 시 이전 산출 보존. plan과 INDEX 상태는 함께 갱신한다.

## 14. 상한 / 경량화

frame 최대 1 MiB, 문자열 개수 최대 4096, Win32 command-line 최대 32767 UTF-16 code units 이내를 검사한다.
bootstrap은 SDK 입력/출력을 복제하지 않는다. 별도 Node/Python/Rust runtime·JSON parser 라이브러리·relay worker thread를 배포하지 않는다.

## 15. 외부 포트 / 문서

native wire는 내부 버전 계약이다. 문서에 frame 구성과 정상/실패 의미를 적고 실제 encoder→exe 테스트가 shape/semantics를 함께 검증한다.

## 16. 기존 규칙과 관계

SRT dependency는 사용자가 명시해 구현을 요청한 패키지다. 새 OS 격리 기술·일반 plugin framework는 추가하지 않는다.
현재 main DAG·Chromium 전송 규칙·권한 승인 대기는 이번 단계에서 바꾸지 않는다.

## 17. 리스크

Windows SRT alpha·공유 SID·ambient ACL·DNS 제약은 그대로다. 허용 fixture의 성공을 전체 디스크 격리로 일반화하지 않는다.
관리자 설치 승인/네트워크/실행 환경이 막히면 해당 evidence는 SELF_BLOCKED로 두고 이미 실행한 비격리 전달 검증과 구분한다.

## 18. 영향 문서

제안서에 P0 진입과 C++ 선택 근거를 추가한다. docs/INDEX와 handoff/INDEX를 갱신한다. 현재 아키텍처를 구현된 것처럼 미리 변경하지 않는다.

## 19. 게이트 / READY self-review

app/AGENTS.md에 따라 ABI를 바꾸지 않는 native/script 테스트와 정적 검사를 실행한다. 문서 gate는 app cwd에서 `node scripts/check-doc-inventory.mjs --check`다.
READY 대조: ACTIVE↔AC 충돌 0, R/SD/AR/MD에 REQUIRED pair 존재, EP-01~07에 실패 의미·oracle 존재. 실제 SRT 설치/실증은 승인과 환경에 의존하며 완료 증거로 선점하지 않았다.

## [구현자 기입] 설계 리뷰

P0 구현을 진행했다. D-001~006·008·009와 실제 산출의 방향은 동일하다.
D-007은 여전히 OPEN이다. 설치 스크립트와 취소·실패 처리를 준비한 뒤 사용자에게 이 PC의
공식 installer 실행 허용을 요청했다. 답변 전에는 계정·자격 증명·WFP를 provisioning하지 않는다.

`npm install --save-exact @anthropic-ai/sandbox-runtime@0.0.75 --ignore-scripts`로 패키지와
vendored Windows binary만 준비했다. npm 의존성 설치와 Windows provisioning은 별개다.

구현 세부: `check-sandbox.mjs`에서 실제 실증을 `sandbox-smoke.mjs`로 분리했다.
명령·설치 상태 검사는 가볍게 유지하고, probe/fixture/정리 책임은 smoke가 갖는다.
같은 프로세스의 SRT manager를 동시에 여러 smoke가 공유하는 사용은 제공하지 않는다.

## [구현자 기입] 강제 지점 전수 / V-pair 자기확인

| EP | 현재 관측 | 자기 상태 |
|---|---|---|
| EP-01 | 실제 native 테스트에서 malformed 20종의 child marker 미생성, 형식 진단 확인 | SELF_PASS |
| EP-02 | native probe의 argv·cwd·binary stdin·stderr·exit 37 일치. HANDLE allowlist 사용 | SELF_PASS — 전달 범위; 실제 SRT job 관측은 EP-06에 남음 |
| EP-03 | 예약 proxy/profile/CA 키·중복 env 거부, 기존 env 보존 실측 | SELF_PASS |
| EP-04 | dependency 0.0.75 고정, MSVC native build, CLI 미설치 응답 확인. 제한 wrapper 실제 실행 미수행 | SELF_BLOCKED |
| EP-05 | 미설치 check/smoke는 `srt_install_required`. 실제 allow/deny fixture 실행은 설치 결정 대기 | SELF_BLOCKED |
| EP-06 | reset 실패/시간 초과·취소·PID 미관측 시 보존 tests. 실제 SRT 자손 종료·ACL 복구는 미관측 | SELF_BLOCKED |
| EP-07 | package의 build/test/check/install/smoke 명령·운영 문서·앱 미연결 표기 대조. 문서 링크 검사 통과 | SELF_PASS |

| Pair | 자기 상태 | 근거 / 남은 조건 |
|---|---|---|
| VP-01 | SELF_PASS | native argv/stdio/exit 직접 비교 |
| VP-02 | SELF_PASS | malformed frame의 실제 실행 전 거부 |
| VP-03 | SELF_BLOCKED | 미설치 경로만 관측; 설치 후 public wrapper 실행 필요 |
| VP-04 | SELF_BLOCKED | 실제 filesystem/network/child/ACL 실증 필요 |
| VP-05 | SELF_PASS | 운영 문서의 명령·실패 판정·x64 범위·미연결 상태 대조 |
| VP-06 | SELF_BLOCKED | 실패 경로 테스트와 별도로 실제 SRT cleanup 증거 필요 |
| VP-07 | SELF_PASS | encoder→실제 exe→Node probe |
| VP-08 | SELF_BLOCKED | 실제 SRT→bootstrap 미실행 |
| VP-09 | SELF_PASS | native parser/quote/env 유효·무효 입력 실행 |
| VP-10 | SELF_PASS | 실제 MSVC build 및 version/binary/launcher 실패 경로 tests |

## [구현자 기입] 이번 라운드 수정의 잠금

선택된 적대 증거는 `not selected`이며 실제 실행 결과를 직접 비교한다.
구조적 스윕·0건 proxy oracle을 새로 만들지 않았다.
선택 증거 0 · 인용 변이 0 · 새 구조적 oracle 0 = 잠금 표 행 0.

별도 검증기 결함: 원래 nested probe에는 부모 stdin EOF 정리와 libuv 자체 child job 정리가
있었다. SRT 없이 root Node만 종료해도 세 PID가 모두 종료되는 것을 재현했다.
실증용 descendants에서 두 경로를 제외한 뒤, root만 종료해도 자손 2개가 살아남는 실제
Node 테스트가 통과했다. 이것을 실제 SRT job 회수의 사전 조건으로 삼는다.
현재 Node의 [libuv 1.49.2 소스](https://github.com/libuv/libuv/blob/v1.49.2/src/win/process.c#L979-L1026)는
detached 경로에서 `CREATE_BREAKAWAY_FROM_JOB`를 설정하지 않는다. 실제 SRT job 상속·회수는 미검증이다.

## [구현자 기입] Product/UX 파생 검토

일반 앱 query·제목 생성은 아직 SRT 연결 전이다. 운영 문서와 CLI는 P0 사전 검증 범위를
명시한다. `check` 성공은 provisioning 존재 여부이며 실제 격리 성공을 뜻하지 않는다.
비관리자 WFP `cannot-read`를 미설치나 검증 완료로 바꾸지 않고 `unverified`로 보존한다.

설치 취소는 성공으로 표시하지 않는다. 이미 provisioning된 환경의 `install`은 공식
installer를 다시 호출해 공유 계정 암호를 불필요하게 회전시키지 않는다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| 항목 | 분류 / 대응 |
|---|---|
| SRT proxy URL 인증값 | 구현 내 해결. 실제 proxy 인증 시험으로 `Proxy-Authorization` 전달 및 origin `Authorization` 미전달 확인 |
| PowerShell 7의 PSModulePath 상속 | 구현 내 해결. Windows PowerShell의 Get-Acl 관측에 해당 shell의 Modules 경로 지정 |
| nested 자발 종료 | 구현 내 해결. root만 종료 시 자손 생존 실측으로 SRT 없는 green을 배제하는 조건 확인 |
| reset timeout 뒤 fixture 삭제 | 구현 내 해결. reset 실패·미완료·ACL 불일치면 보존. 실패/timeout 테스트에서 retainedFixture 확인 |
| CLI Ctrl+C가 finally를 건너뜀 | 구현 내 해결. smoke 전용 signal을 전달하고 실제 ordinary runner 종료 후 cleanup 반환을 확인 |
| 자손 PID 없는 상태의 cleanup | 구현 내 해결. child 실행 후 PID 미관측이면 residualChildren=null로 남기고 fixture 보존; 실패 runner 경로 test |
| 후속 policy 비교 시점 | NEXT_HANDOFF. `enqueue.ts`·`post-turn.ts`는 runtime 진입 전에 channelAlive로 pending 이월을 결정한다. policy 비교는 그 전에, async lease 획득만 cold runtime에서 수행 |
| 후속 continuation lease 승계 | NEXT_HANDOFF. TurnRequest의 장기 descriptor에는 불변 scope/policy만 저장하고 lease는 runtime-local로 소유. listen 명시 필드와 flush spread 경로 모두 검사 |
| 후속 종료·상태 보존 | NEXT_HANDOFF. 제목 실행도 추적해 async quit 장벽 안에서 정리하고, CLI 영속 config/history는 helper/policy revision과 별도 수명으로 유지 |

## [구현자 기입] 구현 보고

부분 구현이며 전체 도입 완료가 아니다. 실제 SRT가 필요한 AC는 보류한다.

| AC | 상태 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | native argv의 빈 인수·인용·한글·역슬래시 직접 비교 |
| AC2 | ✅ | frame+후속 binary stdin 한 write, stderr 원형, exit 37 |
| AC3 | ✅ | malformed 20종의 stdout 빈 값·child marker 미생성 |
| AC4 | ⚠️ | version/public API 배선은 고정했으나 실제 SRT wrapper 미실행 |
| AC5 | ⚠️ | 미설치 실패는 확인; 설치된 제한 실행은 미확인 |
| AC6 | ⚠️ | 실제 SRT filesystem allow/deny 실증 대기 |
| AC7 | ⚠️ | 실제 SRT network·자손·reset ACL 실증 대기 |
| AC8 | ✅ | 운영 명령·실증 한계·P0/후속 범위와 실제 코드 대조 |

✅ 4 · ⚠️ 4 · ❌ 0 = 총 8. Criteria-Met은 4/8이다.

| 운영 gate | 관측 |
|---|---|
| `npm run sandbox:test` | MSVC 빌드 후 실제 native 6/6, skip 0 |
| Node scripts tests: check-sandbox / sandbox-launcher / sandbox-probe / sandbox-smoke (파일명 개별 지정) | 마감 33/33, PID 미관측 보강 후 smoke 11/11. 최종 파일별 10/2/11/11, skip 0 |
| 변경 scripts ESLint | 0 error / 0 warning |
| `npm run typecheck` | node/web/test 3구성 통과, ABI 변경 없음 |
| `node scripts/check-doc-inventory.mjs --check` | generated/prose/links 통과 |
| `git diff --check` | whitespace 오류 없음 |

실제 `sandbox:check` 결과는 userProvisioned=false, credentialPresent=false,
wfp=cannot-read, enforcement=unverified, code=srt_install_required였다.
설치 승인 답변 전 실제 제한 실행 결과를 통과로 기록하지 않는다.
전체 SRT 도입은 P0 이후에도 공통 실행 계층·Claude·확장·배포가 남는다.

## [구현자 기입] Review Signals

첫 구현 라운드. native 전달, probe, CLI, smoke를 분리해 구현하고 별도 담당자가
CLI/smoke의 실패·정리 경로를 검토했다. 검증기 자체의 nested 종료 false positive,
signal 정리 누락, PID 미관측의 낙관적 정리를 이번 라운드에서 보정했다.
환경 한계는 실제 Windows provisioning 미완료이며 테스트 실패와 구분한다.

## [검증자 기입] 파생 이슈

없음.
