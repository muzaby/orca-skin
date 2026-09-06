# Verify — 0216-spinner-artwork-swap

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0216-spinner-artwork-swap` |
| 검증자 | Claude Code |
| 일자 | 2026-09-06 |
| 대상 커밋/range | `0954242d..a8d2d642` (구현 `a8d2d642`) |
| 구현 전 plan 기준 | `ef2da91c`(설계) → `0954242d`(ΔV2 rev.2 정정) |
| V mode / 유효 V | `Delta V` / `0208:V1 + ΔV1 + ΔV2(rev.2)` |
| 검증 기준 plan revision | `0954242d:ΔV2 rev.2` |
| 라운드 | 1 |
| 상태 | **FAIL + PLAN_GAP → RETURN_TO_PLAN** |
| 자기 검증 여부 | **설계·구현·검증이 모두 Claude 다.** §4 에 구현 보고가 이름을 대지 않은 적대 축 3건(M-E1 형제 트랙 맞바꿈 · AT-211 독립 재측정 5모드 · §10 분모 독립 재열거)을 넣었다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: 예 — **`[구현자 기입]` 7필드만**이다. 규범 행 정정(ΔV2 rev.2)은 **앞선 별도 설계 커밋** `0954242d` 에 있다.
- 기준선이 diff 로 성립하는가: **예** — 설계 `ef2da91c` · 정정 `0954242d` · 구현 `a8d2d642` 가 세 커밋으로 갈려 있다.
- Decision Ledger 변경: 없음 — D-201~D-209 원문 동일.
- Product/UX Contract 변경: 없음.
- AC 변경: **1건 — AT-206 의 검증 수단**(`rg '<StatusLine' = 3` → JSX 렌더 지점 전수 2 + `SparkSpinner` 소비자 1). 구현 턴이 `PLAN_GAP` 으로 올려 설계 커밋 `0954242d` 로 정정했고, 제품 계약(무분기·단일 컴포넌트)은 바뀌지 않았다. **정정 후 기준으로 채점한다.**
- V node/pair·§10·oracle 변경: 같은 축의 ΔVP-206·EP-206 뿐.
- 채점에 사용할 원 기준: `0954242d` 의 §3·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 기준 V `0208:ΔV1@4e1a412f` 를 적었고 유효 V 를 재구성할 수 있다 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-201~204·208·AR-201·MD-201/202 가 ΔVP-201~205·207·210 으로 닫힌다 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | R-205·R-207·SD-201 이 ΔVP-206·208·211 |
| pair별 path·§10 전수·직접 oracle | **부분 — ΔVP-209 가 gap** | 나머지 10 pair 는 경로·전수·oracle 을 갖는다. ΔVP-209 의 oracle 은 §14 산문뿐이고 하네스가 저장소에 없다 |
| 필요한 pair의 선택적 적대 증거 | 유효 | 9 변이가 pair별 이유와 함께 등록돼 있다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | subtree·repository·message-bus 3종 |

- root PLAN_GAP: **ΔVP-209(AT-211)** — 재현 절차가 산출을 결정하지 못한다. 영향 pair: ΔVP-209 단독(ΔVP-207 의 정적 상한은 독립 PASS).

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-201 새 아트워크 | 마크 5종·4800ms | `spinner-reference.svg` → `sparkTracks.ts` → `SparkSpinner.tsx:66` → `StatusLine.tsx:121` |
| D-202 세 표면 무분기 | variant 없음 | 렌더 지점 2 → `StatusLine` 1 → `SparkSpinner` 1 |
| D-203 14×14 | 상태문구 12px 보다 크다 | `SparkSpinner.tsx` `width={14} height={14}` |
| D-204 `#C15F3C` | 두 테마 동일 | `tokens.css:51` 정의 1건 · dark 스코프 0 |
| D-205 성능 비회귀 | 실시간 출력이 느려지지 않는다 | **§5 ΔVP-209 참조 — 재측정이 반대 방향** |
| D-206 원본은 oracle 전용 | 번들 0건 | 프로덕션 151파일 leak `[]` |
| D-207 전역 CSS 소유 | 인스턴스마다 규칙 사본 없음 | `app.css` `@keyframes spark-a~e` 각 전역 1 |
| D-208 241슬롯 삭제 | 두 사본이 남지 않는다 | 구 심볼 6종 소스 전수 0건 · `sparkFrames.ts` 삭제 |

