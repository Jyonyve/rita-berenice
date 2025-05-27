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
	CharacterInfo,
	ProfileInfo,
	ChromaResponse,
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
	const document = { request: chatTurn.request, response: chatTurn.response };
	return JSON.stringify(document).trim();
};

export const buildCharacterDocument = (character: CharacterInfo) => {
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

export const buildProfileDocument = (profile: ProfileInfo) => {
	const { profileId, showName, description } = profile;
	const document = { profileId, showName, description };
	return JSON.stringify(document).trim();
};

export const buildLoreDocument = (lore: LoreInfo) => {
	const { content, keywordsArray } = lore;
	const document = { content, keywordsArray };
	return JSON.stringify(document).trim();
};

export const buildHistoryDocument = (history: HistoryInfo) => {
	const { content, keywordsArray, keyThemesArray, temporalRelations, estimatedEventDate, title } =
		history;
	const document = {
		keywordsArray,
		keyThemesArray,
		title,
		content,
		temporalRelations,
		estimatedEventDate,
	};
	return JSON.stringify(document).trim();
};

// parse metadata and document to entity
export const buildFullEntity = (queryResults: ChromaResponse[]) => {
	return queryResults
		.map((result) => {
			const { ids, metadatas, documents } = result;
			if (ids.length === 0 || metadatas.length === 0 || documents.length === 0) {
				return null;
			}
			if (!metadatas[0] || !documents[0]) {
				return null;
			}
			return { ...metadatas[0], ...JSON.parse(documents[0]) };
		})
		.filter((entity) => !!entity);
};
