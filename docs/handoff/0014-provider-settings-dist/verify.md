# Verify — 0014-provider-settings-dist

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능 작업 — Claude 설계+구현+검증 단독 수행(0001/0005/0011~0013 전례).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0014-provider-settings-dist` |
| 검증자 | Claude Code |
| 일자 | 2026-06-12 |
| 대상 커밋 | `9585cb7` |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | sources/settings 레이아웃 + 디렉토리 열거 SSOT + meta 관용 | ✅ | `settings/provider-settings.ts` `listProviders`/`readMeta`; `provider-settings.test.ts` "디렉토리가 열거 SSOT"/"디렉토리 없는 meta 키" |
| 2 | dist plugin/ 분리 + `<provider>/.claude/settings.json` 복사 + provider 단위 검증 격리 | ✅ | `deploy/deployer.ts` `scanProviderSettings`/렌더 본문; `deployer.test.ts` 신규 4케이스 |
| 3 | 최초 부팅 스캐폴드(멱등·불가침) | ✅ | `deploy/scaffold.ts`; `scaffold.test.ts` 4케이스 |
| 4 | 격리모드 + flag settings 주입 (양 경로 대칭, blob 부재에도 격리) | ✅ | `adapters/claude-adapt.ts` `adaptSettings`; `claude-code.ts` sendMessage/runCompletion 양쪽 `...adaptSettings(req.providerSettings)`; `claude-adapt.test.ts` adaptSettings 3케이스 |
| 5 | resolveSettings(@alpha) 경유 + filterEscalatingDefaultMode + flat 폴백 | ✅ | `adapters/claude-settings.ts`; `claude-settings.test.ts` SDK 경로 2 + flat 폴백 6케이스 |
| 6 | env ${VAR} 확장(키 단위 드롭) + secret 토큰 주입 + 디스크 평문 0 | ✅ | `claude-settings.ts` env 후처리(원본 env 치환); deployer 는 미확장 복사만. 테스트 "${VAR} 확장"/"secret-store 토큰"/"전부 드롭" |
| 7 | mtime 캐시 + deploy 후 invalidateAll | ✅ | `ProviderSettingsService.resolve`/`invalidateAll`; `router.ts` deploy 직후 호출; 캐시 테스트 1케이스 |
| 8 | orca.json `{version, env?}` 축소 + agents 경고 무시 + 앱 env 베이스 병합 | ✅ | `config/orca-file.ts`/`orca-config.ts` `appEnv`; `ipc/chat/send.ts` `buildTurnEnv`+`mergeEnvLayers`; `orca-file.test.ts` 재작성 |
| 9 | `toClaudeEnv` 삭제 + TRD 레시피 표 | ✅ | `adapters/claude-env.ts` 삭제; TRD §6.8 "provider env 레시피" 표 |
| 10 | 어댑터 경계 `providerSettings` blob + 로더 주입 seam | ✅ | `extensions/types.ts`/`adapters/types.ts`; `ProviderSettingsLoader` 주입(`router.ts` 컴포지션) — opencode 는 로더 미등록 시 settings 없이 동작 |
| 11 | agent:list 원천 교체 + 페이로드 shape 0010 동일 | ✅ | `ipc/handlers/misc.ts`; `toAgentEnvironments` 테스트(shape/비밀 미노출); renderer 변경 0 (`git diff --stat` — renderer 파일 0건) |
| 12 | 턴 해석 폴백 + adapter 불일치 보호선 유지 | ✅ | `ipc/chat/send.ts` `resolveTurnProvider` (payload→세션→defaultProvider) |
| 13 | 게이트 + 신규 테스트 동반 | ✅ | 아래 게이트 재실행 — 372/372 (구 344 → +28) |
| 14 | 문서 6건 갱신 | ✅ | TRD §6.8/§6.8.1 · standardization §5.1/§5.2 · adapters §1.3/§2.1 · security §1.4/0010절 · PHASES · INDEX |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 PASS |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 14/14 |
| 레이어 경계 위반 0 | ✅ | — | renderer 변경 0, main 내 어휘 격리(claude-settings.ts) 유지 |
| 문서 형식/링크/한국어 | ✅ | — | OK |
| **OAuth 자격증명이 격리모드(`settingSources:[]`)에서 동작하는가** | ✖ | ✅ 실기 | **사람 확인 대기 (1순위)** — 불가 시 escape hatch 후속 |
| 격리모드 회귀 체감 (기존 ~/.claude env 의존 사용자) | ✖ | ✅ | 사람 확인 대기 |
| bedrock/vertex 실환경 (settings.json env 레시피) | ✖ | ✅ | 사람 확인 대기 |
| ModelMenu/Composer GUI 회귀 | ✖ | ✅ | 사람 확인 대기 (shape 불변이라 위험 낮음) |
| resolveSettings @alpha 실기 (provenance 로그) | ✖ | ✅ `npm run dev` 부팅 + 턴 1회 | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test && npm run build
lint      : PASS (0 problems)
typecheck : PASS (node + web)
test      : 50 files, 372 passed (372)
build     : electron-vite build ✓ (out/)
```

(참고: `db/queries.test.ts` 는 better-sqlite3 Node ABI 재빌드 후 green — 0010 r2 와 동일한 환경 조치, 코드 무관.)

## 위생 검토

- 키/토큰/이메일/IP 패턴: 신규 코드·문서·테스트에 실비밀 0 (플레이스홀더 `${VAR}`/가짜 토큰만).
- dist 산출물/캐시에 평문 비밀이 남지 않는 불변식 코드 확인(`claude-settings.ts` 해석 시점 한정, deployer 미확장 복사).
