# Plan — 0251-remote-usage-breakdown

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> **문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.**
> 같은 세션 요청 2)·3)은 [`0252-work-file-open-feedback`](../0252-work-file-open-feedback/plan.md)로 분리했다 — 서로 다른 하위 시스템이고 합치면 AC가 25건을 넘는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0251-remote-usage-breakdown` |
| 작성자 | Claude Code |
| 일자 | 2026-10-06 |
| 매핑 | — |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0186·0112 동작은 INHERITED 노드로만 참조한다(§7-A) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 원격 사용량 포트 `UsageSnapshot` 은 월 누적 스칼라 3종만 받는다(`fetcher.ts:18-44`). 원격이 일별·모델별 내역을 줘도 `raw` 봉투에 묻혀 provider 당 1행 캐시에 매번 덮어써지고(`usage-queries.ts:209-228`), 어떤 화면도 그 값을 쓰지 않는다.
- 완료 후 달라지는 것: 배포 fetcher 가 일별·월별 내역(전체 + 모델별)을 실을 수 있고, 트래커가 받으면 (provider, 기간[, 모델]) 단위로 DB 에 쌓인다. 기존 화면 — provider 주·월 한도 바(설정·Composer 팝오버), 설정 '사용량' 탭(일별 차트·합계·모델별 내역) — 이 renderer 코드 변경 없이 원격 값이 있는 날짜·월에서 원격 값을 우선해 보여준다.
- 바뀌지 않는 것: 전역 지출 한도 바(로컬만), 로컬 원장, 내역을 주지 않는 배포의 모든 수치, renderer 코드.
- 성공을 한 문장으로: **"원격이 날짜·월별 사용량을 알려주면 그 값이 쌓이고, 지금 있는 사용량 화면이 그 값을 우선해 보여준다."**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "usage fetch 과정에서 일일 사용량, 모델별 사용량도 적용할 수 있도록 필드를 확장해라." | 2026-10-06 세션 요청 1) |
| 명시 요구 | "트래커가 원격 데이터를 받는 경우, 해당 내용이 db에 쌓여야 한다." | 요청 1) |
| 명시 결정 | "Daily/monthly breakdown에 전체 사용량, 모델별 사용량 제공하되 비어있으면 해당 정보는 제공하지 않는 형태가 되어야 한다" | 질의 1 답 |
| 명시 결정 | "화면에서도 표시하되, 표시기능자체는 현재 구현돼있다. 다만 db 업데이트 시 해당 정보들이 fetch 되어 전달되는 경우 우선 저징되는 형태가 된다면 provider 표시는 수정이 핗요없다" (원문 그대로) | 질의 2 답 |
| 명시 결정 | 같은 날짜(·모델) 재수신 → "날짜별 최신값 갱신" | 질의 3 답 |
| 명시 결정 | 원격 우선 범위 → "provider 한도 + 사용량 탭". 선택지 원문: "provider 주·월 한도 바(설정·Composer 팝오버)와 설정 '사용량' 탭의 일별 차트·모델별 내역 모두, 원격이 보고한 (provider, 날짜/월)은 원격 값을 쓴다. 전역 지출 한도 바는 지금처럼 로컬만 본다." | 후속 질의 답 |
| 추론 의도 | "우선 저장" = 원격 값이 있는 (provider, 날짜/월)에서 로컬 집계보다 원격 값이 이긴다. 합성은 Main 이 하고 화면 컴포넌트는 그대로 둔다 | 질의 2 원문 + 후속 질의로 확인 |
| 추론 의도 | 월별 모델 내역은 소비 화면이 없어 저장만 한다 | §8 화면 전수 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `UsageSnapshot` 에 선택 필드 `daily`(일별)·`monthly`(월별)를 둔다. 각 항목 = 기간 키 + `total`(전체 사용량) + `models`(모델별 사용량), 둘 다 선택 | 질의 1 답 | 사용자 | ACTIVE | — |
| D-002 | **비어 있으면 제공하지 않은 것이다.** 필드 생략·`null`·빈 배열·수치가 하나도 없는 항목은 저장하지 않고 0 으로 채우지 않으며 저장된 행을 지우거나 덮지 않는다. 개별 수치의 생략·`null` 은 "미제공"(SQL NULL)으로 저장한다 | 질의 1 답 "비어있으면 해당 정보는 제공하지 않는 형태" | 사용자 | ACTIVE | — |
| D-003 | 트래커가 원격 스냅샷을 받으면(`refreshProvider` 성공) 내역을 DB 에 쌓는다. 기간이 다르면 행이 늘고(이력), 같은 (provider, 기간[, 모델])은 최신 값으로 갱신한다 | 요청 1) + 질의 3 답 | 사용자 | ACTIVE | — |
| D-004 | 같은 기간을 다시 받으면 그 기간의 `total` 행은 최신 보고로 통째 교체하고, `models` 를 실은 기간은 그 기간의 모델 행 집합을 최신 보고로 교체한다(보고에서 빠진 모델 행 삭제). `models` 를 싣지 않은 기간의 모델 행은 그대로 둔다 | D-002·D-003 파생 — "최신값"의 단위를 기간으로 고정 | 설계 | ACTIVE | — |
| D-005 | 표시는 기존 화면이 그대로 한다(renderer 코드 무변경). 원격 우선은 Main 합성이 반영한다 | 질의 2 답 "provider 표시는 수정이 필요없다" | 사용자 | ACTIVE | — |
| D-006 | 원격 우선 적용 범위 = provider 주·월 한도 바(설정 provider 탭·Composer 팝오버) + 설정 '사용량' 탭(일별 차트·합계·모델별 내역). **전역 지출 한도 바는 로컬만 본다** | 후속 질의 답 | 사용자 | ACTIVE | — |
| D-007 | 일 단위 우선: (provider, 날짜)에 원격 `total` 행이 있으면 그 날의 각 수치는 원격 값, 원격이 그 수치를 주지 않았으면(NULL) 로컬 값 | D-006·D-002 파생 | 설계 | ACTIVE | — |
| D-008 | 모델 내역 우선: (provider, 날짜)에 원격 모델 행이 있으면 그 날의 모델 내역은 원격 집합으로 대체한다(로컬에만 있는 모델은 그 날 제외). 원격 모델 행의 미제공 수치는 같은 (provider, 날짜, 모델)의 로컬 값 | D-006·D-002 파생 | 설계 | ACTIVE | — |
| D-009 | provider **월** 바 우선순위: ① 이번 달 원격 월 `total` 비용 → ② 0186 기준선(`baselineApplies`) → ③ 이번 달 원격 일별 비용 합성(D-007) → ④ 로컬 | 기준선을 쓰던 배포의 월 수치를 바꾸지 않으면서, 월 값을 직접 주는 배포는 그 값을 쓴다 | 설계 | ACTIVE | — |
| D-010 | provider **주** 바: 이번 주(이번 달 몫, 오늘까지) 날짜에 원격 일 비용이 하나라도 있으면 그 날짜들의 (원격 ?? 로컬) 합, 없으면 로컬 | D-006 이 0186 U7("주간은 언제나 로컬")을 대체 | 사용자(D-006) | ACTIVE | — |
| D-011 | 저장된 원격 행은 현재 배포가 그 provider 를 `supports()` 할 때만 쓴다(행 존재 ≠ 권위) | 0186 계약 승계 `tracker.ts:141-145` | 0186 | ACTIVE | — |
| D-012 | 로컬 원장(`turn_usage`·`turn_model_usage`)은 원격 데이터로 쓰지 않는다. 합성은 읽기 시점에만 | 0186 승계 `IPC_CONTRACT.md §2.12` | 0186 | ACTIVE | — |
| D-013 | 내역이 형식에 맞지 않으면(키 형식·실재하지 않는 날짜·중복·음수/비유한 수치·비정수 토큰·상한 초과) 그 갱신 전체를 실패시키고 아무것도 쓰지 않는다 | 쌓이는 이력의 무결성 — 잘못된 키로 쌓인 행은 되돌릴 경로가 없다 | 설계 | ACTIVE | — |
| D-014 | 기간 키: `day`='YYYY-MM-DD', `month`='YYYY-MM'. Orca 로컬 날짜 키(OS 타임존, `localDayKey`)와 문자열로 맞춘다. 코어는 타임존을 변환하지 않는다(배포 매퍼 책임) | `shared/usage/stats.ts:38-44` 키 계약 | 설계 | ACTIVE | — |
| D-015 | 월별 모델 내역은 저장만 한다(소비 화면 없음). 월별 `total` 은 이번 달 provider 월 바에만 쓴다. 오늘 이후 날짜·이번 달 이외 월은 표시 합성에서 제외한다 | §8 화면 전수 | 설계 | ACTIVE | — |
| D-016 | `UsageSource` 에 `'remote'`(기간 전체가 원격 보고값)·`'remote-daily'`(날짜별 원격 우선 합)를 더한다 | 0186 출처 정확성 원칙 승계. renderer 소비 0건(§8) | 설계 | ACTIVE | — |
| D-017 | 한 스냅샷 상한: `daily` 400 · `monthly` 120 · 기간당 모델 500 · 저장 행 합 10,000. 넘으면 D-013 실패 | §14 worst-case | 설계 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-017 (신규 handoff).
- 변경된 결정: 없음(handoff 내부). **외부 결정 변경**: 0186 U7·AC8 "`week.source` 는 항상 `'local'`" 와 "원격은 `used` 전체를 대체하지 않는다"를 D-006·D-009·D-010 이 바꾼다 — §16.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0186 "전역은 원격을 보지 않는다"(D-006 이 재확인), 0186 `baselineUsable` fail-closed, `supports()` 게이트(D-011), 로컬 원장 불가침(D-012).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1 · D-002↔AC2·AC6 · D-003↔AC4·AC5 · D-004↔AC5·AC6 · D-005↔AC24 · D-006↔AC13·AC16·AC18 · D-007↔AC14 · D-008↔AC15 · D-009↔AC9 · D-010↔AC10 · D-011↔AC12 · D-012↔AC8 · D-013↔AC3·AC7 · D-014↔AC2·AC10·AC14 · D-015↔AC9·AC14 · D-016↔AC23 · D-017↔AC3. 반대 방향을 요구하는 AC 없음.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 원격 내역은 지금 `raw` 로만 보존되고, 캐시는 provider 당 1행 덮어쓰기라 이력이 남지 않는다 | `0014_provider_usage_report_cache.sql:4-5` PK `provider_key` · `usage-queries.ts:218` ON CONFLICT 덮어쓰기 |
| 이미 충족되는가 | 아니오 — 포트에 일별·모델별 필드 0, 저장 테이블 0 | `fetcher.ts:18-44` · `migrations/` 27개 중 해당 0 |
| 더 작은 해법 | ① `raw` 를 화면이 파싱 → 코어가 응답 형태를 알게 되어 0186 결정(매핑은 배포 소유) 위반, 기각 ② 원격 행을 로컬 원장에 삽입 → D-012 위반, 기각 | `fetcher.ts:12-14` |
| 선행 자료 대조 | 0014 SQL 주석의 "quota/totals/byModel" 은 0183 이전 형상이다 — 현재 봉투는 `{baselineUsable, raw}` | `tracker.ts:192-195` |
| 기존 결정과 충돌 | 0186 U7·AC8("주간은 언제나 로컬")·"원격은 기준선만" 을 사용자 결정 D-006 이 바꾼다. 0186 "전역은 원격을 보지 않는다" 는 유지 | `usage-compose.ts:5-12` · `limits.ts:13-20` |

- 사용자에게 올릴 결정: 없음 — 질의 1~3·후속 질의로 닫았다.
- 코드 조사로 닫은 사실: 일별·모델별을 그리는 기존 화면은 설정 '사용량' 탭 하나다(`UsageTab.tsx:150-168`). provider 탭(`ProviderUsageTab.tsx:114-124`)과 Composer 팝오버(`UsagePanel.tsx:69-70`)는 주·월 바만 그린다. `UsageLimitBar.source` 의 renderer 소비는 0건이다.

## 5. 동작 / 사용자 흐름

```text
[cron usage-fetch(1분) · provider 탭 동기화 버튼]
  → fetcher.fetchUsage → UsageSnapshot(+daily/monthly)
  → 내역 검증 ──실패──▶ 갱신 실패: 쓰기 0 · push 0 · 마지막 반영 값 유지
  → 한 트랜잭션: 0014 캐시 upsert + 기간 total upsert + 모델 집합 교체
  → provider 뷰 합성(원격 우선) → provider delta push → 설정 provider 탭·Composer 팝오버