### end-to-end 흐름

```text
턴 시작(turnStartedAt) → StatusLine 마운트 → SparkSpinner 1개(14×14, text-spinner)
  → 브라우저가 app.css 의 spark-a~e 를 4800ms 주기로 돌린다
  ↘ prefers-reduced-motion: 트랙 5개 정지, 마크 b 만 opacity 1
턴 종료 → StatusLine null → 언마운트(별도 정리 없음)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ⚠️ 조용하지 않다 | 트랙 미방출이면 마크 5개가 **동시에 정지 표시**된다 — 눈에 띄는 실패다 |
| false success 가능성 | 낮다 | 파서가 구조 불일치에 던진다(`sparkReference.testlib.ts` `required()`) — 조용한 빈 값이 없다 |
| partial failure/rollback | 해당 없음 | 표시 계층. 저장·마이그레이션 없음 |
| Product/UX 의 A 가 아닌 B | 아니오 | 기하·키타임·색·감속 마크가 원본과 등호다 |
| 증상만 제거하고 상태가 남았는가 | 아니오 | `sparkFrames.ts`·`sparkFrames.test.ts` 를 실제로 지웠다(이동 아님) |
| 최적화가 잃은 관측 | **1건** | `visibility` → `opacity` 로 바뀌며 **꺼진 마크가 레이아웃에서 빠지지 않는다**. §5 ΔVP-209 |
| 출력/요청 worst-case | 유한 | 노드 38×3=114 · 애니메이션 5×3=15 · 전역 stop 41(인스턴스 무관) |

## 3. 역방향 탐색

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export | **테스트 전용 3건** | `SPARK_MARKS`·`SPARK_PERIOD_MS`·`SPARK_REDUCED_MOTION_MARK` 의 프로덕션 참조 0 — 소비자가 `sparkCss.test.ts`(+`statusLine.render.test.ts`) 뿐이다. plan §11 이 그 소비자를 명시했으므로 의도다. D2 |
| 배선된 export | 정상 | `SPARK_TRACK_CLASS` 만 `SparkSpinner.tsx` 가 쓴다 |
| 테스트 전용 참조 | 정상 | `sparkReference.testlib.ts` — 프로덕션 leak 스윕이 0건을 센다 |
| 형제 정책 비대칭 | 없음 | 트랙 5개가 같은 `@utility` 형상(전개된 공통 선언 4줄 + animation) |
| 신규 등록값의 기존 소비처 | 무영향 | `--color-spinner` 소비자는 `text-spinner` 1곳 |
| producer ↔ consumer 파생 불일치 | 없음 | 컴포넌트는 색을 모르고 클래스만 소비한다 |
| 동일 규칙 중복 구현 | **의도된 2사본** | `sparkTracks.ts` 리터럴 ↔ `app.css` 이름. `sparkCss.test.ts` 가 둘을 원본에 각각 대조한다 |

## 4. 기존 테스트 / semantic 검증 확인

- structural proxy 만으로 통과시킨 AC: 없음 — 기대값을 전사하지 않고 원본 SVG 를 파싱해 비교한다.
- **선택된 적대 증거 재측정**: 등록 변이 **9건 중 검출 9** · 인용 변이 0 · 새 oracle 민감도 1(EP-206 전수 스윕) · 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: 해당 없음 — r1 이다.
- **자기검증 분모**: 구현자 = 검증자다. 보고에 없던 축 **3건** — M-E1(형제 트랙 맞바꿈) · M-E2(AT-211 5모드 독립 재측정) · §10 31지점 독립 재열거.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M-1 원본 1byte `r="15.91"`→`15.92` | `sparkCss` | 없음 | **red** (1/14) | ΔVP-201 등록 |
| M-2 원본 `r="3.33"`→`3.34` | `statusLine.render` | 없음 | **red** (1/8) | ΔVP-202 등록 |
| M-3 `app.css` `spark-c` 27.083% `scale(1.0)`→`0.9` | `sparkCss` | 없음 | **red** (1/14) | ΔVP-202 등록 |
| M-4 `StatusLine.tsx` `text-[12px]`→`text-[14px]`(형제 값 교환) | `statusLine.render` | 없음 | **red** (1/8) | ΔVP-203 등록 |
| M-5 `tokens.css` `#C15F3C`→`#d97757` | `sparkCss` | 없음 | **red** (1/14) | ΔVP-204 등록 |
| M-6 `animate-spark-scale` 리터럴 복원 | `sparkCss` | 없음 | **red** (2/14) | ΔVP-205 등록 |
| M-7 `spark-a` 에 `width: 100px` stop 추가 | `sparkCss` | 없음 | **red** (1/14) | ΔVP-207 등록 |
| M-8 감속 블록에서 `.animate-spark-d` 삭제 | `sparkCss` | 없음 | **red** (1/14) | ΔVP-207 등록 |
| M-9 트랙 클래스를 템플릿으로 조립 | `sparkCss` | 없음 | **red** (2/14) | ΔVP-208 등록 |
| M-10 `ChatTile.tsx` 에 세 번째 `<StatusLine` 등장 | `statusLine.render` | 없음 | **red** (1/9) | 새 oracle(EP-206) 민감도 |
| M-E1 **형제 트랙 맞바꿈**(`SPARK_TRACK_CLASS.c` ↔ `.e`) | `statusLine.render` | 없음 | **red** (1/8) | 검증자 신설 축 |

