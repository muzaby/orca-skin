# Plan — 0308-bloat-reduction-legacy-migration-and-output-store

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0305 감사](../0305-code-bloat-audit/audit.md) §3 후보 표 · §8 분해안 · §9 분할안과 [0307 plan](../0307-bloat-reduction-unreached-and-constant-args/plan.md) D-003 · D-011이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0308-bloat-reduction-legacy-migration-and-output-store` |
| 작성자 | Claude Code |
| 일자 | 2026-11-11 |
| 매핑 | 0305 분할안 H-C(C-10·C-11) · 0307 D-011(C-02) · H-F 첫 단계(C-24 1단계) |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0305는 감사 문서의 V, 0307은 다른 후보의 V라 상속할 코드 계약이 없다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 작업 — root `AGENTS.md` 협업 워크플로우) |
| 조사 기준 커밋 | `809790a` (`git cat-file -t` → commit · PR 브랜치 좌표, `main` 조상 여부 미확인) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0305 감사가 찾은 과잉 가운데 세 묶음이 남아 있다 — 부팅마다 도는 0225 일회성 이관, 화면이 읽지 않는 백그라운드 출력 보존, 같은 사실을 두 번 드는 `listening` 상태.
- 완료 후 달라지는 것: 이관 코드와 출력 보존 저장소가 사라지고 `listening`은 `activityTransport`에서 파생한다. 새 이름으로 설치해 쓰는 사용자의 화면은 그대로다.
- 사용자에게 달라지는 것 한 가지: v0.3.1(`orca`)에서 올라오는 사용자는 데이터가 자동으로 옮겨지지 않는다(D-002·D-003).

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 305 최적화, 이어서 계획" | 라이브 세션 턴 1 |
| 명시 요구 | H-C는 "그대로 제거" — 선택지 설명: "지금 제거합니다. v0.3.1 사용자는 릴리스 노트의 수동 폴더 이동 안내로만 데이터를 가져올 수 있습니다(DB 안의 저장 경로·워크트리 git 링크는 수동으로 고쳐지지 않습니다)." | 질의 1 답 |
| 명시 요구 | 다음 묶음은 "작은 기계적 묶음" — 선택지 설명: "C-25 … + C-29 … + C-31 … + C-24 1단계 … 조사에서 순증으로 드러나는 항목은 0307처럼 뺍니다." | 질의 1 답 |
| 명시 요구 | C-02는 "캡처까지 제거" — 선택지 설명: "읽기 채널과 스냅샷 쓰기(`capture`·`removeSnapshot`)를 함께 지웁니다. 이번 plan에 넣습니다." | 질의 1 답 |
| 상속 | 회귀 금지 · 판정 단위는 시나리오별 관측 동작 · 목표는 코드 감량 · 백그라운드/서브 에이전트 금지 · 단계마다 커밋 | 0305 plan D-003 · D-011 · D-006 · D-007 |
| 추론 의도 | 이관 제거의 폐포(이관만 쓰던 `rebase-path`·`startup-sequence`·`repairWorktree`·raw DB 접근자·오류 제목)까지 지운다 — 남기면 "아무도 부르지 않는 코드"가 새로 생긴다 | §8 전수 조사 |
| 추론 의도 | 수동 이전 절차의 구체 단계는 `migrate-legacy.ts`의 이동 목록에서 유도한다 | §5 · D-013 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이번 handoff는 H-C(C-10·C-11) · C-02 · 작은 기계적 묶음을 다룬다 | 질의 1의 세 답 | 질의 1 | ACTIVE | — |
| D-002 | 0225 이관 코드를 제거한다 | "그대로 제거" — 배포 릴리스에 이관이 실린 적이 없다는 사실(§4)을 알린 뒤의 답 | 질의 1 | ACTIVE | 0292 D-010 "유지"를 대체 · 0307 D-003 승인의 실행 |
| D-003 | v0.3.1 사용자는 릴리스 문서의 수동 안내로만 데이터를 가져온다. DB 저장 경로·워크트리 git 링크는 고쳐지지 않는다 | §2 선택지 설명 원문 | 질의 1 | ACTIVE | — |
| D-004 | C-02는 읽기 채널과 스냅샷 쓰기를 함께 지운다 | "캡처까지 제거" | 질의 1 | ACTIVE | 0307 D-011(OPEN)을 닫는다 |
| D-005 | 작은 기계적 묶음의 후보는 C-25 · C-29 · C-31 · C-24 1단계이고, 조사에서 순증으로 드러난 항목은 뺀다 | §2 선택지 설명 원문 | 질의 1 | ACTIVE | — |
| D-006 | C-25(대기열 이중 식별자·미사용 메서드)를 이번에 하지 않는다 | `commit`은 테스트 7파일이 대기열을 `submitted`로 모는 수단이고(§4), 식별자 통합은 어댑터 계약 타입 변경이다 | 설계자 조사 | ACTIVE | H-D로 남는다 |
| D-007 | C-29(런타임 모델 한 줄 팩토리)를 하지 않는다 | `no-stray-auth-subscribe.test.ts`가 팩토리 호출 꼴을 정규식으로 강제하고 인라인 읽기를 금지한다(§4) | 설계자 조사 | ACTIVE | — |
| D-008 | C-31(main 내부 이벤트 타입 분리)을 이번에 하지 않는다 | 감사 추정 절감이 0줄이고, 타입 분리의 컴파일 파급을 이 환경에서 측정하지 못했다(§4) | 설계자 조사 | ACTIVE | H-F로 남는다 |
| D-009 | 회귀 금지. 판정 단위는 시나리오별 관측 동작이고, 내부 구조에 묶인 테스트는 통합·삭제할 수 있다 | 0305 D-003 | 0305 plan §3 | ACTIVE | — |
| D-010 | 목표는 코드 감량이다. CI·가드·테스트 인프라를 따로 줄이지 않는다 | 0305 D-011 | 0305 plan §3 | ACTIVE | — |
| D-011 | 백그라운드·서브 에이전트를 쓰지 않는다. 단계(M1·M2·M3)마다 커밋을 남긴다 | 0305 D-006 · D-007 | 0305 plan §3 | ACTIVE | — |
| D-012 | 출력 참조 메타(`outputRefs`·`canReadOutputFile`)의 생산·병합은 남긴다 | 사용자 답이 지목한 것은 "읽기 채널과 스냅샷 쓰기"다. 출력 참조는 어댑터가 SDK 메시지에서 읽어 작업 기록에 싣는 메타이고 journal 형식의 일부다 | 설계자 판단 | ACTIVE | 사용자가 되돌리면 ΔV |
| D-013 | 수동 이전 절차는 "userData 폴더는 이름 변경, 설정 루트는 복사하고 옛 루트는 보존"으로 적는다 | 옛 루트를 남기면 DB에 저장된 옛 절대경로가 그대로 유효하다(D-003의 한계를 절차로 피한다) | 설계자 판단 · AC7 실기 | ACTIVE | 사용자가 되돌리면 ΔV |
| D-014 | `LEGACY_PRODUCT_SLUG` 상수를 지우고, 테스트는 옛 이름을 `PRODUCT_SLUG`의 마지막 마디로 만든다 | prod 소비자가 0이 된다. 관계식은 `product-identity.test.ts:399`가 이미 쓴다 | 설계자 판단 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-014.
- 변경된 결정: 0292 D-010 "유지" → D-002. 0307 D-011(OPEN) → D-004.
- D-006·D-007·D-008은 사용자가 고른 묶음에서 후보를 뺀 설계자 판단이고 D-005의 조건절("순증으로 드러나는 항목은 뺍니다")에 따른다. 묶음 4건 중 남는 것은 C-24 1단계 1건이다.
- D-012·D-013은 사용자 문장이 정하지 않은 세부를 설계자가 정한 것이다. 완료 보고에서 사용자에게 알린다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0.
  - D-002 ↔ AC1·AC2·AC3·AC4: 네 행 모두 이관 경로의 부재를 요구한다. 이관을 남기는 AC 없음.
  - D-003 ↔ AC5·AC7: AC5가 "자동 이관을 약속하지 않는다"와 "수동 절차가 있다"를, AC7이 실기를 요구한다. 경로 재기록을 요구하는 AC 없음.
  - D-004 ↔ AC8·AC9·AC10: 읽기(AC8)·쓰기(AC9)·상태 모델(AC10) 세 축이 다 있다.
  - D-012 ↔ AC9·AC10: 두 행 모두 `outputRefs`를 지우라고 하지 않는다 — `rg 'outputRefs' §7` → AC9의 "출력 참조를 가져도" 1건(입력 조건).
  - D-009 ↔ AC1~AC13: 각 행의 동작 기준 뒷절이 유지되는 동작이다.
  - D-010 ↔ AC14: prod 순감을 요구한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 후보마다 호출부·생산자를 이번 세션에 다시 셌다(§8) |
| 이미 기존 코드가 충족하는가 | 아니오 | 표적이 모두 트리에 있다(§8 전수 조사 N열) |
| 더 작은 해법이 있는가 / 제거라면 능력 자체가 없어도 되는가 | H-C는 능력(자동 이관)을 실제로 없앤다 — 사용자가 알고 고른 결과다(D-002·D-003) | 아래 전제 정정 1 |
| 선행 자료의 주장을 코드와 대조했는가 | **전제 정정 5건** | 아래 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 0225 D-010·D-017·D-018(이관 규약)은 대상 코드와 함께 소멸한다. 0225 D-013(자동 제거 안 함)·D-016(productName 키 없음)은 유지 | §16 |

전제 정정(0305 감사 주장 ↔ 현재 코드·배포):

| 후보 | 감사 주장 | 재실측 | 처리 |
|---|---|---|---|
| C-10·C-11 | "이미 이관을 마친 설치본은 그대로 동작한다" | 배포 태그 4개(`v0.1.0`~`v0.3.1`) 중 이관 코드가 실린 것이 없다 — `git cat-file -e v0.3.1:app/src/main/infra/config/migrate-legacy.ts` 실패, `git show v0.3.1:app/package.json` → name `orca` | 사용자에게 알렸고 "그대로 제거"(D-002) |
| C-10·C-11 | 대상은 두 파일 369줄 | 이관만 쓰는 코드가 더 있다: `rebase-path.ts` 39 · `startup-sequence.ts` 37 · `paths.ts` 레거시 함수 2 · `repairWorktree` · `getDbConnection` · 오류 제목 1 | 폐포 전체를 범위에 넣는다(§8) |
| C-25 | `commit` 제품 호출 0 → 삭제 | 맞다. 다만 테스트 7파일 19곳이 `commit`으로 배치를 `submitted`로 만든다 — `rg -n '\.commit\(' app/src/main -g '*.test.*' \| rg 'attemptId\|chainId\|batch-1'` | D-006 — 제외 |
| C-29 | 한 줄 클로저 3개를 호출 자리로 되돌린다 | `no-stray-auth-subscribe.test.ts:16,19,21`이 `createRuntimeModelSnapshotReader(auth)` 등 호출 꼴을 요구하고 `:164`가 인라인 snapshot 읽기를 금지한다 | D-007 — 제외 |
| C-24 | `listening`은 `activityTransport`의 파생 | 맞다 — 쓰는 5곳이 전부 같은 식이다(§8). `CANCEL_CHAT`도 `listening:false`와 `activityTransport:'idle'`을 함께 쓴다(`chatReducer.ts:1420-1421`) | 범위(AC13) |

C-02의 추가 사실: 출력 보존 코드(`infra/background-output.ts`·`shared/background-task.ts`)는 v0.3.1 태그에 없다. 배포본에는 보존 파일도 `background.output` journal 행도 없다.

- 사용자에게 올릴 결정: 없음(이번 턴 질의로 닫았다). 완료 보고에서 D-012·D-013과 제외 3건을 알린다.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

```text
[앱 실행]
  → initLog → 설정 로드 → 어댑터 확인 → DB 열기 → 미완료 도구 호출 복구 → 핸들러 등록
  → 새 이름 폴더(%APPDATA%\orcinus-orca · ~/.config/orcinus-orca)만 읽고 쓴다
  ↘ 옛 이름 폴더가 있어도 읽지 않고 옮기지 않는다
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 새 이름 폴더에 데이터가 있다(S-01) | 이관 단계 없이 부팅 | 지금과 같다 |
| 옛 이름 폴더만 있다(v0.3.1에서 올라옴) | 새 이름 폴더를 새로 만든다 | 빈 앱으로 시작한다. 옛 폴더는 손대지 않은 채 남는다 |
| 위 상태에서 수동 이전 절차를 마쳤다 | 새 이름 폴더의 DB·설정을 읽는다 | 기존 대화 목록·설정이 보인다(AC7 실기) |
| 백그라운드 작업이 끝났다(S-10) | 종료 상태를 기록·방송한다. 출력 파일을 복사하지 않는다 | 우측 패널 표시는 지금과 같다 |
| 백그라운드 작업 개별 중단·전환(S-10) | `controller.stop`·`promote` — 변경 없음 | 지금과 같다 |
| `chat.activity`의 transport가 `ready`·`listening`(S-06·S-07) | `activityTransport`만 갱신 | 입력 예약·폴더 변경 거부·상태줄이 지금과 같은 때에 바뀐다 |
| 응답 중단(S-06) | `activityTransport`를 `idle`로 | 대기 표시가 즉시 내려간다 |

