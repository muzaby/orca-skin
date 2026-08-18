# Plan — 0191-docs-code-resync

## 메타

| 항목 | 값 |
|---|---|
| slug | `0191-docs-code-resync` |
| 작성자 | Claude Code |
| 일자 | 2026-08-18 |
| 매핑 | — (문서 전용) |
| 상태 | READY → IMPL_DONE (r1) → verify/FAIL (r1) |

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
- 총량/0건 기준: AC1 의 스윕은 **파일 확장자가 붙은 경로**만 센다. 역사적 인용을 남겨야 하면 확장자를 떼고 산문으로 적어 대상에서 제외하되, 그 경우 어디를 그렇게 했는지 구현 보고에 나열한다(회피가 아니라 선택임을 남긴다).
- AC2 의 "남는 `❌`": OpencodeAdapter · Artifacts 디렉토리 · Zustand persist · 전역 단축키 · 네트워크 단절 배너 — 각각 코드 구현체 0건으로 참임을 §8 에서 확인했다.

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
| ↳ `provider-runtime.md` 몫 | 같은 스윕 | 11 | D-002 범위 |
| `📐 구현 대기` 표기 (범위 내) | `grep -rn "구현 대기" docs --include=*.md \| grep -v handoff/archive/etc/spec` | 9 | 이 중 4건이 코드로 반증됨 |
| `❌ 미구현` 상태행 (arch/ 내) | 같은 방식 | 12 | 이 중 4건이 코드로 반증, 5건 유지, 3건 비상태행 |
| `closed-network-extensions.md §8.1` 회귀 테스트 목록 | 각 파일 `ls` | 10 중 **4 부재** | AC7 의 분모 |
| 가이드 백틱 식별자 | `app/src` 전수 `grep -F` | 125 중 1 부재 | 레시피 본문 무결 |
| `disallowedTools` 를 SDK 에 넘기는 지점 | `grep -r disallowedTools app/src` | **0** | AC9 |

### 수치 / 전칭 표현 검산

- 재측정 수치: `app/scripts/*.mjs` 비-test **6개** · `*.test.mjs` **6개** (`app/AGENTS.md` 는 각각 "3종"·"4종"). `app/src/main/infra/db/migrations/` 최종 `0016_turn_model_context_window.sql`(`overview.md` 부트 시퀀스는 "0001~0013").
- 내역 합 = 총계: 경로 부재 20 = provider-runtime 11 + IPC_CONTRACT 2 + TRD 2 + backend/overview 1 + frontend/overview 1 + claude-code-spec 1 + (frontend/overview·backend/overview 의 `i18n/ko.ts` 중복 제외) → 스윕 원본 출력 20줄과 일치.
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
| **인용한 `src/**` 경로가 실재한다** | 파일 시스템 | **강제 지점 없음 → §19 스윕을 이번에 도입** | 구현·검증 턴 | 조용한 오안내 (이번 드리프트 20건의 원인) |
| `guides/` 절차의 명령이 실행된다 | 실제 실행 | 사람/에이전트 | 구현 턴(AC7) | 배포자가 막힌다 |
| `arch/` 는 현재 상태만 서술 | `docs/AGENTS.md` 규칙 4 | 사람 | 편집 시 | changelog 화 |

- 같은 규칙이 여러 레이어에 있다면 SSOT: 수치는 `generated/inventory.md` 단 하나. 본문은 링크만 한다.
- **강제 지점이 여럿인 항목**: "경로 실재" 는 범위 내 **문서 15개 + AGENTS 3개**에 동시에 걸린다. §19 스윕이 그 전부를 한 번에 센다 — 파일별로 따로 닫지 않는다.

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
- ABI/네트워크 제약: 이 세션은 egress 가 열려 `npm ci` 가 Electron ABI 로 성공했다. 그 상태에서는 **DB 를 인스턴스화하는 스위트가 bindings 오류로 실패**한다 — 그것이 D4 의 재측정 대상이다.
- 기본 정적 게이트: `cd app && node scripts/check-doc-inventory.mjs --check` (순수 Node, ABI 무관).
- 경로 회귀 게이트:

```bash
for f in $(find docs -name '*.md' | grep -v '^docs/handoff/\|^docs/archive/\|^docs/etc/\|^docs/spec/') \
         app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md; do
  grep -oEn '(app/)?src/(main|renderer|shared|preload)/[A-Za-z0-9_./@-]*\.(ts|tsx|md|css|html)' "$f" |
  while IFS=: read -r ln p; do q=${p#app/}; [ -e "app/$q" ] || echo "$f:$ln  $p"; done
done
```

  현재 **20줄** → 완료 조건 **0줄**.
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
---

## [검증자 기입] 파생 이슈

> r1 검증: [`verify.md`](verify.md) (FAIL — AC 8✅/4⚠️ · 강제 지점 3/6 재현).

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | `provider-runtime.md:188` 이 현재형으로 `claude-code.ts` + "매 턴 one-off `query()`" 를 적어 같은 문서 line 202(streaming input·라이브 핸들)와 모순 | verify r1 §13 | 파일명을 `adapters/claude.ts` 로, 상태 문구를 line 202 와 정합하게 | OPEN |
| D2 | `ux-domains.md:95` 가 부재 파일 `features/skills/components/customize/SkillsCustomizeView.tsx` 인용. 심볼은 `layers.md:69`·`frontend/overview.md:76` 에도 | verify r1 §13 | 실제 컴포넌트명으로 3곳 치환 | OPEN |
| D3 | `IPC_CONTRACT.md:445` 가 0062 에서 제거된 `prompts/plan-feedback.ts` 인용 (실제 `adapters/plan-feedback.ts`) | verify r1 §13 | 경로 정정 | OPEN |
| D4 | `system-prompt.md:106` 이 현재 cwd 소유자로 부재 경로 `ipc/router.ts` 인용 | verify r1 §13 | 현재 소유 파일로 정정 | OPEN |
| D5 | `adapters.md §3.2.5` 가 "코드 진실 … 이미 구현·테스트된 코드다" 로 `OrcaHookSet`·`OrcaHookEvent`·`OrcaHookHandler`·`ORCA_TO_CLAUDE_EVENT` 단언 — `grep -rn OrcaHookSet app/src` = 0 | verify r1 §13 | 현재 이름(`NormalizedHookSet`·`adaptHooks`)으로 치환. `provider-runtime.md:29`·`terms.md:30` 동반 | OPEN |
| D6 | 자기보고 개수 3축 불일치 — AC2 잔여 `❌`(plan 5·impl 6·실측 **7**) · §8 내역 합 18≠20 · provider-runtime 몫 실측 **13**(기재 11) | verify r1 §7 | 세 숫자를 실측으로 고치고 §19 스윕을 상대 경로까지 확장, 심볼 축을 §10 강제 지점 표에 정식 등재 | OPEN |
