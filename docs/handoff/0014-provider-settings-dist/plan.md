# Plan — 0014-provider-settings-dist

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(구조 리팩토링) 작업 — **Claude 직접 구현** 규약 적용.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0014-provider-settings-dist` |
| 작성자 | Claude Code |
| 일자 | 2026-06-12 |
| 매핑 | PHASES "provider settings dist 재구조화" 행 |
| 상태 | READY (Claude 직접 구현) |

## Context (왜)

claude-code 세션이 사용자 `~/.claude/settings.json` 에 암묵 의존하고(0005 결정), provider(anthropic/bedrock/vertex) 설정이 orca.json `agents[]` + `toClaudeEnv` 매핑 코드에 흩어져 있었다. 조사 결과:

1. **provider 별 settings.json — 가능.** 단 플러그인 스펙에는 settings.json 이 없다(skills/agents/commands/hooks/.mcp.json 만). 주입 채널은 `query()` `Options.settings`(flag 레이어, `--settings` 동등).
2. **`resolveSettings()` — SDK 에 존재 (@alpha).** "settingSources 를 만드는" 함수가 아니라 소스를 읽어 병합 결과를 돌려주는 함수(`{effective, provenance, sources}`). `settingSources` 자체는 user/project/local 고정 경로다. `resolveSettings({cwd: <dir>, settingSources:['project']})` 가 `<dir>/.claude/settings.json` 을 CLI 동일 머지 엔진으로 로드 → effective 를 `query({settings, settingSources: []})` 로 주입하면 격리모드 + provider 별 설정이 성립.

**사용자 결정 (binding)**: ① settings SSOT 는 `sources/` 사용자 편집 파일, ② dist 는 공유 플러그인 1개 + provider 디렉토리에는 settings 만, ③ `settingSources: []` 격리모드 + resolveSettings 경유 주입, ④ orca.json `agents` 필드 제거(앱 자체 env 만), ⑤ meta.json 은 어댑터당 1개(`sources/settings/<adapter>/meta.json`), ⑥ opencode 의 상이한 스키마를 수용하는 어댑터-일반화(로더 주입 seam).

## 인수 기준 (Acceptance Criteria)

1. `sources/settings/<adapter>/<provider>/settings.json`(어댑터-네이티브) + 어댑터당 1개 `meta.json` 레이아웃이 SSOT 이고, 열거 SSOT 는 디렉토리 목록이다(meta 드리프트 관용).
2. ExtensionDeployer 가 plugin 산출물을 `dist/<engine>/plugin/` 으로, provider settings 를 `dist/<engine>/<provider>/.claude/settings.json` 으로 렌더한다(meta.json 미배포, settings JSON/이름 검증은 provider 단위 격리).
3. 최초 부팅 시 `anthropic/settings.json` + `meta.json` 스캐폴드(멱등, 기존 파일 불가침).
4. 턴/completion 의 query() 가 `settingSources: []`(격리모드) + `options.settings`(flag 레이어)로 실행된다 — blob 부재여도 격리모드 유지.
5. provider settings 해석은 SDK `resolveSettings({cwd: distProviderDir, settingSources:['project']})` + `filterEscalatingDefaultMode` 경유, 함수 부재/dist 미배포 시 flat JSON 폴백 1경로.
6. 해석 시 env 값 `${VAR}` 확장(미해결 키만 드롭) + secret-store `provider:${providerKey}` 토큰의 `env.ANTHROPIC_API_KEY` 주입 — dist/디스크에는 평문 0.
7. 해석 결과는 `ProviderSettingsService` 가 mtime 캐시하고 deploy 후 `invalidateAll()` 된다.
8. orca.json 스키마가 `{version, env?}` 로 축소되고 구 `agents` 키는 경고 후 무시(클린 브레이크), 앱 env 는 subprocess env 베이스로 병합된다.
9. `toClaudeEnv`(provider→`CLAUDE_CODE_USE_*` 매핑) 삭제 — 사용자가 네이티브 settings.json env 로 작성(TRD §6.8 레시피 표).
10. 어댑터 경계가 `req.agent: OrcaAgentConfig` → `req.providerKey`/`req.providerSettings`(불투명 blob)로 바뀌고, 어댑터-종속 해석은 주입 로더(`ProviderSettingsLoader`)에 격리된다(opencode seam).
11. `orca:agent:list` 원천이 settings 트리 스캔으로 바뀌되 페이로드 shape(AgentEnvironment)는 0010 과 동일 — renderer 변경 0.
12. 턴 해석 폴백(payload providerKey → 세션 provider_key → 기본 provider)과 adapter 불일치 보호선(0010)이 유지된다.
13. 게이트 통과(lint/typecheck/test) + 신규 순수 함수 테스트(deployer settings 축·scaffold·provider-settings·claude-settings 로더·parseProviderKey) 동반.
14. 문서 갱신: TRD §6.8/§6.8.1, standardization.md §5.1/§5.2, adapters.md §1.3/§2.1, security.md(평문 예외 이전), PHASES, INDEX.

## 범위 / 비범위

- **범위**: 위 14 항목. main 프로세스 + 문서.
- **비범위**: renderer 변경(페이로드 shape 보존으로 0 목표), opencode 로더 구현, settings 편집 UI, `meta.json settingSources` escape hatch(OAuth 격리 실패 시 후속 — 기록만).

## 설계 (요약)

- 런타임 흐름: `send.ts` 가 `ProviderSettingsService.list/resolve` 로 entry+blob 해석 → `TurnRequest.providerSettings` → `adaptSettings(blob)` = `{settings, settingSources: []}` 조각 → query. completion 경로 대칭. **0005 의 "settingSources 미지정" 결정은 본 작업이 명시 폐기.**
- 재사용: `mcp/expand.ts` 의 `expandVars`/Resolver(secret→process.env), `ensureOrcaFile` 의 atomic write·3단 관용 파싱 패턴, deployer 의 backup-then-write.
- 신규: `settings/provider-settings.ts`(어댑터-중립 서비스), `adapters/claude-settings.ts`(SDK 어휘 격리 로더), `deploy/scaffold.ts`.
- 삭제: `adapters/claude-env.ts`(+test), `config/provider-key.ts` 의 agents 계열 헬퍼(`agentForProviderKey`/`dedupeAgents`/`authTokenFor`/`toAgentEnvironments` — 후자는 provider-settings 로 이동), orca-file 의 agents 스키마.

## 영향 받는 파일

신규: `app/src/main/settings/provider-settings.ts`(+test) · `app/src/main/adapters/claude-settings.ts`(+test) · `app/src/main/deploy/scaffold.ts`(+test)
변경: `config/paths.ts` · `deploy/deployer.ts`(+test) · `deploy/conformance.ts` · `adapters/claude-adapt.ts`(+test) · `adapters/claude-code.ts` · `adapters/types.ts` · `extensions/types.ts` · `config/orca-file.ts`(+test) · `config/orca-config.ts` · `config/provider-key.ts`(+test) · `ipc/context.ts` · `ipc/chat/send.ts` · `ipc/chat/turn-registry.ts` · `ipc/chat/title-generation.ts` · `ipc/handlers/misc.ts` · `ipc/router.ts`
삭제: `adapters/claude-env.ts`(+test)

## 참고 문서

- `docs/TRD.md §6.8/§6.8.1` (본 작업으로 개정)
- `docs/arch/backend/standardization.md §5.1/§5.2` · `adapters.md §1.3` · `security.md §1.4`
- SDK: `docs/spec/claude/agent-sdk/typescript.md` (`resolveSettings`/`Options.settings`/`settingSources`)
- IPC 변경 없음(채널 36 유지, agentList 페이로드 shape 불변)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.
- 신규 테스트: deployer settings 축 / scaffold / provider-settings(열거·meta 관용·캐시·로더 위임) / claude-settings(flat 폴백·escalating 필터·${VAR}·secret 주입·SDK 경로) / parseProviderKey / orca-file 신 스키마 / adaptSettings.

## 위험

| 위험 | 완화 |
|---|---|
| resolveSettings @alpha 시그니처 변동 (패키지 `latest`) | `claude-settings.ts` 1모듈 격리 + flat-read 폴백 |
| 격리모드 회귀 — 기존 `~/.claude/settings.json` env/권한 미적용 (0005 번복) | TRD §6.8 명시 + anthropic 템플릿 + verify 사람 확인 대기 |
| OAuth 자격증명의 격리모드 동작 미검증 | verify 실기 1순위. 불가 시 meta.json `settingSources` escape hatch (스코프 밖, 기록만) |
| settings.json escalating defaultMode | `filterEscalatingDefaultMode`/수동 필터로 무력화 — 의도된 동작(TRD §6.8) |

---

## [Claude 기입] 구현 보고

- [x] 인수 기준 1~12, 14 구현 (커밋 참조)
- [x] 게이트: lint ✅ · typecheck ✅ · test 372/372 ✅ · electron-vite build ✅ (better-sqlite3 는 로컬 Node ABI 재빌드 후 — 0010 r2 와 동일 환경 조치)
- [x] 신규 테스트 28건 추가 (344 → 372)
- 블로커 없음. 사람 확인 대기 항목은 verify.md 참조.
