# API Design (Production)

REST API. For architecture context, see [system_architecture.md](system_architecture.md). For DB schema, see [db_design.md](db_design.md).

This document describes the **production API** used by the native app (iOS/Android).

---

## Overview

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/auth/register` | POST | Create a new user account | No |
| `/auth/login` | POST | Login and receive JWT | No |
| `/sync/notebooks` | POST | Sync notebooks and notes; returns resources client is missing | Yes |
| `/sync/quizzes` | POST | Generate context objects and quizzes via AI; returns resources client is missing | Yes |
| `/sync/quiz-runs` | POST | Sync quiz runs and records; returns resources client is missing | Yes |
| `/learn` | POST | Ask AI about an expression | Yes |

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

**Validation:**
- `user_name`: 1–100 characters, required
- `email`: valid email format, required
- `password`: 8+ characters, required
- `first_language`, `target_language`: valid language code (e.g. "ja", "ko", "en"), required

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

---

### `POST /sync/notebooks`

Sync notebooks and notes from client to server (LWW by `updated_at`). Returns notebooks and notes the server has that the client does not.

Called by the client before tapping the generate button, and on app startup.

**Request:**
```json
{
  "notebooks": [
    {
      "id": "client-uuid",
      "name": "スラング",
      "created_at": "2026-04-01T12:00:00Z",
      "updated_at": "2026-04-01T12:00:00Z"
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
      "updated_at": "2026-04-01T12:00:00Z"
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
      "updated_at": "2026-04-01T12:00:00Z"
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
      "updated_at": "2026-04-01T12:00:00Z"
    }
  ]
}
```

Only notebooks and notes the server has that the client did not send are returned. On a fresh install, send empty arrays and receive the full server state.

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Validation error |
| 401 | Not authenticated |

**Validation:**
- `notebooks`: array, required (can be empty)
- `notebooks[].id`: required, UUID
- `notebooks[].name`: 1–255 characters, required
- `notes`: array, required (can be empty)
- `notes[].id`: required, UUID
- `notes[].notebook_id`: required, must reference a notebook in this request or already on server
- `notes[].name`: non-empty string, required
- `notes[].content`: non-empty array, required. Each element is an object with `notePieceId` (UUID), `expression` (non-empty string), and `annotation` (string)

---

### `POST /sync/quizzes`

Generate context objects and quizzes for uninterpreted note pieces via AI. Returns context objects and quizzes the server has that the client does not.

Called after `POST /sync/notebooks` when the user taps the generate button.

**Request:**
```json
{
  "context_object_ids": ["uuid", "uuid"],
  "quiz_ids": ["uuid", "uuid"]
}
```

The client sends IDs of all context objects and quizzes it already has. The server generates new ones for any uninterpreted note pieces, then returns everything the client is missing.

**Response (201 Created):**
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
      "updated_at": "2026-04-01T12:00:00Z"
    }
  ]
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Validation error |
| 401 | Not authenticated |
| 503 | AI API timeout or unavailable |

**Notes:**
- Context objects and quizzes are always server-generated — the client never has ones the server doesn't. The sync direction is server → client only.
- One note can produce multiple context objects (one per note piece).
- Updated notes trigger re-generation — old context objects and quizzes for that note are deleted via CASCADE before generation.
- On a fresh install, send empty arrays and receive all context objects and quizzes.

---

### `POST /sync/quiz-runs`

Sync quiz runs from client to server (insert only — quiz runs are never updated). Returns quiz runs the server has that the client does not.

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
- `quiz_runs`: array, required (can be empty)
- `quiz_runs[].id`: required, UUID (client-generated)
- `quiz_runs[].started_at`: required, ISO 8601
- `quiz_runs[].completed_at`: nullable
- `quiz_runs[].records`: array, at least 1 record
- `quiz_runs[].records[].quiz_id`: required, must reference an existing quiz owned by the user
- `quiz_runs[].records[].choices`: required, array of strings
- `quiz_runs[].records[].user_answer`: required, non-empty string
- `quiz_runs[].records[].is_correct`: required, boolean

**Notes:**
- Client evaluates correct/incorrect locally. Server trusts the client's evaluation.
- On a fresh install, send an empty array and receive all quiz runs from the server.

---


---

### `POST /learn`

Ask AI for deeper explanation about an expression.

**Request:**
```json
{
  "context_object_id": "uuid",
  "question": "How is 겠냐 different from 겠어?"
}
```

**Response (200 OK):**
```json
{
  "explanation": "겠냐 carries a confrontational tone implying disbelief, while 겠어 is a neutral future/conjecture form...",
  "examples": [
    {
      "expression": "네가 하겠냐?",
      "meaning": "You think YOU can do it? (No way)",
      "tone": "rough"
    },
    {
      "expression": "네가 하겠어?",
      "meaning": "Do you think you can do it? (Genuine question)",
      "tone": "neutral"
    }
  ],
  "related_expressions": ["겠니", "겠냐고", "ㄹ 수 있겠어?"]
}
```

**Errors:**

| Status | Meaning |
|--------|---------|
| 400 | Missing fields |
| 401 | Not authenticated |
| 404 | context_object_id not found |
| 503 | AI API timeout or unavailable |

**Notes:**
- Server sends the full context object (expression, nuance, tone, etc.) + user's question to AI API
- Response is not saved to DB — transient. Client may cache locally if desired

---

## Common Patterns

### Error response format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": {}
  }
}
```

| Code | Status | Used for |
|------|--------|----------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource (e.g. email) |
| `AI_UNAVAILABLE` | 503 | AI API down or timeout |

### Timestamps

All timestamps: ISO 8601 with timezone (`2026-04-01T12:00:00Z`)

### IDs

All IDs: UUID v4. Client generates IDs for notebooks and notes locally. Server generates IDs for context objects, quizzes, quiz runs, and quiz records.

---

## Design Decisions

- **Sync-first endpoints**: All user data flows through `/sync/*` endpoints instead of REST GET/POST.
- **`POST /sync/notebooks` before `POST /sync/quizzes`**: The client calls them in sequence. Quiz generation requires the latest notes to already be on the server.
- **Client-generated UUIDs for notebooks, notes, and quiz runs**: These are created offline, so IDs must exist before reaching the server.
- **Server-generated UUIDs for context objects and quizzes**: These are created server-side by AI generation, so the server owns their IDs.
- **Server trusts client's `is_correct`**: Quiz evaluation lives in the client. Server is a storage layer, not an evaluator.
- **`POST /learn` response is transient**: Not persisted server-side. Avoids storage growth for conversational AI interactions.
- **Updated notes trigger re-generation**: When a note's `updated_at` is newer than the server's version, old note_pieces (and their context objects + quizzes via CASCADE) are deleted and recreated.
