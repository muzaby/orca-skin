# Plan — 0327-worker-protocol-visible-views

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력: [0325 plan §6-C C 행 · §6-D](../0325-ui-responsiveness-followup/plan.md) · 0325 첨부 [`input/0324-agent-requests.ko.md`](../0325-ui-responsiveness-followup/input/0324-agent-requests.ko.md)(요청서 — 본문의 `T08`~`T33`) · [`input/0324-audit.ko.md`](../0325-ui-responsiveness-followup/input/0324-audit.ko.md)(감사) · [0326 plan §10 B9](../0326-transcript-incremental-model/plan.md)(스트리밍 꼬리 — "워커는 단계 C").
> 측정 수치는 이번 세션의 실제 소스 함수 재측정이다(§8). 측정 스크립트는 저장소에 두지 않았다 — 같은 입력을 구현 턴의 K1~K8(WU-10)이 다시 잰다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0327-worker-protocol-visible-views` |
| 작성자 | Claude Code |
| 일자 | 2026-11-19 |
| 매핑 | 0325 후속 단계 C — 요청서 T08·T14 잔여·T15 잔여·T22·T23·T27·T33(테마 재강조) · 요청서 "공통 워커 요청 규약" · 0326 B9(스트리밍 꼬리) · 0325 B21(펼친 OpenCode 파일 본문) |
| 상태 | READY (V1) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0324·0325·0326 노드는 INHERITED REGRESSION 으로만 참조한다(`0325:V1 rev 4 + ΔV1 + ΔV2@d868468` — `origin/main` 조상 확인 · `0326:V1 rev 7` — 설계 `5b489f8`, 작업 브랜치, `main` 미병합) |
| 이번 V revision | `V1` — 설계 커밋 좌표 `(V1 설계 — 검증자 기입)` |
| 유효 V | `V1` |
| AS-IS 트리 | `de270fe`(이 브랜치 HEAD = `d868468`(0325 기계 PASS, `main`) + 0326 r1 구현·verify r1). 줄 번호는 이 트리 기준이다 |
| 구현 착수 조건 | 0326 기계 verify PASS 뒤(D-003). 착수 턴은 §18 파일과 §8 줄 참조를 0326 PASS 커밋과 다시 대조해 `[구현자 기입] 설계 리뷰`에 차이를 적는다 — 0327 은 0326 이 고치는 `CodeBlock.tsx`·`ToolCard.tsx`·`markdownBlocks.ts`·`StreamingMarkdown.tsx` 를 함께 고친다(§8 F1) |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 큰 diff·코드·문서를 그리는 화면이 입력 크기에 비례해 창(UI 스레드)이나 계산 워커를 오래 잡는다. Git 패널에서 5만 줄 추가 파일을 펼치면 렌더 작업이 약 13초다(node SSR 기준 — 좌우 짝 찾기 O(n²) 3.8초 포함, §8 M1·M2). 실제 창의 layout·paint 는 이 위에 더해진다(AC30 이 잰다). 같은 파일의 구문 토큰은 워커를 26초 잡아 그동안 다른 코드 강조 요청이 전부 기다리고, 결과를 받는 창은 역직렬화·대조에 수백 ms 를 쓴다(M4). 1MB Markdown 산출물 미리보기는 창에서 11.5초다(node SSR 기준, M6).
- **완료 후 달라지는 것**: 큰 본문은 보이는 행만 그린다 — Git 리뷰 본문·400줄을 넘는 도구 카드 본문·산출물 코드 보기. 구문 색은 보이는 범위만 워커가 만들고, 큰 문서도 한 워커 작업은 상한 안에서 끝나 다른 요청이 사이에 처리된다. 4,000자를 넘는 Markdown(산출물 미리보기 문서·스트리밍 꼬리)은 워커가 파싱하고 창은 받은 결과만 그린다. 워커 요청은 문서 ID·revision 으로 묶여 키가 내용 길이와 무관하다.
- **보장하지 않는 것**: Windows 허용치 판정(0325 D-025 OPEN — W) · 완료된 큰 text 블록의 창 파싱(0326 B11 — D-026) · 한 Markdown 블록 자체의 워커 파싱 시간(§10 B4) · 4,000자 이하 Markdown 과 32,000자 이하 코드 블록의 현행 동기 경로.
- **한 문장**: 5만 줄 diff·5MiB 코드·1MB 문서를 열어도 창은 보이는 행만 그리고, 워커는 보이는 범위만 계산하며, 그 사이에 다른 강조 요청이 밀리지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 325에서 지정했던 새 핸드오프 후보를 이어서 진행한다(핸드오프 325 후속). docs/handoff/index.md, docs/handoff/0325.../input/*.md 요구사항을 참고하면 더욱 명확하다." | 턴 1 (`/handoff-plan 327`) |
| 명시 요구(질의 1) | "C 단독 (Recommended)" — 0327 은 0325 후보 C(워커·Git·코드·산출물) | 턴 1 질의 |
| 명시 요구(질의 2) | "C 전체 하나로" — 선택지 설명 "T08(코드 블록 행 번호)·T27(산출물 Markdown)·T33(테마 재강조)·Claude 도구 카드 행까지 0327에 포함한다. AC 약 30개, 0326과 CodeBlock·ToolCard·markdownBlocks를 함께 고치게 되어 0326 r2 이후로 구현 착수가 밀린다." | 턴 1 질의 |
| 명시 요구(질의 3) | "임계 초과 시 내부 스크롤 (Recommended)" — "400줄을 넘는 본문만 최대 높이(OpenCode와 같은 384px)·내부 스크롤·가시 행 렌더로 바꾼다. 400줄 이하는 지금과 같다. 구문 색은 보이는 행만 요청한다. 카드 복사 버튼은 전체 원문을 그대로 복사한다." | 턴 1 질의 |
| 명시 요구(질의 4) | "블록 + 워커 파싱 (Recommended)" — "문서를 블록으로 나눠(1MB 1.4ms) 화면 근처 블록만 워커가 파싱하고 창은 받은 블록만 그린다. 창 파싱 0, 첫 화면 즉시. 블록 간 참조 정의는 모아 붙이고 목록·인용은 나누지 않는다 … unified·remark-parse·remark-rehype·hast-util-to-jsx-runtime을 직접 의존성으로 선언한다 — react-markdown이 이미 설치하는 전이 의존성이지만 정책상 승인이 필요하다." | 턴 1 질의 |
| 명시 요구(질의 5) | "포함 (Recommended)" — "산출물과 같은 워커 Markdown 파서로 transcript 스트리밍 꼬리를 처리한다. 0326의 StreamingMarkdown·markdownBlocks를 건드리므로 구현은 0326 PASS 뒤에 착수한다." | 턴 1 질의 |
| 명시 요구(첨부) | 요청서 T08·T14·T15·T22·T23·T27·T33 의 "요청할 변경 및 목표 소유자" · 절 "공통 Web Worker·인라인 diff·Git 리뷰" 의 함께 처리할 설계 항목과 완료 기준 | 0325 `input/0324-agent-requests.ko.md` |
| 명시 요구(첨부) | 0325 §6-C C 행 — 선행 계약 "공통 워커 요청 규약 — 문서 ID·revision·옵션 기반 캐시 키 · 취소·오래된 응답 폐기 · 가시 범위 응답, 후속 구현 전" · 완료 근거 "W 계산 · R 가시 DOM · data/agent 원천" | 0325 plan §6-C (PR #633 리뷰 문장) |
| 추론 의도 | 요청서의 "W 가 맡는다" 는 창의 일을 줄이는 수단이다 — 창 비용이 실제로 줄지 않는 이주(전송 직렬화가 계산보다 큰 경우)는 창에 두고 근거를 남긴다 | 설계자 — D-011 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 0327 은 0325 후속 단계 C 다 | "C 단독 (Recommended)" | 턴 1 질의 1 | ACTIVE | — |
| D-002 | C 를 나누지 않는다 — 0325 §6-C C 행의 대응 T 전부(T08·T14 잔여·T15 잔여·T22·T23·T27·T33 테마 재강조)와 Claude 도구 카드 행. AC 25 상한을 넘는다(AC1~AC30) | "C 전체 하나로" | 턴 1 질의 2 | ACTIVE | — |
| D-003 | 이번 산출은 plan(READY)까지다. 구현 착수는 0326 기계 verify PASS 뒤다 | 질의 2 선택지 "0326 r2 이후로 구현 착수가 밀린다" · 질의 5 "구현은 0326 PASS 뒤에 착수한다" | 턴 1 질의 2·5 | ACTIVE | — |
| D-004 | 도구 카드 긴 본문 — 400줄을 넘는 본문만 최대 높이 384px·내부 스크롤·가시 행 렌더. 400줄 이하는 지금과 같다. 구문 색은 보이는 행만 요청한다. 카드 복사 버튼은 전체 원문을 복사한다 | "400줄을 넘는 본문만 최대 높이(OpenCode와 같은 384px)·내부 스크롤·가시 행 렌더로 바꾼다 … 카드 복사 버튼은 전체 원문을 그대로 복사한다" | 턴 1 질의 3 | ACTIVE | — |
| D-005 | 산출물 Markdown 미리보기 — 블록으로 나누고 화면 근처 블록만 워커가 파싱, 창은 받은 블록만 그린다(창 파싱 0 · 첫 화면 즉시). 블록 간 참조 정의를 모아 붙이고 목록·인용은 나누지 않는다. `unified`·`remark-parse`·`remark-rehype`·`hast-util-to-jsx-runtime` 직접 의존성 선언을 승인한다 | "블록 + 워커 파싱 (Recommended)" 선택지 문장 | 턴 1 질의 4 | ACTIVE | — |
| D-006 | 0326 B9(loose list·긴 문단 꼬리)를 포함한다 — 산출물과 같은 워커 Markdown 파서로 스트리밍 꼬리를 처리한다 | "포함 (Recommended)" 선택지 문장 | 턴 1 질의 5 | ACTIVE | — |
| D-007 | 승계: 0324 D-007(50ms·160ms) · 0324 D-008(상한 없는 계산은 UI 스레드에 두지 않는다) · 0324 D-009(워커 실패 시 UI 대체 계산 없음) · 0324 D-012(강조 상한 32,000자) · 0325 D-008(diff 문자 우선 상한) · 0325 D-011 · 0325 D-037(카드 머리 원문 예산) · 0325 D-038(캐시 비용 = 키 + 워커가 센 크기) | 각 plan §3 ACTIVE | 0324·0325 plan | ACTIVE | — |
| D-008 | **공통 워커 요청 규약**(§10 EP-1~EP-4) — ① 문서는 `{ id, revision }` 으로 식별하고 소비자는 임차(lease)한다 ② 문서 본문은 그 문서를 쓰는 첫 작업 직전에 워커마다 한 번 보낸다 ③ 범위 토큰·Markdown 블록·diff 줄 요청은 문서 참조로 보내고 키 = 종류·문서 id@revision·옵션·범위 ④ 한 작업의 일은 상한 안이다 — 넘으면 `continue` 로 대기열에 돌아간다 ⑤ 우선순위 `visible` > `background` ⑥ 취소는 소비자에게서 결과를 떼고, 실행 중 작업은 diff 줄만 워커 교체(D-024) ⑦ 소비자는 현재 revision 과 다른 결과를 버린다 ⑧ 워커가 바뀌면 문서를 다시 보낸다 | 요청서 "공통 워커 요청 규약은 워커 담당자가 소유한다" · 0325 §6-C 선행 계약 "문서 ID·revision·옵션 기반 캐시 키 · 취소·오래된 응답 폐기 · 가시 범위 응답" · 요청서 설계 항목 "워커 실패·연속 실패 폴백, 가시 요청 우선순위, 요청 취소 뒤 오래된 결과 폐기 … 토큰 키에는 문서 revision·언어·테마·표시 옵션을 반영한다" | 요청서 · 0325 §6-C · 설계자 | ACTIVE (사용자 거부 가능 — 0325 D-021 "C 의 워커 규약은 후속 구현 전에 합의할 수 있다": 이 plan 의 검토가 합의 절차다) | — |
| D-009 | 문서 식별 — `id` 는 도메인 식별자(Git: 경로·축·공백 옵션 · 도구 카드: 호출 키·블록·축 · 산출물: publication id · 스트리밍 꼬리: 컴포넌트 인스턴스)이고, `revision` 은 원천 객체 identity 의 단조 번호(`revisionOf(source)` — `WeakMap`)다. 원천이 같으면 다시 마운트해도 같은 문서다 | 내용 해시는 창에서 O(n) 이고, 인스턴스 id 는 가상 스크롤 재마운트마다 캐시를 잃는다(0324 "같은 내용이 캐시에 있으면 다시 놓였을 때 첫 렌더부터 색상" 보존) | 설계자 | ACTIVE | — |
| D-010 | 열린 문서 문자 합 상한 `COMPUTE_DOC_MAX_CHARS = 32,000,000` — 넘으면 새 문서는 보내지 않고 그 문서의 요청은 즉시 실패한다(소비자는 원문) | 패치 한 벌 ≤ 200,000줄(`git-diff-parse.ts:215`) · 산출물 ≤ 5MiB(`formats.ts:5`) | 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-011 | Git 리뷰 본문의 행 모델(diff 줄·hunk·짝·요구사항 색인·폭·축 문서)은 창이 파일마다 O(n) 한 번 만든다 — 워커로 옮기지 않는다 | 5만 줄 줄 객체를 워커로 보내는 구조화 복제 42.6ms(§8 M3)가 창 계산(diff 줄 1.8ms + hunk 11.4ms + 짝 색인 O(n))보다 크다. 요청서 T22 "W가 hunk·좌우 행·주석 위치 인덱스를 만들고" 와 다르다 — 창의 남은 비용은 M2 의 행 DOM 이고 그것은 가시 행이 없앤다 | 설계자 · §8 M1~M3 | ACTIVE (사용자 거부 가능) | — |
| D-012 | 단어 강조 짝은 본문당 O(n) 색인 한 번이다. 결과는 현행 `counterpartOf`(`FileDiffSection.tsx:488-512`)와 모든 입력에서 같다 — 삭제 묶음 뒤 추가 묶음이 짧을 때 다음 묶음의 추가 줄과 짝짓는 현행 동작 포함 | 5만 줄 추가 묶음에서 뒤로 걷기 1,249,975,000회 · 3,788ms(M1) | 설계자 | ACTIVE | — |
| D-013 | 가상 행 규칙 — 행이 400 이하인 목록은 전부, 넘으면 가시 + overscan + 고정 행(선택 끝·초안)만 마운트한다. Git 파일 본문은 스크롤 소유자의 위·아래 한 화면 안에 들지 않으면 행을 그리지 않는다(모두 펼치기 대비). 400 은 D-004 의 임계를 그대로 쓴다 | 모두 펼치기(`diffViewMenuItems.ts:41`) · 파일 200개 상한(`git-diff-parse.ts:18`) | 설계자 · D-004 | ACTIVE | — |
| D-014 | 구문 토큰은 200줄 창 단위 범위 요청이다. 워커는 문서·언어·테마마다 200줄 간격 grammar state 체크포인트를 쌓아 전체 토큰화와 같은 색을 낸다. 테마가 바뀌면 그 테마의 체크포인트를 처음부터 만든다(이전 테마 체크포인트는 문서가 닫힐 때까지 보관) | 200줄 조각 + grammarState = 전체 토큰화와 동일, 상태 없는 조각은 다름(M8) · 다른 테마의 상태를 쓰면 shiki 가 던진다(M8) | 설계자 | ACTIVE | — |
| D-015 | 두 테마 동시 토큰화(테마 전환 무비용)는 쓰지 않는다 | 토큰화 비용 2배 — 2,000줄 988 → 1,958ms(M9). 전환은 드물고 강조는 매번이다 | 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-016 | T33 테마 재강조는 현행 유지로 종결한다 — 동시 실행 1(`client.ts:6`), 재요청 = 마운트된 소비자(효과 deps 에 테마), 이전 테마 대기 요청은 효과 정리가 취소한다. 범위 토큰 소비자는 마운트 창만 다시 요청한다 | 0325 D-043 "조건부 항목은 입력 크기와 실측값을 남겨 현행 유지로 종결할 수 있다" · 32,000자 강조 167.6ms(M5) · DOM 교체 시간은 S-C6 이 잰다 | 설계자 | ACTIVE | — |
| D-017 | T23 변경 파일 트리는 현행 유지로 종결한다 | 파일 200개 트리 0.37ms + 평탄화 0.10ms(M10) | 설계자 · 0325 D-043 | ACTIVE | — |
| D-018 | 0325 B21 — 펼친 OpenCode 파일 본문의 patch 파싱은 창에 둔다. 행은 D-004·D-013 의 가시 행이다 | 990,044자 patch 2.8ms(M11) — 0325 D-037 "펼친 본문 파싱은 C에서 별도로 측정하십시오" | 설계자 | ACTIVE | — |
| D-019 | Markdown 워커 파싱 임계 `MARKDOWN_WORKER_MIN_CHARS = 4,000` — 원문이 넘는 산출물 미리보기 문서와 스트리밍 꼬리만 워커가 파싱한다. 이하는 창 동기(현행) | loose list 4,000자 창 렌더 14.9~18.8ms · 문단 2.8ms(M12) — D-005 "창 파싱 0" 은 임계 초과 문서의 약속이다 | 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-020 | Markdown 문서 블록 = `splitStableBlocks` 결과에 이어짐 합치기(들여쓴 블록 · 앞 블록 끝이 목록 항목이고 다음 블록이 목록 표지로 시작 · 인용 연속)를 적용하고, 블록이 참조하는 링크 정의를 그 블록 입력 끝에 덧붙인다. GFM 각주 정의가 있으면 문서 전체가 한 블록이다 | 분할기 그대로 저장소 문서 717개 중 688 동일 → 정의 덧붙임 +1 · 이어짐 합치기 +27 → 716(공백만인 텍스트 노드 제외, M13) | 설계자 · D-005 | ACTIVE | — |
| D-021 | hast 계약 — 워커는 react-markdown 9 과 같은 파이프라인(`remark-parse`·`remark-gfm`·`remark-rehype` `allowDangerousHtml`)에 raw → text 치환을 적용한 hast 를 낸다. 창은 `href`·`src` 에 react-markdown `defaultUrlTransform` 을 적용하고 `Markdown` 과 같은 components 로 그린다(`passNode`·`passKeys`·`ignoreInvalidStyle`) | `react-markdown/lib/index.js` `post` — raw 노드는 text, URL 속성은 `urlTransform`. 마크다운 문법이 만드는 URL 속성은 `a.href`·`img.src` 뿐이다(raw HTML 은 text 가 된다) | 설계자 | ACTIVE | — |
| D-022 | 마운트 밖 행을 가로지르는 선택의 복사는 행 모델에서 만든다 — 인라인 diff·코드·DiffTable: 줄 본문을 `\n` 으로 잇고 시작·끝 줄은 선택 오프셋까지 · 나란히 보기: 행 단위로 좌·우 본문을 `\t`, 행을 `\n`. 선택의 두 끝이 같은 목록 안일 때만 적용하고 끝 행은 고정 마운트한다 | 가상 행이면 기본 복사가 마운트된 행만 담는다. 0326 D-040(긴 선택 논리 범위)과 같은 목표 | 설계자 | ACTIVE (사용자 거부 가능) | — |
| D-023 | 줄바꿈 끔에서 diff·코드 표의 최소 폭 = 행 모델이 센 최장 줄 열 수(탭은 8칸 정렬 · 동아시아 전각 2칸) — 마운트 행과 무관하다 | 가상 행이면 마운트 행이 폭을 정해 가로 막대가 스크롤마다 흔들린다 | 설계자 | ACTIVE | — |
| D-024 | 실행 중 작업의 취소 — `highlight`·`tokens`·`markdown` 은 워커를 끝내지 않는다(결과는 캐시에만). `diffLines` 만 현행(대기 요청이 있으면 워커 교체)이다 | 워커를 끝내면 열린 문서·체크포인트·하이라이터를 잃는다(5만 줄 앞부분 재토큰화 ≈ 26s, M4). 0324 규칙 "실행 중 취소는 대기 요청이 있으면 워커를 끝내고"(`client.ts:9-10`)를 비용 상한이 없는 diff 줄로 좁힌다 | 설계자 | ACTIVE (0324 규칙 변경 — `client.test.ts:269` 기대를 diffLines 로 바꾼다) | — |
| D-025 | 측정 — `app/scripts/measure-ui-inputs.mjs` 에 K1~K8 함수 재측정과 F6~F8 재현 파일을 더하고(WU-10), Windows 실기 S-C1~S-C7 을 0326 PASS 빌드와 0327 빌드로 0325 §19 규약(빌드 교차 3회 · N/A 규칙 · 설치본·진단 빌드 분리)대로 기록한다. 허용치 판정은 W(0325 D-025 OPEN) | 0325 D-024·D-042 | 설계자 | ACTIVE | — |
| D-026 | 완료된 큰 text 블록의 창 파싱(0326 B11 · `AssistantSegment.tsx:33` `<Markdown source={seg.text}>`)은 0327 범위 밖이다 — 0327 의 워커 Markdown 파서가 그 이주의 기반이 된다(INDEX 후보 표) | D-006 의 범위는 스트리밍 꼬리 · 0325 C 행 T 목록에 T07 없음 | 설계자 | ACTIVE | — |

### 갱신 메모

- V1(턴 1)에서 추가된 결정: D-001~D-026. 사용자 결정은 D-001·D-002·D-004·D-005·D-006(질의 5건), D-003 은 질의 2·5 의 선택지 문장이다.
- 변경된 결정: 없음(새 handoff). 0324 규칙 하나를 좁힌다 — D-024(실행 중 취소의 워커 교체를 diffLines 로).
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0324 D-007·D-008·D-009·D-012 · 0325 D-008·D-011·D-037·D-038(D-007 로 승계) · 0325 D-021(A 의 PASS 와 전체 완료 구분 — 이 plan 이 C 행을 닫는다) · 0325 D-023·D-025 OPEN(E·W — 0327 이 기대지 않는다).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — 대조 근거는 §16 끝 "교차검증 관측"에 문장 단위로 적었다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 + 원인 하나 추가 | T22 의 "전체 행 DOM" 은 원인이 맞다(M2 — 5만 행 SSR 9.2s). 추가로 짝 찾기가 O(n²)이다(M1 — 3.8s). diff 구문 토큰은 크기 상한이 없어 워커를 26s 잡는다(M4) — 요청서 T15·T22 의 "W 처리 대기는 결과 표시 지연" 이 실측으로 크다 |
| 이미 기존 코드가 충족하는가 | 부분 | 카드 머리 증감 예산(0325 D-037)·diff 문자 우선(0325 D-008)·캐시 비용(0325 D-038)은 충족 — 이번에 바꾸지 않는다(VP-41 회귀). T23 은 상한 200파일로 충분(M10 — D-017) |
| 더 작은 해법이 있는가 | 항목별 판정 | T22 의 행 모델을 워커로 옮기는 것보다 창에서 O(n) 한 번이 작다(D-011). T33 은 동시 실행 1·마운트 소비자만 재요청이라 코드 변경 없이 종결한다(D-016). B21 의 patch 파싱은 2.8ms 라 창에 둔다(D-018) |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 — 정정 2 | 감사 "50,000개 표시 행 생성 44.3ms" 는 두 순수 함수 비용이고 렌더·짝 찾기를 뺐다(M1·M2 가 13s 를 보인다). 요청서 T08 "W가 32,000자 이하의 지원 언어를 강조" 는 맞고, T14 "unified patch 원문 경로는 100만 자까지 R에서 파싱" 은 0325 D-037 이후 카드 머리는 원문 예산이고 펼친 본문만 남았다(M11) |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 1 — 사용자 결정 범위 안 | 0324 `client.ts:9-10` 의 실행 중 취소 규칙을 diffLines 로 좁힌다(D-024). 0326 EP-10 의 "features/chat 안 `useVirtualizer(` 1" 은 새 훅을 `shared/ui/virtual/` 에 두어 유지한다(§8 F2) |

- 사용자에게 올린 결정: 5건(D-001·D-002·D-004·D-005·D-006) — 턴 1 에서 받았다. 남은 OPEN 없음.
- 코드 조사로 닫은 사실: §8 M1~M13 · F1~F12.

## 5. 동작 / 사용자 흐름

```text
[Git 패널: 파일 헤더 클릭(펼침) / 모두 펼치기]
  → 창: 행 모델 O(n) 1회(diff 줄·hunk·짝·요구사항 색인·폭·축 문서)
  → 창: 스크롤 소유자 근처 파일만 가시 행 + overscan 마운트 (400행 이하 파일은 전부)
  → 워커: 마운트 행의 축 범위(200줄 창) 토큰 — 문서는 첫 요청 직전 1회 전송
  → 성공: 원문 행이 먼저, 토큰이 오면 그 창의 행만 색으로 교체
  ↘ 워커 실패·문서 상한 초과: 원문 행 그대로(D-009·D-010)
[스크롤·문맥 펼침·요구사항 선택·초안 입력·선택 복사]
  → 창: 가시 범위만 다시 계산 · 위쪽 펼침은 보던 행 고정 · 선택한 요구사항이 화면 밖이면 그 행으로 이동
  → 초안 행·선택 끝 행은 고정 마운트 · 복사는 행 모델에서

[도구 카드 펼침 — Write·Edit·MultiEdit diff · Read · Work 출력 · OpenCode 파일]
  → 400줄 이하: 지금과 같은 DOM
  → 400줄 초과: 384px 내부 스크롤 + 가시 행 + 마운트 행 범위 토큰
  → 카드 복사 버튼: 전체 원문(현행)

[산출물 보기]
  → 코드 모드·텍스트: 400줄 초과면 가상 코드 보기(가시 줄·가시 줄 번호·범위 토큰 — 32,000자 넘어도 색)
  → Markdown 미리보기: 4,000자 초과면 블록 분할 → 원문 블록 즉시 → 근처 블록 워커 파싱 → hast 로 교체
  → HTML·이미지: 현행

[스트리밍 답변의 Markdown 꼬리]
  → 열린 펜스: 현행(StreamingFence)
  → 꼬리 ≤ 4,000자: 현행(창 동기)
  → 꼬리 > 4,000자: 워커 파싱(최신 꼬리만) · 마지막 결과 + 그 뒤 새 글자는 원문
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 가상 본문 첫 마운트 | 가시 행 원문 마운트 → 범위 토큰 요청(visible) | 원문이 바로 보이고 색은 창 단위로 붙는다 |
| 문서 끝 범위 첫 요청(앞 체크포인트 없음) | 워커가 체크포인트를 한 작업당 ≤ 600줄씩 전진(`continue`) · 사이에 다른 요청 처리 | 끝 부분은 원문으로 있다가 앞부분 토큰화가 끝나면 색이 붙는다 — 다른 코드 블록 강조는 밀리지 않는다 |
| 빠른 스크롤 | 화면을 떠난 창의 대기 요청 취소 · 실행 중 작업은 끝까지(캐시) | 되돌아오면 캐시에서 바로 색 |
| 테마 전환 | 마운트 창만 새 테마로 다시 요청 · 새 테마 체크포인트는 처음부터 | 원문으로 바뀌었다가 새 색(현행과 같은 전환) |
| 위쪽 문맥 펼침 | 행 삽입 → 보던 행의 화면 위치 보정(현행 0211 D-090) | 읽던 줄이 제자리 |
| 화면 밖 요구사항 선택 | 그 행 인덱스로 스크롤 → 마운트 → 카드 위치 맞춤 | 선택한 요구사항 카드가 보인다 |
| 선택이 마운트 밖까지 | 끝 행 고정 · 복사 시 행 모델로 문자열 | 복사 결과에 안 보이던 줄도 들어 있다 |
| 문서 revision 변경(새 Git 세대·새 산출물 응답) | 이전 문서 임차 해제(close) · 새 문서로 다시 요청 · 늦게 온 이전 결과 버림 | 새 내용의 원문 → 색 |
| 워커 실패·교체 | 대기 요청 실패/재시도 규칙(현행) · 다음 요청 직전 문서 재전송 | 원문 유지(D-009) 또는 같은 색 |
| Markdown 블록 파싱 전 | 원문 블록(줄바꿈 보존 · 흐린 글자) | 첫 화면이 바로 보인다 |
| 스트리밍 꼬리 시작이 앞으로 이동(블록 확정) | 이전 꼬리 결과 버림 · 새 꼬리 원문 → 워커 결과 | 확정 블록은 위에 그대로, 꼬리는 원문 → 서식 |

### 파생 UX / 엣지케이스

- loading / empty / error: 범위 토큰·블록 파싱 대기와 실패는 원문 표시다(새 문구 없음). 빈 diff·빈 산출물·빈 파일 문구는 현행 키 그대로(`chat.rightpanel.diffEmpty` · `chat.artifactViewer.empty`).
- cancel / retry / close / restart: 화면을 떠난 범위는 대기 요청 취소. 워커 실패는 현행 연속 3회 차단(`COMPUTE_FAILURE_LIMIT`). 워커가 다시 만들어지면 문서를 재전송한다.
- concurrency / multi-session: 워커는 창마다 하나(현행). 여러 세션·패널의 요청이 한 대기열을 쓰고, 한 작업은 상한 안에서 끝나 서로 막지 않는다.
- keyboard / a11y / theme: 내부 스크롤 영역은 `tabIndex=0`·`aria-label`(OpenCode 파일 본문 현행 `ToolBody.tsx:119-122` 와 같은 꼴). 키보드 스크롤은 브라우저 기본. 테마는 D-014·D-016.
- 외부환경/오프라인/폐쇄망: 새 네트워크 없음. 의존성은 이미 `node_modules` 에 있는 전이 의존성을 직접 선언할 뿐이다(D-005).

## 6. 범위 / 비범위

- **범위**: WU-1~WU-10(아래). 공개 IPC·DB·설정·저장 형식 변경 0. 직접 의존성 4개 선언(D-005).
- **비범위**: 단계 D·E·W 판정 · 완료된 큰 text 블록 파싱(D-026) · 4,000자 이하 Markdown 과 `Markdown` 컴포넌트의 다른 호출처(`ApprovalCard`·`PlanTileContent`·`SkillDetail`·`KeyValueBody`) · transcript 안 Markdown 코드 펜스의 가시 줄(펜스는 transcript 블록 안이라 내부 스크롤이 없다 — 현행 강조 상한 32,000자).

| WU | 요청 ID | 내용 | 런타임 소유자(위치) | AC |
|---|---|---|---|---|
| WU-1 | 설계 항목 · T15 잔여 | 공통 워커 요청 규약 — 문서 임차·전송·키·범위·상한 작업·우선순위·취소·재전송 | W(`worker/handler.ts`) · R 클라이언트(`compute/client.ts`·`protocol.ts`·`documents.ts`) | AC1~AC7 |
| WU-2 | T14 잔여 · T22 | 범위 토큰 — 200줄 창 · 체크포인트 · 마운트 행만 | W(토큰화) · R(`useWindowTokens`·`useDiffRowTokens`) | AC3·AC17·AC20·AC22 |
| WU-3 | T22 | Git 리뷰 본문 — 행 모델 O(n) · 짝 색인 · 가상 행(인라인·나란히) · 문맥 펼침 보정 · 요구사항 이동 · 초안·카드 행 · 선택 복사 · 폭 | R(`FileDiffSection`·`lib/diffRowModel`) · W(토큰) · agent 원천(현행) | AC8~AC17 |
| WU-4 | T14 잔여 · D-004 | 도구 카드 긴 본문 — DiffTable·Read·Work 400줄 초과 384px 가상 본문 | R(`DiffTable`·`FileBody`·`WorkToolBody`·OpenCode `FilePanel`) | AC18~AC20 |
| WU-5 | T08 | 코드 — `CodeBlock` 줄 번호 메모 · 가상 코드 보기(`VirtualCodeView`) | R(`CodeBlock`·`VirtualCodeView`) · W(토큰) | AC21·AC22 |
| WU-6 | T27 | 산출물 — 코드 모드 가상 코드 보기 · Markdown 블록 + 워커 파싱 · 회귀 | R(`ArtifactPreviewContent`·`VirtualMarkdownView`·`MarkdownHast`) · W(파싱) · data 원천(현행) | AC22~AC25 |
| WU-7 | 0326 B9 | 스트리밍 꼬리 워커 파싱 | R(`StreamingMarkdown`·`WorkerMarkdownTail`) · W(파싱) | AC26·AC27 |
| WU-8 | — | 공통 가상 행 훅 · 행 선택 복사 | R(`shared/ui/virtual/`) | AC10·AC11·AC15·AC18·AC19·AC22·AC23 |
| WU-9 | D-005 | 의존성 선언 · 경계 가드 · 문서(TRD·AGENTS·실행 모델·컴포넌트 카탈로그) | 개발 도구 · 문서 | AC28 |
| WU-10 | Windows 통합 검증 | 측정 스크립트 K1~K8 · 재현 파일 F6~F8 | 개발 도구(`app/scripts/`) | AC29·AC30 |

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 완료된 큰 text 블록 워커 파싱(0326 B11) | 아니오 — renderer 내부 | 후속 후보(D-026) |
| Windows 허용치 | 아니오 — 판정만 | W(0325 D-025 OPEN) |
| transcript 코드 펜스 가시 줄 | 아니오 | 비범위 — 펜스는 transcript 블록 하나(0326 B11 과 같은 꼴) |

### 6-B. 요청 항목별 판정 (`de270fe`)

| ID | 현재 코드 판정 | 0327 처리 | 근거 |
|---|---|---|---|
| T08 | 확인 — plain 경로 줄 번호를 렌더마다 split·배열·join(100,000줄 18.2ms) · 32,000자 초과는 색 없음 · 큰 원문은 텍스트 노드 하나 | 줄 번호 메모(AC21) · 400줄 초과 본문은 가상 코드 보기 + 범위 토큰(AC19·AC22) · transcript 펜스는 비범위 | `CodeBlock.tsx:92` · §8 M7 |
| T14 잔여 | **측정** — DiffTable 5만 행 SSR 1,316ms · 구문 토큰은 크기 상한 없이 전체 축 · 펼친 OpenCode 본문 patch 파싱 2.8ms | 가상 행(AC18) · 범위 토큰(AC20) · 파싱은 창 유지(D-018) | `DiffTable.tsx:42`·`:55` · `diffSyntax.ts:32-45` · §8 M2·M4·M11 |
| T15 잔여 | 확인 — 요청 키가 내용 전체(5만 줄 축 키 4,155,599자 · 2.07ms) · 결과 순회 크기 집계는 0325 가 워커로 옮김 | 문서 id·revision 키(AC1) · 범위 응답(AC3) · 취소·오래된 결과(AC6·AC7) | `protocol.ts:55-72` · §8 M4 |
| T22 | **재현** — 5만 줄 추가 파일 인라인 SSR 13,038ms · 나란히 2,276ms · 짝 찾기 3,788ms · 구문 토큰 워커 25,848ms · 역직렬화(구조화 복제) 661ms · 대조 47.9ms | WU-3 전체(AC8~AC17) | §8 M1·M2·M4 · `FileDiffSection.tsx:241-255`·`:488-512`·`:550`·`:726` |
| T23 | **측정** — 200파일 트리 0.37ms · 평탄화 0.10ms | 현행 유지 종결(D-017) | `changedFileTree.ts` · §8 M10 |
| T27 | **재현** — Markdown 0.1M자 584ms · 1.0M자 11,543ms(파싱 96%) · 코드 모드는 T08 과 같은 plain 경로 | 블록 + 워커 파싱(AC23·AC24) · 코드 모드 가상 보기(AC22) · HTML·이미지 회귀(AC25) | `ArtifactPreviewContent.tsx:75-92` · §8 M6 |
| T33(테마 재강조) | 조건부 — 마운트 코드 블록마다 재요청, 워커 1개라 동시 1 | 현행 유지 종결(D-016) · 범위 토큰은 마운트 창만(AC17) | `CodeBlock.tsx:39-48` · `client.ts:6` · §8 M5 |
| 0326 B9 | **측정** — loose list 꼬리 20,000자 창 렌더 53.0~62.6ms · 100,000자 250ms(이번 재측정, 0326 M3 은 84·452ms) | 워커 파싱(AC26) · 작은 꼬리·펜스 회귀(AC27) | §8 M12 · `StreamingMarkdown.tsx:52-58` |
| 0325 B21 | **측정** — 990,044자 patch 2.8ms | 창 유지(D-018) · 행은 AC18 | §8 M11 |
| 설계 항목 "워커 실패·연속 실패 폴백" | 확인 — 현행(D-009 · `COMPUTE_FAILURE_LIMIT`) | 유지 + 워커 교체 시 문서 재전송(AC2) | `client.ts:145-159` |
| 설계 항목 "가시 요청 우선순위" | 확인 — 대기열은 크기 순만 | `visible` > `background`(AC5) | `client.ts:203-208` |
| 설계 항목 "취소 뒤 오래된 결과 폐기" | 확인 — 요청 id 대조·소비자 내용 대조 | revision 대조(AC7) | `client.ts:186-189` · `useDiffSyntax.ts:44-48` |
| 완료 기준 "5만 추가 줄 파일" | 재현(T22) | AC10·AC17·AC30 S-C1 | — |
| 완료 기준 "한 줄 수 MB · 작은 MultiEdit 다수 · 100만 자 경계 patch" | 0325 단계 A 가 닫음 | 회귀(VP-41) | 0325 AC11·AC12 |

### 6-C. 0325 §6-C C 행 완료 근거 대응

| 완료 근거(런타임 층) | 0327 의 근거 |
|---|---|
| **W 계산**: revision 키·취소·오래된 응답 폐기·가시 범위 응답 | AC1(키) · AC6(취소) · AC7(revision 폐기) · AC3·AC17(범위 응답) · AC4·AC5(상한 작업·우선순위) |
| **R 가시 DOM**: 5만 줄 Git 파일을 펼쳐도 R 은 보이는 행만 구성 · 스트리밍·타이핑 지연 전후 비교 | AC10·AC11(가시 행) · AC9(초안 입력에 행 모델 재생성 0) · AC30 S-C1(전후 기록) |
| **data/agent 원천**: Git patch 파싱·전송 상한, 산출물 크기·형식 그대로 | 변경 0 — `git-diff-parse.ts` · `artifacts/formats.ts` 미접촉(§18) |
| 좌우 보기·리뷰 좌표·전체 복사 보존 | AC11(좌우) · AC13·AC14(요구사항) · AC15(선택 복사) · AC20(카드 복사) |
| 요청 사항 "T22 를 별도 검증 대상" · "T33 테마 재강조와 입력 높이 측정의 소유자 분리" · "B21 따로 잰다" | AC10·AC30 S-C1 · D-016(T33 은 C, 입력 높이는 D) · D-018 |

## 7. Requirements / Acceptance — `R ↔ AT`

> 수치 입력의 기본값: 가시 높이 600px · 행 추정 20px · overscan 20 · 창 200줄. 테스트는 이 값을 테스트 이음새(`initialRect`·`estimateSize`)로 고정한다(§11 테스트 가능성).

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-06 | AT-06 / AC1 | `tokens`·`diffLines`·`markdown` 요청 키는 종류·문서 `id@revision`·옵션(언어·테마)·범위로만 만든다 — 문서 4,000,000자에서도 키 길이 = id 길이 합 + 64 이하. 같은 `(id, revision)` 재요청은 워커에 가지 않고, revision 만 바뀌면 새로 계산한다. `highlight` 키는 현행(언어·테마·내용 ≤ 32,000자) | UT `protocol.keys.test.ts` pk1~pk4 · IT `client.documents.test.ts` d1(재요청 `postMessage` 0) | 소비 훅 → `computeClient().request` → `requestKey` → 캐시·대기열 |
| R-06 | AT-06 / AC2 | 문서는 그 문서를 쓰는 첫 작업 직전에 그 워커로 한 번 간다(`doc.open` 이 작업 메시지보다 먼저 · 같은 워커 재전송 0). 임차가 모두 놓이면 `doc.close` 1회. 워커가 교체되면 다음 작업 직전 다시 간다. 열린 문서 문자 합이 `COMPUTE_DOC_MAX_CHARS` 를 넘는 새 문서는 보내지 않고 그 문서의 요청은 즉시 실패(워커 메시지 0). 워커의 `unknown-doc` 응답은 문서 재전송 + 그 작업 1회 재시도 | IT `client.documents.test.ts` d1~d6 — 가짜 워커가 받은 메시지 순서 · 실제 `createWorkerState` 를 부르는 가짜 워커 | `useComputeDocument` → `client.openDocument` → `pump` → `ensureDocs` → `postMessage` |
| R-06 | AT-06 / AC3 | `tokens [start, end)` 응답은 `end − start` 행(문서 끝에서 잘림)이고, 각 행은 같은 문서·언어·테마를 한 번에 `codeToTokens` 한 결과의 그 행과 같다(content·color) — 여러 줄 주석·템플릿 문자열이 200줄 경계를 넘는 입력 포함 | UT `worker/tokens.test.ts` t1~t4 — 실제 shiki 하이라이터, 600줄 입력, 범위 `[0,200)`·`[190,410)`·`[400,600)`·`[580,800)` | `useWindowTokens` → `tokens` 요청 → 워커 `tokensRange` |
| R-06 | AT-06 / AC4 | 한 작업이 토큰화하는 줄 수 ≤ `TOKENS_JOB_MAX_LINES`(600). 앞 체크포인트가 모자라면 워커는 체크포인트만 전진하고 `continue` 를 돌려 작업은 같은 등급 맨 뒤로 간다(대기자 유지 · 대기자 0 이면 버림). 5만 줄 문서 끝 범위 요청이 진행 중일 때 들어온 `highlight` 는 다음 작업으로 실행된다 | UT `worker/tokens.test.ts` t5(작업당 토큰화 줄 수 계수 · `continue` 횟수 = ⌈전진 줄 / 600⌉) · IT `client.queue.test.ts` q4(실제 순서 기록) | 클라이언트 `receive` `continue` → `enqueue` |
| R-06 | AT-06 / AC5 | `visible` 요청은 `background` 보다 먼저 나간다. 같은 등급 안은 현행(크기 오름차순 · 먼저 온 것). 기본 등급은 `visible`. 가상 목록의 화면 안 창 = `visible`, overscan 만의 창 = `background` | UT `client.queue.test.ts` q1~q3 · IT `useWindowTokens.test.ts` wt2(창 등급) | `useWindowTokens` → `request(…, { priority })` → `enqueue` |
| R-06 | AT-06 / AC6 | 실행 중 작업 취소 — `highlight`·`tokens`·`markdown` 은 워커 유지(`terminate` 0 · 결과는 상한 안이면 캐시에만). `diffLines` 는 대기 요청이 있으면 워커 교체(현행). 취소한 소비자는 결과를 받지 않는다 · 대기 중 취소는 보내지 않는다(현행) | IT `client.queue.test.ts` q5~q7 · `client.test.ts:'실행 중 요청이 취소되고 대기 요청이 있으면 워커를 끝내고 새 워커에 대기 요청을 보낸다'` 를 `diffLines` 입력으로 바꾼다 | `handle.cancel` → `cancel(job, waiter)` |
| R-06 | AT-06 / AC7 | 소비자는 현재 문서 revision 과 다른 결과를 반영하지 않는다 — r1 범위 요청 실행 중 원천 객체가 바뀌면(r2) 늦게 온 r1 결과는 화면에 0, r2 결과만 반영 | IT `useWindowTokens.test.ts` wt4 · `VirtualMarkdownView.test.ts` m5 | 소비 훅 결과 수신 → revision 대조 |
| R-01 | AT-01 / AC8 | 단어 강조 짝은 본문당 `buildCounterparts` 한 번(O(n)) — 5만 줄 추가 묶음에서 줄 배열 읽기 ≤ 4n(현행 뒤로 걷기 1,249,975,000). 결과는 현행 `counterpartOf` 와 모든 입력에서 같다 | UT `diffRowModel.test.ts` cp1(길이 ≤ 8 전수 3⁸ = 6,561 + 무작위 10,000 · 현행 함수 사본 대조) · cp2(읽기 계수 Proxy) · IT `fileDiffVirtual.render.test.ts` v11(단어 강조 `mark` 위치) | `FileDiffBody` → 행 모델 → `LineText` counterpart |
| R-01 | AT-01 / AC9 | 행 모델(`buildDiffRowModel`)은 (patch 파일 객체, 공백 옵션)마다 한 번, 요구사항 색인은 (요구사항 배열, 경로)마다 한 번 — 초안 입력 10회·요구사항 선택·스크롤이 다시 만들지 않는다. 선택 요구사항의 줄 찾기는 색인 조회다(본문 `findIndex` 0) | IT `fileDiffVirtual.render.test.ts` v9 — 렌더 하네스, 두 함수 호출 계수 | `FileDiffBody` 메모 |
| R-01 | AT-01 / AC10 | 펼친 파일 본문 마운트 행 — 400행 이하: 전부(스크롤 소유자 위·아래 한 화면 안일 때) · 400행 초과: 화면 안 + overscan + 고정 행. 5만 줄 추가 파일: 마운트 행 ≤ 30 + 40 + 고정. 모두 펼치기 200파일 × 300행(파일 높이 32 + 6,000px · 근처 = 위·아래 한 화면을 더한 1,800px): 행을 그리는 파일 ≤ 2 · 마운트 행 ≤ 600 · 나머지 198파일은 행 0(높이 자리만) | IT `fileDiffVirtual.render.test.ts` v1·v2·v3(400행 이하 소형 fixture 는 현행 SSR 과 같음) | `DiffReview` → `FileDiffSection` → `FileDiffBody` → `useVirtualRows` |
| R-01 | AT-01 / AC11 | 나란히 보기도 같은 마운트 규칙이다. 짝 행은 현행 `toSideBySideRows` 결과와 같다(gap 제자리 · 묶음 안 k번째끼리) | IT v4 · UT `diffRowModel.test.ts` sb1(묶음별 대조) | `SideBySideBody` → `useVirtualRows` |
| R-01 | AT-01 / AC12 | 위쪽 문맥 펼침 뒤 펼친 gap 아래 첫 줄의 화면 위치가 펼치기 전과 같다(±1px) · 아래쪽은 보정 0 — 400행 초과 파일에서도. 꼬리 여백 계획은 현행 `planUpwardExpansionCompensation` | IT v5 — 가짜 DOM rect · `scrollTop` 변화 = 삽입 행 높이 합 | `GapRow` 클릭 → `expand` → layout effect |
| R-01 | AT-01 / AC13 | 선택한 요구사항의 카드 항목이 마운트 밖이면 그 인덱스로 `scrollToIndex`(center) 한 뒤 카드에 현행 `revealDiffRequirement` 를 한다 — 5만 줄 파일 49,000번째 줄 요구사항 선택 → 카드 마운트 · `scrollIntoView` 1회 | IT v6 | 선택 → `FileDiffBody` effect → `scrollToIndex` → rAF → `revealDiffRequirement` |
| R-01 | AT-01 / AC14 | 초안 행·요구사항 카드 행은 가상 항목이다. 초안 행은 초안이 있는 동안 고정 마운트(화면 밖으로 스크롤해도 textarea 와 초점 유지)이고, 높이 변화는 측정되어 아래 행 위치에 반영된다 | IT v7 | `onDraftChange` → 항목 목록 → `useVirtualRows` pins |
| R-01 | AT-01 / AC15 | 선택의 두 끝이 같은 목록 안이면 끝 행은 화면 밖이어도 마운트된다. `copy` 는 행 모델 문자열 — 인라인: 선택 줄 본문을 `\n` 으로(시작 줄은 시작 오프셋부터, 끝 줄은 끝 오프셋까지, 거터 제외) · 나란히: 선택 행 범위의 `left.text + '\t' + right.text`(빈 칸 `''`) 를 `\n` 으로. 끝이 목록 밖이면 기본 복사 | UT `rowSelection.test.ts` r1~r5 · IT v8(1번 줄 3번째 글자 → 40,000번 줄 5번째 글자 선택 복사) | `selectionchange` → pins · `onCopy` → `rowsCopyText` |
| R-01 | AT-01 / AC16 | 줄바꿈 끔이면 본문 표 최소 폭 = `widthColumns` ch + 거터 — 마운트 행이 바뀌어도 같은 값. 줄바꿈 켬이면 최소 폭 없음 | UT `diffRowModel.test.ts` p1~p3(탭 8칸 정렬 · 전각 2 · 최댓값) · IT v10 | 행 모델 → 표 `style.minWidth` |
| R-01 | AT-01 / AC17 | 구문 색 — 마운트 행의 축 줄을 200줄 창으로 묶어 창마다 `tokens` 1회. 5만 줄 첫 화면 요청 창 ≤ 2, 축 문서는 펼침당 2개(old·new), 전체 축 `diffTokens` 요청 0. 색은 전체 토큰화와 같다(AC3). 테마 전환은 마운트 창만 다시 요청. 토큰 원문 대조(`content` 연결 = 줄 본문)가 틀린 행은 원문 | IT `useDiffRowTokens.test.ts` rt1~rt5 — 가짜 계산 클라이언트 요청 기록 | `FileDiffBody` → `useDiffDocuments` → `useDiffRowTokens` → `useWindowTokens` |
| R-02 | AT-02 / AC18 | 400줄 초과 `DiffTable`(Claude 구조화 패치·쌍 · OpenCode 파일 본문)은 최대 높이 384px 내부 스크롤 + 가시 행 · 400 이하는 현행 DOM. OpenCode 는 기존 `max-h-[384px]` 컨테이너를 스크롤 요소로 받는다(스크롤 요소 1) | IT `DiffTable.virtual.test.ts` dt1·dt2(400행 SSR = 현행) · dt3(OpenCode 5만 줄 스크롤 요소 1) · `longToolBody.render.test.ts` lb1(Claude 쌍 diff 401줄) | `DiffBody`·`PairBlock`·`FilePanel` → `DiffTable` → `useVirtualRows` |
| R-02 | AT-02 / AC19 | 400줄 초과 Read(줄 번호)·Work 출력 본문은 `VirtualCodeView`(384px · 가시 줄 · Read 는 가시 줄 번호만) · 400 이하는 현행 `CodeBlock` · Work 오류 색 동일 | IT `longToolBody.render.test.ts` lb2~lb4 | `FileBody`·`WorkToolBody` → `VirtualCodeView` |
| R-02 | AT-02 / AC20 | 카드 복사 버튼 문자열은 전체 원문(현행 `copyText(call)`). 구문 색은 마운트 행 범위만 — 쌍 diff 는 old·new 원문이 문서(축 문서 생성 0), 구조화 패치·patch 는 축 문서 | IT `longToolBody.render.test.ts` lb5 · `useDiffRowTokens.test.ts` rt6 | `ToolCard` 복사 · `DiffTable` → `useDiffDocuments` |
| R-03 | AT-03 / AC21 | `CodeBlock` plain 경로의 줄 번호 열은 같은 `code` 에서 한 번 만든다 — 다시 렌더 10회에 `split` 1회 · 출력 현행과 같음 | UT `CodeBlock.render.test.ts` cb1 | `CodeBlock` 렌더 |
| R-03 | AT-03 / AC22 | 산출물 코드 모드·텍스트 형식이 400줄 초과면 `VirtualCodeView` — 5MiB 문서 마운트 줄 ≤ 가시 + overscan · 줄 번호는 마운트 줄만 · 지원 언어면 32,000자를 넘어도 마운트 창 `tokens` 로 색 · 줄 시작 색인은 원문당 1회 | IT `VirtualCodeView.test.ts` x1~x4 · `ArtifactPreviewContent.render.test.ts` a4 | `ArtifactViewer` → `ArtifactPreviewContent` → `VirtualCodeView` |
| R-04 | AT-04 / AC23 | Markdown 미리보기 원문 > 4,000자면 `VirtualMarkdownView` — 블록 분할(D-020) → 마운트 블록 ≤ 가시 + overscan → 파싱 전 블록은 원문 즉시 → 워커 `markdown` hast 로 교체. 이 경로의 창 remark 파싱 0(`Markdown` 호출 0) · 4,000자 이하는 현행 `<Markdown>` | IT `VirtualMarkdownView.test.ts` m1~m4 | `ArtifactPreviewContent` → `VirtualMarkdownView` → `markdown` 요청 → `MarkdownHast` |
| R-04 | AT-04 / AC24 | 충실도 — fixture 묶음(목록 안 펜스 · loose list · 참조 링크 · 표 · HTML 텍스트 · 인용 연속 · 제목 · 차단 이미지 · 각주)에서 블록별 hast 를 `MarkdownHast` 로 그려 이은 결과 = `<Markdown source>` 전체 렌더(공백만인 텍스트 노드·SSR 구분 주석 제외). 각주 문서는 전체 한 블록 | UT `markdownDocumentBlocks.test.ts` mb1~mb5 · IT `MarkdownHast.fidelity.test.ts` f1 — 실제 워커 파싱 함수 | `markdownDocumentBlocks` → 워커 `markdownBlock` → `MarkdownHast` |
| R-04 | AT-04 / AC25 | 산출물 HTML 은 정리된 문서만 sandbox iframe · 이미지 실패·재시도 · 모드 전환 · 다운로드 — 지금 그대로 | 기존 `ArtifactPreviewContent.render.test.ts` 3건 · `ArtifactViewer.actions.test.ts` | `ArtifactViewer` |
| R-05 | AT-05 / AC26 | 열린 펜스가 아닌 꼬리 > 4,000자는 창 remark 파싱 0 — 워커 `markdown`(꼬리가 바뀌면 대기 중 이전 요청 취소 · 최신 꼬리 하나). 마지막 결과 원문이 현재 꼬리의 접두면 그 hast + 나머지 글자 원문, 접두가 아니면 현재 꼬리 원문만 | IT `WorkerMarkdownTail.test.ts` s1~s5 | `StreamingMarkdown` → `WorkerMarkdownTail` → `markdown` 요청 → `MarkdownHast` |
| R-05 | AT-05 / AC27 | 꼬리 ≤ 4,000자는 현행 창 동기 `<Markdown>` · 열린 펜스는 현행 `StreamingFence` | `StreamingMarkdown.fence.test.ts:'StreamingMarkdown renders open fence without invoking Markdown for the tail'` · `WorkerMarkdownTail.test.ts` s6(4,000자 → `Markdown`) | `StreamingMarkdown` |
| R-08 | AT-08 / AC28 | `app/package.json` 직접 의존성 4개(설치 버전 범위) · TRD §2 행 · `app/AGENTS.md` 채택 목록 · 실행 모델 계산 워커 행 갱신 · UI 스레드 소스의 `unified`·`remark-parse`·`remark-rehype` 값 import 0(가드 규칙 (b) — 워커 구역만) | gate `node scripts/check-ui-thread.mjs` · `scripts/check-ui-thread.test.mjs` 신규 케이스(UI 파일 import → 위반 1) · EP-14 `rg` | 빌드·CI 가드 |
| R-07 | AT-07 / AC29 | `measure-ui-inputs.mjs` K1~K8 — 결정적 입력 · `--src` 두 트리 비교 · 함수 없음 `N/A(함수 없음)` · 재현 파일 F6~F8 | `node --test scripts/measure-ui-inputs.test.mjs` K 케이스 | 개발 도구 |
| R-07 | AT-07 / AC30 | Windows 실기 S-C1~S-C7 — 0326 PASS 빌드와 0327 빌드, 0325 §19 규약으로 기록 | 사람 실기 · §19 | 설치본 |

### AC 검증 주의사항

- 기존 테스트 재사용: `client.test.ts` 29건 중 취소 1건(`:269`)의 입력을 diffLines 로 바꾸고 나머지는 그대로 통과해야 한다(VP-40). Git 패널 렌더 테스트(`diffTile.render`·`diffRequirementSelection.render`·`diffSyntax.render`·`fileDiffRequirementReveal`·`diffPanel0211dv6.render`)는 400행 이하 fixture 라 전부 렌더 경로를 탄다 — 그대로 통과해야 한다(VP-43). `diffSyntax.render.test.ts` 는 토큰 공급이 `useDiffRowTokens` 로 바뀌므로 가짜 계산 클라이언트 응답 형상만 바꾼다(단언은 그대로).
- 사람 실기 항목: AC30 뿐이다 — 실제 Chromium 의 layout·paint 와 Windows 장비 시간은 node 에서 잴 수 없다. 마운트 수·요청 수·작업 줄 수·문자열은 전부 AC1~AC29 의 기계 단언이다.
- N회/총량 기준: AC4 의 작업당 줄 수는 워커 `tokensRange` 안의 `codeToTokens` 호출에 넘긴 줄 수 합으로 센다 — 토큰화 호출부는 `tokensRange` 하나다(EP-3 검색). AC17 의 창 수는 가짜 클라이언트가 받은 `tokens` 요청 수다 — `tokens` 요청을 만드는 production 호출부는 `useWindowTokens` 하나다(EP-16 검색).
- 총량/0건 기준: AC23·AC26 "창 remark 파싱 0" 은 `react-markdown` 모듈의 `default` export 호출 계수(vi.mock spy)와 UI 소스의 parser import 0(AC28)을 짝짓는다 — 계수만으로는 다른 경로의 파서 import 를 못 보고, import 0 만으로는 `Markdown` 호출을 못 본다.

## 7-A. V / Trace Matrix

- V mode 판정: `Baseline V` — 0327 은 새 handoff 이고 명시적으로 상속할 V 가 없다. 0324·0325·0326 의 영향받는 노드는 `INHERITED` REGRESSION 으로만 참조한다.
- 기준 V 상속 근거: 없음. REGRESSION 출처 — `0325:V1 rev 4 + ΔV1 + ΔV2@d868468`(`main` 조상 확인) · `0324:V1 rev 4.9@22a6d06`(0325 메타가 `origin/main` 조상으로 확인) · `0326:V1 rev 7`(설계 `5b489f8` — 작업 브랜치 해시, `main` 미병합 · 착수 때 0326 PASS 좌표로 바꾼다, D-003).
- `SUPERSEDED` 로 분해한 pair 의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | Git 리뷰 본문 — AC8~AC17 | NEW | — |
| R-02 | R | 도구 카드 긴 본문 — AC18~AC20 | NEW | — |
| R-03 | R | 코드 줄 번호·가상 코드 보기 — AC21·AC22 | NEW | — |
| R-04 | R | 산출물 Markdown·회귀 — AC23~AC25 | NEW | — |
| R-05 | R | 스트리밍 꼬리 — AC26·AC27 | NEW | — |
| R-06 | R | 공통 워커 요청 규약 — AC1~AC7 | NEW | — |
| R-07 | R | 측정·Windows 기록 — AC29·AC30 | NEW | — |
| R-08 | R | 의존성·경계 — AC28 | NEW | — |
| AT-01~AT-08 | AT | 위 R 의 AC 묶음 | NEW | — |
| SD-01 | SD | 문서 수명 — 임차 → 첫 작업 전 전송 → 해제·닫기 · 워커 교체 재전송 · 상한 초과 | NEW | — |
| SD-02 | SD | 범위 토큰 진행 — 요청 → 체크포인트 전진(`continue`) → 범위 응답 · 다른 요청 끼어들기 · 테마별 체크포인트 | NEW | — |
| SD-03 | SD | Git 본문 상호작용 — 펼침 → 스크롤 → 문맥 펼침 → 요구사항 선택 → 초안 → 선택·복사 → 접기(문서 해제) | NEW | — |
| SD-04 | SD | Markdown 문서·꼬리 — 블록 분할 → 원문 자리 → 근처 블록 요청 → hast 교체 · 꼬리 최신 요청 | NEW | — |
| ST-01~ST-04 | ST | 위 SD 의 종단 증거 | NEW | — |
| AR-01 | AR | 클라이언트 ↔ 워커 메시지 — `doc.open`·`doc.close`·작업·`continue`·`unknown-doc`(§10 EP-1~EP-4) | NEW | — |
| AR-02 | AR | 문서 참조 생산자 — 도메인 id + `revisionOf` → 소비 훅(EP-5·EP-16) | NEW | — |
| AR-03 | AR | 가상 행 훅 ↔ 소비자 다섯(Git 인라인·나란히 · DiffTable · VirtualCodeView · VirtualMarkdownView)(EP-8·EP-11) | NEW | — |
| AR-04 | AR | hast 계약 — 워커 후처리 ↔ `MarkdownHast` components(EP-12) | NEW | — |
| AR-05 | AR | 경계 가드·의존성 — 규칙 (b) 모듈 · `package.json` · 문서(EP-14) | CHANGED | `app/scripts/ui-thread-rules.mjs:247-249` |
| IT-01~IT-05 | IT | 위 AR 의 통합 증거 | NEW | — |
| MD-01 | MD | 짝 색인(EP-6) | NEW | — |
| MD-02 | MD | 행 모델 — 요구사항 색인·폭·축 문서(EP-7) | NEW | — |
| MD-03 | MD | 체크포인트 토큰화(EP-3) | NEW | — |
| MD-04 | MD | Markdown 문서 블록 — 분할·이어짐·정의·각주(EP-12 ①②) | NEW | — |
| MD-05 | MD | 행 선택 복사(EP-10) | NEW | — |
| MD-06 | MD | 꼬리 상태 — 최신 요청·접두·시작 이동(EP-13) | NEW | — |
| MD-07 | MD | 요청 키(EP-1) | CHANGED | `protocol.ts:55-72` |
| MD-08 | MD | 대기열 — 등급·크기·`continue`·취소 규칙(EP-4) | CHANGED | `client.ts:203-226` · 0324 규칙 `client.ts:5-12` |
| MD-09 | MD | `CodeBlock` 줄 번호 메모(EP-15) | CHANGED | `CodeBlock.tsx:92` |
| MD-10 | MD | 가상 행 범위 — 전부/가상/근처 판정 · 고정 행 · scrollMargin(EP-8 ①~⑤) | NEW | — |
| UT-01~UT-10 | UT | 위 MD 의 국소 증거 | NEW | — |
| R-0324-CMP | R | 0324 계산 워커 실패·연속 실패·UI 대체 계산 없음(D-009) | INHERITED | `0324:V1 rev 4.9@22a6d06` — `client.test.ts` describe `'실패 (AC12)'` |
| R-0325-CAP | R | 0325 diff 문자 우선 상한·카드 머리 원문 예산(VP-14~16) | INHERITED | `0325@d868468` — `inline.test.ts` |
| AR-0325-CACHE | AR | 0325 캐시 비용 = 키 + 워커 크기 · 미보관(VP-18~20) | INHERITED | `0325@d868468` — `client.test.ts` describe `'캐시 비용 (0325)'` |
| R-0324-HL | R | 0324 코드 강조 — 스트리밍 생략·캐시 첫 렌더·취소·실패 원문(AC8) | INHERITED | `CodeBlock.compute.test.ts` 8건 |
| R-0211-GIT | R | Git 패널 — 파일 순서·접기·요구사항·좌우·공백 숨김·구문 색(0211·0218·0228) | INHERITED | `diffTile.render.test.ts` · `diffRequirementSelection.render.test.ts` · `fileDiffRequirementReveal.test.ts` · `diffSyntax.render.test.ts` · `diffHunks*.test.ts` · `diffViewport.test.ts` |
| R-ART | R | 산출물 보기 — HTML 격리·이미지·모드·다운로드 | INHERITED | `ArtifactPreviewContent.render.test.ts` · `ArtifactViewer.actions.test.ts` |
| R-0326-FENCE | R | 0326 열린 펜스 꼬리(AC28) | INHERITED | `0326:V1 rev 7` — `StreamingMarkdown.fence.test.ts` |
| AR-0326-VP | AR | 0326 transcript 공통 뷰포트 — 세 진입점 · features/chat `useVirtualizer(` 1(EP-10) | INHERITED | `0326:V1 rev 7` — 0326 VP-21(좌표는 0326 PASS 커밋 — `de270fe` 에는 없음, §8 검산) |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 파일 펼침 → `FileDiffBody` 행 모델 → `useVirtualRows` → 행 마운트 → `useDiffRowTokens` → 색 | AC8~AC17 좌표 — 하위 pair VP-12·VP-21·VP-22·VP-30·VP-31·VP-34 가 edge 마다 덮는다(아래 각 행) | not selected — 하위 pair 가 고른다 | EP-6·EP-7·EP-8 ⑥⑦·EP-9·EP-16 공유 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 카드 펼침 → `DiffBody`/`FilePanel`/`FileBody`/`WorkToolBody` → 임계 → `DiffTable`·`VirtualCodeView` → `useVirtualRows` | `DiffTable.virtual.test.ts` dt1~dt3 · `longToolBody.render.test.ts` lb1~lb5 · `useDiffRowTokens.test.ts` rt6 | required — 임계 비교를 `>=` 로 뒤집는 변이(400행 → 가상, dt2 red) · 카드 복사를 마운트 행 문자열로 바꾸는 변이(lb5 red) | EP-11 (5) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `CodeBlock` 렌더 · `VirtualCodeView` → 줄 시작 색인 → 가시 줄 → `useWindowTokens` | `CodeBlock.render.test.ts` cb1 · `VirtualCodeView.test.ts` x1~x4 | required — 메모 deps 에 `theme` 을 넣는 변이(cb1 red) | EP-15 (2) · EP-8 ⑨ |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 산출물 열기 → `ArtifactPreviewContent` 임계 → `VirtualMarkdownView` → 블록 → `markdown` 요청 → `MarkdownHast` | `VirtualMarkdownView.test.ts` m1~m5 · `MarkdownHast.fidelity.test.ts` f1 · `ArtifactPreviewContent.render.test.ts` a4·a5 | required — 임계를 0 으로 바꾸는 변이(작은 문서도 워커 — a5 red) · 블록 파싱 전 원문 자리를 빈 값으로 바꾸는 변이(m2 red) | EP-12 (8) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | delta → `StreamingMarkdown` → 임계 → `WorkerMarkdownTail` → `markdown` 요청 → `MarkdownHast` + 원문 꼬리 | `WorkerMarkdownTail.test.ts` s1~s6 | required — 접두 검사를 지우는 변이(꼬리 시작 이동 뒤 중복 표시 — s4 red) | EP-13 (5) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | 소비 훅 → `request` → 키·대기열·문서 → 워커 → 응답 → 소비 훅 | AC1~AC7 좌표 — VP-10·VP-11·VP-20·VP-32·VP-36 이 덮는다 | not selected — 하위 pair 가 고른다 | EP-1~EP-4 공유 |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | `measure-ui-inputs.mjs --src` → K1~K8 / 설치본 실기 | `measure-ui-inputs.test.mjs` K 케이스 · 사람 기록(§19) | not selected — 측정 도구 | 0 — 제품 코드 강제 지점 없음 |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | 소스 → `check-ui-thread.mjs` → 규칙 (b) | `check-ui-thread.test.mjs` 신규 케이스 · gate `node scripts/check-ui-thread.mjs` | required — 규칙 (b) 모듈 목록에서 `remark-parse` 를 빼는 변이(신규 케이스 red) | EP-14 (5) |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | `useComputeDocument` 마운트 → `openDocument` → 첫 작업 → `ensureDocs` → `doc.open` → 작업 → 해제 → `doc.close` · 워커 실패 → 재전송 | `client.documents.test.ts` d1~d6 | required — 워커 교체 때 전송 표시를 초기화하지 않는 변이(d3 red — 새 워커에 문서 없음 → `unknown-doc`) · 해제에서 `doc.close` 를 지우는 변이(d2 red) | EP-2 (9) |
| VP-11 | SD-02 ↔ ST-02 | REQUIRED | `tokens` 요청 → 워커 체크포인트 전진 `continue` → 재대기 → 범위 응답 · 사이에 `highlight` | `client.queue.test.ts` q4 · `worker/tokens.test.ts` t5·t6 | required — `continue` 를 등급 맨 앞으로 넣는 변이(q4 red — highlight 가 밀림) | EP-3 ③ · EP-4 ③ |
| VP-12 | SD-03 ↔ ST-03 | REQUIRED | 펼침 → 스크롤 → gap 위쪽 펼침 → 요구사항 선택 → 초안 → 선택 복사 → 접기 | `fileDiffVirtual.render.test.ts` v5~v8 · v12(접기 → 축 문서 2 해제) | required — 위쪽 펼침 보정의 `insertedAbove` 를 0 으로 고정하는 변이(v5 red) · `scrollToIndex` 를 지우는 변이(v6 red) | EP-9 (6) |
| VP-13 | SD-04 ↔ ST-04 | REQUIRED | 산출물 마운트 → 블록 → 원문 자리 → 근처 블록 `markdown`(visible·background) → 교체 · 문서 revision 변경 | `VirtualMarkdownView.test.ts` m2·m3·m5 | not selected — 직접 값 단언 | EP-12 ⑦⑧ |
| VP-20 | AR-01 ↔ IT-01 | REQUIRED | 클라이언트 `postMessage` → 실제 `createWorkerState().handle` → 응답 `parseResponse` → `receive` | `client.documents.test.ts` d4(실제 처리기 · `tokens` 왕복) · `worker/handler.test.ts` h6~h8(제어 메시지·`unknown-doc`·`continue`) | required — `parseResponse` 가 `continue` 를 형식 오류로 버리는 변이(d4 red — 작업이 끝나지 않음) | EP-2 ⑥~⑨ · EP-4 ③ |
| VP-21 | AR-02 ↔ IT-02 | REQUIRED | 원천 객체 → `revisionOf` → `useComputeDocument` → `DocRef` → 요청 키 | `documents.test.ts` o1~o4 · `useDiffRowTokens.test.ts` rt3(같은 patch 객체 재펼침 → 같은 키 · 캐시) · `VirtualCodeView.test.ts` x5 · `VirtualMarkdownView.test.ts` m5 · `WorkerMarkdownTail.test.ts` s2 | required — Git 문서 id 에서 공백 옵션을 빼는 변이(rt3b red — 공백 숨김 전환 뒤 이전 축 토큰 재사용) | EP-5 (9) · EP-16 ①~③ |
| VP-22 | AR-03 ↔ IT-03 | REQUIRED | 소비자 → `useVirtualRows({count, pins, scrollElement, fullUpTo})` → TanStack `Virtualizer` → 항목 → 마운트 | `useVirtualRows.test.ts` u1~u6(실제 `@tanstack/virtual-core`) · 소비자 좌표 v1·v4·dt1·x1·m1 | required — `rangeExtractor` 에서 pins 합집합을 지우는 변이(u3 red · v7 red) · 근처 판정을 늘 참으로 하는 변이(v2 red) | EP-8 (10) |
| VP-23 | AR-04 ↔ IT-04 | REQUIRED | 워커 `markdownBlock` → hast(raw → text) → 구조화 복제 → `MarkdownHast`(urlTransform·components) | `MarkdownHast.fidelity.test.ts` f1·f2(`javascript:` 링크 → 빈 href · data 이미지만 표시) · `worker/markdown.test.ts` mw1~mw4 | required — raw → text 치환을 지우는 변이(f1 red — raw 노드 출력) · urlTransform 을 지우는 변이(f2 red) | EP-12 ②~⑥ |
| VP-24 | AR-05 ↔ IT-05 | REQUIRED | = VP-08 경로 + `package.json`·문서 | VP-08 좌표 + EP-14 `rg` 5파일 결과 | VP-08 과 같음 | EP-14 (5) |
| VP-30 | MD-01 ↔ UT-01 | REQUIRED | `buildCounterparts(lines)` | `diffRowModel.test.ts` cp1·cp2 | required — 추가 줄 짝의 `removedStart + offset` 을 `removedEnd − offset` 으로 바꾸는 변이(cp1 red) | EP-6 (2) + 음성 1 |
| VP-31 | MD-02 ↔ UT-02 | REQUIRED | `buildDiffRowModel(lines)` · `buildRequirementIndex(items, path)` | `diffRowModel.test.ts` p1~p3 · ax1~ax3(축 문서 = 현행 `axisText` · `indexOf`) · ri1~ri4(요구사항 색인 = 현행 `diffRequirementMatchesLine` 전수 대조) | required — 탭 폭을 1 로 바꾸는 변이(p1 red) · 요구사항 old 단독 색인을 빼는 변이(ri2 red) | EP-7 (5) |
| VP-32 | MD-03 ↔ UT-03 | REQUIRED | 워커 `tokensRange(doc, lang, theme, start, end)` | `worker/tokens.test.ts` t1~t6 | required — 체크포인트 grammarState 전달을 지우는 변이(t2 red — 여러 줄 주석 색) · 테마 키를 체크포인트 키에서 빼는 변이(t6 red — shiki 오류 또는 다른 색) | EP-3 (6) |
| VP-33 | MD-04 ↔ UT-04 | REQUIRED | `markdownDocumentBlocks(source)` · 워커 정의 덧붙임 | `markdownDocumentBlocks.test.ts` mb1~mb5 · `worker/markdown.test.ts` mw2 | required — 이어짐 합치기의 목록 표지 조건을 지우는 변이(mb2 red) · 각주 폴백을 지우는 변이(mb5 red) | EP-12 ①② |
| VP-34 | MD-05 ↔ UT-05 | REQUIRED | `selectionRowEndpoints` → `rowsCopyText` | `rowSelection.test.ts` r1~r5 | required — 끝 줄 오프셋 자르기를 지우는 변이(r2 red) · 나란히 `\t` 를 `\n` 으로 바꾸는 변이(r4 red) | EP-10 (6) |
| VP-35 | MD-06 ↔ UT-06 | REQUIRED | `WorkerMarkdownTail` 상태 | `WorkerMarkdownTail.test.ts` s1~s5 | VP-05 와 같음 | EP-13 ②~⑤ |
| VP-36 | MD-07·MD-08 ↔ UT-07 | REQUIRED | `requestKey` · `requestSize` · `enqueue` · `cancel` | `protocol.keys.test.ts` pk1~pk4 · `client.queue.test.ts` q1~q7 | required — tokens 키에서 `revision` 을 빼는 변이(pk2 red) · 취소 규칙의 `diffLines` 조건을 지워 늘 워커를 끝내는 변이(q6 red) | EP-1 (5) · EP-4 (5) |
| VP-37 | MD-09 ↔ UT-08 | REQUIRED | `CodeBlock` plain 렌더 | `CodeBlock.render.test.ts` cb1 · 기존 `:'shows all line numbers for plain text before a grammar is available'` | VP-03 과 같음 | EP-15 (2) |
| VP-38 | MD-10 ↔ UT-09 | REQUIRED | `useVirtualRows` 범위 판정 | `useVirtualRows.test.ts` u1~u6 | VP-22 와 같음 | EP-8 ①~⑤ |
| VP-40 | R-0324-CMP ↔ AT | REGRESSION | 워커 실패 → 대기 요청 → 연속 실패 차단 · 문서 재전송은 VP-10 | `client.test.ts` describe `'실패 (AC12)'` 7건(문서 규약 뒤 그대로) | not selected | — |
| VP-41 | R-0325-CAP ↔ AT | REGRESSION | 카드 머리 증감 · 인라인 diff 상한 | `inline.test.ts` 전건 · `filePresentation.test.ts` | not selected | — |
| VP-42 | AR-0325-CACHE ↔ IT | REGRESSION | 응답 `size` → 캐시 비용 | `client.test.ts` describe `'캐시 비용 (0325)'` k1~k7 · `:'caches by the size the worker computed, without measuring on the UI thread'` — k5 는 `diffLines` 입력이 문서 참조로 바뀐다 | not selected | — |
| VP-43 | R-0211-GIT ↔ AT | REGRESSION | Git 패널 소형 fixture 경로(400행 이하 = 전부 렌더) | R-0211-GIT 기준선 출처 6파일 전건 | not selected — VP-22 v3 가 소형 경로를 잠근다 | — |
| VP-44 | R-0324-HL ↔ AT | REGRESSION | `CodeBlock` → `useHighlightedHtml` | `CodeBlock.compute.test.ts` 8건 | not selected | — |
| VP-45 | R-ART ↔ AT | REGRESSION | `ArtifactViewer` → `ArtifactPreviewContent` HTML·이미지 | `ArtifactPreviewContent.render.test.ts` 3건 · `ArtifactViewer.actions.test.ts` | not selected | — |
| VP-46 | R-0326-FENCE ↔ AT | REGRESSION | `StreamingMarkdown` 열린 펜스 | `StreamingMarkdown.fence.test.ts` | not selected | — |
| VP-47 | AR-0326-VP ↔ IT | REGRESSION | transcript 세 진입점 → `TranscriptViewport` | 0326 PASS 커밋의 0326 VP-21 좌표(착수 대조에서 실재 확인 — `de270fe` 에 없음) · gate EP-8 검색 `rg -n "useVirtualizer\(" src/renderer/src/features/chat --glob '!*.test.*'` → 1 | not selected | — |

`§10 강제 지점 전수`의 N 은 §10 `언제 강제`에 고정한 자리 목록의 수다. 하위 pair 가 상위 pair 를 덮는 경우 상위 path 의 edge 마다 덮는 좌표를 행에 적었다 — VP-01: 펼침 → 행 모델(v9 · c1) → 가상 행(v1·v4) → 상호작용(v5~v8) → 토큰(rt1~rt5) → 색(v11).

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 가드 5종 | `app/**` 수정 · 규칙 (b) 변경 · 측정 스크립트 추가 | `cd app && node scripts/check-migrations-appendonly.mjs && node scripts/check-doc-inventory.mjs --check && node scripts/check-product-naming.mjs && node scripts/check-test-budgets.mjs && node scripts/check-ui-thread.mjs` | 이번 변경이 만든 위반 |
| lint · typecheck | 새 파일·boundaries(shared 훅 · features import) | `npm run lint && npm run typecheck` | 0 error |
| 전체 vitest · node --test | 테스트 추가·수정 · 가드 테스트 | 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` | 변경 전(0326 PASS 커밋) 실패 집합과 차집합 ∅ + 환경 서명만 기준선(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`) |
| 번들·스모크 | 워커 번들에 remark 계열 추가 · preload 무변경 확인 | `npx electron-vite build && node scripts/smoke-hosts.mjs && node scripts/smoke-preload.mjs out/preload` | 빌드 실패·스모크 실패 |
| 테스트 소스 규칙 | 새 테스트 파일 다수 | `git diff --name-only` 의 테스트 파일마다 `[test-pools]`·예산 가드 위반 0 (`app/AGENTS.md` 테스트 소스 규칙) | 이번 변경의 테스트 파일 |
| 문서 인벤토리 | TRD·AGENTS·실행 모델·카탈로그 수정 | `node scripts/check-doc-inventory.mjs --check`(링크·수치) | 이번 변경 문서 |
| message bus | plan·INDEX·커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | trailer 파싱 0건 |

