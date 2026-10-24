# Headway Bus Ops

A bus operations management web app: live fleet map, dispatch schedule, drivers, lines and stops, maintenance board, coach seat ticketing, alerts, reports and a driver phone app.

Plain HTML, CSS and JavaScript with no build step. It is responsive (sidebar on desktop, bottom tab bar on phones) and ships as an installable PWA, ready to wrap with Capacitor for the App Store and Google Play.

## Run locally

Serve the folder with any static web server and open `index.html`, for example:

```bash
npx serve .
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App entry page with PWA manifest and service worker |
| `app.js` | Data model, live simulation and all screens |
| `app.css` | Design tokens, light/dark themes, responsive layout |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | Installable app and offline support |
| `artifact.html` | Entry page used for the Claude artifact preview |

## Status

Bus positions, delays and passenger counts are simulated, and data is saved in the browser's local storage. Next steps: a backend with logins and roles, live GPS/AVL feeds, and a Capacitor mobile build.
