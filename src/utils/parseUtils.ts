import { ChatEntry } from '@domain/datasource';

export const parseTextToEntries = (text: string): ChatEntry[] => {
	const entries: ChatEntry[] = [];
	const regex = /\*([^*]+)\*|([^*]+)/g;
	let match;

	while ((match = regex.exec(text)) !== null) {
		if (match[1]) {
			entries.push({ type: 'action', text: match[1].trim() });
		} else if (match[2]) {
			entries.push({ type: 'dialogue', text: match[2].trim() });
		}
	}

	return entries;
};
