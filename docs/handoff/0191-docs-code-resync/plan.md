# Plan — 0191-docs-code-resync

## 메타

| 항목 | 값 |
|---|---|
| slug | `0191-docs-code-resync` |
| 작성자 | Claude Code |
| 일자 | 2026-08-18 |
| 매핑 | — (문서 전용) |
| 상태 | READY → IMPL_DONE (r1) → verify/FAIL (r1) → IMPL_DONE (r2) → verify/FAIL (r2) → IMPL_DONE (r3) → verify/FAIL (r3) → IMPL_DONE (r4) → **verify/FAIL (r4)** |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: `docs/` 가 `04e101d`(2026-08-14) 이후 전면 동기화되지 않아, 코드 18커밋(`app/src` 143파일 · +9,441/−3,755)과 갈렸다.
- 완료 후 달라지는 것: 문서를 읽는 에이전트·사람이 **존재하지 않는 파일로 안내받지 않고**, `guides/` 절차를 적힌 그대로 실행해 통과한다.
- 성공을 사용자 관점에서 한 문장으로: 새 세션이 `docs/INDEX.md` 로 들어와 어떤 문서를 열어도 지금 코드와 같은 말을 한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "변경된 코드베이스에 맞춰 `./docs` 경로의 문서들과 `./app` 경로의 agents.md를 업데이트하라" | 라이브 세션 |
| 명시 요구 | "docs/guides 도 업데이트돼야 함" | 라이브 세션 (후속 턴) |
| 명시 요구 | "변경된 코드베이스에 맞춰 가이드 또한 변경돼야한다. **보고 따라할 수 있도록.**" | 라이브 세션 (후속 턴) |
| 명시 요구 | AskUserQuestion·ExitPlanMode 에서 장황한 설명 금지, 간결한 배경/원인/제안 | 라이브 세션 |
| 추론 의도 | "업데이트" = 코드를 문서에 맞추는 것이 아니라 **문서를 현재 코드에 맞추는 것** — 요구 문구가 "변경된 코드베이스에 맞춰" 이므로 코드가 진실 | 사용자 문장 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 범위 = `docs/` 전수 + `app` 하위 `AGENTS.md` 전부 | 사용자가 3선택지 중 "docs/ 전수 + app 하위 AGENTS.md 전부" 선택 | 사용자 턴 | ACTIVE | — |
| D-002 | `provider-runtime.md` 는 **경로·상태 문구만 정정**한다. 구조 재편·문서 분리 금지 | 사용자가 "경로·상태 문구만 정정 (권장)" 선택 | 사용자 턴 | ACTIVE | — |
| D-003 | 폐기가 명시된 절은 **삭제하고 ADR 링크만 남긴다** | 사용자가 "삭제하고 ADR 링크만 남긴다 (권장)" 선택. `docs/AGENTS.md` 작성규칙 4와 정합 | 사용자 턴 | ACTIVE | — |
| D-004 | `docs/guides/` 를 범위에 포함한다 | 사용자 후속 턴 "docs/guides 도 업데이트돼야 함" | 사용자 턴 | ACTIVE | — |
| D-005 | guides 는 참조 정정에 그치지 않고 **"보고 따라할 수 있도록"** 고친다 — 고친 뒤 문서에 적힌 명령을 실제로 실행해 통과를 확인한다 | 사용자 후속 턴 원문: "변경된 코드베이스에 맞춰 가이드 또한 변경돼야한다. 보고 따라할 수 있도록." | 사용자 턴 | ACTIVE | — |
| D-006 | PRD §11 `OQ9` 는 이번에 닫지 않는다 | root `AGENTS.md` 원칙 2 — Open Questions 단독 결정 금지. 코드상 구현됐다는 관측만 보고한다 | 저장소 규칙 | OPEN | — |
| D-007 | 루트 `AGENTS.md` 의 `src/shared/i18n/ko.ts` 오기는 이번에 고치지 않는다 | D-001 이 정한 범위(`docs/` + `app` 하위) 밖. 보고에만 남긴다 | D-001 파생 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-007 (첫 plan).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 없음(신규 handoff).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-002("경로·상태 문구만") ↔ AC3(`provider-runtime.md` 경로 11건 정정, 절 구조 불변) → 정합. D-003("삭제 + ADR 링크") ↔ AC6 → 정합. D-005("따라할 수 있도록") ↔ AC7·AC8(문서 명령 실제 실행) → 정합. D-006(OQ9 미결) ↔ AC 없음 — PRD 를 AC 대상에서 제외했다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 드리프트가 4갈래로 실측됨(§8). 증상=개별 오기, 원인=전면 동기화 이후 14일 누적 |
| 이미 기존 코드가 충족하는가 | 부분 충족 | `check-doc-inventory.mjs` 가 **수치·prose·링크**를 이미 강제하고 현재 통과한다. 그것이 못 잡는 축(경로 실재·상태 표기·절차 실행성)만 남았다 |
| 더 작은 해법이 있는가 | 아니오 | 4축이 서로 다른 파일에 흩어져 있어 한 파일만 고쳐 닫히지 않는다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 | `closed-network-extensions.md` 식별자 125개를 `app/src` 전수 대조 → 부재 1개(명시적 폐기어) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 없음 | `docs/AGENTS.md` 작성규칙 2·4 를 따르는 방향이 곧 이번 수정 방향 |

- 사용자에게 올릴 결정: **PRD §11 OQ9** — 코드는 구현됐으나 PRD 는 열려 있다(D-006).
- 코드 조사로 닫은 사실: 나머지 전부(§8).

## 5. 동작 / 사용자 흐름

```text
[에이전트/배포자가 docs/INDEX.md 로 진입]
  → [라우팅 표에서 문서를 고른다]
  → [문서가 가리키는 코드 경로가 실재하고, 상태 표기가 코드와 같다]
  ↘ [guides 라면: 적힌 명령을 그대로 실행 → 문서가 적은 통과 기준이 실제로 나온다]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 폐쇄망 배포자가 `closed-network-extensions.md` §8.1 을 따라 회귀 테스트를 돌린다 | 나열된 파일이 전부 실재한다 | 명령이 "file not found" 없이 끝난다 |
| 배포자가 §8.2 1번을 따라 선언 파일을 연다 | `app/deployment/auth-definitions.ts` 로 안내된다 | §1.1 과 같은 파일을 가리킨다(모순 해소) |
| 에이전트가 `arch/backend/overview.md §4` 로 구현 상태를 판단한다 | i18n·permissionMode·정규화 계층이 ✅ 로 읽힌다 | 이미 있는 기능을 다시 만들지 않는다 |

### 파생 UX / 엣지케이스

- error: 문서가 존재하지 않는 경로를 가리키면 독자는 "내 체크아웃이 이상한가" 를 의심한다 — 이 실패는 조용하다. 그래서 §19 의 경로 스윕을 회귀 게이트로 둔다.
- 외부환경/폐쇄망: `guides/closed-network-extensions.md` 는 `app/deployment/*.ts` 주석이 명시적으로 위임한 진입점이다("레시피 정본은 이 문서다", 0190). 여기가 막히면 배포자가 되돌아갈 곳이 없다.

## 6. 범위 / 비범위

- **범위**: `docs/` 전수(아래 비범위 제외) · `app/AGENTS.md` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- **비범위**: `docs/PRD.md`(D-006) · `docs/spec/**`(편집 금지, `docs/AGENTS.md` 규칙 7) · `docs/etc/**`·`docs/archive/**`·`docs/handoff/<과거>`(evidence) · 루트 `AGENTS.md`(D-007) · **코드 변경 0**.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| PRD §11 OQ9 해소 | 아니오 — 문서 상태값일 뿐 | 사용자 결정 대기(D-006) |
| 루트 `AGENTS.md` i18n 경로 | 아니오 — 한 줄 | 보고 후 별건(D-007) |
| `provider-runtime.md` 구조 재편(설계 절 분리) | 아니오 | D-002 로 명시 제외 |

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | 범위 내 문서가 가리키는 `src/**` 파일 경로가 **전부 실재**한다 | §19 경로 스윕 → 출력 **0줄** (현재 20줄) | 에이전트가 문서의 경로를 열어 코드를 찾는 경로 |
| AC2 | 이미 출시된 기능이 `❌ 미구현`·`📐 구현 대기` 로 표기되지 않는다 | A1~A8 각 행이 코드 관측과 일치. 남는 `❌` 는 §8 "유지 확인" 5종뿐 | `arch/*/overview.md` 구현 상태표를 읽는 세션 |
| AC3 | `provider-runtime.md` 의 경로·구현상태 문구가 현재 코드를 가리킨다. **절 구조·설계 내용은 그대로다** | 그 파일 경로 부재 11건 → 0건. 절 제목(`## 1`~`## 13`) 개수 변화 0 | D-002 |
| AC4 | 삭제·이설된 모듈명이 정본으로 인용되지 않는다 | `prepared-config`·`features/login/`·`SkillsPage`·`declarations/{sso,llm,service}` 검색 → 범위 내 0건 | `auth.md` 책임 지도, `layers.md` 트리 |
| AC5 | `app/AGENTS.md` 의 모듈 레이아웃·스크립트 수가 디렉토리 실측과 일치한다 | `app/deployment/`·`respawn-inputs` 가 표에 있고, 스크립트 수는 `ls app/scripts` 실측과 일치 | `app/` 에서 코드를 짜는 세션 |
| AC6 | 폐기 명시 절이 본문에서 사라지고 그 자리에 ADR 링크가 남는다 | `system-prompt.md §2` 부재, `standardization.md` 의 `prompts/policies/*.md` 현행 서술 부재 | D-003 |
| AC7 | `closed-network-extensions.md §8.1` 이 나열한 회귀 테스트가 **전부 실재**하고, §8.1 의 명령 3개가 문서가 적은 통과 기준대로 끝난다 | 각 파일 `ls` 확인 + 세 명령 실제 실행 산출(파일 수·케이스 수·error 수)을 구현 보고에 적는다 | D-005 — 배포자가 §8 을 그대로 실행하는 경로 |
| AC8 | `closed-network-extensions.md §8.2` 1번이 §1.1 과 같은 파일을 가리킨다 | 두 절을 나란히 읽어 지시 대상 파일명이 같음 | 배포자가 선언을 채우는 경로 |
| AC9 | `workspace-isolation-permissions.md` 가 상단에 Orca 구현 정본을 밝히고, 미채택 옵션을 미채택으로 표기한다 | `workspace-guard.ts` 인용 존재 · `disallowedTools` 절에 "넘기는 곳 없음" 표기 | `docs/guides/AGENTS.md` "정본을 상단에 밝힌다" |
| AC10 | `release-operations.md` 의 CI 트리거 서술이 `ci.yml` 과 일치한다 | `pull_request` 트리거 언급 존재 | 릴리스 담당자가 CI 발동 조건을 판단하는 경로 |
| AC11 | `docs/INDEX.md` 라우팅 표에서 `ARCHITECTURE.md`·`arch/frontend/overview.md` 에 도달할 수 있다 | 두 행 존재 | 새 세션의 문서 진입 |
| AC12 | 인벤토리 가드 3종이 계속 통과한다 | `node scripts/check-doc-inventory.mjs --check` exit 0, 3항목 ok | CI (`ci.yml`) |

### AC 검증 주의사항

- 기존 테스트 재사용: 없음 — 문서 전용이라 코드 테스트를 인수 수단으로 쓰지 않는다. 대신 AC7 이 **가이드가 지시하는 명령 자체**를 실행 대상으로 삼는다.
- 사람 실기 항목: §8.2(배포 실기 — 사내 로그인 왕복)는 이 환경에서 실행 불가. 경로·파일명 대조로 갈음하고 그 사실을 구현 보고에 적는다.
- 총량/0건 기준: AC1 의 스윕은 **파일 확장자가 붙은 경로**만 센다 — r2 에서 계측을 3형태(절대형·상대형·맨 파일명)로 넓혔다(§19). 역사·설계어휘·외부·future 인용은 삭제하지 않고 **§19 예외 목록에 사유와 함께 등재**하고 그 목록을 구현 보고에 나열한다(회피가 아니라 선택임을 남긴다).
- **[r2 정정 — 출처: verify r1 §7 재측정]** 아래 AC2 주의사항의 잔여 `❌` 는 r1 plan 이 **5종**으로 적었으나 실측은 **7행**이다. 설계자가 세지 못한 2행은 `options.hooks` 완전 구현(`backend/overview.md:210`)·멀티세션 UI(`frontend/overview.md:81`).
- AC2 의 "남는 `❌`" **7행**: `backend/overview.md` 190(OpencodeAdapter)·201(Artifacts 디렉토리)·210(`options.hooks` 외부 핸들러)·212(Zustand persist — `❌ 미정 OQ`) + `frontend/overview.md` 81(멀티세션 UI)·82(전역 단축키)·83(네트워크 단절 배너) — 각각 코드 구현체 0건으로 참임을 §8 에서 확인했다. 측정면은 `arch/*/overview.md` 구현 상태표다(`persistence.md:18` 의 `❌ 미구현 (Future)` 는 상태표 밖이라 세지 않는다).

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 마지막 전면 문서 동기화 = `04e101d`(2026-08-14). 이후 코드 18커밋 | `git log --oneline 04e101d..HEAD -- app/src` |
| 인벤토리 가드는 현재 통과 — 수치 드리프트 없음 | `node scripts/check-doc-inventory.mjs --check` → `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` |
| `prepared-config.ts` 가 `features/harnesses/` → `adapters/harness-config.ts` 로 이설 | `git diff --name-status 5237d46..HEAD` → `D features/harnesses/prepared-config.ts`; `grep -n "^export" adapters/harness-config.ts` → `PreparedHarnessConfig`·`prepareHarnessConfig` |
| `chat-turn/respawn-inputs.ts` 신설 | `2026a21` |
| `extensions/claude-user-skills-plugin.ts` → `extensions/harness-plugins/claude-user-skills.ts` | `git diff --name-status 5237d46..HEAD` (R095/R099) |
| IPC 채널 커버리지는 드리프트 없음 | `IPC_CONTRACT.md` ↔ `shared/ipc.ts` 차집합: 코드에만 있는 채널 0건. 문서에만 있는 4건은 전부 "예약/제거" 명시 |
| `guides/closed-network-extensions.md` 레시피 본문은 현재 코드와 일치 | 백틱 식별자 125개 전수 대조 → 부재 1개(`acceptedMethods`, 문서가 "인용하지 마라" 로 명시한 폐기어) |
| `app/deployment/*.ts` 가 가이드를 레시피 정본으로 위임 | `auth-definitions.ts` 주석 "레시피 A/B/C 전문은 `docs/guides/closed-network-extensions.md` §2·§3·§4" |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 문서가 인용한 부재 `src/**` 파일 경로 | §19 스윕 (docs 전수 − handoff/archive/etc/spec, + AGENTS 3종) | **20** | AC1 의 분모 |
| ↳ `provider-runtime.md` 몫 | 같은 스윕 | **13** | D-002 범위. **[r2 정정 — 출처: verify r1 §7]** r1 은 11 로 적었다. base 스윕 원본 재집계 = 줄 26·98·143·202×3·217×2·254·274·407·408·525 |
| `📐 구현 대기` 표기 (범위 내) | `grep -rn "구현 대기" docs --include=*.md \| grep -v handoff/archive/etc/spec` | 9 | 이 중 4건이 코드로 반증됨 |
| `❌ 미구현` 상태행 (arch/ 내) | 같은 방식 | 12 | 이 중 4건이 코드로 반증, 5건 유지, 3건 비상태행 |
| `closed-network-extensions.md §8.1` 회귀 테스트 목록 | 각 파일 `ls` | 10 중 **4 부재** | AC7 의 분모 |
| 가이드 백틱 식별자 | `app/src` 전수 `grep -F` | 125 중 1 부재 | 레시피 본문 무결 |
| `disallowedTools` 를 SDK 에 넘기는 지점 | `grep -r disallowedTools app/src` | **0** | AC9 |

