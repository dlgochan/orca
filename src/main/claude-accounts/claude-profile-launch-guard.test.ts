import { describe, expect, it } from 'vitest'
import { assertClaudeProfileLaunchSupported } from './claude-profile-launch-guard'

const profile = { id: 'work', name: 'Claude work', accountId: 'a' }
describe('profile launch boundary', () => {
  it('allows ordinary launches and supported explicit bindings', () => {
    expect(() =>
      assertClaudeProfileLaunchSupported({
        profile: undefined,
        isClaudeLaunch: false,
        hasAuthPreparer: false
      })
    ).not.toThrow()
    expect(() =>
      assertClaudeProfileLaunchSupported({ profile, isClaudeLaunch: true, hasAuthPreparer: true })
    ).not.toThrow()
  })
  it.each([
    { isClaudeLaunch: false, hasAuthPreparer: true },
    { isClaudeLaunch: true, hasAuthPreparer: false }
  ])('refuses an unsupported execution route before spawn', (input) => {
    expect(() => assertClaudeProfileLaunchSupported({ ...input, profile })).toThrow(
      'does not support'
    )
  })
  it('refuses config overrides instead of silently ignoring the selected account', () => {
    expect(() =>
      assertClaudeProfileLaunchSupported({
        profile,
        isClaudeLaunch: true,
        hasAuthPreparer: true,
        env: { CLAUDE_CONFIG_DIR: '/another-account' }
      })
    ).toThrow('override')
  })
})
