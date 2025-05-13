import { ChatMessageType, ALPHANUMERIC_ALPHABET } from '../../shared/index.ts';
import { customAlphabet } from 'nanoid';

/* gen uuid (shortened)*/
const _genNanoId = (length: number) => customAlphabet(ALPHANUMERIC_ALPHABET, length)();

/* ID suffix */
export const SUFFIX = {
	REQUEST: 'request',
	RESPONSE: 'response',
	SET: 'set',
	RELATIONSHIP: 'relationship',
	RECAP: 'recap',
	LORE: 'lore',
	HISTORY: 'history',
} as const;
export type SuffixType = (typeof SUFFIX)[keyof typeof SUFFIX];

/* character id */
export const buildCharacterId = (characterName: string, variant?: string): string => {
	return `${characterName}_${variant || _genNanoId(8)}`;
};

export const buildProfileId = (profileName: string, sessionId: string) => {
	return `${profileName}_${sessionId}`;
};

export const buildLoreId = (characterId: string, createdAt: string) => {
	return `${characterId}_${Date.parse(createdAt)}_${SUFFIX.LORE}`;
};

export const buildHistoryId = (characterId: string, createdAt: string) => {
	return `${characterId}_${Date.parse(createdAt)}_${SUFFIX.HISTORY}`;
};

/* chat id */
export const buildSessionId = (characterId: string): string => {
	return `${characterId}_${_genNanoId(16)}`;
};

export const buildMessageId = (
	sessionId: string,
	sequence: number,
	messageType: ChatMessageType
): string => {
	return `${sessionId}_${sequence}_${messageType}`;
};

export const buildChatTurnId = (sessionId: string, sequence: number): string => {
	return `${sessionId}_${sequence}_${SUFFIX.SET}`;
};

// other collections
export const buildRecapId = (sessionId: string): string => {
	return `${sessionId}_${SUFFIX.RECAP}`;
};

export const buildRelationshipRecapId = (sessionId: string): string => {
	return `${sessionId}_${SUFFIX.RELATIONSHIP}`;
};
