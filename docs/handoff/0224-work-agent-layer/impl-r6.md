# [구현자 기입] 구현 보고 r6 — Git 캐시와 모델 권한 판정

작성: **Codex**, 2026-09-09. [ΔV6](panel-plan-r6.md) 기준 **impl/IMPL_DONE**, 자기확인 **4/4**다. 독립 verify는 pending이다.

## 1. 설계 대조

BranchChip을 모드 전환 중에도 유지하고 Coding에서만 조회를 시작한다. 같은 cwd의 snapshot과 요청 identity로 Work 전환 중 응답을 보관하며 Coding 복귀 때 즉시 사용한다. 초기 확인 중에는 disabled `-`를 표시한다. 새 캐시 서비스·의존성·IPC·DB 변경은 없다.

세 구분 문자는 같은 폰트 class를 사용하고 완료 SVG에만 stroke를 더한다. 모델 카탈로그의 isCustom을 메뉴까지 전달하며 미확정 선택은 자동 승인을 허용하지 않는다. 공유 계열 목록에 haiku·sonnet·opus·fable을 두고 Main discovery와 권한 판정이 사용한다. 버전 구분자는 점·하이픈을 모두 허용한다. 기존 기본 alias와 환경변수 키는 유지한다.

## 2. 강제 지점 전수와 V-pair 자기확인

| EP | 확인 | 직접 관측 |
|---|---|---|
| EP1 | 2/2 | 실제 SessionRow의 비열람 stroke 40px·파랑, 열람 후 stroke none·기본 상태 |
| EP2 | 3/3 | 공용 Toggle와 두 랜딩에서 문자 `</>`·font family/size/weight 일치 |
| EP3 | 5/5 | 항상 mount/hidden, 첫 Work 조회 0, pending 응답/캐시/경합, 초기 dash와 실패/nonrepo/detached, 기존 checkout/유예 테스트 |
| EP4 | 5/5 | Main 계열 분류·선택 shape·custom/미확정 제외·공용 버전 경계·두 랜딩의 Work/Coding 실제 메뉴 |
| EP5 | 4/4 | ΔV6/root 상태, INDEX/r5 대체 링크, 본 보고/증거, 현재 rendering 문서와 구현 trailer |

`AgentModeToggle|BranchChip|CwdPanel|WorktreeToggle`, `SessionRow`, `selectedModelShape|modeMenuOptions|supportsAutoPermission|classifyModel`의 선언과 실제 소비처를 대조했다. EP 합계는 2+3+5+5+4=19/19다.

| Pair | 직접 oracle | 자기 상태 |
|---|---|---|
| VP-R6-01 | native SVG computed style·열람 복원·문자 폰트 | SELF_PASS |
| VP-R6-02 | 실제 두 랜딩의 모드/cwd/권한 메뉴 클릭 | SELF_PASS |
| VP-R6-03 | 지연 Git 응답·Work 캐시 보존·Coding 복귀·cwd 응답 역전 | SELF_PASS |
| VP-R6-04 | 카탈로그→선택 shape→후보→ModeMenu, Main parser→실제 Composer | SELF_PASS |
| VP-R6-05 | 네 계열의 버전 경계·custom/불명·loading/nonrepo/detached | SELF_PASS |
| VP-R6-06 | Renderer 회귀와 기존 nav 완료/확인 경로, 입력 동일 DOM 유지 | SELF_PASS |

## 3. 이번 라운드 수정의 잠금

[수정 전 RED](evidence/r6-red.json)는 44개 중 7개 실패였고 [모델 확장 RED](evidence/r6-model-red.json)는 88개 중 13개 실패였다. 실제 컴포넌트 출력과 공용 판정 함수를 사용해 사용자 지적을 재현했다. 최종 같은 경로의 검사와 실제 Chromium 메뉴 조작이 통과했다.

별도 mutation은 계획에서 선택하지 않았다. 직접 DOM/style/event/반환값 oracle을 사용했다. 선택 증거 0·인용 변이 0·새 구조적 proxy oracle 0으로 별도 변이 표는 해당 없음이다. 파일 해시는 native가 사용한 소스 동일성 기록이며 행동 검사를 대체하지 않는다.

## 4. Product/UX 파생 검토

캐시는 mounted BranchChip의 현재 cwd snapshot 하나다. Work 전환은 만료나 초기화를 일으키지 않고 unmount는 진행 요청을 무효화한다. 다른 cwd의 결과는 현재 폴더에 표시하지 않으며 새 요청보다 늦은 이전 응답은 identity 비교로 차단한다. checkout 성공 후 명시 refresh는 유지한다.

