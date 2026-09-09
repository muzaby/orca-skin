import { writeFileSync } from 'node:fs'

if (process.env.ORCA_PROBE_MARKER) writeFileSync(process.env.ORCA_PROBE_MARKER, 'started')
const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
process.stdout.write(
  JSON.stringify({
    args: process.argv.slice(2),
    cwd: process.cwd(),
    stdin: Buffer.concat(chunks).toString('base64'),
    key: process.env.ORCA_FAKE_KEY,
    inherited: process.env.ORCA_INHERITED,
    proxy: process.env.HTTP_PROXY
  })
)
process.stderr.write('probe-stderr\r\n')
process.exitCode = Number(process.env.ORCA_PROBE_EXIT ?? 0)
