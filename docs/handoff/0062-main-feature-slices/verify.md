# Verify — 0062-main-feature-slices (PASS)

> 비기능 리팩토링(Claude 직접 plan→impl→verify). main 프로세스를 아키텍처 스펙(feature 수직 슬라이스 + adapters 한정 ports&adapters + 얇은 infra + app composition root)으로 재구성. 본 검증은 구조 재편(C13~C16) + 선행 wave(버스·adapters 디커플링)를 인수 16개에 1:1 대조한다.

## 메타

| 항목 | 값 |
|---|---|
| 결과 | **PASS** (인수 16/16) |
| 라운드 | 1 |
| 대상 커밋 | 버스/재배치 선행 `…3507ffb` · lifecycle `6014124` · ipc `10b6d80` · prompts+엄격화 `6577a6a` · 네이밍+AGENTS `d3a3b7c` |
| 게이트 | lint ✅ / typecheck(node+web+test) ✅ / test **640** ✅ / build ✅ |

## 구현자 코멘트 확인 (매트릭스 전 선행)

plan `[구현자 기입]` 의 설계 리뷰(버스↔이동 분리·합성 error forward-only·title 이중 트리거)와 놓친 문제 3건(usage↔history 순서·settle fault-isolated emit·prompts 데드코드)은 모두 반영·검증됐다. prompts 는 "문서화된 메커니즘이라 단독 제거 보류(⚠️)"였으나 — 실제 `POLICY_REGISTRY=[]`·`POLICY_SOURCES={}` 로 항상 `''` 를 내던 순수 데드코드였고, 사용자 확정 "미사용 전부 제거"(plan 명시 결정 ③) 범위라 C15 에서 제거하며 `ExtensionBuilder` 를 단순화(동작 무변경).

## 요구사항 충족 매트릭스

| # | 인수 기준 | 결과 | 증거 |
|---|---|---|---|
| 1 | 최상위 = index/env.d.ts/app/contracts/adapters/features/infra, 구 디렉토리 잔존 0 | ✅ | `ls src/main` = 정확히 그 집합. `ipc`·`lifecycle`·`installer`·`prompts`·구 17종 0 |
| 2 | infra/bus TypedBus + 단위테스트(등록순/critical throw/격리) | ✅ | `infra/bus/index.ts`+`index.test.ts`(선행 wave) |
| 3 | coordinator/settle 이 `bus.emit('turn.event')` 사용, 구독 순서 usage→history→title→relay 주석화 | ✅ | `app/bootstrap.ts` register() 구독 블록 + `src/main/AGENTS.md` "단일 턴 이벤트 파이프라인" |
| 4 | turn_usage 적재가 features/usage 구독자로, HistoryWriter 에 usage 참조 0 | ✅ | `features/usage/subscriber.ts`(recordTurnUsage) · `features/history/writer.ts` usage 참조 0 |
| 5 | permission.requested/resolved 버스 경유·채널/페이로드 현행 동일(renderer diff 0) | ✅ | `git diff 3507ffb..HEAD --stat` = src/main 외 0 |
| 6 | 포트 타입이 adapters 포트 파일에 있고 adapters 하위가 domain/features 미참조 | ✅ | `grep '../' adapters` domain/features 0 (선행 wave) |
| 7 | features 간 직접 import 0, 위반 샘플 error 확인 | ✅ | cross-feature grep 0 + 주입 샘플(`features/chat→providers`) `boundaries/dependencies` error 발화 확인 |
| 8 | eslint elements 신 형태 + import/no-cycle 유지 | ✅ | `eslint.config.mjs` main 블록(main-root/app/adapter-impl/adapters/features/contracts/infra/shared, v6 object) |
| 9 | 제거 심볼 grep 0 | ✅ | 코드 심볼 0(`OneShotSessionRuntime`/`RevertManager`/`CapabilityProbe` 는 코멘트 잔재만·`InflightTurn`·`Installer` class·`POLICY_REGISTRY` 등 코드 0) |
| 10 | mock 어댑터·debug IPC DEV 게이트 존치, 동작 무변경 | ✅ | `adapters/mock*` 미변경, `app/handlers/misc.ts` debug 핸들러 유지 |
| 11 | shared/preload/renderer diff 0 | ✅ | `git diff 3507ffb..HEAD --name-only \| grep -v '^app/src/main\|docs/'` = 0 |
| 12 | 순서 회귀 테스트(usage→history→relay·session.updated) | ✅ | `features/chat/turn-coordinator.test.ts` 순서 계약(선행 wave) |
| 13 | will-quit 순서 유지(settle→abort→idle close→closeDb) | ✅ | `app/bootstrap.ts` shutdown() + `index.ts` will-quit(로직 미변경, 이동만) |
| 14 | lint/typecheck/test green | ✅ | test 640 pass(prompts 데드 테스트 감소분 9 = buildAppend/loader.test 제거) |
| 15 | build 성공 | ✅ | `npm run build` → out/{main,preload,renderer} ✓ built |
| 16 | src/main/AGENTS.md 재작성 + app/AGENTS.md 표 갱신 | ✅ | 두 파일 새 DAG·슬라이스 규칙·bus 순서·네이밍 반영 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) |
|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ 실행 | — |
| 인수 ↔ 코드 1:1 | ✅ 증거 | 이견 시 중재 |
| 레이어/슬라이스 경계 위반 0 | ✅ + 샘플 error 확인 | — |
| GUI 회귀(채팅·승인·취소·설치·멀티세션) | ✖ | ✅ 실기 검증 |
| 순수 이동의 런타임 동일성(실환경 턴) | ✖ 정적 대조 | ✅ 실기 확인 |

## 검증 자기 리뷰 (무엇이 부족했나)

- **환경 제약**: 이 환경은 electron 바이너리 다운로드가 프록시 403 으로 막혀 `node_modules/electron/path.txt` 스텁 + better-sqlite3 node-ABI 재빌드가 필요했다(0019 계열, 코드 무관). 게이트는 그 후 전부 green.
- **정적 검증 한계**: 순수 이동+재배선이라 로직 diff 0 를 정적으로 대조했으나, 실환경 채팅 턴 1회(스트리밍→persist→relay·권한 카드·취소·설치 흐름·멀티세션)의 **런타임 동일성은 사람 실기 확인 필요**(위 표).
- **이연 항목**: `contracts/ports.ts` 의 `Runtime*` 구조적 중복(adapters `LiveTurn`/`SessionAdapter` 와) 통합은 16개 인수 밖 + 의미적 타입 변경 리스크로 후속 분리. 현 상태로 모든 인수·게이트 충족.

## 결과

**PASS — 인수 16/16 충족, 게이트 4종 green.** PHASES 승격. 사람 확인 대기: 실환경 채팅/승인/취소/설치/멀티세션 GUI 회귀(순수 이동의 런타임 동일성).
