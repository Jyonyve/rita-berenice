import { ChatMessageType, ALPHANUMERIC_ALPHABET } from '../index.ts';
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
	TEMP: 'temp',
} as const;
export type SuffixType = (typeof SUFFIX)[keyof typeof SUFFIX];

/* character id */
export const buildCharacterId = (characterName: string, variant?: string): string => {
	return `${characterName}_${variant || _genNanoId(8)}`;
};

export const buildProfileId = (profileName: string, sessionId: string) => {
	return `${profileName}_${sessionId}`;
};

export const buildLoreId = (characterId: string, timestamp: string) => {
	return `${characterId}_${timestamp}_${SUFFIX.LORE}`;
};

export const buildHistoryId = (characterId: string, timestamp: string) => {
	return `${characterId}_${timestamp}_${SUFFIX.HISTORY}`;
};

/* chat id */
export const buildSessionId = (characterId: string): string => {
	return `${characterId}_${_genNanoId(16)}`;
};

export const parseSessionId = (
	sessionId: string
): { charName: string; variant: string; uuid: string } => {
	const parts = sessionId.split('_');
	if (parts.length < 3) {
		throw new Error(`Invalid session ID format: ${sessionId}`);
	}
	return {
		charName: parts[0],
		variant: parts[1],
		uuid: parts[2], // In case UUID contains underscores
	};
};

export const buildMessageId = (
	sessionId: string,
	sequence: number,
	messageType: ChatMessageType
): string => {
	return `${sessionId}_${sequence}_${messageType}`;
};

export const buildTurnId = (sessionId: string, sequence: number): string => {
	return `${sessionId}_${sequence}_${SUFFIX.SET}`;
};

// other collections
export const buildRecapId = (sessionId: string): string => {
	return `${sessionId}_${SUFFIX.RECAP}`;
};

export const buildRelationshipRecapId = (sessionId: string): string => {
	return `${sessionId}_${SUFFIX.RELATIONSHIP}`;
};

export const parseMessageId = (
	messageId: string
): { sessionId: string; sequence: number; type: ChatMessageType; index?: number } => {
	const parts = messageId.split('_');
	if (parts.length < 3) {
		throw new Error(`Invalid message ID format: ${messageId}`);
	}

	return { sessionId: parts[0], sequence: parseInt(parts[1]), type: parts[2] as ChatMessageType };
};
