import { describe, expect, it } from 'vitest'
import { buildAgentStartupPlan } from './tui-agent-startup'
import { buildAgentResumeStartupPlan } from './tui-agent-resume-startup'
import { sleepingAgentLaunchConfigSchema } from './workspace-session-sleeping-agents'

describe('Claude profile launch snapshots', () => {
  it('refuses malformed profile state rather than discarding it and resuming with the default account', () => {
    expect(
      sleepingAgentLaunchConfigSchema.safeParse({
        agentArgs: '',
        agentEnv: {},
        claudeProfile: { id: 'broken' }
      }).success
    ).toBe(false)
  })
  it('retains account identity through startup, persistence, and resume', () => {
    const profile = { id: 'work', name: 'Claude work', accountId: 'account-a' }
    const startup = buildAgentStartupPlan({
      agent: 'claude',
      prompt: '',
      allowEmptyPromptLaunch: true,
      platform: 'linux',
      cmdOverrides: {},
      claudeProfile: profile
    })
    expect(startup?.launchConfig.claudeProfile).toEqual(profile)
    profile.accountId = 'account-b'
    const restored = sleepingAgentLaunchConfigSchema.parse(startup?.launchConfig)
    const resume = buildAgentResumeStartupPlan({
      ...restored,
      agent: 'claude',
      providerSession: { key: 'session_id', id: 'conversation-a' },
      platform: 'linux',
      cmdOverrides: {}
    })
    expect(resume?.launchConfig.claudeProfile?.accountId).toBe('account-a')
  })
})
