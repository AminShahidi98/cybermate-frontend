# Cybermate frontend

React + TypeScript single-page app (built with Vite) for the Cybermate CRM API in `../backend`.

## Requirements

- Node.js 18 or newer (includes `npm`)
- The Django backend running on http://localhost:8000

## Run in development

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with a user's **email** and password.

During development, Vite forwards every `/api/...` request to `http://localhost:8000`
(see `vite.config.ts`), so the backend needs no CORS setup.

## Other commands

- `npm run typecheck`: check the TypeScript types
- `npm run build`: type-check, then build static files into `dist/`
- `npm run preview`: serve the built `dist/` locally

## What's where

| Path | Purpose |
|---|---|
| `src/api/client.ts` | `fetch` wrapper: adds the JWT, refreshes it on 401, formats DRF errors |
| `src/api/types.ts` | TypeScript types and labels matching the API |
| `src/auth/AuthContext.tsx` | Logged-in user and their role (admin / manager / employee) |
| `src/components/` | Layout (sidebar) and shared UI pieces (modal, table helpers, badges) |
| `src/pages/` | One file per screen |

## What each role sees

- **Employee**: own timesheets (log, edit, submit), own leave requests (request, edit, cancel), own contracts, profile.
- **Manager**: everything an employee sees, plus everyone's timesheets and leave with approve/reject, and contract management.
- **Admin**: everything a manager sees, plus Users and Roles.

Django staff/superuser accounts count as admins, matching the backend's permission rules.
