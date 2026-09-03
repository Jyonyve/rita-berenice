import { LoreInfo, RecapInfo } from '@rita-berenice/shared/domain';

export const filterLoreByScope = (lores: LoreInfo[], sessionId?: string): LoreInfo[] =>
  lores.filter((lore) => (sessionId ? lore.sessionId === sessionId : !lore.sessionId));

export const sortSessionSummaries = (summaries: RecapInfo[]): RecapInfo[] =>
  [...summaries].sort(
    (left, right) =>
      left.turnStart - right.turnStart || left.turnEnd - right.turnEnd || left.recapId.localeCompare(right.recapId),
  );

export const syncEditingLoreRetrievalPreference = (
  editingLore: LoreInfo | undefined,
  updatedLore: LoreInfo,
): LoreInfo | undefined =>
  editingLore?.loreId === updatedLore.loreId
    ? {
        ...editingLore,
        retrievalEnabled: updatedLore.retrievalEnabled,
        updatedAt: updatedLore.updatedAt,
      }
    : editingLore;
