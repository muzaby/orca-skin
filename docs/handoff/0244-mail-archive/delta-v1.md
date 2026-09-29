# 0244 ΔV1 — 조사 기반 전처리·검색 구체화

작성자: **Codex** · 2026-09-29 · 상태: **DRAFT** · 라운드: 1(설계 보완).

기준 V는 `0244:V1@3f9558d9ec7fca52bc7c55533031051ba5d5b96a`이며 로컬 `git cat-file -t`와 원격 PR head를 확인했다. 유효 V는 **V1 + ΔV1**이고, 이 문서에 명시한 AC·노드·계약 보완만 V1보다 우선한다.

조사 판정 정본은 [research-review.md](research-review.md), 기존 제품 흐름·범위·수명·강제 지점은 [plan.md](plan.md)다. 보고서의 수치를 그대로 복제하지 않고 메일 이력 조회에 필요한 동작으로 바꾼다.

## 1. Decision Ledger 변경

D-001~D-013 ACTIVE와 D-014~D-016 OPEN을 유지한다. 첨부 본문 제외·두 AI 환경·로컬/API 임베딩·개인보관함·원본 비복제·Codex 독립안이라는 사용자 결정을 변경하지 않는다.

| ID | 결정 | 이유/조건 | 출처 | 상태 / AC |
|---|---|---|---|---|
| D-017 | 표시 본문·키워드 필드·임베딩 입력을 분리하고 변환 규약을 버전 관리 | 전송 헤더·중복 본문·메타데이터가 검색을 지배하지 않게 함 | 조사 + Codex 제안 | ACTIVE / AC2·4·7·10 |
| D-018 | 인용/서명은 가역 분류, 자동 의미 삭제 없음 | 원 메일 부재·인라인 답변·업무 면책 조건 유실 방지 | 조사 비판 + Codex 제안 | ACTIVE / AC4·5·14 |
| D-019 | 메시지 버전별 chunk가 검색 단위, 확인된 스레드는 context 단위 | 스레드 전체 재임베딩과 잘못된 발신자·날짜 귀속 방지 | Onyx 구조의 선택적 적용 | ACTIVE / AC5·8·13·14 |
| D-020 | 기본 관련도 검색에 시간 감쇠 없음, hard filter와 정확 식별자 자동 완화 없음 | 과거 결정 근거·번호 검색의 정확성 보존 | 조사 권고 수정 | ACTIVE / AC7·8·14·16 |
| D-021 | query cache와 vector 파생 색인은 원문·출처와 별개이며 epoch로 무효화 | 계산 재사용이 범위·삭제·모델 변경을 우회하지 않게 함 | 조사 + Codex 제안 | ACTIVE / AC10·12·19~21 |
| D-022 | 로컬 모델 비교를 e5-small, EmbeddingGemma 768/256으로 구체화; API 동일 평가 | 공개 점수 대신 동일 한국어 메일 질의셋으로 선택 | 조사 + 공식 모델 카드 | ACTIVE / AC10·11·19·24 |

D-014의 승인 대기 후보에 `sqlite-vec`를 **비교 후보**로 추가한다. D-015 모델 선택은 여전히 OPEN이며 D-022는 평가 순서·대상을 정한 것이지 모델 채택이 아니다.

이번 Delta는 stable node ID의 계약을 CHANGED로 보강한다. SUPERSEDED로 노드를 분해하거나 V1의 AC·선택 mutation을 폐기하는 항목은 없으며, 기존 증거는 §7의 같은 번호 pair에 계속 귀속한다.

ACTIVE 결정 ↔ AC 대조: D-001~D-013과 D-017~D-022를 V1·§7·본문 경로에 대조해 충돌 0을 확인했다. D-022의 모델 비교와 D-015의 채택 결정은 구분하며, D-014~D-016의 OPEN 상태를 본문·보드에서 유지했다.

## 2. Product / UX 보완

### 검색과 본문 표시

| 상황 | 표시/동작 | 이유 |
|---|---|---|
| 반복 인용 포함 메일 | 새 본문 우선 표시, `인용문 보기`·`서명 보기`로 전체 텍스트 펼침 | 검색을 정제해도 증거를 숨기지 않음 |
| hit가 접힌 인용/서명 안에 있음 | 해당 구간을 자동 펼치고 `인용문에서 일치` 표시 | 사용자가 일치 이유를 즉시 검증 |
| 본문 해석이 불확실함 | `문자 해석 확인 필요`·선택한 본문 형식·처리 이유를 상세 정보에 표시 | mojibake를 정상 자료처럼 요약하지 않음 |
| plain/html이 서로 다른 내용을 가짐 | 자동 선택한 본문 하나를 색인하고 `대체 본문 보기` 제공 | 두 표현을 별개의 메일이나 중복 검색 결과로 만들지 않음 |
| 의미 유사 결과만 있음 | `단어 일치 없음 · 의미가 비슷한 메일` 영역 | 일치와 추정을 구분; RRF 점수를 확률로 표시하지 않음 |
| 정확번호/이름/기간이 안 맞음 | 기존 필터를 유지하고 완화 제안만 제공 | 시스템이 사용자의 질문 범위를 몰래 바꾸지 않음 |
| 날짜·동일 본문이 다른 메일 여러 건 | 각 메일 유지, 확인된 대화별 접기 제공 | “승인합니다” 같은 짧은 문장으로 사건을 합치지 않음 |
| 과거 이력 질문 | 기본 관련도와 시간순 근거를 유지 | 보고서의 시간 감쇠 공식은 기본 검색에 적용하지 않음 |