[설정 '사용량' 탭 열기 · 기간 탭 전환]
  → cost:usageStats → 로컬 + 저장된 원격 일별 행 합성 → 일별 차트·합계·모델별 내역
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 원격이 내역을 줌 | 검증 → 저장(기간별 이력 누적) | provider 바·사용량 탭이 그 날짜·월에 원격 값 |
| 원격이 내역 필드를 생략·빈 배열 | 내역 쓰기 0, 기존 행 유지 | 기존 저장 행 + 로컬로 표시 |
| 같은 날짜 재수신 | 그 날 total 교체 · 모델을 실었으면 모델 집합 교체 | 최신 원격 값 |
| 내역 형식 오류 | 갱신 실패, 쓰기 0, push 0 | 마지막 반영 값 유지 · 수동 동기화면 기존 `usage.refreshFailed` 문구 |
| 배포가 provider 지원 중단(`supports=false`) | 저장 행 무시 | 로컬 + 사용자 한도 |
| fetcher 미주입(기본 OSS 배포) | 원격 경로 없음 | 지금과 동일 |
| 앱 재시작 | 저장 행 유지 | 재조회 없이 원격 우선 표시 |

### 파생 UX / 엣지케이스

- loading / empty: 사용량 탭은 로컬 사용이 없던 날도 원격 행이 있으면 막대가 생긴다. 원격 행만 있고 로컬이 0 인 기간도 "사용 기록 없음" 빈 상태가 아니다.
- cancel / retry / close / restart: 실패는 다음 cron 틱이 재시도한다. 재시작 후 저장 행이 그대로 쓰인다.
- concurrency: cron 과 수동 동기화가 겹쳐도 각각 한 트랜잭션이라 기간 행이 반쪽으로 남지 않는다. 늦게 커밋한 보고가 이긴다.
- 자정 경계: 기존 `refreshBoundary` 가 provider 뷰를 무효화하고, 다시 조회할 때 새 날짜 키로 합성된다.
- 외부환경/폐쇄망: fetch 실패는 기존 행을 지우지 않는다.

## 6. 범위 / 비범위

