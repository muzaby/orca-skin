# Plan — 0030-system-prompt-policy-structure

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0030-system-prompt-policy-structure` |
| 작성자 | Claude Code |
| 일자 | 2026-06-18 |
| 매핑 | 신규 — "시스템 프롬프트 관리 가이드 ver2"(Opus 4.8) 의 Orca 적합성 검토·마이그레이션 |
| 상태 | DRAFT → READY → IMPL_DONE |
| 구현 주체 | **Claude** (비기능 = 리팩토링 + 문서 — 구현 주체 분담 규칙) |

## Context (왜)

Opus 4.8 이 작성한 "시스템 프롬프트 관리 가이드 ver2" 는 `@anthropic-ai/claude-agent-sdk` 일반론은
정확하나 **Orca 의 실제 코드·확정 핸드오프 결정을 모르고 쓰였다**. 그대로 채택하면 확정 결정
(0015/0018/0023/0024/0028)과 충돌하고, 존재하지 않는 디렉토리/기능을 전제한다.

가이드 주장을 Orca 코드(`grep` 확인)와 1:1 대조해 4 버킷으로 분류했다:
- **버킷1(이미 일치)**: preset+append·단일문자열·per-turn resume·`excludeDynamicSections` 생략·출력스타일 미사용.
- **버킷2(충돌→재검토 OQ)**: settingSources local 제외 / settings.env 단일주입 / 옵션 캐싱.
- **버킷3(신규→구축)**: 5장 정책 문자열 관리 구조.
- **버킷4(전제오류→주석)**: per-session cwd / 메모리 스냅샷 / `src/agent/` 경로.

사용자 결정(2026-06-18): 산출물 = **문서 + 코드 리팩토링**, 5장 = **전면 구축**, 버킷2 = **재검토 등재**.

목표: (a) `PY_AGENT_RULES` 단일 상수를 가이드 5장 구조로 이주(현 출력 **바이트 동일**·무회귀),
(b) 교정 가이드 `docs/arch/backend/system-prompt.md` 신설, (c) 버킷2 3건을 §5 Open Questions 로 등재.

## 인수 기준 (Acceptance Criteria)

1. `app/src/main/prompts/` 신설: `policies/python-runtime.md`·`registry.ts`·`loader.ts`·
   `buildAppend.ts`·`platformHints.json`·`platformHints.ts`·`index.ts`. `buildAppend` 가 **단일 문자열** 반환.
2. `python-runtime.md` 본문 == 구 `PY_AGENT_RULES` 트림 결과(바이트 동일). `runtime/env.ts` 상수 +
   `runtime/index.ts` export 제거 (`grep PY_AGENT_RULES app/src` → prompts 모듈/테스트의 이주-출처 표기 외 0건).
3. `loader.ts` 가 `.md?raw` import + registry↔본문 정합 검증(누락/잉여 throw). vitest 통과.
4. `extensions/builder.ts` 생성자가 `stableAppend: string` 수용. 조립 순서·출력 **현행 바이트 동일**
   (지침 있을 때 `instructions\n\n<python-runtime>`).
5. `ipc/router.ts` 가 startup 에서 `loadPolicies()`+`buildAppend({platform})` → `stableAppend` 주입.
   무캐시 불변(DB 지침 매 턴 조회).
6. `buildAppend`/`loader` 순수 단위 테스트(tier 필터·조건부 when·정합 검증·바이트 동일).
7. 교정 가이드 `docs/arch/backend/system-prompt.md` 신설 — 버킷1~4 + **§5 OQ-A/B/C**(분석+권고+게이트).
8. 참조 정정: `docs/AGENTS.md` 인벤토리·`adapters.md §1.4`·`standardization.md §5.4`·`terms.md`·`GLOSSARY.md`.
9. 게이트: `cd app && npm run lint && npm run typecheck && npm test` (레이어 경계 0, 신규 의존성 0).

## 범위 / 비범위

- **범위**: 정책 구조(5장) 코드 구축 + PY_AGENT_RULES 무회귀 이주 + 교정 가이드 + 버킷2 OQ 등재.
- **비범위(사용자 결정 게이트·별도 핸드오프)**: 버킷2 실제 코드 변경(settingSources/env/캐싱) — 현
  확정결정 유지. 조건부 블록(B) 콘텐츠·per-turn ctx 배선. platformHints(C) 라이브 주입. 메모리/날짜
  volatile preamble(6장). per-session cwd.

## 설계

- 신규 L1 domain `app/src/main/prompts/` (catch-all `src/main/*` → 자동 L1, eslint elements 무변경).
  shared 외 의존 0 → 경계 위반 0. 빌더(L1)→prompts(L1) 동일레이어·무순환.
- 본문 번들링은 `db/migrate.ts` 의 `.sql?raw` 패턴 동형(`.md?raw`). vitest 에서도 동작(db 테스트 선례).
- `buildAppend(ctx, loaded, registry=POLICY_REGISTRY)`: registry 인자는 조건부 필터 단위 테스트 seam.
- `assemblePolicies(registry, sources)`: loader 순수 코어(정합 검증) — 누락/잉여 throw 단위 테스트.
- 빌더 조립 순서 현행 보존(`지침\n\n정책`) — 가이드 7장 STABLE-first 는 `excludeDynamicSections:false`
  로 cross-대화 캐시가 이미 깨져 append 내부 순서가 무의미. 무회귀 우선 (system-prompt.md §3 근거).
- 재사용: `runtime/env.ts`(buildPyEnv 유지) · `extensions/builder.ts`(생성자 시그니처만 변경) ·
  `ipc/router.ts`(startup 배선).

## 영향 받는 파일

- 신규: `app/src/main/prompts/**`, `docs/arch/backend/system-prompt.md`, 본 핸드오프 디렉토리.
- 수정: `app/src/main/runtime/{env,index}.ts`·`extensions/{builder,types}.ts`·`ipc/router.ts`·
  `ipc/chat/send.ts`(주석)·`adapters/claude-adapt.ts`(주석)·`docs/AGENTS.md`·
  `docs/arch/backend/{adapters,standardization,terms}.md`·`docs/GLOSSARY.md`·`docs/handoff/INDEX.md`.
- IPC 채널 무변경 → `IPC_CONTRACT.md` 무변경.

## 참고 문서

- `docs/arch/backend/system-prompt.md`(신설 정본) · `adapters.md §1.4` · `standardization.md §5.4`
- handoff `0023`·`0024`·`0028`(settingSources/env override 확정 — 버킷2 근거)
- `app/src/main/AGENTS.md`(L1 분류·무순환) · `app/src/main/db/migrate.ts`(`.sql?raw` 동형)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `prompts/buildAppend.test.ts`·`prompts/loader.test.ts`(순수 — electron 비의존).
- 무회귀: `PY_AGENT_RULES` 이주 바이트 동일(loader.test 가 잠금).

---

## [Claude 기입] 구현 체크리스트

- [x] `prompts/` 신설(policies/python-runtime.md·registry·loader·buildAppend·platformHints·index)
- [x] PY_AGENT_RULES → python-runtime.md 바이트 동일 이주 + `runtime/env.ts` 상수·배럴 export 제거
- [x] `extensions/builder.ts`·`ipc/router.ts` 통합(stableAppend, 무캐시·무회귀) + 낡은 주석 정정
- [x] `buildAppend`/`loader` 단위 테스트(9 케이스)
- [x] 교정 가이드 `system-prompt.md` + §5 OQ-A/B/C + 참조 정정 5문서
- [x] 게이트 통과(lint/typecheck/typecheck:test/test)

## [Claude 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/prompts/**`(8) · `runtime/{env,index}.ts` · `extensions/{builder,types}.ts` · `ipc/router.ts` · `ipc/chat/send.ts` · `adapters/claude-adapt.ts` · 문서 6 · 핸드오프 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test`(better-sqlite3 Node ABI 재빌드 후) |
| 게이트 결과 | lint ✅ / typecheck(node+web+test) ✅ / test ✅ **406/406** (신규 prompts 9 포함) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (본 커밋) |
