import { ChatEntry } from '@domain/chat';
import { v4 as uuidv4 } from 'uuid';

export const parseTextToEntries = (text: string): ChatEntry[] => {
	const entries: ChatEntry[] = [];
	const regex = /\*([^*]+)\*|([^*]+)/g;
	let match;

	while ((match = regex.exec(text)) !== null) {
		if (match[1]) {
			entries.push({ type: 'action', prompt: match[1].trim() });
		} else if (match[2]) {
			entries.push({ type: 'dialogue', prompt: match[2].trim() });
		}
	}

	return entries;
};

export const parseEntriesToText = (entries: ChatEntry[]): string => {
	return entries
		.map((entry) => (entry.type === 'action' ? `*${entry.prompt}*` : entry.prompt))
		.join(' ');
};

export const removeLocalPrefix = (localModel: string): string => {
	const prefix = 'local_';
	return localModel.startsWith(prefix) ? localModel.slice(prefix.length) : localModel;
};

export const buildNewSessionId = (characterLabel: string): string => {
	return `${characterLabel}_${uuidv4()}`;
};