- M-E1 의 의미: 존재만 보는 단언이라면 두 클래스가 모두 남아 침묵한다. `renderedMark(cls)` 가 클래스로 그룹을 찾아 자식 전수를 원본과 비교하므로 자리를 바꾼 회귀가 red 다.
- 동작 보존 추출 라운드인가: 아니오 — 아트워크·모델이 통째로 바뀌었다.
- 소거 변이의 잔여물 수렴: M-6·M-9 는 1단계에서 이미 테스트 실패이고 잔여물(unused import 등)에 기댄 red 가 아니다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| ΔVP-205 | R-204 ↔ AT-205 / UT | REQUIRED | **PASS** | 구 심볼 6종 × 렌더러 소스 전수 offenders `[]` + 양성 짝 · M-6 red | 2/2 |
| ΔVP-208 | R-206 ↔ AT-209·UT-201 / UT | REGRESSION | **PASS** | `StatusLine.tsx` 코드 줄 timer/state/style 0 · leak 차집합 `[]`(프로덕션 151파일) · M-9 red | 3/3 |
| ΔVP-201 | R-201 ↔ AT-201 / IT | REQUIRED | **PASS** | sha256 `f94d5f7b…3d7b` · 14,401 bytes · CR 0 · `.gitattributes:19` · M-1 red | 4/4 |
| ΔVP-202 | R-201·AR-201 ↔ AT-202·IT-201 / IT | REQUIRED | **PASS** | 마크 5종 자식 전수 등호 · line 16·circle 3·path 13 · stop 41 · 4800ms·cubic-bezier · M-2·M-3·M-E1 red | 5/5 |
| ΔVP-204 | R-203 ↔ AT-204 / IT | REQUIRED | **PASS** | 정의 1건 = `#C15F3C` · dark 스코프 0 · raw hex 0 · M-5 red | 4/4 |
| ΔVP-206 | R-205 ↔ AT-206 / IT | REGRESSION | **PASS** | JSX 지점 2(`SubAgentTileContent`·`PendingAssistant`) · `<SparkSpinner` 프로덕션 소비자 1 · 출력 `<svg>` 1 · M-10 red | 2/2 |
| ΔVP-210 | R-208 ↔ AT-212 / IT | REQUIRED | **PASS** | `@tailwindcss/vite` 빌드 산출: `.animate-spark-a~e` 5 · `@keyframes spark-a~e` 5 · stop 41 · 구 트랙 0 · `--color-spinner:#c15f3c` | 1/1 |
| ΔVP-207 | R-206·SD-201 ↔ AT-207·AT-208·ST-201 / ST | REQUIRED | **PASS** | 애니메이션 5(중복 0) · 노드 38 · stop 41 · 속성 차집합 `[]` · keyframe 전역 각 1 · M-7·M-8 red | 5/5 |
| ΔVP-203 | R-202 ↔ AT-203 / AT | REQUIRED | **PASS** | `<svg width="14" height="14"` · `text-[12px]` 보유·`text-[14px]` 0 · 버블 `text-[14px]` · M-4 red | 3/3 |
| **ΔVP-209** | R-206 ↔ AT-211 / AT | REQUIRED | **PAIR_FAIL** | 아래 재측정 — 신 > 구 | **2/2 실행, 기준 미충족** |
| ΔVP-211 | R-207 ↔ AT-210 / AT | REGRESSION | **사람 실기 대기** | — | 0 |

