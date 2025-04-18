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
	return `${sessionId}_${sequence}_${SUFFIX.SET}`;
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
