import {
	BasicCharacterInfo,
	HistoryInfo,
	CharacterMetadata,
	LoreInfo,
	ChatTurn,
	parseEntriesToText,
	ProfileMetadata,
	ChatEntry,
	ChatMessage,
	LoreMetadata,
	HistoryMetadata,
} from '#shared/index.ts';

export const buildNaturalChatText = (request: ChatMessage, response: ChatMessage): string => {
	const userPrompt = parseEntriesToText(request.entries);
	const charResponse = parseEntriesToText(response.entries);

	let documentText = `User Prompt by ${request.showName}: ${userPrompt}\n`;
	documentText += `Character Response by ${response.showName} (Emotion: ${response.emotion}) : ${charResponse}\n\n`;

	return documentText.trim();
};

export const buildChatMessageDocument = (entries: ChatEntry[]) => {
	return parseEntriesToText(entries).trim();
};

export const buildChatTurnDocument = (chatTurn: ChatTurn): string => {
	const document = {
		sessionId: chatTurn.sessionId,
		sequence: chatTurn.sequence,
		request: chatTurn.request,
		response: chatTurn.response,
	};
	return JSON.stringify(document).trim();
};

export const buildCharacterDocument = (character: CharacterMetadata) => {
	const { characterId, showName, description, instruction, updatedAt } = character;
	const document: BasicCharacterInfo = {
		characterId,
		showName,
		description,
		instruction,
		updatedAt,
	};
	return JSON.stringify(document).trim();
};

export const buildProfileDocument = (profile: ProfileMetadata) => {
	const { profileId, showName, description } = profile;
	const document = { profileId, showName, description };
	return JSON.stringify(document).trim();
};

export const buildLoreDocument = (lore: LoreMetadata) => {
	const { characterId, loreId, content, keywords, updatedAt } = lore;
	const document = { characterId, loreId, content, keywords, updatedAt };
	return JSON.stringify(document).trim();
};

export const buildHistoryDocument = (history: HistoryMetadata) => {
	const { characterId, historyId, title, content, periodLabel, updatedAt } = history;
	const document = { characterId, historyId, title, content, periodLabel, updatedAt };
	return JSON.stringify(document).trim();
};