- root `PAIR_FAIL`: **ΔVP-209**. 종속 `BLOCKED_BY`: 없음 — 나머지 10 pair 는 독립 판정했다.
- 이번 라운드 실행 범위: 최초 검증 — REQUIRED/REGRESSION 11 pair 전건 + 운영 gate 3종.

### ΔVP-209 재측정 (AT-211)

**하네스**: Electron 39.8.10(`app/node_modules/.bin/electron`) · 격리 페이지 · 동시 **3개** · 5,000ms 창 · 700ms 정착 후 CDP `Performance.getMetrics` 차분 · GPU 가속 켠 상태 · 구 마크의 글리프 폰트 스택은 교체 전 컴포넌트와 동일(`"Segoe UI Symbol", "Apple Symbols", sans-serif`). 구 CSS·구 마크업은 `git show 0954242d:…/app.css` 와 교체 전 `SparkSpinner.tsx` 에서 복원했다. **전제 검사(rAF)**: 전 모드 298~301 프레임 / 5s = 60fps — 가려진 창의 0 이 아니다.

3회 평균(교체 전/후 각각 두 차례 독립 실행에서 같은 방향):

| mode | fps | style recalc | recalc 시간 | layout | layout 시간 | main-thread task |
|---|---|---|---|---|---|---|
| none | 59.9 | 0회 | 0ms | 0회 | 0ms | 90.0ms |
| old | 59.7 | 298.3회 | 92.9ms | **0회** | **0ms** | 240.9ms |
| new | 60.0 | 299.3회 | 83.2ms | **144.3회** | **11.2ms** | 299.5ms |

- 기준선 대비 순증가: 구 **30.2ms/s** → 신 **41.9ms/s (+39%)**. 두 번째 독립 실행도 29.4 → 38.9ms/s 로 같은 방향이다.
- **원인 분리**(같은 하네스, 2회 평균): `new-static`(새 마크업·애니메이션 정지) task **89.3ms** ≈ 기준선 → 노드 38개는 비용이 아니다. `new-opacity`(키프레임에서 `transform` 제거, opacity 만) layout **0회** · task 258.2ms → **layout 은 SVG `<g>` 의 애니메이션 transform 이 만든다**. `old-smooth`(구 트랙의 `step-end` 를 `linear` 로) layout **0회** → step-end 여부는 원인이 아니다. `transform-origin: center` 로 바꿔도 layout 144.5회로 불변.
- 관측된 차이의 구조: 구 구현은 꺼진 마크를 `visibility: hidden` 으로 두어 **레이아웃에서 빠지고** 움직이는 transform 이 인스턴스당 1개다. 새 구현은 `opacity: 0` 이라 5개 마크가 모두 레이아웃에 남고 각자 transform 을 움직인다. plan §9 Delta 표는 이 축을 `transform · visibility → transform · opacity` 로 적었을 뿐 비용을 재지 않았다.
- **§14 와의 불일치**: plan 은 layout 을 구 167회/80.3ms · 신 147회/10.4ms 로, 총계를 구 65.2 → 신 33.9ms/s(−48%)로 적었다. 이번 재측정은 layout 이 구 **0회** · 신 144회이고 총계 방향이 반대다. plan §14 는 "측정 하네스는 저장소에 커밋하지 않았다" 고 적었으므로 두 하네스가 어디서 갈리는지 확인할 수 없다.
- 판정: AT-211 의 기준은 "신 ≤ 구" 이고 재측정은 layout·main-thread task 두 축에서 그 반대다. fps 는 두 조건 모두 60 이다. → **`PAIR_FAIL`**, 동시에 **`PLAN_GAP`**(재현 절차가 산출을 결정하지 못한다).
- 크기 감각: 신·구 차이는 3개 동시에 프레임당 약 **0.19ms**(16.7ms 예산의 1.1%)다. 이것이 D-205("성능감소로 이어지면 안된다")를 깨는지는 **사용자 결정**이지 구현자 판단이 아니다.

