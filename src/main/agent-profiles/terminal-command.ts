// Pin argv before provider launch planning; bind credentials only after shell startup.
import { isAbsolute } from 'node:path'
import { quoteStartupArg, tokenizeStartupCommand } from '../../shared/tui-agent-startup-shell'
import type { PreparedAgentProfile } from './connection-contracts'

function assertArguments(agent: string, args: string[]): void {
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (agent === 'claude' && /^--(settings|setting-sources)(=|$)/.test(argument)) {
      throw new Error('Profile commands cannot override authentication settings.')
    }
    if (agent !== 'codex') {
      continue
    }
    if (/^(--oss|--local-provider)(=|$)/.test(argument)) {
      throw new Error('Profile commands cannot redirect the Codex provider.')
    }
    if ((argument === '-c' || argument === '--config') && !args[index + 1]) {
      throw new Error('Codex configuration overrides require a value.')
    }
    if (/^(--profile|-p)(=|$)/.test(argument) || /^-p./.test(argument)) {
      throw new Error('Profile commands cannot select another Codex configuration profile.')
    }
    const config =
      argument === '-c' || argument === '--config'
        ? args[++index]
        : argument.startsWith('--config=')
          ? argument.slice(9)
          : argument.startsWith('-c')
            ? argument.slice(2)
            : undefined
    if (
      config !== undefined &&
      !/^(model|model_reasoning_effort|approval_policy|sandbox_mode|features\.no_daemon)=/.test(
        config
      )
    ) {
      throw new Error('Profile commands cannot override authentication configuration.')
    }
  }
}

export function assertAgentProfileEnvironment(
  prepared: PreparedAgentProfile,
  env: Record<string, string> = {}
): void {
  const homeVariable = prepared.snapshot.agent === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'
  const forbidden = new Set([homeVariable, ...prepared.envToDelete])
  for (const key of Object.keys(env)) {
    if (forbidden.has(key.toUpperCase())) {
      throw new Error(`Remove the ${key} override before launching this profile.`)
    }
  }
}

export function pinAgentProfileTerminalCommand(
  prepared: PreparedAgentProfile,
  command: string | undefined,
  env?: Record<string, string>
): string {
  assertAgentProfileEnvironment(prepared, env)
  const parsed = tokenizeStartupCommand(command ?? '', 'posix')
  const { executable, agent } = prepared.snapshot
  if (
    !isAbsolute(executable) ||
    !parsed.ok ||
    !parsed.tokens.length ||
    parsed.spans.some((span) => span.divergesFromShell) ||
    /[\r\n\0]/.test(command ?? '')
  ) {
    throw new Error('Profiles require a direct agent command; shell wrappers are not supported.')
  }
  const [first, ...args] = parsed.tokens
  if (first !== agent && first !== executable) {
    throw new Error('Profile command does not match its detected executable.')
  }
  assertArguments(agent, args)
  return [executable, ...args].map((arg) => quoteStartupArg(arg, 'posix')).join(' ')
}

/** Accepts only a host-generated command already validated by the pinning phase. */
export function bindAgentProfileTerminalEnvironment(
  prepared: PreparedAgentProfile,
  pinnedCommand: string
): string {
  const names = [...prepared.envToDelete, ...Object.keys(prepared.envPatch)]
  if (names.some((name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))) {
    throw new Error('Invalid profile environment variable.')
  }
  const deletions = prepared.envToDelete.flatMap((name) => ['-u', name])
  const assignments = Object.entries(prepared.envPatch).map(([key, value]) => `${key}=${value}`)
  const prefix = ['/usr/bin/env', ...deletions, ...assignments]
    .map((arg) => quoteStartupArg(arg, 'posix'))
    .join(' ')
  return `${prefix} ${pinnedCommand}`
}

export function prepareAgentProfileTerminalCommand(
  prepared: PreparedAgentProfile,
  command: string | undefined,
  env?: Record<string, string>
): { command: string; launchAgent: 'claude' | 'codex' } {
  return {
    command: bindAgentProfileTerminalEnvironment(
      prepared,
      pinAgentProfileTerminalCommand(prepared, command, env)
    ),
    launchAgent: prepared.snapshot.agent
  }
}
