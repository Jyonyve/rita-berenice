import { ALPHANUMERIC_ALPHABET, METADATA_TYPES } from '#shared/config/constants.js';
import { ChatIndexContentType, ChatMessageType } from '#shared/domain/chat/chat.type.js';
import { customAlphabet } from 'nanoid';
import { _nanoid } from 'zod/v4/core';
import { LoreIndexContentType } from '../domain/lore/lore.type.ts';
import { RecapIndexContentType } from '../domain/recap/RecapInterfaces.js';
import { LangCode } from '../config/langConstants.js';
import { generateNickName } from '../config/nicknameConstants.js';

/* gen uuid (shortened)*/
const _genNanoId = (length: number) => customAlphabet(ALPHANUMERIC_ALPHABET, length)();
const sanitizeIdInput = (input: string): string => {
	return input.toLowerCase().replace(/[\s_]+/g, '-');
};

/* ID suffix */
export const SUFFIX = {
	REQUEST: 'request',
	RESPONSE: 'response',
	TURN: 'turn',
	TEMP: 'temp',
	STORY: ' story',
	RELATIONSHIP: 'relationship',
	RECAP: 'recap',
	LORE: 'lore',
	HISTORY: 'history',
	TERM: 'term',
	CREDENTIAL: 'credential',
} as const;
export type SuffixType = (typeof SUFFIX)[keyof typeof SUFFIX];

export const buildCredentialId = (userId: string) => {
	return `${userId}_${SUFFIX.CREDENTIAL}`;
};

export const buildUserShowName = (langCode: LangCode = 'kor') => {
	return generateNickName(langCode);
};

/* character id */
export const buildCharacterId = (characterName: string, variant?: string): string => {
	return `${characterName}_${variant || _genNanoId(8)}`;
};

export const buildProfileId = (sessionId: string, userId: string) => {
	return `${sessionId}_${userId}`;
};

export const buildLoreId = (characterId: string, category: string) => {
	return `${characterId}_${sanitizeIdInput(category)}_${_genNanoId(4)}_${SUFFIX.LORE}`;
};

export const buildHistoryId = (characterId: string, periodLabel: string) => {
	return `${characterId}_${sanitizeIdInput(periodLabel)}_${_genNanoId(4)}_${SUFFIX.HISTORY}`;
};

/* chat id */
export const buildSessionId = (characterId: string): string => {
	return `${characterId}_${_genNanoId(8)}`;
};

export const buildMessageId = (
	sessionId: string,
	sequence: number,
	messageType: ChatMessageType
): string => {
	return `${sessionId}_${sequence}_${messageType}`;
};

export const buildChatTurnId = (sessionId: string, sequence: number): string => {
	return `${sessionId}_${sequence}_${SUFFIX.TURN}`;
};

export const buildChatTurnIndexId = (
	chatTurnId: string,
	contentType: ChatIndexContentType
): string => {
	return `${chatTurnId}_${sanitizeIdInput(contentType)}_${_genNanoId(4)}`;
};

export const buildLoreIndexId = (loreId: string, contentType: LoreIndexContentType): string => {
	return `${loreId}_${sanitizeIdInput(contentType)}_${_genNanoId(4)}`;
};

export const buildHistoryIndexId = (
	historyId: string,
	contentType: LoreIndexContentType
): string => {
	return `${historyId}_${sanitizeIdInput(contentType)}_${_genNanoId(4)}`;
};

export const buildRecapIndexId = (
	chatTurnId: string,
	contentType: RecapIndexContentType
): string => {
	return `${chatTurnId}_${sanitizeIdInput(contentType)}_${_genNanoId(4)}`;
};

export const buildTempChatTurnId = (sessionId: string, sequence: number): string => {
	return `${sessionId}_${sequence}_${SUFFIX.TEMP}`;
};

export const buildRecapId = (sessionId: string, turnStart: number, turnEnd: number): string => {
	return `${sessionId}_${turnStart}_${turnEnd}_${SUFFIX.RECAP}`;
};

export const buildCharacterTermId = (characterId: string): string => {
	return `${characterId}_${_genNanoId(4)}_${METADATA_TYPES.CHARACTER}_${SUFFIX.TERM}`;
};

export const buildSessionTermId = (sessionId: string): string => {
	return `${sessionId}_${_genNanoId(4)}_${METADATA_TYPES.SESSION}_${SUFFIX.TERM}`;
};

export const buildRelationshipRecapId = (
	sessionId: string,
	turnStart: number,
	turnEnd: number
): string => {
	return `${sessionId}_${turnStart}to${turnEnd}_${SUFFIX.RELATIONSHIP}`;
};

export const buildStoryId = (sessionId: string, type?: 'NSFW'): string => {
	return type ? `${sessionId}_${SUFFIX.STORY}_${type}` : `${sessionId}_${SUFFIX.STORY}`;
};