### AT / AC 세부와 합계

| AT | 제품/동작 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AT-201 | 원본이 바이트 그대로 산다 | ✅ | sha·bytes·CR·gitattributes 4지점 |
| AT-202 | 렌더 기하가 원본과 같다 | ✅ | 마크 5종 자식 전수 등호 + 내역 합 16/3/13 |
| AT-203 | 박스가 14×14 | ✅ | 세 값 동시 단언 + M-4 red |
| AT-204 | 고정색 1곳 정의 | ✅ | 정의 1 · dark 0 · raw hex 0 |
| AT-205 | 241슬롯 인코딩 소멸 | ✅ | 음성 스윕 `[]` + 양성 짝 |
| AT-206 | 표면이 분기 없이 같은 스피너 | ✅ | JSX 지점 2 · 소비자 1 · `<svg>` 1 (rev.2 기준) |
| AT-207 | 인스턴스 비용이 늘지 않는다 | ✅ | 애니메이션 5 · 노드 38 · stop 41 |
| AT-208 | 레이아웃 속성 없음·전역 1회 파싱 | ✅ | 속성 차집합 `[]` · keyframe 전역 각 1 |
| AT-209 | 실시간 경로 재렌더 없음 | ✅ | timer/state 0 · leak 0 + 양성 짝 |
| AT-210 | 실기 — 크게 보이는가 | ⏸ | 사람 |
| **AT-211** | **런타임 비용이 줄어든다** | **❌** | 재측정 신 > 구(위 표) |
| AT-212 | 트랙이 빌드 산출까지 도달 | ✅ | 5·5·41·0·토큰 |

- **합계 재측정**: `✅ 10 · ❌ 1 · ⏸ 1 = 총 12`. 자기보고는 `Criteria-Met: 10/12` + `Pending: AT-210·AT-211` — **✅ 수는 일치하고 AT-211 의 상태만 `pending` → `❌` 로 바뀐다**(구현 턴은 재측정을 하지 않았고 검증 턴이 했다).
- **합계 사본 대조**: verify 본문 `10/12` ↔ 커밋 trailer `Criteria-Met: 10/12` ↔ INDEX 비고 — 일치.

### pair별 plan §10 강제 지점 분모

| Pair | plan 이 적은 지점 | 검증자가 다시 센 지점 | 결과 |
|---|---|---|---|
| EP-201 | 4 | 4/4 | PASS |
| EP-202 | 5 | 5/5 | PASS |
| EP-203 | 3 | 3/3 | PASS |
| EP-204 | 4 | 4/4 | PASS |
| EP-205 | 2 | 2/2 | PASS |
| EP-206 | 2 | 2/2 | PASS |
| EP-207 | 5 | 5/5 | PASS |
| EP-208 | 3 | 3/3 | PASS |
| EP-209 | 2 | 2/2 실행 — rAF 60fps ✅ · 신 ≤ 구 ❌ | **PAIR_FAIL** |
| EP-210 | 1 | 1/1 | PASS |

