# Windows SRT 실증 결과와 입력 전달 보완안

**제품 연결 보류.** 이 PC의 공식 SRT 설치는 완료했지만, 설치된 Windows 실행기가 호출자의
stdin을 대상에 전달하지 않아 bootstrap을 통한 실행이 실패했다. Claude 지속 입력과 stdio
MCP가 필요한 현재 요구를 공식 바이너리 그대로 충족했다고 판정할 수 없다.

## 실행 기준

| 항목 | 실증 기준 |
|---|---|
| OS / 개발 Node | Windows 10.0.22631, x64 / Node 22.15.1 |
| npm dependency | `@anthropic-ai/sandbox-runtime` 0.0.75 정확 고정 |
| 공식 Windows binary SHA-256 | `82871cfa804d24f1bad16b946d1008db69890d6828887b9d0073e1b0185a9eb2` |
| Orca bootstrap SHA-256 | `f5388d8230d9d9b0d92a1a6b5dbc3f6351c3ca6702a92156b560c77436374790` |
| 승인 범위 | 사용자 “진행하라”에 따른 이 PC의 설치·실증. 제품 부팅 자동 설치나 별도 SRT 수정 배포의 승인은 아님 |
| 사용 자료 | task-owned fixture, 가짜 입력·키, 로컬 HTTP listener. 실제 사용자 비밀을 읽거나 전송하지 않음 |

## 실제 관측과 원인 분리

| 대상 | 관측 | 판정 |
|---|---|---|
| 공식 설치 | userProvisioned·credentialPresent=true, 일반 사용자 WFP 조회는 cannot-read | 설치 전제 충족. 실제 제한 동작과 구분 |
| SRT→bootstrap | exit 125, `READ_FAILED 109` | stdin 경로 실패 |
| SRT→직접 Node | `readFileSync(0)` 수신 0 bytes | bootstrap 파싱 이전의 입력 부재 |
| 부모 stdin EOF 대조 | `end(frame)`을 `write(frame)`로 바꿔 열어 두어도 동일 실패 | 부모의 조기 EOF만으로 설명할 수 없음 |
| 일반 Node→bootstrap | 비동기 spawn에서도 frame과 후속 binary bytes 보존 | Node 기본 pipe와 bootstrap의 직접 호환성 확인 |
| 중복 deny 정책 | 같은 경로에 denyRead·denyWrite를 모두 지정하면 가짜 파일 읽기 성공, 쓰기 EPERM | 중복 정책 처리 문제 |
| 중복 제거 대조 | read-deny만 지정하면 같은 파일의 읽기·쓰기 모두 EPERM | 더 강한 read-deny를 유지하고 중복 write-deny를 제외 |
| 네트워크 | 허용 proxy 200, 거부 proxy 403, 직접 IPv4·IPv6 EACCES | 시험 endpoint 범위에서 차단 확인 |
| 시험 자산 위치 | 사용자 TEMP 아래 `.mjs`는 상위 프로필 lstat EPERM, 작업공간 산출 폴더에서는 실행 | 사용자 홈 권한을 넓히지 않고 시험 자산 위치 수정 |
| 자손 생존 oracle | `process.kill(pid,0)`의 권한 부족을 생존으로 셌음 | 이전 자손 실패 관측은 확정 증거에서 제외. PID+생성 시각 관측으로 재검증 |

각 실험의 실패와 정리는 별도로 관측했다. 일반 bootstrap smoke와 직접 진단은 실행 경로가
다르므로 직접 진단의 성공 항목으로 bootstrap 전달 실패를 덮지 않는다.
재현 명령과 최신 기계 결과는 [0219 구현 보고](../../../handoff/0219-srt-windows-preflight/plan.md)에 둔다.

## 상류 소스와 확인 한계

