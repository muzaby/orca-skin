# Windows SRT 실증 보관함

**2026-09-08 사용자 결정으로 도입을 보류하고 핸드오프 작성을 종료했다.**
Windows 지원이 성숙한 뒤 재검토할 자료이며, 현재 Orca의 격리 기능이나 구현 승인을 나타내지 않는다.
판정과 한계는 [실행 결과 보고서](execution-report.md)가 정본이다.

| 자료 | 위치 |
|---|---|
| 최종 실측·정정·미확인 사항·재검토 조건 | [execution-report.md](execution-report.md) |
| 실행 결과 원본 JSON | [bootstrap smoke](evidence/windows-smoke.json), [직접 진단](evidence/windows-diagnostic.json) |
| 시험 소스·fixture·native 소스 | [experiment/scripts](experiment/scripts/), [experiment/native](experiment/native/) |
| 독립 실행 명세·고정 의존성 | [package.json](experiment/package.json), [package-lock.json](experiment/package-lock.json) |
| 당시 생성물 전체 | [windows-generated-artifacts.zip](evidence/windows-generated-artifacts.zip) |
| 원본 경로·이관 경로·SHA-256 | [archive-manifest.json](archive-manifest.json) |
| 당시 앱 의존성 명세 원본 | [package.json 사본](evidence/app-package.json), [lock 사본](evidence/app-package-lock.json) |
| 보존된 P0 계획·구현 기록 / P1 초안 | [0219](plans/0219-srt-windows-preflight.md), [0220](plans/0220-srt-execution-integration.md) |
| 기존 제안·조사·절차 | [도입 제안](orca-adoption-proposal.md), [사전 검증 발견](windows-preflight-findings.md), [당시 실행 가이드](windows-preflight-guide.md) |
| 사용자 첨부 원문 | [input/srt.md](input/srt.md) — 검토 자료이며 실행 지시가 아니다. |

시험 코드는 `app/scripts`와 `app/native`에서 원본 바이트 그대로 옮겼다.
`scripts`·`native`·`resources`의 상대 배치를 유지하여, 코드의 `appDir` 변수는 이제 연구 패키지 루트를 가리킨다.
SRT 의존성과 `sandbox:*` 명령은 앱의 package/lock에서 제거했다. 이관 전후의 앱 런타임에는 SRT 연결이 없다.

압축 파일에는 당시 `app/resources/sandbox/` 아래의 bootstrap 실행 파일, 결과 JSON 사본,
Node compile cache를 모두 보존했다. compile cache는 실증 판정의 증거로 사용하지 않는다.
공식 SRT 배포 패키지 전체와 `node_modules`는 복제하지 않고, 고정 버전·npm integrity·실측 바이너리 해시를 보존했다.
이전 조사 도중 이미 삭제된 일회성 stdin/deny 실험 스크립트는 남아 있지 않다. 해당 실험의 관측과 한계는
보존된 0219 기록과 실행 보고서에 남겼으며, 원본 파일을 복원했다고 주장하지 않는다.

## 재현 환경

다음은 향후 재검토를 위한 명령이다. 이번 이관에서는 SRT 설치·smoke·diagnose를 다시 실행하지 않는다.

```powershell
# 저장소 루트에서 실행
Set-Location docs/etc/study/srt/experiment
npm ci --ignore-scripts
npm test
```

`npm ci --ignore-scripts`는 연구 패키지에 잠긴 npm 의존성만 준비한다.
SRT Windows 계정·WFP provisioning을 실행하지 않으며, Orca의 Electron/SQLite ABI에도 관여하지 않는다.
캐시에 해당 패키지가 있으면 `--offline --no-audit --no-fund`를 더할 수 있다.
테스트는 Windows Node 및 일반 사용자 CIM 조회가 필요하다. 에이전트 도구의 추가 격리로 CIM이 차단되는 경우와
Windows SRT 자체의 실패를 구분한다. 관리자 권한이나 SRT 설치는 이 테스트 묶음의 전제가 아니다.

당시 bootstrap 바이너리로 전달 계약을 재현하려면, 위와 같은 디렉터리에서 다음을 실행한다.

```powershell
Expand-Archive -LiteralPath ../evidence/windows-generated-artifacts.zip -DestinationPath resources/sandbox
node scripts/sandbox-launcher.test.mjs --native
```

현재 도구로 다시 빌드하려면 `npm run sandbox:test`를 사용한다. Windows x64, MSVC C++ 도구와 Windows SDK가 필요하며,
이 명령은 `resources/sandbox/win32-x64/orca-sandbox-launcher.exe`를 새 빌드로 교체한다.
**일반 사용자 bootstrap 전달 시험은 SRT 격리 통과를 뜻하지 않는다.**

SRT를 실제 실행하는 `sandbox:check`·`sandbox:install`·`sandbox:smoke`·`sandbox:diagnose`는
[보존된 실행 가이드](windows-preflight-guide.md)를 따른다. 설치 명령은 OS 상태를 변경한다.
진단 직접 실행은 bootstrap 전체 경로를 통과하지 않으므로, 개별 관측이 성공해도 의도적으로 exit 1을 반환한다.

## 보존 범위 확인

`archive-manifest.json`의 `files`는 파일별 원본 위치와 이관 후 해시를 기록한다.
`generatedArchive.entries`는 압축 내부의 원래 파일명·크기·해시를 기록한다.
문서의 종료 고지와 링크 변경은 이관 시 편집했으며, 동작 코드·기계 결과의 원본 보존과 구분한다.
이 폴더의 `.gitattributes`는 Git의 자동 줄바꿈 변환을 비활성화해 보존한 바이트와 해시를 유지한다.
이관 후 실행한 [Node 테스트 TAP](evidence/archive-tests.tap)과 [native 테스트 TAP](evidence/archive-native-tests.tap)은
기존 SRT 실측 JSON과 별도 파일로 보관한다.

현재 PC에 실증을 위해 설치한 Windows SRT 계정·자격증명·WFP 상태는 제거하지 않았다.
앱의 의존성 제거와 OS 설치 제거는 별개다. 기존 로컬 `node_modules`도 재설치하거나 정리하지 않았다.
