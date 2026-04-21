import type { NotebookRepository } from "../domain/notebook/NotebookRepository.ts"
import type { NotebookQueryService } from "./queries/NotebookQueryService.ts"
import type { Notebook } from "../domain/types.ts"

export type SyncNotebookInput = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type SyncNotebooksOutput = {
  clientNotebooks: Notebook[]
}

export async function SyncNotebooksUseCase(
  input: {
    userId: string
    clientNotebooks: SyncNotebookInput[]
  },
  deps: {
    notebookRepo: NotebookRepository & NotebookQueryService
  }
): Promise<SyncNotebooksOutput> {
  const { userId, clientNotebooks } = input

  // sync notebooks from client to server (LWW by updatedAt)
  const clientNotebookIds = clientNotebooks.map((notebook) => notebook.id)
  const serverNotebooksById = new Map<string, Notebook>()
  if (clientNotebookIds.length > 0) {
    const serverNotebooks = await deps.notebookRepo.findByUserIdAndIds(userId, clientNotebookIds)
    for (const notebook of serverNotebooks) {
      serverNotebooksById.set(notebook.id, notebook)
    }
  }

  // create a notebook if server doesn't have one, update if one exists already
  for (const notebook of clientNotebooks) {
    const serverNotebook = serverNotebooksById.get(notebook.id)
    if (!serverNotebook) {
      await deps.notebookRepo.create({ id: notebook.id, userId, name: notebook.name, createdAt: notebook.createdAt, updatedAt: notebook.updatedAt, syncedAt: new Date() })
    } else if (notebook.updatedAt > serverNotebook.updatedAt) {
      await deps.notebookRepo.update({ ...serverNotebook, name: notebook.name, updatedAt: notebook.updatedAt, syncedAt: new Date() })
    }
  }

  if (clientNotebookIds.length > 0) {
    await deps.notebookRepo.updateSyncedAt(clientNotebookIds, new Date())
  }

  // return notebooks the server has that the client does not
  const serverNotebooks = await deps.notebookRepo.findByUserId(userId)
  const clientNotebookIdSet = new Set(clientNotebookIds)
  return {
    clientNotebooks: serverNotebooks.filter((notebook) => !clientNotebookIdSet.has(notebook.id)),
  }
}
