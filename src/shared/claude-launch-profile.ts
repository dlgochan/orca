import { validateAgentLaunchProfileName as validateClaudeLaunchProfileName } from './agent-launch-profile-name'
export { validateClaudeLaunchProfileName }

/** Named account bindings; sessions retain a copy so later edits cannot change their identity. */
export type ClaudeLaunchProfile = {
  id: string
  name: string
  accountId: string
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export function isClaudeLaunchProfile(value: unknown): value is ClaudeLaunchProfile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    ID_PATTERN.test(value.id) &&
    'accountId' in value &&
    typeof value.accountId === 'string' &&
    ID_PATTERN.test(value.accountId) &&
    'name' in value &&
    typeof value.name === 'string' &&
    validateClaudeLaunchProfileName(value.name, []) === null
  )
}

export function normalizeClaudeLaunchProfiles(value: unknown): ClaudeLaunchProfile[] {
  if (!Array.isArray(value)) {
    return []
  }
  const profiles: ClaudeLaunchProfile[] = []
  for (const candidate of value) {
    if (
      !isClaudeLaunchProfile(candidate) ||
      profiles.some((profile) => profile.id === candidate.id)
    ) {
      continue
    }
    if (validateClaudeLaunchProfileName(candidate.name, profiles)) {
      continue
    }
    profiles.push({ id: candidate.id, name: candidate.name.trim(), accountId: candidate.accountId })
    if (profiles.length === 32) {
      break
    }
  }
  return profiles
}

export function captureClaudeLaunchProfile(
  profiles: readonly ClaudeLaunchProfile[],
  profileId: string
): ClaudeLaunchProfile {
  const profile = profiles.find((candidate) => candidate.id === profileId)
  if (!profile || !isClaudeLaunchProfile(profile)) {
    throw new Error(
      'That Claude profile no longer exists. Choose another profile in Agent settings.'
    )
  }
  return { ...profile }
}
