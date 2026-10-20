# Plan — 세션 모델 복원·기본 승인과 CI 복구

## 메타

| 항목 | 값 |
|---|---|
| 상태 / 라운드 | READY / r1 |
| 작성자 / 일자 | Codex / 2026-10-20 |
| V mode / revision | Baseline V / V1 |
| 기준 | origin/codex-harness-entry-menu `4766e080` 리베이스 완료 |

## Product & UX / Decision

사용자 요구: 원격 최신 rebase, 세션 선택과 앱 재시작에서 마지막 사용 모델 복원, Claude4.6 이상 모델의 기본 자동 승인, 실패 CI 대응이다. 기존0267/0268의 패널·OpenCode 수명 동작은 유지한다. 이번 모델/영속/UI 상태는 별도 handoff로 분리한다.

| ID | 계약 | 상태 |
|---|---|---|
| D1 | 세션별 마지막 실제 사용 provider와 정확한 모델 식별자([1m] 포함)를 사용자 입력 소비 확정 시 저장한다. 다른 세션·제목 생성 모델·전송 실패가 이를 덮지 않는다. 단순 모델 선택은 기존 창 cache에서 유지하며 미전송 선택의 재시작 영속은 추가하지 않는다. | ACTIVE |
| D2 | session load/refresh DTO가 저장 모델을 전달하고 cold load가 Composer를 복원한다. 같은 창의 새 로컬 선택은 archive refresh가 덮지 않는다. 기존 기록의 last_model이 없으면 마지막 telemetry의 기존 primary model을 호환 fallback으로 사용하고, 그 기록도 없으면 기존 provider default를 사용한다. alias는 catalog에서 다시 해석한다. | ACTIVE |
| D3 | 사용자가 승인 모드를 명시 선택하지 않은 Claude 세션은 모델이 확정될 때 공유 supportsAutoPermission 정책에 따라4.6 이상에서 auto_classified를 기본으로 사용한다. 모델 미정/미지원은 기존 Work/Code fallback이다. 사용자가 선택한 수동·계획·bypass는 모델 변경으로 덮지 않는다. OpenCode 기본 정책은 유지한다. | ACTIVE |
| D4 | CI39430032928의21실패/15파일을 재현·수정한다. 최신 UI 계약과 mock/기대값을 맞추고 실제 Windows canonical path 결함은 코드에서 수정한다. socket 생성은 infra에 두고 POP3 guard도 허용된 정확한 infra 경계를 검사한다. 토스트 catch 분류는 새 실제 error 경로와 일치시킨다. | ACTIVE |
| D5 | 새 외부 의존성·전역 모델 선호·프로젝트 공통 모델은 추가하지 않는다. 모델 저장은 세션 메타의 nullable 새 컬럼으로 기존 DB를 append-only migration한다. 기존 메시지/native 원본은 유지한다. | ACTIVE |

## AC / V

| AC | 행동 / production path / oracle |
|---|---|
| AC1 | 서로 다른 Claude/OpenCode 세션에서 다른 모델을 소비한 후 DB 재개방→reader→LOAD_SESSION으로 같은 provider/model을 복원한다. [1m] 및 자동 연속 턴도 정확하다. 실제 파일 DB writer/reader 통합·turn-context tests |
| AC2 | cached A→B→A/refresh가 새 로컬 모델을 덮지 않고 cold load는 저장 모델을 사용한다. 레거시 null은 마지막 telemetry 모델, 그것도 없으면 기존 default를 사용하며 Composer 실제 label/선택이 복원된다. reducer/store/Composer tests |
| AC3 | Claude4.6/5.x의 처음 확정·cold restore는 auto, 미정/4.5/custom은 기존 fallback. 명시 수동/계획/bypass와 OpenCode를 보존한다. reducer permission/실제 Composer·main permission 회귀 |
| AC4 | append-only migration으로 기존 세션/메시지가 유지된다. 사용자 소비 확정의 provider/model은 같은 UPDATE로 기록한다. DB migration·writer/read tests |
| AC5 | 실패 CI의15파일과 영향 회귀가 통과한다. Windows 경로는 canonical 경계로 맞추며 형제/미등록 스킬 차단을 유지한다. mock 누락·popup/새 패널 기대·mention candidate/파일 위치 열기·catch registry·socket boundary의 실제 행동을 확인한다. |
| AC6 | 타입3종·lint·build·migration/inventory/boundary/registry gate를 통과하고 원격 브랜치에 반영한다. 새 HEAD의 Windows CI 결과를 확인하며 조회/환경 제한은 별도 보고한다. |

