Event & Trip Planning System (Frontend, Mocked)
==============================================

Stack: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 (postcss plugin).

This is a fully functional UI for managing multi-day events with participants, locations and movements. It uses a mock API with local state and localStorage to simulate CRUD until a real backend is available.

Quick Start
-----------

```bash
npm install
npm run dev
# open http://localhost:3000
```

Login
-----
- Admin or Participant mock login at `/login`
- Session is stored in localStorage (`ps:session`)
- Admin routes: `/admin/**`
- Participant portal: `/portal`

App Structure
-------------
- Auth & session: `lib/session.ts`
- Domain types: `lib/types.ts`
- Mock data seeds: `lib/mockData.ts`
- Mock API service: `lib/mockApi.ts` (REST-like paths, latency, localStorage persistence)
- Storage helpers: `lib/storage.ts`
- Admin layout: `components/layout/AdminLayout.tsx`
- Participant layout: `components/layout/ParticipantLayout.tsx`
- Basic UI elements: `components/ui/*`

Primary Screens
---------------
- `/login` – choose Admin or Participant
- `/admin` – Admin Dashboard: list/create/delete events
- `/admin/events/[eventId]` – Event view with tabs:
  - Days (links to Day Editor)
  - Participants (for this event)
  - Locations (used in this event)
  - Documents (placeholder)
  - Global Timeline (readonly)
- `/admin/events/[eventId]/days/[dayId]` – Day Editor
  - Create/Edit/Delete blocks
  - Reorder (up/down) with persisted order
  - Assign participants
  - Select locations (activity/break vs movement start/end)
  - Block types: activity | movement | break
- `/admin/participants` – Participant Manager (CRUD, view assigned blocks)
- `/admin/locations` – Location Manager (CRUD, reusable across events)
- `/admin/events/[eventId]/itinerary` – Itinerary views
  - Full event schedule
  - Day schedule
  - Per-participant schedule
  - Mock PDF export via `window.print()`
- `/portal` – Participant Portal (“My Agenda”) with daily timeline and attachments

Mock API
--------
- Local in-memory store persisted to localStorage under key `ps:mockStore:v1`
- Simulates network latency with `setTimeout`
- REST-like endpoints (examples):
  - `GET /events` → `{ items: Event[] }`
  - `POST /events` → `{ item: Event }`
  - `GET /events/:eventId/days` → `{ items: Day[] }`
  - `POST /events/:eventId/days` → `{ item: Day }`
  - `POST /events/:eventId/days/:dayId/blocks` → `{ item: Block }`
  - `PUT /events/:eventId/days/:dayId/blocks/:blockId` → `{ item: Block }`
  - `POST /events/:eventId/days/:dayId/blocks/reorder` → `{ items: Block[] }`
  - `GET /participants` / `PUT /participants/:id` / `DELETE /participants/:id`
  - `GET /locations` / `PUT /locations/:id` / `DELETE /locations/:id`
  - `GET /agenda/:participantId` → participant’s blocks across days
  - `GET /itinerary/event/:eventId` → aggregated event schedule

Usage example:
```ts
import { mockApi } from "@/lib/mockApi";
const { items } = await mockApi.get<{ items: Event[] }>("/events");
```

Replacing with a Real API
-------------------------
The UI only depends on `mockApi.{get,post,put,delete}` signatures. To integrate a real backend with minimal changes:
1. Create `lib/api.ts` with the same exported shape as `mockApi`:
   - `get(path: string)`, `post(path: string, body?: any)`, `put(path: string, body?: any)`, `delete(path: string)`
   - Return the same response shapes used in the UI (`{ items: T[] }`, `{ item: T }`)
2. Swap imports from `lib/mockApi` to `lib/api` (or re-export in `mockApi.ts` during transition).
3. Preserve the path semantics (e.g., `/events/:eventId/days`) or update the small number of call sites.

Tailwind
--------
- Tailwind CSS v4 via `@tailwindcss/postcss`
- Styles are applied with utility classes; no custom config required by default

Notes
-----
- All data is mock and will reset if localStorage is cleared.
- PDF export is a mock using `window.print()`; replace with a proper HTML-to-PDF solution later if needed.

