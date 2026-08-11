#!/usr/bin/env node
// 문서 인벤토리 가드 — "코드에서 셀 수 있는 수는 Markdown 이 갖지 않는다" 를 기계 강제한다.
//
// 왜 스크립트인가: 같은 규칙을 산문으로 적어둔 선례(0177 이 runtime-ipc.md 에 "총계를 재서술하지
// 않는다" 를 남겼다)는 그 파일 하나에서만 지켜졌고 나머지로 번지지 않았다. 6일 만에 IPC 채널 수가
// 다시 두 갈래로 갈라진 것이 반례다(0185 plan §자료조사 1). 관례가 아니라 게이트여야 한다.
//
// 세 가지를 본다:
//   1) count   — 코드를 세어 docs/generated/inventory.md 를 만들고(기본), --check 로 커밋본과 대조
//   2) prose   — current-state 문서 본문에 인벤토리 수치를 서술한 문장이 남아 있는지
//   3) links   — 마크다운 상대 링크가 실제로 해석되는지 (문서 이동 시 파손 검출)
//
// 이 스크립트는 순수 Node 다 — electron·better-sqlite3·vitest 에 의존하지 않으므로
// better-sqlite3 ABI 마찰(app/AGENTS.md)을 받지 않고 어느 게이트에서도 돌 수 있다.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'
import process from 'node:process'

const GENERATED_DOC = join('docs', 'generated', 'inventory.md')

// ── 인벤토리 정의 ────────────────────────────────────────────────────────────
// 각 항목은 "무엇을 세는가" 와 "정본 코드 경로" 를 함께 갖는다. 문서는 이 표만 인용한다.
const INVENTORY = [
  { id: 'ipcChannels', label: 'IPC 채널', source: 'app/src/shared/ipc.ts' },
  { id: 'ipcDomains', label: 'IPC 도메인', source: 'app/src/shared/ipc.ts' },
  {
    id: 'normalizedEventVariants',
    label: 'NormalizedEvent variant',
    source: 'app/src/shared/ipc.ts'
  },
  { id: 'settingsKeys', label: 'settings 키', source: 'app/src/shared/protocol.ts' },
  { id: 'mainSlices', label: 'main 수직 슬라이스', source: 'app/src/main/features/' },
  { id: 'contractModules', label: 'main contracts 모듈', source: 'app/src/main/contracts/' },
  { id: 'ipcHandlers', label: 'IPC 핸들러', source: 'app/src/main/app/handlers/' },
  { id: 'migrations', label: 'DB 마이그레이션', source: 'app/src/main/infra/db/migrations/' },
  { id: 'rendererFeatures', label: 'renderer feature', source: 'app/src/renderer/src/features/' }
]

// ── 순수 파서 ────────────────────────────────────────────────────────────────

/** `'orca:...'` 리터럴을 뽑아 채널 목록과 도메인 분포를 만든다. */
export function parseChannels(ipcSource) {
  const channels = [...new Set(ipcSource.match(/'orca:[a-zA-Z0-9:._-]+'/g) ?? [])].map((raw) =>
    raw.slice(1, -1)
  )
  const domains = new Map()
  for (const channel of channels) {
    const domain = channel.split(':')[1] ?? '(none)'
    domains.set(domain, (domains.get(domain) ?? 0) + 1)
  }
  return {
    channels: channels.sort(),
    domains: [...domains.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }
}

/**
 * 중괄호 균형으로 블록을 떼어 깊이 1 의 키만 센다. 정규식으로 키를 긁으면 중첩 오브젝트의
 * 필드까지 세어 조용히 부풀려진다.
 */
export function parseTopLevelKeys(source, declaration) {
  const start = source.indexOf(declaration)
  if (start === -1) return []
  const open = source.indexOf('{', start)
  if (open === -1) return []

  const keys = []
  let depth = 0
  let line = ''
  for (let i = open; i < source.length; i += 1) {
    const char = source[i]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) break
    } else if (char === '\n') {
      const match = depth === 1 ? line.match(/^\s*([a-zA-Z_$][\w$]*)\s*:/) : null
      if (match) keys.push(match[1])
      line = ''
      continue
    }
    line += char
  }
  return keys
}

