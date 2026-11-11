// check-product-naming.mjs 단위 테스트 (0306 EP-01 — 규칙 7분기, ⑥은 ΔV1 E1).
// 옛 표기는 리터럴로 적지 않는다 — 이 파일도 검사 범위다. `FORMS` 에서 가져와 입력을 만든다.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  ALLOWED,
  EXCLUDED,
  FORMS,
  findOld,
  inScope,
  pathShapes,
  scan
} from './check-product-naming.mjs'

const { lower, title, upper } = FORMS
const SCOPED = 'app/src/main/x.ts'
const run = (files, allowed = []) => scan(files, allowed).violations

describe('① 옛 표기는 위반이다', () => {
  for (const [name, text] of [
    ['식별자 안의 lower', `const ${lower}Value = 1`],
    ['식별자 안의 title', `type ${title}Api = {}`],
    ['상수 안의 upper', `process.env.${upper}_X`],
    ['홀로 선 단어', `// ${title} 가 관리한다`],
    ['채널 접두사', `'${lower}:chat:send'`]
  ]) {
    test(name, () => {
      const violations = run([{ path: SCOPED, text }])
      assert.equal(violations.length, 1)
      assert.match(violations[0], /^app\/src\/main\/x\.ts:1: /)
    })
  }

  test('한 줄에 둘이면 둘 다 센다', () => {
    assert.equal(findOld(`${lower} ${title}`).length, 2)
  })
})

describe('② 새 표기 다섯 꼴은 위반이 아니다', () => {
  for (const shape of [
    `orcinus-${lower}`,
    `orcinus_${lower}`,
    `Orcinus ${lower}`,
    `Orcinus${title}`,
    `ORCINUS_${upper}`
  ]) {
    test(shape, () => assert.deepEqual(run([{ path: SCOPED, text: `x ${shape} y` }]), []))
  }

  test('새 표기 옆에 옛 표기가 따로 있으면 그것만 센다', () => {
    const hits = findOld(`orcinus-${lower} 와 ${lower}Dir`)
    assert.equal(hits.length, 1)
    assert.equal(hits[0].form, 'lower')
  })
})

describe('③ 저장소 이름은 위반이 아니다', () => {
  test(`${lower}-skin`, () => {
    assert.deepEqual(run([{ path: SCOPED, text: `github.com/x/${lower}-skin` }]), [])
  })
})

describe('④⑤ 허용 목록은 개수를 양방향으로 대조한다', () => {
  const allowed = [{ file: SCOPED, form: 'lower', count: 1, reason: 't' }]

  test('등록 1 · 실제 1 → 통과', () => {
    assert.deepEqual(run([{ path: SCOPED, text: `'${lower}'` }], allowed), [])
  })

  test('등록 1 · 실제 2 → 위반', () => {
    const violations = run([{ path: SCOPED, text: `'${lower}' '${lower}'` }], allowed)
    assert.equal(violations.length, 1)
    assert.match(violations[0], /등록 1 · 실제 2/)
  })

  test('등록 2 · 실제 1 → 위반 (지운 예외는 목록에서도 지운다)', () => {
    const violations = run([{ path: SCOPED, text: `'${lower}'` }], [{ ...allowed[0], count: 2 }])
    assert.match(violations[0], /등록 2 · 실제 1/)
  })

  test('등록한 파일이 목록에 없어도 위반', () => {
    assert.match(run([], allowed)[0], /등록 1 · 실제 0/)
  })

  test('허용은 꼴마다 따로다 — lower 를 등록해도 title 은 위반', () => {
    const violations = run([{ path: SCOPED, text: `'${lower}' ${title}` }], allowed)
    assert.equal(violations.length, 1)
    assert.match(violations[0], /옛 표기\(title\)/)
  })
})

