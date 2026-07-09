#!/usr/bin/env node
// 릴리스 버전 검증 — 태그(vX.Y.Z)와 package.json version 의 정합을 빌드 전에 강제한다.
// 태그 없이 실행하면(workflow_dispatch dry-run) package.json semver 검사만 수행한다.
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

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
