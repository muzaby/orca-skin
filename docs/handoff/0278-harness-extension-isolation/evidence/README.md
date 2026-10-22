# 정책 격리 검증 재현

저장소 루트에서 실행한다. `work/test-temp`가 없으면 먼저 만든다.

```powershell
New-Item -ItemType Directory -Force work/test-temp | Out-Null
./app/node_modules/.bin/vitest run --config docs/handoff/0278-harness-extension-isolation/evidence/verification.config.mts
node docs/handoff/0278-harness-extension-isolation/evidence/claude-cwd-probe.mjs
```

- 첫 명령은 설치 SDK HTTP transport를 사용한 OpenCode 격리 검증과 실제 Claude reader/reconcile 반례를 실행한다. `6bf1ee40` 당시 결과는 **1통과·1실패**이며 과거 정책의 실패 증거로 보존한다. D32 이후의 기대는 Claude reader/reconcile 반례 통과와 OpenCode 직접 제어의 지원 불가 거부다. 따라서 이 역사적 파일 전체의 green을 현재 gate로 요구하지 않는다. 현재 거부 계약은 `app/src/main/adapters/opencode/v1/{adapter,session-context,project-settings}.test.ts`에서 검증한다.
- 두 번째 명령은 임시 Git 저장소·격리 config/home·로컬 stdio MCP·입력 없는 SDK Query를 사용한다. 실제 사용자 설정과 외부 LLM은 사용하지 않는다. A의 connected→disabled, 저장 키 A Git root, 첫 B disabled를 출력한다. 임시 생성물은 `work/test-temp/verify-claude-cwd-*`에 남는다.
- 기존 정책 회귀는 24파일 226테스트, CI 보완 대상은 별도 4파일 40테스트가 통과했다. 반례를 추가한 검증 결과는 [verify.md](../verify.md)에 기록한다.
