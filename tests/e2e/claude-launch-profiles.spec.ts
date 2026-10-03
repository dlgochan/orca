import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

test.use({ seedTestRepo: false })

for (const theme of ['light', 'dark'] as const) {
  test(`adds a named Claude account launcher in Agent settings (${theme})`, async ({
    orcaPage,
    registerPostElectronShutdownCleanup
  }, testInfo) => {
    const root = mkdtempSync(join(tmpdir(), 'orca-profile-settings-'))
    registerPostElectronShutdownCleanup(async () => rmSync(root, { recursive: true, force: true }))
    await waitForSessionReady(orcaPage)
    await orcaPage.setViewportSize({ width: 1440, height: 1000 })
    await orcaPage.evaluate(
      async ({ root, theme }) => {
        const state = window.__store!.getState()
        await state.updateSettingsOrThrow({
          theme,
          claudeLaunchProfiles: [],
          claudeManagedAccounts: [
            {
              id: 'profile-test',
              email: 'work@example.com',
              managedAuthPath: root,
              authMethod: 'subscription-oauth',
              createdAt: 1,
              updatedAt: 1,
              lastAuthenticatedAt: 1
            }
          ]
        })
        state.openSettingsTarget({ pane: 'agents', repoId: null })
        state.openSettingsPage()
      },
      { root, theme }
    )
    await orcaPage.getByRole('button', { name: 'Add profile', exact: true }).click()
    await orcaPage.getByLabel('Profile name', { exact: true }).fill('Claude2')
    await orcaPage.getByRole('combobox', { name: 'Claude account' }).click()
    await orcaPage.getByRole('option', { name: 'work@example.com' }).click()
    await orcaPage.getByRole('button', { name: 'Save profile', exact: true }).click()
    const profiles = orcaPage.getByRole('region', { name: 'Claude profiles' })
    await expect(profiles.getByText('Claude2', { exact: true })).toBeVisible()
    await expect(profiles.getByText('work@example.com', { exact: true })).toBeVisible()
    const screenshot = testInfo.outputPath(`claude-profiles-${theme}.png`)
    await orcaPage.screenshot({ path: screenshot, animations: 'disabled' })
    await testInfo.attach(`claude-profiles-${theme}`, {
      path: screenshot,
      contentType: 'image/png'
    })
    await profiles.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(profiles.getByText('Claude2', { exact: true })).toHaveCount(0)
    await expect(profiles.getByRole('button', { name: 'Add profile', exact: true })).toBeVisible()
  })
}