/**
 * discriminated union 의 멤버 수를 센다. 멤버는 인라인 오브젝트(`| { type: '…' }`)이거나
 * 참조 타입(`| ChatActivitySnapshot`)이라 둘 다 세야 한다 — 인라인만 세면 참조 멤버가 누락된다.
 */
export function parseUnionMembers(source, declaration) {
  const start = source.indexOf(declaration)
  if (start === -1) return { inline: [], referenced: [], total: 0 }

  const body = source.slice(start + declaration.length)
  const inline = []
  const referenced = []
  let depth = 0
  let pendingMember = false

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    // 최상위(depth 0)에서 새 export 를 만나면 union 이 끝난 것이다.
    if (depth === 0 && /^export\s/.test(line)) break

    if (depth === 0 && line.startsWith('|')) {
      // 새 멤버의 시작. 참조 타입(`| Foo`)이거나, 판별자가 같은 줄에 있거나(한 줄 멤버),
      // 다음 줄들에 있다(여러 줄 멤버). 세 경우를 다 봐야 한다.
      const reference = line.match(/^\|\s*([A-Z][\w]*)\s*$/)
      if (reference) {
        referenced.push(reference[1])
        pendingMember = false
      } else {
        const sameLine = line.match(/\btype:\s*'([^']+)'/)
        if (sameLine) {
          inline.push(sameLine[1])
          pendingMember = false
        } else {
          pendingMember = true
        }
      }
    } else if (pendingMember) {
      const discriminant = line.match(/^type:\s*'([^']+)'/)
      if (discriminant) {
        inline.push(discriminant[1])
        pendingMember = false
      }
    }

    for (const char of rawLine) {
      if (char === '{') depth += 1
      else if (char === '}') depth = Math.max(0, depth - 1)
    }
  }

  return { inline, referenced, total: inline.length + referenced.length }
}

