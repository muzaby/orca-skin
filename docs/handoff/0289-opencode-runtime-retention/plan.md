# Plan — 0289-opencode-runtime-retention

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex — 사용자 지시로 handoff-plan 수행 / 2026-10-27 |
| 상태 / 라운드 | ΔV1 DRAFT / 1. r1 구현은 IMPL_DONE이며 독립 검증은 ΔV1 구현 뒤 함께 수행(D20) |
| V mode / revision | Baseline V1 + Delta V ΔV1(DRAFT, Claude 2026-10-28). READY 전까지 유효 V는 V1 |
| 기준 V / 유효 V | V1 = 0289:V1@57c841b0 / V1 + ΔV1(READY 후). V1은 0288 전체 검증을 승계하지 않는다 |
| 조사 코드 | 공유 브랜치 orca-0288-cross-harness-mcp-plan, 24e79f7a. git cat-file -t 및 pull --ff-only 확인 |
| 이전 계약 출처 | 0288 V1@801f27f6, 0275 ΔV6@79ccc64 — 존재 확인. 변경·보존 관계는 §16 |
| 산출 경계 | V1 설계 + r1 구현 자기보고. AC22의 실제 앱/타 PC 인수·독립 verify는 후속 |

# Part I — Product & UX Contract

## 1. Context / 목표

**기존 준비 자원을 화면보다 오래 유지한다.** 화면 이동·첫 대화 생성·MCP 토글 때 불필요한 초기화를 줄이고, 정상적인 관측 취소가 오류로 표시되지 않게 한다. 반복 여부는 프로세스·instance·HTTP·브릿지 관측으로 판정하며 특정 밀리초를 SLA로 채택하지 않는다.

