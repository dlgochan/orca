# Codex accounts

Owns managed Codex registration, credential-home ownership and runtime account routing.

- `service.ts`, `codex-account-registration.ts`, `codex-account-selection.ts`: account lifecycle; `add({ activate: false })` enrolls without changing selection.
- `runtime-home-service.ts` and `runtime-home-service-*.ts`: default-account synchronization, legacy migration and launch preparation.
- `independent-profile-home.ts`, `profile-config-authority.ts`: credential readiness, identity and configuration authority checks for the account-owned credentials used by independent profiles.
- `host-codex-managed-home-ownership.ts`, `codex-managed-home-*.ts`: owned home validation and lifecycle.
- `codex-account-identity.ts`, `codex-auth-identity.ts`: provider identity interpretation.

`prepareForCodexProfileLaunch(accountId)` uses the read-only inactive-account ownership gate and
existing resource/config mirrors. It preserves selected account and shared auth provenance; the
CLI refreshes credentials in its own account home. Runtime consumers compose this through
[agent profiles](../agent-profiles/README.md). Resource and config mirroring live in `../codex/`.

Managed profiles accept the default/file CLI credential store and direct OpenAI OAuth configuration.
Conflicting provider, selected config profile, login method or credential-store settings are refused
before resource/config mirroring; external profile configuration remains user-owned.
