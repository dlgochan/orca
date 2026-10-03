import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  pinClaudeProfileTerminalCommand,
  supportsClaudeProfileKeychain
} from './claude-profile-cli'
import {
  assertClaudeProfileEnvironment,
  stripClaudeProfileProviderEnvironment
} from './claude-profile-environment'
import { buildClaudeChildProcessEnv } from '../claude/claude-child-process-environment'

describe('Claude profile credential routing', () => {
  afterEach(() => vi.restoreAllMocks())
  it.each(['CLAUDE_CONFIG_DIR=/other claude', 'env claude', 'claude; echo unsafe'])(
    'refuses shell routing overrides on Linux: %s',
    async (command) => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
      await expect(pinClaudeProfileTerminalCommand(command)).rejects.toThrow('direct Claude')
    }
  )
  it('pins the executable while preserving ordinary arguments on Linux', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    await expect(pinClaudeProfileTerminalCommand('/opt/claude --model sonnet')).resolves.toBe(
      "'/opt/claude' --model sonnet"
    )
  })
  it.each(['1.0.99', '2.0.76', 'unknown', 'wrapper 2.1.1'])(
    'refuses unverified scoped Keychain support: %s',
    (version) => {
      expect(supportsClaudeProfileKeychain(version)).toBe(false)
    }
  )
  it.each(['2.1.0 (Claude Code)', '2.1.280', '3.0.0'])(
    'accepts scoped Keychain support: %s',
    (version) => {
      expect(supportsClaudeProfileKeychain(version)).toBe(true)
    }
  )
  it.each([
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY',
    'ANTHROPIC_BASE_URL'
  ])('rejects explicit provider routing and strips inherited %s', (key) => {
    expect(() => assertClaudeProfileEnvironment({ [key]: '1' })).toThrow('override')
    const env = { [key]: '1', PATH: '/bin' }
    stripClaudeProfileProviderEnvironment(env)
    expect(env).toEqual({ PATH: '/bin' })
    expect(
      buildClaudeChildProcessEnv(
        { CLAUDE_CONFIG_DIR: '/profile' },
        {
          inheritedEnv: { [key]: '1' },
          isolatedCredentials: true,
          scrubConfiguredChildSessionStamps: true
        }
      )
    ).toEqual({ CLAUDE_CONFIG_DIR: '/profile' })
  })
})
