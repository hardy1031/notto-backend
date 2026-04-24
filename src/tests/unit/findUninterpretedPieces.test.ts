import { describe, expect, it } from "bun:test"
import { ContextObjectEntity } from "../../domain/contextObject/ContextObjectEntity.ts"
import { NotePieceEntity } from "../../domain/note/NotePieceEntity.ts"

const makePiece = (id: string): NotePieceEntity =>
  NotePieceEntity.create({ id, noteId: "note-1", createdAt: new Date() })

const makeContextObject = (notePieceId: string): ContextObjectEntity =>
  ContextObjectEntity.create({
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

describe("NotePieceEntity.findUninterpreted", () => {
  it("returns all pieces when no context objects exist", () => {
    const pieces = [makePiece("p1"), makePiece("p2")]
    const result = NotePieceEntity.findUninterpreted(pieces, [])
    expect(result).toEqual(pieces)
  })

  it("returns empty array when all pieces have context objects", () => {
    const pieces = [makePiece("p1"), makePiece("p2")]
    const contextObjects = [makeContextObject("p1"), makeContextObject("p2")]
    const result = NotePieceEntity.findUninterpreted(pieces, contextObjects)
    expect(result).toEqual([])
  })

  it("returns only pieces without context objects", () => {
    const pieces = [makePiece("p1"), makePiece("p2"), makePiece("p3")]
    const contextObjects = [makeContextObject("p1"), makeContextObject("p3")]
    const result = NotePieceEntity.findUninterpreted(pieces, contextObjects)
    expect(result).toEqual([makePiece("p2")])
  })

  it("returns empty array when pieces is empty", () => {
    const contextObjects = [makeContextObject("p1")]
    const result = NotePieceEntity.findUninterpreted([], contextObjects)
    expect(result).toEqual([])
  })

  it("ignores context objects whose note_piece_id does not match any piece", () => {
    const pieces = [makePiece("p1")]
    const contextObjects = [makeContextObject("p-nonexistent")]
    const result = NotePieceEntity.findUninterpreted(pieces, contextObjects)
    expect(result).toEqual(pieces)
  })
})
