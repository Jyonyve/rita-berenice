import { ChatEntry, ChatMessage, ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { HistoryInfo, LoreInfo } from '#shared/domain/lore/LoreInterfaces.js';
import { RecapInfo } from '#shared/domain/recap/RecapInterfaces.js';
import { TermType } from '#shared/domain/term/TermInterfaces.js';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { SessionInfo } from '#shared/domain/session/SessionInterfaces.js';
import { parseConversationToEntries, parseEntriesToConversation } from './chatParseUtils.js';
import { Term } from '#shared/api/ModuleResponse.js';

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
	const { description, instruction } = character;
	const document = { description, instruction };
	return JSON.stringify(document).trim();
};

export const inflateCharacterDoc = (
	document: string
): { description: string; instruction: string; firstMessage: string } => {
	const parsed = JSON.parse(document);
	return {
		description: parsed.description,
		instruction: parsed.instruction,
		firstMessage: parsed.firstMessage,
	};
};

export const flatProfileToDoc = (profile: ProfileInfo) => {
	const document = { description: profile.description };
	return JSON.stringify(document).trim();
};

export const inflateProfileDoc = (document: string): { description: string } => {
	const parsed = JSON.parse(document);
	return { description: parsed.description };
};

export const loreOrHistoryToDocument = (lore: LoreInfo | HistoryInfo): string => {
	return `Title: ${lore.title}\nSummary: ${lore.summary}\n\n${lore.content}`;
};

export const flatTermToDoc = (term: Term) => {
	const { koreanTerm, englishTerm, termId, type } = term;
	const document = { koreanTerm, englishTerm, termId, type };
	return JSON.stringify(document).trim();
};

export const inflateTermDoc = (
	document: string
): { koreanTerm: string; englishTerm: string; termId: string; type: TermType } => {
	const parsed = JSON.parse(document);
	return {
		koreanTerm: parsed.koreanTerm,
		englishTerm: parsed.englishTerm,
		termId: parsed.termId,
		type: parsed.type,
	};
};

export const recapToDocument = (recap: RecapInfo) => {
	return recap.content;
};

export const flatSessionToDoc = (session: SessionInfo) => {
	const document = { lastCharMessage: session.lastCharMessage };
	return JSON.stringify(document).trim();
};

export const inflateSessionDoc = (document: string): { lastCharMessage: string } => {
	const parsed = JSON.parse(document);
	return { lastCharMessage: parsed.lastCharMessage };
};
