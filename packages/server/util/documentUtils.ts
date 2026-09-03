import {
  ChatEntry,
  ChatTurn,
  CharacterInfo,
  CharacterDocument,
  ProfileInfo,
  ProfileDocument,
  LoreInfo,
  HistoryInfo,
  RecapInfo,
  SessionInfo,
  SessionDocument,
  UserDocument,
  UserInfo,
} from '@rita-berenice/shared/domain';

import { parseConversationToEntries, parseEntriesToConversation } from './chatParseUtils.js';

export const flatChatMessageToDoc = (entries: ChatEntry[]) => {
  return parseEntriesToConversation(entries).trim();
};

export const inflateChatMessageDoc = (document: string) => {
  return parseConversationToEntries(document);
};

export const chatTurnToDocument = (chatTurn: ChatTurn): string => {
  const userText = parseEntriesToConversation(chatTurn.request.entries);
  const charText = parseEntriesToConversation(chatTurn.response.entries);

  return `User (${chatTurn.request.showName}): "${userText}"\nCharacter (${chatTurn.response.showName}): "${charText}"`;
};

export const flatCharacterToDoc = (character: CharacterInfo) => {
  const { description, worldIntroduction, instruction, worldLoreId, firstMessage } = character;
  const document: CharacterDocument = {
    description,
    worldIntroduction,
    instruction,
    worldLoreId,
    firstMessage,
  };
  return JSON.stringify(document).trim();
};

export const inflateCharacterDoc = (document: string): CharacterDocument => {
  const parsed = JSON.parse(document);
  return {
    description: parsed.description,
    worldIntroduction: parsed.worldIntroduction ?? '',
    instruction: parsed.instruction,
    worldLoreId: parsed.worldLoreId,
    firstMessage: parsed.firstMessage,
  };
};

export const flatProfileToDoc = (profile: ProfileInfo) => {
  const document: ProfileDocument = { description: profile.description };
  return JSON.stringify(document).trim();
};

export const inflateProfileDoc = (document: string): ProfileDocument => {
  const parsed = JSON.parse(document);
  return { description: parsed.description };
};

export const loreToDocument = (lore: LoreInfo): string => {
  return `Title: ${lore.title}\nCategory: ${lore.category}\n\n${lore.content}`;
};

export const historyToDocument = (history: HistoryInfo): string => {
  return `Title: ${history.title}\nSummary: ${history.summary}\n\n${history.content}`;
};

export const recapToDocument = (recap: RecapInfo) => {
  return recap.content;
};

export const flatSessionToDoc = (session: SessionInfo) => {
  const document: SessionDocument = {
    lastCharMessage: session.lastCharMessage,
    userNote: session.userNote,
  };
  return JSON.stringify(document).trim();
};

export const inflateSessionDoc = (document: string): SessionDocument => {
  const parsed = JSON.parse(document);
  return { lastCharMessage: parsed.lastCharMessage, userNote: parsed.userNote };
};

export const flatUserToDoc = (user: UserInfo) => {
  const document: UserDocument = { email: user.email, userId: user.userId };
  return JSON.stringify(document).trim();
};

export const inflateUserDoc = (document: string): UserDocument => {
  const parsed = JSON.parse(document);
  return { email: parsed.email, userId: parsed.userId };
};
