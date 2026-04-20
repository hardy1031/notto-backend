import type { ContextObject, NotePiece } from "../../types.ts"

export function findUninterpretedPieces(
  notePieces: NotePiece[],
  existingContextObjects: ContextObject[]
): NotePiece[] {
  const interpretedPieceIds = new Set(existingContextObjects.map((co) => co.notePieceId))
  return notePieces.filter((piece) => !interpretedPieceIds.has(piece.id))
}
