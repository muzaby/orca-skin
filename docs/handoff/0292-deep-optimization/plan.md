# Plan — 0292-deep-optimization

## 메타

| 항목 | 값 |
|---|---|
| slug | `0292-deep-optimization` |
| 작성자 | Claude Code |
| 일자 | 2026-11-01 |
| 매핑 | 사용자 `/handoff-plan` "292 핸드오프" — 0290이 다루지 못한 최적화 보완, 파괴적 수준, 서브에이전트 없이 조사 |
| 상태 | READY (ΔV3 · r2 구현 대기) — r1 verify RETURN_TO_PLAN([verify](verify.md))의 PLAN_GAP D10·D11을 ΔV2로 닫고, 사용자 결정 변경(마지막 백엔드 원칙)을 ΔV3로 반영 |
| V mode | `Delta V` |
| 기준 V | `0292:V1@64047af` — 이 plan의 V1(설계 HEAD `0eb7dc2`에서 작성, main 병합 `64047af`) |
| 이번 V revision | `ΔV3` — 사용자 결정 변경 반영(2026-11-03). 직전 `ΔV2` — r1 verify RETURN_TO_PLAN 정정 · `ΔV1` — 버전 확인 실측 반영 정정 |
| 유효 V | `V1 + ΔV1 + ΔV2 + ΔV3` — 뒤 revision 절이 충돌하는 앞 행을 대체 |
| 기준 커밋 | V1 설계 HEAD `0eb7dc2` · V1 병합 `64047af` · ΔV1 설계 HEAD `feaca09`(셋 다 `git cat-file -t` = commit). 구현 착수 HEAD는 D-011 — 좌표는 검증자 기입. ΔV2 기준: ΔV1 설계 `3c50653`(`main` 조상) · r1 구현 `c9d212b`·r1 verify `104034e`(둘 다 commit, 브랜치 `ccr-84491548-x3d7lw` — `main` 미병합). ΔV3 기준: ΔV2 설계 `7f3b156`(commit, `main` 미병합 — 브랜치 `ccr-5c72b447-vhhjlk`) |

> **ΔV1(2026-11-02)**: D-005·D-008을 D-014·D-015가, AC2~AC6을 AC2′~AC6′가, §10 EP-02·EP-04 전부와 EP-05 #1-8·#15·EP-03 #1을 아래 ΔV1 절이 대체한다. 그 밖의 V1 행은 그대로 유효하다.
>
> **ΔV2(2026-11-02, r1 verify RETURN_TO_PLAN)**: D-016~D-018을 더하고, AC4′·AC5′·AC7을 AC4″·AC5″·AC7′가, EP-03·EP-04′ 전부를 EP-03″·EP-04″가 대체한다. EP-05에 #16·#17을 더하고 EP-02′ #1·EP-05 #9·#14·EP-05′ #15·EP-08 #2·EP-10 #1의 직접 oracle을 정정한다 — 정본은 아래 ΔV2 절.
>
> **ΔV3(2026-11-03, 사용자 결정 변경)**: D-007·D-016·D-017을 D-019·D-020이 대체한다. AC7′를 AC7″가, EP-03″ 전부를 EP-03‴(19항목·39자리)가, ΔV2 구현 지시의 `setModel`·`Composer.tsx`·D-017 행과 등록 변이 U1·U2를 ΔV3 절이 대체한다 — 정본은 아래 ΔV3 절.

## 0. 작성 경로

- **판정: 조사는 설계자가 직접 수행했다(D-002).** 기계 스캔(`rg` 전수, 번들 빌드+소스맵 귀속, 실측 스크립트)과 표적 읽기를 했고 서브에이전트는 쓰지 않았다.
- 재현 도구: [`scan/sites.sh`](scan/sites.sh)(§10 자리 검색 전부) · [`scan/bundle-measure.mjs`](scan/bundle-measure.mjs)(진입 청크·계열 바이트·자산 수) · [`scan/raw-ratio.ts`](scan/raw-ratio.ts)(보관 payload의 raw 몫) · 기준선 [`baseline/bundle.json`](baseline/bundle.json).
- 사용자 질의 3라운드로 결정 9건을 닫았다(§2·§3). 이 plan은 구현 지시서이고 구현 커밋은 없다.

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0290은 0254~0289 커밋이 건드린 파일 안의 정리·효율만 다뤘다. 그래서 부팅 임계 경로, 렌더러 번들, OpenCode 스트리밍 투영, 보관 payload, 상시 타이머가 남았다. 0290이 NEXT_HANDOFF로 미룬 폴링 3건(A1·A3·A15)과 부팅 대기(A9)도 그대로다.
- 완료 후 달라지는 것: 부팅이 OpenCode CLI 확인을 순서대로 기다리지 않고 다른 부팅 단계와 겹쳐 처리한다(ΔV1). 렌더러 시작 청크가 압축되고 차트·구문 강조는 쓸 때 로드된다. OpenCode 스트리밍은 프레임마다 전체 대화를 다시 투영하지 않는다. 세션 열기는 원본 레코드(raw)를 파싱하지 않는다. 할 일이 없을 때 main 타이머가 깨지 않는다.
- OpenCode 미설치 처리(D-006): 미설치나 미지원 버전이면 OpenCode 컴포저가 보이지 않고, 엔진 추가에서 OpenCode를 고를 수 없으며, main의 OpenCode 백그라운드 작업이 돌지 않는다.
- 성공 한 문장: **설치된 사용자는 같은 화면·같은 동작을 더 빨리 받고, OpenCode가 없는 사용자는 실패할 동작을 처음부터 보지 않는다(D-003).**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "290 최적화에서 다루지 못했거나 소홀했던, 최적화가 미진한 부분을 검토/진단하고 최적화를 보완하라." "파괴적 수준의 최적화 진행하라" "자료조사에서 서브에이전트 사용하지 말것" | 라이브 세션 턴 1 |
| 명시 결정 | 번들 압축: "전체 압축 (Recommended)" | 질의 1라운드 |
| 명시 요구 | 설치 확인: "두 개 사례에 대해 사용자 경험리 어떻게 바뀌게 되는지 설명하라" → "버전확인은 설치 확인으로 동작하는 걸로 아는데 이후의 오픈코드 백그라운드 작업들에 대해 영향을 미치는 것 아닌지?" | 질의 1·2라운드 |
| 명시 요구 | "사용자 경험 및 애플리에케이션 회귀가 없어야 한다. 여기에 추가로 opencode가 설치 돼있지 않은 경우에 대해 이후 관련 작업들이 수행되지 않도록 및 비활성화되도록 하는 방안으로 유리한 방법에 대해 제안하라. 사용자 체감 반응성 및 앱 동작이 원활한 방향으로 제안할 것" | 질의 2라운드 |
| 명시 결정 | "미설치 시 opencode  컴포저가 노출되면 안 된다. 또한 엔진&모델 페이지에서 oppencode 하네스 추가 버튼도 비활성화되어야 한다. Claude의 경우 bin이 앱에 동봉되어 있어 지금 다루고 있는 문제와 무관한다." | 질의 3라운드 |
| 명시 요구 | raw: "세션을 불러올때 읽는것 아닌가? 왜 읽히지 않는다는거지? 그리고 기간이 지나 삭제가 되는 jsonl에 대해 저장한 raw로 해석하고 대화를 이어나갈 슈 있도록 조치한 것이다." → 정정 설명 후 "raw 분리 보관 (Recommended)" | 질의 1·2라운드 |
| 명시 결정 | 0225 이관: "각각의 경우에 대해 사용자 경험이 어떻게 달라지는 지 설명하라" → 설명 후 "유지 (Recommended)" | 질의 1·2라운드 |
| 명시 결정 | 기본 하네스: "Claude로 시작 (Recommended)" · 구현 주체: "Codex" | 질의 3라운드 |
| 추론 의도 | "파괴적 수준" = IPC 응답 형상·저장 열·빌드 설정·모듈 경계까지 바꿀 수 있다는 뜻. 단 위 "회귀가 없어야 한다"가 상한이다 — 추론(D-003) | 턴 1 + 질의 2라운드 |
| 추론 의도 | "다루지 못했거나 소홀했던" = 0290 §8 커버리지 밖(범위 커밋이 안 건드린 파일) + 0290 §17 NEXT_HANDOFF + verify N1 — 추론(D-003) | 0290 plan §8·§17, verify §13 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이번 턴은 plan READY까지다. 구현은 Codex가 맡는다 | "Codex" | 질의 3라운드 | ACTIVE | — |
| D-002 | 조사는 서브에이전트 없이 설계자가 직접 한다 | "자료조사에서 서브에이전트 사용하지 말것" | 턴 1 | ACTIVE | — |
| D-003 | 사용자 관측 회귀 0 — 화면·문구·대화 흐름·설정 값·보관 대화가 같다. 의도된 변화는 D-004~D-009의 항목뿐이다 | "사용자 경험 및 애플리에케이션 회귀가 없어야 한다" | 질의 2라운드 | ACTIVE | — |
| D-004 | renderer production 번들을 전체 압축한다. main·preload는 압축하지 않는다 | 실측 3.89MB→1.83MB(§8) · 스택은 같은 커밋을 `--sourcemap`으로 빌드해 복원 | "전체 압축" | ACTIVE | — |
| D-005 | 부팅은 OpenCode 버전 확인을 기다리지 않는다. registry 설치 캐시와 `orca:backend:list`의 `installed`를 하네스 가용성 상태로 대체한다. 판정원은 서버 풀의 실행 파일 탐색 + 버전 확인 캐시 1벌이다 | 그 값을 읽는 화면이 없다(§8) · 백그라운드 작업은 서버 풀 캐시만 쓴다(§8) | 질의 2라운드 답 + 추적 | SUPERSEDED | D-014 |
| D-006 | OpenCode가 미설치·미지원·확인 실패면 OpenCode 컴포저를 노출하지 않는다(모델 메뉴의 OpenCode 엔진 비노출, 기존 OpenCode 세션은 컴포저 자리에 안내). 엔진&모델 페이지의 OpenCode 추가 항목은 비활성이다. main의 OpenCode 백그라운드 작업(웜업·로그인 프리 연결의 CLI 확인·전역 설정 감시·컴포저 준비)은 시작하지 않는다. Claude는 대상이 아니다 | "미설치 시 opencode 컴포저가 노출되면 안 된다" · "추가 버튼도 비활성화" · "Claude … 무관" | 질의 3라운드 | ACTIVE | — |
| D-007 | 마지막 하네스가 OpenCode인데 사용할 수 없으면 새 대화는 Claude로 시작하고 `lastBackend`는 덮어쓰지 않는다 | "Claude로 시작" | 질의 3라운드 | SUPERSEDED | D-019 — Claude 시작은 유지, `lastBackend` 미기록은 대체 |
| D-008 | 가용성 판정 방식(D-005의 세부) — ① 실행 파일이 없으면 프로세스를 띄우지 않고 즉시 `missing`. ② 있으면 `checking`이며 화면은 사용 가능으로 취급(깜빡임 없음). ③ 버전 확인은 `start()` 초입에 대기 없이 시작해 부팅 단계와 겹친다(1회, 이후 수요는 합류). ④ 재확인은 실행 파일 설정 변경·"다시 확인"·`missing/failed` 상태의 창 포커스(파일 존재만 검사) | "사용자 체감 반응성 및 앱 동작이 원활한 방향으로 제안할 것" | 설계자 제안(질의 2라운드 설명) — 답변이 화면 요구만 더함 | SUPERSEDED | D-015 |
| D-009 | 보관 raw를 같은 행의 별도 열로 분리 보관한다. 세션 열기·표시는 `messages`만 읽는다. 기존 행은 그 세션을 처음 열 때 1회 분리한다. raw를 지우지 않는다(삭제된 원본 재해석 대비 의도 유지) | "raw 분리 보관" · 원본 삭제 후 이어가기는 `messages` 경로(§8) | 질의 2라운드 | ACTIVE | — |
| D-010 | 0225 이관 코드(폴더 이동·경로 재기록·워크트리 repair)를 유지한다 | v0.3.1 사용자 데이터 연속성 | "유지" | ACTIVE | — |
| D-011 | 구현은 0290 r2 커밋이 공유 브랜치에 착지한 뒤 그 HEAD에서 시작한다. 착수 직후 `scan/sites.sh`·`baseline` 측정을 다시 하고 N이 다르면 `[구현자 기입]`에 차이를 적는다 | 0290 r2가 `project-resource-sync.ts`·`discovery-cache.ts`·`ScrollController.tsx`·`plugin-catalog.ts`·`handlers/skills.ts`·bootstrap 테스트를 고친다(0290 verify §13 D1~D5) | 설계자 | ACTIVE | — |
| D-012 | 0290 ACTIVE 결정 중 이번 경로에 닿는 것을 유지한다 — 배포 확장점(0290 D-008·D-015: `HostHarnessPort`는 시그니처·의미 유지, 구현만 가용성 경유) · 하네스 격리(D-009) · spawn 경계 동기 카탈로그(D-012) · 이벤트 id 상한 없음(D-016) | 기존 결정 | 0290 plan §3 | ACTIVE | — |
| D-013 | 신규 의존성 없음. shiki는 같은 패키지의 세분 진입점(`shiki/core`·`shiki/engine/javascript`·`shiki/langs/*.mjs`·`shiki/themes/*.mjs`)만 쓴다 | `app/AGENTS.md` 의존성 정책 · exports 실측(§8) | 설계자 | ACTIVE | — |
| D-014 | OpenCode 설치·버전 확인은 부팅 안에 둔다 — renderer `main-ready` 때 결과가 정해져 있다. 순차 단계 대신 `start()` 초입에 시작해 나머지 부팅 단계와 동시에 돌리고 `bootReport.finish()` 직전에 합류한다. 시간 초과 상한 15초와 그 처리는 현행 그대로다. `orca:backend:list`의 `installed`·`version`은 유지하고 `usable`·`unavailableReason`만 덧붙인다 | 확인은 사용자 실측 3초 이내 — 사용자 시나리오를 바꿀 근거가 없다 | "Version 확인은 오래걸리는 작업이 아니다. 15초 상한값 설정으로 유저시나리오를 변경하려는 시도를 너가 하지 않았나" → "그대로 plan 정정하라" | ACTIVE | D-005 대체 |
| D-015 | 가용성 SSOT는 registry 설치 캐시(하네스별 `installed`·`version`·`usable`·`unavailableReason`·실행 파일 identity)다. 화면에 `checking` 상태는 없다. 재확인은 ① 실행 파일 경로 설정 변경 ② "다시 확인" ③ `missing`·`failed` 상태의 창 포커스 — identity(경로+stat, 프로세스 없음)가 마지막 확인과 다를 때만 버전 확인 1회. 재확인 중에는 직전 상태를 유지하고 결과가 바뀔 때만 방송한다 | 앱 실행 중 OpenCode를 설치하면 재시작 없이 쓰던 현행 동작을 게이트가 깨지 않게 한다 | 위 사용자 턴 · V1 D-008 ①④ 승계 | ACTIVE | D-008 대체 |
| D-016 | OpenCode 사용 불가(미설치·미지원 버전·확인 실패)로 새 대화가 Claude로 자동 전환된 동안, 사용자가 모델 메뉴에서 직접 고른 모델은 `lastBackend`에 저장한다. 자동 전환과 자동 기본 모델 선택은 저장하지 않는다 | 사용자 선택이 다음 새 대화의 기본을 정한다 — 0292 이전 동작과 같다 | 2026-11-02 질의 [D11-1] "저장함"(질문: 메뉴에서 'Claude Opus'를 직접 골라 대화하면 '마지막 하네스=Claude'로 저장할까요?) | SUPERSEDED | D-019 — 메뉴 선택 저장은 유지, 자동 전환·자동 기본 모델 선택 미저장은 대체 |
| D-017 | 같은 실행 중 OpenCode가 다시 사용 가능해져도(설치 뒤 포커스·"다시 확인") 이번 실행 동안 새로 여는 빈 대화는 Claude로 시작한다. 메뉴에서 OpenCode 모델을 직접 고르면 그때부터 OpenCode이고, 다음 실행은 `lastBackend`를 따른다. 메뉴 선택 저장은 D-016을 따른다 | 실행 중 기본 하네스가 바뀌지 않는다 — 현재 구현 | 2026-11-02 질의 [D11-2] "이번 실행은 Claude" | SUPERSEDED | D-019 — 같은 실행 결과는 유지, 근거를 "마지막 백엔드"로 바꾸고 다음 실행도 Claude |
| D-018 | registry는 하네스 이름으로 분기하지 않는다 — 각 adapter가 `isInstalled()`에 `usable`을 싣고(Claude는 항상 `true`), 없으면 `installed`로 읽는다 | §16 "구체 하네스 비의존" · `src/main/AGENTS.md` 공통 계층 원칙 · "Claude의 경우 bin이 앱에 동봉되어 있어 지금 다루고 있는 문제와 무관한다" · r1 verify N2(`registry.ts:40`) | 설계자 | ACTIVE | — |
| D-019 | 새 대화·프로젝트 랜딩의 빈 칸은 마지막 백엔드로 시작한다. 마지막 백엔드는 새 대화·프로젝트 랜딩에서 마지막으로 정해진 하네스이고, 자의(모델 메뉴 선택·자동 기본 모델 선택)와 타의(OpenCode 사용 불가로 인한 Claude 자동 전환 — 부팅 시드·실행 중 사용 불가 전환)를 가리지 않고 정해지는 순간 `lastBackend`에 저장한다. OpenCode가 다시 사용 가능해져도 마지막 백엔드는 바뀌지 않는다 — 같은 실행·다음 실행 모두 Claude로 시작하고, 메뉴에서 OpenCode를 고르면 그때부터 OpenCode다 | "자의든 타의든 마지막 백앤드 선택을 클로드로 했기 때문임" · "마지막 선택 백앤드를 불러오는 것일 뿐이다" | 2026-11-03 사용자 턴 + 질의 [D11-3] 답 "니 경우 새대화, 프로젝트 랜딩은 클로드로 설정되어야 함"(질문: 자동 전환 뒤 메뉴를 건드리지 않고 OpenCode 설치 후 앱을 다시 켜면?) | ACTIVE | D-007·D-016·D-017 대체 |
| D-020 | 마지막 백엔드는 새 대화·프로젝트 랜딩에서만 읽고 쓴다. 대화 이어가기 — 기존 대화 재열기·분기(fork)·핸드오프 초안 — 는 원본 세션의 하네스를 쓰고, 그 안의 모델 선택은 `lastBackend`와 새 대화 기본을 바꾸지 않는다 | "단 대화 이어가기는 마지막 백앤드로 성립하지 않음. 반드시 새대화, 프로젝트 랜딩에서만 유효" | 질의 [D11-3] 답 | ACTIVE | — |

### 갱신 메모

- 이번 턴 신규 결정: D-001~D-013. OPEN 0. 대체된 외부 결정 없음.
- ΔV1(2026-11-02): D-005 → D-014, D-008 → D-015 SUPERSEDED. 원인은 설계자가 `--version` 실행 시간을 재지 않고 시간 초과 상한 15초(`server.ts:165`)를 비용처럼 제시한 것이다(§8 정정). 사용자 실측은 생성·종료 포함 3초 이내다.
- ΔV2(2026-11-02): r1 verify가 D-007의 명시 선택 범위를 PLAN_GAP(D11)으로 올렸다. 사용자에게 미설치·미지원·확인 실패를 시나리오로 설명한 뒤 질의해 D-016·D-017을 받았다. [D11-2] 선택지 설명의 "선택을 저장하지 않는다"는 자동 선택에 한정해 읽는다 — 메뉴 선택 저장은 [D11-1]이 정했다. D-018은 verify N2에 대한 설계자 결정이다.
- ΔV2 `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-016·D-017 ↔ AC7′ · D-018 ↔ AC6′(Claude 행 불변)·EP-05 #16·#17 · D-015 ↔ AC4″ · D-014 ↔ AC5″. D-007은 AC7′의 자동 전환 미저장으로 유지된다.
- ΔV3(2026-11-03): 사용자가 [D11-2] 선택 이유를 "마지막 선택 백엔드를 불러오는 것"으로 밝혀 D-007의 `lastBackend` 미기록과 결과가 갈렸다(다음 실행). 질의 [D11-3]으로 확인해 D-019·D-020을 받고 D-007·D-016·D-017을 SUPERSEDED로 돌렸다. [D11-3] 답은 선택지 밖 자유 답이다 — 저장 시점은 "선택을 클로드로 했기 때문"에 따라 전환이 정해지는 순간으로 읽었다(전송 시점 선택지는 고르지 않음).
- D-020으로 바뀌는 기존 동작: 분기·핸드오프 초안의 모델 선택이 `lastBackend`를 쓴다(`chatStore.ts:1891` 판정이 `sessionId` 없음만 본다 — 초안 포함). ΔV3가 이 기록을 막는다.
- ΔV3 `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-019 ↔ AC7″(자동 전환 기록 1·복귀 뒤 Claude 유지·메뉴 OpenCode 기록) · D-020 ↔ AC7″(초안 기록 0·기존 대화 기록 0) · D-006 ↔ AC7″ 노출 조건(AC7′ 그대로). SUPERSEDED D-007·D-016·D-017의 "자동 전환 미기록"을 요구하는 유효 AC 없음(AC7·AC7′는 대체됨).
- ΔV1 `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-014 ↔ AC2′·AC3′·AC5′(`installed` 유지) · D-015 ↔ AC4′·AC6′ · D-006 ↔ AC7(EP-03 #1′)·AC8·AC9. SUPERSEDED D-005·D-008을 요구하는 유효 AC 없음(AC2~AC6은 대체됨). D-003·D-004·D-007·D-009~D-013 대응은 V1 대조 줄과 같다.
- raw에 대한 설계자 정정: 1라운드 질의의 "OpenCode raw는 읽히지 않는다"는 부정확했다. 보관 행(`payload_json`)은 세션 열기마다 통째로 읽힌다. 다만 그중 `raw` 필드를 실제로 쓰는 코드는 Claude 이어붙이기 빠른 경로 하나다(§8). 사용자는 이 정정을 받은 뒤 D-009를 골랐다.
- (V1 — 아래 D-005·D-008 관련 대응은 ΔV1 대조가 대체) **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-003 ↔ AC1(회귀 gate)·AC7(보관 대화 표시 유지)·AC13(같은 DOM)·AC17(이어가기 동일). D-004 ↔ AC10. D-005 ↔ AC2·AC3·AC5. D-006 ↔ AC6·AC7·AC8·AC9(Claude 행은 AC6·AC8에서 불변 단언). D-007 ↔ AC7(`lastBackend` 미기록). D-008 ↔ AC4·AC12. D-009 ↔ AC15·AC16·AC17(raw를 지우라는 AC 없음). D-010 ↔ 0225 경로를 바꾸는 AC 없음(§16). D-012 ↔ AC9(`HostHarnessPort` 시그니처 불변)·AC18(이벤트 상한 미도입). D-013 ↔ AC12(새 패키지 0).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 | 부팅·번들·스트리밍·세션 열기 비용을 실측했다(§8 수치) |
| 이미 충족됐는가 | 부분 — Claude transcript는 이미 리프 구독이고 스트리밍 마크다운은 꼬리만 재파싱한다 | `claude/transcript/PendingAssistant.tsx:10` · `StreamingMarkdown.tsx:14` — 이번 범위에서 제외 |
| 더 작은 해법 / 제거 자체가 맞는가 | 설치 상태 캐시는 제거가 맞다(읽는 화면 0). raw는 사용자 의도가 있어 제거 대신 분리한다 | §8 · D-009 |
| 선행 자료 대조 | 0290 §17의 NEXT_HANDOFF 7건을 HEAD에서 재확인했다. A1·A3·A9·A15는 그대로, A16·lease 캐시는 이번에도 Skip(§17) | §8 표 |
| 기존 결정 충돌 | 없음 — 0290 결정은 D-012로 유지, 0225는 D-010으로 유지 | §16 |
| "파괴적"과 "회귀 0"이 충돌하는가 | 충돌하지 않게 경계를 정했다 — 형상·저장·빌드는 바꾸되 관측 결과는 D-003으로 묶는다 | D-003 |

- 사용자에게 올릴 결정: 없음(질의 3라운드로 9건 닫음).
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

```text
[앱 실행] → 창 → 부팅 단계(설치 확인은 다른 단계와 겹쳐 실행) → 랜딩
   ↘ 부팅과 동시에 OpenCode 설치·버전 확인 → 부팅 완료 직전 합류(화면이 뜰 때 결과 확정, ΔV1)
[OpenCode 사용 가능] → 지금과 같은 화면·동작
[OpenCode 사용 불가] → 모델 메뉴에 OpenCode 없음 · 새 대화 Claude · 엔진 추가의 OpenCode 비활성
                     → 기존 OpenCode 세션: 보관 대화 표시 + 컴포저 자리에 안내/다시 확인
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 부팅, OpenCode 실행 파일 없음 | 파일 존재 검사(프로세스 없음) → `missing` | 랜딩부터 OpenCode 비노출 — 깜빡임 없음 |
| 부팅, 실행 파일 있음 | 버전 확인을 부팅 시작과 동시에 돌리고 부팅 완료 직전에 합류(ΔV1) | 화면이 뜰 때 결과가 정해져 있다 — 사용 가능이면 지금과 같은 화면, 부팅은 겹친 만큼 일찍 끝남 |
| 부팅 확인 결과 `unsupported`/`failed` | 화면이 뜨기 전에 정해짐(ΔV1) | 처음부터 OpenCode 비노출 + 사유 |
| `missing`/`failed`에서 창 포커스 | 실행 파일 identity(경로·stat, 프로세스 없음)가 마지막 확인과 다를 때만 버전 확인 1회(ΔV1) | 설치 직후 앱으로 돌아오면 재시작 없이 OpenCode가 나타남 |
| 실행 파일 경로 설정 변경 · "다시 확인" | 재확인 — 진행 중에는 직전 상태 유지(ΔV1) | 결과대로 노출/비노출 |
| OpenCode 세션 열기, 사용 불가 | 보관 대화 로드는 지금과 같음 | 대화는 보이고 입력창 자리에 "OpenCode가 설치되어 있지 않습니다" + 다시 확인 |
| 엔진&모델 페이지 추가 메뉴, 사용 불가 | OpenCode 항목 비활성 + 사유 | Claude 항목은 그대로 |
| 부팅 또는 실행 중 OpenCode 사용 불가로 새 대화가 Claude로 자동 전환 | 전환하는 순간 마지막 백엔드 = Claude를 `lastBackend`에 저장(ΔV3, D-019) | 새 대화·프로젝트 랜딩이 Claude로 시작하고, 앱을 다시 켜도 Claude |
| 새 대화·프로젝트 랜딩에서 모델 선택(메뉴·자동 기본 모델) | 고른 하네스를 `lastBackend`에 저장 — 폴백 중에도 같다(ΔV3, D-019) | 다음 새 대화가 마지막으로 정해진 하네스로 시작 |
| 같은 실행 중 OpenCode가 다시 사용 가능 | 마지막 백엔드(Claude) 유지(ΔV3, D-019) | 모델 메뉴·기존 OpenCode 대화 입력창은 바로 돌아옴. 새 대화는 메뉴에서 OpenCode를 고를 때까지 Claude — 다시 켜도 같다 |
| 기존 대화 재열기·분기·핸드오프 초안에서 모델 선택 | 마지막 백엔드를 읽지도 쓰지도 않음(ΔV3, D-020) | 원본 세션 하네스로 이어가고, 새 대화 기본은 그대로 |
| 세션 열기(기존 보관 행에 raw 포함) | raw를 별도 열로 1회 분리 후 `messages`만 파싱 | 같은 대화가 더 빨리 뜬다 |
| OpenCode 스트리밍 | 확정된 교환은 커밋 때 1회 투영, 진행 중 교환만 프레임마다 투영 | 같은 화면 |
| 설정 > 사용량 탭 | 차트 모듈을 탭 표시 때 로드(같은 높이 자리 유지) | 같은 차트 — 최초 표시에 한 프레임 이상 늦을 수 있음 |
| 코드 블록·diff 첫 표시 | 강조 모듈·11개 언어·2 테마를 첫 사용 때 로드(현재도 첫 사용 때 생성) | 같은 강조 결과 |

