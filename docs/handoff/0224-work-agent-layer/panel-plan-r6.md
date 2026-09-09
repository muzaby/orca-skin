# Plan r6 — 랜딩 Git 캐시와 권한 메뉴 보완

작성: **Codex**, 2026-09-09. 상태: **impl/IMPL_DONE**, Codex 자기확인 **4/4**. [구현 보고 r6](impl-r6.md), 독립 verify pending. 기준은 원격 `39a37c20`의 V1~ΔV5이며 이번 사용자 피드백을 **ΔV6**로 적용한다. 사용자 지시에 따라 handoff-review는 사용하지 않는다.

## Part I — Product & UX Contract

### 1. 결정과 출처

| ID | ACTIVE 결정 | 대체/보존 |
|---|---|---|
| D-041 | 비열람 완료의 nav SVG는 기존 파란색과 함께 굵게 표시한다. 열람 후 원래 굵기·색으로 복원한다. | D-037 보완, 완료/확인 수명 유지 |
| D-042 | 랜딩의 `<`, `/`, `>`는 같은 폰트·크기·굵기로 표시한다. Hero normal과 아이콘 크기·배치는 유지한다. | D-033 보완, SVG 꺾쇠를 문자로 대체 |
| D-043 | Git 조회는 Coding에서 시작한다. Work로 전환해도 진행 중인 응답과 결과를 유지하고 같은 cwd의 Coding 복귀는 캐시를 즉시 표시한다. | 최종 사용자 정정. D-034의 unmount/조회 취소 대체 |
| D-044 | Coding의 cwd가 있으면 초기 브랜치 확인 중 `-`를 즉시 표시한다. 확인된 non-Git/실패는 그룹을 숨기고, Git이면 실제 브랜치 또는 detached 라벨을 표시한다. | 지연 mount 대체. Work는 그룹이 없어 add-dir가 빈자리 없이 당겨짐 |
| D-046 | 모델 계열은 haiku·sonnet·opus·fable을 인식하며 버전 구분자는 점과 하이픈을 모두 허용한다. 모델 discovery 분류와 자동 승인 판정에 같은 계열 목록을 사용한다. | 최신 사용자 보완. 4.6/4-6 동일 의미, 기본 alias/env 추가는 아님 |
| D-045 | 두 모드의 자동 승인 메뉴는 확인된 비커스텀 Claude 4.6 이상에만 표시한다. 4.5 이하·custom·모델 미확정은 메뉴에서 제외한다. | r4 정책을 실제 선택 카탈로그/메뉴 경로에서 보완 |

사용자는 “Git 조회는 코딩 트리거시 동작”, “그 순간 work 트리거시에도 결과는 갖고있어야 함”, “캐싱되어 coding으로 다시 트리거시 바로 출력”으로 최초 질의를 정정했다. 따라서 Work 최초 진입은 조회하지 않지만 Coding에서 시작한 조회를 Work 전환으로 취소하지 않는다. cwd 변경 시 다른 폴더의 브랜치를 표시하지 않으며 명시 checkout 이후에는 갱신한다.

Q-R5-01의 Work 전송 시 worktree 적용 정책은 이번에도 변경하지 않는다. 변경은 표시·조회 수명과 권한 메뉴 후보이며 Main의 기존 모델 discovery 분류와 공용 버전 판정은 최신 요청에 맞춰 확장한다. 새 provider·env key·IPC·DB·의존성은 추가하지 않는다.

### 2. 인수 기준

| AC | 관측 결과 | 실제 경로/검사 |
|---|---|---|
| AC-R6-1 | 미확인 완료 SVG가 파랗고 굵으며 열면 둘 다 복원 | SessionRow→Icon, 실제 SVG computed style·기존 완료 store 회귀 |
| AC-R6-2 | 세 문자의 font family/size/weight 일치, 기존 토글·Hero 정상 | 공용 AgentModeToggle→두 랜딩, DOM/style/click |
| AC-R6-3 | 첫 Work 조회 0, Coding 초기 `-`, Work 전환 중 응답 보존, Coding 복귀 즉시 캐시/중복 조회 0 | CwdPanel→BranchChip→지연 gitApi.status, cwd 교체/실패/nonrepo/detached 대조 |
| AC-R6-4 | Haiku/Sonnet/Opus/Fable의 점·하이픈 버전 경계·custom·미확정의 메뉴 제외, 4.6 이상 양성, Work/Coding 동일 적용 | selectedModelShape→modeMenuOptions→실제 ModeMenu, 실제 Composer 경로/native |

## Part II — Technical Design

### 3. 조사와 최소 구현

