# [구현자 기입] 구현 보고 r8 — Work / Code 명시적 구성

작성: **Codex**, 2026-09-10. [ΔV8](structural-plan-r8.md), 설계 커밋 `4e9e51fa` 기준 **impl/IMPL_DONE**, 자기확인 **7/7**이다. 독립 verify는 pending이다.

## 1. 설계 대조

현재 종류를 `work | code`로 통일했다. 새 출생 기본값은 명시된 `code`이며, Work 조건의 반대 결과로 Code를 추론하지 않는다. 현재 send 입력과 DB 읽기는 엄격히 검증한다. Renderer `LOAD_SESSION`의 명명된 구형 읽기 경계만 정확한 `coding`과 필드 누락을 `code`로 변환한다.

정책은 기존 책임을 따라 나눴다. 공용 권한·세션 능력은 `src/shared`, 실행 지침과 응답 경계는 Main `profiles`, 화면 표현과 패널은 chat feature가 각각 소유한다. 두 종류의 정의는 완전한 타입 맵이다. app 조립자가 Main feature에 정책 포트를, sessions UI에 표시 해석기를 주입한다. 새 전역 Provider·등록 프레임워크·기반 클래스·의존성을 만들지 않았다.

기존 실행기·도구·확장 빌더·카드·store를 유지했다. SRT/OpenCode 실행, 뷰어와 컨텍스트 자동 감지는 이번 구현 범위가 아니다. Q-R5-01의 Work worktree 전송 정책도 변경하지 않았다.

## 2. 강제 지점 전수와 V-pair 자기확인

| EP | 실제 소비처 | 관측 |
|---|---|---|
| EP1 | `agent-kind`, SendChat schema와 `resolveAgentKind`; DB DTO/history reader; reducer의 출생·선택·LOAD_SESSION; store의 draft 목록 및 일반/busy send | 현재 종류·구형 읽기·unknown 거부, 세션 종류 고정과 상속 |
| EP2 | 0023 SQL/등록, `DbQueries` insert·목록·재개, 실제 SQLite migration fixture | 값·기본값·CHECK, PK/FK/인덱스·메시지·검색·lineage·게시 참조, 재열기와 rollback |
| EP3 | send/resolve/turn context; extension builder·warm 경로; send→TurnCoordinator, bootstrap→HistoryWriter; session-directory/files의 await 전후 검사 | 지침·프로필 key·실행 재사용, 응답 경계 생성/기록, busy·경로·세션 변경 거부 |
| EP4 | 공용 permission 정착표·계획 승인 목표·auto 대체; Composer `modes`; 공용 session capability→Main handler 및 reducer/store | Work/Code 메뉴·버튼 라벨·실제 실행 정착 일치, 모델 판정 유지 |
| EP5 | presentation→랜딩 toggle/hero/Composer/Cwd/Git; TranscriptView→Exchange/AssistantTurn→공통 도구/하위 에이전트 카드; ApprovalCard; panel registry/layout/target/badge/chrome; sidebar slots·ProjectLandingPage→sessions 목록/행 | 종류 재해석 대신 선택된 정책/표시 props 사용, 실제 렌더·클릭 |
| EP6 | 입력 controller·draft와 extraDirs; BranchChip deferred 응답/cwd 캐시; raw panel columns·상세/닫기; Work projector·memo·세션별 transcript key | 표시 토글 후 입력·첨부·캐시·패널 선택과 기존 참조 수명 보존 |
| EP7 | root/r8 plan·INDEX, 현재 arch/IPC/i18n·generated inventory, 본 보고·커밋 trailer | 현재 종류·소유자·진행 상태·Codex 작성자 일치 |

EP5의 sessions 소비처는 recent/draft 목록, pinned 세션, pinned 프로젝트 자식, 프로젝트별 세션 목록과 공통 SessionRow다. 해석기는 app/pages에서 전달하며 sessions→chat import는 없다. `TaskPanelContent`의 `work/plan`은 화면 배치 모드라 유지하며 제품 AgentKind의 대체 분기로 사용하지 않는다.

| Pair | 직접 oracle | 자기 상태 |
|---|---|---|
| VP-R8-01 | 실제 종류 선택/복원·저장 이행과 화면 라벨 | SELF_PASS |
| VP-R8-02 | admission/상속/후속 턴, 입력·Git·패널 수명 | SELF_PASS |
| VP-R8-03 | DB→DTO/reader와 profile→실행/응답 경계 | SELF_PASS |
| VP-R8-04 | 권한·본문·패널·nav 실제 소비/클릭 | SELF_PASS |
| VP-R8-05 | strict/legacy 경계, 양쪽 완전한 정의와 정적 참조 | SELF_PASS |
| VP-R8-06 | 기존 권한/모델/프로필/경계/상속/캐시/출력 회귀 | SELF_PASS |

