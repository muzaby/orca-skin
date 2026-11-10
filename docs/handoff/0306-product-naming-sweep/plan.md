# Plan — 0306-product-naming-sweep

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0306-product-naming-sweep` |
| 작성자 | Claude Code |
| 일자 | 2026-11-10 |
| 매핑 | PR 미생성 |
| 상태 | READY → IMPL_DONE (r1) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0225 V1은 "코드 식별자 불변"(EP-11)을 잠갔고 이번 작업은 그 결정을 뒤집는다. 일부 변경이 아니라 반대 방향이라 상속하지 않는다 |
| 이번 V revision | `V1` rev.3 — 구현 중 규범 행 정정 C1~C5(rev.2) · C6(rev.3) |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 화면·설치 경로·데이터 파일은 0225에서 `Orcinus orca` / `orcinus-orca`로 바뀌었는데 코드 식별자와 현재 문서는 `orca`로 남아 있다(§8: 코드 2,017건 · 문서 721건).
- **완료 후 달라지는 것**: 코드와 현재 문서에서 제품을 가리키는 이름이 한 규칙(D-004)으로 통일되고, 옛 표기가 다시 들어오면 검사기가 막는다.
- **성공을 사용자 관점 한 문장으로**: 앱은 지금과 똑같이 동작하고, 코드·현재 문서 어디를 열어도 제품 이름이 `Orcinus orca` 계열 표기 하나로 읽힌다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "orca -> orcinus orca 혹은 oo로 표기. 상황별, 문맥에 맡김." | 라이브 세션 턴 A |
| 명시 요구 | "Orcinus orca 표기는 이미 앱화면에서 이루어지고 있다. 다만 코드 및 문서에서 아직도 orca라고 표현하고 있다. 코드식별자 및 문서에도 업데이트 요구" | 라이브 세션 턴 B |
| 명시 요구 | 저장 데이터·외부와 맞물린 이름: "전부 바꾸고 호환 없음" | 라이브 질의 1 |
| 명시 요구 | 문서 범위: "현재 문서만" — 지난 handoff·archive·chats·결정 기록(ADR)은 그대로 둔다 | 라이브 질의 2 |
| 추론 의도 | 어느 문맥에 긴 꼴·짧은 꼴을 쓸지의 규칙(D-004). 사용자가 "문맥에 맡김"으로 위임했다 — 설계자 판단임을 표시한다 | §3 D-004 |
| 추론 의도 | 0225 이관 모듈이 쥔 옛 디스크 이름 리터럴은 "옛 표기"가 아니라 이관의 입력 데이터다 — 바꾸면 이관이 깨진다. 유지한다(D-005) | `shared/product.ts:18` · `migrate-legacy.ts` |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 코드 식별자와 현재 문서의 `orca` 표기를 `Orcinus orca` / `oo` 계열로 바꾼다 | 사용자 원문(§2 턴 A·B) | 턴 A·B | ACTIVE | 0225 D-012의 "코드 식별자" 부분을 대체 |
| D-002 | 저장 데이터·외부와 맞물린 이름도 **전부 바꾸고 옛 이름을 읽는 호환 코드를 두지 않는다** | 사용자 선택 "전부 바꾸고 호환 없음" | 질의 1 | ACTIVE | — |
| D-003 | 문서는 **현재 문서만** 고친다. `docs/handoff/` · `docs/archive/` · `docs/decisions/` · `docs/etc/` · `chats/` · `project/` · 루트 `README.md` · `.agents/**/references/`는 손대지 않는다 | 사용자 선택 "현재 문서만". 지난 기록은 당시 코드·커밋과 맞아야 한다 | 질의 2 | ACTIVE | — |
| D-004 | **이름 규칙** (아래 표). 산문은 `Orcinus orca`, 프로세스 밖으로 나가거나 저장되는 문자열 값은 긴 꼴, 코드 식별자는 `oo` | "상황별, 문맥에 맡김" 위임. 값은 맥락 없이 읽히므로 긴 꼴, 식별자는 코드 안에서만 읽히므로 짧은 꼴 | 턴 A + 설계자 판단 | ACTIVE | — |
| D-005 | **옛 이름이 사실인 자리는 유지**한다 — 0225 이관의 입력(`LEGACY_PRODUCT_SLUG`, 이관 모듈 `migrate-legacy`·`legacy-paths`·`rebase-path`와 그 테스트의 옛 경로 문자열) · 현재 문서가 과거 이름을 사실로 서술하는 문장(구버전 수동 제거 안내 등) · 범위 밖 파일을 가리키는 경로 | 이관 입력을 바꾸면 0225 이전 설치본의 이관이 깨진다. 구버전 안내에서 옛 이름을 바꾸면 사용자가 제어판에서 찾을 항목 이름이 틀려진다. 이관 코드의 존폐는 0305 C-10·C-11 승인 건이다 | 설계자 판단 (rev.2 C1에서 범위 명시) | ACTIVE | — |
| D-006 | 저장소명 `orca-skin`과 머지된 마이그레이션 SQL은 그대로 둔다 | 0225 D-011(저장소명 유지) · `app/AGENTS.md` 마이그레이션 수정 금지 | 0225 · AGENTS | ACTIVE | — |
| D-007 | 옛 표기 재유입을 막는 **검사기**를 `app/scripts/`에 두고 `npm test`와 `ci.yml`에서 돌린다 | 2,738건을 한 번 바꾸고 끝내면 다음 커밋부터 다시 섞인다. 허용 예외는 목록에 등록해야 통과한다(fail-closed) | 설계자 판단 | ACTIVE | — |
| D-008 | GitHub 저장소 Variables 이름 변경은 **사람이 한다** — 3개(§5 표) | 워크플로 파일은 이번에 바꾸지만 저장소 설정값은 에이전트 권한 밖이다 | 설계자 판단 | ACTIVE | — |

### D-004 이름 규칙

| # | 문맥 | 옛 꼴 → 새 꼴 | 예 |
|---|---|---|---|
| N1 | 산문 — 문서 본문·코드 주석·UI·모델에 보내는 프롬프트 문장 | `Orca`·`orca` → `Orcinus orca` | `# Orca` → `# Orcinus orca` |
| N2 | 문자열 값 — 저장·전송·환경변수·표식·fixture 문자열. 구분자는 원래 꼴을 따른다 | `orca-x` → `orcinus-orca-x` · `orca_x` → `orcinus_orca_x` · `orca.x` → `orcinus-orca.x` · `ORCA_X` → `ORCINUS_ORCA_X` | `'orca'`(sourceKind) → `'orcinus-orca'` · `ORCA_TEST_TIME_SCALE` → `ORCINUS_ORCA_TEST_TIME_SCALE` |
| N3 | 코드 식별자 — 변수·함수·타입·프로퍼티·상수 이름·소스 파일명 | `orcaX` → `ooX` · `OrcaX` → `OoX` · `ORCA_X` → `OO_X` · `orca-x.ts` → `oo-x.ts` | `window.orca` → `window.oo` · `OrcaApi` → `OoApi` · `orca-file.ts` → `oo-file.ts` |
| N4 | IPC 채널 접두사 (N2의 명시 예외) | `orca:` → `oo:` | `orca:chat:send` → `oo:chat:send` |

- N4의 근거: 채널 이름은 preload와 main이 같은 빌드에서 함께 나가는 내부 배선이고 저장·표시되지 않는다(§8). 긴 꼴은 117개 문자열을 15자씩 늘릴 뿐이다.
- 한 토큰이 N2와 N3에 모두 걸리면 **값이면 N2, 이름이면 N3**다 — `const OO_PLUGIN_NAME = PRODUCT_SLUG`처럼 이름은 `OO_`, 값은 긴 꼴이다.

### r1 구현 중 설계 정정 (규범 행 — rev.2)

구현 중 실측에서 조사 1건이 틀렸고 분모 3건이 좁았다. ACTIVE Decision의 방향은 바뀌지 않았다.

