import { ChatEntry } from '#shared/domain/chat/ChatInterfaces.js';
export const parseTextToEntries = (text: string) => {
	const starCount = (text.match(/\*/g) || []).length;
	if (starCount % 2 !== 0) {
		// --- ADD THESE LINES FOR DEBUGGING ---
		console.error('\n🔴 PARSING FAILED! Found text with an odd number of asterisks:');
		console.error('=================================================================');
		console.error(text);
		console.error('=================================================================\n');
		throw Error('parsing error: "*" is not closed throughly.');
	}

	const entries: ChatEntry[] = [];
	const regex = /\*([^*]+)\*|([^*]+)/g;
	let match;

	while ((match = regex.exec(text)) !== null) {
		if (match[1]) {
			entries.push({ type: 'action', prompt: match[1].trim() });
		} else if (match[2]) {
			let dialogueText = match[2].trim();
			if (dialogueText.startsWith('"') && dialogueText.endsWith('"')) {
				dialogueText = dialogueText.substring(1, dialogueText.length - 1);
			}
			entries.push({ type: 'dialogue', prompt: dialogueText });
		}
	}

	return entries;
};

export const parseEntriesToText = (entries: ChatEntry[]): string => {
	return entries
		.map((entry) => (entry.type === 'action' ? `*${entry.prompt}*` : entry.prompt))
		.join('\n');
};
