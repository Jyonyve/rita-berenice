import { ChatMessageType, ALPHANUMERIC_ALPHABET } from '../../shared/index.ts';
import { customAlphabet } from 'nanoid';

/* gen uuid (shortened)*/
const _genNanoId = (length: number) => customAlphabet(ALPHANUMERIC_ALPHABET, length)();

/* ID suffix */
export const SUFFIX = {
	REQUEST: 'request',
	RESPONSE: 'response',
	TURN: 'turn',
	STORY: ' story',
	RELATIONSHIP: 'relationship',
	RECAP: 'recap',
	LORE: 'lore',
	HISTORY: 'history',
	TERM: 'term',
} as const;
export type SuffixType = (typeof SUFFIX)[keyof typeof SUFFIX];

/* character id */
export const buildCharacterId = (characterName: string, variant?: string): string => {
	return `${characterName}_${variant || _genNanoId(8)}`;
};

export const buildProfileId = (profileName: string, sessionId: string) => {
	return `${profileName}_${sessionId}`;
};

export const buildLoreId = (englishId: string) => {
	// englishId is the kebab-case summary of the lore title
	return `${englishId}_${_genNanoId(8)}_${SUFFIX.LORE}`;
};

export const buildHistoryId = (englishId: string) => {
	// englishId is the kebab-case summary of the history title
	return `${englishId}_${_genNanoId(8)}_${SUFFIX.HISTORY}`;
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
	return `${sessionId}_${sequence}_${SUFFIX.TURN}`;
};

// other collections
export const buildRecapId = (sessionId: string, turnStart: number, turnEnd: number): string => {
	return `${sessionId}_${turnStart}to${turnEnd}_${SUFFIX.RECAP}`;
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

export const buildRecapDocId = (sessionId: string): string => `${sessionId}_${SUFFIX.RECAP}`;

export const buildRelationshipRecapDocId = (sessionId: string): string =>
	`${sessionId}_${SUFFIX.RELATIONSHIP}`;

export const buildStoryId = (sessionId: string, type?: 'NSFW'): string => {
	return type ? `${sessionId}_${SUFFIX.STORY}_${type}` : `${sessionId}_${SUFFIX.STORY}`;
};
