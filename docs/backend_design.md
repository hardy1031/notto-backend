# Notto Backend Design

Design document for the backend server (Hono / TypeScript / Bun).

API specification → [Notto-docs/docs/api_design.md](../Notto-docs/docs/api_design.md)
System architecture → [Notto-docs/docs/system_architecture.md](../Notto-docs/docs/system_architecture.md)

---

## Design Philosophy

```
Business Logic   →   Use Case            →   Endpoint
(what it can do)     (how to combine it)     (how to call it)
```

- **Business Logic**: The core capabilities of the application — what can be done with each domain entity (user, note, quiz, AI interpretation, etc.)
- **Use Case**: Orchestrates business logic to fulfill a single user intent. Calls multiple logic functions in sequence or conditionally.
- **Endpoint**: Receives an HTTP request, calls a use case, and returns a response. Holds no logic of its own.

---

## Business Logic (what it can do)

### Auth

| Function | Description |
|---------|------|
| `createUser` | Create a user in Supabase Auth and insert a profile row into the `users` table |
| `authenticateUser` | Authenticate via Supabase Auth and return a JWT |
| `verifyToken` | Verify a JWT and retrieve the user ID (delegated to Supabase Auth API) |

### Notebook / Note

| Function | Description |
|---------|------|
| `findOrCreateNotebook` | Create a notebook using the client-generated UUID, or return the existing one |
| `upsertNote` | Create or update a note. Uses `updated_at` to determine which is newer |
| `uploadNoteToS3` | Upload note content to S3 and return the `s3_key` |
| `getNoteContent` | Fetch note content from S3 |

### Context Object

| Function | Description |
|---------|------|
| `interpretNotes` | Send note content to the AI API and generate context objects (expression, nuance, tone, example dialogue, etc.) |
| `replaceContextObjects` | When a note is updated, delete all existing context objects and quizzes tied to that note |
| `bulkCreateContextObjects` | Bulk-insert generated context objects into the DB |

### Quiz

| Function | Description |
|---------|------|
| `generateQuizzes` | Generate quizzes from context objects via the AI API |
| `bulkCreateQuizzes` | Bulk-insert generated quizzes into the DB |

### Quiz Run

| Function | Description |
|---------|------|
| `saveQuizRun` | Save a quiz run and all its quiz records to the DB |

### User Data

| Function | Description |
|---------|------|
| `fetchAllUserData` | Fetch all data belonging to the user (notebooks, notes, context objects, quizzes, quiz runs, quiz records) |

### AI Learn

| Function | Description |
|---------|------|
| `askAI` | Send a context object and a question to the AI API. Returns an explanation, examples, and related expressions. Not persisted. |

---

## Use Cases (how to combine it)

### `RegisterUseCase`

User registration.

```
1. createUser (Supabase Auth + users table)
2. Return JWT
```

### `LoginUseCase`

User login.

```
1. authenticateUser (Supabase Auth)
2. Return JWT
```

### `SyncUseCase`

Sync the client's notebooks and notes to the server.

```
1. findOrCreateNotebook for each notebook
2. upsertNote for each note
   ├─ New or updated_at is newer → uploadNoteToS3 → save s3_key to DB
   └─ Same updated_at → skip
3. Return IDs of new or updated notes
```

Sync rules:

| Server state | Client sends | Action |
|-------------|-------------|--------|
| Does not exist | Notebook | Create |
| Exists, same `updated_at` | Notebook | Skip |
| Exists, client is newer | Notebook | Update |
| Does not exist | Note | Create + upload to S3 |
| Exists, same `updated_at` | Note | Skip (no re-generation) |
| Exists, client is newer | Note | Update + re-upload to S3 + mark for re-generation |

### `GenerateQuizzesUseCase`

Generate and save context objects and quizzes from new or updated notes.

```
1. getNoteContent (fetch content from S3)
2. interpretNotes (AI API → generate context objects)
3. generateQuizzes (AI API → generate quizzes)
4. replaceContextObjects (delete old data if note was updated)
5. bulkCreateContextObjects
6. bulkCreateQuizzes
7. Return generated results
```

