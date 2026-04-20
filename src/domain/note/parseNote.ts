import type { ParsedNote } from "../types.ts"

// Parses a note in the following format:
//   @note {note_id}
//   - expression :: annotation
//   - expression :: annotation
//
// Each "- expression :: annotation" line becomes one note piece.
// Lines that don't match the pattern are ignored.
export function parseNote(noteId: string, rawContent: string): ParsedNote {
  const pieces: ParsedNote["pieces"] = []

  for (const line of rawContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("- ")) continue
    const separatorIndex = trimmed.indexOf(" :: ")
    if (separatorIndex === -1) continue
    const expression = trimmed.slice(2, separatorIndex).trim()
    const annotation = trimmed.slice(separatorIndex + 4).trim()
    if (!expression || !annotation) continue
    pieces.push({
      notePieceId: crypto.randomUUID(),
      expression,
      annotation,
    })
  }

  return { noteId, pieces }
}
