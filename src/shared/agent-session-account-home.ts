// Validates the immutable account home carried by a durable structured conversation.
import { isAgentProfileSnapshot, type AgentProfileSnapshot } from './agent-launch-profile'
import { isClaudeLaunchProfile, type ClaudeLaunchProfile } from './claude-launch-profile'
/** Account root pinned at launch by the account selector, so a resume cannot drift to another login. */
export type AgentSessionAccountHome = {
  agentProfile?: AgentProfileSnapshot
  claudeAccountId?: string
  claudeProfile?: ClaudeLaunchProfile
  variable: 'CLAUDE_CONFIG_DIR' | 'CODEX_HOME'
  /** Host-resolved absolute path in the execution host's own path syntax. */
  path: string
}

const MAX_ID_LENGTH = 512
const MAX_PATH_LENGTH = 4096
function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

export function isAgentSessionAccountHome(value: unknown): value is AgentSessionAccountHome {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: every admitted field is checked below before the object is exposed as an account home.
  const home = value as Partial<AgentSessionAccountHome>
  return (
    (home.variable === 'CLAUDE_CONFIG_DIR' || home.variable === 'CODEX_HOME') &&
    (home.claudeAccountId === undefined ||
      (home.variable === 'CLAUDE_CONFIG_DIR' &&
        isBoundedString(home.claudeAccountId, MAX_ID_LENGTH))) &&
    (home.claudeProfile === undefined ||
      (home.variable === 'CLAUDE_CONFIG_DIR' && isClaudeLaunchProfile(home.claudeProfile))) &&
    (home.agentProfile === undefined ||
      (isAgentProfileSnapshot(home.agentProfile) &&
        home.agentProfile.identity.kind === 'verified' &&
        home.agentProfile.resolvedHome === home.path &&
        home.variable ===
          (home.agentProfile.agent === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME') &&
        home.claudeProfile === undefined &&
        home.claudeAccountId === undefined)) &&
    isBoundedString(home.path, MAX_PATH_LENGTH)
  )
}
