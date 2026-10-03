import { Loader2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { ClaudeLaunchProfile } from '../../../../shared/claude-launch-profile'
import { AgentIcon } from '@/lib/agent-catalog'
import { useStructuredAgentLaunchStatus } from '@/lib/structured-agent-session-launch-status'
import { DropdownMenuItem } from '../ui/dropdown-menu'

export function ClaudeProfileMenuItem({
  profile,
  worktreeId,
  email,
  disabled,
  onSelect
}: {
  profile: ClaudeLaunchProfile
  worktreeId: string
  email?: string
  disabled: boolean
  onSelect: () => void
}) {
  const pending = useStructuredAgentLaunchStatus(worktreeId, 'claude', profile) === 'pending'
  return (
    <DropdownMenuItem disabled={disabled || pending} onSelect={onSelect}>
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <AgentIcon agent="claude" size={14} />
      )}
      <span className="flex-1">{profile.name}</span>
      <span className="truncate text-xs text-muted-foreground">
        {email ?? translate('claudeProfiles.unavailable', 'Account unavailable')}
      </span>
    </DropdownMenuItem>
  )
}
