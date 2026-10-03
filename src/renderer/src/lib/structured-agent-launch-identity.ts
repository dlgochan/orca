import type { AgentSessionHandleProvider } from '../../../shared/agent-session-provider-handle'
import type { StructuredAgentSessionResumeSource } from '../../../shared/structured-agent-session-create'
import type { ClaudeLaunchProfile } from '../../../shared/claude-launch-profile'

// An account rebind is a different launch; a rename alone can safely join the pending launch.
export function structuredLaunchIdentity(
  worktreeId: string,
  agent: AgentSessionHandleProvider,
  resumeFrom?: StructuredAgentSessionResumeSource,
  claudeProfile?: ClaudeLaunchProfile
): string {
  if (claudeProfile) {
    return JSON.stringify([
      agent,
      worktreeId,
      resumeFrom?.providerSessionId ?? null,
      claudeProfile.id,
      claudeProfile.accountId
    ])
  }
  return resumeFrom
    ? `${agent}:${worktreeId}:resume:${resumeFrom.providerSessionId}`
    : `${agent}:${worktreeId}`
}
