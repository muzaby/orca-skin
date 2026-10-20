import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SkillScanRoot } from './scan'

export function agentsSkillRoot(
  home = homedir(),
  env: NodeJS.ProcessEnv = process.env
): SkillScanRoot {
  return {
    sourceId: 'agents',
    sourceLabel: '~/.agents/skills',
    sourceKind: 'workspace',
    rootDir: join(home, '.agents', 'skills'),
    lockFile: env.XDG_STATE_HOME
      ? join(env.XDG_STATE_HOME, 'skills', '.skill-lock.json')
      : join(home, '.agents', '.skill-lock.json')
  }
}
