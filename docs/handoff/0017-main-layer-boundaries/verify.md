# Verify — 0017-main-layer-boundaries

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 구현 주체 = Claude(비기능 직접 구현).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0017-main-layer-boundaries` |
| 검증자 | Claude Code |
| 일자 | 2026-06-14 |
| 대상 커밋 | `<impl-hash>` (커밋 후 INDEX 기재) |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `src/main/AGENTS.md`(+CLAUDE.md stub) 레이어 DAG·허용 의존 방향·디렉토리 매핑 표 | ✅ | `app/src/main/AGENTS.md`(L0→L1→L2→L3 DAG + 매핑 표 + 두 강제 규칙 + 작업 규칙), `app/src/main/CLAUDE.md`(`@AGENTS.md`). |
| 2 | eslint boundaries `src/main/**` 확장(renderer 동형, 하향만, 상위참조 error) | ✅ | `eslint.config.mjs` 신규 블록(files `src/main/**`·`src/shared/**`, elements main-root/ipc/adapters(+installer)/domain/shared, dependencies 하향만). 검증: domain→ipc 임의 import 주입 시 `boundaries/dependencies` error 발생 확인. |
| 3 | `import/no-cycle` 활성(0011 config↔mcp 순환 클래스 차단), 기존 순환 0 | ✅ | `eslint.config.mjs` `import/no-cycle:['error',{maxDepth:Infinity}]` + `import/parsers`(@typescript-eslint/parser) 로 .ts 역-에지 추적. 검증: 임의 2-파일 순환 주입 시 `Dependency cycle detected` 발생, 원복 후 0. |
| 4 | D2 분해 — `provider-settings.ts` 4책임 분리, 무회귀 | ✅ | 신규 `provider-registry.ts`(열거) · `model-resolve.ts`(모델 해석) · `env-merge.ts`(env 유틸) + `provider-settings.ts`(해석 서비스 + 계약 타입 + **배럴 re-export**). 12개 importer 경로 무변경(배럴), `provider-settings.test.ts` 무수정 통과. |
| 5 | 신규 규칙 위반 0(최소 이동) | ✅ | `npm run lint` error 0. 유일 상위참조였던 `installer`(→AdapterRegistry)는 L2 로 분류해 해소(코드 이동 0). |
| 6 | 게이트 + 문서(루트 AGENTS.md 표 + app/AGENTS.md 링크) | ✅ | 게이트 4종 통과. 루트 `AGENTS.md` "디렉토리 한눈에" 에 `app/src/main/AGENTS.md` 행 추가, `app/AGENTS.md` "모듈 레이아웃" 에 main 레이어 가이드 링크. |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 PASS |
| 인수 ↔ 코드/설정 대조 | ✅ | 이견 시 중재 | 6/6 |
| boundaries·no-cycle 실효성 | ✅ 주입 테스트 | — | 둘 다 error 발생 확인 후 원복 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | `eslint-plugin-import` 사용자 승인 완료 |
| 레이어 분류 적정성(installer=L2 등) | ✅ 현행 의존 반영 | 이견 시 조정 | 상위참조 0 |
| 문서 형식/링크/한국어 | ✅ | — | AGENTS.md 위생 OK |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test && npm run build
lint       ✅ boundaries(main 블록) + import/no-cycle error 0
typecheck  ✅ node + web
test       ✅ Test Files 50 passed / Tests 375 passed (D2 무회귀)
build      ✅ electron-vite build
```

## 위생 검토 (AGENTS.md 신규)

- `src/main/AGENTS.md`: 키/토큰/이메일/IP 패턴 0. 레이어 규칙·매핑·작업 규칙만(변동성/일회성 정보 없음).
- `CLAUDE.md` stub = `@AGENTS.md` 1줄(규약 준수).

## PHASES.md 정합성

- INDEX 0017 행 plan/READY → verify/PASS, 대상 커밋 기재.
- PHASES "구조 견고화(main 경계)" 행 승격.

## 결론 / 다음 단계

- **상태: PASS** (인수 6/6). 신규 의존성 `eslint-plugin-import`(승인). PHASES 승격.
- 다음: 0018 (settings branded types) 착수 — 선행(0017 분해 `env-merge`/`provider-settings`) 충족.
