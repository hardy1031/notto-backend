import { NotebookEntity } from "../domain/notebook/NotebookEntity.ts"
import type { NotebookRepository } from "../domain/notebook/NotebookRepository.ts"
import type { NotebookQueryService } from "./queries/NotebookQueryService.ts"

export type SyncNotebookInput = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type SyncNotebooksOutput = {
  clientNotebooks: NotebookEntity[]
}

export async function SyncNotebooksUseCase(
  input: {
    userId: string
    clientNotebooks: SyncNotebookInput[]
  },
  deps: {
    notebookRepo: NotebookRepository
    notebookQueryService: NotebookQueryService
  }
): Promise<SyncNotebooksOutput> {
  const { userId, clientNotebooks } = input

  const clientNotebookIds = clientNotebooks.map((notebook) => notebook.id)
  const serverNotebooksById = new Map<string, NotebookEntity>()

  if (clientNotebookIds.length > 0) {
    // fetch including deleted so we can apply "deleted wins" correctly
    const serverNotebooks = await deps.notebookQueryService.findAllForSync(userId)
    for (const notebook of serverNotebooks) {
      serverNotebooksById.set(notebook.id, notebook)
    }
  }

  const now = new Date()

  for (const clientNotebook of clientNotebooks) {
    const serverNotebook = serverNotebooksById.get(clientNotebook.id)

    if (clientNotebook.deletedAt) {
      // client deleted this notebook
      if (serverNotebook && !serverNotebook.isDeleted) {
        // "deleted wins": propagate deletion to server with cascade
        await deps.notebookRepo.softDeleteWithCascade(clientNotebook.id, clientNotebook.deletedAt)
      }
      // if server is already deleted or doesn't exist: no-op
      continue
    }

    if (!serverNotebook) {
      await deps.notebookRepo.create(
        NotebookEntity.create({
          id: clientNotebook.id,
          userId,
          name: clientNotebook.name,
          createdAt: clientNotebook.createdAt,
          updatedAt: clientNotebook.updatedAt,
          syncedAt: now,
          deletedAt: null,
        })
      )
    } else if (serverNotebook.isDeleted) {
      // "deleted wins": ignore client update, server deletion takes precedence
    } else if (clientNotebook.updatedAt > serverNotebook.updatedAt) {
      await deps.notebookRepo.update(
        serverNotebook.withUpdates(clientNotebook.name, clientNotebook.updatedAt, now)
      )
    }
  }

  const nonDeletedClientIds = clientNotebooks.filter((n) => !n.deletedAt).map((n) => n.id)
  if (nonDeletedClientIds.length > 0) {
    await deps.notebookRepo.updateSyncedAt(nonDeletedClientIds, now)
  }

  // return notebooks for sync:
  // - new for client: server has it, client doesn't, not deleted
  // - tombstones: client has it, server has deleted_at set
  const allServerNotebooks = await deps.notebookQueryService.findAllForSync(userId)
  const clientNotebookIdSet = new Set(clientNotebookIds)

  const result = allServerNotebooks.filter(
    (n) =>
      (!clientNotebookIdSet.has(n.id) && !n.isDeleted) || // new for client
      (clientNotebookIdSet.has(n.id) && n.isDeleted) // tombstone for client
  )

  return { clientNotebooks: result }
}
