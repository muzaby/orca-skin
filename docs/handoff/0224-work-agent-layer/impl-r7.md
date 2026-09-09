# [구현자 기입] 구현 보고 r7 — 모델명 접두사와 Work 표시

작성: **Codex**, 2026-09-09. [ΔV7](panel-plan-r7.md) 기준 **impl/IMPL_DONE**, 자기확인 **3/3**. 독립 verify는 pending이다.

## 1. 설계 대조

최종 사용자 정정인 `claudecode-sonnet-5`, `claudecode-opus-4.8`, `claudecode-opus-4.8[1m]`을 기준으로 공용 정규식에 선택적 `code` 접두사만 추가했다. 네 계열·버전 경계·1M 처리와 Main 분류는 기존 코드를 유지한다. 계열 없는 모델을 위한 별도 파서·alias는 최종 변경에 없다.

Work 버튼 라벨은 Work 메뉴 카탈로그에서 직접 가져온다. 출력 list의 gap과 행 세로 padding을 각각 4px로 줄였으며 트랜스크립트 variant는 유지했다. 의존성·IPC·DB·새 모듈 추가는 없다.

## 2. 강제 지점 전수와 V-pair 자기확인

| EP | 확인 | 직접 관측 |
|---|---|---|
| EP1 | 4/4 | 공용 판정, settings/runtime 분류→선택→메뉴, 실제 실행 coercion, 모델명/1M identity 보존 테스트 |
| EP2 | 2/2 | 실제 Work 자동/수동 선택 후 메뉴와 버튼 라벨 일치, Coding 수동 라벨 유지 |
| EP3 | 2/2 | 실제 출력 행 padding 4px·행간 4px·행 높이 36px, 카드/상태/개별 동작 회귀 |
| EP4 | 4/4 | r7/root, r6 대체 링크/INDEX, 본 보고/증거, rendering 문서와 커밋 trailer |

`supportsAutoPermission|classifyModel|selectedModelShape|modeMenuOptions|permissionModeLabelKey`와 `variant="list"` 소비를 대조했다. 공용 라벨 함수는 Composer, list variant는 TaskOutputContent에서 소비한다. EP 합계는 4+2+2+4=12/12다.

| Pair | 관측 | 자기 상태 |
|---|---|---|
| VP-R7-01 | 실제 두 모드 메뉴·선택·Work 라벨·출력 bounds/style | SELF_PASS |
| VP-R7-02 | settings/runtime 모델 목록→선택 shape→메뉴, 1M identity | SELF_PASS |
| VP-R7-03 | 이름/버전 경계·coercion·메뉴와 버튼 라벨 | SELF_PASS |
| VP-R7-04 | 기존 권한/모델 선택·출력 카드·수명 테스트 | SELF_PASS |

## 3. 이번 라운드 수정의 잠금

[초기 RED](evidence/r7-red.json)는 정정 전 예시로 79개 중 17개 실패였다. [중간 검사](evidence/r7-tests.json)는 당시 예시의 구현 결과이며 최종 수치에 합산하지 않는다. 사용자 최종 정정에 맞춘 [최종 검사](evidence/r7-final-tests.json)가 완료 근거다.

반환값·메뉴 클릭·DOM/style을 직접 관측한다. 선택 mutation 0·인용 변이 0·새 구조적 proxy 0으로 별도 변이 표는 해당 없음이다. 기존 부정 경계와 custom/미확정 제외 검사를 유지했다.

## 4. Product/UX 파생 검토

정규화된 별도 모델 ID를 만들지 않아 SDK 전달값과 선택 identity가 갈라지지 않는다. Work 라벨은 같은 카탈로그에서 파생하므로 메뉴 문구와 버튼 문구가 따로 변하지 않는다. Coding 라벨과 bypass 확인 흐름은 보존했다.

출력 목록의 파일 상태·저장/삭제·메뉴 수명은 그대로다. 좁아진 행에도 제목·아이콘·개별 파일 메뉴가 있고 missing/error 상태는 기존 추가 줄로 표시한다. Git 조회/캐시와 Work 영역별 상한은 변경하지 않았다.

## 5. 발견한 문제와 대응

- 사용자 모델명 정정이 두 번 있었고 최종 예시로 계획을 다시 확정했다. 중간의 계열 생략 처리는 제거했으며 Main production diff는 없다.
- 첫 native의 모델/라벨·출력 간격은 통과했지만 파일 메뉴 검사에서 기존 MenuItem에 없는 `role=menuitem`을 찾았다. [초기 결과](evidence/r7-native-initial.json)를 보존하고 실제 `role=menu`의 휴지통 항목으로 확인했다. 숨김 창의 렌더링 지연은 fixture의 backgroundThrottling 해제와 진입 전환 대기로 분리했다.
- Q-R5-01은 이전대로 미결이다. 이번 요청과 별개의 Work 전송 정책은 바꾸지 않았다.

## 6. 구현 보고

| AC | 상태 | 관측 |
|---|---|---|
| AC-R7-1 | ✅ | 정정된 세 모델 모두 Work/Coding 실제 메뉴 노출, 단위/통합 경로에서 auto coercion 유지·custom 제외·원문 보존 |
| AC-R7-2 | ✅ | Work 수동 승인·자동 승인 선택 후 버튼 일치, Coding 기존 라벨 |
| AC-R7-3 | ✅ | 출력 3행의 높이 36px, padding 4px, gap 4px, 개별 메뉴 열기 |

검산: ✅ 3 + ⚠️ 0 + ❌ 0 = 3. Criteria-Met은 ΔV7의 3/3 자기확인이다.

| Gate | 결과 |
|---|---|
| 영향 Vitest | 40파일·362개 통과, 실패/skip 0. Composer·모델/권한·Main parser·출력 카드 수명을 포함한다. |
| 타입 | node/web/test 모두 exit 0. |
| 린트 | 전체 src/scripts 오류 0, 기존 useTranscriptVirtualizer 경고 1. |
| 빌드 | 최종 소스의 electron-vite main/preload/renderer build exit 0. |
| Windows Chromium | 실제 소스와 합성 IPC로 29/29, errors=[], 소스/CSS 해시 불일치 0. |
| 문서/저장소 | inventory/prose/links와 diff 확인, 상태 사본 대조, 커밋 후 trailer 파싱. |

[타입](evidence/r7-typecheck.log), [lint](evidence/r7-lint.log), [build](evidence/r7-build.log), [native 결과](evidence/r7-native-ui.json), [소스 검산](evidence/r7-native-validation.json), [Work 권한 화면](evidence/r7-work-permission.png), [출력 화면](evidence/r7-work-output.png)을 보존했다. 재현은 기존 native 준비 도구에 `r7` 인자를 주며 r6 기본 동작은 유지한다.

## 7. 후속 확인 신호

사용자 피드백 라운드 7이며 handoff-review는 사용하지 않았다. 자동 승인 지원 판정의 접두사 누락과 Work 라벨 소비 경로를 보완했다. 독립 verify는 별도이며 외부 모델 실제 실행이나 사용자 데이터 변경을 이번 증거로 주장하지 않는다.
