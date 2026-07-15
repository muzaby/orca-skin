# Verify — 0108-streaming-highlight-incremental

## 메타

| 항목 | 값 |
|---|---|
| slug | `0108-streaming-highlight-incremental` |
| 검증자 | Claude Code |
| 일자 | 2026-07-15 |
| 대상 커밋 | `2dd1e35` |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 컴포넌트 렌더 테스트 인프라 부재 → 순수 로직만 테스트 | 타당(저장소 규칙: UI=시각 검증) | 책임 분리표에 시각 검증 항목 |
| 선조치 ✅ #1: themeStore 초기 스냅샷 stale 가능성 → observer 생성 시 재샘플 | 타당 | 매트릭스 #6 |
| 선조치 ✅ #2: stable 미증가 프레임 배열 참조 유지 | 타당(memo 친화) — 테스트 고정 | 매트릭스 #3 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 스트리밍 tail 의 CodeBlock 은 shiki skip(plain 유지·플리커 0), 확정/커밋 시 1회 하이라이트 | ✅ | `CodeBlock.tsx` effect 가드 `safeLang==='text' \|\| streaming` + deps `streaming`(false 전환 시 1회 실행). stable 승격 = 새 `<Markdown>` 인스턴스(Provider 밖) 마운트 |
| 2 | 컨텍스트 전달 — tail 만 Provider(true) | ✅ | `streamingContext.ts`(신규, shared/ui) + `StreamingMarkdown.tsx` tail 래핑(stable 블록은 기본 false) |
| 3 | `advanceStableBlocks` 증분·전문 동치 | ✅ | `markdownBlocks.ts` + property 테스트(청크 크기 5종 × 경계 코퍼스 — 펜스/loose list/들여쓰기/빈줄 런/미완 줄) green, 참조 유지 테스트 green |
| 4 | 비-append 폴백 | ✅ | `source.startsWith(cache.source)` 가드 + 폴백 테스트 green |
| 5 | `SessionRow` memo | ✅ | `SessionRow.tsx` `memo()` — 전제(store in-place 패치 `sessionsStore.ts:45-51`·핸들러 안정화 0007) 조사 확인 |
| 6 | 테마 감지 싱글톤 | ✅ | `themeStore.ts`(신규) + `useThemeId` = `useSyncExternalStore` |
| 7 | DiffBody `useMemo` | ✅ | `DiffBody.tsx` `buildPairs`/`buildDiffLines` 2곳 |
| 8 | 게이트 | ✅ | lint 0 error · typecheck 3종 0 · markdownBlocks 11/11 (전체 vitest 878/878 에 포함) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 | ✅ | — | green(0107 verify 와 동일 실행) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 |
| 레이어 경계 | ✅ | — | shared/ui·features/chat 하향만 — lint 0 |
| **시각 검증: 스트리밍 중 plain 유지 → 확정 시 1회 색상 전환**(의도된 UX 변화) · 테마 2종 | ✖ | ✅ | **사람 확인 대기** |
| CDP rAF 프레임타임 전/후 실측(0007 선례) | ✖ | ✅ | 사람/완전환경 대기 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
lint: 0 error / typecheck 3종: 0 / vitest 878/878 (markdownBlocks 11 포함) / scripts fail 0
```

## PHASES.md 정합성

- 성능 시리즈 4행 일괄 승격 — 형식 확인.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: "스트리밍 중 plain 고정"의 시각 인상(타이핑 중 무색)을 수치가 아닌 시각 검증에 위임 — 사용자 이견 시 디바운스 재검토 여지.
- 구현 단계: tail 안의 *이미 닫힌* 펜스도 승격 전까지 plain — 결정적이지만 하이라이트 지연이 한 박자 있음(기재).
- 검증 단계: 렌더 계층 자동 테스트 부재(인프라 없음) — 분할 로직만 기계 검증.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격. 시각 검증·rAF 실측은 사람 확인 대기.
