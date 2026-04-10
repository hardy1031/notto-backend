import type { NotebookRepository } from "../../repositories/notebookRepository.ts"
import type { Notebook } from "../../repositories/types.ts"

export async function createNotebook(
  notebook: Notebook,
  notebookRepo: NotebookRepository
): Promise<void> {
  await notebookRepo.create(notebook)
}