function listDirs(path) {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function listModules(path, extension = '.ts') {
  if (!existsSync(path)) return []
  return readdirSync(path)
    .filter((file) => file.endsWith(extension) && !file.endsWith(`.test${extension}`))
    .map((file) => file.slice(0, -extension.length))
    .sort()
}

/** 코드에서 인벤토리 전량을 센다. appDir = 저장소의 `app/` 절대경로. */
export function countInventory(appDir) {
  const ipcSource = readFileSync(join(appDir, 'src', 'shared', 'ipc.ts'), 'utf8')
  const protocolSource = readFileSync(join(appDir, 'src', 'shared', 'protocol.ts'), 'utf8')

  const { channels, domains } = parseChannels(ipcSource)
  const variants = parseUnionMembers(ipcSource, 'export type NormalizedEvent =')
  const settingsKeys = parseTopLevelKeys(protocolSource, 'export const SettingsSchema = z.object(')

  return {
    ipcChannels: { count: channels.length, items: channels },
    ipcDomains: { count: domains.length, items: domains.map(([name, n]) => `${name} ${n}`) },
    normalizedEventVariants: {
      count: variants.total,
      items: [...variants.inline, ...variants.referenced].sort()
    },
    settingsKeys: { count: settingsKeys.length, items: settingsKeys.slice().sort() },
    mainSlices: (() => {
      const items = listDirs(join(appDir, 'src', 'main', 'features'))
      return { count: items.length, items }
    })(),
    contractModules: (() => {
      const items = listModules(join(appDir, 'src', 'main', 'contracts'))
      return { count: items.length, items }
    })(),
    ipcHandlers: (() => {
      const items = listModules(join(appDir, 'src', 'main', 'app', 'handlers'))
      return { count: items.length, items }
    })(),
    migrations: (() => {
      const items = listModules(join(appDir, 'src', 'main', 'infra', 'db', 'migrations'), '.sql')
      return { count: items.length, items }
    })(),
    rendererFeatures: (() => {
      const items = listDirs(join(appDir, 'src', 'renderer', 'src', 'features'))
      return { count: items.length, items }
    })()
  }
}

/** 인벤토리를 문서로 렌더한다. 이 문서가 저장소에서 수치를 갖는 유일한 자리다. */
export function renderInventory(inventory) {
  const lines = [
    '<!-- 생성물 — 직접 편집 금지. `cd app && node scripts/check-doc-inventory.mjs` 로 재생성한다. -->',
    '',
    '# 코드 인벤토리 (생성물)',
    '',
    '> 이 문서는 **코드를 세어 만든 것**이다. 사람이 고치면 CI 가 실패한다',
    '> (`check-doc-inventory.mjs --check` 가 재생성 결과와 대조한다).',
    '>',
    '> **다른 문서는 이 수치를 옮겨 적지 않는다.** 수치가 필요하면 이 표를 링크한다 — 사본을 만들면',
    '> 반드시 갈라진다(0177 이 전수 동기화한 채널 수가 6일 만에 재드리프트한 것이 그 증거다).',
    '',
    '| 항목 | 수 | 정본 |',
    '|---|---|---|'
  ]
  for (const { id, label, source } of INVENTORY) {
    lines.push(`| ${label} | **${inventory[id].count}** | \`${source}\` |`)
  }
  lines.push('')
  lines.push('## 내역')
  lines.push('')
  for (const { id, label } of INVENTORY) {
    lines.push(`### ${label} (${inventory[id].count})`)
    lines.push('')
    lines.push(inventory[id].items.map((item) => `\`${item}\``).join(' · '))
    lines.push('')
  }
  return lines.join('\n')
}

// ── 프로즈 스캐너 ────────────────────────────────────────────────────────────
//
// P30 방어(0177): 음성 grep 게이트가 이력을 배제하지 않으면 "게이트 통과" 가 문서를 손상시킨다.
// 과거 사실로서의 수치는 보존 대상이므로 archive·handoff·생성물·외부 미러를 명시 제외한다.
export const PROSE_EXCLUDED = [
  join('docs', 'generated'), // 생성물 — 수치를 갖는 유일한 자리
  join('docs', 'archive'), // 과거 사실로서의 수치는 보존 대상
  join('docs', 'handoff'), // 작업 시점의 실측 기록 (plan/verify 는 증거다)
  join('docs', 'etc'), // 전략·외부 사례 연구 (다른 프로젝트의 수치)
  join('docs', 'spec'), // 외부 공식 문서 원문 미러 (편집 금지)
  '.agents', // 스킬의 references — 과거 실패 사례를 수치째 인용한다
  'chats', // 트랜스크립트 원문
  'project', // 디자인 프로토타입 아카이브
  'node_modules',
  '.git'
]

// 맨숫자는 잡지 않는다 — **수치 + 인벤토리 단위**가 붙은 서술만 잡는다.
//
// 임계 규칙: `채널`·`도메인`·`키` 는 일반 명사라 한 자리 수와 붙으면 오탐이 쏟아진다(실측 —
// Bayer "G2 채널", 절 번호 "5.1 채널", "ordered+lossless 1채널", 도메인별 "`provider` 6채널").
// 반면 **인벤토리 총계는 전부 두 자리**이고 도메인별 채널 수는 최대 7이다. 그래서 이 셋만
// `\d{2,}` 로 좁히고, `총/현재/현행` 이 명시된 경우는 자릿수와 무관하게 잡는다.
// 나머지(`슬라이스`·`contracts`·`마이그레이션`·`variant`·`handlers`)는 키워드가 고유해
// 자릿수 제한 없이 잡아도 오탐이 없다.
export const PROSE_PATTERNS = [
  {
    id: 'ipcChannels',
    re: /(?:총|현재|현행)\s*\*{0,2}\d+\s*\*{0,2}\s*채널|\*{0,2}\d{2,}\s*\*{0,2}\s*채널/g
  },
  { id: 'ipcDomains', re: /\*{0,2}\d{2,}\s*\*{0,2}\s*도메인/g },
  {
    id: 'mainSlices',
    re: /슬라이스\s*\(?\s*현재\s*\)?\s*\*{0,2}\d+|슬라이스\s*\*{0,2}\d+\s*\*{0,2}\s*종|\*{0,2}\d+\s*\*{0,2}\s*슬라이스/g
  },
  { id: 'contractModules', re: /contracts[^\n|]{0,24}?\*{0,2}\d+\s*\*{0,2}\s*모듈/g },
  {
    id: 'settingsKeys',
    re: /(?:총|현재|현행)\s*\*{0,2}\d+\s*\*{0,2}\s*키(?![가-힣])|\*{0,2}\d{2,}\s*\*{0,2}\s*키(?![가-힣])/g
  },
  {
    id: 'migrations',
    re: /마이그레이션\s*\*{0,2}\d+\s*\*{0,2}\s*종|마이그레이션\s*\*{0,2}\d+\s*\*{0,2}(?=\s*(?:종|개|\)|,|\.))/g
  },
  { id: 'normalizedEventVariants', re: /variant\s*\*{0,2}\d+\s*\*{0,2}\s*종/g },
  {
    id: 'ipcHandlers',
    re: /핸들러\s*\*{0,2}\d+\s*\*{0,2}\s*종|handlers[^\n|]{0,16}?\*{0,2}\d+\s*\*{0,2}\s*종/g
  },
  // 수치 전이(`77 → 76`)는 architecture 가 아니라 changelog 다. 단위가 앞에 오는 형태
  // (`채널 **77 → 76**`)와 뒤에 오는 형태(`**82 → 71 채널**`)가 둘 다 실재한다.
  {
    id: 'transition',
    re: /(?:채널|모듈|키|슬라이스)\s*\*{0,2}\d+\s*\*{0,2}\s*(?:→|->)\s*\*{0,2}\d+|\d+\s*\*{0,2}\s*(?:→|->)\s*\*{0,2}\d+\s*\*{0,2}\s*(?:채널|모듈|키|슬라이스|종)/g
  }
]

