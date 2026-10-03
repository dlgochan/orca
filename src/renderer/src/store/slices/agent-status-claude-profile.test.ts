import { describe, expect, it } from 'vitest'
import { createTestStore, makeTab } from './store-test-helpers'
import { collectSleepingAgentSessionRecordsForWorktree } from './agent-status'
import { launchConfigsEqual } from './agent-status-recovery-equivalence'
import { buildAgentResumeStartupPlan } from '../../../../shared/tui-agent-resume-startup'

describe('Claude profile recovery ownership', () => {
  it('captures the original binding through registration, sleep, quit and resume', () => {
    const store = createTestStore()
    store.setState({ tabsByWorktree: { 'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })] } })
    const profile = { id: 'work', name: 'Claude work', accountId: 'a' }
    store.getState().registerAgentLaunchConfig(
      'tab-1:leaf-1',
      {
        agentArgs: '',
        agentEnv: {},
        claudeProfile: profile
      },
      { agentType: 'claude', launchToken: 'launch-1', tabId: 'tab-1', leafId: 'leaf-1' }
    )
    profile.accountId = 'b'
    store.getState().setAgentStatus(
      'tab-1:leaf-1',
      {
        state: 'working',
        prompt: '',
        agentType: 'claude'
      },
      'Claude work',
      { updatedAt: 10, stateStartedAt: 10 },
      { tabId: 'tab-1', worktreeId: 'wt-1' },
      {
        providerSession: { key: 'session_id', id: 'conversation-a' },
        launchToken: 'launch-1'
      }
    )
    const sleeping = collectSleepingAgentSessionRecordsForWorktree(store.getState(), 'wt-1')[
      'tab-1:leaf-1'
    ]
    expect(sleeping.launchConfig?.claudeProfile?.accountId).toBe('a')
    store.getState().captureAllSleepingAgentSessions('quit')
    const saved = store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']
    const resume = buildAgentResumeStartupPlan({
      ...saved.launchConfig,
      agent: 'claude',
      providerSession: saved.providerSession,
      platform: 'linux',
      cmdOverrides: {}
    })
    expect(resume?.launchConfig.claudeProfile?.accountId).toBe('a')
    expect(
      launchConfigsEqual(saved.launchConfig, { ...saved.launchConfig!, claudeProfile: profile })
    ).toBe(false)
  })
})
