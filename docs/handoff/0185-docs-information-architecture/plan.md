# Plan — 0185-docs-information-architecture

## 메타

| 항목 | 값 |
|---|---|
| slug | `0185-docs-information-architecture` |
| 작성자 | Claude Code |
| 일자 | 2026-08-11 |
| 매핑 | PHASES 행 없음 (본 작업이 PHASES 를 archive 로 내린다) / PR 없음 |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "현재 문서화 수준을 검토하고 첨부가이드에 맞춰 어떤 부분을 보완하고, 덜어내야하는지 검토하라" | 라이브 세션 요청 (2026-08-11) + 첨부 문서 *Orca-skin Agent-Driven Documentation Refactoring Guide* |
| 명시 요구 (확인) | 핸드오프 이력 = "INDEX 활성만 남기고 이력 archive". PRD/TRD = "stale 수치만 제거하고 자리 유지" | 라이브 세션 선택지 응답 (2026-08-11) |
| 추론 의도 | *(추론)* 검토에 그치지 않고 재편까지 수행한다 — 사용자가 두 범위 선택지에 답한 것은 실행을 전제한 것으로 해석 | 위 선택지 응답 |
| 추론 의도 | *(추론)* 가이드는 *기준*이지 *명세*다 — 저장소 사실과 충돌하면 가이드 목적(에이전트 컨텍스트 절약·현재 사실 우선)을 만족하는 선에서 조정한다 | 가이드 §변경 시 지켜야 할 원칙 "문서를 적게 만드는 것이 최종 목표가 아니다" |

## Context (왜)

첨부 가이드는 6개 문제를 지목한다 — 무관한 과거 기록 상시 로드 · 같은 사실의 복제 · 현재 상태와
과거 이력의 혼재 · `AGENTS.md` 의 장문 기술문서화 · truth precedence 불명확 · **코드에서 확인
가능한 수치의 수동 복제**.

이 저장소를 6개 항목에 대조한 결과 **여섯 번째가 이미 실재하는 손상**을 만들고 있었다. 추정이
아니라 지금 문서에 살아 있는 오류다(§자료조사 1). 나머지 다섯은 그 오류를 *재생산하는 구조*다.

의도한 결과: 에이전트가 `root AGENTS → 영역 AGENTS → 해당 current-state 문서 → 코드` 만으로
작업에 착수할 수 있고, 코드에서 셀 수 있는 수치는 문서가 아예 갖지 않는 상태.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **전제 정정** | 요구 문구의 "덜어내야" 는 *양*을 겨냥하나, 실측상 주된 해악은 양이 아니라 **복제된 수치의 drift** 다 — 6개 수치 중 4개가 현재 틀렸다(§자료조사 1). 가이드 자신도 §변경 시 지켜야 할 원칙에서 "문서 삭제 작업이 아니라 information architecture 변경" 이라 못박는다. 요구의 *목적*(에이전트가 잘못된 정보를 현재 규칙으로 오인하지 않는 저장소)은 그대로 유지하고, 수단을 감축이 아니라 **SSOT 화 + 계층 분리**로 잡는다. |
| 이미 있는 것 아닌가 (기존 작업으로 충족되나) | **이견 — 이미 두 번 했고 두 번 다 재발했다** | 핸드오프 `0177-docs-agents-sync`(2026-08-05)가 문서 21개를 전수 동기화하며 *"IPC 채널이 문서마다 64·65·82 로 세 갈래 ↔ 실측 86"* 을 고쳤다(`docs/PHASES.md:271`). **6일 뒤** 같은 수치가 다시 `76`/`86` 두 갈래다. 0177 은 심지어 재발 방지를 시도했다 — `runtime-ipc.md:4` 가 *"재서술하던 채널 총계를 삭제하고 SSOT 링크만 남김"*. **그 파일 하나는 지금도 깨끗**하지만 규칙이 사람 관례라 나머지로 번지지 않았다. → 필요한 것은 세 번째 동기화가 아니라 **기계 강제**다. |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **있으나 부족** | "stale 수치만 고치기" = 0177 과 동일 작업이고 관측된 반감기가 1주다. 최소 구조 변경은 **Phase 1(generated + CI 게이트) 하나** 이며, 이것만으로 §자료조사 1 의 오류 4건이 닫히고 재발 경로가 막힌다. Phase 2~5 는 그보다 낮은 우선순위이고 독립적으로 되돌릴 수 있다 — 그래서 Phase 1 을 먼저 배치했다. |
| 인용 자료(가이드)가 요구를 부풀리지 않았나 | **일부 부풀림 — 3건 조정** | ① `.agents/work/active/` 이전: 이 저장소의 핸드오프는 스킬 2종·상태 머신·커밋 trailer 규약과 맞물려 있어 이전 비용이 이득을 넘는다(사용자 기각). ② PRD/TRD archive 이전: 저장소 전체가 두 문서를 인용하고 `app/AGENTS.md` 가 *"본 디렉토리 1차 사양은 `../docs/TRD.md`"* 로 명시(사용자 기각). ③ **`docs/contracts/ipc.md` 로 개명**: 가이드의 목표 트리에 있으나, `IPC_CONTRACT.md` 는 이미 SSOT 로 기능하고 `docs/**`·`app/**` 다수가 인용한다 — 개명은 링크 파손 위험만 사고 truth model 상 이득이 0이라 **채택하지 않는다**. |
| 기존 채택 결정을 뒤집는가 | **예 — 1건** | `docs/handoff/AGENTS.md` §3 의 *"PASS: … `docs/PHASES.md` 표 행 승격"* 절차를 뒤집는다. PHASES 를 archive 로 내리므로 승격 대상이 사라진다. 상세는 §기존 결정·규칙과의 관계. |

