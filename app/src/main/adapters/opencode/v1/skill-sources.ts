import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

export function openCodeSkillDirectories(
  home = homedir(),
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const config = join(env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode')
  return [
    join(config, 'skills'),
    join(config, 'skill'),
    ...(env.OPENCODE_CONFIG_DIR
      ? [join(env.OPENCODE_CONFIG_DIR, 'skills'), join(env.OPENCODE_CONFIG_DIR, 'skill')]
      : [])
  ]
}

export function withinSkillRoot(file: string, root: string): boolean {
  const child = relative(resolve(root), resolve(file))
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

export function isOpenCodeSkill(file: string, directory: string, env: NodeJS.ProcessEnv): boolean {
  const roots = openCodeSkillDirectories(homedir(), env)
  let current = resolve(directory)
  for (;;) {
    roots.push(join(current, '.opencode', 'skills'), join(current, '.opencode', 'skill'))
    const parent = resolve(current, '..')
    if (parent === current) break
    current = parent
  }
  return roots.some((root) => withinSkillRoot(file, root))
}