본문 선택·분류의 진단 정보는 상세의 `처리 정보`에 둔다. 일반 결과 목록에 tokenizer·pooling·engine version 같은 구현 정보를 노출하지 않는다.

scope가 바뀌면 인용 결과의 중복 접기와 주변 문맥을 새 scope에서 다시 계산한다. 다른 자료원에 원문이 있다는 사실만으로 현재 보관함의 인용을 감추지 않는다.

## 3. 전처리·저장·청크 계약

### AS-IS → TO-BE

AS-IS 제품 코드는 여전히 POP3의 `PostalMime.parse(raw)`→`normalizeMail`이고 보관함은 미구현이다. V1 설계에는 body segment·fingerprint·scope가 있지만 MIME alternative 선택, 인용 판정 실패 처리, chunk 입력 예산은 추상적이었다.

```text
EML bytes / PST body representations
 → MIME·MAPI reader (첨부 EML도 별도 payload로 분리)
 → BodyCandidate[] + metadata + quality
 → 선택한 정규화 snapshot + 보존한 대체 표현
 → 보수적 segment 분류
 → lexical projection / embedding payload / citation span
 → 영속 FTS + canonical vector BLOB
 → scope 적용 hybrid → 중복 접기 → 문맥 확장 → evidence
```

| 비교 축 | V1의 빈칸 | ΔV1의 정본 / seam |
|---|---|---|
| 본문 선택 | plain 없으면 HTML 변환 | `body-selection.ts`가 품질/중복/첨부 경계와 선택 이유 반환 |
| 본문 분류 | new/quote/signature/unknown | `segment-classifier.ts`의 보수적 판정·overlap 금지·원문 offset |
| 색인 표현 | 제목·본문 가중치 | `index-projection.ts`의 whitelist 필드·모델별 prompt renderer |
| chunk/중복 | body hash·메일 집계 | `chunker.ts`의 연속 span과 `embedding-key.ts`의 실제 입력 hash 분리 |
| 조회 | 후보 융합·thread 확장 | `retrieval-policy.ts`의 hard/soft 제약·중복 접기·같은 버전 이웃 확장 |
| 계산 재사용 | 세대 분리 | `query-embedding-cache.ts`·`vector-search.ts`와 각 epoch/lease |

새 순수 파일은 `main/features/plugins/mail-archive/` 아래에 두고 Electron/DB/native import를 하지 않는다. reader·store·embedding adapter·UI는 기존 §11의 주입 경계를 유지한다.

### 3.1 MIME와 첨부 경계

EML adapter는 설치된 PostalMime의 `forceRfc822Attachments: true`를 명시해 `message/rfc822` 하위 본문을 보관함 본문으로 합치지 않는다. 단순 본문 안의 “전달된 메시지” 텍스트는 quote segment로 남기고, 실제 첨부 EML/PST·text/plain attachment는 이름·크기·locator만 저장한다.

`text/plain`과 `text/html`은 대체 표현 후보이며 기본 색인에는 하나만 넣는다. 파일명은 제목 대신 쓰지 않고 제목 없음을 표시하며, title boost는 실제 Subject에만 적용한다.

기존 POP3 parser 옵션은 바꾸지 않는다. archive reader의 별도 옵션과 동일 fixture로 첨부 본문 sentinel이 source DTO→lexical→embedding→LLM 경로에 없는지 확인한다.

### 3.2 본문 선택과 문자 해석

1. 정상적인 plain이 있으면 우선한다. 공백/깨진 문자만 있거나 확인된 “HTML로 보세요” placeholder이고 정상 HTML이 있을 때 HTML 텍스트로 대체한다.
2. 길이가 짧다는 이유만으로 정상 plain을 버리지 않는다. plain/html 불일치는 `alternative_mismatch`, charset 오류 가능성은 `decode_suspect`로 남긴다.
3. HTML은 비실행 tree에서 script/style·명시적인 hidden 요소를 제외하고 문단·목록·표 행 경계를 유지한다. CSS cascade·외부 stylesheet로 숨김을 완전히 판단한다고 주장하지 않는다.
4. text의 NFC 같은 변환은 snapshot 생성 전에 한 번 수행하고 normalizer revision에 넣는다. 제로폭/제어문자는 검색 projection에서 목적별 처리하되 emoji·업무 식별자의 의미를 일괄 삭제하지 않는다.
5. 선언 charset 해석은 기존 MIME 파서에 맡기고, 잘못된 선언을 복구하려고 이미 깨진 JS string에 다른 decoder를 다시 적용하지 않는다. 강제 복구는 원본 part bytes와 transfer encoding을 확보한 adapter에서만 가능하다.

