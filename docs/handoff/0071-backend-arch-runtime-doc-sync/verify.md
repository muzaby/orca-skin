# Verify — 0071-backend-arch-runtime-doc-sync

> 비기능(문서) = Claude plan→impl→verify 직접 수행. 코드 게이트 N/A(문서 전용) — 대체 검증은 정합 grep + 링크 유효성 + SSOT 인용.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0071-backend-arch-runtime-doc-sync` |
| 검증자 | Claude Code |
| 일자 | 2026-07-05 |
| 대상 커밋 | (push 후 기재) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| ⚠️ ① 빈 레거시 디렉토리(`ipc/`·`orchestration/`) | 타당 — `find` 로 파일 0 확인, 5-슬라이스 규약 위반 | 코드 정리 = 비범위, 후속 핸드오프 후보로 기록(파생 이슈 D1) |
| ⚠️ ② claude-code/ChatEvent/OrcaCapabilities 전역 잔존 | 타당 — grep 으로 다수 문서 확인 | naming-consistency = 비범위, 후속 핸드오프 후보(파생 이슈 D2) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | runtime-ipc §1 동시성 재작성(멀티세션·pending queue·장수명 채널·supervisor·coordinator, `pendingUserText`/`CapabilityBuilder`/단일 inflight 제거) | ✅ | `runtime-ipc.md:8-93` (§1.1 계층 개관·§1.2 상태·§1.3 장수명 채널·§1.4 pending queue held/flushed/consumed·§1.5 cap/LRU·§1.6 retry). 근거코드 `features/chat/pending-message-queue.ts:43-63`·`features/sessions/session-runtime.ts:74-78` |
| 2 | runtime-ipc §2 채널 총계 SSOT 인용(31/12 → 53/17) + 등록 패턴 헬퍼·버스 교체 | ✅ | `runtime-ipc.md §2.1`("총계는 IPC_CONTRACT §2 가 SSOT — 53 채널·17 도메인, 본 문서 재서술 안 함")·§2.4 버스 파이프라인(usage→history→title→relay). 구 `CapabilityBuilder.build()` 샘플 제거 |
| 3 | overview §3 5-슬라이스 트리 재작성 + §3.1 부트(Bootstrap·버스 순서) | ✅ | `overview.md` §3(`app/·features/·adapters/·contracts/·infra/`)·§3.1(`Bootstrap.start` a~h). 근거 `app/bootstrap.ts:131-281`. `capabilities/`·구 평면 `ipc/` 제거 |
| 4 | overview §2·§4 갱신(날짜·`claude.ts`·멀티세션 완료·경로 정정) | ✅ | `overview.md:4`(헤더 0071)·§4(`ClaudeAdapter`·`ExtensionBuilder`·`SessionRuntime+RuntimeSupervisor`·멀티세션 ✅·`infra/settings-store.ts`·마이그레이션 11·`features/extensions/mcp/store.ts`). Python uv 런타임 행 삭제(코드 부재 — `grep PythonRuntime` 0) |
| 5 | adapters·terms CapabilityBuilder→ExtensionBuilder(경로·타입 포함) | ✅ | `adapters.md:1`(제목)·`:70-72`(§1.4 개명 배너+본문)·`:41`(§1.3 TurnExtensions)·§3 참조·`terms.md:30`. 구명 병기 유지 |
| 6 | 참조 문서 갱신(채널·inflight) | ✅ | `docs/AGENTS.md:15`(53 채널·도메인)·`ARCHITECTURE.md:19`(ExtensionBuilder·NormalizedEvent)·`ux-domains.md:143`(SSOT 인용+링크 `../../` 정정)·`TRD.md:212`(단일 inflight 폐기→멀티세션 anchor) |
| 7 | 정합성 grep 0 + 링크 유효 | ✅ | 활성 문서(handoff 제외)에서 §1.4 `CapabilityBuilder`·`총 31/40 채널`·문제되는 `단일 inflight` 잔존 0(잔존은 의도적 flag 대상만). 링크 3종 유효(`IPC_CONTRACT`·`app/src/main/AGENTS.md`·spec typescript.md 존재) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | — | — | N/A(문서 전용) |
| 인수 기준 ↔ 문서/코드 대조 | ✅ | 이견 시 중재 | 7/7 충족 |
| 문서 형식/링크/한국어 | ✅ | — | 표·톤 유지, 상대링크 유효 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/PII 혼입 0(문서 편집) |
| 제품 의도 부합(정합화 vs 재설계) | ✖ 보조 | ✅ | 새 설계·Open Question 신설 0 — 사후 정식화만 |
| 후속 범위(빈 디렉토리·전역 개명) 착수 | ✖ 제안 | ✅ 결정 | 파생 이슈 D1·D2 로 제안 |

## 게이트 재실행 결과

```
문서 전용 — 코드 게이트 미해당. 대체 검증:
$ rg '단일 inflight|CapabilityBuilder|총 31 채널|40 채널' docs (handoff 제외)
  → 활성 arch/참조 문서 잔존 0 (runtime-ipc §1 배너의 "구 단일 inflight 폐기" 서술은 의도).
  → frontend/overview.md:34 상태관리 행은 의도적 비범위(state.md SSOT — D2 인접, flag).
