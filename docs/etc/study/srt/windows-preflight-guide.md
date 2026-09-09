# Windows SRT 실험 재현 절차 (보관)

> **사용자 결정으로 Windows 지원이 성숙할 때까지 SRT 도입을 보류했다.** 아래 명령은 study에 보존한 실험의 재현 절차이며 앱 도입·설치 재개 지시가 아니다.
> 실행 결과와 남은 제약은 [실행 보고서](execution-report.md), 실험 구성과 재현 전제는 [study 안내](README.md)를 확인한다.

이 절차는 **SRT 실행 전달을 검증하는 P0 개발 도구**를 위한 것이다. 일반 Orca 앱의 Claude
채팅·제목 생성은 아직 SRT에 연결하지 않았다. 이 절차가 성공해도 앱 전체의 격리 도입 완료로
판정하지 않는다.

명령 정본은 [`experiment/package.json`](experiment/package.json), 검사·설치·실증 동작은
[`check-sandbox.mjs`](experiment/scripts/check-sandbox.mjs), native 전달 계약은
[`sandbox-launch-frame.mjs`](experiment/scripts/sandbox-launch-frame.mjs)와
[`main.cpp`](experiment/native/sandbox-launcher/main.cpp)다. 설계 근거는
[도입 제안](orca-adoption-proposal.md), 실행 결과와 보류 근거는
[실행 보고서](execution-report.md)를 확인한다(0219).

## 실행 전 준비

| 확인할 것 | 조치 |
|---|---|
| 실행 환경 | 현재 빌드·실증 대상은 Windows x64다. WSL·Docker·AppContainer를 준비하지 않는다. |
| 실험 의존성 | [실험 package.json](experiment/package.json)과 [study 안내](README.md)의 재현 전제를 따른다. 앱의 의존성과 별도로 관리한다. |
| native 빌드 도구 | MSVC C++ 도구와 Windows SDK를 준비한다. 빌드 스크립트가 선택한 toolchain과 대상 아키텍처를 확인한다. |
| 시험 자료 | disposable fixture와 가짜 키만 사용한다. 개인 SSH 키·Vault·실제 인증값을 시험 입력으로 넣지 않는다. |
| OS 설치 변경 | npm 패키지 준비와 Windows SRT provisioning을 구분한다. 관리자 설치는 아래 명시 설치 단계에서만 수행한다. |

bootstrap은 C++17/Win32로 빌드한다. 대상 프로세스 전달을 위해 별도의 Rust·Node·Python
런타임을 배포하지 않는다. 테스트 명령이 사용하는 Node는 개발 환경의 시험 도구다.

## 빌드와 전달 검증

저장소 루트의 PowerShell에서 작업 위치를 옮긴다.

```powershell
Set-Location docs/etc/study/srt/experiment
npm run sandbox:build
npm run sandbox:test
```

`sandbox:build`의 산출 경로와 아키텍처를 확인한다. 실패하면 기존 산출물을 새 빌드 결과로
취급하지 않는다. 빌드 경로 선택과 출력 교체는
[`build-sandbox-launcher.mjs`](experiment/scripts/build-sandbox-launcher.mjs)가 갖는다.

`sandbox:test`는 실제 bootstrap과 시험 프로그램 사이의 argv·env·stdin·stdout·stderr·exit
전달을 확인한다. **이 단계는 원래 사용자 권한의 전달 검증이며 SRT 격리 증거가 아니다.**
native 전달 검증을 숨겨 건너뛴 결과를 성공으로 기록하지 않는다.

| 결과 | 판정 |
|---|---|
| 유효 입력을 대상이 원형으로 수신 | 전달 계약의 해당 항목 통과 |
| 잘못된 frame을 target 시작 전에 거부 | 입력 거부 계약의 해당 항목 통과 |
| 빌드 도구·native 산출물 부재 | 실행 전제 미충족. SRT 실증으로 진행하지 않는다. |
| 전달 불일치·출력 유실·잘못된 exit | bootstrap 실패. OS 격리 성공 여부와 별도로 수정한다. |

내부 frame의 magic/version·길이·UTF-8·argv·env 구조와 상한은 encoder/native 코드가 정본이다.
frame 뒤의 입력은 대상 stdin으로 이어진다. 형식 오류는 target을 실행하지 않고 진단과 실패
exit를 반환하며, credential이나 frame 본문을 진단에 기록하지 않는다.

