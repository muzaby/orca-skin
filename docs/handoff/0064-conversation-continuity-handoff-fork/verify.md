# Verify — 0064-conversation-continuity-handoff-fork

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 verify 는 **신구조 포팅본**을 검증한다 — 원 구현(r1~r5)은 브랜치 `claude/handoff-62-feedback-tp8t9j`(구 구조·구 번호 0062)에서 이루어졌고, main 의 0062(`main-feature-slices`) 재편과 충돌해 **최종 상태만 0064 로 재번호·이식**했다(`276d4d3`). 따라서 검증 대상 = (a) 인수 기준 9종의 기능 충족 + (b) 포팅 자체의 구조 정합(경로 번역·feature 경계·재번호).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0064-conversation-continuity-handoff-fork` |
| 검증자 | Claude Code |
| 일자 | 2026-07-04 |
| 대상 커밋 | `276d4d3` (브랜치 r5 최종 상태의 신구조 포팅 squash) |
| 라운드 | 1 (포팅 기준; 원 구현은 r5 까지 진행) |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

plan `[구현자 기입]` 놓친 잠재 문제 #1~#7 + r2~r5 라운드 보고를 전수 확인했다.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| #1 cwd 계승(SDK 세션 파일 = cwd 인코딩 경로) | 타당 — 포팅본 유지 확인 | `app/chat-turn.ts:370` (continuityMeta.cwd 계승) |
| #2 라우트 싱크 draft 가드 | 타당 — 유지 확인 | `useChatRouteSync.ts:59,81` |
| #3 wire 실측 불가 → SDK dts 방어 구현(사용자 승인) | 타당 — 실기 시퀀스 확인은 사람 검증 항목 유지 | 책임 분리표 "UI/UX 시각 검증" |
| #4 fork draft 전송의 `__new__` 리셋 방지 | 유지 확인 | `chatStore.ts send()` |
| #5 compact_boundary 드롭 잠금 테스트 교체 | 유지 확인 | `claude-map.test.ts:488,681` |
| #6 ⚠️ handoff 도착 세션 title 초기값 | **r3 에서 해소됨**(initialTitle 마커 제목) — ⚠️ 종결 | `contracts/turn.ts:38`, `writer.ts:133` |
| #7 ⚠️ compact 요약 가시성 | **r3/r4 에서 해소됨**(PostCompact hook + extractCompactSummary) — 실기 확인만 잔여 | `claude-adapt.ts:176,190` |

r4 Open Question(핸드오프 템플릿 축약 여부 — 기본 압축 프롬프트가 구조를 강제해 ①~⑤ 지시가 사실상 중복)은 **미결로 유지**, 사용자 결정 대기.

## 요구사항 충족 매트릭스

> 원 plan 의 인수 기준 9종. 경로는 포팅 후 신구조 기준(구→신 번역표는 plan 상단 노트).
> 기준 8 의 "상시 노출"은 r3 에서 사용자 피드백으로 supersede(도넛 팝오버 제거, StatusPopover 단일화) — supersede 후 기준으로 대조한다.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | orchestration 서비스 재생성 — 백엔드 중립·경계 위반 0 | ✅ | `features/orchestration/{fork,handoff}.ts` (구 L1 → **feature 슬라이스**로 위치 번역 — eslint `features/*` 와일드카드라 설정 무변경). prod 파일 engine 리터럴 0(`grep claude\|opencode` 무일치, 테스트 seed 제외). `npm run lint` boundaries+no-cycle 통과 |
| 2 | handoff 자동 메시지 템플릿(순수 함수·보간·폴백) | ✅ | `features/orchestration/handoff.ts:18` `buildHandoffMessage` + `handoff.test.ts` 4건(보간·null/공백 폴백 id 8자·`/compact [핸드오프]` 접두·구조 지시) |
| 3 | DB lineage(테이블·쿼리·회귀 테스트) | ✅ | `infra/db/migrations/0011_session_lineage.sql`(child PK·relation·CASCADE), `infra/db/queries.ts:538,542,548`(insertLineage/getLineage/copyMessagesToSession), `features/orchestration/fork.test.ts` 3건(복사 idx 보존·fork_boundary 마커·원본 무변경) |
| 4 | fork — 분기 아이콘·draft 뷰·lazy 물질화·display 복사 | ✅ | `MessageMeta.tsx:10-34`(마지막 어시스턴트 턴 한정, `AssistantTurn`/`Exchange` isLast 전파) · `chatStore.ts:689 startForkDraft`(DOM draft 만·프리필+fork_boundary 합성) · `chat-turn.ts:568-575`(TurnRequest.forkFrom) · `fork.ts:19 materializeContinuityArrival`(fork 만 복사+마커+lineage) · `chat-turn.continuity.test.ts` fork 케이스([user,assistant,fork_boundary,user] idx 정렬·원본 무변경) |
| 5 | handoff — rebind(즉시 물질화·자동 메시지·복사 없음) | ✅ | `chatStore.ts:740 startHandoff` · `chat-turn.ts:308-324`(effectiveText 대체 + 턴 시작 전 조기 에코 r4) · `fork.ts`(relation!=='fork' 복사 없음) · `chat-turn.continuity.test.ts` handoff 케이스(복사 0·마커 제목·lineage handoff) |
| 6 | compact_boundary 정규화 | ✅ | `claude-map.ts:166-181`(`system/compact_boundary`→`session.compacted`) + r5 스냅샷 무효화/출력토큰 근사(`:36-39,399`) · `writer.ts:248-263`(compact_boundary 파트 영속) · `CompactBoundaryMarker.tsx` · `claude-map.test.ts:681` describe · `IPC_CONTRACT.md` §3 `session.compacted` 행 |
| 7 | IPC + 어댑터(forkFrom/handoffFrom·forkSession·신규 채널 0) | ✅ | `protocol.ts:69-76`(zod 상호배타·새 세션 전용 refine) + `protocol.send.test.ts` · `adapters/turn.ts:82 forkFrom` · `claude.ts:298-299`(resume+forkSession) + `claude.fork.test.ts` · **CHANNELS diff 0**(`git diff b28d005..HEAD -- src/shared/ipc.ts` 에 채널 추가 없음 — 총 54 유지) |
| 8 | 트리거/가드 (r3 supersede 후: StatusPopover 단일 권장 액션 + 가드 3종) | ✅ | `StatusPopover.tsx:8`(warn=/compact·danger=핸드오프) · `Composer.tsx:229-236`(가드 3종: 확정 세션 · mid-turn inflight · 사용자 턴 2회 미만) · `chat-turn.ts:276`(mid-turn main 이중 방어) · 도넛 팝오버 핸드오프 제거(r3) `Composer.tsx:650` |
| 9 | 불변식 + 게이트 | ✅ | fork=클릭 draft 만·첫 보내기 물질화(`chatStore.ts:465`) · handoff=클릭 즉시(`startHandoff`) · 실패 시 출발 세션 무변경(`chat-turn.ts:262-286` 가드 조기 return) · 주석 문서화 · 게이트 전부 green(아래) |

### 포팅 정합 검증 (본 라운드 고유)

| 항목 | 충족 | 증거 |
|---|---|---|
| 재번호 0062→0064 — continuity 참조만 변경, main 의 0062(feature-slices) 참조 보존 | ✅ | `grep -rn 0062 app/src` 잔여 = feature-slices 참조 5곳뿐(misc.ts:74·builder.ts:7,37·idle-close-timer.ts:6·usage/subscriber.ts:2 + AGENTS/writer/turn-coordinator 의 재편 문맥) |
| feature 교차 import 0 — history→orchestration 결합 절단 | ✅ | `writer.ts:14-22 ContinuityArrivalHook`(구조적 포트) + `bootstrap.ts:242-246` 주입(해소책 (b)+(c), `src/main/AGENTS.md` 규칙 부합). lint boundaries 통과 |
| 경로 번역 완전성 — 구경로 import 잔존 0 | ✅ | `grep "from '(../)+(db\|lifecycle\|cost\|usage\|settings\|orchestration\|ipc/chat)/"` 무일치(infra/db 상대경로 제외). typecheck 3종 green |
| 0060(steer)와의 의미 결합 — 훅 합성·text 결합 | ✅ | `claude.ts:325-332` `withPostCompactHook(mergeHooks(adaptHooks, steerGate))` · `chat-turn.ts:571` `text: steerCarryover ? carry+effectiveText : effectiveText`(steer 이월=resume 경로 ↔ continuity=새 세션 경로 상호배타 — 주석 명기). steer 테스트(steer-replay·steer-queue·coordinator) 전부 green |
| 통합 테스트 신구조 이식 | ✅ | `app/chat-turn.continuity.test.ts` — TypedBus 구독(history critical→relay) + `HistoryWriter(db, hook)` 주입 = bootstrap 배선과 동형. 2건 green |
| 문서 정합 — INDEX·GLOSSARY·IPC_CONTRACT·설계서·AGENTS | ✅ | INDEX 0064 행(포팅 이력 명기) · GLOSSARY Fork/Handoff/Lineage 신경로 · IPC_CONTRACT §2.1/§3 0064 표기 · 설계서 §A.4 코드 안착 노트 신경로 · `src/main/AGENTS.md` orchestration 슬라이스 등재 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 green (아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 + 포팅 6/6 |
| 레이어 경계 위반 0 | ✅ | — | boundaries+no-cycle 0 (신규 슬라이스 orchestration 포함) |
| 문서 형식/링크/한국어 | ✅ | — | 이상 없음 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 무검출 — 구조 규칙만 추가 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| Open Questions | ✖ | ✅ | 핸드오프 템플릿 축약 여부(r4) — 사용자 결정 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** — r5 재테스트 체크 3종(도넛 하락·원본 열기·분기 구분선) + fork/handoff 실기 E2E |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 (SDK 옵션+슬래시 명령만) |
| PR 머지 승인 | ✖ | ✅ | 대기 (push 미수행) |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # eslint --cache --fix ./src → 위반 0
$ npm run typecheck               # node·web·test 3종 모두 통과
$ npm test                        # vitest run
 Test Files  90 passed (90)
      Tests  675 passed (675)     # 브랜치 r5 시점 662(88파일) 대비 +13 — main 측 0060 D3~D5·0062 재편 테스트 합류
```

환경 노트: better-sqlite3 Node ABI 재빌드(`npm rebuild better-sqlite3`) 후 electron 계열 2 suite 포함 전 suite 실행 — 0050~0063 검증에서 제외되던 electron-import suite 까지 이번엔 green.

## 위생 검토 (AGENTS.md 변경 시)

- `app/src/main/AGENTS.md` 변경 = features 목록에 `orchestration` 추가 + 슬라이스 역할 1 문단. 키/토큰/이메일/IP 패턴 스캔 무검출.
- 변동성/일회성 정보 혼입 없음(구조 규칙만).

## PHASES.md 정합성

- 0064 행을 페이즈 표에 승격(0063 행 다음), INDEX 는 verify/PASS 로 갱신 — 본 검증 커밋에 포함.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 포팅은 별도 plan 없이 원 plan 에 번역표 노트로 갈음했다 — 규모(60파일)를 감안하면 포팅 자체의 인수 기준(경로 잔존 0·교차 import 0 등)을 사전에 명문화했으면 매트릭스가 더 기계적이었을 것.
- 구현 단계: `git merge` rename 감지에 의존한 자동 병합 구간(renderer 전체·queries.ts 등)은 게이트+테스트로만 검증했다 — 자동 병합이 조용히 잘못 합쳤을 가능성은 675 테스트가 방어하지만, 라인 단위 수동 대조는 충돌 8건에 한정했다.
- 검증 단계: wire 실측(compact 시퀀스·echo)은 이 환경 제약으로 여전히 불가(r1 부터 동일 계열) — 실기 확인이 유일한 잔여 경로다. 도넛 근사(r5 ①)의 outputTokens 상시 제공 전제도 실기 대상.

## 결론 / 다음 단계

- **PASS** — 인수 9/9(기준 8 은 r3 supersede 기준) + 포팅 정합 6/6, 게이트 lint/typecheck(3종)/test **675 passed(90파일)** green, 신규 의존성 0, 신규 IPC 채널 0.
- PHASES 승격 + INDEX verify/PASS 갱신(본 커밋).
- 사람 확인 대기: ① r5 재테스트 체크 3종 + fork/handoff 실기 E2E(wire log 포함) ② 핸드오프 템플릿 축약 여부(Open Question) ③ PR 머지·push.