| 대상/검색 | 전수/원인 | 변경 |
|---|---|---|
| `BranchChip` production 소비처 | CwdPanel 한 곳. mode 조건부 mount가 snapshot과 진행 중 effect를 버림 | 항상 mount하고 hidden 입력으로 표시/조회 시작만 제어. 한 cwd snapshot과 요청 identity를 유지하고 stale 결과는 차단 |
| `AgentModeToggle` | 두 랜딩의 공용 구현. 꺾쇠는 SVG, 슬래시는 문자 | 세 문자를 같은 class로 렌더 |
| `SessionRow` | 공용 목록 행. 완료 상태에 색만 적용 | 완료 상태의 SVG에만 currentColor stroke를 더해 굵기 강화, 원래 Material path 보존 |
| `modeMenuOptions` | Composer 한 소비처. 버전 판별은 이미 shared에 있으나 selectedModelShape가 isCustom을 버림 | 카탈로그의 isCustom을 후보 판정에 전달. 선택 원천 미확인은 자동 후보에서 제외 |

숨긴 BranchChip은 UI와 overlay를 반환하지 않지만 조회 결과를 받는다. 새 캐시 서비스·범용 lifecycle 모듈을 만들지 않으며 같은 mounted 인스턴스 내 snapshot만 사용한다. 초기 placeholder는 disabled이고 확인 후 기존 브랜치 선택·워크트리 유예 동작을 재사용한다.

### 4. ΔV6 pair

| Pair | 같은 레벨 노드↔검사 | 속성 | 직접 oracle / EP |
|---|---|---|---|
| VP-R6-01 | R-R6-01↔AT-R6-01 (AC1/2) | CHANGED/REQUIRED | native SVG/font style·확인 복원, EP1/2 |
| VP-R6-02 | R-R6-02↔AT-R6-02 (AC3/4) | CHANGED/REQUIRED | 지연 IPC와 실제 mode/cwd/menu 조작, EP3/4 |
| VP-R6-03 | SD-R6-01↔ST-R6-01 | CHANGED/REQUIRED | Coding→Work pending→Coding cache·cwd race, EP3 |
| VP-R6-04 | AR-R6-01↔IT-R6-01 | CHANGED/REQUIRED | 실제 선택 shape→후보→메뉴, 공용 컴포넌트 양 소비, EP2/4 |
| VP-R6-05 | MD-R6-01↔UT-R6-01 | CHANGED/REQUIRED | 버전/custom 경계·loading/nonrepo/detached, EP3/4 |
| VP-R6-06 | ΔV5 VP-R5-01/03/05/08/10 | INHERITED/REGRESSION | 입력/종류 잠금·완료 확인·권한/checkout·패널 회귀 |

검사는 실제 DOM·computed style·지연 응답을 사용한다. 별도 mutation은 선택하지 않으며 수정 전 RED와 수정 후 직접 행동 대조를 보존한다. 비영향 Work 높이/전체 상세 결정은 ΔV5를 유지한다.

### 10. 강제 지점과 운영 gate

| EP | N / 실제 지점 | 실패 의미 |
|---|---|---|
| EP1 | 2 — SessionRow 완료 SVG·열람 복원 | 색만 변경/모든 아이콘 굵기 변경 |
| EP2 | 3 — 공용 Toggle·새 랜딩·프로젝트 랜딩 | 문자 폰트 불일치/한 페이지 누락 |
| EP3 | 5 — CwdPanel mount/hidden·조회 시작/캐시·pending 응답/수명·초기 placeholder/비Git·checkout/유예 | Work 선조회/응답 유실·중복/잘못된 cwd·기존 선택 회귀 |
| EP4 | 5 — Main discovery 계열 분류·선택 카탈로그 shape·custom/불명 후보·공유 버전 판별·두 모드 실제 메뉴 | canonical 이름 custom 허용·옛 버전 노출·지원 모델도 숨김 |
| EP5 | 4 — r6 계획/root·INDEX/r5 대체 링크·보고/증거·현재 rendering 문서/trailer | 상태/결정 불일치 |

영향 Vitest와 기존 renderer 회귀, node/web/test 타입, 전체 lint, production build, 실제 Windows Chromium의 대상 동작 인수, inventory/prose/links·diff·trailer 파싱을 수행한다. Electron SQLite ABI와 사용자 데이터는 유지한다.

### 11. READY 대조

D-041→AC1, D-042→AC2, D-043/044→AC3, D-045/046→AC4를 대조해 충돌 0이다. 마지막 Git 정정이 조회 수명과 캐시 oracle에 반영됐고 r5의 Work 조회 0은 최초 진입에만 남는다. 원격 r5의 완료 표시는 색만, 꺾쇠는 SVG, BranchChip은 조건부 mount, 모델 shape는 isCustom 누락임을 코드에서 확인했다.