## 설치 상태 확인

같은 `docs/etc/study/srt/experiment` 디렉터리에서 실행한다.

```powershell
npm run sandbox:check
```

`check`는 상태를 확인한다. 계정 생성·WFP 설정·레지스트리 provisioning을 자동 실행하지 않는다.
미설치나 사용할 수 없는 상태면 원인을 확인하고 다음 설치 단계를 별도로 수행한다.
미설치 상태를 원래 사용자 권한의 probe 실행으로 대체하지 않는다.
WFP 상태가 `cannot-read`이면 일반 사용자로 설치 여부를 확정하지 못한 상태다. 설치된 것으로
단정하지 않고 `smoke`의 실제 WFP 확인 결과를 따른다.

## 명시 설치

Windows SRT 최초 provisioning은 전용 sandbox 사용자·기계 설정·Windows Filtering Platform
(WFP) 정책을 준비하는 **관리자 권한 작업**이다. 설치 권한이 승인된 환경에서만 실행한다.
평소 앱 시작이나 `check` 실패를 이유로 자동 설치·자가 승격하지 않는다.

```powershell
npm run sandbox:install
```

권한 요청과 공식 installer의 결과를 확인한 뒤 상태를 다시 검사한다.

```powershell
npm run sandbox:check
```

관리자 권한을 사용할 수 없거나 설치가 실패하면, 전달 테스트 결과는 보존하고 **SRT 실증은
차단됨**으로 기록한다. npm 패키지만 설치된 상태를 OS provisioning 완료로 세지 않는다.

## 제한 실행 실증

빌드·전달 테스트·설치 상태가 준비된 뒤 실행한다.

```powershell
npm run sandbox:smoke
```

실증 결과에서 실행 성공뿐 아니라 fixture·네트워크·자손 프로세스·정리 관측을 함께 확인한다.
실제 실행하지 못한 항목과 시험 범위 밖의 항목은 통과로 세지 않는다.

| 관측 | 확인할 결과 |
|---|---|
| SRT 전달 | 가짜 환경 값·작업 경로와 JSON 옵션에 넣은 시험 문자열이 실제 제한 실행에서 보존된다. 개별 argv의 빈 인수·따옴표 전달은 앞선 native 전달 테스트가 확인한다. |
| 허용 fixture | 지정한 read/write가 성공하고 호스트에서 기대한 내용이 보인다. |
| 거부 fixture | 지정한 read/write가 실패하고 보호한 내용은 바뀌지 않는다. |
| 네트워크 fixture | proxy를 통한 허용·거부 결과를 구분한다. 테스트 endpoint 외의 통신까지 검증했다고 일반화하지 않는다. |
| nested child | 실행·종료 관측으로 자손의 수명을 확인한다. 부모 exit만으로 자손 종료를 가정하지 않는다. |
| reset·정리 | child/proxy 종료 및 시험 fixture ACL의 전후 상태를 확인한다. cleanup 호출 자체를 정리 성공으로 세지 않는다. |

실증 실패와 cleanup 실패를 각각 기록한다. 실패 뒤 남은 프로세스나 fixture가 있으면 스크립트가
보고한 실제 대상부터 확인한다. 전체 사용자 디렉터리 ACL을 재설정하거나 다른 SRT 세션의
프로세스를 일괄 종료하는 방식으로 복구하지 않는다.

Ctrl+C는 취소를 요청하고 스크립트의 정리를 기다린다. SRT 초기화 중에는 취소 API가 없으므로
초기화가 끝난 뒤 reset을 시도한다. 콘솔 창 강제 종료·호스트 강제 종료까지 정리를 보장하지 않는다.
`reset` 실패·시간 초과, ACL 불일치, 실행기·자손 잔존 또는 자손 PID 관측 미완료 시 fixture를 삭제하지 않고 JSON의
`retainedFixture`에 소유 경로를 남긴다. 해당 경로의 `.orca-smoke-owner`와 실행 상태를 확인하고,
진행 중 reset이 종료되었는지 및 ACL 복구 결과를 먼저 확인한 뒤 그 fixture만 정리한다.
상류 reset은 일부 내부 실패를 삼킬 수 있으므로 호출 완료와 ACL 복구 관측을 함께 확인한다.

## 입력 실패를 분리하는 진단

