# Taman Kuda Club — Frontend

React + TypeScript + Vite + [Mantine](https://mantine.dev) SPA for the internal
operations app. Responsive (mobile + tablet), installable as a PWA later.

## Dev

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` → `http://localhost:8000`, so run the backend
alongside it. Sign in with the seeded admin (`admin@tamankuda.club`).

## Structure

| Path | Purpose |
|---|---|
| `src/api/` | typed fetch client (`client.ts`) + shared `types.ts` |
| `src/auth/` | `AuthContext` — session, `me`, `can(capability)` RBAC helper |
| `src/components/AppLayout.tsx` | responsive app shell (collapsible navbar) |
| `src/components/TemplateEditor.tsx` | modal form to build/edit a template's recurring slots |
| `src/components/ShiftModal.tsx` | add / edit / delete an individual shift |
| `src/pages/` | `LoginPage`, `SchedulePage` (week view, add/edit shifts, assign), `TemplatesPage` (CRUD + apply), `ActivitiesPage`, `PeoplePage`, `RolesPage` |

Nav items and actions are gated by the signed-in user's capabilities
(`useAuth().can(...)`). Data fetching uses TanStack Query. The app calls the API
at the relative `/api` base, so the same build works in dev (Vite proxy) and
prod (Caddy same-origin).

## Build

```bash
npm run build      # tsc + vite build -> dist/
```

## Next iteration (not yet built)

Calendar grid with drag-to-assign, and the staff check-in / expense flow.
