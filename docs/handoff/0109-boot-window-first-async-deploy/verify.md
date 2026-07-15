# Verify — 0109-boot-window-first-async-deploy

## 메타

| 항목 | 값 |
|---|---|
| slug | `0109-boot-window-first-async-deploy` |
| 검증자 | Claude Code |
| 일자 | 2026-07-15 |
| 대상 커밋 | `4951a2f` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| engine CRUD `deploy('claude')` 직접 호출이 서비스 직렬화 밖 | 타당 — invoke 직렬성으로 실질 위험 낮음, 후속 통합 대상 | **파생 이슈 D1**(plan 에 기록, open) |
| 선조치 ✅ #1: 기존 deployer 테스트의 미await 첫 배포가 async 전환 후 경합(EEXIST) | 타당 — 직렬화 필요성의 실증, await 수정 | 매트릭스 #5 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 창 먼저(start await 전 createWindow) | ✅ | `app/src/main/index.ts` whenReady 블록 — `started = router.start()` → handle 등록 → `createWindow` → `await started` |
| 2 | `orca:boot:whenReady` — start 착수 직후 등록, start promise 반환, IPC_CONTRACT 64→65 | ✅ | `shared/ipc.ts`·`index.ts`·`docs/IPC_CONTRACT.md` §2.1-b(+총계 참조 5문서 동기화: AGENTS/PRD/TRD/runtime-ipc/ux-domains) |
| 3 | renderer 첫 mandatory 스텝 `main-ready` + 성공 순서/실패 테스트 | ✅ | `app/boot/steps.ts` 스텝 0 + `steps.test.ts` 신규 2건 green |
| 4 | deployer/plugin-package/seed `fs/promises` 전환(재귀 복사·삭제·쓰기 동기 0, `existsSync` 예외) | ✅ | `deployer.ts`·`claude-plugin-package.ts`·`skills/seed.ts` — sync fs import 는 `existsSync` 만 잔존 |
| 5 | 배포 서비스 in-flight 직렬화 + 코얼레스 + ensureDeployed 의미 유지 | ✅ | `extension-deployment-service.ts` + 신규 테스트 3건(코얼레스 runs=2·최신 결과, 완료 후 신규 실행, 실패→재시도→no-op) green |
| 6 | CRUD·턴 게이트 await | ✅ | `context.ts` Promise 시그니처, `handlers/misc.ts` 3곳·`mcp.ts` 3곳·`engine.ts` 3곳·`chat-turn.ts:517` await |
| 7 | bootstrap seed·deploy 스텝 async `step` 전환 | ✅ | `bootstrap.ts` builtin-skill-seed·extension-deploy |
| 8 | 게이트 | ✅ | lint 0 error · typecheck 3종 0 · extensions+boot 31 tests → 전체 vitest 878/878(builder.test 포함 — Node ABI 재빌드 후) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 | ✅ | — | green |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 |
| 레이어 경계·IPC 계약 문서 동시 갱신 | ✅ | — | lint 0 · §6 절차 준수 |
| **electron 실기: 콜드스타트 창 등장 체감·BootScreen→landing·스킬 다수 CRUD 무정지·prod `app://` 첫 서빙** | ✖ | ✅ | **사람/CI 확인 대기**(egress 제약 — 0019·0102 선례) |
| main-ready 10s 타임아웃 vs 장기 마이그레이션 정책 | ✖ 제안 | ✅ | 실측 후 필요 시 상향(파생 UX 기재) |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
lint: 0 error / typecheck 3종: 0 / vitest 878/878 / scripts fail 0
```

## PHASES.md 정합성

- 성능 시리즈 4행 일괄 승격 — 형식 확인.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: prod 프로토콜 서빙과 start() 동기 구간(DB init)의 인터리브를 수치 없이 수용 — 실기 관찰 항목.
- 구현 단계: engine 배포 경로의 서비스 미경유(D1) — 이론상 경합 잔존.
- 검증 단계: 창-먼저 흐름은 electron 프로세스 기동이 필요해 이 환경에서 자동 검증 불가 — 스텝 러너 단위 테스트로 대리.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. electron 실기는 사람/CI 대기. 파생 이슈 D1(open)은 후속 핸드오프 후보.