export function scanProseText(text, patterns = PROSE_PATTERNS) {
  const hits = []
  text.split('\n').forEach((line, index) => {
    for (const { id, re } of patterns) {
      re.lastIndex = 0
      let match
      while ((match = re.exec(line)) !== null) {
        hits.push({ id, line: index + 1, text: match[0].trim() })
      }
    }
  })
  return hits
}

export function isExcluded(relPath, excluded = PROSE_EXCLUDED) {
  const normalized = relPath.split(/[\\/]/).join(sep)
  return excluded.some((prefix) => normalized === prefix || normalized.startsWith(prefix + sep))
}

function walkMarkdown(rootDir, current = rootDir, out = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = join(current, entry.name)
    const rel = relative(rootDir, full)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'out') continue
      walkMarkdown(rootDir, full, out)
    } else if (entry.name.endsWith('.md')) {
      out.push(rel)
    }
  }
  return out
}

/** current-state 문서에 남은 인벤토리 수치 서술을 찾는다. */
export function scanProse(rootDir, excluded = PROSE_EXCLUDED) {
  const findings = []
  for (const rel of walkMarkdown(rootDir)) {
    if (isExcluded(rel, excluded)) continue
    for (const hit of scanProseText(readFileSync(join(rootDir, rel), 'utf8'))) {
      findings.push({ file: rel, ...hit })
    }
  }
  return findings
}

// ── 링크 체커 ────────────────────────────────────────────────────────────────

