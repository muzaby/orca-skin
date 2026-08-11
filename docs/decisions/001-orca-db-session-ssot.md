# ADR-001 — 대화의 진실은 Orca DB 다 (SDK resume 은 컨텍스트일 뿐)

## 문제

Claude Agent SDK 는 세션을 자체 `jsonl` 로 보관하고 `resume` 으로 이어붙인다. 앱이 그것을
대화 기록의 원천으로 삼으면 편하다 — 저장 코드를 안 짜도 된다.

그러나 그 파일은 **모델의 실행 컨텍스트**지 사용자의 대화 기록이 아니다. compaction 이 일어나면
내용이 손실되고, 파일이 사라질 수도 있으며, 앱이 소유하지 않는 경로에 산다. 사이드바에 과거
대화를 띄우고 검색하고 삭제하려면 앱이 읽고 쓸 수 있는 기록이 따로 있어야 한다.

## 검토한 선택지

| 안 | 내용 | 판단 |
|---|---|---|
| A. SDK jsonl 을 원천으로 | 저장 계층 없음. `resume` 이 곧 히스토리 | **기각** — compaction 으로 손실적이고, 앱이 소유하지 않으며, 검색·삭제·프로젝트 스코프를 얹을 수 없다 |
| B. 로컬 DB 를 원천으로, resume 은 컨텍스트 유지용 | 메시지·세션 메타를 DB 에 쓰고 SDK 에는 실행 컨텍스트만 위임 | **채택** |
| C. 둘을 동기화 | 양방향 정합 유지 | 기각 — 손실적인 쪽과 무손실인 쪽을 동기화하면 어느 쪽이 진실인지 매 지점에서 다시 물어야 한다 |

## 선택

**로컬 SQLite(`<userData>/orca.db`) 의 row 가 SSOT.** SDK 의 resume 컨텍스트는 *모델을
조건화하기 위한 외부 binding* 일 뿐 대화의 진실이 아니다.

두 개념을 어휘로도 갈라 둔다 — `GLOSSARY.md` 의 **Session (Orca Session)** 과
**SDK resume context** 는 별도 표제어이고, 한 단어로 뭉치지 않는다.

## 포기한 것

- **무손실 이어가기 보장.** resume 이 실패하면 DB 기반 재개는 *무손실 복구가 아니라*
  reseed/bootstrap 이다. 모델이 보던 컨텍스트와 DB 전문이 발산할 수 있음을 받아들인다.
- **저장 계층 없는 단순함.** 마이그레이션·스키마·FTS 를 직접 운영해야 한다.

## 생긴 invariant

- **메시지의 출처는 항상 DB다.** `resume` 은 컨텍스트 유지용이며 메시지를 읽어오는 경로가 아니다.
- **삭제는 hard delete (CASCADE).** 앱이 소유하므로 지우면 실제로 지운다.
- **머지된 마이그레이션 파일은 절대 수정하지 않는다** — 변경은 새 파일로.
  `app/scripts/check-migrations-appendonly.mjs` 가 CI 에서 기계 강제한다.
- DB 위치는 `app.getPath('userData')` 단일 출처. dev 는 sibling `orca-dev` 로 리디렉션해
  실제 설치본과 데이터를 격리한다.

## 관련

현재 구조: [`arch/backend/persistence.md`](../arch/backend/persistence.md) ·
용어: [`GLOSSARY.md`](../GLOSSARY.md) (Session / SessionRuntime / SDK resume context) ·
실행 핸들의 분리: [ADR-005](005-runtime-conversation-separation.md)
