# Plan — 0244-mail-archive

> 작성자 **Codex**. 사용자 지시에 따라 `main`에서 작성한 독립 비교안이다. 다른 브랜치의 동명 계획·결정·승인을 상속하지 않는다.
> 절차: [handoff-plan](../../../.agents/skills/handoff-plan/SKILL.md) · 상태와 V 규약: [handoff/AGENTS.md](../AGENTS.md).
> **설계 정본:** 조사 보완을 포함한 현재 계약은 이 plan에 통합했다. 외부 구현의 관측·채택 판단은 [조사 검토](research-review.md)에 두며, 구현·검증은 이 문서의 AC·V·강제 지점을 따른다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0244-mail-archive` |
| 작성자 | Codex |
| 일자 | 2026-09-29 |
| 매핑 | PR 브랜치 `codex-0244-mail-archive-plan` → `main` |
| 조사 기준 | `f2f60ac338f2847f81a6cbc426f0728b7eb8d98e` (`git cat-file -t` → commit 확인) |
| 상태 | **READY — S1 worker·revision·검색 범위 확정** |
| V mode / 기준 V | `Delta V` / 독립안 `V1@3f9558d9ec7fca52bc7c55533031051ba5d5b96a` |
| 이번 V revision / 유효 V | `ΔV3` / `V1 + ΔV2 + ΔV3 (S1 범위)` |

# Part I — Product & UX Contract

## 1. Context / 목표

개인이 보관한 EML·PST에서 필요한 메일을 찾고, 요청·변경·승인 경위를 근거와 함께 확인한다. Orca의 기존 채팅과 모델 선택은 유지하고 **메일 보관함**을 새로운 로컬 자료원으로 추가한다.

완료 상태는 “검색 결과를 읽을 수 있다”를 넘어, “왜 보류됐고 이후 무엇으로 결정됐는지 답변을 받은 다음 각 주장에 사용된 메일 문단을 바로 확인할 수 있다”이다. 전체 메일·전체 스레드를 LLM에 무조건 전달하지 않는다.

## 2. 사용자 의도 / 요구 출처

| 출처 | 명시 요구 | 이 계획의 해석 |
|---|---|---|
| 최초 제안서 | EML/PST 공통 모델, Metadata+Full Text+Vector, Reply/Reference/Thread, RAG, 원본 비복제, 초기 Graph DB 제외 | 검색·관계·근거를 별도 계약으로 설계 |
| 보관 범위 답변 | “개인보관한이다.” | 로컬 개인 보관함. 조직 공유 검색·메일 서버 동기화 제외 |
| AI 환경 답변 | “사내서버와 claude(bedrock) 모두 지원중이다. 모두 허용한다.” | 기존 Orca 실행 경로에서 두 환경 모두 메일 근거를 사용할 수 있음 |
| 임베딩 답변 | “로컬 임베딩 모델 / 임베딩 api 모두 지원가능하도록” | 요약 LLM과 독립적인 두 임베딩 공급자 구현을 완료 범위에 포함 |
| 첨부 답변 | “첨부 본문 검색은 제외한다.” | 첨부 이름·유형·크기 검색과 선택 추출만 설계. OCR·본문 색인·첨부 임베딩 제외 |
| 계획 요청 | “Handoff-plan 으로 계획 작성하여 pr까지 만들어줘” | 이번 산출은 계획·PR. 앱 구현·의존성 설치 아님 |
| 독립안 요청 | “원격브랜치 무시하고 244로 만들어라. 비교 후 선택할 것이다. 작성자는 codex로 할 것” | 번호 0244, 작성자 Codex, 기준 main, 타 계획의 사용자 승인을 전용하지 않음 |
| 조사 반영 요청 | “조사 내용을 바탕으로 보완점이나 구현 방안을 구체화하라” + `mail-archive-rag-report.md` | 1차 구현·모델 문서와 대조하고 이 plan에 전처리·검색·UX·실증 조건 통합 |
| 문서 통합 요청 | “델타 문서는 따로 작성하지말고 plan 문서에 합쳐라” | 보완 계약을 해당 절에 통합하고 별도 델타 파일·참조 제거 |

## 3. Decision Ledger

`출처=Codex 제안`은 비교 대상으로 제안하는 설계이며 사용자 확정 발언과 구분한다. ACTIVE는 이 문서 내부의 일관된 설계 기준이며, DRAFT의 구현 승인을 뜻하지 않는다.

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 / AC |
|---|---|---|---|---|---|
| D-001 | 개인 로컬 EML·PST 보관함 | 조직 ACL·온라인 수집은 필요 범위 밖 | 사용자 | ACTIVE | AC1~6 |
| D-002 | 메타데이터·키워드·의미 검색 및 관계 확장 | 정확한 식별자와 유사 표현을 함께 찾음 | 사용자 제안서 | ACTIVE | AC7~14 |
| D-003 | 요약은 기존 사내서버·Claude(Bedrock) 실행 경로 모두 사용 | “모두 허용한다” | 사용자 | ACTIVE | AC18 |
| D-004 | 로컬 임베딩과 임베딩 API 모두 제공 | 요약 모델 선택과 별도 설정 | 사용자 | ACTIVE | AC10~12 |
| D-005 | 첨부 본문 검색 제외 | 이름검색·선택 추출은 본문검색과 구별 | 사용자 + Codex 보완 | ACTIVE | AC9·17 |
| D-006 | 원본 EML/PST·첨부 바이트는 상시 복제하지 않고 정규화 본문 전체를 보존 | 원본 이동과 재색인 후에도 읽기·인용 가능 | 제안서 + Codex 보완 | ACTIVE | AC4·13·17 |
| D-007 | POP3 캐시와 별도 DB·서비스. 그래프 DB 없음 | 보관 수명과 조회 대상이 다름 | Codex 제안 / 제안서 | ACTIVE | AC5·6·22 |
| D-008 | 설정에서 자료원·임베딩 관리, 별도 보관함 화면에서 검색·열람, 채팅에서 이력 질문 | 빈 보관함부터 근거 확인까지 이동 가능 | Codex 제안 | ACTIVE | AC1·7·15·23 |
| D-009 | 확인된 Reply/References와 추정 관련 대화를 구분 | 같은 제목·참여자만으로 확정 스레드 병합하지 않음 | Codex 제안 | ACTIVE | AC6·14 |
| D-010 | 명시 제거 전까지 로컬 색인 유지, 원본 소실·기간 경과는 삭제 원인 아님 | 재수집 가능한 단기 캐시로 취급하지 않음 | Codex 제안 | ACTIVE | AC5·21 |
| D-011 | 범위는 세션에 귀속, 인용은 답변 당시 본문 버전에 귀속 | 다른 세션·재색인 결과와 섞이지 않음 | Codex 제안 | ACTIVE | AC13·16·21 |
| D-012 | 파싱·DB·로컬 추론·벡터 스캔은 자식 프로세스, API 요청만 main의 Chromium 전송 포트 | 대량 PST 처리 중 UI와 취소 응답 유지 | Codex 제안, 사용자 재확정 “D 12 유지” | ACTIVE | AC3·11·19·20 |
| D-013 | main 기준 독립 0244, 작성자 Codex | “비교 후 선택할 것이다” | 사용자 | ACTIVE | 문서 게이트 G-DOC |
| D-014 | S1 PST parser로 `pst-extractor@1.12.0`을 채택하고 로컬 임베딩 runtime은 S2에서 별도 결정 | PST 1차 구현 요청을 반영하며, parser는 source worker에서 지연 로드 | 사용자 1차 구현 요청 + 기존 후보 검토 | **ACTIVE** | AC2·24 / S1 |
| D-015 | 첫 로컬 모델 팩과 API 프로토콜·인증·모델 리비전 | “지원 가능”을 특정 모델/서비스 승인으로 해석하지 않음 | 미제공 환경 정보 | **OPEN** | AC10~12 / S0 |
| D-016 | 기준 PC·대표 자료로 §14 예산의 실행 가능성 확정 | 성능 SLA를 임의 확정하지 않음 | 저장소 미정 항목 + 실측 필요 | **OPEN** | AC19·24 / S0 |
| D-017 | 표시 본문·키워드 필드·임베딩 입력을 분리하고 변환 규약을 버전 관리 | 전송 헤더·중복 본문·메타데이터가 검색을 지배하지 않게 함 | 조사 + Codex 제안 | ACTIVE | AC2·4·7·10 |
| D-018 | 인용/서명은 가역 분류, 자동 의미 삭제 없음 | 원 메일 부재·인라인 답변·업무 면책 조건 유실 방지 | 조사 비판 + Codex 제안 | ACTIVE | AC4·5·14 |
| D-019 | 메시지 버전별 chunk가 검색 단위, 확인된 스레드는 context 단위 | 스레드 전체 재임베딩과 잘못된 발신자·날짜 귀속 방지 | Onyx 구조의 선택적 적용 | ACTIVE | AC5·8·13·14 |
| D-020 | 기본 관련도 검색에 시간 감쇠 없음, hard filter와 정확 식별자 자동 완화 없음 | 과거 결정 근거·번호 검색의 정확성 보존 | 조사 권고 수정 | ACTIVE | AC7·8·14·16 |
| D-021 | query cache와 vector 파생 색인은 원문·출처와 별개이며 epoch로 무효화 | 계산 재사용이 범위·삭제·모델 변경을 우회하지 않게 함 | 조사 + Codex 제안 | ACTIVE | AC10·12·19~21 |
| D-022 | 로컬 모델 비교를 e5-small, EmbeddingGemma 768/256으로 구체화; API 동일 평가 | 공개 점수 대신 동일 한국어 메일 질의셋으로 선택 | 조사 + 공식 모델 카드 | **SUPERSEDED → D-024** | AC10·11·19·24 |
| D-023 | 설계 계약은 plan 한 문서에 통합 | 별도 델타 문서를 왕복하지 않고 현재 계약을 읽음 | 사용자 | ACTIVE | G-DOC |
| D-024 | 첫 기준을 단순·경량으로 구성: FTS5 기본, 선택형 로컬/API 임베딩, E5-small 384d + SQLite BLOB exact scan, ANN·reranker·모델 비교군 보류 | 경량화 방향을 선택했다. 실행 가능성은 S0 실증 조건 | 사용자 “경량화 방향으로 선택” + 공식 모델/runtime 자료 | **ACTIVE** | AC7~12·19·24 / S0 |
| D-025 | 이번 구현 라운드는 PST·EML 가져오기와 검색으로 제한하고, EML은 파일 단건과 폴더 배치를 모두 제공 | 임베딩·RAG 계약은 유지하되 S2로 미루고, 1차 검색을 모델 설정 없이 즉시 사용 | 사용자 “Pst, eml 검색 1차구현. Eml은 배치로 입력 가능하게” | **ACTIVE** | AC1~3·7·9·17·19·22·23 / S1 |
| D-026 | 자료원 ID는 형식과 canonical path에서 안정적으로 만들고, 전체 파일 fingerprint는 revision 변경 검증에만 쓴다. 메일 identity는 Message-ID와 정규화 payload hash를 결합하며, Message-ID가 없으면 같은 자료원의 locator와 payload hash를 결합한다. | PST 누적·변경이 새 메일 중복 삽입으로 이어지지 않는다. 같은 ID의 다른 본문은 별도 행으로 보존하고, 유사도만으로 메일을 병합하지 않는다. | Codex 구현 제안 — 사용자 문제 제기 후 구현 계속 지시 | **ACTIVE** | AC3·AC5·AC7 / S1 |

V1의 D-001~D-016을 유지하고 조사 보완 D-017~D-023, 경량 기준 D-024, 구현 범위 D-025, 자료원·메일 identity D-026을 반영했다. 기준은 이 독립안의 V1이며 다른 브랜치의 라이브러리 승인·모델 선택·V를 상속하지 않는다.

D-024는 사용자의 후속 구현 지시로 채택됐다. D-014는 S1에서 PST parser 후보를 닫고, 로컬 inference runtime·API 계약은 D-015에 남겨 S2에서 처리한다. `sqlite-vec`, ANN, reranker, Gemma 비교는 첫 기준에서 제외한다.

ACTIVE 결정 ↔ AC 대조: D-001~D-012·D-017~D-021·D-024~D-026은 표의 AC·본문 경로와 대조한다. D-022는 사용자 선택을 반영해 D-024로 대체됐다. 문서 요구 D-013·D-023은 G-DOC로 확인한다. D-015~D-016은 S2·S3의 OPEN으로 남기며, 현재 READY 판정은 D-025·D-026의 S1 경계에만 적용한다.

### Codex 권고: 첫 기준은 단순·경량

개인 보관함을 빈 상태에서 시작해도 검색이 바로 쓸 수 있고, 모델 설치나 AI 자격증명 없이 메일 보관·정확 검색·스레드 확인이 되도록 단계화한다. 이 권고는 사용자의 두 요약 AI 경로(사내 서버·Claude on Bedrock), 로컬/API 임베딩 지원, 첨부 이름 검색·선택 추출, 첨부 본문 검색 제외를 그대로 유지한다.

| 영역 | 첫 기준 권고 | UX·운영 이유 |
|---|---|---|
| 기본 검색 | 기존 SQLite에 FTS5·메타데이터 필터·확인된 스레드 연결. 임베딩 설정 전에도 같은 보관함 화면에서 검색·열람 가능 | 첫 실행에 모델 다운로드·API 키 입력을 요구하지 않고 검색 실패를 줄임 |
| PST / EML | EML은 기존 MIME parser 재사용. PST는 `pst-extractor@1.12.0`을 후보로 두고 필요 시에만 source worker 기동 | 기본 앱 시작 비용과 평상시 메모리를 줄임. PST 대형·손상 파일 지원은 S0 fixture로 확인 |
| 임베딩 | 로컬 `multilingual-e5-small` 384차원 또는 설정된 embedding API 중 프로필 하나를 사용. 로컬 모델은 설치본에 포함하지 않고 사용자가 명시적으로 가져오기/설치 | 필수 설치 크기와 네트워크 전송을 최소화. 프로필 미설정 시 키워드 검색 유지, 자동 원격 다운로드·자동 API 대체 없음 |
| 로컬 실행 후보 | `@huggingface/transformers`의 로컬 ONNX/WASM 경로와 multilingual-e5-small 양자화 팩을 S0에서 검증. 원격 모델 로드 차단·WASM 파일 경로 고정, 변환본의 수치·순위·라이선스·CPU 호환성을 기준 모델과 대조 | 런타임과 가중치를 분리해 선택 설치하되, 실제 설치본 크기·CPU 지연이 기준을 넘으면 런타임 후보를 다시 고름 |
| 벡터 검색 | canonical float32 BLOB + worker의 scope 적용 exact cosine scan. SQLite에 `sqlite-vec` 확장이나 별도 ANN 인덱스는 넣지 않음 | 파생 인덱스·DLL·이중 쓰기·재구축 상태를 없애고 기존 SQLite만 사용 |
| 고급 검색 최적화 | reranker, query expansion, 시간 감쇠, 자동 검색 범위 확대는 첫 기준에서 제외 | 검색 결과의 이유를 설명하기 쉽고 동작·설정 수를 줄임. 실제 품질/지연 자료가 생기면 별도 결정 |

로컬 모델 팩은 선택 다운로드 전에 파일 크기·라이선스·모델 revision을 보여 주고, 명시적 취소·재시도·삭제를 지원한다. 모델 미설치/API 오류 때는 결과 상단에 “키워드 검색만 사용 중” 또는 실패 원인을 표시한다. 검색 모드가 바뀌어도 현재 질의의 출처 범위·날짜 필터는 유지한다.

E5-small은 한국어를 포함한 다국어 모델이며 384차원이다. 모델 카드가 요구하는 `query:`/`passage:` 접두사·masked average pooling·L2 normalization을 고정한다. Transformers.js용 양자화 산출물은 가중치 약 118 MB, tokenizer 파일을 포함하면 약 140 MB 수준인 후보가 있다. 제3자 변환 팩의 해시·품질·라이선스를 기준 모델과 확인하기 전 기본 팩으로 확정하지 않는다. 기본 상태는 모델 가중치 추가 설치 0 MB이며, 의미 검색을 켤 때만 사용자가 공간을 부담한다.

근거: [multilingual-e5-small 모델 카드](https://huggingface.co/intfloat/multilingual-e5-small), [Transformers.js 로컬 모델 설정](https://huggingface.co/docs/transformers.js/custom_usage), [양자화 ONNX와 tokenizer 후보 파일](https://huggingface.co/Xenova/multilingual-e5-small/tree/main/onnx), [`pst-extractor@1.12.0` manifest](https://raw.githubusercontent.com/epfromer/pst-extractor/v1.12.0/package.json), [sqlite-vec 상태·호환성 안내](https://github.com/asg017/sqlite-vec).

## 4. 요구 비판적 검토

| 추상안의 빈틈 | 보완 | 판단 근거 |
|---|---|---|
| 정규화 시 어떤 본문까지 보존하는지 불명확 | 정규화 전체 텍스트 + 새 본문/인용/서명 segment, 가중치는 검색에서 적용 | 인용부를 잘라 저장하면 누락된 원 메일의 내용도 함께 사라짐 |
| Message-ID를 고유키로 간주할 위험 | 내부 ID·버전·자료원 occurrence 분리 | 같은 ID의 다른 내용, ID 없는 메일, 여러 백업본을 모두 다뤄야 함 |
| 유사한 제목이 하나의 결정 흐름처럼 보일 위험 | 확정 연결·PST 그룹 근거·추정 관련 대화 표시 | 근거 종류와 연대기를 구분해야 승인 오판을 줄임 |
| 검색 top-k만으로 “최종 결정”을 단정 | 스레드 확장·반대 근거·범위/잘림 표시 후 시간순 근거 구성 | 최신 메일 한 건이 최종 승인이라는 보장은 없음 |
| 원본 경로만 있으면 인용할 수 있다는 전제 | immutable 본문 버전과 evidence ID 저장, 첨부 추출 때만 원본 재검증 | 원본 이동·변경과 과거 답변 확인을 분리 |
| Vector 준비 전에는 전 기능이 막힘 | 키워드 검색을 먼저 제공하고 의미검색 커버리지 별도 표시 | 임베딩 실패가 읽기·정확검색 실패로 전파될 이유 없음 |
| LLM 서버와 임베딩 API를 동일 환경으로 취급 | 요약 모델·임베딩 공급자 독립 설정 | Bedrock에서 Claude를 쓸 수 있다는 사실은 임베딩 endpoint의 존재를 증명하지 않음 |

기존 MIME 파서·FTS·첨부 추출 유틸은 재사용 후보이다. 현재 POP3의 수명·UIDL 모델을 보관함 모델로 확대하지 않으며, POP3 검색 결함 수정은 별도 작업이다.

## 5. 동작 / 사용자 흐름

### 화면과 이동

```text
설정 > 메일 보관함                         메일 보관함 화면
 ├ 자료원: EML 폴더 / PST 파일 추가    →    검색어 [서버 이전 보류] [검색]
 ├ 처리 현황·오류·재시도·경로 재연결        범위 [전체 보관함] 기간 [전체] 사람 [전체]
 ├ 의미검색: 사용 안 함 / 로컬 / API        검색 결과 목록  │ 선택 메일 / 대화 흐름
 └ [보관함 열기]                           [이 범위로 질문] │ [선택 첨부 추출]
                                                 ↓
