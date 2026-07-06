# Verify — 0076-menu-material-icons

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-07-06 |
| 결과 | **PASS** (구현 범위) |
| 라운드 | 1 |

## 구현자 코멘트 확인

plan `[구현자 기입]` 설계 리뷰(이견 없음)·놓친 잠재 문제 2건(모두 ✅ 선조치: prop 제거 전 grep 전수, path 스크립트 추출) 확인. 매트릭스에 반영.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 결과 | 증거 |
|---|---|---|---|
| 1 | Material fill 렌더(viewBox `0 -960 960 960`, stroke 미사용) | ✅ | `Icon.tsx` `<svg viewBox="0 -960 960 960" fill={color}>` — strokeWidth/Linecap 제거 |
| 2 | `IconName` 50종 유지, 호출부 리네임 0 | ✅ | 유니온 50종 동일, `git diff --numstat` 상 Icon.tsx/CustomizeLanding 외 코드 변경 0 |
| 3 | `ICONS` 50종 Material Outlined path + glyph 주석 | ✅ | 각 항목 `// <glyph>` 주석(add·close·memory·…), gstatic 원본 50/50 |
| 4 | `color`→fill tint 매핑 | ✅ | `fill={color}` 기본 `currentColor`; CameraView/SkillDetail/SkillAddMenu 사용처 무변경 |
| 5 | `stroke`/`fill` prop 제거 + 유일 사용처 정리 | ✅ | `IconProps` 에서 제거, `CustomizeLanding` `stroke={1.2}` 삭제 |
| 6 | 브랜드 로고/로그인 PNG 미변경 | ✅ | `OrcaLogo.tsx`·LoginFrame PNG 내용 diff 0(numstat 무출력=line-ending 노이즈) |
| 7 | 게이트 lint/typecheck 통과, test ABI 외 green | ✅ | 하단 게이트 |

## 게이트 재실행

- `npm run lint` — ✅ exit 0.
- `npm run typecheck` — ✅ (node/web/test 3종 무오류).
- `npm test` — 700/723 passed. **23 red = better-sqlite3 ABI(NODE_MODULE_VERSION 127 vs 140)** 로 `new Database()` 실패. 실패 파일 4종 전부 sqlite 인스턴스화 파일(`db/queries.test.ts`·`chat-turn.continuity.test.ts`·`extensions/builder.test.ts`·`orchestration/fork.test.ts`) — 본 변경은 순수 renderer SVG 교체로 이 경로에 무관. 환경 재빌드(`npm rebuild better-sqlite3`)는 이 머신 node-gyp 컴파일 실패로 불가(handoff 0019 동일 계열).

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) |
|---|---|---|
| lint/typecheck/test 게이트 | ✅ 실행+출력 | — |
| 인수 기준 ↔ 코드 1:1 | ✅ `파일:라인` | 이견 시 중재 |
| 레이어 경계 | ✅ 위반 0(shared/ui + skills 내부) | — |
| **아이콘 시각 톤/무게(Outlined vs 기존 stroke)** | ✖ | ✅ 실기 시각 검증 |
| **semantic→glyph 매핑 적절성**(capture/fork/board 등) | ✖ 제안 | ✅ 최종 판단 |
| 신규 의존성 | ✖(0건) | — |

## 위생 검토

- 비밀/키/토큰/이메일/IP: 신규 유입 0(SVG path 상수만).
- 임시 파일(`.icons_map.tsv`) 제거 확인.
- 커밋 대상: `Icon.tsx`·`CustomizeLanding.tsx` + 본 handoff 문서만. 작업 무관 line-ending(LF↔CRLF) 노이즈 40여 파일은 스테이징 제외.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계: 매핑을 사전 확정했으나 `capture`/`fork`/`board` 등 은유적 아이콘은 시각 확인 전까지 확신 불가 — 사람 검증으로 위임(책임표).
- 구현: path 를 스크립트 추출로 무결성 확보한 점이 강점. viewBox 전환이 호출부 계약을 건드리지 않음을 numstat 로 재확인.
- 검증: 코드 게이트는 통과하나 **시각 회귀는 자동으로 잡히지 않음** — `npm run dev` 실기 확인이 남은 유일 항목.

## 사람 확인 대기

1. `npm run dev` 로 사이드바 NAV·Composer 메뉴·설정 등 아이콘 시각 검증(톤/정렬/크기감).
2. `capture`(center_focus_strong)·`fork`(fork_right)·`board`(dashboard) 매핑 어감 승인 — 이견 시 glyph 1줄 교체.

## 후속 (2026-07-06, 사용자 지정 2건)

사용자 요청으로 nav 사용자 메뉴/설정의 두 아이콘 의미 정정 → Material glyph 2종 신규 추가(50→52):
- **언어**(`SidebarUserButton` 언어 항목): `chat` → 신규 `globe`(Material `language`, 지구본).
- **설정 › 사용량 탭**(`SettingsModal` TABS): `bolt` → 신규 `chart`(Material `bar_chart`, 막대차트).

게이트 재실행: **typecheck ✅**(node+web+test) / **lint ✅** (exit 0, 신규 아이콘명 해소). 변경 파일 `Icon.tsx`(+2 glyph)·`SidebarUserButton.tsx`·`SettingsModal.tsx`.