## 3. 이번 라운드 수정의 잠금

[초기 RED](evidence/r8-root-red.json)에서 unknown 종류가 거부되지 않는 경로와 이전 출생값을 관측했다. [구형 읽기 RED](evidence/r8-legacy-load-red.json) 뒤에 `LOAD_SESSION`만 명시 decoder로 연결해 [5/5](evidence/r8-legacy-load-green.json)를 확인했다. Main은 enum/프로필, migration, DB 읽기, 주입된 false 응답 정책, 손상 종류의 디렉토리 요청에서 실패를 먼저 관측하고 같은 시험을 통과시켰다([Main 기록](evidence/r8-main-storage-and-policy.json)).

계획대로 실제 반환값·DB 내용·렌더·클릭·수명을 oracle로 사용한다. 별도 결함 변이는 선택하지 않았다. `coding` 잔여와 종류 비교 검색은 누락 조사에만 썼으며, 조건문 개수를 동작 검증으로 대신하지 않았다.

## 4. Product/UX 파생 검토

랜딩의 아이콘·히어로·입력·첨부를 유지하고 현재 종류 라벨만 코드/Code로 맞췄다. Work에서는 Git을 숨기되 BranchChip 인스턴스와 이미 시작한 조회·같은 cwd 캐시가 남는다. Work의 수동 승인·자동 승인·모든 승인 건너뛰기와 Code의 기존 메뉴, custom/미지원 모델 제외, bypass 확인 흐름을 유지했다.

Work 작업 패널과 Code 계획 패널의 표시 정책은 raw 배치 상태와 분리했다. 닫은 패널을 정책 선택 때마다 재생성하지 않으며 상세 진입/Back·scroll·Work transcript remount를 기존 소유자가 관리한다. 세션 목록은 제공된 아이콘·라벨만 렌더하며 미확인 파란색·굵기와 읽음 복구를 유지한다.

현재 DB의 손상된 종류를 일반 Code로 숨기지 않는다. 구형 호환은 저장 migration과 명명된 읽기 경계로 한정한다. 폴더 추가와 열기의 실제 경로·busy·비동기 중 상태 변경 검사는 Main에 남겼다.

## 5. 발견한 문제와 대응

- 교차 코드 점검에서 Composer 카탈로그의 `Object.fromEntries as Record`가 타입 완전성을 우회함을 발견했다. 모드별 키와 값이 일치해야 하는 정적 카탈로그로 교체했다. 라벨/순서는 동일하다.
- 전체 renderer 실행의 다섯 실패는 ChatTitleBar 테스트의 이전 `coding` registry 키였다. 명시 `code`로 갱신하고 해당 파일을 포함한 집중 회귀를 통과시켰다. 두 WorkActivity 테스트의 필수 prop 누락도 수정했다.
- [초기 lint](evidence/r8-lint-initial.log)는 migration 테스트의 cast 구문과 nav 테스트의 feature 교차 import를 검출했다. cast를 올바른 결과에 한정하고 nav 단위 테스트는 주입된 표시 계약을 사용하도록 고쳤다. 실제 app→정책→nav 연결은 native에서 확인한다.
- 응답 경계는 생성부와 저장부 모두 같은 Main 프로필 정책을 주입했다. 기존 지침 bytes·Work key·Code의 추가 지침 없음은 보존했다.
- 교차 점검에서 HistoryWriter의 기본 false 정책이 새 조립자의 누락을 숨길 수 있음을 발견했다. 정책을 필수 인자로 바꾸고 모든 생성 지점에 명시적으로 전달했다.
- 확대 Main 회귀는 R7에도 존재하던 `setMode/getCurrentMode` 호출을 빠뜨린 오래된 mock을 드러냈다. 자동 후속 턴 테스트는 기존 순수 PermissionModeController를 사용하고, worktree 테스트는 경로 변경 없음과 별개인 권한 정착 알림을 명시적으로 허용한다. 후속 턴 수·모델·지침·worktree 경로 단언은 유지했다.

## 6. 구현 보고

