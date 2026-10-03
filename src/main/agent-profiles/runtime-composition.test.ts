import { mkdirSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAgentProfileConnectionService } from './runtime-composition'
import { createSettings, createStore } from '../codex-accounts/service-test-harness'
import { hasClaudeCredentialOwners } from '../claude-accounts/live-pty-gate'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
const state = vi.hoisted(() => ({ root: '' }))
vi.mock('electron', () => ({ app: { getPath: () => state.root } }))
let executable: string
let accounts: ClaudeManagedAccount[]
beforeEach(() => {
  state.root = mkdtempSync(join(tmpdir(), 'profile-composition-'))
  executable = join(state.root, 'canonical cli')
  writeFileSync(executable, 'fixture')
  chmodSync(executable, 0o700)
  accounts = ['a', 'b'].map((id) => {
    const managedAuthPath = join(state.root, 'claude-accounts', id, 'auth')
    mkdirSync(managedAuthPath, { recursive: true })
    writeFileSync(join(managedAuthPath, '.orca-managed-claude-auth'), id)
    return {
      id,
      email: `${id}@example.com`,
      managedAuthPath,
      authMethod: 'subscription-oauth',
      organizationUuid: id,
      createdAt: 1,
      updatedAt: 1,
      lastAuthenticatedAt: 1
    }
  })
})
afterEach(() => rmSync(state.root, { recursive: true, force: true }))
function fixture() {
  const store = createStore(
    createSettings({
      claudeManagedAccounts: accounts,
      activeClaudeManagedAccountId: 'b',
      agentLaunchProfiles: []
    })
  )
  const prepareForClaudeProfileLaunch = vi.fn(async (id: string) => ({
    configDir: accounts.find((a) => a.id === id)!.managedAuthPath,
    runtime: 'host' as const,
    wslDistro: null,
    wslLinuxConfigDir: null,
    envPatch: {},
    stripAuthEnv: true,
    isolatedCredentials: true,
    provenance: `managed:${id}` as const
  }))
  const codex = {
    prepareForCodexProfileLaunch: vi.fn(),
    resolveCodexManagedAccountHomeForInactiveFetch: vi.fn()
  }
  const service = createAgentProfileConnectionService({
    store,
    claudeRuntimeAuth: { prepareForClaudeProfileLaunch },
    codexRuntimeHome: codex,
    host: {
      hostId: 'local',
      platform: 'linux',
      isWsl: false,
      home: state.root,
      shell: '/bin/bash'
    },
    detectExecutable: async () => executable
  })
  return { service, store, prepareForClaudeProfileLaunch, codex }
}
it('composes two independent Claude profiles with credential leases and managed OAuth routing', async () => {
  const { service, store } = fixture()
  const profiles = await Promise.all(
    ['a', 'b'].map((accountId) =>
      service.save({
        name: accountId,
        connection: { agent: 'claude', source: { kind: 'managed', accountId } }
      })
    )
  )
  const prepared = await Promise.all(
    profiles.map((profile) => service.prepare(profile, { mode: 'terminal', resume: false }))
  )
  try {
    expect(store.getSettings().agentLaunchProfiles).toHaveLength(2)
    expect(store.getSettings().activeClaudeManagedAccountId).toBe('b')
    expect(prepared.map((p) => p.snapshot.resolvedHome)).toEqual(
      accounts.map((a) => a.managedAuthPath)
    )
    expect(prepared[0].envToDelete).toContain('CLAUDE_CODE_USE_BEDROCK')
    expect(hasClaudeCredentialOwners()).toBe(true)
    store.updateSettings({
      claudeManagedAccounts: accounts.map((a) => ({ ...a, organizationUuid: 'changed' }))
    })
    await expect(
      service.prepare(prepared[0].snapshot, { mode: 'terminal', resume: true })
    ).rejects.toThrow('identity')
  } finally {
    prepared.forEach((p) => p.release())
  }
  expect(hasClaudeCredentialOwners()).toBe(false)
})
it('releases failed Claude preparation and refuses missing, WSL and untrusted references', async () => {
  const { service, prepareForClaudeProfileLaunch, store } = fixture()
  const profile = await service.save({
    name: 'a',
    connection: { agent: 'claude', source: { kind: 'managed', accountId: 'a' } }
  })
  prepareForClaudeProfileLaunch.mockRejectedValueOnce(new Error('fixture failure'))
  await expect(service.prepare(profile, { mode: 'terminal', resume: false })).rejects.toThrow(
    'preparation'
  )
  expect(hasClaudeCredentialOwners()).toBe(false)
  for (const account of [
    undefined,
    { ...accounts[0], managedAuthRuntime: 'wsl' as const },
    { ...accounts[0], managedAuthPath: state.root }
  ]) {
    store.updateSettings({ claudeManagedAccounts: account ? [account] : [] })
    await expect(
      service.preview({ agent: 'claude', source: { kind: 'managed', accountId: 'a' } })
    ).rejects.toThrow('inspection')
  }
})
it('leaves unknown managed identity unverified and external homes untouched', async () => {
  const { service, store, prepareForClaudeProfileLaunch, codex } = fixture()
  store.updateSettings({ claudeManagedAccounts: [{ ...accounts[0], authMethod: 'unknown' }] })
  expect(
    (await service.preview({ agent: 'claude', source: { kind: 'managed', accountId: 'a' } }))
      .identity.kind
  ).toBe('unverified')
  const profile = await service.save({
    name: 'external',
    connection: { agent: 'claude', source: { kind: 'home', value: state.root } }
  })
  const prepared = await service.prepare(profile, { mode: 'terminal', resume: false })
  expect(prepared.envToDelete).toEqual([])
  expect(prepareForClaudeProfileLaunch).not.toHaveBeenCalled()
  expect(codex.prepareForCodexProfileLaunch).not.toHaveBeenCalled()
  expect(codex.resolveCodexManagedAccountHomeForInactiveFetch).not.toHaveBeenCalled()
})
