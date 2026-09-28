# Plan — 0244-mail-archive

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0244-mail-archive` |
| 작성자 | Claude Code |
| 일자 | 2026-09-28 |
| 매핑 | 브랜치 `claude/mail-rag-system-review-b495ii` |
| 상태 | READY — 범위는 단계 S1(코어+EML)·S2(PST). S3(임베딩)는 D-011 OPEN 해소 후 ΔV |
| V mode | `Baseline V` (0237 V에서 REGRESSION node 1개만 참조) |
| 기준 V | `none` — 회귀 참조: `0237-pop3-mail-search-plugin:ΔV3`(AC40·VP-32/33) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: EML·PST로 보관한 수천~수만 건의 업무 메일에서 과거 경위를 찾으려면 사람이 직접 뒤져야 한다. 현재 Orca의 메일 검색은 POP3 캐시(기본 14일 보존, 사내 빌드 한정)뿐이다.
- 완료 후 달라지는 것: 사용자가 설정에서 EML 폴더·PST 파일을 아카이브에 추가하면, 에이전트가 도구로 아카이브를 검색하고 스레드를 시간순으로 읽어 과거 이력을 요약할 수 있다.
- 성공을 사용자 관점에서 한 문장으로: "A 프로젝트 서버 이전이 왜 보류됐나"라고 물으면 에이전트가 관련 스레드를 찾아 시간순 경위를 답한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 제안서: EML·PST를 공통 모델로 정규화, Metadata+Full Text+Vector 하이브리드 검색, Reply/Reference/Thread 관계 보존, 검색 메일 기반 LLM 요약, 원본 비복제, 그래프 DB 제외 | 라이브 세션 턴1 제안서 |
| 명시 요구 | "Eml, pst 보관본을 별도 아카이브 구축이다" · "임베딩 api는 로컬 모델로" · "무기한 보존이다" · (POP3 2글자 결함 선수정) "아니" | 턴2 |
| 명시 요구 | 등록 방식 "A" · 가져오기 시작 "설정화면" · "모든빌드" · "Onnx 런타임 도입 허용" · PST 리더 "pst-extractor로 진행" | 턴3·4·5 |
| 명시 요구 | 토크나이저 `@huggingface/tokenizers` · 임베딩 모델 "스파이크 후 결정" | 턴6 질의 응답 |
| 추론 의도 | RAG의 LLM은 Orca 에이전트 자신이다 — 별도 LLM 호출 파이프라인이 아니라 에이전트가 부르는 도구를 만든다 | `arch/backend/adapters.md` "Orca 는 LLM API 를 직접 호출하지 않고 외부 CLI/SDK 를 래핑" |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | EML·PST 보관본으로 **별도 아카이브**를 만든다. POP3 Mail Plugin을 확장하지 않는다 | "Eml, pst 보관본을 별도 아카이브 구축이다" | 사용자 턴2 | ACTIVE | — |
| D-002 | 임베딩은 로컬 모델로 계산한다 | "임베딩 api는 로컬 모델로." | 사용자 턴2 | ACTIVE | — |
| D-003 | 아카이브는 **무기한 보존**. 시간 경과·원본 파일 소실로 자동 삭제하지 않는다 | "무기한 보존이다." | 사용자 턴2 | ACTIVE | — |
| D-004 | POP3의 2글자 FTS 결함은 이 작업에서 고치지 않는다. 아카이브는 자체 쿼리 빌더를 쓴다 | 사용자: 선수정 여부에 "아니" | 사용자 턴2 | ACTIVE | — |
| D-005 | 코드는 `features/plugins/mail-archive`에 두고 **인증 없는 등록 경로**를 추가한다 | 사용자 "A" — 파싱 코드 재사용 가능 | 사용자 턴3 | ACTIVE | — |
| D-006 | 가져오기는 **설정 화면**에서 시작한다(도구 호출로 시작하지 않는다) | 사용자 "설정화면" — 대량 가져오기는 도구 제한 시간을 넘는다 | 사용자 턴3 | ACTIVE | — |
| D-007 | **모든 빌드**에서 활성화한다(사내 deployment 전용 아님) | 사용자 "모든빌드" | 사용자 턴4 | ACTIVE | — |
| D-008 | `onnxruntime-node` 도입 허용 | "Onnx 런타임 도입 허용" — 사용처는 S3 | 사용자 턴4 | ACTIVE | — |
| D-009 | PST 리더는 `pst-extractor`(MIT) | "pst-extractor로 진행" | 사용자 턴5 | ACTIVE | — |
| D-010 | 토크나이저는 `@huggingface/tokenizers` | 사용자 선택 — 사용처는 S3 | 사용자 턴6 | ACTIVE | — |
| D-011 | 임베딩 모델 선정 | "스파이크 후 결정" — 후보를 한국어 실메일로 비교한 보고서 후 사용자 승인 | 사용자 턴6 | **OPEN** — S3 착수 조건. S1·S2 pair는 의존하지 않는다 | — |
| D-012 | 원본 비복제: 원문 전체·첨부 바이트를 DB/디스크에 복제하지 않는다. 필요 시 원본 파일에서 다시 읽는다 | 제안서 §8 "원본 메일은 기존 저장 위치에서 유지" | 설계자(제안서 채택) | ACTIVE | — |
| D-013 | 등록 지점은 `bootstrap.ts`의 직접 등록이다. `app/deployment/plugins.ts`에 두지 않는다 | D-007 — 그 파일은 OSS 기본 빌드에서 `[]`를 반환(`plugins.ts:85`)해 모든 빌드 조건을 못 지킨다 | 설계자 | ACTIVE | — |
| D-014 | 에이전트 도구는 색인된 메일이 1건 이상일 때만 등록한다 | 빈 아카이브의 도구 4개가 모든 턴의 컨텍스트를 쓰지 않게 한다 | 설계자 | ACTIVE | — |
| D-015 | 사용자가 설정에서 소스를 **제거**하면(확인 후) 그 소스에만 속한 메일을 삭제한다 | D-003은 자동 삭제 금지다. 명시적 사용자 제거는 보존 정책 위반이 아니다 | 설계자 | ACTIVE | — |
| D-016 | 인용문: 새로 쓴 본문(`body_new`)은 높은 가중, 인용부 앞 2,000자(`body_quote`)는 낮은 가중으로 색인한다 | 인용 중복이 순위를 오염시키지 않게 하면서, 원문이 아카이브에 없는 인용 내용도 찾게 한다 | 설계자 | ACTIVE | — |
| D-017 | 이 handoff 범위는 S1(코어+EML)·S2(PST). S3(임베딩·하이브리드 결합)는 D-011 해소 후 ΔV로 추가 | D-011이 OPEN이고, S1만으로 검색→스레드→요약이 동작한다 | 설계자 | ACTIVE | — |
| D-018 | IPC 도메인 이름은 `archive`(`orca:archive:*`), 에이전트 도구 서버 id는 `orca_mail_archive` | 기존 도메인·서버 id와 충돌 없음(§8 전수) | 설계자 | ACTIVE | — |
| D-019 | renderer는 파일 경로를 IPC로 보내지 않는다. 경로는 main이 연 OS 대화상자 결과만 쓴다 | `IPC_CONTRACT.md §7` 임의 경로 벡터 차단 관례 | 설계자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-019 (신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 해당 없음(신규).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-003 ↔ AC4("사라진 파일 메일 유지")·AC5("명시 제거만 삭제") 일치. D-006 ↔ AC2(설정에서 시작, 가져오기 도구 없음) 일치. D-007 ↔ AC1(OSS 빌드 탭 노출) 일치. D-012 ↔ AC13·AC14·AC22(원본 재판독) 일치. D-014 ↔ AC15 일치. D-019 ↔ AC18 일치. D-011(OPEN)에 의존하는 AC 0.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | 현재 메일 검색은 POP3 14일 캐시뿐이다(`retention-window.ts:12`). 보관본을 넣을 경로가 없다 |
| 이미 기존 코드가 충족하는가 | 부분 — MIME 파싱·임베드 이미지 판정·첨부 Temp 내보내기는 재사용 | `mail/mime.ts`·`mail/normalize.ts`·`mail/attachment-export.ts` |
| 더 작은 해법이 있는가 | 임베딩은 S3로 분리 — FTS+스레드만으로 목표 흐름이 먼저 동작 | D-017 |
| 선행 자료와 코드 대조 | 제안서의 "LLM/RAG" 단계는 별도 파이프라인이 필요 없다 | 에이전트가 도구 결과로 요약한다(§2 추론 의도) |
| 기존 결정과 충돌 | 0237 비범위 "메일 전용 renderer 화면"은 POP3 플러그인 범위 결정이다. 이 작업은 D-006 사용자 결정으로 설정 탭을 만든다 | `0237/plan.md:250` |

- 사용자에게 올릴 결정: 없음. D-011은 S3 착수 전 스파이크 보고서와 함께 올린다.
- 코드 조사로 닫은 사실: §8 표.

## 5. 동작 / 사용자 흐름

```text
[설정 > 메일 아카이브] → [EML 폴더 추가 | PST 파일 추가] → OS 대화상자
  → 소스 행 추가(대기) → 스캔 중(처리/전체/실패 진행률, 취소 버튼)
  → 완료: 메일 수·마지막 스캔 시각 표시, 에이전트 도구 등록
  ↘ 취소/앱 종료: "중단됨" — 커밋된 메일은 검색 가능, [다시 스캔]이 남은 항목만 처리
  ↘ 항목 실패: 실패 수 표시, 펼치면 최대 50건(경로·사유)
