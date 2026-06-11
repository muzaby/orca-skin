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
| `0010-agent-model-select`       | verify | PASS      | —          | c193166   | 2      | 검증 PASS(r2) — 인수 **15/15** 충족, 게이트 lint/typecheck/test **349/349 (48파일)** 통과(Node ABI 재빌드로 `db/queries.test.ts` 포함 전체 green), 레이어 경계 0, 신규 의존성 0. r1 FAIL 사유(공유 헬퍼 `insertSession` 오염→`0006_turn_usage` 마이그레이션 테스트 회귀)를 r2 가 0005 스키마용 인라인 INSERT 로 해소(`queries.test.ts` 1파일·프로덕션 무변경). `${adapter}-${provider}` 합성 키 + `orca:agent:list`(도메인 `agent`, 38→39) + Composer 모델 UI(턴 단위·라이브 채널 없음) + 세션 adapter 잠금·provider 턴 전환·`provider_key`(마지막 사용) 영속·secret store 토큰(DB 비밀 0) + `authToken` 리네임 + `/agents` 동적화 + mock 빗금 규약 + 문서 6건. PHASES 승격. (대상 커밋 INDEX 기재 r1 `c2a90d8`→실 `0a3c043`, r2 `ecf9752`→실 `c193166`, 위생 노트 ①) 사람 확인 대기: 시각 검증·실환경 bedrock/secret store 토큰 (verify §책임 분리). |

| `0011-main-decompose`           | verify | PASS      | —         | 5e835f7   | 1      | 단계적 아키텍처 리팩토링 스테이지 1/3 (백엔드). router.ts 1,070→139줄 분해(handlers/ + chat/) + TurnRegistry sessionId 키잉(멀티세션 토대 — 동시 세션 턴 허용) + getSessionById(N+1 제거) + closeDb 와이어 + config/crypto 이동 + 레거시 1회성 이전 제거(사용자 결정). 게이트 4종 ✅ test 351/351. 비기능 = Claude 직접 구현. 사람 확인 대기: GUI 회귀(채팅·승인·취소). |

| `0012-ipc-cleanup`              | verify | PASS      | —         | 03cc1f5   | 1      | 단계적 아키텍처 리팩토링 스테이지 2/3 (IPC). runtime 고아 3채널 제거(사용자 결정 — 채널 39→36, RuntimeStatus 타입 main 이동) + `ipc/registry.ts` handle 헬퍼로 전 invoke 채널 safeParse 단일 경로(실패 정책 'reject'/{fallback} 등록부 명시 — 동작 변경 0) + IPC_CONTRACT 전면 동기화(agent §2.2-b 편입·§4 ErrorCategory 정정). 게이트 4종 ✅ 351/351. 비기능 = Claude 직접 구현. |

| `0013-renderer-multisession-store` | verify | PASS | —    | bce274f   | 1      | 단계적 아키텍처 리팩토링 스테이지 3/3 (프론트엔드). chatStore 멀티세션 외피(sessions Record + activeKey + NEW_CHAT_KEY 승격 — main TurnRegistry 대칭, 사용자 결정) + ev.sessionId 키 라우팅(비활성 세션 백그라운드 누적·활성 UI 격리) + sessionCache/LOAD_SESSION_FROM_CACHE 폐기(Record 가 캐시 흡수) + Backend/Sessions/Projects/Cost Context 4종 → Zustand store(bootstrap-only Provider). reducer 무변경(키 라우팅은 store — state.md §1.4 개정). 게이트 4종 ✅ 354/354. 비기능 = Claude 직접 구현. 사람 확인 대기: GUI 시각 회귀 + 멀티세션 실기. |

> 새 작업: 마지막 일련번호 +1 로 행을 추가하고 `<NNNN-slug>/plan.md` 를 생성한다.
