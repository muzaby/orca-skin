# Plan — SRT 공통 실행 기반과 Claude 연결

## 메타

| 항목 | 값 |
|---|---|
| slug | `0220-srt-execution-integration` |
| 작성자 | Codex — 사용자 구현 요청에 따른 설계 위임 |
| 일자 | 2026-09-08 |
| 상태 | **DRAFT — 0219의 실제 stdin 실패와 SRT 수정 빌드 선택 선행** |
| V mode / 기준 V | Baseline V / none. 0219는 실행기 선행 조건이며 본 V의 상속 기준이 아님 |
| 이번 V revision / 유효 V | V1 초안 / READY 확정 전 |
| 조사 기준 | `5d8362d5` + 공유 작업 트리의 0219 P0 산출물 |
| 구현 순서 | A 공통 실행 기반 → A 검증 → B Claude 연결 → B 검증 |
| 전체 요구의 다음 단계 | 현재 확장·Main Git·다운로드 호환 → 제품 활성화·배포 검증. 이 plan 완료로 전체 요구 완료를 선언하지 않음 |

# Part I — Product & UX Contract

## 1. Context / 목표

이 단계는 Windows SRT로 실행할 수 있는 공통 기반과 현재 Claude 채널 연결을 만든다. 실행 준비 실패가 사용자 메시지를 소비하거나, 늦은 시작이 취소된 세션을 되살리지 않아야 한다.

완료 기준은 실행기 교체에 따른 채팅·보조 completion·수명주기 회귀를 통제된 composition 경로에서 검증하는 것이다. 일반 제품 활성화는 현재 도구·플러그인까지 검증하는 후속 필수 작업 뒤에 둔다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | SRT만 사용하며 Windows native로 실행한다. WSL·Docker 등 다른 격리 기술을 도입하지 않는다 | 2026-09-08 라이브 세션 |
| 명시 요구 | 가볍고 모듈화하며 현재 Claude·도구·플러그인, 이후 OpenCode·cowork와 연결할 수 있어야 한다 | 라이브 세션, [채택 제안](../../etc/study/srt/orca-adoption-proposal.md) |
| 구현 승인 | 최종 제안에 대해 “구현하라” | 라이브 세션 |
| 기계 작업 승인 | 이 PC의 SRT 관리자 설치를 “진행하라” | 라이브 세션. 제품 전체 자동 관리자 설치 승인으로 확대하지 않음 |
| 설계 해석 | 공통 기반과 Claude 연결을 먼저 검증하고 현재 확장 호환·제품 활성화까지 계속한다 | 상위 작업자와 2026-09-08 범위 확인 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 |
|---|---|---|---|---|
| D-001 | SRT Windows native만 사용한다 | 실패 시 다른 sandbox나 비격리 spawn으로 fallback하지 않음 | 사용자 | ACTIVE |
| D-002 | SDK `query()`·승인·in-process MCP는 Main에 유지한다 | CLI 실행만 공통 lease로 교체하는 최소 변경 | 채택 제안 §3·5 | ACTIVE |
| D-003 | 정책 범위와 revision별 trusted utilityProcess가 SRT manager를 소유한다 | SRT 모듈 전역 상태를 세션 간 덮어쓰지 않음. 별도 Node 설치 없음 | 채택 제안 §3·4 | ACTIVE |
| D-004 | 기존 다중 세션·idle LRU·interrupt 의미를 유지한다 | helper를 줄이기 위한 직렬화·idle TTL·허용 경로 합집합을 추가하지 않음 | 채택 제안 §8·11 | ACTIVE |
| D-005 | 불변 실행 descriptor와 가변 lease를 분리한다 | continuation 재조립이 반납된 lease를 계승하지 않게 함 | 현재 코드 조사 §8 | ACTIVE |
| D-006 | A 실행 기반 검증 뒤 B Claude 연결을 구현한다 | 공통 엔진에 SDK·artifact UI·새 scheduler를 넣지 않음 | 상위 범위 확인 | ACTIVE |
| D-007 | 현재 도구·플러그인·Main Git·Confluence 파일 전달은 전체 요구의 필수 후속이다 | 이 단계의 미완성 경로를 제품 기본 동작으로 활성화하지 않음 | 상위 범위 확인 | ACTIVE |
| D-008 | 기존 env/settings 우선순위와 `settingSources:['project','local']`를 유지한다 | SRT 예약 환경만 최종 경계에서 보호하고 사용자 지정 충돌은 명시 실패 | 코드·0117·제안 §6 | ACTIVE |
| D-009 | CLI transcript 상태는 helper·policy generation보다 오래 보존한다 | LRU/reset 때문에 새 세션으로 바뀌거나 컨텍스트가 유실되지 않음 | 제안 §6·8 | ACTIVE |
| D-010 | Main 원격 통신은 Chromium transport를 유지한다 | SRT 하위 실행용 Node proxy는 별도 경계이며 기업망 호환은 실증 대상 | main AGENTS·제안 §6 | ACTIVE |
| D-011 | THIS PC provisioning만 승인됐다 | 평상시 실행은 비관리자, 앱 부팅 자가 승격·자동 설치 없음 | 사용자 | ACTIVE |
| D-012 | 공유 SID의 workspace 상호 기밀성을 보장하지 않는다 | helper 분리·policy hash는 Windows 보안 주체 분리가 아님 | 제안 §10·P0 조사 | ACTIVE |
| D-013 | 시험용 composition injection만 제공한다 | 미완성 기능을 gate하려고 영속 설정·UI·새 환경 플래그를 만들지 않음 | 상위 범위 확인 | ACTIVE |
| D-014 | 제품 전체 provisioning·업데이트·제거 정책 | 명시 수동 provisioning은 가능, 자동 관리자 배포 정책은 미승인 | 제안 §13 | OPEN — 제품 활성화 전 |
| D-015 | 공식 SRT Windows stdin 보완 빌드의 채택·업데이트 책임 | 실제 0.0.75 입력 0-byte로 공식 artifact 그대로는 지속 입력 불가 | [실증과 보완안](../../etc/study/srt/windows-preflight-findings.md) | OPEN — 공통 기반 구현 전 |

