# Conventions — shadcn-admin

## Platform

- React + Vite SPA (TanStack Router), shadcn/ui (Radix primitives) + Tailwind.
- All data is mock/local (faker-style generated tasks, users, chats). No real backend observed;
  no destructive action (create/edit/delete submit, sign-out) was exercised during exploration.
- The a11y tree is the source of truth. Most interactive elements have real ARIA roles/names via
  Radix; a minority of icon-only buttons carry no accessible name (see quirks below).

## Driver

**Playwright CLI** (`playwright-cli`), per the explore-ui skill's ordered preference.

### Setup quirk: Chrome install location

`playwright-cli`'s default `--browser=chrome` channel looks for a system-installed Chrome at the
hardcoded path `/Applications/Google Chrome.app`. On this machine Chrome is installed under
`~/Applications/Google Chrome.app` instead, and `/Applications` is not user-writable (no sudo, no
admin group membership) — so the default channel fails with "Chromium distribution 'chrome' is not
found". `npx playwright install chrome` also fails the same way (it tries to write outside the
user-writable cache when installing OS-level deps).

**Fix**: use bundled Chromium instead of the system-Chrome channel, via `.playwright/cli.config.json`
at the project root:

```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": { "channel": "chromium" }
  }
}
```

With this config, `playwright-cli open` downloads/uses the Playwright-managed Chromium build
(already cached from other local projects) instead of touching `/Applications`. Any future
exploration/test-writing pass on this project should keep this config file or reproduce it before
driving the app.

## Environment

- Dev server: `pnpm dev` (Vite), default `http://localhost:5173/`. `pnpm install` was required
  first (`node_modules` was absent).
- No auth/login was required to reach any authenticated screen — the app renders already
  "signed in" as a mock user (`satnaing`, avatar initials `SN`). The `/sign-in`, `/sign-up`,
  `/forgot-password`, `/otp` pages exist and render standalone (no sidebar/header) but nothing
  gates the rest of the app behind them in this build.
- A `Secured by Clerk` sidebar button is present but not wired to a visible auth requirement.

## Selector strategy, ordered

1. Prefer Playwright role locators (`getByRole` with an accessible name) — most components expose
   proper ARIA via Radix.
2. For icon-only buttons with no accessible name, target by position/context (documented per
   element as `disambiguation` or a `quirks` note) rather than a fragile CSS path.
3. Use `getByPlaceholder` for the few text inputs identified only by placeholder.
4. Never author a selector from a screenshot; always read it off the driver's own snapshot.
5. Re-snapshot after every navigation/dialog open/close — refs (`eNN`) are only valid for the
   snapshot they came from, and get a per-page prefix (`f1eNN`, `f2eNN`, ...) after a `goto`.
6. `playwright-cli` writes snapshot files relative to the shell's cwd, not `.playwright-cli/`,
   when `--filename` is a bare name — move them into `.playwright-cli/` after each call, or read
   straight from wherever they land.
7. A snapshot taken immediately after `goto`/`click` can come back empty (SPA mount delay) —
   always re-snapshot once before treating a screen as unreachable.

## Known cross-app quirks

- Radix dropdown/select menus render via portal and only appear in the snapshot **after** a
  fresh `snapshot` call post-click; the click's own echoed snapshot can be stale.
- Several icon-only buttons carry no accessible name app-wide: theme toggle vs. theme-settings
  are both present in the header but only the latter opens a dialog; chat header call/video/info
  icons; chat/apps sort dropdowns. Each is called out per-element in its feature file.
- Command palette (`cmdk`) option rows show blank text in the compact accessibility snapshot even
  though they do have an accessible name — use `eval(el => el.textContent)` or `getByRole('option',
  { name })` to read it, don't trust the printed snapshot alone.
- TanStack Query/Router devtool trigger buttons ("Open Tanstack query devtools", "Open TanStack
  Router Devtools") appear on every screen; they are dev-only tooling, not app features, and were
  excluded from every feature file.
