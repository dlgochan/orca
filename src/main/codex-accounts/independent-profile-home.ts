// Independent launches materialize resources without touching shared credential provenance.
import { lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CodexManagedAccount } from '../../shared/managed-account-types'
import { CodexAccountIdentity } from './codex-account-identity'
import { codexAuthMatchesManagedAccount } from './codex-auth-identity'
import { hasStoredCodexCredential } from './managed-codex-auth-readiness'

export function readManagedCodexProfileIdentity(home: string, account: CodexManagedAccount) {
  const authPath = join(home, 'auth.json')
  if (!lstatSync(authPath).isFile() || !hasStoredCodexCredential(authPath)) {
    throw new Error('Managed Codex credential is unavailable. Reconnect the account.')
  }
  const identity = new CodexAccountIdentity(() => home).readFromHome(home, account.id)
  if (
    !identity.email ||
    !codexAuthMatchesManagedAccount(readFileSync(authPath, 'utf8'), account, null)
  ) {
    throw new Error('Managed Codex identity changed or cannot be verified. Reconnect the account.')
  }
  return identity
}
