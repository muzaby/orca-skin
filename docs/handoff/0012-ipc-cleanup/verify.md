# Verify — 0012-ipc-cleanup (PASS r1)

> 검증자: Claude Code · 일자: 2026-06-11 · 대상 커밋: `03cc1f5`

## 요구사항 충족 매트릭스

| # | 인수 기준 | 판정 | 증거 |
|---|---|---|---|
| 1 | runtime 3채널 제거 + 타입 main 이동 + dev 로깅 유지 | ✅ | `shared/ipc.ts` CHANNELS 36키, `preload/index.ts` orca.runtime 부재, `main/runtime/PythonRuntime.ts` 에 RuntimeStage/RuntimeStatus 정의, `ipc/router.ts` 리스너 = 로깅만. `grep "orca:runtime" app/src` 0건 |
| 2 | `ipc/registry.ts` handle 헬퍼 + 실패 정책 등록부 명시 | ✅ | `registry.ts` — `InvalidPolicy<R> = 'reject' \| { fallback }`, 정책 규약 헤더 주석 |
| 3 | handlers 4종 · approvals · chatCancel 헬퍼 전환 | ✅ | 각 파일 `handle`/`handlePlain` 경유, raw `ipcMain.handle` 잔존은 `registry.ts` 내부 + `main/index.ts` window 3채널(윈도우 인스턴스 직접 참조 — 의도)뿐 |
| 4 | IPC_CONTRACT.md 갱신 (36채널·도메인 15·agent §2.2-b·§2.11 제거 이력·§4 ErrorCategory·§3 어휘·§6 절차·검증 정책) | ✅ | 해당 절 전부 갱신 + `arch/backend/overview.md`·`TRD.md` §5·`docs/AGENTS.md` 인벤토리 동기화 |
| 5 | 게이트 | ✅ | lint ✅ / typecheck ✅ / test 351/351 / build ✅ |
| 6 | renderer 무변경 | ✅ | `git show 03cc1f5 --stat` 에 `src/renderer` 0건 |

## 검증 책임 분리

| 항목 | 에이전트 | 사람 |
|---|---|---|
| 게이트 + 인수 1:1 대조 | ✅ 위 표 | 이견 시 중재 |
| GUI 회귀 (Python 런타임 dev 로깅·MCP/프로젝트/세션 CRUD) | ✖ 헤드리스 | ✅ 수동 |

## 위생

- 비밀/개인정보 추가 0, 신규 의존성 0, 와이어 의미 변경 0(제거만).
