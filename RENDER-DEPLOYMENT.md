# Terminal Vast — Render deployment

## User pairing flow

Users do **not** provide a SESSION_ID. They enter their own WhatsApp number on the website, request a pairing code, and enter that code in WhatsApp. Baileys creates and stores the authentication keys for that account.

## Render

- Build: `npm install`
- Start: `npm start`
- Health check: `/uptime`
- Render supplies `PORT`; the server binds to `0.0.0.0`.

## Persistence

WhatsApp auth state is stored below `WA_AUTH_DIR` (default `./sessions`). Render's ephemeral filesystem can lose these credentials after a restart/redeploy. For persistent reconnects, use a persistent disk or move auth storage to a suitable external datastore.

## Scaling

Each paired WhatsApp account is a live Baileys connection. One Render process is not a guarantee of 1000+ simultaneous accounts. High-scale deployment needs distributed session storage and multiple workers/instances.