| # | 정정한 행 | 정정 전 | 정정 후 | 관측 |
|---|---|---|---|---|
| C1 | D-005 · AC4 · EP-09 | 유지 대상 = 이관 5파일 + SQL | 이관 입력 6파일 + SQL 1 + 과거 이름을 서술하는 현재 문서 4 = **11파일** | `rebase-path.test.ts`는 옛 루트 → 새 루트 재기준을 시험한다 — 일괄 변환이 두 인자를 같은 값으로 만들어 테스트가 green인 채 의미를 잃었다. `release-operations.md` "구버전 수동 제거" 절은 제어판 항목 이름 `"orca"`를 안내한다 |
| C2 | EP-01 규칙 칸 | 6분기 | **7분기** — ⑦ 범위 밖 추적 파일을 가리키는 경로 조각은 그 파일의 실제 이름일 때 hit이 아니다 | 현재 문서가 지난 기록 9개 경로(`docs/etc/study/opencode/…-migration-guide.md` 등)를 링크한다. D-003이 그 파일 이름을 고정하므로 링크도 옛 이름이어야 한다 — 바꾸면 `check-doc-inventory --check`가 끊긴 링크로 red |
| C3 | §8 "sourceKind·sourceId는 저장되지 않는다" · §5 표 | 저장 안 됨 | **`sourceId`는 설정 `skillEnabled`의 키 접두사로 저장된다**(`scan.ts` `skillEnabledKey` = `<sourceId>/<name>`) | D-002(호환 없음)에 따라 옛 키를 읽지 않는다 — 사용자가 꺼 둔 제품 스킬 토글이 기본값(켜짐)으로 돌아간다. §5 표에 행 추가 |
| C4 | EP-07 자리 목록 | 값 리터럴 30 + env 접두사 4 | 값 리터럴 **34줄**(검색 재실행 — lint 재포맷과 `extension-sources.ts` 라벨 키 포함) + env 접두사 4 + **OpenCode 관리 MCP alias 접두사 1**(`opencode/v1/managed-mcp.ts` `managedMcpAlias`) | alias `orcinus_orca_<b\|u>_<hash>`는 OpenCode 도구 이름·권한 패턴의 접두사다. 원 목록에 없었다 |
| C6 (rev.3) | D-005 · AC4 · EP-09 | 허용 11파일 | **12파일** — `app/scripts/test-spawn-trace.test.mjs` 추가(환경변수 이름 4자리) | 이 테스트는 0300 증거 스크립트(`docs/handoff/0300-…/evidence/spawn-trace.mjs`, 범위 밖 지난 기록)를 import해 돌린다. 그 스크립트가 옛 이름의 환경변수를 읽으므로 테스트가 새 이름을 설정하면 추적 파일이 생기지 않는다 — `node --test` 1건 red로 관측 |
| C5 | AT-02 테스트의 옛 이름 음성 단언 | (명시 없음) | `product-identity.test.ts`는 옛 리터럴을 직접 적지 않고 `LEGACY_PRODUCT_SLUG`에서 만든다 | 그 파일이 허용 목록에 오르면 AC4의 "옛 이름을 읽는 분기 없음"을 테스트 파일이 흐린다 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-008 전부(신규 handoff).
- 변경된 결정: 0225 D-012("과거 기록·코드 식별자는 무차별 치환하지 않는다") 중 **코드 식별자** 부분을 D-001이 대체한다. **과거 기록** 부분은 D-003으로 유지된다.
- 유지되는 기존 결정: 0225 D-001(표시 `Orcinus orca` · 파일 `orcinus-orca`) · D-010(옛 경로 fallback 금지) · D-011(저장소명) · D-016(`productName` 키 금지).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. 대조한 쌍 —
  - D-002("호환 없음") ↔ AC4("옛 이름을 읽는 분기 0") → 같은 방향.
  - D-005("옛 디스크 이름 유지") ↔ AC1(검사기 0건) → AC1의 허용 목록에 이관 5파일이 등록돼 충돌하지 않는다. AC5가 D-005를 양성으로 잠근다.
  - D-003("지난 기록 불변") ↔ AC6("범위 밖 문서 diff 0") → 같은 방향.
  - D-004 N4(`oo:`) ↔ AC2(채널 수 = 생성물) → 같은 방향.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 표기 불일치 자체가 대상이다. 0225가 식별자를 일부러 남겼고(`product-identity.test.ts:280` "코드 식별자 불변") 사용자가 그 결정을 바꿨다 |
| 이미 기존 코드가 충족하는가 | 아니오 | 범위 안 옛 표기: 코드 2,017건/443파일 · 현재 문서 721건/37파일(§8) |
| 더 작은 해법이 있는가 | 있으나 요구를 닫지 못한다 | 문서만 바꾸면 턴 B의 "코드식별자"가 남는다. 식별자만 바꾸고 저장 이름을 남기는 안은 질의 1에서 사용자가 택하지 않았다 |
| 선행 자료의 주장을 코드와 대조했는가 | 예 — 설계자 자신의 질의 예시 2건이 틀렸다 | 질의 1에서 든 `orca-private-v1`은 비밀 저장소 이름이 아니라 테스트 fixture 모델명이고(`modelSelection.test.ts:17`), `ORCA_CONFIG`는 환경변수가 아니라 상수 `DEFAULT_ORCA_CONFIG`다(`orca-file.ts:100`). 실제 저장·외부 이름은 §5 표가 정본이다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 1건 변경 · 3건 유지 | 0225 D-012 코드 식별자 부분 변경(D-001). `docs/arch/frontend/state.md` §1.3 "`window.orca` 직접 호출 금지" 규칙은 이름만 바뀌고 유지. 0188 D-030 "`orca:provider:*` 채널 이름 유지"는 접두사만 바뀌고 `provider` 도메인 이름은 유지 |

- 사용자에게 올릴 결정: 없음 — 질의 2건으로 닫았다. D-004 규칙은 위임받은 설계자 판단이라 요약으로 알린다.
- 코드 조사로 닫은 사실: 저장·외부 이름 목록(§5) · 프롬프트 표식은 쓰기 전용(§8) · `sourceKind`는 저장되지 않음(§8).

## 5. 동작 / 사용자 흐름

```text
[사용자]  새 빌드 설치 후 실행
  → 화면·대화·설정·산출물이 이전과 같게 동작한다
  → 설정 폴더·DB·저장된 대화는 그대로 열린다 (디스크 이름은 0225에서 이미 바뀜)

[개발자·에이전트]  코드에 옛 표기를 다시 쓴다
  → npm test / CI 의 이름 검사기가 파일:줄과 함께 실패한다
  → 예외가 정당하면 허용 목록에 {파일, 표기, 개수, 사유}를 등록해야 통과한다

[운영자]  GitHub 저장소 Variables 를 새 이름으로 다시 만든다 (D-008)
  ↘ 안 바꾸면: 워크플로가 기본값(CI 90분 · 릴리스 135분 · 테스트 배율 3)으로 돈다
```

### D-002로 달라지는 저장·외부 이름 (전수)

| 이름 | 옛 → 새 | 누가 영향받나 | 관측되는 결과 |
|---|---|---|---|
| 산출물 MCP 서버 id | `orca_artifacts` → `orcinus_orca_artifacts` | 모델이 보는 도구 이름 | 새 세션은 새 도구 이름을 본다. 이미 게시된 산출물은 DB에 연결돼 있어 그대로 열린다 |
| 산출물 게시 영수증 type | `orca.artifact.published` → `orcinus-orca.artifact.published` | 턴 진행 중 history writer | 영수증은 게시 시점에만 읽는다. 업데이트 도중 진행 중이던 턴 1건만 연결이 안 될 수 있다 |
| 프롬프트 표식 4군 | `ORCA_ATTACHMENT_*` · `ORCA_DIFF_REQUIREMENT*` · `ORCA_PLAN_FEEDBACK_*` · `ORCA_PLAN_COMMENT_*` → `ORCINUS_ORCA_…` | 모델 | 표식은 모델에 보내기만 하고 다시 읽지 않는다 — 옛 대화에는 옛 표식이 텍스트로 남는다 |
| MCP 비밀 합성 변수 | `ORCA_MCP_<이름>_AUTH` → `ORCINUS_ORCA_MCP_<이름>_AUTH` | 새로 추가하는 MCP 서버 | 기존 서버는 저장된 변수 이름을 계속 쓴다(`store.ts:111` — 기존 이름 우선). 새 서버만 새 접두사 |
| OpenCode 관리 MCP env | `ORCA_MCP_<alias>_<n>` → `ORCINUS_ORCA_MCP_…` | OpenCode 자식 프로세스 | 실행 때마다 다시 만든다 — 구현자가 저장 여부를 확인한다(§10 EP-07) |
| OpenCode 관리 MCP alias | `orca_<b\|u>_<hash>` → `orcinus_orca_<b\|u>_<hash>` | OpenCode가 보는 MCP 서버·도구 이름 | 실행 때마다 다시 만든다. 옛 OpenCode 세션 기록에는 옛 도구 이름이 남는다 (rev.2 C4) |
| 스킬 켜짐/꺼짐 설정 키 | `orca/<스킬>` → `orcinus-orca/<스킬>` | 제품 스킬을 꺼 둔 사용자 | **꺼 둔 제품 스킬이 다시 켜진다** — 옛 키를 읽지 않는다(D-002). 설정 화면에서 다시 끄면 된다 (rev.2 C3) |
| 테스트·진단 환경변수 | `ORCA_TEST_TIME_SCALE` · `ORCA_TEST_IO_MODE` · `ORCA_SPAWN_TRACE` 등 → `ORCINUS_ORCA_…` | 개발자 셸 · CI | 옛 이름으로 설정한 값은 무시되고 기본값이 쓰인다 |
| GitHub Variables | `ORCA_CI_TIMEOUT_MINUTES` · `ORCA_RELEASE_TIMEOUT_MINUTES` · `ORCA_TEST_TIME_SCALE` → `ORCINUS_ORCA_…` | CI | 사람이 저장소 설정에서 바꾼다(D-008) |
| 모델에 보내는 시스템 머리글 | `# Orca` · `Orca version:` → `# Orcinus orca` · `Orcinus orca version:` | 모델 | 모델이 제품을 새 이름으로 부른다 |

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 새 빌드 첫 실행 | 이관·부팅 순서는 그대로(0225 모듈 불변, D-005) | 기존 데이터가 그대로 열린다 |
| 옛 표기가 든 커밋 | 검사기가 `파일:줄: 표기` 목록을 내고 exit 1 | CI red |
| 허용 목록의 개수와 실제가 다름(늘거나 줄거나) | 검사기 exit 1 | CI red — 지운 예외도 목록에서 지워야 한다 |
| 옛 env 이름만 설정된 셸 | 새 이름을 읽으므로 미설정으로 본다 | 기본값으로 동작 |

