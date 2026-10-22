# 0279 구현 검증 — r1

2026-10-22, Windows, `codex-harness-entry-menu`. 구현자의 자기검증이며 독립 verify가 아니다.

| 검사 | 관측 |
|---|---|
| 관련 Vitest | 최종 실행 21파일 240케이스 통과 |
| 타입 | `npm run build`의 node/web/test 모두 통과. 마지막 테스트 보강 뒤 `npm run typecheck:test`도 통과 |
| 빌드 | main/preload/renderer 생성 성공. 기존 SubAgentTaskDetail 동적/정적 import 혼용 경고 |
| lint | 전체 eslint 오류 0·기존 React Compiler 경고 2. 마지막 변경 테스트 파일 별도 eslint 오류/경고 0 |
| 선택 변이 | bootstrap observer policy를 undefined로 바꾸면 외부 설정 통지 테스트 1건 실패(통지 0회). 원본 bytes 복원 뒤 최종 실행 green |
| 문서 | inventory·prose 통과. 전체 링크 검사 실패 10건은 `.tmp/opencode-dev`와 `app/.temp/opencode` 참조 checkout 내부 링크. 변경 문서는 별도 대조 |
| diff | `git diff --check` 통과 |
| 실제 SDK | MCP 출처별 toggle/저장/새 Query 복원과 Windows settings 위치는 [격리 SDK 관측](mcp-storage.md) 참조 |

최종 테스트는 app 디렉터리에서 다음 파일을 `vitest run --maxWorkers=2`에 전달했다.

```text
src/main/adapters/claude/project-settings.test.ts
src/main/adapters/claude/project-reconciliation.test.ts
src/main/adapters/claude/plugin-state.test.ts
src/main/adapters/claude/plugin-catalog.test.ts
src/main/adapters/claude/configured-resources.test.ts
src/main/adapters/claude/native-resources.test.ts
src/main/adapters/claude/adapter.native-plugins.test.ts
src/main/adapters/claude/native-paths.test.ts
src/main/app/project-resource-sync.test.ts
src/main/app/bootstrap.native-history.test.ts
src/main/app/bootstrap.shutdown.test.ts
src/main/app/bootstrap.artifacts.test.ts
src/main/app/native-resource-sharing.test.ts
src/main/app/handlers/session-resources.test.ts
src/main/features/sessions/session-runtime.test.ts
src/preload/index.test.ts
src/shared/protocol.harness.test.ts
src/renderer/src/features/chat/hooks/useNativeResources.test.ts
src/renderer/src/features/chat/lib/nativeResourceState.composer.test.ts
src/renderer/src/features/chat/components/ChatTitleBar.native-resources.test.ts
src/renderer/src/features/skills/hooks/useNativeMcpCatalog.test.ts
```

기존 renderer 상태 테스트의 브라우저 없는 소비 경로에서 관측 IPC가 호출되는 실패를 수정한 뒤 해당 회귀와 전체 목록을 재실행했다. lint 자동 수정이 기존 `native-history.test.ts`와 `chat-turn.execution-config.test.ts`의 서식을 정리했으며 실행 로직 변경은 없다.

제품 동작은 외부 파일 변경 후 선택값을 발행하고, 같은 작업경로의 모든 실행이 유휴일 때 SDK를 적용한다. MCP 정의·승인·MCP를 가진 plugin은 기존 자원 회수 이후 새 실행까지 대기하며 서버를 강제로 시작/재시작하지 않는다. 실제 사용자 설치본의 UI와 원격 테스트 환경은 이 턴에서 실행하지 않았다. OpenCode 전역 격리·nav 프로젝트 범위 선택은 0277/0278의 별도 작업이다.
