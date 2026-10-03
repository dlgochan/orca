import { describe, expect, it } from 'vitest'
import { structuredLaunchIdentity } from './structured-agent-session-launch-registry'
import { structuredAgentSessionCreateParams } from '../../../shared/structured-agent-session-create'

describe('profile-specific structured launch identity', () => {
  const a = { id: 'work', name: 'Work Claude', accountId: 'a' }
  const b = { id: 'personal', name: 'Personal Claude', accountId: 'b' }
  it('does not join simultaneous launches for different profiles or rebound accounts', () => {
    const key = structuredLaunchIdentity('folder:workspace', 'claude', undefined, a)
    expect(key).not.toBe(structuredLaunchIdentity('folder:workspace', 'claude', undefined, b))
    expect(key).not.toBe(
      structuredLaunchIdentity('folder:workspace', 'claude', undefined, { ...a, accountId: 'b' })
    )
    expect(key).not.toBe(structuredLaunchIdentity('folder:workspace', 'claude'))
  })
  it('captures the account in a retryable create request with a host-verifiable fingerprint', () => {
    const input = {
      sessionId: 'claude_session1',
      worktree: 'folder:workspace',
      agent: 'claude' as const,
      now: 1_800_000_000_000,
      randomUuid: () => '00000000-0000-4000-8000-000000000001'
    }
    const first = structuredAgentSessionCreateParams({ ...input, claudeProfile: a })
    expect(first.envelope.payloadFingerprint).not.toBe(
      structuredAgentSessionCreateParams({ ...input, claudeProfile: b }).envelope.payloadFingerprint
    )
    expect(first.claudeProfile).not.toBe(a)
  })
})