## 2. 사용자 의도 / 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “재사용 계층은 이미 5중으로 존재한다.” “설계 결함이 아니리 수명 결함이다.” | 최초 사용자 진단 원문 |
| 명시 제약 | “성능 개선이 공개 계약/세션 데이터 포맷을 바꾸지 않게.” | 최초 사용자 제약 |
| 관측 정정 | “전송 경로에서 서버 재기동 없다. 서버재사용은 동작한다.” | 최초 메시지의 실측 추가 |
| 범위 확정 | “제안 1~6 전체를 이번 계획에 포함. 라이브 토글과 부팅 시 외부 MCP 연결도 포함” | 이번 세션 사용자 응답 |
| 설계 재량 | “제안 아이디어에 대해서는 너가 더 좋은 방법을 제안해봐라”, “계속 진행하라” | 이번 세션 후속 |
| 오류 보고 | nav OpenCode 대화 진입·작업경로 instance 생성 시 native-resources의 취소/목록 오류 | 최초 메시지 말미 |
| 설계 해석 | 문제를 서버 재기동 하나로 단정하지 않고, 소유 수명·준비 중복·관측 취소·설정 변경을 분리 | 아래 §4 및 [조사 증거](research.md) |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 |
|---|---|---|---|---|
| D01 | 제안 1~6 및 0288 취소 오류를 이번 구현 범위로 묶는다 | 단계별 구현·측정은 분리 | 사용자 범위 응답 | ACTIVE |
| D02 | 기존 directory 수명에 idle 보유를 추가하고 server/context/bridge 의존 자원을 함께 보존 | 서버만 보존하면 instance/cache 재초기화, bridge 재발급은 profile miss | 사용자 TTL 아이디어를 구체화한 설계 | ACTIVE |
| D03 | idle 유예는 마지막 실제 소비자 해제부터 90초, 유휴 directory 상한은 adapter 전체 4개 | 유예를 계층별로 누적하지 않음. active·획득 중·정리 중은 eviction 대상 아님 | 사용자 60~120초 범위 + 내부 정책 | ACTIVE |
| D04 | renderer 구독 해제는 즉시 논리 해제, 내부 정리는 비동기 | 화면 종료·보조 complete/history 반환을 TTL만큼 지연시키지 않음 | 수명 분리 설계 | ACTIVE |
| D05 | 준비 공유는 실제 cwd·실행 profile·agentKind·설정 세대가 같은 경우만 | sessionId만 바뀌면 재사용 가능. worktree·provider·env가 달라지면 분리 | 사용자 lease 계승 아이디어 보완 | ACTIVE |
| D06 | 두 catalog 진입은 하나의 main 준비 서비스와 부분별 슬롯을 사용 | owner ID 문자열만 같게 만드는 것으로 끝내지 않음 | 사용자 통합 아이디어 | ACTIVE |
| D07 | MCP on/off는 연결 선택 revision, 정의·인증·경로 변경은 실행 정의 revision | OpenCode만 연결 선택을 live 적용. Claude의 기존 다음 턴 적용 유지 | 사용자 live 토글 승인 | ACTIVE |
| D08 | 진행 중 턴·승인·백그라운드 작업이 있는 공유 directory는 토글 적용을 대기 | 다음 제출 전 적용 장벽. 인증 철회는 기존처럼 즉시 새 호출 차단 | 0288 D-006 보존 + 경합 설계 | ACTIVE |
| D09 | 관리 MCP 정의는 안정된 비활성 설정으로 투영하고 원하는 연결을 별도로 적용 | 처음부터 off인 항목도 on 가능, on/off가 pool key·bridge token을 바꾸지 않음 | 설치 SDK·버전 고정 upstream 근거 | ACTIVE |
| D10 | native 전역 토글도 live 적용하되 프로젝트 명시 설정이 우선 | 프로젝트 파일 자동 쓰기·프로젝트 제어 UI 추가 없음 | 기존 우선순위 보존 + 사용자 토글 범위 | ACTIVE |
| D11 | 취소는 내부 제어 결과로 처리하고 stale 결과는 채택하지 않는다 | 취소를 성공한 빈 목록으로 가장하지 않음. 실제 실패의 오류 경로는 유지 | 0288 오류 재현 | ACTIVE |
| D12 | 디스크 캐시는 의존 파일 manifest+내용 revision으로 관리 | mtime만으로 동일성 판단 금지. 파일 부재·생성·삭제·설치 변경 포함 | 사용자 fingerprint 아이디어 보완 | ACTIVE |
| D13 | 부팅 후 gate가 허용되면 마지막 OpenCode 랜딩의 작업경로 하나를 비동기 준비 | 기존 lastBackend/lastCwd와 기본 provider 사용. 전체 프로젝트 스캔·모델 prompt 없음 | 사용자 부팅 외부 MCP 연결 승인 | ACTIVE |
| D14 | IPC payload/응답 shape·세션 DB·native 저장 포맷·모델 선택을 바꾸지 않는다 | 내부 포트·관측 freshness·수명만 변경 | 사용자 제약 | ACTIVE |
| D15 | 소유 process만 종료, 인증 격리·철회·실패 후 명시 retry 유지 | token을 전역 고정 문자열로 만들거나 강제 pool hit를 만들지 않음 | 0275·0288 기존 계약 | ACTIVE |
| D16 | 구현 전후 같은 시나리오의 사건 수를 남긴다 | n=1 시간차를 효과 크기로 일반화하지 않음 | 사용자 관측 제약 | ACTIVE |
| D17 | 첫 send는 연결 중인 MCP를 최대 2초 기다린 뒤 진행한다. 이번 메시지가 @언급한 MCP만 연결/실패까지 기다리고(취소 가능), 늦게 붙은 MCP는 다음 step/턴부터 쓴다 | OpenCode 내부 대기가 남으면 효과 없음 — 실현 수단은 D18 | ΔV1 사용자 결정 1: "2초 상한 + @언급 대기" | ACTIVE |
| D18 | 전역 MCP 연결을 OpenCode lazy 초기화에서 분리하는 방식 | 사용자: "글로벌로 사용하련느 mcp는 모드 enable 되어있고 사용자는 llm이 모든 도구를 사용할수 있다고 생각하낟. Lazy가 문제라면 이것을 뒤엎을 다른 대안은 없는지" — [대안 A1~A5](research.md#d18-대안-비교) | ΔV1 사용자 결정 2 응답 | OPEN |
| D19 | 랜딩 외 디렉터리의 연결 시작 시점은 설계자가 정한다 | D18 확정 때 함께 고정 | ΔV1 사용자 결정 3: 무선호 | ACTIVE |
| D20 | 0289를 ΔV1로 갱신하고 r1 독립 verify는 ΔV1 구현 뒤 한 번에 수행한다 | verify 대기 중 새 설계 피드백 도착 → 순서는 사용자 선택 | 사용자: "289를 업데이트 하라" | ACTIVE |
| D21 | 바꾸지 않는다: snapshot:false·share:disabled 강제(native-storage.ts:13), idle 90초, definitions/connections revision 분할, mcpFreshMs 5초. 실측으로 확인된 서버·instance 재사용, slot hit, owner 차감, idle 보유, live reconcile을 회귀시키지 않는다 | 실측에서 설계대로 동작 | 사용자 실측 §3·§6 | ACTIVE |
| D22 | 검수는 같은 시나리오 재실행과 [perf] 로그 첨부다. 통과 = turn 클릭→MCP 제출 허가 2초 이내. mcp HTTP 절대값이 줄지 않아도 send가 기다리지 않으면 통과하며, HTTP 총량 증가는 그대로 보고한다 | "기다림 제거가 목표이지 status 단축이 아니다" | 사용자 실측 §6 | ACTIVE |
| D23 | 디렉터리 간 중복 연결과 동시성 A/B를 조사·보고하고, 서버 키 분할(c) 원인은 낮은 우선순위로 추적한다 | 분할 비용은 spawn 1.4초로 작음 | 사용자 실측 §5-3·§5-4 | ACTIVE |

### 갱신 메모

기존 사용자 가설을 확정 사실로 승격하지 않았다. 이번 범위는 사용자 응답으로 전체 구현까지 설계하도록 확정됐으며, 이후 구현 착수 승인을 요구하는 문서가 아니다.

ACTIVE 결정 ↔ AC 대조: D01→AC1~22, D02~04→AC3~6, D05~06→AC7~9, D07~10→AC10~14, D11→AC1~2, D12→AC15~16, D13→AC17~18, D14~15→AC19~21, D16→AC22. 반대 의미의 AC 없음.

**ΔV1 갱신 메모 (DRAFT, 2026-10-28).** 사용자 실측 피드백으로 D17~D23을 추가했고 D18이 OPEN이라 READY가 아니다. 근거는 [ΔV1 조사](research.md#δv1-조사--2026-10-28-실측-피드백)다.

| 피드백 주장 | 판정 | 근거 |
|---|---|---|
| send가 `channel.prepare`의 MCP 대기에 묶임 | 부분 정정 — submit도 같은 직렬 큐라 prepare 제거만으로는 불변 | `mcp-control.ts:38-48,77-92` |
| 첫 메시지 = MCP 잔여 + 모델 | 맞음, 단 Orca만의 직렬화가 아님 | OpenCode `session/prompt.ts:1225-1262` |
| 경합이 MCP 시간을 66~84초로 부풀림 | 근거 약함 — mcp−agents가 4/5에서 59.3~60.8초 상수 | research ΔV1 차이 표 |
| history 경로가 MCP slot을 읽음 | 정정 — 진입 시 트리거는 컴포저 `useNativeResources` | `adapter.ts:338-379`, `useNativeResources.ts:27` |
| 웜업을 랜딩 1개로 제한 | 이미 충족 | `opencode-warmup.ts:44-59` (D13) |
| 검수 "클릭→submit-applied 2초" | 대리지표 위험 — Orca가 안 기다려도 OpenCode가 기다림. D22는 유지하고 ΔV1 AC에 OpenCode 루프 구간 관측을 추가할 예정 | `session/prompt.ts:1186-1199` |

D08의 "다음 제출 전 적용 장벽"은 D17과 연결(on) 축에서 충돌한다. off 장벽 유지 여부와 D08의 SUPERSEDED 범위는 D18 확정 뒤 ΔV1 READY에서 판정한다.

## 4. 요구 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 화면 이동마다 서버가 반드시 재시작하는가 | 아니오. 가설과 실제 사건을 구분 | 사용자의 전송 경로 관측, server pool hit·channel pushTurn |
| server.ts의 마지막 release에 TTL만 넣으면 충분한가 | 아니오 | instance release가 abort/dispose하고 context finish가 캐시를 삭제 |
| bridge token을 앱 전체에서 고정하면 되는가 | 부적절 | 인증·정의 세대 격리가 필요. 보유 중 generation만 유지 |
| draft→session마다 모델 HTTP가 반복되는가 | 조건부 | renderer state는 새로 생성되지만 하위 composer model slot이 살아 있으면 HTTP hit |
| 모든 deployExtensions가 revision을 올리는가 | 아니오 | managed-source.refresh의 fingerprint 동등성 검사 |
| 두 owner를 같은 객체로 바꾸면 충분한가 | 아니오 | 서로 다른 owner·scope 문자열의 작업도 공유할 main 실행 target이 필요 |
| mtime+기존 watcher면 모든 디스크 변경을 잡는가 | 아니오 | global watcher는 plugin entries만, project watcher는 현재 cwd 파일만 |
| 취소 오류를 catch해 빈 배열로 바꾸면 되는가 | 아니오 | 철회된 관측·실제 연결 실패·성공한 empty가 섞임 |

사용자에게 다시 올릴 미정 제품 결정은 없다. 사용자가 전체 범위와 더 나은 설계 제안을 승인했으며, 위 정책은 기존 저장·승인 계약 안의 구체화다.

## 5. 동작 / 사용자 흐름

~~~text
앱 부팅 → gate 통과 + 마지막 backend=OpenCode
 → 랜딩과 같은 target 해석 → prepare agents/models/MCP → 내부 idle 보유
랜딩 진입 → 같은 target에 attach → 화면 이동은 관측만 detach
 → 90초 안 재진입/첫 send → 준비된 instance·슬롯·bridge 사용
 → 마지막 소비자 해제 90초 후 native dispose → matching event → context/server/bridge 회수

설정 변경 → 의미 분류
 ├ on/off만: 원하는 값 저장 → 공유 directory가 안전해질 때 connect/disconnect → 관측 방송
 └ 정의/인증/설정 변경: 이전 준비 결과 무효화 → 다음 준비/턴은 새 profile
~~~

| 사건 | 동작 | 사용자 관측 |
|---|---|---|
| 화면 종료 중 조회 완료 | 해당 owner 결과 폐기, 다른 owner 계속 | 취소 오류 토스트 없음 |
| 활성 화면에서 revision 교체 | 최신 세대로 한 번 재시도, 이전 성공은 읽기 전용으로 보존 | 빈 목록으로 순간 삭제하지 않음 |
| 실제 설정/네트워크 실패 | 동일 세대의 마지막 성공 보존 + 기존 partial/error 처리 | 실제 실패를 취소로 숨기지 않음 |
| draft→session, 같은 실행 target | snapshot·실행 lease 공유 | 모델/에이전트 선택·초안·첨부 유지 |
| worktree/provider/env 변경 | 새 target 준비, 이전 snapshot 실행 권한 해제 | 다른 경로의 연결/모델을 사용하지 않음 |
| on/off, 모두 idle | 연결 API 적용 후 상태 확인·기존 이벤트 방송 | 서버 PID·대화는 유지, 후보는 실제 연결을 따름 |
| on/off, 공유 peer가 busy | desired는 저장, configurationPending으로 기록 | 현재 작업 유지, 다음 제출은 적용 완료 뒤 |
| connect/disconnect 실패 | desired 저장값과 실제 관측을 구분 | connected로 낙관 표시하지 않음. 다음 명시 재시도 가능 |
| idle 만료/상한 초과 | idle만 정리. 정리 시작 후 재획득은 완료를 기다림 | 다음 진입은 정상 cold 준비 |
| 앱 종료/서버 실패 | 타이머·웜업 취소, 소유 자원 강제 정리 | 종료를 TTL만큼 늦추지 않음 |

## 6. 범위 / 비범위

범위는 정상 취소 처리, 기존 directory 수명 연장, 준비 통합·승격, MCP 조회 슬롯, managed/native 전역 토글, 디스크 조사 캐시, 부팅 웜업, 안전한 진단이다. 하나의 handoff 안에서 §11 순서로 구현하며, 먼저 로그를 넣어 현상을 다시 기록한다.

비범위는 새 MCP 편집 UI, native 프로젝트 토글 허용, CLI 업그레이드, 세션 DB migration, 새 설정 스키마, 전체 프로젝트 웜업, 모델 응답 속도 개선, Claude 수명 정책 변경이다. 0288 독립 verify 전체는 별도 의무로 남긴다.

## 7. Requirements / Acceptance — R ↔ AT

O1~O11은 §11의 구현자가 만들거나 확장할 직접 oracle이다. H1만 실제 CLI·타 PC 환경 인수이며, 순수 로직을 H1로 미루지 않는다.

| R / AT | AC | 동작 기준 | 검증 수단 | production 경로 |
|---|---|---|---|---|
| R1 / AT1 | AC1 | pending 조회 중 마지막 구독 해제는 초안/저장 세션 모두 정상 관측 종료. raw 취소 예외·토스트 없음 | O1·O9, 재현 원문의 반대 기대값 | nativeResources→prepared→owner→UI |
| R1 / AT1 | AC2 | 활성 owner의 교체는 최신 세대로 재조회. 과거 성공·실제 실패·성공 empty를 구분 | O1·O2·O9 | invalidation→read→serial fence |
| R2 / AT2 | AC3 | 같은 profile/cwd로 90초 내 재진입하면 동일 process·instance generation·bridge endpoint, 완료된 초기 슬롯 재사용 | O3·O10 | pool→context→directory→bridge |
| R2 / AT2 | AC4 | 90초 경계·idle cap eviction은 native 정리 ack+event 뒤 회수. active peer는 유지 | O3 | idle→disposing→disposed |
| R2 / AT2 | AC5 | 논리 release는 TTL을 기다리지 않고 완료. 취소한 waiter의 늦은 결과는 폐기하고 peer는 성공 | O2·O3 | consumer release→retained dependencies |
| R2 / AT2 | AC6 | retire·치명적 서버/instance 실패·quit는 해당 세대 재사용을 금지하고 타이머를 정리. 늦은 old cleanup이 새 generation을 삭제하지 않음 | O3·O11 | retire/close→pool/context/bridge |
| R2 / AT2 | AC7 | 같은 draft의 첫 session 승격은 모델 snapshot·진행 조회를 계승. cwd/profile 변화는 별도 준비 | O2·O9·O10 | session.updated→chatStore→catalog |
| R2 / AT2 | AC8 | catalog와 native 준비가 같은 target을 병렬 조회하면 하나의 준비 flight·부분별 조회를 공유 | O2·O4·O10 | 두 IPC→shared preparation |
| R2 / AT2 | AC9 | live MCP 읽기는 같은 슬롯 사용. mutation/명시 refresh/5초 freshness 만료 때만 갱신하고 실패는 retry 가능 | O4·O9 | channel→lease.mcp→slot→HTTP |
| R3 / AT3 | AC10 | managed MCP pure on/off는 process·instance·bridge를 교체하지 않고 실제 tool 가용성을 바꿈 | O5·O6·O10 | mcpUpdate→source→reconcile→MCP |
| R3 / AT3 | AC11 | 처음 off인 등록 MCP도 on 가능. off 동안 연결/도구 호출 없음, metadata와 연결 상태 혼동 없음 | O5·O11 | definitions→disabled projection→connect |
| R3 / AT3 | AC12 | native 전역 on/off도 live 적용하되 project 명시값 우선. native 파일 쓰기 없음 | O5·O7 | extensionSetEnabled→directory controls |
| R3 / AT3 | AC13 | busy peer·background·queued/wakeup이 있으면 토글 대기. 사용자/연속/명령 제출과 충돌하지 않음 | O5·O6 | activity→barrier→submit |
| R3 / AT3 | AC14 | add/delete/rename/edit/auth/env/config 변경은 새 실행 정의. 이전 진행 턴 보존, 다음 사용자/자동 턴 최신 적용 | O6·O11 | source→restart policy→spawn |
| R4 / AT4 | AC15 | 같은 dependency revision의 병렬 조사는 파일 내용·설치 metadata를 한 번만 읽고 독립 결과 반환 | O7 | configured/global/install readers |
| R4 / AT4 | AC16 | 생성/삭제/rename/동일 mtime 내용 교체/조상 .git 변경/설치 교체 후 최신 결과. 오래된 flight가 덮어쓰지 않음 | O7 | manifest/watch→fingerprint→read |
| R5 / AT5 | AC17 | gate 허용 후 마지막 OpenCode 랜딩 한 곳만 준비. 랜딩 동시 진입과 공유하고 사용자 입력을 막지 않음 | O8·O10 | boot/gate→same preparation |
| R5 / AT5 | AC18 | Claude 마지막 선택·CLI 없음·gate 차단·종료에서는 웜업 연결 없음. 실패는 foreground 재시도 가능 | O8·O11 | eligibility→start/cancel |
| R6 / AT6 | AC19 | public IPC shape·DB/native 파일·세션/도구 승인 계약 유지. Claude 기존 동작 회귀 없음 | O6·O9·O11 | preload→main→SDK/storage |
| R6 / AT6 | AC20 | 다른 profile/auth/native storage/cwd는 격리. 인가 철회 후 오래된 bridge로 새 호출 불가 | O3·O11 | profile→bridge authorization |
| R6 / AT6 | AC21 | 초기 시작 실패·SSE 실패·warm 제출 불확실성은 기존 오류/명시 retry 정책 유지. 자동 중복 prompt 없음 | O6·O10·O11 | channel/runtime→respawn/recovery |
| R6 / AT6 | AC22 | 사건 로그로 spawn/terminate·instance·bridge·HTTP를 구분, secret/config 원문 미포함. 같은 시나리오 전후 증거 저장 | O10·O11·H1 | real boundaries→trace |

## 7-A. V / Trace Matrix

이번 요청은 0288 전체 MCP 기능을 재설계하거나 검증 완료시키는 작업이 아니다. 새 요구의 Baseline V를 만들고, 기존 계약의 영향받는 회귀를 R6/SD3/AR3의 명시 요구로 편입한다. 기존 handoff의 미완료 AC를 이 문서의 PASS로 대신 닫지 않는다.

### Node registry

| 왼쪽 / 오른쪽 node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R1 / AT1 | R↔AT | 관측 취소·최신 결과 | NEW |
| R2 / AT2 | R↔AT | 재진입·승격·조회 재사용 | NEW |
| R3 / AT3 | R↔AT | live 토글·정의 변경 분리 | NEW |
| R4 / AT4 | R↔AT | 디스크 캐시 정확성 | NEW |
| R5 / AT5 | R↔AT | 부팅 웜업 | NEW |
| R6 / AT6 | R↔AT | 기존 외부/보안/실패 계약·측정 | NEW |
| SD1 / ST1 | SD↔ST | 화면→idle→재진입→만료·종료 | NEW |
| SD2 / ST2 | SD↔ST | 설정 저장→idle reconcile→다음 제출 | NEW |
| SD3 / ST3 | SD↔ST | 부팅→gate→웜업→foreground/실패 | NEW |
| AR1 / IT1 | AR↔IT | 통합 준비와 renderer 승격 배선 | NEW |
| AR2 / IT2 | AR↔IT | source·bridge·OpenCode·respawn 경계 | NEW |
| AR3 / IT3 | AR↔IT | reader/watch/boot·안전 DTO 배선 | NEW |
| MD1 / UT1 | MD↔UT | idle reservation·generation fence | NEW |
| MD2 / UT2 | MD↔UT | owner/part slot·cancel/freshness | NEW |
| MD3 / UT3 | MD↔UT | definition/selection 분류·적용 상태 | NEW |
| MD4 / UT4 | MD↔UT | dependency fingerprint·single flight | NEW |

### Pair registry

전부 REQUIRED다. 자리 목록과 직접 oracle의 정본은 [강제 지점](enforcement.md)이며, 아래 수량은 그 표의 ID 집합으로 계산한다. O 번호의 파일·진입점·구별 입력·sink는 §11에 있다.

| Pair | node | production path | oracle / 자리 집합 |
|---|---|---|---|
| VP01 | R1↔AT1 | subscribe→IPC→prepare→취소→read-only/최신 UI | O1·O2·O5·O6·O8·O9·O10 / B·C |
| VP02 | R2↔AT2 | landing→공유 prepare→승격/재진입→cached SDK | O1·O2·O3·O4·O5·O6·O8·O9·O10·O11 / A·B·C·D |
| VP03 | R3↔AT3 | toggle/save→분류→idle reconcile→SDK/다음 턴 | O5·O6·O10·O11 / E·F |
| VP04 | R4↔AT4 | file change→manifest→cache→catalog | O7 / G |
| VP05 | R5↔AT5 | boot/gate→target→prepare→release | O8·O10 / H |
| VP06 | R6↔AT6 | IPC/runtime/profile→SDK/storage/trace | O3·O5·O6·O9·O10·O11 / A·C·E·F·I |
| VP07 | SD1↔ST1 | acquire→shared state→idle→reacquire/dispose/quit | O1·O2·O3·O4·O5·O6·O8·O10·O11 / A·B·D |
| VP08 | SD2↔ST2 | desired save→busy/idle→barrier→submit | O5·O6·O10·O11 / E·F |
| VP09 | SD3↔ST3 | gate→warmup→foreground/abort/retry | O3·O8·O10·O11 / H·A |
| VP10 | AR1↔IT1 | 두 IPC→shared target→lease→renderer snapshot | O1·O2·O5·O6·O8·O9·O10 / B·C |
| VP11 | AR2↔IT2 | source→projection→context→turn policy | O3·O5·O6·O10·O11 / E·F·A |
| VP12 | AR3↔IT3 | global/project watch→reader→boot/UI | O7·O8·O9·O10 / G·H·C |
| VP13 | MD1↔UT1 | refs/reservations→deadline→physical cleanup | O3 / A7·A8·A9·A10 |
| VP14 | MD2↔UT2 | owner/part/caller signal→shared slot→result | O1·O2·O4 / B2·B3·B4·B5·D1·D2·D3 |
| VP15 | MD3↔UT3 | snapshot diff→desired/applied→restart decision | O5·O6·O11 / E3·E4·E6·F1·F5·F6·F7·F8 |
| VP16 | MD4↔UT4 | dependency signatures→hash→immutable result | O7 / G1·G2·G3·G4 |

직접 행동 oracle이므로 일괄 mutation을 요구하지 않는다. 다음은 값 운반·배선 방향을 별도로 잠글 선택 변이다.

| 변이 | 이유 | 자리 / oracle |
|---|---|---|
| M1 | definition과 selection을 혼동해도 단일 토글 시험만 통과할 수 있음 | F3·F4·F5·F7 각각 restart revision을 반대 축으로 교체 / O6 |
| M2 | 모델과 에이전트 목록이 모두 존재해도 승격 대상이 바뀔 수 있음 | C3의 models/agents 갱신 대상 맞바꿈, C5 승격 연결 제거 / O9 |
| M3 | prepare를 따로 호출해도 화면 결과만 보면 정상 | B15 양 진입에 별도 준비 service 주입 / O2·O10 |
| M4 | 삭제한 bootstrap 연결을 순수 warmup 시험이 보지 못할 수 있음 | H1 시작·H2 gate 재평가·H5 종료 연결 각각 제거 / O8 |

### 현재 변경의 운영 gate

| Gate | 이유 / 명령 | 실패 범위 |
|---|---|---|
| G0 설계 | 문서 링크·Ledger/AC·pair/자리/oracle·보드 대조, git diff --check | 이번 문서 오류 |
| G1 정적 | app에서 npm run lint, npm run typecheck | 변경 산출의 boundaries/types/hygiene 위반 |
| G2 행동 | 직접 vitest run으로 §11 및 영향 스위트, ABI 변경 훅 우회 | 유효 pair·회귀 위반 |
| G3 문서 | app에서 node scripts/check-doc-inventory.mjs --check | 이번 문서/링크/생성물 정합성 |
| G4 통합 | .github/workflows/ci.yml의 현재 명령, 실제 CLI H1 | 환경 실패는 분리, 증거 없는 실기는 미완료 |
| G5 메시지 버스 | 설계/구현 별도 커밋, trailer 파싱·보드 일치 | 잘못된 단계/좌표/상태 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

판정·재현 원문은 [research.md](research.md)다. 현재 가이드는 root/docs/handoff/app/main/renderer AGENTS, adapters.md §1.2, runtime-ipc.md, IPC_CONTRACT의 Composer/native resources, 디자인 시스템 상태 규칙·컴포넌트 카탈로그를 조사했다.

| 대상 | 검색 | N / 의미 |
|---|---|---|
| main catalog owner 생성 | rg -n 'new ComposerCatalogOwners' app/src/main -g '*.ts' -g '!*.test.ts' | 2: handler·PreparedMcpResources |
| 직접 MCP loader 호출 | rg -n 'openCodeNativeMcp\(' app/src/main/adapters/opencode/v1 -g '*.ts' -g '!*.test.ts' | 호출 3 + 선언 1. channel/control/미사용 aggregate helper |
| 슬롯 loader 함수 참조 | rg -n 'openCodeNativeMcp' app/src/main/adapters/opencode/v1 -g '*.ts' -g '!*.test.ts' | composer-cache의 함수 전달도 조사. 호출식 검색만으로 누락 금지 |
| 미사용 aggregate helper | rg -n 'openCodeNativeResources' app/src -g '*.ts' -g '!*.test.ts' | 선언만 1. 실행 sink 총량에 포함하지 않음 |
| managed respawn 운반 | rg -n 'managedMcpRevision\|spawnedManagedMcpRevision' app/src/main | 사용자/연속 턴·조립·policy·spawn/teardown, F 표로 고정 |
| 마지막 랜딩 정보 | rg -n 'lastBackend\|lastCwd\|resolveLandingCwd' app/src | 기존 settings·session-cwd 경로 재사용 |

상세 자리 검색은 enforcement.md의 Q1~Q6이며, 행 수와 grep hit 수를 동일시하지 않는다. 선언·타입·테스트·관계없는 Claude 경로는 분모에서 제외하고 실행 edge는 전부 자리로 적는다.

## 9. Architecture / Data & Control Flow

### AS-IS

~~~text
catalog IPC → ComposerCatalogOwners ─┐
native resources → PreparedMcpResources → 별도 Owners ─┤
                                                       ↓
prepareComposerCatalog → resolveTurnProvider → adapter.client
 → bridge acquire → disk discovery/projection → server pool acquire
 → ServerContext → directory instance → composer part slots

last screen owner release
 → instance abort/dispose → context finish/close → server release/kill → bridge release/close
managed source revision → 두 owner 전체 invalidate
live nativeResources → slot을 우회한 MCP HTTP
~~~

### TO-BE

~~~text
catalog/native IPC/boot → 하나의 ComposerPreparationService
 → 검증된 target + owner attachments + parts
 → adapter/context의 기존 directory map
 → 실제 consumer refs 0: idle(90초), dependency holds 유지
 → attach: idle timer 취소, cached generation 재사용
 → expiry/evict: disposing → ack+event → context/server/bridge release

MCP source: execution definition revision + desired connection revision
 → OpenCode stable disabled projection
 → directory reconcile queue + submission barrier
 → connect/disconnect 확인 → 해당 slot/후보만 갱신
~~~

### AS-IS → TO-BE Delta

| 축 | 현재 | 변경 | 연결 |
|---|---|---|---|
| 소유권 | 호출자별 dependency release | context가 물리 dependency 소유, 호출자는 논리 attach | AC3~6 / A |
| 준비 | 두 owner map·raw scope JSON | 한 준비 service·정규화 target·독립 owner 취소 | AC1~2·8 / B |
| 승격 | sessionId 변경으로 새 renderer state | 같은 draft identity snapshot 승계, main profile 동등성 재검증 | AC7 / C |
| 조회 | live status 직접 HTTP | instance part slot + freshness/revision | AC9 / D |
| 변경 | 단일 managed revision | 정의/연결 선택 분리, native 전역 선택도 reconcile | AC10~14 / E·F |
| 디스크 | 호출별 전체 조사 | bounded manifest cache + 내용 revision | AC15~16 / G |
| 부팅 | version 확인 | 조건부 동일 prepare path 웜업 | AC17~18 / H |
| 관측 | start/terminate 시간선 부족 | opaque IDs·reason·실제 경계 사건 | AC22 / I |

새 준비 service는 app에, directory/slot/reconcile은 OpenCode adapter에 둔다. 공통 runtime은 주입된 adapter 정책만 호출하며 OpenCode 이름 분기를 추가하지 않는다.

## 10. 계약 / 타입 / 강제 지점

자리 SSOT는 [enforcement.md](enforcement.md)다. 각 행의 Q 검색·현재 심볼·실패 의미·O 좌표가 분모이며, 구현은 새 helper가 어느 기존 자리를 승계하는지 보고한다.

### 내부 계약

| 계약 | 형상 / 의미 |
|---|---|
| Directory lifecycle | active → idle → disposing → disposed, retired는 새 attach 금지. discriminated union으로 idle deadline과 disposing promise를 분리 |
| logical release | 소비자 signal 즉시 abort·참조 1회 감소, 반환은 TTL 대기 없음. cleanup settled promise는 내부 의존 소유자만 사용 |
| physical ownership | context/server hold는 모든 directory·acquire reservation·dispose가 끝날 때 해제. bridge hold는 해당 server/context가 필요로 하는 동안 유지 |
| PreparationTarget | backend + main이 검증한 normalized cwd + agentKind + resolved provider/settings/env/profile identity + definition epoch. secret fingerprint는 main 밖으로 전달 금지 |
| owner attachment | sender+role+owner가 identity. 같은 문자열이라도 catalog/resources 권한 섞지 않음. target entry는 공유 |
| ManagedMcpSnapshot | 기존 revision 유지 + 내부 definitionRevision, connectionRevision, all resolved definitions와 desired map. 기존 users의 enabled-only 의미는 Claude 소비를 위해 유지 |
| change notification | 내부 kind='definitions' 또는 'connections', changed source IDs와 revision. public managedMcpChanged는 기존 {revision} 유지 |
| restart policy | 공통 코드에 구체 harness 분기 금지. adapter의 선택적 restartRevision(snapshot) 포트로 OpenCode는 definitionRevision, 기본/Claude는 기존 revision |
| connection application | desired/applied revision 별도. 모든 요청 완료 및 실제 status 확인 뒤만 applied 전진 |
| 적용 장벽의 종류 | auto-idle은 기존 전체 activity idle 검사. before-submit은 directory admission을 잠근 뒤 실제 실행/승인/백그라운드만 검사하고, 잠긴 미실행 queue는 busy 원인에서 제외 |
| cancellation | 내부 result='cancelled'에 owner-left/superseded/shutdown 사유. IPC NativeResources union 추가 금지 |
| cache | successful immutable value + dependencyRevision + flight epoch. 실패 Promise를 영구 캐시하지 않음 |
| policy SSOT | 신규 adapters/opencode/v1/retention-policy.ts. idleRetentionMs=90000, maxIdleInstances=4, mcpFreshMs=5000, discoveryCheckMs=1000, maxDiscoveryScopes=64, maxInstallationEntries=256. 양의 정수·ms 단위, 공개 설정 키 아님 |
| trace | opaque runtime ID·instance ID·reason enum·duration/count·revision. raw config/env/token/headers/파일 내용·원문 오류 금지 |

공개 취소 응답을 추가하지 않는다. owner가 없어지면 기존 DTO의 disconnected+partial 및 확인된 configured 항목만 반환하고 connected generation은 싣지 않는다. 활성 owner의 superseded 읽기는 최신 target으로 한 번 재시도하며, 다시 변경되면 configurationPending+partial 상태로 다음 변화/명시 조회에 맡긴다.

이 read-only/partial 결과를 renderer가 성공 empty로 적용하지 않도록 C7에서 보존 규칙을 잠근다. 구성 조사 자체가 실패했고 보존할 관측도 없다면 기존 안전 오류 경로를 유지한다.

## 11. 구현 설계 / oracle 좌표

### 구현 순서

1. I 진단과 O1 취소 재현을 먼저 추가. H1의 변경 전 사건 시간선 기록.
2. B의 정상 취소·공유 준비와 A의 dependency 보유 구현. 서버만 TTL을 따로 적용하지 않음.
3. C 승격·D slot 경로 통합. 초기/따뜻한 조회 횟수 비교.
4. E·F revision 분리·연결 적용 장벽·관리 정의 투영.
5. G manifest 캐시. 읽기 부수 효과 회귀 확인.
6. H 웜업을 같은 경로에 연결. 전체 시나리오·회귀·H1 후 impl/IMPL_DONE.

### 주요 구현

**A — 수명.** 기존 OpenCodeInstances map에 idle 상태·timer·LRU를 추가한다. 논리 caller AbortSignal과 instance AbortSignal을 분리해 개별 취소가 shared work를 죽이지 않으며, 만료 전에는 instance controller를 abort하지 않는다.

ServerContext가 server connection과 bridge hold를 채택한다. adapter.client의 임시 획득은 context adopt 후 중복 hold만 해제하고, 정상 caller release가 server/bridge를 직접 닫지 않게 옮긴다. 물리 회수는 native dispose ack+matching event 뒤이며 context가 비면 server를 반환한다.

idle deadline은 하나다. server pool과 bridge에 추가 90초 타이머를 겹치지 않는다. untouched instance는 만료 때 native bootstrap 없이 회수하고, retire된 idle은 즉시 수거하되 active owner는 기존 정책대로 끝날 때까지 유지한다.

**B — 준비.** 신규 app/composer-preparation-service.ts가 catalog/resources/warmup의 owner attachment·target entry·single flight를 소유한다. 기존 ComposerCatalogOwners를 이 서비스의 owner 파사드로 흡수하고 PreparedMcpResources는 관측 scope·안전 view만 담당한다.

raw JSON.stringify(scope/request)를 identity로 쓰지 않는다. session의 cwd/provider/agentKind는 DB·실제 resolver로 확인하고, 같은 draft tuple의 병렬 해석을 합친다. 다른 tuple이 해석 후 같은 profile이면 adapter/context 단계에서 합치며, 최신 설정 해석을 생략하는 전역 provider 캐시는 만들지 않는다.

**C — 승격.** chatStore의 실제 pending entry 승격에서 draft→session 연결을 제공한다. renderer에는 모델을 앱 전체 전역 store로 올리지 않고 draft entry의 catalog snapshot/flight를 같은 실행 선택일 때만 계승한다.

main owner의 scope 교체는 acquire-before-release로 수행한다. 이전 결과의 운반 scope와 epoch가 현재 target과 일치할 때만 채택하며, provider 변경·worktree 생성·cwd 변경·다른 pending draft는 계승하지 않는다.

**D — 슬롯.** live channel의 MCP는 connection.mcp를 통한다. plugin/command의 기존 live 재조회와 rememberCommands는 유지해 외부 동적 명령 갱신까지 제거하지 않는다. mcpControl 초기 적용과 slot loader를 순환 호출시키지 않도록, low-level status reader 하나를 주입해 초기 적용 후 관측을 슬롯에 seed한다.

MCP 성공 freshness는 5초, 명시 refresh·connect/disconnect·정의 변경은 즉시 invalidate다. 보이는 메뉴의 재열기/ensure는 freshness를 확인하며 캐시된 connected 상태를 영구 유지하지 않는다. 모델·agent는 기존 generation/변경 이벤트 정책을 유지하고 MCP 토글만으로 model HTTP를 다시 보내지 않는다.

**E·F — 설정과 연결.** McpStore에 main 전용 전체 정의/활성 선택 snapshot을 제공하고 기존 enabledConfig는 보존한다. 관리 MCP의 정의는 projection에서 enabled:false로 고정하며 desired=true인 항목만 directory 초기화/변경 시 connect한다.

정의 fingerprint에는 command/args/url/headers/env·인증 revision·plugin descriptor가, 선택 fingerprint에는 enabled map만 들어간다. plugin auth 철회/회전과 미해결→해결 변화는 정의 변경이며, off 항목을 재활성화할 때 처음 유효 credential이 생긴 경우도 pure toggle로 오분류하지 않는다.

bridge identity는 정의 세대에 묶는다. source revision 숫자가 달라졌다는 이유만으로 mapManagedMcpResources가 모든 항목을 제거하지 않으며, 해당 source가 현재 허용·활성이고 그 instance에 적용됐는지 판정한다.

managed mention mapping도 각 submit 시 현재 적용된 연결을 기준으로 얻는다. 최초 client 획득 때 만든 enabled 목록을 채널 수명 동안 고정하지 않으며, disabled 항목의 정의 보존이 사용 가능 후보 노출을 뜻하지 않는다.

native 전역 선택은 extensionSetEnabled의 기존 저장 경로에서 좁은 adapter 제어 포트로 전달한다. project 명시 enabled가 있으면 이를 우선하며 native 파일/프로젝트 toggle capability는 바꾸지 않는다. 외부 파일의 add/delete/edit는 live remove로 흉내 내지 않고 정의 변경으로 retire한다.

모든 directory 연결 변경은 직렬 큐에서 수행한다. 같은 directory를 공유하는 모든 runtime의 foreground·queue·delivery·residual·background·wakeup 상태가 idle이고 제출 예약이 없을 때만 시작한다. app이 activity 판정 포트를 주입하고 adapter는 app/feature를 import하지 않는다.

새 사용자·자동 연속·slash 제출 모두 같은 짧은 submission barrier를 통과한다. 토글 I/O 중 새 제출은 기다리고, 제출 예약 직후에는 토글이 시작되지 않도록 원자적으로 예약한다. 실행 중 턴을 기다리는 큐 잠금을 턴 완료 콜백과 공유해 deadlock시키지 않는다.

자동 idle 적용과 제출 직전 적용의 guard를 구분한다. 후자는 해당 directory의 새 admission을 잠그고 이미 실행 중인 작업의 정착만 기다리며, 잠긴 queued/delivery/wakeup 및 자기 제출 예약은 기다릴 작업으로 세지 않는다. queuedCount=0을 그대로 요구해 자신의 전송을 영원히 기다리는 순환은 O5의 “pending toggle with queued user and continuation input” 케이스로 금지한다.

desired 저장을 먼저 수행하고 성공한 저장만 배포/reconcile한다. 실패한 connect는 desired를 되돌리거나 applied로 표시하지 않으며 현재 관측과 pending/partial을 방송한다. 다음 제출은 필요한 적용이 실패한 상태로 진행하지 않고 기존 안전 오류로 실패하여 명시 retry를 허용한다.

**G — 디스크.** 신규 adapters/opencode/v1/discovery-cache.ts가 configured/global/install 결과와 dependency manifest를 소유한다. key는 normalized cwd·globalOnly·설정 탐색에 영향을 주는 env/layout이며, cache는 main 메모리에만 둔다.

manifest는 읽은 파일뿐 아니라 우선순위 후보의 부재, 조상 .git 경계, OPENCODE_CONFIG/CONFIG_DIR, XDG·ProgramData, plugin realpath target/package.json을 포함한다. 관련 경로의 watch/poll generation을 사용하고 1초 주기 내용 hash 재검사로 동일 mtime/size 변경도 확인한다. 기존 watcher를 확장하되 plugin 목록 변경 이벤트와 일반 config cache invalidation을 구분한다.

dirty/1초 검증 기한 경과 후의 읽기는 fingerprint 검증을 기다린다. 같은 revision의 호출은 single flight를 공유하고 immutable 결과를 제공한다. candidate 생성/삭제·설치 교체·symlink 변경·env/layout 변경은 새 manifest를 만들며, 오래된 flight는 epoch guard로 폐기한다.

주기 검사는 실제 observer/runtime 또는 90초 보유 owner가 있는 scope에만 둔다. 수거된 scope의 결과가 LRU에 남더라도 polling은 중단하고, 다음 읽기에서 검증한다. 동일 manifest를 공유하는 scope끼리는 파일 hash 작업도 합쳐 polling 비용이 호출자 수에 비례하지 않게 한다.

**H — 웜업.** 신규 app/opencode-warmup.ts는 boot 준비와 gate 허용 뒤 한 번 예약한다. lastBackend가 opencode일 때 기존 resolveLandingCwd(lastCwd, getCwd())와 랜딩 기본 provider/agentKind=code를 사용한다.

agents/models/MCP를 독립 병렬로 요청하며 하나의 지연이 다른 부분을 막지 않는다. session 생성·prompt·tool 호출은 하지 않는다. 준비 완료 후 owner를 즉시 반환해 일반 90초 idle 보유로 넘기고, 실패·gate 폐쇄·quit는 owner만 취소한다.

lastBackend가 null/claude이면 선제 OpenCode 연결을 만들지 않는다. 설치 실패·auth 미준비·경로 준비 실패는 앱 부팅 완료를 막지 않으며, 후속 실제 랜딩은 같은 준비 경로로 명시 재시도한다. profile/cwd가 달라진 화면에는 완료된 웜업 결과를 붙이지 않는다.

**I — 관측.** 기존 logger의 debug 수준을 사용한다(dev는 debug, production은 기존 debug 설정). start-request와 실제 spawn, terminate-request와 child-exit, instance attach/idle/dispose/ack/event, bridge open/close, slot hit/miss/HTTP, invalidation reason을 구분한다.

### 직접 oracle

아래 파일 경로는 app/src 기준이다. “신규” 좌표는 구현 후 실제 케이스명을 유지하거나 대응표를 남겨야 하며, 현재 통과했다고 주장하지 않는다.

| O | 파일:테스트명 | 진입·구별 입력·직접 관측 |
|---|---|---|
| O1 | 신규 main/app/handlers/session-resources.cancellation.test.ts: settles draft and saved observation cancellation without masking failures | 실제 IPC handler+Prepared+owner/service. pending→release/replace, malformed config와 성공 empty 대조. 반환 DTO·오류·release 관측 |
| O2 | 신규 main/app/composer-preparation-service.test.ts: shares targets across catalog resources and warmup | 실제 두 등록 handler+service+resolver. sender/role 충돌·속성 순서·같은/다른 provider/cwd. prepare sink와 각각의 결과·signal 관측 |
| O3 | 확장 main/adapters/opencode/v1/instance-lifecycle.test.ts 및 session-context.test.ts: retains dependencies until one idle deadline | fake clock+실제 context/instances. 89,999/90,000ms, 5개 idle, pending acquire, retire, late dispose. 실제 SDK request·generation·dependency release 관측 |
| O4 | 확장 main/adapters/opencode/v1/adapter.test.ts: shares prepared and live inventory slots with freshness | 실제 adapter→channel→context→SDK fetch. agents/models/MCP/plugin 구별 응답, 실패 재시도·토글·TTL. URL별 요청과 nativeResources DTO 관측 |
| O5 | 신규 main/app/opencode-mcp-reconcile.test.ts: applies saved choices across idle peers before submissions | 실제 두 toggle handler→source/control→adapter directory queue, activity 포트만 fixture. shared/different cwd·project override·busy/background·rapid off/on·connect 실패. HTTP 순서·tool 가용성·pending 관측 |
| O6 | 확장 main/app/chat-turn/managed-mcp-revision.test.ts: separates connection and definition revisions for both turn entries | 실제 builder→runtime-entry/continuation→respawnInputs→policy→SessionRuntime. revisions 11/23/37·undefined·auth/edit·model/env 변화. adapter spawn 및 prompt sink·record/reset 관측 |
| O7 | 신규 main/adapters/opencode/v1/discovery-cache.test.ts: revalidates the full dependency manifest | 실제 임시 파일+reader+poll callback. 동일mtime/동일size 내용 교체·missing 생성·.git 경계·symlink/설치/환경 대조. 결과·readFile/realpath 계측·stale flight 관측 |
| O8 | 신규 main/app/opencode-warmup.test.ts 및 bootstrap.opencode-warmup.test.ts: warms only the eligible landing target | 실제 boot 조립 helper+gate callback+service. 마지막 backend·기본경로 fallback·shutdown·동시 landing. 외부 SDK sink/세션 생성 없음/부팅 완료 관측 |
| O9 | 확장 renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.test.ts·hooks/useNativeResources.test.ts 및 신규 store/composer-promotion.test.ts: preserves only the matching promoted catalog | 실제 chatStore 승격과 hook/state 연결, IPC만 fake. model/agent 목록 구별·worktree/provider mismatch·취소·토스트 sink·재열기 freshness 관측 |
| O10 | 신규 main/app/opencode-retention.integration.test.ts: traces boot navigation first and second send through the real assembly | 실제 server pool+adapter+context+bridge+준비 서비스+channel, OS spawn·remote model만 fixture. 두 send·nav·toggle·expiry의 PID/HTTP/instance/bridge 사건 관측 |
| O11 | 확장 main/app/managed-mcp-lifecycle.test.ts·managed-mcp-claude-regression.test.ts, main/adapters/opencode/v1/{server,adapter.persistent,adapter.startup}.test.ts 실패 스위트 | 실제 bridge HTTP+인가 source, sentinel secrets·다른profile/env·startup/health/SSE/close failure. unauthorized 응답·secret 미노출·중복 prompt 없음 |

O2/O8/O10은 bootstrap이 실제 사용하는 별도 조립 helper를 호출한다. bootstrap 연결을 AST 존재 검사만으로 대체하지 않으며, M3/M4로 실제 주입 배선을 제거했을 때 실패하는지 확인한다. O9는 hook을 mock하고 내부 callback만 호출하는 시험으로 승격 edge를 닫지 않는다.

기존 회귀 좌표를 확인했다: managed-mcp-lifecycle.test.ts의 shares generations and releases only owned resources, managed-mcp-claude-regression.test.ts의 retains resolved Claude MCP publication through the actual deployment service and plugin writer, adapter.startup.test.ts의 reuses draft preparation for a selected-agent first prompt while provider metadata is stalled, adapter.persistent.test.ts의 retries explicitly after an SDK SSE HTTP failure without replaying the failed input. 새 수명에 맞게 물리 정리 시점만 바꾸고 이 시험들의 격리·기능·중복 방지 assertion을 보존한다.

## 12. End-to-end 영향

| producer | 운반 | consumer / 보존 |
|---|---|---|
| mcpUpdate·extensionSetEnabled | internal change kind + desired/definition revision | directory reconcile·renderer 기존 NativeResources 이벤트 |
| auth 변경 | definition revision + 현재 authorized() | bridge 즉시 철회·다음 세대, 로그 비밀 보호 |
| session.updated | 실제 pending draft identity·validated target | renderer catalog 승격, 다른 draft 격리 |
| watcher | dependency revision·plugin change 구분 | discovery cache·준비 무효화, model/agent 과잉 무효화 금지 |
| boot/gate | lastBackend·resolveLandingCwd·현재 provider | foreground와 같은 preparation service |
| 사용/해제 | logical ref와 physical reservation | idle 보유·native finalizer·서버 종료 |

public 이벤트 필드는 추가하지 않는다. pending은 기존 configurationPending·partial과 현재 UI 규칙을 사용하며, 새 상태 안내 UI를 추가하지 않는다. 파일/credential·native session ID·모델/variant 선택은 기존 소유자가 계속 관리한다.

## 13. Lifecycle / 오류 / 정리

- acquire 예약은 await 전에 등록하고 실패 경로에서 해제한다. idle timer 취소와 attach는 동기 전이로 처리한다.
- disposing 시작 뒤의 acquire는 완료 후 새 instance를 얻는다. timeout은 기존 30초 cleanup budget을 유지하고 server를 retire한다.
- stream failure·외부 instance disposed·정의 변경은 idle 재사용을 금지한다. 새 generation이 old callback으로 지워지지 않게 identity 검사한다.
- 일반 metadata 조회 실패는 해당 flight만 해제하고 같은 세대의 성공 슬롯은 보존한다. 이 실패를 치명적 transport/instance 실패로 확대해 서버를 retire하지 않는다.
- quit는 warmup→owner/service→context/instances→owned server→bridge 순서의 의도를 유지하되, 동기 shutdown에서 물리 close를 TTL 뒤로 미루지 않는다.
- 일반 release 호출자에게 cleanup promise를 반환하지 않는다. 물리 실패는 중앙 안전 오류로 한 번 보고하고 owner cleanup은 멱등이다.
- bridge authorization은 보유 여부와 무관하게 현재 source를 검사한다. auth 철회 시 진행 호출 취소·새 호출 거부를 보존한다.

### 다중 저장소

| 쓰기 | 실패/크래시 관측 | 처리 |
|---|---|---|
| 기존 설정 저장 → runtime connect/disconnect | 저장은 새 값, 연결은 이전/부분 상태 | desired/applied 분리, pending·실제 관측. 다음 부팅/제출에 재조정 |
| 기존 MCP 정의/secret store 변경 | 기존 McpStore의 쓰기/비밀 경계 | 이번 변경은 저장 형식·원자성 정책을 바꾸지 않음. 저장 실패이면 새 revision/연결 적용 금지 |
| plan 상태 → INDEX 상태 | 서로 다른 차례 표기 위험 | 같은 설계 커밋에 저장, G0에서 두 사본 대조 |
| 0288 오류 이관 → 0289 AC | 기존 오류가 누락될 위험 | 0288 파생 이슈에 재현·이관 링크, 독립 verify 대기는 유지 |

## 14. 성능 / 상한 / 잃는 부수 효과

| 항목 | 정책 | 잃는 부수 효과 / 회귀 |
|---|---|---|
| idle 자원 | 마지막 소비자 후 90초, 전체 idle directory 최대 4 | 즉시 plugin finalizer를 실행하지 않음. AC4·6으로 만료/퇴출/quit 정리 |
| 물리 process | 기존 active profile + idle directory가 보유한 profile | active를 cap 때문에 종료하지 않음. 모든 hold 소멸 뒤 종료 |
| bridge | live/idle context의 정의 세대 hold만 보유 | zero-ref를 무한 보유하지 않음. 정의 변경·인가 철회 AC20 |
| MCP status | fresh 5초, miss/refresh는 flight 공유 | 연결 상태 변화 관측 지연. 다음 visible read에서 재검증, 실패 보존 AC9 |
| 디스크 | scope cache 최대 64, 설치 metadata 최대 256, LRU | cold miss 재조사. 부재/생성·동일mtime hash·수정 경합 AC16 |
| 웜업 | 앱 준비 완료 후 target 1개, part별 flight | 사용하지 않을 외부 연결 발생 가능. 90초 idle 회수, gate/cancel AC18 |
| 네트워크 | 웜업은 model prompt/tool execution 0 | agents/provider/MCP 요청과 MCP initialize/tools list는 허용 |
| 토글 | 변경된 K개 MCP의 connect/disconnect + 확인 status, directory별 동시 mutation 1 | 성공 상태만 applied, 빠른 토글은 최신 desired로 합침 |

HTTP 총량은 sink 계측으로 보고한다. cold path의 native 내부 초기화·plugin·MCP 하위 요청을 Orca HTTP 호출식 개수로 대신 세지 않는다. 시간 수치는 before/after 환경·CLI 버전·횟수와 함께 보조 지표로만 남긴다.

## 15. 외부 구현 포트 / 문서 계약

새 외부 port/schema 없음. 내부 ManagedMcpSnapshot·adapter 정책·lifecycle 포트 변경은 타입·계약 시험을 동반한다. 현재 아키텍처·IPC 설명은 구현 완료 후 adapters.md/runtime-ipc.md/IPC_CONTRACT.md에 현재 동작으로 갱신하고, 이번 계획을 이미 구현된 상태처럼 기술하지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 계약 | 이번 관계 | evidence / 회귀 |
|---|---|---|
| 0275 마지막 ref 즉시 dispose/전체 종료 | 일반 release에 90초 idle 단계 삽입. ack+event·retire·격리 유지 | AC3~6·20, O3·O11 |
| 0288 단일 revision으로 다음 턴 재생성 | OpenCode pure toggle만 live 적용. 정의/auth 변경·Claude는 기존 경계 | AC10~14·19, O5·O6 |
| 0288 AC2의 disabled 제외 | 실행/후보 제외는 유지, OpenCode config에는 비활성 정의를 남기도록 변경. 사용자 live 토글 승인에 따른 내부 투영 변경 | AC11·19, O5·O11 |
| 0288 마지막 bridge release 수거 | 논리 caller 대신 context가 hold 보유. 실제 마지막 hold 수거 유지 | AC3·6·20, O3·O11 |
| OpenCode native 전역 선택 snapshot | 살아 있는 idle directory 재조정으로 변경, project 우선순위 유지 | AC12·13, O5 |
| unsafe project toggle 거부 | 유지. setNativeResource로 새 프로젝트 쓰기 기능 추가하지 않음 | AC12·19 |
| 실패/취소는 성공 empty 아님 | 유지·누락 보완 | AC1~2 |
| 명시 실패 retry·prompt 중복 금지 | 유지 | AC21 |
| renderer 모델은 directory 세대, agents 앱 수명 | 유지. 승격은 같은 실행 선택의 snapshot만 계승 | AC7·9 |
| main DAG·Chromium fetch·비밀 경계 | 유지 | G1·O11 |

기존 session-context 시험의 “freezes global choices per directory...”는 native 전역 live 변경 부분만 새 시험으로 대체한다. 프로젝트 쓰기 금지·다른 directory 격리·최종 정리의 기존 assertion은 보존한다. 원 테스트 삭제로 전체 회귀를 지우지 않는다.

## 17. 리스크 / 트레이드오프

| 리스크 | 설계 대응 |
|---|---|
| idle 동안 stdio MCP 자식·메모리 유지 | deadline·idle cap·quit 강제 정리 |
| 관리 off 정의도 child env에 투영 | 기존 승인된 사용자 MCP 전달 경계 안, 연결은 false. 내장 credential은 main 유지, sentinel 시험 |
| native global selection과 managed selection 혼동 | source kind·alias namespace·project override를 구별 입력으로 시험 |
| busy 확인 후 새 send 경합 | shared submission reservation과 reconcile 직렬 장벽 |
| 캐시로 외부 변경을 늦게 발견 | 1초 내용 재검사·새 foreground read의 검증 장벽·명시 invalidation |
| auto-connect의 실제 CLI 차이 | 설치 SDK fixture + 버전 기록한 실제 CLI H1, unsupported 응답은 실패로 표면화 |

신규 패키지·영속 schema·token 전역 고정은 도입하지 않는다. CLI 최신 문서의 V2 API를 기존 legacy client 경로에 혼용하지 않는다.

## 18. 영향 파일 / 문서

- main/app: composer-catalog/owner, prepared-mcp-resources, handlers/composer-catalog/session-resources/mcp/extension-catalog, bootstrap, project-resource-sync, extension-control, chat-turn/{runtime-entry,respawn-inputs}, chat-turn-continuation.
- 신규 main/app: composer-preparation-service, opencode-mcp-reconcile, opencode-warmup 및 실제 bootstrap이 호출하는 조립 helper.
- adapters/opencode/v1: adapter, server, server-profile, session-context, instance-lifecycle, composer-cache, mcp-control, channel, managed-mcp, configured-resources, global-plugins, plugin-installation, project-settings, discovery-cache.
- 공통 내부 포트/feature: adapters/common/{managed-mcp,types}, extensions/common/{builder,mcp/managed-source,mcp/store,mcp/bridge}, sessions/{session-runtime,respawn-policy}; OpenCode 조립 모듈.
- renderer chat: store/chatStore의 승격 연결, harnesses/opencode/composer/{useComposerCatalog,composerCatalogState}, lib/nativeResourceState, hooks/useNativeResources. 공통에 하네스 이름 정책을 새로 넣지 않음.
- 구현 후 문서: arch/backend/adapters.md·runtime-ipc.md, IPC_CONTRACT.md의 기존 shape 설명, 필요 시 opencode-sdk-spec.md의 채택 설명. generated inventory는 스크립트로만.

## 19. 게이트 / 실제 인수

app/AGENTS.md의 ABI 지침을 따른다. lint는 파일을 수정할 수 있으므로 diff를 확인하고, DB가 필요 없는 시험은 직접 vitest로 실행한다. DB ABI/외부 네트워크 실패는 환경 증거와 함께 분리하며 임의 green으로 처리하지 않는다.

H1은 내장 application plugin과 외부 stdio/HTTP MCP가 있는 Windows 환경에서 수행한다. CLI·SDK·앱 commit·설정 형태·cold/warm 여부·시나리오 타임스탬프를 기록하되 비밀은 남기지 않는다.

~~~text
앱 부팅 → OpenCode 랜딩 → 다른 화면 → 90초 이내 복귀
 → 첫 send → 두 번째 send → idle on/off → busy 중 on/off
 → idle 90초 경과 → 복귀 → 앱 종료
~~~

실제 spawn/exit·instance init/dispose·bridge open/close·HTTP/연결 수를 단계별 표로 남긴다. 변경 전 사용자 보고의 “spawn 2”를 기대값으로 고정하지 않는다. 격리된 same-profile 시나리오의 유예 내 재진입은 최초 process/instance를 사용하고, 만료·정의 변경·실제 실패로 새 세대가 필요하면 reason을 기록한다.

## READY self-review

- 사용자 전체 범위·설계 개선 요청을 D01~16에 반영했고 ACTIVE↔AC 충돌 없음.
- AS-IS/TO-BE의 ownership·query·revision·disk·boot 변경은 A~I 자리 및 O1~11에 대응.
- Baseline V의 NEW 노드마다 REQUIRED pair가 있으며 미완료 0288 verify를 승계하지 않음.
- 취소·실패·empty, desired·applied, logical·physical release, definition·selection은 서로 다른 상태로 명시.
- IPC shape/DB 불변과 live 토글의 의미 변경을 구분. 기존 native 프로젝트 쓰기 거부·Claude 정책 유지.
- 자리·경로·O 좌표·운영 gate는 문서 검사 후 갱신 메모에 실제 관측을 추가한다.

## [설계자 기입] 문서 검사 관측

G0: ACTIVE Decision 16, AC1~22, VP01~16, A~I 자리 90을 파싱해 누락 AC/pair·중복 자리 ID가 없음을 확인했다. 기존 소스 경로 36개는 모두 존재했고 신규 oracle은 기존 실행 증거로 표시하지 않았다. 각 pair의 자리 합계와 oracle 목록을 enforcement 표에서 재계산했다.

문장 대조: “논리 해제 즉시”↔“물리 idle 90초”는 §10/11/13에서 일치한다. “연결 선택 live”↔“정의/auth 다음 세대”는 D07~10/AC10~14/§16에서 일치한다. 제출 장벽이 자기 queued 입력을 busy로 기다리는 순환을 발견해 auto-idle과 before-submit guard를 분리했다.

G3: app에서 node scripts/check-doc-inventory.mjs --check 실행. generated/prose는 통과했고 기존 .tmp/opencode-dev 및 app/.temp/opencode 복사본의 상대 링크 10건 때문에 전체 link 단계는 실패했다. 이번 변경 문서 5개의 상대 링크는 별도 검사에서 누락 0이며, 임시 복사본은 수정하지 않았다.

재현: 실제 IPC+준비 owner의 초안/저장 세션 취소 2case와 기존 prepared 시험 2case가 통과했다. 이는 현재 오류를 확인한 결과이며 수정 구현이 통과했다는 뜻이 아니다. 실제 CLI·타 PC 시간선은 AC22/H1에 남겼다.

---

## [구현자 기입] 설계 리뷰

r1 구현 자기보고(2026-10-28). V1의 D01~16·AC1~22를 유지했다. 구현 중 규범 변경을 요구하는 PLAN_GAP은 없었다. 0288·0287·0286의 독립 검증을 대신하지 않는다.

Part I의 논리 owner 종료와 Part II의 물리 보유를 분리했다. main 조립은 catalog/resources/warmup이 같은 service를 사용하고, 모델·agent 목록은 MCP 연결 선택으로 지우지 않는다. O10의 실제 조립 시험은 별도 integration 파일 대신 `opencode-mcp-reconcile.test.ts`와 공유 fixture에 두었다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

고정 자리 90개(A19·B17·C9·D6·E10·F10·G9·H5·I5)를 직접 oracle에 대응했다. 중복 포함하는 pair별 합계를 고유 자리 수로 더하지 않는다. Q1~Q6 출력·새 helper의 기존 자리 승계·ID 양방향 차집합은 [관측표](implementation-evidence.md)에 기록했다. 검색 hit는 분모가 아니다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP01 | 취소·최신 결과 | B1~17·C1~9 (26) | 26/26 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | pending draft/saved 해제는 disconnected+partial, generation 없음 | 없음 |
| VP02 | 재진입·승격·조회 공유 | A1~19·B1~17·C1~9·D1~6 (51) | 51/51 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | 89,999ms 재사용·90,000ms 회수; 실제 승격의 같은 선택만 계승 | 없음 |
| VP03 | 연결 선택과 정의 분리 | E1~10·F1~10 (20) | 20/20 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | on/off는 같은 process; 정의 11/선택 23/전체 37 구별 | 없음 |
| VP04 | dependency 검증 | G1~9 (9) | 9/9 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | 동일 mtime 내용 변경·부재 생성·환경/설치 교체 재검증 | 없음 |
| VP05 | 웜업 eligibility | H1~5 (5) | 5/5 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | 실제 Bootstrap에서 gate 허용만 start, 부팅 await 없음 | 없음 |
| VP06 | 외부 계약·실패·측정 | A1~19·C1~9·E1~10·F1~10·I1~5 (53) | 53/53 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | secret sentinel 미노출·profile 격리·중복 prompt 없음 | H1 실제 앱 창·타 PC 인수 |
| VP07 | 논리/물리 수명 | A1~19·B1~17·D1~6 (42) | 42/42 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | consumer 반환 즉시, 물리 ack+event 뒤 의존성 해제 | 없음 |
| VP08 | 적용과 제출 직렬화 | E1~10·F1~10 (20) | 20/20 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | busy/background 보류, mutation 실패 뒤 prompt 없음 | 없음 |
| VP09 | gate·실패 후 foreground | H1~5·A1~19 (24) | 24/24 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | gate 철회/quit owner 해제, 실패 후 명시 재시도 | 없음 |
| VP10 | 실제 IPC·store 연결 | B1~17·C1~9 (26) | 26/26 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | 두 IPC와 warmup prepare 1; 실제 store의 snapshot 승계 | 없음 |
| VP11 | projection·restart 운반 | E1~10·F1~10·A1~19 (39) | 39/39 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | 처음 off도 정의 투영; OpenCode/Claude restart 축 구별 | 없음 |
| VP12 | 감시·reader·UI | G1~9·H1~5·C1~9 (23) | 23/23 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | 외부 변경→dirty/read→broadcast, old revision 폐기 | 없음 |
| VP13 | idle reservation/fence | A7·A8·A9·A10 (4) | 4/4 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | 단일 deadline·전체 idle cap·늦은 dispose fence | 없음 |
| VP14 | owner·part·signal | B2·B3·B4·B5·D1·D2·D3 (7) | 7/7 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | sender 하나 취소해도 peer 성공; 5초 slot·실패 재시도 | 없음 |
| VP15 | revision·applied | E3·E4·E6·F1·F5·F6·F7·F8 (8) | 8/8 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | 두 턴 진입과 spawn/reset의 11/23/37 운반 | 없음 |
| VP16 | manifest·epoch | G1·G2·G3·G4 (4) | 4/4 기계 자리 | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 해당 ID → T 좌표; G2 실행 | 파일 read 공유·epoch 교체 뒤 old result 미채택 | 없음 |

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP01 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 B1~17·C1~9 | M1·M2·M3·M4 |
| VP02 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 A1~19·B1~17·C1~9·D1~6 | M1·M2·M3·M4 |
| VP03 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 E1~10·F1~10 | M1 |
| VP04 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 G1~9 | 해당 없음 — 직접 oracle |
| VP05 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 H1~5 | M4 |
| VP06 | REQUIRED | SELF_BLOCKED(H1만 대기) | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 A1~19·C1~9·E1~10·F1~10·I1~5 | M1·M2 |
| VP07 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 A1~19·B1~17·D1~6 | M1·M3·M4 |
| VP08 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 E1~10·F1~10 | M1 |
| VP09 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 H1~5·A1~19 | M4 |
| VP10 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 B1~17·C1~9 | M1·M2·M3·M4 |
| VP11 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 E1~10·F1~10·A1~19 | M1 |
| VP12 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 G1~9·H1~5·C1~9 | M2·M4 |
| VP13 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 A7·A8·A9·A10 | 해당 없음 — 직접 oracle |
| VP14 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 B2·B3·B4·B5·D1·D2·D3 | 해당 없음 — 직접 oracle |
| VP15 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 E3·E4·E6·F1·F5·F6·F7·F8 | M1 |
| VP16 | REQUIRED | SELF_PASS | [자리별 관측과 테스트 좌표](implementation-evidence.md)의 G1·G2·G3·G4 | 해당 없음 — 직접 oracle |

SELF_PASS 15 · SELF_BLOCKED 1 = REQUIRED 16. 기계 자리 90/90과 H1 실기 완료는 별개다. VP06은 실제 Windows CLI의 main 조립까지만 측정했으며 실제 앱 창 전환과 타 PC 인수를 기다린다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| F3·F4·F5·F7 restart를 반대 revision 축으로 운반 | M1 / O6 | 해당 없음(r1) | managed-mcp-revision / 각각 1·1·3·1 red | 원복마다 3 green |
| C3 models/agents 맞바꿈, C5 store 승격 연결 제거 | M2 / O9 | 해당 없음(r1) | composer-promotion / 각각 3·1 red | 원복마다 5 green |
| B15 두 준비 진입을 별도 service로 조립 | M3 / O2 | 해당 없음(r1) | composer-preparation-service / 1 red | 원복 2 green |
| H1 시작·H2 gate 재평가·H5 종료 각각 제거 | M4 / O8 | 해당 없음(r1) | bootstrap.opencode-warmup / 각각 2·2·1 red | 원복마다 5 green |

선택 증거 10자리 + 이전 검증 인용 변이 0 + 별도 신설 구조적 oracle 0 = 10자리(위 표 4그룹). [개별 변이 기록](implementation-evidence.md#선택된-변이)에 정확한 주입과 원복 결과를 남겼다. F5는 snapshot을 받지 않는 scalar 함수이므로 반대 축 fixture 값 37을 주입했다. 나머지 행동 oracle에는 추가 mutation을 만들지 않았다.

기존 대표 테스트의 즉시 dispose·동결된 전역 선택·MCP 변경 시 모델 삭제 기대값을 새 계약으로 바꿨다. 다른 cwd/profile 격리·프로젝트 쓰기 거부·startup/transport 실패 assertion은 보존했다. 이전 verify의 red 변이는 없다. 고정 자리 ID−보고 ID와 역차집합은 각각 빈 집합이다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 화면을 닫은 관측의 실패가 토스트로 남는가 | 취소는 typed reason으로 끝나고 read-only partial·generation 없음; 실제 실패/성공 empty는 구별 | T22·T23·T29~32 |
| 토글 직후 도구가 아직 옛 상태인가 | desired와 applied를 분리; busy 동안 configurationPending, 성공 후 목록 재조회 | T34·T36·T52·T53 |
| 첫 입력에서 모델 메뉴가 지워지는가 | 실제 chatStore에서 같은 draft/cwd/provider/agent만 snapshot·flight 승계 | T27·T28 |
| 웜업이 사용자의 시작을 막는가 | 실제 Bootstrap start는 기다리지 않음; gate/quit에 owner 취소 | T26·T47~51 |
| 부분 실패·늦은 응답의 소비자가 있는가 | 직렬 read와 revision/serial fence로 폐기, 명시 재시도 경로 유지 | T18·T29~33·T43 |
| 실제 앱 창의 전후 체감도 확인했는가 | 실제 CLI main 조립 측정 완료; renderer 창·타 PC 시간선 미측정 | AC22/H1 인수 대기, SLA 주장 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| I1 | native 토글과 명시 refresh가 겹치면 상태 seed와 control revision이 경합 | read를 mutation/submit과 같은 directory queue에 넣고 동시 read flight 공유 | bootstrap.native-history·adapter inventory 시험 통과 |
| I2 | live read 도중 source 변경 시 과거 generation으로 반환 가능 | 한 번 최신 read 재시도; 연속 교체는 안전한 disconnected partial | handlers/managed-mcp-resources의 retry/churn 단언 |
| I3 | 테스트 fixture가 실제 사용자 MCP 파일을 참조함 | fixture mcpJsonPath를 임시 경로로 명시; 관측된 fixture user 항목만 제거 | 제거 당시 fixture-user 항목이 사라지고 mcpServers가 빈 객체임을 확인. 원래 파일 존재/서식의 완전 복원은 확인 불가 |
| I4 | 종료 측정의 고정 2초 대기로 정상 종료보다 먼저 단언 | bounded exit/signal 관측으로 교체; production 종료 timeout은 변경 없음 | 실제 CLI 생성 child 모두 exit 확인 |
| I5 | Windows I/O 오류로 선택 변이 원복이 실패 | 원본 bytes 보존, gate callback 복구 후 H2/H5 red·원복 green 재실행 | 변이 기록; start/update/close 배선 재확인 |
| I6 | 실제 CLI 시험의 소비자가 turn.aborted에서 iterator를 끝내 interrupt HTTP 완료 전에 채널을 닫음 | 실제 persistent runtime처럼 interrupt 완료까지 event 소비를 유지한 뒤 명시 close | managed-mcp.cli.integration의 승인 취소·turn.aborted·child 종료 단언 유지 |
| I7 | 실제 CLI 거절 후 model tool 메시지가 없는 경우 기존 문자열 oracle이 실패 | SDK permission reply의 reject/200과 도구 실행 증가 0을 직접 단언; 허용 결과는 해당 턴의 실제 role=tool 출력에서 확인 | managed-mcp.cli.integration; native background 요청의 마지막 도착 순서에 의존하지 않음 |

### 설계 대비 명시적 차이

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 / 공유 / 재진입 / 무효화 | O10의 OS spawn은 fixture여서 실제 OS 종료를 단독 증명하지 못함 | T03의 경계·비밀 단언 + 별도 실제 CLI 전후 측정. 실제 앱 GUI H1은 미완료 |
| oracle 파일 위치 | O10이 O5와 같은 실제 조립/fixture를 공유 | `opencode-mcp-reconcile.test.ts`의 trace 케이스가 A·B·D·E·I 경계 실행 |
| ABI 실행기 | plain Node 전체 실행의 DB 사례는 Electron ABI로 로드 불가 | DB 파일을 Electron Node 모드로 분리 재실행, ABI를 교체하지 않음 |
| 문서 링크 gate | 기존 임시 checkout 두 곳의 링크가 전역 스캔에 포함 | generated/prose 통과, 기존 링크 10건은 설계 때와 동일; 이번 문서 상대 링크 별도 확인 |

## [구현자 기입] 구현 보고

구현과 기계 게이트를 완료했다. commit 좌표는 INDEX의 검증자 기입란을 따른다. 실제 CLI 전후 결과는 [CLI 관측](cli-evidence.md), 직접 oracle·검색·변이는 [구현 관측](implementation-evidence.md)을 참조한다.

| AC | 결과 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | T22·T23 draft/saved 취소 안전 DTO, renderer 토스트 없음 |
| AC2 | ✅ | 최신 재조회·연속 churn partial, 실제 실패/empty 구별 |
| AC3 | ✅ | T03 두 send까지 process/bridge 1; 실제 CLI도 유예 내 1 |
| AC4 | ✅ | T06 89,999/90,000ms·cap4·ack/event 경계 |
| AC5 | ✅ | T10~13 consumer 즉시 반환·T18 peer 성공/late release |
| AC6 | ✅ | T04·T05·T07·T08 replacement 보호·종료 timer 정리 |
| AC7 | ✅ | T27 실제 승격에서 같은 선택만 snapshot/flight 보존 |
| AC8 | ✅ | T21 두 IPC+warmup resolve/prepare 각각 1 |
| AC9 | ✅ | T33 공유 slot·5초 만료·실패 재시도, T32 visible reopen |
| AC10 | ✅ | T34·T37·T03 토글 뒤 process/instance/bridge 유지 |
| AC11 | ✅ | T34 처음 disabled 정의를 연결; off 항목 실행 제외 |
| AC12 | ✅ | T34 native 전역 live 적용·project 우선·원문 파일 불변 |
| AC13 | ✅ | T36·T52·T53 busy/background/queued/wakeup·제출 barrier |
| AC14 | ✅ | T35·T37·T38 정의/auth 변화와 두 턴의 restart 정책 |
| AC15 | ✅ | T39~41 공유 probe·설치 metadata·독립 반환 |
| AC16 | ✅ | T39~44 동일mtime/부재/환경/.git/설치·stale flight |
| AC17 | ✅ | T21·T47 Bootstrap 웜업과 foreground 공유·비차단 |
| AC18 | ✅ | T26·T48~51 backend/CLI/gate/shutdown·실패 재시도 |
| AC19 | ✅ | Claude/DB/IPC·회귀 시험, 신규 DB migration·IPC 채널 없음 |
| AC20 | ✅ | T09·T15·T16 profile/cwd·인가/철회·bridge 정리 |
| AC21 | ✅ | T02·실패/재시도 스위트·중복 prompt 없는 두 턴 |
| AC22 | ⚠️ | 사건/비밀 단언·실제 Windows CLI 전후 확보; 실제 앱 창과 타 PC H1 대기 |

✅ 21 · ⚠️ 1 · ❌ 0 = 총 22. Criteria-Met은 21/22이며 AC22의 미측정 범위를 pending으로 남긴다.

| Gate | 관측한 산출 | 판정 / 남은 경계 |
|---|---|---|
| G0 | V1 REQUIRED 16·고정 자리 90; 구현 7섹션·ID 양방향 차집합 빈 집합 | 규범 행 불변·diff check·보드 재확인 |
| G1 | npm run lint: error 0/warning 2(기존 React Compiler), npm run typecheck: node/web/test 모두 exit 0 | 마지막 추가 시험·측정 script scoped lint도 error 0 |
| G2 | 전체 첫 실행 860파일: 7,685 pass/345 fail/88 pending; 파일별 최신 집계 862파일: 8,125 pass/0 fail/2 skipped | 전체 한 번에 green이라고 보고하지 않음 |
| G3 | generated/prose 정상, 기존 .tmp/opencode-dev·app/.temp/opencode 링크 10건 실패 | 변경 문서 링크 누락 0, 기존 복사본 보존 |
| G4 | scripts 144/144; migration append-only·test-budget 16 suite 정상; 실제 CLI 전후 측정 | 실제 GUI/타 PC 인수는 미완료. release build·독립 verify 아님 |
| G5 | INDEX impl/IMPL_DONE·다음 Claude; trailer는 커밋 직후 파싱 확인 | 구현 commit/push는 공유 작업 브랜치 |

G2의 ABI 실패 301케이스는 Electron Node 모드 43파일/410케이스 통과로 대체 관측했다. 추가 DB targeted 3파일/50케이스도 통과했다. fork worker 종료 지연 진단이 출력됐지만 DB report 실패 0·프로세스 exit 0을 확인했다. 나머지 경합/fixture 기대값을 수정하고 해당 파일을 재실행했다. 시간 초과는 단독 재현 실행으로 구별했다. 파일별 최신 report 집계와 상세 한계는 CLI 관측 문서에 함께 남긴다.

## [구현자 기입] Review Signals — 사실만

- 라운드는 V1 r1이다. 중간 `계속`은 중단된 같은 구현 작업을 재개한 것이며 verify 없는 새 재구현 라운드를 만든 것이 아니다.
- 이전 verify 결과·미검출 변이 이력은 없다. 이번 전체 게이트가 status read/reconcile 경합과 기존 fixture 기대값 불일치를 드러냈다.
- 선택 변이 10자리 모두 assertion red와 원복 green을 확인했다. 파일 I/O 오류로 한 번 원복이 실패해 bytes 복구와 재실행을 수행했다.
- 이 Windows 호스트의 I/O/CLI startup/test timeout 변동, SQLite ABI, 기존 임시 checkout 링크 실패를 반복 관측했다. 지연을 제품 timeout/SLA 변경 근거로 쓰지 않았다.
- 실제 사용자 MCP 파일을 건드린 테스트 격리 오류(I3)가 있었다. 기록된 fixture 항목만 제거했으며 원래 파일 상태 완전 복원을 주장하지 않는다.
- 실제 앱 창·타 PC의 H1 증거는 없다. 독립 verify가 아직 없고, 0288 등 이전 handoff도 검증 완료로 올리지 않았다.

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| 미착수 | — | — | — | — | — |