기존 Orca 채팅: [메일: 선택한 자료원·기간] [현재 요약 모델]
 → 관련 근거 조회 → 경위 답변 + 출처 [1][2] → 우측 근거 뷰어
```

설정은 관리 진입점이며 검색 결과를 긴 설정 모달에 넣지 않는다. 보관함 화면은 목록·상세의 두 영역을 사용하고, 좁은 창에서는 상세를 별도 화면으로 전환해 `결과로 돌아가기`가 검색어·스크롤·선택을 복원한다.

### 최초 가져오기

1. 빈 화면에 `EML 폴더 추가`, `PST 파일 추가`, 지원 범위 설명을 보여 준다. OS 선택기로만 경로를 등록한다.
2. 자료원별 준비 결과에 파일/폴더 수, 예상 처리량 또는 `계산 중`, 경로 접근 오류를 표시한다. PST는 메일 폴더를 선택할 수 있고 기본은 전체 메일 폴더이다.
3. `가져오기` 후 저장된 배치부터 검색 가능하다. `검색 가능한 메일`과 `의미검색 준비된 메일`을 따로 표시한다.
4. 설정을 닫아도 진행한다. `취소`는 해당 작업만 멈추고 이미 가져온 메일은 남긴다.

이름검색은 `견적서.xlsx`라는 **첨부 이름을 가진 메일**을 찾는다. `선택 추출`은 그 첨부 하나를 원본에서 꺼내 파일로 저장하는 동작이며, 파일 속 셀·문장·이미지는 검색 대상이 아니다.

### 검색과 질문

- 검색은 Enter/검색 버튼으로 실행한다. 타이핑마다 LLM·임베딩 API를 부르지 않는다.
- 기본 화면은 제목·본문·첨부 이름을 검색한다. 이름 전용 입력/필터와 보낸 사람·받는 사람·참조·기간·자료원·PST 폴더 필터를 제공한다. 띄어쓴 질의는 공백으로 나뉜 모든 검색어가 결과에 포함되는 AND 검색이다. 1~2자 검색어가 하나라도 있으면 FTS trigram 대신 검색어별 안전한 LIKE fallback을 사용한다.
- 각 결과는 제목, 발신자, 메일 날짜, 일치 문단, 자료원, 첨부 수, `단어 일치`/`의미 유사`의 근거를 보인다. 내부 벡터 점수를 신뢰도 백분율로 표시하지 않는다.
- 발신자 이름이 같으면 주소를 함께 표시하고 사용자가 선택한다. 날짜 없는 메일은 `날짜 미상`으로 표시하며 가져온 날짜로 시간순 사건을 만들지 않는다.
- 결과는 관련도순, 대화 뷰는 메일 날짜순이다. 단순 제목 유사 후보는 `관련 대화 후보`로 분리하고 답장 연결선에 섞지 않는다.
- `이 범위로 질문`은 검색 범위를 채팅에 전달하고 입력창에 범위 칩을 남긴다. 현재 결과의 일부만 물으려면 `선택한 메일로 질문`을 사용한다.
- 범위를 지정하지 않은 일반 채팅에서 메일 도구가 호출되면 `검색할 보관함 선택` 동작을 제시한다. 모델이 임의로 모든 보관함을 선택하지 않는다.
- 답변은 결론·시간순 경위·변경 조건·확인되지 않은 부분을 구분한다. 판단을 뒷받침하는 문장에 출처를 붙이고 “검색 범위에서 최종 승인 메일을 찾지 못함”과 “승인되지 않음”을 구별한다.

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

본문 선택·분류의 진단 정보는 상세의 `처리 정보`에 둔다. 일반 결과 목록에 tokenizer·pooling·model fingerprint 같은 구현 정보를 노출하지 않는다.

scope가 바뀌면 인용 결과의 중복 접기와 주변 문맥을 새 scope에서 다시 계산한다. 다른 자료원에 원문이 있다는 사실만으로 현재 보관함의 인용을 감추지 않는다.

### 상태·실패·전이

| 사건/상태 | 사용자에게 보이는 결과 | 다음 행동 |
|---|---|---|
| 스캔/파싱/저장/임베딩 중 | 처리 단계·완료/새로 저장/기존 자료원에서 확인/실패 수, 전체 미확정 시 퍼센트 대신 건수. 변경 PST는 `새 revision 확인 중 · 기존 검색 결과 유지`를 표시한다. | 자료원별 취소, 화면 이동 |
| 일부 메일만 가져옴 | `일부 자료만 검색됩니다` + 현재 검색 가능 수 | 현재 자료 검색 / 처리 계속 |
| 손상 EML/PST 항목 | 실패 이유와 항목 식별자, 정상 항목은 유지 | 실패 항목만 재시도 / 실패 목록 저장 |
| 원본 이동·오프라인 | 저장 본문 열람·검색 가능, `원본 연결 필요` | 경로 재연결; 첨부 추출 비활성 |
| 원본 내용 변경 | PST는 새 revision을 검증하는 동안 이전 검색 결과를 유지한다. 완료 후 새 메일만 추가하고 이미 확인한 메일은 제외 수로 보여준다. 같은 ID의 수정 본문은 별도 결과로 보존한다. | 재가져오기 결과의 새 메일·기존 메일·실패 수 확인 |
| 키워드 0건 | 적용 필터와 검색 범위 표시 | 필터 해제·기간 확대를 명시적으로 선택 |
| API 인증 오류/오프라인 | `의미검색을 사용할 수 없어 단어로 검색했습니다` | 설정 열기 / 재시도; 자동 외부 공급자 변경 없음 |
| 새 모델 색인 중 | 기존 의미검색 유지, 새 색인 진행률 표시 | 취소 / 준비 후 전환 |
| 작업 취소·앱 종료 | 완료된 EML 파일의 배치는 유지한다. PST staged revision은 취소 시 활성화하지 않고 이전 검증 revision을 유지한다. 재시작 시 미완료 revision은 `중단됨` | 재개·재시도. 자동 전량 재전송하지 않음 |
| 자료원 제거 | 삭제 대상 수·공유 중복 메일 유지·원본 파일 보존 안내 | 확인 후 제거 |
| 오래된 출처 클릭 | 해당 버전 문단 또는 `자료원이 제거되어 근거를 열 수 없음` | 남은 출처 확인 |

### UX 검토 기준

필터 변경 전 요청의 늦은 응답은 새 결과를 덮지 않는다. 검색어·선택·스크롤은 보관함 화면 상태로, 질문 범위·근거 뷰어는 세션 상태로 분리한다.

근거 클릭은 새 브라우저가 아니라 Orca 우측 뷰어에서 해당 메일 문단을 강조한다. 뷰어 닫기/뒤로 가기는 호출한 인용 링크에 포커스를 돌리고, 세션 전환 시 다른 세션의 근거가 보이지 않게 한다.

탭 순서·목록 키보드 이동·Enter 열기·Escape 닫기·접근성 이름·두 테마 대비를 확인한다. 상태는 색만으로 구분하지 않고, 진행 알림은 건마다 낭독하지 않는다.

## 6. 범위 / 비범위

**범위**는 EML/PST 가져오기, 정규화·중복·관계, 검색 UI, 로컬/API 임베딩, 도구 기반 RAG, 버전별 출처 확인, 첨부 이름검색·선택 추출이다. S1만 구현하고 벡터 검색을 “후속 지원 가능”으로 남긴 상태는 이 계획의 완료가 아니다.

**비범위**는 첨부 본문 색인/OCR, PST에 들어 있는 일정·연락처, 메일 보내기, Outlook 동기화, 조직 공동 보관함, 그래프 DB, 상시 서버 운영, 요약문을 새로운 사실로 재색인하는 기능이다. 검색 결과 PDF/보고서 내보내기는 기존 산출물 기능으로 필요 시 처리하되 전체 메일 원문을 자동 게시하지 않는다.

자료원·버전·증거 ID·임베딩 세대는 지금 설계한다. ANN DB, 프로젝트 엔터티 그래프, reranker 추가는 실제 검색 품질·규모 병목을 확인한 뒤 별도 결정한다.

## 7. Requirements / Acceptance — R ↔ AT

각 AT는 같은 번호의 AC를 검증한다. 아래 검증은 **구현 때 수행할 기준**이며 이번 문서 PR에서 통과했다고 주장하지 않는다.

| R | AT / AC | 관측 가능한 동작 기준 | 직접 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 빈 보관함에서 EML 폴더/PST를 등록하고 처리 현황·검색 진입 가능 | OS 선택기 stub→등록 카드→화면 이동, 취소 시 자료원 미생성 | 설정→IPC→자료원→보관함 |
| R-01 | AT-02 / AC2 | 한글·HTML EML 및 ANSI/Unicode PST의 지정 메일·폴더·첨부 메타데이터를 읽음 | 합성/배포 허용 fixture의 기대 필드 전수 대조, 손상/비메일 항목 제외 이유<br>plain/html 대체 본문을 한 번만 색인, HTML-only·한글 charset·영어/코드 메일을 field golden으로 비교 | OS 등록→reader→normalize→DB<br>reader→body-selection→version |
| R-01 | AT-03 / AC3 | 완료한 EML 파일은 취소 후에도 검색된다. PST revision은 시작/완료 fingerprint가 일치할 때만 활성화하고, 취소·변경 감지 시 이전 검증 revision을 유지한다. 재시도·재시작은 기존 메일을 중복 삽입하지 않는다. | EML 파일 간 취소와 PST revision 중간 취소·원본 변경을 각각 주입하고 검색 가능 메일·revision·카운터 대조 | 작업 UI→main→source/index worker→DB→event |
| R-02 | AT-04 / AC4 | 인용·서명 포함 본문 열람과 옛 인용은 재색인/원본 이동 후에도 동일 | 버전 해시·UTF-16 범위로 표시 문장 일치, HTML script/외부 이미지 실행·요청 없음<br>인라인 답변·인용·서명을 재결합하면 snapshot과 동일, hit가 접힌 구간이면 펼침 | reader→version→본문/근거 뷰어<br>classifier→snapshot→viewer |
| R-02 | AT-05 / AC5 | 같은 canonical path의 재등록은 새 전체 fingerprint여도 기존 메일을 재사용한다. 같은 Message-ID라도 정규화 payload가 달라지면 별도 행으로 보존하고, Message-ID 없는 메일은 같은 자료원의 locator와 payload가 모두 같을 때만 재사용한다. | 동일 PST의 추가 revision·동일 ID/변경 본문·ID 없음/다른 locator fixture에서 mail row와 revision occurrence 집합 대조 | rescan→stable source ID→mail identity→revision occurrence→search |
| R-02 | AT-06 / AC6 | 역순 수집에도 Reply/References 연결 복원, 유사 제목만으로 확정 병합 안 함 | 역순/누락부모/다중후보/순환/동일제목 fixture의 edge kind·시간순 대조 | normalize→relations→thread view |
| R-03 | AT-07 / AC7 | 한두 글자 한글·혼합 검색·문서번호·이름/주소·기간/폴더 필터가 함께 적용되고, 띄어쓴 검색어는 모두 포함(AND)된다. 짧은 토큰 질의는 trigram FTS 제약을 피해 안전한 fallback을 쓴다. | `QA 승인 AB-12`, `서버 이전`, `%_`, 동명이인 fixture에서 정확한 mail ID 집합<br>모든 토큰이 각각 제목/본문/주소/첨부 이름 중 하나에 있을 때만 반환 | UI→term compiler→FTS/LIKE→results |
| R-03 | AT-08 / AC8 | 메일별 중복 chunk를 합친 hybrid 결과를 보여 주고 의미검색 장애 시 단어검색 유지 | 각 검색 분기의 관련메일 포함·중복 1회·degraded 상태·페이지 안정성<br>quote 중복 rank 투표 방지, FTS 0건 semantic 이유 표시, lexical-only는 외부 요청 없음 | search→lexical/vector→fusion→UI<br>hybrid→fold→result DTO |
| R-03 | AT-09 / AC9 | 첨부 이름으로 메일을 찾되 첨부 내부에만 있는 문자열은 검색·질문 근거에 나오지 않음 | 이름 `견적.xlsx`, 내부 고유문구 sentinel을 가진 fixture; parser/index/embed/LLM payload 대조<br>첨부 EML·inline rfc822·text/plain 첨부의 고유 sentinel이 전송/색인 payload에 없음 | attachment manifest→filename index→search<br>reader 옵션→projection→embedding/context |
| R-04 | AT-10 / AC10 | 네트워크 없이 선택한 로컬 모델 팩으로 문서/질의를 같은 규약으로 임베딩 | 실 모델 golden input의 차원·수치 허용오차·검색 결과, 전송 포트 호출 없음<br>필수 모델 prompt 보존·입력 budget 검증, query cache hit 때 vector·결과 동일 | settings→local worker→generation→search<br>renderer→EmbeddingPort→cache/worker |
| R-04 | AT-11 / AC11 | API 프로필로 색인·질의 임베딩하고 취소·401·429·형상 오류를 구분 | mock + 승인 endpoint 계약 실증, 순서 뒤바뀐 벡터·NaN·잘못된 차원 거절 | worker→main transport→API→validated vectors |
| R-04 | AT-12 / AC12 | 모델 변경·중단·재시작에도 query/document 모델이 섞이지 않고 완성 세대만 전환 | 실패 위치별 활성 포인터·임베딩 fingerprint·구세대 조회 일치<br>profile fingerprint가 같을 때만 cache 재사용, 다른 모델·차원·prompt면 새 generation | profile→staging→activate→query lease<br>profile→cache→generation |
| R-05 | AT-13 / AC13 | 답변 출처는 당시 메일 버전 문단을 열며 조작된 출처 ID는 열리지 않음 | evidence 저장 전 반환 실패·재색인·세션 위조·임의 URL 입력 대조<br>대체 본문·prefix가 인용 offset으로 오인되지 않고 원래 연속 문단을 열음 | context→evidence DB→MCP→Markdown→viewer<br>chunk span→evidence→viewer |
| R-05 | AT-14 / AC14 | 질문의 연대기에서 요청/변경/반대/승인 근거를 남기고 누락·잘림·미확인을 표시 | 고정 정답 타임라인 fixture로 context coverage, 승인 누락/상충 질의 평가<br>오래된 결정·수정 인용·부모 없는 인용·선택 scope 밖 부모의 골드 근거 보존 | seeds→bounded expansion→context→answer<br>seeds→quote fold→neighbors/thread→context |
| R-05 | AT-15 / AC15 | 인용 뷰어에서 날짜·당사자·일치 문단·관계 근거를 확인하고 검색/답변으로 복귀 | 스트리밍/완료 인용 클릭, 좁은 창·키보드·세션전환 상태 대조 | Markdown callback→evidence IPC→viewer |
| R-06 | AT-16 / AC16 | 선택 범위 밖 메일이 검색·확장·출처·첨부에 섞이지 않음 | 서로 다른 두 자료원·두 세션 및 위조 ID/필터 확장 요청에 대해 결과 집합 대조 | session scope→service→all read/export paths |
| R-06 | AT-17 / AC17 | 선택 첨부만 추출, 원본 변경/소실은 명시 오류, 모델 호출은 기존 승인 경유 | 바이트 해시·추출 파일 수, 원본 변경 race, 승인 false/undefined/true 정책 확인 | UI export/tool approval→validated occurrence→Temp |
| R-06 | AT-18 / AC18 | 기존 사내서버·Claude(Bedrock) 각각에서 같은 archive 도구로 근거 있는 답변 가능 | 각 실제 실행 경로에서 MCP result·출처 클릭·취소 확인, 기능별 품질평가 | current harness→runtime tool→context→answer |
| R-07 | AT-19 / AC19 | 대량 처리 중 화면 입력·취소 가능, 큐와 메모리는 §14 예산 내 동작 | 대표 PC actual/1만 mail workload (실제 archive가 1만을 넘으면 5만) 측정, UI 이벤트·취소 ack·RSS 기록<br>cold/warm·색인 중 query·microbatch 크기별 p95/RSS/cancel·embedding 요청 수 기록 | UI/main→bounded worker jobs<br>cache→scheduler→scoped scan |
| R-07 | AT-20 / AC20 | 앱/worker 종료와 재시작 때 손상 없이 중단 상태 복구, API 늦은 결과 미반영 | child kill·request abort·디스크 full·commit 전후 fault injection<br>cache/vector generation 쓰기 도중 kill·취소에서 기존 active 검색 복구 | lifecycle→jobs/generation→restart<br>lease/epoch→transaction→restart |
| R-07 | AT-21 / AC21 | 자료원 제거는 고유 데이터 삭제·공유본 유지, 진행 요청이 삭제 데이터를 복원하지 않음 | import/API/context/첨부 read와 제거 경합, 옛 출처 tombstone 확인<br>자료원/세션 제거와 in-flight 완료 경합에서 cache·vector rows·늦은 결과 재생성 없음 | remove→revoke→DB purge→late response guard<br>revoke→refcount purge→return guard |
| R-08 | AT-22 / AC22 | POP3·기존 채팅·산출물 동작을 보존하고 보관함 초기화가 해당 기능을 막지 않음 | 기존 MIME/권한 suite + 독립 DB·빈 archive 부팅·추가/제거 runtime tests | bootstrap→existing/new service→runtime |
| R-08 | AT-23 / AC23 | 설정·페이지·도구·오류 동작이 양방향 연결되고 오래된 응답이 현 화면을 덮지 않음 | 실제 composition으로 설정 슬롯/오류 링크/범위 칩/요청 역전 테스트 | app composition→feature API→IPC/event |
| R-08 | AT-24 / AC24 | Windows 패키지에서 PST·로컬 추론을 실행하고 개인 메일·테스트 fixture는 배포에 미포함 | 설치 산출물 파일 manifest·실행 smoke·네트워크 차단 모델 팩 실기<br>선택 parser/runtime의 설치본 load/search/delete/reopen과 모델 추론, 모델 미설치 시 FTS5 동작 | electron build→installer→worker/runtime<br>packaged worker→PST/model pack |

총 24 AC로 유지하되 S0→S1→S2→S3 구현 단위는 §11에서 나눈다. UI 표시는 상태 테스트로, 실제 문자 렌더링·포커스·설치/사내 endpoint는 실기로 확인한다.

## 7-A. V / Trace Matrix

이 표는 V1 + ΔV2 + ΔV3 기준 계약이다. 현재 구현 라운드의 유효 범위는 D-025·D-026의 S1이며, S2·S3의 임베딩·RAG pair는 후속 라운드로 남긴다. 기준 V는 메타의 독립 V1 커밋이며, stable node·pair ID와 이전 oracle·선택 mutation을 보존한다. CHANGED는 계약 보완, INHERITED는 변경 없이 영향을 받는 회귀다. 앱이 아직 미구현이므로 기존 테스트 존재를 실행 PASS로 읽지 않는다.

### 이번 라운드 S1 잠금

| 항목 | 이번 구현에서 잠금 | 후속으로 남김 |
|---|---|---|
| 입력 | OS 선택 파일(`.eml`, `.pst`)과 EML 폴더 재귀 배치 | PST 폴더 선택 UX 고도화 |
| 검색 | 제목·발신자·수신자·참조·본문·첨부 이름, 모든 term AND, 짧은 한글 fallback, 자료원 필터 | 의미검색·hybrid fusion |
| 저장 | archive 전용 SQLite/FTS5, stable sourceId·전체 파일 revision·메일 identity·occurrence, 첨부 본문 미저장 | vector generation·scope/evidence |
| 작업 | source/index utility process 분리, bounded batch/backpressure, 취소·revision 검증·재시작 시 중단 상태 | 임베딩 generation 전환 |
| 유효 pair | VP-01·02·03·07·08·09·13·14·17·18·19·23·24·25 중 S1 경로 | VP-04·05·06·10·11·12·15·16·20·21·22 및 S2/S3 증거 |
| AC | AC1·AC2·AC3·AC4·AC5·AC6·AC7·AC9·AC17·AC19·AC20·AC21·AC22·AC23의 S1 관측 | AC8·AC10·AC11·AC12·AC13~16·AC18·AC24의 임베딩/RAG/패키징 실기 |

### Node registry

| Node | 레벨 | 계약 | provenance / 출처 |
|---|---|---|---|
| R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-08 | R | §7의 가져오기 / 데이터·관계 / 검색 / 임베딩 / 근거 / 범위·AI / 수명 / 통합 | R-06·08 INHERITED, 나머지 CHANGED / V1 + 조사 보완 |
| AT-01, AT-02, AT-03, AT-04, AT-05, AT-06, AT-07, AT-08, AT-09, AT-10, AT-11, AT-12, AT-13, AT-14, AT-15, AT-16, AT-17, AT-18, AT-19, AT-20, AT-21, AT-22, AT-23, AT-24 | AT | 같은 번호 AC의 실행 증거 | AT-16~18·22~24 INHERITED, 나머지 CHANGED / V1 + §7 |
| SD-01 / ST-01 | SD / ST | 자료원 작업·재시작·제거의 상태 전이 / 결함 주입 시나리오 | INHERITED / V1 + §5·13 |
| SD-02 / ST-02 | SD / ST | 검색→근거→답변→열람 / 두 AI 경로 시스템 시나리오 | CHANGED / V1 + §5·12 |
| SD-03 / ST-03 | SD / ST | 임베딩 세대 전환 / 취소·활성 조회 경합 시나리오 | CHANGED / V1 + §13 |
| SD-04 / ST-04 | SD / ST | 화면·범위·세션 수명 / 두 세션 UI 시나리오 | INHERITED / V1 + §5·12 |
| AR-01 / IT-01 | AR / IT | Renderer/preload/IPC/worker DTO / 실제 경계 왕복 | CHANGED / V1 + §10 |
| AR-02 / IT-02 | AR / IT | Reader·DB·식별자·스냅샷 / 실제 SQLite 통합 | CHANGED / V1 + §9·10 |
| AR-03 / IT-03 | AR / IT | 로컬/API port·자격증명 / adapter 계약·오류 통합 | CHANGED / V1 + §10·15 |
| AR-04 / IT-04 | AR / IT | runtime tools·session·Markdown / composition 통합 | INHERITED / V1 + §10·12 |
| AR-05 / IT-05 | AR / IT | worker 패키징·공유 MIME / 산출물 실행·기존 동작 회귀 | INHERITED / V1 + §11·19 |
| AR-06 / IT-06 | AR / IT | source/index utility process lifecycle·protocol / 두 worker와 SQLite를 통한 실제 왕복 | CHANGED / ΔV3 + §9·10·13 |
| MD-01 / UT-01 | MD / UT | 정규화·identity·offset / 순수 fixture 비교 | CHANGED / V1 + §10 |
| MD-02 / UT-02 | MD / UT | short-token query·filter·fusion / 결과 집합·순위 비교 | CHANGED / V1 + §10 |
| MD-03 / UT-03 | MD / UT | 관계 resolver·context budget / edge·coverage 비교 | CHANGED / V1 + §10 |
| MD-04 / UT-04 | MD / UT | embedding fingerprint·validation / 분리·오류 비교 | CHANGED / V1 + §10 |
| MD-05 / UT-05 | MD / UT | scope·evidence·revoke / 허용·거절·tombstone 비교 | CHANGED / V1 + §10·13 |
| MD-06 / UT-06 | MD / UT | job reducer·UI 상태 / stale 응답·전환 비교 | INHERITED / V1 + §5·13 |
| MD-07 / UT-07 | MD / UT | stable source/mail identity·whitespace term compiler / revision 재사용·검색 집합 비교 | CHANGED / ΔV3 + §10 |

### Pair registry

`EP-xx(N)`의 N은 §10에서 명명한 **자리 수**이며 전체 합의 중복 제거 수가 아니다. 적대 증거 `직접`은 위·아래 행의 행동 oracle로 충분해 추가 mutation을 선택하지 않았다는 뜻이다.

| Pair | left ↔ right / provenance | requiredness | start → edges → end | 직접 evidence oracle | 선택 적대 증거 | 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01, AT-02, AT-03 / CHANGED | REQUIRED | 설정→IPC→reader→DB→현황/결과<br>reader→선택 본문→저장 | AC1~3 입력·저장·상태 대조<br>AC2 golden | M-NESTED | EP-01(4), EP-02(4), EP-15(4) |
| VP-02 | R-02 ↔ AT-04, AT-05, AT-06 / CHANGED | REQUIRED | source→normalize→version/edge→viewer<br>분류→identity→본문 | AC4~6 원문·edge·중복 비교<br>재결합·충돌 | 직접 | EP-03(4), EP-04(3), EP-16(4) |
| VP-03 | R-03 ↔ AT-07, AT-08, AT-09 / CHANGED | REQUIRED | 입력→필터→검색 분기→융합→결과<br>query→fusion→UI | AC7~9 ID 집합·제외 payload<br>결과·payload | M-NESTED | EP-05(4), EP-06(3), EP-15(4), EP-17(3), EP-18(4) |
| VP-04 | R-04 ↔ AT-10, AT-11, AT-12 / CHANGED | REQUIRED | profile→provider→staging→active→query<br>prompt→cache/vector→결과 | AC10~12 fingerprint·정답 비교<br>fingerprint·동등성 | 직접 | EP-07(5), EP-08(4), EP-17(3), EP-19(4), EP-20(3) |
| VP-05 | R-05 ↔ AT-13, AT-14, AT-15 / CHANGED | REQUIRED | seeds→확장→evidence→도구→viewer<br>span→context→citation | AC13~15 문단·coverage·복귀<br>연속 문단·coverage | M-CITE | EP-04(3), EP-09(5), EP-16(4), EP-18(4) |
| VP-06 | R-06 ↔ AT-16, AT-17, AT-18 / INHERITED | REGRESSION | 세션→범위→조회/추출→AI<br>같은 scope→새 projection/cache→기존 AI/첨부 | AC16~18 허용/거절·파일·실환경 | M-SCOPE | EP-10(8), EP-11(4), EP-12(3), EP-19(4), EP-20(3) |
| VP-07 | R-07 ↔ AT-19, AT-20, AT-21 / CHANGED | REQUIRED | job→worker/API→commit→취소/복구<br>cache/index job→revoke→복구 | AC19~21 시간·DB·late-write<br>late write 거절 | 직접 | EP-02(4), EP-08(4), EP-13(3), EP-19(4), EP-20(3) |
| VP-08 | R-08 ↔ AT-22, AT-23, AT-24 / INHERITED | REGRESSION | bootstrap→등록/설정→runtime/package<br>옵션 분리/설치본→기존+신규 경로 | AC22~24 기존 동작·실행 결과 | M-WIRE | EP-01(4), EP-12(3), EP-14(3), EP-15(4), EP-20(3) |
| VP-09 | SD-01 ↔ ST-01 / INHERITED | REGRESSION | 등록→batch→취소/kill→재개/삭제<br>import→vector/cache→중단/제거 | commit 직전/직후 데이터·상태<br>journal 복구 | 직접 | EP-02(4), EP-13(3), EP-19(4), EP-20(3) |
| VP-10 | SD-02 ↔ ST-02 / CHANGED | REQUIRED | 검색→확장→답변→인용 확인<br>단일 query→context→근거 열람 | 양쪽 AI 실제 source manifest·문단<br>골드 timeline | 직접 | EP-04(3), EP-09(5), EP-12(3), EP-17(3), EP-18(4) |
| VP-11 | SD-03 ↔ ST-03 / CHANGED | REQUIRED | 모델 교체→staging→activate→GC<br>profile→cache miss/index rebuild→active | 기존 쿼리 lease와 신규 세대 일치<br>epoch | 직접 | EP-07(5), EP-08(4), EP-19(4), EP-20(3) |
| VP-12 | SD-04 ↔ ST-04 / INHERITED | REGRESSION | 범위선택→질문→세션전환→복귀<br>세션전환→quote fold/cache→viewer | 세션별 scope/viewer·focus 복원<br>교차 노출 없음 | 직접 | EP-01(4), EP-09(5), EP-10(8), EP-16(4), EP-19(4) |
| VP-13 | AR-01 ↔ IT-01 / CHANGED | REQUIRED | renderer→preload→IPC→service→worker<br>quality/match reason DTO→IPC→UI | 실제 handler 스키마·error·취소 왕복<br>원인·상태 일치 | 직접 | EP-01(4), EP-02(4), EP-15(4), EP-18(4) |
| VP-14 | AR-02 ↔ IT-02 / CHANGED | REQUIRED | reader→write transaction→read snapshot<br>variant/chunk/vector→DB→검색 | 실제 DB relation·FTS·버전 원자성<br>실제 transaction | 직접 | EP-03(4), EP-04(3), EP-05(4), EP-16(4), EP-17(3), EP-20(3) |
| VP-15 | AR-03 ↔ IT-03 / CHANGED | REQUIRED | profile→vault/transport→vectors→DB<br>model renderer/cache→adapter→결과 | doc 예제 shape + 실패 의미<br>doc shape·오류 의미 | 직접 | EP-07(5), EP-08(4), EP-17(3), EP-19(4) |
| VP-16 | AR-04 ↔ IT-04 / INHERITED | REGRESSION | registry→context→tool result→Markdown<br>새로운 span/품질 flag→기존 도구→출처 UI | 실행된 도구·persisted ID·UI 강조 | M-CITE, M-WIRE | EP-09(5), EP-10(8), EP-12(3), EP-16(4), EP-18(4) |
| VP-17 | AR-05 ↔ IT-05 / INHERITED | REGRESSION | build→child entry→worker/parser→메일<br>archive parser 옵션/runtime→설치본 | 설치본 실추론/PST·MIME 회귀<br>POP3 불변 | M-PACK | EP-14(3), EP-15(4), EP-20(3) |
| VP-18 | MD-01 ↔ UT-01 / CHANGED | REQUIRED | parsed fields→normalize/identity→segments<br>MIME 후보→분류/identity | fixture hash·유니코드·충돌 비교<br>decode·offset·sentinel | M-NESTED | EP-03(4), EP-06(3), EP-15(4), EP-16(4) |
| VP-19 | MD-02 ↔ UT-02 / CHANGED | REQUIRED | query→terms/filters→RRF→mail ranks<br>hard/soft→RRF→fold | 한글·정확번호·짧은 토큰 결과<br>정확 집합·순위 | 직접 | EP-05(4), EP-10(8), EP-18(4) |
| VP-20 | MD-03 ↔ UT-03 / CHANGED | REQUIRED | refs/candidates→edges→context<br>인용 대응→이웃/thread→context | 순환 종료·누락·순서·잘림 표시<br>손실·초과 없음 | 직접 | EP-04(3), EP-09(5), EP-16(4), EP-17(3), EP-18(4) |
| VP-21 | MD-04 ↔ UT-04 / CHANGED | REQUIRED | model manifest→fingerprint→vector check<br>prompt/hash→cache/차원→검색 | 잘못된 차원·NaN·model version 거절<br>hit/miss·profile 변경 시 재임베딩 | 직접 | EP-07(5), EP-08(4), EP-17(3), EP-19(4), EP-20(3) |
| VP-22 | MD-05 ↔ UT-05 / CHANGED | REQUIRED | scope/evidence ID→validation→read/purge<br>scope/revoke→cache/vector→evidence | 위조·삭제·외부자료원 허용 집합<br>거절·삭제 | M-SCOPE | EP-09(5), EP-10(8), EP-13(3), EP-19(4), EP-20(3) |
| VP-23 | MD-06 ↔ UT-06 / INHERITED | REGRESSION | request/event→reducer→UI state<br>품질·fold·cache event→UI | 역전 응답·restart·취소의 상태<br>stale 응답 거절 | 직접 | EP-01(4), EP-02(4), EP-18(4), EP-19(4) |
| VP-24 | AR-06 ↔ IT-06 / CHANGED | REQUIRED | IPC→main job→source child→bounded batch→index child→SQLite→progress/search<br>cancel/shutdown→epoch revoke→staging cleanup | 같은 PST 재등록·수정 revision·cancel·child exit 각각의 DB/검색/카운터 snapshot | M-WORKER: batch ack를 늦추거나 제거하면 cancel/queue boundedness assertion red | EP-02(4), EP-14(3), EP-21(9) |
| VP-25 | MD-07 ↔ UT-07 / CHANGED | REQUIRED | source fingerprint→revision state; normalized mail→identity key→upsert; whitespace query→terms→FTS/LIKE→IDs | 동일 PST 추가 revision은 기존 ID 재사용, 같은 Message-ID의 변경 payload는 별도 보존, `서버 이전`은 양 term을 모두 포함한 결과만 반환 | 직접 | EP-03(4), EP-05(4), EP-21(9) |

선택 mutation: M-CITE는 링크의 존재만으로 배선을 오인하지 않도록 EP-09d(스트리밍)·EP-09e(완료) 각각 callback을 제거해 실패시킨다. M-SCOPE는 전수 범위 주장 때문에 EP-10a~h 각 자리에서 제한을 넓히는 결함을 각각 심는다.

M-WIRE는 EP-12a 등록 제거와 EP-01a 설정/페이지 슬롯 제거 각각에 실제 사용자 경로가 실패해야 한다. M-PACK은 EP-14b에서 테스트용 sentinel 메일을 임시 패키지 입력에 포함시켜 산출물 내용 검사 실패를 확인하고, 패턴 문자열 존재만 검사하지 않는다.

현재 문서 변경의 운영 gate는 §19 G-DOC·G-MSG이다. 구현 게이트와 제품 pair는 구현 턴에 수행한다.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

조사 기준은 메타의 main 커밋이다. 아래는 현재 코드 관측이고, 이후 절의 신규 파일·채널·타입은 제안이다.

| 발견 / 제약 | 확인한 근거 | 설계 영향 |
|---|---|---|
| POP3 모델은 UIDL·본문·유효 날짜 중심이고 관계 헤더가 없음 | `app/src/main/features/plugins/mail/types.ts`의 `MailDocument`, `normalize.ts` | 공통 파서 출력 재사용, 보관함 DTO 신설 |
| MIME 파서 타입에는 messageId/inReplyTo/references 존재 | 설치된 `postal-mime/postal-mime.d.ts:63~65` | normalize에서 관계 필드를 잃지 않도록 별도 매핑 |
| 기존 검색은 전체 질의 길이로 MATCH/LIKE 선택 | `mail/query-builder.ts` | 한글 짧은 토큰이 섞인 질의는 archive 자체 term compiler 필요 |
| POP3는 보존 기간 있는 별도 저장소 | `mail/retention-window.ts`, `store.ts` | archive를 POP3 계정/retention에 넣지 않음 |
| 기본 deployment의 plugin binding은 빈 목록, 인증 binding 존재 | `app/src/main/app/deployment/plugins.ts:59,85` | 로컬 자료원 등록은 bootstrap에서 별도 연결 |
| 산출물 도구가 bootstrap에서 직접 등록됨 | `app/src/main/app/bootstrap.ts:940` | runtime 등록 패턴은 재사용, 메일 원문을 artifact로 게시하지 않음 |
| 도구 문맥은 신뢰된 세션 대기와 취소를 제공 | `adapters/runtime-tools.ts`의 `waitForSession`, `getSignal`; `claude-runtime-tools.ts` | 모델 인자로 sessionId를 받지 않음 |
| `readOnlyHint`가 true일 때만 읽기 자동 승인 | `adapters/runtime-tool-policy.ts` | 첨부 쓰기는 false, 미지정을 허용으로 취급하지 않음 |
| 설정 탭 타입과 오류 목적지 타입이 연결됨 | `app/src/shared/app-error.ts:31`, `settingsModalStore.ts`, `app/errorToastTarget.ts` | 새 탭·오류 복구 링크를 함께 연결 |
| SettingsModal의 현재 조립 위치는 app 계층 | `renderer/src/app/SidebarUserButton.tsx:133` | settings→mail-archive feature 직접 import 대신 app 주입 슬롯 |
| Markdown 링크와 스트리밍 렌더링은 분리되어 있음 | `shared/ui/markdown/Markdown.tsx`, `features/chat/components/markdown/StreamingMarkdown.tsx` | 양쪽에 내부 링크 callback 전달 필요 |
| 우측 패널에 세션별 artifact viewer·다른 패널 상태가 있음 | `features/chat/components/rightpanel/RightPanel.tsx` | generic evidence viewer 슬롯과 복귀 상태를 조립, 타 feature 직접 import 금지 |
| 첨부 exporter는 바이트→안전한 Temp staging/rename이며 승인 자체를 하지 않음 | `mail/attachment-export.ts` | 검증·승인은 호출 서비스/기존 도구 정책에서 수행 |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 기존 runtime 등록 production 자리 | `rg 'runtimeTools\.add\|registry\.add' app/src/main --glob '!*.test.*'` | 2 | bootstrap 직접 등록·deployment binding을 구분 |
| AppSettingsTab 정의·소비 파일 | `rg -l 'AppSettingsTab' app/src` | 3 | shared 정의·settings store·app 오류 target |
| utilityProcess/worker_threads 실행 import | `rg 'import.*(utilityProcess\|worker_threads)\|from .*(utilityProcess\|worker_threads)' app/src/main --glob '!*.test.*'` | 0 | 자식 프로세스 lifecycle은 신규 배선. 주석 문자열은 실행 import 아님 |
| 기존 MIME 첨부 분류 표 | `mail/mime.test.ts`의 `it.each` 행을 직접 열람 | 12 | inline/CID/일반첨부 분류 회귀 대상 |

기존 테스트의 `mail MIME bytes` → `decodes raw EUC-KR body without first passing through UTF-8` 케이스와 `mail MIME attachment classification`을 직접 확인했다. 테스트가 있다는 관측이며 이 설계 턴에서 실행·PASS를 주장하지 않는다.

### 외부 1차 근거

- [SQLite FTS5 trigram](https://www.sqlite.org/fts5.html#the_trigram_tokenizer): 짧은 부분문자열 검색 제약이 있으므로 토큰별 fallback과 바인딩 SQL을 설계한다.
- [RFC 5322 §3.6.4](https://www.rfc-editor.org/rfc/rfc5322.html#section-3.6.4): 메시지 식별·응답 헤더를 관계 근거로 보존한다. 누락·잘못된 실데이터까지 정상이라고 가정하지 않는다.
- [pst-extractor 공식 저장소](https://github.com/epfromer/pst-extractor): 폴더 순회·메일 속성·첨부 API를 제공하며 손상 PST 지원에는 제약이 있다. `npm view pst-extractor@1.12.0 version repository.url license --json`으로 1.12.0·해당 저장소·MIT 메타데이터를 확인했다.
- [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process), [electron-vite worker entry](https://electron-vite.org/guide/dev): 프로세스 격리·entry bundling의 근거. 설치된 `electron-vite/node.d.ts`에도 `*?modulePath` 선언이 있다.
- [ONNX Runtime JavaScript](https://onnxruntime.ai/docs/get-started/with-javascript/), [Tokenizers.js](https://github.com/huggingface/tokenizers.js): 로컬 후보의 실행·토큰화 경계. 모델의 pooling·prefix까지 자동 결정해 주는 것으로 취급하지 않는다.

외부 문서 열람과 npm 메타데이터 확인은 호환성 실증이 아니다. ANSI/Unicode PST, 모델 팩, 실제 API 응답은 S0에서 별도 확인한다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
deployment auth binding → POP3 mail service → mail store/FTS → mail tools
bootstrap → runtime tool registry → current harness → 채팅
SettingsModal(general/usage/provider)        RightPanel(기존 뷰어)
```