[공식 v0.0.75 release](https://github.com/anthropics/sandbox-runtime/releases/tag/v0.0.75)는
commit `40804af269e1616092e9971de12a1f358f58eba9`를 가리킨다. 해당 tag의 Rust 파일 본문은
이번 환경에서 가져오지 못했으므로 아래 main 소스와 고정 binary의 동일성은 미확인이다.

공개 main [logon.rs](https://github.com/anthropics/sandbox-runtime/blob/main/vendor/srt-win-src/src/logon.rs#L360)는
RunnerCmd를 전송한 뒤 입력 write handle을 닫고 stdout/stderr만 중계한다.
이는 설치된 binary의 입력 0-byte 관측과 부합한다.

공개 main [runner.rs](https://github.com/anthropics/sandbox-runtime/blob/main/vendor/srt-win-src/src/runner.rs#L66)는
길이로 명세 경계를 구분하지만 Rust 표준 stdin 버퍼를 사용한다. 단순히 write handle을
닫지 않는 수정은 후속 입력의 read-ahead 유실과 종료 대기 문제까지 해결하지 않는다.

동일 경로 deny의 추정 원인은 [cli.rs의 처리 순서](https://github.com/anthropics/sandbox-runtime/blob/main/vendor/srt-win-src/src/cli.rs#L1102)와
[state_db.rs의 동일 holder mask 교체](https://github.com/anthropics/sandbox-runtime/blob/main/vendor/srt-win-src/src/state_db.rs#L723)다.
정확한 Rust 버전 동일성 주장 대신 실제 동일 조건 A/B 결과를 정책 보정 근거로 삼는다.

## 권고: SRT 입력 전달만 보완한 관리 빌드

**설계 제안이며 채택·적용 전이다.** 공식 SRT 보안 정책을 유지하면서 Windows stdin 경로만
수정하는 방식을 권고한다. 토큰·계정·ACL·WFP·Job·desktop 정책을 Orca에 재구현하지 않는다.

| 수정 경계 | 구체적인 변경 | 금지할 동작 |
|---|---|---|
| SRT broker `logon.rs` | Exec의 RunnerCmd 전송 뒤 caller stdin→runner stdin 전달. 입력 EOF와 실행 종료를 별도로 처리 | 설치/CA/egress probe가 stdin을 기다리게 만들기 |
| SRT runner `runner.rs` | 명세 길이만 Win32 비버퍼 read로 소비하고 나머지 HANDLE을 target에 상속 | 표준 버퍼의 read-ahead로 SDK 입력 소비 |
| 전송 수명 | bounded buffer·partial write, 입력 EOF, 출력 backpressure, child가 먼저 끝났을 때 입력 worker 취소·회수 | 열린 host stdin 때문에 종료가 멈추거나 출력이 유실됨 |
| 배포 입력 | 공식 tag의 전체 source 확보·검증 후 작은 patch로 유지, source/patch/binary hash 고정 | 미확인 main을 고정 버전이라고 표시, npm 설치 때 임의 재빌드 |
| 빌드 | SRT의 Rust 빌드는 개발/CI에만 둠. 배포에는 고정 native binary 포함 | 사용자 PC에 Rust runtime/toolchain 설치 요구 |
| Orca 경계 | 기존 C++ bootstrap·공통 실행 포트·SDK Main 유지 | SDK별 별도 sandbox 엔진, 비격리 fallback |

현재 공식 binary를 직접 수정하거나 대체하지 않았다. 수정 빌드를 채택하면 Orca가
보안 의존성의 patch·빌드·업데이트 검증을 지속해서 소유해야 하므로 사용자의 선택이 필요하다.

### 채택 후 통과해야 할 검증

1. 제어 명세와 binary stdin을 같은 write 및 분할 write로 전송해 바이트 손실·중복이 없는지 확인한다.
2. stdin을 연 채 target이 먼저 종료하는 경우, 입력만 닫고 target이 출력하는 경우를 각각 검증한다.
3. 출력 압력·취소·broker 강제 종료에서 runner와 독립 자손을 PID+생성 시각으로 관측한다.
4. 기존 설치·CA·WFP probe가 새 입력 relay를 기다리지 않는지 회귀 검증한다.
5. 실제 bootstrap frame+후속 입력, 파일 허용/거부, proxy·직접 IP 차단, ACL 복구를 다시 검증한다.
6. 이후 Claude 두 query와 보조 completion, stdio MCP를 연결한다. OpenCode·cowork는 공통 포트의 후속 소비자로 남긴다.

### 대안과 선택 비용

공식 수정 release를 기다리면 자체 binary 유지 부담을 피하지만 현재 요구의 구현은 보류된다.
Orca 전용 named pipe를 추가하면 SRT binary는 유지할 수 있으나 cross-user DACL·정확한 연결 상대
확인·연결 경합·EOF·HANDLE 수명을 새로 소유해야 하므로 경량화와 모듈 책임 측면에서 권고하지 않는다.

관리 빌드 채택 여부와 별개로, 현재 제품 연결은 입력 전달의 실제 통과 이후에 진행한다.