$ find app/src/main/{ipc,orchestration} -type f → 0 (빈 디렉토리 — D1)
```

## 위생 검토 (AGENTS.md 변경 시)

- `docs/AGENTS.md` 1줄(채널 인벤토리 수치)만 변경 — 키/토큰/이메일/IP 패턴 0. 변동성/일회성/장문 혼입 0.

## PHASES.md 정합성

- PHASES "완료 이력" 표에 0071 행 승격(문서 정합, PR 없음 — 로컬 문서 작업). 형식 유지.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: 범위를 "구조/런타임 정합"으로 좁힌 판단은 옳았으나, adapters.md 의 개명 드리프트(claude-code/ChatEvent)가 §1.4 개명과 인접해 **부분 정합**이 됨(§1.4=신명, §1.2/1.5=구명 공존). 내부 일관성을 위해 §1.3 만 추가 정정, 나머지는 D2 로 명시 분리 — 문서 내 혼재를 배너로 표식.
- **구현 단계**: overview §4 의 Python uv 런타임 행은 코드 부재(삭제된 기능)로 판단해 행 제거 — 삭제 시점/사유는 git 이력 소관, 문서는 "코드 우선" 원칙으로 현행 코드에 맞춤.
- **검증 단계**: 실제 앱 실행/시각 검증은 문서 작업이라 무해당. 다만 런타임 서술의 **개념 정확성**은 코드 헤더 주석(pending-message-queue·session-runtime)에 1:1 근거했으나, 세부 이벤트 스키마(예: NormalizedEvent variant 별 sessionId 필드 유무)까지는 IPC_CONTRACT SSOT 에 위임 — 본 문서는 개념/불변식만 서술(의도).

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격.
- 후속(사용자 결정): **D1** 빈 레거시 디렉토리 정리(코드), **D2** claude-code/ChatEvent/OrcaCapabilities 전역 개명 정합(문서) — 각각 별도 핸드오프 후보.

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | `app/src/main/{ipc,ipc/chat,orchestration}` 빈 레거시 디렉토리(0062 잔재, 5-슬라이스 규약 위반) | 구현자 코멘트 ①·`find` | 코드 정리 핸드오프(디렉토리 제거 + lint boundaries 확인) | open(비범위) |
| D2 | `claude-code.ts`/`ClaudeCodeAdapter`/`ChatEvent`/`OrcaCapabilities` 전역 잔존(0016·0027 개명 미완) — adapters.md §1.2/1.5·claude-code-spec·GLOSSARY·PRD·provider-runtime | 구현자 코멘트 ②·grep | naming-consistency 문서 핸드오프 | open(비범위) |
