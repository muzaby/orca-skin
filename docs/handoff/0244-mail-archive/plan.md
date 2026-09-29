# Plan — 0244-mail-archive

> 작성자 **Codex**. 사용자 지시에 따라 `main`에서 작성한 독립 비교안이다. 다른 브랜치의 동명 계획·결정·승인을 상속하지 않는다.
> 절차: [handoff-plan](../../../.agents/skills/handoff-plan/SKILL.md) · 상태와 V 규약: [handoff/AGENTS.md](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0244-mail-archive` |
| 작성자 | Codex |
| 일자 | 2026-09-29 |
| 매핑 | PR 브랜치 `codex-0244-mail-archive-plan` → `main` |
| 조사 기준 | `f2f60ac338f2847f81a6cbc426f0728b7eb8d98e` (`git cat-file -t` → commit 확인) |
| 상태 | **DRAFT — 비교·선택용 설계 완료, 구현 착수 전 D-014~D-016 해소 필요** |
| V mode / 기준 V | `Baseline V` / `none` |
| 이번 V revision / 유효 V | `V1` / `V1` |

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
| D-012 | 파싱·DB·로컬 추론·벡터 스캔은 자식 프로세스, API 요청만 main의 Chromium 전송 포트 | 대량 PST 처리 중 UI와 취소 응답 유지 | Codex 제안 | ACTIVE | AC3·11·19·20 |
| D-013 | main 기준 독립 0244, 작성자 Codex | “비교 후 선택할 것이다” | 사용자 | ACTIVE | 문서 게이트 G-DOC |
| D-014 | PST·로컬 임베딩 신규 의존성 최종 채택 | §17 후보 검증 후 패키지 도입 승인 필요 | 저장소 의존성 규칙 | **OPEN** | AC2·10·24 / S0 |
| D-015 | 첫 로컬 모델 팩과 API 프로토콜·인증·모델 리비전 | “지원 가능”을 특정 모델/서비스 승인으로 해석하지 않음 | 미제공 환경 정보 | **OPEN** | AC10~12 / S0 |
| D-016 | 기준 PC·대표 자료로 §14 예산의 실행 가능성 확정 | 성능 SLA를 임의 확정하지 않음 | 저장소 미정 항목 + 실측 필요 | **OPEN** | AC19·24 / S0 |

갱신 메모: 신규 Baseline V이며 SUPERSEDED·상속 결정은 없다. 이번 대화의 “로컬·API 모두”를 유지하고, 다른 계획에서만 있었던 라이브러리 승인·모델 선택·배포 범위는 사용자 결정으로 기록하지 않았다.

ACTIVE 결정 ↔ AC 대조: D-001~D-012는 표의 AC에서 같은 동작을 요구하고 충돌 0, 문서 출처에 관한 D-013은 G-DOC로 확인했다. D-014~D-016의 검증 대상·선택 조건은 §11 S0에서 고정하고, 이 항목을 숨긴 채 READY로 넘기지 않는다.

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
- 기본 화면은 제목·본문·첨부 이름을 검색한다. 이름 전용 입력/필터와 보낸 사람·받는 사람·참조·기간·자료원·PST 폴더 필터를 제공한다.
- 각 결과는 제목, 발신자, 메일 날짜, 일치 문단, 자료원, 첨부 수, `단어 일치`/`의미 유사`의 근거를 보인다. 내부 벡터 점수를 신뢰도 백분율로 표시하지 않는다.
- 발신자 이름이 같으면 주소를 함께 표시하고 사용자가 선택한다. 날짜 없는 메일은 `날짜 미상`으로 표시하며 가져온 날짜로 시간순 사건을 만들지 않는다.
- 결과는 관련도순, 대화 뷰는 메일 날짜순이다. 단순 제목 유사 후보는 `관련 대화 후보`로 분리하고 답장 연결선에 섞지 않는다.
- `이 범위로 질문`은 검색 범위를 채팅에 전달하고 입력창에 범위 칩을 남긴다. 현재 결과의 일부만 물으려면 `선택한 메일로 질문`을 사용한다.
- 범위를 지정하지 않은 일반 채팅에서 메일 도구가 호출되면 `검색할 보관함 선택` 동작을 제시한다. 모델이 임의로 모든 보관함을 선택하지 않는다.
- 답변은 결론·시간순 경위·변경 조건·확인되지 않은 부분을 구분한다. 판단을 뒷받침하는 문장에 출처를 붙이고 “검색 범위에서 최종 승인 메일을 찾지 못함”과 “승인되지 않음”을 구별한다.

### 상태·실패·전이

| 사건/상태 | 사용자에게 보이는 결과 | 다음 행동 |
|---|---|---|
| 스캔/파싱/저장/임베딩 중 | 처리 단계·완료/제외/실패 수, 전체 미확정 시 퍼센트 대신 건수 | 자료원별 취소, 화면 이동 |
| 일부 메일만 가져옴 | `일부 자료만 검색됩니다` + 현재 검색 가능 수 | 현재 자료 검색 / 처리 계속 |
| 손상 EML/PST 항목 | 실패 이유와 항목 식별자, 정상 항목은 유지 | 실패 항목만 재시도 / 실패 목록 저장 |
| 원본 이동·오프라인 | 저장 본문 열람·검색 가능, `원본 연결 필요` | 경로 재연결; 첨부 추출 비활성 |
| 원본 내용 변경 | 저장된 버전과 변경 표시, 옛 첨부 추출 거절 | 재가져오기 후 새 버전 확인 |
| 키워드 0건 | 적용 필터와 검색 범위 표시 | 필터 해제·기간 확대를 명시적으로 선택 |
| API 인증 오류/오프라인 | `의미검색을 사용할 수 없어 단어로 검색했습니다` | 설정 열기 / 재시도; 자동 외부 공급자 변경 없음 |
| 새 모델 색인 중 | 기존 의미검색 유지, 새 색인 진행률 표시 | 취소 / 준비 후 전환 |
| 작업 취소·앱 종료 | 취소 시 저장된 배치 유지, 재시작 시 `중단됨` | 재개·재시도. 자동 전량 재전송하지 않음 |
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
| R-01 | AT-02 / AC2 | 한글·HTML EML 및 ANSI/Unicode PST의 지정 메일·폴더·첨부 메타데이터를 읽음 | 합성/배포 허용 fixture의 기대 필드 전수 대조, 손상/비메일 항목 제외 이유 | OS 등록→reader→normalize→DB |
| R-01 | AT-03 / AC3 | 부분 저장 중 검색 가능, 작업별 취소·재개 때 중복과 미저장 성공 표시 없음 | 배치 전/후 중단·재시작 삽입 후 저장 건수·상태 대조 | 작업 UI→service→worker→DB→event |
| R-02 | AT-04 / AC4 | 인용·서명 포함 본문 열람과 옛 인용은 재색인/원본 이동 후에도 동일 | 버전 해시·UTF-16 범위로 표시 문장 일치, HTML script/외부 이미지 실행·요청 없음 | reader→version→본문/근거 뷰어 |
| R-02 | AT-05 / AC5 | 재등록은 occurrence만 추가, 같은 Message-ID의 다른 본문은 별개 보존; 기간·원본 소실로 삭제 안 됨 | 같은 ID/다른 내용·ID없음·복사본·동일 stat 변경 fixture, 결과/버전 직접 비교 | rescan→identity→transaction→search |
| R-02 | AT-06 / AC6 | 역순 수집에도 Reply/References 연결 복원, 유사 제목만으로 확정 병합 안 함 | 역순/누락부모/다중후보/순환/동일제목 fixture의 edge kind·시간순 대조 | normalize→relations→thread view |
| R-03 | AT-07 / AC7 | 한두 글자 한글·혼합 검색·문서번호·이름/주소·기간/폴더 필터가 함께 적용 | `QA 승인 AB-12`, `%_`, 동명이인 fixture에서 정확한 mail ID 집합 | UI/tool→query plan→SQL→results |
| R-03 | AT-08 / AC8 | 메일별 중복 chunk를 합친 hybrid 결과를 보여 주고 의미검색 장애 시 단어검색 유지 | 각 검색 분기의 관련메일 포함·중복 1회·degraded 상태·페이지 안정성 | search→lexical/vector→fusion→UI |
| R-03 | AT-09 / AC9 | 첨부 이름으로 메일을 찾되 첨부 내부에만 있는 문자열은 검색·질문 근거에 나오지 않음 | 이름 `견적.xlsx`, 내부 고유문구 sentinel을 가진 fixture; parser/index/embed/LLM payload 대조 | attachment manifest→filename index→search |
| R-04 | AT-10 / AC10 | 네트워크 없이 선택한 로컬 모델 팩으로 문서/질의를 같은 규약으로 임베딩 | 실 모델 golden input의 차원·수치 허용오차·검색 결과, 전송 포트 호출 없음 | settings→local worker→generation→search |
| R-04 | AT-11 / AC11 | API 프로필로 색인·질의 임베딩하고 취소·401·429·형상 오류를 구분 | mock + 승인 endpoint 계약 실증, 순서 뒤바뀐 벡터·NaN·잘못된 차원 거절 | worker→main transport→API→validated vectors |
| R-04 | AT-12 / AC12 | 모델 변경·중단·재시작에도 query/document 모델이 섞이지 않고 완성 세대만 전환 | 실패 위치별 활성 포인터·임베딩 fingerprint·구세대 조회 일치 | profile→staging→activate→query lease |
| R-05 | AT-13 / AC13 | 답변 출처는 당시 메일 버전 문단을 열며 조작된 출처 ID는 열리지 않음 | evidence 저장 전 반환 실패·재색인·세션 위조·임의 URL 입력 대조 | context→evidence DB→MCP→Markdown→viewer |
| R-05 | AT-14 / AC14 | 질문의 연대기에서 요청/변경/반대/승인 근거를 남기고 누락·잘림·미확인을 표시 | 고정 정답 타임라인 fixture로 context coverage, 승인 누락/상충 질의 평가 | seeds→bounded expansion→context→answer |
| R-05 | AT-15 / AC15 | 인용 뷰어에서 날짜·당사자·일치 문단·관계 근거를 확인하고 검색/답변으로 복귀 | 스트리밍/완료 인용 클릭, 좁은 창·키보드·세션전환 상태 대조 | Markdown callback→evidence IPC→viewer |
| R-06 | AT-16 / AC16 | 선택 범위 밖 메일이 검색·확장·출처·첨부에 섞이지 않음 | 서로 다른 두 자료원·두 세션 및 위조 ID/필터 확장 요청에 대해 결과 집합 대조 | session scope→service→all read/export paths |
| R-06 | AT-17 / AC17 | 선택 첨부만 추출, 원본 변경/소실은 명시 오류, 모델 호출은 기존 승인 경유 | 바이트 해시·추출 파일 수, 원본 변경 race, 승인 false/undefined/true 정책 확인 | UI export/tool approval→validated occurrence→Temp |
| R-06 | AT-18 / AC18 | 기존 사내서버·Claude(Bedrock) 각각에서 같은 archive 도구로 근거 있는 답변 가능 | 각 실제 실행 경로에서 MCP result·출처 클릭·취소 확인, 기능별 품질평가 | current harness→runtime tool→context→answer |
| R-07 | AT-19 / AC19 | 대량 처리 중 화면 입력·취소 가능, 큐와 메모리는 §14 예산 내 동작 | 대표 PC 1만/5만 메일 workload 측정, UI 이벤트·취소 ack·RSS 기록 | UI/main→bounded worker jobs |
| R-07 | AT-20 / AC20 | 앱/worker 종료와 재시작 때 손상 없이 중단 상태 복구, API 늦은 결과 미반영 | child kill·request abort·디스크 full·commit 전후 fault injection | lifecycle→jobs/generation→restart |
| R-07 | AT-21 / AC21 | 자료원 제거는 고유 데이터 삭제·공유본 유지, 진행 요청이 삭제 데이터를 복원하지 않음 | import/API/context/첨부 read와 제거 경합, 옛 출처 tombstone 확인 | remove→revoke→DB purge→late response guard |
| R-08 | AT-22 / AC22 | POP3·기존 채팅·산출물 동작을 보존하고 보관함 초기화가 해당 기능을 막지 않음 | 기존 MIME/권한 suite + 독립 DB·빈 archive 부팅·추가/제거 runtime tests | bootstrap→existing/new service→runtime |
| R-08 | AT-23 / AC23 | 설정·페이지·도구·오류 동작이 양방향 연결되고 오래된 응답이 현 화면을 덮지 않음 | 실제 composition으로 설정 슬롯/오류 링크/범위 칩/요청 역전 테스트 | app composition→feature API→IPC/event |
| R-08 | AT-24 / AC24 | Windows 패키지에서 PST·로컬 추론을 실행하고 개인 메일·테스트 fixture는 배포에 미포함 | 설치 산출물 파일 manifest·실행 smoke·네트워크 차단 모델 팩 실기 | electron build→installer→worker/native module |

총 24 AC로 유지하되 S0→S1→S2→S3 구현 단위는 §11에서 나눈다. UI 표시는 상태 테스트로, 실제 문자 렌더링·포커스·설치/사내 endpoint는 실기로 확인한다.

## 7-A. V / Trace Matrix

Baseline V이며 다른 계획의 V나 회귀 결과를 상속하지 않는다. R-08은 기존 코드 경로 보존을 이번에 명시한 NEW 계약으로, 기존 테스트가 존재한다는 사실과 회귀 PASS를 혼동하지 않는다.

### Node registry

| Node | 레벨 | 계약 | provenance / 출처 |
|---|---|---|---|
| R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-08 | R | §7의 가져오기 / 데이터·관계 / 검색 / 임베딩 / 근거 / 범위·AI / 수명 / 통합 | 모두 NEW / 이번 사용자 요구·Codex 제안 |
| AT-01, AT-02, AT-03, AT-04, AT-05, AT-06, AT-07, AT-08, AT-09, AT-10, AT-11, AT-12, AT-13, AT-14, AT-15, AT-16, AT-17, AT-18, AT-19, AT-20, AT-21, AT-22, AT-23, AT-24 | AT | 같은 번호 AC의 실행 증거 | 모두 NEW / §7 |
| SD-01 / ST-01 | SD / ST | 자료원 작업·재시작·제거의 상태 전이 / 결함 주입 시나리오 | NEW / §5·13 |
| SD-02 / ST-02 | SD / ST | 검색→근거→답변→열람 / 두 AI 경로 시스템 시나리오 | NEW / §5·12 |
| SD-03 / ST-03 | SD / ST | 임베딩 세대 전환 / 취소·활성 조회 경합 시나리오 | NEW / §13 |
| SD-04 / ST-04 | SD / ST | 화면·범위·세션 수명 / 두 세션 UI 시나리오 | NEW / §5·12 |
| AR-01 / IT-01 | AR / IT | Renderer/preload/IPC/worker DTO / 실제 경계 왕복 | NEW / §10 |
| AR-02 / IT-02 | AR / IT | Reader·DB·식별자·스냅샷 / 실제 SQLite 통합 | NEW / §9·10 |
| AR-03 / IT-03 | AR / IT | 로컬/API port·자격증명 / adapter 계약·오류 통합 | NEW / §10·15 |
| AR-04 / IT-04 | AR / IT | runtime tools·session·Markdown / composition 통합 | NEW / §10·12 |
| AR-05 / IT-05 | AR / IT | worker 패키징·공유 MIME / 산출물 실행·기존 동작 회귀 | NEW / §11·19 |
| MD-01 / UT-01 | MD / UT | 정규화·identity·offset / 순수 fixture 비교 | NEW / §10 |
| MD-02 / UT-02 | MD / UT | short-token query·filter·fusion / 결과 집합·순위 비교 | NEW / §10 |
| MD-03 / UT-03 | MD / UT | 관계 resolver·context budget / edge·coverage 비교 | NEW / §10 |
| MD-04 / UT-04 | MD / UT | embedding fingerprint·validation / 분리·오류 비교 | NEW / §10 |
| MD-05 / UT-05 | MD / UT | scope·evidence·revoke / 허용·거절·tombstone 비교 | NEW / §10·13 |
| MD-06 / UT-06 | MD / UT | job reducer·UI 상태 / stale 응답·전환 비교 | NEW / §5·13 |

### Pair registry

`EP-xx(N)`의 N은 §10에서 명명한 **자리 수**이며 전체 합의 중복 제거 수가 아니다. 적대 증거 `직접`은 위·아래 행의 행동 oracle로 충분해 추가 mutation을 선택하지 않았다는 뜻이다.

| Pair | left ↔ right | requiredness | start → edges → end | 직접 evidence oracle | 선택 적대 증거 | 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01, AT-02, AT-03 | REQUIRED | 설정→IPC→reader→DB→현황/결과 | AC1~3 입력·저장·상태 대조 | 직접 | EP-01(4), EP-02(4) |
| VP-02 | R-02 ↔ AT-04, AT-05, AT-06 | REQUIRED | source→normalize→version/edge→viewer | AC4~6 원문·edge·중복 비교 | 직접 | EP-03(4), EP-04(3) |
| VP-03 | R-03 ↔ AT-07, AT-08, AT-09 | REQUIRED | 입력→필터→검색 분기→융합→결과 | AC7~9 ID 집합·제외 payload | 직접 | EP-05(4), EP-06(3) |
| VP-04 | R-04 ↔ AT-10, AT-11, AT-12 | REQUIRED | profile→provider→staging→active→query | AC10~12 fingerprint·정답 비교 | 직접 | EP-07(5), EP-08(4) |
| VP-05 | R-05 ↔ AT-13, AT-14, AT-15 | REQUIRED | seeds→확장→evidence→도구→viewer | AC13~15 문단·coverage·복귀 | M-CITE | EP-04(3), EP-09(5) |
| VP-06 | R-06 ↔ AT-16, AT-17, AT-18 | REQUIRED | 세션→범위→조회/추출→AI | AC16~18 허용/거절·파일·실환경 | M-SCOPE | EP-10(8), EP-11(4), EP-12(3) |
| VP-07 | R-07 ↔ AT-19, AT-20, AT-21 | REQUIRED | job→worker/API→commit→취소/복구 | AC19~21 시간·DB·late-write | 직접 | EP-02(4), EP-08(4), EP-13(3) |
| VP-08 | R-08 ↔ AT-22, AT-23, AT-24 | REQUIRED | bootstrap→등록/설정→runtime/package | AC22~24 기존 동작·실행 결과 | M-WIRE | EP-01(4), EP-12(3), EP-14(3) |
| VP-09 | SD-01 ↔ ST-01 | REQUIRED | 등록→batch→취소/kill→재개/삭제 | commit 직전/직후 데이터·상태 | 직접 | EP-02(4), EP-13(3) |
| VP-10 | SD-02 ↔ ST-02 | REQUIRED | 검색→확장→답변→인용 확인 | 양쪽 AI 실제 source manifest·문단 | 직접 | EP-04(3), EP-09(5), EP-12(3) |
| VP-11 | SD-03 ↔ ST-03 | REQUIRED | 모델 교체→staging→activate→GC | 기존 쿼리 lease와 신규 세대 일치 | 직접 | EP-07(5), EP-08(4) |
| VP-12 | SD-04 ↔ ST-04 | REQUIRED | 범위선택→질문→세션전환→복귀 | 세션별 scope/viewer·focus 복원 | 직접 | EP-01(4), EP-09(5), EP-10(8) |
| VP-13 | AR-01 ↔ IT-01 | REQUIRED | renderer→preload→IPC→service→worker | 실제 handler 스키마·error·취소 왕복 | 직접 | EP-01(4), EP-02(4) |
| VP-14 | AR-02 ↔ IT-02 | REQUIRED | reader→write transaction→read snapshot | 실제 DB relation·FTS·버전 원자성 | 직접 | EP-03(4), EP-04(3), EP-05(4) |
| VP-15 | AR-03 ↔ IT-03 | REQUIRED | profile→vault/transport→vectors→DB | doc 예제 shape + 실패 의미 | 직접 | EP-07(5), EP-08(4) |
| VP-16 | AR-04 ↔ IT-04 | REQUIRED | registry→context→tool result→Markdown | 실행된 도구·persisted ID·UI 강조 | M-CITE, M-WIRE | EP-09(5), EP-10(8), EP-12(3) |
| VP-17 | AR-05 ↔ IT-05 | REQUIRED | build→child entry→native/parser→메일 | 설치본 실추론/PST·MIME 회귀 | M-PACK | EP-14(3) |
| VP-18 | MD-01 ↔ UT-01 | REQUIRED | parsed fields→normalize/identity→segments | fixture hash·유니코드·충돌 비교 | 직접 | EP-03(4), EP-06(3) |
| VP-19 | MD-02 ↔ UT-02 | REQUIRED | query→terms/filters→RRF→mail ranks | 한글·정확번호·짧은 토큰 결과 | 직접 | EP-05(4), EP-10(8) |
| VP-20 | MD-03 ↔ UT-03 | REQUIRED | refs/candidates→edges→context | 순환 종료·누락·순서·잘림 표시 | 직접 | EP-04(3), EP-09(5) |
| VP-21 | MD-04 ↔ UT-04 | REQUIRED | model manifest→fingerprint→vector check | 잘못된 차원·NaN·model version 거절 | 직접 | EP-07(5), EP-08(4) |
| VP-22 | MD-05 ↔ UT-05 | REQUIRED | scope/evidence ID→validation→read/purge | 위조·삭제·외부자료원 허용 집합 | M-SCOPE | EP-09(5), EP-10(8), EP-13(3) |
| VP-23 | MD-06 ↔ UT-06 | REQUIRED | request/event→reducer→UI state | 역전 응답·restart·취소의 상태 | 직접 | EP-01(4), EP-02(4) |

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

## 10. 계약 / 타입 / 강제 지점

### 데이터 모델과 정체성

SQLite는 `<userData>/mail-archive/archive.db`를 제안한다. 기존 core/mail DB migration과 분리하고 신규 DB 안에서 versioned migration·WAL·foreign key·transaction을 적용한다.

| 테이블/정본 | 주요 필드와 불변식 |
|---|---|
| `archive_source` | sourceId, kind(eml-folder/pst), 내부 경로 capability, 선택 폴더, health, revision, revokedAt. 경로는 main/source worker만 읽음 |
| `source_revision` | sourceId, revision, fingerprint, verifiedAt. EML 폴더는 파일 digest manifest, PST는 전체 컨테이너 hash; stat는 빠른 힌트일 뿐 |
| `source_occurrence` | sourceId/revision + EML 상대 경로/rawDigest 또는 PST 내부 node locator → mailId/versionId. PST locator는 해당 revision에서만 유효 |
| `mail` / `mail_version` | 내부 UUID, 원 Message-ID, content hash, 제목, from/to/cc의 이름·주소, sentAt/receivedAt/importedAt, dateQuality, 정규화 본문·정규화 버전 |
| `body_segment` | versionId, kind(new/quote/signature/unknown), start/end UTF-16 code unit offset. 구간은 원문 snapshot 위에 존재 |
| `mail_relation` | child/parent 또는 미해결 Message-ID, kind(reply/reference/pst-group/related-candidate), 근거·ambiguity. 순환 검사 |
| `attachment` | occurrenceId, ordinal, 원 이름/표시 이름, mimeType, size, inline 여부, locator. payload는 저장하지 않음 |
| `mail_fts` / short-token lookup | 제목·새 본문·인용·이름 필드와 정규화 검색 텍스트. snapshot offset과 혼용하지 않음 |
| `embedding_profile` / `embedding_generation` | provider config ref, fingerprint, dimension, state, corpusRevision, indexedVersionCount, active pointer |
| `mail_chunk` / `chunk_vector` | versionId, offsets, generationId, normalized float32 BLOB. 서로 다른 generation 검색 금지 |
| `archive_job` | jobId, target, epoch, phase, cursor, committed/skipped/failed, errorCode. cursor만으로 원본 버전을 추정하지 않음 |
| `archive_scope` / `evidence_run` / `evidence_item` | scopeId→owner/sessionId·허용 자료원/기간/메일 집합; run→scope snapshot/indexAsOf; item→versionId/offsets/근거 종류 |

Message-ID 단독 unique 제약을 두지 않는다. 같은 ID·정규화 본문·제목·당사자·메일 날짜가 일치하면 논리 메일을 묶을 수 있지만 occurrence는 모두 보존하며, 첨부는 occurrence별로 유지해 같은 이름의 다른 파일을 덮지 않는다.

ID 없는 메일은 같은 원본 digest일 때만 확실한 중복으로 취급한다. EML↔PST 변환으로 동일성을 증명하지 못한 경우 후보 중복으로 표시하며 내용 유사도만으로 삭제하지 않는다.

Bcc·배달 헤더·첨부 manifest는 occurrence별로 보존한다. 같은 논리 메일이더라도 선택한 자료원 occurrence에서 보이지 않는 수신 정보를 다른 occurrence에서 합쳐 표시하지 않는다.

전체 정규화 본문은 UTF-8로 저장하고 offset은 JS `.slice`와 같은 UTF-16 기준이다. 검색용 정규화/NFKC·하이라이트는 offset map을 거치며, 인용문에는 원 snapshot과 정확히 일치하는 부분만 사용한다.

메일 시각이 없으면 sentAt은 null이다. 날짜 필터는 sentAt 기준이며 UI에 명시하고, receivedAt은 보조 표시로만 사용한다; importedAt을 사건 순서로 대입하지 않는다.

### 파싱·관계·증분

EML은 raw bytes를 `postal-mime`에 전달해 charset·MIME을 해석한다. PST는 native 메타데이터/transport headers를 읽어 동일 DTO로 매핑하며 HTML→텍스트 변환 결과·날짜 해석 오류·빠진 필드를 품질 flag로 남긴다.

EML 폴더 순회는 대소문자와 무관한 `.eml`만 대상으로 하고 junction/symlink를 따라가지 않는다. 재연결·첨부 재판독 시 선택 루트의 canonical path와 occurrence 상대 경로를 확인해 경로 이탈과 순환 순회를 거절한다.

plain text가 없는 HTML은 script/style 제거 후 텍스트화한다. 이미지·HTML 실행을 기본 뷰어에 넣지 않고, 본문에 포함된 외부 URL은 사용자의 명시 클릭에서만 기존 링크 정책을 적용한다.

References/In-Reply-To는 역순 수집에도 재해결한다. 동일 Message-ID 부모 후보가 여러 개면 ambiguous로 남기고 임의 하나를 고르지 않으며, PST conversation 정보는 그룹 근거로 표시해 직접 답장 edge와 구분한다.

제목 정규화·참여자·날짜 근접성은 관련 후보 계산에만 쓴다. 원본 메일이 없는 인용 내용은 “다른 메일에 인용됨”으로 표시해 실제 원 메일인 것처럼 날짜·발신자를 생성하지 않는다.

재스캔은 hash 확인 후 변경 파일만 다시 파싱한다. PST는 시작/완료 시 fingerprint 일치를 확인하고, 변경 중인 컨테이너의 새 revision은 활성화하지 않는다; 중단된 staging을 재개할 때도 fingerprint부터 확인한다.

PST 한 revision의 완료 여부를 숨기지 않는다. 검증된 배치는 `부분 자료`로 검색 가능하되 원본 변경이 감지되면 해당 revision을 검색 대상에서 제외하고 이전 검증 revision을 유지한다.

### 검색·Context 구성

`SearchRequest`는 query, optional filters, mode(lexical/hybrid), cursor를 갖는다. mode 생략은 hybrid, 활성 임베딩이 없으면 lexical + degraded reason으로 응답한다.

1. UI 필터와 세션 scope를 교집합한다. 자연어에서 추정한 날짜·사람은 사용자에게 보이는 해석이며 모호하면 hard filter로 몰래 고정하지 않는다.
2. 문서번호·주소·따옴표 정확 문자열과 FTS5를 결합한다. 3글자 미만 토큰은 escape된 parameter LIKE 등 fallback으로 **토큰별** 처리하고 혼합 AND 조건을 유지한다.
3. lexical·vector 각각 동일 범위 안에서 후보를 뽑는다. 전 보관함 vector top-k를 구한 뒤 filter하는 방식은 범위 내 좋은 후보를 누락하므로 사용하지 않는다.
4. RRF(k=60 초기 제안)로 융합하되 정확 식별자 일치 tier를 우선한다. mailId/version별 중복 chunk를 합치고 제목·새 본문은 인용/서명보다 높은 검색 가중치를 갖는다.
5. 이력 질문은 seed의 확인된 edge를 앞뒤로 확장하고 관련 후보는 별도 표시한다. 기간 경계 밖 자료는 기본 배제하며 `기간 넓혀 보기`를 사용자에게 제시한다.
6. 날짜순으로 context를 구성하면서 seed·변경·상충·가장 늦은 확인된 사건을 보존한다. 단순 시간순 앞부분 절단을 하지 않고 생략 건수·연결 누락·범위를 함께 반환한다.

LLM 입력은 untrusted evidence이며 메일 본문의 지시를 작업 명령으로 취급하지 않는다. 숫자·날짜·결정 표현은 인용 근거에 연결하고, context 부족이면 도구로 추가 페이지를 요청하거나 미확인을 답한다.

검색 cursor는 query/filter/index revision에 결속한다. 색인이 바뀌면 `결과가 갱신되었습니다`로 새 검색을 제시하고 중복/누락된 페이지를 정상 페이지인 것처럼 이어 붙이지 않는다.

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

첫 구현의 vector 저장은 SQLite float32 BLOB + worker 블록 스캔 cosine을 제안한다. 외부 Vector DB·native SQLite extension을 먼저 추가하지 않으며, S0 실측으로 예산을 못 맞추면 ANN 후보와 의존성 승인을 설계에 반영한 뒤 READY로 전환한다.

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

동일 필터는 `scope.ts`가 SQL 조건·in-memory predicate를 생성하도록 하고 각 경로의 결과 집합을 같은 fixture로 비교한다. EP-10의 다양한 경로에서 조건문을 독립 복제하지 않는다.

## 11. 구현 설계

### 진행 단위

| 단계 | 결과 | 종료 조건 / 이 계획 AC |
|---|---|---|
| S0 — 실증·결정 | PST/모델/API 후보와 기준 PC 보고서, 신규 의존성 승인·정확 버전 | D-014~D-016 closed, 아래 표의 반증 사례를 통과하고 본문/보드 READY 동시 갱신 |
| S1 — 보관·정확검색 | 자료원 UI, EML/PST reader, worker DB, 메타데이터/본문/파일명 검색·열람·선택 추출 | AC1~7·9·17·19~23 관련 pair; 의미검색 미설정 상태가 정상 동작 |
| S2 — 두 임베딩 경로 | 로컬/API 프로필, chunk/vector, generation, hybrid UI | AC8·10~12·19·20·24 관련 pair; 두 구현체 모두 동작 |
| S3 — 이력 답변·근거 UX | scope, context 도구, 기존 두 AI 경로, source card/인용 viewer | AC13~16·18·21~24, 나머지 유효 pair와 운영 gate 전부 |

S1~S3를 별도 구현 PR로 나누되 동일 V1의 단계 완료와 전체 완료를 구별한다. 중간 구현은 `partial`이며 scope를 줄여 원 요구가 완료된 것처럼 보고하지 않는다.

| S0 결정 | 수행할 실증 | 선택 조건 / 실패 시 대안 |
|---|---|---|
| D-014 PST 후보 | `pst-extractor@1.12.0`을 별도 승인된 spike 환경에서 ANSI/Unicode·한국어·HTML/RTF·폴더·첨부·손상 fixture로 검증 | 원문/관계/첨부 field golden 비교, 해제·취소·메모리 확인. 실패 시 libpff sidecar의 Windows 배포·라이선스 비교 후 결정 |
| D-014·15 로컬 후보 | `onnxruntime-node` + `@huggingface/tokenizers`와 한국어/다국어 embedding 모델 팩의 tokenizer·pooling·query/document prefix 검증 | golden vectors·검색 회수율·CPU/RSS·라이선스·오프라인 실행. 특정 모델명은 사용자 선택 전 기본값으로 넣지 않음 |
| D-015 API 후보 | 사용 가능한 endpoint의 request/response 예제, auth, model/revision, max input/batch, query/document 처리 확인 | 실제 한 배치/한 질의/401/취소 실증. 이 규약을 §15 adapter 예제와 고정 contract test로 반영 |
| D-016 성능 | 대표 PC 사양·자료량·본문 길이/언어 분포를 기록하고 1만/5만 메일로 §14 측정 | 제품 SLA 새로 확정하지 않고 예산 조정 근거 보고. exact cosine이 느리면 ANN 선택을 먼저 설계 |

패키지 설치나 사내 자료의 저장소 반입은 이 문서 PR에서 수행하지 않는다. 실메일 대신 합성 fixture를 커밋하고, 실환경 검증 결과에는 메일 본문·주소·자격증명을 남기지 않는다.

### 파일·seam

아래 경로는 별도 표기가 없으면 신규 제안이다. 현존 파일과 아직 없는 파일을 링크 존재 검사에서 혼동하지 않는다.

| 경로 | 책임 / 변경 | 테스트 seam |
|---|---|---|
| `app/src/shared/mail-archive.ts` | DTO·에러·IPC shape | zod 입력 경계·타입 예제 |
| `main/features/plugins/mail-archive/{normalize,identity,segments,relations,query,ranking,context,scope,embedding-profile,job-state}.ts` | Electron/DB/native를 import하지 않는 순수 계산 | UT fixture/경합 상태 전이 |
| `main/features/plugins/mail-archive/{service,ipc,tools}.ts` | 주입 포트·scope·등록·취소 오케스트레이션 | 실제 IPC/tool handler IT |
| `main/features/plugins/mail-archive/{store,migrations/*,index-worker}.ts` | archive DB single writer·조회·jobs/evidence | 실제 SQLite rollback·migration·snapshot |
| `main/features/plugins/mail-archive/readers/{eml,pst,source-worker}.ts` | 원본 reader·fingerprint·메타데이터·추출 | ReaderPort fixture·kill/restart |
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

가져오기는 `OS 선택 → main capability → source worker → normalized batch → index worker transaction → revision event → source card/search`이다. 화면은 이벤트 건수를 독자 합산하지 않고 committed snapshot을 정본으로 삼으며 sequence gap이면 다시 조회한다.

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

작업 상태는 `queued → scanning → importing → completed | partial | cancelled | failed`이며 재시작 복구는 `interrupted`이다. source health(`available/missing/changed`)와 embedding state(`not-configured/building/ready/degraded`)는 별도 축이다.

main cancel은 해당 job epoch를 먼저 폐기하고 source/compute/API의 AbortSignal을 취소한다. index worker는 batch commit 직전 epoch를 확인하고, 읽기/compute가 응답하지 않으면 해당 자식만 종료한다; 저장된 batch는 유지한다.

앱 종료는 신규 작업 차단→in-flight 취소→DB commit/close 정착→자식 정리 순서다. 강제 종료에서는 WAL/journal에서 마지막 committed cursor까지 복구하고 transient 상태를 interrupted로 바꾼다.

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

## 14. 성능 / 상한 / 최적화

아래는 **S0에서 확인할 초기 엔지니어링 예산**이며 확정 성능 SLA가 아니다. 런타임 상한은 `limits.ts` 한 곳과 관련 DTO validator에서 공유한다.

| 항목 | 초기 제안 / 단위 | 초과 시 동작 |
|---|---|---|
| EML 입력·PST 단일 항목 해제 크기 | 각 50 MiB / 64 MiB | 해당 항목 제외 이유; PST library의 사전 제한 가능성은 S0 검증 |
| import 배치 | 100 메일 또는 serialized DTO 4 MiB 중 먼저 도달 | 배치 commit 후 양보; 항목 하나의 본문 상한은 별도 검사 |
| 정규화 본문 snapshot | 2 MiB UTF-8 / 메일 | 조용히 자르지 않고 oversized 상태·재처리 안내 |
| main↔worker 큐 | 배치 2개 in-flight, 진행 event 초당 최대 4회 | backpressure; 이벤트 드롭은 snapshot 재조회로 복구 |
| 작업 프로세스 | index 1, source 1, embedding 1 최대 동시 | source/embedding lazy start·유휴 종료, 쿼리 우선 큐 |
| 검색 후보/페이지 | 분기당 100, 화면/도구 페이지 20메일 | cursor; 의미검색 후보 수를 전체 일치 건수로 표시하지 않음 |
| 관계 확장 | 100메일·edge depth 20 / run | 경계·잘림 표시, 다음 페이지 |
| context | 최대 24메일, 문단 최대 1,500 UTF-16 units, 전체 JSON UTF-8 64 KiB | 중요 근거부터 pack하고 생략 수 표시; 요청별 상한 낮춤 가능 |
| embedding batch | 최대 32텍스트·동시 API 2요청, 모델 token/byte 제한 중 더 작은 값 | 분할, 413은 배치 재계획; 텍스트 무음 절단 금지 |
| API | 요청 30초, 일시 오류 재시도 최대 2회, Retry-After 최대 대기 60초 | 이후 degraded/사용자 재시도; 401·스키마 오류 재시도 안 함 |
| vector 블록 | 16 MiB resident float buffer, dimension 1~4096 | block scan·차원 거절; 전체 vector를 main 메모리에 적재 안 함 |
| 실측 목표 | 1만/5만 메일에서 p50/p95, 취소 ack 1초 목표, UI long task·peak RSS 기록 | 실패 시 예산·worker 분할·ANN 선택을 설계에서 정정 |

본문 24×1,500=36,000 UTF-16 units는 UTF-8 64 KiB보다 클 수 있으므로 **직렬화 바이트 cap을 마지막으로 적용**한다. 글자 수를 토큰 수라고 가정하지 않고, harness가 제공하는 컨텍스트 제한이 더 작으면 반환 예산을 낮춘다.

embedding 텍스트 수 C는 chunker가 결정한다. API 최악 요청 수는 `ceil(C/B) × 3`(최초+재시도 2회), B는 profile 한도와 32 중 작은 값이며 질의 요청은 별도 1배치이다.

예시로 5만 메일×평균 4chunk×768차원×4byte는 vector만 614,400,000byte이며 SQLite·텍스트·색인 비용은 추가된다. 새/구 generation 공존 중 vector 저장량은 이 예시의 약 두 배이므로 시작 전 여유 공간을 확인한다.

exact cosine의 연산량은 후보 범위 chunk 수×차원이다. 로컬 모델/PC가 정해지지 않은 상태에서 검색 지연·GPU 필요 여부를 확정하지 않는다.

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
| native 모델 런타임 배포 크기/ABI | Windows 설치본 smoke·실 모델 추론·폐쇄망 모델 팩 절차 |
| 개인 자료 잔류 | 명시 제거 transaction·vector/evidence purge; 이전 채팅 내용 잔존을 정확히 안내 |

새 의존성 후보는 `pst-extractor`, `onnxruntime-node`, `@huggingface/tokenizers`다. [app 의존성 정책](../../../app/AGENTS.md)의 “TRD §2 Stack 표 밖의 패키지 추가는 사용자 승인 필수”에 따라 **선정·실제 추가는 D-014에서 승인 후** 진행한다; 이 문서는 채택 승인을 대신하지 않는다.

되돌리기 어려운 부분은 identity/version·source occurrence·evidence format이다. 최초 구현부터 schemaVersion·fingerprint·opaque ID를 두고, 모델 이름이나 원본 경로를 공개 식별자로 고정하지 않는다.

## 18. 영향 받는 파일 / 문서

이번 PR 변경은 이 계획, [handoff INDEX](../INDEX.md), [docs INDEX](../../INDEX.md)뿐이다. 앱 코드·lockfile·현재 architecture 문서는 바꾸지 않는다.

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

### 설계 검증 실행 기록 (2026-09-29)

문서 파서로 AC1~24 연속성, 23 pair의 왼쪽 노드 전부 연결, 14 EP 행의 57자리 표기와 pair의 자리수 일치, 본문 상대 링크 7개 존재를 확인했다. author=Codex, Baseline V 기준=none, 보드=plan/DRAFT·다음 Codex가 본문과 일치했다.

app 디렉터리에서 `node scripts/check-doc-inventory.mjs --check`를 실행해 generated doc·prose·relative links 검사가 모두 통과했다. 처음 저장소 루트에서 실행한 명령은 cwd 의존 경로로 실패했으며, app에서 재실행한 결과를 채택했다.

의미 대조에서는 D-004↔AC10~12↔§10의 local/api union, D-005↔AC9·17↔EP-06·11, D-006↔AC4↔immutable version, D-011↔AC13·16·21↔EP-09·10·13의 동작을 각각 비교했다. §5의 취소/원본 소실/제거 상태는 §13의 저장·복구 순서와 일치하며, 외부 문서 열람·계획된 AT를 구현 PASS로 기록하지 않았다.

## READY self-review

- [x] 이번 대화의 사용자 요구와 Codex 제안을 분리하고, 원격 계획 승인·V를 상속하지 않았다.
- [x] Product/UX, AS-IS→TO-BE, 24 AC, R/SD/AR/MD의 pair와 자리별 강제 지점·직접 oracle을 작성했다.
- [x] 범위·인용·취소·원본 변경·자료원 제거·임베딩 전환을 producer와 consumer 양쪽에서 정의했다.
- [x] 로컬/API 임베딩 둘 다 완료 범위에 남겼고, 첨부 본문 검색은 제외했다.
- [ ] D-014 신규 의존성 검증·채택 승인 완료.
- [ ] D-015 최초 로컬 모델 팩·실제 API 계약/인증/모델 revision 확정 및 검증.
- [ ] D-016 대표 PC/자료로 예산 검증·필요 설계 정정.
- [ ] 위 OPEN 해소 후 본문·AC·V·§10 재대조, plan/INDEX를 같은 커밋에서 READY로 전환.

**판정: 비교 가능한 설계안은 작성했으나 구현 READY는 아니다.** 독립안을 먼저 비교·선택한다는 사용자 요청에 따라 DRAFT로 제출하며, 이미 허용한 두 AI 환경·두 임베딩 방식·첨부 본문 제외를 재승인 항목으로 만들지 않는다.

---

## [구현자 기입] 설계 리뷰

미착수. 구현 턴은 [handoff-impl](../../../.agents/skills/handoff-impl/SKILL.md)에 따라 아래 필드를 실제 관측으로 채운다.

- 동의 / 그대로 진행: 미기입.
- 이견 / 현실성 문제: 미기입.
- ACTIVE Decision과 충돌하는 설계 발견: 미기입.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| 미기입 | — | — | — | — | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 미기입.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| 미기입 | — | — | — | — |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 미기입 | — | — | — | — |

- 분모 검산: 미기입.
- 덮개 회귀: 미기입.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 미기입 | — |
| seam을 위해 재배치한 production의 cleanup 변수 스코프가 유효한가 | 미기입 | — |
| 새 실패 경로가 Part I 상태 전이표의 어느 행인가 | 미기입 | — |
| 실패가 화면에서 아무 일도 없는 것으로 보이지 않는가 | 미기입 | — |
| 늦은 응답이 화면을 되돌리지 않는가 | 미기입 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 미기입 | — | — | — |

### 설계 대비 명시적 차이

- plan과 다르게 구현한 것과 이유: 미기입.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 미기입 | — |
| 공유 | 미기입 | — |
| 재진입 | 미기입 | — |
| 다른 무효화 축 | 미기입 | — |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 미기입 |
| 실행 명령 | 미기입 |
| 관측한 게이트 산출 | 미기입 |
| V-pair 자기확인 | 미기입 |
| 강제 지점 전수 | 미기입 |
| AC 자기보고(Criteria-Met) | 미기입 |
| 합계 검산 | 미기입 |
| 블로커 / 역질문 | 미기입 |
| 대상 커밋 | (구현 — 좌표는 INDEX) |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 미기입.
- 막았어야 할 plan 지침·AC와 미검출 이유: 미기입.
- 반복해서 부딪히는 환경 한계: 미기입.
- 현재 라운드·impl 턴: 미착수.

## [검증자 기입] 파생 이슈

미착수. 구현 산출 후 [handoff-verify](../../../.agents/skills/handoff-verify/SKILL.md)로 수행한다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| 미기입 | — | — | — | — | — |
