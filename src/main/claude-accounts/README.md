# Claude accounts

Owns Claude account registration, credential storage, and launch authentication.

- `service.ts`, `claude-account-registration.ts`, `claude-account-selection.ts`: account lifecycle.
- `runtime-auth-service.ts` and `runtime-auth/`: default-account synchronization and explicit profile preparation.
- `isolated-account-auth.ts`: enrollment and canonical CLI credentials for profile-bound accounts.
- `account-credential-mutation.ts`: serializes enrollment, reauthentication, and usage polling for each account.
- `managed-auth-path.ts`, `keychain.ts`: owned files and platform credential storage.

Profile names and account bindings are defined in `../../shared/claude-launch-profile.ts`.
Usage polling in `../rate-limits/` shares the credential authority defined here.
