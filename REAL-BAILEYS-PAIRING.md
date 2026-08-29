# Real Baileys pairing API

`POST /api/pair` now creates an isolated Baileys auth directory per WhatsApp number, calls `requestPairingCode()`, and returns the code to the frontend. Credentials are persisted with Baileys `creds.update`.

Important: the current project still uses file-backed auth. Baileys documentation recommends a database-backed auth state for serious production deployments, especially at large session counts. See the official docs linked in the deployment notes.
