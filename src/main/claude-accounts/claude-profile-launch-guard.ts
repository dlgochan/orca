// A missing profile transport must fail before a process can inherit the default account.
import { isClaudeLaunchProfile } from '../../shared/claude-launch-profile'
import { assertClaudeProfileEnvironment } from './claude-profile-environment'

export function assertClaudeProfileLaunchSupported(args: {
  profile: unknown
  isClaudeLaunch: boolean
  hasAuthPreparer: boolean
  env?: Record<string, string>
}): void {
  if (args.profile === undefined) {
    return
  }
  if (!isClaudeLaunchProfile(args.profile)) {
    throw new Error('Invalid Claude launch profile.')
  }
  if (!args.isClaudeLaunch || !args.hasAuthPreparer) {
    throw new Error(
      'Claude profiles require a local Claude launch. This execution target does not support profiles.'
    )
  }
  assertClaudeProfileEnvironment(args.env)
}
