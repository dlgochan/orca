// Account deletion follows durable launcher references; unlink owns only the launcher record.
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { ProfileAgent } from '../../shared/agent-launch-profile'
export function assertAccountHasNoAgentProfiles(
  settings: Pick<GlobalSettings, 'agentLaunchProfiles'>,
  agent: ProfileAgent,
  accountId: string
): void {
  if (
    settings.agentLaunchProfiles?.some(
      (profile) =>
        profile.agent === agent &&
        profile.binding.kind === 'managed' &&
        profile.binding.accountId === accountId
    )
  ) {
    throw new Error(
      'Unlink this account’s agent profiles in Agent settings before removing the account.'
    )
  }
}
