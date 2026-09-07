# Windows SRT 실행 결과 보고서

**도입 보류.** 2026-09-08 사용자는 Windows 지원이 성숙할 때까지 SRT 도입을 보류하고 핸드오프 작성을 여기서 종료하도록 결정했다. 실제 실험에서는 파일·네트워크·자손 정리가 지정 fixture 범위에서 동작했지만, 공식 Windows 실행기의 stdin 전달이 실패해 Orca bootstrap과 Claude 연결의 선행 조건을 충족하지 못했다.

이 문서는 종료된 연구의 결과 정본이다. 보존된 제안·계획·실험 코드는 현재 Orca 아키텍처나 재개 지시가 아니며, Claude·OpenCode·cowork 제품 통합은 완료되지 않았다.

## 1. 실행 기준과 보존 자료

| 항목 | 당시 실행 기준 |
|---|---|
| 실행일 | 2026-09-08 |
| 환경 | Windows 버전 `10.0.22631`, x64 · 개발 Node `22.15.1` |
| SRT npm 패키지 | `@anthropic-ai/sandbox-runtime@0.0.75` 정확 고정 |
| 공식 Windows binary SHA-256 | `82871cfa804d24f1bad16b946d1008db69890d6828887b9d0073e1b0185a9eb2` |
| 당시 Orca bootstrap SHA-256 | `f5388d8230d9d9b0d92a1a6b5dbc3f6351c3ca6702a92156b560c77436374790` |
| bootstrap | C++17/Win32, MSVC·Windows SDK로 빌드한 전달·실행 시험 프로그램 |
| 설치 승인 | 이 PC의 공식 SRT 관리자 설치·실증에 한정. 제품 자동 설치·수정 SRT 배포의 승인은 아님 |
| 시험 데이터 | 소유 표식이 있는 disposable fixture·가짜 값·로컬 HTTP listener. 실제 사용자 비밀은 시험 입력으로 사용하지 않음 |

| 보존 자료 | 의미 |
|---|---|
| [windows-smoke.json](evidence/windows-smoke.json) | 공식 SRT → bootstrap 전체 전달 경로의 최종 실패와 정리 결과 |
| [windows-diagnostic.json](evidence/windows-diagnostic.json) | bootstrap을 제외하고 SRT 안에서 직접 Node를 실행한 최종 진단 결과 |
| [experiment/package.json](experiment/package.json) | 앱과 분리해 보존한 실험의 의존성·재현 명령 정본 |
| `experiment/scripts/`, `experiment/native/` | 검사·probe·관측기·테스트와 native 소스 원본 |
| [windows-generated-artifacts.zip](evidence/windows-generated-artifacts.zip) | 당시 `resources/sandbox`의 실행 바이너리·cache·중복 JSON 등 생성물 원본 |
| [archive-manifest.json](archive-manifest.json) | 보존 파일과 무결성 확인 정보 |
| [0219 계획·구현 기록](plans/0219-srt-windows-preflight.md) | 당시 P0 계약, 중간 대조 실험과 실행 기록. 현재 진행 지시가 아님 |
| [0220 설계 초안](plans/0220-srt-execution-integration.md) | 공통 실행 기반·Claude 연결 검토. 구현 미착수 상태에서 보류 |
| [당시 실행 절차](windows-preflight-guide.md) | P0 운영 명령의 기록. 현재 작업 재개 지시가 아님 |

두 JSON은 각각 다른 실행 경로의 기록이며 합쳐서 하나의 성공 결과로 읽으면 안 된다. 초기 대조 실험은 당시 구현 기록에 남아 있고, 최종 JSON이 모든 중간 실험의 원시 출력을 포함하지는 않는다.

## 2. 최종 실측 결과

