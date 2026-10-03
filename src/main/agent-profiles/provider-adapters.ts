// Provider account ownership stays with injected runtime services.
import { CLAUDE_AUTH_ENV_VARS } from '../claude-accounts/environment'
import type { ProfileAgent, ProfileIdentity } from '../../shared/agent-launch-profile'

export type ProfilePreparationOptions = { resume: boolean; mode: 'terminal' | 'structured' }
export type ManagedProfileObservation = { home: string; identity: ProfileIdentity }
export type ManagedProfilePreparation = {
  home: string
  envPatch: Record<string, string>
  envToDelete: string[]
  release: () => void
}
export type ManagedProfileCallbacks = {
  inspectManaged: (accountId: string) => Promise<ManagedProfileObservation>
  prepareManaged: (
    accountId: string,
    options: ProfilePreparationOptions
  ) => Promise<ManagedProfilePreparation>
}
export type ProfileProviderAdapter = ManagedProfileCallbacks & {
  agent: ProfileAgent
  homeVariable: string
  defaultDirectory: string
  authVariables: readonly string[]
}

export function createClaudeProfileAdapter(
  callbacks: ManagedProfileCallbacks
): ProfileProviderAdapter {
  return {
    ...callbacks,
    agent: 'claude',
    homeVariable: 'CLAUDE_CONFIG_DIR',
    defaultDirectory: '.claude',
    authVariables: [...CLAUDE_AUTH_ENV_VARS, 'ANTHROPIC_CUSTOM_HEADERS']
  }
}
export function createCodexProfileAdapter(
  callbacks: ManagedProfileCallbacks
): ProfileProviderAdapter {
  return {
    ...callbacks,
    agent: 'codex',
    homeVariable: 'CODEX_HOME',
    defaultDirectory: '.codex',
    authVariables: ['OPENAI_API_KEY', 'CODEX_API_KEY']
  }
}