현재 PostalMime 공개 API는 text/html을 반환하지만 part-level charset override hook은 노출하지 않는다. 따라서 첫 구현은 표준 charset/alias 케이스를 검증하고 미복구 항목을 표시하며, 범용 자동 복구·ftfy 도입은 D-014/D-015의 별도 실증 없이는 추가하지 않는다.

영어 메일·숫자·코드만 있는 메일도 정상일 수 있으므로 “한글 5%”를 합격 조건으로 쓰지 않는다. `decode_suspect` 메일은 키워드 열람은 가능하되 기본 의미검색/context에서는 제외하고, 사용자가 해당 메일을 직접 열거나 선택한 경우 경고와 함께 읽는다.

schema 보완은 `body_variant(versionId, kind, text, qualityFlags, selectionReason)`와 `mail_version.selectedVariantId`다. 선택 표현 하나에만 offset을 귀속하고, 대체 표현 열람은 인용을 그 표현으로 자동 바꾸지 않는다; 정상화 규약 변경 시 새 mail_version을 만든다.

V1의 메일당 본문 2 MiB UTF-8 상한은 선택 본문과 보존하는 대체 본문 텍스트의 합에 적용한다. 같은 정규화 텍스트는 한 variant로 참조하고, 합계 초과는 `oversized`와 이유를 표시한다. 선택 본문이나 대체 표현을 조용히 잘라 정상 처리하지 않는다.

### 3.3 인용·서명 분리

`segment-classifier.ts`는 `[start,end)`, kind, ruleId, confidenceClass(certain/uncertain)를 반환한다. 원문의 모든 code unit은 정확히 한 segment에 속하고 원문을 이어 붙이면 snapshot과 동일해야 한다.

plain의 `>` 연속 블록·확인된 원본 헤더 구분선, HTML의 blockquote·클라이언트 컨테이너는 quote 근거다. 문장 중 “보낸 사람:”이나 한 줄 `--`만으로 그 뒤 전체를 잘라내지 않는다.

quote 사이에 새로 쓴 답변은 new/unknown으로 남긴다. 서명·면책도 확실한 구분 구조만 분류하고, 발신자별 반복 꼬리 통계는 진단 자료로만 사용한다.

new/unknown은 주 검색 본문, quote는 낮은 lexical 가중치의 별도 필드, signature는 이름/정확 문자열 발견을 위한 낮은 가중치 lexical로 남긴다. new/unknown과 quote는 segment별로 임베딩하되 quote 중복은 조회 단계에서 접는다. 확실한 signature는 기본 embedding/context에서 제외하지만 hit/직접 선택 때 펼쳐 읽을 수 있다.

quote는 원 메일 존재 여부만으로 인덱스에서 삭제하지 않는다. 동일 문단·동일 의미의 원문 대응이 확인되고 **현재 scope에서 접근 가능할 때만** 결과/context 반복을 접으며, 인용자·시각·원문 없음/범위 밖을 표시한다.

인용 대응 hash는 공백·인용 접두를 정규화해 계산하되 부정어·수치·날짜를 제거하지 않는다. 유사도만 높은 수정 인용은 접지 않아 “10대”→“20대”, “승인”→“미승인” 변경을 보존한다.

### 3.4 색인 필드와 입력 예산

| 표현 | 구성 | 제외/보존 규칙 |
|---|---|---|
| display snapshot | 선택 본문 전체와 segment, 별도 mail metadata | 전송 헤더를 본문 앞에 덧붙이지 않음 |
| lexical | subject, fromName/fromAddr, to/cc, bodyNew/unknown, bodyQuote, bodySignature, attachmentNames | Bcc는 occurrence scope를 통과한 별도 메타 필터; 전역 FTS에 합치지 않음 |
| embedding | 모델 필수 prompt + 실제 Subject + 선택적 발신자 이름/메일 날짜 + 연속 본문 span | 전체 주소목록·Received/DKIM/ARC/X 헤더·첨부 본문·로컬 경로 제외 |
| context | snapshot 문단 + 발신자·날짜·subject·관계 근거 + evidenceId | 모델이 생성한 요약/질문을 원문 사실로 재색인하지 않음 |

모델의 최대 token L에서 special token 예약량 S를 뺀 `B=min(512,L-S)`를 첫 비교 예산으로 쓴다. 필수 prompt P는 절대 제거하지 않고 optional metadata H는 `min(128,floor((B-P)×0.25))` 이내로 줄인다.

본문 공간이 `min(256,B-P)`보다 작으면 optional metadata부터 제거한다. `B≤P`는 모델 팩 설정 오류로 처리하고, API가 tokenizer를 제공하지 않으면 그 API의 검증된 token-count/byte-limit 계약이 D-015 완료 조건이다.