> 보안·데이터 무결성 제약: 산출물 HTML 격리(VP-45)·이미지 data URI 만 표시(VP-23 f2)·raw HTML 은 text(D-021)는 V node 에 귀속했다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 재현·측정 (이번 세션 — Linux · Node v22.23.5 · esbuild 번들로 실제 소스 함수·컴포넌트 호출 · 1회 예열 뒤 중앙값)

| ID | 입력 | 관측 | 판정 |
|---|---|---|---|
| M1 | 추가 줄 5,000 / 20,000 / 50,000 · 현행 `counterpartOf`(`FileDiffSection.tsx:488-512` 본문 그대로)를 모든 행에 | 21.81ms / 319.15ms / 3,788.1ms(1회) · 같은 종류 묶음 시작까지 뒤로 걷기 12,497,500 / 199,990,000 / 1,249,975,000. 100줄 삭제 + 100줄 추가 반복 50,000줄은 14.04ms | 재현 — 묶음 길이의 제곱(D-012) |
| M2 | 같은 입력 · `renderToString(FileDiffSection)` 인라인 / 나란히 | 인라인 437.2 / 2,246.1 / 13,038.0ms(56.0MB · `<tr` 50,000) · 나란히 202.9 / 953.7 / 2,275.9ms. 순수 함수(50,000): `patchLinesToDiffLines` 1.78 · `buildDiffHunks(3)` 11.44 · 공백 접기 3.04 · `toSideBySideRows` 2.16 · 축 문자열(`diffTokensRequest`) 9.52 · 키 2.07ms(4,155,599자) | 재현 — 인라인 13.0s 중 짝 3.8s 를 뺀 약 9.2s 가 행 렌더다 |
| M3 | 50,000줄 · `structuredClone`(포트 전송과 같은 알고리즘) | 줄 객체 42.56ms · 이은 문자열(4,155,559자) 2.87ms · hunk 행 66.37ms · 200행 창 0.21ms · `JSON.stringify` 16.08ms | 행 모델을 워커로 보내는 비용 ≥ 창 계산(D-011) · 문서는 문자열로 보낸다(D-008 ②) |
| M4 | 같은 파일 · 워커 `compute(diffTokens)`(같은 처리기 · shiki JS 엔진) | 5,000줄 2,378ms · 20,000 10,411ms · 50,000 25,848ms(토큰 750,000 · `resultSize` 32,905,560 > 캐시 상한 → 미보관). 결과 복제 42 / 248 / 661ms · 창 대조 `mapDiffTokens` 3.3 / 12.4 / 47.9ms | 재현 — 워커 1개라 그동안 다른 요청 대기(D-014) |
| M5 | 32,000자 TS · `highlight` | 워커 167.6ms · HTML 233,387자 · span 6,000 | 강조 한 건의 상한 — T33(D-016) |
| M6 | 합성 Markdown(제목·문단·목록·표·펜스 반복) · `renderToString(Markdown)` · `unified` 파싱(remark-parse + remark-gfm + remark-rehype) | 0.10M자 583.9ms · 1.00M자 11,543.1ms. 파싱만 537 / 11,035ms(96%) · 최상위 hast 45,939 · 전체 hast 복제 716ms · 최상위 50개 창 복제 0.60ms | 재현 — 창 비용은 파싱(D-005) |
| M7 | `CodeBlock.tsx:92` 식(`Array.from({ length: code.split('\n').length }, …).join('\n')`) · `renderToString(CodeBlock plain showLineNumbers)` · `renderToString(DiffTable)` | 10,000줄 0.91ms · 100,000줄(4.18M자) 18.16ms · CodeBlock 100,000줄 SSR 20.1ms · DiffTable 500 / 5,000 / 50,000행 27.0 / 108.3 / 1,315.5ms | 줄 번호는 렌더마다 O(n)(AC21) · DiffTable 은 행 수에 비례(AC18) |
| M8 | shiki 1.29.2 · TS 2,000줄 · 200줄 조각마다 `getLastGrammarState` → 다음 조각 `grammarState` | 전체 한 번 987.7ms · 조각 이어 읽기 739.6ms · 결과 동일 `true`. 여러 줄 주석·템플릿이 경계를 넘는 600줄: 상태 이어 읽기 동일 `true` · 상태 없이 조각 `false`. light 상태로 dark 토큰화 → `ShikiError: Grammar state themes "github-light" do not contain highlight theme "github-dark"` | 체크포인트로 정확한 범위 토큰(D-014) · 체크포인트는 테마별 |
| M9 | 같은 2,000줄 · 두 테마 동시(`themes: { light, dark }`) | `codeToTokens` 1,958.1ms(단일 987.7) · `codeToHtml` 1,965.6ms(단일 889.8) · 토큰 `htmlStyle: {color, --shiki-dark}` | 두 테마 동시는 비용 2배(D-015) |
| M10 | 경로 200개(깊이 5) · `buildChangedFileTree` · `visibleTreeRows` | 0.37ms · 0.10ms · 평탄 행 499 | T23 현행 유지(D-017) |
| M11 | 990,044자 unified patch(15,049줄) · `unifiedDiffLines` | 2.8ms | B21 파싱 창 유지(D-018) |
| M12 | 꼬리 — loose list / 문단 2,000·4,000·8,000·20,000자 · `renderToString(Markdown)` · 파싱 · hast 복제 · hast → React 만(`toJsxRuntime`) | loose list 렌더 10.18 / 14.85 / 36.11 / 62.59ms · 파싱 3.97 / 6.18 / 14.49 / 40.40 · 복제 0.25 / 0.91 / 1.43 / 4.51. 문단 렌더 2.61 / 2.84 / 7.53 / 14.28. hast → React 만: loose 4,000 2.0ms(전체 18.8) · 20,000 3.0ms(53.0) · 100,000 22.1ms(250.0) | 4,000자 임계(D-019) · 워커 파싱 뒤 창은 hast 반영만(AC26) |
| M13 | `docs/**/*.md`(60KB 미만 717개) · `splitStableBlocks` 블록을 따로 그려 이은 결과 vs 전체 렌더(SSR 구분 주석 제외) | 태그 사이 공백만 무시 681 동일 · 공백 텍스트 노드 무시 688 → 참조 정의 덧붙임 +1 → 이어짐 합치기(들여쓴 블록·목록 표지 연속) +27 = 716 · 남은 1(`docs/spec/claude/agent-sdk/typescript.md`). 분할 비용 0.26M자 0.5ms(182블록) · 1.05M자 1.4ms(725블록). 실제 문서 블록별 렌더: 0326 plan 263K자 중앙값 0.95ms · p95 9.45 · 최대 144.9(표 한 블록 45,433자) · 첫 30블록 346ms | 블록 모델(D-020) · 큰 표 블록은 창이면 장기 작업 → 워커(D-005) |

