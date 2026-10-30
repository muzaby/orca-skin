# ADR-010 — 로그인 프리 대상은 선택적으로 호스트 연결 상태를 갖고, 결과는 메모리에만 둔다

## 문제

폐쇄망 배포는 호스트 PC에 설치된 OpenCode의 연결 설정(사내 provider)을 그대로 Orca의 엔진&모델로
가져오고 싶다. 앱 로그인·IdP/SP 인증이 필요 없지만 "호스트에 OpenCode가 있고 그 provider가
모델을 돌려주는가"는 확인해야 하고, 그 결과로 읽기 전용 모델 카드를 만들어야 한다. 기존 로그인
프리 체계(ADR-006)는 상태가 없어 항상 `valid`였고, runtime 카탈로그는 `valid && verified`일 때만
행을 만들기 때문에 그 결과를 실을 자리가 없었다.

## 검토한 선택지

| 선택지 | 판단 |
|---|---|
| 확인 결과를 자격증명 grant·vault에 저장한다 | 기각 — 인증이 아닌 값이 게이트·부팅 복원·해제 경로를 탄다 |
| 결과(모델 카탈로그)를 디스크에 저장하고 재시작 시 diff 후 덮어쓴다 | 기각(사용자 결정 "인메모리") — 정본은 호스트 설정이고, 사본은 호스트와 갈라지며 새 영속 포맷이 생긴다 |
| 배포가 `child_process`를 직접 쓴다 | 기각 — 실행 경계가 `app/deployment/`로 퍼지고 서버 시작 조건과 다른 설치 판정이 생긴다 |
| Composer 에이전트 목록을 `opencode agent list --pure`로 미리 조회한다 | 기각 — 출력에 hidden 표식이 없어 내부 에이전트가 섞이고 machine 형식이 없다. 정적 build·plan placeholder를 쓴다 |
| `LoginFreeDefinition.connect`(선택)로 연결 상태기계를 Auth에 두고, 호스트 능력은 고정 질의 포트로만 준다 | 채택 |

## 선택

- connect 선언 대상만 idle·checking·connected·failed 상태를 갖는다. 무선언 대상은 ADR-006 그대로다.
- 성공·실패는 기존 `AuthChange`(`credentialChanged`)로 흘러 runtime 카탈로그·도구 동기화가 같은
  경로로 반응한다. 결과가 이전과 같으면 revision을 올리지 않는다.
- 결과는 프로세스 메모리에만 있고, 부팅마다 `connectAll()`로 다시 확인한다. 확인이 끝날 때까지
  카드는 보이지 않는다. 연결 해제 액션은 두지 않는다.
- 연결 로직이 받는 능력은 `HostHarnessPort`(설치 확인·모델 목록)뿐이다. 설치 확인은 하네스 서버
  시작과 같은 `isInstalled()`, 모델 목록은 adapter가 같은 실행 파일·같은 1.x 판정으로 실행한다.
- 결과는 배포 augmenter가 `connectionValue`로 읽어 `availableModels`·`modelDetails`로 바꾸고,
  OpenCode 모듈의 runtime 파서가 읽기 전용 카드로 만든다.

## 포기한 것

- 재시작 직후 즉시 카드 표시(확인 왕복만큼 늦다).
- 오프라인 상태에서 마지막 결과로 카드를 유지하는 것.
- 사용자가 연결을 끊는 동작.

## invariant

- 로그인 프리 연결 상태·결과를 디스크에 쓰지 않는다.
- 연결 로직은 프로세스 실행 능력을 받지 않는다 — 고정 질의 포트만 받는다.
- 연결 설치 판정과 하네스 서버 시작 조건은 같은 함수다.
- 연결 버튼은 배포 연결 로직만 실행한다. 카탈로그 갱신은 Auth change가 맡는다.
