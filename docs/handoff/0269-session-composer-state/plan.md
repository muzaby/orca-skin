# Plan — 세션 모델 복원·기본 승인과 CI 복구

## 메타

| 항목 | 값 |
|---|---|
| 상태 / 라운드 | IMPL_DONE / r1 (AC6/6·원격 Windows CI 통과) |
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

## [구현자 기입] 설계 리뷰

D1~5와 합치한다. 실행에서 해석한 모델을 턴/자동 연속 턴으로 운반하고 사용자 입력 소비 때 provider와 함께 기록한다. 세션 초기 확정의 선기록은 신규에 한정하여 재개만으로 이전 사용 모델을 덮지 않는다. 기존 기록의 호환 fallback은 현재 telemetry의 primary model이며 새 기록이 우선한다. 미전송 선택은 창 cache 수명이다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP1·3 | migration·동일 UPDATE | EP1① | 1/1 | last-model.test: restores each session… / upgrades an existing database…; migrate.test | A/B provider+model 구별, 구DB message/title 보존·last_model null | 없음 |
| VP1·3 | 실제 턴 모델 | EP1② | 1/1 | turn-context.test: carries the actual resolved model… | title-only와 claude-sonnet-4-6[1m] 구별, continuation 동일 | 없음 |
| VP1·2·3 | writer 소비·초기 확정 | EP1③ | 1/1 | last-model.test; 기존 writer·received/native-history 회귀 | 미소비 재개는 이전 provider/model 보존. 후속 소비만 A의 provider/model 변경 | 없음 |
| VP1·3 | reader→load/refresh | EP1④ | 1/1 | last-model.test 실제 파일DB 재개방; session.load.test 실제 handler | 새 모델·legacy null·telemetry model-a를 DTO에서 구별. live activity 보존 | 없음 |
| VP1·2·3 | cold/cached→Composer | EP1⑤ | 1/1 | chatReducer.model.test cold/refresh; Composer.selection.test loaded model…; Chromium | provider 기본 Opus와 저장 Sonnet[1m] 구별. A→B→A·fresh store label/alias 복원 | 없음 |
| VP4 | 기본/명시 승인 | EP1⑥ | 1/1 | reducer model/permission·main permission 회귀; Chromium |4.6/5.5 auto, 미지원 fallback·수동/계획/bypass 보존. OpenCode 별도 기본 | 없음 |
| VP5 | CI15파일 회복 | EP1⑦ | 1/1 | ci-affected15파일346/346; 전체 suite; skill-sources alias root·native-boundary 음성 대조; Windows CI39446331194 | UI mock/현재 패널 계약·connected provider·파일 reveal·catch·Windows canonical 비교. tls는 port helper에서 거부. Windows 전체7671 통과 | 없음 |
| 운영 | 로컬 gate·원격 CI | EP1⑧ | 1/1 | 로컬 전체7664+Node Git2·scripts142, 타입/lint/build·doc/migration/budget/catalog; Windows CI39446331194 job118709112075 success | Windows786파일7671 통과·2파일2케이스 skip, scripts142/142. migration/doc/budget/lint/typecheck success | 없음 |

