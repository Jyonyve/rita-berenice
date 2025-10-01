import { ChatEntry } from '@rita-berenice/shared/domain';

export const parseTextToEntries = (text: string): ChatEntry[] => {
	// 1. Validate asterisk count first
	const starCount = (text.match(/\*/g) || []).length;
	if (starCount % 2 !== 0) {
		console.error('\n🔴 PARSING FAILED! Found text with an odd number of asterisks:');
		console.error('=================================================================');
		console.error(text);
		console.error('=================================================================\n');
		throw new Error('parsing error: "*" is not closed thoroughly.');
	}

	const entries: ChatEntry[] = [];
	const regex = /\*([^*]+)\*|([^*]+)/g;

	// ✅ NEW: Split the text by line breaks
	const lines = text.split(/\r?\n/);

	// ✅ NEW: Process each line individually
	for (const line of lines) {
		// Skip empty lines to avoid creating empty entries
		if (line.trim() === '') continue;

		regex.lastIndex = 0; // Reset regex state for each line
		let match;

		while ((match = regex.exec(line)) !== null) {
			// Asterisk-wrapped text is an action
			if (match[1]) {
				entries.push({ type: 'action', prompt: match[1].trim() });
			}
			// Regular text is dialogue
			else if (match[2]) {
				let dialogueText = match[2].trim();
				// Strip outer quotes if they exist, but don't require them
				if (dialogueText.startsWith('"') && dialogueText.endsWith('"')) {
					dialogueText = dialogueText.substring(1, dialogueText.length - 1);
				}
				// Only push non-empty dialogue
				if (dialogueText) {
					entries.push({ type: 'dialogue', prompt: dialogueText });
				}
			}
		}
	}

	return entries;
};

// This function already works correctly by joining entries with a newline
export const parseEntriesToText = (entries: ChatEntry[]): string => {
	return entries
		.map((entry) => (entry.type === 'action' ? `*${entry.prompt}*` : entry.prompt))
		.join('\n');
};
