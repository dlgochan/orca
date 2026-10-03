# Renderer libraries

Connects UI actions to workspace ownership and desktop/runtime APIs.

- `launch-agent-in-new-tab.ts`: workspace agent launch orchestration.
- `claude-profile-workspace-selection.ts`: resolves local profile snapshots.
- `claude-profile-structured-identity.ts`: distinguishes pending profile launches.

Persisted contracts live in [shared](../../../shared/README.md); application state belongs to [store slices](../store/slices/README.md).