재현 스크립트는 저장소에 두지 않았다(스크래치). 같은 입력을 K1~K8(WU-10)이 구현 트리와 0326 PASS 트리에서 다시 잰다. 시간 단언은 테스트에 두지 않는다 — 계수·문자열·마운트 수로 잠근다.

### 발견 / 제약

| ID | 발견 / 제약 | 근거 |
|---|---|---|
| F1 | 0326 r1 이 0327 과 같은 파일을 고친다 — `CodeBlock.tsx`(`data-transcript-chrome`) · `ToolCard.tsx` · `markdownBlocks.ts`(스캐너 상태) · `StreamingMarkdown.tsx`(열린 펜스) | `git diff --name-only origin/main..HEAD -- app` |
| F2 | 0326 은 "features/chat 안 `useVirtualizer(` 1" 을 §10 EP-10 검색으로 잠근다 — 새 가상 행 훅은 `shared/ui/virtual/` 에 둔다 | `rg -n "useVirtualizer\(" src/renderer/src --glob '!*.test.*'` → 1(`TranscriptViewport.tsx:256`) · 0326 plan EP-10 |
| F3 | 계산 클라이언트 — 워커에 나간 요청 1 · 대기열 크기 순 · 같은 키 공유 · 실행 중 취소 + 대기 요청 → 워커 교체 · 연속 실패 3 차단 · 캐시 비용 = 키 + 워커 크기 | `client.ts:5-12` · `:203-208` · `:210-226` · `:109-125` |
| F4 | diff 구문 토큰 요청은 크기 상한이 없다 — 미지원 언어·빈 줄만 `null` · 축 문자열을 렌더 effect 마다 만든다 | `diffSyntax.ts:32-45` · `useDiffSyntax.ts:30-43` |
| F5 | 토큰 결과 대조(`row.map(content).join === line.text`)가 UI 스레드에서 축 줄 전부 | `diffSyntax.ts:47-64` |
| F6 | Git 패치는 전문맥이고 파일당 50,000줄 · 한 벌 200,000줄 · 파일 200 상한 | `ipc.ts:1438` · `git-diff-parse.ts:212`·`:215`·`:18` |
| F7 | Git 패널은 스크롤 소유자 하나(0211 D-073) · 모두 펼치기 메뉴가 있다 | `DiffReview.tsx:117-121` · `diffViewMenuItems.ts:41` |
| F8 | `FileDiffBody` 는 렌더마다 `diffLines.findIndex` · 행마다 `requirements.filter` · 나란히 보기는 렌더마다 묶음과 `toSideBySideRows` | `FileDiffSection.tsx:255` · `:610`·`:768` · `:703-726` |
| F9 | 위쪽 펼침 보정은 DOM 앵커 rect 와 꼬리 여백 · 요구사항 이동은 marker `querySelector` 후 `scrollIntoView` | `FileDiffSection.tsx:305-328`·`:330-350` · `diffViewport.ts` · `diffRequirementScroll.ts` · `:285` |
| F10 | Claude 도구 카드 본문은 높이 상한 없음 · OpenCode 파일 본문은 `max-h-[384px] overflow-auto` | `ToolCard.tsx:220-226` · `ToolBody.tsx:119-122` |
| F11 | 산출물 — 최대 5MiB · Markdown 미리보기는 `<Markdown source={result.content}>` · 기본 모드 text=code 그 외 preview · 뷰어 본문 스크롤 요소 | `artifacts/formats.ts:5` · `ArtifactPreviewContent.tsx:91` · `artifactViewerStore.ts:136` · `ArtifactViewer.tsx:127` |
| F12 | react-markdown 9.1.0 `post` — raw → text(skipHtml 거짓) · URL 속성 → `urlTransform` · `toJsxRuntime({ passKeys, passNode, ignoreInvalidStyle })`. 설치 버전: unified 11.0.5 · remark-parse 11.0.0 · remark-rehype 11.1.2 · hast-util-to-jsx-runtime 2.3.6(react-markdown 의 의존성) | `node_modules/react-markdown/lib/index.js` `post` · `package.json` |
| F13 | shiki 1.29.2 `grammarState`·`getLastGrammarState` · 상태는 테마별 | `@shikijs/types` d.mts `CodeToTokensBaseOptions.grammarState` · M8 |
| F14 | TanStack virtual-core 3.17.6 — `enabled`·`rangeExtractor`·`scrollMargin`·`measureElement`. 목록이 화면 밖이면 범위가 첫 항목 + overscan 이라 근처 판정이 따로 필요하다 | `virtual-core/dist/esm/index.js` `calculateRangeImpl` · `index.d.ts` `enabled` |
| F15 | 테스트 환경은 node · 컴포넌트 실행은 `renderHarness.testfixture.ts`(가짜 DOM·훅·rAF) · SSR + cheerio | `vitest.config` `environment: 'node'` · `shared/ui/renderHarness.testfixture.ts:1-14` |
| F16 | 측정 스크립트는 0325 I1~I9·F1~F5 · 0326 J1~J9 를 갖는다 | `app/scripts/measure-ui-inputs.mjs:32-923` |
| F17 | 테마 구독자는 둘 — `CodeBlock` · `useDiffSyntax` | `CodeBlock.tsx:103` · `useDiffSyntax.ts:19` |
| F18 | `Markdown` 은 `react-markdown` 기본(`remarkGfm`, rehype 플러그인 없음) · components 맵은 모듈 상수 | `Markdown.tsx:20-137`·`:150-161` |