갱신 판정: 기존 제안의 SRT-only·경량화·현재 확장 호환 요구를 유지한다. ACTIVE↔AC 대조는 D-001~006→AC1~6, D-007/013→AC9, D-008~010→AC5~8, D-011/012→AC1/9로 연결되며 반대 요구는 없다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| SDK 전체 이전이 필요한가 | 불필요 | 설치 SDK `Options.spawnClaudeCodeProcess`는 동기 custom spawn을 지원함 |
| 기존 실행기로 이미 되는가 | 실행 격리는 추가 필요 | `claude.ts:277,365`의 두 query는 SDK 기본 실행 경로 |
| hook만 더하면 되는가 | 부족 | `session-runtime.ts:338`의 제출 경계와 `runtime-entry.ts:80`의 선행 respawn 판정은 별개 |
| completion은 제목뿐인가 | 아님 | `prepare-worktree.ts:109`의 worktree 이름 생성도 같은 adapter를 소비 |
| 즉시 제품 활성화 가능한가 | 불가 | 현재 guard의 host 홈 예외와 Confluence 다운로드 경로는 후속 호환 작업이 필요 |
| P0 성공을 전제해도 되는가 | 불가 | 실제 SRT 결과는 아직 이 plan의 evidence가 아님 |

제품 자동 설치 정책은 D-014에 남긴다. P0 실패가 실행 구조·정책을 바꾸면 이 문서를 수정하고 READY를 다시 판단한다.

## 5. 동작 / 사용자 흐름

```text
시험 composition이 SRT execution provider 주입
  → 최종 cwd·확장·환경 해석 → 정책 snapshot 비교 → 기존 pending/respawn 판정
  → cold 채널만 비동기 lease 준비 → 취소·generation 재검사
  → 동기 SDK 제출 → stream/승인/도구 → warm 채널 재사용
  → dispose/LRU/quit → 실행 종료 → 정리 완료 회수
```

| 사건 | 동작 | 관측 결과 |
|---|---|---|
| 실행 준비 실패 | SDK 제출 전 실패, pending rollback | 기존 오류 경로로 원인을 표시하고 같은 메시지를 재시도 가능 |
| 준비 중 취소·세션 닫기 | 준비 signal 취소, 늦은 lease 즉시 반납 | 뒤늦은 프로세스·echo·메시지 commit 없음 |
| 같은 정책의 후속 턴 | 기존 채널 유지 | steer·승인·서브태스크·listen 연속 동작 |
| 정책·cwd·env 변경 | 메시지 배치 선택 전 old channel 폐기 | 이전 채널 잔여 배치는 기존 respawn 이월 규칙 사용 |
| 사용자 interrupt | SDK 턴 제어 | 다른 세션·helper·채널을 일괄 종료하지 않음 |
| 제목 실패 | 보조 실행 반납 | 기존 제목 유지, 본 대화 성공 상태 유지 |
| worktree 이름 생성 실패 | 기존 fallback 정책 유지 | 실패 원인 기록, 보조 프로세스 잔존 없음 |
| 앱 종료 | admission freeze부터 시작해 tracked 작업 drain | 제목 DB 쓰기와 SDK 종료가 DB/log 종료보다 먼저 끝남 |
| helper 손실·정리 불명 | 해당 실행 실패 및 새 acquire 차단 | 비격리 실행이나 성공 정리로 오인하지 않음 |

새 화면·키보드·테마 계약은 해당 없음. 기존 오류 surface를 재사용하되 raw argv/env/frame을 사용자 메시지·로그로 전달하지 않는다.

## 6. 범위 / 비범위

| 범위 | 이번 단계 |
|---|---|
| A 공통 기반 | typed lease, immutable policy, helper pool, MessagePort stream, P0 bootstrap 재사용, dev/packaged 경로 검증 |
| B Claude | chat와 complete custom spawn, 두 complete producer, async fence, 기존 channel 수명, sandbox state·guard 투영 |
| 회귀 보존 | SDK Main callbacks, normalized event·approval·pending pipeline, 기존 비주입 composition 동작 |

| 필수 후속 / 비범위 | 이번에 남기는 연결점 | 완료 조건 |
|---|---|---|
| 현재 전체 확장·interpreter·stdio/HTTP MCP·native plugin·Main Git | policy assets/network/guard, 등록된 trusted tool 경계 | 실제 현재 기능 호환 실증 뒤 활성화 |
| Confluence 다운로드→Read | 관리 staging 경로만 미리 제공 | trusted `PublishedFileRef`·invocation context는 후속에서 실제 소비 경로와 함께 도입 |
| 기존 host CLI transcript 선택 이관·교차 workspace fork | 지속 state resolver 및 명시 origin 정보 | 승인된 세션만 이관·재개 검증. host 홈 전체 허용 금지 |
| 기업망·제품 배포 | 고정 executable/CA/upstream 입력 포트 | PAC·인증·mTLS 자동 지원 선언 금지, 실제 대상 환경 확인 |
| OpenCode·cowork | SDK 중립 stdio/server 실행 계약 | 각각 별도 handoff. 새 공통 엔진·artifact DB/UI는 만들지 않음 |