| 항목 | bootstrap smoke | 직접 진단 | 판단 |
|---|---|---|---|
| 실행 경로 | `bootstrap` | `diagnostic-direct` | 별도 경로 |
| 전체 결과 | `success:false` | `success:false`, `srt_diagnostic_only` | 둘 다 제품 도입 성공이 아님 |
| stdin | bootstrap exit `125`, `READ_FAILED`, Win32 `109` | `bytes:0`, `hashMatches:false` | 입력 전달 실패 |
| echo | `PROBE_NO_RESULT` | marker·JSON 옵션의 시험 문자열·cwd 일치, 가짜 env 불일치 | argv/env 전체 전달 성공으로 해석하지 않음 |
| 허용 파일 | 미도달 | read/write 성공, 읽은 길이 `17` bytes | 지정 fixture에서 성공 |
| 거부 파일 | 미도달 | read/write 모두 `EPERM` | 지정 fixture에서 거부 |
| 호스트 파일 대조 | 미도달 | 허용 내용 일치·거부 내용 불변·거부 쓰기 파일 부재 | 직접 진단 결과 확인 |
| HTTP proxy | 미도달 | 허용 `200`, 거부 `403` | 시험 목적지 정책 동작 |
| 직접 TCP | 미도달 | IPv4·IPv6 모두 `EACCES` | 시험 loopback 연결 차단 |
| listener 도달 | 허용·거부 모두 `0`회 | 허용 `1`회·거부 `0`회 | proxy의 거부 응답과 실제 거부 listener 미도달을 함께 확인 |
| 자손 종료 | 미도달 | 시작 identity 확인 뒤 SRT 실행기 종료, 같은 identity 소멸 | 보정된 관측기로 해당 실행 트리 회수 확인 |
| 정리 | reset·runner·listener·ACL 복구 확인 | 동일 | 두 실험의 정리 결과를 각각 확인 |
| fixture | `fixtureRemoved:true`, 잔존 자손 없음 | 동일 | 해당 시험 자료 정리 완료 |

smoke JSON에서 파일·네트워크·자손 검사의 `passed:false`는 첫 echo 단계 실패 뒤 해당 probe에 도달하지 못한 결과다. 해당 경로에서 파일 또는 네트워크 정책이 실제로 잘못 허용됐다는 뜻은 아니다.

직접 진단은 입력 전달 실패를 우회해 OS 동작을 분리 관측하기 위한 시험이다. 명령은 의도적으로 exit `1`과 `success:false`를 유지하며, 최상위 `enforcement`도 `unverified`로 남는다.

## 3. stdin 실패를 분리한 대조

| 대조 | 관측 | 확인한 범위 |
|---|---|---|
| 일반 Node → native bootstrap → 대상 | frame 뒤의 binary stdin, stdout/stderr, 종료 코드 보존 | 원래 사용자 권한에서의 bootstrap 전달 |
| SRT → 같은 bootstrap | `READ_FAILED 109`, exit `125` | 제한 실행의 입력 경로에서 실패 |
| SRT → 직접 Node | `readFileSync(0)` 결과 `0` bytes | bootstrap parser 이전에 입력 부재 |
| 호출자의 stdin을 닫지 않고 유지 | 동일 실패 | 단순한 호출자 조기 EOF만으로 설명되지 않음 |

native 전달 시험은 빈 인수·인용·한글·역슬래시와 frame 뒤 입력을 검사했다. 직접 진단의 `argsMatch`는 JSON 옵션에 실은 시험 문자열 비교이므로, SRT 전체 경로의 개별 argv·빈 인수 보존 증거와 구분한다.

직접 진단의 `fakeEnvMatches:false`도 성공으로 세지 않는다. bootstrap을 통한 env 전달 경로 자체가 막혀 있으므로, 직접 실행의 파일·네트워크 통과로 전체 launch frame 계약을 충족했다고 볼 수 없다.

## 4. 중복 deny 정책의 A/B 결과

| 조건 | 같은 가짜 파일의 읽기 | 같은 거부 영역의 쓰기 |
|---|---|---|
| A: 동일 경로를 `denyRead`와 `denyWrite`에 함께 지정 | 성공 | `EPERM` |
| B: 동일 경로에는 더 강한 `denyRead`만 지정 | `EPERM` | `EPERM` |

최종 직접 진단은 B 조건으로 수행했다. P0에서는 동일 거부 경로의 중복 write-deny를 제외했고, 두 접근의 거부를 실제로 다시 확인했다.