export function parseRelativeLinks(markdown) {
  const links = []
  const pattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let match
  while ((match = pattern.exec(markdown)) !== null) {
    const target = match[1]
    // `/ko/agent-sdk/…` 처럼 **사이트 절대경로**는 저장소 상대링크가 아니다 — 외부 원문 미러가
    // 벤더 사이트의 경로를 그대로 갖고 있어서 저장소 기준으로 풀면 전부 거짓 파손이 된다.
    if (/^(https?:|mailto:|#|\/)/.test(target)) continue
    links.push(target.split('#')[0])
  }
  return links.filter((target) => target.length > 0)
}

// 링크는 **살아 있는 문서**만 본다. 과거 핸드오프(`<NNNN-slug>/`)는 작성 시점의 경로를 가리키고
// 있어 지금 깨져 있는 것이 정상이다 — 고치면 그 시점의 기록이 아니게 된다. 다만 보드와 절차서
// (`docs/handoff/{INDEX,AGENTS}.md`)는 살아 있으므로 검사 대상이다.
export const LINK_EXCLUDED = [join('docs', 'etc'), join('docs', 'spec'), 'node_modules', '.git']

export function isHistoricalHandoff(relPath) {
  const parts = relPath.split(/[\\/]/)
  return parts[0] === 'docs' && parts[1] === 'handoff' && /^\d{4}-/.test(parts[2] ?? '')
}

/** 마크다운 상대 링크가 실제 파일로 해석되는지 확인한다. 문서 이동 시 파손을 잡는다. */
export function checkLinks(rootDir, excluded = LINK_EXCLUDED) {
  const broken = []
  for (const rel of walkMarkdown(rootDir)) {
    if (isExcluded(rel, excluded) || isHistoricalHandoff(rel)) continue
    const source = readFileSync(join(rootDir, rel), 'utf8')
    for (const target of parseRelativeLinks(source)) {
      const resolved = resolve(dirname(join(rootDir, rel)), decodeURI(target))
      if (!existsSync(resolved)) broken.push({ file: rel, target })
    }
  }
  return broken
}

// ── CLI ──────────────────────────────────────────────────────────────────────

export function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  const check = argv.includes('--check')
  const appDir = cwd
  const rootDir = resolve(cwd, '..')

  const inventory = countInventory(appDir)
  const rendered = renderInventory(inventory)
  const generatedPath = join(rootDir, GENERATED_DOC)

  if (!check) {
    mkdirSync(dirname(generatedPath), { recursive: true })
    writeFileSync(generatedPath, rendered + '\n', 'utf8')
    console.log(`[doc-inventory] wrote ${GENERATED_DOC}`)
    return 0
  }

  let failed = false

  const existing = existsSync(generatedPath) ? readFileSync(generatedPath, 'utf8') : null
  if (existing === null) {
    console.error(
      `[doc-inventory] missing ${GENERATED_DOC} — run: node scripts/check-doc-inventory.mjs`
    )
    failed = true
  } else if (existing !== rendered + '\n') {
    console.error(
      `[doc-inventory] ${GENERATED_DOC} is stale or hand-edited — run: node scripts/check-doc-inventory.mjs`
    )
    failed = true
  } else {
    console.log(
      `[doc-inventory] generated doc ok (${INVENTORY.length} items, ${inventory.ipcChannels.count} channels)`
    )
  }

  const prose = scanProse(rootDir)
  if (prose.length > 0) {
    for (const finding of prose) {
      console.error(
        `[doc-inventory] inventory count in prose: ${finding.file}:${finding.line} "${finding.text}" ` +
          `— link ${GENERATED_DOC} instead`
      )
    }
    failed = true
  } else {
    console.log('[doc-inventory] prose ok: no inventory counts restated in current-state docs')
  }

  const broken = checkLinks(rootDir)
  if (broken.length > 0) {
    for (const link of broken) {
      console.error(`[doc-inventory] broken relative link: ${link.file} -> ${link.target}`)
    }
    failed = true
  } else {
    console.log('[doc-inventory] links ok: every relative markdown link resolves')
  }

  return failed ? 1 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
