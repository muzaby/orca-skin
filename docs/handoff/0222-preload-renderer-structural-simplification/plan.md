# Plan — Preload·Renderer 책임 및 상태 갱신 단순화

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-09-08 |
| 상태 | READY |
| 기준 코드 | `fbaac3fc` |
| V mode / 기준 V / revision / 유효 V | Baseline V / none / V1 / V1 |

# Part I — Product & UX Contract

## 1. 목표

preload와 renderer에서 흩어진 책임·중복 전달·불필요한 상태 교체를 정리한다. 사용자는 같은 화면에서 같은 입력·선택·취소·설정 저장·검색 결과를 받으며, 같은 데이터와 이벤트를 처리하는 불필요한 작업이 줄어든다.

## 2. 사용자 의도 / 요구 출처

사용자 요청은 “같은 조건으로 preload, renderer로 수행하라”다. 승계 조건 원문은 “파편화”, “결집/결합”, “중복된 기능”, “단 해결을 위해 플랫폼화(비대화) 하는 것은 안되며 회귀 또한 안된다”, “추후 구조적으로 계층이 더 생길것을 대비해(srt, cowork, opencode adapter 등) 경량화/모듈화를 미리 준비”, “추가적으로 성능저하을 유발하는 코드도 포함하여 진단” 및 “리팩토링 수준으로 요구한 것임”이다.

해석: 파일 길이를 기계적으로 줄이지 않고 실제 소유자·데이터 전이·반복 비용을 정리한다. 현재 코드와 테스트를 기준으로 하며 미래 기능을 미리 구현하지 않는다.

## 3. Decision Ledger

| ID | 결정 | 출처·이유 | 상태 |
|---|---|---|---|
| D-01 | 진단 후 구조 리팩토링까지 수행한다 | 사용자 “같은 조건”, “리팩토링 수준” | ACTIVE |
| D-02 | 기존 계층·도구 안에서 소유를 맞추고 중복/죽은 전달을 제거한다 | 사용자 경량화·플랫폼 비대화 금지 | ACTIVE |
| D-03 | 공개 preload API·IPC·DB 형식·UI/DOM·입력·실패 정책을 보존한다 | 사용자 회귀 금지 | ACTIVE |
| D-04 | 현재 생산 경로에서 반복 호출·할당·전파를 줄이고 실측과 추론을 구분한다 | 사용자 성능 진단 추가 | ACTIVE |
| D-05 | SRT·cowork·OpenCode adapter, 신규 의존성과 범용 query/CRUD/event 플랫폼을 도입하지 않는다 | 미래 계층의 준비라는 기존 목적 | ACTIVE |
| D-06 | 화면별 다른 요청·실패·수명을 같은 정책으로 합치지 않는다 | D-03의 구현 해석. provider step/gate, 삭제 시점, 사용량 mirror/stat 구분 | ACTIVE |

갱신 메모: 기존 0221의 사용자 조건을 이 영역의 새 Baseline V에 적용했다. 0221의 구현/검증 상태는 바꾸지 않는다. ACTIVE 결정↔AC1~9를 대조했으며 충돌 0이다. 별도 사용자 제품 선택은 없다.

## 4. 요구 비판적 검토

| 관측 | 판단 |
|---|---|
| preload는 명시적 method만 노출하고 raw ipcRenderer는 숨긴다 | 공개 표면을 유지하며 반복 구독/해제 구현만 결집 |
| chat reducer·store가 크지만 세션/스트리밍 분리를 이미 갖는다 | reducer/통합 store를 기계적으로 쪼개지 않고 같은 entry의 갱신을 모음 |
| 조회·캐시·실패 정책이 비슷해 보이는 hook이 서로 다르다 | provider 상태·CRUD·사용량·삭제 정책의 공통 플랫폼화 제외 |
| 최초 renderer/preload/shared 실행이 통과한다 | 기준 동작과 이관 테스트를 보존하며 신규 직접 oracle을 추가 |

## 5. 동작 / 사용자 흐름

