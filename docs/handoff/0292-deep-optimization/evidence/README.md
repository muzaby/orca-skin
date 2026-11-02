# 0292 r1 구현 증거

- `r1-entry-sites.txt`·`r1-final-sites.txt`: 착수/완료 자리 검색 원문.
- `r1-entry-bundle.json`·`r1-final-bundle.json`: 같은 sourcemap 빌드의 진입 크기·계열 귀속·자산 수. 최종에는 main SDK 정적 require 개수도 포함한다.
- `r1-entry-node24-failed-ids.txt`: 초기 Node 24 실행의 환경 실패 목록. 설치 SQLite는 Electron ABI이므로 최종 회귀 분모로 쓰지 않는다.
- `r1-baseline-electron-failed-ids.txt`·`r1-final-electron-failed-ids.txt`·`r1-new-failed-ids.txt`: 같은 Electron Node 모드로 실행한 착수/완료 실패 ID와 차집합.
- `r1-full-electron-failed-ids.txt`·`r1-rechecks.json`: 전체 실행의 실패 원문(기준선 23 + 일시 1)과 같은 코드 bootstrap 파일 3회 재확인(각 24/24). `r1-final-electron-failed-ids.txt`는 재확인 후 남은 실패다.
- `r1-enforcement.json`: 유효 §10의 75자리와 `plan.md` 직접 oracle 별칭 대응.
- `r1-mutations.json`: 등록 결함 29종·새 oracle 8종의 red/원문 복구 green 관측. 네 번들 변이는 마지막 복구 빌드로 양성 대조했다.
- `r1-gates.json`: 전체 실행 수·정적 게이트·환경 제한. Windows CI와 설치본 사람 실기는 미수행이다.

중간 로그와 전체 vitest JSON은 작업 디렉터리에 두었고, 이 폴더에는 공유 검증에 필요한 요약·실패 ID만 보관한다. 기준선 및 구현 커밋 좌표 정본은 INDEX이며 검증자가 기입한다.
