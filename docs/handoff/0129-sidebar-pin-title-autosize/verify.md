# Verify — 0129-sidebar-pin-title-autosize

## 메타

| 항목 | 값 |
|---|---|
| slug | `0129-sidebar-pin-title-autosize` |
| 검증자 | Claude Code |
| 일자 | 2026-07-19 |
| 대상 커밋 | `e221077` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 선조치 #1 (마이그레이션 5곳 등록) | 타당 — 러너/테스트 하드코딩 목록은 append-only 관례와 별개로 동기화 필수 | AC2·게이트로 검증(vitest green) |
| 선조치 #2 (`projectCreate` 반환 `pinnedAt: null`) | 타당 — DTO 필수 필드 | typecheck:node green |
| 선조치 #3 (ProjectCard 중첩 버튼 회피) | 타당 — HTML 유효성 | AC6 로 검증 |
| 선조치 #4 (고정 섹션 cross-feature app 주입) | 타당 — 4-layer 준수 | 레이어 경계 lint 0 error |

모든 선조치가 ✅(구현·보고) 범위 — Open Question·신규 의존성·제품 의도 변경 없음(단독 결정 경계 준수).

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 제목 편집 자동 너비(min/max·기존 동작 유지) | ✅ | `shared/ui/RenameInput.tsx`(`autoSize`+`[field-sizing:content]`+`min-w-[3ch]`+`size=1`, keydown/focus/select 불변) · `ChatTitleBar.tsx:116`(flex-1 제거·`autoSize`) · `SessionRow.tsx:97`(`autoSize`) |
| 2 | `pinned_at` 컬럼(0015) + DTO `pinnedAt` | ✅ | `migrations/0015_pinned.sql` · `db/types.ts`(`SessionListRow`·`ProjectRow`) · `ipc/dto.ts`(`toSessionListItem`·`toProject`) · `shared/ipc.ts`(`SessionListItem`·`Project`) · DB 왕복 테스트 `queries.test.ts` "pinned (0129)" 2 케이스 green |
| 3 | setPinned IPC 2 + store 토글·갱신 | ✅ | CHANNELS `sessionSetPinned`·`projectSetPinned` · `protocol.ts` 스키마 2(`protocol.pin.test.ts` 5 케이스) · `handlers/{session,project}.ts`(`Date.now()`/null) · preload·`api/ipc.ts` · store `setPinned`(refresh) |
| 4 | "고정됨" 섹션(프로젝트 접기펼치기 + 고정 대화) | ✅ | `PinnedSection.tsx`(고정 세션 useMemo 파생·프로젝트 `chevR/chevD` 토글·`useProjectSessions` 지연 조회) · `Sidebar.tsx`(pinnedSlot, 항목 0 시 null → 헤더 숨김) |
| 5 | 대화 말풍선·프로젝트 폴더 아이콘(고정됨+최근) | ✅ | `SessionRow.tsx`(`leadingIcon='chat'` 기본, 렌더·편집 양 분기) · `PinnedSection.tsx`(프로젝트 `folder`) |
| 6 | 4개 표면 고정 토글 + 상태 반영 | ✅ | `ChatTitleBar.tsx`(pin 버튼 `pressed` + kebab MenuItem) · `SessionRow.tsx`(kebab pin MenuItem) · `ProjectInfoHero.tsx`(핀 버튼 onClick+pressed) · `ProjectsScreen.tsx`(ProjectCard hover 토글) |
| 7 | 게이트 lint+typecheck | ✅ | 아래 §게이트 |
| 8 | IPC_CONTRACT/PHASES/INDEX 갱신 | ✅ | `docs/IPC_CONTRACT.md`(session 7·project 6·총 69) · `docs/PHASES.md` 행 · `docs/handoff/INDEX.md` |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 error / typecheck 3분할 / vitest 1042 pass |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 충족 |
| 레이어 경계 위반 0 | ✅ | — | boundaries 0 error(고정 섹션 props-only) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT/PHASES/INDEX 정합 |
| AGENTS.md 위생 스캔 | ✅ | ✅ 최종 | AGENTS.md 미변경 — 스캔 대상 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기(시각 실기) |
| Open Questions | ✖ | ✅ | 없음(핵심 2건 사전 확정) |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint            # ✅ 0 error (1 pre-existing warning: useTranscriptVirtualizer, 무관)
$ npm run typecheck                 # ✅ typecheck:node / :web / :test 전부 통과
$ ./node_modules/.bin/vitest run    # ✅ Test Files 132 passed | 1 failed(로드), Tests 1042 passed
```

- `chat-turn.continuity.test.ts` **파일 로드 실패**는 `Electron failed to install correctly`(egress 403)
  베이스라인(`app/AGENTS.md` — electron 바이너리 다운로드 차단). 본 변경 무관(마이그레이션 배열에
  0015 만 추가). 테스트 **어서션은 0 실패**.
- `npm test`(pretest = better-sqlite3 Node ABI 보장)는 미실행 — 대신 Node ABI rebuild 후
  `vitest run` 으로 DB 스위트 포함 전체를 실행해 green 확인(0129 pin 왕복 2 케이스 포함).

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 계열 파일 미변경 — 키/토큰/이메일/IP 스캔 대상 없음.
- 문서 변경(IPC_CONTRACT/PHASES/INDEX/plan/verify)은 규칙·형식·한국어 컨벤션 준수, 비밀·일회성
  운영정보 혼입 없음.

## PHASES.md 정합성

- 페이즈 표에 0129 행 추가(범위·게이트 결과·커밋 pending → 아래 verify 커밋 hash 로 확정). 상태
  머신상 `verify/PASS` 이후 INDEX 갱신과 정합.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 마이그레이션을 러너/테스트 5곳에 하드코딩 등록해야 하는 점을 plan 자료조사에 명시하지
  못했다(구현 중 선조치로 해소). 다음 마이그레이션 핸드오프는 이 5-지점 체크리스트를 plan 에 미리 둔다.
- 구현 단계: `field-sizing:content` 는 헤드리스에서 시각 회귀를 볼 수 없어 min/max 폭 폴백으로
  방어했다 — 실제 가변 폭·0폭 붕괴 부재는 사람 실기 확인 필요.
- 검증 단계: DB 왕복·스키마는 vitest 로 기계 검증했으나, 사이드바 접기펼치기·4개 표면 토글·행 아이콘의
  **시각/상호작용은 electron dev 미실행(egress)** 으로 자동 검증 불가 — 사람 몫으로 분리.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격 완료. 인수 기준 8/8 기계 충족, 게이트 green, 레이어 경계 0, 신규 의존성 0.
- 사람 확인 대기(비차단): 제목 편집 가변 폭 · "고정됨" 접기/펼치기 · 4개 표면 고정 토글 · 행 아이콘의
  시각 실기, PR 머지 승인.
