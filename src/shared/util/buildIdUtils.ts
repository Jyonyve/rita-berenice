import { ALPHANUMERIC_ALPHABET } from '#shared/config/constants.js';
import { ChatIndexContentType, ChatMessageType } from '#shared/domain/chat/ChatInterfaces.js';
import { customAlphabet } from 'nanoid';
import { _nanoid } from 'zod/v4/core';
import { LoreIndexContentType } from '../domain/lore/LoreInterfaces.js';
import { RecapIndexContentType } from '../domain/recap/RecapInterfaces.js';

/* gen uuid (shortened)*/
const _genNanoId = (length: number) => customAlphabet(ALPHANUMERIC_ALPHABET, length)();
const convertContentType = (contentType: string) => contentType.toLowerCase().replaceAll('_', '-');

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

/* character id */
export const buildCharacterId = (characterName: string, variant?: string): string => {
	return `${characterName}_${variant || _genNanoId(8)}`;
};

export const buildProfileId = (sessionId: string, userId: string) => {
	return `${sessionId}_${userId}`;
};

export const buildLoreId = (characterId: string, englishId: string) => {
	// englishId is the kebab-case summary of the lore title
	return `${characterId}_${englishId}_${SUFFIX.LORE}`;
};

export const buildHistoryId = (characterId: string, englishId: string) => {
	// englishId is the kebab-case summary of the history title
	return `${characterId}_${englishId}_${SUFFIX.HISTORY}`;
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
	return `${chatTurnId}_${convertContentType(contentType)}_${_genNanoId(4)}`;
};

export const buildLoreIndexId = (contentId: string, contentType: LoreIndexContentType): string => {
	return `${contentId}_${convertContentType(contentType)}_${_genNanoId(4)}`;
};

export const buildRecapIndexId = (
	chatTurnId: string,
	contentType: RecapIndexContentType
): string => {
	return `${chatTurnId}_${convertContentType(contentType)}_${_genNanoId(4)}`;
};

export const buildTempChatTurnId = (sessionId: string, sequence: number): string => {
	return `${sessionId}_${sequence}_${SUFFIX.TEMP}`;
};

export const buildRecapId = (sessionId: string, turnStart: number, turnEnd: number): string => {
	return `${sessionId}_${turnStart}_${turnEnd}_${SUFFIX.RECAP}`;
};

export const buildTermId = (sessionId: string): string => {
	return `${sessionId}_${_genNanoId(8)}_${SUFFIX.TERM}`;
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