chunk는 한 메일 버전의 연속 segment 내부에서 문단→문장→token 순서로 나눈다. 초기 overlap은 0, 문맥은 검색 뒤 이웃 chunk로 확장하며 `0 vs 32 token overlap`은 S0 평가 항목이다.

`chunkId = hash(versionId, variantId, segmentId, start, end, chunkerRevision)`이고 내용이 같다고 출처 identity를 합치지 않는다. `embeddingKey = hash(profileFingerprint, purpose, UTF8(renderedInput))`라서 제목·날짜·prompt가 달라지면 새 계산이다.

캐시는 실제 최종 입력이 같은 경우만 공유한다. 다른 스레드의 “네, 승인합니다”를 하나의 근거로 만들거나, scope 밖 메일의 메타데이터가 붙은 vector를 현재 인용의 대용으로 쓰지 않는다.

## 4. 검색·순위·문맥 구성

### 4.1 하이브리드와 필터

FTS는 persistent index를 유지한다. `bm25()`의 낮은 값이 더 좋은 순위라는 규약을 lexical rank로 변환하고 cosine과 점수 자체를 더하지 않는다.

초기 lexical 가중치 후보는 subject=3, from=2, to/cc=1, bodyNew/unknown=1, quote=0.2, signature=0.1, attachmentNames=2이다. 이는 다른 제품 상수를 복사한 확정 최적값이 아니며, S0에서 가중치 없는 기준과 비교하고 선택 결과를 profile revision에 남긴다.

양쪽 분기에서 scope를 먼저 적용하고 각 100 candidate를 조회한 뒤, mail/version별 최고 chunk를 대표로 삼아 중복 rank 투표를 없앤다. 양쪽 rank에 `Σ1/(60+rank)`를 적용하고 동률은 안정적인 내부 ID로 정렬한다.

정확 문서번호·인용구가 사용자 hard constraint이면 양쪽 결과를 해당 조건에 맞는 집합으로 제한한다. 자연어의 일반 단어는 lexical AND와 semantic soft query로 처리하고, 명시 날짜/사람/폴더와 혼동하지 않는다.

FTS 0건이면 hybrid의 같은 범위 semantic 결과를 별도 이유와 함께 반환한다. lexical-only 요청은 자동 API 요청으로 바꾸지 않으며, vector 후보가 있다는 이유만으로 “근거 충분”을 표시하지 않는다.

### 4.2 시간과 질문 재작성

기본 `관련도`는 나이 감쇠 1.0이다. `최신순`은 사용자 선택 정렬이고, “최종 승인”은 모든 최신 메일에 점수를 더하는 문제가 아니라 확인된 승인/변경 근거를 시간순으로 비교하는 문제로 처리한다.

도구 사용 에이전트가 원 질문과 최대 두 개의 대체 query를 구성할 수 있지만 별도 LLM query-generation 서버를 추가하지 않는다. 같은 run의 최대 검색 variant는 원 질의 포함 3, hard filter/scope는 고정하고 사용한 query 목록을 도구 결과에 남긴다.

변형 검색은 최초 검색으로 충분하지 않을 때만 수행한다. 후보 문서를 다시 임베딩하는 pseudo-reranker나 indexing 시 LLM 질문 생성은 추가하지 않는다.

### 4.3 Context 확장

상위 seed chunk의 앞뒤 1개를 **같은 version·같은 본문 variant·같은 scope**에서 확장한다. 6 seed면 최대 18 chunk이며 겹치는 span을 합친 뒤 V1의 24메일·64 KiB context cap을 적용한다.

스레드 앞뒤 확장과 이웃 chunk 확장은 별도 단계다. 중복 인용을 접어 확보한 예산은 누락 부모·상충 조건·최종 확인된 이벤트에 배정하며 오래된 최초 요청을 일괄 버리지 않는다.

인용은 실제 snapshot의 연속 범위를 가리킨다. optional embedding metadata를 본문 인용 offset으로 취급하거나 사후 의미 유사도만으로 답변 문장에 출처를 자동 조작하지 않는다.

## 5. 캐시·동시성·오류

query embedding cache는 프로세스 메모리에만 두고 TTL 15분, LRU 최대 256 entry를 초기 예산으로 둔다. key는 profile fingerprint·purpose=query·최종 query bytes hash·session/scope revision·credential epoch이며 원문 query를 로그에 남기지 않는다.

동일 key의 동시 요청은 계산을 공유하되 취소는 subscriber별로 처리한다. subscriber가 모두 사라지면 underlying 요청을 abort하고, 실패/401/timeout 응답은 성공 캐시에 넣지 않는다.

profile/generation 전환·scope 변경·source 제거·session 삭제는 관련 epoch를 올리고 entry·in-flight를 무효화한다. 응답 직전 epoch를 재검사하므로 늦은 API 응답이 캐시나 삭제된 vector를 되살리지 못한다.

document embedding 재사용은 canonical vector와 참조 chunk 관계를 저장한다. 마지막 chunk 참조 제거 때 vector와 cache를 함께 정리하며, 출처가 다른 메일의 존재/삭제는 각 occurrence/version이 결정한다.

