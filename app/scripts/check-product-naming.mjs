#!/usr/bin/env node
// 제품 이름 표기 검사기 (handoff 0306 D-007).
//
// 코드와 현재 문서에서 제품을 가리키는 옛 표기가 다시 들어오는 것을 막는다. 규칙은 넷이다
// (0306 plan D-004): 산문 = 표시명, 저장·전송되는 값 = 슬러그 꼴, 코드 식별자·IPC 채널 = 짧은 꼴.
// 이 검사기는 "옛 표기가 없다"만 본다 — 새 꼴이 제자리에 있는지는 `product-identity.test.ts` 가 본다.
//
// 모르는 자리는 막는다(fail-closed). 옛 이름을 일부러 써야 하는 자리(0225 이관의 입력 · 구버전 안내)는
// `ALLOWED` 에 `{file, form, count, reason}` 으로 등록한다. 개수가 늘어도 줄어도 실패한다 — 지운
// 예외는 목록에서도 지워야 한다.
//
// 이 파일은 옛 표기를 리터럴로 갖지 않는다(자기 자신이 검사 범위다) — 조각을 이어 만든다.
import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OLD = ['or', 'ca'].join('')
const NEW_HEAD = 'orcinus'

/** 옛 표기의 세 꼴. 대소문자가 섞인 꼴(`Err` + `orCa` + `rd` 같은 우연)은 주어가 아니다. */
export const FORMS = {
  lower: OLD,
  title: OLD[0].toUpperCase() + OLD.slice(1),
  upper: OLD.toUpperCase()
}

// 허용 꼴 — 새 표기(구분자 `-`·`_`·공백·없음, 대소문자 무관)와 저장소 이름.
const ALLOWED_SHAPES = new RegExp(`${NEW_HEAD}[-_ ]?${OLD}|${OLD}-skin`, 'gi')
const SUBJECT = new RegExp(Object.values(FORMS).join('|'), 'g')
const FORM_OF = Object.fromEntries(Object.entries(FORMS).map(([form, text]) => [text, form]))

/**
 * 검사 제외 목록 — 저장소 루트 기준. 디렉토리는 `/` 로 끝나고 `*` 는 경로 마디 하나다.
 * 지난 기록은 당시 코드·커밋과 맞아야 해서 고치지 않는다(0306 D-003). **이 목록에 없는 추적 파일은
 * 전부 검사한다** — 새 경로는 등록 없이 검사 범위에 든다.
 */
export const EXCLUDED = [
  'docs/handoff/',
  'docs/archive/',
  'docs/decisions/',
  'docs/etc/',
  'chats/',
  'project/',
  'README.md',
  '.agents/skills/*/references/'
]

const LEGACY_INPUT = '0225 이관의 입력 — 옛 디스크 이름 (0306 D-005)'
const LEGACY_FACT = '과거 이름을 사실로 서술 (0306 D-005)'

/** 옛 표기를 일부러 쓰는 자리. `count` 는 그 파일의 그 꼴 개수와 정확히 같아야 한다. */
export const ALLOWED = [
  { file: 'app/src/shared/product.ts', form: 'lower', count: 1, reason: LEGACY_INPUT },
  {
    file: 'app/src/main/infra/config/migrate-legacy.ts',
    form: 'lower',
    count: 2,
    reason: LEGACY_INPUT
  },
  {
    file: 'app/src/main/infra/config/migrate-legacy.test.ts',
    form: 'lower',
    count: 32,
    reason: LEGACY_INPUT
  },
  { file: 'app/src/main/app/legacy-paths.test.ts', form: 'lower', count: 5, reason: LEGACY_INPUT },
  {
    file: 'app/src/main/infra/config/rebase-path.ts',
    form: 'lower',
    count: 2,
    reason: LEGACY_INPUT
  },
  {
    file: 'app/src/main/infra/config/rebase-path.test.ts',
    form: 'lower',
    count: 19,
    reason: LEGACY_INPUT
  },
  {
    file: 'app/src/main/infra/db/migrations/0032_native_session_recovery.sql',
    form: 'title',
    count: 1,
    reason: '머지된 마이그레이션은 수정하지 않는다 (0306 D-006)'
  },
  {
    file: 'app/scripts/test-spawn-trace.test.mjs',
    form: 'upper',
    count: 4,
    reason: '0300 증거 스크립트(범위 밖 지난 기록)가 읽는 환경변수 이름 (0306 D-003)'
  },
  { file: 'docs/guides/release-operations.md', form: 'lower', count: 7, reason: LEGACY_FACT },
  { file: 'docs/guides/release-operations.md', form: 'title', count: 1, reason: LEGACY_FACT },
  { file: 'docs/arch/backend/overview.md', form: 'lower', count: 4, reason: LEGACY_FACT },
  { file: 'docs/arch/backend/security.md', form: 'lower', count: 1, reason: LEGACY_FACT },
  { file: 'docs/arch/backend/provider-runtime.md', form: 'title', count: 1, reason: LEGACY_FACT }
]