- 독립 재열거 합계: **29/31 충족**(EP-209 의 두 지점은 실행했고 그중 기준 지점이 불충족). 구현 보고 `29/31` 과 지점 수가 일치한다 — 라벨이 아니라 지점을 하나씩 다시 셌다.
- 표에 없는데 같은 불변식이 필요한 지점: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 / 범위 판정 |
|---|---|---|
| subtree `app/**` | **PASS** | `npm run lint` 0 error / 1 warning(`useTranscriptVirtualizer.ts:22`, 기존·변경 무관) · `npm run typecheck` node·web 0 error / test 2 error(`@opencode-ai/sdk` 미설치 베이스라인) · `vitest run src/renderer` **151파일 1174케이스 green** |
| repository (docs) | **PASS** | `check-doc-inventory --check` → generated ok(9 items, 82 channels) · prose ok · links ok |
| message bus | **PASS** | `git log -1 --format='%(trailers:only=true)' a8d2d642` 가 6키를 그대로 반환 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 인스턴스 노드: `svg 1 · g 5 · line 16 · circle 3 · path 13` = **38**(내역 합 = 총계).
- 전역 stop: `6+17+6+6+6` = **41**. 빌드 산출도 41 — 다만 lightningcss 가 `100%` 를 `to` 로 최소화하므로 `%` 만 세면 36 이 나온다. 세는 술어에 `to` 를 포함해야 한다.
- 구 심볼 6종 소스 전수: offenders **0줄**(차집합).
- 원본 leak: 프로덕션 151파일 중 **0줄**, 같은 술어를 테스트에 대면 3건이 걸린다(양성 짝).
- 렌더 지점: `rg '<StatusLine' --include=*.tsx` 는 4줄을 돌려주고 그중 2줄이 `<StatusLineModel` 이다 — 실제 JSX 지점 **2**.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 스피너 크기 | 14 ↔ 12 ↔ 14 수치 | 실제로 커 보이는가(폰트 렌더링·DPI) | 앱에서 턴 시작 후 상태줄 관측 |
| 스트리밍 체감 | 정적 상한 + 격리 실측 | 실제 앱에서 출력이 끊기지 않는가 | 긴 응답 스트리밍 중 관측 |

- 더 내릴 수 있었는가: **AT-211 은 내렸다** — 사람 실기로 넘기지 않고 Electron + CDP 하네스로 직접 쟀다(§5). 그 결과가 이번 FAIL 의 근거다.

## 9. 게이트 재실행

- 실제 실행 명령: `cd app && npm run lint`, `npm run typecheck`, `./node_modules/.bin/vitest run src/renderer`, `node scripts/check-doc-inventory.mjs --check`, `npx vite build -c <임시 css 전용 설정>`(AT-212), `./node_modules/.bin/electron <하네스>`(AT-211).
- 관측한 실행 산출: 위 gate 표 — exit code 가 아니라 파일·케이스·error 수다.
- `npm test` 사용: **안 했다** — DB 를 실행하지 않는 변경이라 ABI 를 뒤집지 않았다(`app/AGENTS.md`).
- 게이트가 작업 트리를 바꿨는가: **아니오** — `npm run lint` 는 `--fix` 지만 실행 전후 `git status --short` 파일 목록이 같다.
- 검증 중 실행한 명령의 잔여물: AT-212 용 임시 vite 설정과 `.spinner-css-out/` 를 **삭제했다**. AT-211 하네스·변이 백업본은 스크래치패드에만 있고 작업 트리는 클린이다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트 | 에이전트 — 위 산출 |
| AC ↔ production path | 에이전트 — §1·§5 |
| 런타임 성능 실측 | 에이전트 — Electron+CDP 로 재측정 |
| **성능 델타의 수용 여부(D-205)** | **사람 — 이번 RETURN_TO_PLAN 의 결정 지점** |
| UI 시각 품질 | **사람 — AT-210** |
| 신규 의존성 / merge | 해당 없음 / 사람 |

## 11. Repository operation checks

