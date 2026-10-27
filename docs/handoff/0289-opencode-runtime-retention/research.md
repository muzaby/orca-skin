# 0289 조사 증거 — 2026-10-27

## 판정

재현됨: 준비 중 관측 owner를 해제하면 저장 세션 조회는 `ComposerCatalogCancelled`, 초안 조회는 일반 목록 오류로 reject한다. 타 PC에서 owner가 해제된 실제 사건과 spawn 2회의 각각의 원인은 이번 조사로 확정하지 않았다.

| 증거 | 관측 | 한계 |
|---|---|---|
| 사용자 실측 | 전송 경로 재기동 없음, 두 번째 send는 보유 lease 사용, 전체 spawn 2회·terminate 호출 | 원본 시간선·CLI 버전·실행 설정 없음. n=1, 왕복 ±3초 |
| 현재 코드 | `server.ts:acquire` hit는 start 생략. `channel.ts:pushTurn`은 connect 재호출 없음 | 실제 화면 전환 타이밍의 spawn 수를 뜻하지 않음 |
| 임시 IPC probe | 초안/세션 각각 pending prepare→active:false→늦은 완료. 두 오류 형식과 release 1회 확인 | OS 프로세스·실제 CLI·렌더러를 실행하지 않은 결정적 경합 재현 |
| 기존 prepared unit | `keeps observed preparations alive and rejects retired completions` 포함 | 예외가 IPC·UI에서 어떻게 보이는지는 기존 시험이 잠그지 않음 |

실행: `cd app; ./node_modules/.bin/vitest run src/main/app/handlers/0289-cancel.probe.test.ts src/main/app/prepared-mcp-resources.test.ts --maxWorkers=1` → 2 files, 4 tests passed, 2026-10-27 16:32:32 로컬, 1.99s. probe는 아래 원문으로 재생성할 수 있으며 이번 산출에는 앱 변경으로 남기지 않는다.

첫 probe는 `observe`를 IPC 밖에서 호출하여 속성 순서가 다른 request를 넣었고 초안 case가 timeout했다. 실제 등록 경로를 지나도록 수정한 뒤 위 결과를 얻었다. 이 과정은 `JSON.stringify(request)` 동등성의 속성 순서 의존도 보여 주며, plan은 필드 순서를 고정한 scope key를 요구한다.

## 현재 코드와 사용자 가설 대조

| 대상 | 판정 / 근거 |
|---|---|
| A 구독 수명 | 확인: `composerCatalogState.ts:subscribe/dispose`는 마지막 listener 뒤 0ms timer로 release. `ComposerCatalogOwners.release`는 controller abort 후 lease release |
| B 서버만 TTL | 불충분: `OpenCodeInstances.release`는 scope abort/dispose, `OpenCodeSessionContexts.acquire`의 finish는 context 삭제/close. 서버가 살아도 cache·instance는 소멸 |
| C draft 승격 | 부분 확인: renderer scope에는 sessionId가 있어 새 State 발생. 그러나 `OpenCodeComposerCache.models`가 살아 있으면 새 IPC가 반드시 새 `/provider` HTTP를 뜻하지 않음 |
| C live MCP | 확인: `channel.ts:nativeResources`는 `openCodeNativeMcp` 직접 호출. `mcp-control.ts:apply`도 직접 조회. 슬롯 loader의 함수 참조까지 포함해 조사해야 함 |
| D owner 중복 | 확인: `handlers/composer-catalog.ts:18`, `prepared-mcp-resources.ts:43`에서 별도 `ComposerCatalogOwners` 생성. bootstrap은 같은 prepare 함수를 양쪽에 연결 |
| E 디스크 | 확인: global/configured/plugin installation 조회는 readFile·조상 stat·realpath·package metadata를 반복. McpStore 자체에는 이미 파일 캐시 존재 |
| revision bump | 정정: `managed-source.ts:refresh`는 SHA256 fingerprint가 같으면 return. skill/deploy 호출 자체가 항상 managed revision을 올리지는 않음 |
| 브릿지 | 확인: 같은 revision의 live lease끼리 endpoint 공유. 마지막 release는 generation 삭제/close, 이후 같은 revision acquire도 새 port/token |
| MCP status | 초기 접근은 연결을 유발할 수 있음. 매 warm status가 반드시 재연결한다는 뜻은 아님 |
| watcher 재사용 | 부분만 가능: global watcher fingerprint는 현재 plugin entries만, project policy는 cwd·.opencode의 네 파일만. 조상·명시 config·설치 metadata 전체를 덮지 않음 |
| nav 토글 | 경로 구분 필요: 관리 MCP는 `mcpUpdate→deployExtensions`; OpenCode native 전역 선택은 `extensionSetEnabled→control.setGlobal`, 현재 살아 있는 directory에는 적용하지 않음 |

## 외부 근거

