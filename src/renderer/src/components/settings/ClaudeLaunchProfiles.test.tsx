// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { ClaudeLaunchProfiles } from './ClaudeLaunchProfiles'

const openSettingsTarget = vi.hoisted(() => vi.fn())
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ openSettingsTarget }) } }))
vi.mock('sonner', () => ({ toast: { message: vi.fn(), error: vi.fn() } }))
afterEach(cleanup)

describe('Claude profile settings', () => {
  const settings = () => ({
    ...getDefaultSettings('/tmp'),
    claudeLaunchProfiles: [{ id: 'work', name: 'Claude work', accountId: 'a' }]
  })
  it('shows a missing account without silently selecting another one', () => {
    render(<ClaudeLaunchProfiles settings={settings()} updateSettings={vi.fn()} />)
    expect(screen.getByText('Account unavailable — edit to reconnect')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('button', { name: 'Save profile' }).hasAttribute('disabled')).toBe(true)
  })
  it('rejects a duplicate profile name and explains where to add an account', () => {
    render(<ClaudeLaunchProfiles settings={settings()} updateSettings={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add profile' }))
    fireEvent.change(screen.getByLabelText('Profile name'), { target: { value: 'Claude work' } })
    expect(screen.getByRole('alert').textContent).toContain('already exists')
    expect(screen.getByText('Add a Claude account in Accounts first.')).toBeTruthy()
  })
  it('removes the launcher without deleting credentials or changing the selected account', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined)
    render(<ClaudeLaunchProfiles settings={settings()} updateSettings={updateSettings} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ claudeLaunchProfiles: [] }))
  })
  it('keeps account registration in the existing Accounts pane', () => {
    render(<ClaudeLaunchProfiles settings={settings()} updateSettings={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Manage accounts' }))
    expect(openSettingsTarget).toHaveBeenCalledWith({ pane: 'accounts', repoId: null })
  })
})
