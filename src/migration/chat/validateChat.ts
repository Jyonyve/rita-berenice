import fs from 'fs/promises';
import path from 'path';

export interface ChatEntry {
	uuid: string;
	content?: string;
}

export function isContentValid(content: string | undefined | null): boolean {
	if (!content) return true;
	const matches = content.match(/\*/g);
	return !matches || matches.length % 2 === 0;
}

async function validateFile(filePath: string) {
	const raw = await fs.readFile(filePath, 'utf-8');
	const data: ChatEntry[] = JSON.parse(raw);
	const invalids = data.filter((e) => !isContentValid(e.content));
	if (invalids.length === 0) {
		console.log(`✅ ${path.basename(filePath)}: All chats passed validation.`);
	} else {
		console.log(`❌ ${path.basename(filePath)}: Invalid chat entries found:`);
		invalids.forEach((e) => console.log(`UUID: ${e.uuid}\nProblematic Content: ${e.content}\n---`));
	}
}

async function main() {
	const resultDir = './src/migration/chat/result';
	const files = await fs.readdir(resultDir);
	for (const f of files) {
		if (f.endsWith('.json')) {
			await validateFile(path.join(resultDir, f));
		}
	}
}

main();