### 전수 조사 (`app/` · AS-IS `de270fe`)

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| S1 계산 클라이언트 호출 | `rg -n "computeClient\(\)" src/renderer/src --glob '!*.test.*'` | 5 | 정의 1(`client.ts:263`) · `useHighlightedHtml` 2 · `useDiffLines` 1 · `useDiffSyntax` 1 |
| S2 `diffTokens` | `rg -n "diffTokens" src/renderer/src --glob '!*.test.*'` | 10 | `useDiffSyntax` 2 · `diffSyntax` 2 · `protocol` 5 · `handler` 1 — TO-BE 0(EP-16 ⑤) |
| S3 `DiffTable` 호출 | `rg -n "<DiffTable" src/renderer/src --glob '!*.test.*'` | 3 | `DiffBody.tsx:86`·`:105` · OpenCode `ToolBody.tsx:124` |
| S4 `CodeBlock` 호출 | `rg -n "<CodeBlock" src/renderer/src --glob '!*.test.*'` | 5 | `StreamingMarkdown:23` · `Markdown:134` · `WorkToolBody:29` · `FileBody:19` · `ArtifactPreviewContent:77` |
| S5 `useVirtualizer(` | `rg -n "useVirtualizer\(" src/renderer/src --glob '!*.test.*'` | 1 | `TranscriptViewport.tsx:256` — TO-BE 2(+ `shared/ui/virtual/useVirtualRows.ts`) |
| S6 테마 구독 | `rg -n "subscribeTheme" src/renderer/src --glob '!*.test.*'` | 5 | 정의 1 · import 2 · 사용 2 |
| S7 `<Markdown` 호출 | `rg -n "<Markdown\b" src/renderer/src --glob '!*.test.*'` 중 `Markdown.tsx` 제외 | 12 | 0327 이 바꾸는 곳은 `ArtifactPreviewContent:91`(임계 분기) · `StreamingMarkdown:57`(임계 분기) 둘뿐 |
| S8 `counterpartOf` | `rg -n "counterpartOf" src/renderer/src --glob '!*.test.*'` | 2 | 정의 `:488` · 호출 `:652` — TO-BE 0(EP-6 음성) |
| S9 diff 구문 소비 | `rg -n "useDiffSyntax\(\|DiffSyntaxContext" src/renderer/src --glob '!*.test.*'` | 7 | `DiffTable` 1 · `FileDiffSection` 3 · 훅 3 — TO-BE `useDiffRowTokens` 로 대체 |
| S10 `client.test.ts` 케이스 | `grep -c "^\s*it(" src/renderer/src/shared/compute/client.test.ts` | 29 | 1건(`:269`)의 입력만 diffLines 로 바꾼다(D-024) |

