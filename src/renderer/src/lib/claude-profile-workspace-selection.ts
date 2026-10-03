import { captureClaudeLaunchProfile } from '../../../shared/claude-launch-profile'
import type { useAppStore } from '@/store'
import { isPairedWebClientWindow } from './desktop-window-chrome'
import { getRuntimeEnvironmentIdForWorktree } from './worktree-runtime-owner'
import { getConnectionIdFromState } from './connection-context'
import type { TuiAgent } from '../../../shared/tui-agent'

export function resolveClaudeProfileForWorkspace(
  store: ReturnType<typeof useAppStore.getState>,
  args: { agent: TuiAgent; worktreeId: string; claudeProfileId?: string }
) {
  if (!args.claudeProfileId) {
    return undefined
  }
  if (
    args.agent !== 'claude' ||
    getConnectionIdFromState(store, args.worktreeId) ||
    isPairedWebClientWindow() ||
    getRuntimeEnvironmentIdForWorktree(store, args.worktreeId)
  ) {
    throw new Error('Claude profiles currently require a local Claude workspace.')
  }
  return captureClaudeLaunchProfile(
    store.settings?.claudeLaunchProfiles ?? [],
    args.claudeProfileId
  )
}