[채팅] 사용자 질문 → 에이전트: archive_search → archive_thread → (필요 시 archive_get / archive_getAttachment) → 시간순 경위 요약
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 소스 0 | DB 파일을 만들지 않는다 | 탭에 빈 상태 안내 + 추가 버튼 2개. 에이전트 도구 없음 |
| 소스 추가 | 대화상자 경로를 등록하고 스캔 작업을 큐에 넣는다 | 행 상태 `대기`→`스캔 중` |
| 같은 경로 재추가 | 새 소스를 만들지 않는다 | 기존 행 유지 |
| 스캔 중 | worker가 100건 단위 트랜잭션으로 커밋, 진행률 push(초당 ≤4회) | 진행률·실패 수 갱신 |
| 취소 | 현재 배치 커밋 후 중단, 대기 작업도 비운다 | 행 `중단됨` |
| worker 비정상 종료 | 작업 실패로 끝내고 커밋분 유지 | 행 `오류` + 사유, 앱은 계속 동작 |
| 앱 재시작 | `스캔 중`/`대기` 행을 `중단됨`으로 복원 | [다시 스캔] 가능 |
| 다시 스캔 | 지문(크기+수정시각) 같은 항목은 건너뜀, 새 항목만 처리, 사라진 항목은 `missing` | 메일 수 갱신. 사라진 파일의 메일은 남는다(D-003) |
| 원본 폴더/PST 자체가 없음 | 스캔을 시작하지 않는다 | 행 `원본 없음`. 검색·스레드는 동작, 원문·첨부는 실패 |
| 제거(확인 대화) | 그 소스에만 속한 메일·스레드·색인 삭제 | 행 사라짐. 스캔 중에는 제거 버튼 비활성 |
| 색인 메일 0→1 이상 | 도구 서버 등록 | 다음 턴부터 에이전트가 도구 사용 |
| 모든 소스 제거 | 도구 서버 회수 | 다음 턴부터 도구 없음 |

### 파생 UX / 엣지케이스

- loading / empty / error: 탭 첫 진입은 상태 조회 1회. 빈 상태 문구와 오류 행 사유를 i18n(ko/en)으로 둔다.
- cancel / retry / close / restart: 위 표. 취소 응답이 10초 없으면 worker를 강제 종료한다.
- concurrency: 작업은 한 번에 1개(큐). 스캔 중 제거·중복 스캔 요청은 거부하고 버튼을 비활성화한다.
- 외부환경/폐쇄망: 네트워크를 쓰지 않는다. 원본은 로컬·네트워크 드라이브 경로 모두 허용(접근 실패는 항목/소스 오류).

## 6. 범위 / 비범위

