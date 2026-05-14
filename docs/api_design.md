# API Design (Production)

REST API. For architecture context, see [system_architecture.md](system_architecture.md). For DB schema, see [db_design.md](db_design.md).

This document describes the **production API** used by the native app (iOS/Android).

---

## Overview

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/auth/register` | POST | Create a new user account | No |
| `/auth/login` | POST | Login and receive JWT | No |
| `/auth/logout` | POST | Revoke JWT | Yes |
| `/users/me` | GET | Get the authenticated user's profile | Yes |
| `/users/me` | PATCH | Update the authenticated user's profile | Yes |
| `/users/me` | DELETE | Delete the authenticated user's account | Yes |
| `/sync/notebooks` | POST | Sync notebooks and notes; returns resources client is missing | Yes |
| `/sync/quizzes` | POST | Generate context objects and quizzes via AI; returns resources client is missing | Yes |
| `/sync/quiz-runs` | POST | Sync quiz runs and records; returns resources client is missing | Yes |
| `/learn` | POST | Ask AI about an expression (stub — under development) | Yes |

This API follows a **sync-first** design. There are no standalone GET endpoints for user data. Each `/sync/*` endpoint receives a description of what the client currently has and returns only what the client is missing. This reflects the local-first nature of the app — the server's role is AI generation and cross-device synchronization, not a primary data source.

---

## Authentication

**Method:** Supabase Auth + JWT in Authorization header.

- On register/login, the server calls Supabase Auth API internally
- Supabase Auth issues a JWT. The server returns it in the response body
- Client stores the JWT in Secure Storage (iOS: Keychain, Android: Keystore)
- Subsequent requests send `Authorization: Bearer <token>` header
- Server calls Supabase Auth API via `@supabase/supabase-js` to verify the JWT and retrieve `user_id`
- Delegating verification to Supabase Auth API enables token revocation (logout, suspicious activity)

**Why Supabase Auth:**
- No need to implement password hashing, JWT generation, or user management from scratch
- JWT verification is delegated to Supabase Auth API, enabling token revocation
- Free tier covers up to 50,000 MAU

**Why JWT + Authorization header (not cookie):**
- Client is a native app — no automatic cookie management like a browser
- Storing in Secure Storage provides equivalent security to httpOnly cookies

**Token storage by environment:**

| Environment | Storage | Reason |
|-------------|---------|--------|
| Production (native app) | iOS Keychain / Android Keystore | OS-managed secure storage, not accessible from other apps or JS |
| Local development (browser) | `localStorage` | Acceptable because the app runs on localhost only — not reachable from the internet, so XSS from external actors is not possible. Never use localStorage in production — it is readable by any JS on the page (XSS risk) |

If a Web client is added later, use httpOnly cookies or another secure storage pattern appropriate for browsers. Avoid localStorage for long-lived tokens in production.

**JWT payload (issued by Supabase):**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "iat": 1712000000,
  "exp": 1712604800
}
```

**Token refresh:**

Token refresh is handled client-side via the Supabase SDK (`supabase.auth.refreshSession()`). The client calls Supabase Auth directly — no server-side `/auth/refresh` endpoint is needed or provided.

---

## Rate Limiting

Fixed-window in-memory rate limiting. Limits are applied per IP (unauthenticated) or per user (authenticated).

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /auth/register` | 5 requests | 1 hour | IP |
| `POST /auth/login` | 10 requests | 15 minutes | IP |
| `POST /sync/quizzes` | 20 requests | 1 minute | userId |
| `POST /learn` | 20 requests | 1 minute | userId |

When the limit is exceeded, the server returns `429 Too Many Requests` with a `Retry-After` header (seconds until the window resets).

---

## Endpoints

### `POST /auth/register`

Create a new user account.

**Internal flow:**
1. Create user via Supabase Auth API (inserts record into `auth.users`)
2. DB trigger automatically creates a corresponding row in `users` table
3. Write `user_name`, `first_language`, `target_language` to `users` table
4. Return Supabase JWT in response

**Request:**
```json
{
  "user_name": "string",
  "email": "string",
  "password": "string",
  "first_language": "ja",
  "target_language": "ko"
}
```

**Response (201 Created):**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "user_name": "string",
    "email": "string",
    "first_language": "ja",
    "target_language": "ko",
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Validation error (missing fields, invalid email, password too short) |
| 409 | Email already registered |
| 429 | Rate limit exceeded |

**Validation:**
- `user_name`: 1–50 characters, required
- `email`: valid email format, max 254 characters, required
- `password`: 8–72 characters, required
- `first_language`, `target_language`: 1–10 characters, required

---

### `POST /auth/login`

Authenticate and receive JWT.

**Internal flow:**
1. Authenticate via Supabase Auth API
2. Return Supabase JWT and user profile from `users` table in response

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "user_name": "string",
    "email": "string",
    "first_language": "ja",
    "target_language": "ko",
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Missing fields |
| 401 | Invalid email or password |
| 429 | Rate limit exceeded |

---

### `POST /auth/logout`

Revoke the current JWT. Subsequent requests with this token will be rejected.

**Response (204 No Content):** Empty body.

**Errors:**

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid JWT |

---

### `GET /users/me`

Get the authenticated user's profile.

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "user_name": "string",
    "email": "string",
    "first_language": "ja",
    "target_language": "ko",
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid JWT |
| 404 | User not found |

---

### `PATCH /users/me`

Update the authenticated user's profile. At least one field must be provided.

**Request:**
```json
{
  "user_name": "string",
  "first_language": "ja",
  "target_language": "ko"
}
```

All fields are optional, but at least one must be present.

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "user_name": "string",
    "email": "string",
    "first_language": "ja",
    "target_language": "ko",
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Validation error or no fields provided |
| 401 | Missing or invalid JWT |
| 404 | User not found |

**Validation:**
- `user_name`: 1–50 characters, optional
- `first_language`, `target_language`: 1–10 characters, optional

---

### `DELETE /users/me`

Delete the authenticated user's account and all associated data.

**Response (204 No Content):** Empty body.

**Errors:**

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid JWT |

---

### `POST /sync/notebooks`

Sync notebooks and notes from client to server (LWW by `updated_at`). Returns notebooks and notes the server has that the client does not.

Called by the client before tapping the generate button, and on app startup.

**Conflict resolution — "deleted wins":** If either side has `deleted_at` set, the deletion always takes precedence over any update. Notebook deletions cascade to child notes on the server.

**Request:**
```json
{
  "notebooks": [
    {
      "id": "client-uuid",
      "name": "スラング",
      "created_at": "2026-04-01T12:00:00Z",
      "updated_at": "2026-04-01T12:00:00Z",
      "deleted_at": null
    }
  ],
  "notes": [
    {
      "id": "client-uuid",
      "notebook_id": "client-uuid",
      "name": "スラング",
      "content": [
        {
          "notePieceId": "uuid",
          "expression": "겠냐?",
          "annotation": "マジでそうだと思うん？むずいスラング"
        }
      ],
      "created_at": "2026-04-01T12:00:00Z",
      "updated_at": "2026-04-01T12:00:00Z",
      "deleted_at": null
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "notebooks": [
    {
      "id": "uuid",
      "name": "スラング",
      "created_at": "2026-04-01T12:00:00Z",
      "updated_at": "2026-04-01T12:00:00Z",
      "deleted_at": null
    }
  ],
  "notes": [
    {
      "id": "uuid",
      "notebook_id": "uuid",
      "name": "スラング",
      "content": [
        {
          "notePieceId": "uuid",
          "expression": "겠냐?",
          "annotation": "マジでそうだと思うん？むずいスラング"
        }
      ],
      "created_at": "2026-04-01T12:00:00Z",
      "updated_at": "2026-04-01T12:00:00Z",
      "deleted_at": null
    }
  ]
}
```

The response contains:
- **New for client:** resources the server has (non-deleted) that the client did not send
- **Tombstones:** resources the client sent that have `deleted_at` set on the server (`deleted_at` is non-null, `content` is empty array for tombstoned notes)

On a fresh install, send empty arrays and receive the full server state.

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Validation error |
| 401 | Not authenticated |
| 404 | A note references a notebook that does not exist on the server |

**Validation:**
- `notebooks`: array, required (can be empty), max 500 items
- `notebooks[].id`: required, UUID
- `notebooks[].name`: 1–100 characters, required
- `notebooks[].deleted_at`: ISO 8601 datetime or null, optional
- `notes`: array, required (can be empty), max 500 items
- `notes[].id`: required, UUID
- `notes[].notebook_id`: required, UUID — must reference a notebook already on the server (send notebooks first)
- `notes[].name`: 1–100 characters, required
- `notes[].content`: array of note pieces, max 200 items (can be empty)
- `notes[].content[].notePieceId`: UUID, required
- `notes[].content[].expression`: non-empty string, required
- `notes[].content[].annotation`: non-empty string, required
- `notes[].deleted_at`: ISO 8601 datetime or null, optional

---

### `POST /sync/quizzes`

Generate context objects and quizzes for uninterpreted note pieces via AI. Returns context objects and quizzes the server has that the client does not.

Called after `POST /sync/notebooks` when the user taps the generate button.

**Request:**
```json
{
  "context_object_ids": ["uuid", "uuid"],
  "quiz_ids": ["uuid", "uuid"],
  "deleted_quiz_ids": ["uuid"]
}
```

- `context_object_ids`: IDs of all context objects the client already has
- `quiz_ids`: IDs of all quizzes the client already has
- `deleted_quiz_ids`: IDs of quizzes the client wants to soft-delete on the server

**Response (200 OK):**
```json
{
  "context_objects": [
    {
      "id": "uuid",
      "note_piece_id": "uuid",
      "note_id": "uuid",
      "expression": "겠냐?",
      "base_meaning": "Do you think ~?",
      "actual_nuance": "Closer to 'You really think that?' / 'No way'",
      "tone": "rough",
      "formality": "casual",
      "is_slang": true,
      "example_dialogue": [
        { "speaker": "A", "text": "이거 내가 할 수 있겠지?" },
        { "speaker": "B", "text": "네가 하겠냐?" }
      ],
      "created_at": "2026-04-01T12:00:00Z",
      "updated_at": "2026-04-01T12:00:00Z"
    }
  ],
  "quizzes": [
    {
      "id": "uuid",
      "context_object_id": "uuid",
      "type": "choose_context",
      "question_sentence": "Which situation best fits the expression 「겠냐?」?",
      "answer": "Closer to 'You really think that?' / 'No way'",
      "choice_pool": ["Closer to 'You really think that?' / 'No way'", "...9 distractors"],
      "created_at": "2026-04-01T12:00:00Z",
      "updated_at": "2026-04-01T12:00:00Z",
      "deleted_at": null
    }
  ]
}
```

The response contains:
- **New context objects:** all context objects the client does not have (server never deletes context objects, so sync is server → client only)
- **New quizzes:** quizzes the client does not have and are not deleted
- **Tombstoned quizzes:** quizzes the client has that now have `deleted_at` set on the server

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Validation error |
| 401 | Not authenticated |
| 429 | Rate limit exceeded |
| 503 | AI API timeout or unavailable |

**Notes:**
- Context objects are always server-generated — the client never creates them. Sync is server → client only.
- One note piece produces exactly one context object (1:1).
- Generation is incremental: only note pieces without a context object are sent to the AI.
- On a fresh install, send empty arrays and receive all context objects and quizzes.

---

### `POST /sync/quiz-runs`

Sync quiz runs from client to server (insert-only — quiz runs are never updated). Returns quiz runs the server has that the client does not.

**Request:**
```json
{
  "quiz_runs": [
    {
      "id": "client-uuid",
      "started_at": "2026-04-01T12:00:00Z",
      "completed_at": "2026-04-01T12:05:00Z",
      "records": [
        {
          "id": "client-uuid",
          "quiz_id": "uuid",
          "choices": ["option1", "option2", "option3", "option4"],
          "user_answer": "겠냐?",
          "is_correct": true,
          "created_at": "2026-04-01T12:00:30Z"
        }
      ]
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "quiz_runs": [
    {
      "id": "uuid",
      "started_at": "2026-04-01T12:00:00Z",
      "completed_at": "2026-04-01T12:05:00Z",
      "records": [
        {
          "id": "uuid",
          "quiz_run_id": "uuid",
          "quiz_id": "uuid",
          "choices": ["option1", "option2", "option3", "option4"],
          "user_answer": "겠냐?",
          "is_correct": true,
          "created_at": "2026-04-01T12:00:30Z"
        }
      ]
    }
  ]
}
```

Only quiz runs the server has that the client did not send are returned.

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Validation error |
| 401 | Not authenticated |
| 404 | Referenced `quiz_id` does not exist or is not owned by the user |

**Validation:**
- `quiz_runs`: array, required (can be empty), max 100 items
- `quiz_runs[].id`: required, UUID (client-generated)
- `quiz_runs[].started_at`: required, ISO 8601
- `quiz_runs[].completed_at`: nullable
- `quiz_runs[].records`: array, 1–200 records
- `quiz_runs[].records[].id`: required, UUID (client-generated)
- `quiz_runs[].records[].quiz_id`: required, must reference an existing quiz owned by the user
- `quiz_runs[].records[].choices`: required, array of strings, max 10 items
- `quiz_runs[].records[].user_answer`: required, 1–500 characters
- `quiz_runs[].records[].is_correct`: required, boolean
- `quiz_runs[].records[].created_at`: required, ISO 8601

**Notes:**
- Client evaluates correct/incorrect locally. Server trusts the client's evaluation.
- Only completed records (with `user_answer` and `is_correct` filled) are synced.
- On a fresh install, send an empty array and receive all quiz runs from the server.

---

### `POST /learn`

Ask AI about an expression.

> **Note:** This endpoint is currently a stub. It accepts the request and returns a fixed placeholder response. Full AI integration is planned.

**Request:**
```json
{
  "question": "How is 겠냐 different from 겠어?"
}
```

**Response (200 OK):**
```json
{
  "answer": "This feature is currently under development."
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Missing or invalid `question` field |
| 401 | Not authenticated |
| 429 | Rate limit exceeded |

**Validation:**
- `question`: 1–500 characters, required

---

## Common Patterns

### Error response format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description"
  }
}
```

| Code | Status | Used for |
|------|--------|----------|
| `VALIDATION_ERROR` | 400 | Invalid input (Zod validation failure) |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Authenticated but not authorized for this resource |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource (e.g. email already registered) |
| `RATE_LIMITED` | 429 | Too many requests; check `Retry-After` header |
| `AI_UNAVAILABLE` | 503 | AI API down, timeout, or malformed response |
| `STORAGE_ERROR` | 503 | S3 operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Timestamps

All timestamps: ISO 8601 with timezone (`2026-04-01T12:00:00Z`)

### IDs

All IDs: UUID v4. Client generates IDs for notebooks, notes, quiz runs, and quiz records. Server generates IDs for context objects and quizzes.

---

## Design Decisions

- **Sync-first endpoints**: All user data flows through `/sync/*` endpoints instead of REST GET/POST.
- **`POST /sync/notebooks` before `POST /sync/quizzes`**: The client calls them in sequence. Quiz generation requires the latest notes to already be on the server.
- **Client-generated UUIDs for notebooks, notes, quiz runs, and quiz records**: These are created offline, so IDs must exist before reaching the server.
- **Server-generated UUIDs for context objects and quizzes**: These are created server-side by AI generation, so the server owns their IDs.
- **Server trusts client's `is_correct`**: Quiz evaluation lives in the client. Server is a storage layer, not an evaluator.
- **`POST /learn` response is transient**: Not persisted server-side. Avoids storage growth for conversational AI interactions.
- **Incremental generation**: `POST /sync/quizzes` only generates for note pieces that do not yet have a context object. Updating a note does not re-generate existing context objects.
- **"Deleted wins" conflict resolution**: If either side has `deleted_at` set, deletion takes precedence over any update. See [ADR-014](../notto-docs/docs/adr/014-sync-conflict-resolution.md).