| AC | 결과 |
|---|---|
| AC-R8-1 | 현재 code/work, 명시 구형 읽기, unknown 거부 |
| AC-R8-2 | 기존 DB 업그레이드와 데이터/참조 보존 |
| AC-R8-3 | 양쪽 권한·세션·UI/패널의 완전한 명시 정책 |
| AC-R8-4 | 실행·지침·warm·도구·Work 응답 경계 보존 |
| AC-R8-5 | 역할별 메뉴·본문·패널·상세·nav 연결 |
| AC-R8-6 | 토글·조회·패널 닫기·세션 이동의 기존 상태/상속 보존 |
| AC-R8-7 | 정적 정책 참조, 기존 memo·투영·실행 재사용 보존 |

AC-R8-1~7은 모두 SELF_PASS다(7/7). 속도 개선 수치나 실제 모델/SRT/OpenCode 실행 성공은 주장하지 않는다.

| Gate | 결과·증거 |
|---|---|
| Root 관련 회귀 | [80파일·679개 통과](evidence/r8-root-expanded.json). 최종 권한 카탈로그/읽기 보완은 [7파일·78개](evidence/r8-policy-final.json), nav/WorkActivity fixture는 [3파일·18개](evidence/r8-fixtures-final.json) 통과 |
| Renderer 전체/수정 재검증 | [194파일 최초 결과](evidence/r8-ui-renderer-suite.log)와 [실패 파일 포함 10파일·56개 재검증](evidence/r8-ui-focused.log). 전체 실행과 집중 재실행은 중복 합산하지 않음 |
| Main/SQLite | [경계 9파일·142개](evidence/r8-main-boundaries.json), [자동 후속/워크트리/DB fixture 3파일·38개](evidence/r8-main-fixtures-final.json), [필수 저장 정책·continuity·게시 참조 5파일·32개](evidence/r8-writer-final.json) 통과. [확대 회귀](evidence/r8-main-regression.json)의 다섯 실패는 마지막 fixture 결과에서 모두 재검증했다. 게시 참조·검색·종류는 실제 임시 파일 DB close/open 뒤에도 유지 |
| 타입·lint·build | 최종 [build](evidence/r8-build-final.log)의 node/web/test 타입 검사와 main/preload/renderer production build exit 0. [lint](evidence/r8-lint-final.log) 오류 0, 기존 useTranscriptVirtualizer 경고 1 |
| Windows Chromium | 실제 production 부품·store·CSS와 합성 IPC로 [166/166](evidence/r8-native-ui.json), errors=[], send 0. [소스/CSS 해시 불일치 0](evidence/r8-native-validation.json). 랜딩·권한·패널·본문·nav를 확인 |
| 문서·저장소 | [migration append-only](evidence/r8-migrations.log), [inventory/prose/links](evidence/r8-inventory.log), diff 확인 통과. 상태 사본과 Codex trailer를 커밋 시 대조 |

Main의 겹치는 실행은 [파일별 마지막 전체 실행 대조](evidence/r8-main-validation.json)로 정리했다. Electron ABI를 바꾸지 않고 `app`에서 `ELECTRON_RUN_AS_NODE=1`로 `node_modules/electron/dist/electron.exe node_modules/vitest/vitest.mjs run <대상 파일> --no-file-parallelism --reporter=json`을 실행했다. 일부 fork worker 종료 지연 경고가 있어 exit code만으로 판정하지 않고 JSON의 개별 실패/skip도 확인했다. 테스트 과정의 임시 DB만 사용했다.

화면 재현은 저장소 루트에서 `node docs/handoff/0224-work-agent-layer/fixtures/structural-r8-native.mjs`를 실행한 뒤 출력된 runner와 cache를 Electron에 전달한다. 창은 `show:false`이고 앱 데이터/프로필은 생성된 cache 아래에 격리한다. [Work 패널](evidence/r8-work-panel.png), [Code 패널](evidence/r8-code-panel.png), [랜딩](evidence/r8-new-landing.png), [nav](evidence/r8-nav.png)를 함께 보존했다. GUI 승인 대기로 늦어진 최초 시도는 실행 결과가 없어 성공/실패 표본에 포함하지 않았다.

## 7. 후속 확인 신호

사용자 요구를 구현 가능한 골격에서 명시적인 정책 구성으로 정리한 라운드다. 사용자 지시에 따라 handoff-review는 사용하지 않았다. 교차 코드 점검은 위 결함을 보완했으며 독립 verify를 대체하지 않는다. 기존 핸드오프의 별도 미완료 항목과 실제 모델 인수 상태는 승계한다.