| 시작 | 성공·실패 및 전이 계약 |
|---|---|
| preload 이벤트 구독·해제 | 해당 payload만 callback으로 전달. Electron 이벤트 객체는 전달하지 않으며 해제는 자기 listener만 제거 |
| 채팅 delta/완료/telemetry·다중 세션 | 세션 라우팅과 rAF delta batching 유지. 한 이벤트의 committed/live 결과를 일관되게 반영하며 다음 pending 전송 순서는 유지 |
| 파일 토큰 입력·cwd/dir 변경·닫기 | 기존 후보/최대 표시·quoted/hidden·loading·선택 규칙 유지. 현재 디렉토리 조회 결과만 반영 |
| 세션 목록 재조회·제목·고정·삭제 | 같은 값은 같은 행/목록 참조, 변경된 값은 모든 해당 뷰에서 갱신. 최근/프로젝트 membership과 GC·실패 의미 유지 |
| 설정 로드·변경·실패·unmount | 초기값→저장값, 즉시 낙관 반영→실패 시 기존 전체 이전 snapshot rollback 유지. patch당 IPC 횟수·DOM 효과·provider 수명 유지 |
| 검색·사용량 화면 | 기존 query debounce/응답 순서·키보드/외부 클릭·선택 후 navigate→close 유지. telemetry provider 고정과 전역 폴백·경계 갱신 유지 |

## 6. 범위 / 비범위

선택 범위는 §10의 preload 구독, 채팅 상태/자동완성/제출 판정, 세션 목록, no-op 프로젝트 호스트, Tweaks, 검색·사용량 책임 이동이다. UI 클래스·DOM 마커·정적 배치를 변경하지 않는다.

미구현 adapter·격리 계층의 호환성 실증, 새 pagination/전역 파일 캐시, provider 통합 runtime, 설정 저장 debounce/rollback 정책 변경, 실제 사내망·대형 데이터 성능 SLA는 비범위다. 이들은 현재 리팩토링의 선행 조건이 아니다. `useSessionHandlers`와 `useSessionActions`의 서로 다른 삭제 순서도 유지한다.

## 7. Requirements / Acceptance — R↔AT

| R / AT / AC | 관측 기준 | 직접 검증·도달 경로 |
|---|---|---|
| R-01 / AT-01 / AC1 | 공개 이벤트 endpoint가 올바른 채널/payload를 전달하고 자기 구독만 해제한다 | 실제 contextBridge 노출 객체→각 이벤트→두 소비자→해제. 기존 invoke 인자 회귀 |
| R-02 / AT-02 / AC2 | 채팅의 완료/telemetry 결과·세션 격리·pending 전이가 같고 무효 변경은 상태/notification을 만들지 않는다 | 실제 chatStore.receive/actions→snapshot·구독 결과, 기존 complete/error/FIFO/권한/lease 회귀 |
| R-03 / AT-03 / AC3 | 같은 cwd/dir의 활성 토큰 prefix 변경은 진행 listing을 재시작하지 않고 새 cwd/dir·닫힘은 stale 결과를 막는다 | 실제 hook을 구동하는 지연 IPC fixture의 호출·현재 suggestions/loading/validPaths |
| R-04 / AT-04 / AC4 | 제출 허용·pending·provider 차단과 draft/첨부/요구사항 clear가 기존 결과를 유지한다 | submit lifecycle→실제 clear/유지, 두 predicate의 독립 정책 회귀 |
| R-05 / AT-05 / AC5 | 재조회가 같은 목록이면 참조를 보존하고 변경된 행·membership·GC를 정확히 반영한다 | session/project API→실제 sessionsStore→nav projection, 실패·미조회/빈 목록 회귀 |
| R-06 / AT-06 / AC6 | 프로젝트 초기 로드가 기존 부트 경로에서 유지되고 no-op Provider가 없어도 나머지 구독/순서가 유지된다 | 실제 boot steps/project store와 App 조립 |
| R-07 / AT-07 / AC7 | Tweaks 값·저장·rollback·DOM 효과가 같고 소비자는 필요한 필드만 선택한다 | provider 소유 store→settings API/selector/DOM 효과, 여섯 소비자 배선 |
| R-08 / AT-08 / AC8 | 검색·provider 동기화·telemetry 사용량의 표시/상호작용을 보존하며 app/pages는 조립을 맡는다 | SearchModal→선택 callback→app navigate, SyncRow refresh 결과, telemetry hook→usage mirror |
| R-09 / AT-09 / AC9 | 실제 중복 전달/반복 상태 교체가 줄고 현재 계층 안의 책임이 명확해진다 | 삭제·이동·호출 전수 조사와 진단 보고서. 새 framework/공개 계약/의존성 없음, 전체 회귀 gate |

