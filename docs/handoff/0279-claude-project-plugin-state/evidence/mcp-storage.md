# Claude MCP 승인과 실행 활성 상태 관측

2026-10-22, Windows, 저장소에 설치된 Claude Agent SDK 0.3.296와 동봉 native CLI로 확인했다. 프로덕션 코드는 변경하지 않았다.

## 실행 조건

- `work/claude-mcp-storage-probe.mjs` 실행.
- 작업공간 안의 임시 config·home·cwd·temp 사용. 실제 사용자 설정은 읽거나 쓰지 않음.
- 프로젝트 `.mcp.json`에 로컬 stdio fixture MCP 등록. `settings.local.json`에는 `enabledMcpjsonServers: ["fixture"]`와 비대상 permissions fixture 설정.
- SDK prompt는 입력 대기 상태. LLM 호출 없음, 모델 URL도 로컬 폐쇄 포트로 설정.
- MCP fixture는 initialize와 tools/list만 응답. API 키는 테스트용 문자열.

## 관측

| 단계 | 실제 결과 |
|---|---|
| SDK 초기 연결 | fixture / source project / connected |
| `toggleMcpServer('fixture', false)` | status disabled |
| 설정 파일 관측 | settings.local의 승인 목록은 그대로. 격리된 `CLAUDE_CONFIG_DIR/.claude.json`의 `projects[Git root].disabledMcpServers`에 fixture 저장 |
| 기존 Query 종료 후 새 Query 생성 | 승인 목록이 남아 있어도 fixture status disabled |

출력의 초기 파일 snapshot은 cwd로 project entry를 찾았기 때문에 실제 Git root 키를 놓쳤다. 이어서 생성된 fixture config의 MCP 키만 재귀 조회하여 `projects[Git root].disabledMcpServers = ["fixture"]`를 확인했다. 따라서 SDK MCP 저장 범위를 현재 cwd라고 단정하지 않는다.

## 의미와 한계

프로젝트 `.mcp.json` 서버에 한정하면 승인·거부를 설정상의 on/off로 표현할 수 있다. 다만 승인 값만으로 실제 SDK 활성 여부를 판정하면 이 사례에서 on으로 잘못 표시한다. 설정상의 허용 상태와 실행 상태를 별도로 읽어야 한다.

이 probe는 프로젝트 MCP의 SDK toggle 영속화를 입증한다. 플러그인·사용자 전역 MCP 각각에 대한 실측은 포함하지 않았으며, 그 범위 구분은 [Claude 공식 MCP 문서](https://code.claude.com/docs/en/mcp#disable-a-server-without-removing-it)에 근거한다. 실제 사용자 설정·외부 CLI 세션과의 동시 쓰기·파일 감시·Orca 전체 UI 동기화는 검증하지 않았다.

## 후속 관측 — MCP 출처별 SDK 제어

같은 날짜·SDK에서 `work/claude-mcp-controls-probe.mjs`를 실행했다. 별도 config/home/cwd와 로컬 응답용 HTTP 서버를 사용했고 외부 LLM이나 실제 사용자 설정을 사용하지 않았다. 최종 결과는 `work/claude-mcp-controls-3eghSo/result.json`에 남겼다.

Windows 설정 위치 추가 관측: `work/claude-settings-path-probe.mjs`가 임시 Git 저장소의 부모와 child에 서로 다른 enabledPlugins를 기록한 뒤 설치 SDK `resolveSettings({ cwd: child, settingSources: ['project', 'local'] })`를 호출했다. 응답의 project는 `repo/child/.claude/settings.json`과 `child@project`, local은 `repo/child/.claude/settings.local.json`과 `child@local`이었다. 실제 사용자 설정은 편집하지 않았다. native MCP projects의 Git root 키와 settings/local의 cwd 위치를 구분한다.

| 출처 / fixture | 초기 조회 | toggle(false) | toggle(true) |
|---|---|---|---|
| user / user_fixture | connected | disabled | connected |
| project / project_fixture | connected | disabled | connected |
| dynamic / dynamic_fixture | connected | disabled | connected |
| sdk / inprocess_fixture | connected | disabled | connected |
| plugin / .mcp.json의 bundled | connected | disabled | connected |
| plugin / manifest inline_fixture | connected | disabled | connected |

초기 시도에서는 plugin fixture의 실행 명령·인자가 user fixture와 같아 native debug에 `Suppressing plugin MCP server … duplicates manually-configured`가 기록됐고 목록에서 제외됐다. plugin별 구별 인자를 준 후 위 결과를 얻었다. 초기 누락을 plugin MCP 미지원이나 첫 대화 초기화 문제로 판정하지 않는다.

설치 SDK의 `McpServerStatus`에는 status/source/scope가 있지만 canToggle·권한 판정 필드는 없다. 실제 조회에 포함된 일반 MCP들의 토글 성공은 확인했으나 managed/enterprise/claudeai/agent 출처, 원격 인증 및 네트워크 실패 조합은 이 실측 범위 밖이다. Orca의 `native-resources.ts`가 SDK 주입·주입 plugin MCP 제어를 제외하는 것은 현재 제품 구현의 제한이며, 이번 성공 결과로 그 출처 전체를 SDK 미지원이라고 설명하면 안 된다.

SDK 메서드는 Query에 대한 제어다. 전역 설정 기본값 편집, 프로세스 없이 설정 목록 조회, 같은 작업경로의 여러 Query 조정은 별도 제품 책임이다. `setMcpServers`는 동적 등록 집합을 바꾸는 API로, native 설정 파일과 plugin 소유 MCP 전체를 교체하는 API가 아니다.
