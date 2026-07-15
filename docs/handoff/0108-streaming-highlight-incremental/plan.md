# Plan — 0108-streaming-highlight-incremental

## 메타

| 항목 | 값 |
|---|---|
| slug | `0108-streaming-highlight-incremental` |
| 작성자 | Claude Code |
| 일자 | 2026-07-15 |
| 매핑 | 성능 시리즈 2/4 (0107~0110) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "응답없음, 동기대기 등의 앱 사용 경험을 저해하는 성능 저하 요소들을 찾아라. 수정 방안을 마련하라" + "전체 4유닛 순차" 구현 확정 | 라이브 세션 요청 (2026-07-15) |
| 추론 의도 | 스트리밍 중 체감 jank 제거가 renderer 측 1순위라는 판단은 조사 기반 내 해석 | 조사 결과 심각도 산정 |

## Context (왜)

renderer 스트리밍 파이프라인은 0007(재렌더 memo)·0008(블록 분할 memo)·0102(가상화)로 잘 다듬어져 있으나, **열린 펜스 코드블록**이 남은 최대 핫패스다: `splitStableBlocks` 는 펜스 내부에서 stable 경계를 만들지 않으므로(의도된 보수성) 스트리밍 중 코드블록 전체가 매 rAF 프레임 tail 에 남고, `CodeBlock` 의 effect 가 프레임마다 자라는 코드 전체를 동기 `codeToHtml` — 스트리밍 전체로 O(n²). 게다가 stale 판정으로 plain↔색상이 프레임마다 교대(플리커)한다. 부수적으로 분할 자체도 매 프레임 전문 `split('\n')`+스캔(비증분)이며, 사이드바 `SessionRow` 미memo·CodeBlock 별 MutationObserver·DiffBody 무memo 가 저비용 개선 대상.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| CodeBlock effect 가 `[code, safeLang, theme]` deps 로 매 code 변화마다 전체 `codeToHtml`(동기) + stale 시 plain 폴백 렌더 | `app/src/renderer/src/shared/ui/markdown/CodeBlock.tsx:85-102` (변경 전) |
| 열린 펜스 동안 stable 미확정 → 블록 전체가 tail 재파스 | `features/chat/lib/markdownBlocks.ts:40-50` |
| tail 시작점은 항상 펜스 밖(경계는 fence=null 인 빈 줄에서만) → suffix 재스캔 = 전체 스캔 동치 | `markdownBlocks.ts:40-70` 스캐너 상태 분석 |
| 델타는 rAF 코얼레싱(프레임당 1렌더) — 하이라이트 비용만 남은 병목 | `features/chat/lib/eventCoalescer.ts` |
| 사이드바 목록은 `listSessions(limit=50)` 상한 → 가상화 불요, memo 로 충분 | `app/src/main/infra/db/queries.ts:436` |
| 제목 이벤트는 행 in-place 패치 — 비변경 항목 참조 보존 → `memo` 즉시 적중 | `features/sessions/store/sessionsStore.ts:45-51` |
| SessionRow 핸들러 props 는 0007 에서 안정화 | `docs/handoff/INDEX.md` 0007 행 |
| CodeBlock 인스턴스마다 documentElement MutationObserver | `CodeBlock.tsx:143-152` (변경 전) |
| DiffBody `diffLines` O(n·m) 가 render 본문 무memo (ToolCard memo + 펼침 게이트로 완화) | `tool-bodies/DiffBody.tsx:71,121` (변경 전) |
| renderer 에 컴포넌트 테스트 인프라 없음(.test.tsx 0) — UI 는 시각 검증 갈음 | `app/AGENTS.md` 에이전트 원칙 4 |

## 인수 기준 (Acceptance Criteria)

