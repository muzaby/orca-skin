#!/usr/bin/env node
// 릴리스 버전 검증 — 태그(vX.Y.Z)와 package.json version 의 정합을 빌드 전에 강제한다.
// 태그 없이 실행하면(workflow_dispatch dry-run) package.json semver 검사만 수행한다.
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const STRICT_SEMVER = /^\d+\.\d+\.\d+$/
const TAG_PATTERN = /^v\d+\.\d+\.\d+$/

export function validateReleaseVersion({ tag, packageVersion }) {
  const errors = []

  if (typeof packageVersion !== 'string' || !STRICT_SEMVER.test(packageVersion)) {
    errors.push(`package.json version must be strict semver X.Y.Z, got: ${packageVersion}`)
  }

  if (tag) {
    if (!TAG_PATTERN.test(tag)) {
      errors.push(`release tag must be vX.Y.Z, got: ${tag}`)
    } else if (tag.slice(1) !== packageVersion) {
      errors.push(`release tag ${tag} does not match package.json version ${packageVersion}`)
    }
  }

  return { ok: errors.length === 0, errors }
}

export function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  const tag = argv.find((arg) => arg.length > 0) ?? ''
  const packageJson = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
  const result = validateReleaseVersion({ tag, packageVersion: packageJson.version })

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`[release-version] ${error}`)
    }
    return 1
  }

  const tagInfo = tag ? `tag=${tag}` : 'no tag (dry run)'
  console.log(`[release-version] ok: version=${packageJson.version} ${tagInfo}`)
  return 0
}

// 직접 실행 판정 — `pathToFileURL` 로 비교한다. `file://${process.argv[1]}` 는 **Windows 에서
// 절대 성립하지 않는다**: argv[1] 은 `C:.mjs` 라 `file://C:.mjs` 가 되고
// `import.meta.url` 은 `file:///C:/a/b.mjs` 다. 그러면 CLI 본문이 실행되지 않은 채 exit 0 이 나가
// 게이트가 무음으로 통과한다(CI 는 windows-latest 다). 선례: `analyze-composer-input-trace.mjs`.
const invokedAs = process.argv[1]
if (invokedAs && import.meta.url === pathToFileURL(invokedAs).href) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
