# Plan — 0026-settings-json-model-parser

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(리팩토링) = Claude 직접 구현.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0026-settings-json-model-parser` |
| 작성자 | Claude Code |
| 일자 | 2026-06-17 |
| 매핑 | PHASES 행 / PR (push 후) |
| 상태 | DRAFT → READY → IMPL_DONE |

## Context (왜)

handoff 0021 은 settings.json 의 모델을 `extractModels()` 로 추출해 **파생 캐시 파일** `sources/settings/<adapter>/meta.json` 에 박고, 열거 시 디렉토리(SSOT)+meta.json 을 머지했다. meta.json 은 settings.json 에서 도출 가능한 정보를 이중으로 들고 있어 **동기화 부채**가 있었고, 추출 로직도 느슨했다(`includes('1m')` 부분문자열 매칭, family 문자열 인코딩, 구성된 것만 출력).

본 작업은 **meta.json 을 제거**하고 열거 시점에 각 provider 의 settings.json 을 직접 파싱하며, 추출 로직을 명세대로의 엄격한 순수 파서(`claude-model-parser`)로 교체한다. 사용자 결정으로 출력 형태(`alias/model/isCustom/oneMillionContext/isDefault`)를 렌더러까지 전면 도입한다.

## 인수 기준 (Acceptance Criteria)

1. `meta.json` 을 읽거나 쓰는 코드가 0이다(`engine-write`·`provider-registry`·`scaffold` 에서 제거). 스캐폴드/CRUD 후 meta.json 이 생성되지 않는다.
2. 신규 순수 파서 `claude-model-parser.ts` 가 명세대로 동작: `[1m]` 브래킷 분리, env 모델 키 추출, 명시 모델(env.ANTHROPIC_MODEL>model) 우선, 노출 목록 내 default 정확히 1개.
3. **필터링**: 커스텀(`ANTHROPIC_DEFAULT_*_MODEL`)이 하나라도 있으면 그 커스텀만 노출, 전무할 때만 sonnet/opus/haiku 3개(`model:null`) 노출. 명시 모델만 alias 를 가리키는 경우(DEFAULT 키 전무)는 "설정 없음"으로 3개 노출.
4. 노출 목록 내 default 가 비커스텀이면(케이스 #4) 노출 집합 안에서 재선정한다.
5. `listProviders` 가 각 provider 의 settings.json 을 파싱해 모델을 채운다(부재/손상은 기본 3 alias 로 관용 열거).
6. 렌더러 계약(`AgentModelView`)이 새 형태(`alias/model/isCustom/oneMillionContext/isDefault`)로 교체되고 ModelMenu·EngineModelList·modelSelection 이 정렬된다. `model:null` 항목은 SDK 에 bare alias 를 전달한다(`modelNameForFamily`).
7. legacy/unused 제거: `extractModels`·`updateMeta`·`OrcaModelSchema`·`EngineWriteResult.models`·"SDK 기본 모델" 빈-폴백 등.
8. 게이트 통과(lint/typecheck/test) + 파서 단위 테스트(명세 케이스 표) + 영향 테스트 재작성.

## 범위 / 비범위

- **범위**: claude-code 모델 파싱·열거·렌더러 표시. meta.json 제거. 문서(TRD/IPC_CONTRACT/standardization) 동기화.
- **비범위**: OS env/CLI `--model`/런타임 `/model` 우선순위, `best`·`opusplan` alias, `ANTHROPIC_SMALL_FAST_MODEL` 레거시 키, 계정 tier resolve, `modelFamily` wire/DB 필드명 변경(값만 alias 운반).

## 설계

- 신규 L1 순수 모듈 `app/src/main/settings/claude-model-parser.ts` (`parseClaudeModels`, `ParsedModel`). 3단계: 후보 빌드 → 필터링 → 노출 목록 내 default 1개.
- `model-resolve.ts` 가 `ParsedModel` 채택(`modelKey`=alias, `modelNameForFamily`=`model??alias`, `defaultModelFamily`=isDefault alias, `toAgentEnvironments` 통과). 배럴 `provider-settings.ts` re-export 정렬.
- `provider-registry.listProviders` 가 settings.json 을 관용 파싱해 `parseClaudeModels` 호출. `ProviderEntry.label`·`MetaEntrySchema`·`readMeta` 제거.
- `engine-write.ts` 는 settings.json 원자적 쓰기만(meta 로직 전부 제거). `EngineWriteResult` 에서 `models` 제거.
- `shared/ipc.ts` `AgentModelView` 교체. 렌더러 3파일 정렬(빈-폴백 제거).
- 레이어: 새 모듈은 L1 settings/, 하향 의존만(eslint-boundaries 준수).

## 영향 받는 파일

- 신규: `app/src/main/settings/claude-model-parser.ts` (+ `.test.ts`)
- `app/src/main/settings/{model-resolve,provider-registry,engine-write,provider-settings}.ts`
- `app/src/main/deploy/scaffold.ts`, `app/src/main/config/paths.ts`(주석), `app/src/main/deploy/deployer.ts`(주석)
- `app/src/shared/ipc.ts`
- 렌더러: `composer/{ModelMenu.tsx,modelSelection.ts}`, `engine/components/EngineModelList.tsx`
- 테스트: `engine-write.test.ts`·`provider-settings.test.ts`·`scaffold.test.ts`·`deployer.test.ts`
- 문서: `docs/TRD.md`·`docs/IPC_CONTRACT.md`·`docs/arch/backend/standardization.md`

## 참고 문서

- `docs/TRD.md §6.8 / §6.8.1`
- `docs/IPC_CONTRACT.md §2.2-b/§2.2-c`
- `docs/arch/backend/standardization.md §5.1`
- handoff 0021(모델 추출 부분을 supersede), 0014(meta.json 도입을 supersede)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `claude-model-parser.test.ts`(순수 변환기 — 명세 케이스 표).

---

## 구현 체크리스트 (Claude)

- [x] `claude-model-parser.ts` + 테스트(12 케이스, 명세 + 필터링 재정의)
- [x] `model-resolve.ts` ParsedModel 채택
- [x] `provider-registry.ts` settings.json 파싱 열거(meta 제거)
- [x] `engine-write.ts` meta 로직 제거 + `EngineWriteResult.models` 제거
- [x] `scaffold.ts` META_TEMPLATE/meta 생성 제거
- [x] `shared/ipc.ts` AgentModelView 교체
- [x] 렌더러 3파일 정렬(빈-폴백 제거)
- [x] 영향 테스트 4종 재작성
- [x] 문서 3건 + paths/deployer 주석
- [x] 게이트 통과

## 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | settings/{claude-model-parser(+test),model-resolve,provider-registry,engine-write(+test),provider-settings}.ts · deploy/{scaffold(+test),deployer(+test)}.ts · config/paths.ts · shared/ipc.ts · 렌더러 3 · 문서 3 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test — 영향 범위 391 passed; `db/queries.test.ts` 9건은 better-sqlite3 Node ABI 환경 제한(코드 무관, 0007/0009/0019 동일 계열) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (push 후 기재) |
