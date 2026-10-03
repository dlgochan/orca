import { useSyncExternalStore } from 'react'
import type { AgentSessionHandleProvider } from '../../../shared/agent-session-provider-handle'
import type { ClaudeLaunchProfile } from '../../../shared/claude-launch-profile'
import {
  getStructuredAgentLaunchStatus,
  subscribeStructuredAgentLaunchStatus
} from './structured-agent-session-launch-registry'

export function useStructuredAgentLaunchStatus(
  worktreeId: string,
  agent: AgentSessionHandleProvider,
  profile?: ClaudeLaunchProfile
): ReturnType<typeof getStructuredAgentLaunchStatus> {
  return useSyncExternalStore(
    subscribeStructuredAgentLaunchStatus,
    () => getStructuredAgentLaunchStatus(worktreeId, agent, profile),
    () => 'idle'
  )
}
