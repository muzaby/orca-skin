// uv 바이너리를 GitHub 릴리스에서 받아 resources/bin/<platform>-<arch>/ 에 배치한다.
// Python 런타임 4-A 분기(uv 동봉, 인터프리터는 첫 실행 시 다운로드)의 빌드 전 준비 스텝.
//
// 사용:
//   node scripts/fetch-uv.mjs                  # 현재 플랫폼
//   node scripts/fetch-uv.mjs win32-x64        # 특정 타깃 (크로스 준비)
//   UV_VERSION=0.5.0 node scripts/fetch-uv.mjs # 버전 고정
//
// 대용량 바이너리는 git 에 커밋하지 않는다(.gitignore). CI / 로컬 빌드 직전에 실행한다.

import { mkdir, chmod, rm } from 'node:fs/promises'
import { createWriteStream, existsSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const UV_VERSION = process.env.UV_VERSION ?? 'latest'

// electron-builder 의 ${platform}-${arch} 규약과 동일한 키.
const target = process.argv[2] ?? `${process.platform}-${process.arch}`

// uv 릴리스 자산 이름 (target → python-build-standalone 식 triple).
const ASSET = {
  'win32-x64': { file: 'uv-x86_64-pc-windows-msvc.zip', bin: 'uv.exe' },
  'darwin-x64': { file: 'uv-x86_64-apple-darwin.tar.gz', bin: 'uv' },
  'darwin-arm64': { file: 'uv-aarch64-apple-darwin.tar.gz', bin: 'uv' },
  'linux-x64': { file: 'uv-x86_64-unknown-linux-gnu.tar.gz', bin: 'uv' },
  'linux-arm64': { file: 'uv-aarch64-unknown-linux-gnu.tar.gz', bin: 'uv' }
}

async function main() {
  const spec = ASSET[target]
  if (!spec) {
    console.error(`지원하지 않는 타깃: ${target}. 지원: ${Object.keys(ASSET).join(', ')}`)
    process.exit(1)
  }

  const base =
    UV_VERSION === 'latest'
      ? 'https://github.com/astral-sh/uv/releases/latest/download'
      : `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`
  const url = `${base}/${spec.file}`

  const outDir = join(projectRoot, 'resources', 'bin', target)

  // 멱등 가드: 바이너리가 이미 있으면 재다운로드 스킵 (predev 훅 반복 호출 대비).
  // 버전 고정(UV_VERSION 명시) 또는 --force/UV_FORCE 시에는 우회한다.
  const force = process.argv.includes('--force') || process.env.UV_FORCE
  if (!force && UV_VERSION === 'latest' && existsSync(join(outDir, spec.bin))) {
    console.log(`이미 존재: ${join('resources', 'bin', target, spec.bin)} (재다운로드 스킵)`)
    return
  }

  await mkdir(outDir, { recursive: true })

  const archivePath = join(outDir, spec.file)
  console.log(`다운로드: ${url}`)
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    console.error(`다운로드 실패: HTTP ${res.status}`)
    process.exit(1)
  }
  await pipeline(res.body, createWriteStream(archivePath))

  // 압축 해제 — 시스템 tar/unzip 사용 (Node 코어에 압축 해제 없음).
  console.log('압축 해제 중…')
  if (spec.file.endsWith('.zip')) {
    await execFileAsync('tar', ['-xf', archivePath, '-C', outDir]) // bsdtar(win)도 zip 지원
  } else {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', outDir, '--strip-components', '1'])
  }

  const binPath = join(outDir, spec.bin)
  if (process.platform !== 'win32' && spec.bin === 'uv') {
    await chmod(binPath, 0o755).catch(() => {})
  }
  await rm(archivePath, { force: true })

  console.log(`완료: ${binPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
