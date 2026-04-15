import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { supabase } from "../../infrastructure/supabaseClient.ts"
import { SupabaseContextObjectRepository } from "../../infrastructure/repositories/supabaseContextObjectRepository.ts"
import { SupabaseNotePieceRepository } from "../../infrastructure/repositories/supabaseNotePieceRepository.ts"
import { SupabaseNoteRepository } from "../../infrastructure/repositories/supabaseNoteRepository.ts"
import { SupabaseNotebookRepository } from "../../infrastructure/repositories/supabaseNotebookRepository.ts"
import { SupabaseQuizRepository } from "../../infrastructure/repositories/supabaseQuizRepository.ts"
import { SupabaseQuizRunRepository } from "../../infrastructure/repositories/supabaseQuizRunRepository.ts"
import { MockNoteStorageRepository } from "../../infrastructure/mockNoteStorageRepository.ts"
import { SyncUseCase } from "../../usecases/SyncUseCase.ts"

// Test user created via Supabase Admin API before tests run
const TEST_USER_ID = "11111111-1111-1111-1111-111111111111"
const TEST_EMAIL = "sync-test@example.com"
const TEST_PASSWORD = "password123"

const notebookRepo = new SupabaseNotebookRepository()
const noteRepo = new SupabaseNoteRepository()
const notePieceRepo = new SupabaseNotePieceRepository()
const noteStorage = new MockNoteStorageRepository()
const contextObjectRepo = new SupabaseContextObjectRepository()
const quizRepo = new SupabaseQuizRepository()
const quizRunRepo = new SupabaseQuizRunRepository()

const deps = { notebookRepo, noteRepo, notePieceRepo, noteStorage, contextObjectRepo, quizRepo, quizRunRepo }

async function cleanupUser() {
  await supabase.auth.admin.deleteUser(TEST_USER_ID)
  const { data } = await supabase.auth.admin.listUsers()
  const stale = data?.users?.find((u) => u.email === TEST_EMAIL)
  if (stale) await supabase.auth.admin.deleteUser(stale.id)
}

async function createTestUser() {
  await supabase.auth.admin.createUser({
    // @ts-ignore: id is supported by local Supabase admin API
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {},
  })
}

beforeEach(async () => {
  await cleanupUser()
  await createTestUser()
})

afterEach(async () => {
  await cleanupUser()
})

describe("SyncUseCase — notebooks", () => {
  it("creates notebook when it does not exist on server", async () => {
    const notebookId = "aaaaaaaa-0000-0000-0000-000000000001"

    await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [{ id: notebookId, userId: TEST_USER_ID, name: "スラング", createdAt: new Date(), updatedAt: new Date() }],
        notes: [],
      },
      deps
    )

    const notebooks = await notebookRepo.findByUserId(TEST_USER_ID)
    expect(notebooks).toHaveLength(1)
    expect(notebooks[0]!.name).toBe("スラング")
  })

  it("updates notebook when client version is newer", async () => {
    const notebookId = "aaaaaaaa-0000-0000-0000-000000000002"
    const createdAt = new Date("2026-01-01T00:00:00Z")
    const originalUpdatedAt = new Date("2026-01-01T00:00:00Z")
    const newerUpdatedAt = new Date("2026-01-02T00:00:00Z")

    await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [{ id: notebookId, userId: TEST_USER_ID, name: "original", createdAt, updatedAt: originalUpdatedAt }],
        notes: [],
      },
      deps
    )

    await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [{ id: notebookId, userId: TEST_USER_ID, name: "updated", createdAt, updatedAt: newerUpdatedAt }],
        notes: [],
      },
      deps
    )

    const notebooks = await notebookRepo.findByUserId(TEST_USER_ID)
    expect(notebooks[0]!.name).toBe("updated")
  })

  it("skips notebook when updated_at is the same", async () => {
    const notebookId = "aaaaaaaa-0000-0000-0000-000000000003"
    const updatedAt = new Date("2026-01-01T00:00:00Z")

    await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [{ id: notebookId, userId: TEST_USER_ID, name: "original", createdAt: updatedAt, updatedAt }],
        notes: [],
      },
      deps
    )

    await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [{ id: notebookId, userId: TEST_USER_ID, name: "should not update", createdAt: updatedAt, updatedAt }],
        notes: [],
      },
      deps
    )

    const notebooks = await notebookRepo.findByUserId(TEST_USER_ID)
    expect(notebooks[0]!.name).toBe("original")
  })
})

describe("SyncUseCase — notes", () => {
  const notebookId = "aaaaaaaa-0000-0000-0000-000000000010"

  beforeEach(async () => {
    await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [{ id: notebookId, userId: TEST_USER_ID, name: "test", createdAt: new Date(), updatedAt: new Date() }],
        notes: [],
      },
      deps
    )
  })

  it("creates note and note_pieces when note does not exist on server", async () => {
    const noteId = "bbbbbbbb-0000-0000-0000-000000000001"

    const result = await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [],
        notes: [{
          id: noteId,
          notebookId,
          content: "- 겠냐? :: rough dismissive question\n- 나중에 :: see you later",
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      },
      deps
    )

    expect(result.syncedNoteIds).toContain(noteId)

    const pieces = await notePieceRepo.findByNoteIds([noteId])
    expect(pieces).toHaveLength(2)
  })

  it("updates note and replaces note_pieces when client version is newer", async () => {
    const noteId = "bbbbbbbb-0000-0000-0000-000000000002"
    const originalUpdatedAt = new Date("2026-01-01T00:00:00Z")
    const newerUpdatedAt = new Date("2026-01-02T00:00:00Z")

    await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [],
        notes: [{
          id: noteId,
          notebookId,
          content: "- 겠냐? :: rough dismissive question",
          createdAt: originalUpdatedAt,
          updatedAt: originalUpdatedAt,
        }],
      },
      deps
    )

    const piecesBeforeUpdate = await notePieceRepo.findByNoteIds([noteId])
    const originalPieceId = piecesBeforeUpdate[0]!.id

    await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [],
        notes: [{
          id: noteId,
          notebookId,
          content: "- 나중에 :: see you later\n- 화이팅 :: do your best",
          createdAt: originalUpdatedAt,
          updatedAt: newerUpdatedAt,
        }],
      },
      deps
    )

    const piecesAfterUpdate = await notePieceRepo.findByNoteIds([noteId])
    expect(piecesAfterUpdate).toHaveLength(2)
    expect(piecesAfterUpdate.every((p) => p.id !== originalPieceId)).toBe(true)
  })

  it("skips note when updated_at is the same", async () => {
    const noteId = "bbbbbbbb-0000-0000-0000-000000000003"
    const updatedAt = new Date("2026-01-01T00:00:00Z")

    await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [],
        notes: [{
          id: noteId,
          notebookId,
          content: "- 겠냐? :: rough dismissive question",
          createdAt: updatedAt,
          updatedAt,
        }],
      },
      deps
    )

    const result = await SyncUseCase(
      {
        userId: TEST_USER_ID,
        notebooks: [],
        notes: [{
          id: noteId,
          notebookId,
          content: "- should not update :: this content",
          createdAt: updatedAt,
          updatedAt,
        }],
      },
      deps
    )

    expect(result.syncedNoteIds).not.toContain(noteId)
  })
})
