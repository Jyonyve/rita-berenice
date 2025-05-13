import {
	BasicCharacterInfo,
	CharacterHistory,
	CharacterMetadata,
	CharacterLore,
	ChatMessage,
	ChatMessageType,
	ChatTurn,
	parseEntriesToText,
	ProfileMetadata,
	ChatEntry,
} from '#shared/index.ts';

export const buildChatTurnDocument = (chatTurn: ChatTurn): string => {
	const { request, response } = chatTurn;
	const userPrompt = parseEntriesToText(request.entries);
	const charResponse = parseEntriesToText(response.entries);

	let documentText = `User Prompt by ${request.showName}: ${userPrompt}\n`;
	documentText += `Character Response by ${response.showName} (Emotion: ${response.emotion}) : ${charResponse}`;

	return documentText.trim();
};

export const buildChatMessageDocument = (entries: ChatEntry[]) => {
	return parseEntriesToText(entries).trim();
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

export const buildLoreDocument = (lore: CharacterLore) => {
	const { characterId, loreId, content, keywords, updatedAt } = lore;
	const document = { characterId, loreId, content, keywords, updatedAt };
	return JSON.stringify(document).trim();
};

export const buildHistoryDocument = (history: CharacterHistory) => {
	const { characterId, historyId, title, content, periodLabel, updatedAt } = history;
	const document = { characterId, historyId, title, content, periodLabel, updatedAt };
	return JSON.stringify(document).trim();
};