- **범위(S1)**: 아카이브 DB, EML 폴더 가져오기(utilityProcess), 인용문 분리, 중복 제거, 스레드 복원, 2글자 포함 FTS 검색, 에이전트 도구 4종, 설정 탭, IPC `archive` 도메인, 문서.
- **범위(S2)**: `pst-extractor` 기반 PST 가져오기, PST 원문·첨부 재판독, PST 스레드 속성.
- **비범위**: 임베딩·벡터 검색·RRF(S3, D-011 이후 ΔV) · OST · MSG 단일 파일 · 첨부 본문 색인 · 폴더 감시 자동 스캔 · 그래프/지식베이스 · POP3 캐시와의 통합 검색 · POP3 2글자 결함(D-004) · 메일 발송·수정.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 임베딩 저장 테이블 | 아니오 — 새 마이그레이션 `0002`로 추가(append-only) | S3 ΔV |
| 검색 결과 형상의 매칭 근거 필드 | 아니오 — `matchedBy`를 선택 필드로 추가하면 하위 호환 | S3 ΔV |
| 2글자 LIKE 대량 성능 | 아니오 — bigram 보조 색인을 후속 마이그레이션으로 추가 가능 | AC25 실측 후 NEXT_HANDOFF 후보 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 설정에 `메일 아카이브` 탭이 모든 빌드에서 보인다. 소스 0이면 빈 안내와 `EML 폴더 추가`·`PST 파일 추가` 버튼 | render test: 탭 목록에 `mailArchive` 항목, 빈 상태에서 두 버튼 렌더. `createPluginBindings` 반환과 무관함을 bootstrap 배선 테스트로 단언 | SettingsModal → MailArchiveTab → `archive.state` |
| R-01 | AT-02 / AC2 | EML 폴더 추가 → 하위 폴더 포함 `.eml`(대소문자 무관) 전부 스캔 → 진행률 → 완료 시 소스 `ready`·메일 수 | IT: 임시 폴더(중첩 3단·대문자 확장자·비eml 파일) → service.addSource 경로 → 완료 이벤트의 counts와 DB 메일 수 일치 | `archive.addSource` → service → worker → store |
| R-02 | AT-03 / AC3 | 스캔 중 취소 → 이미 커밋된 메일은 검색됨, 소스 `interrupted`, 다시 스캔 시 남은 항목만 파싱 | IT: 250파일, 1배치 후 취소 → search 결과 ≥100, 재스캔의 파싱 호출 수 = 250 − 커밋 수 | cancel → runner 플래그 → 배치 경계 |
| R-02 | AT-04 / AC4 | 다시 스캔: 변경 없는 파일 파싱 0, 새 파일만 추가, 사라진 파일은 `missing`이고 그 메일은 검색에 남는다 | IT: 1회 스캔 → 파일 1개 추가·1개 삭제 → 재스캔 → 파싱 호출 1, 삭제 파일 메일 search 적중 | rescan → runner diff |
| R-01 | AT-05 / AC5 | 소스 제거 → 그 소스에만 속한 메일·스레드·FTS 행 삭제, 다른 소스와 공유한 메일 유지 | IT: 소스 A·B에 같은 Message-ID 1건 + A 전용 2건 → A 제거 → 공유 1건 남고 A 전용 0, `mail_fts` 행 수 일치 | `archive.removeSource` → store |
| R-01 | AT-06 / AC6 | 손상 EML·50 MiB 초과 EML은 항목 실패(사유 코드)로 기록, 작업은 계속, 실패 목록 최대 50건 조회 | IT: 정상 3 + 손상 1 + 초과 1(sparse 파일) → 완료, failed=2, `archive.failures` 코드 `parse_error`·`too_large` | runner → source_item |
| R-03 | AT-07 / AC7 | 같은 Message-ID 메일이 두 파일·두 소스에 있어도 메일 1건, 위치는 2개 | UT(dedup key) + IT: 검색 결과 1건, `source_item` 2행이 같은 mail_id | runner → store.upsert |
| R-03 | AT-08 / AC8 | `archive_search`: 2글자 단어 포함 다중어 AND(예: `서버 이전 보류`)가 맞는 메일을 찾는다. `from`·`to`·`after`·`before`·`threadId` 필터 적용. 결과에 `threadId` | IT: 픽스처 메일 3건 → `서버 이전` 적중 1·비적중 2, 각 필터 단독·조합 결과 대조 | 도구 handler → query-builder → store |
| R-03 | AT-09 / AC9 | 키워드가 새 본문에 있는 메일이 인용부에만 있는 메일보다 상위 | IT: 두 메일(새 본문/인용 전용) → 결과 순서 단언 | bm25 가중 |
| R-04 | AT-10 / AC10 | In-Reply-To/References로 이어진 메일은 가져온 순서와 무관하게 한 스레드. `archive_thread`는 시간순·페이징 | IT: 답장→원문 역순 가져오기 → 같은 threadId, thread 결과 날짜 오름차순, `offset/limit` 동작 | runner → threading → store.thread |
| R-04 | AT-11 / AC11 | References 없이 Thread-Index 루트(앞 22바이트)가 같은 메일은 한 스레드, basis `thread_index` | UT(decide) + IT(EML 헤더 픽스처) | 동일 |
| R-04 | AT-12 / AC12 | 헤더·Thread-Index 없는 회신은 정규화 제목 동일 + 참여자 1명 이상 겹침 + 30일 이내일 때만 합류(basis `subject`). 어느 하나라도 불충족이면 새 스레드 | UT: 조건별 4케이스(충족/제목 불일치/참여자 불일치/31일) | threading |
| R-05 | AT-13 / AC13 | `archive_get`은 원본을 다시 읽은 전체 본문(최대 20,000자, 초과 시 `truncated`)을 준다. 원본이 없으면 저장된 본문 + `sourceAvailable:false` | IT: 긴 본문 EML → 20,000자·truncated. 파일 삭제 후 → sourceAvailable:false | 도구 → source-read → reader |
| R-05 | AT-14 / AC14 | `archive_getAttachment`는 승인 대상이고 원본에서 바이트를 다시 읽어 Temp로 내보낸다. 본문 임베드 이미지는 첨부 목록에서 제외(0237 규칙). 원본 없으면 `source_missing` | UT: descriptor `readOnlyHint:false`. IT: 첨부 bytes 일치, 임베드 이미지 제외, 삭제 후 오류 코드 | 도구 → source-read → `exportMailAttachment` |
| R-06 | AT-15 / AC15 | 색인 메일 0이면 `orca_mail_archive` 서버 미등록, 첫 작업 완료 후 등록, 전체 제거 후 회수. 앱 재시작 시 DB 상태로 재계산 | IT: fake registry로 부팅(0건)→작업 완료→제거 순서의 add/remove 호출 단언 | bootstrap → binding.sync → runtimeTools |
| R-02 | AT-16 / AC16 | 파싱·DB 쓰기는 utilityProcess에서 실행되고, worker 비정상 종료 시 작업 `error`·커밋분 유지·앱 계속 | IT: 주입한 fork fake가 exit(1) → 소스 `error`, 커밋분 search 적중. UT: main 쪽 코드에 reader import 0(경계 테스트) | service → fork |
| R-02 | AT-17 / AC17 | 앱 재시작 시 `scanning`·`queued` 소스는 `interrupted`로 복원 | IT: DB에 두 상태 기록 → service 초기화 → 상태 단언 | bootstrap → service.init |
| R-01 | AT-18 / AC18 | archive IPC 요청 스키마에 경로 필드가 없고, 추가 경로는 main 대화상자 결과만 쓴다 | UT: zod 스키마가 `path` 키를 거부(strict). handler 테스트: dialog fake 결과가 등록 경로 | preload → handler |
| R-03 | AT-19 / AC19 | POP3 Mail Plugin 동작 불변: 공용 helper로 옮긴 뒤에도 MIME 분류·EUC-KR 디코딩 기존 케이스 통과 | 기존 `mail/mime.test.ts`의 `mail MIME bytes`·`mail MIME attachment classification` 전 케이스 green | POP3 sync → normalizeMail |
| R-07 | AT-20 / AC20 | PST 파일 추가(복수 선택) → 폴더 순회, `IPM.Note*` 항목만 색인, 폴더 경로 기록 | IT: `node_modules/pst-extractor/example/testdata/enron.pst` → 메일 수 > 0, 비메일 항목 0, folder 비어 있지 않음 | addSource(pst) → worker → pst reader |
| R-07 | AT-21 / AC21 | PST 메일의 Message-ID·In-Reply-To·전송 헤더 References·Conversation Index를 스레드에 쓴다 | UT(pst-props 매핑, 가짜 속성 접근자) + IT(enron.pst에서 threadId 공유 메일 ≥1쌍) | pst reader → threading |
| R-05 | AT-22 / AC22 | PST 메일의 `archive_get`·`archive_getAttachment`는 nodeId로 원본 항목을 다시 연다 | IT: enron.pst 첨부 있는 메일 → bytes 길이 = 첨부 크기 | source-read(pst) |
| R-07 | AT-23 / AC23 | PST 파일 지문이 같으면 다시 스캔 시 순회하지 않는다 | IT: 2회차 스캔의 reader 호출 0 | runner |
| R-01 | AT-24 / AC24 | 패키지 산출물에 `pst-extractor/example/**`(46 MB 테스트 데이터)가 포함되지 않는다 | UT: `electron-builder.yml`의 `files`에 제외 패턴 존재 + 제외 패턴 제거 시 실패하는 대조 | electron-builder |
| R-08 | AT-25 / AC25 | 사람 실기(Windows 패키지): 실제 사내 EML 폴더·Unicode PST·ANSI(한글) PST 가져오기, 취소·재시작, 한글 검색, 스레드 요약, 첨부 승인. 1만 건 기준 소요 시간·DB 크기·2글자 검색 시간 기록 | 실기 보고(수치 기록) | 패키지 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: `mail/mime.test.ts`에 `describe('mail MIME bytes')`(EUC-KR 1케이스)와 `describe('mail MIME attachment classification')`(`it.each` 표) 존재 확인(`mime.test.ts:9,51`).
- 사람 실기 AC25만 남긴다: 실제 사내 PST·ANSI 한글 코드페이지·Windows 패키지 경로는 저장소에 픽스처를 둘 수 없다. 로직은 AC1~AC24가 잠근다.
- N회 기준: AC3·AC4·AC23의 "파싱 호출 수"는 runner에 주입한 reader fake의 호출 수다. 프로덕션 reader 호출부는 runner 한 곳(`import/runner.ts`)뿐이게 설계한다(§10 EP-05).
- 음성 기준 AC18은 양성(대화상자 경로가 등록된다)과 짝지었다.

## 7-A. V / Trace Matrix

