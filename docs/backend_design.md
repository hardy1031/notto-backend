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

- **Business Logic** (Domain Layer): The core capabilities of the application — what can be done with each domain entity (user, note, quiz, AI interpretation, etc.). **Domain Layer has no knowledge of the outside world** — it does not know about HTTP, Supabase, S3, or the AI API directly. It only knows about repository interfaces (abstractions). This makes it testable without any external services and reusable across multiple use cases.
- **Use Case** (Application Layer): Orchestrates business logic to fulfill a single user intent. Calls multiple logic functions in sequence or conditionally. When designing a use case, verify that the business logic functions identified in the previous step are sufficient to complete it — if something is missing, add it to the Business Logic layer first.
- **Endpoint** (Interface Layer): Receives an HTTP request, calls a use case, and returns a response. Holds no logic of its own.

### Business Logic vs Use Case

**Business Logic** = a function that does exactly one thing.

```
createNote(note)           → inserts a note row into DB
uploadNoteContent(content) → uploads via NoteStorageRepository
```

It only knows its own responsibility. It does not call other functions.

**Use Case** = a sequence of Business Logic calls that fulfills one user intent.

```
SyncUseCase
  1. createNotebook      ← Business Logic
  2. createNote          ← Business Logic
  3. uploadNoteContent   ← Business Logic
```

**Rule of thumb:**
- "Could this be reused independently in another use case?" → Business Logic
- "Is this a recipe specific to one user action?" → Use Case

**What belongs in Domain Layer vs Repository:**

Domain Layer contains operations that can be described in business terms — actions that have meaning to the domain regardless of how they are implemented.

- `generateContextObject` → "interpret a note piece and produce a context object" — a business concept ✅
- `createNotebook` → "create a notebook entity" — a business concept ✅
- `findById` → "fetch a record by ID from the DB" — a system concern ❌ → belongs in Repository

The test: if you cannot explain *why* the operation exists in business terms (only in system terms), it belongs in the Repository, not the Domain Layer.

**Where to put conditional logic (e.g. "create or skip or update"):**

When an operation involves a judgment (e.g. "does this notebook already exist?"), the question is: should that judgment live in the Domain Layer or the Application Layer?

The answer depends on whether the judgment belongs to the **entity** or to the **business flow**.

- `createNotebook` and `updateNotebook` belong in the **Domain Layer** — they are pure operations on the entity, independent of any flow.
- "If it doesn't exist → create, if `updated_at` is older → update, if same → skip" belongs in **SyncUseCase (Application Layer)** — this rule only makes sense in the context of syncing. It is a business flow judgment, not a property of the notebook entity itself.

Pushing this kind of conditional into the Domain Layer (e.g. as `upsertNotebook`) hides business logic inside an entity operation, making it harder to understand what the use case is actually doing.

In Notto: `generateContextObject` and `generateQuizzes` are Business Logic — they each call the AI API and return a result. `GenerateQuizzesUseCase` is the Use Case that calls both in order and persists the results to the DB.

---

## Business Logic (what it can do)

### Auth

| Function | Description |
|---------|------|
| `createUser` | Create a user via Supabase Auth API (a DB trigger automatically creates the `users` row); then write `user_name`, `first_language`, `target_language` to the `users` table |
| `authenticateUser` | Pass email and password to Supabase Auth API to authenticate the user and obtain a JWT |
| `verifyToken` | Verify a client-supplied JWT via Supabase Auth API and extract the user ID. Called by `middleware/auth.ts`, not by use cases directly |

### Notebook / Note

| Function | Description |
|---------|------|
| `createNotebook` | Create a notebook using the client-generated UUID |
| `updateNotebook` | Update a notebook's attributes |
| `createNote` | Create a note and save the s3_key |
| `updateNote` | Update a note's `updated_at` in DB. `s3_key` does not change — the same S3 path is overwritten |
| `uploadNoteContent` | Upload note content via `NoteStorageRepository` and return the `s3_key`. Domain Layer only knows the interface — the actual S3 implementation lives in `infrastructure/` |
| `fetchNoteContent` | Fetch note content via `NoteStorageRepository`. Same separation — infrastructure handles the actual S3 call |

### Context Object

| Function | Description |
|---------|------|
| `generateContextObject` | Send a note piece to AI (via interface) and return the generated context object (expression, nuance, tone, example dialogue, etc.) |
| `findUninterpretedPieces` | Given a list of note_pieces and existing context objects, return the pieces that have no context object yet (matched by `note_piece_id`). These are the pieces to send to AI for generation |

### Quiz

| Function | Description |
|---------|------|
| `generateQuizzes` | Generate quizzes from context objects via the AI API |