- **사용자에게 올릴 것**(단독 결정 불가): 없음. 두 개의 일방향 결정(핸드오프 이력 처리 · PRD/TRD
  거취)은 착수 전 선택지로 올려 답을 받았다(§사용자 의도).

## 자료조사 (Research)

> 아래 모든 수치는 **이번 세션에서 직접 측정**했다. 선행 문서의 숫자를 승계한 것은 0건이다.
> 기준: `main` HEAD `4364116` (2026-08-11).

### 1. 수치 drift 실측 — 6개 중 4개가 현재 틀림

| 수치 | 실측 | 측정 방법 | 일치 | **불일치** |
|---|---|---|---|---|
| IPC 채널 | **76** | `grep -oE "'orca:[a-zA-Z0-9:._-]+'" app/src/shared/ipc.ts \| sort -u \| wc -l` | `docs/IPC_CONTRACT.md:26` · `docs/AGENTS.md:15` | `docs/PRD.md:289`=86 · `docs/TRD.md:7,126,612`=86 · `docs/PHASES.md:9`=86 |
| main 슬라이스 | **9** | `ls app/src/main/features/ \| wc -l` | `app/AGENTS.md:52` · `arch/backend/overview.md` | `AGENTS.md:13`=11 · `docs/ARCHITECTURE.md:18`=11 · `docs/PHASES.md:9`=11 |
| contracts 모듈 | **5** | `ls app/src/main/contracts/*.ts` 중 `.test.ts` 제외 | `app/src/main/AGENTS.md:29` · `arch/backend/overview.md:92` | `docs/ARCHITECTURE.md:18`=9 · `docs/AGENTS.md:14`=7 |
| settings 키 | **18** | `SettingsSchema` 최상위 키 (`app/src/shared/protocol.ts:489`) | `docs/AGENTS.md:14` · `arch/backend/overview.md` | `docs/PRD.md:117`=20 · `docs/TRD.md:7`=20 |
| NormalizedEvent variant | **31~32** | `IPC_CONTRACT.md §3` 카탈로그 행 실측 32 (union 정의 `app/src/shared/ipc.ts:430~`) | — | `docs/GLOSSARY.md:16`=19 · `docs/PRD.md:289`=21 · `docs/AGENTS.md:15`=21 |
| DB 마이그레이션 | **16** | `ls app/src/main/infra/db/migrations/*.sql \| wc -l` | 5개 문서 전부 | — (현재 일치, 그러나 5곳 복제) |
| IPC 핸들러 | **13** | `ls app/src/main/app/handlers/` 중 `.test.ts` 제외 | 3개 문서 | — (현재 일치, 그러나 3곳 복제) |

**내역 합 = 총계 검산**: `IPC_CONTRACT.md:28` 의 도메인별 분포를 합산하면
`6+2+1+1+5+2+6+2+7+5+7+6+3+1+4+5+1+2+1+2+1+6 = 76` — 실측 76 과 일치. IPC_CONTRACT 는 정합하다.
틀린 것은 **그것을 인용한다고 적어놓은 사본들**이다.

> `docs/GLOSSARY.md:16` 이 특히 나쁘다: *"전수 variant(현재 19종)는 IPC_CONTRACT §3 이 SSOT"* —
> **SSOT 를 지목하는 문장 자체가 그 SSOT 와 다른 사본을 만들고 있다.** SSOT 선언이 복제를 막지
> 못한다는 직접 증거다.

### 2. 상태 문서 stale

`docs/PHASES.md:13,26,38` 이 0180·0181·0182 를 `impl/IMPL_DONE, 검증 대기` 로 적는다.
`git log` 실측: 셋 다 종료됐고 0183·0184 까지 `verify/PASS` (`4364116 docs(handoff): 0184 검증 (PASS r1)`).
라이브 상태를 `PHASES.md` + `handoff/INDEX.md` 두 곳에 적은 결과 한쪽이 낡았다.

### 3. 이력의 부피 (전수)

| 대상 | 실측 | 비고 |
|---|---|---|
| `docs/handoff/INDEX.md` | **381,040 B / 184 데이터 행** | 상태 분포: `verify/PASS` 계열 **158** · `impl/IMPL_DONE` 계열 **24** · `verify/FAIL` **1** · `impl/SUPERSEDED` **1** |
| `docs/PHASES.md` | **298,134 B** | 같은 완료 이력의 두 번째 사본 |
| `docs/arch/**` | 400 KB | 현재 상태 정본 |
| `docs/handoff/**` 전체 | 6.4 MB / 348 md | `plan.md`·`verify.md` 원본 (보존) |

완료 이력 서사 **679 KB** 가 현재 상태 아키텍처 전체(400 KB)의 1.7배다. 두 문서 모두 스스로
*"완료 이력의 정본은 `git log`"* 라고 선언한다(`docs/PHASES.md:3`).