### 파생 UX / 엣지케이스

- error: 버전 확인 시간 초과·실행 실패는 `failed` — 미설치와 같은 비노출 + "다시 확인". 서버 시작 오류 문구는 지금과 같다.
- cancel/retry/close: "다시 확인" 중복 클릭은 진행 중 확인에 합류한다. 종료 중이면 확인을 시작하지 않는다.
- concurrency: 버전 확인은 실행 파일 identity당 1회이고 동시 수요(웜업·연결 확인·서버 시작)는 같은 promise를 기다린다(현재 `server.ts:151` 캐시 유지).
- 진행 중 OpenCode 대화에서 상태가 사용 불가로 바뀜: 진행 중 턴은 건드리지 않는다. 다음 전송부터 안내로 바뀐다.
- theme/a11y: 비활성 메뉴 항목은 `aria-disabled`와 사유 툴팁을 가진다. 안내의 "다시 확인"은 버튼이며 키보드로 누를 수 있다.

## 6. 범위 / 비범위

- **범위**: §11의 작업 묶음 WP-1~WP-8.
- **비범위**: §17 Skip 표(main 델타 IPC 묶기, Claude 설정 2회 읽기 A16, OpenCode lease 설정 캐시, 0225 경로 재기록 스캔, 설치 마법사).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 설치 마법사(설치 상태 UI) | 아니오 — 가용성 상태가 같은 정보를 준다 | 후속 |
| `native_history_snapshots` 파일 크기 회수(VACUUM) | 아니오 | 후속 — raw는 지우지 않으므로 회수 대상이 아님 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 정리 후 기존 동작이 같다 | vitest 실패 ID − 착수 HEAD 기준선 = ∅ · typecheck 0 · eslint(무수정) error 0, warning ⊆ 기준선 · scripts · migration append-only · doc-inventory · Windows CI green | 전 진입점 |
| R-02 | AT-02 / ~~AC2~~ → AC2′(ΔV1) | `start()`가 OpenCode 버전 확인을 기다리지 않는다 | 신규 bootstrap 테스트: 버전 확인이 끝나지 않아도 `start()` resolve, boot report에 `adapter-registry` 없음 | 창 → `bootWhenReady` → renderer `main-ready` |
| R-02 | AT-02 / ~~AC3~~ → AC3′(ΔV1) | 첫 OpenCode 작업이 지금보다 느려지지 않는다 — 확인을 `start()` 초입에 대기 없이 시작해 부팅과 겹치고, 동시 수요는 합류 | 신규 테스트: `start()` 진입 직후 확인 1회 시작, 웜업·연결 확인·서버 시작이 동시에 기다려도 `--version` 실행 1회 | `start()` → 가용성 → 서버 풀 캐시 |
| SD-01 | ST-01 / ~~AC4~~ → AC4′(ΔV1) | 가용성 상태 기계가 D-008을 따른다 | 신규 단위 테스트: 실행 파일 없음 → `missing`·probe 0회 / 있음 → `checking` → `ready`·`unsupported`·`failed` / 포커스 재확인은 `missing`·`failed`에서만, 파일 검사만 / 같은 상태 재통지 0 | bootstrap 조립 → push |
| AR-01 | IT-01 / ~~AC5~~ → AC5′(ΔV1) | `orca:backend:list`가 `installed` 대신 `availability`를 싣고, 변화는 `orca:harness:availability`로 방송, 재확인은 `orca:harness:recheck` | 핸들러·preload 테스트: 응답 키 집합 · push payload · recheck 결과 · Claude `ready`+버전 | preload → `backendApi` → 가용성 store |
| AR-01 | IT-01 / ~~AC6~~ → AC6′(ΔV1) | `agent:list`의 OpenCode 행이 사용 불가일 때 `supported:false`+사유, `checking`·`ready`면 `true`. Claude 행 불변 | 핸들러 테스트(settings 행·runtime 행 둘 다) + 가용성 push 뒤 agent store 재조회 1회 | `agent:list` → `agentStore` → ModelMenu·선택·EngineCard |
| R-03 | AT-03 / AC7 | 사용 불가면 OpenCode 컴포저가 보이지 않는다 — 새 대화·프로젝트 랜딩은 Claude, 기존 OpenCode 세션은 안내+다시 확인, `lastBackend` 미기록 | renderer 테스트: 부팅 시드 · 상태 전환 시 빈 칸 재시드 · ChatTile 안내 · 모델 메뉴 항목 | boot steps → chatStore → Landing·ChatTile·ModelMenu |
| R-03 | AT-03 / AC8 | 엔진&모델 페이지 추가 메뉴의 OpenCode 항목이 비활성+사유, 눌러도 모달 없음. 기존 OpenCode 카드는 사유 배지 | `AgentEnvironmentView`·`EngineCard` 렌더 테스트 | 엔진 페이지 |
| AR-01 | IT-01 / AC9 | 사용 불가면 main의 OpenCode 작업이 시작되지 않는다 — 웜업·로그인 프리 CLI 확인·전역 감시·컴포저 준비. `ready` 전환 시 웜업 1회·감시 시작+revision 1회 | 각 소비자 테스트: probe·acquire·watch spy 0 / 전환 뒤 1. `HostHarnessPort` 시그니처 불변 | bootstrap → 각 서비스 |
| AR-02 | IT-02 / AC10 | renderer 진입 청크가 압축본이고 1,500,000B 이하 | `gate:bundle` — 빌드 후 `bundle-measure.mjs`: `entryMinified:true` · `entryBytes ≤ 1500000`(기준 3,891,098) | `electron-vite build` 산출 |
| AR-02 | IT-02 / AC11 | recharts 계열이 진입 청크에 0B, 사용량 탭은 같은 차트를 그린다 | `gate:bundle` `familyBytes.recharts = 0` + 신규 `UsageTab` 렌더 테스트(자리 → 차트) | 설정 > 사용량 |
| AR-02 | IT-02 / AC12 | shiki 계열이 진입 청크에 0B, 자산 수 ≤ 60(기준 277), 11개 언어·2 테마 강조 결과 동일. 새 패키지 0 | `gate:bundle` `familyBytes.shiki = 0`·`assetCount ≤ 60` + CodeBlock·diff 강조 테스트 + `package.json` diff 0 | CodeBlock · diff 카드 |
| MD-01 | UT-01 / AC13 | OpenCode 스트리밍 중 live 텍스트만 바뀌면 확정 교환 투영과 복사 텍스트 계산이 다시 돌지 않고 화면 rows는 같다 | 신규 projection golden(변경 전 코드로 생성) 동치 + Timeline 렌더 테스트의 투영 spy·`turnCopyText` spy 횟수 | OpenCode Timeline |
| MD-01 | UT-01 / AC14 | 보존·앵커·선택 행 인덱스 조회가 key 색인으로 바뀌고 동작은 같다 | 기존 `Timeline.selection.test.ts` 전 케이스 + 신규 색인 단위 테스트 | Timeline 가상화 |
| AR-03 | IT-03 / AC15 | 새 마이그레이션이 `raw_json` 열을 더하고, 새 기록의 `payload_json`에는 `raw` 키가 없으며 raw는 `raw_json`에 있다 | DB 테스트(Node ABI 또는 Windows CI) + native-sync 테스트 | refresh → `replace` |
| AR-03 | IT-03 / AC16 | 기존 행은 첫 `session:load`에서 1회 분리되고 값이 같다 — 분리 뒤 refresh가 busy가 되지 않는다 | DB 테스트: 분리 전후 raw 값 동등·두 번째 호출 변경 0 · 핸들러 순서 테스트 | `session:load` → 분리 → `loadSession` |
| AR-03 | IT-03 / AC17 | Claude 이어붙이기 빠른 경로가 `raw_json`을 필요할 때만 읽고 결과가 같다. OpenCode raw도 `raw_json`에 보관된다. 원본 삭제 뒤 표시·이어가기는 같다 | adapter·native-session 테스트: lazy raw 호출 조건·결과 동치·missing 복구 경로 | Claude/OpenCode `readHistory` · `prepareNativeSession` |
| MD-02 | UT-02 / AC18 | `ProjectResourceSync`는 할 일이 없으면 타이머가 없고, lease·activity·owner·파일 변화에 tick하며, 적용 대기가 있을 때만 500ms 재시도한다 | 신규 케이스: 10s 진행 시 `targets` 0회 · 대기 중 재시도 후 멈춤 · `activityChanged` tick 1회 | bootstrap → sync |
| MD-02 | UT-02 / AC19 | MCP 재적용 타이머는 dirty 동안만 있다. OpenCode 제출 대기는 20ms 폴링 대신 activity 변화 신호로 깨고 500ms 상한으로 재확인한다 | `mcp-reconcile.test.ts`·`mcp-control.test.ts` 신규 케이스: 타이머 수 · 신호 후 진행 · abort | reconcile · `submit` |
| MD-02 | UT-02 / AC20 | 로그 transport는 버퍼가 비면 타이머가 없고, 쓰면 주기 안에 flush된다. `close`·`flushSync` 의미 불변 | `file-transport.test.ts` 신규 케이스 | 로거 |
| MD-03 | UT-03 / AC21 | main 모듈 초기화가 Claude SDK를 불러오지 않는다. 첫 사용에 1회 로드, 부팅 완료 뒤 미리 불러오기(대기 없음) | `gate:` 빌드 산출 `require("@anthropic-ai/claude-agent-sdk")` 0 + loader 단위 테스트 + 기존 SDK mock 23파일 green | `query`·`createSdkMcpServer`·`getSessionMessages` |
| MD-04 | UT-04 / AC22 | 0290 N1 정규화 JSON 사본 2곳이 `canonicalJson`을 쓰고 revision·중복 제거 결과가 같다 | 신규 케이스: 키 순서만 다른 입력 → 같은 revision·같은 dedupe 키 | Claude 프로젝트 설정 · background mapper |
| — | — / AC23 | 바뀐 IPC·저장 열·빌드·컴포넌트가 정본 문서와 맞다 | `node scripts/check-doc-inventory.mjs --check` + 문서 자리 검색(§10 EP-23) | `docs/IPC_CONTRACT.md` · `docs/arch/**` · `docs/guides/release-operations.md` |

### AC 검증 주의사항

