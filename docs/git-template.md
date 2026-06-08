# 커밋 trailer 가이드

Claude Code(설계·검증)와 Codex(구현)는 **분리된 환경에서 git 커밋을 메시지 버스로** 통신한다. 커밋 메시지의 **trailer(`Key: value`)** 가 기계로 파싱 가능한 통신 신호다. 이 문서가 형식의 상세 정본이고, 규칙 요약은 [`../AGENTS.md`](../AGENTS.md) "커밋 프로토콜" 에 있다.

> **강제 장치 없음 (관례).** `.gitmessage` 템플릿도 CI/훅도 두지 않는다. 두 에이전트가 이 형식을 *읽고 따른다* 에 의존한다. 에이전트는 보통 `git commit -m`/`-F` 로 커밋하므로, **trailer 블록을 커밋 메시지에 직접 포함**한다.

## 형식

```
<type>(<scope>): <요약>

<본문 — 무엇을·왜. 어떻게는 코드가 말한다.>

<Key>: <value>
<Key>: <value>
```

- 제목 `type` = `feat | fix | refactor | docs | test | chore`, `scope` = 모듈/기능명(예: `handoff`, `chat`, `db`).
- trailer 는 **본문과 빈 줄로 분리된 마지막 문단**에 모은다. `Key: value` (콜론+공백) 를 엄수해야 `git interpret-trailers` 가 파싱한다.
- **안 쓰는 키는 줄 자체를 넣지 않는다** (빈 값 금지).

## 필드 표

| Key | 의미 | 허용값 | 작성 주체 |
|---|---|---|---|
| `Agent` | 커밋 작성 에이전트 | `codex` \| `claude` | 둘 다 |
| `Handoff` | 연관 hand-off 작업 디렉토리 | `docs/handoff/<NNNN-slug>/` \| `none` | 둘 다 |
| `Status` | 작업 상태 | `implemented` \| `partial` \| `blocked` \| `verified` | 둘 다 |
| `Criteria-Met` | 충족 인수 기준 수 | `<충족>/<전체>` (예 `3/5`) | **구현 커밋만** |
| `Criteria-Pending` | 미충족 기준 목록 | 자유 텍스트(기준 번호·요약) | **구현 커밋만** |
| `Verified-By` | 검증 결과 | `pending` \| `claude:pass` \| `claude:fail` | 구현=`pending`, 검증=결과 |
| `Next-Action` | 다음 차례 주체 | `codex` \| `claude` \| `none` | **검증 커밋만** |
| `Refs` | 연관 이슈 | `#<이슈번호>` | 둘 다(선택) |

> `<NNNN-slug>`, `#<이슈번호>` 등 프로젝트 고유값은 실제 값으로 채운다. 모르면 임의로 채우지 말고 비워둘 키는 줄을 생략한다.

## 에이전트별 작성 규칙

- **구현 커밋 (Codex)**: `Agent: codex` · `Status: implemented|partial|blocked` · `Criteria-Met` · (미충족 있으면) `Criteria-Pending` · `Verified-By: pending`. `Next-Action` 은 넣지 않는다.
- **검증 커밋 (Claude)**: `Agent: claude` · `Status: verified` · `Verified-By: claude:pass|claude:fail` · `Next-Action: codex|claude|none`. `Criteria-*` 는 넣지 않는다.
- **공통**: `Handoff`, `Refs`(선택).

이 분리로 파싱 측이 "구현 커밋인지 검증 커밋인지" 와 "다음에 누가 움직여야 하는지" 를 키 존재 여부 + 값으로 판별한다.

## 예시

### 구현 커밋 (Codex)

```
feat(chat): 스트리밍 reasoning 파트 영속화

NormalizedEvent 의 reasoning 델타를 AppMessagePart 로 저장해
재진입 시 확장사고가 복원되도록 한다.

Agent: codex
Handoff: docs/handoff/0007-reasoning-persistence/
Status: implemented
Criteria-Met: 4/5
Criteria-Pending: #5 멀티세션 동시 스트림 경합 테스트
Verified-By: pending
Refs: #<이슈번호>
```

### 검증 커밋 (Claude)

```
docs(handoff): 0007-reasoning-persistence 검증 (FAIL r1)

Agent: claude
Handoff: docs/handoff/0007-reasoning-persistence/
Status: verified
Verified-By: claude:fail
Next-Action: codex
Refs: #<이슈번호>
```

## 파싱 명령

```sh
# 최근 커밋의 trailer 를 키/값으로 추출
git log -1 --format=%B | git interpret-trailers --parse

# 커밋별 상태·검증 결과 한눈에
git log --format='%H %(trailers:key=Status,valueonly) %(trailers:key=Verified-By,valueonly)'

# 아직 검증 안 된 구현 커밋 찾기 (Verified-By 가 pending)
git log --format='%H %(trailers:key=Verified-By,valueonly)' | grep ' pending$'

# 다음 차례가 codex 인 검증 커밋 찾기
git log --format='%H %(trailers:key=Next-Action,valueonly)' | grep ' codex$'
```

## 캐비엇

- **강제 아님.** 위 "강제 장치 없음" 참조 — 형식은 규칙 준수에 의존한다.
- **세션 URL trailer.** 일부 하니스가 Claude 커밋 끝에 `https://claude.ai/code/session_…` 를 자동으로 붙인다. 이는 `Key: value` 형식이 아니므로 위 8키 파싱 대상이 아니다(같은 블록에 정보용으로 공존). 파싱은 정의된 8키만 대상으로 한다.