1. 스트리밍 tail 에서 렌더되는 `CodeBlock` 은 shiki 하이라이트를 실행하지 않고 plain `<pre>` 를 유지한다 (플리커 0). 블록이 stable 로 승격되거나 커밋 렌더로 교체되면 1회 하이라이트된다.
2. 스트리밍 컨텍스트는 `MarkdownStreamingContext`(shared/ui/markdown)로 전달되고, `StreamingMarkdown` 이 tail 렌더만 Provider(true)로 감싼다 — stable 블록·비스트리밍 Markdown 은 기본 false.
3. `advanceStableBlocks(cache, source)` 가 append 시 확정 prefix 를 재스캔하지 않으며, **임의 청크 크기 append 시퀀스에서 `splitStableBlocks`(전문)과 결과 동치** (property 테스트).
4. 비-append 입력(소스 교체·수축)은 전체 재계산 폴백 (단위 테스트).
5. `SessionRow` 가 `memo` 로 감싸져 제목 이벤트 시 변경 행만 재렌더된다 (전제: store in-place 패치 — 조사 확인).
6. CodeBlock 의 테마 감지가 모듈 싱글톤 observer(`themeStore` + `useSyncExternalStore`)로 통합된다.
7. `DiffBody` 의 `buildPairs`/`buildDiffLines` 가 `useMemo` 로 감싸진다.
8. 게이트: lint 0 error · typecheck 3종 0 · markdownBlocks 스위트 green.

## 범위 / 비범위

- **범위**: 위 7항 + 테스트.
- **비범위**: 라인 증분 하이라이트(shiki 그레인이 문서 단위 — 복잡도 대비 이득 없음), 디바운스 하이라이트(플리커 잔존 + 주기적 O(n) 재지불 — 기각), 사이드바 가상화(LIMIT 50 — 불요), 트랜스크립트 구조 변경.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 채택 라이브러리만 사용: shiki(싱글톤 highlighter 유지), react `useSyncExternalStore`/`createContext`. **신규 의존성 없음**.
- 전제: 스트리밍 소스는 append-only(0008 확립) — 예외는 폴백으로 방어.

## 설계

1. **`shared/ui/markdown/streamingContext.ts`(신규)**: `MarkdownStreamingContext = createContext(false)`.
2. **`StreamingMarkdown.tsx`**: `useRef<StableBlocksCache>` + `useMemo(source)` 로 `advanceStableBlocks` 사용, tail 을 Provider(true)로 감싼다. stable 승격 시 새 `<Markdown>` 인스턴스(컨텍스트 밖)가 마운트되며 자연히 1회 하이라이트.
3. **`CodeBlock.tsx`**: `useContext(MarkdownStreamingContext)` — `streaming || safeLang==='text'` 면 effect skip(기존 plain 폴백 경로). deps 에 `streaming` 추가로 false 전환 시 1회 실행.
4. **`markdownBlocks.ts`**: `advanceStableBlocks` — `source.startsWith(cache.source)`(네이티브 prefix 비교) 확인 후 `splitStableBlocks(source.slice(cache.consumed))` 재사용, 결과를 `cache.stable` 에 이어붙임. stable 미증가 프레임은 기존 배열 참조 유지(memo 친화). 동치 안전 근거: tail 시작점의 스캐너 상태는 항상 fence=null.
5. **`themeStore.ts`(신규)**: 모듈 스코프 observer 1개 + listener Set, `subscribeTheme`/`getThemeSnapshot`. CodeBlock 의 `useThemeId` 를 `useSyncExternalStore` 로 교체.
6. **`SessionRow.tsx`**: `memo()` 래핑. **`DiffBody.tsx`**: 계산 2곳 `useMemo`.