설치 SDK `@opencode-ai/sdk@1.18.27`의 `dist/v2/gen/sdk.gen.js`는 legacy `/mcp`, `/mcp/{name}/connect`, `/mcp/{name}/disconnect`를 호출한다. `/v2/client`와 서버 V2 `/api/...`를 혼용하지 않는다.

[OpenCode v1.18.27 MCP 구현](https://raw.githubusercontent.com/anomalyco/opencode/v1.18.27/packages/opencode/src/mcp/index.ts)의 `state` 초기화는 활성 설정의 client를 만들며 `status`가 그 state를 읽는다. `connect`는 정의에 `enabled:true`를 덮어 적용하고 `disconnect`는 client를 닫는다. 반환 성공만으로 connected를 확정하지 말고 상태를 확인해야 한다. 실제 사용자 CLI의 버전 동등성은 별도 실기 조건이다.

## 재현 probe 원문

아래를 `app/src/main/app/handlers/0289-cancel.probe.test.ts`에 임시 저장해 위 명령을 실행한다. 재현은 현재 결함을 **기대하는** 시험이며 수정 구현의 green gate로 사용하지 않는다.

```ts
import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { ComposerCatalogLease } from '../../../shared/composer-catalog'
const callbacks = vi.hoisted(() => new Map<string, (event: unknown, request: unknown) => Promise<unknown>>())
vi.mock('electron', () => ({ shell: {}, ipcMain: { handle: (name: string, fn: (event: unknown, request: unknown) => Promise<unknown>) => callbacks.set(name, fn) } }))
import { PreparedMcpResources } from '../prepared-mcp-resources'
import { registerSessionResourceHandlers } from './session-resources'

it.each(['draft', 'session'] as const)('reproduces cancelled %s discovery through the real handler', async (kind) => {
  let entered!: () => void
  const started = new Promise<void>((resolve) => { entered = resolve })
  let complete!: (lease: ComposerCatalogLease) => void
  const prepared = new PreparedMcpResources({
    scope: () => ({ backend: 'opencode', sessionId: null, cwd: 'C:/probe', projectId: null, providerKey: null, agentKind: 'code' }),
    prepare: () => { entered(); return new Promise((resolve) => { complete = resolve }) }
  })
  const sync = { observe: vi.fn(), release: vi.fn(), releasePrefix: vi.fn(), retry: vi.fn(), decorate: (_: unknown, value: unknown) => value }
  registerSessionResourceHandlers(() => undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, sync as never, prepared)
  const sender = Object.assign(new EventEmitter(), { id: 289, isDestroyed: () => false, send: vi.fn() })
  const request = kind === 'draft' ? { backend: 'opencode', cwd: 'C:/probe', projectId: null, providerKey: null, agentKind: 'code' } : { sessionId: 'saved' }
  await callbacks.get(CHANNELS.sessionNativeResources)!({ sender }, { ...request, observation: { owner: 'probe', active: true } })
  const pending = callbacks.get(CHANNELS.sessionNativeResources)!({ sender }, request)
  const outcome = pending.catch((error: Error) => error)
  await started
  await callbacks.get(CHANNELS.sessionNativeResources)!({ sender }, { ...request, observation: { owner: 'probe', active: false } })
  const release = vi.fn(async () => {})
  complete({ generation: 'old', signal: new AbortController().signal, release, read: vi.fn() })
  const error = await outcome as Error
  expect(error).toBeInstanceOf(Error)
  if (kind === 'draft') expect(error.message).toBe('하네스 목록을 불러오지 못했습니다. 다시 시도해 주세요.')
  else expect(error.constructor.name).toBe('ComposerCatalogCancelled')
  expect(release).toHaveBeenCalledTimes(1)
  prepared.close()
})
```

## 조사 경계

앱 코드 변경·상시 진단 로그 추가·실제 부팅·모델 전송은 이번 설계 턴에서 수행하지 않았다. 실제 spawn/teardown와 첫 조회 시간선은 plan의 O10/H1로 남긴다. 0288은 독립 verify를 수행한 것으로 표시하지 않는다.

## 자리 검색 실행 기록

[강제 지점의 Q1~Q6](enforcement.md#자리-검색)을 현재 소스에서 실행했다. hit는 후보 행 수이며 의미 자리 수가 아니다.

| 검색 | hit 행 | 파일 |
|---|---:|---:|
| Q1 소유 수명 | 429 | 53 |
| Q2 준비/관측/승격 — ts·tsx 포함 | 1055 | 81 |
| Q3 MCP/제출/활동 | 124 | 32 |
| Q4 revision | 112 | 20 |
| Q5 디스크/감시 | 115 | 32 |
| Q6 부팅/gate | 136 | 21 |

현재 자리 표의 기존 소스 경로는 중복 제거 36개이며 전부 존재했다. 신규 service 경로는 구현 예정으로 표기했다. 선언·공통 타입·기존 전달 wrapper·다른 하네스·관련 없는 sessionId 소비를 실행 자리와 구분하고, 필요 계약의 분모는 A~I의 90개 ID로 고정했다.