- V mode 판정: 신규 기능이라 Baseline V. 0237 V에서는 공용화로 영향받는 노드 1개만 REGRESSION으로 참조한다.
- 기준 V 상속 근거: `none`. 회귀 참조 좌표 `0237-pop3-mail-search-plugin:ΔV3`(commit — 검증자 기입).
- `SUPERSEDED` pair 이관: 해당 없음.
- 변경이 시작되는 수준: R.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | 설정 탭·소스 관리(AC1·2·5·6·18·24) | NEW | — |
| R-02 | R | 취소·재스캔·재시작·격리(AC3·4·16·17) | NEW | — |
| R-03 | R | 검색 도구·중복·가중·POP3 불변(AC7·8·9·19) | NEW | — |
| R-04 | R | 스레드 복원(AC10·11·12) | NEW | — |
| R-05 | R | 원문·첨부 재판독(AC13·14·22) | NEW | — |
| R-06 | R | 도구 노출 수명주기(AC15) | NEW | — |
| R-07 | R | PST 가져오기(AC20·21·23) | NEW | — |
| R-08 | R | 실기(AC25) | NEW | — |
| R-0237-40 | R | 0237 AC40: 임베드 이미지 제외 후 첨부 개수 일치 | INHERITED | `0237:ΔV3` VP-32 |
| SD-01 | SD | 가져오기 작업 수명주기 §5 표·§13 | NEW | — |
| SD-02 | SD | 도구 노출 수명주기 §12 | NEW | — |
| AR-01 | AR | IPC `archive` 도메인 §10 | NEW | — |
| AR-02 | AR | main↔worker 메시지·단일 writer §9 | NEW | — |
| AR-03 | AR | bootstrap 등록 ↔ runtimeTools §12 | NEW | — |
| AR-04 | AR | reader → normalize → store(EML·PST) §9 | NEW | — |
| AR-05 | AR | 패키징 제외 §11 | NEW | — |
| MD-01 | MD | quote-strip §11 | NEW | — |
| MD-02 | MD | threading decide §11 | NEW | — |
| MD-03 | MD | query-builder §11 | NEW | — |
| MD-04 | MD | dedup key·subject 정규화 §11 | NEW | — |
| MD-05 | MD | PST 속성 매핑 §11 | NEW | — |
| MD-06 | MD | `plugins/mail-content.ts` 공용 helper §11 | NEW | 0237 `normalize.ts`에서 이동 |
| MD-07 | MD | 도구 출력 예산 §14 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02·05·06·18·24 | REQUIRED | SettingsModal → archiveApi → preload → handler → service → store | 탭 렌더·DB 행 수·스키마 거부·yml 패턴 | required — AC24: yml 제외 패턴 삭제 변이 red | EP-01·02·09·10 (6) |
| VP-02 | R-02 ↔ AT-03·04·16·17 | REQUIRED | service → fork → worker → runner → store | 파싱 호출 수·상태 값 | required — 배치 경계 무시 변이(취소 즉시 rollback) red | EP-03·04·05 (5) |
| VP-03 | R-03 ↔ AT-07·08·09·19 | REQUIRED | 도구 → query-builder → store.search | 결과 id·순서 | required — 가중치 맞바꿈(body_new↔body_quote) 변이 red | EP-06·07 (4) |
| VP-04 | R-04 ↔ AT-10·11·12 | REQUIRED | runner → store.resolveThread → decideThread | threadId 동일성 | required — mail_ref 역방향 조회 삭제 변이(역순 가져오기) red | EP-08 (3) |
| VP-05 | R-05 ↔ AT-13·14·22 | REQUIRED | 도구 → source-read → reader → export | bytes·본문 길이·오류 코드 | not selected — 바이트 직접 대조 | EP-11 (2) |
| VP-06 | R-06 ↔ AT-15 | REQUIRED | bootstrap → binding.sync → runtimeTools.add/remove | add/remove 호출 순서 | required — sync 호출 1곳(작업 완료) 삭제 변이 red | EP-12 (3) |
| VP-07 | R-07 ↔ AT-20·21·23 | REQUIRED | addSource(pst) → worker → pst reader → store | 메일 수·threadId·호출 수 | not selected — 실제 PST 직접 판독 | EP-05·13 (3) |
| VP-08 | R-08 ↔ AT-25 | REQUIRED | 패키지 앱 | 실기 보고 수치 | not selected | 0 — 실기 |
| VP-09 | SD-01 ↔ ST-01 | REQUIRED | 추가→스캔→취소→재시작→재스캔 종단 | 상태 전이 순서 로그 | not selected — 순서 로그 직접 대조 | EP-03·04 (4) |
| VP-10 | SD-02 ↔ ST-02 | REQUIRED | 부팅(0)→완료→전체 제거 | registry 스냅샷 | not selected | EP-12 (3) |
| VP-11 | AR-01 ↔ IT-01 | REQUIRED | CHANNELS → protocol zod → handler → preload | 채널 문서 일치 테스트·zod | not selected | EP-09 (3) |
| VP-12 | AR-02 ↔ IT-02 | REQUIRED | service ↔ worker 메시지 | 메시지 시퀀스·단일 writer | required — 스캔 중 removeSource 허용 변이 red | EP-04 (2) |
| VP-13 | AR-03 ↔ IT-03 | REQUIRED | `Bootstrap.register` → registerMailArchive | 배선 테스트 | required — 등록 호출 삭제 변이 red | EP-12 (1) |
| VP-14 | AR-04 ↔ IT-04 | REQUIRED | reader(EML·PST) → ArchiveMailInput → store | 필드 대조 | not selected | EP-05·13 (2) |
| VP-15 | AR-05 ↔ IT-05 | REQUIRED | electron-builder files | 패턴 존재 | required — VP-01과 공유 변이 | EP-10 (1) |
| VP-16 | MD-01 ↔ UT-01 | REQUIRED | quote-strip | 분리 결과 | not selected — 픽스처 표 직접 대조 | 0 — 순수 함수 |
| VP-17 | MD-02 ↔ UT-02 | REQUIRED | decideThread | 결정 결과 | not selected | 0 — 순수 함수 |
| VP-18 | MD-03 ↔ UT-03 | REQUIRED | buildArchiveQuery | SQL 조각·파라미터 | not selected | 0 — 순수 함수 |
| VP-19 | MD-04 ↔ UT-04 | REQUIRED | dedupKey·normalizeSubject | 문자열 | not selected | 0 — 순수 함수 |
| VP-20 | MD-05 ↔ UT-05 | REQUIRED | mapPstMessage | 필드 대조 | not selected | 0 — 순수 함수 |
| VP-21 | MD-06 ↔ UT-06 | REQUIRED | mail-content helper | 분류 결과 | not selected | EP-14 (2) |
| VP-22 | MD-07 ↔ UT-07 | REQUIRED | 도구 출력 예산 | 글자 수 상한 | not selected | EP-07 (1) |
| VP-23 | R-0237-40 ↔ AT-0237-40 | REGRESSION | POP3 parseMail → normalizeMail → store | 기존 mime/store 테스트 | not selected — 기존 테스트 재실행 | EP-14 (2) |

### 현재 변경의 운영 gate

| Gate | 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| lint·typecheck | `app/**` 변경 | `cd app && npm run lint && npm run typecheck` | 이번 변경 유발분 |
| 순수 테스트 | MD 노드 | `./node_modules/.bin/vitest run src/main/features/plugins/mail-archive` 중 비DB 스위트 | 동일 |
| DB 테스트 | store·runner IT | `npm test`(ABI 전환 주의, `app/AGENTS.md §better-sqlite3`) | 동일 |
| 문서 인벤토리 | IPC 채널·도메인 수 변경 | `node scripts/check-doc-inventory.mjs --check` | 동일 |
| IPC 문서 일치 | 새 채널 | `shared/ipc-documentation.test.ts` | 동일 |
| i18n 리소스 | 새 키 | `shared/i18n/resources/resources.test.ts` | 동일 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 플러그인 도구는 인증 `valid`일 때만 등록된다 | `app/deployment/plugins.ts:58` |
| OSS 기본 빌드의 플러그인 배열은 비어 있다 | `app/deployment/plugins.ts:85-88` |
| 인증 없는 도구 등록 선례: 산출물 게시 | `app/bootstrap.ts:940` `ctx.runtimeTools.add(createArtifactToolServer(...))` |
| main feature 경계는 `features/*` 폴더 단위, feature 간 import 금지 | `eslint.config.mjs:124,160-163` — `plugins/mail-archive`는 `plugins/mail` import 가능 |
| readOnlyHint가 true가 아니면 승인 대상(fail-closed) | `adapters/runtime-tool-policy.ts:19-31` |
| 도구 결과 형상 `jsonToolResult` | `adapters/runtime-tools.ts:45` |
| 파일 DB 열기·PRAGMA | `infra/db/file-database.ts` |
| 플러그인 마이그레이션 관례(`?raw` + migration-meta) | `mail/store/migrate.ts` |
| postal-mime 3.0.0이 `messageId`·`inReplyTo`·`references`·`headers` 제공 | 패키지 `postal-mime.d.ts:52,63-65` |
| `normalizeMail` 입력이 POP3 전용(`uidl`·`messageNumber`) | `mail/normalize.ts:33-36` |
| 첨부 Temp 내보내기 재사용 가능 | `mail/attachment-export.ts` `exportMailAttachment(options, accountId, filename, bytes)` |
| electron-vite 5가 `?modulePath` import 지원(utilityProcess 진입점 번들) | 패키지 `node.d.ts:8`, `dist/chunks/lib-*.js:874` |
| main에 utilityProcess·worker_threads 사용처 없음 | `rg "utilityProcess\|worker_threads" app/src/main` → 0 |
| 설정 탭 id 타입 `AppSettingsTab` | `shared/app-error.ts:31`, 소비처 2(`errorToastTarget.ts`·`settingsModalStore.ts`) |
| 디렉토리 대화상자 선례 | `app/handlers/files.ts:107` |
| pst-extractor 1.12.0: MIT, 의존성 3(`iconv-lite`·`long`·`uuid-parse`), 동기 `fs.readSync` | npm 메타·`PSTFile.class.js:100,805` |
| pst-extractor: `internetMessageId`·`inReplyToId`·`transportMessageHeaders`·`conversationTopic`·`getAttachment(n)` 공개, `getBinaryItem` protected | `PSTMessage.class.d.ts`·`PSTObject.class.d.ts:118` |
| pst-extractor: nodeId 재열기 `PSTUtil.detectAndLoadPSTObject(file, Long)` — index 미export, deep import 필요 | `PSTUtil.class.d.ts:108`, `index.d.ts` |
| pst-extractor 패키지에 `example/testdata/enron.pst`(13,984,768 B) 포함, example 전체 46 MB | `npm pack` 목록 |
| Unicode 문자열은 UTF-16LE, ANSI는 메시지 코드페이지로 iconv 디코딩 | `PSTUtil.class.js:92-105`, `PSTObject.class.js:246-256` |
| 의존성 추가는 사용자 승인 + TRD §4 표 갱신 | `app/AGENTS.md:96`, `TRD.md:79` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `AppSettingsTab` 소비처 | `rg AppSettingsTab app/src --glob '!*test*'` | 3 | 타입 정의 1 + 소비 2. 멤버 추가는 두 소비처에 무해(문자열 union 확장) |
| 기존 IPC 도메인 | `docs/generated/inventory.md` | 25 | `archive` 없음 → D-018 충돌 0 |
| 도구 서버 id | `rg "id: '" app/src/main/features --glob '*tool*'` + `authToolServerId` | — | `orca_artifacts`·`<authId>-tools`만 존재. `orca_mail_archive` 충돌 0 |
| `normalize.ts` helper 소비처 | `rg "normalizeMail\|referencedContentIds" app/src/main` | 2 | `mime.ts` 1 + 정의. 공용화 영향은 POP3 경로 1개 |
| runtimeTools.add 호출 | `rg "runtimeTools.add\|registry.add" app/src/main --glob '!*test*'` | 2 | artifacts·plugin binding. 아카이브가 3번째 |