### 수치 / 전칭 표현 검산

- 재측정 수치: `app/scripts/*.mjs` 비-test **6개** · `*.test.mjs` **6개** (`app/AGENTS.md` 는 각각 "3종"·"4종"). `app/src/main/infra/db/migrations/` 최종 `0016_turn_model_context_window.sql`(`overview.md` 부트 시퀀스는 "0001~0013").
- 내역 합 = 총계: 경로 부재 20 = provider-runtime **13** + IPC_CONTRACT 2 + TRD 2 + backend/overview 1 + frontend/overview 1 + claude-code-spec 1 = **20** → 스윕 원본 출력 20줄과 일치. **[r2 정정 — 출처: verify r1 §7]** r1 이 적은 내역은 합이 18 이었다(분자 11 을 물려받아 2 가 빈다).
- "유일한/항상/절대" 반례 검색: `app/AGENTS.md` 의 "전역 `fetch(` 를 부를 수 있는 파일은 `infra/net/net-fetch.ts` 하나뿐" — `infra/net/no-node-fetch.test.ts` 가 강제하므로 유지(반례 조사 불필요, 테스트가 잠금).
- 문서 앵커 존재 확인: `decisions/002-feature-slice-boundaries.md` 실재(AC6 의 링크 대상).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

> 코드 변경 0 인 문서 작업이다. "흐름" 은 **독자가 문서를 통해 코드에 도달하는 경로**다.

### AS-IS — 현재 구조와 문제 발생 경로

- 현재 책임 소유자: `docs/INDEX.md`(라우팅) → 각 `arch/*` 문서(사실) → 코드 경로 인용.
- 현재 경로: 독자가 라우팅 표에서 문서를 고르고 → 문서의 `src/**` 인용을 열려 하고 → **20건에서 파일이 없다**. `guides/` 는 한 단계 더 나아가 명령을 실행하는데 **§8.1 의 4건이 없어 목록을 따라갈 수 없고**, §8.2 1번은 §1.1 과 다른 파일을 가리킨다.
- 현재 오류 경로: 실패가 조용하다 — 문서는 여전히 그럴듯하고, 독자는 자기 체크아웃을 의심한다.
- 문제의 직접 원인: 전면 동기화 이후 14일 · 18커밋 동안 `arch/`·`guides/` 가 코드 이동을 따라가지 않았다. 인벤토리 가드는 **수치·prose·링크만** 보고 경로 실재·상태 표기·절차 실행성은 보지 않는다.

```text
docs/INDEX.md → arch/*.md → `src/main/ask/broker.ts`  ✗ 없음
              → guides/closed-network-extensions.md §8.1 → `llm/llm.test.ts`  ✗ 없음
                                                        §8.2 → `declarations/{sso,llm,service}.ts`  ✗ 없음
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 변경 후 책임 소유자: 동일(문서 이동 없음).
- 변경 후 경로: 인용 경로가 전부 실재하고, `guides/` 의 명령이 그대로 실행된다.
- 변경 후 오류 경로: §19 의 경로 스윕이 **회귀 게이트**로 남아 다음 드리프트를 조용하지 않게 만든다.
- 유지하는 메커니즘: `check-doc-inventory.mjs`(수치·prose·링크) 그대로. 제거하는 메커니즘: 없음.

```text
docs/INDEX.md → arch/*.md → app/src/main/features/auth/…  ✓
              → guides/closed-network-extensions.md §8.1 → 실재 테스트 목록 → 명령 3개 통과
                                                        §8.2 → app/deployment/auth-definitions.ts (§1.1 과 동일)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 경로 인용 | 부재 20건 | 0건 | 독자가 코드에 도달하지 못한다 | §11 전 파일 · AC1 |
| 구현 상태 표기 | 출시 기능 8건이 미구현/대기 | 코드와 일치 | 이미 있는 기능을 다시 만들 위험 | `arch/*/overview.md`·`rendering.md`·`ux-domains.md` · AC2 |
| 모듈 책임 서술 | `prepared-config`(feature) 정본 | `adapters/harness-config.ts` | 레이어가 feature→adapters 로 이동 | `auth.md`·`overview.md`·`main/AGENTS.md` · AC4 |
| guides 절차 | §8.1 목록 4건 부재 · §8.2↔§1.1 모순 | 실행 가능 · 자기일관 | D-005 | `closed-network-extensions.md` · AC7·AC8 |
| guides 정본 표기 | `workspace-*` 가 구현을 안 가리킴 | `workspace-guard.ts` 인용 | `guides/AGENTS.md` 규칙 | AC9 |
| 폐기 잔재 | `system-prompt.md §2` 등 본문에 잔존 | 삭제 + ADR 링크 | D-003 · `docs/AGENTS.md` 규칙 4 | AC6 |
| 라우팅 | `ARCHITECTURE.md`·`frontend/overview.md` 미라우팅 | 라우팅됨 | `docs/AGENTS.md` 규칙 5 | AC11 |
| 회귀 관측점 | 없음 | §19 경로 스윕 | 조용한 실패를 막는다 | AC1 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `docs/INDEX.md` | 라우팅만 — 사실 0 | 작업 의도 → 문서 경로 | 새 세션 |
| `docs/arch/**` | 현재 상태 서술 | 코드 → 구조 설명 | 에이전트 |
| `docs/guides/**` | 실행 절차 지시 | 절차 → 명령·체크리스트 | 사람(배포자·릴리스 담당) |
| `app/**/AGENTS.md` | 그 subtree 의 작업 규칙 | — | 코드를 짜는 세션 |
| `generated/inventory.md` | 수치 SSOT (생성물) | 코드 → 개수 | 위 전부가 링크 |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| 수치를 본문에 쓰지 않는다 | `docs/generated/inventory.md` | `check-doc-inventory.mjs` prose 검사 | CI(`ci.yml`) · 로컬 `--check` | 사본이 갈린다 |
| 상대 마크다운 링크가 해석된다 | 파일 시스템 | `check-doc-inventory.mjs` links 검사 | 동일 | 문서 이동 시 파손 |
| **인용한 코드 경로가 실재한다** | 파일 시스템 | **§19 경로 스윕 3형태**(절대형·상대형·맨 파일명) | 구현·검증 턴 | 조용한 오안내. r1 은 절대형만 계측해 상대형·맨 파일명에서 D1~D4 가 살아남았다 |
| **인용한 코드 심볼이 실재한다** | `app/src`·`app/scripts`·`app/package.json`·`.github/workflows` 의 **비주석 코드 줄** | **§19 심볼 스윕 — 추출 4축 · 사이트 단위 전건 분류** | 구현·검증 턴 | 문서가 "이미 구현된 코드다" 로 없는 심볼을 단언한다(D5). **[r3 개정 — 출처: verify r2 §5·§13]** 분모는 심볼이 아니라 **사이트**다. 실재 테스트가 주석 줄을 세면 `ExtensionDeployer` 처럼 주석에만 있는 이름이 통과한다(E1) |
| `guides/` 절차의 명령이 실행된다 | 실제 실행 | 사람/에이전트 | 구현 턴(AC7) | 배포자가 막힌다 |
| `arch/` 는 현재 상태만 서술 | `docs/AGENTS.md` 규칙 4 | 사람 | 편집 시 | changelog 화 |

- 같은 규칙이 여러 레이어에 있다면 SSOT: 수치는 `generated/inventory.md` 단 하나. 본문은 링크만 한다.
- **강제 지점이 여럿인 항목**: "경로 실재" 는 범위 내 문서 전부 + AGENTS 3종에 동시에 걸린다. §19 스윕이 그 전부를 한 번에 센다 — 파일별로 따로 닫지 않는다. **계측 정의가 곧 불변식의 정의가 되므로 정의를 좁게 잡으면 게이트 green 이 전수를 뜻하지 않는다**(r1 의 실패 지점).
- **두 축의 게이트 형태가 다르다.** 경로 축은 **0-출력 게이트**(예외는 목록에 명시 등재), 심볼 축은 **전건 분류 게이트**(모든 산출을 `설계어휘`·`외부`·`역사`·`future`·`문서어휘` 중 하나로 넣고 **미분류 0** 을 보고). 심볼은 설계 어휘·외부 타입이 정상적으로 다수라 0-출력이 성립하지 않는다.
- **계측은 여러 층이 각각 좁아질 수 있다** — *추출*(어떤 토큰을 뽑는가) · *실재 테스트*(무엇을 "있다" 로 세는가) · *분류 단위*(심볼인가 사이트인가) · *매칭 의미*(substring 인가 경계인가) · *판정 축*(심볼의 정체인가 사이트의 시제인가). r1 추출 · r2 분류 단위 · r3 실재 테스트 · r3 verify 가 매칭 의미·판정 축·토큰 형태.
- **[r4 개정 — 출처: verify r3 §14 · handoff-review Round 10]** **층을 나열하는 것으로는 닫히지 않는다.** 위 목록을 처음 쓴 라운드(r3)가 바로 그 라운드에서 네 번째 층에 빠졌다. 목록은 열려 있다고 보고, 대신 **고친 장치마다 알려진 결함을 심어 실패하는지 먼저 확인**한다(`handoff-impl §3`). r4 는 이 검사로 자기 시제 술어의 절반이 죽어 있는 것을 발견했다 — 산출 47 → 98.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `docs/arch/backend/overview.md` | 백엔드 구조·부트·구현 상태 | A1·A2·A3·A8 상태행 · C2~C5 구조 서술 · B 경로 1건 | §19 스윕 · AC2 |
| `docs/arch/backend/auth.md` | 인증 책임 지도 | C1 — `prepared-config` → `adapters/harness-config.ts` | AC4 |
| `docs/arch/backend/provider-runtime.md` | 정규화 계층 | B 경로 11건 + 구현상태 문구. **절 구조 불변**(D-002) | AC3 |
| `docs/arch/backend/{adapters,standardization,system-prompt}.md` | 어댑터·표준화·시스템 프롬프트 | E — 폐기 절 삭제 + ADR 링크 | AC6 |
| `docs/arch/frontend/overview.md` | 프론트 구현 상태 | A4·A5 · B 경로 1건 | AC2 |
| `docs/arch/frontend/layers.md` | 렌더러 트리 | C6 — `login/`→`providers/` · `SkillsPage` 삭제 · `RootGate` 설명 · `shared/i18n`·`logging.ts` | AC4 |
| `docs/arch/frontend/{rendering,ux-domains}.md` | 렌더링·UX | A6·A7 구현 대기 → 구현됨 | AC2 |
| `docs/IPC_CONTRACT.md` | 채널 계약 | B 경로 2건 | AC1 |
| `docs/TRD.md` | 기술 사양 | B 경로 2건 · A8(F15) · C8 수치 | AC1·AC2 |
| `docs/claude-code-spec.md` | spec 라우터 | B 경로 1건 | AC1 |
| `docs/INDEX.md` | 라우팅 | G — 2행 추가 | AC11 |
| `docs/guides/closed-network-extensions.md` | 폐쇄망 확장 절차 | F1 §8.1 목록 재작성 · F2 §8.2 1번 | AC7·AC8 |
| `docs/guides/workspace-isolation-permissions.md` | 권한 격리 절차 | F4 정본 표기 · F5 미채택 표기 | AC9 |
| `docs/guides/release-operations.md` | 릴리스 절차 | F3 PR 트리거 | AC10 |
| `app/AGENTS.md` | app 작업 규칙 | D1~D5 | AC5 |
| `app/src/main/AGENTS.md` | main 레이어 규칙 | C7 | AC4·AC5 |

### 테스트 가능성

- 코드 변경 0 이므로 단위 테스트를 추가하지 않는다. 관측 수단은 §19 의 grep 스윕과 **가이드가 지시하는 명령의 실제 실행**이다.
- 순서를 관측할 훅: 없음(해당 없음).

## 12. End-to-end 영향

### producer → consumer

```text
코드(진실) → arch/ 서술 → INDEX 라우팅 → 에이전트 세션
코드(진실) → guides/ 절차 → 사람이 실행 → 명령 통과
```

- producer 기준: 코드·타입·테스트 (root `AGENTS.md` 원칙 1의 진실 순서).
- consumer 파생 규칙: `guides/` 는 사실을 복제하지 않고 `arch/`·코드를 링크한다(`guides/AGENTS.md` 규칙 2).
- 파생 가능한 합성값이 정본을 우회하지 않는가: 수치는 전부 `generated/inventory.md` 링크로 우회를 막는다.

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음 — 코드 변경 0.

## 13. Lifecycle / 오류 / 정리

- 생성/시작·취소/중단·종료: 해당 없음(문서 작업).
- **다중 저장소 쓰기**: 해당 있음. 이 작업의 판정·상태는 두 곳에 산다 — `docs/handoff/0191-docs-code-resync/plan.md`(상세 정본)와 `docs/handoff/INDEX.md`(보드 상태·다음 주체). 둘이 갈리면 "지금 누구 차례인가" 가 틀린다.
  - 쓰기 지점 ①: `plan.md` 의 `상태` 메타. ② `INDEX.md` 의 단계·상태·다음 주체 열.
  - ① 만 쓰고 죽으면: 보드는 이 handoff 를 모른다 → 아무도 집지 않는다.
  - ② 만 쓰고 죽으면: 보드가 `plan/READY` 라 하는데 문서가 없다 → 구현자가 계약 없이 시작한다(더 나쁘다).
  - 설계로 없앤다: **`plan.md` 를 먼저 쓰고 같은 커밋에 `INDEX.md` 행을 넣는다.** 한 커밋이므로 중간 상태가 관측되지 않는다. 구현 커밋은 이 커밋과 분리한다(기준선 잠금).

## 14. 성능 / 상한 / 최적화

- 새 출력/요청: 없음.
- 구조적 목표: **경로 부재 20 → 0** 이 유일한 수치 목표다. 달성 가능한 이유 — 20건 전부가 file:line 으로 특정됐고(§8 전수), 각각 현재 경로가 코드에 존재하거나(이설) 폐기 서술이라 확장자를 떼면 된다(§7 AC1 주의사항).
- 캐시/호출 축소: 해당 없음.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port/schema/config: `AuthDefinition`·`AuthBinder`·`UsageFetcher` 등 `app/deployment/` 표면.
- 구현 문서: `docs/guides/closed-network-extensions.md` — **이 문서가 실제 진입 경로다**(`app/deployment/*.ts` 주석이 명시 위임).
- **shape 검증**: 이번 턴에 계약을 바꾸지 않는다. 레시피 본문의 식별자 125개를 `app/src` 전수 대조해 부재 1개(명시적 폐기어)임을 확인했다 — 예제가 현재 타입을 가리킨다.
- **semantics 검증**: §8.1 의 명령 3개를 실제 실행해 문서가 적은 통과 기준이 나오는지 확인한다(AC7).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 수치를 본문에 쓰지 않는다 | `docs/AGENTS.md` 규칙 2 | C3·C8 이 수치를 제거하고 생성물을 링크 | **유지**(규칙 쪽으로 정렬) |
| `arch/` 에 이력을 쓰지 않는다 | `docs/AGENTS.md` 규칙 4 | E 가 폐기 절을 삭제 | **유지** |
| 문서 추가 시 INDEX 갱신 | `docs/AGENTS.md` 규칙 5 | G 가 누락 2행을 추가 | **유지** |
| `spec/` 편집 금지 | `docs/AGENTS.md` 규칙 7 | `docs/spec/**` 를 비범위로 둠 | **유지** |
| guides 는 사실을 복제하지 않고 링크 | `docs/guides/AGENTS.md` 규칙 2 | F4 가 붙여넣기 예제를 구현 인용으로 | **유지** |
| Open Questions 단독 결정 금지 | root `AGENTS.md` 원칙 2 | D-006 이 PRD §11 을 비범위로 | **유지** |
| 레시피 정본은 가이드 (0190) | `app/deployment/*.ts` 주석 | F1·F2 가 가이드 §8 을 고침 | **유지** — 정본을 정본답게 |
| `plan/READY` 커밋과 구현 커밋 분리 | `handoff-plan/SKILL.md` | §13 이 커밋 경계를 지정 | **유지** |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 경로 스윕을 통과시키려 역사적 인용을 무분별 삭제 | AC1 주의사항 — 확장자를 떼 산문화한 지점을 **구현 보고에 나열**한다. 회피를 선택으로 남긴다 |
| `provider-runtime.md` 를 고치다 설계 내용까지 손댐 | D-002 + AC3 이 절 제목 개수 불변을 단언 |
| A2 처럼 "구현됐다" 로 바꾼 판정이 실제로는 부분 구현 | 각 상태행에 근거 파일 경로를 함께 적어 다음 독자가 검산 가능하게 한다 |
| better-sqlite3 ABI 마찰로 AC7 명령이 환경 기인 실패 | `app/AGENTS.md §제약 환경 게이트` 의 서명으로 판정하고 **환경 기인 실패를 분리 보고**한다 |

- 되돌리기 어려운 결정: 없음(문서, git revert 가능).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

§11 표 참조. 코드 파일 변경 **0**.

## 19. 게이트

- 적용할 하위 가이드: `docs/AGENTS.md` 작성 규칙 · `docs/guides/AGENTS.md` · `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- ABI/네트워크 제약: 이 세션은 egress 가 열려 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 가 성공한다. 그 상태에서는 **electron 바이너리를 실제로 로드하는 스위트가 실패**한다 — 변경 관련 실패와 분리해 보고한다.
- 기본 정적 게이트: `cd app && node scripts/check-doc-inventory.mjs --check` (순수 Node, ABI 무관).
- **경로 회귀 게이트 (r2 확장 — 3형태).** r1 은 `src/…` 절대형만 셌고 그 정규식 밖에서 D1~D4 가 살아남았다. 해석은 **접미사 매칭**이다 — 문서가 `app/deployment/plugins.ts` 처럼 subtree 상대형으로 인용하는 것이 정상이기 때문이다.

```bash
# 대상: docs 전수(handoff·archive·etc·spec 제외) + AGENTS 3종
SCOPE="$(find docs -name '*.md' | grep -v '^docs/handoff/\|^docs/archive/\|^docs/etc/\|^docs/spec/') \
        app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md"
find app/src -name '*.ts' -o -name '*.tsx' | sed 's|^|/|' | sort > /tmp/_real.txt   # 접미사 해석 대상
find app/src -name '*.ts' -o -name '*.tsx' | xargs -n1 basename | sort -u > /tmp/_base.txt
basename -a app/*.ts >> /tmp/_base.txt                                              # app/vitest.config.ts 등

# A. 절대형 — r1 게이트 그대로
for f in $SCOPE; do
  grep -oEn '(app/)?src/(main|renderer|shared|preload)/[A-Za-z0-9_./@-]*\.(ts|tsx|md|css|html)' "$f" |
  while IFS=: read -r ln p; do q=${p#app/}; [ -e "app/$q" ] || echo "A $f:$ln  $p"; done
done

# B. 슬래시 포함 상대형 (백틱 인용) — 접미사를 **파일 경계로** 해석
#    [r4 개정 — 출처: verify r3 §13 ⓐ] 구 판은 `grep -qF` = substring 이라
#    `.ts` 인용이 실파일 `.tsx` 안에 포함돼 통과했다(F1). 경계 앵커를 건다.
for f in $SCOPE; do
  grep -oEn '`[^`]*`' "$f" | sed 's/`//g' |
  grep -E ':[A-Za-z0-9_./@{}-]+/[A-Za-z0-9_.@{}-]+\.(ts|tsx)$' |
  while IFS=: read -r ln p; do
    grep -qE "(^|/)${p#app/src/}\$" /tmp/_real.txt || echo "B $f:$ln  $p"
  done
done

# C. 맨 파일명 (백틱 인용)
for f in $SCOPE; do
  grep -oEn '`[A-Za-z0-9_.@-]+\.(ts|tsx)`' "$f" | sed 's/`//g' |
  while IFS=: read -r ln p; do
    case "$p" in */*|.*) continue;; esac
    grep -qxF "$p" /tmp/_base.txt || echo "C $f:$ln  $p"
  done
