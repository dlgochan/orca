// Resolves profile bindings on their execution host without acquiring external credentials.
import { access, constants, realpath, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import {
  isAgentLaunchProfile,
  validateAgentLaunchProfileName,
  type AgentLaunchProfile,
  type AgentProfileSnapshot,
  type ProfileAgent,
  type ProfileBinding,
  type ProfileIdentity
} from '../../shared/agent-launch-profile'
import { parseProfileCommand } from '../agent-profile-discovery/command'
import { discoverLiteralProfileAlias } from '../agent-profile-discovery/literal-alias'
import { validateExternalProfileHome } from '../agent-profile-discovery/existing-home'
import { createProfileExecutableDetector, readConventionalProfileAliases } from './host-discovery'
import type { ProfilePreparationOptions } from './provider-adapters'

import type {
  AgentProfileConnectionInput,
  AgentProfileCandidate,
  PreparedAgentProfile,
  ProfileConnectionDependencies
} from './connection-contracts'
export type {
  AgentProfileConnectionInput,
  AgentProfileCandidate,
  PreparedAgentProfile,
  ProfileConnectionDependencies
} from './connection-contracts'

export class AgentProfileConnectionService {
  private mutations: Promise<unknown> = Promise.resolve()
  constructor(private readonly dependencies: ProfileConnectionDependencies) {}

  private guard(): void {
    const host = this.dependencies.host
    if (host.hostId !== 'local' || host.isWsl || !['darwin', 'linux'].includes(host.platform)) {
      throw new Error('Profiles are supported on local macOS/Linux hosts only.')
    }
  }
  private async executable(agent: ProfileAgent): Promise<{ detected: string; canonical: string }> {
    const detected = await (
      this.dependencies.detectExecutable ?? createProfileExecutableDetector(this.dependencies.host)
    )(agent)
    if (!isAbsolute(detected)) {
      throw new Error('Supported agent executable was not detected. Install the agent first.')
    }
    try {
      const canonical = await realpath(detected)
      if (!(await stat(canonical)).isFile()) {
        throw new Error('not a file')
      }
      await access(canonical, constants.X_OK)
      return { detected, canonical }
    } catch {
      throw new Error('Detected agent executable is unavailable.')
    }
  }
  private async home(path: string): Promise<string> {
    const validated = await validateExternalProfileHome(path)
    if (!validated.ok) {
      throw new Error('Configuration home is unavailable or invalid. Choose an existing folder.')
    }
    return validated.home
  }
  async preview(input: AgentProfileConnectionInput): Promise<AgentProfileCandidate> {
    this.guard()
    const adapter = this.dependencies.adapters[input.agent]
    if (!adapter || adapter.agent !== input.agent) {
      throw new Error('Unsupported profile agent.')
    }
    const { detected, canonical: executable } = await this.executable(input.agent)
    let binding: ProfileBinding
    let resolvedHome: string
    let identity: ProfileIdentity
    if (input.source.kind === 'managed') {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.source.accountId)) {
        throw new Error('Invalid managed account reference.')
      }
      const observed = await adapter.inspectManaged(input.source.accountId).catch(() => {
        throw new Error('Managed account inspection failed.')
      })
      resolvedHome = await this.home(observed.home)
      identity = this.identityMetadata(observed.identity)
      binding = { kind: 'managed', accountId: input.source.accountId }
    } else {
      const host = this.dependencies.host
      let path = input.source.value
      if (input.source.kind === 'command') {
        const context = {
          commandName: input.agent,
          executable: detected,
          homeVariable: adapter.homeVariable,
          hostHome: host.home,
          platform: host.platform
        }
        const isAliasName = /^[A-Za-z0-9_.-]{1,128}$/.test(path)
        const sources = isAliasName
          ? await (this.dependencies.readAliases ?? (() => readConventionalProfileAliases(host)))()
          : []
        const discover = (trustedExecutable: string) => {
          const trustedContext = { ...context, executable: trustedExecutable }
          return isAliasName
            ? discoverLiteralProfileAlias(path, sources, trustedContext)
            : parseProfileCommand(path, trustedContext)
        }
        let parsed = discover(detected)
        if (parsed.kind !== 'resolved' && detected !== executable) {
          parsed = discover(executable)
        }
        if (parsed.kind !== 'resolved') {
          throw new Error('Command cannot be safely resolved. Choose a configuration folder.')
        }
        path = parsed.home
      } else if (path.startsWith('~/')) {
        path = host.home + path.slice(1)
      }
      resolvedHome = await this.home(path)
      binding = { kind: 'external', home: resolvedHome }
      identity = await this.externalIdentity(input.agent, executable, resolvedHome)
    }
    return {
      agent: input.agent,
      hostId: this.dependencies.host.hostId,
      executable,
      binding,
      resolvedHome,
      identity
    }
  }
  private identityMetadata(identity: ProfileIdentity): ProfileIdentity {
    return identity.kind === 'verified'
      ? { kind: 'verified', subject: identity.subject, displayName: identity.displayName }
      : { kind: 'unverified', reason: identity.reason }
  }
  private async externalIdentity(
    agent: ProfileAgent,
    executable: string,
    home: string
  ): Promise<ProfileIdentity> {
    if (!this.dependencies.inspectExternal) {
      return {
        kind: 'unverified',
        reason: 'Provider read-only identity inspection is unavailable.'
      }
    }
    try {
      return this.identityMetadata(await this.dependencies.inspectExternal(agent, executable, home))
    } catch {
      throw new Error('Provider identity inspection failed. Reconnect the configuration folder.')
    }
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutations.then(operation)
    this.mutations = result.catch(() => undefined)
    return result
  }
  save(input: {
    id?: string
    name: string
    connection: AgentProfileConnectionInput
  }): Promise<AgentLaunchProfile> {
    return this.serialize(async () => {
      this.guard()
      const profiles = await this.dependencies.store.read()
      if (input.id !== undefined && !profiles.some((profile) => profile.id === input.id)) {
        throw new Error('That profile no longer exists.')
      }
      const nameError = validateAgentLaunchProfileName(input.name, profiles, input.id)
      if (nameError) {
        throw new Error(nameError)
      }
      if (input.id === undefined && profiles.length >= 32) {
        throw new Error('A maximum of 32 profiles is supported.')
      }
      const candidate = await this.preview(input.connection)
      if (
        profiles.some(
          (profile) =>
            profile.id !== input.id &&
            profile.agent === candidate.agent &&
            profile.hostId === candidate.hostId &&
            profile.executable === candidate.executable &&
            JSON.stringify(profile.binding) === JSON.stringify(candidate.binding)
        )
      ) {
        throw new Error(
          'This agent home is already connected. Rename or edit its existing profile.'
        )
      }
      const profile: AgentLaunchProfile = {
        id: input.id ?? randomUUID(),
        name: input.name.trim(),
        agent: candidate.agent,
        hostId: candidate.hostId,
        executable: candidate.executable,
        binding: { ...candidate.binding }
      }
      if (!isAgentLaunchProfile(profile)) {
        throw new Error('Invalid profile data.')
      }
      await this.dependencies.store.write(
        input.id === undefined
          ? [...profiles, profile]
          : profiles.map((entry) => (entry.id === input.id ? profile : entry))
      )
      return profile
    })
  }
  unlink(id: string): Promise<void> {
    return this.serialize(async () => {
      this.guard()
      await this.dependencies.store.write(
        (await this.dependencies.store.read()).filter((profile) => profile.id !== id)
      )
    })
  }
  async prepare(
    profile: AgentLaunchProfile | AgentProfileSnapshot,
    options: ProfilePreparationOptions
  ): Promise<PreparedAgentProfile> {
    this.guard()
    if (!isAgentLaunchProfile(profile) || profile.hostId !== this.dependencies.host.hostId) {
      throw new Error('Profile host or binding is invalid.')
    }
    const candidate = await this.preview({
      agent: profile.agent,
      source:
        profile.binding.kind === 'managed'
          ? { kind: 'managed', accountId: profile.binding.accountId }
          : { kind: 'home', value: profile.binding.home }
    })
    if (candidate.executable !== profile.executable) {
      throw new Error('Profile executable changed. Reconnect the profile.')
    }
    if ('resolvedHome' in profile && candidate.resolvedHome !== profile.resolvedHome) {
      throw new Error('Profile home changed. Reconnect the profile.')
    }
    if (
      'identity' in profile &&
      profile.identity.kind === 'verified' &&
      (candidate.identity.kind !== 'verified' ||
        profile.identity.subject !== candidate.identity.subject)
    ) {
      throw new Error('Profile identity changed or cannot be verified. Reconnect the profile.')
    }
    if (
      (candidate.identity.kind === 'unverified' ||
        ('identity' in profile && profile.identity.kind === 'unverified')) &&
      (options.resume || options.mode === 'structured')
    ) {
      throw new Error('Unverified identity supports fresh terminal launch only.')
    }
    const snapshot: AgentProfileSnapshot = {
      id: profile.id,
      name: profile.name,
      agent: candidate.agent,
      hostId: candidate.hostId,
      executable: candidate.executable,
      binding: { ...profile.binding },
      resolvedHome: candidate.resolvedHome,
      identity: { ...candidate.identity }
    }
    const adapter = this.dependencies.adapters[profile.agent]
    if (profile.binding.kind === 'external') {
      return {
        snapshot,
        envPatch: { [adapter.homeVariable]: candidate.resolvedHome },
        envToDelete: [],
        release: () => {}
      }
    }
    const prepared = await adapter.prepareManaged(profile.binding.accountId, options).catch(() => {
      throw new Error('Managed account preparation failed.')
    })
    try {
      if ((await this.home(prepared.home)) !== candidate.resolvedHome) {
        throw new Error('Managed profile home changed during preparation.')
      }
      return {
        snapshot,
        envPatch: { ...prepared.envPatch, [adapter.homeVariable]: candidate.resolvedHome },
        envToDelete: [...new Set([...adapter.authVariables, ...prepared.envToDelete])].filter(
          (key) => key !== adapter.homeVariable
        ),
        release: prepared.release
      }
    } catch (error) {
      prepared.release()
      throw error
    }
  }
}
