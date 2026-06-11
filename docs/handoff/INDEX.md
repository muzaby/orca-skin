# 디스패치 보드 (Claude Code ↔ Codex)

> **두 에이전트 모두 착수 전 이 표를 가장 먼저 읽고, 작업 후 갱신한다.** "지금 누구 차례인가"의 단일 진실원.
> 상태 머신·절차 정본은 [`AGENTS.md`](AGENTS.md). 완료된 작업은 [`../PHASES.md`](../PHASES.md) 표로 승격된다.

## 단계 / 상태 범례

- **단계**: `plan` → `impl` → `verify`
- **상태**: `DRAFT` · `READY` · `IN_PROGRESS` · `IMPL_DONE` · `PASS` · `FAIL`
- **다음 주체**: `Claude` (설계/검증) · `Codex` (구현) · `—` (종료)

## 활성 / 이력

| slug                            | 단계   | 상태      | 다음 주체 | 대상 커밋 | 라운드 | 비고                                                                                                                                                                                                                                               |
| ------------------------------- | ------ | --------- | --------- | --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001-handoff-bootstrap`        | verify | PASS      | —         | 78f1601   | 1      | 협업 인프라 자체 부트스트랩. Claude 단독 수행(설계+구현+검증).                                                                                                                                                                                     |
| `0002-cost-token-tracking`      | verify | PASS      | —         | 999c99b   | 1      | 비용·토큰 추적. 14/14 충족, 게이트 260/260. 스키마 통일(`usage_events`→`turn_usage`+`turn_model_usage`) + 모델별 영속 + 일/주/월 누적(main 싱글턴 + renderer 미러). PHASES 승격. (대상 커밋 INDEX 기재 `4213cad`→실 `999c99b`, verify 위생 노트 ①) |
| `0003-debug-panel-mock-adapter` | verify | PASS      | —         | 5ef793c   | 1      | 검증 PASS — 인수 18/18 충족, 게이트 4종(lint/typecheck/test 273/build) 통과, prod dead-code 제거·레이어 경계 0 확인. IPC_CONTRACT(§2.13 debug 도메인 신설·총 37·§3 permission.resolved 발행 주체) + layers(features/debug·FloatingPanel) 갱신 완료. PHASES 승격. (대상 커밋 INDEX 기재 `78f1601`→실 `5ef793c`, verify 위생 노트 ①) |
| `0004-auto-session-title`       | verify | PASS      | —         | ba36b8d | 1      | 검증 PASS — 인수 9/9 충족, 게이트 3종(lint/typecheck/test 283) 통과, 레이어 경계 0, 신규 의존성 0. Haiku 1-shot 제목 요약 + `title_source`(0007) rename 보호 + `SessionAdapter.complete` seam + `sessionTitleEvent` 전-창 push. IPC_CONTRACT 37→38. PHASES 승격. (대상 커밋 INDEX 기재 `9c4f1a1`→실 `ba36b8d`, verify 위생 노트 ①) 사용자 피드백 3건은 `0005` 로 후속. |
| `0005-title-completion-fixes`   | verify | PASS      | —         | c13bd44 | 1      | 0004 사용자 피드백 반영(모델 별칭 `'haiku'` · `settingSources` 제거 · `complete` 호출 경로 정리). 인수 6/6, 게이트 3종(283 tests) 통과. **비기능 작업 = Claude 구현** 규칙 첫 적용. 사람 확인 대기: 실환경 haiku 사용·settings env 적용 (verify §책임 분리). |
| `0006-composer-status-line`     | verify | PASS      | —         | 393c8c8   | 1      | 검증 PASS — 인수 10/10 충족, 게이트 3종(lint/typecheck/test 286) 통과, 레이어 경계 0(cost 는 page 주입), 신규 의존성 0, 카피 표 1:1. Tier1 pill + Tier2 팝오버 presentational 셸 + view-model 순수함수 + 임시 상태근사 TODO. PHASES 승격. (대상 커밋 INDEX 기재 `b94cc76`→실 `393c8c8`, verify 위생 노트 ①) 사람 확인 대기: 시각 검증·카피 어감 (verify §책임 분리). |

| `0007-transcript-render-memo`   | verify | PASS      | —         | a68e465   | 1      | 스트리밍 재렌더 범위 축소(성능) — 비기능 = Claude 직접 구현. `groupTurns` useMemo + 턴/메시지/마크다운 memo + `useSessionHandlers` deps 안정화(Sidebar memo 복원) + Header memo. CDP rAF 측정(35턴 mock): 최대 블로킹 549~614ms → 133~166ms. 게이트 lint/typecheck ✅, test 283/290 — 실패 7건은 better-sqlite3 ABI 환경(변경 무관, verify §게이트). PHASES 승격. 사람 확인 대기: 스트리밍 스크롤 시각 검증 (verify §책임 분리). |
| `0008-chat-anchor-reserve`      | verify | PASS      | —         | e113eb4   | 1      | 검증 PASS — 인수 12/12, 게이트 4종(lint/typecheck/test 315/electron-vite build) 통과, 레이어 경계 0, 신규 의존성 `zustand@^5`(사용자 승인). 스크롤 앵커링 CSS 예약공간 전환(Exchange + `min-h-[50cqh]`, 50% 미드라인 유지·여백은 다음 메시지까지 유지 — 사용자 결정) + Zustand chat store 선행 도입(델타→live, state.md §1.4 개정) + 커밋 경로 카드 격리(`reconcileSegments`) + `StreamingMarkdown` 꼬리 재파스. PHASES 승격. 사람 확인 대기: 시각 검증·재렌더 실측·cqh 실기 (verify §책임 분리). |
| `0009-orca-config`              | verify | PASS      | —         | 1deae14   | 1      | 검증 PASS — 인수 14/14 충족, 게이트 lint/typecheck PASS·범위 테스트 26/26, 레이어 경계 0(SDK 어휘 `CLAUDE_CODE_USE_*` 는 `adapters/claude-env.ts` 격리), 신규 의존성 0, IPC/preload/renderer/`shared` 변경 0. `~/.config/orca/orca.json` 템플릿 생성·3단 관용 파싱·main 싱글톤(`load/get/agentFor`) + claude-code env 매핑/합성(sendMessage·complete) + `${VAR}` 공용 확장(미해결 키만 드롭) + 문서 4건(TRD §6.8/standardization §5.1/security 예외/GLOSSARY). 전체 test 328/335 — 실패 7건은 better-sqlite3 ABI 환경 제한(`db/queries.test.ts`, 변경 무관, 0007 동일 계열). PHASES 승격. 사람 확인 대기: 실환경 bedrock/vertex·평문 apiKey 주입 (verify §책임 분리). |

> 새 작업: 마지막 일련번호 +1 로 행을 추가하고 `<NNNN-slug>/plan.md` 를 생성한다.
