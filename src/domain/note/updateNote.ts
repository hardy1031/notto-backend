import type { NoteRepository } from "../../repositories/noteRepository.ts"
import type { Note } from "../../repositories/types.ts"

export async function updateNote(note: Note, noteRepo: NoteRepository): Promise<void> {
  await noteRepo.update(note)
}
