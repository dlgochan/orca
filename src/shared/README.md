# Shared contracts

Defines data and pure logic shared across desktop, runtime and renderer boundaries.

- `claude-launch-profile.ts`: named profile validation and immutable snapshots.
- `agent-session-resume.ts`, `tui-agent-startup.ts`: terminal startup and recovery contracts.
- `global-settings-types.ts`: persisted settings schema.

Credential storage and enrollment belong to [Claude accounts](../main/claude-accounts/README.md).