# Part II — Technical Design

## 8. 현재 조사와 기준선

| 대상 / 조사 | 관측 / 의미 |
|---|---|
| preload `onEvent|onStatus|onTitle|onUsage|onState|onProgress` | chat/install/session/cost/provider/concurrency/update state/progress의 같은 listener 패턴 8곳 |
| chat dispatchTo/patchLive/patchPending와 receive | reducer no-op에도 entry 교체, completed/telemetry의 같은 entry가 복수 transaction으로 전이 |
| useFileAutocomplete 의존/생산 소비 | effect가 match 전체에 의존, 생산 소비자 ComposerInputController 1곳. prefix 변경이 pending IPC를 재시작 |
| submitClearGate/steerGate import | clear gate는 composerSubmit, provider 경계는 Composer/chatStore가 소비. 서로 다른 판정 의미를 유지하며 기존 소유자에 결집 |
| sessionsStore initSessions/loadProject | 최근 조회는 항상 교체, 프로젝트 조회만 동일 항목/ID 비교. mergeItems는 비교 전 전체 복사 |
| ProjectsProvider/subscribeProjects/initProjects | Provider는 빈 cleanup 호출뿐. 초기 조회는 app/boot/steps가 소유 |
| Tweaks 생산/소비 | useTweaks와 TweakProvider로 상태/효과 분리, context 전체 값에 Header/Sidebar/UserButton/CompletionNotifier/DebugPanel/GeneralTab 6곳 의존 |
| SearchModal/SyncRow/telemetry hook | 검색은 app의 기능 로직, SyncRow는 ProviderUsageTab만 소비, telemetry hook은 chat+shared만 의존하므로 chat 배치 가능 |
| import/크기 조사 | renderer TS/TSX 생산 그래프·큰 파일·작은 단일 소비자 모듈을 확인. 배럴 export는 실제 rg로 보완해 미사용으로 오판하지 않음 |
| 변경 전 gate | plain Node + 시험 USERPROFILE에서 preload/renderer/shared 175파일 1,400개 PASS, 실패/skip 0. SQLite ABI 변경 없음 |

## 9. 책임·데이터 흐름