### AI Learn

| Function | Description |
|---------|------|
| `askAI` | Send a context object and a question to the AI API. Returns an explanation, examples, and related expressions. Not persisted. **Not in MVP — under development for production.** |

---

## Use Cases (how to combine it)

### `RegisterUseCase`

User registration.

```
1. createUser (Supabase Auth API → DB trigger creates users row → write user_name, first_language, target_language)
2. Return JWT + user profile
```

### `LoginUseCase`

User login.

```
1. authenticateUser (Supabase Auth)
2. Return JWT
```

### `SyncUseCase`

Syncs notebooks and notes from client to server (client → server, LWW by `updated_at`). Also returns notebooks and notes that exist on the server but not on the client. Called from `POST /sync/notebooks`.

```
1. For each notebook:
   ├─ Does not exist        → createNotebook
   ├─ Client is newer       → updateNotebook
   └─ Same updated_at       → skip
2. For each note:
   ├─ Does not exist        → uploadNoteContent → createNote → upsert note_pieces
   ├─ Client is newer       → uploadNoteContent → updateNote → delete note_pieces → upsert note_pieces
   └─ Same updated_at       → skip
3. Fetch notebooks and notes the server has that the client does not
4. Return { newNotebooks, newNotes, syncedNoteIds }
```

Sync rules:

| Server state | Client sends | Action |
|-------------|-------------|--------|
| Does not exist | Notebook | Create |
| Exists, same `updated_at` | Notebook | Skip |
| Exists, client is newer | Notebook | Update |
| Does not exist | Note | Create + upload to S3 + upsert note_pieces |
| Exists, same `updated_at` | Note | Skip |
| Exists, client is newer | Note | Upload new content → update note → delete note_pieces (context objects + quizzes removed via CASCADE) → upsert note_pieces → mark for re-generation |

### `GenerateQuizzesUseCase`

Generates context objects and quizzes for uninterpreted note pieces via AI. Returns all context objects and quizzes the client does not yet have. Called from `POST /sync/quizzes`.

```
1. notePieceRepository.findByUserId → get all note_pieces for the user
2. contextObjectRepository.findByUserId → get all existing context objects
3. findUninterpretedPieces(notePieces, existingContextObjects) → pieces with no context object yet
4. generateContextObject(each uninterpreted piece) → AI generates context objects
5. contextObjectRepository.bulkCreate
6. contextObjectRepository.findWithoutQuizzes → context objects with no quizzes yet
7. generateQuizzes(AI) → generate quizzes
8. quizRepository.bulkCreate
9. Diff all server-side context objects and quizzes against the IDs the client sent
10. Return { contextObjects, quizzes } that server has but client does not
```

The client sends the IDs of context objects and quizzes it already has. The server returns only the ones the client is missing — including newly generated ones and any from other devices.

### `SubmitQuizRunUseCase`

Save a completed quiz run submitted by the client.

```
1. quizRepository.findById(quiz_id) → 404 if not found or not owned by user
2. quizRunRepository.save(quizRun, quizRecords)
3. Return saved result
```

> Correct/incorrect evaluation is done on the client. The server trusts `is_correct` as-is and stores it.

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
| POST | `/sync/notebooks` | `SyncUseCase` | JWT |
| POST | `/sync/quizzes` | `GenerateQuizzesUseCase` | JWT |
| POST | `/sync/quiz-runs` | `SubmitQuizRunUseCase` | JWT |
| POST | `/learn` | `LearnUseCase` | JWT |

Endpoints follow a **sync-first** design — see [ADR-016](../Notto-docs/docs/adr/016-sync-first-endpoints.md). There are no standalone GET endpoints for user data. Each sync endpoint receives what the client currently has and returns what the client is missing.

### Endpoint responsibilities

An endpoint holds no logic. It only:

1. Parses and validates the request
2. Verifies the JWT and extracts `user_id` (for authenticated endpoints)
3. Calls the use case
4. Converts the use case result into an HTTP response

---

## MVP Constraints

### Note Pieces

Notes are parsed using the following format:

```
- expression :: annotation
```

Each matching line becomes one `note_piece`. Lines that do not match the pattern are ignored. Parsing is done by `domain/note/parseNote.ts` on every create or update.

### AI Client in MVP

`infrastructure/aiClient.ts` returns **mock responses** in MVP. This allows the full request flow (sync → generate → persist) to be tested without real AI calls. The interface remains identical to production — swapping in the real AI client requires no changes to domain or use case code.

---

## AI Prompt Design

### Storage

Prompts are stored as plain text files in `src/prompts/`. Keeping them separate from code makes them easy to read and edit without touching TypeScript.