이 단계는 새 sandbox 상태에서 생성한 세션의 재개·동일 state namespace 내 fork를 검증한다. 과거 host 이력과 확장 전체가 아직 지원되지 않는다는 사실을 이유로 사용자 요청 전체를 완료 처리하지 않는다.

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 유효 policy에서 실제 exe가 SRT 안에서 실행되며 준비·자산·정책 실패 시 실행되지 않는다 | 실제 fixture access/exit 관측, 실패 시 PID 부재 | provider→pool→helper→SRT→bootstrap→exe |
| R-02 | AT-02 / AC2 | SDK와 무관한 stdio 프로그램 및 loopback server가 동일 공통 실행 포트로 동작한다 | 실제 두 fixture의 입력·출력·server readiness 및 종료 | fixture consumer→lease.start |
| R-03 | AT-03 / AC3 | 준비 중 취소/close/세대 교체가 메시지를 제출하지 않고 lease를 회수한다 | 지연 acquire를 제어하여 late PID·echo·commit 및 반납을 관측 | runAttempt→prepare→fence→sendMessage |
| R-04 | AT-04 / AC4 | warm/interrupt/listen은 채널을 유지하고 정책 변경은 배치 예약 전에 old 채널을 내린다 | 실제 pending 배치 상태·채널 token·이벤트 소속 검증 | runtime-entry/continuation→pending→SessionRuntime |
| R-05 | AT-05 / AC5 | chat와 제목·worktree completion 모두 custom spawn을 사용하고 completion 종료 때 반납한다 | SDK 경계에서 받은 핸들로 실제 protocol fixture 왕복, 각 producer 오류·취소 | sendMessage / title / prepare-worktree→query |
| R-06 | AT-06 / AC6 | LRU·respawn 후 새 sandbox 세션 resume/fork가 같은 backend 컨텍스트를 읽는다 | 지속 state 내 실제 Claude 재개/분기, 원본 transcript 불변 | session→state resolver→CLAUDE_CONFIG_DIR→CLI |
| R-07 | AT-07 / AC7 | 허용된 state/assets 경로에서 계획 파일·Read가 가능하고 host 홈 예외는 sandbox guard에 섞이지 않는다 | RO/RW 교차 사례, 정규화·reparse fixtures, guard와 SRT 결과 별도 관측 | snapshot→guard 및 SRT fs policy |
| R-08 | AT-08 / AC8 | quit/크래시/cleanup 실패를 회수하며 늦은 title DB 쓰기와 자손 잔존을 검출한다 | 실제 Electron helper 종료 및 process tree, 종료 순서 spy+지연 completion | index→Bootstrap shutdown→pool drain→log/DB |
| R-09 | AT-09 / AC9 | 기존 일반 composition에 임시 설정을 추가하지 않고 시험 주입 경로에서만 새 실행을 검증한다 | 주입/비주입 wiring 행동 테스트, 후속 activation gate 문서 대조 | bootstrap/deployment composition |

기존 회귀 케이스는 §8에 실제 확인된 행동만 인용한다. 실제 SRT/Claude/Electron 검증은 OS token·native 실행·SDK 프로토콜 때문에 필요하며 순수 로직 테스트를 대신하지 않는다.

## 7-A. V / Trace Matrix

Baseline V로 신규 경로를 정의하며 기존 V 없는 런타임 회귀는 코드·테스트 기준으로 출처를 고정한다. READY 전에 P0와 §19의 미정 선행 조건을 닫는다.

### Node registry

| Node | 레벨 | 계약 / 본문 | provenance | 기준선 |
|---|---|---|---|---|
| R-01~09 / AT-01~09 | R / AT | §7의 각 행 | NEW | 본 V1 초안 |
| SD-01 / ST-01 | SD / ST | §5·13 실행 준비·사용·종료 수명 | NEW | 본 V1 초안 |
| SD-02 / ST-02 | SD / ST | §5 warm/interrupt/승인/listen·pending 의미 | INHERITED | 현재 session-runtime 테스트, §8 |
| AR-01 / IT-01 | AR / IT | §9·10 Main→helper→native stream 경계 | NEW | 본 V1 초안 |
| AR-02 / IT-02 | AR / IT | §10 producer snapshot→respawn→SDK/guard/state | NEW | 본 V1 초안 |
| AR-03 / IT-03 | AR / IT | §10 completion producers→pool→shutdown | NEW | 본 V1 초안 |
| MD-01 / UT-01 | MD / UT | §10 policy canonicalization·env projection | NEW | 본 V1 초안 |
| MD-02 / UT-02 | MD / UT | §10 lease·protocol·epoch·credit 상태기계 | NEW | 본 V1 초안 |

### Pair registry

