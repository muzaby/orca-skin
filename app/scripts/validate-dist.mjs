#!/usr/bin/env node
// 릴리스 산출물 검증 — electron-builder 가 dist/ 에 만든 latest.yml 이 기대 버전을
// 가리키고, 참조하는 NSIS installer 가 실재하며 sha512/size 가 일치하고, 차등
// 업데이트용 blockmap 이 존재하는지 확인한다. latest.yml 의 sha512 는 electron-updater
// 가 다운로드 시 강제하는 무결성 앵커라(unsigned 배포의 무결성 근거) 빌드 시점에 고정한다.
// electron-builder 26 의 평면 latest.yml 스키마 전용 미니 파서 — 신규 의존성 없이 처리한다.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

export function parseLatestYml(text) {
  const manifest = { version: null, path: null, sha512: null, files: [] }
  let currentFile = null
  let inFiles = false

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue

    if (!/^\s/.test(line)) {
      inFiles = false
      currentFile = null
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (!match) continue
      const [, key, value] = match
      if (key === 'files') {
        inFiles = true
      } else if (key in manifest) {
        manifest[key] = unquote(value)
      }
      continue
    }

    if (!inFiles) continue
    const itemStart = line.match(/^\s*-\s+(\w+):\s*(.*)$/)
    if (itemStart) {
      currentFile = { [itemStart[1]]: unquote(itemStart[2]) }
      manifest.files.push(currentFile)
      continue
    }
    const itemField = line.match(/^\s+(\w+):\s*(.*)$/)
    if (itemField && currentFile) {
      currentFile[itemField[1]] = unquote(itemField[2])
    }
  }

  return manifest
}

function unquote(value) {
  const trimmed = value.trim()
  const quoted = trimmed.match(/^'(.*)'$/) ?? trimmed.match(/^"(.*)"$/)
  return quoted ? quoted[1] : trimmed
}

export function validateDist({ manifest, expectedVersion, expectedArtifact, fileSize, hashFile }) {
  const errors = []

  if (manifest.version !== expectedVersion) {
    errors.push(`latest.yml version ${manifest.version} != expected ${expectedVersion}`)
  }
  if (manifest.path !== expectedArtifact) {
    errors.push(`latest.yml path ${manifest.path} != expected artifact ${expectedArtifact}`)
  }
  if (!manifest.sha512) {
    errors.push('latest.yml has no top-level sha512')
  }

  const entry = manifest.files.find((file) => file.url === manifest.path)
  if (!entry) {
    errors.push(`latest.yml files[] has no entry for path ${manifest.path}`)
  }

  const actualSize = fileSize(manifest.path)
  if (actualSize === null) {
    errors.push(`artifact missing in dist/: ${manifest.path}`)
    return { ok: false, errors }
  }

  const actualSha512 = hashFile(manifest.path)
  if (manifest.sha512 && actualSha512 !== manifest.sha512) {
    errors.push(`sha512 mismatch: recomputed ${actualSha512} != latest.yml ${manifest.sha512}`)
  }
  if (entry) {
    if (entry.sha512 !== manifest.sha512) {
      errors.push('latest.yml files[].sha512 != top-level sha512')
    }
    if (Number(entry.size) !== actualSize) {
      errors.push(`size mismatch: actual ${actualSize} != latest.yml ${entry.size}`)
    }
  }

  const blockmapSize = fileSize(`${manifest.path}.blockmap`)
  if (blockmapSize === null || blockmapSize === 0) {
    errors.push(`blockmap missing or empty: ${manifest.path}.blockmap`)
  }

  return { ok: errors.length === 0, errors }
}

export function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  const tag = argv.find((arg) => arg.length > 0) ?? ''
  const packageJson = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  const expectedVersion = tag ? tag.slice(1) : packageJson.version
  const expectedArtifact = `${packageJson.name}-${expectedVersion}-setup.exe`
  const distDir = join(cwd, 'dist')

  const latestPath = join(distDir, 'latest.yml')
  if (!existsSync(latestPath)) {
    console.error(`[dist] latest.yml not found: ${latestPath}`)
    return 1
  }

  const result = validateDist({
    manifest: parseLatestYml(readFileSync(latestPath, 'utf8')),
    expectedVersion,
    expectedArtifact,
    fileSize: (name) =>
      existsSync(join(distDir, name)) ? statSync(join(distDir, name)).size : null,
    hashFile: (name) =>
      createHash('sha512')
        .update(readFileSync(join(distDir, name)))
        .digest('base64')
  })

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`[dist] ${error}`)
    }
    return 1
  }
  console.log(`[dist] ok: ${expectedArtifact} + latest.yml + blockmap (version ${expectedVersion})`)
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