- **범위**: 포트 타입(`fetcher.ts`) · 내역 정규화 순수 모듈 · 마이그레이션 0028 · `UsageQueries` 저장·조회 · tracker 저장·합성 · provider 합성 확장 · 사용량 탭 합성 순수 모듈 · `UsageSource` 확장 · 문서(가이드 §5-b · `auth.md §8` · `IPC_CONTRACT.md §2.12` · `persistence.md` · inventory) · 배포 예제 테스트.
- **비범위**: renderer 코드(D-005) · 실제 사내 endpoint 매퍼(배포 소유) · 전역 지출 한도의 원격 반영(D-006) · 월별 모델 내역 표시(D-015) · 저장 행 보존 기간·정리 · 사용량 탭 push 갱신(열 때 조회 유지) · `usage.estimateNote` 문구.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 월별 모델 내역 표시 | 아니오 — 행이 쌓여 있어 표시만 붙이면 된다 | 후속 |
| 저장 행 정리 정책 | 아니오 — 연 수천 행(§14) | 후속 |
| **테이블·컬럼 이름** | **예 — append-only 마이그레이션** | 지금 확정(§10) |
| **`UsageSource` 어휘** | **예 — IPC 공개 타입** | 지금 확정(D-016) |
| **포트 필드 이름·키 형식** | **예 — 외부 배포가 구현하는 계약** | 지금 확정(D-001·D-014) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | `UsageSnapshot` 이 선택 필드 `daily?: readonly RemoteDailyUsage[] \| null`·`monthly?: readonly RemoteMonthlyUsage[] \| null` 을 갖고, 항목은 `{day\|month, total?, models?}` 이다. 내역 없는 기존 배포 코드가 수정 없이 컴파일된다 | typecheck + 배포 예제 테스트 2종: 내역을 실은 예제와 내역 없는 기존 예제가 모두 `UsageFetcher` 에 대입되고, 내역 예제의 `fetchUsage` 결과가 `normalizeUsageBreakdown` 을 throw 없이 통과해 total·모델 행을 낸다 | `app/deployment/usage-fetcher.ts` → `bootstrap.ts:613` → `UsageTracker` |
| R-01 | AT-01 / AC2 | 미제공 규칙(D-002): `daily`/`monthly` 생략·`null`·`[]`, `total` 생략·`null`·수치 전부 미제공, 모델 수치 전부 미제공, 걸러낸 뒤 빈 모델 집합 → 해당 쓰기 0. 개별 수치 생략·`null` → NULL 보존(0 아님) | 정규화 단위 테스트 — 입력별 `{totals, modelSets}` 출력 표 | `refreshProvider` → 정규화 |
| R-01 | AT-01 / AC3 | 검증 실패(D-013·D-017): 날짜 키 형식/실재 불가(`2026-02-30`)·월 키 형식(`2026-13`)·같은 배열 안 중복 기간·같은 기간 안 중복 모델·빈 모델명·음수/NaN/Infinity·비정수 토큰·상한 초과 각각 → `UsageBreakdownError` | 정규화 단위 테스트 — 사례마다 throw 단언 + 경계값(상한 정확히 = 통과, +1 = 실패) | 동상 |
| R-02 | AT-02 / AC4 | 내역을 실은 `refreshProvider` 성공 후 0014 캐시 행·기간 total 행·모델 행이 DB 에 있고 값이 스냅샷과 같다(NULL 은 NULL) | 실 SQLite(마이그레이션 적용) + tracker + 가짜 fetcher → 조회 메서드로 행 왕복 단언 | cron `usage-fetch`/`cost:refreshUsage` → `tracker.refreshProvider` → `UsageQueries` |
| R-02 | AT-02 / AC5 | 다른 날짜를 받으면 행이 늘고 앞선 날짜 행은 남는다(이력). 같은 날짜를 다른 값으로 다시 받으면 그 행이 최신 값이 되고 행 수는 그대로다 | 실 SQLite: 스냅샷 A(10-01,10-02) → B(10-02 변경,10-03) → 행 3개 · 10-02=B 값 · 10-01=A 값 | 동상 |
| R-02 | AT-02 / AC6 | 부분 제공(D-004): 뒤 스냅샷이 어떤 기간의 `total` 을 생략하면 저장 total 불변, `models` 를 생략하면 저장 모델 행 불변, `models` 를 실으면 그 기간 모델 집합이 교체된다(빠진 모델 삭제) | 실 SQLite 3단 시나리오 — 각 단계 후 행 집합 단언 | 동상 |
| SD-01 | ST-01 / AC7 | 실패 원자성: 형식 오류 내역 → reject + 캐시 행·기간 행·모델 행 쓰기 0 + push 0. 트랜잭션 도중 DB 쓰기 실패(주입) → 앞서 쓴 캐시 행까지 롤백 | 실 SQLite: 오류 스냅샷 전후 세 테이블 행 비교 + 모델 insert 실패 주입 시 캐시 행 이전 값 유지 | `refreshProvider` |
| AR-04 | IT-04 / AC8 | 내역을 실은 갱신 전후로 `turn_usage`·`turn_model_usage` 행 수가 같다 | 실 SQLite 행 수 비교(0186 AC10 확장) | 동상 |
| R-03 | AT-03 / AC9 | provider 월 바 우선순위(D-009): ①이번 달 월 total 비용 → `source:'remote'`, used=그 값 ②없고 기준선 적용 → `'remote-baseline'`(0186 식) ③없고 이번 달 원격 일 비용 존재 → `'remote-daily'`, used=Σ날짜(원격 ?? 로컬) ④ `'local'` | 합성 단위 테스트 — 네 단 각각 + 인접 단 공존 시 위 단이 이김 | `getProviderUsage` → `composeProviderUsage` |
| R-03 | AT-03 / AC10 | provider 주 바(D-010): 창=[max(주 시작, 월 시작) 날짜, 오늘]. 창 안 원격 일 비용이 있으면 `'remote-daily'`, used=Σ창 날짜(원격 ?? 로컬). 없으면 `'local'`. 오늘 이후·창 밖 원격 날짜는 무시 | 합성 단위 테스트 — 평주·월 경계 주(지난달 원격 날짜 무시)·미래 날짜 | 동상 |
| R-03 | AT-03 / AC11 | 예산·`budgetSource`·`configuredLimitUsd` 는 내역 유무와 무관하게 0186 규칙(원격 한도 ?? 사용자 한도) | 합성 단위 테스트 — 내역 有/無 × 원격 한도 有/無 | 동상 |
| AR-03 | IT-03 / AC12 | `getProviderUsage` 는 `supports()===true` 일 때만 원격 행을 읽는다. 미지원·fetcher 미주입이면 원격 기간 조회 0회·로컬 일별 조회 0회. 지원이면 기간 비용 조회 1회, 원격 일 비용이 있을 때만 로컬 일별 조회 1회. 기존 경계 집계는 언제나 1회 | tracker 단위 테스트(가짜 DB 호출 수) — 미주입·미지원·지원(일 행 無/有) 4행 | `cost:usage` · 턴 종료 `recordAndBroadcast` · `refreshProvider` |
| R-03 | AT-03 / AC13 | 종단: 로컬 턴 + 저장 원격 행 + 지원 fetcher → `getProviderUsage(P)` 의 week/month `used`·`source` 가 AC9·AC10 기대값이고, `refreshProvider` 가 push 한 provider delta 가 같은 값이다 | 실 SQLite + 가짜 fetcher 통합 테스트 | `cost:usage` 핸들러(`cost.ts:33`) · `usageEvent` push |
| R-04 | AT-04 / AC14 | 사용량 탭 일별 합성(D-007): 지원 provider 의 원격 total 이 있는 (provider, 날짜)는 수치별 `원격 ?? 로컬`, 나머지는 로컬. provider 없는 로컬 행 포함. 날짜 오름차순·희소. range 하한 이전·오늘 이후 원격 날짜 제외 | 합성 단위 테스트 표 | `usageStats` → `composeUsageStats` |
| R-04 | AT-04 / AC15 | 사용량 탭 모델별 합성(D-008): 원격 모델 행이 있는 (provider, 날짜)는 원격 집합으로 대체(로컬 전용 모델 제외, 미제공 수치는 같은 모델 로컬 값), 나머지 로컬. 모델명별 합산 후 총 토큰 내림차순·이름 오름차순 | 합성 단위 테스트 표 | 동상 |
| R-04 | AT-04 / AC16 | 종단: 로컬 턴 + 저장 원격 행 + 지원 fetcher → `usageStats('7d'\|'30d'\|'all')` 의 `days`·`models` 가 AC14·AC15 기대값이다 | 실 SQLite + 가짜 fetcher 통합 테스트 | `cost:usageStats` 핸들러(`cost.ts:66`) → `useUsageStats` → `UsageTab` |
| R-09 | AT-09 / AC17 | 원격 행이 없거나(미지원 provider 행만 있음 포함) fetcher 미주입이면 `usageStats` 결과가 기존 쿼리(`sumUsageByDaySince`·`sumUsageByModelSince`) 결과와 같고 provider 별 로컬 쿼리 2종은 호출되지 않는다 | 실 SQLite 동등 비교 + 호출 경로 스파이 | 동상 |
| R-05 | AT-05 / AC18 | 원격 행이 있어도 `getGlobalUsage`·턴 종료 전역 delta·`refreshBoundary` 값은 로컬만으로 계산된다 | tracker 테스트 — 원격 행 有/無 에서 전역 값 동일 | `cost:usage`(payload `{}`) · `usageEvent` global/boundary |
| R-08 | AT-08 / AC19 | 내역 없는 배포의 provider 뷰는 0186 결과와 같다 — 기존 `usage-compose`·`tracker`·`jobs` 테스트가 의미 변경 없이 통과한다(호출 계약이 바뀐 가짜 DB 보강은 허용) | 기존 13+28+11 케이스 green + "주간은 언제나 로컬이다" 케이스를 "내역이 없으면" 조건으로 유지 | `getProviderUsage` |
| SD-02 | ST-02 / AC20 | 저장 행은 재시작 후에도 쓰인다 — 같은 DB 위에 새로 만든 `UsageTracker`(지원 fetcher, fetch 0회)가 원격 우선 값을 낸다 | 실 SQLite: 저장 → 새 인스턴스 → `getProviderUsage`·`usageStats` 단언 + `fetchUsage` 호출 0 | 부팅 `bootstrap.ts:617` |
| AR-02 | IT-02 / AC21 | 마이그레이션 `0028_provider_usage_periods` 가 append 되고 append-only 가드·마이그레이션 목록 테스트·인벤토리가 통과한다 | `node scripts/check-migrations-appendonly.mjs` exit 0 · `migrate.test.ts` 목록 · `check-doc-inventory.mjs --check` | CI 게이트 |
| R-07 | AT-07 / AC22 | 배포 문서가 새 계약을 말한다: 가이드 §5-b 매퍼 예제에 `daily`·`monthly`, 의미표에 미제공·교체·날짜 키·상한·실패 행, `auth.md §8` 미제공 규칙, `IPC_CONTRACT.md §2.12` 합성 규칙·타입 블록, `persistence.md` 0028 행. 가이드 예제와 같은 코드가 배포 예제 테스트에 있다 | 문서 grep(표제·키워드) + 배포 예제 테스트(AC1) + inventory 링크 검사 | 배포 구현자 진입점 |
| AR-01 | IT-01 / AC23 | `UsageSource` = `'local' \| 'remote-baseline' \| 'remote' \| 'remote-daily'`, renderer 의 `source` 소비 0건 | typecheck + `rg "\.source\b"` 사용량 소비 파일 0 | `shared/usage/limits.ts` |
| R-06 | AT-06 / AC24 | renderer 코드 무변경(D-005) | 0251 구현 커밋들의 변경 파일 중 `app/src/renderer/**` 0 — `git show --stat <0251 구현 커밋> -- app/src/renderer` 출력 0줄(같은 브랜치의 0252 커밋은 대상 아님) | — |

### AC 검증 주의사항

