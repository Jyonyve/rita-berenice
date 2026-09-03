export const RESOURCES = {
  CHARACTER: 'character',
  CHAT: 'chat',
  HISTORY: 'history',
  LORE: 'lore',
  PROFILE: 'profile',
  TEMP: 'temp',
  TERM: 'term',
  USER: 'user',
  DOCUMENT: 'document',
} as const;

export type ResourceType = (typeof RESOURCES)[keyof typeof RESOURCES];
