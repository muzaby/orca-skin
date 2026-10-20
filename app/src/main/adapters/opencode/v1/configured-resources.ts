import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { isRecord } from '../../../../shared/obj'

/** Read JSONC without interpreting variables or returning credentials to the renderer. */
function parseConfig(text: string): unknown {
  const stringsOrComments = /"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g
  const uncommented = text.replace(stringsOrComments, (token) =>
    token.startsWith('"') ? token : token.replace(/[^\r\n]/g, ' ')
  )
  return JSON.parse(
    uncommented
      .replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/g, (token) => (token.startsWith('"') ? token : ''))
      .replace(/^\uFEFF/, '')
  )
}

/** Resolve only a file that actually declares this server; never invent a default path. */
export async function configuredOpenCodeMcpFile(
  cwd: string,
  id: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | undefined> {
  const globalRoot = join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode')
  const lineage: string[] = []
  let current = resolve(cwd)
  for (;;) {
    lineage.unshift(current)
    try {
      await stat(join(current, '.git'))
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  const at = (root: string): string[] => [join(root, 'opencode.json'), join(root, 'opencode.jsonc')]
  const files = [
    ...at(globalRoot),
    ...(env.OPENCODE_CONFIG ? [resolve(cwd, env.OPENCODE_CONFIG)] : []),
    ...(env.OPENCODE_DISABLE_PROJECT_CONFIG === 'true' ? [] : lineage.flatMap(at)),
    ...lineage.flatMap((root) => at(join(root, '.opencode'))),
    ...(env.OPENCODE_CONFIG_DIR ? at(resolve(cwd, env.OPENCODE_CONFIG_DIR)) : []),
    ...(process.platform === 'win32' && env.ProgramData
      ? at(join(env.ProgramData, 'opencode'))
      : [])
  ]
  let selected: string | undefined
  for (const file of files) {
    try {
      const config = parseConfig(await readFile(file, 'utf8'))
      if (isRecord(config) && isRecord(config.mcp) && Object.hasOwn(config.mcp, id)) selected = file
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('OpenCode MCP 설정 파일을 확인할 수 없습니다.')
    }
  }
  return selected
}