로컬 embedding worker는 query 우선 큐를 두고 문서 microbatch 사이에 양보한다. 실행 중 native inference를 즉시 선점할 수 있다고 가정하지 않으며 문서 microbatch 초기 상한 8, 실제 취소 응답·query p95로 크기를 조정한다.

API batching 상한 32와 동시 요청 2는 V1을 유지한다. query cache miss와 문서 색인이 경쟁할 때 다음 사용 가능한 slot을 query에 배정한다. 질의 임베딩은 최대 3 variant×각 1요청×최대 3시도=9요청/질문이며 문서 색인 요청량과 구분한다.

## 6. 저장 엔진과 모델 후보

### 6.1 sqlite-vec의 위치

기준은 V1의 `canonical float32 BLOB + worker exact scan`이다. `sqlite-vec v0.1.9`는 같은 BLOB로부터 재구축 가능한 **파생 검색 엔진**으로 비교하며, 현재 웹 문서에 보이는 alpha 기능을 stable 버전 계약에 넣지 않는다.

```ts
interface VectorSearchPort {
  search(input: {
    generationId: string;
    scope: ResolvedArchiveScope;
    queryVector: Float32Array;
    limit: number;
    signal: AbortSignal;
  }): Promise<ReadonlyArray<{ chunkId: string; distance: number }>>;
}
```

ResolvedArchiveScope는 main/worker가 해석한 신뢰된 범위이며 모델이 준 SQL·ID 목록이 아니다. vec0가 표현할 수 없는 다중 source occurrence·날짜 미상·선택메일 필터는 **scope를 적용한 canonical BLOB scan으로 fallback**하고, 전역 KNN 후 필터링으로 대신하지 않는다.

vec0 사용 시 차원별 테이블과 generation 구분을 두고 engine revision·corpus revision·row mapping을 검증한다. canonical BLOB와 derived vector의 쓰기를 한 SQLite transaction으로 commit한다. extension 오류면 해당 transaction을 rollback하고, canonical 쓰기와 engine unavailable 표기를 새 transaction에서 함께 commit해 exact 경로를 사용한다. 이 fallback도 실패하면 기존 active generation을 유지하며 성공으로 보고하지 않는다.

main 프로세스에서 extension을 로드하지 않는다. DB writer와 읽기 전용 vector worker 연결만 고정 앱 번들의 검증된 extension을 로드하고, writer의 derived index transaction과 읽기 snapshot으로 정합성을 맞춘다.

engine 교체는 **같은 vector의 재색인**이고 model/tokenizer/prompt/chunker 변경은 **재임베딩**이다. sqlite-vec 도입이 자동 ANN 성능 향상을 보장하지 않으며 5만 메일 exact latency·복합 scope·Windows DLL 로드·삭제 회귀를 비교한 뒤 D-014에서 채택한다.

canonical BLOB를 vec0와 동시에 보존하면 벡터 payload 저장이 중복된다. V1의 200,000chunk×768dim 예시에서 canonical+derived≈1.229GB, 두 generation 동시 유지≈2.458GB이며 DB/FTS/본문은 별도이므로 디스크 예산을 다시 측정한다.

### 6.2 모델 비교

| 후보 | 고정할 실행 규약 | 비교 목적 |
|---|---|---|
| `intfloat/multilingual-e5-small` 384d | query/passage prefix, attention-mask average pooling, normalize, 정확 모델·tokenizer revision | 첫 CPU 기준 후보; 한국어/영문 혼합 회수율·메모리 |
| `google/embeddinggemma-300m` 768d | 모델 카드의 query/document prompt, 제목 슬롯, 지원 dtype·conversion hash | 품질 비교 기준 |
| 같은 Gemma 256d | 768d 결과에서 첫 256요소 절단 후 L2 재정규화, 별도 generation fingerprint | vector 저장·검색 비용 감소와 회수율 손실 측정 |
| 사용 가능한 embedding API | 실제 모델/revision, query/document mode, token/batch/auth 계약 | 같은 질의셋의 품질·지연·색인/질의 비용 비교 |

MRL 차원 축소는 모델 추론 연산·모델 가중치 크기를 1/3로 만드는 기능이 아니다. e5는 MRL 모델로 가정하지 않아 384d를 임의로 잘라 쓰지 않는다.

ONNX 파일이 있다는 사실만으로 선택한 런타임·dtype·tokenizer와 호환된다고 결론내리지 않는다. 원 모델 golden vector와 변환본 허용오차·검색 순위 비교, 모델 팩 라이선스/반입 가능 여부를 D-015에 기록한다.

## 7. AC / Delta V / 강제 지점

아래는 같은 번호 AC의 **추가 직접 oracle**이다. 기존 AC의 정상 동작과 V1에서 선택한 M-CITE/M-SCOPE/M-WIRE/M-PACK을 모두 유지한다; 새 AC 번호를 늘려 분모를 바꾸지 않는다.

