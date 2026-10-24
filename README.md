# Headway Bus Ops

A bus operations management web app: live fleet map, dispatch schedule, drivers, lines and stops, maintenance board, coach seat ticketing, alerts, reports and a driver phone app.

Plain HTML, CSS and JavaScript with no build step. It is responsive (sidebar on desktop, bottom tab bar on phones) and ships as an installable PWA, ready to wrap with Capacitor for the App Store and Google Play.

## Backend

Data, sign-in and live updates run on [Supabase](https://supabase.com) (project `headway-bus-ops`, Frankfurt).

- **Sign-in:** email and password. Addresses listed in the database table `private.admin_emails` become Admin when they sign up; everyone else starts as Viewer.
- **Shared data:** lines, fleet, drivers, alerts, work orders, coach bookings, dispatch messages, trip changes, driver shifts and workspace settings live in Postgres.
- **Live updates:** every open screen receives changes from other users instantly (Supabase Realtime).
- **Roles,** enforced by row level security in the database, not only in the UI:

| Role | Can |
| --- | --- |
| Admin | Everything, including lines, fleet records, settings and team roles |
| Dispatcher | Dispatch, schedule changes, alerts, driver status, messages, ticket sales |
| Mechanic | Work orders and vehicle status |
| Driver | Their own shift in the driver app, and issue reports |
| Viewer | Read-only access to operations |

Admins assign roles under **Preferences → Team & roles**.

`config.js` holds the project URL and the public anon key. That key is safe to ship: the database policies decide what each signed-in role can do. Delete `config.js` to run the app as a standalone demo that keeps data in the browser.

## Run locally

Serve the folder with any static web server and open `index.html`, for example:

```bash
npx serve .
```

On the sign-in page, **Explore the demo without an account** runs the full app on sample data in your browser.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App entry page with PWA manifest and service worker |
| `config.js` | Supabase project URL and public key |
| `app.js` | Sign-in, data sync, live simulation and all screens |
| `app.css` | Design tokens, light/dark themes, responsive layout |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | Installable app and offline support |
| `artifact.html` | Entry page for the demo-only Claude artifact preview |

## Status

Bus positions, delays and passenger counts are simulated from the clock, so every signed-in screen shows the same picture. Connect an AVL/GPS feed to replace the simulation with real positions.