```powershell
npm run sandbox:diagnose
```

이 명령은 **SRT 안에서 시험용 Node를 직접 실행**한다. bootstrap frame이 도달하지 않아도
stdin byte count·filesystem·network·자손 관측을 분리할 수 있다. 결과의 `executionPath`는
`diagnostic-direct`이며 `success=false`, exit 1을 유지하므로 전체 도입 gate로 사용하지 않는다.

`smoke`와 `diagnose`의 fixture는 빌드 산출 폴더에 만든다. 사용자 TEMP 아래 Node 모듈을
실행하려면 상위 사용자 프로필의 lstat가 필요할 수 있어, 프로필 read 권한을 넓히는 대신
시험 자산을 사용자 프로필 밖에 둔다. 저장소 자체가 보호된 사용자 프로필 아래면 해당 실패를 별도로 확인한다.

| 진단 필드 | 해석 |
|---|---|
| `observations.stdin` | 가짜 입력의 byte count와 hash 일치 여부. 입력 본문은 출력하지 않음 |
| `diagnostics` | 실행별 exit와 고정 오류 코드. stderr·argv·env 원문은 출력하지 않음 |
| `observedPids` / `runnerTermination` | 진단에서만 출력하는 시험 PID와 종료 요청 결과 |
| `childrenObservationComplete=false` | 자손이 없다는 뜻이 아님. CIM 관측 실패·PID 누락은 unknown으로 유지 |

자손 관측은 PID와 생성 시각을 함께 비교한다. `process.kill(pid,0)`의 권한 부족을 생존으로
해석하지 않는다. CIM 접근이 제한된 환경에서는 시험 fixture를 보존하고 정리 성공으로 판정하지 않는다.

고정 SRT의 동일 경로 read/write deny 충돌을 피하려고, 시험의 거부 디렉터리에는 더 강한
read-deny만 전달한다. 읽기와 쓰기 거부 결과는 둘 다 실제 실행으로 검사한다.
실증에서 발견한 제약과 수정 빌드 선택은 [실증 결과와 보완안](windows-preflight-findings.md)을 따른다.

## 결과를 해석하는 범위

| 제한 | 운영 판정 |
|---|---|
| 공유 sandbox SID | helper가 다르더라도 Windows 보안 주체가 같을 수 있다. 별도 프로세스를 workspace 상호 격리 증거로 쓰지 않는다. |
| ambient NTFS ACL | 지정 fixture의 거부 성공을 디스크 전체 confinement로 확대하지 않는다. 실제 허용 경로·상속 권한이 결과에 영향을 준다. |
| 잔여 grant·자손 | 순차 실행도 이전 실행의 ACL·프로세스가 남으면 영향을 받는다. 단일 active workspace만으로 해결됐다고 판정하지 않는다. |
| DNS·허용 endpoint | 도메인 allowlist 시험을 DNS 완전 차단·정보 유출 완전 방지로 보고하지 않는다. |
| 실행 credential | child env로 전달한 값은 제한 영역의 코드가 읽을 수 있다. Main의 Vault 보호와 실행 중 키 비노출을 구분한다. |

상류 근거와 제품 수용이 필요한 조건은 [도입 제안 §10](orca-adoption-proposal.md#10-srt만-사용하는-조건에서-남는-실제-한계)을 따른다.
실증 기록에는 실행 명령·대상 아키텍처·설치 상태·항목별 관측·정리 결과·차단 원인을 남긴다.
가짜 값이라도 전체 env나 launch frame을 그대로 기록하지 않는다.

## 정리와 후속

개별 실증 정리와 기계 수준 SRT 제거는 다른 작업이다. P0 도구는 Orca 전용 uninstall이나
전용 계정·WFP 정책의 자동 제거를 수행하지 않는다. 제거가 필요하면 사용 중인 다른 SRT 실행이
있는지 확인하고 설치된 SRT의 공식 제거 절차를 따른다.

보류된 후속 설계는 공통 실행 lease·utility process·Claude custom spawn의 통합을 검토했다. 아래 항목은 재개 지시가 아니다. 당시 검토한 범위에는
계획 파일 Write, Confluence 다운로드 후 Read, resume/fork와 배포 경로가 포함됐고
회귀 검증이 필요했다. OpenCode와 cowork 제품 기능도 구현하지 않았다.