```
src/prompts/
  generateContextObjects.txt
  generateQuizzes.txt
  askAI.txt   # production only
```

### How prompts are used

`infrastructure/aiClient.ts` reads the prompt file and sends it as the `system` parameter on every API request. The Claude API has no session concept — system prompts must be included with each request.

### Prompt Caching

To reduce cost, prompts are sent with `cache_control: { type: "ephemeral" }`. This caches the system prompt for 5 minutes on Anthropic's side. Cache hits cost 90% less than normal token pricing.

```typescript
client.messages.create({
  model: "claude-opus-4-6",
  system: [{ type: "text", text: promptText, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: noteContent }]
})
```

### AI Response Schema

The prompts must instruct the AI to return JSON matching these schemas exactly.

**`generateContextObjects` response:**

```json
{
  "context_objects": [
    {
      "expression": "string",
      "base_meaning": "string",
      "actual_nuance": "string",
      "tone": "string",
      "formality": "casual | neutral | formal",
      "is_slang": true,
      "example_dialogue": [
        { "speaker": "string", "text": "string" }
      ]
    }
  ]
}
```

**`generateQuizzes` response:**

```json
{
  "quizzes": [
    {
      "context_object_index": 0,
      "type": "choose_context | choose_pronunciation | fill_metadata",
      "question_sentence": "string",
      "answer": "string"
    }
  ]
}
```

`context_object_index` references the position in the `context_objects` array passed to the quiz generation call, allowing the server to link each quiz to the correct `context_object_id`.

**Malformed AI response handling:**

If the AI returns a response that cannot be parsed as valid JSON or does not match the expected schema:

1. Retry the request once
2. If the retry also fails → throw `AIUnavailableError` → endpoint returns 503

### Prompt content

Prompt content (the actual text inside `.txt` files) is deferred to production phase. MVP uses mock responses.

### Future consideration

Investigate whether any AI API supports setting a system prompt once per session (rather than per request). If such an API exists and fits Notto's use case, it could simplify the implementation and reduce overhead compared to the current per-request approach with Prompt Caching.

---

## Directory Structure (planned)

```
src/
  routes/           # Endpoint definitions (Hono router)
    auth.ts
    contextObjects.ts
    quizzes.ts        # POST /quizzes: SyncUseCase → GenerateQuizzesUseCase
    quizRuns.ts
    learn.ts
  usecases/         # Use cases
    RegisterUseCase.ts
    LoginUseCase.ts
    SyncUseCase.ts
    GenerateQuizzesUseCase.ts
    SubmitQuizRunUseCase.ts
    LearnUseCase.ts
  domain/           # Business logic (pure functions)
    notebook/
    note/
    contextObject/
    quiz/
    learn/
  repositories/     # Repository interfaces (abstractions)
    authRepository.ts
    notebookRepository.ts
    noteRepository.ts
    notePieceRepository.ts
    noteStorageRepository.ts
    contextObjectRepository.ts
    quizRepository.ts
    quizRunRepository.ts
    aiRepository.ts
    types.ts
  infrastructure/   # External service implementations
    repositories/   # Supabase implementations of repository interfaces
      supabaseNotebookRepository.ts
      supabaseNoteRepository.ts
      supabaseNotePieceRepository.ts
      supabaseContextObjectRepository.ts
      supabaseQuizRepository.ts
      supabaseQuizRunRepository.ts
    aiClient.ts       # reads prompt files, sends to AI API with Prompt Caching enabled
    s3Client.ts
    supabaseClient.ts
    supabaseAuthRepository.ts
    mockNoteStorageRepository.ts  # MVP: mock S3 storage
  prompts/          # AI prompt templates (plain text files)
    generateContextObjects.txt
    generateQuizzes.txt
    askAI.txt         # production only
  middleware/
    auth.ts         # JWT verification middleware
  errors/
    index.ts        # Domain and infra error classes
  types/
    hono.ts         # Hono context type extensions
  index.ts          # Entry point
```

---

## Error Design

### Error Classification

| Class | Layer | Description |
|-------|-------|-------------|
| Validation error | Endpoint | Invalid request format or missing fields |
| Auth error | Middleware | Missing or invalid JWT |
| Domain error | Domain | Business rule violation |
| Infra error | Infrastructure | External service failure (DB, S3, AI API) |

Use Cases do not generate their own errors — they propagate Domain and Infra errors up to the endpoint layer as-is.

### Domain Errors