- 기존 테스트 재사용: `usage-compose.test.ts` 13 `it`(`'주간은 언제나 로컬이다'` :108 실재) · `tracker.test.ts` `'원격 갱신이 로컬 원장을 건드리지 않는다'` :266 실재 · `queries.test.ts` `'provider usage report 왕복'` :764 실재 · `deployment-wiring.test.ts` `'가상 배포 — Usage'` :448 실재 · `jobs.test.ts` 11 `it` 실재 · `tracker.test.ts` 28 `it` 실재.
- 사람 실기 항목: 없음. 기본 OSS 배포는 fetcher 미주입이라(`usage-fetcher.ts:28-31`) 화면 실기 경로 자체가 없다. 화면 컴포넌트는 무변경(AC24)이고, 화면이 받는 값은 cost 핸들러가 부르는 같은 tracker 메서드를 실 SQLite 통합 테스트(AC13·AC16·AC20)가 관측한다.
- N회 기준(AC12): sink 는 `UsageQueries` 메서드다. `getProviderUsage(` 프로덕션 호출부 전수 `rg -n "getProviderUsage\(" app/src --glob '!*.test.ts'` → 5(tracker 3 · `cost.ts` 2). 모두 같은 메서드를 지나므로 호출 1회당 쿼리 수로 단언한다 — 관측 지점(tracker 가짜 DB)이 그 메서드 안의 호출만 모형하고, 호출부 수는 식에 들어가지 않는다.
- 0건 기준(AC23·AC24): 허용 예외 없음. AC23 은 사용량 소비 파일 3개(`settings/`·`UsagePanel.tsx`·`usageStore.ts`) 범위의 `.source` 0건이다.

## 7-A. V / Trace Matrix

- V mode 판정: 사용량 원격 경로에 V 를 가진 plan 이 없다(0186·0112 는 V 이전 템플릿). Baseline V1.
- 기준 V 상속 근거: 없음. 기존 동작은 INHERITED 노드로 출처 커밋을 붙인다 — `0186:plan@8f8fc03c` · `0112:plan@8612614e` (둘 다 `origin/main` 에서 `git cat-file -t` = commit 확인).
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 포트 필드·미제공·검증(AC1~AC3) | NEW | — |
| R-02 | R | §7 저장·누적·부분 제공(AC4~AC6) | NEW | — |
| R-03 | R | §7 provider 바 원격 우선(AC9~AC11·AC13) | NEW | 0186 U7·AC8 을 D-010 이 대체(§16) |
| R-04 | R | §7 사용량 탭 원격 우선(AC14~AC16) | NEW | — |
| R-05 | R | §7 전역 로컬 유지(AC18) | INHERITED | `0186:plan@8f8fc03c` AC9 |
| R-06 | R | §7 renderer 무변경(AC24) | NEW | — |
| R-07 | R | §7 배포 문서(AC22) | NEW | — |
| R-08 | R | §7 내역 없는 provider 뷰(AC19) | INHERITED | `0186:plan@8f8fc03c` AC3~AC8 |
| R-09 | R | §7 원격 행 없는 사용량 탭(AC17) | INHERITED | `0112:plan@8612614e` |
| AT-01~AT-09 | AT | §7 검증 수단 칸 | R 과 같은 provenance | — |
| SD-01 | SD | §5·§13 갱신 수명주기(검증→원자 저장→합성→push) | NEW | — |
| SD-02 | SD | §13 재시작 지속 | NEW | — |
| ST-01·ST-02 | ST | §11 통합 테스트 | NEW | — |
| AR-01 | AR | §10·§15 `UsageFetcher` 포트·`UsageSource` | CHANGED | `fetcher.ts:18-55` · `limits.ts:20` |
| AR-02 | AR | §10 마이그레이션 0028·`UsageQueries` 저장/조회 | NEW | — |
| AR-03 | AR | §10 tracker `supports` 게이트·쿼리 라우팅 | CHANGED | `tracker.ts:140-162·211-220` |
| AR-04 | AR | §10 로컬 원장 불가침 | INHERITED | `0186:plan@8f8fc03c` AC10 |
| IT-01~IT-04 | IT | §11 테스트 | AR 과 같은 provenance | — |
| MD-01 | MD | §10 내역 정규화·검증 | NEW | — |
| MD-02 | MD | §10 provider 합성 우선순위 | CHANGED | `usage-compose.ts:50-89` |
| MD-03 | MD | §10 사용량 탭 합성 | NEW | — |
| UT-01~UT-03 | UT | §11 테스트 | MD 와 같은 provenance | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 배포 `createUsageFetcher` → `UsageFetcher.fetchUsage` → `refreshProvider` → `normalizeUsageBreakdown` | AC1 typecheck·예제 2종 · AC2·AC3 출력/throw 표 | required — 음성 규칙. M1: `[]` 를 "전부 삭제"로 해석 · M2: 미제공 수치를 0 으로 채움 · M3: 중복 날짜 허용(마지막 승) | EP-03 (5) · EP-11 (1) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `refreshProvider` → 정규화 → `saveProviderUsageReport` 트랜잭션 → 세 테이블 | AC4·AC5·AC6 행 집합 | required — M4: total 미제공 기간을 NULL 로 덮음 · M5: 모델 미제공 기간의 모델 행 삭제 · M6: 모델 집합 교체 없이 upsert 만(빠진 모델 잔존) | EP-02 (3) · EP-03 저장 자리 (1) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `cost:usage` → `getProviderUsage` → `providerPeriodCosts`·`sumUsageByDayForProvider` → `composeProviderUsage` → `UsageLimitsView` | AC13 week/month used·source · push 값 동일 | required — 형제 자리: M7 월 ①↔② 순서 맞바꿈 · M8 주 창 하한을 월 시작 대신 주 시작으로 | EP-05 (2) · EP-04 (1) · EP-10 (1) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `cost:usageStats` → `usageStats` → 원격 일 행·모델 행 조회 → `composeUsageStats` → `UsageStats` | AC16 days·models | required — M9: 수치 `원격 ?? 로컬` 을 `원격 ?? 0` 으로 · M10: 대체된 날의 로컬 전용 모델 유지 | EP-06 (3) · EP-04 (1) · EP-10 (1) |
| VP-05 | R-05 ↔ AT-05 | REGRESSION | 턴 종료 `recordAndBroadcast` → `recompute`·`globalView` → global delta | AC18 원격 有/無 전역 값 동일 | required — M11: `globalView` 에 원격 합성 투입 → red | EP-07 (1) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | 정적 | AC24 diff 0 파일 | not selected — 직접 관측 | 0 + 이유: 변경 금지 표면 |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | 문서 → 배포 구현자 | AC22 표제·키워드 + 예제 테스트 | not selected — 직접 관측 | EP-09 (6) |
| VP-08 | R-08 ↔ AT-08 | REGRESSION | 내역 없는 `getProviderUsage` | AC19 기존 케이스 green | not selected — 기존 행동 테스트가 직접 oracle | 0 + 이유: 내역 없음 경로 의미 무변경 |
| VP-09 | R-09 ↔ AT-09 | REGRESSION | `usageStats` 원격 행 0 → 기존 쿼리 경로 | AC17 동등 + 호출 스파이 | required — 구조 proxy(호출 경로) 민감도: M12 원격 행이 없어도 합성 경로로 감 → 스파이 red | EP-08 (1) |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | VP-02 경로 + 실패 분기 | AC7 쓰기 0·push 0·롤백 | required — M13: 정규화를 저장 뒤로 이동 · M14: 트랜잭션 제거(개별 실행) | EP-01 (1) · EP-02 (3) |
| VP-11 | SD-02 ↔ ST-02 | REQUIRED | 저장 → 새 `UsageTracker` → 조회 | AC20 값 + fetch 0회 | not selected — 직접 oracle | 0 + 이유: 영속은 DB 가 보장, 메모리 상태 없음 |
| VP-12 | AR-01 ↔ IT-01 | REQUIRED | 포트 타입 → 배포 예제 → tracker | AC1·AC23 | not selected — typecheck 직접 | EP-11 (1) |
| VP-13 | AR-02 ↔ IT-02 | REQUIRED | `migrate.ts` → 0028 → `UsageQueries` 메서드 7종 | AC4~AC6·AC21 실 SQLite | not selected — 실 DB 왕복이 직접 oracle | EP-02 (3) · EP-12 (2) |
| VP-14 | AR-03 ↔ IT-03 | REQUIRED | `getProviderUsage`·`usageStats` → `supports` → 조회 | AC12 호출 수 표 | required — M15: `getProviderUsage` 의 supports 게이트 제거 · M16: `usageStats` 의 supports 필터 제거 (자리 2) | EP-04 (2) |
| VP-15 | AR-04 ↔ IT-04 | REGRESSION | `refreshProvider` 내역 경로 | AC8 행 수 | not selected — 행 수 직접 | 0 + 이유: 원장 쓰기 호출부 무변경 |
| VP-16 | MD-01 ↔ UT-01 | REQUIRED | 순수 | AC2·AC3 표 | VP-01 M1~M3 공유 | EP-03 · EP-11 |
| VP-17 | MD-02 ↔ UT-02 | REQUIRED | 순수 | AC9~AC11 표 | VP-03 M7·M8 공유 | EP-05 · EP-10 |
| VP-18 | MD-03 ↔ UT-03 | REQUIRED | 순수 | AC14·AC15 표 | VP-04 M9·M10 공유 | EP-06 · EP-10 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| 관련 vitest | 수정 모듈 | §19 목록 | 같음. DB 스위트 ABI 서명 실패는 환경 기준선(`app/AGENTS.md`) |
| migration append-only | 0028 추가 | `cd app && node scripts/check-migrations-appendonly.mjs` | 위반 blocking |
| doc inventory | 마이그레이션 수·문서 링크 | `cd app && node scripts/check-doc-inventory.mjs --check` | 불일치 blocking |
| 커밋 trailer 파싱 | message-bus | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 포트는 스칼라 3종 + `baselineUsable` + `raw` 뿐이다. 매핑은 배포 소유이고 코어는 응답 형태를 모른다 | `features/usage/fetcher.ts:12-14·18-44` |
| 원격 스냅샷 저장은 provider 당 1행 upsert(덮어쓰기)다 | `infra/db/usage-queries.ts:209-228` · `0014_provider_usage_report_cache.sql:4-13` |
| 갱신은 `supports` → fetch → null 이면 throw → upsert → provider 뷰 1회 집계 → push | `tracker.ts:180-206` |
| provider 뷰는 `supports` 일 때만 캐시를 읽고, 경계 집계 1회 + 기준선 합성 | `tracker.ts:140-162` · `usage-compose.ts:50-89` |
| 0186 합성: 주=로컬, 월=기준선 적용 시 `usedUsd + asOf 이후 로컬 증분` 아니면 로컬, 한도=원격 ?? 사용자 | `usage-compose.ts:5-12·56-89` |
| 경계 집계는 `created_at >= monthStart` 로 스캔해 주를 이번 달 몫으로 자른다 — 주 시작이 지난달이어도 이번 달 날짜만 센다 | `usage-queries.ts:86·110` (WHERE `@monthStart`) · `clock.ts:21-27` |
| 사용량 탭은 전역 로컬 원장을 날짜(OS 로컬)·모델로 묶은 SQL 2문을 쓴다 | `usage-queries.ts:233-270` · `tracker.ts:211-220` |
| 날짜 키 'YYYY-MM-DD' 는 SQL `date(...,'localtime')` 와 JS `localDayKey` 가 같은 형식이다 | `shared/usage/stats.ts:38-44` · `usage-queries.ts:231` |
| `turn_usage.session_id` 는 세션 삭제 시 NULL 이 된다 — provider 별 로컬 쿼리는 LEFT JOIN 이어야 전역 합이 보존된다 | `0006_turn_usage.sql:5` · `usage-queries.ts:89` 주석 |
| 일별·모델별 표시 화면은 설정 '사용량' 탭 하나다. provider 탭·Composer 팝오버는 주·월 바만 | `UsageTab.tsx:150-168` · `ProviderUsageTab.tsx:114-124` · `UsagePanel.tsx:69-70` |
| `usageStats` 는 열 때·기간 탭 전환 때 조회한다(push 없음) | `useUsageStats.ts:15-23` |
| infra 는 features 타입을 import 할 수 없다 — DB 쓰기 행 타입은 `infra/db/types.ts` 에 둔다 | `app/src/main/AGENTS.md` §레이어 DAG |
| 마이그레이션은 append-only 기계 강제 + 목록 테스트 | `scripts/check-migrations-appendonly.mjs` · `migrate.test.ts:96` |
| better-sqlite3 `db.transaction(fn)` 은 fn 안 예외 시 전체 롤백한다 | better-sqlite3 v12 API(`Database#transaction`) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `UsageSnapshot` 정의·소비 파일 | `rg -l "UsageSnapshot" app/src` | 6 | `claude-map.ts` 는 동명 지역 타입(무관). 포트 소비는 `tracker.ts`·`usage-compose.ts` |
| `getProviderUsage(` 프로덕션 호출 | `rg -n "getProviderUsage\(" app/src --glob '!*.test.ts'` | 5 | tracker 3(:114·:173·:203) · `cost.ts` 2(:33·:51) — 모두 같은 합성 경로 |
| `usageStats` 소비 사슬 | `rg -n "usageStats" app/src --glob '!*.test.ts'` | 1 화면 | `cost.ts:66` → preload → `useUsageStats.ts:17` → `UsageTab` |
| `upsertProviderUsageReport` 프로덕션 호출 | `rg -n "upsertProviderUsageReport" app/src --glob '!*.test.ts'` | 1 | `tracker.ts:189` — 저장 진입점이 하나 |
| renderer `UsageLimitBar.source` 소비 | `rg -n "\.source\b"` settings·`UsagePanel.tsx`·`usageStore.ts` | 0 | 어휘 확장 무영향(D-016) |
| 마이그레이션 | `ls app/src/main/infra/db/migrations` | 27 | 다음 번호 0028 |
| "주간은 언제나 로컬" 계열 서술 | `rg -n "주간은 언제나\|항상 local\|week = 항상"` app/src·docs(handoff·archive 제외) | 코드 주석 4 · 테스트 2 · 문서 2 | provider 주 의미 4자리(`usage-compose.ts:7`·`limits.ts:62`·`IPC_CONTRACT.md:334·:378`)는 D-010 으로 갱신. 로컬 스캔 3자리(`usage-compose.ts:23`·`usage-queries.ts:170`·`queries.test.ts:702`)는 유지. `usage-compose.test.ts:108` 은 "내역이 없으면" 조건으로 유지(AC19) |