### 파생 UX / 엣지케이스

- **error**: 해당 없음 — 사용자 대면 오류 경로를 새로 만들지 않는다.
- **restart / concurrency**: 해당 없음.
- **업데이트 경계**: 옛 빌드가 실행 중인 턴에서 산출물을 게시하는 순간 새 빌드로 바뀌는 경우는 없다(업데이트는 재시작을 거친다). 위 표의 "진행 중 턴 1건"은 이론상 경계로만 적는다.

## 6. 범위 / 비범위

- **범위(코드)**: `app/src/**` · `app/scripts/**` · `app/` 설정 파일(`package.json`·`electron-builder.yml`·`*.config.*`) · `.github/workflows/**`.
- **범위(현재 문서)**: 루트·`app/`·`app/src/main/`·`app/src/renderer/`·`docs/`·`docs/guides/`의 `AGENTS.md` · `docs/arch/**` · `docs/guides/**` · `docs/INDEX.md` · `ARCHITECTURE.md` · `GLOSSARY.md` · `IPC_CONTRACT.md` · `PRD.md` · `TRD.md` · `claude-code-spec.md` · `claude-taskxxx-spec.md` · `opencode-sdk-spec.md` · `docs/generated/**`.
- **비범위**: D-003의 지난 기록 · D-005의 이관 리터럴 · D-006의 저장소명·마이그레이션 SQL · 0305의 축소 후보(이름만 바꾸고 구조는 그대로 둔다).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 0225 이관 모듈 자체의 제거 | 아니오 | 0305 C-10·C-11 승인 건 |
| 0305 후속 handoff(H-A~H-K)와의 순서 | **예 — 443파일을 건드려 병합 충돌이 난다** | 이 handoff를 0305 후속보다 **먼저** 병합한다. 후속 plan은 새 이름 기준으로 쓴다 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 범위 안 추적 파일에서 허용 목록 밖의 옛 표기가 0건이다 | `gate: node app/scripts/check-product-naming.mjs` exit 0. 주어 = 대소문자 구분 `orca\|Orca\|ORCA`에서 허용 꼴(§10 EP-01)을 뺀 것 | 저장소 추적 파일 전체 → 검사기 |
| R-02 | AT-02 / AC2 | 이름 규칙 N1~N4가 대표 자리에서 **새 꼴로 있다** | `product-identity.test.ts` 양성 단언 — preload가 `'oo'` 키로 노출 · 채널이 전부 `oo:`이고 수가 생성물과 같다 · 표식 4군이 `ORCINUS_ORCA_` · `sourceKind`가 `'orcinus-orca'` · 시스템 머리글이 표시명 SSOT 파생 | preload `exposeInMainWorld` → renderer `window.oo` · `shared/ipc.ts` `CHANNELS` |
| R-03 | AT-03 / AC3 | 앱 동작이 바뀌지 않는다 | 변경 전후 `vitest run` 케이스 수가 같고(이름 테스트 블록 제외) 전부 green · `npm run lint` · `npm run typecheck` · `node --test scripts/*.test.mjs` green. 테스트를 지우거나 skip하지 않는다 | 기존 테스트가 닿는 전 경로 |
| R-04 | AT-04 / AC4 | 옛 이름을 읽는 호환 분기가 없다 | AC1의 허용 목록 파일 집합이 고정 12파일(이관 입력 6 · 마이그레이션 SQL 1 · 지난 증거 스크립트의 입력 1 · 과거 이름을 서술하는 문서 4, rev.2 C1 · rev.3 C6)과 같다 — 검사기 자체 테스트가 집합 일치를 단언 | 허용 목록 → 검사기 |
| R-05 | AT-05 / AC5 | 0225 이관이 그대로 동작한다 | `LEGACY_PRODUCT_SLUG === 'orca'` 단언 유지 · `migrate-legacy.test.ts`·`legacy-paths.test.ts` 케이스 수 불변·green(DB 로드 케이스는 환경 기준선으로 분리) | `index.ts` 부팅 → 이관 모듈 |
| R-06 | AT-06 / AC6 | 현재 문서가 새 이름을 쓰고 지난 기록은 그대로다 | AC1 검사기가 문서 범위도 본다 · `node app/scripts/check-doc-inventory.mjs --check` green · `git diff --stat <base>` 에서 D-003 경로 변경 0(이 handoff 디렉토리 제외) | 문서 파일 → 검사기·문서 가드 |
| R-07 | AT-07 / AC7 | 운영 문서가 사람이 바꿀 외부 설정을 새 이름으로 안내한다 | `product-identity.test.ts` — `docs/guides/release-operations.md`가 새 Variables 이름 3개를 포함 | 문서 → 운영자 |
| R-08 | AT-08 / AC8 | 검사기가 모르는 표기를 막고 허용 목록 개수를 양방향으로 대조한다 | `check-product-naming.test.mjs` — 옛 표기 1줄을 넣은 임시 트리 → exit 1 · 허용 개수 +1/−1 → exit 1 · 허용 꼴만 있는 트리 → exit 0 | `npm test`의 `node --test scripts/*.test.mjs` · `ci.yml` 단계 |
| R-09 | AT-09 / AC9 | GitHub Variables 3개가 새 이름으로 있다 | **사람** — 저장소 Settings → Variables | GitHub 설정 → 워크플로 `vars.*` |
| R-10 | AT-10 / AC10 | 실제 앱에서 부팅 · 대화 1회 · 산출물 게시 1회가 된다 | **사람 실기** — 네트워크 완전환경(이 환경은 Electron 빌드가 egress로 막힌다, `app/AGENTS.md`) | 설치본 실행 |

### AC 검증 주의사항

- AC1은 음성 게이트라 "없다"만 잠근다. "새 꼴이 있다/쓰인다"는 AC2의 양성 단언이 잠근다 — 채널을 통째로 지우면 AC1은 green이지만 AC2의 채널 수 대조가 red다.
- AC3의 "케이스 수 같음"은 구현자가 변경 전 `vitest run`의 파일·케이스 수를 먼저 기록한다. 환경 실패(DB 로드 스위트)는 변경 전 실패 집합과 차집합 ∅로 분리한다.
- 사람 실기는 AC9·AC10뿐이다. 순수 로직을 사람에게 넘긴 항목 없음.