### 수치 / 전칭 표현 검산

- 재측정 수치: M1~M13(위 표 — 이번 세션).
- 내역 합 = 총계: S1 5 = 1+2+1+1 · S2 10 = 2+2+5+1 · S6 5 = 1+2+2 · S9 7 = 1+3+3 · M13 716 = 688+1+27, 717 = 716+1.
- "유일한" 반례 검색: "토큰화 호출부는 워커 `tokensRange` 하나" — TO-BE 술어 `rg -n "codeToTokens\(" src/renderer/src/shared/compute/worker --glob '!*.test.ts'` → `tokensRange` 안 1 + `highlight` 는 `codeToHtml`(EP-3 검색이 확인). "tokens 요청을 만드는 곳은 `useWindowTokens` 하나" — TO-BE `rg -n "kind: 'tokens'" src/renderer/src --glob '!*.test.*'` → 1(EP-16).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `client.test.ts:269`·`:288` · `CodeBlock.compute.test.ts` 8건 · `CodeBlock.render.test.ts:7` · `ArtifactPreviewContent.render.test.ts:16`·`:36`·`:48` · `StreamingMarkdown.fence.test.ts:42` 를 `grep -n "it("` 로 확인했다. 0326 VP-21 의 좌표 `transcript.viewport.test.ts` 는 `de270fe`(0326 r1) 트리에 없다(`ls src/renderer/src/features/chat/harnesses/registries/` — 0326 verify r1 D2 "좌표 부재"의 하나). VP-47 은 착수 대조(D-003) 때 0326 PASS 커밋에서 실재를 확인하고, 지금 실재하는 것은 EP-8 검색뿐이다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`~`SD-04` · `AR-01`~`AR-04`.
- 현재 책임 소유자: 계산 워커 = 강조 HTML·diff 두 축 토큰·diff 줄(요청마다 본문 전체를 싣는다). 창 = Git 행 모델·짝 찾기·행 전부 렌더·토큰 대조, 도구 카드 행 전부, 코드 줄 번호, 산출물·꼬리 Markdown 파싱.
- 현재 entry → flow → consumer: Git 펼침 → `FileDiffBody` diff 줄·hunk(메모) → 렌더마다 `findIndex`·행마다 `requirements.filter`·`counterpartOf`(O(묶음²)) → 행 전부 `<tr>` → `useDiffSyntax` 가 축 문자열 전체로 `diffTokens` 요청 → 워커 전체 토큰화 → 결과 복제·`mapDiffTokens` → 색.
- 현재 오류/취소/정리: 효과 정리가 요청 취소 · 실행 중 취소 + 대기 요청 → 워커 교체 · 워커 실패 → 원문.
- 문제의 직접 원인: ① 행 DOM 이 줄 수에 비례(M2·M7) ② 짝 찾기 제곱(M1) ③ 토큰 요청이 문서 전체·상한 없음(M4) ④ Markdown 파싱이 창(M6·M12) ⑤ 요청 키가 내용 전체(M2 키 2.07ms).

```text
[펼침 · 카드 펼침 · 산출물 열기 · delta]
  → FileDiffBody / DiffTable / CodeBlock / <Markdown>        (행 전부 · 파싱 창)
  → computeClient.request({ kind: 'diffTokens', oldText, newText })   (본문 전체 · 키 = 본문)
  → worker compute → codeToTokens(전체)                        (26s · 다른 요청 대기)
  → postMessage(rows 전체) → mapDiffTokens(전체) → 행 전부 색
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같음.
- 변경 후 책임 소유자: 워커 = 열린 문서 보관 · 범위 토큰(체크포인트) · Markdown 블록 파싱(hast) · diff 줄(문서 참조) · 강조 HTML(현행). 창 = 문서 임차 · 행 모델 O(n) 1회 · 가시 행 마운트 · 마운트 창 요청 · hast → React · 선택 복사.
- 변경 후 entry → flow → consumer: Git 펼침 → `buildDiffRowModel`(1회) → `useDiffDocuments`(축 문서 2 임차) → `useVirtualRows`(근처 판정 → 가시 + overscan + 고정) → 마운트 행 렌더 → `useDiffRowTokens` → `useWindowTokens`(200줄 창마다 `tokens` · visible/background) → 클라이언트(`ensureDocs` → 작업) → 워커 `tokensRange`(체크포인트 · 상한 작업 · `continue`) → 창 행 색.
- 변경 후 오류/취소/정리: 마운트에서 빠진 창은 대기 요청 취소 · 실행 중 tokens·markdown·highlight 는 워커 유지 · 문서는 임차 0 이면 `doc.close` · 워커 실패·교체 → 다음 작업 직전 재전송 · 결과 revision 이 다르면 버림.
- 유지하는 기존 메커니즘: 캐시 비용(0325 D-038) · 연속 실패 차단 · D-009 · 강조 상한 32,000자와 `useHighlightedHtml` · `inline.ts` 상한(0325) · 위쪽 펼침 보정 계획(`planUpwardExpansionCompensation`) · `revealDiffRequirement` · `expandGap`/`revealDiffHunkLine` · `toSideBySideRows` · `collapseWhitespaceOnlyChanges` · `splitStableBlocks`. 제거/대체: `diffTokens` 요청·`diffTokensRequest`·`mapDiffTokens`·`useDiffSyntax`(→ `useDiffRowTokens`) · `counterpartOf`(→ `buildCounterparts`) · 실행 중 취소의 워커 교체(→ diffLines 만).

```text
[펼침 · 카드 펼침(>400) · 산출물 열기 · delta(>4,000자 꼬리)]
  → 행 모델 O(n) 1회 / 블록 분할 1회 / 줄 시작 색인 1회
  → useComputeDocument(id, revisionSource, text) ── lease ──▶ client.openDocument   (revision = revisionOf(revisionSource))
  → useVirtualRows(근처 판정 · 가시 + overscan + pins)
  → 마운트 행·블록만 렌더 (원문 먼저)
  → useWindowTokens(200줄 창) / markdown(블록) ── request(priority) ──▶ client
        client: ensureDocs(doc.open 1회/워커) → postMessage(작업 · 키 = id@rev·옵션·범위)
  → worker: tokensRange(체크포인트 · ≤600줄/작업 · continue) / markdownBlock(hast · raw→text)
  → 창: revision 대조 → 마운트 행 색 / MarkdownHast(components · urlTransform)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 워커: 요청 본문 전체 계산 · 창: 행 전부 · Markdown 파싱 | 워커: 문서 보관·범위·블록 파싱 · 창: 가시 행·hast 반영 | M2·M4·M6 | AR-01·AR-03·AR-04 / VP-20·VP-22·VP-23 · §11 WU-1·WU-8 |
| data/control flow | 요청마다 본문 복제 · 결과 전체 복제 · 대기열 크기 순 | 문서 1회 전송 · 범위 결과 · 등급 → 크기 · `continue` 재대기 | M3·M4 | SD-01·SD-02 / VP-10·VP-11 · `client.documents.test.ts`·`client.queue.test.ts` |
| state/contract | 요청 `{oldText,newText}` · 키 = 본문 · 응답 2종 | `DocRef` · 제어 메시지 2종 · 응답 3종(`continue`) · 키 = id@rev | T15 잔여 · D-008 | AR-01 / VP-20·VP-36 · `protocol.ts` |
| error/lifecycle | 실행 중 취소 → 워커 교체(전 종류) | diffLines 만 교체 · 문서 재전송 · `unknown-doc` 재시도 1 | D-024 | SD-01 / VP-10 · d3·d5 · q6 |
| Git 렌더 | 행 전부 · 짝 O(n²) · 렌더마다 검색 | 행 모델 1회 · 가시 행 · 고정 행 · 행 모델 복사 | M1·M2·F8 | SD-03·MD-01·MD-02 / VP-12·VP-30·VP-31 · `fileDiffVirtual.render.test.ts` |
| 도구 카드 | 행 전부 · 높이 상한 없음(Claude) | 400줄 초과 384px 가상 본문 | D-004 | R-02 / VP-02 · `DiffTable.virtual.test.ts`·`longToolBody.render.test.ts` |
| 산출물·꼬리 Markdown | 창 파싱 전체 | 4,000자 초과 → 블록·워커 파싱 · hast | D-005·D-006·D-019 | SD-04·AR-04·MD-04·MD-06 / VP-04·VP-05·VP-13·VP-23·VP-33 |
| test seam/관측점 | SSR + 가짜 클라이언트(요청 기록) | + 가짜 워커 메시지 기록 · 실제 워커 상태 · `useVirtualRows` `initialRect` · react-markdown spy | 계수 단언 | 각 VP 좌표 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/compute/protocol.ts` | 요청·응답·제어 메시지 형 · `docKey` · `requestKey` · `requestSize` · `requestDocs` · `parseResponse` | 요청 → 키·크기·문서 목록 | client · worker · 소비 훅 |
| `shared/compute/client.ts` | 대기열·문서 등록부·전송·캐시·취소·실패 | 요청·임차 → 결과 promise | 소비 훅 |
| `shared/compute/documents.ts` | `revisionOf(source)` · `useComputeDocument(ref, text)` | 원천 → `DocRef \| null`(임차·해제) | `useDiffDocuments` · `VirtualCodeView` · `VirtualMarkdownView` · `WorkerMarkdownTail` |
| `shared/compute/worker/state.ts`(신규) · `handler.ts` | 워커 문서 보관 · 작업 분기 · 응답 | 메시지 → 응답 | `compute.worker.ts` |
| `shared/compute/worker/tokens.ts`(신규) | 줄 시작 색인 · 체크포인트 · 범위 토큰 · 작업 상한 | 문서·범위 → 행 / `continue` | `state.ts` |
| `shared/compute/worker/markdown.ts`(신규) | 블록 텍스트 + 참조 정의 → unified → hast · raw → text | 문서·범위 → hast | `state.ts` |
| `shared/ui/virtual/useVirtualRows.ts`(신규) | TanStack 래퍼 — 전부/가상/근처 판정 · pins · scrollMargin · 측정 | 개수·키·크기·스크롤 요소 → 항목 | Git 본문 2 · `DiffTable` · `VirtualCodeView` · `VirtualMarkdownView` |
| `shared/ui/virtual/rowSelection.ts`(신규) | 선택 끝 → (행, 오프셋) · `rowsCopyText` | DOM 선택·행 문자열 → 복사 문자열 | 위 소비자 |
| `shared/ui/markdown/MarkdownHast.tsx`(신규) · `markdownComponents.tsx`(분리) | hast → React(같은 components · urlTransform) | hast → 요소 | `VirtualMarkdownView` · `WorkerMarkdownTail` · `Markdown`(components 공유) |
| `features/chat/lib/diffRowModel.ts`(신규) | 짝 색인 · 폭 · 축 문서 · 요구사항 색인 | `DiffLine[]` → 모델 | `FileDiffBody` · `DiffTable` |
| `features/chat/lib/markdownDocumentBlocks.ts`(신규) | 블록 분할 + 이어짐 + 각주 폴백 | 원문 → 블록 범위 | `VirtualMarkdownView` |
| `features/chat/hooks/useWindowTokens.ts`(신규) · `useDiffDocuments.ts`(신규) · `useDiffRowTokens.ts`(신규, `useDiffSyntax` 대체) | 마운트 줄 → 200줄 창 요청 · 축 문서 임차 · 행별 토큰 | 문서·마운트 → 토큰 | Git 본문 · `DiffTable` · `VirtualCodeView` |
| `features/chat/components/code/VirtualCodeView.tsx`(신규) | 가시 줄 · 가시 줄 번호 · 범위 토큰 · 복사 | 원문 → 가상 목록 | `FileBody` · `WorkToolBody` · `ArtifactPreviewContent` |
| `features/chat/components/markdown/VirtualMarkdownView.tsx`(신규) · `WorkerMarkdownTail.tsx`(신규) | 블록 가상 목록 · 꼬리 최신 요청 | 원문 → hast 표시 | `ArtifactPreviewContent` · `StreamingMarkdown` |

import 방향: `shared/*` 는 `shared` 안만 · `features/chat/*` 는 `shared` + 같은 feature(`src/renderer/AGENTS.md` 4-layer). 워커 구역(`shared/compute/worker/`)만 `shiki`·`diff`·`unified`·`remark-*` 를 값으로 import 한다(규칙 (b) — EP-14). `hast-util-to-jsx-runtime` 은 창(`MarkdownHast`)이 쓴다.

## 10. 계약 / 타입 / 강제 지점

### 10-A. 계약 형

```ts
// shared/compute/protocol.ts
export interface DocRef { id: string; revision: number }            // id = 도메인 식별자(D-009) · revision ≥ 1
export const docKey = (ref: DocRef): string => `${ref.id}@${ref.revision}`
export type ComputeRequest =
  | { kind: 'highlight'; code: string; lang: string; theme: ComputeTheme }           // 현행 · code ≤ HIGHLIGHT_MAX_CHARS
  | { kind: 'tokens'; doc: DocRef; lang: string; theme: ComputeTheme; start: number; end: number } // 줄 [start, end) · end − start ≤ TOKENS_RANGE_MAX_LINES
  | { kind: 'diffLines'; old: DocRef; new: DocRef }
  | { kind: 'markdown'; doc: DocRef; start: number; end: number }                    // 문자 오프셋 [start, end) — 블록 하나
export interface ComputeResults {
  highlight: { html: string }
  tokens: { rows: TokenRows }        // rows.length = min(end, 줄 수) − start
  diffLines: { lines: DiffLine[] }
  markdown: { hast: HastRoot }       // raw 노드는 text 로 바뀐 뒤(D-021) · HastRoot = Parameters<typeof toJsxRuntime>[0] 의 형(`@types/hast` 를 직접 선언하지 않는다)
}
export type WireControl = { type: 'doc.open'; ref: DocRef; text: string } | { type: 'doc.close'; ref: DocRef }
export type WireRequest = ComputeRequest & { id: number }
export type WireResponse =
  | { id: number; ok: true; result: ComputeResult; size: number }
  | { id: number; ok: false; error: string }        // 'unknown-doc' = 워커에 그 문서가 없다
  | { id: number; ok: 'continue' }                  // 작업 상한에 닿았다 — 같은 작업을 다시 보낸다(AC4)

// shared/compute/client.ts
export interface DocumentLease { readonly ref: DocRef; readonly available: boolean; release(): void }
export interface ComputeClient {
  request<K>(request, options?: { priority?: 'visible' | 'background' }): ComputeHandle<ComputeResults[K]>   // 기본 'visible'
  peek<K>(request): ComputeResults[K] | undefined
  openDocument(ref: DocRef, text: string): DocumentLease   // 같은 ref 는 임차 수만 는다 · available=false 면 그 문서 요청은 즉시 실패
}

// shared/compute/documents.ts
export function revisionOf(source: object): number          // WeakMap — 같은 객체 같은 번호 · 새 객체 새 번호(단조)
export function useComputeDocument(id: string | null, revisionSource: object | null, text: string | null): DocRef | null   // revision = revisionOf(revisionSource)

// shared/ui/virtual/useVirtualRows.ts
export function useVirtualRows(options: {
  count: number; getItemKey(index: number): string; estimateSize(index: number): number
  scrollElement(): HTMLElement | null; pins?: readonly number[]; fullUpTo?: number   // count ≤ fullUpTo 이면 전부(근처일 때)
  nearViewportGate?: boolean                                                       // Git 파일 본문만 true
  initialRect?: { width: number; height: number }                                  // 테스트 이음새 — production 미지정
}): { listRef; items: readonly { index: number; start: number; size: number; key: string }[]; paddingTop: number; paddingBottom: number; measureElement; scrollToIndex(index: number, align?: 'center' | 'start'): void; visibleRange: { start: number; end: number } | null }
```

