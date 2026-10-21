# OpenCode 실제 UI 재현

`app`에서 다음 명령으로 실행하고 출력된 loopback 주소의 `/scripts/fixtures/opencode-ui/index.html`을 브라우저에서 연다.

```powershell
node node_modules/vite/bin/vite.js --config scripts/fixtures/opencode-ui/vite.config.ts --host 127.0.0.1
```

실제 ChatTile·transcript·composer·store·reducer·CSS를 사용한다. native IPC만 메모리 대역이며 실제 파일, 권한, 설정, 프로세스, 모델은 변경하지 않는다. UI의 승인은 검증 데이터만 소비한다.

컴포저 조회 분리는 `?modelsDelay=60000`으로 확인한다. 모델 응답 전에도 에이전트 메뉴에서 Sisyphus·Prometheus·Atlas를 선택할 수 있다. `?catalogError=agents`는 최초 에이전트 조회만 실패시키며 고정 새로고침 항목으로 회복한다. loading/error에서도 상태 안내나 스피너는 없어야 한다. `agentsDelay`·`modelsDelay` 단위는 ms다.

| 시나리오                     | 조작 / 판정                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| long-history-selection       | 긴 이력을 상하로 드래그하고 텍스트를 여러 행에 걸쳐 선택. 화면 밖 재진입에서 내용과 선택 유지                            |
| streaming-unpin-repin        | 턴 시작→스트리밍 시작→과거로 스크롤/선택. 새 출력에도 읽는 위치 유지, 맨 아래로 복귀하면 추종                            |
| resize-and-disclosure-anchor | 탐색·셸 카드 펼침/접기, 너비/글자 크기 전환. 측정의 첫 visible key·상대 위치 유지                                        |
| session-switch-anchor        | A/B 각각 다른 위치·펼침으로 이동 후 왕복. 각 세션의 위치·펼침 복귀                                                       |
| mixed-request-queue          | 초안 입력/첨부 후 질문→승인→질문 또는 반대 순서 버튼. 한 카드만 입력 자리에 노출, 소비 후 다음, 마지막 후 초안·첨부 복원 |
| todo-dock-lifecycle          | 턴 시작→Todo 진행→접기/펼치기→Todo 완료. 요약·목록·완료 퇴장 확인. 진행 중 요청 추가 시 Todo 가림/복귀, 세션별 접힘 유지 |

‘측정’은 실제 viewport·visible 행 key/좌표·선택 문자열·composer 높이와 응답 IPC payload를 하단에 기록한다. 두 테마와 좁은 너비를 대조한다. 이 화면은 실제 모델 및 독립 verify를 대체하지 않는다.
