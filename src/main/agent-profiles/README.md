# Agent profile connections

Host service for previewing, registering and acquiring Claude/Codex launch bindings.

- `connection-contracts.ts`: host dependency and public operation contracts.
- `connection-service.ts`: guarded preview, serialized save/unlink and snapshot acquisition.
- `provider-adapters.ts`: provider metadata and typed managed-account callback contracts.
- `host-discovery.ts`: detected CLI resolution and bounded conventional alias-file reading.
- `*.test.ts`: synthetic filesystem and provider ownership regressions.

Discovery uses [agent-profile-discovery](../agent-profile-discovery/README.md); persisted profiles
and immutable session bindings use `../../shared/agent-launch-profile.ts`. Inject host context
from the execution host, and a settings store that persists `agentLaunchProfiles`. Route every
profile mutation through one service instance to preserve write ordering.

Managed callbacks must inspect the requested account's existing owned home without changing global
selection, then acquire provider-owned preparation with a release handle. Claude composition belongs
to its runtime auth service. Codex composition needs independent profile preparation: the existing
self-contained managed-home preparation changes global selection and is unsuitable here.

External inspection defaults to unverified. An injected inspector must be read-only, return only
provider identity metadata, and use fixed provider status arguments through the shared process API
with a 5-second timeout and 64-KiB output bound. The common service neither reads tokens nor invokes
provider programs. Command connections require an explicit home assignment; bare CLI names and
absolute executable paths require folder selection because shell state can override the home.
Unverified identity permits fresh terminal acquisition only. A snapshot captured without verified
identity stays ineligible for resume or structured acquisition even if a later observation becomes
verified.

The launch caller applies `envToDelete` and `envPatch` at actual CLI execution **after shell startup**,
rejects conflicting explicit authentication overrides, and owns `release` until process creation or
cancellation. Preserve the returned snapshot in the session; prepare that snapshot for resume rather
than looking up the current launcher. Identity inspection is a preflight observation, so another
terminal can still change credentials after acquisition.
