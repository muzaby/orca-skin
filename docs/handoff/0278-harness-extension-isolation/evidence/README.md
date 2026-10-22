# 정책 격리 검증 재현

저장소 루트에서 실행한다. `work/test-temp`가 없으면 먼저 만든다.

```powershell
New-Item -ItemType Directory -Force work/test-temp | Out-Null
./app/node_modules/.bin/vitest run --config docs/handoff/0278-harness-extension-isolation/evidence/verification.config.mts
node docs/handoff/0278-harness-extension-isolation/evidence/claude-cwd-probe.mjs
```

- 첫 명령은 설치 SDK HTTP transport를 사용한 OpenCode 격리 검증과 실제 Claude reader/reconcile 반례를 실행한다. `6bf1ee40` 기준 **1통과·1실패**다. Claude 실패를 통과로 바꾸는 테스트가 아니라 미충족 정책을 보존한 증거다.
- 두 번째 명령은 임시 Git 저장소·격리 config/home·로컬 stdio MCP·입력 없는 SDK Query를 사용한다. 실제 사용자 설정과 외부 LLM은 사용하지 않는다. A의 connected→disabled, 저장 키 A Git root, 첫 B disabled를 출력한다. 임시 생성물은 `work/test-temp/verify-claude-cwd-*`에 남는다.
- 기존 정책 회귀는 24파일 226테스트, CI 보완 대상은 별도 4파일 40테스트가 통과했다. 반례를 추가한 검증 결과는 [verify.md](../verify.md)에 기록한다.
