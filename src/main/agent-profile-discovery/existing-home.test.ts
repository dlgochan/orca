import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  mkdtemp,
  mkdir,
  realpath,
  writeFile,
  readFile,
  readdir,
  symlink,
  rm
} from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseProfileCommand } from './command'
import { validateExternalProfileHome } from './existing-home'

describe('existing profile home validation', () => {
  let root: string
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'orca-profile-discovery-')))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('connects a folder with spaces without changing or importing its credentials', async () => {
    const home = join(root, 'Work Account')
    await mkdir(home)
    const credentials = '{"fixture":"external-account-owned-by-cli"}\n'
    await writeFile(join(home, 'auth.json'), credentials)
    const parsed = parseProfileCommand(`CLAUDE_CONFIG_DIR="${home}" claude`, {
      commandName: 'claude',
      executable: '/opt/bin/claude',
      homeVariable: 'CLAUDE_CONFIG_DIR',
      hostHome: root,
      platform: 'linux'
    })
    expect(parsed.kind).toBe('resolved')
    if (parsed.kind !== 'resolved') {
      throw new Error('Expected a resolved fixture command')
    }
    expect(await validateExternalProfileHome(parsed.home)).toEqual({ ok: true, home })
    expect(await readFile(join(home, 'auth.json'), 'utf8')).toBe(credentials)
    expect(await readdir(home)).toEqual(['auth.json'])
    expect(await readdir(root)).toEqual(['Work Account'])
  })

  it('resolves symlinks before interpreting parent segments', async () => {
    await mkdir(join(root, 'a'))
    await mkdir(join(root, 'b', 'child'), { recursive: true })
    await symlink(join(root, 'b', 'child'), join(root, 'a', 'link'))
    const input = `${root}/a/link/..`
    const parsed = parseProfileCommand(`CODEX_HOME="${input}" codex`, {
      commandName: 'codex',
      executable: '/opt/bin/codex',
      homeVariable: 'CODEX_HOME',
      hostHome: root,
      platform: 'linux'
    })
    if (parsed.kind !== 'resolved') {
      throw new Error('Expected a resolved fixture command')
    }
    expect(await validateExternalProfileHome(parsed.home)).toEqual({
      ok: true,
      home: join(root, 'b')
    })
  })

  it.each(['missing', 'file', 'dangling'])(
    'rejects a %s path instead of creating a home',
    async (kind) => {
      await writeFile(join(root, 'file'), 'fixture')
      await symlink(join(root, 'missing'), join(root, 'dangling'))
      expect((await validateExternalProfileHome(join(root, kind))).ok).toBe(false)
      expect((await readdir(root)).sort()).toEqual(['dangling', 'file'])
    }
  )

  it.each(['', 'relative/path', '/bad\0path', '/bad\npath', `/${'x'.repeat(4096)}`])(
    'rejects malformed directory input without filesystem mutation',
    async (input) => {
      expect((await validateExternalProfileHome(input)).ok).toBe(false)
      expect(await readdir(root)).toEqual([])
    }
  )
})
