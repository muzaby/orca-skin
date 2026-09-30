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
| 상태 | **IMPL_DONE — ΔV8 S3-A 표준 Plugin 도구 팩터리·검색·조회·근거·세션 범위 구현, 독립 verify 대기. 등록은 사용자 Deployment 소유. PG-03·S2·전체 S1과 나머지 S3는 미완료** |
| V mode / 기준 V | `Delta V` / 독립안 `V1@3f9558d9ec7fca52bc7c55533031051ba5d5b96a` |
| 이번 V revision / 유효 V | `ΔV8` / `V1 + ΔV2 + ΔV3 + ΔV4-A + ΔV5 + ΔV6 + ΔV7 + ΔV8`. ΔV8이 ΔV7의 등록 owner/수명을 정정. S2 실모델·PG-03은 범위 밖 |

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
| 최초 임베딩 답변 | “로컬 임베딩 모델 / 임베딩 api 모두 지원가능하도록” | 당시 두 경로 요구. 후속 S2 결정 D-033으로 대체 |
| 첨부 답변 | “첨부 본문 검색은 제외한다.” | 첨부 이름·유형·크기 검색과 선택 추출만 설계. OCR·본문 색인·첨부 임베딩 제외 |
| 계획 요청 | “Handoff-plan 으로 계획 작성하여 pr까지 만들어줘” | 이번 산출은 계획·PR. 앱 구현·의존성 설치 아님 |
| 독립안 요청 | “원격브랜치 무시하고 244로 만들어라. 비교 후 선택할 것이다. 작성자는 codex로 할 것” | 번호 0244, 작성자 Codex, 기준 main, 타 계획의 사용자 승인을 전용하지 않음 |
| 조사 반영 요청 | “조사 내용을 바탕으로 보완점이나 구현 방안을 구체화하라” + `mail-archive-rag-report.md` | 1차 구현·모델 문서와 대조하고 이 plan에 전처리·검색·UX·실증 조건 통합 |
| 문서 통합 요청 | “델타 문서는 따로 작성하지말고 plan 문서에 합쳐라” | 보완 계약을 해당 절에 통합하고 별도 델타 파일·참조 제거 |
| 손상 보존 결정 | “pst 손상 발견 시 마지막 업데이트까지만 유지.” | 손상된 PST의 이번 revision 전체를 공개하지 않고 이전 완료·검증 이력 유지. 후속 답변 D-029 |
| EML 배치 결정 | “Eml 배치 주입은 내부 함수(api)로만 제공할 것. 전처리 후 배치로 전달 예정. 수핸되는 동안 전처리기는 다시 파일 리드 위주의 작업을 진행할 것임. Gui 로 제공하지 않을 것임.” | EML 배치 입력 GUI를 없애고 내부 함수로 제공. 소비 중 다음 파일 읽기가 진행되는 유한 파이프라인 설계 |
| S2 범위 정정 | “S2: 로컬 임베딩만. Api는 reserved.” | 로컬 임베딩만 구현·검증. 임베딩 API는 예약 항목이며 활성 프로필·UI·인증·요청 구현 제외 |
| S3 의미 질문 | “s3: 사내서버, 클로드 연동은 무엇을 의미하지?” | 기존 채팅 모델이 선택 범위의 메일 근거로 답하고 출처를 여는 S3 계획 설명. D-003 변경 지시로 해석하지 않음 |
| S3 답변 | “핸드오프 244의 구현은 플러그인(빌트인mcp)으로 노출돼야 한다” + “이것이 s3에 대한 답변이다” + “계속” | S3는 빌트인 MCP Plugin 노출로 확정. 기존 채팅의 runtime tool 경계를 사용 |

## 3. Decision Ledger

`출처=Codex 제안`은 비교 대상으로 제안하는 설계이며 사용자 확정 발언과 구분한다. ACTIVE는 이 문서 내부의 일관된 설계 기준이며, DRAFT의 구현 승인을 뜻하지 않는다.

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 / AC |
|---|---|---|---|---|---|
| D-001 | 개인 로컬 EML·PST 보관함 | 조직 ACL·온라인 수집은 필요 범위 밖 | 사용자 | ACTIVE | AC1~6 |
| D-002 | 메타데이터·키워드·의미 검색 및 관계 확장 | 정확한 식별자와 유사 표현을 함께 찾음 | 사용자 제안서 | ACTIVE | AC7~14 |
| D-003 | 요약은 기존 사내서버·Claude(Bedrock) 실행 경로 모두 사용 | “모두 허용한다” | 사용자 | ACTIVE | AC18 |
| D-004 | 로컬 임베딩과 임베딩 API 모두 제공 | 요약 모델 선택과 별도 설정 | 사용자 | **SUPERSEDED → D-033** | AC10~12 |
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
| D-015 | 첫 로컬 모델 팩·runtime·고정 revision 실증 | 특정 변환 팩/runtime의 채택은 실증 필요. API 규약·인증은 D-033 reserved로 현재 결정 대상 제외 | 미제공 로컬 환경 정보 | **OPEN** | AC10·12·24 / S0 |
| D-016 | 기준 PC·대표 자료로 §14 예산의 실행 가능성 확정 | 성능 SLA를 임의 확정하지 않음 | 저장소 미정 항목 + 실측 필요 | **OPEN** | AC19·24 / S0 |
| D-017 | 표시 본문·키워드 필드·임베딩 입력을 분리하고 변환 규약을 버전 관리 | 전송 헤더·중복 본문·메타데이터가 검색을 지배하지 않게 함 | 조사 + Codex 제안 | ACTIVE | AC2·4·7·10 |
| D-018 | 인용/서명은 가역 분류, 자동 의미 삭제 없음 | 원 메일 부재·인라인 답변·업무 면책 조건 유실 방지 | 조사 비판 + Codex 제안 | ACTIVE | AC4·5·14 |
| D-019 | 메시지 버전별 chunk가 검색 단위, 확인된 스레드는 context 단위 | 스레드 전체 재임베딩과 잘못된 발신자·날짜 귀속 방지 | Onyx 구조의 선택적 적용 | ACTIVE | AC5·8·13·14 |
| D-020 | 기본 관련도 검색에 시간 감쇠 없음, hard filter와 정확 식별자 자동 완화 없음 | 과거 결정 근거·번호 검색의 정확성 보존 | 조사 권고 수정 | ACTIVE | AC7·8·14·16 |
| D-021 | query cache와 vector 파생 색인은 원문·출처와 별개이며 epoch로 무효화 | 계산 재사용이 범위·삭제·모델 변경을 우회하지 않게 함 | 조사 + Codex 제안 | ACTIVE | AC10·12·19~21 |
| D-022 | 로컬 모델 비교를 e5-small, EmbeddingGemma 768/256으로 구체화; API 동일 평가 | 공개 점수 대신 동일 한국어 메일 질의셋으로 선택 | 조사 + 공식 모델 카드 | **SUPERSEDED → D-024** | AC10·11·19·24 |
| D-023 | 설계 계약은 plan 한 문서에 통합 | 별도 델타 문서를 왕복하지 않고 현재 계약을 읽음 | 사용자 | ACTIVE | G-DOC |
| D-024 | 첫 기준을 단순·경량으로 구성: FTS5 기본, 선택형 로컬/API 임베딩, E5-small 384d + SQLite BLOB exact scan, ANN·reranker·모델 비교군 보류 | 경량화 방향을 선택했다. 실행 가능성은 S0 실증 조건 | 사용자 “경량화 방향으로 선택” + 공식 모델/runtime 자료 | **SUPERSEDED → D-033** | 경량 기준은 승계, API 구현 범위만 대체 |
| D-025 | 이번 구현 라운드는 PST·EML 가져오기와 검색으로 제한하고, EML은 파일 단건과 폴더 배치를 모두 제공 | 임베딩·RAG 계약은 유지하되 S2로 미루고, 1차 검색을 모델 설정 없이 즉시 사용 | 사용자 “Pst, eml 검색 1차구현. Eml은 배치로 입력 가능하게” | **SUPERSEDED → D-028** | S1 범위는 승계. EML 입력 경로는 사용자 후속 결정으로 정정 |
| D-026 | 자료원 ID는 형식과 canonical path에서 안정적으로 만들고, 전체 파일 fingerprint는 revision 변경 검증에만 쓴다. 메일 identity는 Message-ID와 정규화 payload hash를 결합하며, Message-ID가 없으면 같은 자료원의 locator와 payload hash를 결합한다. | PST 누적·변경이 새 메일 중복 삽입으로 이어지지 않는다. 같은 ID의 다른 본문은 별도 행으로 보존하고, 유사도만으로 메일을 병합하지 않는다. | Codex 구현 제안 — 사용자 문제 제기 후 구현 계속 지시 | **ACTIVE** | AC3·AC5·AC7 / S1 |
| D-027 | PST 손상 발견 시 마지막 업데이트까지만 유지 | “pst 손상 발견 시 마지막 업데이트까지만 유지.” | 사용자 2026-09-30 | **ACTIVE** | AC2·3·20. 보존 시점의 정확한 단위는 D-029 |
| D-028 | S1은 PST·EML 가져오기·검색. EML 배치 주입은 전처리 후 내부 함수(API)로만 제공하며 GUI로 제공하지 않음 | “수핸되는 동안 전처리기는 다시 파일 리드 위주의 작업을 진행할 것임.” | 사용자 2026-09-30 | **ACTIVE** | D-025 대체 / AC1·3·19·23. S2/S3 범위 유지 |
| D-029 | 손상 PST는 직전 가져오기가 끝나 검증된 상태를 유지. 이번 PST revision 전체를 적용하지 않음 | “직전 가져오기가 끝나 검증된 상태 유지: 이번 가져오기 전체는 적용하지 않음 (권고)” | 사용자 답변 2026-09-30 | **ACTIVE** | PG-01 확정 / AC2·3·20 |
| D-030 | EML 내부 배치 API는 정규화된 헤더·본문·첨부 메타데이터와 원본 위치를 받음 | “정규화된 메일 데이터: 헤더·본문·첨부 메타데이터와 원본 위치 (권고)” | 사용자 답변 2026-09-30 | **ACTIVE** | PG-02 확정 / AC1·3·19. 전처리기가 파일/MIME와 읽은 원본 digest 검증 담당 |
| D-031 | EML 입력 GUI를 모두 제거하고 PST 추가만 제공 | “EML 입력 GUI를 모두 제거하고 PST 추가만 제공 (권고)” | 사용자 답변 2026-09-30 | **ACTIVE** | AC1·23 / picker·preload·renderer. 기존 EML 검색·열람·제거는 유지 |
| D-032 | 형식 통합 전환에서 이미 보관된 EML/PST 중복을 처리하는 방식 | 기존 ID를 alias로 유지해 검색 결과를 통합할지, 기존 중복은 유지하고 신규 입력부터 중복 차단할지 확인 필요 | 사용자에게 질문 2026-09-30, 답변 대기 | **OPEN** | PG-03 / AC3·5·7·17. 기존 메일·첨부 ID와 본문 보존은 두 안의 공통 전제 |
| D-033 | S2는 로컬 임베딩만 구현. 임베딩 API는 reserved. FTS5 기본·선택형 E5-small 384d·SQLite BLOB exact scan·ANN/reranker 보류 승계 | “S2: 로컬 임베딩만. Api는 reserved.” | 사용자 2026-09-30 | **ACTIVE** | D-004·024 대체 / AC8·10~12·19·20·24. D-003·028·030 유지 |
| D-034 | 244의 S3 기능을 빌트인 MCP Plugin으로 노출 | “이것이 s3에 대한 답변이다”. 기존 채팅이 공통 도구를 호출하며 별도 AI 연결 설정을 추가하지 않음 | 사용자 2026-09-30, “계속” | **ACTIVE** | AC18·22·23·25. EML 내부 입력·PST GUI·로컬 임베딩 결정 유지 |
| D-035 | 다른 플러그인 도구와 같은 표준 팩터리로 제공. 실제 등록은 사용자 Deployment 소유 | “다른 플러그인도구와 똑같이 취급… 사용자 측에서 deployments에서 등록”. Bootstrap 자동 등록·Deployment deps 주입/파일 편집은 하지 않음 | 사용자 2026-09-30 정정 | **ACTIVE** | AC25·VP-30~33·EP-26. ΔV7의 Bootstrap 등록 해석만 대체 |

V1의 D-001~D-016을 유지하고 조사 보완 D-017~D-023, 경량 기준 D-024, 구현 범위 D-025, 자료원·메일 identity D-026을 반영했다. 기준은 이 독립안의 V1이며 다른 브랜치의 라이브러리 승인·모델 선택·V를 상속하지 않는다.

D-033은 D-024의 경량 기준을 승계하고 임베딩 API 구현 요구를 reserved로 대체한다. D-014는 S1 PST parser를 닫고 로컬 runtime·모델 팩 실증은 D-015에 남긴다. `sqlite-vec`, ANN, reranker, Gemma 비교는 첫 기준에서 제외한다.

직전 설계 대조는 D-001~D-012·D-017~D-021·D-024~D-026과 당시 AC·본문 경로를 기준으로 했다. D-022→D-024→D-033, D-004→D-033, D-025→D-028의 대체 관계를 보존한다. 문서 요구 D-013·D-023은 G-DOC로 확인하며 D-015~D-016은 로컬 모델·PC 실증 OPEN으로 남긴다.

### ΔV6 — S2 로컬 전용·임베딩 API reserved (2026-09-30, DRAFT)

D-033은 사용자 범위 변경이다. 임베딩 API는 향후 확장 예약 설명만 두며 S2의 활성 타입·설정·adapter·credential·HTTP 요청·자동 대체 경로를 만들지 않는다. EML 내부 배치 함수 D-028/030과 기존 채팅 AI 경로 D-003은 유지한다.

V1의 AT-11/AC11 “API 프로필로 색인·질의 임베딩하고 취소·401·429·형상 오류를 구분”은 ΔV6의 로컬 정상 실행·예약 경로 거절 관측으로 대체한다. 기존 stable node/pair ID는 유지하고 §7-A의 ΔV6 표가 영향받은 기존 행을 supersede한다. S2 READY 승격은 D-015·016 실증과 신규 의존성 확정 뒤이며 이번 턴에는 문서만 정정한다.

### ΔV5 — 손상 보존·내부 EML 배치 결정 반영 (2026-09-30, READY)

D-027~031은 사용자 명시 결정이다. D-025의 S1 범위는 승계하고 EML 파일·폴더 입력 GUI 해석을 대체한다. PST는 직전 완료·검증 이력을 보존하고 EML은 정규화 데이터를 내부 함수로 주입한다.

| 대상 | 확정 / 남은 확인 | 설계·검증 영향 |
|---|---|---|
| PG-01 | D-029로 확정: 손상된 PST의 이번 revision 전체 미공개 | 이전 verified의 ID·본문·첨부 참조·검색 집합과 성공 counter 유지. 첫 입력 손상은 공개 메일 0 |
| PG-02 | D-030·031로 확정: 정규화 데이터 내부 API, EML 입력 GUI 전체 제거 | 기존 D-026의 EML 원본 파일별 자료원 유지. 폴더 하나=자료원 하나라는 종전 권고는 채택하지 않음 |
| PG-03 | 형식 통합 identity와 이름/주소 정규화는 기술 설계 대기 | 기존 ID·첨부 참조·공유 occurrence 유지가 선행. sourceKind 제거만으로 전환하지 않음 |

소비자가 한 배치를 저장하는 동안 전처리기는 다음 파일 읽기·전처리를 진행한다. API는 한 배치만 처리하고 완료 Promise를 ACK로 반환하며, 생산자는 다음 한 배치까지만 준비한 뒤 ACK를 기다린다. 기존 D-012의 자식 프로세스 격리·index 단일 writer·epoch 취소를 유지한다.

ACTIVE 결정 ↔ AC 대조: D-028/030/031→AC1·19·23의 내부 주입·병행 읽기·PST GUI, D-027/029→AC2·3의 이전 verified 보존을 아래 pair와 대조했다. 기존 ID/첨부 보존 D-026과 비영향 계약은 유지한다. r1.4/r1.5의 GUI 증거는 당시 계약의 이력으로 보존한다.

### PG-03 후속 조사 — DRAFT, D-032 답변 대기 (2026-09-30)

조사 기준은 공유 브랜치의 `5c4cd9b0`이다. PST/EML 공통 identity를 단순 형식 제거로 구현할 수 없으며 기존 중복의 결과 표시 정책 D-032를 먼저 확정해야 한다. 이 절은 후속 설계 입력이며 READY·실행된 전환·새 V pair 완료를 뜻하지 않는다.

| 대상 / 검색·실행 | 이번 관측 | 설계 영향 |
|---|---|---|
| `identity.ts`, normalize/store/EML boundary의 `archiveMailIdentityKey` 호출 검색 | payload에 표시 문자열·reply/references·threadKey·첨부 순서와 sourceKind가 결합된다. | 주소/이름·관계·manifest 순서가 다른 두 형식의 동일성을 증명하지 못한다. canonical 계산과 기존 key 호환성을 분리해야 한다. |
| `normalize.ts`와 설치된 `pst-extractor` 타입/런타임 | EML은 name을 버리고 PST는 displayTo/displayCC와 delivery time을 사용한다. 실제 타입에 transportMessageHeaders·clientSubmitTime·recipient.smtpAddress/displayName이 있다. | transport header와 native recipient fallback을 공통 주소 모델로 만들고 Date/submit time과 delivery time을 구별한다. 없는 이름을 추측 복원하지 않는다. |
| 공개 enron.pst를 실제 parser+PostalMime로 읽는 비공개내용 없는 probe | 71메일·헤더 71·발신 표시 이름 70·수신 헤더 71·SMTP recipient 127·첨부 있는 메일 29. Date 헤더/References는 없고 submit/delivery time은 이 표본에서 모두 같았다. | 실물에 이름/주소·첨부 seam이 존재함을 확인했다. 날짜가 다른 synthetic oracle 및 ANSI/한국어 golden을 이 표본으로 대체하지 않는다. |
| `store.ts` legacy backfill·upsert·첨부 위치 SELECT, source revision schema | identity_key unique lookup으로 결정적 mail ID를 만들고 첨부 ID는 mail ID/ordinal에 귀속된다. legacy backfill은 충돌 행을 삭제한다. revision은 source/fingerprint unique다. | 새 normalizer를 같은 원본에 적용하는 revision, 기존 key/ID alias, 충돌 처리, 자료원별 실제 첨부 순서 mapping을 별도로 설계해야 한다. |
| query/get/stats/remove의 verified occurrence 경로 | 검색은 mail 행, 위치/제거는 occurrence, 첨부 추출은 메일의 저장 ordinal을 사용한다. | 기존 두 ID를 통합할 경우 검색·상세·통계·공유 제거·첨부 저장 전 경로가 같은 대표/alias 규칙을 소비해야 한다. 한 SQL lookup만 바꾸면 안 된다. |

후속 계약의 공통 전제는 본문/기존 ID 보존, Message-ID+확인된 normalized payload 비교, 다른 본문 버전·ID 없는 자료원 locator의 강제 병합 금지다. 원본 없는 legacy 행의 잃어버린 이름·발신 시각은 생성하지 않는다. 저장된 과거 identity를 즉시 재작성하거나 기존 중복 행을 삭제하지 않는다.

**선택안 1 권고**: 확인된 기존 중복은 대표 검색 결과 하나로 통합하고 기존 mail/attachment ID는 alias로 계속 resolve한다. **선택안 2**: 기존 결과는 그대로 유지하고 새 입력부터 공통 identity를 적용한다. 두 안 모두 첨부 reference와 공유 occurrence를 보존하며 D-032 답변 후 영향받는 V node/pair·§10·rollback/reopen·충돌·제거 oracle을 후속 Delta V로 확정해야 한다.

### ΔV4-A — 직전 구현 경로와 당시 결정 대기 기록 (2026-09-30)

> 이 절은 r1.5 구현 기준 이력이다. 현재 사용자 결정과 확인 항목은 위 ΔV5가 정본이며, 아래 파일/폴더 추가 GUI를 새 구현 계약으로 승계하지 않는다.

사용자의 “이어서 진행하라”에 따라 기존 ACTIVE 계약의 미구현 경로를 계속한다. PG-01 손상 PST 부분 공개와 PG-02 EML 폴더 관리 단위는 사용자 답변 대기이며, PG-03 형식 통합 identity 전환은 기술 설계 대기다. **이 세 경로는 READY가 아니며 기존 reader·source/revision·identity 동작을 이번 구현에서 바꾸지 않는다.**

이번 READY 경계는 D-008의 설정 관리, AC7의 명시 필터, AC4의 가역 구간 표시다. 전체 S1 완료로 범위를 좁히지 않으며 기존 미충족 AC는 유지한다. 설정 관리와 본문/검색은 현재 저장된 verified 메일을 소비하므로 위 세 변경 없이 구현 가능하다.

- 설정의 `메일 보관함` 탭에서 파일/폴더 추가·진행·실패·자료원 제거·검색 화면 이동을 제공한다. 페이지는 검색/열람과 `자료원 관리` 진입을 제공한다. 설정과 페이지는 같은 feature 상태를 소비해 어느 쪽에서 변경해도 목록·현황을 갱신한다.
- 검색은 Enter/검색 버튼으로만 적용한다. 보낸 사람·받는 사람·참조·첨부 이름은 각 필드의 부분 일치, 날짜는 메일의 보낸 날짜 범위, 폴더는 verified occurrence의 경로 부분 일치다. 모든 지정 조건은 AND다. 자료원과 폴더가 함께 지정되면 **동일 occurrence**가 두 조건을 만족해야 한다.
- 날짜 입력은 사용자의 로컬 달력 날짜이며 시작일 00:00 이상, 종료일 다음 날 00:00 미만으로 IPC에 보낸다. 역전 범위·유효하지 않은 날짜는 검색 전에 표시하고 기존 결과를 유지한다. 날짜 미상은 기간 필터를 지정했을 때 제외한다.
- 본문 구간은 `[start,end)` UTF-16 offset으로 snapshot 전부를 겹침 없이 덮는다. 명시 `>` 행은 quote, 표준 서명 구분선과 복수 연락처 근거가 함께 있는 꼬리는 signature, 나머지는 unknown으로 보수적으로 분류한다. 한 줄 `--`, 문장 안의 `보낸 사람:`, 인라인 새 답변은 지우거나 quote로 추정하지 않는다.
- 구간 분류는 새 본문/기존 본문에서 같은 순수 함수를 쓰며 DB에 classifier revision과 offset을 저장한다. 기존 본문·메일/첨부 ID·identity_key는 변경하지 않는다. 대체 본문은 별도 텍스트로 열고 선택 본문 offset을 적용하지 않는다.
- 뷰어는 quote/signature를 접어 볼 수 있고 해당 구간에 현재 검색어가 있으면 자동 펼친다. 원문 전체 보기를 항상 제공한다. 이번 단계에서는 가중치 FTS·scope-aware quote 중복 접기·AI context를 구현했다고 주장하지 않는다.

ACTIVE 결정 ↔ AC 대조: D-008→AC1/23, D-006→AC4, D-005→AC9, D-026→AC5를 유지한다. 필드의 잃어버린 이름을 추측 복원하지 않으며 이름/주소 재정규화와 EML↔PST 병합은 PG-03에 남긴다. 이 독립 경로에는 신규 제품 선택·의존성 추가가 없다.

### Codex 권고: 첫 기준은 단순·경량

개인 보관함을 빈 상태에서 시작해도 검색이 바로 쓸 수 있고, 모델 설치나 AI 자격증명 없이 메일 보관·정확 검색·스레드 확인이 되도록 단계화한다. 두 요약 AI 경로(사내 서버·Claude on Bedrock), 로컬 임베딩, 첨부 이름 검색·선택 추출, 첨부 본문 검색 제외를 유지하며 임베딩 API는 D-033 reserved다.