function excludes(entry, path) {
  if (!entry.includes('*')) return entry.endsWith('/') ? path.startsWith(entry) : path === entry
  const pattern = entry
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+')
  return new RegExp(`^${pattern}`).test(path)
}

export function inScope(path, excluded = EXCLUDED) {
  return !excluded.some((entry) => excludes(entry, path))
}

/**
 * 범위 밖 추적 파일을 가리키는 경로 조각. 지난 기록(handoff·ADR·연구 문서)은 이름을 바꾸지 않으므로
 * (0306 D-003) 현재 문서의 링크는 그 파일의 실제 이름을 써야 한다 — 링크가 실재를 가리키는 동안만 통과한다.
 * 옛 표기가 든 경로 마디마다: 마디가 옛 이름 그 자체면 `부모/마디/` 를, 아니면 확장자를 뗀 마디를 낸다.
 */
export function pathShapes(paths, excluded = EXCLUDED) {
  const shapes = new Set()
  for (const path of paths) {
    if (inScope(path, excluded)) continue
    const segments = path.split('/')
    segments.forEach((segment, index) => {
      const stem = segment.replace(/\.[A-Za-z0-9]+$/, '')
      if (findOld(stem).length === 0) return
      if (Object.values(FORMS).includes(stem)) {
        if (index > 0) shapes.add(`${segments[index - 1]}/${segment}/`)
      } else shapes.add(stem)
    })
  }
  // 긴 것부터 지워야 짧은 조각이 긴 조각의 일부를 먼저 먹지 않는다.
  return [...shapes].sort((a, b) => b.length - a.length)
}

/** 한 파일의 옛 표기 자리. 허용 꼴(과 범위 밖 파일 경로 조각)을 먼저 지우고 남은 것만 센다. */
export function findOld(text, shapes = []) {
  const hits = []
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index++) {
    let stripped = lines[index].replace(ALLOWED_SHAPES, (match) => ' '.repeat(match.length))
    for (const shape of shapes) stripped = stripped.replaceAll(shape, ' '.repeat(shape.length))
    for (const match of stripped.matchAll(SUBJECT)) {
      hits.push({
        line: index + 1,
        form: FORM_OF[match[0]],
        text: lines[index].trim().slice(0, 160)
      })
    }
  }
  return hits
}

/**
 * @param {{ path: string, text: string }[]} files 범위 판정 전의 파일 목록
 * @param {string[]} tracked 저장소의 추적 경로 전체 — 범위 밖 파일을 가리키는 링크 판정에 쓴다
 * @returns {{ violations: string[], counted: Map<string, number> }}
 */
export function scan(files, allowed = ALLOWED, excluded = EXCLUDED, tracked = []) {
  const shapes = pathShapes(tracked, excluded)
  const violations = []
  const counted = new Map()
  const expected = new Map(allowed.map((entry) => [`${entry.file}\0${entry.form}`, entry.count]))
  for (const { path, text } of files) {
    if (!inScope(path, excluded)) continue
    if (text.includes('\0')) continue // 바이너리
    for (const hit of findOld(text, shapes)) {
      const key = `${path}\0${hit.form}`
      counted.set(key, (counted.get(key) ?? 0) + 1)
      if (!expected.has(key))
        violations.push(`${path}:${hit.line}: 옛 표기(${hit.form}) — ${hit.text}`)
    }
  }
  for (const [key, count] of expected) {
    const actual = counted.get(key) ?? 0
    if (actual !== count) {
      const [file, form] = key.split('\0')
      violations.push(`${file}: 허용 목록 개수 불일치(${form}) — 등록 ${count} · 실제 ${actual}`)
    }
  }
  return { violations, counted }
}

/** 심볼릭 링크는 따라가지 않고 링크가 적은 대상 경로를 본다 — 대상이 추적 파일이면 그 파일로 따로 검사된다. */
function readTracked(file) {
  return lstatSync(file).isSymbolicLink() ? readlinkSync(file) : readFileSync(file, 'utf8')
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
  const files = tracked
    .filter((path) => inScope(path))
    .map((path) => ({ path, text: readTracked(join(root, path)) }))
  const { violations, counted } = scan(files, ALLOWED, EXCLUDED, tracked)
  if (process.argv.includes('--report-allowed')) {
    for (const entry of ALLOWED) {
      const actual = counted.get(`${entry.file}\0${entry.form}`) ?? 0
      console.log(
        `${entry.file}\t${entry.form}\t등록 ${entry.count}\t실제 ${actual}\t${entry.reason}`
      )
    }
  }
  if (violations.length > 0) {
    console.error(`[product-naming] 위반 ${violations.length}건`)
    for (const line of violations) console.error(`  ${line}`)
    console.error('규칙: docs/handoff/0306-product-naming-sweep/plan.md D-004')
    process.exit(1)
  }
  console.log(`[product-naming] OK — ${files.length}파일 · 허용 ${ALLOWED.length}항목`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