- **Preload**: index.ts의 private subscribe 함수가 listener 생성/on/off를 소유한다. 각 공개 메서드는 같은 채널 상수와 payload 타입을 명시한다. helper/raw IPC는 window에 노출하지 않는다. invoke/sendLog/File path/플랫폼/expose 분기는 유지한다.
- **Chat**: 기존 store 안에 entry 변경 소유를 모으고 동일 entry는 root identity를 보존한다. completed/telemetry의 reducer/live 반영만 결집하며 다른 이벤트 라우팅·승격·다음 입력 전송을 앞당기지 않는다. listing effect는 cwd/dir/token 활성만 query identity로 삼고 prefix 필터·selection은 현재 match를 사용한다.
- **제출**: submitClearGate는 composerSubmit, steerGate는 sendAdmission으로 이동한다. export 사본이나 forwarding module을 남기지 않고 기존 tests를 새 경계로 이관한다.
- **Sessions/projects**: 같은 store의 항목 비교/병합을 최근·프로젝트 조회가 공유한다. 필요한 첫 변경에서만 복사하고 membership GC 결과까지 동일할 때 기존 참조를 반환한다. no-op projects Provider와 subscribeProjects만 삭제한다.
- **Tweaks**: 기존 TweakProvider가 provider별 Zustand store의 소유자다. useTweaks의 타입/default/settings load/patch/rollback을 이 경계에 흡수한다. 안정된 context store 포트와 필수 selector로 소비 필드를 제한하며 singleton·새 settings service는 만들지 않는다. 기존 hook 파일은 삭제하고 타입 소비도 현재 owner로 옮긴다. mount 이후 get 완료의 취소 판정·patch 순서/rollback은 유지한다. StrictMode의 effect 재설치에서도 다시 로드할 수 있도록 취소는 요청별 closure로 한정한다. 선택 필드는 Header=sidebarCollapsed, Sidebar=sidebarCollapsed/sidebarWidth, UserButton=uiLocale, CompletionNotifier=notifyOnComplete, DebugPanel=theme/sidebarCollapsed, GeneralTab=theme/appFont/uiLocale/density/notifyOnComplete다.
- **화면 책임**: SearchModal은 sessions/components로 옮기고 onChoose(sessionId)를 받는다. app OverlayLayer가 navigation을 연결하고 feature는 기존 순서대로 선택 callback→close를 호출한다. SyncRow/CostRefreshView는 ProviderUsageTab 내부로, telemetry usage hook은 chat/hooks로 이동하고 page는 feature export를 읽는다.

UI 이동 시 JSX·클래스·DOM 마커를 보존한다. 새 저장소·새 채널·새 메타데이터는 없다. 서로 다른 provider 수신·CRUD·삭제 수명은 합치지 않는다.

## 10. 강제 지점 전수

| EP | 지점 / 소유 | 보존·실패 의미 |
|---|---|---|
| EP-01 | preload 공개 이벤트 8곳과 private listener/off | payload만 전달, 채널 혼선/형제 listener 제거 금지 |
| EP-02 | chatStore dispatch/entry 갱신 + receive completed/telemetry | 동일 세션 committed/live 일관성, 다른 entry 보존, no-op notification 없음 |
| EP-03 | useFileAutocomplete listing effect·cache reset·현재 filter | pending prefix 재조회 제거, cwd/dir/닫힘 stale 차단·빈 결과·quoted/hidden·loading 보존 |
| EP-04 | composerSubmit clear gate, sendAdmission provider/pending predicate, Composer/chatStore 소비 | IME/revision/첨부 drift·accepted 실패 clear 금지, provider 정책에 pendingCount를 혼합하지 않음 |
| EP-05 | sessions init/refresh·loadProject·patch·membership GC | 행/ID 순서·프로젝트 참조·미조회/빈 목록·실패 상태 보존 |
| EP-06 | ProjectsProvider·subscribeProjects·배럴·App wrapper·boot projects step | 죽은 구독만 제거, 실제 초기 load/나머지 provider 순서 보존 |
| EP-07 | TweakProvider 초기 load/patch/rollback/DOM 효과 + 6소비자·type/barrel | provider 수명, settings IPC 횟수, 현재 DOM 효과, 소비 selector 범위 유지 |
| EP-08 | app SearchModal→sessions, OverlayLayer의 선택/navigation 연결 | debounce·늦은 응답·키보드·Escape/외부 click·snippet·선택 후 close 순서 |
| EP-09 | UsageTab SyncRow export→ProviderUsageTab, 호출·props | disabled/spinner/error/timestamp·provider remount 그대로 |
| EP-10 | pages telemetry usage hook→chat, 페이지 3곳·feature export | 마지막 telemetry provider·global 폴백·boundary 이후 조회 유지 |

## 11. V 노드·pair·검증

R/AT-01~09, SD/ST-01~02, AR/IT-01~04, MD/UT-01~04는 기준 코드의 현재 계약을 이 리팩토링에서 명시한 NEW Baseline V 노드다. 아래 pair는 모두 REQUIRED다.