### 4. 핸드오프 번호 오염 (전수 grep, `docs/handoff/` 밖)

`docs/arch/**` + `docs/guides/**` 합계 **502건**. 파일별:

```
71 arch/backend/overview.md   34 arch/frontend/layers.md    17 arch/backend/system-prompt.md
64 arch/backend/security.md   30 arch/backend/runtime-ipc.md 14 arch/backend/observability.md
54 arch/backend/providers.md  29 arch/backend/persistence.md 14 arch/backend/adapters.md
                              24 arch/frontend/overview.md   13 arch/backend/standardization.md
                              23 arch/frontend/state.md      11 arch/frontend/rendering.md
                              23 arch/backend/provider-runtime.md  8 arch/frontend/dom-architecture.md
                              19 arch/frontend/ux-domains.md  1 arch/backend/terms.md
```

`arch/backend/overview.md:4` 한 줄에 0183 r2 → 0181 → 0180 → 0177 → 0094 의 델타가 **수치 전이
(`7→5`, `77→76`, `11→9`)까지 포함해** 누적돼 있다. 가이드 §Architecture 문서가 제거 대상으로
지목한 형태(`0180에서 제거` / `77 → 76` / `11 → 9`)와 정확히 일치한다.

### 5. `AGENTS.md` 체계 실측

현재 **11개 / 965줄**. `docs/spec/` 에 **3단 타워**(`spec/` → `spec/claude/` → `spec/claude/agent-sdk/`)가
있고, 가이드 §Vendor 가 이 3단을 **문자 그대로 anti-pattern 예시로 인용**한다.
`app/src/renderer/AGENTS.md` 는 **부재**(실측: `ls` 결과 없음)이나 renderer 고유 invariant
(4-layer boundaries · Tailwind `group/<이름>` 스코프 격리)는 `app/AGENTS.md:94,167` 에 존재한다.

### 6. 저장소 규칙 (설계 입력)

| 규칙 | 출처 | 이번 설계에 미치는 영향 |
|---|---|---|
| 머지된 마이그레이션 수정 금지를 **CI 스크립트로 기계 강제** | `app/scripts/check-migrations-appendonly.mjs` + `.github/workflows/ci.yml:49` | **선례 그대로 재사용**한다 — 신설 스크립트는 같은 패턴(`*.mjs` + `*.test.mjs` + CI 스텝) |
| `npm test` 는 better-sqlite3 ABI 를 Node 로 뒤집는다 | `app/AGENTS.md:119-131` | 문서 작업 게이트는 `lint`+`typecheck`+`node --test` 로 잡는다 |
| `scripts/*.test.mjs` 는 `npm test` 가 자동 실행 | `app/AGENTS.md:146` · `package.json` | 신설 스크립트의 테스트가 자동 편입된다 |
| `AGENTS.md` 정본 + `@AGENTS.md` stub `CLAUDE.md` 동반 | 루트 `AGENTS.md` §AGENTS.md/CLAUDE.md 규약 | AGENTS 신설·삭제마다 stub 동반 처리 |
| 상대링크 파손은 실재한 사고 | `docs/PHASES.md:271` (0177 이 **22→0** 으로 고침) | 이동이 많은 Phase 4·5 후 링크 전수 확인을 AC 로 건다 |

### 7. `PHASES.md`/`INDEX.md` 를 인용하는 문서 (전수 = 12, `docs/handoff/<NNNN>/` 제외)

`AGENTS.md` · `app/AGENTS.md` · `docs/AGENTS.md` · `docs/PRD.md` · `docs/guides/AGENTS.md` ·
`docs/handoff/AGENTS.md` · `docs/PHASES.md` · `docs/handoff/INDEX.md` ·
`.agents/skills/handoff-plan/{SKILL.md,references/failure-patterns.md}` ·
`.agents/skills/handoff-verify/{SKILL.md,verify.template.md}`.

→ Phase 4 의 링크 갱신 대상은 **12건**이며, 그중 **스킬 4건**은 절차 정본이라 함께 고쳐야 한다.

## 인수 기준 (Acceptance Criteria)