| AC | ΔV1 추가 행동·검증 | production 경로 |
|---|---|---|
| AC2 | plain/html 대체 본문을 한 번만 색인, HTML-only·한글 charset·영어/코드 메일을 field golden으로 비교 | reader→body-selection→version |
| AC4 | 인라인 답변·인용·서명을 재결합하면 snapshot과 동일, hit가 접힌 구간이면 펼침 | classifier→snapshot→viewer |
| AC5 | 같은 문장·다른 메일은 두 출처; 같은 rendered payload만 계산 공유, 제목 변경은 cache miss | identity→chunk/key→store |
| AC7 | 컬럼 가중치와 짧은 토큰 fallback, exact번호·동명이인 hard constraint가 양쪽 검색에 동일 | query→lexical/vector→rank |
| AC8 | quote 중복 rank 투표 방지, FTS 0건 semantic 이유 표시, lexical-only는 외부 요청 없음 | hybrid→fold→result DTO |
| AC9 | 첨부 EML·inline rfc822·text/plain 첨부의 고유 sentinel이 전송/색인 payload에 없음 | reader 옵션→projection→embedding/context |
| AC10 | 필수 모델 prompt 보존·입력 budget 검증, query cache hit 때 vector·결과 동일 | renderer→EmbeddingPort→cache/worker |
| AC12 | tokenizer/prompt/차원 변경 cache miss·새 generation, engine-only 재구축은 embed 0회 | profile→cache→generation/engine |
| AC13 | 대체 본문·prefix가 인용 offset으로 오인되지 않고 원래 연속 문단을 열음 | chunk span→evidence→viewer |
| AC14 | 오래된 결정·수정 인용·부모 없는 인용·선택 scope 밖 부모의 골드 근거 보존 | seeds→quote fold→neighbors/thread→context |
| AC19 | cold/warm·색인 중 query·microbatch 크기별 p95/RSS/cancel·embedding 요청 수 기록 | cache→scheduler→engine |
| AC20 | cache/derived index 생성 도중 kill·취소에서 기존 active 검색 복구 | lease/epoch→transaction→restart |
| AC21 | 자료원/세션 제거와 in-flight 완료 경합에서 cache·derived rows·늦은 결과 재생성 없음 | revoke→refcount purge→return guard |
| AC24 | 선택 엔진의 설치본 load/search/delete/reopen과 모델 추론, 없을 때 exact fallback | packaged worker→engine/model |

### Node·pair 적용

기준 V1의 23 pair 중 아래 requiredness로 이번 변경을 검증한다. CHANGED는 같은 stable ID의 보완이지 교체 노드 분해가 아니며, 표에 기재한 V1 oracle/EP도 여전히 의무다.

| Pair | left ↔ right / provenance | requiredness | 변경 경로·직접 oracle | 추가 EP / 기존 EP·적대 증거 |
|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01~03 / CHANGED | REQUIRED | reader→선택 본문→저장; AC2 golden | EP-15(4); V1 전부 |
| VP-02 | R-02 ↔ AT-04~06 / CHANGED | REQUIRED | 분류→identity→본문; 재결합·충돌 | EP-16(4); V1 전부 |
| VP-03 | R-03 ↔ AT-07~09 / CHANGED | REQUIRED | query→fusion→UI; 결과·payload | EP-17(3), EP-18(4); V1 전부 |
| VP-04 | R-04 ↔ AT-10~12 / CHANGED | REQUIRED | prompt→cache/engine→결과; fingerprint·동등성 | EP-17(3), EP-19(4), EP-20(3); V1 전부 |
| VP-05 | R-05 ↔ AT-13~15 / CHANGED | REQUIRED | span→context→citation; 연속 문단·coverage | EP-16(4), EP-18(4); V1 전부·M-CITE |
| VP-06 | R-06 ↔ AT-16~18 / INHERITED | REGRESSION | 같은 scope→새 projection/cache→기존 AI/첨부 | EP-19(4), EP-20(3); V1 전부·M-SCOPE |
| VP-07 | R-07 ↔ AT-19~21 / CHANGED | REQUIRED | cache/index job→revoke→복구; late write 거절 | EP-19(4), EP-20(3); V1 전부 |
| VP-08 | R-08 ↔ AT-22~24 / INHERITED | REGRESSION | 옵션 분리/설치본→기존+신규 경로 | EP-15(4), EP-20(3); V1 전부·M-WIRE |
| VP-09 | SD-01 ↔ ST-01 / INHERITED | REGRESSION | import→derived/cache→중단/제거; journal 복구 | EP-19(4), EP-20(3); V1 전부 |
| VP-10 | SD-02 ↔ ST-02 / CHANGED | REQUIRED | query variants→context→근거 열람; 골드 timeline | EP-17(3), EP-18(4); V1 전부 |
| VP-11 | SD-03 ↔ ST-03 / CHANGED | REQUIRED | profile→cache miss/index rebuild→active; epoch | EP-19(4), EP-20(3); V1 전부 |
| VP-12 | SD-04 ↔ ST-04 / INHERITED | REGRESSION | 세션전환→quote fold/cache→viewer; 교차 노출 없음 | EP-16(4), EP-19(4); V1 전부 |
| VP-13 | AR-01 ↔ IT-01 / CHANGED | REQUIRED | quality/match reason DTO→IPC→UI; 원인·상태 일치 | EP-15(4), EP-18(4); V1 전부 |
| VP-14 | AR-02 ↔ IT-02 / CHANGED | REQUIRED | variant/chunk/vector→DB→검색; 실제 transaction | EP-16(4), EP-17(3), EP-20(3); V1 전부 |
| VP-15 | AR-03 ↔ IT-03 / CHANGED | REQUIRED | model renderer/cache→adapter→결과; doc shape·오류 의미 | EP-17(3), EP-19(4); V1 전부 |
| VP-16 | AR-04 ↔ IT-04 / INHERITED | REGRESSION | 새로운 span/품질 flag→기존 도구→출처 UI | EP-16(4), EP-18(4); V1 전부·M-CITE/M-WIRE |
| VP-17 | AR-05 ↔ IT-05 / INHERITED | REGRESSION | archive parser 옵션/engine→설치본; POP3 불변 | EP-15(4), EP-20(3); V1 전부·M-PACK |
| VP-18 | MD-01 ↔ UT-01 / CHANGED | REQUIRED | MIME 후보→분류/identity; decode·offset·sentinel | EP-15(4), EP-16(4); V1 전부 |
| VP-19 | MD-02 ↔ UT-02 / CHANGED | REQUIRED | hard/soft→RRF→fold; 정확 집합·순위 | EP-18(4); V1 전부 |
| VP-20 | MD-03 ↔ UT-03 / CHANGED | REQUIRED | 인용 대응→이웃/thread→context; 손실·초과 없음 | EP-16(4), EP-17(3), EP-18(4); V1 전부 |
| VP-21 | MD-04 ↔ UT-04 / CHANGED | REQUIRED | prompt/hash→cache/차원→검색; hit/miss·MRL | EP-17(3), EP-19(4), EP-20(3); V1 전부 |
| VP-22 | MD-05 ↔ UT-05 / CHANGED | REQUIRED | scope/revoke→cache/engine→evidence; 거절·삭제 | EP-19(4), EP-20(3); V1 전부·M-SCOPE |
| VP-23 | MD-06 ↔ UT-06 / INHERITED | REGRESSION | 품질·fold·cache event→UI; stale 응답 거절 | EP-18(4), EP-19(4); V1 전부 |

