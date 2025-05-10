import {
	CharacterHistory,
	CharacterInfo,
	CharacterLore,
	ChatMessageType,
	ChatTurn,
	parseEntriesToText,
	ProfileInfo,
} from '#root/src/shared/index.ts';

export const buildChatTurnDocument = (chatTurn: ChatTurn) => {
	const { request, response } = chatTurn;
	const document = {
		userName: request.showName,
		userPrompt: parseEntriesToText(request.entries),
		charName: response.showName,
		charPrompt: parseEntriesToText(response.entries),
		charEmotion: response.emotion,
	};
	return JSON.stringify(document).trim();
};

export const buildChatMessageDocument = (chatTurn: ChatTurn, type: ChatMessageType) => {
	const { request, response } = chatTurn;
	const chatMessage = type === 'request' ? request : response;
	const document = {
		showName: chatMessage.showName,
		prompt: parseEntriesToText(chatMessage.entries),
		emotion: chatMessage.emotion,
	};
	return JSON.stringify(document).trim();
};

export const buildCharacterDocument = (character: CharacterInfo) => {
	const { characterId, showName, description, instruction, updatedAt } = character;
	const document = { characterId, showName, description, instruction, updatedAt };
	return JSON.stringify(document).trim();
};

export const buildProfileDocument = (profile: ProfileInfo) => {
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