### 수치 / 전칭 표현 검산

- 재측정: 마이그레이션 27 · `usage-compose.test.ts` 13 `it` · `tracker.test.ts` 28 `it` · `jobs.test.ts` 11 `it` · `getProviderUsage(` 호출 5 = tracker 3 + cost 2.
- "유일한" 검산: "일별·모델별 표시 화면은 하나" ← `rg -ln "useUsageStats|costApi.usageStats" app/src/renderer --glob '!*.test.*'` → `UsageTab.tsx`·`useUsageStats.ts` 2파일, 화면 1.
- 문서 앵커: `IPC_CONTRACT.md §2.12`(:330) · `auth.md §8`(:721) · `closed-network-extensions.md §5-b`(:1061) · `persistence.md` 0014 행(:72) 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`~`AR-03`
- 현재 책임 소유자: 포트 `fetcher.ts`, 저장·합성 `UsageTracker`, 합성 규칙 `usage-compose.ts`, 저장소 `UsageQueries`.
- 흐름: `fetchUsage` → `UsageSnapshot`(스칼라+raw) → `upsertProviderUsageReport`(provider 당 1행 덮어쓰기) → `getProviderUsage`(경계 집계 + 기준선) → push. 사용량 탭은 로컬 원장만.
- 문제: 일별·모델별 필드가 없고 저장이 덮어쓰기라 이력이 없다. 화면 합성이 원격 기간 값을 볼 입력이 없다.

```text
fetchUsage → UsageSnapshot{limit,used,remaining,baselineUsable,raw}
  → upsertProviderUsageReport (provider_key PK 덮어쓰기)
  → getProviderUsage: sumUsageByBoundariesForProvider + readSnapshot → composeProviderUsage
  → push provider delta
usageStats: sumUsageByDaySince + sumUsageByModelSince (로컬만)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `SD-02`, `AR-01`~`AR-04`
- 책임: 포트에 내역 타입 추가 · 순수 정규화 `breakdown.ts` · 원자 저장 `UsageQueries.saveProviderUsageReport` · provider 합성 `usage-compose.ts` 확장 · 사용량 탭 합성 순수 `usage-stats-compose.ts` · 라우팅 `UsageTracker`.
- 오류: 정규화 실패 → 저장 전 throw. 저장 실패 → 트랜잭션 롤백 후 throw. 두 경우 모두 push 0, 호출자 정책(cron 격리·수동 reject)은 기존 그대로.
- 유지: 0014 캐시·기준선·한도·`supports` 게이트·cron 잡·IPC 채널·renderer.