현재 구조에는 개인 EML/PST 자료원·파일별 재개·메일 버전·임베딩 프로필·메일 근거 뷰어가 없다. POP3는 계정 인증·수집·보존 정책을 소유하며, 기존 도구 및 채팅 수명은 유지한다.

### TO-BE

```text
renderer app 조립
  ├ SettingsModal ← ArchiveSettings 슬롯
  ├ MailArchivePage ← 검색/메일/관계/추출
  └ Chat ← 범위 chip·도구카드·근거 viewer 슬롯
                 │ preload → strict orca:archive:* DTO
main app/bootstrap → MailArchiveService → RuntimeToolServer
                       ├ OS 경로 capability / session scope / 취소 / API broker
                       ├ index utility process: SQLite sole writer + 조회·job journal
                       ├ source utility process: EML/PST 파싱·원본 검증·선택 추출
                       └ embedding utility process: 로컬 추론·블록별 cosine 계산
                                 API 사용 시 main → injected Chromium transport
```

main은 경로 선택·권한·IPC·프로세스 감독·네트워크 broker를 소유한다. 자식은 네트워크 자격증명을 받지 않으며, 원본 파일 처리는 읽기 전용이다.

DB를 소유한 index process와 계산 process를 분리해 동기 PST 파싱이 검색 요청을 막지 않게 한다. source·embedding process는 필요 시만 띄우고 각각 동시 작업 하나, index process는 archive DB의 단일 writer로 유지한다.

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 책임 | POP3 계정 기반 mail feature | 같은 plugins feature 내부의 별도 mail-archive 서비스 | AR-02 / VP-14 |
| 흐름 | 수집→캐시→도구 | 사용자 등록→job→version/index→UI·도구 | SD-01 / VP-09 |
| 상태 | UIDL·기한 캐시 | source/occurrence/version/evidence/generation | AR-02·MD-01 / VP-14·18 |
| 오류 | POP3 연결·캐시 오류 | 자료원 상태·색인 상태·임베딩 상태·질문 상태 각각 분리 | SD-01·SD-03 / VP-09·11 |
| UI | 설정·채팅·기존 우측 뷰어 | app 조립 슬롯·보관함 페이지·근거 뷰어 | AR-01·AR-04 / VP-13·16 |
| 검증 | MIME/POP3 단위·통합 | 재사용 회귀 + 실제 DB·worker·두 AI 경로 | AR-05 / VP-17 |

