# 0267–0281 verify FAIL 대응 — 공통 검증 기록

2026-10-23, Windows, 작업 브랜치 `ccr-a053656f-pny3g5`. 대상은 보드에서 Codex에게 배정된 10개 handoff다. 이 문서는 구현자의 자기검증 기록이며 독립 verify를 대체하지 않는다.

## 변경 범위

실행 코드는 변경하지 않고 기존 동작을 구별하는 fixture·단언과 회귀 테스트를 보강했다. 각 handoff의 계약·이관 책임·실기 대기 경계는 유지한다. 변이는 작업 트리와 분리된 임시 app 복사본에만 적용하고 원바이트 복구 후 같은 시험을 실행했다.

## 공통 gate

| 검사 | 결과·범위 |
|---|---|
| 전체 Vitest | `vitest run --pool=threads --maxWorkers=2`: 817파일, 7,921 passed·1 failed·2 skipped. 실패는 미변경 `daily.test.ts`의 실행 중 TZ 전환이며 기본 `--pool=forks`로 같은 파일 21/21 통과. 최종 수정 22파일은 별도로 기본 forks에서 118/118 통과 |
| scripts 단위 테스트 | `node --test scripts/*.test.mjs`: 142/142 통과 |
| TypeScript 3구성 | `npm run typecheck`: exit 0; 최초 renderer fixture 타입 3건 수정 후 재실행. 마지막 렌더 fixture 정리 뒤 `typecheck:test`도 exit 0 |
| ESLint | `npm run lint`: exit 0, 오류 0·기존 TanStack Virtual 관련 경고 2. 새 테스트 작성 규칙 오류 4건 수정 후 재실행 |
| 빌드 | `electron-vite build`: main·preload·renderer 번들 생성 exit 0. Node ABI를 유지했으며 Electron native 재빌드·패키징은 수행하지 않음 |
| 마이그레이션·테스트 예산 | `check-migrations-appendonly.mjs`, `check-test-budgets.mjs`: 모두 exit 0 |
| 문서 inventory·prose·links | 추적 파일과 이번 신규 산출물을 복사한 임시 snapshot에서 원본 `check-doc-inventory.mjs --check` exit 0. 현재 작업폴더 직접 실행은 기존 ignored `app/.temp/opencode` checkout의 끊긴 링크를 포함하므로 분리 |
| diff·trailer | `git diff --check` 통과. handoff별 커밋에서 staged diff 검사 및 커밋 직후 trailer 파싱을 수행 |

## 결함 주입

| 책임 | 이번 FAIL 지점 | 직접 관측 |
|---|---|---|
| 0281 | models 대기 spinner·motion class·Tab·미선택 라벨·MenuTitle 순서 | 5종 검출; 해당 plan r2 표 |
| 0280 | acquire 단계·provider env·draft 오류 버튼 | N6·N9·R8 각 1 failed, 형제 N6b도 1 failed; 원복 관련 6파일16시험 |
| 0278·0279 | control 주입·발행 barrier·revision/stale emit·외부 재편집·push scope | 같은 계약의 finding은 한 번의 직접 경로 검사로 공유; 각 plan r3/r2 표 |
| 0277 | 파일 없는 plugin의 canOpen | O3 1 failed; 원복 configured-resources 2/2 |
| 0276 | providerKey 운반·retired generation | Q2·Q8 각각 1 failed |
| 0275 | context 예약·warm 실패 fence | L15·E11 각각 1 failed |
| 0269 | telemetry보다 native model 복원 우선 | G6 1 failed |
| 0268 | 주 창 링크 등록·Markdown anchor | H1 1 failed·H2 2 failed; 신규 AST 대상/콜백 변이 각각 1 failed |
| 0267 | Toggle 모션·축소 모션·상태 그룹 여백·모델 로고 | J7·J8·J13·J15 검출; 등록 M1–M4도 검출 |

## 이전 검출과 동치 행 회귀

| 책임 | 재측정 | 원복 관측 |
|---|---|---|
| 0280 | N1·N3·N5·N7·N8 각각 1·2·2·1·1 failed; R1–R7·R9·R10 각각 1·2·1·1·2·2·2·1·3 failed | main 3파일28시험, renderer 3파일12시험 통과 |
| 0278·0279 | 이전 검출 24종 중 A3·A14가 현재 Windows에서 생존해 같은 계약의 oracle을 보강했다. A3 junction 외부 경로 쓰기 거부 1 failed, A14 첫 commit 전에 두 번째 patch 진입 금지 1 failed. 고유 34종은 최종 33검출·A7 동치; 초기 두 생존을 포함한 36회 기록은 [기계 결과](../../0278-harness-extension-isolation/evidence/r3-mutation-results.json)에 보존 | 최종 변경 7파일59시험, 확대 43파일430시험 통과; A7 동치 2파일94시험 통과 |
| 0277 | O1·O2 각각 1 failed. A20·A21·A22·A5·A11·F12a–d는 0278의 같은 경로 재측정을 공유 | configured-resources 2/2 통과 |
| 0275 | L8은 현행 context 전체 retire 계약에서 동치임을 유지 | 3파일30시험 통과 |
| 0269 | M1 2 failed | 7/7 통과 |
| 0268 | H4–H9 각각 1·4·1·1·2·1 failed | 8파일80시험 통과 |
| 0267 | M1–M4 모두 검출; 최초 M3 잘못된 파일 경로 호출은 수집 실패로 제외하고 실제 공통 composer 경로에서 10 failed 재측정 | M3 관련 13/13 통과 |

모든 로컬 로그는 ignored `.tmp/` 또는 OS 임시 폴더에 두며 비밀·개인 경로를 handoff에 복사하지 않는다. 결함 주입으로 생긴 production 수정은 최종 트리에 없다.

## 남은 경계

실제 Electron 두 테마의 시각 인수, 0268 AC4 Windows 토스트 미발생, 실제 사용자 환경의 native 동작은 새로 관측하지 않았다. 이번 변경이 테스트뿐이라는 사실과 실제 제품 실기의 완료 여부를 구분한다.