```text
fetchUsage → UsageSnapshot{…, daily?, monthly?}
  → normalizeUsageBreakdown (실패 → throw, 쓰기 0)
  → saveProviderUsageReport ─ transaction ─ 0014 upsert + periods upsert + model sets replace
  → getProviderUsage: 경계 집계 + readSnapshot + providerPeriodCosts(+필요시 sumUsageByDayForProvider)
       → composeProviderUsage(…, remote) → push provider delta
usageStats: fetcher·지원 원격 일 행 없음 → 기존 SQL 2문
            있음 → 원격 일 행·모델 행 + provider별 로컬 2문 → composeUsageStats
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 내역은 `raw` 안에만 | 정규화 모듈이 내역을 행으로 바꾼다 | D-001·D-013 | MD-01 / VP-16 · `breakdown.ts` |
| data/control flow | 캐시 1행 upsert | 캐시 + 기간 + 모델 한 트랜잭션 | D-003·D-004 | SD-01 / VP-02·VP-10 · `usage-queries.ts` |
| state/contract | `UsageSnapshot` 스칼라 · `UsageSource` 2값 | 내역 필드 · `UsageSource` 4값 · 테이블 2개 | D-001·D-016 | AR-01·AR-02 / VP-12·VP-13 |
| 합성 | 주=로컬, 월=기준선/로컬, 사용량 탭=로컬 | 주·월·사용량 탭이 원격 우선 | D-006~D-010 | MD-02·MD-03 / VP-17·VP-18 |
| error/lifecycle | fetch 실패·null → throw | + 검증 실패 throw · 저장 롤백 | D-013 | SD-01 / VP-10 |
| test seam | compose 순수 · tracker 가짜 DB | + 정규화 순수 · 사용량 탭 합성 순수 · 실 SQLite 통합 | §11 | MD-01·MD-03 / UT-01·UT-03 |

삭제되는 책임은 없다. `upsertProviderUsageReport` 는 트랜잭션 안에서 재사용한다(이동 아님).

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `features/usage/fetcher.ts` (features, 타입) | 외부 포트 + 내역 타입 | — | 배포 `usage-fetcher.ts` · tracker · compose |
| `features/usage/breakdown.ts` (features, 순수) | 정규화·검증·상한 | `Pick<UsageSnapshot,'daily'\|'monthly'>` → `UsageBreakdown` / throw | tracker |
| `infra/db/migrations/0028_provider_usage_periods.sql` | 테이블 2개 | — | `migrate.ts` |
| `infra/db/usage-queries.ts` (infra) | 원자 저장 + 기간 조회 + provider 별 로컬 일 집계 | DB 행 타입(`infra/db/types.ts`) | tracker |
| `features/usage/usage-compose.ts` (features, 순수) | provider 바 우선순위 | 로컬 요약·일별 비용·스냅샷·원격 기간 비용 → `UsageLimitsView` | tracker |
| `features/usage/usage-stats-compose.ts` (features, 순수) | 사용량 탭 합성 | provider 별 로컬 일·모델 행 + 원격 일·모델 행 → `UsageStats` | tracker |
| `features/usage/tracker.ts` (features) | 라우팅·`supports` 게이트·저장 순서 | — | `bootstrap.ts` · `cost.ts` · `jobs.ts` |
| `shared/usage/limits.ts`·`stats.ts` (shared, 순수) | `UsageSource` 어휘 · `localMonthKey` | — | main 합성 |

## 10. 계약 / 타입 / 강제 지점

**포트 타입 (`features/usage/fetcher.ts`, 이름 확정 — 외부 계약)**

```ts
// 원격이 주지 않은 수치는 생략하거나 null — 코어는 0 이 아니라 "미제공"(NULL)으로 저장한다.
export interface RemoteUsageMetrics {
  inputTokens?: number | null
  outputTokens?: number | null
  cacheCreationInputTokens?: number | null
  cacheReadInputTokens?: number | null
  costUsd?: number | null
}
export interface RemoteModelUsage extends RemoteUsageMetrics { model: string }
export interface RemoteDailyUsage {
  day: string // 'YYYY-MM-DD' — Orca 로컬 날짜 키(OS 타임존)와 같은 달력
  total?: RemoteUsageMetrics | null
  models?: readonly RemoteModelUsage[] | null
}
export interface RemoteMonthlyUsage {
  month: string // 'YYYY-MM'
  total?: RemoteUsageMetrics | null
  models?: readonly RemoteModelUsage[] | null
}
// UsageSnapshot 에 추가
daily?: readonly RemoteDailyUsage[] | null
monthly?: readonly RemoteMonthlyUsage[] | null
```

**정규화 (`features/usage/breakdown.ts`)** — `normalizeUsageBreakdown(snapshot): UsageBreakdown`, 실패는 `UsageBreakdownError`.
`UsageBreakdown = { totals: UsagePeriodTotal[]; modelSets: UsagePeriodModelSet[] }`, `UsagePeriodTotal = { kind: 'day'|'month'; period; inputTokens…costUsd: number|null }`, `UsagePeriodModelSet = { kind; period; models: (values & {model})[] }`(길이 ≥ 1).
`USAGE_BREAKDOWN_LIMITS = { daily: 400, monthly: 120, modelsPerPeriod: 500, rows: 10_000 }` — `rows` = totals 수 + 모든 모델 행 수.
날짜 키 검증은 `/^\d{4}-\d{2}-\d{2}$/` + 달력 실재(로컬 `Date` 왕복), 월 키는 `/^\d{4}-(0[1-9]|1[0-2])$/`. 모델명은 `trim()` 후 1~200자.

**저장 스키마 (`0028_provider_usage_periods.sql`, 이름 확정 — append-only)**

```sql
CREATE TABLE provider_usage_periods (
  provider_key TEXT NOT NULL,
  period_kind TEXT NOT NULL CHECK (period_kind IN ('day', 'month')),
  period TEXT NOT NULL,
  input_tokens INTEGER, output_tokens INTEGER,
  cache_creation_input_tokens INTEGER, cache_read_input_tokens INTEGER,
  cost_usd REAL,
  fetched_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider_key, period_kind, period)
);
CREATE TABLE provider_usage_period_models (
  provider_key TEXT NOT NULL,
  period_kind TEXT NOT NULL CHECK (period_kind IN ('day', 'month')),
  period TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER, output_tokens INTEGER,
  cache_creation_input_tokens INTEGER, cache_read_input_tokens INTEGER,
  cost_usd REAL,
  fetched_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider_key, period_kind, period, model)
);
```

`fetched_at` = 그 행을 쓴 스냅샷의 `fetchedAt`, `updated_at` = 저장 시각. FK 없음 — 모델 행은 total 행 없이 존재할 수 있다(D-002).

**`UsageQueries` 신규 메서드** (행 타입은 `infra/db/types.ts`)

| 메서드 | 계약 |
|---|---|
| `saveProviderUsageReport(report, periods)` | `db.transaction` 하나에서 ① `upsertProviderUsageReport(report)` ② totals 각각 `(provider,kind,period)` 전체 행 upsert ③ modelSets 각각 그 기간 모델 행 `DELETE` 후 `INSERT`. 예외 시 전체 롤백 |
| `providerPeriodCosts(providerKey, {fromDay, toDay, month})` | `cost_usd IS NOT NULL` 인 day 행(`fromDay ≤ period ≤ toDay`)과 month 행(`period = month`)을 한 문으로 → `{ days: {day, costUsd}[]; monthCostUsd: number \| null }` |
| `listProviderUsagePeriods({periodKind, from?, to?})` | 전 provider 기간 행(사용량 탭용) |
| `listProviderUsagePeriodModels({periodKind, from?, to?})` | 전 provider 기간 모델 행 |
| `sumUsageByDayForProvider(providerKey, since)` | provider 한정 로컬 일별 합(`DailyUsageRow[]`) — `turn_usage ⨝ sessions` |
| `sumUsageByProviderDaySince(since)` · `sumModelUsageByProviderDaySince(since)` | `(provider_key \| NULL, day[, model])` 로컬 합 — `LEFT JOIN sessions` |

**강제 지점**

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리) | 실패 의미 |
|---|---|---|---|---|---|
| SD-01 / VP-10 | EP-01 검증 선행 | `tracker.refreshProvider` | tracker | 정규화 호출이 `saveProviderUsageReport` 보다 앞 (1) | 형식 오류 행이 이력에 남는다 |
| SD-01·AR-02 / VP-02·VP-10·VP-13 | EP-02 원자 저장 | `saveProviderUsageReport` | `UsageQueries` | 트랜잭션 안 쓰기 ①캐시 ②totals ③모델 집합 (3) | 반쪽 기간·캐시만 갱신된 상태 |
| R-01·R-02 / VP-01·VP-02 | EP-03 미제공 ≠ 0·≠ 삭제 | `breakdown.ts` + 저장 | 정규화·`UsageQueries` | 정규화 4자리(배열 부재/빈 배열 · total 수치 전무 · 모델 수치 전무 · 걸러낸 뒤 빈 모델 집합) + 저장 1자리(모델 교체는 modelSets 에 있는 기간만) (5) | 미제공이 0·삭제로 기록된다 |
| AR-03 / VP-14 | EP-04 `supports` 게이트 | tracker | tracker | `getProviderUsage` (1) · `usageStats` 원격 행 필터 (1) (2) | 지원 끊긴 provider 의 과거 행이 권위를 가진다 |
| MD-02 / VP-17 | EP-05 우선순위 | `composeProviderUsage` | compose | 월 4단 순서 (1) · 주 창·2단 (1) (2) | 월/주 값이 다른 출처를 쓴다 |
| MD-03 / VP-18 | EP-06 사용량 탭 합성 | `composeUsageStats` | compose | 수치별 `원격 ?? 로컬` (1) · 모델 집합 대체 (1) · 정렬(일 오름차순·모델 총 토큰 내림차순→이름) (1) (3) | 수치 누락·로컬 모델 혼입·순서 변화 |
| R-05 / VP-05 | EP-07 전역 불가침 | `globalView`·`recompute` | tracker | 전역 경로에 원격 입력 없음 (1) | 전역 지출 한도가 원격을 반영 |
| R-09 / VP-09 | EP-08 원격 행 0 → 기존 SQL | `usageStats` | tracker | 분기 (1) | 0112 결과와 미세 차이(합산 순서) |
| R-07 / VP-07 | EP-09 문서 사본 | 가이드 §5-b | 문서 | 가이드 §5-b · `auth.md §8` · `IPC_CONTRACT.md §2.12` 합성 문단 · 같은 절 타입 블록 · `persistence.md` · inventory (6) | 배포가 옛 계약으로 구현 |
| MD-02·MD-03 / VP-03·VP-04 | EP-10 오늘 이후 제외 | compose 2곳 | compose | provider 뷰 `toDay` (1) · 사용량 탭 `to` (1) (2) | 미래 날짜가 합에 섞인다 |
| AR-01 / VP-12 | EP-11 포트 형상 | `fetcher.ts` | 타입 | 선택 필드 + `null` 허용 (1) | 기존 배포 컴파일 실패 |
| AR-02 / VP-13 | EP-12 마이그레이션 등록 | `migrate.ts` | — | `MIGRATIONS` 배열 append (1) · `migrate.test.ts` 목록 (1) (2) | 테이블 부재로 저장 실패 |

- 같은 규칙의 SSOT: 날짜 키 생성은 `shared/usage/stats.ts` 의 `localDayKey`(기존)·`localMonthKey`(신규) 하나만 쓴다 — tracker·compose 가 각자 포맷하지 않는다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드: `daily`/`monthly`/`total`/`models` 의 `undefined` 와 `null` 은 같은 뜻(미제공). 수치의 `undefined`/`null` 도 같은 뜻(NULL 저장). `0` 은 제공된 0 이다.
- 외부 경계: 배포 매퍼가 원격 JSON 을 넘기므로 런타임 값은 타입을 믿지 않는다 — 정규화가 `typeof`·`Number.isFinite`·`Number.isSafeInteger` 로 다시 확인한다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/features/usage/fetcher.ts` | 포트 | §10 타입 추가 · 헤더 주석에 미제공·날짜 키 의미 | typecheck |
| `app/src/main/features/usage/breakdown.ts` (신규) | 정규화 | §10 계약 | 순수 단위 |
| `app/src/main/infra/db/migrations/0028_provider_usage_periods.sql` (신규) | 스키마 | §10 SQL | 실 SQLite |
| `app/src/main/infra/db/migrate.ts` | 등록 | import + `MIGRATIONS` append | `migrate.test.ts` |
| `app/src/main/infra/db/types.ts` | 행 타입 | 기간 행·모델 행·upsert·provider 별 로컬 일/모델 행 | typecheck |
| `app/src/main/infra/db/usage-queries.ts` | 저장·조회 | §10 메서드 7개(lazy prepare — 0014 선례) | 실 SQLite |
| `app/src/main/features/usage/usage-compose.ts` | provider 합성 | `ProviderLocalUsage.dayCostUsd?` · 인자 `remote?: { monthCostUsd; dayCostUsd: ReadonlyMap }` · D-009·D-010 · 헤더 주석 갱신 | 순수 단위 |
| `app/src/main/features/usage/usage-stats-compose.ts` (신규) | 사용량 탭 합성 | D-007·D-008·EP-06·EP-10 | 순수 단위 |
| `app/src/main/features/usage/tracker.ts` | 라우팅 | `refreshProvider`: 정규화 → `saveProviderUsageReport`. `getProviderUsage`: §12 조회 순서. `usageStats`: EP-08 분기 | 가짜 DB 단위 + 실 SQLite 통합 |
| `app/src/shared/usage/limits.ts` | 어휘 | `UsageSource` 4값 · 주석(:13-20·:62) 갱신 | typecheck |
| `app/src/shared/usage/stats.ts` | 키 | `localMonthKey(ms)` 추가 | 순수 단위 |
| `app/src/main/app/deployment/deployment-wiring.test.ts` | 배포 예제 | 가이드 §5-b 내역 예제를 그대로 옮긴 fetcher + 기존 예제 유지 | typecheck + 실행 |
| `docs/guides/closed-network-extensions.md` | 배포 절차 | §5-b 매퍼 예제·의미표 행·상한·권장 창(최근 2개월) | AC22 |
| `docs/arch/backend/auth.md` | 구조 | §8 미제공 규칙·저장 1줄 | AC22 |
| `docs/IPC_CONTRACT.md` | 계약 | §2.12 합성 문단·`usageStats` 행·타입 블록 | AC22 |
| `docs/arch/backend/persistence.md` | 구조 | 0028 행 | AC22 |
| `docs/generated/inventory.md` | 생성물 | `node scripts/check-doc-inventory.mjs` 재생성 | `--check` |