> "프로덕션 도달 경로" = *에이전트/CI 가 실제로 이 산출물에 닿는 경로*. 문서 작업이므로 런타임
> 진입점 대신 **읽기 경로 / 게이트 경로**를 적는다.

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `check-doc-inventory.mjs --check` 가 **현재 코드에서** exit 0 으로 통과한다 | `cd app && node scripts/check-doc-inventory.mjs --check` | `.github/workflows/ci.yml` 신규 스텝 → 모든 PR·main push |
| 2 | 코드의 슬라이스 디렉토리를 **1개 추가**하면 `--check` 가 exit 1 로 실패한다 (재발 방지가 실제로 작동함을 양성 단언) | `app/scripts/check-doc-inventory.test.mjs::"슬라이스 추가 시 --check 가 실패한다"` (임시 디렉토리 fixture) | 위와 동일 |
| 3 | `docs/generated/inventory.md` 가 §자료조사 1 의 7개 수치를 **실측값으로** 담고, 각 행에 정본 코드 경로가 있다 | `app/scripts/check-doc-inventory.test.mjs::"생성 결과가 7개 항목과 정본 경로를 담는다"` | `docs/INDEX.md` → `generated/inventory.md` |
| 4 | `docs/**` + 루트·`app/**` 의 `AGENTS.md` 본문에서 **채널·슬라이스·contracts·settings 키·variant 수를 서술하는 문장이 0건**이다 (`docs/generated/` 와 `docs/archive/` 제외) | `app/scripts/check-doc-inventory.test.mjs::"본문에 수치 서술이 남아 있지 않다"` (정규식 전수 스캔) | 에이전트가 여는 모든 current-state 문서 |
| 5 | `docs/INDEX.md` 가 존재하고, §자료조사 4 의 작업 유형(세션 런타임·chat turn·provider·보안·renderer 상태·렌더링·IPC·릴리스·폐쇄망·용어·ADR)마다 **1행 이상**의 라우팅 행을 갖는다 | `app/scripts/check-doc-inventory.test.mjs::"INDEX 라우팅 표가 11개 작업 유형을 덮는다"` | 루트 `AGENTS.md` → `docs/INDEX.md` |
| 6 | 루트 `AGENTS.md` 가 `root AGENTS → 영역 AGENTS → current-state 문서 → 코드` 읽기 순서를 명시하고, 구 순서(`chats` 선행)를 **더 이상 지시하지 않는다** | `app/scripts/check-doc-inventory.test.mjs::"루트 AGENTS 읽기 정책이 신 순서를 명시한다"` | 모든 신규 에이전트 세션의 첫 문서 |
| 7 | `app/src/renderer/AGENTS.md` 가 존재하고 **4-layer 의존 방향**과 **`group/<이름>` 스코프 격리 규칙**을 담는다 | `app/scripts/check-doc-inventory.test.mjs::"renderer AGENTS 가 두 invariant 를 담는다"` | renderer 파일 편집 시 자동 로드 |
| 8 | `docs/decisions/` 에 ADR 5건이 있고, 각 문서가 **문제·선택지·선택·포기한 것·생긴 invariant** 5개 절을 모두 갖는다 | `app/scripts/check-doc-inventory.test.mjs::"ADR 5건이 5개 필수 절을 갖는다"` | `docs/INDEX.md` → `decisions/` · arch 문서의 `Decision rationale:` 링크 |
| 9 | `docs/arch/**` 의 핸드오프 번호 총계가 **502 → 150 이하**로 줄고, `arch/backend/overview.md`·`security.md`·`providers.md` 세 파일의 헤더에서 델타 누적 문장이 제거된다 | `app/scripts/check-doc-inventory.test.mjs::"arch 핸드오프 번호가 임계 이하다"` | 에이전트가 여는 arch 문서 |
| 10 | `docs/handoff/INDEX.md` 가 **미완료 행만** 갖는다 — §자료조사 3 의 `verify/PASS` 계열 158행 + `SUPERSEDED` 1행이 `docs/archive/handoffs/` 로 이동하고, 잔여 행이 25행 이하다 | `app/scripts/check-doc-inventory.test.mjs::"INDEX 에 완료 행이 남아 있지 않다"` | 두 에이전트가 착수 전 반드시 읽는 보드 |
| 11 | §자료조사 7 의 **12개 인용처 전부**가 이동 후 경로를 가리키고, `docs/**`·루트·`app/**`·`.agents/**` 의 상대 링크 파손이 **0건**이다 | `app/scripts/check-doc-inventory.test.mjs::"마크다운 상대 링크가 전부 해석된다"` | 에이전트가 문서 간 이동할 때마다 |
| 12 | `docs/handoff/AGENTS.md` §3 의 PASS 절차가 **PHASES 승격 대신** INDEX 종료 + git log 를 지시한다 (뒤집는 결정의 반영) | `app/scripts/check-doc-inventory.test.mjs::"PASS 절차가 PHASES 승격을 지시하지 않는다"` | verify 턴마다 Claude 가 읽는 절차 정본 |
| 13 | `docs/spec/` 의 `AGENTS.md` 가 **1개**로 줄고(3단 타워 해소), 삭제한 `AGENTS.md` 마다 짝 `CLAUDE.md` stub 도 함께 삭제된다 | `app/scripts/check-doc-inventory.test.mjs::"spec AGENTS 는 1개이며 고아 stub 이 없다"` | `docs/spec/` 편집 시 로드 |
| 14 | 게이트 통과: `npm run lint` · `npm run typecheck` · `node --test scripts/check-doc-inventory.test.mjs` 전부 green | `cd app && npm run lint && npm run typecheck && node --test scripts/*.test.mjs` | CI |
| 15 | "renderer 버그 하나 고치기" 시나리오에서 루트 `AGENTS.md` → `app/src/renderer/AGENTS.md` → `arch/frontend/*` → 코드로 도달하며, **PRD·TRD·PHASES·chats 를 거치지 않는다** | **사람 실기 — 실행 경로**: 새 세션에서 루트 `AGENTS.md` 를 열고 지시대로만 따라가 renderer 파일에 도달할 때까지 연 문서 목록을 기록한다. 본 작업이 세 문서를 전부 남겨두므로(비범위 아님) 경로가 막히지 않는다 | 신규 세션 |

**AC 상호 모순 점검** (각 AC 를 다른 AC 와 짝지어 훑음):

