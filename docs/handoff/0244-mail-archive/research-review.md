# 0244 — 유사 솔루션 조사 검토

작성자: **Codex** · 2026-09-29 · 설계 반영: [ΔV1](delta-v1.md) · 제품 기준: [plan](plan.md).

**판정: 전처리·입력 표현·문맥 확장은 채택하고, 메일 정체성·최신성·저장 엔진 권고는 Orca 요구에 맞게 수정한다.** 다른 제품의 기본 상수와 공개 벤치마크를 Orca의 최적값·품질 보장으로 승격하지 않는다.

## 1. 입력과 재확인 범위

사용자 첨부 `mail-archive-rag-report.md`를 읽었다. 입력 파일 SHA-256은 `85f168535b88d657a62998be1b10f35e9d1e23024d673bdcaebf52162201fafd`이며, 첨부 원본은 수정하거나 저장소에 복제하지 않았다.

보고서가 인용한 일부 구현과 이번 설계에 영향을 주는 모델·SQLite 문서를 직접 재확인했다. 세 제품의 전체 저장소에서 인용·서명 제거가 전혀 없다는 전칭 주장, 보고서에 적힌 모든 기본 상수, 실제 서비스 업로드 결과까지 검증한 것은 아니다.

| 근거 | 이번 관측 | 설계에 사용할 수 있는 결론 |
|---|---|---|
| Onyx `a18fc1a652ff2b67ef7b1aae59dbfed013739365` [chunker](https://github.com/onyx-dot-app/onyx/blob/a18fc1a652ff2b67ef7b1aae59dbfed013739365/backend/onyx/indexing/chunker.py) | semantic/keyword metadata 분리, optional metadata 25% 제한, 문장 청킹, 본문 공간 부족 시 optional prefix 제거 | 표현별 입력 분리와 본문 우선 예산을 차용 |
| 같은 커밋 [Gmail connector](https://github.com/onyx-dot-app/onyx/blob/a18fc1a652ff2b67ef7b1aae59dbfed013739365/backend/onyx/connectors/gmail/connector.py) | `message_to_section`, `thread_to_document`; 날짜 파싱 실패는 timestamp만 제외 | 메시지별 근거와 대화 문맥을 함께 유지. Orca의 색인 단위까지 스레드로 바꿀 필요는 없음 |
| RAGFlow main `fa0f3c29ab4658ba021f9107714fb0e47ae3dd17` | `rag/app/email.py`는 404. 경로 이력에 [Python 제거 커밋](https://github.com/infiniflow/ragflow/commit/670e688726d7a2969306aec079575767605a8821) 존재 | 보고서의 Python 코드를 현재 main 구현이라고 인용하지 않음 |
| RAGFlow 과거 [email.py](https://github.com/infiniflow/ragflow/blob/4bb522d11d786ae51472c04d444bd0a20a33f5c0/rag/app/email.py) | 전체 헤더 합치기, plain/html 병합, filename 제목, attachment 재귀 chunk 확인 | 중복·전송 헤더 노이즈·첨부 본문 혼입을 막을 회귀 fixture의 근거 |
| Open WebUI `8bd8b4fac5e059578ac0c74b3c18d11139f88b7d` [loader](https://github.com/open-webui/open-webui/blob/8bd8b4fac5e059578ac0c74b3c18d11139f88b7d/backend/open_webui/retrieval/loaders/main.py) | CJK 검증·charset 추정, msg loader, 일반 경로 마지막 TextLoader 분기 | eml 전용 처리 미확인은 코드 수준 관측. 외부 extractor·slim 분기가 있어 전체 배포의 동작으로 일반화하지 않음 |
| 설치된 `postal-mime`의 공개 타입·`src/postal-mime.js` | text/html 결과, `forceRfc822Attachments`, inline subMessage 본문 조립 경로 확인 | Orca는 새 범용 파서 추가보다 기존 파서 adapter를 먼저 검증 |
| [SQLite bm25](https://www.sqlite.org/fts5.html#the_bm25_function) | 컬럼 가중치·점수 정렬 규약 제공 | 영속 FTS 컬럼 가중치 사용. 원시 BM25와 cosine 가중합을 피하고 순위로 결합 |
| [sqlite-vec v0.1.9 README](https://github.com/asg017/sqlite-vec/blob/v0.1.9/README.md), [release](https://github.com/asg017/sqlite-vec/releases/tag/v0.1.9) | pre-v1 경고·Windows·vec0; 긴 metadata text의 DELETE 수정 사례 | 고정 버전·삭제/복구 시험을 포함하는 후보. “도입하면 ANN 확장성 확보”로 간주하지 않음 |
| [sqlite-vec JS](https://alexgarcia.xyz/sqlite-vec/js.html), [vec0](https://alexgarcia.xyz/sqlite-vec/features/vec0.html) | better-sqlite3 load와 metadata/partition/auxiliary의 서로 다른 필터 의미 | 모델 재계산 없이 교체할 포트·파생 색인 필요. 문서가 alpha 버전을 가리키면 stable 기능으로 가정하지 않음 |
| [multilingual-e5-small 모델 카드](https://huggingface.co/intfloat/multilingual-e5-small/raw/main/README.md) | 384차원, 비영어에도 query/passage prefix, masked average pooling·정규화 예제 | 첫 비교 기준 후보. 한국어 업무메일 우수성은 미검증 |
| [EmbeddingGemma 모델 카드](https://huggingface.co/google/embeddinggemma-300m) | 768차원·MRL 512/256/128, 2048 token, 전용 query/document prompt, float16 activation 미지원 표기 | 768/256을 비교하고 truncate 후 재정규화. ONNX 변환본·dtype·이용 조건 별도 확인 |
| [Talon](https://github.com/mailgun/talon) | 인용 추출·서명 규칙/모델 제공 | 규칙·fixture 참고; Python 런타임을 추가하거나 한국어 정확도를 가정하지 않음 |

외부 Git SHA는 GitHub API에서 확인하고 해당 SHA의 파일을 읽었다. RAGFlow 과거 SHA는 path commit history에서 얻었으며, 보고서 작성자가 읽은 정확한 revision과 동일하다고 주장하지 않는다.

## 2. 채택·수정·보류 판정

| 보고서 제안 | 판정 | Orca 적용 |
|---|---|---|
| 메시지/스레드 이중 구조 | 수정 채택 | 메시지 버전이 저장·색인·인용 정본, 스레드는 검색 결과 그룹·문맥 확장 단위 |
| vector/keyword 입력 분리 | 채택 | `display snapshot`, `lexical fields`, `embedding payload` 세 표현과 offset map |
| 인용·서명 제거 | 보존형으로 수정 | segment를 분리하고 검색 가중치를 조정. 불확실한 업무 본문은 제거하지 않음 |
| Message-ID가 있으면 폴더만 추가 | 기각 | 같은 ID·다른 본문 충돌을 보존하는 V1 identity 유지 |
| 부모 메일이 있으면 인용 제외 | 수정 | 같은 scope에서 동일 문단 대응이 확인될 때 결과/context 중복만 접기. 원본 부재·범위 밖이면 인용 근거 유지 |
| 제목+참여자로 thread 병합 | 기각 | `related-candidate`만 생성하는 기존 결정 유지 |
| 제목 vector 0.1 + 본문 0.9 | 보류 | 모델이 지원하는 제목 prompt/prefix 우선, 별도 vector 산술 합성은 평가 전 미도입 |
| 시간 감쇠를 모든 검색에 적용 | 기각 | 과거 경위 조회 기본값은 감쇠 없음. 사용자가 선택한 `최신순`을 별도 정렬로 제공 |
| FTS 0건→vector | 제한 채택 | hybrid에서 같은 hard filter로 semantic 후보 표시, 정확번호·사람·기간은 자동 완화하지 않음 |
| query embedding cache | 채택 | fingerprint·렌더링 입력·세션/범위·credential epoch를 key로 하는 제한된 메모리 캐시 |
| sqlite-vec 즉시 채택 | 실증 후보 | BLOB 기준과 scope·순위 동등성/Windows·삭제·지연을 비교 후 D-014에서 결정 |
| 본문 hash를 chunk ID로 사용 | 수정 | 출처 chunk ID와 embedding cache key 분리. 같은 문장이라도 날짜·사람·위치 증거는 합치지 않음 |
| 한글 비율로 decode 성공 판정 | 기각 | 언어 비율은 힌트, 영어/코드/짧은 정상 메일을 실패 처리하지 않음 |
| 서명 반복 꼬리 자동 제거 | 보류 | 반복 업무 문구를 지울 수 있어 명확한 구조만 분리, 모호하면 unknown |
| LLM 생성 질문/요약의 색인·사후 유사도 인용 삽입 | 보류 | 원문 근거와 모델 생성물을 구분; 실제 반환된 evidence ID로만 출처 연결 |
| 첨부 본문 추출을 2단계로 추가 | 제외 유지 | 사용자 확정 범위에 따라 후속 약속에도 넣지 않음 |

## 3. 품질 우위 주장의 제한

메일별 전처리는 품질 개선 **가설**이다. 한국어 인용 구분선·짧은 답변·오래된 승인·동일 제목의 별개 대화·부모 없는 인용을 포함한 고정 질의셋에서 lexical 기준과 비교해야 한다.

라이브러리나 모델 후보를 추천한 것은 설치·배포 승인이 아니다. 이번 변경은 계획과 검증 설계이며, 실행 성능·검색 품질 결과는 [ΔV1 §8](delta-v1.md#8-실증-계획과-선택-조건)에 별도로 채울 예정이다.