| 영역 | 첫 기준 권고 | UX·운영 이유 |
|---|---|---|
| 기본 검색 | 기존 SQLite에 FTS5·메타데이터 필터·확인된 스레드 연결. 임베딩 설정 전에도 같은 보관함 화면에서 검색·열람 가능 | 첫 실행에 모델 다운로드·API 키 입력을 요구하지 않고 검색 실패를 줄임 |
| PST / EML | EML은 기존 MIME parser 재사용. PST는 `pst-extractor@1.12.0`을 후보로 두고 필요 시에만 source worker 기동 | 기본 앱 시작 비용과 평상시 메모리를 줄임. PST 대형·손상 파일 지원은 S0 fixture로 확인 |
| 임베딩 | 로컬 `multilingual-e5-small` 384차원 프로필 하나를 사용. 로컬 모델은 설치본에 포함하지 않고 사용자가 명시적으로 가져오기/설치. API는 reserved | 프로필 미설정 시 키워드 검색 유지, 로컬 팩만 선택·실행. API 설정·인증·요청은 제공하지 않음 |
| 로컬 실행 후보 | `@huggingface/transformers`의 로컬 ONNX/WASM 경로와 multilingual-e5-small 양자화 팩을 S0에서 검증. 원격 모델 로드 차단·WASM 파일 경로 고정, 변환본의 수치·순위·라이선스·CPU 호환성을 기준 모델과 대조 | 런타임과 가중치를 분리해 선택 설치하되, 실제 설치본 크기·CPU 지연이 기준을 넘으면 런타임 후보를 다시 고름 |
| 벡터 검색 | canonical float32 BLOB + worker의 scope 적용 exact cosine scan. SQLite에 `sqlite-vec` 확장이나 별도 ANN 인덱스는 넣지 않음 | 파생 인덱스·DLL·이중 쓰기·재구축 상태를 없애고 기존 SQLite만 사용 |
| 고급 검색 최적화 | reranker, query expansion, 시간 감쇠, 자동 검색 범위 확대는 첫 기준에서 제외 | 검색 결과의 이유를 설명하기 쉽고 동작·설정 수를 줄임. 실제 품질/지연 자료가 생기면 별도 결정 |

로컬 모델 팩은 등록 전에 파일 크기·라이선스·모델 revision을 보여 주고, 명시적 취소·재시도·삭제를 지원한다. 모델 미설치/로컬 추론 오류 때는 결과 상단에 “키워드 검색만 사용 중” 또는 실패 원인을 표시한다. 검색 모드가 바뀌어도 현재 질의의 출처 범위·날짜 필터는 유지한다.

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
 ├ 자료원: PST 파일 추가             →    검색어 [서버 이전 보류] [검색]
 ├ 처리 현황·오류·재시도·경로 재연결        범위 [전체 보관함] 기간 [전체] 사람 [전체]
 ├ 의미검색: 사용 안 함 / 로컬              검색 결과 목록  │ 선택 메일 / 대화 흐름
 └ [보관함 열기]                           [이 범위로 질문] │ [선택 첨부 추출]
                                                 ↓
기존 Orca 채팅: [메일: 선택한 자료원·기간] [현재 요약 모델]
 → 관련 근거 조회 → 경위 답변 + 출처 [1][2] → 우측 근거 뷰어
```

설정은 관리 진입점이며 검색 결과를 긴 설정 모달에 넣지 않는다. 보관함 화면은 목록·상세의 두 영역을 사용하고, 좁은 창에서는 상세를 별도 화면으로 전환해 `결과로 돌아가기`가 검색어·스크롤·선택을 복원한다.

### 최초 가져오기

1. 설정에서 `PST 파일 추가`만 제공한다. EML은 전처리기가 내부 함수로 전달하며 단일·복수 파일·폴더 입력 GUI를 제공하지 않는다.
2. 자료원별 준비 결과에 파일/폴더 수, 예상 처리량 또는 `계산 중`, 경로 접근 오류를 표시한다. PST는 메일 폴더를 선택할 수 있고 기본은 전체 메일 폴더이다.
3. EML은 완료·검증된 입력부터 검색할 수 있다. PST는 revision 전체의 시작/완료 fingerprint 일치와 정상 순회 뒤 공개한다. `검색 가능한 메일`과 `의미검색 준비된 메일`을 따로 표시한다.
4. 설정을 닫아도 진행한다. `취소`는 해당 작업만 멈추며 EML의 완료·검증된 입력은 남긴다. PST 취소·손상·재시작 시 미완료 revision 전체를 제외하고 이전 verified 이력을 유지한다.

이름검색은 `견적서.xlsx`라는 **첨부 이름을 가진 메일**을 찾는다. `선택 추출`은 그 첨부 하나를 원본에서 꺼내 파일로 저장하는 동작이며, 파일 속 셀·문장·이미지는 검색 대상이 아니다.

### 검색과 질문

- 검색은 Enter/검색 버튼으로 실행한다. 타이핑마다 LLM·로컬 임베딩을 실행하지 않는다.
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
| 손상 EML 입력 | 실패 이유와 항목 식별자, 완료·검증된 입력 유지 | 내부 API 호출자에게 실패 결과 반환 |
| 손상 PST | 실패 이유 표시, 손상된 PST의 새 revision 전체 미적용. 이전 완료·검증 이력 유지 | 원본 복구 후 재가져오기 |
| 원본 이동·오프라인 | 저장 본문 열람·검색 가능, `원본 연결 필요` | 경로 재연결; 첨부 추출 비활성 |
| 원본 내용 변경 | PST는 새 revision을 검증하는 동안 이전 검색 결과를 유지한다. 완료 후 새 메일만 추가하고 이미 확인한 메일은 제외 수로 보여준다. 같은 ID의 수정 본문은 별도 결과로 보존한다. | 재가져오기 결과의 새 메일·기존 메일·실패 수 확인 |
| 키워드 0건 | 적용 필터와 검색 범위 표시 | 필터 해제·기간 확대를 명시적으로 선택 |
| 로컬 모델 미설치/추론 오류 | `의미검색을 사용할 수 없어 단어로 검색했습니다` | 로컬 팩 설정 열기 / 재시도; 같은 필터의 키워드 검색 유지 |
| 새 모델 색인 중 | 기존 의미검색 유지, 새 색인 진행률 표시 | 취소 / 준비 후 전환 |
| 작업 취소·앱 종료 | 완료·검증된 EML 입력 유지. PST staging은 공개하지 않고 이전 verified 이력 유지. 재시작 시 미완료 revision은 `중단됨` | 재개·재시도. 자동 전량 재전송하지 않음 |
| 자료원 제거 | 삭제 대상 수·공유 중복 메일 유지·원본 파일 보존 안내 | 확인 후 제거 |
| 오래된 출처 클릭 | 해당 버전 문단 또는 `자료원이 제거되어 근거를 열 수 없음` | 남은 출처 확인 |

### UX 검토 기준

필터 변경 전 요청의 늦은 응답은 새 결과를 덮지 않는다. 검색어·선택·스크롤은 보관함 화면 상태로, 질문 범위·근거 뷰어는 세션 상태로 분리한다.

근거 클릭은 새 브라우저가 아니라 Orca 우측 뷰어에서 해당 메일 문단을 강조한다. 뷰어 닫기/뒤로 가기는 호출한 인용 링크에 포커스를 돌리고, 세션 전환 시 다른 세션의 근거가 보이지 않게 한다.

탭 순서·목록 키보드 이동·Enter 열기·Escape 닫기·접근성 이름·두 테마 대비를 확인한다. 상태는 색만으로 구분하지 않고, 진행 알림은 건마다 낭독하지 않는다.

## 6. 범위 / 비범위

**범위**는 EML/PST 가져오기, 정규화·중복·관계, 검색 UI, 로컬 임베딩, 도구 기반 RAG, 버전별 출처 확인, 첨부 이름검색·선택 추출이다. 임베딩 API는 reserved로 완료 범위에서 제외한다. S1만 구현하고 로컬 벡터 검색을 “후속 지원 가능”으로 남긴 상태는 전체 계획의 완료가 아니다.

**비범위**는 첨부 본문 색인/OCR, PST에 들어 있는 일정·연락처, 메일 보내기, Outlook 동기화, 조직 공동 보관함, 그래프 DB, 상시 서버 운영, 요약문을 새로운 사실로 재색인하는 기능이다. 검색 결과 PDF/보고서 내보내기는 기존 산출물 기능으로 필요 시 처리하되 전체 메일 원문을 자동 게시하지 않는다.

자료원·버전·증거 ID·임베딩 세대는 지금 설계한다. ANN DB, 프로젝트 엔터티 그래프, reranker 추가는 실제 검색 품질·규모 병목을 확인한 뒤 별도 결정한다.

## 7. Requirements / Acceptance — R ↔ AT

각 AT는 같은 번호의 AC를 검증한다. 아래 검증은 **구현 때 수행할 기준**이며 이번 문서 PR에서 통과했다고 주장하지 않는다.

ΔV5의 변경 행은 아래 node/pair·§10을 구현 기준으로 사용한다. 직전 V·구현 자기보고는 그 당시 계약의 증거로 보존한다.

| R | AT / AC | 관측 가능한 동작 기준 | 직접 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | PST를 GUI로 등록하고 정규화 EML 배치를 내부 API로 전달해 검색·열람 가능. EML 입력 GUI 전체 제거 | 실제 PST picker→가져오기→검색과 내부 EML 호출→검색 ID 집합. EML 버튼 복원 변이·picker의 EML 경로 거절 | PST: 설정→IPC→worker. EML: 내부 producer→배치 API→index→보관함 |
| R-01 | AT-02 / AC2 | 한글·HTML EML 및 ANSI/Unicode PST의 지정 메일·폴더·첨부 메타데이터를 읽음. 손상 PST는 이전 완료·검증 이력 유지 | 합성/배포 허용 fixture의 기대 필드와 비메일 제외 이유. 손상 전 신규 staging 배치가 검색에 없고 이전 ID·첨부 참조가 유지됨<br>plain/html 대체 본문·HTML-only·charset·영어/코드 field golden | 내부 EML 입력/PST 등록→reader·normalize→DB<br>reader→body-selection→version |
| R-01 | AT-03 / AC3 | EML 완료·검증 입력은 취소 후에도 검색된다. PST 손상·취소·원본 변경은 새 revision 전체 미공개. 재시도·재시작은 기존 메일 중복 삽입 없음 | EML 입력 사이 취소와 PST 손상·원본 변경·재시작의 검색 ID·revision·성공 counter 대조. 첫 PST 손상은 검색 0, 기존 revision은 본문·ID·첨부 불변 | 내부 API/작업 UI→main→source/index worker→DB→event |
| R-02 | AT-04 / AC4 | 인용·서명 포함 본문 열람과 옛 인용은 재색인/원본 이동 후에도 동일 | 버전 해시·UTF-16 범위로 표시 문장 일치, HTML script/외부 이미지 실행·요청 없음<br>인라인 답변·인용·서명을 재결합하면 snapshot과 동일, hit가 접힌 구간이면 펼침 | reader→version→본문/근거 뷰어<br>classifier→snapshot→viewer |
| R-02 | AT-05 / AC5 | 같은 canonical path의 재등록은 새 전체 fingerprint여도 기존 메일을 재사용한다. 같은 Message-ID라도 정규화 payload가 달라지면 별도 행으로 보존하고, Message-ID 없는 메일은 같은 자료원의 locator와 payload가 모두 같을 때만 재사용한다. | 동일 PST의 추가 revision·동일 ID/변경 본문·ID 없음/다른 locator fixture에서 mail row와 revision occurrence 집합 대조 | rescan→stable source ID→mail identity→revision occurrence→search |
| R-02 | AT-06 / AC6 | 역순 수집에도 Reply/References 연결 복원, 유사 제목만으로 확정 병합 안 함 | 역순/누락부모/다중후보/순환/동일제목 fixture의 edge kind·시간순 대조 | normalize→relations→thread view |
| R-03 | AT-07 / AC7 | 한두 글자 한글·혼합 검색·문서번호·이름/주소·기간/폴더 필터가 함께 적용되고, 띄어쓴 검색어는 모두 포함(AND)된다. 짧은 토큰 질의는 trigram FTS 제약을 피해 안전한 fallback을 쓴다. | `QA 승인 AB-12`, `서버 이전`, `%_`, 동명이인 fixture에서 정확한 mail ID 집합<br>모든 토큰이 각각 제목/본문/주소/첨부 이름 중 하나에 있을 때만 반환 | UI→term compiler→FTS/LIKE→results |
| R-03 | AT-08 / AC8 | 메일별 중복 chunk를 합친 hybrid 결과를 보여 주고 의미검색 장애 시 단어검색 유지 | 각 검색 분기의 관련메일 포함·중복 1회·degraded 상태·페이지 안정성<br>quote 중복 rank 투표 방지, FTS 0건 semantic 이유 표시, lexical-only는 외부 요청 없음 | search→lexical/vector→fusion→UI<br>hybrid→fold→result DTO |
| R-03 | AT-09 / AC9 | 첨부 이름으로 메일을 찾되 첨부 내부에만 있는 문자열은 검색·질문 근거에 나오지 않음 | 이름 `견적.xlsx`, 내부 고유문구 sentinel을 가진 fixture; parser/index/embed/LLM payload 대조<br>첨부 EML·inline rfc822·text/plain 첨부의 고유 sentinel이 전송/색인 payload에 없음 | attachment manifest→filename index→search<br>reader 옵션→projection→embedding/context |
| R-04 | AT-10 / AC10 | 네트워크 없이 선택한 로컬 모델 팩으로 문서/질의를 같은 규약으로 임베딩 | 실 모델 golden input의 차원·수치 허용오차·검색 결과, 전송 포트 호출 없음<br>필수 모델 prompt 보존·입력 budget 검증, query cache hit 때 vector·결과 동일 | settings→local worker→generation→search<br>renderer→EmbeddingPort→cache/worker |
| R-04 | AT-11 / AC11 | ΔV6: 로컬 프로필로 색인·질의 실행. 임베딩 API는 reserved로 활성화할 수 없음 | 실제 로컬 worker 성공·오프라인 검색, API 프로필 입력 거절·설정 옵션 없음·임베딩 전송 호출 0. API fallback 결함 변이는 실패 | settings/IPC→local-only schema→local worker→validated vectors; embedding composition·fallback guard |
| R-04 | AT-12 / AC12 | 모델 변경·중단·재시작에도 query/document 모델이 섞이지 않고 완성 세대만 전환 | 실패 위치별 활성 포인터·임베딩 fingerprint·구세대 조회 일치<br>profile fingerprint가 같을 때만 cache 재사용, 다른 모델·차원·prompt면 새 generation | profile→staging→activate→query lease<br>profile→cache→generation |
| R-05 | AT-13 / AC13 | 답변 출처는 당시 메일 버전 문단을 열며 조작된 출처 ID는 열리지 않음 | evidence 저장 전 반환 실패·재색인·세션 위조·임의 URL 입력 대조<br>대체 본문·prefix가 인용 offset으로 오인되지 않고 원래 연속 문단을 열음 | context→evidence DB→MCP→Markdown→viewer<br>chunk span→evidence→viewer |
| R-05 | AT-14 / AC14 | 질문의 연대기에서 요청/변경/반대/승인 근거를 남기고 누락·잘림·미확인을 표시 | 고정 정답 타임라인 fixture로 context coverage, 승인 누락/상충 질의 평가<br>오래된 결정·수정 인용·부모 없는 인용·선택 scope 밖 부모의 골드 근거 보존 | seeds→bounded expansion→context→answer<br>seeds→quote fold→neighbors/thread→context |
| R-05 | AT-15 / AC15 | 인용 뷰어에서 날짜·당사자·일치 문단·관계 근거를 확인하고 검색/답변으로 복귀 | 스트리밍/완료 인용 클릭, 좁은 창·키보드·세션전환 상태 대조 | Markdown callback→evidence IPC→viewer |
| R-06 | AT-16 / AC16 | 선택 범위 밖 메일이 검색·확장·출처·첨부에 섞이지 않음 | 서로 다른 두 자료원·두 세션 및 위조 ID/필터 확장 요청에 대해 결과 집합 대조 | session scope→service→all read/export paths |
| R-06 | AT-17 / AC17 | 선택 첨부만 추출, 원본 변경/소실은 명시 오류, 모델 호출은 기존 승인 경유 | 바이트 해시·추출 파일 수, 원본 변경 race, 승인 false/undefined/true 정책 확인 | UI export/tool approval→validated occurrence→Temp |
| R-06 | AT-18 / AC18 | 기존 사내서버·Claude(Bedrock) 각각에서 같은 archive 도구로 근거 있는 답변 가능 | 각 실제 실행 경로에서 MCP result·출처 클릭·취소 확인, 기능별 품질평가 | current harness→runtime tool→context→answer |
| R-07 | AT-19 / AC19 | 대량 처리 중 화면 입력·취소 가능, 큐와 메모리는 §14 예산 내 동작. EML 배치 소비 중 전처리기의 다음 파일 읽기가 진행되고 대기 상한에서 멈춤 | ACK 지연 시 선행 읽기·슬롯/바이트 상한을 직접 관측<br>대표 PC actual/1만 mail workload의 p95/RSS/cancel 측정. 실제 archive가 1만을 넘으면 5만 추가 | 내부 EML producer→유한 큐→index ACK<br>UI/main→bounded worker jobs; cache→scheduler→scoped scan |
| R-07 | AT-20 / AC20 | 앱/worker 종료와 재시작 때 손상 없이 중단 상태 복구, 로컬 worker 늦은 결과 미반영 | child kill·job abort·디스크 full·commit 전후 fault injection<br>cache/vector generation 쓰기 도중 kill·취소에서 기존 active 검색 복구 | lifecycle→jobs/generation→restart<br>lease/epoch→transaction→restart |
| R-07 | AT-21 / AC21 | 자료원 제거는 고유 데이터 삭제·공유본 유지, 진행 요청이 삭제 데이터를 복원하지 않음 | import/로컬 embedding/context/첨부 read와 제거 경합, 옛 출처 tombstone 확인<br>자료원/세션 제거와 in-flight 완료 경합에서 cache·vector rows·늦은 결과 재생성 없음 | remove→revoke→DB purge→late response guard<br>revoke→refcount purge→return guard |
| R-08 | AT-22 / AC22 | POP3·기존 채팅·산출물 동작을 보존하고 보관함 초기화가 해당 기능을 막지 않음 | 기존 MIME/권한 suite + 독립 DB·빈 archive 부팅·추가/제거 runtime tests | bootstrap→existing/new service→runtime |
| R-08 | AT-23 / AC23 | 설정·페이지·도구·오류 동작이 양방향 연결되고 오래된 응답이 현 화면을 덮지 않음 | 실제 composition으로 설정 슬롯/오류 링크/범위 칩/요청 역전 테스트 | app composition→feature API→IPC/event |
| R-08 | AT-24 / AC24 | Windows 패키지에서 PST·로컬 추론을 실행하고 개인 메일·테스트 fixture는 배포에 미포함 | 설치 산출물 파일 manifest·실행 smoke·네트워크 차단 모델 팩 실기<br>선택 parser/runtime의 설치본 load/search/delete/reopen과 모델 추론, 모델 미설치 시 FTS5 동작 | electron build→installer→worker/runtime<br>packaged worker→PST/model pack |

ΔV7은 기존 AC1~24를 승계하고 빌트인 MCP 노출의 AC25를 추가한다. S0→S1→S2→S3 구현 단위는 §11에서 나누며 S3-A는 실모델 없이 기존 키워드 검색으로 구현할 수 있다. UI 표시는 상태 테스트로, 실제 문자 렌더링·포커스·설치/사내 endpoint는 실기로 확인한다.

| R | AT / AC | 동작 기준 | 검증 수단 | production path |
|---|---|---|---|---|
| R-10 | AT-26 / AC25 | 표준 Plugin 도구 팩터리가 사용자 Deployment 등록 후 허용된 실제 세션의 보관 메일을 검색·조회·관계/근거 반환한다. 같은 서버 인스턴스를 재사용하고 미등록/해제된 범위는 UI·도구에 명시 | 실제 팩터리→registry→Claude MCP adapter→handler 왕복, 미등록 기본 빌드·두 세션/자료원·취소/제거/restart, Plugin 범위 설정·출처 열람 | Deployment 소유 등록→runtime tool→scoped index worker→evidence→UI. Bootstrap은 로컬 backend/IPC 수명만 연결 |

## 7-A. V / Trace Matrix

이 표는 V1 + ΔV2 + ΔV3 기준 계약이며 ΔV4-A 정정은 Part II에 있다. ΔV5는 아래 신규 pair로 변경된 입력·손상 정책을 닫으며 기존 상위 S1 pair의 미충족 범위를 승계한다. 기준 V는 메타의 독립 V1 커밋이며 stable node·pair ID와 이전 oracle·선택 mutation을 보존한다.

### 이번 라운드 S1 잠금

| 항목 | 이번 구현에서 잠금 | 후속으로 남김 |
|---|---|---|
| 입력 | PST OS 선택과 정규화 EML 내부 배치 주입. EML 입력 GUI 없음 | PST 폴더 선택 UX 고도화 |
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
| AR-03 / IT-03 | AR / IT | 로컬/API port·자격증명 / adapter 계약·오류 통합 | CHANGED / V1 + §10·15. **SUPERSEDED → ΔV6 AR-03/IT-03** |
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

아래 registry는 V1·조사 보완의 경로를 보존한다. 임베딩의 API·vault 경로가 포함된 VP-04·11·15·21은 아래 ΔV6 행으로 supersede하며, 영향받는 상위 pair의 로컬 회귀도 ΔV6을 따른다. §10의 EP-07·19는 현재 로컬 계약으로 정정하고 EP-25를 추가한다.

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

### ΔV5 — 내부 배치·PST 보존·GUI 제거 설계

조사 기준은 공유 브랜치의 `49ec470d95907f9ec5e15b215a9c91d7b77571b5`이며 `git cat-file -t`로 commit을 확인했다. D-029~031의 사용자 답변을 반영했다. 이 경로는 PG-03의 메일 identity 전환과 독립이며 기존 key 알고리즘·DB migration을 바꾸지 않는다.

| 현재 코드·검증 seam | 관측 | 변경 설계 입력 |
|---|---|---|
| `service.ts`의 `onBatch`→`onComplete`→`verifyRevision`, `store.ts`의 `abortRevision` | 배치는 staging 저장. 완료 검증 뒤 공개하며 실패 staging의 occurrence와 고유 메일을 제거 | PST 경로 재사용. 오류 전 새 배치를 저장한 뒤 오류를 주입해 이전 snapshot·첨부 ID·성공 counter 불변 검사 |
| `batch-buffer.ts`와 `batch-buffer.test.ts`의 ACK 지연 케이스 | 기존 source reader는 저장 ACK까지 멈춤 | 내부 함수는 입력 한 배치 소비 Promise를 반환. 전처리기는 그 Promise를 보관하고 다음 배치 읽기를 진행한 뒤 ACK를 기다림 |
| `service.ts`의 `import`, `types.ts`의 `MailArchiveImportInput` | 내부 서비스도 파일·폴더 경로만 받음. 전처리 결과 함수 없음 | `importEmlBatch(items,onProgress?)` 추가. 기존 job lock·epoch·자료원별 staging/verify를 재사용 |
| `handlers/mail-archive.ts`→shared channel→preload→renderer API→`source-state.ts`→`MailArchiveSourceManager` | EML/PST 복수 파일 picker와 EML 폴더 picker가 설정에 연결됨 | EML folder channel·API·state 분기·버튼 제거. file picker는 PST 확장자만 허용하고 OS 반환 경로도 검사 |
| `archiveSourceId`·`archiveMailIdentityKey`·store occurrence/attachment | 자료원은 형식+원본 경로. identity payload와 표시 주소가 결합돼 있음 | 입력 UI 제거로 보관된 EML·ID를 삭제하거나 폴더 단위로 재작성하지 않음. PG-03은 별도 전환 oracle 필요 |

```text
전처리 child: 파일 읽기 → MIME/본문 전처리 → 정규화 items
    → main 내부 importEmlBatch → index worker → transaction/verify → Promise ACK
    └ 소비 Promise가 진행 중인 동안 다음 한 배치 파일 읽기 → ACK 대기
