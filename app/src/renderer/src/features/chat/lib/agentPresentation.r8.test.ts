import { describe, expect, it } from 'vitest'
import { agentPresentation, agentUiPolicy } from './agentPresentation'

describe('agent UI policy', () => {
  it('defines Work and Code as complete, explicit static presentations', () => {
    expect(Object.keys(agentPresentation)).toEqual(['work', 'code'])
    expect(agentPresentation.work).toMatchObject({
      icon: 'todo',
      navIcon: 'checklist',
      label: 'chat.agent.work',
      composer: { showGitRow: false, showLandingCwdControls: false },
      transcript: {
        turnProjection: 'work-activity',
        inlineSubagentDetail: true,
        showTaskAgentLabel: false,
        planBodyPlacement: 'approval-card',
        remountTranscriptBySession: true
      }
    })
    expect(agentPresentation.code).toMatchObject({
      icon: 'terminal',
      navIcon: 'terminal2',
      label: 'chat.agent.code',
      composer: { showGitRow: true, showLandingCwdControls: true },
      transcript: {
        turnProjection: 'standard',
        inlineSubagentDetail: false,
        showTaskAgentLabel: true,
        planBodyPlacement: 'right-panel',
        remountTranscriptBySession: false
      }
    })
  })

  it('returns the module-static policy object for each kind', () => {
    expect(agentUiPolicy('work')).toBe(agentPresentation.work)
    expect(agentUiPolicy('code')).toBe(agentPresentation.code)
  })
})
