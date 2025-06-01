import {
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
	RecapInfo,
	parseTextToEntries,
} from '#shared/index.ts';

export const buildNaturalChatText = (request: ChatMessage, response: ChatMessage): string => {
	const userPrompt = parseEntriesToText(request.entries);
	const charResponse = parseEntriesToText(response.entries);

	let documentText = `User Prompt by ${request.showName}: ${userPrompt}\n`;
	documentText += `Character Response by ${response.showName} (Emotion: ${response.emotion}) : ${charResponse}\n\n`;

	return documentText.trim();
};

export const chatMessageToDocument = (entries: ChatEntry[]) => {
	return parseEntriesToText(entries).trim();
};

export const inflateChatMessageDoc = (document: string) => {
	return parseTextToEntries(document);
};

export const chatTurnToDocument = (chatTurn: ChatTurn): string => {
	const document = { request: chatTurn.request, response: chatTurn.response };
	return JSON.stringify(document).trim();
};

export const inflateChatTurnDoc = (document: string) => {
	const parsed = JSON.parse(document);
	const request: ChatMessage = parsed.request;
	const response: ChatMessage = parsed.response;

	// Ensure the request and response are valid ChatMessage objects
	if (!request || !response) {
		throw new Error('Invalid document format for ChatTurn');
	}

	return { request, response };
};

export const buildCharacterDocument = (character: CharacterInfo) => {
	const { description, instruction } = character;
	const document = { description, instruction };
	return JSON.stringify(document).trim();
};

export const inflateCharacterDoc = (
	document: string
): { description: string; instruction: string } => {
	const parsed = JSON.parse(document);
	return { description: parsed.description, instruction: parsed.instruction };
};

export const buildProfileDocument = (profile: ProfileInfo) => {
	const document = { description: profile.description };
	return JSON.stringify(document).trim();
};

export const inflateProfileDoc = (document: string): { description: string } => {
	const parsed = JSON.parse(document);
	return { description: parsed.description };
};

export const buildLoreOrHistoryDocument = (lore: LoreInfo | HistoryInfo) => {
	const { content, title } = lore;
	const document = { title, content };
	return JSON.stringify(document).trim();
};

export const inflateLoreOrHistoryDoc = (document: string): { title: string; content: string } => {
	const parsed = JSON.parse(document);
	return { title: parsed.title, content: parsed.content };
};