표의 `AT-01~03` 같은 범위는 V1 registry의 개별 stable node를 의미한다. CHANGED 행의 right node도 보완된 검증으로 CHANGED, REGRESSION 행의 양쪽은 V1에서 INHERITED이다.

### 추가 강제 지점

| EP / 자리 수 | SSOT와 누가·언제 강제하는 자리 | 직접 oracle / 실패 의미 |
|---|---|---|
| EP-15 / 4 | a archive PostalMime 옵션; b body-selection 후보 평가; c HTML/charset quality projection; d 품질 DTO→UI/context 분기 | nested 첨부 sentinel·alternative 중복·정상 영어·suspect 처리. 첨부 혼입/정상 본문 유실 |
| EP-16 / 4 | a segment 분류; b version/variant/chunk provenance transaction; c scope-aware quote fold; d viewer 선택·펼침 | 원문 재결합·변경 숫자·부모 밖 scope·source 클릭. 출처 혼동/본문 손실 |
| EP-17 / 3 | a 모델 prompt/token budget renderer; b chunk ID·embedding key 생성; c 저장/전송 projection | 필수 prefix·input hash·연속 span·whitelist. 모델 혼합/메타 노이즈/허위 인용 |
| EP-18 / 4 | a hard/soft query compiler; b 필터된 rank·RRF; c neighbor/context pack; d 결과 이유/정렬 UI | exact ID·old decision·주변 문단·0건 이유. 몰래 범위완화/중복 투표 |
| EP-19 / 4 | a cache key/get; b scheduler·subscriber 취소; c epoch 검증 후 cache put; d scope/profile/remove/session 정리 | 두 subscriber·credential 변경·late reply. 취소 전파/삭제 자료 부활 |
| EP-20 / 3 | a engine build/write transaction; b scope-aware engine query/exact fallback; c generation lease·삭제·재구축 | canonical 동등성·load fail·복합필터·reopen. 필터 누락/파생 row 유출 |

새 0건 주장인 첨부 제외에는 EP-15a의 옵션 제거 mutation **M-NESTED**를 등록하고 sentinel payload 검사에서 실패해야 한다. cache 참조/invalidations와 엔진 fallback은 직접 행동 oracle로 검증하며 구조적 호출 횟수만으로 안전을 주장하지 않는다.

M-SCOPE의 전수 범위에는 새 EP-16c(quote fold), EP-18c(neighbor 확장), EP-19a/c(cache key·put), EP-20b(engine filter/fallback)가 추가된다. 각 자리에서 다른 scope의 자료가 섞이도록 결함을 심고 사용자 반환 집합·출처·cache 소유 상태로 검출한다.