### 수치 / 전칭 표현 검산

- 재측정 수치: IPC 채널 100·도메인 25(`inventory.md`), 추가 7채널 → 문서에 수치를 적지 않고 인벤토리 재생성으로 반영.
- "utilityProcess 사용처 없음": `rg` 0건 확인.
- 문서 앵커: `IPC_CONTRACT.md §2.6`·`§6`·`§7`, `persistence.md` `#### Mail Plugin 캐시` 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

- 관련 V node: 없음(신규). 영향 노드: MD-06·R-0237-40.
- 메일 검색 소유자: `features/plugins/mail`(POP3, 인증 필요, 사내 배포만).
- 흐름: `mail_sync` → POP3 → `parseMail` → `normalizeMail` → `mail.db` → `mail_search`.
- 제약: 보관 파일 입력 경로 없음, 14일 보존, 스레드 관계 미저장, 2글자 검색 결함(D-004로 유지).

```text
[agent] mail_sync → pop3 session → mime.parseMail → normalize.normalizeMail → mail.db(fts trigram)
[agent] mail_search → query-builder(POP3) → mail.db
```

### TO-BE

- 관련 V node: SD-01·SD-02·AR-01~05.
- 소유자: `features/plugins/mail-archive`(인증 없음, 모든 빌드). POP3 경로는 helper 이동 외 불변.
- 가져오기 흐름: 설정 → IPC → service(큐) → utilityProcess worker → runner → reader → 정규화 → store(`archive.db`).
- 검색 흐름: 에이전트 도구 → store 읽기 연결 → 결과(예산 적용).

