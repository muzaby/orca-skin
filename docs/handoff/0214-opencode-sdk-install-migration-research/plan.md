# Plan — OpenCode SDK 설치와 Orca 마이그레이션 연구

## 메타

| 항목 | 값 |
|---|---|
| slug | `0214-opencode-sdk-install-migration-research` |
| 작성자 | Codex — 사용자 직접 요청에 따른 설계·구현 |
| 일자 | 2026-09-03 |
| 매핑 | OpenCode 도입 사전 조사; 실제 백엔드 활성화는 후속 |
| 상태 | READY — 작성 문서 승인 완료 (사용자: “진행하라”) |
| V mode / 기준 V | Baseline V / none |
| 이번 V revision / 유효 V | V1 / V1 |

# Part I — Product & UX Contract

## 1. Context / 목표

최신 OpenCode SDK를 재현 가능한 의존성으로 설치하고, 실제 배포 코드에 근거한 Orca 마이그레이션 자료를 제공한다.
완료 후 개발자는 공식 계약, 현재 Orca와의 차이, 레이어별 작업 순서와 검증 조건을 구분해 읽을 수 있다.
앱의 기존 Claude 동작은 유지한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “1. opencode sdk 설치” | 현재 대화 |
| 명시 요구 | “2. orca migration을 위한 sdk 코드 분석 ([https://opencode.ai/docs/sdk/](https://opencode.ai/docs/sdk/)). 레이어별 마이그레이션 가이드, opencode 메시지 타입 및 migration 전략 등등” | 현재 대화 |
| 명시 요구 | “3. 연구 결과를 정리하여 docs 경로에 업데이트”, “4. git push” | 현재 대화 |
| 추가 조건 | “Sdk는 최신버전으로설치 (버전명명시할것)” | 후속 사용자 메시지 |
| 범위 승인 | “제안 모두 수용” | 의존성 설치·분석·문서화, CLI/서버 및 런타임 구현 제외 제안에 대한 승인 |
| 설계자 해석 | 최신 버전의 의미는 설치 직전 npm `dist-tags.latest` 조회 결과이며, 범위 연산자 없이 고정한다 | 변동하는 latest와 재현 가능한 분석 기준을 함께 충족 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `app`의 런타임 dependencies에 공식 `@opencode-ai/sdk`를 exact 설치 | “최신버전으로설치 (버전명명시할것)” | 사용자 요구·승인 | ACTIVE | — |
| D-002 | 실제 설치 패키지의 타입과 JavaScript를 공식 문서와 대조 | 추측한 메서드·메시지 형식을 마이그레이션 계약으로 쓰지 않음 | 사용자 분석 요구·승인 | ACTIVE | — |
| D-003 | 공식 원문, SDK 해설, Orca 연구/전략을 분리하고 관련 현재 문서를 정정 | 결과를 `docs`에서 탐색 가능하게 제공 | 사용자 문서화 요구·승인 | ACTIVE | — |
| D-004 | CLI/서버 설치 및 실행, OpenCode 어댑터 구현·활성화는 하지 않음 | 이번 작업은 설치와 도입 연구이며 런타임 전환은 후속 | 제안 전체 승인 | ACTIVE | — |
| D-005 | `SessionAdapter`, `NormalizedEvent`, Orca DB를 유지하는 단계적 전환을 권고안으로 작성 | 기존 대화·화면 경로 보존; 새 제품 정책 확정과 구별 | 제안 전체 승인 | ACTIVE | — |
| D-006 | 게이트 후 설계와 구현을 별도 커밋하고 `origin/codex/opencode`에 일반 push | 원격 공유 요청; force push·PR·merge는 범위 밖 | 사용자 push 요구·승인 | ACTIVE | — |
| D-007 | 기본 백엔드 정책·도구명 표준화·서버 배포/소유권 정책은 이번에 채택하지 않음 | PRD OQ7/OQ10 및 후속 런타임 설계의 결정 영역 | 기존 규칙·승인 범위 | ACTIVE | — |

### 갱신 메모

- D-001~D-007 신규 기록. 대체·철회된 결정 없음.
- 작성 문서 검토 후 사용자 “진행하라”로 실행 승인. 범위·AC·V1 변경 없음.
- 2026-09-03 npm 조회는 `1.18.27`; 설치 직전 재조회한 값을 실제 기준으로 삼는다. 선행 웹 조사 버전은 설치 기준이 아니다.
- ACTIVE 결정 ↔ AC 대조: D-001→AC1·2, D-002→AC2~4, D-003→AC3~5, D-004→AC6, D-005·D-007→AC4·6, D-006→AC7; 충돌 없음.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 이미 설치돼 있는가 | 아니오 | `app/package.json`·lockfile의 SDK 검색 결과 없음 |
| 공식 문서만 요약해도 충분한가 | 부족 | 기존 TRD에는 실제 확인되지 않은 `session.send` 예제가 있으며 API 표면별 차이 분석이 필요 |
| 실제 전환까지 구현해야 하는가 | 아니오 | D-004; 현재 `Backend`는 Claude만 허용 |
| 연구가 제품 결정을 대신하는가 | 아니오 | 권고와 미결정을 구분; D-007 유지 |
| 신규 의존성 승인이 있는가 | 있음 | 사용자 설치 요청 및 전체 제안 승인 |

작성된 설계 문서 검토는 완료됐다. SDK 세부 사실은 패키지 조사로 닫으며, 사용자에게 API 형식을 추측해 선택하게 하지 않는다.

## 5. 동작 / 사용자 흐름

```text
승인된 설계 → latest 조회 → exact 설치 → 설치 코드/공식 문서/Orca 대조
→ 연구 문서와 계약 검증 → 설계·구현 분리 커밋 → 승인된 브랜치 push
```

| 시작 상태/이벤트 | 작업 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 설치 전 latest 조회 성공 | 버전·조회 시각·integrity 기록 후 그 버전 설치 | 분석과 설치의 동일 기준 |
| 조회/설치 실패 | 원인을 분리하고 필요 시 네트워크 권한 요청 | 실패를 설치 완료로 보고하지 않음 |
| 문서와 설치 타입의 차이 발견 | import 표면·버전·메서드를 나눠 근거 기록 | 차이와 미확인 범위가 명시된 가이드 |
| 정적/계약 게이트 실패 | 이번 변경의 원인 수정, 환경 문제는 분리 보고 | 검증되지 않은 동작을 성공으로 표시하지 않음 |
| push 실패 | 로컬 커밋 보존; 권한/remote 상태 확인 | push 미완료 및 재개 조건 보고 |

폐쇄망에서는 원문 미러와 고정 버전 자료를 읽을 수 있다. 실제 서버, 다중 세션, 취소/재연결은 연구 항목이며 이번 앱 동작에 새 상태를 추가하지 않는다.
키보드·접근성·테마 변경은 해당 없음.

## 6. 범위 / 비범위

- 범위: SDK 의존성, 배포 소스 분석, test-only 계약 검증, 한국어 연구 문서, 관련 낡은 문서/라우팅 정정, commit/push.
- 비범위: CLI/서버 설치·프로세스 기동, 모델 요청·실제 인증, DB/IPC/설정/UI 변경, production adapter와 converter 구현, 기존 대화 이전, PR/merge.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| API 표면 선택·서버 배포·인증/권한 정책 | 실제 구현 후 바꾸면 비쌈 | 연구에서 대안·검증 gate 제시, 후속 설계에서 확정 |
| 다중 백엔드 session routing·기존 대화 호환 | 데이터 쓰기 이후에는 비쌈 | 활성화 이전 필수 선행조건으로 명시 |
| 기존 Claude 설정/기록의 OpenCode 변환 | 손실 가능성이 있음 | 자동 변환을 제안의 기본값으로 삼지 않음 |

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 — 직접 단언 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 설치 시 조회한 최신 버전이 exact dependency·lock·설치본에서 일치하고 버전명이 보고됨 | npm metadata, `npm ls`, manifest/lock/설치본 대조 | npm registry → app 의존성 해석 |
| R-02 | AT-02 / AC2 | 공개 client import로 요청을 만들 수 있고 문서의 호출 예제가 실제 타입과 일치 | 설치 SDK를 import한 typecheck 및 fake-fetch 요청/응답·오류 테스트 | SDK public export → 직렬화된 HTTP 요청; 테스트 전용 |
| R-03 | AT-03 / AC3 | API 표면, 메시지/Part/Tool 상태, SSE envelope·delta, permission/question, 오류·수명주기의 근거와 한계를 읽을 수 있음 | 설치 타입/JS 심볼 대비 표 검토; 문서 예제와 계약 테스트 비교 | docs/INDEX → SDK 해설 → 공식 원문/배포 소스 |
| R-04 | AT-04 / AC4 | 레이어별 변경·보존 책임, 필드/이벤트 매핑, 단계별 gate·rollback·미결정을 식별할 수 있음 | 실제 Orca entry/contract/consumer와 가이드 대조 | 연구 index → 마이그레이션 가이드 → 코드·현재 arch |
| R-05 | AT-05 / AC5 | 관련 현재 문서가 SDK 설치와 runtime 미구현을 구분하고 기존 추측 예제를 실제 근거로 교체 | TRD/arch의 대상 문장 대조, docs inventory·상대 링크 검사 | docs/INDEX → TRD/arch/spec/연구 자료 |
| R-06 | AT-06 / AC6 | 기존 앱은 Claude 경로를 유지하며 새 SDK 호출은 테스트에만 있음 | production diff·import 검색과 기존 active descriptor 테스트 | AdapterRegistry → ClaudeAdapter → 기존 runtime/IPC |
| R-07 | AT-07 / AC7 | 검증 결과와 미확인 범위가 보고되고 설계·구현 커밋이 원격 브랜치에 게시됨 | 실제 gate 출력, trailer 파싱, push 후 remote SHA 대조 | 작업 트리 → git commit → origin/codex/opencode |

### AC 검증 주의사항

- `registry.test.ts`의 “describeActive() 는 활성 백엔드(claude)의 서술자를 반환” 케이스를 확인했다. 이는 활성 경로만 검증하며 앱 전체의 실기 대체물이 아니다.
- fake-fetch 테스트는 SDK 직렬화·응답/SSE 해석까지 검증한다. 서버 실행·재연결 복구·모델 품질·Electron 네트워크 통합을 검증했다고 보고하지 않는다.
- AC6은 무변경 검색만 쓰지 않고 기존 Claude descriptor의 실제 반환값을 함께 확인한다.
- 이번 범위에 사람 앱 실기는 없다. 향후 실제 서버 검증 항목을 가이드에서 명시하되 이번 완료 기준과 섞지 않는다.

## 7-A. V / Trace Matrix

기준 V가 없어 Baseline V를 만든다. 제품 산출물 R↔AT와 새 SDK 경계 AR↔IT를 포함하며, 앱의 상태기계·알고리즘을 바꾸지 않아 SD↔ST 및 MD↔UT 노드는 만들지 않는다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-07 | R | §7 각 행 | NEW | 이번 사용자 요청 |
| AT-01~AT-07 | AT | §7 각 R의 직접 oracle | NEW | 해당 R과 일대일 대응 |
| AR-01 | AR | 공개 SDK import·HTTP/SSE 계약, §10 EP-02 | NEW | 설치하는 배포 패키지 |
| IT-01 | IT | 실제 SDK + fake-fetch 통합, §11 | NEW | 신규 test-only 검증 |

### Pair registry

| Pair | left ↔ right | requiredness | production path start → edges → end | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | registry → manifest/lock → 설치본 | 조회 버전과 설치 해석 결과 일치 | not selected — 실제 버전 값 대조 | EP-01 (3) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | public export → client → fake HTTP | 요청 URL/body와 응답/오류값 | not selected — 직접 결과 단언 | EP-02 (2) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | docs index → spec → 원문·타입 | 각 계약 행에 해당 타입/JS 근거와 확인 수준 | not selected — 내용 대조 | EP-03 (4) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 연구 index → 가이드 → Orca 코드 | 레이어·mapping·단계·gate/rollback·미결정의 실제 근거 | not selected — 내용 대조 | EP-04 (2) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | docs index → TRD/arch → spec | 수정 대상 문장과 실제 상태 대조 | not selected — 내용 및 기존 링크 검사 | EP-05 (7) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | registry → ClaudeAdapter → descriptor | Claude active 반환, production diff·SDK import 스윕 | required — 테스트가 아닌 임시 파일에 SDK import를 넣어 음성 스윕이 검출하는지 확인 후 제거 | EP-06 (3) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | gate → commit → remote branch | 명령 결과·trailer·remote SHA | not selected — 실제 원격 상태 | EP-07 (3) |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | SDK exports → HTTP/SSE → client result | typed 호출·직렬화·오류·유한 SSE fixture | not selected — 직접 프로토콜 결과 단언 | EP-02 (2) |

§10의 괄호는 이번 조사 대상 지점 수이며 앱 인벤토리 수치가 아니다. 기존 V를 상속하지 않았으므로 INHERITED/REGRESSION 행은 없다; 기존 Claude 회귀는 AC6과 운영 게이트로 확인한다.

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 정적 | dependency 및 test-only TypeScript 추가 | `npm run lint`, `npm run typecheck` (app cwd) | 이번 변경 또는 명시 계약 위반 |
| SDK/Claude 계약 | public export와 기존 활성 경로 | 대상 `vitest run` (app cwd), §19 | 동일 |
| docs | 문서·링크·원문 미러 추가 | inventory 검사·검사기 테스트·원문 hash 대조 | 새/수정 문서의 정합성과 원문 보존 |
| repository/message-bus | 설계/구현 분리, 원격 공유 | diff check·trailer·remote SHA | 이번 산출물/커밋 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| Backend 실행 타입은 Claude 한정, ProviderId에는 OpenCode seam 존재 | `app/src/shared/ipc.ts`의 `Backend` / `ProviderId` |
| 활성 adapter는 Claude이며 LiveTurn·NormalizedEvent가 중간 계약 | `adapters/registry.ts`, `adapters/types.ts`, `shared/ipc.ts` |
| session runtime·fanout·DB·renderer는 별도 책임 | `features/sessions/session-runtime.ts`, `features/chat/turn-coordinator.ts`, `features/history/writer.ts`, 현재 provider-runtime 문서 |
| 원격 요청은 주입 가능한 Chromium fetch 경계 사용 | `app/src/main/infra/net/net-fetch.ts`, main AGENTS |
| npm 설치는 SQLite ABI postinstall을 실행 | `app/package.json`, `app/AGENTS.md`의 ABI 지침 |
| latest 조회 결과는 1.18.27이며 cross-spawn 의존성이 있음 | 2026-09-03 npm registry 조회; 배포 패키지에서 재확인 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 앱 manifest/lock SDK 기재 | `rg -n '@opencode-ai/sdk' app/package.json app/package-lock.json` | 0 | 신규 설치 필요 |
| 현재 Backend 선언 | `rg -n 'export type Backend' app/src/shared/ipc.ts` | 1 | `'claude'` 보존 |
| registry의 구체 adapter 생성 | `rg -n 'new [A-Za-z]+Adapter\(' app/src/main/adapters/registry.ts` | 1 | ClaudeAdapter만 생성 |
| SDK 상태/예제 정정 검토 문서 | TRD, backend overview/provider-runtime/standardization/adapters/security 대조 | 6 | 관련 계약·API 사실만 정정; 전체 아키텍처 재작성은 아님 |

SDK union은 설치 후 discriminant별로 조사한다. source tag와 npm tarball의 public export 차이는 설치본을 기준으로 설명하며, 소스 저장소의 package manifest만 보고 배포 패키지가 깨졌다고 판단하지 않는다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조

앱 실행 경로는 `AdapterRegistry → ClaudeAdapter → SessionRuntime/TurnCoordinator → NormalizedEvent → history/IPC → renderer`다.
Orca DB의 대화 기록과 외부 SDK resume context는 별도 책임이다.
SDK dependency는 없고, 일부 문서는 OpenCode의 미확인 예제를 예약 사양으로 제공한다.

### TO-BE — 이번 변경 후 구조

앱 실행 경로와 DB/IPC는 그대로다. 설치된 SDK의 public client는 테스트에서만 사용한다.
개발자의 조사 경로는 `docs/INDEX → SDK 해설 / migration 연구 → 공식 원문 / 실제 SDK / Orca 코드`가 된다.
후속 어댑터 권고 구조는 연구 문서에만 두고 실제 registry에 등록하지 않는다.

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | 변경 이유 | 연결 |
|---|---|---|---|---|
| 의존성 | OpenCode SDK 없음 | latest 확인 후 exact 설치 | 재현 가능한 분석 기반 | VP-01 |
| runtime/저장 | Claude, Orca DB | 유지 | D-004·D-005 | VP-06 |
| 외부 계약 자료 | 예약 예제·미설치 표기 | 버전 고정 해설, 확인/미확인 분리 | 사실 정정 | VP-03·VP-05 |
| 전략 자료 | 엔진 내부 연구 중심 | Orca 레이어별 전환·검증·rollback 가이드 | 구현 판단에 필요한 차이 제공 | VP-04 |
| 오류/수명주기 | 기존 Claude 처리 | 앱은 유지; SDK HTTP/SSE 의미를 테스트·문서화 | 구현 없는 계약 검증 | VP-02·VP-08 |

책임 삭제·이동은 없다. SDK 의존성은 main의 adapter 경계에서만 사용 가능한 기반이며 renderer/shared에 SDK 타입을 노출하지 않는다.

## 10. 계약 / 타입 / 강제 지점

| 지점 / V pair | 계약 | SSOT | 누가 / 언제 / 지점 전수 | 실패 의미 |
|---|---|---|---|---|
| EP-01 / VP-01 | 설치 시 latest와 exact 버전 일치 | npm 조회 결과 | 구현자: manifest, lock, 설치본 package (3) 대조 | 파일만 수정하거나 다른 버전 설치한 상태를 검출 |
| EP-02 / VP-02·VP-08 | public import·요청/응답·SSE·오류 계약 | 설치 패키지의 타입/JS | test-only SDK 검사, 해설의 예제 (2) | 타입 선언만 통과하고 wire 의미가 다른 경우를 직접 테스트; 실제 서버 보장은 제외 |
| EP-03 / VP-03 | 외부 사실과 확인 범위 | 버전 고정 원문·설치 코드 | SDK 해설, raw sdk.mdx, raw server.mdx, mirror INDEX/LICENSE (4 묶음) | 문서/배포 차이 또는 출처 누락; 미러 hash는 원문 보존만 보장 |
| EP-04 / VP-04 | 권고와 현재 구현 분리 | Orca 코드·D-004~D-007 | migration 가이드, 연구 00-index (2) | 권고가 채택 계약처럼 읽히거나 작업 순서/위험 누락 |
| EP-05 / VP-05 | 설치≠runtime 활성; 문서 탐색 가능 | manifest·registry·spec | TRD, backend overview/provider-runtime/standardization/adapters/security, docs INDEX (7) | 낡은 API 예제 또는 현재 상태 모순; 링크 검사만으로 내용 정합성은 보장 못함 |
| EP-06 / VP-06 | production 경로 유지 | 기존 코드 | manifest 외 production diff/import, shared Backend/IPC, registry active (3) | 직접 SDK 참조와 계약/활성 경로 변경 검출; 앱 전체 실기는 아님 |
| EP-07 / VP-07 | handoff 상태·trailer·원격 게시 일치 | INDEX와 git 원격 | plan 보고, INDEX 상태, commit trailer/remote (3 묶음) | 로컬 성공과 원격 성공 혼동 또는 독립 검증 가장 |

`throwOnError`·`responseStyle`·선택적 `undefined`의 의미는 설치 구현에서 확인한다. 문서에 단정하기 전에 성공·HTTP 실패·SSE fixture를 직접 관측한다.
새 production port나 정책 파라미터는 만들지 않는다. 여러 API 표면의 이벤트를 같은 스트림으로 취급하지 않는다.

EP-06의 import 관측은 `rg -n --glob '!*.test.ts' --glob '!*.test.tsx' '@opencode-ai/sdk' app/src`에서 일치 없음이 기대값이다.
이 스윕은 직접 package 참조를 검출하며 동적으로 조합된 import나 앱 전체 실행을 증명하지 않는다; production diff와 기존 활성 descriptor 검사를 함께 수행한다.
VP-06 변이는 신규 임시 `app/src/main/adapters/opencode-sdk-production-guard-probe.ts`에 SDK import를 두고 스윕의 검출을 관측한 뒤 그 파일만 제거한다. 테스트 파일은 정상 허용 대상으로 제외한다.

## 11. 구현 설계

| 작업 | 파일/책임 | 구현 순서와 검증 seam |
|---|---|---|
| T1. 최신 설치 | `app/package.json`, `app/package-lock.json` | latest 재조회 → exact install → public exports/import 확인 → npm ls·integrity 기록 |
| T2. 계약 검증 | `app/src/main/adapters/opencode-sdk.test.ts` (테스트 전용) | 설치 SDK의 공개 import, typed fake fetch, 유한 SSE fixture; Electron/DB import 없음 |
| T3. 공식/배포 분석 | `docs/opencode-sdk-spec.md`, `docs/spec/opencode/*` | raw mirror 확보·license/hash 기록 → 실제 dist와 root/v2/native 표면·타입·오류/stream 비교 |
| T4. Orca 전략 | `docs/etc/study/opencode/orca-migration-guide.md` | 레이어별 AS-IS/권고·필드/이벤트 mapping·capability gap·단계별 gate/rollback·미결정 작성 |
| T5. 문서 정렬 | §18의 기존 docs | stale SDK 상태/예제만 정정, SSOT 링크 및 탐색 경로 연결 |
| T6. 검증·공유 | plan/INDEX·git | 정적/대상 테스트·문서 게이트 → 내용 리뷰 → 구현 보고 → 별도 커밋·push |

T2에서는 SDK 자체 구현을 복제하지 않는다. 요청을 받는 fake-fetch에서 URL·method·body를 직접 단언하고, 응답/HTTP 오류·SSE envelope를 실제 client가 소비하게 한다.
취소 테스트를 추가한다면 request signal 전달·유한 스트림 종료까지만 잠그고 모델 턴 취소와 동치라고 주장하지 않는다.
기존 Electron/DB production 모듈을 테스트 편의상 재배치하지 않는다.

T4의 레이어 표는 composition root/boot, adapter, runtime/coordinator, auth·network, settings/model catalog, extensions/MCP, DB/history, IPC/preload, renderer를 각각 다룬다.
메시지 매핑은 ID·role·part·tool lifecycle·usage·permission/question·terminal/cancel을 구분하고, 대응 없음·부분 대응·추가 정책 필요를 표시한다.

## 12. End-to-end 영향

설치 패키지 → 타입/JS 대조 → SDK 해설 → Orca 코드 mapping → 후속 구현자의 설계 판단으로 이어진다.
현재 앱 producer/consumer에는 새 데이터가 흐르지 않는다. SDK raw 타입을 `NormalizedEvent`나 DB의 SSOT로 승격하지 않는다.

| 기존 소비처 | 영향 | 확인 |
|---|---|---|
| AdapterRegistry / backend:list | 등록자 증가 없음 | AC6 |
| SessionRuntime / TurnCoordinator / history | 입력·저장 포맷 유지 | production diff, AC6 |
| preload / renderer chat store·reducer | 공개 wire 유지 | production diff·typecheck, AC6 |
| 문서 독자 | 설치 상태와 미래 전략을 구분해 탐색 | AC3~5 |

## 13. Lifecycle / 오류 / 정리

서버 생성·quit cleanup을 구현하지 않는다. SDK helper가 CLI 실행을 요구하는지, 연결 전용 client의 책임이 무엇인지는 연구 결과에 명시한다.
설치 실패 시 manifest/lock/설치본을 대조하고 성공한 것으로 커밋하지 않는다; 일괄 reset이나 관계없는 dependency update로 복구하지 않는다.
push 실패 시 로컬 커밋을 보존하고 일반 push 재개 조건만 보고한다.

다중 쓰기는 manifest/lock/설치본, 원문/해설/라우팅, plan 보고/INDEX/trailer다. 중단 시 사본들이 일시적으로 불일치할 수 있으므로 commit 직전에 EP-01·EP-03~EP-05·EP-07을 대조한다.
설계 커밋에는 설계와 보드만 포함하고 구현 산출은 별도 커밋으로 묶는다. 다음 주체는 구현 완료 후 독립 검증자이며 `SELF_PASS`를 `verify/PASS`로 바꾸지 않는다.

## 14. 성능 / 상한 / 최적화

앱의 모델 요청·출력량 증가 없음. 테스트는 메모리 내 유한 HTTP/SSE 응답을 사용해 외부 모델 호출과 무한 재연결을 만들지 않는다.
문서 원문은 SDK·server 페이지와 라이선스로 한정한다. 불필요한 전체 SDK/웹사이트 vendoring·파일 수 목표는 두지 않는다.

## 15. 외부 구현 포트 / 문서 계약

새 외부 구현 포트는 없다. SDK 해설의 호출 예제가 후속 구현자의 진입점이다.
shape는 실제 공개 타입과 TypeScript 검사로, semantics는 fake-fetch의 직렬화/응답·오류/SSE 결과와 소스 대조로 확인한다.
공식 SDK 문서에 없는 배포 API는 공식 페이지의 주장과 구분하고 설치본 경로·심볼을 출처로 붙인다.

## 16. 기존 결정·규칙과의 관계

| 기존 규칙 | 출처 | 본문 적용 | 결과 |
|---|---|---|---|
| main DAG·renderer 격리 | main/renderer AGENTS | §9~12: test-only adapter 경계 | 유지 |
| Chromium fetch 단일 스택 | main AGENTS·net-fetch.ts | 향후 권고는 fetch 주입; 이번 테스트는 fake | 유지 |
| Orca DB 기록 SSOT | 현재 persistence·runtime 계약 | §9·12: 외부 resume context와 구분 | 유지 |
| Open Questions 단독 결정 금지 | docs AGENTS·PRD | D-007·AC4 | 유지 |
| 원문/해설 2단, arch 현재 상태 | docs/spec 및 docs AGENTS | §11·18 | 유지 |
| 문서 인벤토리 수치 재서술 금지 | docs AGENTS | 경로 링크 사용, 생성물 직접 편집 안 함 | 유지 |
| 설계/구현 커밋 분리 | handoff-plan | §13 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 작업 중 latest 이동 | 설치 직전 조회값을 고정하고 시각·버전 명시; 작업 내내 추적 업그레이드하지 않음 |
| root/v2/native 혼동 | import·endpoint·envelope별 별도 표; 한 표면의 예제를 다른 표면에 적용하지 않음 |
| 타입 존재를 운영 보장으로 오해 | 타입/소스 확인·mock 관측·미실행을 구분 |
| SDK fetch 주입을 서버의 모델 egress 통제로 오해 | client→server와 server→provider 네트워크 경계를 분리 설명 |
| npm postinstall ABI·네트워크 제약 | app ABI 지침 적용, 실패 근거 분리; 테스트 green을 위해 ABI 반복 전환 금지 |
| lockfile의 무관한 대량 변경 | scoped install 뒤 diff 검토; 무관한 upgrade 없음 |

신규 직접 의존성 `@opencode-ai/sdk`는 사용자 승인됨. SDK가 요구하는 전이 의존성은 lockfile로 기록하고, 별도 앱 라이브러리 추가가 필요하면 다시 묻는다.
데이터 포맷·공개 계약의 one-way door는 이번에 실행하지 않는다.

## 18. 영향 받는 파일 / 문서

- `app/package.json`, `app/package-lock.json`
- `app/src/main/adapters/opencode-sdk.test.ts` (신규 테스트)
- `docs/opencode-sdk-spec.md` (신규 해설)
- `docs/spec/opencode/sdk.mdx`, `server.mdx`, `LICENSE`, `INDEX.md` (신규 원문/출처)
- `docs/spec/AGENTS.md` (기존 벤더 매니페스트 행 추가; 규칙 변경 아님)
- `docs/etc/study/opencode/orca-migration-guide.md`, `docs/etc/study/opencode/00-index.md`
- `docs/INDEX.md`, `docs/TRD.md`의 SDK 상태·Backend/SessionAdapter 참조·§7.2·future anchor
- `docs/arch/backend/overview.md`, `docs/arch/backend/provider-runtime.md`의 OpenCode 상태·미확인 예제
- `docs/arch/backend/standardization.md`, `docs/arch/backend/adapters.md`, `docs/arch/backend/security.md`의 연관 API·현재 계약 사실 (후속 제품 정책은 유지)
- 이 plan과 `docs/handoff/INDEX.md`

## 19. 게이트

정본: `app/AGENTS.md`, `app/src/main/AGENTS.md`, `docs/AGENTS.md`, `docs/spec/AGENTS.md`, `docs/handoff/AGENTS.md`.
아래 app 명령은 모두 `app` cwd에서 실행한다.

```powershell
npm.cmd ls @opencode-ai/sdk --depth=0
npm.cmd run lint
npm.cmd run typecheck
npx.cmd vitest run src/main/adapters/opencode-sdk.test.ts src/main/adapters/registry.test.ts
node --test scripts/check-doc-inventory.test.mjs
node scripts/check-doc-inventory.mjs --check
```

repo cwd: `git diff --check`, staged diff check, 커밋 뒤 `git log -1 --format='%(trailers:only=true)'`, push 뒤 `git ls-remote --heads origin codex/opencode`와 HEAD 비교.
EP-06 production import 스윕은 위 §10 명령으로 실행하고 선택한 변이의 검출/제거 후 일치 없음까지 기록한다.
문서 원문은 버전 고정 URL의 bytes와 hash 대조한다. lint가 수정한 파일은 별도로 검토해 무관한 변경을 섞지 않는다.
`npm test`의 pretest는 ABI를 전환하므로 비-DB 대상 검사에서 쓰지 않는다; CLI/모델/Windows 패키징 실기는 실행하지 않은 범위로 보고한다.

## READY self-review

- [x] 사용자 원문과 D-001~D-007을 보존하고 §7 AC와 대조했다.
- [x] Part I의 설치·자료·현재 동작·공유 결과가 §9~19 실제 경로에 연결된다.
- [x] AS-IS/TO-BE/Delta가 의존성·runtime·자료·오류·검증을 같은 축으로 비교한다.
- [x] Baseline V의 NEW 노드가 같은 레벨 REQUIRED pair를 갖고 §10 지점과 연결된다.
- [x] §10은 사본 전부와 oracle 한계를 명시하며 단순 링크 검사를 내용 정합성 증거로 쓰지 않는다.
- [x] 신규 서버/정책/공개 계약을 만들지 않아 사람 실기나 제품 결정 없이 현재 범위를 검증할 수 있다.
- [x] package scripts·registry 테스트 케이스·Backend 선언·SDK 미기재를 직접 확인했다.
- [x] ACTIVE 결정 ↔ AC 충돌 없음; D-004의 runtime 제외와 AC6의 Claude 유지가 일치한다.
- [x] 작성된 설계 문서에 대한 사용자 검토 완료 — “진행하라”; READY로 전환.

설계 단계 관측: 문서 검사기 테스트 23/23, inventory/prose/상대 링크 검사 통과, `git diff --check` 오류 없음.
별도 읽기 검토에서 지적된 `features/sessions` 경로, EP-05 대상 분모, EP-06 import 관측을 정정했다. SDK 설치·app 정적/계약 검사는 아직 실행하지 않았다.

---

> 이하 구현 턴에서 채운다. 절차는 [handoff-impl](../../../.agents/skills/handoff-impl/SKILL.md)을 따른다.

## [구현자 기입] 설계 리뷰

미실행 — 작성 문서 검토 대기.

## [구현자 기입] 강제 지점 전수 (§10 대조)

미실행. EP별 닫은 지점·실제 재현 명령·남긴 지점과 VP별 자기 상태/직접 관측을 기록한다.

## [구현자 기입] 이번 라운드 수정의 잠금

미실행. 선택 증거·인용 변이·신규 구조적 oracle의 분모 검산과 덮개 회귀를 기록한다.

## [구현자 기입] Product/UX 파생 검토

미실행. 사용자 대면 문구, production 재배치, 실패 경로, 무응답/늦은 응답을 각각 판정한다.

## [구현자 기입] 놓친 잠재 문제 + 대응

미실행.

### 설계 대비 명시적 차이

미실행. 차이가 있으면 만료·공유·재진입·기타 무효화 축과 관련 AC/EP 재확인 근거를 기록한다.

## [구현자 기입] 구현 보고

미실행. 변경 파일, 명령과 관측 산출, VP/EP/AC 합계, 블로커를 기록한다.
대상 커밋은 `(r1 구현 — 좌표는 INDEX)`로 유지한다.

## [구현자 기입] Review Signals — 사실만

구현 라운드 시작 전. 반복 결함 축과 환경 제약은 실제 관측 이후 기록한다.

## [검증자 기입] 파생 이슈

독립 검증 전.