### 수동 이전 절차 (운영 문서에 적을 내용 — D-013)

`migrate-legacy.ts`가 옮기던 목록에서 유도했다. 실기 검증은 AC7이다.

| 순서 | 할 일 | 근거 |
|---|---|---|
| 1 | 구버전 앱을 종료한다 | 떠 있으면 DB·WAL이 잠긴다 |
| 2 | `%APPDATA%\orca` 폴더 이름을 `orcinus-orca`로 바꾼다(신버전을 먼저 실행했다면 새로 생긴 폴더를 치운 뒤) | `migrate-legacy.ts:89` — userData 통째 이동. 암호화 키(`Local State`)가 함께 간다 |
| 3 | 그 안의 `orca.db`·`orca.db-wal`·`orca.db-shm`과 `orca-settings.json`·`orca-secrets.json`·`orca-provider-grants.json`·`orca-provider-oauth.json`의 앞머리를 `orcinus-orca`로 바꾼다 | `:127-159` DB 3종 · store 4종 |
| 4 | `~/.config/orca`의 `orca.json`과 `sources/`를 `~/.config/orcinus-orca`로 **복사**하고 `orca.json`→`orcinus-orca.json`, `sources/skills/.orca-builtin.json`→`.orcinus-orca-builtin.json`으로 바꾼다 | `:162-178` |
| 5 | `~/.config/orca`는 지우지 않는다 — 기존 대화의 작업 폴더와 격리 워크트리가 그 안을 가리킨다 | D-003: 저장 경로를 재기록하지 않는다 |

절차를 따르지 않은 사용자는 빈 앱으로 시작하고, 나중에 절차를 따르면(신버전이 만든 새 폴더를 치우고) 같은 결과를 얻는다.

### 파생 UX / 엣지케이스

- loading / empty / error: "기존 데이터를 옮기지 못했습니다" 오류 토스트가 사라진다 — 띄우는 경로가 없어진다.
- cancel / retry / close / restart: 변화 없음. 부팅 단계가 2개 준다(`legacy-migration`·`legacy-paths`).
- 과거 journal: 개발 빌드 DB에 남은 `background.output` 행은 상태 복원에서 기존 작업 기록을 바꾸지 않는다(AC10).
- 남는 파일: 개발 빌드가 `<userData>/background-outputs`에 만든 보존 파일은 지우지 않는다(§10 선언 경계 2).
- 외부 소비자: preload `window.oo.chat.readBackgroundOutput`이 사라진다. renderer 호출부는 0이다(§8).

## 6. 범위 / 비범위