### 신규 테스트

| 테스트 | 무엇을 단언하는가 | AC |
|---|---|---|
| 정규화 단위 | 미제공 표(5행) · 실패 표(키·중복·수치·상한 경계) | AC2·AC3 |
| `UsageQueries` 실 SQLite | 저장 왕복 · 누적/교체 3단 · 롤백(모델 insert 실패 주입) · `providerPeriodCosts` NULL 제외 · provider 별 로컬 쿼리가 세션 삭제 행을 provider NULL 로 보존 | AC4~AC7·AC21 |
| provider 합성 단위 | 월 4단 · 주 창(평주·월 경계 주·미래) · 예산 불변 | AC9~AC11 |
| 사용량 탭 합성 단위 | 일 수치별 우선 · 모델 집합 대체 · 정렬 · 비지원·range·미래 제외 | AC14·AC15 |
| tracker 가짜 DB | 쿼리 호출 수 4행 · 전역 불가침 · 실패 시 push 0 | AC12·AC18·AC7 |
| tracker 실 SQLite 통합 | provider 뷰·push 동일 · 사용량 탭 3 range · 재시작 · 원장 불가침 · 기존 SQL 동등 | AC8·AC13·AC16·AC17·AC20 |

### 테스트 가능성

- electron 비의존: `breakdown.ts`·`usage-compose.ts`·`usage-stats-compose.ts` 는 DB·electron import 0 — 순수 단위.
- 실 SQLite 통합은 `queries.test.ts` 의 `dbWithMigrations()` 선례를 쓴다(DB 스위트 — ABI 주의 §19).
- 롤백 관측: `saveProviderUsageReport` 에 모델 insert 실패를 주입하려면 같은 (provider,kind,period,model) 중복 행을 modelSets 에 직접 넣어 PK 충돌을 일으킨다(정규화를 거치지 않는 DB 단위 경로).

## 12. End-to-end 영향

### producer → consumer

```text
배포 매퍼 → UsageSnapshot.daily/monthly → normalizeUsageBreakdown → saveProviderUsageReport
  → (provider 뷰) providerPeriodCosts → composeProviderUsage → UsageLimitsView → usageStore mirror → ProviderUsageTab·UsagePanel
  → (사용량 탭) listProviderUsagePeriods/Models → composeUsageStats → UsageStats → useUsageStats → UsageTab
```

- producer 기준: 원격 기간 값은 "그 (provider, 기간)의 최신 보고 전체"다. 수치 NULL = 미제공.
- consumer 파생 규칙: 바는 비용(USD)만, 사용량 탭은 토큰 4종 + 비용. 수치 단위로 `원격 ?? 로컬`.
- 파생 가능한 합성값이 정본을 우회하지 않는가: renderer 는 재계산하지 않는다(0186). 월 total 이 있으면 일 합으로 다시 만들지 않는다(D-009 ①).

`getProviderUsage(P, now)` 조회 순서: ① `supported = fetcher?.supports(P) === true` ② `snapshot = supported ? readSnapshot(P) : null` ③ 경계 집계 1회(기존) ④ `supported` 면 `providerPeriodCosts(P, {fromDay: localDayKey(monthStart), toDay: localDayKey(now), month: localMonthKey(now)})` ⑤ ④의 `days` 가 비어 있지 않을 때만 `sumUsageByDayForProvider(P, monthStart)` ⑥ `composeProviderUsage`.

`usageStats(range, now)` 조회 순서: ① fetcher 없음 → 기존 SQL 2문 ② `from = range==='all' ? undefined : localDayKey(since)`, `to = localDayKey(now)` 로 원격 day 행·모델 행 조회 후 `supports` 필터(provider 별 1회 판정 캐시) ③ 둘 다 0 → 기존 SQL 2문 ④ provider 별 로컬 2문 + `composeUsageStats`.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `migrate.ts` 부팅 마이그레이션 | 테이블 2개 추가(빈 테이블) | AC21 |
| `bootstrap.ts:617` tracker 생성 | 생성자 시그니처 무변경 | AC19 |
| `registerUsageJobs` | 무변경 — `refreshProvider` 를 그대로 부른다 | AC19 (`jobs.test.ts` 11) |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 부팅 마이그레이션이 테이블을 만든다. 저장 행은 재시작 후에도 쓰인다(AC20).
- 취소/중단: cron 의 `AbortSignal` 은 fetch 까지만 닿는다. 저장은 동기 트랜잭션이라 중간 취소가 없다.
- 종료/quit/crash: 트랜잭션 커밋 전 crash → SQLite 가 롤백한다(WAL).
- retry/timeout/partial failure: 실패는 기존 정책 그대로 — cron 은 provider 격리 후 틱 끝 throw, 수동은 reject.
- cleanup/rollback: 정리 정책 없음(비범위). 롤백은 트랜잭션이 맡는다.
- **다중 저장소 쓰기**: 쓰기 지점 3개(0014 캐시 · 기간 total · 모델 집합)가 **같은 SQLite 파일**이라 한 트랜잭션으로 원자화한다. 실패/crash 시 관측 상태는 "갱신 전 그대로" 하나뿐이다. push 는 커밋 뒤에만 나간다 — 커밋 실패 시 push 0(AC7).

