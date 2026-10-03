// Sanitizes provider-owned launch authority checks at the common service boundary.
import type { PreparedAgentProfile, ProfileConnectionDependencies } from './connection-contracts'
import { sanitizedProfilePreparationError } from './preparation-error'
export type ProfileLaunchContext = { cwd: string; env: NodeJS.ProcessEnv }
export async function validatePreparedProfileLaunch(
  adapters: ProfileConnectionDependencies['adapters'],
  prepared: PreparedAgentProfile,
  context: ProfileLaunchContext
): Promise<void> {
  if (prepared.snapshot.binding.kind === 'external') {
    return
  }
  const validate = adapters[prepared.snapshot.agent].validateLaunch
  if (prepared.snapshot.agent === 'codex' && !validate) {
    throw new Error('Managed Codex launch authority inspection is unavailable.')
  }
  try {
    await validate?.(prepared.snapshot, context)
  } catch (error) {
    throw sanitizedProfilePreparationError(
      error,
      'Managed profile launch authority could not be verified.'
    )
  }
}