| Error | HTTP Status | Code | When |
|-------|-------------|------|------|
| `NotFoundError` | 404 | `NOT_FOUND` | Resource does not exist (e.g. quiz_id not found in SubmitQuizRunUseCase) |
| `ConflictError` | 409 | `CONFLICT` | Business rule violation on uniqueness (e.g. email already registered) |
| `ForbiddenError` | 403 | `FORBIDDEN` | Accessing another user's resource (e.g. context_object owned by different user in LearnUseCase) |

### Infra Errors

| Error | HTTP Status | Code | When |
|-------|-------------|------|------|
| `AIUnavailableError` | 503 | `AI_UNAVAILABLE` | AI API timeout or unavailable |
| `S3Error` | 500 | `INTERNAL_ERROR` | S3 upload/fetch failure |
| `DBError` | 500 | `INTERNAL_ERROR` | Database failure |

### Error Response Format

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Human-readable description"
  }
}
```

500 errors do not expose internal details — message is always `"Internal server error"`.

### Hono Error Middleware

All errors are caught and converted to HTTP responses in a single `app.onError` handler:

```typescript
app.onError((err, c) => {
  if (err instanceof NotFoundError)
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404)
  if (err instanceof ConflictError)
    return c.json({ error: { code: "CONFLICT", message: err.message } }, 409)
  if (err instanceof ForbiddenError)
    return c.json({ error: { code: "FORBIDDEN", message: err.message } }, 403)
  if (err instanceof AIUnavailableError)
    return c.json({ error: { code: "AI_UNAVAILABLE", message: err.message } }, 503)
  // S3Error, DBError, and all unexpected errors
  // Log full details server-side (AWS CloudWatch Logs in production), hide from client
  console.error(`[${err.constructor.name}]`, err.message, err.stack)
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500)
})
```

Infra errors are logged with their class name (`S3Error`, `DBError`, etc.) so the source is identifiable in logs. In production, logs are streamed to AWS CloudWatch Logs. Locally, `console.error` output is sufficient.

### Partial Failure (`POST /interpret`)

If SyncUseCase succeeds but GenerateQuizzesUseCase fails, the AI error (`AIUnavailableError`) propagates up and the endpoint returns 503. The sync result is not returned — the client retries the entire request. Notes are already synced on the server so the retry is safe (SyncUseCase is idempotent).

---

## Key Design Decisions

| Decision | Reason |
|---------|------|
| Sync-first endpoints (`POST /sync/*`) instead of REST GET | Notto is local-first. The server's role is AI generation and cross-device sync — not a primary data source. Sync endpoints are honest about what is actually happening. See [ADR-016](../Notto-docs/docs/adr/016-sync-first-endpoints.md). |
| `POST /sync/notebooks` and `POST /sync/quizzes` are separate | Different triggers and responsibilities: notebook sync is about persisting user content; quiz sync is about AI generation. Splitting makes each endpoint's resource boundary clear. |
| `POST /sync/notebooks` runs before `POST /sync/quizzes` | Generating quizzes requires the latest notes to be on the server. The client calls them in sequence. |
| Client generates UUIDs for notebooks and notes | These are created offline, so IDs must exist before reaching the server. |
| Server generates UUIDs for context objects, quizzes, and quiz runs | These are artifacts created server-side (AI generation, run submission), so the server owns their IDs. |
| Client evaluates `is_correct`, server trusts it | Correct/incorrect logic belongs to the client. The server acts as a storage layer only. |
| `POST /learn` response is not persisted | Persisting conversational AI interactions would grow storage unnecessarily. Client may cache locally if needed. |
| Sync responses are flat arrays | Easier for the client to INSERT directly into SQLite tables. Client reconstructs relationships via foreign keys. |

---

## Test Strategy

### What we are protecting

The most critical thing to protect is **user data** — notes, context objects, quizzes, and quiz run records. Loss or corruption of these directly breaks the core value of the app.

### Test scope per layer

| Layer | Approach | Why |
|-------|----------|-----|
| Domain Logic | Unit test, no mocks needed | Pure functions (e.g. `findUninterpretedPieces`, `generateContextObjects`) — input/output only |
| Repository (DB) | Integration test against local Supabase CLI | Need to verify data is actually persisted correctly |
| S3 | Integration test against localstack or dedicated test bucket | Need to verify upload/download behavior |
| AI API | Mock (stub responses) | Cost and speed — actual AI responses are non-deterministic anyway |
| Use Cases | Integration test with real DB, mocked AI/S3 | Verify orchestration logic without AI cost |
| Endpoints | e2e test with real DB, mocked AI/S3 | Verify HTTP layer behavior end-to-end |

### CI strategy

Run on every push via GitHub Actions:

```
typecheck   → tsc --noEmit
lint/format → Biome
test        → bun test (unit + integration)
```

Biome handles both linting and formatting in one tool — well-suited for Bun environments.