### 책임과 레이어

main의 `features/plugins/mail-archive`는 source reader, domain, store, jobs, retrieval, tools를 소유한다. `plugins/mail`과 공통으로 쓸 순수 MIME/첨부 분류만 `plugins/mail-content.ts`로 올리고 POP3 계정·정책·테이블은 이동하지 않는다.

외부 임베딩 transport·secret resolver는 bootstrap이 주입한다. feature가 다른 feature의 인증/채팅 구현을 직접 import하지 않고 필요한 구조적 포트는 contracts 계층에 둔다.

renderer의 새 `features/mail-archive`는 UI와 자신의 상태·API만 소유한다. `app`/`pages`가 settings와 chat에 슬롯/callback을 주입하고 `shared` Markdown은 메일 개념 없이 내부 링크 resolver prop만 제공한다.

### 본문 처리 흐름과 순수 seam

현재 POP3의 파싱 경로와 보관함의 별도 reader를 구분한다. 보관함은 아래 MIME alternative 선택·가역 분류·표현별 입력 예산을 거친다.

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

| 비교 축 | 처리 대상 | 정본 / seam |
|---|---|---|
| 본문 선택 | plain 없으면 HTML 변환 | `body-selection.ts`가 품질/중복/첨부 경계와 선택 이유 반환 |
| 본문 분류 | new/quote/signature/unknown | `segment-classifier.ts`의 보수적 판정·overlap 금지·원문 offset |
| 색인 표현 | 제목·본문 가중치 | `index-projection.ts`의 whitelist 필드·모델별 prompt renderer |
| chunk/중복 | body hash·메일 집계 | `chunker.ts`의 연속 span과 `embedding-key.ts`의 실제 입력 hash 분리 |
| 조회 | 후보 융합·thread 확장 | `retrieval-policy.ts`의 hard/soft 제약·중복 접기·같은 버전 이웃 확장 |
| 계산 재사용 | 세대 분리 | `query-embedding-cache.ts`·`vector-search.ts`와 각 epoch/lease |

새 순수 파일은 `main/features/plugins/mail-archive/` 아래에 두고 Electron/DB/native import를 하지 않는다. reader·store·embedding adapter·UI는 §11의 주입 경계를 유지한다.

## 10. 계약 / 타입 / 강제 지점

### 데이터 모델과 정체성

SQLite는 `<userData>/mail-archive/archive.db`를 제안한다. 기존 core/mail DB migration과 분리하고 신규 DB 안에서 versioned migration·WAL·foreign key·transaction을 적용한다.

| 테이블/정본 | 주요 필드와 불변식 |
|---|---|
| `archive_source` | sourceId, kind(eml/pst), canonical path capability, health, current verified revision, revokedAt. sourceId는 `kind + canonical path` hash; 경로는 main/source worker만 읽음 |
| `source_revision` | sourceId, revision, full fingerprint, state(staging/verified/interrupted/failed), verifiedAt. EML은 파일별 원본 digest, PST는 전체 컨테이너 SHA-256; stat는 빠른 변경 힌트일 뿐 |
| `source_occurrence` | sourceId/revision + EML 상대 경로/rawDigest 또는 PST 내부 node locator → mailId/versionId. PST locator는 해당 revision에서만 유효하고 verified revision만 검색 근거로 사용 |
| `mail` / `mail_version` | 내부 UUID, 원 Message-ID, content hash, 제목, from/to/cc의 이름·주소, sentAt/receivedAt/importedAt, dateQuality, selectedVariantId·정규화 버전 |
| `body_variant` | versionId, kind, text, qualityFlags, selectionReason. 선택 표현에 offset 귀속, 대체 표현은 별도 열람 |
| `body_segment` | versionId, kind(new/quote/signature/unknown), start/end UTF-16 code unit offset. 구간은 원문 snapshot 위에 존재 |
| `mail_relation` | child/parent 또는 미해결 Message-ID, kind(reply/reference/pst-group/related-candidate), 근거·ambiguity. 순환 검사 |
| `attachment` | occurrenceId, ordinal, 원 이름/표시 이름, mimeType, size, inline 여부, locator. payload는 저장하지 않음 |
| `mail_fts` / short-token lookup | 제목·새 본문·인용·이름 필드와 정규화 검색 텍스트. snapshot offset과 혼용하지 않음 |
| `embedding_profile` / `embedding_generation` | provider config ref, fingerprint, dimension, state, corpusRevision, indexedVersionCount, active pointer |
| `mail_chunk` / `chunk_vector` | versionId, offsets, generationId, normalized float32 BLOB. 서로 다른 generation 검색 금지 |
| `archive_job` | jobId, target, epoch, phase, cursor, committed/skipped/failed, errorCode. cursor만으로 원본 버전을 추정하지 않음 |
| `archive_scope` / `evidence_run` / `evidence_item` | scopeId→owner/sessionId·허용 자료원/기간/메일 집합; run→scope snapshot/indexAsOf; item→versionId/offsets/근거 종류 |

`sourceId`는 `sourceKind + canonical absolute path`의 SHA-256이며 PST 전체 fingerprint와 독립이다. 따라서 같은 경로의 PST가 누적되어 컨테이너 hash가 바뀌어도 같은 자료원 revision이 된다. 경로는 main/source worker 전용이고 renderer DTO·로그에 노출하지 않는다.

Message-ID 단독 unique 제약은 두지 않는다. ID가 있으면 `identityKey = SHA-256(normalized Message-ID + normalized payload digest)`이며 payload digest는 날짜·당사자·제목·정규화 본문·정렬된 첨부 manifest에서 만든다. 같은 ID의 수정 본문은 다른 identityKey로 보존한다. ID가 없으면 `identityKey = SHA-256(sourceId + item locator + normalized payload digest)`로 한정한다. 제목 유사도나 본문 일부만으로 자동 병합하지 않는다.

같은 identityKey의 메일은 하나의 archive mail로 유지하고 자료원·revision별 occurrence를 추가한다. 전체 PST fingerprint는 변경 감지·revision 검증에만 쓰며 mail ID나 identityKey 생성에 넣지 않는다. PST worker가 시작/완료 fingerprint를 비교해 일치한 revision만 verified로 승격한다. 취소·해시 불일치·worker 종료 시 staging occurrence를 검색에서 제외하고 직전 verified revision은 그대로 둔다. 완료한 EML 파일은 파일 단위 verified 상태로 보존한다.

ID 없는 메일은 같은 원본 digest일 때만 확실한 중복으로 취급한다. EML↔PST 변환으로 동일성을 증명하지 못한 경우 후보 중복으로 표시하며 내용 유사도만으로 삭제하지 않는다.

Bcc·배달 헤더·첨부 manifest는 occurrence별로 보존한다. 같은 논리 메일이더라도 선택한 자료원 occurrence에서 보이지 않는 수신 정보를 다른 occurrence에서 합쳐 표시하지 않는다.

전체 정규화 본문은 UTF-8로 저장하고 offset은 JS `.slice`와 같은 UTF-16 기준이다. 검색용 정규화/NFKC·하이라이트는 offset map을 거치며, 인용문에는 원 snapshot과 정확히 일치하는 부분만 사용한다.

메일 시각이 없으면 sentAt은 null이다. 날짜 필터는 sentAt 기준이며 UI에 명시하고, receivedAt은 보조 표시로만 사용한다; importedAt을 사건 순서로 대입하지 않는다.

### 파싱·관계·증분

EML은 raw bytes를 `postal-mime`에 전달해 charset·MIME을 해석한다. PST는 native 메타데이터/transport headers를 읽어 동일 DTO로 매핑하며 HTML→텍스트 변환 결과·날짜 해석 오류·빠진 필드를 품질 flag로 남긴다.

EML 폴더 순회는 대소문자와 무관한 `.eml`만 대상으로 하고 junction/symlink를 따라가지 않는다. 재연결·첨부 재판독 시 선택 루트의 canonical path와 occurrence 상대 경로를 확인해 경로 이탈과 순환 순회를 거절한다.

plain/HTML 후보 선택과 텍스트화는 아래 본문 선택·문자 해석 계약을 따른다. 이미지·HTML 실행을 기본 뷰어에 넣지 않고, 본문에 포함된 외부 URL은 사용자의 명시 클릭에서만 기존 링크 정책을 적용한다.

References/In-Reply-To는 역순 수집에도 재해결한다. 동일 Message-ID 부모 후보가 여러 개면 ambiguous로 남기고 임의 하나를 고르지 않으며, PST conversation 정보는 그룹 근거로 표시해 직접 답장 edge와 구분한다.

제목 정규화·참여자·날짜 근접성은 관련 후보 계산에만 쓴다. 원본 메일이 없는 인용 내용은 “다른 메일에 인용됨”으로 표시해 실제 원 메일인 것처럼 날짜·발신자를 생성하지 않는다.

재스캔은 hash 확인 후 변경 파일만 다시 파싱한다. PST는 시작/완료 시 fingerprint 일치를 확인하고, 변경 중인 컨테이너의 새 revision은 활성화하지 않는다; 중단된 staging을 재개할 때도 fingerprint부터 확인한다.

PST 한 revision의 완료 여부를 숨기지 않는다. 검증된 배치는 `부분 자료`로 검색 가능하되 원본 변경이 감지되면 해당 revision을 검색 대상에서 제외하고 이전 검증 revision을 유지한다.

### MIME와 첨부 경계

EML adapter는 설치된 PostalMime의 `forceRfc822Attachments: true`를 명시해 `message/rfc822` 하위 본문을 보관함 본문으로 합치지 않는다. 단순 본문 안의 “전달된 메시지” 텍스트는 quote segment로 남기고, 실제 첨부 EML/PST·text/plain attachment는 이름·크기·locator만 저장한다.

`text/plain`과 `text/html`은 대체 표현 후보이며 기본 색인에는 하나만 넣는다. 파일명은 제목 대신 쓰지 않고 제목 없음을 표시하며, title boost는 실제 Subject에만 적용한다.

기존 POP3 parser 옵션은 바꾸지 않는다. archive reader의 별도 옵션과 동일 fixture로 첨부 본문 sentinel이 source DTO→lexical→embedding→LLM 경로에 없는지 확인한다.

### 본문 선택과 문자 해석

1. 정상적인 plain이 있으면 우선한다. 공백/깨진 문자만 있거나 확인된 “HTML로 보세요” placeholder이고 정상 HTML이 있을 때 HTML 텍스트로 대체한다.
2. 길이가 짧다는 이유만으로 정상 plain을 버리지 않는다. plain/html 불일치는 `alternative_mismatch`, charset 오류 가능성은 `decode_suspect`로 남긴다.
3. HTML은 비실행 tree에서 script/style·명시적인 hidden 요소를 제외하고 문단·목록·표 행 경계를 유지한다. CSS cascade·외부 stylesheet로 숨김을 완전히 판단한다고 주장하지 않는다.
4. text의 NFC 같은 변환은 snapshot 생성 전에 한 번 수행하고 normalizer revision에 넣는다. 제로폭/제어문자는 검색 projection에서 목적별 처리하되 emoji·업무 식별자의 의미를 일괄 삭제하지 않는다.
5. 선언 charset 해석은 기존 MIME 파서에 맡기고, 잘못된 선언을 복구하려고 이미 깨진 JS string에 다른 decoder를 다시 적용하지 않는다. 강제 복구는 원본 part bytes와 transfer encoding을 확보한 adapter에서만 가능하다.

현재 PostalMime 공개 API는 text/html을 반환하지만 part-level charset override hook은 노출하지 않는다. 따라서 첫 구현은 표준 charset/alias 케이스를 검증하고 미복구 항목을 표시하며, 범용 자동 복구·ftfy 도입은 D-014/D-015의 별도 실증 없이는 추가하지 않는다.

영어 메일·숫자·코드만 있는 메일도 정상일 수 있으므로 “한글 5%”를 합격 조건으로 쓰지 않는다. `decode_suspect` 메일은 키워드 열람은 가능하되 기본 의미검색/context에서는 제외하고, 사용자가 해당 메일을 직접 열거나 선택한 경우 경고와 함께 읽는다.

본문 표현 schema는 `body_variant(versionId, kind, text, qualityFlags, selectionReason)`와 `mail_version.selectedVariantId`다. 선택 표현 하나에만 offset을 귀속하고, 대체 표현 열람은 인용을 그 표현으로 자동 바꾸지 않는다; 정규화 규약 변경 시 새 mail_version을 만든다.

메일당 본문 2 MiB UTF-8 상한은 선택 본문과 보존하는 대체 본문 텍스트의 합에 적용한다. 같은 정규화 텍스트는 한 variant로 참조하고, 합계 초과는 `oversized`와 이유를 표시한다. 선택 본문이나 대체 표현을 조용히 잘라 정상 처리하지 않는다.

### 인용·서명 분리

`segment-classifier.ts`는 `[start,end)`, kind, ruleId, confidenceClass(certain/uncertain)를 반환한다. 원문의 모든 code unit은 정확히 한 segment에 속하고 원문을 이어 붙이면 snapshot과 동일해야 한다.

plain의 `>` 연속 블록·확인된 원본 헤더 구분선, HTML의 blockquote·클라이언트 컨테이너는 quote 근거다. 문장 중 “보낸 사람:”이나 한 줄 `--`만으로 그 뒤 전체를 잘라내지 않는다.

quote 사이에 새로 쓴 답변은 new/unknown으로 남긴다. 서명·면책도 확실한 구분 구조만 분류하고, 발신자별 반복 꼬리 통계는 진단 자료로만 사용한다.

new/unknown은 주 검색 본문, quote는 낮은 lexical 가중치의 별도 필드, signature는 이름/정확 문자열 발견을 위한 낮은 가중치 lexical로 남긴다. new/unknown과 quote는 segment별로 임베딩하되 quote 중복은 조회 단계에서 접는다. 확실한 signature는 기본 embedding/context에서 제외하지만 hit/직접 선택 때 펼쳐 읽을 수 있다.

quote는 원 메일 존재 여부만으로 인덱스에서 삭제하지 않는다. 동일 문단·동일 의미의 원문 대응이 확인되고 **현재 scope에서 접근 가능할 때만** 결과/context 반복을 접으며, 인용자·시각·원문 없음/범위 밖을 표시한다.

인용 대응 hash는 공백·인용 접두를 정규화해 계산하되 부정어·수치·날짜를 제거하지 않는다. 유사도만 높은 수정 인용은 접지 않아 “10대”→“20대”, “승인”→“미승인” 변경을 보존한다.

### 색인 필드와 입력 예산

| 표현 | 구성 | 제외/보존 규칙 |
|---|---|---|
| display snapshot | 선택 본문 전체와 segment, 별도 mail metadata | 전송 헤더를 본문 앞에 덧붙이지 않음 |
| lexical | subject, fromName/fromAddr, to/cc, bodyNew/unknown, bodyQuote, bodySignature, attachmentNames | Bcc는 occurrence scope를 통과한 별도 메타 필터; 전역 FTS에 합치지 않음 |
| embedding | 모델 필수 prompt + 실제 Subject + 선택적 발신자 이름/메일 날짜 + 연속 본문 span | 전체 주소목록·Received/DKIM/ARC/X 헤더·첨부 본문·로컬 경로 제외 |
| context | snapshot 문단 + 발신자·날짜·subject·관계 근거 + evidenceId | 모델이 생성한 요약/질문을 원문 사실로 재색인하지 않음 |

모델의 최대 token L에서 special token 예약량 S를 뺀 `B=min(512,L-S)`를 첫 비교 예산으로 쓴다. 필수 prompt P는 절대 제거하지 않고 optional metadata H는 `min(128,floor((B-P)×0.25))` 이내로 줄인다.