VP1 R↔AT(AC1/2)·VP2 SD↔ST(저장/재로드/late refresh)·VP3 AR↔IT(턴 소비→DB→IPC→Composer)·VP4 MD↔UT(기본 승인과 명시 선택)·VP5 R↔AT(CI 회복)는 NEW REQUIRED다.0267/0268 변경 경로는 REGRESSION, 비영향 native 실행 수명/패널 구조는 기존 증거를 승계한다.

## 기술 설계

AS-IS: session load는 provider만 복원하고 modelFamily=null이다. initial mode가 null model에서 fallback된 뒤 SET_MODEL이 그 fallback을 유지한다. writer의 provider 저장 두 지점에는 모델이 없다.
TO-BE: sessions.last_model과 LoadedSession.modelFamily 추가. resolved model→TurnContext→continuation→HistoryWriter 소비/초기 확정→DB 동일 UPDATE→reader→cold LOAD_SESSION. cached refresh는 기존 local selection을 유지한다. reducer permissionModeExplicit가 사용자 선택과 기본 preference를 구분한다. 실제 모델이 확정되면 default preference를 다시 coerce한다. Composer는 복원한 모델의 alias만 catalog로 hydrate한다.

## §10 강제 지점

EP1 고정8자리: ①migration/query의 provider+model UPDATE ②resolve→buildTurnContext와 continuation의 실제 model ③writer user commit·새 session 확정 ④reader→session load/refresh DTO ⑤cold/cached LOAD_SESSION→Composer catalog hydration·label ⑥default/explicit permission·backend/model 경계 ⑦CI15파일의 mock/expectation·Windows canonical 경계·socket infra·catch registry ⑧운영 gate·최종 원격 CI.
검색: `rg -n 'modelFamily|providerKey|updateSessionProviderKey|DEFAULT_PERMISSION_MODE|SET_PERMISSION_MODE|LOAD_SESSION' app/src/{main/app/chat-turn,main/features/history,main/infra/db,renderer/src/features/chat,shared} -g '!*.test.*'`.
직접 oracle은 AC표의 DB 재개방·실제 reducer/Composer·turn-context·실패15파일·원격 workflow다. mock한 IPC 구간은 실제 DB/reader 통합과 분리한다. 적대 증거 not selected — 실제 저장/표시/거부/실행 결과를 직접 관측한다. 기존 registry/native-boundary의 음성 대조는 유지하고 새 infra 경계의 허용/차단도 직접 검증한다.

## 게이트와 READY 검토

직접 Vitest로 관련 및 전체 suite를 실행한다. SQLite ABI140은 Electron Node 모드로 확인하거나 DB suite만 분리하며 ABI를 뒤집지 않는다. node/web/test 타입·eslint·electron-vite build·migration append-only/doc inventory/test-budget/harness boundary/catalog를 확인한다. Windows CI는 GitHub connector로 조회한다(gh API는403). 최신 CI는 Test 단계21실패/15파일이며 lint/typecheck는 통과했다.
ACTIVE D1/2→AC1/2, D3→AC3, D4→AC5, D5→AC4, 운영→AC6. 충돌0. 새 nullable DB필드·IPC additive field의 구버전 fallback과 명시 승인 선택 보존을 확인하도록 경로를 고정했다. READY.

구현 중 확인한 기존 운영 guard의 분모를 명시한다. Composer alias 복원으로 setModel 호출이3→4곳이므로 기존 composerWiring 순서 guard도4곳을 검사한다. VP3의 해당 소비 edge에 선택 적대 M1을 등록한다: 새 alias hydration 호출의 modelFamily와 model.alias를 맞바꾸어 실제 Composer.selection과 source-slot guard가 red인지 확인한 뒤 원복한다. 선택 이유는 이번에 변경한 구조적 호출 전수 oracle의 민감도다. POP3 guard의 새 port allocator 허용은 net 허용/TLS 거부 fixture로 직접 음성 대조한다.
