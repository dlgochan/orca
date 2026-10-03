import { afterEach, beforeEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertAccountHasNoAgentProfiles } from './account-removal'
import {
  _internals,
  forgetCodexPaneAccount,
  hasRecordedProfileBoundCodexAccount,
  recordCodexPaneAccount,
  reserveCodexProfileAccountOwner
} from '../codex/codex-pane-account-registry'

let directory: string
let previous: string | undefined
beforeEach(() => {
  previous = process.env.ORCA_USER_DATA_PATH
  directory = mkdtempSync(join(tmpdir(), 'profile-removal-'))
  process.env.ORCA_USER_DATA_PATH = directory
  _internals.resetCache()
})
afterEach(() => {
  _internals.resetCache()
  rmSync(directory, { recursive: true, force: true })
  if (previous === undefined) {
    delete process.env.ORCA_USER_DATA_PATH
  } else {
    process.env.ORCA_USER_DATA_PATH = previous
  }
})
it.each(['claude', 'codex'] as const)(
  'requires unlink before removing a referenced %s account',
  (agent) => {
    const settings = {
      agentLaunchProfiles: [
        {
          id: 'a',
          name: 'A',
          agent,
          hostId: 'local',
          executable: '/cli',
          binding: { kind: 'managed', accountId: 'a' } as const
        }
      ]
    }
    expect(() => assertAccountHasNoAgentProfiles(settings, agent, 'a')).toThrow(/Unlink/)
    expect(() =>
      assertAccountHasNoAgentProfiles({ agentLaunchProfiles: [] }, agent, 'a')
    ).not.toThrow()
  }
)
it('retains deletion protection from pending launch through committed process after unlink', () => {
  const release = reserveCodexProfileAccountOwner('a')
  expect(hasRecordedProfileBoundCodexAccount('a')).toBe(true)
  recordCodexPaneAccount('pty', {
    selectionKey: 'host',
    accountId: 'a',
    homeRoute: 'account-home',
    profileBound: true
  })
  release()
  expect(hasRecordedProfileBoundCodexAccount('a')).toBe(true)
  expect(hasRecordedProfileBoundCodexAccount('b')).toBe(false)
  forgetCodexPaneAccount('pty')
  expect(hasRecordedProfileBoundCodexAccount('a')).toBe(false)
})
it('refuses deletion when the ownership registry cannot be read', () => {
  writeFileSync(join(directory, 'codex-pane-accounts.json'), 'malformed')
  expect(() => hasRecordedProfileBoundCodexAccount('a')).toThrow()
})
