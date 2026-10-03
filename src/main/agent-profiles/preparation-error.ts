// Only fixed public reasons cross provider callback boundaries; arbitrary errors stay sanitized.
const REASONS = {
  codex_config:
    'Managed Codex profiles require direct OpenAI OAuth and file credentials. Remove provider, endpoint, or credential-store overrides, or connect this home as an external profile.',
  codex_policy:
    'Orca cannot verify managed Codex authentication under this enterprise policy. Use an external profile or a host with verifiable local configuration.'
} as const
export class AgentProfilePreparationError extends Error {
  constructor(readonly code: keyof typeof REASONS) {
    super(REASONS[code])
  }
}
export function sanitizedProfilePreparationError(error: unknown, fallback: string): Error {
  return error instanceof AgentProfilePreparationError
    ? new AgentProfilePreparationError(error.code)
    : new Error(fallback)
}
