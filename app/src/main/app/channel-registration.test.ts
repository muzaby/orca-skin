import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHANNEL_OWNER, type ChannelOwner } from '../../shared/channel-owner'

// 채널 소유 표 ↔ 실제 등록 프로세스 (0324 EP-8′ · AC24′).
//
// 요청 핸들러를 등록하는 자리(`handle`·`handlePlain`·`on` 의 첫 인자 `CHANNELS.<키>`)를 소스에서 찾고,
// 그 파일이 어느 프로세스 진입점의 값 import 그래프에 드는지로 "실제 등록 프로세스"를 정한다. 표가 가리킨
// 프로세스와 다르거나, 두 프로세스에 걸치거나, 어디서도 등록하지 않는 요청 채널이 있으면 실패한다.

const SRC = resolve(__dirname, '../..')
const ENTRIES: Record<ChannelOwner, string> = {
  shell: 'main/index.ts',
  agent: 'main/app/agent-host/entry.ts',
  data: 'main/app/data-host/entry.ts'
}
const TEST_SOURCE = /\.(test|testfixture)\.tsx?$/

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) return sources(full)
    return /\.ts$/.test(entry.name) && !TEST_SOURCE.test(entry.name) ? [full] : []
  })
}

// 값 import·재수출의 상대 지정자 — 타입 전용 import 는 번들에 들어가지 않는다.
export function valueImports(text: string): string[] {
  const out: string[] = []
  const pattern = /^\s*(import|export)\s+(type\s+)?([^'"]*?\sfrom\s+)?['"](\.[^'"]+)['"]/gm
  for (const match of text.matchAll(pattern)) if (!match[2]) out.push(match[4]!)
  for (const match of text.matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g)) out.push(match[1]!)
  return out
}

function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier)
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function graph(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [join(SRC, entry)]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const specifier of valueImports(readFileSync(file, 'utf8'))) {
      const target = resolveImport(file, specifier)
      if (target && !TEST_SOURCE.test(target)) queue.push(target)
    }
  }
  return seen
}

const REGISTRATION = /\b(?:handle|handlePlain|on)\s*(?:<[^()]*?>)?\(\s*CHANNELS\.(\w+)/g

export function registrations(files: readonly string[]): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(REGISTRATION)) {
      found.set(match[1]!, [...(found.get(match[1]!) ?? []), file])
    }
  }
  return found
}

// preload 가 구독하는 통지 채널 — 요청 핸들러가 없는 것이 맞는 채널이다.
function subscribedChannels(): Set<string> {
  const text = readFileSync(join(SRC, 'preload/index.ts'), 'utf8')
  return new Set(
    [
      ...text.matchAll(/\bsubscribe\w*\s*(?:<[^()]*?>)?\(\s*CHANNELS\.(\w+)/g),
      // 세션 본문 조각은 조립 클라이언트가 구독한다 — 채널 이름을 `chunk` 로 넘긴다.
      ...text.matchAll(/\bchunk:\s*CHANNELS\.(\w+)/g)
    ].map((m) => m[1]!)
  )
}

const graphs = Object.fromEntries(
  Object.entries(ENTRIES).map(([owner, entry]) => [owner, graph(entry)])
) as Record<ChannelOwner, Set<string>>
const found = registrations(sources(join(SRC, 'main')))
const label = (file: string): string => relative(SRC, file).replaceAll('\\', '/')

describe('채널 소유 표 ↔ 실제 등록 프로세스', () => {
  it('세 진입점의 그래프가 핸들러 파일까지 닿는다', () => {
    for (const owner of Object.keys(ENTRIES) as ChannelOwner[]) {
      expect(graphs[owner].size, owner).toBeGreaterThan(10)
    }
    expect(found.size).toBeGreaterThan(50)
  })

  it('등록한 채널마다 그 파일은 표가 가리킨 프로세스의 그래프에만 든다', () => {
    const mismatches: string[] = []
    for (const [key, files] of found) {
      const owner = (CHANNEL_OWNER as Record<string, ChannelOwner>)[key]
      if (!owner) {
        mismatches.push(`${key}: 소유 표에 없다`)
        continue
      }
      if (files.length !== 1)
        mismatches.push(`${key}: 등록 자리 ${files.length} — ${files.map(label)}`)
      for (const file of files) {
        const actual = (Object.keys(graphs) as ChannelOwner[]).filter((p) => graphs[p].has(file))
        if (actual.length !== 1 || actual[0] !== owner) {
          mismatches.push(`${key}: 표 ${owner} ↔ 등록 [${actual.join(',')}] (${label(file)})`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  it('등록이 없는 채널은 preload 가 구독하는 통지 채널뿐이다', () => {
    const subscribed = subscribedChannels()
    const unregistered = Object.keys(CHANNEL_OWNER).filter((key) => !found.has(key))
    expect(unregistered.length).toBeGreaterThan(0)
    expect(unregistered.filter((key) => !subscribed.has(key))).toEqual([])
  })

  it('import 추출은 타입 전용을 빼고 값·재수출·동적 import 를 잡는다', () => {
    expect(
      valueImports(
        [
          "import type { A } from './type-only'",
          "import { b } from './value'",
          "import {\n  c,\n  d\n} from './multi-line'",
          "export { e } from './re-export'",
          "export type { F } from './type-re-export'",
          "import './side-effect'",
          "const g = await import('./dynamic')",
          "import { h } from 'package'"
        ].join('\n')
      )
    ).toEqual(['./value', './multi-line', './re-export', './side-effect', './dynamic'])
  })
})
