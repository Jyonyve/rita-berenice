export type ChatDisplayMode = 'book' | 'conversation';

export const DEFAULT_CHAT_DISPLAY_MODE: ChatDisplayMode = 'book';

export const getChatDisplayModeStorageKey = (userId: string): string => `rita-chat-display-mode:${userId}`;

export const readChatDisplayMode = (storage: Pick<Storage, 'getItem'> | undefined, key: string): ChatDisplayMode => {
  try {
    const value = storage?.getItem(key);
    return value === 'conversation' || value === 'book' ? value : DEFAULT_CHAT_DISPLAY_MODE;
  } catch {
    return DEFAULT_CHAT_DISPLAY_MODE;
  }
};

export const writeChatDisplayMode = (
  storage: Pick<Storage, 'setItem'> | undefined,
  key: string,
  mode: ChatDisplayMode,
): void => {
  try {
    storage?.setItem(key, mode);
  } catch {
    // The preference remains usable for the current page when storage is unavailable.
  }
};