| Pair | 노드 | start → edges → end / oracle | EP |
|---|---|---|---|
| VP-01~09 | R-01~09 ↔ AT-01~09 | §7 각 행의 실제 생산 경로와 직접 결과 | 동일 AC의 §10 지점 |
| VP-10 | SD-01↔ST-01 | preload push→chat receive→세션 commit/live/pending→completion 소비 / 최종 상태·알림·세션 격리 | 01·02·04 |
| VP-11 | SD-02↔ST-02 | mount/settings get→patch→reject/cleanup→selector·DOM / 이전 값·scope·효과 보존 | 07 |
| VP-12 | AR-01↔IT-01 | token 입력→실제 hook→지연 files IPC→cache→현재 후보 / 호출량·stale·loading | 03 |
| VP-13 | AR-02↔IT-02 | boot/refresh/project 조회→sessions entities/membership→nav / identity·순서·GC | 05·06 |
| VP-14 | AR-03↔IT-03 | feature SearchModal→app callback→navigation/close 및 사용량 hooks→표시 / 실제 callback·props | 08~10 |
| VP-15 | AR-04↔IT-04 | Provider context store→실제 selector 소비→settings API/DOM / 필요한 필드와 안정 action | 07 |
| VP-16 | MD-01↔UT-01 | 공개 이벤트 메서드→listener 생성→emit/off / payload·채널·개별 해제 | 01 |
| VP-17 | MD-02↔UT-02 | entry 전이·submit predicate→store/clear / no-op·완료·거절·drift | 02·04 |
| VP-18 | MD-03↔UT-03 | sessions 동일성 비교→merge/GC / 동일 참조·바뀐 행만 갱신 | 05 |
| VP-19 | MD-04↔UT-04 | Tweaks 초기값/patch/rollback→selector/DOM 및 query filter / 값·부수효과 | 03·07 |

기존 preload/renderer/shared 전체 suite를 회귀 집합으로 재실행한다. 이동 때문에 기존 behavioral oracle을 폐기하지 않는다. hook fixture는 React의 전체 브라우저 스케줄러를 실증했다고 표현하지 않고, 실제 hook의 deps·effect·cleanup·상태 결과를 관측한다. UI 코드 이설은 기존 JSX/DOM와 선택 callback·표시 분기를 직접 대조한다.

선택 적대 증거: EP-01 공개 채널 맞바꿈/해제 listener 오류는 실제 exposed 객체 시험이 실패해야 한다. EP-03에서 match 전체를 effect 의존에 되돌리면 지연 IPC 횟수가 실패해야 한다. EP-07의 patch/DOM 또는 selector 연결을 누락시키면 실제 상태·효과/소비자 검사가 실패해야 한다. 단순 삭제 모듈 grep이나 파일 크기는 이 oracle을 대체하지 않는다.

## 12. 구현·운영 gate

1. 이 READY 설계를 구현과 별도 커밋한다. 기능별 병렬 구현 후 root가 통합한다.
2. preload/renderer/shared 전체 시험, node/web/test 타입 검사, 변경 subtree 및 shared lint(boundaries/hooks 포함), doc inventory/링크·실-git test budgets·diff 검사를 수행한다. 새로운 runtime dependency나 ABI rebuild는 없다.
3. 변경 전/후의 테스트 이관 차집합, production 소유·파일 이동·호출 감소를 진단 보고서에 남긴다. 시간·최대 메모리 벤치마크가 아니면 속도 향상률을 쓰지 않는다.
4. Main 코드/공개 IPC를 변경하지 않으므로 Main 전체 재실행은 기본 gate가 아니다. 통합 중 그 경계를 변경하면 관련 gate를 추가한다.
5. 구현 자기검증 후 INDEX를 impl/IMPL_DONE으로 넘긴다. 독립 handoff verify의 PASS를 선점하지 않는다.

READY 정합성: D-01~06을 AC1~9 및 §9~12에 대조했고 충돌 없음. 생산 소비자·기존 시험·레이어 규칙과 참조 경로를 조사했다. 신규 제품 선택/외부 규약 변경 없이 구현 가능하다.

## [구현자 기입]