## 14. 성능 / 상한 / 최적화

- 새 쓰기의 `원천 상한 × 배치 상한`: 스냅샷 1개 ≤ 10,000행(D-017) × provider 수. 권장 창(최근 2개월 일별 ~62 + 월 2)·모델 20 기준 ≈ 62×21 + 2×21 = 1,344행/분/provider. 최악 10,000행 upsert 는 main 스레드를 수십 ms 점유한다 — 가이드가 창을 줄이라고 안내한다.
- 저장량: 1 provider·모델 20·1년 ≈ 365×21 + 12×21 = 7,917행. 정리 없이도 작다.
- 새 조회 수: provider 뷰는 지원 provider 에서 +1(기간 비용) · 원격 일 행이 있을 때 +1(로컬 일별). 사용량 탭은 fetcher 가 있으면 원격 행 조회 +2, 원격 행이 있으면 기존 2문 대신 provider 별 로컬 2문. 턴마다 전 provider 재집계 0 — 0186 성능 계약 유지.
- 사용량 탭 합성 메모리: 'all' 범위 로컬 (provider, 날짜) 행 ≤ provider 수 × 일수, 모델 행 × 모델 수 — 수만 행 이하.
- 최적화로 잃는 것: 원격 행이 없으면 기존 SQL 경로를 그대로 쓴다(EP-08) — 합성 경로와 결과가 다를 수 있는 것은 부동소수 합산 순서뿐이다. AC17 이 기존 경로 사용을 잠근다.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port: `UsageFetcher`(`fetcher.ts`) — 이번에 `UsageSnapshot` 선택 필드 2개 추가.
- 구현 문서: `docs/guides/closed-network-extensions.md §5-b` (+ `auth.md §8`).
- **shape 검증**: 가이드 §5-b 매퍼 예제(내역 포함)를 `deployment-wiring.test.ts` 로 그대로 옮겨 `UsageFetcher` 에 대입한다. 내역 없는 기존 예제(:428-445)는 수정 없이 유지된다(AC1).
- **semantics 검증**: 미제공·교체·실패·날짜 키 의미표를 정규화·저장·합성 테스트가 그대로 단언한다(AC2~AC7·AC14·AC15). 의미표 행마다 대응 테스트 사례를 하나 둔다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| "provider week = 항상 local"(U7) · AC8 `week.source` 항상 `'local'` | `0186:plan@8f8fc03c` · `usage-compose.ts:7` | D-010 · AC10 | **변경** — 사용자 결정 D-006. 내역 없을 때는 그대로(AC19) |
| "원격은 `used` 전체를 대체하지 않는다 — 기준선만" | `usage-compose.ts:11-12` · `limits.ts:17-19` | D-009 ① · D-016 `'remote'` | **변경** — 월 total 을 주는 배포에 한해. 기준선 경로 자체는 유지 |
| "전역은 원격을 보지 않는다" | 0186 AC9 · `usage-compose.ts:44-47` | D-006 · AC18 | 유지 |
| `baselineUsable` fail-closed | `fetcher.ts:31-40` | D-009 ② | 유지 |
| `supports()` 가 캐시 권위 게이트 | `tracker.ts:141-145` | D-011 · AC12 | 유지(원격 기간 행으로 확장) |
| 로컬 원장 불가침 | `IPC_CONTRACT.md §2.12` | D-012 · AC8 | 유지 |
| 매핑은 배포 소유, 코어는 응답 형태를 모른다 | `fetcher.ts:12-14` | D-001 · §10 | 유지 — 코어는 정규화된 포트 타입만 안다 |
| 선언 슬롯 금지(0183 r2) | `fetcher.ts:9-10` | §10 | 유지 — 포트 필드이지 선언 슬롯이 아니다 |
| 사용량 탭 lazy 조회(push 없음) | `cost.ts:10-11` · `useUsageStats.ts` | §6 비범위 | 유지 |
| 마이그레이션 append-only | `app/AGENTS.md` DB 정책 | 0028 | 유지 |
| 0014 SQL 주석 "quota/totals/byModel" | `0014_provider_usage_report_cache.sql:1-3` | — | 유지(머지된 마이그레이션 수정 금지). 현재 의미는 `persistence.md` 가 말한다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 원격 날짜 달력이 OS 타임존과 다르면 하루 경계가 어긋난다 | D-014 — 가이드에 매퍼 책임으로 명시. 코어 변환 없음 |
| 오늘의 원격 값이 원격 집계 지연만큼 늦다(이 PC 의 최근 턴이 잠시 빠진다) | 수용 — 원격 우선(D-007). 1분 cron 이 따라잡는다. 기준선 경로는 지연 보정을 유지(D-009 ②) |
| 검증 실패가 그 provider 의 모든 원격 갱신(한도 포함)을 막는다 | 수용 — D-013. 실패는 `schedule_runs` 와 수동 동기화 문구로 드러난다 |
| `usage.estimateNote`("SDK 추정치") 문구가 원격 값과 섞인 화면에서 덜 정확해진다 | 수용 — D-005(화면 무변경). 후속 후보 |
| 사용량 탭은 열려 있는 동안 원격 갱신을 반영하지 않는다 | 수용 — 기존 lazy 조회 규칙(§16) |

- 되돌리기 어려운 결정: 테이블·컬럼 이름(§10), 포트 필드 이름·키 형식(D-001·D-014), `UsageSource` 2값 추가(D-016).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/features/usage/{fetcher,breakdown,usage-compose,usage-stats-compose,tracker}.ts` (+ 테스트)
- `app/src/main/infra/db/{migrate,types,usage-queries}.ts` · `migrations/0028_provider_usage_periods.sql` (+ `queries.test.ts`·`migrate.test.ts`)
- `app/src/shared/usage/{limits,stats}.ts`
- `app/src/main/app/deployment/deployment-wiring.test.ts`
- `docs/guides/closed-network-extensions.md` · `docs/arch/backend/auth.md` · `docs/IPC_CONTRACT.md` · `docs/arch/backend/persistence.md` · `docs/generated/inventory.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md`(레이어).
- ABI/네트워크 제약: `queries.test.ts`·`migrate.test.ts`·실 SQLite 통합 테스트는 better-sqlite3 를 로드한다. Node ABI 가 아니면 bindings 서명으로 실패한다 — `npm test`(pretest = Node ABI) 또는 Node ABI 재빌드 후 실행하고, 그 뒤 dev/build 전 Electron ABI 복귀를 분리 보고한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/main/features/usage src/shared/usage src/main/app/deployment/deployment-wiring.test.ts` (비-DB) + DB 스위트 `src/main/infra/db/queries.test.ts src/main/infra/db/migrate.test.ts` 와 tracker 실 SQLite 통합 파일.
- 위생: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: 없음(§7 주의사항).

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — 질의 1~3·후속 질의 답이 D-001~D-006 에 원문 근거로 있다.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — "비어있으면 … 제공하지 않는 형태"를 D-002 로, "provider 표시는 수정이 필요없다"를 D-005·AC24 로 옮겼다.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 상태표 7행 ↔ AC4~AC7·AC12·AC17·AC20.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축/구체성으로 작성되어 있다.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일/모듈 또는 AC에 추적 가능하다.
- [x] AS-IS에서 사라진 책임은 없다(§9 Delta 아래 문장).
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다(§8 검산).
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] 상속 기준이 없어 Baseline V 를 썼고 기존 동작은 INHERITED 노드로 출처 커밋을 붙였다.
- [x] 모든 NEW/CHANGED node에 같은 레벨 REQUIRED pair가 있다 — R-01~R-04·R-06·R-07·SD-01·SD-02·AR-01~AR-03·MD-01~MD-03.
- [x] 영향받은 INHERITED node(R-05·R-08·R-09·AR-04)는 REGRESSION 이다.
- [x] 각 pair의 경로·§10 전수 분모·직접 oracle이 있고 적대 증거는 음성 규칙·순서·구조 proxy pair 에만 있다.
- [x] 현재 변경 산출물의 운영 gate가 열거됐다.
- [x] 사람 실기로 미룬 순수 로직이 없다.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC17 은 동등 비교(의미) + 호출 스파이(경로)를 함께 둔다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다(§12 표).
- [x] producer/consumer 양쪽 의미를 확인했다.
- [x] 상한·총량·one-way door를 계산했다(§14·§6 표).
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 교차검증했고 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §8).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
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
| **관측한 게이트 산출**(exit code 아님) | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: …

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
