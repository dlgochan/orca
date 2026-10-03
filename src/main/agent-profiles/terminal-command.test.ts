import { describe, expect, it } from 'vitest'
import { runProcess } from '../../shared/child-process/run-process'
import { prepareAgentProfileTerminalCommand } from './terminal-command'
import type { PreparedAgentProfile } from './connection-contracts'

function prepared(managed = true): PreparedAgentProfile {
  return {
    snapshot: {
      id: 'p',
      name: 'Work',
      agent: 'claude',
      hostId: 'local',
      executable: '/bin/printf',
      binding: managed
        ? { kind: 'managed', accountId: 'a' }
        : { kind: 'external', home: '/space home' },
      resolvedHome: '/space home',
      identity: { kind: 'unverified', reason: 'fixture' }
    },
    envPatch: { CLAUDE_CONFIG_DIR: '/space home' },
    envToDelete: managed ? ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_USE_BEDROCK'] : [],
    release: () => {}
  }
}

describe('profile terminal command', () => {
  it('pins canonical filenames, retains argv, and exposes agent recognition', () => {
    const result = prepareAgentProfileTerminalCommand(prepared(), 'claude --model "a b"')
    expect(result.launchAgent).toBe('claude')
    expect(result.command).toContain("'/bin/printf' '--model' 'a b'")
  })
  it.each([
    'env claude',
    'claude | cat',
    'claude; touch /tmp/sentinel',
    'claude $(touch /tmp/sentinel)',
    'claude `id`',
    'CLAUDE_CONFIG_DIR=/other claude',
    'claude --settings /other'
  ])('refuses unsafe routing: %s', (command) => {
    expect(() => prepareAgentProfileTerminalCommand(prepared(), command)).toThrow()
  })
  it('rejects explicit home and managed auth env overrides', () => {
    expect(() =>
      prepareAgentProfileTerminalCommand(prepared(), 'claude', { CLAUDE_CONFIG_DIR: '/other' })
    ).toThrow()
    expect(() =>
      prepareAgentProfileTerminalCommand(prepared(), 'claude', { ANTHROPIC_API_KEY: 'override' })
    ).toThrow()
    expect(() =>
      prepareAgentProfileTerminalCommand(prepared(false), 'claude', {
        ANTHROPIC_API_KEY: 'external'
      })
    ).not.toThrow()
  })
  it('restores bound home and deletions after shell startup exports', async () => {
    const profile = prepared()
    profile.snapshot.executable = '/usr/bin/env'
    const { command } = prepareAgentProfileTerminalCommand(profile, 'claude')
    const result = await runProcess({
      program: '/bin/sh',
      args: [
        '-c',
        `export CLAUDE_CONFIG_DIR=/wrong ANTHROPIC_API_KEY=wrong CLAUDE_CODE_USE_BEDROCK=1; ${command}`
      ]
    })
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('CLAUDE_CONFIG_DIR=/space home')
    expect(result.stdout).not.toContain('ANTHROPIC_API_KEY=')
    expect(result.stdout).not.toContain('CLAUDE_CODE_USE_BEDROCK=')
  })
})

it('keeps quoted arguments literal and rejects Codex auth configuration overrides', () => {
  const profile = prepared()
  profile.snapshot.agent = 'codex'
  profile.envPatch = { CODEX_HOME: '/codex home' }
  for (const command of [
    'codex -c model_provider=evil',
    'codex --profile other',
    'codex --config cli_auth_credentials_store=keyring',
    'codex --oss',
    'codex -c'
  ]) {
    expect(() => prepareAgentProfileTerminalCommand(profile, command)).toThrow()
  }
  expect(
    prepareAgentProfileTerminalCommand(
      profile,
      'codex --model "space model" -c model_reasoning_effort=high'
    ).command
  ).toContain("'model_reasoning_effort=high'")
})