동일 holder의 ACL mask 교체와 적용 순서가 원인일 가능성은 공개 main 소스를 읽은 추정이다. 정확한 고정 버전 Rust 소스와의 동일성을 확보하지 못했으므로, 내부 원인을 확정하거나 일반 정책 compiler가 구현됐다고 표현하지 않는다.

## 5. 자손 종료 판정 정정

초기에는 SRT 실행기를 종료한 뒤 자손이 남았다고 보고했으나, 그 판정은 철회한다. 당시 관측기가 Windows의 접근 권한 부족을 실제 생존으로 분류했기 때문이다.

| 관측기 문제 | 보정 | 최종 증거 |
|---|---|---|
| 부모 stdin EOF와 libuv 자체 정리로 자손이 자발 종료 | `independentDescendants:true`를 모든 자손에 전파, 해당 자손만 detached 실행 | SRT 없는 일반 Node 대조에서 부모만 종료하면 자손은 살아 있음 |
| `process.kill(pid,0)`의 `EPERM`을 alive로 분류 | CIM의 PID와 생성 시각을 함께 비교 | 권한 부족은 미관측으로 처리하고 PID 재사용을 구분 |
| PID 번호만 보고 보조 kill을 시도 | sampled PID 직접 kill 제거, 보유한 실행기 handle만 종료 | 최종 진단은 자손 PID 보조 종료 없이 identity 소멸 확인 |
| PS5가 JSON PID 배열을 중첩 배열로 처리 | `ConvertFrom-Json` 결과를 직접 대입 | 일반 자식 프로세스 시작·종료 관측 테스트 통과 |

libuv `1.49.2`는 detached 경로에서 `CREATE_BREAKAWAY_FROM_JOB`를 요청하지 않지만, 그 사실만으로 SRT Job 상속을 증명하지는 못한다. 최종 직접 진단의 자손 종료는 별도의 실제 관측이며 `observedAlive:true`, `deadAfterRunnerExit:true`, `residualChildren:false`로 기록돼 있다.

조회 권한 부족·timeout·identity 누락은 정리 성공이 아니라 unknown이다. 보존된 관측기는 이 경우 fixture를 유지하며, TTL 이후 프로세스가 없다는 관측만으로 앞선 종료 시점의 정리를 소급 증명하지 않는다.

## 6. 실측·추정·미검증의 경계

| 구분 | 내용 |
|---|---|
| 실측 | 고정 binary의 stdin `0` bytes, bootstrap `READ_FAILED 109`, 동일 조건 deny A/B, 최종 직접 진단의 파일·네트워크·자손·fixture ACL 결과 |
| 소스와 부합하는 해석 | 공개 main `logon.rs`의 RunnerCmd 이후 stdin handle 종료 및 stdout/stderr 중계 구조가 입력 부재 관측과 부합 |
| 추정 | 공개 main `cli.rs`·`state_db.rs`의 처리 순서·mask 교체가 deny A/B 원인이라는 해석 |
| 미확인 | 고정 `v0.0.75` Rust 본문과 조사한 main 소스의 동일성, 수정해야 할 정확한 파일·diff·최소 변경량 |
| 미실행 | SRT 수정 빌드·공식 binary 교체·named pipe 우회·앱 통합 |

