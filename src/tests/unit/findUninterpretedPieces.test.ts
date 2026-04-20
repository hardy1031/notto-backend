import { describe, expect, it } from "bun:test"
import { findUninterpretedPieces } from "../../domain/note/note_piece/findUninterpretedPieces.ts"
import type { ContextObject, NotePiece } from "../../domain/types.ts"

const makePiece = (id: string): NotePiece => ({
  id,
  noteId: "note-1",
  createdAt: new Date(),
})

const makeContextObject = (notePieceId: string): ContextObject => ({
  id: `co-${notePieceId}`,
  notePieceId,
  noteId: "note-1",
  expression: "test",
  baseMeaning: "test",
  actualNuance: "test",
  tone: "neutral",
  formality: "casual",
  isSlang: false,
  exampleDialogue: [],
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe("findUninterpretedPieces", () => {
  it("returns all pieces when no context objects exist", () => {
    const pieces = [makePiece("p1"), makePiece("p2")]
    const result = findUninterpretedPieces(pieces, [])
    expect(result).toEqual(pieces)
  })

  it("returns empty array when all pieces have context objects", () => {
    const pieces = [makePiece("p1"), makePiece("p2")]
    const contextObjects = [makeContextObject("p1"), makeContextObject("p2")]
    const result = findUninterpretedPieces(pieces, contextObjects)
    expect(result).toEqual([])
  })

  it("returns only pieces without context objects", () => {
    const pieces = [makePiece("p1"), makePiece("p2"), makePiece("p3")]
    const contextObjects = [makeContextObject("p1"), makeContextObject("p3")]
    const result = findUninterpretedPieces(pieces, contextObjects)
    expect(result).toEqual([makePiece("p2")])
  })

  it("returns empty array when pieces is empty", () => {
    const contextObjects = [makeContextObject("p1")]
    const result = findUninterpretedPieces([], contextObjects)
    expect(result).toEqual([])
  })

  it("ignores context objects whose note_piece_id does not match any piece", () => {
    const pieces = [makePiece("p1")]
    const contextObjects = [makeContextObject("p-nonexistent")]
    const result = findUninterpretedPieces(pieces, contextObjects)
    expect(result).toEqual(pieces)
  })
})
