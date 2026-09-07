import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const encoderUrl = new URL('./sandbox-launch-frame.mjs', import.meta.url)
test('frame producer exists and writes the versioned bounded wire contract', async () => {
  assert.ok(existsSync(encoderUrl), 'Implement the launch frame producer')
  const { encodeLaunchFrame } = await import(encoderUrl)
  const frame = encodeLaunchFrame({
    executable: 'C:\\tools\\probe.exe',
    cwd: 'C:\\work',
    args: [],
    env: {}
  })
  assert.equal(frame.subarray(0, 4).toString(), 'ORCA')
  assert.equal(frame.readUInt32LE(4), 1)
  assert.equal(frame.readUInt32LE(8), frame.length - 12)
})

test('producer rejects invalid paths, NUL, surrogate, excessive counts and reserved/duplicate env', async () => {
  const { encodeLaunchFrame: encode } = await import(encoderUrl)
  const valid = { executable: 'C:\\tools\\probe.exe', cwd: 'C:\\work', args: [], env: {} }
  for (const delta of [
    { executable: 'probe.exe' },
    { executable: 'C:\\probe.cmd' },
    { executable: 'C:\\probe.bat' },
    { cwd: '\\work' },
    { args: ['a\0b'] },
    { args: ['\ud800'] },
    { args: Array(4097).fill('') },
    { args: ['a'.repeat(1024 * 1024)] },
    { env: { key: '1', KEY: '2' } },
    { env: { HTTP_PROXY: 'bad' } },
    { env: { SystemRoot: 'bad' } },
    { env: { GIT_CONFIG_COUNT: '1' } },
    { env: { NODE_EXTRA_CA_CERTS: 'bad' } },
    { env: { 'a=b': 'bad' } }
  ])
    assert.throws(() => encode({ ...valid, ...delta }))
})