- AC4(수치 서술 0건) ↔ AC3(generated 가 수치를 담음): `docs/generated/` 를 AC4 스캔에서 **명시적
  제외**해 충돌을 없앴다. `docs/archive/` 도 제외한다 — 과거 사실로서의 수치는 보존 대상이다.
- AC9(arch 번호 감축) ↔ AC8(ADR 이 0062·0173 등을 인용): ADR 은 `docs/decisions/` 에 있고 AC9 의
  스캔 대상은 `docs/arch/**` 이라 겹치지 않는다. ADR 의 핸드오프 인용은 **출처 표기로 허용**이다.
- AC10(INDEX 완료행 이동) ↔ AC11(링크 0 파손): 이동 대상 158행이 참조하는 `<NNNN-slug>/` 경로는
  **제자리 유지**(비범위)이므로 archive 문서에서의 상대경로만 재작성하면 된다.
- AC12(PASS 절차 변경) ↔ 본 plan 자신: 이 작업의 verify 는 **새 절차**를 따른다 — PHASES 승격을
  하지 않는다. 자기 산출물이 자기 AC 를 위반하지 않는다.
- AC6(구 읽기 순서 제거) ↔ AC15(사람 실기가 chats 를 안 거침): 같은 방향이며 AC6 이 AC15 의 전제다.

## 범위 / 비범위

**범위**: `docs/**`(handoff `<NNNN-slug>/` 원본 제외) · 루트/`app`/`chats`/`project` 의
`AGENTS.md`+`CLAUDE.md` · `app/scripts/check-doc-inventory.{mjs,test.mjs}` ·
`.github/workflows/ci.yml` 스텝 1개 · `.agents/skills/**` 중 PHASES 를 인용하는 4곳.

**비범위**:

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| `docs/handoff/<NNNN-slug>/plan.md`·`verify.md` 원본 재편 | 아니오 — 파일 이동은 언제든 되돌릴 수 있고, 지금 옮길 이득이 없다(에이전트가 상시 읽지 않는다) |
| `.agents/skills/{handoff-plan,handoff-verify}` 절차 자체 | 아니오 — 사용자 결정으로 유지. 스킬 내부의 PHASES *링크*만 이번에 고친다 |
| PRD/TRD 를 archive 로 이전 | 아니오 — 사용자 결정으로 자리 유지. 수치만 정정하므로 나중에 이전해도 비용 동일 |
| `docs/etc/study/**`(864 KB) 재편 | 아니오 — evidence 계층에 정상 소속. `docs/INDEX.md` 에서 분류만 표기 |
| `docs/spec/**` 원문 미러 **내용** | 아니오 — 폐쇄망 대비 미러로 유지(가이드도 허용). AGENTS 타워만 정리 |
| `docs/IPC_CONTRACT.md` → `docs/contracts/ipc.md` 개명 | **아니오 — 지금 안 하는 것이 맞다.** 개명은 링크 파손 위험만 사고 truth model 이득이 0이다(§요구 비판적 검토 ④) |
| `docs/product/roadmap.md` 신설 | 아니오 — Now/Next/Later 는 언제든 신설 가능. 현재 로드맵 수요가 확인되지 않아 빈 문서를 만들지 않는다 |
| `app/src/**` 코드 변경 | — 범위 밖. 신설하는 것은 `app/scripts/` 의 검증 스크립트 1개뿐이다 |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `app/scripts/check-migrations-appendonly.mjs`(패턴 원본) ·
  `.github/workflows/ci.yml`(게이트 배치) · `node:test`+`node:assert`(기존 `*.test.mjs` 가 쓰는 러너).
- 전제: 신설 스크립트는 **순수 Node** 로 작성한다 — electron·better-sqlite3·vitest 에 의존하지
  않으므로 §자료조사 6 의 ABI 마찰을 받지 않는다. 이것이 `npm test` 없이도 게이트가 도는 이유다.
- **신규 의존성: 없음.** `node:fs`/`node:path`/`node:test` 만 사용한다.

## 설계

### 접근

**"코드에서 셀 수 있는 수는 Markdown 이 갖지 않는다"** 를 관례가 아니라 **CI 게이트**로 만든다.
0177 이 같은 규칙을 산문으로 적어 한 파일에서만 지켜진 것이 직접 반례다(§요구 비판적 검토 ②).

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `app/scripts/check-doc-inventory.mjs` | 코드를 세어 `docs/generated/inventory.md` 생성(기본) / 커밋본과 대조(`--check`) / 본문 수치 서술·링크 파손 스캔 | `scripts/`(빌드 외부 도구, `src/` 레이어 밖) | **순수 Node 단위** — fs 접근부를 `countInventory(rootDir)`·`scanProse(rootDir)`·`checkLinks(rootDir)` 3개 순수 함수로 떼고, 테스트는 **임시 디렉토리 fixture** 를 만들어 호출한다. electron·DB 의존 0 |
| `app/scripts/check-doc-inventory.test.mjs` | 위 3함수 + CLI 종료코드 검증 (AC 1~13 의 검증 수단) | `scripts/` | `node --test` (`npm test` 가 자동 편입) |
| `docs/generated/inventory.md` | 7개 수치의 유일한 문서상 표현 | 생성물 | 스크립트가 재생성해 대조 |
| `docs/INDEX.md` | 작업 → 문서 라우팅 표 | 라우팅 | AC5 정규식 |
| `docs/decisions/00{1..5}-*.md` | 구조 결정의 근거 (arch 에서 회수) | 근거 | AC8 절 존재 검사 |
| `app/src/renderer/AGENTS.md` | renderer 작업 계약 | 작업 규칙 | AC7 정규식 |