본문 공간이 `min(256,B-P)`보다 작으면 optional metadata부터 제거한다. `B≤P`는 모델 팩 설정 오류로 처리하고, API가 tokenizer를 제공하지 않으면 그 API의 검증된 token-count/byte-limit 계약이 D-015 완료 조건이다.

chunk는 한 메일 버전의 연속 segment 내부에서 문단→문장→token 순서로 나눈다. overlap은 0으로 고정하고, 문맥은 검색 뒤 이웃 chunk로 확장한다.

`chunkId = hash(versionId, variantId, segmentId, start, end, chunkerRevision)`이고 내용이 같다고 출처 identity를 합치지 않는다. `embeddingKey = hash(profileFingerprint, purpose, UTF8(renderedInput))`라서 제목·날짜·prompt가 달라지면 새 계산이다.

캐시는 실제 최종 입력이 같은 경우만 공유한다. 다른 스레드의 “네, 승인합니다”를 하나의 근거로 만들거나, scope 밖 메일의 메타데이터가 붙은 vector를 현재 인용의 대용으로 쓰지 않는다.

### 검색·Context 구성

`SearchRequest`는 query, optional filters, mode(lexical/hybrid), cursor를 갖는다. mode 생략은 hybrid, 활성 임베딩이 없으면 lexical + degraded reason으로 응답한다.

1. UI 필터와 세션 scope를 교집합한다. 자연어에서 추정한 날짜·사람은 사용자에게 보이는 해석이며 모호하면 hard filter로 몰래 고정하지 않는다.
2. 문서번호·주소·따옴표 정확 문자열과 FTS5를 결합한다. 3글자 미만 토큰은 escape된 parameter LIKE 등 fallback으로 **토큰별** 처리하고 혼합 AND 조건을 유지한다.
3. lexical·vector 각각 동일 범위 안에서 후보를 뽑는다. 전 보관함 vector top-k를 구한 뒤 filter하는 방식은 범위 내 좋은 후보를 누락하므로 사용하지 않는다.
4. 분기 안에서 mailId/version별 최고 chunk로 순위를 만든 뒤 RRF(k=60 초기 제안)로 융합하며 정확 식별자 일치 tier를 우선한다. 아래 하이브리드 계약의 필드 가중치와 hard constraint를 적용한다.
5. 이력 질문은 seed의 확인된 edge를 앞뒤로 확장하고 관련 후보는 별도 표시한다. 기간 경계 밖 자료는 기본 배제하며 `기간 넓혀 보기`를 사용자에게 제시한다.
6. 날짜순으로 context를 구성하면서 seed·변경·상충·가장 늦은 확인된 사건을 보존한다. 단순 시간순 앞부분 절단을 하지 않고 생략 건수·연결 누락·범위를 함께 반환한다.

LLM 입력은 untrusted evidence이며 메일 본문의 지시를 작업 명령으로 취급하지 않는다. 숫자·날짜·결정 표현은 인용 근거에 연결하고, context 부족이면 도구로 추가 페이지를 요청하거나 미확인을 답한다.

검색 cursor는 query/filter/index revision에 결속한다. 색인이 바뀌면 `결과가 갱신되었습니다`로 새 검색을 제시하고 중복/누락된 페이지를 정상 페이지인 것처럼 이어 붙이지 않는다.

### 하이브리드와 필터

FTS는 persistent index를 유지한다. `bm25()`의 낮은 값이 더 좋은 순위라는 규약을 lexical rank로 변환하고 cosine과 점수 자체를 더하지 않는다.

초기 lexical 가중치 후보는 subject=3, from=2, to/cc=1, bodyNew/unknown=1, quote=0.2, signature=0.1, attachmentNames=2이다. 이는 다른 제품 상수를 복사한 확정 최적값이 아니며, S0에서 가중치 없는 기준과 비교하고 선택 결과를 profile revision에 남긴다.

양쪽 분기에서 scope를 먼저 적용하고 각 100 candidate를 조회한 뒤, mail/version별 최고 chunk를 대표로 삼아 중복 rank 투표를 없앤다. 양쪽 rank에 `Σ1/(60+rank)`를 적용하고 동률은 안정적인 내부 ID로 정렬한다.

정확 문서번호·인용구가 사용자 hard constraint이면 양쪽 결과를 해당 조건에 맞는 집합으로 제한한다. 자연어의 일반 단어는 lexical AND와 semantic soft query로 처리하고, 명시 날짜/사람/폴더와 혼동하지 않는다.

FTS 0건이면 hybrid의 같은 범위 semantic 결과를 별도 이유와 함께 반환한다. lexical-only 요청은 자동 API 요청으로 바꾸지 않으며, vector 후보가 있다는 이유만으로 “근거 충분”을 표시하지 않는다.

### 시간과 질의 처리

기본 `관련도`는 나이 감쇠 1.0이다. `최신순`은 사용자 선택 정렬이고, “최종 승인”은 모든 최신 메일에 점수를 더하는 문제가 아니라 확인된 승인/변경 근거를 시간순으로 비교하는 문제로 처리한다.

첫 기준은 사용자가 입력한 query 한 개만 FTS5와 vector 검색에 보낸다. LLM 질의 재작성·동의어 확장·reranker는 실행하지 않아 호출 수·대기 시간·검색 설명을 단순화한다. 질문이 여러 하위 쟁점을 담으면 답변 도구가 근거 부족을 표시하고, 사용자가 질문을 좁히거나 추가 검색을 시작한다.

### Context 확장

상위 seed chunk의 앞뒤 1개를 **같은 version·같은 본문 variant·같은 scope**에서 확장한다. 6 seed면 최대 18 chunk이며 겹치는 span을 합친 뒤 §14의 24메일·64 KiB context cap을 적용한다.

스레드 앞뒤 확장과 이웃 chunk 확장은 별도 단계다. 중복 인용을 접어 확보한 예산은 누락 부모·상충 조건·최종 확인된 이벤트에 배정하며 오래된 최초 요청을 일괄 버리지 않는다.

인용은 실제 snapshot의 연속 범위를 가리킨다. optional embedding metadata를 본문 인용 offset으로 취급하거나 사후 의미 유사도만으로 답변 문장에 출처를 자동 조작하지 않는다.

### 임베딩 계약

```ts
type EmbeddingProfile =
  | { kind: 'local'; modelPackId: string; fingerprint: string }
  | { kind: 'api'; endpointId: string; modelId: string;
      modelRevision: string; credentialRef?: string; fingerprint: string }

interface EmbeddingPort {
  embed(input: {
    generationId: string; purpose: 'document' | 'query';
    texts: readonly string[]; signal: AbortSignal
  }): Promise<{ fingerprint: string; vectors: readonly Float32Array[] }>
}
```

fingerprint는 모델 파일/서비스 revision·차원·tokenizer·pooling·query/document prefix·정규화·chunker 버전을 포함한다. 같은 모델명이라도 이 값이 다르면 새 generation이며 기존 vector와 혼합하지 않는다.

로컬 모델 팩은 manifest·ONNX 파일·tokenizer.json·tokenizer_config.json·해시·라이선스·golden input을 포함한다. 자동 인터넷 다운로드 없이 사용자 선택 디렉터리에서 검증·등록하며 모델 계약보다 긴 입력은 모델 규약에 맞춰 chunk한다.

API는 배포 adapter가 endpoint의 request/response/auth를 `EmbeddingPort`로 맞춘다. 응답은 입력별 index·개수·차원·유한수·nonzero norm·fingerprint를 검사하고, query와 document 용도 차이를 누락하지 않는다.

vector 저장·검색의 첫 기준은 `canonical float32 BLOB + worker exact cosine scan` 한 가지다. 스캔 전에 archive scope를 적용하고 결과는 chunk ID와 거리로 반환한다. 전역 검색 후 필터링이나 모델이 만든 SQL·ID 목록은 허용하지 않는다. 벡터는 archive DB에 저장하고 원문 chunk ID·generation·dimension을 함께 검증한다.

별도 vector extension, ANN, 차원별 virtual table, 파생 인덱스 쓰기/복구 경로는 첫 기준에서 제외한다. sqlite-vec는 pre-v1이며 breaking changes를 예고하므로 경량 기준에 넣지 않는다. exact scan이 기준 PC에서 사용자 체감 목표를 넘을 때만 같은 vector·scope로 대체 엔진을 재설계한다. 모델/tokenizer/prompt/chunker 변경은 재임베딩이며 엔진 변경은 같은 vector의 재색인이라는 구분은 유지한다.

### 임베딩 프로필 후보

| 경로 | 첫 기준 후보 | S0에서 닫을 내용 |
|---|---|---|
| 로컬 | `intfloat/multilingual-e5-small`, 384d; `@huggingface/transformers` 로컬 ONNX/WASM 실행 | 고정 revision·tokenizer·prefix·pooling·normalization, 로컬 파일 전용 실행, WASM 포함 설치본 크기·Windows CPU RSS/p95, golden vector와 양자화 팩 비교 |
| API | 사용자가 지정한 사내 embedding endpoint를 단일 adapter로 연결. 요약 AI 연결·자격증명과 별도 | request/response schema·model revision·dimension·auth secret ref·token/byte 제한·timeout/retry·실제 endpoint 지원 여부 |

한 보관함은 임베딩 프로필 하나를 활성화한다. profile 변경 시 설정 화면에서 재색인 대상 메일 수·예상 저장 공간·검색 제한을 알리고, 새 generation 준비 후 전환한다. 로컬/원격 자동 대체는 하지 않는다. API dimension은 endpoint 계약에서 얻고 finite/nonzero·개수·index 순서를 저장 전 검사한다.

E5 실행은 query에 `query: `, 메일 chunk에 `passage: `를 붙이고 attention-mask average pooling과 L2 normalization을 적용한다. 입력 512 token을 넘으면 silent truncation 대신 chunking 규칙으로 나눈다. 양자화 pack은 기준 모델 golden vector의 허용 오차·검색 순위 회귀를 통과하고, 파일 hash·모델 출처·라이선스를 manifest에 고정한 뒤 설치 선택지에 노출한다.

### IPC·도구·출처 계약

`app/src/shared/mail-archive.ts`를 DTO·오류 code·enum의 SSOT로 둔다. Renderer의 원본 파일 경로·DB path·API credential은 입력 스키마에 없고 모든 source/attachment/evidence ID는 service에서 재검증한다.

| 표면 | 제안 계약 | 결과/오류 |
|---|---|---|
| 관리 IPC | `orca:archive:pick-source`, `sources`, `start-import`, `cancel-job`, `retry-job`, `relink-source`, `remove-source` | typed source/job summary, 원본 경로는 main 소유 |
| 조회 IPC | `search`, `get-mail`, `get-thread`, `resolve-evidence`, `export-attachment` (모두 `orca:archive:` prefix) | paged DTO, 스냅샷·coverage·scope, export는 선택 행에서만 |
| 설정/범위 IPC | `profiles`, `configure-profile`, `rebuild-embeddings`, `set-session-scope` | secret 입력은 저장 후 ref로 치환; scope는 UI가 지정 |
| event | `orca:archive:event` | sequence/jobId/sourceId/revision을 가진 delta; 다시 열 때 snapshot부터 복구 |
| `archive_search` | query/filter/cursor → 검색 후보·일치 이유 | trusted session scope 필수, model filter는 좁히기만 가능 |
| `archive_thread` / `archive_get` | threadId 또는 mailId/versionId → 확인된 관계·문단 | 읽기 도구, bounded output와 nextCursor |
| `archive_context` | question/seed IDs → bounded context·evidence manifest | evidence persist 성공 후 반환; 근거 없으면 insufficiency |
| `archive_getAttachment` | occurrenceId/attachmentId → Temp 파일 | `readOnlyHint: false`, 기존 tool 승인; 자동 실행·첨부 분석 없음 |

위 도구의 서버 ID는 `orca_mail_archive`를 제안한다. 조회 도구는 `readOnlyHint: true`로 선언하고 evidence 저장은 읽기 결과의 로컬 이력 bookkeeping에 한정한다.

tool은 `context.waitForSession(signal)`으로 세션을 얻어 main의 scope resolver를 호출한다. 새 필드를 모델 입력의 sessionId로 추가하거나 cwd를 메일 접근권한으로 대체하지 않는다.

보관함 화면의 browse scope는 검증된 Renderer/webContents에 귀속하고, 채팅 scope는 실제 session에 귀속하는 구분 union이다. UI는 필터를 변경할 수 있지만 `이 범위로 질문` 시 main이 해당 범위를 session snapshot으로 복사하며, tool 인자는 그 snapshot을 넓힐 수 없다.

UI의 `set-session-scope`는 실제 세션 존재와 호출 창의 소유 관계를 검사한다. session 삭제·창 종료 시 해당 transient browse scope/조회는 폐기하고, 영속 채팅 scope·evidence는 세션 삭제 정책에 따라 서비스 정리 포트로 제거한다.

출처는 `evidenceId→sessionId/runId/versionId/start/end`로 저장한 뒤 `jsonToolResult`의 content와 structuredContent에 동일하게 반환한다. 모델이 쓰는 `[1](#mail-evidence/<opaque-id>)`는 manifest에 존재하고 현재 세션에서 resolve되는 경우에만 내부 viewer 동작을 가진다.

도구 카드의 출처 목록은 모델 문장 생성과 별개로 manifest에서 만든다. 모델이 출처를 누락/위조한 답변에 `검증 완료` 표시를 하지 않으며, 본문은 보관된 텍스트를 React text로 출력한다.

오류는 `archive_empty`, `scope_required`, `out_of_scope`, `source_missing`, `source_changed`, `unsupported_item`, `index_changed`, `embedding_unavailable`, `auth_required`, `rate_limited`, `profile_error`, `cancelled`, `evidence_removed`, `storage_full`을 구분한다. 정상 결과 안의 degraded/warning과 실제 호출 실패(isError)를 구별한다.

### 강제 지점 전수

아래 자리는 **제안된 production 경로의 전수**다. 구현자가 파일을 나누거나 전달 edge를 추가하면 자리 목록을 재열거하고 설계와 차이를 기록해야 한다.

| EP / 자리 수 | 계약 SSOT | 누가·언제 강제하는 자리 | 연결 pair | 실패 의미 |
|---|---|---|---|---|
| EP-01 / 4 | shared DTO·UI reducer | a app 설정/페이지 슬롯; b preload invoke; c IPC parse/handler; d renderer 응답/event 적용 | VP-01·08·12·13·23 | 진입 불가, 잘못된 DTO, stale 결과 덮어쓰기 |
| EP-02 / 4 | job protocol | a main enqueue/cancel; b source/compute job 수신; c index batch commit; d restart journal 복구 | VP-01·07·09·13·23 | 취소 후 commit·누락 배치·복구 오류 |
| EP-03 / 4 | normalized version contract | a EML mapper; b PST mapper; c identity/version transaction; d 본문 segment read | VP-02·14·18 | 정보 손실·충돌 덮어쓰기·잘못된 offset |
| EP-04 / 3 | relation/context rules | a header/PST 근거 매핑; b edge resolver 저장; c thread/context 확장 | VP-02·05·10·14·20 | 추정 병합·누락·무한 순환 |
| EP-05 / 4 | query plan | a UI/tool 입력 정규화; b SQL lexical; c vector candidate 조회; d fusion/page 작성 | VP-03·14·19 | 단어 누락·범위 후보 손실·페이지 불안정 |
| EP-06 / 3 | attachment metadata only | a source normalize; b filename index write; c chunk/context projection | VP-03·18 | 첨부 본문이 검색/전송에 섞임 |
| EP-07 / 5 | EmbeddingPort·fingerprint | a profile/model pack 검증; b document chunk 호출; c query 호출; d adapter 응답 검증; e vector write | VP-04·11·15·21 | query/doc 불일치·모델 혼합·손상 vector |
| EP-08 / 4 | generation state machine | a staging job 생성; b epoch 검사/결과 저장; c active pointer 전환; d query lease/GC | VP-04·07·11·15·21 | 중단 세대 활성화·late write·사용 중 삭제 |
| EP-09 / 5 | evidence contract | a context pack/offset; b evidence persist-before-return; c resolve handler; d streaming Markdown callback; e completed Markdown callback/viewer | VP-05·10·12·16·20·22 | 근거 없는 출처·다른 버전 문단·클릭 단절 |
| EP-10 / 8 | scope resolver/predicate | a UI scope→main 설정; b tool trusted session→scope; c lexical SQL; d vector 검색; e thread/context 확장; f mail get; g evidence resolve; h attachment export | VP-06·12·16·19·22 | 범위 밖 메일 또는 출처/파일 노출 |
| EP-11 / 4 | export capability | a 사용자 UI 선택/tool 승인; b occurrence scope; c 원본 revision/바이트 확인; d Temp staging/rename | VP-06 | 다른 첨부·바뀐 원본·허용 외 쓰기 |
| EP-12 / 3 | runtime descriptor | a bootstrap 등록/해제; b harness factory/context forwarding; c MCP 결과·권한 policy | VP-06·08·10·16 | 도구 미노출·세션 누락·빈 성공·승인 우회 |
| EP-13 / 3 | revoke epoch/purge | a main in-flight abort; b worker revoke+삭제 transaction; c 응답 반환 직전 revision 검증 | VP-07·09·22 | 제거 후 데이터 부활·늦은 근거 반환 |
| EP-14 / 3 | packaging/reuse contract | a shared MIME 호출; b builder 산출물 내용; c 설치본 child/native entry 실행 | VP-08·17 | POP3 변경·fixture 유출·설치본만 실패 |
| EP-15 / 4 | archive body-selection | a archive PostalMime 옵션; b body-selection 후보 평가; c HTML/charset quality projection; d 품질 DTO→UI/context 분기 | VP-01·VP-03·VP-08·VP-13·VP-17·VP-18 | nested 첨부 sentinel·alternative 중복·정상 영어·suspect 처리. 첨부 혼입/정상 본문 유실 |
| EP-16 / 4 | segment/provenance contract | a segment 분류; b version/variant/chunk provenance transaction; c scope-aware quote fold; d viewer 선택·펼침 | VP-02·VP-05·VP-12·VP-14·VP-16·VP-18·VP-20 | 원문 재결합·변경 숫자·부모 밖 scope·source 클릭. 출처 혼동/본문 손실 |
| EP-17 / 3 | embedding input contract | a 모델 prompt/token budget renderer; b chunk ID·embedding key 생성; c 저장/전송 projection | VP-03·VP-04·VP-10·VP-14·VP-15·VP-20·VP-21 | 필수 prefix·input hash·연속 span·whitelist. 모델 혼합/메타 노이즈/허위 인용 |
| EP-18 / 4 | retrieval policy | a hard/soft query compiler; b 필터된 rank·RRF; c neighbor/context pack; d 결과 이유/정렬 UI | VP-03·VP-05·VP-10·VP-13·VP-16·VP-19·VP-20·VP-23 | exact ID·old decision·주변 문단·0건 이유. 몰래 범위완화/중복 투표 |
| EP-19 / 4 | cache epoch/scheduler | a cache key/get; b scheduler·subscriber 취소; c epoch 검증 후 cache put; d scope/profile/remove/session 정리 | VP-04·VP-06·VP-07·VP-09·VP-11·VP-12·VP-15·VP-21·VP-22·VP-23 | 두 subscriber·credential 변경·late reply. 취소 전파/삭제 자료 부활 |
| EP-20 / 3 | scoped exact vector scan | a dimension/fingerprint validation on write; b filter-first BLOB scan and cosine ranking; c generation swap·삭제·재시작 | VP-04·VP-06·VP-07·VP-08·VP-09·VP-11·VP-14·VP-17·VP-21·VP-22 | reference cosine·scope·dimension mismatch·reopen. 잘못된 결과/범위 유출 |
| EP-21 / 9 | D-012 worker boundary·source revision protocol | a main이 DB 경로로 index utility process 시작; b index가 migration/DB를 열고 ready 회신; c main이 picker capability로 확인한 파일만 source worker에 전달; d source worker가 시작 fingerprint·reader를 실행; e 최대 25개 DTO batch를 보내고 ack까지 대기; f main이 jobId/epoch를 확인해 batch 전달; g index가 epoch 확인 후 transaction commit·ack; h source 완료 fingerprint와 index revision verify를 대조; i cancel/exit/shutdown이 epoch를 폐기하고 늦은 batch·revision 승격을 거절 | VP-01·VP-07·VP-09·VP-13·VP-14·VP-17·VP-23·VP-24·VP-25 | main event loop 정체·무한 큐·취소 후 commit·stale revision 활성화·잘못된 counter |

