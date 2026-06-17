# Verify — 0026-settings-json-model-parser

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능 = Claude 직접 구현 + 자기 검증.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0026-settings-json-model-parser` |
| 검증자 | Claude Code |
| 일자 | 2026-06-17 |
| 대상 커밋 | (push 후 기재) |
| 라운드 | 1 |
| 상태 | PASS (구현 범위) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | meta.json read/write 0 | ✅ | `engine-write.ts`(meta 심볼 전무)·`provider-registry.ts`(readMeta 제거)·`scaffold.ts`(META_TEMPLATE 제거). `engine-write.test.ts` 가 meta.json 부재(`existsSync … false`) 단언 |
| 2 | 파서 명세 동작 | ✅ | `claude-model-parser.ts` `stripOneMillion`/3단계. `claude-model-parser.test.ts` 12 케이스 green |
| 3 | 필터링(커스텀만/전무 시 3개·명시-only=설정없음) | ✅ | 테스트 "단일 커스텀→opus 만", "model:'opus'→3개 노출" |
| 4 | 노출 목록 내 default 재선정(#4) | ✅ | 테스트 "케이스 #4 — model=sonnet + DEFAULT_OPUS → opus 만, opus default" |
| 5 | listProviders settings.json 파싱(관용) | ✅ | `provider-registry.ts:modelsForProvider`. 테스트 "부재/손상 → 3 alias 로 열거" |
| 6 | AgentModelView 교체 + 렌더러 정렬 + null=bare alias | ✅ | `shared/ipc.ts`·ModelMenu/EngineModelList/modelSelection. `model-resolve.modelNameForFamily` `model ?? alias`. 테스트 "null 모델 alias → bare alias" |
| 7 | legacy/unused 제거 | ✅ | `extractModels`·`updateMeta`·`OrcaModelSchema`·`EngineWriteResult.models`·빈-폴백 행 제거(grep 잔존 0, 주석 1건만) |
| 8 | 게이트 + 신규/재작성 테스트 | ✅ | lint/typecheck ✅, 영향 범위 391 passed |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint ✅ / typecheck ✅ / test 391 passed (DB 9건 ABI 환경) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 ✅ |
| 레이어 경계 위반 0 | ✅ | — | lint(boundaries) ✅ — 새 모듈 L1 settings/ |
| 문서 형식/링크/한국어 | ✅ | — | TRD/IPC_CONTRACT/standardization 동기화 |
| 제품 의도 부합(필터링/UX) | ✖ 보조 | ✅ 결정 | 사용자 질의응답으로 확정(필터링·3 alias·label 제거) |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 — ModelMenu/EngineCard 표시 |
| 실환경 bare-alias SDK 해석 | ✖ | ✅ | 사람 확인 대기 — model:null alias 전송 응답 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint ✅ (eslint --fix, boundaries 0)
typecheck ✅ (node/web/test)
test — 영향 범위(settings/deploy) 39/39, 전체 391 passed / 9 failed
  실패 9건 = src/main/db/queries.test.ts (better-sqlite3 Electron ABI ↔ sandbox Node ABI 127 충돌)
  → 코드 무관·본 변경 미접촉(handoff 0007/0009/0019 동일 계열). Node ABI 재빌드 시 green.
```

## PHASES.md 정합성

- INDEX.md `0026` 행 추가(verify/PASS, 다음 —), PHASES.md "현재 작업 중" → 완료 표 승격(PR/커밋 push 후).

## 결론 / 다음 단계

- 상태: PASS(구현 범위). meta.json 클린 브레이크 — 기존 `~/.config/orca/sources/settings/<adapter>/meta.json` 잔존 파일은 무시되고 더 이상 생성/참조되지 않는다(사용자 환경 정리 불필요, 자연 소멸).
- 사람 확인 대기: ModelMenu/EngineCard 시각 검증, 실환경 `model:null` alias 전송.
