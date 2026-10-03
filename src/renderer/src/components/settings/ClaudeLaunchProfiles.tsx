// Named launch entries reuse Accounts for sign-in and Claude's existing launch preferences.
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  validateClaudeLaunchProfileName,
  type ClaudeLaunchProfile
} from '../../../../shared/claude-launch-profile'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { useAppStore } from '@/store'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

type Props = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}

function ProfileEditor({
  settings,
  updateSettings,
  profile
}: Props & { profile?: ClaudeLaunchProfile }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(profile?.name ?? 'Claude2')
  const [accountId, setAccountId] = useState(profile?.accountId ?? '')
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const id = useId()
  const profiles = settings.claudeLaunchProfiles ?? []
  const accounts = settings.claudeManagedAccounts.filter(
    (account) => account.managedAuthRuntime !== 'wsl'
  )
  const error = validateClaudeLaunchProfileName(name, profiles, profile?.id)
  const save = async () => {
    if (error || !accounts.some((account) => account.id === accountId)) {
      return
    }
    setSaving(true)
    setFailure(null)
    try {
      const next = { id: profile?.id ?? createBrowserUuid(), name: name.trim(), accountId }
      await updateSettings({
        claudeLaunchProfiles: profile
          ? profiles.map((item) => (item.id === profile.id ? next : item))
          : [...profiles, next]
      })
      setOpen(false)
    } catch (cause) {
      setFailure(
        cause instanceof Error
          ? cause.message
          : translate('claudeProfiles.saveError', 'Could not save this profile.')
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        setName(profile?.name ?? 'Claude2')
        setAccountId(profile?.accountId ?? '')
        setFailure(null)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={!profile && profiles.length >= 32}>
          {profile
            ? translate('claudeProfiles.edit', 'Edit')
            : translate('claudeProfiles.add', 'Add profile')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>{translate('claudeProfiles.name', 'Profile name')}</Label>
            <Input
              id={`${id}-name`}
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-account`}>
              {translate('claudeProfiles.account', 'Claude account')}
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id={`${id}-account`}>
                <SelectValue
                  placeholder={translate('claudeProfiles.chooseAccount', 'Choose an account')}
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.email}
                    {account.organizationName ? ` · ${account.organizationName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {translate(
              'claudeProfiles.description',
              'Uses this account in a separate Claude home. Existing conversations keep their original account.'
            )}
          </p>
          {accounts.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {translate(
                'claudeProfiles.addAccountFirst',
                'Add a Claude account in Accounts first.'
              )}
            </p>
          )}
          {(error || failure) && (
            <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
              {error || failure}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {translate('claudeProfiles.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                saving || Boolean(error) || !accounts.some((account) => account.id === accountId)
              }
            >
              {saving
                ? translate('claudeProfiles.saving', 'Saving…')
                : translate('claudeProfiles.save', 'Save profile')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function ClaudeLaunchProfiles(props: Props) {
  const profiles = props.settings.claudeLaunchProfiles ?? []
  const openAccounts = () =>
    useAppStore.getState().openSettingsTarget({ pane: 'accounts', repoId: null })
  const remove = async (profile: ClaudeLaunchProfile) => {
    try {
      await props.updateSettings({
        claudeLaunchProfiles: profiles.filter((item) => item.id !== profile.id)
      })
      toast.message(
        translate(
          'claudeProfiles.removed',
          'Profile removed. Existing sessions keep their account.'
        )
      )
    } catch {
      toast.error(translate('claudeProfiles.removeError', 'Could not remove this profile.'))
    }
  }
  return (
    <section
      className="mt-3 space-y-3"
      aria-label={translate('claudeProfiles.section', 'Claude profiles')}
    >
      <div className="flex items-center gap-2">
        <ProfileEditor {...props} />
        <Button variant="ghost" size="sm" onClick={openAccounts}>
          {translate('claudeProfiles.manageAccounts', 'Manage accounts')}
        </Button>
      </div>
      {profiles.length > 0 && (
        <ul className="space-y-2">
          {profiles.map((profile) => {
            const account = props.settings.claudeManagedAccounts.find(
              (item) => item.id === profile.accountId
            )
            return (
              <li key={profile.id} className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{profile.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account?.email ??
                      translate(
                        'claudeProfiles.reconnect',
                        'Account unavailable — edit to reconnect'
                      )}
                  </p>
                </div>
                <ProfileEditor {...props} profile={profile} />
                <Button variant="ghost" size="sm" onClick={() => void remove(profile)}>
                  {translate('claudeProfiles.remove', 'Remove')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