describe('⑥ 제외 목록 밖의 추적 파일은 전부 읽는다', () => {
  const old = `${lower} ${title} ${upper}`
  // 제외 항목마다 그 아래 경로 하나 — 항목을 지우면 그 입력이 위반이 된다.
  const excludedPaths = [
    'docs/handoff/0001-x/plan.md',
    'docs/archive/a.md',
    'docs/decisions/adr.md',
    'docs/etc/b.md',
    'chats/chat1.md',
    'project/index.html',
    'README.md',
    '.agents/skills/handoff-review/references/corpus.md'
  ]

  test('입력은 제외 항목과 1:1 이다', () => {
    assert.equal(excludedPaths.length, EXCLUDED.length)
    for (const entry of EXCLUDED) {
      const rest = EXCLUDED.filter((other) => other !== entry)
      assert.equal(excludedPaths.filter((path) => inScope(path, rest)).length, 1, entry)
    }
  })

  for (const path of excludedPaths) {
    test(`제외: ${path}`, () => {
      assert.equal(inScope(path), false)
      assert.deepEqual(run([{ path, text: old }]), [])
    })
  }

  // 어떤 목록에도 적힌 적 없는 경로 — 등록 없이 검사된다.
  for (const path of ['tools/x.md', 'x.txt', 'docs/spec/v/INDEX.md', 'app/.gitignore']) {
    test(`검사: ${path}`, () => {
      assert.equal(inScope(path), true)
      assert.equal(run([{ path, text: old }]).length, 3)
    })
  }

  test('제외 항목과 이름만 비슷한 경로는 검사한다', () => {
    for (const path of [
      'app/README.md',
      'docs/handoff.md',
      '.agents/skills/handoff-review/SKILL.md',
      '.agents/skills/a/b/references/c.md'
    ])
      assert.equal(inScope(path), true, path)
  })

  test('바이너리는 건너뛴다', () => {
    assert.deepEqual(run([{ path: SCOPED, text: `\0${lower}` }]), [])
  })
})

describe('⑦ 범위 밖 추적 파일을 가리키는 경로는 그 파일의 실제 이름을 쓴다', () => {
  const guide = `docs/etc/study/opencode/${lower}-migration-guide.md`
  const folder = `docs/etc/study/${lower}/README.md`
  const tracked = [guide, folder, `docs/handoff/0009-${lower}-config/plan.md`, SCOPED]
  const check = (text) => scan([{ path: 'docs/TRD.md', text }], [], EXCLUDED, tracked).violations

  test('실재하는 범위 밖 파일 링크 → 통과', () => {
    assert.deepEqual(check(`[연구](etc/study/opencode/${lower}-migration-guide.md)`), [])
    assert.deepEqual(check(`handoff \`0009-${lower}-config\``), [])
  })

  test('옛 이름 그 자체인 폴더는 부모와 함께 적혀야 통과', () => {
    assert.deepEqual(check(`\`etc/study/${lower}/\` 는 폐기됐다`), [])
    assert.equal(check(`\`${lower}/\` 폴더`).length, 1)
  })

  test('파일이 없어지면 같은 링크가 위반이 된다', () => {
    const text = `[연구](etc/study/opencode/${lower}-migration-guide.md)`
    assert.equal(scan([{ path: 'docs/TRD.md', text }], [], EXCLUDED, [folder]).violations.length, 1)
  })

  test('경로 옆의 옛 표기는 그대로 위반', () => {
    assert.equal(check(`${title} 연구는 etc/study/opencode/${lower}-migration-guide.md`).length, 1)
  })

  test('범위 안 파일 이름은 조각을 만들지 않는다 — 범위 안 파일은 이름을 바꾼다', () => {
    assert.deepEqual(pathShapes([`app/src/main/${lower}-file.ts`]), [])
  })
})

describe('허용 목록의 파일 집합은 고정이다 (0306 AC4)', () => {
  // 옛 이름을 읽는 새 분기가 생기면 이 집합이 늘어난다 — 늘리려면 이 테스트도 고쳐야 한다.
  test('이관 입력 6 + 마이그레이션 SQL 1 + 지난 증거 스크립트의 입력 1 + 과거 이름을 서술하는 문서 4', () => {
    assert.deepEqual([...new Set(ALLOWED.map((entry) => entry.file))].sort(), [
      'app/scripts/test-spawn-trace.test.mjs',
      'app/src/main/app/legacy-paths.test.ts',
      'app/src/main/infra/config/migrate-legacy.test.ts',
      'app/src/main/infra/config/migrate-legacy.ts',
      'app/src/main/infra/config/rebase-path.test.ts',
      'app/src/main/infra/config/rebase-path.ts',
      'app/src/main/infra/db/migrations/0032_native_session_recovery.sql',
      'app/src/shared/product.ts',
      'docs/arch/backend/overview.md',
      'docs/arch/backend/provider-runtime.md',
      'docs/arch/backend/security.md',
      'docs/guides/release-operations.md'
    ])
  })

  test('모든 항목이 범위 안이고 사유를 갖는다', () => {
    for (const entry of ALLOWED) {
      assert.equal(inScope(entry.file), true, entry.file)
      assert.ok(entry.reason.length > 0)
      assert.ok(entry.count > 0)
    }
  })
})
