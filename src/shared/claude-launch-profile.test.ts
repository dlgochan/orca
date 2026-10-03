import { describe, expect, it } from 'vitest'
import {
  captureClaudeLaunchProfile,
  normalizeClaudeLaunchProfiles,
  validateClaudeLaunchProfileName
} from './claude-launch-profile'

const first = { id: 'profile-a', name: 'Claude2', accountId: 'account-a' }

describe('Claude launch profiles', () => {
  it('loads legacy settings without profiles', () => {
    expect(normalizeClaudeLaunchProfiles(undefined)).toEqual([])
  })

  it('keeps one valid record per identity and excludes malformed persisted entries', () => {
    expect(
      normalizeClaudeLaunchProfiles([
        first,
        { ...first, name: 'Alias' },
        { id: 'bad', name: 'Broken', accountId: '' },
        { id: 'other', name: 'Injected\nname', accountId: 'account-b' },
        null
      ])
    ).toEqual([first])
  })

  it('captures a session binding that survives profile edits and deletion', () => {
    const profiles = [{ ...first }]
    const snapshot = captureClaudeLaunchProfile(profiles, first.id)
    profiles[0].name = 'Renamed'
    profiles[0].accountId = 'account-b'
    profiles.splice(0)
    expect(snapshot).toEqual(first)
  })

  it('refuses a missing explicit profile instead of selecting the default account', () => {
    expect(() => captureClaudeLaunchProfile([], first.id)).toThrow('no longer exists')
  })

  it.each(['', '   ', 'Claude', 'cOdEx', 'Terminal', 'a'.repeat(61), 'name\u0000'])(
    'refuses ambiguous or invalid name %j',
    (name) => {
      expect(validateClaudeLaunchProfileName(name, [])).not.toBeNull()
    }
  )

  it('rejects duplicate names case-insensitively but permits editing the same identity', () => {
    expect(validateClaudeLaunchProfileName(' claude2 ', [first])).not.toBeNull()
    expect(validateClaudeLaunchProfileName('Claude2', [first], first.id)).toBeNull()
    expect(validateClaudeLaunchProfileName('업무 Claude', [first])).toBeNull()
  })
})
