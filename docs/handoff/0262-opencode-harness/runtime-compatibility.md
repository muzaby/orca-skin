# OpenCode 실행 패키지·호환성 실측

2026-10-14 KST. 호스트 CLI 업데이트 이후 확인한 결과이며, 배포 정책 승인을 대신하지 않는다.

| 대상 | 관측 | 의미 |
|---|---|---|
| 설치된 `@opencode-ai/sdk@1.18.27` | package dependencies는 `cross-spawn`; `dist/server.js`가 PATH의 `opencode`를 실행 | CLI 실행 파일을 포함하지 않는다 |
| `opencode-ai@1.18.27` | npm optionalDependencies에 같은 버전의 플랫폼별 CLI 패키지 | SDK와 별도로 고정 버전 CLI 동봉 가능 |
| `@opencode/cli@2.0.28` | 플랫폼별 `@opencode/cli-*` optionalDependencies | 호스트의 최신 CLI 패키지 계열 |
| `@opencode/sdk@2.0.28` | core/server/client/plugin/schema 의존성 | 새 임베디드 SDK. 기존 클라이언트 패키지의 버전만 바꾸는 작업과 다르다 |

최신 [공식 임베디드 SDK 문서](https://dev.opencode.ai/v2/docs/build/sdk/)는 `OpenCode.create()`로 서버를 내부 실행하고 HTTP listener 없이 라우팅한다고 설명한다. Electron·Windows에서 이 패키지의 실제 실행 호환성은 아직 검증하지 않았다. CLI 동봉 방식과 임베디드 SDK 방식은 별도 선택이다.

## 실제 프로세스 검증

사용자 OpenCode 앱이나 세션에 연결하지 않았다. Orca 서버 관리 코드가 loopback 임의 포트에 만든 child와 별도 XDG 데이터만 사용하고 finally에서 종료했다.

| 실행 파일 | 호출 경로 | 결과 |
|---|---|---|
| 호스트 `@opencode/cli`의 `opencode.exe` | `--version` → `serve` → `/global/health` | `opencode v2.0.28`; legacy health 경로가 HTML을 반환해 비호환 확인 |
| 공식 npm `opencode-windows-x64@1.18.27`의 실행 파일 | 같은 Orca server pool → SDK catalog | `1.18.27`; loopback health 성공, 모델 목록과 `build`·`plan` 조회 성공 |
| 같은 1.18.27 실행 파일 | 실제 `OpenCodeAdapter.sendMessage` → 로컬 OpenAI 호환 응답 fixture | `session.updated → input.echo → message.delta → message.completed → telemetry → turn.ended`; 오류 없음 |
| 사용자가 되돌린 호스트 실행 파일 | `opencode --version` → 새 격리 데이터 → 같은 health/catalog/실제 도구 fixture | `1.19.0`; 모델·에이전트 조회, `read` 도구, 텍스트, telemetry, turn 종료 성공 |

로컬 fixture는 별도 Node HTTP 서버이며 합성 응답만 돌려준다. 실제 모델 API·사용자 인증·과금 요청은 사용하지 않았다. CLI 내부 제목 생성도 같은 로컬 모델로 향했다.

비호환 health 응답은 JSON 파싱 예외 대신 CLI·SDK API 불일치 안내를 반환하도록 수정했다. HTML 응답 후 owned child 종료를 `opencode-server.test.ts`가 직접 단언한다.

도구 fixture는 임시 `fixture.txt`만 읽었다. `tool.call.started`의 `toolName=Read`, `providerTool.name=read`와 `tool.call.completed`를 확인했다. 1.18.27·1.19.0 모두 동일 결과이며 외부 모델 요청은 없었다.

## 현재 배포 방식

사용자는 동봉 질문에 호스트 CLI를 **1.19.0으로 되돌렸음**을 답했다. 기존 승인 설계대로 호스트 CLI를 Orca가 자동 관리하며 신규 패키지·동봉 정책은 도입하지 않는다. package.json·lockfile·electron-builder는 변경하지 않았다.

2.x CLI와 새 임베디드 SDK는 이번 지원 범위가 아니다. 사용자가 나중에 선택하면 API·실행 격리·lifecycle·배포 검증을 포함해 설계를 갱신해야 한다. 2.x로 생성된 임시 데이터로 1.x를 실행하면 서버가 시작 중 종료되어, 버전 호환성 검증은 새 데이터 디렉터리에서 수행했다.