```text
[renderer] MailArchiveTab ──archiveApi──▶ preload ──IPC orca:archive:*──▶ handlers/archive.ts
                                                                           │
                          ┌────────────── ArchiveImportService (main, 큐 1개) ◀┘
                          │ fork(?modulePath)                 ▲ progress/done/error
                          ▼                                   │
                 [utilityProcess] worker.ts → runner.ts ──▶ readers/eml.ts | readers/pst.ts
                                                  │            └▶ normalize → quote-strip → dedup
                                                  ▼
                                    store (archive.db: source·source_item·mail·mail_ref·thread·attachment·mail_fts)
                                                  ▲
[agent] archive_search/thread/get/getAttachment ──┘ (main, 읽기 연결)   source-read → reader(원본 재판독)
[boot] Bootstrap.register → registerMailArchive → binding.sync() → runtimeTools.add/remove
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 메일 검색 = POP3 플러그인 | + 아카이브 슬라이스(`plugins/mail-archive`) | D-001·D-005 | AR-03·04 / VP-13·14 |
| 공용 helper | `normalize.ts` 내부 함수 | `plugins/mail-content.ts`로 이동, 두 경로가 import | 재사용(D-005) | MD-06 / VP-21·23 |
| data flow | POP3 → mail.db | EML·PST → worker → archive.db | D-001·D-006 | SD-01 / VP-02·09 |
| 등록 | 인증 연동 binding만 | bootstrap 직접 등록 + 색인 수 기반 sync | D-007·D-013·D-014 | SD-02 / VP-06·10·13 |
| IPC | 없음 | `archive` 도메인 7채널 | D-006·D-018·D-019 | AR-01 / VP-11 |
| 프로세스 | main 단일 | main + import 시 utilityProcess 1개 | UI 비차단(AC16) | AR-02 / VP-12 |
| 패키징 | — | `pst-extractor/example/**` 제외 | 설치 용량 | AR-05 / VP-15 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `plugins/mail-content.ts` | 주소 포맷·CID 수집·임베드 이미지 판정 | postal-mime 타입 → 문자열/boolean | `mail/normalize.ts`, `mail-archive/normalize.ts` |
| `mail-archive/normalize.ts` | postal-mime Email → `ArchiveMailInput` | Email → 입력 DTO | `readers/eml.ts` |
| `mail-archive/html-text.ts` | HTML-only 본문 → 줄바꿈 보존 텍스트(turndown) | html → text | normalize·pst reader |
| `mail-archive/quote-strip.ts` | 새 본문/인용 분리 | text → `{ bodyNew, bodyQuote }` | normalize·pst reader |
| `mail-archive/subject.ts`·`dedup.ts` | 제목 정규화·중복 키 | 문자열 | runner·store |
| `mail-archive/threading.ts` | 후보 → 스레드 결정(순수) | input + candidates → decision | store.resolveThread |
| `mail-archive/query-builder.ts` | 검색 SQL 조각(순수) | 검색 입력 → where/params/order | store.search |
| `mail-archive/store/*` | 스키마·쓰기·읽기 | SQLite | runner(worker)·tools·handler(main) |
| `mail-archive/readers/*` | EML 스캔·PST 순회·재판독 | 경로 → AsyncIterable 항목 | runner(worker)·source-read(main) |
| `mail-archive/import/runner.ts` | 한 작업 실행(배치·지문·취소) | 작업 + 주입 reader/store | worker.ts, 테스트 |
| `mail-archive/import/worker.ts` | utilityProcess 진입점 | parentPort 메시지 | fork.ts가 번들 경로로 fork |
| `mail-archive/import/fork.ts` | `?modulePath` + `utilityProcess.fork` 유일 지점 | — | service |
| `mail-archive/import/service.ts` | 큐·상태·취소·crash·재시작 복원 | IPC 명령 → 이벤트 | handler, bootstrap |
| `mail-archive/tools.ts` | 도구 서버 4종 | 도구 입력 → 결과 | binding |
| `mail-archive/binding.ts` | 색인 수 기반 add/remove | store.countMails | bootstrap, service 완료 콜백 |
| `app/handlers/archive.ts` | IPC 등록 | zod 요청 → service | `Bootstrap.register` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리) | 실패 의미 |
|---|---|---|---|---|---|
| EP-01 / VP-01 | 설정 탭 id `mailArchive` | `shared/app-error.ts` `AppSettingsTab` | SettingsModal | 탭 목록 선언·렌더 분기 (2) | 탭이 안 보이거나 빈 화면 |
| EP-02 / VP-01 | 같은 경로 소스 중복 금지 | `source.path UNIQUE` | store | addSource (1) | 같은 폴더 이중 스캔 |
| EP-03 / VP-02·09 | 상태 전이 `queued→scanning→ready\|interrupted\|error\|missing` | `shared/mail-archive.ts` `ArchiveSourceStatus` | service | 큐 진입·worker 시작·done/cancel/exit·init 복원 (4) | 재시작 후 영구 `스캔 중` |
| EP-04 / VP-02·12 | 단일 writer: 작업 중 main 쓰기 금지 | service 잠금 | service | removeSource·rescan·addSource(큐만) (2) | SQLITE_BUSY 또는 삭제 중 삽입 |
| EP-05 / VP-02·07·14 | reader 호출은 runner 한 곳, 지문 같으면 건너뜀 | `import/runner.ts` | runner | EML 항목 지문·PST 파일 지문 (2) | 재스캔 전량 재파싱 |
| EP-06 / VP-03 | FTS 가중 `subject 5, from 1, to 1, cc 1, body_new 3, body_quote 0.5` | `query-builder.ts` 상수 | store.search | bm25 호출 (1) | 인용 중복이 상위 점유 |
| EP-07 / VP-03·22 | 출력 상한(§14) | `mail-archive/output-budget.ts` | tools | search·thread·get (3) | 컨텍스트 폭주 |
| EP-08 / VP-04 | 스레드 연결 규칙(헤더 → Thread-Index → 제목) | `threading.ts` | store.resolveThread | 정방향(in_reply_to·references) · 역방향(mail_ref) · thread_index (3) | 가져오기 순서에 따라 스레드 분열 |
| EP-09 / VP-01·11 | IPC 요청에 경로 없음, `.strict()` | `shared/protocol.ts` | handler | addSource·rescan·removeSource (3) | 임의 경로 스캔 벡터 |
| EP-10 / VP-01·15 | 패키지 제외 `!node_modules/pst-extractor/example/**` | `electron-builder.yml` | electron-builder | files (1) | 설치 파일 +46 MB |
| EP-11 / VP-05 | 원본 재판독 키 `source_item(kind, item_key)` | store | source-read | EML 경로 결합·PST nodeId (2) | 다른 메일의 원문/첨부 반환 |
| EP-12 / VP-06·10·13 | 도구 등록 = `countMails() > 0` | `binding.ts` | binding | 부팅·작업 완료·소스 제거 (3) | 빈 도구 노출 또는 미노출 |
| EP-13 / VP-07·14 | PST는 `IPM.Note*`만 | `readers/pst.ts` | pst reader | 항목 순회 (1) | 연락처·일정이 메일로 색인 |
| EP-14 / VP-21·23 | 임베드 이미지 판정 1벌 | `plugins/mail-content.ts` | 두 normalize | POP3·아카이브 (2) | 두 경로 규칙 분기 |

- 같은 규칙의 SSOT: 임베드 이미지 판정은 `mail-content.ts` 하나(EP-14). PST 첨부도 같은 함수에 (mimeType, contentId, 참조 CID 집합)을 넘긴다.
- "다른 게이트가 막는다" 기재: 없음.
- 선택 필드 의미: 검색 `after`/`before` 미지정 = 무제한. `threadId` 미지정 = 전체. `ArchiveSourceStatus`는 union이며 boolean 조합을 쓰지 않는다.
- 외부 SDK 경계: `pst-extractor`의 protected `getBinaryItem`은 `readers/pst-props.ts`의 `binaryProperty(obj, id)` 한 곳에서만 캐스팅한다. `Long` 값은 문자열로 저장한다.

### 타입 계약 (정본 `shared/mail-archive.ts`)

```ts
export type ArchiveSourceKind = 'eml_dir' | 'pst'
export type ArchiveSourceStatus = 'queued' | 'scanning' | 'ready' | 'interrupted' | 'error' | 'missing'
export interface ArchiveSourceSummary {
  id: number; kind: ArchiveSourceKind; path: string; status: ArchiveSourceStatus
  mailCount: number; failedCount: number; missingCount: number
  lastScanAt: number | null; lastError: string | null
}
export interface ArchiveJobProgress { sourceId: number; processed: number; total: number | null; failed: number }
export interface ArchiveState { sources: ArchiveSourceSummary[]; job: ArchiveJobProgress | null; totals: { mails: number; threads: number } }
export interface ArchiveFailure { itemKey: string; code: 'parse_error' | 'too_large' | 'read_error' | 'unsupported'; }
```

### IPC 채널 (D-018)

| 채널 | 방향 | 요청 | 응답 | 실패 정책 |
|---|---|---|---|---|
| `orca:archive:state` | R→M | `{}` | `ArchiveState` | fallback 빈 상태 |
| `orca:archive:addSource` | R→M | `{ kind: ArchiveSourceKind }` strict | `{ added: ArchiveSourceSummary[] } \| { cancelled: true }` | reject |
| `orca:archive:rescan` | R→M | `{ sourceId: number }` strict | `ArchiveState` | reject(작업 중이면 오류 `busy`) |
| `orca:archive:removeSource` | R→M | `{ sourceId: number }` strict | `ArchiveState` | reject(작업 중 `busy`) |
| `orca:archive:cancel` | R→M | `{}` | `ArchiveState` | reject |
| `orca:archive:failures` | R→M | `{ sourceId: number }` strict | `ArchiveFailure[]`(≤50) | fallback `[]` |
| `orca:archive:stateEvent` | M→R | — | `ArchiveState` | push, 초당 ≤4 |

`addSource`는 main이 대화상자를 연다: `eml_dir` = `openDirectory` 1개, `pst` = `openFile`+`multiSelections`, 필터 `*.pst`.

### 에이전트 도구 (서버 `orca_mail_archive`)

| 도구 | 입력 | 출력 요지 | 승인 |
|---|---|---|---|
| `archive_search` | `query?`, `from?`, `to?`, `after?`(YYYY-MM-DD), `before?`, `threadId?`, `limit?` 1..50(기본 20) | `{ total, results:[{ mailId, threadId, date, from, to, subject, snippet(≤300), attachmentCount, threadSize }] }` | readOnly |
| `archive_thread` | `threadId`, `offset?`, `limit?` 1..40(기본 20) | `{ threadId, subject, mailCount, offset, mails:[{ mailId, date, from, to, cc, subject, body(≤1,000), bodyTruncated, basis, attachments:[{ attachmentId, filename, sizeBytes }] }] }` 날짜 오름차순 | readOnly |
| `archive_get` | `mailId` | `{ …헤더, folder?, body(≤20,000), truncated, sourceAvailable }` | readOnly |
| `archive_getAttachment` | `mailId`, `attachmentId` | `{ filename, bytes, savedPath }` | 승인 필요 |

날짜 출력은 로컬 오프셋 ISO(`YYYY-MM-DDTHH:mm:ss±HH:MM`). `after`는 로컬 자정 포함, `before`는 로컬 자정 미포함.

## 11. 구현 설계

### 저장소 — `<userData>/mail-archive/archive.db` (`migrations/0001_archive.sql`)

```sql
source(id INTEGER PK, kind TEXT CHECK(kind IN ('eml_dir','pst')), path TEXT NOT NULL UNIQUE,
       status TEXT NOT NULL CHECK(status IN ('queued','scanning','ready','interrupted','error','missing')),
       fingerprint TEXT, added_at INTEGER NOT NULL, last_scan_at INTEGER, last_error TEXT)
source_item(source_id INTEGER REFERENCES source(id) ON DELETE CASCADE, item_key TEXT NOT NULL,
       fingerprint TEXT, folder TEXT, state TEXT CHECK(state IN ('indexed','failed','missing')),
       error_code TEXT, mail_id INTEGER REFERENCES mail(id), PRIMARY KEY(source_id, item_key))
thread(id INTEGER PK, subject_norm TEXT NOT NULL)
mail(id INTEGER PK, dedup_key TEXT NOT NULL UNIQUE, message_id TEXT, date INTEGER NOT NULL,
     from_addr TEXT, to_addrs TEXT, cc_addrs TEXT, subject TEXT, subject_norm TEXT,
     body_new TEXT, body_quote TEXT, in_reply_to TEXT, thread_index_root TEXT,
     thread_id INTEGER NOT NULL REFERENCES thread(id), thread_basis TEXT CHECK(thread_basis IN ('header','thread_index','subject','none')))
mail_ref(mail_id INTEGER REFERENCES mail(id) ON DELETE CASCADE, ref_message_id TEXT NOT NULL)  -- References + In-Reply-To
attachment(id INTEGER PK, mail_id INTEGER REFERENCES mail(id) ON DELETE CASCADE, ordinal INTEGER, filename TEXT, mime_type TEXT, size_bytes INTEGER)
mail_fts USING fts5(subject, from_addr, to_addrs, cc_addrs, body_new, body_quote, content='mail', content_rowid='id', tokenize='trigram') + ai/ad/au 트리거
INDEX: mail(message_id), mail(thread_id, date), mail(thread_index_root), mail(subject_norm, date), mail_ref(ref_message_id), source_item(mail_id)
```

- DB 파일은 첫 `addSource`에서 만든다. 없으면 `state`는 빈 상태, `countMails`는 0.
- 연결: worker 1개(쓰기), main은 호출마다 열고 닫는 읽기 연결(0237 관례). 양쪽 `busy_timeout=5000`.
- `attachmentId` = `attachment.id` 문자열. `mailId` = `mail.id` 문자열.

### 정규화 규칙

| 항목 | 규칙 |
|---|---|
| 본문 | text part 우선, 없으면 `html-text.ts`(turndown)로 변환. PST는 `body` → `bodyHTML` 순. 둘 다 없으면 빈 본문 + 헤더만 색인 |
| 인용 분리 | 첫 번째 일치 줄에서 자른다: `-{2,}\s*(Original Message\|원본 메시지)\s*-{2,}` · `From:`/`보낸 사람:` 줄 뒤 4줄 안에 `Sent:\|Date:\|보낸 날짜:`와 `To:\|받는 사람:` · `^On .+wrote:$` · `님이 작성:$`. 이후 `>`로 시작하는 줄은 인용. 자른 새 본문이 공백뿐이면 전체를 `body_new`로 둔다(전달 메일) |
| body_quote | 인용부 앞 2,000자(D-016) |
| 제목 정규화 | 앞쪽 `re:`·`fw:`·`fwd:`·`회신:`·`답장:`·`전달:`(대소문자·공백·반복 허용) 제거, 공백 축약, 소문자 |
| 중복 키 | Message-ID가 있으면 `mid:` + `<>` 제거·trim 값, 없으면 `hash:` + sha256(date·from·subject_norm·body_new) |
| Thread-Index 루트 | EML 헤더 `Thread-Index`(base64) 또는 PST `PR_CONVERSATION_INDEX(0x0071)` 앞 22바이트 hex. 22바이트 미만이면 null |
| 첨부 | postal-mime 첨부 중 `isEmbeddedImage`(EP-14) 제외. 메타데이터만 저장, 순서 = ordinal |

### 스레드 결정 (`threading.ts` 순수)

1. 헤더 후보: 이 메일의 In-Reply-To·References가 가리키는 기존 메일 + `mail_ref`로 이 메일의 Message-ID를 참조하는 기존 메일. 후보 스레드가 여럿이면 가장 작은 id로 병합(`merge`).
2. 헤더 후보가 없고 `thread_index_root`가 같은 메일이 있으면 합류(basis `thread_index`).
3. 둘 다 없고 원 제목에 회신 접두사가 있으면: 같은 `subject_norm` + 참여자(from·to·cc 주소 집합) 1개 이상 겹침 + 날짜 차 ≤30일인 가장 최근 스레드에 합류(basis `subject`). 병합은 하지 않는다.
4. 그 외 새 스레드(basis `none`).

### 파일 목록

| 변경/신규 파일 | 책임 | 테스트 seam |
|---|---|---|
| `app/package.json` | `pst-extractor` `1.12.0` exact 추가 | — |
| `app/electron-builder.yml` | `files`에 `!node_modules/pst-extractor/example/**` | `mail-archive/packaging.test.ts`(yml 파싱) |
| `main/features/plugins/mail-content.ts` (신규) | `formatAddresses`·`referencedContentIds`·`isEmbeddedImage` | `mail-content.test.ts` 순수 |
| `main/features/plugins/mail/normalize.ts` | 위 helper import로 교체(동작 불변) | 기존 `mime.test.ts` |
| `main/features/plugins/mail-archive/types.ts` | `ArchiveMailInput`·`ReaderItem`·worker 메시지 타입 | — |
| `…/mail-archive/migrations/0001_archive.sql`·`store/migrate.ts`·`store/index.ts` | 스키마·쓰기(upsert·resolveThread·removeSource·resetInterrupted)·읽기(search·thread·getMail·state·failures·countMails) | `store/index.test.ts` DB |
| `…/mail-archive/{normalize,html-text,quote-strip,subject,dedup,threading,query-builder,output-budget}.ts` | §정규화·§스레드·§14 | 각 `*.test.ts` 순수 |
| `…/mail-archive/readers/eml.ts` | 재귀 스캔(lstat, 심볼릭 링크 미추적, 50 MiB 초과 `too_large`), 파일 → input | DB 없는 IT(임시 폴더) |
| `…/mail-archive/readers/pst.ts`·`readers/pst-props.ts` | PST 순회(`IPM.Note*`), 폴더 경로, 속성 매핑, nodeId 재열기 | `pst-props.test.ts` 순수 + enron.pst IT |
| `…/mail-archive/source-read.ts` | 원본 재판독(본문·첨부 bytes) | IT |
| `…/mail-archive/import/{runner,worker,fork,service}.ts` | §9 표 | runner·service는 reader/store/fork 주입 IT. `fork.ts`만 `?modulePath`·electron import |
| `…/mail-archive/tools.ts`·`binding.ts` | 도구 4종·등록 sync | `tools.test.ts`·`binding.test.ts` |
| `main/app/handlers/archive.ts` | IPC 7채널 | handler 테스트(dialog fake) |
| `main/app/bootstrap.ts` | `registerMailArchive(ctx)`를 `register()`에서 `registerArtifacts` 다음에 호출 | 배선 테스트 |
| `shared/mail-archive.ts`·`shared/ipc.ts`·`shared/protocol.ts`·`shared/app-error.ts` | DTO·CHANNELS·zod(strict)·탭 id | protocol 테스트 |
| `preload/index.ts` | `window.orca.archive.*` | — |
| `renderer/src/shared/api/ipc.ts` | `archiveApi` | — |
| `renderer/src/features/settings/components/MailArchiveTab.tsx`·`hooks/useMailArchiveState.ts`·`SettingsModal.tsx` | 탭 UI·상태 구독 | render 테스트 |
| `renderer/src/shared/i18n/resources/{ko,en}.ts` | `settings.tabs.mailArchive`·`settings.mailArchive.*` | resources 테스트 |

### 테스트 가능성

- electron 의존은 `import/fork.ts`·`handlers/archive.ts`(dialog)에만 둔다. runner·service는 fork 함수·reader·store를 인자로 받는다.
- worker 번들 경로(`?modulePath`)는 vitest에서 해석되지 않으므로 `fork.ts`를 테스트 import graph에 넣지 않는다.
- 순서 관측: service는 상태 전이마다 `onState` 콜백을 부르며 IT가 시퀀스를 기록한다(VP-09).
- DB IT는 `npm test` 경로(ABI 전환)에서 돈다.

## 12. End-to-end 영향

```text
reader(EML/PST) → normalize/quote-strip/dedup → store(upsert+thread) → mail_fts
  → tools(search/thread/get/getAttachment) → agent
service(state) → stateEvent → MailArchiveTab
```

- producer 기준: `source`·`source_item`·`mail`이 정본이다. `mailCount`·`threads`·`threadSize`는 조회 시 COUNT로 계산하고 저장하지 않는다.
- consumer 파생: 설정 탭은 `ArchiveState`만 렌더한다. 도구 노출은 `countMails()`로 파생한다(EP-12).

### 부팅/등록 변경 시 기존 소비처

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `RuntimeToolRegistry` revision | 서버 추가/제거 시 revision 증가 → 다음 턴 런타임 재spawn(`plugins.ts:12-15` 주석). 작업 완료·제거 때만 발생 | AC15 |
| `runtimeApprovalToolNames` | `archive_getAttachment` 1개가 승인 목록에 추가 | AC14 |
| `AppSettingsTab` 소비 2곳 | union 확장 — 기존 분기 영향 없음 | AC1 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `addSource`/`rescan` → 큐 → 유휴면 즉시 fork. worker는 `start` 메시지 수신 후 DB를 열고 작업 1개를 끝내면 종료한다.
- 취소: `cancel` 메시지 → runner가 항목 경계에서 멈추고 현재 배치를 커밋 → `done{outcome:'cancelled'}`. 10초 무응답이면 `kill()`하고 `interrupted`.
- 종료/crash: 앱 quit 시 worker kill. worker `exit` 코드 ≠0이고 `done`이 없으면 소스 `error`(`worker_exit`). 부팅 시 `resetInterrupted`.
- 부분 실패: 항목 실패는 `source_item(state='failed', error_code)`로 기록하고 계속한다. 소스 경로 자체 접근 불가면 `missing`.
- **다중 저장소 쓰기**: 가져오기는 `archive.db`에만 쓴다(D-012, 파일 복사 없음). 도구 등록(메모리)은 DB에서 파생되며, 작업 완료 후 sync 전에 죽어도 부팅 sync가 재계산한다. 첨부 내보내기는 Temp 파일 1곳만 쓴다(0237 `exportMailAttachment` stage→rename 계약 유지).

## 14. 성능 / 상한 / 최적화

- 도구 출력 상한(문자): search ≤ 50 × (300 + 헤더 ~400) ≈ 35,000 · thread ≤ 40 × (1,000 + 헤더·첨부 ~500) ≈ 60,000 · get ≤ 20,000 + 헤더.
- 쓰기 배치: 100항목/트랜잭션, 진행 이벤트 초당 ≤4회.
- 메모리: EML 1건 ≤50 MiB 읽기. PST는 라이브러리 동기 읽기(항목 단위).
- 2글자 LIKE는 전체 스캔이다 — AC25에서 1만 건 기준 시간을 기록하고, 1초 초과면 bigram 보조 색인을 NEXT_HANDOFF로 올린다.
- 용량: 인용 앞 2,000자만 저장해 긴 스레드의 인용 중복이 메일 수에 비례해 커지지 않게 한다(D-016).

## 15. 외부 구현 포트 / 문서 계약

- 외부 구현 포트: 없음(배포 레시피 불필요 — D-007·D-013).
- 문서: `IPC_CONTRACT.md` §1 도메인 목록·§2 신규 `§2.6-c 메일 아카이브` 표, `arch/backend/persistence.md`에 `#### Mail Archive DB`, `TRD.md §4`에 `pst-extractor` 행(MIME 행의 "Mail Plugin opt-in"에 아카이브 사용 추가), `app/AGENTS.md §의존성 정책` 채택 목록, `docs/generated/inventory.md` 재생성.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 배포가 고치는 파일은 `app/deployment/`뿐 | `plugins.ts:72-74` | §11 bootstrap 직접 등록 | 유지 — 아카이브는 배포별 설정이 없는 core 등록(artifacts 선례) |
| 범용 registrar 금지 | `plugins.ts:6-10,43-45` | §11 `binding.ts` | 유지 — 아카이브 전용 sync 함수 1개 |
| 머지된 마이그레이션 수정 금지 | `app/AGENTS.md:84` | §11 `0001_archive.sql` 신규 | 유지 |
| 0237 D-020 첨부 본문 색인 비범위 | `0237/plan.md:250` | §6 비범위 | 유지 |
| 0237 비범위 "메일 전용 renderer 화면" | `0237/plan.md:250` | §11 MailArchiveTab | 변경 아님 — POP3 플러그인 범위 결정. 아카이브는 D-006 |
| 코드 수치 문서 금지 | root `AGENTS.md` 원칙 4 | §15 인벤토리 재생성 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| pst-extractor가 대형·ANSI PST에서 실패 | 항목 단위 실패 격리(AC6 방식), AC25 실기. 실패 시 S2만 재설계 |
| RTF 전용 PST 본문 | 본문 없이 헤더만 색인. AC25에서 비율 기록 |
| Exchange 내부 주소(`/O=…` DN) | `pst-props.ts`가 SMTP 속성(`0x5D01`, 수신자 SMTP) 우선, 없으면 표시 이름. AC21 UT가 매핑 규칙 단언 |
| 2글자 LIKE 성능 | §14 측정 후 후속 |
| 원본 드라이브 분리(네트워크) | 검색·스레드는 DB로 동작, 원문·첨부만 `sourceAvailable:false`/`source_missing` |

- 되돌리기 어려운 결정: 스키마 `0001_archive.sql`, IPC 도메인 `archive`, 도구 서버 id `orca_mail_archive`, 도구 이름 4개.
- 신규 의존성: `pst-extractor@1.12.0`(D-009 승인). `onnxruntime-node`·`@huggingface/tokenizers`는 S3에서 추가(D-008·D-010 승인, 이 handoff에서 설치하지 않음).

### S3 (임베딩) 착수 조건과 예정 형상 — 규범 아님

- 조건: D-011 해소. 스파이크 보고서(후보 모델별 파일 크기·라이선스·1만 건 계산 시간·한국어 질의 적중 비교) → 사용자 승인.
- 확인된 사실: `onnxruntime-node@1.30.0`은 N-API 바이너리를 포함하고(win32 x64 약 67 MB, DirectML 포함), linux/x64 설치 시 CUDA 패키지를 내려받는 postinstall이 있다(`--onnxruntime-node-install=skip` 플래그 존재). 패키징 시 대상 플랫폼 외 바이너리 제외와 `asarUnpack`이 필요하다.
- 예정 형상: 모델 팩(`model.onnx`·`tokenizer.json`·`manifest.json{id, dim, maxTokens, queryPrefix, passagePrefix, pooling}`), 마이그레이션 `0002`의 `embedding(mail_id, model_id, vec BLOB)`, 임베딩 worker(utilityProcess), 전수 코사인 top-100 + FTS top-100의 RRF(k=60).

## 18. 영향 받는 파일 / 문서

- `app/package.json`, `app/package-lock.json`, `app/electron-builder.yml`
- `app/src/main/features/plugins/mail-content.ts`, `…/mail/normalize.ts`, `…/mail-archive/**`
- `app/src/main/app/bootstrap.ts`, `app/src/main/app/handlers/archive.ts`
- `app/src/shared/{mail-archive,ipc,protocol,app-error}.ts`, `app/src/preload/index.ts`
- `app/src/renderer/src/shared/api/ipc.ts`, `…/features/settings/**`, `…/shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md`, `docs/arch/backend/persistence.md`, `docs/TRD.md`, `app/AGENTS.md`, `docs/generated/inventory.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`, `app/src/main/AGENTS.md`(경계), `app/src/renderer/AGENTS.md`(토큰·레이어).
- ABI/네트워크 제약: DB IT는 `npm test`로만 실행. `pst-extractor`는 순수 JS라 ABI 영향 없음.
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트: §7-A 운영 gate 표.
- 사람 실기: AC25.

## READY self-review

- [x] Decision Ledger가 6턴의 결정을 보존한다(D-001~D-011 사용자, D-012~D-019 설계자, D-011 OPEN).
- [x] Part I만으로 완료 상태를 설명할 수 있다.
- [x] 조건절 재해석 없음 — D-004 "아니"를 "아카이브는 자체 쿼리"로만 적용, POP3 불변(AC19).
- [x] 사용자 결정(D-011)과 조사 사실(§8)을 구분했다.
- [x] 수치·전칭 실측(§8 전수 표).
- [x] eslint 경계·마이그레이션 append-only·IPC 변경 절차를 설계 입력으로 반영.
- [x] 각 AC에 행동 단언·검증·도달 경로가 있다.
- [x] Baseline V, 모든 NEW node에 REQUIRED pair, 영향 INHERITED 1개는 REGRESSION(VP-23).
- [x] 적대 증거는 구조/배선/가중 oracle에만 선택(VP-01·02·03·04·06·12·13·15).
- [x] 사람 실기는 AC25만.
- [x] 상태는 union, 불가능 조합 없음.
- [x] 출력 상한·배치 상한 계산(§14).
- [x] 본문 완성 후 `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 기록.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> 권장 순서: S1(AC1~AC19·AC24) → S2(AC20~AC23). 단계마다 커밋하고 `Status: partial`로 보고해도 된다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-… | … | … | … | … | — |

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태에 소비자가 있는가 | … | … |
| 이번에 만든 실패 경로가 §5 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 관측한 게이트 산출 | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| AC 자기보고 | … |
| 합계 검산 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- …

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