자리 검색240행을 EP1의 고정8자리와 대조했다. 기존 다른 model 표시/IPC payload는 원래 경로이며 새로운 세션 메타 운반은①~⑥에 속한다. 검색 행 수를 분모로 쓰지 않았다. 직접 oracle8/8이며 원격 운영 자리는 코드 push 후 Windows CI success로 확인했다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP1 | REQUIRED | SELF_PASS | 실제 writer/reader 재개방·Composer·Chromium | 직접 결과 |
| VP2 | REQUIRED | SELF_PASS | 미소비 입력·cached refresh·fresh store tests | 직접 결과 |
| VP3 | REQUIRED | SELF_PASS | turn-context·파일 DB·실제 handler·Composer 배선 | M1 red2, 원본 bytes 복원 후7/7 |
| VP4 | REQUIRED | SELF_PASS | model/permission reducer·main 회귀·Chromium | 직접 결과 |
| VP5 | REQUIRED | SELF_PASS | 원래 CI 실패15파일·전체 suite·guard 음성 대조 | 신규 port 경계 net허용/tls탐지 |
| 원격 운영 확인 | REQUIRED | SELF_PASS | [Windows CI39446331194](https://github.com/muzaby/orca-skin/actions/runs/39446331194) 전체 success | Vitest7671/7671·scripts142/142, skip2 별도 |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 새 alias hydration 호출의 modelFamily↔model.alias 맞바꿈 | M1 선택·VP3 | 신규 | Composer.selection·composerWiring 각각1, 총2failed/7 | 원본 bytes 복원 후7/7 |
| port allocator의 net import→tls | 수정한 native boundary oracle | 신규 fixture | native-boundary.test의 exact path 음성 대조 | net의 offenders[], tls의 offenders[infra/net/loopback-port.ts] |

분모 검산: 선택 증거1 · 인용 변이0 · 새 구조 proxy oracle1 =2행. 다른 변경은 직접 oracle이며 변이를 추가하지 않았다. 기존 registry의 catch 전수·음성 대조와 Composer slot 전수 guard를 유지했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태에 소비자가 있는가 | 새 UI 라벨 없음, 기존 모델 버튼/승인 메뉴에 복원값 반영 | 실제 Sonnet[1m]·Opus·자동/수동 표시 |
| 재배치 시 scope 유지 | 모델은 세션, native plugin 공유는 프로젝트로 유지 | 다른 세션의 모델 저장/표시를 합치지 않음 |
| 새 실패 경로와 Part I | 구DB null·누락 catalog은 기존 fallback | nullable additive field. 사용 모델은 실제 입력 소비 경계 |
| 늦은 응답/부분 성공 | cached LOAD_SESSION의 로컬 모델 보존 | DB의 provider/model은 같은 UPDATE. 메시지 전체 transaction 확장은 없음 |
| 기본값이 명시 선택을 덮는가 | permissionModeExplicit로 구분 | 실제 수동 선택 뒤 모델 변경에서도 수동 유지 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
|1| 초기 null model에서 기본 선호가 fallback으로 소실 | 기본 선호를 모델 확정 때 다시 coerce |4.6/5.5·cold load·실제 GUI auto |
|2| 제목/재개 시도가 마지막 모델을 오염 | 실행 모델을 별도 field로 운반, 신규 초기 확정/소비만 기록 | title-only·not-consumed fixture 구별 |
|3| Windows의8.3 temp와 realpath 긴 경로가 다름 | agents 제외 root와 OpenCode skill roots도 canonicalize, realpath 반환값은 canonical fixture와 비교 | Windows CI 실패4건의 실제 차이·alias root 테스트 |
|4| 원래 full CI의 guard/mock가 새 UI와 불일치 | 최신 production export/패널/연결상태/reveal/catch 기대를 복구 |15파일346/346 |
|5| SQLite ABI140은 호스트 Node137에서 로드 불가 | Electron Node 모드로 전체 실행 | DB reopen/upgrade 실제 성공. ABI 전환 없음 |
|6| 복사한 Electron 실행 파일은 libffmpeg를 찾지 못함 | Git 안전성2케이스는 일반 Node로 분리 | 해당 파일2/2. 최종 나머지 전체7664 통과 |
|7| 새 DTO/마이그레이션/Composer 호출 수의 정적 기대 누락 | 실제 additive field·33번 migration·4 callsites로 갱신 | 최종 관련 검사·M1 민감도 확인 |

설계 대비 다른 메커니즘으로 대체한 것 없음. 만료=새 TTL 없음, 공유=세션별 DB값, 재진입=cached 선택 보존, 다른 무효화=catalog/삭제/late load는 기존 규칙이다. AC1~6·①~⑧을 각각 재확인했다. 메시지 저장과 메타 저장 사이 비정상 종료 시 이전 선호가 남을 수 있으며 기존 history 쓰기 순서를 새 transaction으로 바꾸지 않았다.

## [구현자 기입] 구현 보고

| 항목 | 관측 |
|---|---|
| 변경 | last_model migration/query·turn/writer/reader/DTO·Composer/reducer·CI15파일/Windows 경계·socket infra·현재 문서 |
| 실행 | evidence/validation.md의 전체·집중 Vitest, 타입/lint/build·scripts·문서·Chromium |
| 게이트 산출 | 로컬785파일7664 통과/2파일7케이스 skip, 별도 Node Git1파일2/2. scripts142/142. CI 영향15파일346/346. 타입3종 진단0·lint 오류0/기존경고4·build 성공. Windows786파일7671 통과/2파일2케이스 skip·scripts142/142 |
| V 자기확인 | 제품5pair SELF_PASS, 원격 운영1 SELF_PASS |
| 강제 지점 |8/8, 원격 Windows CI success 포함 |
| AC 자기보고 |6/6. 코드 push 후 Windows CI39446331194 success로 AC6까지 확인 |
| 합계 검산 |✅6 ·⚠️0 ·❌0 =총6 |
| 블로커/역질문 | 없음. 독립 handoff verify는 다음 주체 |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 이번 관측 |
|---|---|
| AC1 |✅ 실제 파일 DB close/reopen에서 A/B 모델·provider 복원, [1m]·continuation·미소비/제목 모델 분리 |
| AC2 |✅ 실제 Composer session load/label/alias·cached 새 선택·fresh store, legacy telemetry fallback·null |
| AC3 |✅4.6/5.5 auto·미지원/미정fallback·명시 수동/계획/bypass·OpenCode 보존 |
| AC4 |✅ 기존 DB migration 후 메시지/제목 보존·last_model nullable. provider/model 한 UPDATE |
| AC5 |✅ 원래 CI 실패15파일346/346, 최종 전체+별도 Git 통과 |
| AC6 |✅ 로컬 gate 통과·원격 push 완료·Windows CI39446331194 job118709112075 success |

## [구현자 기입] Review Signals

- 같은 축인가: UI model 복원의 누락을 영속 사용 모델과 초기 승인 선호로 연결한 별도 작업이다.
- 막았어야 할 지침/AC: 기존 로드는 provider만 복원했고 model=null 이후의 fallback 복귀를 검사하지 않았다. 이번 writer→DTO→실제 Composer가 다른 default를 구별한다.
- 환경: gh run list는403, GitHub connector로 실제 실패 로그를 조회했다. SQLite는 Electron ABI로 유지하고 Git 복사 실행 시험만 Node로 분리했다. 초기 root cwd의 migration/doc 명령은 올바른 app cwd에서 재실행했다.
- r1 / impl r1. 코드 push 시5/6 partial을 기록했고 같은 턴의 Windows CI success 후6/6으로 완료했다. 독립 verify는 별도다.

## [검증자 기입] 파생 이슈 — verify r1 (2026-10-22)

판정 정본은 [verify.md](verify.md) — **FAIL**. 고장 ID는 그 문서 §4 고장 이력이다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | G6 reader가 telemetry를 저장 모델보다 먼저 써도 green | EP1④ · AC1 · VP3 | `last_model`과 다른 마지막 telemetry가 있는 세션의 load DTO가 저장 모델임을 단언 | BLOCKING | open |
