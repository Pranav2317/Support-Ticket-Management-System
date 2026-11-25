# Helpdesk — Support Ticket Management System

A mini helpdesk where **users** raise support tickets and **admins** triage, assign, and resolve them. It is built with **Node.js, Express, MongoDB (Mongoose), and React**. It includes JWT auth, role-based access control, an event-driven activity log and notification system, a stats dashboard, and automated API tests.

> **Live demo:** [https://helpdesk-im0t.onrender.com](https://helpdesk-im0t.onrender.com) (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))
>
> Demo accounts (created by the seed script):
> | Role  | Email               | Password    |
> |-------|---------------------|-------------|
> | Admin | admin@helpdesk.dev  | Admin@1234  |
> | Admin | agent@helpdesk.dev  | Agent@1234  |
> | User  | user@helpdesk.dev   | User@1234   |

---

## Features

**Authentication & authorization**
- Register and log in with a JWT (Bearer token). Passwords are hashed with bcrypt (cost 12).
- Two roles, `user` and `admin`. Public sign-up always creates a `user`. Admins come from the seed script (or are promoted in the DB), so nobody can self-register as admin.
- Every protected route reloads the user from the DB, so a deleted user or a changed role takes effect immediately.

**Tickets (users)**
- Create, view, edit, and delete their own tickets. Fields: title, description, category, priority, and status, plus an auto-generated number (`TCK-1001`).
- Editing and deleting is allowed **only while a ticket is `open`**. Once support starts working on it, the ticket is locked, but comments are still allowed.
- Track status and see the full activity timeline of each ticket.

**Admin**
- View all tickets. Filter by status, priority, category, and assignee. Search by text or ticket number. Sort and paginate.
- Change status (validated state machine), change priority, assign to an admin, edit or delete any ticket.
- Dashboard with counts by status and priority, unassigned active tickets, and average resolution time.

**Comments**
- Owners comment on their own tickets. Admins can reply on any ticket.
- Users cannot comment on `closed` tickets; an admin must reopen them first.

**Event-driven workflow** (see [Events](#event-driven-architecture))
- `ticket.created`, `ticket.updated`, `ticket.status_changed`, `ticket.resolved`, `ticket.assigned`, `ticket.deleted`, `comment.added`
- Handlers: **activity log** (audit trail), **in-app notifications** (bell icon with unread count), **email** (SMTP via Nodemailer, or console output in dev).

**Bonus items covered:** search and pagination, sorting and filtering, dashboard stats, email notifications, 24 automated API tests, React frontend, and Docker support.

---

## Tech stack

| Layer      | Choice | Why |
|------------|--------|-----|
| Runtime    | Node.js 18+ / Express 5 | Express 5 forwards async errors to the error handler natively, so there are no try/catch wrappers. |
| Database   | MongoDB + Mongoose 8 | The ticket/comment/activity shape is document-friendly; Mongoose gives schema validation and indexes. |
| Validation | Zod | One declarative schema per request; coerces query strings and strips unknown fields. |
| Auth       | jsonwebtoken + bcryptjs | Stateless JWT, salted hashes. |
| Security   | helmet, cors, express-rate-limit, Mongoose `sanitizeFilter` | Secure headers, an origin allow-list, brute-force limits on auth, and NoSQL-injection protection. |
| Frontend   | React 18 + Vite + React Router | A small SPA with no UI framework, plain CSS with light and dark themes. |
| Tests      | Jest + Supertest + mongodb-memory-server | Real HTTP requests against a real (in-memory) MongoDB. |

---

## Getting started

### Prerequisites
- Node.js 18+ (developed on Node 24)
- MongoDB is **optional for local dev**. If `MONGODB_URI` is not set, the server starts an in-memory MongoDB and seeds demo data automatically. The first run downloads the MongoDB binary (~600 MB, cached afterwards).

### 1. Backend
```bash
cd server
cp .env.example .env        # optional: set MONGODB_URI / JWT_SECRET
npm install
npm run dev                 # http://localhost:5000/api
```
With a real MongoDB, run `npm run seed` once to create the demo accounts and tickets.

### 2. Frontend
```bash
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :5000)
```

### 3. Tests
```bash
cd server
npm test
```

### Docker (API + frontend + MongoDB)
```bash
docker compose up --build   # http://localhost:5000
docker compose exec api npm run seed
```

### Environment variables (`server/.env`)
| Variable | Default | Notes |
|---|---|---|
| `PORT` | `5000` | |
| `NODE_ENV` | `development` | `production` makes `MONGODB_URI` and `JWT_SECRET` mandatory |
| `MONGODB_URI` | *(empty → in-memory DB)* | e.g. `mongodb://localhost:27017/helpdesk` or an Atlas URI |
| `JWT_SECRET` | dev fallback | **Required in production.** Use a long random string. |
| `JWT_EXPIRES_IN` | `1d` | |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allow-list (comma-separated) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | *(empty)* | Without SMTP, emails are logged to the console |

---

## Project structure

```
support-ticket-system/
├── server/
│   ├── src/
│   │   ├── app.js               # Express app (middleware, routes, static client)
│   │   ├── server.js            # Bootstrap: DB connect, listen, graceful shutdown
│   │   ├── config/              # env, db connection, constants (roles, statuses, transitions)
│   │   ├── models/              # User, Ticket, Comment, ActivityLog, Notification, Counter
│   │   ├── validators/          # Zod request schemas
│   │   ├── middleware/          # authenticate/authorize, validate, error handler
│   │   ├── routes/              # Route table (URL -> middleware -> controller)
│   │   ├── controllers/         # Thin HTTP layer
│   │   ├── services/            # Business rules + data access + event publishing
│   │   ├── events/              # Event bus, event types, handlers (activity log, notifications, email)
│   │   └── scripts/seed.js      # Demo data
│   └── tests/                   # Jest + Supertest API tests
├── client/                      # React SPA (Vite)
├── docs/
│   ├── API.md                   # REST API reference
│   ├── DATABASE.md              # Schema, relationships, indexes, design decisions
│   ├── DEPLOYMENT.md            # Render + MongoDB Atlas guide
│   └── helpdesk.postman_collection.json
├── Dockerfile
└── docker-compose.yml
```

**Request flow:** `route → authenticate → authorize(role) → validate(zod) → controller → service → model`, then `service → eventBus.publish() → handlers`.

---

## Implementation decisions

1. **Layered architecture.** Controllers only translate HTTP to and from service calls. All business rules (ownership, edit locks, status transitions) live in `services/`, so they are testable and reusable. For example, the seed script drives the same services the API uses, so seeding also produces a real activity log.
2. **Authorization in two layers.** Route-level role guards (`authorize('admin')`) cover admin-only endpoints. Resource-level checks in the service (`getAccessibleTicket`) make sure users only touch their own tickets. Non-owners get **404 rather than 403**, so the API never confirms that another user's ticket id exists.
3. **Status as a state machine.** `open ⇄ in_progress → resolved → closed`, with reopen paths (`resolved → in_progress`, `closed → open`). Invalid jumps return 400. The frontend reads the same transition table, so it only offers valid moves. `resolvedAt` and `closedAt` timestamps feed the "average resolution time" stat.
4. **Validation at the edge.** Every body, query, and param goes through Zod before the controller runs. Unknown fields are rejected on update (`.strict()`), so a user cannot sneak `status` or `createdBy` into `PATCH /tickets/:id`. Mongoose schema validation is a second line of defence.
5. **Consistent error format.** `{ success: false, message, errors?: [{ field, message }] }`. Mongoose validation, cast, and duplicate-key errors are mapped to 400 and 409. Unknown errors become a generic 500 with no stack-trace leak.
6. **Human-friendly ticket numbers** come from an atomic `$inc` counter document, so they are race-free under concurrent creates.
7. **Priority sorting.** Priorities are strings, so sorting them alphabetically would be wrong (`high < low < medium < urgent`). A hidden numeric `priorityRank` field is kept in sync by a schema hook and used for sorting.
8. **Deleting a ticket** removes its comments and notifications but **keeps its activity log**. The log stores `ticketNumber` as plain text, so the audit trail stays readable after deletion.
9. **Single deployable.** In production Express also serves the built React app, so one service with one URL needs no CORS setup.
10. **Token storage.** The JWT is stored in `localStorage` for simplicity. In production I would move it to an `httpOnly`, `SameSite` cookie with a refresh-token rotation, to reduce XSS exposure.

---

## Event-driven architecture

```
 Service (after the DB write succeeds)
   │  eventBus.publish('ticket.status_changed', { ticket, actor, changes })
   ▼
 EventBus ──► activityLog handler  → ActivityLog collection (every event)
          ──► notification handler → Notification docs for the right recipients
          ──► email handler        → Nodemailer (staff actions → ticket owner)
```

- **In-process bus** (`server/src/events/eventBus.js`). Handlers subscribe per event or to `'*'`. They run concurrently with `Promise.allSettled`, so **a failing handler never fails the request or the other handlers** (this is covered by a test).
- **Who is notified:**
  - New ticket → all admins.
  - Customer comment or edit → the assigned agent, or all admins if the ticket is unassigned.
  - Admin comment, status change, or resolution → the ticket owner.
  - Assignment → the assignee.
  - The person who caused the event is never notified.
  - A move to `resolved` sends a single "resolved" notification, not a duplicate "status changed" one.
- **Email** is sent fire-and-forget, so slow SMTP never slows the API.
- **Scaling path:** the bus has the same `publish/subscribe` shape as a message broker. Moving to Redis Streams, RabbitMQ, or BullMQ (for retries and multiple instances) only changes `eventBus.js`; services and handlers stay the same.

---

## API & database docs

- REST reference: [docs/API.md](docs/API.md)
- Postman collection: [docs/helpdesk.postman_collection.json](docs/helpdesk.postman_collection.json). Run **Login (admin)** or **Login (user)** first; the token is saved to a collection variable automatically.
- Database design: [docs/DATABASE.md](docs/DATABASE.md)

## Testing

`server/tests` contains 24 integration tests across 3 suites, run against an in-memory MongoDB:
- **auth**: registration (including the role-escalation attempt), duplicates, validation, login, generic error messages, NoSQL injection, token checks
- **tickets**: ownership isolation (404s), edit and delete locks, the status state machine, assignment rules, filtering, search, priority sorting, pagination, role-scoped stats
- **events**: comment rules, activity-log sequence, notification routing (no self-notify, no duplicates), audit trail kept after delete, handler failure isolation

## Possible improvements
- httpOnly cookie auth with refresh tokens; password reset by email
- Real-time notifications over WebSockets/SSE instead of 30-second polling
- File attachments on tickets (S3), SLA timers, and canned replies for agents
- A message broker for events, so handlers can retry and run on multiple instances