동일 필터는 `scope.ts`가 SQL 조건·in-memory predicate를 생성하도록 하고 각 경로의 결과 집합을 같은 fixture로 비교한다. EP-10의 다양한 경로에서 조건문을 독립 복제하지 않는다.

첨부 본문 제외에는 EP-15a의 옵션 제거 mutation **M-NESTED**를 등록하고 sentinel payload 검사에서 실패해야 한다. cache 참조/invalidations와 scoped vector scan은 직접 행동 oracle로 검증하며 구조적 호출 횟수만으로 안전을 주장하지 않는다.

M-SCOPE의 전수 범위에는 새 EP-16c(quote fold), EP-18c(neighbor 확장), EP-19a/c(cache key·put), EP-20b(scope 적용 scan)가 추가된다. 각 자리에서 다른 scope의 자료가 섞이도록 결함을 심고 사용자 반환 집합·출처·cache 소유 상태로 검출한다.

## 11. 구현 설계

### 진행 단위

| 단계 | 결과 | 종료 조건 / 이 계획 AC |
|---|---|---|
| S0 — S2·S3 실증·결정 | 임베딩/API 후보와 기준 PC 보고서, 후속 신규 의존성·정확 버전 | D-015~D-016 closed, D-024 실현 가능성 확인 후 S2/S3 READY로 승격 |
| S1 — 보관·정확검색 (이번 라운드) | 자료원 UI, EML/PST reader, EML 폴더 배치, worker DB, 메타데이터/본문/파일명 검색·열람·선택 추출 | AC1~7·9·17·19~23의 S1 pair; 의미검색 미설정 상태가 정상 동작 |
| S2 — 두 임베딩 경로 | 로컬/API 프로필, chunk/vector, generation, hybrid UI | AC8·10~12·19·20·24 관련 pair; 두 구현체 모두 동작 |
| S3 — 이력 답변·근거 UX | scope, context 도구, 기존 두 AI 경로, source card/인용 viewer | AC13~16·18·21~24, 나머지 유효 pair와 운영 gate 전부 |

S1~S3를 별도 구현 PR로 나누되 동일 유효 V의 단계 완료와 전체 완료를 구별한다. 이번 PR은 S1만 다루며 S2·S3는 구현 완료로 보고하지 않는다.

| S0 결정 | 수행할 실증 | 선택 조건 / 실패 시 대안 |
|---|---|---|
| D-014 PST 후보 | `pst-extractor@1.12.0`을 별도 승인된 spike 환경에서 ANSI/Unicode·한국어·HTML/RTF·폴더·첨부·손상 fixture로 검증 | 원문/관계/첨부 field golden 비교, 해제·취소·메모리 확인. 실패 시 libpff sidecar의 Windows 배포·라이선스 비교 후 결정 |
| D-014·15 로컬 후보 | `@huggingface/transformers`의 local ONNX/WASM과 multilingual-e5-small 384d 팩 한 개만 검증 | 기준 모델 golden vectors·검색 회수율·설치본 크기·CPU/RSS·라이선스·오프라인 실행. 추가 모델/런타임은 첫 기준에서 보류 |
| D-015 API 후보 | 사용 가능한 endpoint의 request/response 예제, auth, model/revision, max input/batch, query/document 처리 확인 | 실제 한 배치/한 질의/401/취소 실증. 이 규약을 §15 adapter 예제와 고정 contract test로 반영 |
| D-016 성능 | 대표 PC 사양·자료량·본문 길이/언어 분포를 기록하고 실제 자료량과 1만 메일에서 §14 측정. 실제 archive가 1만을 넘으면 5만을 추가 | 제품 SLA 새로 확정하지 않고 예산 조정 근거 보고. exact cosine이 느리면 ANN 선택은 후속 결정으로 분리 |

### S1 revision·worker 사용자 관측

같은 PST를 다시 추가하면 보관 중인 자료원으로 인식한다. 원본 전체 fingerprint가 바뀌지 않으면 다시 파싱하지 않고 기존 메일 수를 `이미 보관`으로 보고한다. fingerprint가 바뀌면 `새 revision 확인 중` 상태에서 기존 결과를 계속 검색할 수 있게 하고, source child가 파일 처음과 끝의 SHA-256 일치를 확인한 뒤 index child가 새 revision을 활성화한다. 그 과정에서 기존 identity는 skip, 새 identity는 추가, 같은 Message-ID의 바뀐 payload는 별도 결과로 보존한다.

취소 전 확정된 EML 파일은 유지한다. PST는 한 파일이 하나의 revision이므로 취소·원본 변경·child 오류 중 새 staging 결과를 검색하지 않고 기존 검증 revision을 유지한다. 결과 요약은 `새로 저장 n개 · 이미 보관 n개 · 실패 n개`를 함께 보여준다. `서버 이전` 같은 2자 검색어가 포함되면 모든 공백 term을 각각 LIKE 조회하고 term 간 AND를 적용한다. `%`와 `_`는 literal로 escape해 검색한다.

패키지 설치나 사내 자료의 저장소 반입은 이 문서 PR에서 수행하지 않는다. 실메일 대신 합성 fixture를 커밋하고, 실환경 검증 결과에는 메일 본문·주소·자격증명을 남기지 않는다.

S1에는 MIME 선택·품질 표시·가역 segment·필드 검색, S2에는 선택한 로컬/API profile과 cache·generation 전환, S3에는 quote fold·주변 context·결과 이유·출처 UX를 배치한다. 전 단계를 통과하기 전 전체 기능 완료로 보고하지 않는다.

### 파일·seam

아래 경로는 별도 표기가 없으면 신규 제안이다. 현존 파일과 아직 없는 파일을 링크 존재 검사에서 혼동하지 않는다.

| 경로 | 책임 / 변경 | 테스트 seam |
|---|---|---|
| `app/src/shared/mail-archive.ts` | DTO·에러·IPC shape | zod 입력 경계·타입 예제 |
| `main/features/plugins/mail-archive/{normalize,identity,segments,relations,query,ranking,context,scope,embedding-profile,job-state}.ts` | Electron/DB/native를 import하지 않는 순수 계산 | UT fixture/경합 상태 전이 |
| `main/features/plugins/mail-archive/{service,ipc,tools}.ts` | 주입 포트·scope·등록·취소 오케스트레이션 | 실제 IPC/tool handler IT |
| `main/features/plugins/mail-archive/{store,migrations/*,index-worker}.ts` | archive DB single writer·조회·jobs/evidence | 실제 SQLite rollback·migration·snapshot |
| `main/features/plugins/mail-archive/readers/{eml,pst,source-worker}.ts` | source utility process entry·원본 reader·시작/완료 fingerprint·메타데이터·추출 | ReaderPort fixture·bounded batch·cancel/kill/restart |
| `main/features/plugins/mail-archive/worker-protocol.ts` | source/index child RPC·jobId/epoch·bounded batch/ack DTO | fake process boundary test·stale epoch 거절 |
| `main/features/plugins/mail-archive/embedding/{local,api,embedding-worker}.ts` | local inference·transport adapter·vector scan | golden/model mock·API contract |
| `main/features/plugins/mail-content.ts` | 기존 MIME/inline 판정 공통부 추출 후보 | 기존 EUC-KR·첨부 분류 그대로 실행 |
| `main/contracts/mail-archive.ts` | composition이 주입할 scope/session/network/secret 포트 | feature 간 import 없이 fake 주입 |
| `main/app/bootstrap.ts`, preload archive API | 초기화·shutdown·registry·IPC 배선 | 실제 composition harness |
| `renderer/src/features/mail-archive/*`, `pages/MailArchivePage.tsx` | settings slot·자료원·검색·메일·근거 viewer | reducer + UI interactions |
| `renderer/src/app/SidebarUserButton.tsx`와 router/chat 조립부 | settings/page/chat 슬롯·scope 전달 | production component wiring |
| 기존 SettingsModal·RightPanel·StreamingMarkdown·shared Markdown | 도메인 중립 slot/callback·포커스 복귀 | 두 Markdown 경로 + 다중 세션 |
| `shared/app-error.ts`, `shared/i18n/ko.ts` | 설정 목적지·한국어 라벨 | 오류→올바른 탭 도달 |
| `app/electron.vite.config.ts`, `electron-builder.yml`, `package.json`/lock | 승인 후 child entry·native 패키징·fixture 제외 | 설치 산출물 내용·Windows smoke |

표의 `main/`, `renderer/`, `shared/` 상대 경로는 `app/src/` 기준이다. 실제 event·router·preload 등록 파일은 구현 착수 시 `rg`로 전수 재확인하고 §10 자리에 매핑한다.

## 12. End-to-end 영향

가져오기는 `OS 선택 → main capability → source utility process(start hash/parse/end hash) → normalized batch(최대 25) → main job/epoch check → index utility process transaction/ack → revision verify → event/search`다. source/index worker는 `utilityProcess.fork`로 기동하고 electron-vite `?modulePath`를 사용한다. raw path는 main picker capability 검증 뒤 source child에만 보내며, renderer와 로그에 나오지 않는다. 화면은 committed snapshot을 정본으로 삼고 worker event는 같은 jobId의 progress만 반영한다.

질문은 `사용자 범위 선택 → main session scope → 기존 harness → archive_context → evidence 저장 → tool result → 답변/카드 → citation callback → evidence resolve → viewer`이다. UI 출처 카드와 모델 출처 링크는 같은 evidence ID를 소비한다.

임베딩은 `worker가 chunk job 생성 → local worker 또는 main API broker → 응답 검증 → staging vector 저장 → corpus coverage 확인 → active 포인터 전환`이다. profile을 저장하는 것과 해당 모델 검색이 준비된 것을 같은 성공 상태로 표시하지 않는다.

### 등록과 기존 소비자

도구는 archive에 검색 가능한 메일이 처음 생길 때 등록하고 마지막 자료원이 제거되면 해제한다. 이미 실행 중인 harness의 도구 목록은 런타임 snapshot 정책을 따르며, 오래된 handler 호출은 `archive_empty`/`scope_required`로 안전하게 끝내고 다음 실행에서 목록을 갱신한다.

서버 객체/handler는 매 진행 이벤트마다 새로 만들지 않는다. 아카이브 초기화 실패는 해당 기능 unavailable로 표시하되 기존 POP3·artifact·일반 채팅 부팅은 유지한다.

| 기존 소비자 | 변경 영향 | 검증 |
|---|---|---|
| RuntimeToolRegistry와 harness snapshot/factory | 추가/해제·revision·기존 서버 identity | AC22, EP-12a~c |
| Claude runtime context와 policy | 세션 대기·취소 신호 전달, 쓰기 승인 유지 | AC17·18 |
| SettingsModalStore/AppErrorTarget/errorToastTarget | archive 탭 목적지·open 처리 | AC23 |
| app SidebarUserButton/router | 관리 슬롯·검색 페이지 배치 | AC1·23 |
| shared Markdown/StreamingMarkdown/RightPanel | generic callback·viewer 선택·return target | AC13·15·23 |
| POP3 MIME 호출부 | 공통 helper 이동 시 동작 불변 | AC22 |

기존 AI 경로가 도구 호출·세션 scope·출처 출력에 실제로 도달하는지는 AC18에서 둘 다 실증한다. 이름이 “사내서버”라는 이유만으로 임의 HTTP 규약을 새로 만들지 않는다.

## 13. Lifecycle / 오류 / 정리

### 작업·취소·복구

작업 상태는 `queued → scanning → importing → completed | partial | cancelled | failed`이며 재시작 복구는 `interrupted`이다. source health(`available/missing/changed`)와 embedding state(`not-configured/building/ready/degraded`)는 별도 축이다. main은 index utility process를 앱 수명 동안 유지하고 source utility process는 가져오기 작업 동안만 유지한다. 둘 다 Electron `utilityProcess.fork`로 실행하며 electron-vite `?modulePath` entry를 패키징한다.

main cancel은 해당 job epoch를 먼저 폐기하고 source worker에 취소를 보낸다. source worker는 25개 이내의 정규화 batch를 보내고 매 batch마다 index ack를 기다려 메모리 queue를 제한한다. index worker는 batch commit 직전 epoch를 확인한다. EML은 완료 파일 단위로 revision을 verify하고, PST는 시작/완료 full fingerprint가 같을 때만 새 revision을 verify한다. PST 취소·hash mismatch·child exit는 staging revision을 검색에서 제외하고 이전 검증 revision을 유지한다. worker가 응답하지 않으면 main은 해당 child를 종료하고 다음 조회는 기존 검증 데이터로 계속한다.

앱 종료는 신규 작업 차단→in-flight 취소→index RPC로 DB close→source/index child 정리 순서다. 강제 종료에서는 SQLite WAL 복구 뒤 staging revision을 interrupted로 남기고 마지막 verified revision만 검색한다.

### 세대·프로필 전환

profile 생성 → staging generation → 모든 대상 version의 성공/명시 제외 기록 → DB transaction으로 active 변경 순서다. API 401은 auth_required, 일시적 429/5xx는 제한 재시도, 형상 오류는 profile_error이며 기존 active를 파괴하지 않는다.

색인 중 추가 메일은 corpusRevision별 delta로 처리한다. generation 전환 transaction은 대상 revision 커버리지를 확인하고 이후 revision 메일은 의미검색 준비율에서 제외한다; 키워드 검색은 계속 가능하다.

검색 시작 시 generation lease를 잡아 query embedding·vector 검색·결과 구성까지 같은 fingerprint를 쓴다. 구세대는 lease가 끝난 뒤 GC하며, 프로필 자격증명 교체가 기존 세대의 읽기/질의에 필요한 credential ref를 먼저 삭제하지 않는다.

### 다중 저장소 쓰기·삭제 경합

| 작업 / 쓰기 순서 | 중간 실패·크래시 때 관측 | 수습 / 허용하지 않는 조합 |
|---|---|---|
| secret vault 새 ref → profile DB transaction → 이전 ref 정리 | DB 실패 시 새 secret 고아, 이전 profile 정상 | 고아 ref 정리; DB가 없는 secret을 가리키는 활성 profile 금지 |
| API/로컬 계산 → staging vector DB → active pointer DB | 계산 후 죽으면 재계산 가능, active는 이전 세대 | idempotent chunk key, 사용량 중복 가능 기록; 자동 무한 재전송 금지 |
| 원본 hash→parse→revision 검증→index commit | 원본이 바뀌면 새 revision 실패/비활성 | stat만 같아 통과 금지; 이전 검증 snapshot 유지 |
| 임시 추출 stage → revision 확인 → final rename | stage 잔류 또는 응답 전 성공 파일 존재 | stage만 정리, export receipt로 파일 결과 조회; 사용자 파일을 rollback으로 삭제하지 않음 |
| evidence DB commit → tool result → 채팅 저장 | 답변 저장 실패 시 고아 evidence 가능 | 본문 버전 참조 유지/정리; 미저장 evidence ID 반환 금지 |
| remove 요청→main revoke/abort→DB occurrence/payload purge→완료 event | 중단 시 source 상태 removing, 읽기 거절 | 재시작 purge 재개, source epoch 다른 늦은 결과 폐기 |
| plan 상태 → handoff INDEX 상태 | 서로 다르면 다음 주체 오판 | 문서 같은 커밋·G-DOC 교차검사 |

source 제거는 그 occurrence만 지우고 다른 자료원에서 같은 version을 참조하면 보존한다. 마지막 occurrence가 제거되면 텍스트·FTS·vector·관련 evidence payload를 지우고 evidence ID에는 내용 없는 tombstone만 남긴다.

범위·출처·추출의 응답 직전에 source revision/revoke를 다시 검사한다. 이미 전달된 도구 텍스트와 채팅 답변의 복사본은 소급 회수할 수 없으므로 제거 확인에 “이전 대화 내용은 남습니다”를 표시하고, 열려 있는 근거 뷰어는 제거 상태로 전환한다.

### 임베딩 캐시와 작업 스케줄링

query embedding cache는 프로세스 메모리에만 두고 TTL 15분, LRU 최대 256 entry를 초기 예산으로 둔다. key는 profile fingerprint·purpose=query·최종 query bytes hash·session/scope revision·credential epoch이며 원문 query를 로그에 남기지 않는다.

동일 key의 동시 요청은 계산을 공유하되 취소는 subscriber별로 처리한다. subscriber가 모두 사라지면 underlying 요청을 abort하고, 실패/401/timeout 응답은 성공 캐시에 넣지 않는다.

profile/generation 전환·scope 변경·source 제거·session 삭제는 관련 epoch를 올리고 entry·in-flight를 무효화한다. 응답 직전 epoch를 재검사하므로 늦은 API 응답이 캐시나 삭제된 vector를 되살리지 못한다.

document embedding 재사용은 canonical vector와 참조 chunk 관계를 저장한다. 마지막 chunk 참조 제거 때 vector와 cache를 함께 정리하며, 출처가 다른 메일의 존재/삭제는 각 occurrence/version이 결정한다.

로컬 embedding worker는 query 우선 큐를 두고 문서 microbatch 사이에 양보한다. 실행 중인 모델 추론을 즉시 선점할 수 있다고 가정하지 않으며 문서 microbatch 초기 상한 8, 실제 취소 응답·query p95로 크기를 조정한다.

API batching 상한 32와 동시 요청 2를 적용한다. query cache miss와 문서 색인이 경쟁할 때 다음 사용 가능한 slot을 query에 배정한다. 질의 임베딩은 단일 query×최대 1요청×최대 3시도=3요청/질문이며 문서 색인 요청량과 구분한다.

## 14. 성능 / 상한 / 최적화

아래는 **S0에서 확인할 초기 엔지니어링 예산**이며 확정 성능 SLA가 아니다. 런타임 상한은 `limits.ts` 한 곳과 관련 DTO validator에서 공유한다.