In `POST /quizzes`, this is followed by `GetUserDataUseCase` so the response includes the latest full user data. The client can update its local SQLite in a single response.

### `SubmitQuizRunUseCase`

Save a completed quiz run submitted by the client.

```
1. Verify quiz_id exists and belongs to the user
2. saveQuizRun (quiz run + quiz records)
3. Return saved result
```

> Correct/incorrect evaluation is done on the client. The server trusts `is_correct` as-is and stores it.

### `GetUserDataUseCase`

Used for background sync on app startup.

```
1. verifyToken (JWT → user_id)
2. fetchAllUserData (filterable via include parameter)
3. Return as flat arrays (client reconstructs relationships via foreign keys)
```

### `LearnUseCase`

Ask the AI a follow-up question about an expression. Transient — not persisted.

```
1. Fetch context object by context_object_id (verify user ownership)
2. askAI (context object + question → AI API)
3. Return explanation, examples, related_expressions
```

---

## Endpoints (how to call it)

| Method | Path | Use Case | Auth |
|--------|------|----------|------|
| POST | `/auth/register` | `RegisterUseCase` | No |
| POST | `/auth/login` | `LoginUseCase` | No |
| GET | `/me` | `GetUserDataUseCase` | JWT |
| POST | `/quizzes` | `SyncUseCase` → `GenerateQuizzesUseCase` → `GetUserDataUseCase` | JWT |
| POST | `/quiz-runs` | `SubmitQuizRunUseCase` | JWT |
| POST | `/learn` | `LearnUseCase` | JWT |

### Endpoint responsibilities

An endpoint holds no logic. It only:

1. Parses and validates the request
2. Verifies the JWT and extracts `user_id` (for authenticated endpoints)
3. Calls the use case
4. Converts the use case result into an HTTP response

---

## Directory Structure (planned)

```
src/
  routes/           # Endpoint definitions (Hono router)
    auth.ts
    me.ts
    quizzes.ts
    quizRuns.ts
    learn.ts
  usecases/         # Use cases
    RegisterUseCase.ts
    LoginUseCase.ts
    SyncUseCase.ts
    GenerateQuizzesUseCase.ts
    SubmitQuizRunUseCase.ts
    GetUserDataUseCase.ts
    LearnUseCase.ts
  domain/           # Business logic (pure functions or classes)
    auth/
    notebook/
    note/
    contextObject/
    quiz/
    quizRun/
    learn/
  repositories/     # DB access (abstracts differences between PostgreSQL and SQLite)
    notebookRepository.ts
    noteRepository.ts
    contextObjectRepository.ts
    quizRepository.ts
    quizRunRepository.ts
  infrastructure/   # External service clients
    s3Client.ts
    aiClient.ts
    supabaseClient.ts
  middleware/
    auth.ts         # JWT verification middleware
  index.ts          # Entry point
```

---

## Error Response Format

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
|------|--------|------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource (e.g. email already registered) |
| `AI_UNAVAILABLE` | 503 | AI API timeout or unavailable |

---

## Key Design Decisions

| Decision | Reason |
|---------|------|
| `POST /quizzes` combines sync, generate, and data return | From the client's perspective, "generate quizzes" is a single action. Push and pull are done in one round trip. |
| Client generates UUIDs for notebooks and notes | These are created offline, so IDs must exist before reaching the server. |
| Server generates UUIDs for context objects, quizzes, and quiz runs | These are artifacts created server-side (AI generation, run submission), so the server owns their IDs. |
| Client evaluates `is_correct`, server trusts it | Correct/incorrect logic belongs to the client. The server acts as a storage layer only. |
| `POST /learn` response is not persisted | Persisting conversational AI interactions would grow storage unnecessarily. Client may cache locally if needed. |
| `GET /me` returns flat arrays | Easier for the client to INSERT directly into SQLite tables. Client reconstructs relationships via foreign keys. |