- `AGENTS.md` 변경: 없음.
- INDEX 상태/다음 주체/좌표: 이번 검증 커밋에서 `verify/RETURN_TO_PLAN`·다음 주체 설계자로 갱신하고 좌표를 기입한다.
- 대상 커밋 좌표 확인: `git cat-file -t ef2da91c`·`0954242d`·`a8d2d642` = 전부 commit.
- 비고 5줄 이내: 예.
- trailer 허용값·파싱: `a8d2d642` 가 6키를 그대로 반환한다. 설계 커밋 2개는 `Criteria-*`·`Next-Action` 없이 `Status: designed` 다 — 규약대로다.
- `[구현자 기입]` 7필드 전수: **7/7**.
- reference/script: `sparkFrames.ts`·`sparkFrames.test.ts` 삭제 후 살아 있는 소비처 **0건**. `sparkReference.testlib.ts` 는 두 테스트가 쓴다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| AT-206 분모 `3` 이 재현되지 않는다 → 규범 행 정정 요청 | **타당** — 재측정 결과 JSX 지점 2. 정정을 구현과 다른 커밋(`0954242d`)에 둔 것도 규약대로다 | 정정 후 기준으로 채점 |
| `visibility` → `opacity` 축을 "레이아웃에서 빠지지 않는다" 로 보고만 함 | **타당했고, 그 축이 이번 FAIL 의 원인이다** | §5 재측정으로 확인 |
| ΔVP-209 를 `0/2` 로 남기고 검증자에게 넘김 | **타당** — 자기 턴이 재현하지 않은 것을 ✅ 로 세지 않았다 | 검증자가 실행 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | AT-211·AT-212 를 커밋된 테스트가 잠그지 않는다 | §17 · ΔVP-209·ΔVP-210 | NEXT_HANDOFF | (기존 항목 유지) |
| D2 | `SPARK_PERIOD_MS`·`SPARK_REDUCED_MOTION_MARK`·`SPARK_MARKS` 의 프로덕션 참조가 0이다 | 비귀속(plan §11 이 소비자를 테스트로 명시) | NON_BLOCKING | 상수를 원본 대조용으로 남길지 판단 |
| D3 | **재측정에서 신 > 구** — main-thread task 순증가 30.2 → 41.9ms/s, layout 0 → 144회 | **ΔVP-209 / AT-211 / D-205** | **BLOCKING** | 원인은 `opacity: 0` 마크가 레이아웃에 남는 것(§5) |
| D4 | AT-211 의 재현 절차가 산출을 결정하지 못한다 — 하네스가 저장소에 없어 §14 수치와 갈린다 | ΔVP-209 oracle | **PLAN_GAP** | 하네스를 커밋하거나 AT-211 을 재정의한다 |
| D5 | 빌드 산출의 stop 을 `%` 로만 세면 36 이다 — lightningcss 가 `100%` 를 `to` 로 최소화한다 | AT-212 술어 | NON_BLOCKING | AT-212 를 테스트로 승격하면 술어에 반영 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음 — r1 이다.
- 관련 plan 지침/AC 의 존재: 있었다. §9 Delta 표가 `visibility → opacity` 축을 적었고 §17 이 "보간이 페인트가 잦다" 리스크를 적었다 — 다만 둘 다 **재측정 없이** 비용 중립으로 닫혔다.
- 사용자 결정 변경 근거: 없음. D-205 는 ACTIVE 그대로다.
- 반복된 검증 환경 한계: 런타임 성능 oracle 이 저장소 밖에 있다. 0208·0216 두 handoff 가 같은 자리에서 산문 재현 절차에 의존했다.

## 15. 결론

- 상태: **FAIL + PLAN_GAP → `verify/RETURN_TO_PLAN`**
- pair 결과: REQUIRED/REGRESSION **10 PASS · 1 PAIR_FAIL(ΔVP-209)** · ΔVP-211 사람 실기 대기 · BLOCKED_BY 0
- PLAN_GAP: **D4** — ΔVP-209 의 재현 절차가 산출을 결정하지 못한다(하네스 미커밋). 영향 pair: ΔVP-209.
- Product/UX 및 ACTIVE Decision 충족: D-201~D-204·D-206~D-208 충족. **D-205 는 재측정에서 불충족**.
- AC 충족: ✅ 10 · ❌ 1(AT-211) · ⏸ 1(AT-210) = 12
- 현재 변경 운영 gate: subtree·repository·message-bus 3종 PASS — **게이트는 이 회귀를 보지 못한다**(D1).
- NON_BLOCKING / NEXT_HANDOFF: D1·D2·D5
- 남은 사람 확인: AT-210 시각. 그리고 **D-205 의 수용 범위** — 프레임당 0.19ms(3개 동시, 예산의 1.1%) 증가를 "성능감소" 로 볼 것인가.
- 다음 단계: **설계자**. 세 갈래 중 하나를 사용자와 함께 고른다 — ① `opacity` 대신 `visibility`/`display` 로 꺼진 마크를 레이아웃에서 빼고 재측정 ② AT-211 을 "fps 60 유지 + 정적 상한" 으로 재정의하고 D-205 의 수용 범위를 명시 ③ 하네스를 저장소에 커밋해 오라클을 고정한 뒤 다시 잰다. ①은 원본 동일성(D-201)과 상충할 수 있으므로 제품 결정이다.