- 상수 SSOT: `shared/compute/limits.ts` — `TOKENS_CHECKPOINT_LINES = 200` · `TOKENS_RANGE_MAX_LINES = 200`(창) · `TOKENS_JOB_MAX_LINES = 600` · `COMPUTE_DOC_MAX_CHARS = 32_000_000` · `MARKDOWN_WORKER_MIN_CHARS = 4_000`. `shared/ui/virtual/limits.ts` — `VIRTUAL_BODY_MIN_LINES = 400` · `VIRTUAL_BODY_MAX_HEIGHT_CLASS = 'max-h-[384px]'`(OpenCode `ToolBody.tsx:119` 리터럴도 이 상수로) · `VIRTUAL_OVERSCAN = 20` · `VIRTUAL_ROW_ESTIMATE_PX = 20`.
- 문서 id 규칙(D-009): Git `git:${filePath}:${'old'|'new'}:${ignoreWhitespace ? 'w' : 'k'}` + `revisionOf(section.patch)` · 도구 카드 `tool:${docKey}:${blockIndex}:${'old'|'new'}` + `revisionOf(원천 객체 — 쌍이면 call.input, 패치면 구조화 패치 객체)` · 코드 보기 `code:${docKey}` + `revisionOf(원천 객체)` · 산출물 Markdown `md:${publicationId}` + `revisionOf(result)` · 꼬리 `tail:${인스턴스 번호}` + 꼬리가 바뀔 때마다 새 표지 객체의 `revisionOf`.

### 10-B. 강제 지점

검색 명령은 `app/` 에서 실행한다. 자리마다 그 자리를 운반하는 줄이 1개 이상 잡히고, 출력의 모든 줄은 그 행의 자리 또는 "형 선언·import 줄"에 속한다(0325 D-046 과 같은 규칙). 음성 자리는 0건 명령으로 확인한다.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| **EP-1** · MD-07 / VP-36·VP-06 | 요청 키 = 종류·문서 id@revision·옵션·범위(AC1) | `protocol.ts` | client | 자리 5 — ① `requestKey` highlight `['highlight', lang, theme, code]`(현행) ② tokens `['tokens', docKey(doc), lang, theme, start, end]` ③ diffLines `['diffLines', docKey(old), docKey(new)]` ④ markdown `['markdown', docKey(doc), start, end]` ⑤ `docKey` | `rg -n "\['(highlight\|tokens\|diffLines\|markdown)',\|export (const\|function) docKey" src/renderer/src/shared/compute/protocol.ts` → 5 | 키에 본문이 들어가면 창이 O(n) 키를 만든다(T15) · revision 이 빠지면 바뀐 문서에 옛 결과 |
| **EP-2** · AR-01·SD-01 / VP-10·VP-20 | 문서 수명(AC2) | `client.ts` · `worker/state.ts` | client · worker | 자리 9 — ① `openDocument` 등록부 추가 + 상한 검사(`COMPUTE_DOC_MAX_CHARS` → `available:false`) ② `ensureDocs` — 작업 `postMessage` 직전 미전송 문서마다 `{ type: 'doc.open' }` ③ 임차 `release` → 0 이면 전송된 문서에 `{ type: 'doc.close' }` ④ `dropWorker` → 모든 문서 `sent = false` ⑤ 등록부에 없는·`available:false` 문서를 쓰는 요청 → 즉시 `'unknown-doc'` 실패(워커 메시지 0) ⑥ 워커 `doc.open` → 보관 ⑦ 워커 `doc.close` → 삭제 ⑧ 워커 작업의 문서 없음 → `{ ok: false, error: 'unknown-doc' }` ⑨ 클라이언트 `receive` `'unknown-doc'` → 그 작업 문서 `sent = false` + 1회 재대기(두 번째는 실패) | `rg -n "'doc\.open'\|'doc\.close'\|'unknown-doc'\|COMPUTE_DOC_MAX_CHARS\|sent = false" src/renderer/src/shared/compute --glob '!*.test.ts'` | 새 워커에 문서가 없어 색이 영영 안 붙는다 · 해제한 문서가 워커에 쌓인다 · 상한 초과 문서를 보내 워커 메모리가 는다 |
| **EP-3** · MD-03 / VP-32·VP-11 | 범위 토큰 = 전체 토큰화와 같다 · 작업당 ≤ 600줄(AC3·AC4) | `worker/tokens.ts` | worker | 자리 6 — ① 줄 시작 색인(문서당 1회 · 지연) ② 체크포인트 사슬 키 `${lang}\|${theme}`(테마별) ③ 전진 고리 — 작업 줄 합이 `TOKENS_JOB_MAX_LINES` 에 닿으면 `'continue'` ④ 조각 `codeToTokens(chunk, { lang, theme, grammarState })` ⑤ 조각 끝 `getLastGrammarState` → 사슬에 저장(200줄마다) ⑥ 결과 행 = `[start, min(end, 줄 수))` | `rg -n "codeToTokens\(\|getLastGrammarState\(\|TOKENS_JOB_MAX_LINES\|TOKENS_CHECKPOINT_LINES\|'continue'" src/renderer/src/shared/compute/worker --glob '!*.test.ts'` | 상태 전달이 빠지면 여러 줄 주석·문자열 색이 틀린다(M8 `false`) · 상한이 없으면 26s 작업이 다른 요청을 막는다 |
| **EP-4** · MD-08 / VP-36·VP-11 | 대기열 — 등급 → 크기 → 도착 · `continue` 재대기 · 취소 규칙(AC4~AC6) | `client.ts` | client | 자리 5 — ① 작업 크기 `requestSize(request, lengthOf)` — tokens = 범위 줄 수 × 평균 줄 길이(문서 길이 / 줄 수) · diffLines = 두 문서 길이 · markdown = `end − start` · highlight = 현행 ② `enqueue` — 등급(`visible` 0 · `background` 1) → 크기 오름차순 → 도착 ③ `receive` `'continue'` → `failures = 0` · 대기자 > 0 이면 같은 작업을 새 id 로 `enqueue`(같은 등급·크기 위치), 0 이면 버림 ④ `cancel` 실행 중 — `job.request.kind === 'diffLines' && queue.length > 0` 일 때만 `dropWorker` ⑤ `request` 의 `priority` 기본 `'visible'` | `rg -n "priority\|'continue'\|kind === 'diffLines'\|function enqueue\|requestSize\(" src/renderer/src/shared/compute/client.ts` | `continue` 가 맨 앞으로 가면 긴 문서가 다른 요청을 다시 막는다 · 모든 종류에서 워커를 끝내면 체크포인트를 잃는다(D-024) |
| **EP-5** · AR-02 / VP-21 | 문서 참조 = 도메인 id + `revisionOf(원천)`(D-009) | `documents.ts` | 소비자 | 자리 9 — `useComputeDocument` 호출(안에서 `revisionOf(revisionSource)`) ① `useDiffDocuments` old ② `useDiffDocuments` new ③ `VirtualCodeView` ④ `VirtualMarkdownView` ⑤ `WorkerMarkdownTail`(꼬리마다 새 표지 객체 `useMemo(() => ({}), [tail])`) · 원천 객체를 고르는 자리 ⑥ `FileDiffBody` → `useDiffDocuments(…, section.patch)` ⑦ `DiffBody`·OpenCode `FilePanel` → `<DiffTable revisionSource>`(쌍 `call.input` · 구조화 패치 객체 · OpenCode `file`) ⑧ `FileBody`·`WorkToolBody`·`ArtifactPreviewContent` → `<VirtualCodeView revisionSource>`(`call.result` · `result`) ⑨ `ArtifactPreviewContent` → `<VirtualMarkdownView revisionSource={result}>` | `rg -n "useComputeDocument\(\|useDiffDocuments\(\|revisionSource=" src/renderer/src --glob '!*.test.*'` → 정의 2(`useComputeDocument` · `useDiffDocuments`) + 자리 줄 | id 에 공백 옵션이 빠지면 공백 숨김 전환 뒤 이전 축 토큰 · 렌더마다 새로 만든 객체를 원천으로 주면 다시 렌더마다 새 문서(캐시·체크포인트 손실) |
| **EP-6** · MD-01 / VP-30 | 짝 = O(n) 색인 · 현행과 같다(AC8) | `lib/diffRowModel.ts` | 창 | 자리 2 — ① `buildCounterparts(lines): Int32Array` — 삭제 묶음 `[rs, re]` 다음 `next = re + 1` 이 추가면 `counterparts[rs + o] = lines[next + o]` 가 추가일 때 `next + o` · 추가 묶음 `[as, ae]` 바로 앞 삭제 묶음 `[rs, as − 1]` 이면 `counterparts[as + o] = rs + o`(`rs + o < as` 이고 삭제일 때) · 그 밖 −1 ② 인라인 `LineText` counterpart = `model.counterparts[row.sourceIndex]`. 음성 — `counterpartOf(` 0 | `rg -n "function buildCounterparts\|counterparts\[" src/renderer/src/features/chat --glob '!*.test.*'` · 음성 `rg -n "counterpartOf\(" src/renderer/src --glob '!*.test.*'` → 0 | 짝이 현행과 다르면 단어 강조 위치가 바뀐다 · 렌더마다 찾으면 O(n²) 복귀 |
| **EP-7** · MD-02 / VP-31·VP-01 | 행 모델 1회 · 요구사항 색인 · 폭 · 축 문서(AC9·AC16·AC17) | `lib/diffRowModel.ts` · `FileDiffSection.tsx` | 창 | 자리 5 — ① `useMemo(() => buildDiffRowModel(diffLines), [diffLines])` ② `useMemo(() => buildRequirementIndex(requirements, filePath, diffLines), [requirements, filePath, diffLines])` — `itemsAt(i)`·`lineOf(id)` ③ 줄바꿈 끔 → 표 `style.minWidth = calc(${widthColumns}ch + 거터)` ④ `model.axis.old/new` → `useDiffDocuments` ⑤ 선택 요구사항 줄 = `requirementIndex.lineOf(id)`(본문 `findIndex` 0) | `rg -n "buildDiffRowModel\(\|buildRequirementIndex\(\|widthColumns\|model\.axis\|lineOf\(" src/renderer/src/features/chat --glob '!*.test.*'` | deps 에 초안·선택이 들어가면 키 입력마다 O(n) · 폭이 마운트 행에서 오면 가로 막대가 흔들린다 |
| **EP-8** · AR-03·MD-10 / VP-22·VP-38 | 가상 행 — 전부/가상/근처 · pins · scrollMargin(AC10·AC11·AC14·AC18·AC19·AC22·AC23) | `shared/ui/virtual/useVirtualRows.ts` | 창 | 자리 10 — ① `useVirtualizer(` 이 파일 한 곳 ② `count <= fullUpTo` → 전부(근처일 때) ③ `nearViewportGate` → `IntersectionObserver`(root = 스크롤 요소 · rootMargin `100% 0px`) → 밖이면 항목 0(`enabled:false`) · 관찰자 없음(SSR·테스트) → 근처로 본다 ④ `rangeExtractor` = 기본 범위 ∪ pins ⑤ `scrollMargin` = 목록 위치(스크롤 요소 기준) — layout effect + 스크롤 요소 내용 `ResizeObserver` ⑥ Git 인라인 ⑦ Git 나란히 ⑧ `DiffTable` ⑨ `VirtualCodeView` ⑩ `VirtualMarkdownView` | `rg -n "useVirtualRows\(\|useVirtualizer\(" src/renderer/src --glob '!*.test.*'` → `useVirtualizer` 2(`TranscriptViewport` + ①) · `useVirtualRows` 정의 1 + ⑥~⑩ 5 · ②~⑤ `rg -n "fullUpTo\|IntersectionObserver\|rangeExtractor\|scrollMargin" src/renderer/src/shared/ui/virtual/useVirtualRows.ts` | pins 가 빠지면 선택 끝·초안이 언마운트되어 선택·초점이 풀린다 · 근처 판정이 없으면 모두 펼치기에서 파일마다 overscan 행 |
| **EP-9** · SD-03 / VP-12 | Git 상호작용(AC12~AC15) | `FileDiffSection.tsx` | 창 | 자리 6 — ① 위쪽 펼침 보정 — 앵커 rect 차이 → `planUpwardExpansionCompensation`(현행 `:305-328`) ② 선택 요구사항 — `requirementIndex.lineOf` → 카드 항목 인덱스 → `scrollToIndex(index, 'center')` → 다음 프레임 `revealDiffRequirement`(현행 함수) ③ 초안 항목 인덱스를 pins 에 ④ 선택 끝 행(`selectionRowEndpoints`)을 pins 에 ⑤ 표 `onCopy` → `rowsCopyText`(두 끝이 이 목록 안일 때) ⑥ 접기 → 본문 언마운트 → 축 문서 임차 해제 | `rg -n "planUpwardExpansionCompensation\(\|scrollToIndex\(\|revealDiffRequirement\(\|pins\|onCopy" src/renderer/src/features/chat/harnesses/common/rightpanel/FileDiffSection.tsx` | 보정이 빠지면 위쪽 펼침에서 읽던 줄이 밀린다 · `scrollToIndex` 가 빠지면 화면 밖 요구사항 선택이 아무 일도 안 일어남으로 보인다 |
| **EP-10** · MD-05 / VP-34 | 선택 복사 = 행 모델 문자열(AC15 · D-022) | `shared/ui/virtual/rowSelection.ts` | 창 | 자리 6 — ① `rowsCopyText(rowText, anchor, focus, layout)` — 시작·끝 오프셋 · 인라인 `\n` · 나란히 행 `left + '\t' + right` ② `selectionRowEndpoints(root, selection)` — `[data-virtual-index]` 조상 + `[data-virtual-text]` 안 오프셋, 끝이 root 밖이면 `null` ③ Git 인라인 rowText ④ Git 나란히 rowText ⑤ `DiffTable` rowText ⑥ `VirtualCodeView` rowText | `rg -n "rowsCopyText\(\|selectionRowEndpoints\(" src/renderer/src --glob '!*.test.*'` → 정의 2 + 소비자 4 | 마운트 안 된 행이 복사에서 빠진다 · 거터가 섞인다 |
| **EP-11** · R-02 / VP-02 | 400줄 초과 도구 본문 = 384px 가상 본문(AC18~AC20 · D-004) | `shared/ui/virtual/limits.ts` | 창 | 자리 5 — ① `DiffTable` — `lines.length > VIRTUAL_BODY_MIN_LINES` → `scrollElement` prop 이 없으면 자기 `VIRTUAL_BODY_MAX_HEIGHT_CLASS overflow-auto` 래퍼 ② OpenCode `FilePanel` — 기존 컨테이너를 `scrollElement` 로(클래스는 상수) ③ `FileBody` — 줄 수 > 400 → `<VirtualCodeView showLineNumbers maxHeight>` ④ `WorkToolBody` `Payload` — 줄 수 > 400 → `<VirtualCodeView maxHeight tone>` ⑤ `ToolCard` 복사 버튼 `copyText(call)`(현행 `ToolCard.tsx:238` · 가상 본문과 무관) | `rg -n "VIRTUAL_BODY_MIN_LINES\|VIRTUAL_BODY_MAX_HEIGHT_CLASS\|<VirtualCodeView\|scrollElement=\|copyText\(call\)" src/renderer/src/features/chat --glob '!*.test.*'` | 임계가 어긋나면 400줄 이하 본문 레이아웃이 바뀐다 · 복사가 DOM 에서 오면 마운트 행만 복사된다 |
| **EP-12** · MD-04·AR-04 / VP-04·VP-23·VP-33·VP-13 | Markdown 블록·hast 계약(AC23·AC24 · D-020·D-021) | `lib/markdownDocumentBlocks.ts` · `worker/markdown.ts` · `MarkdownHast.tsx` | 창 · worker | 자리 8 — ① `markdownDocumentBlocks(source)` — `splitStableBlocks` + 이어짐 합치기(들여쓴 블록 · 앞 블록 마지막 비공백 줄이 목록 항목이고 이 블록이 목록 표지로 시작 · 앞 블록 마지막 줄과 이 블록 첫 줄이 `>`) · 각주 정의(`^ {0,3}\[\^[^\]]+\]:`)가 있으면 `[{0, length}]` ② 워커 `markdownBlock` — 블록 텍스트 + 블록 안 `[라벨]` 이 가리키는 정의 줄(문서당 1회 색인) 덧붙임 ③ `unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true })` ④ `raw` 노드 → `{ type: 'text', value }` ⑤ `MarkdownHast` — `a.href`·`img.src` 에 `defaultUrlTransform` ⑥ `toJsxRuntime(hast, { Fragment, jsx, jsxs, components: MARKDOWN_COMPONENTS, passKeys: true, passNode: true, ignoreInvalidStyle: true })` ⑦ `VirtualMarkdownView` 파싱 전 블록 — 원문 `<pre data-md-block-pending>`(줄바꿈 보존) ⑧ `ArtifactPreviewContent` — `content.length > MARKDOWN_WORKER_MIN_CHARS` → `VirtualMarkdownView` | `rg -n "markdownDocumentBlocks\(\|allowDangerousHtml\|type === 'raw'\|defaultUrlTransform\|toJsxRuntime\(\|data-md-block-pending\|MARKDOWN_WORKER_MIN_CHARS" src/renderer/src --glob '!*.test.*'` | 이어짐이 빠지면 목록 번호·loose 목록이 갈린다(M13 27) · raw → text 가 빠지면 HTML 이 요소로 그려질 수 있다 · urlTransform 이 빠지면 `javascript:` 링크 |
| **EP-13** · MD-06 / VP-05·VP-35 | 꼬리 워커 파싱(AC26 · D-006·D-019) | `WorkerMarkdownTail.tsx` | 창 | 자리 5 — ① `StreamingMarkdown` — `!openFence && tail.length > MARKDOWN_WORKER_MIN_CHARS` → `<WorkerMarkdownTail>` ② 꼬리가 바뀔 때마다 문서 revision +1(이전 임차 해제) ③ 요청 effect 정리 = 이전 요청 취소(최신 하나) ④ `tail.startsWith(parsed.text)` → `MarkdownHast(parsed.hast)` + 나머지 원문 ⑤ 접두가 아니면 현재 꼬리 원문만 | `rg -n "MARKDOWN_WORKER_MIN_CHARS\|<WorkerMarkdownTail\|startsWith\(" src/renderer/src/features/chat/components/markdown --glob '!*.test.*'` | 접두 검사가 빠지면 블록 확정 뒤 같은 글이 두 번 보인다 · 취소가 빠지면 지난 꼬리 요청이 줄을 선다 |
| **EP-14** · AR-05 / VP-08·VP-24 | 의존성·경계(AC28 · D-005) | `ui-thread-rules.mjs` · `package.json` · 문서 | 가드 · 문서 | 자리 5 — ① `ALLOWED.b.modules` 에 `unified`·`remark-parse`·`remark-rehype` (`anyModule` 워커 구역만) ② `app/package.json` `dependencies` 4개(설치 버전 범위 `^11.0.5`·`^11.0.0`·`^11.1.2`·`^2.3.6`) ③ `docs/TRD.md` 마크다운 행(`:109`) ④ `app/AGENTS.md` 채택 목록 ⑤ `docs/arch/execution-model.md` 계산 워커 행(`:20`) "범위 토큰 · diff 줄 · Markdown 블록 파싱 · 열린 문서" | `rg -n "remark-parse\|remark-rehype\|hast-util-to-jsx-runtime\|\"unified\"\|'unified'" package.json scripts/ui-thread-rules.mjs ../docs/TRD.md AGENTS.md ../docs/arch/execution-model.md` | UI 스레드가 파서를 직접 import 해도 가드가 침묵 · 승인한 의존성이 문서에 없다 |
| **EP-15** · MD-09 / VP-37·VP-03 | 줄 번호 메모(AC21) | `CodeBlock.tsx` | 창 | 자리 2 — ① plain 경로 줄 번호 문자열 `useMemo(…, [code])` ② html 경로 CSS 카운터(현행 `LINE_NUMBER_CLASSES`) | `rg -n -F "code.split(" src/renderer/src/shared/ui/markdown/CodeBlock.tsx` → 1(① 안) · `rg -n "LINE_NUMBER_CLASSES" src/renderer/src/shared/ui/markdown/CodeBlock.tsx` | 렌더마다 O(n) 복귀 |
| **EP-16** · AR-02 / VP-21·VP-01·VP-03 | 범위 토큰 소비(AC17·AC20·AC22) | `hooks/useWindowTokens.ts` | 창 | 자리 6 — ① `useWindowTokens(doc, lang, mountedLines, visibleLines)` — 마운트 줄을 200줄 창으로 묶어 창마다 `{ kind: 'tokens' }`(화면 안 창 `visible` · overscan 만 `background`) · 창에서 빠지면 취소 ② 테마 `useSyncExternalStore(subscribeTheme)` → 마운트 창만 다시 ③ 결과 `doc.revision` 이 현재와 다르면 버림 ④ `useDiffRowTokens` — 축 문서 두 개 × ① · 행 → 축 인덱스(`model.axis.*.index`) · 토큰 원문 대조 ⑤ `VirtualCodeView` → ① ⑥ 음성 — `diffTokens` 0 | `rg -n "kind: 'tokens'\|useWindowTokens\(\|useDiffRowTokens\(" src/renderer/src --glob '!*.test.*'` · 음성 `rg -n "diffTokens" src/renderer/src --glob '!*.test.*'` → 0 | 전체 축 요청이 남으면 26s 작업 · revision 대조가 없으면 지난 세대 색이 새 본문에 붙는다 |