done
```

  **완료 조건: A+B+C 산출이 아래 예외 목록과 정확히 일치**(그 밖 0줄). 예외는 삭제가 아니라 등재다 — 회피가 아니라 선택임을 남긴다.

| 축 | 위치 | 인용 | 사유 |
|---|---|---|---|
| B | `docs/GLOSSARY.md:79` | `capabilities/revert-manager.ts` | 역사 — 같은 줄이 "구 … 정리됐고" 로 표기 |
| B | `docs/arch/frontend/layers.md:110`·`:154` | `pages/XxxPage.tsx` | 설계어휘 — 새 파일 배치 규칙의 자리표시자 |
| B | `docs/arch/frontend/ux-domains.md:93` | `pages/RoutinesPage.tsx` | future — "후속 PR 에서 … 추가 시" |
| B | `docs/arch/backend/security.md:137` | `contracts/sso.ts`·`contracts/usage-source.ts` | 역사 — "0157 이 지운 두 경로 (되살리지 말 것)" |
| B | `docs/arch/backend/provider-runtime.md:419` | `packages/sdk/js/src/gen/types.gen.ts` | 외부 — OpenCode SDK 저장소 경로 |
| B | `docs/guides/closed-network-extensions.md:13` | `contracts/auth-method.ts`·`contracts/connector.ts` | 역사 — "더 이상 존재하지 않는다 — 인용하지 마라" |
| B | `docs/decisions/004-provider-single-axis.md:3`·`:28` | `contracts/provider.ts` | 역사 — ADR 결정 시점 기록(`:28`)과 그것을 가리키는 상단 승계 노트(`:3`). 현재 계약은 `contracts/auth.ts` |
| C | `docs/arch/frontend/rendering.md:138` | `TelemetryPanel.tsx` | 역사 — "0079 에서 … 대체" |
| C | `docs/arch/frontend/state.md:102` | `useChat.ts` | 역사 — "구 useChat.ts … 폐기" |
| C | `docs/arch/frontend/overview.md:72` | `NewChatButton.tsx` | 역사 — "삭제" 명시 |
| C | `docs/arch/backend/provider-runtime.md:77`·`:423`·`:426`·`:445`·`:455` | `types.gen.ts` | 외부 — OpenCode SDK |
| C | `docs/arch/backend/standardization.md:146` | `conformance.ts` | 설계어휘 — 같은 줄이 "코드에 존재하지 않는다" 로 명시 |

- **심볼 회귀 게이트 (r3 재작성).** r2 판은 두 곳이 불변식보다 좁았다 — 추출이 **백틱 CamelCase/CONST 만** 봤고, 실재 테스트 `grep -rqF "$s" app/src` 가 **주석 줄을 실재로 셌다**(`ExtensionDeployer` 가 그렇게 통과 → E1). 0-출력이 목표가 아니다 — 설계 어휘·외부 SDK 타입이 정상적으로 다수다.

```bash
CORPUS="app/src app/scripts app/package.json .github/workflows"
for f in $SCOPE; do
  { grep -oEn '`[A-Za-z_][A-Za-z0-9_]*`' "$f" | sed 's/`//g'          # S1 백틱 CamelCase/CONST + S2 lowerCamelCase
    grep -oEn '`[a-z][a-z0-9]*(-[a-z0-9]+)+`' "$f" | sed 's/`//g'      # S4 백틱 소문자-하이픈
    grep -oEn '\*\*[A-Za-z_][A-Za-z0-9_]*\*\*' "$f" | sed 's/\*\*//g'  # S3 **bold**
    grep -oEn '`[A-Za-z_][A-Za-z0-9_]*\(' "$f" | sed 's/`//g;s/(//'    # S5 백틱 호출식 (r4 신설)
  } | while IFS=: read -r ln s; do
    case "$s" in *[A-Z]*|*-*) ;; *) continue;; esac                    # 식별자형만
    hits=$(grep -rnF "$s" $CORPUS 2>/dev/null)
    if [ -z "$hits" ]; then echo "ABSENT|$s|$f:$ln"
    elif ! printf '%s\n' "$hits" | sed 's/^[^:]*:[0-9]*://' | grep -qvE '^[[:space:]]*(//|\*|/\*|#)'; then
      echo "COMMENT_ONLY|$s|$f:$ln"                                    # 주석에만 있다 = 실재 아님
    fi
  done
done | sort -u    # 고유 (종류,심볼,사이트) — dedup 후가 보고 수치다
```

  **완료 조건: 산출 전건이 `설계어휘`·`외부`·`역사`·`future`·`문서어휘` 중 하나로 분류되고 미분류 0.** 분모는 **심볼이 아니라 사이트**다 — 한 심볼이 사이트마다 다른 시제를 가질 수 있고, 그 갈림이 E1~E3 의 자리였다.

  **[r4 추가 — 출처: verify r3 O2] dedup 규칙.** 한 줄이 같은 심볼을 두 번 인용하면 raw 산출에 두 줄이 나온다. 보고 수치는 `sort -u` 뒤의 **고유 `(종류,심볼,사이트)`** 다 — r3 의 `211` 도 raw `215` 의 dedup 값이었고, 규칙이 안 적혀 있어 재현자가 raw 를 본다.

  **r4 분류 결과 (220사이트 / 131심볼 · 미분류 0)** — 버킷별 심볼 목록. 다음 라운드는 이 집합을 diff 해 새 심볼만 판정하면 된다.

  **r3(211) → r4(220) delta**: 제거 2(`ErrorCode`@`provider-runtime.md:274` — F2 정정 · `stream-json`@`claude-code-spec.md:103` — F4 정정), 추가 11(S5 호출식 축 신설 7심볼 + 기존 심볼의 새 사이트 4). `211 − 2 + 11 = 220`.

| 버킷 | 사이트 | 심볼 |
|---|---:|---|
| 설계어휘·목표계약 | 63 | `AppContainer` `AppShell` `BackendAdapter` `CapabilityProbe` `ClaudeEngine` `ConfigManager` `DiffCard` `DirectBackendAPI` `DirectBackendCapabilities` `ExclusivePlugin` `ExtensionDeployer` `FilePreviewCard` `ModelProviderConfig` `OpenCodeEngine` `PendingApprovalStateMachine` `ProviderPlatformV2` `ProviderSettingsLoader` `Redaction` `RevertManager` `SEND_USER_MESSAGE` `SessionCapability` `StandardConformance` `StructuredOutputState` `TerminalCard` `WorkspaceManager` `detectError` `getCredentialKeys` `mcpSpecVersion` `mergePolicy` `migrate-sources` `selectFileRenderer` `supportedBackends` `useContextSelector` `useOverlay` `vendorExtensions` |
| 외부 SDK·env·플랫폼 | 75 | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` `CLAUDE_CODE_*`(3) `ClaudeSDKClient` `HOME` `MODULE_NOT_FOUND` `McpServerConfig` `NODE_ENV` `SDK*Message`(6, `SDKUserMessageReplay` 포함) `SmartScreen` `StructuredOutputError` `TeammateIdle` `WorktreeCreate` `allowDowngrade` `apiKeyHelper` `aria-disabled` `atomFamily` `baseURL` `continueConversation` `data-platform` `disallowedTools` `excludeDynamicSections` `feat-pretty-ui` `node-pty` `optionalDependencies` `postSessionByIdPermissionsByPermissionId` `resolveSettings` `skill-creator` `stream-json` `utilityProcess` `will-navigate` |
| 역사(구·폐기·제거) | 58 | `ArgvSafeSettings` `AuthView` `CachedSession` `CameraPane` `CapabilityBuilder` `ChatPane` `ConnectionRegistry` `ConnectorRuntime` `CredentialPresentation` `ErrorCode` `InflightTurn` `LOAD_SESSION_FROM_CACHE` `ORCA_SUBAGENT_BACKGROUND` `OrcaCapabilities` `PlanApprovalCard` `PluginHost` `ProviderSummariesRequest` `ProviderUsageEntry` `PythonRuntime` `SubprocessEnv` `TransactionStore` `UseChat` `acceptedMethods` `askRespond` `buildAppend` `envKey` `lastTurnLatencyMs` `orca-mcp` `parentBindingId` `pendingDelta` `pendingInputTokens` `pendingReasoning` `planRespond` `sessionCache` `setProviderEnv` `splitProviderSettings` `useChatContext` `validateCrossReferences` |
| future(후속·미도입) | 10 | `AgentTaskCard` `ContextInjectionCard` `EngineSettings` `SearchCard` `SessionGraphCard` `noReply` `pendingApprovals` `toOpencodeConfig` |
| 문서어휘(개념어·약어) | 10 | `CSP` `Frontend` `OQ9` `OQ10` `P1` `Preload` `TBD` `Titlebar` |
| **비범위 — 보고만** | 4 | `ClaudeCodeAdapter` `OpencodeAdapter` `borderStrong` `rustSoft` — 전부 `docs/PRD.md` 사이트. §6 이 PRD 를 비범위로 뒀다(D-006) |

