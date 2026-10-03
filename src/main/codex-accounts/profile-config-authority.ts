// A managed OAuth profile must keep its per-account auth.json as credential authority.
import { join } from 'node:path'
import { observeAgentStateFile } from '../codex/codex-path-observation'
import { readCodexTopLevelModelProvider } from '../codex/codex-model-provider-config'
import { scanStructuredSettingLines } from '../codex/config-toml-promoted-setting-values'
import { parseTomlStringValue } from '../codex/config-toml-line-scan'

export function assertCodexProfileConfigAuthority(home: string): void {
  const observed = observeAgentStateFile(join(home, 'config.toml'))
  if (observed.kind === 'absent') {
    return
  }
  if (observed.kind !== 'present') {
    throw new Error('Managed Codex configuration is unreadable.')
  }
  const provider = readCodexTopLevelModelProvider(observed.value)
  if (provider && provider !== 'openai') {
    throw new Error('Managed Codex profiles require the OpenAI OAuth provider.')
  }
  for (const setting of scanStructuredSettingLines(observed.value.split('\n'))) {
    const key = setting.structuredKey
    if (
      !['cli_auth_credentials_store', 'forced_login_method', 'profile', 'model_provider'].includes(
        key
      )
    ) {
      continue
    }
    const value = setting.multiline ? undefined : parseTomlStringValue(setting.raw, 0)?.value
    // File is the CLI default; auto can prefer the keyring and ephemeral ignores disk credentials.
    const compatible =
      key === 'cli_auth_credentials_store'
        ? value === 'file'
        : key === 'forced_login_method'
          ? value === 'chatgpt'
          : key === 'model_provider'
            ? value === 'openai'
            : false
    if (!compatible) {
      throw new Error(
        'Managed Codex profiles require file credentials and direct OpenAI OAuth configuration.'
      )
    }
  }
}