// Explicit native mode is a separate prerequisite-bearing suite, not a skipped test.
// Run: node scripts/build-sandbox-launcher.mjs && node scripts/sandbox-launcher.test.mjs --native
if (process.argv.includes('--native')) {
  const exe = path.join(appDir, 'resources', 'sandbox', 'win32-x64', 'orca-sandbox-launcher.exe')
  const probe = fileURLToPath(new URL('./fixtures/sandbox-launcher-probe.mjs', import.meta.url))
  const invoke = (input, env = {}) =>
    spawnSync(exe, ['orca-launch-v1'], {
      input,
      env: { ...process.env, ...env },
      timeout: 10000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true
    })
  const uint = (n) => {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(n)
    return b
  }
  const str = (s) => {
    const b = Buffer.from(s)
    return Buffer.concat([uint(b.length), b])
  }
  const raw = ({ executable = process.execPath, cwd = appDir, args = [probe], env = [] } = {}) => {
    const body = Buffer.concat([
      str(executable),
      str(cwd),
      uint(args.length),
      ...args.map(str),
      uint(env.length),
      ...env.flatMap(([key, value]) => [str(key), str(value)])
    ])
    return Buffer.concat([Buffer.from('ORCA'), uint(1), uint(body.length), body])
  }
  test('native executable is built on Windows x64', () => {
    assert.equal(process.platform, 'win32')
    assert.equal(process.arch, 'x64')
    assert.ok(existsSync(exe), 'Run npm run sandbox:build before native tests')
  })
  test('native argv/env/cwd and unbuffered stdin suffix survive one write; exit and stderr survive', async () => {
    const { encodeLaunchFrame: encode } = await import(encoderUrl)
    const args = [
      '',
      'with spaces',
      '한글😀',
      'a"b',
      'a\\',
      '\\"',
      'x\\\\"z',
      '&|<>%^!',
      'line\nfeed'
    ]
    const suffix = Buffer.from([0, 1, 255, 10, 13, 65])
    const frame = encode({
      executable: process.execPath,
      cwd: appDir,
      args: [probe, ...args],
      env: { ORCA_FAKE_KEY: 'fake-only-한글', ORCA_PROBE_EXIT: '37' }
    })
    const result = invoke(Buffer.concat([frame, suffix]), {
      ORCA_INHERITED: 'preserved',
      HTTP_PROXY: 'http://127.0.0.1:60080'
    })
    assert.ifError(result.error)
    assert.equal(result.status, 37, result.stderr.toString())
    const observed = JSON.parse(result.stdout.toString())
    assert.deepEqual(observed.args, args)
    assert.equal(observed.stdin, suffix.toString('base64'))
    assert.equal(observed.cwd.toLowerCase(), appDir.replace(/[\\/]$/, '').toLowerCase())
    assert.equal(observed.key, 'fake-only-한글')
    assert.equal(observed.inherited, 'preserved')
    assert.equal(observed.proxy, 'http://127.0.0.1:60080')
    assert.equal(result.stderr.toString(), 'probe-stderr\r\n')
  })
  test('native rejects malformed frames before target execution without secret diagnostics', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'orca-launch-test-'))
    const marker = path.join(dir, 'started')
    const valid = raw({ env: [['ORCA_PROBE_MARKER', marker]] })
    const badMagic = Buffer.from(valid)
    badMagic[0] = 0
    const badVersion = Buffer.from(valid)
    badVersion.writeUInt32LE(2, 4)
    const huge = Buffer.from(valid.subarray(0, 12))
    huge.writeUInt32LE(1048577, 8)
    const invalidUtf8 = Buffer.from(valid)
    invalidUtf8[16] = 255
    const nul = Buffer.from(valid)
    nul[16] = 0
    const trailing = Buffer.concat([valid, Buffer.from([0])])
    trailing.writeUInt32LE(trailing.length - 12, 8)
    const cases = [
      badMagic,
      badVersion,
      huge,
      invalidUtf8,
      nul,
      trailing,
      valid.subarray(0, 7),
      valid.subarray(0, -1),
      raw({ executable: 'relative.exe' }),
      raw({ cwd: '\\relative' }),
      raw({ executable: 'C:\\test.cmd' }),
      raw({
        env: [
          ['dup', 'secret-sentinel'],
          ['DUP', 'secret-sentinel']
        ]
      }),
      raw({ env: [['https_proxy', 'secret-sentinel']] }),
      raw({ env: [['HOME', 'secret-sentinel']] }),
      raw({ env: [['SSL_CERT_FILE', 'secret-sentinel']] }),
      raw({ env: [['GIT_CONFIG_GLOBAL', 'secret-sentinel']] }),
      raw({ args: Array(4097).fill('') }),
      raw({ args: ['x'.repeat(32768)] }),
      raw({ executable: path.join(dir, 'missing.exe') }),
      raw({ cwd: path.join(dir, 'missing-cwd') })
    ]
    try {
      for (const input of cases) {
        const result = invoke(input, { ORCA_PROBE_MARKER: marker })
        assert.ifError(result.error)
        assert.notEqual(result.status, 0)
        assert.equal(result.stdout.length, 0)
        assert.match(result.stderr.toString(), /^orca-launcher: [A-Z0-9_]+(?: \d+)?\r?\n$/)
        assert.ok(!result.stderr.toString().includes('secret-sentinel'))
        assert.ok(!existsSync(marker), existsSync(marker) ? readFileSync(marker, 'utf8') : '')
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('native permits zero target arguments and consumes no target stdin bytes', async () => {
    const { encodeLaunchFrame: encode } = await import(encoderUrl)
    const input = Buffer.concat([
      encode({ executable: process.execPath, cwd: appDir, args: [], env: {} }),
      Buffer.from('process.stdout.write(JSON.stringify(process.argv));')
    ])
    const result = invoke(input)
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr.toString())
    assert.deepEqual(JSON.parse(result.stdout.toString()), [process.execPath])
  })
}
