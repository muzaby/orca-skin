# Verify — engine-modal-single-step

## 메타

| 항목 | 값 |
|---|---|
| slug | `0090-engine-modal-single-step` |
| 검증자 | Claude Code |
| 일자 | 2026-07-10 |
| 대상 커밋 | `119132f` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 — `classifyClaudeEnv` truthy 판정에서 `'0'`/`''`/`null` 을 비활성 취급 | 타당 — `CLAUDE_CODE_USE_BEDROCK: '0'` 오판 방지, 테스트로 고정됨 | 매트릭스 #6 증거에 포함 |
| 선조치 ✅ #1 — Esc 이중 닫힘(메뉴+모달) 가드 | 타당 — `menuOpen` 시 모달 Esc 스킵 | #8 증거 |
| 선조치 ✅ #2 — label 내 중첩 인터랙티브 요소 회피 | 타당 — div 전환 + textarea `aria-label` | #4 증거 |
| 선조치 ✅ #3 — 시딩 시 pretty-print 재직렬화 수용 | 타당 — `writeJsonAtomic` 규약 유지, 키/값 verbatim 은 테스트 보장 | #6 증거 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 단일 화면 — Stepper/이전/닫기/엔진·공급자 화면 부재 | ✅ | `EngineFormModal.tsx` 재작성 — `Stepper`·`EngineStep`·`ProviderStep`·`step` state 전부 삭제(grep 0건), 헤더는 타이틀만 |
| 2 | adapter `claude` 칩 고정 표기 | ✅ | `EngineFormModal.tsx` 칩 행 — `claude` 리터럴 고정, edit 모드는 `/ <provider>` 병기 |
| 3 | 공급자 드롭다운(4종·간결 설명·기본 anthropic·선택 시 템플릿/이름 갱신) | ✅ | `providerCatalog.ts` `DEFAULT_PROVIDER_ID`·desc 간결화, 모달 `pickProvider` + `Popover placement="bottom"` + 선택 항목 check 아이콘 |
| 4 | Material `file_open` 버튼 → `~/.claude/settings.json` 자동완성 + 실패 인라인 안내 | ✅ | `Icon.tsx` `fileOpen`(fonts.gstatic 원본 path), 모달 `importUserSettings()` — `exists:false` → "찾을 수 없어요" 인라인 표시 |
| 5 | 신규 IPC `orca:engine:importUserSettings` 배선 + IPC_CONTRACT 등재(63→64) | ✅ | `shared/ipc.ts`(채널+`EngineUserSettingsResult`) → `handlers/engine.ts`(`handlePlain`) → `preload/index.ts` → `shared/api/ipc.ts` / `docs/IPC_CONTRACT.md` §2.2-c + 총계 64 |
| 6 | 첫 부팅 시딩 — env 판별 provider 로 전문 verbatim, 부재/파싱 실패 폴백, 트리거 조건 불변 | ✅ | `scaffold.ts` `resolveSeed`+`classifyClaudeEnv`, `bootstrap.ts` `readUserClaudeSettings()` 주입. 테스트: bedrock/vertex/custom/anthropic 시딩·verbatim·폴백·기존 미개입 (scaffold.test.ts 8케이스) |
| 7 | edit 모드·add/update/delete IPC 회귀 없음 | ✅ | `engine-write.ts`·`useEngines`·`AgentEnvironmentView` 무변경(diff 0), edit 초기값/저장 경로 보존 |
| 8 | Esc·백드롭 닫기 | ✅ | 모달 `keydown` Esc(메뉴 열림 시 스킵) + 기존 백드롭 onClick 유지 |
| 9 | 게이트 + 신규 테스트 | ✅ | 아래 게이트 재실행 — lint 0 · typecheck 3종 0 · vitest 786 passed · node --test 24/24. 신규/갱신 3스위트 28 테스트 green |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 통과 (아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 |
| 레이어 경계 위반 0 | ✅ | — | `npm run lint`(boundaries v6) 0 에러 — scaffold(features)→claude-settings(adapters)는 허용 하향 |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT·plan/verify 한국어·표 형식 준수 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | `docs/AGENTS.md` 는 IPC 채널 수 정합화(57→64, 이미 낡아 있던 표기)만 — 비밀/일회성 정보 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** — 본 세션은 Electron 바이너리 403 환경이라 `npm run dev` 구동 불가. 확인 항목: 단일 화면·드롭다운 4아이템·custom 이름 활성·불러오기 버튼·Esc/백드롭·첫 부팅 시딩(sources/settings/claude 비운 뒤 재부팅) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # eslint --cache --fix — 0 에러
$ npm run typecheck               # node/web/test 3종 — 0 에러
$ npm test                        # vitest: 786 passed (101 files)
                                  #   3 suite fail = electron 바이너리 403 환경 제한
                                  #   (chat-turn.continuity · chat-turn.runtime-resilience ·
                                  #    history/writer — 0084~0089 계열 동일, 본 변경 무관)
$ node --test "scripts/"*.test.mjs  # 24 pass / 0 fail
```

## PHASES.md 정합성

- 본 건은 PR 머지 전 — PHASES 승격은 머지 후 수행(대상 PR 은 브랜치 `claude/engine-model-modal-redesign-mgxs0f`).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 시딩의 pretty-print 재직렬화(원문 포매팅 비보존)를 설계에 명시하지 못했다 — 구현자 코멘트 #3 으로 보완.
- 구현 단계: 드롭다운은 버튼+Popover 조합이라 방향키 순회 같은 리스트박스 수준 키보드 내비게이션은 없다(기존 앱 메뉴들과 동일 수준). 필요 시 후속.
- 검증 단계: 실기(Windows 실행·첫 부팅 시딩) 검증은 환경 제약으로 사람 확인 대기로 남는다.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 9/9, 게이트 green(환경 제한 3 suite 제외). PR 머지 + 사용자 시각/실기 확인 후 PHASES 승격.
