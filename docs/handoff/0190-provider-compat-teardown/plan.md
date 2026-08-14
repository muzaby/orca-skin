# Plan — 0190 호환층 제거와 정본 갱신 (경량화 Phase C) · **DRAFT stub**

> ⚠️ **아직 설계되지 않았다.** 이 문서는 [`0188`](../0188-providers-slice-split/plan.md) ·
> [`0189`](../0189-auth-runtime-inversion/plan.md) 가 명시적으로 이월한 항목을 보존하는 stub 이다.
> Phase B 구현이 끝난 뒤 `handoff-plan` 으로 본문을 작성하고 상태를 `READY` 로 올린다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0190-provider-compat-teardown` |
| 작성자 | Claude Code |
| 일자 | 2026-08-14 (stub) |
| 매핑 | 「인증·Harness·Plugin 경량화 리팩터링 제안」 **Phase C** |
| 선행 | `0189-auth-runtime-inversion` (Phase B) |
| 구현 주체 | Claude (비기능 리팩터링) |
| 상태 | **DRAFT** |

## 범위 (제안서 Phase C)

- domain 의 `Provider` · `Provider.llm` · `Provider.tools` · `ProviderPlatform` 소비를 제거한다.
- 신규 코드에서 확정 용어(Harness · Model · ModelProvider · Auth · Plugin)와 어긋나는 레거시
  어휘·제품명 prefix 를 제거한다.
- **문서 정본 갱신** — 아래 이월 항목 C-1.
- DB schema 를 바꾸지 않고 기존 `provider_key` 값을 읽는 boundary 를 유지한다.

## 이월 항목

| # | 항목 | 근거 |
|---|---|---|
| C-1 | **ADR-006 신설 — ADR-004 를 부분 supersede.** 폐기: `kind` 1급 축 · "배포가 고치는 파일은 `declarations/` 뿐". 명시 승계: `Provider.id`(=`AuthId`) 유지 · vault 키 형식 `provider:<id>:<authKind>` · 게이트 선언 0 → 통과 · 미인증 `null`/드롭 · 런타임 동적 로딩 금지 | 0188 D-003 (사용자 승인) |
| C-2 | **GLOSSARY 갱신** — §1 `Provider`/`Provider kind`/`ProviderApi` 표제어, §2 `Engine` → `Harness`, §3 `Provider` 금지어 예외 조항. `ModelProvider` 를 §3 의 "LLM Provider 금지어" 와 명시적으로 가른다 | 0188 D-003 · `docs/GLOSSARY.md` |
| C-3 | **`docs/arch/backend/providers.md` 재작성** (620줄, 현재 구조 정본) + `overview.md` · `runtime-ipc.md` · `security.md` · `arch/frontend/{layers,overview}.md` 라우팅 | 0188 §18 |
| C-4 | **`docs/guides/closed-network-extensions.md` 갱신** — 0188 은 §1.1·§1.2 경로만 고쳤다. 레시피 A~E 의 구조 서술 전체는 여기 | 0188 §15 |
| C-5 | `docs/INDEX.md` 라우팅 · root `AGENTS.md` 디렉토리 표 · `app/src/main/AGENTS.md` 슬라이스 서술 | — |
| C-6 | **`app/provider-compat/llm-join.ts` 삭제** (`Provider.llm` 제거와 동시) | 0188 §11 ② |
| C-7 | **Usage `providerKeys` 정본 전환 완료 확인** — 0189 가 하지 않았다면 여기서 | 0188 D-005 · 0189 B-8 |
| C-8 | **`app/settings-reactions.ts` 재배선 완료 확인** — `ProviderPlatform` 이 사라졌으므로 `providers.state()` 주입이 교체돼 있어야 한다 | 0188 §11 ③ |
| C-9 | `docs/generated/inventory.md` 최종 재생성 | — |

## 유지 (compatibility boundary — 별도 UI migration 전까지)

- shared `ProviderKind` · `ProviderInfo` · `ProviderPlatformState` · `AgentEnvironment`
- `orca:provider:*` 6채널과 protocol schema
- `src/renderer/src/features/providers/**` (renderer 슬라이스)
- DB `provider_key` · vault key prefix · MCP `${BINDING:<id>}` 참조 id
- 기존 renderer 표시 문구·IPC/DB/config 의 `engine` 문자열

## 진입 조건

- 0189 가 `verify/PASS`.
