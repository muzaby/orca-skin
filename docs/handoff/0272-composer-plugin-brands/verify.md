# Verify — 0272-composer-plugin-brands

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0272-composer-plugin-brands` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `4f98955..af5870a`(r1, `Status: partial`) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | V1 `4f98955` · 0278 이관 annotation `087543e` |
| V mode / 유효 V | Baseline V / V1 (VP-06/AC6 색상 유지 부분 → 0278 AC1) |
| 라운드 | 1 (verify 1회째) |
| 상태 | **PASS** (기계 범위 · AC5 시각은 사람) |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**PASS(기계 범위) — 6개 pair와 §10 16자리의 심은 고장 13건이 모두 잡혔다.** 남은 것은 AC5의 white/dark 실제 창 시각 인수(사람)다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `af5870a`의 `plan.md` 변경: 메타·`[구현자 기입]` 채움. 규범 행 변경 없음.
- 기준선 diff 성립: 예 — V1 `4f98955`가 구현과 분리된 설계 커밋.
- `087543e`(0278 설계)가 D-01 색상 부분 SUPERSEDED(0278 D11·D24)·AC6 색상 이관·§후속 정책 절을 추가 — 사용자 결정 인용, 구현자 변경 아님.
- 채점 기준: AC1–5·7·8 + AC6의 보고 부분, VP-01–06, §10 16자리(EP-01 2 · EP-02 2 · EP-03 5 · EP-04 6 · EP-05 1).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V | 유효 | R-01–03·SD-01·AR-01·MD-01 NEW ↔ VP-01–06 REQUIRED |
| SUPERSEDED 이관 | 유효 | VP-06/AC6 색상 유지 → 0278 AC1/VP1·VP4, 나머지 AC 유지 명시 |
| §10 자리 목록 | 유효 | 5행 16자리가 파일 단위 검색 명령으로 고정 |
| 선택 적대 증거 | 유효 | 없음 — 직접 SVG·DOM·parse 관측 |
| AC5 시각 | 유효 | "실제 양 Composer 메뉴 그룹 SVG class·viewBox 단언 및 브라우저 시각" — 기계 부분과 사람 시각을 나눠 판정 |
| 운영 gate | 유효 | Vitest·lint·typecheck·boundary·inventory·budgets·build |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D-02 | 엔진 추가 두 선택지 왼쪽 컬러 마크 | `AgentEnvironmentView.tsx` `ClaudeLogo`·`OpenCodeLogo` |
| D-03·D-04 | 스킬 `/name`, 플러그인 `@id` 삽입·하이라이트 | `attachMenuToken`(plugin → `pluginMentionToken`) → controller `validPluginIds` → `tokenizeComposerDecorations` |
| D-05 | 플러그인은 파일 참조와 같은 배경색 | `ComposerDecorationLayer.tsx` chip class |
| D-06 | native MCP 동일 투영을 메뉴·하이라이트에 | `nativePluginMentions(view)` 한 함수가 메뉴 후보와 `validPluginIds` 양쪽에 공급 |
| D-07 | 의존성·설정 쓰기 없이 시작 차이 조사 | `startup-analysis.md`(조사 산출물, production 변경 0) |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 메뉴·장식 투영 불일치 | ✅ | 두 소비처가 같은 `nativePluginMentions`를 호출(D-06) |
| 공백·따옴표 id | ✅ | `pluginMentionToken`이 공백·`"` 포함 id를 JSON 인용 |
| 비활성·미연결 제외 | ✅ | `status === 'connected' && enabled` 필터 |
| 자동 전송 | ✅ | 선택은 draft 삽입만 — 기존 전송 경로 미변경 |
| 시작 시간 조사(AC8) | 보고 유지 | `startup-analysis.md`가 HEAD/1.19.0 비교·13초 미재현을 구분. 사용자 환경 1.17.19 기준은 0274·0275가 정본 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| test-only symbol | 없음 | `nativePluginMentions`·`pluginMentionToken`은 controller·attach menu production 호출 |
| 형제 슬롯 비대칭 | 없음 | Claude/OpenCode 두 Composer가 같은 `ComposerInputController`·decoration layer를 공유하고 테스트가 양 backend를 각각 실행 |

