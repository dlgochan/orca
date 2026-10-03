// Host-owned launch bindings; copying the binding prevents later edits from rebinding a session.
import { parseExecutionHostId, type ExecutionHostId } from './execution-host'
import { isWindowsAbsolutePathLike } from './cross-platform-path'
import { validateAgentLaunchProfileName } from './agent-launch-profile-name'
export { validateAgentLaunchProfileName }

export type ProfileAgent = 'claude' | 'codex'
export type ProfileBinding =
  | { kind: 'managed'; accountId: string }
  | { kind: 'external'; home: string }
export type AgentLaunchProfile = {
  id: string
  name: string
  agent: ProfileAgent
  hostId: ExecutionHostId
  executable: string
  binding: ProfileBinding
}

export type ProfileIdentity =
  | { kind: 'verified'; subject: string; displayName: string }
  | { kind: 'unverified'; reason: string }

export type AgentProfileSnapshot = AgentLaunchProfile & {
  resolvedHome: string
  identity: ProfileIdentity
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

function isAbsoluteProfilePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 4096 &&
    ![...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) &&
    (value.startsWith('/') || isWindowsAbsolutePathLike(value))
  )
}

export function isAgentLaunchProfile(value: unknown): value is AgentLaunchProfile {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    validateAgentLaunchProfileName(value.name, []) !== null ||
    !('agent' in value) ||
    (value.agent !== 'claude' && value.agent !== 'codex') ||
    !('hostId' in value) ||
    typeof value.hostId !== 'string' ||
    parseExecutionHostId(value.hostId)?.id !== value.hostId ||
    !('executable' in value) ||
    !isAbsoluteProfilePath(value.executable) ||
    !('binding' in value) ||
    typeof value.binding !== 'object' ||
    value.binding === null
  ) {
    return false
  }
  const binding = value.binding
  if (!('kind' in binding)) {
    return false
  }
  if (binding.kind === 'managed') {
    return (
      !('home' in binding) &&
      'accountId' in binding &&
      typeof binding.accountId === 'string' &&
      ID_PATTERN.test(binding.accountId)
    )
  }
  return (
    binding.kind === 'external' &&
    !('accountId' in binding) &&
    'home' in binding &&
    isAbsoluteProfilePath(binding.home)
  )
}

export function normalizeAgentLaunchProfiles(value: unknown): AgentLaunchProfile[] {
  if (!Array.isArray(value)) {
    return []
  }
  const profiles: AgentLaunchProfile[] = []
  for (const candidate of value) {
    if (
      !isAgentLaunchProfile(candidate) ||
      profiles.some((profile) => profile.id === candidate.id) ||
      validateAgentLaunchProfileName(candidate.name, profiles) !== null
    ) {
      continue
    }
    profiles.push({
      id: candidate.id,
      name: candidate.name.trim(),
      agent: candidate.agent,
      hostId: candidate.hostId,
      executable: candidate.executable,
      binding:
        candidate.binding.kind === 'managed'
          ? { kind: 'managed', accountId: candidate.binding.accountId }
          : { kind: 'external', home: candidate.binding.home }
    })
    if (profiles.length === 32) {
      break
    }
  }
  return profiles
}

export function captureAgentLaunchProfile(
  profiles: readonly AgentLaunchProfile[],
  id: string
): AgentLaunchProfile {
  const profile = profiles.find((candidate) => candidate.id === id)
  if (!isAgentLaunchProfile(profile)) {
    throw new Error(
      'That agent profile no longer exists. Choose another profile in Agent settings.'
    )
  }
  return { ...profile, binding: { ...profile.binding } }
}