- 자리 목록은 검색 출력과 차집합 0 이어야 한다(구현자는 IMPL_DONE 전에, 검증자는 1회째에 다시 돌린다). verify 발견은 이행 결함·현재 결함·확장 후보로 갈리고, 열거 원문에 없는 확장 후보는 verify 1·2회째에만 판정을 막는다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).
- **선언 경계**(측정 근거와 함께 — verify 는 이 안의 반례를 `경계`로 본다):
  - B1 — 테마 전환 뒤 문서 끝 범위는 그 테마 체크포인트를 앞에서부터 다시 만든다 — 5만 줄 끝이면 워커 약 26s(M4 · 창은 원문, 다른 요청은 조각 사이에 처리 — AC4).
  - B2 — 한 Markdown 블록의 워커 파싱은 한 작업이고 블록 크기에 비례한다 — 45,433자 표 블록이 창 144.9ms(M13)였던 일이 워커로 간다. 그 작업 동안 다른 요청은 기다린다.
  - B3 — `MARKDOWN_WORKER_MIN_CHARS` 이하 문서·꼬리, 그리고 `<Markdown>` 의 다른 호출처 10곳(S7 의 12 중 0327 이 바꾸는 2를 뺀 것)은 창 동기 파싱이다(현행).
  - B4 — transcript Markdown 코드 펜스(`Markdown.tsx:134`·`StreamingMarkdown.tsx:23`)는 transcript 블록 하나다 — 강조 상한 32,000자(현행) · 큰 펜스는 원문 텍스트 노드 하나(0326 B11 과 같은 꼴).
  - B5 — Git 행 모델은 펼침마다 창에서 O(n) 1회다 — 현행 측정 5만 줄 diff 줄 1.78 + hunk 11.44 + 축 문자열 9.52 = 22.74ms(M2) + 짝·폭·요구사항 색인(신규 — K1 이 잰다). 50ms 를 넘으면 W 판정에서 다시 본다(D-011).
  - B6 — 선택의 한 끝이 목록 밖이면(transcript 본문에서 도구 카드 안까지 등) 기본 복사다 — 마운트 안 된 행은 빠진다. 전체 원문 경로는 카드 복사 버튼이다(D-004). 0326 transcript 긴 선택 복사(0326 D-087)도 같은 축이다.
  - B7 — 나란히 보기 선택 복사는 행 단위다(시작·끝 칸 오프셋은 쓰지 않는다). 브라우저 표 복사와 같은 문자열이라고 약속하지 않는다(S-C1 이 비교 기록).
  - B8 — 폭의 전각 판정은 East Asian Width W·F 범위 근사이고 결합 문자·이모지 변형은 1칸이다 — 실제보다 좁으면 가로 막대가 늦게 는다.
  - B9 — 400행 이하 Git 파일·400줄 이하 도구 본문은 지금 DOM 그대로다.
  - B10 — 블록 렌더는 전체 렌더와 공백만인 텍스트 노드만큼 다를 수 있다(M13 681 vs 688) · `docs/spec/claude/agent-sdk/typescript.md` 의 차이 1건은 남는다.
  - B11 — 범위 토큰 캐시는 0325 비용 규칙(키 + 크기 ≤ 4,000,000 · 항목 ≤ 1,000)을 그대로 쓴다.
  - B12 — 열린 문서 문자 합이 상한을 넘으면 그 뒤 문서는 색·블록 파싱이 없다 — 코드는 원문, Markdown 은 원문 블록으로 남는다(D-010).
  - B13 — 꼬리 워커 결과는 한 작업만큼 늦다 — 최신 새 글자는 원문으로 먼저 보인다(AC26).
- 열린 입력 집합(문법·입력 형태)을 판정하는 산출물: 해당 없음 — `markdownDocumentBlocks` 는 판정 게이트가 아니라 표시 분할이다. 충실도는 fixture 대조(AC24)와 각주 폴백(D-020)이 맡고 남는 차이는 B10 이다.
- 같은 규칙이 여러 레이어에 있다면: 임계 400·384px 은 `shared/ui/virtual/limits.ts`, Markdown 4,000·토큰 상수는 `shared/compute/limits.ts`, components 맵은 `shared/ui/markdown/markdownComponents.tsx` 한 곳(`Markdown`·`MarkdownHast` 공유), URL 변환은 react-markdown `defaultUrlTransform` 하나.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드의 의미: `priority` 미지정 = `visible` · `fullUpTo` 미지정 = 0(늘 가상) · `nearViewportGate` 미지정 = 거짓 · `initialRect` 는 테스트 전용(production 미지정 → TanStack 기본) · `DiffTable.scrollElement` 미지정 = 자기 래퍼 · `DocumentLease.available` 거짓 = 그 문서 요청 즉시 실패.
- 외부 SDK 경계: shiki `codeToTokens(code, { lang, theme, grammarState })` — `grammarState` 는 같은 테마에서 얻은 것만(M8). `hast-util-to-jsx-runtime` `toJsxRuntime(tree, options)` — react-markdown 9.1 이 넘기는 옵션과 같은 값(F12). TanStack `useVirtualizer` — `rangeExtractor`·`scrollMargin`·`enabled`·`measureElement`(F14).

## 11. 구현 설계

경로는 `app/src/renderer/src/` 기준이다(스크립트·`package.json`·문서 제외).

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/compute/protocol.ts` | 메시지 계약 | §10-A 형 · `docKey` · `requestKey`(EP-1) · `requestSize(request, lengthOf)` · `requestDocs(request)` · `parseResponse` 가 `ok: 'continue'` 를 읽는다 · `resultSize` 에 tokens(`rowsSize`)·markdown(노드마다 36 + text 길이) · `diffTokens` 삭제 | `protocol.keys.test.ts` pk1~pk4(순수) |
| `shared/compute/limits.ts` | 상한 SSOT | §10-A 상수 5개 추가 | — |
| `shared/compute/client.ts` | 대기열·문서 | 문서 등록부(`Map<docKey, { ref, text, leases, sent }>` · 문자 합) · `openDocument` · `ensureDocs` · `release` · `dropWorker` 의 `sent` 초기화 · `unknown-doc` 재시도 1 · `priority` 등급 · `continue` 재대기 · 취소 규칙(D-024) · 등록부에 없는 문서를 쓰는 요청 즉시 실패 | `client.documents.test.ts` d1~d6 · `client.queue.test.ts` q1~q7(가짜 `WorkerLike` — 받은 메시지 기록 · d4 는 실제 `createWorkerState`) |
| `shared/compute/documents.ts`(신규) | 문서 참조 | `revisionOf`(모듈 `WeakMap` + 단조 번호) · `useComputeDocument(id, revisionSource, text)` — 셋 중 하나라도 `null` 이면 `null` · 마운트·변경 때 임차, 정리 때 해제 · `available:false` 면 `null` | `documents.test.ts` o1~o4(렌더 하네스) |
| `shared/compute/fakeClient.testfixture.ts` | 가짜 클라이언트 | `openDocument`(임차 기록) · `request` 의 `priority` 기록 · `requests` 에 키 | — |
| `shared/compute/worker/state.ts`(신규) | 워커 상태 | `createWorkerState()` → `{ handle(message): Promise<WireResponse \| null> }` — `doc.open`·`doc.close` 는 `null` · 작업은 종류별 분기 · 작업은 시작 때 문서 텍스트를 동기로 읽는다(작업 중 `doc.close` 무관) | `worker/handler.test.ts` h6~h8 |
| `shared/compute/worker/handler.ts` | 계산 | `compute` — highlight(현행) · diffLines(문서 텍스트) · tokens → `tokensRange` · markdown → `markdownBlock` · `handleMessage` 는 `state.handle` 로 대체(테스트는 상태를 만들어 부른다) | 기존 `handler.test.ts` 5건(diffLines·diffTokens 케이스는 문서·tokens 로 바꾼다) |
| `shared/compute/worker/tokens.ts`(신규) | 범위 토큰 | EP-3 ①~⑥ · `tokensRange(doc, request, highlighter)` → `{ rows } \| 'continue'` | `worker/tokens.test.ts` t1~t6(실제 하이라이터) |
| `shared/compute/worker/markdown.ts`(신규) | 블록 파싱 | EP-12 ②~④ · 문서당 정의 색인(`^ {0,3}\[([^\]\n]+)\]:` 줄 — 소문자·공백 접기 라벨) · 블록 안 `[라벨]`·`[텍스트][라벨]`·`[라벨][]` 이 가리키는 정의만 덧붙임 | `worker/markdown.test.ts` mw1~mw4 |
| `shared/compute/worker/compute.worker.ts` | 배선 | 모듈 상태 하나 → `onmessage` 가 `state.handle` → 응답이면 `postMessage` | — |
| `shared/ui/virtual/limits.ts`(신규) | 가상 상수 SSOT | §10-A | — |
| `shared/ui/virtual/useVirtualRows.ts`(신규) | 가상 행 | EP-8 ①~⑤ · 반환 §10-A · `measureElement` 는 `data-index` 를 쓴다(TanStack 규약) · 크기 변화 보정은 TanStack 기본(위쪽 펼침 보정은 소비자, AC12) | `useVirtualRows.test.ts` u1~u6(실제 `@tanstack/virtual-core` + 렌더 하네스) |
| `shared/ui/virtual/rowSelection.ts`(신규) | 선택 복사 | EP-10 ①② · 행 루트 `data-virtual-index` · 본문 칸 `data-virtual-text` | `rowSelection.test.ts` r1~r5(순수 + 가짜 DOM) |
| `shared/ui/markdown/markdownComponents.tsx`(신규) | components 맵 | `Markdown.tsx:11-137` 의 맵·`BlockedImagePlaceholder` 를 옮겨 `MARKDOWN_COMPONENTS` 로 export | `Markdown.render.test.ts`(현행 그대로) |
| `shared/ui/markdown/Markdown.tsx` | 동기 Markdown | `MARKDOWN_COMPONENTS` import(동작 불변) | 현행 |
| `shared/ui/markdown/MarkdownHast.tsx`(신규) | hast → React | EP-12 ⑤⑥ · 래퍼 `className ?? DEFAULT_WRAPPER`(`Markdown` 과 같은 값) | `MarkdownHast.fidelity.test.ts` f1·f2 |
| `shared/ui/markdown/CodeBlock.tsx` | 줄 번호 | EP-15 ① | `CodeBlock.render.test.ts` cb1 |
| `features/chat/lib/diffRowModel.ts`(신규) | 행 모델 | `buildCounterparts` · `displayColumns(text)`(탭 8 정렬 · W/F 2) · `buildDiffRowModel(lines)` → `{ counterparts, widthColumns, axis: { old, new: { text, index: Int32Array } } }`(축 = 현행 `axisLines` 규칙 — old 는 added 제외, new 는 removed 제외) · `buildRequirementIndex(items, filePath, lines)` → `{ itemsAt, lineOf }`(현행 `diffRequirementMatchesLine` 의미: 두 축 · old 단독 · new 단독 세 표) · `sideBySideItems(rows)`(gap 제자리 · 묶음별 `toSideBySideRows`) | `diffRowModel.test.ts` cp1·cp2·sb1·p1~p3·ax1~ax3·ri1~ri4 |
| `features/chat/lib/diffSyntax.ts` | 토큰 대조 | `diffTokensRequest`·`mapDiffTokens` 삭제 · `tokensMatchText(row, text)`(현행 `:59` 규칙) 유지 | `diffSyntax.test.ts`(대조 케이스만 남긴다) |
| `features/chat/lib/markdownDocumentBlocks.ts`(신규) | 문서 블록 | EP-12 ① · 반환 `{ start, end }[]`(원문 오프셋 · 빈 블록 없음) | `markdownDocumentBlocks.test.ts` mb1~mb5 |
| `features/chat/hooks/useWindowTokens.ts`(신규) | 창 토큰 | EP-16 ①~③ · 반환 `(line) => ThemedToken[] \| undefined` | `useWindowTokens.test.ts` wt1~wt4(가짜 클라이언트 · 렌더 하네스) |
| `features/chat/hooks/useDiffDocuments.ts`(신규) | 축 문서 | 소스가 쌍이면 old·new 원문, 줄이면 `model.axis.*.text` · id·revision 은 호출자가 준다(EP-5 ①②) | `useDiffRowTokens.test.ts` rt6 |
| `features/chat/hooks/useDiffRowTokens.ts`(신규, `useDiffSyntax.ts` 삭제) | 행 토큰 | 축 두 개 × `useWindowTokens` · 행 → 축 인덱스 → 토큰 · `tokensMatchText` 틀리면 없음 · `DiffRowTokensContext`(`DiffSyntaxContext` 대체 — `LineText` 소비) | `useDiffRowTokens.test.ts` rt1~rt6 |
| `features/chat/hooks/useDiffLines.ts` | diff 줄 | 서명 `useDiffLines(oldValue, newValue, docId, revisionSource)` — 창 상한 안은 현행 동기 · 넘으면 두 문서 임차 후 `{ kind: 'diffLines', old, new }` | 기존 소비자 테스트 · `client.test.ts` k5 입력 변경 |
| `features/chat/harnesses/common/rightpanel/FileDiffSection.tsx` | Git 본문 | `FileDiffBody` — 행 모델·요구사항 색인 메모(EP-7) · 항목 목록(인라인: gap·line·draft·markers / 나란히: gap·pair·markers) · `useVirtualRows({ fullUpTo: VIRTUAL_BODY_MIN_LINES, nearViewportGate: true, scrollElement: () => scrollOwnerRef.current, pins: [초안 · 선택 끝] })` · 표 위·아래 여백 `<tr aria-hidden style={{ height }}>` · 행 `<tr data-index data-virtual-index ref={measureElement}>` · 본문 칸 `data-virtual-text` · EP-9 ①~⑥ · `useDiffRowTokens` · `onCopy` | `fileDiffVirtual.render.test.ts` v1~v12 |
| `features/chat/harnesses/common/transcript/DiffTable.tsx` | 도구 diff 표 | props `+ docKey: string · revisionSource: object · scrollElement?` · `lines.length > VIRTUAL_BODY_MIN_LINES` → 가상(EP-11 ①) · 아니면 현행 DOM · 토큰은 `useDiffRowTokens` | `DiffTable.virtual.test.ts` dt1~dt3 |
| `features/chat/harnesses/claude/transcript/tool-bodies/DiffBody.tsx` | Claude diff 본문 | `docKey = call.toolUseId` · 블록 i · 쌍 원천 `call.input` · 패치 원천 구조화 패치 객체 → `DiffTable`·`useDiffLines` | `DiffBody.render.test.ts`(현행) · `longToolBody.render.test.ts` lb1 |
| `features/chat/harnesses/claude/transcript/tool-bodies/FileBody.tsx` | Read 본문 | `countLinesUpTo(text, 400) > 400` → `<VirtualCodeView showLineNumbers maxHeight docKey={call.toolUseId} revisionSource={call.result}>` | `longToolBody.render.test.ts` lb2·lb3 |
| `features/chat/harnesses/claude/transcript/WorkToolBody.tsx` | Work 출력 | `Payload` 같은 규칙 · 오류면 `tone="error"` | `longToolBody.render.test.ts` lb4 |
| `features/chat/harnesses/opencode/transcript/ToolBody.tsx` | OpenCode 파일 본문 | 컨테이너 클래스를 상수로 · `ref` → `DiffTable scrollElement` · `useDiffLines(…, 'tool:' + disclosureKey, file)` | `DiffTable.virtual.test.ts` dt3 |
| `features/chat/components/code/VirtualCodeView.tsx`(신규) | 가상 코드 | 줄 시작 색인(원문당 1회) · `useVirtualRows` · 행 `<div data-index data-virtual-index><span 거터>{n}</span><span data-virtual-text>…</span></div>` · `maxHeight` 면 자기 스크롤(`VIRTUAL_BODY_MAX_HEIGHT_CLASS`) · 아니면 `scrollElement` · 최소 폭 `widthColumns` · `useWindowTokens`(지원 언어만) · `onCopy` · `tone` | `VirtualCodeView.test.ts` x1~x5 |
| `features/chat/components/markdown/VirtualMarkdownView.tsx`(신규) | 가상 Markdown | `markdownDocumentBlocks` · `useComputeDocument('md:'+publicationId, revisionSource, source)` · `useVirtualRows` · 블록마다 `markdown` 요청(화면 안 `visible` · overscan `background`) · 결과 전 `data-md-block-pending` 원문 · 결과 `MarkdownHast` · revision 대조 | `VirtualMarkdownView.test.ts` m1~m5 |
| `features/chat/components/markdown/WorkerMarkdownTail.tsx`(신규) | 꼬리 | EP-13 ②~⑤ | `WorkerMarkdownTail.test.ts` s1~s5 |
| `features/chat/components/markdown/StreamingMarkdown.tsx` | 스트리밍 | EP-13 ① 분기만 | `WorkerMarkdownTail.test.ts` s6 · `StreamingMarkdown.fence.test.ts` |
| `features/chat/harnesses/common/rightpanel/ArtifactPreviewContent.tsx` · `ArtifactViewer.tsx` | 산출물 | 뷰어가 스크롤 요소 getter 를 넘긴다 · 코드·텍스트 > 400줄 → `VirtualCodeView`(`code:artifact:`+publication) · Markdown > 4,000자 → `VirtualMarkdownView` · 그 밖 현행 | `ArtifactPreviewContent.render.test.ts` a4·a5 |
| `app/scripts/ui-thread-rules.mjs` · `check-ui-thread.test.mjs` | 경계 | EP-14 ① · ui1(UI 파일의 `remark-parse` import → 위반 1) | `node --test scripts/check-ui-thread.test.mjs` |
| `app/scripts/measure-ui-inputs.mjs` · `.test.mjs` | 측정 | K1~K8 · F6~F8(§19) | `node --test scripts/measure-ui-inputs.test.mjs` |
| `app/package.json` | 의존성 | EP-14 ② | — |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 순수 파일: `protocol.ts` · `diffRowModel.ts` · `markdownDocumentBlocks.ts` · `rowSelection.ts`(`rowsCopyText`) · `worker/tokens.ts`·`worker/markdown.ts`(shiki·unified 만 — node 에서 실행, `highlighter.test.ts` 선례). 워커 상태는 `createWorkerState()` 로 테스트가 직접 만든다.
- 기존 메커니즘 재사용의 형상/시점: 위쪽 펼침 보정은 마운트된 앵커(펼친 gap 아래 첫 줄 — 사용자가 클릭한 gap 바로 아래라 화면 안)에 기댄다 — 가상 행에서도 앵커는 마운트돼 있다(AC12 v5 가 잰다). `revealDiffRequirement` 는 marker 가 마운트돼야 찾는다 — `scrollToIndex` 뒤 다음 프레임에 부른다(AC13).
- 순서를 관측할 훅/로그/주입 경계: 가짜 `WorkerLike` 가 받은 메시지 배열(`doc.open` → 작업 순서 · AC2) · 가짜 워커가 `continue` 를 돌려 대기열 순서를 기록(AC4) · `react-markdown` 모듈 spy(AC23·AC26) · `useVirtualRows` `initialRect`(가시 높이 600) · `estimateSize`(20).
- 0326 테스트 이음새와의 관계: 0326 의 `vi.mock('@tanstack/react-virtual')`(Timeline·TranscriptView 테스트)은 그 파일 안에서만 이 훅에도 걸린다 — 이 훅은 transcript 진입점이 아니라 도구 카드 본문 안에서만 쓰이므로 그 테스트들의 단언 대상이 아니다(VP-47 이 transcript 단일 뷰포트를 잠근다).

## 12. End-to-end 영향

### producer → consumer

```text
agent(Git patch · 도구 이벤트) / data(산출물 미리보기) ──(현행 IPC, 변경 0)──▶ 창 store
  → 소비 컴포넌트(행 모델 · 블록 · 줄 색인) ── 임차 ──▶ client 문서 등록부 ── doc.open(1회/워커) ──▶ worker 문서
  → 마운트 범위 → 요청(tokens · markdown · diffLines) ──▶ worker 결과 ──▶ client 캐시 ──▶ 소비 훅(revision 대조) ──▶ 마운트 행