레이어 경계: streamingContext/themeStore 는 shared/ui(범용 atom), advanceStableBlocks 는 features/chat/lib — features→shared 하향만. 위반 없음.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **시각 변화(의도)**: 스트리밍 중 코드가 plain 으로 보이다가 펜스 닫힘/완료 시 색상 1회 전환. 기존은 프레임마다 plain↔색상 교대였으므로 순개선이나 "타이핑 중 색 없음"은 사용자가 인지할 변화 — 시각 검증 항목.
- tail 안의 **이미 닫힌 펜스**(빈 줄 미도래로 미승격)도 스트리밍 동안 plain 유지 — 승격/커밋 시 하이라이트(결정적).
- 인라인 코드·비코드 마크다운은 무영향(effect 는 fenced CodeBlock 만).
- 테마 토글: themeStore 통지로 전 CodeBlock 재하이라이트(기존과 동일 동작), 스트리밍 중 블록은 plain 이라 무비용.
- 접근성/키보드: DOM 구조 무변경.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 증분 분할 버그 = 렌더 내용 자체 훼손 | 전문 동치 property 테스트(청크 크기 5종) + 비-append 폴백 |
| 스트리밍 중 plain 코드 노출 | 의도된 트레이드오프(플리커 제거·O(n²) 해소) — 시각 검증으로 사람 확인 |
| themeStore observer 는 앱 수명 동안 유지 | 단일 observer 로 인스턴스 N개 → 1개 감소 — 수용 |

- 되돌리기 어려운 결정: 없음.
- Open Question: 없음.

## 영향 받는 파일

- `app/src/renderer/src/shared/ui/markdown/{CodeBlock.tsx, streamingContext.ts(신규), themeStore.ts(신규)}`
- `app/src/renderer/src/features/chat/lib/markdownBlocks{,.test}.ts`
- `app/src/renderer/src/features/chat/components/markdown/StreamingMarkdown.tsx`
- `app/src/renderer/src/features/sessions/components/SessionRow.tsx`
- `app/src/renderer/src/features/chat/components/transcript/tool-bodies/DiffBody.tsx`

## 참고 문서

- `docs/arch/frontend/` §6.9 Streaming lifecycle · 0007/0008/0102 핸드오프
- IPC 변경: 없음

## 게이트

- `cd app && npm run lint && npm run typecheck` + `vitest run src/renderer/src/features/chat/lib/markdownBlocks.test.ts`.
- 신규 테스트: 동치 property·폴백·참조 유지 (순수 변환기).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 출처 인용, 추론 표기.
- [x] 자료조사 — 전 발견 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 신규 의존성 없음.
- [x] 파생 UX — 시각 변화·tail 닫힌 펜스·테마 전개.
- [x] 리스크 — 동치 훼손 리스크와 테스트 완화.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: "스트리밍 중 plain 고정" 채택 — 디바운스/라인 증분 기각 근거 유지.
- 이견 / 우려: 없음. 컴포넌트 렌더 테스트는 인프라 부재(.test.tsx 0)로 저장소 규칙(UI=시각 검증)에 따라 생략 — 순수 로직(분할)만 테스트로 고정.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 모듈 로드~첫 구독 사이 테마 변경 시 themeStore 초기 스냅샷이 stale 할 수 있음 | ✅ `ensureObserver` 가 observer 생성 시점에 `pickTheme()` 재샘플 | `themeStore.ts` |
| 2 | stable 미증가 프레임마다 새 배열 생성 시 stable `<Markdown>` memo 는 유지되나 map 재실행 낭비 | ✅ 미증가 시 기존 `cache.stable` 참조 반환(테스트 고정) | `markdownBlocks.ts` |

## [구현자 기입] 구현 체크리스트

- [x] streamingContext + StreamingMarkdown Provider(tail 한정)
- [x] CodeBlock streaming 가드 + deps
- [x] advanceStableBlocks + 동치/폴백/참조 테스트 3건
- [x] themeStore 싱글톤 + useSyncExternalStore
- [x] SessionRow memo · DiffBody useMemo

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 전부 (신규 2) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `vitest run …markdownBlocks.test.ts` |
| 게이트 결과 | lint ✅ 0 error(경고 1=0102 기지) / typecheck 3종 ✅ / markdownBlocks 11/11 ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 INDEX 기재) |