PST 설정 → 기존 picker capability → main job → source worker → index worker
```

`MailArchiveEmlBatchItem`은 `NormalizedArchiveMail`에서 `sourceKind/sourceId/identityKey`를 제외한 정규화 계약이다. 원본 canonical 절대 경로, 읽은 원본의 SHA-256 fingerprint, locator, 헤더·본문 선택/품질·첨부 manifest를 포함하며 첨부 바이트는 포함하지 않는다. 소비자는 sourceKind를 eml로 고정하고 D-026의 sourceId/identityKey를 계산해 caller가 내부 ID를 지정하지 못하게 한다.

`eml-batch.ts`는 Electron/SQLite를 import하지 않는 schema·예산·identity seam이다. 한 호출은 1~25개·serialized JSON UTF-8 4 MiB 이하, 본문+대체 본문 합은 2 MiB 이하이며 같은 원본 경로의 중복 item을 거절한다. 입력 전체를 검증한 뒤 job을 열고 기존 source/index job과 동시 호출은 `mail_import_already_running`으로 거절한다.

`service.ts`의 파일 가져오기와 내부 배치 함수는 하나의 job 루프를 사용한다. 정규화 입력에서는 source worker의 파일 재읽기·MIME 해석을 생략하고 index의 beginRevision→upsertBatch→verifyRevision을 실행한다. 완료 EML 파일은 보존하고 실패 입력은 staging abort 뒤 파일명·reason을 결과에 반환하며, Promise는 모든 해당 입력의 완료/실패·epoch 정리가 끝난 뒤 resolve한다.

취소·제거·종료의 sourceIds는 호출 입력에서 먼저 확정하므로 기존 경합 처리와 같다. 생산자는 전처리 중 AbortSignal을 관측하고 consumer의 실패·cancelled 결과를 받으면 다음 배치를 주입하지 않는다. 원본 읽기 일관성·full digest 계산은 전처리기가 보장하며, 소비자는 파일을 재읽지 않고 첨부 추출 시 기존 full fingerprint 재검증을 유지한다.

main은 정규화 DTO 검증·job 전달만 맡고 파일 읽기·MIME 파싱·DB는 D-012의 child에 둔다. 한 API 호출만 in-flight이며 생산자의 다음 배치 한 개를 합쳐 데이터 슬롯은 2개·직렬화 입력 최대 8 MiB다. 이 값은 입력 보유 예산이며 IPC 복사·DB cache를 포함한 RSS 상한이라고 주장하지 않는다.

내부 호출 예제는 실제 타입·서비스로 typecheck하고 실제 worker fixture에서 실행한다. `const committing = service.importEmlBatch(batch); const next = await preprocessor.readNextBatch(signal); await committing;` 순서로 소비 중 읽기를 관측하며, caller는 ACK 전 다음 `importEmlBatch`를 호출하지 않는다. 이 함수는 renderer/preload/도구 API에 등록하지 않는다.

| Node | 레벨 | 계약 | provenance / 기준 |
|---|---|---|---|
| R-09 / AT-25 | R / AT | AC1·2·3·19·23의 내부 주입·PST GUI·손상 보존 결과 | NEW / ΔV5. 기존 전체 AC를 축소하지 않음 |
| SD-05 / ST-05 | SD / ST | 소비 중 선행 읽기, ACK·취소·제거·재시작 | NEW / ΔV5 |
| AR-07 / IT-07 | AR / IT | 내부 normalized API→공통 job→index와 GUI picker 경계 | NEW / ΔV5 |
| MD-08 / UT-08 | MD / UT | 입력 shape·byte/count cap·consumer identity 및 PST rollback | NEW / ΔV5; D-026 key 알고리즘 유지 |

| Pair | left ↔ right | requiredness | production path | 직접 oracle / 선택 증거 | §10 자리 |
|---|---|---|---|---|---|
| VP-26 | R-09 ↔ AT-25 | REQUIRED | PST settings→picker→job→검색; 내부 EML→index→검색 | 실제 UI는 PST만 추가, 실제 내부 주입 메일·첨부 검색. M-EML-GUI: EP-23a에 EML 버튼 복원 시 UI 검사 red | EP-22(6)·23(6)·24(6) |
| VP-27 | SD-05 ↔ ST-05 | REQUIRED | 전처리 읽기→소비 Promise→ACK; cancel/remove/kill→재조회 | 저장을 보류해도 다음 파일 읽기 완료, 이른 두 번째 주입 거절, 취소·제거 뒤 late write 없음, reopen에서 이전 PST만 공개. 직접 oracle | EP-22(6)·24(6) |
| VP-28 | AR-07 ↔ IT-07 | REQUIRED | normalized input→job→index worker→DB; picker→capability | 실제 SQLite/worker의 검색 ID·counter·첨부 추출, EML 경로 picker 거절, 기존 private capability. 직접 oracle | EP-22(6)·23(6)·24(6) |
| VP-29 | MD-08 ↔ UT-08 | REQUIRED | items→schema/budget→source/mail identity; PST staged write→abort | 잘못된 fingerprint/path/date/byte/count·중복 경로 입력은 쓰기 전 거절. caller ID 없음, 동일 입력 재주입 ID 재사용. 직접 oracle | EP-22a·b·c·d(4)·24(6) |

기존 VP-01·07·08·09·13·14·17·18·23·24·25는 영향을 받는 S1 회귀다. 새 경로의 회귀는 실행하되 대표 ANSI/charset·PG-03·전체 설치본 등 기존 미충족이 남으면 해당 전체 pair를 SELF_PASS로 올리지 않는다. 기존 M-WIRE 설정 slot 제거 oracle은 유지하며 ΔV5는 EML GUI 복원 변이를 추가한다.

| 강제 지점 / 자리수 | 계약 | 운반 자리 전수 | 연결 pair | 실패 의미 |
|---|---|---|---|---|
| EP-22 / 6 | 내부 EML batch shape·ACK | a pure 입력 validator; b 서비스 공통 job lock/epoch/sourceIds; c normalized→index 전달; d index upsert/verify·완료 counter; e producer fixture의 소비 Promise/다음 읽기/ACK; f cancel/remove/close의 epoch·settled | VP-26~29 | raw data·위조 ID·무한 queue·이른 ACK·삭제 복원 |
| EP-23 / 6 | EML 입력 GUI 전체 제거 | a 설정 source manager; b source-state picker 분기; c renderer API; d preload API; e shared channel registry; f main picker handler·PST 경로 검사 | VP-26·28 | 버튼만 숨겼으나 renderer가 EML 경로를 여전히 등록 |
| EP-24 / 6 | 손상 PST 이전 verified 보존 | a PST walker 오류/개수 검사; b source child 오류 전달; c service abort; d store staging cleanup transaction; e verified-only 검색·상세·통계; f startup interrupted 복구 | VP-26~29 | 손상 revision 일부 공개·counter 성공 오인·기존 ID/첨부 삭제 |

자리 분모는 신규 18자리이며 기존 EP-21의 worker epoch·ACK 경계를 함께 회귀한다. 게이트는 schema/service/store/handler/source-state UT·IT, 실제 worker 내부 API/PST smoke, 실제 설정 UI·M-EML-GUI·기존 M-WIRE, subtree lint/typecheck, migration append-only·doc inventory·Vite build다. 원본 비복제·보관된 EML 데이터 불변·기존 attachments/relations/segments 회귀를 포함한다.

### ΔV6 경로·검증 정정 — S2 로컬 전용, DRAFT

기준은 ΔV5까지의 유효 V다. stable ID와 이전 oracle은 공유 브랜치 `18585e53`의 plan에 보존하며 아래 변경 행이 기존 임베딩 API 경로를 대체한다. 구현·실추론 PASS로 기록하지 않는다.

| node / pair | provenance / requiredness | production path / 직접 oracle | §10 자리 |
|---|---|---|---|
| R-04, AT-10~12 / VP-04 | CHANGED / REQUIRED | 로컬 팩 선택→profile schema→문서/질의 worker→staging/active→검색. 실 모델 오프라인 검색·세대 일치, `kind=api` 입력은 worker/저장 이전 거절, UI API 선택 없음 | EP-07(5)·08(4)·17(3)·19(4)·20(3)·25(5) |
| SD-03, ST-03 / VP-11 | CHANGED / REQUIRED | 로컬 팩 변경→새 generation→lease/취소→전환/GC. 모델 미설치·worker 종료에도 같은 필터의 키워드 검색과 이전 active 보존, 원격 fallback 0 | EP-07(5)·08(4)·19(4)·20(3)·25(5) |
| AR-03, IT-03 / VP-15 | CHANGED / REQUIRED | local-only DTO/IPC→bootstrap port→worker→vectors/DB. 문서 예제 실제 타입 대입, 실제 utility process 왕복, 예약 API 입력 거절·임베딩 transport 미주입 | EP-07(5)·08(4)·17(3)·19(4)·25(5) |
| MD-04, UT-04 / VP-21 | CHANGED / REQUIRED | 로컬 manifest→fingerprint/input budget→벡터 검증→cache. 잘못된 차원·NaN·순서·prefix·hash 거절, 같은 입력 hit/miss 결과 일치 | EP-07(5)·08(4)·17(3)·19(4)·20(3)·25a/d/e(3) |
| R-03·07·08, SD-01, AR-05, MD-06 / VP-03·07·08·09·17·23 | INHERITED / REGRESSION | 기존 키워드 결과/설정→로컬 색인·늦은 응답·restart→조회/설치본. 자료원 제거·취소의 DB/검색 집합, 기존 UI 상태·POP3·일반 채팅 불변 | 기존 pair 자리 + EP-25b/c/d/e(4) |

M-EMBED-API는 EP-25d의 로컬 실패 처리를 원격 임베딩 fallback으로 바꾸는 결함이다. 실패 상태에서도 키워드 검색 성공·임베딩 전송 0을 단언하므로 실제 전송 시 red여야 한다. S3의 기존 AI 답변 요청을 임베딩 요청으로 세거나 차단하지 않는다.

현재 변경 산출물의 gate는 Decision→AC→V/EP→기술 경로·plan/INDEX 교차 대조, 링크·표·UTF-8, doc-inventory·diff·trailer다. S2 구현 gate는 local-only schema/manifest/cache UT→실 worker·SQLite IT→취소/전환/restart ST→실 모델·UI·오프라인 설치본 AT, M-EMBED-API, lint/typecheck/build와 해당 기존 회귀다. 모델 팩·runtime·기준 PC를 닫기 전 S2는 DRAFT다.

### ΔV7 — S3-A 빌트인 MCP 노출 (2026-09-30, 등록 owner는 ΔV8로 대체)

판정은 **독립 경로 READY**다. D-034는 S3의 공개 표면을 빌트인 MCP Plugin으로 확정하며 D-003의 기존 채팅 환경은 같은 `RuntimeToolRegistry`를 소비한다. S2가 준비되기 전에도 S1 키워드 검색으로 도구를 제공하고 semantic 미구현을 응답에 표시한다.

| node | provenance / 계약 |
|---|---|
| R-10 / AT-26 | NEW / AC25 빌트인 MCP 노출·실제 세션 범위·실행 결과 |
| SD-06 / ST-06 | NEW / scope 설정/해제·세션/자료원 제거·취소·재시작 수명 |
| AR-08 / IT-08 | NEW / registry·SDK adapter·trusted IPC·index worker·Plugin UI 배선 |
| MD-09 / UT-09 | NEW / 도구 입력·scope 교집합·bounded context·연속 span·오류 |

| Pair | left ↔ right / requiredness | production path / 직접 oracle | §10 자리 / 선택 증거 |
|---|---|---|---|
| VP-30 | R-10 ↔ AT-26 / REQUIRED | Plugin 카드→대화/자료원 선택→MCP 검색/조회→메일 근거. 실제 result 본문·ID·출처, 범위 미지정/다른 세션의 거절 | EP-26(6)·27(7)·28(5); M-ARCHIVE-MCP: bootstrap의 실제 registry 등록을 제거하면 실행 검사 red |
| VP-31 | SD-06 ↔ ST-06 / REQUIRED | 허용→읽기 대기→scope 해제/세션·자료원 제거/취소→반환. late 반환·삭제 복원 0, reopen의 허용 scope·메일 버전 참조 유지 | EP-26(6)·27(7)·28(5); 직접 oracle |
| VP-32 | AR-08 ↔ IT-08 / REQUIRED | RuntimeToolServer→registry snapshot→Claude SDK handler→service/index SQLite→MCP content+structuredContent. cached handler identity·reader 무재실행·UI 호출 도달 확인 | EP-26(6)·27(7)·28(5); M-ARCHIVE-MCP 승계 |
| VP-33 | MD-09 ↔ UT-09 / REQUIRED | untrusted args→strict schema→trusted scope→SQL/paragraph packing→evidence. 정확 ID 집합·UTF-16 span·64 KiB·첨부 sentinel 제외·실패 isError | EP-26d/e(2)·27c/d/f(3)·28a/b(2); 직접 oracle |

영향받는 기존 R-06/08·AR-04·MD-05/06, VP-06·08·16·22·23은 REGRESSION이다. 기존 scope/evidence/tool 경로의 전체 pair 완료와 S3-A 직접 경로 완료를 구별하고 전자의 미구현을 숨기지 않는다. PG-03 identity 전환·S2·고급 quote fold/timeline 품질평가·MCP 첨부 Temp 추출은 다음 작업이며 기존 AC는 유지한다.

Technical Design: `features/plugins/mail-archive/tools.ts`가 `orca_mail_archive` 서버 한 인스턴스를 생성해 `archive_search`, `archive_get`, `archive_thread`, `archive_context`를 제공한다. Bootstrap의 전용 배선이 검색 가능한 verified 메일 유무로 registry add/remove하고 기존 Auth binding에 가짜 자격증명을 만들지 않는다. Plugin 카탈로그의 MCP 탭에는 도메인 중립 slot으로 로컬 Plugin 카드와 현재 저장된 대화의 자료원/날짜 허용 UI를 표시한다.

범위는 trusted 창 IPC와 실제 core session 존재 검사를 거쳐 archive DB에 저장한다. 모델 입력에는 sessionId/scope가 없고 `context.waitForSession(signal)`이 얻은 실제 세션의 sourceIds/날짜와 좁히기 filter만 SQL 후보 조회 전에 교집합한다. 자료원 이름·위치도 허용 occurrence에서 읽고 get/thread/근거 resolve에 같은 predicate를 적용하며 제거·범위 변경 후 반환 직전 revision/세션/취소를 다시 확인한다.

근거는 기존 불변 mail ID를 본문 version으로 쓰고 연속 UTF-16 start/end·sessionId/runId와 함께 index DB에 반환 전 저장한다. 출처는 opaque evidence ID이며 같은 실제 세션의 허용된 메일만 resolve하고 마지막 occurrence 제거는 내용 없는 tombstone으로 처리한다. 두 Markdown 경로는 도메인 중립 internal-link callback을 소비하고 app이 근거 viewer를 주입해 보관 본문·강조 범위·포커스 복귀를 제공한다.

게이트: strict args/paragraph/scope UT→SQLite/실 tool/IPC/registry/adapter IT→late 결과·reopen·session/source 제거 ST→실 Electron worker·Plugin UI AT, M-ARCHIVE-MCP. app lint/typecheck·변경 관련 Vitest와 기존 MIME/보관함/registry/adapter 회귀, migration append-only·doc inventory·Vite build를 수행한다. 실제 사내/Bedrock 답변 품질과 설치본 smoke는 기존 AC18/24의 미완료로 보존한다.

### ΔV8 — Plugin 등록 owner 정정 (2026-09-30, READY)

판정은 **READY**다. D-035는 MCP 공개 계약을 유지하며 등록 owner만 사용자 Deployment로 확정했다. `app/deployment/` 파일·`PluginDeploymentDeps`를 수정하거나 로컬 service를 그 계약에 주입하지 않는다. Bootstrap은 기존 PST GUI/내부 EML API를 위한 service와 trusted IPC 수명을 연결하고 RuntimeToolRegistry에 메일 서버를 add/remove하지 않는다.

도구 진입점 `features/plugins/mail-archive/plugin.ts:createMailArchiveToolServer()`는 다른 Plugin 도구처럼 표준 `RuntimeToolServer`를 반환한다. 팩터리는 초기 DB 부팅 전에 호출 가능하고 handler는 Bootstrap에서 설치한 단일 로컬 backend에 지연 연결한다. backend 설치/해제는 명시적 수명 포트이며 호출 전에 준비되지 않았으면 `isError: true`로 실패한다. 배포가 sync마다 팩터리를 재호출하지 않고 반환 인스턴스를 보존한다. 별도 Auth 자격증명을 합성하지 않는다.

Product/UX: 기본 Deployment가 등록하지 않은 현재 빌드의 Plugin 카드에는 AI 도구 비활성 상태를 표시한다. 자료원/세션 scope 관리는 가능하며 실제 등록 후 같은 카드와 근거 열람을 사용한다. 자료원 제거는 등록 상태를 자동 변경하지 않고 scoped read/evidence만 무효화한다. 빈 결과는 빈 집합과 부족한 근거로 명시한다.

| 기존 node/pair | ΔV8 requiredness / 변경 경로·oracle |
|---|---|
| R-10/AT-26 · VP-30 | REQUIRED / 실제 공개 팩터리를 배포 역할의 fixture에서 registry에 등록→SDK handler→worker→출처. 현재 기본 빌드는 미등록 표시. `M-ARCHIVE-FACTORY`: 공개 팩터리가 빈 서버를 반환하면 실행 oracle red |
| SD-06/ST-06 · VP-31 | REQUIRED / backend 준비/종료·scope/revoke·세션/자료원 제거·late/reopen. 배포 등록 수명과 자료원 수명을 분리 |
| AR-08/IT-08 · VP-32 | REQUIRED / Bootstrap backend/IPC 설치→공개 팩터리→사용자 등록 registry→SDK. M-ARCHIVE-FACTORY 승계. 자동 등록 없음은 실제 기본 registry snapshot으로 확인 |
| MD-09/UT-09 · VP-33 | REQUIRED / strict args·실세션 scope·SQL 교집합·persisted UTF-16·64 KiB 계약 승계 |

ΔV7의 `M-ARCHIVE-MCP`(Bootstrap 등록 제거)는 등록 자체가 금지되어 적용 종료이며 `M-ARCHIVE-FACTORY`로 대체한다. 기존 VP-06·08·16·22·23 REGRESSION, EP-27/28, AC 총수 25, 운영 gate는 승계한다. 현재 체크아웃에서 사용자 배포를 대신 작성하지 않으며 배포 후 사내/Bedrock 실 답변·설치본 검증은 미완료로 남긴다. READY self-review: 현재 `createPluginBindings()`는 빈 배열이며 Bootstrap은 이를 호출해 표준 registry를 전달한다. 공개 팩터리와 backend 수명 포트로 이 계약을 확장하지 않고 연결할 수 있다.

### ΔV4-A 경로·검증 정정

기준은 공유 브랜치의 r1.4 산출과 ΔV3이며 stable pair ID를 유지한다. 아래는 독립 경로의 추가 oracle이고 기존 pair 전체 완료 조건을 대체하지 않는다. 나머지 S1 pair는 기존 미충족/회귀 계약을 유지한다.

| node / 기존 pair | 이번 상태·requiredness | 추가 경로 / 직접 oracle | §10 자리·적대 증거 |
|---|---|---|---|
| R-01/R-08, AR-01, MD-06 / VP-01·08·13·23 | CHANGED / REQUIRED, 기존 소비 회귀 포함 | app slot→settings/source state→IPC→페이지. 설정 진입·추가/실패/제거·뒤늦은 상태 응답을 실제 store/렌더 경로로 단언 | EP-01 a~d. M-WIRE는 app의 설정 slot 제거 시 렌더 검사 실패 |
| R-03, MD-02 / VP-03·19 | CHANGED / REQUIRED | 입력→순수 request 변환→schema→index/store→결과. 경계 날짜/null·각 필드·같은 occurrence의 source/folder AND·LIKE literal을 실제 SQLite ID 집합으로 단언 | EP-05 a·b, EP-18 a. 직접 oracle |
| R-02, AR-02, MD-01 / VP-02·14·18 | CHANGED / REQUIRED | classifier→새 insert/기존 projection→DB→get→뷰어. UTF-16/CRLF/인라인 답변 재결합·이전 ID/첨부 불변·검색 hit 구간 펼침 확인 | EP-03 d, EP-16 a·b·d. 직접 oracle |

Technical Design: `shared/mail-archive.ts`에 검색 필드·구간 DTO를 추가하고 기존 search/get 채널을 사용한다. `search-request.ts`(renderer)는 로컬 날짜→epoch를 검증하고, SQL은 parameter binding으로 필터를 결합한다. 폴더·자료원 조건은 하나의 verified occurrence EXISTS 안에서 평가한다.

자료원 상태는 mail-archive feature의 주입 가능한 store가 소유하고 설정/페이지에서 공유한다. settings는 mail feature를 import하지 않고 app의 ReactNode slot을 받으며 `AppSettingsTab`·오류 목적지 allowlist·i18n·페이지 callback을 함께 연결한다. 늦은 refresh 결과는 세대 번호로 버리고 가져오기 완료/자료원 제거 뒤 공유 revision을 갱신한다.

`segment-classifier.ts`는 Electron/DB를 import하지 않는다. 새 `archive_body_segment` projection은 메일 ID+ordinal·start/end·kind·ruleId·classifierRevision이며 삭제는 mail FK cascade다. 저장은 mail insert와 같은 transaction, 기존 행 backfill도 index worker의 transaction으로 완료한다. 실패/재시작은 이전 본문을 유지하고 projection을 재시도한다. HTML 구조를 이미 잃은 snapshot은 추측하지 않고 unknown으로 남긴다.

Gate: subtree lint/typecheck, classifier/request/source-state UT, SQLite filter·projection IT, 기존 reader/identity/service 회귀, 설정 렌더/오류 목적지 검사, migration append-only·doc inventory·Vite build. D-012 worker smoke는 DTO/DB 경계 회귀로 실행한다. UI 시각은 실제 창 또는 합성 renderer에서 별도 확인하며 정적 검사로 대체하지 않는다.

READY self-review 관측: 기존 설정은 `general/usage/provider:*`이고 app의 `SidebarUserButton`이 SettingsModal을 조립한다. search는 기존 shared→preload→handler→index→store 한 경로이며 날짜/폴더 조건은 아직 없다. body_text와 기존 mail/attachment PK를 유지하는 additive projection이라 PG-03의 identity 전환과 독립이다. PG-01/02에 대한 무응답을 승인으로 해석하지 않는다.


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

외부 문서 열람과 npm 메타데이터 확인은 호환성 실증이 아니다. ANSI/Unicode PST와 로컬 모델 팩은 S0에서 별도 확인하며 임베딩 API 실증은 reserved다.

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
                       ├ OS 경로 capability / session scope / 취소
                       ├ index utility process: SQLite sole writer + 조회·job journal
                       ├ source utility process: EML/PST 파싱·원본 검증·선택 추출
                       └ embedding utility process: 로컬 추론·블록별 cosine 계산
                                 로컬 모델 팩만 실행; 임베딩 API는 reserved
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

로컬 임베딩 worker 포트는 bootstrap이 주입하며 임베딩 HTTP transport·secret resolver는 주입하지 않는다. feature가 다른 feature의 인증/채팅 구현을 직접 import하지 않고 필요한 구조적 포트는 contracts 계층에 둔다. S3는 기존 runtime tool 경계를 사용한다.

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

PST 한 revision의 완료 여부를 숨기지 않는다. 정상 순회와 시작/완료 fingerprint 검증 뒤 revision 전체를 공개한다. 손상·취소·원본 변경·child 종료에서는 이번 PST staging을 전부 제외하고 이전 완료·검증 이력을 유지한다.

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

본문 공간이 `min(256,B-P)`보다 작으면 optional metadata부터 제거한다. `B≤P` 또는 tokenizer 누락은 로컬 모델 팩 설정 오류로 처리한다. 모델 팩 tokenizer/token budget 실증은 D-015 완료 조건이다.

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

FTS 0건이면 hybrid의 같은 범위 로컬 semantic 결과를 별도 이유와 함께 반환한다. lexical-only 요청은 로컬 임베딩을 자동 실행하지 않으며 vector 후보가 있다는 이유만으로 “근거 충분”을 표시하지 않는다.

### 시간과 질의 처리

기본 `관련도`는 나이 감쇠 1.0이다. `최신순`은 사용자 선택 정렬이고, “최종 승인”은 모든 최신 메일에 점수를 더하는 문제가 아니라 확인된 승인/변경 근거를 시간순으로 비교하는 문제로 처리한다.

첫 기준은 사용자가 입력한 query 한 개만 FTS5와 vector 검색에 보낸다. LLM 질의 재작성·동의어 확장·reranker는 실행하지 않아 호출 수·대기 시간·검색 설명을 단순화한다. 질문이 여러 하위 쟁점을 담으면 답변 도구가 근거 부족을 표시하고, 사용자가 질문을 좁히거나 추가 검색을 시작한다.

### Context 확장

상위 seed chunk의 앞뒤 1개를 **같은 version·같은 본문 variant·같은 scope**에서 확장한다. 6 seed면 최대 18 chunk이며 겹치는 span을 합친 뒤 §14의 24메일·64 KiB context cap을 적용한다.

스레드 앞뒤 확장과 이웃 chunk 확장은 별도 단계다. 중복 인용을 접어 확보한 예산은 누락 부모·상충 조건·최종 확인된 이벤트에 배정하며 오래된 최초 요청을 일괄 버리지 않는다.

인용은 실제 snapshot의 연속 범위를 가리킨다. optional embedding metadata를 본문 인용 offset으로 취급하거나 사후 의미 유사도만으로 답변 문장에 출처를 자동 조작하지 않는다.

### 임베딩 계약

```ts
type EmbeddingProfile = {
  kind: 'local'; modelPackId: string; fingerprint: string
}
// API embedding is reserved for a future contract revision.

