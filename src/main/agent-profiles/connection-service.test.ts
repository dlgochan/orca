import { mkdtemp, mkdir, rm, writeFile, chmod, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentProfileConnectionService } from './connection-service'
import { createClaudeProfileAdapter, createCodexProfileAdapter } from './provider-adapters'
import type {
  AgentLaunchProfile,
  ProfileAgent,
  ProfileIdentity
} from '../../shared/agent-launch-profile'

describe('host profile connections', () => {
  let root: string
  let home: string
  let executable: string
  let profiles: AgentLaunchProfile[]
  let identity: ProfileIdentity
  const inspectManaged = vi.fn()
  const prepareManaged = vi.fn()
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'profile-service-'))
    home = join(root, 'account')
    executable = join(root, 'cli')
    await mkdir(home)
    await writeFile(executable, 'synthetic executable')
    await chmod(executable, 0o700)
    profiles = []
    identity = { kind: 'verified', subject: 'one', displayName: 'One' }
    inspectManaged.mockReset().mockImplementation(async () => ({ home, identity }))
    prepareManaged
      .mockReset()
      .mockImplementation(async () => ({ home, envPatch: {}, envToDelete: [], release: vi.fn() }))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })
  function service(overrides = {}) {
    const callbacks = { inspectManaged, prepareManaged }
    return new AgentProfileConnectionService({
      host: { hostId: 'local', platform: 'linux', isWsl: false, home: root, shell: '/bin/bash' },
      adapters: {
        claude: createClaudeProfileAdapter(callbacks),
        codex: createCodexProfileAdapter(callbacks)
      },
      detectExecutable: async () => executable,
      inspectExternal: async () => identity,
      store: {
        read: () => profiles,
        write: async (value) => {
          profiles = value
        }
      },
      ...overrides
    })
  }
  function connection(agent: ProfileAgent = 'claude') {
    return { agent, source: { kind: 'home' as const, value: home } }
  }
  it.each(['claude', 'codex'] as const)(
    'external %s lifecycle never calls managed services',
    async (agent) => {
      const svc = service()
      const preview = await svc.preview(connection(agent))
      expect(preview.binding).toEqual({ kind: 'external', home })
      const saved = await svc.save({ name: 'Work', connection: connection(agent) })
      const prepared = await svc.prepare(saved, { resume: false, mode: 'terminal' })
      expect(prepared.envPatch[agent === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME']).toBe(home)
      await svc.unlink(saved.id)
      await expect(
        svc.prepare(prepared.snapshot, { resume: true, mode: 'structured' })
      ).resolves.toBeDefined()
      expect(inspectManaged).not.toHaveBeenCalled()
      expect(prepareManaged).not.toHaveBeenCalled()
    }
  )
  it.each(['claude', 'codex'] as const)(
    'managed %s delegates preparation by account',
    async (agent) => {
      const svc = service()
      const profile = await svc.save({
        name: 'Work',
        connection: { agent, source: { kind: 'managed', accountId: 'account' } }
      })
      await svc.prepare(profile, { resume: true, mode: 'structured' })
      expect(prepareManaged).toHaveBeenCalledWith('account', expect.anything())
    }
  )
  it('revalidates saves and missing homes', async () => {
    const svc = service()
    await svc.preview(connection())
    await rm(home, { recursive: true })
    await expect(svc.save({ name: 'Work', connection: connection() })).rejects.toThrow(/home/i)
    expect(profiles).toHaveLength(0)
  })
  it('serializes writes, rejects duplicate bindings, renames and rejects unknown ids', async () => {
    const second = join(root, 'second')
    await mkdir(second)
    const svc = service()
    await Promise.all([
      svc.save({ name: 'One', connection: connection() }),
      svc.save({
        name: 'Two',
        connection: { agent: 'codex', source: { kind: 'home', value: second } }
      })
    ])
    expect(profiles).toHaveLength(2)
    await expect(svc.save({ name: 'Other', connection: connection() })).rejects.toThrow(
      /already connected/i
    )
    const first = profiles[0]
    await svc.save({ id: first.id, name: 'Renamed', connection: connection() })
    expect(profiles[0].name).toBe('Renamed')
    await expect(
      svc.save({ id: 'missing', name: 'Missing', connection: connection() })
    ).rejects.toThrow(/no longer exists/i)
  })
  it('snapshots survive edits and refuse identity/home changes', async () => {
    const svc = service()
    const saved = await svc.save({ name: 'Work', connection: connection() })
    const { snapshot } = await svc.prepare(saved, { resume: false, mode: 'terminal' })
    const other = join(root, 'other')
    await mkdir(other)
    await svc.save({
      id: saved.id,
      name: 'Other',
      connection: { agent: 'claude', source: { kind: 'home', value: other } }
    })
    expect(
      (await svc.prepare(snapshot, { resume: true, mode: 'terminal' })).snapshot.resolvedHome
    ).toBe(home)
    identity = { kind: 'verified', subject: 'two', displayName: 'Two' }
    await expect(svc.prepare(snapshot, { resume: true, mode: 'terminal' })).rejects.toThrow(
      /identity/i
    )
    identity = snapshot.identity
    await rm(home, { recursive: true })
    await symlink(other, home)
    await expect(svc.prepare(snapshot, { resume: false, mode: 'terminal' })).rejects.toThrow(
      /home.*changed/i
    )
  })
  it('unverified identity permits fresh terminal only', async () => {
    identity = { kind: 'unverified', reason: 'unsupported' }
    const svc = service()
    const saved = await svc.save({ name: 'Work', connection: connection() })
    await expect(svc.prepare(saved, { resume: false, mode: 'terminal' })).resolves.toBeDefined()
    await expect(svc.prepare(saved, { resume: true, mode: 'terminal' })).rejects.toThrow(
      /unverified/i
    )
    await expect(svc.prepare(saved, { resume: false, mode: 'structured' })).rejects.toThrow(
      /unverified/i
    )
  })
  it.each([{ platform: 'win32' }, { isWsl: true }, { hostId: 'ssh:remote' }])(
    'guards host before side effects %j',
    async (change) => {
      const detector = vi.fn()
      const svc = service({
        host: {
          hostId: 'local',
          platform: 'linux',
          isWsl: false,
          home: root,
          shell: '/bin/bash',
          ...change
        },
        detectExecutable: detector
      })
      await expect(svc.preview(connection())).rejects.toThrow(/supported/i)
      expect(detector).not.toHaveBeenCalled()
      expect(inspectManaged).not.toHaveBeenCalled()
    }
  )
  it('rejects reserved names, name collisions and count overflow', async () => {
    const svc = service()
    await expect(svc.save({ name: 'Claude', connection: connection() })).rejects.toThrow(/built-in/)
    const first = await svc.save({ name: 'Work', connection: connection() })
    await expect(svc.save({ name: ' work ', connection: connection('codex') })).rejects.toThrow(
      /name/
    )
    profiles = Array.from({ length: 32 }, (_, index) => ({
      ...first,
      id: `id${index}`,
      name: `Name ${index}`
    }))
    await expect(svc.save({ name: 'Overflow', connection: connection() })).rejects.toThrow(/32/)
  })
  it('resolves assignments, bounded aliases, direct CLI and leading home tilde', async () => {
    const defaultHome = join(root, '.claude')
    await mkdir(defaultHome)
    const svc = service({
      readAliases: async () => [
        { name: '.bash_aliases', content: `alias work='CLAUDE_CONFIG_DIR="${home}" claude'` }
      ]
    })
    for (const value of ['work', `CLAUDE_CONFIG_DIR="${home}" claude`]) {
      expect(
        (await svc.preview({ agent: 'claude', source: { kind: 'command', value } })).resolvedHome
      ).toBe(home)
    }
    expect(
      (await svc.preview({ agent: 'claude', source: { kind: 'command', value: 'claude' } }))
        .resolvedHome
    ).toBe(defaultHome)
    expect(
      (await svc.preview({ agent: 'claude', source: { kind: 'home', value: '~/account' } }))
        .resolvedHome
    ).toBe(home)
    await expect(
      svc.preview({ agent: 'claude', source: { kind: 'command', value: 'claude --resume' } })
    ).rejects.toThrow(/folder/)
  })
  it('refuses changed executable and nonexecutable candidates', async () => {
    const svc = service()
    const profile = await svc.save({ name: 'Work', connection: connection() })
    const changed = join(root, 'other-cli')
    await writeFile(changed, 'fake')
    await chmod(changed, 0o700)
    executable = changed
    await expect(svc.prepare(profile, { resume: false, mode: 'terminal' })).rejects.toThrow(
      /executable changed/
    )
    await chmod(changed, 0o600)
    await expect(svc.preview(connection())).rejects.toThrow(/unavailable/)
  })
  it('releases managed preparation if the provider changes its home', async () => {
    const svc = service()
    const profile = await svc.save({
      name: 'Managed',
      connection: { agent: 'codex', source: { kind: 'managed', accountId: 'one' } }
    })
    const release = vi.fn()
    const other = join(root, 'other')
    await mkdir(other)
    prepareManaged.mockResolvedValue({ home: other, envPatch: {}, envToDelete: [], release })
    await expect(svc.prepare(profile, { resume: false, mode: 'terminal' })).rejects.toThrow(
      /home changed/
    )
    expect(release).toHaveBeenCalledOnce()
  })
  it('preserves existing credentials and only persists contract fields', async () => {
    const marker = join(home, 'credentials')
    await writeFile(marker, 'synthetic credential marker')
    const svc = service()
    const profile = await svc.save({ name: 'Work', connection: connection() })
    expect(Object.keys(profile).sort()).toEqual([
      'agent',
      'binding',
      'executable',
      'hostId',
      'id',
      'name'
    ])
    await svc.unlink(profile.id)
    const { readFile } = await import('node:fs/promises')
    expect(await readFile(marker, 'utf8')).toBe('synthetic credential marker')
  })
  it('does not expose provider error contents from managed inspection', async () => {
    inspectManaged.mockRejectedValue(new Error('synthetic secret-token-value'))
    await expect(
      service().preview({ agent: 'claude', source: { kind: 'managed', accountId: 'one' } })
    ).rejects.toThrow('Managed account inspection failed.')
  })
})