## 4. 고장 내 보기

- 등록 변이 0("not selected — 직접 SVG·동작 관측"). §10 16자리 재량 고장. 실행: renderer `features/chat`·`features/engine`·`shared`(기준선 green).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| K1 | `engine/common/components/AgentEnvironmentView.tsx` | 맞바꿈 | Claude 행 로고 → OpenCode 로고 | 잡음 | `AgentEnvironmentView.interaction.test: selects Claude or OpenCode before opening their production forms…` | EP-01 · AC1 |
| K2 | `harnesses/registries/composer.ts` | 맞바꿈 | source 브랜드 색 Claude↔OpenCode | 잡음 | `Composer.native-menu.test: shows all source groups directly for claude/opencode…` 외 2 | EP-02 · AC5 |
| K3 | `lib/attachMenuModel.ts` | 제거 | MCP 후보의 `status === 'connected'` 조건 삭제 | 잡음 | `attachMenuModel.test: offers only observed connected MCP names…`·`shares native menu membership with decoration…` | EP-03 filter · AC4 |
| K4 | 같은 파일 | 맞바꿈 | 후보 `id: item.id` → `item.name` | 잡음 | `Composer.native-menu.test: highlights selected native @ plugins…`·`keeps a quoted native plugin id…` | EP-03 map · AC2 |
| K5 | 같은 파일 | 맞바꿈 | action `id: plugin.id` → `plugin.label` | 잡음 | 같음 | EP-03 action · AC2 |
| K6 | `lib/pluginMention.ts` | 제거 | 공백·따옴표 id의 JSON 인용 삭제 | 잡음 | `attachMenuModel.test: keeps the exact native plugin id as one token: server with spaces / server"quoted` | EP-03 token · AC2 |
| K7 | `lib/attachMenuModel.ts` | 호출 대체 | plugin 분기 `pluginMentionToken` → 원 id | 잡음 | `Composer.native-menu.test` 4건 외 | EP-03 attachMenuToken · AC2 |
| K8 | `common/composer/ComposerInputController.tsx` | 제거 | 유효 plugin id에서 native 후보 삭제 | 잡음 | `Composer.native-menu.test: highlights selected native @ plugins in the real claude/opencode composer…` | EP-04 union · AC2 |
| K9 | 같은 파일 | 뒤집기 | `includeExtensions` 조건 반전 | 잡음 | `Composer.native-menu.test: shows all source groups directly for claude…` | EP-04 union · AC4 |
| K10 | `common/composer/ComposerInputSurface.tsx` | 고정값 | `validPluginIds` → 빈 집합 | 잡음 | `Composer.native-menu.test` 6건 | EP-04 surface prop |
| K11 | `common/composer/composerDecoration.ts` | 제거 | 유효 id 막음 조건 삭제 | 잡음 | `composerDecoration.test: recognizes the full native @ identity "@org/package"…` 외 | EP-04 tokenizer · AC4 |
| K12 | `common/composer/ComposerDecorationLayer.tsx` | 맞바꿈 | plugin·skill chip 색 맞바꿈 | 잡음 | `Composer.native-menu.test: highlights selected native @ plugins…` 외 | EP-04 chip 색 · AC2(D-05) |
| K13 | `common/composer/composerDecoration.ts` | 다른 값 | skill 정규식을 `[a-z0-9-]+`로 축소 | 잡음 | `composerDecoration.test: preserves complete skill identities with case, underscores, namespaces…`·`Composer.native-menu.test: loads claude/opencode native commands…` | EP-05 · AC3 |

