# Electron end-to-end tests

Exercises user flows against the built Orca application through Playwright.

Use `tests/playwright.config.ts`; shared launch and fixture helpers live in `helpers/`. `claude-launch-profiles.spec.ts` covers profile editing with synthetic accounts in light and dark themes. Runtime authentication tests belong to [Claude accounts](../../src/main/claude-accounts/README.md).
