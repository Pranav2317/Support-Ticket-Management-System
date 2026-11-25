# API Reference

Base URL: `/api` (local: `http://localhost:5000/api`)

All protected endpoints need `Authorization: Bearer <token>`.

**Success:** `{ "success": true, "data": ... }` (list endpoints add `pagination`)
**Error:** `{ "success": false, "message": "...", "errors": [{ "field": "body.title", "message": "..." }] }`

| Code | Meaning |
|------|---------|
| 200 / 201 / 204 | OK / Created / Deleted (no body) |
| 400 | Validation failed, malformed id, or invalid status transition |
| 401 | Missing, invalid, or expired token; wrong credentials |
| 403 | Authenticated, but the role is not allowed (e.g. a user calling an admin endpoint) |
| 404 | Not found, **or a ticket that is not yours** (existence is not revealed) |
| 409 | Conflict: duplicate email, editing a non-open ticket, commenting on a closed ticket |
| 429 | Too many auth attempts (20 per 15 min per IP) |

---

## Auth

### `POST /auth/register`
```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123" }
```
The password needs 8+ characters with at least one letter and one number. The role is always `user`.
→ `201 { data: { user, token } }`

### `POST /auth/login`
```json
{ "email": "admin@helpdesk.dev", "password": "Admin@1234" }
```
→ `200 { data: { user, token } }`

### `GET /auth/me` 🔒
→ `200 { data: { user } }`

---

## Tickets 🔒

Ticket object:
```json
{
  "_id": "6650...",
  "ticketNumber": "TCK-1001",
  "title": "Cannot reset my password",
  "description": "The reset email never arrives...",
  "category": "account",
  "priority": "high",
  "status": "in_progress",
  "createdBy": { "_id": "...", "name": "Priya Sharma", "email": "...", "role": "user" },
  "assignedTo": { "_id": "...", "name": "Rohan Support", "email": "...", "role": "admin" },
  "commentCount": 2,
  "resolvedAt": null,
  "closedAt": null,
  "createdAt": "2026-11-25T10:00:00.000Z",
  "updatedAt": "2026-11-25T10:05:00.000Z"
}
```
Enums:
- `status`: `open`, `in_progress`, `resolved`, `closed`
- `priority`: `low`, `medium`, `high`, `urgent`
- `category`: `general`, `technical`, `billing`, `account`, `feature_request`

### `GET /tickets`
Users get only their own tickets; admins get all of them.

| Query | Description |
|---|---|
| `status`, `priority`, `category` | Exact-match filters |
| `q` | Case-insensitive search in title, description, and ticket number |
| `assignedTo` | *(admin)* user id, `me`, or `none` |
| `createdBy` | *(admin)* user id |
| `sort` | `createdAt`, `updatedAt`, `priority`, `status`, or `title`; prefix `-` for descending. Default `-createdAt`. Priority sorts by severity, not alphabetically. |
| `page`, `limit` | Default `1`, `10` (max 100) |

→ `200 { data: [Ticket], pagination: { total, page, limit, totalPages } }`

### `POST /tickets`
```json
{ "title": "Export fails", "description": "Large CSV export never finishes", "category": "technical", "priority": "medium" }
```
`category` defaults to `general` and `priority` to `medium`. → `201 { data: Ticket }`. Emits `ticket.created`.

### `GET /tickets/:id`
→ `200 { data: Ticket }`

### `PATCH /tickets/:id`
Any subset of `title`, `description`, `category`, `priority`. Unknown fields are rejected.
- **Owner:** only while `status = open` (otherwise 409).
- **Admin:** any time.

Emits `ticket.updated` with a `changes` diff.

### `DELETE /tickets/:id`
Owner only while the ticket is `open`; admins can delete any ticket. Also deletes the ticket's comments and notifications; the activity log is kept. → `204`. Emits `ticket.deleted`.

### `PATCH /tickets/:id/status` 👮 admin
```json
{ "status": "resolved" }
```
Allowed transitions:

| From | To |
|---|---|
| `open` | `in_progress`, `resolved`, `closed` |
| `in_progress` | `open`, `resolved`, `closed` |
| `resolved` | `in_progress`, `closed` |
| `closed` | `open` |

Emits `ticket.status_changed`, plus `ticket.resolved` when the new status is `resolved`.

### `PATCH /tickets/:id/assign` 👮 admin
```json
{ "assignedTo": "<adminUserId>" }
```
Use `null` to unassign. The assignee must be an admin. Emits `ticket.assigned`.

### `GET /tickets/stats`
Scoped to the caller (admin: all tickets; user: their own).
```json
{
  "total": 4,
  "byStatus": { "open": 2, "in_progress": 1, "resolved": 1, "closed": 0 },
  "byPriority": { "low": 1, "medium": 1, "high": 1, "urgent": 1 },
  "byCategory": { "account": 1, "billing": 1 },
  "unassigned": 1,
  "avgResolutionHours": 3.5
}
```

---

## Comments & activity 🔒

Same access rule as the ticket: the owner or an admin.

### `GET /tickets/:id/comments`
Oldest first, with `author: { _id, name, role }`.

### `POST /tickets/:id/comments`
```json
{ "body": "Any update on this?" }
```
1–2000 characters. Users cannot comment on `closed` tickets (409). → `201`. Emits `comment.added`.

### `GET /tickets/:id/activity`
The audit trail produced by the event handlers:
```json
[{ "event": "ticket.status_changed", "message": "Asha Admin changed status of TCK-1001 from open to in progress",
   "actor": { "name": "Asha Admin", "role": "admin" }, "meta": { "changes": { "status": { "from": "open", "to": "in_progress" } } },
   "createdAt": "..." }]
```

---

## Notifications 🔒

### `GET /notifications?page=1&limit=10&unread=true`
→ `{ data: [{ _id, event, message, read, ticket: { _id, ticketNumber, title }, createdAt }], unreadCount, pagination }`

### `PATCH /notifications/:id/read`
### `PATCH /notifications/read-all`

---

## Users 👮 admin

### `GET /users/admins`
Lists admins (used for the "assign to" dropdown).

---

## Health
### `GET /health` → `{ "success": true, "status": "ok" }`