- 검산: 시도 13 = 잡음 13 · 못 잡음 0 · 동치 0.
- 형제 슬롯 맞바꿈: K1(로고)·K2(브랜드 색)·K12(chip 색) 잡음.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP-05 | UT | REQUIRED | PASS | K6·K11·K13 잡음 |
| VP-04 | IT | REQUIRED | PASS | K3·K4·K5·K7·K10 잡음 |
| VP-03 | ST | REQUIRED | PASS | K8·K9 잡음(disabled 갱신·draft 보존 테스트 포함) |
| VP-02 | AT | REQUIRED | PASS | K4·K5·K7·K8·K12·K13 잡음 |
| VP-01 | AT | REQUIRED | PASS(기계 범위) | K1·K2 잡음 — SVG·색 DOM. white/dark 실제 창 시각은 사람 |
| VP-06 | AT | REQUIRED | PASS | `startup-analysis.md`의 근거표·버전 좌표 존재. 색상 유지 부분은 0278 AC1로 이관(0278 F12a–c 잡음) |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 엔진 추가 두 컬러 마크·선택 | ✅ | K1 잡음 |
| AC2 native @id 삽입·참조색 highlight | ✅ | K4–K8·K10·K12 잡음 |
| AC3 스킬 `/` 원문 highlight | ✅ | K13 잡음 |
| AC4 미연결·비활성 제외·unknown 구별 | ✅ | K3·K9·K11 잡음 |
| AC5 그룹 마크 브랜드색 | ⚠️ 사람 | DOM은 K2 잡음, white/dark 실제 창 시각 미확인 |
| AC6 저장 범위 보고(색상은 0278) | ✅ | 보고서 존재, 색상은 0278 verify가 채점 |
| AC7 이전 요청 범위 보고 | ✅ | 보고서 §3의 0238·0259·0267 좌표 |
| AC8 시작 시간 비교 보고 | ✅ | 보고서 §4–8 |

- 합계 재측정: `✅ 7 · ⚠️ 1(사람 시각) · ❌ 0 = 8`. 자기보고 `Criteria-Met: 7/8`·`Criteria-Pending: AC5 …시각 인수`(`af5870a`) 일치.

### §10 강제 지점 분모

| EP | 결과 |
|---|---|
| EP-01 (2) | 2/2 PASS (K1) |
| EP-02 (2) | 2/2 PASS (K2) |
| EP-03 (5) | 5/5 PASS (K3–K7) |
| EP-04 (6) | 6/6 PASS (K8–K12) |
| EP-05 (1) | 1/1 PASS (K13) |

- 16/16. 목록 밖 발견 없음.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error/2 기존 warning · renderer 374/3060 green · Windows CI #853 green.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| AC5: 양 Composer `+` 메뉴 그룹 마크 white/dark | SVG 형태·색 class DOM(K2 잡음) | 실제 창 두 테마 확인 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → `verify/PASS(기계 범위)`·다음 사람(AC5 시각) — 0263 선례처럼 시각 인수까지 보드에 둔다.
- 대상 커밋: `4f98955`·`af5870a`·`087543e` `git cat-file -t` = commit. `af5870a` trailer 6키(`Criteria-Pending` 포함) 파싱.
- `[구현자 기입]` 7필드와 16자리 표 존재.

## 13. Finding disposition

- 없음(차단·비차단 모두). AC5 시각은 사람 실기 경계.

## 14. Review Signals

- 첫 verify, 반복 증상 없음. 사용자 결정 변경: D-01 색상 → 0278 D11·D24(최신 handoff 기준).
- 반복 환경 한계: 실제 창 시각 인수(구현 턴도 브라우저 접근 차단으로 미수행).

## 15. 결론

- 상태: **PASS(기계 범위)** — verify 1회째. pair PASS 6/6, PLAN_GAP 없음, AC ✅7 · ⚠️1(사람).
- 남은 사람 확인: AC5 white/dark 실제 창 시각.
