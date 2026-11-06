# Plan — 0294-slow-runner-hermetic-tests

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**

## 메타

| 항목 | 값 |
|---|---|
| slug | `0294-slow-runner-hermetic-tests` |
| 작성자 | Claude Code |
| 일자 | 2026-11-03 (V1) · 2026-11-04 (ΔV1 · ΔV2) · 2026-11-05 (ΔV3 · ΔV4 · ΔV5 · ΔV6) |
| 매핑 | 기준 커밋 `origin/main@eed9741`(`git cat-file -t` = commit, 설계 시점 `HEAD`와 같음) · 브랜치 `ccr-f9f698c1-9uk3t7`(V1·r1) · `ccr-b2546271-j0m668`(r1 검증·ΔV1) · `ccr-6090e66f-p61jwm`(r2·r2 검증·ΔV2 — 같은 커밋 사슬, 좌표는 INDEX) · `ccr-8246f22f-rxq1zj`(ΔV3·ΔV4) |
| 상태 | impl/IMPL_DONE (ΔV6 r7 — D9·D12~D16 구현 조치, 다음 Claude 독립 검증) |
| V mode | `Baseline V + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 + ΔV6` |
| 기준 V | `none` — 테스트 인프라 신규 계약이며 상속할 V가 없다. ΔV1~ΔV6는 이 handoff의 V1 위 증분이다 |
| 이번 V revision | `ΔV6` — verify r5 D10(D-019 문장으로 KD05 정정 — 구조 분해 값 = 같은 원천의 멤버 읽기 판정) · D11(창 안 마지막 확장 채택 — KD01·KD02·KD15 "변수" = 이름 바인딩 · for 머리 대입 대상). D9는 이행 결함(r6가 고친다). 칸 94 · 입력 411(§7-G). `ΔV5` — verify r4 D7(KD05 원천 멤버 입력 칸 정합 — 이행 결함은 r5가 고친다) · D8(ΔV4 창 안 확장 채택 — KD15·KM10·KM11, 경계 L12·L13). 칸 94 · 입력 368(§7-F). `ΔV4` — 사용자 결정(2026-11-05): (H′) 해석을 식 노드 종류 표 91칸으로 고정하고 값 자리는 fail-closed(판정 불가 + `UNRESOLVED_ALLOWED`). ΔV3 R1~R8·L01~L11은 supersede(§7-E). ΔV3는 plan 내부 정합: EP-12b 규칙 칸 ↔ UT 입력 칸을 분기 목록 169행으로 고정 · B7↔P9 충돌 해소(R4) · 용어 범위 R1~R8과 선언 경계 L01~L11. 구 행은 supersede(§7-D). ΔV2는 r2 D2·D3 정정(§7-C), ΔV1은 r1 D1 정정(§7-B) |
| 유효 V | `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 + ΔV6` |
| 구현 주체 | r7 Codex(사용자 명시 호출) · r6 Claude · r5 Claude(비기능 — 테스트 인프라) · r4 Codex(사용자 `handoff-impl 294` 명시 호출) · r1~r3 Claude |
| 측정 증거 | [`evidence/`](evidence/) — 재현 스크립트. 수치는 아래 §8이 정본 |

---

# Part I — Product & UX Contract

## 1. Context / 목표

| 요구 | 지금 문제 | 완료 후 |
|---|---|---|
| A. 저성능 CI 러너 | 시간 예산이 측정 환경(GitHub windows 러너·로컬 병렬) 기준이다 — 케이스 20s·훅 10s(vitest 기본)·`vi.waitFor` 1s(기본)·CI 작업 30분. 1코어 과부하 모사에서 기본 1s `vi.waitFor` 2건이 시간 초과로 깨졌다(§8) | 모든 테스트 시간 예산이 `기준값 × 배율(기본 3)`이다. 운영자는 코드 수정 없이 배율·CI 작업 상한을 올린다 |
| B. 실행환경 설정 차이 | 테스트가 실제 HOME·환경변수를 읽는다 — `~/.config/opencode/opencode.json`의 `mcp`만으로 9파일 27건, Git `commit.gpgsign=true`만으로 16파일 76건이 깨졌다(§8). 테스트 2파일이 실제 `~/.config/orcinus-orca`에 쓴다 | 테스트 프로세스는 빈 임시 HOME·XDG·Git 설정으로 돈다. 호스트에 Claude/OpenCode/Git 설정이 있어도 결과가 같고 실제 홈은 바뀌지 않는다 |
| C. 배포 구성 차이 | 폐쇄망 포크가 `app/deployment/*.ts`(인증·게이트·Plugin·모델 기여·spawn env·사용량·연결 행)를 채우면 OSS 기본값("비어 있다")을 고정한 테스트 7파일 13건이 깨진다(§8) | 기본 배포 내용을 고정한 단언은 두지 않는다. 배포 모듈에 기대는 테스트는 자기 fixture를 명시한다 |

성공 한 문장: **5년 전 사무용 PC급 러너, 사내 설정이 채워진 호스트, 배포를 채운 포크 어디에서도 같은 코드는 같은 테스트 결과를 낸다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Ci 러너 환경이 생각보다 성능이 낮을 수 있다. 5년 전 사무용 데스크톱 pc를 기준하여 .test 기준을 완화하라." | 사용자 턴 1 |
| 명시 요구 | "또한 프로덕선 환경에 따라 인증, 스킬, 모델 플러그인이 있을 수 있으며, opencode, claude 실행환경에서 설정된 값들이 다를 수 있다. 이런것들에 대해서는 잠재덕으로 테스트 코드로 만들지 않거나 기대값들을 변경하라" | 사용자 턴 1 |
| 명시 결정 | 배율 = "실-git도 배율 적용"(실-git 파일 예산까지 같은 배율, 게이트 규칙 유지, 배율 ×3) · 첫 답 "Git 인프라는 유지" | 사용자 질의 응답 1·5 |
| 명시 결정 | 호스트 설정 = "격리 + 기대값 유지" · Git 설정 = "포함" · 배율 덮어쓰기 = "둔다" | 사용자 질의 응답 2·3·4 |
| 추론 의도 | CI 작업 상한도 저장소 변수로 올릴 수 있어야 한다 — 배율만 올리면 작업 상한(30분)이 먼저 끊는다 | 측정: Test 단계 8m43s · 작업 13m43s(run 41647319393) × 3 > 30분 |
| 추론 의도 | 고정 포트 충돌도 "실행환경 값 차이"다 — 포트 45211~는 리눅스 임시 포트 대역(32768–60999) 안이다 | `/proc/sys/net/ipv4/ip_local_port_range` · §8 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 테스트 시간 예산 전부에 **배율 ×3**을 적용한다 — 전역 케이스·훅, `vi.waitFor`, 파일 예산(`vi.setConfig`), 케이스 인라인 타임아웃, 테스트 소유 실시간 마감, 실-git 픽스처 상한·정리 backstop, CI 작업 상한 | "5년 전 사무용 데스크톱 pc를 기준하여" · "실-git도 배율 적용 … 배율은 ×3" | 사용자 턴 1 · 응답 5 | ACTIVE | — |
| D-002 | 배율 SSOT는 한 모듈이다. `ORCA_TEST_TIME_SCALE`로 덮어쓴다 — 미설정·빈 값은 3, **1 이상의 유한한 수**만 허용하고 그 밖은 vitest 시작 시 실패 | "러너 운영자가 코드 수정 없이 더 키울 수 있게" → "둔다" | 응답 4 | ACTIVE | — |
| D-003 | 기준값(base): 케이스 **20s**, 훅 **20s**(vitest 기본 10s에서 케이스와 같게 상향), `vi.waitFor` 기본 **5s**(vitest 기본 1s에서 상향), 파일 예산·인라인·마감·실-git 상수는 **현재 리터럴 그대로**. 실효값 = base × 배율 → 케이스·훅 60s, `vi.waitFor` 15s | 사용자가 고른 ×3 선택지 문구: "케이스·훅 60초, vi.waitFor 기본 15초" | 응답 1·5 | ACTIVE | — |
| D-004 | CI 작업 상한 = 현재값 × 3 — `ci.yml` 30→**90**분, `release.yml` 45→**135**분. 저장소 변수 `ORCA_CI_TIMEOUT_MINUTES`·`ORCA_RELEASE_TIMEOUT_MINUTES`가 있으면 그 값 | D-001 균일 배율. 두 선택지 문구의 CI 값(65·90분)이 갈렸으나 최종 답 "배율 적용"의 정의(현재값×3)로 닫는다. 변수는 D-002 조건절에서 유도 | 응답 5 · §2 추론 | ACTIVE | — |
| D-005 | 호스트 격리: vitest setup이 테스트 파일마다 임시 루트를 만들어 `HOME`·`USERPROFILE`·`XDG_{CONFIG,DATA,CACHE,STATE}_HOME`·(win32)`ProgramData`를 그 아래로 바꾸고, `ANTHROPIC_*`·`CLAUDE_*`·`CLAUDECODE`·`OPENCODE_*`·`GIT_*` 변수를 지운다. **기존 테스트 기대값은 바꾸지 않는다** | "격리 + 기대값 유지" | 응답 2 | ACTIVE | — |
| D-006 | Git 설정도 격리한다 — `GIT_CONFIG_GLOBAL`=빈 파일, `GIT_CONFIG_NOSYSTEM=1`. 기본 브랜치 이름에 기대는 단언 1곳은 저장소가 실제로 만든 이름을 읽는다 | "포함" · Git 3.0의 기본 브랜치 변경도 같은 축 | 응답 3 | ACTIVE | — |
| D-007 | 배포 구성(인증·게이트·Plugin·로그인 프리·모델 기여·augmenter·spawn env·사용량·연결 행)의 **OSS 기본값을 고정한 단언은 테스트로 두지 않는다**(삭제). 배포 모듈을 조립 도구로만 쓰던 테스트는 자기 fixture를 명시하도록 바꾼다(mock 또는 행 조각 helper) | "인증, 스킬, 모델 플러그인이 있을 수 있으며 … 테스트 코드로 만들지 않거나 기대값들을 변경하라" | 사용자 턴 1 | ACTIVE | — |
| D-008 | 번들 스킬(`resources/builtin/skills`)은 바꾸지 않는다 — 포크가 스킬을 더해도 실패 0 | 측정 §8 | 조사 | ACTIVE | — |
| D-009 | 실-git 인프라(픽스처 `execGit`·`removeTempRoots`·게이트 규칙 A~E)는 유지한다. 파일 예산의 **기준값과 도출식 주석은 그대로** 두고 배율만 씌운다 | "Git 인프라는 유지" + "실-git도 배율 적용(게이트 규칙은 유지)" | 응답 1·5 | ACTIVE | — |
| D-010 | 실제 포트에 바인딩하는 테스트는 OS가 준 빈 포트를 쓴다 | §2 추론(임시 포트 대역 충돌) | 조사 | ACTIVE | — |
| D-011 | 리눅스 전용 기존 실패 22건(9파일 — Windows 경로·Claude 플러그인 Linux 차이)은 범위 밖이다 | CI 정본은 windows 러너 | 측정 §8 | ACTIVE | — |
| D-012 | D-001의 "테스트 소유 실시간 마감" 자리는 **테스트 소스**(`app/src`의 `*.test.ts`·`*.testfixture.ts`·`*.testfixture.tsx`)에서 테스트가 고른 시간 값이 실제 경과 시간의 **상한**이 되는 7형태다 — 타이머 지연 · `x.setTimeout(N)` · `AbortSignal.timeout(N)` · `now()` 마감 산술·비교 · 경과 상한 단언 · `/timeout/i` 옵션(중첩 `timeouts` 객체, 자식 프로세스 timeout, production 시간 인자 포함) · `/timeout/i` 매개변수 기본값. 값은 같은 파일 상수·`??`/`||` 기본값까지 따라간다 | D-001의 주어를 형태로 고정한다. V1 EP-05는 `setTimeout`·`Date.now()+N`만 세어 목록 밖 미배율 자리가 남았다(verify r1 D1) | 추론 — D-001 + verify r1 D1 · §7-B 실측 | **SUPERSEDED** | → D-015·D-016 (ΔV2) |
| D-013 | 분류: 그 값이 지나면 **정상 경로의 테스트가 실패**하면 예산 → `scaleMs(기준값)`. 시간 초과 자체를 시험하거나(가짜 시계 포함) 값이 데이터로만 흐르거나 하한(그만큼 기다린 뒤 관측)이면 의미 값 → 허용 목록. 임계 1000ms(V1 AC7 유지), 단 `AbortSignal.timeout`·자식 프로세스 timeout은 임계 없이 본다 | 1초 미만 자리는 실측상 전부 시간 초과 유발값·순서용 하한이다. abort·자식 프로세스 상한은 1초 미만 사용이 0건이라 임계가 고장만 숨긴다(r1 X7·X8) | 추론 — §7-B 실측 | ACTIVE | — |
| D-014 | 허용 목록 항목은 `{file, value, count, reason}`이고 게이트가 같은 파일·같은 값 자리 수를 `count`와 대조한다 — 같은 값의 새 자리·지운 자리 모두 red. `vi.waitFor` 옵션 안의 `scaleMs`(이중 배율, §12)도 게이트가 red로 막는다 | `{file, value}`만으로는 한 항목이 같은 파일의 새 예산 자리를 덮는다. §12 이중 배율 금지에는 강제 지점이 없었다 | 추론 — §7-B | ACTIVE | — |
| D-015 | D-001의 "테스트 소유 실시간 마감" 자리는 **테스트 소스**(`app/src`의 `*.test.ts`·`*.testfixture.ts`·`*.testfixture.tsx`)에서 테스트가 고른 시간 값이 실제 경과 시간의 **상한**이 되는 자리다(D-012 주어·범위 승계). (H′)가 식을 읽는 모든 자리 — 형태의 호출 대상·대상 식·값·옵션 객체·맥락 — 는 **같은 파일 선언 그래프**를 해석기 하나로 푼다: 검사기 심볼(스코프·가림) · 래퍼 · 변수 초기값과 대입 · 구조 분해 · 같은 파일 함수·메서드의 매개변수←호출 인자와 호출 결과←반환식 · 단축 속성 · 객체 리터럴 멤버(전개) · `??`/`\|\|`/조건식/산술. **경계**: 같은 파일 선언에 닿지 않는 호출(production·라이브러리)의 인자와 그 콜백 매개변수 · production import 상수 · 객체 리터럴로 풀리지 않는 값의 멤버 · 계산 키 | D-012 주어("테스트가 고른 시간 값")는 값이 어느 바인딩을 거쳐도 같다. r1(술어 = 해법 형태)·r2(판정 = 문법 노드)로 같은 축이 두 번 좁았다(verify r2 D2·D3·Review Signals). 경계 밖은 이번 턴 실측으로 상한 0(§7-C) | 추론 — D-001·D-012 + verify r2 D2·D3 · §7-C 실측 | **SUPERSEDED** | D-012 대체(주어·범위 승계) → D-018 (ΔV4 — 주어·해석기 하나 원칙 승계, 경계 목록은 노드 종류 표 경계 칸으로) |
| D-016 | 형태·슬롯·now 원천·맥락을 전수로 고정한다 — 형태 8(D-012의 7 + **named**: `/timeout/i` 이름 변수 초기값·식별자 대입). `/timeout/i` 이름 슬롯 = 객체 속성 · 단축 속성 · 대입(`=`·`??=`·`\|\|=`) · 클래스 필드 · 매개변수·구조 분해 기본값 · 이름 변수. now 원천 4종(`Date.now()`·`performance.now()`·`new Date().getTime()`·`.valueOf()`) — 호출 인자·객체 안은 now 식이 아니다. deadline = now 식 `+ N`·`N +`·`+= N`·비교(now 식끼리 비교는 자리 아님) · elapsed = 상한 단언 두 방향. 맥락은 변수 참조 자리에서 판정 — 제외는 참조 **전부**, 자식 프로세스 무임계·`timeouts` 이름 소유는 참조 **하나라도**. 한 리터럴은 한 자리 | 같은 계약을 다른 문법 지점에서 깨는 입력(verify r2 Y-행)의 문법 축을 TS AST 선언·멤버 종류로 전수 나열해 닫는다. now 식을 부분 트리로 넓히면 호출 인자 안의 now 때문에 무관한 덧셈이 deadline 형태로 잡힌다(시제품: `statusLine.render.test.ts:204` `a + count(HTML, t)` — 산술·바인딩만으로 좁혀 0) | 추론 — D-012 + verify r2 Y-행 · §7-C 탐침 131입력 | **SUPERSEDED** | D-012 대체(형태·값 열거) → D-018 (ΔV4 — 형태 8·맥락·한 리터럴 한 자리 승계, 열거는 노드 종류 표로) |
| D-017 | (H′) 해석은 **식 노드 종류 표**로 고정하고 **값 자리는 fail-closed**로 판정한다 — 표의 red 칸과 표 밖 종류는 "판정 불가" 위반이며 `UNRESOLVED_ALLOWED` 등록으로만 통과한다. 0294 안에서 한다 | "294안에 넣어라" — 앞 턴에서 SKILL §5-A(열린 입력 집합 판정 산출물은 fail-closed 또는 노드 종류 표)와 선택지(현행 유지 · fail-closed · 노드 종류 표 · 새 handoff 분리)를 설명한 뒤 | 사용자 턴 2026-11-05 | ACTIVE | — |
| D-018 | 노드 종류 표의 내용 — 자리 9곳(KV·KD·KM·KF 값 · KC 호출 대상 · KN now · KE matcher · KO 소유 · KP param) 91칸, 값 자리 red 칸과 표 밖 red, 호출 대상·now 자리는 경계 칸(형태 아님·now 아님). §7-E 표가 정본이다. D-015 주어(테스트가 고른 시간 값이 상한이 되는 자리)·해석기 하나, D-016 형태 8·맥락(제외는 참조 전부, 자식 프로세스·소유는 하나라도)·한 리터럴 한 자리를 승계한다 | D-017의 구체화. 호출 대상·now 자리를 red로 두면 트리의 무관한 호출 101,920·산술 12가 막힌다 — 값 자리 red는 트리 0(§7-E 측정) | 추론 — D-017 + §7-E 센서스 | ACTIVE | D-015·D-016 대체(주어·원칙 승계) |
| D-019 | 같은 파일 대입이 값을 바꾸는 경로를 노드 종류 표에 더한다 — 멤버(`this.이름`·객체 리터럴 원천 멤버, 별칭·같은 파일 매개변수 경유 포함)의 `=`·`??=`·`\|\|=` 대입 우변은 후보(KM10), 같은 멤버의 복합 대입·증감·구조 분해 대입 대상은 red(KM11), 변수의 증감·구조 분해 대입 대상은 red(KD15). KD05 "원천 멤버"는 원천 식을 KM 표로 판정한 결과이고 원천 식이 없는 선언은 그 선언의 칸이다(for-of KD04 · `catch` KD13). 같은 파일 밖·다른 클래스의 변경은 경계(L12·L13) | D-017 fail-closed · D-018 주어(같은 파일 선언 그래프). 구조 분해 대입은 기본값·나머지 해석이 따로 필요해 red로 막는다. 새 경로 트리 자리 0(§7-F 측정) | verify r4 D7(이행 — 입력 칸 정합)·D8(ΔV4 창 안 확장 채택) — 설계자 | ACTIVE | D-018 보완(대체 아님) |
| D-020 | (a) D-019 "KD05 원천 멤버는 원천 식을 KM 표로 판정한 결과"는 **후보 유무와 무관하게** 원천 후보마다 적용한다 — 구조 분해 요소의 값 = 기본값 ∪ 같은 파일 대입 우변 ∪ 같은 원천의 멤버 읽기 판정(KM10 대입 우변 · KM11 red · 비리터럴 KM07/KM08). 원천 식이 없는 선언은 기본값이 있어도 그 칸(KD04·KD13·KD03b). (b) KD01·KD02·KD15의 "변수"는 같은 파일의 모든 이름 바인딩(변수 선언 · 구조 분해 선언 요소 · 매개변수)이고, for-of·for-in 머리의 대입 대상은 구조 분해 대입과 같은 칸(KD15·KM11)이다. 판정 순서는 모든 이름 바인딩에서 KD13 → KD04 → KD03b → KD02 → KD15 → 값 칸 | (a) D-017 fail-closed는 "후보가 있으면 원천을 보지 않는다"를 허용하지 않고, 같은 값의 멤버 읽기는 이미 그렇게 판정한다(verify r5 R5c·R7bc). (b) D-018 주어(같은 파일 선언 그래프)는 바인딩 종류를 가리지 않는다. 새 경로 트리 자리 0(§7-G 측정) | verify r5 D10(plan 내부 정합)·D11(ΔV4 창 안 마지막 확장 채택) — 설계자 | ACTIVE | D-019 보완(대체 아님) |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-011 (Baseline V).
- ΔV1(2026-11-04)에서 추가된 결정: D-012~D-014 — 사용자 결정 변경이 아니라 D-001 범위 안의 설계 구체화다. 대체된 결정 없음.
- ΔV2(2026-11-04)에서 추가·대체된 결정: D-015·D-016 추가, D-012 → SUPERSEDED(주어·범위는 D-015가 원문 승계, 7형태·값 열거는 D-016이 8형태·해석기로 대체). 사용자 결정 변경이 아니라 D-001 범위 안의 설계 정정이다.
- 변경된 결정: D-012(ΔV2, 위). 기존 handoff 결정과의 관계는 §16.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001 ↔ AC1·AC2·AC3·AC5~AC9(전 예산 자리) · D-002 ↔ AC4·AC9 · D-003 ↔ AC1~AC3(60s·60s·15s) · D-004 ↔ AC9(90·135분) · D-005 ↔ AC10~AC13(기대값 미변경 = AC16 회귀) · D-006 ↔ AC10·AC12·AC14(브랜치 이름) · D-007 ↔ AC15 · D-008 ↔ AC15(스킬 포크 0건 유지) · D-009 ↔ AC5·AC8(A~E 유지) · D-010 ↔ AC17 · D-011 ↔ AC16(22건 집합 유지).
- **ΔV2 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001·D-015 ↔ AC7c(EP-05b 62자리 = 해석기 술어 전수 · 예산 24 `scaleMs`) · D-016 ↔ AC7d(EP-12b P2′·P5′·P7′·P8·P9 = 형태 8·슬롯·now 원천 4·맥락 전부/하나라도·한 리터럴 한 자리) · D-013 ↔ AC7c(새 18자리는 가짜·주입 시계와 mtime 데이터 → 의미 값) · D-014 ↔ AC7c(새 7항목 count = 자리 수, M11c·M11d) · D-005 ↔ AC7c(테스트 소스·기대값 변경 0) · D-009 ↔ AC7d((A)~(E)·(F)·(G) 무변경) · D-003 ↔ AC7c(기준값 = 현재 리터럴). D-012(SUPERSEDED)를 근거로 삼는 ACTIVE AC: 0 — AC7a·7b는 AC7c·7d로 대체.
- ΔV4(2026-11-05): **사용자 결정** D-017 추가, 그 구체화 D-018 추가, D-015·D-016 → D-018 SUPERSEDED(주어·원칙 승계). plan 동결 뒤 새 열거 항목의 출처가 이 사용자 결정이다.
- **ΔV4 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-017 ↔ AC7f(값 자리 판정 불가 · `UNRESOLVED_ALLOWED` count) · D-018 ↔ AC7f(칸 91 · 입력 332) · D-013 ↔ AC7f(임계 1000 · abort·자식 프로세스 무임계 그대로) · D-014 ↔ AC7f(허용 목록 대조 규칙을 판정 불가 목록이 같은 형으로 승계) · D-005·D-009 ↔ AC7f(테스트 소스·(A)~(G) 변경 0) · D-017 ↔ AC19c(작성자 처방 문서화). D-015·D-016(SUPERSEDED)을 근거로 삼는 ACTIVE AC: AC7c 하나 — 그 근거(D-015 주어·EP-05b 술어)는 D-018이 승계하고 ΔV4의 트리 영향 0(새 자리 0)이라 AC7c는 그대로다. AC7e·AC19b는 AC7f·AC19c로 대체.
- ΔV5(2026-11-05): D-019 추가(설계자 — verify r4 D8 창 안 확장 채택, D7은 KD05 입력 칸 정합). 대체된 결정 없음. 사용자 결정 ΔV가 아니라 확장 창을 새로 열지 않는다.
- **ΔV5 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-017 ↔ AC7g(KD05 빈 후보·KD15·KM11 판정 불가 · 칸 ID 단언) · D-018 ↔ AC7g(칸 94 · 입력 368 — ΔV4 163·ΔV3 169행 기대 무변경) · D-019 ↔ AC7g(KM10 후보 · 구별 입력 KM10e·l·m) · D-013 ↔ AC7g(KM10a 5000 ≥ 임계 → 리터럴 위반, 임계 그대로) · D-005·D-009 ↔ AC7g(테스트 소스·(A)~(G) 변경 0) · D-017 ↔ AC19d(작성자 문서에 증감·구조 분해 대입 판정 불가).
- ΔV6(2026-11-05): D-020 추가(설계자 — verify r5 D10 문장 정합 · D11 창 안 마지막 확장 채택). 대체된 결정 없음. 사용자 결정 ΔV가 아니라 창을 새로 열지 않는다 — 이 턴 뒤 열거 동결.
- **ΔV6 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-017 ↔ AC7h(혼합 원천 KM08 · for-of·`catch` 기본값 KD04·KD13 · 이름 바인딩 증감·복합·구조 분해·for 머리 대입 판정 불가) · D-018 ↔ AC7h(칸 94 · 입력 411 — ΔV3~ΔV5 368행 기대 무변경, 시제품 불일치 0) · D-019·D-020 ↔ AC7h(구조 분해 = 멤버 읽기 짝 행 4쌍 · KM10 원천 사슬 KM10n) · D-013 ↔ AC7h(임계 1000 그대로 — KD05n 500은 위반 아님) · D-005·D-009 ↔ AC7h(테스트 소스·(A)~(G) 변경 0) · D-017 ↔ AC19e(작성자 문서에 이름 바인딩 범위).
- ΔV3(2026-11-05): 결정 추가·대체 없음 — 사용자 결정 변경이 아니라 EP-12b 규칙 칸의 plan 내부 정합(§7-D)이다.
- **ΔV3 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-015 ↔ AC7e(EP-12c는 D-015 주어의 부분을 잠근다 — 열거 밖 L01~L11은 트리 0, 후보 표 0294 행 · 반대를 요구하는 행 0) · D-016 ↔ AC7e(R2 대입 = D-016 대입 정의 · R7 elapsed 두 방향 · R4는 "한 리터럴은 한 자리"를 산술 노드로 잇는다) · D-013 ↔ AC7e(R4 임계는 1000·abort·자식 프로세스 무임계 그대로) · D-005·D-009 ↔ AC7e(테스트 소스·(A)~(G) 변경 0).
- **ΔV1 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001·D-012 ↔ AC7a(EP-05a 44자리 = 7형태 전수) · D-013 ↔ AC7a(예산 24 `scaleMs` · 의미 값 20 허용 목록 · 임계와 무임계 형태) · D-014 ↔ AC7a(count 대조·이중 배율 red) · D-005 ↔ AC7a(배율 전환은 대기 상한만 늘리고 단언 기대값은 그대로 — 단언 피연산자는 자리에서 제외) · D-009 ↔ AC7a((A)~(E) 대상 파일 범위 불변) · D-003 ↔ AC7a(기준값 = 현재 리터럴).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 시간 초과 원인은 고정 예산, 환경 실패 원인은 호스트 읽기 | §8 측정: 모사 감속 2건 모두 기본 1s `vi.waitFor` · 호스트 실패 전부 HOME/env 키로 분해됨 |
| 이미 기존 코드가 충족하는가 | 일부 — 실-git 파일 예산은 이미 self-hosted spawn 6s × 1.5 가정 | `src/main/infra/git/repository.test.ts:8-13` 주석 · 나머지 예산은 미충족 |
| 더 작은 해법이 있는가 | 개별 테스트 수정(질의 선택지 "개별 테스트만 수정")은 사용자가 고르지 않았다 | 응답 2 |
| 선행 자료 주장 대조 | `vitest.config.ts:25` "늘려도 멈춤은 그대로 잡힌다" — 유효(예산은 유한) | 배율은 유한수만 허용(D-002) |
| ACTIVE 결정·기존 채택 결정과 충돌 | 0248 D-011/AC15·0237 D-030("기본 배포 `[]` 유지")의 **테스트 고정**만 대체 — OSS 기본값이 빈 배열인 사실 자체는 유지 | §16 |

- 사용자에게 올릴 결정: 없음(질의 5건으로 닫음).
- 코드 조사로 닫은 사실: 영향 키·파일·자리 수 전부(§8).

## 5. 동작 / 사용자 흐름

```text
[개발자/CI가 npm test 또는 vitest run 실행]
  → vitest.config 로드: ORCA_TEST_TIME_SCALE 해석(미설정=3) → 케이스·훅 예산 = 20s × 배율
       ↘ 잘못된 값(0.5·abc·Infinity) → 즉시 실패, 메시지에 변수명·값
  → 테스트 파일마다 setup: 임시 HOME·XDG·Git 설정, 하네스 변수 제거, vi.waitFor 기본 5s × 배율
  → 테스트 실행 — 호스트 설정·배포 구성·느린 러너와 무관한 결과
  → 파일 종료: 임시 루트 정리(실패는 무시 — 실제 홈은 건드리지 않았다)
[CI] 작업 상한 = vars.ORCA_CI_TIMEOUT_MINUTES || 90 (release: … || 135)
     Test 단계에 ORCA_TEST_TIME_SCALE = vars.ORCA_TEST_TIME_SCALE 전달
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 변수 미설정 | 배율 3 | 케이스·훅 60s, `vi.waitFor` 기본 15s, CI 90분 |
| `ORCA_TEST_TIME_SCALE=5` | 배율 5 | 모든 예산 5배(케이스 100s 등). CI 상한은 별도 변수 |
| `ORCA_TEST_TIME_SCALE=0.5`·`abc` | config 로드 throw | vitest 비정상 종료 + `ORCA_TEST_TIME_SCALE` 메시지 |
| 테스트가 실제로 멈춤 | 유한 예산에서 끊김 | 실패 보고가 3배 늦어질 뿐 — 멈춤은 그대로 실패 |
| 호스트에 `~/.config/opencode` mcp·`CLAUDE_CONFIG_DIR`·서명 강제 git | setup이 가림 | 깨끗한 호스트와 같은 결과, 실제 홈 무변경 |
| 포크가 `app/deployment` 채움 | 기본값 고정 단언 없음 | 같은 결과 |

### 파생 UX / 엣지케이스

- 외부환경/폐쇄망: CI 변수는 GitHub 저장소 Variables에 둔다(코드 수정 없음). self-hosted 러너도 같은 변수를 읽는다.
- concurrency: 임시 루트는 파일마다 따로 — 병렬 워커가 HOME을 공유하지 않는다.
- opt-in 실기 테스트(`ORCA_TEST_OPENCODE_EXE`·`ORCA_ARTIFACT_LIVE`): `ORCA_*` 변수는 지우지 않는다.

## 6. 범위 / 비범위

- **범위**: `app/vitest.config.ts`, 신규 `app/scripts/test-time.mjs`·`test-host.mjs`·`vitest-setup.mjs`(+테스트), `app/scripts/check-test-budgets.mjs`(+테스트), 예산·마감 자리 테스트 파일, 실-git 픽스처 상수, 배포 결합 13건, `loopback-callback.test.ts`, `service.test.ts:245`, `.github/workflows/{ci,release}.yml`, 문서(`app/AGENTS.md`·`docs/guides/release-operations.md`).
- **비범위**: 프로덕션 코드의 타임아웃(테스트가 아닌 앱 동작), 리눅스 기준선 22건(D-011), 번들 스킬(D-008), 프로덕션 기본 배포 내용(빈 배열 유지).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| Windows 백신·디스크 지연의 기계 모사 | 아니오 | 사람 실기 AC18 |
| 리눅스 기준선 22건 | 아니오 | 별도 handoff 후보 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 실효 케이스 예산 = 20_000 × 배율 | vitest 테스트: `task.timeout === 20_000 * 해석 배율`(무설정 60_000) | `vitest.config.ts` → worker |
| R-01 | AT-01 / AC2 | 실효 훅 예산 = 20_000 × 배율 | node 테스트: `ORCA_TEST_TIME_SCALE` 1·3·5로 `vitest.config.ts` import → `test.hookTimeout` 20_000·60_000·100_000, `testTimeout`도 같음 | 같음 |
| R-01 | AT-01 / AC3 | `vi.waitFor` 무옵션 5_000×배율, 명시 `t`는 `t×배율`, 숫자 인자도 ×배율, `interval` 보존 | 순수 함수 테스트 4분기 + vitest 배선 테스트: 무옵션 `vi.waitFor`가 1.5s 넘게 재시도 후 성공 | setup → 모든 `vi.waitFor` 호출(172곳/51파일) |
| R-02 | AT-02 / AC4 | 배율 해석: 미설정·`''`·공백→3, `1`·`1.5`·`5`→그 값, `0`·`0.99`·`-1`·`abc`·`Infinity`·`NaN`→throw(메시지에 변수명·원값) · 잘못된 값이면 vitest가 비정상 종료 | 순수 함수 테스트 + node 테스트: 잘못된 값으로 config import → reject | `test-time.mjs` → config |
| R-01 | AT-01 / AC5 | 파일 예산 20곳이 `scaledBudget({...})`를 지나고 기준값은 현재 리터럴 그대로 | 게이트 (F) red/green 테스트 + `--report` 출력 20곳 = §10 EP-03 목록(차집합 0) | 각 테스트 파일 최상위 `vi.setConfig` |
| R-01 | AT-01 / AC6 | 케이스 인라인 타임아웃 6곳이 `scaleMs(base)`를 지난다 | 게이트 (F) red/green + `--report` 6곳 = EP-04 | it/test 셋째 인자 |
| R-01 | ~~AT-01 / AC7~~ → **ΔV1 AC7a (§7-B)** | **SUPERSEDED** — 테스트 소유 실시간 마감 4곳은 `scaleMs`, 의미 대기 6곳은 허용 목록(파일·값·사유) | 게이트 (H): 새 리터럴 마감(≥1000ms)이 허용 목록 밖이면 red · `--report` 10곳 = EP-05 | 테스트 본문 `setTimeout`·`Date.now()+N` |
| R-01 | AT-01 / AC8 | 실-git 픽스처 상수 3개(`FIXTURE_GIT_TIMEOUT_MS`·`KILL_GRACE_MS`·`RM_RETRY.retryDelay`)가 `scaleMs(600_000·5_000·200)` · 게이트 (G): 픽스처 기준 상한 > 실-git 파일 기준 예산 최대값 · 기존 규칙 (A)~(E) 그대로 통과 | 게이트 node 테스트(G red/green) + 기존 `check-test-budgets.test.mjs` 케이스 유지 + 픽스처 상수 vitest 테스트 | `temp-repo.testfixture.ts` |
| R-02 | AT-02 / AC9 | `ci.yml` 상한 `fromJSON(vars.ORCA_CI_TIMEOUT_MINUTES \|\| '90')`, `release.yml` `… \|\| '135'`, 두 Test 단계 env `ORCA_TEST_TIME_SCALE: ${{ vars.ORCA_TEST_TIME_SCALE }}` · Windows CI green | node 테스트(워크플로 텍스트 단언) + `gate:` PR Windows CI 실행 | GitHub Actions |
| R-03 | AT-03 / AC10 | 격리 env 순수 함수: 지움 = `ANTHROPIC_`·`CLAUDE_`·`OPENCODE_`·`GIT_` 접두사 + `CLAUDECODE` · 보존 = 그 밖(`ORCA_*`·`PATH`·`TEMP`·`TMPDIR`·프록시) · 바꿈 = `HOME`·`USERPROFILE`·XDG 4종·(win32만)`ProgramData` → 루트 하위 · Git = `GIT_CONFIG_GLOBAL`(빈 파일)·`GIT_CONFIG_NOSYSTEM=1` | node 테스트: 키 표본마다 단언(형제 키와 맞바꿔도 red), win32/linux 분기 각각 | `test-host.mjs` |
| R-03 | AT-03 / AC11 | 배선: 모든 테스트 파일에서 `os.homedir()`가 setup 루트 하위이고 setup 전 원래 HOME과 다르다 · XDG 4종 루트 하위 · `GIT_CONFIG_NOSYSTEM='1'` · `GIT_CONFIG_GLOBAL` 빈 파일 · 지움 대상 키 0 | vitest 배선 테스트(원래 HOME은 setup이 전역 심볼에 기록) | `vitest-setup.mjs` → `process.env` |
| R-03 | AT-03 / AC12 | 합성 사내 호스트(전역 opencode `mcp` enabled/disabled · `OPENCODE_CONFIG`·`OPENCODE_CONFIG_DIR`·`OPENCODE_DISABLE_PROJECT_CONFIG` · `ANTHROPIC_MODEL`·`CLAUDE_CODE_DISABLE_1M_CONTEXT`·`CLAUDE_CONFIG_DIR` · `~/.gitconfig`와 `GIT_CONFIG_SYSTEM` 파일의 `commit.gpgsign=true`+없는 gpg)에서 원인별 대표 9파일이 통과 | vitest 시스템 테스트: 자식 vitest를 그 env로 실행 → exit 0 | 실제 config·setup·production reader |
| R-03 | AT-03 / AC13 | 위 실행 뒤 합성 HOME 트리(경로·크기·mtime)가 실행 전과 같다 — 실제 홈 쓰기 2파일 포함 | AC12와 같은 시스템 테스트의 사후 단언 | 같음 |
| R-03 | AT-03 / AC14 | `service.test.ts` 별칭 rollback 케이스가 기본 브랜치 이름(`master`)에 기대지 않는다 | 기대값을 저장소 생성 직후 `git symbolic-ref --short HEAD`로 읽은 이름에서 가져온다 · 변이: 픽스처 `git init`에 `-b develop`(기본 브랜치가 다른 호스트·Git 3.0 모사) → AS-IS 단언 red, TO-BE green | `features/worktrees/service.test.ts` |
| R-04 | AT-04 / AC15 | 배포 결합 13자리(EP-10)를 처리: 삭제 6 · 단언 절 삭제 2 · fixture 고정 2 · 행 조각 helper 전환 3 → 포크 모사 실행에서 기준 대비 신규 실패 0 | 포크 모사 절차(`evidence/fork-deployment.py` → 전체 스위트 → `newfails.mjs`) + 삭제 자리 음성 검색 + 남긴 테스트 green | `app/deployment/*.ts` 소비 테스트 |
| R-01·R-03 | AT-05 / AC16 | 회귀: 리눅스 깨끗한 호스트 실패 집합 = 기준선 22건 그대로 · 케이스 수 = 기준 8,445 − 삭제 6 + 신규 · 저성능 모사(1코어·8워커)·합성 사내 호스트에서 기준 대비 신규 실패 0 | `evidence/*-run.sh` + `newfails.mjs` | 전체 스위트 |
| R-05 | AT-06 / AC17 | `loopback-callback.test.ts`가 OS 빈 포트를 받아 쓰고 같은 포트 재바인딩 단언을 유지 · 테스트가 실제 바인딩하는 고정 포트 리터럴 0 | 그 파일 green + 검색 `rg -n "nextPort\|4521[0-9]" app/src --glob '*.test.ts'` → 0 | `infra/loopback-callback.ts` |
| R-01 | AT-07 / AC18 | **사람 실기**: 5년 전 사무용 PC급 Windows(사내 백신 포함) 또는 self-hosted 러너에서 `cd app && npm test` green, 소요 시간 기록 | 사람 실행 기록 | 실제 외부환경 — 백신·디스크 지연은 리눅스에서 모사 불가 |
| — | AC19 | 문서: `app/AGENTS.md`(예산·격리 규칙, 게이트 F~H), `docs/guides/release-operations.md`(저장소 변수 2+1종), `vitest.config.ts` 주석 · `node scripts/check-doc-inventory.mjs --check` green | 문서 diff + 인벤토리 게이트 | 문서 |

### AC 검증 주의사항

- 기존 테스트 재사용: `check-test-budgets.test.mjs`의 (A)~(E) 케이스(최상위 describe 9 · test 28, `:48`~`:254`)를 유지하되 fixture 문자열을 `scaledBudget` 형태로 갱신한다 — 케이스 이름·의도는 그대로.
- 사람 실기 항목: AC18만 — CPU 모사는 AC16이 기계로 닫고, 백신·디스크 지연만 남는다.
- 0건 기준(AC17 고정 포트·AC15 삭제 자리)은 음성 검색이다 — 양성 짝은 AC17 green·AC15 남긴 테스트 green.
- AC12의 대표 9파일은 격리 없이(AC12 변이 M-A) 같은 env에서 실제로 실패한다 — §8 측정. 대표 파일이 나중에 호스트 독립적으로 바뀌면 그 자리를 다른 대표로 바꾼다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 신규 테스트 인프라 계약, 상속할 V 없음.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 A · D-001·D-003 — 모든 시간 예산 = base × 배율 | NEW | — |
| R-02 | R | §5 — 배율·CI 상한 덮어쓰기와 검증 | NEW | — |
| R-03 | R | §1 B — 호스트 설정 무관 결과 + 실제 홈 무변경 | NEW | — |
| R-04 | R | §1 C — 배포 구성 무관 | NEW | — |
| R-05 | R | D-010 — 고정 포트 비의존 | NEW | — |
| SD-01 | SD | §9 — config 로드 → 파일별 setup → 실행 → 정리, 자식 프로세스 상속 | NEW | — |
| AR-01 | AR | §9·§10 — 배율 SSOT ↔ 소비자(config·setup·픽스처·테스트·게이트) | NEW | — |
| AR-02 | AR | §9·§10 — 격리 env ↔ production reader·자식 프로세스 | NEW | — |
| AR-03 | AR | §10 — 예산 게이트 (F)(G)(H) + (A)~(E) | NEW (A~E는 INHERITED 내용) | `scripts/check-test-budgets.mjs@eed9741` |
| MD-01 | MD | §10 — 배율 순수 함수 | NEW | — |
| MD-02 | MD | §10 — 격리 env 순수 함수 | NEW | — |
| AT-01~07 · ST-01 · IT-01~03 · UT-01~02 | 검증 | §7 · §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | **SUPERSEDED → ΔV1 VP-01a (§7-B)** | 배율 해석 → config(케이스·훅) → setup(waitFor) → 파일 예산·인라인·마감·픽스처 → 실행 | 신규 `src/main/infra/test-environment.test.ts`('케이스 예산'·'waitFor 기본 대기') · `scripts/test-time.test.mjs`('config 예산'·'waitFor 옵션') · `scripts/check-test-budgets.test.mjs`(F·G·H) · `--report` 대조 | required — 구조 oracle(게이트). **M1** `vitest.config.ts` hookTimeout 제거 → AC2 red · **M2** wrapper가 명시 timeout을 배율 없이 통과 → AC3 red · **M3** EP-03 한 자리를 리터럴로 되돌림 → (F) red · **M4** EP-04 한 자리 리터럴 → (F) red · **M5** EP-05 마감 한 자리 리터럴 → (H) red · **M6** 픽스처 기준 상한을 300_000 → (G) red | EP-01(2)·EP-02(1)·EP-03(20)·EP-04(6)·EP-05(10)·EP-06(3) = 42 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `ORCA_TEST_TIME_SCALE` → `resolveTestTimeScale` → config import 실패/성공 · `vars.*` → 워크플로 | `scripts/test-time.test.mjs`('배율 해석' 표본 12개 · '잘못된 배율은 config 로드 실패') · `scripts/test-time.test.mjs`('워크플로 상한·변수') · `gate:` PR Windows CI | required — **M7** 하한 비교를 `> 0`으로 → '0.99' 표본 red · **M8** `ci.yml` 기본 90을 30으로 → 워크플로 테스트 red | EP-07(4)·EP-08(2) = 6 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 합성 HOME/env → 자식 vitest → config → setup(격리) → production reader(opencode 전역 설정·Claude 경로·git) → 결과·홈 트리 | 신규 `src/main/infra/test-environment.hostile.test.ts`('합성 사내 호스트에서 대표 테스트가 통과하고 홈이 바뀌지 않는다') | required — **M-A** `vitest.config.ts`에서 `setupFiles` 제거 → 자식 실패(exit≠0) · **M-B** 지움 접두사에서 `OPENCODE_` 제거 → 자식 실패 · **M-C** 지움 접두사에서 `GIT_` 제거 → 자식 env의 `GIT_CONFIG_SYSTEM`(서명 강제 파일)이 살아 `repository.test.ts` 실패 · **M-D** HOME 리다이렉트 제거 → 홈 트리 변화 red | EP-09(15) · AC12 대표 9파일 |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 포크 `app/deployment/*.ts` → 소비 테스트 13자리 | 자리별: 삭제 6 → 음성 검색 `rg` 0 · 절 삭제 2·fixture 고정 2·helper 전환 3 → 각 파일 green(기본 배포) + 포크 모사 green(`evidence/fork-deployment.py`) | required — 포크 모사가 곧 적대 증거: **M9** 아무 자리 하나 되돌림 → 포크 실행에서 그 자리 red | EP-10(13) |
| VP-05 | R-05 ↔ AT-06 | REQUIRED | 테스트 → OS 빈 포트 → `awaitLoopbackCallback({port})` | `src/main/infra/loopback-callback.test.ts` 전 케이스 | not selected — 직접 행동 oracle(실제 바인딩) | EP-11(1) |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | vitest 시작 → 파일마다 setup → afterAll 정리 → 자식 프로세스 env 상속 | `test-environment.test.ts`('파일마다 다른 루트'·'자식 프로세스가 격리 env를 받는다') · VP-03 시스템 테스트 | not selected — 행동 단언 | EP-09 적용 자리(1) |
| VP-07 | AR-01 ↔ IT-01 | **SUPERSEDED → ΔV1 VP-07a (§7-B)** | `scripts/test-time.mjs` → config·setup·픽스처·테스트 파일 import | VP-01 좌표와 같음 + `typecheck`는 oracle 아님 | VP-01 M1~M6 | EP-01~EP-06 |
| VP-08 | AR-02 ↔ IT-02 | REQUIRED | setup → `process.env` → `os.homedir()`·XDG·git 자식 | `test-environment.test.ts`(AC11) · VP-03 | VP-03 M-A~M-D | EP-09(15) |
| VP-09 | AR-03 ↔ IT-03 | **SUPERSEDED → ΔV1 VP-09a (§7-B)** | 테스트 소스 → 게이트 (A)~(H) → CI 'Test budget guard' 단계 | `scripts/check-test-budgets.test.mjs`(기존 A~E + 신규 F·G·H·report) · `gate:node scripts/check-test-budgets.mjs` | VP-01 M3~M6 | EP-03~EP-06 |
| VP-10 | MD-01 ↔ UT-01 | REQUIRED | 순수 함수 | `scripts/test-time.test.mjs` | VP-02 M7 | EP-08 |
| VP-11 | MD-02 ↔ UT-02 | REQUIRED | 순수 함수 | `scripts/test-host.test.mjs` | **M10** 지움 술어와 보존 술어 맞바꿈(`ORCA_` 지움) → red | EP-09 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint·typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error |
| vitest | 테스트 인프라 자체 | `./node_modules/.bin/vitest run` — 리눅스는 기준선 22건 분리 | 22건 밖 신규 실패 |
| node scripts 테스트 | 신규·변경 `scripts/*.mjs` | `node --test "scripts/*.test.mjs"` | 전부 |
| 예산·인벤토리 게이트 | 게이트 변경 · 문서 변경 | `node scripts/check-test-budgets.mjs` · `node scripts/check-doc-inventory.mjs --check` | 전부 |
| Windows CI | 정본 통합 게이트 · 워크플로 변경 | PR `CI` 실행 | 전부 |
| commit trailer | message bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

## 7-B. ΔV1 — verify r1 `PLAN_GAP` D1 정정

> **적용 순서: `V1` → `ΔV1`.** verify r1([verify.md](verify.md) §13 D1)이 돌려보낸 EP-05 자리 목록을 불변식의 주어로 **다시 열거해 한 번에 고정**한다. 구 행(§7 AC7 · §7-A VP-01·07·09 · §10 EP-05)은 그 자리에 두고 `SUPERSEDED`로 가리킨다. 결정은 §3 D-012~D-014.

### 무엇이 왜 바뀌는가

| verify r1 지적 | 진단 | ΔV1의 답 |
|---|---|---|
| D1 — EP-05 자리 검색 술어 | 술어가 해법 형태(`setTimeout`·`Date.now()+N`)였고 범위가 `*.test.ts`뿐이었다 | 주어("테스트가 고른 시간 값이 실제 경과의 상한")의 7형태 · 테스트 지원 파일 포함으로 재열거 → **10 → 44자리**(EP-05a). 목록 밖 미배율 자리는 verify가 본 2곳이 아니라 **18곳**이었다 |
| D1 — 게이트 (H) 술어 | 같은 두 형태만 봤다 — r1 X7(`AbortSignal.timeout`)·X8(자식 프로세스 `timeout`)·X9(상수 경유) 못 잡음 | **(H′)** — 7형태 · 값 해석(같은 파일 상수·`??`/`||`·리터럴 산술) · abort·자식 프로세스 무임계 · testfixture 범위 |
| D1 — `pop3-tls.test.ts:48-49` 분류 | 로컬 TLS 로그인이 3초 안에 끝나야 통과한다 | D-013상 **예산** → `scaleMs(3000)` |
| 설계 감사 — §12 이중 배율 금지 | 강제 지점이 없었다 | (H′)가 `vi.waitFor` 옵션 안 `scaleMs`를 red로(D-014) |
| 설계 감사 — 허용 목록 `{file, value}` | 한 항목이 같은 파일·같은 값의 새 예산 자리를 덮는다 | `count` 대조(D-014) |

### 설계 근거 — 이번 턴 측정

기준 트리 `e7d40b4`(r1.2 구현 HEAD — 브랜치 좌표, `main` 미병합. 앱 코드는 검증 커밋 `4ab60c9`와 같다).

| 관측 | 명령 | 결과 | 설계에 미친 영향 |
|---|---|---|---|
| 넓힌 술어 전수 | `node docs/handoff/0294-slow-runner-hermetic-tests/evidence/scan-deadlines.mjs app` | **44** — timer 7(배율 4) · deadline 6(배율 2) · abort 3 · option 27 · param 1 | EP-05a 분모 |
| 1초 미만 자리 | 같은 명령 `--all` | option 13 — 전부 시간 초과 유발값(0·5·15·20·25·30·50·100·500ms, 결과가 `timeout`/reject) · timer 33 — 순서·부재 확인용 하한 대기 · abort·자식 프로세스 timeout 0 | 임계 1000 유지, abort·자식 프로세스는 무임계(D-013) |
| 위치 인자 백스톱 | 테스트 소스 호출 인자의 숫자 리터럴 ≥1000 전수(`scaleMs`·`vi.waitFor`·가짜 시계·`expect` 제외) | 82 — 연도(2026)·크기·고정 시각·가짜 시계 값. 위치 인자 상한 예산 0 | 위치 인자 형태는 술어에 넣지 않는다 |
| 라벨 표본 `/timeout/i` | 44자리의 키·이름 | 전부 시간 상한 값이 맞다 — 예산·데이터·가짜 시계가 섞여 분류는 자리마다 한다 | 키 술어 + 자리별 분류 |
| 라벨 밖 시간 키 | 이름이 `Ms`·`_ms`·`Seconds`로 끝나는 값 ≥1000(비 timeout) | `durationMs` 18 · `intervalMs` 5 · `duration_ms` 5 · `connectMs` 3 · `retry_delay_ms` 2 · `commandMs`·`timedOutAfterMs`·`createdAtMs` 각 1 — `connectMs`·`commandMs` 4자리는 `timeouts: {…}` 안 | 중첩 `timeouts` 객체를 술어에 넣었다(+4). 나머지는 경과 기록·주기·데이터 |
| 이중 배율 | AST — `vi.waitFor` 호출 173 중 옵션에 `scaleMs` | 0 | (H′) 규칙 추가 비용 0 |
| r1 X7·X8·X9 스파이크 | 세 변이를 심고 같은 스캔 | 세 자리 모두 `literal`로 드러남(abort 10 · option 10 · 상수 경유 timer 30_000) | (H′)가 같은 술어면 세 변이 red |
| EP-12 분기 탐침 | 스캔의 판정 함수에 EP-12 표 입력 18개를 넣음 | 18개 모두 표의 기대와 같다(elapsed·`expect` 대상·콜백 안 타이머는 세고, matcher 피연산자·`vi.waitFor` 옵션·production 시간 인자 10ms·라벨 밖 키는 건너뜀) | P1~P7이 서로 모순 없이 구현 가능하다 |
| renderer 테스트의 배율 import | `boot/steps.test.ts`에 `scaleMs` import 시험(커밋 안 함) | eslint 0 · `typecheck:web` exit 0 · vitest 9/9 | renderer 자리 2곳 구현 가능 |
| 자식 프로세스 테스트 지원 파일 | `native-storage.integration.test.ts:18-45` 읽기 | fixture를 esbuild로 묶어 자식 node가 실행 · env는 `{ ...process.env }` 상속 | fixture 안 `scaleMs`도 같은 배율로 해석된다 |
| opt-in 스위트 | `managed-mcp.cli.integration`·`native-storage.integration`·`artifact-sdk-live` | 이 환경에서 skip — opencode 실행 파일 설치가 이 세션에서 거부됨 | 이 자리의 기계 oracle은 형태 게이트뿐 — 기준값 축 고장은 EP-05a `실패 의미`에 적는다 |

### ΔV1 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 A · D-001 — 모든 시간 예산 = 기준값 × 배율 | INHERITED | `V1:R-01` — 요구 문장 무변경 |
| AT-01a | AT | AC1·2·3·5·6·**7a·7b**·8 | CHANGED → **SUPERSEDED → ΔV2 AT-01b** | `V1:AT-01` 대체(AC7 → AC7a, AC7b 신설) |
| AR-01a | AR | 배율 SSOT ↔ 소비자 — 예산 24자리(새 18: production 시간 인자·abort·자식 프로세스·testfixture) | CHANGED → **SUPERSEDED → ΔV2 AR-01b** | `V1:AR-01` 대체 |
| IT-01a | IT | 자리별 게이트 좌표 + M5a | CHANGED → **SUPERSEDED → ΔV2 IT-01b** | `V1:IT-01` 대체 |
| AR-03a | AR | 예산 게이트 (A)~(G) + **(H′)** · (F)(H′) 범위에 testfixture | CHANGED → **SUPERSEDED → ΔV2 AR-03b** | `V1:AR-03` 대체 |
| IT-03a | IT | 트리 게이트 실행 · `--report` = EP-05a · CI 단계 | CHANGED → **SUPERSEDED → ΔV2 IT-03b** | `V1:IT-03` 대체 |
| MD-03 | MD | (H′) 자리 판정 알고리즘 — EP-12 7지점 | NEW → **SUPERSEDED → ΔV2 MD-03b** | — |
| UT-03 | UT | (H′) 분기별 단위 테스트 | NEW → **SUPERSEDED → ΔV2 UT-03b** | — |
| AT-05 | AT | AC16 회귀 | INHERITED | `V1:AT-05` — ΔV1이 테스트 파일 10곳을 바꿔 회귀로 다시 닫는다 |
| 그 밖의 V1 node | — | — | INHERITED | 무변경 |

### ΔV1 Pair registry

| Pair | left ↔ right / 레벨 | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-12 | MD-03 ↔ UT-03 / UT | **SUPERSEDED → ΔV2 VP-12b (§7-C)** | 테스트 소스 문자열 → (H′) 판정 → 자리·위반 목록 | `scripts/check-test-budgets.test.mjs` 신규 describe '규칙 (H′)' — EP-12 분기표의 입력마다 위반/통과 단언 | required — 판정 코드 변이 **M12**·**M13**·**M14**·**M16**·**M17** + r1 **X6** 재실행(아래 변이 표) | EP-12(7) |
| VP-09a | AR-03a ↔ IT-03a / IT | **SUPERSEDED → ΔV2 VP-09b (§7-C)** | 트리 → `node scripts/check-test-budgets.mjs` → exit · `--report` → CI 'Test budget guard' | `gate:node scripts/check-test-budgets.mjs`(트리 exit 0) · `--report` deadline 행 = `scan-deadlines.mjs app` 행(파일:줄 차집합 0) · Windows CI | required — V1 M3·M4·M6 승계 · **M11a**·**M11b**·**M15**·**X9′** | EP-03(20)·04(6)·05a(44)·06(3)·12(7) = 80 |
| VP-07a | AR-01a ↔ IT-01a / IT | **SUPERSEDED → ΔV2 VP-07b (§7-C)** | `scripts/test-time.mjs` → 예산 24자리 `scaleMs` → 타이머·abort·자식 프로세스·production 시간 인자 | 자리마다 `gate:node scripts/check-test-budgets.mjs` — 그 자리를 리터럴로 되돌리면 (H′) red(EP-05a `실패 의미` 상태) | required — **M5a**(새 예산 18자리 각각) · **X7′**·**X8′** · V1 M1·M2·M5·M6 승계 | EP-01(2)·02(1)·03(20)·04(6)·05a(44)·06(3) = 76 |
| VP-01a | R-01 ↔ AT-01a / AT | **SUPERSEDED → ΔV2 VP-01b (§7-C)** | 배율 해석 → config·setup·파일 예산·인라인·마감 44자리·픽스처 → 실행 | AC1~3·5·6·8: verify r1 §5 VP-01 좌표 승계 · AC7a·7b: VP-07a·VP-09a·VP-12 좌표 · 행동: VP-13 | VP-07a·VP-09a·VP-12 변이 | VP-07a와 같음(76) |
| VP-13 | R-01 ↔ AT-05 / AT | REGRESSION (ΔV2에서 다시 REGRESSION — §7-C) | 전체 스위트 — 깨끗한 호스트 · 저성능 모사 S2 | `evidence/clean-host-run.sh` · `slow-runner-run.sh … 8` · `newfails.mjs` — 실패 집합 = 기준 22, 신규 0 | not selected — 직접 행동 oracle | 바뀐 테스트 파일 10 |
| VP-01 · VP-07 · VP-09 | — | **SUPERSEDED** | — | VP-01a · VP-07a · VP-09a | — | — |
| VP-02~06 · 08 · 10 · 11 | V1 그대로 | NOT_REQUIRED | — | verify r1 §5 PASS 좌표 | — | 비영향: ΔV1은 예산 자리 18곳·게이트 (H)·`app/AGENTS.md`만 바꾼다. 배율 해석·워크플로(VP-02·10)·격리(VP-03·06·08·11)·배포 결합(VP-04)·고정 포트(VP-05) 경로에 닿지 않는다 |

- `SUPERSEDED` 이관: VP-01(AC1·2·3·5·6·7·8, M1~M6) → VP-01a(AC7 → AC7a) · VP-07(EP-01~06, M1~M6) → VP-07a(M5 → M5a로 자리 확장) · VP-09((A)~(H) 케이스, M3~M6) → VP-09a((H) → (H′)). 폐기 0.
- NEW·CHANGED 왼쪽 node ↔ 같은 레벨 REQUIRED pair: MD-03→VP-12(UT) · AR-03a→VP-09a(IT) · AR-01a→VP-07a(IT). R-01(INHERITED)은 오른쪽 AT-01a가 바뀌어 VP-01a(REQUIRED), AT-05는 VP-13(REGRESSION). 차집합 0.

### ΔV1 Acceptance — 정정·신설

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | ~~AT-01a / AC7a~~ (AC7 대체) → **SUPERSEDED → ΔV2 AC7c (§7-C)** | EP-05a 44자리 중 **예산 24**(이미 배율 6 — V1 EP-05 4 + 넓힌 술어가 새로 센 배율 자리 2 · 새로 배율 18)는 `scaleMs(기준값)`을 지나고 기준값은 현재 리터럴 그대로다. **의미 값 20**(V1 6 + 새 14)은 허용 목록 16항목 `{file, value, count, reason}`에 들고 항목마다 count = 자리 수다 | 게이트 (H′): 트리 exit 0 · 새 예산 18자리 각각을 리터럴로 되돌리면 exit 1(M5a) · 허용 자리 ±1이면 exit 1(M11a·b) · `--report` deadline 44행 = `scan-deadlines.mjs` 44행(파일:줄 차집합 0) | 테스트 본문의 타이머·`AbortSignal`·`now()` 마감·자식 프로세스·production 시간 인자 |
| R-01 | ~~AT-01a / AC7b~~ (신설) → **SUPERSEDED → ΔV2 AC7d (§7-C)** | (H′)는 EP-12의 7지점 규칙대로 판정한다 — 형태 7 · 값 해석 · 임계 1000(abort·자식 프로세스 무임계) · 제외 맥락(단 `expect(x)`의 x는 센다) · 허용 목록 count·reason · 이중 배율 · 범위 `*.test.ts`·`*.testfixture.ts(x)` | `check-test-budgets.test.mjs` '규칙 (H′)' — EP-12 표의 입력마다 위반 수·통과를 단언. 분기마다 구별 입력 ≥1, 형제 분기 입력과 맞바꾸면 결과가 뒤집힌다 | `scripts/check-test-budgets.mjs` |
| — | ~~AC19a~~ (신설) → **SUPERSEDED → ΔV2 AC19b (§7-C)** | `app/AGENTS.md`의 `check-test-budgets.mjs` 항목이 (H′)의 형태·임계·허용 목록 `count`·testfixture 범위를 적는다 · `node scripts/check-doc-inventory.mjs --check` green | 문서 diff + 인벤토리 게이트 | 문서 |

**AC 게이트 재통과**(§5) — 정정 1행 + 신설 2행:

- 행동 단언·검증 수단·도달 경로: 세 행 모두 세 칸을 갖는다.
- **방향**: AC7a는 "예산 자리가 `scaleMs`를 지난다"를 잠근다 — 자리에서 `scaleMs`를 지우면 게이트가 red다(M5a). 여분의 사본·잔여물에 반응하는 장치가 아니다.
- **자리를 말하는 불변식의 맞바꿈 축**: 허용 항목은 파일·값으로 자리를 가리킨다 — 다른 파일 같은 값(X6)·같은 파일 다른 개수(M11)가 red다.
- 음성 기준의 양성 짝: "허용 목록 밖 리터럴 0"은 "예산 24자리가 `scaled`로 보고된다"(`--report`)와 짝이다.
- 완결성 주장은 차집합으로 적었다 — `--report` ↔ 스캔의 파일:줄 차집합 0(합계가 아니다).
- structural proxy: AC7a·7b는 형태 게이트다. 형태가 지키는 행동(느린 러너 통과)은 VP-13(AC16 전체 스위트·저성능 모사)이 닫는다. opt-in 스위트 자리의 행동은 이 환경에서 관측 불가 — EP-05a `실패 의미`에 적었다.
- 사람 실기로 미룬 순수 로직 없음.
- AC 총수: V1 19 + AC7b + AC19a = **21**(AC7→AC7a는 번호 승계).

### ΔV1 §10 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| ~~AR-01a / VP-01a·07a·09a EP-05a~~ **SUPERSEDED → ΔV2 EP-05b (§7-C)** | 테스트 소유 실시간 마감(D-012) — 예산 = `scaleMs(기준값)` · 의미 값 = 허용 목록 `{file, value, count, reason}`(D-013·D-014) | 각 자리 + 게이트 `SEMANTIC_DELAYS` | 테스트 작성자 · 게이트 (H′) | **44자리** — 아래 EP-05a 목록 | `node docs/handoff/0294-slow-runner-hermetic-tests/evidence/scan-deadlines.mjs app` → 44(기준 `e7d40b4`) · TO-BE `node scripts/check-test-budgets.mjs --report` deadline 44 = 같은 스캔(파일:줄 차집합 0) | 리터럴 예산은 배율을 무시해 느린 러너에서 끊긴다 · 의미 값을 배율하면 시험 계약이 바뀐다 · 게이트 밖에 남는 차이는 아래 목록 |
| ~~MD-03 / VP-12 EP-12~~ **SUPERSEDED → ΔV2 EP-12b (§7-C)** | (H′) 판정 | `scripts/check-test-budgets.mjs` | 게이트 | **7지점** — 아래 EP-12 표 P1~P7 | 코드 자리가 아니라 판정 규칙이다 — 분모는 EP-12 표이고, 구현은 지점마다 UT 입력(같은 표 셋째 열)을 둔다 | 지점 하나가 빠지면 그 형태·맥락의 미배율 마감이 게이트를 통과한다 |

- **EP-05a 게이트가 초록인 채로 남는 차이**(§5 완료 조건 ≠ 목표):
  - import 상수·위치 인자로 넘기는 시간 값 — 값 해석이 같은 파일 상수까지다.
  - `/timeout/i` 밖 이름의 시간 인자 — 라벨 밖 36자리는 이번 턴에 읽어 상한 0을 확인했다(설계 근거 표).
  - 1초 미만 상한 예산 — 현재 0(`--all` 실측).
  - opt-in 스위트 자리의 **기준값만** 바꾼 고장(형태는 `scaleMs` 유지) — 그 스위트가 이 환경에서 skip이라 기계 oracle이 없다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 칸: 없음.
- **ΔV1 유효 강제 지점 전수**: V1 EP-01(2)·02(1)·03(20)·04(6)·06(3)·07(4)·08(2)·09(15)·10(13)·11(1) + **EP-05a(44)** + **EP-12(7)** = **118**(V1 EP-05 10은 supersede).

**EP-05a 목록** — 경로는 `app/src/` 기준, 줄은 `e7d40b4`. 구현 후 import 줄로 줄이 밀려도 자리는 파일·형태·기준값으로 같다.

| 처분 | 자리 (형태 · 현재 값) | 수 |
|---|---|---:|
| 예산 — 이미 배율 | `main/app/artifact-sdk-live.test.ts:72` timer `scaleMs(90_000)` · `main/app/managed-mcp.cli.integration.test.ts:323` timer `scaleMs(60_000)` · `:421` timer `scaleMs(10_000)` · `main/infra/config/file-mutation.test.ts:222` deadline `scaleMs(30_000)` · `:231` deadline 비교(같은 상수 경유) · `main/infra/git/temp-repo.testfixture.ts:80` timer `KILL_GRACE_MS`(EP-06과 같은 값) | 6 |
| **예산 — 새로 배율** | `main/adapters/opencode/v1/instance-lifecycle.test.ts:4` param `timeoutMs = 1000` · `main/adapters/opencode/v1/server.database-path.test.ts:74` option `timeoutMs: 1000` · `main/adapters/opencode/v1/server.test.ts:88` option `options.timeoutMs ?? 1000` · `main/app/deployment/mail.integration.test.ts:373` option `timeouts.connectMs: 1000` · `:374` 같음 | 5 |
| | `main/app/harnesses/opencode/native-storage.integration.test.ts:51` 자식 프로세스 `timeout: 300000` · `main/app/harnesses/opencode/native-storage.testfixture.ts:105` 자식 프로세스 `timeout: 90000` · `:189` abort `90000` · `:296` abort `90000` · `main/app/managed-mcp.cli.integration.test.ts:289` abort `40_000` | 5 |
| | `main/features/chat/background-tasks.test.ts:122`·`:130`·`:137`(`expect` 대상)·`:160` option `timeoutMs: 1_000` · `main/infra/net/pop3-tls.test.ts:48` `connectTimeoutMs: 3000` · `:49` `timeoutMs: 3000` · `renderer/src/app/boot/steps.test.ts:94` `mandatoryTimeoutMs: 10_000` · `:95` `optionalTimeoutMs: 10_000` | 8 |
| 의미 값 — V1 허용 | `main/adapters/opencode/v1/adapter.persistent.test.ts:302` timer `2700` · `main/adapters/opencode/v1/adapter.test.ts:343` deadline `5_001` · `:387` `5000` · `main/app/handlers/session-resources.claude-assembly.test.ts:109` timer `1000` · `main/features/plugins/mail/sync-manager.test.ts:40` timer `25_000` · `main/infra/git/git-snapshot.test.ts:52` deadline `60_000` | 6 |
| **의미 값 — 새 허용** | `main/app/chat-turn/background.monitor.test.ts:34`·`:306` `5000` · `:39`·`:254` `9000` · `main/app/handlers/engine.opencode.integration.test.ts:71` `8000` · `main/features/approvals/broker.test.ts:68`·`:98`·`:119` `1000` · `main/features/plugins/mail/sync-manager.test.ts:73` `15_000`·`30_000` · `main/infra/test-environment.test.ts:39` deadline 비교 `1_500` · `renderer/src/features/chat/lib/taskBoard.test.ts:303` `30_000` · `renderer/src/features/engine/harnesses/opencode/ProviderForm.interaction.test.ts:141` `3000` · `renderer/src/features/engine/harnesses/opencode/v1/customProvider.test.ts:75` `1200` | 14 |
| **합계** | 예산 24(이미 배율 6 + 새로 배율 18) · 의미 값 20(V1 허용 6 + 새 허용 14) | **44** |

**허용 목록 16항목** — `SEMANTIC_DELAYS`의 정본. V1 6항목은 사유를 유지하고 `count: 1`을 더한다.

| file (`app/src/` 기준) | value | count | reason |
|---|---|---:|---|
| `main/adapters/opencode/v1/adapter.persistent.test.ts` | `2700` | 1 | (V1 사유 유지) |
| `main/app/handlers/session-resources.claude-assembly.test.ts` | `1000` | 1 | (V1 사유 유지) |
| `main/features/plugins/mail/sync-manager.test.ts` | `25_000` | 1 | (V1 사유 유지) |
| `main/adapters/opencode/v1/adapter.test.ts` | `5_001` | 1 | (V1 사유 유지) |
| `main/adapters/opencode/v1/adapter.test.ts` | `5000` | 1 | (V1 사유 유지) |
| `main/infra/git/git-snapshot.test.ts` | `60_000` | 1 | (V1 사유 유지) |
| `main/app/chat-turn/background.monitor.test.ts` | `5000` | 2 | Monitor 도구 입력·출력 데이터 — production은 이 값으로 타이머를 걸지 않는다(같은 파일 'retains the provider timeout outcome…') |
| `main/app/chat-turn/background.monitor.test.ts` | `9000` | 2 | 같은 데이터 + 가짜 타이머로 요청 마감 경과를 만드는 값(`advanceTimersByTimeAsync(9001)`) |
| `main/app/handlers/engine.opencode.integration.test.ts` | `8000` | 1 | OpenCode provider 설정 문서의 데이터 — 왕복 보존을 시험한다, 대기가 아니다 |
| `main/features/approvals/broker.test.ts` | `1000` | 3 | 가짜 타이머 아래 승인 만료 계약값 — `advanceTimersByTime`과 짝이다 |
| `main/features/plugins/mail/sync-manager.test.ts` | `15_000` | 1 | 가짜 타이머 아래 연결 시간 초과 계약값(파일 전체 `useFakeTimers`) |
| `main/features/plugins/mail/sync-manager.test.ts` | `30_000` | 1 | 가짜 타이머 아래 명령 시간 초과 계약값 — 'slow' 응답(25_000)은 이보다 짧고 'command-timeout'은 이것을 넘긴다 |
| `main/infra/test-environment.test.ts` | `1_500` | 1 | `vi.waitFor`가 vitest 기본 1초보다 오래 재시도함을 보이는 하한 — 마감이 아니다 |
| `renderer/src/features/chat/lib/taskBoard.test.ts` | `30_000` | 1 | TaskOutput 도구 입력 데이터 |
| `renderer/src/features/engine/harnesses/opencode/ProviderForm.interaction.test.ts` | `3000` | 1 | provider 설정 데이터(가져오기 보존) |
| `renderer/src/features/engine/harnesses/opencode/v1/customProvider.test.ts` | `1200` | 1 | provider 설정 데이터 |

**EP-12 — (H′) 판정 7지점과 UT 입력** — 각 지점의 분기마다 구별 입력을 둔다. 입력은 `check-test-budgets.test.mjs`가 문자열 소스로 만든다(파일 범위 P1은 임시 디렉토리).

| 지점 | 규칙 | UT 입력 → 기대 |
|---|---|---|
| P1 파일 범위 | (F)(H′) = `*.test.ts`·`*.testfixture.ts`·`*.testfixture.tsx` · (A)~(E) = `*.test.ts`만 | 임시 트리 `a.test.ts`·`b.testfixture.ts`·`c.testfixture.tsx`(JSX 포함)에 각각 `AbortSignal.timeout(5000)` → 위반 3 · `d.ts` → 무시 · `b.testfixture.ts`의 `execFile('git', …)`는 (A)~(E) 위반 아님 |
| P2 형태 7 | timer(전역·`globalThis.`·`window.`·`timers/promises`의 `setTimeout` 첫 인자) · `x.setTimeout(N)` · `AbortSignal.timeout` · deadline(`now() + N`·`N + now()`·`<`·`<=`·`>`·`>=` 비교) · elapsed(`expect(now 식).toBeLessThan(OrEqual)`) · option(`/timeout/i` 키 · `/timeout/i` 이름 속성·변수에 담긴 중첩 객체의 숫자 속성) · param(`/timeout/i` 매개변수 기본값) | 하위 분기마다 미배율 `5000` 1개 → 각 1 위반 · 같은 입력을 `scaleMs(5000)`로 → 0 · `delayMs: 5000`(라벨 밖) → 0 |
| P3 값 해석 | 리터럴 · 같은 파일 `const` · `??`/`\|\|` 오른쪽 · 리터럴 `*`/`+` · `scaleMs(…)` = 배율 · import 식별자 = 건너뜀 | `const T = 30_000; setTimeout(f, T)` 위반 · `x ?? 2000` 위반 · `x ?? scaleMs(2000)` 통과 · `60 * 1000` 위반 · `import { T } …; setTimeout(f, T)` 통과 |
| P4 임계 | ≥1000ms · abort·자식 프로세스(`execFile`·`execFileSync`·`spawn`·`spawnSync`·`exec`·`execSync`·`fork`) 옵션의 timeout은 무임계 | `setTimeout(f, 999)` 통과 · `setTimeout(f, 1000)` 위반 · `AbortSignal.timeout(10)` 위반 · `execFile(c, a, { timeout: 10 })` 위반 · `pool({ timeoutMs: 10 })` 통과 |
| P5 제외 | `scaleMs`·`scaledBudget`·`vi.setConfig` 인자 · `vi.waitFor` 옵션(둘째 인자) · it/test/describe/훅 타임아웃 인자((F) 몫) · matcher 피연산자 — 단 `expect(x)`의 x와 elapsed 형태의 상한 인자는 센다 | `vi.waitFor(cb, { timeout: 4000 })` 통과 · `vi.waitFor(() => setTimeout(f, 4000))` 위반 · `expect(x).toMatchObject({ timeout: 60_000 })` 통과 · `expect(wait({ timeoutMs: 1000 })).resolves.toBe(…)` 위반 · `expect(Date.now() - start).toBeLessThan(5000)` 위반 · `it('x', fn, scaleMs(5000))` (H′) 0 |
| P6 허용 목록 | 미등록 리터럴 위반 · 항목 count = 같은 파일·같은 값 자리 수 · reason 빈 값 위반 · 다른 파일 같은 값 위반 | 항목 `{file:'a', value:'5000', count:2, reason:'r'}` + 자리 2 → 통과 · 자리 3 → 위반 · 자리 1 → 위반 · reason `''` → 위반 · 파일 `b`의 `5000` → 위반 |
| P7 이중 배율 | `vi.waitFor` 옵션(숫자·객체) 안의 `scaleMs` 위반 | `vi.waitFor(cb, { timeout: scaleMs(4000) })` 위반 · `vi.waitFor(cb, scaleMs(4000))` 위반 |

**ΔV1 등록 변이** — 자리를 적었다. 판정 코드 변이(M12~M17·X6)는 UT(VP-12), 트리 변이는 게이트(VP-07a·09a)가 잡아야 한다.

| ID | 자리 | 바꾼 내용 | 잡아야 할 oracle |
|---|---|---|---|
| M5a-1~18 | EP-05a "예산 — 새로 배율" 18자리 **각각** | `scaleMs(N)` → `N` | `gate:node scripts/check-test-budgets.mjs` exit 1 |
| X7′ (r1 X7) | `main/app/managed-mcp.cli.integration.test.ts` abort 자리 | 인자 → `10` | 같은 게이트(abort 무임계) |
| X8′ (r1 X8) | `main/app/harnesses/opencode/native-storage.integration.test.ts` 자식 프로세스 `timeout` | 값 → `10` | 같은 게이트(자식 프로세스 무임계) |
| X9′ (r1 X9) | `main/infra/config/file-mutation.test.ts` | `const T = 30_000` + `setTimeout(() => {}, T)` 추가 | 같은 게이트(상수 해석) |
| M11a | `main/features/approvals/broker.test.ts` | `{ timeoutMs: 1000 }` 자리 1개 추가 | 같은 게이트(count 3 ≠ 4) |
| M11b | `renderer/src/features/chat/lib/taskBoard.test.ts` | `timeout: 30_000` 속성 삭제 | 같은 게이트(count 1 ≠ 0) |
| M15 | `main/app/chat-turn/opencode-continuation.test.ts`의 `vi.waitFor` 옵션 | `timeout: 5000` → `timeout: scaleMs(5000)` | 같은 게이트(이중 배율) |
| M12 | 판정 코드 P5 | `expect(x)`의 x도 제외 | UT P5 `expect(wait(…)).resolves` 입력 |
| M13 | 판정 코드 P2 | 중첩 `timeouts` 객체 규칙 삭제 | UT P2 중첩 객체 입력 |
| M14 | 판정 코드 P5 | `vi.waitFor` 제외를 첫 인자로 | UT P5 두 입력 + 트리 게이트(`vi.waitFor` 옵션 리터럴 13자리가 위반으로) |
| M16 | 판정 코드 P1 | (H′) 범위를 `*.test.ts`로 | UT P1 `b.testfixture.ts`·`c.testfixture.tsx` |
| M17 | 판정 코드 P4 | abort에 임계 재도입 | UT P4 `AbortSignal.timeout(10)` + X7′ |
| X6 (r1) | 판정 코드 P6 | 허용 대조에서 파일 비교 삭제 | UT P6 파일 `b` 입력 |

### ΔV1 구현 설계

| 변경 파일 | 변경 내용 | 테스트 seam |
|---|---|---|
| `app/scripts/check-test-budgets.mjs` | (H) → (H′): deadline 수집을 EP-12 P1~P7로 교체 · (F)(H′)용 파일 목록(test + testfixture)을 따로 두고 (A)~(E)는 기존 `listTestFiles` 유지 · `SEMANTIC_DELAYS` 16항목 `{file, value, count, reason}` · count·reason·이중 배율 위반 · `--report` deadline 행에 형태 열 · 헤더 주석 (H′) | 순수 함수(`scanBudgetSites`·대조 함수) export → UT |
| `app/scripts/check-test-budgets.test.mjs` | '규칙 (H′)' describe — EP-12 표의 입력 전부. V1 (H) 3케이스는 (H′) 아래로 옮겨 유지 | node test |
| 새 예산 18자리 10파일 | `scaleMs(기준값)` + `scripts/test-time.mjs` import(파일마다 상대 경로) — 기준값은 현재 리터럴 그대로 · `server.test.ts`는 `options.timeoutMs ?? scaleMs(1000)` · `instance-lifecycle.test.ts`는 `timeoutMs = scaleMs(1000)` · `native-storage.testfixture.ts`는 esbuild 번들이라 같은 import로 해석된다 | 게이트 + 각 파일 green |
| `app/AGENTS.md` | `check-test-budgets.mjs` 항목의 (H) 서술 → (H′)(형태·임계·`count`·testfixture 범위) | AC19a |

- 이중 배율 금지 문구(§12)는 바뀌지 않는다 — (H′)가 그 강제 지점이 된다.
- 신규 의존성 없음. production 코드 무변경(§6 비범위 유지).
- 비범위: `app/scripts/smoke-*.mjs`(사람이 실제 실행 파일로 돌리는 수동 도구 — `npm test`·CI 밖, 자체 `--timeout-ms` 옵션) · production 타이머 상수(예 `RUNTIME_RESPONSE_TIMEOUT_MS`).

### ΔV1 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint·typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error |
| node scripts 테스트 | 게이트 코드·테스트 변경 | `node --test "scripts/*.test.mjs"` | 전부 |
| 예산·인벤토리 게이트 | (H′) · 문서 | `node scripts/check-test-budgets.mjs` · `--report` ↔ `scan-deadlines.mjs` 차집합 · `node scripts/check-doc-inventory.mjs --check` | 전부 |
| vitest | 바뀐 테스트 10파일 + 회귀 | `./node_modules/.bin/vitest run` — 리눅스 기준선 22건 분리 · 저성능 모사 S2 | 22건 밖 신규 실패 |
| Windows CI | 정본 통합 게이트 · 'Test budget guard' 단계 | PR `CI` 실행 | 전부 |
| commit trailer | message bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

### ΔV1 READY self-review

- Decision 보존: D-001~D-011 무변경, D-012~D-014 추가(§3 갱신 메모에 대조 1줄) — 사용자 결정 변경 없음.
- §10 gap을 자리 하나씩 더하지 않고 pair 목록 전체를 다시 열거했다 — 자리 검색 명령 `scan-deadlines.mjs`(술어 = D-012 주어, 범위 = 테스트 소스 전체)로 44, 이 수를 분모로 고정.
- 술어 라벨 표본 확인: `/timeout/i` 44자리 전부 참 · 라벨 밖 시간 키 36자리 중 `connectMs`·`commandMs` 4자리(중첩 `timeouts`)를 술어에 넣었다. 나머지 32는 이름별 표본(`durationMs`·`duration_ms` — 이벤트 payload의 경과 기록 9파일, `intervalMs` — scheduler 주기, `retry_delay_ms`·`timedOutAfterMs`·`createdAtMs` — 데이터)이 상한이 아니다.
- 임계의 근거 실측: 1초 미만 46자리(option 13·timer 33) 전부 시간 초과 유발값·하한 대기 · abort·자식 프로세스 1초 미만 0.
- 새 왼쪽 node ↔ 같은 레벨 REQUIRED pair 차집합 0 · SUPERSEDED 3 pair의 AC·변이 이관 표기 · 비영향 pair 8개는 NOT_REQUIRED + r1 좌표.
- 자리별 oracle: 예산 24자리 = 게이트 좌표(자리마다 M5a) · 의미 값 20자리 = 허용 항목 count · 판정 7지점 = UT 분기 입력(EP-12 표).
- 장치 방향: `scaleMs`를 지우면 red(M5a) · 허용 자리 ±1이면 red(M11) · 다른 파일 같은 값 red(X6) · 판정 분기를 지우면 UT red(M12~M17).
- 측정되지 않은 보호를 규범 행에 적지 않았다 — opt-in 스위트 자리의 기준값 축은 oracle 없음으로 `실패 의미`에 적었다.
- 사람 실기 추가 없음(AC18 그대로).

## 7-C. ΔV2 — verify r2 D2 `BLOCKING` · D3 `PLAN_GAP` 정정

> **적용 순서: `V1` → `ΔV1` → `ΔV2`.** verify r2([verify.md](verify.md) r2-13 D2·D3)가 돌려보낸 (H′) 판정을 **같은 파일 바인딩 해석 하나**로 다시 정의하고, 그 규칙으로 EP-05 자리 목록을 다시 열거해 **62자리**로 고정한다. 구 행(§7-B AC7a·AC7b·AC19a · VP-12·VP-07a·VP-09a·VP-01a · EP-05a·EP-12)은 그 자리에 두고 `SUPERSEDED`로 가리킨다. 결정은 §3 D-015·D-016(D-012 대체).

### 무엇이 왜 바뀌는가

| verify r2 지적 | 진단 | ΔV2의 답 |
|---|---|---|
| D2(a) 단축 속성 `{ timeoutMs }` exit 0 (Y1) | option 슬롯을 `PropertyAssignment`만 봤다 | P2′ 슬롯 전수 — 속성·단축 속성·대입·클래스 필드·구조 분해 기본값·이름 변수 |
| D2(b) const에 담은 `vi.waitFor` 옵션 — `scaleMs` green(Y2) · 기준값 red(Y2b) | 제외·이중 배율이 인라인 둘째 인자만 봤다 | P5′ 맥락을 바인딩 참조 자리에서 판정 · P7′ 옵션을 해석기로 따라가 `scaleMs`를 찾는다 |
| D3 now 식 변수(Y5) · 파생 마감(Y5b) · 구조 분해 기본값(Y11) exit 0 | 형태의 **대상**(now 식·이름)을 문법 노드로만 봤다 — 값만 같은 파일 const를 따라갔다 | D-015 판정이 읽는 모든 식 자리를 해석기 하나로 푼다 · P8 now 식 |
| Review Signal — r1·r2가 같은 축("D-012 주어보다 좁은 판정") | 지적된 문법을 하나씩 넓혔다 | 해석 범위를 TS 선언 종류로 전수 열거하고 경계 밖을 실측했다(아래 표) |
| Review Signal — 게이트와 자리 검색 명령이 같은 알고리즘 사본 | `--report` = 스캔 차집합 0이 독립 측정이 아니었다 | 자리 검색 명령을 새로 쓴 시제품 `scan-deadlines-v2.mjs`로 두고 구현은 복사하지 않는다 · 텍스트 술어 독립 재열거 `broad-time-lines.sh`를 함께 둔다 |
| (유지) 규칙 (F)는 바인딩을 따라가지 않는다 | 인라인 `scaledBudget(…)`·`scaleMs(…)`만 통과 — 바인딩 경유 배율도 red(fail-closed, `check-test-budgets.mjs:526`·`:534`) | 바꾸지 않는다 — 거짓 green이 없고 처방(인라인)이 위반 문구에 있다 |

### 설계 근거 — 이번 턴 측정

기준 트리 `544eb01`(r2 검증 HEAD — 브랜치 좌표, `main` 미병합). 앱 코드는 r2 구현 `f73927a`와 같다(`git diff --stat f73927a 544eb01 -- app` 0줄). 증거 경로 접두사 `docs/handoff/0294-slow-runner-hermetic-tests/evidence/`.

| 관측 | 명령 | 결과 | 설계에 미친 영향 |
|---|---|---|---|
| ΔV1 분모 재확인 | `--report` deadline ↔ `scan-deadlines.mjs app` | 44 = 44, 파일:줄 차집합 0 | 기준 |
| ΔV2 술어 전수 | `node …/scan-deadlines-v2.mjs app` | **62** — 예산(배율) 24 · 의미 값 38 = ΔV1 44 − 1 + 19 | EP-05b 분모 |
| 빠진 1 | 같음 | `main/infra/config/file-mutation.test.ts:231` `Date.now() < deadline` — `deadline`이 now 식(`:222`)이라 now 식끼리 비교 | 그 마감의 자리는 `:222` 덧셈 하나(P8) |
| 새 19 | 같음 | 배율 1(`main/infra/git/temp-repo.testfixture.ts:43` named `FIXTURE_GIT_TIMEOUT_MS = scaleMs(600_000)`) · 의미 값 18(`now += N` 17 · `now + 5000` 1) | 허용 목록 7항목 추가 · 테스트 소스 변경 0 |
| 새 의미 값 18 분류 | 파일 읽기 | 가짜 시계 진행 11 — `discovery-cache.poll-race.test.ts:23`·`discovery-cache.test.ts:33` `vi.spyOn(Date, 'now').mockImplementation(() => now)` · mtime 데이터 1 — `poll-race:149-150` `utimes` · 주입 시계 진행 7 — `mail.integration.test.ts` `now: () => now` | D-013 의미 값(가짜 시계·데이터) |
| 풀리지 않은 형태 자리 | `… --unresolved` | 50 — 시간 수 아님 24(객체·함수·문자열·타이머 핸들·전역 함수 참조) · 테스트 지원 파일 import 20(`FIXTURE_GIT_TIMEOUT_MS` — 그 파일의 named 자리) · 경계 6(콜백 매개변수 4 · 비리터럴 멤버 `input.timeout_ms` 2) | 경계 6은 값을 런타임 호출자가 고른다 — D-015 경계 |
| 경계 — 맥락의 함수 경유 | `node …/scan-option-args.mjs <app 절대경로>` | `vi.waitFor` 옵션 인자 16 · 자식 프로세스 옵션 객체 7 — 전부 인라인 객체. 그 밖의 인자는 production이 부르는 콜백(`spawnProcess` 등)·데이터 | 맥락은 변수 참조까지만 따라간다(D-016) |
| 경계 — 위치 인자 | `node …/scan-positional-args.mjs <app 절대경로>` | 59 — production·라이브러리 함수의 위치 인자(포맷터·크기·억제 창·주입 시계·포트) · 실시간 상한 0 | 남는 차이로 적는다 |
| 독립 재열거 | `bash …/broad-time-lines.sh app` | 텍스트 술어 326줄 · 자리 줄 60 · 나머지 266 = 자동 분류 213(가짜 시계 57 · 데이터 키 48 · 과거 시각 33 · 고정 시각 30 · (F) 21 · 단언 11 · `vi.waitFor` 옵션 7 · `scaleMs` 인자 6) + 수동 53(여러 줄 `vi.waitFor` 옵션 5 · 주입 시계 값·크기·데이터·테스트 이름 48) — 실제 상한 0 | 게이트 알고리즘과 다른 방법으로 분모 확인 |
| 임계 | `… --all` | 1초 미만 51(timer 33 · option 18) · 새 형태(named·`+=`·구조 분해·대입·클래스 필드)의 1초 미만 0 | 임계 1000 · abort·자식 프로세스 무임계 유지 |
| 스코프 해석 | 탐침 B0 | ΔV1 이름 맵은 같은 이름 `const t`가 다른 블록에 둘이면 마지막 선언으로 푼다 — 블록 순서를 바꾸면 리터럴이 `scaleMs`에 가려진다 | 검사기 심볼로 해석(B0) |
| EP-12b 분기 탐침 | `… --probe < …/ep12b-probe.json` | 131입력(verify r2 Y-행 7 · 새 분기 63 · ΔV1 UT 입력 61) → 기대와 같음(`ep12b-probe.expected.tsv`) · ΔV1 입력 61은 ΔV1 게이트와 같은 판정 | P1~P9가 서로 모순 없이 구현 가능 · ΔV1 판정 회귀 0 |
| 해석 비용 | 같은 스캔 | 926파일 5.0s(파일마다 단일 파일 program, `noLib`·`noResolve`) · 현재 게이트 1.4s | CI 'Test budget guard' 증가 수 초 · 신규 의존성 없음(`typescript` 기존) |

### ΔV2 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 A · D-001 | INHERITED | `V1:R-01` |
| AT-01b | AT | AC1·2·3·5·6·**7c·7d**·8 | CHANGED → **SUPERSEDED → ΔV3 AT-01c** | `ΔV1:AT-01a` 대체(AC7a → AC7c, AC7b → AC7d) |
| AR-01b · IT-01b | AR · IT | 배율 SSOT ↔ 예산 24자리(EP-05b 구성: `:231` 빠짐 · `temp-repo:43` 더함) · 자리별 게이트 좌표 | CHANGED | `ΔV1:AR-01a`·`IT-01a` 대체 |
| AR-03b · IT-03b | AR · IT | 게이트 (A)~(G) + (H′) 바인딩 해석 · 허용 23항목 · `--report` 값 열 | CHANGED → **SUPERSEDED → ΔV4 AR-03c · IT-03c** | `ΔV1:AR-03a`·`IT-03a` 대체 |
| MD-03b · UT-03b | MD · UT | (H′) 판정 — EP-12b 9지점 | CHANGED → **SUPERSEDED → ΔV3 MD-03c · UT-03c** | `ΔV1:MD-03`·`UT-03` 대체 |
| AT-05 | AT | AC16 회귀 | INHERITED | `V1:AT-05` |
| 그 밖의 node | — | — | INHERITED | 무변경 |

### ΔV2 Pair registry

| Pair | left ↔ right / 레벨 | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-12b | MD-03b ↔ UT-03b / UT | **SUPERSEDED → ΔV3 VP-12c (§7-D)** | 테스트 소스 문자열 → 해석기(B) → 형태·맥락 판정 → 자리·위반 | `scripts/check-test-budgets.test.mjs` 새 describe '바인딩 해석 (0294 ΔV2)' — EP-12b 표 입력마다 위반 수 단언 · 기존 '규칙 (H′)' 유지 | required — **M18~M38**(아래 변이 표) + verify r2 Y1·Y2·Y2b·Y5·Y5b·Y11 재실행 | EP-12b(9) |
| VP-09b | AR-03b ↔ IT-03b / IT | **SUPERSEDED → ΔV4 VP-09c (§7-E)** | 트리 → `node scripts/check-test-budgets.mjs` → exit · `--report` → CI 'Test budget guard' | `gate:node scripts/check-test-budgets.mjs`(트리 exit 0) · `--report` deadline 62행 = `scan-deadlines-v2.mjs` 62행(아래 대조 명령 0줄) · Windows CI | required — **M11c**·**M11d** · Y-트리 변이 · ΔV1 승계 M3·M4·M6·M11a·M11b·M15·X9′ | EP-03(20)·04(6)·05b(62)·06(3)·12b(9) = 100 |
| VP-07b | AR-01b ↔ IT-01b / IT | REQUIRED | `scripts/test-time.mjs` → 예산 24자리 `scaleMs` → 타이머·abort·자식 프로세스·production 시간 인자·이름 변수 | 자리마다 `gate:node scripts/check-test-budgets.mjs` — 그 자리를 리터럴로 되돌리면 exit 1 | required — **M5b**(24자리 각각) · X7′·X8′ · V1 M1·M2·M6 승계 | EP-01(2)·02(1)·03(20)·04(6)·05b(62)·06(3) = 94 |
| VP-01b | R-01 ↔ AT-01b / AT | **SUPERSEDED → ΔV3 VP-01c (§7-D)** | 배율 해석 → config·setup·파일 예산·인라인·마감 62자리·픽스처 → 실행 | AC1~3·5·6·8: verify r1 §5 좌표 승계 · AC7c·7d: VP-07b·09b·12b 좌표 | VP-07b·09b·12b 변이 | VP-07b와 같음(94) |
| VP-13 | R-01 ↔ AT-05 / AT | REGRESSION | 전체 스위트 — 깨끗한 호스트 | `evidence/clean-host-run.sh` + `newfails.mjs` — 실패 집합 = 기준 22, added 0 · `git diff --stat <ΔV2 설계 커밋>..HEAD -- app/src` 0줄 | not selected — 직접 행동 oracle | 0 — ΔV2는 테스트 소스를 바꾸지 않는다 |
| VP-12 · VP-09a · VP-07a · VP-01a | — | **SUPERSEDED** | — | VP-12b · VP-09b · VP-07b · VP-01b | — | — |
| VP-02~06 · 08 · 10 · 11 | V1 그대로 | NOT_REQUIRED | — | verify r1 §5 · r2-5 좌표 | — | 비영향: ΔV2는 게이트 2파일·`app/AGENTS.md`만 바꾼다. 배율 해석·워크플로·격리·배포 결합·고정 포트 경로에 닿지 않는다 |

- `SUPERSEDED` 이관: VP-12(EP-12 P1~P7 UT 입력, M12~M17·X6) → VP-12b(P1·P6 그대로, P2~P5·P7 입력 승계 + 새 분기) · VP-09a(M3·M4·M6·M11a·M11b·M15·X9′) → VP-09b · VP-07a(M5a-01~18·X7′·X8′·M1·M2·M5) → VP-07b(M5b가 M5a를 24자리로 확장) · VP-01a(AC7a·7b) → VP-01b(AC7c·7d). 폐기 0.
- NEW·CHANGED 왼쪽 node ↔ 같은 레벨 REQUIRED pair: MD-03b→VP-12b(UT) · AR-03b→VP-09b(IT) · AR-01b→VP-07b(IT) · R-01(INHERITED, 오른쪽 AT-01b CHANGED)→VP-01b · AT-05→VP-13(REGRESSION). 차집합 0.
- **대조 명령**(VP-09b, AC7c): `cd app && diff <(node scripts/check-test-budgets.mjs --report | awk -F'\t' '$1=="deadline"{print $2"\t"$4"\t"$5}' | sort) <(node ../docs/handoff/0294-slow-runner-hermetic-tests/evidence/scan-deadlines-v2.mjs . 2>/dev/null | awk -F'\t' '{print $2"\t"$1"\t"$3}' | sort)` → 0줄. 열은 `파일:슬롯 줄 · 형태 · 값(리터럴 원문 | scaleMs)`.

### ΔV2 Acceptance — 정정

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | **AT-01b / AC7c** (AC7a 대체) | EP-05b 62자리 중 **예산 24**는 `scaleMs(기준값)`을 지나고 기준값은 현재 리터럴 그대로다(테스트 소스 변경 0). **의미 값 38**은 허용 목록 23항목(ΔV1 16 + 새 7) `{file, value, count, reason}`에 들고 항목마다 count = 자리 수다 | 게이트 (H′): 트리 exit 0 · 예산 24자리 각각을 리터럴로 되돌리면 exit 1(M5b) · 새 허용 자리 ±1이면 exit 1(M11c·M11d) · 대조 명령 0줄 | 테스트 본문의 타이머·abort·now 마감·자식 프로세스·production 시간 인자·이름 변수 |
| R-01 | ~~AT-01b / AC7d~~ (AC7b 대체) → **SUPERSEDED → ΔV3 AC7e (§7-D)** | (H′)는 EP-12b 9지점 규칙대로 판정한다 — 해석기(B0~B7)·경계 · 형태 8 · 슬롯 · now 식 · 맥락(참조 자리) · 임계 · 허용 목록 · 이중 배율 · 자리 동일성. verify r2 Y1·Y2·Y5·Y5b·Y11은 위반 1(배율 입력 0), Y2b·Y2e는 0 | `check-test-budgets.test.mjs` '바인딩 해석 (0294 ΔV2)' — EP-12b 표의 입력마다 위반 수 단언. 분기마다 구별 입력 ≥1 · 배율 입력과 맞바꾸면 결과가 뒤집힌다 | `scripts/check-test-budgets.mjs` |
| — | ~~**AC19b**~~ (AC19a 대체) → **SUPERSEDED → ΔV4 AC19c (§7-E)** | `app/AGENTS.md`의 `check-test-budgets.mjs` 항목이 (H′)의 바인딩 해석 범위·경계, 슬롯(단축 속성·대입·클래스 필드·구조 분해 기본값·이름 변수), now 원천 4종·`+=`, 맥락 판정을 적는다 · `node scripts/check-doc-inventory.mjs --check` green | 문서 diff + 인벤토리 게이트 | 문서 |

**AC 게이트 재통과**(§5) — 정정 3행:

- 행동 단언·검증 수단·도달 경로: 세 행 모두 세 칸을 갖는다.
- **방향**: AC7c는 "예산 자리가 `scaleMs`를 지난다"를 잠근다 — 자리에서 `scaleMs`를 지우면 red(M5b). AC7d의 "정상 코드는 통과"(Y2b·Y2e·Y5g·Y5i)는 반대 방향(오탐)을 잠근다 — M30·M36이 그 방향의 변이다.
- **자리를 말하는 불변식의 맞바꿈 축**: 허용 항목은 파일·값으로 자리를 가리킨다 — 다른 파일 같은 값(X6)·같은 파일 다른 개수(M11c·M11d)가 red다. 맥락 판정의 "전부/하나라도"는 서로 맞바꾸면 Y2f·P4 입력이 뒤집힌다(M31).
- 완결성 주장은 차집합으로 적었다 — 대조 명령의 `diff` 출력 0줄(파일:줄·형태·값). 합계 62는 그 결과다.
- structural proxy: AC7c·7d는 형태 게이트다. 형태가 지키는 행동(느린 러너 통과)은 VP-13 회귀와 V1·ΔV1 S2 실측이 닫는다 — ΔV2는 테스트 소스를 바꾸지 않아 실행 시간이 바뀌지 않는다.
- 사람 실기로 미룬 순수 로직 없음.
- AC 총수: **21** 그대로(AC7a → AC7c · AC7b → AC7d · AC19a → AC19b 번호 승계).

### ΔV2 §10 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-01b / VP-01b·07b·09b **EP-05b** | 테스트 소유 실시간 마감(D-015) — 예산 = `scaleMs(기준값)` · 의미 값 = 허용 목록 `{file, value, count, reason}`(D-013·D-014) | 각 자리 + 게이트 `SEMANTIC_DELAYS` | 테스트 작성자 · 게이트 (H′) | **62자리** — 아래 EP-05b 목록 | `node docs/handoff/0294-slow-runner-hermetic-tests/evidence/scan-deadlines-v2.mjs app` → 62(기준 `544eb01`) · TO-BE 대조 명령 0줄 · 독립 `broad-time-lines.sh` 나머지 266줄 실제 상한 0 | 리터럴 예산은 배율을 무시해 느린 러너에서 끊긴다 · 의미 값을 배율하면 시험 계약이 바뀐다 · 게이트 밖에 남는 차이는 아래 목록 |
| MD-03b / VP-12b **EP-12b** — 규칙 칸은 유효, 분모·UT 입력 칸은 **SUPERSEDED → ΔV3 EP-12c (§7-D)** | (H′) 판정 | `scripts/check-test-budgets.mjs` | 게이트 | **9지점** — 아래 EP-12b 표 P1~P9 | 판정 규칙이다 — 분모는 EP-12b 표이고 구현은 지점마다 UT 입력(같은 표 셋째 열)을 둔다 | 지점 하나가 빠지면 그 문법·바인딩을 지나는 미배율 마감이 게이트를 통과하거나(거짓 green) 정상 코드가 red가 된다(오탐) |

- **EP-05b 게이트가 초록인 채로 남는 차이**(§5 완료 조건 ≠ 목표) — 전부 D-015 경계이고 이번 턴에 쟀다:
  - 같은 파일 선언에 닿지 않는 호출(production·라이브러리)의 위치 인자 — 트리 59, 실시간 상한 0(`scan-positional-args.mjs`).
  - 그런 호출이 부르는 콜백의 매개변수 · 객체 리터럴로 풀리지 않는 값의 멤버 — 트리 6, 값을 런타임 호출자가 고른다(`--unresolved`).
  - production 모듈 import 상수 — §6 비범위. 테스트 소스의 export는 그 파일에서 자리로 센다.
  - 함수 인자·반환을 거친 객체의 맥락(제외·무임계) — 선언 자리에서 판정한다. 트리 0: `vi.waitFor` 옵션 인자 16 전부 인라인 객체 · 자식 프로세스 옵션 객체 7 전부 인라인, 나머지 인자는 production이 부르는 콜백·데이터(`scan-option-args.mjs`).
  - 1초 미만 상한 예산 — 새 형태 포함 0(`--all`). opt-in 스위트 자리의 기준값 축 — ΔV1 그대로.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 칸: 없음.
- **ΔV2 유효 강제 지점 전수**: V1 EP-01(2)·02(1)·03(20)·04(6)·06(3)·07(4)·08(2)·09(15)·10(13)·11(1) = 67 + **EP-05b(62)** + **EP-12b(9)** = **138**(ΔV1 EP-05a 44·EP-12 7은 supersede).

**EP-05b 목록** — 경로는 `app/src/` 기준, 줄은 `544eb01`(= `f73927a` 앱 코드). 자리 줄은 슬롯 줄이고, 값이 다른 줄이면 괄호에 값 줄을 적는다.

| 처분 | 자리 (형태 · 현재 값) | 수 |
|---|---|---:|
| 예산 — 배율(ΔV1 이미 배율 6에서 `file-mutation:231` 빠지고 `temp-repo:43` 더함) | `main/app/artifact-sdk-live.test.ts:72` timer(값 `:75`) · `main/app/managed-mcp.cli.integration.test.ts:323` timer · `:421` timer · `main/infra/config/file-mutation.test.ts:222` deadline · `main/infra/git/temp-repo.testfixture.ts:43` named `FIXTURE_GIT_TIMEOUT_MS` · `:80` timer(값 `:27` `KILL_GRACE_MS`) | 6 |
| 예산 — 배율(ΔV1 새로 배율 18, r2 구현) | `main/adapters/opencode/v1/instance-lifecycle.test.ts:5` param · `server.database-path.test.ts:75` option · `server.test.ts:89` option · `main/app/deployment/mail.integration.test.ts:374`·`:375` option · `main/app/harnesses/opencode/native-storage.integration.test.ts:51` option(자식 프로세스) · `native-storage.testfixture.ts:106` option(자식 프로세스) · `:190`·`:297` abort · `main/app/managed-mcp.cli.integration.test.ts:289` abort | 10 |
| | `main/features/chat/background-tasks.test.ts:123`·`:131`·`:138`·`:163` option · `main/infra/net/pop3-tls.test.ts:49`·`:50` option · `renderer/src/app/boot/steps.test.ts:95`·`:96` option | 8 |
| 의미 값 — ΔV1 허용 | `main/adapters/opencode/v1/adapter.persistent.test.ts:302` timer `2700` · `adapter.test.ts:343` `5_001` · `:387` `5000` · `main/app/chat-turn/background.monitor.test.ts:34`·`:306` `5000` · `:39`·`:254` `9000` · `main/app/handlers/engine.opencode.integration.test.ts:71` `8000` · `session-resources.claude-assembly.test.ts:109` `1000` | 9 |
| | `main/features/approvals/broker.test.ts:68`·`:98`·`:119` `1000` · `main/features/plugins/mail/sync-manager.test.ts:40` `25_000` · `:73` `15_000`·`30_000` · `main/infra/git/git-snapshot.test.ts:52` `60_000` · `main/infra/test-environment.test.ts:39` `1_500` · `renderer/src/features/chat/lib/taskBoard.test.ts:303` `30_000` · `renderer/src/features/engine/harnesses/opencode/ProviderForm.interaction.test.ts:141` `3000` · `renderer/src/features/engine/harnesses/opencode/v1/customProvider.test.ts:75` `1200` | 11 |
| **의미 값 — ΔV2 새 허용** | `main/adapters/opencode/v1/discovery-cache.poll-race.test.ts:70`·`:93`·`:98`·`:168`·`:171`·`:201`·`:238`·`:254`·`:267` deadline `now += 1001` · `:149` deadline `now + 5000` · `discovery-cache.test.ts:29` deadline `now += 1001` | 11 |
| | `main/app/deployment/mail.integration.test.ts:503` `299_000` · `:506` `2_000` · `:513`·`:557`·`:684`·`:691` `301_000` · `:519` `15 * 86400_000` (전부 deadline `now += …`) | 7 |
| **합계** | 예산 24 · 의미 값 38(ΔV1 20 + 새 18) | **62** |

**허용 목록 새 7항목** — ΔV1 16항목은 그대로 둔다(합 23항목 · count 합 38).

| file (`app/src/` 기준) | value | count | reason |
|---|---|---:|---|
| `main/adapters/opencode/v1/discovery-cache.poll-race.test.ts` | `1001` | 9 | `Date.now` mock 시계(`now`)를 캐시 신선도 1초 너머로 진행하는 값 — 실시간 대기가 아니다 |
| `main/adapters/opencode/v1/discovery-cache.poll-race.test.ts` | `5000` | 1 | `utimes`로 쓰는 파일 mtime 데이터 — 대기가 아니다 |
| `main/adapters/opencode/v1/discovery-cache.test.ts` | `1001` | 1 | `Date.now` mock 시계 진행(캐시 만료) |
| `main/app/deployment/mail.integration.test.ts` | `299_000` | 1 | 동기화 관리자에 주입한 시계(`now: () => now`)를 신선도 5분 직전까지 진행 |
| `main/app/deployment/mail.integration.test.ts` | `2_000` | 1 | 같은 주입 시계로 신선도 5분 경계를 넘긴다 |
| `main/app/deployment/mail.integration.test.ts` | `301_000` | 4 | 같은 주입 시계로 신선도 5분을 넘긴다 |
| `main/app/deployment/mail.integration.test.ts` | `15 * 86400_000` | 1 | 같은 주입 시계로 보존 기간 경계를 넘긴다 |

**EP-12b — (H′) 판정 9지점과 UT 입력** — 규칙 칸은 ΔV3 EP-12c가 R1~R8을 더해 승계하고, 셋째 열(UT 입력)은 ΔV3 분기 목록 169행이 대체한다(§7-D). 각 지점의 분기마다 구별 입력을 둔다. "→ N"은 `analyzeScale`(허용 항목 없음) 위반 수다. ΔV1 EP-12 입력은 전부 유지한다(시제품 탐침에서 ΔV1 게이트와 같은 판정).

| 지점 | 규칙 | UT 입력 → 기대 |
|---|---|---|
| P1 파일 범위 | ΔV1 P1 그대로 | ΔV1 P1 입력 그대로 |
| P2′ 형태 8 · 슬롯 | ΔV1 7형태 + **named**. 형태의 호출 대상은 B1·B2·`promisify(x)`·`util.promisify(x)`·`child_process`/`timers/promises` import 별칭으로 푼다. `/timeout/i` 이름 슬롯: option = 객체 속성 · **단축 속성** · **대입**(`o.k = v`·`o['k'] = v`·`??=`·`\|\|=`, 소유 객체 이름이 `/timeout/i`여도) · **클래스 필드** · 중첩 `timeouts` 소유(소유 판정도 B로 — 바인딩 참조 하나라도) / param = 매개변수 기본값 · **구조 분해 기본값**(매개변수·변수, 이름 = 속성 이름 우선) / named = 이름 변수 초기값 · 식별자 대입 | 분기마다 미배율 `5000` → 1 · `scaleMs(5000)` → 0: `const timeoutMs = 5000` + `waitForTask(t, { timeoutMs })`(Y1) · `socket.timeout = 5000` · `opts.timeoutMs ??= 5000` · `timeouts.connectMs = 5000` · `class F { timeoutMs = 5000 }` · `({ timeoutMs = 5000 } = {}) => 0`(Y11) · `const { timeoutMs = 5000 } = o` · `function f({ timeout: t = 5000 } = {}) {}` · `const [timeoutMs = 5000] = l` · `const timeoutMs = 5000` + `waitUntil(s, timeoutMs)` · `const st = setTimeout; st(f, 5000)` · `const t = AbortSignal.timeout; t(5000)` · `const t = { connectMs: 1000 }; pool({ timeouts: t })` → 1 |
| P3′ 값 해석 B0~B7 | B0 검사기 심볼(스코프·가림) · B1 래퍼 · B2 변수 초기값 + 같은 파일 대입(여러 값) · B3 구조 분해 원천 멤버 · B4 같은 파일 함수·메서드: 매개변수 ← 기본값 + 같은 파일 호출부 위치 인자, 호출 결과 ← 반환식 · B5 단축 속성 · B6 객체 리터럴 멤버(전개 포함) · B7 `??`·`\|\|`·조건식 양쪽 · 산술 `+ - * /`. 여러 값이면 값마다 자리. 경계는 D-015 | ΔV1 P3 입력 그대로 + 위반 1: 두 블록 `const t` 가림 두 순서(`5000` 블록이 앞·뒤) · `let t = scaleMs(500); t = 5000; setTimeout(f, t)` · `const { ms } = { ms: 5000 }; setTimeout(f, ms)` · `const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); await sleep(5000)`(`sleep(scaleMs(5000))` → 0) · `function wait(ms) {…}` + `wait(5000)`·`wait(400)` → 1 · `function wait({ ms }) {…}` + `wait({ ms: 5000 })` · 객체 메서드·클래스 메서드·속성 화살표 `h.wait(5000)` · `const budget = () => 5000; setTimeout(f, budget())`(`return scaleMs(5000)` → 0) · `cfg.delay`·`cfg['delay']`(`const cfg = { delay: 5000 }`) · `fast ? 500 : 5000` · `6000 - 1000` · `(5000 as number)` |
| P4′ 임계 | ΔV1 P4 + 자식 프로세스 판정이 호출 대상 해석(P2′)과 객체의 사용 자리(바인딩 참조·전개·대입 대상 객체 — 하나라도)를 본다 | ΔV1 P4 입력 그대로 + `timeout: 10` 위반 1: `const opts = {…}; execFile(c, a, opts)` · `execFile(c, a, { ...base })` · `const o = {}; o.timeout = 10; execFile(c, a, o)` · `import { execFile as run } …; run(c, a, {…})` · `promisify(execFile)(c, a, {…})` · `const run = promisify(execFile); run(c, a, {…})` |
| P5′ 제외 — 사용 자리 | 슬롯·객체가 변수 X의 초기값 안이면 X의 참조 자리(재귀, 함수 인자·반환은 넘지 않음)마다 ΔV1 P5 제외를 본다 — 참조 ≥1이고 **전부** 제외면 제외, 하나라도 비제외면 센다, 참조 0이면 선언 자리로 판정 | ΔV1 P5 입력 그대로 + `const probeOpts = { timeout: 5000 }; vi.waitFor(() => {}, probeOpts)`(Y2b) → 0 · `const timeout = 4000; vi.waitFor(cb, { timeout })`(Y2e) → 0 · `const timeoutMs = 5000; expect(c.timeoutMs).toBe(timeoutMs)` → 0 · `const o = { timeout: 5000 }; vi.waitFor(cb, o); pool(o)`(Y2f) → 1 · `const timeoutMs = 5000`(참조 0) → 1 |
| P6 허용 목록 | ΔV1 P6 그대로 · 항목 23 | ΔV1 P6 입력 그대로 |
| P7′ 이중 배율 | `vi.waitFor`(별칭 포함)의 둘째 이후 인자가 B(식별자·단축 속성·전개·멤버·호출 반환)를 거쳐 `scaleMs`에 닿으면 위반 · 콜백 함수 안은 보지 않는다 | ΔV1 P7 입력 그대로 + 위반 1: `const probeOpts = { timeout: scaleMs(5000) }; vi.waitFor(() => {}, probeOpts)`(Y2) · `const w = scaleMs(4000); vi.waitFor(cb, w)` · `const base = { timeout: scaleMs(4000) }; vi.waitFor(cb, { ...base, interval: 50 })` · `const wf = vi.waitFor; wf(cb, { timeout: scaleMs(4000) })` / 0: Y2b |
| P8 now 식 (신설) | now 원천 4종(`Date.now()`·`performance.now()`·`new Date().getTime()`·`new Date().valueOf()`) + B(변수·대입·멤버·조건) + 산술. 호출 인자·객체·배열 안은 보지 않는다. deadline = now 식 `+ N` · `N +` · `+= N` · 비교(한쪽만 now 식) / elapsed = `expect(now 식).toBeLessThan(OrEqual)(N)` · `expect(N).toBeGreaterThan(OrEqual)(now 식)` | 위반 1(배율 0): `const start = Date.now(); const elapsed = Date.now() - start; expect(elapsed).toBeLessThan(5000)`(Y5) · `const deadline = start + 5000; while (Date.now() < deadline) {}`(Y5b) · `const el = performance.now() - t0; if (el > 5000) …` · `let d = Date.now(); d += 5000` · `new Date().getTime() + 5000` · `expect(5000).toBeGreaterThan(Date.now() - s)` / 0: `expect(Date.now() - s).toBeGreaterThanOrEqual(5000)`(Y5g, 하한) · `const h = render({ at: Date.now() }); h + 5000`(Y5i) / `const d = Date.now() + scaleMs(5000); while (Date.now() < d) {}` → 자리 1(배율) |
| P9 자리 동일성 (신설) | 한 리터럴(또는 `scaleMs` 호출) 노드는 처음 방문한 슬롯(소스 전위 순회 순, 제외된 슬롯은 건너뜀) 하나의 자리다 · 자리 줄 = 슬롯 줄 · 위반 문구는 값이 다른 줄이면 값 줄을 함께 적는다 · `--report` deadline 행 = `deadline · 파일:줄 · scaled\|semantic · 형태 · 값(리터럴 원문\|scaleMs) · 원문` | `const T = 30_000; setTimeout(f, T); setTimeout(g, T)` → 1 · `sleep(5000)` 두 호출 → 2 · `--report` 행의 다섯째 열이 리터럴 원문·`scaleMs` |

**ΔV2 등록 변이** — 자리를 적었다. 판정 코드 변이(M18~M38)는 UT(VP-12b), 트리 변이는 게이트(VP-07b·09b)가 잡아야 한다.

| ID | 자리 | 바꾼 내용 | 잡아야 할 oracle |
|---|---|---|---|
| M18·M19·M20·M21 | 판정 코드 P2′ | 단축 속성 · 대입 · 클래스 필드 · named 슬롯 각각 삭제 | UT P2′ 해당 입력 |
| M22 | P2′ | 구조 분해 기본값(BindingElement) 슬롯 삭제 | UT Y11·구조 분해 변수 |
| M23 | P2′ | 호출 대상 해석 삭제(원문 비교) | UT 별칭·`promisify` 입력 |
| M24 | P3′ B0 | 검사기 해석 → 이름 맵(마지막 선언) | UT 가림 두 순서 중 하나 |
| M25 · M26 · M27 · M28 | P3′ | 대입 후보 · 매개변수←호출 인자 · 반환식 · 멤버 접근 각각 삭제 | UT B2 · B4 · 반환식 · B6 입력 |
| M29 | P4′ | 자식 프로세스 판정에서 사용 자리 삭제 | UT `execFile(c, a, opts)` |
| M30 | P5′ | 사용 자리 판정 삭제(선언 자리로만 제외) | UT Y2b·단축 → 0이 1로(오탐) |
| M31 | P5′ | "전부" → "하나라도" | UT Y2f → 1이 0으로 |
| M32 | P7′ | 바인딩 해석 삭제(인라인만) | UT Y2·const 숫자·전개 |
| M33 | P8 | now 식 바인딩 해석 삭제(원문 정규식) | UT Y5·Y5b·경과 변수 비교 |
| M34 | P8 | `+=` 형태 삭제 | UT `d += 5000` + 트리 게이트(poll-race `1001` count 9 ≠ 0) |
| M35 | P8 | 역방향 elapsed 삭제 | UT `expect(5000).toBeGreaterThan(…)` |
| M36 | P8 | now 식을 부분 트리 전체로(호출 인자 안까지) | UT `render({ at: Date.now() })` → 0이 1로(오탐) |
| M37 | P8 | now 식끼리 비교 제외 삭제 | UT 자리 1이 2로 |
| M38 | P9 | 리터럴 중복 제거 삭제 | UT `const T` 두 사용 → 1이 2로 |
| M5b | EP-05b 예산 24자리 **각각** | `scaleMs(N)` → `N` (`temp-repo:43`은 `600_000`, `:80`은 `KILL_GRACE_MS` 상수 쪽 `:27`) | `gate:node scripts/check-test-budgets.mjs` exit 1 |
| M11c | `main/adapters/opencode/v1/discovery-cache.poll-race.test.ts` | `now += 1001` 1자리 추가 | 같은 게이트(count 9 ≠ 10) |
| M11d | `main/app/deployment/mail.integration.test.ts` | `now += 301_000` 1자리 삭제 | 같은 게이트(count 4 ≠ 3) |
| Y-트리 | verify r2 Y1·Y2·Y5·Y5b·Y11의 파일 끝 | 같은 입력 추가 | 같은 게이트 exit 1 — Y2b 추가는 exit 0(대조) |

### ΔV2 구현 설계

| 변경 파일 | 변경 내용 | 테스트 seam |
|---|---|---|
| `app/scripts/check-test-budgets.mjs` | `scanDeadlineSites`에 해석기 도입 — 파일마다 단일 파일 TS program(`noLib`·`noResolve`) + 검사기 심볼 · P2′~P9 · `scanBudgetSites`의 `waitFor` 판정(P7′)도 해석기 사용 · `SEMANTIC_DELAYS` 7항목 추가 · `--report` deadline 다섯째 열 값 · 위반 문구 값 줄 · 헤더 주석. 해석기를 `scripts/` 아래 별도 모듈로 나눠도 된다 | `analyzeScale`·`scanBudgetSites`(문자열 소스) → UT |
| `app/scripts/check-test-budgets.test.mjs` | 새 describe '바인딩 해석 (0294 ΔV2)' — EP-12b 새 입력 전부 · 기존 '규칙 (H′)' 유지 · '--report deadline 행은 형태 열을 갖는다'에 값 열 단언 | node test |
| `app/AGENTS.md` | AC19b | 문서 diff + 인벤토리 |

- **시제품을 복사하지 않는다** — `evidence/scan-deadlines-v2.mjs`는 자리 검색 명령이다. 게이트가 그 사본이면 대조 명령 0줄이 다시 사본 일치가 된다. 판정 기대는 EP-12b 표가 정본이다.
- 테스트 소스(`app/src/**`) 변경 0 — 새 자리 18은 전부 의미 값이고 예산 자리 구성 변화(−1·+1)는 이미 배율이다. 바꿔야 할 자리가 생기면 PLAN_GAP으로 돌린다.
- 신규 의존성 없음. production 코드 무변경(§6 비범위 유지). (F)·(G)·(A)~(E) 무변경.
- `[구현자 기입]` 강제 지점 전수 표는 pair §10 자리 전부를 행으로 둔다 — VP-07b·09b 분모의 EP-01~04·06도 행이다(verify r2 D4).

### ΔV2 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint·typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error |
| node scripts 테스트 | 게이트 코드·테스트 변경 | `node --test "scripts/*.test.mjs"` | 전부 |
| 예산·인벤토리 게이트 | (H′) · 문서 | `node scripts/check-test-budgets.mjs` · 대조 명령 0줄 · `node scripts/check-doc-inventory.mjs --check` | 전부 |
| vitest | 회귀(VP-13) | `evidence/clean-host-run.sh` — 리눅스 기준선 22건 분리 | 22건 밖 신규 실패 |
| Windows CI | 정본 통합 게이트 · 'Test budget guard' 단계 | PR `CI` 실행 | 전부 |
| commit trailer | message bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

### ΔV2 READY self-review

- Decision 보존: D-001~D-011·D-013·D-014 무변경 · D-012 → D-015·D-016 SUPERSEDED(주어·범위는 D-015가 원문 승계) — 사용자 결정 변경 없음. 대조 결과는 §3 갱신 메모.
- §10 gap을 지적된 형태만 더하지 않고 판정이 식을 읽는 자리 전부를 해석기 하나로 묶은 뒤 EP-05 목록을 다시 열거했다 — 자리 검색 명령 `scan-deadlines-v2.mjs`(술어 = D-015 주어, 범위 = 테스트 소스 전체)로 62, 이 수를 분모로 고정.
- 독립 재열거: 게이트·스캔과 다른 텍스트 술어 326줄의 나머지 266줄을 분류해 실제 상한 0 · 경계(위치 인자 59 · 런타임 값 6)를 실측해 남는 차이로 적었다.
- 새 왼쪽 node ↔ 같은 레벨 REQUIRED pair 차집합 0 · SUPERSEDED 4 pair의 AC·변이 이관 표기 · 비영향 pair 8개는 NOT_REQUIRED + 좌표.
- 자리별 oracle: 예산 24자리 = 게이트 좌표(자리마다 M5b) · 의미 값 38자리 = 허용 항목 count(M11c·M11d) · 판정 9지점 = UT 분기 입력(EP-12b 표, 탐침 131입력 기대 일치).
- 장치 방향: `scaleMs`를 지우면 red(M5b) · 분기 코드를 지우면 UT red(M18~M38) · 오탐 방향도 변이로 잠근다(M30·M36).
- AC 3행은 §5 AC 게이트를 다시 통과했다(위 재통과 목록).
- 측정되지 않은 보호를 규범 행에 적지 않았다 — 남는 차이 5종은 전부 이번 턴 측정값과 함께 적었다.
- 사람 실기 추가 없음(AC18 그대로).

---

## 7-D. ΔV3 — r3 판정 정정 뒤 EP-12b 분기 목록 고정 (plan 내부 정합)

> **적용 순서: `V1` → `ΔV1` → `ΔV2` → `ΔV3`.** r3 판정 정정(FAIL — 이행 결함 14)은 그대로이고 다음은 구현 r4다. ΔV3는 r4와 다음 verify가 함께 쓸 EP-12b 분기 분모를 고정한다. 새 열거 항목의 출처는 전부 **plan 내부 정합**(plan 동결 뒤 — 사용자 결정·현재 결함 없음)이고, 사용자 요구 변경 ΔV가 아니라 확장 창은 닫힌 채다.

### 무엇이 왜 바뀌는가

| plan 내부 불일치 | 관측 | ΔV3의 답 |
|---|---|---|
| 규칙 칸 ↔ UT 입력 칸 | verify r3 이행 11건(M21b·V-*)은 규칙 칸 분기인데 UT 입력이 없었다. 규칙 칸 열거어를 전수로 행에 옮기자 입력 없는 행이 32개 더 나왔다 | 분기 목록 169행 — 열거어마다 한 행, 행마다 입력·기대·UT 좌표 |
| ΔV2 UT 입력 칸 원문 ↔ UT | 입력 칸의 `const budget = () => 5000`(화살표 식 몸통)을 UT는 블록 `return`으로 썼다('P3′ 반환식') — 식 몸통 경로에 입력 0 | V17 행 |
| B7 "여러 값이면 값마다 자리" ↔ P9 "한 노드 한 자리" | 산술 식은 값 여럿이 한 노드에서 나온다. 규칙이 그 자리 수를 정하지 않아 W2 기대(verify 탐침 1)가 해석이었다 | R4 — 산술 노드는 자리 하나, 판정은 조합마다 |
| 해석이 필요한 용어 | 판정 정정이 확장으로 돌린 W3·W3b·W7·`satisfies`·`!`는 "이름 속성"·"같은 파일 호출부"·"B1 래퍼"의 범위 문제였다 | R1~R8로 용어 범위를 열거하고, 밖의 형태를 선언 경계 L01~L11로 적는다(트리 0 실측) |

### 설계 근거 — 이번 턴 측정

기준 트리 `43a50b8`(브랜치 좌표 — 앱 코드는 r3 `fdb3b55`와 같다, `git diff fdb3b55 43a50b8 -- app` 0줄). 증거 경로 접두사 `docs/handoff/0294-slow-runner-hermetic-tests/evidence/`.

| 관측 | 명령 | 결과 | 설계에 미친 영향 |
|---|---|---|---|
| 기준선 | `node --test scripts/check-test-budgets.test.mjs` · `node scripts/check-test-budgets.mjs` · ΔV2 대조 명령 | 104/104 · exit 0 · 0줄 | 기준 |
| 분기 목록 | `node …/dv3-branches.mjs app` | 169행 · 판정 불일치 4(F04·V33·V34·V35) · 기존 UT 입력 122 · 신설 43 | EP-12c 분모 |
| 배율 판본 | 기대 1인 `5000` 행에서 `5000` → `scaleMs(5000)` | 전부 0 — 예외 X19·X22·I03은 `vi.waitFor`에 닿아 P7′ 이중 배율 1 | 형태·슬롯·값 행은 배율 판본 → 0을 함께 단언 |
| 열거 밖 형태의 트리 자리 | `node …/dv3-tree-scan.mjs app` | L01~L03·L05~L09 0 · L11 0(재대입 호출 345 중 형태 호출 대상 후보 0) · F04 형태 0 | 선언 경계가 현재 결함이 아니다 |
| 판정 변경의 트리 영향 | `bash …/dv3-experiment.sh app <작업 디렉토리>` | combos(R4)·wrappers(L04)·compound(L10) 사본의 `--report`가 원본 90행과 diff 0줄 · 세 사본이 W2·V-satisfies·W9 판정을 실제로 뒤집음(`verify-r3-probes.mjs`) | R4 구현 뒤에도 EP-05b 62 그대로 · 테스트 소스 변경 0 |
| 스캔 민감도 | 형태를 심은 소스 1파일(W1·W3·W3b·W7·W4b~d·W10·W5·W6·W8·재대입 `setTimeout`) | 형태마다 1 이상 | 트리 0이 스캔의 사각이 아니다 |
| 구현 가능성 | scratch 시제품(커밋하지 않음 — F04 판정 순서 · R4 `values` 조합 + `push` 묶음, 두 파일 15줄 안팎) | 기존 UT 104/104 · `dv3-branches.mjs` 불일치 0 · 게이트 exit 0 · 트리 `--report` diff 0줄 · `verify-r3-probes.mjs` 이행 행 전부 ok, 남는 GAP 12 = L 경계 형태 | R4·F04는 기존 판정을 깨지 않고 구현된다 — 구현은 이 시제품을 복사하지 않는다 |

### ΔV3 규칙 정정 — EP-12c = EP-12b 규칙 칸 + R1~R8

> **SUPERSEDED → ΔV4 노드 종류 표(§7-E)** — R1~R8의 대체 칸은 §7-E "ΔV3 R·L 대체 표". R4(산술 조합)는 KV05로 그대로 승계한다.

EP-12b 규칙 칸 원문은 그대로 두고 아래 범위만 더한다. "열거 밖"은 선언 경계(아래 L 표)다.

| ID | 지점 | 규칙 — 용어 범위 고정 | 열거 밖 |
|---|---|---|---|
| R1 | P2′·P3′ B1 | 래퍼 = 괄호 `( )` · `as` | `satisfies` · `!` · `<T>x`(L04) |
| R2 | P3′ B2 · P2′ 호출 대상 | 값의 대입 = `=` · `??=` · `\|\|=`(D-016 대입 정의) · 호출 대상의 B2 = 재대입 없는 변수 초기값 | 복합 대입 값(L10) · 재대입되는 호출 대상 변수(L11) |
| R3 | P3′ B4 | 같은 파일 함수 = 함수 선언 · 화살표·함수 식을 담은 변수·객체 속성·클래스 속성 · 객체·클래스 메서드 | 즉시 호출 함수(L03) |
| R4 | P3′ B7 × P9 | 산술 식 값 = 피연산자 값 조합마다(배율 피연산자가 든 조합은 배율) · 산술 노드는 자리 하나 — 임계(1000) 이상 미배율 조합 → 미배율 자리, 없으면 배율 조합 → 배율 자리, 둘 다 없으면 자리 아님(abort·자식 프로세스 무임계) · 값 열 = 산술 식 원문 | — |
| R5 | P2′ 중첩 `timeouts` 소유 | 소유 이름 = 속성 할당 · 단축 속성 · 변수 선언의 이름 | 클래스 필드(L01) · 대입 대상(L02) |
| R6 | P2′ 호출 대상 | R1 · R2 · `promisify(x)` · `util.promisify(x)` · `child_process`·`timers/promises` import(별칭 유무 무관). `timers/promises`에서 들여온 이름은 전역 timer가 아니라 첫 인자 형태다 | 구조 분해(L05) · 요소 접근(L06) |
| R7 | P8 | now 식의 B = 변수 · 대입 · 멤버 · 조건 · elapsed = matcher 4종(`.not` 없이) | 같은 파일 함수 호출의 반환(L07 — 변수에 담으면 B 변수) · `.not`(L08) |
| R8 | P2′ param | 기본값 있는 매개변수 · 구조 분해 기본값 | 기본값 없는 `/timeout/i` 매개변수(L09) |

### 분기 목록 — EP-12c 분모 169행

입력·기대 원문은 `evidence/dv3-branches.mjs`의 같은 ID 행이다 — 기대가 갈리면 이 절의 표가 정본이다. 측정(v 위반 수 · w 이중 배율 수 · d deadline 자리 수 · P1·P6·`--report` 전용)과 기존 UT 케이스명은 그 파일의 행이 적는다. 형태·슬롯·값 행(F·C·S·V·N)은 배율 판본 → 0을 함께 둔다(예외 X19·X22·I03).

| 지점 | 기존 UT 입력 (행 ID) | 신설 입력 | 판정 수정 | 계 |
|---|---|---|---|---:|
| P1 파일 범위 | P01~P05 | — | — | 5 |
| P2′ 형태·호출 대상·슬롯 | F01~F03 · F05~F17 · F19~F23 · F25 · C03 · C05 · C07 · C08 · S01 · S02 · S04 · S06~S08 · S08·n · S10~S13 (37) | F04·s · F18 · F24 · C01 · C02 · C06 · S03 · S05 · S09 (9) | F04 | 47 |
| P3′ 값 해석 | V01~V05 · V08 · V09 · V11~V16 · V19 · V20 · V23 · V25 · V27~V30 · V32 · V37 (23) | V06 · V07 · V10 · V15b · V15c · V17 · V18 · V21 · V22 · V24 · V26 · V31 · V31b · V36 (14) | V33 · V34 · V35 | 40 |
| P4′ 임계 | T01~T17 | — | — | 17 |
| P5′ 제외 | X02~X06 · X11~X14 · X16~X20 (14) | X01 · X07~X10 · X15 · X21 · X22 (8) | — | 22 |
| P6 허용 목록 | A01~A06 | — | — | 6 |
| P7′ 이중 배율 | W01~W04 · W06 · W09~W11 (8) | W05 · W07 · W08 (3) | — | 11 |
| P8 now 식 | N01~N03 · N05 · N06 · N10 · N12 · N14 · N15 (9) | N04 · N07~N09 · N11 · N13 (6) | — | 15 |
| P9 자리 동일성 | I01 · I02 · I06 (3) | I03 · I04 · I05 (3) | — | 6 |
| **계** | **122** | **43** | **4** | **169** |

**신설·판정 47행** — 출처 "verify r3"은 판정 정정의 이행 결함 14건(15행), "설계자 전수"는 이번 턴 규칙 칸 열거어 전수(32행)다. "현재"는 기준 트리 판정이다.

| ID | 지점 | 규칙 조각 | 기대 | 현재 | 종류 | 출처 |
|---|---|---|---|---|---|---|
| F04 | P2′ | timer timers/promises setTimeout 첫 인자 — 별칭 없음 | 1 | 0 | **판정** | verify r3 W1 |
| F04·s | P2′ | 같음 — scaleMs | 0 | 0 | 입력 | 설계자 전수 |
| F18 | P2′·P8 | elapsed 역방향 toBeGreaterThanOrEqual | 1 | 1 | 입력 | verify r3 V-gte |
| F24 | P2′ | named 식별자 대입 | 1 | 1 | 입력 | verify r3 M21b |
| C01 | P2′ | 호출 대상 B1 래퍼 ( ) | 1 | 1 | 입력 | verify r3 V-peel |
| C02 | P2′ | 호출 대상 B1 래퍼 as | 1 | 1 | 입력 | 설계자 전수 |
| C06 | P2′ | 호출 대상 util.promisify(x) | 1 | 1 | 입력 | verify r3 V-util |
| S03 | P2′ | option 대입 o['k'] = v | 1 | 1 | 입력 | verify r3 V-elem |
| S05 | P2′ | option 대입 \|\|= | 1 | 1 | 입력 | verify r3 V-oreq |
| S09 | P2′ | 중첩 timeouts 소유 — 바인딩 참조(단축 속성) | 1 | 1 | 입력 | 설계자 전수 |
| V06 | P3′ | B2 같은 파일 대입 ??= | 1 | 1 | 입력 | 설계자 전수 |
| V07 | P3′ | B2 같은 파일 대입 \|\|= | 1 | 1 | 입력 | 설계자 전수 |
| V10 | P3′ | B4 매개변수 ← 기본값 | 1 | 1 | 입력 | 설계자 전수 |
| V15b | P3′ | B4 함수 식을 담은 변수 | 1 | 1 | 입력 | 설계자 전수 |
| V15c | P3′ | B4 클래스 속성 화살표 | 1 | 1 | 입력 | 설계자 전수 |
| V17 | P3′ | B4 호출 결과 ← 반환식(화살표 식 몸통) | 1 | 1 | 입력 | 설계자 전수 |
| V18 | P3′ | B5 단축 속성 멤버 | 1 | 1 | 입력 | 설계자 전수 |
| V21 | P3′ | B6 전개 멤버 | 1 | 1 | 입력 | verify r3 V-spreadval |
| V22 | P3′ | B7 ?? 왼쪽 | 1 | 1 | 입력 | verify r3 V-or |
| V24 | P3′ | B7 \|\| 왼쪽 | 1 | 1 | 입력 | 설계자 전수 |
| V26 | P3′ | B7 조건식 앞쪽 | 1 | 1 | 입력 | 설계자 전수 |
| V31 | P3′ | B7 산술 / — 임계 아래 | 0 | 0 | 입력 | verify r3 V-div |
| V31b | P3′ | B7 산술 / — 임계 이상 | 1 | 1 | 입력 | verify r3 V-div |
| V33 | P3′ | B7 여러 값 × 산술 — 조건식 | 1 | 0 | **판정** | verify r3 W2 |
| V34 | P3′ | B7 여러 값 × 산술 — 변수 경유 | 1 | 0 | **판정** | verify r3 W2b |
| V35 | P3′ | B7 여러 값 × 산술 — 한 조합만 배율 | 1 | 0 | **판정** | 설계자 전수 |
| V36 | P3′ | B7 여러 값 × 산술 — 전부 배율이면 배율 자리 1(위반 0) | 1 | 1 | 입력 | 설계자 전수 |
| X01 | P5′ | scaleMs 인자 제외 | 0 | 0 | 입력 | 설계자 전수 |
| X07 | P5′ | test 옵션 객체 제외 — (H′) 자리 0 | 0 | 0 | 입력 | 설계자 전수 |
| X08 | P5′ | describe 옵션 객체 제외 — (H′) 자리 0 | 0 | 0 | 입력 | 설계자 전수 |
| X09 | P5′ | 훅 옵션 객체 제외 — (H′) 자리 0 | 0 | 0 | 입력 | 설계자 전수 |
| X10 | P5′ | fn 뒤 인자(변수) 제외 — (H′) 자리 0 | 0 | 0 | 입력 | 설계자 전수 |
| X15 | P5′ | elapsed 상한 인자는 센다 — matcher 콜백 안 | 1 | 1 | 입력 | verify r3 V-expectx |
| X21 | P5′ | 사용 자리 — 재귀(변수 → 변수) | 0 | 0 | 입력 | 설계자 전수 |
| X22 | P5′ | 사용 자리 — 함수 인자는 넘지 않는다 | 1 | 1 | 입력 | 설계자 전수 |
| W05 | P7′ | B 단축 속성 | 1 | 1 | 입력 | 설계자 전수 |
| W07 | P7′ | B 멤버 | 1 | 1 | 입력 | 설계자 전수 |
| W08 | P7′ | B 호출 반환 | 1 | 1 | 입력 | 설계자 전수 |
| N04 | P8 | now 원천 new Date().valueOf() | 1 | 1 | 입력 | verify r3 V-valueOf |
| N07 | P8 | B 대입 | 1 | 1 | 입력 | 설계자 전수 |
| N08 | P8 | B 멤버 | 1 | 1 | 입력 | 설계자 전수 |
| N09 | P8 | B 조건 | 1 | 1 | 입력 | 설계자 전수 |
| N11 | P8 | 호출 인자 안은 now 식 아님 | 0 | 0 | 입력 | 설계자 전수 |
| N13 | P8 | 배열 안은 now 식 아님 | 0 | 0 | 입력 | 설계자 전수 |
| I03 | P9 | 제외된 슬롯은 건너뛴다 | 1 | 1 | 입력 | 설계자 전수 |
| I04 | P9 | --report 셋째 열 — 배율 아님 · 의미 값 | LITERAL § semantic | LITERAL § semantic | 입력 | 설계자 전수 |
| I05 | P9 | --report 다섯째 열 값 · 여섯째 열 원문 | 30_000\|setTimeout(f, T) § 2700\|setTimeout(g, 2700) | 30_000\|setTimeout(f, T) § 2700\|setTimeout(g, 2700) | 입력 | 설계자 전수 |

### 선언 경계 — EP-12c 열거 밖 L01~L11

> **SUPERSEDED → ΔV4(§7-E)** — L01~L11은 노드 종류 표의 해석 칸(L01~L09) 또는 red 칸(L10 KD02 · L11 KC04)으로 들어갔다. 이 표는 ΔV3 시점 측정 기록으로 남긴다.

verify는 이 형태의 반례를 `경계`로 두고 판정에 쓰지 않는다. 그 형태가 테스트 소스에 나타나면 경계가 아니라 현재 결함이다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`). 구현이 이 형태를 판정해도 되지만 UT·sweep 의무는 없다.

| ID | 형태 (verify r3 입력) | 규칙 근거 | 트리 실측 |
|---|---|---|---|
| L01 | 클래스 필드 이름의 `timeouts` 소유 (W3) | R5 | 0 — `dv3-tree-scan.mjs` |
| L02 | 대입 대상 이름의 `timeouts` 소유 (W3b) | R5 | 0 |
| L03 | 즉시 호출 함수 (W7) | R3 | 0 |
| L04 | 래퍼 `satisfies` · `!` · `<T>x` (V-satisfies · V-nonnull) | R1 | wrappers 사본 `--report` diff 0줄 — 현재 구현은 계속 벗겨도 된다 |
| L05 | 구조 분해로 꺼낸 호출 대상 (W4b · W4c · W4d, 오탐 W4) | R6 | 0 |
| L06 | 요소 접근 호출 대상 (오탐 W10) | R6 | 0 |
| L07 | 같은 파일 now 헬퍼의 직접 호출 (W5) | R7 | 0 |
| L08 | elapsed `.not` (W6) | R7 | 0 |
| L09 | 기본값 없는 `/timeout/i` 매개변수 (W8) | R8 | 0 |
| L10 | 복합 대입 값 (W9) | R2 | compound 사본 `--report` diff 0줄 |
| L11 | 재대입되는 호출 대상 변수 — 후보가 여럿일 때의 형태·제외 판정을 규칙이 정하지 않는다 | R2 | 재대입 호출 345 중 후보에 형태 호출 대상 0 |

- D-015 주어("래퍼"·"구조 분해"·"같은 파일 함수")는 L01~L11 일부를 덮는다. EP-12c가 그 부분을 잠그지 않는 차이는 INDEX 후보 표 0294 행이 갖고, AC7e는 D-015의 반대를 요구하지 않는다.
- L11은 이번 턴 설계자 전수에서 나온 확장 후보다(판정 정정 후보 12건 밖) — 후보 표 0294 행에 더한다.

### ΔV3 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 A · D-001 | INHERITED | `V1:R-01` |
| AT-01c | AT | AC1·2·3·5·6·7c·**7e**·8 | CHANGED → **SUPERSEDED → ΔV4 AT-01d** | `ΔV2:AT-01b` 대체(AC7d → AC7e) |
| AR-01b · IT-01b | AR · IT | 배율 SSOT ↔ 예산 24자리 | INHERITED | `ΔV2:AR-01b`·`IT-01b` — r4가 게이트 코드를 바꿔 회귀 |
| AR-03b · IT-03b | AR · IT | 게이트 (A)~(G) + (H′) · 허용 23항목 · `--report` | INHERITED | `ΔV2:AR-03b`·`IT-03b` — 트리 판정 불변(실험 사본 diff 0)을 회귀로 다시 닫는다 |
| MD-03c · UT-03c | MD · UT | (H′) 판정 — EP-12c(9지점 + R1~R8) · 분기 목록 169행 | CHANGED → **SUPERSEDED → ΔV4 MD-03d · UT-03d** | `ΔV2:MD-03b`·`UT-03b` 대체 |
| AT-05 | AT | AC16 회귀 | INHERITED | `V1:AT-05` |
| 그 밖의 node | — | — | INHERITED | 무변경 |

### ΔV3 Pair registry

| Pair | left ↔ right / 레벨 | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-12c | MD-03c ↔ UT-03c / UT | **SUPERSEDED → ΔV4 VP-12d (§7-E)** | 테스트 소스 문자열 → 해석기(B) → 형태·맥락 판정 → 자리·위반 | `scripts/check-test-budgets.test.mjs` — 분기 목록 169행마다 위반 수(측정 열 v·w·d)를 단언, 케이스명에 분기 ID. 기존 122행은 기존 케이스 그대로, 신설 43행·판정 4행은 새 describe '분기 목록 (0294 ΔV3)' | required — **M39~M42** + 인용 변이 14(아래) + ⑦ sweep 169행 기본 변이 | EP-12c(9지점 · 분기 169) |
| VP-01c | R-01 ↔ AT-01c / AT | **SUPERSEDED → ΔV4 VP-01d (§7-E)** | ΔV2 VP-01b와 같음 | AC1~3·5·6·8: verify r1 §5 좌표 승계 · AC7c: VP-07b·09b · AC7e: VP-12c | VP-12c 변이 | VP-07b와 같음(94) |
| VP-09b | AR-03b ↔ IT-03b / IT | **SUPERSEDED → ΔV4 VP-09c** | ΔV2와 같음 | `gate:node scripts/check-test-budgets.mjs` exit 0 · ΔV2 대조 명령 0줄 · Windows CI 'Test budget guard' | ΔV2 승계 M11c·M11d · Y-트리 | ΔV2와 같음(100) |
| VP-07b | AR-01b ↔ IT-01b / IT | REGRESSION | ΔV2와 같음 | 자리마다 게이트 좌표(M5b 24) | M5b | ΔV2와 같음(94) |
| VP-13 | R-01 ↔ AT-05 / AT | REGRESSION | 전체 스위트 — 깨끗한 호스트 | `evidence/clean-host-run.sh` + `newfails.mjs` added 0 · `git diff --stat <ΔV3 설계 커밋>..HEAD -- app/src` 0줄 | not selected | 0 |
| VP-12b · VP-01b | — | **SUPERSEDED** | — | VP-12c · VP-01c | — | — |
| VP-02~06 · 08 · 10 · 11 | V1 그대로 | NOT_REQUIRED | — | verify r1 §5 · r2-5 · r3-5 좌표 | — | 비영향: ΔV3 구현은 게이트 2파일·그 UT만 바꾼다 |

- `SUPERSEDED` 이관: VP-12b(EP-12b 입력 · M18~M38 · Y-행 · verify r3 V-*·W 입력) → VP-12c(분기 목록 169행이 EP-12b 입력을 전부 담는다 — 기존 122행) · VP-01b(AC7c·7d) → VP-01c(AC7c·7e). 폐기 0.
- NEW·CHANGED 왼쪽 node ↔ 같은 레벨 REQUIRED pair: MD-03c → VP-12c(UT) · R-01(오른쪽 AT-01c CHANGED) → VP-01c. 영향받은 INHERITED → REGRESSION: VP-09b · VP-07b · VP-13. 차집합 0.

### ΔV3 Acceptance — 정정

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | ~~**AT-01c / AC7e**~~ (AC7d 대체) → **SUPERSEDED → ΔV4 AC7f (§7-E)** | (H′)는 EP-12c(EP-12b 9지점 + R1~R8)대로 판정한다 — 분기 목록 169행의 기대와 같다. 판정 4행: `timers/promises`에서 별칭 없이 들여온 `setTimeout(5000)` 위반 1(F04) · 여러 값 × 산술 위반 1(V33·V34) · 한 조합만 배율이어도 위반 1(V35) · 전부 배율이면 배율 자리 1·위반 0(V36). 선언 경계 L01~L11은 판정 의무가 없다 | `check-test-budgets.test.mjs` — 169행마다 기대 단언(케이스명에 ID) · 행의 분기 코드를 지우거나 형제와 맞바꾸면 그 행이 red(⑦ sweep 기록) · `dv3-branches.mjs` 판정 불일치 0 | `scripts/check-test-budgets.mjs` · `scripts/test-budget-bindings.mjs` |

**AC 게이트 재통과**(§5) — 정정 1행:

- 행동 단언·검증 수단·도달 경로: 세 칸 모두 있다.
- **방향**: 판정 4행은 UT에 넣으면 현재 코드에서 red다(F04·V33·V34·V35 기대 1 · 현재 0) — 구현이 고쳐야 green이 되고, M39~M41이 고친 뒤 되돌리면 red다. V36(배율 자리 1)은 배율 조합을 버려 자리가 사라지는 반대 방향을 잠근다(M42).
- **자리를 말하는 불변식의 맞바꿈 축**: R4는 "자리 하나"를 말한다 — V33의 기대가 1(2가 아님)이라 조합마다 자리를 만드는 구현은 red다. F04는 첫 인자를 말한다 — 둘째 인자를 읽는 현재 구현이 0으로 red다.
- 완결성 주장은 분모로 적었다 — 분기 목록 169행(규칙 칸 열거어 ↔ 행 = '규칙 조각' 열), 열거 밖은 L01~L11과 트리 실측.
- structural proxy 없음 — 행마다 위반 수를 단언한다. 사람 실기로 미룬 순수 로직 없음.
- AC 총수: **21** 그대로(AC7d → AC7e 번호 승계).

### ΔV3 §10 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-03c / VP-12c **EP-12c** — 분기 169행은 유효, 규칙 R1~R8은 **SUPERSEDED → ΔV4 EP-12d (§7-E)** | (H′) 판정 — EP-12b 9지점 + R1~R8 | `scripts/check-test-budgets.mjs` · `scripts/test-budget-bindings.mjs` | 게이트 | **9지점 · 분기 169행** — 위 분기 목록 | 분모 = `node docs/handoff/0294-slow-runner-hermetic-tests/evidence/dv3-branches.mjs app` 169행(기대 열) · 열거 밖 트리 0 = `dv3-tree-scan.mjs app` + `dv3-experiment.sh app <작업 디렉토리>` | 행 하나가 빠지면 그 분기의 미배율 마감이 통과하거나(거짓 green) 정상 코드가 red다(오탐) |

- **EP-12c 게이트가 초록인 채로 남는 차이**(§5 완료 조건 ≠ 목표): 선언 경계 L01~L11(전부 트리 0, 위 표) + ΔV2 EP-05b의 남는 차이 5종(그대로).
- EP-05b 62자리는 바뀌지 않는다 — R4·F04 판정 변경의 트리 영향 0(combos 사본 diff 0줄 · F04 형태 0).
- `실패 의미`에 "다른 게이트가 막는다"를 적은 칸: 없음.
- **ΔV3 유효 강제 지점 전수**: V1 67 + EP-05b 62 + EP-12c 9지점 = **138**(ΔV2와 같다). 분기 169행은 VP-12c UT의 분모다.

**ΔV3 등록 변이** — 자리를 적었다. G = `scripts/check-test-budgets.mjs`, B = `scripts/test-budget-bindings.mjs`(줄은 기준 트리).

| ID | 자리 | 바꾼 내용 | 잡아야 할 oracle |
|---|---|---|---|
| M39 | G `scanDeadlineSites` visit(`:520-522`) | `timers/promises` 이름 판정을 전역 `setTimeout` 정규식 뒤로(현재 순서) | UT F04 |
| M40 | B `values` 산술(`:313-315`) | 피연산자가 값 하나씩일 때만 값(현재) | UT V33 · V34 |
| M41 | G `push` 리터럴 중복 제거(`:499`) — R4 묶음 | 배율 조합이 하나라도 있으면 배율 자리 | UT V35 |
| M42 | B `values` 산술 — R4 조합 | 배율 피연산자가 든 조합을 버린다 | UT V36(배율 자리 1 → 0) |
| 인용 변이 14 | verify r3-4 고장 이력 표의 자리 — M21b · V-elem · V-oreq · V-util · V-peel · V-div · V-or · V-spreadval · V-valueOf · V-gte · V-expectx · W1 · W2 · W2b | 같은 표의 바꾼 내용 | UT F24 · S03 · S05 · C06 · C01 · V31·V31b · V22 · V21 · N04 · F18 · X15 · F04 · V33 · V34 |

### ΔV3 구현 설계

| 변경 파일 | 변경 내용 | 테스트 seam |
|---|---|---|
| `app/scripts/check-test-budgets.mjs` | F04·R6 — `timers/promises` 이름 판정을 전역 timer 정규식보다 먼저 · R4 — 한 노드에서 나온 값 여럿을 R4 순서(임계 넘는 미배율 → 배율 → 없음)로 자리 하나에 묶는다(현재 `seen` 첫 값 방식 대체) | `analyzeScale`·`scanBudgetSites`(문자열 소스) → UT |
| `app/scripts/test-budget-bindings.mjs` | R4 — `values()` 산술 분기가 피연산자 값 조합마다 값을 낸다(배율 피연산자가 든 조합은 배율) · 헤더 주석에 R1~R8 범위 | 같음 |
| `app/scripts/check-test-budgets.test.mjs` | 새 describe '분기 목록 (0294 ΔV3)' — 신설 43행·판정 4행의 입력·기대를 `evidence/dv3-branches.mjs` 같은 ID 행 그대로, 케이스명에 ID · 배율 판본 → 0 단언 · 기존 122행 케이스는 그대로 | node test |

- `dv3-branches.mjs`는 UT 입력의 실행본이다. 입력은 복사해도 되고, 판정 코드는 시제품·탐침에서 복사하지 않는다(ΔV2 원칙 유지).
- ⑦ sweep 분모 = 분기 목록 169행 + EP-05b 62자리. 행마다 그 분기를 지우는 기본 변이(계약이 다른 형제가 있으면 맞바꿈을 더함)를 심고 잡은 케이스를 `[구현자 기입]`에 행 ID와 함께 적는다. 같은 코드 줄을 공유하는 행은 한 변이로 묶을 수 있으나 행마다 잡은 케이스를 따로 적는다.
- 테스트 소스(`app/src/**`) 변경 0 · 신규 의존성 0 · production 코드 무변경 · (A)~(G) 무변경. 바꿔야 할 트리 자리가 생기면 PLAN_GAP으로 돌린다.
- N1(`peel`·`ARITH_OPS` export): ΔV3 증거 스크립트는 이 export를 쓰지 않는다 — 거둘지는 구현 재량이다.
- `[구현자 기입]` 강제 지점 전수 표는 pair §10 자리 전부를 행으로 둔다(ΔV2와 같다).

### ΔV3 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint·typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error |
| node scripts 테스트 | 게이트 코드·테스트 변경 | `node --test "scripts/*.test.mjs"` | 전부 |
| 분기 목록 탐침 | AC7e | `node ../docs/handoff/0294-slow-runner-hermetic-tests/evidence/dv3-branches.mjs .` → 판정 불일치 0 | 전부 |
| 예산·인벤토리 게이트 | (H′) · 문서 | `node scripts/check-test-budgets.mjs` · ΔV2 대조 명령 0줄 · `node scripts/check-doc-inventory.mjs --check` | 전부 |
| vitest | 회귀(VP-13) | `evidence/clean-host-run.sh` — 리눅스 기준선 22건 분리 | 22건 밖 신규 실패 |
| Windows CI | 정본 통합 게이트 | PR `CI` 실행 | 전부 |
| commit trailer | message bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

### ΔV3 READY self-review

- Decision 보존: D-001~D-011·D-013~D-016 무변경, 새 Decision 없음 — 사용자 결정 변경 없음. 대조는 §3 갱신 메모.
- 분모를 지적된 분기만 더하지 않고 규칙 칸 열거어 전수로 다시 세웠다 — verify r3 이행 15행 + 설계자 전수 32행 + 기존 122행 = 169(`dv3-branches.mjs` 출력 "분기 169").
- 규칙 칸 ↔ UT 입력 칸: 169행 전부 입력·기대를 가진다 — 기존 UT 좌표 122 · 신설 47(판정 4 포함).
- 열거 밖 L01~L11은 측정한 것만 적었다 — 트리 스캔 0 · 실험 사본 diff 0 · 스캔 민감도 확인.
- 새 왼쪽 node ↔ 같은 레벨 REQUIRED pair 차집합 0 · SUPERSEDED 2 pair 이관 표기 · 회귀 3 pair · NOT_REQUIRED 8 pair.
- 장치 방향: 판정 4행은 현재 red, 고친 뒤 되돌리면 red(M39~M41) · 오탐 방향은 V36·M42.
- 열린 입력 집합 판정: 새 SKILL의 fail-closed·노드 종류 표는 도입하지 않았다 — 동결 뒤 설계 확장이라 출처가 없다. R1~R8 + L01~L11은 EP-12b 용어의 범위 열거다.
- AC 1행은 §5 AC 게이트를 다시 통과했다(위 재통과 목록). 사람 실기 추가 없음(AC18 그대로).

---

## 7-E. ΔV4 — 식 노드 종류 표 + 값 자리 fail-closed (사용자 결정)

> **적용 순서: `V1` → `ΔV1` → `ΔV2` → `ΔV3` → `ΔV4`.** 출처는 **사용자 결정**(2026-11-05 "294안에 넣어라" — SKILL §5-A의 fail-closed·노드 종류 표 설명과 선택지 표 뒤)이다. 사용자 요구 변경 ΔV라 ΔV4의 NEW·CHANGED 노드(MD-03d·UT-03d·AR-03c·IT-03c·AT-01d) 범위에서 확장 창이 다음 verify 2회 동안 다시 열린다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`). ΔV3 분기 목록 169행은 유지하고, ΔV3 R1~R8·선언 경계 L01~L11은 아래 표가 대체한다.

### 무엇이 왜 바뀌는가

| 지금 | 문제 | ΔV4 |
|---|---|---|
| 해석기가 모르는 식을 조용히 넘긴다 — 풀리지 않는 값은 자리 없음, 이름으로 안 풀리는 호출 대상은 형태 아님, now로 안 풀리는 피연산자는 deadline 아님 | r1~r3과 ΔV3 L01~L11에서 매번 새 문법이 거짓 통과로 나왔다(corpus P64) | 해석기가 식을 읽는 자리 9곳(KV·KD·KM·KF 값 · KC 호출 대상 · KN now · KE matcher · KO 소유 · KP param)의 노드 종류를 표로 고정하고 칸마다 해석·숫자 아님·경계·red를 적는다 |
| 값 자리의 모르는 종류 → 자리 없음 | 미배율 마감이 green으로 지난다 | 값 자리는 fail-closed — red 칸과 표 밖 종류는 "판정 불가" 위반이고 `UNRESOLVED_ALLOWED`에 올려야 통과한다 |
| 호출 대상·now 자리의 모르는 종류 | red로 두면 무관한 호출(형태 아님 101,920)·산술(now 아님 12)이 막힌다 | 경계 칸("형태 아님"·"now 아님")으로 명시하고 트리 수를 적는다 |

### Product & UX — 게이트 소비자(테스트 작성자·CI)

| 상황 | 게이트 출력 | 작성자가 할 일 |
|---|---|---|
| 값 자리가 red 칸·표 밖 종류에 닿음 | `:<줄> <원문> — 테스트 소유 마감의 값을 판정할 수 없다(판정 불가 <칸 ID>: <칸 이름>) — 리터럴·scaleMs(…)·같은 파일 선언으로 쓰거나, 값을 호출자가 고르는 경계면 UNRESOLVED_ALLOWED 에 {file, reason: '<칸 ID>', count, why} 로 등록한다` | 다시 쓰거나 등록 |
| 허용 항목 count ≠ 같은 파일·같은 칸 자리 수 · `why` 빈 값 · 대상 파일 없음 | SEMANTIC_DELAYS와 같은 문형의 위반 | count·why를 맞춘다 |
| `--report` | `deadline \t 파일:줄 \t UNRESOLVED\|allowed \t 형태 \t <칸 ID> \t 원문` 행 | — |
| 현재 트리 | 판정 불가 0 · 허용 목록 0항목 · exit 0 | 없음 |

### 설계 근거 — 이번 턴 측정

기준 트리 `bbb800f`(브랜치 좌표 — 앱 코드는 r3 `fdb3b55`와 같다). 증거 경로 접두사 `docs/handoff/0294-slow-runner-hermetic-tests/evidence/`.

| 관측 | 명령 | 결과 | 설계에 미친 영향 |
|---|---|---|---|
| 값 자리 종류 분포 | `node …/dv4-kind-census.mjs app` (V 행) | 숫자 89 · 배율 25 · 산술 1 · 숫자 아님 25(객체 8 · 화살표 6 · 핸들 4 · 문자열 3 · 함수 전역 2 · mock 1 · 키 없음 1) · 경계 26(import 20 · 콜백 매개변수 4 · 그 멤버 2) · **red 0** | 값 자리 fail-closed가 트리에서 0자리 — 허용 목록 0항목 |
| red 0이 되기 전 | 같은 명령(칸 추가 전) | red 4 — 타이머 주입 콜백 3(`setTimeout: (fn, ms) => setTimeout(fn, ms)` 객체 속성) · mock 체인 1(`vi.spyOn(…).mockImplementation`) | KD08(저장된 함수 → 경계) · KF04(mock 체인 → 숫자 아님) 칸 |
| now 자리 | 같은 명령(N 행) | 한쪽이 1000 이상 숫자이고 다른 쪽이 now로 안 풀림 12 — 카운터 `index < 2100` · 가짜 시계 `now += 1000`·`clock += ms` · 타임스탬프 `Date.UTC(…) + 60_000` 등, 실제 마감 0 | KN08은 red가 아니라 경계(now 아님) |
| 호출 대상 | 같은 명령(C 행) | 형태로 풀림 344 · 형태 아님 101,920(멤버 47,012 · import 39,289 · 변수 6,502 · 함수 선언 6,482 · 호출의 호출 851 · 매개변수 492 · 구조 분해 442 · 재대입 254 · 전역 237 · `import()` 236 · 계산 키 98 · 즉시 호출 20 · `super` 3 · 그 밖 2) · 구조 분해·요소 키·재대입 후보에 형태 이름 0 | KC 경계 칸 · KC04·KC05·KC09 해석은 트리 0 |
| 새 해석 경로의 트리 자리 | 같은 명령 — `@new` 단말 · O04 · N05 행 | 0 — `&&`·쉼표·단항 리터럴·배열 요소·즉시 호출·`this.x`·구조 분해 기본값 소유·`new Date()` 변수 시계 | EP-05b 62 그대로 · 테스트 소스 변경 0 |
| ΔV3 분기 입력 | 148행(코드 입력)마다 `dv4-kind-census.mjs --probe` | 값 자리 red 0 | ΔV3 169행 기대 변경 0 |
| 칸 입력 | `node …/dv4-cells.mjs app` | 163행 · 현재 게이트와 판정 불일치 70 | r4가 바꿀 범위 |
| 센서스 민감도 | 심은 입력 8개(배열 요소 · `&&` · `this.ms` · 복합 대입 · import 함수 호출 · 호출부 없는 export 함수 · 구조 분해 기본값 소유 · `new Date()` 변수) | 각 입력이 해당 칸(`@new` · red · O04 · N05)으로 잡힘 | 트리 0이 사각이 아니다 |

### 식 노드 종류 표 — EP-12d

입력·기대 원문은 `evidence/dv4-cells.mjs`의 같은 ID 행이다 — 기대가 갈리면 이 표가 정본이다. "트리"는 위 센서스의 자리 수다(—는 해석 칸이라 따로 세지 않음). 표 밖 종류는 값 자리에서 red, 그 밖 자리에서 각 표 마지막 칸이다.

**KV — 값 자리 식 종류**(슬롯이 읽는 식, 래퍼를 벗긴 뒤)

| 칸 | 종류 | 분류 | 트리 | UT 입력 |
|---|---|---|---:|---|
| KV01 | 숫자 리터럴 | 숫자 | 89 | KV01 |
| KV02 | `+`·`-` 숫자 리터럴 | 숫자(음수는 임계 아래) | 0 | KV02 · KV02b |
| KV03 | `scaleMs(…)` | 배율 | 25 | KV03 |
| KV04 | 래퍼 `( )`·`as`·`satisfies`·`!`·`<T>x` | 안쪽을 다시 이 표로 | — | KV04a~e |
| KV05 | 산술 `+ - * /` | 피연산자 조합(ΔV3 R4 승계) | 1 | KV05 · ΔV3 V28~V36 |
| KV06 | `??`·`\|\|` | 양쪽 | — | KV06 · ΔV3 V22~V25 |
| KV07 | `&&` | 오른쪽(왼쪽은 숫자 아님) | 0 | KV07 |
| KV08 | 쉼표 | 오른쪽 | 0 | KV08 |
| KV09 | 비교·동등·`in`·`instanceof` | 숫자 아님 | — | KV09 · KV09b~d |
| KV10 | 그 밖 이항 연산자(예: `%`·`**`·비트·시프트) | red | 0 | KV10 · KV10b |
| KV11 | 대입 연산 식 | red | 0 | KV11 |
| KV12 | 조건식 | 양쪽 | — | KV12 · ΔV3 V26·V27 |
| KV13 | 문자열·템플릿 2종·정규식·`true`·`false`·`null`·객체·배열·함수 식·화살표·클래스 식·JSX 3종·`typeof`·`void`·`delete`·BigInt·`new`·`!x` | 숫자 아님 | 17(객체 8 · 화살표 6 · 문자열 3) | KV13a~u |
| KV14 | `await` | red | 0 | KV14 |
| KV15 | `this` | red | 0 | KV15 |
| KV16 | `++`·`--`(전위·후위) · `~` · 리터럴 아닌 `+`/`-` | red | 0 | KV16a~g |
| KV17 | 표 밖 종류(태그 템플릿·`yield` 등) | red | 0 | KV17a·b |

식별자는 KD, 리터럴 키 멤버 접근은 KM, 호출은 KF 표로 간다.

**KD — 식별자의 선언**

| 칸 | 선언 | 분류 | 트리 | UT 입력 |
|---|---|---|---:|---|
| KD01 | 변수 — 초기값 + 같은 파일 대입 `=`·`??=`·`\|\|=` | 후보마다 KV | — | KD01 · ΔV3 V04~V07 |
| KD02 | 변수 — 복합 대입(`+=`·`-=`·`*=`·`/=` 등)이 있음 | red | 0 | KD02 |
| KD03 | 변수 — 값 없음 | 숫자 아님 | — | KD03 |
| KD03b | `declare` 변수 | 경계(밖에서 정한 값) | 0 | KD03b |
| KD04 | `for-of`·`for-in` 변수 | red | 0 | KD04a·b |
| KD05 | 구조 분해(중첩 포함) — 기본값 + 원천 멤버 | 후보마다 KV(**ΔV5 §7-F가 분류 칸을 풀어 씀**) | — | KD05 · ΔV3 V08·V09·S10~S13 |
| KD06 | 매개변수 — 같은 파일 호출부 | 기본값 + 같은 위치 인자 | — | KD06 · ΔV3 V10~V16 |
| KD07 | 매개변수 — 즉시 호출 | 그 호출의 인자 | 0 | KD07 |
| KD08 | 매개변수 — 호출부 없음, 함수가 인자·객체/클래스 속성·배열 요소·반환값으로 넘어감 | 경계(호출자가 같은 파일 밖) | 4 | KD08a~e |
| KD09 | 매개변수 — 호출부 없는 이름 붙은 함수(선언·변수) | red | 0 | KD09a·b |
| KD10 | import(이름·기본·이름공간) | 경계 — 테스트 소스 export는 그 파일의 자리, production은 §6 비범위(D-015 승계) | 20 | KD10a~c |
| KD11 | 함수·클래스·enum 선언 | 숫자 아님 | — | KD11 · KD11b·c |
| KD12 | 선언 없음 — `undefined`·`Infinity`·`NaN`·함수 전역 / 그 밖 lib 전역 | 숫자 아님 / 경계 | 함수 전역 2 · 그 밖 0 | KD12a~e |
| KD13 | `catch` 변수 | red | 0 | KD13 |
| KD14 | 표 밖 선언 종류 | red | 0 | KD14 |

**KM — 멤버 접근(이름·문자열·숫자 리터럴 키)**

| 칸 | 원천 | 분류 | 트리 | UT 입력 |
|---|---|---|---:|---|
| KM01 | 객체 리터럴 — 속성·단축 속성·전개 | 그 값을 KV로 | — | KM01 · ΔV3 V18~V21 |
| KM02 | 객체 리터럴에 키 없음 | 숫자 아님 | 1 | KM02 |
| KM03 | 객체 리터럴 메서드 / getter | 숫자 아님 / red | 0 | KM03a·b |
| KM04 | 배열 리터럴 + 숫자 키 | 그 요소를 KV로 | 0 | KM04 |
| KM05 | 배열·문자열 리터럴의 그 밖 멤버 | red | 0 | KM05 · KM05b |
| KM06 | `this.이름` | 같은 클래스 속성 선언의 초기값 · 없으면 red(**ΔV5: + 같은 클래스 대입 KM10 · 복합·증감 KM11**) | 0 | KM06a~c |
| KM07 | 경계(import·lib 전역·콜백 매개변수·`declare`) | 경계 | 2 | KM07a~c · KD10c |
| KM08 | 그 밖(`new`·호출 결과·숫자 아님 선언 등) | red | 0 | KM08a~c |
| KM09 | 계산 키 | red | 0 | KM09 |

**KF — 호출 결과**

| 칸 | 호출 | 분류 | 트리 | UT 입력 |
|---|---|---|---:|---|
| KF01 | `scaleMs(…)` | 배율(KV03) | 25 | KV03 |
| KF02 | 같은 파일 함수·메서드 | 반환식을 KV로 | — | KF02 · ΔV3 V16·V17 |
| KF03 | 즉시 호출 | 반환식을 KV로 | 0 | KF03 |
| KF04 | 타이머 핸들(`setTimeout`·`setInterval`·`setImmediate`) · mock(`vi.fn`·`vi.spyOn`·`vi.mocked`와 그 체인) | 숫자 아님 | 핸들 4 · mock 1 | KF04a~f |
| KF05 | 그 밖(import·lib·production 함수) | red | 0 | KF05a·b |

**KC — 호출 대상**(형태 판정 · 제외 맥락 · 자식 프로세스 · P7′)

| 칸 | 종류 | 분류 | 트리 | UT 입력 |
|---|---|---|---:|---|
| KC01 | 래퍼 5종 | 안쪽 | — | KC01a~c · ΔV3 C01·C02 |
| KC02 | 선언 없는 식별자 | 그 이름 | 237 | ΔV3 F01 |
| KC03 | 재대입 없는 변수 | 초기값을 다시 이 표로 | 6,502 | ΔV3 C03·C08 |
| KC04 | 재대입되는 변수 | 후보에 형태 이름이 있으면 red(판정 불가), 없으면 형태 아님 | 254(형태 이름 후보 0) | KC04a·b |
| KC05 | 구조 분해 | 원천.속성 | 442(형태 0) | KC05a~d |
| KC06 | import | `child_process`·`timers/promises`는 원래 이름(별칭 유무 무관), 그 밖 모듈은 형태 아님 | 39,290 | KC06 · ΔV3 F04·F05·C07 |
| KC07 | 매개변수 | 형태 아님(경계) | 492 | KC07 |
| KC08 | 속성 접근 | 풀린 소유자.이름 | 47,012 | KC08a·b |
| KC09 | 요소 접근 리터럴 키 | 풀린 소유자.키 | 1(형태 0) | KC09a·b |
| KC10 | 요소 접근 계산 키 | 형태 아님(경계) | 98 | KC10 |
| KC11 | 호출 — `promisify(x)`·`util.promisify(x)` / 그 밖 | x / 형태 아님(경계) | 851 | KC11 · ΔV3 C05·C06 |
| KC12 | 같은 파일 함수 선언 | 형태 아님(값은 KD06) | 6,482 | KC12 |
| KC13 | 즉시 호출 · `import()` · `super` · 그 밖 종류 | 형태 아님(즉시 호출의 값은 KD07) | 20 · 236 · 3 · 2 | KD07 · KC13a~c |

**KN — now 식**(deadline·elapsed가 묻는 식)

| 칸 | 종류 | 분류 | 트리 | UT 입력 |
|---|---|---|---:|---|
| KN01 | 원천 4종 | now | — | ΔV3 N01~N04 |
| KN02 | 변수·대입·멤버·조건(B) | 후보 중 now | — | ΔV3 N05~N09 |
| KN03 | 산술 | 한쪽이 now | — | ΔV3 N10 |
| KN04 | 같은 파일 함수 호출 | 반환식 중 now | 0 | KN04 |
| KN05 | 즉시 호출 | 반환식 중 now | 0 | KN05 |
| KN06 | `X.getTime()`·`X.valueOf()`, X가 B로 인자 없는 `new Date()` | now | 0 | KN06 · KN06b |
| KN07 | 호출 인자·객체·배열 안 | now 아님 | — | ΔV3 N11~N13 |
| KN08 | 그 밖(외부 호출·import·매개변수·복합 대입 변수·lib 전역) | now 아님(경계) | 12 | KN08a~e |
| KN09 | now 식끼리 비교 | 자리 아님 | — | ΔV3 N15 |

**KE — elapsed matcher**

| 칸 | 형태 | 분류 | 트리 | UT 입력 |
|---|---|---|---:|---|
| KE01 | `expect(now).toBeLessThan(OrEqual)(N)` · `expect(N).toBeGreaterThan(OrEqual)(now)` | 상한 | — | ΔV3 F15~F18 |
| KE02 | 반대 matcher 4종 + `.not` | 상한 | 0 | KE02a~d |
| KE03 | 상한 matcher + `.not` | 하한(자리 아님) | 0 | KE03a·b |
| KE04 | 하한 단언 | 자리 아님 | — | ΔV3 N14 |
| KE05 | `.resolves`·`.rejects`·그 밖 체인 | 자리 아님 | — | KE05 |

**KO — `timeouts` 소유 이름**(숫자 속성이 option 슬롯이 되는 객체를 담은 이름)

| 칸 | 이름 자리 | 분류 | 트리 | UT 입력 |
|---|---|---|---:|---|
| KO01 | 속성 할당 · 단축 속성 · 변수 선언 | 소유 | — | ΔV3 F20·S09·F21 |
| KO02 | 클래스 필드 | 소유 | 0 | KO02 |
| KO03 | 대입 대상 속성·요소(리터럴 키) | 소유 | 0 | KO03a·b |
| KO04 | 구조 분해 기본값 | 소유 | 0 | KO04 |
| KO05 | 그 밖 | 소유 아님 | — | KO05 |

**KP — `/timeout/i` 매개변수 슬롯**

| 칸 | 매개변수 | 분류 | 트리 | UT 입력 |
|---|---|---|---:|---|
| KP01 | 기본값 있음 | 그 값(D-016 승계) | — | ΔV3 F22 |
| KP02 | 기본값 없음 — 같은 파일 호출부 | 같은 위치 인자 | 0 | KP02 |
| KP03 | 기본값 없음 — 호출부 없음, 넘어간 함수 | 경계 | 0 | KP03 |
| KP04 | 기본값 없음 — 호출부 없는 이름 붙은 함수 | red | 0 | KP04 |

**KA — 판정 불가 허용 목록** `UNRESOLVED_ALLOWED: {file, reason(칸 ID), count, why}[]` — `SEMANTIC_DELAYS`와 같은 대조 규칙.

| 칸 | 규칙 | UT 입력 |
|---|---|---|
| KA01~KA03 | 같은 파일·같은 칸 ID의 판정 불가 자리 수 = count면 통과, 많거나 적으면 위반 1 | KA01~KA03 |
| KA04 | `why` 빈 값 위반 | KA04 |
| KA05·KA06 | 다른 파일·다른 칸 ID 항목은 자리를 덮지 않는다(항목 쪽 count 불일치도 위반) | KA05 · KA06 |
| KA07 | 대상 파일이 없는 항목은 CLI가 막는다 | KA07 |
| KA08 | 위반 문구에 `판정 불가`와 칸 ID | KA08 |
| KA09 | `--report` 셋째 열 `UNRESOLVED`·`allowed`, 다섯째 열 칸 ID | KA09 |

- 칸 91 · 칸 입력 163행(`dv4-cells.mjs` 출력 "칸 입력 163"). ΔV3 분기 169행과 합친 UT 분모는 332행이다.
- 판정 불가 자리도 P9를 따른다 — red 단말 노드 하나는 자리 하나다.

**ΔV3 R·L 대체 표** — ΔV3 §7-D의 R1~R8·L01~L11은 SUPERSEDED다.

| ΔV3 | → ΔV4 | | ΔV3 | → ΔV4 |
|---|---|---|---|---|
| R1 래퍼 2종 | KV04·KC01(5종) | | L01 클래스 필드 소유 | KO02 |
| R2 대입·호출 대상 B2 | KD01·KD02·KC03·KC04 | | L02 대입 대상 소유 | KO03 |
| R3 같은 파일 함수 | KD06~KD09 | | L03 즉시 호출 | KD07·KF03·KN05 |
| R4 산술 조합 | KV05(승계) | | L04 래퍼 3종 | KV04c~e |
| R5 소유 이름 | KO01~KO05 | | L05 구조 분해 호출 대상 | KC05 |
| R6 호출 대상 | KC01~KC13 | | L06 요소 접근 호출 대상 | KC09 |
| R7 now·elapsed | KN04~KN06·KE02·KE03 | | L07 now 헬퍼 | KN04 |
| R8 param | KP01~KP04 | | L08 `.not` | KE02·KE03 |
| | | | L09 기본값 없는 매개변수 | KP02~KP04 |
| | | | L10 복합 대입 | KD02(red) |
| | | | L11 재대입 호출 대상 | KC04(red) |

INDEX 후보 표의 0294 행(판정 정정 확장 12건 + L11)은 위 칸으로 전부 들어왔다 — 행을 지운다.

### ΔV4 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 A · D-001 | INHERITED | `V1:R-01` |
| AT-01d | AT | AC1·2·3·5·6·7c·**7f**·8 | CHANGED → **SUPERSEDED → ΔV5 AT-01e** | `ΔV3:AT-01c` 대체(AC7e → AC7f) |
| AR-03c · IT-03c | AR · IT | 게이트 (A)~(G) + (H′) + 판정 불가 위반 · `UNRESOLVED_ALLOWED` · `--report` UNRESOLVED 행 | CHANGED | `ΔV2:AR-03b`·`IT-03b` 대체 |
| MD-03d · UT-03d | MD · UT | (H′) 판정 — EP-12d(노드 종류 표 91칸 + ΔV3 분기 169행) | CHANGED → **SUPERSEDED → ΔV5 MD-03e · UT-03e** | `ΔV3:MD-03c`·`UT-03c` 대체 |
| AR-01b · IT-01b | AR · IT | 배율 SSOT ↔ 예산 24자리 | INHERITED | `ΔV2:AR-01b`·`IT-01b` — 게이트 코드가 바뀌어 회귀 |
| AT-05 | AT | AC16 회귀 | INHERITED | `V1:AT-05` |
| 그 밖의 node | — | — | INHERITED | 무변경 |

### ΔV4 Pair registry

| Pair | left ↔ right / 레벨 | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-12d | MD-03d ↔ UT-03d / UT | **SUPERSEDED → ΔV5 VP-12e (§7-F)** | 테스트 소스 문자열 → 해석기 노드 종류 표 → 형태·맥락 판정 → 자리·판정 불가·위반 | `scripts/check-test-budgets.test.mjs` — ΔV3 분기 169행 + ΔV4 칸 입력 163행마다 기대 단언(케이스명에 ID) | required — M43~M50 + 인용 변이(ΔV3 M39~M42 · verify r3 14) + ⑦ sweep 332행 | EP-12d(9지점 · 칸 91 · 입력 332) |
| VP-09c | AR-03c ↔ IT-03c / IT | REQUIRED (ΔV5에서 REGRESSION) | 트리 → `node scripts/check-test-budgets.mjs` → exit · `--report` → CI 'Test budget guard' | `gate:node scripts/check-test-budgets.mjs` exit 0 · `UNRESOLVED_ALLOWED` 0항목 · `--report` UNRESOLVED 행 0 · ΔV2 대조 명령 0줄(deadline 62) · Windows CI | required — **M51**(트리에 판정 불가 자리) · **M52**(허용 항목 count) · ΔV2 승계 M11c·M11d · Y-트리 | EP-03(20)·04(6)·05b(62)·06(3)·12d(9) = 100 |
| VP-01d | R-01 ↔ AT-01d / AT | **SUPERSEDED → ΔV5 VP-01e (§7-F)** | ΔV2 VP-01b와 같음 | AC1~3·5·6·8: verify r1 §5 좌표 승계 · AC7c: VP-07b·09c · AC7f: VP-12d·09c | VP-12d·09c 변이 | VP-07b와 같음(94) |
| VP-07b | AR-01b ↔ IT-01b / IT | REGRESSION | ΔV2와 같음 | 자리마다 게이트 좌표(M5b 24) | M5b | ΔV2와 같음(94) |
| VP-13 | R-01 ↔ AT-05 / AT | REGRESSION | 전체 스위트 — 깨끗한 호스트 | `evidence/clean-host-run.sh` + `newfails.mjs` added 0 · `git diff --stat <ΔV4 설계 커밋>..HEAD -- app/src` 0줄 | not selected | 0 |
| VP-12c · VP-09b · VP-01c | — | **SUPERSEDED** | — | VP-12d · VP-09c · VP-01d | — | — |
| VP-02~06 · 08 · 10 · 11 | V1 그대로 | NOT_REQUIRED | — | verify r1 §5 · r2-5 · r3-5 좌표 | — | 비영향: ΔV4 구현은 게이트 2파일·그 UT·`app/AGENTS.md`만 바꾼다 |

- `SUPERSEDED` 이관: VP-12c(분기 169행 · M39~M42 · 인용 변이 14) → VP-12d · VP-09b(M11c·M11d · Y-트리 · ΔV1 승계) → VP-09c · VP-01c(AC7c·7e) → VP-01d(AC7c·7f). 폐기 0.
- NEW·CHANGED 왼쪽 node ↔ 같은 레벨 REQUIRED pair: MD-03d → VP-12d(UT) · AR-03c → VP-09c(IT) · R-01(오른쪽 AT-01d CHANGED) → VP-01d. 영향받은 INHERITED → REGRESSION: VP-07b · VP-13. 차집합 0.

### ΔV4 Acceptance — 정정

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | **AT-01d / AC7f** (AC7e 대체 · **SUPERSEDED → ΔV5 AC7g**) | (H′)는 EP-12d대로 판정한다 — ΔV3 분기 169행과 칸 입력 163행의 기대와 같다. 값 자리가 red 칸·표 밖 종류에 닿으면 "판정 불가 <칸 ID>" 위반 1이고, `UNRESOLVED_ALLOWED`의 같은 파일·같은 칸 ID count가 그 자리 수와 같을 때만 통과한다. 호출 대상·now 자리의 경계 칸은 형태 아님·now 아님이다 | `check-test-budgets.test.mjs` 332행 기대 단언(케이스명에 ID) · `dv3-branches.mjs`·`dv4-cells.mjs` 판정 불일치 0 · 칸마다 그 칸을 지우거나 이웃 분류와 맞바꾸면 그 칸의 행이 red(⑦ sweep 기록) | `scripts/check-test-budgets.mjs` · `scripts/test-budget-bindings.mjs` |
| — | **AC19c** (AC19b 대체 · **SUPERSEDED → ΔV5 AC19d**) | `app/AGENTS.md`의 `check-test-budgets.mjs` 항목이 노드 종류 표(정본 = 해석기 헤더 주석과 plan §7-E) · 값 자리 fail-closed와 "판정 불가" 처방 · `UNRESOLVED_ALLOWED {file, reason, count, why}` · 경계 칸(import·lib 전역·밖에서 부르는 콜백)을 적는다 · `node scripts/check-doc-inventory.mjs --check` green | 문서 diff + 인벤토리 게이트 | 문서 |

**AC 게이트 재통과**(§5) — 정정 2행:

- 행동 단언·검증 수단·도달 경로: 두 행 모두 세 칸을 갖는다.
- **방향**: red 칸 행은 지금 0/0이고 기대 1/1이다 — 구현이 판정 불가를 내야 green이다. 경계·숫자 아님 칸 행(KD08·KD10·KD12e·KF04·KM07 등 0/0)은 fail-closed가 넓어져 정상 코드를 막는 반대 방향을 잠근다(M44~M47).
- **자리를 말하는 불변식의 맞바꿈 축**: 칸 ID가 위반 문구·허용 항목·`--report` 다섯째 열에 실린다 — 다른 칸 ID 항목이 자리를 덮지 않음을 KA06이 잠근다.
- 완결성 주장: 표 밖 종류는 값 자리에서 red(KV17·KD14)라 표가 모든 종류를 덮는다 — 트리 분포는 센서스 출력, 칸 입력 수는 `dv4-cells.mjs` 출력이 관측이다.
- structural proxy 없음 — 행마다 위반 수·판정 불가 수를 단언한다. 사람 실기로 미룬 순수 로직 없음.
- AC 총수: **21** 그대로(AC7e → AC7f · AC19b → AC19c 번호 승계).

### ΔV4 §10 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-03d / VP-12d **EP-12d** | (H′) 판정 — EP-12b 9지점 + 노드 종류 표 | `scripts/test-budget-bindings.mjs`(표 KV·KD·KM·KF·KC·KN) · `scripts/check-test-budgets.mjs`(KE·KO·KP·KA·판정 불가) | 게이트 | **9지점 · 칸 91 · 입력 332**(ΔV3 169 + ΔV4 163) | 칸 입력 = `node docs/handoff/0294-slow-runner-hermetic-tests/evidence/dv4-cells.mjs app` · 분기 = `dv3-branches.mjs app` · 칸별 트리 분포 = `dv4-kind-census.mjs app` | 칸 하나가 빠지면 그 종류의 미배율 마감이 통과하거나(거짓 green) 정상 코드가 판정 불가로 막힌다(오탐) |
| AR-03c / VP-09c **EP-13** (신설) | 판정 불가 허용 목록 | `UNRESOLVED_ALLOWED`(게이트) | 테스트 작성자 · 게이트 | **0항목** — 트리 판정 불가 0(센서스 V red 0) | `node scripts/check-test-budgets.mjs --report` 의 UNRESOLVED·allowed 행 = 0 | 낡은 항목은 다음 판정 불가 자리의 우회로가 된다 — count·대상 파일 대조로 막는다 |

- **EP-12d 게이트가 초록인 채로 남는 차이**(§5 완료 조건 ≠ 목표) — 전부 경계 칸이고 이번 턴에 쟀다:
  - 값 자리: import 20 · 밖에서 부르는 콜백의 매개변수 4와 그 멤버 2 · lib 전역 0 · `declare` 0 — 값을 테스트 밖이 고른다.
  - 호출 대상: 형태 아님 101,920 — 이름으로 풀리지 않거나 형태 이름이 아닌 호출. 구조 분해·요소 키·재대입 후보에 형태 이름 0.
  - now: now 아님 12 — 카운터·가짜 시계·타임스탬프, 실제 마감 0.
  - ΔV2 EP-05b의 남는 차이 5종 중 "콜백 매개변수·객체 리터럴로 풀리지 않는 값의 멤버"는 위 경계 칸으로 옮겨졌고 나머지 3종은 그대로다.
- EP-05b 62자리는 바뀌지 않는다 — 새 해석 경로의 트리 자리 0(센서스 `@new`·O04·N05 행 0).
- `실패 의미`에 "다른 게이트가 막는다"를 적은 칸: 없음.
- **ΔV4 유효 강제 지점 전수**: V1 67 + EP-05b 62 + EP-12d 9지점 + EP-13 0항목 = **138**. 칸 91·입력 332은 VP-12d UT의 분모다.

**ΔV4 등록 변이** — 판정 코드 변이(M43~M50)는 UT(VP-12d), 트리 변이(M51·M52)는 게이트(VP-09c)가 잡아야 한다.

| ID | 자리 | 바꾼 내용 | 잡아야 할 oracle |
|---|---|---|---|
| M43 | 값 자리 red 처리 | red 단말을 자리 없음으로(현재 fail-open으로 되돌림) | UT red 칸 행(KV10·KD02·KF05a 등) 1/1 → 0/0 |
| M44 | KD08 | 호출부 없는 매개변수를 전부 red로 | UT KD08a~e 0/0 → 1/1 · 트리 exit 1(4자리) |
| M45 | KD10 | import를 red로 | UT KD10a~c · 트리 exit 1(20자리) |
| M46 | KD12e | lib 전역을 red로 | UT KD12e · ΔV3 기존 입력(미선언 대리 식별자) |
| M47 | KF04 | 타이머 핸들·mock 체인을 red로 | UT KF04a~c · 트리 exit 1(5자리) |
| M48 | KC05 | 구조 분해 해석 삭제 | UT KC05a~d |
| M49 | KC04 | 재대입 후보의 형태 이름 검사 삭제(형태 아님으로) | UT KC04a |
| M50 | KE02·KE03 | `.not`을 무시하고 원래 방향으로 판정 | UT KE02a~d 1/0 → 0/0 · KE03a 0/0 → 1/0 |
| M51 | `src/main/infra/net/pop3-tls.test.ts` 끝 | `setTimeout(f, Math.max(1000, 5000))` 추가 | `gate:node scripts/check-test-budgets.mjs` exit 1 · 위반 문구 `판정 불가 KF05` |
| M52 | 같은 자리 + `UNRESOLVED_ALLOWED` | `{file, reason: 'KF05', count: 1, why}` 추가 → exit 0 · count 2 → exit 1 | 같은 게이트 |

### ΔV4 구현 설계

| 변경 파일 | 변경 내용 | 테스트 seam |
|---|---|---|
| `app/scripts/test-budget-bindings.mjs` | `classify(expr)` — KV·KD·KM·KF 표를 한 함수로, 단말 `{ kind: 'num'\|'scaled'\|'nonnum'\|'bound'\|'red', cell, node, value? }`. `values()`는 `classify`의 num·scaled 단말로 다시 구현(R4 조합 유지) · `isNow`에 KN04~KN06 · `calleeName`을 KC 표로(구조 분해 · 요소 리터럴 키 · 소유자 별칭 · 재대입 후보 · 형태 이름 후보면 red 표시) · 헤더 주석에 표 칸 ID | `analyzeScale`·`scanBudgetSites`(문자열 소스) → UT |
| `app/scripts/check-test-budgets.mjs` | 슬롯마다 `classify`의 red 단말 → 판정 불가 자리(`kind: 'deadline'`, `ok`는 허용 항목 일치, `reason` = 칸 ID) · `export const UNRESOLVED_ALLOWED = []` + `checkUnresolvedEntries` · `analyzeScale(relPath, source, entries = SEMANTIC_DELAYS, allowed = UNRESOLVED_ALLOWED)` · `scanBudgetSites(relPath, source, entries, allowed)` · `runCli(appDir, argv, entries, allowed)` — 대상 파일 없는 항목 · 위반 문구·`--report` 행 · KO02~KO04 소유 · KP02~KP04 param 슬롯 · KE02·KE03 `.not` · ΔV3 F04·R4 | 같음 + CLI 임시 트리 |
| `app/scripts/check-test-budgets.test.mjs` | 새 describe '노드 종류 표 (0294 ΔV4)' — `dv4-cells.mjs` 163행의 입력·기대 그대로(케이스명에 ID) · ΔV3 describe '분기 목록 (0294 ΔV3)' 47행 · 기존 케이스 유지 | node test |
| `app/AGENTS.md` | AC19c | 문서 diff + 인벤토리 |

- `dv4-kind-census.mjs`의 분류 코드는 자리 검색 명령(설계자 시제품)이다 — 구현은 복사하지 않는다(ΔV2 원칙). 입력(`dv3-branches.mjs`·`dv4-cells.mjs`)은 복사해도 된다.
- ⑦ sweep 분모 = 입력 332행 + 칸 91 + EP-05b 62자리. 칸마다 그 칸의 분류를 지우거나 이웃 분류(해석 ↔ 숫자 아님 ↔ 경계 ↔ red)와 맞바꾸는 변이를 심고 잡은 행 ID를 `[구현자 기입]`에 적는다.
- 테스트 소스(`app/src/**`) 변경 0 · 신규 의존성 0 · production 코드 무변경 · (A)~(G) 무변경. 트리에 판정 불가 자리가 생기면 PLAN_GAP으로 돌린다.
- 성능: 게이트 5.5s(r3)에 표 판정이 더해진다 — CI 'Test budget guard' 단계 시간을 `[구현자 기입]`에 적는다(센서스 전체 실행 9.2s가 상한 추정).

### ΔV4 운영 gate

| Gate | 적용 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint·typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error |
| node scripts 테스트 | 게이트 코드·테스트 변경 | `node --test "scripts/*.test.mjs"` | 전부 |
| 분기·칸 탐침 | AC7f | `node ../docs/handoff/0294-slow-runner-hermetic-tests/evidence/dv3-branches.mjs .` · `dv4-cells.mjs .` → 판정 불일치 0 | 전부 |
| 예산·인벤토리 게이트 | (H′) · 문서 | `node scripts/check-test-budgets.mjs` · ΔV2 대조 명령 0줄 · `--report` UNRESOLVED 행 0 · `node scripts/check-doc-inventory.mjs --check` | 전부 |
| vitest | 회귀(VP-13) | `evidence/clean-host-run.sh` — 리눅스 기준선 22건 분리 | 22건 밖 신규 실패 |
| Windows CI | 정본 통합 게이트 | PR `CI` 실행 | 전부 |
| commit trailer | message bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

### ΔV4 READY self-review

- Decision: D-017(사용자 결정) · D-018(표 내용) 추가, D-015·D-016 → D-018 SUPERSEDED(주어·해석기 하나·형태 8·맥락·한 리터럴 한 자리 승계). 대조는 §3 갱신 메모.
- 열린 입력 집합: 노드 종류 표(SKILL §5-A 둘째 방식)를 9자리에 두고, 값 자리는 표 밖 종류를 red로 막는다(첫째 방식). 호출 대상·now 자리의 경계 칸은 red로 둘 때의 오탐을 쟀다(101,920 · 12).
- 규칙 칸 ↔ UT 입력 칸: 칸 91마다 입력 행 ≥1 — 칸 입력 163 + ΔV3 행 참조(표의 'UT 입력' 열).
- 선언 경계는 측정한 것만 적었다 — 경계 칸의 트리 수 · red 칸 트리 0 · 새 경로 트리 자리 0 · 센서스 민감도 확인.
- 새·변경 왼쪽 node ↔ 같은 레벨 REQUIRED pair 차집합 0 · SUPERSEDED 3 pair 이관 표기 · 회귀 2 pair · NOT_REQUIRED 8 pair.
- 장치 방향: red 칸은 현재 0/0 → 기대 1/1 · 경계·숫자 아님 칸은 fail-closed 과잉을 잠근다(M44~M47) · 트리 변이 M51·M52.
- AC 2행은 §5 AC 게이트를 다시 통과했다(위 재통과 목록). 사람 실기 추가 없음(AC18 그대로).

## 7-F. ΔV5 — verify r4 D7 입력 칸 정합 + D8 창 안 확장 채택

> **적용 순서: `V1` → `ΔV1` → `ΔV2` → `ΔV3` → `ΔV4` → `ΔV5`.** 출처는 [verify r4](verify.md) r4-13이다. D7은 이행 결함(구현 r5가 고친다)이고, ΔV5는 KD05 칸 원문 "원천 멤버"의 범위를 입력 칸으로 풀어 적는다(plan 내부 정합). D8은 ΔV4 창 안(ΔV4 뒤 verify 1회째)의 확장 후보라 항목마다 **채택**한다(D-019). ΔV5는 사용자 결정 ΔV가 아니라 창을 새로 열지 않는다. **다음 verify가 ΔV4 창의 2회째이자 마지막 확장 창이다.**

### 무엇이 왜 바뀌는가

| verify r4 | 관측 | ΔV5의 답 |
|---|---|---|
| D7 (이행) | KD05 후보가 비면 구현이 표에 없는 `숫자 아님`을 낸다 — 원천이 호출·`await`·for-of·배열이면 위반 0(Q1~Q4) | KD05 "원천 멤버"를 칸 규칙으로 풀어 적고 입력 KD05b~k를 둔다. 규칙은 그대로이고 출처는 plan 내부 정합 |
| D8 (확장, 창 안) | 생성자 `this.ms = 5000`(Q8)·구조 분해 대입 `({ ms } = …)`(Q9)이 위반 0 | **채택**. 같은 파일 대입이 값을 바꾸는 경로를 형제까지 한 번에 칸으로 둔다 — 멤버 대입(KM10·KM11)과 변수 증감·구조 분해 대입(KD15) |
| D8 형제 (설계자 전수) | 객체 멤버 대입 `o.ms = 5000`(초기값 500)이 위반 0 · 변수 증감 `ms++`는 KD02(복합 대입)의 형제인데 칸이 없다 | 같은 결정 D-019에 넣는다 — 다음 verify가 형제를 하나씩 여는 일을 막는다 |

### 설계 근거 — 이번 턴 측정

기준 트리 = 구현 r4(`b4e1b9d`, 해석기 sha256 `d031747f0ce0…`). 증거 경로 접두사 `docs/handoff/0294-slow-runner-hermetic-tests/evidence/`.

| 관측 | 명령 | 결과 | 설계에 미친 영향 |
|---|---|---|---|
| ΔV5 칸 입력 | `node …/dv5-cells.mjs app` | 36행 · 현재 게이트와 판정 불일치 23 | r5가 바꿀 범위 |
| 새 경로의 트리 자리 | 해석기에 계측 시제품(커밋하지 않음 — KD05 빈 후보 · 멤버 대입 · `this` 대입 · 증감 · 구조 분해 대입 대상을 각각 별도 red 칸으로) → `node scripts/check-test-budgets.mjs --report` | exit 0 · UNRESOLVED 0 — 다섯 경로 모두 트리 0 · 같은 시제품이 r4 탐침 Q1·Q2·Q8·Q9와 `o.ms = 5000`·`ms++`·`const { ms } = {}`에 반응 | 채택해도 테스트 소스 변경 0 · 허용 목록 0항목 그대로 |
| 의도 규칙의 구현 가능성 | 시제품(커밋하지 않음 — `test-budget-bindings.mjs` 한 파일 +43줄)으로 세 탐침과 트리를 함께 실행 | `dv5-cells` 36 · `dv4-cells` 163 · `dv3-branches` 169 모두 불일치 0 · 트리 exit 0 · ΔV2 대조 명령 0줄 · 기존 UT 537/537 · `verify-r4-probes.mjs` 13 불일치 0 · 게이트 5.1s | 기존 332행 기대와 충돌 없이 구현된다 — 구현은 시제품을 복사하지 않는다 |
| 선언 경계 후보 | 계측 시제품 — 값 자리 멤버의 원천 객체가 같은 파일 밖 함수의 인자로 넘어감(PX) · 클래스 본문의 `Object.assign(this, …)`(PY) | 트리 0 · 심은 입력 2개에 각각 반응 | 경계 L12로 적는다 |
| 하위 클래스의 `this` 대입 | `rg 'class \w+ extends'` 테스트 소스 5파일 중 `this.<이름> =` 대입이 있는 3파일(`mail.integration.test.ts:52` · `sync-manager.test.ts:49` · `pop3-session.test.ts:17`) | 셋 다 `this.destroyed = true` — 값 자리에 닿지 않는다 | 경계 L13으로 적는다 |

### 칸 정정·추가 — EP-12e = EP-12d + 아래

입력·기대 원문은 `evidence/dv5-cells.mjs`의 같은 ID 행이다. 기대가 갈리면 이 표가 정본이다. `vc` 측정(`위반/판정 불가/칸 ID`)은 판정 불가 자리가 **어느 칸으로 보고되는지**까지 잠근다 — 칸 ID가 위반 문구·`UNRESOLVED_ALLOWED.reason`·`--report` 다섯째 열에 실린다(KA06 승계).

| 칸 | 종류 | 분류 | provenance | 트리 | UT 입력 |
|---|---|---|---|---:|---|
| KD05 | 구조 분해(중첩 포함) — 기본값 + 원천 멤버 | 후보마다 KV. **후보가 없으면 원천 식을 KM 표로 판정한다** — 원천 식 = 변수 초기값 · 같은 파일 호출부 인자(매개변수) · 바깥 패턴의 원천. 객체·배열 리터럴이면 KM01~KM05(키 없음 KM02 숫자 아님), 경계면 KM07, 그 밖(호출·`await`·`new` 등)은 KM08 red. **원천 식이 없는 선언은 그 선언의 칸** — for-of·for-in KD04 · `catch` KD13 · 호출부 없는 매개변수 KD08(기존) | CHANGED(분류 칸 풀어 씀) | 0 | ΔV4 KD05 · ΔV3 V08·V09·S10~S13 · **KD05b~k** |
| KD15 | 변수 — 증감(`++`·`--`, 전위·후위)이 있거나 구조 분해 대입(`({ x } = …)`·`[x] = …`·이름 바꾼 `{ k: x }`)의 대상 | red | NEW | 0 | KD15a~f · 형제 구별 KD15g(복합 대입은 KD02) |
| KM10 | 멤버 — `this.이름`(같은 클래스 본문 안 대입, 화살표 안 포함) · 객체 리터럴 원천의 멤버(대입 대상 `Y.k`·`Y['k']`의 Y 원천에 같은 객체 리터럴 — 별칭 변수·같은 파일 함수 매개변수 경유 포함)의 같은 파일 대입 `=`·`??=`·`\|\|=` | 우변을 후보에 더한다 — `this.이름`은 속성 선언 초기값(KM06) + 대입 우변, 객체는 KM01 값 + 대입 우변. 다른 클래스·다른 객체·다른 키의 대입은 후보 아님 | NEW | 0 | KM10a~m |
| KM11 | 같은 멤버 대상의 복합 대입(`+=` 등) · 증감 · 구조 분해 대입 대상 | red | NEW | 0 | KM11a~d |
| KM06 | `this.이름` — 속성 선언 초기값도 같은 클래스 대입(KM10)도 없음 | red | CHANGED(조건에 KM10 없음 추가) | 0 | ΔV4 KM06c · KM06d |

- 칸 94(ΔV4 91 + KD15·KM10·KM11) · 입력 368행(ΔV3 169 + ΔV4 163 + ΔV5 36).
- 판정 순서(같은 식별자·멤버에 둘 이상 해당): 변수는 KD13 → KD04 → KD03b → KD02 → **KD15** → KD01(KD15g가 KD02 우선을 잠근다). 멤버는 **KM11** → KM10·KM06/KM01 후보 합.
- `UNRESOLVED_LABELS`(위반 문구의 칸 이름)에 KD15 "증감·구조 분해 대입 변수" · KM11 "복합·증감·구조 분해 대입 멤버"를 더한다.

### 선언 경계 — EP-12e 열거 밖

verify는 이 형태의 반례를 `경계`로 두고 판정에 쓰지 않는다. 그 형태가 테스트 소스의 값 자리에 나타나면 경계가 아니라 현재 결함이다.

| ID | 형태 | 근거 | 트리 실측 |
|---|---|---|---|
| L12 | 같은 파일 밖에서 멤버를 바꾸는 경로 — 원천 객체를 같은 파일 밖 함수에 인자로 넘김 · `Object.assign(this, …)` · `Object.defineProperty` | 값을 바꾸는 코드가 같은 파일 선언 그래프 밖이다(D-015 주어 승계 — production·라이브러리 호출은 비범위) | 0 — 계측 시제품 PX·PY |
| L13 | 다른 클래스(상속 포함)의 `this.이름` 대입 | KM10은 같은 클래스 본문만 본다(KM10e) | 하위 클래스 `this` 대입 3곳 전부 `this.destroyed = true`, 값 자리 0 |

### ΔV5 Decision

D-019 추가(§3). D-017·D-018은 ACTIVE 그대로이고 D-019는 D-018 표의 보완이다(대체 아님).

### ΔV5 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 A · D-001 | INHERITED | `V1:R-01` |
| AT-01e | AT | AC1·2·3·5·6·7c·**7g**·8 | CHANGED | `ΔV4:AT-01d` 대체(AC7f → AC7g) |
| MD-03e · UT-03e | MD · UT | (H′) 판정 — EP-12e(칸 94 + 입력 368) | CHANGED | `ΔV4:MD-03d`·`UT-03d` 대체 |
| AR-03c · IT-03c | AR · IT | 게이트 (A)~(G) + (H′) + 판정 불가 위반 · `UNRESOLVED_ALLOWED` · `--report` | INHERITED | `ΔV4:AR-03c`·`IT-03c` — 게이트 문구표에 칸 이름 2개가 늘고 트리 판정은 그대로라 회귀로 닫는다 |
| AR-01b · IT-01b | AR · IT | 배율 SSOT ↔ 예산 24자리 | INHERITED | `ΔV2:AR-01b`·`IT-01b` — 해석기가 바뀌어 회귀 |
| AT-05 | AT | AC16 회귀 | INHERITED | `V1:AT-05` |
| 그 밖의 node | — | — | INHERITED | 무변경 |

### ΔV5 Pair registry

| Pair | left ↔ right / 레벨 | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-12e | MD-03e ↔ UT-03e / UT | REQUIRED | 테스트 소스 문자열 → 해석기 노드 종류 표 → 형태·맥락 판정 → 자리·판정 불가·위반 | `scripts/check-test-budgets.test.mjs` — ΔV3 169 + ΔV4 163 + **ΔV5 36행**마다 기대 단언(케이스명에 ID, ΔV5 행은 `vc` 측정 그대로 — 칸 ID까지) | required — **M53~M60** + 승계(ΔV4 M43~M50 · ΔV3 M39~M42 · verify r3 인용 14) + ⑦ sweep 368행·칸 94 | EP-12e(9지점 · 칸 94 · 입력 368) |
| VP-09c | AR-03c ↔ IT-03c / IT | REGRESSION | ΔV4와 같음 | `gate:node scripts/check-test-budgets.mjs` exit 0 · `--report` UNRESOLVED 0 · ΔV2 대조 명령 0줄(deadline 62) · Windows CI | **M61**(트리에 KD15 판정 불가 자리) · ΔV4 M51·M52 · ΔV2 M11c·M11d | ΔV4와 같음(100) |
| VP-01e | R-01 ↔ AT-01e / AT | REQUIRED | ΔV2 VP-01b와 같음 | AC1~3·5·6·8: verify r1 §5 좌표 승계 · AC7c: VP-07b·09c · AC7g: VP-12e·09c | VP-12e·09c 변이 | VP-07b와 같음(94) |
| VP-07b | AR-01b ↔ IT-01b / IT | REGRESSION | ΔV2와 같음 | 자리마다 게이트 좌표(M5b 24) | M5b | ΔV2와 같음(94) |
| VP-13 | R-01 ↔ AT-05 / AT | REGRESSION | 전체 스위트 — 깨끗한 호스트 | Windows CI 'Test' success(구현 head) · `git diff --stat <ΔV5 설계 커밋>..HEAD -- app/src app/vitest.config.ts app/scripts/{vitest-setup,test-time,test-host}.mjs app/package.json .github` 0줄 | not selected | 0 |
| VP-12d · VP-01d | — | **SUPERSEDED** | — | VP-12e · VP-01e | — | — |
| VP-02~06 · 08 · 10 · 11 | V1 그대로 | NOT_REQUIRED | — | verify r1 §5 · r2-5 · r3-5 · r4-5 좌표 | — | 비영향: ΔV5 구현은 게이트 2파일·그 UT·`app/AGENTS.md`만 바꾼다 |

- `SUPERSEDED` 이관: VP-12d(분기 169 · 칸 입력 163 · M43~M50 · 승계 변이) → VP-12e · VP-01d(AC7c·7f) → VP-01e(AC7c·7g). 폐기 0.
- VP-09c는 ΔV4에서 REQUIRED였고 ΔV5에서 노드가 바뀌지 않아 REGRESSION이다 — 선택 증거 M51·M52를 그대로 다시 돌린다.
- NEW·CHANGED 왼쪽 node ↔ 같은 레벨 REQUIRED pair: MD-03e → VP-12e(UT) · R-01(오른쪽 AT-01e CHANGED) → VP-01e. 영향받은 INHERITED → REGRESSION: VP-09c · VP-07b · VP-13. 차집합 0.

### ΔV5 Acceptance — 정정

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | **AT-01e / AC7g** (AC7f 대체) | (H′)는 EP-12e대로 판정한다 — ΔV3 분기 169행 · ΔV4 칸 입력 163행 · ΔV5 칸 입력 36행의 기대와 같다. 구조 분해 원천이 호출·`await`·for-of·`catch`면 판정 불가이고 그 칸 ID(KM08·KD04·KD13)로 보고된다. 같은 파일 대입이 값을 바꾸는 멤버는 대입 우변까지 후보이고(KM10), 증감·복합·구조 분해 대입은 판정 불가다(KD15·KM11) | `check-test-budgets.test.mjs` 368행 기대 단언(케이스명에 ID) · `dv3-branches.mjs`·`dv4-cells.mjs`·`dv5-cells.mjs` 판정 불일치 0 · 칸마다 지우거나 이웃 분류·이웃 칸 ID와 맞바꾸면 그 칸의 행이 red(⑦ sweep 기록) | `scripts/check-test-budgets.mjs` · `scripts/test-budget-bindings.mjs` |
| — | **AC19d** (AC19c 대체) | AC19c 그대로 + `app/AGENTS.md`의 `check-test-budgets.mjs` 항목이 노드 종류 표 정본을 plan §7-E·§7-F로 가리키고, 판정이 따라가는 선언 그래프에 "멤버(`this`·객체) 대입"을, 판정 불가 형태에 "증감·구조 분해 대입"을 적는다 · `node scripts/check-doc-inventory.mjs --check` green | 문서 diff + 인벤토리 게이트 | 문서 |

**AC 게이트 재통과**(§5) — 정정 2행:

- 행동 단언·검증 수단·도달 경로: 두 행 모두 세 칸을 갖는다.
- **방향**: red 칸 행(KD05b~e·h·i · KD15a~e · KM11a~d)은 지금 0/0이고 기대 1/1이다 — 구현이 판정 불가를 내야 green이다. KM10 행은 지금 0/0이고 기대 1/0(미배율 리터럴 위반)이다. 구별 입력(KD05f·g·k · KD15f · KM10b·e·k·l·m)은 0/0이라 과잉 판정(다른 객체·다른 클래스·다른 키까지 후보로 잡음)을 잠근다(M58·M59).
- **자리를 말하는 불변식의 맞바꿈 축**: 판정 불가 칸 ID가 위반 문구·허용 항목에 실린다 — `vc` 측정이 칸 ID를 단언하고(KD05d `KD04` · KD05h `KD13` · KD15g `KD02`), M54·M56이 맞바꿈을 심는다.
- 완결성 주장: 새 칸 3·정정 칸 2의 트리 분포는 계측 시제품 출력(전부 0), 입력 수는 `dv5-cells.mjs` 출력 "칸 입력 36"이 관측이다.
- structural proxy 없음 — 행마다 위반 수·판정 불가 수·칸 ID를 단언한다. 사람 실기로 미룬 순수 로직 없음.
- AC 총수: **21** 그대로(AC7f → AC7g · AC19c → AC19d 번호 승계).

### ΔV5 §10 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-03e / VP-12e **EP-12e** | (H′) 판정 — EP-12b 9지점 + 노드 종류 표 | `scripts/test-budget-bindings.mjs`(KV·KD·KM·KF·KC·KN) · `scripts/check-test-budgets.mjs`(KE·KO·KP·KA·판정 불가·칸 이름) | 게이트 | **9지점 · 칸 94 · 입력 368**(ΔV3 169 + ΔV4 163 + ΔV5 36) | 칸 입력 = `dv4-cells.mjs app` · `dv5-cells.mjs app` · 분기 = `dv3-branches.mjs app` | 칸 하나가 빠지면 그 종류의 미배율 마감이 통과하거나(거짓 green) 정상 코드가 판정 불가로 막힌다(오탐). 칸 ID가 바뀌면 허용 항목이 다른 자리를 덮는다 |
| AR-03c / VP-09c **EP-13** | 판정 불가 허용 목록 | `UNRESOLVED_ALLOWED` | 테스트 작성자 · 게이트 | **0항목**(ΔV4 그대로 — 새 경로 트리 0) | `node scripts/check-test-budgets.mjs --report`의 UNRESOLVED·allowed 행 = 0 | ΔV4와 같음 |

- **EP-12e 게이트가 초록인 채로 남는 차이** — ΔV4 목록 그대로 + L12(같은 파일 밖 멤버 변경, 트리 0) · L13(다른 클래스의 `this` 대입, 값 자리 0).
- EP-05b 62자리는 바뀌지 않는다 — 새 경로 트리 자리 0(계측 시제품).
- `실패 의미`에 "다른 게이트가 막는다"를 적은 칸: 없음.
- **ΔV5 유효 강제 지점 전수**: V1 67 + EP-05b 62 + EP-12e 9지점 + EP-13 0항목 = **138**(ΔV4와 같음). 칸 94·입력 368은 VP-12e UT의 분모다.

**ΔV5 등록 변이** — 판정 코드 변이(M53~M60)는 UT(VP-12e), 트리 변이(M61)는 게이트(VP-09c)가 잡아야 한다.

| ID | 자리 | 바꾼 내용 | 잡아야 할 oracle |
|---|---|---|---|
| M53 | KD05 빈 후보 | 판정을 `숫자 아님`으로 되돌림(verify r4 K1) | UT KD05b·c·d·e·h·i `1/1/…` → `0/0/-` |
| M54 | KD05 원천 식 없는 선언 | for-of·`catch`를 KD04·KD13 대신 KM08로 | UT KD05d·h 칸 ID 불일치 |
| M55 | KD15 | 증감·구조 분해 대입 대상 표시 제거 | UT KD15a~e → `0/0/-` 또는 리터럴만 |
| M56 | KD15 ↔ KD02 | 두 칸의 판정 순서·칸 ID 맞바꿈 | UT KD15a~e·KD15g 칸 ID 불일치 |
| M57 | KM10 | 대입 우변 후보 제거 | UT KM10a·c·d·f~j `1/0/-` → `0/0/-`(KM10c는 KM06 red) |
| M58 | KM10 소유 대조 | 같은 키면 어느 객체의 대입이든 후보로 | UT KM10l `0/0/-` → `1/0/-` |
| M59 | KM10 클래스 대조 | 다른 클래스의 `this` 대입도 후보로 | UT KM10e `0/0/-` → `1/0/-` |
| M60 | KM11 | red 대신 우변 후보(또는 무시)로 | UT KM11a~d `1/1/KM11` 불일치 |
| M61 | `src/main/infra/net/pop3-tls.test.ts` 끝 | `let probeMs = scaleMs(500); probeMs++; setTimeout(() => {}, probeMs)` 추가 → exit 1 · 위반 문구 `판정 불가 KD15` · 같은 파일 `UNRESOLVED_ALLOWED {reason: 'KD15', count: 1, why}` 추가 → exit 0 | `gate:node scripts/check-test-budgets.mjs` |

### ΔV5 구현 설계

| 변경 파일 | 변경 내용 | 테스트 seam |
|---|---|---|
| `app/scripts/test-budget-bindings.mjs` | `classifyIdentifier` 구조 분해 분기의 빈 후보 → KD05 정정 규칙(원천 식 KM 판정 · 원천 없는 선언의 칸) · 색인 단계에서 변수 증감·구조 분해 대입 대상(KD15)과 멤버 쓰기(대입 우변 · 복합/증감/구조 분해 대상) 수집 · `classifyMember`의 `this`·객체 원천 분기에 KM10 후보·KM11 red · 헤더 주석 칸 ID에 KD15·KM10·KM11 | `analyzeScale`(문자열 소스) → UT |
| `app/scripts/check-test-budgets.mjs` | `UNRESOLVED_LABELS`에 KD15·KM11 | 같음 |
| `app/scripts/check-test-budgets.test.mjs` | 새 describe '노드 종류 표 정정 (0294 ΔV5)' — `dv5-cells.mjs` 36행의 입력·기대 그대로(케이스명에 ID, `vc` 측정 — 칸 ID 단언 포함) · 기존 describe 유지 | node test |
| `app/AGENTS.md` | AC19d | 문서 diff + 인벤토리 |

- 계측·의도 규칙 시제품은 커밋하지 않았다 — 구현은 복사하지 않는다(ΔV2 원칙). 입력(`dv5-cells.mjs`)은 복사해도 된다.
- ⑦ sweep 분모 = 입력 368행 + 칸 94 + EP-05b 62자리. 새 칸 3·정정 칸 2는 지우는 변이와 이웃 분류·이웃 칸 ID 맞바꿈 변이를 둘 다 심고 잡은 행 ID를 `[구현자 기입]`에 적는다.
- 테스트 소스(`app/src/**`) 변경 0 · 신규 의존성 0 · production 코드 무변경 · (A)~(G) 무변경. 트리에 판정 불가 자리가 생기면 PLAN_GAP으로 돌린다.
- verify r4 N2(반환 객체의 외부 소비 0 API)는 거둬도 된다 — 거두면 `[구현자 기입]`에 적는다.

### ΔV5 운영 gate

ΔV4 운영 gate 7종 그대로 — 분기·칸 탐침 행에 `dv5-cells.mjs .`(판정 불일치 0)를 더한다.

### ΔV5 READY self-review

- Decision: D-019 추가(설계자 — verify r4 D8 창 안 채택 + D7 입력 칸 정합). D-017·D-018 ACTIVE 유지. 대조는 §3 갱신 메모.
- 창: ΔV4 창 안 1회째 뒤의 설계 턴이라 확장 채택이 허용된다. 채택은 한 번에 했다 — Q8·Q9와 형제(객체 멤버 대입 · 변수 증감 · 멤버 증감·복합·구조 분해 대상 · 하위 클래스·외부 변경은 경계).
- 규칙 칸 ↔ UT 입력 칸: 새·정정 칸 5개마다 분기 입력이 있다 — KD05(원천 = 호출·`await`·배열·import·키 없는 객체·배율 객체·매개변수 인자 2종 · 선언 = for-of·`catch`) · KD15(후위·전위·객체·배열·이름 바꾼 패턴·무관 변수·KD02 형제) · KM10(`this` 생성자·배율·초기값 없음·화살표·다른 클래스 · 객체 속성·요소·`??=`·별칭·매개변수·배율·다른 객체·다른 키) · KM11(`this` 복합·멤버 증감·멤버 구조 분해·`this` 구조 분해) · KM06(대입 없음).
- 선언 경계는 측정한 것만 적었다 — L12(PX·PY 0) · L13(값 자리 0).
- 새·변경 왼쪽 node ↔ 같은 레벨 REQUIRED pair 차집합 0 · SUPERSEDED 2 pair 이관 표기 · 회귀 3 pair · NOT_REQUIRED 8 pair.
- 장치 방향: red 칸 행 0/0 → 1/1 · KM10 0/0 → 1/0 · 구별 입력 0/0이 과잉을 잠근다(M58·M59) · 칸 ID 맞바꿈 M54·M56 · 트리 변이 M61.
- AC 2행은 §5 AC 게이트를 다시 통과했다(위 재통과 목록). 사람 실기 추가 없음(AC18 그대로).

## 7-G. ΔV6 — verify r5 D10 문장 정합 + D11 창 안 확장 채택 (마지막 열거 턴)

> **적용 순서: `V1` → `ΔV1` → … → `ΔV5` → `ΔV6`.** 출처는 [verify r5](verify.md) r5-13이다. D9는 이행 결함이라 칸 원문을 바꾸지 않고 구현 r6이 고친다. D10은 plan 내부 불일치라 D-019 문장 쪽으로 KD05 칸을 정정한다. D11은 ΔV4 창 안(ΔV4 뒤 verify 2회째)의 확장 후보라 항목마다 **채택**한다(D-020). **이 설계 턴 뒤 열거 원문은 동결된다** — 다음 verify(6회째)는 창 밖이며, 그 뒤 새 열거 항목은 출처(현재 결함 · plan 내부 정합 · 사용자 결정)를 적는다.

### 무엇이 왜 바뀌는가

| verify r5 | 관측 | ΔV6의 답 |
|---|---|---|
| D9 (이행) | 빈 후보에서 원천이 리터럴 + 호출로 섞이면 KM02 숫자 아님(R7·R8) | 칸 원문 그대로 — "원천 식을 KM 표로"는 원천 후보마다다. 입력 KD05l·m으로 잠근다 |
| D10 (plan 내부 불일치) | D-019 "원천 멤버 = 원천 식의 KM 판정" ↔ §7-F KD05 "후보가 없으면" — 후보가 있으면 KM10·KM11·비리터럴 원천이 빠진다(R5·R6·R7b·R8b) | **D-019 문장으로 맞춘다.** D-017(값 자리 fail-closed)이 "후보가 있으면 원천을 보지 않는다"를 허용하지 않는다. 구조 분해 값 = 같은 원천의 멤버 읽기 판정(후보 유무와 무관) |
| D10 형제 (설계자 전수) | 기본값이 있는 for-of·`catch` 구조 분해(`for (const { ms = 500 } of cases)`)가 KD04·KD13을 건너뛴다 · 중첩 패턴·`this` 원천의 멤버 대입이 빠진다 | 같은 문장에 든다 — 원천 식이 없는 선언은 기본값이 있어도 그 칸 |
| D11 (확장, 창 안 마지막) | KD02·KD15가 변수 선언만 본다 — 구조 분해 선언 요소 `ms++`·`ms += …`(R2·R2c) · 매개변수 `ms++`(R3) · for-of 머리 구조 분해 대입(R4) | **채택.** "변수" = 같은 파일의 모든 이름 바인딩 |
| D11 형제 (설계자 전수) | 매개변수·구조 분해 요소의 `=`·`??=` 대입 우변이 후보가 아니다(`function run(ms) { ms = 5000 … } run(500)` 위반 0) · for-of·for-in 머리의 식별자·멤버 대입 대상 · KD15 변수를 원천으로 쓰는 멤버 읽기 | 같은 결정 D-020에 넣는다 — 다음 verify가 형제를 하나씩 여는 일을 막는다 |

### 설계 근거 — 이번 턴 측정

기준 트리 = 구현 r5 `aac291f`(해석기 sha256 `06fe70269b6e…`). 증거 경로 접두사 `docs/handoff/0294-slow-runner-hermetic-tests/evidence/`.

| 관측 | 명령 | 결과 | 설계에 미친 영향 |
|---|---|---|---|
| ΔV6 칸 입력 | `node …/dv6-cells.mjs app` | 43행 · 현재 게이트와 판정 불일치 27 | r6가 바꿀 범위 |
| 의도 규칙의 구현 가능성 | 시제품(커밋하지 않음 — `test-budget-bindings.mjs` 한 파일 +114줄: 구조 분해 값의 원천 멤버 판정 · 모든 이름 바인딩의 대입·증감·구조 분해 대입 · for 머리 대입 대상)으로 탐침과 트리를 함께 실행 | `dv6-cells` 43 · `dv5-cells` 36 · `dv4-cells` 163 · `dv3-branches` 169 · `verify-r4-probes` 13 불일치 0 · `verify-r5-probes` 26 중 불일치 1(R19 — 아래) · 기존 UT `check-test-budgets.test.mjs` 576/576 | 기존 368행 기대와 충돌 없이 구현된다 — 구현은 시제품을 복사하지 않는다 |
| 새 경로의 트리 영향 | 같은 시제품으로 `node scripts/check-test-budgets.mjs` · `--report` | exit 0 · `--report` 90행이 r5와 바이트 동일(deadline 62 · setConfig 21 · case 6 · UNRESOLVED 0) | 채택해도 테스트 소스 변경 0 · 허용 목록 0항목 그대로 · EP-05b 62자리 불변 |
| R19 기대 | `verify-r5-probes.mjs` R19(`({ ...rest } = …)` 뒤 `rest.ms`) | 시제품·r5 모두 `1/1/KM08` — 탐침 기대 KD15와 다름 | 칸 기대는 KM08(멤버 읽기는 KM 칸, verify r5-3 판정과 같음). 입력 KM08c로 원문화 |
| 판정 순서 | 시제품에서 `catch ({ ms }) { ms++ }` · `for (let { ms } of …) { ms += … }` | 순서를 정하지 않으면 칸 ID가 KD15·KD02로 갈린다(변수 선언은 KD13·KD04가 먼저) | 모든 이름 바인딩에 같은 순서를 적는다 |

### 칸 정정 — EP-12f = EP-12e + 아래

입력·기대 원문은 `evidence/dv6-cells.mjs`의 같은 ID 행이다. 기대가 갈리면 이 표가 정본이다. 새 칸 ID는 없다 — 칸 94 그대로, 종류·분류 칸만 넓힌다.

| 칸 | 종류 | 분류 | provenance | 트리 | UT 입력 |
|---|---|---|---|---:|---|
| KD05 | 구조 분해 요소(중첩 포함, 나머지 요소 제외) | **값 = 기본값(KV) ∪ 같은 파일 대입 우변(KD01) ∪ 원천 멤버.** 원천 멤버는 같은 원천의 멤버 읽기(`원천.k` · 중첩 `원천.a.k` · 배열 패턴 `원천[i]`)와 같은 KM 판정이며 **원천 후보마다, 후보 유무와 무관하게** 낸다 — 리터럴 KM01~KM05 · 멤버 대입 우변 KM10 · 복합·증감·구조 분해 대입 KM11 red · `this` KM06/KM10/KM11 · 경계 KM07 · 그 밖(호출·`await`·`new` 등) KM08 red. 원천 식 = 변수 초기값 · 같은 파일 호출부 인자(매개변수) · 바깥 패턴의 원천 멤버. **원천 식이 없는 선언은 기본값이 있어도 그 칸** — for-of·for-in KD04 · `catch` KD13 · `declare` KD03b · 호출부 없는 매개변수 KD08(기본값은 후보로 남는다) | CHANGED(§7-F 칸 대체) | 0 | ΔV5 KD05b~k · **KD05l~z** · 짝 KD05lm·nm·pm·rm |
| KD01 · KD02 · KD15 | **이름 바인딩** — 변수 선언 · 구조 분해 선언 요소 · 매개변수(식별자·구조 분해 요소) | KD01: `=`·`??=`·`\|\|=` 대입 우변을 후보에 더한다. KD02: 복합 대입 red. KD15: 증감 · 구조 분해 대입 대상 · **for-of·for-in 머리의 대입 대상**(식별자·패턴) red | CHANGED(종류 "변수" → 이름 바인딩) | 0 | ΔV4·ΔV5 그대로 + **KD15h~p · KD02b~d · KD01b~f** |
| KM11 | 같은 멤버 대상의 복합 대입 · 증감 · 구조 분해 대입 대상 · **for-of·for-in 머리의 멤버 대입 대상** | red | CHANGED(대상 추가) | 0 | ΔV5 KM11a~d · **KM11e** |
| KM08 | 원천 사슬이 KD15 이름 바인딩·나머지 요소에 닿은 멤버 읽기 | red(원천 없음) | CHANGED(조건 명시) | 0 | **KM08b~d** |
| KM10 | 원천 사슬에 매개변수·구조 분해 요소의 대입 우변이 든다 | 후보 | CHANGED(사슬 범위) | 0 | ΔV5 KM10a~m · **KM10n** |

- 칸 94(ΔV5 그대로) · 입력 **411**행(ΔV3 169 + ΔV4 163 + ΔV5 36 + ΔV6 43).
- **판정 순서(모든 이름 바인딩)**: KD13 → KD04 → KD03b → KD02 → KD15 → 값 칸(KD01 · KD05 · KD06~KD09). 구조 분해 요소의 KD13·KD04·KD03b는 가장 바깥 패턴의 선언에서 정한다. 입력 KD13b·KD04b·KD02d가 순서를 잠근다. 멤버는 ΔV5 그대로(KM11 → KM10·KM06/KM01 후보 합).
- 나머지 요소 `{ ...rest }`는 KD05가 아니라 기존 경로다 — 그 멤버 읽기는 KM08(입력 KM08c·d).

### ΔV6 Decision

D-020 추가(§3). D-017·D-018·D-019는 ACTIVE 그대로이고 D-020은 D-019 KD05 문장의 정합(D10)과 이름 바인딩 범위 채택(D11)이다(대체 아님).

### ΔV6 Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1 A · D-001 | INHERITED | `V1:R-01` |
| AT-01f | AT | AC1·2·3·5·6·7c·**7h**·8 | CHANGED | `ΔV5:AT-01e` 대체(AC7g → AC7h) |
| MD-03f · UT-03f | MD · UT | (H′) 판정 — EP-12f(칸 94 + 입력 411) | CHANGED | `ΔV5:MD-03e`·`UT-03e` 대체 |
| AR-03c · IT-03c | AR · IT | 게이트 (A)~(G) + (H′) + 판정 불가 · `UNRESOLVED_ALLOWED` · `--report` | INHERITED | `ΔV4:AR-03c`·`IT-03c` — 해석기가 바뀌어 회귀 |
| AR-01b · IT-01b | AR · IT | 배율 SSOT ↔ 예산 24자리 | INHERITED | `ΔV2:AR-01b`·`IT-01b` — 해석기가 바뀌어 회귀 |
| AT-05 | AT | AC16 회귀 | INHERITED | `V1:AT-05` |
| 그 밖의 node | — | — | INHERITED | 무변경 |

### ΔV6 Pair registry

| Pair | left ↔ right / 레벨 | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-12f | MD-03f ↔ UT-03f / UT | REQUIRED | 테스트 소스 문자열 → 해석기 노드 종류 표 → 형태·맥락 판정 → 자리·판정 불가·위반 | `scripts/check-test-budgets.test.mjs` — ΔV3 169 + ΔV4 163 + ΔV5 36 + **ΔV6 43행**마다 기대 단언(케이스명에 ID, ΔV6 행은 `vc` 측정 그대로 — 칸 ID까지) | required — **M62~M70** + verify r5 K2 + 승계(ΔV5 M53~M60 · ΔV4 M43~M50 · ΔV3 M39~M42 · verify r3 인용 14) + ⑦ sweep 411행·칸 94 | EP-12f(9지점 · 칸 94 · 입력 411) |
| VP-09c | AR-03c ↔ IT-03c / IT | REGRESSION | ΔV4와 같음 | `gate:node scripts/check-test-budgets.mjs` exit 0 · `--report` UNRESOLVED 0 · ΔV2 대조 명령 0줄(deadline 62) · Windows CI | **M71**(트리에 매개변수 증감 판정 불가 자리) · ΔV5 M61·M61b · ΔV4 M51·M52 · ΔV2 M11c·M11d | ΔV4와 같음(100) |
| VP-01f | R-01 ↔ AT-01f / AT | REQUIRED | ΔV2 VP-01b와 같음 | AC1~3·5·6·8: verify r1 §5 좌표 승계 · AC7c: VP-07b·09c · AC7h: VP-12f·09c | VP-12f·09c 변이 | VP-07b와 같음(94) |
| VP-07b | AR-01b ↔ IT-01b / IT | REGRESSION | ΔV2와 같음 | 자리마다 게이트 좌표(M5b 24) | M5b | ΔV2와 같음(94) |
| VP-13 | R-01 ↔ AT-05 / AT | REGRESSION | 전체 스위트 — 깨끗한 호스트 | Windows CI 'Test' success(구현 head) · `git diff --stat <ΔV6 설계 커밋>..HEAD -- app/src app/vitest.config.ts app/scripts/{vitest-setup,test-time,test-host}.mjs app/package.json .github` 0줄 | not selected | 0 |
| VP-12e · VP-01e | — | **SUPERSEDED** | — | VP-12f · VP-01f | — | — |
| VP-02~06 · 08 · 10 · 11 | V1 그대로 | NOT_REQUIRED | — | verify r1 §5 · r2-5 · r3-5 · r4-5 · r5-5 좌표 | — | 비영향: ΔV6 구현은 해석기·그 UT·`app/AGENTS.md`만 바꾼다 |

- `SUPERSEDED` 이관: VP-12e(칸 94 · 입력 368 · M53~M60 · 승계 변이) → VP-12f · VP-01e(AC7c·7g) → VP-01f(AC7c·7h). 폐기 0.
- NEW·CHANGED 왼쪽 node ↔ 같은 레벨 REQUIRED pair: MD-03f → VP-12f(UT) · R-01(오른쪽 AT-01f CHANGED) → VP-01f. 영향받은 INHERITED → REGRESSION: VP-09c · VP-07b · VP-13. 차집합 0.

### ΔV6 Acceptance — 정정

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | **AT-01f / AC7h** (AC7g 대체) | (H′)는 EP-12f대로 판정한다 — ΔV3 169 · ΔV4 163 · ΔV5 36 · ΔV6 43행의 기대와 같다. 구조 분해 값은 같은 원천의 멤버 읽기와 같은 판정이다(짝 행 4쌍이 같은 `vc`). 원천이 리터럴과 호출로 섞이면 판정 불가 KM08이다. 매개변수·구조 분해 요소도 대입 우변이 후보이고 증감·복합·구조 분해 대입·for 머리 대입은 판정 불가다(KD15·KD02·KM11) | `check-test-budgets.test.mjs` 411행 기대 단언(케이스명에 ID) · `dv3-branches`·`dv4-cells`·`dv5-cells`·`dv6-cells` 판정 불일치 0 · 칸마다 지우거나 이웃 분류·이웃 칸 ID와 맞바꾸면 그 칸의 행이 red(⑦ sweep 기록) | `scripts/check-test-budgets.mjs` · `scripts/test-budget-bindings.mjs` |
| — | **AC19e** (AC19d 대체) | AC19d 그대로 + `app/AGENTS.md`의 `check-test-budgets.mjs` 항목이 노드 종류 표 정본을 plan §7-E·§7-F·§7-G로 가리키고, 판정 불가 형태 "증감·구조 분해 대입"이 변수·매개변수·멤버에 걸림을 적는다 · `node scripts/check-doc-inventory.mjs --check` green | 문서 diff + 인벤토리 게이트 | 문서 |

**AC 게이트 재통과**(§5) — 정정 2행:

- 행동 단언·검증 수단·도달 경로: 두 행 모두 세 칸을 갖는다.
- **방향**: red 칸 행(KD05l·m·n·o·q·t·u·v · KD15h·i·j·m·n·o · KD02b·c·d · KM11e · KM08b·c·d · KD13b·KD04b)은 판정 불가가 나와야 green이다. 후보 행(KD05p·r·s·z · KD01b~e · KM10n)은 미배율 리터럴 위반 1이 나와야 green이다. 구별 입력(KD05w·x·y · KD01f · KD15k·l·p)은 0/0이라 과잉 판정(배율 원천 · 경계 원천 · 다른 키 · 무관 바인딩)을 잠근다.
- **대칭 축**: 짝 행 KD05l↔lm · n↔nm · p↔pm · r↔rm은 같은 기대다 — 구조 분해 경로만 고장 내면 한쪽만 바뀐다(M62·M64).
- **자리를 말하는 불변식의 맞바꿈 축**: 칸 ID를 `vc`가 단언한다 — KD13b `KD13` · KD04b `KD04` · KD02d `KD02` · KD02b `KD02` ↔ KD15h `KD15`. M68이 순서 맞바꿈을 심는다.
- 완결성 주장: 칸 5개 정정의 트리 분포는 시제품 출력(exit 0 · `--report` 동일), 입력 수는 `dv6-cells.mjs` 출력 "칸 입력 43"이 관측이다.
- structural proxy 없음 — 행마다 위반 수·판정 불가 수·칸 ID를 단언한다. 사람 실기로 미룬 순수 로직 없음.
- AC 총수: **21** 그대로(AC7g → AC7h · AC19d → AC19e 번호 승계).

### ΔV6 §10 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-03f / VP-12f **EP-12f** | (H′) 판정 — EP-12b 9지점 + 노드 종류 표 | `scripts/test-budget-bindings.mjs`(KV·KD·KM·KF·KC·KN) · `scripts/check-test-budgets.mjs`(KE·KO·KP·KA·판정 불가·칸 이름) | 게이트 | **9지점 · 칸 94 · 입력 411**(ΔV3 169 + ΔV4 163 + ΔV5 36 + ΔV6 43) | 칸 입력 = `dv4-cells.mjs app` · `dv5-cells.mjs app` · `dv6-cells.mjs app` · 분기 = `dv3-branches.mjs app` | 칸 하나가 빠지면 그 종류의 미배율 마감이 통과하거나(거짓 green) 정상 코드가 판정 불가로 막힌다(오탐). 구조 분해와 멤버 읽기의 판정이 갈리면 같은 값이 문법에 따라 통과한다 |
| AR-03c / VP-09c **EP-13** | 판정 불가 허용 목록 | `UNRESOLVED_ALLOWED` | 테스트 작성자 · 게이트 | **0항목**(그대로 — 새 경로 트리 0) | `node scripts/check-test-budgets.mjs --report`의 UNRESOLVED·allowed 행 = 0 | ΔV4와 같음 |

- **EP-12f 게이트가 초록인 채로 남는 차이** — ΔV5 목록(ΔV4 + L12·L13) 그대로. ΔV6는 새 경계를 선언하지 않는다(측정한 경계 후보 없음).
- EP-05b 62자리는 바뀌지 않는다 — 시제품 `--report` 동일.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 칸: 없음.
- **ΔV6 유효 강제 지점 전수**: V1 67 + EP-05b 62 + EP-12f 9지점 + EP-13 0항목 = **138**(ΔV5와 같음). 칸 94·입력 411은 VP-12f UT의 분모다.

**ΔV6 등록 변이** — 판정 코드 변이(M62~M70)는 UT(VP-12f), 트리 변이(M71)는 게이트(VP-09c)가 잡아야 한다. verify r5 K2(`.some` → `.every`)도 같은 UT가 잡아야 한다(D9 인용 변이).

| ID | 자리 | 바꾼 내용 | 잡아야 할 oracle |
|---|---|---|---|
| M62 | KD05 원천 멤버 | 후보(기본값·대입)가 있으면 원천을 보지 않음(r5 동작으로 되돌림) | UT KD05n·o·p·q·r·s·u·v 불일치 · 짝 KD05nm·pm·rm은 그대로 |
| M63 | KD05 혼합 원천 | 원천 후보 중 리터럴이 하나라도 있으면 KM02(verify r5 K2와 같은 축) | UT KD05l·m 불일치 |
| M64 | KD05 ↔ KM10·KM11 | 구조 분해 원천의 멤버 쓰기 무시 | UT KD05p·q·r·s 불일치 · KD05y 그대로 |
| M65 | KD02·KD15 바인딩 종류 | 구조 분해 요소·매개변수를 변수 선언에서만 보는 판정으로 | UT KD15h·i·j · KD02b·c·d 불일치 |
| M66 | KD01 바인딩 종류 | 매개변수·구조 분해 요소의 대입 우변 제거 | UT KD01b~e · KM10n 불일치 · KD01f 그대로 |
| M67 | for 머리 대입 대상 | for-of·for-in 머리 대입 대상 표시 제거 | UT KD15m·n·o · KM11e 불일치 |
| M68 | 판정 순서 | 구조 분해 요소에서 KD15·KD02를 KD13·KD04보다 먼저 | UT KD13b·KD04b 칸 ID 불일치 |
| M69 | KD15 소유 대조 | 증감 대상이 같은 함수의 다른 매개변수·같은 패턴의 다른 요소여도 red | UT KD15k·l `0/0/-` → red |
| M70 | 원천 사슬 | KD15 이름 바인딩을 원천으로 그대로 풂 | UT KM08b 불일치 |
| M71 | `src/main/infra/net/pop3-tls.test.ts` 끝 | `function probe(ms) { ms++; setTimeout(() => {}, ms) }` + `probe(scaleMs(500))` 추가 → exit 1 · 위반 문구 `판정 불가 KD15` · 같은 파일 `UNRESOLVED_ALLOWED {reason: 'KD15', count: 1, why}` 추가 → exit 0 | `gate:node scripts/check-test-budgets.mjs` |

### ΔV6 구현 설계

| 변경 파일 | 변경 내용 | 테스트 seam |
|---|---|---|
| `app/scripts/test-budget-bindings.mjs` | 색인 단계: for-of·for-in 머리가 선언이 아니면 대입 패턴으로 표시(`markAssignmentPattern`) · `classifyIdentifier`: 구조 분해 요소·매개변수에 판정 순서(바깥 선언의 KD13·KD04·KD03b → KD02 → KD15)와 대입 우변 후보 · 구조 분해 요소 값 = 기본값 ∪ 대입 우변 ∪ 원천 멤버(원천 owner마다 `classifyMember`와 같은 KM 판정 — `this` 원천 포함) — `emptyDestructuring`의 "후보가 없으면" 분기와 `:603` 리터럴 `.some` 판정은 이 경로로 대체 · `expand`: 매개변수·구조 분해 요소의 대입 우변, KD15 바인딩은 원천 없음 · 헤더 주석 칸 설명 | `analyzeScale`(문자열 소스) → UT |
| `app/scripts/check-test-budgets.test.mjs` | 새 describe '노드 종류 표 정정 (0294 ΔV6)' — `dv6-cells.mjs` 43행의 입력·기대 그대로(케이스명에 ID, `vc` 측정) · 기존 describe 유지 | node test |
| `app/AGENTS.md` | AC19e | 문서 diff + 인벤토리 |

- 멤버 읽기 판정과 구조 분해 판정은 한 함수를 함께 쓴다 — 같은 KM 규칙을 두 곳에 복사하지 않는다(짝 행이 대칭을 잠근다).
- `check-test-budgets.mjs` `UNRESOLVED_LABELS`는 바꾸지 않는다 — 새 칸 ID 없음. KD15 문구 "증감·구조 분해 대입 변수"의 "변수"는 이름 바인딩을 뜻한다(AC19e 문서가 적는다).
- 시제품은 커밋하지 않았다 — 구현은 복사하지 않는다(ΔV2 원칙). 입력(`dv6-cells.mjs`)은 복사해도 된다.
- ⑦ sweep 분모 = 입력 411행 + 칸 94 + EP-05b 62자리. 정정 칸 5개는 지우는 변이와 이웃 분류·이웃 칸 ID 맞바꿈 변이를 둘 다 심고 잡은 행 ID를 `[구현자 기입]`에 적는다.
- 테스트 소스(`app/src/**`) 변경 0 · 신규 의존성 0 · production 코드 무변경 · (A)~(G) 무변경. 트리에 판정 불가 자리가 생기면 PLAN_GAP으로 돌린다.

### ΔV6 운영 gate

ΔV4 운영 gate 7종 그대로 — 분기·칸 탐침 행에 `dv6-cells.mjs .`(판정 불일치 0)를 더한다.

### ΔV6 READY self-review

- Decision: D-020 추가(설계자 — verify r5 D10 plan 내부 정합 + D11 창 안 채택). D-017~D-019 ACTIVE 유지. 대조는 §3 갱신 메모.
- 창: ΔV4 창 안 2회째 뒤의 설계 턴이라 확장 채택이 허용되는 마지막 턴이다. 채택은 한 번에 했다 — R2·R2c·R3·R4와 형제(매개변수·구조 분해 요소 대입 우변 · for-of·for-in 머리 식별자·멤버 대상 · KD15 원천 사슬 · 판정 순서). 이 턴 뒤 열거는 동결된다.
- 규칙 칸 ↔ UT 입력 칸: 정정 칸 5개의 분기마다 입력이 있다 — KD05(혼합 빈 리터럴·키 있는 리터럴 · 조건식 두 종 · 멤버 대입 · 증감 · 중첩 · `this` 대입·없음 · for-of·`catch` 기본값 · 배율 혼합 · 경계 혼합 · 다른 키 · 기본값만) · KD01/02/15(구조 분해 요소·매개변수·구조 분해 매개변수 × 대입·복합·증감·구조 분해 대입 · 호출부 없음 · 배율 · 무관 바인딩 2 · for 머리 식별자·패턴·for-in) · KM11(for 머리 멤버) · KM08(KD15 원천 · 나머지 요소 2) · KM10(매개변수 대입 사슬) · 순서 3.
- 선언 경계: 새로 적지 않았다 — 측정한 경계 후보가 없다.
- 새·변경 왼쪽 node ↔ 같은 레벨 REQUIRED pair 차집합 0 · SUPERSEDED 2 pair 이관 표기 · 회귀 3 pair · NOT_REQUIRED 8 pair.
- 장치 방향: red 칸 행은 판정 불가 · 후보 행은 위반 1 · 구별 입력 0/0이 과잉을 잠근다(M69) · 짝 행 대칭(M62·M64) · 칸 ID 맞바꿈(M68) · 트리 변이 M71.
- AC 2행은 §5 AC 게이트를 다시 통과했다(위 재통과 목록). 사람 실기 추가 없음(AC18 그대로).

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 측정 (2026-11-03, 리눅스 컨테이너 Xeon 2.1GHz 4코어 · Node 22.23.4 · vitest 4.1.10)

| 실행 | 방법 | 결과 |
|---|---|---|
| 기준선(깨끗한 호스트) | `evidence/clean-host-run.sh` — `env -i` + 빈 HOME | 8,445케이스 · 실패 22(9파일, Windows 경로·Claude 플러그인 Linux 차이) · 2m16s |
| 에이전트 실제 호스트 | 실제 `~/.claude`·`CLAUDE_*` 60여 변수 | 기준선과 같은 22 |
| 합성 사내 호스트(설정·변수) | HOME 파일 + 환경변수, gitconfig는 무해 | **+33**(11파일) |
| 합성 사내 호스트(결합) | `evidence/hostile-host-run.sh` — 위 + `CLAUDE_CONFIG_DIR`·`OPENCODE_CONFIG_DIR`·`OPENCODE_DISABLE_PROJECT_CONFIG`·서명 강제 gitconfig | **+113**(29파일) · 실행 중 HOME 새 파일 = confluence 다운로드 경로 |
| ↳ 분해: `~/.config/opencode/opencode.json` | 키별 HOME | `mcp` enabled 12 ∪ disabled 17 = **27**(9파일) · `plugin`·`model`·`agent`·`permission`·스킬·캐시·auth.json·`~/.claude*`·orca sources·`~/.agents` = 0 |
| ↳ 분해: 환경변수 | 변수 하나씩 | `OPENCODE_CONFIG` 16 · `OPENCODE_CONFIG_DIR` 16 · `OPENCODE_DISABLE_PROJECT_CONFIG` 2 · `CLAUDE_CONFIG_DIR` 3 · `ANTHROPIC_MODEL` 1 · `CLAUDE_CODE_DISABLE_1M_CONTEXT` 1 · 나머지 12종(프록시·API 키·BASE_URL·BEDROCK·TMPDIR·OPENCODE_DB 등) 0 |
| ↳ 분해: `~/.gitconfig` | 키별 | `commit.gpgsign=true`+없는 gpg **76**(16파일) · `init.defaultBranch=develop` 1(`service.test.ts:245`) · autocrlf·hooksPath·pull.rebase·user 0 |
| 실제 홈 쓰기 | 직렬 실행 + 파일 mtime | `bootstrap.opencode-warmup.test.ts` → `~/.config/orcinus-orca/orcinus-orca.json` · `confluence/connector.test.ts` → `~/.config/orcinus-orca/downloads/confluence/confluence-test` |
| 저성능 모사 S1 | `evidence/slow-runner-run.sh … 4` (1코어·4워커, 6m42s = 2.96×) | +1 `UsageTab.chart.test.ts`(기본 1s `vi.waitFor`) |
| 저성능 모사 S2 | `… 8` (1코어·8워커, 6m47s) | +2 위 1 + `bootstrap.opencode-warmup.test.ts:282`(기본 1s) · 최장 케이스 `managed-mcp-document-contract` 26.6s/60s · `syntax.test.ts` 12.8s/20s · `error-report.registry` 11.8s/20s |
| 포크 모사 | `evidence/fork-deployment.py`(id `acme-*`) | **+13**(7파일) — fixture와 같은 id 포크에서도 13 · 번들 스킬 추가 0 |
| 고정 포트 | 부하 중 전체 실행 2회 · 단독 300회 | `loopback-callback` favicon 케이스 "fetch failed" 2회 · 단독 0회 → 45211~ 가 임시 포트 대역(32768–60999) 안 |
| 시제품(커밋 안 함) | 격리 setup + waitFor 배율을 별도 작업 트리에 적용 | 합성 사내 호스트(결합과 같은 요인) +0 · S2 +0 · 실행 중 HOME 새 파일 0 |
| CI 실측 | run 41647319393(windows-latest) | 작업 13m43s · Test 8m43s · Lint 2m15s · Typecheck 53s · npm ci 1m16s |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `vi.setConfig` | `node evidence/scan-test-budgets.mjs app` `setConfig` | 20 | 실-git 16(게이트 A 대상) + 기타 4 |
| 케이스 타임아웃 인자 | 같은 스캔 `case` | 6(5파일) | 훅 타임아웃 0 |
| 실시간 마감 후보 | 같은 스캔 `deadline` 4 + `setTimeout` 6 | 10 | 예산 4 · 의미 대기 6(§10 EP-05) |
| `vi.waitFor` | 같은 스캔 `waitFor` | 172(51파일) | 기본 156 · 명시 timeout 13 · interval만 3 |
| 기타 대기 API | `rg -n "waitUntil\(\|expect\.poll\(" app/src -g '*.test.ts'` | 0 | 로컬 helper(`opencode-continuation.test.ts:59`)는 `vi.waitFor` 경유 |
| 호스트 env 키(프로덕션) | `rg -o --no-filename "\b(ANTHROPIC\|CLAUDE\|OPENCODE\|XDG\|GIT)_[A-Z0-9_]+\b\|\bCLAUDECODE\b\|\b(USERPROFILE\|ProgramData\|APPDATA\|LOCALAPPDATA)\b" app/src/main app/src/shared -g '!*.test.ts' -g '!*.testfixture.ts' \| sort -u` | 58종 | D-005 술어 밖 **0**(상수 식별자 포함 전부 접두사 일치) — `homedir()` 29곳·`env.HOME` 2곳은 HOME/USERPROFILE 리다이렉트가 덮는다 |
| 실제 바인딩 고정 포트 | `rg -n "listen\(\|port:\s*[0-9]{4}" app/src -g '*.test.ts'` → 바인딩 확인 | 1파일 | `oauth.test.ts`는 `listen` 주입이라 바인딩 없음 |
| 기본 브랜치 리터럴 | `rg -n "'master'\|'main'" app/src/main -g '*.test.ts'` | 1 | `service.test.ts:245` |
| 배포 모듈 참조 테스트 | `rg -l "deployment/(auth-definitions\|gate-auth\|harness-runtime\|plugins\|connections\|spawn-env\|usage-fetcher)'" app/src -g '*.test.ts'` ∪ `rg -l "from '\./(auth-definitions\|gate-auth\|harness-runtime\|plugins\|connections\|spawn-env\|usage-fetcher)'" app/src/main/app/deployment -g '*.test.ts'` | 15 | 포크에서 실패 7파일 13건은 전부 이 15파일 안 — 5파일은 기본값 직접 단언, `bootstrap.harness`(bootstrap→`gate-auth`)·`mcp-reconcile`(prepare-input→`spawn-env`)은 다른 모듈 경유 |

### 수치 / 전칭 표현 검산

- 합성 호스트 +33 = opencode mcp 27 ∪ env 분해(중복 포함) — 11파일 목록이 분해 합집합과 같다(`newfails.mjs` 비교).
- 포크 13 = 삭제 6 + 절 삭제 2 + fixture 고정 2 + helper 전환 3.
- 예산 자리 42 = 2+1+20+6+10+3(EP-01~06).
- "유일한 바인딩 고정 포트 테스트" 반례 검색: 위 표 — `loopback-callback.test.ts` 하나.
- 기존 테스트 존재 확인: `check-test-budgets.test.mjs:48-254` describe 블록 · `deployment-wiring.test.ts:527-582`('production 배포 factory — 기본 배포 계약') · `:673`('기본 배포는 주입점을 비워 둔다') · `login-free-deployment.test.ts:339`(AC15)·`:305`(AC10 each) · `connections.test.ts:70` · `mail.integration.test.ts:445` · `managed-mcp-document-contract.test.ts:66-71` · `bootstrap.harness.test.ts` 'start forwards its real settings service…' · `mcp-reconcile.test.ts` 'traces warmup navigation…'.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`
- 현재 책임 소유자: 예산 = `vitest.config.ts`(케이스 20s) + vitest 기본(훅 10s·waitFor 1s) + 파일별 리터럴 · 호스트 = 없음(테스트가 실제 HOME/env를 읽음).
- 문제 경로 ①: 느린 러너 → `vi.waitFor` 1s 초과 → "expected … length 1 got 0"(§8 S1·S2).
- 문제 경로 ②: 호스트 `~/.config/opencode/opencode.json` mcp → `openCodeGlobalConfigFiles(env, homedir())`(`adapters/opencode/v1/global-plugins.ts:6`) → 어댑터가 MCP 연결 요청 추가 → fake 서버 요청 목록 불일치.
- 문제 경로 ③: 호스트 `commit.gpgsign=true` → 테스트 `git commit` 실패.
- 문제 경로 ④: 포크 `GATE_AUTH_DEFINITIONS` → `bootstrap.ts:435` `auth.tryBind` → stub에 없음.

```text
vitest run → vitest.config.ts(testTimeout 20s) → worker(실제 HOME/env 상속)
  → 테스트 → production reader(homedir()/process.env) → 호스트 설정 유입
  → vi.waitFor(기본 1s) / 파일 리터럴 예산 / CI 30분
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`, `AR-03`
- 변경 후 책임 소유자: 배율 = `app/scripts/test-time.mjs`(SSOT) · 격리 = `app/scripts/test-host.mjs`(순수) + `app/scripts/vitest-setup.mjs`(적용) · 강제 = `check-test-budgets.mjs` (F)(G)(H).

```text
vitest run
  → vitest.config.ts: import test-time.mjs(ORCA_TEST_TIME_SCALE 해석, 잘못되면 throw)
       testTimeout = hookTimeout = scaleMs(20_000) · setupFiles: [scripts/vitest-setup.mjs]
  → 파일마다 vitest-setup.mjs:
       루트 = mkdtemp(tmpdir, 'orca-test-host-') · env = hermeticTestEnv(process.env, 루트, platform)
       → process.env 갱신(지움·바꿈) · vi.waitFor = 배율 wrapper(1회) · afterAll(루트 정리)
  → 테스트: vi.setConfig(scaledBudget({…})) · it(…, scaleMs(N)) · 마감 scaleMs(N)
       production reader → 임시 HOME/XDG(빈) · git 자식 → 빈 전역 설정
CI: timeout-minutes = fromJSON(vars.* || 기본) · env ORCA_TEST_TIME_SCALE = vars.ORCA_TEST_TIME_SCALE
게이트(CI 'Test budget guard'): (A)~(E) 기존 + (F) 배율 경유 + (G) 픽스처 상한 > 최대 예산 + (H) 마감 허용 목록
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 예산 숫자가 config·vitest 기본·파일 리터럴에 흩어짐 | `test-time.mjs` 한 곳 + 각 자리는 기준값만 | D-001·D-002 | AR-01 / VP-01·07 · §11 |
| data/control flow | worker가 호스트 env 상속 | setup이 파일마다 격리 env로 교체 | D-005·D-006 | AR-02 / VP-03·08 |
| state/contract | 배포 기본값 고정 단언 8개 + 기본 조립 의존 5개 | 고정 단언 삭제, fixture·helper 명시 | D-007 | R-04 / VP-04 |
| error/lifecycle | 임시 루트 없음 | 파일 종료 시 루트 정리(실패 무시) · 잘못된 배율은 시작 실패 | D-002 | SD-01 / VP-06 |
| test seam/관측점 | 예산 위반을 잡는 장치 = 실-git 게이트 A~E | + F·G·H · `--report` · 배선 테스트 · 시스템 테스트 | 회귀 방지 | AR-03 / VP-09 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `scripts/test-time.mjs` | 배율 해석·환산 | env → scale · base → ms · waitFor 옵션 → 환산 옵션 | `vitest.config.ts` · `vitest-setup.mjs` · 테스트 파일 · `temp-repo.testfixture.ts` · 게이트(기준값 상수) |
| `scripts/test-time.d.mts` | TS 호출부 타입 | — | TS 테스트(`tsconfig.test`·`tsconfig.web` 둘 다 `noImplicitAny:false`라 없으면 any — 타입을 위해 둔다) |
| `scripts/test-host.mjs` | 격리 env 계산(순수) | `{ env, root, platform }` → `{ set, remove }` | `vitest-setup.mjs` |
| `scripts/vitest-setup.mjs` | 적용(I/O)·waitFor 설치·정리 | — | vitest `setupFiles` |
| `scripts/check-test-budgets.mjs` | 예산 형태 강제 | 테스트 소스 → 위반 목록 / `--report` | CI·`npm test`(node --test) |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-01 / VP-01 EP-01 | 전역 케이스·훅 = `scaleMs(20_000)` | `test-time.mjs` `BASE_CASE_MS`·`BASE_HOOK_MS` | config | 2자리: `app/vitest.config.ts` `testTimeout` · `hookTimeout` | `rg -n "testTimeout\|hookTimeout" app/vitest.config.ts` → TO-BE 2 | 느린 러너에서 일반 케이스·훅 초과 |
| AR-01 / VP-01 EP-02 | `vi.waitFor` 무옵션 `5_000×s`, 명시 `t×s`, 숫자 `t×s`, `interval` 보존 | `test-time.mjs` `scaledWaitForOptions` | setup | 1자리: `app/scripts/vitest-setup.mjs` wrapper 설치 — 호출 172곳(51파일)은 전부 `vi.waitFor` 경유 | `rg -n "vi\.waitFor\s*=" app/scripts` → 1 · `rg -c "vi\.waitFor\(" app/src -g '*.test.ts'` → 172/51(변화 0) | §8 S1·S2 실패 재발 |
| AR-01 / VP-01·09 EP-03 | 파일 예산 = `vi.setConfig(scaledBudget({기준값}))` · 기준값 = 현재 리터럴 | 각 파일 + `scaledBudget` | 테스트 작성자 · 게이트 (F) | 20자리: `app/artifact-sdk-live:26` · `chat-turn/opencode-continuation:54` · `chat-turn/prepare-progress:33` · `git-execution:16` · `legacy-paths:34` · `managed-mcp-document-contract:8` · `managed-mcp.cli.integration:23` · `worktrees/ipc-integration:30` · `worktrees/reject-reasons:23` · `worktrees/safe-delete:27` · `worktrees/service:21` · `git/git-cli:30` · `git/git-consistency:11` · `git/git-diff-commit:14` · `git/git-diff:41` · `git/git-safety:13` · `git/git-snapshot:11` · `git/probe:9` · `git/queue-entry:22` · `git/repository:13` (경로 접두사 `app/src/main/`) | `node evidence/scan-test-budgets.mjs app` `setConfig` → 20 · TO-BE `node scripts/check-test-budgets.mjs --report` `setConfig` 20 = 목록(차집합 0) | 리터럴로 남은 파일은 배율 무시 |
| AR-01 / VP-01·09 EP-04 | 케이스 인라인 타임아웃 = `scaleMs(기준값)` | 각 자리 | 게이트 (F) | 6자리: `adapters/opencode/v1/adapter.persistent:321`(10_000) · `discovery-cache.hold-race:45`(10000) · `:60`(10000) · `app/handlers/session-resources.claude-assembly:127`(20000) · `app/harnesses/opencode/native-storage.integration:68`(330000) · `infra/config/file-mutation:250`(45_000) | 같은 스캔 `case` → 6 · `--report` `case` | 인라인이 전역(60s)보다 작게 남아 이김 |
| ~~AR-01 / VP-01·09 EP-05~~ **SUPERSEDED → ΔV1 EP-05a (§7-B)** | 테스트 소유 실시간 마감 = `scaleMs(기준값)` · 의미 대기 = 허용 목록 `{file, value, reason}` | 게이트 `SEMANTIC_DELAYS` | 게이트 (H) | 10자리 — **예산 4**: `app/artifact-sdk-live:71`(90_000 abort) · `app/managed-mcp.cli.integration:322`(60_000 close) · `:420`(10_000 exit) · `infra/config/file-mutation:221`(30_000 준비) / **의미 6**: `adapter.persistent:299`(2700 — production AbortSignal 2.5s를 넘기는 대기) · `session-resources.claude-assembly:106`(1000 — mtime 구분) · `features/plugins/mail/sync-manager:40`(25_000 — fake 타이머 지연 응답 자극) · `adapter.test:343`(5_001)·`:387`(5000 — `vi.setSystemTime`) · `infra/git/git-snapshot:51`(60_000 — 데이터 시각) | 같은 스캔 `deadline`+`setTimeout` → 10 | 의미 대기를 배율하면 production 계약 시험이 바뀐다 · 예산 마감을 안 하면 느린 러너에서 끊김 |
| AR-01 / VP-01 EP-06 | 실-git 픽스처 상수 = `scaleMs(600_000)`·`scaleMs(5_000)`·`retryDelay: scaleMs(200)` · (G) 기준 상한 600_000 > 최대 기준 예산 369_000 | `infra/git/temp-repo.testfixture.ts` | 픽스처 · 게이트 (G) | 3자리: `FIXTURE_GIT_TIMEOUT_MS` · `KILL_GRACE_MS` · `RM_RETRY` | `rg -n "const (FIXTURE_GIT_TIMEOUT_MS\|KILL_GRACE_MS\|RM_RETRY)" app/src/main/infra/git/temp-repo.testfixture.ts` → 3 | 상한이 배율된 파일 예산보다 먼저 끊음 |
| R-02 / VP-02 EP-07 | CI 상한·배율 전달 | 워크플로 | GitHub Actions | 4자리: `ci.yml` `timeout-minutes` · `ci.yml` Test `env.ORCA_TEST_TIME_SCALE` · `release.yml` `timeout-minutes` · `release.yml` Test `env.ORCA_TEST_TIME_SCALE` | `rg -n "timeout-minutes\|ORCA_TEST_TIME_SCALE" .github/workflows` → TO-BE 4 | 작업이 테스트보다 먼저 끊김 · 변수 무시 |
| MD-01 / VP-02·10 EP-08 | 배율 해석: 유한수 ≥1, 미설정·빈 값 = 3 | `test-time.mjs` `resolveTestTimeScale` | config import 시 | 2자리: `resolveTestTimeScale` 본문 · `TEST_TIME_SCALE` 모듈 상수(로드 시 1회 해석) | `rg -n "export (function resolveTestTimeScale\|const TEST_TIME_SCALE)" app/scripts/test-time.mjs` → 2 | 0·음수·NaN 배율로 예산 0/무한 |
| AR-02 / VP-03·08·11 EP-09 | 격리 env | `test-host.mjs` | setup | 15자리 — 적용 1(`vitest-setup.mjs`) · 바꿈 7(`HOME`·`USERPROFILE`·`XDG_CONFIG_HOME`·`XDG_DATA_HOME`·`XDG_CACHE_HOME`·`XDG_STATE_HOME`·win32 `ProgramData`) · 지움 술어 5(`ANTHROPIC_`·`CLAUDE_`·`OPENCODE_`·`GIT_` 접두사·`CLAUDECODE`) · Git 2(`GIT_CONFIG_GLOBAL`·`GIT_CONFIG_NOSYSTEM`) | §8 "호스트 env 키" 검색 → 술어 밖 0 · `rg -n "HOME\|USERPROFILE\|XDG_\|ProgramData\|GIT_CONFIG\|ANTHROPIC_\|CLAUDE\|OPENCODE_\|GIT_" app/scripts/test-host.mjs` → 15 | 호스트 설정이 테스트로 샌다 · 실제 홈 쓰기 |
| R-04 / VP-04 EP-10 | 배포 결합 처리 | 각 테스트 | 구현자 | 13자리 — **삭제 6**: `deployment-wiring.test.ts` 'createPluginBindings 는 기본 배포에서 비어 있다'·'createConnectionSources 는 gate·plugin row 만 만든다'·'augmenter factory 3종은 기본 배포에서 비어 있다'·'createUsageFetcher 는 기본 배포에서 undefined 다…'·'기본 배포는 주입점을 비워 둔다…' · `login-free-deployment.test.ts` '기본 production 배포는 … 비어 있다 (AC15)' / **절 삭제 2**: `mail.integration.test.ts` 'compiles HTTP and POP3 recipes…'의 `createPluginBindings(deps)` `[]` 단언(제목의 "OSS default remains empty" 포함) · `managed-mcp-document-contract.test.ts` 'matches deployment recipes…'의 production `createPluginBindings` `[]`·add/remove 단언 / **fixture 고정 2**: `bootstrap.harness.test.ts` 'start forwards its real settings service…' → `./deployment/gate-auth`·`./deployment/auth-definitions` mock 추가 · `harnesses/opencode/mcp-reconcile.test.ts` 'traces warmup navigation…' → `../../deployment/spawn-env` mock(`SPAWN_ENV_INJECTOR: undefined`) / **helper 전환 3**: `login-free-deployment.test.ts` 'wire %s는 …(AC10)' ×2 → production `createConnectionSources` 대신 `gateRows`+`pluginRows` · `connections.test.ts` '기본 factory는 gate·plugin row만 만든다' → 제목·대상을 `gateRows` 단위로 바꿔 "catalog 입력이 없으면 행에 catalog 키가 없다"를 유지 | `evidence/fork-deployment.py <worktree app>` → 전체 스위트 → `newfails.mjs` → 13 · 삭제 음성: `rg -n "기본 배포에서 비어\|기본 배포에서 undefined\|주입점을 비워\|gate·plugin row만\|gate·plugin row 만\|OSS default remains empty\|비어 있다 \(AC15\)" app/src -g '*.test.ts'` → AS-IS 8줄(삭제 6 + 제목 변경 2: mail·connections) · TO-BE 0 | 포크 CI 실패 |
| R-05 / VP-05 EP-11 | 동적 빈 포트 | 테스트 | 테스트 | 1자리: `infra/loopback-callback.test.ts` `nextPort`/`port()` | `rg -n "nextPort\|45211" app/src -g '*.test.ts'` → AS-IS 2줄 · TO-BE 0 | 다른 프로세스 포트와 충돌 |

- 자리 목록은 그 검색 출력과 차집합 0이어야 한다. verify가 시도해 테스트가 잡지 못한 고장은 목록 안팎 모두 다음 구현이 고친다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).
- 같은 규칙이 여러 레이어에 있다면 SSOT: 배율·기준값은 `test-time.mjs`만 갖는다. 게이트는 `BASE_*`를 import하고 숫자를 다시 적지 않는다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 칸: 없음.
- Git 키의 역할: `GIT_CONFIG_GLOBAL`은 HOME 리다이렉트와 겹치는 이중 방어다. 시스템 설정(`/etc/gitconfig`·`Program Files\Git\etc\gitconfig`)은 `GIT_CONFIG_NOSYSTEM`만 막는다 — 테스트가 시스템 파일을 만들 수 없어 그 자리의 좌표는 UT(AC10)·배선(AC11)까지다.
- 선택적 필드: `vi.waitFor(cb, options)`의 `options` 미지정·숫자·객체(timeout 유/무) 4분기 모두 §AC3. `interval`은 그대로 넘긴다.
- 외부 경계: `vi.waitFor`는 vitest 4.1.10 `test.DNmyFkvJ.js:3359` — `{ interval = 50, timeout = 1e3 }` 기본, 가짜 타이머면 poll마다 `advanceTimersByTime(interval)`. wrapper는 timeout만 바꾸므로 가짜 타이머 의미 불변(시제품 확인: 3s 가짜 타이머 발화).

### 계약 세부

```text
test-time.mjs
  DEFAULT_TEST_TIME_SCALE = 3 · TEST_TIME_SCALE_ENV = 'ORCA_TEST_TIME_SCALE'
  BASE_CASE_MS = 20_000 · BASE_HOOK_MS = 20_000 · BASE_WAIT_FOR_MS = 5_000
  resolveTestTimeScale(env = process.env): number
    raw 미설정·trim()==='' → 3 · Number(raw) 유한 && ≥ 1 → 그 값 · 그 밖 → throw Error(`ORCA_TEST_TIME_SCALE=<raw> — 1 이상의 유한한 수여야 한다`)
  TEST_TIME_SCALE = resolveTestTimeScale()            // import 시 1회
  scaleMs(baseMs, scale = TEST_TIME_SCALE): number  // baseMs 양의 유한수 아니면 throw · Math.ceil(baseMs*scale)
  scaledBudget({ testTimeout?, hookTimeout? }, scale?) → 준 키만 scaleMs
  scaledWaitForOptions(options, scale?) → number n → { timeout: scaleMs(n) } · undefined → { timeout: scaleMs(5_000) }
                                          · 객체 → { ...options, timeout: scaleMs(options.timeout ?? 5_000) }
test-host.mjs
  HERMETIC_REMOVE_PREFIXES = ['ANTHROPIC_','CLAUDE_','OPENCODE_','GIT_'] · HERMETIC_REMOVE_KEYS = ['CLAUDECODE']
  hermeticTestEnv({ env, root, platform }) → { set: Record<string,string>, remove: string[] }
    set: HOME·USERPROFILE = <root>/home · XDG_CONFIG_HOME/DATA/CACHE/STATE = <root>/xdg-{config,data,cache,state}
         platform==='win32' → ProgramData = <root>/programdata
         GIT_CONFIG_GLOBAL = <root>/gitconfig · GIT_CONFIG_NOSYSTEM = '1'
    remove: env 키 중 접두사·정확 키 일치(set 대상은 제외)
vitest-setup.mjs (파일마다)
  root = mkdtempSync(join(tmpdir(), 'orca-test-host-')) · 하위 디렉토리·빈 gitconfig 생성
  globalThis[Symbol.for('orca.test.host')] = { root, originalHome }   // 배선 테스트용
  remove 키 delete · set 키 대입
  vi.waitFor 가 marker(Symbol.for('orca.test.waitFor.scaled')) 없으면 wrapper 설치
  afterAll(() => rmSync(root, { recursive, force, maxRetries: 3 }) — 실패는 삼킨다(임시 폴더 잔여만 남음)
check-test-budgets.mjs
  (B) parseBudget: `vi.setConfig(scaledBudget({ … }))` 의 기준값을 읽는다(리터럴 직접 형태는 (F) 위반)
  (F) 모든 *.test.ts: vi.setConfig 인자 = scaledBudget(객체) · it/test/describe/bench/suite·before*/after* 타임아웃 인자 = scaleMs(…) — TypeScript AST
  (G) 실-git 스위트 기준 예산 최대값 < temp-repo.testfixture.ts 의 FIXTURE_GIT_TIMEOUT_MS 기준값
  (H) 테스트 본문 setTimeout(_, 리터럴 ≥1000) · Date.now()/performance.now() + 리터럴 → scaleMs 경유 또는 SEMANTIC_DELAYS {file, value, reason}
  --report: 종류·파일:줄·형태 목록 출력(분모 대조용)
```

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/scripts/test-time.mjs`·`.d.mts` (신규) | 배율 SSOT | §10 계약 세부 | `scripts/test-time.test.mjs`(순수 + config import + 워크플로 텍스트) |
| `app/scripts/test-host.mjs` (신규) | 격리 env 순수 계산 | §10 | `scripts/test-host.test.mjs` |
| `app/scripts/vitest-setup.mjs` (신규) | 적용·waitFor·정리 | §10 | `src/main/infra/test-environment.test.ts` |
| `app/vitest.config.ts` | 예산·setup 배선 | `testTimeout`·`hookTimeout` = `scaleMs(BASE_*)`, `setupFiles`, 주석 갱신(배율·격리 근거) | AC1·AC2 |
| `app/src/main/infra/test-environment.test.ts` (신규) | 배선 단언 | AC1·AC3(1.5s 넘게 재시도)·AC11·파일별 루트·자식 env 상속(`process.execPath -e`로 `HOME` 출력) | — |
| `app/src/main/infra/test-environment.hostile.test.ts` (신규) | 시스템 테스트 | 합성 HOME/env 구성 → `execFile(process.execPath, [vitest.mjs, 'run', …9파일, '--reporter=dot'], { cwd: app, env })` → exit 0 · 사후 HOME 트리 동일. 자식 env에서 XDG·`GIT_CONFIG_GLOBAL`·`GIT_CONFIG_NOSYSTEM`은 지우고 `GIT_CONFIG_SYSTEM`=서명 강제 파일을 둬 "격리 없으면 새는" 조건을 만든다. 예산 `scaledBudget({ testTimeout: 180_000 })` | 대표 9파일: `adapters/claude/adapter.context-policy` · `adapters/claude/workspace-guard` · `app/handlers/engine.import` · `app/bootstrap.opencode-warmup` · `app/chat-turn/opencode-runtime` · `app/managed-mcp-lifecycle` · `app/bootstrap.native-history` · `infra/git/repository` · `features/plugins/confluence/connector` (리눅스·Windows 기준선 실패 없는 파일) |
| `app/scripts/check-test-budgets.mjs`·`.test.mjs` | 게이트 F·G·H·report | §10 · 기존 A~E fixture를 scaled 형태로 갱신 | node 테스트 |
| EP-03 20파일 | 파일 예산 | `vi.setConfig(scaledBudget({ 기존 값 }))` + import. 도출식 주석은 기준값 설명으로 유지하고 "실효 = × 배율" 한 줄 | 게이트 F |
| EP-04 5파일 6자리 | 인라인 | `scaleMs(기존 값)` | 게이트 F |
| EP-05 4자리 | 마감 | `scaleMs(기존 값)` · 의미 6자리는 게이트 허용 목록에 사유와 등록 | 게이트 H |
| `infra/git/temp-repo.testfixture.ts` | 픽스처 상수 | EP-06 3자리 `scaleMs` | 게이트 G + 상수 vitest 단언 |
| EP-10 7파일 | 배포 결합 | §10 처분 그대로 | 포크 모사 |
| `infra/loopback-callback.test.ts` | 동적 포트 | `net.createServer().listen(0,'127.0.0.1')`로 받은 포트를 닫고 사용 · 같은 포트 재바인딩 단언 유지 | 파일 green |
| `features/worktrees/service.test.ts:245` | 브랜치 이름 | 저장소 생성 직후 `git symbolic-ref --short HEAD`(픽스처 `execGit`)로 읽은 이름과 비교 | AC14 |
| `.github/workflows/ci.yml`·`release.yml` | CI 상한·배율 | `timeout-minutes: ${{ fromJSON(vars.ORCA_CI_TIMEOUT_MINUTES \|\| '90') }}`(release: `ORCA_RELEASE_TIMEOUT_MINUTES`·`'135'`) · Test 단계 `env: ORCA_TEST_TIME_SCALE: ${{ vars.ORCA_TEST_TIME_SCALE }}` | AC9 |
| `app/AGENTS.md` · `docs/guides/release-operations.md` | 문서 | 예산 작성 규칙(`scaledBudget`·`scaleMs`·리터럴 금지·의미 대기 등록) · 격리(테스트는 실제 HOME/env를 보지 않는다, 호스트 의존 시험은 env를 명시 주입) · 게이트 F~H · 저장소 변수 3종 | AC19 |

### 테스트 가능성

- 순수부(`test-time.mjs`·`test-host.mjs`)는 Node 내장만 쓰는 별도 파일 — `node --test`로 vitest 없이 돈다.
- config import 테스트는 Node 22.18+ 타입 제거로 `vitest.config.ts`를 직접 import한다(시제품: Node 22.23.4 `node x.ts` 동작). 배율 변경 확인은 `?scale=N` 쿼리로 모듈 캐시를 피한 동적 import + `process.env` 설정, 또는 `execFile(process.execPath, ['-e', …])` 자식으로 한다.
- 순서 관측: 해당 없음.

## 12. End-to-end 영향

```text
ORCA_TEST_TIME_SCALE / vars → test-time.mjs → config·setup·픽스처·테스트 → 실효 예산
호스트 env → vitest-setup(격리) → process.env → homedir()/XDG/git 자식 → production reader
```

- producer 기준: 배율은 `test-time.mjs`만 계산한다. 소비자는 기준값만 들고 다시 곱하지 않는다(이중 배율 금지 — `vi.waitFor` 옵션에 `scaleMs`를 쓰지 않는다, wrapper가 곱한다).
- 파생 합성값이 정본을 우회하지 않는가: 게이트 (F)(H)가 리터럴 예산을 막는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 변경 영향 | 회귀 AC |
|---|---|---|
| 모든 테스트 파일(925) | setup 추가 — 파일당 mkdtemp 1회 | AC16 |
| 호스트 env를 일부러 주입하는 테스트(`vi.stubEnv`·명시 env 객체) | 영향 없음 — 주입값이 이긴다 | AC16 |
| opt-in 실기(`ORCA_TEST_OPENCODE_EXE`·`ORCA_ARTIFACT_LIVE`) | `ORCA_*` 보존 · 자식 HOME은 테스트가 직접 지정 | AC10 |
| 실-git 스위트 16 | 빈 전역 git 설정 · 저장소별 `user.*`는 이미 로컬 설정(`service.test.ts:33-34` 등) | AC12·AC16 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: config 로드 시 배율 해석(잘못되면 vitest 즉시 실패). 파일 시작 시 setup.
- 종료: `afterAll`이 루트를 지운다. Windows EBUSY 등 실패는 삼킨다 — 남는 것은 OS 임시 폴더의 `orca-test-host-*`뿐이고 실제 홈은 쓰이지 않았다.
- timeout: 모든 예산은 유한(배율 유한수) — 멈춤은 계속 실패로 보고된다.
- **다중 저장소 쓰기**: 해당 없음(제품 저장소 없음). 문서 사본: 판정은 `plan.md`와 `INDEX.md` 두 곳 — 둘 다 이번 설계 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- 케이스 상한: 정상 케이스 시간은 불변. 멈춘 케이스 하나가 보고되기까지 20s → 60s.
- 최악: 리눅스 기준 전체 2m16s · 저성능 모사 6m47s — 실효 케이스 상한 60s를 넘은 케이스 0(최장 26.6s).
- CI: 작업 13m43s × 3 ≈ 41분 < 90분.
- setup 비용: 파일당 mkdtemp·mkdir 6·writeFile 1 — 시제품 전체 실행 시간 차이 측정 범위 안(합성 호스트 3워커 실행 정상 종료).
- 시스템 테스트 비용: 자식 vitest 9파일 — 리눅스 수십 초, Windows 직렬은 더 길다 → 예산 `scaledBudget({ testTimeout: 180_000 })`.

## 15. 외부 구현 포트 / 문서 계약

- 외부(운영자)가 설정하는 값: 저장소 Variables `ORCA_TEST_TIME_SCALE`·`ORCA_CI_TIMEOUT_MINUTES`·`ORCA_RELEASE_TIMEOUT_MINUTES`.
- 구현 문서: `docs/guides/release-operations.md` 트러블슈팅에 "느린 러너" 행.
- shape 검증: 워크플로 텍스트 테스트(AC9) + Windows CI 파싱.
- semantics 검증: AC4(잘못된 값 시작 실패).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0248 D-011 · AT-06/AC15 "기본 배포 `[]` 유지 … 가상 배포 테스트로 검증" | `docs/handoff/0248-login-free-plugin-auth/plan.md:61,155` | §10 EP-10 삭제 6 | **변경(테스트 고정만)** — 사용자 D-007. OSS 기본값이 빈 배열인 코드·`docs/arch/backend/auth.md:130` 서술은 유지 |
| 0237 D-030 "기본 OSS 배포의 Auth/Plugin 배열은 계속 비어 있다" | `docs/guides/closed-network-extensions.md:1027` | 같음 | 유지(서술) · 테스트 고정만 삭제 |
| 0207 "기본 배포는 주입점을 비워 둔다" 테스트 | `deployment-wiring.test.ts:673` | EP-10 | 변경(삭제) — D-007 |
| 0218 실-git 예산 규칙 (A)~(E) | `scripts/check-test-budgets.mjs:14-31` | §10 EP-03·EP-06 | 유지 + (F)(G)(H) 추가 — D-009 |
| 0211 ΔV5 "케이스 예산 20초" | `vitest.config.ts:13-26` | EP-01 | 변경 — 기준값 20s 유지, 실효 ×배율(D-003) |
| `app/AGENTS.md` "`npm test` 는 DB 동작을 실제로 봐야 할 때만" | `app/AGENTS.md` ABI 가이드 | §7-A gate | 유지 |
| 가이드 "동작 확인의 살아 있는 예제는 deployment-wiring.test.ts" | `closed-network-extensions.md:99` | EP-10 | 유지 — 가상 배포 테스트는 남고 기본값 고정 블록만 삭제 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| Windows에서 `ProgramData`·`USERPROFILE` 변경이 자식(git·pwsh)에 부작용 | Windows CI가 oracle(AC9). 실패하면 그 키만 PLAN_GAP으로 올린다 |
| `vi.waitFor` monkeypatch가 vitest 업그레이드에 깨짐 | marker 단언(AC3 배선)이 즉시 red — 업그레이드 PR에서 드러난다 |
| 멈춘 테스트 보고 지연(3배) | 사용자 결정 D-001의 대가. 예산은 유한 |
| 시스템 테스트 대표 파일이 나중에 호스트 독립화되면 민감도 상실 | AC 주의사항 — 대표 교체. 변이 M-A로 확인 |
| 의미 대기 허용 목록이 새 예산 마감의 우회로가 됨 | 허용 목록 항목마다 사유 필수 · verify가 사유를 검토 |

- 되돌리기 어려운 결정: 없음(테스트 인프라). 변수 이름 3종은 운영자 설정이라 바꾸면 안내 필요.
- 신규 의존성: 없음(`typescript` 기존 devDependency `^5.9.3`).

## 18. 영향 받는 파일 / 문서

- `app/vitest.config.ts` · `app/scripts/{test-time.mjs,test-time.d.mts,test-time.test.mjs,test-host.mjs,test-host.test.mjs,vitest-setup.mjs,check-test-budgets.mjs,check-test-budgets.test.mjs}`
- `app/src/main/infra/{test-environment.test.ts,test-environment.hostile.test.ts}` (신규)
- §10 EP-03(20)·EP-04(5파일)·EP-05(3파일)·EP-06(1)·EP-10(7)·EP-11(1) 파일 · `features/worktrees/service.test.ts`
- `.github/workflows/{ci.yml,release.yml}` · `app/AGENTS.md` · `docs/guides/release-operations.md`
- **ΔV1**: `app/scripts/check-test-budgets{,.test}.mjs` · 새 예산 18자리 10파일 · `app/AGENTS.md` — 정본은 §7-B "ΔV1 구현 설계"
- **ΔV2**: `app/scripts/check-test-budgets{,.test}.mjs` · `app/AGENTS.md`(테스트 소스 변경 0) — 정본은 §7-C "ΔV2 구현 설계"

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 환경 제약: 리눅스 컨테이너는 기준선 22건(D-011)을 분리 보고한다. Electron 바이너리가 없으면 `node node_modules/electron/install.js`(이번 설계 세션에서 다운로드 가능 확인).
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run` 전체(인프라 변경이라 전수) · `node --test "scripts/*.test.mjs"` · `node scripts/check-test-budgets.mjs` · `node scripts/check-doc-inventory.mjs --check`.
- 적대 측정(verify 재실행): `evidence/clean-host-run.sh` · `hostile-host-run.sh` · `slow-runner-run.sh … 8` · `fork-deployment.py`(작업 트리 사본) + `newfails.mjs`.
- 사람 실기: AC18.

## READY self-review

- [x] Decision Ledger가 질의 5건의 결정을 보존한다 — D-001~D-011.
- [x] Part I만으로 완료 상태가 설명된다 — §1 표·§5 전이표.
- [x] 조건절 원문 인용 — §2 사용자 문장 원문, "Git 인프라는 유지"·"실-git도 배율 적용"을 D-009·D-001로 함께 보존.
- [x] 사용자 결정과 조사 사실 구분 — §4.
- [x] 수치 실측 — §8 전 수치 이번 세션 측정, 검산 §8 끝.
- [x] 저장소 규칙 입력 — 게이트 A~E·ABI 가이드·doc inventory·`noImplicitAny:false` 선례(`statusLine.render.test.ts:27`).
- [x] AC마다 행동 단언·검증·경로 — §7.
- [x] Baseline V · 모든 NEW node에 REQUIRED pair — VP-01~11.
- [x] pair마다 경로·§10 분모·좌표·적대 증거 — §7-A·§10.
- [x] 운영 gate 열거 — §7-A.
- [x] 사람 실기는 외부환경 1건(AC18)뿐.
- [x] structural proxy만으로 semantic 목표를 닫지 않는다 — 게이트(F·G·H)는 형태, 행동은 AC1~AC3·AC12·AC16 모사 실행.
- [x] "X가 쓰인다" 장치가 X를 지우면 red — M1~M10·M-A~M-D.
- [x] 정책 파라미터 단위·범위 — 배율 유한수 ≥1, ms 정수(`Math.ceil`).
- [x] 신규 모듈의 레이어·강제·seam — §9 책임 표·§11.
- [x] producer/consumer — §12(이중 배율 금지).
- [x] worst-case — §14.
- [x] `ACTIVE 결정 ↔ AC` 대조 — §3 갱신 메모.
- [x] 문장 규칙 — 판정 먼저·표 위주.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: §10 계약 세부 그대로 — `test-time.mjs`·`test-host.mjs`·`vitest-setup.mjs`·게이트 (F)(G)(H)·`--report`.
- 이견 / 현실성 문제: AC12 Git 변이 M-C(`GIT_CONFIG_GLOBAL` 미설정)는 HOME 리다이렉트와 겹쳐 민감도 0이었다 — 시스템 테스트 입력에 `GIT_CONFIG_COUNT`·`KEY_n`·`VALUE_n`(env 주입 설정, `GIT_` 지움만 막음)을 더해 M-C를 `GIT_` 지움 제거로 심었다(아래 차이).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 EP-01 | 전역 케이스·훅 | 2 | 2/2 | `rg -n "testTimeout\|hookTimeout" app/vitest.config.ts` → 2 · `scripts/test-time.test.mjs`'케이스·훅 예산 = 20_000 × 배율' · `test-environment.test.ts`'케이스 예산은 기준값 × 배율이다' | 배율 미설정·1·5 → 60_000·20_000·100_000(t·h 각각) | — |
| VP-01 EP-02 | `vi.waitFor` 배율 | 1 | 1/1 | `rg -n "vi\.waitFor\s*=" app/scripts` → 1 · `test-time.test.mjs`'waitFor 옵션 네 갈래' · `test-environment.test.ts`'무옵션 vi.waitFor 는 … 1초를 넘겨' | 미지정·숫자 4000·객체(timeout 2000+interval 10)·객체(interval만) → 15_000·12_000·6_000(+10)·10_000(배율 2) | 호출 173/52 = 기존 172/51 + 신규 배선 테스트 1 |
| VP-01·09 EP-03 | `vi.setConfig(scaledBudget)` | 20 | 20/20 | `node scripts/check-test-budgets.mjs --report` setConfig 21 − §10 목록 20 = 차집합 `{infra/test-environment.hostile}`(신규·scaled) · gate (F) `check-test-budgets.test.mjs`'리터럴 vi.setConfig 는 걸리고…' | 기준값 = 기존 리터럴 그대로(diff) | — |
| VP-01·09 EP-04 | 케이스 인라인 `scaleMs` | 6 | 6/6 | `--report` case 6 scaled · gate (F)'케이스 셋째 인자 리터럴은 걸리고…' | it·it.each·it.skipIf 형태 각각 | — |
| VP-01·09 EP-05 | 마감 4 scaled + 의미 6 | 10 | 10/10 | `--report` deadline 4 scaled · 6 semantic · gate (H) 3케이스 | 의미 대기: 파일·값 둘 다 맞아야 통과(다른 파일 같은 값 red) | — |
| VP-01 EP-06 | 픽스처 상수 | 3 | 3/3 | `rg -n "const (FIXTURE_GIT_TIMEOUT_MS\|KILL_GRACE_MS\|RM_RETRY)"` → 3 · `test-time.test.mjs`'상한·kill 유예·rm 재시도 간격이 기준값 × 배율이다' · gate (G) | 600_000·5_000·200 각각(서로 다른 기준값) | — |
| VP-02 EP-07 | CI 상한·배율 전달 | 4 | 4/4 | `rg -n "^\s+timeout-minutes\|^\s+ORCA_TEST_TIME_SCALE:" .github/workflows` → 4 · `test-time.test.mjs`'작업 상한은…'·'두 Test 단계가…' · Windows CI 실행은 push 뒤(검증자 확인) | ci 90 / release 135 서로 다른 기본값 | Windows CI 실행 결과 |
| VP-02·10 EP-08 | 배율 해석 | 2 | 2/2 | `rg -n "export (function resolveTestTimeScale\|const TEST_TIME_SCALE)\b"` → 2 · `test-time.test.mjs`'배율 해석' 3케이스 · '잘못된 배율이면 config 로드가 실패한다' · 'vitest 자체가 비정상 종료한다' | ''·공백·1·1.5·5·0·0.99·-1·abc·Infinity·NaN | — |
| VP-03·08·11 EP-09 | 격리 env | 15 | 15/15 | `test-host.test.mjs` 5케이스 · `test-environment.test.ts` 격리 4케이스 · `test-environment.hostile.test.ts` | 지움 9키·보존 7키 표본 · win32/linux 분기 · 바꾸는 GIT_ 키 비지움 | 시스템 git 설정 파일 실물은 UT·배선까지(plan §10 Git 메모) |
| VP-04 EP-10 | 배포 결합 | 13 | 13/13 | 음성 `rg … -g '*.test.ts'` → 0 · 포크 모사(`fork-deployment.py` → 전체 스위트) 기준 대비 +0 · 각 파일 green | 포크 id `acme-*`(fixture 와 겹치지 않음) | — |
| VP-05 EP-11 | 동적 빈 포트 | 1 | 1/1 | `rg -n "nextPort\|45211" app/src -g '*.test.ts'` → 0 · `loopback-callback.test.ts` 전 케이스 green | 같은 포트 재바인딩 단언 유지 | — |

- §10 자리 목록 밖에서 본 운반 자리: `bootstrap.harness.test.ts`의 `spawn-env` mock도 더했다(필수 아님 — 포크 spawn env 가 그 테스트 경로에 닿지 않게 한 방어). 목록 밖 리터럴 예산 0(`--report` LITERAL 0줄).
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(최초).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | 위 EP-01~06 행 | M1~M6 RED |
| VP-02 | REQUIRED | SELF_PASS | 위 EP-07·08 행 (Windows CI 대기) | M7·M8 RED |
| VP-03 | REQUIRED | SELF_PASS | `test-environment.hostile.test.ts`'합성 사내 호스트에서…' | M-A·M-B·M-C·M-D RED |
| VP-04 | REQUIRED | SELF_PASS | 포크 모사 +0 · 음성 검색 0 | M9 RED(2자리) |
| VP-05 | REQUIRED | SELF_PASS | `loopback-callback.test.ts` 7케이스 | not selected |
| VP-06 | REQUIRED | SELF_PASS | `test-environment.test.ts`'홈은 이 파일의 임시 루트…'·'자식 프로세스도 격리된 홈을 받는다' | not selected |
| VP-07 | REQUIRED | SELF_PASS | VP-01 좌표 | M1~M6 |
| VP-08 | REQUIRED | SELF_PASS | VP-03·AC11 좌표 | M-A~M-D |
| VP-09 | REQUIRED | SELF_PASS | `check-test-budgets.test.mjs` 38→신규 포함 전 케이스 · `gate:node scripts/check-test-budgets.mjs` | M3~M6 |
| VP-10 | REQUIRED | SELF_PASS | `test-time.test.mjs` | M7 |
| VP-11 | REQUIRED | SELF_PASS | `test-host.test.mjs` | M10 RED |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 `vitest.config.ts` hookTimeout 제거 | VP-01 선택 증거 | 최초 | `test-time.test.mjs` config 예산 | 잠김 |
| M2 `scaledWaitForOptions` 객체 timeout 비배율 | VP-01 | 최초 | waitFor 옵션 네 갈래 | 잠김 |
| M3 `repository.test.ts:13` 리터럴 setConfig | VP-01 | 최초 | gate exit 1 | 잠김 |
| M4 `file-mutation.test.ts` 인라인 45_000 리터럴 | VP-01 | 최초 | gate exit 1 | 잠김 |
| M5 `file-mutation.test.ts` `Date.now()+30_000` | VP-01 | 최초 | gate exit 1 | 잠김 |
| M6 픽스처 기준 600_000→300_000 | VP-01 | 최초 | gate (G) exit 1 | 잠김 |
| M7 하한 `< 1` → `<= 0` | VP-02 | 최초 | 배율 해석 '0.99' | 잠김 |
| M8 `ci.yml` 기본 90→30 | VP-02 | 최초 | 워크플로 상한 | 잠김 |
| M9a 포크에서 `mcp-reconcile` spawn-env mock 제거 | VP-04 | 최초 | 1 failed / 7 | 잠김 |
| M9b 포크에서 AC10 을 `createConnectionSources` 로 복귀 | VP-04 | 최초 | 2 failed / 10 | 잠김 |
| M10 지움 접두사에 `ORCA_` 추가 | VP-11 | 최초 | `test-host.test.mjs` | 잠김 |
| M-A `setupFiles: []` | VP-03 | 최초 | 시스템 테스트 1 failed | 잠김 |
| M-B 지움 접두사 `OPENCODE_` 제거 | VP-03 | 최초 | 시스템 테스트 1 failed | 잠김 |
| M-C 지움 접두사 `GIT_` 제거 | VP-03 | 최초 | 첫 시도 green(입력이 NOSYSTEM 에 막힘) → 입력에 `GIT_CONFIG_COUNT` 추가 후 1 failed | 잠김 |
| M-D HOME·USERPROFILE 리다이렉트 제거 | VP-03 | 최초 | 시스템 테스트 1 failed | 잠김 |
| EP-06 `KILL_GRACE_MS`·`RM_RETRY` 리터럴 복귀 | 새 oracle 민감도 | 최초 | `test-time.test.mjs` 픽스처 상수 | 잠김(2/2) |

- **분모 검산**: 선택 증거 16(M1~M8·M9a·M9b·M10·M-A~M-D) · 인용 변이 0 · 새 oracle 1(EP-06 상수 2 변이) = 표 행 17.
- **덮개 회귀**: 해당 없음(최초). 기존 (A)~(E) 게이트 케이스는 fixture 문자열만 scaled 형태로 바꿔 전부 통과(`check-test-budgets.test.mjs` 38/38).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 운영자 대면 3종 — 배율 오류 메시지(vitest 시작 실패 stderr), 게이트 위반 문구(CI 로그), 가이드 트러블슈팅 행 | 소비자 = CI 로그·`docs/guides/release-operations.md` |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 잘못된 배율 → §5 3행 · 멈춤 → 4행 · 정리 실패 → §13(삼킴) | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 잘못된 배율은 exit≠0 + 변수명·값 메시지(`test-time.test.mjs` 확인) | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 포크가 `auth-definitions.ts`에 상수를 더하면 그것을 참조하는 `gate-auth.ts` 원본이 mock 된 모듈에서 export 를 못 찾아 부팅 테스트가 suite 오류 | ✅ 선조치 — `bootstrap.harness.test.ts`의 mock 을 원본 spread + 배열만 덮기로 | 포크 모사 1차 실행 `<suite>` 실패 → 수정 후 +0 |
| 2 | 바깥 실행이 색을 켜면 자식 vitest 출력에 ANSI 코드가 섞여 시스템 테스트 정규식이 빗나감 | ✅ 선조치 — 비교 전 ANSI 제거(`no-control-regex` 회피로 `String.fromCharCode(27)`) | 전체 실행에서만 실패 → `FORCE_COLOR=1` 단독 재현·수정 |
| 3 | `GIT_CONFIG_NOSYSTEM`이 `GIT_CONFIG_SYSTEM` 주입도 무력화해 `GIT_` 지움 변이에 민감도가 없었다 | ✅ 선조치 — 시스템 테스트 입력에 env 주입 설정(`GIT_CONFIG_COUNT`) 추가 | M-C 첫 시도 green → 수정 후 red |
| 4 | 실-git 픽스처 상수 2개가 비공개라 좌표가 없었다 | ✅ 선조치 — export 후 node 테스트(Node 22.18+ 타입 제거 import) | EP-06 변이 2건 red |

### 설계 대비 명시적 차이

- 시스템 테스트 입력에 `GIT_CONFIG_COUNT`·`KEY_n`·`VALUE_n` 추가(위 3) — plan §11 행의 `GIT_CONFIG_SYSTEM`은 유지.
- `KILL_GRACE_MS`·`RM_RETRY`를 export(위 4) — 소비 범위는 테스트뿐.
- `bootstrap.harness.test.ts`는 plan의 `gate-auth`·`auth-definitions` mock 에 더해 `spawn-env` mock 도 둔다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 시간 캐시 없음 | — |
| 공유 | 해당 없음 — export 상수는 불변값 | EP-06 테스트 |
| 재진입 | setup 이 파일마다 재실행돼도 `originalHome`은 첫 기록을 유지 | AC11 '홈은 … 다르다' green |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `app/scripts/{test-time.mjs,test-time.d.mts,test-time.test.mjs,test-host.mjs,test-host.test.mjs,vitest-setup.mjs}` · `app/src/main/infra/{test-environment.test.ts,test-environment.hostile.test.ts}` · 수정 `app/vitest.config.ts` · `app/scripts/check-test-budgets{,.test}.mjs` · EP-03~06·10·11 테스트 파일 · `features/worktrees/service.test.ts` · `.github/workflows/{ci,release}.yml` · `app/AGENTS.md` · `docs/guides/release-operations.md` · evidence 스크립트 2개(경로 해석·`VITEST_PREFIX`) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `evidence/clean-host-run.sh` · `hostile-host-run.sh` · `slow-runner-run.sh … 8` · 포크 모사 · `node --test "scripts/*.test.mjs"` · `node scripts/check-test-budgets.mjs` · `check-doc-inventory --check` · `check-migrations-appendonly` |
| **관측한 게이트 산출**(마지막 수정 뒤) | lint 0 error · 2 warning(변경 밖 `Timeline.tsx`·`useTranscriptVirtualizer.ts`) · typecheck exit 0 · vitest 915파일 8,447케이스: 통과 8,416 · 실패 22 · skip 9 — 실패 22 = 기준선 집합과 차집합 0(Windows 경로·Claude 플러그인 Linux) · node 171/171 · test-budgets ok · doc-inventory ok · migrations ok. 최종 수정(EP-06 export) 뒤 vitest는 영향 범위 76파일 572케이스 재실행 green |
| 적대 측정 | 합성 사내 호스트 +0 · HOME 새 파일 0 / 저성능 모사(1코어·8워커, 6m25s) +0 / 포크 모사 +0 — 모두 구현 트리 기준선 대비 |
| V-pair 자기확인 | `SELF_PASS 11 / SELF_BLOCKED 0` |
| 강제 지점 전수 | 77/77 (2+1+20+6+10+3+4+2+15+13+1) |
| **AC 자기보고**(`Criteria-Met`) | AC1~AC17 ✅(위 좌표) · AC19 ✅(문서 diff + doc-inventory ok) · AC9 의 Windows CI 실행과 AC18 사람 실기 ⚠️ |
| **합계 검산** | `✅ 17 · ⚠️ 2(AC9 Windows CI 대기·AC18 사람 실기) · ❌ 0 = 총 19` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] 구현 보고 (r1.2 — Windows CI red 수정)

| 항목 | 내용 |
|---|---|
| 계기 | Windows CI run 41745171529(r1 push) — `features/chat/attachments.test.ts` 12건 red, 그 밖 911파일 green(8,432 통과) |
| 원인 | windows 러너 `tmpdir()`가 8.3 짧은 이름(`C:\Users\RUNNER~1\…`)이라 setup 이 그 아래에 만든 홈도 짧은 이름이었다. 첨부 검사는 `fs.realpath`(긴 이름) 결과를 `homedir()` 접두사와 비교해 "C: must be inside the user profile directory"로 거부 |
| 수정 | `scripts/vitest-setup.mjs` — 임시 루트를 `realpathSync.native(mkdtemp…)`로 고정(실제 `USERPROFILE`은 긴 이름). 배선 테스트에 '홈은 실경로다' 추가, 루트 포함 비교를 `realpathSync.native(tmpdir())` 기준으로 |
| 재현 · 잠금 | 리눅스에서 `TMPDIR`을 심볼릭 링크로 두면 같은 "표기 ≠ 실경로" — 수정 전 `outside the user home directory` 9건 → 수정 후 0건. 변이(realpath 제거)는 '홈은 실경로다'가 red(링크 TMPDIR). 링크 TMPDIR 의 `unsafe attachment directory` 6건은 링크 고유 검사라 Windows 8.3 과 별개(기준선 동일) |
| **관측한 게이트 산출**(마지막 수정 뒤) | lint 0 error · 2 warning(변경 밖) · typecheck exit 0 · node 171/171 · test-budgets ok · vitest 8,448케이스 실패 22 = 기준선 집합 차집합 0 · HOME 새 파일 0 |
| AC 자기보고 | AC9 ✅ — Windows CI run 41796065410(head `f087d27`) success, 작업 상한 `fromJSON(vars…)` 해석됨. `✅ 18 · ⚠️ 1(AC18 사람 실기) · ❌ 0 = 총 19` |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(최초).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: plan M-C가 HOME 리다이렉트·NOSYSTEM과 겹쳐 민감도 0인 변이였다 — 구현 중 첫 시도 green으로 드러남.
- 반복해서 부딪히는 환경 한계: 리눅스 기준선 22건 · Windows 백신·디스크 지연 모사 불가.
- 현재 라운드·impl 턴: `r1`. 구현자 = 다음 검증자(Claude) — verify 는 보고에 없는 적대 축을 하나 더해야 한다.

## [구현자 기입] 설계 리뷰 (r2 — ΔV1)

- 동의 / 그대로 진행: §7-B ΔV1 구현 설계 그대로 — (H′) 7형태·값 해석·임계·제외·`count`·이중 배율·testfixture 범위, 새 예산 18자리 `scaleMs`, `app/AGENTS.md`.
- 이견 / 현실성 문제: 없음. 판정 코드는 `evidence/scan-deadlines.mjs`의 술어를 게이트로 옮겼다 — 스캔은 독립 검색 명령으로 그대로 두고 `--report`와 차집합으로 대조한다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) — r2

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-07a·09a EP-05a 예산 — 새로 배율 | `scaleMs(기준값)` | 18 | 18/18 | 자리마다 `gate:node scripts/check-test-budgets.mjs` — 리터럴 복귀 M5a-01~18 각각 exit 1 · 위반 1 | 기준값 = 현재 리터럴(diff: `1000`·`300000`·`90000`·`40_000`·`1_000`·`3000`·`10_000`) | — |
| 같음 · 예산 — 이미 배율 | `scaleMs` 유지 | 6 | 6/6 | `--report` deadline `scaled` 24 = 새 18 + 기존 6 · 좌표 = V1 M5(`file-mutation:222` 리터럴 → exit 1) · `artifact-sdk-live:72`·`managed-mcp.cli:323`·`:421`·`temp-repo.testfixture:80`·`file-mutation:231` 은 같은 게이트 형태 판정 | 이번 턴 diff 0 | 개별 리터럴 복귀 변이는 M5 1자리만 심었다(나머지 5는 r1 변경, 이번 턴 미변경) |
| 같음 · 의미 값 | 허용 목록 16항목 `{file, value, count, reason}` | 20 | 20/20 | `--report` deadline `semantic` 20 · 항목 count 합 = 20 · M11a(자리 +1)·M11b(자리 −1) exit 1 | count 1·2·3 항목 각각(broker 3·monitor 2·나머지 1) | — |
| 같음 · 분모 대조 | `--report` ↔ 스캔 | 44 | 44/44 | `--report` deadline 파일:줄 ↔ `node …/evidence/scan-deadlines.mjs app` 파일:줄 `diff` → **0줄**(양쪽 44) | — | — |
| VP-12 EP-12 P1 파일 범위 | test·testfixture.ts·tsx / (A)~(E) test만 | 1 | 1/1 | `check-test-budgets.test.mjs`'P1 — (H′) 는 test·testfixture.ts·testfixture.tsx 를 보고…' | 임시 트리 4파일 → (H′) 위반 3 · `d.ts` 무시 · `listTestFiles` = `a.test.ts`만 | — |
| VP-12 P2 형태 7 | 7형태 하위 분기 | 1 | 1/1 | 같은 파일 'P2 — <형태>' 19케이스 + '라벨 밖 이름' | 분기마다 `5000` → 1 · `scaleMs(5000)` → 0 · `delayMs` → 0 | — |
| VP-12 P3 값 해석 | const·`??`·`\|\|`·산술·import | 1 | 1/1 | 'P3 — 같은 파일 const …' | 위반 5 입력 · 통과 3 입력(`?? scaleMs`·`* scaleMs`·import) | — |
| VP-12 P4 임계 | 1000 · abort·자식 프로세스 무임계 | 1 | 1/1 | 'P4 — 임계 1000ms …' | 999 통과·1000 위반 · abort 10 위반 · 자식 프로세스 7호출 + `cp.execFile` 각 10 위반 · `pool({timeoutMs:10})` 통과 | — |
| VP-12 P5 제외 | waitFor 옵션·matcher·케이스 인자 · `expect(x)`·elapsed는 셈 | 1 | 1/1 | 'P5 — vi.waitFor 옵션·matcher 피연산자…' | 통과 7 입력 · 위반 3 입력 | — |
| VP-12 P6 허용 목록 | count·reason·파일 | 1 | 1/1 | 'P6 — 항목 count 는…' · 'P6 — 대상 파일이 없는 의미 값 항목은 CLI 가 막는다' | 자리 2 통과 · 3·1 위반 · reason `''`·공백 위반 · 파일 `b` 위반 2 · 미등록 값 1 | — |
| VP-12 P7 이중 배율 | waitFor 옵션 안 `scaleMs` | 1 | 1/1 | 'P7 — vi.waitFor 옵션 안의 scaleMs …' | 객체·숫자 둘 다 위반 · 리터럴 옵션·첫 인자 안 `scaleMs` 통과 | — |
| AC19a | `app/AGENTS.md` (H′) 서술 | 1 | 1/1 | `grep -c "(H′)" app/AGENTS.md` → 1 · `count`·`testfixture.ts(x)`·"abort·자식 프로세스 `timeout` 은 임계가 없다" 문구 존재 · doc-inventory `--check` ok | — | — |

- 강제 지점 전수: EP-05a 44(새 18·기존 6·의미 20) + EP-12 7 = **51/51** 이번 턴 대상. V1 EP-01~04·06~11은 이번 턴 diff 0 — NOT_REQUIRED 비영향(§7-B) + VP-13 회귀로 다시 닫음.
- §10 목록 밖에서 본 운반 자리: 0 — `--report`·스캔 차집합 0줄, LITERAL 0줄.
- 직전 verify 고장 이력의 `못 잡음` 행: X7·X8·X9 → 이번 트리에서 X7′·X8′·X9′ 각각 게이트 exit 1(아래 잠금 표).
- `[구현자 기입]` 발견: M14 트리 변이의 위반 수는 **14**(plan 설계 근거 표의 "옵션 리터럴 13자리"보다 1 많다) — 분모 행이 아니라 변이 관측값이라 목록에 영향 없음.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-12 | REQUIRED | SELF_PASS | `check-test-budgets.test.mjs` '규칙 (H′)' 31케이스 | M12·M13·M14·M16·M17·X6 RED |
| VP-09a | REQUIRED | SELF_PASS | `gate:node scripts/check-test-budgets.mjs` exit 0 · `--report` ↔ 스캔 차집합 0 | M3·M4·M6·M11a·M11b·M15·X9′ RED · Windows CI는 push 뒤 |
| VP-07a | REQUIRED | SELF_PASS | 자리별 게이트 좌표(위 표) | M5a-01~18·X7′·X8′·M1·M2·M5 RED |
| VP-01a | REQUIRED | SELF_PASS | AC1~3·5·6·8 = verify r1 §5 좌표 승계(이번 턴 diff 0, `node --test` 199/199) · AC7a·7b = VP-07a·09a·12 | 위 세 pair 변이 |
| VP-13 | REGRESSION | SELF_PASS | `evidence/clean-host-run.sh` 기준·현재 트리 + `slow-runner-run.sh … 8` + `newfails.mjs` | not selected |
| VP-02~06·08·10·11 | NOT_REQUIRED | — | verify r1 §5 PASS 좌표 · 이번 턴 diff 0 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 — r2

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M5a-01~18 새 예산 18자리 각각 `scaleMs(N)`→`N` | VP-07a 선택 | 신규 | 게이트 exit 1 · 각 위반 1 (18/18) | 잠김 |
| X7′ `managed-mcp.cli:289` abort → `10` | D1 인용(r1 X7) | 못 잡음 | 게이트 exit 1 · 위반 1 | 잠김 |
| X8′ `native-storage.integration:51` 자식 프로세스 timeout → `10` | D1 인용(r1 X8) | 못 잡음 | 게이트 exit 1 · 위반 1 | 잠김 |
| X9′ `file-mutation` 끝에 `const T = 30_000; setTimeout(() => {}, T)` | D1 인용(r1 X9) | 못 잡음 | 게이트 exit 1 · 위반 1 | 잠김 |
| M11a `broker.test.ts` `{ timeoutMs: 1000 }` 1자리 추가 | VP-09a | 신규 | 게이트 exit 1(count 3 ≠ 4) | 잠김 |
| M11b `taskBoard.test.ts` `timeout: 30_000` 삭제 | VP-09a | 신규 | 게이트 exit 1(count 1 ≠ 0) | 잠김 |
| M15 `opencode-continuation` `vi.waitFor` 옵션 → `scaleMs(5000)` | VP-09a | 신규 | 게이트 exit 1 · 위반 1 | 잠김 |
| M3 `repository.test.ts` `scaledBudget` 제거 | VP-09a(V1 승계) | 잠김(r1) | 게이트 exit 1 · 위반 2 | 잠김 |
| M4 `file-mutation` 인라인 `scaleMs(45_000)`→`45_000` | VP-09a(V1 승계) | 잠김(r1) | 게이트 exit 1 · 위반 1 | 잠김 |
| M6 픽스처 기준 600_000→300_000 | VP-09a·07a(V1 승계) | 잠김(r1) | 게이트 (G) exit 1 | 잠김 |
| M1 `vitest.config.ts` hookTimeout 제거 | VP-07a(V1 승계) | 잠김(r1) | `test-time.test.mjs` fail 1 | 잠김 |
| M2 `scaledWaitForOptions` 객체 timeout 비배율 | VP-07a(V1 승계) | 잠김(r1) | `test-time.test.mjs` fail 1 | 잠김 |
| M5 `file-mutation:222` `scaleMs(30_000)`→`30_000` | VP-07a(V1 승계) | 잠김(r1) | 게이트 exit 1 · 위반 1 | 잠김 |
| M12 P5 `expect(x)`의 x도 제외 | VP-12 | 신규 | UT fail 1 | 잠김 |
| M13 P2 중첩 `timeouts` 규칙 삭제 | VP-12 | 신규 | UT fail 3 | 잠김 |
| M14 P5 `vi.waitFor` 제외를 첫 인자로 | VP-12 | 신규 | UT fail 3 · 트리 게이트 exit 1 · 위반 14 | 잠김 |
| M16 P1 (H′) 범위 `*.test.ts`만 | VP-12 | 신규 | UT fail 1 | 잠김 |
| M17 P4 abort 임계 재도입 | VP-12 | 신규 | UT fail 1 · (M17+X7′ 동시 트리는 exit 0 — UT가 잡는 자리) | 잠김 |
| X6 P6 허용 대조 파일 비교 삭제 | VP-12(r1 X6 재실행) | 잡음(r1) | UT fail 3 | 잠김 |
| 재량 — P2 `method` 형태 분기 제거 | 보고 밖 축 | 신규 | UT fail 1 | 잠김 |
| 재량 — P4 자식 프로세스 무임계 제거 | 보고 밖 축 | 신규 | UT fail 1 | 잠김 |

- **분모 검산**: 선택 증거 32(M5a 18 · M11a·M11b·M15·M3·M4·M6 6 · M1·M2·M5 3 · M12·M13·M14·M16·M17 5) · 인용 변이 4(X7′·X8′·X9′ · X6) · 새 oracle 2(재량 2) = 38 — 표 행 21(M5a-01~18을 1행으로 묶음 = 18) → 21 − 1 + 18 = **38** ✓.
- **덮개 회귀**: V1 (H) 3케이스는 '규칙 (H′)' 아래로 옮겨 그대로 통과. r1 `잡음` 행 중 이번 변경이 닿은 X6 재실행 red. 기존 (A)~(G) 케이스 전부 통과(`check-test-budgets.test.mjs` 66/66).

## [구현자 기입] Product/UX 파생 검토 — r2

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 게이트 위반 문구 3종 신설(`count` 불일치·reason 빈 값·대상 파일 없음) + waitFor 이중 배율 — 소비자 = CI 'Test budget guard' 로그·`npm test` | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 게이트 실패는 개발자 작업 루프(CI red) — 제품 상태표 밖, §7-A 운영 gate 행 | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 위반마다 `파일:줄 원문 — 처방` 한 줄 + 요약 줄, exit 1 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r2

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 낡은 의미 값 검사가 픽스처 트리 CLI 테스트를 깨뜨렸다(픽스처에 실제 항목 파일이 없다) | ✅ 선조치 — `runCli(appDir, argv, entries)` 로 항목 주입, 픽스처 테스트는 `[]` | 첫 실행 'CLI 위반이 있으면 1…' fail → 수정 후 66/66 |
| 2 | 이 환경 첫 전체 실행에서 실패 318 — better-sqlite3 Electron ABI·electron 바이너리 미설치 | 환경 복구(`node node_modules/electron/install.js` · `npm rebuild better-sqlite3`) 후 재실행 — 22 | 두 트리 모두 318로 같았다(신규 0). 환경 기인 |

### 설계 대비 명시적 차이

- `runCli`에 셋째 인자 `entries`(기본 `SEMANTIC_DELAYS`) — 위 1. 실제 CLI 경로는 기본값이라 동작 같음.
- `listBudgetFiles` 신설(`listTestFiles`에 패턴 인자) — plan "(F)(H′)용 파일 목록을 따로 두고".

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 캐시 없음 | — |
| 공유 | 해당 없음 — `entries`는 호출마다 인자 | P6 UT · 실제 트리 게이트 exit 0 |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/scripts/check-test-budgets{,.test}.mjs` · 새 예산 18자리 10파일(`instance-lifecycle`·`server.database-path`·`server`·`mail.integration`·`native-storage.integration`·`native-storage.testfixture`·`managed-mcp.cli.integration`·`background-tasks`·`pop3-tls`·`renderer/…/boot/steps`) · `app/AGENTS.md` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `node --test "scripts/*.test.mjs"` · `node scripts/check-test-budgets.mjs [--report]` · `scan-deadlines.mjs` 차집합 · `check-doc-inventory --check` · `clean-host-run.sh`(기준 = 브랜치 HEAD worktree · 현재) · `slow-runner-run.sh … 8` · `newfails.mjs` |
| **관측한 게이트 산출**(마지막 수정 뒤) | lint 0 error · 2 warning(변경 밖 `Timeline.tsx`·`useTranscriptVirtualizer.ts`) · typecheck exit 0 · `error TS` 0 · node 199/199 · test-budgets exit 0(16 real-git suites ok) · `--report` deadline 44 = 스캔 44(차집합 0줄) · doc-inventory ok · vitest 깨끗한 호스트 8,448케이스 통과 8,417 · 실패 22 · skip 9 — 기준 트리와 같고 `newfails` added 0 removed 0 · 바뀐 10파일 중 8 green, opt-in 2(`native-storage.integration`·`managed-mcp.cli.integration`) skip |
| 적대 측정 | 저성능 모사 S2: 1코어·8워커 6m17s · 8,448케이스 실패 22 — 기준 대비 `newfails` added 0 removed 0. 합성 사내 호스트·포크 모사는 비영향(VP-03·04 NOT_REQUIRED — 격리·배포 경로 diff 0)이라 재실행하지 않았다 |
| V-pair 자기확인 | `SELF_PASS 5 (VP-12·09a·07a·01a·13) / SELF_BLOCKED 0` · NOT_REQUIRED 8 |
| 강제 지점 전수 | 51/51 (EP-05a 44 + EP-12 7) |
| **AC 자기보고**(`Criteria-Met`) | AC7a ✅ · AC7b ✅ · AC19a ✅ · AC16 ✅(VP-13) · AC1~6·8·10~15·17·19 ✅ 승계(diff 0, node 199/199 · vitest 회귀 0) · AC9 ⚠️(워크플로 텍스트 테스트 green, 이번 push의 Windows CI 대기) · AC18 ⚠️ 사람 실기 |
| **합계 검산** | `✅ 19 · ⚠️ 2(AC9 Windows CI · AC18) · ❌ 0 = 총 21` — 분모 V1 19 → ΔV1 21(AC7b·AC19a 신설) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 같다 — "테스트가 고른 시간 값이 실제 경과의 상한이면 배율을 지난다"(D-001). r1은 술어가 해법 형태(`setTimeout`·`Date.now()+N`)라 분모가 10, ΔV1 주어 술어로 44.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: V1 §10 EP-05 자리 검색 명령이 주어가 아니라 형태로 셌다 — verify r1 D1이 `PLAN_GAP`으로 돌렸다.
- 반복해서 부딪히는 환경 한계: opt-in 스위트 2파일은 이 환경에서 skip — 그 자리의 기계 oracle은 형태 게이트뿐(§7-B 남는 차이). 세션 초기 환경에서 better-sqlite3 ABI·electron 바이너리 미설치.
- 현재 라운드·impl 턴: `r2`. 구현자 = 다음 검증자(Claude) — verify는 보고에 없는 적대 축을 하나 더해야 한다.

## [구현자 기입] 설계 리뷰 (r3 — ΔV2)

- 동의 / 그대로 진행: §7-C ΔV2 구현 설계 그대로 — 해석기 B0~B7·경계, P2′~P9, 허용 목록 +7, `--report` 값 열, 위반 문구 값 줄, `app/AGENTS.md`.
- 이견 / 현실성 문제: 없음. 해석기는 plan이 허용한 별도 모듈 `app/scripts/test-budget-bindings.mjs`로 나눴다. 시제품 `evidence/scan-deadlines-v2.mjs`는 복사하지 않고 새로 썼다(선언 노드를 키로 쓰는 참조·대입·호출 색인 구조).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) — r3

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-07b·09b EP-05b 예산 | `scaleMs(기준값)` | 24 | 24/24 | 자리마다 `gate:node scripts/check-test-budgets.mjs` — M5b 24자리 각각 리터럴 복귀 → exit 1(위반 1, `temp-repo:43`은 (G) 포함 3) | 기준값 = 현재 리터럴 · 이번 턴 테스트 소스 diff 0 | — |
| 같음 · 의미 값 | 허용 23항목 `{file, value, count, reason}` | 38 | 38/38 | `--report` deadline `semantic` 38 · 새 7항목 count 9·1·1·1·1·4·1 · M11c(+1)·M11d(−1) exit 1 | count 1·4·9 항목 구별 | — |
| 같음 · 분모 대조 | `--report` ↔ 스캔 | 62 | 62/62 | §7-B 대조 명령 → **0줄**(양쪽 62, 파일:줄·형태·값) | — | — |
| VP-07b·09b EP-01·02·03·04·06 | 전역·waitFor·파일 예산·인라인·픽스처 | 2·1·20·6·3 = 32 | 32/32 | 이번 턴 diff 0 — 좌표: M1(`test-time.test.mjs` fail 1) · `rg -n "vi\.waitFor\s*=" app/scripts` 1 · M3·M4 exit 1 · `--report` setConfig 21 · case 6 · M6 exit 1 | — | — |
| VP-12b EP-12b P1 | 파일 범위 | 1 | 1/1 | 'P1 — (H′) 는 test·testfixture…' · M16 UT fail 1 | ΔV1 입력 그대로 | — |
| P2′ | 형태 8 · 슬롯 · 호출 대상 | 1 | 1/1 | '바인딩 해석 (0294 ΔV2)' P2′ 15케이스 · M18~M23 각 UT red | 분기마다 `5000`→1 · `scaleMs(5000)`→0 | — |
| P3′ | 해석 B0~B7 | 1 | 1/1 | P3′ 13케이스 · M24~M28 각 UT red | 가림 두 순서 · `wait(5000)`·`wait(400)` 구별 | — |
| P4′ | 임계 · 자식 프로세스 바인딩 | 1 | 1/1 | 'P4′ 자식 프로세스 옵션은…' 6입력 + 대조 `pool(opts)` 0 · M29 · M17 · R-child red | `timeout: 10` | — |
| P5′ | 사용 자리 제외 | 1 | 1/1 | 'P5′ 변수에 담긴 슬롯은…' 5입력(Y2b·Y2e 0 · Y2f 1) · M30·M31 red | 전부/하나라도 맞바꿈 | — |
| P6 | 허용 목록 | 1 | 1/1 | ΔV1 P6 2케이스 · X6 UT fail 3 | ΔV1 입력 그대로 | — |
| P7′ | 이중 배율 바인딩 | 1 | 1/1 | 'P7′ vi.waitFor 옵션이…' 5입력 · M32 red | const 객체·숫자·전개·별칭 1, Y2b 0 | — |
| P8 | now 식 | 1 | 1/1 | P8 7케이스 · M33~M37 각 red | `+=`·역방향·하한·호출 인자 안 now | — |
| P9 | 자리 동일성 | 1 | 1/1 | 'P9 한 리터럴은 한 자리…' · '--report deadline 행은 형태 열과 값 열을 갖는다' · M38 red | `(값 :1)` 표기 · 값 열 `30_000`·`scaleMs` | — |
| AC19b | `app/AGENTS.md` | 1 | 1/1 | `grep -c "test-budget-bindings" app/AGENTS.md` → 1 · 단축 속성·`+=`·"참조가 **전부** 제외" 문구 · doc-inventory ok | — | — |

- 강제 지점 전수: EP-05b 62 + EP-01~04·06 32 + EP-12b 9 = **103/103**(VP-07b·09b·12b 분모, D4 반영). V1 EP-07~11(35)은 NOT_REQUIRED 비영향 — 이번 턴 diff가 워크플로·배율 해석·격리·배포·포트 파일에 0.
- §10 목록 밖에서 본 운반 자리: 0 — 대조 명령 0줄 · `bash …/broad-time-lines.sh app` 나머지 266줄(설계와 같음).
- 직전 verify 고장 이력의 `못 잡음` 행: Y1·Y2·Y5·Y5b·Y11 → 트리에 같은 입력 삽입 시 각각 게이트 exit 1, 대조 Y2b exit 0(아래 잠금 표).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-12b | REQUIRED | SELF_PASS | `check-test-budgets.test.mjs` '바인딩 해석 (0294 ΔV2)' 38케이스 + '규칙 (H′)' 31 | M18~M38 21건 RED · ΔV1 M12~M14·M16·M17·X6·R-method·R-child RED |
| VP-09b | REQUIRED | SELF_PASS | `gate:node scripts/check-test-budgets.mjs` exit 0 · 대조 명령 0줄 | M11c·M11d·Y-트리 5 RED · Y2b 대조 green · M3·M4·M6·M11a·M11b·M15·X9′ RED · Windows CI는 push 뒤 |
| VP-07b | REQUIRED | SELF_PASS | 자리별 게이트 좌표(위 표 M5b 24) | M5b 24/24 · X7′·X8′ · M1 RED |
| VP-01b | REQUIRED | SELF_PASS | AC1~3·5·6·8 = verify r1 §5 좌표 승계(이번 턴 테스트 소스·`test-time.mjs` diff 0, `node --test` 237/237) · AC7c·7d = VP-07b·09b·12b | 위 세 pair 변이 |
| VP-13 | REGRESSION | SELF_PASS | `evidence/clean-host-run.sh app` → 2346 suites 엔트리 · 8,448케이스 · 실패 22(9파일 = D-011 기준선) · `git diff --stat 3ff54f9 -- app/src` 0줄 | not selected |
| VP-02~06·08·10·11 | NOT_REQUIRED | — | verify r1 §5 · r2-5 좌표 · 이번 턴 diff 0 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 — r3

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M18 단축 속성 슬롯 삭제 | VP-12b | 신규 | UT fail 1('P2′ 단축 속성 — 이름 변수가 아닌 매개변수 경유') | 잠김 — 첫 시도 fail 0(Y1은 named가 대신 잡음) → 그 입력 추가 |
| M19 대입 슬롯 삭제 | VP-12b | 신규 | UT fail 4 | 잠김 |
| M20 클래스 필드 삭제 | VP-12b | 신규 | UT fail 1 | 잠김 |
| M21 named 삭제 | VP-12b | 신규 | UT fail 2 | 잠김 |
| M22 구조 분해 기본값 삭제 | VP-12b | 신규 | UT fail 4 | 잠김 |
| M23 호출 대상 해석 삭제 | VP-12b | 신규 | UT fail 4(별칭 2 + `promisify` 경유 P4′ 등) | 잠김 |
| M24 검사기 → 이름 맵(마지막 선언) | VP-12b | 신규 | UT fail 1('P3′ 가림…') | 잠김 |
| M25 대입 후보 삭제 | VP-12b | 신규 | UT fail 2 · 트리 exit 1(discovery-cache `let now` 대입) | 잠김 |
| M26 매개변수←호출 인자 삭제 | VP-12b | 신규 | UT fail 7 | 잠김 |
| M27 반환식 삭제 | VP-12b | 신규 | UT fail 1 | 잠김 |
| M28 멤버 접근 삭제 | VP-12b | 신규 | UT fail 1 | 잠김 |
| M29 자식 프로세스 사용 자리 삭제 | VP-12b | 신규 | UT fail 1 | 잠김 |
| M30 제외를 선언 자리로만 | VP-12b | 신규 | UT fail 1(Y2b·Y2e 오탐) | 잠김 |
| M31 "전부" → "하나라도" | VP-12b | 신규 | UT fail 2 · 트리 exit 1 | 잠김 |
| M32 P7′ 바인딩 해석 삭제 | VP-12b | 신규 | UT fail 1 | 잠김 |
| M33 now 바인딩 해석 삭제 | VP-12b | 신규 | UT fail 6 · 트리 exit 1 | 잠김 |
| M34 `+=` 삭제 | VP-12b | 신규 | UT fail 2 · 트리 exit 1(poll-race count) | 잠김 |
| M35 역방향 elapsed 삭제 | VP-12b | 신규 | UT fail 1 | 잠김 |
| M36 now 식 부분 트리 | VP-12b | 신규 | UT fail 2(오탐 + `new Date()` 분기) | 잠김 |
| M37 now 식끼리 비교 제외 삭제 | VP-12b | 신규 | UT fail 1 | 잠김 |
| M38 리터럴 중복 제거 삭제 | VP-12b | 신규 | UT fail 2 | 잠김 |
| M5b 예산 24자리 각각 리터럴 복귀 | VP-07b | M5a 18 잠김(r2) | 게이트 exit 1 24/24 | 잠김 |
| M11c poll-race `now += 1001` +1 | VP-09b | 신규 | 게이트 exit 1(count 9 ≠ 10) | 잠김 |
| M11d mail `now += 301_000` −1 | VP-09b | 신규 | 게이트 exit 1(count 4 ≠ 3) | 잠김 |
| Y1·Y2·Y5·Y5b·Y11 트리 삽입 | verify r2 `못 잡음` | 못 잡음 | 게이트 각 exit 1 · 위반 1 | 잠김 |
| Y2b 트리 삽입(대조) | verify r2 대조 | red(오탐) | 게이트 exit 0 · 위반 0 | 오탐 해소 |
| Y1c 트리 삽입 | verify r2 재실행 | 잡음 | exit 1 | 유지 |
| M12·M13·M14·M16·M17·X6·R-method·R-child | ΔV1 승계(VP-12b) | 잡음 | UT fail 1·4·4·1·1·3·1·2 · M14 트리 exit 1 | 유지(덮개 회귀 0) |
| M3·M4·M6·M11a·M11b·M15·X7′·X8′·X9′·X4·X5 | ΔV1·V1 승계 | 잡음 | 게이트 각 exit 1 | 유지 |
| M1 `vitest.config.ts` hookTimeout | V1 승계 | 잡음 | `test-time.test.mjs` fail 1 | 유지 |

- **분모 검산**: 선택 증거 21(M18~M38) + 3(M5b 묶음·M11c·M11d) · 인용 변이 6(Y1·Y2·Y5·Y5b·Y11 + Y2b 대조) · 승계 재실행 20(M12·M13·M14·M16·M17·X6·R-method·R-child · M3·M4·M6·M11a·M11b·M15·X7′·X8′·X9′·X4·X5 · M1) + Y1c 1 · 새 oracle 0(UT는 직접 행동 oracle) = 51 — 표 행 30 = 21 + 3 + 2(Y 묶음 행·Y2b) + 1(Y1c) + 2(승계 묶음 두 행) + 1(M1) = 30, 묶음 행 펼침 30 − 3 + (5 + 8 + 11) = 51 ✓.
- **덮개 회귀**: 0 — ΔV1 판정 변이 8종·트리 변이 11종 전부 red 유지, '규칙 (H′)' 31케이스 그대로 통과.

## [구현자 기입] Product/UX 파생 검토 — r3

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 위반 문구에 `(값 :N)` 추가 — 소비자 = CI 'Test budget guard' 로그·`npm test`. 바인딩 경유 자리에서 고칠 줄(리터럴 위치)을 가리킨다 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 게이트 실패는 개발자 작업 루프(CI red) — §7-A·§7-C 운영 gate 행 | — |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 위반마다 `파일:줄 (값 :N) 원문 — 처방` 한 줄 + 요약 줄, exit 1 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r3

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 확장자 없는 이름(UT의 `'a'`)은 `ts.createProgram`이 루트로 받지 않아 소스 파일이 `undefined` | ✅ 선조치 — 내부 program 이름에만 `.ts`를 붙인다 | 첫 실행 'P6 — 항목 count…' TypeError → 수정 후 66/66 |
| 2 | M18 단축 속성 변이가 UT에 침묵 — Y1 입력은 named 슬롯이 같은 리터럴을 먼저 잡는다 | ✅ 선조치 — named가 닿지 않는 입력(`function run(timeoutMs) { return pool({ timeoutMs }) }`) 추가 | M18 fail 0 → 1 |
| 3 | 게이트 실행 시간 1.4s → 5.6s(파일마다 단일 파일 program) | 보고만 — plan §7-C 설계 근거 "증가 수 초" 범위 | `time node scripts/check-test-budgets.mjs` real 5.55s |
| 4 | 세션 초기 환경에서 electron 바이너리·better-sqlite3 Node ABI 미설치 | 환경 복구(`node node_modules/electron/install.js` · `npm rebuild better-sqlite3`) 후 회귀 실행 | env 로그 "rebuilt dependencies successfully" |

### 설계 대비 명시적 차이

- 해석기를 별도 모듈 `scripts/test-budget-bindings.mjs`로 뒀다 — plan이 허용한 선택. 테스트는 `analyzeScale`·`scanBudgetSites` 경유.
- `--report`의 값 열은 deadline 행에만 채우고 다른 종류는 `-`.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 캐시는 호출마다 새로 만든다 | — |
| 공유 | 해당 없음 — 해석기는 파일마다 생성, 모듈 상태 없음 | P1 UT(여러 파일) · 트리 게이트 exit 0 |
| 재진입 | 순환 바인딩(`let x = x + 1`·자기 전개) — memo·busy 집합으로 끊는다 | 트리 926파일 완주 · P3′ let 재대입 UT |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/scripts/test-budget-bindings.mjs`(신규) · `app/scripts/check-test-budgets.mjs` · `app/scripts/check-test-budgets.test.mjs` · `app/AGENTS.md` — `app/src/**` 0 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `node --test "scripts/*.test.mjs"` · `node scripts/check-test-budgets.mjs [--report]` · §7-C 대조 명령 · `check-doc-inventory --check` · `evidence/clean-host-run.sh app` |
| **관측한 게이트 산출**(마지막 수정 뒤) | lint 0 error · 2 warning(변경 밖 `Timeline.tsx`·`useTranscriptVirtualizer.ts`) · typecheck exit 0 · `error TS` 0 · node 237/237(26 suites) · test-budgets exit 0("16 real-git suites ok") · 대조 0줄(62 = 62) · doc-inventory ok · vitest 깨끗한 호스트 8,448케이스 통과 8,417 · 실패 22(9파일 = 기준선) · skip 9 |
| 적대 측정 | 위 잠금 표 — 판정 변이 21 · 트리 변이 32(M5b 24 · M11c·d · Y-행 5 · Y1c) · 승계 20 전부 red, 대조 Y2b green |
| V-pair 자기확인 | `SELF_PASS 5 (VP-12b·09b·07b·01b·13) / SELF_BLOCKED 0` · NOT_REQUIRED 8 |
| 강제 지점 전수 | 103/103 (EP-05b 62 + EP-01~04·06 32 + EP-12b 9) |
| **AC 자기보고**(`Criteria-Met`) | AC7c ✅ · AC7d ✅ · AC19b ✅ · AC16 ✅(VP-13) · AC1~6·8·10~15·17·19 ✅ 승계(diff 0) · AC9 ⚠️(이번 push의 Windows CI 대기) · AC18 ⚠️ 사람 실기 |
| **합계 검산** | `✅ 19 · ⚠️ 2(AC9 · AC18) · ❌ 0 = 총 21` — 분모 21 그대로(번호 승계) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r3)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 같다 — "판정은 D-012/D-015 주어보다 좁으면 안 된다". r1 술어, r2 문법 노드, r3 바인딩 해석 범위.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: ΔV1 P3가 값만 const를 따라가게 적었다 — verify r2 D3가 PLAN_GAP으로 돌렸다.
- 반복해서 부딪히는 환경 한계: opt-in 스위트 2파일 skip · 세션 초기 electron·better-sqlite3 미설치 · 리눅스 기준선 22건.
- 현재 라운드·impl 턴: `r3`. 설계·구현·검증 모두 Claude — verify는 보고에 없는 적대 축을 하나 더해야 한다.

---


## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | EP-05 자리 검색·게이트 (H) 술어가 `setTimeout`·`Date.now()+리터럴`뿐이라 "테스트 소유 실시간 마감"(D-001)보다 좁다. 목록 밖 미배율 `managed-mcp.cli.integration.test.ts:289` `AbortSignal.timeout(40_000)` · `native-storage.integration.test.ts:51` `execFileSync {timeout: 300000}` · 분류 필요 `pop3-tls.test.ts:48-49`(3000) · 식별자 경유 지연은 (H) 밖 | VP-01·07·09 · AC7 · [verify r1](verify.md) §13 | 설계자가 EP-05 술어·자리 목록·pop3 분류를 ΔV1로 고정 → 구현이 고장 이력 X7·X8·X9를 닫는다 | PLAN_GAP | **closed** (verify r2 — X7′·X8′·X9′ 잡음 · EP-05a 44 = 스캔 44) |
| D2 | (H′) 형태 판정이 같은 파일 바인딩을 따라가지 않아 규칙 칸이 덮는 두 형태를 놓친다. (a) 단축 속성 `{ timeoutMs }` + `const timeoutMs = 5000` → exit 0(Y1), 같은 값의 키 형태 `{ timeoutMs: probeMs }`는 exit 1(Y1c). (b) const에 담은 `vi.waitFor` 옵션 — 안의 `scaleMs`는 green(Y2), 기준값만 담은 정상 코드는 "테스트 소유 마감" 위반 red(Y2b) | VP-12 · AC7b · EP-12 P2·P3·P5·P7 · D-012·D-014 · [verify r2](verify.md) r2-13 | 둘째 인자 식별자를 같은 파일 const로 풀어 P5 제외·P7 판정에 쓰고, 단축 속성을 키 형태로 판정한다 · UT 입력에 Y1·Y2·Y2b를 둔다 | BLOCKING | **closed** (verify r3 — Y1·Y2 잡음 · Y2b exit 0) |
| D3 | EP-12 P2 규칙 칸이 형태의 **대상**이 같은 파일 바인딩을 거칠 때를 정하지 않는다 — `const elapsed = Date.now() - start; expect(elapsed).toBeLessThan(5000)`(Y5) · `const start = Date.now(); const deadline = start + 5000`(Y5b) · 구조 분해 매개변수 기본값 `({ timeoutMs = 5000 } = {})`(Y11) 모두 게이트·`scan-deadlines.mjs` exit 0. D-012 주어("경과 상한 단언"·"`now()` 마감"·"매개변수 기본값")는 덮는다. 현재 트리 해당 자리 0 | VP-12 · AC7b · D-012 · §10 EP-12 · [verify r2](verify.md) r2-13 | 설계자가 P2(·P3) 규칙 칸에 바인딩 추적 범위(now 식 변수 · 파생 마감 · 구조 분해 기본값 · 단축 속성)를 한 번에 정하고 UT 입력 칸·스캔 술어를 맞춘다 → 구현이 Y5·Y5b·Y11을 닫는다 | PLAN_GAP | **closed** (verify r3 — ΔV2 P2′·P8 · Y5·Y5b·Y11 잡음) |
| D4 | r2 `[구현자 기입]` 강제 지점 전수 표가 VP-07a·09a 분모의 EP-01~04·06(32자리)을 행으로 두지 않고 "NOT_REQUIRED 비영향"으로 적었다 — 그 자리는 REQUIRED pair 분모다 | repository operation · [verify r2](verify.md) r2-11 | 다음 impl 표는 pair §10 자리 전부를 행으로 둔다(검증자가 r2-5에서 독립 재측정으로 닫음) | NON_BLOCKING | **closed** (verify r3 — r3 표 EP-01~04·06 32행) |
| D5 | EP-12b 규칙 칸이 덮는데 판정·UT가 못 미친다. (a) 판정 위반 0: W1 `import { setTimeout } from 'node:timers/promises'; await setTimeout(5000)` · W2·W2b `(fast ? 2 : 5) * 1000` · W3·W3b 클래스 필드·대입의 `timeouts` 소유 · W7 IIFE 호출부. (b) 분기를 지워도 UT green: M21b named 식별자 대입 · `o['k'] =` · `\|\|=` · `util.promisify` · 호출 대상 래퍼 · `/` · `??`·`\|\|` 왼쪽 · 전개 멤버 · `satisfies` · `!` · `.valueOf()` · 역방향 `OrEqual` · matcher 안 elapsed | VP-12b · AC7d · EP-12b P2′·P3′·P5′·P8 · [verify r3](verify.md) r3-13 | 별칭 표를 전역 정규식보다 먼저 · 산술 값 조합마다 · 소유 판정에 클래스 필드·대입 · IIFE 호출부 · 13분기마다 UT 입력(`evidence/verify-r3-probes.mjs`) | BLOCKING | **closed** (verify r4 — 인용 변이 14 재실행 잡음 · `dv3-branches.mjs` 불일치 0). 이력: review round 41 판정 정정: 이행 14건 유지, W3·W3b·W7·`satisfies`·`!` 5건은 확장 → INDEX 후보 표 · ΔV3(§7-D): 이행 14건 = 분기 목록 15행(판정 F04·V33·V34 · 입력 F24·S03·S05·C06·C01·V31·V31b·V22·V21·N04·F18·X15), 확장 5건 = 선언 경계 L01~L04 → ΔV4 KO02·KO03a·KD07·KV04c·KV04d 칸(사용자 결정) |
| D6 | EP-12b 규칙 칸이 D-015와 갈리거나 주어보다 좁다. (a) 호출 대상 해석 목록(P2′)에 구조 분해·요소 접근 없음 — W4b·W4c·W4d green, 정상 코드 W4·W10 red. (b) P8 now 식 목록에 호출 반환 없음 — W5 `now() + 5000` green, 변수 경유 W5b red. (c) D-016 열거 밖: `.not` elapsed(W6) · 기본값 없는 `/timeout/i` 매개변수 ← 같은 파일 호출(W8) · 복합 대입 값(W9). 시제품 스캔도 같은 판정, 현재 트리 해당 자리 0 | VP-12b · AC7d · D-015·D-016 · §10 EP-12b · [verify r3](verify.md) r3-13 | 설계자가 (a)(b)를 D-015 쪽 또는 P2′·P8 쪽 하나로 맞추고 (c) 3축을 자리/경계로 정해 EP-12b 규칙·UT 입력 칸·시제품 술어를 갱신 → 구현이 W4b~W9·오탐 W4·W10을 닫는다 | PLAN_GAP | **ΔV4로 흡수** — 사용자 결정(2026-11-05, D-017)으로 노드 종류 표 칸이 됐다(W4b·W4c·W4d → KC05 · W5 → KN04 · W6 → KE02 · W8 → KP02 · W9 → KD02 · 오탐 W4·W10 → KC05d·KC09b). INDEX 후보 표 0294 행 삭제 |
| N1 | `scripts/test-budget-bindings.mjs`의 `peel`·`ARITH_OPS` export 외부 소비 0 | 역방향 탐색 · [verify r3](verify.md) r3-3 | 다음 구현이 export를 거둘 수 있다 | NON_BLOCKING | **closed** (verify r4 — export는 `keyOf`·`createBindings`만) — ΔV3 증거 스크립트도 이 export를 쓰지 않는다 |
| D7 | KD05 칸에 표에 없는 결과 `숫자 아님` — `test-budget-bindings.mjs:495` `out.length ? out : one('nonnum', 'KD05', node)`. 구조 분해 원천이 호출(`const { ms } = getOpts()`)·`await`·for-of(`for (const { ms } of cases)`)·배열 요소면 값 자리가 통과한다(Q1~Q4 위반 0, 같은 값의 멤버 형태 Q1c·Q3c는 red). `'nonnum'`→`'red'` 변이에 UT 537/537 green(K1) | VP-12d · AC7f · EP-12d KD05 "후보마다 KV"·KD04 · [verify r4](verify.md) r4-13 | 빈 후보는 원천 식의 KV 판정(호출 → KF05 · `await` → KV14 · for-of → KD04 · import → KD10 경계)으로 · Q1~Q4·Q5·Q6을 UT 입력으로(`evidence/verify-r4-probes.mjs`) | BLOCKING | **closed** (verify r5 — M53 red · `verify-r4-probes.mjs` 13 불일치 0 · KD05b~e·h·i 단언). 이력: ΔV5 §7-F가 KD05 분류 칸을 풀어 적고 입력 KD05b~k를 뒀다 |
| D8 | KM06·KD01 칸이 D-018 주어(같은 파일 선언 그래프)보다 좁다 — 생성자 대입 `this.ms = 5000`(속성 초기값 500)과 구조 분해 대입 `({ ms } = { ms: 5000 })`이 위반 0(Q8·Q9). 트리 자리 0 | VP-12d · AC7f · D-018 · EP-12d KM06·KD01 · [verify r4](verify.md) r4-13 | 설계자가 두 형태를 칸으로 채택하거나 경계로 선언(ΔV4 창 안 — verify 1회째) | PLAN_GAP | **closed** (verify r5 — KM10a·KD15c 단언 · M55~M60 red). 이력: ΔV5 채택(D-019 · §7-F), 경계 L12·L13 |
| N2 | `createBindings` 반환의 `values`·`sources`·`argumentsFor`·`importAliases` 외부 소비 0 | 역방향 탐색 · [verify r4](verify.md) r4-3 | 다음 구현이 거둘 수 있다 | NON_BLOCKING | open |
| D9 | KD05 빈 후보에서 원천 후보가 리터럴과 호출로 섞이면 `test-budget-bindings.mjs:603-607` `sources(origin).some(리터럴)`이 KM02 숫자 아님을 낸다 — `let r = {}; r = getOpts(); const { ms } = r`(R7) · `const { ms } = cond ? {} : getOpts()`(R8) 위반 0, 같은 원천 멤버 읽기 R7c·R8c는 KM08. `.some`→`.every` 변이에 UT 709/709 green(K2) | VP-12e · AC7g · EP-12e KD05 "원천 식을 KM 표로 … 그 밖(호출…)은 KM08" · [verify r5](verify.md) r5-13 | 원천 후보마다 KM 판정 · R7·R8을 UT 입력으로(`evidence/verify-r5-probes.mjs`) | BLOCKING | **구현 조치(r7), 검증 대기** — G01·G01m·G02·G03·G03m, sv39 red 5 |
| D10 | D-019 "KD05 '원천 멤버'는 원천 식을 KM 표로 판정한 결과" ↔ §7-F KD05 칸 "후보마다 KV. 후보가 없으면 원천 식을 KM 표로" — 후보가 있을 때 멤버 대입 우변(KM10)·증감(KM11)·비리터럴 원천이 드는지 갈린다. `o.ms = 5000; const { ms } = o`(R5) · `o.ms++` 뒤 구조 분해(R6) · 키 있는 리터럴 + 호출 혼합(R7b·R8b) 위반 0, 멤버 읽기 대조는 위반 1. 트리 자리 0 | VP-12e · AC7g · D-019 · EP-12e KD05 · [verify r5](verify.md) r5-13 | 설계자가 한 문장으로 정하고 KD05 칸·입력을 고친다 | PLAN_GAP | **closed**(verify r6 — R5·R6·R7b·R8b = KD05n~v 단언 · M62 red 6 · 짝 행 KD05nm·pm·rm 대칭). 이력: ΔV6 정정(D-020 (a)) |
| D11 | KD02·KD15 판정이 변수 선언만 본다 — `let { ms } = { ms: 500 }` 뒤 `ms++`·`ms += 4500`(R2·R2c) · 매개변수 `ms++`(R3) · `for ({ ms } of …)`(R4) 위반 0. 트리 자리 0 | VP-12e · AC7g · D-018·D-019 · EP-12e KD02·KD15 · [verify r5](verify.md) r5-13 | 설계자가 항목마다 채택 또는 경계 선언(ΔV4 창 안 마지막 — 이 설계 턴 뒤 열거 동결) | PLAN_GAP | **closed**(verify r6 — R2·R2c·R3·R4 = KD15h·KD02b·KD15i·KD15m 단언 · M65·M66a/b·M67·M68·M69a/b·M70 red). 이력: ΔV6 채택(D-020 (b)) |
| D12 | KM10 칸 "원천 사슬에 매개변수·**구조 분해 요소**의 대입 우변이 든다" — UT 입력 KM10n은 매개변수뿐. `expand` 구조 분해 요소의 대입 우변 사슬 제거(sv17, `:369`)가 UT 623/623 green. 코드는 기대대로(G04 `1/0/-`) | VP-12f · AC7h · EP-12f KM10 · [verify r6](verify.md) r6-13 | `evidence/verify-r6-gap-inputs.mjs` G04·G04m을 입력 칸에 더한다 | BLOCKING | **구현 조치(r7), 검증 대기** — G04·G04m, sv17 red 1 |
| D13 | KD05 칸 "배열 패턴 `원천[i]`와 같은 KM 판정" — 배열 패턴 × 멤버 쓰기(KM10·KM11) 입력 없음. 배열 패턴 키 제거(sv28, `:699`) green. 코드는 기대대로(G05·G06) | VP-12f · AC7h · EP-12f KD05 · [verify r6](verify.md) r6-13 | G05·G05m·G06·G06m | BLOCKING | **구현 조치(r7), 검증 대기** — G05·G05m·G06·G06m, sv28 red 2 |
| D14 | KD05 칸 "호출부 없는 매개변수 KD08(기본값은 후보로 남는다)" — 호출부 없는 구조 분해 매개변수 + 기본값 입력 없음. `!out.length &&` 제거(sv14, `:579`) green. 코드는 기대대로(G07) | VP-12f · AC7h · EP-12f KD05 · [verify r6](verify.md) r6-13 | G07·G07b·G07c | BLOCKING | **구현 조치(r7), 검증 대기** — G07·G07b·G07c, sv14 red 1 · C108 재앵커 red 1 |
| D15 | 덮개 회귀: r5에서 red이던 C035(`:333` `bindingElementSources` 중첩 분기 제거)가 green — 2단 중첩 값이 `memberJudgments`로 옮겨 구 장치가 닿지 않는다. 3단 중첩 값은 변이에서 `1/0/-` → `0/0/-`(거짓 통과) | VP-12f · AC7h · 하한 ④ · EP-12f KD05 "(중첩 포함)"·"바깥 패턴의 원천 멤버" · [verify r6](verify.md) r6-13 | G08·G08b·G09·G10 | BLOCKING | **구현 조치(r7), 검증 대기** — G08·G08b·G09·G10, C035 red 3 |
| D16 | `[구현자 기입]` 강제 지점 표가 VP-07b·09c의 §10(EP-01·02·03·04·06 34자리)을 담지 않고, "설계 대비 차이"("중첩 패턴의 원천 없음만 폴백에 남는다")가 계측과 다르며(411행 중 도달 1행 `rest.ms` · 도달 형태 = 나머지 요소 값·계산 키), 잠금 표 검산 줄에 합계 T가 없다. 정정(review round 43): 잠금 표에 ΔV6 정정 칸 sweep 행이 0이다(§7-G 요구 미수행) | 현재 산출물 운영 gate · SKILL §9 · §7-G | r7 `[구현자 기입]`에서 표 복원 · 서술 정정 · 검산 줄 · sweep 행(impl §3 diff 자리 절차) | BLOCKING(경미) | **구현 조치(r7), 검증 대기** — 강제 지점 103/103 표 복원 · 폴백 서술 정정 · 정정 칸 제거/맞바꿈 · 추적 394행 검산 |
| E1~E4 | 확장 후보 — 계산 키 구조 분해 0/0/- ↔ `o[k]` KM09 · `emptyDestructuring` 잔여 경로(sv36·C122·S-KD05-literal·K2 원문 — round 43 정정) · 구조 분해 사슬 재귀 상한 후퇴(800~1200 → 200~300단) · 소유 대조 `.some`·나머지 요소 제외·키 없음 반환 입력 없음 · 홀더 분기 중복 | D-020 주어보다 칸이 좁음 · 트리 0 | INDEX 후보 표 0294 행 | NEXT_HANDOFF(확장) | 후보 표 |
| N3 | PR #530 브랜치 CI run 41986312686(head `cc72b80`) `discovery-cache.test.ts:123` 경쟁 단언 red | 비귀속 · [verify r5](verify.md) r5-3 | — (`app/src` diff 0 · 같은 코드 `main` run 41986335666 success) | NON_BLOCKING | open |


## [구현자 기입] 설계 리뷰 (r4 — ΔV3 + ΔV4)

- 동의 / 그대로 진행: 유효 V는 `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4`. REQUIRED = VP-12d·09c·01d, REGRESSION = VP-07b·13, NOT_REQUIRED = VP-02~06·08·10·11.
- 이견 / 현실성 문제: 없음. 현재 사용자 호출에 따라 Codex가 구현했다. ACTIVE Decision·AC·V·§10 규범 행은 바꾸지 않았다.
- 기준선 재현: ΔV3 분기 169행 중 불일치 4 · ΔV4 칸 입력 163행 중 불일치 70. 수정 후 두 불일치 집합은 모두 0이다.

## [구현자 기입] 강제 지점 전수 (§10 대조) — r4

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-07b·09c EP-01 | 전역 케이스·훅 | 2 | 2/2 | `test-time.test.mjs` '케이스·훅 예산 = 20_000 × 배율…'; M1 red | 배율 1·3·5의 test/hook 구별 값 | — |
| 같음 EP-02 | waitFor wrapper | 1 | 1/1 | 같은 파일 'waitFor 옵션 네 갈래…'; M2 red · `test-environment.test.ts` 배선 8건 통과 | 미지정·숫자·timeout 유/무 객체, interval 보존 | — |
| 같음 EP-03 | 파일 예산 | 20 | 20/20 | `r4-mutation-results.tsv` EP03 각 행 red · `check-test-budgets.test.mjs` F 판정 | 원본 파일의 scaledBudget만 제거, 같은 파일 analyzeScale 호출 | 검색 21 − 고정 목록 20 = 기존 `test-environment.hostile` 1. r1부터 보고된 차이, 이번 변경 0 |
| 같음 EP-04 | 인라인 예산 | 6 | 6/6 | 같은 TSV EP04 각 행 red · F 케이스 좌표 | 원본 인자의 scaleMs만 제거 | — |
| 같음 EP-06 | 픽스처 상한·kill·rm | 3 | 3/3 | `test-time.test.mjs` '상한·kill 유예·rm 재시도…'; M6·EP06-KILL·EP06-RM red | 600_000·5_000·200 각각 구별 | — |
| VP-07b·09c EP-05b | 예산 마감 | 24 | 24/24 | `r4-sweep.tsv` tree/scaled 각 자리 · M5b 각각 실제 CLI exit 1 | 그 자리의 scaleMs만 제거. X7′·X8′ 10ms도 CLI red | — |
| 같음 EP-05b | 의미 값 | 38 | 38/38 | 같은 파일 tree/semantic 각 자리 · 각 파일 analyzeScale의 count 불일치 | 값 하나를 임계 아래로 바꾸면 그 항목 count가 감소 | — |
| 같음 EP-05b | 분모 대조 | 62 | 62/62 | §7-C 대조 명령의 양방향 차집합 0줄 · deadline 24 scaled + 38 semantic | 슬롯 줄·형태·값 비교 | — |
| VP-12d EP-12d | 판정 P1~P9 | 9 | 9/9 | `check-test-budgets.test.mjs` ΔV3 169 + ΔV4 163 + 배율 대조 98 · `r4-sweep.tsv` input/cell | 칸 91·입력 332 모두 assertion red 좌표. 기존 A~G 유지 | — |
| VP-09c EP-13 | 판정 불가 허용 | 0항목 | 0/0 | 실제 `--report` UNRESOLVED/allowed 0행 · `UNRESOLVED_ALLOWED=[]` | M51 red · M52 count 1 green / 2 red | — |

- 대상 강제 지점은 **103/103** = EP-01~04·06 32 + EP-05b 62 + EP-12d 9 + EP-13 0. 나머지 35는 명시 NOT_REQUIRED pair의 자리다.
- 자리별 좌표·변이·관측의 원문은 [`r4-sweep.tsv`](evidence/r4-sweep.tsv)와 [`r4-mutations.jsonl`](evidence/r4-mutations.jsonl)에 있다. 단순 typecheck를 자리 oracle로 세지 않았다.
- 전칭 주장 검산: 입력 목록 − assertion으로 잡힌 입력 = 0개(332/332); 트리 대조 양방향 차집합 0줄. `app/src/**` diff 0, 신규 의존성 0.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-12d | REQUIRED | SELF_PASS | ΔV3·ΔV4 케이스 ID별 테스트; 분기·칸 탐침 불일치 0 | M43~M50·M39~M42·인용 14; sweep 332입력·91칸 red |
| VP-09c | REQUIRED | SELF_PASS | 실제 CLI exit 0 · deadline 62 대조 0줄 · KA01~09 | M51·M52·승계 선택 증거 유지. Windows CI는 대기 |
| VP-07b | REGRESSION | SELF_PASS | EP-01~06 위 행 · test-time 단위/배선 | 예산 24자리 각각 실제 CLI red |
| VP-01d | REQUIRED | SELF_PASS | AC1~8의 단위·배선·게이트 좌표; VP-12d·09c 조합 | 하위 root 실패 0 |
| VP-13 | REGRESSION | SELF_PASS | 변경 전/후 전체 실행 · `newfails.mjs` added 0 / removed 0 | not selected — 직접 결과 |
| VP-02~06·08·10·11 | NOT_REQUIRED | — | 이전 verify 좌표 승계, 관련 코드 diff 0 | 이번 Linux 환경의 AC12·13 제한은 아래에 별도 기재 |

## [구현자 기입] 이번 라운드 수정의 잠금 — r4

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M39~M42 | ΔV3 | F04·V33~35 오판 | F04 / V33·V34 / V35 / V36; 각 실제 red | 잠김 |
| M43~M50 | ΔV4 선택 | 새 계약 | red 소거 38 · callback 경계 7 · import 경계 5 · lib 경계 7 · 핸들/mock 6 · 구조 분해 4 · 재대입 1 · not 방향 6 | 잠김 |
| M51·M52 | 실제 트리·허용 목록 | 새 계약 | 외부 Math.max 마감 CLI red; count 1 green, count 2 red | 잠김 |
| verify r3 인용 14 | D5 이행 결함 | 못 잡음 | `r4-selected.tsv` 인용 변이 행 14개와 직접 실패 ID | 잠김 — 같은 제거·맞바꿈을 재실행 |
| 승계 선택 증거 | V1~ΔV2, 장치 하한 | 잡음 | M1~M4·M6·M11a~d·M12~M38·X/Y 계열의 물리적 실행은 같은 표 | 유지 |
| 입력 332 · 칸 91 · EP-05b 62 | 열거 sweep | 이번 턴의 분모 | `r4-sweep.tsv` 485행, 각 행에 red 관측과 직접 좌표 | 잠김 |
| M18 단축 속성 | 승계 + 이번 표면 | 첫 C236은 green | 신규 `S01·binding` 단독 1 failed; raw 1 / scaled 0 | 잠김 — 새 KP02가 종전 fixture를 대신 잡아 구조 분해 별칭으로 구별 |

- **분모 검산**: 선택 증거 **82**(승계·기존 장치 하한 포함) · 인용 변이 **18**(ΔV3 4 + verify r3 14) · 새 구조 oracle **0** · sweep **485** = 추적 행 **585**. 정본은 [`r4-selected.tsv`](evidence/r4-selected.tsv) 100행 + `r4-sweep.tsv` 485행이다.
- 물리적 실험은 **439회**(공유 변이가 여러 추적 행을 닫음): red 370 · green 69. 탐색 중 green은 완료 증거로 쓰지 않았고, 허용 count·Y2b 대조의 green만 의도한 결과다. 실제 결과는 [`r4-mutation-results.tsv`](evidence/r4-mutation-results.tsv)에 전부 남겼다.
- 재현: `python3 ../.agents/skills/handoff-verify/scripts/mutate.py ../docs/handoff/0294-slow-runner-hermetic-tests/evidence/r4-mutations.jsonl --cwd .` (`app/`에서). 모든 배치의 원복 해시 확인을 통과했다.
- 덮개 회귀: 없음. 예전 선택 증거가 이번에도 red이며, M18은 새 입력을 추가해 다시 red로 만들었다. 탐색 S-KE05의 green은 구별 입력 `KE05·now`와 방향 변이 S-KE05-direction으로 보완했다.

## [구현자 기입] Product/UX 파생 검토 — r4

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문자열·상태에 소비자가 있는가 | CLI stderr는 파일·줄·칸 ID·칸 이름과 재작성/허용 등록 처방을 낸다. report는 UNRESOLVED/allowed·칸 ID를 운반 | 소비자 = 테스트 작성자·CI 로그, KA08·09가 단언 |
| 새 실패 경로는 어느 계약인가 | 판정 불가·허용 목록 count/why/파일 오류는 §7-E Product & UX 행 | 제품 런타임·사용자 데이터 변경 없음 |
| 조용한 실패인가 | 실제 M51 exit 1, M52 등록 후 exit 0 / 잘못된 count exit 1 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r4

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 새 KP02가 기존 M18 fixture의 값을 먼저 세어, 단축 속성 분기 제거가 green | 선조치 — 원천 키가 delay인 구조 분해 별칭 fixture 추가 | C236 green → M18-shorthand red 1 |
| 2 | 문자열 소스를 script로 파싱하면 최상위 await IIFE가 await라는 호출로 파싱됨 | 선조치 — 단일 파일을 module로 파싱, 원문 좌표 보존 | KD07·KF03·KN05 모두 기대 통과 |
| 3 | property 이름 now의 검사기 심볼이 없을 때 lexical now로 폴백하면 Date.now()를 로컬 함수로 오인 | 선조치 — 속성 이름에는 lexical 이름 폴백을 적용하지 않음 | KN04 + 가림 입력 통과 |
| 4 | 호스트 Node 24와 Electron SQLite ABI 차이, 읽기 전용 홈 캐시 | Node ABI를 의도적으로 빌드; npm/node-gyp 캐시는 /tmp 지정 | 전체 DB 포함 실행 완료, 소스 변경 0 |
| 5 | Linux 전체 실행은 문서 기준 22 대신 26 실패. 합성 호스트의 자식도 bootstrap.native-history 1건 실패 | 환경/기준선으로 분리; 이번 비영향 경로를 고치지 않음 | 변경 전후 실패 집합 차집합 0. AC12·13은 미관측으로 유지 |

### 설계 대비 명시적 차이

- 메커니즘 대체 없음. 기존 단위 테스트를 보존하고 분기/칸 입력 및 배율 대조를 추가했다. 사용하지 않던 `peel`·`ARITH_OPS` export를 거뒀다(N1 대응).
- 검사 완료 트리는 별도 worktree에 고정했다. 최종 네 파일 해시가 작업 트리와 같아, 결함 심기 중인 파일을 게이트가 읽지 않게 했다. 원문 해시는 [`r4-gates.json`](evidence/r4-gates.json).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 호출별 해석기 | — |
| 공유 | memo는 파일별이며 모듈 공용 상태가 아님 | P1 다중 파일·실제 트리 통과 |
| 재진입 | 선언 순환은 memo/busy로 종료 | 실제 트리 완주 · 바인딩 입력 통과 |
| 다른 무효화 축 | 해당 없음 — 설정/캐시 lifecycle을 바꾸지 않음 | — |

## [구현자 기입] 구현 보고 (r4)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/scripts/{test-budget-bindings,check-test-budgets,check-test-budgets.test}.mjs` · `app/AGENTS.md` · handoff 보고/증거. `app/src/**`·의존성·워크플로 변경 0 |
| 실행 명령 | lint · typecheck(node/web/test) · `node --test scripts/*.test.mjs` · 두 탐침 · 예산 `--report`/독립 스캔 대조 · doc-inventory · 변경 전후 `clean-host-run.sh … --maxWorkers=2` · mutate.py |
| **관측한 게이트 산출** | lint 0 error / 2 기존 warning · typecheck 3구성 통과 · node **670/670** · 탐침 169/163 불일치 0 · 예산 16 real-git suites ok · deadline 62 대조 차집합 0 · 판정 불가/허용 0 |
| 전체 회귀 | 양쪽 915파일·8,448케이스, 실패 26 동일(added 0 / removed 0). 통과/보류 보고 수는 `r4-gates.json` 원문대로 보존. Linux 기준선이며 변경 관련 새 실패 0 |
| 성능 | 로컬 실제 CLI **10.606s**(Node 24). 설계 시제품의 9.2s 상한 추정보다 높음. 현재 push의 Windows CI 단계 시간은 검증자 확인 대기 |
| V-pair 자기확인 | SELF_PASS 5 / SELF_BLOCKED 0 · NOT_REQUIRED 8. 독립 verify를 선점하지 않음 |
| 강제 지점 전수 | 103/103; sweep 485행. 파일 예산의 기존 고정 목록 차이 1은 위 표에 공개 |
| 블로커 / 역질문 | PLAN_GAP 없음. Windows CI·AC18 사람 실기·Linux 기준선 제약은 남김 |
| 대상 커밋 | `(r4 구현 — 좌표는 INDEX)` |

| AC | 자기보고 | 이번 턴 관측 / 직접 좌표 |
|---|---|---|
| AC1 | ✅ | test-time config 예산 + vitest '케이스 예산은 기준값 × 배율이다' 통과 |
| AC2 | ✅ | config import의 hook/test 1·3·5 배율 단언 통과, M1 red |
| AC3 | ✅ | waitFor 네 갈래 통과 · 실제 기본 1초 초과 재시도 배선 통과, M2 red |
| AC4 | ✅ | 잘못된 배율 config/vitest 실패 테스트 통과 |
| AC5 | ✅ | EP03 20자리 각각 wrapper 제거 red, report 21 중 기존 고정 목록 20 대조 |
| AC6 | ✅ | EP04 6자리 각각 리터럴 복귀 red |
| AC7c | ✅ | 예산 24 + 의미 38, 독립 스캔 대조 0줄 |
| AC7f | ✅ | 169·163 입력 불일치 0, 칸 91/입력 332 sweep 좌표 |
| AC8 | ✅ | test-time 픽스처 상수 단언 · M6/KILL/RM red |
| AC9 | ⚠️ | 워크플로 단위 테스트 통과; 이번 push의 Windows CI 대기 |
| AC10 | ✅ | test-host 순수 테스트 통과, 관련 코드 diff 0 |
| AC11 | ✅ | test-environment 배선 8케이스 통과 |
| AC12 | ⚠️ | 기존 Linux bootstrap.native-history 실패가 합성 호스트 자식에 재현됨. 전후 동일 |
| AC13 | ⚠️ | AC12의 exit 단언이 먼저 실패하여 사후 HOME 단언 미도달 |
| AC14 | ✅ | worktrees/service 전체 실행 통과, 관련 코드 diff 0 |
| AC15 | ✅ | 배포 소비 경로 diff 0 · 회귀 실패 집합 동일, 기존 verify 좌표 승계 |
| AC16 | ✅ | 실제 전후 newfails added 0 / removed 0 · app/src diff 0 |
| AC17 | ✅ | loopback-callback 전체 실행 통과, 고정 포트 도입 0 |
| AC18 | ⚠️ | 사람 실기 대기 — Windows 백신·디스크 지연 |
| AC19 | ✅ | 기존 운영 문서·워크플로 diff 0, 인벤토리 게이트 통과 |
| AC19c | ✅ | app 가이드의 노드 표·판정 불가 처방·UNRESOLVED_ALLOWED·경계 칸 재확인 |

**합계 검산**: `✅ 17 · ⚠️ 4(AC9·12·13·18) · ❌ 0 = 총 21`. 분모 21 유지. AC12·13은 이번 환경 관측 한계이며 비영향 pair를 실패로 부풀리지 않았다.

## [구현자 기입] Review Signals — 사실만 (r4)

- 같은 축인가: 같다. 이번에는 식 종류를 명시 분류하고 값 자리의 미해석을 red로 남겨, 조용히 자리 없음으로 빠지는 경로를 닫았다.
- 막았어야 할 지침·AC: ΔV4의 칸 표와 fail-closed 계약을 따랐다. M18의 구별 값 규칙은 있었으나 새 KP02가 기존 fixture의 값을 먼저 관측한다는 점은 결함 심기에서 드러났다.
- 반복 환경 한계: Linux native plugin/Windows 경로, opt-in skip, 사내 Windows 백신·디스크 지연 실기. 이번 런타임은 Node 24이며 SQLite를 Node ABI로 맞췄다.
- 현재 라운드·impl 턴: **r4**, 구현자 Codex. 다음은 Claude의 독립 verify다. 이번 사용자 호출 전 review round 41·42와 ΔV3·ΔV4 설계가 완료된 기준선이다.


## [구현자 기입] 설계 리뷰 (r5 — ΔV5)

- 동의 / 그대로 진행: 유효 V는 `V1 + ΔV1~ΔV5`. REQUIRED = VP-12e·01e, REGRESSION = VP-09c·07b·13, NOT_REQUIRED = VP-02~06·08·10·11. 열린 파생 이슈 D7(BLOCKING)·D8(ΔV5 채택)이 이번 턴의 의무다.
- 이견 / 현실성 문제: 1건(선조치) — KD05 정정 규칙의 "원천 식이 없는 선언"에 `declare const { ms }: T`가 도달한다(유효한 TS, tsc 오류 0). §7-F는 for-of·`catch`·매개변수만 적었고 ΔV4 KD03b(`declare` → 경계)를 따르게 했다. 게이트 출력은 같다(숫자 아님과 경계 모두 통과).
- 기준선 재현: `dv5-cells.mjs` 36행 중 불일치 23 · `dv4-cells` 163 · `dv3-branches` 169 불일치 0(구현 전). 수정 후 세 집합 모두 0.

## [구현자 기입] 강제 지점 전수 (§10 대조) — r5

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-07b·09c EP-01 | 전역 케이스·훅 | 2 | 2/2 | 관련 코드 diff 0 · r4 변이 `EP01-*` 재실행 M1 red | 배율 1·3·5 구별 값(`test-time.test.mjs`) | — |
| 같음 EP-02 | waitFor wrapper | 1 | 1/1 | 관련 코드 diff 0 · r4 변이 재실행 M2 red | 네 갈래 입력 | — |
| 같음 EP-03 | 파일 예산 | 20 | 20/20 | `--report` setConfig 21(목록 20 + 기존 hostile 1) · r4 EP03 변이 재실행 20/20 red | 각 파일 `scaledBudget`만 제거 | 검색 21 − 목록 20 = hostile 1(r1부터 보고, 이번 변경 0) |
| 같음 EP-04 | 인라인 예산 | 6 | 6/6 | `--report` case 6 scaled · r4 EP04 변이 재실행 6/6 red | 각 인자 `scaleMs`만 제거 | — |
| 같음 EP-06 | 픽스처 상한·kill·rm | 3 | 3/3 | r4 M6·EP06 변이 재실행 M6·EP06 2 — 3/3 red | 600_000·5_000·200 | — |
| VP-07b·09c EP-05b | 마감 62 | 62 | 62/62 | ΔV2 대조 명령 0줄 · `--report` deadline 62(scaled 24 · semantic 38) · r4 tree 행 62 재실행 62/62 red | 자리마다 그 자리 값만 바꿈 | — |
| VP-12e EP-12e | 판정 9지점 · 칸 94 · 입력 368 | 9 | 9/9 | `check-test-budgets.test.mjs` — ΔV3 describe 169 · ΔV4 describe 163 · ΔV5 describe '노드 종류 표 정정 (0294 ΔV5)' 36 · sweep 구별 입력 3(KD15f2·KM10n·KM10o) · 탐침 3종 불일치 0 | ΔV5 행은 `vc` 측정(위반/판정 불가/칸 ID) | — |
| VP-09c EP-13 | 허용 목록 | 0항목 | 0/0 | `--report` UNRESOLVED·allowed 0행 · `UNRESOLVED_ALLOWED = []` · M61·M61b | — | — |

- 대상 강제 지점 **103/103** = EP-01~04·06 32 + EP-05b 62 + EP-12e 9 + EP-13 0. 나머지 35는 NOT_REQUIRED pair의 자리(관련 코드 diff 0).
- 전칭 검산: ΔV5 입력 36 − UT 케이스명에 ID가 있는 행 = 0(`grep -c` 36/36) · 탐침 3종 불일치 0 · 대조 명령 양방향 0줄. `app/src/**` diff 0.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-12e | REQUIRED | SELF_PASS | ΔV3·ΔV4·ΔV5 describe 케이스(ID별) | M53~M60 전부 red · r4 승계 변이 r4 spec 439 = red 375 · green 64 — r4에서도 green 61(탐색 변이 · 대조 Y2b·M52-1) + `occ` 이동 3(C061·C080·C115 — 보정 재실행 C061r·C080r·C115r red). sweep·선택 표가 인용한 변이 244 전부 red 또는 기대 green |
| VP-09c | REGRESSION | SELF_PASS | 실제 CLI exit 0 · 대조 0줄 · UNRESOLVED 0 | M61 red(`판정 불가 KD15`) · M61b 등록 → exit 0 / count 2 → exit 1 · ΔV4 M51·M52 재실행 M51 red · M52 count 1 exit 0 / 2 exit 1 |
| VP-07b | REGRESSION | SELF_PASS | EP-01~06 행 | M5b 24 재실행 tree scaled 24/24 red |
| VP-01e | REQUIRED | SELF_PASS | AC 표 좌표 · VP-12e·09c 조합 | 하위 root 실패 0 |
| VP-13 | REGRESSION | SELF_PASS(조건부) | `git diff --stat 0f032e4..HEAD -- app/src app/vitest.config.ts app/scripts/{vitest-setup,test-time,test-host}.mjs app/package.json .github` 0줄 · Windows CI는 push 뒤 검증자 확인 | not selected |
| VP-02~06·08·10·11 | NOT_REQUIRED | — | 이전 verify 좌표 승계, 관련 코드 diff 0 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 — r5

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M53 KD05 빈 후보 → 숫자 아님 | ΔV5 등록 · verify r4 K1 인용 | 못 잡음(r4 K1) | KD05b·c·d·e·h·i 6 | 잠김 |
| M54a·b catch·for-of 칸 ID → KM08 | ΔV5 등록 | 신규 | KD05h 1 · KD05d 1 | 잠김 |
| M55 KD15 제거 · M56 KD15↔KD02 칸 ID | ΔV5 등록 | 신규 | KD15a~e 5 · 5 | 잠김 |
| M57a·b KM10 후보 제거 | ΔV5 등록 | 신규 | this 3(KM10a·c·d) · 객체 5(KM10f~j) | 잠김 |
| M58 소유 대조 · M59 클래스 대조 제거 | ΔV5 등록 | 신규 | KM10l 1 · KM10e 1 | 잠김 |
| M60a·b KM11 제거 | ΔV5 등록 | 신규 | this 2(KM11a·d) · 객체 2(KM11b·c) | 잠김 |
| M61 트리 KD15 · M61b 허용 등록 | ΔV5 등록 | 신규 | 실제 CLI exit 1 + 문구 `판정 불가 KD15` · 등록 count 1 exit 0 · count 2 exit 1 | 잠김 |
| verify r4 Q1~Q4·Q8·Q9 | D7·D8 인용 | 못 잡음 | `verify-r4-probes.mjs` 13 불일치 0 | 잠김 |
| ⑦ sweep — ΔV5 44행(입력 36 · 구별 입력 3 · 칸 5) | 이번 턴 | 신규 | [`r5-sweep.tsv`](evidence/r5-sweep.tsv) 44행 전부 red — 새 코드 분기 변이 S-* 21(red 19 · 동치 2) · 대조 행 변이 X-* 6 red | 잠김 |
| ⑦ sweep — r4 승계 485행(spec 439) | ΔV3·ΔV4 열거 · 선택 증거 | r4 red 370 · green 69 | r4 spec 439 = red 375 · green 64 — r4에서도 green 61(탐색 변이 · 대조 Y2b·M52-1) + `occ` 이동 3(C061·C080·C115 — 보정 재실행 C061r·C080r·C115r red). sweep·선택 표가 인용한 변이 244 전부 red 또는 기대 green | 덮개 회귀 0 |

- **동치 2**: `S-KD05-noorigin`(원천 없는 선언 → red) — 도달 입력 `declare const { ms }`는 이번 턴에 KD03b로 먼저 빠지고, `let { ms }`는 tsc TS1182 오류라 typecheck:test가 먼저 막는다. `S-KM10-obj-notthis`(객체 분기의 `this` 제외 제거) — `sources(this)`는 `this` 노드 자신이라 객체 리터럴 소유와 겹치지 않는다. 대표 입력 4개의 판정이 원본·변이 상태에서 같았다(`[]` ×4).
- **sweep 중 보강**: 구별 입력 3개를 UT에 더했다 — KD15f2(다른 변수 증감 → `S-KD15-scope`), KM10n(같은 클래스 다른 키 → `S-KM10-key-this`), KM10o(같은 클래스 안 객체 멤버 대입 → `S-KM10-this-only`). 앞의 셋은 처음에 실제 저장소 테스트로만 잡히거나 green이었다.
- 구문 오류로 난 red 3개(`S-KD15-prop`·`S-KM11-patmember`·`S-KM11-incdec`, 첫 spec)는 잠금으로 세지 않고 `void 0` 치환으로 다시 심어 각각 KD15e·KM11c·d · KM11c·d · KM11b로 잡았다.
- **분모 검산**: 선택 증거 95(ΔV5 M53~M61b 13 + r4 승계 82) · 인용 변이 25(r4 승계 18 + verify r4 K1 = M53 · 탐침 Q1~Q4·Q8·Q9 6) · 새 oracle 0 · sweep 529(r4 485 + ΔV5 44) = 추적 행 649. 원문: [`evidence/r5-mutations.jsonl`](evidence/r5-mutations.jsonl) · [`evidence/r5-mutation-results.tsv`](evidence/r5-mutation-results.tsv).
- 재현: `cd app && python3 ../.agents/skills/handoff-verify/scripts/mutate.py ../docs/handoff/0294-slow-runner-hermetic-tests/evidence/r5-mutations.jsonl --cwd .` — 끝난 뒤 `git status` 원복 확인.

## [구현자 기입] Product/UX 파생 검토 — r5

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문자열·상태에 소비자가 있는가 | 위반 문구에 `판정 불가 KD15: 증감·구조 분해 대입 변수`·`KM11: 복합·증감·구조 분해 대입 멤버` — 소비자 = 테스트 작성자·CI 로그. ΔV5 UT `vc`가 칸 ID를 단언 | — |
| 새 실패 경로는 어느 계약인가 | §7-E Product & UX 행 "값 자리가 red 칸에 닿음"과 같은 행(칸만 늘었다) | — |
| 조용한 실패인가 | M61 실제 CLI exit 1 · 등록 뒤 exit 0 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r5

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `declare const { ms }: T`(유효 TS)가 KD05 "원천 없는 선언"에 도달 — §7-F가 칸을 적지 않음 | 선조치 — ΔV4 KD03b(`declare` → 경계)로 보냄. 게이트 출력 불변 | tsc a.ts 오류 0 · 탐침 `[]` |
| 2 | 멤버 대입 후보 대조가 `sources()`를 매 읽기마다 부른다 — 파일당 대입 수 × 멤버 읽기 수 | 측정 — 실제 CLI 시간 5.27s(r4 5.25s) | 트리 exit 0 |
| 3 | 중첩 함수(`function`) 안의 `this.x =`도 바깥 클래스 대입으로 센다(`this`는 다를 수 있다) | 보고만 — 과잉 판정 방향이고 트리 0. §7-F L13 경계와 같은 축 | — |

### 설계 대비 명시적 차이

- 메커니즘 대체 없음. 위 #1(KD03b) 한 가지 — 게이트 관측은 같다.
- verify r4 N2(반환 객체의 외부 소비 0 API)는 거두지 않았다 — 이번 범위의 칸과 무관.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 호출별 해석기 | — |
| 공유 | `memberWrites`·`unresolvedVariables`는 `createBindings` 지역(파일별) | P1 다중 파일 · 실제 트리 통과 |
| 재진입 | `classify` memo가 순환을 끊는다 — 멤버 대입 우변이 같은 멤버를 읽어도 종료 | 실제 트리 완주 · UT 576 |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r5)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/scripts/{test-budget-bindings,check-test-budgets,check-test-budgets.test}.mjs` · `app/AGENTS.md` · handoff 보고·증거. `app/src/**`·의존성·워크플로 변경 0 |
| 실행 명령 | lint · typecheck · `node --test "scripts/*.test.mjs"` · 탐침 3종 · `verify-r4-probes.mjs` · 예산 `--report`·대조 · doc-inventory · mutate.py |
| **관측한 게이트 산출** | lint 0 error / 2 기존 warning · typecheck 3구성 exit 0(`error TS` 0) · node **709/709**(31 suites) · 탐침 169·163·36 불일치 0 · `verify-r4-probes.mjs` 13 불일치 0 · 예산 exit 0 '16 real-git suites ok' · 대조 0줄 · UNRESOLVED 0 · doc-inventory links ok |
| 전체 회귀 | vitest 전체는 이번 환경에서 돌리지 않았다 — vitest가 읽는 파일 diff 0줄(VP-13 행). Windows CI는 push 뒤 검증자 확인 |
| 성능 | 실제 CLI 5.27s(Node 22) |
| V-pair 자기확인 | SELF_PASS 5 / SELF_BLOCKED 0 · NOT_REQUIRED 8 |
| 강제 지점 전수 | 103/103 · sweep 529행 |
| 블로커 / 역질문 | PLAN_GAP 없음. AC18 사람 실기 그대로 |
| 대상 커밋 | `(r5 구현 — 좌표는 INDEX)` |

| AC | 자기보고 | 이번 턴 관측 / 직접 좌표 |
|---|---|---|
| AC1·AC2·AC3 | ✅ | node 테스트 709/709 통과(`test-time.test.mjs` 포함) · 관련 코드 diff 0 |
| AC4 | ✅ | `test-time.test.mjs` '배율 해석' 통과 · diff 0 |
| AC5·AC6 | ✅ | `--report` setConfig 21 scaled · case 6 scaled |
| AC7c | ✅ | 대조 0줄 · deadline 62 = 24 + 38 |
| AC7g | ✅ | 368행 UT + 탐침 3종 불일치 0 · M53~M60 red |
| AC8 | ✅ | `test-time.test.mjs` 픽스처 상수 단언 통과 |
| AC9 | ⚠️ | Windows CI는 push 뒤 — 검증자 확인 |
| AC10~AC13 | ✅ | 관련 코드 diff 0 · 직전 Windows CI run 41974447156 Test success 좌표 승계(같은 `app/src`) |
| AC14·AC15·AC17·AC19 | ✅ | 관련 코드 diff 0 · 인벤토리 `--check` ok |
| AC16 | ✅ | VP-13 행(vitest 입력 diff 0) |
| AC18 | ⚠️ | 사람 실기 대기 |
| AC19d | ✅ | `app/AGENTS.md:150` — `§7-E·§7-F` · "멤버(`this`·객체) 대입" · "증감·구조 분해 대입으로 바뀌는 변수·멤버는 **판정 불가**" · 인벤토리 ok |

**합계 검산**: `✅ 19 · ⚠️ 2(AC9·AC18) · ❌ 0 = 총 21`. 분모 21 유지(AC7f → AC7g · AC19c → AC19d).

## [구현자 기입] Review Signals — 사실만 (r5)

- 같은 축인가: 같다 — "판정이 D-018 주어보다 좁다". 이번에는 표에 없는 결과를 낸 분기 1(D7)과 대입 경로 칸 3(D8 채택)을 닫았다.
- 막았어야 할 지침·AC: ΔV4 "값 자리 fail-closed"와 KD05 "후보마다 KV"가 있었고, r4 구현의 빈 후보 폴백이 그 문장을 어겼다(UT 입력 칸이 원천 종류를 열거하지 않았다).
- 반복 환경 한계: AC18 사람 실기 · 이번 턴 vitest 전체 미실행(Windows CI 의존).
- 현재 라운드·impl 턴: **r5**, 구현자 Claude. 다음 verify는 ΔV4 창 2회째(마지막 확장 창).

## [구현자 기입] 설계 리뷰 (r6 — ΔV6)

ΔV6 READY 입력을 현재 트리와 대조했다 — `dv6-cells.mjs app` 칸 입력 43 · 판정 불일치 27(설계 §7-G 관측과 같다). 설계 문장과 충돌하는 곳은 없다. 구현은 설계 "원천 멤버 판정 한 함수 공유"를 `memberTerminals`로 옮겼다. **설계 대비 차이**: 빈 후보 폴백(`emptyDestructuring`)을 기본 경로로 두지 않고 원천별 판정(`judgeOrigin`)을 기본으로 했다 — 중첩 패턴의 원천 없음만 폴백에 남는다. 칸 ID·기대·§10 자리는 그대로다.

## [구현자 기입] 강제 지점 전수 (§10 대조) — r6

| 지점 | §10 자리(분모) | 닫음 | 남긴 곳 | 직접 oracle 좌표 |
|---|---|---|---|---|
| EP-12f (칸 94 · 입력 411) | 411행 = dv3 169 + dv4 163 + dv5 36 + dv6 43 | 411 | 0 | `dv3-branches`·`dv4-cells`·`dv5-cells`·`dv6-cells` 판정 불일치 각 0 · `check-test-budgets.test.mjs` 노드 종류 표 정정 (0294 ΔV6) 43행 |
| EP-13 판정 불가 허용 | 0항목 | 0 | — | `node scripts/check-test-budgets.mjs --report` UNRESOLVED 0 |
| EP-05b (62자리) | 62 | 62(변화 없음) | 0 | `--report` 90행 — HEAD 와 바이트 동일(md5 `553a99ce9e814450614af2756d3d490b`) |

- 자리 검색 차집합: 입력 411 행의 `vc` 가 기대와 같다 → 목록 밖 운반 자리 0. 목록 미고정 pair 없음.
- 정정 칸 5개(KD05 · KD01 · KD02 · KD15 · KM11 · KM08 · KM10)는 칸 행마다 기대가 있다(43행 중 27행이 r6 전 불일치 → 0).

## [구현자 기입] 이번 라운드 수정의 잠금 — r6

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M62 요소 후보가 있으면 원천 생략(r5 동작) | ΔV6 등록 | 신규 — 첫 정의(요소 자신의 대입 기준)는 green이라 무효 → 정의를 고쳐 red 재측정 | KD05n · o · p 5 | 잠김 |
| M63 원천 리터럴 혼합 → KM02 | ΔV6 등록 · verify r5 K2 축 | 신규 | KD05l · m · n 등 6 | 잠김 |
| M64 쓰기 우변 제거(읽기·구조 분해 공통) | ΔV6 등록 | 신규 | KM10f · g · h 등 9 | 잠김 |
| M65 KD02·KD15 제거 | ΔV6 등록 | 신규 | KD15h · KD02b · KD15j 3 | 잠김 |
| M66a 매개변수 대입 우변 제거 · M66b 요소 대입 우변 제거 | ΔV6 등록 | 신규 | KD01b · KD01e 2 · KD01c · KD01d 2 | 잠김 |
| M67 for-of·for-in 머리 대입 표시 제거 | ΔV6 등록 | 신규 | KD15m · n · o 4 | 잠김 |
| M68 KD02·KD15를 KD13·KD04보다 먼저(이웃 칸 ID 맞바꿈) | ΔV6 등록 | 신규 | KD13b · KD04b 2 | 잠김 |
| M69a · M69b 소유 대조 완화(같은 함수·같은 패턴) | ΔV6 등록 | 신규 | KD15k 1 · KD15l 1 | 잠김 |
| M70 KD15 원천 사슬 끊기 제거 | ΔV6 등록 | 신규 | KM08b 1 | 잠김 |
| M71a 트리에 매개변수 증감 자리 추가 | ΔV6 등록(VP-09c) | 신규 | 게이트 exit 1 · 판정 불가 KD15 | 잠김 |
| M71b 같은 자리 + UNRESOLVED_ALLOWED 등록 | ΔV6 등록 | 신규 | 게이트 exit 0(기대 일치) | 확인 |
| r5 spec 71행 재실행 | verify r5 ④ | red 53 · 기대 일치 | — | 아래 표 |

**r5 spec 재실행 (④)**: 71행 중 red 일치 53 · 재앵커 16 · 동치 판정 2(S-KD05-literal · S-KD05-noorigin) — 나머지 `S-KM10-obj-notthis`는 r5 verify가 동치로 판정한 행이고 이번에도 green이며 alias 입력(`const t = this`)으로 재확인했다(같은 결과).
- 재앵커 16행(`r6-reanchor-results.tsv`): R6-M53 · M54b · S-bound · S-red · S-param · X-KD05j · X-KD15g · C120r(a·b) · S-KM10-key-this · this-only · key-obj · M57a · M57b → red 일치. 기존 green이던 `C081r`·`C108r`은 r4 원 spec에서도 green이던 행이다(verify r5 설명 유지).
- 재앵커 과정에서 잡은 것: 원천 판정 경로를 바꾸면서 r5 행의 `occ` 위치와 앵커가 옮겨 SKIP 7 · 구 위치 green 11이 생겼다. 신규 경로에 같은 의미의 변이를 다시 심어 판정했다.
- 신규 잠금 입력 4개(`KM07b` 경계 원천 · `KM08e` 함수 참조 원천 · `KD05y2` 매개변수 원천 여러 호출 · `KD05w2` 구조 분해 매개변수의 멤버 읽기) — 재앵커한 red 중 R6-S-bound · S-red · S-param · X-KD05j를 잡는다.

검산: 등록 변이 행 11(M62~M70 · M66·M69 분할) + 게이트 2(M71a·b) + 재앵커 16 + r5 재실행 71 = 표 행 T. 새 oracle 4(위 KM07b · KM08e · KD05y2 · KD05w2) · 선택 증거 pair 1(VP-12f).

## [구현자 기입] 놓친 잠재 문제 + 대응 — r6

- 재진입: `classifyMemo` 순환 차단은 기존 그대로다. 순환·자기 참조 입력 6종(`const {ms} = {ms: ms}` · `o = o.a` 순환 구조 분해 · 기본값 호출 · `this` 자기 대입 · 매개변수 자기 대입 · for-of 자기 참조)을 `r6-cycle-probe.mjs`로 돌려 예외 0.
- 설계 대비 차이 축(만료·공유·재진입·다른 무효화): 순수 정적 분석이고 메모는 `createBindings` 호출마다 새로 만든다 → 공유 상태 없음 → 해당 없음. 재진입은 위 probe로 확인.
- 판정이 엄격해진 입력(매개변수·구조 분해 원천의 여러 호출 중 호출 결과)은 이제 판정 불가 위반으로 막힌다. 현재 트리 영향 0(`--report` 동일).

## [구현자 기입] Product/UX 파생 검토 — r6

- 사용자 대면 문자열·칸 ID·허용 목록 문구 변화 없음. 칸 94 그대로.
- 게이트 소비자(테스트 작성자) 관점: 새 판정 입력은 판정 불가 문구를 그대로 쓴다(`UNRESOLVED_LABELS` 불변).
- 범위 밖 파생 이슈: 없음.

## [구현자 기입] 구현 보고 (r6)

- 변경 파일 3: `app/scripts/test-budget-bindings.mjs`(+103 −37) · `app/scripts/check-test-budgets.test.mjs`(ΔV6 43행 + r6 잠금 4행) · `app/AGENTS.md`(AC19e 한 문장 — `§7-G` 참조와 "변수" 정의).
- gate 관측: `npx eslint` exit 0 · `node scripts/check-test-budgets.mjs` exit 0 · `node --test scripts/check-test-budgets.test.mjs` 623/623 · `node --test "scripts/*.test.mjs"` 756/756 · `check-doc-inventory.mjs --check` exit 0.
- prettier: `app/AGENTS.md`는 HEAD에서도 `--check` 실패(사전 존재). 형식 일괄 재작성은 하지 않았다.
- 미실행: vitest 전체(`src/**` 무변경)·Electron 빌드(ABI 차단 환경). 최종 확인은 Windows CI(AC9).
- AC: ✅ 19 · ⚠️ 2(AC9 · AC18) · ❌ 0 = 총 21. AC7h = dv6 411행 · AC19e = `app/AGENTS.md:150`.
- 대상 커밋: (r6 구현 — 검증자 기입)

## [구현자 기입] Review Signals — 사실만 (r6)

- 같은 축인가: 같다 — 구조 분해 값을 원천 멤버마다 판정하지 않던 것이 r5·r6 연속 발견. 이번에는 읽기와 구조 분해가 `memberTerminals` 한 함수를 쓰게 해 축 자체를 없앴다.
- 막았어야 할 지침: D-019 "원천 멤버 = 원천 식의 KM 판정"과 r5 구현의 "후보가 있으면 생략"이 어긋났다(D10).
- 반복 환경 한계: 변이의 `occ`·앵커가 구현 경로에 묶여 있어 경로를 바꿀 때마다 재앵커가 필요하다(r5 SKIP 7).
- 현재 라운드·impl 턴: **r6**, 구현자 Claude. 다음 verify는 6회째(창 밖 — 이행·현재 결함만 막는다).


## [구현자 기입] 설계 리뷰 (r7 — ΔV6 이행 결함)

동의 / 그대로 진행. 유효 V는 `V1 + ΔV1~ΔV6`이며 REQUIRED는 VP-12f·01f, REGRESSION은 VP-09c·07b·13이다. review round 43의 r6 판정 정정을 적용해 D9·D12~D16을 처리하고, E1~E4는 후보 표에 둔다.

- 기준선: G01~G10의 18입력은 수정 전에도 불일치 0이었다. 이번 변경은 `check-test-budgets.test.mjs`의 단언 18개이며 해석기·제품 코드·Decision·AC·V·§10 규범 행은 변경하지 않았다.
- 불변식: 원천 후보의 순서·배열/객체 패턴·기본값 유무·중첩 깊이가 달라도 §7-G가 정한 같은 값은 같은 판정을 받고, 해당 분기를 없애면 테스트가 실패한다.
- 이견 / 현실성 문제: 없음. r6 탐침 G08~G10의 이슈 번호 `D16`은 검증 판정 표의 `D15`로 표기했다(입력·기대는 동일).

## [구현자 기입] 강제 지점 전수 (§10 대조) — r7

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-07b·09c EP-01 | 전역 케이스·훅 | 2 | 2/2 | `scripts/test-time.test.mjs:케이스·훅 예산 = 20_000 × 배율, setup 파일을 건다`; M1 red | 배율 1·3·5의 test/hook 각각 | — |
| 같음 EP-02 | waitFor wrapper | 1 | 1/1 | 같은 파일 `waitFor 옵션 네 갈래`; M2 red | 무옵션·숫자·객체 timeout 유/무, interval 보존 | — |
| 같음 EP-03 | 파일 예산 | 20 | 20/20 | `r7-regression-mutation-results.tsv`의 EP03 각 자리 red; gate (F) | 그 자리의 `scaledBudget`만 제거 | 검색 21 − 목록 20 = 기존 hostile 1(r1부터 보고, 이번 diff 0) |
| 같음 EP-04 | 케이스 인라인 | 6 | 6/6 | 같은 TSV의 EP04 6자리 red; gate (F) | 각 `scaleMs` 인자를 리터럴로 복귀 | — |
| 같음 EP-06 | 실-git 상한·kill·rm | 3 | 3/3 | `test-time.test.mjs:상한·kill 유예·rm 재시도 간격이 기준값 × 배율이다`; M6·EP06-KILL·EP06-RM | 600_000·5_000·200을 따로 관측 | — |
| VP-07b·09c EP-05b | 테스트 소유 마감 | 62 | 62/62 | gate의 deadline 62 = 독립 스캔 62, 파일:줄·형태·값 양방향 차집합 0줄; EP05-01~62 red | scaled 24 · semantic 38 | — |
| VP-12f EP-12f | P1~P9 · 칸 94 · 고정 입력 411 | 9 | 9/9 | `check-test-budgets.test.mjs` 641/641; dv3·dv4·dv5·dv6 불일치 각 0 | 원문 169+163+36+43 · 이번 G 입력 18 | — |
| VP-09c EP-13 | 판정 불가 허용 목록 | 0항목 | 0/0 | `--report` UNRESOLVED/allowed 0; M71a red, M71-1 green, M71-2 red | 같은 파일·KD15의 count 1/2 구별 | — |

- 분모는 **103자리** = EP-01·02·03·04·06의 **32** + EP-05b 62 + EP-12f 9 + EP-13 0이다. r6 verify의 "34자리"는 같은 목록의 산술 오기이며 2+1+20+6+3=32로 보고한다.
- 기존 고정 입력 411과 추가 입력 18을 구분한다. 추가 입력은 기존 규칙 칸의 이행이며 규범 행·AC 분모 21은 그대로다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-12f | REQUIRED | SELF_PASS | 위 EP-12f + G01~G10, M62~M70, 원천별 diff sweep | D9·D12~D15의 인용 변이 5개 red |
| VP-09c | REGRESSION | SELF_PASS | gate exit 0, 독립 스캔 대조 0줄, KA·M71 count 분기 | Windows 현재 head 결과는 아래 AC9에 별도 남김 |
| VP-07b | REGRESSION | SELF_PASS | EP-01~06 위 행, `test-time.test.mjs` | 예산 자리별 변이 재실행 |
| VP-01f | REQUIRED | SELF_PASS | AC1~8 단위·배선·게이트, VP-12f·09c | 하위 구현 결함 0 |
| VP-13 | REGRESSION | SELF_BLOCKED | 제품·vitest 입력 경로 diff 0, 로컬 전체 실행은 아래 관측 | 현재 head의 Windows CI 확인 대기 |
| VP-02~06·08·10·11 | NOT_REQUIRED | — | 이전 verify 좌표 승계; 이번 경로 diff 0 | — |

## [구현자 기입] 이번 라운드 수정의 잠금 — r7

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| sv39 마지막 원천만 판정 | D9 · KD05 "원천 후보마다" | green | G01·G01m·G02·G03·G03m, fail 5 | 잠김 |
| sv17 구조 분해 요소의 대입 우변 원천 제거 | D12 · KM10 | green | G04, fail 1 | 잠김 |
| sv28 배열 패턴 키 제거 | D13 · KD05 배열 × KM10·KM11 | green | G05·G06, fail 2 | 잠김 |
| sv14 후보가 있어도 KD08 경계로 반환 | D14 · KD05 기본값 | green | G07, fail 1 | 잠김 |
| C035 중첩 원천 분기 제거 | D15 · 덮개 회귀 | r5 red → r6 green | G08·G09·G10, fail 3 | 잠김 |
| C108r@r6occ3 KD08 경계 → red | D14 구별 입력 | green | G07c, fail 1 | 개선 — 의도한 green 대조도 과잉 판정을 잡음 |
| M62~M70 (M66·M69 분할) | ΔV6 선택 증거 | red | `r7-diff-mutation-results.tsv` 11행 | 유지 |
| r6 diff 자리 제거·형제 맞바꿈 | §7-G 정정 칸 sweep · D16 | 분기 4곳 미잠금 | 같은 TSV의 sv01~sv39 및 분할 행 | 아래 분류대로 기록 |
| R7-KM10-swap | KM10 후보 ↔ KM11 red | 신규 | KM10f·g·h 등 fail 12 | 잠김 |
| r6 재앵커 16행 | 이전 경로의 같은 종류 고장 | red 14 · 동치 2 | 같은 TSV의 R6-* | 원문과 새 경로를 구분 |
| C080·C122·키 없는 리터럴 재앵커 | 전위 단항 KV16 · 멤버 읽기 KM07 | 옛 occ가 다른 분기로 이동 | `r7-reanchor-mutation-results.tsv` | 옛 위치의 green은 E1/기존 설명 유지 |
| r6 `잡음` 306행 | 기존 sweep·선택 증거 | red | `r7-regression-mutation-results.tsv` | 전체 oracle 재확인은 control 표 참조 |
| M1·M2·S-KD15-scope·M52-1·M71a·M71-1/2 | 선택 증거·허용 목록 대조 | — | `r7-control-mutation-results.tsv` | 자식 프로세스 허용 환경에서 확인 |

- ΔV6 정정 칸의 제거/맞바꿈: KD05 = sv13·sv32 / M63·sv35; KD01/02/15 = sv12·sv15·sv07~10 / sv07b~10b·M68; KM11 = R6-C120r-a/b / sv21·sv21b; KM08 = R6-S-red / sv35; KM10 = sv17·sv26 / R7-KM10-swap. 잡은 ID는 TSV의 요약 열에 있다.
- `emptyDestructuring` 잔여 경로의 K2 원문·계산 키·나머지 요소와 소유 대조 입력(E1·E3)은 이번 의무가 아니다. 의도한 green·동치와, 반드시 red여야 하는 이행 행을 구분했다.
- 최종 물리 실행/분모 검산: 선택 증거 18(ΔV6 11 + control 7) · 인용 변이 5 · 새 구조 oracle 0 · sweep/승계 371(나머지 diff 62 + 승계 306 + 재앵커 3) = **추적 표 394행**([r7-locks.tsv](evidence/r7-locks.tsv)). 물리 394회 = red 377 · green 17. 좁힌 oracle의 green 1(S-KD15-scope)은 원 oracle 재실행에서 red이고, C108r@r6occ3은 기존 green에서 red로 개선됐다. 다른 green은 선언된 경계·동치·정상 count 대조다..

## [구현자 기입] Product/UX 파생 검토 — r7

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 변경은 Node 테스트의 이름·입력·단언이다 | — |
| 실패·로딩·빈 상태·취소·재시도 | 제품 경로 diff 0; 게이트의 기존 판정 불가·처방·허용 목록 출력 유지 | — |
| 늦은 응답·부분 실패·조용한 실패 | 비동기 제품 코드 변경 0; 변이 실패는 TAP의 케이스명과 exit로 관측 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r7

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 좁힌 mutation 실행 집합에서는 S-KD15-scope를 잡던 CLI 테스트가 빠졌다 | 원 oracle 전체를 control에서 재실행해 red 확인 | `실제 저장소가 계약을 지킨다`, fail 1 |
| 2 | 제한 실행에서 자식 Node가 EPERM으로 시작하지 못하면 CLI 진입·config 테스트의 red가 거짓 근거가 된다 | 표준 scripts gate와 M1·M2를 자식 실행이 허용된 환경에서 재실행 | scripts 774/774; M1·M2의 직접 케이스 red |
| 3 | r6 "중첩 패턴 원천 없음만 폴백" 설명이 틀렸다 | r6 원문을 이력으로 두고 정정한다 — 계산 키·나머지 요소 값도 `emptyDestructuring`에 닿음 | verify r6 계측·E1. 이번 해석기 diff 0 |
| 4 | E1~E4 · N2 · N3 | 기존 비차단 finding 유지; 규범 범위를 늘리지 않음 | INDEX 후보 표·r6 판정 정정 |

### 설계 대비 명시적 차이

메커니즘 대체 없음. G 입력 18개는 r6 probe의 코드·기대를 복사했으며 D15의 이슈 표기만 정정했다. 판정은 생산 검사기의 `analyzeScale`을 직접 호출한다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 타이머·캐시 구현 변경 0 | — |
| 공유 | 해당 없음 — 새 배열은 describe의 읽기 전용 입력, 판정은 호출별 생성 | G 18/18 |
| 재진입 | 해당 없음 — 생산 해석기·memo/busy 변경 0 | 고정 411입력 기대 유지 |
| 다른 무효화 | 해당 없음 — 설정·저장소·배선 변경 0 | 경로 diff 0 |

## [구현자 기입] 구현 보고 (r7)

| 항목 | 내용 |
|---|---|
| 구현 주체 | Codex — 사용자 `handoff-impl 294` 호출로 r7 승계 |
| 변경 | `app/scripts/check-test-budgets.test.mjs` +18케이스; handoff 보고·증거·INDEX. 생산 해석기·제품·의존성·워크플로 변경 0 |
| 정적 gate | lint 0 error · 기존 renderer warning 2, typecheck node/web/test 3종 통과, 변경 테스트 prettier 통과 |
| Node gate | `node --test --test-reporter=tap scripts/*.test.mjs` **774/774**, suites 34; 관련 파일 직접 실행 641/641 |
| 계약 탐침 | dv3 169 · dv4 163 · dv5 36 · dv6 43 · G 18, 불일치 각 0 |
| 예산·문서 | 16 real-git suites ok; report 90행(deadline 62 · setConfig 21 · case 6); UNRESOLVED 0; 독립 스캔 차집합 0줄; doc inventory prose·links ok |
| 전체 앱 회귀 | 전체 8,499: pass 8,063 · fail 341 · skip 95. SQLite ABI 315실패는 Node 재빌드 후 35파일 338/338로 해소; 나머지 26은 변경 전 HEAD의 동일 13파일(145케이스, pass 119 · fail 26)에서 재현했으며 실패 집합 양방향 차집합 0이다. 상세 [r7-gates.json](evidence/r7-gates.json) · [실패 목록](evidence/r7-vitest-failures.json) |
| 남은 확인 | AC9 현재 head Windows CI · AC12/13 Linux hostile 결과 한계 · AC18 사내 Windows 사람 실기 |
| 대상 커밋 | `(r7 구현 — 검증자 기입)` |

| AC | 자기보고 | 이번 턴 관측 / 직접 좌표 |
|---|---|---|
| AC1·AC2 | ✅ | `test-time.test.mjs` config 배율·M1 |
| AC3 | ✅ | 같은 파일 waitFor 네 갈래·M2, 기존 배선 입력 경로 diff 0 |
| AC4 | ✅ | 같은 파일 배율 해석·잘못된 config/vitest 시작 실패; scripts 774/774 |
| AC5 | ✅ | EP03 자리별 wrapper 제거 red; report의 기존 추가 hostile 1은 위에 공개 |
| AC6 | ✅ | EP04 6자리 리터럴 복귀 red |
| AC7c | ✅ | deadline 62 = 독립 스캔, 파일:줄·형태·값 차집합 0줄 |
| AC7h | ✅ | 고정 411·추가 18 기대 일치; D9·D12~D15 인용 변이 red; 정정 칸 sweep |
| AC8 | ✅ | 픽스처 상수 단언; M6·EP06-KILL·RM |
| AC9 | ⚠️ | 워크플로 단위 테스트 통과; 현재 head Windows CI 대기 |
| AC10 | ✅ | `test-host.test.mjs` 키·플랫폼 분기; scripts 774/774 |
| AC11 | ✅ | 기존 test-environment 배선 경로 diff 0; 전체 실행 관측은 위 행 |
| AC12·AC13 | ⚠️ | hostile 자식의 bootstrap.native-history Linux plugin 단언 실패로 exit 0·사후 HOME 불변을 이번 환경에서 닫지 못함. 관련 경로 diff 0이며 r6 CI 좌표는 유지 |
| AC14 | ✅ | worktrees/service 테스트 경로 diff 0; 전체 실행 관측은 위 행 |
| AC15 | ✅ 승계 | 배포 소비·포크 경로 diff 0; r6 verify 좌표 유지 |
| AC16 | ✅ | 제품·전체 vitest 입력 경로 diff 0; 아래 전체 회귀 관측 |
| AC17 | ✅ | loopback-callback 경로 diff 0; 전체 실행 관측은 위 행 |
| AC18 | ⚠️ | 사내 Windows 백신·디스크 지연 실기 대기 |
| AC19·AC19e | ✅ | 기존 문서·노드 표 참조·이름 바인딩 정의 유지, doc-inventory --check prose·links ok |

검산: `✅ 17 · ⚠️ 4(AC9·AC12·AC13·AC18) · ❌ 0 = 총 21`. 분모 21 유지. r6의 충족 수 19에서 AC12/13의 이번 환경 관측 한계 2를 분리했다. `Criteria-Met: 17/21`은 구현자 자기보고이며 독립 verify를 대신하지 않는다.

## [구현자 기입] Review Signals — 사실만 (r7)

- 같은 축: 예 — 규칙 칸이 적은 분기보다 UT 입력이 좁았다. G01~G10 단언 18개가 sv39·sv17·sv28·sv14·C035를 실제로 red로 바꿨다.
- 막았어야 할 지침: §7-G의 "원천 후보마다"·"배열 패턴"·"기본값은 후보"·"구조 분해 요소 대입 우변"·"중첩 포함" 및 impl §3 sweep. 규범 변경은 필요 없었다.
- 반복 환경 한계: 제한 실행의 자식 Node EPERM은 권한 조정 후 해소; 현재 Windows CI·AC18 사람 실기는 남음.
- 라운드·impl 턴: **r7**, 구현자 Codex. review round 43으로 r6 뒤 의무 review는 완료됐으며 다음은 Claude의 독립 verify다.