- **시제 회귀 게이트 (r4 신설 — 출처: verify r3 §13 ⓒ).** 버킷은 *심볼이 무엇인가*를 묻고 불변식은 *이 사이트의 단언이 참인가*를 묻는다. 두 축이 갈리는 자리가 F2(`역사` 버킷인데 문장은 "현행")·F3(`외부` 버킷인데 문장은 현재형 차단)이었다. 심볼 산출 중 **현재형 단정어를 동반한 사이트만** 추려 그 부분집합을 전건 육안 판정한다.

```bash
while IFS='|' read -r kind sym site; do
  f=${site%:*}; ln=${site##*:}
  sed -n "${ln}p" "$f" | grep -qE '현행|현재|한다|이다|✅' && echo "$kind|$sym|$site"
done < <심볼 산출>
```

  **완료 조건: 산출 전건 판정, 거짓 단언 0.** 참/거짓은 정규식이 못 가린다 — 이 축의 산출은 *육안 판정 대상 목록*이지 결함 목록이 아니다.

  **`\b` 를 쓰지 않는다.** `한다\b`·`이다\b` 는 이 로케일에서 **한 번도 발화하지 않는다**(한글 뒤에 word boundary 가 서지 않는다). r4 초안이 그 형태였고 적대 검사에서 술어 절반이 죽어 있는 것이 드러났다 — 산출이 47 에서 98 로 두 배가 됐다.

  **이력·부정 표지로 사전 필터링하지 않는다.** r4 가 `구|폐기|미채택|없음|보류…` 로 98 → 27 로 줄이는 필터를 시험했는데, **F2·F3 원문이 둘 다 자동 통과**했다(F2 는 "없음", F3 는 "폐기"를 같은 줄에 갖는다). 알려진 결함을 못 보는 필터의 축소는 전수가 아니다.

  **r4 판정 결과 (98사이트 · 거짓 단언 0)** — F1~F4 정정 후. 통과 사유는 네 갈래다: 역사 표기 동반(`구 X` · `폐기`) · 외부 SDK/CLI 표면 서술 · 설계어휘 절(`① 설명` · 선택지 비교표) · 부정문 안의 등장. 다음 라운드는 이 집합을 diff 해 새 사이트만 판정한다.

- **넓히지 않은 축과 이유** (verify r2 §13 요구). 계측 정의가 곧 불변식의 정의이므로 넓히지 **않은** 것도 적는다.

| 축 | 판정 | 이유 |
|---|---|---|
| **위치 축**(주장한 레이어에 있는가) | 게이트로 두지 않는다 | `state.md:134` 는 "**main 은** `TurnRegistry`" 라 썼는데 그 이름은 **renderer** `chatStore.ts` 에만 있었다 — 저장소 전체 grep 은 통과한다. 정규식화하면 오탐이 지배하므로, **레이어를 명시하는 사이트만 육안 확인**한다(이번 라운드 대상 3건, 전부 정정) |
| **경로 축의 비-ts 확장자**(`.md`·`.sql`·`.json`) | 1회 스윕 후 상시 게이트에서 제외 | 산출 160여 줄이 **doc↔doc 링크 위주**라 `check-doc-inventory.mjs` 의 `links ok` 와 신호가 중복된다. 실제 수확은 2건뿐이고 이번에 고쳤다 — `prompts/policies/python-runtime.md`(GLOSSARY·TRD, 디렉토리 자체가 없다) · `docs/architecture.md`(대소문자, 실제 `ARCHITECTURE.md`) |
| **산문 서술의 사실성**(이름은 맞고 설명이 틀린 경우) | 계측 불가 | grep 이 판정할 수 없다. `rendering.md:144` 의 원장 서술이 이 유형이었고 육안으로 잡았다 |

- 가이드 절차 게이트(AC7): `cd app && npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run src/main/features/auth src/main/features/gate src/main/features/harnesses src/main/features/plugins src/main/app`.
- 사람 실기: `closed-network-extensions.md §8.2` 의 사내 로그인 왕복 — 이 환경에서 불가. 경로·파일명 대조로 갈음하고 분리 보고한다.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — 3턴(초기 요구 · guides 추가 · "따라할 수 있도록")이 D-001·D-004·D-005 로 남았다.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절을 재해석하지 않았다 — D-005 에 사용자 원문을 인용했다.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] Technical Design에 AS-IS와 TO-BE가 같은 축으로 있다(§9).
- [x] Delta의 각 행이 §11 파일 또는 AC로 추적된다.
- [x] AS-IS에서 사라진 책임(폐기 절)은 §11 에서 삭제로 명시했다.
- [x] 수치·전칭 표현·문서 앵커를 실측했다(§8 검산).
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 미룬 것은 사내 네트워크 왕복뿐이고 그 사실을 §19 에 적었다.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC7 은 파일 존재(structural)에 더해 **명령 실행 산출**(semantic)을 요구한다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다(§10 — "경로 실재" 의 강제 지점이 없던 것이 이번 드리프트의 원인이라 스윕을 도입).
- [x] 부팅/등록 변경의 기존 소비처 — 해당 없음(코드 변경 0).
- [x] producer/consumer 양쪽 의미를 확인했다(§12).
- [x] 상한·총량·one-way door를 계산했다(§14 — 20→0).
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다.
- [x] 본문 완성 후 Decision Ledger와 교차검증했고 결과를 §3 갱신 메모에 적었다(`충돌 0`).
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: §7 AC 12건 전부. 강제 지점(§10)의 "경로 실재" 를 스윕 하나로 닫는 설계가 실제로 맞았다 — 파일별로 닫았다면 18개 파일을 따로 세야 했다.
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| 인용 `src/**` 경로 실재 | 범위 내 문서 + AGENTS 3종 전부 (스윕이 한 번에 셈) | 20/20 | §19 스윕 → `부재 0건` (시작 20건) | AC1 |
| 수치 본문 미기재 | `check-doc-inventory.mjs` prose | 1/1 | `node scripts/check-doc-inventory.mjs --check` → `prose ok` | AC12 |
| 상대 링크 해석 | 동 links | 1/1 | 동 → `links ok` | AC12 |
| guides 절차 실행 | §8.1 명령 3개 | 3/3 | `npm run typecheck`(exit 0) · `npm run lint`(0 errors, 1 warning — 기존 `react-hooks/incompatible-library`) · scoped `vitest run`(41파일 중 40 통과 · 506 케이스 전부 통과) | AC7 |
| §8.1 인용 테스트 실재 | 새로 쓴 표 8행 | 20/20 | 인용 테스트 20개를 `ls` 로 전수 확인 → 부재 0 | AC7 |
| renderer 보조 명령 | §8.1 각주 1건 | 1/1 | `vitest run src/renderer/src/features/providers` → 2파일 · 13케이스 통과 | AC7 |

- §10에 없는데 같은 불변식이 필요했던 지점: **있었다.** "인용 *심볼* 이 실재하는가" 는 경로 스윕이 못 잡는다 — `InteractionBroker`(→`ApprovalBroker`)·`RevertManager`(코드에 없음)·`permission-bridge.ts` 의 `RISKY_TOOLS`(→`adapters/risky-tools.ts`)가 그 축에서 나왔다. 심볼 grep 을 별도로 돌려 닫았다 → 되먹임 대상.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ | guides §8 은 폐쇄망 배포자, arch 상태표는 에이전트 세션 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ 3행 모두 | §5 의 3행이 각각 F1·F2·A 축에 대응 |
| 실패가 화면에서 "아무 일도 안 일어남" 으로 보이지 않는가 | ✅ | §8.1 에 환경 기인 실패 서명을 명시해 "빨간데 왜인지 모름" 을 없앴다 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | 문서 작업 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `provider-runtime.md §5` 가 `RevertManager` 를 "✅ seam 구현" 이라 했으나 **코드에 없다** | ✅ 선조치 — §5 ③ 와 §12 요약표를 "❌ 구현 없음(목표 계약)" 으로 정정 | `rg RevertManager app/src` = 주석 1건 |
| 2 | `InteractionBroker` 가 `ApprovalBroker` 로 개명됐는데 문서 6곳이 옛 이름 | ✅ 선조치 — 전량 치환 | `features/approvals/broker.ts:34` |
| 3 | `rendering.md §1.7`·`ux-domains.md §1.6` 은 제목이 "구현 대기" 인데 **본문 ③ 가 구현됐다고 적고 있었다**(자기모순) | ✅ 선조치 — 제목을 본문에 맞춤 | `StructuredOutputCard.tsx`·`ApprovalCard.tsx` |
| 4 | `ARCHITECTURE.md` 파일 맵에 `system-prompt.md`·`observability.md` 2행 누락 | ✅ 선조치 — 2행 추가 | 디렉토리 대조 |
| 5 | `app/AGENTS.md:135` "실측 5파일" 이 낡았을 것으로 예상했으나 **재측정 결과 정확** | ⚠️ 보고만 — 고치지 않음 | 전체 `vitest run`: 204파일 중 5 실패, 목록이 기재와 동일 |
| 6 | 루트 `AGENTS.md` 가 UI 라벨 정본을 `src/shared/i18n/ko.ts` 로 적는다(실제 `renderer/src/shared/i18n/`) | ⚠️ 보고만 — D-007 로 범위 밖 | 루트 `AGENTS.md` §언어 |
| 7 | PRD §11 OQ9 가 열려 있으나 `permissionMode` 는 구현됨 | ⚠️ 보고만 — D-006, 사용자 결정 필요 | `orca:permission:setMode` |

### 설계 대비 명시적 차이

