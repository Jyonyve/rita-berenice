export type ChatFontSize = number;
export type ChatFontWeight = 'normal' | 'bold';

export const MIN_CHAT_FONT_SIZE = 12;
export const DEFAULT_CHAT_FONT_SIZE = 16;
export const MAX_CHAT_FONT_SIZE = 22;
export const DEFAULT_CHAT_FONT_WEIGHT: ChatFontWeight = 'normal';

export const CHAT_FONT_WEIGHT_VALUES: Record<ChatFontWeight, number> = { normal: 400, bold: 700 };

export const getChatFontSizeStorageKey = (userId: string): string => `rita-chat-font-size:${userId}`;

export const getChatFontWeightStorageKey = (userId: string): string => `rita-chat-font-weight:${userId}`;

export const normalizeChatFontSize = (fontSize: number): ChatFontSize =>
  Math.min(MAX_CHAT_FONT_SIZE, Math.max(MIN_CHAT_FONT_SIZE, Math.round(fontSize)));

export const readChatFontSize = (storage: Pick<Storage, 'getItem'> | undefined, key: string): ChatFontSize => {
  try {
    const value = storage?.getItem(key);
    if (value === 'small') return 14;
    if (value === 'medium') return DEFAULT_CHAT_FONT_SIZE;
    if (value === 'large') return 18;
    if (value === null || value === undefined || value.trim() === '') return DEFAULT_CHAT_FONT_SIZE;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? normalizeChatFontSize(parsed) : DEFAULT_CHAT_FONT_SIZE;
  } catch {
    return DEFAULT_CHAT_FONT_SIZE;
  }
};

export const writeChatFontSize = (
  storage: Pick<Storage, 'setItem'> | undefined,
  key: string,
  fontSize: ChatFontSize,
): void => {
  try {
    storage?.setItem(key, String(normalizeChatFontSize(fontSize)));
  } catch {
    // The preference remains usable for the current page when storage is unavailable.
  }
};

export const readChatFontWeight = (storage: Pick<Storage, 'getItem'> | undefined, key: string): ChatFontWeight => {
  try {
    const value = storage?.getItem(key);
    return value === 'normal' || value === 'bold' ? value : DEFAULT_CHAT_FONT_WEIGHT;
  } catch {
    return DEFAULT_CHAT_FONT_WEIGHT;
  }
};

export const writeChatFontWeight = (
  storage: Pick<Storage, 'setItem'> | undefined,
  key: string,
  fontWeight: ChatFontWeight,
): void => {
  try {
    storage?.setItem(key, fontWeight);
  } catch {
    // The preference remains usable for the current page when storage is unavailable.
  }
};
