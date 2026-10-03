# Shared contracts

Defines data and pure logic shared across desktop, runtime and renderer boundaries.

- `agent-launch-profile.ts`: host-owned Claude/Codex bindings, normalization and session snapshot contracts.
- `agent-launch-profile-name.ts`: shared profile name validation.
- `claude-launch-profile.ts`: prototype Claude profile contracts.
- `agent-session-resume.ts`, `tui-agent-startup.ts`: terminal startup and recovery contracts.
- `global-settings-types.ts`: persisted settings schema.

Credential storage and enrollment belong to [Claude accounts](../main/claude-accounts/README.md).