## 7-A. V / Trace Matrix

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-08 | R | §7 | NEW | — |
| R-09·R-10 | R | §7 사람 판정 | NEW | — |
| SD-01 | SD | §9 IPC 이름 사슬: 채널 상수 → preload 노출 키 → renderer 호출 | NEW | — |
| AR-01 | AR | §10 EP-02~EP-07 생산자↔소비자 문자열 쌍 | NEW | — |
| AR-02 | AR | §10 EP-08 env 이름: 읽는 코드 ↔ 설정하는 워크플로·문서 | NEW | — |
| MD-01 | MD | §11 검사기 모듈(주어·허용 꼴·허용 목록 대조) | NEW | — |
| MD-02 | MD | §10 EP-06 프롬프트 표식의 상수 ↔ 이스케이프 리터럴 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01·R-04·R-06 ↔ AT-01·04·06 | REQUIRED | 추적 파일 → 검사기 → exit code | `gate: node app/scripts/check-product-naming.mjs` | required — 음성 게이트의 민감도. 변이는 VP-08이 든다 | EP-01 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `shared/ipc.ts` · `preload/index.ts` · 표식 3파일 · `scan.ts` → `product-identity.test.ts` | 신규 블록 `이름 규칙 (0306)` 5케이스(§11) | not selected — 양성 단언이 직접 값 비교 | EP-02·03·06 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 전 production 경로 → 기존 테스트 | `gate: ./node_modules/.bin/vitest run` · `npm run lint` · `npm run typecheck` · `node --test scripts/*.test.mjs` | not selected | 0 — 동작 불변이 계약이라 운반 자리가 없다 |
| VP-04 | R-05 ↔ AT-05 | REGRESSION | `index.ts` → `migrate-legacy.ts` · `legacy-paths.ts` | `product-identity.test.ts:'레거시 슬러그 상수가 옛 이름을 그대로 갖는다'` · `migrate-legacy.test.ts` 전 케이스 | not selected | EP-09 |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED | `CHANNELS` → preload `ipcRenderer.invoke` → `exposeInMainWorld('oo')` → renderer `window.oo` | `preload/index.test.ts`(노출 키를 `harness.exposed`에서 읽는 기존 하네스) — 키 `'oo'`로 API를 꺼내 호출이 `oo:` 채널로 나가는지 단언 | required — 노출 키와 소비 이름이 문자열이라 typecheck가 못 본다. 변이: `exposeInMainWorld` 키를 `'orca'`로 되돌림 → red | EP-02·03 |
| VP-06 | AR-01 ↔ IT-01 | REQUIRED | 생산자 → 문자열 → 소비자 (EP-04·05·07 자리) | 자리별 — §10 EP-04·05·07 oracle 칸 | required — 한쪽만 바꾸면 조용히 끊긴다. 변이: 소비자 쪽 리터럴만 옛 값으로 되돌림(자리마다) | EP-04·05·07 |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | 워크플로 `env:` → `scripts/test-time.mjs`·`test-pools.mjs` 읽기 | `scripts/test-time.test.mjs`·`test-pools.test.mjs`의 env 읽기 케이스(새 이름으로 설정 → 배율·모드 반영) | not selected — 직접 값 단언 | EP-08 |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | 임시 트리 → 검사기 함수 → 위반 목록 | 신규 `scripts/check-product-naming.test.mjs` — 규칙 칸 분기마다 입력(§10 EP-01) | required — 검사기는 열린 입력을 판정한다. 변이: 허용 꼴 정규식에서 한 꼴 제거 → 그 꼴 입력 케이스 red · 개수 대조 제거 → ±1 케이스 red | EP-01 |
| VP-09 | MD-02 ↔ UT-02 | REQUIRED | 사용자 입력 속 표식 문자열 → `escape*` → 프롬프트 | `diff-requirements.test.ts` · `attachment-prompt.test.ts` · `plan-feedback.test.ts`의 이스케이프 케이스 — 입력을 **새 표식 꼴**로 준다 | required — 상수만 바꾸고 이스케이프 리터럴을 남기면 테스트 입력이 옛 꼴인 한 green이다. 변이: 이스케이프 리터럴 1곳을 옛 꼴로 되돌림 → red | EP-06 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/**` 수정 | `app/AGENTS.md` "로컬 확인" 7개 명령 | 현재 변경이 유발한 실패만 blocking. DB 로드 스위트는 변경 전 실패 집합과 대조해 분리 |
| 문서 가드 | 문서·`IPC_CONTRACT.md`·생성물 수정 | `node app/scripts/check-doc-inventory.mjs --check` | 전부 blocking |
| 테스트 규칙 가드 | 테스트 파일 다수 수정(문자열만) | `node app/scripts/check-test-budgets.mjs` · unit 풀 가드 | 이번에 수정한 파일의 위반은 blocking |
| message-bus | handoff 산출물 | 커밋 trailer 파싱 · `INDEX.md` 갱신 | blocking |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 0225가 식별자 불변을 테스트로 잠갔다 — 이번에 뒤집을 블록 | `app/src/main/product-identity.test.ts:280` `코드 식별자 불변 (EP-11)` 3케이스 |
| 채널 수 대조는 문서 가드도 한다 — 정규식이 `'orca:…'` 리터럴을 직접 읽는다 | `app/scripts/check-doc-inventory.mjs:44` |
| preload 노출 키와 전역 타입 선언이 따로 산다 | `preload/index.ts:454` `exposeInMainWorld('orca', orca)` · `preload/index.d.ts:5` `orca: OrcaApi` |
| 프롬프트 표식은 쓰기 전용이다 — 상수를 읽는 곳이 조립 함수뿐이고 파서가 없다 | `rg "START_SENTINEL\|END_SENTINEL" app/src -g '!*.test.*'` → 조립 3파일 안 15줄 |
| 표식의 이스케이프는 상수가 아니라 **별도 리터럴**을 쓴다 | `diff-requirements.ts:15-17` · `attachment-prompt.ts:25-26`(종료 쪽 2개) · `plan-feedback.ts:27-28` |
| ~~`sourceKind`·`sourceId`·`origin`의 `'orca'`는 저장되지 않는다~~ → **`sourceId`는 설정 `skillEnabled` 키의 접두사로 저장된다**(rev.2 C3). `sourceKind`·`origin`은 DTO와 화면 분기에만 쓰인다 | `features/extensions/common/skills/scan.ts` `skillEnabledKey` · `app/handlers/skills.ts:71`. 원 검색은 `sourceId` 문자열만 찾아 템플릿으로 만든 키를 놓쳤다 |
| MCP 비밀 변수 이름은 서버 추가 때 한 번 합성하고 이후 기존 이름을 우선한다 | `features/extensions/common/mcp/store.ts:43` · `:111` |
| 산출물 영수증 type과 도구 이름은 생산자·소비자가 리터럴을 각자 쥔다 | `artifacts/service.ts:33·224` ↔ `history/writer.ts:63` · `artifacts/tool.ts:29·30` ↔ `db/artifact-queries.ts:134` |
| `ErrorCard`·`errorCategoryKey`는 대소문자 무시로 세면 걸린다 — 주어를 대소문자 구분으로 둔다 | `git ls-files app \| grep -i orca` 에 `ErrorCard.tsx` |
| 머지된 마이그레이션 SQL에 주석 1줄 | `migrations/0032_native_session_recovery.sql:1` — 수정 금지(D-006) |

### 전수 조사

기준 커밋 `499d354`. 주어 = 대소문자 구분 `orca|Orca|ORCA`, 허용 꼴 `orcinus[-_ ]?orca`(대소문자 무시)와 `orca-skin`을 먼저 지운 뒤 센다.

| 대상 | 검색/방법 | N | 의미 |
|---|---|---|---|
| 코드 범위(§6) | `git ls-files` + 위 주어 | 1,824줄 · 2,017건 · 443파일 | 바꿀 분모 |
| 현재 문서 범위(§6) | 같음 | 532줄 · 721건 · 37파일 | 바꿀 분모 |
| 이관 5파일 + 마이그레이션 SQL | 같음 | 39줄 · 44건 · 6파일 | 허용 목록(D-005·D-006) |
| IPC 채널 리터럴 | `grep -o "'orca:[a-zA-Z0-9:._-]*'" shared/ipc.ts \| sort -u` | 117 | N4 대상 |
| `'orca'` 값 리터럴(테스트·`product.ts` 제외) | `grep -rn "'orca'" app/src --include=*.ts --include=*.tsx` | 31줄 · 19파일 | N2 대상. `preload/index.ts` 1줄은 노출 키(N3) |
| `window.orca` 계열(테스트 제외) | `grep -rno "window\.orca\b\|Window\['orca'\]\|orca: OrcaApi\|'orca', orca"` | 131 | N3 대상 |
| 이름에 옛 표기가 든 소스 파일 | `git ls-files app \| grep -E 'orca\|Orca'` | 6 | `orca-file`·`orca-config`(+테스트 2)·`OrcaLogo`(+테스트 1) |
| 워크플로 | `grep -rn ORCA_ .github` | 10줄 · 3파일 | Variables 3종 + env 2종 |
| 범위 밖 지난 기록 | 같은 주어 | 3,144줄 · 467파일(+`docs/decisions` 24줄 · `docs/etc` 314줄) | 손대지 않는다(D-003) |

### 수치 / 전칭 표현 검산

- 코드 2,017 + 문서 721 = 2,738건이 0이 되고 허용 44건이 남는다. 이관 5파일은 코드 범위에 포함돼 있으므로 코드 쪽 잔여 = 44.
- "표식은 쓰기 전용"의 반례 검색: `rg "ORCA_(ATTACHMENT|DIFF|PLAN)" app/src/renderer -g '!*.test.*'` → 주석 1줄(`chatStore.ts:1999`)뿐, 파싱 코드 0.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

구조는 바뀌지 않는다. 이름이 지나는 사슬만 적는다.

```text
AS-IS                                   TO-BE
shared/ipc.ts  CHANNELS 'orca:…' ×117   'oo:…' ×117
preload        exposeInMainWorld('orca')  exposeInMainWorld('oo')
preload d.ts   Window { orca: OrcaApi }   Window { oo: OoApi }
renderer       window.orca.*              window.oo.*
main 생산자    'orca.artifact.published'   'orcinus-orca.artifact.published'
main 소비자    같은 리터럴(별도 사본)       같은 새 리터럴
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V 연결 |
|---|---|---|---|---|
| 책임/소유권 | 표시명·슬러그 SSOT = `shared/product.ts` | 같음 | — | — |
| state/contract | 식별자 `orca` 계열 · 값 `orca`/`ORCA_` 계열 | D-004 N1~N4 | D-001 | AR-01 / VP-06 |
| 이름 잠금 | "식별자 불변" 테스트(0225 EP-11) | "새 꼴 양성" 테스트 + 검사기 | D-001·D-007 | MD-01 / VP-02·VP-08 |
| error/lifecycle | 변화 없음 | 변화 없음 | — | VP-03 |
| test seam | 해당 없음 | 검사기는 순수 Node(파일 목록·내용 → 위반 목록) | ABI 중립 | VP-08 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 호출 |
|---|---|---|---|
| `app/scripts/check-product-naming.mjs` | 범위 안 추적 파일의 옛 표기 판정 | `git ls-files` 목록·내용 → 위반 `{file, line, token}[]` · exit code | `npm test` · `ci.yml` |
| 같은 파일의 `ALLOWED` | 예외 등록 `{file, token, count, reason}` | — | 검사기 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-01·VP-08 · **EP-01** | 검사기 규칙 — 분기 7(rev.2 C2): ① 주어 hit → 위반 ② 허용 꼴 5종(`orcinus-orca`·`orcinus_orca`·`Orcinus orca`·`OrcinusOrca`·`ORCINUS_ORCA`)은 hit 아님 ③ `orca-skin`은 hit 아님 ④ 허용 목록 `{file, token, count}`와 실제 개수가 같으면 통과 ⑤ 다르면(±) 위반 ⑥ 범위 밖 경로(D-003)는 읽지 않는다 ⑦ 범위 밖 추적 파일의 경로 조각(옛 표기가 든 마디, 옛 이름 그 자체인 폴더는 `부모/마디/`)은 hit 아님 — 그 파일이 추적 목록에서 사라지면 다시 hit | 검사기 파일 | 검사기 | 7분기 — UT 입력: ①`const orcaX` ②꼴마다 1줄(5입력) ③`orca-skin` 1줄 ④등록 1·실제 1 ⑤등록 1·실제 2, 등록 2·실제 1 ⑥`docs/handoff/x.md`에 옛 표기 ⑦실재하는 범위 밖 링크 → 통과 · 같은 링크인데 추적 목록에 없음 → 위반 · 폴더 이름만(`부모/` 없이) → 위반 · 경로 옆의 옛 표기 → 위반 | `node --test app/scripts/check-product-naming.test.mjs` | 옛 표기가 CI를 통과한다. **선언 경계**: 바이너리·`node_modules`·추적되지 않는 파일은 보지 않는다 · 대소문자가 섞인 꼴은 주어 밖 — 트리에서 그 꼴은 `ErrorCard`·`ErrorCardProps`·`ErrorCategory`·`errorCall`·`errorCategoryKey` 5종 35건뿐이고 제품 이름이 아니다(`git grep -nIi orca -- app/src app/scripts .github \| grep -v "orca\|Orca\|ORCA"`) |
| SD-01 / VP-05 · **EP-02** | preload 노출 키 = renderer 전역 이름 = `oo` | `preload/index.ts` | preload | 3자리 — `preload/index.ts:454` 키 · `preload/index.d.ts:5` 선언 · `renderer/src/shared/logging.ts:9` `Window['…']` | `grep -rn "exposeInMainWorld\|interface Window\|Window\['" app/src --include=*.ts -r \| grep -v test` | 화면의 모든 main 호출이 `undefined` 접근으로 죽는다 |
| SD-01 / VP-02·VP-05 · **EP-03** | 채널 접두사 `oo:` · 수 = 생성물 | `shared/ipc.ts` `CHANNELS` | 계약 파일 | 3자리 — `shared/ipc.ts`(117 리터럴) · `scripts/check-doc-inventory.mjs:44` 정규식 · `docs/IPC_CONTRACT.md` 채널 표 | `grep -c "'orca:" app/src/shared/ipc.ts` · `grep -n "orca:" app/scripts/check-doc-inventory.mjs` | 문서 가드가 채널 0개로 세거나 문서가 코드와 어긋난다 |
| AR-01 / VP-06 · **EP-04** | 산출물 영수증 type | 없음(사본 3) | main | 3자리 — `artifacts/service.ts:33`(타입) · `:224`(생산) · `history/writer.ts:63`(소비) | `grep -rn "artifact\.published" app/src --include=*.ts \| grep -v test` | 게시해도 대화에 산출물 카드가 연결되지 않는다 |
| AR-01 / VP-06 · **EP-05** | 산출물 도구 이름 = `mcp__<서버 id>__publish_artifact` | 없음(사본 3) | main | 3자리 — `artifacts/tool.ts:29`·`:30`(생산) · `db/artifact-queries.ts:134`(소비) | `grep -rn "orca_artifacts" app/src --include=*.ts \| grep -v test` | 게시 기록이 도구 호출과 연결되지 않는다 |
| MD-02 / VP-09 · **EP-06** | 표식 상수와 이스케이프 리터럴이 같은 접두사 | 파일별 | 조립 함수 | 17자리(줄) — `diff-requirements.ts:4·5·6·7·15·16·17` · `attachment-prompt.ts:18·19·25·26` · `plan-feedback.ts:9·10·11·12·27·28`. 이스케이프 줄은 찾는 리터럴과 바꿔 넣는 `_ESCAPED` 리터럴을 함께 쥔다 | `grep -n "ORCA_" app/src/main/adapters/common/diff-requirements.ts app/src/main/adapters/common/attachment-prompt.ts app/src/main/adapters/claude/plan-feedback.ts` → 7+4+6 = 17줄 | 사용자 입력에 든 표식 문자열이 이스케이프되지 않아 모델이 가짜 블록을 진짜로 읽는다 |
| AR-01 / VP-06 · **EP-07** | 출처 값 `'orcinus-orca'` · MCP env 접두사 | `shared/ipc.ts:1210` 유니온 | main 생산 → renderer 소비 | 값 리터럴 34줄(rev.2 C4 — 구현 뒤 검색 재실행) + env 접두사 4자리(`mcp/store.ts:44` · `opencode/v1/managed-mcp.ts:43` · `opencode/v1/diagnostics.ts:34·37`) + alias 접두사 1자리(`opencode/v1/managed-mcp.ts` `managedMcpAlias`) | §8 `'orca'` 명령 · `grep -rn "ORCA_MCP_" app/src --include=*.ts \| grep -v test` | 유니온 타입 자리는 typecheck가 잡는다. `string` 타입 자리(구현자가 표시)는 관리 스킬·MCP가 "사용자 것"으로 분류되지 않는다 |
| AR-02 / VP-07 · **EP-08** | env 이름: 읽는 쪽 = 설정하는 쪽 | `scripts/test-time.mjs` · `test-pools.mjs` | 스크립트 ↔ 워크플로 ↔ 문서 | 구현자가 명령으로 고정 — 읽기(`process.env`) · 워크플로 `env:`·`vars.` 10줄 · `app/AGENTS.md`·`docs/guides` 서술 | `git grep -n "ORCA_[A-Z_]*" -- app/scripts app/vitest.config.ts .github app/AGENTS.md docs/guides` | CI가 설정한 배율·모드가 무시되고 기본값으로 돈다 |
| R-05 / VP-04 · **EP-09** | 이관 리터럴 불변 | `shared/product.ts:18` | 이관 모듈 | 허용 목록 12파일(rev.2 C1 · rev.3 C6) — `scripts/test-spawn-trace.test.mjs` · `shared/product.ts` · `infra/config/migrate-legacy.ts`(+test) · `infra/config/rebase-path.ts`(+test) · `app/legacy-paths.test.ts` · `migrations/0032_*.sql` · `docs/guides/release-operations.md` · `docs/arch/backend/{overview,security,provider-runtime}.md` | `node app/scripts/check-product-naming.mjs --report-allowed` | 0225 이전 설치본이 이관되지 않는다 |

- **EP-07 oracle**: 생산자 → 소비자를 잇는 기존 테스트의 fixture 값을 새 값으로 바꾼 뒤 green이어야 한다. 대상 — `attachMenuModel` 테스트(스킬이 `skill` 타입으로 분류) · `scan` 테스트(`canToggle`) · `Composer.native-menu.test.ts`. 구현자가 30자리 각각이 어느 테스트의 실행 구간에 드는지 `[구현자 기입]` 표에 적고, 어느 테스트에도 들지 않는 `string` 타입 자리는 테스트를 더한다.
- **EP-04·05 oracle**: 생산 함수의 실제 출력을 소비 함수에 넣는 테스트. 기존 케이스가 리터럴을 fixture로 각자 쥐고 있으면 한쪽 출력을 다른 쪽 입력으로 잇는 1케이스를 더한다(파일 `features/artifacts/service.test.ts` 또는 `history/writer.test.ts` — 진입: 게시 → 영수증 문자열 → 파서, 관측: `publicationId`).
- **게이트가 green인 채로 남는 차이**: 검사기는 "옛 표기 없음"만 본다 — N2/N3를 뒤바꿔 쓴 것(값에 `oo`, 식별자에 긴 꼴)은 통과한다. 대표 자리는 AC2가 잠그고, 나머지는 리뷰 대상이다(선언 경계).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/scripts/check-product-naming.mjs` (신규) | 검사기 | 범위 = §6 경로 glob. 순수 함수 `scan(files, read, allowed)` + CLI | 순수 단위(`*.test.mjs`) |
| `app/scripts/check-product-naming.test.mjs` (신규) | EP-01 6분기 | 임시 트리 대신 메모리 입력으로 `scan` 호출 | `node --test` |
| `.github/workflows/ci.yml` · `release.yml` · `test-pools-experiment.yml` | 검사기 단계 추가(ci) · Variables·env 이름 변경 | 문서 가드 단계 옆에 1단계 | — |
| `app/src/main/product-identity.test.ts` | 이름 잠금 | `코드 식별자 불변 (EP-11)` 블록 → `이름 규칙 (0306)` 5케이스. 레거시 상수 케이스는 유지 | 소스 읽기 단언 |
| `app/src/shared/ipc.ts` · `preload/**` · `renderer/**` · `main/**` | 이름 변경 | D-004 규칙 적용 | 기존 테스트 |
| 소스 파일 6개 | 파일명 | `git mv` — `orca-file.ts`→`oo-file.ts` · `orca-config.ts`→`oo-config.ts`(+테스트 2) · `OrcaLogo.tsx`→`OoLogo.tsx`(+테스트 1) | typecheck |
| `app/scripts/check-doc-inventory.mjs` | 채널 정규식 | `'orca:` → `'oo:` 후 `docs/generated/inventory.md` 재생성 | 기존 `*.test.mjs` |
| 현재 문서(§6) | 표기 | N1 적용 · 코드 식별자 인용은 새 이름 | 검사기·문서 가드 |
| `docs/guides/release-operations.md` | 운영 안내 | Variables 3개 새 이름 + "옛 이름 값은 무시된다" 1문단 | AC7 |

**작업 순서** — 각 단계 끝에 typecheck가 green이어야 다음으로 간다. 한 번에 전부 치환하지 않는다.

1. 검사기와 그 테스트를 먼저 만든다(허용 목록 = 현재 트리 전체가 아니라 D-005 6파일만 — 이 시점에는 red가 정상).
2. N3 식별자를 TypeScript 이름 바꾸기 단위로 옮긴다: `window.orca`·`OrcaApi` → 타입·함수·상수 → 파일명.
3. N4 채널 접두사 + 문서 가드 정규식 + 생성물.
4. N2 값: EP-04·05·06·07·08을 자리 목록대로, 생산자·소비자를 같은 커밋에.
5. N1 주석·fixture 문자열·문서.
6. 검사기 green 확인 → 운영 gate 전부.

### 테스트 가능성

- 검사기는 `electron`·DB를 import하지 않는다 — ABI 중립.
- 문자열 치환이 닿는 테스트 파일은 시간 예산·풀 분류 규칙을 새로 어기지 않는다(문자열만 바뀜). 가드는 그대로 돌린다.

## 12. End-to-end 영향

### producer → consumer

§10 EP-02~EP-08이 전부다. 그 밖의 문자열 쌍이 구현 중 나오면 `[구현자 기입]`에 PLAN_GAP으로 올린다.

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음 — 등록 값의 수를 늘리지 않는다.

## 13. Lifecycle / 오류 / 정리

해당 없음 — 수명주기·오류 경로를 바꾸지 않는다.

## 14. 성능 / 상한 / 최적화

- 런타임 변화 없음. 검사기는 추적 파일 1회 읽기(수 초)다.

## 15. 외부 구현 포트 / 문서 계약

- 폐쇄망 배포 가이드(`docs/guides/`)가 인용하는 식별자·env 이름이 새 이름과 맞아야 한다 — AC1 검사기 범위에 포함.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 코드 식별자는 무차별 치환하지 않는다 | 0225 D-012 · `product-identity.test.ts:280` | §3 D-001 | **변경** — 사용자 결정(턴 B) |
| 과거 기록은 치환하지 않는다 | 0225 D-012 · root `AGENTS.md` 원칙 1 | §3 D-003 | 유지 |
| 옛 경로를 fallback으로 쓰지 않는다 | 0225 D-010 | §3 D-005 | 유지 — 이관 모듈만 옛 이름을 쥔다 |
| 컴포넌트에서 `window.orca` 직접 호출 금지 | `docs/arch/frontend/state.md` §1.3 | §9 | 유지 — 이름만 `window.oo` |
| 머지된 마이그레이션 수정 금지 | `app/AGENTS.md` | §3 D-006 | 유지 |
| 코드에서 셀 수 있는 수치를 문서에 적지 않는다 | root `AGENTS.md` 원칙 4 | §8 수치 | 유지 — `docs/handoff/`는 검사 제외 대상 |
| UI 라벨은 한국어·표시명 SSOT | 0225 EP-04 | — | 유지 — 화면 문구는 건드리지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 443파일 변경이 진행 중인 다른 브랜치와 충돌한다 | 0305 후속보다 먼저 병합(§6). 병합 직전 `main` 재기준 후 검사기를 다시 돌린다 |
| 문자열 쌍의 한쪽만 바뀐다 | §10 자리 목록 + VP-06·VP-09 변이 |
| `oo`가 짧아 다른 단어와 겹친다 | N3는 식별자 접두사로만 쓴다. 검사기는 옛 표기만 보므로 `oo` 자체는 판정하지 않는다 |
| GitHub Variables를 안 바꾸면 CI 제한 시간이 기본값으로 돌아간다 | D-008 · AC9 사람 판정 · 운영 문서 안내(AC7) |
| 모델 대면 도구 이름이 길어진다(`mcp__orcinus_orca_artifacts__publish_artifact`) | 허용 — D-004 N2. 도구 이름 길이 제한(64자) 안이다: 45자 |

## 18. 영향 받는 파일 / 문서

- 코드 443파일 · 현재 문서 37파일 · 워크플로 3파일 · 신규 2파일(§8·§11).

## 19. 게이트

- `app/`에서: `node scripts/check-product-naming.mjs` · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs`.
- 사람: AC9(GitHub Variables) · AC10(설치본 실기).

## READY self-review

- 결정 8건을 Ledger에 `ACTIVE`로 두고 0225 D-012와의 대체 관계를 적었다.
- 사용자 문장 4건을 원문으로 인용했고, 위임받은 규칙(D-004)은 설계자 판단으로 표시했다.
- 수치는 이 세션에서 기준 커밋 `499d354`로 다시 셌다(§8). 설계자 자신의 질의 예시 오류 2건을 §4에 정정했다.
- `NEW` 노드 전부에 같은 레벨 `REQUIRED` pair가 있고, 0225 이관은 `REGRESSION`(VP-04)이다.
- EP-01 규칙 6분기 ↔ UT 입력 6묶음이 1:1이다. 검사기는 fail-closed + 허용 목록이다.
- 사람 실기는 AC9·AC10(외부 설정·실제 설치본)뿐이다.
- 남긴 한계: EP-07의 30자리와 EP-08의 자리는 명령으로 고정했고 자리별 테스트 귀속은 구현자가 표로 채운다.

## [구현자 기입] 설계 리뷰 — r1

- 구현자 = Claude(비기능 작업). 설계와 같은 에이전트라 규범 행 정정은 별도 설계 커밋 2개(rev.2·rev.3)로 분리했다.
- plan §11 작업 순서(단계별 typecheck)는 따르지 않았다 — TypeScript AST로 토큰 종류(식별자·문자열·주석)를 가른 변환 스크립트를 한 번에 적용하고 typecheck·전체 테스트로 판정했다. 결과물의 계약(D-004)은 같다.
- 설계가 틀린 곳 6건은 §3 "r1 구현 중 설계 정정" 표 C1~C6에 있다.

## [구현자 기입] 강제 지점 전수 (§10 대조) — r1

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01·VP-08 | EP-01 검사기 7분기 | 7 | 7/7 | `node --test app/scripts/check-product-naming.test.mjs` → 35 pass. 분기별 describe ①~⑦ | 입력을 `FORMS`에서 만들어 꼴마다 따로 준다 | — |
| VP-05 | EP-02 노출 키 3자리 | 3 | 3/3 | `preload/index.test.ts` — 키를 `xx`로 바꾸면 28/29 red. d.ts·`logging.ts`는 `gate:npm run typecheck`(전역 타입) | 키 값 `oo` ↔ `xx` | — |
| VP-02·VP-05 | EP-03 채널 접두사 3자리 | 3 | 3/3 | `product-identity.test.ts:'IPC 채널이 전부 oo: …'` · `check-doc-inventory.test.mjs`(정규식 변이 → 2 red) · `gate:check-doc-inventory --check` | 채널 수 117 = 생성물 | — |
| VP-06 | EP-04 영수증 type 3자리 | 3 | 3/3 | 소비 `writer.ts` 변이 → 4 red · 생산 `service.ts:224` 변이 → 3 red (`src/main/features/{history,artifacts}`) | 리터럴 ↔ `x.artifact.published` | — |
| VP-06 | EP-05 도구 이름 3자리 | 3 | 3/3 | 소비 `artifact-queries.ts` 변이 → 9 red · 생산 `tool.ts` id 변이 → +1 red | 서버 id ↔ `x_artifacts` | `tool.ts:30` `connectorId`는 따로 심지 않았다 |
| VP-09 | EP-06 표식 17자리 | 17 | 17/17 | 이스케이프 6줄 변이 → 6/6 red(`diff-requirements`·`attachment-prompt`·`plan-feedback` 테스트). 상수 11줄은 `product-identity.test.ts:'프롬프트 표식 4군…'` + 조립 테스트 | 테스트 입력이 새 표식 꼴 | — |
| VP-06 | EP-07 값 34줄 + env 4 + alias 1 | 39 | 39/39 | 34줄 전수 변이(`'x-source'`) — vitest red 22 · typecheck red 9 · 신규 테스트 red 3. env 4 → 4 red(1은 신규 테스트). alias → `product-identity.test.ts:'OpenCode 관리 MCP alias…'` | 값 ↔ `x-source` | — |
| VP-07 | EP-08 env 이름 | 스크립트 2 + 워크플로 10줄 | 2/2 (스크립트) | `test-time.test.mjs` 변이 → 5 red · `test-pools.test.mjs` 변이 → 3 red | env 이름 | 워크플로 `vars.*` ↔ 저장소 설정은 사람(AC9) |
| VP-04 | EP-09 허용 목록 12파일 | 12 | 12/12 | `check-product-naming.test.mjs:'허용 목록의 파일 집합은 고정이다'` · `--report-allowed` 등록=실제 13항목 | 파일 집합 일치 | — |

- 자리 검색 재실행: EP-06 `grep -n "ORCINUS_ORCA_" <3파일>` → lint 재포맷으로 `diff-requirements.ts` 이스케이프가 15~19줄로 늘었다(자리 수 같음). EP-07 값 리터럴은 diff에서 34줄(rev.2 C4).

### V-pair 자기확인

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `gate: node app/scripts/check-product-naming.mjs` → OK 2,161파일 · 허용 13항목 | VP-08이 든다 |
| VP-02 | REQUIRED | SELF_PASS | `product-identity.test.ts` `이름 규칙 (0306)` 8케이스 | not selected |
| VP-03 | REQUIRED | SELF_PASS | vitest 실패 집합 변경 전후 차집합 ∅ | not selected |
| VP-04 | REGRESSION | SELF_PASS | `product-identity.test.ts:'레거시 슬러그 상수…'` · `migrate-legacy.test.ts` · `rebase-path.test.ts`(HEAD 그대로) | not selected |
| VP-05 | REQUIRED | SELF_PASS | `preload/index.test.ts` | 노출 키 되돌림 → 28 red |
| VP-06 | REQUIRED | SELF_PASS | 위 표 EP-04·05·07 | 소비 쪽 리터럴 되돌림 → 자리마다 red |
| VP-07 | REQUIRED | SELF_PASS | `test-time.test.mjs` · `test-pools.test.mjs` | not selected(직접 값) |
| VP-08 | REQUIRED | SELF_PASS | `check-product-naming.test.mjs` 35케이스 | 개수 대조·꼴별 입력이 케이스로 있다 |
| VP-09 | REQUIRED | SELF_PASS | 표식 3파일 테스트 | 이스케이프 리터럴 되돌림 6/6 red |

## [구현자 기입] 이번 라운드 수정의 잠금 — r1

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `preload/index.ts` 노출 키 → `xx` | VP-05 선택 증거 | 최초 | `preload/index.test.ts` 28 | 잡음 |
| `writer.ts`·`service.ts:224` 영수증 type | sweep — EP-04 | 최초 | 4 · 3 | 잡음 |
| `artifact-queries.ts`·`tool.ts:29` 도구 이름 | sweep — EP-05 | 최초 | 9 · 1 | 잡음 |
| 표식 이스케이프 6줄(3파일) | VP-09 선택 증거 | 최초 | 각 1 (attachment 시작 상수는 16) | 잡음 — `plan-feedback.ts:28`은 처음에 못 잡아 테스트 추가 |
| `'orcinus-orca'` 값 34줄 | sweep — EP-07 | 최초 | vitest 22줄 · typecheck 9줄 · 신규 테스트 3줄 | 잡음 — 3줄(`bootstrap.ts:284`·`deployer.ts:195`·`attachMenuModel.ts:152`)은 처음에 못 잡아 테스트 추가 |
| env 접두사 4줄 | sweep — EP-07 | 최초 | 6 · 4 · 1 · (diagnostics 37은 34와 같은 케이스) | 잡음 — `mcp/store.ts:44`는 처음에 못 잡아 테스트 추가 |
| `extension-sources.ts` 라벨 키 → `oo` | 구현 중 발견한 오변환의 재현 | 최초 | 15 | 잡음 |
| `git-diff-parse.ts` 커밋 표식 | sweep — path edge | 최초 | 19 | 잡음 |
| `test-time.mjs`·`test-pools.mjs` env 이름 | sweep — EP-08 | 최초 | 5 · 3 | 잡음 |
| `check-doc-inventory.mjs` 채널 정규식 | sweep — EP-03 | 최초 | 2 | 잡음 |

- 검산: 선택 증거 3(VP-05·06·09) · 인용 변이 0 · 새 oracle 2(검사기 테스트 · 이름 규칙 블록) · sweep 7 = 표 행 10(선택 증거 2행이 sweep과 겹친다).
- 처음에 `못 잡음`이던 5자리에 더한 테스트: `plan-feedback.test.ts`(코멘트 표식) · `mcp/store.test.ts`(합성 변수 이름) · `attachMenuModel.test.ts`(삽입 타입 · 플러그인 머리글 아이콘) · `product-identity.test.ts`(스킬 출처 생산 자리 · alias). 다섯 다 재실행에서 red.

## [구현자 기입] Product/UX 파생 검토 — r1

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 화면 문구는 새로 만들지 않았다. 모델 대면 문구(시스템 머리글 · 도구 설명)는 표시명으로 바뀌었다 | — |
| seam을 만들려고 production을 재배치했는가 | 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 검사기 실패 2행(옛 표기 · 허용 개수 불일치) | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | **보인다 — 꺼 둔 제품 스킬이 알림 없이 다시 켜진다**(§3 C3). D-002가 정한 결과다 | 사용자에게 보고(아래 #1) |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r1

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 출처 id가 `skillEnabled` 설정 키의 접두사다 — 이름을 바꾸면 꺼 둔 제품 스킬이 다시 켜진다 | ⚠️ 보고만 — D-002(호환 없음)가 정한 결과. plan §8의 "저장되지 않는다"는 틀려서 rev.2 C3로 정정 | `scan.ts` `skillEnabledKey` · `handlers/skills.ts:71` |
| 2 | 일괄 변환이 `extensionSourceLabels`의 키를 식별자(`oo`)로 바꿔 제품 출처 라벨이 `undefined`가 됐다 | ✅ 선조치 — 키를 `'orcinus-orca'`로 | `Record<string,string>`이라 typecheck가 못 본다. 변이로 15 red 확인 |
| 3 | 변환이 `${` 옆 토큰을 잘못 갈랐다 — OpenCode alias 접두사가 `oo_`가 됐다 | ✅ 선조치 + 테스트 추가 | 실기 전용 테스트(`managed-mcp.cli.integration`)만 접두사를 봐서 green이었다 |
| 4 | 변환이 문자열 속 `\n` 앞의 표시명을 경로로 오판했다(시스템 머리글 `# orcinus-orca`) | ✅ 선조치 — 머리글을 `PRODUCT_DISPLAY_NAME` 파생으로 | `system-header.test.ts` red로 발견 |
| 5 | `rebase-path.test.ts`의 옛 루트·새 루트가 같은 값이 됐다 — green인 채 의미를 잃음 | ✅ 선조치 — HEAD로 되돌리고 허용 목록 등록(rev.2 C1) | diff 검토로 발견 |
| 6 | 지난 문서를 가리키는 링크 9종이 함께 바뀌어 끊어졌다 | ✅ 선조치 — 링크 복원 + 검사기 ⑦분기(rev.2 C2) | `check-doc-inventory --check` red |
| 7 | 스폰 추적 테스트가 범위 밖 0300 증거 스크립트를 실행한다 — 그 스크립트는 옛 환경변수 이름을 읽는다 | ✅ 선조치 — 테스트의 이름을 옛 이름으로 유지 + 허용 목록(rev.3 C6) | `node --test` 1 red |
| 8 | CI 경로 필터가 `app/**`·`.github/workflows/**`라 문서만 바꾼 PR에서는 검사기가 돌지 않는다 | ⚠️ 보고만 — 문서 인벤토리 가드와 같은 조건이다 | `ci.yml` paths |
| 9 | 검사기는 N2/N3를 뒤바꾼 것(값에 `oo`, 식별자에 긴 꼴)을 보지 않는다 | ⚠️ 보고만 — plan §10 선언 경계 | — |

### 설계 대비 명시적 차이

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 수명주기를 바꾸지 않았다 | — |
| 공유 | 검사기 ⑦분기는 추적 파일 목록에 기댄다 — 범위 밖 파일을 지우면 그 링크가 위반이 된다(의도) | EP-01 ⑦ UT "파일이 없어지면 같은 링크가 위반" |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 작업 순서를 일괄 변환으로 바꿨다 — 단계별 typecheck 대신 마지막 트리의 전체 gate로 판정 | AC3 차집합 ∅ |

## [구현자 기입] 구현 보고 — r1

| 항목 | 내용 |
|---|---|
| 변경 파일 | 476 — 코드·문서 이름 변경 469 · 파일명 변경 6(`oo-file`·`oo-config`(+테스트 2)·`OoLogo`(+테스트 1)) · 신규 2(`check-product-naming.mjs`·`.test.mjs`) · 워크플로 3 |
| 실행 명령 | `app/`에서 `node scripts/check-product-naming.mjs` · `check-migrations-appendonly.mjs` · `check-doc-inventory.mjs --check` · `check-test-budgets.mjs` · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` |
| **관측한 게이트 산출** | 이름 검사기 OK(2,161파일 · 허용 13항목) · 문서 가드 OK(117 채널 · 링크 전부 해석) · 예산 가드 OK(20 suites) · lint error 0 · warning 2(변경 전과 같음) · typecheck error 0 · vitest 945파일: 22 failed / 8,795 passed · `node --test` 862 pass / 0 fail |
| 기준선 분리 | 변경 전(better-sqlite3를 Node ABI로 재빌드한 같은 환경) vitest 22 failed / 8,787 passed. 실패 집합 차집합 **양방향 ∅**(파일명 변경 3건 정규화 후 `comm`). 원인은 Electron 미설치·Windows 경로 전제(`C:/…` 절대경로 판정) — 환경 |
| 추가·수정 테스트의 subtree 규칙 | 테스트 파일은 문자열만 바뀌었고 신규 케이스 8(`product-identity` 4 순증 · 그 밖 4). 예산 가드·unit 풀 가드 위반 0(전체 실행에 포함) |
| V-pair 자기확인 | `SELF_PASS 9 / SELF_BLOCKED 0` |
| 강제 지점 전수 | EP-01 7/7 · EP-02 3/3 · EP-03 3/3 · EP-04 3/3 · EP-05 3/3 · EP-06 17/17 · EP-07 39/39 · EP-08 2/2(스크립트) · EP-09 12/12 |
| **AC 자기보고** | AC1 ✅ 검사기 OK · AC2 ✅ `이름 규칙 (0306)` 8케이스 pass · AC3 ✅ 실패 집합 차집합 ∅ · AC4 ✅ 고정 12파일 단언 pass · AC5 ✅ 이관 3모듈 테스트 pass · AC6 ✅ 문서 가드 OK, `git diff --name-only`에서 D-003 경로 0(이 handoff 디렉토리 제외) · AC7 ✅ Variables 3개 이름 단언 pass · AC8 ✅ 검사기 테스트 35 pass · AC9 ⚠️ 사람 · AC10 ⚠️ 사람 |
| **합계 검산** | `✅ 8 · ⚠️ 2 · ❌ 0 = 총 10` |
| 블로커 / 역질문 | 없음. 사용자 보고 1건 — 꺼 둔 제품 스킬이 다시 켜진다(#1) |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 라운드 1 · impl 턴 `r1`.
- plan 조사가 템플릿으로 조립되는 저장 키를 `sourceId` 문자열 검색으로만 찾아 놓쳤다(C3).
- plan의 "유지 대상"이 코드 5파일로만 열거돼 문서·링크·지난 스크립트의 입력이 구현 중 세 번 추가됐다(C1·C2·C6).
- 이 환경은 Electron 바이너리를 받을 수 없어 `dev`/`build`와 설치본 실기는 하지 못했다(AC10).

## [검증자 기입] 파생 이슈

r1 verify 결과 `RETURN_TO_PLAN`. 상세·재현은 [`verify.md`](verify.md) §3.

| # | 분류 | 상태 | 출처 계약 | 내용 | 대응 방향(제안) |
|---|---|---|---|---|---|
| F1 | 현재 결함 | open · BLOCKING | D-004 N4 · §11 "코드 식별자 인용은 새 이름" | `GLOSSARY.md:67` 노출 키 `'orcinus-orca'`(코드는 `'oo'`) · `TRD.md:170·172`·`IPC_CONTRACT.md:374` 채널 접두사 `orcinus-orca:`(N4는 `oo:`) | 4곳을 코드 이름으로 정정 |
| F2 | 이행 결함 | open · BLOCKING | §10 EP-08 "워크플로 `env:`·`vars.` 10줄" · VP-07 | `test-pools-experiment.yml:40` env 이름 변이가 어느 테스트에도 안 걸린다(V18) | 그 워크플로의 env·vars 이름을 단언하는 oracle 추가(`ci.yml`·`release.yml`은 `test-time.test.mjs`가 이미 잠금) |
| F3 | 확장 후보 · PLAN_GAP | open · 설계자 | D-001·D-003·§6 | `docs/spec/{AGENTS.md,claude/agent-sdk/INDEX.md,opencode/INDEX.md}`의 `Orca` 산문 5줄 — §6 범위에도 D-003 제외에도 없음 · `app/.gitignore:162` 옛 캐시 폴더 이름 | 항목마다 범위 편입 또는 경계 선언. `docs/spec/`는 원문 미러 편집 금지 규칙과 얽혀 사용자 결정 가능성 |
| F5 | 동치 | closed | §10 EP-05 `:30` | `connectorId`는 이름 합성에 안 쓰여 값 변경이 동작에 영향 없음(V07 green) | 구현 보고 `3/3`의 `:30`은 oracle 없음으로 정정 |