당시 확인한 [공식 v0.0.75 release](https://github.com/anthropics/sandbox-runtime/releases/tag/v0.0.75)의 commit은 `40804af269e1616092e9971de12a1f358f58eba9`다. 해당 tag의 Rust 파일 본문은 확보하지 못했으므로 release commit 확인을 소스·binary 동일성 검증으로 대신하지 않는다.

조사한 공개 main 위치는 [logon.rs](https://github.com/anthropics/sandbox-runtime/blob/main/vendor/srt-win-src/src/logon.rs), [runner.rs](https://github.com/anthropics/sandbox-runtime/blob/main/vendor/srt-win-src/src/runner.rs), [cli.rs](https://github.com/anthropics/sandbox-runtime/blob/main/vendor/srt-win-src/src/cli.rs), [state_db.rs](https://github.com/anthropics/sandbox-runtime/blob/main/vendor/srt-win-src/src/state_db.rs)다. main 링크는 이후 변경될 수 있으며 위 실측 binary의 소스 정본으로 취급하지 않는다.

SRT 입력 전달 보완안은 제안까지만 검토했다. 제어 명세와 후속 stdin의 경계, read-ahead, partial write, backpressure, EOF, 대상이 먼저 종료할 때 입력 대기 정리까지 검증해야 하므로 `drop(stdin)` 한 줄만 제거하면 해결된다고 확정하지 않았다.

사용자는 수정 빌드 채택 대신 Windows 지원 성숙까지 보류하기로 결정했다. SRT 소스·보안 정책은 수정하지 않았고, 별도 관리 바이너리의 빌드·배포·유지 책임도 채택하지 않았다.

## 7. 완료로 판단하지 않은 범위

| 범위 | 남은 검증 |
|---|---|
| Orca 종단 | utilityProcess·공통 lease·Claude custom spawn·채팅·제목·worktree 이름 생성 연결 |
| Claude 수명 | warm/steer/승인/listen, 준비 중 취소, LRU·respawn·quit·비정상 종료 |
| 기존 상태 | sandbox 전용 CLI 상태, 기존 이력의 선택 이관, resume/fork, worktree 공용 Git metadata |
| 도구·플러그인 | 실제 shell/interpreter, skill junction, stdio·HTTP MCP, native hook, Main trusted 도구 권한 |
| 파일 전달 | 계획 파일 Write, Confluence 다운로드 후 Read, 관리 staging·artifact 소비 |
| Main Git | 저장소 hooks·filter·textconv 등 저장소 코드 실행 경계 |
| OpenCode | SRT-launched server와 SDK client, 인증·readiness·HTTP/SSE·설정·cache |
| cowork | 작업·artifact·미리보기와 실행 범위 연결 |
| 동시성·보안 범위 | 공유 SID의 다중 scope 영향, ambient NTFS 권한, grant 철회·잔여 ACL |
| 네트워크·배포 | DNS/UDP, 외부 업무 endpoint, 기업 proxy/PAC/CA/인증/mTLS, 설치·업데이트·복구·제거 |

시험 loopback의 허용·거부 결과는 임의 외부 통신이나 DNS 유출 차단을 증명하지 않는다. 서로 다른 helper나 프로세스를 만들더라도 공유 sandbox SID를 workspace 상호 기밀성 보장으로 설명할 수 없다.

## 8. 정리와 설치 잔존

최종 smoke와 직접 진단은 각 fixture ACL의 전후 hash 일치, runner·listener 종료, fixture 삭제를 기록했다. 초기 실패로 남겨 둔 fixture도 이후 시험 프로세스 부재·소유 표식·경계·reparse 부재·기록된 ACL hash를 확인한 뒤 해당 폴더만 삭제했다.

**Windows SRT 설치는 제거하지 않았다.** 실증 당시 `userProvisioned:true`, `credentialPresent:true`였으며, 보류 결정은 설치 롤백 요청으로 해석하지 않았다.

기계 수준 계정·credential·WFP 등 provisioning의 제거는 수행하지 않았고, 다른 SRT 소비자의 상태를 일괄 변경하지 않았다. 일반 사용자 조회의 `wfp:cannot-read`는 그 조회로 WFP 설치 상태를 확정하지 못했다는 뜻이며, 최종 지정 연결의 차단 관측과 별개다.

앱에서 실험 파일·의존성을 분리하는 저장소 정리는 OS provisioning 제거와 다르다. 이 보고서는 설치 상태를 새로 검사하거나 권한 상승·정리 명령을 실행한 결과가 아니다.

## 9. 테스트 기록과 재현 자료의 해석

| 당시 검증 | 기록된 결과 | 한계 |
|---|---|---|
| MSVC build·native 전달 | native `6/6`, skip `0` | 원래 사용자 권한의 전달 시험 |
| P0 Node scripts suite | 최종 `46/46`, skip `0` | 관측기 포함 개발 도구 회귀. 실제 SRT 종단 성공과 구분 |
| 변경 scripts ESLint | error `0`, warning `0` | 정적 검사 |
| bootstrap smoke | exit `1` | 입력 전달 실패가 남음 |
| 직접 진단 | 의도된 exit `1` | 일부 OS 동작 통과를 전체 성공으로 승격하지 않음 |

위 수치는 당시 [구현 기록](plans/0219-srt-windows-preflight.md)의 실행 결과다. 연구 디렉터리로 옮긴 후의 재현 명령·의존성·파일 무결성은 [실험 패키지](experiment/package.json)와 [manifest](archive-manifest.json)를 따른다.

시험 스크립트를 보존했다는 사실은 자동 실행·재설치 승인이나 제품 지원 약속이 아니다. 같은 실험을 다시 수행하더라도 새 버전·새 환경의 결과를 별도 기록하고 기존 두 JSON을 덮어쓰지 않는다.

### 이관 후 확인 (2026-09-08)

| 확인 | 결과 | 증거 |
|---|---|---|
| 원본 시험 소스·fixture·native 소스 | 13개 모두 바이트·SHA-256 일치 | [manifest](archive-manifest.json) |
| 당시 생성물 | 79개를 압축 내부 항목별로 원본과 대조, 전부 일치 | [생성물 압축](evidence/windows-generated-artifacts.zip) |
| 연구 패키지 의존성 복원 | `npm ci --ignore-scripts --offline --no-audit --no-fund` exit 0, 잠긴 패키지 5개 복원 | 앱 설치 hook·SRT OS 설치·네트워크 사용 없음 |
| 연구 폴더의 Node suite | 46/46, skip 0 | [이번 실행 TAP](evidence/archive-tests.tap) |
| 보존 바이너리의 native 전달 | 6/6, skip 0 | [이번 native TAP](evidence/archive-native-tests.tap) |
| 앱 정리 | `app/`의 tracked 변경은 SRT 도입 전 `a52e0d1e`와 차이 없음 | 실험 코드·의존성·명령·ignore 항목 제거 |

일반 도구 격리 안에서는 npm 캐시 접근이 `EPERM`으로 막혀, 같은 오프라인 복원을 도구 격리 밖의 일반 사용자 실행으로 확인했다.
Node suite도 CIM 조회를 위해 도구 격리 밖에서 실행했으며 관리자 UAC나 실제 SRT 격리 실행은 사용하지 않았다.
native 시험은 보존 바이너리를 압축에서 풀어 검사했고 재빌드하지 않았다. 최종 SRT smoke·diagnose JSON은 이전 실측 그대로 보존했다.

## 10. 보류 후 재검토 기준

재개는 사용자의 새 지시가 있을 때 판단한다. 다음 조건을 확인하기 전에는 보존된 0220 초안을 READY 또는 구현 승인으로 취급하지 않는다.

1. 공식 Windows SRT에서 호출자 stdin과 대상 stdin의 지속 연결·EOF·동시 stdout/stderr 전달을 지원하고, 고정 source·binary로 재현할 수 있다.
2. bootstrap frame과 후속 입력의 같은 write/분할 write, 열린 stdin 상태의 대상 종료, 출력 압력·취소를 실제 Windows에서 통과한다.
3. 동일 경로 deny 중복 의미가 확인되고, 허용·거부 파일과 proxy·직접 연결·자손 identity·ACL 정리를 다시 검사한다.
4. 현재 Claude와 도구·플러그인의 종단 호환성, 지속 이력·worktree·다운로드 전달까지 검증할 수 있다.
5. 공유 SID·ambient ACL·기업망·설치 잔존 및 배포 책임을 실제 지원 범위로 명시한다.

공식 수정 버전의 지원을 확인하는 것과 Orca 통합 완료는 별도 단계다. OpenCode·cowork 역시 공통 실행 포트와 연결할 수 있다는 설계 가능성만 검토했으며, 호환 실증은 남아 있다.