- plan 이 지정한 것과 다르게 구현한 것과 그 이유: **D4 는 변경 없음.** plan §11 이 `app/AGENTS.md:135` 재측정 후 갱신을 예상했으나, 실측이 기재와 일치해 고치지 않았다(위 #5).

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 22개 (docs 20 + `app/AGENTS.md` + `app/src/main/AGENTS.md`). **코드 변경 0** |
| 실행 명령 | `node scripts/check-doc-inventory.mjs --check` · `npm run typecheck` · `npm run lint` · `vitest run`(전체·scoped·renderer) · 경로/심볼 스윕 |
| **관측한 게이트 산출** | 인벤토리 3항목 ok · typecheck exit 0 · lint **0 errors / 1 warning**(기존 `react-hooks/incompatible-library`, 문서와 무관) · 전체 vitest **204파일 중 199 통과 · 1,939케이스 중 1,897 통과**, 실패 5파일은 전부 better-sqlite3 네이티브 바인딩(egress 제약, `app/AGENTS.md` 기재와 동일 목록) |
| 강제 지점 전수 | 6/6 (위 표) |
| **AC 자기보고** | 12/12 — AC1 스윕 `부재 0건`(시작 20) · AC2 잔여 `❌` 6행이 전부 코드로 확인된 미구현 · AC3 부재 11→0, `^## ` 절 **20개 불변** · AC4 검색 0건 · AC5 `deployment/`·`respawn-inputs` 기재, 스크립트 목록을 개수 대신 열거로 · AC6 `system-prompt.md §2` 43줄 → ADR 링크 7줄 · AC7 명령 3개 실행 + 인용 테스트 20개 실재 · AC8 §8.2 1~3번이 `app/deployment/` 기준 · AC9 헤더에 `workspace-guard.ts` 명시 + `disallowedTools` 4곳 미채택 표기 · AC10 `pull_request` 반영 · AC11 2행 추가 · AC12 exit 0 |
| **합계 검산** | `✅ 12 · ⚠️ 0 · ❌ 0 = 총 12` — 분모는 §7 의 AC1~AC12, 분할·추가 없음 |
| 블로커 / 역질문 | PRD §11 OQ9 해소 여부 (D-006 — 사용자 결정) |
| 대상 커밋 | `d102df9` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음(라운드 1).
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **부분적으로.** §10 이 "경로 실재" 는 강제 지점으로 세웠지만 "심볼 실재" 는 세우지 않았다 — 위 강제 지점 표의 마지막 줄이 그 공백에서 나왔다.
- 반복해서 부딪히는 환경 한계: better-sqlite3/electron egress 제약. 이번엔 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 로 우회했고, 그 결과를 guides §8.1 의 예외 문구로 문서화했다.
- 현재 라운드 수: 1
## [구현자 기입] 라운드 2 — D1~D6 + 불변식 전수

**불변식을 한 문장으로 올렸다**: *문서가 현재형으로 인용하는 코드 경로·심볼은 실재한다. 실재하지 않는 인용은 역사·설계어휘·외부·future 중 하나로 명시 표기된다.* r1 의 실패는 지적 6건이 아니라 **계측 정의가 불변식보다 좁았다**는 것이다 — §19 스윕이 `src/…` 절대형만 세서 상대형(D2·D3·D4)·맨 파일명(D1)·심볼(D5)이 통째로 계측 밖이었다.

### 사용자 결정 (이번 턴)

| # | 결정 | 반영 |
|---|---|---|
| 1 | `layers.md §1-2 이행 이력` **삭제 + git 링크** | 51줄 제거(`layers.md:96~146`), `:94` 가 `git log`(PR #29)로 안내. `docs/AGENTS.md` 규칙 4 정합 |
| 2 | 확장 스윕은 **plan §19 유지**(체크인 스크립트·CI 게이트 없음) | 코드 변경 0 · AC5 스크립트 목록 불변 |
| 3 | `decisions/004` 는 **상단 승계 노트**, 본문 경로 유지 | `004-provider-single-axis.md:3~5` |

### 계측 확장이 드러낸 것 — 지적 6건 밖 결함

| 축 | r1 계측 | r2 계측 | 새로 나온 결함 |
|---|---|---|---|
| A 절대형 | 20 → 0 | 0 유지 | — |
| B 상대형 | **미계측** | 57 → 예외 11줄 | **15건** (D2·D3·D4 포함) |
| C 맨 파일명 | **미계측** | **15** → 예외 9줄 | **6건** (D1 포함) |
| 심볼 | **미계측**(r1 이 3심볼만 임의 확인) | 89사이트 → 67사이트 전건 분류 | D5 계열 18인용 + **5심볼** |

B/C 의 원자료는 `layers.md §1-2` 가 34건을 차지했다 — 결정 1 이 그것을 원인째 지웠다.

**결함 총량 검산**: 경로 **21**(B 15 + C 6) + 심볼 **5** + D5 계열 = 이번 라운드에 고친 인용. 이 중 검증자가 지적한 것은 D1(C) · D2·D3·D4(B) · D5 뿐이고, 나머지 **22건은 계측을 넓혀야 보였다**.

> **[r3 정정 — 출처: verify r2 §7 재측정]** 위 표와 검산의 *시작 상태·증분* 5종이 실측과 갈렸다(E5): base C `19`→**15** · B 축 `13`→**15** · C 축 `7`→**6** · 경로 총계 `20`→**21** · 드러난 결함 `21`→**22**. HEAD 상태 수치(A 0 · B 11 · C 9 · 예외표 12행/20사이트)는 전부 일치했으므로 대상이 아니다. 재측정 명령: `git archive 32723bf | tar -x -C <tmp>` 트리에 §19 B/C 블록을 돌리고 HEAD 산출과 `comm -23` 으로 집합차를 뜬다.

### 강제 지점 전수 (r2 · §10 대조)

| 계약 | §10 지점 | 닫은 지점 | 재현 명령 / 관측 |
|---|---|---|---|
| 인용 경로 실재 (A) | 스윕이 한 번에 | **0/0 잔여** | §19 A 블록 → `A ` 접두 산출 **0줄** |
| 인용 경로 실재 (B) | 〃 | **15/15** | §19 B 블록 → 11줄, 전부 예외표 등재 |
| 인용 경로 실재 (C) | 〃 | **6/6** | §19 C 블록 → 9줄, 전부 예외표 등재 |
| **인용 심볼 실재** (r2 등재) | 전건 4버킷 | **47/47 분류 · 미분류 0** | §19 심볼 블록 → 67사이트/47심볼. 설계어휘 25 · 외부 SDK·env 9 · 역사 13 |
| 수치 본문 미기재 | inventory prose | 1/1 | `cd app && node scripts/check-doc-inventory.mjs --check` → `prose ok` |
| 상대 링크 해석 | inventory links | 1/1 | 동 → `links ok: every relative markdown link resolves` |
| guides 절차 실행 | §8.1 명령 3개 | 3/3 | typecheck exit 0 · lint **0 errors / 1 warning** · scoped vitest **41파일 중 40 · 506 케이스 전부 통과** |
| §8.1 인용 테스트 실재 | 표 8행 | **21/21** | `§8.1` 백틱 `*.test.ts` 21개 전수 `find` → `MISSING` 0줄 |

- **A+B+C 산출 = 예외표 20줄과 정확히 일치**(12행이 20사이트를 덮는다). 그 밖 0줄.
- 남긴 곳: 없음. 예외 등재분은 삭제가 아니라 사유와 함께 §19 표에 남겼다.

### 심볼 축 4버킷 분류 (미분류 0)

| 버킷 | N | 예 |
|---|---:|---|
| 설계어휘·목표계약 | 25 | `BackendAdapter`·`StandardConformance`·`DirectBackendAPI`·`TerminalCard`·`AppShell`(금지 예시) |
| 외부 SDK / env | 9 | `ClaudeSDKClient`·`SDKPermissionDeniedMessage`·`TeammateIdle`·`CLAUDE_CODE_*`·`NODE_ENV` |
| 역사(구·폐기·제거) | 13 | `OrcaCapabilities`·`CapabilityBuilder`·`PlanApprovalCard`·`ArgvSafeSettings`·`UseChat` |

이번 라운드에 **현재형 단언이었다가 결함으로 판정된 심볼 5개**를 고쳤다 — `RESTORE_SESSION`(→ 부팅 스텝 `landing-target`) · `MOCK_HATCH_BG`(→ `DISABLED_HATCH_CLASS`) · `CachedSession`(→ `sessions` Record 흡수) · `SetSessionPinnedRequest`/`SetProjectPinnedRequest`(→ `*Schema`, `shared/protocol.ts:220`·`:240`).

### D1~D6 처리

| # | 처리 | 관측 |
|---|---|---|
| D1 | ✅ `provider-runtime.md:188` ③ 를 line 202 와 정합하게 재작성 | 실제 코드 `claude.ts:346 prompt: input.stream`(턴) · `:270 prompt: req.prompt`(1-shot complete). `^## ` **20개 불변** |
| D2 | ✅ `ExtensionsCatalogView` 로 3곳 치환 | `ux-domains.md:95`·`layers.md:69`·`overview.md:76`. 실체 `features/skills/index.ts` barrel · `AppLayout.tsx:14` 마운트 |
| D3 | ✅ `adapters/plan-feedback.ts` | `IPC_CONTRACT.md:445`. 같은 문서 `:481` 의 `app/chat-turn.ts`(0190 디렉토리화)도 함께 |
| D4 | ✅ 경로만이 아니라 **서술이 낡았다** | cwd 는 `home` 고정이 아니라 `Bootstrap.getCwd(projectId)` 의 프로젝트 단위(`bootstrap.ts:123`·`context.ts:37`) |
| D5 | ✅ `OrcaHook*` → `Normalized*` 전수 | `grep -rn "OrcaHook\|ORCA_TO_CLAUDE_EVENT"` 범위 내 **0건**. 코드 1:1 대조(`hooks.ts` 9이벤트·필드 동일) |
| D6 | ✅ 세 숫자 정정 + provenance | §7 잔여 `❌` 5→**7** · §8 provider-runtime 몫 11→**13** · §8 내역 합 18→**20**. 각 정정에 `[r2 정정 — 출처: verify r1 §7]` 표기 |

### 선조치 (구현 세부·명백한 오기)

| # | 내용 | 근거 |
|---|---|---|
| 1 | `adapters.md:291` `protectEnv` 예제가 `{action:'block'}` 반환 — 같은 절의 결정 형식은 `{decision:'deny'}` | 문서 내 자기모순. 코드(`hooks.ts:38 NormalizedHookDecision`) 형식으로 정정 |
| 2 | `security.md:114` SSO 인증 창 예외가 0180 에 사라진 `features/sso/auth-window.ts` 를 현재형 인용 | `infra/browser-session.ts:111 openLoginWindow` + `partitionFor` 로 재작성 |
| 3 | `system-prompt.md:130` 이 0028 이 제거한 `splitProviderSettings`·branded 타입을 "컴파일타임 강제" 로 단언 | `security.md:180` 이력 문단이 제거를 명시. `adaptSettings`/`adaptEnv` 로 정정 |
| 4 | `app/src/main/AGENTS.md:29` app 열거에 `settings-reactions.ts` 누락(`app/AGENTS.md` 에는 있음) | 형제 문서 비대칭 — 추가 |
| 5 | guides §8.1 2번 `npm run lint` = `eslint --cache --fix` 가 배포자 트리를 조용히 고침 | `app/package.json:10`. 통과 기준 칸에 부작용 한 줄 명시 |

### 보고만 (권한 밖)

| # | 내용 | 왜 |
|---|---|---|
| 1 | **AC6 의 ADR 링크가 근거를 담지 못한다** — `system-prompt.md:81` 이 `ADR-002` 를 rationale 로 링크하나 그 ADR 본문에 `prompts/` 정적 정책 체인 제거가 없다(`grep -n "prompts/" decisions/002-*.md` = 0) | 링크 대상 교체는 D-003("ADR 링크만 남긴다") 의 실현 방식을 바꾸는 판단이라 설계자·사용자 몫 |
| 2 | 루트 `AGENTS.md` 의 `src/shared/i18n/ko.ts` ↔ 이번에 고친 `TRD.md N2` 가 갈렸다 | D-007 이 범위 밖으로 뒀다 |
| 3 | `app/src/shared/ipc.ts:394` 주석이 개명 전 `InteractionBroker` 사용 | 코드 변경 0 이 이번 비범위 |
| 4 | `persistence.md:18` 의 `❌ 미구현 (Future)` 는 AC2 측정면(`arch/*/overview.md` 상태표) 밖이다 | 참인 미구현이라 고칠 것이 없다. 측정면 정의를 §7 에 명시했다 |
| 5 | PRD §11 OQ9 | D-006 — 사용자 결정 대기 |

### 설계 대비 명시적 차이

- **plan §11 이 예상하지 않은 파일 7개를 고쳤다** — `security.md`·`state.md`·`dom-architecture.md`·`terms.md`·`GLOSSARY.md`·`standardization.md`·`decisions/004`. 이유: 계측을 넓히자 같은 불변식이 이 파일들에서 성립하지 않았다. §11 표는 r1 계측(절대형)이 찾은 파일만 담고 있었다.
- **`layers.md` 는 정정이 아니라 삭제였다**(결정 1). §11 은 "C6 트리 정정" 만 예상했다.

### 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 21개 (docs 18 + `app/src/main/AGENTS.md` + handoff 2 — `plan.md`·`INDEX.md`). **코드 변경 0** (`git status --short` 재확인) |
| 실행 명령 | §19 스윕 A/B/C + 심볼 · `node scripts/check-doc-inventory.mjs --check` · `npm run typecheck` · `npm run lint` · scoped `vitest run` |
| **관측한 게이트 산출** | 인벤토리 **3항목 ok**(`generated doc ok (9 items, 76 channels)`·`prose ok`·`links ok`) · typecheck exit 0 · lint **0 errors / 1 warning**(기존 `react-hooks/incompatible-library`, `useTranscriptVirtualizer.ts:22`) · scoped vitest **41파일 중 40 통과 · 506 케이스 전부 통과** |
| 환경 기인 실패 분리 | 실패 1파일 = `src/main/app/chat-turn.continuity.test.ts`, 서명 `Electron failed to install correctly`(`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`). 변경과 무관하며 guides §8.1 예외 문구가 서술하는 그 실패다 |
| 강제 지점 전수 | **8/8** (위 표) |
| **AC 자기보고** | AC1 ✅ A=0·B/C 는 예외표와 정확히 일치 · AC2 ✅ 긍정 8행 파일 실재 재확인, 잔여 `❌` **7행** · AC3 ✅ `^## ` **20** 불변 + D1 정정 · AC4 ✅ 4패턴 검색 **0건** · AC5 ✅ 비-test 스크립트 **6** = 열거 6 · AC6 ✅ `system-prompt.md:77` 이 "미채택" 3줄 + `:81` ADR 링크 · AC7 ✅ 명령 3개 실행 + 인용 테스트 **21/21** 실재 · AC8 ✅ §8.2 1번 = `app/deployment/auth-definitions.ts` = §1.1 트리 1행 · AC9 ✅ `workspace-guard.ts` 인용(`:8`·`:141`) + `grep -r disallowedTools app/src` **0** · AC10 ✅ `release-operations.md:12` "main push + 모든 PR" = `ci.yml:11~19` · AC11 ✅ `docs/INDEX.md` 2행 · AC12 ✅ 3항목 ok |
| **합계 검산** | `✅ 12 · ⚠️ 0 · ❌ 0 = 총 12` — 분모는 §7 의 AC1~AC12. **r1 과 분모 동일**(분할·추가 없음). r1 자기보고도 12/12 였으나 검증 재측정은 8✅/4⚠️ 였다 — 이번 12는 그 4건(AC1·AC2·AC3·AC7)을 계측 확장으로 다시 닫은 값이다 |
| 블로커 / 역질문 | AC6 의 ADR 링크 근거(위 보고만 #1) · PRD §11 OQ9(D-006) |
| 대상 커밋 | `7d8b2df` |

### Review Signals — 사실만 (r2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **그렇다.** r1 과 r2 가 같은 불변식("인용이 실재한다")을 닫았고, 갈린 것은 **계측 정의의 넓이**다. r1 은 정규식이 곧 정의가 됐다.
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **AC1 이 있었지만 검증 수단을 스윕 출력으로 못박아** semantic 목표("독자가 부재 파일로 안내받지 않는다")보다 좁아졌다. verify r1 §4 가 같은 진단을 냈다.
- 반복해서 부딪히는 환경 한계: electron 바이너리(1파일) — r1 과 동일 서명. 검증 세션에 `node_modules` 가 없던 r1 verify 의 한계는 이번 구현 세션에서는 없었다(`npm ci` 성공).
- 현재 라운드 수: **2**


## [구현자 기입] 라운드 3 — E1~E5 + 계측 세 층 정리

**불변식을 한 문장으로 올렸다**: *문서가 현재형으로 단언하는 **각 인용 사이트**는, 그 대상이 코드에 **비주석 줄로 정의된 심볼**로 실재할 때만 참이다.*

r2 의 실패는 E1~E4 네 건이 아니라 **계측이 세 층 중 두 층에서 좁았다**는 것이다. 세 층을 갈라 적는다 — 한 층만 고치면 다음 라운드가 다른 층에서 열린다.

| 층 | r1 | r2 | r3 (이번) |
|---|---|---|---|
| **추출** (어떤 토큰을 뽑는가) | `src/…` 절대형만 | 경로 3형태 + 백틱 CamelCase/CONST | **+ lowerCamelCase · `**bold**` · 소문자-하이픈** |
| **실재 테스트** (무엇을 "있다" 로 세는가) | `[ -e ]` | `grep -rqF … app/src` — **주석 줄도 실재로 셈** | **비주석 줄만** + 코퍼스 `app/scripts`·`package.json`·`workflows` 추가 |
| **분류 단위** | — | **심볼**(47) | **사이트**(211) |

세 번째 층이 이번에 새로 드러난 자리다. `ExtensionDeployer` 는 `deployer.ts` **헤더 주석**에만 있고 export 는 `deploy()`/`DeployResult` 뿐인데 r2 게이트가 이를 "실재" 로 통과시켰다 — **E1 이 그 구멍으로 살아남았다.**

### 강제 지점 전수 (r3 · §10 대조)

| 계약 | §10 지점 | 닫은 지점 | 재현 명령 / 관측 |
|---|---|---|---|
| 인용 경로 실재 (A 절대형) | 스윕이 한 번에 | **0/0 잔여** | §19 A 블록 → `A ` 접두 산출 **0줄** |
| 인용 경로 실재 (B 상대형) | 〃 | **11/11** | §19 B 블록 → **11줄**, 전부 §19 예외표 등재 |
| 인용 경로 실재 (C 맨 파일명) | 〃 | **9/9** | §19 C 블록 → **9줄**, 전부 예외표 등재 |
| **인용 심볼 실재** (r3 개정) | 추출 4축 · **사이트 단위** 전건 분류 | **211/211 사이트 · 미분류 0** | 새 §19 심볼 블록 → 211사이트/124심볼. 버킷 사이트 합 `58+71+59+9+10+4 = 211` |
| 수치 본문 미기재 | inventory prose | 1/1 | `cd app && node scripts/check-doc-inventory.mjs --check` → `prose ok: no inventory counts restated in current-state docs` |
| 상대 링크 해석 | 동 links | 1/1 | 동 → `links ok: every relative markdown link resolves` |
| guides 절차 실행 | §8.1 명령 3개 | 3/3 | typecheck 하위 3개 전부 실행 **error 0줄** · lint `✖ 1 problem (0 errors, 1 warning)` · scoped vitest `Test Files 1 failed | 40 passed (41)` · `Tests 506 passed (506)` |
| §8.1 인용 테스트 실재 | 표 8행 | **21/21 · 부재 0** | `grep -oE '\`[A-Za-z0-9_./-]+\.test\.ts\`' docs/guides/closed-network-extensions.md \| sed 's/\`//g' \| sort -u` → 21줄, 각 basename `find app/src` 히트. **세는 규칙 = 백틱 인용의 고유 문자열**(verify r2 의 22 는 같은 파일을 경로·파일명 두 형태로 센 값 — 부재 0 은 동일) |

- **남긴 곳: 4사이트.** `docs/PRD.md` 의 `ClaudeCodeAdapter`·`OpencodeAdapter`(설계 스케치) · `borderStrong`·`rustSoft`(실제 토큰명은 `border-strong`·`rust-soft`). **plan §6 이 PRD 를 비범위로 뒀다**(D-006) — 고치지 않고 아래 "보고만" 으로 올린다.

### E1~E5 처리

| # | 처리 | 관측 |
|---|---|---|
| E1 | ✅ `standardization.md:7` 배너 재작성 | `StandardConformance`·`migrate-sources` 를 "코드 반영" 에서 제외(둘 다 코드 0건), `ExtensionDeployer` 는 실체 `deploy()`/`DeployResult` 를 가리키는 **설계 이름**으로 명시. 동반 `terms.md:80`·`:87` · `GLOSSARY.md:73` |
| E2 | ✅ `provider-runtime.md:29` | `OrcaCapabilities` → `TurnExtensions`(구 이름 병기). 링크 대상 `adapters.md:71` 과 정합 |
| E3 | ✅ `ux-domains.md:81` | "현 `PlanApprovalCard`" → `ApprovalCard.tsx`(구 이름에서 일반화). `:79` 와 정합 |
| E4 | ✅ `persistence.md:116` + `terms.md:40` | `InflightTurn` → `TurnCoordinator`(`features/chat/turn-coordinator.ts`). 용어표 행을 교체하고 폐기를 명시 — `**bold**` 축을 §19 에 넣어 잡았다 |
| E5 | ✅ 수치 5종 + 재측정 명령 | base C `19`→**15** · B축 `13`→**15** · C축 `7`→**6** · 경로 총계 `20`→**21** · 드러난 결함 `21`→**22**. `[구현자 기입] 라운드 2` 와 INDEX 비고 두 곳. **재측정 명령을 함께 적었다** — 숫자만 고치면 다음 라운드가 다시 못 세운다 |

### 계측 세 층 확장이 드러낸 것 — E 밖 결함

r2 지적 5건 밖에서 **20사이트**를 더 닫았다. 전부 "현재형인데 코드에 없다" 는 같은 불변식이다.

| 축 | 자리 | 고친 내용 |
|---|---|---|
| lowerCamelCase | `provider-runtime.md:188`·`:202` | `createTurnInputStream` → **`createSessionInputStream`**(`streaming-input.ts:51`, `claude.ts:327` 호출). **r1 기준선부터 있었고 r2 가 `:188` 을 다시 쓰면서 사이트를 하나 더했다** |
| 〃 | `provider-runtime.md:188` | `requestRegistry`(코드 0건) → `SessionRuntimeRegistry`(`features/sessions/session-registry.ts`) |
| 〃 | `rendering.md:141`·`:144` · `provider-runtime.md:326` | `insertUsageEvent`/`getLatestUsage`/`usage_events`(0005) → `recordTurnUsage` → `DbQueries.insertTurnUsage`/`getLatestTurnUsage` · `turn_usage`(0006) |
| 〃 | `rendering.md:125` | `maxBytesPerToolRun` 을 **미구현 설계**(`StreamBufferPolicy`)로 표기 — 코드에 버퍼 상한이 없다 |
| 〃 | `runtime-ipc.md:39`·`:45`·`:56`·`:62`·`:63`·`:129` | `flushItem`→`reserveItem` · `flushHeld`→`reserveHeld` · `markConsumed`→`confirm`/`drainConfirmed` · `abortCause`→`AbortCause` · `onUnframedEvent`→`hasUnframedBacklog` · `checkForUpdatesOnStartup`→`UpdateController.checkForUpdates` |
| 〃 | `state.md:21`·`:81`·`:105` | `globalUpdatedAt` 제거(코드가 "전역 타임스탬프는 두지 않는다" 고 명시) · `SessionState`→`SessionEntry` 실제 필드 · `newChatSlot`→`pinnedSlot` |
| 〃 | 그 밖 | `adaptMcp`→`adaptRuntimeTools` · `insertSkillFromMenu`→`openSkillPicker` · `handleSessionLoad`→`app/handlers/session.ts` · `lastTurnLatencyMs` 삭제 · `buildQueryOptions` 서술 정정 |
| 주석 전용 실재 | `toOpencodeConfig` **9사이트** | `git log -S toOpencodeConfig -- app/src` = **빈 출력** — 존재한 적이 없다. `adapters.md:220` 의 `✅ 구현됨` · `standardization.md:148` 의 "이미 구현돼 있다" · `security.md:95` 의 "순수 함수 + 단위 테스트만 존재" 가 전부 거짓이었다 |
| 〃 | `state.md:134` | `TurnRegistry` 는 **renderer** `chatStore.ts` 주석에만 있는데 문서는 "**main 은**" 이라 썼다 → `SessionRuntimeRegistry`. **존재 ≠ 주장한 위치에 존재** |
| `**bold**` | `terms.md:55`~`:57` | `PythonRuntime`·`uv`·`buildPyEnv` 3행이 현재형 정의였다 — `GLOSSARY.md:49` 는 같은 것을 **"제거됨(0050 PR-B) · 어휘를 재사용하지 않는다"** 로 적는다. 1행으로 접었다 |
| 소문자-하이픈 | `IPC_CONTRACT.md:69` · `TRD.md:363`·`:372` · `standardization.md:100` | `claude-model-parser` → 실경로 `claude/model-parser.ts` |
| 경로 축 비-ts 1회 스윕 | `GLOSSARY.md:49` · `TRD.md:105` | `prompts/policies/python-runtime.md` "잔존" 삭제 — `app/src/main/prompts` **디렉토리가 없다**(`system-prompt.md:79` 가 제거를 명시) |
| 〃 | `state.md:138` | `docs/architecture.md` → `docs/ARCHITECTURE.md`(대소문자) |
| 육안 | `terms.md:25`·`:28` | `Backend` 값이 `'claude-code'` 로 적혀 있었다 — 실제 `export type Backend = 'claude'`(`shared/ipc.ts:255`). `ClaudeCodeAdapter` 행은 실체 `adapters/claude.ts` 로 |

### Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ | 이번 변경은 전부 에이전트/배포자가 읽는 서술 — 새 UI 문구 0 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ | §5 3행 중 2행(§8.1 회귀 테스트 · arch 상태표)에 대응. 새 행 불요 |
| 실패가 "아무 일도 안 일어남" 으로 보이지 않는가 | ✅ | 부재 인용의 조용한 실패가 이번 작업의 대상 자체다. §19 게이트가 관측점 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | 문서 작업 (코드 변경 0) |

### 선조치 (구현 세부·명백한 오기)

| # | 내용 | 근거 |
|---|---|---|
| 1 | `terms.md:25` `Backend` 값 `'claude-code'` → `'claude'` | `shared/ipc.ts:255 export type Backend = 'claude'` |
| 2 | `terms.md:28` `ClaudeCodeAdapter` 행 → `claude 어댑터`(`adapters/claude.ts`), 산출은 `NormalizedEvent` | `GLOSSARY.md:15` 가 "구 `ChatEvent` 는 제거됨" 을 명시 |
| 3 | `terms.md:89` AGENTS.md 행의 `prompts/` 통합 서술 삭제 | 디렉토리 부재 — `system-prompt.md:79` |
| 4 | `state.md:70` 의 `pendingDelta` 를 "구" 표기로 | 같은 문서 `:47` 이 제거를 명시 |

### 보고만 (권한 밖)

| # | 내용 | 왜 |
|---|---|---|
| 1 | **`docs/PRD.md:236`·`:241` 의 디자인 토큰 이름이 코드와 다르다** — `borderStrong`/`rustSoft` 인데 실제 Tailwind 토큰은 `border-strong`/`rust-soft`(`shared/ui/Button.tsx`·`Markdown.tsx`) | plan §6 이 `docs/PRD.md` 를 **비범위**로 뒀다(D-006). 이번 턴에 고쳤다가 되돌렸다 — PRD diff 0 유지 |
| 2 | `docs/PRD.md:159` 가 `ClaudeCodeAdapter`/`OpencodeAdapter` 를 아키텍처 스케치로 인용 | 동일 — 비범위 |
| 3 | AC6 의 `ADR-002` 링크가 `prompts/` 제거 근거를 담지 않는다 | r2 보고만 #1 그대로 — 링크 대상 교체는 D-003 실현 방식 변경이라 사용자 결정 |
| 4 | 루트 `AGENTS.md` 의 `src/shared/i18n/ko.ts` ↔ `TRD.md N2` 갈림 | D-007 범위 밖 |
| 5 | `app/src/shared/ipc.ts:394` 주석의 `InteractionBroker` | 코드 변경 0 이 이번 비범위 |
| 6 | PRD §11 OQ9 | D-006 — 사용자 결정 대기 |

### 설계 대비 명시적 차이

- **plan §11 이 열거하지 않은 파일 6개를 고쳤다** — `runtime-ipc.md`·`state.md`·`terms.md`·`GLOSSARY.md`·`persistence.md`·`adapters.md`. 이유: 계측 세 층을 넓히자 같은 불변식이 이 파일들에서 성립하지 않았다. §11 표는 r1 계측이 찾은 파일만 담고 있다.
- **`docs/PRD.md` 를 고쳤다가 되돌렸다.** §19 스윕 SCOPE 는 docs 전수라 PRD 사이트를 관측하지만, §6 의 *수정 범위* 는 PRD 를 제외한다. **관측 범위와 수정 범위가 다르다** — 이번에 §19 버킷 표에 `비범위 — 보고만` 행을 두어 둘을 구분했다.

### 구현 보고 (r3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | **17** = docs 콘텐츠 **15** + handoff 2(`plan.md`·`INDEX.md`). `PRD.md` 는 고쳤다가 되돌려 **diff 0**. **코드 변경 0** · `AGENTS.md` 변경 0 (`git status --short` 재확인) |
| 실행 명령 | §19 경로 A/B/C + 새 심볼 블록 · `node scripts/check-doc-inventory.mjs --check` · `npm run typecheck` · `npm run lint` · scoped `vitest run` |
| **관측한 게이트 산출** | 인벤토리 **3항목 ok**(`generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok`, exit 0) · typecheck 하위 3개 전부 실행 **error 0줄** · lint `✖ 1 problem (0 errors, 1 warning)`(기존 `react-hooks/incompatible-library` @ `useTranscriptVirtualizer.ts:22`) · scoped vitest `Test Files 1 failed | 40 passed (41)` · `Tests 506 passed (506)` |
| 환경 기인 실패 분리 | 실패 1파일 = `src/main/app/chat-turn.continuity.test.ts`, 서명 `Error: Electron failed to install correctly` @ `node_modules/electron/index.js:17`. **guides §8.1 3번 각주가 적은 예외와 글자 그대로 같다** — r2 검증 세션과 동일 산출 |
| 게이트가 트리를 바꿨는가 | 아니다. `npm run lint` = `eslint --cache --fix` 지만 실행 후 `git status --short` 에 docs 외 변경 0 |
| 강제 지점 전수 | **8/8** (위 표) · 남긴 곳 4사이트(PRD, 비범위) |
| **AC 자기보고** | AC1 ✅ A **0줄** · B **11** · C **9** = §19 예외표 12행/20사이트와 일치 · AC2 ✅ `grep -n ❌ docs/arch/*/overview.md` = **7행**(backend 4 · frontend 3) · AC3 ✅ `grep -c '^## '` = **20** 불변 · AC4 ✅ 6패턴 각 **0**파일 · AC5 ✅ 비-test `.mjs` **6** = 열거 6 · AC6 ✅ `system-prompt.md:77` "정적 정책 append — 미채택" + `:81` ADR-002 링크 · AC7 ✅ 명령 3개 실행(위 산출) + 인용 테스트 **21/21 부재 0** · AC8 ✅ §8.2 1번 = `auth-definitions.ts` = §1.1 트리 `:58` · AC9 ✅ `grep -rc disallowedTools app/src` 히트 **0**파일 + 미채택 표기 4곳 · AC10 ✅ `release-operations.md:12` "main push + 모든 PR + `workflow_dispatch`" = `ci.yml:11~22` · AC11 ✅ `docs/INDEX.md` 2행 · AC12 ✅ 3항목 ok |
| **합계 검산** | `✅ 12 · ⚠️ 0 · ❌ 0 = 총 12` — 분모는 §7 의 AC1~AC12. **r2 와 분모 동일**(분할·추가 없음) |
| 블로커 / 역질문 | AC6 의 ADR 링크 근거(보고만 #3) · PRD 토큰명(보고만 #1) · PRD §11 OQ9(D-006) |
| 대상 커밋 | `f9258f4` |

### Review Signals — 사실만 (r3)

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가: 그렇다. 세 라운드 연속이다.** r1 = 추출 정규식, r2 = 분류 단위, r3 = 실재 테스트 + 추출 3형태. 매 라운드 "지적을 전부 재현하고 고쳤다" 가 사실이었고, 매번 **계측의 다른 층**이 남아 있었다.
- **그것을 막았어야 할 plan 지침이 있었는가: 있었다.** §10 이 r2 에 "계측 정의가 곧 불변식의 정의가 되므로 정의를 좁게 잡으면 게이트 green 이 전수를 뜻하지 않는다" 를 명문화했다. **그 문장을 쓴 라운드가 실재 테스트에서 다시 좁았다** — 규칙을 적는 것이 적용을 보장하지 않는다는 관측이 두 번째다. 이번에 §10 에 **"계측은 세 층이 각각 좁아질 수 있다"** 를 층 이름과 함께 적었다.
- **r2 가 자기 수정으로 만든 표면을 스스로 검사하지 않았다**: `provider-runtime.md:188` 은 r2 가 D1 을 고치며 다시 쓴 줄인데, 그 줄이 인용한 `createTurnInputStream`·`requestRegistry` 둘 다 코드에 없었다. 수정 직후의 코드를 본 사람은 구현자뿐이다(SKILL §5.3).
- **관측 범위 ≠ 수정 범위**가 이번에 처음 문제가 됐다 — §19 SCOPE 는 PRD 를 포함하고 §6 은 제외한다. 버킷 표에 `비범위` 행을 만들어 갈랐다.
- 반복해서 부딪히는 환경 한계: electron 바이너리 1파일 — r1·r2 와 동일 서명. `node_modules` 는 이번 세션에 있었다.
- 현재 라운드 수: **3**. `docs/handoff/AGENTS.md` 의 review 트리거 중 *같은/유사 실패 반복* 은 세 라운드째 성립하고, *라운드 3 초과* 는 다음 재구현부터다. 이번 라운드는 **사용자가 review 없이 진행을 선택**했다.

---

## [구현자 기입] 라운드 4 — F1~F3 + 계측 세 축

> 선행: `handoff-review` Round 10 (`3ba56cb`) — *라운드 3 초과* 트리거. 결론은 "층을 더 나열하지 말고 **고친 장치가 결함을 볼 수 있음을 먼저 보여라**". 이번 라운드는 그 규칙 아래 돈 첫 라운드다.

### 설계 리뷰

- Part I·AC·Decision Ledger 무변경. **AC13 을 만들지 않았다** — 시제 축을 AC 로 승격할지 물었고 사용자가 **§19 게이트로만** 을 골랐다. 분모는 12 그대로다.
- §10 의 "계측은 세 층" 문장을 고쳤다. 그 문장을 쓴 라운드(r3)가 같은 라운드에서 네 번째 층에 빠졌으므로 **층 열거는 해법이 아니라는 관측**이 본문에 있어야 한다(출처: verify r3 §14 · review Round 10).
- verify r3 §13 의 ⓐⓑⓒ 를 그대로 §19 에 반영했다. `handoff-verify` 가 지시한 범위 안이다.

### 강제 지점 전수 (r4 · §10 대조)

**§10 계약 6행 · 전부 이번 턴 재현.** 각 행에 실행한 명령과 관측을 함께 적는다.

| §10 계약 | 닫은 지점 | 재현 명령 / 관측 | 결과 |
|---|---|---|---|
| 수치를 본문에 쓰지 않는다 | 범위 내 문서 전체 | `node scripts/check-doc-inventory.mjs --check` → `prose ok: no inventory counts restated in current-state docs` | ✅ |
| 상대 링크가 해석된다 | 〃 | 동 명령 → `links ok: every relative markdown link resolves` | ✅ |
| 인용 경로 실재 (A·B·C) | 범위 내 문서 + AGENTS 3종 | §19 스윕 → **0 / 11 / 9 = 20줄**, 예외표 12행과 1:1, 그 밖 0줄 | ✅ |
| 〃 **매칭 의미** | B 축 실재 테스트 | `grep -qF` → `grep -qE "(^\|/)…$"`. 교체 전 11 / 교체 후 12, 차집합 = F1 1건 | ✅ **F1 닫음** |
| 인용 심볼 실재 (S1~S5) | 〃 | §19 스윕 → **220사이트 / 131심볼 · 미분류 0**. 버킷 합 `63+75+58+10+10+4 = 220` | ✅ |
| 〃 **판정 축(시제)** | 심볼 산출의 부분집합 | 시제 스윕 → **98사이트 전건 판정 · 거짓 단언 0** | ✅ **F2·F3·F4 닫음** |
| guides 절차 명령 실행 | §8.1 명령 + 게이트 | 4종 전부 실행, 산출은 아래 «구현 보고» | ✅ |
| `arch/` 는 현재 상태만 서술 | r4 가 `docs/arch/**` 에 더한 줄 | `git diff -U0 docs/arch/ \| grep '^+'` → 신규 handoff-번호 델타형 **0건**(`0015` 히트는 변경 안 한 같은 줄의 기존 문구) | ✅ |

- **표에 없는데 같은 불변식이 필요한 지점: 있었다.** 시제 축이 `provider-runtime.md` 의 `③ 현재 코드 갭` 절 **3곳**을 냈고(F2 는 그중 1곳), `claude-code-spec.md:103` 1곳을 더 냈다(F4 — 아래).
- **남긴 곳: 없다.** §10 6행 + r4 신설 2축 = 8/8.

### 검사 장치 적대 검사 (handoff-impl §3 · §8)

이번 턴에 고친 장치 3개에 알려진 결함을 심고 잡히는지 확인했다. 심은 뒤 되돌렸고 `git status --short --untracked-files=all` 에 `docs/GLOSSARY.md` 없음.

| 장치 | 심은 결함 | 관측 | 판정 |
|---|---|---|---|
| ⓐ B 축 경계 매칭 | `` `app/hooks/useSidebarSlots.ts` `` 1줄 | B 11 → **12**, diff = `B docs/GLOSSARY.md:100` | 잡는다 |
| ⓑ S5 호출식 추출 | `` `nonExistentProbeFn(` `` 1줄 | 심볼 220 → **222**, `ABSENT\|nonExistentProbeFn` 출현 | 잡는다 |
| ⓒ 시제 필터 | "현행은 `NonExistentProbeSymbol` 하나뿐이다" 1줄 | 시제 98 → **100**, 심은 2건 모두 출현 | 잡는다 |

**이 검사가 자기 술어의 절반이 죽어 있는 것을 잡았다.** 초안의 `한다\b`·`이다\b` 는 이 로케일에서 한 번도 발화하지 않는다 — 한글 뒤에 word boundary 가 서지 않는다. `\b` 를 뺀 뒤 산출이 **47 → 98** 로 늘었다. 47 로 보고했다면 절반이 안 보인 채 "전건 판정" 이 됐다.

**사전 필터도 검사했고 버렸다.** 98 → 27 로 줄이려고 이력·부정 표지(`구|폐기|미채택|없음|보류…`) 필터를 시험했는데 **F2·F3 원문이 둘 다 자동 통과**했다(F2 는 같은 줄에 "없음", F3 는 "폐기"를 갖는다). 알려진 결함을 못 보는 필터로 줄인 목록은 전수가 아니므로 **98건을 전부 육안 판정**했다.

### F1~F3 처리 + 불변식 전수

| # | 불변식 (지점 이름을 뺀 문장) | 전수 결과 |
|---|---|---|
| F1 | 인용 경로는 **부분 문자열이 아니라 파일 경계로** 실재해야 한다 | `state.md:105` `.ts`→`.tsx` 1곳. 경계 매칭으로 재측정한 12건 중 나머지 11건은 전부 §19 예외표 등재 |
| F2 | `③ 현재 코드 갭` 이 서술하는 **부재는 지금 코드의 부재**여야 한다 | `provider-runtime.md` **3곳** — `:274`(ErrorClassifier) · `:346`(AuthStore) · `:509`(WorkspaceManager). 사용자가 "3곳 다" 선택 |
| F3 | 코드가 넘기지 않는 옵션을 **보류 단서 없이 현재형으로** 쓰지 않는다 | `disallowedTools` **25사이트 전수** — 단서 없던 2곳(`standardization.md:117`·`TRD.md:387`) 정정. 나머지 23 은 비결함(사유는 아래) |

- **F3 비결함 23사이트의 사유 3갈래**: ⓐ 이미 단서 있음(`adapters.md:67`·`:126`·`:178` · `security.md:91`·`:102` · `TRD.md:378`·`:604` · `standardization.md:146` · 가이드 `:37`·`:328`·`:330`·`:377`) ⓑ 외부 SDK 스펙 서술(`claude-code-spec.md` 5곳) ⓒ 코드블록·파이프라인 다이어그램 내부(가이드 `:46`·`:88`·`:338`·`:348`) + `PRD.md:277`(D-006 비범위).
- **F2 정정은 `③` 관례를 따랐다** — 같은 문서 `:217`(`✅ 해소`)·`:297`·`:322`(`✅ 구현 완료`). `:346`·`:509` 는 잔여가 실제로 있어 **`✅ 부분 해소` + `잔여 갭`** 으로 적었다(`:37`·`:98`·`:143` 의 기존 형태).
- **D-002 지켰다** — `^## ` **20개**, READY 커밋부터 HEAD 까지 불변. ④ 인터페이스 블록 무변경.

### 계측이 새로 드러낸 것 — F 밖 결함 1건

| # | 결함 | 관측 | 처리 |
|---|---|---|---|
| **F4** | `claude-code-spec.md:103` 이 "`stream-json` 만 사용한다. ClaudeCodeAdapter 는 stdout 을 NDJSON 으로 파싱하여 `ChatEvent` 로 정규화한다" 를 현재형으로 단언 | 셋 다 비주석 **0건** — `ClaudeCodeAdapter`·`ChatEvent`·`stream-json`. Orca 는 CLI 를 띄우지 않고 SDK `query()` 를 인프로세스로 부른다 | **선조치** — `⛔ Orca 비적용` 로 바꾸고 정본을 `adapters.md`·`provider-runtime.md` 로 링크. 단발 모드 미채택 사유는 유효하므로 보존 |

F2 와 같은 뿌리다 — `stream-json` 이 실제 CLI 플래그라 `외부` 버킷으로 빠졌고, 버킷은 문장의 시제를 묻지 않는다.

### Product/UX 파생 검토

- **소비자 있는 문구인가**: 이번 변경은 전부 문서 문장이고 소비자는 *문서를 읽는 에이전트/배포자*다. F2 의 세 절은 `provider-runtime.md:11` 배너가 "절별 판정은 각 절의 ③ 이 갖는다" 로 이미 가리키고 있어 소비 경로가 있다.
- **실패가 조용한가**: 그렇다 — 부재 인용은 예외를 던지지 않고 독자가 자기 체크아웃을 의심한다. 이것이 이 handoff 의 전제이고 바뀌지 않았다.
- **두 곳 쓰기**: 이번 라운드 판정이 `plan.md`(본 절)와 `INDEX.md` 보드 두 곳에 산다. 보드를 먼저 읽으므로 **커밋 하나에서 함께** 갱신했고 수치 사본은 아래 검산 줄 기준으로 맞췄다.
- 범위 밖이라 안 고친 것: `adapters.md:55` 코드 샘플 주석의 `disallowedTools 게이팅`. 바로 아래 `:67` 이 보류를 달아 같은 절 안에서 해소되지만, **샘플 자체는 단서가 없다** — 파생 이슈로 남긴다.

### 선조치 (구현 세부·명백한 오기)

1. **F4** — 위 표. 계측이 낸 결함이고 문장 정정이라 선조치.
2. §19 심볼 블록 끝에 `| sort -u` 를 명시했다(O2). r3 도 dedup 값을 보고했는데 규칙이 안 적혀 재현자가 raw 를 본다.
3. §19 버킷표에 `SDKUserMessageReplay` 를 명시했다(O1) — `SDK*Message`(6) 약칭이 못 덮어 다음 라운드에 오탐으로 뜬다.

### 보고만 (권한 밖)

1. **AC13 미신설** — 시제 축을 제품 계약으로 올릴지는 사용자가 "§19 게이트로만" 을 선택했다. 게이트는 구현 턴이 관리하므로 다음 라운드가 §19 를 안 돌리면 이 축은 사라진다. **AC 로 올릴지는 여전히 열린 선택지다.**
2. `disallowedTools` **채택 여부** — D1 미결. 이번 라운드는 문구만 대칭으로 맞췄고 코드는 안 건드렸다.
3. AC6 의 ADR 링크 대상 교체 — D-003 실현 방식 변경이라 사람 결정(r2·r3 과 동일).
4. `docs/PRD.md` 토큰명·어댑터명 — D-006 비범위. PRD diff **0**.
5. 루트 `AGENTS.md` — D-007 비범위. diff **0**.

### 설계 대비 명시적 차이

1. **시제 축 산출이 계획의 48 이 아니라 98 이다.** 계획 수치는 `\b` 가 든 술어로 잰 값이고 그 술어는 발화하지 않는다. 적대 검사로 발견해 술어를 고쳤다 — 계획보다 두 배를 판정했다.
2. **F 밖 결함 1건(F4)을 함께 고쳤다.** 계획에 없던 파일(`claude-code-spec.md`)이다. 계측을 넓히면 같은 불변식이 그 파일에도 걸린다.
3. **`disallowedTools` 전수 분모가 11 이 아니라 25 다.** 계획의 11 은 백틱 인용만 센 값이고, 전수 확인은 백틱 없는 인용까지 포함했다.

### 구현 보고 (r4)

**변경 파일 6** — `docs/arch/frontend/state.md`(F1) · `docs/arch/backend/provider-runtime.md`(F2 ×3) · `docs/arch/backend/standardization.md`(F3) · `docs/TRD.md`(F3) · `docs/claude-code-spec.md`(F4) · `docs/handoff/0191-docs-code-resync/plan.md`(§19 + 본 절).

**게이트 — exit code 가 아니라 관측한 산출.** `app/AGENTS.md` 의 ABI 가이드를 따랐고 `npm test` 는 쓰지 않았다(DB 동작 검증 불요). `node_modules` 가 이 세션에 없어 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 를 먼저 돌렸다.

| 명령 | 관측한 산출 |
|---|---|
| `node scripts/check-doc-inventory.mjs --check` | `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` · exit 0 |
| `npm run typecheck` | 하위 3개(`:node`·`:web`·`:test`) 전부 실행, **error 0줄** |
| `npm run lint` | `✖ 1 problem (0 errors, 1 warning)` — `react-hooks/incompatible-library` @ `useTranscriptVirtualizer.ts:22` |
| `./node_modules/.bin/vitest run src/main/features/{auth,gate,harnesses,plugins} src/main/app` | `Test Files 1 failed \| 40 passed (41)` · `Tests 506 passed (506)` |

- **환경 기인 실패 분리**: 실패 1파일 = `src/main/app/chat-turn.continuity.test.ts`, 서명 `Error: Electron failed to install correctly` @ `node_modules/electron/index.js:17`. guides §8.1 이 예외로 명시한 건이고 r1·r2·r3 과 같은 서명이다. **이번 변경과 무관**(코드 diff 0).
- **게이트가 작업 트리를 바꿨는가**: 아니다. `npm run lint` 는 `--fix` 지만 실행 뒤 `git status --short --untracked-files=all` 이 내 편집 5파일만 낸다.

**AC 재측정 — 12행 전부 이번 턴 관측.**

| # | 관측 | 결과 |
|---|---|---|
| AC1 | 경로 스윕 `0 / 11 / 9 = 20줄`, 예외표 12행과 1:1 | ✅ |
| AC2 | `grep -c ❌` → backend 4 · frontend 3 = **7행**, 열거와 동일 | ✅ |
| AC3 | `^## ` **20** 불변 · ③ 3곳 정정 후 새 인용 경로 7종·심볼 11종 전부 비주석 실재 | ✅ |
| AC4 | 6패턴 각 **0파일** | ✅ |
| AC5 | 비-test `.mjs` **6** = `app/AGENTS.md:144~150` 열거 6 | ✅ |
| AC6 | `system-prompt.md:77` = `## 2. 정적 정책 append — 미채택` · ADR-002 링크 1건 | ✅ |
| AC7 | 인용 `*.test.ts` **21개 고유 문자열 · 부재 0**(경로형·파일명형 모두 해석) · 명령 4종 실행 | ✅ |
| AC8 | `closed-network-extensions.md:115` `app/deployment/auth-definitions.ts` = §1.1 트리 `:58` | ✅ |
| AC9 | `grep -rn disallowedTools app/src` = **0** · 가이드 미채택 표기 4곳 유지 | ✅ |
| AC10 | `release-operations.md:12` = `ci.yml:11~22`(main push + 모든 PR + `workflow_dispatch`, paths 동일) | ✅ |
| AC11 | `docs/INDEX.md` 두 행 존재 | ✅ |
| AC12 | 인벤토리 3항목 ok · exit 0 | ✅ |

**검산: `✅ 12 · ⚠️ 0 · ❌ 0 = 총 12`.** 분모는 §7 의 AC1~AC12 — 분할·추가 없음(AC13 미신설, 사용자 결정). r3 과 같은 분모라 직접 비교 가능하다.

**강제 지점: 8/8** (§10 6행 + r4 신설 2축). 남긴 곳 없음.

**대상 커밋**: `7f5638c` (해시 기입 커밋 포함 시 `7f5638c..HEAD`).

### Review Signals — 사실만 (r4)

- **이전 라운드와 동일 축인가: 부분적으로 그렇다.** F1~F3 은 r3 verify 가 낸 "계측 정의가 불변식보다 좁다" 의 같은 문장이다. 다만 **이번 라운드는 그 좁음을 스스로 발견했다** — `\b` 죽은 술어와 사전 필터 눈멂 둘 다 적대 검사가 냈고, 검증자가 아니라 구현자가 먼저 봤다.
- **막았어야 할 지침이 있었는가: 있었고 이번엔 걸렸다.** `handoff-impl §3`(review Round 10 이 테스트 → 장치 전반으로 넓힌 조항)이 정확히 이 자리에서 발화했다. r3 까지는 이 조항이 테스트로만 스코프돼 스윕에 닿지 않았다.
- **반복되는 환경 한계**: electron 바이너리 1파일 — r1~r4 동일 서명. 이번 세션은 `node_modules` 가 없어 `npm ci` 를 먼저 돌렸다(r3 세션과 다른 점).
- **자기 검증 겹수**: 설계·구현·검증·review 전부 Claude Code. 변하지 않았다.
- 현재 라운드 수: **4**.

---

## [검증자 기입] 파생 이슈

> r1 검증: [`verify.md`](verify.md) 부록 r1 (FAIL — AC 8✅/4⚠️ · 강제 지점 3/6 재현).
> r2 검증: [`verify.md`](verify.md) 부록 r2 (FAIL — AC **12/12** · 강제 지점 **7/8** · 기준 밖 결함 4건).
> r3 검증: [`verify.md`](verify.md) 부록 r3 (FAIL — AC **12/12** · 강제 지점 재현 · 기준 밖 결함 3건).
> r4 검증: [`verify.md`](verify.md) (**FAIL** — AC **12/12** · 강제 지점 **6/8** · 기준 밖 결함 4건 + 경미 3건).
>
> **D1~D6 은 r2 verify 가, E1~E5 는 r3 verify 가, F1~F3 은 r4 verify 가 전건 닫힘을 재측정으로 확인했다.** 이번 라운드 미충족은 아래 G1~G7 이다.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | `provider-runtime.md:188` 이 현재형으로 `claude-code.ts` + "매 턴 one-off `query()`" 를 적어 같은 문서 line 202(streaming input·라이브 핸들)와 모순 | verify r1 §13 | 파일명을 `adapters/claude.ts` 로, 상태 문구를 line 202 와 정합하게 | **r2 검증 통과** |
| D2 | `ux-domains.md:95` 가 부재 파일 `features/skills/components/customize/SkillsCustomizeView.tsx` 인용. 심볼은 `layers.md:69`·`frontend/overview.md:76` 에도 | verify r1 §13 | 실제 컴포넌트명으로 3곳 치환 | **r2 검증 통과** |
| D3 | `IPC_CONTRACT.md:445` 가 0062 에서 제거된 `prompts/plan-feedback.ts` 인용 (실제 `adapters/plan-feedback.ts`) | verify r1 §13 | 경로 정정 | **r2 검증 통과** |
| D4 | `system-prompt.md:106` 이 현재 cwd 소유자로 부재 경로 `ipc/router.ts` 인용 | verify r1 §13 | 현재 소유 파일로 정정 | **r2 검증 통과** |
| D5 | `adapters.md §3.2.5` 가 "코드 진실 … 이미 구현·테스트된 코드다" 로 `OrcaHookSet`·`OrcaHookEvent`·`OrcaHookHandler`·`ORCA_TO_CLAUDE_EVENT` 단언 — `grep -rn OrcaHookSet app/src` = 0 | verify r1 §13 | 현재 이름(`NormalizedHookSet`·`adaptHooks`)으로 치환. `provider-runtime.md:29`·`terms.md:30` 동반 | **r2 검증 통과** |
| D6 | 자기보고 개수 3축 불일치 — AC2 잔여 `❌`(plan 5·impl 6·실측 **7**) · §8 내역 합 18≠20 · provider-runtime 몫 실측 **13**(기재 11) | verify r1 §7 | 세 숫자를 실측으로 고치고 §19 스윕을 상대 경로까지 확장, 심볼 축을 §10 강제 지점 표에 정식 등재 | **r2 검증 통과** |

### 라운드 2 파생 이슈 (verify r2)

> 판정 근거·재현 명령은 [`verify.md`](verify.md) §5·§7·§13.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| E1 | `standardization.md:7` 배너가 `StandardConformance`·`migrate-sources`·`ExtensionDeployer` 를 "코드에 반영됐다" 로 단언 — 코드 0건이고 같은 문서 `:146`·`terms.md:82` 가 "구현체 없음/목표 계약" 이라 적는다 | verify r2 §13 | 배너를 `:146` 과 정합하게. `ExtensionDeployer` 는 실체(`deployer.ts` 의 `deploy()`)를 가리키게 | **r3 검증 통과** |
| E2 | `provider-runtime.md:29` 가 "Tier A `OrcaCapabilities`" 를 현재형으로 씀 — 링크 대상 `adapters.md:71` 이 "구 … 현재 이름은 `TurnExtensions`" | verify r2 §13 | `TurnExtensions`/`ExtensionBuilder` 로 치환 | **r3 검증 통과** |
| E3 | `ux-domains.md:81` "현 `PlanApprovalCard` 패턴 재사용" — 같은 문서 `:79` 가 `ApprovalCard.tsx` 일반화를 적는다 | verify r2 §13 | 현재 컴포넌트명으로 정정 | **r3 검증 통과** |
| E4 | `persistence.md:116` 이 `InflightTurn` 상태 머신을 현재형으로 인용 — 코드 0건(현 `turn-coordinator.ts` `TurnCoordinator`), `runtime-ipc.md:10` 은 폐기를 명시. `terms.md:40` 의 `**InflightTurn**` 항목 동반 | verify r2 §13 | 현재 이름으로 정정하거나 폐기 표기. `**bold**` 심볼은 §19 스윕 밖이라 함께 잡는다 | **r3 검증 통과** |
| E5 | 자기보고 수치 5종이 재측정과 갈림 — base C `19`→15 · B 축 `13`→15 · C 축 `7`→6 · 경로 총계 `20`→21 · "드러난 결함" `21`→22(본 문서 + INDEX 비고) | verify r2 §7 | 시작 상태·증분 서술을 실측으로 정정. HEAD 상태 수치는 전부 일치하므로 대상 아님 | **r3 검증 통과** |

- **불변식을 사이트 단위로 다시 세운다** — "한 심볼이 어느 버킷인가"(47)가 아니라 "이 사이트의 단언이 현재형인가"(67). E1~E3 은 전부 두 축이 갈린 자리다.
- §19 심볼 블록을 `**bold**`·소문자-하이픈 식별자까지 넓히지 않는다면 **넓히지 않은 이유를 §19 에 적는다**(§10 이 r2 에 쓴 "계측 정의가 곧 불변식의 정의" 문장의 귀결).

### 라운드 3 파생 이슈 (verify r3)

> 판정 근거·재현 명령은 [`verify.md`](verify.md) §3·§5·§7·§13. **세 건 모두 §19 게이트가 green 인 채로 남았다** — 정정만 하면 다음 라운드가 또 열린다.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| F1 | `state.md:105` 가 없는 파일 `app/hooks/useSidebarSlots.ts` 인용 — 실파일은 `…/app/hooks/useSidebarSlots.tsx`(`.tsx`), `layers.md:42` 는 `.tsx` 로 적는다. **r3 이 `newChatSlot`→`pinnedSlot` 정정하며 새로 쓴 줄이다** | verify r3 §13 | 확장자 정정 + §19 B 축 실재 테스트를 **suffix 매칭**으로(현재 `grep -qF` substring 이라 `.ts` 가 `.tsx` 안에 포함돼 통과) | **r4 닫음** |
| F2 | `provider-runtime.md:274` 가 "현행은 `detectError()` … 정규 분류기/`retryable` 없음" 이라 단언 — `detectError` 0건, `ErrorCode` 는 주석에만, 코드에는 `claudeErrorClassifier`(`adapters/error-classifier.ts`) + `retryable`(`infra/errors.ts:57`). 같은 문서 `:409`·`backend/overview.md:214` 와 모순 | verify r3 §13 | 문장을 현재 코드로 정정 + 추출에 **호출식**(`` `fn(` ``, 범위 내 16사이트) 추가 + 버킷 판정을 **사이트의 시제**로(이 사이트는 산출에 있었으나 `역사` 로 분류돼 통과) | **r4 닫음** |
| F3 | `standardization.md:117`·`TRD.md:387` 이 `disallowedTools` 차단을 **보류 단서 없이** 현재형으로 씀 — 코드 0건(AC9 의 그 관측). 형제 `adapters.md:67`·`security.md:91` 은 단서를 단다 | verify r3 §13 | 두 사이트에 `보류/미채택` 단서를 달아 형제와 대칭으로. **채택 여부 자체는 D1 사용자 결정** | **r4 닫음** |

- **다음 재구현 전에 [`handoff-review`](../../../.agents/skills/handoff-review/SKILL.md) 를 수행한다** — `docs/handoff/AGENTS.md` 의 *라운드 3 초과* 트리거가 다음 라운드부터 성립하고, *같은/유사 실패 반복* 은 네 라운드째다(계측이 좁은 자리가 매번 다른 층에서 열렸다).
- 수정 불요 관찰 5건(버킷 목록 1토큰 누락 · raw 215 vs dedup 211 · §10 6행 vs 표 8행 · INDEX 비고 증가 · 비범위 버킷 라벨)은 verify r3 §13 파생 관찰.

### 라운드 4 파생 이슈 (verify r4)

> 판정 근거·재현 명령은 [`verify.md`](verify.md) §3·§5·§6·§13. **F1~F3 은 닫혔고 정정 문장 세 건은 코드 대조로 전부 참이다.** G1~G4 는 그 정정을 만든 계측이 아직 좁아서 남은 자리다.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| G1 | `ChatEvent` **5사이트**가 없는 심볼을 현재형으로 단언 — `provider-runtime.md:17`·`:25`·`:35`·`:403` · `claude-code-spec.md:167`. 코드 실재 0(비주석 0, `shared/protocol.ts:51` 이 "폐기" 명시). 같은 문서 `:37`·`:61` 과 자기모순 | verify r4 §13 | 5사이트 정정 + **§19 심볼 실재 테스트를 단어 경계로**(`grep -rnF` → `grep -rnwF`). F1 이 경로 축에 세운 문장을 심볼 축으로 올린다 | **r5 대상** |
| G2 | F4 불변식이 **1/7 사이트**에만 적용 — `claude-code-spec.md:28`·`:57`·`:167`·`:302`·`:366`·`:399` 가 CLI spawn 을 현재형으로 유지. `:57` 은 r4 가 고친 `:103` 과 정면 모순 | verify r4 §13 | 채택 박스 전수를 현재 실행 방식과 대조. **어디까지 현재화할지는 사람 결정**(verify §10) | **r5 대상** |
| G3 | `provider-runtime.md §12` "현행 코드 심볼" 열에 부재 2/11(`ChatEvent`·`detectError`). r4 의 F2 정정이 이 표를 정본으로 가리킨다 | verify r4 §13 | 열 라벨을 실제 의미로 바꾸거나 부재 행에 구/폐기 표기. `:274` 포인터 문장과 정합 | **r5 대상** |
| G4 | 계측 3한계가 §19 에 미기록 — ⓐ 실재 테스트 substring(차집합 +55사이트) ⓑ 시제 술어가 줄 단위라 표 헤더 시제 상속을 못 봄 ⓒ 추출이 맨 CamelCase 산문을 못 봄 | verify r4 §13 | ⓐⓑⓒ 를 "넓힌 축" 또는 "넓히지 않은 축과 이유" 에 등재 | **r5 대상** |
| G5 | `GLOSSARY.md:46` 이 "`AuthSpec` 이 소유한다" 로 현재형 — 현 이름 `AuthMethod`. 같은 파일 `:33` 은 "(구 `AuthSpec`)" 로 올바름 | verify r4 §13 | 현재 이름으로 정정. G1 의 경계 매칭이 열리면 함께 잡힌다 | **r5 대상** |
| G6 | `ux-domains.md:79`·`IPC_CONTRACT.md:442` 가 `pendingToolApproval`(단수) 인용 — 실제 `pendingToolApprovals`(복수) | verify r4 §13 | 복수형으로 정정 | **r5 대상** |
| G7 | r4 가 도입한 `⛔` 가 `claude-code-spec.md` 자기 범례(✅/❌/⏳) 밖. docs 전체 1곳 | verify r4 §13 | 범례 등재 또는 `❌ Orca v1 미사용` 으로 통일 | **r5 대상** |

- **G1·G3·G5·G6 은 한 불변식이다** — "인용 심볼은 부분 문자열이 아니라 **단어 경계로** 실재해야 한다". §19 한 글자(`-F`→`-wF`)로 분모가 220 → 275 로 열리고, 늘어난 55사이트를 전건 분류·시제 판정하면 네 건이 같이 닫힌다.
- **선행 `handoff-review` Round 10 의 지침은 이번 라운드에 발화했다**(적대 검사가 죽은 `\b` 술어를 잡았다). 다시 review 를 돈다면 대상은 *장치의 눈*이 아니라 **불변식의 전수 전개**다 — 외부 지적(F1~F3)은 전수를 돌렸고 자기 계측이 낸 F4 는 1사이트에서 멈췄다.
- 수정 불요 관찰 4건(버킷표 `SDK*Message` 괄호 주석 · `DiscardSession`/`StopSubagent` 페이로드명 · `adapters.md §1.3` 절 제목 · 비범위 버킷 라벨)은 verify r4 §13 파생 관찰.
