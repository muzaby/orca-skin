# Verify — 0023-skill-mcp-isolation-docs

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0023-skill-mcp-isolation-docs` |
| 검증자 | Claude Code |
| 일자 | 2026-06-16 |
| 대상 커밋 | `12c7e65` |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | standardization §5.1 레이아웃 재작성 + 소유 모델/격리 해제/구현-대기 노트 | ✅ | `standardization.md:90-107`(신 다이어그램: `.claude/skills`·`.mcp.json`·settings flag·plugin 제거) + `:110-116`(소유 모델·dist=스테이징·격리 해제·구현 상태 4블록) |
| 2 | standardization §5.2 배포 동작 + §2 호환성 분류 | ✅ | `standardization.md` §5.2 축별 표(skill→`.claude/skills`·mcp `.mcp.json` placeholder·"dist 에 두지 않는 것" 노트·구현 상태) + §2 "호환성 기준 소유 모델" 단락(agents·commands·hooks·plugin=engine-specific 연기) |
| 3 | TRD §6.8 격리 해제·settings dist 미배포·0014/0015 폐기 | ✅ | `TRD.md` §6.8 "런타임 주입 (격리 해제 — 구현 대기)"(settingSources 생략·disallowedTools) + settings.json dist 미배포 항목 + "격리 해제 — handoff 0014/0015 격리모드 폐기(supersede)" 블록 |
| 4 | adapters §1.3·§1.7·§3.1·§3.2 신 설계 정렬 | ✅ | `adapters.md` §1.3 코드주석+문단(disallowedTools·settingSources 생략) · §1.7 표(`options.skills`+settingSources 생략·`disallowedTools` ✅·`options.plugins` ⏳) · §3.1 매트릭스(Skill settingSources·engine-specific 연기 노트) · §3.2(hook 파일 배포 연기/런타임 유지) · §2.1 머티리얼라이즈 블록 |
| 5 | security §1.4 격리 해제 + .mcp.json placeholder 모델 | ✅ | `security.md` §1.4 "격리 해제(구현 대기)" + "MCP 디스크 배포 모델"(`.mcp.json` placeholder·subprocess env 확장) + 머티리얼라이즈 블록 갱신; argv 평문 불변식(§109-110)·branded 타입 유지 |
| 6 | PHASES 신규 행 | ✅ | `PHASES.md` "Skill/MCP 표준 정렬 + settingSources 격리 해제 (문서 선행)" 행 = "문서 확정 / 코드 대기" |
| 7 | docs 정합성(잔여 모순 0) | ✅ | grep `settingSources: \[\]\|격리모드\|plugins:\[\{local\|dist/.*plugin` → live 매치는 전부 "구현 대기" 현행-코드 서술(standardization:114/116·adapters:68/123/178·security:77·TRD:355/364) + 0014/0015·PHASES 이력 + 외부 SDK 미러(spec/claude). 모순 0 |
| 8 | 코드 무변경 | ✅ | `git diff --stat 12c7e65^..12c7e65` = `docs/` 5건만(`app/**` 0). 각 갱신 섹션에 "구현 대기" 마커 존재 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 코드 게이트 lint/typecheck/test | — | — | N/A (문서 라운드) |
| 인수 기준 ↔ 문서 대조 | ✅ | 이견 시 중재 | 8/8 충족(증거 `파일:라인`) |
| 문서 형식/링크/한국어 | ✅ | — | 표·블록 형식·상호참조 링크 유지 |
| docs 상호참조 정합 | ✅ | — | TRD §6.8 ↔ standardization §5.1/§5.2 ↔ adapters §1.3/§3.1 ↔ security §1.4 동일 신 레이아웃 |
| 설계 의도 부합(요청서 + 사용자 사인오프) | ✖ 보조 | ✅ 결정 | 사용자 사인오프 3회(settingSources 옵션 생략·agents/commands/hooks/plugin 연기·테스트 후속) 반영 |
| 0014/0015 처리 방침 | ✖ | ✅ 결정 | 사용자 결정 "건드리지 않음" — historical 보존 확인 |
| PR 머지 승인 | ✖ | ✅ | 사람 |

## 게이트 재실행 결과

```
$ git diff --stat 12c7e65^..12c7e65
 docs/PHASES.md                       |  1 +
 docs/TRD.md                          | 10 ++++----
 docs/arch/backend/adapters.md        | 31 ++++++++++++-----------
 docs/arch/backend/security.md        |  4 +--
 docs/arch/backend/standardization.md | 49 ++++++++++++++++++++----------------
 (app/** 변경 0 — 문서 라운드)

$ grep -rn "settingSources: \[\]|격리모드|plugins:\[\{local" docs/ (handoff/spec 제외 live 문서)
 → 매치는 전부 "구현 대기" 현행-코드 서술 + historical(0014/0015·PHASES) — 모순 0
```

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 미변경 — 해당 없음. 문서 본문에 키/토큰/이메일/IP 혼입 0(설계 서술만).

## PHASES.md 정합성

- 형식/커밋 기재: PHASES 신규 행 추가, 상태 "문서 확정 / 코드 대기". 대상 커밋 `12c7e65`. handoff 0023 연계(본 verify).

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격(문서 라운드). 코드 정렬은 후속 핸드오프 [`0024-skill-mcp-isolation-impl`](../0024-skill-mcp-isolation-impl/plan.md).
- 사람 확인 대기: 설계 의도 최종 승인(요청서 ↔ 문서) · 0024 코드 라운드 착수 승인.
