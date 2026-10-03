import type {
  AgentLaunchProfile,
  AgentProfileSnapshot,
  ProfileAgent,
  ProfileBinding,
  ProfileIdentity
} from '../../shared/agent-launch-profile'
import type { ProfileAliasSource } from '../agent-profile-discovery/literal-alias'
import type { ProfileHostContext } from './host-discovery'
import type { ProfileProviderAdapter } from './provider-adapters'

export type AgentProfileConnectionInput = {
  agent: ProfileAgent
  source: { kind: 'home' | 'command'; value: string } | { kind: 'managed'; accountId: string }
}
export type AgentProfileCandidate = {
  agent: ProfileAgent
  hostId: ProfileHostContext['hostId']
  executable: string
  binding: ProfileBinding
  resolvedHome: string
  identity: ProfileIdentity
}
export type PreparedAgentProfile = {
  snapshot: AgentProfileSnapshot
  envPatch: Record<string, string>
  envToDelete: string[]
  release: () => void
}
export type ProfileConnectionDependencies = {
  host: ProfileHostContext
  adapters: Record<ProfileAgent, ProfileProviderAdapter>
  store: {
    read: () => readonly AgentLaunchProfile[] | Promise<readonly AgentLaunchProfile[]>
    write: (profiles: AgentLaunchProfile[]) => Promise<void>
  }
  detectExecutable?: (agent: ProfileAgent) => Promise<string>
  readAliases?: () => Promise<ProfileAliasSource[]>
  inspectExternal?: (
    agent: ProfileAgent,
    executable: string,
    home: string
  ) => Promise<ProfileIdentity>
}
