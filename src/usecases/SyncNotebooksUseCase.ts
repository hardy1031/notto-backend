import { createNotebook } from "../domain/notebook/createNotebook.ts"
import { updateNotebook } from "../domain/notebook/updateNotebook.ts"
import type { NotebookRepository } from "../repositories/notebookRepository.ts"
import type { Notebook } from "../repositories/types.ts"

export type SyncNotebookInput = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type SyncNotebooksOutput = {
  notebooks: Notebook[]
}

export async function SyncNotebooksUseCase(
  input: {
    userId: string
    notebooks: SyncNotebookInput[]
  },
  deps: {
    notebookRepo: NotebookRepository
  }
): Promise<SyncNotebooksOutput> {
  const { userId, notebooks } = input

  // sync notebooks from client to server (LWW by updatedAt)
  const clientIds = notebooks.map((nb) => nb.id)
  const existingNotebooks =
    clientIds.length > 0
      ? await deps.notebookRepo.findByUserIdAndIds(userId, clientIds)
      : []
  const existingMap = new Map(existingNotebooks.map((nb) => [nb.id, nb]))

  for (const notebook of notebooks) {
    const existing = existingMap.get(notebook.id)
    if (!existing) {
      await createNotebook(
        { id: notebook.id, userId, name: notebook.name, createdAt: notebook.createdAt, updatedAt: notebook.updatedAt },
        deps.notebookRepo
      )
    } else if (notebook.updatedAt > existing.updatedAt) {
      await updateNotebook(
        { ...existing, name: notebook.name, updatedAt: notebook.updatedAt },
        deps.notebookRepo
      )
    }
  }

  // return notebooks the server has that the client does not
  const serverNotebooks = await deps.notebookRepo.findByUserId(userId)
  const clientIdSet = new Set(clientIds)
  return {
    notebooks: serverNotebooks.filter((nb) => !clientIdSet.has(nb.id)),
  }
}
