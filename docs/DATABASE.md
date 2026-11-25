# Database Design

**Database:** MongoDB, accessed through Mongoose ODM.

## Why MongoDB
- A ticket and its metadata form a natural document. The workload is mostly "read one ticket with its people" and "list tickets filtered by a few fields", and documents plus indexes handle both well.
- The activity log has a flexible `meta` payload (field diffs, assignee, comment id) that varies by event type, which suits a schemaless sub-document.
- Mongoose still gives us schemas, enums, length limits, and indexes, so the data is validated even though the database is document-based.

## Entity-relationship overview

```
┌──────────┐ 1      * ┌──────────┐ 1      * ┌──────────┐
│   User   │──────────│  Ticket  │──────────│ Comment  │
│          │ createdBy│          │  ticket  │          │
│          │──────────│          │          │ author ──┼──► User
│          │assignedTo│          │          └──────────┘
└──────────┘ (admin)  └──────────┘
     ▲                     │ 1
     │ recipient           │ *
┌────┴─────────┐     ┌─────┴───────┐
│ Notification │     │ ActivityLog │── actor ──► User
└──────────────┘     └─────────────┘
┌──────────┐
│ Counter  │  (sequence for ticket numbers)
└──────────┘
```

Relationships are stored as **ObjectId references**, not embedded documents:
- **Comments are a separate collection** rather than an array inside the ticket. This avoids unbounded document growth (MongoDB's 16 MB limit), allows paginating comments, and avoids rewriting the whole ticket document on every comment. A denormalised `commentCount` on the ticket keeps list views cheap.
- **ActivityLog** and **Notification** are separate append-heavy collections written by event handlers. This keeps the core `tickets` collection small and hot.

## Collections

### `users`
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | String | required, ≤ 80 |
| `email` | String | required, **unique**, lower-cased, trimmed |
| `password` | String | bcrypt hash (cost 12), `select: false`, never serialised |
| `role` | `user` \| `admin` | default `user`, indexed |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: `{ email: 1 }` unique (login lookup), `{ role: 1 }` (find admins for notifications and assignment).

### `tickets`
| Field | Type | Notes |
|---|---|---|
| `ticketNumber` | String | **unique**, e.g. `TCK-1001`, from `counters` |
| `title` | String | 5–120 chars |
| `description` | String | 10–5000 chars |
| `category` | enum | `general`, `technical`, `billing`, `account`, `feature_request` |
| `priority` | enum | `low`, `medium`, `high`, `urgent` |
| `priorityRank` | Number | 1–4, hidden, set by a pre-validate hook; used for severity sorting |
| `status` | enum | `open`, `in_progress`, `resolved`, `closed` |
| `createdBy` | ObjectId → users | required (owner) |
| `assignedTo` | ObjectId → users | nullable, must be an admin |
| `commentCount` | Number | denormalised counter, updated with `$inc` |
| `resolvedAt`, `closedAt` | Date | set on transition, cleared on reopen; used for resolution-time stats |
| `createdAt`, `updatedAt` | Date | |

Indexes (chosen from the actual queries):
| Index | Serves |
|---|---|
| `{ ticketNumber: 1 }` unique | lookup and search by number |
| `{ createdBy: 1, createdAt: -1 }` | "My tickets", newest first (the most common user query) |
| `{ status: 1, priority: 1, createdAt: -1 }` | Admin queue filtered by status and/or priority |
| `{ assignedTo: 1, status: 1 }` | "Assigned to me" and "unassigned" views |

### `comments`
| Field | Type | Notes |
|---|---|---|
| `ticket` | ObjectId → tickets | required |
| `author` | ObjectId → users | required |
| `body` | String | 1–2000 chars |
| `createdAt`, `updatedAt` | Date | |

Index: `{ ticket: 1, createdAt: 1 }` (a ticket's thread in chronological order).

### `activitylogs` (audit trail, append-only)
| Field | Type | Notes |
|---|---|---|
| `event` | String | e.g. `ticket.status_changed` |
| `ticket` | ObjectId → tickets | indexed |
| `ticketNumber` | String | **denormalised** so entries stay meaningful after a ticket is deleted |
| `actor` | ObjectId → users | who did it |
| `message` | String | human-readable sentence |
| `meta` | Mixed | event-specific data, e.g. `{ changes: { status: { from, to } } }` |
| `createdAt` | Date | indexed descending |

### `notifications`
| Field | Type | Notes |
|---|---|---|
| `recipient` | ObjectId → users | required |
| `ticket` | ObjectId → tickets | optional |
| `event` | String | |
| `message` | String | |
| `read` | Boolean | default `false` |
| `createdAt` | Date | |

Index: `{ recipient: 1, read: 1, createdAt: -1 }` (covers both the bell's unread count and the newest-first list).

### `counters`
`{ _id: 'ticket', seq: Number }`. `findOneAndUpdate({ $inc: { seq: 1 } }, { upsert: true })` is atomic, so two concurrent creates can never get the same ticket number.

## Data integrity & protection
- **Validation in two layers:** Zod at the API edge, and Mongoose schema constraints (enums, lengths, required fields) at the model layer.
- **NoSQL injection:** `mongoose.set('sanitizeFilter', true)` neutralises `$`-operators in query filters, and Zod rejects non-string values before they reach a query.
- **Sensitive data:** `password` is `select: false` and removed in `toJSON`. Errors never leak stack traces.
- **Cascades:** deleting a ticket deletes its comments and notifications in the service layer. Activity logs are intentionally kept for auditability.
- **Referential checks:** assignment verifies that the target user exists and is an admin.

## Trade-offs / what I'd do at scale
- Ticket delete plus cascade is not in a multi-document transaction. On a replica set (e.g. Atlas) I would wrap it in `session.withTransaction()`.
- Search uses an escaped, case-insensitive regex. That is fine at this size; for large datasets I would use a MongoDB text index or Atlas Search.
- Offset pagination (`skip`) gets slower on deep pages; cursor pagination on `(createdAt, _id)` would fix that.
- A TTL index on read notifications (e.g. 90 days) would stop that collection from growing forever.