## 8. 실증 계획과 선택 조건

수집 corpus는 합성/반입 허용 자료로 만들고 본문·주소를 PR 로그에 올리지 않는다. **기존 24 AC의 구현 검증**과 **후보 성능 비교**를 분리해, 벤치마크에서 좋다는 이유로 무결성 실패를 허용하지 않는다.

| 축 | 고정 입력 / 비교 | 관측 / 결정 |
|---|---|---|
| 전처리 | plain+HTML 중복, HTML-only, UTF-8/EUC-KR/CP949 alias, 잘못된 charset, 영어/코드, inline reply, 서명 유사 업무 조건, nested EML, 원본 없는 quote | 필드 golden·segment 재결합·sentinel 제외·quality flag; 중요한 수치/부정어 유실 0 |
| 검색 질의 | 48개: 정확번호/주소 8, 한두글자·혼합 8, 의미 유사 8, 기간/사람/폴더 8, 경위·상충·오래된 결정 8, scope/무답 8 | 고정 train/tune 24·holdout 24, 같은 스레드가 두 split에 걸치지 않음 |
| retrieval | FTS만 → hybrid e5 → hybrid Gemma768/256 → 가능한 API; RRF·가중치·overlap은 한 번에 한 축 변경 | mail Recall@10·MRR@10·thread/event coverage, 중복률·scope leak·무답 오탐 |
| context/답변 | 동일 retrieved IDs와 두 기존 요약 AI 경로 | 근거 문장 citation validity·claim faithfulness·승인/변경·모름 구분; LLM 자체 점수만으로 합격하지 않음 |
| 엔진 | 동일 vector·동일 filter로 BLOB vs 고정 sqlite-vec, 10k/50k 메일·실제 chunk 수 기재 | top-k 동등성(거리 허용오차·동률 규칙), cold/warm p50/p95·RSS·DB 크기·삭제/복구 |
| cache/부하 | cold·동일query 반복·서로 다른 scope·색인 중 query·모델전환·API 지연·취소 | hit ratio·문서/질의 요청 수·native inference 지연·epoch 누락 0 |
| 배포 | Windows 설치본·사설망 API·오프라인 모델 팩·선택 extension | 실제 load→query→delete→restart; 미선택 후보를 출시 의존성으로 추가하지 않음 |

품질 비교의 기준은 우선 **정확번호·scope·인용 무결성 회귀 0**, 이후 holdout 회수율/시간순 사건 coverage 향상이다. 우위가 없으면 복잡도를 늘린 옵션을 켜지 않고, 지연 목표는 V1 D-016의 기준 PC 실측 후 확정한다.

추천 비교 순서는 e5-small 384d + 기존 BLOB를 기준으로 잡고 Gemma768/256을 비교한 뒤, 같은 승자 vector에서 sqlite-vec를 비교하는 것이다. 모델과 엔진을 동시에 바꾸지 않아 품질·성능 변화 원인을 분리한다.

S1에는 MIME 선택·품질 표시·가역 segment·필드 검색, S2에는 모델별 payload·cache·engine 비교 결과, S3에는 quote fold·주변 context·결과 이유·출처 UX를 배치한다. 전 단계를 통과하기 전 전체 기능 완료로 보고하지 않는다.

## 9. 문서·구현 게이트와 상태

이번 변경은 plan 메타/우선순위, 이 Delta, 조사 검토, docs/보드 routing이다. source attachment·앱 코드·dependencies·현재 architecture 문서는 변경하지 않는다.

문서 gate는 상대 링크/표 열 수/UTF-8·V1 24 AC 보존·ΔV1 23 pair ID 일치·CHANGED/REGRESSION 전수·EP 추가 자리수·plan/INDEX의 V1+ΔV1 DRAFT 일치·`doc-inventory --check`·`git diff --check`·commit trailer다. 구현 때는 V1의 G-STATIC/G-TEST/G-PACK과 이 Delta의 직접 oracle·mutation을 함께 수행한다.

**DRAFT 유지**: 이번 조사는 후보와 절차를 구체화했으며 D-014 패키지 승인, D-015 실제 모델/API 계약, D-016 환경 실증을 수행한 것은 아니다. 새 UI·스키마도 독립 설계안의 제안이며 사용자 선택 전에 구현 READY로 간주하지 않는다.

2026-09-29 문서 검사: V1 커밋과 AC 행을 직접 비교해 24개 전부 보존, pair ID 23개 일치(REQUIRED 16·REGRESSION 7), 기존 57자리+추가 22자리=79자리를 확인했다. 상대 링크·앵커 18개와 표 42개의 열 수·UTF-8, plan/보드의 작성자·유효 V·DRAFT 상태가 일치했다.

`node scripts/check-doc-inventory.mjs --check`(app 작업 디렉터리)와 `git diff --check`가 통과했다. 이는 문서 정합성 검사이며 모델 추론·PST 처리·검색 품질·성능을 실행 검증한 결과는 아니다. 해당 실증은 §8에 남아 있다.