| 항목 | 초기 제안 / 단위 | 초과 시 동작 |
|---|---|---|
| EML 입력·PST 단일 항목 해제 크기 | 각 50 MiB / 64 MiB | 해당 항목 제외 이유; PST library의 사전 제한 가능성은 S0 검증 |
| import 배치 | 100 메일 또는 serialized DTO 4 MiB 중 먼저 도달 | 배치 commit 후 양보; 항목 하나의 본문 상한은 별도 검사 |
| 정규화 본문 snapshot·대체 표현 | 중복 제거 후 전체 합 2 MiB UTF-8 / 메일 | 조용히 자르지 않고 oversized 상태·재처리 안내 |
| main↔worker 큐 | 배치 2개 in-flight, 진행 event 초당 최대 4회 | backpressure; 이벤트 드롭은 snapshot 재조회로 복구 |
| 작업 프로세스 | index 1, source 1, embedding 1 최대 동시 | source/embedding lazy start·유휴 종료, 쿼리 우선 큐 |
| 검색 후보/페이지 | 분기당 100, 화면/도구 페이지 20메일 | cursor; 의미검색 후보 수를 전체 일치 건수로 표시하지 않음 |
| 관계 확장 | 100메일·edge depth 20 / run | 경계·잘림 표시, 다음 페이지 |
| context | 최대 24메일, 문단 최대 1,500 UTF-16 units, 전체 JSON UTF-8 64 KiB | 중요 근거부터 pack하고 생략 수 표시; 요청별 상한 낮춤 가능 |
| embedding batch | 최대 32텍스트·동시 API 2요청, 모델 token/byte 제한 중 더 작은 값 | 분할, 413은 배치 재계획; 텍스트 무음 절단 금지 |
| API | 요청 30초, 일시 오류 재시도 최대 2회, Retry-After 최대 대기 60초 | 이후 degraded/사용자 재시도; 401·스키마 오류 재시도 안 함 |
| vector 블록 | 16 MiB resident float buffer, dimension 1~4096 | block scan·차원 거절; 전체 vector를 main 메모리에 적재 안 함 |
| 실측 목표 | 대표 자료량과 1만 메일에서 p50/p95, 취소 ack 1초 목표, UI long task·peak RSS 기록; 실제 archive가 1만을 넘으면 5만 추가 | 실패 시 예산·worker 분할을 정정하고 ANN은 후속 설계로 분리 |

본문 24×1,500=36,000 UTF-16 units는 UTF-8 64 KiB보다 클 수 있으므로 **직렬화 바이트 cap을 마지막으로 적용**한다. 글자 수를 토큰 수라고 가정하지 않고, harness가 제공하는 컨텍스트 제한이 더 작으면 반환 예산을 낮춘다.

embedding 텍스트 수 C는 chunker가 결정한다. API 최악 문서 요청 수는 `ceil(C/B) × 3`(최초+재시도 2회), B는 profile 한도와 32 중 작은 값이며 질의 요청은 1회×최대 3시도로 별도 계산한다.

기준 E5-small 384차원 기준으로 1만 메일×평균 4chunk×4byte는 vector만 61,440,000byte(약 59 MiB), 5만 메일이면 307,200,000byte(약 293 MiB)다. SQLite·텍스트·FTS 비용은 별도이며 profile 전환 중 새 generation을 만들면 vector가 일시적으로 두 배까지 늘 수 있으므로 설정 UX에서 디스크 여유를 확인한다. API dimension은 계약에서 읽어 동일 식으로 계산한다.

exact cosine의 연산량은 후보 범위 chunk 수×차원이다. 로컬 모델/PC가 정해지지 않은 상태에서 검색 지연·GPU 필요 여부를 확정하지 않는다.

### 실증 계획과 선택 조건

수집 corpus는 합성/반입 허용 자료로 만들고 본문·주소를 PR 로그에 올리지 않는다. **기존 24 AC의 구현 검증**과 **후보 성능 비교**를 분리해, 벤치마크에서 좋다는 이유로 무결성 실패를 허용하지 않는다.

| 축 | 고정 입력 / 비교 | 관측 / 결정 |
|---|---|---|
| 전처리 | plain+HTML 중복, HTML-only, UTF-8/EUC-KR/CP949 alias, 잘못된 charset, 영어/코드, inline reply, 서명 유사 업무 조건, nested EML, 원본 없는 quote | 필드 golden·segment 재결합·sentinel 제외·quality flag; 중요한 수치/부정어 유실 0 |
| 검색 질의 | 고정 24개: 정확번호/주소·짧은 식별자·의미 유사·필터·경위/상충/오래된 결정·scope/무답 각 4 | 회귀용 기준 셋. 이 24개에 맞춰 ranking 파라미터를 튜닝하지 않고, 필요하면 별도 확장 평가를 추가 |
| retrieval | FTS5만 → E5-small + FTS5 → 같은 filter의 API profile; 모델·벡터 엔진 후보를 동시에 늘리지 않음 | mail Recall@10·MRR@10·thread/event coverage, 중복률·scope leak·무답 오탐 |
| context/답변 | 동일 retrieved IDs와 두 기존 요약 AI 경로 | 근거 문장 citation validity·claim faithfulness·승인/변경·모름 구분; LLM 자체 점수만으로 합격하지 않음 |
| vector | 동일 필터 exact scan의 정답 비교, actual/10k corpus (50k는 실제 자료량 초과 시) | top-k 기준 cosine·cold/warm p50/p95·RSS·DB 크기·삭제/복구 |
| cache/부하 | cold·동일query 반복·서로 다른 scope·색인 중 query·모델전환·API 지연·취소 | hit ratio·문서/질의 요청 수·native inference 지연·epoch 누락 0 |
| 배포 | Windows 설치본·사내 API·오프라인 로컬 모델 팩 | 실제 load→query→delete→restart; 미선택 모델 가중치는 설치본에 넣지 않음 |

품질 비교의 우선 조건은 **정확번호·scope·인용 무결성 회귀 0**, 다음은 스레드 사건 coverage와 p95다. 이 첫 기준에서는 후보 수를 늘리지 않는다. exact scan 또는 e5-small이 실제 자료와 PC에서 충분하지 않을 때 원인을 분리해 후속 plan 결정으로 올린다.

## 15. 외부 구현 포트 / 문서 계약

요약은 기존 AI provider/harness가 처리한다. 임베딩 provider는 `EmbeddingPort`를 구현하며 채팅 자격증명을 임의 재사용하지 않는다.

API adapter 등록은 배포 composition에서 주입하고 설정 UI는 등록된 endpoint와 모델을 선택한다. 임의 HTTP 주소에 비밀을 붙여 보내는 범용 URL 입력 기능은 첫 범위에 넣지 않는다.

S0 이후 구현 문서에는 실제 지원 adapter의 요청 예제·응답 순서·차원·revision·인증 secret ref·timeout·재시도 의미를 적는다. 로컬 팩도 입력 tensor 이름/type·padding·truncation·pooling·normalization·query/document prefix·해시를 명시한다.

**shape 검증**은 문서 예제를 실제 exported TypeScript 타입에 대입해 typecheck한다. **semantics 검증**은 성공·빈 입력·401·429·timeout·취소·차원 오류·index 뒤바뀜·모델 변경 응답을 동일 contract suite로 실행한다.

## 16. 기존 결정·규칙과의 관계

| 규칙 | 본문 반영 | 판정 |
|---|---|---|
| main 하향 DAG·feature 간 직접 import 금지 | §9 plugins 내부 공통부·contracts port·bootstrap 주입 | 유지 |
| renderer feature 교차 import 금지 | §9 app/pages 조립, settings/chat slot, shared generic callback | 유지 |
| 원격 요청 Chromium `infra/net` | §9·10 main API broker | 유지 |
| 자격증명 vault / 로컬 DB | §13 secret ref, DB 자체가 암호화됐다고 주장하지 않음 | 유지 |
| migration append-only | 신규 archive migration, 기존 core/mail migration 수정 없음 | 유지 |
| 새 패키지 사용자 승인 | D-014·S0; 이번 PR 설치 없음 | 유지 |
| UI 한국어·시맨틱 토큰·그룹 스코프 | §5·11, 두 테마·키보드 AC15·23 | 유지 |
| runtime tool MCP shape·readOnlyHint | §10 jsonToolResult·export false·trusted session | 유지 |
| 원본 비복제 제안 | 정규화 전체 본문과 파생 index는 저장, EML/PST/첨부 상시 복제 없음 | 의미 구체화(D-006) |
| 원격 계획을 무시하라는 사용자 요청 | main에서 새 Baseline V·작성자 Codex | 반영; 다른 계획의 승인 미승계 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화 / 선택 조건 |
|---|---|
| PST library가 실제 대형·특수 형식을 충분히 못 읽음 | ReaderPort 격리, golden fixture·실 PST 검증 선행, 손상 파일을 정상 완료로 표시하지 않음 |
| 한국어 업무 고유명사 검색 품질 | 정확 식별자 tier·짧은 토큰 fallback·한국어 질의셋, semantic 단독 평가 금지 |
| 원본 전체 hash I/O 비용 | parser skip과 별개 비용으로 표시, 한 번 검증한 revision 재사용; 정확성 요구를 stat로 대체하지 않음 |
| 첨부 bytes 미보관 | 원본 분실 시 추출 불가. 저장 본문·첨부 목록은 유지하고 UX에서 구분 |
| LLM의 허위 승인/최종결정 | context coverage·상충 fixture·statement citation 평가, 인용 유효성과 내용 충실성은 별도 측정 |
| exact scan의 규모 한계 | S0 latency 측정 후 ANN 필요성 결정, 저장 포트 분리 |
| 로컬 모델 런타임·WASM 배포 크기 | Windows 설치본 smoke·실 모델 추론·폐쇄망 모델 팩 절차 |
| 개인 자료 잔류 | 명시 제거 transaction·vector/evidence purge; 이전 채팅 내용 잔존을 정확히 안내 |

새 의존성 후보는 `pst-extractor`와 `@huggingface/transformers`다. [app 의존성 정책](../../../app/AGENTS.md)의 “TRD §2 Stack 표 밖의 패키지 추가는 사용자 승인 필수”에 따라 **선정·실제 추가는 D-014에서 승인 후** 진행한다; 이 문서는 채택 승인을 대신하지 않는다.

되돌리기 어려운 부분은 identity/version·source occurrence·evidence format이다. 최초 구현부터 schemaVersion·fingerprint·opaque ID를 두고, 모델 이름이나 원본 경로를 공개 식별자로 고정하지 않는다.

## 18. 영향 받는 파일 / 문서

이번 PR 산출물은 이 계획, [조사 검토](research-review.md), [handoff INDEX](../INDEX.md), [docs INDEX](../../INDEX.md)다. 설계 계약은 이 plan에 통합한다. 앱 코드·lockfile·현재 architecture 문서는 바꾸지 않는다.

향후 구현 변경은 §11 표를 따르며, 실제 동작이 생긴 시점에 `docs/IPC_CONTRACT.md`, `docs/arch/backend/persistence.md`, `docs/arch/backend/overview.md`, `docs/arch/frontend/{state,rendering,ux-domains}.md`를 현재 상태로 갱신한다. API adapter/로컬 모델 팩 운영 절차는 `docs/guides/`에 추가하고 generated inventory는 코드에서 생성한다.

## 19. 게이트 / 설계 검증 기록

| Gate | 대상과 명령/관측 | 이번 문서 PR 적용 |
|---|---|---|
| G-DOC | 링크·Decision/AC·node/pair/EP 자리수·plan/INDEX 상태 교차검사, app에서 `node scripts/check-doc-inventory.mjs --check`, `git diff --check` | 적용, 실행 결과 아래 기록 |
| G-MSG | 변경 파일 scope·main 기준 독립 브랜치·작성자·커밋 trailer 파싱·PR base 확인 | 적용 |
| G-STATIC | app 가이드의 lint/typecheck, migration append-only·경계 검사 | 구현 시 적용 |
| G-TEST | §7-A UT→IT→ST→AT, §10 선택 mutation, 실제 SQLite rollback·worker fault | 구현 시 적용 |
| G-PACK | Windows 설치 산출물·PST·로컬 모델·두 AI 경로 실기 | 구현 시 적용 |

DB 테스트는 `app/AGENTS.md`의 ABI 지침에 따라 필요한 시점에 실행한다. 문서만 바꾸는 이번 작업에서는 네이티브 ABI를 바꾸거나 앱 전체 테스트를 돌리지 않는다.

### V1 설계 검증 실행 기록 (2026-09-29)

문서 파서로 AC1~24 연속성, 23 pair의 왼쪽 노드 전부 연결, 14 EP 행의 57자리 표기와 pair의 자리수 일치, 본문 상대 링크 7개 존재를 확인했다. author=Codex, Baseline V 기준=none, 보드=plan/DRAFT·다음 Codex가 본문과 일치했다.

위 기록은 V1 커밋 당시 관측이며 현재 통합본의 문서 개수를 뜻하지 않는다.

app 디렉터리에서 `node scripts/check-doc-inventory.mjs --check`를 실행해 generated doc·prose·relative links 검사가 모두 통과했다. 처음 저장소 루트에서 실행한 명령은 cwd 의존 경로로 실패했으며, app에서 재실행한 결과를 채택했다.

의미 대조에서는 D-004↔AC10~12↔§10의 local/api union, D-005↔AC9·17↔EP-06·11, D-006↔AC4↔immutable version, D-011↔AC13·16·21↔EP-09·10·13의 동작을 각각 비교했다. §5의 취소/원본 소실/제거 상태는 §13의 저장·복구 순서와 일치하며, 외부 문서 열람·계획된 AT를 구현 PASS로 기록하지 않았다.

### 조사 보완·문서 통합 검증 기록

이 plan의 §3·5·7·7-A·9·10·13·14에 조사 보완을 통합했다. V1의 AC와 선택 mutation은 같은 stable ID에 보존하며, 두 개의 상충하는 pair/강제 지점 표를 두지 않는다.

문서 gate는 링크·앵커·표·UTF-8, Decision·AC·V/EP 보존, 작성자·유효 V·보드 상태 일치, 삭제한 별도 델타 파일의 잔여 참조, doc-inventory·diff·trailer 검사다. 모델 추론·PST 처리·검색 품질·성능의 실행 검증은 §14의 실증으로 남는다.

통합본 검증 결과: V1의 AC 24개와 조사 보완 oracle을 같은 AC 행에 보존했고, pair 23개(REQUIRED 16·REGRESSION 7)의 기존·추가 경로와 EP 연결이 유지됨을 비교했다. 강제 지점은 20행·79자리이며, Decision 23개와 구현자 기입란을 확인했다.

통합 plan·조사 검토의 상대 링크·앵커 11개, 표 38개의 열 수·UTF-8, plan/보드의 Codex·유효 V·DRAFT가 일치한다. 별도 델타 파일과 관련 참조는 제거했고, `node scripts/check-doc-inventory.mjs --check`(app)·`git diff --check`를 통과했다.

### 경량 기준 권고 갱신 (2026-09-29)

D-024를 OPEN으로 추가하고 FTS5 기본·선택 설치형 E5-small/API·SQLite BLOB exact scan·단일 질의 기준을 권고안으로 반영했다. Gemma/ANN/reranker 비교는 첫 기준에서 제외했으며, 사용자 선택 전 DRAFT와 V 재대조 필요 상태를 유지한다. plan 및 handoff 보드의 상대 링크·상태를 대조했고, app doc-inventory·`git diff --check`가 통과했다. 앱 코드·의존성은 수정하지 않았다.

### 경량 기준 선택 및 구현 진입 점검 (2026-09-29)

사용자가 “경량화 방향으로 선택”이라고 명시해 D-024를 ACTIVE로 확정했다. 기존 `features/plugins/mail`의 `postal-mime` 파서와 SQLite FTS5는 EML 정규화·키워드 검색의 재사용 후보로 확인했다. 이번 S1에서는 PST parser만 채택하고 임베딩 runtime·API 계약·성능 실증(D-015~D-016)은 후속 단계로 남긴다.

### ΔV3 — D-012 재확정·PST revision·다중 term 검색 (2026-09-29)

사용자가 “D 12 유지”를 선택해 worker 격리를 S1 필수 조건으로 확정했다. plan 본문에만 결정 D-026과 보강 규칙을 통합했다. sourceId는 형식/canonical path로 고정하고, 컨테이너 전체 fingerprint는 revision 검증에만 사용한다. 메일 identity는 Message-ID 또는 자료원 내 locator와 정규화 payload hash를 조합하며, 다른 본문 버전과 가능한 ID 없는 동일메일을 억지 병합하지 않는다. PST는 두 번의 full fingerprint가 일치해야 staging revision을 활성화한다.

AC3·AC5·AC7을 변경하고 신규 VP-24(utility process 경계·revision protocol), VP-25(identity·term 검색)를 REQUIRED로 등록했다. AR-06/IT-06·MD-07/UT-07과 EP-21의 아홉 강제 지점을 연결했다. 사용자 관측은 취소/원본 변경 시 기존 검색 결과 유지, 새로 저장/이미 보관/실패 카운터, 공백으로 나눈 모든 검색어의 AND 결과다. 검증 oracle은 PST 추가 revision 1개·변경 본문 1개 fixture, staging 취소/worker 종료 snapshot, `서버 이전`의 정확한 결과 ID 집합이다.

자기검토에서 plan·INDEX 메타/다음 actor·D-012 출처·24 AC 연속성·25 pair 왼쪽 노드·21 EP의 자리수 합계와 worker protocol 순서를 대조한다. READY 구현 gate는 UT→IT→ST→AT, migration append-only, 두 utility process 실제 왕복/kill-restart, 설치본 worker entry·PST smoke다. S2/S3 OPEN은 이번 READY 범위 밖으로 유지한다.

## READY self-review

- [x] 이번 대화의 사용자 요구와 Codex 제안을 분리하고, 원격 계획 승인·V를 상속하지 않았다.
- [x] Product/UX, AS-IS→TO-BE, 24 AC, R/SD/AR/MD의 pair와 자리별 강제 지점·직접 oracle을 작성했다.
- [x] 범위·인용·취소·원본 변경·자료원 제거·임베딩 전환을 producer와 consumer 양쪽에서 정의했다.
- [x] 로컬/API 임베딩 둘 다 완료 범위에 남겼고, 첨부 본문 검색은 제외했다.
- [x] D-014 S1 PST parser 후보(`pst-extractor@1.12.0`)와 지연 로드 경계를 확정.
- [ ] D-015 최초 로컬 모델 팩·실제 API 계약/인증/모델 revision 확정 및 검증.
- [ ] D-016 대표 PC/자료로 예산 검증·필요 설계 정정.
- [x] D-024 경량 첫 기준을 사용자가 명시적으로 선택.
- [x] D-025 S1을 PST·EML 검색과 EML 파일/폴더 배치 입력으로 고정.
- [x] D-012를 사용자가 재확정했고, D-026 자료원·메일 identity 정책을 S1에 반영.
- [x] ΔV3에서 AC3·AC5·AC7의 관측 조건과 VP-24·VP-25, EP-21 worker 경로를 연결.
- [x] D-015·D-016과 S2/S3를 OPEN/후속으로 분리.
- [x] plan/INDEX를 S1 구현용 READY·Codex 구현 차례로 동기화.

