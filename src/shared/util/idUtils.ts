import { v4 as uuidv4 } from 'uuid';
import { ChatMessageType, SUFFIX, SuffixType } from '@shared/domain/index.ts';

/* character id */
export const buildCharacterId = (characterName: string, variant: string): string => {
	return `${characterName}_${variant}`;
};

export const buildProfileId = (profileName: string, sessionId: string) => {
	return `${profileName}_${sessionId}`;
};

/* chat id */
export const buildSessionId = (characterId: string): string => {
	return `${characterId}_${uuidv4()}`;
};

export const parseSessionId = (
	sessionId: string
): { characterName: string; variant: string; uuid: string } => {
	const parts = sessionId.split('_');
	if (parts.length < 3) {
		throw new Error(`Invalid session ID format: ${sessionId}`);
	}
	return {
		characterName: parts[0],
		variant: parts[1],
		uuid: parts.slice(2).join('_'), // In case UUID contains underscores
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
	return `${sessionId}_${sequence}_${SUFFIX.FULL}`;
};

export const buildRecapId = (sessionId: string) => {
	return `${sessionId}_${SUFFIX.RECAP}`;
};

export const buildSummaryId = (sessionId: string): string => {
	return `${sessionId}_${SUFFIX.SUMMARY}`;
};

export const parseMessageId = (
	messageId: string
): { sessionId: string; sequence: number; type: SuffixType; index?: number } => {
	const parts = messageId.split('_');
	if (parts.length < 3) {
		throw new Error(`Invalid message ID format: ${messageId}`);
	}

	const lastPart = parts[parts.length - 1];
	const secondLastPart = parts[parts.length - 2];

	if (lastPart === SUFFIX.SUMMARY) {
		return {
			sessionId: parts.slice(0, parts.length - 1).join('_'),
			sequence: -1, // No sequence for summaries
			type: SUFFIX.SUMMARY,
		};
	} else if (lastPart === SUFFIX.FULL) {
		return {
			sessionId: parts.slice(0, parts.length - 2).join('_'),
			sequence: parseInt(secondLastPart, 10),
			type: SUFFIX.FULL,
		};
	} else if (lastPart.match(/^\d+$/)) {
		return {
			sessionId: parts.slice(0, parts.length - 3).join('_'),
			sequence: parseInt(parts[parts.length - 3], 10),
			type: SUFFIX.RESPONSE,
			index: parseInt(lastPart, 10),
		};
	} else {
		return {
			sessionId: parts.slice(0, parts.length - 2).join('_'),
			sequence: parseInt(secondLastPart, 10),
			type: lastPart as SuffixType,
		};
	}
};
