import {
	HistoryInfo,
	LoreInfo,
	ChatTurn,
	parseEntriesToText,
	ChatEntry,
	ChatMessage,
	CharacterInfo,
	ProfileInfo,
	parseTextToEntries,
	TermInfo,
} from '#shared/index.ts';

export const buildNaturalChatText = (request: ChatMessage, response: ChatMessage): string => {
	const userPrompt = parseEntriesToText(request.entries);
	const charResponse = parseEntriesToText(response.entries);

	let documentText = `User Prompt by ${request.showName}: ${userPrompt}\n`;
	documentText += `Character Response by ${response.showName} (Emotion: ${response.emotion}) : ${charResponse}\n\n`;

	return documentText.trim();
};

export const flatChatMessageToDoc = (entries: ChatEntry[]) => {
	return parseEntriesToText(entries).trim();
};

export const inflateChatMessageDoc = (document: string) => {
	return parseTextToEntries(document);
};

export const flatChatTurnToDoc = (chatTurn: ChatTurn): string => {
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

export const flatCharacterToDoc = (character: CharacterInfo) => {
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

export const flatProfileToDoc = (profile: ProfileInfo) => {
	const document = { description: profile.description };
	return JSON.stringify(document).trim();
};

export const inflateProfileDoc = (document: string): { description: string } => {
	const parsed = JSON.parse(document);
	return { description: parsed.description };
};

export const flatLoreOrHistoryToDoc = (lore: LoreInfo | HistoryInfo) => {
	const { content, title } = lore;
	const document = { title, content };
	return JSON.stringify(document).trim();
};

export const inflateLoreOrHistoryDoc = (document: string): { title: string; content: string } => {
	const parsed = JSON.parse(document);
	return { title: parsed.title, content: parsed.content };
};

export const flatTermToDoc = (lore: TermInfo) => {
	const { koreanTerm, englishTerm, sessionId } = lore;
	const document = { koreanTerm, englishTerm, sessionId };
	return JSON.stringify(document).trim();
};

export const inflateTermDoc = (
	document: string
): { koreanTerm: string; englishTerm: string; sessionId: string } => {
	const parsed = JSON.parse(document);
	return {
		koreanTerm: parsed.koreanTerm,
		englishTerm: parsed.englishTerm,
		sessionId: parsed.sessionId,
	};
};
