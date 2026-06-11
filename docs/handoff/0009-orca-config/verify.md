# Verify — 0009-orca-config

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0009-orca-config` |
| 검증자 | Claude Code |
| 일자 | 2026-06-11 |
| 대상 커밋 | `1deae14` |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

> plan §인수 기준(1~14)을 1:1 대조. 증거는 `파일:라인` + 테스트.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 파일 부재 시 `{version:1,agents:[]}` atomic(tmp+rename) 생성, 존재 시 미덮어쓰기 | ✅ | `config/orca-file.ts:81-87` (`existsSync` 가드 + `writeFileSync(tmp)`→`renameSync`). 테스트 `orca-file.test.ts:80-95`("부재 시 빈 템플릿 생성" / "기존 파일은 덮어쓰지 않는다") |
| 2 | 부팅 1회 파싱·캐시 + `getOrcaConfig()` 동기 lazy 접근 | ✅ | 부팅 `ipc/router.ts:157-161`(`loadOrcaConfig()` try/warn). `config/orca-config.ts:14-29`(`loadOrcaConfig` 캐시 갱신 / `getOrcaConfig` = `cached ?? loadOrcaConfig()`) |
| 3 | 전체 손상(JSON/최상위 스키마) → 부팅 무중단 + 기본값 + warn, **원본 보존** | ✅ | `orca-file.ts:49-66`(JSON.parse catch + `OrcaConfigTopSchema.safeParse` fallback, 둘 다 DEFAULT 반환·미기록). 테스트 `orca-file.test.ts:54-64`(JSON 손상·version 위반) + `97-102`("손상 원본 미수정") |
| 4 | 항목별 invalid 드롭+사유, 나머지 유지, 미지 키 strip, models 보존 | ✅ | `orca-file.ts:68-78`(per-agent `safeParse`, 실패만 warn 푸시) + zod strip 기본 + `OrcaAgentSchema.models` default. 테스트 `orca-file.test.ts:22-77` |
| 5 | provider 매핑(bedrock/vertex/anthropic·부재/미지=경고+무시·드롭 아님) | ✅ | `adapters/claude-env.ts:42-48`. 테스트 `claude-env.test.ts:10-36`(4분기 + "미지 provider 는 드롭하지 않고 경고") |
| 6 | apiKey→`ANTHROPIC_API_KEY`, baseUrl→`ANTHROPIC_BASE_URL`, 빈/공백 부재 처리 | ✅ | `claude-env.ts:50-51` + `present()`(`:12-16` trim 후 빈문자 → undefined). 테스트 `claude-env.test.ts:38-60` |
| 7 | `${VAR}` = secret-store→process.env 어댑트 시점 해석, 평문 통과, 캐시는 미확장 | ✅ | `claude-env.ts:18-32`(`expandVars` 재사용) + `claude-code.ts:272-281`(`agentEnv()` 가 `this.makeResolver()` 로 어댑트 시점에만 확장). 캐시·`TurnRequest.agent` 는 미확장(`extensions/types.ts:43-45` 주석). 테스트 `claude-env.test.ts:38-52` |
| 8 | 미해결 `${VAR}` = 해당 env 키만 드롭 + 경고(빈문자 치환 아님) | ✅ | `claude-env.ts:18-32`(`setExpanded` 가 신규 missing 발생 시 키 미설정) + 호출처 warn `claude-code.ts:274-279`. 테스트 `claude-env.test.ts:62-79` |
| 9 | `env` 레코드가 매핑 키보다 우선 | ✅ | `claude-env.ts:53-55`(env 레코드 마지막 spread, `setExpanded` 가 기존 키 `delete` 후 재설정). 테스트 `claude-env.test.ts:81-92` |
| 10 | sendMessage 최종 env = `{...(pyEnv??process.env), ...agentEnv}`, 빈 agentEnv 면 비트 동일 | ✅ | `claude-code.ts:198`(`mergedEnv = this.agentEnv(req.agent, env)`) + `:229`(`...(mergedEnv ? {env:mergedEnv} : {})`) + `mergeAgentEnv` 빈 agentEnv → base 그대로 반환(`claude-env.ts:68-74`). 테스트 `claude-env.test.ts:99-112` |
| 11 | complete 경로 동일 agent env, 빈 시 옵션 생략, 있으면 `{...process.env, ...agentEnv}` | ✅ | `claude-code.ts:166`(`runCompletion` `agentEnv(req.agent)` base 없음) + `:176` 옵션 조건부, `mergeAgentEnv(undefined, env)` → 빈 시 undefined(생략) / 있으면 processEnvRecord spread. router 전달 `router.ts:657`(`agent: agentFor(req.adapter.id)`) |
| 12 | agent 선택 = adapter 일치 첫 항목, 무일치 시 주입 0 | ✅ | `orca-config.ts:31-33`(`agents.find(a => a.adapter === adapter)`), router `router.ts:385`(sendMessage) + `:657`(complete) `agentFor(adapter.id)` 전달. 무일치 → undefined → `toClaudeEnv` 빈 env(`claude-env.ts:38`) |
| 13 | 변경 범위 0: IPC/preload/renderer/`src/shared/` 변경 0, 신규 의존성 0 | ✅ | `git show --stat` — 변경은 `app/src/main/**` + `docs/**` 뿐. `shared/`·`preload/`·`renderer/`·`IPC_CONTRACT` grep 0건. `package.json` 무변경 |
| 14 | 게이트 통과 + 신규 테스트 green + `mcp/expand` 기존 케이스 무수정 green | ✅ | lint ✅ / typecheck ✅ / 범위 테스트 26/26 ✅. `expand.test.ts` diff = `expandVars` describe 추가 + import 1줄(기존 `expandEnv` 6케이스 무수정). 전체 `npm test` 328/335 — 실패 7건 전부 `db/queries.test.ts` better-sqlite3 ABI(아래 §게이트) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint·typecheck PASS, 범위 26/26, 전체 328/335(7=ABI 환경) |
| 인수 기준 ↔ 코드 대조 | ✅ `파일:라인` | 이견 시 중재 | 14/14 충족 |
| 레이어 경계 위반 0 | ✅ | — | renderer 무변경, `eslint --cache` boundaries 포함 PASS. SDK 어휘(`CLAUDE_CODE_USE_*`)는 `adapters/claude-env.ts` 안에 격리 |
| 문서 형식/링크/한국어 | ✅ | — | TRD §6.8 / standardization §5.1+부트순서 / security 예외 / GLOSSARY 1줄 — 한국어·표 톤 일관 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 본 변경에 AGENTS.md 수정 없음. 신규 코드 비밀 평문 0(테스트 fixture `plain-key`·`${VAR}` 만) |
| 제품 의도(평문 apiKey 예외·파일 위치) | ✖ 보조 | ✅ 결정 | 사용자 확정(plan §결정 1·2) — 재확인 불필요 |
| 실환경 bedrock/vertex 전환 동작 | ✖ | ✅ | 사람 확인 대기 — 실제 클라우드 자격으로 SDK env 주입이 동작하는지 |
| 신규 의존성 승인 | ✖ | ✅ | 해당 없음(신규 의존성 0) |
| PR 머지 승인 | ✖ | ✅ | 사용자 요청 시 |

## 게이트 재실행 결과

```
$ cd app && npm run lint            # eslint --cache --fix ./src
  → PASS (출력 없음, working tree 무변경 — 자동 수정 0)
$ npm run typecheck                  # tsc --noEmit (node + web)
  → PASS (node ✅ / web ✅)
$ npx vitest run config/orca-file.test.ts adapters/claude-env.test.ts mcp/expand.test.ts
  → Test Files 3 passed (3) / Tests 26 passed (26)
$ npm test                           # vitest run (전체)
  → Test Files 1 failed | 46 passed (47) / Tests 7 failed | 328 passed (335)
```

**전체 7 실패 = 환경 제한(변경 무관)**: 모두 `src/main/db/queries.test.ts`. 사유 `better-sqlite3 ... NODE_MODULE_VERSION 140 ... requires 127`(Electron 빌드 native 모듈 ↔ Node 테스트 런타임 ABI 불일치). 0007 verify §게이트에 기록된 동일 계열. 본 변경은 DB 미접촉(config/adapter 순수 함수)이라 인과 없음. 게이트 의도(신규 테스트 green + 기존 무수정)는 완전 충족.

## 위생 검토

- 본 작업은 dev-time `AGENTS.md` 무변경 → 키/토큰/이메일/IP 스캔 대상 없음.
- 신규 소스(`orca-file.ts`/`orca-config.ts`/`claude-env.ts`)·테스트에 실비밀 평문 0 — 자격은 `${VAR}` 또는 테스트 더미(`plain-key`/`field-key`)뿐.
- 문서 변경 4건 모두 결정 중심·표/문단 톤 유지, 변동성/일회성 정보 혼입 없음.

## PHASES.md 정합성

- 페이즈 표에 `0009-orca-config` 행 승격(완료, 커밋 `1deae14`). "현재 작업 중" 은 보드 링크만 유지(드리프트 방지).
- INDEX.md 행: `verify/PASS`, 다음 주체 `—`.

## 결론 / 다음 단계

- **상태: PASS** — 인수 14/14 충족, 게이트 lint/typecheck PASS·범위 테스트 26/26, 레이어 경계 위반 0, 신규 의존성 0, 문서 4건 정합. 전체 테스트 7 실패는 better-sqlite3 ABI 환경 제한으로 본 변경과 무관.
- PHASES 표 승격 완료. PR 은 사용자 요청 시 생성.
- **다음 핸드오프 후보(plan §비범위)**: 렌더러(IPC) 노출 + agent/모델 선택 UI, `{adapter}-{provider}/{model}` 합성 키 함수, `models[].family/default` 소비, orca.json 핫리로드(파일 watch).
- **사람 확인 대기**: 실환경 bedrock/vertex 전환 + 평문/`${VAR}` apiKey 주입이 SDK 에서 실제 동작하는지(에이전트는 순수 함수 단위까지만 보증).