Work에서는 새 조회와 그룹 표시만 멈추므로 add-dir가 빈자리 없이 당겨진다. 조회 실패와 확인된 nonrepo는 그룹을 숨긴다. 모델명만으로 카탈로그 밖 선택을 지원 모델로 추정하지 않는다. 확인된 비커스텀 모델만 버전 기준을 통과할 수 있다.

## 5. 발견한 문제와 대응

- 사용자 정정에 따라 Work 최초 조회와 Coding에서 시작한 요청의 Work 유지 조건을 분리했다. 이전 조건부 mount는 응답과 캐시를 잃는 원인이었다.
- Main discovery가 Fable을 custom으로 분류해 공용 정규식만 확장해도 메뉴에 도달하지 못했다. 같은 계열 상수를 공유하도록 수정했다. 새 기본 alias/env 키는 만들지 않았다.
- [초기 native 실패](evidence/r6-native-initial.json)는 실제 새 랜딩의 cwd가 null인 fixture에서 `-`를 요구한 검사 준비 오류였다. 폴더를 지정한 뒤 같은 production 경로를 재검사해 통과했다.
- 첫 lint의 임시 포맷 경고는 정리했다. 최종 lint는 기존 useTranscriptVirtualizer 경고 1개만 남았다.
- Q-R5-01의 Work 전송 시 worktree 적용 정책은 미결 상태로 유지했다. 이번 표시/조회 개선에서 전송 정책을 바꾸지 않았다.

## 6. 구현 보고

| AC | 상태 | 관측 |
|---|---|---|
| AC-R6-1 | ✅ | 실제 비열람 SVG 굵기·파란색 및 열기 후 복원 |
| AC-R6-2 | ✅ | 두 랜딩의 세 문자 font 일치, Hero 400, 토글/입력 유지 |
| AC-R6-3 | ✅ | Work 첫 조회 0, Coding 초기 dash, 숨긴 동안 응답 보관, 즉시 캐시/중복 조회 없음, cwd 역전·실패 대조 |
| AC-R6-4 | ✅ | 네 계열의 4.5/4-5 제외·4.6/4-6 허용, custom/미확정 제외, 두 모드 메뉴 |

검산: ✅ 4 + ⚠️ 0 + ❌ 0 = 4. Criteria-Met은 ΔV6의 4/4 자기확인이다.

| Gate | 관측한 산출 |
|---|---|
| Vitest | Renderer/권한 193파일·1,433개, 최종 모델/Composer 37파일·329개 모두 통과. 중복 이름 제외 합집합 195파일·1,520개, 실패 0. |
| 타입 | node/web/test 구성 모두 exit 0. |
| 린트 | 전체 src/scripts exit 0, 오류 0·기존 경고 1. |
| 프로덕션 빌드 | electron-vite main/preload/renderer build exit 0. 이후 production 변경은 BranchChip 한국어 주석 정정뿐이다. |
| Windows Chromium | success=true, 오류 0, named 검사 132/132, 화면 4개, 소스/CSS 해시 불일치 0. |
| 문서/저장소 | inventory/prose/links와 diff 검사, 상태 사본 대조. 커밋 후 trailer 파싱 확인. |

[테스트 집계](evidence/r6-test-summary.json), [전체 Renderer/권한](evidence/r6-tests.json), [최종 모델/Composer](evidence/r6-final-model-tests.json), [타입](evidence/r6-typecheck.log), [lint](evidence/r6-lint.log), [build](evidence/r6-build.log)를 보존했다.

[native 원본](evidence/r6-native-ui.json)과 [검산/해시](evidence/r6-native-validation.json), [랜딩](evidence/r6-new-landing.png), [프로젝트 랜딩](evidence/r6-project-landing.png), [미확인 아이콘](evidence/r6-nav-unread.png), [확인 후 아이콘](evidence/r6-nav-read.png)을 보존했다. 기존 r5 호스트를 재사용한 재현 fixture도 함께 둔다.

## 7. 후속 확인 신호

사용자 피드백 라운드 6이며 handoff-review는 사용하지 않았다. 이전 UI 표시 요구의 실제 소비 경로를 보완했다. 계열/구분자 추가 요구는 ΔV6 설계에 먼저 반영했다. 다음 주체는 독립 검증자이며 자기확인으로 verify를 대체하지 않는다. 외부 모델 호출이나 사용자 DB는 실행하지 않았고 native에서는 합성 IPC 응답과 실제 Renderer 및 순수 Main parser를 사용했다.
