// Register a committed process before fallible UI/persistence work can release its pending lease.
import type { PreparedAgentProfile } from '../../../agent-profiles/connection-service'
import { markClaudePtySpawned } from '../../../claude-accounts/live-pty-gate'
import { recordCodexPaneAccount } from '../../../codex/codex-pane-account-registry'
export function commitAgentProfilePtyOwnership(
  prepared: PreparedAgentProfile | undefined,
  result: { id: string; isReattach?: boolean }
): void {
  if (!prepared || result.isReattach) {
    return
  }
  const snapshot = prepared.snapshot
  if (snapshot.agent === 'claude') {
    if (snapshot.binding.kind === 'managed') {
      markClaudePtySpawned(result.id, true)
    }
  } else {
    recordCodexPaneAccount(result.id, {
      selectionKey: 'host',
      accountId: snapshot.binding.kind === 'managed' ? snapshot.binding.accountId : null,
      homeRoute: snapshot.binding.kind === 'managed' ? 'account-home' : 'custom-home',
      profileBound: true
    })
  }
}