### 레이어 경계

`app/scripts/` 는 `eslint.config.mjs` 의 lint 대상(`./src` + `./scripts`)이나 `boundaries` 규칙은
`src/main/**`·`src/shared/**` 블록에만 걸린다 — 신설 스크립트는 boundaries 대상이 아니고
**어떤 `src/` 모듈도 import 하지 않는다**(문자열 파싱만). 따라서 레이어 DAG 에 영향 0.

### 수치 치환 형식

본문에서 수치를 지우고 아래 형태로 통일한다 — 가이드 §숫자와 inventory 정책의 권장형이다.

```md
정본: `app/src/shared/ipc.ts` (수치는 [`docs/generated/inventory.md`](…))
```

`IPC_CONTRACT.md §2`/`§3` 은 **채널·variant 의 계약 서술 자체가 본문**이므로 표를 유지한다.
헤더의 총계 문장과 §1 "카운트 정정" 주석만 generated 링크로 대체한다 — 이 문서는 사본이 아니라
계약 카탈로그다.

## 기존 결정·규칙과의 관계

> 본문(§설계·§범위·§파생)을 다 쓴 뒤 훑으며 채웠다.

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **verify PASS → `docs/PHASES.md` 표 행 승격** | `docs/handoff/AGENTS.md` §3 "**PASS**: … `docs/PHASES.md` 표 행 승격(PR#/커밋)" | AC12 · §범위 "PHASES 를 archive 로" | **뒤집음.** 근거: PHASES 와 INDEX 가 같은 완료 이력을 2중 기록하고 둘 다 "정본은 `git log`" 를 선언한다(§자료조사 3). 승격 대상이 사라지므로 절차를 *INDEX 행 종료 + git log* 로 바꾼다 |
| **Claude=`docs/handoff/**`+`docs/PHASES.md` / Codex=`app/**` 파일 도메인 분리** | `docs/handoff/AGENTS.md` §충돌 최소화 | §범위가 `app/scripts/` 를 범위에 넣음 | **유지.** 이 작업은 비기능(리팩토링)이라 `docs/handoff/AGENTS.md` 의 *"리팩토링·버그수정은 Claude 가 직접 구현"* 규칙이 적용된다 — 도메인 분리는 Codex 병행 시의 충돌 회피책이고 여기선 단독 수행이다 |
| **머지된 마이그레이션 수정 금지 (CI 기계 강제)** | `app/scripts/check-migrations-appendonly.mjs` · `ci.yml:49` | §설계 "선례 그대로 재사용" | **유지 + 확장.** 같은 패턴으로 문서 인벤토리 가드를 추가한다. 기존 스크립트는 건드리지 않는다 |
| **`AGENTS.md` 정본 + `@AGENTS.md` stub `CLAUDE.md`** | 루트 `AGENTS.md` §AGENTS.md/CLAUDE.md 규약 | AC13 · Phase 5 | **유지.** 신설(renderer)·삭제(spec 2건)마다 stub 을 동반 처리한다 |
| **`AGENTS.md` 위생 규칙 — 변동성 이력은 PHASES, 라이브 상태는 INDEX 로 분리** | 루트 `AGENTS.md` §AGENTS.md/CLAUDE.md 규약 | Phase 4 가 PHASES 를 archive 로 | **부분 뒤집음.** "변동성 이력을 AGENTS 밖에 둔다" 는 원칙은 유지하되, 목적지가 `PHASES.md` → `docs/archive/` + `git log` 로 바뀐다. 루트 규약 문장을 함께 고친다 |
| **`docs/spec/` 원문 미러 편집 금지·덮어쓰기로만 갱신** | `docs/spec/AGENTS.md` §동기화 정책 | AC13(타워 해소) | **유지.** 정책 문장은 살리고 *AGENTS 파일 개수*만 3→1 로 줄인다. 미러 내용은 §비범위 |
| **`etc/study/orca/` 는 폐기 — 근거로 인용 금지** | `docs/AGENTS.md:32` (사용자 지시 2026-08-10) | Phase 2 가 `docs/AGENTS.md` 인벤토리를 INDEX 로 이동 | **유지 — 이동 시 보존 필수.** 이 경고는 인벤토리가 아니라 **금지 규칙**이다. `docs/INDEX.md` 로 옮길 때 경고 문구를 반드시 옮긴다(누락 시 폐기된 자료가 되살아난다) |
| **`boundaries` 레이어 DAG** | `app/eslint.config.mjs` (`src/main/**`·`src/shared/**` 블록) | §설계 §레이어 경계 | **유지.** 신설 스크립트는 `scripts/` 소속이고 `src/` 를 import 하지 않는다 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

> UI 작업이 아니므로 "UX" 는 **에이전트의 문서 사용 경험**으로 읽는다.

- **생성물 drift**: 사람이 `docs/generated/inventory.md` 를 손으로 고치면? → 파일 상단에
  `<!-- 생성물 — 직접 편집 금지 -->` 헤더를 넣고, `--check` 가 재생성 결과와 **바이트 대조**하므로
  손편집은 CI 에서 즉시 실패한다.