interface EmbeddingPort {
  embed(input: {
    generationId: string; purpose: 'document' | 'query';
    texts: readonly string[]; signal: AbortSignal
  }): Promise<{ fingerprint: string; vectors: readonly Float32Array[] }>
}
```

fingerprint는 로컬 모델 파일/revision·차원·tokenizer·pooling·query/document prefix·정규화·chunker 버전을 포함한다. 같은 모델명이라도 이 값이 다르면 새 generation이며 기존 vector와 혼합하지 않는다.

로컬 모델 팩은 manifest·ONNX 파일·tokenizer.json·tokenizer_config.json·해시·라이선스·golden input을 포함한다. 자동 인터넷 다운로드 없이 사용자 선택 디렉터리에서 검증·등록하며 모델 계약보다 긴 입력은 모델 규약에 맞춰 chunk한다.

로컬 worker 응답은 입력별 index·개수·차원·유한수·nonzero norm·fingerprint를 검사하고 query와 document 용도 차이를 누락하지 않는다. API는 reserved이므로 `kind: 'api'`는 현재 profile schema·설정 IPC에서 거절한다. endpoint/auth/adapter 프로토콜은 향후 별도 결정 후 계약을 추가한다.

vector 저장·검색의 첫 기준은 `canonical float32 BLOB + worker exact cosine scan` 한 가지다. 스캔 전에 archive scope를 적용하고 결과는 chunk ID와 거리로 반환한다. 전역 검색 후 필터링이나 모델이 만든 SQL·ID 목록은 허용하지 않는다. 벡터는 archive DB에 저장하고 원문 chunk ID·generation·dimension을 함께 검증한다.

별도 vector extension, ANN, 차원별 virtual table, 파생 인덱스 쓰기/복구 경로는 첫 기준에서 제외한다. sqlite-vec는 pre-v1이며 breaking changes를 예고하므로 경량 기준에 넣지 않는다. exact scan이 기준 PC에서 사용자 체감 목표를 넘을 때만 같은 vector·scope로 대체 엔진을 재설계한다. 모델/tokenizer/prompt/chunker 변경은 재임베딩이며 엔진 변경은 같은 vector의 재색인이라는 구분은 유지한다.

### 임베딩 프로필 후보

| 경로 | 첫 기준 후보 | S0에서 닫을 내용 |
|---|---|---|
| 로컬 | `intfloat/multilingual-e5-small`, 384d; `@huggingface/transformers` 로컬 ONNX/WASM 실행 | 고정 revision·tokenizer·prefix·pooling·normalization, 로컬 파일 전용 실행, WASM 포함 설치본 크기·Windows CPU RSS/p95, golden vector와 양자화 팩 비교 |
| API — reserved | 확장 가능성만 예약. 현재 활성 profile·UI·adapter·endpoint·자격증명 없음 | S0/S2 결정·실증·완료 조건에서 제외. 향후 별도 계약 필요 |

한 보관함은 로컬 임베딩 프로필 하나를 활성화한다. profile 변경 시 설정 화면에서 재색인 대상 메일 수·예상 저장 공간·검색 제한을 알리고 새 generation 준비 후 전환한다. 모델 미설치·추론 실패는 키워드 검색으로 표시하며 임베딩 원격 대체는 제공하지 않는다.

E5 실행은 query에 `query: `, 메일 chunk에 `passage: `를 붙이고 attention-mask average pooling과 L2 normalization을 적용한다. 입력 512 token을 넘으면 silent truncation 대신 chunking 규칙으로 나눈다. 양자화 pack은 기준 모델 golden vector의 허용 오차·검색 순위 회귀를 통과하고, 파일 hash·모델 출처·라이선스를 manifest에 고정한 뒤 설치 선택지에 노출한다.

### IPC·도구·출처 계약

`app/src/shared/mail-archive.ts`를 DTO·오류 code·enum의 SSOT로 둔다. Renderer의 원본 파일 경로·DB path·API credential은 입력 스키마에 없고 모든 source/attachment/evidence ID는 service에서 재검증한다.

| 표면 | 제안 계약 | 결과/오류 |
|---|---|---|
| 관리 IPC | `orca:archive:pick-source`, `sources`, `start-import`, `cancel-job`, `retry-job`, `relink-source`, `remove-source` | typed source/job summary, 원본 경로는 main 소유 |
| 조회 IPC | `search`, `get-mail`, `get-thread`, `resolve-evidence`, `export-attachment` (모두 `orca:archive:` prefix) | paged DTO, 스냅샷·coverage·scope, export는 선택 행에서만 |
| 설정/범위 IPC | `profiles`, `configure-profile`, `rebuild-embeddings`, `set-session-scope` | 임베딩 profile은 local-only, endpoint/secret 입력 없음; scope는 UI가 지정 |
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
| EP-07 / 5 | 로컬 EmbeddingPort·fingerprint | a local profile/model pack 검증; b document chunk 호출; c query 호출; d local worker 응답 검증; e vector write | VP-04·11·15·21 (ΔV6) | query/doc 불일치·모델 혼합·손상 vector |
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
| EP-19 / 4 | cache epoch/scheduler | a cache key/get; b local scheduler·subscriber 취소; c epoch 검증 후 cache put; d scope/profile/remove/session 정리 | VP-04·VP-06·VP-07·VP-09·VP-11·VP-12·VP-15·VP-21·VP-22·VP-23 | 두 subscriber·로컬 worker/profile epoch 변경·late reply. 취소 전파/삭제 자료 부활 |
| EP-20 / 3 | scoped exact vector scan | a dimension/fingerprint validation on write; b filter-first BLOB scan and cosine ranking; c generation swap·삭제·재시작 | VP-04·VP-06·VP-07·VP-08·VP-09·VP-11·VP-14·VP-17·VP-21·VP-22 | reference cosine·scope·dimension mismatch·reopen. 잘못된 결과/범위 유출 |
| EP-21 / 9 | D-012 worker boundary·source revision protocol | a main이 DB 경로로 index utility process 시작; b index가 migration/DB를 열고 ready 회신; c main이 picker capability로 확인한 파일만 source worker에 전달; d source worker가 시작 fingerprint·reader를 실행; e 최대 25개 DTO batch를 보내고 ack까지 대기; f main이 jobId/epoch를 확인해 batch 전달; g index가 epoch 확인 후 transaction commit·ack; h source 완료 fingerprint와 index revision verify를 대조; i cancel/exit/shutdown이 epoch를 폐기하고 늦은 batch·revision 승격을 거절 | VP-01·VP-07·VP-09·VP-13·VP-14·VP-17·VP-23·VP-24·VP-25 | main event loop 정체·무한 큐·취소 후 commit·stale revision 활성화·잘못된 counter |
| EP-25 / 5 | D-033 로컬 전용·임베딩 API reserved | a shared profile schema/IPC가 local만 수용; b settings local 팩 선택·상태; c bootstrap embedding port는 local worker만 주입; d document/query scheduler·실패 분기는 local 또는 키워드 검색; e worker는 등록 로컬 파일만 로드·추론 | VP-04·11·15·21 (ΔV6), 상위 회귀 | API 활성화·자격증명/HTTP 요청·원격 모델 자동 로드·원격 fallback |
| EP-26 / 6 | D-034/035 표준 Plugin 도구 | a 공개 팩터리/server 1회 생성; b Bootstrap backend 준비/해제·자동 등록 없음; c 사용자 등록 registry→harness snapshot; d 도구 declaration/strict input·readOnlyHint; e context session/signal→handler; f Plugin MCP slot/미등록 표시·관리 목적지 | VP-30~33 | 빈 서버·자동 등록·EML 내부 주입의 모델 노출·가짜 Auth |
| EP-27 / 7 | session scope·revoke | a UI 대화·sourceIds/날짜 선택; b trusted IPC/core session 검증; c index DB scope 저장/lease; d SQL candidate 이전의 scope 교집합; e get/thread/resolve 동일 predicate; f 반환 직전 signal/revision/session 검사; g session/source 제거·restart 정리 | VP-30~33 | 다른 자료원/세션 노출·필터 후 limit 누락·late 반환 |
| EP-28 / 5 | bounded evidence·출처 | a 연속 UTF-16 span/64 KiB pack; b index evidence persist-before-return; c 세션/허용 occurrence resolve·tombstone; d completed/streaming Markdown internal callback; e viewer 본문 강조·닫기 포커스 | VP-30~33 | 조작 출처·현재 본문으로 옛 근거 변경·첨부 혼입·클릭 단절 |

동일 필터는 `scope.ts`가 SQL 조건·in-memory predicate를 생성하도록 하고 각 경로의 결과 집합을 같은 fixture로 비교한다. EP-10의 다양한 경로에서 조건문을 독립 복제하지 않는다.

첨부 본문 제외에는 EP-15a의 옵션 제거 mutation **M-NESTED**를 등록하고 sentinel payload 검사에서 실패해야 한다. cache 참조/invalidations와 scoped vector scan은 직접 행동 oracle로 검증하며 구조적 호출 횟수만으로 안전을 주장하지 않는다.

M-SCOPE의 전수 범위에는 새 EP-16c(quote fold), EP-18c(neighbor 확장), EP-19a/c(cache key·put), EP-20b(scope 적용 scan)가 추가된다. 각 자리에서 다른 scope의 자료가 섞이도록 결함을 심고 사용자 반환 집합·출처·cache 소유 상태로 검출한다.

## 11. 구현 설계

### 진행 단위

| 단계 | 결과 | 종료 조건 / 이 계획 AC |
|---|---|---|
| S0 — S2·S3 실증·결정 | 로컬 모델 팩/runtime와 기준 PC 보고서, 후속 신규 의존성·정확 버전 | D-015~D-016 closed, D-033 경량 기준 실현 가능성 확인 후 S2/S3 READY로 승격. 임베딩 API reserved |
| S1 — 보관·정확검색 (이번 라운드) | PST 자료원 UI, EML 내부 배치 API, EML/PST reader, worker DB, 메타데이터/본문/파일명 검색·열람·선택 추출 | AC1~7·9·17·19~23의 S1 pair. ΔV5 입력·손상 경로 READY; PG-03은 별도 설계. 의미검색 미설정은 정상 동작 |
| S2 — 로컬 임베딩 | 로컬 프로필, chunk/vector, generation, hybrid UI. 임베딩 API reserved | AC8·10~12·19·20·24의 ΔV6 pair; 로컬 실추론·오프라인 검색·예약 API 비활성 확인 |
| S3 — 이력 답변·근거 UX | scope, context 도구, 기존 두 AI 경로, source card/인용 viewer | AC13~16·18·21~24, 나머지 유효 pair와 운영 gate 전부 |
| S3-A — 빌트인 MCP (ΔV7 READY) | 키워드 archive 검색/조회/관계/context 도구, Plugin 노출·세션 scope·보관 버전 출처 | AC25·VP-30~33와 해당 기존 회귀. 실모델·PG-03·전체 이력 품질/설치본은 별도 미완료 |

S1~S3를 별도 구현 PR로 나누되 동일 유효 V의 단계 완료와 전체 완료를 구별한다. 이번 PR은 S1만 다루며 S2·S3는 구현 완료로 보고하지 않는다.

| S0 결정 | 수행할 실증 | 선택 조건 / 실패 시 대안 |
|---|---|---|
| D-014 PST 후보 | `pst-extractor@1.12.0`을 별도 승인된 spike 환경에서 ANSI/Unicode·한국어·HTML/RTF·폴더·첨부·손상 fixture로 검증 | 원문/관계/첨부 field golden 비교, 해제·취소·메모리 확인. 실패 시 libpff sidecar의 Windows 배포·라이선스 비교 후 결정 |
| D-014·15 로컬 후보 | `@huggingface/transformers`의 local ONNX/WASM과 multilingual-e5-small 384d 팩 한 개만 검증 | 기준 모델 golden vectors·검색 회수율·설치본 크기·CPU/RSS·라이선스·오프라인 실행. 추가 모델/런타임은 첫 기준에서 보류 |
| D-033 API reserved | 이번 S0/S2에서 endpoint·auth·protocol 조사/구현을 요구하지 않음 | local-only schema·UI·composition·worker 실행의 예약 경계는 AC11로 확인 |
| D-016 성능 | 대표 PC 사양·자료량·본문 길이/언어 분포를 기록하고 실제 자료량과 1만 메일에서 §14 측정. 실제 archive가 1만을 넘으면 5만을 추가 | 제품 SLA 새로 확정하지 않고 예산 조정 근거 보고. exact cosine이 느리면 ANN 선택은 후속 결정으로 분리 |

### S1 revision·worker 사용자 관측

같은 PST를 다시 추가하면 보관 중인 자료원으로 인식한다. 원본 전체 fingerprint가 바뀌지 않으면 다시 파싱하지 않고 기존 메일 수를 `이미 보관`으로 보고한다. fingerprint가 바뀌면 `새 revision 확인 중` 상태에서 기존 결과를 계속 검색할 수 있게 하고, source child가 파일 처음과 끝의 SHA-256 일치를 확인한 뒤 index child가 새 revision을 활성화한다. 그 과정에서 기존 identity는 skip, 새 identity는 추가, 같은 Message-ID의 바뀐 payload는 별도 결과로 보존한다.

취소 전 확정된 EML 파일은 유지한다. PST는 한 파일이 하나의 revision이므로 취소·원본 변경·child 오류 중 새 staging 결과를 검색하지 않고 기존 검증 revision을 유지한다. 결과 요약은 `새로 저장 n개 · 이미 보관 n개 · 실패 n개`를 함께 보여준다. `서버 이전` 같은 2자 검색어가 포함되면 모든 공백 term을 각각 LIKE 조회하고 term 간 AND를 적용한다. `%`와 `_`는 literal로 escape해 검색한다.

패키지 설치나 사내 자료의 저장소 반입은 이 문서 PR에서 수행하지 않는다. 실메일 대신 합성 fixture를 커밋하고, 실환경 검증 결과에는 메일 본문·주소·자격증명을 남기지 않는다.

S1에는 MIME 선택·품질 표시·가역 segment·필드 검색, S2에는 로컬 profile과 cache·generation 전환, S3에는 quote fold·주변 context·결과 이유·출처 UX를 배치한다. 임베딩 API는 reserved며 전 단계를 통과하기 전 전체 기능 완료로 보고하지 않는다.

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
| `main/features/plugins/mail-archive/embedding/{local,embedding-worker}.ts` | local inference·vector scan. API adapter는 reserved | golden vectors·오프라인 worker·reserved 입력 거절 |
| `main/features/plugins/mail-content.ts` | 기존 MIME/inline 판정 공통부 추출 후보 | 기존 EUC-KR·첨부 분류 그대로 실행 |
| `main/contracts/mail-archive.ts` | composition이 주입할 scope/session/local embedding worker 포트 | feature 간 import 없이 fake 주입 |
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

S3의 “사내서버·Claude 연동”은 사용자가 선택한 기존 채팅 모델이 archive 읽기 도구를 호출해 선택 범위의 관련 메일 문단으로 경위·승인·변경을 답하는 동작이다. 검색·근거 선택은 로컬 archive에서 수행하고 bounded 도구 결과를 현재 채팅 AI 실행 경로에 전달한다. 답변의 출처는 보관된 메일 버전/문단으로 열며, 새로운 메일 서버 연결이나 임베딩 API를 구성하는 단계가 아니다.

임베딩은 `worker가 chunk job 생성 → local worker → 응답 검증 → staging vector 저장 → corpus coverage 확인 → active 포인터 전환`이다. profile을 저장하는 것과 해당 모델 검색이 준비된 것을 같은 성공 상태로 표시하지 않는다.

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

ΔV5의 PST 보존 시점·EML 입력은 D-029·030을 따른다. 아래 source worker 순서는 PST와 내부 파일 reader의 기준이며 정규화 EML 주입은 Part II의 ΔV5 공통 job→index 경로를 따른다.

작업 상태는 `queued → scanning → importing → completed | partial | cancelled | failed`이며 재시작 복구는 `interrupted`이다. source health(`available/missing/changed`)와 embedding state(`not-configured/building/ready/degraded`)는 별도 축이다. main은 index utility process를 앱 수명 동안 유지하고 source utility process는 가져오기 작업 동안만 유지한다. 둘 다 Electron `utilityProcess.fork`로 실행하며 electron-vite `?modulePath` entry를 패키징한다.

main cancel은 해당 job epoch를 먼저 폐기하고 source worker에 취소를 보낸다. source worker는 25개 이내의 정규화 batch를 보내고 매 batch마다 index ack를 기다려 메모리 queue를 제한한다. index worker는 batch commit 직전 epoch를 확인한다. EML은 완료 파일 단위로 revision을 verify하고, PST는 시작/완료 full fingerprint가 같을 때만 새 revision을 verify한다. PST 취소·hash mismatch·child exit는 staging revision을 검색에서 제외하고 이전 검증 revision을 유지한다. worker가 응답하지 않으면 main은 해당 child를 종료하고 다음 조회는 기존 검증 데이터로 계속한다.

앱 종료는 신규 작업 차단→in-flight 취소→index RPC로 DB close→source/index child 정리 순서다. 강제 종료에서는 SQLite WAL 복구 뒤 staging revision을 interrupted로 남기고 마지막 verified revision만 검색한다.

### 세대·프로필 전환

로컬 profile 생성 → staging generation → 모든 대상 version의 성공/명시 제외 기록 → DB transaction으로 active 변경 순서다. 모델 팩 미설치·worker 종료는 embedding_unavailable, manifest/벡터 형상 오류는 profile_error로 구분하며 기존 active를 파괴하지 않는다.

색인 중 추가 메일은 corpusRevision별 delta로 처리한다. generation 전환 transaction은 대상 revision 커버리지를 확인하고 이후 revision 메일은 의미검색 준비율에서 제외한다; 키워드 검색은 계속 가능하다.

검색 시작 시 generation lease를 잡아 query embedding·vector 검색·결과 구성까지 같은 fingerprint를 쓴다. 구세대는 lease가 끝난 뒤 GC하며 로컬 팩 변경/삭제가 사용 중인 세대의 query 실행 파일을 먼저 제거하지 않는다.

### 다중 저장소 쓰기·삭제 경합

| 작업 / 쓰기 순서 | 중간 실패·크래시 때 관측 | 수습 / 허용하지 않는 조합 |
|---|---|---|
| 로컬 팩 manifest/파일 검증 → profile DB transaction → 이전 팩 lease 정리 | DB 실패 시 새 등록 정보 미공개, 이전 profile 정상 | 사용 중인 팩 보존; 파일 없는 팩을 가리키는 활성 profile 금지 |
| 로컬 계산 → staging vector DB → active pointer DB | 계산 후 죽으면 재계산 가능, active는 이전 세대 | idempotent chunk key; 무한 재시도 금지 |
| 원본 hash→parse→revision 검증→index commit | 원본이 바뀌면 새 revision 실패/비활성 | stat만 같아 통과 금지; 이전 검증 snapshot 유지 |
| 임시 추출 stage → revision 확인 → final rename | stage 잔류 또는 응답 전 성공 파일 존재 | stage만 정리, export receipt로 파일 결과 조회; 사용자 파일을 rollback으로 삭제하지 않음 |
| evidence DB commit → tool result → 채팅 저장 | 답변 저장 실패 시 고아 evidence 가능 | 본문 버전 참조 유지/정리; 미저장 evidence ID 반환 금지 |
| remove 요청→main revoke/abort→DB occurrence/payload purge→완료 event | 중단 시 source 상태 removing, 읽기 거절 | 재시작 purge 재개, source epoch 다른 늦은 결과 폐기 |
| plan 상태 → handoff INDEX 상태 | 서로 다르면 다음 주체 오판 | 문서 같은 커밋·G-DOC 교차검사 |

source 제거는 그 occurrence만 지우고 다른 자료원에서 같은 version을 참조하면 보존한다. 마지막 occurrence가 제거되면 텍스트·FTS·vector·관련 evidence payload를 지우고 evidence ID에는 내용 없는 tombstone만 남긴다.

범위·출처·추출의 응답 직전에 source revision/revoke를 다시 검사한다. 이미 전달된 도구 텍스트와 채팅 답변의 복사본은 소급 회수할 수 없으므로 제거 확인에 “이전 대화 내용은 남습니다”를 표시하고, 열려 있는 근거 뷰어는 제거 상태로 전환한다.

### 임베딩 캐시와 작업 스케줄링

query embedding cache는 프로세스 메모리에만 두고 TTL 15분, LRU 최대 256 entry를 초기 예산으로 둔다. key는 로컬 profile fingerprint·purpose=query·최종 query bytes hash·session/scope revision·worker/profile epoch이며 원문 query를 로그에 남기지 않는다.

동일 key의 동시 요청은 계산을 공유하되 취소는 subscriber별로 처리한다. subscriber가 모두 사라지면 underlying 작업을 abort하고 실패/취소/timeout 응답은 성공 캐시에 넣지 않는다.

profile/generation 전환·scope 변경·source 제거·session 삭제는 관련 epoch를 올리고 entry·in-flight를 무효화한다. 응답 직전 epoch를 재검사하므로 늦은 로컬 worker 응답이 캐시나 삭제된 vector를 되살리지 못한다.

document embedding 재사용은 canonical vector와 참조 chunk 관계를 저장한다. 마지막 chunk 참조 제거 때 vector와 cache를 함께 정리하며, 출처가 다른 메일의 존재/삭제는 각 occurrence/version이 결정한다.

로컬 embedding worker는 query 우선 큐를 두고 문서 microbatch 사이에 양보한다. 실행 중인 모델 추론을 즉시 선점할 수 있다고 가정하지 않으며 문서 microbatch 초기 상한 8, 실제 취소 응답·query p95로 크기를 조정한다.

S2의 query cache miss는 단일 query 하나를 로컬 worker에 전달하고 다음 microbatch 경계에서 query에 우선권을 준다. 임베딩 원격 요청 수는 0이며 API batching·동시 HTTP 요청·원격 retry 예산은 reserved다. 기존 채팅 AI 요청 수는 S3의 harness가 관리한다.

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
| 로컬 embedding microbatch | 초기 최대 8텍스트, 모델 token/byte 제한 중 더 작은 값 | 분할·query 우선 양보, 텍스트 무음 절단 금지 |
| 임베딩 API — reserved | 활성 endpoint·HTTP 요청 0 | 현재 API timeout/retry 예산·실증 없음. 향후 별도 계약 |
| vector 블록 | 16 MiB resident float buffer, dimension 1~4096 | block scan·차원 거절; 전체 vector를 main 메모리에 적재 안 함 |
| 실측 목표 | 대표 자료량과 1만 메일에서 p50/p95, 취소 ack 1초 목표, UI long task·peak RSS 기록; 실제 archive가 1만을 넘으면 5만 추가 | 실패 시 예산·worker 분할을 정정하고 ANN은 후속 설계로 분리 |

본문 24×1,500=36,000 UTF-16 units는 UTF-8 64 KiB보다 클 수 있으므로 **직렬화 바이트 cap을 마지막으로 적용**한다. 글자 수를 토큰 수라고 가정하지 않고, harness가 제공하는 컨텍스트 제한이 더 작으면 반환 예산을 낮춘다.

embedding 텍스트 수 C는 chunker가 결정한다. 로컬 문서 추론 batch 수는 `ceil(C/B)`, B는 모델 팩 한도와 microbatch 8 중 작은 값이다. 질의 cache miss는 query 1개를 계산하며 S2의 임베딩 HTTP 요청 수는 문서/질의 모두 0이다.

기준 E5-small 384차원 기준으로 1만 메일×평균 4chunk×4byte는 vector만 61,440,000byte(약 59 MiB), 5만 메일이면 307,200,000byte(약 293 MiB)다. SQLite·텍스트·FTS 비용은 별도이며 profile 전환 중 새 generation을 만들면 vector가 일시적으로 두 배까지 늘 수 있으므로 설정 UX에서 디스크 여유를 확인한다.

exact cosine의 연산량은 후보 범위 chunk 수×차원이다. 로컬 모델/PC가 정해지지 않은 상태에서 검색 지연·GPU 필요 여부를 확정하지 않는다.

### 실증 계획과 선택 조건

수집 corpus는 합성/반입 허용 자료로 만들고 본문·주소를 PR 로그에 올리지 않는다. **기존 24 AC의 구현 검증**과 **후보 성능 비교**를 분리해, 벤치마크에서 좋다는 이유로 무결성 실패를 허용하지 않는다.

| 축 | 고정 입력 / 비교 | 관측 / 결정 |
|---|---|---|
| 전처리 | plain+HTML 중복, HTML-only, UTF-8/EUC-KR/CP949 alias, 잘못된 charset, 영어/코드, inline reply, 서명 유사 업무 조건, nested EML, 원본 없는 quote | 필드 golden·segment 재결합·sentinel 제외·quality flag; 중요한 수치/부정어 유실 0 |
| 검색 질의 | 고정 24개: 정확번호/주소·짧은 식별자·의미 유사·필터·경위/상충/오래된 결정·scope/무답 각 4 | 회귀용 기준 셋. 이 24개에 맞춰 ranking 파라미터를 튜닝하지 않고, 필요하면 별도 확장 평가를 추가 |
| retrieval | FTS5만 → 로컬 E5-small + FTS5; 모델·벡터 엔진 후보를 동시에 늘리지 않음 | mail Recall@10·MRR@10·thread/event coverage, 중복률·scope leak·무답 오탐 |
| context/답변 | 동일 retrieved IDs와 두 기존 요약 AI 경로 | 근거 문장 citation validity·claim faithfulness·승인/변경·모름 구분; LLM 자체 점수만으로 합격하지 않음 |
| vector | 동일 필터 exact scan의 정답 비교, actual/10k corpus (50k는 실제 자료량 초과 시) | top-k 기준 cosine·cold/warm p50/p95·RSS·DB 크기·삭제/복구 |
| cache/부하 | cold·동일query 반복·서로 다른 scope·색인 중 query·로컬 모델전환·worker 지연·취소 | hit ratio·문서/질의 추론 수·native inference 지연·epoch 누락 0 |
| 배포 | Windows 설치본·오프라인 로컬 모델 팩, S3 기존 두 AI 실행 경로 | 실제 load→query→delete→restart; 미선택 모델 가중치는 설치본에 넣지 않음 |

품질 비교의 우선 조건은 **정확번호·scope·인용 무결성 회귀 0**, 다음은 스레드 사건 coverage와 p95다. 이 첫 기준에서는 후보 수를 늘리지 않는다. exact scan 또는 e5-small이 실제 자료와 PC에서 충분하지 않을 때 원인을 분리해 후속 plan 결정으로 올린다.

## 15. 외부 구현 포트 / 문서 계약

요약은 기존 AI provider/harness가 처리한다. S2는 로컬 worker의 `EmbeddingPort`만 구현하며 채팅 자격증명은 임베딩 프로필에 포함하지 않는다.

임베딩 API는 reserved로 adapter 등록·endpoint 선택·secret 저장·HTTP 전송 경로를 제공하지 않는다. 향후 추가 시 사용자 결정과 별도 Delta V로 request/response/auth 계약을 확정한다.

S0 이후 구현 문서에는 로컬 팩 manifest·입력 tensor 이름/type·padding·truncation·pooling·normalization·query/document prefix·차원·revision·해시를 명시한다. 로컬 port의 입력/출력·취소·worker 종료·세대 전환 의미를 실행 가능한 예제로 고정한다.

**shape 검증**은 문서 예제를 실제 exported TypeScript 타입에 대입해 typecheck하고 예약 API profile이 수용되지 않음을 확인한다. **semantics 검증**은 로컬 성공·빈 입력·팩 누락·worker 종료·timeout·취소·차원 오류·index 뒤바뀜·모델 변경 응답을 동일 contract suite로 실행한다.

## 16. 기존 결정·규칙과의 관계

| 규칙 | 본문 반영 | 판정 |
|---|---|---|
| main 하향 DAG·feature 간 직접 import 금지 | §9 plugins 내부 공통부·contracts port·bootstrap 주입 | 유지 |
| renderer feature 교차 import 금지 | §9 app/pages 조립, settings/chat slot, shared generic callback | 유지 |
| 원격 요청 Chromium `infra/net` | 기존 채팅/네트워크 경계 유지. S2 임베딩에는 원격 transport 없음 | 유지 |
| 자격증명 vault / 로컬 DB | 기존 채팅 vault 유지, S2 embedding secret 없음. DB 자체가 암호화됐다고 주장하지 않음 | 유지 |
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

향후 구현 변경은 §11 표를 따르며, 실제 동작이 생긴 시점에 `docs/IPC_CONTRACT.md`, `docs/arch/backend/persistence.md`, `docs/arch/backend/overview.md`, `docs/arch/frontend/{state,rendering,ux-domains}.md`를 현재 상태로 갱신한다. 로컬 모델 팩 운영 절차는 `docs/guides/`에 추가하고 generated inventory는 코드에서 생성한다.

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

### ΔV5 READY 판정

판정은 **독립 경로 READY**다. 사용자가 세 질문에 답변해 D-029~031을 ACTIVE로 확정했다. PG-03과 전체 S1의 미완료 기준을 유지한다.

- D-027/029↔AC2/3↔EP-24: 손상 PST의 새 revision 전체 미공개와 기존 snapshot·counter 보존을 직접 oracle로 잠갔다.
- D-028/030/031↔AC1/19↔EP-22/23: normalized 내부 함수와 소비 중 다음 읽기, PST 전용 GUI를 고정했다.
- PG-03: 기존 메일·첨부 ID를 유지하는 전환과 형식 통합 oracle을 더 설계해야 한다. 이번 변경은 identity·DB·현재 architecture·앱 코드를 변경하지 않는다.
- V: 신규 R/SD/AR/MD와 VP-26~29 REQUIRED, 영향받는 상위 S1 회귀, EP-22~24의 18자리·직접 oracle·M-EML-GUI를 등록했다. 기존 stable ID와 M-WIRE/worker 회귀는 보존했다.
- 메시지 버스: plan 메타와 INDEX는 plan/READY·다음 주체 Codex로 함께 갱신한다. 아래 초기 READY 및 r1.4/r1.5 구현자 보고는 이전 기준 이력이다.

설계 gate 관측: `git diff --check` 오류 0, app의 `node scripts/check-doc-inventory.mjs --check`에서 generated/prose/상대 링크 통과. 메타의 ΔV5 READY와 INDEX의 plan/READY·Codex를 다시 읽어 일치를 확인했다. 신규 네 node/pair와 EP-22~24의 자리수 `6+6+6=18`을 표와 대조했으며 코드·lockfile 변경은 없다.

### ΔV6 설계 정정 검사 (2026-09-30)

판정은 **DRAFT 유지**다. D-033↔AC8·10~12·19·20·24↔ΔV6 VP-04/11/15/21↔EP-07/19/25↔§10~15의 local-only 경로를 대조했으며 ACTIVE 결정 ↔ 현재 AC의 충돌은 0이다. D-003의 두 채팅 AI 경로와 D-028/030의 EML 내부 배치 입력을 유지하고 D-032 답변·D-015/016 실증은 미완으로 남겼다.

문서 파서 관측: Decision 33행·AC1~24 연속·ΔV6 CHANGED/REQUIRED 4 pair·EP-25 a~e 5자리·64표 열 수·상대 링크 9개·UTF-8 검사가 통과했다. app의 doc-inventory generated/prose/links와 `git diff --check`가 통과했고 plan/INDEX는 ΔV6·plan/DRAFT·다음 Claude가 일치한다. 공유 브랜치의 `18585e53`이 commit이며 해당 브랜치의 ancestor임을 확인했고 앱 코드·의존성·네이티브 ABI는 변경하지 않았다.

## READY self-review — 이전 설계 판정 이력

아래 체크는 당시 판정이며 현재 S2 범위는 D-033·ΔV6이 대체한다. API endpoint 확정·구현은 현재 완료 조건이 아니며 로컬 모델 팩/runtime·기준 PC 실증은 OPEN이다.

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

**r1.4 판정: 결함 보완·부분 구현. S1 완료가 아니다.** 외부 진단의 성능·누락·누적 이력·오류 표시 문제는 코드와 실행으로 확인했다. r1.3의 `7/14`, `SELF_PASS 7`, `38/41` 보고는 계약 전체를 검증하지 않은 과대 보고여서 아래 관측으로 대체한다. 과거 보고는 git 이력에 남으며 별도 델타 문서를 만들지 않는다.

| 진단 | 비판적 판정 / 조치 |
|---|---|
| 파일마다 전체 관계 재구성 | 확인. verify/activate/remove는 dirty 표시만 하고 스레드 조회 시 재구성한다. source child는 작업 동안 재사용한다. |
| 1만 EML 약 15분 | 외삽값으로만 취급. 이번 PC의 3천 건 DB 작업은 천 건 구간별 3,365/3,451/4,256ms였다. 파싱·UI·실파일 전체 성능은 아니다. |
| PST `emailCount=-1`·예외 삼킴·비메일 유입 | 확인. null까지 순회하는 공통 walker, IPM.Note 계열 필터, 읽기 실패/개수 불일치 오류와 비메일 제외 수를 연결했다. 라이브러리 내부의 조용한 skip도 개수 대조로 감지한다. |
| 재가져오기 누적/교체를 새로 결정 | D-010·§5·11에 누적이 이미 명시돼 있다. 현재 revision만 노출하던 버그와 잘못된 테스트 기대값을 고쳤다. 원본에서 삭제되거나 수정되기 전의 메일도 명시 제거 전까지 보존한다. |
| 미출시 migration 압축·개발 DB 삭제는 비용 0 | 채택하지 않음. 사용자가 이미 개인 보관함을 사용 중이다. 태그 미포함은 데이터 부재의 증거가 아니다. 추가 migration으로 기존 DB를 보존한다. |
| 설정 자료원 관리·가역 segment는 새 선택 | 둘 다 기존 D-008·§11의 S1 계약이다. 미구현을 후속 단계로 옮겼던 보고를 철회한다. |
| 미사용 DTO·관계·상태 일괄 삭제 | 소비 부재와 불필요는 다르다. 누락 부모·오류 상태 등 계약상 필요한 정보는 유지하고, cc·실패 사유는 화면에 연결했다. 확정된 죽은 분기와 중복 PST 순회·해시만 정리했다. |
| 워커 테스트가 없다 | 기존 가짜 워커 테스트는 실제 process 경계를 증명하지 못했다. production host/source/index를 실제 Electron으로 실행하는 스크립트를 추가했다. |

**PLAN_GAP (규범 행은 수정하지 않음)**

| ID | 충돌 / 부족한 계약 | 현재 동작 / planner에게 필요한 정정 |
|---|---|---|
| PG-01 | §5의 손상 항목 제외 후 정상 항목 보존과 §13의 PST child 오류 시 revision 전체 비활성화 | 이번 수정은 오류를 알리고 새 revision 전체를 보류해 이전 보관함을 지킨다. 부분 손상 자료원의 정상 메일을 새로 공개할지와 partial 상태·oracle을 확정해야 한다. |
| PG-02 | EML 폴더 상대 locator 모델과 파일 단위 자료원·revision의 관리 단위 | 성능 결함은 수정했지만 자료원 목록은 여전히 파일별이다. 폴더 하나=자료원 하나를 권고해 사용자에게 질문했으며 답변 대기다. 기존 자료원 전환·제거·재가져오기 규칙을 먼저 정해야 한다. |
| PG-03 | 형식 통합 identity·이름/주소 정상화 때 이미 사용 중인 DB의 전환 oracle 부재 | sourceKind를 identity에서 빼는 수정만 하면 기존 메일이 재삽입된다. 기존 ID·공유 occurrence·첨부 참조를 보존하는 전환 및 충돌 검증을 추가해야 한다. |

[handoff-impl](../../../.agents/skills/handoff-impl/SKILL.md)의 “PLAN_GAP이 남으면 impl/IMPL_DONE으로 넘기지 않는다”에 따라 보드와 메타를 `plan/DRAFT`로 돌린다. 영향받지 않은 수정과 시험 결과는 보존한다. 설정 슬롯·segment 누락은 선택 대기가 아닌 구현 미완료다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

검색: `rg -n '^\| EP-' docs/handoff/0244-mail-archive/plan.md`의 규범 표는 21행·88자리다. `rg -n 'pickFiles|selectionId|postMessage|openEpoch|revokeEpoch|verifyRevision|activateRevision|upsertBatch|removeSource|attachmentLocation|thread:|archive_verified_occurrence' app/src`로 운반 지점을 대조했다. 아래 수는 이번 S1 코드에서 관측한 자리이며 **AC 전체 또는 전수 검증 완료 수가 아니다**. 종전 `S1 38/41 완료` 분모는 철회한다.

| 행 / 전체 자리 | 구현 관측 자리 | 이번 관측 / 남은 자리·검증 |
|---|---|---|
| EP-01 / 4 | b·c, d 일부 | main picker의 창별 일회성 토큰 테스트, preload 타입, 진행 snapshot 복원. a 설정 슬롯과 d reducer/시각 실기 미완. |
| EP-02 / 4 | a~d의 S1 경로 | service 취소/변경·store 재개 테스트, 실제 source/index kill·다음 조회 복구. commit 중 강제 종료/디스크 full은 미검증. |
| EP-03 / 4 | a~c 일부 | PST·EML 정규화/identity 테스트. 이름·주소 일관화와 형식 간 identity·d segment 미완. |
| EP-04 / 3 | a~c의 thread 경로 | resolver 3건 및 역순 thread DB 테스트. S3 context 미구현, UI 시각 확인 미실행. |
| EP-05 / 4 | a·b의 lexical 경로 | 공백 AND·literal LIKE·자료원 ID 필터 테스트. 기간/폴더 UI, c vector·d fusion/page 미완. |
| EP-06 / 3 | a·b | 첨부 이름 검색·본문 sentinel 제외 테스트. c chunk/context는 S2/S3. |
| EP-07 / 5 | 없음 | a~e 임베딩 profile/adapter는 S2/S3. |
| EP-08 / 4 | 없음 | a~d generation은 S2/S3. |
| EP-09 / 5 | 없음 | a~e evidence/citation은 S3. |
| EP-10 / 8 | 없음 | a~h 세션 scope는 S3. 개인 보관함 자료원 필터를 scope 구현으로 세지 않음. |
| EP-11 / 4 | a~d의 UI 추출 경로 | EML 선택 바이트·원본 보호·제거 경합 테스트, 실제 child의 fingerprint 오류 전달. 도구 승인·PST 설치본 추출 실기 미완. |
| EP-12 / 3 | 없음 | a~c AI 도구 등록/해제·harness는 S3. |
| EP-13 / 3 | a~c의 S1 경로 | 관련 import만 취소하고 export 정착 후 제거하는 service/store 테스트. S3 context/cache 경합 미구현. |
| EP-14 / 3 | a·b | 기존 MIME 회귀 suite, unpacked ASAR의 두 child 포함/fixture 제외 확인. b M-PACK 변이는 차단, c 설치본 실행 미실행. |
| EP-15 / 4 | a~c, d의 UI 부분 | 본문 선택·charset/HTML fixture, M-NESTED 검출. d semantic projection과 UI 실제 상호작용 미검증. |
| EP-16 / 4 | 없음 | a~d 미구현. S1의 a·b·d를 S2/S3 완료 대기로 숨기지 않음. |
| EP-17 / 3 | 없음 | a~c embedding input은 S2/S3. |
| EP-18 / 4 | a 일부 | exact term AND·자료원 필터. b~d RRF/context·결과 이유 미구현. |
| EP-19 / 4 | 없음 | a~d embedding cache/scheduler는 S2/S3. |
| EP-20 / 3 | 없음 | a~c vector/generation은 S2/S3. |
| EP-21 / 9 | a~i의 코드 경로 | 실제 Electron 7시나리오와 IPC handler 토큰 테스트. c OS picker/renderer 실제 왕복, i commit 중 fault·앱 종료 후 재시작 검증은 남음. |

### V-pair 자기확인 — S1 유효 집합

| pair | requiredness | 자기 상태 | 이번 관측 / 미충족 |
|---|---|---|---|
| VP-01 | REQUIRED | SELF_BLOCKED | EML/PST·토큰 handler·M-NESTED 확인. 설정·대표 ANSI/Unicode golden·PG-01/02 남음. |
| VP-02 | REQUIRED | SELF_BLOCKED | 누적 identity·thread 확인. 형식 통합·segment/원문 재결합 미완. |
| VP-03 | REQUIRED | SELF_BLOCKED | 이름 검색 sentinel·AND 확인. 이름/주소·기간/폴더 전체 AC7 미충족. |
| VP-07 | REQUIRED | SELF_BLOCKED | 실제 취소/timeout/child 종료 확인. AC19의 대표 자료·1만 건 UI/RSS·commit fault 미검증. |
| VP-08 | REGRESSION | SELF_BLOCKED | 기존 suite와 부팅 등록 순서 회귀 수정. 설정 슬롯·M-WIRE·설치본 미완. |
| VP-09 | REGRESSION | SELF_BLOCKED | DB/service 재시도·삭제 경합 확인. commit 전후 actual kill·journal UI 복구 미검증. |
| VP-13 | REQUIRED | SELF_BLOCKED | production IPC handler를 등록한 테스트로 위조/재사용/다른 창 토큰 거절. 실제 preload→Electron IPC→renderer 왕복 미검증. |
| VP-14 | REQUIRED | SELF_BLOCKED | 실제 SQLite 테스트 실행 완료. segment/provenance 저장 계약 미구현. native binding은 더 이상 blocker 아님. |
| VP-17 | REGRESSION | SELF_BLOCKED | Vite 및 unpacked ASAR 검사. M-PACK 변이 차단, Windows 설치본 실행 미검증. |
| VP-18 | REQUIRED | SELF_BLOCKED | 정규화·본문 품질·M-NESTED 확인. charset 대표 golden·segment·형식 통합 미완. |
| VP-19 | REQUIRED | SELF_BLOCKED | 한글·정확 term·LIKE 테스트. 전체 필드 검색 계약 미충족. |
| VP-23 | REGRESSION | SELF_BLOCKED | snapshot 복귀·완료 refresh·오류/cc UI 배선과 타입 확인. reducer/요청 역전 UI oracle 없음. |
| VP-24 | REQUIRED | SELF_BLOCKED | production worker 7건·ACK 제거 시 검출. 실제 IPC 전체 경로와 모든 fault 지점의 DB/counter 대조는 남음. |
| VP-25 | REQUIRED | SELF_PASS | store의 추가 revision/변경 payload/ID-less 보존 및 AND 결과 집합, service 동일 PST 재수집 테스트 통과. |

검산: SELF_PASS 1 · SELF_BLOCKED 13 = 14. 나머지 S2/S3 pair를 완료로 세지 않는다. 실제 워커 smoke가 추가됐다고 VP-24 전체 계약을 충족했다고 보고하지 않는다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 대상 / production 자리 | 실행·관측 | 판정 |
|---|---|---|
| M-NESTED / archive EML PostalMime 옵션 | `forceRfc822Attachments`를 임시 제거하면 nested sentinel 테스트 1건 실패. 복원 후 EML 4건 통과. | 해당 자리 잠금 |
| M-WORKER / batch-buffer ACK await | `node scripts/check-mail-archive-workers.mjs --drop-ack`는 실제 child의 완료 결과가 30 대신 3건이 되어 실패. 복원한 실제 경로는 7/7 통과. | 해당 자리 잠금; 모든 fault 검증으로 확대하지 않음 |
| M-PACK / 실제 ASAR 내용 검사 | 정상 unpacked 산출물에 두 child가 있고 pst-extractor 예제·테스트 sentinel·scripts fixture가 없음. 제외 패턴을 뺀 임시 패키지 변이 명령은 자동 승인 검토가 실행 전 차단(추가 사유 미제공). | 감도 미검증, VP-17 유지 SELF_BLOCKED |
| M-WIRE / EP-01a·EP-12a | 설정 슬롯·runtime descriptor가 아직 없어 제거 변이는 수행하지 못함. | SELF_BLOCKED |
| 누적 보관·PST count/예외·필터·source별 제거·토큰 권한·오류 문구 | 실제 결과/DB/거절/문구 키를 단언한다. | 해당 없음 — 직접 oracle |

잠금 분모: SELF_PASS pair의 선택 mutation 0 · 닫힌 외부 이슈의 인용 mutation 0 · 이번 구조/배선 oracle 3(M-NESTED, M-WORKER, M-PACK) = 감도 대상 3행(검출 2, 차단 1). 별도로 미완 M-WIRE와 직접 oracle 행을 적었다. M-PACK 부재 상태에서 패키징 pair 완료를 주장하지 않는다.

## [구현자 기입] Product/UX 파생 검토

| 사용자 상황 | 반영 | 남은 관측 |
|---|---|---|
| 원본 PST에서 삭제 후 다시 가져오기 | 보관 메일·수정 전 본문은 남고 새 본문만 추가된다. 새 revision 전체 실패 시 기존 이력 유지. | 오래된 첨부의 원본이 없어지면 본문은 남아도 추출 불가; 재등록 안내를 실제 창에서 확인 필요. |
| 일정·연락처가 있는 PST | 메일만 수집하고 제외 수를 결과에 표시한다. 손상은 한국어 오류로 표시한다. | 부분 손상 정상 항목 공개 규칙 PG-01. |
| 페이지 이동 후 복귀 | main snapshot에서 진행·최근 결과를 복원하고 완료 이벤트 때 목록/통계를 새로 조회한다. | 실제 라우터·다중 창·요청 역전 UI 실기 미실행. |
| 가져오는 중 다른 자료원 제거 | 현재 작업에 포함된 자료원일 때만 그 작업을 취소한다. | 폴더 관리 단위 PG-02, 파일별 목록 대량 관리 문제는 미해결. |
| 검색/상세 오류 | Electron 접두어 속 코드만 해석해 번역 문구 표시, 원시 경로 차단. 열기·취소 실패를 화면에 표시하고 cc·개별 실패 사유 추가. | 미등록 오류는 일반 오류로 표시; retry 안내와 실제 키보드 흐름 실기 필요. |
| 원하는 자료원만 검색 | EML/PST 유형에 더해 자료원 ID를 선택하는 필터 추가. 같은 이름은 짧은 ID로 구별. | 날짜/폴더 필터·이름/주소 통합 검색·설정 관리 미완. |

## [구현자 기입] 놓친 잠재 문제 + 대응

| 문제 | 대응 / 현재 한계 |
|---|---|
| process의 `reason`과 host의 `error` 필드 불일치 | 두 안정 오류 필드를 해석하고 실제 추출 child의 코드 전달을 단언했다. |
| 완료·ACK 대기 등록 전 메시지 도착 | waiter를 먼저 등록한다. 취소 후 늦은 callback은 죽은 child에 ACK를 보내지 않는다. |
| parser 내부에서 손상 child 예외를 삼킴 | 순회 결과 수와 읽을 수 있는 table/content count를 대조한다. count 자체를 신뢰할 수 없는 손상까지 완전 검출을 보장하지 않는다. |
| worker 종료 후 pending만 실패, 이후 영구 정지 | 종료/timeout에 child를 정리하고 다음 요청에서 init한다. 실패한 쓰기는 자동 재실행하지 않는다. |
| 관계 lazy rebuild의 공유·재진입·무효화 | index single writer, thread 안의 동기 transaction만 rebuild한다. verify·activate·remove·reopen이 dirty를 만든다. 만료 없음. 가져오는 중 thread를 자주 열면 반복 전체 재구성 비용이 남고 대형 thread 조회도 같은 worker를 점유한다. |
| 모든 verified revision 노출 | 누적 보관 계약을 복원한다. staging은 계속 제외한다. occurrence가 revision별로 늘어나는 비용과 오래된 원본의 첨부 추출 불가는 남는다. |
| 기존 DB의 호환 데이터 | 0001~0004와 backfill을 보존하고 0005 VIEW를 추가했다. 파일 삭제·재수집을 사용자에게 강요하지 않는다. 호환 코드 제거는 데이터 보존 전환 증거 후 검토한다. |
| timeout과 큰 PST | index RPC 30초/source inactivity 120초. 큰 파일 hash·파싱이 그 시간 동안 메시지를 못 보내면 timeout될 수 있어 대표 대형 파일 측정·heartbeat 보완 필요. |
| EML 메모리 예산 | stat와 bounded read로 50 MiB를 넘는 입력을 파싱 전에 거절하고 읽은 바이트 hash를 대조한다. PST 단일 item의 사전 해제 상한은 여전히 미검증. |
| 앱 종료와 임시 추출 파일 | epoch/child 종료는 유지한다. 강제 종료 시 sibling `.orca-part` 잔류 정리·export receipt·디스크 full은 미검증. |
| Node 테스트가 `?modulePath`를 본문 import로 실행 | Vitest에서 경로 값으로 해석한다. 실제 child 동작은 별도 Electron 스크립트가 검증하며 mock의 성공으로 대체하지 않는다. |
| PST 첨부 탐색·큰 store/view | 공통 walker만 통합했다. locator 직접 조회·RPC 타입 정리·renderer reducer/분해는 미완이며 line 절감 목표만으로 우선하지 않는다. |

설계 대비 구현 차이: relation 갱신을 lazy projection으로 바꿨고 위 표에 공유·재진입·무효화·만료 축을 적었다. 검증된 파일을 skip할 때 두 번째 hash는 생략하지만, 새 PST revision과 실제 첨부 저장의 시작/종료 hash는 유지한다. D-012 source/index 격리·epoch·ACK·임시 저장 후 rename은 유지한다.

## [구현자 기입] 구현 보고

| 항목 | 관측 |
|---|---|
| 주요 변경 | 누적 보관 VIEW·관계 lazy rebuild·source 재사용, PST 공통 순회/오류 감지, 워커 감독/timeout, picker 토큰, 진행 snapshot·자료원 필터·오류/cc/실패 사유 UI. |
| 관련 파일 | `app/src/main/features/plugins/mail-archive/`, app handler/bootstrap, shared/preload/renderer API·뷰, `app/scripts/check-mail-archive-{workers,package}.mjs`, IPC/현재 architecture 문서. |
| 검증 명령 | Node ABI에서 archive+handler+오류 Vitest·전체 suite, 타입 3구성·eslint, migration/doc 스크립트. Electron ABI에서 실제 worker 스크립트·Vite build·electron-builder --dir·ASAR 검사. |
| 게이트 산출 | targeted 12파일 45 pass·benchmark 1 skip. 전체 초기 run 612파일 중 608 pass·3 fail·1 skip, 5,740 tests pass; `?modulePath`·IPC 문서 도메인·부팅 순서 수정 후 실패 관련 3파일 12 tests pass. 최종 진행 상태 변경 후 service 8/8도 재통과. 전체를 재실행해 전건 green이라고 주장하지 않음. |
| 정적·문서 산출 | typecheck node/web/test 3/3. 전체 lint 0 error·기존 warning 1, 변경 영역 error 0. migration/doc script tests 42/42·append-only·inventory 통과. |
| 실제 process 산출 | EML 30건/source child 재사용, index kill 재연결, PST 71건/ACK 대기, PST 취소 staging 비노출, RPC timeout 후 복구, source kill 후 다음 import, 첨부 오류 전달 7/7. |
| 성능 관측 | opt-in store benchmark: 3천 EML begin/upsert/verify, 천 건 구간 3,365/3,451/4,256ms. 전체 관계 재구성 비용이 파일마다 누적되지 않음. 전체 앱 throughput/SLA는 미판정. |
| 패키지 산출 | Windows unpacked ASAR 실제 생성, source/index child 포함·예제/fixture 제외 확인. 설치본 실행·NSIS·M-PACK 변이 완료 아님. |
| V-pair 자기확인 | SELF_PASS 1 · SELF_BLOCKED 13. 독립 verify 아님. |
| 강제 지점 | 규범 21행·88자리 대조. 코드 관측과 시험을 표로 분리; 전체 또는 S1 전수 완료 주장을 철회. |
| blocker | PG-01~03 설계 정정, 기존 S1 설정·segment·이름/주소·필터, UI/IPC 실제 왕복·대표 규모/설치본 실기. DB native binding과 패키지 빌드는 현재 환경 blocker가 아님. |
| 대상 커밋 | (r1.4 구현 — 검증자 기입) |

### S1 AC 자기보고

| AC | 상태 | 이번 관측 / 남음 |
|---|---|---|
| AC1 | ⚠️ | 파일/폴더 입력 동작·토큰 테스트, 설정 슬롯/실제 왕복 미완. |
| AC2 | ⚠️ | EML/공개 PST·walker 확인; 대표 ANSI/Unicode/charset golden·PG-01 미완. |
| AC3 | ⚠️ | fake+실제 cancel·변경 revision 확인; 실제 앱 재시작 전체 상태 oracle 미완. |
| AC4 | ⚠️ | inert 본문/대체 표현만 구현. 가역 segment·옛 인용 미완. |
| AC5 | ✅ | store/service의 추가 revision·같은 ID 변경 본문·ID-less locator 집합 확인. |
| AC6 | ✅ | resolver와 실제 DB의 역순/누락/다중후보/순환/동일제목 분리 확인. |
| AC7 | ⚠️ | 공백 AND·literal·자료원 필터 확인; 이름/주소·기간/폴더 미완. |
| AC9 | ✅ | S1 첨부명 검색·첨부 내부 sentinel 비색인 확인. embedding/LLM 관측은 S2/S3. |
| AC17 | ⚠️ | EML 선택 저장·변경 거절·실제 오류 전달. PST 설치본 추출/승인 경로 미완. |
| AC19 | ⚠️ | 3천 DB 벤치·실제 ACK 확인. 대표/1만 전체 UI·RSS·취소 지연 미측정. |
| AC20 | ⚠️ | 실제 kill/timeout/다음 조회 확인. commit 전후/디스크 full/앱 restart 미완. |
| AC21 | ⚠️ | S1 제거·공유/경합 확인. 전체 source lifecycle·AI/evidence 범위 미완. |
| AC22 | ⚠️ | 기존 suite·부팅 순서 회귀 확인. 설치본·전체 composition 미완. |
| AC23 | ⚠️ | 오류·snapshot 배선만 확인. 설정/reducer/역전 응답 실제 UI 미완. |

검산: ✅ 3 · ⚠️ 11 · ❌ 0 = 14. `Criteria-Met: 3/14`는 S1 관측 집합이며 전체 제품 완료를 뜻하지 않는다. `Criteria-Pending: AC1,AC2,AC3,AC4,AC7,AC17,AC19,AC20,AC21,AC22,AC23`.

## [구현자 기입] Review Signals — 사실만

- r1.4. verify 없는 구현이 반복돼 `handoff-review`를 DIAGNOSE_ONLY로 수행했다. 지침·skill·failure corpus는 수정하지 않았다.
- 누적 보관과 가역 segment는 이미 계약에 있었는데 구현/테스트/보고가 이를 좁혔다. 규칙 부재보다 실행·자기검증 실패(B)와 실제 구현 결함(F)에 해당한다.
- 37/37 baseline 통과는 재현됐지만, 교체식 기대값과 가짜 worker는 계약 위반을 검출하지 못했다. 테스트 수를 기능 완성도로 사용하지 않는다.
- 현재 Node/Electron ABI 모두 지정된 훅으로 준비 가능하다. 과거 native/egress blocker를 현재 검증 미실행의 이유로 승계하지 않는다.
- M-PACK 변이 명령은 자동 승인 검토에 차단됐고 구체 사유는 없었다. 정상 artifact 검사는 실행했고 감도 미검증을 유지했다.
- 다음 주체는 planner(PG-01~03 정정)다. 독립 verify는 아직 수행하지 않았다. 사용자가 이미 정한 계약과 실제 제품 선택이 필요한 항목을 구별한다.

## [구현자 기입] r1.5 설계 리뷰

이번 턴은 `ΔV4-A`의 설정 관리·명시 필터·가역 구간을 구현했다. 앞의 r1.4 보고는 당시 관측으로 보존하며 현재 자기보고는 아래 표가 갱신한다. Decision·AC·V pair·§10의 규범 행은 변경하지 않았다.

| 경계 | 판단 / 관측 |
|---|---|
| 설정과 페이지 | app의 ReactNode slot으로 관리 화면을 조립하고 주입 가능한 feature store를 공유한다. `SidebarUserButton.tsx:134`, `SettingsModal.tsx:94`; Electron UI 9/9. |
| 검색 | 입력 중 조건과 적용 조건을 분리하고 로컬 날짜·필드·같은 occurrence의 자료원/폴더를 AND로 결합한다. `search-request.test.ts`, store의 날짜·필터 ID oracle, UI 사례 4·6·8. |
| 구간 | 새 메일/기존 DB에 같은 classifier를 쓰는 additive projection이다. 이전 본문·메일/첨부 ID·identity를 유지하며 실패 rollback/reopen을 검사했다. `store.test.ts`의 projection·backfill 사례. |
| 미정 경로 | PG-01 손상 PST 부분 공개, PG-02 폴더 관리 단위, PG-03 형식 통합 identity/이름·주소 정규화는 그대로 남는다. reader·source/revision·identity 구현을 이번 diff에서 바꾸지 않았다. |
| 다음 주체 | `plan/DRAFT`·planner로 반환한다. 독립 경로의 성공은 전체 S1 완료와 독립 verify를 대신하지 않는다. |

## [구현자 기입] r1.5 강제 지점과 V-pair 자기확인

ΔV4-A가 지정한 자리를 아래에 재열거했다. EP 항목 개수와 값을 운반하는 실제 edge를 구별하며, tool·scope·vector·evidence 등 이번 READY 경계 밖 자리는 기존 미충족으로 남긴다.

| 자리 | 실제 production edge / 이번 관측 |
|---|---|
| EP-01a | SidebarUserButton slot→SettingsModal prop/탭 렌더→MailArchiveSettingsContent 관리/이동 callback; 페이지→설정 열기; AppSettingsTab→오류 목적지 allowlist. UI 사례 1·5·9, `errorToastTarget.test.ts`; M-WIRE red. |
| EP-01b | shared search/get DTO→renderer API→실제 preload invoke. 수정 필드와 bodySegments가 UI 사례 2·4에서 원형대로 왕복했다. `shared/api/ipc.ts:201`, `preload/index.ts:251`. |
| EP-01c | 실제 handler/schema→service→index client/worker→store parse/read. UI 사례 1~4·9의 실제 SQLite 결과·본문·첨부 바이트를 단언했다. handler search/get 등록 `mail-archive.ts:110`. |
| EP-01d | progress/stats→공유 source-state 세대→페이지 revision→검색/상세 순번. source-state UT 6사례와 UI 사례 5~8에서 늦은 snapshot/결과, 모달 닫기, 제거 후 선택을 확인했다. |
| EP-05a | form submit→archiveSearchRequest→shared schema. 로컬 포함 시작/제외 끝, DST 달력 연산, 역전·무효 날짜, 입력만으로 검색하지 않음을 request UT·UI 사례 4·6에서 확인했다. tool 입력은 미구현. |
| EP-05b | handler→index RPC→store의 bound parameter→FTS/LIKE→ID/자료원/폴더 DTO. 날짜 경계·null·각 필드·literal·동일 occurrence를 독립 DB ID 집합과 대조했다. store 필터 2사례. |
| EP-18a | 입력 필드→request compiler→조건 AND. request UT와 UI 사례 4·6·8, store의 각 필드 음성 대조가 적용 조건과 초안 조건의 혼선을 검출한다. hard/soft RAG 범위는 미구현. |
| EP-03d | segment SELECT ordinal→mapMessage→get IPC→MailArchiveBody. store 이전 DB 재개방의 DTO 동등성과 UI 사례 2의 UTF-16 본문·인용 자동 펼침을 확인했다. |
| EP-16a | snapshot→순수 classifier→연속 범위·규칙/revision. classifier UT 6사례에서 CRLF/CR/UTF-16 재결합, 인라인 답변·문장 헤더·불확실한 꼬리를 확인했다. |
| EP-16b | 새 mail/attachment insert→segment/빈 본문 marker transaction; 기존 mail→backfill transaction→reopen. store 3사례에서 PK·identity·본문 불변, 실패 rollback·재시도·FK cascade를 확인했다. variant/chunk provenance는 후속 단계다. |
| EP-16d | 선택 snapshot slice→unknown 표시/quote·signature details→hit 펼침→전체/대체 본문 선택. UI 사례 2에서 원문 golden·HTML 비실행·선택 offset 미적용을 확인했다. |

ΔV4-A 본문에서 추출한 지정 자리 11개와 위 보고 자리 11개의 차집합은 missing/extra 모두 0이었다. 보고 집합에서 EP-16d를 뺀 음성 대조는 missing 1(EP-16d)을 반환했다. §10 전체와 S1 전체를 닫았다는 주장은 하지 않는다.

| 유효 S1 pair | 자기상태 | 이번 증거 / 남은 경계 |
|---|---|---|
| VP-01 | SELF_BLOCKED | 설정·EML/PST 등록 UI 9/9. 대표 charset/ANSI golden·PG-01·전체 restart oracle 미완. |
| VP-02 | SELF_BLOCKED | classifier·DB·뷰어의 원문 재결합, 기존 identity/관계 회귀. 옛 evidence·PG-03 전환 미완. |
| VP-03 | SELF_BLOCKED | 필드·날짜·폴더·literal/AND 실제 ID oracle. 이름/주소 정규화·hybrid/fold 미완. |
| VP-07 | SELF_BLOCKED | 실제 worker kill/timeout/cancel 7/7, 공유 자료원 제거 UI 확인. 대표 규모·disk full·후속 세대 lifecycle 미완. |
| VP-08 | SELF_BLOCKED | app 설정 composition·M-WIRE·전체 회귀·Vite 성공. runtime archive tool·설치본/모델 경로 미완. |
| VP-09 | SELF_BLOCKED | 취소/복구 worker 및 store 회귀 성공. 앱 재시작·commit 전후 fault injection 미완. |
| VP-13 | SELF_BLOCKED | 수정 DTO가 실제 preload/schema/index/SQLite/뷰어를 통과했다. 현재 independent 경로 외 취소·도구·후속 상태 계약 미완. |
| VP-14 | SELF_BLOCKED | additive migration·backfill·rollback/reopen·검색 branch IT 성공. PG-03·variant/chunk/vector 경로 미완. |
| VP-17 | SELF_BLOCKED | 기존 MIME 회귀와 source/index 포함 Vite 산출. 설치본 PST/추론·M-PACK은 이번 턴 미실행. |
| VP-18 | SELF_BLOCKED | classifier·MIME·본문 품질 회귀 성공. 형식/charset 전수 golden·PG-03 미완. |
| VP-19 | SELF_BLOCKED | request/SQL 경계·literal·동일 occurrence ID oracle 성공. 정규화 이름/주소·RRF/hard-soft 경로 미완. |
| VP-23 | SELF_BLOCKED | UT late snapshot과 실제 렌더 IPC 역전·제거·설정 닫기 확인. scope/tool/cache의 후속 이벤트 미완. |
| VP-24 | SELF_BLOCKED | production worker 7/7와 실제 UI PST 등록 성공. 전체 앱 restart·대표 부하·설치본 경로 미완. |
| VP-25 | SELF_PASS | store/service/reader 회귀에서 누적 revision·동일 ID 변경 payload·locator·공백 AND 확인. 관련 suite 16파일 82 pass·1 benchmark skip; store 마지막 재검사 13 pass·1 skip. |

자기결과는 SELF_PASS 1·SELF_BLOCKED 13이며 독립 verify 판정이 아니다. 이번 독립 경로의 직접 oracle 성공을 기존 pair 전체 성공으로 바꾸지 않았다.

## [구현자 기입] r1.5 이번 라운드 수정의 잠금

| 선택 / 자리 | 정상 대조 | 적대 대조 / 판정 |
|---|---|---|
| M-WIRE / app의 settings slot 주입 | `node scripts/check-mail-archive-ui.mjs`: 실제 설정의 파일/폴더 추가 버튼을 찾고 IPC까지 실행, 9/9. | 동일 runner `--remove-settings-slot`: production SidebarUserButton에서 slot만 제거해 `actual settings slot renders management`에서 실패(exit 1). 감도 확인. |
| 필터·offset·transaction·stale 상태 | UT의 명시 기대값, 실제 DB PK 집합/rollback, 실제 UI 본문 golden·역전 응답을 단언한다. | 해당 없음 — 직접 oracle. 기존 M-NESTED/M-WORKER 위치·동작은 수정하지 않았으며 해당 pair 전체 잠금을 이번 턴 완료했다고 주장하지 않는다. |

선택 감도 대상은 M-WIRE 1행이며 검출 1이다. fixture의 main은 실제 archive handler/service/worker/DB를 사용하고 OS 선택기·앱 설정·provider 조회만 시험값으로 대체한다. stylesheet는 실제 app.css/tokens와 production source scan을 쓰며 offscreen paint 후 캡처한다.

## [구현자 기입] r1.5 Product/UX 파생 검토

| 사용자 상황 | 반영 / 실제 관측 |
|---|---|
| 설정을 닫은 상태에서 가져오기 완료 | main 작업과 페이지 구독을 유지한다. UI 사례 5에서 ACK 직전 대기 중 Esc로 닫은 뒤 공유 목록 갱신을 확인했다. |
| 자료원 제거 취소·공유 메일 유지 | native 확인 취소 시 변화 없음, 승인 시 공유 메일 유지·원본 바이트 보존·상세 자료원 갱신. UI 사례 5·8. |
| 입력만 바꾸거나 날짜를 거꾸로 입력 | Enter/검색 때 적용하고 기존 결과·선택을 유지한다. 제거 후 자동 갱신은 마지막 적용 조건을 쓰며 초안을 보존한다. UI 사례 4·6·8. |
| 인용문만 검색에 일치 | 해당 quote를 펼쳐 일치 이유를 표시하고 unknown 인라인 답변을 유지한다. 원문 전체·대체 표현도 읽을 수 있다. UI 사례 2와 흰색/어두운·좁은 창 캡처. |
| 원본 파일 소실·재시도 | 한국어 안정 오류로 표시하고 원시 Electron 문자열·원본 경로를 오류 문구에 노출하지 않는다. 재확인 및 picker 취소 후 기존 검색 자료를 유지했다. UI 사례 7. |
| 아직 없는 의미 검색 | 설정에 현재 단어 검색을 사용함을 표시한다. 임베딩 관리·이력 질문·근거 scope/뷰어는 구현 완료라고 표시하지 않는다. `MailArchiveSourceManager`의 catalog 문구. |

## [구현자 기입] r1.5 놓친 잠재 문제 + 대응

| 관측 | 대응 / 남은 한계 |
|---|---|
| iterator를 연 채 같은 SQLite connection에 backfill write | 읽기 batch를 먼저 materialize한 뒤 쓴다. backfill happy/failure/reopen test가 통과했다. 대형 최초 backfill 지연·RSS는 대표 workload에서 미측정이다. |
| 제거 후 공유 메일의 상세 자료원 stale | 완료 revision에서 상세를 다시 읽고 실제 삭제된 선택은 해제한다. UI 사례 5·8. |
| 오래된 초기 snapshot·해제된 progress callback | refresh/progress/subscription 세대를 따로 확인한다. source-state UT의 늦은 응답·callback과 UI 역전 응답이 통과했다. 다중 창 실기는 미실행이다. |
| 기본 prebuild의 native cache가 Node binding을 유지 | 강제 electron-rebuild 후 실제 constructor·utility process·UI를 실행했다. ABI 오류를 성공으로 기록하지 않았고 종료 시 Electron ABI `--check` 성공 상태를 남겼다. hook/cache 개선은 별도 조사 대상이다. |
| EML 이름·형식 간 중복 불일치 | 현재 mapper는 표시 이름을 버리는 경우가 있다. 주소 필터는 실제 보관값을 검색하며 이름 복원·identity 재작성은 PG-03 규범 정정 후 수행한다. |
| 손상 PST·EML 폴더 관리 정책 | PG-01/02에 대한 이전 질문은 여전히 답변 대기다. 부분 공개와 기존 source 전환을 임의 구현하지 않았다. |

## [구현자 기입] r1.5 구현 보고

| 항목 | 이번 턴에 관측한 산출 |
|---|---|
| 주요 변경 | 설정 관리 slot/공유 상태, 명시 필드·로컬 날짜·동일 occurrence 필터, additive 구간 migration/classifier/backfill·가역 뷰어, 실제 Electron UI runner. |
| 관련 UT/IT | archive·handler·request/source-state·오류 목적지: 16파일 82 pass·1 benchmark skip. ID oracle 강화 뒤 store 별도 재검사 13 pass·1 skip. |
| 전체 회귀 | `vitest run --maxWorkers=2`: 614파일 pass·1파일 skip, 5,776 tests pass·2 skip. `node --test scripts/*.test.mjs`: 128 pass·0 fail. |
| 정적 gate | typecheck node/web/test 3/3; 전체 lint 0 error·기존 virtualizer warning 1. 마지막 fixture/store 변경도 별도 eslint 성공. |
| 문서/DB gate | append-only·migration sync/no-copy 성공. doc inventory `--check`: 생성물·프로즈·상대 링크 성공. 기존 migration 파일 수정 없음. |
| 빌드 / 실제 실행 | Vite main/preload/renderer 모두 성공; source/index child 산출 확인. Electron production worker 7/7; 실제 UI 9/9, M-WIRE red. |
| 시각 | 실제 CSS의 흰색·어두운 테마, 넓은/좁은 본문·설정 캡처 확인. 출력은 ignored cache에 있으며 runner가 재생성한다. 설치본·사내 endpoint 실기 완료를 뜻하지 않는다. |
| 범위 / 다음 주체 | ΔV4-A 구현 산출은 보존하고 PG-01~03을 planner에게 반환한다. S2 embedding·S3 RAG, 남은 S1 golden/규모/restart/설치본은 계속 미완료다. |
| 대상 커밋 | (r1.5 구현 — 검증자 기입) |

### r1.5 S1 AC 자기보고

| AC | 상태 | 이번 관측 / 남음 |
|---|---|---|
| AC1 | ✅ | UI 사례 1·5·7·9에서 EML 폴더/PST 파일 등록·진행·검색 이동·picker 취소를 actual composition으로 확인했다. |
| AC2 | ⚠️ | EML body/attachment와 공개 PST 71메일 경로 성공. 대표 ANSI/Unicode/charset golden·PG-01 미완. |
| AC3 | ⚠️ | store/service·실제 worker 취소/변경/복구 회귀 성공. 전체 앱 restart oracle 미완. |
| AC4 | ⚠️ | 원문·구간 재결합/펼침·inert 대체 본문 성공. 오래된 evidence/재색인 인용 경로 미완. |
| AC5 | ✅ | 이번 store/service 회귀에서 누적 revision·동일 ID 변경 payload·ID 없는 locator 계약 재확인. |
| AC6 | ✅ | 이번 relations/store 회귀에서 역순/누락/다중후보/순환/동일제목 분리 재확인. |
| AC7 | ⚠️ | 필드/날짜/폴더/literal/AND·FTS/LIKE ID oracle 성공. 이름/주소 전환 PG-03 미완. |
| AC9 | ✅ | 기존 MIME reader/store 회귀에서 첨부명 검색·nested/text 첨부 내부 sentinel 비색인 재확인. |
| AC17 | ⚠️ | UI 선택 저장의 실제 추출 바이트 확인·기존 변경 거절 회귀. 설치본 PST 추출·모델 승인 경로 미완. |
| AC19 | ⚠️ | 실제 worker ACK 및 화면 입력 확인. 대표/1만 전체 처리·RSS·cancel p95 미측정. |
| AC20 | ⚠️ | worker kill/timeout/reconnect와 projection rollback/reopen 성공. disk full·앱 restart·전체 commit 경계 미완. |
| AC21 | ⚠️ | UI 공유/마지막 source 제거와 늦은 상태 비반영 확인. 전체 lifecycle·cache/vector/evidence 삭제는 미완. |
| AC22 | ⚠️ | 전체 suite green, 빈 보관함+설정/페이지 실제 composition 성공. 전체 앱/설치본 조립은 미완. |
| AC23 | ⚠️ | 설정/페이지·오류·역전 응답 성공. 도구·범위 칩·근거 callback 경로는 미완. |

검산: ✅ 4·⚠️ 10 = 14. `Criteria-Met: 4/14`, `Criteria-Pending: AC2,AC3,AC4,AC7,AC17,AC19,AC20,AC21,AC22,AC23`. S1 관측 집합이며 전체 제품 완료를 뜻하지 않는다.

## [구현자 기입] r1.5 Review Signals — 사실만

- r1.5, 유효 V는 V1+ΔV2+ΔV3+ΔV4-A다. verify 없이 구현이 반복된 진단은 DIAGNOSE_ONLY로 유지했으며 지침·corpus를 수정하지 않았다.
- r1.4 미구현으로 남긴 설정·필터·구간을 구현하고 같은 사용자 계약으로 시험했다. 과거 성공 숫자를 현재 구현 증거로 대체하지 않았다.
- 합성 renderer도 실제 CSS scan/paint가 없으면 스크린샷이 부정확했다. 이번 runner는 production source scan과 offscreen paint를 기다려 캡처한다.
- 준비 훅의 exit 0만으로 Electron SQLite를 성공 처리하지 않았다. 강제 rebuild 후 실제 constructor/worker/화면 실행을 확인했다.
- PG-01~03은 그대로 남았으므로 보드와 plan 메타를 함께 plan/DRAFT로 되돌린다. 독립 verify는 수행하지 않았다.

## [구현자 기입] r1.6 설계 리뷰

사용자 답변 D-029~031을 반영한 ΔV5를 구현했다. PG-01/02의 제품 선택은 닫혔고 PG-03의 기술 전환은 남는다. 앞의 r1.4/r1.5 기록은 당시 관측이며 현재 상태는 이 보고를 따른다.

| 경계 | 구현 / 관측 |
|---|---|
| 손상 PST | 기존 source revision transaction을 유지하고 저장 후 오류·중단 후 DB 재개방 oracle을 보강했다. 새 staging의 메일·첨부·성공 counter가 공개되지 않고 이전 verified 결과와 ID가 유지된다. |
| 내부 EML | `MailArchiveService.importEmlBatch`가 정규화 패킷 전체를 먼저 검증하고 기존 job/epoch·파일별 staging/verify 경로를 사용한다. 원본 파일/MIME를 다시 읽지 않는다. |
| 읽기와 소비 | 실제 source child로 다음 EML을 읽는 동안 index 전달을 보류했다. 소비 Promise는 아직 미완료이며 이른 재주입은 거절된다. ACK 뒤 다음 입력과 같은 입력의 ID 재사용을 확인했다. |
| 입력 GUI | SourceManager부터 renderer API·preload·shared channel·main picker까지 EML 입력을 제거했다. picker는 PST만 제시하며 실제 반환 경로도 검사한다. 기존 EML 자료원의 검색·열람·제거는 유지한다. |
| 범위 / 다음 주체 | identity 알고리즘·DB migration·의존성은 변경하지 않았다. PG-03 규범 정정이 다음 planner 작업이며 S1 전체·독립 verify 완료를 주장하지 않는다. |

## [구현자 기입] r1.6 강제 지점과 V-pair 자기확인

검색은 입력·메일·revision·자료원이라는 주어로 했다. `rg -n 'pickEmlFolder|mailArchivePickEmlFolder|mailArchive\.(addFiles|addFolder|emptySources)|importEmlBatch|mailArchiveImport' app/src -g '*.ts' -g '*.tsx' -g '!*.test.*'`, archive subtree의 `sourcePath|mails|revision|fingerprint|epoch`, `recover|interrupted|abortRevision|verifyRevision|archive_verified_occurrence`를 찾아 실제 전달 edge와 조회 branch를 아래 자리에 대응했다. 기존 내부 file/folder reader는 GUI 진입점이 아니며 picker capability로 임의 경로를 주입할 수 없다.

| 자리 | 실제 edge / 직접 관측 |
|---|---|
| EP-22a | `eml-batch.ts` strict schema→UTF-8 본문/직렬화 batch 상한→canonical source 중복→소비자 ID 계산. 빈/과다/위조 ID/raw/fingerprint/path/date/size 입력 UT. |
| EP-22b | `service.ts` closed/removal/job guard→전체 prepare→active job/epoch→sourceIds 등록. 잘못된 두 번째 item은 첫 source도 쓰지 않는다. |
| EP-22c | normalized packet→공통 callback→index client의 upsert RPC→index worker/store. 원본을 지운 뒤에도 packet 본문을 저장하고 source parser 호출 0을 단언했다. |
| EP-22d | index commit ACK→source count→verify RPC→성공 counter→완료 Promise. 실제 worker fixture의 hold/release·중복 counter/ID·실제 UI 검색. |
| EP-22e | production source child 전처리→첫 소비 Promise→다음 원본 읽기 완료→이른 호출 거절→ACK 뒤 다음 소비. worker fixture 마지막에서 source/index child를 정리한다. |
| EP-22f | cancel/remove/close→epoch revoke→늦은 commit 거절→job settled. service의 세 경합 사례에서 완료 입력만 유지하고 제거된 source를 복원하지 않는다. |
| EP-23a | SourceManager의 PST 추가·보관함 이동, View/SourceManager의 PST 전용 빈 상태 문구. 실제 white/dark/narrow 화면; EML 버튼 복원 변이 red. |
| EP-23b | source-state의 add→pickFiles 한 경로. 중복 picker 차단·공유 상태/늦은 snapshot UT와 실제 UI. |
| EP-23c | renderer API의 폴더 picker 삭제. internal batch method는 renderer API에 없음; 실제 renderer의 API shape 단언. |
| EP-23d | preload 폴더 invoke 삭제, PST picker token→import는 유지. 실제 sandboxed preload/handler 왕복. |
| EP-23e | shared channel registry의 EML picker 삭제. generated inventory 갱신·없는 handler 단언. |
| EP-23f | main의 PST picker filter→반환 확장자 검사→기존 selection 폐기→one-use/window capability. EML 혼합 반환과 이전 token 재사용 거절 UT. |
| EP-24a | `readers/pst-walk.ts` item/subfolder 오류·개수 불일치 throw. 손상 table/subtree UT와 공개 PST 71메일 실기. |
| EP-24b | source worker 오류→실제 process host→service rejection. 실제 손상 PST header와 기존 source crash/오류 전달 fixture. |
| EP-24c | service의 source catch→abortRevision; 완료 전 source count는 전체 성공 counter에 더하지 않음. batch 저장 후 손상 사례의 inserted/messages 0. |
| EP-24d | store abort transaction→staging occurrence/고아 메일 정리. 이전 본문·메일/첨부 ID·공유 참조는 유지하며 검색 집합을 전후 대조. |
| EP-24e | search/get/stats/sources의 verified occurrence VIEW. 새 staging query 0·이전 get DTO 동일·total 동일, 실제 worker의 이전 scoped 검색 71개 동일. |
| EP-24f | store open→recoverStagingRevisions→interrupted 상태/미검증 occurrence 정리. 이전 자료원 수정과 첫 신규 PST staging을 남기고 재개방한 실제 SQLite oracle. |

ΔV5 지정 자리와 관측 자리의 차집합은 missing/extra 모두 0(18/18)이다. 보고 집합에서 EP-24f를 제외한 음성 대조는 missing 1을 반환했다. EP-21의 기존 epoch/ACK/identity 회귀는 실행했으나 §10 전체의 후속 tool/scope/vector/evidence 경로를 완료했다고 보고하지 않는다.

| 유효 S1 pair | 자기상태 | 증거 / 남음 |
|---|---|---|
| VP-26 | SELF_PASS | actual UI 9/9: PST 전용 설정·내부 EML의 검색/본문/첨부 저장, M-EML-GUI red. |
| VP-27 | SELF_PASS | service의 cancel/remove/close·late write, 실제 worker의 read/index overlap·ACK·조기 호출 거절, store interrupted reopen의 이전 PST snapshot. |
| VP-28 | SELF_PASS | 실제 SQLite와 source/index child의 내부 EML·PST 검색 ID/counter, actual preload의 private capability 및 picker guard. |
| VP-29 | SELF_PASS | pure validator·동일 입력 ID 재사용·손상 PST 저장 후 abort와 이전 ID/첨부 보존. |
| VP-25 | SELF_PASS | 기존 누적 revision·동일 Message-ID의 변경 본문·locator·공백 AND 계약 회귀 통과. |
| VP-01·02·03·07·08·09·13·14·17·18·19·23·24 | SELF_BLOCKED | 해당 S1 하위 경로 회귀는 통과. PG-03, ANSI/charset golden, 전체 앱 restart/commit fault/disk full, 대표 규모/설치본 및 각 pair의 후속 경계는 여전히 미완료. |

S1 자기결과는 SELF_PASS 5·SELF_BLOCKED 13이다. 새 독립 경로 네 pair의 성공을 전체 S1 pair 성공으로 확장하지 않았으며 독립 verify 결과가 아니다.

## [구현자 기입] r1.6 이번 라운드 수정의 잠금

| 선택 / 자리 | 정상 대조 | 적대 대조 / 판정 |
|---|---|---|
| M-EML-GUI / EP-23a | 실제 SourceManager의 PST 버튼과 EML 버튼 부재 단언, UI 9/9. | `node scripts/check-mail-archive-ui.mjs --restore-eml-gui`: 같은 production SourceManager에 EML 버튼만 복원해 `EML input GUI is absent` assertion 실패(exit 1). |
| M-WIRE / settings slot | 동일 실제 UI runner의 관리 탭→picker→job→검색 9/9. | `--remove-settings-slot`: 실제 SidebarUserButton의 slot만 제거해 `actual settings slot renders management` 실패(exit 1). |
| 입력/counter/ID/epoch/reopen | 기대 ID·DTO·counter·비노출·순서를 직접 단언한다. | 직접 oracle. 이 pair에 추가 mutation을 임의 선정하지 않았다. |

선택 mutation은 신규 M-EML-GUI와 영향 회귀 M-WIRE의 2행이며 검출 2다. 최초 mutation runner의 문자열 직렬화 오류는 oracle 실행 전 실패라 증거로 사용하지 않았고, 수정 후 위 assertion 실패를 확인했다. 기존 worker/package mutation 전체 감도는 이번 성공으로 대체하지 않는다.

## [구현자 기입] r1.6 Product/UX 파생 검토

| 사용자 상황 | 반영 / 관측 |
|---|---|
| PST를 다시 가져오다 손상 발견 | 새 revision 전체 비공개·실패 표시, 기존 검색 본문·ID 유지. 이전 raw 파일이 바뀌면 첨부 재추출은 fingerprint mismatch로 거절되며 첨부 바이트 상시 복제는 하지 않는다. |
| 내부 EML 저장 중 설정 닫기 | UI를 열 필요 없이 내부 API 실행 가능. UI 사례 5에서 완료 뒤 공유 자료원/검색 상태 갱신과 설정 닫기 독립성을 확인했다. |
| EML 자료원이 이미 보관됨 | 입력 버튼은 PST만 제공하고 보관된 EML의 검색·읽기·선택 추출·제거는 유지한다. actual UI 사례 1~5·8. |
| 다음 입력을 먼저 준비함 | 읽기는 현재 소비와 병행하고 다음 주입은 완료 ACK까지 기다린다. 현 소비+다음 준비 두 배치의 데이터 상한이며 전체 RSS 상한으로 해석하지 않는다. |
| 잘못된 내부 패킷 / 취소 | 전체 validation 실패는 쓰기 전에 거절. 취소·제거·close 후 늦은 입력은 공개되지 않고 호출자는 cancelled/실패를 관측해 다음 주입을 중단한다. |

## [구현자 기입] r1.6 놓친 잠재 문제 + 대응

| 관측 | 대응 / 남은 한계 |
|---|---|
| class index client를 spread한 시험 래퍼 | 실제 Electron 실행에서 prototype의 revoke/close가 누락됨을 발견했다. Proxy로 원래 receiver에 메서드를 bind해 UI/worker fixture를 수정하고 실제 실행·fixture typecheck를 재수행했다. production client 결함으로 분류하지 않는다. |
| 최초 설정 캡처가 이전 compositor frame | 폰트/renderer frame 이후 offscreen paint bitmap을 저장하고 실제 입력 완료 화면에서 캡처한다. 캡처 내용은 직접 열어 확인하며 DOM assertion만으로 시각 성공을 선언하지 않는다. |
| 정규화 패킷의 fingerprint 신뢰 | 전처리기 계약이다. 내부 소비자는 파일을 다시 읽지 않고 첨부 추출 때 원본 fingerprint를 검증한다. 임의 renderer/IPC 호출에는 이 API를 공개하지 않는다. |
| producer/consumer 에러 병행 | 문서 예제는 Promise.all로 즉시 두 rejection을 관측한다. 실제 전처리 producer 연결 시 실패/취소를 읽기 child에 전파해야 하며 무한 queue를 만들지 않는다. |
| 기본 prebuild가 캐시된 Node ABI를 재사용 | electron ABI check의 실패를 확인해 강제 electron-rebuild를 수행했다. 실제 constructor/worker/UI를 통과한 뒤 종료 상태를 기록하며 준비 hook 개선은 별도 조사 대상이다. |
| 형식별 payload·표시 이름 손실 | PG-03 유지. 이번 API는 기존 identity 계산을 쓰고 이미 사용 중인 mail/attachment ID나 occurrence를 재작성하지 않는다. |

## [구현자 기입] r1.6 구현 보고

| 항목 | 이번 턴에 관측한 산출 |
|---|---|
| 주요 변경 | strict normalized EML 내부 API·공통 job/epoch 소비, EML GUI/preload/channel 제거·PST picker guard, 손상 PST abort/reopen ID·첨부·counter oracle. |
| 관련 UT/IT | archive·handler·source-state 등 16파일 81 pass·1 benchmark skip. pure boundary와 실제 SQLite 경합/복구 포함. |
| 전체 회귀 | `vitest run --maxWorkers=2`: 615파일 pass·1파일 skip, 5,787 tests pass·2 skip. `node --test scripts/*.test.mjs`: 128 pass·0 fail. 마지막 UI 문구/fixture 수정은 actual UI 및 별도 static gate로 재확인했다. |
| 정적 gate | node/web/test typecheck 3/3. 전체 lint 0 error·기존 virtualizer warning 1; production source/index를 사용하는 두 fixture도 별도 TypeScript 프로젝트로 검사했다. |
| 문서/DB gate | append-only·migration sync/no-copy·doc inventory generated/prose/link 검사 성공. 이전 migration·package/lockfile 수정 없음. |
| 실제 실행 | Electron production worker 9/9; actual UI 9/9; M-EML-GUI·M-WIRE 각각 올바른 assertion에서 red. Vite main/preload/renderer 및 source/index child 산출 성공. |
| 시각 | 실제 CSS의 흰색·어두운 테마·좁은 창에서 PST 전용 설정과 기존 EML 자료원을 확인했다. 재생성 경로는 ignored `app/node_modules/.cache/orca/mail-archive-ui/`. |
| 범위 / 다음 주체 | ΔV5 구현 산출은 보존하고 PG-03을 planner에게 반환한다. S1 golden/규모/restart/설치본은 미완, S2/S3 OPEN은 그대로 유지한다. |
| 대상 커밋 | (r1.6 구현 — 검증자 기입) |

### r1.6 S1 AC 자기보고

| AC | 상태 | 이번 관측 / 남음 |
|---|---|---|
| AC1 | ✅ | 사용자 후속 결정대로 PST GUI와 normalized EML 내부 입력을 실제 UI/worker로 확인. |
| AC2 | ⚠️ | 손상 PST 이전 verified 보존·EML 본문/첨부·공개 PST 71메일 성공. 대표 ANSI/Unicode/charset golden 미완. |
| AC3 | ⚠️ | 실제 ACK/worker 취소 및 store/service의 이전 snapshot 재개방 성공. 전체 앱 restart oracle 미완. |
| AC4 | ⚠️ | 기존 가역 본문/구간·대체 표현 회귀 성공. 오래된 evidence/인용은 후속 경로. |
| AC5 | ✅ | 누적 revision·동일 ID의 변경 payload·ID-less locator 회귀와 손상 시 이전 ID 유지. |
| AC6 | ✅ | 기존 관계/누락/다중후보/순환/동일제목 분리 회귀 성공. |
| AC7 | ⚠️ | 실제 필드/날짜/폴더/literal/AND 검색 회귀 성공. 이름/주소·형식 통합 전환 PG-03 미완. |
| AC9 | ✅ | 실제 첨부명 검색/추출·기존 nested/text 첨부 내부 비색인 회귀 성공. |
| AC17 | ⚠️ | EML 선택 추출의 실제 바이트와 원본 변경 거절 확인. 설치본 PST 추출·후속 승인 경로 미완. |
| AC19 | ⚠️ | read/index overlap·유한 입력 상한·ACK 확인. 대표/1만 처리·RSS·cancel p95 미측정. |
| AC20 | ⚠️ | worker kill/timeout과 PST abort/reopen 성공. disk full·전체 앱 restart/commit fault 미완. |
| AC21 | ⚠️ | 내부 배치 cancel/remove/close·늦은 write 비공개와 실제 UI 제거 성공. 후속 cache/vector/evidence 삭제 미완. |
| AC22 | ⚠️ | 전체 회귀 green·실제 settings/preload/worker 조립 성공. 전체 앱/설치본 smoke 미완. |
| AC23 | ⚠️ | PST 전용 관리·공유 상태·오류·역전 응답 확인. 도구/범위/근거 callback은 후속 경로. |

검산: ✅ 4·⚠️ 10 = 14. `Criteria-Met: 4/14`, `Criteria-Pending: AC2,AC3,AC4,AC7,AC17,AC19,AC20,AC21,AC22,AC23`. 독립 ΔV5 완료와 전체 제품 완료를 구별한다.

## [구현자 기입] r1.6 Review Signals — 사실만

- r1.6은 사용자 요구 변경 턴이며 유효 V는 V1+ΔV2+ΔV3+ΔV4-A+ΔV5다. 지침·failure corpus를 수정하지 않았다.
- 사용자 답변으로 PG-01/02를 닫았으며 기존 source/identity 수명은 유지했다. PG-03은 아직 구현 승인된 전환 설계가 없어 plan/DRAFT와 planner 다음 주체를 함께 표시한다.
- 실제 프로세스 시험이 class spread 래퍼 결함을 검출했다. mock/정적 검사 성공으로 실제 실행 실패를 덮지 않았다.
- mutation의 build 오류와 지정 assertion의 실패를 구별했고 각각 수정·재실행했다.
- 독립 verify는 수행하지 않았다. 기술 전환의 규범 정정은 handoff-plan 역할과 별도 커밋으로 수행해야 한다.

## [구현자 기입] r1.7 설계 리뷰

**S3-A 구현 완료, 0244 전체는 partial이다.** D-034/035와 ΔV8을 따르며 앞의 r1.6 결과는 당시 범위의 기록으로 보존한다. 사용자 정정으로 Bootstrap 자동 등록 해석을 폐기했고, Deployment 계약·파일을 수정하지 않았다.

| 경계 | 구현 / 이번 관측 |
|---|---|
| 표준 Plugin | `plugin.ts:40`의 `createMailArchiveToolServer(): RuntimeToolServer`가 동일 서버/handler를 반환한다. 실제 registry 반복 추가에서 revision 불변, SDK에서 읽기 도구 4개 실행. |
| 등록 owner | archive server는 기본 registry에 없다. 사용자 배포 역할의 fixture가 팩터리를 추가한 뒤 활성 상태로 바뀐다. `git diff --name-only -- app/src/main/app/deployment` 출력 0줄. |
| Bootstrap | 기존 단일 archive service/index writer를 backend로 설치하고 trusted IPC·core session 폐기·종료에 연결한다. backend close 이후 도구는 isError이고 registry 소유권은 호출자에게 남는다. |
| S3-A 검색 | `archive_search/get/thread/context`는 keyword 전용이며 semanticAvailable=false를 반환한다. source/date scope를 후보 LIMIT 전에 적용하고 원본 reader를 재실행하지 않는다. |
| 공개 계약 | shared/preload/renderer의 state·setScope·resolveEvidence 세 호출은 strict/trusted 입력만 받는다. normalized EML 입력은 내부 함수로 유지하며 MCP·GUI 입력으로 공개하지 않는다. |
| SDK 경계 | 기존 raw-shape 입력 포트를 보존하고 optional inputObjectSchema를 추가했다. 실제 SDK가 알 수 없는 키를 먼저 버리던 문제를 strict Zod object 전달로 막았으며 sessionId 위조가 isError다. |
| 설계 선택 / 남음 | 임베딩은 로컬 전용/API reserved(D-033)를 승계하되 실 모델은 구현하지 않았다. PG-03·전체 품질/성능/설치본·사내/Bedrock 실 답변은 이 구현 결과로 닫지 않는다. |

## [구현자 기입] r1.7 강제 지점과 V-pair 자기확인

등록·세션·자료원·근거라는 주어로 production edge를 조사했다. 재현 검색은 `rg -n 'runtimeTools\.(add|remove)|createPluginBindings|mailArchive' app/src/main/app/bootstrap.ts app/src/main/app/deployment/plugins.ts`, `rg -n 'pluginRequest|waitForSession|throwIfAborted|inputObjectSchema|readOnlyHint' app/src/main/adapters app/src/main/features/plugins/mail-archive`, `rg -n 'sourceIds|sentAfter|sentBefore|scope|archive_verified_occurrence' app/src/main/features/plugins/mail-archive`, renderer의 `resolveEvidence|epoch|useChatSession|mail-evidence|MarkdownLink|builtinMcp|<mark|focus`다. 테스트 파일은 production 자리에서 제외했다.

| 자리 | 실제 edge / 이번 직접 관측 |
|---|---|
| EP-26a | `plugin.ts:40` 공개 팩터리→module cached server. `mail-archive-plugin.test.ts:154`에서 객체 동일·중복 등록 revision 불변·SDK 네 도구 실행. |
| EP-26b | `bootstrap.ts:970/990/871` backend 설치 호출·준비/prune·종료. 실제 Bootstrap 메서드 UT에서 service 1회·trusted handler·기본 registry 0·close 후 거절. 연결 제거/자동 등록 추가 변이 각각 red. |
| EP-26c | 사용자 registry.add→snapshot→`claude-runtime-tools.ts:85` SDK. actual UI 10/12의 미등록→등록 전환, 12/12의 MCP Client→production worker→본문 근거. |
| EP-26d | `tools.ts:132/138` readOnlyHint·strict object→SDK 입력 검증→handler safeParse. 실제 SDK의 sessionId 추가 인수 거절 및 IPC unknown field·날짜 역전 UT. |
| EP-26e | adapter의 context→`tools.ts:100` waitForSession(signal)→core session 존재→lease. no-scope·다른 세션·실세션 삭제·abort 네 경합에서 isError. |
| EP-26f | `router.tsx:38`→PluginsPage→ExtensionsCatalogView MCP 슬롯→app PluginSlot→관리 목적지. UI 10/12에서 inactive 문구·저장 확인, 같은 production 관리 슬롯은 UI 1~9에서 실행. |
| EP-27a | PluginCard의 저장된 대화·자료원·날짜→shared API. actual UI 10/12의 s1/enron.pst 허용 저장, 날짜 경계는 SQLite/IPC UT에서 기대 ID·역전 거절. |
| EP-27b | `handlers/mail-archive-plugin.ts` trusted sender+strict schema→`plugin.ts` core session 검사. 세 IPC 호출의 untrusted/위조 필드 거절·정상 forwarding UT. |
| EP-27c | `plugin-store.ts:47/85` persisted scope/token/corpus revision→RPC lease 검사. 더 넓은 위조 lease 거절, 같은 정상 필드의 순서 변경 허용, reopen의 저장 scope 유지. |
| EP-27d | `store.ts:759`→scope-sql occurrence/date→FTS/LIKE WHERE→LIMIT. 외부 메일 40개를 먼저 넣은 두 분기에서 허용된 정확 ID만 반환. 같은 occurrence에서 source/folder를 교차 적용. |
| EP-27e | `store.ts:838/875`, `plugin-store.ts:168`의 get/thread/resolve 세 소비자. scope 밖 root/중간 edge 제외, 공유본의 허용 위치·NULL folder 유지, 다른 세션 근거는 forbidden. |
| EP-27f | `tools.ts:106~111`, `plugin.ts` resolve 반환 직전 signal/token/revision/core 검사. 읽기 뒤 scope 해제·source 제거·core 삭제·abort의 늦은 반환 isError. UI 11/12는 늦은 출처 응답을 세션 전환 후 폐기. |
| EP-27g | Bootstrap session 폐기→dispose, 시작→전체 core session(-1) prune, 기존 source remove→occurrence purge/revision. 마지막 source 삭제 근거는 removed, 공유본 유지, reopen의 orphan scope/evidence 삭제·stale lease 거절. |
| EP-28a | context-packing 원문 RegExp/UTF-16 연속 slice→`tools.ts:79` 전체 MCP envelope 64 KiB. 원문 slice 일치·surrogate pair·İ 위치·과다 메타데이터/6근거 예산·첨부 sentinel 제외 UT. |
| EP-28b | `plugin-store.ts:129` evidence transaction 완료→worker ACK→MCP 반환. 반환된 모든 opaque ID를 같은 세션에서 resolve하고 content와 structuredContent의 본문 동등 확인. |
| EP-28c | `plugin-store.ts:168` session+opaque ID→허용 occurrence/hash→원문 span. scope 해제 forbidden, 마지막 메일 삭제 FK tombstone removed, 재개방 동일 span. |
| EP-28d | shared MarkdownLink/internal context→app EvidenceBridge, StreamingMarkdown도 같은 Markdown 경로. actual UI 12/12에서 완료·진행 링크를 각각 눌러 실제 persisted ID 열람. |
| EP-28e | Viewer mark/scroll/close→app focus 복원. UI 12/12에서 mark.textContent===evidence.text·Tab 고정·닫은 뒤 원래 링크 focus. white/dark 640px 캡처를 직접 열어 줄바꿈/본문/닫기 확인. |

S3-A 조사 자리 18개를 §10 EP-26(6)·27(7)·28(5)에 대응했다. 이 보고의 자리 집합과 §10 집합의 missing/extra 차집합은 각각 0이며 EP-28e를 제외한 음성 대조는 missing=1이다. EP-27e의 세 조회 branch 및 EP-28d의 완료/진행 소비자를 따로 실행했다. 이 결과는 §10의 vector/cache/export/설치본 전체 자리 종결을 뜻하지 않는다.

| 유효 pair | 자기상태 | 이번 증거 / 남음 |
|---|---|---|
| VP-30 | SELF_PASS | 실제 공개 팩터리→사용자 등록→SDK→worker→UI. 기본 미등록·허용 저장·검색/조회·출처·M-ARCHIVE-FACTORY red. |
| VP-31 | SELF_PASS | SQLite reopen/prune/tombstone·네 late 경합, backend close·실세션 검사, actual UI 11의 세션 전환/지연 응답/타 세션 거절. |
| VP-32 | SELF_PASS | 실제 SDK Client에서 네 도구·content/structuredContent, actual Electron SDK→index child 왕복·source reader fork 불변. Bootstrap 연결/자동 등록 oracle 변이 red. |
| VP-33 | SELF_PASS | strict SDK+IPC·source/date/folder의 pre-LIMIT SQL·6근거/64 KiB·정확 UTF-16·persisted ID·첨부 내용 제외. 직접 oracle. |
| VP-06·08·16·22·23 | SELF_BLOCKED | 이번 영향 범위의 scope/evidence/SDK·UI 역전·기존 MIME/권한/registry 회귀 성공. 각 pair 전체의 cache/vector/export 승인·설치본·사내 endpoint·품질 flags 전수 및 등록 M-SCOPE/M-CITE/M-WIRE 전체는 미완료. |
| VP-01~05·07·09~15·17~21·24~29 | SELF_BLOCKED | 현재 관련 S1 회귀·worker/UI 성공과 r1.6의 하위 경로 증거를 보존한다. 전체 pair의 golden·PG-03·S2·타임라인 품질·성능/설치본은 미완료. r1.6 SELF_PASS를 현재 전체 계약 통과로 확대하지 않는다. |

검산: 이번 S3-A REQUIRED 4 SELF_PASS·영향 REGRESSION 5 SELF_BLOCKED, 나머지 상속 24 SELF_BLOCKED = 유효 pair 33. 독립 verify 결과가 아니다.

## [구현자 기입] r1.7 이번 라운드 수정의 잠금

| 선택 / 자리 | 정상 대조 | 적대 대조 / 이번 관측 |
|---|---|---|
| M-ARCHIVE-FACTORY / VP-30·32, EP-26a/c | `node scripts/check-mail-archive-ui.mjs`: SDK→worker→출처 포함 12/12. | `--empty-archive-factory`: 공개 팩터리만 tools/implementations 빈 서버로 바꿔 SDK listTools가 MCP -32601로 실패(exit 1). UI 1~10은 실행 완료, 빌드/ABI 실패가 아니다. |
| 새 Bootstrap 연결 oracle / EP-26b | `vitest run src/main/app/bootstrap.mail-archive.test.ts`: 1/1. | 실제 `this.registerMailArchive(ctx)`를 `void ctx`로 바꿔 같은 suite의 연결 match assertion red(1/1 fail). 원복 후 1/1. |
| 새 자동 등록 부재 oracle / EP-26b | 실제 Bootstrap backend 호출 뒤 registry size 0. | 같은 메서드에 빈 archive server registry.add를 추가해 예상 0/관측 1 assertion red. 원복 후 1/1. |
| 새 자리 집합 차집합 oracle / 보고 전수 | §10와 보고 EP 집합 missing/extra 0. | 관측 집합에서 EP-28e 제거→missing 1·extra 0. 총계 합으로 차집합을 대신하지 않는다. |

잠금 검산: 선택 증거 1·인용 변이 0·새 oracle 3 = 표 4행, 적대 대조 4/4 검출. 그 밖의 직접 입력/ID/span/순서 oracle은 추가 변이를 선택하지 않았다. ΔV7의 Bootstrap 등록 제거 M-ARCHIVE-MCP는 ΔV8에서 적용 종료다. 상속 전체 M-SCOPE/M-CITE/M-WIRE/M-PACK 감도는 이번 4행으로 대체하지 않는다.

## [구현자 기입] r1.7 Product/UX 파생 검토

| 사용자 상황 | 구현 / 이번 관측 |
|---|---|
| 기본 배포에서 archive 도구가 없음 | Plugin MCP 카드에서 AI 도구 비활성 문구와 대화별 허용 설정을 보여 준다. 사용자 역할로 등록한 뒤 다시 확인하면 활성 문구. actual UI 10. |
| 대화/자료원·기간을 허용 | 사용자만 trusted IPC로 저장하고 모델 인수로 범위를 늘릴 수 없다. 자료원과 날짜는 AND, 종료일은 기존 검색과 같은 로컬 inclusive-day 규칙. |
| 근거 클릭 | 완료/진행 모두 같은 persisted 원문을 열고 날짜·보낸 사람·허용된 자료원 위치를 표시한다. 정확 mark·키보드/닫기 focus와 두 테마의 좁은 창을 확인했다. |
| 출처 읽기 중 대화 전환 | 즉시 viewer를 닫고 이전 Promise를 버린다. 같은 링크를 새 세션에서 누르면 forbidden 안내, 이전 세션 복귀로 viewer가 되살아나지 않음. actual UI 11. |
| 허용 해제 / 자료원·세션 삭제 | 검색은 isError, 링크는 forbidden/removed 안내. shared source가 남으면 해당 허용 occurrence로 열고 마지막 source 삭제는 tombstone. |
| 단어검색 근거가 부족함 | keyword/semanticAvailable=false·insufficient/truncated를 반환한다. 실 모델·타임라인 coverage가 완료된 것처럼 표시하지 않는다. |

## [구현자 기입] r1.7 놓친 잠재 문제 + 대응

| 관측 | 대응 / 남은 한계 |
|---|---|
| SDK raw-shape가 unknown 키를 제거 | optional full Zod object를 실제 SDK adapter에 전달해 strict 검증을 유지했다. raw-shape를 쓰는 기존 Jira 등 인터페이스는 보존하고 adapter/registry 회귀 56개 재확인. |
| 공유 메일 canonical folder의 privacy fallback | scoped get/thread에서 허용 occurrence의 NULL folder를 그대로 반환한다. 비허용 첫 자료원의 폴더가 fallback으로 섞이지 않음을 공유본 UT에서 단언했다. |
| Unicode case-fold offset | lowercased 문자열의 인덱스를 원문에 쓰지 않고 원문 RegExp offset을 사용한다. İ/emoji·surrogate boundary의 원문 slice oracle. |
| 보수적 corpus revision | staging occurrence 변경도 in-flight read를 무효화한다. 데이터 비노출을 우선하며 가져오기 중 도구가 index_changed로 재시도를 요구할 수 있다. |
| 반환 전 취소된 evidence | persist 후 취소되면 반환되지 않은 evidence row가 세션 정리까지 남을 수 있다. 모델/다른 세션에 노출되지는 않으며 보관량 정책은 후속 검토. |
| source 허용 JSON 수명 | 삭제 source ID가 기존 scope JSON에 남아도 SQL은 없는 occurrence를 허용하지 않는다. 같은 canonical source 재등록 시 기존 허용의 승계 정책은 후속 제품 검토로 남긴다. |
| 오래된 대화 선택 범위 | 카드의 대화 목록은 현재 공통 session.list 계약을 따른다. 목록 상한 밖 대화의 선택 UX 개선은 후속 검토이며 backend prune는 전체 core sessions(-1)를 쓴다. |
| theme/resize와 offscreen paint | 첫 white/narrow 캡처가 이전 frame이어서 viewport 확인·paint 안정화 뒤 재촬영했다. 최종 캡처를 직접 열어 white/dark 640px viewer 확인. |
| 네이티브 ABI | prebuild가 Node ABI127 캐시를 재사용해 UI 시작을 막았다. Electron39.8.10 강제 rebuild 뒤 worker 9/9·UI 12/12. 이번 종료 ABI는 Electron이며 hook 캐시 개선은 별도 조사. |
| 전체 품질 / 실 배포 | PG-03·로컬 실 모델·context 타임라인/quote coverage·MCP 첨부 추출 승인·사내/Bedrock·Windows installer는 미완료로 남긴다. |

## [구현자 기입] r1.7 구현 보고

| 항목 | 이번 턴 관측 산출 |
|---|---|
| 주요 변경 | 표준 cached Plugin 팩터리·keyword 도구 4개, 실제 session/source/date scope·SQL·persisted evidence, Bootstrap backend/IPC 수명, MCP 관리 카드·완료/진행 출처 viewer. |
| 관련 UT/IT | archive·신규 Bootstrap/IPC/factory·adapter/registry·inventory/App composition 관련 21파일 130 pass·1 benchmark skip. 후속 adapter/IPC/Bootstrap/문서/App 8파일 56 pass 재실행. |
| 전체 회귀 관측 | 전체 Vitest 첫 실행은 619파일 중 3 fail·615 pass·1 skip, 5,796 pass·3 fail·2 skip. 신규 IPC inventory/documentation 두 기대값과 App provider 기대값을 수정하고 해당 suite를 위 관련 집합에서 재실행했다. 수정 후 전체 재실행 결과로 기록하지 않는다. |
| scripts | `node --test scripts/*.test.mjs`: 128 pass·0 fail·0 skip. |
| 정적 gate | npm typecheck node/web/test 3/3·별도 production worker/UI-main fixture tsc 성공. 전체 ESLint 0 error·기존 virtualizer warning 1. 마지막 UI fixture formatting warning은 수정 후 0. |
| 문서/DB gate | inventory generated/prose/link·append-only/sync/no-copies·test-budgets·git diff check 성공. migration0007 추가, 이전 migration·package/lockfile·Deployment 변경 없음. |
| 실제 실행 | Electron source/index worker 9/9, 실제 SDK→worker→sandboxed preload→renderer UI 12/12. 빈 팩터리·Bootstrap 두 변이가 지정 oracle에서 red, 원복 control 성공. |
| 빌드/시각 | npm build 및 최종 electron-vite main/preload/renderer/worker 산출 성공. Plugin 카드·완료/진행 viewer·white/dark 640px PNG를 직접 검사. 설치본 성공으로 해석하지 않는다. |
| 범위 / 다음 주체 | ΔV8 S3-A를 impl/IMPL_DONE으로 검증자에게 넘긴다. 전체 0244는 partial이며 기존 미완료와 PG-03·S2·나머지 S3는 보존한다. |
| 대상 커밋 | (r1.7 구현 — 검증자 기입) |

### r1.7 전체 AC 자기보고

| AC | 상태 | 이번 관측 / 남음 |
|---|---|---|
| AC1 | ✅ | 실제 PST GUI·normalized EML 내부 API 검색/본문·EML 입력 비공개, UI 1/9·worker 8. |
| AC2 | ⚠️ | 공개 PST 71메일·손상 보존 회귀 성공. 대표 ANSI/Unicode/charset golden 미완료. |
| AC3 | ⚠️ | cancel/ACK·손상 staging 비공개·store reopen 회귀 성공. 전체 앱 restart 미완료. |
| AC4 | ⚠️ | 가역 원문/대체 본문·persisted span/reopen 성공. 재색인·원본 이동 후 기존 인용 전체 시나리오 미완료. |
| AC5 | ✅ | stable identity·누적 revision·변경 payload/ID-less locator·손상 시 이전 ID 회귀. |
| AC6 | ✅ | 역순/누락부모/다중후보/순환/동일제목 관계 회귀와 scoped thread 확인. |
| AC7 | ⚠️ | 날짜/source/folder/AND·FTS/LIKE 정확 집합 성공. 이름/주소·형식 통합 PG-03 미완료. |
| AC8 | ⚠️ | keyword 결과와 semanticAvailable=false 확인. hybrid/vector/degraded 세대 미구현. |
| AC9 | ✅ | 기존 MIME nested/text 첨부 제외·첨부명 검색, 새 context payload의 첨부 sentinel 제외. |
| AC10 | ⚠️ | 로컬 전용 결정 보존. 실 로컬 모델·오프라인 vector golden 미구현. |
| AC11 | ⚠️ | 임베딩 API reserved 결정 보존. local-only profile/worker/API 활성 거절 경로 미구현. |
| AC12 | ⚠️ | embedding generation/profile/cache 전환·중단·재시작 미구현. |
| AC13 | ⚠️ | opaque ID·same-session 원문 span·tombstone/reopen·실제 클릭 성공. 재색인/영구 version 이동 전체 미완료. |
| AC14 | ⚠️ | bounded keyword context·insufficient/truncated 구현. 정답 타임라인·승인/상충·quote coverage 미완료. |
| AC15 | ⚠️ | 완료/진행·exact mark·키보드/focus·640px 두 테마·세션 전환 성공. 관계 근거·전체 답변 복귀 실기 미완료. |
| AC16 | ⚠️ | 두 source/session·SQL scope·거절/late read 성공. MCP 승인 첨부 추출·vector/cache scope 경로 미완료. |
| AC17 | ⚠️ | 기존 GUI 선택 추출 바이트/원본 변경 거절 회귀. 설치본 PST 추출·모델 승인 도구 미완료. |
| AC18 | ⚠️ | 실제 SDK handler→worker 성공. 사내서버·Bedrock 각각의 실 답변 미수행. |
| AC19 | ⚠️ | read/index overlap·유한 배치·ACK 회귀. 대표 PC/1만·5만/RSS/p95 미측정. |
| AC20 | ⚠️ | worker crash/timeout/재연결·store reopen 성공. disk full·전체 앱/embedding commit fault 미완료. |
| AC21 | ⚠️ | source/session purge·shared 유지·evidence tombstone/late 반환 거절. 후속 vector/cache 삭제 미완료. |
| AC22 | ⚠️ | 관련 adapter/MIME/권한/registry·Bootstrap backend 회귀 성공. 기본 전체 앱/설치본 smoke 미완료. |
| AC23 | ⚠️ | 실제 관리→검색·MCP scope→근거·오류/역전 응답 성공. 후속 semantic/cache·전체 앱 연결 미완료. |
| AC24 | ⚠️ | 개발 빌드/source/index 실행 성공. Windows installer·로컬 추론·배포 manifest 실기 미완료. |
| AC25 | ✅ | 표준 cached 팩터리→사용자 registry→실제 SDK/worker 도구, 기본 미등록·trusted scope·persisted 출처·revoke/reopen/late UI 성공. |

검산: ✅ 5·⚠️ 20·❌ 0 = 전체 AC 25. ΔV7에서 AC25가 추가되었으며 이전 r1.6의 S1 하위 집합 14를 이번 전체 분모와 직접 비교하지 않는다. `Criteria-Met: 5/25`, `Criteria-Pending: AC2,AC3,AC4,AC7,AC8,AC10,AC11,AC12,AC13,AC14,AC15,AC16,AC17,AC18,AC19,AC20,AC21,AC22,AC23,AC24`.

## [구현자 기입] r1.7 Review Signals — 사실만

- r1.7은 사용자 등록 owner 정정 턴이다. ΔV7/ΔV8 설계와 구현 커밋을 분리했고 유효 V는 V1+ΔV2+ΔV3+ΔV4-A+ΔV5+ΔV6+ΔV7+ΔV8이다.
- 최초 Bootstrap 자동 등록 해석을 D-035로 정정했다. Deployment 계약은 그대로 두고 실제 factory caller와 backend lifecycle를 분리했다.
- SDK unknown-field 제거·Unicode offset·공유 NULL folder는 새 실행 경계에서 발견해 고쳤다. mock/직접 handler 성공만으로 SDK 성공을 보고하지 않았다.
- prebuild의 네이티브 캐시 문제가 반복됐다. actual constructor/worker/UI 실행 후 ABI를 기록하며 지침·failure corpus는 수정하지 않았다.
- 첫 전체 테스트의 inventory/App 기대값 실패를 관련 재실행으로 닫았고, 전체 재실행 성공으로 바꾸어 적지 않았다.
- 이번 independent verify는 수행하지 않았다. S3-A 자기결과와 전체 제품 미완료를 plan 메타·보드·AC·구현 trailer에 함께 표시한다.

## [검증자 기입] 파생 이슈

미착수. 구현 산출 후 [handoff-verify](../../../.agents/skills/handoff-verify/SKILL.md)로 수행한다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| 미기입 | — | — | — | — | — |