- **범위**: H-C(C-10·C-11과 폐포) · C-02(읽기·캡처·보존 저장소·상태 모델 필드) · C-24 1단계. 딸린 테스트·i18n 키·문서(`release-operations.md` · `arch/backend/overview.md` · `background-tasks.md` · `TRD.md` · `IPC_CONTRACT.md` · `generated/inventory.md`) · 이름 검사기 허용 목록.
- **비범위**: C-25(D-006) · C-29(D-007) · C-31(D-008) · `outputRefs` 생산(D-012) · C-24 2~4단계 · C-07 · C-33 · C-34 · 그 밖의 분할안 묶음 · 옛 폴더의 자동 정리.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| C-25 · C-31 | 아니오 | H-D · H-F에서 설계와 함께 |
| `outputRefs` 생산 제거 | 아니오 — journal은 patch 필드를 그대로 싣는다 | 사용자 판단(완료 보고) |
| 이관을 한 릴리스 실은 뒤 제거하는 안 | **예 — 지금 제거하면 v0.3.1 사용자의 자동 이관은 되돌릴 수 없다** | 사용자가 "그대로 제거"로 결정(D-002) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 (C-10·C-11) | 부팅 경로에 이관이 없다: 옛 이름 폴더를 조립·이동·재기록하는 코드가 없고, 로깅 초기화가 진입점의 첫 배선이다 | `product-identity.test.ts` 신규 2건(§7-A VP-01) · EP-01 0건 · 이름 검사기의 `app/src` 허용 항목이 마이그레이션 SQL 1개 | `main/index.ts` 모듈 스코프 → `initLog()` → `new Bootstrap(…)` |
| R-02 | AC2 | 부팅 단계는 설정 → 어댑터 확인 → `db-init` → `chat-recovery` → 핸들러 등록 순서이고 `db-init`·`chat-recovery`는 critical이다. `legacy-migration`·`legacy-paths` 단계가 없다 | `product-identity.test.ts` 신규 1건(순서·등급·부재) · `bootstrap.harness.test.ts` "start forwards its real settings service…" green | `Bootstrap.start()` |
| R-03 | AC3 | 오류 제목 `legacyMigrationFailed`와 ko/en 문구, 오류 보고 등록 2건(M3·M9)이 없다. 나머지 등록은 그대로 잠겨 있다 | `error-report.registry.test.ts` "detects removed report …" 전건 green(목록에서 M3·M9 삭제) · i18n ko/en 대칭 테스트 green · EP-02 0건 | `reportError` → 토스트 제목 i18n |
| R-04 | AC4 | `git worktree repair` 래퍼와 raw DB 접근자가 없다. 워크트리 준비·제거·브랜치 삭제는 mutation 경로로 간다 | `git-execution.test.ts` "prepares without baseRef in four executions…"이 repair 호출 없이 generation 3을 단언 · EP-01 0건 | `WorktreeService.prepare` → `gateway.mutate` |
| R-05 | AC5 | 운영 문서가 자동 이관을 약속하지 않고 §5의 수동 이전 절차 5단계를 갖는다. `arch`·`TRD`가 이관 모듈을 현재형으로 서술하지 않는다 | `product-identity.test.ts` "운영 문서" 신규 2건(§7-A VP-04) · 이름 검사기 OK · `check-doc-inventory.mjs --check` OK · EP-03 0건 | 문서 |
| R-06 | AC6 | 이름 검사기 허용 목록에서 이관 입력 6파일이 빠지고, 문서 항목의 개수가 실제와 같다 | `node scripts/check-product-naming.mjs` OK · `check-product-naming.test.mjs` 고정 집합 케이스가 6파일 없는 집합을 단언 | CI 게이트 |
| R-07 | AC7 | v0.3.1 데이터로 §5 절차를 마치면 기존 대화 목록·설정이 보이고 기존 대화가 열린다. 절차 없이 실행하면 빈 앱이고 옛 폴더는 그대로다 | 사람 실기 — §19 | 설치본 |
| R-08 | AC8 (C-02) | 원본 출력 읽기 채널·preload 메서드·api 래퍼·컨트롤러 `read`가 없다. 개별 중단·전환·상태 조회는 지금과 같다 | `background-controller.test.ts` 5건 green(§7-A VP-05) · `registerBackgroundHandlers`의 등록 채널 집합 = 3개(신규 1건) · EP-05 0건 | `chat:stopBackgroundTask`·`promoteBackgroundTask`·`backgroundState` → 컨트롤러 |
| R-09 | AC9 | 끝난 백그라운드 작업이 출력 참조를 가져도 파일을 복사하지 않고 `background.output` 이벤트를 저장·방송하지 않는다. 작업의 종료 상태는 지금과 같이 기록·방송된다 | `background-controller.test.ts` 신규 1건 — 터미널 작업 + 파일 출력 참조 입력 → 저장·방송된 이벤트가 작업 이벤트뿐 | 어댑터 이벤트 → `controller.observe` → `persist`·`publish` |
| R-10 | AC10 | 공유 상태 모델에 `background.output` 변형·`outputSnapshots`·`outputErrors`가 없다. 과거 journal의 그 이벤트는 기존 작업 기록을 바꾸지 않는다 | `background-task.test.ts` 신규 1건 — 작업 이벤트 뒤에 과거 output 이벤트를 넣은 상태 = 작업 이벤트만 넣은 상태 | DB `background_task_events` → `controller.state` → `reduceBackground` |
| R-11 | AC11 | 대화 삭제·목록 제거는 journal·parts·워크트리 바인딩을 지금과 같이 남긴다 | `session.delete.native-history.test.ts`의 유지 단언 3줄(`:168-170`) green — 보존 파일 준비·`removeSnapshot` 단언은 삭제 | `session:delete` → `background.dispose` |
| R-12 | AC12 | `IPC_CONTRACT.md`에 읽기 채널 행이 없고 `background-tasks.md`가 출력 읽기·보존·전체 중단을 현재형으로 서술하지 않는다 | `check-doc-inventory.mjs --check` OK · EP-06 0건 | 문서 |
| R-13 | AC13 (C-24) | 세션 상태에 `listening` 필드가 없다. 채널 점유 판정은 `activityTransport` 하나에서 나온다: `idle`이면 아님, `ready`·`listening`이면 점유. 입력 예약·폴더 변경 거부·busy 판정·상태줄이 그 판정을 쓴다 | `chatStore.listen.test.ts`·`chatReducer.listen.test.ts`·`chatStore.sessionDirectory.test.ts`·`sendAdmission` 경로의 3입력(§7-A VP-10) · EP-07 차집합 0 | `chat:event` `chat.activity` → `chatReducer` → `sessionListening` → 소비 4곳 |
| R-14 | AC14 | prod 코드가 순감하고 테스트 코드는 순증하지 않는다 | `git diff --numstat <설계 커밋>..HEAD -- app/src`를 prod/test로 갈라 합산 — prod < 0 · test ≤ 0 | 해당 없음 |
| R-15 | AC15 | §19 게이트가 green이거나 실패가 기준선과 같은 환경 서명이다 | §19 명령 산출 | CI |
| R-16 | AC16 | 설치본·개발 빌드에서 부팅·백그라운드 패널·응답 중 입력 대기가 그대로다 | 사람 실기 — §19 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: 인용한 케이스명은 이번 세션에 `rg`로 실재를 확인했다 — `background-controller.test.ts:50,81,170,196,358` · `bootstrap.harness.test.ts:156` · `error-report.registry.test.ts:242` · `git-execution.test.ts`의 "prepares without baseRef…" · `chatStore.listen.test.ts:29,84,90,101`.
- 사람 실기 항목: AC7·AC16. 설치본 실행과 실제 v0.3.1 데이터 폴더가 필요하다. AC7의 순수 부분(문서가 절차를 갖는가)은 AC5가 기계로 본다.
- 총량/0건 기준: 삭제의 불변식은 "없다"라 음성 검색이 방향에 맞다. 과삭제는 같은 행의 유지 동작 테스트가 막는다. 허용 예외는 §10 행마다 먼저 열거했다.
- AC2의 순서 단언은 소스 텍스트로 본다(구조적 proxy) — 이 환경에 electron 바이너리가 없어 `Bootstrap`을 통째로 실행하지 못한다. 그래서 적대 증거를 등록했다(VP-01).
- AC14의 test 조건: 삭제하는 테스트 5파일(738줄)이 새로 쓰는 케이스보다 크다. 구현 중 순증이 나오면 수치와 사유를 보고하고 설계자 판단을 받는다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 코드 계약 V가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-16 | R | §7 각 행 | NEW | — |
| AT-01~AT-16 | AT | §7 검증 수단 칸 | NEW | — |
| AR-01 | AR | §9 부팅 조립 — 진입점·`Bootstrap` 단계 목록 | NEW | — |
| AR-02 | AR | §9 백그라운드 컨트롤러 의존성·채널 등록 | NEW | — |
| AR-03 | AR | §10 공유 백그라운드 상태 모델(journal 형식) | NEW | — |
| MD-01 | MD | §10 `sessionListening` 파생 규칙 | NEW | — |
| MD-02 | MD | §10 `reduceBackground`의 과거 이벤트 처리 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01·R-02·AR-01 ↔ AT-01·AT-02 | REQUIRED | `index.ts` 모듈 스코프 → `initLog` → `new Bootstrap` → `start()` 단계 목록 → 핸들러 등록 | 신규 `product-identity.test.ts` ① "prod 소스에 이관 심볼이 없다" — `src` prod 전수에서 EP-01 술어 → `[]` ② "진입점이 로깅을 첫 배선으로 초기화한다" — `initLog()`가 `installErrorReportSink()`보다 앞 ③ "부팅 단계 순서" — `'db-init'` < `'chat-recovery'` < `registerChatHandlers({`, 두 단계 옵션이 `critical: true`, 이관 단계 이름 2개 부재 | required — 0건 스윕·구조 proxy. 변이: (a) prod 파일 하나에 `legacyConfigDir` 식별자를 되살림 → ① red (b) `index.ts`에서 `initLog()`를 `installErrorReportSink()` 뒤로 → ② red (c) `'db-init'`의 `critical: true`를 `false`로 → ③ red (d) `chat-recovery` 단계를 `db-init` 앞으로 → ③ red | EP-01 (19파일) |
| VP-02 | R-03 ↔ AT-03 | REQUIRED | `reportError({title})` → `app-error.ts` 제목 union → renderer i18n `errors.title.*` | `error-report.registry.test.ts:"detects removed report <id> <event>"` 전건 · i18n 대칭 테스트(구현자가 `resources` 테스트 케이스명을 좌표로 기입) | not selected — 등록 테스트가 자리마다 제거 변이를 내장한다 | EP-02 (6파일) |
| VP-03 | R-04 ↔ AT-04 | REQUIRED | `WorktreeService.prepare` → `gateway.mutate` → `removeWorktree` → `deleteBranch` | `git-execution.test.ts:"prepares without baseRef in four executions and routes all worktree writes through mutation"` — `generation()` 1 → 3 | not selected — 직접 행동 oracle | EP-01에 포함(`worktree.ts`·`db/index.ts`·테스트 3파일) |
| VP-04 | R-05·R-06 ↔ AT-05·AT-06 | REQUIRED | 문서 → 운영자 | 신규 `product-identity.test.ts` "운영 문서" ④ "자동 이관을 약속하지 않는다" — 문서에 `최초 실행이 새 자리로 옮기` 부재 + `### 데이터 수동 이전` 표제 존재 ⑤ "수동 이전이 옛 이름→새 이름 대응 7개를 적는다" — DB 3종·store 4종의 새 파일명 7개가 문서에 있음 · `check-product-naming.test.mjs:"이관 입력 6 + …"`을 고친 고정 집합 케이스 · `gate:node scripts/check-product-naming.mjs` | required — 문서 존재 단언. 변이: (e) 표제를 지움 → ④ red (f) store 파일명 하나를 지움 → ⑤ red | EP-03 (문서 6자리) · EP-04 (허용 항목 9행) |
| VP-05 | R-08·AR-02 ↔ AT-08 | REQUIRED | preload `chat.*` → `CHANNELS.chat*Background*` → `registerBackgroundHandlers` → `BackgroundController.stop·promote·state` | `background-controller.test.ts:"bounds a stop request whose SDK never acknowledges it"` · `"keeps stop ACK distinct from terminal, rejects unknown tasks and never relays raw"` · `"stops the current recorded task even when history has the same task ID"` · `"restores history without treating old live membership as current"` · `"turns an individual stop ACK without terminal evidence into an explicit unconfirmed state"` · 신규 채널 집합 케이스 — `registerBackgroundHandlers`가 등록한 채널 = `chatBackgroundState`·`chatStopBackgroundTask`·`chatPromoteBackgroundTask` 3개(`background.ts:55,58,61`) | required — 0건 스윕. 변이: (g) `handle(CHANNELS.chatStopBackgroundTask…)` 등록 제거 → 채널 집합 케이스 red | EP-05 (18파일) |
| VP-06 | R-09 ↔ AT-09 | REQUIRED | 어댑터 `background.task`(terminal) → `controller.observe` → `tracker.observe` → `persist` → `publish` | 신규 `background-controller.test.ts` "끝난 작업의 출력 참조를 복사하지 않는다" — 입력: 현재 generation의 터미널 작업 + `kind:'file'` 출력 참조 1개 · 관측: `persist`·`publish`가 받은 이벤트 type 목록 = `['background.task']` | not selected — 직접 행동 oracle(부재를 호출 목록의 동등으로 관측) | EP-05에 포함 |
| VP-07 | R-10·AR-03·MD-02 ↔ AT-10 | REQUIRED | DB `background_task_events.payload_json` → `db.background.list` → `controller.state` → `reduceBackground` → `BackgroundSessionState.tasks` | 신규 `background-task.test.ts` "과거 output 이벤트는 작업 기록을 바꾸지 않는다" — 입력 A: 작업 이벤트 1 · 입력 B: A + `{type:'background.output', taskId, outputId, snapshot}`(타입 밖 값) · 관측: B의 `tasks[key]` = A의 `tasks[key]` | not selected — 직접 oracle | EP-05에 포함(`background-task.ts` 18줄) |
| VP-08 | R-11 ↔ AT-11 | REGRESSION | `session:delete` → 삭제 핸들러 → `background.dispose(sessionId)` → journal 유지 | `session.delete.native-history.test.ts` 기존 케이스의 `queries.background.list('s1')`·`loadParts`·`getManagedWorktreeBySession` 단언 | not selected | EP-05에 포함 |
| VP-09 | R-12 ↔ AT-12 | REQUIRED | 문서 → 구현자 | `gate:node scripts/check-doc-inventory.mjs --check` · EP-06 음성 검색 | not selected — 생성물 대조 게이트 | EP-06 (문서 8자리) |
| VP-10 | R-13·MD-01 ↔ AT-13 | REQUIRED | `chat:event` `chat.activity` → `chatReducer` `RECV_EVENT` → `activityTransport` → `sessionListening` → ① `send` 예약 판정 ② 폴더 변경 가드 ③ `sessionBusy` ④ `useChatActivity` → `PendingAssistantStatus` → `StatusLine` | 규칙 3분기 × 자리: `idle` → `chatStore.listen.test.ts`의 `sessionBusy` false 케이스(`:90`·`:101`) · `ready` → 신규/수정 케이스 "ready 는 busy 이지만 responding 이 아니다" — `sessionBusy` true + `sessionResponding` false · `listening` → `:29`·`:84` true 케이스. 소비 ①: `chatStore.listen.test.ts`의 전송 케이스에 `activityTransport:'ready'` 입력 → `message.queued` 경로. 소비 ②: `chatStore.sessionDirectory.test.ts`의 `it.each` 입력을 `{ activityTransport: 'ready' }`로 → `reason:'busy'`. 소비 ④: 신규 selector 케이스 — `ready` 입력에서 view의 `listening` true | required — 형제 슬롯(`sessionResponding`은 `=== 'listening'`, `sessionListening`은 `!== 'idle'`). 변이: (h) `sessionListening`을 `=== 'listening'`으로 맞바꿈 → `ready` 케이스 red (i) 소비 ②의 판정 항 제거 → sessionDirectory 케이스 red (j) 소비 ④ selector의 파생을 `false` 고정 → selector 케이스 red | EP-07 (14자리) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/**` 삭제·수정 | §19 | 이번 변경이 만진 파일에서 난 실패와 기준선 밖 실패만 blocking |
| 이름 검사기 | 허용 목록·문서 개수를 고친다 | `node scripts/check-product-naming.mjs` · `node --test scripts/*.test.mjs` | 전부 blocking |
| 문서 인벤토리 | 채널 1개·파일이 준다 | `node scripts/check-doc-inventory.mjs --check` | 전부 blocking |
| 테스트 풀·예산 가드 | 테스트 파일을 추가·수정한다 | `[test-pools]`·예산 가드 | 만진 파일의 위반만 blocking |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 이관은 진입점 모듈 스코프에서 `runStartupSequence`로 돌고 결과가 `Bootstrap` 생성자 2번째 인자로 간다 | `app/src/main/index.ts:37-51,297-300` |
| `Bootstrap`은 그 결과로 단계 2개를 돈다 — `legacy-migration`(critical) · `legacy-paths` | `app/src/main/app/bootstrap.ts:265,458-470,609-637` |
| `startup-sequence.ts`의 존재 이유는 "이관이 `initLog`보다 먼저"라는 순서 계약 하나다 | `app/src/main/infra/config/startup-sequence.ts:1-6` |
| `rebaseUnderRoot`의 소비자는 `legacy-paths.ts` 하나다 | `rg -n rebaseUnderRoot app/src -g '!*.test.*'` → 정의 1 + `legacy-paths.ts` |
| `repairWorktree`의 prod 소비자는 `legacy-paths.ts` 하나, 테스트 소비자는 `git-execution.test.ts:127` | `rg -n repairWorktree app/src` |
| `getDbConnection`의 prod 소비자는 `bootstrap.ts:613` 하나, 테스트 mock 2곳 | `rg -n getDbConnection app/src` → 5줄 |
| `LEGACY_PRODUCT_SLUG`의 소비자는 `paths.ts`·`migrate-legacy.ts`·`product-identity.test.ts` | `rg -n LEGACY_PRODUCT_SLUG app/src` |
| `product-identity.test.ts`는 이관 배선·레거시 상수 소비자를 소스 텍스트로 잠근다 — 7케이스가 대상이다 | `:178-205`(3) · `:397-401`(1) · `:431-466`(3) |
| 이름 검사기는 옛 표기를 허용 목록 밖에서 만나면 실패하고(fail-closed), 허용 항목의 `count`가 실제와 같아야 한다 | `app/scripts/check-product-naming.mjs:8,51-95` |
| 출력 읽기 채널의 renderer 호출부는 0이다 | `rg -U 'chatApi\s*\??\.\s*readBackgroundOutput' app/src/renderer -g '!*.test.*'` → 0(`shared/api/ipc.ts` 래퍼 제외) |
| 스냅샷을 읽는 곳은 `controller.read` 하나, 쓰는 곳은 `captureCompleted` 하나다 | `background-controller.ts:252,278` |
| `background.dispose`의 prod 호출은 `preserveOutputSnapshots: true` 하나다 — 삭제 분기는 prod에서 돌지 않는다 | `bootstrap.ts:1292` |
| `outputSnapshots`·`outputErrors`를 읽는 renderer prod 코드는 0이다 | `rg -n 'outputSnapshots\|outputErrors' app/src/renderer -g '!*.test.*'` → 0 |
| `reduceBackground`는 모르는 type에서 기존 작업 기록을 그대로 되쓴다 | `shared/background-task.ts:491-555` — 분기 밖이면 `next.tasks[key] = record` |
| `listening`을 쓰는 5곳이 전부 `activityTransport`와 같은 식이다 | `chatReducer.ts:517-518` · `:1256,1262,1271` · `:1420-1421` · `:1550,1556` · `:1567,1572` |
| `background-tasks.md:23`은 0307이 지운 "전체 중단"을 아직 현재형으로 적는다 | `rg -n stopAll app/src/main -g '!*.test.*'` → 0 |
| INDEX 후보 표에 이번 파일과 겹치는 형태는 없다 — 0299 행은 `IPC_CONTRACT.md:267`(다른 표의 셀 이스케이프)이다 | `docs/handoff/INDEX.md` `## 새 handoff 후보` 5행 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 이관 심볼이 있는 파일 | EP-01 명령(§10) | 19 | 삭제 8 · 수정 11 |
| 그중 통째로 지우는 파일 | `legacy-paths`·`migrate-legacy`·`rebase-path`·`startup-sequence`의 `.ts`·`.test.ts` | 8 | prod 445줄 · test 568줄 |
| `legacyMigrationFailed` 자리 | EP-02 명령 | 6파일 7줄 | 제목 union 1 · i18n 2 · 호출 2 · 등록 테스트 2 |
| 출력 읽기·보존 심볼이 있는 파일 | EP-05 명령 | 18 | 삭제 2 · 수정 16 |
| `ChatState.listening` 필드 자리 | EP-07 명령 | 14 | 타입 1 · 쓰기 6 · 읽기 7 |
| `listening`을 인자·view prop으로 받는 자리(유지) | 같은 명령의 나머지 | 6 | `activityLabel.ts` 2 · `sendAdmission.ts` 2 · `PendingAssistantStatus.tsx` 2 |
| 배포 태그 | GitHub 릴리스 목록 | 4 | `v0.1.0`·`v0.2.0`·`v0.3.0`·`v0.3.1` — 이관·출력 보존 코드 없음 |

### 수치 / 전칭 표현 검산

- 재측정 수치: `wc -l` — `legacy-paths.ts` 163 · `migrate-legacy.ts` 206 · `rebase-path.ts` 39 · `startup-sequence.ts` 37(합 445) · 테스트 250 · 215 · 54 · 49(합 568) · `background-output.ts` 197 · `.test.ts` 170.
- 내역 합 = 총계: EP-01 19파일 = 삭제 8 + 수정 11. EP-07 14 = 1 + 6 + 7. 삭제 테스트 5파일 = 568 + 170 = 738줄.
- "유일한" 반례 검색: `rebaseUnderRoot`·`repairWorktree`·`getDbConnection`·`readSnapshot`(출력)·`capture`(출력)를 각각 `rg`로 전수 확인했다(위 표).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: §7 주의사항 1행.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: AR-01 · AR-02 · AR-03 · MD-01.
- 부팅: `index.ts` 모듈 스코프가 `runStartupSequence({migrateLegacy, initLog})`를 부르고, `Bootstrap.start()`가 이관 등급 확인과 저장 경로 재기록을 단계로 돈다.
- 백그라운드: 작업이 끝나면 `captureCompleted`가 출력 파일을 `<userData>/background-outputs`로 복사하고 `background.output` 이벤트를 journal에 쓴다. 읽는 경로는 화면이 부르지 않는 채널 하나다.
- 대화 상태: `ChatState`가 `listening`과 `activityTransport`를 함께 들고 다섯 곳이 둘을 나란히 쓴다.

```text
index.ts ─ runStartupSequence ─┬ migrateLegacyRoots(fs rename)
                               └ initLog
Bootstrap.start ─ settings ─ [legacy-migration] ─ adapter-registry ─ db-init ─ [legacy-paths] ─ chat-recovery ─ handlers

adapter task(terminal) ─ controller.observe ─┬ persist/publish(task)
                                             └ captureCompleted ─ store.capture ─ persist/publish(output)
renderer(호출 없음) ─ chat:readBackgroundOutput ─ controller.read ─ store.read / readSnapshot

chat.activity ─ chatReducer ─┬ activityTransport
                             └ listening (= transport !== 'idle')
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같은 노드.
- 부팅: `index.ts`가 `initLog()`를 직접 부르고 `Bootstrap` 생성자는 인자 1개다. 단계 목록에서 대괄호 두 단계가 빠진다.
- 백그라운드: 컨트롤러는 작업 이벤트를 저장·방송하고 중단·전환·상태 조회만 한다. `outputs` 의존성과 보존 저장소가 없다.
- 대화 상태: `activityTransport`가 유일한 사실이고 `sessionListening(session)`이 파생을 한 곳에서 한다.

```text
index.ts ─ initLog
Bootstrap.start ─ settings ─ adapter-registry ─ db-init ─ chat-recovery ─ handlers

adapter task(terminal) ─ controller.observe ─ persist/publish(task)

chat.activity ─ chatReducer ─ activityTransport ─ sessionListening ─ {send 예약 · 폴더 가드 · sessionBusy · useChatActivity}
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 부팅 책임 | 진입점이 이관 → 로깅 순서를 조립 함수로 강제 | 진입점이 로깅을 직접 초기화 | 순서 계약의 한쪽이 사라진다 | AR-01 / VP-01 · `index.ts` |
| 부팅 단계 | 이관 등급 확인 · 저장 경로 재기록 단계 | 삭제(이동 아님) | D-002 | AR-01 / VP-01 · `bootstrap.ts` |
| 오류 표면 | `legacyMigrationFailed` 제목 · 보고 2건 | 삭제 | 띄우는 경로가 없다 | VP-02 · `app-error.ts`·i18n |
| git·DB 보조 | `repairWorktree` · `getDbConnection` | 삭제 | 소비자가 이관뿐 | VP-03 · `worktree.ts`·`db/index.ts` |
| 백그라운드 의존성 | `outputs`(read·capture·readSnapshot·removeSnapshot) · `roots` | 삭제. `roots`는 소비자가 `read`·`capture`뿐이라 함께 삭제 | D-004 | AR-02 / VP-05·VP-06 · `background-controller.ts`·`background.ts` |
| 상태 계약 | `background.output` 변형 · 작업 기록 필드 2개 | 삭제. 출력 참조 필드는 유지(D-012) | D-004 | AR-03 / VP-07 · `shared/background-task.ts` |
| dispose | `preserveOutputSnapshots` 옵션 | 옵션 삭제 — 타이머 정리와 disposed 표시만 | 보존 대상이 없다 | VP-08 · `bootstrap.ts:1292` |
| 대화 상태 | 필드 2개를 5곳이 나란히 씀 | 필드 1개 + 파생 함수 1개 | 같은 사실의 사본 제거 | MD-01 / VP-10 · `chatReducer.ts`·`chatStore.ts` |
| 관측점 | 이관 배선을 소스 텍스트로 잠금(7케이스) | 부재·순서를 소스 텍스트로 잠금(3케이스) | 잠글 대상이 바뀐다 | VP-01 · `product-identity.test.ts` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `main/index.ts` | 로깅 초기화 → 오류 싱크 → `Bootstrap` 생성 | — | electron 진입점 |
| `features/chat/background-controller.ts` | 작업 이벤트 저장·방송, 중단·전환·상태 | `BackgroundEvent` → journal·renderer | `app/chat-turn/background.ts` |
| `renderer chatStore.ts` `sessionListening` | 채널 점유 파생 | `activityTransport` → boolean | store 내부 3곳 + selector |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-01 / VP-01·VP-03 — EP-01 | 이관 심볼의 부재 | 해당 없음(삭제) | 구현자 | 19파일: 삭제 8(`app/legacy-paths{,.test}.ts` · `infra/config/{migrate-legacy,rebase-path,startup-sequence}{,.test}.ts`) · 수정 11(`index.ts` · `app/bootstrap.ts` · `infra/config/paths.ts` · `infra/db/index.ts` · `infra/git/worktree.ts` · `shared/product.ts` · `product-identity.test.ts` · `error-report.registry.test.ts` · `app/git-execution.test.ts` · `app/bootstrap.harness.test.ts` · `app/bootstrap.opencode-warmup.test.ts`) | `rg -c "migrateLegacy\|migrationBlocksBoot\|MigrationReport\|legacyMigration\b\|rebaseStoredPaths\|repairMovedWorktrees\|rebaseUnderRoot\|runStartupSequence\|legacyConfigDir\|legacyUserDataDir\|LEGACY_PRODUCT_SLUG\|repairWorktree\|getDbConnection\|'legacy-migration'\|'legacy-paths'\|legacy\.paths\.\|legacy\.worktree\.\|app\.legacy\.\|legacy-paths'\|migrate-legacy'\|rebase-path'\|startup-sequence'" app/src app/scripts` → 19파일 → 구현 뒤 `product-identity.test.ts`의 부재 단언 문자열만 남는다 | 남은 자리는 죽은 import(typecheck red) 또는 부르는 곳 없는 함수다 |
| VP-02 — EP-02 | 오류 제목의 부재 | `shared/app-error.ts` 제목 union | 구현자 | 6파일 7줄: `app-error.ts:14` · `ko.ts:593` · `en.ts:589` · `index.ts:64` · `bootstrap.ts:629` · `error-report.registry.test.ts:31,73` | `rg -n legacyMigrationFailed app/src` → 7줄 → 0 | i18n 키만 남으면 대칭 테스트는 green이고 죽은 문구가 남는다 |
| VP-04 — EP-03 | 문서의 현재형 서술 | 문서 | 구현자 | 6자리: `release-operations.md:69`가 속한 "구버전(orca) 수동 제거" 절(재작성) · `arch/backend/overview.md:74` · `:158` · `:161` · `:243` · `TRD.md:75` | `rg -n "legacy-paths\|migrate-legacy\|legacy-migration\|저장 경로 이관\|최초 실행이 새 자리로" docs/TRD.md docs/IPC_CONTRACT.md docs/arch docs/guides` → 6줄 → 0 | 문서가 없는 모듈을 가리킨다 |
| VP-04 — EP-04 | 이름 검사기 허용 항목 | `check-product-naming.mjs` `ALLOWED` | 구현자 | 9행: 삭제 6(`shared/product.ts` · `migrate-legacy.ts` · `.test.ts` · `legacy-paths.test.ts` · `rebase-path.ts` · `.test.ts`) · 개수 갱신 3(`release-operations.md` lower·title · `overview.md` lower) | `node scripts/check-product-naming.mjs` — 개수 불일치·미허용 표기를 파일별로 출력 | 개수가 어긋나면 검사기가 red다(게이트가 직접 막는다) |
| AR-02·AR-03 / VP-05~VP-08 — EP-05 | 출력 읽기·보존 심볼의 부재 | 해당 없음(삭제) | 구현자 | 18파일: 삭제 2(`infra/background-output{,.test}.ts`) · prod 수정 8(`features/chat/background-controller.ts` · `app/chat-turn/background.ts` · `app/bootstrap.ts` · `preload/index.ts` · `renderer/src/shared/api/ipc.ts` · `shared/background-task.ts` · `shared/ipc.ts` · `shared/protocol.ts`) · 테스트 수정 8(`background-controller.test.ts` · `background.integration.test.ts` · `background.monitor.test.ts` · `session.delete.native-history.test.ts` · `bootstrap.native-history.test.ts` · `shared/background-task.test.ts` · `canonicalBackground.visibility.test.ts` · `CanonicalBackgroundContent.render.test.ts`) | `rg -c "readBackgroundOutput\|ReadBackgroundOutput\|chatReadBackgroundOutput\|BackgroundOutputStore\|BackgroundOutputSnapshot\|BackgroundOutputCursor\|outputSnapshots\|outputErrors\|'background\.output'\|background-outputs\|preserveOutputSnapshots\|captureCompleted\|outputDenied\|removeSnapshot\|background-output'" app/src` → 18파일 → VP-07 테스트의 과거 이벤트 입력 1곳만 남는다 | 타입에서 필드만 지우고 쓰기를 남기면 typecheck가 막는다. 쓰기를 지우고 필드를 남기면 빈 객체가 계속 실린다 |
| VP-09 — EP-06 | 문서의 현재형 서술 | 문서 | 구현자 | 8자리: `IPC_CONTRACT.md:60` 행 · `background-tasks.md:23`(전체 중단 문장) · `:25` · `## 출력` 절의 `:39` · `:41`(읽기 거부 문장만 — 임시 루트 고정 문장은 유지) · `:43` · `:45` · `:47` | `rg -n "readBackgroundOutput\|background-outputs\|원본 출력\|전체 중단은 새 입력\|outputId를 요청\|읽기 거부\|페이지당\|보존 파일" docs/IPC_CONTRACT.md docs/arch` → 8줄 → 0 | 문서가 없는 채널·저장소를 가리킨다 |
| MD-01 / VP-10 — EP-07 | 채널 점유 = `activityTransport !== 'idle'` | `chatStore.ts` `sessionListening` | 구현자 | 14자리: 타입 `chatReducer.ts:332` · 쓰기 `:517` · `:1256` · `:1271` · `:1420` · `:1556` · `:1572` · 읽기 `chatStore.ts:1116` · `:1122` · `:1206` · `:2285` · `:2286` · `:2319` · `:2333` | `rg -n "(\.\|\b)listening(:\|\b)" app/src/renderer/src -g '!*.test.*' -g '!*.testHarness.*' -g '!*.testfixture.*' \| rg -v "'listening'\|//\|\* "` → 20줄 = 14자리 + 유지 6 → 구현 뒤 유지 6 + `sessionListening` 정의·호출 | 읽기 한 곳이 `=== 'listening'`으로 바뀌면 `ready` 구간에서 입력이 예약되지 않고 낙관 커밋된다 |

규칙 칸 ↔ UT 입력 칸:

| 규칙 | 분기 | 입력 | 기대 | 좌표 |
|---|---|---|---|---|
| `sessionListening` | transport `idle` | `{activityTransport:'idle'}` | false | VP-10 `idle` |
| | transport `ready` | `{activityTransport:'ready'}` | true | VP-10 `ready` |
| | transport `listening` | `{activityTransport:'listening'}` | true | VP-10 `listening` |
| `reduceBackground` 과거 이벤트 | 아는 type | 작업 이벤트 | 지금과 같은 병합 | 기존 `background-task.test.ts` 케이스 |
| | 모르는 type(과거 `background.output`) | A + 과거 output 이벤트 | `tasks[key]`가 A와 같다 | VP-07 신규 |
| 컨트롤러 종료 처리 | 터미널 작업 + 파일 출력 참조 | VP-06 입력 | 이벤트 목록 = 작업 이벤트뿐 | VP-06 신규 |
| | 터미널 아님 | 기존 중단 케이스 | 지금과 같다 | VP-05 5건 |

- 자리 목록은 위 검색 출력과 차집합 0이다(이번 세션 실행 — §8 전수 조사).
- **선언 경계**:
  1. 과거 journal에 작업 이벤트 없이 `background.output`만 있는 세션 — 빈 작업 기록 하나가 생긴다. 발생하지 않는다: 캡처는 상태에 있는 터미널 작업만 돈다(`background-controller.ts:259-261`).
  2. 개발 빌드가 만든 `<userData>/background-outputs` 파일은 남는다. 배포본에는 없다(v0.3.1 태그에 그 코드 없음).
  3. 옛 이름 폴더와 신버전이 만든 새 폴더가 둘 다 있는 상태 — 앱은 새 폴더만 쓴다. 합치지 않는다(D-003).
  4. AC2의 순서 단언은 소스 텍스트다. 단계 본문이 실행 시 같은 순서로 도는지는 `bootstrap.harness.test.ts:156`과 AC16 실기가 본다.
  5. `outputRefs`·`canReadOutputFile`은 읽는 곳 없이 작업 기록에 남는다(D-012).
- 열린 입력 집합을 판정하는 산출물: 해당 없음 — 새 검사기를 만들지 않는다. 이름 검사기는 기존 fail-closed 그대로다.
- 같은 규칙이 여러 레이어에 있는가: `sessionListening` 한 곳. `activityLabel`·`sendAdmission`은 계산된 boolean을 인자로 받는다(파생하지 않는다).
- `실패 의미`에 "typecheck가 막는다"를 적은 EP-05: 필드 삭제 뒤 남은 쓰기는 객체 리터럴 초과 속성 오류다 — 구현 턴의 typecheck 3종으로 확인한다. 측정 전이라 닫힘의 근거로 쓰지 않고 EP-05 음성 검색이 좌표다.
- 선택적 필드의 의미: 해당 없음 — 새 optional 필드 없음. `dispose`의 옵션 인자를 지운다.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

커밋 단위는 셋이다(D-011): **M1** 이관 제거(AC1~AC6) · **M2** 출력 읽기·보존 제거(AC8~AC12) · **M3** `listening` 파생(AC13).

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `main/index.ts` | 진입점 | `runStartupSequence` 블록·이관 로그 3루프·`Bootstrap` 2번째 인자 삭제. `const rootLog = initLog()` | `product-identity.test.ts` 소스 단언 |
| `main/app/bootstrap.ts` | 조립 루트 | 생성자 인자·단계 2개·import 3줄 삭제. `background.dispose(sessionId)` | 같은 테스트 · `bootstrap.harness.test.ts` |
| `infra/config/paths.ts` · `shared/product.ts` | 경로·이름 | 레거시 함수 2개·상수 1개·관련 주석 삭제 | — |
| `infra/db/index.ts` · `infra/git/worktree.ts` | DB·git | `getDbConnection` · `repairWorktree` 삭제 | `git-execution.test.ts` |
| `shared/app-error.ts` · i18n `ko.ts`·`en.ts` | 오류 제목 | `legacyMigrationFailed` 삭제 | 등록·대칭 테스트 |
| `product-identity.test.ts` | 식별자 계약 | 7케이스 삭제 · 신규 5케이스(VP-01 ①②③ · VP-04 ④⑤) · `OLD`를 `PRODUCT_SLUG.split('-')[1]`로 | — |
| `scripts/check-product-naming.{mjs,test.mjs}` | 이름 검사기 | `ALLOWED` 6행 삭제·3행 개수 갱신 · 고정 집합 케이스 갱신 · 쓰이지 않게 된 `LEGACY_INPUT` 상수 정리 | `node --test` |
| `features/chat/background-controller.ts` | 컨트롤러 | `read`·`captureCompleted`·`outputDenied`·`captures`·`roots`·`outputs` 삭제. `dispose(sessionId)` | 컨트롤러 테스트 |
| `app/chat-turn/background.ts` | 채널 등록 | store 조립·`roots`·`outputs`·읽기 채널 등록 삭제 | 신규 채널 집합 케이스 |
| `shared/background-task.ts` · `ipc.ts` · `protocol.ts` | 계약 | output 변형·스냅샷/커서/읽기 타입·기록 필드 2개·채널 상수·스키마 삭제 | `background-task.test.ts` |
| `preload/index.ts` · `renderer/src/shared/api/ipc.ts` | API 표면 | `readBackgroundOutput` 삭제 | typecheck |
| `renderer chatReducer.ts` | 대화 상태 | `listening` 필드·쓰기 6줄 삭제 | `chatReducer.listen.test.ts` — 단언을 `activityTransport`로 |
| `renderer chatStore.ts` | 파생·소비 | `sessionListening` 신설 · 읽기 7자리를 그 함수로 · `sessionBusy`의 `Pick`을 `'inflight' \| 'activityTransport'`로 · selector view의 `listening`은 파생값 | `chatStore.listen.test.ts` 외 |
| 문서 6종 | §6 범위 | EP-03·EP-06 자리 · `generated/inventory.md` 재생성 | 게이트 |

### 테스트 가능성

- 별도 순수 파일: 필요 없다 — `sessionListening`은 `chatStore.ts`의 기존 순수 술어(`sessionBusy`) 옆에 두고 같은 테스트 파일이 import한다.
- 기존 메커니즘 재사용: `product-identity.test.ts`의 `walk`·`PROD_SOURCE`·`read` 헬퍼를 신규 케이스가 그대로 쓴다.
- 순서 관측: AC2는 `indexOf` 순서 비교다(기존 "이관 배선" 케이스와 같은 방식).
- 테스트 fixture의 `listening: true`(상태 입력)는 `activityTransport: 'ready'`로 옮긴다 — `listening` 단독 true는 "점유 중이지만 응답 중은 아님"이고 그것이 `ready`다.

## 12. End-to-end 영향

### producer → consumer

```text
main SessionActivityProjector → chat:event(chat.activity.transport) → chatReducer.activityTransport → sessionListening → 소비 4곳
adapter → BackgroundEvent(task·call·snapshot·control·connection) → journal → reduceBackground → renderer 패널
```

- producer 기준: 변경 없음 — `transport`는 main이 낸다(`shared/ipc.ts:1691`).
- consumer 파생 규칙: `!== 'idle'` 한 식.
- 파생 가능한 합성값이 정본을 우회하지 않는가: selector view의 `listening`은 매 렌더 파생이고 저장하지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| 부팅 보고(`boot:report`)의 단계 목록 | 단계 2개가 준다. renderer는 목록을 그대로 그린다 — 단계 이름을 하드코딩한 소비처 0(`rg -n "legacy-migration\|legacy-paths" app/src/renderer` → 0) | AC2 · AC16 |
| `Bootstrap` 생성자 호출 | `index.ts:297` 하나 + 테스트 | AC1 |
| background 채널 등록 집합 | 1개가 준다 | AC8 · AC12(inventory) |
| `BackgroundController` 생성 | `background.ts:20` 하나 + 테스트 조립 | AC8 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 진입점은 `initLog()`가 던지면 지금처럼 부팅이 죽는다 — `runStartupSequence`의 try는 이관만 감쌌다(`startup-sequence.ts:25-33`).
- 취소/중단: `CANCEL_CHAT`이 `activityTransport:'idle'`을 쓰므로 파생값이 즉시 false다.
- 종료/quit/crash: 변화 없음.
- retry/timeout/partial failure: 캡처 실패 경로("출력을 보존하지 못했습니다")가 사라진다.
- cleanup/rollback: 세션 정리는 타이머 해제와 disposed 표시만 남는다.
- **다중 저장소 쓰기**: 제거 대상이 바로 그 형태였다 — 캡처는 파일을 쓴 뒤 journal에 썼고, journal 실패 때 파일을 지웠다(`background-controller.ts:284-289`). 제거 뒤 해당 없음. 산출 문서의 판정 사본은 `plan.md` 메타 · `INDEX.md` 행 둘이다.

## 14. 성능 / 상한 / 최적화

- 새 출력·요청: 없음. 부팅에서 fs 존재 확인 약 20회와 DB 전수 조회 2건이 준다. 터미널 작업마다 최대 16MiB 파일 복사가 준다(`background-output.ts:14`).
- 구조적 목표: prod 순감(AC14). 단계 지도 — M1 약 −560(파일 4개 445 + 배선 약 115) · M2 약 −400(저장소 197 + 컨트롤러 약 110 + 계약·등록 약 90) · M3 약 −5. 추정이라 AC는 부호만 요구한다.
- 덜 하면서 잃는 부수 효과: 끝난 작업의 출력 사본(읽는 화면 없음) · 옛 폴더 자동 이관(D-002). 둘 다 사용자가 고른 결과다.

## 15. 외부 구현 포트 / 문서 계약

- 외부가 구현할 port/schema: 없음. preload API에서 메서드 1개가 준다 — 포크 호환 표면 주석이 없는 자리다(`rg -n "외부 import\|배포 소스" app/src/preload` → 0).
- 운영 문서(`release-operations.md`)의 절차는 shape 검증 대상이 아니다. semantics는 AC7 실기다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0292 D-010 "0225 이관 코드를 유지한다" | 0292 plan §3 | D-002 | 변경 — 사용자 결정 |
| 0225 D-010 "전환 후 옛 경로를 자동 fallback으로 쓰지 않는다" | `paths.ts:44` 주석 · `product-identity.test.ts` EP-05 | AC1 | 유지·강화 — 옛 경로를 조립하는 코드 자체가 없다 |
| 0225 D-017 멱등 · D-018 2등급 실패 | `migrate-legacy.ts:8-13` | §9 Delta "부팅 단계" | 소멸 — 대상 코드와 함께 |
| 0225 D-013 "구버전 자동 제거는 하지 않는다" | `release-operations.md:81` | §5 절차 5 | 유지 |
| 0225 D-016 `productName` 키 없음 | `product.ts:9` | 건드리지 않음 | 유지 |
| 0306 D-005 "이관의 입력은 옛 이름을 쓴다"(허용 목록) | `check-product-naming.mjs:49` | AC6 | 변경 — 입력이 사라져 허용 항목 6행 삭제 |
| 0231 "main·preload API를 남긴다"(출력 읽기) | `background-tasks.md:25` | AC8 | 변경 — 사용자 결정(D-004) |
| 0265 EP12 "대화 목록 제거는 보관한 출력 파일을 유지한다" | `background-tasks.md:43` · `bootstrap.ts:1292` | AC11 | 소멸 — 보관 자체가 없다. journal 유지는 그대로 |
| 0167 AC6 "`listening`은 transport에서만 파생한다" | `chatReducer.ts:1247` 주석 | AC13 | 유지·강화 — 파생을 필드가 아니라 함수로 |
| 0143 "`inflight`는 라이브 경로에서 renderer 소유" | `chatReducer.ts:1251` | 건드리지 않음 | 유지 |
| `docs/AGENTS.md` 작성 규칙 4 "`arch/`에 이력을 쓰지 않는다" | docs/AGENTS.md | AC5·AC12 | 준수 — 삭제 사실을 적지 않고 현재 상태만 남긴다 |
| `docs/AGENTS.md` 규칙 6 "채널을 바꾸면 `IPC_CONTRACT.md`를 같은 PR에서" | docs/AGENTS.md | AC12 | 준수 |
| 마이그레이션 append-only | `check-migrations-appendonly.mjs` | 건드리지 않음 — `0027_background_events.sql` 그대로 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| v0.3.1 사용자가 문서를 읽지 않고 올리면 빈 앱을 본다 | 사용자 결정(D-002). 옛 폴더를 건드리지 않으므로 나중에 절차를 따라도 된다 |
| 수동 절차가 실기에서 어긋난다(암호화 저장소·내장 스킬 마커) | AC7 실기. 어긋나면 문서만 고치는 ΔV |
| 삭제한 `product-identity` 케이스가 다른 것도 잠그고 있었다 | 7케이스의 단언을 §8에 줄 번호로 고정했다 — 전부 이관 심볼 문자열이다 |
| `listening` fixture 이동에서 `ready`/`listening` 선택이 틀린다 | §11 규칙(단독 true → `ready`) · VP-10 변이 (h) |
| 테스트 순증(AC14) | 삭제 738줄이 상한을 준다. 순증이면 보고 |

- 되돌리기 어려운 결정: 자동 이관 제거(D-002) — 이 변경이 실린 릴리스가 나가면 그 릴리스로 올라온 사용자에게 자동 이관을 다시 줄 수 없다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/{index.ts,product-identity.test.ts,error-report.registry.test.ts}` · `app/src/main/app/{bootstrap.ts,legacy-paths*.ts,git-execution.test.ts,bootstrap.*.test.ts}` · `app/src/main/app/chat-turn/background*.ts` · `app/src/main/app/handlers/session.delete.native-history.test.ts`
- `app/src/main/infra/{config/{paths,migrate-legacy*,rebase-path*,startup-sequence*}.ts,db/index.ts,git/worktree.ts,background-output*.ts}` · `app/src/main/features/chat/background-controller*.ts`
- `app/src/shared/{product,app-error,background-task,ipc,protocol}.ts` · `app/src/preload/index.ts`
- `app/src/renderer/src/{shared/api/ipc.ts,shared/i18n/resources/{ko,en}.ts,features/chat/{reducer/chatReducer.ts,store/chatStore.ts}}`와 §10 EP-05·EP-07의 테스트
- `app/scripts/check-product-naming.{mjs,test.mjs}`
- `docs/{TRD.md,IPC_CONTRACT.md,guides/release-operations.md,arch/backend/{overview,background-tasks}.md,generated/inventory.md}`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` — better-sqlite3 ABI · 제약 환경 게이트 가이드, CI 표.
- 환경 제약: 설계 환경에는 `app/node_modules`가 없었다. 구현 환경에서 `npm ci`가 egress로 막히면 그 사실과 서명을 적는다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 가드 스크립트: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs`.
- 테스트: 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"`. 기준선은 0307 r2의 실패 22건(Windows 경로 환경, 9파일)이고 차집합으로 분리한다.
- 사람 실기:
  - AC7 — v0.3.1을 쓰던 Windows 계정에서 (a) 신버전을 그냥 실행 → 빈 앱 · `%APPDATA%\orca` 그대로 (b) §5 절차 수행 → 대화 목록·설정·로그인 상태·기존 대화 열기.
  - AC16 — 개발 빌드 부팅, Claude 백그라운드 셸 실행·완료·개별 중단, 응답 중 입력 예약·중단.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001~D-014, 0292 D-010·0307 D-011 대체 관계 기입.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다 — §5 상태 표 7행 + 수동 절차 5단계.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — §2에 선택지 설명 원문 인용.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 표 7행 ↔ AC1·AC7·AC9·AC8·AC13.
- [x] AS-IS와 TO-BE가 같은 축으로 있다 — §9 흐름도 2개 · Delta 9행.
- [x] Delta의 각 변경이 구현 파일 또는 AC에 추적된다 — Delta 마지막 열.
- [x] AS-IS에서 사라진 책임은 삭제임을 명시했다 — Delta "부팅 단계"·"백그라운드 의존성".
- [x] 수치·전칭 표현·기존 테스트 인용을 실측했다 — §8 검산.
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — §7 16행.
- [x] Baseline V다 — 상속 기준 없음.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — R↔AT 10쌍, AR-01~03·MD-01~02는 VP-01·05·07·10에 귀속.
- [x] 영향받은 INHERITED node 없음 · REGRESSION은 VP-08.
- [x] 각 pair가 경로·§10 분모·자리별 좌표를 갖고 적대 증거는 VP-01·04·05·10만 선택했다.
- [x] 규칙 칸 분기마다 입력이 있다 — §10 규칙 표 7행.
- [x] 선언 경계 5건을 측정 근거와 함께 적었다. 새 검사기 없음.
- [x] INDEX 후보 표의 겹치는 행을 확인했다 — 겹침 0(§8).
- [x] 운영 gate 5행을 열거했다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — AC7의 문서 부분은 AC5, AC16의 판정 부분은 AC13.
- [x] semantic 목표를 structural proxy만으로 검증하지 않는다 — AC2에 적대 증거 4개와 실행 테스트 1건.
- [x] "X가 쓰인다" 불변식: `sessionListening`은 맞바꿈 변이 (h)와 소비 자리 변이 (i)(j)로 잠근다.
- [x] 신규 계약 `sessionListening`의 SSOT·강제 지점·seam이 있다.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 4행.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12.
- [x] one-way door를 적었다 — §6 표 3행 · §17.
- [x] 게이트 명령이 `app/AGENTS.md`와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> 필드와 표의 열은 [`plan.template.md`](../../../.agents/skills/handoff-plan/plan.template.md)의 `[구현자 기입]` 절을 그대로 쓴다.

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: M1 → M2 → M3 순서, 단계마다 커밋했다. D-001~D-014와 충돌하는 구현 없음.
- 이견 / 현실성 문제: §19 "설계 환경에 `node_modules` 없음"은 구현 환경에서 해소했다 — `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`(Node ABI)로 DB 스위트까지 실행했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01·VP-03 | EP-01 이관 심볼 부재 | 19파일 | 19/19 | EP-01 `rg -c …` → 출력 0줄(목록과 차집합 0) · `product-identity.test.ts:"prod 소스에 이관 심볼이 없다 (음성 스윕)"` · `"진입점이 로깅을 첫 배선으로 초기화한다…"` · `"부팅 단계가 DB 초기화 → …"` · `git-execution.test.ts:"prepares without baseRef in four executions…"` | 운반 항 없음(삭제). 변이 a~d가 red | — |
| VP-02 | EP-02 오류 제목 부재 | 6파일 7줄 | 7/7 | `rg -c legacyMigrationFailed app/src` → 0줄 · `error-report.registry.test.ts:"detects removed report M1…"` 외 전건 · `i18n/resources/resources.test.ts` green | 운반 항 없음(삭제) | — |
| VP-04 | EP-03 문서 | 6자리 | 6/6 | EP-03 `rg -n …` → 0줄 · `product-identity.test.ts:"자동 이관을 약속하지 않고 수동 이전 절을 갖는다 (0308 AC5)"` · `"수동 이전이 옛 이름 → 새 이름 대응 7개를 적는다…"` | 대응 7개(옛 → 새 파일명 문자열) · 변이 e·f·f2 red | — |
| VP-04 | EP-04 이름 검사기 | 9행 | 9/9 | `gate:node scripts/check-product-naming.mjs` → `OK — 2226파일 · 허용 7항목` · `check-product-naming.test.mjs` 40 pass | 문서 개수 lower 7→19 · 4→1 | — |
| VP-05~VP-08 | EP-05 출력 읽기·보존 부재 | 18파일 | 18/18 | EP-05 `rg -c …` → 2줄: `background-task.test.ts`(VP-07 입력) · `background.integration.test.ts`(부재 단언 — 아래 차이) · 좌표는 아래 V-pair 표 | 운반 항 없음(삭제) | — |
| VP-09 | EP-06 문서 | 8자리 | 8/8 | EP-06 `rg -n …` → 0줄 · `gate:node scripts/check-doc-inventory.mjs --check` → `generated doc ok (9 items, 113 channels)` | 해당 없음 | — |
| VP-10 | EP-07 `listening` 필드 | 14자리 | 14/14 | EP-07 명령 → 9줄 = 유지 6 + 파생 호출 2(`chatStore.ts:1122`·`:2336`) + 타입 1(`:2323`). 필드 자리 14는 0 | `activityTransport`(idle·ready·listening) → 점유·응답 중 boolean · `chatStore.listen.test.ts:"transport %s → 점유 %s · 응답 중 %s"` | — |

- §10 자리 목록 밖에서 본 운반 자리:
  - `app/AGENTS.md:158`이 `LEGACY_PRODUCT_SLUG`와 "0225 이관의 입력"을 지침으로 적고 있었다 — EP-01 범위(`app/src app/scripts`) 밖이다. 분류: 구현 세부(낡은 지침) → 선조치.
  - `check-product-naming.mjs:8` 주석의 같은 문구 → 선조치.
- 직전 verify 고장 이력의 `못 잡음` 행: 없음(verify 0회).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `product-identity.test.ts` 신규 3건 | required — a·b·c·d 전부 red |
| VP-02 | REQUIRED | SELF_PASS | `error-report.registry.test.ts` 등록 전건 · `resources.test.ts` | not selected |
| VP-03 | REQUIRED | SELF_PASS | `git-execution.test.ts:"prepares without baseRef…"` — generation 1 → 3 | not selected |
| VP-04 | REQUIRED | SELF_PASS | `product-identity.test.ts` 운영 문서 신규 2건 · `check-product-naming.test.mjs:"마이그레이션 SQL 1 + …"` | required — e·f red (+ f2) |
| VP-05 | REQUIRED | SELF_PASS | `background-controller.test.ts` 5건 · `background.channels.test.ts:"상태 조회·개별 중단·전환 채널만 등록한다"` | required — g red |
| VP-06 | REQUIRED | SELF_PASS | `background-controller.test.ts:"records a finished task with a file output reference without copying or journaling its output"` | not selected (sweep k red) |
| VP-07 | REQUIRED | SELF_PASS | `background-task.test.ts:"stop ACK and a legacy journal output event do not change completed result"` | not selected (sweep p red) |
| VP-08 | REGRESSION | SELF_PASS | `session.delete.native-history.test.ts` — journal·parts·binding 단언 green(SQLite 로드 상태에서 실행) | not selected |
| VP-09 | REQUIRED | SELF_PASS | `gate:check-doc-inventory.mjs --check` | not selected |
| VP-10 | REQUIRED | SELF_PASS | `chatStore.listen.test.ts` 3분기 · `"ready 점유 중 예약한 전송이 거절되면…"` · `chatStore.sessionDirectory.test.ts` `it.each` · `statusLine.waitPhase.test.ts:"derives the waiting label from the transport…"` | required — h·i·j red |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

하네스: `mutate.py` — spec 17행, 실행 뒤 원복 확인.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| a `paths.ts` — `legacyConfigDir` 함수 되살림 | VP-01 선택 증거 | 최초 | product-identity 1 | 잠김 |
| b `index.ts` — `initLog()`를 `installErrorReportSink()` 뒤로 | VP-01 선택 증거 | 최초 | 1 | 잠김 |
| c `bootstrap.ts` — `db-init` critical → false | VP-01 선택 증거 | 최초 | 1 | 잠김 |
| d `bootstrap.ts` — `chat-recovery` 단계 이름 변경(부재) | VP-01 선택 증거(순서 변이의 재앵커 — 단계 본문을 옮기는 대신 표식을 없앰) | 최초 | 1 | 잠김 |
| e `release-operations.md` — 수동 이전 표제 제거 | VP-04 선택 증거 | 최초 | 1 | 잠김 |
| f 같은 문서 — store 대응 1개 제거 | VP-04 선택 증거 | 최초 | 1 | 잠김 |
| f2 같은 문서 — 자동 이관 문장 되살림 | 새 oracle 민감도 | 최초 | 1 | 잠김 |
| g `background.ts` — 중단 채널 등록 제거 | VP-05 선택 증거 | 최초 | background.channels 1 | 잠김 |
| k `background-controller.ts` — `publish` 호출 제거 | sweep — VP-06 path edge | 최초 | 2 | 잠김 |
| l 같은 파일 — `disposed.add` 제거 | sweep — VP-08 path edge | 최초 | 1 | 잠김 |
| p `background-task.ts` — 모르는 type에서 기록 변경 | sweep — 규칙 칸 "모르는 type" | 최초 | 1 | 잠김 |
| h `chatStore.ts` — `sessionListening`을 `=== 'listening'`으로 | VP-10 선택 증거(형제 맞바꿈) | 최초 | 6 | 잠김 |
| i 같은 파일 — 폴더 가드의 점유 항 제거 | VP-10 선택 증거 · EP-07 `:1206` | 최초 | 1 | 잠김 |
| j 같은 파일 — selector 파생을 `false` 고정 | VP-10 선택 증거 · EP-07 `:2333` | 최초 | 1 | 잠김 |
| m 같은 파일 — 예약 판정 인자를 `false` 고정 | sweep — EP-07 `:1122` | 최초 | 5 | 잠김 |
| n 같은 파일 — `busy`를 `cur.inflight`로 | sweep — EP-07 `:1116` | 최초 | 처음 green → 테스트 추가 뒤 1 | **잠금 없음 → 테스트 추가** → 잠김 |
| o `chatReducer.ts` — `CANCEL_CHAT`의 transport 초기화 제거 | sweep — EP-07 `:1420` | 최초 | 2 | 잠김 |

- **분모 검산**: `선택 증거 10(a·b·c·d·e·f·g·h·i·j) · 인용 변이 0 · 새 oracle 1(f2) · sweep 6(k·l·p·m·n·o) = 표 행 17`.
- sweep에서 변이를 심지 않은 열거 항목: EP-01·EP-02·EP-05의 삭제 자리(지울 코드가 남아 있지 않다 — 부재는 검색 0줄과 변이 a가 본다) · EP-07 쓰기 자리 `:517`·`:1256`·`:1271`·`:1556`·`:1572`(필드와 함께 삭제됨).
- **덮개 회귀**: 해당 없음 — 이전 라운드 없음. 삭제한 테스트가 잠그던 것은 삭제한 코드뿐이다(`legacy-paths`·`migrate-legacy`·`rebase-path`·`startup-sequence`·`background-output` 5파일과 컨트롤러 캡처 3케이스).

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 문구는 운영 문서의 수동 이전 절뿐이다. 앱 문구는 2개 삭제(ko·en 오류 제목) | — |
| seam을 만들려고 production을 재배치했는가 | 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 실패 경로 없음. "옛 이름 폴더만 있다" 행이 유일한 새 결과다 | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | **보인다** — v0.3.1에서 올라온 사용자는 안내 없이 빈 앱을 본다. 앱 안에는 옛 폴더가 있다는 표시가 없다 | D-002·D-003의 결과. 앱 안 안내는 범위 밖 — 사용자 판단용으로 적는다 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — `activityRevision` 비교는 그대로다(`chatReducer.ts` `chat.activity`) | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `send`의 `busy`(EP-07 `:1116`)를 `inflight`만으로 바꿔도 전 스위트 green이었다 — 변경 전 코드에서도 같은 공백이다 | ✅ 선조치 — `chatStore.listen.test.ts:"ready 점유 중 예약한 전송이 거절되면…"` 추가 | 변이 n: green → red |
| 2 | `error-report.registry.test.ts`의 `slots` 서수 표가 삭제 2건 뒤 밀린다(§10에 없던 세부) | ✅ 선조치 — `M1:0·M2:1·M10:3` | 등록 테스트 전건 green |
| 3 | `BackgroundController.dispose`가 부르던 `this.state(sessionId)`(journal → tracker 복원)를 지웠다 — 스냅샷 삭제용 읽기였다 | ✅ 선조치 | prod 호출부 `bootstrap.ts`가 바로 뒤에 `backgroundTasks.dispose`를 부른다 · `bootstrap.native-history.test.ts` green |
| 4 | `app/AGENTS.md:158`의 낡은 지침 2문구 | ✅ 선조치 | `rg LEGACY_PRODUCT_SLUG app` → 0 |
| 5 | 수동 이전 절차가 실기 미검증이다(암호화 저장소·내장 스킬 마커) | ⚠️ 보고만 — AC7 | plan D-013 |
| 6 | 개발 빌드의 `<userData>/background-outputs` 잔존 파일 | ⚠️ 보고만 — 선언 경계 2 | — |

### 설계 대비 명시적 차이

- VP-01 ②의 `new Bootstrap(` 단언을 "인자 1개" 정규식으로 더했다(plan은 `initLog` 순서만 적었다) — 생성자 인자 삭제를 직접 본다.
- EP-05 "구현 뒤 1곳만 남는다" ↔ 실제 2곳: `background.integration.test.ts`에 실제 mapper·DB 경로로 `background.output`이 journal에 없음을 단언하는 줄을 남겼다. AC9의 통합 경로 oracle이다.
- VP-10 `ready` 분기 좌표를 기존 케이스 수정 대신 `it.each` 3행으로 새로 만들었다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 캐시·시간 값 없음 | — |
| 공유 | 해당 없음 — 새 공유 상태 없음. `sessionListening`은 순수 함수 | AC13 3분기 |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `git diff --stat <설계 커밋>..HEAD` — M1 28파일(+117 −1307) · M2 25파일(+128 −905) · M3 9파일 |
| 실행 명령 | `check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` · `npm run lint` · `npm run typecheck` · 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` |
| **관측한 게이트 산출** | 가드 4종 OK(`append-only ok` · `113 channels` · `허용 7항목` · `19 real-git suites ok`) · lint 0 error·2 warning(기존 `react-hooks/incompatible-library`) · typecheck 3구성 오류 0 · vitest 942파일·8800케이스 중 8767 pass·22 fail · `node --test` 868 pass·0 fail |
| 기준선 분리 | 변경 전 트리(`11a3594`)를 같은 환경·같은 `node_modules`로 실행: 946파일·8839케이스·22 fail. 실패 케이스 집합의 차집합(head − base) = ∅, 실패 파일 29 = 29(차집합 ∅). 원인은 electron 바이너리 부재(`Electron failed to install correctly`) 등 환경이다 |
| **추가·수정 테스트의 subtree 규칙** | 추가·수정 테스트 24파일 · `check-test-budgets` OK · 전체 실행에서 `[test-pools]` 가드 실패 0(새 실패 0) · 새 타이머·git·자식 프로세스 없음 |
| V-pair 자기확인 | `SELF_PASS 10 / SELF_BLOCKED 0` |
| 강제 지점 전수 | 81/81 자리(19 + 7 + 6 + 9 + 18 + 8 + 14) |
| **AC 자기보고** | AC1 ✅ EP-01 0줄 · 신규 2건 green / AC2 ✅ 순서 케이스 green(변이 c·d red). `bootstrap.harness.test.ts`는 electron 부재로 이 환경에서 실행 불가(기준선도 같음) / AC3 ✅ EP-02 0줄 / AC4 ✅ generation 3 / AC5 ✅ 문서 케이스 2건 · EP-03 0줄 / AC6 ✅ 검사기 OK / AC7 ⚠️ 사람 실기 / AC8 ✅ 컨트롤러 5건 + 채널 집합 / AC9 ✅ 신규 케이스 / AC10 ✅ 과거 이벤트 케이스 / AC11 ✅ session.delete 케이스 / AC12 ✅ EP-06 0줄 · inventory OK / AC13 ✅ 3분기 + 소비 4곳 / AC14 ✅ `git diff --numstat 11a3594..HEAD -- app/src`: prod +27 −1025(순 −998) · test +248 −1161(순 −913) / AC15 ✅ 위 게이트 / AC16 ⚠️ 사람 실기 |
| **합계 검산** | `✅ 14 · ⚠️ 2 · ❌ 0 = 총 16` |
| 블로커 / 역질문 | 없음. 사용자 판단 대기: D-012(`outputRefs` 유지) · D-013(수동 절차 형태) · 앱 안 안내 부재(Product/UX 표 4행) |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음(r1).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 변이 n의 공백은 plan VP-10 소비 ①이 "전송 케이스에 `ready` 입력"을 적었으나 기존 `ready` 전송 케이스가 `busy` 항을 구별하지 않았다 — sweep이 찾았다.
- 반복해서 부딪히는 환경 한계: electron 바이너리 부재로 `Bootstrap` 실행 테스트 불가(실패 29파일 중 다수).
- 현재 라운드·impl 턴: `r1`.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
