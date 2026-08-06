// 스킬 IPC 7종 — 목록·작성·업로드·활성토글·열기·폴더에서 보기·제거 (0179 에서 misc 에서 분리).

import {
  CHANNELS,
  AuthorSkillSchema,
  SetSkillEnabledSchema,
  SkillTargetSchema,
  UploadSkillSchema,
  type SkillInfo
} from '../../../shared/protocol'
import { shell } from 'electron'
import {
  removeOrcaSkillDir,
  writeAuthoredSkill,
  writeUploadedSkill
} from '../../features/extensions/skills/sources'
import { skillEnabledKey } from '../../features/extensions/skills/scan'
import { handle, handlePlain } from '../../infra/ipc/handle'
import type { RouterContext } from '../context'

function findSkill(ctx: RouterContext, sourceId: string, name: string): SkillInfo {
  const skill = ctx.getSkills().find((s) => s.sourceId === sourceId && s.name === name)
  if (!skill) throw new Error(`스킬을 찾을 수 없습니다: ${sourceId}/${name}`)
  return skill
}

export function registerSkillsHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.skillsList, (): SkillInfo[] => ctx.getSkills())

  handle(CHANNELS.skillsAuthor, AuthorSkillSchema, 'reject', async (req): Promise<SkillInfo[]> => {
    await writeAuthoredSkill(req)
    await ctx.deployExtensions()
    return ctx.refreshSkills()
  })

  handle(CHANNELS.skillsUpload, UploadSkillSchema, 'reject', async (req): Promise<SkillInfo[]> => {
    await writeUploadedSkill(req)
    await ctx.deployExtensions()
    return ctx.refreshSkills()
  })

  handle(
    CHANNELS.skillsSetEnabled,
    SetSkillEnabledSchema,
    'reject',
    async (req): Promise<SkillInfo[]> => {
      const skill = findSkill(ctx, req.sourceId, req.name)
      if (!skill.canToggle) return ctx.getSkills()
      const current = ctx.settings.getAll()
      ctx.settings.patch({
        skillEnabled: {
          ...current.skillEnabled,
          [skillEnabledKey(req.sourceId, req.name)]: req.enabled
        }
      })
      // 토글은 파일을 바꾸지 않는다(모든 Orca 스킬은 항상 배포됨) — 활성화는 런타임
      // options.skills 필터가 반영하므로 캐시 갱신만으로 충분(파일 재싱크 불필요).
      return ctx.refreshSkills()
    }
  )

  handle(CHANNELS.skillsOpen, SkillTargetSchema, 'reject', async (req): Promise<void> => {
    await shell.openPath(findSkill(ctx, req.sourceId, req.name).skillPath)
  })

  handle(CHANNELS.skillsShowInFolder, SkillTargetSchema, 'reject', (req): void => {
    shell.showItemInFolder(findSkill(ctx, req.sourceId, req.name).skillPath)
  })

  handle(CHANNELS.skillsRemove, SkillTargetSchema, 'reject', async (req): Promise<SkillInfo[]> => {
    const skill = findSkill(ctx, req.sourceId, req.name)
    if (!skill.canRemove) throw new Error('Orca 스킬만 제거할 수 있습니다.')
    await removeOrcaSkillDir(skill.skillDir)
    const current = ctx.settings.getAll()
    const skillEnabled = { ...current.skillEnabled }
    delete skillEnabled[skillEnabledKey(req.sourceId, req.name)]
    ctx.settings.patch({ skillEnabled })
    await ctx.deployExtensions()
    return ctx.refreshSkills()
  })
}