| Pair | left ↔ right | requiredness | start → edges → end | 직접 oracle | 선택적 적대 증거 | §10 지점 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | injection→SRT→exe | 허용/거부 fixture 결과·실제 PID | 미선택 — 직접 접근 oracle | EP-01,03,04 (3) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | SDK 없는 consumer→lease→stdio/server | bytes·HTTP 응답·종료 | 미선택 — 실제 왕복 | EP-02,03,04 (3) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | cold request→await→fence→submit | pending 미소비·late start 차단·반납 | 미선택 — 지연 제어로 직접 재현 | EP-05 (1) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 정책 resolve→respawn→pending→채널 | 배치 UUID/token/소속 | 미선택 — 상태 직접 관측 | EP-06,07 (2) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | chat/title/branch-name→query→lease | 모든 producer의 실행·반납·오류 | required — 각 query의 spawn 주입 제거가 해당 fixture 테스트 실패인지 확인 | EP-08,09,10 (3) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | new session→LRU→resume/fork | CLI 컨텍스트·원본 이력 보존 | 미선택 — 실제 재개 결과 | EP-11 (1) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | snapshot→guard/SRT→file access | RO/RW 허용·거부 결과 | 미선택 — 직접 접근 결과 | EP-01,12 (2) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | quit/disconnect→drain→close stores | 모든 owned PID 종료·late DB write 없음 | 미선택 — 실제 lifecycle 관측 | EP-02,13,14 (3) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | composition→adapter wiring | 주입 경로 동작, 비주입 기존 회귀 | required — 시험 composition 배선 제거 시 positive fixture 실패 | EP-15 (1) |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | cold→warm→dispose/crash→drain | state/started/exited/closed 순서 | 미선택 — 이벤트·PID 직접 관측 | EP-02~05,11,13,14 (7) |
| VP-11 | SD-02 ↔ ST-02 | REGRESSION | pending/approval→warm/listen/interrupt | 기존 echo·approval·task 제어 결과 | 미선택 — 기존 행동 oracle | EP-06~08 (3) |
| VP-12 | AR-01 ↔ IT-01 | REQUIRED | Main port→utility→SRT→bootstrap | 바이트/EOF/exit·stderr tail·queue 상한 | 미선택 — 실제 pipe+credit 제어 | EP-02~04 (3) |
| VP-13 | AR-02 ↔ IT-02 | REQUIRED | policy→first/continuation→SDK/state/guard | 동일 snapshot, 변경시 먼저 teardown | 미선택 — 각 consumer 결과 비교 | EP-01,05~08,11,12 (7) |
| VP-14 | AR-03 ↔ IT-03 | REQUIRED | title/branch completion→quit | 보조 lease 소유·최종 DB 쓰기 차단 | 미선택 — 지연 completion 직접 제어 | EP-09,10,13 (3) |
| VP-15 | MD-01 ↔ UT-01 | REQUIRED | raw inputs→canonical descriptor/env | 예약키·대소문자·root·revision 사례 | 미선택 — 순수 함수 결과 | EP-01,04,12 (3) |
| VP-16 | MD-02 ↔ UT-02 | REQUIRED | acquire/start/release/messages→state | 중복·순서역전·취소·queue overflow 결과 | 미선택 — 상태기계 직접 제어 | EP-02~05,14 (5) |

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 증거 | 실패 범위 |
|---|---|---|---|
| main subtree | 계약·lifecycle·배선 변경 | lint·typecheck·관련 Vitest | 이번 코드 및 명시 회귀 |
| scripts/native/build | frame 재사용·utility 별도 entry·실행 자산 | Node scripts tests·native probe·Electron packaged fixture | 실제 전달/asar/asset 로드 실패 |
| repository/docs | 현재 경계·guide·문서 링크 | doc inventory·diff check | 이번 문서/코드 변경 |
| message-bus | plan/INDEX 두 상태 사본 | 별도 설계 커밋·trailer parsing | 상태 불일치·규범/구현 혼합 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 | 근거 |
|---|---|
| custom spawn은 Promise를 반환할 수 없다 | 설치 SDK `sdk.d.ts:2053,6665,6717`의 `SpawnedProcess`·`SpawnOptions` |
| SDK abort 신호는 graceful EOF 뒤 전달될 수 있다 | 같은 타입의 `SpawnOptions.signal` 주석. 임의 raw turn signal로 active CLI를 먼저 kill하지 않음 |
| cold 제출은 동기, warm push는 별도 경로 | `features/sessions/session-runtime.ts:286~365` |
| listen은 runAttempt를 통과하지 않는다 | 같은 파일 `runListen` |
| respawn 비교가 enqueue보다 앞이다 | `app/chat-turn/runtime-entry.ts:80`, `send.ts:286` |
| 자동 연속 턴도 새 settings/env를 해석한다 | `app/chat-turn-continuation.ts:42~84` |
| title은 현재 fire-and-forget이며 자체 30초 signal을 갖는다 | `features/chat/title-generation.ts:34~75` |
| worktree 이름 completion은 원본 cwd에서 선행한다 | `app/chat-turn/prepare-worktree.ts:102~117` |
| shutdown은 현재 동기이며 뒤에 log/DB close가 온다 | `app/bootstrap.ts:738~772`, `main/index.ts:278` |
| main 빌드 entry는 기본값이고 native 실행 경로는 asar 밖이어야 한다 | `electron.vite.config.ts:28`, `electron-builder.yml`의 SDK `asarUnpack` |
| guard는 host `.claude` RW 및 Orca config RO를 기본 예외로 갖는다 | `adapters/workspace-guard.ts:29~84` |
| SDK query와 in-process 도구는 Main에 있다 | `adapters/claude.ts`, `claude-runtime-tools.ts` |
| security.md의 user settings 상속 서술은 현재 코드와 다르다 | `security.md:91,102,178` 대 `claude.ts:255~269` |

### 전수 조사

| 대상 | 방법 | N | 해석 |
|---|---|---:|---|
| 실제 query 호출 | `rg 'query\(' app/src/main --glob '!*.test.ts'`, 주석 제외 | 2 | `claude.ts` completion/chat |
| 실제 adapter.complete producer | `rg 'adapter.complete\(' app/src/main --glob '!*.test.ts'` | 2 | 제목, worktree 이름 |
| 실제 decideRespawn 호출 | `rg 'decideRespawn\(' app/src/main --glob '!*.test.ts'`, 함수 선언 제외 | 2 | runtime-entry, 자동 continuation |
| live close 강제 경로 | `session-runtime.ts`의 close·teardown·finishPump·consumeTurnScoped·초기 commit 실패 검사 | 5 | 각각 lease 반납 귀속 필요 |

기존 테스트 확인: `session-runtime.test.ts`의 warm push·queue fence·interrupt·현재 턴 delegate·old generation drop, `respawn-policy.test.ts`의 unchanged reuse, `claude-executable.test.ts`의 unpacked 경로를 확인했다. `claude.test.ts`·`title-generation.test.ts`라는 통합 파일은 현재 없으며 신규 seam 테스트를 만든다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
app: resolve/worktree → runtime-entry respawn → pending enqueue
  → SessionRuntime → ClaudeAdapter query → SDK 기본 CLI spawn
app: worktree 이름 / features: title → ClaudeAdapter complete → query
index will-quit → Bootstrap.shutdown 동기 → log close → DB close
```

RuntimePool은 SessionRuntime을 LRU로 소유하며 별도 idle TTL이 없다. CLI env/settings·guard·plugin 옵션은 adapter가 조립하고 query callback은 Main에서 실행된다.

### TO-BE

```text
app: policy snapshot → first/continuation respawn → pending
  → SessionRuntime cold acquire → epoch fence → ClaudeAdapter query(Main)
  → claude-process sync handle → infra host-client → utilityProcess
  → srt-owner → SRT native runner → P0 bootstrap → CLI + descendants