**초기 판정은 이력으로 보존한다. ΔV3 판정: S1 구현용 READY.** 사용자가 D-012 유지로 결정했고, stable sourceId·mail identity, revision 검증·취소 가시성, worker protocol, whitespace AND 검색을 규범 계약·pair·강제 지점에 연결해 기존 gap을 닫았다. 사용자 화면에서는 중복/신규/실패 수를 구분한다.

---

## [구현자 기입] 설계 리뷰

- 판정: D-012를 유지해 source/index utility process 경계를 유지했다. r1.3에는 선택 본문·대체 표현·품질 신호를 정규화/저장/상세 DTO/UI에 연결하고, HTML-only EML/PST와 충돌 표현을 테스트했다.
- S1 경량 범위는 EML/PST 메타데이터·본문·첨부 이름 검색이며 첨부 본문 색인·임베딩·hybrid 검색·RAG는 계속 제외한다. 첨부 선택 저장은 별도 사용자 동작으로만 처리하고 선택한 바이트 외에는 추출하지 않는다.
- 설계 대비 충돌 / PLAN_GAP: 없음. D-012·Decision·AC·V·§10의 규범 행은 수정하지 않았다. 기존 색인은 본문 형식 정보가 없으므로 `legacy`로 보존한다. 의미 context 경로는 S1에 없어 EP-15d의 context 분기는 후속이며, SQLite 저장 왕복은 현재 native binding 부재로 실행하지 못했다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

전수 명령: rg -n '^\| EP-' docs/handoff/0244-mail-archive/plan.md → EP-01~21, 21행·88자리. S1 대상 41자리 중 38자리를 구현했고 3자리는 후속/패키징 검증, S2/S3 47자리는 이번 범위 밖이다.

| §10 | 닫은 자리 | 이번 라운드 관측 | 남긴 자리 |
|---|---:|---|---|
| EP-01 / 4 | 4/4 a-d | bootstrap·preload·handler·renderer 배선, typecheck/build | UI/IPC 실제 왕복은 미실행 |
| EP-02 / 4 | 4/4 a-d | source/index worker·batch commit·재시작 staging 복구; service 테스트와 Electron smoke | 없음 |
| EP-03 / 4 | 3/4 a-c | EML/PST mapper, identity·revision transaction; reader/store 테스트 | d segment read는 S2/S3 |
| EP-04 / 3 | 3/3 a-c | Reply/References 명시 ID resolver, 누락·중복 후보·cycle 처리, bounded thread query/view; 역순·동일 제목 분리 store/resolver 테스트 | renderer 시각 실기와 S2/S3 context projection |
| EP-05 / 4 | 2/4 a-b | term 정규화·FTS/LIKE AND; 한글/짧은 토큰 테스트 | c vector·d hybrid fusion/page |
| EP-06 / 3 | 2/3 a-b | 첨부 manifest·filename index; 본문 sentinel 미색인 | c chunk/context projection |
| EP-07 / 5 | 0/5 | 임베딩 계약은 S2/S3 | a-e 전체 |
| EP-08 / 4 | 0/4 | generation 전환은 S2/S3 | a-d 전체 |
| EP-09 / 5 | 0/5 | citation/evidence는 S3 | a-e 전체 |
| EP-10 / 8 | 0/8 | scope resolver는 S3 | a-h 전체 |
| EP-11 / 4 | 4/4 a-d | 사용자 Save dialog→내부 occurrence 재확인→source fingerprint/첨부 manifest·크기 검증→같은 폴더 임시 파일·rename; EML 선택 추출·원본 보호·제거 경합 테스트, 공개 PST parser fixture에서 선택 바이트 크기 smoke | PST utilityProcess·설치본 추출 smoke; 도구 승인 경로는 S3 EP-12 |
| EP-12 / 3 | 0/3 | runtime tool descriptor는 S3 | a-c 전체 |
| EP-13 / 3 | 3/3 a-c | import epoch revoke·자료원 제거 transaction/purge·제거와 in-flight import/export 경합에서 late-write 차단; store/service 테스트 | 실제 UI/IPC 및 S3 context·cache 제거 경합은 AC21 후속 |
| EP-14 / 3 | 1/3 a | shared MIME 경로 보존, worker bundle build | b fixture sentinel package 검사·c 설치본 child 실행 |
| EP-15 / 4 | 3/4 a-c | inert HTML 텍스트화·plain 우선/대체 저장·quality flags 및 선택 이유를 상세 DTO/UI에 연결; HTML/영어/식별자/크기 fixture | d semantic context 품질 분기(S1에는 context 경로 없음) |
| EP-16 / 4 | 0/4 | segment/provenance viewer는 후속 | a-d 전체 |
| EP-17 / 3 | 0/3 | embedding input은 S2/S3 | a-c 전체 |
| EP-18 / 4 | 0/4 | hybrid ranking/context는 S2/S3 | a-d 전체 |
| EP-19 / 4 | 0/4 | embedding cache/scheduler는 S2/S3 | a-d 전체 |
| EP-20 / 3 | 0/3 | vector scan/generation은 S2/S3 | a-c 전체 |
| EP-21 / 9 | 9/9 a-i | 실제 utility process import·skip·revision·cancel·restart·staging isolation; batch ACK 테스트 | 없음 |

검산: 구현 38 + S1 잔여 3 + S2/S3 47 = §10 전체 88자리. r1.3은 EP-15c와 d의 UI projection을 추가했다. EP-15d의 context branch, EP-14b/c package 검증은 남겼다. EP-01은 코드 배선이 닫혔으나 UI/IPC 실기가 남아 VP-01·VP-13은 SELF_BLOCKED다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 잔여 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_BLOCKED | EML batch/PST service·store 테스트, M-NESTED sentinel | OS picker·renderer 왕복 실기 |
| VP-02 | REQUIRED | SELF_BLOCKED | resolver·store의 역순/누락/ambiguous/cycle/동일 제목 분리 테스트와 thread viewer 구현 | 설치본 UI 실기와 S2 segment·provenance viewer |
| VP-03 | REQUIRED | SELF_PASS | FTS/LIKE·파일명 검색·AND 결과 집합 | vector/fusion은 후속 |
| VP-07 | REQUIRED | SELF_PASS | cancel·staging revoke·기존 revision 유지 | 대량 성능 측정은 AC19 pending |
| VP-08 | REGRESSION | SELF_BLOCKED | 기존 코드와 신규 빌드 컴파일 | M-WIRE·POP3 통합·패키지 회귀 미실행 |
| VP-09 | REGRESSION | SELF_PASS | PST reimport·worker restart·active snapshot; import 중 제거 시 revoke 후 삭제되고 export 중 제거는 export 완료 뒤 purge되는 service/store 테스트 | UI/IPC 및 S3 context·cache 경합은 AC21 pending |
| VP-13 | REQUIRED | SELF_BLOCKED | IPC schema/preload/handler typecheck | 실제 Electron IPC 왕복 미실행 |
| VP-14 | REQUIRED | SELF_BLOCKED | migration SQL은 Python SQLite로 실행·컬럼 확인, typecheck 및 store 테스트 추가 | native binding 부재로 신규 quality-field 저장/get/search roundtrip 미실행; process crash rollback도 미실행 |
| VP-17 | REGRESSION | SELF_BLOCKED | PST reader fixture·Vite worker bundle | M-PACK·설치본 smoke 미실행 |
| VP-18 | REQUIRED | SELF_PASS | EML/PST field·한글·attachment sentinel, HTML quality·대체 표현·plain/HTML mismatch fixture | charset 대표 golden·segment/provenance는 후속 |
| VP-19 | REQUIRED | SELF_PASS | 한글 short-token·whitespace AND·literal LIKE 테스트 | hybrid rank는 후속 |
| VP-23 | REGRESSION | SELF_BLOCKED | stale response sequence 방어 코드·typecheck | 역전 응답 UI 실기 미실행 |
| VP-24 | REQUIRED | SELF_PASS | production service→두 utility process→SQLite/search/cancel smoke; 새 첨부 export도 source utility worker를 사용 | 첨부 추출 worker의 actual PST smoke 및 IPC 왕복은 미실행 |
| VP-25 | REQUIRED | SELF_PASS | PST revision identity·ID-less locator·다중 term 검색 | 없음 |

자기확인 합계: SELF_PASS 7 · SELF_BLOCKED 7 = 14개 pair. 이는 구현자 자체 상태이며 독립 검증 PASS가 아니다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 선택 증거 / 자리 | red 관측 | 복구 관측 |
|---|---|---|
| M-NESTED · VP-01/03/18 · EP-15a | forceRfc822Attachments 제거 시 nested EML sentinel이 본문에 섞여 reader 테스트 실패 | 옵션 복원 후 sentinel 제외 |
| M-WORKER · VP-24 · EP-21e | batch ACK 대기를 제거하자 25건 전에 다음 배치까지 읽음(pulled=51) | ACK 대기 복원 후 상한 테스트 통과 |
| M-WIRE · VP-08 · EP-01a | 페이지 slot 제거 mutation 미실행: 실제 UI 경로 실기 없음 | BLOCKED |
| M-WIRE · VP-08 · EP-12a | runtime descriptor 제거 mutation 미실행: S3 tool composition 미구현 | BLOCKED |
| M-PACK · VP-17 · EP-14b | fixture sentinel package 검사 미실행: electron-builder가 egress EACCES로 중단 | BLOCKED |

분모 검산: 선택 증거 5자리(완료 2·BLOCKED 3) + 인용 변이 0 + 새 구조 oracle 0 = 표 5행. 두 red mutation은 복구 뒤 해당 직접 행동 테스트가 green이다.

## [구현자 기입] Product/UX 파생 검토

| 사용자 상황 | 판정 | 남은 확인 |
|---|---|---|
| 검색어를 입력하고 조회 | Enter와 검색 버튼 모두 제출, 진행/오류/빈 결과를 분리하고 stale 응답은 무시 | 실제 창에서 키보드·역전 응답 실기 |
| PST/EML 추가·재추가 | 진행 중 파일·메일과 새로 저장/이미 보관/실패 수를 표시; 변경 PST는 새 revision 상태로 설명 | OS picker·renderer IPC 실기 |
| 취소 | 최종 commit 중 취소를 막고 취소된 파일/이미 완료된 EML은 유지 | 화면 전환·앱 종료 경합 실기 |
| 대화 흐름 | 명시 Reply/References로 연결된 메일만 날짜순으로 보여 주고, 제목만 비슷한 메일은 합치지 않음; 최대 50개 잘림을 표시 | 넓은 창/좁은 창에서 관계 목록·선택 이동 시각 실기 |
| 자료원 제거 | native 확인창에 파일명·짧은 자료원 ID·고유/공유 메일 수·원본 보존을 알림; 제거 중인 가져오기는 취소하고 export가 끝날 때 purge; 같은 파일명도 ID로 식별 | OS 확인창/다중 자료원 중복 이름 실기 |
| 첨부 확인·저장 | 이름·MIME·크기만 검색·표시; 저장은 사용자가 고른 첨부만 원본 fingerprint/manifest 확인 뒤 임시 저장·rename, 원본 EML/PST 경로로는 저장 차단 | PST utilityProcess/설치본 smoke와 취소/오류 문구 실기 |
| 본문 해석 | 정상 plain 우선, HTML은 비실행 텍스트로 변환; 내용이 다르면 상세의 대체 본문 버튼과 처리 정보 제공. 의심/크기 초과는 이유를 문장으로 표시하고 본문을 조용히 자르지 않음 | 실제 창에서 대체 전환·좁은 폭·스크린리더 문구 확인; S2 semantic context 제외 연결 |
| 오류·개인정보 | 실패 파일명과 안정 오류 코드만 표시; 원본 전체 경로·fingerprint는 renderer에 보내지 않음; 원본 변경 시 파일을 생성하지 않고 재등록을 안내 | 실제 화면 문구/다중 창 실기 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| 문제 | 대응 | 관측 / 남은 점 |
|---|---|---|
| PST 전체 fingerprint는 메일 추가 때마다 변함 | fingerprint는 source revision에만 쓰고 canonical path 기반 sourceId·메일 payload identity는 유지 | service/store PST revision·Message-ID 변경·ID-less locator 테스트 |
| 같은 Message-ID라도 본문 수정 가능 | identity에 정규화 payload hash를 포함해 다른 내용으로 보존 | edited payload는 신규 identity, 기존 staging은 활성 검색에서 제외 |
| HTML display projection 변경이 PST 재가져오기에서 identity를 바꿀 수 있음 | 표시 본문은 block boundary를 보존하되 identity는 기존 HTML text projection을 별도로 유지; quality flag/대체 표현은 digest에서 제외 | 기존/신규 HTML projection key 동등성 UT 추가; DB 왕복 테스트는 native binding 복구 후 실행 |
| Message-ID 누락 메일을 과병합할 위험 | 같은 source locator와 payload가 모두 같을 때만 identity 재사용 | ID-less locator 테스트 |
| 처리 중 원본 변경·worker 취소 | 시작/완료 fingerprint 일치 시에만 승격; epoch revoke·ACK backpressure; verified revision은 유지 | source mutation·25건 batch·cancel/restart smoke |
| 기존 archive DB의 중복 행 | 0002 migration에서 identity backfill/merge를 transaction으로 수행 | migration checker에서 archive용 정본을 등록; append-only gate 통과 |
| 자료원 제거와 진행 중 작업 경합 | import epoch를 먼저 revoke하고 worker 정착을 기다린 뒤 occurrence를 제거; active export가 끝날 때까지 대기; 공유 canonical mail은 남은 verified occurrence로 재지정 | service/store 경합 테스트 green; UI/IPC와 S3 context·cache 경합은 남음 |
| 첨부 추출 중 원본 revision 변경 | attachment ID만 IPC로 받고 main/index가 verified occurrence를 다시 찾음; utility process가 원본 전체 fingerprint, message locator, ordinal/name/MIME/size를 검증하고 임시 파일을 만든 후 main이 revision을 한 번 더 확인 | EML 바이트 검증 테스트 green; PST 실자료 smoke는 검증 대기 |
| 임시 첨부 파일 잔류 | 정상 오류/취소 경로에서는 utility process가 sibling `.orca-part`를 지우며 main도 rename 실패 시 정리 | 강제 종료·전원 중단 때 선택 대상 폴더의 숨김 임시 파일이 남을 가능성은 설치본 시나리오에서 확인 필요 |
| 대량 처리 성능 | 파일 전체 fingerprint를 revision 검증에 사용하고 import batch는 ACK backpressure로 제한 | 대표 개인 보관함 크기의 p95/RSS/취소 지연은 AC19 실측 pending |
| 실제 Windows package·POP3 회귀 | unpacked artifact build 시도와 기존 회귀 suite는 환경/시간 경계로 미실행 | electron-builder network EACCES, VP-08/17 blocked |

설계 대비 대체 메커니즘: 해당 없음. D-012 source/index worker와 revision 구조를 계획대로 유지했다. expiry·sharing·reentry·invalidation에 새 대체 상태를 추가하지 않았다.

## [구현자 기입] 구현 보고

| 항목 | 관측 |
|---|---|
| 주요 변경 | r1.2 thread·자료원 제거·선택 첨부 저장 위에 r1.3 본문 선택 projection을 추가했다. HTML은 Cheerio 비실행 tree에서 hidden/script/style을 제외하고 문단·목록·표 경계를 보존한다. plain을 검색 대상으로 유지하고 서로 다른 HTML은 대체 본문으로 저장해 검색에서 제외하며, quality flags·선택 사유를 SQLite/상세 DTO/UI로 전달한다. HTML 변환 표시에만 identity hash가 흔들리지 않도록 구 projection text를 호환 입력으로 분리했다. D-012 worker 경계를 유지했다. |
| 관련 파일 | app/src/main/features/plugins/mail-archive/{relations.ts,migrations/0003_confirmed_relations.sql,store.ts,service.ts,readers/attachment-extract.ts,worker-host.ts}; app/src/main/app/handlers/mail-archive.ts; app/src/preload/index.ts; app/src/renderer/src/features/mail-archive/MailArchiveView.tsx; app/src/shared/{ipc.ts,mail-archive.ts}; docs/generated/inventory.md |
| 검증 명령 | npm run typecheck; 전체 ESLint + 변경 영역 재검사; mail body/EML/PST Vitest; 전체 archive Vitest; migration checker + 19 tests + Python SQLite migration smoke; doc-inventory --check; electron-vite build; git diff --check |
| 게이트 산출 | typecheck 3/3 pass; 전체 lint 0 error·기존 warning 1; body/EML/PST 14 tests pass; archive 22 pass·DB 15 skipped/blocked(native binding absent); migration sync core 27 + mail 1 + archive 4, no-copies·append-only pass; migration tests 19/19; Python SQLite 0001~0004 및 legacy row defaults 확인; doc inventory 9 items/112 channels pass; Vite main/worker/preload/renderer build pass |
| 패키지 산출 | electron-vite build pass; electron-builder 설치 산출물 및 M-PACK sentinel 확인은 이전 r1.2의 egress EACCES blocker로 미완 |
| V-pair 자기확인 | SELF_PASS 7 · SELF_BLOCKED 7; 독립 verify 아님 |
| 강제 지점 | §10 88자리 중 38 구현, S1 잔여 3, S2/S3 47 |
| Criteria-Met | 7/14: AC2·3·5·6·7·9·20 |
| Criteria-Pending | 7/14: AC1·4·17·19·21·22·23 |
| 합계 검산 | ✅7 · ⚠️7 = 14 (S1 관측 집합; 전체 AC 완료 주장 아님) |
| blocker | DB store roundtrip은 better-sqlite3 native binding이 없어 현재 실행하지 못함; 설치본/M-PACK은 electron-builder egress EACCES; OS picker/IPC 실기, semantic context·AC19, AC21 전체 scope/AI 경로, AC22/23 회귀가 남음 |
| 대상 커밋 | (r1.3 구현 — 검증자 기입) |

## [구현자 기입] Review Signals — 사실만

- 이번 r1.3에서 본문 quality schema를 append-only migration으로 추가했다. 기존 메일은 `legacy`로 구분하고 기존 HTML identity text projection을 호환 입력으로 써 display formatting 차이만으로 재가져오기 중 중복되지 않게 했다.
- plan에는 D-012와 EP-21이 이미 있었고, 이전 보고가 이를 deferred로 적었던 사실을 발견했다. 이번에는 규범 행은 건드리지 않고 구현 경로를 바로잡았다.
- 전체 typecheck, 변경 영역 lint, HTML/EML/PST 14 tests, append-only·doc inventory·Vite build가 통과했다. 현재 run에서 native-bound DB 15 tests는 초기화되지 않아 SELF_BLOCKED로 남겼다.
- 이전 electron-builder EACCES로 M-PACK/설치본 실행은 계속 미검증이다. 실제 renderer/IPC·품질 상세 UI는 독립 검증과 사람 실기가 남아 있다.
- 현재 라운드·impl 턴: r1.3 · Codex 구현. 다음 주체: Claude 검증.

## [검증자 기입] 파생 이슈

미착수. 구현 산출 후 [handoff-verify](../../../.agents/skills/handoff-verify/SKILL.md)로 수행한다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| 미기입 | — | — | — | — | — |