- 기준선: 구현 착수 HEAD(D-011)에서 0290의 [`scan/vitest-failed-ids.mjs`](../0290-simplify-0254-0289/scan/vitest-failed-ids.mjs)로 실패 ID를 다시 뜬다. 설계 HEAD 값을 승계하지 않는다.
- DB 스위트(AC15·AC16)는 Linux Electron ABI에서 red가 기준선이다. Node ABI 재빌드로 직접 돌리거나 Windows CI로 판정한다(0290 verify §9 방식).
- golden(AC13)은 **구현 전 코드로** 만든다. 바꾼 코드로 만들면 동치를 증명하지 못한다.
- N회 기준: AC3의 `--version` 실행 sink는 `OpenCodeServerPool.probeVersion` 1곳(`server.ts:161`)이다. 호출부 3곳(`:173` 설치 판정 · `:263` 서버 시작 · `:371` 모델 목록)이 모두 `readVersion` 캐시를 지난다. 테스트는 `readVersion` 주입으로 sink 호출을 센다.
- 0건/음성 기준: S02a·S07c·S09b·S10a·S11의 목표 0은 각 행의 양성 oracle과 짝을 이룬다(§10 `직접 oracle`).
- 사람 실기: Windows 설치본에서 부팅 체감·OpenCode 미설치 시 화면 1회(§19). 순수 로직은 모두 자동 테스트다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V 없음(0290 결정만 D-012로 승계).
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` pair 이관: 해당 없음.
- 변경이 시작되는 수준: R(부팅 체감·미설치 노출) · SD(가용성 수명주기) · AR(IPC·저장 열·번들 경계) · MD(투영·타이머·SDK 로드·정규화).

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01 / AT-01 | R/AT | 관측 회귀 0(D-003) · AC1 | NEW | — |
| R-02 / AT-02 | R/AT | 부팅이 설치 확인을 기다리지 않음(D-005) · AC2·AC3 | NEW | 0290 §17 A9 |
| R-03 / AT-03 | R/AT | 미설치 시 비노출·비활성(D-006·D-007) · AC7·AC8 | NEW | — |
| SD-01 / ST-01 | SD/ST | 가용성 상태 기계(D-008) · AC4 | NEW | — |
| AR-01 / IT-01 | AR/IT | 가용성 SSOT와 소비자 edge · AC5·AC6·AC9 | NEW | registry 설치 캐시 대체 |
| AR-02 / IT-02 | AR/IT | renderer 번들 경계(D-004·D-013) · AC10~AC12 | NEW | — |
| AR-03 / IT-03 | AR/IT | 보관 raw 분리(D-009) · AC15~AC17 | NEW | 0290 §17 A5(c) |
| MD-01 / UT-01 | MD/UT | OpenCode Timeline 투영 · AC13·AC14 | NEW | — |
| MD-02 / UT-02 | MD/UT | 상시 타이머 제거 · AC18~AC20 | NEW | 0290 §17 A1·A3·A15 |
| MD-03 / UT-03 | MD/UT | Claude SDK 지연 로드 · AC21 | NEW | — |
| MD-04 / UT-04 | MD/UT | 정규화 JSON SSOT · AC22 | NEW | 0290 verify N1 |

- ΔV1: R-02·R-03·SD-01·AR-01과 VP-02~VP-05는 CHANGED — 정본은 ΔV1 절. 나머지 노드·pair는 V1 그대로 유효(REQUIRED).
- ΔV2: R-03·SD-01·AR-01(VP-03·VP-04·VP-05) CHANGED, VP-02·VP-08·VP-10은 oracle 정정 — 정본은 ΔV2 절. VP-01·06·07·09·11은 r1 verify PASS 좌표 그대로(REQUIRED).

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 전 진입점 → 기존 호출부 | `gate:vitest 실패 ID 차집합`·`gate:typecheck`·`gate:eslint`·`gate:CI` | not selected — 집계 | 0 — 집계 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED (ΔV1 CHANGED — 경로·oracle은 ΔV1 절) | `index.ts` `router.start()` → 가용성 kick-off(대기 없음) → 서버 풀 `readVersion` ∥ 나머지 boot steps → `finish` | §10 EP-02 | required — `adapter-registry` 단계 복원 변이 · kick-off 제거 변이 | EP-02 (4) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED (ΔV1 CHANGED — 경로·oracle은 ΔV1 절) | 가용성 store/`agent:list` → boot 시드·chatStore·agentStore → Landing·ProjectLanding·ChatTile·ModelMenu·선택·EngineCard·AgentEnvironmentView | §10 EP-03 | required — 하네스 맞바꿈(opencode↔claude 판정) · 시드 폴백 제거 | EP-03 (10) |
| VP-04 | SD-01 ↔ ST-01 | REQUIRED (ΔV1 CHANGED — 경로·oracle은 ΔV1 절) | locate → `checking` → probe → 상태 → push · 재확인 트리거 3 | §10 EP-04 | required — 포커스 재확인 조건 뒤집기 · 같은 상태 재방송 | EP-04 (6) |
| VP-05 | AR-01 ↔ IT-01 | REQUIRED (ΔV1 CHANGED — 경로·oracle은 ΔV1 절) | 가용성 SSOT → `backend:list`·`agent:list`·`HostHarnessPort`·웜업·전역 감시·컴포저 준비 | §10 EP-05 | required — 소비자별 게이트 제거 변이 | EP-05 (15) |
| VP-06 | AR-03 ↔ IT-03 | REQUIRED | adapter `raw` → `refreshNativeHistory` → `replace(payload, raw)` · `session:load` → 분리 → `loadSession` · `readNativeHistoryPrevious` → lazy raw | §10 EP-06 | required — payload에 raw 재합류 변이 · 분리 순서 뒤집기 | EP-06 (16) |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | `electron.vite.config.ts` → renderer 빌드 → 진입 청크 | `gate:bundle` + §10 EP-07 | required — 정적 import 복원 2종 · minify 제거 | EP-07 (4) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | `useLiveText` → Timeline → head/tail 투영 → 가상화 | §10 EP-08 | required — head memo 제거 · 복사 텍스트 즉시 계산 복원 | EP-08 (8) |
| VP-09 | MD-02 ↔ UT-02 | REQUIRED | 타이머 4자리 + bootstrap 신호 배선 2자리 | §10 EP-09 | required — 자리별 상시 타이머 복원 · 신호 배선 제거 | EP-09 (6) |
| VP-10 | MD-03 ↔ UT-03 | REQUIRED | SDK 값 import 3자리 → loader → 첫 사용·prefetch | §10 EP-10 | required — 정적 import 복원 → 빌드 gate red | EP-10 (5) |
| VP-11 | MD-04 ↔ UT-04 | REQUIRED | Claude 프로젝트 설정 revision · background dedupe 키 | §10 EP-11 | required — `canonicalJson` → `JSON.stringify` 되돌리기 | EP-11 (2) |

### 현재 변경의 운영 gate

| Gate | 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| typecheck | app 소스 변경 | `cd app && npm run typecheck` | 오류 1건 이상 |
| lint | boundaries·하네스 경계 | `cd app && ./node_modules/.bin/eslint ./src ./scripts`(무수정) | error 1건 이상 · warning이 기준선 밖 |
| vitest | 동작 보존 | `cd app && ./node_modules/.bin/vitest run --reporter=json --outputFile=<r>` → `node ../docs/handoff/0290-simplify-0254-0289/scan/vitest-failed-ids.mjs <r>` − 착수 기준선 | 차집합 1건 이상 |
| scripts | 위생 스크립트 | `cd app && node --test scripts/*.test.mjs` | 신규 실패 |
| migration | 새 SQL 파일 | `cd app && node scripts/check-migrations-appendonly.mjs` | 기존 파일 변경 |
| doc-inventory | IPC·문서 링크 | `cd app && node scripts/check-doc-inventory.mjs` 후 `--check` | 불일치 |
| bundle | AC10~AC12·AC21 | `cd app && ./node_modules/.bin/electron-vite build --sourcemap --outDir <t>` → `node ../docs/handoff/0292-deep-optimization/scan/bundle-measure.mjs <t>` · `grep -c 'require("@anthropic-ai/claude-agent-sdk")' <t>/main/index.js` | AC 임계 밖 |
| CI | Windows 전용 경로·DB 스위트 | PR의 `ci.yml` windows-latest | red |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

## ΔV1 — 버전 확인 실측 반영 정정 (2026-11-02)

**수정 필요.** V1은 `opencode --version` 실행 시간을 재지 않은 채 시간 초과 상한 15초(`server.ts:165`)를 비용처럼 제시했고, 그것을 근거로 부팅이 확인을 기다리지 않게 바꿔 `checking` 구간·늦은 노출 변경·`installed` 삭제를 넣었다. 사용자 실측은 프로세스 생성·종료 포함 3초 이내다. ΔV1은 확인을 부팅 안에 두되 나머지 단계와 동시에 돌린다.

| 발견 | 근거 | 정정 |
|---|---|---|
| 15초는 측정값이 아니라 시간 초과 상한이다 | `server.ts:165` `timeout: 15000` · 이 컨테이너에 OpenCode CLI 없음(실측 불가) · 사용자 보고 3초 이내(생성·종료 포함) | §8·§14 문구 정정 |
| 부팅이 확인을 기다리지 않으면 화면에 `checking` 구간과 늦은 사라짐이 생긴다 | V1 §5 상태표 `checking` 3행 · V1 §17 첫 행 | D-014 — 부팅 안에서 동시 실행 후 합류. 화면은 확정 결과만 본다 |
| `installed` 삭제는 근거(부팅 대기 제거)가 사라지면 이유가 없다 | V1 D-005 · AC5 | 기존 키 유지 + `usable`·`unavailableReason` 가산 |
| 별도 상태 기계는 registry 설치 캐시의 사본이 된다 | V1 §9 `availability.ts` · `registry.ts:13-34` | registry 설치 캐시를 가용성 SSOT로 확장(D-015) |

### ΔV1 계약과 V 증분

| Node / Pair | provenance / requiredness | 대체·상속 범위 | 직접 oracle / 선택 적대 증거 |
|---|---|---|---|
| R-02 / VP-02 | CHANGED / REQUIRED | AC2·AC3 → AC2′·AC3′ · EP-02 → EP-02′ | EP-02′ — 등록 변이: 순차 await 복원 · 합류 제거 |
| SD-01 / VP-04 | CHANGED / REQUIRED | AC4 → AC4′ · EP-04 → EP-04′(`checking` 규칙 삭제) | EP-04′ — 등록 변이: 포커스 identity 비교 제거 · 변화 비교 제거 |
| AR-01 / VP-05 | CHANGED / REQUIRED | AC5·AC6 → AC5′·AC6′ · EP-05 #1-8·#15 → EP-05′. V1 EP-05 #9~#14는 그대로이고 그 문장의 "가용성"·"`ready`"는 registry `usable`로 읽는다 | V1 등록 변이(소비자별 게이트 제거) 유지 |
| R-03 / VP-03 | CHANGED / REQUIRED | EP-03 #1 oracle에서 `checking` 입력 삭제(§10 행에 ΔV1 표시). 나머지 EP-03 행은 V1 그대로 | V1 등록 변이 유지 |
| 그 밖의 V1 노드·pair(R-01·AR-02·AR-03·MD-01~MD-04 / VP-01·VP-06~VP-11) | INHERITED / V1 requiredness 그대로(REQUIRED) | 구현 전이라 V1 행 전부 유효 | V1 §10 |

- ΔV1 production path — VP-02: `index.ts` `router.start()` → 0225 등급 확인 직후 `adapter-registry` 시작 ∥ 나머지 boot steps → `finish()` 직전 합류 → `bootWhenReady` resolve → renderer `main-ready`.
- ΔV1 production path — VP-04: 경로 설정 변경·`orca:harness:recheck`·`browser-window-focus` → `AdapterRegistry`(identity 비교 → `refreshInstallState(id)`) → 바뀌면 listener → bootstrap 방송 `orca:harness:availability` → preload → 가용성 store.
- ΔV1 production path — VP-05: `AdapterRegistry.availability`·`settled` → `backend:list`·`agent:list`·`HostHarnessPort.installed`·웜업·전역 감시·컴포저 준비. VP-03은 V1 경로 그대로이고 store 값만 `usable` 필드다.
- `SUPERSEDED` 행의 증거 이관: V1 VP-02 변이(단계 복원·kick-off 제거)는 EP-02′ 두 변이로, V1 VP-04 변이(조건 뒤집기·비교 제거)는 EP-04′ 두 변이로 옮긴다. 폐기 0.
- ΔV1 이후 유효 pair는 VP-01~VP-11이고 전부 REQUIRED다. AC는 23개다(AC2~AC6이 AC2′~AC6′로 대체).

### 대체 AC

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-02 | AT-02 / AC2′ | 부팅이 설치·버전 확인을 순서대로 기다리지 않는다 — `start()` 초입에 시작해 나머지 단계와 겹치고 `finish()` 직전에 합류한다 | 신규 `bootstrap.availability.test.ts`(기존 `bootstrap.opencode-warmup.test.ts`의 registry mock 방식): 주입 `refreshInstallState`가 deferred인 동안 `db-init` 이후 단계가 실행된다(단계 로그) · resolve 전 `start()` 미완 · resolve 직후 완료 · boot report `adapter-registry` 1건 | 창 → `bootWhenReady` → renderer `main-ready` |
| R-02 | AT-02 / AC3′ | `main-ready` 때 버전 캐시가 채워져 있어, 부팅 뒤 첫 OpenCode 작업과 부팅 중 겹친 수요가 `--version`을 다시 실행하지 않는다 | 같은 테스트 + 서버 풀 fake: 부팅·웜업·`HostHarnessPort.installed`·`acquire`까지 주입 `readVersion` 1회 | `start()` → registry → 서버 풀 캐시 |
| SD-01 | ST-01 / AC4′ | 가용성은 부팅 확인 결과로 정해지고 D-015 재확인 3트리거로만 바뀐다. 재확인 중에는 직전 상태를 유지하고 바뀔 때만 방송한다. 화면에 `checking`이 없다 | 신규 `registry.availability.test.ts`(EP-04′ 표) | bootstrap → registry → push |
| AR-01 | IT-01 / AC5′ | `orca:backend:list`가 기존 `installed`·`version`을 유지하고 `usable`·`unavailableReason`을 싣는다. 재확인 결과가 바뀌면 `orca:harness:availability` 방송, `orca:harness:recheck`로 재확인 | `misc-split.test.ts` 신규: 기존 키 ⊆ 새 키 · Claude `usable:true`+버전 · OpenCode 사유별 값 / preload 테스트: push 전달·recheck 호출 | preload → `backendApi` → 가용성 store |
| AR-01 | IT-01 / AC6′ | `agent:list`의 OpenCode 행은 `usable:false`면 `supported:false`+사유, `usable:true`면 지금과 같다. Claude 행 불변 | `misc.runtime-catalog.test.ts` 신규(settings 행·runtime 행) + `agentStore.test.ts` 신규(방송 뒤 재조회 1회) | `agent:list` → `agentStore` → ModelMenu·선택·EngineCard |

- AC 게이트 재확인: 다섯 행 모두 행동 단언(단계 로그·호출 수·키 집합)과 프로덕션 도달 경로를 갖는다. AC3′의 sink는 `OpenCodeServerPool.probeVersion` 1곳이고 호출부 3곳(`server.ts:173`·`:263`·`:371`)이 모두 `readVersion` 캐시를 지난다.

### ΔV1 §10

자리 검색은 [`scan/sites.sh`](scan/sites.sh)이고 N은 ΔV1 설계 HEAD `feaca09` 실측이다(V1 검색 18개의 N 전부 V1과 같고, S05d를 새로 더했다).

| pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 → N / 목표 | 직접 oracle | 실패 의미 |
|---|---|---|---|---|---|---|
| VP-02 | 확인을 부팅 안에서 동시에 돌리고 `finish()` 직전에 합류 | `AdapterRegistry.refreshInstallState` | EP-02′ (4) | S02a 3 / 3 · S02b 1 / 1(위치 이동) | EP-02′ 표 | 순차 대기 회귀 · 합류 누락으로 미확정 결과 노출 |
| VP-04 | D-015 재확인 | `AdapterRegistry` | EP-04′ (5) | 신규 — `rg -n "focusRecheck\(\|onAvailabilityChange\(\|settled\(" app/src/main/adapters/common/registry.ts` ≥ 3 | EP-04′ 표 | 설치 후 미반영 · 불필요 spawn · 중복 방송 |
| VP-05 | 소비자가 registry 판정 1벌을 읽는다 | `AdapterRegistry.availability` | EP-05′ (9) + V1 EP-05 #9~#14 (6) = 15 | S05a 9 / 6(registry 안 4 + `registry.list().map` 2) · S05d 3 / 0(app의 `isInstalled()` 직접 호출·언급) | EP-05′ 표 | 판정 사본 재발생 |

### EP-02′ — 부팅 안 동시 확인 (4)

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1 | `bootstrap.ts:764-768` `adapter-registry` 순차 단계 | `start()`의 0225 이관 등급 확인(`:453`) 직후·첫 await 전에 `bootReport.step('adapter-registry', …, () => this.registry.refreshInstallState())`를 시작만 하고 promise를 보관한다. 시작 즉시 거절 처리기를 붙인다(미처리 거절 경고 방지) | AC2′ 테스트: deferred 동안 뒤 단계 실행 로그 |
| 2 | `bootstrap.ts:850` `this.bootReport.finish()` 직전 | 보관한 promise를 `await`(합류). critical 실패는 여기서 다시 던진다 | AC2′ 테스트: resolve 전 `start()` 미완 · resolve 뒤 완료 · report `adapter-registry` 1건 |
| 3 | `registry.ts:22-29` `refreshInstallState` | 유지 + 하네스 인자(선택) · 진행 중이면 같은 promise 합류 · `usable`·`unavailableReason`·identity 기록 | `registry.availability.test.ts`: 동시 2회 → adapter `isInstalled` 1회 · 필드 값 |
| 4 | `misc.ts:98` 설치 뒤 갱신 | 유지 — 결과가 바뀌면 EP-04′ #1 경로로 방송 | `misc-split.test.ts` 신규: 설치 스트림 뒤 refresh 1 · 바뀌면 방송 1 |

- 등록 변이: #1 순차 `await` 복원(뒤 단계가 deferred resolve 뒤에 실행 → red) · #2 합류 제거(`start()`가 resolve 전에 완료 → red).

### EP-04′ — registry 재확인 (5)

| # | 규칙 | 직접 oracle — 신규 `adapters/common/registry.availability.test.ts` |
|---|---|---|
| 1 | 결과가 바뀔 때만 listener 호출 | 같은 결과 재확인 → listener 0 · `usable` 또는 사유 변화 → 1 |
| 2 | 재확인 중에는 직전 상태 유지 | refresh 진행 중 `availability(id)` = 직전 값 |
| 3 | `focusRecheck()` — `missing`·`failed`인 하네스만 adapter `executableIdentity?.()`(동기, 프로세스 없음)를 마지막 확인 값과 비교해 다를 때 refresh 1회 | `usable`에서 focus → identity 조회 0 · 같은 identity → refresh 0 · 다른 identity → refresh 1 |
| 4 | bootstrap `app.on('browser-window-focus')` → `focusRecheck()`, `shutdown`에서 해제 | `bootstrap.availability.test.ts`: focus 1 → `focusRecheck` 1 · shutdown 뒤 0 |
| 5 | `settings-reactions.ts`의 `harnesses.opencode.executablePath` 변경과 `orca:harness:recheck` 핸들러 → `refreshInstallState('opencode')` | settings-reactions 신규 케이스(경로 변경 1 · 다른 키 0) · 핸들러 테스트 |

- adapter 포트(`adapters/common/types.ts`): `isInstalled()` 결과에 선택 필드 `usable`·`reason`, 선택 메서드 `executableIdentity?(): string | undefined`. OpenCode는 `servers.installed()`가 `isSupportedOpenCodeCliVersion`(`server.ts:27`)으로 `usable`을, 실패 지점으로 `reason`(실행 파일 없음 `missing` · 확인 실패 `failed` · 1.x 아님 `unsupported`)을 낸다. identity는 `openCodeExecutableIdentity`(`server-profile.ts:7`) 재사용. Claude는 필드 없이 `usable:true`로 읽는다.
- 등록 변이: #3 identity 비교 제거(같은 identity에도 refresh → red) · #1 비교 제거(중복 방송 → red).

### EP-05′ — registry 가용성 소비자 (9, V1 EP-05 #1-8·#15 대체)

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1-4 | `registry.ts:13`·`:25`·`:28`·`:33` 설치 캐시 | 유지 + `usable`·`unavailableReason`·identity · `availability(id)`·`settled(id)` 공개 | EP-04′ 테스트 |
| 5 | `harness-host.ts:4` 주석 | 판정원을 registry로 정정 | `gate:` S05d 0 |
| 6 | `harness-host.ts:14` `adapter.isInstalled()` | `await registry.settled(id)` → `{installed, version}`(형상 불변, D-012) | `harness-host.test.ts` 신규: adapter `isInstalled` spy 0 · registry 값 · 부팅 중 호출은 진행 중 확인에 합류 |
| 7 | `bootstrap.ts:887` 웜업 `installed` | `registry.settled('opencode')`의 `usable`. 건너뛰면 `attempted`를 세우지 않고 `usable` 전환 때 `update()` | `warmup.test.ts` 신규: `usable:false` → prepare 0 · 전환 → 1 |
| 8 | `misc.ts:36` `backend:list` | 기존 키 + `usable`·`unavailableReason` | AC5′ 테스트 |
| 15 | `bootstrap.ts:1247` 전역 감시 | 부팅에서 `usable`이면 지금과 같은 시점에 생성(추가 방송 없음), `usable:false`면 생성 안 함. 부팅 뒤 `usable` 전환 때 생성 + revision 1회, 사용 불가 전환 때 close | `bootstrap.native-history.test.ts` 신규: 부팅 `usable` → 생성 1·방송 0 · `missing` → 생성 0 · 전환 → 생성 1·방송 1 |

## ΔV2 — r1 verify RETURN_TO_PLAN 정정 (2026-11-02)

**수정 필요.** r1 verify([`verify.md`](verify.md))는 동작 결함 0·gate 전부 PASS였지만 PLAN_GAP 2(D10·D11)와 고장 못 잡음 21을 냈다. ΔV2는 D11을 사용자 결정(D-016·D-017)으로 닫고, VP-04·VP-03 목록을 path 전체 검색으로 다시 고정하고, 못 잡음이 남은 자리의 직접 oracle을 구별 입력·production 진입으로 정정한다. Part I은 D-016·D-017 두 상태 전이만 더한다.

| 발견 | 근거 | 정정 |
|---|---|---|
| D10 — VP-04 목록이 방송 → preload → renderer store를 담지 않고 검색이 `registry.ts` 한정·해법 이름 술어 | verify §13 D10 · X33·X68·X05 전체 스위트 green | EP-04″(16자리) — `scan/sites-dv2.sh` S04′ |
| D11 — D-007이 폴백 중 명시 선택의 `lastBackend` 저장을 정하지 않음 | verify §13 D11 · 메뉴 `onPick`(`Composer.tsx:434-441`)에 명시 표식 없음 | D-016·D-017 · AC7′ · EP-03″ #5·#6 |
| VP-03 입력·소비 자리(재시드 구독·대기 요청·사유) 미잠금 | X02·X15·X63·X13·X62 | EP-03″(17자리) — S03′ |
| 못 잡음 자리의 oracle — 단위 좌표가 production 배선을 실행 구간 밖에 두거나 사유가 기본값 `missing`뿐 | verify §5 좌표 실행 구간·운반 값 | 각 EP 표 oracle 열 + 등록 변이 |
| `adapters/common/registry.ts:40` 하네스 이름 분기 | verify N2 · §16 | D-018 · EP-05″ #16·#17 |
| plan 서술·수치 | verify N1(§17) · N4(S02a 목표 3) | §17 정정(본문) · S02a 목표는 S04′가 대체 |

### ΔV2 계약과 V 증분

| Node / Pair | provenance / requiredness | 대체·상속 범위 | 등록 변이(자리) |
|---|---|---|---|
| R-03 / VP-03 | CHANGED / REQUIRED | AC7 → AC7′ · EP-03(10) → EP-03″(17) | 이관 R03a(#2)·R03b(#7)·R03c(#16) · X02(#4)·X15(#7)·X63(#9)·X13(#15)·X62(#16) · 신규 U1(#6)·U2(#5) |
| SD-01 / VP-04 | CHANGED / REQUIRED | AC4′ → AC4″ · EP-04′(5) → EP-04″(16) | 이관 R04b(#5)·R04a(#6) · X54·X55·X59(#2)·X04(#6)·X41(#8)·X33(#10)·X68(#14)·X05(#15)·X12·X56(#16) |
| AR-01 / VP-05 | CHANGED / REQUIRED | AC5′ → AC5″ · EP-05′ + V1 #9~#14 유지, #9·#14·#15 oracle 정정, #16·#17 신규 | V1 소비자별 게이트 제거 유지 · X64(#9)·X35(#14)·X36(#15) · 신규 U3(#16)·U4(#17) |
| R-02 / VP-02 | CHANGED(oracle) / REQUIRED | EP-02′ #1 oracle 정정 | 기존 2종 + X03(#1) |
| MD-01 / VP-08 | CHANGED(oracle) / REQUIRED | EP-08 #2 oracle·판정 SSOT 정정 | 기존 2종 + X01(#2) |
| MD-03 / VP-10 | CHANGED(oracle) / REQUIRED | EP-10 #1 oracle 정정 | 기존 + X27(#1) |
| VP-01·06·07·09·11 | INHERITED / REQUIRED 그대로 | r1 verify PASS — 좌표는 `verify.md §5` | V1·ΔV1 그대로 |

- `SUPERSEDED` 이관: AC4′·AC5′·AC7 → AC4″·AC5″·AC7′. EP-04′ #1·#3 등록 변이 → EP-04″ #5·#6, EP-03 #1·#4·#9 등록 변이 → EP-03″ #2·#7·#16. 폐기 0.
- 유효 pair는 VP-01~VP-11 전부 REQUIRED, AC 23개다.
- 등록 변이 정의: X·R·N은 [`verify-evidence/r1/mutations.json`](verify-evidence/r1/mutations.json)(`mutate.mjs`로 재실행), U1~U4는 아래 표. r1의 못 잡음 21·동치 4는 다음 verify가 전부 다시 실행한다.

| ID | 자리 | 종류 | 바꾼 내용 |
|---|---|---|---|
| U1 | `Composer.tsx` 모델 메뉴 `onPick` | 제거 | `{ userPick: true }` 옵션 삭제 |
| U2 | `chatStore.ts` `automaticFallback` | 제거 | `!options?.userPick` 항 삭제 |
| U3 | `registry.ts` usable 판정 | 다른 값 | `backend === 'claude' \|\|` 분기 복원 |
| U4 | `claude/adapter.ts` `isInstalled()` | 제거 | 반환의 `usable: true` 삭제 |

### 대체 AC (ΔV2)

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| SD-01 | ST-01 / AC4″ | AC4′ + 바뀐 상태가 main 방송 → preload → renderer 가용성 store에 반영된다. 초기 `backend:list`가 도는 동안 도착한 push는 목록 값보다 이긴다 | EP-04″ #1~#16 좌표 — 특히 #2·#6·#8·#10·#14·#15·#16 신규 | 재확인 3트리거 → registry → bootstrap 리스너 → `send.ts` → preload → `harnessApi` → store |
| AR-01 | IT-01 / AC5″ | AC5′ + main이 바뀐 상태를 모든 살아 있는 renderer에 `orca:harness:availability` 채널로 보낸다 | AC5′ 좌표 + EP-04″ #10 | `broadcastHarnessAvailability` → `webContents.send` |
| R-03 | AT-03 / AC7′ | 사용 불가면 OpenCode 컴포저 비노출 — 새 대화·프로젝트 랜딩은 Claude, 기존 OpenCode 세션은 안내+다시 확인(진행 중 턴·대기 요청 동안은 Composer 유지). 자동 전환·자동 기본 모델 선택은 `lastBackend`를 쓰지 않고, 모델 메뉴에서 사용자가 고른 모델은 쓴다(D-016). 같은 실행 중 다시 사용 가능해져도 새 대화는 Claude이고 메뉴에서 OpenCode를 고르면 그때부터 OpenCode다(D-017) | EP-03″ #1~#17 좌표 — 특히 #4·#5·#6·#7·#9 신규 | boot steps·store push → `ChatProvider` → chatStore → Landing·ProjectLanding·ChatTile·ModelMenu |

- AC 게이트 재확인: 세 행 모두 행동 단언(호출 수·채널·store 값·설정 쓰기 수)과 production 진입을 가진다. AC7′의 `N회` sink는 `settingsApi.set({lastBackend})` 1곳(`chatStore.ts:1897`)이고 호출자는 `setModel` 하나다.

### ΔV2 §10

자리 검색은 [`scan/sites-dv2.sh`](scan/sites-dv2.sh)(S04′·S03′·S05e)이고 N은 r1 HEAD `c9d212b` 실측이다(`104034e`와 코드 동일). 표본 확인으로 `bootstrap.ts:553·557`(일일 게이트 wake 구독)은 S04′에서 뺐다.

| pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 → N / 목표 | 직접 oracle | 실패 의미 |
|---|---|---|---|---|---|---|
| VP-04 | D-015 재확인 → 변화 때만 방송 → renderer store 반영 | `AdapterRegistry` → `harnessAvailabilityStore` | EP-04″ (16) | S04′ 45 = EP-04″ 38줄 + VP-02 귀속 2(`bootstrap.ts:474`·`misc.ts:109`) + VP-05 귀속 5(`isInstalled()` 생산·포트 5줄) / 45 이상 — 늘면 차집합을 `[구현자 기입]`에 | EP-04″ 표 | 설치 후 미반영 · 불필요 spawn · 중복 방송 · 늦은 목록이 새 상태를 덮음 |
| VP-03 | D-006·D-007·D-016·D-017 노출·폴백·기록 | 가용성 store + `supported` + chatStore 폴백 표식 | EP-03″ (17) | S03′ 32 / 32 이상(#5·#6 옵션 자리는 같은 줄) | EP-03″ 표 | 실패할 OpenCode 화면 노출 · 사용자 선택 유실·오기록 |
| VP-05 | 판정 1벌 · 공통 계층 하네스 이름 분기 없음(D-018) | registry + adapter `isInstalled().usable` | ΔV1 15 + #16·#17 = 17 | S05a 6 / 6 · S05e 1 / 0 | EP-05″ 표 | 판정 사본 · 공통 계층의 하네스 선택 |

- ΔV2 이후 강제 지점 분모: VP-02 4 · VP-03 17 · VP-04 16 · VP-05 17 · VP-06 16 · VP-07 4 · VP-08 8 · VP-09 6 · VP-10 5 · VP-11 2 = **95**(r1 75에서 VP-03 +7 · VP-04 +11 · VP-05 +2). 다른 V1·ΔV1 검색은 `evidence/r1-final-sites.txt` 그대로다.

### EP-04″ — 재확인 · 방송 · renderer 반영 (16, EP-04′ 대체)

oracle 열의 "신규"는 구현자가 만들 테스트다. 진입점은 production 함수·조립이고, 운반 값은 기본값(`missing`)·형제와 구별한다(`docs/handoff/AGENTS.md §공통 V`).

| # | 자리 (S04′ 줄) | 규칙 | 직접 oracle 좌표 |
|---|---|---|---|
| 1 | `settings-reactions.ts:26,27,34,42` | 경로 값이 바뀐 `harnesses` patch만 재확인 | PATH(기존) |
| 2 | `bootstrap.ts:720,721,722` | 초기 경로를 설정에서 받고, 경로 변경 반응이 `refreshInstallState('opencode')`를 부른다 | 신규 — 실제 `Bootstrap.start()` 뒤 실제 설정 store patch: 시작 전 경로 `/initial` → 같은 값 patch 0 · `/next` patch → refresh 1(인자 `'opencode'`) · 다른 키 patch 0 (X54·X55·X59 red) |
| 3 | `misc.ts:42,43` | 수동 재확인이 요청 하네스를 refresh하고 결과를 돌려준다 | INSTALL(기존) · X31 |
| 4 | `bootstrap.ts:247,918,969` | focus 리스너 등록·호출·해제 | BOOT(기존) · N01 |
| 5 | `registry.ts:21,37` | identity가 같으면 진행 중 refresh에 합류 · 결과가 바뀔 때만 listener | JOIN(기존) · R04b·X21 |
| 6 | `registry.ts:79,91` | focus는 `missing`·`failed`만, identity가 다를 때만 refresh | FOCUS(기존) + 신규 케이스 — `failed` 결과 뒤 identity 변경 → refresh 1 · 같은 identity → 0 (X04 red) · R04a |
| 7 | `registry.ts:95` | listener 등록·해제 | RESUME(기존) |
| 8 | `server.ts:170` · `opencode/v1/adapter.ts:72` | OpenCode identity = 실행 파일 경로 + stat, 없으면 `undefined` | 신규 — 실제 `OpenCodeServerPool`·`OpenCodeAdapter`: 임시 파일 A → a · 같은 경로 내용 교체(크기 다름) → a′≠a · 경로 설정 B → b≠a · 없는 경로 → `undefined` (X41 red) |
| 9 | `bootstrap.ts:910,912` | 리스너가 바뀐 상태를 방송 | RESUME(기존) · N02 |
| 10 | `send.ts:26,27` | 채널 `orca:harness:availability`, 살아 있는 webContents 전부 | 신규 — `electron` mock(`getAllWebContents` = 살아 있는 fake 2 + 파괴된 fake 1)에 `unsupported` 상태 방송 → 살아 있는 fake마다 `send('orca:harness:availability', 같은 객체)` 1 · 파괴된 fake 0 (X33 red) |
| 11 | `preload/index.ts:191,192` | recheck invoke 채널 | `preload/harness.test.ts`(기존) · X43 |
| 12 | `preload/index.ts:193,196,198` | push 구독·해제 채널 | `preload/harness.test.ts`(기존) · X42 |
| 13 | `shared/api/ipc.ts:157,159` | renderer `harnessApi`가 preload를 그대로 부른다 | 신규 — #14·#16 테스트가 `window.orca.harness` stub 위에서 실제 `harnessApi`를 실행 |
| 14 | `harnessAvailabilityStore.ts:15,19,20` | push 1건 → store `byId[id]` 교체 | 신규 — stub가 받은 handler로 OpenCode `{usable:false, unavailableReason:'unsupported'}` push → store 값 같음, 이어 `{usable:true, version}` push → usable (X68 red) |
| 15 | `harnessAvailabilityStore.ts:23,28` · `backendStore.ts:31,33` | 초기 seed. 목록 호출 중 도착한 push가 seed보다 이긴다 | SEED(기존 4사유) + 신규 경합 — `backendApi.list` deferred 동안 push(usable) → list가 `missing`으로 resolve → store usable 유지 (X05 red) |
| 16 | `HarnessUnavailableNotice.tsx:29` | "다시 확인" 클릭 → 그 세션 하네스로 recheck 1회, 응답 전 버튼 비활성 | 신규 — fake DOM에 Notice(backend `opencode`) 렌더 · 클릭 → `window.orca.harness.recheck('opencode')` 1 · 응답 전 disabled · 응답 뒤 활성 (X12·X56 red) |

- 검산: 4+3+2+3+2+2+1+2+2+2+2+3+2+3+4+1 = 38줄 = S04′ 45 − VP-02 2 − VP-05 5.

### EP-03″ — renderer 노출 · 폴백 · 기록 (17, EP-03 대체)

| # | 자리 (S03′ 줄) | 규칙 | 직접 oracle 좌표 |
|---|---|---|---|
| 1 | `app/boot/steps.ts:68` | `backend` 단계 뒤 시드 | SEED(기존) · N07 |
| 2 | `chatStore.ts:221,224,225,227` | 사용 불가 `lastBackend` OpenCode → Claude 시드 + 폴백 표식 | SEED · DRAFT 둘째 케이스(기존) · R03a |
| 3 | `chatStore.ts:184,187,188,191` | 사용 불가 전환 때 세션 없는 OpenCode 칸 재시드 + 표식 | DRAFT(기존) · X16·X61 |
| 4 | `ChatProvider.tsx:11,12` | 마운트 1회 + store 변화마다 재시드 | 신규 — 실제 `ChatProvider` 마운트 뒤 store에 OpenCode `missing` 반영 → 빈 OpenCode 칸 backend `claude` (X02 red) |
| 5 | `chatStore.ts:1894,1895,1897` | 폴백 중 자동 선택은 저장 안 함, `userPick` 선택은 저장(D-016). 복귀 뒤에도 표식 유지(D-017) | 신규 — 폴백 중: 자동 기본 모델 선택 → `settingsApi.set` 0 · 메뉴 선택 → `{lastBackend:'claude'}` 1. store usable 복귀 뒤: 새 칸 backend `claude` · 자동 선택 0 · 메뉴 OpenCode 선택 → `{lastBackend:'opencode'}` 1 (X17·U2 red) |
| 6 | `Composer.tsx:434` | 모델 메뉴 `onPick`이 `setModel(…, { userPick: true })` | 신규 — 실제 Composer 렌더에서 ModelMenu 선택 → 폴백 중 `settingsApi.set({lastBackend:'claude'})` 1 (U1 red) |
| 7 | `ChatTile.tsx:65` | 사용 불가 + 유휴 + 대기 요청 없음 → 안내 | NOTICE(기존) + 신규 — inflight 거짓 + `pendingAsks`·`pendingToolApprovals`·`pendingPlanReview` 각각 1 → Composer 유지 (X15 red) · R03b·X14 |
| 8 | `ChatTile.tsx:165` | 그 밖에는 Composer | NOTICE(기존) |
| 9 | `HarnessUnavailableNotice.tsx:21` | 사유별 문구 | 신규 — `unsupported`·`failed` 각각 ko 문구 (X63 red) |
| 10 | `Landing.tsx:27` | 재시드된 빈 칸의 Composer | DRAFT(기존) |
| 11 | `ProjectLandingPage.tsx:112` | 프로젝트 빈 칸 동일 | DRAFT 프로젝트 케이스(기존) |
| 12 | `ModelMenu.tsx:31` | `supported`만 노출 | MENU(기존) |
| 13 | `modelSelection.ts:27` | 미지원 행 건너뜀 | SELECT(기존) |
| 14 | `Composer.tsx:335` | 메뉴 노출 조건 | COMPOSER(기존) |
| 15 | `EngineCard.tsx:34,37,38` | 사유별 배지 | CARD(기존) + 신규 `unsupported`·`failed` 문구 (X13 red) |
| 16 | `AgentEnvironmentView.tsx:31,96,105` | 추가 항목 비활성 + 사유 툴팁 | ADD(기존) + 신규 `unsupported`·`failed` 툴팁 (X62 red) · R03c |
| 17 | `agentStore.ts:22,43,94` | 가용성 push마다 `agent:list` 재조회 | AGENT(기존) · N04 |

- 검산: 1+4+4+2+3+1+1+1+1+1+1+1+1+1+3+3+3 = 32줄 = S03′.

### EP-05″ — VP-05 정정·추가 (ΔV1 EP-05′ + V1 #9~#14 유지)

| # | 자리 | 규칙 | 직접 oracle 좌표 |
|---|---|---|---|
| 9′ | `misc.ts:59-61` | 사용 불가 행의 `unavailable` = registry 사유 | ROWS + 신규 `unsupported`·`failed` 사유 (X64 red) |
| 14′ | `bootstrap.ts:910-917` 리스너 | OpenCode 상태 변화마다 컴포저 준비 무효화 1 · 웜업 갱신 · 감시 갱신(`initial=false`) | 신규 — 감시 갱신을 mock하지 않은 실제 리스너: missing → usable → `composerPreparation.invalidate` 1 · 전역 감시 생성 + `orca:extensions:opencode-plugins-changed` 1(revision 1) · 같은 상태 재확인 → 무효화·방송 0 · usable → missing → 무효화 1·감시 close (X35·X36 red) |
| 15′ | `bootstrap.ts:1076-1104` | (#14′와 같은 테스트가 늦은 활성화 방송을 실제 리스너 경로로 단언) | WATCH(기존) + #14′ |
| 16 | `registry.ts:40` | `usable = info.usable ?? info.installed` — 하네스 이름 분기 없음(D-018) | 신규 — registry 단위: id `claude`·`{installed:false}`(usable 없음) → 사용 불가 `missing` · id `opencode`·`{installed:true}` → usable · `{installed:false, usable:true}` → usable (U3 red). gate: S05e 0 |
| 17 | `claude/adapter.ts:374-381` | Claude `isInstalled()`는 두 경로 모두 `usable: true`(SDK 동봉) | 신규 — 실제 `ClaudeAdapter.isInstalled()`: package.json 성공·실패 각각 `usable: true` + registry 경유 Claude usable (U4 red). CLAUDE 테스트는 실제 adapter 경유로 바꾼다 |

### EP-02′·EP-08·EP-10 oracle 정정

| pair · 자리 | 정정한 직접 oracle | 등록 변이 |
|---|---|---|
| VP-02 · EP-02′ #1 | BOOT에 단언 추가 — `bootstrap.start()` 호출 직후, 어떤 await보다 먼저 `refreshInstallState` 1회 | X03 |
| VP-08 · EP-08 #2 | `copyable`은 `partsText`와 같은 파트 술어 1벌(`lib/parts`)에서 파생한다. GOLD는 meta 행마다 `copyable === (turnCopyText(turn) !== '')`를 단언하고(버리지 않음) 공백 텍스트·child(`parentToolRunId`) 텍스트만 있는 턴 fixture를 더한다. Timeline 렌더: 그 턴의 복사 버튼 0, 본문 있는 턴 1 | X01 |
| VP-10 · EP-10 #1 | `sdk.test.ts` — 첫 import 거절 → 두 번째 `loadClaudeSdk()`가 새 import로 성공(factory 2회) | X27 |

### ΔV2 구현 지시

| 대상 | 변경 |
|---|---|
| `chatStore.ts:1872-1904` `setModel` | 옵션에 `userPick?: boolean`. `automaticFallback = unavailableLandingFallback && selected.backend === 'claude' && !options?.explicitHarness && !options?.userPick`. 표식 해제 규칙은 그대로 |
| `Composer.tsx:434-441` | 모델 메뉴 `onPick` → `setModel(…, { userPick: true })`. 자동 선택 effect(`:193-212`)는 옵션 없음 |
| `explicitHarness` | 재사용하지 않는다 — 리듀서 `harnessExplicitlySelected`가 Composer 모델 폴백 제한(`Composer.tsx:138-139`)을 바꾸기 때문이다 |
| D-017 | 코드 변경 없음 — 복귀 때 `applyHarnessAvailability`가 조기 return하고 `landingBackend`·표식을 유지하는 현재 동작을 EP-03″ #5로 잠근다 |
| `registry.ts:40` · `claude/adapter.ts:374-381` | D-018 — 분기 제거, Claude 두 반환에 `usable: true` |
| `lib/parts.ts` · `projection.ts:126-130` | `partsText`와 `copyable`이 같은 파트 술어 1벌을 쓴다 |
| `harnessAvailabilityStore.ts:30` | 참조 0인 `useHarnessAvailable` 삭제(verify N3) |

- 테스트 파일 위치는 구현자 재량이다. 각 좌표는 `[구현자 기입] 강제 지점 전수`에 `파일:케이스명`으로 적고, `scan/sites-dv2.sh` 재측정 차집합을 함께 적는다.

### ΔV2 self-review

- D-016·D-017(사용자)·D-018(설계자)을 Ledger에 ACTIVE로 남겼고 D-007은 보완 관계로 ACTIVE 유지다. `ACTIVE 결정 ↔ AC` 대조는 §3 갱신 메모에 적었다(충돌 0).
- AC4″·AC5″·AC7′는 행동 단언·검증 수단·도달 경로를 다시 갖는다. AC 총수 23.
- VP-04·VP-03 목록은 술어를 계약 주어(가용성 상태·재확인 트리거 / renderer 노출·폴백·기록)로, 범위를 path 파일 전부로 둔 검색의 출력에서 고정했다. 표본 확인으로 일일 게이트 focus 줄 2개를 뺐다.
- r1 못 잡음 21건은 자리별 등록 변이로 귀속했다 — VP-02 1 · VP-03 5 · VP-04 10 · VP-05 3 · VP-08 1 · VP-10 1 = 21.
- 사람 실기는 §19 그대로다(시각·실제 설치본 3건).

## ΔV3 — 사용자 결정 변경: 마지막 백엔드 원칙 (2026-11-03)

**수정 필요(사용자 결정 변경 — 실패 아님).** 사용자가 새 대화의 기본 하네스를 "자의든 타의든 마지막 백엔드"로 정했다(D-019). 그래서 자동 전환도 `lastBackend`에 저장하고, 이어가기는 이 규칙에서 뺀다(D-020). r2 구현 전이라 라운드는 2 그대로이고 바뀌는 pair는 VP-03 하나다.

| 대상 | ΔV2 | ΔV3 | EP-03‴ 자리 |
|---|---|---|---|
| 자동 전환(부팅 시드·실행 중 사용 불가 전환) 기록 | 저장 안 함(D-007) | 전환 순간 `claude` 저장(D-019) | #1·#2·#3 |
| 폴백 중 자동 기본 모델 선택 | 저장 안 함(D-016) | 저장(D-019) | #5 |
| 모델 메뉴 선택 | `userPick` 옵션으로 구분해 저장(D-016) | 구분 없이 저장 — 옵션 불필요(D-019) | #5·#6 |
| 같은 실행 중 다시 사용 가능 | 새 대화 Claude, 다음 실행은 `lastBackend`(=OpenCode)(D-017) | 새 대화 Claude, 다음 실행도 Claude(D-019) | #3 |
| 분기·핸드오프 초안의 모델 선택 | 저장(현재 코드 `chatStore.ts:1891`, 결정 없음) | 저장 안 함(D-020) | #5 |

### ΔV3 계약과 V 증분

| Node / Pair | provenance / requiredness | 대체·상속 범위 | 등록 변이(자리) |
|---|---|---|---|
| R-03 / VP-03 | CHANGED / REQUIRED | AC7′ → AC7″ · EP-03″(17) → EP-03‴(19) | 이관 N07(#1)·R03a(#2)·X16·X61(#3)·X02(#4)·R03b·X14·X15(#7)·X63(#9)·X13(#15)·R03c·X62(#16)·N04(#17) · 신규 U5(#2)·U6·U8(#3)·U7(#5)·U9(#6) |
| VP-03 외 pair | ΔV2 그대로 | ΔV3 비영향 — main 코드 변경 0, 아래 소비처 판정 | ΔV2 그대로 |

- `SUPERSEDED` 이관: U1(#6 `userPick` 삭제)의 메뉴 → `setModel` 배선 계약은 U9가, U2(#5 `!options?.userPick` 삭제)의 기록 판정 계약은 U7이 받는다.
- X17 폐기: r1 `chatStore.ts:1896` "자동 폴백 시 lastBackend 미기록 조건 삭제"(잡음)는 그 조건을 D-019가 지워 심을 자리가 없다. 반대 계약(자동 전환 기록)은 U5·U6이 잠근다. 다음 verify는 X17을 재실행하지 않고 이 줄을 인용한다.
- 레벨 판정: `lastBackend` 저장(`settingsApi.set` → main settings store)·부팅 읽기(`steps.ts:68`) edge는 그대로다. 새 edge는 renderer 안의 기록 호출뿐이라 R-03 AT 좌표가 production 진입(부팅 단계 실행·store action·Composer 렌더)으로 닫는다.
- main 소비처: OpenCode 웜업은 `settings().lastBackend`를 매번 읽는다(`warmup.ts:28`). 자동 전환 기록 뒤에는 같은 실행의 usable 전환·다음 부팅에서 웜업하지 않는다 — 새 대화가 Claude이므로 의도와 같고, EP-05 #14′ 좌표는 main fixture `lastBackend:'opencode'`로 그대로 유효하다.
- 유효 pair는 VP-01~VP-11 전부 REQUIRED, AC 23개(AC7′ → AC7″, 총수 불변)다.

| ID | 자리 | 종류 | 바꾼 내용 |
|---|---|---|---|
| U5 | `chatStore.ts` `seedLandingBackend` 사용 불가 분기 | 제거 | `lastBackend:'claude'` 기록 호출 삭제 |
| U6 | `chatStore.ts` `applyHarnessAvailability` 전환 분기 | 제거 | `lastBackend:'claude'` 기록 호출 삭제 |
| U7 | `chatStore.ts` `setModel` 기록 대상 판정 | 제거 | 이어가기 초안 제외 항 삭제 |
| U8 | `chatStore.ts` `applyHarnessAvailability` usable 분기 | 다른 값 | usable이면 `landingBackend = 'opencode'`로 되돌린 뒤 return |
| U9 | `Composer.tsx` 모델 메뉴 `onPick` | 제거 | `setModel(…)` 호출 삭제(메뉴 닫기만 남김) |

### 대체 AC (ΔV3)

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-03 | AT-03 / AC7″ | 사용 불가면 OpenCode 컴포저 비노출 — 새 대화·프로젝트 랜딩은 Claude, 기존 OpenCode 세션은 안내+다시 확인(진행 중 턴·대기 요청 동안은 Composer 유지). 자동 전환(부팅 시드·실행 중 사용 불가 전환)은 그 순간 `lastBackend`에 `claude`를 1회 쓰고, 새 대화·프로젝트 랜딩의 모델 선택은 메뉴·자동 구분 없이 고른 하네스를 쓴다(D-019). 다시 사용 가능해져도 새 대화·프로젝트 랜딩은 Claude이고 메뉴에서 OpenCode를 고르면 그때부터 OpenCode다. 분기·핸드오프 초안과 기존 대화의 모델 선택은 `lastBackend`·새 대화 기본을 바꾸지 않는다(D-020) | EP-03‴ #1~#19 좌표 — 특히 #1·#2·#3·#5·#6·#18 | 부팅 단계·store push → `ChatProvider` → chatStore(`seedLandingBackend`·`applyHarnessAvailability`·`setModel`·`newChat`) → `settingsApi.set` · Landing·ProjectLanding·ChatTile·ModelMenu |

- AC 게이트 재확인: 행동 단언은 칸 backend 값·`settingsApi.set` 호출 수·인자다. `N회` sink `settingsApi.set({lastBackend})`의 ΔV3 production 호출부는 `setModel` 기록(#5)·`seedLandingBackend` 폴백(#2)·`applyHarnessAvailability` 전환(#3) 세 곳이고, helper 하나로 모아도 호출자는 이 셋이다. 각 좌표는 진입 함수를 실제로 부르고 다른 호출자를 fake로 바꾸지 않는다.
- 음성 단언(기록 0)은 같은 테스트의 양성 단언과 짝이다 — 초안 기록 0(#5)은 새 대화 기록 1과, 복귀 뒤 Claude 유지(#3)는 기록 횟수 불변과 함께 본다.

### ΔV3 §10

자리 검색은 [`scan/sites-dv3.sh`](scan/sites-dv3.sh)(S03″)이고 N은 r1 코드 실측이다 — ΔV3 기준 HEAD `7f3b156`의 `app/`는 `c9d212b`와 같다(`git diff --stat c9d212b 7f3b156 -- app` 출력 0줄). S03′ 대비 폴백 표식 `unavailableLandingFallback` 술어를 빼고(D-019 삭제 대상), 마지막 백엔드를 운반하는 `landingBackend`·`lastBackend`와 기록 대상 판정 줄을 더했으며 JSDoc(`/**`) 줄도 주석으로 뺐다.

| pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 → N / 목표 | 직접 oracle | 실패 의미 |
|---|---|---|---|---|---|---|
| VP-03 | D-006 노출 · D-019 마지막 백엔드 기록·적용 · D-020 이어가기 제외 | 가용성 store + `supported` + chatStore `landingBackend`(메모리)·`lastBackend`(설정) | EP-03‴ (19) | S03″ 39 / 표 자리 전부 유지(줄 이동 허용). 사라져도 되는 줄은 폴백 표식 식의 `:225`뿐이고, 늘어나는 줄은 #2·#3 기록 호출과 #5 초안 제외뿐 — 차집합을 `[구현자 기입]`에 | EP-03‴ 표 | 실패할 OpenCode 화면 노출 · 마지막 백엔드 유실·오기록 · 이어가기가 새 대화 기본을 바꿈 |

- ΔV3 이후 강제 지점 분모: VP-03 19(ΔV2 17에서 +2) — 전체 95 → **97**.

### EP-03‴ — renderer 노출 · 마지막 백엔드 (19, EP-03″ 대체)

| # | 자리 (S03″ 줄, r1 코드) | 규칙 | 직접 oracle 좌표 | 출처 |
|---|---|---|---|---|
| 1 | `app/boot/steps.ts:68` | `backend` 단계 뒤 `seedLandingBackend(settings.lastBackend)` | 정정 — `steps.availability.test.ts` 사유 `it.each`(실제 `runBootSteps(createBootSteps(…))`): `lastBackend:'opencode'` × `missing`·`unsupported`·`failed` → 칸 `claude` + `settingsApi.set` 정확히 1회 `{lastBackend:'claude'}` · usable → `opencode` + 0회. 제목의 "without writing settings"는 바꾼다 (U5·N07 red) | CHANGED |
| 2 | `chatStore.ts:221,225,226,227,241,242,244` | `seedLandingBackend`: `opencode` + 사용 불가 → 마지막 백엔드 `claude` + `{lastBackend:'claude'}` 1회. 그 밖(`claude`·`null`·usable)은 받은 값 그대로, 기록 0. 세션 없음·잠김 아님·명시 선택 아님 칸에 적용 | 정정 — `chatStore.availability.test.ts` "seeds Claude for an unavailable lastBackend…": `failed` → `claude` + 기록 1 · 이어 usable `opencode` → `opencode` + 추가 기록 0 · `seedLandingBackend('claude')` → 추가 기록 0 (R03a·U5 red) | CHANGED |
| 3 | `chatStore.ts:187,188,189,190` | `applyHarnessAvailability`: 사용 불가 + 마지막 백엔드 `opencode` → `claude` + `{lastBackend:'claude'}` 1회, 세션 없는 OpenCode 새 대화·프로젝트 칸 재시드(저장 세션·진행 중·잠김 제외). 이미 `claude`면 기록 0. usable이면 아무것도 바꾸지 않는다 | 정정 — "falls back main/project drafts…": usable `seedLandingBackend('opencode')` 뒤 `missing` 반영·호출 → draft·project `claude`, saved·claude 칸 같은 참조, 기록 정확히 1 · 같은 상태 재호출 → 1 유지 · usable 반영·재호출 → `newChat()`·`newChat('project','/repo')` 칸 `claude`, 기록 1 유지 (X16·X61·U6·U8 red) | CHANGED |
| 4 | `ChatProvider.tsx:11,12` | 마운트 1회 + store 변화마다 재시드 | EP-03″ #4 그대로 (X02) | INHERITED |
| 5 | `chatStore.ts:1891,1892,1897` | `setModel` 기록 대상 = 활성 칸이 세션 없음 + 이어가기 초안(`forkFrom`·`handoffFrom`) 아님. 선택이 바뀌면 메뉴·자동 구분 없이 마지막 백엔드 갱신 + `{lastBackend: 선택 하네스}` 1회. 대상이 아니면 둘 다 그대로 | 신규 — `chatStore.availability.test.ts`(실제 `chatActions`): 폴백 중 새 대화 칸 `setModel(claude…)` → 기록 +1 `{lastBackend:'claude'}` · usable 뒤 같은 칸 `setModel(opencode…)` → 기록 +1 `{lastBackend:'opencode'}`, `newChat()` 칸 `opencode` · 마지막 백엔드 `opencode`에서 저장 Claude 세션의 `startForkDraft()`·`startHandoff()` 초안마다 다른 Claude 모델 `setModel` → 기록 0, 이어 `newChat()` 칸 `opencode` · 저장 세션 칸 `setModel` → 기록 0 (U7 red) | CHANGED |
| 6 | `Composer.tsx:434` | 모델 메뉴 `onPick` → 추가 옵션 없이 `setModel(선택)` | 신규 — 실제 Composer 렌더(fake DOM, 새 대화 칸, OpenCode usable, Claude 선택 상태)에서 ModelMenu의 OpenCode 모델 클릭 → `{lastBackend:'opencode'}` 1(자동 선택은 Claude만 쓰므로 구별된다) · 분기 초안 칸 렌더에서 다른 Claude 모델 클릭 → `lastBackend` 기록 0 (U9 red) | CHANGED |
| 7~17 | EP-03″ #7~#17과 같은 17줄(`ChatTile.tsx:65,165` · `HarnessUnavailableNotice.tsx:21` · `Landing.tsx:27` · `ProjectLandingPage.tsx:112` · `ModelMenu.tsx:31` · `modelSelection.ts:27` · `Composer.tsx:335` · `EngineCard.tsx:34,37,38` · `AgentEnvironmentView.tsx:31,96,105` · `agentStore.ts:22,43,94`) | EP-03″ 규칙 그대로 | EP-03″ 좌표 그대로 | INHERITED |
| 18 | `chatStore.ts:183` | 시드 전 마지막 백엔드 초기값 `claude`(시드가 늦어도 번쩍임 없음) | 신규 — `vi.resetModules()` 뒤 새로 import한 `chatStore`에서 시드 없이 `newChat()` → 칸 `claude` | NEW(목록 편입) |
| 19 | `chatStore.ts:296,297,298` | `freshEntry` — 새 대화·프로젝트 랜딩 칸은 마지막 백엔드로 시작하고, 그 하네스가 지원하지 않는 종류면 첫 종류로 | `chatStore.harness.test.ts` "creates a fresh draft using the boot-seeded %s harness"·"remembers model selection across repeated fresh draft creation"(기존) + #3·#5의 `newChat` 단언 | NEW(목록 편입) |

- 검산: 1+7+4+2+3+1+17(#7~#17: 1×8 + 3×3)+1+3 = 39줄 = S03″.
- 형제 맞바꿈: #2·#3이 쓰는 값은 `claude` 고정, #5는 선택 하네스다. #5를 `'claude'` 고정값으로 바꾸면 #5 좌표의 `{lastBackend:'opencode'}` 단언과 "remembers model selection…"이 red다.

### ΔV3 구현 지시 (ΔV2 구현 지시의 `setModel`·`Composer.tsx`·D-017 행 대체)

| 대상 | 변경 |
|---|---|
| `chatStore.ts` 폴백 표식 | `unavailableLandingFallback`과 `automaticFallback` 판정을 삭제한다. `:186` 주석을 D-019에 맞게 고친다 |
| 마지막 백엔드 기록 | `landingBackend` 갱신과 `settingsApi.set({lastBackend})`(실패 보고 `chat.harness-preference.save-failed` 유지)를 함수 하나로 모은다 — 호출자는 #2·#3·#5 |
| `seedLandingBackend` | `opencode` + 사용 불가일 때만 위 함수로 `claude`를 기록한다. 그 밖에는 기록하지 않는다(부팅 읽기가 같은 값을 다시 쓰지 않게) |
| `applyHarnessAvailability` | 사용 불가 + 마지막 백엔드 `opencode`면 위 함수로 `claude`를 기록한다. usable 조기 return은 그대로다(D-019) |
| `setModel` | `userPick` 옵션을 더하지 않는다(ΔV2 지시 폐기). 기록 대상 판정에 이어가기 초안 제외를 더하고 술어는 `isContinuityDraft`와 1벌로 둔다 |
| `Composer.tsx:434-441` | 코드 변경 없음 — `onPick`은 지금 형태로 `setModel`을 부르고 #6 좌표로 잠근다 |
| `explicitHarness` | 그대로 둔다 — 리듀서 `harnessExplicitlySelected`(Composer 모델 폴백 제한) 용도이고 ΔV3 기록 판정에 쓰지 않는다 |

### ΔV3 self-review

- D-019·D-020을 ACTIVE로 더하고 D-007·D-016·D-017을 대체 링크와 함께 SUPERSEDED로 돌렸다. `ACTIVE 결정 ↔ AC` 대조는 §3 갱신 메모에 적었다(충돌 0).
- 조건절 원문 인용: "자의든 타의든"(D-019) · "반드시 새대화, 프로젝트 랜딩에서만 유효"(D-020). [D11-3] 자유 답의 저장 시점 해석은 갱신 메모에 적었다.
- AC7″는 AC 게이트를 다시 통과했다 — 행동 단언·검증 수단·도달 경로, sink 호출부 3곳을 #2·#3·#5에 매핑했다.
- VP-03 목록은 S03″ 출력에서 고정했다(39줄 = 19항목 검산). SUPERSEDED U1·U2는 U9·U7로 이관했고 X17은 폐기 근거를 남겼다.
- 사람 실기는 §19 그대로다 — 재시작 뒤 기본 하네스는 #1·#2 좌표가 기계 검증한다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 부팅 필수 단계가 `opencode --version` 실행을 기다린 뒤에야 다음 단계로 간다. 15s는 실행 시간이 아니라 시간 초과 상한이고, 실행 시간은 이 환경에서 측정 불가(OpenCode 미설치) — 사용자 실측 3초 이내(생성·종료 포함, ΔV1 정정) | `bootstrap.ts:765-767` → `registry.ts:22-29` → `opencode/v1/server.ts:161-166` |
| 그 결과(`installed`·`version`)는 `backend:list` 응답에만 실리고 renderer에서 읽는 곳이 없다 | `misc.ts:36` · renderer `rg "\.installed\b\|installed\b"` → i18n 리소스만 · `backendStore.ts` 소비는 `capabilities`·Claude 버전 라벨뿐 |
| 백그라운드 작업은 registry 캐시가 아니라 서버 풀 캐시를 쓴다 — 웜업·`HostHarnessPort`·서버 시작·모델 목록 | `bootstrap.ts:887` · `harness-host.ts:14` · `server.ts:173`·`:263`·`:371` → `readVersion`(`:151`, identity별 promise 합류) |
| 미설치면 PATH 존재 검사(`existsSync`)에서 즉시 실패하고 프로세스를 띄우지 않는다 | `server.ts:91-113` `resolveOpenCodeExecutable` |
| 미설치여도 OpenCode 전역 감시·모델 메뉴의 OpenCode 엔진·엔진 추가 메뉴가 그대로 살아 있다 | `bootstrap.ts:1247` · `ModelMenu.tsx:29`(`supported`만 거름) · `AgentEnvironmentView.tsx:90` |
| `supported`는 이미 모델 메뉴·자동 선택·엔진 카드 배지의 단일 입력이다 | `ModelMenu.tsx:29` · `modelSelection.ts:27` · `Composer.tsx:335` · `EngineCard.tsx:34` ← `models.ts:97`·`runtime-catalog.ts:125` |
| 실행 파일 경로 설정 = `harnesses.opencode.executablePath` | `shared/protocol.ts:709-712`·`:801-806` · `server.ts:147` |
| renderer 진입 청크가 압축되지 않았다 — electron-vite 5 기본값 `minify:false` | `node_modules/electron-vite/dist/chunks/lib-*.js:536` · 기준 103,089줄 |
| 진입 청크 3,891,098B 중 recharts 계열 794,450B · shiki 계열 340,624B, 자산 277개(대부분 미사용 shiki 언어) | [`baseline/bundle.json`](baseline/bundle.json) |
| 전체 압축 실측 1,825,017B(−53%) · 이름 유지 압축 3,024,943B | 설계 턴 빌드(같은 config + `minify:'esbuild'`) |
| recharts는 설정 사용량 탭의 차트 1파일만 쓴다 | `TokensPerDayChart.tsx:7` ← `UsageTab.tsx:19`·`:165` |
| shiki는 전체 진입점을 정적으로 불러 언어 레지스트리 전부를 청크로 낸다. 쓰는 언어는 11개·테마 2개 | `syntax.ts:1`·`:3-15`·`:22-23` |
| shiki 1.29.2 세분 진입점이 같은 패키지에 있다 | exports `./core`·`./engine/javascript`·`./*`→`./dist/*` · `import('shiki/langs/typescript.mjs')` 실행 확인 |
| OpenCode Timeline이 live 텍스트를 루트에서 구독해 프레임마다 전체 대화를 다시 투영한다(복사 텍스트 포함) | `Timeline.tsx:28-45` → `projection.ts:23-120`(`turnCopyText` `:85`) · 행 조회 `findIndex` 3자리 `:47`·`:59`·`:65` |
| Claude transcript는 이미 리프 구독이다 — 범위 밖 | `claude/transcript/PendingAssistant.tsx:10-13` |
| 보관 행은 세션을 열 때마다 통째로 파싱된다. 표시·원본 삭제 뒤 이어가기는 그 안의 `messages`를 쓴다 | `reader.ts:30` → `native-projection.ts:31-40` · `native-session.ts:54-57` `archivePrompt(archive.messages)` |
| `raw` 필드를 읽는 코드는 Claude 이어붙이기 빠른 경로 하나다. OpenCode raw는 기록만 된다 | `claude/native-history.ts:217`·`:221` · `opencode/v1/native-history.ts:272` · 재투영 코드 없음(`PROJECTION_VERSION`은 cursor 재사용 판정만, `:18`·`:202`) |
| 실제 Claude 대화(3.42MB JSONL, 1,026 레코드) 실측: 보관 행 4.79MB 중 raw 71.4%, 파싱 10.1ms → 4.6ms | [`scan/raw-ratio.ts`](scan/raw-ratio.ts) — 진행 중 대화라 값은 늘어난다(앞선 측정 2.65MB에서 69%) |
| 세션 열기 순서 = `session:load`(DB에서 즉시) → `session:refresh`(원본 비교) | `handlers/session.ts:64-77`·`:79-105` |
| refresh의 busy 판정은 `total_changes()` 버전 비교다 — 분리 UPDATE가 그 사이에 끼면 busy가 된다 | `native-history-queries.ts` `observe` · `native-sync.ts:74`·`:89-91` |
| main 상시 타이머 4개 중 3개가 할 일이 없어도 깬다 | `project-resource-sync.ts:67`(500ms, tick마다 runtime 대상·DB 조회·키 직렬화) · `mcp-reconcile.ts:33`(500ms) · `file-transport.ts:57`(500ms) · `scheduler.ts:164`는 사용자 주기라 유지 |
| OpenCode 제출 허가가 20ms 간격으로 폴링한다 | `mcp-control.ts:160-163` |
| activity 변화는 bootstrap 한 곳에서 방송된다 — 신호를 덧붙일 자리 | `bootstrap.ts:1066-1078` `emit: broadcastChatEvent` · lease 신호 `supervisor.subscribeLeases`(`:1057`) |
| main 번들이 시작 시 Claude SDK(`sdk.mjs` 1.24MB)를 즉시 `require`한다 | `out/main/index.js:40` · 값 import 2곳 `adapter.ts:14` `query` · `runtime-tools.ts:1` `createSdkMcpServer` · 동적 import 1곳 `native-history-map.ts:16` |
| SDK 첫 로드 비용 ~150ms(첫 `selectClaudeHistory` 173ms vs 이후 18~26ms) | 설계 턴 실측(같은 대화 3회) |
| 0290 N1: 정규화 JSON 사본 2곳이 남았다. 둘 다 프로세스 안 키다(영속 아님) | `claude/project-settings.ts:125-137`(revision digest) · `claude/background.ts:20-28`(mapper `seen` 키, `:49`) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 설치 상태 갱신 | `scan/sites.sh` S02a·S02b | 3 · 1 | 부팅 단계·registry·설치 후 갱신 |
| 설치 판정 소비자 | S05a | 9 | registry 캐시 4줄 · `HostHarnessPort` 2 · 웜업 1 · `backend:list`·`agent:list` 2 |
| `supported` 생산자 | S05b | 2 | settings 행 · runtime 행 |
| OpenCode 백그라운드 시작 | S05c | 4 | 컴포저 준비 · 로그인 프리 연결 · 웜업 · 전역 감시 |
| renderer 노출 자리 | S03 | 9 | 시드 1 · 컴포저 mount 3 · `supported` 소비 4 · 엔진 추가 메뉴 1 |
| raw 생산·소비 | S06a | 5 | 타입 1 · 생산 2 · 소비 2 |
| 보관 payload IO | S06b | 9 | queries 6 · native-sync 2 · reader 1 |
| 최신 마이그레이션 | S06c | `0033_session_last_model.sql` | 새 파일 = `0034` |
| 번들 자리 | S07a · S07b · S07c | 0 · 2 · 1 | minify 설정 · recharts 정적 경로 · shiki 정적 값 import |
| Timeline 프레임 비용 | S08 | 8 | 구독 2 · 투영 2 · 색인 3 · 복사 1 |
| 상시 타이머 · 20ms 폴링 | S09a · S09b | 4 · 1 | scheduler 제외 3 + 폴링 1 |
| SDK 로드 자리 | S10a · S10b | 2 · 1 | 정적 값 import · 동적 import |
| 정규화 사본 | S11 | 2 | N1 |

### 수치 / 전칭 표현 검산

- 번들 계열 합: recharts 794,450 + shiki 340,624 = 1,135,074B = 진입 청크의 29.2%.
- "읽는 화면이 없다"(D-005): renderer 비테스트에서 `installed` 토큰은 i18n 리소스뿐이고 `useBackendState`는 store 밖 소비 0이다.
- "raw를 읽는 코드는 하나": `rg "snapshot\.raw\b" app/src/main` → `claude/native-history.ts` 2줄뿐(같은 분기).
- 기존 테스트 실재: `Timeline.selection.test.ts`·`projection.test.ts`·`project-resource-sync.test.ts`·`mcp-reconcile.test.ts`·`mcp-control.test.ts`·`file-transport.test.ts`·`harness-host.test.ts`·`warmup.test.ts`·`registry.test.ts`·`CodeBlock.render.test.ts`·`native-history.db.test.ts`·`session.load.test.ts` 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01, AR-01~AR-03, MD-01~MD-04.
- 부팅: `start()`가 `adapter-registry`에서 `--version` 실행을 기다린다 → 이후 seed·deploy·scan이 뒤로 밀린다 → renderer `main-ready`가 그만큼 늦다.
- 설치 판정이 두 벌이다: registry 캐시(`backend:list`용, 읽는 곳 없음) + 서버 풀 캐시(실제 작업용). 미설치여도 UI·감시·메뉴는 OpenCode를 그대로 노출한다.
- 번들: 압축 없음 + 차트·강조 모듈이 시작 청크에 정적 포함.
- OpenCode 스트리밍: 루트가 live 구독 → 프레임마다 `projectTimeline(전체)` + 복사 텍스트 전부 + `findIndex` 3회.
- 보관: `payload_json = {…messages, raw}` → 열 때 raw까지 파싱, 쓸 때 raw까지 직렬화.
- 타이머: 500ms 상시 3개 + 제출 대기 20ms 폴링.

```text
start() ─ adapter-registry(await --version) ─ seed ─ deploy ─ scan ─ finish ─▶ main-ready
registry.installState ─▶ backend:list(installed) ─▶ (소비 0)
server pool readVersion ◀─ warmup / HostHarnessPort / acquire / listModels
renderer: ModelMenu(supported) · Landing(lastBackend) · ChatTile(<Composer>) · AgentEnvironmentView(HARNESS_IDS)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같음.
- 부팅(ΔV1): `adapter-registry` 단계를 `start()` 초입에서 시작만 하고 `finish()` 직전에 합류한다 — 나머지 부팅 단계와 겹치고 화면이 뜰 때 결과는 확정이다.
- 가용성 SSOT(ΔV1): registry 설치 캐시가 하네스별 `installed`·`version?`·`usable`·`unavailableReason?`·identity를 갖는다. 재확인(D-015)도 registry가 하고, 바뀔 때만 bootstrap이 `orca:harness:availability`를 방송한다. Claude는 `usable:true`(SDK 동봉).
- 소비자(ΔV1): `backend:list`(기존 키 + `usable`·`unavailableReason`) · `agent:list`(`supported` = 등록 ∧ `usable`) · `HostHarnessPort.installed`(registry 값, 시그니처 불변) · 웜업·전역 감시·컴포저 준비(`usable:false`면 시작 안 함, 부팅 뒤 `usable` 전환 때 시작).
- renderer: 가용성 store(`shared/stores`)가 boot `backend` 단계에서 초기값을 받고 push를 구독한다. 시드·재시드·ChatTile 안내·엔진 추가 메뉴가 그것을 읽는다. 모델 메뉴는 기존대로 `supported`만 읽는다.
- 번들: renderer `minify:'esbuild'` · `TokensPerDayChart` `React.lazy` · `syntax.ts`가 shiki 세분 모듈을 `getHighlighter()` 안에서 동적 로드.
- OpenCode 스트리밍: 확정 교환 rows는 `messages` 변화 때 1회, 진행 중 교환 rows만 프레임마다. 복사 텍스트는 복사할 때 계산. 행 조회는 key 색인.
- 보관: `payload_json`(messages 등) + `raw_json`(raw). `session:load`가 기존 행을 SQL로 1회 분리. Claude 빠른 경로는 `previous.raw()`로 필요할 때만 읽는다.
- 타이머: 할 일이 있을 때만 무장. 제출 대기는 activity 신호 + 500ms 상한.
- SDK: `adapters/claude/sdk.ts` loader 1벌이 `import()`를 memo한다. 값 import 0.

```text
start() ─┬─ db-init ─ … ─ seed ─ deploy ─ scan ─┬─ finish ─▶ main-ready(결과 확정)
         └─ adapter-registry(설치·버전 확인) ─────┘ 합류(ΔV1)
registry 설치 캐시 ─▶ backend:list · agent:list(supported) · HostHarnessPort · warmup · global watch · composer prep
재확인(경로 변경·다시 확인·포커스) ─▶ registry ─ 바뀜 ─▶ push(orca:harness:availability)
renderer availability store ─▶ boot seed · chatStore reseed · ChatTile notice · AgentEnvironmentView
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 설치 판정 2벌(registry·서버 풀) | 가용성 SSOT 1벌(서버 풀 캐시를 probe로) | 읽는 곳 없는 사본 제거 · 미설치 게이트의 근거 | AR-01 / VP-05 · WP-2 |
| data/control flow | 부팅이 probe를 기다림 · 상시 타이머 · 프레임마다 전체 투영 | 백그라운드 probe · 이벤트/대기 시만 타이머 · 증분 투영 | 체감 반응성 | R-02·MD-01·MD-02 / VP-02·08·09 · WP-1·5·6 |
| state/contract | `installed: boolean` · `payload_json`에 raw · 정적 SDK·차트·shiki import | `availability` · `raw_json` 열 · 동적 로드 | 형상 변경 허용(D-003 경계 안) | AR-01~03·MD-03 / VP-05·06·07·10 |
| error/lifecycle | 미설치는 전송 뒤 오류 | 미설치는 비노출 + 재확인 3트리거 | 실패할 동작을 처음부터 숨김 | SD-01·R-03 / VP-03·04 · WP-3 |
| test seam/관측점 | probe가 부팅 안에서 실행 | 주입 locate/probe · 상태 기계 순수 파일 · 번들 측정기 | 관측 가능 | SD-01·AR-02 / VP-04·07 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `adapters/common/registry.ts` (확장, adapters) | 가용성 SSOT(ΔV1) — 하네스별 설치 캐시 + `usable`·`unavailableReason`·identity, 하네스별 refresh 합류, 재확인 3트리거, 바뀔 때만 listener | `refreshInstallState(id?)` · `availability(id)` · `settled(id)` · `focusRecheck()` · `onAvailabilityChange(fn)` | bootstrap · harness-host · handlers |
| `shared/ipc.ts` (확장, shared) | `BackendListResult` 항목에 `usable: boolean`·`unavailableReason?: 'missing'\|'unsupported'\|'failed'` 가산 + 채널 상수 2개(ΔV1) | 타입 | main·preload·renderer |
| `adapters/opencode/v1/server.ts`·`adapter.ts` (확장) | `installed()` 결과에 `usable`·`reason` 추가 + `executableIdentity()`(동기 stat, 프로세스 없음, 없으면 `undefined`)(ΔV1) | — | registry |
| `adapters/claude/sdk.ts` (신규, adapter-impl) | Claude SDK `import()` memo 1벌 | `loadClaudeSdk(): Promise<typeof import(sdk)>` | adapter·runtime-tools·native-history-map·bootstrap prefetch |
| `renderer/src/shared/stores/harnessAvailabilityStore.ts` (신규, shared) | 하네스별 상태 보관·push 구독 | `useHarnessAvailable(backend)` | app boot·features chat/engine |
| `features/chat/components/HarnessUnavailableNotice.tsx` (신규, feature UI) | 컴포저 자리 안내 + 다시 확인 | `{backend, availability, onRecheck}` | ChatTile |
| `infra/db/native-history-queries.ts` (확장) | `raw_json` 기록·조회·기존 행 분리 | `replace({…, rawJson})` · `raw(id)` · `compactLegacyRaw(id)` | native-sync · reader · session handler |

## 10. 계약 / 타입 / 강제 지점

자리 검색은 repo root에서 [`scan/sites.sh`](scan/sites.sh)가 실행한다(`G` = 테스트·fixture 제외). N은 설계 HEAD `0eb7dc2` 실측이고 `목표`는 구현 후 값이다. 착수 HEAD가 다르면 D-011대로 다시 센다.

| pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 → 설계 N / 목표 | 직접 oracle 좌표 | 실패 의미 |
|---|---|---|---|---|---|---|
| VP-02 | ~~부팅이 probe를 기다리지 않고 `start()` 초입에 1회 시작~~ **ΔV1 대체** | `HarnessAvailability.ensure` | 아래 EP-02 (4) | S02a 3 / 0 · S02b 1 / 0 | EP-02 표 | 부팅이 다시 CLI를 기다림 · 첫 사용이 느려짐 |
| VP-03 | 사용 불가면 OpenCode 컴포저 비노출·추가 비활성·Claude 폴백 | 가용성 store + `supported` | EP-03 (10) | S03 9 / 9(자리 유지, 동작 변경) + 신규 1(agentStore 구독) | EP-03 표 | 실패할 OpenCode 화면이 노출 |
| VP-04 | ~~상태 기계 D-008~~ **ΔV1 대체** | `availability.ts` | EP-04 (6, 신규 코드) | 신규 — `rg -n "focus\(\|recheck\(\|ensure\(" app/src/main/features/harnesses/common/availability.ts` ≥ 3 | EP-04 표 | 재확인 누락·불필요 spawn·중복 방송 |
| VP-05 | 소비자 전부가 가용성 1벌을 읽는다 — **ΔV1: SSOT는 registry, EP-05 일부 대체** | `HarnessAvailability` | EP-05 (15) | S05a 9 / 3(`registry.list().map` 2줄 + bootstrap probe 주입 1줄, `installState` 0) · S05b 2 / settings 행 1 불변·runtime 행은 조건식 · S05c 4 / 4(호출부 유지, 게이트 경유) | EP-05 표 | 미설치인데 작업 시작 · 설치인데 숨김 |
| VP-06 | payload에 raw 없음, raw는 `raw_json` | `NativeHistoryQueries` | EP-06 (16) | S06a 5 / 5 · S06b 9 / 9+ · S06c `0033` / `0034_native_snapshot_raw.sql` | EP-06 표 | 열기 비용 회귀 · raw 유실 · 첫 refresh busy |
| VP-07 | 진입 청크 압축·계열 0B·자산 ≤ 60 | `electron.vite.config.ts` · `syntax.ts` · `UsageTab.tsx` | EP-07 (4) | S07a 0 / ≥1 · S07b 2 / 1(차트 파일만) · S07c 1 / 0 | `gate:bundle` + EP-07 표 | 시작 청크 회귀 |
| VP-08 | live 변화는 진행 중 교환만 투영 | `projection.ts` head/tail | EP-08 (8) | S08 8 / `findIndex` 0 · `turnCopyText(` 1(복사 시점) | EP-08 표 | 프레임마다 O(대화) 재투영 |
| VP-09 | 할 일 없으면 타이머 0 | 각 클래스 | EP-09 (6) | S09a 4 / 1(scheduler) · S09b 1 / 0 | EP-09 표 | 유휴 wakeup·폴링 |
| VP-10 | 모듈 초기화가 SDK를 불러오지 않음 | `adapters/claude/sdk.ts` | EP-10 (5) | S10a 2 / 0 · S10b 1 / 1(loader 안) | `gate:bundle`(require 0) + EP-10 표 | 부팅 파싱 1.24MB 회귀 |
| VP-11 | 정규화 JSON 1벌 | `shared/obj.ts canonicalJson` | EP-11 (2) | S11 2 / 0 | EP-11 표 | 규칙 drift |

### EP-02 — 부팅 대기 제거 (4) — ΔV1 EP-02′가 전부 대체

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1 | `app/bootstrap.ts:764-768` `adapter-registry` 단계 | 삭제 | 신규 `app/bootstrap.availability.test.ts`: 주입 probe가 끝나지 않는 deferred여도 `start()` resolve · `getBootReport().steps`에 id `adapter-registry` 없음 |
| 2 | `adapters/common/registry.ts:22-29` `refreshInstallState` + `installState`(`:13`·`:28`·`:33`) | 삭제. `list()`는 `{id}`만 | `registry.test.ts` 갱신: `list()` 결과에 `installed` 키 없음 |
| 3 | `app/handlers/misc.ts:98` 설치 뒤 갱신 | `await availability.recheck(req.backend)` | 신규 `misc-split.test.ts` 케이스: 설치 스트림 종료 뒤 recheck 1회, 인자 backend |
| 4 | 신규 kick-off — `start()` 초입(가용성 생성 직후) `void availability.ensure('opencode')` | 대기 없이 시작 — 부팅 단계와 겹친다 | #1 테스트: `start()` 첫 await 전에 probe 1회 시작 · `start()` resolve가 probe를 기다리지 않음 · 웜업·`HostHarnessPort`·`acquire` 동시 대기 시 주입 `readVersion` 1회 |

- 등록 변이: #1 단계 복원(`start()`가 deferred에 막힘 → 테스트 timeout red) · #4 kick-off 제거(`start()` 중 probe 0회 → red).

### EP-03 — renderer 노출 (10)

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1 | `app/boot/steps.ts:68` `seedLandingBackend(settings.lastBackend)` | `backend` 단계를 `landing-target` 앞으로 옮기고, 사용 불가면 `'claude'`로 시드. 설정 쓰기 없음 | 신규 `steps.availability.test.ts`: lastBackend `opencode` × {`usable:false`(missing·unsupported·failed)→claude, `usable:true`→opencode}(ΔV1), `settingsApi.set` 호출 0 |
| 2 | `features/chat/components/Landing.tsx:27` `<Composer` | 빈 새 대화 칸은 chatStore `applyHarnessAvailability`가 재시드 — 사용 불가면 OpenCode 칸(명시 선택 포함, 세션 없음)을 Claude로 | 신규 `chatStore.availability.test.ts`: OpenCode 칸 + `missing` push → backend `claude`, `lastBackend` 불변 · Claude 칸 불변 |
| 3 | `pages/ProjectLandingPage.tsx:111` `<Composer` | #2와 같은 store 경로 | #2 테스트의 프로젝트 칸 케이스 |
| 4 | `features/chat/components/ChatTile.tsx:150` `<Composer` | 세션 backend가 사용 불가면 `HarnessUnavailableNotice`로 대체 | 신규 `ChatTile.availability.test.ts`: OpenCode 세션 + `missing` → textarea 0·안내 문구·다시 확인 클릭 시 `harness:recheck` 1회 / Claude 세션 + 같은 상태 → Composer 있음 |
| 5 | `composer/ModelMenu.tsx:29` `agent.supported` | 코드 불변 — main `supported`를 소비 | 신규 `ModelMenu.availability.test.ts`: OpenCode 행 `supported:false`면 항목 0, Claude 항목 유지 |
| 6 | `composer/modelSelection.ts:27` | 불변 | 기존 modelSelection 테스트 + 신규 케이스: OpenCode 미지원 행 건너뛰고 Claude 모델 선택 |
| 7 | `components/Composer.tsx:335` | 불변 | #5 테스트가 같은 agents로 Composer 렌더(메뉴 노출 조건) |
| 8 | `engine/common/components/EngineCard.tsx:34` | 배지 문구에 사유(`unavailable`)를 쓴다 | 신규 `EngineCard.availability.test.ts`: `unavailable:'missing'` → 미설치 문구, 없음 → 기존 문구 |
| 9 | `engine/common/components/AgentEnvironmentView.tsx:90` `HARNESS_IDS.map` | OpenCode 항목 `disabled`+`aria-disabled`+사유 툴팁 | 신규 `AgentEnvironmentView.availability.test.ts`: OpenCode 클릭 → 모달 없음 · Claude 클릭 → add 모달 |
| 10 | 신규 — `shared/stores/agentStore.ts` 가용성 push 구독 | push마다 `agent:list` 재조회 1회(같은 상태 재방송은 main이 막는다) | `agentStore.test.ts` 신규: push 1회 → `agentApi.list` 1회 · 구독 해제 뒤 0 |

- 등록 변이: #1 폴백 제거 · #4 하네스 판정 맞바꿈(claude↔opencode) · #9 disabled 조건 뒤집기 — 각 행 oracle red.

### EP-04 — 가용성 상태 기계 (6, 신규) — ΔV1 EP-04′가 전부 대체

| # | 규칙 | 직접 oracle — 신규 `features/harnesses/common/availability.test.ts` |
|---|---|---|
| 1 | locate 없음 → `missing`, probe 0회 | locate `undefined` → 상태 `missing`, probe spy 0 |
| 2 | locate 있음 → `checking` → probe 결과 `ready{version}`·`unsupported{version}`·`failed` | probe 세 결과별 상태 · 진행 중 `get()`은 `checking` |
| 3 | 동시 `ensure`·`recheck`는 합류 | 진행 중 `recheck()` 2회 → probe 1회 |
| 4 | `focus()`는 `missing`·`failed`에서만 locate, 실행 파일이 새로 보이면 probe 1회 | `ready`에서 focus → locate 0 · `missing`에서 focus+locate 성공 → probe 1 |
| 5 | 실행 파일 설정 변경 → recheck | 신규 `settings-reactions` 케이스: `harnesses.opencode.executablePath` 변경 → recheck 1 · 다른 키 → 0 |
| 6 | 상태가 바뀔 때만 emit | 같은 상태 재판정 → emit 0 · 전이 → emit 1 |

- 등록 변이: #4 조건 뒤집기(ready에서 locate) · #6 비교 제거(중복 emit) — red.

### EP-05 — 가용성 소비자 (15) — #1-8·#15는 ΔV1 EP-05′가 대체

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1-4 | `registry.ts:13`·`:25`·`:28`·`:33` 설치 캐시 | 삭제(EP-02 #2와 같은 커밋) | `registry.test.ts` |
| 5 | `harness-host.ts:4` 주석 | 판정원 서술을 가용성으로 정정 | 문서 검색(EP-23) |
| 6 | `harness-host.ts:14` `adapter.isInstalled()` | `availability.settled(harnessId)` → `{installed, version}`(형상 불변, D-012) | `harness-host.test.ts` 신규: `missing` → `{installed:false}`·adapter `isInstalled` spy 0 · `ready` → 버전 |
| 7 | `bootstrap.ts:887` 웜업 `installed` | 가용성 경유. 사용 불가로 건너뛰면 `attempted`를 세우지 않고 `ready` 전환 때 `update()` | `warmup.test.ts` 신규: `missing` → prepare 0 · `ready` 전환 → prepare 1 |
| 8 | `misc.ts:36` `backend:list` | `{id, version?, availability, capabilities}` — `installed` 없음 | `misc-split.test.ts` 신규: 키 집합·Claude `ready`+버전·OpenCode 상태 |
| 9 | `misc.ts:44` `agent:list` supported | `registered ∧ usable(availability)` | `misc.runtime-catalog.test.ts` 신규: OpenCode settings 행 `supported:false`+`unavailable` · `usable:true` → true(ΔV1) |
| 10 | `models.ts:97` settings 행 supported | 호출부가 넘긴 집합 그대로(집합이 가용성 반영) — 코드 불변 | #9 |
| 11 | `runtime-catalog.ts:125` runtime 행 `supported:true` | 하네스 사용 불가면 false+사유 | `misc.runtime-catalog.test.ts` 신규: OpenCode runtime 행 + `missing` → false |
| 12 | `composer-preparation.ts:14` resolve | OpenCode scope + 사용 불가 → 서버 획득 없이 `unavailable` 단계로 거절 | `composer-preparation-service.test.ts` 신규: acquire spy 0·stage 값 |
| 13 | `bootstrap.ts:842` `auth.connectAll()` | 호출부 불변 — `HostHarnessPort`(#6)가 게이트 | #6 + `login-free.test.ts` 기존 연결 케이스 green |
| 14 | `bootstrap.ts:881` 웜업 생성 | 가용성 구독 배선(#7) | #7 |
| 15 | `bootstrap.ts:1247` 전역 감시 | `ready`일 때만 생성, 사용 불가 전환 시 close, 생성 직후 revision 1회 방송(시작 전 변경 보정) | `bootstrap.native-history.test.ts` 신규: `missing` → watch fake 생성 0 · `ready` → 생성 1 + 방송 1 |

- 등록 변이: #6·#7·#9·#11·#12·#15 게이트 제거(사용 불가에서도 진행) — 각 oracle red.
- 자리 수가 검색 출력과 갈리면 구현자는 실측 목록을 `[구현자 기입]`에 적는다. 목록은 이 표 + S05 출력의 합집합이다.

### EP-06 — 보관 raw 분리 (16)

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1 | 신규 `infra/db/migrations/0034_native_snapshot_raw.sql` | `ALTER TABLE native_history_snapshots ADD COLUMN raw_json TEXT;` | `gate:migration` + `native-history.db.test.ts` 열 존재 |
| 2 | `native-history-queries.ts:83-86` `replace` 문 | `raw_json` 포함 | #3-4와 같은 DB 테스트 |
| 3-4 | `:172`·`:184` `replace` 입력·실행 | `rawJson` 인자 추가·기록 | DB 테스트: 기록 뒤 `payload_json`에 `raw` 키 없음 · `raw_json` 파싱 값 = 입력 raw |
| 5 | `:75` `get` | 불변(SELECT에 `raw_json` 넣지 않음) | DB 테스트: `get()` 결과에 raw 키 없음 |
| 6 | `:5` row 타입 | 불변 | typecheck |
| 7 | 신규 `raw(sessionId)` | `SELECT raw_json …` | DB 테스트: 값 왕복 |
| 8 | 신규 `compactLegacyRaw(sessionId)` | `UPDATE … SET raw_json = COALESCE(json_extract(payload_json,'$.raw'),'null'), payload_json = json_remove(payload_json,'$.raw') WHERE session_id = ? AND raw_json IS NULL` | DB 테스트: 기존 행(raw 내장) → 분리 뒤 payload 키 집합 − `raw` · raw 값 동등 · 두 번째 호출 `changes = 0` |
| 9 | `features/history/native-sync.ts:116` writer | `const { raw, ...lean } = result.snapshot` → `payloadJson: JSON.stringify(lean)`, `rawJson: JSON.stringify(raw ?? null)` | `native-sync.test.ts` 신규: `replace` 인자 검사 |
| 10 | `native-sync.ts:21` previous | `previous.raw = () => …raw(sessionId)` lazy, 기존 행 내장 raw가 있으면 그것을 돌려준다 | `native-sync.test.ts` 신규: 접근 안 하면 `raw()` 쿼리 0 |
| 11 | `features/history/reader.ts:30` | 불변 — 분리된 payload를 파싱 | DB 테스트 #8 이후 `loadSession` 메시지 동일 |
| 12 | `app/handlers/session.ts:64-77` `session:load` | `loadSession` 앞에서 `compactLegacyRaw` | `session.load.test.ts` 신규: 호출 순서(분리 → 로드) · 그 뒤 `session:refresh`가 `busy` 아님 |
| 13 | `adapters/common/native-history.ts:26` 타입 | `previous`에 `raw?: () => unknown` 추가. `snapshot.raw`는 adapter 출력 전용으로 주석 | typecheck + #14 |
| 14-15 | `claude/native-history.ts:217`·`:221` | `append` 조건의 앞선 검사가 모두 참일 때만 `previous.raw?.()` 호출 | `claude/native-history.test.ts` 신규: 조건 거짓이면 `raw` spy 0 · 참이면 1 · 결과 = 전체 파싱 결과 |
| 16 | `opencode/v1/native-history.ts:272` · `claude/native-history.ts:283` 생산 | 불변 — writer가 분리 | `opencode-history.test.ts` 신규: refresh 뒤 `raw_json`에 OpenCode raw 보존 |

- 원본 삭제 뒤 경로(AC17): `native-session.ts:54-57`이 `loadSession` → `archivePrompt(messages)`를 쓴다 — 기존 `native-session.test.ts` 복구 케이스 green + 분리된 행으로 같은 케이스 1개 추가.
- 등록 변이: #9 raw 재합류(`JSON.stringify(result.snapshot)`) → payload 키 테스트 red · #12 순서 뒤집기(로드 뒤 분리) → 순서 테스트 red.

### EP-07 — renderer 번들 (4)

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1 | `app/electron.vite.config.ts` renderer `build` | `minify: 'esbuild'`(main·preload 불변) | `gate:bundle` `entryMinified:true`·`entryBytes ≤ 1500000` |
| 2 | `settings/components/UsageTab.tsx:19`·`:165` | `lazy(() => import('./TokensPerDayChart'))` + 같은 높이 자리 `Suspense` | `gate:bundle` recharts 0 + 신규 `UsageTab.chart.test.ts`: 자리 → 차트(aria-label) |
| 3 | `settings/components/TokensPerDayChart.tsx:7` | 불변(지연 청크 안) | #2 |
| 4 | `shared/ui/markdown/syntax.ts:1`·`:19-26` | `getHighlighter()` 안에서 `shiki/core`·`shiki/engine/javascript`·`shiki/langs/<11>.mjs`·`shiki/themes/github-{light,dark}.mjs` 동적 로드, `HighlighterCore` 반환. `isLang` 동기 유지 | `gate:bundle` shiki 0·`assetCount ≤ 60` + `CodeBlock.render.test.ts` 강조 케이스 + diff 토큰 테스트 |

- 등록 변이: #2 정적 import 복원 → recharts > 0 · #4 `from 'shiki'` 복원 → shiki > 0 · #1 제거 → `entryMinified:false`.

### EP-08 — OpenCode Timeline (8)

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1 | `projection.ts:23` `projectTimeline` | `projectTimelineHead(messages, options, pending)`(마지막 교환 제외, memo 대상) + `projectTimelineTail(messages, live, options)`(마지막 교환). 두 결과의 연결이 기존 결과와 같다 | 신규 `projection.golden.test.ts`: 변경 전 코드로 만든 golden 3종(도구·산출물·미완료 포함) 동치 |
| 2 | `projection.ts:85` `turnCopyText` | meta 행은 turn 참조를 싣고 복사할 때 계산 | 신규 케이스: 렌더 중 `turnCopyText` spy 0 · 복사 클릭 → 같은 문자열 |
| 3-4 | `Timeline.tsx:28`·`:29` 구독 | 유지 — 루트 재렌더는 남고 비용만 줄인다 | #5 |
| 5 | `Timeline.tsx:35` 투영 호출 | head는 `useMemo([messages, inflight, showAutomaticFeeds])`, tail만 live 의존 | 신규 `Timeline.render.test.ts` 케이스: live 5회 변경 → head spy 1 · tail spy 6 |
| 6-8 | `Timeline.tsx:47`·`:59`·`:65` `findIndex` | head key→index Map(memo) + tail 선형 | 기존 `Timeline.selection.test.ts` 전 케이스 + 신규 색인 단위 테스트 |

- 등록 변이: #5 head memo 제거 → spy red · #2 즉시 계산 복원 → spy red.

### EP-09 — 상시 타이머 (6)

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1 | `project-resource-sync.ts:67` | 생성자 interval 삭제. 적용 대기 entry가 있을 때만 500ms timeout(unref) 재무장, 없으면 해제. `activityChanged()`·`leasesChanged()` 공개 | `project-resource-sync.test.ts` 신규 3케이스(AC18) |
| 2 | `harnesses/opencode/mcp-reconcile.ts:33` | dirty일 때만 500ms timeout 무장, 깨끗하면 해제, `close` 해제 | `mcp-reconcile.test.ts` 신규: 유휴 `vi.getTimerCount() = 0` · dirty+busy → 재시도 · 정리 뒤 0 |
| 3 | `infra/log/file-transport.ts:57` | 첫 write에 timeout 무장, flush가 해제 | `file-transport.test.ts` 신규: 쓰기 전 타이머 0 · 쓰기 → 주기 안 flush · 뒤 0 |
| 4 | `opencode/v1/mcp-control.ts:160-163` | `waitForActivity(signal, 500)` — `resourceActivityChanged()` 신호 또는 500ms | `mcp-control.test.ts` 신규: unsafe → 신호 → 진행(타이머 진행 없이) · abort reject |
| 5 | `bootstrap.ts:1078` activity `emit` | `broadcastChatEvent` + `projectSync.activityChanged()` + adapter `resourceActivityChanged?.()` | `bootstrap.native-history.test.ts` 신규: activity 방송 1회당 두 신호 1회 |
| 6 | `bootstrap.ts:1057` `subscribeLeases` | `projectSync.leasesChanged()` 추가 | 같은 테스트: lease 변화 → tick 1 |

- 등록 변이: 자리별 상시 타이머 복원(#1~#3) · 신호 배선 제거(#5·#6) — 각 oracle red.

### EP-10 — Claude SDK 지연 로드 (5)

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1 | 신규 `adapters/claude/sdk.ts` | `loadClaudeSdk()` — `import('@anthropic-ai/claude-agent-sdk')` memo | 신규 `sdk.test.ts`: 동시 2회 → mock factory 1회 |
| 2 | `adapter.ts:14` `query` | 타입만 import, 실행 경로에서 `(await loadClaudeSdk()).query` | 기존 adapter 테스트(SDK mock) green |
| 3 | `runtime-tools.ts:1` `createSdkMcpServer` | 호출자가 loader 결과의 함수를 넘긴다(동기 `adaptServer` 유지) | `runtime-tools.test.ts` green |
| 4 | `native-history-map.ts:16` | loader 사용 | `native-history.test.ts` green |
| 5 | 신규 prefetch — bootstrap `finish` 뒤 `void loadClaudeSdk()` | 부팅 대기 없음 | `bootstrap.availability.test.ts`: finish 뒤 loader 1회 · `start()`가 그 promise를 기다리지 않음 |

- 빌드 gate: `out/main/index.js`의 `require("@anthropic-ai/claude-agent-sdk")` 1 → 0(설계 턴 실측 1).
- 등록 변이: #2 정적 값 import 복원 → 빌드 gate 1(red).

### EP-11 — 정규화 JSON (2)

| # | 자리 | 변경 | 직접 oracle |
|---|---|---|---|
| 1 | `claude/project-settings.ts:125-137` `canonical`·`digest` | `createHash('sha256').update(canonicalJson(value))` | `project-settings.test.ts` 신규: `{b:1,a:2}`·`{a:2,b:1}` 같은 revision · `{a:1,b:2}` 다름 |
| 2 | `claude/background.ts:20-28` `stable` | `canonicalJson(raw)` | `background.promotion.test.ts` 신규: 키 순서만 다른 같은 uuid 메시지 → 두 번째 무시 |

- 둘 다 프로세스 안 키라 값이 바뀌어도 영속 호환 문제가 없다(§8).
- 등록 변이: 각 자리 `JSON.stringify` 되돌리기 → red.

### EP-23 — 문서 (AC23)

| 문서 | 변경 |
|---|---|
| `docs/IPC_CONTRACT.md:89` | `orca:backend:list`에 `usable`·`unavailableReason` 가산(기존 키 유지, ΔV1) + 신규 2행 `orca:harness:availability`·`orca:harness:recheck` |
| `docs/generated/inventory.md` | 재생성 |
| `docs/arch/backend/persistence.md` | `native_history_snapshots.raw_json` · 분리 시점 |
| `docs/arch/backend/adapters.md` | registry 설치 캐시 = 하네스 가용성 SSOT · 설치 판정 1벌(ΔV1) |
| `docs/arch/frontend/design-components.md` | `HarnessUnavailableNotice` 행 |
| `docs/guides/release-operations.md` | renderer 압축 스택 복원 절차(같은 태그 `--sourcemap` 빌드) |
| `app/src/main/AGENTS.md`·`app/AGENTS.md` | 변경 없음 — 경로 표가 이 변경을 서술하지 않는다(`rg -n "installState\|refreshInstallState" app/AGENTS.md app/src/main/AGENTS.md` = 0) |

- 자리 검색(ΔV1): `rg -n "unavailableReason" docs/IPC_CONTRACT.md` → 구현 후 ≥ 1 · `rg -n "orca:harness:(availability|recheck)" docs/IPC_CONTRACT.md` → 구현 후 2.

- 같은 규칙의 SSOT: 위 표 `SSOT` 열. 가용성 판정은 registry 설치 캐시 한 곳(ΔV1), 실행 파일·버전 판정은 서버 풀 한 곳이다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드 의미: `BackendListResult` 항목의 `version`은 `installed:true`일 때만, `unavailableReason`은 `usable:false`일 때만 있다(ΔV1). `AgentEnvironment.unavailable`은 `supported:false`일 때만 있다. `previous.raw`가 `undefined`면 빠른 경로를 쓰지 않는다(fail-safe = 전체 파싱).
- 외부 SDK 경계: `loadClaudeSdk()`의 반환 타입은 `typeof import('@anthropic-ai/claude-agent-sdk')` 그대로다(`as` 캐스트 금지).

## 11. 구현 설계

작업 묶음(WP)은 커밋 단위다. 순서: WP-7 → WP-1 → WP-2 → WP-3 → WP-4 → WP-5 → WP-6 → WP-8. WP-2·WP-3은 같은 가용성 계약을 공유하므로 WP-2가 타입을 먼저 낸다. AC13 golden은 WP-5 착수 전 코드로 만든다.

| WP | 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|---|
| WP-1 번들 | `electron.vite.config.ts` · `UsageTab.tsx` · `syntax.ts` | EP-07 | 압축·지연 로드 | `gate:bundle` + 렌더 테스트 |
| WP-2 가용성 main | `adapters/common/registry.ts`(가용성 SSOT) · `adapters/common/types.ts`(`isInstalled` 결과 필드·`executableIdentity?`) · `adapters/opencode/v1/{server,adapter}.ts` · `shared/ipc.ts`(필드 가산·채널 2) · `app/bootstrap.ts`(동시 시작·합류·포커스·방송) · `app/harness-host.ts` · `app/handlers/misc.ts` · `features/harnesses/common/runtime-catalog.ts` · `app/composer-preparation.ts`/`composer-catalog.ts` · `app/settings-reactions.ts` · `preload/index.ts` | EP-02′·EP-04′·EP-05′·V1 EP-05 #9~#14 | 동시 확인·재확인·게이트(ΔV1) | registry 단위 + 핸들러·bootstrap fake |
| WP-3 가용성 renderer | 신규 `shared/stores/harnessAvailabilityStore.ts` · `shared/stores/agentStore.ts` · `shared/api/ipc.ts` · `app/boot/steps.ts` · `features/chat/store/chatStore.ts`(`applyHarnessAvailability`) · `ChatTile.tsx` · 신규 `HarnessUnavailableNotice.tsx` · `EngineCard.tsx` · `AgentEnvironmentView.tsx` · i18n ko·en | EP-03 | 시드·재시드·안내·비활성 | 렌더·store 테스트 |
| WP-4 raw 분리 | `0034_native_snapshot_raw.sql` · `native-history-queries.ts` · `native-sync.ts` · `handlers/session.ts` · `adapters/common/native-history.ts` · `claude/native-history.ts` | EP-06 | 열·분리·lazy raw | DB 스위트 + 순수 fake |
| WP-5 Timeline | `opencode/transcript/{projection,Timeline}.ts(x)` · `common/transcript/MessageMeta.tsx`(복사 시점) | EP-08 | head/tail·lazy 복사·색인 | golden + 렌더 spy |
| WP-6 타이머 | `project-resource-sync.ts` · `mcp-reconcile.ts` · `file-transport.ts` · `mcp-control.ts` · `adapters/common/types.ts`(`resourceActivityChanged?`) · `bootstrap.ts` | EP-09 | 무장 조건·신호 배선 | fake timers |
| WP-7 SDK | 신규 `adapters/claude/sdk.ts` · `adapter.ts` · `runtime-tools.ts` · `native-history-map.ts` · `bootstrap.ts`(prefetch) | EP-10 | loader 1벌 | loader 단위 + 빌드 gate |
| WP-8 N1·문서 | `claude/{project-settings,background}.ts` · EP-23 문서 | EP-11·AC23 | 정규화·문서 | 단위 + doc-inventory |

### 테스트 가능성

- electron 비의존 순수 파일: `registry.ts`(adapter fake 주입, ΔV1) · `projection.ts`(head/tail) · `sdk.ts`(동적 import는 vi.mock 대상).
- 기존 메커니즘 재사용 형상: 버전 확인 합류는 `server.ts:151` identity 캐시를 그대로 쓰고 새 캐시를 만들지 않는다. 전역 감시는 0290 `FingerprintWatch`를 그대로 쓴다.
- 순서 관측: EP-06 #12는 queries fake의 호출 로그로, EP-02 #4는 `start()` 첫 await 전후 probe 카운트로 본다.

## 12. End-to-end 영향

### producer → consumer

```text
isInstalled·executableIdentity(서버 풀) → registry 설치 캐시 → 바뀜 → broadcast(orca:harness:availability)
  → preload → harnessAvailabilityStore → steps 시드 · chatStore 재시드 · ChatTile · AgentEnvironmentView
  → agentStore.refresh → agent:list(supported) → ModelMenu · modelSelection · EngineCard
```

- producer 기준: 상태가 바뀔 때만 방송한다(EP-04′ #1).
- consumer 파생 규칙(ΔV1): registry가 `usable`을 한 번 판정하고 모든 소비자는 그 필드만 읽는다(재판정 금지). `checking` 상태는 없다.
- 합성값 우회 없음: 모델 메뉴는 `supported`만, 컴포저 노출은 가용성 store만 읽는다 — 두 값의 출처는 같은 상태 1벌이다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| renderer `initBackend` → `backendStore.list` | 기존 키 유지 + `usable`·`unavailableReason` 가산(ΔV1) — 기존 소비(`capabilities`·Claude 버전 라벨) 무영향 | AC5′ |
| 로그인 프리 연결(`auth.connectAll`, 0291 D-009) | 같은 `HostHarnessPort` 형상, 판정만 가용성 경유 | AC9 |
| OpenCode 웜업(`lastBackend === 'opencode'`) | 부팅 합류 뒤 registry 결과를 읽어 대기 없음. `usable:false`면 건너뛰고 부팅 뒤 `usable` 전환 때 1회(ΔV1) | AC3′·AC9 |
| OpenCode 전역 감시 revision 구독자(0282 D-022) | 부팅에서 `usable`이면 지금과 같은 시점에 생성(추가 방송 없음). 부팅 뒤 `usable` 전환 때만 생성 + revision 1회(ΔV1) | AC9 |
| 설치 마법사 `install` 핸들러 | 설치 뒤 recheck | AC5 |
| 보관 행 소비자(`loadSession`·`readNativeHistoryPrevious`·`prepareNativeSession`) | payload에 raw 없음 — 셋 다 raw를 쓰지 않음(빠른 경로만 lazy) | AC15~AC17 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작(ΔV1): 설치 확인은 `start()` 초입(0225 이관 등급 확인 직후, 첫 await 전)에 시작하고 `finish()` 직전에 합류한다. 시작 즉시 거절 처리기를 붙이고 합류 지점에서 결과를 다시 던진다.
- 취소/중단: 종료 중이면 probe를 시작하지 않는다. 진행 중 probe는 기존 서버 풀 `shutdown` 신호를 따른다.
- 종료/quit: 포커스 리스너를 `shutdown`에서 해제한다. registry 재확인에는 타이머가 없다(ΔV1).
- retry/timeout: probe 시간 초과 15s(현행)는 `failed` — 포커스·"다시 확인"으로 재시도.
- cleanup/rollback: raw 분리는 한 UPDATE 문이라 원자적이다. 실패하면 행이 그대로(raw 내장)고 다음 열기에서 다시 시도한다.
- **다중 저장소 쓰기**: 코드 쓰기는 SQLite 한 행(UPDATE 1문)뿐이다. 산출 문서의 상태 사본은 `plan.md` + `docs/handoff/INDEX.md` 2곳이며 같은 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

| 항목 | AS-IS | TO-BE |
|---|---|---|
| 부팅 임계 경로 | `--version` 실행 시간 포함 — 사용자 실측 3초 이내(생성·종료 포함). 15s는 시간 초과 상한(`server.ts:165`)(ΔV1 정정) | 나머지 단계와 겹쳐 실행 — 단축 = min(확인 시간, 나머지 부팅 단계 시간). 화면이 뜰 때 결과 확정 |
| main 시작 파싱 | Claude SDK 1.24MB 즉시 `require` | 0 — 부팅 뒤 prefetch(첫 로드 ~150ms를 임계 경로 밖으로) |
| renderer 진입 청크 | 3,891,098B 비압축 | ≤ 1,500,000B 압축(차트·강조 제외) |
| renderer 자산 | 277개 · 14.6MB | ≤ 60개 |
| OpenCode 스트리밍 프레임 | O(전체 대화) 투영 + 복사 텍스트 전부 + `findIndex` 3회 | O(진행 중 교환) + 색인 조회 |
| 세션 열기 파싱 | payload 전체(raw 71% 포함) | messages만 — 실측 10.1ms → 4.6ms(대화 3.42MB 기준) |
| 유휴 main wakeup | 500ms 타이머 3개(초당 6회) + 제출 대기 20ms 폴링 | 할 일 있을 때만 |

- 잃는 부수 효과와 회귀 테스트: ① 사용량 탭·첫 코드 블록이 최초 표시 때 모듈 로드만큼 늦을 수 있다 — 같은 높이 자리로 레이아웃 이동 없음(AC11). ② 압축으로 renderer 스택 이름이 축약된다 — 복원 절차 문서화(D-004·EP-23). ③ 첫 Claude 턴이 prefetch 전이면 SDK 로드를 기다린다 — 부팅 직후 prefetch로 대부분 흡수(AC21). ④ 전역 감시 생성 시점은 지금과 같다(ΔV1 — `checking` 구간 없음).

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port 변경: 없음 — `HostHarnessPort.installed`의 시그니처·의미(`{installed, version?}`)는 그대로다(D-012). 판정원만 가용성으로 바뀐다.
- IPC 계약: `orca:backend:list` 응답에 `usable`·`unavailableReason` 가산(기존 키 유지, ΔV1) + 신규 2채널(EP-23). `orca:agent:list`의 `AgentEnvironment`에 선택 필드 `unavailable` 추가(가산).
- shape 검증: `docs/guides/closed-network-extensions.md`의 `HostHarnessPort` 예제는 바뀌지 않는다 — 기존 typecheck로 충분.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| `backend:list` "등록된 어댑터의 설치 상태" | `docs/IPC_CONTRACT.md:89` | D-014 · EP-05′ #8 | 유지 + 가산(ΔV1) — 기존 키 그대로 |
| 0290 D-008·D-015 배포 확장점 | 0290 plan §3 | EP-05 #6 · §15 | 유지 — `HostHarnessPort` 형상 불변 |
| 0290 D-016 이벤트 id 상한 없음 | 0290 plan §3 | §6 범위에 상한 없음 | 유지 |
| 0290 D-012 spawn 경계 동기 카탈로그 | 0290 plan §3 | 해당 없음(카탈로그 미변경) | 유지 |
| 0282 D-022 에이전트 캐시가 revision 신호 구독 | 0282 plan §3 | EP-05 #15 | 유지 — 감시 시작 시 revision 1회 |
| 0291 D-009 부팅마다 로그인 프리 연결 확인 | 0291 plan §3 | EP-05 #13 | 유지 — 같은 호출, 미설치면 CLI 없이 미설치 |
| 0225 D-017 멱등 이관 | 0225 plan §3 | D-010 | 유지 — 코드 변경 0 |
| 0108·0008 스트리밍 마크다운 꼬리 재파싱 | 각 plan | §4 | 유지 — 범위 밖 |
| 머지된 마이그레이션 수정 금지 | `app/AGENTS.md` | EP-06 #1 새 파일 | 유지 |
| 의존성 정책 | `app/AGENTS.md` | D-013 | 유지 — 새 패키지 0 |
| 하네스 형제 import 금지 | `app/scripts/harness-boundary.mjs` | registry 확장은 `adapters/common`(구체 하네스 비의존 — adapter 포트의 선택 메서드만 호출), OpenCode `executableIdentity`는 adapter 안(ΔV1) | 유지 |
| feature 교차 import 금지(renderer) | `app/src/renderer/AGENTS.md` | 가용성 store를 `shared/stores`에 둔다(agentStore 선례) | 유지 |
| 컴포넌트 카탈로그 동기 | `app/src/renderer/AGENTS.md` 6 | EP-23 `HarnessUnavailableNotice` | 유지 |
| 문서에 코드 수치 금지 | root `AGENTS.md` 원칙 4 | EP-23은 형상·경로만 | 유지 |

## 17. 리스크 / 트레이드오프 · Skip 목록

| 리스크 | 완화/결정 |
|---|---|
| 압축 스택 판독성 | 같은 커밋 `--sourcemap` 빌드로 복원(EP-23) |
| raw 분리 UPDATE가 큰 행에서 느림 | SQLite C 함수 1문, 세션당 1회 |
| 0290 r2와 같은 파일 충돌 | D-011 순서 + 착수 재측정 |

| Skip(후속 후보) | 이유 |
|---|---|
| main 델타 IPC 묶기 | renderer가 이미 rAF로 묶는다(`chatStore.ts:928`) — 이득 작고 표시 시점이 바뀐다 |
| Claude 설정 요청당 2회 읽기(0290 A16) | 메뉴 열기당 비용 미측정 · 두 스캔 통합은 별도 설계 |
| OpenCode lease마다 설정 2종 읽기 캐시 | 0282 D-020 신선도 계약 — 감시 지문과 묶는 별도 설계 |
| 0225 부팅마다 경로 재기록 스캔 축소 | D-010 · 비용 수 ms |
| OpenCode activity snapshots 지문화(0290 A14 후반) | 같은 길이 출력 변화를 놓칠 수 있음 |
| renderer i18n 두 언어 동시 번들 | 97KB · 언어 전환 즉시성 유지 |

- 되돌리기 어려운 결정: `raw_json` 열 추가(마이그레이션) — 열만 더하고 지우지 않는다. ~~구버전 앱이 같은 DB를 열어도 읽기가 깨지지 않는다~~ **ΔV2 정정**: 구버전 앱은 모르는 마이그레이션이 적용된 DB를 `DbSchemaTooNewError`로 거절한다(`migrate.ts:167-168`, 기존 다운그레이드 보호 그대로 — r1 verify N1).
- 신규 의존성: 없음(D-013).

## 18. 영향 받는 파일 / 문서

- 코드: §10 EP-02~EP-11 자리 + §11 표.
- 문서: 이 plan · `docs/handoff/INDEX.md` · EP-23 표.
- 도구·기준선: `scan/sites.sh` · `scan/bundle-measure.mjs` · `scan/raw-ratio.ts` · `baseline/bundle.json` · 0290 `scan/vitest-failed-ids.mjs`(재사용).

## 19. 게이트

- 적용 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 환경: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 트리에서 lint·typecheck·순수 vitest. DB 스위트는 Node ABI 재빌드 또는 Windows CI.
- 기본 정적 게이트: `npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(검증 턴은 `--fix` 금지).
- 관련 테스트: 전체 vitest JSON → 실패 ID 차집합 · `node --test scripts/*.test.mjs` · `gate:bundle`(§7-A).
- 사람 실기(시각·실제 환경만): Windows 설치본 ① 부팅 화면 종료 시점 체감 ② OpenCode 미설치 PC에서 랜딩·모델 메뉴·엔진 추가·기존 OpenCode 세션 화면 1회 ③ OpenCode 설치 후 창 포커스로 노출 복귀 1회.

## READY self-review

- Decision Ledger D-001~D-013 ACTIVE, OPEN 0. 사용자 원문은 §2에 그대로 인용했다. D-008만 설계자 제안이고 출처에 적었다.
- Part I만으로 완료 상태가 읽힌다(§1·§5): 설치 사용자는 같은 동작을 더 빨리, 미설치 사용자는 실패할 화면을 보지 않는다.
- 조건절 보존: "Claude … 무관"은 D-006·AC6·AC8의 Claude 불변 단언으로, "raw로 해석하고 이어나갈 수 있도록"은 D-009(raw 유지)로 반영했다.
- 수치 재측정: §8의 번들·raw·SDK·자리 N은 이번 턴 실측이다. 자리 검색 18개는 `scan/sites.sh` 출력과 §10이 같다.
- 모든 NEW 노드에 같은 레벨 REQUIRED pair(VP-01~VP-11). INHERITED 없음(Baseline). AC 23개(≤25).
- 각 pair가 §10 자리 표·검색 명령·N·자리별 oracle을 갖는다. 구조적 proxy(번들 gate·0건 검색)는 양성 oracle·등록 변이와 짝이다.
- 사람 실기는 시각·실환경 3건뿐이다. 순수 로직은 테스트로 내렸다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0(§3 갱신 메모).
- 산출물 문장 규칙: 판정 먼저·표 위주. 수치는 §8·§14에만 둔다.
- ΔV2·ΔV3 self-review: 아래 ΔV2·ΔV3 절 끝 참조.
- ΔV1 self-review: SUPERSEDED D-005·D-008과 대체 D-014·D-015를 Ledger에 남겼다. 대체 AC2′~AC6′는 AC 게이트(행동 단언·검증 수단·도달 경로)를 다시 통과했다. 바뀐 pair VP-02~VP-05의 자리 목록은 `feaca09`에서 `scan/sites.sh`(S05d 추가)로 다시 열거했고, 바뀌지 않은 V1 검색 18개의 N은 `feaca09`에서도 같다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: 유지 — V1+ΔV1의 11 REQUIRED pair·75자리·23 AC를 기준으로 구현했다. `scan/sites.sh` 착수/완료 원문은 `evidence/r1-entry-sites.txt`·`r1-final-sites.txt`에 보관했다.
- 이견 / 현실성 문제: 기술 세부만 조정 — SQL JSON 원형 보존·동기 Query 포트·설정 patch 키·head memo 의존성은 아래 차이 표에 적었다. Part I의 노출·설정 보존·raw 보관 결과는 유지했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음 — 진행 중 Composer 교체 의심은 Part I의 진행 턴 유지 규칙으로 해소했다. Decision·AC·V·§10 규범 행은 수정하지 않았다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

r1 직접 oracle 좌표다. 아래 별칭은 모두 `파일:케이스명`이며, 이번 전체 vitest 실행 집합에 포함했다. `gate:*` 명령과 실제 산출은 구현 보고 표에 적었다.

| 별칭 | 파일 | 케이스명 |
|---|---|---|
| BOOT | `app/src/main/app/bootstrap.opencode-warmup.test.ts` | `overlaps the deferred install check with DB initialization, joins before finish, and removes focus listener` |
| JOIN | `app/src/main/adapters/common/registry.availability.test.ts` | `joins concurrent refresh/settled consumers, retains previous state and emits only changes` |
| INSTALL | `app/src/main/app/handlers/misc-split.test.ts` | `preserves backend keys, rechecks the requested harness and refreshes after the install stream` |
| SEED | `app/src/renderer/src/app/boot/steps.availability.test.ts` | `initializes backend availability before seeding the remembered OpenCode draft` |
| DRAFT | `app/src/renderer/src/features/chat/store/chatStore.availability.test.ts` | `falls back main/project drafts including explicit OpenCode selection while preserving stored sessions and preferences` |
| NOTICE | `app/src/renderer/src/features/chat/components/ChatTile.harness.test.ts` | `shows an unavailable notice for idle OpenCode while retaining the active turn controls until completion` |
| MENU | `app/src/renderer/src/features/chat/components/Composer.harness.test.ts` | `omits unavailable OpenCode models while preserving Claude menu items` |
| SELECT | `app/src/renderer/src/features/chat/components/composer/modelSelection.test.ts` | `skips unsupported OpenCode rows when choosing a default model` |
| COMPOSER | `app/src/renderer/src/features/chat/components/Composer.selection.test.ts` | `selects the supported Claude model when unavailable OpenCode models are present` |
| CARD | `app/src/renderer/src/features/engine/common/components/EngineCard.render.test.ts` | `displays the installation reason instead of the generic unsupported badge` |
| ADD | `app/src/renderer/src/features/engine/common/components/AgentEnvironmentView.interaction.test.ts` | `disables OpenCode additions with an accessible reason and keeps Claude additions usable` |
| AGENT | `app/src/renderer/src/shared/stores/agentStore.test.ts` | `wires the production agent store to the harness API and refreshes changed availability once` |
| FOCUS | `app/src/main/adapters/common/registry.availability.test.ts` | `focus probes only a changed missing/failed identity, never a ready/unsupported installation` |
| PATH | `app/src/main/app/settings-reactions.test.ts` | `rechecks only an executablePath change inside the actual top-level harnesses patch` |
| HOST | `app/src/main/app/harness-host.test.ts` | `installed reads the settled registry state and missing harnesses are not installed` |
| WARM | `app/src/main/app/harnesses/opencode/warmup.test.ts` | `does not consume its one warmup attempt while unavailable and prepares after installation` |
| ROWS | `app/src/main/app/handlers/misc.runtime-catalog.test.ts` | `gates settings and runtime OpenCode rows and preserves Claude without starting unavailable catalogs` |
| CACHE | `app/src/main/features/harnesses/common/runtime-catalog.test.ts` | `updates cached runtime row availability in both directions without refetching models` |
| PREP | `app/src/main/app/composer-preparation-service.test.ts` | `rejects unavailable OpenCode preparation before resolving or acquiring a native server` |
| RESUME | `app/src/main/app/bootstrap.opencode-warmup.test.ts` | `broadcasts a changed availability once and resumes skipped warmup and observation through the real registry subscription` |
| WATCH | `app/src/main/app/bootstrap.native-history.test.ts` | `starts OpenCode global observation only when usable and sends one increasing revision for each later activation` |
| RAW | `app/src/main/features/history/native-history.db.test.ts` | `atomically splits a legacy raw value once and keeps display reads lean` |
| WRITE | `app/src/main/features/history/native-sync.test.ts` | `writes lean display payload while preserving raw separately and reads raw only on demand` |
| LOAD | `app/src/main/app/handlers/session.load.test.ts` | `splits legacy raw before the handler loads messages and leaves the next refresh usable` |
| APPEND | `app/src/main/adapters/claude/native-history.test.ts` | `reads separated raw only for a proven append and keeps the full-parse result unchanged` |
| OCARCHIVE | `app/src/main/features/history/native-history.db.test.ts` | `commits the OpenCode reader result and checkpoint through the common transaction` |
| RECOVER | `app/src/main/app/chat-turn/native-session.test.ts` | `displays and recovers a separated snapshot after the native source is deleted without reading raw` |
| CHART | `app/src/renderer/src/features/settings/components/UsageTab.chart.test.ts` | `reserves the original chart height while loading, then renders the same accessible chart` |
| SYNTAX | `app/src/renderer/src/shared/ui/markdown/syntax.test.ts` | `preserves the original grammar/theme output for all supported languages and memoizes the shared highlighter` |
| GOLD | `app/src/renderer/src/features/chat/harnesses/opencode/transcript/projection.golden.test.ts` | `matches original keys, gaps, tools, artifacts and incomplete rows` |
| MEMO | `app/src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.memo.test.ts` | `projects the committed head once and the live tail six times without computing copy text` |
| COPY | `app/src/renderer/src/shared/ui/CopyIconButton.lazy.test.ts` | `computes copy text only on click and forwards the exact string to the clipboard` |
| INDEX | `app/src/renderer/src/features/chat/harnesses/opencode/transcript/projection.golden.test.ts` | `keeps head rows and indexed positions stable as only the live tail changes, without eager copy text` |
| TIMER | `app/src/main/app/project-resource-sync.test.ts` | `has no idle timer or target scans, and activity/lease signals each tick once` |
| MCP | `app/src/main/app/harnesses/opencode/mcp-reconcile.timer.test.ts` | `has no timer until dirty and stops retrying once idle peers are reconciled` |
| LOG | `app/src/main/infra/log/file-transport.test.ts` | `arms flush only for buffered writes and clears the timer on explicit flush and close` |
| ADMIT | `app/src/main/adapters/opencode/v1/mcp-control.test.ts` | `wakes unsafe admission immediately on activity signals and cleans up aborted waits` |
| SIGNALS | `app/src/main/app/bootstrap.native-history.test.ts` | `forwards each activity and lease change to project sync and the OpenCode admission signal` |
| SDK | `app/src/main/adapters/claude/sdk.test.ts` | `shares one cold import across consumers and first-use controls` |
| TOOLS | `app/src/main/adapters/claude/runtime-tools.test.ts` | `서버 식별자를 하나로 사용한다` |
| PREFETCH | `app/src/main/app/bootstrap.opencode-warmup.test.ts` | `finishes boot before the SDK prefetch settles` |
| CANON | `app/src/main/adapters/claude/canonical-consumers.test.ts` | `keeps project revisions independent of nested object key order while detecting changed values` |
| DEDUPE | `app/src/main/adapters/claude/canonical-consumers.test.ts` | `deduplicates a provider message whose only change is nested object insertion order` |
| MAP | `app/src/main/adapters/claude/native-history-map.test.ts` | `keeps text/thinking/tools in one assistant response and never makes a tool-result user bubble` |
| CLAUDE | `app/src/main/adapters/common/registry.availability.test.ts` | `keeps Claude usable independently of its CLI installed flag` |

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-02 | start 초입 확인 | EP-02′ #1 start 초입 확인 | 1/1 | BOOT — deferred 중 db-init 실행 | 확인 미완/DB 완료 | 없음 |
| VP-02 | finish 직전 합류 | EP-02′ #2 finish 직전 합류 | 1/1 | BOOT — start 미완 → resolve 뒤 완료 | 미완/완료 분리 | 없음 |
| VP-02 | refresh 합류 | EP-02′ #3 refresh 합류 | 1/1 | JOIN — 동시 refresh 2+settled → probe 1 | missing → 1.18.27 | 없음 |
| VP-02 | 설치 종료 refresh | EP-02′ #4 설치 종료 refresh | 1/1 | INSTALL — install 종료 뒤 refresh(opencode) 1 | backend opencode | 없음 |
| VP-03 | boot 시드 | EP-03 #1 boot 시드 | 1/1 | SEED — 4 상태 × backend 시드·설정 쓰기 0 | missing/unsupported/failed/usable | 없음 |
| VP-03 | Landing draft 재시드 | EP-03 #2 Landing draft 재시드 | 1/1 | DRAFT — 빈 OpenCode → Claude·자동 모델 설정 쓰기 0 | draft/saved/Claude 구별 | 없음 |
| VP-03 | ProjectLanding draft 재시드 | EP-03 #3 ProjectLanding draft 재시드 | 1/1 | DRAFT — 프로젝트 draft → Claude | pendingProjectId=project | 없음 |
| VP-03 | ChatTile composer | EP-03 #4 ChatTile composer | 1/1 | NOTICE — idle 안내·active controls·Claude 유지 | OpenCode/Claude 맞바꿈 검출 | 없음 |
| VP-03 | ModelMenu supported | EP-03 #5 ModelMenu supported | 1/1 | MENU — Claude 항목 1·OpenCode 0 | supported true/false | 없음 |
| VP-03 | modelSelection | EP-03 #6 modelSelection | 1/1 | SELECT — Claude 선택·OpenCode 고정 시 null | OpenCode 먼저, Claude 뒤 | 없음 |
| VP-03 | Composer 메뉴 조건 | EP-03 #7 Composer 메뉴 조건 | 1/1 | COMPOSER — 미지원 OpenCode 대신 Claude 모델 선택 | 서로 다른 model/provider | 없음 |
| VP-03 | EngineCard 사유 배지 | EP-03 #8 EngineCard 사유 배지 | 1/1 | CARD — missing 문구·정상 카드 기존 표시 | missing/사유 없음 | 없음 |
| VP-03 | AgentEnvironmentView 추가 | EP-03 #9 AgentEnvironmentView 추가 | 1/1 | ADD — OpenCode disabled·Claude modal 가능 | 하네스별 disabled 구별 | 없음 |
| VP-03 | agentStore push 구독 | EP-03 #10 agentStore push 구독 | 1/1 | AGENT — 실제 API push 1 → 재조회 1·dispose 해제 | initial → after-change | 없음 |
| VP-04 | 변화만 통지 | EP-04′ #1 변화만 통지 | 1/1 | JOIN — 같은 결과 재확인 emit 증가 0 | missing → ready | 없음 |
| VP-04 | 진행 중 직전 상태 | EP-04′ #2 진행 중 직전 상태 | 1/1 | JOIN — deferred 동안 missing 유지 | 직전 missing/다음 ready | 없음 |
| VP-04 | focus identity | EP-04′ #3 focus identity | 1/1 | FOCUS — 동일 identity probe 0·변경 시 1 | bin:1/bin:2·ready/unsupported | 없음 |
| VP-04 | focus 등록·해제 | EP-04′ #4 focus 등록·해제 | 1/1 | BOOT — callback 호출 1·shutdown removeListener | browser-window-focus | 없음 |
| VP-04 | 설정 경로·수동 recheck | EP-04′ #5 설정 경로·수동 recheck | 1/1 | PATH + INSTALL — 경로 변경만 1·IPC backend 인자 유지 | top-level harnesses/다른 키 | 없음 |
| VP-05 | 설치 캐시 정의 | EP-05′ #1 설치 캐시 정의 | 1/1 | JOIN + CLAUDE — OpenCode usable 결과·Claude 설치 독립성 | Claude installed false/true 모두 usable true | 없음 |
| VP-05 | 설치 확인 입력 | EP-05′ #2 설치 확인 입력 | 1/1 | JOIN — 동시 수요 추가 probe 0 | 동시 refresh/settled | 없음 |
| VP-05 | 결과 캐시 쓰기 | EP-05′ #3 결과 캐시 쓰기 | 1/1 | JOIN — ready installed/version 보존 | installed=true/version=1.18.27 | 없음 |
| VP-05 | list/availability 읽기 | EP-05′ #4 list/availability 읽기 | 1/1 | JOIN — settled payload 키·값 동등 | missing 사유/ready 버전 | 없음 |
| VP-05 | Host 주석·직접 probe 제거 | EP-05′ #5 Host 주석·직접 probe 제거 | 1/1 | gate:S05d — app isInstalled 직접 호출·언급 0 | scan/sites.sh 원문 | 없음 |
| VP-05 | Host installed | EP-05′ #6 Host installed | 1/1 | HOST — 직접 probe 0·settled 값 반환 | installed false/true+버전 | 없음 |
| VP-05 | warmup installed gate | EP-05′ #7 warmup installed gate | 1/1 | WARM — 미설치 prepare 0·설치 후 1 | attempt 미소비 | 없음 |
| VP-05 | backend:list | EP-05′ #8 backend:list | 1/1 | INSTALL — 기존 installed/version·추가 usable/사유 | Claude 3.0/OpenCode missing | 없음 |
| VP-05 | agent:list settings | EP-05 #9 agent:list settings | 1/1 | ROWS — 미지원 false+사유·Claude 유지 | settings/runtime 별도 fixture | 없음 |
| VP-05 | models.ts supported | EP-05 #10 models.ts supported | 1/1 | ROWS — 동일 handler의 실제 toAgentEnvironments 실행 | OpenCode false/Claude true | 없음 |
| VP-05 | runtime-catalog supported | EP-05 #11 runtime-catalog supported | 1/1 | CACHE + ROWS — 캐시 행 false↔true 갱신 | 설치 후 모델 재조회 없음 | 없음 |
| VP-05 | composer preparation | EP-05 #12 composer preparation | 1/1 | PREP — unavailable stage·get/acquire 0 | OpenCode missing | 없음 |
| VP-05 | auth.connectAll Host edge | EP-05 #13 auth.connectAll Host edge | 1/1 | HOST — Host listModels unavailable probe 0 | login-free 기존 전 케이스 실행 | 없음 |
| VP-05 | warmup 생성·재개 배선 | EP-05 #14 warmup 생성·재개 배선 | 1/1 | RESUME — missing 건너뜀·registry 변화 뒤 준비 1 | real registry subscription | 없음 |
| VP-05 | global watch 생성·정리 | EP-05′ #15 global watch 생성·정리 | 1/1 | WATCH — 부팅 방송 0·늦은 활성화 방송 1·revision 증가 | usable/missing/재활성화 | 없음 |
| VP-06 | 0034 raw_json 열 | EP-06 #1 0034 raw_json 열 | 1/1 | RAW + gate:migration — 새 열 왕복·migration sync 통과 | 과거 migration 무수정 | 없음 |
| VP-06 | replace SQL | EP-06 #2 replace SQL | 1/1 | RAW — raw_json 저장·lean payload | raw 6종 JSON | 없음 |
| VP-06 | replace 입력 타입 | EP-06 #3 replace 입력 타입 | 1/1 | RAW — rawJson 인자 수용 | raw-text/false/null | 없음 |
| VP-06 | replace 실행 | EP-06 #4 replace 실행 | 1/1 | RAW — raw_json 읽기 값 동등 | object/array/number | 없음 |
| VP-06 | get SELECT | EP-06 #5 get SELECT | 1/1 | RAW — raw_json 반환 키 없음 | display payload만 조회 | 없음 |
| VP-06 | row 타입 | EP-06 #6 row 타입 | 1/1 | gate:typecheck — node/web/test 3구성 오류 0 | SELECT 형상 유지 | 없음 |
| VP-06 | raw(sessionId) | EP-06 #7 raw(sessionId) | 1/1 | RAW — JSON 값 왕복 | 6종 원형 보존 | 없음 |
| VP-06 | compactLegacyRaw | EP-06 #8 compactLegacyRaw | 1/1 | RAW — 분리 changes 1 → 0·표시 동일 | array/object/string/number/bool/null | 없음 |
| VP-06 | native-sync writer | EP-06 #9 native-sync writer | 1/1 | WRITE — payload raw 키 없음·rawJson 별도 | 비어 있지 않은 raw sentinel | 없음 |
| VP-06 | previous lazy raw | EP-06 #10 previous lazy raw | 1/1 | WRITE — 조회 전 0·요청 후 1 | legacy 내장 raw도 지원 | 없음 |
| VP-06 | reader messages | EP-06 #11 reader messages | 1/1 | RAW + RECOVER — 분리 뒤 본문 동일·복구 prompt 유지 | display remains/retained source question | 없음 |
| VP-06 | session:load 순서 | EP-06 #12 session:load 순서 | 1/1 | LOAD — compact → load·다음 refresh busy 아님 | 호출 순서 로그 | 없음 |
| VP-06 | previous.raw 포트 | EP-06 #13 previous.raw 포트 | 1/1 | APPEND — lazy raw 함수로 append 동치 | raw가 없는 lean snapshot | 없음 |
| VP-06 | Claude append 조건 | EP-06 #14 Claude append 조건 | 1/1 | APPEND — unchanged·조건 거짓 raw 0 | identity/newline/offset/projectionVersion | 없음 |
| VP-06 | Claude raw 사용 | EP-06 #15 Claude raw 사용 | 1/1 | APPEND — 검증된 append raw 1·전체 파싱과 동등 | 추가 user/assistant 둘 | 없음 |
| VP-06 | OpenCode/Claude raw 생산 | EP-06 #16 OpenCode/Claude raw 생산 | 1/1 | OCARCHIVE + APPEND — OpenCode raw={session,messages}·Claude 원형 재사용 | 두 생산자 분리 검증 | 없음 |
| VP-07 | renderer minify | EP-07 #1 renderer minify | 1/1 | gate:bundle — entryMinified=true·1,283,482B | 압축 제거 결함 검출 | 없음 |
| VP-07 | UsageTab lazy/Suspense | EP-07 #2 UsageTab lazy/Suspense | 1/1 | CHART + gate:bundle — recharts 진입 0B·자리→차트 | 동일 높이 180px | 없음 |
| VP-07 | TokensPerDayChart | EP-07 #3 TokensPerDayChart | 1/1 | CHART — 같은 접근성 차트 표시 | 차트 구현 무변경 | 없음 |
| VP-07 | syntax segmented import | EP-07 #4 syntax segmented import | 1/1 | SYNTAX + gate:bundle — shiki 진입 0B·자산 21 | 11언어×2테마 기존 출력 동등 | 없음 |
| VP-08 | projection head/tail | EP-08 #1 projection head/tail | 1/1 | GOLD — 원본 생성 golden 3종 동등 | 도구/산출물/미완료 | 없음 |
| VP-08 | meta lazy copy | EP-08 #2 meta lazy copy | 1/1 | MEMO + COPY — 렌더 계산 0·클릭 문자열 동일 | 두 문단 개행 보존 | 없음 |
| VP-08 | live text 구독 | EP-08 #3 live text 구독 | 1/1 | MEMO — live 5회 변경 tail 6회 | text 길이 1..5 | 없음 |
| VP-08 | live reasoning 구독 | EP-08 #4 live reasoning 구독 | 1/1 | MEMO — tail 인자에 live reasoning 갱신값 전달 | text=12345/reasoning=thought 12345 | 없음 |
| VP-08 | head memo | EP-08 #5 head memo | 1/1 | MEMO — head 1·tail 6 | messages 동일 identity | 없음 |
| VP-08 | 보존 행 lookup | EP-08 #6 보존 행 lookup | 1/1 | INDEX — 모든 row key 인덱스 일치 | head/tail/missing 구별 | 없음 |
| VP-08 | 앵커 lookup | EP-08 #7 앵커 lookup | 1/1 | INDEX — 누락 key=-1 | 기존 selection 스위트 함께 실행 | 없음 |
| VP-08 | 선택 행 lookup | EP-08 #8 선택 행 lookup | 1/1 | INDEX — 선택 완료→해제 기존 동작 유지 | Timeline.selection.test.ts 1케이스 | 없음 |
| VP-09 | project sync timer | EP-09 #1 project sync timer | 1/1 | TIMER — 10s idle targets 0·신호마다 tick 1 | pending 재시도 뒤 timer 0 | 없음 |
| VP-09 | MCP reconcile timer | EP-09 #2 MCP reconcile timer | 1/1 | MCP — idle 0·dirty busy 재시도·완료 0 | close 타이머 해제 | 없음 |
| VP-09 | file log timer | EP-09 #3 file log timer | 1/1 | LOG — 첫 write에만 timer·flush/close 0 | 버퍼 0/비어 있지 않음 | 없음 |
| VP-09 | MCP admission wait | EP-09 #4 MCP admission wait | 1/1 | ADMIT — 시간 진행 없이 신호로 수행·abort reject | 500ms 상한 유지 | 없음 |
| VP-09 | activity broadcast 배선 | EP-09 #5 activity broadcast 배선 | 1/1 | SIGNALS — 방송 1 → project/adapter 신호 각각 1 | 서로 다른 spy | 없음 |
| VP-09 | lease 배선 | EP-09 #6 lease 배선 | 1/1 | SIGNALS — lease 이벤트 → leasesChanged 1 | activity와 별도 spy | 없음 |
| VP-10 | SDK memo loader | EP-10 #1 SDK memo loader | 1/1 | SDK — 동시 promise 동일·factory 1 | cold import gate | 없음 |
| VP-10 | adapter query | EP-10 #2 adapter query | 1/1 | gate:bundle + SDK — SDK 정적 require 0·warm mock 호환 | cold control sentinel-model | 없음 |
| VP-10 | runtime-tools factory | EP-10 #3 runtime-tools factory | 1/1 | TOOLS — 주입 함수·handler 결과 기존 동작 | 서버명 records | 없음 |
| VP-10 | native-history-map | EP-10 #4 native-history-map | 1/1 | MAP — 기존 SDK history mock 스위트 실행 | 동일 native 메시지 | 없음 |
| VP-10 | bootstrap prefetch | EP-10 #5 bootstrap prefetch | 1/1 | PREFETCH — finish 뒤 loader 1·미완 promise 비대기 | prefetch deferred | 없음 |
| VP-11 | project-settings canonical | EP-11 #1 project-settings canonical | 1/1 | CANON — 키 순서 변경 revision 동일·값 변경 다름 | 중첩 키 순서/값 구별 | 없음 |
| VP-11 | background canonical | EP-11 #2 background canonical | 1/1 | DEDUPE — 같은 uuid·키 순서만 변경한 두 번째 무시 | nested object | 없음 |

- §10 자리 목록 대조: 유효 분모 `4+10+5+15+16+4+8+6+5+2=75`, 위 표 75행이다. `evidence/r1-enforcement.json`의 `(pair, slot)` 집합과 §10 고정 목록의 차집합은 양방향 0행이다.
- §10 자리 목록 밖에서 본 운반 자리: renderer 초기 `backend:list`와 push 경합은 generation fence로 유지하고, runtime 카탈로그 캐시의 `supported`는 조회 시 가용성을 다시 읽는다. 부팅 뒤 가용성 방송·웜업 재개·focus 배선은 RESUME·BOOT·AGENT로 실행했다.
- 통합 기준: 작업 중 공유 main에 착지한 0293을 fast-forward로 포함했다. 문서 충돌 1곳은 ArcSpinner와 지연 복사 설명을 함께 보존했고, 통합 상태에서 정적 검사·번들·전체 vitest를 다시 실행했다.
- 검색 수치 차이: S02a는 새 recheck 트리거를 포함해 3→6이고, S10b 텍스트 검색 4건 중 3건은 `typeof import` 타입이다. 실제 동적 import 식은 loader의 1곳이며 정적 SDK require는 빌드 0, 정적 import 복원 결함에서는 1이었다.
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음 — r1 최초 구현이다. 이번 `합류 제거` 초기 시험의 미검출은 BOOT의 마지막 단계·finish 단언을 보강한 뒤 red 1/복구 green 1로 재실행했다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_BLOCKED | gate:vitest·typecheck·eslint·scripts·migration·docs | 집계 — Windows CI 미실행 |
| VP-02 | REQUIRED | SELF_PASS | BOOT·JOIN·INSTALL | 순차 await·합류 제거 각 red 1 |
| VP-03 | REQUIRED | SELF_PASS | SEED·DRAFT·NOTICE·MENU·SELECT·COMPOSER·CARD·ADD·AGENT | 폴백·하네스 맞바꿈·disabled 뒤집기 각 red 1 |
| VP-04 | REQUIRED | SELF_PASS | JOIN·FOCUS·PATH·BOOT·INSTALL | identity·변화 비교 제거 각 red 1 |
| VP-05 | REQUIRED | SELF_PASS | CLAUDE·HOST·WARM·ROWS·CACHE·PREP·RESUME·WATCH | 소비자 게이트 6자리 red, 복구 green |
| VP-06 | REQUIRED | SELF_PASS | RAW·WRITE·LOAD·APPEND·OCARCHIVE·RECOVER | raw 재합류·분리 순서 변경 각 red 1 |
| VP-07 | REQUIRED | SELF_PASS | gate:bundle·CHART·SYNTAX | 비압축·차트/강조 정적 import 복원 각 gate red |
| VP-08 | REQUIRED | SELF_PASS | GOLD·MEMO·COPY·INDEX·Timeline.selection.test.ts | memo 제거·즉시 복사 계산 각 red 1 |
| VP-09 | REQUIRED | SELF_PASS | TIMER·MCP·LOG·ADMIT·SIGNALS | interval 3·배선 3 결함 모두 red |
| VP-10 | REQUIRED | SELF_PASS | SDK·TOOLS·MAP·PREFETCH·gate:bundle | SDK 정적 import 복원 require 1 |
| VP-11 | REQUIRED | SELF_PASS | CANON·DEDUPE | JSON.stringify 복원 두 자리 각 red 1 |

## [구현자 기입] 이번 라운드 수정의 잠금

각 결함은 원문 바이트를 보관한 뒤 한 자리씩 심고, `finally`에서 복구했다. 테스트 결함은 같은 oracle의 복구 green을 확인했고, 번들 결함은 마지막 복구 빌드에서 모든 기준을 재확인했다. 실행 결과는 `evidence/r1-mutations.json`이다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `VP02-sequential` — `app/src/main/app/bootstrap.ts` | 선택 증거 | 해당 없음(r1) | overlaps the deferred install check with DB initialization, joins before finish, and removes focus listener / 1 | red 1 → 복구 green 1 |
| `VP02-no-join` — `app/src/main/app/bootstrap.ts` | 선택 증거 | 해당 없음(r1) | overlaps the deferred install check with DB initialization, joins before finish, and removes focus listener / 1 | red 1 → 복구 green 1 |
| `VP03-no-seed-fallback` — `app/src/renderer/src/features/chat/store/chatStore.ts` | 선택 증거 | 해당 없음(r1) | seeds Claude for an unavailable lastBackend and keeps ready OpenCode selections / 1 | red 1 → 복구 green 1 |
| `VP03-swapped-harness` — `app/src/renderer/src/features/chat/components/ChatTile.tsx` | 선택 증거 | 해당 없음(r1) | shows an unavailable notice for idle OpenCode while retaining the active turn controls until completion / 1 | red 1 → 복구 green 1 |
| `VP03-add-enabled` — `app/src/renderer/src/features/engine/common/components/AgentEnvironmentView.tsx` | 선택 증거 | 해당 없음(r1) | disables OpenCode additions with an accessible reason and keeps Claude additions usable / 1 | red 1 → 복구 green 1 |
| `VP04-focus-without-identity` — `app/src/main/adapters/common/registry.ts` | 선택 증거 | 해당 없음(r1) | registry availability SSOT focus probes only a changed missing/failed identity, never a ready/unsupported installation / 1 | red 1 → 복구 green 1 |
| `VP04-duplicate-broadcast` — `app/src/main/adapters/common/registry.ts` | 선택 증거 | 해당 없음(r1) | registry availability SSOT joins concurrent refresh/settled consumers, retains previous state and emits only changes / 1 | red 1 → 복구 green 1 |
| `VP05-host-direct-probe` — `app/src/main/app/harness-host.ts` | 선택 증거 | 해당 없음(r1) | createHostHarnessPort (0291 AR-02) installed reads the settled registry state and missing harnesses are not installed · blocks model probes for an installed unsupported CLI without changing installed semantics / 2 | red 2 → 복구 green 3 |
| `VP05-warmup-no-gate` — `app/src/main/app/harnesses/opencode/warmup.ts` | 선택 증거 | 해당 없음(r1) | does not consume its one warmup attempt while unavailable and prepares after installation / 1 | red 1 → 복구 green 1 |
| `VP05-settings-no-gate` — `app/src/main/app/handlers/misc.ts` | 선택 증거 | 해당 없음(r1) | gates settings and runtime OpenCode rows and preserves Claude without starting unavailable catalogs / 1 | red 1 → 복구 green 1 |
| `VP05-runtime-no-gate` — `app/src/main/features/harnesses/common/runtime-catalog.ts` | 선택 증거 | 해당 없음(r1) | updates cached runtime row availability in both directions without refetching models / 1 | red 1 → 복구 green 1 |
| `VP05-preparation-no-gate` — `app/src/main/app/composer-catalog.ts` | 선택 증거 | 해당 없음(r1) | rejects unavailable OpenCode preparation before resolving or acquiring a native server / 1 | red 1 → 복구 green 1 |
| `VP05-watch-no-gate` — `app/src/main/app/bootstrap.ts` | 선택 증거 | 해당 없음(r1) | starts OpenCode global observation only when usable and sends one increasing revision for each later activation / 1 | red 1 → 복구 green 1 |
| `VP06-raw-rejoined` — `app/src/main/features/history/native-sync.ts` | 선택 증거 | 해당 없음(r1) | writes lean display payload while preserving raw separately and reads raw only on demand / 1 | red 1 → 복구 green 1 |
| `VP06-load-before-split` — `app/src/main/app/handlers/session.ts` | 선택 증거 | 해당 없음(r1) | splits legacy raw before the handler loads messages and leaves the next refresh usable / 1 | red 1 → 복구 green 1 |
| `VP08-no-head-memo` — `app/src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.tsx` | 선택 증거 | 해당 없음(r1) | projects the committed head once and the live tail six times without computing copy text / 1 | red 1 → 복구 green 1 |
| `VP08-eager-copy` — `app/src/renderer/src/features/chat/harnesses/opencode/transcript/projection.ts` | 선택 증거 | 해당 없음(r1) | projects the committed head once and the live tail six times without computing copy text / 1 | red 1 → 복구 green 1 |
| `VP09-project-interval` — `app/src/main/app/project-resource-sync.ts` | 선택 증거 | 해당 없음(r1) | has no idle timer or target scans, and activity/lease signals each tick once / 1 | red 1 → 복구 green 1 |
| `VP09-mcp-interval` — `app/src/main/app/harnesses/opencode/mcp-reconcile.ts` | 선택 증거 | 해당 없음(r1) | has no timer until dirty and stops retrying once idle peers are reconciled / 1 | red 1 → 복구 green 1 |
| `VP09-log-interval` — `app/src/main/infra/log/file-transport.ts` | 선택 증거 | 해당 없음(r1) | arms flush only for buffered writes and clears the timer on explicit flush and close / 1 | red 1 → 복구 green 1 |
| `VP09-no-project-activity-signal` — `app/src/main/app/bootstrap.ts` | 선택 증거 | 해당 없음(r1) | forwards each activity and lease change to project sync and the OpenCode admission signal / 1 | red 1 → 복구 green 1 |
| `VP09-no-adapter-activity-signal` — `app/src/main/app/bootstrap.ts` | 선택 증거 | 해당 없음(r1) | forwards each activity and lease change to project sync and the OpenCode admission signal / 1 | red 1 → 복구 green 1 |
| `VP09-no-lease-signal` — `app/src/main/app/bootstrap.ts` | 선택 증거 | 해당 없음(r1) | forwards each activity and lease change to project sync and the OpenCode admission signal / 1 | red 1 → 복구 green 1 |
| `VP11-project-json` — `app/src/main/adapters/claude/project-settings.ts` | 선택 증거 | 해당 없음(r1) | keeps project revisions independent of nested object key order while detecting changed values / 1 | red 1 → 복구 green 1 |
| `VP11-background-json` — `app/src/main/adapters/claude/background.ts` | 선택 증거 | 해당 없음(r1) | deduplicates a provider message whose only change is nested object insertion order / 1 | red 1 → 복구 green 1 |
| `VP07-no-minify` — `app/electron.vite.config.ts` | 선택 증거 | 해당 없음(r1) | gate:bundle entryMinified=false | gate red → 최종 복구 build green |
| `VP07-static-chart` — `app/src/renderer/src/features/settings/components/UsageTab.tsx` | 선택 증거 | 해당 없음(r1) | gate:bundle recharts=363005B | gate red → 최종 복구 build green |
| `VP07-static-shiki` — `app/src/renderer/src/shared/ui/markdown/syntax.ts` | 선택 증거 | 해당 없음(r1) | gate:bundle shiki=166807B | gate red → 최종 복구 build green |
| `VP10-static-sdk` — `app/src/main/adapters/claude/adapter.ts` | 선택 증거 | 해당 없음(r1) | gate:bundle sdkRequire=1 | gate red → 최종 복구 build green |
| `N01-focus-wiring` — `app/src/main/app/bootstrap.ts` | 새 oracle 민감도 | 해당 없음(r1) | overlaps the deferred install check with DB initialization, joins before finish, and removes focus listener / 1 | red 1 → 복구 green 1 |
| `N02-availability-broadcast` — `app/src/main/app/bootstrap.ts` | 새 oracle 민감도 | 해당 없음(r1) | broadcasts a changed availability once and resumes skipped warmup and observation through the real registry subscription / 1 | red 1 → 복구 green 1 |
| `N03-warmup-resume` — `app/src/main/app/bootstrap.ts` | 새 oracle 민감도 | 해당 없음(r1) | broadcasts a changed availability once and resumes skipped warmup and observation through the real registry subscription / 1 | red 1 → 복구 green 1 |
| `N04-default-agent-subscription` — `app/src/renderer/src/shared/stores/agentStore.ts` | 새 oracle 민감도 | 해당 없음(r1) | wires the production agent store to the harness API and refreshes changed availability once / 1 | red 1 → 복구 green 1 |
| `N05-sdk-memo` — `app/src/main/adapters/claude/sdk.ts` | 새 oracle 민감도 | 해당 없음(r1) | shares one cold import across consumers and first-use controls / 1 | red 1 → 복구 green 1 |
| `N06-eager-raw` — `app/src/main/adapters/claude/native-history.ts` | 새 oracle 민감도 | 해당 없음(r1) | reads separated raw only for a proven append and keeps the full-parse result unchanged / 1 | red 1 → 복구 green 1 |
| `N07-backend-before-seed` — `app/src/renderer/src/app/boot/steps.ts` | 새 oracle 민감도 | 해당 없음(r1) | initializes backend availability before seeding the remembered OpenCode draft (undefined), without writing settings / 1 | red 1 → 복구 green 4 |
| `N08-claude-gated-by-cli` — `app/src/main/adapters/common/registry.ts` | 새 oracle 민감도 | 해당 없음(r1) | registry availability SSOT keeps Claude usable independently of its CLI installed flag (false) · registry availability SSOT keeps Claude usable independently of its CLI installed flag (true) / 2 | red 2 → 복구 green 2 |

- 분모 검산: 선택 증거 29 · 인용 변이 0 · 중복 제외 새 oracle 8 = 표 37행. 선택 증거와 같은 자리의 새 0건·배선 oracle은 그 29행에 함께 귀속했다.
- 덮개 회귀: 해당 없음 — 이전 verify 장치 교체는 없다. 초기 합류 oracle 보강 후 순차 await와 합류 제거 두 결함을 모두 재실행했다.
- 그 밖의 직접 행동 oracle: 해당 없음 — 추가 임의 변이를 요구하지 않는다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 유지 — 미설치·미지원·확인 실패 사유를 Notice·EngineCard·추가 메뉴가 소비한다(NOTICE·CARD·ADD) | Windows 설치본 시각 확인 대기 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 유지 — focus listener·global watch·수요 timer를 shutdown/close에서 해제한다(BOOT·WATCH·TIMER·MCP·LOG) | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 일치 — 사용 불가 기존 세션은 안내, 새 빈 draft는 Claude, 진행 중인 요청·승인은 유지한다(NOTICE·DRAFT) | 없음 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 유지 — 다시 확인 버튼은 recheck IPC를 호출하고, 비활성 추가 항목에 사유·aria-disabled를 표시한다(NOTICE·INSTALL·ADD) | 없음 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 방지 — registry identity·agentStore seq·availability generation이 오래된 결과를 버린다 | registry stale-result·agentStore out-of-order 기존/신규 테스트 실행 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `json_extract`는 string·boolean raw의 JSON 표현을 잃는다 | 선조치 — `payload_json -> '$.raw'`로 JSON 표현을 보존하고 null을 COALESCE한다 | RAW 6형식 왕복·두 번째 compact 0 |
| 2 | 자동 Claude 모델 선택이 폴백 직후 lastBackend를 덮어쓸 수 있다 | 선조치 — 자동 폴백 flag를 유지하고 명시 선택만 기록한다 | DRAFT 자동 설정 쓰기 0·explicit 쓰기 1 |
| 3 | warm Query를 proxy로 감싸면 선택 메서드 존재 여부·동기 시점이 바뀐다 | 선조치 — 이미 로드됐으면 원래 Query를 직접 반환, cold 경로만 대기 proxy 사용 | SDK cold control·close 시험과 기존 SDK mock 파일 실행 |
| 4 | runtime 캐시 행이 설치 후에도 supported:false로 남을 수 있다 | 선조치 — list 시 registry usable을 재평가한다 | CACHE false↔true·모델 재조회 증가 0 |
| 5 | 새 global watch가 revision을 1로 재시작하면 renderer가 변화를 놓칠 수 있다 | 선조치 — Bootstrap이 활성화 사이에도 단조 revision을 소유한다 | WATCH 재활성화 때 revision 증가 |
| 6 | 구버전 앱이 새 migration DB를 연다는 §17의 설명은 기존 unknown-migration guard와 다르다 | 보고만 — 기존 downgrade 보호 정책을 바꾸지 않았다 | `app/src/main/infra/db/migrate.ts` unknown migration 거절·기존 migrate 테스트 |
| 8 | 통합 전체 실행에서 기존 bootstrap 설정 케이스가 일시 실패했다 | 보고만 — 같은 코드 파일 재실행 3회 각각 24/24, 원인 미확정 | `evidence/r1-full-electron-failed-ids.txt`·`r1-rechecks.json` |
| 7 | Windows CI와 실제 설치본 동작은 Linux 단위 검사로 확정할 수 없다 | 보고만 — AC1을 ⚠️로 유지한다 | `gh auth status`: GH_TOKEN invalid · Windows CI 실행 도구 없음 |

최종 계약 대조에서 Claude가 CLI 설치 판정 때문에 차단되는 누락을 선조치했다. CLAUDE의 설치 true/false 두 케이스는 이전 조건 복원에서 red 2, 수정 복구에서 green 2였다.

첫 전체 실행은 8346 pass/25 fail이었다. 새 2건 중 raw oracle은 배열 대신 기존 `{session,messages}` 원형으로 정정했고, 강조 oracle은 단독 22케이스 통과를 확인한 뒤 wall-clock 토큰화 제한을 동치 검사에서 제외했다. production 변경 없이 관련 22케이스를 다시 통과한 다음 전체 실행을 반복했다.

### 설계 대비 명시적 차이

- 기술 조정 — SQL은 JSON 원형을 보존하는 `->` 연산자를 썼다. `APPEND`·`RAW`가 값·지연 조건을 다시 단언한다.
- 기술 조정 — `LiveTurn` 동기 포트는 유지하고 cold Query만 지연 생성했다. SDK 로드 실패는 pending을 비워 다음 수요가 재시도한다.
- 기술 조정 — settings patch의 실제 키는 top-level `harnesses`다. 이전 executablePath와 비교해 경로 변경 때만 재확인한다(PATH).
- 기술 조정 — 확정 head는 inflight를 읽지 않아 memo 의존성에서 제외했다. 완료/선택 보존은 GOLD·Timeline.selection 테스트로 확인했다.
- 테스트 조정 — SYNTAX는 양쪽에 `tokenizeTimeLimit:0`을 적용해 부하 의존 500ms cutoff와 문법 동치를 분리했다. 제품의 기본 시간 제한은 바꾸지 않았다.
- 커밋 조정 — 공유 bootstrap·포트·IPC 타입이 함께 바뀌므로 WP별 중간 비정합 스냅샷 대신 하나의 구현 커밋으로 인계한다. 작업 범위는 WP-7→1→2→3→4→5→6→8 전부다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | import 거절 promise가 영구 고착될 수 있음 | loader catch에서 pending 해제·AC21 cold import/close 시험 |
| 공유 | 여러 소비자가 SDK import·가용성 상태를 중복 생성할 수 있음 | AC3′·AC21 / EP-02′ #3·EP-10 #1 — JOIN·SDK 동일 promise/확인 1회 |
| 재진입 | SDK import 전 close·설치 중 재확인·이전 watch 정리가 새 요청을 오염시킬 수 있음 | AC4′·AC9·AC21 — SDK close·registry stale identity·WATCH 재활성화 시험 |
| 다른 무효화 축 | 실행 파일 설정·runtime 캐시·push 뒤 오래된 최초 목록의 갱신 축이 다름 | AC4′·AC6′·AC7 — PATH·CACHE·SEED·agentStore seq 시험 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | WP 8묶음의 production·테스트·문서. `evidence/r1-enforcement.json`에 75자리와 oracle 대응을 보관했다. |
| 실행 명령 | `gate:vitest`: `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron ./node_modules/vitest/vitest.mjs run --reporter=json --outputFile=<report>`; 모든 app 명령은 `cd app`. |
| 관측한 게이트 산출 | typecheck 3구성 오류 0; eslint 오류 0/기존 warning 2.<br>vitest 908파일·8365 pass/24 fail, 기준선 8286 pass/23 fail 대비 파일 재확인 24케이스×3회 green 뒤 새 실패 ID 0; scripts 144/144.<br>migration sync·no-copies·v0.3.1 append-only, budget 16, docs generated/prose/links; bundle 1,283,482B·21자산·SDK require 0. 세부 `evidence/r1-gates.json`. |
| V-pair 자기확인 | SELF_PASS 10 · SELF_BLOCKED 1(VP-01 Windows CI). 독립 verify 판정은 하지 않았다. |
| 강제 지점 전수 | 고정 목록 75·보고 75·양방향 차집합 0. 자리별 표의 oracle은 전체 실행 결과와 대조했다. |
| AC 자기보고 | 아래 23행. AC1은 Windows CI와 전체 실행의 일시 실패 1건 기록이 남았다. |
| 합계 검산 | ✅ 22 · ⚠️ 1 · ❌ 0 = 총 23. Criteria-Met 22/23. |
| 블로커 / 역질문 | PLAN_GAP 없음. Windows CI·설치본 사람 실기 대기. 질문 없음. |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

`gate:typecheck = npm run typecheck`; `gate:eslint = ./node_modules/.bin/eslint ./src ./scripts`(무수정); `gate:scripts = node --test scripts/*.test.mjs`; `gate:migration = node scripts/check-migrations-appendonly.mjs`; `gate:docs = node scripts/check-doc-inventory.mjs --check`; `gate:budget = node scripts/check-test-budgets.mjs`.
`gate:bundle = ./node_modules/.bin/electron-vite build --sourcemap --outDir <t>` + `node ../docs/handoff/0292-deep-optimization/scan/bundle-measure.mjs <t>` + main SDK require 개수. `gate:S05d`는 같은 디렉터리의 `scan/sites.sh` S05d 결과다.

| AC | 자기보고 | 이번 턴 관측 |
|---|---|---|
| AC1 | ⚠️ | vitest 908파일·8365 pass/24 fail, 기준선 8286 pass/23 fail 대비 파일 재확인 24케이스×3회 green 뒤 새 실패 ID 0 · Windows CI 미실행 |
| AC2′ | ✅ | BOOT: deferred 중 DB 실행·finish 0·resolve 뒤 완료; 두 등록 변이 red |
| AC3′ | ✅ | JOIN·server 동시 version 기존 케이스: 동시 수요 1회 합류 |
| AC4′ | ✅ | FOCUS·PATH·JOIN·BOOT: identity 조건·직전 값·통지·정리 |
| AC5′ | ✅ | INSTALL·preload/harness.test.ts: 기존 키+가산 키·push·recheck |
| AC6′ | ✅ | ROWS·CACHE·AGENT: settings/runtime usable 및 변화 재조회 1 |
| AC7 | ✅ | SEED 4상태·DRAFT 프로젝트/새 칸·NOTICE·MENU·SELECT·COMPOSER |
| AC8 | ✅ | ADD·CARD: disabled·사유·Claude 항목 유지 |
| AC9 | ✅ | HOST·WARM·PREP·WATCH·RESUME: 미사용 0·가용성 전환 재개 |
| AC10 | ✅ | entryMinified=true·1,283,482B ≤ 1,500,000 |
| AC11 | ✅ | recharts entry 0B·CHART 자리→같은 차트 |
| AC12 | ✅ | shiki entry 0B·자산 21 ≤ 60·SYNTAX 11×2 동등·package/lock diff 0 |
| AC13 | ✅ | GOLD 3종·MEMO head 1/tail 6/copy 0·COPY 클릭 문자열 |
| AC14 | ✅ | INDEX 각 row key·missing=-1·기존 Timeline.selection 1케이스 |
| AC15 | ✅ | RAW·WRITE: 새 raw_json·payload raw 키 없음 |
| AC16 | ✅ | RAW changes 1→0·LOAD 분리→로드·refresh busy 아님 |
| AC17 | ✅ | APPEND raw 0/1·전체 파싱 동치·OCARCHIVE raw 보존·RECOVER 원본 삭제 복구 |
| AC18 | ✅ | TIMER 10s idle targets 0·대기 재시도·신호 tick |
| AC19 | ✅ | MCP dirty timer만·ADMIT 신호 진행/abort |
| AC20 | ✅ | LOG write 전 0·write 후 flush·close/flushSync |
| AC21 | ✅ | SDK memo/cold close·MAP·TOOLS·PREFETCH 비대기·빌드 require 0 |
| AC22 | ✅ | CANON revision 동등/값 변화·DEDUPE 순서만 변경 무시 |
| AC23 | ✅ | gate:docs generated/prose/links 통과·IPC 2채널·raw_json·Notice·스택 복원 문서 존재 |

합계 검산: 유효 AC 23행을 다시 세어 ✅ 22 · ⚠️ 1 · ❌ 0 = 23. 상태 사본: plan `IMPL_DONE (r1 · Windows CI 대기)` / INDEX `impl·IMPL_DONE`·다음 Claude·구현 좌표 자리표시자.

## [구현자 기입] Review Signals — 사실만

- Claude 제외 조건(D-006·AC6′)은 기존 fixture가 설치 true만 주어 드러나지 않았다. 설치 false와 명시적 usable false를 구별 값으로 추가했다.
- r1 최초 구현이며 이전 verify 라운드는 없다. 이번 같은 턴의 합류 oracle 미검출은 `finish` 경계 단언 보강으로 바로 재검출했다.
- plan EP-02′ #2는 합류를 명시했다. 초기 테스트는 DB 초기화 직후만 보아 뒤의 await들이 만든 지연과 실제 join을 구별하지 못했다.
- 제약 환경은 Node 24와 설치 SQLite의 Electron ABI 차이다. 기존 Electron을 Node 모드로 실행해 DB를 포함한 동일 기준선·완료 검사를 수행했고 ABI 재빌드는 하지 않았다.
- 통합 전체 실행의 일시 실패 1건은 동일 코드 파일 재실행 3회에서 재현되지 않았다. 원인을 확정하지 않았고 원문 실패 ID와 재확인 결과를 함께 보관했다.
- GitHub CLI 인증 실패로 Windows CI를 실행하지 못했다. 작업 브랜치 push와 독립 검증 인계를 수행하며 PR은 생성하지 않는다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | 확인 시작이 `start()` 첫 await(`bootstrap.ts:609`) 전이라는 위치를 아무 테스트도 잠그지 않는다 — 시작을 `workspace` 단계 앞으로 옮긴 X03이 전체 스위트 green | VP-02 · EP-02′ #1 · AC2′ | `start()` 호출 직후·첫 await 전에 `refreshInstallState` 1회를 단언(X03 red) | BLOCKING (PAIR_FAIL) | open |
| D2 | store 변화 → `applyHarnessAvailability` 구독(`ChatProvider.tsx:12`)이 잠기지 않는다 — DRAFT는 함수를 직접 부른다(X02) | VP-03 · EP-03 #2·#3 · AC7 | 가용성 push(또는 store 갱신)만으로 빈 OpenCode 칸이 Claude로 재시드되는지 단언 | BLOCKING (PAIR_FAIL) | open |
| D3 | Notice의 "다시 확인" 클릭 → `harness:recheck(backend)`(X12·X56), pending 요청 중 Composer 유지(X15), 사유별 문구(X63)가 잠기지 않는다 | VP-03 · EP-03 #4 · AC7 | 클릭 1회 → `recheck('opencode')` 1회, `pendingAsks`·승인·plan review 각각 Composer 유지, `unsupported`·`failed` 문구를 단언 | BLOCKING (PAIR_FAIL) | open |
| D4 | EngineCard 배지(X13)·추가 메뉴 툴팁(X62) 사유가 기본값 `missing`으로만 검증된다 | VP-03 · EP-03 #8·#9 · AC8 | 기본값과 다른 `unsupported`·`failed` 입력으로 문구·툴팁을 단언 | BLOCKING (PAIR_FAIL) | open |
| D5 | `failed` 상태의 focus 재확인(X04)과 OpenCode `executableIdentity` 생산자(`server.ts:172`, X41)가 잠기지 않는다 | VP-04 · EP-04′ #3 · AC4′ | `failed` + identity 변경 → refresh 1, 실제 server pool identity가 실행 파일 교체·경로 변경에 따라 달라지는지 단언 | BLOCKING (PAIR_FAIL) | open |
| D6 | 경로 변경 재확인의 bootstrap 배선(`bootstrap.ts:717-724`) — 호출(X54)·harness id(X55)·초기 경로(X59) — 이 잠기지 않는다. PATH는 `registerSettingsReactions` 단위다 | VP-04 · EP-04′ #5 · AC4′ | 실제 Bootstrap 조립에서 경로 patch → `refreshInstallState('opencode')` 1, 같은 경로 patch → 0 | BLOCKING (PAIR_FAIL) | open |
| D7 | `agent:list` 사유 항(X64), 가용성 리스너의 `composerPreparation.invalidate()`(X35)·`updateOpenCodeGlobalWatch(ctx, false)` 인자(X36)가 잠기지 않는다. RESUME은 감시 갱신을 mock한다 | VP-05 · EP-05 #9·#14 · EP-05′ #15 · AC6′·AC9 | 기본값과 다른 사유로 행을 단언, 전환 때 준비 무효화와 늦은 활성화 revision 방송 1을 실제 리스너 경로로 단언(무효화가 의도가 아니면 제거 근거를 적는다) | BLOCKING (PAIR_FAIL) | open |
| D8 | meta `copyable`이 잠기지 않는다 — GOLD는 `copyable`을 버리고 비교한다(X01). 판정이 `turnCopyText` 빈 문자열 규칙을 재구현해 `parentToolRunId: ''`에서 갈린다 | VP-08 · EP-08 #2 · AC13 · D-003 | 복사할 텍스트가 없는 턴에 복사 버튼 0을 단언하고 판정을 같은 규칙 1벌에서 파생 | BLOCKING (PAIR_FAIL) | open |
| D9 | SDK import 실패 뒤 `pending` 해제(재시도)가 잠기지 않는다(X27) — 구현 보고 "만료" 축의 근거로 든 시험에 없다 | VP-10 · EP-10 #1 · AC21 | 첫 import 거절 → 두 번째 `loadClaudeSdk()`가 새 import를 시도해 성공함을 단언 | BLOCKING (PAIR_FAIL) | open |
| D10 | VP-04 목록이 path의 방송 채널(`send.ts:27`, X33)·renderer store push 적용(`harnessAvailabilityStore.ts:20`, X68)·초기 목록 fence(`:28`, X05)를 담지 않고 검색이 `registry.ts` 한정·해법 이름 술어다 — 세 고장 모두 전체 스위트 green | VP-04(·VP-03 입력) · AC4′·AC5′·AC7 | 설계자가 VP-04(또는 VP-03 입력) 목록을 방송 → preload → store 적용 → 소비자 재조회까지 한 번에 고정하고 검색 범위를 path 파일로 넓힌다. 고장 3건은 다음 구현이 잠근다 | PLAN_GAP | open |
| D11 | D-007 범위 미정 — 폴백 중 모델 메뉴의 명시 Claude 선택이 `lastBackend`를 기록하는가. production은 기록하지 않고(`Composer.tsx:435-441`이 `explicitHarness`를 넘기지 않음) DRAFT의 기록 단언은 production 호출자 0인 옵션을 쓴다 | VP-03 · D-007·D-003 · AC7 | 설계자가 사용자에게 묻고 D-007·AC7·EP-03 #2를 정정한 뒤 테스트를 production 경로로 맞춘다 | PLAN_GAP | open |
| N1 | §17 "구버전 앱이 같은 DB를 열어도 읽기가 깨지지 않는다"가 기존 `DbSchemaTooNewError` 거절(`migrate.ts:167-168`)과 다르다(구현 보고 #6 확인) | plan 서술 | §17 문장 정정 | NON_BLOCKING | open |
| N2 | `adapters/common/registry.ts:40`이 `backend === 'claude'`로 분기한다 — §16 "구체 하네스 비의존"과 다르다(동작은 CLAUDE 테스트로 잠김) | 비귀속 | adapter가 `usable`을 내거나 `info.usable ?? true`로 하네스 이름 분기 제거 | NON_BLOCKING | open |
| N3 | 죽은 export `useHarnessAvailable`(`harnessAvailabilityStore.ts:30`) · production 호출 0인 `projectTimeline`(`projection.ts:61`)·`agentStore.dispose` | 비귀속 | 정리 후보 | NON_BLOCKING | open |
| N4 | ΔV1 §10 VP-02 목표 "S02a 3 / 3"이 EP-04′ #3·#5의 새 호출자와 맞지 않는다(HEAD 6) | plan 수치 | D10 정정 때 함께 | NON_BLOCKING | open |
| N5 | runtime 행 가용성 게이트(`runtime-catalog.ts:130,164-165`)가 `agent:list` 게이트(`misc.ts:59-61`)와 이중이다 — X57·X65 동치 | 비귀속 | 기록 | NON_BLOCKING | open |