completion producers → explicit scope → complete acquire/finally release
index quit barrier → freeze + cancel titles + runtime close → pool drain → log/DB
```

SRT import는 helper의 `srt-owner`에서만 실행한다. Main의 pool은 lifecycle만 소유하며 SRT manager·SDK·extension 코드를 함께 로드하는 host는 만들지 않는다.

| 비교 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 실행 책임 | SDK 기본 spawn | SDK Main 유지 + 공통 실행 포트 | AR-01 / EP-03,08 |
| 실행 구성 | settings/env fingerprints | 기존 축 + 별도 policy key | AR-02 / EP-01,06,07 |
| 수명 | LiveTurn close | runtime-local lease 반납·closed 추적 | SD-01 / EP-05,14 |
| 종료 | 동기 shutdown | 즉시 freeze 후 비동기 drain barrier | AR-03 / EP-13 |
| 파일 경계 | host 예외 guard | 동일 policy에서 state/assets guard 투영 | MD-01 / EP-12 |

## 10. 계약 / 타입 / 강제 지점

### 공통 계약의 SSOT

신규 `main/infra/sandbox/types.ts`는 SDK·세션·DB 타입을 import하지 않는다. 아래는 내부 타입 방향이며 최종 shape를 typecheck fixture로 잠근다.

```ts
type ExecutionScope = Readonly<{
  scopeId: string
  policyKey: string
  cwd: string
  stateDir: string
  stagingDir: string
  readRoots: readonly string[]
  writeRoots: readonly string[]
  pluginRoots: readonly string[]
  network: Readonly<{ allowedDomains: readonly string[] }>
  assetRevision: string
}>
type LaunchSpec = Readonly<{
  executable: string
  args: readonly string[]
  cwd: string
  env: Readonly<Record<string, string>>
}>
interface PreparedExecution {
  readonly scope: ExecutionScope
  start(spec: LaunchSpec): ManagedProcess // 동기 proxy, Promise 금지
  release(): void // 멱등 반납 요청
  readonly closed: Promise<CleanupResult> // 실패를 성공으로 변환하지 않음
}
```

`ManagedProcess`는 Node Readable/Writable·started/exited·idempotent terminate를 갖고 SDK 이벤트는 `claude-process.ts`에서 변환한다. `CleanupResult`는 `{kind:'clean'}` 또는 `{kind:'failed',code:string}`이며 raw stderr·token을 넣지 않는다.

lease 하나는 한 query/process 실행을 소유하며 `start()` 재호출은 거부한다. 같은 helper를 사용하는 제목은 별도 lease를 획득하므로 한 lease 반납이 다른 실행을 종료하지 않는다.

`scopeId`는 실행 소유자 identity이며 policy hash나 cwd 문자열로 대체하지 않는다. 신규 세션은 기존 provisional/chain owner에 연결한 identity를 세션 확정 뒤에도 유지하고, scope 변경이 없는 ID 확정만으로 helper를 다시 만들지 않는다.

`ExecutionScope`는 Main 내부 불변 descriptor이며 `TurnRequest`·`CompleteRequest`·`TurnContext`로 전파한다. lease는 공유 요청/DB/IPC에 저장하지 않고 `SessionRuntime` cold 채널 옆 필드에만 보관한다.

`SessionAdapter.prepareExecution?(req: TurnRequest): Promise<PreparedExecution>`는 optional 포트이고 `RuntimeSessionAdapter` Pick에 포함한다. `sendMessage(req, execution?: PreparedExecution)`의 두 번째 인자는 runtime이 cold 호출에서만 전달하며, SRT provider가 주입된 Claude는 누락된 descriptor/lease를 즉시 거부한다.

기존 mock·비주입 adapter 경로는 optional 포트가 없으면 기존 계약을 유지한다. `complete()`는 자체 acquire/finally release를 수행해 보조 실행을 RuntimePool에 넣지 않는다.

### EP registry

| EP / pair | 계약 | SSOT / 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| EP-01 / VP-01,07,13,15 | canonical paths·policy key·권한 입력 | app policy resolver + infra policy-key | first cwd 확정 뒤, continuation resolve 뒤 | 미검증 root/누락 policy는 시작 거부 |
| EP-02 / VP-02,08,10,12,16 | scope+revision helper·lease owner | host-pool | acquire/release/drain/port disconnect | 충돌/중복 반납/불명 정리의 새 실행 차단 |
| EP-03 / VP-01,02,10,12,16 | protocol·generation·byte credit | host-client + helper entry | prepare/start/stdin/stdout/exit/terminate | 순서 위반·상한 초과·stale message를 해당 실행 실패로 정착 |
| EP-04 / VP-01,02,10,12,15,16 | bootstrap frame·env projection | P0 encoder/native validator + projection | start 전·bootstrap 파싱 | 예약키/잘못된 exe/env는 child 미생성 |
| EP-05 / VP-03,10,13,16 | async prepare fence·lease 소유 | SessionRuntime | cold prepare 앞뒤, commit 실패, close/teardown | 취소/epoch mismatch는 release 후 제출 안 함 |
| EP-06 / VP-04,11,13 | first policy 비교 | runtime-entry→respawnInputs | enqueue/prelude 선택 전 | old channel 사용 금지, 기존 pending rollback |
| EP-07 / VP-04,11,13 | continuation policy 비교 | chat-turn-continuation→respawnInputs | listen/flush 예약·분기 전 | stale policy listen/push 금지 |
| EP-08 / VP-05,11,13 | chat custom spawn·callback 유지 | ClaudeAdapter + claude-process | sendMessage query options | 주입 mode의 lease 부재는 직접 spawn 대신 실패 |
| EP-09 / VP-05,14 | title scope·보조 취소 | TurnContext→TitleGenerator→complete | title 시작/종료/shutdown | 취소 뒤 제목/DB 갱신 금지 |
| EP-10 / VP-05,14 | worktree 이름 provisional scope | prepare-worktree composition callback | worktree 생성 전 complete | source cwd 기반 one-shot만 준비, 채팅 policy로 오인 금지 |
| EP-11 / VP-06,10,13 | persistent state namespace | app state resolver→Claude env | 최초 생성·LRU resume·fork·reset | temp 삭제와 transcript 삭제 분리 |
| EP-12 / VP-07,13,15 | guard scope·settings/env 의미 | resolved policy→workspace guard/adapter | sandbox hook 조립·spawn env 투영 | host 기본 예외 추가 금지·사용자 예약키 충돌 명시 |
| EP-13 / VP-08,10,14 | 종료 barrier | index + Bootstrap + TitleGenerator | before-quit 재진입·early boot failure·normal quit | drain 전 log/DB 종료·late 작업 차단 |
| EP-14 / VP-08,10,16 | cleanup health | srt-owner→host-pool | 마지막 lease·helper crash·reset failure | reset resolve만으로 ACL 정리 완료 선언 금지 |
| EP-15 / VP-09 | 시험 주입·미활성화 범위 | explicit composition dependency | adapter 생성·packaged fixture entry | 숨은 env/setting fallback·일반 배포 자동 활성화 금지 |

정책 키는 canonical cwd/roots·자산 및 plugin revision·endpoint 정책·권한 revision을 포함하되 raw secret은 포함하지 않는다. 기존 settings/env fingerprint는 독립 비교 축으로 남기며 미해석/null을 임의 empty policy로 치환하지 않는다.

## 11. 구현 설계

### A — 공통 실행 기반부터 닫는다

| 신규/변경 파일 | 책임 | 검증 seam |
|---|---|---|
| `main/infra/sandbox/types.ts`, `policy-key.ts` | 공통 타입·순수 policy 비교·예약 env 투영 | Electron 없는 UT |
| `main/infra/sandbox/host-pool.ts` | lazy helper·scope/revision·lease/refcount·drain | injected host factory·시계 없이 deferred lifecycle |
| `main/infra/sandbox/host-client.ts` | MessagePort 제어 및 stream credit, process proxy | 실제 MessageChannel/Node pipe fixture |
| `main/infra/sandbox/srt-owner.ts` | pinned SRT initialize/wrap/reset, isolated singleton owner | helper 내 실제 SRT fixture |
| `main/app/sandbox-host-entry.ts` | `process.parentPort` 배선만 수행 | Electron utilityProcess fixture |
| `main/infra/sandbox/utility-host.ts`, `runtime-assets.ts` | Electron fork 어댑터·dev/packaged 실제 경로 해석 | 별도 순수 path resolver 및 packaged smoke |
| P0 `scripts/sandbox-launch-frame.mjs`·native launcher | 현행 wire 재사용 | main 번들에서 재사용 가능한 SSOT 위치로 이동하면 P0 test import도 함께 이동; validator 복제 금지 |
| `electron.vite.config.ts`, `electron-builder.yml` | 기존 main entry 유지 + helper entry, 고정 native 자산 unpack/copy | `out/main/index.js`와 helper 실기; asar 내부 exe 실행 금지 |

utilityProcess는 Main이 지정한 절대 modulePath·제한 env·`stdio:'pipe'`로 fork한다. stdin pipe는 없으므로 실행 입력/제어는 MessagePort를 쓰고 utility stdout은 진단 전용으로 SDK stdout과 섞지 않는다.

helper가 SRT 준비 완료를 답한 뒤 lease를 반환한다. `start()`는 즉시 streams를 반환하고 첫 native launch frame을 후속 SDK bytes보다 먼저 쓴다.

제어 protocol은 `prepare/ready/start/started/data/credit/end/terminate/exited/error/release/closed`의 닫힌 union으로 두고 version·scope·generation·request ID를 검사한다. unknown 타입·중복 start·closed 뒤 data는 해당 실행 실패이며 모든 진단은 code와 비밀 없는 식별자만 사용한다.

초기화는 `ready` 전 부분 성공도 정리 대상으로 등록하며 실패하면 생성한 runner/port/temp를 회수한다. scope의 파일 정책은 SRT initialize 시 고정하고 실행별 wrap 호출로 변경하지 않는다.

SRT/launcher 실행 파일은 패키지 관리 경로의 실제 절대경로를 해석해 `windows.srtWin.path`와 고정 bootstrap shell에 전달한다. helper 부팅에서 install/provision을 실행하지 않으며 Main 전체 env 대신 필요한 최소 env를 전달한다.

### B — Claude 접점을 연결한다

| 신규/변경 파일 | 책임 | 검증 seam |
|---|---|---|
| `main/app/chat-turn/prepare-execution.ts` | 원본/실제 cwd·extensions·harness config→snapshot | injected fs/state/asset resolver |
| `main/adapters/turn.ts`, `types.ts`, `contracts/ports.ts`, `contracts/turn.ts` | immutable scope 전파·cold 실행 포트 | 타입 fixture, mock 기존 계약 |
| `main/features/sessions/session-runtime.ts` | cold acquire fence·runtime-local lease·closed 추적 | 기존 runtime 테스트 + 지연 acquire |
| `respawn-policy.ts`, `app/chat-turn/respawn-inputs.ts` | spawned policy key 독립 비교 축 | 순수 UT |
| `runtime-entry.ts`, `chat-turn-continuation.ts`, `continuation.ts`, `turn-request.ts`, `send.ts` | first/listen/flush 동일 snapshot, pending 전 판정 | 실제 pending queue 조립 IT |
| `main/adapters/claude-process.ts`, `claude.ts` | SpawnedProcess bridge·두 query의 custom spawn | SDK contract fixture, live-control 회귀 |
| `main/adapters/workspace-guard.ts` | sandbox 전용 guard roots 인자, 기존 비주입 의미 유지 | RO/RW·extra-dir 테스트 |
| `main/features/chat/title-generation.ts`, `prepare-worktree.ts` | 두 completion producer scope·tracked cancellation | 신규 순수 포트 테스트 |
| `main/app/bootstrap.ts`, `main/index.ts` | explicit provider injection·title 추적·async shutdown barrier | Electron 부트 없는 shutdown orchestrator seam |

shared 타입·renderer·DB migration은 추가하지 않는다. provider-neutral 이름을 쓰되 OpenCode adapter나 host plugin registry를 먼저 만들지 않는다.

## 12. End-to-end 영향

첫 채팅은 worktree 생성/복구 후 실행 cwd로 snapshot을 만들고, respawn 판단 후 메시지를 적재한다. 자동 continuation은 기존 fresh env/settings와 같은 시점에 snapshot을 갱신해 listen/flush 둘이 같은 값을 사용한다.

worktree 이름 생성은 최종 cwd를 기다릴 수 없으므로 app이 원본 cwd의 최소 RO·state·backend 정책을 가진 provisional one-shot scope를 만든다. 완료 또는 취소 후 반납하며 최종 채팅 scope에 가변 lease를 넘기지 않는다.

제목은 채팅 scope descriptor를 계승하되 실제 title provider/env가 다르면 policy 입력을 다시 검증한다. 정책이 동일하면 같은 helper를 빌리고, 다른 경우에는 별도 revision으로 취급한다.

| 기존 소비자 | 변경 | 회귀 |
|---|---|---|
| RuntimeSupervisor·RuntimePool | close 동기 요청 유지, async closed는 sandbox pool이 회수 | LRU·stop-all·세션 폐기 |
| TurnCoordinator·PendingMessageQueue | descriptor 전달만, 제출 commit 의미 유지 | echo commit·retry·held/flush |
| TitleGenerator | signal·작업 집합 추적 | 사용자 수동 제목 우선·실패 graceful |
| WorktreeService naming callback | explicit one-shot descriptor | 이름 fallback·취소·원본 cwd |
| RuntimeToolSnapshot/SDK hooks | Main 객체 유지 | 승인·schema·callback 현행 회귀 |

## 13. Lifecycle / 오류 / 정리

`SessionRuntime`은 준비 시작 때 별도 preparation epoch를 캡처하고 close/teardown에서 이를 무효화한다. 채널 token은 실제 채널이 생긴 뒤 발급되므로 preparation epoch 대신 사용할 수 없다.

cold acquire 뒤 signal·runtime closed·epoch·scope key·`canSubmitInitial`을 다시 검사한다. 그 뒤 `canSubmitInitial → sendMessage → commitInitialSubmission` 사이에는 새 await를 넣지 않는다.

초기 synchronous throw/commit 실패, turn-scoped finally, finishPump, teardownChannel, close는 채널 lease 정리 helper 하나로 수렴한다. warm 및 listen은 새 lease를 얻지 않으며 정책 비교는 이미 EP-06/07을 통과해야 한다.

`markAborted`는 준비 단계에서는 대기 acquire를 취소하고 실행 뒤에는 기존 SDK interrupt를 유지한다. SDK custom `SpawnOptions.signal`의 graceful 의미를 보존하며 이미 실행한 채널에 raw turn abort를 직접 연결하지 않는다.

helper port 단절은 실행 트리 terminate·SRT reset을 요청한다. Main이 살아 있는 동안 runner PID와 cleanup receipts를 추적하고, helper 강제 종료처럼 정리 결과를 증명하지 못한 경우 pool을 unhealthy로 두어 새 acquire를 막는다.

quit는 재진입 가능한 `before-quit` barrier로 admission freeze→scheduler/title 취소→열린 도구 정착→active/idle channel close→pool drain→log flush/DB close→최종 quit 순서를 지킨다. drain 제한시간이 지나면 성공으로 처리하지 않고 미정리 진단을 남기며 P0에서 검증된 child termination을 시도한다.

다중 저장소: Orca DB와 CLI transcript는 원자적으로 쓰지 않는다. DB가 사용자 transcript SSOT이고 CLI state 실패는 재개 실패로 드러내며, helper reset/LRU는 두 저장소를 삭제하지 않는다.

새 sandbox state namespace는 stable backend+원본 workspace identity로 해석하고 temp/staging/generation과 분리한다. 선택 이관·교차 workspace fork 정책이 없는 host 과거 세션은 시험 주입 경로에서 명시 거부하고 일반 기존 경로의 데이터를 변경하지 않는다.

문서 상태 사본은 이 plan 메타와 `docs/handoff/INDEX.md` 두 곳이다. INDEX는 상위 작업자가 소유하며 READY 전 같은 판정으로 맞춘 뒤 별도 설계 커밋을 만든다.

## 14. 성능 / 상한 / 최적화

| 대상 | 초안 상한 / 의미 |
|---|---|
| launch frame | P0 wire의 payload 1 MiB·field count 4096을 그대로 재사용 |
| data message | 한 frame 64 KiB 이하, 각 방향 1 MiB credit window, consumer read/write 완료 후 ack |
| 메모리 | 실행당 stdin/stdout/stderr 3개 window 합 3 MiB + bounded control/diagnostic. 입력을 무제한 MessagePort 큐에 쌓지 않음 |
| helper 수 | 기존 runtime capacity를 composition에서 공유하고 provisional 이름 생성 1개 여유. title은 동일 scope 재사용; 상한 소진은 명시 시작 실패 |
| 실행 수 | 각 helper에서 persistent channel과 보조 completion만, 별도 예열 pool 없음 |
| 시간 | prepare 30초·drain 20초 초안. 사용자 승인 대기에는 timeout을 적용하지 않음 |

위 queue/timeout 값은 설계 상한이며 성능 실측 결과가 아니다. P0 결과와 실제 Electron stream 부하 시험이 이 상한을 만족하지 못하면 READY 전에 조정한다.

## 15. 외부 구현 포트 / 문서 계약

외부 plugin manifest 표준은 추가하지 않는다. 실행 포트는 app 내부 composition이 구현하고 SDK 없는 두 프로그램의 fixture가 shape와 started/error/exit/release 의미를 검증한다.

후속 OpenCode는 같은 lease로 `opencode serve`를 띄우고 adapter가 client/readiness/HTTP/SSE를 소유한다. 공통 엔진은 HTTP/SSE protocol·model·prompt·tool schema를 해석하지 않는다.

## 16. 기존 결정·규칙과의 관계

| 규칙 | 본문 처리 | 판정 |
|---|---|---|
| main DAG·feature 교차 금지 | §9 app 조립, infra는 feature/SDK 비의존 | 유지 |
| Main Chromium 단일 전송 | §3 D-010, helper SRT proxy만 별도 경계 | 유지, security 문서 명시 필요 |
| idle 시간 회수 폐기 | §5 warm/idle, §13 lease 수명 | 유지 |
| user settingSources 배제 | §3 D-008, §10 EP-12 | 유지, security.md 낡은 상속 설명만 정정 |
| host `.claude` guard 예외 | §10 EP-12 | 비주입 현행 유지, sandbox 경로만 관리 state로 투영 |
| 신규 의존성 승인 | P0에서 고정 SRT/native 채택 | 새 SDK/RPC/런타임 패키지 추가 없음 |

## 17. 리스크 / 트레이드오프

| 리스크 | 판단 |
|---|---|
| P0 실제 SRT 실패 | 다음 구현 선행 gate. fixture unit PASS로 대체 금지 |
| SRT reset의 정리 불명·공유 SID | helper 로컬 오류로 축소 금지, 새 실행 차단·실제 cleanup 확인 |
| Main 도구·SDK 자체는 trusted | sandbox를 모든 Main 코드의 보안 경계라고 표현하지 않음 |
| state 이동·현재 확장 권한 | 부분 동작을 제품 활성화하지 않음. 후속 필수 목록 §6 |
| utilityProcess bridge 비용 | 새 Node runtime·SDK 복제 대신 작은 MessagePort 계약 사용, 실제 latency/메모리 비교 |
| SDK args에 이미 포함된 settings secret | bootstrap의 신규 노출과 구분. raw frame/argv 로그 금지 |

## 18. 영향 받는 문서

- `docs/arch/backend/provider-runtime.md`, `adapters.md`: 실제 구현 후 execution lease와 현재 연결 경로.
- `docs/arch/backend/security.md`: Main/SRT 전송·credential/guard 경계와 낡은 settingSources 설명.
- `docs/guides/workspace-isolation-permissions.md`: sandbox mode와 기존 hook 검사 범위 구분.
- `docs/etc/study/srt/orca-adoption-proposal.md`: 연구 제안과 실제 채택 단계 링크만 갱신.
- `docs/handoff/INDEX.md`: 상위 작업자 소유. P0 결과·본 단계·후속 미완료 상태 구분.

## 19. 게이트 / READY self-review

**DRAFT 유지.** 0219 실제 SRT 결과와 아래 선행 항목이 닫히기 전 코드 구현을 시작하지 않는다.

| 선행 항목 | 현재 판정 | READY에 필요한 관측 |
|---|---|---|
| P0 실제 argv/env/fs/network/독립 자손/ACL 정리 | 실제 stdin 0-byte, bootstrap exit125 | [실증과 보완안](../../etc/study/srt/windows-preflight-findings.md)의 SRT 입력 보완 선택·실제 전달 성공이 먼저 필요 |
| helper 강제 종료 때 runner 소유·cleanup 확정 | 설계 검증 필요 | 실제 P0 Job 결과와 helper death 의미를 대조, 모호한 cleanup을 성공으로 만들지 않는 회수 경로 확정 |
| 지속 state namespace·Claude config 위치 | 구현 전 contract 검증 필요 | pinned CLI의 `CLAUDE_CONFIG_DIR`에서 새 세션→resume/fork 경로 확인 |
| helper·queue·timeout 상한 | 초안 | P0 기반 포트/runner 자원 한계와 §14 대조 |

게이트 정본은 `app/AGENTS.md`와 `app/src/main/AGENTS.md`다. lint/typecheck는 ABI 중립이며 비DB 테스트는 직접 Vitest·Node로 실행하고 불필요한 `npm test` ABI 전환을 피한다.

구현 검증: 관련 sandbox UT/IT→runtime/respawn/Claude/guard/title/worktree regression→실제 utility/native SRT ST→통제된 Claude AT 순서다. packaged smoke는 실제 Electron·asar 밖 자산을 사용하며 plain Node mock으로 대체하지 않는다.

운영 명령은 `npm run lint`, `npm run typecheck`, 관련 `vitest run`, `node --test`의 scripts suite, `node scripts/check-doc-inventory.mjs --check`, `git diff --check`다. build/native/packaged gate는 현재 ABI와 P0 asset 경로를 확인한 뒤 명시 실행하고 실패가 환경 제한인지 코드 회귀인지 분리한다.

교차검증: §7의 AC1~9는 VP-01~09에 연결되고 신규 SD/AR/MD는 VP-10,12~16, 기존 SD는 VP-11 회귀에 연결된다. EP-01~15의 producer/consumer는 §11 파일표와 대응하며 D-007/013의 단계 완료와 전체 완료를 구분한다.

---

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: 미착수.
- 이견 / 현실성 문제: 미착수.
- ACTIVE Decision과 충돌하는 설계 발견: 미착수.

## [구현자 기입] 강제 지점 전수 (§10 대조)

미착수. READY 후 EP-01~15별 구현 위치·직접 관측·남은 지점을 기입한다.

## [구현자 기입] V-pair 자기확인

미착수. VP-01~16의 SELF_PASS/SELF_BLOCKED와 evidence를 기입한다.

## [구현자 기입] 이번 라운드 수정의 잠금

미착수. VP-05/09의 선택 변이와 새 구조적 oracle의 민감도를 기록한다.

## [구현자 기입] Product/UX 파생 검토

미착수. 오류 surface·late 결과·scope 수명·§5 전이 대응을 기록한다.

## [구현자 기입] 놓친 잠재 문제 + 대응

미착수. 신규 필수 계약은 PLAN_GAP으로 설계자에게 되먹인다.

### 설계 대비 명시적 차이

미착수. 변경 시 만료·공유·재진입·다른 무효화 축을 각각 기록한다.

## [구현자 기입] 구현 보고

미착수. 실행 명령·실제 관측·AC 분모·강제 지점·blocked 원인을 기입한다.

## [구현자 기입] Review Signals — 사실만

미착수. 현재 라운드 0.

## [검증자 기입] 파생 이슈

미검증.
