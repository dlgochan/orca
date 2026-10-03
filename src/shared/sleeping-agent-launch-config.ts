import type { SleepingAgentLaunchConfig } from './agent-session-resume'

export function buildSleepingAgentLaunchConfig(args: {
  claudeAccountId?: string | null
  claudeProfile?: SleepingAgentLaunchConfig['claudeProfile']
  agentCommand?: string | null
  agentArgs?: string | null
  agentEnv?: Record<string, string> | null
  ompResumeFilePath?: string | null
}): SleepingAgentLaunchConfig {
  return {
    ...(args.claudeAccountId !== undefined ? { claudeAccountId: args.claudeAccountId } : {}),
    ...(args.claudeProfile ? { claudeProfile: { ...args.claudeProfile } } : {}),
    ...(args.agentCommand?.trim() ? { agentCommand: args.agentCommand } : {}),
    agentArgs: args.agentArgs ?? '',
    // Why: startup env may include prompt transport or pane identity values;
    // durable resume state is limited to Orca-managed agent inputs.
    agentEnv: args.agentEnv ? { ...args.agentEnv } : {},
    ...(args.ompResumeFilePath?.trim() ? { ompResumeFilePath: args.ompResumeFilePath.trim() } : {})
  }
}