- **스캔 오탐**: AC4 의 정규식이 `docs/archive/`·`docs/generated/`·`docs/handoff/<NNNN>/` 의
  정당한 과거 수치를 잡으면 게이트가 문서를 손상시킨다(0177 이 `P30` 으로 기록한 실패 패턴 —
  *"음성 grep 게이트가 이력을 배제 안 하면 게이트 통과가 문서를 손상시킨다"*). → **제외 경로를
  스크립트 상수로 명시**하고 그 제외 자체를 테스트한다.
- **INDEX 이동 후 되돌아오는 작업**: archive 로 내린 완료 행의 핸드오프가 재개되면? → INDEX 는
  `max(번호)+1` 규칙을 쓰므로 번호 충돌이 없고, archive 에서 해당 행을 INDEX 로 되돌리면 된다.
  archive 문서 상단에 이 절차를 한 줄로 적는다.
- **부분 적용 상태**: Phase 1 만 적용하고 멈춰도 저장소가 정합해야 한다 → 각 Phase 를 **독립
  커밋**으로 나누고, 매 커밋에서 게이트가 green 이도록 한다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **AC4 스캔의 오탐이 정당한 문서를 손상**(0177 P30 재현) | 제외 경로를 상수화하고 *제외가 작동하는지*를 테스트로 고정(AC4 케이스에 archive 픽스처 포함). 스캔은 **수치+단위 동반 패턴**만 잡고 맨숫자는 잡지 않는다 |
| **158행 이동 중 링크 파손**(0177 이 22건을 실제로 겪음) | AC11 을 링크 해석 전수 검사로 걸고, 스크립트가 이를 기계 판정한다. Phase 4·5 후 필수 실행 |
| ADR 5건의 *내용*이 실제 결정 의도와 다를 수 있다 | ADR 은 arch 본문·`git log`·기존 plan 에서 **인용해 구성**하고 창작하지 않는다. 최종 확인은 **사람 몫**으로 verify 에 명시 |
| PHASES archive 이후 "무엇이 언제 들어왔나" 조회가 느려진다 | 완료 이력은 `git log --grep` + `docs/archive/` 로 여전히 조회 가능. 두 문서가 스스로 "정본은 git log" 라 선언한 것을 실제 구조로 만드는 것뿐이다 |
| 가이드를 100% 따르지 않는다(§요구 비판적 검토 ④의 3건) | 각 미채택 항목의 근거를 plan 에 명시했다. 가이드 §완료 상태의 10개 항목 중 미채택으로 미달하는 것은 없다 |

- **되돌리기 어려운 결정**: `docs/PHASES.md` 경로 이동(git mv 로 이력 보존, 되돌리기 가능) ·
  `docs/handoff/AGENTS.md` PASS 절차 변경(향후 모든 verify 턴에 영향 — 그래서 §기존 결정 표에
  명시적으로 올렸다).
- **단독 결정 금지 항목(Open Question)**: 없음 — 일방향 결정 2건은 착수 전 사용자 답변을 받았다.

## 영향 받는 파일

- **신설**: `app/scripts/check-doc-inventory.mjs` · `app/scripts/check-doc-inventory.test.mjs` ·
  `docs/generated/inventory.md` · `docs/INDEX.md` · `docs/decisions/00{1..5}-*.md` ·
  `docs/archive/` (PHASES + handoffs) · `app/src/renderer/{AGENTS.md,CLAUDE.md}`
- **수정**: `AGENTS.md` · `app/AGENTS.md` · `app/src/main/AGENTS.md` · `docs/AGENTS.md` ·
  `docs/ARCHITECTURE.md` · `docs/PRD.md` · `docs/TRD.md` · `docs/GLOSSARY.md` ·
  `docs/IPC_CONTRACT.md` · `docs/arch/**`(17) · `docs/guides/AGENTS.md` · `docs/spec/AGENTS.md` ·
  `docs/handoff/{AGENTS.md,INDEX.md}` · `chats/AGENTS.md` · `.github/workflows/ci.yml` ·
  `.agents/skills/**`(4)
- **삭제**: `docs/spec/claude/{AGENTS.md,CLAUDE.md}` · `docs/spec/claude/agent-sdk/{AGENTS.md,CLAUDE.md}`
- **이동**: `docs/PHASES.md` → `docs/archive/PHASES.md`

## 참고 문서

- 첨부 가이드 *Orca-skin Agent-Driven Documentation Refactoring Guide* (§핵심 원칙 · §Truth Model ·
  §숫자와 inventory 정책 · §Scoped AGENTS 기준 · §완료 상태)
- `docs/handoff/AGENTS.md` (협업 규칙·상태 머신 — AC12 가 이 문서를 고친다)
- `docs/git-template.md` (커밋 trailer)
- `app/AGENTS.md` §better-sqlite3 ABI (게이트 선택 근거)
- IPC 변경 없음 → `docs/IPC_CONTRACT.md` §6 변경 절차 **해당 없음** (본 작업은 채널을 건드리지
  않고 헤더 서술만 고친다)

## 게이트

```bash
cd app && npm run lint && npm run typecheck
node --test scripts/check-doc-inventory.test.mjs
node scripts/check-doc-inventory.mjs --check
```