```

- producer 기준: Git `GitDiffPatchFile.lines`(agent 파싱 · 상한 현행) · 도구 입력/결과(현행) · 산출물 `content`(data · 5MiB 상한 현행) · 스트리밍 꼬리(`advanceStableBlocks` 현행).
- consumer 파생 규칙: 행 모델·블록·줄 색인은 원천 객체마다 1회(EP-7) · 마운트 범위는 `useVirtualRows`(EP-8) · 토큰·hast 는 문서 revision 이 같을 때만 반영(EP-16 ③).
- 파생 가능한 합성값이 정본을 우회하지 않는가: 복사는 행 모델(원천 줄)에서 만든다 — DOM 문자열이 아니다(D-022). 카드 복사는 현행 `copyText(call)`(원천 입력). 폭은 원천 줄에서 센다(D-023).

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `computeClient()` 소비 4곳(S1) | `request` 서명에 선택 인자 추가 · `diffLines` 요청 형 변경 → `useDiffLines` 만 바뀐다. `useHighlightedHtml` 은 그대로 | AC1·AC6 · VP-44 |
| `setComputeClient`(테스트 주입) | 가짜 클라이언트가 `openDocument` 를 갖는다 — 쓰지 않는 테스트는 영향 0 | VP-40·VP-42 |
| 워커 생성(`client.ts:263-272`) | 진입점 배선만 바뀐다(`state.handle`) · 규칙 (i) 그대로 | AC28 gate |
| 테마 구독(S6) | 구독자가 `useDiffSyntax` → `useWindowTokens` 로 옮긴다 · `CodeBlock` 그대로 | AC17 · VP-44 |
| `DiffSyntaxContext` 소비(`LineText`) | `DiffRowTokensContext` 로 이름·값 형 교체 · 기본값 빈 함수 → 원문 | AC17 · VP-43 `diffSyntax.render.test.ts` |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 문서는 소비 컴포넌트 마운트(또는 원천 변경) 때 임차하고, 워커 전송은 그 문서를 쓰는 첫 작업 직전이다(EP-2 ②). 워커는 첫 작업 때 생긴다(현행).
- 취소/중단: 마운트 범위에서 빠진 창·블록의 대기 요청은 효과 정리가 취소한다. 실행 중 tokens·markdown·highlight 는 끝까지(결과는 캐시), diffLines 는 현행 워커 교체(D-024).
- 종료/quit/crash/renderer-gone: 창과 함께 워커가 사라진다(현행). 워커 `error`·`messageerror` → `fail`(현행) + 문서 `sent` 초기화(EP-2 ④).
- retry/timeout/partial failure: `unknown-doc` 은 문서 재전송 + 1회 재시도, 두 번째면 실패(소비자 원문). `continue` 는 실패가 아니다(연속 실패 0 으로). 시간 제한은 두지 않는다 — 작업 상한이 대신한다(AC4).
- cleanup/rollback: 임차 0 → `doc.close`(전송된 경우). 소비 컴포넌트 언마운트 → 임차 해제. 워커 체크포인트는 문서가 닫힐 때 함께 버린다.
- **다중 저장소 쓰기**: 해당 없음 — DB·설정·파일 쓰기 0. 문서 산출물의 판정 사본은 `plan.md` 와 `INDEX.md` 두 곳이고 INDEX 비고는 plan 을 가리킨다(상태·다음 주체·대상 커밋만 INDEX 가 정본).

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: tokens 응답 = 창 200줄 × 줄당 토큰(5만 줄 입력 평균 15 — M4 750,000/50,000) ≈ 3,000 토큰 · 크기 ≈ (200 + 3,000) × 36 + 문자 ≈ 0.12M(캐시 상한 4M 안) · 마운트 창 ≤ ⌈(마운트 행 + 200)/200⌉ = 2(가시 30 + overscan 40). markdown 응답 = 블록 하나의 hast(최상위 50개 복제 0.60ms — M6).
- 새 요청 수의 `원천 상한 × 배치 상한`: 스크롤 한 번에 새로 드는 창 ≤ 2 · 문서 전송 = 문서 수 × 워커 수명(교체마다 1회). 5만 줄 끝으로 바로 가면 전진 작업 ⌈50,000 / 600⌉ = 84개(작업당 ≤ 600줄 · 사이마다 다른 요청 처리).
- 문서 전송 비용: 4,155,559자 문자열 복제 2.87ms(M3) — 펼침당 축 2개 ≈ 6ms(창).
- 구조적 목표: 없음(줄·파일 수 목표 없음).
- 캐시·호출 축소로 잃는 부수 효과: ① 화면 밖 행은 DOM 이 없어 브라우저 찾기(Ctrl+F)가 마운트 행만 찾는다 — 기존 Git 패널·도구 카드에 앱 찾기 기능은 없고(`rg -n "find-in-page\|findInPage\|found-in-page" src` → 0, 이번 세션 `de270fe`), 브라우저 기본 찾기는 Electron 에서 기본 비활성이라 잃는 동작 없음으로 판단 — S-C1 이 확인 ② 행 모델 메모는 원천 객체 identity 에 기댄다 — store 가 같은 patch 객체를 새로 만들면 재계산(현행 `receiveGitPatch` 는 새 세대에만 새 객체 — `chatReducer.ts:173-183`) ③ 문서를 워커에 두는 동안 그 문자열 메모리가 두 벌(창·워커)이다 — 상한 32,000,000자(D-010).

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

해당 없음 — 외부·배포가 구현할 port/schema/config 를 바꾸지 않는다. 직접 의존성 선언(D-005)은 TRD §2 와 `app/AGENTS.md` 채택 목록에 적는다(EP-14).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 실행 중 취소 + 대기 요청 → 워커 교체 | 0324 `client.ts:9-10` · `client.test.ts:269` | D-024 · EP-4 ④ · AC6 | 변경 — diffLines 로 좁힘(문서·체크포인트 보존 근거 M4) |
| 상한 없는 계산은 UI 스레드에 두지 않는다 | 0324 D-008 | §1 · D-011 · B5 | 유지 — 행 모델은 O(n) 1회(측정 22.74ms + 색인), 50ms 넘으면 W 판정 |
| 워커 실패 시 UI 대체 계산 없음 | 0324 D-009 | §5 · §13 · VP-40 | 유지 |
| 강조 상한 32,000자 | 0324 D-012 | B4 · AC22(가상 코드 보기는 범위 토큰이라 상한 밖도 색) | 유지 — transcript `CodeBlock` 은 그대로, 가상 코드 보기만 범위 토큰 |
| diff 문자 우선·카드 머리 예산 | 0325 D-008 · 0325 D-037 | §4 · VP-41 | 유지 |
| 캐시 비용 = 키 + 워커 크기 | 0325 D-038 | B11 · VP-42 | 유지 — 키가 짧아진다 |
| C 의 워커 규약은 후속 구현 전에 합의 | 0325 D-021 | D-008 상태 칸 | 유지 — 이 plan 검토가 합의 절차 |
| 조건부 항목은 실측과 함께 현행 유지 종결 가능 | 0325 D-043 | D-016·D-017·D-018 | 유지 |
| features/chat 안 `useVirtualizer(` 1(transcript 단일 뷰포트) | 0326 EP-10 | F2 · EP-8 ① · VP-47 | 유지 — 새 훅은 `shared/ui/virtual/` |
| TanStack 크기 보정 끔(transcript) | 0326 D-056 | `useVirtualRows` 는 TanStack 기본 보정 | 유지 — transcript 밖이라 적용 대상 아님 |
| 스크롤 쓰기 금지 범위(transcript 스크롤 요소 소유 폴더) · 우측 패널·diff 스크롤 제외 | 0326 D-062 | 도구 카드 본문의 내부 스크롤은 그 요소 자신 — 0327 소스는 `scrollTop` 을 쓰지 않는다(TanStack 내부) · Git 은 제외 범위 | 유지 |
| 0326 B9 "워커는 단계 C" · B11 "큰 블록 안 나누지 않음" | 0326 §10 | D-006 · D-026 | B9 는 이번에 닫고 B11 은 범위 밖 |
| 한 스크롤 소유자(Git 패널) · 위쪽 펼침 보정 · 문맥 펼침 키 보존 | 0211 D-073 · 0211 D-090 · 0211 D-058 | EP-9 ① · AC12 | 유지 |
| 그룹 스코프 격리 · Tailwind 토큰 · 새 CSS 금지 · 인라인 style 은 동적 값만 | `src/renderer/AGENTS.md` | §11 — 최소 폭·여백 높이는 동적 값(인라인 style), 384px 은 Tailwind 클래스 상수 | 유지 |
| 의존성 추가는 사용자 승인 | `app/AGENTS.md` §의존성 정책 | D-005 · EP-14 | 승인됨(턴 1 질의 4) |
| renderer 4-layer · feature 교차 금지 | `src/renderer/AGENTS.md` | §9 import 방향 | 유지 |
| 테스트 소스 규칙(시간 예산·풀 분류) | `app/AGENTS.md` | §7-A 운영 gate | 유지 — 새 테스트는 unit 풀(자식 프로세스·SQLite 없음) |

- **교차검증 관측(`ACTIVE 결정 ↔ AC`)**: 충돌 0. D-001·D-002 ↔ §6-B 전 행(T08·T14·T15·T22·T23·T27·T33 + B9·B21) · D-003 ↔ 메타 착수 조건 · D-004 ↔ AC18("400줄 초과 … 384px … 400 이하는 현행 DOM")·AC19·AC20("카드 복사 버튼 문자열은 전체 원문") · D-005 ↔ AC23("창 remark 파싱 0 … 원문 즉시")·AC24("목록 안 펜스 · 참조 링크 · 인용 연속")·AC28(의존성 4) · D-006 ↔ AC26 · D-007 ↔ VP-40~42·VP-44 · D-008 ↔ AC1~AC7 · D-009 ↔ EP-5·AC1 · D-010 ↔ AC2("상한을 넘는 새 문서는 보내지 않고") · D-011 ↔ AC9·B5 · D-012 ↔ AC8 · D-013 ↔ AC10("400행 이하: 전부 … 화면 근처 파일만") · D-014 ↔ AC3·AC17 · D-015 ↔ AC17("테마 전환은 마운트 창만 다시") · D-016 ↔ §6-B T33 · D-017 ↔ §6-B T23 · D-018 ↔ §6-B B21·AC18 · D-019 ↔ AC23·AC26·AC27("4,000자") · D-020 ↔ AC24·EP-12 ① · D-021 ↔ AC24·VP-23 f2 · D-022 ↔ AC15 · D-023 ↔ AC16 · D-024 ↔ AC6 · D-026 ↔ §6 비범위·B3 · D-025 ↔ AC29·AC30.
- **같은 대상 여러 절 대조**: 임계 400 — D-004·D-013·AC10·AC18·AC19·AC22·EP-11·§11 이 모두 "400 초과 = 가상, 이하 = 현행" 이다(AC10 "400행 이하: 전부"). 384px — D-004·AC18·AC19·§10-A 상수. 4,000자 — D-019·AC23·AC26·AC27·EP-12 ⑧·EP-13 ①. 창 200줄 — D-014·AC17·§10-A `TOKENS_RANGE_MAX_LINES = 200`·EP-16 ①·§14. 작업 600줄 — AC4·§5 상태표·§10-A·§14.

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| Git 패널 가상화가 기존 상호작용(위쪽 펼침·요구사항·초안·선택)을 깨뜨린다 | 400행 이하 파일은 현행 DOM(D-013) — 기존 렌더 테스트 전부가 소형 경로(VP-43). 400행 초과 경로는 v1~v12 가 상호작용마다 잠근다 |
| 블록 렌더가 전체 렌더와 다르다 | 이어짐·정의·각주 규칙(D-020) + fixture 대조(AC24) · 남는 차이는 B10 |
| 워커 hast 경로가 react-markdown 과 갈라진다(버전 업 등) | react-markdown `post` 의 같은 단계만 재현(D-021) · fixture 대조가 react-markdown 출력과 직접 비교한다 — 버전이 바뀌면 f1 이 red |
| 체크포인트 메모리(문서·테마별 GrammarState) | 200줄마다 1개 · 5만 줄이면 250개 × 테마 2 — 문서가 닫히면 버린다 |
| 0326 r2 가 같은 파일을 바꾼다 | 착수 조건 D-003 · 착수 턴이 §18 과 §8 줄 참조를 0326 PASS 커밋으로 다시 대조 |
| 브라우저 찾기가 화면 밖 행을 못 찾는다 | §14 ① — 잃는 동작 없음 판단, S-C1 이 확인 |
| TanStack 측정과 위쪽 펼침 보정이 겹친다 | 보정은 앵커 rect 차이로 한 번(현행) · 이후 측정 차이는 TanStack 기본 보정 — v5 가 두 단계 뒤 앵커 위치를 단언 |

- 되돌리기 어려운 결정: 없음 — 공개 IPC·저장 형식·DB 변경 0. 의존성 선언은 `package.json` 줄이다.
- 신규 의존성: `unified`·`remark-parse`·`remark-rehype`·`hast-util-to-jsx-runtime` — 사용자 승인(D-005). 이미 `node_modules` 에 있는 react-markdown 전이 의존성이라 설치 산출 변화는 lock 의 직접 표기뿐이다.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/shared/compute/{protocol,limits,client,documents,fakeClient.testfixture}.ts` · `shared/compute/worker/{state,handler,tokens,markdown,compute.worker}.ts`
- `app/src/renderer/src/shared/ui/virtual/{limits,useVirtualRows,rowSelection}.ts`
- `app/src/renderer/src/shared/ui/markdown/{markdownComponents,Markdown,MarkdownHast,CodeBlock}.tsx`
- `app/src/renderer/src/features/chat/lib/{diffRowModel,diffSyntax,markdownDocumentBlocks}.ts`
- `app/src/renderer/src/features/chat/hooks/{useWindowTokens,useDiffDocuments,useDiffRowTokens,useDiffLines}.ts` · `useDiffSyntax.ts`(삭제)
- `app/src/renderer/src/features/chat/harnesses/common/rightpanel/{FileDiffSection,ArtifactPreviewContent,ArtifactViewer}.tsx`
- `app/src/renderer/src/features/chat/harnesses/common/transcript/DiffTable.tsx`
- `app/src/renderer/src/features/chat/harnesses/claude/transcript/{WorkToolBody.tsx,tool-bodies/DiffBody.tsx,tool-bodies/FileBody.tsx}`
- `app/src/renderer/src/features/chat/harnesses/opencode/transcript/ToolBody.tsx`
- `app/src/renderer/src/features/chat/components/{code/VirtualCodeView.tsx,markdown/VirtualMarkdownView.tsx,markdown/WorkerMarkdownTail.tsx,markdown/StreamingMarkdown.tsx}`
- 테스트: §11 seam 칸의 신규 파일 + 수정(`client.test.ts:269` 입력 · `handler.test.ts` · `diffSyntax.test.ts` · `diffSyntax.render.test.ts` 가짜 응답 형상 · `CodeBlock.render.test.ts` · `ArtifactPreviewContent.render.test.ts`)
- `app/scripts/{ui-thread-rules.mjs,check-ui-thread.test.mjs,measure-ui-inputs.mjs,measure-ui-inputs.test.mjs}` · `app/package.json`(+ lock)
- 문서: `docs/TRD.md`(§2 마크다운 행) · `app/AGENTS.md`(채택 목록) · `docs/arch/execution-model.md`(계산 워커 행) · `docs/arch/frontend/design-components.md`(카탈로그 — `VirtualCodeView` · `VirtualMarkdownView` · `MarkdownHast` · `useVirtualRows` 행, `DiffTable`·`FileDiffSection`·`CodeBlock` 행의 가상 규칙)
- 미접촉: `app/src/main/**`(agent `git-diff-parse.ts` · data `artifacts/formats.ts` 포함) · `app/src/shared/**` · `app/src/preload/**`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` §better-sqlite3 ABI · 제약 환경 게이트 가이드 · §로컬 확인 · `src/renderer/AGENTS.md`(4-layer · 스타일 · 디자인 시스템).
- ABI/네트워크 등 환경 제약: 이 환경은 Electron 바이너리 403 → `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`. DB 로드 스위트 실패는 환경 서명으로 분리(0326 PASS 커밋과 실패 집합 차집합 ∅).
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트(수정 루프): `./node_modules/.bin/vitest run src/renderer/src/shared/compute src/renderer/src/shared/ui/virtual src/renderer/src/shared/ui/markdown src/renderer/src/features/chat/lib src/renderer/src/features/chat/hooks src/renderer/src/features/chat/harnesses/common src/renderer/src/features/chat/components/code src/renderer/src/features/chat/components/markdown`.
- IMPL_DONE 전 마지막 gate: §7-A 운영 gate 표 전부(가드 5 · lint · typecheck · 필터 없는 vitest · `node --test scripts/*.test.mjs` · 빌드 + 두 스모크).
- 사람 실기: AC30(아래).

### 측정 — K1~K8 함수 재측정 (WU-10 · `measure-ui-inputs.mjs`)

| ID | 입력(결정적) | 재는 것 | 0326 PASS 트리 |
|---|---|---|---|
| K1 | F5 Git 50,000줄(`gitFileContent`) → 패치 줄 | `buildDiffRowModel` + `buildRequirementIndex`(요구사항 200) | `N/A(함수 없음)` — 대조는 `patchLinesToDiffLines` + `buildDiffHunks` + 현행 `counterpartOf` 전 행 |
| K2 | 같은 파일 · 축 문서 | 워커 `tokensRange` — 창 [0,200) 첫 요청 · [49,800, 50,000) 전진 작업 수와 합계 | `N/A(함수 없음)` — 대조는 현행 `compute(diffTokens)` |
| K3 | F6 Markdown 1MB(합성 — 제목·문단·목록·표·펜스) | `markdownDocumentBlocks` · 워커 `markdownBlock` 첫 30블록 합 | 대조 `renderToString(Markdown)` 전체 |
| K4 | 꼬리 loose list 4,000 · 20,000 · 100,000자 | 워커 파싱 + `MarkdownHast` 렌더 | 대조 `renderToString(Markdown)` |
| K5 | F7 코드 5MiB(약 10만 줄) | `VirtualCodeView` 줄 시작 색인 · 폭 | 대조 `CodeBlock` plain 줄 번호 식 |
| K6 | 경로 200개 | `buildChangedFileTree` + `visibleTreeRows`(T23 기록) | 같은 함수 |
| K7 | 990,044자 patch | `unifiedDiffLines`(B21 기록) | 같은 함수 |
| K8 | 32,000자 TS | 워커 `highlight`(T33 기록) | 같은 함수 |

### 사람 실기 — AC30 측정 규약 (0325 §19 · 0325 D-042 와 같은 규약)

- 빌드: 0326 기계 PASS 커밋 빌드(이전)와 0327 구현 빌드(이후)를 같은 Windows 장비·같은 배율·같은 주사율에서 교차 3회씩. 설치본(`build:win`)은 `perf.stall` 을, 진단 빌드는 trace·React Profiler 를 따로 적는다. 이전 빌드에서 못 하는 조작은 `N/A(실패: 관측)`.
- 재현 파일: `node scripts/measure-ui-inputs.mjs --write-inputs <폴더>` 가 F5(Git 저장소 50,000줄 추가 파일 — 현행) · F6(Markdown 1MB) · F7(코드 5MiB) · F8(파일 200개 저장소)을 쓴다.

| ID | 하네스 | 재현 | 조작 | 기록 |
|---|---|---|---|---|
| S-C1 | Claude Code(Git 패널) | F5 | 파일 펼침 → 휠 10초 → 나란히 전환 → 끝 근처 줄 요구사항 추가·초안 10자 → 1번 줄~끝 근처 선택 복사 | 펼침 → 첫 행 paint · 스크롤 입력 → paint p95/최대 · 초안 키 입력 → paint p95 · 마운트 행 수 · 복사 문자열 줄 수 · Ctrl+F 동작 여부 |
| S-C2 | Claude Code(Git 패널) | F8 | 모두 펼치기 → 휠 10초 | 펼치기 → paint · 마운트 행 수 · `perf.stall` |
| S-C3 | Claude Code(도구 카드) | F5 파일 Read(앞 2,000줄) · 큰 Write/Edit 가 있으면 그 카드 | 카드 펼침 → 내부 스크롤 → 카드 복사 | 펼침 → paint · 스크롤 p95 · 복사 문자열 길이 = 원문 |
| S-C4 | 산출물 뷰어 | F6·F7 을 산출물로 게시하도록 요청 | Markdown 미리보기 열기 → 휠 → 코드 모드 전환 → 휠 | 열기 → 첫 블록 paint · 원문 → 서식 교체 시간 · 스크롤 p95 |
| S-C5 | Claude Code · OpenCode | loose list 300항목 이상 답변 요청 | 스트리밍 중 한글 타이핑 · 휠 | delta → paint p95 · 50ms/160ms 구간 수 |
| S-C6 | Claude Code | 코드 블록 20개 이상 답변 | 테마 전환 2회 | 전환 → 전부 색 paint · DOM 교체 구간 · `perf.stall` |
| S-C7 | Claude Code | S-C1 의 F5 끝으로 바로 이동 직후 코드 블록 답변 수신 | 끝 이동 → 새 답변 | 새 코드 블록 강조까지 시간(워커 대기) |

- 기록 완결이 AC30 의 완료다 — 허용치 판정은 W(0325 D-025 OPEN).

## READY self-review

- [x] Decision Ledger — D-001~D-026, 사용자 결정 5건은 질의 원문 인용(§3). SUPERSEDED·OPEN 0(관측: §3 상태 열).
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §1 한 문장 · §5 흐름 · §6-B 판정.
- [x] 조건절·이유절을 재해석하지 않았다 — D-004 "400줄 이하는 지금과 같다" → AC18·AC19 "400 이하는 현행 DOM/CodeBlock". D-005 "창 파싱 0" 의 적용 범위를 D-019 로 좁힌 것은 설계자 결정이고 "사용자 거부 가능"으로 표시했다.
- [x] Product/UX 핵심 동작 ↔ AC ↔ Technical Design — §16 교차검증 관측.
- [x] AS-IS 와 TO-BE 가 같은 축(§9 Delta 8행).
- [x] Delta 각 행 → 구현 파일(§11) 또는 AC.
- [x] AS-IS 에서 사라진 책임 — `diffTokens`·`useDiffSyntax`·`counterpartOf`·전 종류 워커 교체 → §9 "제거/대체".
- [x] 수치·전칭·앵커·테스트 인용 실측 — §8 M1~M13 · S1~S10 · 검산.
- [x] 각 AC 행동 단언·검증·경로 — §7 표.
- [x] Baseline V(상속 없음) — §7-A.
- [x] 모든 NEW·CHANGED 노드에 같은 레벨 REQUIRED pair — R-01~08 ↔ VP-01~08 · SD-01~04 ↔ VP-10~13 · AR-01~05 ↔ VP-20~24 · MD-01~10 ↔ VP-30~38.
- [x] 영향받은 INHERITED 는 REGRESSION(VP-40~47) · NOT_REQUIRED 없음.
- [x] pair 마다 경로·§10 분모·좌표 · 적대 증거 선택 이유.
- [x] 규칙 칸 분기 ↔ 입력 — EP-6 ①(삭제 묶음·추가 묶음·그 밖) ↔ cp1 전수 · EP-12 ①(이어짐 셋 · 각주) ↔ mb1~mb5 · EP-2 ⑤⑨ ↔ d5·d6 · EP-4 ④(diffLines·그 밖) ↔ q5~q7 · EP-13 ④⑤ ↔ s3·s4.
- [x] 선언 경계(측정한 것만) — B1~B13 · 열린 입력 집합 판정 산출물 해당 없음.
- [x] INDEX `## 새 handoff 후보` 겹침 — 0325 행(C 승격 → 0327로 갱신) · 0326 B28 행(`chatReducer` — 0327 미접촉).
- [x] 운영 gate — §7-A 표 · 기준선 분리는 0326 PASS 커밋 기준.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC30 은 Windows 시간·paint 만.
- [x] semantic 목표 ↔ structural proxy — 마운트 수(AC10)는 "전부 렌더" 변이 red 로 방향 확인(VP-22) · "창 파싱 0"(AC23·AC26)은 spy 계수 + import 0 짝(§7 주의사항).
- [x] 신규 계약 SSOT·강제 지점·seam — §10-A · §11.
- [x] 부팅/등록 변경 소비처 — §12 표.
- [x] producer/consumer 양쪽 — §12.
- [x] 상한·총량 — §14.
- [x] 게이트 명령 = `app/AGENTS.md` 현행.
- [x] `ACTIVE 결정 ↔ AC` 대조 관측 — §16.
- [x] 산출물 문장 규칙.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …
- 착수 대조(D-003) — 0326 PASS 커밋과 §18·§8 줄 참조 차이: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | … | … | … | … | … |

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(verify 0회)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | … |
| **추가·수정 테스트의 subtree 규칙** | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |
