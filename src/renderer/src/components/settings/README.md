# Settings components

Renders Orca settings using the [design system](../../../../../docs/STYLEGUIDE.md).

- `SettingsFormControls.tsx`: shared setting rows and controls.
- `AgentsPane.tsx`, `AgentCatalogRow.tsx`: agent availability and launch preferences.
- `ClaudeLaunchProfiles.tsx`: named Claude account bindings; registration stays in `AccountsPane.tsx`.
- `agents-search.ts`: agent settings search terms.

Settings types live in `../../../../shared/global-settings-types.ts`; launch actions live in `../../lib/`.