`npm test` 는 better-sqlite3 ABI 를 Node 로 뒤집으므로(§자료조사 6) 문서 루프의 기본 게이트에서
제외하고, 신설 스크립트 테스트만 `node --test` 로 직접 실행한다. 신설 테스트는 `npm test` 의
`node --test "scripts/*.test.mjs"` 에 자동 편입되므로 CI 에서는 함께 돈다.

신규 테스트 요구: `check-doc-inventory.test.mjs` — 순수 카운터 · 프로즈 스캐너 · 링크 체커 ·
CLI 종료코드 · **제외 경로가 작동하는지**(P30 방어).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 추론 3건을 *(추론)* 으로 표기했다.
- [x] 자료조사 — 모든 발견에 측정 명령 또는 `파일:라인` 을 붙였다.
- [x] 의존 기술 — 신규 의존성 0건임을 확인했다(`node:` 내장만).
- [x] 파생 UX — 생성물 손편집·스캔 오탐·부분 적용 등 이 작업에 실제로 해당하는 것만 적었다.
- [x] 리스크 — 0177 의 P30·링크 파손 22건을 구체 리스크로 올리고 완화책을 AC 에 연결했다.

**기계적으로 확인 가능한 것**:

- [x] 요구 비판적 검토 5개 질문에 답했다. 이견("이미 두 번 했다")을 적었지만 **범위를 줄이지
      않았다** — 오히려 기계 강제를 더했다. 가이드 미채택 3건은 근거와 함께 명시했다.
- [x] `검증 수단` 칸이 비어 있지 않다. AC15 만 "사람 실기" 이며 **실행 경로**(무엇을 열고 무엇을
      기록하는가)를 적었고, 그 경로가 비범위에 막히지 않음을 확인했다(PRD/TRD/PHASES 를 전부 남긴다).
- [x] 부정형/"불변" 기준 **0개**. AC4·AC10·AC12·AC13 은 "0건이다"/"이하다" 형태의 **측정 가능한
      양성 단언**으로 썼고, AC2 는 재발 방지가 *작동함*을 양성으로 단언한다(실패를 유도해 확인).
- [x] AC 상호 모순 점검을 5쌍에 대해 수행했다(§인수 기준 하단). 자기 산출물이 자기 AC 를
      위반하지 않음(AC12 ↔ 본 작업의 verify)까지 확인했다.
- [x] 인용 수치를 **이번 세션에서 직접 측정**했다(승계 0건). IPC 채널은 **내역 합 76 = 총계 76**
      으로 검산했다.
- [x] 신규 모듈 4종에 테스트 방법이 있고, fs 의존부를 3개 순수 함수로 떼는 seam 을 설계에 넣었다.
- [x] 전수 조사에 N 수치가 있다 — arch 번호 **502**, INDEX 데이터 행 **184**(완료 158/미완료 25/
      superseded 1), PHASES·INDEX 인용처 **12**, AGENTS **11개/965줄**, arch 파일 **17**.
- [x] 각 AC 에 프로덕션 도달 경로가 있다. **유일한 호출자가 테스트인 AC 는 0개** — AC1~13 은
      전부 CI 스텝 또는 에이전트 읽기 경로에 닿는다.
- [x] 선택적 필드 판정 없음 → 미지정 케이스 AC **해당 없음**(N/A).
- [x] 소비하는 계약의 제약 필드 = AC4·AC11 의 **제외 경로 상수**. 강제 지점은
      `check-doc-inventory.mjs` 이며 CI 스텝이 언제 검사하는지 명시했다.
- [x] 참조 구현 = `check-migrations-appendonly.mjs`. 커버리지 대조: 그 스크립트는 *파일 수정
      여부* 한 종류만 보지만, 본 작업은 **카운트·프로즈·링크 3종**을 봐야 한다 — 패턴(CLI +
      `*.test.mjs` + CI 스텝)만 승계하고 검사 로직은 새로 쓴다고 §설계에 명시했다.
- [x] 미룬 항목 8건 전부에 일방향 여부를 답했다(§범위 표). 일방향인 것은 0건이라 사용자에게
      추가로 물을 항목이 없다.
- [x] 관문 4 를 본문 완성 후 돌렸다 — §기존 결정 표를 본문 훑으며 채웠고(8행, 각 행에 "본문에서
      건드리는 문장" 명시), 인용 경로를 `Read`/`ls` 로 열어 확인했으며, `[구현자 기입]`·
      `[검증자 기입]` 블록이 아래에 있다.
- [x] "확정돼 있다"/"채택 결정이다" 로 쓴 것마다 앵커를 grep 했다 — `docs/handoff/AGENTS.md` §3
      의 PHASES 승격 문장, 루트 `AGENTS.md` 의 AGENTS/CLAUDE 규약, `docs/AGENTS.md:32` 의
      `etc/study/orca/` 폐기 경고, `docs/spec/AGENTS.md` 의 편집 금지 정책 — **4건 전부 실재 확인**.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 본 작업은 비기능(리팩토링)이므로 Claude 가 직접 구현한다.

## [구현자 기입] 설계 리뷰 (비판적)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|

## [구현자 기입] 구현 체크리스트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | |
| 실행 명령 | |
| 게이트 결과 | |
| 블로커 / 역질문 | |
| 대상 커밋 | |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
