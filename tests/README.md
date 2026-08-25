# shadcn-admin — Playwright e2e suite

Covers all 9 workflows registered in `docs/argus/manifest.yaml` (the Argus app flow model).

## Run

```bash
pnpm test:e2e                                                    # type-check + full suite
node node_modules/@playwright/test/cli.js test tests/tests/tasks/tasks.spec.ts   # a single spec
node node_modules/@playwright/test/cli.js show-report            # last HTML report
```

**Do not run `npx playwright test` or `node_modules/.bin/playwright`.** This project also has a
direct `playwright@1.59.1` devDependency (for the unrelated `vitest-browser-react` component
tests) whose CLI shim wins that resolution — it loads a different `@playwright/test` internals
than the one our spec files import, which fails every test with "Playwright Test did not expect
test() to be called here". Always invoke `node node_modules/@playwright/test/cli.js` (or the
`pnpm test:e2e` script, which already does this) to get the `@playwright/test@1.62.1` binary that
actually matches what the specs import.

`playwright.config.ts` starts `pnpm dev` automatically if `http://localhost:5173` isn't already
serving (`webServer.reuseExistingServer: true` — reuses a dev server you already have running).
Override the target with `BASE_URL=http://... pnpm test:e2e`.

## App map (from `docs/argus/`)

React + Vite SPA, shadcn/ui (Radix) components. All data is local mock data — no real backend was
found during exploration, and no login gate exists in this build (`/sign-in` etc. render but
nothing currently requires them). See `docs/argus/conventions.md` for the full platform notes and
`docs/argus/manifest.yaml` for the feature/workflow index.

| Spec | Workflow(s) |
|---|---|
| `tests/dashboard/dashboard.spec.ts` | `wf.dashboard_analytics` |
| `tests/shell/shell.spec.ts` | `wf.command_palette_navigate`, `wf.customize_theme` |
| `tests/tasks/tasks.spec.ts` | `wf.create_task_dialog` (cancel + full submit), `wf.task_row_actions` |
| `tests/users/users.spec.ts` | `wf.invite_user` (cancel + full submit) |
| `tests/chats/chats.spec.ts` | `wf.start_chat` |
| `tests/auth/auth.spec.ts` | `wf.auth_navigation_loop` |
| `tests/errors/errors.spec.ts` | `wf.error_page_recovery` |

## Caveats

- **`wf.create_task_dialog` and `wf.invite_user` each have two tests: a cancel path and a full
  submit path.** Probed live before writing the submit assertions: this build has **no real
  backend** for either form — clicking Save/Invite only shows a toast ("You submitted the
  following values:") echoing the payload as JSON; the table gains no row and the page count
  doesn't change. The tests assert exactly that (toast + payload), not a persisted row. If a real
  create/invite API ever gets wired up, these are the first two tests to rewrite (assert the new
  row instead of the toast).
- **Every other dialog test still only closes/cancels rather than submitting** (Settings'
  Update-*, the auth forms, Users' Add User) — the model doesn't yet know what those specific
  submissions do (`gap.settings_form_submit_effects`, `gap.auth_backend_behavior`, and friends in
  `docs/argus/gaps.yaml`), and they weren't in this pass's scope to probe.
- **`chats.spec.ts` targets the conversation named "Alex John"** — the mock chat list looks
  hand-authored (not `faker`-randomized like tasks/users), so this should be stable across dev
  server restarts, but if the mock data source ever changes this is the first thing to update.
- **Tasks/Users tables use randomized mock data** (row content, page counts) generated once when
  the app boots; specs only assert structure (dialog opens, menu items present), never on
  specific row content, so they stay valid across restarts.
- 9 of 9 workflows in `docs/argus/manifest.yaml` are covered. Everything else in `gaps.yaml`
  (column-visibility popovers, Edit-dialog prefill, RTL layout, etc.) is intentionally untested —
  each is either not part of a modeled workflow or actively blocked by an open gap.
