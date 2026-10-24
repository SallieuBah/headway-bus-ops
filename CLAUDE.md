# Headway Bus Ops

Bus operations management web app: live fleet map, dispatch schedule, drivers, lines and stops, maintenance board, coach seat ticketing, alerts, reports and a driver phone app. Built to become a mobile app later (PWA now, Capacitor wrap planned).

- **Live site:** https://sallieubah.github.io/headway-bus-ops/ (GitHub Pages, deploys automatically from `main`, repo root)
- **Repo:** https://github.com/SallieuBah/headway-bus-ops (public; never commit secrets or personal email addresses)
- **Backend:** Supabase project `headway-bus-ops`, ref `zkcgsplfyexlhqslkozv`, region eu-central-1 (Frankfurt), free plan

## Stack and conventions

- Plain HTML, CSS and JavaScript. **No build step, no framework, no npm dependencies.** Keep it that way so it stays easy to wrap with Capacitor.
- `supabase-js` is loaded as a UMD script from jsDelivr (pinned `@2.49.4`) in `index.html`.
- All app code is one IIFE in `app.js`; all styles in `app.css` using CSS custom-property tokens (light values on `:root`, dark overrides under `prefers-color-scheme` and `[data-theme="dark"]`). Use tokens, never literal colors in components.
- Fonts: Barlow Condensed (display), Barlow (body), JetBrains Mono (data/IDs).
- Responsive: sidebar above 960px, bottom tab bar below. Respect safe-area insets.
- Copy is plain and specific; errors say what went wrong and how to fix it.
- **English only for now.** Don't add translations or a language switch unless the owner asks.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Real app entry: loads supabase-js, `config.js`, `app.js`, registers `sw.js` |
| `config.js` | Supabase URL and public anon key (safe to ship; RLS protects data). Remove it to force demo mode |
| `app.js` | Sign-in, cloud sync, simulation, all screens |
| `app.css` | Tokens, themes, layout |
| `sw.js` | Offline cache. **Bump `CACHE` (e.g. `headway-v3`) whenever app files change**, or installed users keep old files |
| `manifest.webmanifest`, `icon.svg` | PWA install |
| `artifact.html` | Demo-only entry for the Claude artifact preview (no config, so it runs in local demo mode) |

## How app.js works

- **One state object `S`** that every view renders from. Views live in `VIEWS.<name>` with `render(el)` and optional `tick()` (called every second). Routing is by `location.hash` (`#dashboard`, `#map`, `#fleet`, ...).
- **Modes:** `MODE === 'local'` (demo, state in localStorage key `headway.v2`) or `'cloud'` (signed in). The sign-in page offers "Explore the demo without an account".
- **Saving:** screens mutate `S` and call `save()`. In cloud mode `sync()` diffs each collection against the last server snapshot (`snap`) and sends inserts, per-row updates and deletes. The mapping between DB rows and app objects is the `TABLES` object (`to` / `from` per table). When adding a column or table, update `TABLES`, `loadCloud()` and the migration together.
- **Realtime:** `subscribeCloud()` listens to `postgres_changes` on every table; `applyRemote()` merges changes into `S` and re-renders (skipped while a modal or input is focused).
- **Reports:** ticket sales, alerts and maintenance are recorded data (cloud mode calls the report functions, cached for a minute; today's sales come from `S`). Boardings and on-time performance are modelled from `paxSoFar()` and `delayAt()`, and are labelled "Modelled" in the UI.
- **Simulation:** bus positions, delays, load and energy are pure functions of the clock (`simulate()`), so every device shows the same picture without a server. Scripted incidents use a deterministic id per 150 s window (`sim-<n>`) and are inserted with ignore-duplicates. Replace `simulate()` with a real AVL/GPS feed to go live.
- **Roles in the UI:** `role()`, `can(perm)`, `guard(perm)` and `PERMS` / `HIDDEN` control what each role sees and can click. The UI is convenience only; the database enforces the rules.

## Database (Supabase)

Tables in `public`: `routes`, `drivers`, `buses`, `profiles`, `alerts`, `work_orders`, `bookings` (unique per date + departure + seat), `messages`, `trip_overrides`, `driver_shifts`, `settings` (single row, id 1). All have RLS enabled and are in the `supabase_realtime` publication.

Roles live in `profiles.role`: `admin`, `dispatcher`, `mechanic`, `driver`, `viewer`.

| Role | Can |
| --- | --- |
| admin | Everything, including lines, fleet records, settings, team roles |
| dispatcher | Dispatch, schedule changes, alerts, driver status, messages, ticket sales |
| mechanic | Work orders and vehicle status |
| driver | Own shift (`profiles.driver_id`), raising alerts |
| viewer | Read-only operations data (no bookings: passenger names) |

- Report functions `public.report_ticket_sales(from_date, to_date)` and `public.report_alerts(from_ts, to_ts, tz)` return grouped totals for the Reports screen (no passenger names). They are `security invoker`, so the caller's RLS applies, and only `authenticated` may execute them.
- Helper functions are in the **`private`** schema (not exposed by the API): `private.app_role()`, `private.my_driver_id()`, `private.handle_new_user()` (trigger on `auth.users` that creates the profile).
- New sign-ups become `admin` only if their email is listed in `private.admin_emails`; everyone else starts as `viewer`. Admins change roles in the app under Preferences → Team & roles.
- Policies use `(select private.app_role())` and one permissive policy per action (avoids the multiple-permissive-policies advisor warning).

### Changing the database

- Use the Supabase connector: `apply_migration` for DDL, `execute_sql` for queries.
- After every schema change run `get_advisors` for **security** and **performance** and fix findings.
- To test policies without creating real accounts, run a `do $$ ... $$` block that inserts test users into `auth.users`, switches `set local role authenticated` with `request.jwt.claims`, checks results, then ends with `raise exception` so everything rolls back.
- Auth URL settings (Site URL and redirect URLs) point to the live site; they are changed in the Supabase dashboard, not by migration.

## Run and test locally

Serve the folder with any static server and open `index.html`, for example `npx serve .` or `python -m http.server`. Sign in, or use the demo link. Check the browser console for errors and test at phone width (about 400px) and in dark mode.

## Deploying

Push to `main`. GitHub Pages rebuilds in about a minute. Remember to bump `CACHE` in `sw.js` when app files change. Commit messages end with the co-author line used in the existing history.

## Ideas not built yet

- Real GPS/AVL feed replacing the simulation
- Capacitor build for App Store and Google Play
- Custom SMTP in Supabase so teammates receive confirmation emails reliably
